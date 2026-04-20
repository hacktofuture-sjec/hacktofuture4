from __future__ import annotations

import asyncio
import json
import queue
import threading
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, model_validator

from src.controller.controller import ControllerKernel
from src.memory.three_tier_memory import ThreeTierMemory

router = APIRouter()
kernel = ControllerKernel()
memory = ThreeTierMemory()
STREAM_RETRY_MS = 3000
STREAM_HEARTBEAT_SECONDS = 2.5
STREAM_IDLE_TIMEOUT_SECONDS = 20.0
STREAM_QUEUE_MAXSIZE = 256


class IncidentReport(BaseModel):
    model_config = ConfigDict(extra="allow")

    source_system: str = "iris"
    case_id: str | None = None
    report_id: str | None = None
    report_url: str | None = None
    ingested_at: str | None = None
    case_name: str
    short_description: str
    severity: str
    tags: list[str]
    iocs: list[Any]
    timeline: list[Any]


class ChatRequest(BaseModel):
    message: str | None = None
    session_id: str
    incident_report: IncidentReport | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> "ChatRequest":
        has_message = bool(self.message and self.message.strip())
        has_incident_report = self.incident_report is not None
        if not has_message and not has_incident_report:
            raise ValueError("Either message or incident_report must be provided.")
        return self


