from __future__ import annotations

from core.models import Facility, Flow, LicenceArea, Pipeline, Project, ValidationItem

# Соответствие доменного kind → kind дерева фронтенда (TreeNodeKindSchema).
TREE_KIND_BY_FACILITY = {
    "wellpad": "wellpad",
    "facility": "facility",
    "delivery-point": "delivery-point",
}


def _flow_link(flow: Flow, target: Facility) -> dict:
    return {
        "id": str(flow.id),
        "targetId": str(target.id),
        "targetLabel": target.name,
        "targetKind": TREE_KIND_BY_FACILITY.get(target.kind, "facility"),
        "flowType": flow.flow_type,
        "isLogicalFlow": flow.is_logical_flow,
        **({"fluid": flow.fluid} if flow.fluid else {}),
    }


def build_entity_details(entity_id) -> dict | None:
    """
    Карточка объекта для инспектора (EntityDetailsSchema фронтенда).

    Ищет сущность среди объектов (Facility) и трубопроводов (Pipeline).
    Возвращает None, если ничего не найдено — вьюха отдаст 404.
    """
    facility = Facility.objects.filter(id=entity_id).first()
    if facility is not None:
        return _facility_details(facility)

    pipeline = Pipeline.objects.filter(id=entity_id).first()
    if pipeline is not None:
        return _pipeline_details(pipeline)

    return None


def _facility_details(facility: Facility) -> dict:
    validation = list(facility.validation_items.order_by("position"))
    if not validation:
        # Базовый набор чекмарков по умолчанию (как в макете инспектора).
        validation = [
            ValidationItem(label="Система сбора", value="не настроена", ok=False, position=0),
            ValidationItem(label="Профиль добычи", value="не задан", ok=False, position=1),
            ValidationItem(label="Результаты ГР", value="отсутствуют", ok=False, position=2),
        ]

    outgoing = [
        _flow_link(flow, flow.target)
        for flow in facility.outgoing_flows.select_related("target")
        if flow.target is not None
    ]
    incoming = [
        _flow_link(flow, flow.source)
        for flow in facility.incoming_flows.select_related("source")
        if flow.source is not None
    ]

    return {
        "id": str(facility.id),
        "label": facility.name,
        "kind": TREE_KIND_BY_FACILITY.get(facility.kind, "facility"),
        "subType": dict(Facility._meta.get_field("kind").choices).get(facility.kind, ""),
        "status": facility.status,
        "licenseArea": facility.license_area or "—",
        "owner": facility.owner or "—",
        "modelStatus": [
            {"label": item.label, "value": item.value, "ok": item.ok} for item in validation
        ],
        "outgoing": outgoing,
        "incoming": incoming,
    }


def _pipeline_details(pipeline: Pipeline) -> dict:
    segments = list(pipeline.pipeline_segments.select_related("segment").order_by("position"))
    return {
        "id": str(pipeline.id),
        "label": pipeline.name,
        "kind": "pipeline",
        "subType": f"{len(segments)} сегментов",
        "status": "running",
        "licenseArea": pipeline.attributes.get("licenseArea", "—")
        if isinstance(pipeline.attributes, dict)
        else "—",
        "owner": pipeline.attributes.get("owner", "—")
        if isinstance(pipeline.attributes, dict)
        else "—",
        "modelStatus": [
            {"label": "Топология", "value": f"{len(segments)} сегментов", "ok": len(segments) > 0}
        ],
        "outgoing": [],
        "incoming": [],
    }


def licence_areas_payload(project: Project) -> list[dict]:
    """Лицензионные участки проекта в формате фронтенда (polygon: [[lng,lat],...])."""
    areas = LicenceArea.objects.filter(project=project).order_by("name")
    return [
        {
            "id": str(a.id),
            "label": a.name,
            "polygon": a.polygon,
        }
        for a in areas
    ]
