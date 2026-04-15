from django.db import models


class IntegrationConfig(models.Model):
    """Stores configuration for third-party integrations (Jira, HubSpot, etc.)."""

    name = models.CharField(max_length=100, unique=True)
    api_key_encrypted = models.TextField(
        help_text="Encrypted API key for the integration"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({'Active' if self.is_active else 'Inactive'})"

    class Meta:
        ordering = ["name"]
        verbose_name = "Integration Config"
        verbose_name_plural = "Integration Configs"
