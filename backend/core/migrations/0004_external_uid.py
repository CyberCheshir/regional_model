# Сквозной внешний идентификатор сущностей (`uid`) для объектов, узлов,
# сегментов, трубопроводов и лицензионных участков.
#
# `uid` генерируется КЛИЕНТОМ при создании объекта и не меняется за время
# жизни сущности. Это позволяет domain layer, backend и расчётным модулям
# ссылаться на ОДИН и тот же объект по общему ключу — независимо от PK,
# который пересоздаётся при сохранении снимка.
#
# Поле необязательное (null) — старые данные и старые снимки остаются валидны.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_pipeline_class_and_product_fluid"),
    ]

    operations = [
        # --- Поля uid ---
        migrations.AddField(
            model_name="facility",
            name="uid",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="networknode",
            name="uid",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="networksegment",
            name="uid",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="pipeline",
            name="uid",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="licencearea",
            name="uid",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        # --- Ограничения уникальности uid в пределах проекта ---
        migrations.AddConstraint(
            model_name="facility",
            constraint=models.UniqueConstraint(
                fields=("project", "uid"),
                condition=models.Q(("uid__isnull", False)),
                name="uq_facility_project_uid",
            ),
        ),
        migrations.AddConstraint(
            model_name="networknode",
            constraint=models.UniqueConstraint(
                fields=("project", "uid"),
                condition=models.Q(("uid__isnull", False)),
                name="uq_node_project_uid",
            ),
        ),
        migrations.AddConstraint(
            model_name="networksegment",
            constraint=models.UniqueConstraint(
                fields=("project", "uid"),
                condition=models.Q(("uid__isnull", False)),
                name="uq_segment_project_uid",
            ),
        ),
        migrations.AddConstraint(
            model_name="pipeline",
            constraint=models.UniqueConstraint(
                fields=("project", "uid"),
                condition=models.Q(("uid__isnull", False)),
                name="uq_pipeline_project_uid",
            ),
        ),
        migrations.AddConstraint(
            model_name="licencearea",
            constraint=models.UniqueConstraint(
                fields=("project", "uid"),
                condition=models.Q(("uid__isnull", False)),
                name="uq_area_project_uid",
            ),
        ),
    ]
