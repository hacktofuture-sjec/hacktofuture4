# Realtime IoT Feed Setup (ESP32 -> NDRF Dashboard)

## What was added

- `GET /api/telemetry`: returns current live alert snapshot for dashboard polling.
- `POST /api/telemetry`: accepts sensor frames from ESP32 and updates alert state.
- Dashboard now auto-polls this API every 1 second and renders live alerts.

## API Payload

Send JSON with these required fields:

```json
{
  "node_id": "NM-01",
  "lat": 12.9141,
  "lng": 74.8560,
  "acceleration_g": 1.23,
  "gas_raw": 2890,
  "motion": true,
  "temp_c": 30.4,
  "humidity": 62.0,
  "address": "Hampankatta Zone A"
}
```

## Alert Logic

- Earthquake intensity is derived from `acceleration_g`.
- Gas risk is derived from `gas_raw` (0-4095) mapped to percentage.
- Threat level:
  - `RED`: quake active + high gas + motion
  - `ORANGE`: quake active + (high gas or motion)
  - `YELLOW`: quake only or gas only
  - `GREEN`: otherwise
- Dashboard feed shows only non-GREEN alerts.

## ESP32 Code Patch

Add these includes and constants:

```cpp
#include <HTTPClient.h>

const char* ingestUrl = "http://<YOUR_LAPTOP_IP>:3000/api/telemetry";
const char* nodeId = "NM-01";
const float nodeLat = 12.9141;
const float nodeLng = 74.8560;
```

Add this helper function:

```cpp
void postTelemetry(float acc, int gasValue, int motion, float temp, float hum) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(ingestUrl);
  http.addHeader("Content-Type", "application/json");

  String body = "{";
  body += "\"node_id\":\"" + String(nodeId) + "\",";
  body += "\"lat\":" + String(nodeLat, 6) + ",";
  body += "\"lng\":" + String(nodeLng, 6) + ",";
  body += "\"acceleration_g\":" + String(acc, 4) + ",";
  body += "\"gas_raw\":" + String(gasValue) + ",";
  body += "\"motion\":" + String(motion == HIGH ? "true" : "false") + ",";
  body += "\"temp_c\":" + String(temp, 2) + ",";
  body += "\"humidity\":" + String(hum, 2);
  body += "}";

  http.POST(body);
  http.end();
}
```

In your `loop()`, call it after readings are computed:

```cpp
postTelemetry(acc, gasValue, motion, temp, hum);
```

## Run

1. Start dashboard:

```bash
cd dashboard
npm run dev
```

2. Ensure ESP32 and laptop are on the same Wi-Fi.
3. Replace `<YOUR_LAPTOP_IP>` with your machine IP.
4. Open `http://localhost:3000` and trigger sensor events.

## Quick Test without hardware

```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H 'Content-Type: application/json' \
  -d '{"node_id":"NM-01","lat":12.9141,"lng":74.8560,"acceleration_g":1.25,"gas_raw":2900,"motion":true}'
```
