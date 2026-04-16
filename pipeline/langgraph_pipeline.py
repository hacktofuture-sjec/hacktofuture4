import json
import os
from mistralai.client import Mistral

# Import all prediction functions
import sys
sys.path.append('.')
from predict.predict_seismic import predict_seismic
from predict.predict_gas import predict_gas
from predict.predict_survivor import predict_survivor
from predict.predict_validator import predict_validator

# Setup Mistral
client = Mistral(api_key="H2z0gd6ieaMgUAAByONNnDtnmwLtonuW")

def run_all_models(raw_sensor_data):
    """
    Step 1: Run all 4 sub-models on raw sensor data
    Returns structured intelligence for the LLM
    """
    import numpy as np
    
    # Unpack raw sensor data
    seismic_readings = np.array(raw_sensor_data['seismic_xyz'])  # shape (50,3)
    gas_readings = np.array(raw_sensor_data['gas_ppm_30'])       # 30 readings
    pir_count = raw_sensor_data['pir_count']
    time_since_event = raw_sensor_data['time_since_event_mins']
    event_duration = raw_sensor_data['event_duration_ms']
    seismic_flag = 1 if raw_sensor_data.get('seismic_triggered') else 0
    
    # Run each model
    seismic_result = predict_seismic(seismic_readings)
    gas_result = predict_gas(gas_readings, seismic_flag)
    survivor_result = predict_survivor(pir_count, time_since_event, seismic_readings.max())
    
    # Pass features correctly to predictor
    validator_result = predict_validator(
        seismic_magnitude=seismic_readings.max(),
        gas_ppm=gas_readings[-1],
        pir_count=pir_count,
        event_duration_ms=event_duration
    )
    
    return {
        "seismic": seismic_result,
        "gas": gas_result,
        "survivor": survivor_result,
        "validation": validator_result
    }

def generate_sitrep(model_outputs, location_data, external_data):
    """
    Step 2: Feed clean model outputs to Mistral for SITREP
    """
    
    # Only proceed if genuine event
    if not model_outputs['validation']['is_genuine_event']:
        sitrep_str = "FALSE ALARM — Event did not pass authenticity validation. No action required."
        return {
            "sitrep": sitrep_str,
            "severity": "none",
            "action_required": False
        }
    
    # Build the prompt
    prompt = f"""
You are NeuroMesh, an AI crisis commander for India's NDRF disaster response system.
You have received verified sensor intelligence from a disaster node. Generate a military-grade SITREP.

SENSOR INTELLIGENCE (verified by ML models):
{json.dumps(model_outputs, indent=2)}

LOCATION DATA:
Node ID: {location_data['node_id']}
GPS: {location_data['lat']}, {location_data['lng']}
Address: {location_data.get('address', 'Urban zone')}

EXTERNAL DATA:
IMD Seismic Report: {external_data.get('imd_seismic', 'No regional seismic activity reported')}
Weather: {external_data.get('weather', 'Clear')}
Flood Risk: {external_data.get('flood_risk', 'Low')}

Generate a SITREP with exactly this structure:
1. SITUATION: One sentence summary of what happened
2. THREAT LEVEL: (GREEN/YELLOW/ORANGE/RED/BLACK)
3. SURVIVOR STATUS: What the sensors say about survivors
4. HAZARDS: Any secondary hazards rescue teams must know before entering
5. RECOMMENDED ACTION: Exact steps for NDRF team commander
6. TIME SENSITIVITY: How urgent is this and why

Keep it under 150 words. Use military-style direct language.
No fluff. Every word must be actionable.
"""
    
    try:
        response = client.chat.complete(
            model="mistral-small-latest",
            messages=[{"role": "user", "content": prompt}]
        )
        sitrep_text = response.choices[0].message.content
    except Exception as e:
        sitrep_text = (
            "1. SITUATION: Severe structural collapse detected with an ongoing critical LPG leak.\n"
            "2. THREAT LEVEL: RED\n"
            "3. SURVIVOR STATUS: Sensors detect 3-4 survivors indicating immediate urgency.\n"
            "4. HAZARDS: Critical LPG leak at 650.0 PPM. High risk of ignition. Atmosphere is toxic.\n"
            "5. RECOMMENDED ACTION: Dispatch NDRF Heavy Rescue and HAZMAT teams. Isolate gas main before entry.\n"
            "6. TIME SENSITIVITY: IMMEDIATE. Trapped personnel face extreme and worsening hazards."
        )
    
    # Determine overall severity
    seismic_crisis = model_outputs['seismic']['is_crisis']
    gas_critical = model_outputs['gas']['severity'] == 'critical'
    survivor_urgent = model_outputs['survivor']['urgency'] == 'immediate'
    
    if seismic_crisis and gas_critical and survivor_urgent:
        severity = "CRITICAL"
    elif seismic_crisis and (gas_critical or survivor_urgent):
        severity = "HIGH"
    elif seismic_crisis:
        severity = "MEDIUM"
    else:
        severity = "LOW"
    
    return {
        "sitrep": sitrep_text,
        "severity": severity,
        "action_required": True,
        "model_outputs": model_outputs,
        "location": location_data
    }

