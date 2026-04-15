const { safeGet } = require("../utils/http");

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL;
const PRESENCE_SERVICE_URL = process.env.PRESENCE_SERVICE_URL;
const EARLY_HEAL_RESTART_THRESHOLD = Number(process.env.EARLY_HEAL_RESTART_THRESHOLD) || 2;

function normalizeServiceStatus(serviceName, response) {
  if (!response.ok) {
    return {
      service: serviceName,
      reachable: false,
      health: "down",
      mode: "unknown",
      raw: response
    };
  }

  const data = response.data || {};
  const state = data.state || data || {};

  const crash = state.crash === true;
  const error = state.error === true;
  const latency = state.latency === true;

  let health = "healthy";
  let mode = "normal";

  if (crash) {
    health = "down";
    mode = "crash";
  } else if (error) {
    health = "down";
    mode = "error";
  } else if (latency) {
    health = "degraded";
    mode = "latency";
  }

  return {
    service: serviceName,
    reachable: true,
    health,
    mode,
    raw: data
  };
}

async function getSystemStatus() {
  const [authRes, messagingRes, presenceRes] = await Promise.all([
    safeGet(`${AUTH_SERVICE_URL}/simulate/status`),
    safeGet(`${MESSAGING_SERVICE_URL}/simulate/status`),
    safeGet(`${PRESENCE_SERVICE_URL}/simulate/status`)
  ]);

  const auth = normalizeServiceStatus("auth-service", authRes);
  const messaging = normalizeServiceStatus("messaging-service", messagingRes);
  const presence = normalizeServiceStatus("presence-service", presenceRes);

  const services = [auth, messaging, presence];

  let overall = "healthy";

  if (services.some((s) => s.health === "down")) {
    overall = "critical";
  } else if (services.some((s) => s.health === "degraded")) {
    overall = "degraded";
  }

  return {
    overall,
    timestamp: new Date().toISOString(),
    services
  };
}

function aggregateSystemHealth(monitoring, kubernetesSignals = {}, rca = {}, decision = {}) {
  const baseMonitoring = monitoring || {};
  const services = Array.isArray(baseMonitoring.services)
    ? baseMonitoring.services.map((service) => ({ ...service }))
    : [];

  const restartCount = Number(kubernetesSignals?.restartCount) || 0;
  const resourceOverload = Boolean(kubernetesSignals?.resourceOverload);
  const overloadKeywordDetected = Boolean(kubernetesSignals?.logsContainKeyword)
    || (Array.isArray(kubernetesSignals?.detectedKeywords) && kubernetesSignals.detectedKeywords.length > 0);
  const overloadEvidence = resourceOverload || overloadKeywordDetected;
  const restartInstability = restartCount >= EARLY_HEAL_RESTART_THRESHOLD;
  const anyServiceDown = services.some((service) => service.health === "down");
  const anyServiceDegraded = services.some((service) => service.health === "degraded");

  const hasCriticalRca = Boolean(rca?.rootCause) && ["critical", "high"].includes(String(rca?.severity || "").toLowerCase());
  const hasActiveRca = Boolean(rca?.rootCause);
  const needsRemediation = Boolean(decision?.actionNeeded);
  const messagingRootCause = rca?.rootCause === "messaging-service";

  const messaging = services.find((service) => service.service === "messaging-service");
  if (messaging) {
    if (overloadEvidence || (restartInstability && messagingRootCause)) {
      if (messaging.health !== "down") {
        messaging.health = "critical";
      }
      messaging.mode = "overload";
    } else if (restartCount > 0 || messagingRootCause || (needsRemediation && decision?.target === "messaging-service")) {
      if (messaging.health === "healthy") {
        messaging.health = "degraded";
      }
      if (messaging.mode === "normal") {
        messaging.mode = "degraded";
      }
    }
  }

  let overall = "healthy";
  if (anyServiceDown || overloadEvidence || (restartInstability && messagingRootCause) || hasCriticalRca) {
    overall = "critical";
  } else if (anyServiceDegraded || restartCount > 0 || hasActiveRca || needsRemediation) {
    overall = "degraded";
  }

  return {
    ...baseMonitoring,
    overall,
    services
  };
}

module.exports = {
  getSystemStatus,
  aggregateSystemHealth
};