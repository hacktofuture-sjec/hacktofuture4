"""Events filtersets."""

import django_filters

from .models import RawWebhookEvent


class RawWebhookEventFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=RawWebhookEvent.STATUS_CHOICES)
    integration = django_filters.NumberFilter(field_name="integration_id")
    event_type = django_filters.CharFilter(lookup_expr="icontains")
    received_after = django_filters.DateTimeFilter(
        field_name="received_at", lookup_expr="gte"
    )
    received_before = django_filters.DateTimeFilter(
        field_name="received_at", lookup_expr="lte"
    )

    class Meta:
        model = RawWebhookEvent
        fields = ["status", "integration", "event_type"]
