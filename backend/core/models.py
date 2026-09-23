from __future__ import annotations

import uuid

from django.db import models


class TimestampedModel(models.Model):
    """Абстрактная база: временные метки создания/обновления."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ExternalUidModel(models.Model):
    """
    Абстрактная база: сквозной внешний идентификатор сущности (`uid`).

    `uid` генерируется КЛИЕНТОМ (фронтендом) при создании объекта и НЕ меняется
    за всё время жизни сущности — в отличие от PK, который пересоздаётся при
    сохранении снимка. Благодаря этому domain layer, backend и модули системы
    (расчёты, аналитика, экспорт) говорят об ОДНОМ объекте по одному ключу:
    можно взять данные из БД и знать, что uid совпадает с тем, что на карте.

    uid не является PK и не показывается пользователю. Уникален в пределах
    проекта (см. UniqueConstraint у конкретных моделей).
    """

    uid = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        abstract = True


class Project(TimestampedModel):
    """
    Проект (регион/сценарий расчёта). Верхняя сущность дерева объектов.

    storage_crs всегда EPSG:4326 — в базе хранятся WGS-84 lat/lng.
    source_crs фиксирует CRS импортированных данных (если отличался).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, default="Новый проект")
    slug = models.SlugField(max_length=120, unique=True, default="default")
    description = models.TextField(blank=True, default="")
    storage_crs = models.CharField(max_length=40, default="EPSG:4326")
    source_crs = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class FacilityKind(models.TextChoices):
    """Категория площадного/точечного объекта (совпадает с фронтендом)."""

    WELLPAD = "wellpad", "Кустовая площадка"
    FACILITY = "facility", "Объект подготовки"
    DELIVERY_POINT = "delivery-point", "Точка поставки"


class FluidType(models.TextChoices):
    OIL = "oil", "Нефть"
    GAS = "gas", "Газ"
    WATER = "water", "Вода"
    PRODUCT = "product", "Продукт"

class PipelineClass(models.TextChoices):
    # Класс трубопровода — определяет стиль линии (толщина/штрих) на карте.
    # Ортогонален флюиду: цвет ребра задаётся флюидом, а толщина/штрих — классом.
    # Соответствует панели «Класс трубопровода» в интерфейсе проектирования.

    FIELD = "field", "Промысловый"
    INTERFIELD = "interfield", "Межпромысловый"
    TRUNK = "trunk", "Магистральный"
    LOGICAL = "logical", "Логический поток"


class StatusChoices(models.TextChoices):
    RUNNING = "running", "Работает"
    WARNING = "warning", "Предупреждение"
    STOPPED = "stopped", "Остановлен"


