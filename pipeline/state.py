from typing import TypedDict, Optional, List

class NodeReport(TypedDict):
    node_id: str
    lat: float
    lng: float
    seismic_magnitude: float
    gas_ppm: float
    pir_count: int
    event_duration_ms: int
    timestamp: str

class VerifierOutput(TypedDict):
    is_genuine: bool
    confidence: float
    triggered_nodes: List[str]
    correlation_type: str   # "single_node" | "cluster" | "mesh_wide"
    rejection_reason: Optional[str]

class TriageOutput(TypedDict):
    survivability_score: float      # 0-100
    estimated_persons: str          # "0" | "1-2" | "3-5" | "5+"
    life_sign_pattern: str          # "active" | "weakening" | "critical" | "none"
    gas_threat: str                 # "clear" | "warning" | "lethal"
    entry_protocol: str             # "standard" | "breathing_apparatus" | "hazmat"
    urgency: str                    # "low" | "high" | "immediate" | "extreme"

class LogisticsOutput(TypedDict):
    primary_route: dict             # GeoJSON LineString
    alternate_route: dict           # GeoJSON LineString
    blocked_roads: List[str]
    estimated_eta_minutes: float
    entry_point: dict               # GeoJSON Point
    assembly_point: dict            # GeoJSON Point
    debris_risk_zones: List[dict]   # GeoJSON Polygons

class SitrepOutput(TypedDict):
    threat_level: str               # GREEN/YELLOW/ORANGE/RED/BLACK
    severity_score: int             # 0-100
    headline: str                   # one line summary
    full_sitrep: str                # military-grade full report
    recommended_team_size: int
    equipment_checklist: List[str]
    time_sensitivity_minutes: int   # how long before situation degrades

class NeuroMeshState(TypedDict):
    # Input
    raw_nodes: List[NodeReport]
    alert_id: str
    
    # Agent outputs (filled as pipeline runs)
    verifier: Optional[VerifierOutput]
    triage: Optional[TriageOutput]
    logistics: Optional[LogisticsOutput]
    sitrep: Optional[SitrepOutput]
    
    # Pipeline control
    pipeline_status: str    # "running" | "aborted" | "complete"
    abort_reason: Optional[str]
    processing_log: List[str]