const { sanitizeTimestamp } = require('../utils/timeWindow');

const MAX_ALERTS = Number(process.env.MAX_ALERTS || 300);
const ALERT_ACTIVE_WINDOW_MS = 10 * 60 * 1000;

const state = {
  requestBySource: new Map(),
  requestBySourceEndpoint: new Map(),
  failedBySource: new Map(),
  failedBySourceUser: new Map(),
  suspiciousSources: new Map(),
  blockedSources: new Map(),
  alertCooldownByKey: new Map(),
  alerts: [],
};

function normalizeIp(sourceIp) {
  return String(sourceIp || 'unknown').trim() || 'unknown';
}

function addAlert(payload) {
  const timestamp = new Date(sanitizeTimestamp(payload.timestamp)).toISOString();
  const alert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: payload.type,
    severity: payload.severity || 'medium',
    service: payload.service || 'security-service',
    sourceIp: normalizeIp(payload.sourceIp),
    message: payload.message || payload.type,
    timestamp,
  };

  state.alerts.unshift(alert);
  if (state.alerts.length > MAX_ALERTS) {
    state.alerts.splice(MAX_ALERTS);
  }

  return alert;
}

function addAlertWithCooldown(payload, cooldownMs = 30000) {
  const sourceIp = normalizeIp(payload.sourceIp);
  const key = `${payload.type}|${sourceIp}|${payload.service || 'security-service'}|${payload.message || ''}`;
  const now = sanitizeTimestamp(payload.timestamp);
  const last = state.alertCooldownByKey.get(key) || 0;

  if (now - last < cooldownMs) {
    return null;
  }

  state.alertCooldownByKey.set(key, now);
  return addAlert({ ...payload, sourceIp, timestamp: now });
}

function markSuspicious(sourceIp, reason, timestamp) {
  const ip = normalizeIp(sourceIp);
  state.suspiciousSources.set(ip, {
    reason,
    timestamp: new Date(sanitizeTimestamp(timestamp)).toISOString(),
  });
}

function blockSource(sourceIp, ttlMs, reason, timestamp) {
  const ip = normalizeIp(sourceIp);
  const now = sanitizeTimestamp(timestamp);
  state.blockedSources.set(ip, {
    reason: reason || 'temporary_block',
    blockedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  });
}

function clearExpiredBlocks() {
  const now = Date.now();
  for (const [ip, meta] of state.blockedSources.entries()) {
    if (new Date(meta.expiresAt).getTime() <= now) {
      state.blockedSources.delete(ip);
    }
  }
}

function getAlerts(limit = 30) {
  return state.alerts.slice(0, limit);
}

function getStatus() {
  clearExpiredBlocks();

  const activeAlerts = state.alerts.filter((alert) => Date.now() - new Date(alert.timestamp).getTime() <= ALERT_ACTIVE_WINDOW_MS);
  const highAlerts = activeAlerts.filter((alert) => alert.severity === 'high' || alert.severity === 'critical').length;

  let overall = 'secure';
  let threatLevel = 'low';

  if (highAlerts > 0 || state.blockedSources.size > 0) {
    overall = 'threat_detected';
    threatLevel = 'high';
  } else if (activeAlerts.length > 0 || state.suspiciousSources.size > 0) {
    overall = 'suspicious';
    threatLevel = 'medium';
  }

  return {
    overall,
    threatLevel,
    activeAlerts: activeAlerts.length,
    blockedSources: Array.from(state.blockedSources.entries()).map(([ip, meta]) => ({ sourceIp: ip, ...meta })),
    suspiciousSources: Array.from(state.suspiciousSources.entries()).map(([ip, meta]) => ({ sourceIp: ip, ...meta })),
  };
}

function resetState() {
  state.requestBySource.clear();
  state.requestBySourceEndpoint.clear();
  state.failedBySource.clear();
  state.failedBySourceUser.clear();
  state.suspiciousSources.clear();
  state.blockedSources.clear();
  state.alertCooldownByKey.clear();
  state.alerts = [];
}

module.exports = {
  state,
  normalizeIp,
  addAlert,
  addAlertWithCooldown,
  markSuspicious,
  blockSource,
  getAlerts,
  getStatus,
  resetState,
};
