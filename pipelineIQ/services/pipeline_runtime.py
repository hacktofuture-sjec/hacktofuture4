from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from beanie import PydanticObjectId

from config import settings
from models.pipeline_run import PipelineRun
from models.workspace import Workspace
from services.github_app import download_workflow_logs
from services.llm_gateway import call_with_fallback

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _health_from_conclusion(conclusion: str | None) -> str:
    normalized = (conclusion or "").lower()
    if normalized in {"success", "completed"}:
        return "healthy"
    if normalized in {"failure", "timed_out", "startup_failure", "action_required"}:
        return "failing"
    if normalized in {"cancelled", "neutral", "skipped"}:
        return "degraded"
    return "unknown"


def build_pipeline_event(
    workspace: Workspace,
    event_type: str,
    payload: dict[str, Any],
    delivery_id: str,
) -> dict[str, Any]:
    workflow_run = payload.get("workflow_run") or {}
    workflow_job = payload.get("workflow_job") or {}
    check_run = payload.get("check_run") or {}
    repository = payload.get("repository") or {}

    run_id = None
    workflow_name = None
    workflow_url = None
    branch = None
    commit_sha = None
    conclusion = None
    triggered_by = payload.get("action") or event_type

    if event_type == "workflow_run":
        run_id = workflow_run.get("id")
        workflow_name = workflow_run.get("name") or payload.get("workflow", {}).get("name")
        workflow_url = workflow_run.get("html_url")
        branch = workflow_run.get("head_branch")
        commit_sha = workflow_run.get("head_sha")
        conclusion = workflow_run.get("conclusion") or workflow_run.get("status")
        triggered_by = workflow_run.get("event") or payload.get("action") or event_type
    elif event_type == "workflow_job":
        run_id = workflow_job.get("run_id")
        workflow_name = workflow_job.get("name")
        workflow_url = workflow_job.get("html_url")
        branch = workflow_job.get("head_branch")
        commit_sha = workflow_job.get("head_sha")
        conclusion = workflow_job.get("conclusion") or workflow_job.get("status")
        triggered_by = workflow_job.get("event") or payload.get("action") or event_type
    elif event_type == "check_run":
        run_id = check_run.get("id")
        workflow_name = check_run.get("name")
        workflow_url = check_run.get("html_url") or check_run.get("details_url")
        branch = payload.get("check_suite", {}).get("head_branch")
        commit_sha = check_run.get("head_sha")
        conclusion = check_run.get("conclusion") or check_run.get("status")
        triggered_by = payload.get("action") or event_type
    elif event_type == "push":
        branch = (payload.get("ref") or "").removeprefix("refs/heads/")
        commit_sha = payload.get("after")
        conclusion = "success"
        workflow_name = "push"
        workflow_url = repository.get("html_url")
        triggered_by = "push"

    repo_full_name = (
        repository.get("full_name")
        or workspace.github_repo_full_name
        or "unknown/unknown"
    )

    return {
        "pipeline_run_id": None,
        "workspace_id": str(workspace.id),
        "installation_id": workspace.github_installation_id,
        "delivery_id": delivery_id,
        "repo": repo_full_name,
        "run_id": run_id,
        "workflow_name": workflow_name,
        "workflow_url": workflow_url,
        "conclusion": conclusion,
        "branch": branch,
        "commit_sha": commit_sha,
        "triggered_by": triggered_by,
        "event_type": event_type,
        "action": payload.get("action"),
        "health_status": _health_from_conclusion(conclusion),
    }


