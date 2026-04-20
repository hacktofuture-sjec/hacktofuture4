import json
import time

from fastapi.testclient import TestClient

from app.api.routes import chat as chat_route
from app.main import app
from src.controller.controller import ControllerKernel


def _collect_sse_events(client: TestClient, message: str, session_id: str) -> list[dict]:
    with client.stream(
        "POST",
        "/api/chat",
        json={"message": message, "session_id": session_id},
    ) as response:
        assert response.status_code == 200
        lines = list(response.iter_lines())

    events: list[dict] = []
    pending_event: dict[str, str] = {}
    pending_data: list[str] = []

    for raw_line in lines:
        line = str(raw_line).strip()
        if line == "":
            if pending_data:
                payload_text = "\n".join(pending_data)
                payload = json.loads(payload_text)
                events.append(
                    {
                        "event": pending_event.get("event", "message"),
                        "id": pending_event.get("id", ""),
                        "payload": payload,
                    }
                )
            pending_event = {}
            pending_data = []
            continue

        if line.startswith("event:"):
            pending_event["event"] = line.split("event:", 1)[1].strip()
            continue
        if line.startswith("id:"):
            pending_event["id"] = line.split("id:", 1)[1].strip()
            continue
        if line.startswith("data:"):
            pending_data.append(line.split("data:", 1)[1].strip())

    return events


def _create_trace(client: TestClient, session_id: str) -> str:
    events = _collect_sse_events(client, "Explain Redis latency from last week", session_id)
    completion = next(item for item in events if item["event"] == "trace_complete")
    trace_id = completion["payload"].get("trace_id", "")
    assert isinstance(trace_id, str)
    assert trace_id.startswith("trace-")
    return trace_id


def test_transcript_endpoint_returns_persisted_trace() -> None:
    client = TestClient(app)
    trace_id = _create_trace(client, "sess-stream-1")

    response = client.get(f"/api/chat/transcript/{trace_id}")
    assert response.status_code == 200

    payload = response.json()
    assert payload["trace_id"] == trace_id
    assert isinstance(payload["steps"], list)
    assert len(payload["steps"]) == 3
    assert isinstance(payload["dedup_summary"], dict)
    assert "deduped_count" in payload["dedup_summary"]


def test_stream_endpoint_emits_contract_payload_shape() -> None:
    client = TestClient(app)
    events = _collect_sse_events(client, "Explain Redis latency from last week", "sess-stream-2")

    trace_events = [item for item in events if item["event"] == "trace_step"]
    assert len(trace_events) == 3

    expected_steps = ["retrieval", "reasoning", "execution"]
    assert [item["payload"]["step"] for item in trace_events] == expected_steps

    lifecycle_events = [item["event"] for item in events]
    assert "trace_started" in lifecycle_events
    assert "trace_complete" in lifecycle_events

    for item in events:
        payload = item["payload"]
        assert isinstance(payload.get("event_id"), str)
        assert isinstance(payload.get("trace_id"), str)
        assert isinstance(payload.get("sequence"), int)
        assert isinstance(payload.get("status"), str)

    for item in trace_events:
        payload = item["payload"]
        required_keys = {"step", "agent", "observation", "sources"}
        assert required_keys.issubset(payload.keys())
        assert isinstance(payload["step"], str)
        assert isinstance(payload["agent"], str)
        assert isinstance(payload["observation"], str)
        assert isinstance(payload["sources"], list)
        assert isinstance(payload.get("metadata", {}), dict)
        assert isinstance(payload.get("timestamp"), str)
        metadata = payload.get("metadata", {})
        assert isinstance(metadata.get("duration_ms"), float)
        assert isinstance(metadata.get("started_at"), str)
        assert isinstance(metadata.get("finished_at"), str)

    reasoning_payload = next(item["payload"] for item in trace_events if item["payload"]["step"] == "reasoning")
    metadata = reasoning_payload.get("metadata", {})
    assert isinstance(metadata.get("reasoning_steps"), list)
    assert isinstance(metadata.get("evidence_scores"), list)
    assert isinstance(metadata.get("confidence_breakdown"), dict)
    assert metadata.get("provider") != "deterministic"
    assert metadata.get("model") != "heuristic"

    execution_payload = next(item["payload"] for item in trace_events if item["payload"]["step"] == "execution")
    execution_metadata = execution_payload.get("metadata", {})
    assert execution_metadata.get("provider") != "deterministic"
    assert execution_metadata.get("model") != "heuristic"

    completion_payload = next(item["payload"] for item in events if item["event"] == "trace_complete")
    assert isinstance(completion_payload.get("answer"), str)
    assert isinstance(completion_payload.get("needs_approval"), bool)


