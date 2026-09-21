from __future__ import annotations

from core.models import Facility, NetworkSegment, Pipeline, Project

# Соответствие доменного kind объекта маркеру карты фронтенда
# (WellpadNodeSchema.marker = 'wellpad'; FacilitySchema.marker = 'processing' | 'delivery').
MARKER_KIND_BY_FACILITY = {
    "wellpad": "wellpad",
    "facility": "processing",
    "delivery-point": "delivery",
}

# Метки расхода для рёбер-сегментов (значение по умолчанию, пока нет расчёта).
DEFAULT_FLOW_LABEL = "—"


def build_map_graph(project: Project) -> dict:
    """
    Собирает ответ GET /api/map/graph/ в формате, который ждёт фронтенд:
        { nodes: [{id,label,kind,entityId}], edges: [{id,from,to,fluid,flowLabel}] }

    Узлы = объекты (facilities). Рёбра = сегменты сети; концы ребра берём по
    facility, привязанному к узлу сегмента (если есть), иначе по самому узлу.
    """
    facilities = list(Facility.objects.filter(project=project).order_by("name"))
    segments = list(
        NetworkSegment.objects.filter(project=project)
        .select_related("start_node__facility", "end_node__facility")
        .order_by("name")
    )

    nodes = [
        {
            "id": str(f.id),
            "label": f.name,
            "kind": MARKER_KIND_BY_FACILITY.get(f.kind, "processing"),
            "entityId": str(f.id),
        }
        for f in facilities
    ]

    edges = []
    for seg in segments:
        from_id = (
            str(seg.start_node.facility_id)
            if seg.start_node.facility_id
            else str(seg.start_node_id)
        )
        to_id = (
            str(seg.end_node.facility_id)
            if seg.end_node.facility_id
            else str(seg.end_node_id)
        )
        edges.append(
            {
                "id": str(seg.id),
                "from": from_id,
                "to": to_id,
                "fluid": seg.fluid,
                "pipelineClass": seg.pipeline_class,
                "flowLabel": seg.attributes.get("flowLabel", DEFAULT_FLOW_LABEL)
                if isinstance(seg.attributes, dict)
                else DEFAULT_FLOW_LABEL,
            }
        )

    return {"nodes": nodes, "edges": edges}


def build_pipelines_summary(project: Project) -> list[dict]:
    """Краткая сводка трубопроводов (для дерева объектов): id, name, кол-во сегментов."""
    pipelines = (
        Pipeline.objects.filter(project=project)
        .prefetch_related("pipeline_segments")
        .order_by("name")
    )
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "fluid": p.fluid,
            "segment_count": p.pipeline_segments.count(),
        }
        for p in pipelines
    ]
