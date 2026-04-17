const express = require('express');
const router = express.Router();
const simulationState = require('../simulationState');

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

// Recover from all simulations
router.post('/recover', (req, res) => {
  simulationState.crash = false;
  simulationState.error = false;
  simulationState.latency = false;
  console.log('[Simulation] All simulations RECOVERED');
  res.json({ status: 'All simulations recovered', state: simulationState });
});

// Get current simulation status
router.get('/status', (req, res) => {
  res.json({ state: simulationState });
});

module.exports = router;
