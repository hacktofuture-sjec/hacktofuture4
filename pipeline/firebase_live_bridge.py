import argparse
import json
import os
import time
from datetime import UTC, datetime
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pipeline.graph import run_neuromesh_pipeline


# Real-time trigger thresholds aligned with ESP32 sketch.
ACC_THRESHOLD = 0.25
GAS_THRESHOLD = 2000
EARTHQUAKE_DURATION_MS = 10_000


class FirebaseLiveBridge:
    def __init__(
        self,
        database_url: str,
        firebase_path: str,
        dashboard_url: Optional[str],
        poll_seconds: float,
        node_id: str,
        lat: float,
        lng: float,
        address: str,
    ) -> None:
        self.database_url = database_url.rstrip('/')
        self.firebase_path = firebase_path.strip('/')
        self.dashboard_url = dashboard_url.rstrip('/') if dashboard_url else None
        self.poll_seconds = poll_seconds
        self.node_id = node_id
        self.lat = lat
        self.lng = lng
        self.address = address

        self.last_timestamp: Optional[str] = None
        self.earthquake_start_ms: Optional[int] = None

    def _firebase_endpoint(self) -> str:
        return f"{self.database_url}/{self.firebase_path}.json"

    def _firebase_inference_endpoint(self) -> str:
        return f"{self.database_url}/inference/{self.node_id}.json"

    def _http_json(self, url: str, method: str = 'GET', payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        data = None
        headers = {}

        if payload is not None:
            data = json.dumps(payload).encode('utf-8')
            headers['Content-Type'] = 'application/json'

        request = Request(url=url, data=data, headers=headers, method=method)
        with urlopen(request, timeout=12) as response:
            raw = response.read().decode('utf-8')
            if not raw:
                return {}
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}

    def fetch_latest(self) -> Optional[Dict[str, Any]]:
        try:
            payload = self._http_json(self._firebase_endpoint())
            if not payload:
                return None
            return payload
        except (URLError, HTTPError, TimeoutError) as err:
            print(f"[Firebase] fetch failed: {err}")
            return None

    def _to_float(self, value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _to_int(self, value: Any, default: int = 0) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    def _is_new_record(self, node_payload: Dict[str, Any]) -> bool:
        timestamp = str(node_payload.get('timestamp', ''))
        if not timestamp:
            return True
        if timestamp == self.last_timestamp:
            return False
        self.last_timestamp = timestamp
        return True

    def _compute_event_state(self, acc: float) -> Dict[str, Any]:
        quake = abs(acc - 1.0) > ACC_THRESHOLD
        now_ms = int(time.time() * 1000)

        if quake:
            self.earthquake_start_ms = now_ms

        earthquake_active = False
        event_duration_ms = 200

        if self.earthquake_start_ms is not None:
            elapsed = now_ms - self.earthquake_start_ms
            earthquake_active = elapsed <= EARTHQUAKE_DURATION_MS
            if earthquake_active:
                event_duration_ms = max(250, elapsed)

        return {
            'quake': quake,
            'earthquake_active': earthquake_active,
            'event_duration_ms': event_duration_ms,
        }

    def _make_node_report(self, node_payload: Dict[str, Any]) -> Dict[str, Any]:
        acc = self._to_float(node_payload.get('acceleration'), 1.0)
        gas = self._to_float(node_payload.get('gas'), 0.0)
        motion = self._to_int(node_payload.get('motion'), 0)

        event_state = self._compute_event_state(acc)
        seismic_magnitude = abs(acc - 1.0) * 20.0

        return {
            'node_id': self.node_id,
            'lat': self.lat,
            'lng': self.lng,
            'seismic_magnitude': round(seismic_magnitude, 3),
            'gas_ppm': gas,
            'pir_count': 2 if motion > 0 else 0,
            'event_duration_ms': event_state['event_duration_ms'],
            'timestamp': datetime.now(UTC).isoformat(),
        }

    def _post_dashboard_telemetry(self, node_payload: Dict[str, Any]) -> None:
        if not self.dashboard_url:
            return

        acc = self._to_float(node_payload.get('acceleration'), 1.0)
        event_state = self._compute_event_state(acc)

        body = {
            'node_id': self.node_id,
            'lat': self.lat,
            'lng': self.lng,
            'address': self.address,
            'acceleration_g': acc,
            'gas_raw': self._to_int(node_payload.get('gas'), 0),
            'motion': self._to_int(node_payload.get('motion'), 0) > 0,
            'temp_c': self._to_float(node_payload.get('temperature'), 0.0),
            'humidity': self._to_float(node_payload.get('humidity'), 0.0),
            'timestamp': datetime.now(UTC).isoformat(),
            'aiSitrep': node_payload.get('aiSitrep'),
            'aiThreatLevel': node_payload.get('aiThreatLevel'),
            'sensor_alert': str(node_payload.get('alert', 'SAFE')),
            'sensor_sub_alert': str(node_payload.get('subAlert', '')),
            'earthquake_active': event_state['earthquake_active'],
            'event_duration_ms': event_state['event_duration_ms'],
            'sensor_timestamp': self._to_int(node_payload.get('timestamp'), 0),
        }

        api_url = f"{self.dashboard_url}/api/telemetry"
        try:
            self._http_json(api_url, method='POST', payload=body)
        except (URLError, HTTPError, TimeoutError) as err:
            print(f"[Dashboard] POST failed: {err}")

    def _write_inference(self, result: Dict[str, Any]) -> None:
        summary = {
            'updatedAt': datetime.now(UTC).isoformat(),
            'pipelineStatus': result.get('pipeline_status'),
            'abortReason': result.get('abort_reason'),
        }

        sitrep = result.get('sitrep')
        if sitrep:
            summary.update(
                {
                    'threatLevel': sitrep.get('threat_level'),
                    'severityScore': sitrep.get('severity_score'),
                    'headline': sitrep.get('headline'),
                    'fullSitrep': sitrep.get('full_sitrep'),
                }
            )

        try:
            self._http_json(self._firebase_inference_endpoint(), method='PUT', payload=summary)
        except (URLError, HTTPError, TimeoutError) as err:
            print(f"[Firebase] inference write failed: {err}")

    def process_once(self) -> bool:
        node_payload = self.fetch_latest()
        if not node_payload:
            return False

        # ALWAYS post live telemetry to the dashboard so UI stays in real-time sync with Firebase
        self._post_dashboard_telemetry(node_payload)

        # But only run the heavy AI pipeline if the hardware transmitted a genuinely new frame
        if not self._is_new_record(node_payload):
            return False

        node_report = self._make_node_report(node_payload)
        result = run_neuromesh_pipeline([node_report])
        
        # Inject AI SITREP into payload for Dashboard
        if result.get('pipeline_status') != 'aborted':
            sitrep = result.get('sitrep', {})
            if sitrep:
                node_payload['aiSitrep'] = sitrep.get('full_sitrep')
                node_payload['aiThreatLevel'] = sitrep.get('threat_level')

        self._post_dashboard_telemetry(node_payload)
        self._write_inference(result)

        if result.get('pipeline_status') == 'aborted':
            print(f"[Pipeline] false alarm: {result.get('abort_reason')}")
        else:
            sitrep = result.get('sitrep', {})
            print(f"[Pipeline] {sitrep.get('threat_level')} | {sitrep.get('headline')}")

        return True

    def run(self) -> None:
        print('[Bridge] Firebase live bridge started')
        print(f"[Bridge] Source: {self._firebase_endpoint()}")
        if self.dashboard_url:
            print(f"[Bridge] Dashboard: {self.dashboard_url}/api/telemetry")

        while True:
            self.process_once()
            time.sleep(self.poll_seconds)


def build_bridge_from_env(args: argparse.Namespace) -> FirebaseLiveBridge:
    database_url = args.database_url or os.getenv('FIREBASE_DATABASE_URL', '')
    if not database_url:
        raise ValueError('Missing Firebase database URL. Set --database-url or FIREBASE_DATABASE_URL.')

    return FirebaseLiveBridge(
        database_url=database_url,
        firebase_path=args.firebase_path,
        dashboard_url=args.dashboard_url,
        poll_seconds=args.poll_seconds,
        node_id=args.node_id,
        lat=args.lat,
        lng=args.lng,
        address=args.address,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Stream Firebase RTDB sensor data into NeuroMesh pipeline.')
    parser.add_argument('--database-url', default='', help='Firebase RTDB URL.')
    parser.add_argument('--firebase-path', default='node1', help='RTDB path for sensor node payload.')
    parser.add_argument('--dashboard-url', default='http://localhost:3000', help='Dashboard base URL.')
    parser.add_argument('--poll-seconds', type=float, default=2.0, help='Polling interval seconds.')
    parser.add_argument('--node-id', default='NM-01', help='Logical node id used in model pipeline.')
    parser.add_argument('--lat', type=float, default=12.9141, help='Node latitude.')
    parser.add_argument('--lng', type=float, default=74.8560, help='Node longitude.')
    parser.add_argument('--address', default='Hampankatta Zone A', help='Node address label.')
    parser.add_argument('--once', action='store_true', help='Process one record and exit.')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    bridge = build_bridge_from_env(args)

    if args.once:
        bridge.process_once()
        return

    bridge.run()


if __name__ == '__main__':
    main()
