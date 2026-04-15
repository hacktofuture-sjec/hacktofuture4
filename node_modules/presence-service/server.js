require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const promClient = require('prom-client');
const chaosRoutes = require('./routes/chaosRoutes');
const simulationRoutes = require('./routes/simulationRoutes');
const setupPresenceHandlers = require('./socket/presence');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = Number(process.env.PORT) || Number(process.env.PRESENCE_SERVICE_PORT) || Number(process.env.PRESENCE_PORT) || 3003;

// Prometheus metrics setup
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ register: promClient.register });

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

app.use('/api/chaos', chaosRoutes);
app.use('/simulate', simulationRoutes);

// Socket setup
setupPresenceHandlers(io);

server.listen(PORT, () => {
  console.log(`Presence Service listening on port ${PORT}`);
}, '0.0.0.0');

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nERROR: Presence Service port ${PORT} is already in use.\nStop the process using this port or change PRESENCE_SERVICE_PORT in .env.`);
    process.exit(1);
  }
  throw err;
});
