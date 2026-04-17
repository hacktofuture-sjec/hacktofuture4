# Real-Time Data Synchronization - Setup & Troubleshooting Guide

## What Was Fixed

### 1. **Polling Interval Updated**
- **Before**: 4 seconds (4000ms)
- **After**: 2.5 seconds (2500ms)
- **Impact**: Dashboard now updates **2.5 seconds** after you send simulation requests

### 2. **Environment Variables Configured**
- Added `NEXT_PUBLIC_API_URL` to `.env.local`
- Added `NEXT_PUBLIC_DEBUG_POLLING` flag for debugging
- Added `NEXT_PUBLIC_DEBUG_SERVICES` flag for service health debugging

### 3. **Frontend UI Re-rendering Fixed**
- Service cards now use dynamic keys based on `lastUpdated` timestamp
- Forces React to re-render components when data changes
- Shows real-time health status with visual indicators (✓/✗)

### 4. **Backend Debug Logging Added**
- `DEBUG_SIMULATION=true` in agent-service/.env
- Logs every service status check
- Shows exactly what's being sent to frontend

---

## How to Test Real-Time Updates

### Step 1: Ensure Services Are Running
```bash
# Terminal 1: Agent Service
cd agent-service
npm start  # Should run on port 4000

# Terminal 2: Auth Service
cd auth-service
npm start  # Should run on port 3001

# Terminal 3: Messaging Service
cd messaging-service
npm start  # Should run on port 3002

# Terminal 4: Presence Service
cd presence-service
npm start  # Should run on port 3003
```

### Step 2: Ensure Dashboard is Running
```bash
cd Dashboard-fro
npm run dev  # Should run on port 3000
```

### Step 3: Monitor Service Health Before Changes
1. Open http://localhost:3000/dashboard
2. Look at the "Service Health" card on the right
3. All services should show as "healthy" with "normal" mode

### Step 4: Trigger Simulation Error (in Postman or PowerShell)
```powershell
# PowerShell
$url = "http://10.90.189.68:3001/simulate/error"
Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json"

# Or with curl
curl -X POST http://10.90.189.68:3001/simulate/error
```

### Step 5: Watch Dashboard Update
✅ **Expected Behavior** (within 2-3 seconds):
- "auth-service" status changes to 🔴 **RED** / **down**
- Mode changes to **error**
- "Reachable" vs "Unreachable" indicator updates
- "System Status" changes to **critical**
- Last updated time refreshes

### Step 6: Restore Service (Optional)
```powershell
$url = "http://10.90.189.68:3001/simulate/restore"
Invoke-WebRequest -Uri $url -Method POST
```

---

## Simulation API Endpoints

### Auth Service
```
POST /simulate/error     → Service returns errors
POST /simulate/latency   → Service responds slowly  
POST /simulate/crash     → Service crashes/goes down
POST /simulate/restore   → Service returns to normal
GET  /simulate/status    → Check current simulation state
```

### Messaging Service
```
POST http://10.90.189.68:3002/simulate/error
POST http://10.90.189.68:3002/simulate/latency
POST http://10.90.189.68:3002/simulate/crash
POST http://10.90.189.68:3002/simulate/restore
GET  http://10.90.189.68:3002/simulate/status
```

### Presence Service
```
POST http://10.90.189.68:3003/simulate/error
POST http://10.90.189.68:3003/simulate/latency
POST http://10.90.189.68:3003/simulate/crash
POST http://10.90.189.68:3003/simulate/restore
GET  http://10.90.189.68:3003/simulate/status
```

---

## Data Flow Diagram

```
User Simulation Request (Postman)
    ↓
Service /simulate/error endpoint
    ↓
Service Updates Internal State
    ↓
Agent Service /agent/analyze GETs /simulate/status from each service
    ↓
Monitor Service Parses Simulation State
    ↓
Response: { health: "down", mode: "error" }
    ↓
Dashboard Frontend useAgentAnalyze(2500) Polls Every 2.5 Seconds
    ↓
Gets Fresh Data from /agent/analyze
    ↓
UI Re-renders with Updated Status
    ↓
Visual: Service card shows RED status & "error" mode
```

---

## Debugging Checklist

### Frontend Debugging

#### 1. Check Browser Console
```javascript
// Should see logs like:
[polling] Updated /agent/analyze at 10:45:32 AM
[agent/analyze] ✓ Fresh data at 10:45:32 AM
[agent/analyze] services: [
  { service: 'auth-service', health: '...', mode: '...' }
]
```

Open DevTools → Console and watch the logs in real-time.

#### 2. Enable Debug Flags
Add to `.env.local`:
```env
NEXT_PUBLIC_DEBUG_AGENT_ANALYZE=true
NEXT_PUBLIC_DEBUG_POLLING=true
NEXT_PUBLIC_DEBUG_SERVICES=true
```

#### 3. Check Network Tab
DevTools → Network → Filter to `/agent/analyze`
- Should see requests every 2.5 seconds
- Response should contain `monitoring.services` array
- Look for `health` and `mode` fields

#### 4. Inspect Service Health Component
```javascript
// In DevTools Console
// Check if services are updating
const services = document.querySelectorAll('[class*="service"]');
console.log(services);
```

