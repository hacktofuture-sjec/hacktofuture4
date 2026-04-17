const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const simulationState = require('../simulationState');

const SECURITY_SERVICE_URL = (process.env.SECURITY_SERVICE_URL || 'http://localhost:3005').replace(/\/+$/, '');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSimulationChecks(req, res) {
  if (simulationState.crash) {
    res.status(500).json({ error: 'Service unavailable (simulated crash)' });
    return true;
  }
  if (simulationState.error) {
    res.status(500).json({ error: 'Simulated error' });
    return true;
  }
  if (simulationState.latency) {
    await sleep(5000);
  }
  return false;
}

const sanitize = (value) => (typeof value === 'string' ? value.trim() : '');

const getSourceIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return (req.socket?.remoteAddress || req.ip || 'unknown').toString();
};

async function reportLoginFailure(req, username) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    await fetch(`${SECURITY_SERVICE_URL}/security/report/login-failure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceIp: getSourceIp(req),
        username: username || 'unknown-user',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch (err) {
    // Security telemetry must never block authentication flow.
    console.warn('[Auth] Security report skipped:', err.message);
  }
}

const registerHandler = async (req, res) => {
  if (await runSimulationChecks(req, res)) return;

  const username = sanitize(req.body?.username);
  const password = sanitize(req.body?.password);
  const email = sanitize(req.body?.email) || undefined;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const existingByUsername = await User.findOne({ username });
    if (existingByUsername) {
      return res.status(409).json({ error: 'User already exists' });
    }

    if (email) {
      const existingByEmail = await User.findOne({ email });
      if (existingByEmail) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, email, passwordHash });
    await user.save();

    return res.status(201).json({
      success: true,
      user: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    return res.status(500).json({ error: 'Registration failed' });
  }
};

router.post('/register', registerHandler);
router.post('/signup', registerHandler);

router.post('/login', async (req, res) => {
  if (await runSimulationChecks(req, res)) return;

  const username = sanitize(req.body?.username);
  const password = sanitize(req.body?.password);
  const email = sanitize(req.body?.email);
  const attemptedIdentity = username || email || 'unknown-user';

  if ((!username && !email) || !password) {
    return res.status(400).json({ error: 'Username (or email) and password are required' });
  }

  try {
    const query = username ? { username } : { email };
    const user = await User.findOne(query);

    if (!user) {
      await reportLoginFailure(req, attemptedIdentity);
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ error: 'Password authentication unavailable for this user' });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      await reportLoginFailure(req, user.username || attemptedIdentity);
      return res.status(401).json({ error: 'Wrong password' });
    }

    const session = {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
    };

    return res.json(session);
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users', async (req, res) => {
  if (await runSimulationChecks(req, res)) return;

  try {
    console.log('[Auth] Fetching all users');
    const users = await User.find({}, 'username email').sort({ username: 1 });
    const formatted = users.map((user) => ({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
    }));
    console.log('[Auth] Found users:', formatted.length);
    res.json(formatted);
  } catch (err) {
    console.error('[Auth] Fetch users error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.delete('/users/:id', async (req, res) => {
  if (await runSimulationChecks(req, res)) return;

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'User id is required' });
  }

  try {
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      success: true,
      userId: id,
      message: `User ${deletedUser.username} deleted successfully.`
    });
  } catch (err) {
    console.error('[Auth] Delete user error:', err.message);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
