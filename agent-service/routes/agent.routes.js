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

module.exports = router;