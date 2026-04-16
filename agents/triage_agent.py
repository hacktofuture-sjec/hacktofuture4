import numpy as np
import joblib
from pipeline.state import NeuroMeshState
from datetime import datetime

try:
    survivor_model = joblib.load('models/survivor_model.pkl')
    survivor_scaler = joblib.load('models/survivor_scaler.pkl')
    gas_model = joblib.load('models/gas_model.pkl')
except:
    survivor_model = None
    gas_model = None

GAS_LABELS = ['safe', 'LPG_leak', 'smoke_fire']

def classify_life_signs(pir_count: int, gas_ppm: float, 
                         time_since_mins: float, magnitude: float) -> dict:
    """
    Pattern recognition for life signs.
    Maps sensor combos to biological states.
    NO LLM — pure ML + lookup table.
    """
    
    # Survivor probability from ML model
    if survivor_model:
        features = np.array([[pir_count, time_since_mins, magnitude]])
        features_scaled = survivor_scaler.transform(features)
        prob = float(survivor_model.predict_proba(features_scaled)[0][1])
    else:
        # Fallback heuristic
        prob = min(0.95, (pir_count * 0.08) + max(0, 0.8 - time_since_mins * 0.01))
    
    # Pattern matching logic
    # Each combo maps to a specific biological state
    if pir_count >= 8 and gas_ppm < 200:
        pattern = "active"              # survivors moving, air breathable
        estimated = f"{max(2, pir_count // 3)}-{max(3, pir_count // 2)}"
    elif pir_count >= 4 and gas_ppm < 400:
        pattern = "active"
        estimated = "2-4"
    elif pir_count >= 2 and gas_ppm >= 400:
        pattern = "weakening"           # survivors present but toxic air
        estimated = "1-3"
    elif pir_count == 1:
        pattern = "critical"            # faint movement, single survivor
        estimated = "1"
    elif pir_count == 0 and magnitude > 4.0:
        pattern = "none"               # either no survivors or deeply buried
        estimated = "0 (possible deeply buried)"
    else:
        pattern = "weakening"
        estimated = "1-2"
    
    # Estimate count from probability
    if prob > 0.85:
        score = int(70 + prob * 30)
    elif prob > 0.6:
        score = int(40 + prob * 40)
    else:
        score = int(prob * 40)
    
    return {
        "survivor_probability": round(prob, 2),
        "survivability_score": score,
        "life_sign_pattern": pattern,
        "estimated_persons": estimated
    }

def classify_gas_threat(gas_ppm: float, seismic_flag: int) -> dict:
    """
    Gas threat classification using ML model.
    Maps to entry protocol.
    """
    if gas_model:
        # Create a 30-reading array (simulate steady state at current PPM)
        ppm_readings = np.linspace(max(50, gas_ppm * 0.3), gas_ppm, 30)
        features = list(ppm_readings) + [seismic_flag]
        features = np.array(features).reshape(1, -1)
        probs = gas_model.predict_proba(features)[0]
        gas_class = GAS_LABELS[np.argmax(probs)]
    else:
        if gas_ppm > 500:
            gas_class = 'LPG_leak'
        elif gas_ppm > 300:
            gas_class = 'smoke_fire'
        else:
            gas_class = 'safe'
    
    # Map gas class + PPM to threat level and entry protocol
    if gas_class == 'LPG_leak' or gas_ppm > 600:
        return {
            "gas_threat": "lethal",
            "gas_type": gas_class,
            "entry_protocol": "hazmat",
            "note": "NO ENTRY without full SCBA. Explosion risk. Isolate utilities."
        }
    elif gas_class == 'smoke_fire' or gas_ppm > 250:
        return {
            "gas_threat": "warning",
            "gas_type": gas_class,
            "entry_protocol": "breathing_apparatus",
            "note": "Breathing apparatus mandatory. Fire suppression on standby."
        }
    else:
        return {
            "gas_threat": "clear",
            "gas_type": "safe",
            "entry_protocol": "standard",
            "note": "Air quality acceptable. Standard entry procedure."
        }

