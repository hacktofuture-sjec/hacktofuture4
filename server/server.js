const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();
const connectDB = require('./config/db');
const { runDeadlineCheck } = require('./services/deadlineService');

// Connect to Database
connectDB();

// Run deadline check every hour
setInterval(runDeadlineCheck, 3600000); 
// Run once on startup too
runDeadlineCheck();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Required for Twilio Webhooks
app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));

// Global Error Handler for debugging
app.use((err, req, res, next) => {
  console.error('💥 SERVER ERROR:', err.stack);
  res.status(500).json({ success: false, message: err.message, stack: err.stack });
});

// Root Endpoint
app.get('/', (req, res) => {
  res.send('Smart City Complaint API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