def test_chat_stream_emits_error_for_invalid_provider(monkeypatch) -> None:
    client = TestClient(app)
    monkeypatch.setattr(chat_route, "kernel", ControllerKernel(provider_name="invalid-provider"))
    events = _collect_sse_events(client, "Explain Redis latency from last week", "sess-invalid-provider")
    error_payload = next(item["payload"] for item in events if item["event"] == "trace_error")
    assert error_payload.get("error_code") == "provider_error"
    assert "LLM_PROVIDER" in str(error_payload.get("error", ""))


def test_transcript_endpoint_returns_404_for_unknown_trace() -> None:
    client = TestClient(app)
    response = client.get("/api/chat/transcript/trace-not-found")
    assert response.status_code == 404


def test_transcript_endpoint_can_wait_for_ready_transcript(monkeypatch) -> None:
    client = TestClient(app)

    def _wait_for_transcript(trace_id: str, timeout_seconds: float):
        assert trace_id == "trace-delayed"
        assert timeout_seconds == 0.2
        return {"trace_id": trace_id, "steps": [{"step": "retrieval"}]}

    monkeypatch.setattr(chat_route.memory, "wait_for_transcript", _wait_for_transcript)

    response = client.get("/api/chat/transcript/trace-delayed", params={"wait_timeout_seconds": 0.2})
    assert response.status_code == 200
    payload = response.json()
    assert payload["trace_id"] == "trace-delayed"


def test_transcript_endpoint_wait_timeout_still_returns_404(monkeypatch) -> None:
    client = TestClient(app)

    def _wait_for_transcript(trace_id: str, timeout_seconds: float):
        assert trace_id == "trace-missing"
        assert timeout_seconds == 0.1
        return None

    monkeypatch.setattr(chat_route.memory, "wait_for_transcript", _wait_for_transcript)

    response = client.get("/api/chat/transcript/trace-missing", params={"wait_timeout_seconds": 0.1})
    assert response.status_code == 404


def test_stream_response_sets_sse_headers() -> None:
    client = TestClient(app)
    with client.stream(
        "POST",
        "/api/chat",
        json={"message": "quick health check", "session_id": "sess-stream-headers"},
    ) as response:
        assert response.status_code == 200
        assert response.headers.get("content-type", "").startswith("text/event-stream")
        assert response.headers.get("cache-control") == "no-cache"
        assert response.headers.get("connection") == "keep-alive"


def test_chat_stream_times_out_when_controller_stalls(monkeypatch) -> None:
    class _StalledKernel:
        def stream_query_events(self, query: str, session_id: str):
            yield {
                "event_type": "trace_started",
                "trace_id": "trace-stalled",
                "status": "started",
                "metadata": {},
            }
            time.sleep(0.2)
            while True:
                time.sleep(0.2)

    client = TestClient(app)
    monkeypatch.setattr(chat_route, "kernel", _StalledKernel())
    monkeypatch.setattr(chat_route, "STREAM_HEARTBEAT_SECONDS", 0.02)
    monkeypatch.setattr(chat_route, "STREAM_IDLE_TIMEOUT_SECONDS", 0.08)

    events = _collect_sse_events(client, "simulate stalled stream", "sess-stream-timeout")
    lifecycle_events = [item["event"] for item in events]

    assert "trace_started" in lifecycle_events
    assert "trace_heartbeat" in lifecycle_events
    assert "trace_error" in lifecycle_events

    timeout_payload = next(item["payload"] for item in events if item["event"] == "trace_error")
    assert timeout_payload.get("error_code") == "stream_timeout"
    assert timeout_payload.get("status") == "failed"
