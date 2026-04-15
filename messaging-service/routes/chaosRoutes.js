const express = require('express');
const router = express.Router();

router.get('/crash', (req, res) => {
  console.log('Chaos triggered: Crashing Messaging Service');
  res.send('Crashing service in 1 second...');
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

module.exports = router;
