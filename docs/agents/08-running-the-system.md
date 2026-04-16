# Running the System

## Prerequisites

- Python 3.13
- pip package manager
- Git
- Node.js + npm
- PowerShell (Windows) or bash-compatible shell

## Setup

```bash
git clone https://github.com/VivekNeer/hacktofuture4-A07.git
cd hacktofuture4-A07
```

### Windows (PowerShell)

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
npm --prefix frontend install
```

### macOS/Linux (bash)

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
npm --prefix frontend install
```

## Validate

```powershell
pytest backend/tests/ -q
npm --prefix frontend run build
```

Expected:

- Backend tests pass
- Frontend production build succeeds

## Run Backend

```powershell
uvicorn backend.main:app --reload
```

## Minimal Incident API Flow

1. Generate plan:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/incidents/inc-001/plan
```

2. Simulate first action:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/incidents/inc-001/simulate -ContentType "application/json" -Body '{"action_index":0}'
```

3. Approve:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/incidents/inc-001/approve
```

4. Execute approved action:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/incidents/inc-001/execute -ContentType "application/json" -Body '{"action_index":0}'
```

5. Verify and close:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/incidents/inc-001/verify -ContentType "application/json" -Body '{"window_seconds":60, "metrics":{"memory":"55%", "cpu":"40%"}}'
```

## Troubleshooting

- If execute returns failed, inspect allowlist compatibility of planned command.
- If verify returns failed, provide healthier test metrics or improve checker thresholds.
- If tests fail after route edits, run:

```powershell
pytest backend/tests/test_phase4_planner_orchestration.py -q
```
