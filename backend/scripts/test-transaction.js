import dotenv from 'dotenv';
import { pool } from '../src/db.js';
dotenv.config();

// Demonstrates atomicity: the inserted row must not exist after ROLLBACK.
const email = `acid-test-${Date.now()}@orbit.local`;
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  await conn.execute(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'STUDENT')",
    ['ACID Rollback Test', email, 'not-a-real-login-hash']
  );
  await conn.rollback();
  const [rows] = await pool.execute('SELECT user_id FROM users WHERE email = ?', [email]);
  if (rows.length !== 0) throw new Error('FAIL: rolled-back row still exists');
  console.log('PASS: rollback verified; uncommitted insert was not persisted.');
} catch (error) {
  try { await conn.rollback(); } catch {}
  console.error('FAIL: transaction test did not complete:', error.message);
  process.exitCode = 1;
} finally {
  conn.release();
  await pool.end();
}
