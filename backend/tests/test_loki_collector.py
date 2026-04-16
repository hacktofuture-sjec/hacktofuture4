from __future__ import annotations

from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from collectors.loki_collector import LokiCollector


def test_extract_top_signatures_filters_noise_patterns() -> None:
    collector = LokiCollector(base_url="http://localhost:3100")
    lines = [
        "health check",
        "heartbeat",
        "ERROR: ImagePullBackOff while pulling image",
        "timeout exceeded while waiting for db",
    ]

    signatures = collector.extract_top_signatures(lines)
    signature_text = " ".join(str(item.get("signature", "")) for item in signatures).lower()

    assert "health check" not in signature_text
    assert "heartbeat" not in signature_text
    assert "imagepullbackoff" in signature_text
    assert "timeout" in signature_text
