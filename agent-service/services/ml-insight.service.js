const { safePost } = require("../utils/http");

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || "http://ml-service:5050").replace(/\/+$/, "");

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function inferLatency(service) {
  const rawLatency = service?.raw?.latency;
  if (typeof rawLatency === "number" && Number.isFinite(rawLatency)) {
    return rawLatency;
  }

  const mode = normalize(service?.mode);
  if (mode === "latency") return 1200;
  if (mode === "error" || mode === "crash") return 3000;
  if (mode === "overload") return 5000;
  return 120;
}

function buildTelemetryPayload(monitoring = {}, kubernetesSignals = {}) {
  const services = Array.isArray(monitoring?.services) ? monitoring.services : [];
  const restartCount = Number(kubernetesSignals?.restartCount) || 0;
  const replicas = Number(kubernetesSignals?.deploymentAvailableReplicas ?? kubernetesSignals?.deploymentReplicas) || 1;
  const overloadFromK8s = Boolean(kubernetesSignals?.resourceOverload);

  return {
    services: services.map((service) => {
      const serviceName = service?.service || "unknown-service";
      const mode = normalize(service?.mode);
      const isMessaging = normalize(serviceName) === "messaging-service";

      return {
        service: serviceName,
        latency: inferLatency(service),
        restartCount: isMessaging ? restartCount : 0,
        error: mode === "error",
        crash: mode === "crash",
        overload: mode === "overload" || (isMessaging && overloadFromK8s),
        reachable: service?.reachable !== false,
        replicas: isMessaging ? replicas : 1
      };
    })
  };
}

function sanitizeInsight(data = {}) {
  if (!data || typeof data !== "object") return null;

  return {
    anomaly: Boolean(data.anomaly),
    suspectedService: data.suspectedService || null,
    confidence: Number(data.confidence) || 0,
    severity: data.severity || "low",
    reason: data.reason || "No ML anomaly reason provided",
    scores: Array.isArray(data.scores)
      ? data.scores.map((score) => ({
          service: score?.service || "unknown-service",
          anomaly: Boolean(score?.anomaly),
          score: Number(score?.score) || 0
        }))
      : []
  };
}

async function getMlInsight(monitoring = {}, kubernetesSignals = {}) {
  const telemetry = buildTelemetryPayload(monitoring, kubernetesSignals);

  if (!Array.isArray(telemetry.services) || telemetry.services.length === 0) {
    return null;
  }

  const response = await safePost(`${ML_SERVICE_URL}/ml/analyze`, telemetry);
  if (!response.ok) {
    return null;
  }

  return sanitizeInsight(response.data);
}

module.exports = {
  getMlInsight,
  buildTelemetryPayload
};
