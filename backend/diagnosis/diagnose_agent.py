from __future__ import annotations

from typing import Any

from diagnosis.feature_extractor import extract_features
from diagnosis.llm_fallback import rule_only_fallback, run_ai_diagnosis
from diagnosis.rule_engine import match_fingerprint
from models.schemas import DiagnosisPayload, IncidentSnapshot, StructuredReasoning


class DiagnoseAgent:
    def __init__(self, token_governor, db):
        self.governor = token_governor
        self.db = db

    def run(self, snapshot: IncidentSnapshot) -> DiagnosisPayload:
        fingerprint = match_fingerprint(snapshot)
        if fingerprint and fingerprint["confidence"] >= 0.75:
            return DiagnosisPayload(
                root_cause=str(fingerprint["root_cause"]),
                confidence=float(fingerprint["confidence"]),
                diagnosis_mode="rule",
                fingerprint_matched=True,
                estimated_token_cost=0.0,
                actual_token_cost=0.0,
                affected_services=fingerprint["affected_services"](snapshot),
                evidence=self._build_rule_evidence(snapshot),
                structured_reasoning=StructuredReasoning(
                    matched_rules=[f"{fingerprint['fingerprint_id']}: {fingerprint['name']}"],
                    conflicting_signals=[],
                    missing_signals=[] if snapshot.trace_summary else ["trace_summary not triggered"],
                ),
            )

        features = extract_features(snapshot)
        conflicts = self._detect_conflicts(features)
        result = run_ai_diagnosis(snapshot, features, self.governor, self.db, snapshot.incident_id)
        if result is None:
            fallback = rule_only_fallback(snapshot, features)
            fallback.structured_reasoning.conflicting_signals = conflicts
            return fallback

        result.structured_reasoning.conflicting_signals = conflicts
        return result

    @staticmethod
    def _build_rule_evidence(snapshot: IncidentSnapshot) -> list[str]:
        evidence = []
        for event in snapshot.events[:3]:
            evidence.append(f"{event.reason} event x {event.count}")
        for sig in snapshot.logs_summary[:2]:
            evidence.append(f"log: {sig.signature[:80]} x {sig.count}")
        evidence.append(f"memory={snapshot.metrics.memory}, cpu={snapshot.metrics.cpu}")
        return evidence

    @staticmethod
    def _detect_conflicts(features: dict[str, Any]) -> list[str]:
        conflicts = []
        if features["oom_event_count"] > 0 and features["memory_usage_percent"] < 70:
            conflicts.append("OOMKilled event but memory below 70%")
        if features["crash_loop_event_count"] > 0 and features["restart_count"] == 0:
            conflicts.append("CrashLoopBackOff event but restarts at 0")
        return conflicts
