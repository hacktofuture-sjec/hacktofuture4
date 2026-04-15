function analyzeRootCause(monitoring, kubernetesSignals = {}) {
  const services = monitoring.services || [];

  const auth = services.find((s) => s.service === "auth-service");
  const messaging = services.find((s) => s.service === "messaging-service");
  const presence = services.find((s) => s.service === "presence-service");

  let rootCause = null;
  let reason = "No active issue detected";
  let severity = "none";

  if (messaging) {
    if (messaging.mode === "crash") {
      rootCause = "messaging-service";
      reason = "Messaging service is in crash mode";
      severity = "high";
    } else if (messaging.mode === "error") {
      rootCause = "messaging-service";
      reason = "Messaging service is returning errors";
      severity = "high";
    } else if (messaging.mode === "latency") {
      rootCause = "messaging-service";
      reason = "Messaging service is delayed and degrading chat delivery";
      severity = "medium";
    }
  }

  if (kubernetesSignals?.persistentFailure && kubernetesSignals?.logsContainKeyword) {
    rootCause = "messaging-service";
    reason = "Messaging pod is restarting repeatedly and logs show Too Many Connections, which points to a configuration issue";
    severity = "critical";
  }

  if (kubernetesSignals?.resourceOverload) {
    rootCause = "messaging-service";
    reason = "The messaging pod is under extreme traffic load and memory pressure, causing repeated crashes";
    severity = "high";
  }

  if (!rootCause && presence) {
    if (presence.mode === "crash") {
      rootCause = "presence-service";
      reason = "Presence service is in crash mode";
      severity = "medium";
    } else if (presence.mode === "error") {
      rootCause = "presence-service";
      reason = "Presence service is returning errors";
      severity = "medium";
    } else if (presence.mode === "latency") {
      rootCause = "presence-service";
      reason = "Presence service is delayed and may affect online/offline updates";
      severity = "low";
    }
  }

  if (!rootCause && auth) {
    if (auth.mode === "crash") {
      rootCause = "auth-service";
      reason = "Auth service is in crash mode";
      severity = "medium";
    } else if (auth.mode === "error") {
      rootCause = "auth-service";
      reason = "Auth service is returning errors";
      severity = "medium";
    } else if (auth.mode === "latency") {
      rootCause = "auth-service";
      reason = "Auth service is delayed and may affect login requests";
      severity = "low";
    }
  }

  return {
    rootCause,
    reason,
    severity,
    rootCauseType: kubernetesSignals?.persistentFailure && kubernetesSignals?.logsContainKeyword
      ? "configuration"
      : kubernetesSignals?.resourceOverload
        ? "resource_overload"
      : "runtime",
    evidence: kubernetesSignals?.persistentFailure
      ? {
          restartCount: kubernetesSignals.restartCount || 0,
          restartAgeMs: kubernetesSignals.restartAgeMs || 0,
          logsContainKeyword: Boolean(kubernetesSignals.logsContainKeyword)
        }
      : kubernetesSignals?.resourceOverload
        ? {
            restartCount: kubernetesSignals.restartCount || 0,
            detectedKeywords: kubernetesSignals.detectedKeywords || []
          }
      : undefined,
    analyzedAt: new Date().toISOString()
  };
}

module.exports = {
  analyzeRootCause
};