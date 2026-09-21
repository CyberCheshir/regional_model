"""
Настройки для быстрой проверки backend на SQLite (без PostgreSQL).

Используются ТОЛЬКО для локального прогона `manage.py check`, `makemigrations`
и тестов там, где нет PostgreSQL. В проде/докере применяется config.settings.
"""
from .settings import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}
