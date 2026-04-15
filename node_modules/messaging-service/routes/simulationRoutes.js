const express = require('express');
const router = express.Router();
const simulationState = require('../simulationState');
const fs = require('fs');
const path = require('path');

const OVERLOAD_FLAG_PATH = process.env.OVERLOAD_FLAG_PATH || path.join('/tmp', 'nova-chat-overload.flag');

const persistOverloadFlag = () => {
  fs.writeFileSync(OVERLOAD_FLAG_PATH, 'enabled', 'utf8');
};

const clearOverloadFlag = () => {
  try {
    fs.unlinkSync(OVERLOAD_FLAG_PATH);
  } catch {
    // ignore missing flag
  }
};

const scheduleOverloadExit = () => {
  setTimeout(() => {
    console.error('CRITICAL: Traffic Tsunami Detected! Memory overflowing... System is under extreme load!');
    process.exit(1);
  }, 1500);
};

// Enable crash simulation
router.post('/crash', (req, res) => {
  simulationState.crash = true;
  console.log('[Simulation] Crash mode ENABLED');
  res.json({ status: 'Crash simulation enabled', state: simulationState });
});

// Enable error simulation
router.post('/error', (req, res) => {
  simulationState.error = true;
  console.log('[Simulation] Error mode ENABLED');
  res.json({ status: 'Error simulation enabled', state: simulationState });
});

// Enable latency simulation
router.post('/latency', (req, res) => {
  simulationState.latency = true;
  console.log('[Simulation] Latency mode ENABLED');
  res.json({ status: 'Latency simulation enabled', state: simulationState });
});

// Enable overload simulation
router.post('/overload', (req, res) => {
  simulationState.overload = true;
  persistOverloadFlag();
  console.error('CRITICAL: Traffic Tsunami Detected! Memory overflowing... System is under extreme load!');
  scheduleOverloadExit();
  res.json({ status: 'Overload simulation enabled', state: simulationState });
});

// Recover from all simulations
router.post('/recover', (req, res) => {
  simulationState.crash = false;
  simulationState.error = false;
  simulationState.latency = false;
  simulationState.overload = false;
  clearOverloadFlag();
  console.log('[Simulation] All simulations RECOVERED');
  res.json({ status: 'All simulations recovered', state: simulationState });
});

// Get current simulation status
router.get('/status', (req, res) => {
  res.json({ state: simulationState });
});

module.exports = router;
