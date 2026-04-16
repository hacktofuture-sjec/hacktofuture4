import statistics
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

calls = [
    ('ingest_confluence', 'POST', f'{base_url}/ingest/confluence', {'page_ids': [confluence_page]}),
    ('ingest_github', 'POST', f'{base_url}/ingest/github', {'issue_refs': [{'repository': repo, 'issue_number': issue_num}]}),
    ('ingest_jira', 'POST', f'{base_url}/ingest/jira', {'issue_keys': [jira_key]}),
    ('ingest_slack_channels', 'POST', f'{base_url}/ingest/slack/channels', {'channels': [{'channel_id': slack_channel, 'limit': 10}]}),
    ('ingest_slack_threads', 'POST', f'{base_url}/ingest/slack/threads', {'threads': [{'channel_id': slack_channel, 'thread_ts': slack_thread, 'limit': 10}]}),
    ('ingest_iris', 'POST', f'{base_url}/ingest/iris?case_id=1', None),
]

summary: dict[str, dict[str, object]] = {name: {'latencies_ms': [], 'status_codes': []} for name, *_ in calls}

with httpx.Client(timeout=60.0) as client:
    for _ in range(3):
        for name, method, url, payload in calls:
            start = time.perf_counter()
            if method == 'POST':
                response = client.post(url, json=payload) if payload is not None else client.post(url)
            else:
                response = client.get(url)
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            summary[name]['latencies_ms'].append(elapsed_ms)
            summary[name]['status_codes'].append(response.status_code)

for name in summary:
    latencies = summary[name]['latencies_ms']
    status_codes = summary[name]['status_codes']
    print(
        {
            'endpoint': name,
            'runs': len(latencies),
            'avg_ms': round(statistics.mean(latencies), 2),
            'min_ms': round(min(latencies), 2),
            'max_ms': round(max(latencies), 2),
            'status_codes': status_codes,
        }
    )
