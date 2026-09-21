from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Facility, LicenceArea, NetworkNode, NetworkSegment, Pipeline, Project
from core.serializers import MapGraphSerializer


class HealthTests(TestCase):
    def test_health_ok(self):
        response = APIClient().get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "regional-model"})


class MapGraphContractTests(TestCase):
    """Контракт /api/map/graph/ должен совпадать с MapGraphSchema фронтенда."""

    def setUp(self):
        self.project = Project.objects.create(name="Тест", slug="test")
        self.wellpad = Facility.objects.create(
            project=self.project, name="Куст 1", kind="wellpad",
            lat=61.115171, lng=76.749737, width_m=140, height_m=100,
        )
        self.facility = Facility.objects.create(
            project=self.project, name="УПН 1", kind="facility",
            lat=61.12, lng=76.76,
        )
        self.node_a = NetworkNode.objects.create(
            project=self.project, facility=self.wellpad, name="Узел A", lat=61.115171, lng=76.749737,
        )
        self.node_b = NetworkNode.objects.create(
            project=self.project, facility=self.facility, name="Узел B", lat=61.12, lng=76.76,
        )
        NetworkSegment.objects.create(
            project=self.project, name="Сегмент 1",
            start_node=self.node_a, end_node=self.node_b, fluid="oil",
        )

    def test_map_graph_returns_nodes_and_edges(self):
        response = APIClient().get("/api/map/graph/", {"project_id": str(self.project.id)})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("nodes", payload)
        self.assertIn("edges", payload)

        node = next(n for n in payload["nodes"] if n["label"] == "Куст 1")
        self.assertEqual(node["kind"], "wellpad")
        self.assertEqual(node["entityId"], str(self.wellpad.id))
        self.assertEqual(node["id"], str(self.wellpad.id))

        edge = payload["edges"][0]
        self.assertEqual(
            set(edge.keys()),
            {"id", "from", "to", "fluid", "pipelineClass", "flowLabel"},
        )
        self.assertEqual(edge["pipelineClass"], "field")
        self.assertEqual(edge["from"], str(self.wellpad.id))
        self.assertEqual(edge["to"], str(self.facility.id))
        self.assertEqual(edge["fluid"], "oil")

    def test_map_graph_serializer_schema_keys(self):
        payload = {
            "nodes": [{"id": "1", "label": "A", "kind": "wellpad", "entityId": "1"}],
            "edges": [
                {
                    "id": "e1",
                    "from": "1",
                    "to": "2",
                    "fluid": "oil",
                    "pipelineClass": "field",
                    "flowLabel": "—",
                }
            ],
        }
        data = MapGraphSerializer(payload).data
        self.assertEqual(data["nodes"][0]["kind"], "wellpad")
        self.assertEqual(data["edges"][0]["from"], "1")
        self.assertEqual(data["edges"][0]["pipelineClass"], "field")


class EntityDetailsContractTests(TestCase):
    def setUp(self):
        self.project = Project.objects.create(name="Тест", slug="test-2")
        self.facility = Facility.objects.create(
            project=self.project, name="Куст Северный", kind="wellpad",
            lat=61.115171, lng=76.749737, license_area="ВС-1", owner="О «Недра»",
        )

    def test_entity_details_contract(self):
        response = APIClient().get(f"/api/entities/{self.facility.id}/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        for key in [
            "id", "label", "kind", "status", "licenseArea", "owner",
            "modelStatus", "outgoing", "incoming",
        ]:
            self.assertIn(key, data)
        self.assertEqual(data["kind"], "wellpad")
        self.assertEqual(data["licenseArea"], "ВС-1")
        self.assertGreaterEqual(len(data["modelStatus"]), 3)

    def test_entity_details_404(self):
        response = APIClient().get("/api/entities/00000-0000-0000-0000-000/")
        self.assertEqual(response.status_code, 404)


