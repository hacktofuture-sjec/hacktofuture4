const { safeGet } = require("../utils/http");

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL;
const PRESENCE_SERVICE_URL = process.env.PRESENCE_SERVICE_URL;
const AUTH_SERVICE_PUBLIC_URL = process.env.AUTH_SERVICE_PUBLIC_URL;
const MESSAGING_SERVICE_PUBLIC_URL = process.env.MESSAGING_SERVICE_PUBLIC_URL;
const PRESENCE_SERVICE_PUBLIC_URL = process.env.PRESENCE_SERVICE_PUBLIC_URL;
const EARLY_HEAL_RESTART_THRESHOLD = Number(process.env.EARLY_HEAL_RESTART_THRESHOLD) || 2;
const DEBUG = process.env.DEBUG_MONITOR === 'true' || process.env.DEBUG_SIMULATION === 'true';

function normalizeBaseUrl(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

function uniqueUrls(urls) {
  return Array.from(new Set(urls.filter(Boolean)));
}

function healthRank(health) {
  const normalized = String(health || "").toLowerCase();
  if (normalized === "down" || normalized === "critical") return 3;
  if (normalized === "degraded") return 2;
  if (normalized === "healthy") return 1;
  return 0;
}

function pickWorstStatus(serviceName, statuses) {
  if (!statuses.length) {
    return {
      service: serviceName,
      reachable: false,
      health: "down",
      mode: "unknown",
      raw: { reason: "No status candidates available" }
    };
  }

  const sorted = [...statuses].sort((a, b) => healthRank(b.health) - healthRank(a.health));
  return sorted[0];
}

function normalizeServiceStatus(serviceName, response) {
  if (!response.ok) {
    const status = {
      service: serviceName,
      reachable: false,
      health: "down",
      mode: "unknown",
      raw: response
    };
    if (DEBUG) console.log(`[monitor] ${serviceName}: down (unreachable)`);
    return status;
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

  const status = {
    service: serviceName,
    reachable: true,
    health,
    mode,
    raw: data
  };

  if (DEBUG) {
    console.log(`[monitor] ${serviceName}:`, { health, mode, state });
  }

  return status;
}

async function getServiceStatusFromCandidates(serviceName, urls) {
  const candidates = uniqueUrls(urls.map(normalizeBaseUrl));
  if (!candidates.length) {
    if (DEBUG) {
      console.log(`[monitor] ${serviceName}: no configured service URLs`);
    }
    return {
      service: serviceName,
      reachable: false,
      health: "down",
      mode: "unknown",
      raw: { reason: "No configured service URLs" }
    };
  }

  const responses = await Promise.all(
    candidates.map((url) => safeGet(`${url}/simulate/status`))
  );

  const statuses = responses.map((res, index) => {
    const status = normalizeServiceStatus(serviceName, res);
    return {
      ...status,
      sourceUrl: candidates[index]
    };
  });

  const chosen = pickWorstStatus(serviceName, statuses);

  if (DEBUG) {
    const summary = statuses.map((s) => ({
      sourceUrl: s.sourceUrl,
      health: s.health,
      mode: s.mode,
      reachable: s.reachable
    }));
    console.log(`[monitor] ${serviceName} candidates:`, summary);
    console.log(`[monitor] ${serviceName} selected source:`, {
      sourceUrl: chosen.sourceUrl,
      health: chosen.health,
      mode: chosen.mode
    });
  }

  return chosen;
}

async function getSystemStatus() {
  const [auth, messaging, presence] = await Promise.all([
    getServiceStatusFromCandidates("auth-service", [AUTH_SERVICE_URL, AUTH_SERVICE_PUBLIC_URL]),
    getServiceStatusFromCandidates("messaging-service", [MESSAGING_SERVICE_URL, MESSAGING_SERVICE_PUBLIC_URL]),
    getServiceStatusFromCandidates("presence-service", [PRESENCE_SERVICE_URL, PRESENCE_SERVICE_PUBLIC_URL])
  ]);

  const services = [auth, messaging, presence];

  let overall = "healthy";

  if (services.some((s) => s.health === "down")) {
    overall = "critical";
  } else if (services.some((s) => s.health === "degraded")) {
    overall = "degraded";
  }

  if (DEBUG) {
    console.log(`[monitor] System status check complete:`, {
      overall,
      services: services.map(s => ({ service: s.service, health: s.health, mode: s.mode }))
    });
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