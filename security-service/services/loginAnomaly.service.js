const { recordInWindow } = require('../utils/timeWindow');
const { state, addAlertWithCooldown, markSuspicious, blockSource } = require('../store/securityStore');

const FAILED_LOGIN_WINDOW_MS = Number(process.env.FAILED_LOGIN_WINDOW_MS || 5 * 60 * 1000);
const FAILED_LOGIN_THRESHOLD = Number(process.env.FAILED_LOGIN_THRESHOLD || 5);
const FAILED_LOGIN_USER_THRESHOLD = Number(process.env.FAILED_LOGIN_USER_THRESHOLD || 4);
const BLOCK_TTL_MS = Number(process.env.BLOCK_TTL_MS || 10 * 60 * 1000);

function detectFailedLoginAnomaly(event) {
  const sourceIp = event.sourceIp;
  const username = event.username || 'unknown-user';
  const service = event.service || 'auth-service';

  const bySource = recordInWindow(state.failedBySource, sourceIp, event.timestamp, FAILED_LOGIN_WINDOW_MS, 400);
  const bySourceUser = recordInWindow(state.failedBySourceUser, `${sourceIp}|${username}`, event.timestamp, FAILED_LOGIN_WINDOW_MS, 300);

  const sourceExceeded = bySource.length >= FAILED_LOGIN_THRESHOLD;
  const userExceeded = bySourceUser.length >= FAILED_LOGIN_USER_THRESHOLD;

  if (sourceExceeded || userExceeded) {
    markSuspicious(sourceIp, 'possible_bruteforce', event.timestamp);

    if (bySource.length >= FAILED_LOGIN_THRESHOLD + 2) {
      blockSource(sourceIp, BLOCK_TTL_MS, 'possible_bruteforce', event.timestamp);
    }

    addAlertWithCooldown({
      type: 'possible_bruteforce',
      severity: 'high',
      service,
      sourceIp,
      message: `Failed login anomaly for ${username} (${bySourceUser.length} by user, ${bySource.length} by source)` ,
      timestamp: event.timestamp,
    });

    return {
      flagged: true,
      sourceFailures: bySource.length,
      userFailures: bySourceUser.length,
    };
  }

  return {
    flagged: false,
    sourceFailures: bySource.length,
    userFailures: bySourceUser.length,
  };
}

module.exports = {
  detectFailedLoginAnomaly,
};