def _stable_json(items: list[Any]) -> str:
    return json.dumps(items, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def incident_report_to_query(report: IncidentReport) -> str:
    lines = [
        "IRIS Incident Report",
        f"Source System: {report.source_system}",
        f"Case Name: {report.case_name}",
        f"Short Description: {report.short_description}",
        f"Severity: {report.severity}",
        f"Tags: {', '.join(report.tags) if report.tags else 'none'}",
        f"IOCs: {_stable_json(report.iocs)}",
        f"Timeline: {_stable_json(report.timeline)}",
    ]

    if report.case_id:
        lines.append(f"Case ID: {report.case_id}")
    if report.report_id:
        lines.append(f"Report ID: {report.report_id}")
    if report.report_url:
        lines.append(f"Report URL: {report.report_url}")
    if report.ingested_at:
        lines.append(f"Ingested At: {report.ingested_at}")

    return "\n".join(lines)


def _format_sse(event: str, payload: dict[str, Any], event_id: str, retry_ms: int | None = None) -> str:
    lines: list[str] = []
    if retry_ms is not None:
        lines.append(f"retry: {retry_ms}")
    lines.append(f"id: {event_id}")
    lines.append(f"event: {event}")
    serialized = json.dumps(payload, ensure_ascii=False)
    for line in serialized.splitlines() or [serialized]:
        lines.append(f"data: {line}")
    return "\n".join(lines) + "\n\n"


def _build_stream_payload(raw_event: dict[str, Any], sequence: int, trace_id: str) -> tuple[str, dict[str, Any]]:
    event_type = str(raw_event.get("event_type", "trace_step"))
    timestamp = str(raw_event.get("timestamp") or "")

    if event_type == "trace_step":
        step = raw_event.get("step") if isinstance(raw_event.get("step"), dict) else {}
        payload = {
            "event_type": event_type,
            "event_id": f"{trace_id}:{sequence}",
            "trace_id": trace_id,
            "sequence": sequence,
            "timestamp": step.get("timestamp") or timestamp,
            "status": str(raw_event.get("status", "in_progress")),
            "step": step.get("step", ""),
            "agent": step.get("agent", ""),
            "observation": step.get("observation", ""),
            "sources": step.get("sources", []),
            "metadata": step.get("metadata", {}),
        }
        return event_type, payload

    payload: dict[str, Any] = {
        "event_type": event_type,
        "event_id": f"{trace_id}:{sequence}",
        "trace_id": trace_id,
        "sequence": sequence,
        "timestamp": timestamp,
        "status": str(raw_event.get("status", "in_progress")),
        "metadata": raw_event.get("metadata", {}),
    }

    if event_type == "trace_complete":
        payload.update(
            {
                "answer": raw_event.get("answer", ""),
                "needs_approval": bool(raw_event.get("needs_approval", False)),
                "suggested_action": raw_event.get("suggested_action"),
            }
        )
    if event_type == "trace_error":
        payload.update(
            {
                "error_code": raw_event.get("error_code", "runtime_error"),
                "error": raw_event.get("error", "unknown error"),
            }
        )

    return event_type, payload


@router.post("/chat")
async def chat(payload: ChatRequest, request: Request) -> StreamingResponse:
    query = payload.message.strip() if payload.message else ""
    if payload.incident_report is not None:
        query = incident_report_to_query(payload.incident_report)

    event_queue: queue.Queue[dict[str, Any] | None] = queue.Queue(maxsize=STREAM_QUEUE_MAXSIZE)
    stop_event = threading.Event()

    def _queue_put(item: dict[str, Any] | None) -> bool:
        while not stop_event.is_set():
            try:
                event_queue.put(item, timeout=0.1)
                return True
            except queue.Full:
                continue
        return False

    def _worker() -> None:
        try:
            for stream_event in kernel.stream_query_events(query=query, session_id=payload.session_id):
                if stop_event.is_set():
                    break
                if not _queue_put(stream_event):
                    break
        except Exception as exc:
            _queue_put(
                {
                    "event_type": "trace_error",
                    "trace_id": "trace-unknown",
                    "status": "failed",
                    "error_code": "stream_worker_error",
                    "error": f"Stream worker failed: {exc}",
                }
            )
        finally:
            _queue_put(None)

    threading.Thread(target=_worker, daemon=True).start()

    async def event_generator():
        sequence = 0
        active_trace_id: str | None = None
        terminal_seen = False
        worker_done = False
        last_progress_at = time.monotonic()

        while True:
            if await request.is_disconnected():
                stop_event.set()
                break

            if worker_done and event_queue.empty():
                break

            try:
                queue_item = await asyncio.to_thread(event_queue.get, True, STREAM_HEARTBEAT_SECONDS)
            except queue.Empty:
                if terminal_seen:
                    break

                idle_duration = time.monotonic() - last_progress_at
                if idle_duration >= STREAM_IDLE_TIMEOUT_SECONDS:
                    sequence += 1
                    timeout_trace = active_trace_id or "trace-pending"
                    timeout_payload = {
                        "event_type": "trace_error",
                        "event_id": f"{timeout_trace}:{sequence}",
                        "trace_id": timeout_trace,
                        "sequence": sequence,
                        "timestamp": "",
                        "status": "failed",
                        "metadata": {
                            "idle_timeout_seconds": STREAM_IDLE_TIMEOUT_SECONDS,
                            "idle_duration_seconds": round(idle_duration, 3),
                        },
                        "error_code": "stream_timeout",
                        "error": "SSE stream timed out waiting for controller events.",
                    }
                    stop_event.set()
                    yield _format_sse(
                        event="trace_error",
                        payload=timeout_payload,
                        event_id=timeout_payload["event_id"],
                        retry_ms=STREAM_RETRY_MS if sequence == 1 else None,
                    )
                    break

                sequence += 1
                heartbeat_trace = active_trace_id or "trace-pending"
                heartbeat_payload = {
                    "event_type": "trace_heartbeat",
                    "event_id": f"{heartbeat_trace}:{sequence}",
                    "trace_id": heartbeat_trace,
                    "sequence": sequence,
                    "timestamp": "",
                    "status": "in_progress",
                    "metadata": {
                        "message": "stream alive",
                        "idle_duration_seconds": round(idle_duration, 3),
                    },
                }
                yield _format_sse(
                    event="trace_heartbeat",
                    payload=heartbeat_payload,
                    event_id=heartbeat_payload["event_id"],
                    retry_ms=STREAM_RETRY_MS if sequence == 1 else None,
                )
                continue

            if queue_item is None:
                worker_done = True
                if terminal_seen:
                    break
                continue

            if not isinstance(queue_item, dict):
                sequence += 1
                invalid_trace = active_trace_id or "trace-pending"
                invalid_payload = {
                    "event_type": "trace_error",
                    "event_id": f"{invalid_trace}:{sequence}",
                    "trace_id": invalid_trace,
                    "sequence": sequence,
                    "timestamp": "",
                    "status": "failed",
                    "metadata": {},
                    "error_code": "invalid_stream_event",
                    "error": "Controller emitted malformed stream event payload.",
                }
                stop_event.set()
                yield _format_sse(
                    event="trace_error",
                    payload=invalid_payload,
                    event_id=invalid_payload["event_id"],
                    retry_ms=STREAM_RETRY_MS if sequence == 1 else None,
                )
                break

            trace_id = str(queue_item.get("trace_id") or active_trace_id or "trace-pending")
            active_trace_id = trace_id
            sequence += 1
            event_type, stream_payload = _build_stream_payload(queue_item, sequence=sequence, trace_id=trace_id)
            yield _format_sse(
                event=event_type,
                payload=stream_payload,
                event_id=str(stream_payload.get("event_id", f"{trace_id}:{sequence}")),
                retry_ms=STREAM_RETRY_MS if sequence == 1 else None,
            )

            if event_type in {"trace_complete", "trace_error"}:
                terminal_seen = True
            last_progress_at = time.monotonic()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/chat/transcript/{trace_id}")
def get_transcript(trace_id: str, wait_timeout_seconds: float = Query(default=0.0, ge=0.0, le=5.0)) -> dict:
    transcript = memory.wait_for_transcript(trace_id, timeout_seconds=wait_timeout_seconds)
    if transcript is None:
        raise HTTPException(status_code=404, detail=f"trace {trace_id} not found")
    return transcript