class PipelineRuntime:
    def __init__(self) -> None:
        self.producer: AIOKafkaProducer | None = None
        self.monitor_consumer: AIOKafkaConsumer | None = None
        self.diagnosis_consumer: AIOKafkaConsumer | None = None
        self.tasks: list[asyncio.Task] = []
        self.started = False

    async def start(self) -> None:
        if self.started:
            return
        if not settings.KAFKA_ENABLED:
            logger.info("Kafka disabled; using direct in-process pipeline processing.")
            self.started = True
            return

        self.producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        )
        self.monitor_consumer = AIOKafkaConsumer(
            settings.KAFKA_PIPELINE_EVENTS_TOPIC,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id=settings.KAFKA_MONITOR_GROUP_ID,
            enable_auto_commit=True,
            auto_offset_reset="latest",
        )
        self.diagnosis_consumer = AIOKafkaConsumer(
            settings.KAFKA_DIAGNOSIS_REQUIRED_TOPIC,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id=settings.KAFKA_DIAGNOSIS_GROUP_ID,
            enable_auto_commit=True,
            auto_offset_reset="latest",
        )

        await self.producer.start()
        await self.monitor_consumer.start()
        await self.diagnosis_consumer.start()

        self.tasks = [
            asyncio.create_task(
                self._consume_loop(self.monitor_consumer, self._handle_monitor_event),
                name="pipelineiq-monitor-consumer",
            ),
            asyncio.create_task(
                self._consume_loop(
                    self.diagnosis_consumer,
                    self._handle_diagnosis_event,
                ),
                name="pipelineiq-diagnosis-consumer",
            ),
        ]
        self.started = True

    async def stop(self) -> None:
        for task in self.tasks:
            task.cancel()
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)
        self.tasks = []

        if self.monitor_consumer is not None:
            await self.monitor_consumer.stop()
            self.monitor_consumer = None
        if self.diagnosis_consumer is not None:
            await self.diagnosis_consumer.stop()
            self.diagnosis_consumer = None
        if self.producer is not None:
            await self.producer.stop()
            self.producer = None

        self.started = False

    async def queue_event(
        self,
        *,
        workspace: Workspace,
        event_type: str,
        delivery_id: str,
        payload: dict[str, Any],
    ) -> PipelineRun:
        existing = await PipelineRun.find_one(PipelineRun.delivery_id == delivery_id)
        if existing is not None:
            return existing

        event = build_pipeline_event(workspace, event_type, payload, delivery_id)
        pipeline_run = PipelineRun(
            workspace_id=workspace.id,
            installation_id=workspace.github_installation_id,
            repository_full_name=event["repo"],
            delivery_id=delivery_id,
            event_type=event_type,
            action=event["action"],
            run_id=event["run_id"],
            workflow_name=event["workflow_name"],
            workflow_url=event["workflow_url"],
            branch=event["branch"],
            commit_sha=event["commit_sha"],
            triggered_by=event["triggered_by"],
            conclusion=event["conclusion"],
            health_status=event["health_status"],
            raw_event=payload,
            created_at=_now(),
            updated_at=_now(),
        )
        await pipeline_run.insert()

        event["pipeline_run_id"] = str(pipeline_run.id)
        await self._publish_pipeline_event(event)

        pipeline_run.kafka_status = "published"
        pipeline_run.updated_at = _now()
        await pipeline_run.save()
        return pipeline_run

    async def _publish_pipeline_event(self, event: dict[str, Any]) -> None:
        if settings.KAFKA_ENABLED:
            if self.producer is None:
                raise RuntimeError("Kafka producer is not started")
            await self.producer.send_and_wait(
                settings.KAFKA_PIPELINE_EVENTS_TOPIC,
                json.dumps(event).encode("utf-8"),
            )
            return

        await self._handle_monitor_event(event)

    async def _publish_diagnosis_event(self, event: dict[str, Any]) -> None:
        if settings.KAFKA_ENABLED:
            if self.producer is None:
                raise RuntimeError("Kafka producer is not started")
            await self.producer.send_and_wait(
                settings.KAFKA_DIAGNOSIS_REQUIRED_TOPIC,
                json.dumps(event).encode("utf-8"),
            )
            return

        await self._handle_diagnosis_event(event)

    async def _consume_loop(
        self,
        consumer: AIOKafkaConsumer,
        handler,
    ) -> None:
        try:
            async for message in consumer:
                payload = json.loads(message.value.decode("utf-8"))
                try:
                    await handler(payload)
                except Exception:
                    logger.exception("Failed to process Kafka message")
        except asyncio.CancelledError:
            raise

    async def _handle_monitor_event(self, event: dict[str, Any]) -> None:
        pipeline_run = await PipelineRun.get(PydanticObjectId(event["pipeline_run_id"]))
        if pipeline_run is None:
            return

        logs_text = ""
        if (
            event.get("run_id")
            and event.get("installation_id")
            and event.get("repo")
        ):
            try:
                logs_text = await download_workflow_logs(
                    installation_id=event["installation_id"],
                    repository_full_name=event["repo"],
                    run_id=event["run_id"],
                )
            except Exception as exc:
                logs_text = f"Failed to fetch workflow logs: {exc}"

        excerpt = logs_text[:12000]
        excerpt_lines = [line for line in excerpt.splitlines()[:40] if line.strip()]

        system_prompt = (
            "You are the PipelineIQ Monitor Agent. "
            "Summarize deployment or CI health clearly. "
            "Identify whether this event indicates healthy execution, degraded state, or failure. "
            "Mention the most relevant log clues in 5 bullet-like sentences maximum."
        )
        user_prompt = (
            f"Pipeline event:\n{json.dumps(event, indent=2)}\n\n"
            f"Workflow logs excerpt:\n{excerpt or 'No workflow logs were available for this event.'}"
        )
        try:
            summary, provider, model = await call_with_fallback(
                primary_provider=settings.MONITOR_AGENT_PRIMARY_PROVIDER,
                primary_model=settings.MONITOR_AGENT_PRIMARY_MODEL,
                fallback_provider=settings.MONITOR_AGENT_FALLBACK_PROVIDER,
                fallback_model=settings.MONITOR_AGENT_FALLBACK_MODEL,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.1,
            )
        except Exception as exc:
            pipeline_run.monitor_status = "failed"
            pipeline_run.monitor_summary = f"Monitor agent failed: {exc}"
            pipeline_run.monitor_logs_excerpt = excerpt_lines
            pipeline_run.diagnosis_status = "failed"
            pipeline_run.diagnosis_error = "Diagnosis skipped because monitor agent failed."
            pipeline_run.updated_at = _now()
            await pipeline_run.save()
            return

        pipeline_run.monitor_status = "completed"
        pipeline_run.monitor_summary = summary
        pipeline_run.monitor_logs_excerpt = excerpt_lines
        pipeline_run.monitor_provider = provider
        pipeline_run.monitor_model = model
        pipeline_run.enriched_event = {
            "logs_excerpt": excerpt,
            "monitor_summary": summary,
        }
        pipeline_run.updated_at = _now()

        if pipeline_run.health_status == "healthy":
            pipeline_run.diagnosis_status = "skipped"
            await pipeline_run.save()
            return

        pipeline_run.diagnosis_status = "queued"
        pipeline_run.error_summary = summary
        await pipeline_run.save()

        enriched_event = {
            **event,
            "logs_excerpt": excerpt,
            "monitor_summary": summary,
        }
        await self._publish_diagnosis_event(enriched_event)

    async def _handle_diagnosis_event(self, event: dict[str, Any]) -> None:
        pipeline_run = await PipelineRun.get(PydanticObjectId(event["pipeline_run_id"]))
        if pipeline_run is None:
            return

        system_prompt = (
            "You are the PipelineIQ Diagnosis Agent. "
            "Produce a concise but actionable diagnosis report for a CI/CD failure. "
            "Use markdown with sections: Summary, Probable Cause, Evidence, Recommended Fixes, and Risk Notes."
        )
        user_prompt = (
            f"Pipeline event:\n{json.dumps(event, indent=2)}\n\n"
            f"Monitor summary:\n{event.get('monitor_summary', 'No monitor summary available.')}\n\n"
            f"Workflow logs excerpt:\n{event.get('logs_excerpt', 'No workflow logs available.')}"
        )
        try:
            report, provider, model = await call_with_fallback(
                primary_provider=settings.DIAGNOSIS_AGENT_PRIMARY_PROVIDER,
                primary_model=settings.DIAGNOSIS_AGENT_PRIMARY_MODEL,
                fallback_provider=settings.DIAGNOSIS_AGENT_FALLBACK_PROVIDER,
                fallback_model=settings.DIAGNOSIS_AGENT_FALLBACK_MODEL,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.15,
            )
            pipeline_run.diagnosis_status = "completed"
            pipeline_run.diagnosis_report = report
            pipeline_run.diagnosis_provider = provider
            pipeline_run.diagnosis_model = model
            pipeline_run.diagnosis_error = None
        except Exception as exc:
            pipeline_run.diagnosis_status = "failed"
            pipeline_run.diagnosis_error = str(exc)

        pipeline_run.updated_at = _now()
        await pipeline_run.save()


pipeline_runtime = PipelineRuntime()
