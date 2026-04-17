require('dotenv').config();

const express = require('express');
const cors = require('cors');
const promClient = require('prom-client');

const securityRoutes = require('./routes/security.routes');

const app = express();
const PORT = Number(process.env.PORT) || 3005;

promClient.collectDefaultMetrics();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'security-service' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

app.use('/security', securityRoutes);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Security Service listening on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use`);
    process.exit(1);
  }
  throw err;
});
