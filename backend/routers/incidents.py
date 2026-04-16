import json
import sqlite3
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from agents.monitor_agent import MonitorAgent
from classification.failure_classifier import FailureClassifier
from collectors.k8s_events_collector import K8sEventsCollector
from collectors.prometheus_collector import PrometheusCollector
from collectors.tempo_collector import TempoCollector
from config import settings
from db import get_db_dep
from incident.snapshot_builder import SnapshotBuilder
from models.schemas import IncidentFromAlertRequest
from signal_intelligence.log_pattern_extractor import LogPatternExtractor
from signal_intelligence.metric_feature_builder import MetricFeatureBuilder
from signal_intelligence.trace_dependency_mapper import TraceDependencyMapper

router = APIRouter()


def _get_incident_row(db: sqlite3.Connection, incident_id: str) -> sqlite3.Row:
    row = db.execute("SELECT * FROM incidents WHERE id=?", (incident_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail={"error": "not_found", "incident_id": incident_id})
    return row


def _row_to_detail_payload(row: sqlite3.Row) -> dict:
    data = dict(row)
    detail = {
        "incident_id": data["id"],
        "status": data["status"],
        "scenario_id": data["scenario_id"],
        "service": data["service"],
        "namespace": data["namespace"],
        "pod": data["pod"],
        "failure_class": data["failure_class"],
        "severity": data["severity"],
        "monitor_confidence": data["monitor_confidence"],
        "snapshot": json.loads(data["snapshot_json"]) if data.get("snapshot_json") else None,
        "diagnosis": json.loads(data["diagnosis_json"]) if data.get("diagnosis_json") else None,
        "plan": json.loads(data["plan_json"]) if data.get("plan_json") else None,
        "execution": json.loads(data["execution_json"]) if data.get("execution_json") else None,
        "verification": json.loads(data["verification_json"]) if data.get("verification_json") else None,
        "created_at": data["created_at"],
        "resolved_at": data["resolved_at"],
    }
    return detail


@router.post("/from-alert")
async def create_incident_from_alert(
    body: IncidentFromAlertRequest,
    request: Request,
    db: sqlite3.Connection = Depends(get_db_dep),
):
    incident_id = f"inc-{uuid4().hex[:8]}"
    pod = body.pod or f"{body.deployment}-{uuid4().hex[:5]}"

    prometheus = PrometheusCollector()
    k8s_events = K8sEventsCollector()
    tempo = TempoCollector()

    metrics_raw = await prometheus.get_service_metrics(
        namespace=body.namespace,
        deployment=body.deployment,
        pod=pod,
    )
    metric_features = MetricFeatureBuilder.build(metrics_raw)

    events_raw = await k8s_events.get_recent_events(
        namespace=body.namespace,
        deployment=body.deployment,
        minutes=10,
    )
    logs_summary = await LogPatternExtractor.extract(
        namespace=body.namespace,
        service=body.service,
        window_minutes=settings.log_query_window_minutes,
        top_n=settings.log_top_signatures,
    )

    timeout_count = sum(
        item.get("count", 0)
        for item in logs_summary
        if "timeout" in item.get("signature", "").lower()
    )
    cross_service_suspected = any(
        "connection" in item.get("signature", "").lower() for item in logs_summary
    )

    trace_raw = None
    if tempo.should_query(
        latency_delta_x=metric_features["latency_delta_ratio"],
        timeout_log_count=timeout_count,
        cross_service_suspected=cross_service_suspected,
    ):
        trace_raw = await tempo.get_trace_summary(service=body.service)

    failure_class = FailureClassifier.classify(
        features=metric_features,
        events=events_raw,
        logs_summary=logs_summary,
    )
    confidence = MonitorAgent.compute_confidence(
        features=metric_features,
        events=events_raw,
        logs_summary=logs_summary,
    )

    dependency_summary = TraceDependencyMapper.summarize(trace_raw, body.service)
    snapshot = SnapshotBuilder.build(
        incident_id=incident_id,
        alert=body.alert,
        service=body.service,
        namespace=body.namespace,
        deployment=body.deployment,
        pod=pod,
        metrics_raw=metrics_raw,
        events_raw=events_raw,
        logs_raw=logs_summary,
        trace_raw=trace_raw,
        failure_class=failure_class.value,
        confidence=confidence,
        dependency_graph_summary=dependency_summary,
    )

    now = datetime.utcnow().isoformat() + "Z"
    db.execute(
        """INSERT INTO incidents
           (id, status, scenario_id, service, namespace, pod, failure_class,
            severity, monitor_confidence, snapshot_json, created_at, updated_at)
           VALUES (?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            incident_id,
            body.scenario_id,
            body.service,
            body.namespace,
            pod,
            failure_class.value,
            body.severity.value,
            snapshot.monitor_confidence,
            json.dumps(snapshot.model_dump()),
            now,
            now,
        ),
    )
    db.execute(
        "INSERT INTO incident_timeline (incident_id, status, actor, note, timestamp) "
        "VALUES (?, 'open', 'monitor', ?, datetime('now'))",
        (incident_id, "Incident created from alert correlation pipeline"),
    )
    db.commit()

    broadcaster = getattr(request.app.state, "broadcaster", None)
    if broadcaster is not None:
        await broadcaster.broadcast(
            {
                "type": "incident_event",
                "incident_id": incident_id,
                "status": "open",
                "scenario_id": body.scenario_id,
                "severity": body.severity.value,
                "created_at": now,
            }
        )

    return {
        "incident_id": incident_id,
        "status": "open",
        "service": body.service,
        "failure_class": failure_class.value,
        "monitor_confidence": snapshot.monitor_confidence,
        "created_at": now,
    }


@router.get("/")
def list_incidents(
    status: str | None = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    db: sqlite3.Connection = Depends(get_db_dep),
):
    where = "WHERE status=?" if status else ""
    params = [status] if status else []

    total = db.execute(f"SELECT COUNT(*) FROM incidents {where}", params).fetchone()[0]

    rows = db.execute(
        f"""SELECT id, status, service, failure_class, severity, monitor_confidence,
                   created_at, updated_at
            FROM incidents {where}
            ORDER BY created_at DESC LIMIT ? OFFSET ?""",
        params + [limit, offset],
    ).fetchall()

    items = [
        {
            "incident_id": row["id"],
            "status": row["status"],
            "service": row["service"],
            "failure_class": row["failure_class"],
            "severity": row["severity"],
            "monitor_confidence": row["monitor_confidence"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]

    return {"total": total, "incidents": items}


@router.get("/{incident_id}")
def get_incident(incident_id: str, db: sqlite3.Connection = Depends(get_db_dep)):
    row = _get_incident_row(db, incident_id)

    token_row = db.execute(
        """SELECT SUM(input_tokens), SUM(output_tokens), COUNT(*),
                  SUM(actual_cost_usd), MAX(fallback_triggered)
           FROM token_usage WHERE incident_id=?""",
        (incident_id,),
    ).fetchone()

    token_summary = {
        "total_input_tokens": token_row[0] or 0,
        "total_output_tokens": token_row[1] or 0,
        "total_ai_calls": token_row[2] or 0,
        "total_actual_cost_usd": round(token_row[3] or 0.0, 6),
        "rule_only_resolution": (token_row[2] or 0) == 0,
        "fallback_triggered": bool(token_row[4] or 0),
    }

    detail = _row_to_detail_payload(row)
    detail["token_summary"] = token_summary
    return detail


@router.get("/{incident_id}/snapshot")
def get_snapshot(incident_id: str, db: sqlite3.Connection = Depends(get_db_dep)):
    row = _get_incident_row(db, incident_id)
    if not row["snapshot_json"]:
        raise HTTPException(
            status_code=400,
            detail={"error": "snapshot_missing", "message": "No snapshot found for this incident"},
        )
    return json.loads(row["snapshot_json"])


@router.get("/{incident_id}/timeline")
def get_timeline(incident_id: str, db: sqlite3.Connection = Depends(get_db_dep)):
    _get_incident_row(db, incident_id)

    rows = db.execute(
        "SELECT status, actor, note, timestamp FROM incident_timeline "
        "WHERE incident_id=? ORDER BY timestamp ASC",
        (incident_id,),
    ).fetchall()

    return {"incident_id": incident_id, "events": [dict(row) for row in rows]}