def determine_urgency(survivability_score: float, 
                       gas_threat: str, 
                       time_since_mins: float) -> dict:
    """
    Urgency scoring. Maps to time window and team size.
    Golden Hour logic built in.
    """
    # Base urgency from survivability
    if survivability_score >= 80 and gas_threat == "lethal":
        urgency = "extreme"
        time_window = 15   # minutes before situation degrades
        team_size = 12
    elif survivability_score >= 70:
        urgency = "immediate"
        time_window = 30
        team_size = 8
    elif survivability_score >= 50:
        urgency = "high"
        time_window = 60
        team_size = 6
    elif survivability_score >= 30:
        urgency = "moderate"
        time_window = 120
        team_size = 4
    else:
        urgency = "low"
        time_window = 240
        team_size = 2
    
    # Degrade urgency if too much time has passed (Golden Hour)
    golden_hour_factor = max(0, 1 - (time_since_mins / 60))
    adjusted_score = survivability_score * golden_hour_factor
    
    return {
        "urgency": urgency,
        "time_sensitivity_minutes": time_window,
        "recommended_team_size": team_size,
        "golden_hour_remaining": max(0, 60 - time_since_mins),
        "adjusted_survivability": round(adjusted_score, 1)
    }

def build_equipment_checklist(entry_protocol: str, 
                               life_pattern: str,
                               estimated_persons: str) -> list:
    """Rule-based equipment checklist. No LLM needed."""
    checklist = ["Radio comms (LoRa backup)", "GPS tracker", "First aid kit"]
    
    if entry_protocol == "hazmat":
        checklist += ["Full SCBA breathing apparatus", "Gas detector (multi-sensor)", 
                       "Blast shields", "Hazmat suits", "Fire suppression foam"]
    elif entry_protocol == "breathing_apparatus":
        checklist += ["Breathing apparatus (each member)", "Smoke hood backup",
                       "Fire extinguisher"]
    
    if life_pattern in ["active", "weakening"]:
        checklist += ["Rescue stretchers", "Cervical collars", 
                       "Thermal blankets", "IV fluid kits"]
    
    if "5+" in estimated_persons or "3-5" in estimated_persons:
        checklist += ["Mass casualty triage tags", "Additional stretchers x4",
                       "Oxygen cylinders x6"]
    
    checklist += ["Hydraulic spreader (Jaws of Life)", "Search torch", 
                  "Victim voice amplifier", "Thermal imaging camera"]
    
    return checklist

def triage_agent(state: NeuroMeshState) -> NeuroMeshState:
    """
    Agent 2: The Triage Medic
    ZERO LLM CALLS. Pure ML + pattern matching.
    Outputs survivability score, life signs, gas threat, protocol.
    """
    log = state.get('processing_log', [])
    
    # Use worst-case node (highest magnitude + most activity)
    nodes = state['raw_nodes']
    primary = max(nodes, key=lambda n: n['seismic_magnitude'])
    
    log.append(f"[{datetime.now().strftime('%H:%M:%S')}] TRIAGE: Analysing primary node {primary['node_id']}")
    
    time_since = 5.0  # assume 5 minutes since event for demo; in prod use timestamp diff
    
    # Run ML sub-models
    life_data = classify_life_signs(
        pir_count=primary['pir_count'],
        gas_ppm=primary['gas_ppm'],
        time_since_mins=time_since,
        magnitude=primary['seismic_magnitude']
    )
    
    gas_data = classify_gas_threat(
        gas_ppm=primary['gas_ppm'],
        seismic_flag=1
    )
    
    urgency_data = determine_urgency(
        survivability_score=life_data['survivability_score'],
        gas_threat=gas_data['gas_threat'],
        time_since_mins=time_since
    )
    
    equipment = build_equipment_checklist(
        entry_protocol=gas_data['entry_protocol'],
        life_pattern=life_data['life_sign_pattern'],
        estimated_persons=life_data['estimated_persons']
    )
    
    triage_output = {
        "survivability_score": life_data['survivability_score'],
        "estimated_persons": life_data['estimated_persons'],
        "life_sign_pattern": life_data['life_sign_pattern'],
        "gas_threat": gas_data['gas_threat'],
        "entry_protocol": gas_data['entry_protocol'],
        "urgency": urgency_data['urgency'],
        "time_sensitivity_minutes": urgency_data['time_sensitivity_minutes'],
        "recommended_team_size": urgency_data['recommended_team_size'],
        "golden_hour_remaining": urgency_data['golden_hour_remaining'],
        "equipment_checklist": equipment,
        "gas_note": gas_data['note']
    }
    
    log.append(f"[{datetime.now().strftime('%H:%M:%S')}] TRIAGE: Survivability {life_data['survivability_score']}/100 — {urgency_data['urgency'].upper()} — {gas_data['gas_threat']} gas")
    
    return {
        **state,
        "triage": triage_output,
        "processing_log": log
    }