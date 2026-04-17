const express = require('express');
const router = express.Router();

let leakArray = [];

router.get('/memory', (req, res) => {
  console.log('Chaos triggered: Memory Leak Started');
  // Intentional memory leak: push 10MB of data continually
  const interval = setInterval(() => {
    leakArray.push(new Array(1024 * 1024).join('x'));
    console.log(`Leaked memory, array size: ${leakArray.length}`);
  }, 100);

  res.send('Memory chaos triggered. Watch memory usage spike.');
});

module.exports = router;
