#!/bin/bash
# Quick reference for testing the monitor → diagnose → plan pipeline

set -e

echo "=================================================="
echo "Monitor → Diagnose → Plan Pipeline Quick Start"
echo "=================================================="

# Configuration
API_URL="${API_URL:-http://localhost:8000}"
INCIDENT_ID=""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

pretty_json() {
    python3 -m json.tool
}

api_get_json() {
    local method=$1
    local endpoint=$2
    local data=$3

    if [ -z "$data" ]; then
        curl -fsS -X "$method" "$API_URL$endpoint" -H "Content-Type: application/json"
    else
        curl -fsS -X "$method" "$API_URL$endpoint" -H "Content-Type: application/json" -d "$data"
    fi
}

api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4

    echo -e "${BLUE}→ ${description}${NC}" >&2
    api_get_json "$method" "$endpoint" "$data" | pretty_json
}

scenario_id_for_fault() {
    case "$1" in
        oom-kill) echo "oom-kill-001" ;;
        cpu-spike) echo "cpu-spike-001" ;;
        crash-loop) echo "crash-loop-001" ;;
        db-latency) echo "db-latency-001" ;;
        *) echo "$1" ;;
    esac
}

wait_for_incident() {
    local scenario_id=$1
    local timeout_seconds=${2:-30}
    local deadline=$((SECONDS + timeout_seconds))

    while [ "$SECONDS" -lt "$deadline" ]; do
        local incident_id
        incident_id=$(api_get_json GET "/incidents" "" | python3 -c 'import json,sys
incidents=json.load(sys.stdin)
for incident in incidents:
    if incident.get("scenario_id") == sys.argv[1]:
        print(incident.get("incident_id", ""))
        break' "$scenario_id" 2>/dev/null || true)

        if [ -n "$incident_id" ]; then
            printf '%s' "$incident_id"
            return 0
        fi

        sleep 1
    done

    return 1
}

# Step 1: Inject a fault
echo -e "\n${BLUE}Step 1: Inject a Fault${NC}"
echo "Available fault types: oom-kill, cpu-spike, crash-loop, db-latency"
echo ""

FAULT_TYPE="${1:-oom-kill}"
echo "Injecting fault: $FAULT_TYPE"
SCENARIO_ID=$(scenario_id_for_fault "$FAULT_TYPE")

echo "Using scenario_id: $SCENARIO_ID"

api_call POST "/inject-fault" \
    '{"scenario_id": "'$SCENARIO_ID'"}' \
    "Fault injection" >/tmp/a07-inject-response.json

INCIDENT_ID=$(wait_for_incident "$SCENARIO_ID" 30 || true)
if [ -z "$INCIDENT_ID" ]; then
    echo "ERROR: Could not find a new incident for scenario '$SCENARIO_ID'." >&2
    echo "The backend may not be running, or the monitor has not created the incident yet." >&2
    exit 1
fi
echo -e "${GREEN}✓ Incident created: $INCIDENT_ID${NC}\n"

# Step 2: Get incident snapshot
echo -e "${BLUE}Step 2: Get Incident Snapshot${NC}"
INCIDENT=$(api_call GET "/incidents/$INCIDENT_ID" "" \
    "Retrieving incident snapshot")

echo -e "${GREEN}✓ Incident snapshot retrieved${NC}\n"

# Step 3: Run diagnosis
echo -e "${BLUE}Step 3: Run Diagnosis${NC}"
DIAGNOSIS=$(api_call POST "/incidents/$INCIDENT_ID/diagnose" "" \
    "Running DiagnoseAgent")

ROOT_CAUSE=$(printf '%s' "$DIAGNOSIS" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("diagnosis", {}).get("root_cause", ""))')
CONFIDENCE=$(printf '%s' "$DIAGNOSIS" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("diagnosis", {}).get("confidence", ""))')
FINGERPRINT=$(printf '%s' "$DIAGNOSIS" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("diagnosis", {}).get("fingerprint_matched", ""))')

echo -e "${GREEN}✓ Diagnosis complete:${NC}"
echo "  Root Cause: $ROOT_CAUSE"
echo "  Confidence: $CONFIDENCE"
echo "  Fingerprint: $FINGERPRINT\n"

# Step 4: Generate plan
echo -e "${BLUE}Step 4: Generate Plan${NC}"
PLAN=$(api_call POST "/incidents/$INCIDENT_ID/plan" "" \
    "Running PlannerAgent")

NUM_ACTIONS=$(printf '%s' "$PLAN" | python3 -c 'import json,sys; print(len(json.load(sys.stdin).get("plan_json", {}).get("actions", [])))')
echo -e "${GREEN}✓ Plan generated with $NUM_ACTIONS action(s):${NC}"

printf '%s' "$PLAN" | python3 -c 'import json,sys
plan=json.load(sys.stdin)
for action in plan.get("plan_json", {}).get("actions", []):
    print(f"  - {action.get(\"command\", \"\")} (risk: {action.get(\"risk_level\", \"\")}, approval: {action.get(\"approval_required\", \"\")})")'

echo ""
echo -e "${GREEN}=================================================="
echo "Pipeline execution complete!"
echo "==================================================${NC}"
echo ""
echo "Incident ID: $INCIDENT_ID"
echo "Next steps:"
echo "  1. Review actions in the diagnosis"
echo "  2. Approve actions: POST /incidents/$INCIDENT_ID/approve"
echo "  3. Execute actions: POST /incidents/$INCIDENT_ID/execute"
echo "  4. Verify recovery: POST /incidents/$INCIDENT_ID/verify"
