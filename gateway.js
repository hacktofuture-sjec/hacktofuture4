const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.GATEWAY_PORT) || 3000;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || `http://127.0.0.1:${process.env.AUTH_SERVICE_PORT || 3001}`;
const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || `http://127.0.0.1:${process.env.MESSAGING_SERVICE_PORT || 3002}`;
const PRESENCE_SERVICE_URL = process.env.PRESENCE_SERVICE_URL || `http://127.0.0.1:${process.env.PRESENCE_SERVICE_PORT || 3003}`;
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || `http://127.0.0.1:${process.env.AGENT_SERVICE_PORT || 4000}`;
const FRONTEND_DEV_URL = process.env.FRONTEND_DEV_URL || `http://127.0.0.1:${process.env.FRONTEND_PORT || 5173}`;
const FRONTEND_DIST_PATH = path.resolve(__dirname, 'frontend', 'dist');
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const createProxyConfig = (target) => ({
  target,
  changeOrigin: true,
  ws: true,
  timeout: 30000,
  proxyTimeout: 30000,
  logLevel: 'info',
  onProxyRes: (proxyRes) => {
    proxyRes.headers['X-Proxied-By'] = 'Nova-Gateway';
  },
  onError: (err, req, res) => {
    console.error(`[Gateway] Proxy error for ${req.method} ${req.originalUrl}:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'One of the backend services is unavailable',
      });
    }
  },
});

// API route proxies
app.use('/api/auth', createProxyMiddleware(createProxyConfig(AUTH_SERVICE_URL)));
app.use('/api/messaging', createProxyMiddleware(createProxyConfig(MESSAGING_SERVICE_URL)));
app.use('/api/presence', createProxyMiddleware(createProxyConfig(PRESENCE_SERVICE_URL)));
app.use('/agent', createProxyMiddleware(createProxyConfig(AGENT_SERVICE_URL)));

// Socket proxy paths
app.use('/socket.io/messaging', createProxyMiddleware({
  ...createProxyConfig(MESSAGING_SERVICE_URL),
  pathRewrite: { '^/socket.io/messaging': '/socket.io' },
}));
app.use('/socket.io/presence', createProxyMiddleware({
  ...createProxyConfig(PRESENCE_SERVICE_URL),
  pathRewrite: { '^/socket.io/presence': '/socket.io' },
}));

if (!isProduction) {
  app.use('/', createProxyMiddleware({
    target: FRONTEND_DEV_URL,
    changeOrigin: true,
    ws: true,
    logLevel: 'info',
    onError: (err, req, res) => {
      console.error('[Gateway] Frontend dev proxy error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Frontend unavailable',
          message: 'Frontend dev server is not running',
        });
      }
    },
  }));
} else {
  if (fs.existsSync(FRONTEND_DIST_PATH)) {
    app.use(express.static(FRONTEND_DIST_PATH));
    app.get('*', (req, res) => {
      res.sendFile(path.join(FRONTEND_DIST_PATH, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.status(503).send('Frontend build not found. Run npm run build first.');
    });
  }
}

app.use((err, req, res, next) => {
  console.error('[Gateway] Unexpected error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const server = app.listen(PORT, HOST, () => {
  console.log('\n✓ Nova Chat Gateway ready');
  console.log(`  URL: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  Auth Service: ${AUTH_SERVICE_URL}`);
  console.log(`  Messaging Service: ${MESSAGING_SERVICE_URL}`);
  console.log(`  Presence Service: ${PRESENCE_SERVICE_URL}`);
  console.log(`  Agent Service: ${AGENT_SERVICE_URL}`);
  if (!isProduction) {
    console.log(`  Frontend Dev: ${FRONTEND_DEV_URL}`);
  } else {
    console.log(`  Frontend Dist: ${FRONTEND_DIST_PATH}`);
  }
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nERROR: Gateway port ${PORT} is already in use.\nStop the process using this port or change GATEWAY_PORT in .env.`);
    process.exit(1);
  }
  throw err;
});

