/**
 * agent-service — ML Integration Patch
 * =====================================
 * Drop these additions into your existing agent-service.
 * This does NOT replace any existing RCA or decision logic.
 * It ADDS mlInsight as extra evidence to /agent/analyze.
 *
 * Steps:
 *   1. Add the ML_SERVICE_URL env variable
 *   2. Add the callMlService() helper function
 *   3. Call it inside your existing /agent/analyze handler
 *      and attach the result as `mlInsight`
 */


// ─── 1. Environment variable ────────────────────────────────────────────────
// Add to your .env or docker-compose environment block:
//
//   ML_SERVICE_URL=http://ml-service:5050
//
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://ml-service:5050";


// ─── 2. Helper: call the ML service ─────────────────────────────────────────
/**
 * Sends telemetry to the ML anomaly-detection service.
 * Returns the ML insight object, or null on failure (non-blocking).
 *
 * @param {Array} services  - array of service telemetry objects
 * @returns {Object|null}
 */
async function callMlService(services) {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/ml/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ services }),
      // Timeout: don't let ML slowness block agent response
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`[agent] ML service returned ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Return only the fields the dashboard/agent cares about
    return {
      anomaly:          data.anomaly,
      suspectedService: data.suspectedService,
      confidence:       data.confidence,
      severity:         data.severity,
      reason:           data.reason,
      scores:           data.scores,
    };
  } catch (err) {
    // ML failure must NEVER break the agent — log and continue
    console.warn(`[agent] ML service unavailable: ${err.message}`);
    return null;
  }
}


// ─── 3. Inside your existing /agent/analyze handler ─────────────────────────
//
// Find where you build the telemetry snapshot / services array,
// then add the block below BEFORE you send the response.
//
// Example — adapt to match your actual handler structure:
//
//   router.post("/agent/analyze", async (req, res) => {
//
//     // --- YOUR EXISTING LOGIC (unchanged) ---
//     const services = gatherTelemetry();          // whatever you already do
//     const rca      = performRCA(services);       // existing rule-based RCA
//     const decision = makeDecision(rca);          // existing decision logic
//     const healing  = executeHealing(decision);   // existing healing actions
//
//     // --- ADD THIS BLOCK (new) ---
//     const mlInsight = await callMlService(services);
//
//     // --- YOUR EXISTING RESPONSE (add mlInsight field) ---
//     return res.json({
//       ...yourExistingResponseFields,
//       mlInsight,   // null if ML service was unavailable — dashboard handles gracefully
//     });
//   });
//
// That's it. Nothing else changes.


// ─── 4. Export helper (if using module pattern) ──────────────────────────────
module.exports = { callMlService };
