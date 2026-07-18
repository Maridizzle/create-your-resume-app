const express = require('express');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Step 1: username + password. On success, session is marked
// "authenticated" but NOT fully logged in until TOTP is verified.
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const result = await pool.query('SELECT * FROM admin_user WHERE username = $1', [username]);
  const user = result.rows[0];

  // Same response whether the user exists or not, don't leak which part failed.
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.authenticated = true;
  req.session.totpVerified = false;
  req.session.userId = user.id;

  return res.json({ requiresTotp: user.totp_enabled });
});

// Step 2: TOTP code from authenticator app.
router.post('/verify-2fa', async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { token } = req.body;
  const result = await pool.query('SELECT * FROM admin_user WHERE id = $1', [req.session.userId]);
  const user = result.rows[0];

  const verified = speakeasy.totp.verify({
    secret: user.totp_secret,
    encoding: 'base32',
    token,
    window: 1
  });

  if (!verified) {
    return res.status(401).json({ error: 'Invalid code' });
  }

  req.session.totpVerified = true;
  return res.json({ success: true });
});

// One-time setup: generates a TOTP secret and QR code to scan into an
// authenticator app. Only usable once, before totp_enabled is true.
router.post('/setup-2fa', requireAuth, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: 'Create Your Resume Admin' });
  await pool.query('UPDATE admin_user SET totp_secret = $1 WHERE id = $2', [
    secret.base32,
    req.session.userId
  ]);
  const qr = await qrcode.toDataURL(secret.otpauth_url);
  res.json({ qrCode: qr, secret: secret.base32 });
});

router.post('/confirm-2fa-setup', requireAuth, async (req, res) => {
  const { token } = req.body;
  const result = await pool.query('SELECT * FROM admin_user WHERE id = $1', [req.session.userId]);
  const user = result.rows[0];

  const verified = speakeasy.totp.verify({
    secret: user.totp_secret,
    encoding: 'base32',
    token,
    window: 1
  });

  if (!verified) {
    return res.status(401).json({ error: 'Invalid code' });
  }

  await pool.query('UPDATE admin_user SET totp_enabled = true WHERE id = $1', [req.session.userId]);
  req.session.totpVerified = true;
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

module.exports = router;
