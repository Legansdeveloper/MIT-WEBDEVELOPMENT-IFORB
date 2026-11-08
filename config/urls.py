from django.contrib import admin
from django.urls import path

from deteksi.views import analyze_chat, csrf_token, home, speak_analysis


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", home, name="home"),
    path("api/analyze/", analyze_chat, name="analyze_chat"),
    path("api/csrf/", csrf_token, name="csrf_token"),
    path("api/speak/", speak_analysis, name="speak_analysis"),
]
