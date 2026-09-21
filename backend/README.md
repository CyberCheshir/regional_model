# Backend — региональная модель (Django)

Backend построен по образцу проекта **«Пример проекта»** (`Пример проекта/backend`):
Django 5 + Django REST Framework + PostgreSQL (без PostGIS), координаты хранятся
явно как WGS-84 `lat` / `lng`.

## Что уже реализовано

| Метод | URL | Назначение |
|---|---|---|
| GET | `/api/health/` | Проверка живости (`{"status":"ok","service":"regional-model"}`) |
| GET | `/api/map/graph/` | Граф карты в контракте фронтенда: `{ nodes, edges }` |
| GET | `/api/entities/<uuid>/` | Карточка объекта/трубопровода для инспектора |
| POST | `/api/calculations/start/` | Создать запуск расчёта (`CalculationRun`) |
| GET | `/api/calculations/<uuid>/` | Статус/прогресс расчёта |
| GET | `/api/calculations/<uuid>/results/` | Результаты ГР по годам |
| CRUD | `/api/projects/`, `/api/facilities/`, `/api/nodes/`, `/api/segments/`, `/api/pipelines/`, `/api/licence-areas/`, `/api/flows/` | Сущности модели |
| POST | `/api/facilities/<uuid>/nodes/` | Узел, привязанный к объекту (клик по карте) |
| POST | `/api/pipelines/from-segments/` | Объединить сегменты в трубопровод |
| POST | `/api/map/save/` | **Сохранить граф целиком** (снимок проекта). Имя проекта — `project_name` (создаётся/переиспользуется) или `project_id` |
| GET | `/api/map/load/` | **Загрузить снимок проекта** для domain layer: `?project_id=` или `?project_name=` |

### Контракты фронтенда
Ответы `/api/map/graph/` и `/api/entities/<id>/` **точно совпадают** с zod-схемами
фронтенда (`frontend/src/domain/schemas.ts`: `MapGraphSchema`, `EntityDetailsSchema`).
Это проверяется тестами (`core/tests.py`).

## Модель данных

```text
Project
 ├─ Facility (wellpad | facility | delivery-point)  # объекты карты
 │   ├─ NetworkNode (vertex | tee | tap)            # узлы/тройники/врезки
 │   ├─ ValidationItem                              # чекмарки инспектора
 │   └─ GRResult                                    # результаты ГР по годам
 ├─ NetworkSegment → NetworkNode (start/end)        # рёбра (сегменты)
 ├─ Pipeline → PipelineSegment → NetworkSegment     # логические трубопроводы
 ├─ LicenceArea (polygon: [[lng,lat],...])          # лицензионные участки
 ├─ Flow (source/target, is_logical_flow)           # логические потоки
 └─ CalculationRun → GRResult                       # запуски расчётов
```

## Запуск (Docker) — ПРОВЕРЕНО
```powershell
cd backend
Copy-Item .env.example .env
# задайте DJANGO_SECRET_KEY и POSTGRES_PASSWORD в .env
docker compose up -d --build
```

Проверка:

```powershell
docker compose ps                 # db = healthy, backend = up
docker compose logs backend       # видно применение миграций
curl http://localhost:8000/api/health/
# {"status":"ok","service":"regional-model"}
```

Тесты на PostgreSQL:

```powershell
docker compose exec backend python manage.py test
# Ran 7 tests ... OK
```

> Факт проверки в этой среде: Docker Engine 29.6.2 (linux), Compose v5.4.0;
> миграции применены (`Applying core.0001_initial... OK`), 7 тестов — OK,
> `POST /api/facilities/` записывает объект и он виден в `/api/map/graph/`.

### Важно про кириллицу
При проверке API из PowerShell отправляйте тело в UTF-8 явно, иначе русские
имена испортятся (`????` — это артефакт клиента, не backend):

```powershell
$body = @{ name = "Куст Северный"; kind = "wellpad"; lat = 61.13; lng = 76.77 } | ConvertTo-Json
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
Invoke-RestMethod -Uri http://localhost:8000/api/facilities/ -Method Post `
  -Body $bytes -ContentType "application/json; charset=utf-8"
```

## Запуск локально (без Docker)

Нужен PostgreSQL и Python 3.12.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# укажите POSTGRES_HOST=localhost и параметры БД через переменные окружения
python manage.py migrate
python manage.py runserver
```

## Тесты

```powershell
python manage.py test
```

Тесты проверяют: health, контракт графа карты, контракт карточки объекта,
создание трубопровода из сегментов, валидацию полигона участка.

## Полный цикл «карта → PostgreSQL» (ПРОВЕРЕНО)

1. Фронтенд рисует граф (объекты/сегменты/трубопроводы/участки).
2. Кнопка **«Сохранить»** (правый верхний угол карты, `SaveGraphButton`) собирает
   снимок (`frontend/src/api/mapSave.ts`) и делает `POST /api/map/save/`.
3. Backend (`core/services/graph_import.py`) в одной транзакции заменяет содержимое
   проекта: `core_facility`, `core_networknode`, `core_networksegment`,
   `core_pipeline`+`core_pipelinesegment`, `core_licencearea`.
4. Чтение обратно — `GET /api/map/graph/` (проверено: данные возвращаются).

Ответ сохранения: `{"project_id": "<uuid>", "counts": {...}}`.

## Статус / что НЕ сделано
- **Расчёт ГР** — только постановка задачи (`CalculationRun`) и чтение результатов;
  само расчётное ядро не перенесено (в «Примере проекта» это отдельный модуль
  гидравлики — его нужно реализовать отдельно).
- **Импорт pipeline JSON** — не реализован.
- **Аутентификация (JWT)** — не реализована.
- Аналитика/маршруты из «Примера проекта» — не переносились (в текущем фронтенде
  эти разделы не используются).
- Врезки/тройники сохраняются как узлы (`kind = tee/tap`) ВМЕСТЕ с привязкой:
  `tap_edge_external` (ребро-носитель), `tap_t` (позиция 0..1),
  `bound_tap_external` / `bound_fitting_external` (какая вершина ребра подключена
  к врезке/тройнику). Загружаются обратно в domain layer фронтенда.
