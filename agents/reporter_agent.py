import os
from pipeline.state import NeuroMeshState
from datetime import datetime

try:
    from mistralai import Mistral
except Exception:
    Mistral = None

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
client = Mistral(api_key=MISTRAL_API_KEY) if (Mistral and MISTRAL_API_KEY) else None

def build_compact_prompt(state: NeuroMeshState) -> str:
    """
    Build the most token-efficient prompt possible.
    Strip everything the LLM doesn't need.
    The LLM only gets labels and scores — never raw numbers.
    """
    v = state['verifier']
    t = state['triage']
    l = state['logistics']
    node = max(state['raw_nodes'], key=lambda n: n['seismic_magnitude'])
    
    # This prompt is intentionally compact.
    # Every field is a verified ML output — not raw sensor data.
    prompt = f"""NDRF Crisis AI. Generate SITREP from verified intel.

EVENT: Structural collapse, Node {node['node_id']}
GPS: {node['lat']:.4f}, {node['lng']:.4f}
VERIFIED: {v['confidence']:.0%} confidence, {v['correlation_type']} trigger

LIFE INTEL:
- Survivability: {t['survivability_score']}/100
- Persons: ~{t['estimated_persons']} trapped
- Life signs: {t['life_sign_pattern']}
- Urgency: {t['urgency'].upper()}
- Golden hour remaining: {t['golden_hour_remaining']:.0f} min

HAZARD:
- Gas: {t['gas_threat']} ({t['gas_note']})
- Entry protocol: {t['entry_protocol'].upper()}

LOGISTICS:
- ETA: {l['estimated_eta_minutes']} min
- Exclusion zone: {l['exclusion_radius_m']}m radius
- Team size needed: {t['recommended_team_size']}

Generate SITREP (under 120 words):
1. CODE [GREEN/YELLOW/ORANGE/RED/BLACK]
2. SITUATION: (1 sentence)
3. SURVIVORS: (1 sentence)
4. HAZARDS: (1 sentence)
5. ACTION: (2-3 bullet points, numbered)
6. TIME: (deadline + consequence)"""

    return prompt

def determine_threat_level(triage, verifier) -> str:
    """Rule-based threat level. NO LLM."""
    score = triage['survivability_score']
    gas = triage['gas_threat']
    conf = verifier['confidence']
    
    if conf < 0.5:
        return "GREEN"
    elif score >= 80 and gas == "lethal":
        return "BLACK"   # mass casualty + toxic
    elif score >= 70 or gas == "lethal":
        return "RED"
    elif score >= 50 or gas == "warning":
        return "ORANGE"
    elif score >= 30:
        return "YELLOW"
    else:
        return "GREEN"


def build_fallback_sitrep(state: NeuroMeshState, threat_level: str) -> str:
    """Generate a deterministic SITREP when LLM is unavailable."""
    node = max(state['raw_nodes'], key=lambda n: n['seismic_magnitude'])
    triage = state['triage']
    logistics = state['logistics']
    return (
        f"1. CODE {threat_level}\n"
        f"2. SITUATION: Structural collapse detected at node {node['node_id']} near "
        f"{node['lat']:.4f}, {node['lng']:.4f}.\n"
        f"3. SURVIVORS: Estimated {triage['estimated_persons']} survivors with "
        f"{triage['life_sign_pattern']} life signs.\n"
        f"4. HAZARDS: Gas threat is {triage['gas_threat']} and entry protocol is "
        f"{triage['entry_protocol']}.\n"
        f"5. ACTION: 1) Dispatch {triage['recommended_team_size']} responders. "
        f"2) Stage at assembly point and use primary route. "
        f"3) Respect {logistics['exclusion_radius_m']}m exclusion zone.\n"
        f"6. TIME: Initiate rescue within {triage['time_sensitivity_minutes']} minutes "
        f"or survivability will decline."
    )

def reporter_agent(state: NeuroMeshState) -> NeuroMeshState:
    """
    Agent 4: The Reporter
    ONE LLM CALL with compact verified input.
    Generates human-readable SITREP for NDRF commanders.
    """
    log = state.get('processing_log', [])
    log.append(f"[{datetime.now().strftime('%H:%M:%S')}] REPORTER: Generating SITREP...")
    
    # Threat level from rules (NOT LLM)
    threat_level = determine_threat_level(state['triage'], state['verifier'])
    
    # Severity score from rules (NOT LLM)
    severity_score = state['triage']['survivability_score']
    
    # Only one LLM call — with compact, token-efficient prompt
    prompt = build_compact_prompt(state)

    if client is None:
        sitrep_text = build_fallback_sitrep(state, threat_level)
        log.append(f"[{datetime.now().strftime('%H:%M:%S')}] REPORTER: No MISTRAL_API_KEY found, used fallback SITREP")
    else:
        try:
            response = client.chat.complete(
                model="mistral-small-latest",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=250   # Hard cap on tokens
            )
            sitrep_text = response.choices[0].message.content
        except Exception as err:
            sitrep_text = build_fallback_sitrep(state, threat_level)
            log.append(f"[{datetime.now().strftime('%H:%M:%S')}] REPORTER: LLM call failed ({type(err).__name__}), used fallback SITREP")
    
    # Headline from rules (NOT LLM)
    node = max(state['raw_nodes'], key=lambda n: n['seismic_magnitude'])
    headline = (f"CODE {threat_level}: Structural collapse at Node {node['node_id']} — "
                f"{state['triage']['estimated_persons']} survivors — "
                f"{state['triage']['urgency'].upper()} response")
    
    sitrep_output = {
        "threat_level": threat_level,
        "severity_score": severity_score,
        "headline": headline,
        "full_sitrep": sitrep_text,
        "recommended_team_size": state['triage']['recommended_team_size'],
        "equipment_checklist": state['triage']['equipment_checklist'],
        "time_sensitivity_minutes": state['triage']['time_sensitivity_minutes']
    }
    
    log.append(f"[{datetime.now().strftime('%H:%M:%S')}] REPORTER: SITREP generated — {threat_level} — {severity_score}/100")
    
    return {
        **state,
        "sitrep": sitrep_output,
        "pipeline_status": "complete",
        "processing_log": log
    }
