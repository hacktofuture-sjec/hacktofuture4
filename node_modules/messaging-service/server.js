require("dotenv").config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const promClient = require('prom-client');

const chaosRoutes = require('./routes/chaosRoutes');
const simulationRoutes = require('./routes/simulationRoutes');
const setupSocketHandlers = require('./socket/handlers');

const Message = require('./models/Message');
const simulationState = require('./simulationState');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = Number(process.env.PORT) || Number(process.env.MESSAGING_SERVICE_PORT) || Number(process.env.MESSAGING_PORT) || 3002;
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS) || 2;
const OVERLOAD_FLAG_PATH = process.env.OVERLOAD_FLAG_PATH || path.join('/tmp', 'nova-chat-overload.flag');
const SECURITY_SERVICE_URL = (process.env.SECURITY_SERVICE_URL || 'http://localhost:3005').replace(/\/+$/, '');
const SECURITY_REPORT_MIN_INTERVAL_MS = Number(process.env.SECURITY_REPORT_MIN_INTERVAL_MS || 2000);

const securityReportCache = new Map();

const getSourceIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return (req.socket?.remoteAddress || req.ip || 'unknown').toString();
};

const shouldReportSecurity = (sourceIp, endpoint) => {
  const now = Date.now();
  const key = `${sourceIp}|${endpoint}`;
  const last = securityReportCache.get(key) || 0;
  if (now - last < SECURITY_REPORT_MIN_INTERVAL_MS) {
    return false;
  }
  securityReportCache.set(key, now);
  return true;
};

const reportSecurityRequest = async ({ sourceIp, endpoint, method = 'GET', service = 'messaging-service' }) => {
  try {
    if (!shouldReportSecurity(sourceIp, endpoint)) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    await fetch(`${SECURITY_SERVICE_URL}/security/report/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceIp,
        service,
        endpoint,
        method,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch (err) {
    // Security telemetry must not affect messaging flow.
    console.warn('[Messaging] Security report skipped:', err.message);
  }
};

const isOverloadEnabled = () => {
  try {
    return fs.existsSync(OVERLOAD_FLAG_PATH);
  } catch {
    return false;
  }
};

const crashForOverload = () => {
  console.error('CRITICAL: Traffic Tsunami Detected! Memory overflowing... System is under extreme load!');
  setTimeout(() => {
    process.exit(1);
  }, 1500);
};

const getUserMessages = async (req, res) => {
  if (simulationState.crash) return res.status(500).json({ error: 'Simulated crash' });
  if (simulationState.error) return res.status(500).json({ error: 'Simulated error' });
  if (simulationState.latency) await new Promise(r => setTimeout(r, 5000));

  try {
    const { userId } = req.params;
    reportSecurityRequest({
      sourceIp: getSourceIp(req),
      endpoint: `/messages/${userId}`,
      method: req.method,
    });

    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }]
    }).sort({ timestamp: 1 });

    res.json(messages);
  } catch {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

let activeSocketConnections = 0;

const handleTooManyConnections = (socket, reason) => {
  console.error(`[Messaging] Too Many Connections: ${reason}`);

  if (socket && socket.connected) {
    socket.emit('message_error', { error: 'Too Many Connections' });
    socket.disconnect(true);
  }

  setTimeout(() => {
    process.exit(1);
  }, 250);
};

// ✅ MongoDB connection (ONLY ONCE)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Messaging Service MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Prometheus
promClient.collectDefaultMetrics();

// Middleware
app.use(cors());
app.use(express.json());

// Metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

if (isOverloadEnabled()) {
  console.error('[Messaging] Overload flag detected on startup');
  crashForOverload();
}

// Routes
app.use('/api/chaos', chaosRoutes);
app.use('/simulate', simulationRoutes);

// Message API
app.get('/messages/:userId', getUserMessages);
app.get('/api/messaging/messages/:userId', getUserMessages);

// Socket
setupSocketHandlers(io, {
  maxConnections: MAX_CONNECTIONS,
  reportSecurityRequest,
  onConnectionCountChange: (count) => {
    activeSocketConnections = count;
    if (count > MAX_CONNECTIONS) {
      handleTooManyConnections(null, `active socket connections ${count} exceeded MAX_CONNECTIONS=${MAX_CONNECTIONS}`);
    }
  },
  onTooManyConnections: (socket, count) => {
    activeSocketConnections = count;
    handleTooManyConnections(socket, `active socket connections ${count} exceeded MAX_CONNECTIONS=${MAX_CONNECTIONS}`);
  }
});

// Server start
server.listen(PORT, () => {
  console.log(`Messaging Service listening on port ${PORT}`);
}, '0.0.0.0');

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use`);
    process.exit(1);
  }
  throw err;
});