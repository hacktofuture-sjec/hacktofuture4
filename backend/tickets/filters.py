"""Tickets filtersets."""

import django_filters

from .models import UnifiedTicket


class UnifiedTicketFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(
        field_name="normalized_status",
        choices=(
            UnifiedTicket.status.field.choices
            if hasattr(UnifiedTicket, "status")
            else [
                ("open", "Open"),
                ("in_progress", "In Progress"),
                ("blocked", "Blocked"),
                ("resolved", "Resolved"),
            ]
        ),
    )
    normalized_status = django_filters.ChoiceFilter(
        choices=[
            ("open", "Open"),
            ("in_progress", "In Progress"),
            ("blocked", "Blocked"),
            ("resolved", "Resolved"),
        ]
    )
    normalized_type = django_filters.ChoiceFilter(
        choices=[
            ("bug", "Bug"),
            ("feature", "Feature"),
            ("task", "Task"),
            ("epic", "Epic"),
            ("story", "Story"),
            ("subtask", "Subtask"),
            ("other", "Other"),
        ]
    )
    priority = django_filters.ChoiceFilter(
        choices=[
            ("critical", "Critical"),
            ("high", "High"),
            ("medium", "Medium"),
            ("low", "Low"),
            ("none", "None"),
        ]
    )
    assignee_id = django_filters.NumberFilter(field_name="assignee_id")
    integration_id = django_filters.NumberFilter(field_name="integration_id")
    due_date_before = django_filters.DateFilter(
        field_name="due_date", lookup_expr="lte"
    )
    due_date_after = django_filters.DateFilter(field_name="due_date", lookup_expr="gte")
    title = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = UnifiedTicket
        fields = [
            "normalized_status",
            "normalized_type",
            "priority",
            "assignee_id",
            "integration_id",
        ]
