"""
Insights Celery tasks.

generate_insights_for_org    — analytics queue, per-org AI insight generation
generate_insights_for_all_orgs — beat task (hourly)
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    queue="analytics",
    max_retries=2,
    acks_late=True,
    name="insights.tasks.generate_insights_for_org",
)
def generate_insights_for_org(self, org_id: str):
    """
    Calls the FastAPI agent service to generate AI insights for a given org.
    The agent reads ticket/event data via Django APIs (never direct DB).
    """
    import httpx
    from django.conf import settings

    try:
        with httpx.Client(timeout=120.0) as client:
            resp = client.post(
                f"{settings.AGENT_SERVICE_URL}/insights/generate",
                json={"organization_id": org_id},
                headers={"X-API-Key": settings.AGENT_SERVICE_API_KEY},
            )
            resp.raise_for_status()
            result = resp.json()

        logger.info(
            "Insights generated for org=%s count=%s",
            org_id,
            result.get("generated_count", 0),
        )

    except Exception as exc:
        logger.exception("Insight generation failed for org=%s", org_id)
        raise self.retry(exc=exc, countdown=300)


@shared_task(
    bind=True,
    queue="analytics",
    max_retries=1,
    name="insights.tasks.generate_insights_for_all_orgs",
)
def generate_insights_for_all_orgs(self):
    """Beat task (hourly): generates insights for all active orgs."""
    from accounts.models import Organization

    org_ids = Organization.objects.filter(is_active=True).values_list("id", flat=True)
    for org_id in org_ids:
        generate_insights_for_org.apply_async(
            args=[str(org_id)], queue="analytics", countdown=0
        )

    logger.info("generate_insights_for_all_orgs: triggered %s orgs", len(org_ids))
    return len(org_ids)
