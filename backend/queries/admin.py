from django.contrib import admin

from .models import IntegrationConfig


@admin.register(IntegrationConfig)
class IntegrationConfigAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")
