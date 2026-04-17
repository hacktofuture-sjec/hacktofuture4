#!/usr/bin/env python3
"""
Tetragon Event Processor - Consumes real eBPF events and creates backend incidents
Listens to Tetragon events from Parseable log stream and generates HITL incidents
when suspicious patterns are detected.
"""

import os
import time
import requests
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

PARSEABLE_URL = os.getenv('PARSEABLE_URL', 'http://parseable:8000')
PARSEABLE_USERNAME = os.getenv('PARSEABLE_USERNAME', 'admin')
PARSEABLE_PASSWORD = os.getenv('PARSEABLE_PASSWORD', 'admin')
ANALYTICS_ENGINE_URL = os.getenv('ANALYTICS_ENGINE_URL', 'http://analytics-engine:8000')

# Rule patterns that trigger incidents
INCIDENT_RULES = [
    {
        'name': 'RESTRICTED_FILE_ACCESS',
        'pattern': r'sys_openat.*\/restricted',
        'severity': 'HIGH',
        'description': 'Attempt to access restricted resource'
    },
    {
        'name': 'PRIVILEGE_ESCALATION',
        'pattern': r'sys_execve.*setuid|sys_execve.*sudo',
        'severity': 'CRITICAL',
        'description': 'Potential privilege escalation attempt'
    },
    {
        'name': 'UNAUTHORIZED_NETWORK',
        'pattern': r'sys_connect.*dst not in.*443',
        'severity': 'HIGH',
        'description': 'Unauthorized network connection attempt'
    },
    {
        'name': 'SYSTEM_CALL_ANOMALY',
        'pattern': r'sys_write.*\/etc\/|sys_write.*\/sys\/',
        'severity': 'CRITICAL',
        'description': 'Suspicious write to system directories'
    }
]


def poll_tetragon_events() -> List[Dict]:
    """Poll Parseable for recent Tetragon events"""
    try:
        # Query Parseable log stream for recent tetragon events
        query = '''
        SELECT * FROM tetragon 
        WHERE timestamp > now() - interval '5 seconds'
        ORDER BY timestamp DESC
        LIMIT 100
        '''
        
        auth = (PARSEABLE_USERNAME, PARSEABLE_PASSWORD)
        headers = {'Content-Type': 'application/json'}
        
        response = requests.post(
            f'{PARSEABLE_URL}/api/v1/query',
            json={'query': query},
            auth=auth,
            headers=headers,
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get('records', []) if isinstance(data, dict) else []
        else:
            logger.warning(f'Parseable query failed: {response.status_code}')
            return []
            
    except Exception as e:
        logger.warning(f'Error polling Tetragon events: {e}')
        return []


def check_incident_rules(event: Dict) -> Optional[Dict]:
    """Check if an event matches any incident rules"""
    event_str = json.dumps(event).lower()
    
    for rule in INCIDENT_RULES:
        import re
        if re.search(rule['pattern'].lower(), event_str):
            return {
                'rule_name': rule['name'],
                'severity': rule['severity'],
                'description': rule['description'],
                'matched_pattern': rule['pattern']
            }
    
    return None


def create_backend_incident(rule_match: Dict, event: Dict) -> bool:
    """Create an incident in the backend analytics engine"""
    try:
        import uuid
        
        incident_payload = {
            'id': str(uuid.uuid4()),
            'detected_at': datetime.utcnow().isoformat(),
            'severity': rule_match['severity'],
            'description': f"{rule_match['description']} - Rule: {rule_match['rule_name']}"
        }
        
        response = requests.post(
            f'{ANALYTICS_ENGINE_URL}/incidents/create',
            json=incident_payload,
            timeout=5
        )
        
        if response.status_code == 200:
            logger.info(f"✓ Incident created: {incident_payload['id']} - {rule_match['description']}")
            return True
        else:
            logger.error(f"Failed to create incident: {response.status_code} {response.text}")
            return False
            
    except Exception as e:
        logger.error(f'Error creating incident: {e}')
        return False


def main():
    """Main polling loop"""
    logger.info("Starting Tetragon Event Processor...")
    logger.info(f"Parseable: {PARSEABLE_URL}")
    logger.info(f"Analytics Engine: {ANALYTICS_ENGINE_URL}")
    
    processed_events = set()
    
    while True:
        try:
            # Poll for new events
            events = poll_tetragon_events()
            
            if events:
                logger.info(f"Polled {len(events)} events from Parseable")
                
                for event in events:
                    # Use a simple hash to avoid reprocessing
                    event_key = json.dumps(event, sort_keys=True, default=str)
                    event_hash = hash(event_key)
                    
                    if event_hash not in processed_events:
                        processed_events.add(event_hash)
                        
                        # Check if event matches incident rules
                        rule_match = check_incident_rules(event)
                        if rule_match:
                            logger.info(f"Rule matched: {rule_match['rule_name']}")
                            create_backend_incident(rule_match, event)
                        
                        # Keep processed events set bounded
                        if len(processed_events) > 1000:
                            processed_events = set(list(processed_events)[-500:])
            
        except Exception as e:
            logger.error(f'Error in main loop: {e}')
        
        # Poll interval
        time.sleep(5)


if __name__ == '__main__':
    main()
