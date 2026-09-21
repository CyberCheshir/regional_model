from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    FacilityViewSet,
    FlowViewSet,
    LicenceAreaViewSet,
    NetworkNodeViewSet,
    NetworkSegmentViewSet,
    PipelineViewSet,
    ProjectViewSet,
    calculation_results,
    calculation_start,
    calculation_status,
    entity_details,
    health,
    map_graph,
    map_load,
    map_save,
)

router = DefaultRouter()
router.register("projects", ProjectViewSet)
router.register("facilities", FacilityViewSet)
router.register("nodes", NetworkNodeViewSet)
router.register("segments", NetworkSegmentViewSet)
router.register("pipelines", PipelineViewSet)
router.register("licence-areas", LicenceAreaViewSet)
router.register("flows", FlowViewSet)

urlpatterns = [
    # Служебное
    path("health/", health),
    # Контракты фронтенда
    path("map/graph/", map_graph),
    path("map/save/", map_save),
    path("map/load/", map_load),
    path("entities/<uuid:entity_id>/", entity_details),
    # Расчёты
    path("calculations/start/", calculation_start),
    path("calculations/<uuid:run_id>/", calculation_status),
    path("calculations/<uuid:run_id>/results/", calculation_results),
    # CRUD сущностей
    path("", include(router.urls)),
]
