from __future__ import annotations
from uuid import UUID
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    CalculationRun,
    Facility,
    Flow,
    GRResult,
    LicenceArea,
    NetworkNode,
    NetworkSegment,
    Pipeline,
    PipelineSegment,
    Project,
)
from .serializers import (
    CalculationRunSerializer,
    EntityDetailsSerializer,
    FacilitySerializer,
    FlowSerializer,
    GRResultSerializer,
    LicenceAreaSerializer,
    MapGraphSerializer,
    NetworkNodeSerializer,
    NetworkSegmentSerializer,
    PipelineSerializer,
    ProjectSerializer,
)
from .services.common import (
    get_project_or_default,
    haversine_m,
    resolve_project_for_save,
)
from .services.entity_details import build_entity_details
from .services.graph_import import GraphImportError, save_map_graph
from .services.map_payload import build_map_graph
from .services.project_snapshot import build_project_snapshot


def _project_from_request(request) -> Project:
    project_id = request.query_params.get("project_id")
    if not project_id and isinstance(getattr(request, "data", None), dict):
        project_id = request.data.get("project")
    return get_project_or_default(project_id)


class DefaultProjectViewSet(viewsets.ModelViewSet):
    """Базовый ViewSet: сущности привязаны к проекту (из query/body или default)."""

    project_field = "project"

    def get_project(self) -> Project:
        # project_id берём из query-строки, а если нет — из тела запроса
        # (фронтенд в POST-теле передаёт «project» или «project_id»).
        project_id = self.request.query_params.get("project_id")
        if not project_id and isinstance(getattr(self.request, "data", None), dict):
            project_id = self.request.data.get("project_id") or self.request.data.get("project")
        return get_project_or_default(project_id)

    def perform_create(self, serializer):
        project = serializer.validated_data.get("project") or self.get_project()
        serializer.save(project=project)

    def get_queryset(self):
        return super().get_queryset().filter(project=self.get_project())


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by("name")
    serializer_class = ProjectSerializer


class FacilityViewSet(DefaultProjectViewSet):
    queryset = Facility.objects.all()
    serializer_class = FacilitySerializer

    @action(detail=True, methods=["post"], url_path="nodes")
    def create_node(self, request, pk=None):
        """Создать узел, привязанный к объекту (клик по карте)."""
        facility = self.get_object()
        try:
            lat = float(request.data.get("lat"))
            lng = float(request.data.get("lng"))
        except (TypeError, ValueError):
            return Response({"error": "lat и lng обязательны"}, status=status.HTTP_400_BAD_REQUEST)
        node = NetworkNode.objects.create(
            project=facility.project,
            facility=facility,
            name=request.data.get("name") or f"{facility.name} — узел {facility.nodes.count() + 1}",
            kind=request.data.get("kind") or "vertex",
            lat=lat,
            lng=lng,
            attributes={"created_from_map_click": True},
        )
        return Response(NetworkNodeSerializer(node).data, status=status.HTTP_201_CREATED)


class NetworkNodeViewSet(DefaultProjectViewSet):
    queryset = NetworkNode.objects.select_related("facility").all()
    serializer_class = NetworkNodeSerializer


class NetworkSegmentViewSet(DefaultProjectViewSet):
    queryset = NetworkSegment.objects.select_related("start_node", "end_node").all()
    serializer_class = NetworkSegmentSerializer

    def perform_create(self, serializer):
        project = serializer.validated_data.get("project") or self.get_project()
        start = serializer.validated_data["start_node"]
        end = serializer.validated_data["end_node"]
        length = serializer.validated_data.get("length_m")
        if length is None:
            length = haversine_m(start.lat, start.lng, end.lat, end.lng)
        serializer.save(project=project, length_m=length)


