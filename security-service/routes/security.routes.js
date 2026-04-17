const express = require('express');
const { sanitizeTimestamp } = require('../utils/timeWindow');
const {
  normalizeIp,
  addAlert,
  blockSource,
  getAlerts,
  getStatus,
  resetState,
} = require('../store/securityStore');
const { evaluateRateLimit } = require('../services/rateLimiter.service');
const { detectSuspiciousTraffic } = require('../services/threatDetector.service');
const { detectFailedLoginAnomaly } = require('../services/loginAnomaly.service');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json(getStatus());
});

router.get('/alerts', (req, res) => {
  const limit = Number(req.query.limit || 40);
  res.json({ alerts: getAlerts(limit) });
});

router.post('/report/request', (req, res) => {
  const event = {
    sourceIp: normalizeIp(req.body?.sourceIp || req.ip),
    service: req.body?.service || 'unknown-service',
    endpoint: req.body?.endpoint || '/unknown',
    method: req.body?.method || 'GET',
    timestamp: sanitizeTimestamp(req.body?.timestamp),
  };

  const rateResult = evaluateRateLimit(event);
  const suspiciousResult = detectSuspiciousTraffic(event);

  res.json({
    success: true,
    rate: rateResult,
    suspicious: suspiciousResult,
  });
});
router.post('/simulate/attack', (req, res) => {
  const eventsCount = Number(req.body?.count || 25);

  const simulatedEvents = [];

  for (let i = 0; i < eventsCount; i++) {
    const event = {
      sourceIp: normalizeIp('simulated-attacker'),
      service: 'messaging-service',
      endpoint: '/messages/send',
      method: 'POST',
      timestamp: sanitizeTimestamp(),
    };

    evaluateRateLimit(event);
    detectSuspiciousTraffic(event);

    simulatedEvents.push(event);
  }

  addAlert({
    type: 'traffic_abuse',
    severity: 'high',
    service: 'security-service',
    sourceIp: 'simulated-attacker',
    message: `Simulated DDoS attack with ${eventsCount} requests`,
    timestamp: sanitizeTimestamp(),
  });

  const status = getStatus();

  res.json({
    success: true,
    message: 'Simulated attack executed',
    eventsGenerated: eventsCount,
    overall: status.overall,
  });
});

router.post('/report/login-failure', (req, res) => {
  const event = {
    sourceIp: normalizeIp(req.body?.sourceIp || req.ip),
    username: String(req.body?.username || '').trim() || 'unknown-user',
    service: req.body?.service || 'auth-service',
    timestamp: sanitizeTimestamp(req.body?.timestamp),
  };

  const result = detectFailedLoginAnomaly(event);

  res.json({ success: true, anomaly: result });
});

router.post('/reset', (req, res) => {
  resetState();
  res.json({ success: true, message: 'Security state reset complete' });
});

router.post('/block/ip', (req, res) => {
  const sourceIp = normalizeIp(req.body?.sourceIp);
  if (!sourceIp || sourceIp === 'unknown') {
    return res.status(400).json({ error: 'sourceIp is required' });
  }

  const ttlMs = Number(req.body?.ttlMs || process.env.BLOCK_TTL_MS || 10 * 60 * 1000);
  blockSource(sourceIp, ttlMs, req.body?.reason || 'manual_block', req.body?.timestamp);

  addAlert({
    type: 'manual_block',
    severity: 'medium',
    service: req.body?.service || 'security-service',
    sourceIp,
    message: `Source ${sourceIp} blocked manually`,
    timestamp: req.body?.timestamp,
  });

  return res.json({ success: true, sourceIp, ttlMs });
});

module.exports = router;
