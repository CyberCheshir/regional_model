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

import uuid

from django.db import connection, transaction

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


def _as_uuid(raw: object) -> "uuid.UUID | None":
    """Привести uid из payload к UUID; None — если поля нет/оно невалидно."""
    if raw is None or str(raw) == "":
        return None
    try:
        return uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return None


def _supports_uid(model) -> bool:
    """
    Есть ли колонка `uid` в ТЕКУЩЕЙ схеме БД.

    Миграция 0004 добавляет поле, но работающий контейнер может быть собран
    из более старого кода — тогда обращение к `uid` давало FieldError → HTTP 500.
    Проверка позволяет сохранять граф в любой схеме: со поддержкой uid —
    upsert с сохранением PK, без неё — прежняя семантика «заменить содержимое».
    """
    try:
        field_names = {f.name for f in model._meta.get_fields()}
        if "uid" not in field_names:
            return False
        with connection.cursor() as cursor:
            columns = {c.name for c in connection.introspection.get_table_description(
                cursor, model._meta.db_table
            )}
        return "uid" in columns
    except Exception:
        # Любая неожиданность (нет таблицы и т.п.) — считаем, что uid нет.
        return False


@transaction.atomic
def save_map_graph(project: Project, payload: dict) -> dict:
    """
    Атомарно сохранить граф, СОХРАНЯЯ идентичность объектов.

    Семантика «снимок» осталась: содержимое проекта приводится к присланному
    набору сущностей. Но замена больше НЕ удаляет-и-создаёт всё подряд:

      * есть uid, запись с таким uid уже в проекте → UPDATE (PK сохраняется);
      * uid нет или записи нет → CREATE;
      * сущности, которых нет в снимке, → DELETE.

    За счёт этого `uid` (генерируется клиентом) переживает сохранение — domain
    layer, backend и расчётные модули ссылаются на один и тот же объект.
    """
    # Дедупликация входных данных по id — иначе unique-constraint по
    # (project, external_key) отклонит запрос с дублями.
    facilities_payload = _dedupe_by_id(_as_list(payload, "facilities"), "facilities")
    nodes_payload = _dedupe_by_id(_as_list(payload, "nodes"), "nodes")
    segments_payload = _dedupe_by_id(_as_list(payload, "segments"), "segments")
    pipelines_payload = _dedupe_by_id(_as_list(payload, "pipelines"), "pipelines")
    areas_payload = _dedupe_by_id(_as_list(payload, "licence_areas"), "licence_areas")

    # Есть ли в ТЕКУЩЕЙ схеме колонка uid (миграция 0004 может быть не применена).
    uid_enabled = _supports_uid(Facility)

    if uid_enabled:
        # Индексы существующих записей по uid — для точечного обновления.
        existing_facilities = {
            f.uid: f for f in Facility.objects.filter(project=project, uid__isnull=False)
        }
        existing_nodes = {
            n.uid: n for n in NetworkNode.objects.filter(project=project, uid__isnull=False)
        }
        existing_segments = {
            s.uid: s for s in NetworkSegment.objects.filter(project=project, uid__isnull=False)
        }
        existing_pipelines = {
            p.uid: p for p in Pipeline.objects.filter(project=project, uid__isnull=False)
        }
        existing_areas = {
            a.uid: a for a in LicenceArea.objects.filter(project=project, uid__isnull=False)
        }
    else:
        # Схема без uid: прежняя семантика — полная замена содержимого проекта.
        NetworkSegment.objects.filter(project=project).delete()
        NetworkNode.objects.filter(project=project).delete()
        Pipeline.objects.filter(project=project).delete()
        Facility.objects.filter(project=project).delete()
        LicenceArea.objects.filter(project=project).delete()
        existing_facilities = {}
        existing_nodes = {}
        existing_segments = {}
        existing_pipelines = {}
        existing_areas = {}

    # Уцелевшие PK (кто остался после приведения к снимку).
    keep_facility_ids: set = set()
    keep_node_ids: set = set()
    keep_segment_ids: set = set()
    keep_pipeline_ids: set = set()
    keep_area_ids: set = set()

    # 1. Объекты: локальный id → запись в БД. Обновляем по uid, если совпал.
    facilities_by_local: dict[str, Facility] = {}
    for row in facilities_payload:
        local_id = _checked_id(row.get("id"), "facilities")
        kind = row.get("kind") or "facility"
        if kind not in {"wellpad", "facility", "delivery-point"}:
            raise GraphImportError(f"Неизвестный kind объекта: {kind}")
        uid = _as_uuid(row.get("uid"))
        fields = {
            "name": row.get("name") or "Объект",
            "kind": kind,
            "lat": float(row.get("lat", 0.0)),
            "lng": float(row.get("lng", 0.0)),
            "width_m": float(row.get("width_m", 140.0)),
            "height_m": float(row.get("height_m", 100.0)),
            "angle_deg": float(row.get("angle_deg", 0.0)),
            "status": row.get("status") or "running",
            "license_area": row.get("license_area") or "",
            "owner": row.get("owner") or "",
            "external_key": local_id,
        }
        record = existing_facilities.get(uid) if uid else None
        if record is not None:
            # Та же сущность (по uid) — обновляем, PK сохраняется.
            for field, value in fields.items():
                setattr(record, field, value)
            record.save(update_fields=[*fields, "updated_at"])
        else:
            record = Facility.objects.create(
                project=project, **({"uid": uid} if uid_enabled else {}), **fields
            )
        facilities_by_local[local_id] = record
        keep_facility_ids.add(record.id)

    # 2. Узлы (вершины/тройники/врезки). Концы рёбер ссылаются на локальные id узлов.
    nodes_by_local: dict[str, NetworkNode] = {}
    for row in nodes_payload:
        local_id = _checked_id(row.get("id"), "nodes")
        kind = row.get("kind") or "vertex"
        if kind not in {"vertex", "tee", "tap"}:
            raise GraphImportError(f"Неизвестный kind узла: {kind}")
        facility_local = row.get("facility_id")
        uid = _as_uuid(row.get("uid"))
        fields = {
            "facility": facilities_by_local.get(str(facility_local)) if facility_local else None,
            "name": row.get("name") or "Узел",
            "kind": kind,
            "lat": float(row.get("lat", 0.0)),
            "lng": float(row.get("lng", 0.0)),
            # Привязка врезки к ребру (edgeId, t) и подключённых вершин.
            "tap_edge_external": row.get("tap_edge_id") or None,
            "tap_t": row.get("tap_t"),
            "bound_tap_external": row.get("bound_tap_id") or None,
            "bound_fitting_external": row.get("bound_fitting_id") or None,
            "external_key": local_id,
        }
        record = existing_nodes.get(uid) if uid else None
        if record is not None:
            for field, value in fields.items():
                setattr(record, field, value)
            record.save(update_fields=[*fields, "updated_at"])
        else:
            record = NetworkNode.objects.create(
                project=project, **({"uid": uid} if uid_enabled else {}), **fields
            )
        nodes_by_local[local_id] = record
        keep_node_ids.add(record.id)

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
        uid = _as_uuid(row.get("uid"))
        fields = {
            "name": row.get("name") or "Сегмент",
            "start_node": start,
            "end_node": end,
            "fluid": row.get("fluid") or "oil",
            "pipeline_class": row.get("pipeline_class") or "field",
            "length_m": float(length),
            "diameter_mm": row.get("diameter_mm"),
            "wall_thickness_mm": row.get("wall_thickness_mm"),
            "roughness_mm": row.get("roughness_mm"),
            "burial_depth_m": row.get("burial_depth_m"),
            "external_key": local_id,
        }
        record = existing_segments.get(uid) if uid else None
        if record is not None:
            for field, value in fields.items():
                setattr(record, field, value)
            record.save(update_fields=[*fields, "updated_at"])
        else:
            record = NetworkSegment.objects.create(
                project=project, **({"uid": uid} if uid_enabled else {}), **fields
            )
        segments_by_local[local_id] = record
        keep_segment_ids.add(record.id)

    # 4. Трубопроводы — упорядоченная цепочка сегментов.
    for row in pipelines_payload:
        raw_segment_ids = row.get("segment_ids") or []
        if not raw_segment_ids:
            raise GraphImportError("Трубопровод без сегментов")
        uid = _as_uuid(row.get("uid"))
        fields = {
            "name": row.get("name") or "Трубопровод",
            "fluid": row.get("fluid") or "oil",
            "pipeline_class": row.get("pipeline_class") or "field",
            "external_key": _checked_id(row.get("id"), "pipelines"),
        }
        pipeline = existing_pipelines.get(uid) if uid else None
        if pipeline is not None:
            for field, value in fields.items():
                setattr(pipeline, field, value)
            pipeline.save(update_fields=[*fields, "updated_at"])
            # Состав трубопровода пересобираем заново (он мог измениться).
            PipelineSegment.objects.filter(pipeline=pipeline).delete()
        else:
            pipeline = Pipeline.objects.create(
                project=project, **({"uid": uid} if uid_enabled else {}), **fields
            )
        keep_pipeline_ids.add(pipeline.id)
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
        uid = _as_uuid(row.get("uid"))
        fields = {
            "name": row.get("name") or "Лицензионный участок",
            "polygon": polygon,
            "external_key": _checked_id(row.get("id"), "licence_areas"),
        }
        record = existing_areas.get(uid) if uid else None
        if record is not None:
            for field, value in fields.items():
                setattr(record, field, value)
            record.save(update_fields=[*fields, "updated_at"])
        else:
            record = LicenceArea.objects.create(
                project=project, **({"uid": uid} if uid_enabled else {}), **fields
            )
        keep_area_ids.add(record.id)

    # 6. Удаляем то, чего НЕТ в снимке (объект пропал на карте).
    #    Порядок важен: сначала зависимые сущности (сегменты, узлы), затем объекты.
    NetworkSegment.objects.filter(project=project).exclude(id__in=keep_segment_ids).delete()
    NetworkNode.objects.filter(project=project).exclude(id__in=keep_node_ids).delete()
    Pipeline.objects.filter(project=project).exclude(id__in=keep_pipeline_ids).delete()
    Facility.objects.filter(project=project).exclude(id__in=keep_facility_ids).delete()
    LicenceArea.objects.filter(project=project).exclude(id__in=keep_area_ids).delete()

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