class PipelineViewSet(DefaultProjectViewSet):
    queryset = Pipeline.objects.prefetch_related("pipeline_segments").all()
    serializer_class = PipelineSerializer

    @action(detail=False, methods=["post"], url_path="from-segments")
    def from_segments(self, request):
        """
        Создать трубопровод из выбранных сегментов (аналог кнопки
        «Объединить в трубопровод» во фронтенде).
        """
        project = self.get_project()
        raw_ids = request.data.get("segment_ids") or []
        if not raw_ids:
            return Response({"error": "segment_ids обязателен"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            segment_ids = [UUID(str(value)) for value in raw_ids]
        except (TypeError, ValueError):
            return Response({"error": "Некорректный id сегмента"}, status=status.HTTP_400_BAD_REQUEST)
        rows = {row.id: row for row in NetworkSegment.objects.filter(project=project, id__in=segment_ids)}
        if len(rows) != len(set(segment_ids)):
            return Response({"error": "Часть сегментов не найдена"}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            pipeline = Pipeline.objects.create(
                project=project,
                name=request.data.get("name") or "Новый трубопровод",
                fluid=request.data.get("fluid") or "oil",
                attributes=request.data.get("attributes") or {},
            )
            PipelineSegment.objects.bulk_create(
                [
                    PipelineSegment(pipeline=pipeline, segment=rows[sid], position=position)
                    for position, sid in enumerate(segment_ids)
                ]
            )
        return Response(self.get_serializer(pipeline).data, status=status.HTTP_201_CREATED)


class LicenceAreaViewSet(DefaultProjectViewSet):
    queryset = LicenceArea.objects.all()
    serializer_class = LicenceAreaSerializer


class FlowViewSet(DefaultProjectViewSet):
    queryset = Flow.objects.select_related("source", "target").all()
    serializer_class = FlowSerializer


@api_view(["GET"])
def health(request):
    """Проверка живости сервиса (используется frontend-прокси: /api/health/)."""
    return Response({"status": "ok", "service": "regional-model"})


@api_view(["GET"])
def map_graph(request):
    """
    Граф карты в контракте фронтенда (MapGraphSchema):
        { nodes: [...], edges: [...] }
    """
    project = _project_from_request(request)
    payload = build_map_graph(project)
    return Response(MapGraphSerializer(payload).data)


@api_view(["POST"])
def map_save(request):
    # Сохранить граф, нарисованный на карте (снимок проекта): объекты, узлы,
    # сегменты, трубопроводы, участки. См. services/graph_import.py.
    if not isinstance(request.data, dict):
        return Response({"error": "Ожидается JSON-объект"}, status=status.HTTP_400_BAD_REQUEST)
    # Проект выбирается по имени (создаётся/переиспользуется) либо по project_id.
    project = resolve_project_for_save(
        request.data.get("project_id"), request.data.get("project_name")
    )
    try:
        result = save_map_graph(project, request.data)
    except GraphImportError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    result["project_name"] = project.name
    return Response(result, status=status.HTTP_201_CREATED)

@api_view(["GET"])
def map_load(request):
    # Полный снимок проекта для загрузки в domain layer фронтенда.
    # Проект выбирается по `project_id` или по имени `project_name` (query).
    project_id = request.query_params.get("project_id")
    project_name = request.query_params.get("project_name")
    if project_name and not project_id:
        project = Project.objects.filter(name=project_name).first()
        if project is None:
            return Response({"error": f"Сценарий «{project_name}» не найден"}, status=status.HTTP_404_NOT_FOUND)
    else:
        project = get_project_or_default(project_id)
    return Response(build_project_snapshot(project))

@api_view(["GET"])
def entity_details(request, entity_id):
    """Детальная карточка объекта/трубопровода (EntityDetailsSchema)."""
    details = build_entity_details(entity_id)
    if details is None:
        return Response({"error": "Объект не найден"}, status=status.HTTP_404_NOT_FOUND)
    return Response(EntityDetailsSerializer(details).data)


@api_view(["POST"])
def calculation_start(request):
    """Запустить расчёт (создаёт CalculationRun в статусе queued)."""
    project = _project_from_request(request)
    run = CalculationRun.objects.create(project=project, status="queued", progress=0, stage="queued")
    return Response(CalculationRunSerializer(run).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def calculation_status(request, run_id):
    run = get_object_or_404(CalculationRun, id=run_id)
    return Response(CalculationRunSerializer(run).data)


@api_view(["GET"])
def calculation_results(request, run_id):
    run = get_object_or_404(CalculationRun, id=run_id)
    rows = GRResult.objects.filter(run=run).select_related("entity")
    year = request.query_params.get("year")
    if year:
        try:
            rows = rows.filter(year=int(year))
        except ValueError:
            return Response({"error": "year должен быть целым"}, status=status.HTTP_400_BAD_REQUEST)
    return Response(GRResultSerializer(rows[:5000], many=True).data)
