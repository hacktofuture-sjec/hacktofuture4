import numpy as np
import joblib
from pipeline.state import NeuroMeshState
from datetime import datetime

# Load your pre-trained Isolation Forest
try:
    validator_model = joblib.load('models/validator_model.pkl')
except:
    validator_model = None

def run_isolation_forest(node: dict) -> dict:
    """Run anomaly detection on a single node's readings"""
    if validator_model is None:
        # Fallback: simple threshold logic if model not loaded
        is_real = (node['seismic_magnitude'] > 2.0 and 
                   node['event_duration_ms'] > 250)
        return {"is_genuine": is_real, "score": -0.5 if is_real else 0.2}
    
    features = np.array([[
        node['seismic_magnitude'],
        node['gas_ppm'],
        node['pir_count'],
        node['event_duration_ms']
    ]])
    
    score = float(validator_model.score_samples(features)[0])
    prediction = validator_model.predict(features)[0]
    
    model_genuine = prediction == 1

    # Live IoT fallback: allow deterministic escalation for strong single-node evidence.
    # This prevents real strong events from being rejected only because of model drift.
    rule_escalation = (
        (node['seismic_magnitude'] >= 4.5 and node['event_duration_ms'] >= 250) or
        (node['gas_ppm'] >= 2000 and node['event_duration_ms'] >= 250) or
        (node['pir_count'] >= 2 and node['seismic_magnitude'] >= 3.5)
    )

    return {
        "is_genuine": bool(model_genuine or rule_escalation),
        "score": score
    }

def compute_spatial_correlation(nodes: list) -> dict:
    """
    Check if multiple nodes are triggering.
    Real disasters affect multiple nodes in a cluster.
    A single node triggering alone is suspicious.
    """
    triggering_nodes = [
        n for n in nodes 
        if n['seismic_magnitude'] > 2.0
    ]
    
    count = len(triggering_nodes)
    total = len(nodes)
    
    if count == 0:
        return {
            "correlation_type": "none",
            "confidence": 0.0,
            "triggered_count": 0
        }
    elif count == 1:
        return {
            "correlation_type": "single_node",
            "confidence": 0.45,   # suspicious — could be false alarm
            "triggered_count": 1
        }
    elif count == 2:
        return {
            "correlation_type": "pair",
            "confidence": 0.78,
            "triggered_count": 2
        }
    else:
        return {
            "correlation_type": "cluster",
            "confidence": 0.97,   # strong — real event
            "triggered_count": count
        }

def magnitude_cross_check(nodes: list) -> bool:
    """
    Real earthquakes/collapses show correlated magnitude
    across nearby nodes. Random false alarms don't.
    """
    magnitudes = [n['seismic_magnitude'] for n in nodes if n['seismic_magnitude'] > 0.5]
    if len(magnitudes) < 2:
        return True  # can't cross-check with one node
    
    # Standard deviation of magnitudes across nodes
    # Real events: low std (all nodes feel similar shaking)
    # False alarms: high std (one node spikes, others don't)
    std = np.std(magnitudes)
    return std < 2.5  # correlated if std < 2.5G

def verifier_agent(state: NeuroMeshState) -> NeuroMeshState:
    """
    Agent 1: The Verifier
    NO LLM CALLS. Pure ML + statistical logic.
    Determines if the event is genuine before anything else runs.
    """
    log = state.get('processing_log', [])
    log.append(f"[{datetime.now().strftime('%H:%M:%S')}] VERIFIER: Starting analysis on {len(state['raw_nodes'])} nodes")
    
    nodes = state['raw_nodes']
    
    # Step 1: Run Isolation Forest on each node
    node_results = []
    for node in nodes:
        result = run_isolation_forest(node)
        node_results.append({
            "node_id": node['node_id'],
            "is_genuine": result['is_genuine'],
            "score": result['score'],
            "magnitude": node['seismic_magnitude']
        })
    
    genuine_nodes = [n for n in node_results if n['is_genuine']]
    
    # Step 2: Spatial correlation
    spatial = compute_spatial_correlation(nodes)
    
    # Step 3: Magnitude cross-check
    correlated = magnitude_cross_check(nodes)
    
    # Step 4: Final decision logic (NO LLM — pure rules)
    triggered_node_ids = [n['node_id'] for n in genuine_nodes]
    
    # Decision matrix
    if len(genuine_nodes) == 0:
        is_genuine = False
        confidence = 0.05
        rejection_reason = "All nodes failed Isolation Forest check — false alarm"
    elif len(genuine_nodes) >= 2 and correlated:
        is_genuine = True
        confidence = min(0.99, spatial['confidence'] + 0.1)
        rejection_reason = None
    elif len(genuine_nodes) == 1 and (
        nodes[0]['seismic_magnitude'] > 4.5 or
        nodes[0]['gas_ppm'] >= 2000 or
        nodes[0]['pir_count'] >= 2
    ):
        # Single node but very high magnitude — escalate anyway
        is_genuine = True
        confidence = 0.72
        rejection_reason = None
    elif len(genuine_nodes) == 1:
        is_genuine = False
        confidence = 0.35
        rejection_reason = "Single node trigger with moderate magnitude — possible false alarm. Monitor."
    else:
        is_genuine = True
        confidence = spatial['confidence']
        rejection_reason = None
    
    verifier_output = {
        "is_genuine": is_genuine,
        "confidence": round(confidence, 2),
        "triggered_nodes": triggered_node_ids,
        "correlation_type": spatial['correlation_type'],
        "rejection_reason": rejection_reason
    }
    
    log.append(f"[{datetime.now().strftime('%H:%M:%S')}] VERIFIER: {'GENUINE EVENT' if is_genuine else 'FALSE ALARM'} — confidence {confidence:.0%} — {spatial['correlation_type']}")
    
    if not is_genuine:
        return {
            **state,
            "verifier": verifier_output,
            "pipeline_status": "aborted",
            "abort_reason": rejection_reason,
            "processing_log": log
        }
    
    return {
        **state,
        "verifier": verifier_output,
        "pipeline_status": "running",
        "processing_log": log
    }