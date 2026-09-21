"""
Сборка полного снимка проекта для загрузки в domain layer фронтенда.

Обратная к services/graph_import.save_map_graph: читает БД и отдаёт структуру
в том же виде, в котором фронтенд сохраняет граф (локальные id = внешние ключи
/external_key), чтобы её можно было «загрузить» в подсистему рисования.
"""
from __future__ import annotations

from core.models import Facility, LicenceArea, NetworkNode, NetworkSegment, Pipeline, Project


def _local_id(record) -> str:
    """Локальный id записи: external_key, если есть, иначе UUID."""
    return record.external_key or str(record.id)


def build_project_snapshot(project: Project) -> dict:
    """Снимок проекта: объекты, узлы, сегменты, трубопроводы, участки."""
    facilities = list(Facility.objects.filter(project=project).order_by("name"))
    nodes = list(
        NetworkNode.objects.filter(project=project).select_related("facility").order_by("name")
    )
    segments = list(
        NetworkSegment.objects.filter(project=project)
        .select_related("start_node", "end_node")
        .order_by("name")
    )
    pipelines = list(
        Pipeline.objects.filter(project=project).prefetch_related("pipeline_segments").order_by("name")
    )
    areas = list(LicenceArea.objects.filter(project=project).order_by("name"))

    return {
        "project": {"id": str(project.id), "name": project.name, "slug": project.slug},
        "facilities": [
            {
                "id": _local_id(f),
                "name": f.name,
                "kind": f.kind,
                "lat": f.lat,
                "lng": f.lng,
                "width_m": f.width_m,
                "height_m": f.height_m,
                "angle_deg": f.angle_deg,
                "status": f.status,
                "license_area": f.license_area,
                "owner": f.owner,
                "attributes": f.attributes,
            }
            for f in facilities
        ],
        "nodes": [
            {
                "id": _local_id(n),
                "name": n.name,
                "kind": n.kind,
                "lat": n.lat,
                "lng": n.lng,
                "facility_id": _local_id(n.facility) if n.facility_id else None,
                # Привязка врезки к ребру и подключённые к ней/тройнику вершины.
                "tap_edge_id": n.tap_edge_external,
                "tap_t": n.tap_t,
                "bound_tap_id": n.bound_tap_external,
                "bound_fitting_id": n.bound_fitting_external,
            }
            for n in nodes
        ],
        "segments": [
            {
                "id": _local_id(s),
                "name": s.name,
                "start_node_id": _local_id(s.start_node),
                "end_node_id": _local_id(s.end_node),
                "fluid": s.fluid,
                "pipeline_class": s.pipeline_class,
                "length_m": s.length_m,
                "diameter_mm": s.diameter_mm,
                "wall_thickness_mm": s.wall_thickness_mm,
                "burial_depth_m": s.burial_depth_m,
            }
            for s in segments
        ],
        "pipelines": [
            {
                "id": _local_id(p),
                "name": p.name,
                "fluid": p.fluid,
                "pipeline_class": p.pipeline_class,
                "segment_ids": [
                    _local_id(row.segment)
                    for row in p.pipeline_segments.all().order_by("position")
                ],
            }
            for p in pipelines
        ],
        "licence_areas": [
            {"id": _local_id(a), "name": a.name, "polygon": a.polygon} for a in areas
        ],
        "counts": {
            "facilities": len(facilities),
            "nodes": len(nodes),
            "segments": len(segments),
            "pipelines": len(pipelines),
            "licence_areas": len(areas),
        },
    }
