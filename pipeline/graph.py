import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from langgraph.graph import StateGraph, END
from pipeline.state import NeuroMeshState
from agents.verifier_agent import verifier_agent
from agents.triage_agent import triage_agent
from agents.logistics_agent import logistics_agent
from agents.reporter_agent import reporter_agent
from datetime import datetime
import uuid

# ---- ROUTING LOGIC ----

def should_continue(state: NeuroMeshState) -> str:
    """
    After Verifier runs, decide: continue or abort?
    This is the conditional edge in LangGraph.
    """
    if state['pipeline_status'] == 'aborted':
        return "abort"
    return "continue"

# ---- BUILD THE GRAPH ----

def build_neuromesh_graph():
    graph = StateGraph(NeuroMeshState)
    
    # Add all 4 agent nodes
    graph.add_node("verifier", verifier_agent)
    graph.add_node("triage", triage_agent)
    graph.add_node("logistics", logistics_agent)
    graph.add_node("reporter", reporter_agent)
    
    # Entry point
    graph.set_entry_point("verifier")
    
    # Conditional edge: verifier → triage OR end
    graph.add_conditional_edges(
        "verifier",
        should_continue,
        {
            "continue": "triage",
            "abort": END
        }
    )
    
    # Triage and logistics run in sequence
    graph.add_edge("triage", "logistics")
    graph.add_edge("logistics", "reporter")
    graph.add_edge("reporter", END)
    
    return graph.compile()

# ---- MAIN RUN FUNCTION ----

def run_neuromesh_pipeline(raw_nodes: list) -> dict:
    """
    Main entry point. Call this when LoRa gateway receives sensor data.
    """
    graph = build_neuromesh_graph()
    
    alert_id = str(uuid.uuid4())[:8].upper()

    initial_state = {
        "raw_nodes": raw_nodes,
        "alert_id": alert_id,
        "verifier": None,
        "triage": None,
        "logistics": None,
        "sitrep": None,
        "pipeline_status": "running",
        "abort_reason": None,
        "processing_log": [
            f"[{datetime.now().strftime('%H:%M:%S')}] NEUROMESH PIPELINE STARTED - Alert ID: {alert_id}"
        ]
    }
    
    print("\n" + "="*60)
    print("  NEUROMESH MULTI-AGENT PIPELINE STARTING")
    print("="*60)
    
    final_state = graph.invoke(initial_state)
    
    print("\n📋 PROCESSING LOG:")
    for entry in final_state['processing_log']:
        print(f"  {entry}")
    
    if final_state['pipeline_status'] == 'aborted':
        print(f"\n⚠️  PIPELINE ABORTED: {final_state['abort_reason']}")
        return final_state
    
    print(f"\n🚨 THREAT LEVEL: {final_state['sitrep']['threat_level']}")
    print(f"📍 SEVERITY: {final_state['sitrep']['severity_score']}/100")
    print(f"\n{final_state['sitrep']['full_sitrep']}")
    print("="*60)
    
    return final_state


# ---- TEST IT ----

if __name__ == "__main__":
    import numpy as np
    
    # Simulate 2 nodes both triggering (cluster = genuine event)
    test_nodes = [
        {
            "node_id": "NM-01",
            "lat": 12.9141,
            "lng": 74.8560,
            "seismic_magnitude": 5.2,
            "gas_ppm": 650.0,
            "pir_count": 9,
            "event_duration_ms": 1400,
            "timestamp": datetime.now().isoformat()
        },
        {
            "node_id": "NM-02",
            "lat": 12.9148,
            "lng": 74.8572,
            "seismic_magnitude": 4.8,
            "gas_ppm": 420.0,
            "pir_count": 5,
            "event_duration_ms": 1100,
            "timestamp": datetime.now().isoformat()
        }
    ]
    
    result = run_neuromesh_pipeline(test_nodes)
