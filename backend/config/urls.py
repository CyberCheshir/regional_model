"""Корневая маршрутизация API региональной модели."""
from django.urls import include, path

urlpatterns = [
    path("api/", include("core.urls")),
]
