# Real-Time Data Sync - Quick Reference

## Step 1: Start All Services
```bash
# Terminal 1 - Agent Service (port 4000)
cd agent-service
npm start

# Terminal 2 - Auth Service (port 3001)
cd auth-service
npm start

# Terminal 3 - Messaging Service (port 3002)
cd messaging-service
npm start

# Terminal 4 - Presence Service (port 3003)
cd presence-service
npm start

# Terminal 5 - Dashboard Frontend (port 3000)
cd Dashboard-fro
npm run dev
```

## Step 2: Open Dashboard
```
http://localhost:3000/dashboard
or
http://10.90.189.68:3000/dashboard
```

## Step 3: Watch Console for Updates
Press `F12` → Console tab → Look for `[polling]` logs

## Step 4: Trigger Simulation (PowerShell)

### Simulate Error on Auth Service
```powershell
$url = "http://10.90.189.68:3001/simulate/error"
Invoke-WebRequest -Uri $url -Method POST
```

### Simulate Latency on Messaging Service
```powershell
$url = "http://10.90.189.68:3002/simulate/latency"
Invoke-WebRequest -Uri $url -Method POST
```

### Simulate Crash on Presence Service
```powershell
$url = "http://10.90.189.68:3003/simulate/crash"
Invoke-WebRequest -Uri $url -Method POST
```

### Restore Service to Normal
```powershell
$url = "http://10.90.189.68:3001/simulate/restore"
Invoke-WebRequest -Uri $url -Method POST
```

### Check Simulation Status
```powershell
$response = Invoke-WebRequest -Uri "http://10.90.189.68:3001/simulate/status" -Method GET
$response.Content | ConvertFrom-Json | Format-List
```

## Step 5: Watch Dashboard Update
- Service health card updates **within 2-3 seconds**
- Color changes: 🟢 healthy → 🔴 down
- Mode shows: "error", "latency", "crash", or "normal"
- Last updated time refreshes

## Verification Checklist

- [ ] Services running on correct ports
- [ ] Browser console shows `[polling]` logs every 2.5s
- [ ] Dashboard loads without errors
- [ ] POST /simulate/error succeeds (HTTP 200)
- [ ] Service health shows "down" within 3 seconds
- [ ] Color is red (#ef4444)
- [ ] Mode shows "error"
- [ ] POST /simulate/restore succeeds
- [ ] Service returns to "healthy" within 3 seconds

## Test Scenarios

### Scenario 1: Single Service Error
1. Run: `Invoke-WebRequest -Uri "http://10.90.189.68:3001/simulate/error" -Method POST`
2. Expect: auth-service shows RED/down immediately in dashboard
3. Verify: System Status changes to "critical"

### Scenario 2: Multiple Service Issues
1. Trigger error on auth-service
2. Trigger latency on messaging-service
3. Trigger crash on presence-service
4. Expect: System Status = "critical", multiple services degraded

### Scenario 3: Recovery
1. Trigger error on auth-service
2. Verify it shows as down
3. Run: `Invoke-WebRequest -Uri "http://10.90.189.68:3001/simulate/restore" -Method POST`
4. Expect: Service returns to healthy within 3 seconds

## Network Testing (if running locally)

### Check Agent Service Health
```powershell
Invoke-WebRequest -Uri "http://10.90.189.68:4000/" -Method GET
```
Expected response: `{ "success": true, "message": "Agent service is running" }`

### Check Agent Analysis
```powershell
$response = Invoke-WebRequest -Uri "http://10.90.189.68:4000/agent/analyze" -Method GET
$data = $response.Content | ConvertFrom-Json
$data.monitoring.services | Format-Table -Property service, health, mode
```

Expected: Shows all 3 services with their current health/mode

## Browser Console Commands

### View Real-Time Logs
```javascript
// Copy/paste in browser console to see polling
window.__agentDebug = true;
console.clear();
// Logs will show every 2.5 seconds
```

### Check Last Data
```javascript
// In browser console
// Look for: [agent/analyze] services: [...]
// This shows the exact data being rendered
```

## Performance Notes
- Polling interval: 2.5 seconds (fast updates)
- Network overhead: ~5-10KB per request
- CPU overhead: Negligible
- Suitable for production use

## Troubleshooting

### No updates after 5+ seconds?
1. Restart Dashboard: `npm run dev`
2. Check DevTools → Application → Storage → Clear all

### Service shows "unknown"?
1. Check if service is running: `npm start` in service directory
2. Verify port numbers match .env.local
3. Check firewall allows port access

### "Failed to fetch" errors?
1. Verify NEXT_PUBLIC_AGENT_BASE_URL is correct
2. Restart agent-service: `npm start`
3. Clear browser cache: Ctrl+Shift+Delete

### Dashboard extremely slow?
1. Check network latency: `ping 10.90.189.68`
2. Reduce polling: change 2500 to 5000 in useAgentAnalyze
3. Close DevTools (can slow down rendering)
