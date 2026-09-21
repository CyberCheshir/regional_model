"""
Сохранение графа, нарисованного на карте, в БД (bulk-операция).

Принимает снимок графа из фронтенда (локальные строковые id → записи в БД)
и атомарно заменяет содержимое проекта: объекты, узлы, сегменты, трубопроводы,
лицензионные участки.

Контракт входных данных (POST /api/map/save/):
{
  "project_id": "<uuid|null>",
  "facilities": [
    {"id":"<local>","name":"Куст 1","kind":"wellpad","lat":..,"lng":..,
     "width_m":..,"height_m":..,"angle_deg":..,"status":"running",
     "license_area":"","owner":""}
  ],
  "nodes": [
    {"id":"<local>","name":"..","kind":"vertex|tee|tap","lat":..,"lng":..,
     "facility_id":"<local facility id|null>"}
  ],
  "segments": [
    {"id":"<local>","name":"..","start_node_id":"<local>","end_node_id":"<local>",
     "fluid":"oil|gas|water","diameter_mm":..,"wall_thickness_mm":..,"burial_depth_m":..}
  ],
  "pipelines": [
    {"id":"<local>","name":"Трубопровод 1","fluid":"oil","segment_ids":["<local>", ...]}
  ],
  "licence_areas": [
    {"id":"<local>","name":"Лицензионный участок 1","polygon":[[lng,lat], ...]}
  ]
}

Ответ: {"project_id": "<uuid>", "counts": {...}}
"""
from __future__ import annotations

from django.db import transaction

from core.models import (
    Facility,
    LicenceArea,
    NetworkNode,
    NetworkSegment,
    Pipeline,
    PipelineSegment,
    Project,
)
from core.services.common import haversine_m


class GraphImportError(ValueError):
    """Ошибка разбора/валидации входного графа."""


def _as_list(payload: dict, key: str) -> list:
    value = payload.get(key) or []
    if not isinstance(value, list):
        raise GraphImportError(f"Поле «{key}» должно быть массивом")
    return value


def _checked_id(raw: object, key: str) -> str:
    if raw is None or str(raw) == "":
        raise GraphImportError(f"У записи «{key}» отсутствует id")
    return str(raw)


def _dedupe_by_id(rows: list, key: str) -> list:
    # Убрать дубли записей по полю id (оставляем первую).
    seen: set[str] = set()
    out: list = []
    for row in rows:
        local_id = _checked_id(row.get("id"), key)
        if local_id in seen:
            continue
        seen.add(local_id)
        out.append(row)
    return out


