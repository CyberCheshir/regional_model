from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_external_uid"),
    ]

    operations = [
        migrations.AddField(
            model_name="networknode",
            name="node_type",
            field=models.CharField(
                choices=[("tap", "Врезка"), ("joint", "Стык трубопровода"), ("tee", "Тройник")],
                default="joint",
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="networknode",
            name="kind",
            field=models.CharField(
                choices=[
                    ("joint", "Стык трубопровода"),
                    ("vertex", "Стык трубопровода"),
                    ("tee", "Тройник"),
                    ("tap", "Врезка"),
                ],
                default="joint",
                max_length=16,
            ),
        ),
    ]
