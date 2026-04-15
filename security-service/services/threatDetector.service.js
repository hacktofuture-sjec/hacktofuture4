const { recordInWindow } = require('../utils/timeWindow');
const { state, addAlertWithCooldown, markSuspicious } = require('../store/securityStore');

const SUSPICIOUS_WINDOW_MS = Number(process.env.SUSPICIOUS_WINDOW_MS || 15000);
const SUSPICIOUS_ENDPOINT_HITS = Number(process.env.SUSPICIOUS_ENDPOINT_HITS || 20);

function detectSuspiciousTraffic(event) {
  const sourceIp = event.sourceIp;
  const endpoint = event.endpoint || '/unknown';
  const service = event.service || 'unknown-service';

  const endpointKey = `${sourceIp}|${endpoint}`;
  const byEndpoint = recordInWindow(state.requestBySourceEndpoint, endpointKey, event.timestamp, SUSPICIOUS_WINDOW_MS, 600);

  const suspiciousEndpoints = ['/login', '/signup', '/register', '/admin', '/metrics'];
  const endpointLooksSensitive = suspiciousEndpoints.some((pattern) => endpoint.includes(pattern));

  if (byEndpoint.length >= SUSPICIOUS_ENDPOINT_HITS) {
    markSuspicious(sourceIp, 'suspicious_endpoint_access', event.timestamp);
    addAlertWithCooldown({
      type: endpointLooksSensitive ? 'suspicious_endpoint_access' : 'traffic_abuse',
      severity: endpointLooksSensitive ? 'high' : 'medium',
      service,
      sourceIp,
      message: `${byEndpoint.length} rapid hits to ${endpoint}`,
      timestamp: event.timestamp,
    });

    return { flagged: true, endpointHits: byEndpoint.length };
  }

  return { flagged: false, endpointHits: byEndpoint.length };
}

module.exports = {
  detectSuspiciousTraffic,
};
