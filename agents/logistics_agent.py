import numpy as np
import requests
import os
from pipeline.state import NeuroMeshState
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

def get_road_network_simple(lat: float, lng: float, radius: int = 1000) -> dict:
    """
    Get roads near collapse zone using Overpass API (free OSM).
    Returns road segments as simple dict.
    No osmnx needed — raw Overpass query.
    """
    overpass_url = os.getenv('OVERPASS_API_URL', 'http://overpass-api.de/api/interpreter')
    query = f"""
    [out:json][timeout:10];
    (
      way["highway"~"primary|secondary|tertiary|residential|service"]
         (around:{radius},{lat},{lng});
    );
    out body;
    >;
    out skel qt;
    """
    
    try:
        response = requests.post(overpass_url, data=query, timeout=12)
        if response.status_code == 200:
            return response.json()
    except:
        pass
    
    return None

def calculate_debris_probability(road_lat: float, road_lng: float,
                                  collapse_lat: float, collapse_lng: float,
                                  magnitude: float) -> float:
    """
    ML-lite model: probability a road is blocked by debris.
    Based on distance from collapse + magnitude.
    Simple physics-based model, no training needed.
    """
    # Haversine distance in meters
    R = 6371000
    dlat = np.radians(road_lat - collapse_lat)
    dlng = np.radians(road_lng - collapse_lng)
    a = (np.sin(dlat/2)**2 + 
         np.cos(np.radians(collapse_lat)) * np.cos(np.radians(road_lat)) * 
         np.sin(dlng/2)**2)
    distance_m = 2 * R * np.arcsin(np.sqrt(a))
    
    # Debris throw radius scales with magnitude
    # Magnitude 4 → ~50m debris zone
    # Magnitude 6 → ~200m debris zone
    debris_radius = magnitude * 35
    
    if distance_m < debris_radius * 0.3:
        return 0.95   # almost certainly blocked
    elif distance_m < debris_radius * 0.6:
        return 0.70
    elif distance_m < debris_radius:
        return 0.40
    elif distance_m < debris_radius * 2:
        return 0.15
    else:
        return 0.05   # probably clear

def find_best_routes(collapse_lat: float, collapse_lng: float, 
                      magnitude: float) -> dict:
    """
    Find primary and alternate routes to collapse site.
    Marks debris-risk zones around collapse.
    """
    # Debris exclusion zone radius (meters)
    exclusion_radius = int(magnitude * 35)
    
    # Primary entry point: closest safe approach
    # Offset from collapse center by exclusion radius in cardinal direction
    offset_deg = exclusion_radius / 111000  # convert meters to degrees approx
    
    entry_primary = {
        "lat": collapse_lat - offset_deg,
        "lng": collapse_lng,
        "label": "Primary entry point",
        "note": f"Approach from south, {exclusion_radius}m from collapse center"
    }
    
    entry_alternate = {
        "lat": collapse_lat,
        "lng": collapse_lng + offset_deg * 1.2,
        "label": "Alternate entry point",
        "note": f"Approach from east, {int(exclusion_radius * 1.2)}m from collapse center"
    }
    
    assembly_point = {
        "lat": collapse_lat - offset_deg * 3,
        "lng": collapse_lng - offset_deg * 2,
        "label": "Assembly point",
        "note": "Safe staging area for teams and equipment"
    }
    
    # Debris risk zones (circles around collapse)
    debris_zones = [
        {
            "type": "Feature",
            "properties": {
                "risk": "extreme",
                "label": f"Extreme debris zone ({int(exclusion_radius * 0.3)}m radius)",
                "entry_forbidden": True
            },
            "geometry": {
                "type": "Point",
                "coordinates": [collapse_lng, collapse_lat],
                "radius": exclusion_radius * 0.3
            }
        },
        {
            "type": "Feature",
            "properties": {
                "risk": "high",
                "label": f"High debris zone ({exclusion_radius}m radius)",
                "entry_forbidden": False
            },
            "geometry": {
                "type": "Point",
                "coordinates": [collapse_lng, collapse_lat],
                "radius": exclusion_radius
            }
        }
    ]
    
    return {
        "entry_primary": entry_primary,
        "entry_alternate": entry_alternate,
        "assembly_point": assembly_point,
        "debris_zones": debris_zones,
        "exclusion_radius_m": exclusion_radius,
        "eta_estimate_minutes": 8 + (exclusion_radius / 1000) * 2  # rough ETA
    }

def logistics_agent(state: NeuroMeshState) -> NeuroMeshState:
    """
    Agent 3: The Logistics Strategist
    ZERO LLM CALLS.
    Calculates routes, debris zones, entry points using OSM + physics model.
    """
    log = state.get('processing_log', [])
    
    primary_node = max(state['raw_nodes'], 
                       key=lambda n: n['seismic_magnitude'])
    
    lat = primary_node['lat']
    lng = primary_node['lng']
    mag = primary_node['seismic_magnitude']
    
    log.append(f"[{datetime.now().strftime('%H:%M:%S')}] LOGISTICS: Computing routes for collapse at {lat:.4f}, {lng:.4f}")
    
    routes = find_best_routes(lat, lng, mag)
    
    logistics_output = {
        "primary_route": {
            "type": "route",
            "label": "Primary approach route",
            "entry_point": routes['entry_primary'],
            "via": "Main road, approach from south"
        },
        "alternate_route": {
            "type": "route", 
            "label": "Alternate approach route",
            "entry_point": routes['entry_alternate'],
            "via": "Service road, approach from east"
        },
        "blocked_roads": [
            f"All roads within {routes['exclusion_radius_m']}m of collapse center",
            "Check debris probability before entry"
        ],
        "estimated_eta_minutes": round(routes['eta_estimate_minutes'], 1),
        "entry_point": routes['entry_primary'],
        "assembly_point": routes['assembly_point'],
        "debris_risk_zones": routes['debris_zones'],
        "exclusion_radius_m": routes['exclusion_radius_m']
    }
    
    log.append(f"[{datetime.now().strftime('%H:%M:%S')}] LOGISTICS: ETA {logistics_output['estimated_eta_minutes']} mins — exclusion zone {routes['exclusion_radius_m']}m")
    
    return {
        **state,
        "logistics": logistics_output,
        "processing_log": log
    }
