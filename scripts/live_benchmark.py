import json
import time
from pathlib import Path

import httpx
from dotenv import dotenv_values

root = Path('/Volumes/LocalDrive/hacktofuture4-D07')
env = dotenv_values(root / '.env')

base_url = 'http://127.0.0.1:8000/api'
repo = (env.get('GITHUB_REPOSITORY') or 'F4tal1t/Poxil').strip()
issue_num = int((env.get('GITHUB_ISSUE_NUMBER') or '1').strip())
confluence_page = (env.get('CONFLUENCE_PAGE_ID') or '65868').strip()
slack_channel = (env.get('SLACK_CHANNEL_ID') or 'C12345678').strip()
slack_thread = (env.get('SLACK_THREAD_TS') or '1712345678.123456').strip()
jira_key = (env.get('JIRA_ISSUE_KEY') or 'KAN-49').strip()

results = []


def record(name, start, response, extra=None):
    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    item = {
        'endpoint': name,
        'status_code': response.status_code,
        'latency_ms': elapsed_ms,
    }
    if extra is not None:
        item['details'] = extra
    results.append(item)


with httpx.Client(timeout=60.0) as client:
    start = time.perf_counter()
    r = client.post(f"{base_url}/ingest/confluence", json={'page_ids': [confluence_page]})
    body = r.json() if r.headers.get('content-type', '').startswith('application/json') else {'raw': r.text[:300]}
    first = (body.get('results') or [{}])[0] if isinstance(body, dict) else {}
    record(
        'POST /ingest/confluence',
        start,
        r,
        {
            'ingested_count': body.get('ingested_count') if isinstance(body, dict) else None,
            'failed_count': body.get('failed_count') if isinstance(body, dict) else None,
            'first_result_status': first.get('status'),
            'first_error': first.get('error'),
        },
    )

    start = time.perf_counter()
    r = client.post(f"{base_url}/ingest/github", json={'issue_refs': [{'repository': repo, 'issue_number': issue_num}]})
    body = r.json() if r.headers.get('content-type', '').startswith('application/json') else {'raw': r.text[:300]}
    first = (body.get('results') or [{}])[0] if isinstance(body, dict) else {}
    record(
        'POST /ingest/github',
        start,
        r,
        {
            'ingested_count': body.get('ingested_count') if isinstance(body, dict) else None,
            'failed_count': body.get('failed_count') if isinstance(body, dict) else None,
            'first_result_status': first.get('status'),
            'first_error': first.get('error'),
        },
    )

    start = time.perf_counter()
    r = client.post(f"{base_url}/ingest/jira", json={'issue_keys': [jira_key]})
    body = r.json() if r.headers.get('content-type', '').startswith('application/json') else {'raw': r.text[:300]}
    first = (body.get('results') or [{}])[0] if isinstance(body, dict) else {}
    record(
        'POST /ingest/jira',
        start,
        r,
        {
            'ingested_count': body.get('ingested_count') if isinstance(body, dict) else None,
            'failed_count': body.get('failed_count') if isinstance(body, dict) else None,
            'first_result_status': first.get('status'),
            'first_error': first.get('error'),
        },
    )

    start = time.perf_counter()
    r = client.post(f"{base_url}/ingest/slack/channels", json={'channels': [{'channel_id': slack_channel, 'limit': 10}]})
    body = r.json() if r.headers.get('content-type', '').startswith('application/json') else {'raw': r.text[:300]}
    first = (body.get('results') or [{}])[0] if isinstance(body, dict) else {}
    record(
        'POST /ingest/slack/channels',
        start,
        r,
        {
            'ingested_count': body.get('ingested_count') if isinstance(body, dict) else None,
            'failed_count': body.get('failed_count') if isinstance(body, dict) else None,
            'first_result_status': first.get('status'),
            'first_error': first.get('error'),
        },
    )

    start = time.perf_counter()
    r = client.post(
        f"{base_url}/ingest/slack/threads",
        json={'threads': [{'channel_id': slack_channel, 'thread_ts': slack_thread, 'limit': 10}]},
    )
    body = r.json() if r.headers.get('content-type', '').startswith('application/json') else {'raw': r.text[:300]}
    first = (body.get('results') or [{}])[0] if isinstance(body, dict) else {}
    record(
        'POST /ingest/slack/threads',
        start,
        r,
        {
            'ingested_count': body.get('ingested_count') if isinstance(body, dict) else None,
            'failed_count': body.get('failed_count') if isinstance(body, dict) else None,
            'first_result_status': first.get('status'),
            'first_error': first.get('error'),
        },
    )

    trace_id = None
    needs_approval = None
    current_event = None
    stream_event_counts = {}
    start = time.perf_counter()
    with client.stream(
        'POST',
        f"{base_url}/chat",
        json={
            'message': 'Service X crashed after deploy with fatal out of memory exception; create incident and collect diagnostics',
            'session_id': f'live-{int(time.time())}',
        },
    ) as stream_resp:
        for line in stream_resp.iter_lines():
            if not line:
                continue
            text = line.decode() if isinstance(line, (bytes, bytearray)) else str(line)
            if text.startswith('event:'):
                current_event = text.split('event:', 1)[1].strip()
                stream_event_counts[current_event] = stream_event_counts.get(current_event, 0) + 1
            elif text.startswith('data:') and current_event == 'trace_complete':
                payload = json.loads(text.split('data:', 1)[1].strip())
                if isinstance(payload, dict):
                    trace_id = payload.get('trace_id')
                    needs_approval = payload.get('needs_approval')
    record(
        'POST /chat (SSE)',
        start,
        stream_resp,
        {
            'trace_id': trace_id,
            'needs_approval': needs_approval,
            'event_counts': stream_event_counts,
        },
    )

    if trace_id:
        start = time.perf_counter()
        r = client.post(
            f"{base_url}/approvals/{trace_id}",
            json={
                'decision': 'approve',
                'approver_id': 'demo-runner',
                'comment': 'Live benchmark approval.',
            },
        )
        body = r.json() if r.headers.get('content-type', '').startswith('application/json') else {'raw': r.text[:300]}
        record(
            'POST /approvals/{trace_id}',
            start,
            r,
            {
                'final_status': body.get('final_status') if isinstance(body, dict) else None,
                'execution_status': (body.get('execution_result') or {}).get('status') if isinstance(body, dict) else None,
                'execution_tool': (body.get('execution_result') or {}).get('tool') if isinstance(body, dict) else None,
            },
        )

print(json.dumps(results, indent=2))