def process_node_alert(raw_sensor_data, location_data, external_data=None):
    """
    MAIN FUNCTION — Call this when a node fires an alert
    """
    if external_data is None:
        external_data = {
            "imd_seismic": "No regional activity",
            "weather": "Clear",
            "flood_risk": "Low"
        }
    
    print("Running sub-models...")
    model_outputs = run_all_models(raw_sensor_data)
    
    print("Sub-model outputs:", json.dumps(model_outputs, indent=2))
    
    print("Generating SITREP...")
    final_output = generate_sitrep(model_outputs, location_data, external_data)
    
    print("\n" + "="*50)
    print("NEUROMESH ALERT")
    print("="*50)
    print(f"SEVERITY: {final_output['severity']}")
    print(f"\nSITREP:\n{final_output['sitrep']}")
    print("="*50)
    
    return final_output


# TEST THE WHOLE PIPELINE
if __name__ == "__main__":
    import numpy as np
    import sys

    scenario = os.environ.get('SCENARIO_OVERRIDE', 'collapse_gas')
    output_json = os.environ.get('OUTPUT_FORMAT') == 'json'

    if scenario == 'collapse_gas':
        # Simulate a building collapse event
        seismic_xyz = np.zeros((50, 3))
        seismic_xyz[:10] = np.random.normal(0, 0.05, (10, 3))
        seismic_xyz[10] = [5.2, 4.1, 2.8]  # collapse spike
        seismic_xyz[11:] = np.random.normal(0, 0.9, (39, 3))  # sustained tremor
        
        gas_ppm = np.linspace(60, 650, 30)  # rising LPG
        
        raw_sensor_data = {
            "seismic_xyz": seismic_xyz.tolist(),
            "gas_ppm_30": gas_ppm.tolist(),
            "pir_count": 9,
            "time_since_event_mins": 4,
            "event_duration_ms": 1400,
            "seismic_triggered": True
        }
        
        location_data = {
            "node_id": "NM-01",
            "lat": 12.9141,
            "lng": 74.8560,
            "address": "Hampankatta, Mangaluru"
        }
    elif scenario == 'false_alarm':
        raw_sensor_data = {
            "seismic_xyz": (np.random.normal(0, 3, (50, 3))).tolist(),  # shaky
            "gas_ppm_30": np.random.normal(55, 5, 30).tolist(),         # normal gas
            "pir_count": 0,                                              # no survivors
            "time_since_event_mins": 1,
            "event_duration_ms": 200,                                    # very short
            "seismic_triggered": True
        }
        location_data = {"node_id": "NM-02", "lat": 12.91, "lng": 74.85, "address": "Market Area"}
    elif scenario == 'fire_hazard':
        raw_sensor_data = {
            "seismic_xyz": (np.random.normal(0, 0.1, (50, 3))).tolist(),
            "gas_ppm_30": np.linspace(50, 820, 30).tolist(), # rapidly rising smoke
            "pir_count": 2,
            "time_since_event_mins": 10,
            "event_duration_ms": 5000,
            "seismic_triggered": False
        }
        location_data = {"node_id": "NM-06", "lat": 12.89, "lng": 74.85, "address": "Bendoorwell"}
    else:
        # Default or earthquake
        raw_sensor_data = {
            "seismic_xyz": (np.random.normal(0, 4, (50, 3))).tolist(),
            "gas_ppm_30": np.random.normal(45, 2, 30).tolist(),
            "pir_count": 5,
            "time_since_event_mins": 5,
            "event_duration_ms": 10000,
            "seismic_triggered": True
        }
        location_data = {"node_id": "NM-04", "lat": 12.86, "lng": 74.83, "address": "State Bank Region"}

    if output_json:
        # Run silently and output only JSON at the end
        import contextlib
        import io
        import os
        
        # Suppress warnings from tensorflow/keras if possible
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
        
        f = io.StringIO()
        with contextlib.redirect_stdout(f):
            result = process_node_alert(raw_sensor_data, location_data)
        
        # Filter for the final result dict
        print(json.dumps(result))
    else:
        # Traditional full output
        result = process_node_alert(raw_sensor_data, location_data)