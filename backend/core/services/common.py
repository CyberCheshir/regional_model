from __future__ import annotations

import math

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404

from core.models import Facility, Project

EARTH_RADIUS_M = 6_371_000.0


def get_default_project() -> Project:
    """Проект по умолчанию: первый существующий или созданный «default»."""
    project = Project.objects.order_by("name").first()
    if project is None:
        project = Project.objects.create(name="Региональный модуль", slug="default")
    return project


def get_project_or_default(project_id) -> Project:
    return get_object_or_404(Project, id=project_id) if project_id else get_default_project()


def resolve_project_for_save(project_id, project_name) -> Project:
    # Выбрать проект для сохранения:
    #   1) по project_id (обновление существующего сценария);
    #   2) иначе по имени (project_name) — найти существующий или создать новый;
    #   3) иначе — проект по умолчанию.
    # Имя, если передано, обновляется (переименование сценария).
    name = (project_name or "").strip()
    if project_id:
        project = get_object_or_404(Project, id=project_id)
        if name and project.name != name:
            project.name = name
            project.save(update_fields=["name", "updated_at"])
        return project
    if name:
        project = Project.objects.filter(name=name).first()
        if project is not None:
            return project
        # slug должен быть уникален: берём из счётчика.
        slug = f"scenario-{Project.objects.count() + 1}"
        return Project.objects.create(name=name, slug=slug)
    return get_default_project()


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Расстояние между двумя WGS-84 точками в метрах (формула гаверсинуса)."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def facility_anchor_from_click(
    lat: float, lng: float, width_m: float, height_m: float, angle_deg: float,
    click_lat: float, click_lng: float,
) -> tuple[str, float, float, float]:
    """
    Точка на границе прямоугольного объекта, ближайшая к клику.

    Возвращает (side, offset, lat, lng): сторона ('n'|'s'|'e'|'w'), доля вдоль
    стороны [0..1] и координаты полученной точки границы.
    Упрощённая геометрия без PostGIS — прямоугольник в локальной метрике.
    """
    # Локальные метры относительно центра объекта (приближение для малых областей).
    meters_per_deg_lat = 111_132.92
    meters_per_deg_lng = 111_320.0 * math.cos(math.radians(lat))
    dx_click = (click_lng - lng) * meters_per_deg_lng
    dy_click = (click_lat - lat) * meters_per_deg_lat

    half_w, half_h = width_m / 2, height_m / 2
    # Ближайшая сторона по относительному превышению.
    if abs(dx_click) / max(half_w, 1e-6) >= abs(dy_click) / max(half_h, 1e-6):
        side = "e" if dx_click >= 0 else "w"
        x = half_w if side == "e" else -half_w
        y = max(-half_h, min(half_h, dy_click))
        offset = (y + half_h) / (height_m or 1.0)
    else:
        side = "n" if dy_click >= 0 else "s"
        y = half_h if side == "n" else -half_h
        x = max(-half_w, min(half_w, dx_click))
        offset = (x + half_w) / (width_m or 1.0)

    out_lat = lat + y / meters_per_deg_lat
    out_lng = lng + x / meters_per_deg_lng
    return side, round(offset, 4), out_lat, out_lng


def facilities_queryset(project: Project) -> QuerySet[Facility]:
    return Facility.objects.filter(project=project).order_by("name")