class Facility(TimestampedModel, ExternalUidModel):
    """
    Объект на карте: куст / объект подготовки / точка поставки.

    Геометрия: центр (lat/lng) + габариты в метрах (width_m/height_m) и угол.
    Такой набор позволяет рисовать прямоугольник в масштабе карты (как фронтенд)
    и не требует PostGIS.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="facilities")
    external_key = models.CharField(max_length=255, null=True, blank=True)
    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=32, choices=FacilityKind.choices)
    lat = models.FloatField()
    lng = models.FloatField()
    width_m = models.FloatField(default=140.0)
    height_m = models.FloatField(default=100.0)
    angle_deg = models.FloatField(default=0.0)
    status = models.CharField(max_length=32, choices=StatusChoices.choices, default=StatusChoices.RUNNING)
    license_area = models.CharField(max_length=255, blank=True, default="")
    owner = models.CharField(max_length=255, blank=True, default="")
    attributes = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "external_key"],
                condition=models.Q(external_key__isnull=False),
                name="uq_facility_project_external",
            ),
            models.UniqueConstraint(
                fields=["project", "uid"],
                condition=models.Q(uid__isnull=False),
                name="uq_facility_project_uid",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class NetworkNode(TimestampedModel, ExternalUidModel):
    """
    Точка сети (начало/конец сегментов, тройник, врезка).

    kind позволяет отличить тройник/врезку от обычного узла рёбер, как на фронтенде.
    """

    NODE_KINDS = [
        ("vertex", "Вершина ребра"),
        ("tee", "Тройник"),
        ("tap", "Врезка"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="nodes")
    facility = models.ForeignKey(
        Facility, on_delete=models.SET_NULL, null=True, blank=True, related_name="nodes"
    )
    external_key = models.CharField(max_length=255, null=True, blank=True)
    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=16, choices=NODE_KINDS, default="vertex")
    lat = models.FloatField()
    lng = models.FloatField()

    # --- Связи для врезок и подключённых к ним/тройникам вершин ребёр ---
    # Врезка (kind='tap'): на каком ребре лежит и где именно (t ∈ [0..1]).
    # Хранится внешним ключом (external_key сегмента) — как и прочие id графа.
    tap_edge_external = models.CharField(max_length=255, null=True, blank=True)
    tap_t = models.FloatField(null=True, blank=True)
    # Вершина ребра, подключённая К врезке/тройнику: внешний ключ целевого узла.
    bound_tap_external = models.CharField(max_length=255, null=True, blank=True)
    bound_fitting_external = models.CharField(max_length=255, null=True, blank=True)

    attributes = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "external_key"],
                condition=models.Q(external_key__isnull=False),
                name="uq_node_project_external",
            ),
            models.UniqueConstraint(
                fields=["project", "uid"],
                condition=models.Q(uid__isnull=False),
                name="uq_node_project_uid",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class NetworkSegment(TimestampedModel, ExternalUidModel):
    """Ребро сети (сегмент трубопровода): от узла к узлу."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="segments")
    external_key = models.CharField(max_length=255, null=True, blank=True)
    name = models.CharField(max_length=255)
    start_node = models.ForeignKey(
        NetworkNode, on_delete=models.CASCADE, related_name="outgoing_segments"
    )
    end_node = models.ForeignKey(
        NetworkNode, on_delete=models.CASCADE, related_name="incoming_segments"
    )
    fluid = models.CharField(max_length=8, choices=FluidType.choices, default=FluidType.OIL)
    # Класс трубопровода: промысловый/межпромысловый/магистральный/логический.
    pipeline_class = models.CharField(
        max_length=16, choices=PipelineClass.choices, default=PipelineClass.FIELD
    )
    length_m = models.FloatField(null=True, blank=True)
    diameter_mm = models.FloatField(null=True, blank=True)
    wall_thickness_mm = models.FloatField(null=True, blank=True)
    roughness_mm = models.FloatField(null=True, blank=True)
    burial_depth_m = models.FloatField(null=True, blank=True)
    attributes = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "external_key"],
                condition=models.Q(external_key__isnull=False),
                name="uq_segment_project_external",
            ),
            models.UniqueConstraint(
                fields=["project", "uid"],
                condition=models.Q(uid__isnull=False),
                name="uq_segment_project_uid",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Pipeline(TimestampedModel, ExternalUidModel):
    """
    Логический трубопровод — упорядоченная цепочка сегментов.

    На фронтенде «объединить в трубопровод» создаёт именно эту сущность
    (pipelineId у сегментов).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="pipelines")
    external_key = models.CharField(max_length=255, null=True, blank=True)
    name = models.CharField(max_length=255)
    fluid = models.CharField(max_length=8, choices=FluidType.choices, default=FluidType.OIL)
    pipeline_class = models.CharField(
        max_length=16, choices=PipelineClass.choices, default=PipelineClass.FIELD
    )
    attributes = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "external_key"],
                condition=models.Q(external_key__isnull=False),
                name="uq_pipeline_project_external",
            ),
            models.UniqueConstraint(
                fields=["project", "uid"],
                condition=models.Q(uid__isnull=False),
                name="uq_pipeline_project_uid",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class PipelineSegment(models.Model):
    """Позиция сегмента внутри логического трубопровода."""

    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name="pipeline_segments")
    segment = models.ForeignKey(NetworkSegment, on_delete=models.CASCADE, related_name="pipeline_memberships")
    position = models.PositiveIntegerField()

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["pipeline", "position"], name="uq_pipeline_position"),
            models.UniqueConstraint(fields=["pipeline", "segment"], name="uq_pipeline_segment"),
        ]


class LicenceArea(TimestampedModel, ExternalUidModel):
    """
    Лицензионный участок — замкнутый полигон территории.

    Полигон хранится как JSON-массив пар [lng, lat] (WGS-84, минимум 3 точки) —
    без PostGIS, как и остальные геометрии в проекте.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="licence_areas")
    external_key = models.CharField(max_length=255, null=True, blank=True)
    name = models.CharField(max_length=255)
    polygon = models.JSONField(default=list, blank=True)
    attributes = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "external_key"],
                condition=models.Q(external_key__isnull=False),
                name="uq_area_project_external",
            ),
            models.UniqueConstraint(
                fields=["project", "uid"],
                condition=models.Q(uid__isnull=False),
                name="uq_area_project_uid",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Flow(TimestampedModel):
    """
    Логический поток между объектами (передача флюида).

    is_logical_flow = True означает передачу флюида БЕЗ физической трубы —
    фронтенд показывает для этого бейдж в инспекторе.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="flows")
    source = models.ForeignKey(
        Facility, on_delete=models.CASCADE, related_name="outgoing_flows", null=True, blank=True
    )
    target = models.ForeignKey(
        Facility, on_delete=models.CASCADE, related_name="incoming_flows", null=True, blank=True
    )
    flow_type = models.CharField(max_length=120, default="Нефтепровод")
    fluid = models.CharField(max_length=8, choices=FluidType.choices, blank=True, default="")
    is_logical_flow = models.BooleanField(default=False)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.source_id} → {self.target_id}"


class ValidationItem(models.Model):
    """Элемент проверки состояния модели (чекмарки в инспекторе)."""

    entity = models.ForeignKey(Facility, on_delete=models.CASCADE, related_name="validation_items")
    label = models.CharField(max_length=255)
    value = models.CharField(max_length=255)
    ok = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position"]


class CalculationRun(TimestampedModel):
    """Запуск расчёта (ГР / гидравлика) — статус и прогресс."""

    STATUSES = [
        ("queued", "В очереди"),
        ("running", "Выполняется"),
        ("success", "Успешно"),
        ("failed", "Ошибка"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="calculation_runs")
    status = models.CharField(max_length=16, choices=STATUSES, default="queued")
    progress = models.PositiveSmallIntegerField(default=0)
    stage = models.CharField(max_length=80, blank=True, default="queued")
    current_year = models.IntegerField(null=True, blank=True)
    message = models.TextField(blank=True, default="")
    result_summary = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]


class GRResult(models.Model):
    """
    Результат геолого-разведочного/ресурсного расчёта по объекту и году.

    Название «GR» соответствует чекмарку «Результаты ГР» в инспекторе.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(CalculationRun, on_delete=models.CASCADE, related_name="gr_results")
    entity = models.ForeignKey(Facility, on_delete=models.CASCADE, related_name="gr_results", null=True, blank=True)
    year = models.IntegerField()
    data = models.JSONField(default=dict)

    class Meta:
        ordering = ["year", "entity_id"]
