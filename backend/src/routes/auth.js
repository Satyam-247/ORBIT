import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || name.length > 100 || !emailPattern.test(email) || password.length < 8) {
    return res.status(400).json({ error: 'Provide a name, valid email, and password of at least 8 characters.' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    // Public registration can only create student accounts. Privileged roles must be assigned by an admin.
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, \'STUDENT\')',
      [name, email, passwordHash]
    );
    return res.status(201).json({ userId: result.insertId, name, email, role: 'STUDENT' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account with this email already exists.' });
    console.error('Registration error:', error.message);
    return res.status(500).json({ error: 'Could not create account.' });
  }
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  try {
    const [rows] = await pool.execute(
      'SELECT user_id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1', [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h', issuer: 'orbit-api' }
    );
    return res.json({ token, user: { userId: user.user_id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ error: 'Could not log in.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT user_id AS userId, name, email, role FROM users WHERE user_id = ? LIMIT 1', [req.user.userId]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Account no longer exists.' });
    return res.json(rows[0]);
  } catch (error) {
    console.error('Profile error:', error.message);
    return res.status(500).json({ error: 'Could not load profile.' });
  }
});

export default router;
