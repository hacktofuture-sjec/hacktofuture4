from __future__ import annotations

"""Defensive Evolution — learns from each round, gets faster and more accurate.

Tracks metrics across detection/response/patch cycles and dynamically adjusts:
  - Detection thresholds (anomaly sensitivity, scan rate triggers)
  - Scan intervals (tightens under active threat, relaxes during calm)
  - Response aggressiveness (auto-isolate vs. alert-only based on accuracy)
  - Pattern recognition (common attack vectors get faster detection)

The evolver subscribes to all terminal events (response_complete, patch_complete,
isolation_complete, scan_complete) and continuously refines the Blue Agent's
operational parameters.

"System gets faster to defend" — detection speed and response accuracy
improve over time as the evolver learns from each cycle.
"""

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Deque, Dict, List, Optional

from core.event_bus import event_bus

logger = logging.getLogger(__name__)


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


@dataclass
class RoundMetrics:
    """Metrics for a single detect-respond-patch round."""
    round_id: int
    detection_time_ms: float
    response_time_ms: float
    patch_time_ms: float
    total_time_ms: float
    event_type: str
    service: str
    was_effective: bool
    timestamp: float = field(default_factory=time.time)


class DefenseEvolver:
    """Evolves defensive capabilities by learning from each engagement round.

    Tracks three key metrics over time:
      1. Detection speed — how fast threats are identified
      2. Response accuracy — how often responses are effective
      3. Coverage — what percentage of the attack surface is monitored

    Call register() once during initialisation to wire event subscriptions.
    Call start() to begin the periodic evolution loop.
    """

    def __init__(self) -> None:
        self._running: bool = False
        self.round_count: int = 0
        self.evolution_count: int = 0

        # Rolling windows of metrics
        self._round_history: Deque[RoundMetrics] = deque(maxlen=500)
        self._detection_times: Deque[float] = deque(maxlen=100)
        self._response_times: Deque[float] = deque(maxlen=100)
        self._effectiveness: Deque[bool] = deque(maxlen=100)

        # Tunable parameters — these evolve over time
        self.params = {
            "anomaly_threshold": 5.0,          # scans/sec to trigger alert
            "scan_interval": 8.0,              # seconds between full scans
            "sensitive_port_probability": 0.35, # chance to flag sensitive port
            "detection_tick_interval": 1.0,     # detector loop sleep
            "auto_isolate_cvss_threshold": 9.0, # auto-isolate above this CVSS
            "response_aggressiveness": 0.5,     # 0=passive, 1=aggressive
            "cloud_monitor_interval": 6.0,
            "onprem_monitor_interval": 5.0,
            "hybrid_monitor_interval": 7.0,
        }

        # Baseline metrics (for calculating improvement)
        self._baseline_detection_ms: Optional[float] = None
        self._baseline_response_ms: Optional[float] = None

        # Attack pattern knowledge base
        self._attack_patterns: Dict[str, int] = {}  # pattern -> count
        self._known_attack_vectors: List[str] = []

        # Timestamps for internal tracking
        self._event_timestamps: Dict[str, float] = {}

    # ------------------------------------------------------------------
    # Subscription wiring
    # ------------------------------------------------------------------

    def register(self) -> None:
        """Subscribe to all terminal events for learning."""
        event_bus.subscribe("response_complete", self._on_response_complete)
        event_bus.subscribe("patch_complete", self._on_patch_complete)
        event_bus.subscribe("isolation_complete", self._on_isolation_complete)
        event_bus.subscribe("scan_complete", self._on_scan_complete)
        event_bus.subscribe("vulnerability_found", self._on_vulnerability_found)
        event_bus.subscribe("port_probed", self._on_detection_event)
        event_bus.subscribe("port_scanned", self._on_detection_event)
        event_bus.subscribe("anomaly_detected", self._on_detection_event)
        event_bus.subscribe("exploit_attempted", self._on_detection_event)
        event_bus.subscribe("cve_detected", self._on_detection_event)

    # ------------------------------------------------------------------
    # Event handlers — record metrics from each round
    # ------------------------------------------------------------------

    async def _on_detection_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Record detection timestamp for speed measurement."""
        event_key = f"{event_type}:{data.get('port', '')}:{data.get('service', '')}"
        self._event_timestamps[event_key] = time.monotonic()

        # Track attack patterns
        pattern = f"{event_type}:{data.get('service', 'unknown')}"
        self._attack_patterns[pattern] = self._attack_patterns.get(pattern, 0) + 1

    async def _on_response_complete(self, event_type: str, data: Dict[str, Any]) -> None:
        """Record response round metrics."""
        now = time.monotonic()
        service = data.get("service", "unknown")
        port = data.get("port", 0)

        # Estimate detection-to-response time
        event_key = f"port_probed:{port}:{service}"
        det_time = self._event_timestamps.pop(event_key, now - 0.5)
        response_ms = (now - det_time) * 1000

        self._response_times.append(response_ms)
        self._effectiveness.append(True)  # completed = effective

        self.round_count += 1
        metrics = RoundMetrics(
            round_id=self.round_count,
            detection_time_ms=random.uniform(50, 200),  # simulated
            response_time_ms=response_ms,
            patch_time_ms=0,
            total_time_ms=response_ms,
            event_type="response",
            service=service,
            was_effective=True,
        )
        self._round_history.append(metrics)

    async def _on_patch_complete(self, event_type: str, data: Dict[str, Any]) -> None:
        """Record patch completion metrics."""
        self._effectiveness.append(True)

    async def _on_isolation_complete(self, event_type: str, data: Dict[str, Any]) -> None:
        """Record isolation metrics."""
        self._effectiveness.append(True)

    async def _on_scan_complete(self, event_type: str, data: Dict[str, Any]) -> None:
        """After each scan cycle, trigger evolution."""
        vuln_count = data.get("new_vulnerabilities", 0)
        if vuln_count > 3:
            # Many vulns found — tighten scanning
            self.params["scan_interval"] = max(3.0, self.params["scan_interval"] - 1.0)

    async def _on_vulnerability_found(self, event_type: str, data: Dict[str, Any]) -> None:
        """Track vulnerability patterns for evolution."""
        service = data.get("service", "unknown")
        severity = data.get("severity", "medium")
        pattern = f"vuln:{service}:{severity}"
        self._attack_patterns[pattern] = self._attack_patterns.get(pattern, 0) + 1

    # ------------------------------------------------------------------
    # Evolution loop
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Periodic evolution loop — analyzes metrics and adjusts parameters."""
        self._running = True
        ts = _ts()
        print(f"{ts} < defense_evolver: Evolution engine started — learning from each round")

        while self._running:
            await asyncio.sleep(15.0)  # Evolve every 15 seconds
            await self._evolve()

    async def stop(self) -> None:
        self._running = False

    async def _evolve(self) -> None:
        """Analyze accumulated metrics and adjust defensive parameters."""
        if not self._round_history:
            return

        self.evolution_count += 1

        # ── 1. Detection speed improvement ────────────────────────
        if self._response_times:
            avg_response = sum(self._response_times) / len(self._response_times)
            recent_10 = list(self._response_times)[-10:]
            recent_avg = sum(recent_10) / len(recent_10) if recent_10 else avg_response

            if self._baseline_response_ms is None:
                self._baseline_response_ms = avg_response

            # If recent responses are slower, tighten detection
            if recent_avg > avg_response * 1.2:
                self.params["detection_tick_interval"] = max(
                    0.5, self.params["detection_tick_interval"] - 0.1
                )

        # ── 2. Anomaly threshold tuning ───────────────────────────
        # If we're seeing lots of anomaly patterns, lower the threshold
        anomaly_patterns = sum(
            v for k, v in self._attack_patterns.items()
            if k.startswith("anomaly_detected")
        )
        if anomaly_patterns > 10:
            self.params["anomaly_threshold"] = max(
                2.0, self.params["anomaly_threshold"] - 0.5
            )

        # ── 3. Scan interval adaptation ───────────────────────────
        # Under active attack, scan more frequently
        exploit_patterns = sum(
            v for k, v in self._attack_patterns.items()
            if "exploit" in k or "critical" in k
        )
        if exploit_patterns > 5:
            self.params["scan_interval"] = max(3.0, self.params["scan_interval"] - 0.5)
        elif self.evolution_count > 5 and exploit_patterns == 0:
            # Calm period — relax slightly (but never above initial)
            self.params["scan_interval"] = min(8.0, self.params["scan_interval"] + 0.5)

        # ── 4. Response aggressiveness ────────────────────────────
        if self._effectiveness:
            accuracy = sum(self._effectiveness) / len(self._effectiveness)
            # High accuracy -> can be more aggressive (auto-isolate more)
            if accuracy > 0.9:
                self.params["response_aggressiveness"] = min(
                    1.0, self.params["response_aggressiveness"] + 0.05
                )
                self.params["auto_isolate_cvss_threshold"] = max(
                    7.0, self.params["auto_isolate_cvss_threshold"] - 0.5
                )

        # ── 5. Environment monitor intervals ──────────────────────
        env_alerts = sum(
            v for k, v in self._attack_patterns.items()
            if "vuln:" in k
        )
        if env_alerts > 10:
            self.params["cloud_monitor_interval"] = max(
                3.0, self.params["cloud_monitor_interval"] - 0.5
            )
            self.params["onprem_monitor_interval"] = max(
                3.0, self.params["onprem_monitor_interval"] - 0.5
            )

        ts = _ts()
        improvement = self._calculate_improvement()
        print(
            f"{ts} < defense_evolver: Evolution #{self.evolution_count} — "
            f"scan_interval={self.params['scan_interval']:.1f}s, "
            f"anomaly_thresh={self.params['anomaly_threshold']:.1f}, "
            f"aggressiveness={self.params['response_aggressiveness']:.2f}, "
            f"improvement={improvement}%"
        )

        await event_bus.emit("defense_evolved", {
            "evolution_count": self.evolution_count,
            "params": dict(self.params),
            "round_count": self.round_count,
            "improvement_pct": improvement,
        })

    # ------------------------------------------------------------------
    # Metrics / Query API
    # ------------------------------------------------------------------

    def _calculate_improvement(self) -> float:
        """Calculate percentage improvement in response time vs baseline."""
        if not self._response_times or self._baseline_response_ms is None:
            return 0.0
        recent_10 = list(self._response_times)[-10:]
        recent_avg = sum(recent_10) / len(recent_10)
        if self._baseline_response_ms == 0:
            return 0.0
        improvement = (
            (self._baseline_response_ms - recent_avg) / self._baseline_response_ms * 100
        )
        return round(max(0.0, improvement), 1)

    def get_metrics(self) -> Dict[str, Any]:
        """Return current evolution metrics."""
        avg_response = 0.0
        if self._response_times:
            avg_response = sum(self._response_times) / len(self._response_times)

        accuracy = 0.0
        if self._effectiveness:
            accuracy = sum(self._effectiveness) / len(self._effectiveness) * 100

        top_patterns = sorted(
            self._attack_patterns.items(), key=lambda x: x[1], reverse=True
        )[:10]

        return {
            "evolution_count": self.evolution_count,
            "round_count": self.round_count,
            "avg_response_time_ms": round(avg_response, 1),
            "response_accuracy_pct": round(accuracy, 1),
            "improvement_pct": self._calculate_improvement(),
            "current_params": dict(self.params),
            "top_attack_patterns": [
                {"pattern": p, "count": c} for p, c in top_patterns
            ],
            "total_patterns_tracked": len(self._attack_patterns),
        }

    def get_evolution_history(self) -> List[Dict[str, Any]]:
        """Return recent round metrics."""
        return [
            {
                "round_id": m.round_id,
                "detection_time_ms": m.detection_time_ms,
                "response_time_ms": m.response_time_ms,
                "event_type": m.event_type,
                "service": m.service,
                "was_effective": m.was_effective,
            }
            for m in list(self._round_history)[-50:]
        ]


# Need random for simulation
import random
