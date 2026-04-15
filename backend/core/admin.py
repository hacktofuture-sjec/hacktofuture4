from django.contrib import admin

from .models import QueryLog


@admin.register(QueryLog)
class QueryLogAdmin(admin.ModelAdmin):
    list_display = ("id", "user_query", "timestamp", "response_time")
    list_filter = ("timestamp",)
    search_fields = ("user_query",)
    readonly_fields = ("id", "timestamp")