### Backend Debugging

#### 1. Check Agent Service Logs
```bash
# Terminal where agent-service is running
# Should see logs like:
[monitor] System status check complete: {
  overall: 'critical',
  services: [
    { service: 'auth-service', health: 'down', mode: 'error' }
  ]
}
[/agent/analyze] Response: { services: [...] }
```

#### 2. Check Service Status Directly
```powershell
# PowerShell
$response = Invoke-WebRequest -Uri "http://10.90.189.68:4000/agent/analyze" -Method GET
$data = $response.Content | ConvertFrom-Json
$data.monitoring.services | Format-Table
```

#### 3. Check Service Simulation State
```powershell
# Check a single service
$auth = Invoke-WebRequest -Uri "http://10.90.189.68:3001/simulate/status" -Method GET
$auth.Content | ConvertFrom-Json
```

---

## Common Issues & Solutions

### Issue 1: Dashboard Shows "pending..." for Last Updated

**Cause**: API calls are failing or taking too long

**Solution**:
```bash
# Check if agent-service is running
curl http://10.90.189.68:4000/

# Should return: { "success": true, "message": "Agent service is running" }
```

### Issue 2: Service Health Shows "unknown"

**Cause**: Services not responding to /simulate/status

**Solution**:
```bash
# Manually check each service
curl http://10.90.189.68:3001/simulate/status
curl http://10.90.189.68:3002/simulate/status
curl http://10.90.189.68:3003/simulate/status

# Should return: { "state": { "error": false, "latency": false, "crash": false } }
```

### Issue 3: Changes Show Up After 5+ Seconds

**Cause**: Using old polling interval

**Solution**:
- Verify `.env` variables are reloaded
- Restart both Frontend and Agent Service
- Check browser DevTools → Application → Storage → Clear site data

### Issue 4: Browser Console Shows CORS Errors

**Cause**: API URL mismatch

**Solution**:
```env
# In Dashboard-fro/.env.local
NEXT_PUBLIC_AGENT_BASE_URL=http://10.90.189.68:4000
NEXT_PUBLIC_API_URL=http://10.90.189.68:4000

# Restart frontend
npm run dev
```

### Issue 5: "Failed to fetch /agent/analyze" Error

**Cause**: Service URLs in agent-service/.env don't match actual service hosts

**Solution**:
```bash
# If running in Docker:
AUTH_SERVICE_URL=http://auth-service:3001

# If running on localhost:
AUTH_SERVICE_URL=http://localhost:3001

# If running on network:
AUTH_SERVICE_URL=http://10.90.189.68:3001

# Update agent-service/.env and restart:
npm start
```

---

## Performance Optimization

### Current Configuration
- **Polling Interval**: 2500ms (2.5 seconds)
- **Frontend Pages**: Dashboard, Observability, RCA, Remediation, Learning
- **Data Size**: ~5-10KB per request

### Optional Improvements

#### Option 1: Even Faster Updates (2 seconds)
```typescript
// In useAgentAnalyze.ts
useAgentAnalyze(2000) // 2 seconds instead of 2500
```

#### Option 2: WebSocket Support (Real-Time, No Polling)
This would require server-side implementation.

#### Option 3: Reduce Polling on Hidden Tabs
```typescript
// In useAgentAnalyze.ts
useEffect(() => {
  const handleVisibility = () => {
    const interval = document.hidden ? 5000 : 2500;
    // Update polling interval dynamically
  };
  document.addEventListener('visibilitychange', handleVisibility);
}, []);
```

---

## Files Modified

1. **Dashboard-fro/.env.local**
   - Added/updated API base URLs
   - Added debug flags

2. **Dashboard-fro/hooks/useAgentAnalyze.ts**
   - Changed polling from 4000ms to 2500ms
   - Added detailed console logging

3. **Dashboard-fro/app/(protected)/dashboard/page.tsx**
   - Updated polling interval to 2500ms
   - Added dynamic key-based re-rendering
   - Added last updated timestamp display

4. **agent-service/.env**
   - Added comments for Docker vs Local
   - Added debug flags

5. **agent-service/services/monitor.service.js**
   - Added debug logging for service status checks

6. **agent-service/routes/agent.routes.js**
   - Added debug logging for /agent/analyze responses

---

## Expected Timeline

After each simulation request:
- **Immediate (0s)**: Service receives request
- **0-0.5s**: Service updates internal state
- **0.5-1.5s**: Agent service detects change (next /simulate/status call)
- **1.5-2.5s**: Dashboard fetches from /agent/analyze
- **2.5-3.5s**: UI updates visible on screen

**Total**: ~2.5-3.5 seconds from request to visible update

---

## Next Steps

1. ✅ Restart all services with updated configs
2. ✅ Test simulation endpoints with Postman/curl
3. ✅ Watch browser console for debug logs
4. ✅ Verify dashboard updates within 2-3 seconds
5. ✅ Optional: Add WebSocket for instant updates

---

## Support

If issues persist:
1. Check all debug logs (browser + server)
2. Verify environment variables are set
3. Ensure all services are running on correct ports
4. Check network connectivity (especially if using IP addresses)
5. Review "Common Issues" section above
