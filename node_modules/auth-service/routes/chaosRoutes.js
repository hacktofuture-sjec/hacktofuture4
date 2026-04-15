const express = require('express');
const router = express.Router();

router.get('/cpu', (req, res) => {
  console.log('Chaos triggered: CPU Spike Started');
  const start = Date.now();
  // Spike CPU for 5 seconds
  while (Date.now() - start < 5000) {
    // doing nothing, just blocking the event loop
  }
  res.send('CPU Chaos Executed for 5 seconds');
});

module.exports = router;
