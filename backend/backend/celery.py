"""
Celery application definition for Product Intelligence Platform.

Queues:
  - ingestion   : raw event ingestion, integration sync
  - processing  : AI pipeline steps, idempotency cleanup
  - analytics   : insight generation, reporting

Workers should be started as:
  celery -A backend worker -Q ingestion,processing,analytics --concurrency=4
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

app = Celery("backend")

# Pull config from Django settings, namespace CELERY_
app.config_from_object("django.conf:settings", namespace="CELERY")

# Autodiscover tasks from all INSTALLED_APPS
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Utility task to verify Celery is alive."""
    print(f"Request: {self.request!r}")
