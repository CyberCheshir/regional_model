from __future__ import annotations

from django.db import transaction
from rest_framework import serializers

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
    ValidationItem,
)


# ---------------------------------------------------------------------------
# CRUD-сериализаторы сущностей модели
# ---------------------------------------------------------------------------


class UidSafeMixin(serializers.Serializer):
    """
    Безопасное поле `uid` для CRUD-сериализаторов.

    Читается через getattr: если миграция 0004 (поле `uid`) к текущей схеме ещё
    не применена, атрибута нет — отдаём None, а не падаем с FieldError (500).
    Поле только для чтения: uid генерирует клиент при создании объекта.
    """

    uid = serializers.SerializerMethodField()

    def get_uid(self, obj):
        value = getattr(obj, "uid", None)
        return str(value) if value else None


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ["id", "name", "slug", "description", "storage_crs", "source_crs", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class FacilitySerializer(UidSafeMixin, serializers.ModelSerializer):
    class Meta:
        model = Facility
        fields = [
            "id", "uid", "project", "external_key", "name", "kind", "lat", "lng",
            "width_m", "height_m", "angle_deg", "status", "license_area", "owner",
            "attributes", "created_at", "updated_at",
        ]
        # project назначается во view (perform_create) по project_id из query/body.
        read_only_fields = ["id", "project", "created_at", "updated_at"]

class NetworkNodeSerializer(UidSafeMixin, serializers.ModelSerializer):
    class Meta:
        model = NetworkNode
        fields = [
            "id", "uid", "project", "facility", "external_key", "name", "kind",
            "lat", "lng", "tap_edge_external", "tap_t",
            "bound_tap_external", "bound_fitting_external",
            "attributes", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "project", "created_at", "updated_at"]


class NetworkSegmentSerializer(UidSafeMixin, serializers.ModelSerializer):
    class Meta:
        model = NetworkSegment
        fields = [
            "id", "uid", "project", "external_key", "name", "start_node", "end_node",
            "fluid", "pipeline_class", "length_m", "diameter_mm", "wall_thickness_mm",
            "roughness_mm", "burial_depth_m", "attributes", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "project", "created_at", "updated_at"]

    def validate(self, attrs):
        start = attrs.get("start_node", getattr(self.instance, "start_node", None))
        end = attrs.get("end_node", getattr(self.instance, "end_node", None))
        if start and end and start.id == end.id:
            raise serializers.ValidationError("start_node и end_node должны различаться")
        return attrs


class PipelineSerializer(UidSafeMixin, serializers.ModelSerializer):
    """Трубопровод + упорядоченный список сегментов (segment_ids на запись)."""

    segment_ids = serializers.ListField(child=serializers.UUIDField(), write_only=True, required=False)
    segments = serializers.SerializerMethodField()

    class Meta:
        model = Pipeline
        fields = [
            "id", "uid", "project", "external_key", "name", "fluid", "pipeline_class",
            "attributes", "segment_ids", "segments", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "project", "created_at", "updated_at"]

    def get_segments(self, obj):
        return [str(row.segment_id) for row in obj.pipeline_segments.all().order_by("position")]

    def _replace_segments(self, instance: Pipeline, segment_ids):
        if segment_ids is None:
            return
        rows = {row.id: row for row in NetworkSegment.objects.filter(id__in=segment_ids)}
        if len(rows) != len(set(segment_ids)):
            raise serializers.ValidationError({"segment_ids": "Часть сегментов не найдена"})
        instance.pipeline_segments.all().delete()
        PipelineSegment.objects.bulk_create(
            [
                PipelineSegment(pipeline=instance, segment=rows[sid], position=position)
                for position, sid in enumerate(segment_ids)
            ]
        )

    @transaction.atomic
    def create(self, validated_data):
        segment_ids = validated_data.pop("segment_ids", [])
        instance = super().create(validated_data)
        self._replace_segments(instance, segment_ids)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        segment_ids = validated_data.pop("segment_ids", None)
        instance = super().update(instance, validated_data)
        self._replace_segments(instance, segment_ids)
        return instance


class LicenceAreaSerializer(UidSafeMixin, serializers.ModelSerializer):
    class Meta:
        model = LicenceArea
        fields = ["id", "uid", "project", "external_key", "name", "polygon", "attributes", "created_at", "updated_at"]
        # project назначается во view (DefaultProjectViewSet.perform_create)
        # по project_id из query/body — в теле его передавать не обязательно.
        read_only_fields = ["id", "project", "created_at", "updated_at"]

    def validate_polygon(self, value):
        if not isinstance(value, list) or len(value) < 3:
            raise serializers.ValidationError("Полигон участка требует минимум 3 точек")
        for point in value:
            if not (isinstance(point, (list, tuple)) and len(point) == 2):
                raise serializers.ValidationError("Точка должна быть парой [lng, lat]")
        return value


class FlowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Flow
        fields = [
            "id", "project", "source", "target", "flow_type", "fluid", "is_logical_flow",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "project", "created_at", "updated_at"]


class CalculationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalculationRun
        fields = [
            "id", "project", "status", "progress", "stage", "current_year", "message",
            "result_summary", "created_at", "updated_at",
        ]
        read_only_fields = fields


class GRResultSerializer(serializers.ModelSerializer):
    entity_name = serializers.CharField(source="entity.name", read_only=True)

    class Meta:
        model = GRResult
        fields = ["id", "run", "entity", "entity_name", "year", "data"]


# ---------------------------------------------------------------------------
# Контрактные сериализаторы для фронтенда (см. frontend/src/domain/schemas.ts)
# ---------------------------------------------------------------------------


class MapGraphNodeSerializer(serializers.Serializer):
    """Узел графа карты: { id, label, kind, entityId }."""

    id = serializers.CharField()
    label = serializers.CharField()
    kind = serializers.CharField()          # wellpad | processing | delivery
    entityId = serializers.CharField()


class MapGraphEdgeSerializer(serializers.Serializer):
    """Ребро графа: { id, from, to, fluid, flowLabel }."""

    def to_representation(self, instance: dict) -> dict:
        return {
            "id": str(instance["id"]),
            "from": str(instance["from"]),
            "to": str(instance["to"]),
            "fluid": str(instance["fluid"]),
            "pipelineClass": str(instance["pipelineClass"]),
            "flowLabel": str(instance["flowLabel"]),
        }


class MapGraphSerializer(serializers.Serializer):
    """Ответ GET /api/map/graph/ — ровно как ждёт фронтенд (MapGraphSchema)."""

    nodes = MapGraphNodeSerializer(many=True)
    edges = MapGraphEdgeSerializer(many=True)


class FlowLinkSerializer(serializers.Serializer):
    """Связь объекта (инспектор): соответствует FlowSchema фронтенда."""

    id = serializers.CharField()
    targetId = serializers.CharField()
    targetLabel = serializers.CharField()
    targetKind = serializers.CharField()
    flowType = serializers.CharField()
    isLogicalFlow = serializers.BooleanField()
    fluid = serializers.CharField(required=False)


class ValidationItemContractSerializer(serializers.Serializer):
    label = serializers.CharField()
    value = serializers.CharField()
    ok = serializers.BooleanField()


class EntityDetailsSerializer(serializers.Serializer):
    """Ответ GET /api/entities/<id>/ — соответствует EntityDetailsSchema."""

    id = serializers.CharField()
    label = serializers.CharField()
    kind = serializers.CharField()
    subType = serializers.CharField(required=False)
    status = serializers.CharField()        # running | warning | stopped
    licenseArea = serializers.CharField()
    owner = serializers.CharField()
    modelStatus = ValidationItemContractSerializer(many=True)
    outgoing = FlowLinkSerializer(many=True)
    incoming = FlowLinkSerializer(many=True)


# ---------------------------------------------------------------------------
# Вспомогательный сериализатор для чекмарков (модель ValidationItem)
# ---------------------------------------------------------------------------


class ValidationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValidationItem
        fields = ["id", "entity", "label", "value", "ok", "position"]
        read_only_fields = ["id"]
