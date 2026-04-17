const express = require("express");
const router = express.Router();

const { getSystemStatus, aggregateSystemHealth } = require("../services/monitor.service");
const { analyzeRootCause } = require("../services/rca.service");
const { decideRemediation } = require("../services/decision.service");
const { executeRemediation } = require("../services/remediation.service");
const { runAdvancedHeal } = require("../services/advanced-heal.service");
const { runScaleHeal } = require("../services/scale-heal.service");
const { inspectMessagingDeployment } = require("../services/kubernetes.service");
const { getMlInsight } = require("../services/ml-insight.service");

const DEBUG = process.env.DEBUG_SIMULATION === 'true' || process.env.DEBUG_MONITOR === 'true';

router.get("/status", async (req, res) => {
  try {
    const result = await getSystemStatus();

    res.json({
      success: true,
      monitoring: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get monitoring status",
      error: error.message
    });
  }
});

router.get("/analyze", async (req, res) => {
  try {
    const baseMonitoring = await getSystemStatus();
    const kubernetesSignals = await inspectMessagingDeployment();
    const rca = analyzeRootCause(baseMonitoring, kubernetesSignals);
    const decision = await decideRemediation(rca, baseMonitoring, kubernetesSignals);
    const monitoring = aggregateSystemHealth(baseMonitoring, kubernetesSignals, rca, decision);
    const mlInsight = await getMlInsight(monitoring, kubernetesSignals);

    const ml = mlInsight
      ? {
          anomaly: mlInsight.anomaly,
          service: mlInsight.suspectedService,
          confidence: mlInsight.confidence,
          reason: mlInsight.reason,
        }
      : null;

    if (DEBUG) {
      console.log('[/agent/analyze] Response:', {
        overall: monitoring.overall,
        services: monitoring.services?.map(s => ({ 
          service: s.service, 
          health: s.health, 
          mode: s.mode 
        })),
        ml: ml ? { anomaly: ml.anomaly, service: ml.service } : null
      });
    }

    res.json({
      success: true,
      monitoring,
      kubernetesSignals,
      rca,
      decision,
      ml,
      mlInsight,
    });
  } catch (error) {
    console.error('[/agent/analyze] Error:', error.message);
    res.status(500).json({
      success: false,
      message: "Failed to analyze root cause",
      error: error.message
    });
  }
});

router.post("/advanced-heal", async (req, res) => {
  try {
    const result = await runAdvancedHeal();

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to execute advanced healing flow",
      error: error.message
    });
  }
});
const { analyzeLogs } = require('../services/logAnalyzer');

// GET /agent/log-analysis
router.get('/log-analysis', (req, res) => {
    // Simulated raw logs (Replace with real log fetching if you have it)
    const mockRawLogs = [
        "INFO: Service started",
        "WARN: Retrying connection to DB...",
        "ERROR: DB connection timeout",
        "WARN: Retrying connection to DB...",
        "ERROR: DB connection timeout",
        "CRITICAL: Traffic Tsunami Detected! Memory overflowing...",
        "ERROR: Out of memory (OOM)",
        "INFO: Healthcheck ping ok"
    ];
    
    // Generate 1000+ noisy logs to prove compression works
    for(let i=0; i<1200; i++) mockRawLogs.push("INFO: Background job running perfectly...");

    const analysisResult = analyzeLogs(mockRawLogs);
    res.json(analysisResult);
});
router.post("/scale-heal", async (req, res) => {
  try {
    const result = await runScaleHeal();

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to execute scale healing flow",
      error: error.message
    });
  }
});

router.post("/heal", async (req, res) => {
  try {
    const monitoringBefore = await getSystemStatus();
    const rca = analyzeRootCause(monitoringBefore);
    const decision = await decideRemediation(rca, monitoringBefore);
    const remediation = await executeRemediation(decision);
    const monitoringAfter = await getSystemStatus();

    res.json({
      success: true,
      monitoringBefore,
      rca,
      decision,
      remediation,
      monitoringAfter
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to execute healing flow",
      error: error.message
    });
  }
});

// ML Prediction Endpoint
router.post("/predict", async (req, res) => {
  try {
    const { telemetry, serviceName = "target-service" } = req.body;

    if (!telemetry || !Array.isArray(telemetry) || telemetry.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request: telemetry array is required",
        example: {
          telemetry: [
            {
              cpu_percent: 45.5,
              memory_mb: 512,
              latency_ms: 150,
              restart_count: 0,
              error_count: 2,
              requests_per_sec: 250,
              active_connections: 75,
              replicas: 3,
              available_replicas: 3,
              is_reachable: 1
            }
          ],
          serviceName: "target-service"
        }
      });
    }

    const mlInsight = await getMlInsight({ services: [] }, {}, telemetry);

    if (!mlInsight) {
      return res.status(503).json({
        success: false,
        message: "ML models not available or failed to load"
      });
    }

    res.json({
      success: true,
      prediction: {
        anomaly_detected: mlInsight.anomaly,
        suspected_service: mlInsight.suspectedService || serviceName,
        confidence: mlInsight.confidence,
        reason: mlInsight.reason,
        recommendations: mlInsight.recommendations || [],
        ml_insight: mlInsight
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to run ML prediction",
      error: error.message
    });
  }
});

// Health Check Endpoint
router.get("/health", async (req, res) => {
  try {
    const status = await getSystemStatus();
    const isHealthy = status && status.services && status.services.length > 0;

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      service: "agent-service",
      monitoring: status
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      message: "Failed to get service status",
      error: error.message,
      timestamp: new Date().toISOString(),
      service: "agent-service"
    });
  }
});

// ML Model Health Check
router.post("/ml/healthcheck", async (req, res) => {
  try {
    // Test telemetry to check if ML models are loaded
    const testTelemetry = [
      {
        cpu_percent: 50,
        memory_mb: 512,
        latency_ms: 120,
        restart_count: 0,
        error_count: 0,
        requests_per_sec: 200,
        active_connections: 50,
        replicas: 1,
        available_replicas: 1,
        is_reachable: 1
      }
    ];

    const mlInsight = await getMlInsight({ services: [] }, { telemetryWindow: testTelemetry });
    const isHealthy = mlInsight !== null && mlInsight !== undefined;

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? "healthy" : "degraded",
      ml_models: {
        classifier: isHealthy ? "loaded" : "not_loaded",
        label_encoder: isHealthy ? "loaded" : "not_loaded",
        anomaly_detector: isHealthy ? "loaded" : "not_loaded"
      },
      timestamp: new Date().toISOString(),
      service: "agent-service-ml"
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      message: "ML models health check failed",
      error: error.message,
      ml_models: {
        classifier: "error",
        label_encoder: "error",
        anomaly_detector: "error"
      },
      timestamp: new Date().toISOString(),
      service: "agent-service-ml"
    });
  }
});

module.exports = router;