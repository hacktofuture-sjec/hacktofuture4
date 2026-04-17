"""
ML Pipeline Package
--------------------
Multi-stage intelligent pipeline for Kubernetes failure detection,
classification, root cause analysis, and automated remediation.

Pipeline stages (in order):
  1. Validation       - sanitise raw telemetry
  2. Feature Eng.     - temporal / trend features from sliding window
  3. Anomaly          - IsolationForest anomaly scoring
  4. Classifier       - RandomForest failure classification
  5. RCA              - root-cause correlation engine
  6. Decision         - ML + rule hybrid action mapping
  7. Safety           - policy guardrails before execution
  8. Verification     - post-heal outcome checking
  9. Memory           - incident history store
"""