class PipelineFromSegmentsTests(TestCase):
    def setUp(self):
        self.project = Project.objects.create(name="Тест", slug="test-3")
        self.nodes = [
            NetworkNode.objects.create(
                project=self.project, name=f"Узел {i}", lat=61.1 + i * 0.01, lng=76.7 + i * 0.01,
            )
            for i in range(3)
        ]
        self.segments = [
            NetworkSegment.objects.create(
                project=self.project, name=f"Сегмент {i}",
                start_node=self.nodes[i], end_node=self.nodes[i + 1], fluid="oil",
            )
            for i in range(2)
        ]

    def test_pipeline_from_segments(self):
        response = APIClient().post(
            "/api/pipelines/from-segments/",
            {
                "project_id": str(self.project.id),
                "name": "Трубопровод 1",
                "segment_ids": [str(s.id) for s in self.segments],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["name"], "Трубопровод 1")
        self.assertEqual(data["segments"], [str(s.id) for s in self.segments])
        self.assertEqual(Pipeline.objects.count(), 1)


class MapSaveTests(TestCase):
    # POST /api/map/save/ — сохранение нарисованного графа целиком.""

    def test_save_graph_snapshot(self):
        project = Project.objects.create(name="Тест", slug="test-save")
        payload = {
            "project_id": str(project.id),
            "facilities": [
                {"id": "f1", "name": "Куст 1", "kind": "wellpad", "lat": 61.11, "lng": 76.74},
                {"id": "f2", "name": "УПН 1", "kind": "facility", "lat": 61.14, "lng": 76.76},
            ],
            "nodes": [
                {"id": "n1", "name": "Узел 1", "kind": "vertex", "lat": 61.11, "lng": 76.74, "facility_id": "f1"},
                {"id": "n2", "name": "Узел 2", "kind": "vertex", "lat": 61.14, "lng": 76.76, "facility_id": "f2"},
                {"id": "n3", "name": "Тройник 1", "kind": "tee", "lat": 61.12, "lng": 76.75},
            ],
            "segments": [
                {"id": "s1", "name": "Сегмент 1", "start_node_id": "n1", "end_node_id": "n2", "fluid": "oil"},
                {"id": "s2", "name": "Сегмент 2", "start_node_id": "n2", "end_node_id": "n3", "fluid": "water"},
            ],
            "pipelines": [
                {"id": "p1", "name": "Трубопровод 1", "fluid": "oil", "segment_ids": ["s1", "s2"]},
            ],
            "licence_areas": [
                {"id": "a1", "name": "ЛУ 1", "polygon": [[76.7, 61.1], [76.8, 61.1], [76.8, 61.2]]},
            ],
        }
        response = APIClient().post("/api/map/save/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.json())
        counts = response.json()["counts"]
        self.assertEqual(counts["facilities"], 2)
        self.assertEqual(counts["nodes"], 3)
        self.assertEqual(counts["segments"], 2)
        self.assertEqual(counts["pipelines"], 1)
        self.assertEqual(counts["licence_areas"], 1)

        # Длина сегментов посчитана автоматически (haversine > 0).
        seg = NetworkSegment.objects.get(external_key="s1")
        self.assertIsNotNone(seg.length_m)
        self.assertGreater(seg.length_m, 0)

        # Повторное сохранение заменяет снимок, а не дублирует.
        APIClient().post("/api/map/save/", payload, format="json")
        self.assertEqual(Facility.objects.filter(project=project).count(), 2)
        self.assertEqual(NetworkSegment.objects.filter(project=project).count(), 2)
        self.assertEqual(LicenceArea.objects.filter(project=project).count(), 1)

    def test_save_by_name_and_load_snapshot(self):
        payload = {
            "project_name": "Сценарий А",
            "facilities": [
                {"id": "f1", "name": "Куст А", "kind": "wellpad", "lat": 61.11, "lng": 76.74},
            ],
            "nodes": [
                {"id": "n1", "name": "Узел 1", "kind": "vertex", "lat": 61.11, "lng": 76.74, "facility_id": "f1"},
                {"id": "n2", "name": "Узел 2", "kind": "vertex", "lat": 61.13, "lng": 76.77},
            ],
            "segments": [
                {"id": "s1", "name": "Сегмент 1", "start_node_id": "n1", "end_node_id": "n2", "fluid": "oil"},
            ],
            "pipelines": [],
            "licence_areas": [],
        }
        client = APIClient()
        saved = client.post("/api/map/save/", payload, format="json")
        self.assertEqual(saved.status_code, 201, saved.json())
        self.assertEqual(saved.json()["project_name"], "Сценарий А")

        # Проект появился в списке (для меню «Сценарии»).
        names = [p["name"] for p in client.get("/api/projects/").json()]
        self.assertIn("Сценарий А", names)

        # Загрузка снимка по имени возвращает те же сущности.
        loaded = client.get("/api/map/load/", {"project_name": "Сценарий А"})
        self.assertEqual(loaded.status_code, 200)
        data = loaded.json()
        self.assertEqual(len(data["facilities"]), 1)
        self.assertEqual(data["facilities"][0]["name"], "Куст А")
        self.assertEqual(len(data["segments"]), 1)
        self.assertEqual(data["segments"][0]["fluid"], "oil")
        self.assertEqual(data["counts"]["nodes"], 2)

    def test_load_unknown_name_returns_404(self):
        response = APIClient().get("/api/map/load/", {"project_name": "Нет такого"})
        self.assertEqual(response.status_code, 404)

    def test_save_dedupes_duplicate_ids(self):
        # Дубли записей с одним id не должны ломать сохранение (unique-constraint).
        project = Project.objects.create(name="Тест", slug="test-dedupe")
        payload = {
            "project_id": str(project.id),
            "facilities": [
                {"id": "f1", "name": "Куст 1", "kind": "wellpad", "lat": 61.11, "lng": 76.74},
                {"id": "f1", "name": "Куст 1 дубль", "kind": "wellpad", "lat": 61.11, "lng": 76.74},
            ],
            "nodes": [{"id": "n1", "name": "Узел", "lat": 61.11, "lng": 76.74}],
            "segments": [
                {"id": "s1", "name": "S", "start_node_id": "n1", "end_node_id": "n1x", "fluid": "oil"},
            ],
            "pipelines": [],
            "licence_areas": [],
        }
        # Дубль узла — второй конец ссылается на существующий узел.
        payload["nodes"].append({"id": "n1x", "name": "Узел 2", "lat": 61.12, "lng": 76.75})
        response = APIClient().post("/api/map/save/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(response.json()["counts"]["facilities"], 1)
        self.assertEqual(Facility.objects.filter(project=project).count(), 1)

    def test_save_persists_pipeline_class(self):
        # Класс трубопровода (стиль линии) сохраняется у сегмента и трубопровода
        # и возвращается в снимке (для загрузки в domain layer).
        project = Project.objects.create(name="Тест ПК", slug="test-pclass")
        payload = {
            "project_id": str(project.id),
            "facilities": [],
            "nodes": [
                {"id": "n1", "name": "Узел 1", "kind": "vertex", "lat": 61.1, "lng": 76.7},
                {"id": "n2", "name": "Узел 2", "kind": "vertex", "lat": 61.2, "lng": 76.8},
            ],
            "segments": [
                {
                    "id": "s1",
                    "name": "Сегмент 1",
                    "start_node_id": "n1",
                    "end_node_id": "n2",
                    "fluid": "product",
                    "pipeline_class": "trunk",
                }
            ],
            "pipelines": [
                {
                    "id": "p1",
                    "name": "Магистраль",
                    "fluid": "product",
                    "pipeline_class": "trunk",
                    "segment_ids": ["s1"],
                }
            ],
            "licence_areas": [],
        }
        client = APIClient()
        saved = client.post("/api/map/save/", payload, format="json")
        self.assertEqual(saved.status_code, 201, saved.json())

        snap = client.get("/api/map/load/", {"project_id": str(project.id)}).json()
        self.assertEqual(snap["segments"][0]["pipeline_class"], "trunk")
        self.assertEqual(snap["segments"][0]["fluid"], "product")
        self.assertEqual(snap["pipelines"][0]["pipeline_class"], "trunk")

    def test_save_rejects_bad_segment_reference(self):
        project = Project.objects.create(name="Тест", slug="test-save-2")
        payload = {
            "project_id": str(project.id),
            "facilities": [],
            "nodes": [{"id": "n1", "name": "Узел", "lat": 61.1, "lng": 76.7}],
            "segments": [
                {"id": "s1", "name": "S", "start_node_id": "n1", "end_node_id": "missing", "fluid": "oil"}
            ],
            "pipelines": [],
            "licence_areas": [],
        }
        response = APIClient().post("/api/map/save/", payload, format="json")
        self.assertEqual(response.status_code, 400)

class LicenceAreaTests(TestCase):
    def test_polygon_requires_three_points(self):
        project = Project.objects.create(name="Тест", slug="test-4")
        client = APIClient()
        bad = client.post(
            "/api/licence-areas/",
            {"project_id": str(project.id), "name": "Участок", "polygon": [[76.7, 61.1], [76.8, 61.2]]},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)

        good = client.post(
            "/api/licence-areas/",
            {
                "project_id": str(project.id),
                "name": "Участок",
                "polygon": [[76.7, 61.1], [76.8, 61.1], [76.8, 61.2]],
            },
            format="json",
        )
        self.assertEqual(good.status_code, 201, good.json())
        self.assertEqual(LicenceArea.objects.count(), 1)
