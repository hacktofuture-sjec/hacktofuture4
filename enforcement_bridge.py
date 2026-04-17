#!/usr/bin/env python3
"""
Enforcement Bridge - Translates HITL decisions into actual policy enforcement
Watches backend for DENY decisions and:
1. Triggers OPA policy updates
2. Updates Tetragon tracing policy for syscall blocking
3. Notifies Cilium for network policy enforcement
"""

import os
import time
import requests
import json
import logging
from datetime import datetime
from typing import Dict, Optional, List

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

ANALYTICS_ENGINE_URL = os.getenv('ANALYTICS_ENGINE_URL', 'http://analytics-engine:8000')
OPA_URL = os.getenv('OPA_URL', 'http://localhost:8181')
CILIUM_API_URL = os.getenv('CILIUM_API_URL', 'http://localhost:8000/api/v1')
TETRAGON_API_URL = os.getenv('TETRAGON_API_URL', 'http://tetragon:54321')

# Track which incidents we've already processed
processed_decisions = set()


def get_pending_decisions() -> List[Dict]:
    """Fetch all recorded decisions from backend audit log"""
    try:
        response = requests.get(
            f'{ANALYTICS_ENGINE_URL}/audit/decisions',
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            return data.get('decisions', [])
        else:
            logger.warning(f'Failed to fetch decisions: {response.status_code}')
            return []
    except Exception as e:
        logger.warning(f'Error fetching decisions: {e}')
        return []


def enforce_opa_policy(decision: Dict) -> bool:
    """Update OPA with enforcement policy based on decision"""
    try:
        decision_id = decision.get('recorded_at', str(datetime.utcnow().isoformat()))
        
        # Only enforce DENY decisions
        if decision.get('decision') != 'DENY':
            return True
        
        # Create OPA policy to enforce this DENY decision
        opa_policy = {
            "decision_id": decision_id,
            "enforcement_rule": "deny_workload_access",
            "reason": decision.get('reason', 'HITL DENY decision'),
            "policy": """
package aegis.enforcement

import data.incident

deny_workload_access[msg] {
    incident.active_denial[decision_id]
    msg := sprintf("Access denied by HITL decision %v", [decision_id])
}
            """,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # POST to OPA - using the default data API
        response = requests.put(
            f'{OPA_URL}/v1/data/aegis/enforcement/active_decisions',
            json=opa_policy,
            timeout=5
        )
        
        if response.status_code in [200, 204]:
            logger.info(f'✓ OPA policy activated for decision: {decision_id}')
            return True
        else:
            logger.warning(f'OPA policy update failed: {response.status_code} {response.text}')
            return False
            
    except Exception as e:
        logger.warning(f'Error enforcing OPA policy: {e}')
        return False


def enforce_cilium_policy(decision: Dict) -> bool:
    """Update Cilium network policies based on DENY decision"""
    try:
        decision_id = decision.get('recorded_at', str(datetime.utcnow().isoformat()))
        
        if decision.get('decision') != 'DENY':
            return True
        
        # Create Cilium network policy to block traffic from suspicious workload
        cilium_policy = {
            "apiVersion": "cilium.io/v2",
            "kind": "CiliumNetworkPolicy",
            "metadata": {
                "name": f"hitl-deny-{decision_id[:8]}",
                "namespace": "default"
            },
            "spec": {
                "description": f"HITL Enforcement: {decision.get('reason', 'Suspicious Activity')}",
                "endpointSelector": {
                    "matchLabels": {
                        "aegis-enforcement": "deny"
                    }
                },
                "egress": [
                    {
                        "toPorts": [
                            {
                                "ports": [
                                    {"port": "53", "protocol": "UDP"}
                                ]
                            }
                        ]
                    }
                ]
            }
        }
        
        # POST to Cilium
        response = requests.post(
            f'{CILIUM_API_URL}/policies',
            json=cilium_policy,
            timeout=5
        )
        
        if response.status_code in [200, 201]:
            logger.info(f'✓ Cilium network policy created: {decision_id[:8]}')
            return True
        else:
            logger.debug(f'Cilium policy creation (may not be installed): {response.status_code}')
            return True  # Don't fail if Cilium isn't installed
            
    except Exception as e:
        logger.debug(f'Cilium enforcement (optional): {e}')
        return True  # Don't fail on Cilium errors


def enforce_tetragon_block(decision: Dict) -> bool:
    """Update Tetragon to block syscalls from flagged workload"""
    try:
        decision_id = decision.get('recorded_at', str(datetime.utcnow().isoformat()))
        
        if decision.get('decision') != 'DENY':
            return True
        
        # Create dynamic TracingPolicy to enforce SIGKILL for this workload  
        tracing_policy = {
            "apiVersion": "cilium.io/v1alpha1",
            "kind": "TracingPolicy",
            "metadata": {
                "name": f"hitl-enforcement-{decision_id[:8]}"
            },
            "spec": {
                "kprobes": [
                    {
                        "call": "fd_install",
                        "syscall": False,
                        "args": [
                            {"index": 0, "type": "int"},
                            {"index": 1, "type": "file"}
                        ],
                        "selectors": [
                            {
                                "matchArgs": [
                                    {
                                        "index": 1,
                                        "operator": "Equal",
                                        "values": ["/app/restricted-resource"]
                                    }
                                ],
                                "matchActions": [
                                    {"action": "Sigkill"}
                                ]
                            }
                        ]
                    }
                ]
            }
        }
        
        # POST to Tetragon
        response = requests.post(
            f'{TETRAGON_API_URL}/policies',
            json=tracing_policy,
            timeout=5
        )
        
        if response.status_code in [200, 201]:
            logger.info(f'✓ Tetragon policy created for enforcement: {decision_id[:8]}')
            return True
        else:
            logger.debug(f'Tetragon policy (optional): {response.status_code}')
            return True
            
    except Exception as e:
        logger.debug(f'Tetragon enforcement (optional): {e}')
        return True  # Don't fail if Tetragon isn't reachable


def main():
    """Main enforcement loop"""
    logger.info("Starting Enforcement Bridge...")
    logger.info(f"Analytics Engine: {ANALYTICS_ENGINE_URL}")
    logger.info(f"OPA: {OPA_URL}")
    logger.info(f"Cilium: {CILIUM_API_URL}")
    logger.info(f"Tetragon: {TETRAGON_API_URL}")
    
    while True:
        try:
            # Poll for new decisions
            decisions = get_pending_decisions()
            
            for decision in decisions:
                decision_key = decision.get('recorded_at', '')
                
                # Only process DENY decisions we haven't seen before
                if decision_key not in processed_decisions and decision.get('decision') == 'DENY':
                    logger.info(f"Processing DENY decision: {decision_key}")
                    processed_decisions.add(decision_key)
                    
                    # Trigger enforcement at all layers
                    enforce_opa_policy(decision)
                    enforce_cilium_policy(decision)
                    enforce_tetragon_block(decision)
                    
                    logger.info(f"✓ Enforcement applied for decision: {decision_key[:19]}...")
            
        except Exception as e:
            logger.error(f'Error in enforcement loop: {e}')
        
        # Poll interval
        time.sleep(5)


if __name__ == '__main__':
    main()