@transaction.atomic
def save_map_graph(project: Project, payload: dict) -> dict:
    """Атомарно сохранить граф: заменить объекты/узлы/сегменты/трубопроводы/участки."""
    # Дедупликация входных данных по id — иначе unique-constraint по
    # (project, external_key) отклонит запрос с дублями.
    facilities_payload = _dedupe_by_id(_as_list(payload, "facilities"), "facilities")
    nodes_payload = _dedupe_by_id(_as_list(payload, "nodes"), "nodes")
    segments_payload = _dedupe_by_id(_as_list(payload, "segments"), "segments")
    pipelines_payload = _dedupe_by_id(_as_list(payload, "pipelines"), "pipelines")
    areas_payload = _dedupe_by_id(_as_list(payload, "licence_areas"), "licence_areas")

    # Полная замена содержимого проекта (простая и предсказуемая семантика «снимок»).
    NetworkSegment.objects.filter(project=project).delete()
    NetworkNode.objects.filter(project=project).delete()
    Pipeline.objects.filter(project=project).delete()
    Facility.objects.filter(project=project).delete()
    LicenceArea.objects.filter(project=project).delete()

    # 1. Объекты: локальный id → запись в БД.
    facilities_by_local: dict[str, Facility] = {}
    for row in facilities_payload:
        local_id = _checked_id(row.get("id"), "facilities")
        kind = row.get("kind") or "facility"
        if kind not in {"wellpad", "facility", "delivery-point"}:
            raise GraphImportError(f"Неизвестный kind объекта: {kind}")
        facilities_by_local[local_id] = Facility.objects.create(
            project=project,
            name=row.get("name") or "Объект",
            kind=kind,
            lat=float(row.get("lat", 0.0)),
            lng=float(row.get("lng", 0.0)),
            width_m=float(row.get("width_m", 140.0)),
            height_m=float(row.get("height_m", 100.0)),
            angle_deg=float(row.get("angle_deg", 0.0)),
            status=row.get("status") or "running",
            license_area=row.get("license_area") or "",
            owner=row.get("owner") or "",
            external_key=local_id,
        )

    # 2. Узлы (вершины/тройники/врезки). Концы рёбер ссылаются на локальные id узлов.
    nodes_by_local: dict[str, NetworkNode] = {}
    for row in nodes_payload:
        local_id = _checked_id(row.get("id"), "nodes")
        kind = row.get("kind") or "vertex"
        if kind not in {"vertex", "tee", "tap"}:
            raise GraphImportError(f"Неизвестный kind узла: {kind}")
        facility_local = row.get("facility_id")
        nodes_by_local[local_id] = NetworkNode.objects.create(
            project=project,
            facility=facilities_by_local.get(str(facility_local)) if facility_local else None,
            name=row.get("name") or "Узел",
            kind=kind,
            lat=float(row.get("lat", 0.0)),
            lng=float(row.get("lng", 0.0)),
            # Привязка врезки к ребру (edgeId, t) и подключённых вершин.
            tap_edge_external=row.get("tap_edge_id") or None,
            tap_t=row.get("tap_t"),
            bound_tap_external=row.get("bound_tap_id") or None,
            bound_fitting_external=row.get("bound_fitting_id") or None,
            external_key=local_id,
        )

    def _resolve_node(raw) -> NetworkNode:
        node = nodes_by_local.get(str(raw))
        if node is None:
            raise GraphImportError(f"Сегмент ссылается на несуществующий узел: {raw}")
        return node

    # 3. Сегменты (рёбра) — длина считается, если не задана.
    segments_by_local: dict[str, NetworkSegment] = {}
    for row in segments_payload:
        local_id = _checked_id(row.get("id"), "segments")
        start = _resolve_node(row.get("start_node_id"))
        end = _resolve_node(row.get("end_node_id"))
        if start.id == end.id:
            raise GraphImportError("Начало и конец сегмента совпадают")
        length = row.get("length_m")
        if length is None:
            length = haversine_m(start.lat, start.lng, end.lat, end.lng)
        segments_by_local[local_id] = NetworkSegment.objects.create(
            project=project,
            name=row.get("name") or "Сегмент",
            start_node=start,
            end_node=end,
            fluid=row.get("fluid") or "oil",
            pipeline_class=row.get("pipeline_class") or "field",
            length_m=float(length),
            diameter_mm=row.get("diameter_mm"),
            wall_thickness_mm=row.get("wall_thickness_mm"),
            roughness_mm=row.get("roughness_mm"),
            burial_depth_m=row.get("burial_depth_m"),
            external_key=local_id,
        )

    # 4. Трубопроводы — упорядоченная цепочка сегментов.
    for row in pipelines_payload:
        raw_segment_ids = row.get("segment_ids") or []
        if not raw_segment_ids:
            raise GraphImportError("Трубопровод без сегментов")
        pipeline = Pipeline.objects.create(
            project=project,
            name=row.get("name") or "Трубопровод",
            fluid=row.get("fluid") or "oil",
            pipeline_class=row.get("pipeline_class") or "field",
            external_key=_checked_id(row.get("id"), "pipelines"),
        )
        PipelineSegment.objects.bulk_create(
            [
                PipelineSegment(
                    pipeline=pipeline,
                    segment=segments_by_local[str(seg_local_id)],
                    position=position,
                )
                for position, seg_local_id in enumerate(raw_segment_ids)
                if str(seg_local_id) in segments_by_local
            ]
        )

    # 5. Лицензионные участки (полигоны).
    for row in areas_payload:
        polygon = row.get("polygon") or []
        if not isinstance(polygon, list) or len(polygon) < 3:
            raise GraphImportError("Полигон участка требует минимум 3 точки")
        LicenceArea.objects.create(
            project=project,
            name=row.get("name") or "Лицензионный участок",
            polygon=polygon,
            external_key=_checked_id(row.get("id"), "licence_areas"),
        )

    return {
        "project_id": str(project.id),
        "counts": {
            "facilities": len(facilities_by_local),
            "nodes": len(nodes_by_local),
            "segments": len(segments_by_local),
            "pipelines": len(pipelines_payload),
            "licence_areas": len(areas_payload),
        },
    }
