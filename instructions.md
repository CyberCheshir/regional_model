# Instructions — как запустить проект «Региональная модель»

Проект состоит из двух частей:

```
regional_model/
├── frontend/   — React 18 + TypeScript + Vite 6 (карта, граф, интерфейс)
└── backend/    — Django 5 + DRF + PostgreSQL (API, хранение модели)
```

Frontend обращается к backend по префиксу `/api` (в dev-режиме — через прокси Vite
на `http://localhost:8000`).

---

## 0. Что понадобится

| Инструмент | Версия | Для чего |
|---|---|---|
| **Node.js** | 20+ | сборка и запуск frontend |
| **Docker Desktop** | с `docker compose` | запуск backend + PostgreSQL |
| **Python** | 3.12 (только для локального запуска backend без Docker) | опционально |

Проверка:

```powershell
node --version          # v20.x
docker --version        # Docker version 29.x
docker compose version  # v2.x
```

> Если `docker` не находится в PATH, открой Docker Desktop и перезапусти терминал.
> В Windows `docker.exe` обычно лежит в
> `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin`.

---

## 1. Запуск backend + PostgreSQL (Docker)

```powershell
cd backend
# .env в git не хранится — создай его из примера (если уже есть — пропусти):
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Открой `backend/.env` и при желании поменяй:

```env
DJANGO_SECRET_KEY=change_me_to_long_random_secret   # обязательно поменяй
POSTGRES_PASSWORD=change_me                          # свой пароль
```

Запуск (первый раз — со сборкой образа):

```powershell
docker compose up -d --build
```

Что происходит автоматически: поднимается PostgreSQL 16, backend применяет миграции
(`python manage.py migrate`) и стартует gunicorn на порту **8000**.

Проверка:

```powershell
docker compose ps
docker compose logs backend --tail 20
```

Ожидаемо: `db` — **healthy**, `backend` — **up**.

Проверка API:

```powershell
Invoke-RestMethod http://localhost:8000/api/health/
# {"status":"ok","service":"regional-model"}
```

### Полезные команды backend

```powershell
# остановить (данные в volume сохранятся)
docker compose down

# остановить и УДАЛИТЬ базу данных
docker compose down -v

# тесты (на PostgreSQL)
docker compose exec backend python manage.py test

# миграции
docker compose exec backend python manage.py showmigrations

# пересобрать после изменения кода backend
docker compose up -d --build backend
```

---

## 2. Запуск frontend

В **отдельном** терминале:

```powershell
cd frontend
npm install
npm run dev
```

Vite выведет адрес, например:

```
  ➜  Local:   http://localhost:5173/
```

Открой этот адрес в браузере. Порт может отличаться (5173, 5174, …), если занят —
Vite подберёт следующий.

### Проверка сборки и линта

```powershell
npm run build   # tsc -b && vite build
npm run lint    # eslint .
```

---

## 3. Как проверить, что всё связано

1. Открой frontend в браузере.
2. Нарисуй на карте объект и рёбра (панель «Проектирование» слева).
3. Нажми **«Сохранить»** (в верхней панели, между «Сценарии» и «Рассчитать») →
   введи название проекта → должен появиться прогрессбар и сводка сохранения.
4. Нажми **«Сценарии»** → выбери сохранённый проект → карта загрузит его из БД.

Проверить данные в БД можно через DBeaver или `psql`:

```powershell
docker compose exec db psql -U regional_model -d regional_model -c "\dt"
```

---

## 4. Подключение к базе (DBeaver или другой клиент)

| Параметр | Значение |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `regional_model` |
| User | `regional_model` |
| Password | значение `POSTGRES_PASSWORD` из `backend/.env` |

Порт 5432 публикуется наружу сервисом `db` в `backend/docker-compose.yml`.

Основные таблицы: `core_project`, `core_facility`, `core_networknode`,
`core_networksegment`, `core_pipeline`, `core_pipelinesegment`, `core_licencearea`, `core_flow`.

---

## 5. Запуск backend БЕЗ Docker (альтернатива)

Нужен установленный PostgreSQL и Python 3.12.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Укажи параметры БД через переменные окружения (или в `.env`) и запусти:

```powershell
$env:POSTGRES_HOST="localhost"
$env:POSTGRES_DB="regional_model"
$env:POSTGRES_USER="regional_model"
$env:POSTGRES_PASSWORD="твой_пароль"
python manage.py migrate
python manage.py runserver 8000
```

---

## 6. Типичные проблемы

| Симптом | Причина и решение |
|---|---|
| `docker: command not found` | Docker Desktop не запущен или не в PATH. Запусти Docker Desktop, перезапусти терминал. |
| `port is already allocated` (5432/8000) | Порт занят другой БД/сервисом. Останови его или измени порт в `docker-compose.yml`. |
| Frontend в браузере пустой, в консоли 404 на модуль | Dev-сервер запущен не из папки `frontend/`. Проверь путь запуска. |
| `Запросы к /api/` не работают (404/500) | Backend не поднят. Проверь `docker compose ps` и `docker compose logs backend`. |
| CORS-ошибка в консоли | Порт Vite не совпадает с `DJANGO_CORS_ORIGINS` в `backend/.env`. Добавь нужный origin, например `http://localhost:5174`, и перезапусти backend. |
| Vite пишет «Port 5173 is in use, trying another one…» | Занят другим dev-сервером. Используй выведенный адрес (напр. 5174) и добавь его в CORS; лишние серверы лучше остановить. |
| Русские имена сохраняются как `????` при проверке через PowerShell | PowerShell шлёт тело не в UTF-8. В браузере проблемы нет; для тестов кодируй: `[Text.Encoding]::UTF8.GetBytes($body)`. |
| Ошибка сохранения «HTTP 500» | Смотри `docker compose logs backend` — в логе будет traceback. |

---

## 7. Порядок запуска (кратко)

```powershell
# терминал 1 — backend + БД
cd backend
Copy-Item .env.example .env      # при первом запуске; задай пароль
docker compose up -d --build

# терминал 2 — frontend
cd frontend
npm install
npm run dev
```

Затем открой адрес, который выведет Vite (обычно `http://localhost:5173/`).
