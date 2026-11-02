import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fullNamePattern = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;
const allowedRoles = new Set(['STUDENT', 'FACULTY', 'ADMIN']);

// Used by the Admin registration form to show which resources already have an admin.
router.get('/admin-resources', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.resource_id, r.name, r.resource_type, r.status,
             CASE WHEN ra.resource_id IS NULL THEN 0 ELSE 1 END AS admin_registered
      FROM resources r
      LEFT JOIN resource_admins ra ON ra.resource_id = r.resource_id
      ORDER BY r.name
    `);
    return res.json(rows);
  } catch (error) {
    console.error('Admin resource list error:', error.message);
    return res.status(500).json({ error: 'Could not load resources for admin registration. Ensure the resource_admins migration has been applied.' });
  }
});

router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = String(req.body.role || 'STUDENT').trim().toUpperCase();
  const resourceId = Number(req.body.resourceId);

  if (!name || name.length > 100 || !fullNamePattern.test(name)) {
    return res.status(400).json({ error: 'Full name must contain only letters and spaces. Numbers and special characters are not allowed.' });
  }
  if (!emailPattern.test(email) || password.length < 8) {
    return res.status(400).json({ error: 'Provide a valid email and a password of at least 8 characters.' });
  }
  if (!allowedRoles.has(role)) {
    return res.status(400).json({ error: 'Select a valid account role.' });
  }
  if (role === 'ADMIN' && (!Number.isInteger(resourceId) || resourceId < 1)) {
    return res.status(400).json({ error: 'Select the resource this admin will manage.' });
  }

  let conn;
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    conn = await pool.getConnection();
    await conn.beginTransaction();

    if (role === 'ADMIN') {
      const [[resource]] = await conn.query(
        'SELECT resource_id, name FROM resources WHERE resource_id = ? FOR UPDATE',
        [resourceId]
      );
      if (!resource) {
        await conn.rollback();
        return res.status(404).json({ error: 'Selected resource was not found.' });
      }
      const [[assigned]] = await conn.query(
        'SELECT resource_id FROM resource_admins WHERE resource_id = ? FOR UPDATE',
        [resourceId]
      );
      if (assigned) {
        await conn.rollback();
        return res.status(409).json({ error: 'Resource admin already registered.' });
      }
    }

    const [result] = await conn.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role]
    );
    const userId = result.insertId;

    if (role === 'ADMIN') {
      await conn.execute(
        'INSERT INTO resource_admins (resource_id, user_id) VALUES (?, ?)',
        [resourceId, userId]
      );
    }

    await conn.commit();
    return res.status(201).json({
      userId,
      name,
      email,
      role,
      ...(role === 'ADMIN' ? { resourceId } : {}),
    });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch {}
    }
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message?.includes('resource_admins')) {
        return res.status(409).json({ error: 'Resource admin already registered.' });
      }
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    console.error('Registration error:', error.message);
    return res.status(500).json({ error: 'Could not create account.' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  try {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.name, u.email, u.password_hash, u.role, ra.resource_id AS resourceId
       FROM users u LEFT JOIN resource_admins ra ON ra.user_id = u.user_id
       WHERE u.email = ? LIMIT 1`, [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role, ...(user.resourceId ? { resourceId: user.resourceId } : {}) },
      process.env.JWT_SECRET,
      { expiresIn: '8h', issuer: 'orbit-api' }
    );
    return res.json({ token, user: { userId: user.user_id, name: user.name, email: user.email, role: user.role, ...(user.resourceId ? { resourceId: user.resourceId } : {}) } });
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
