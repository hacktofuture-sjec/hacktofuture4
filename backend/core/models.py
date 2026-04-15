from django.db import models


class QueryLog(models.Model):
    """Stores user voice queries and their processing metadata."""

    id = models.AutoField(primary_key=True)
    user_query = models.TextField(help_text="The transcribed voice query from user")
    timestamp = models.DateTimeField(auto_now_add=True)
    response_time = models.FloatField(
        help_text="Response time in milliseconds",
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"Query {self.id}: {self.user_query[:50]}..."

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Query Log"
        verbose_name_plural = "Query Logs"
