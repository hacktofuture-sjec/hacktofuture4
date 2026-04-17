const { recordInWindow } = require('../utils/timeWindow');
const { state, addAlertWithCooldown, markSuspicious } = require('../store/securityStore');

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 10000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 35);

function evaluateRateLimit(event) {
  const sourceIp = event.sourceIp;
  const service = event.service || 'unknown-service';
  const endpoint = event.endpoint || '/unknown';

  const entries = recordInWindow(state.requestBySource, sourceIp, event.timestamp, RATE_LIMIT_WINDOW_MS, 600);
  const count = entries.length;

  if (count > RATE_LIMIT_MAX_REQUESTS) {
    markSuspicious(sourceIp, 'rate_limit_exceeded', event.timestamp);
    addAlertWithCooldown({
      type: 'traffic_abuse',
      severity: 'high',
      service,
      sourceIp,
      message: `Rate threshold exceeded (${count}/${RATE_LIMIT_MAX_REQUESTS}) on ${endpoint}`,
      timestamp: event.timestamp,
    });

    return { flagged: true, count, threshold: RATE_LIMIT_MAX_REQUESTS };
  }

  return { flagged: false, count, threshold: RATE_LIMIT_MAX_REQUESTS };
}

module.exports = {
  evaluateRateLimit,
};
