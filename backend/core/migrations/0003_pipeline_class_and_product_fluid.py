# Класс трубопровода (field|interfield|trunk|logical) у сегментов и трубопроводов,
# плюс новый вариант флюида «Продукт» (product) в выборе FluidType.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_networknode_bound_fitting_external_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="networksegment",
            name="pipeline_class",
            field=models.CharField(
                choices=[
                    ("field", "Промысловый"),
                    ("interfield", "Межпромысловый"),
                    ("trunk", "Магистральный"),
                    ("logical", "Логический поток"),
                ],
                default="field",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="pipeline",
            name="pipeline_class",
            field=models.CharField(
                choices=[
                    ("field", "Промысловый"),
                    ("interfield", "Межпромысловый"),
                    ("trunk", "Магистральный"),
                    ("logical", "Логический поток"),
                ],
                default="field",
                max_length=16,
            ),
        ),
        migrations.AlterField(
            model_name="networksegment",
            name="fluid",
            field=models.CharField(
                choices=[
                    ("oil", "Нефть"),
                    ("gas", "Газ"),
                    ("water", "Вода"),
                    ("product", "Продукт"),
                ],
                default="oil",
                max_length=8,
            ),
        ),
        migrations.AlterField(
            model_name="pipeline",
            name="fluid",
            field=models.CharField(
                choices=[
                    ("oil", "Нефть"),
                    ("gas", "Газ"),
                    ("water", "Вода"),
                    ("product", "Продукт"),
                ],
                default="oil",
                max_length=8,
            ),
        ),
    ]
