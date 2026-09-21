# Запуск проекта «Региональная модель» в Docker

Инструкция для запуска **всего стека** (frontend + backend + PostgreSQL) в Docker
одной командой. Ничего, кроме Docker, устанавливать не нужно.

---

## 1. Что понадобится

- **Docker Desktop** (Windows/macOS) или **Docker Engine + Compose** (Linux).
  Проверка:
  ```bash
  docker --version
  docker compose version
  ```
- Свободные порты на хосте: **8080** (frontend), **8000** (backend API), **5432** (PostgreSQL).

> Порты можно поменять в `docker-compose.yml` (секция `ports`).

---

## 2. Состав стека

| Сервис   | Что это                          | Образ/сборка              | Порт на хосте |
|----------|----------------------------------|---------------------------|---------------|
| `db`       | PostgreSQL 16                  | `postgres:16-alpine`      | `5432`        |
| `backend`  | Django + DRF (gunicorn), API    | `backend/Dockerfile`      | `8000`        |
| `frontend` | SPA (React/Vite) через nginx    | `frontend/Dockerfile`     | `8080`        |

Схема работы: браузер открывает **http://localhost:8080** — nginx отдаёт SPA и
проксирует запросы `/api/*` на сервис `backend:8000` (единый origin, CORS не нужен).

```
Браузер ──► frontend (nginx :8080) ──/api/*──► backend (gunicorn :8000) ──► db (:5432)
```

---

## 3. Запуск (основной сценарий)

Из **корня проекта** (там, где лежит `docker-compose.yml`):

```bash
docker compose up --build
```

- `--build` — собрать образы backend и frontend (в первый раз обязательно).
- Дождитесь строк вида `Running migrations...`, `Listening at: http://0.0.0.0:8000`,
  затем откройте в браузере:

  **http://localhost:8080**

Первый запуск занимает несколько минут (сборка SPA и установка зависимостей).
Повторные запуски — без `--build` и почти мгновенно.

### Запуск в фоне (detached)

```bash
docker compose up --build -d
```

---

## 4. Остановка и повторный запуск

```bash
# Остановить и удалить контейнеры (данные БД в volume СОХРАНЯЮТСЯ)
docker compose down

# Снова поднять (без пересборки)
docker compose up -d

# Пересобрать после изменений в коде
docker compose up --build -d
```

Полностью удалить всё, **включая данные БД**:
```bash
docker compose down -v
```

---

## 5. Переменные окружения

Значения по умолчанию заданы прямо в `docker-compose.yml`. Чтобы переопределить,
создайте файл **`.env`** в корне проекта (рядом с `docker-compose.yml`):

```dotenv
# PostgreSQL
POSTGRES_DB=regional_model
POSTGRES_USER=regional_model
POSTGRES_PASSWORD=смени_меня

# Django
DJANGO_SECRET_KEY=длинный_случайный_секрет
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend
DJANGO_CORS_ORIGINS=http://localhost:8080
```

> `.env` подхватывается Docker Compose автоматически при `docker compose up`.

---

## 6. Проверка, что всё поднялось

```bash
# Контейнеры должны быть в состоянии Up / healthy
docker compose ps

# Бэкенд жив (ожидается {"status":"ok","service":"regional-model"})
curl http://localhost:8000/api/health/
```

Через браузер: **http://localhost:8080** — должна открыться карта с деревом
объектов и панелью «Проектирование».

---

## 7. Полезные команды

```bash
# Логи всех сервисов (или одного: docker compose logs -f backend)
docker compose logs -f

# Применить миграции вручную
docker compose exec backend python manage.py migrate

# Тесты бэкенда
docker compose exec backend python manage.py test

# Django shell
docker compose exec backend python manage.py shell

# Подключиться к БД (psql)
docker compose exec db psql -U regional_model -d regional_model
```

---

## 8. Частые проблемы

| Симптом | Причина / решение |
|---|---|
| Порт занят (`bind: address already in use`) | Что-то уже слушает 8080/8000/5432. Остановите занявший процесс или поменяйте `ports` в `docker-compose.yml`. |
| `frontend` открывается, но `/api` даёт 404/502 | Бэкенд ещё не готов. Проверьте `docker compose logs backend`, дождитесь `Listening at`. |
| Backend падает на старте, ошибки подключения к БД | `db` не успел подняться. Обычно помогает `docker compose up` повторно; healthcheck уже завязан через `depends_on`. |
| Нужен «чистый» запуск | `docker compose down -v && docker compose up --build`. |
| Windows: медленная сборка | Включите WSL2-бэкенд в Docker Desktop и держите проект на диске WSL. |

---

## 9. Обновление кода

После изменений в `frontend/` или `backend/`:

```bash
docker compose up --build -d
```

- Для **frontend** изменения попадут в образ только после пересборки (Vite build).
- Для **backend** код копируется при сборке; можно также пересобрать или
  перезапустить: `docker compose restart backend`.

---

## 10. Итог в одной строке

```bash
docker compose up --build      # собрать и запустить весь стек
# → открыть http://localhost:8080
```
