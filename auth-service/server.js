require("dotenv").config();

const express = require('express');
const cors = require('cors');
const promClient = require('prom-client');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const chaosRoutes = require('./routes/chaosRoutes');
const simulationRoutes = require('./routes/simulationRoutes');

const app = express();

const PORT = Number(process.env.PORT) || Number(process.env.AUTH_SERVICE_PORT) || Number(process.env.AUTH_PORT) || 3001;

// ✅ MongoDB connection (ONLY ONCE)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Auth Service MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Prometheus metrics
promClient.collectDefaultMetrics();

// Middleware
app.use(cors());
app.use(express.json());

// Metrics route
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Routes
app.use('/', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/chaos', chaosRoutes);
app.use('/simulate', simulationRoutes);

// Server start
const authServer = app.listen(PORT, () => {
  console.log(`Auth Service listening on port ${PORT}`);
}, '0.0.0.0');

authServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use`);
    process.exit(1);
  }
  throw err;
});