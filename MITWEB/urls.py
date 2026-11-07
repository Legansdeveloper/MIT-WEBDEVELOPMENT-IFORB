from django.contrib import admin
from django.urls import path

from deteksi.views import check_chat, speak_analysis


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", check_chat, name="home"),
    path("api/speak/", speak_analysis, name="speak_analysis"),
]
