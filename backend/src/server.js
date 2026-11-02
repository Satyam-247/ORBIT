import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { selectAlgorithm } from './policy.js';
import { runScheduler } from './scheduler.js';
import { runBanker } from './deadlock.js';
import authRoutes from './routes/auth.js';
import { requireAuth, allowRoles } from './middleware/auth.js';

dotenv.config();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
}

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);

async function checkBookingSafety(conn, resource, overlappingBookings) {
  const scheduledAllocations = overlappingBookings.filter((booking) => booking.status === 'SCHEDULED').length;
  const available = Number(resource.capacity) - scheduledAllocations;
  const processes = overlappingBookings.map((booking, index) => ({
    id: index + 1,
    allocation: [booking.status === 'SCHEDULED' ? 1 : 0],
    maximum: [1],
  }));
  processes.push({ id: processes.length + 1, allocation: [0], maximum: [1] });
  if (available < 0) return { safe: false, safeSequence: [], available: [available], processes: [] };
  return runBanker({ available: [available], processes });
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, database: 'connected' }); }
  catch (error) { console.error('Health check failed:', error.message); res.status(503).json({ ok: false, error: 'Database unavailable.' }); }
});

// Students and faculty can browse all active resources. An admin sees only their assignment.
app.get('/api/resources', requireAuth, async (req, res) => {
  try {
    const [rows] = req.user.role === 'ADMIN'
      ? await pool.execute(`SELECT r.* FROM resources r JOIN resource_admins ra ON ra.resource_id=r.resource_id WHERE ra.user_id=? AND r.status='AVAILABLE'`, [req.user.userId])
      : await pool.query("SELECT * FROM resources WHERE status='AVAILABLE' ORDER BY name");
    res.json(rows);
  } catch (error) { console.error('Resource query failed:', error.message); res.status(500).json({ error: 'Could not load resources.' }); }
});


app.get('/api/deadlock/state', requireAuth, allowRoles('ADMIN'), async (req, res) => {
  try {
    const [[resource]] = await pool.execute(
      `SELECT r.resource_id,r.name,r.capacity FROM resources r
       JOIN resource_admins ra ON ra.resource_id=r.resource_id WHERE ra.user_id=?`,
      [req.user.userId]
    );
    if (!resource) return res.status(403).json({ error: 'No resource is assigned to this administrator.' });
    const [bookings] = await pool.execute(
      `SELECT b.booking_id,b.status FROM bookings b
       WHERE b.resource_id=? AND b.status IN ('PENDING','SCHEDULED')
       AND b.start_time <= NOW() AND b.end_time > NOW()
       ORDER BY b.start_time,b.booking_id`,
      [resource.resource_id]
    );
    const allocated = bookings.filter((booking) => booking.status === 'SCHEDULED').length;
    const available = Number(resource.capacity) - allocated;
    let safety;
    if (!bookings.length) safety = { safe: true, safeSequence: [], available: [available], processes: [] };
    else {
      const processes = bookings.map((booking, index) => ({
        id: index + 1,
        allocation: [booking.status === 'SCHEDULED' ? 1 : 0],
        maximum: [1],
      }));
      safety = available < 0 ? { safe: false, safeSequence: [], available: [available], processes }
        : await runBanker({ available: [available], processes });
      safety.safeSequence = (safety.safeSequence || []).map((index) => bookings[index - 1]?.booking_id ?? index);
    }
    res.json({ resource: { id: resource.resource_id, name: resource.name, capacity: Number(resource.capacity) },
      activeBookingCount: bookings.length, allocatedUnits: allocated, availableUnits: available,
      safety, model: 'Single resource type; one unit per active booking. Pending bookings are unallocated claims.' });
  } catch (error) {
    console.error('Deadlock monitor failed:', error.message);
    res.status(503).json({ error: 'Could not evaluate resource safety. Build the deadlock checker and apply the current database schema.' });
  }
});

app.get('/api/bookings', requireAuth, async (req, res) => {
  try {
    const base = `SELECT b.booking_id,b.user_id,b.resource_id,b.start_time,b.end_time,b.status,b.priority,b.service_time,b.created_at,r.name resource_name,r.resource_type FROM bookings b JOIN resources r ON r.resource_id=b.resource_id`;
    const [rows] = req.user.role === 'ADMIN'
      ? await pool.execute(`${base} JOIN resource_admins ra ON ra.resource_id=b.resource_id WHERE ra.user_id=? ORDER BY b.created_at DESC`, [req.user.userId])
      : await pool.execute(`${base} WHERE b.user_id=? ORDER BY b.created_at DESC`, [req.user.userId]);
    res.json(rows);
  } catch (error) { console.error('Booking query failed:', error.message); res.status(500).json({ error: 'Could not load bookings.' }); }
});

app.post('/api/bookings', requireAuth, allowRoles('STUDENT', 'FACULTY'), async (req, res) => {
  const resourceId = Number(req.body.resourceId);
  const { startTime, endTime } = req.body;
  const priority = Number(req.body.priority ?? 3);
  const serviceTime = Number(req.body.serviceTime ?? 30);
  const start = new Date(startTime), end = new Date(endTime);
  if (!Number.isInteger(resourceId) || resourceId < 1 || !startTime || !endTime || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return res.status(400).json({ error: 'Select a resource and provide a valid time range where the end is after the start.' });
  }
  if (!Number.isInteger(priority) || priority < 1 || priority > 5 || !Number.isInteger(serviceTime) || serviceTime < 1 || serviceTime > 600) {
    return res.status(400).json({ error: 'Priority must be 1-5 and service time must be 1-600 minutes.' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[resource]] = await conn.execute("SELECT resource_id,capacity FROM resources WHERE resource_id=? AND status='AVAILABLE' FOR UPDATE", [resourceId]);
    if (!resource) { await conn.rollback(); return res.status(404).json({ error: 'Resource is unavailable.' }); }
    const [overlappingBookings] = await conn.execute(
      `SELECT booking_id,status FROM bookings WHERE resource_id=? AND status IN ('PENDING','SCHEDULED') AND start_time < ? AND end_time > ? FOR UPDATE`,
      [resourceId, endTime, startTime]
    );
    if (overlappingBookings.length >= Number(resource.capacity || 1)) {
      await conn.rollback(); return res.status(409).json({ error: 'Resource capacity is full for the selected time window.' });
    }
    const safety = await checkBookingSafety(conn, resource, overlappingBookings);
    if (!safety.safe) {
      await conn.rollback();
      return res.status(409).json({ error: 'The request would place the resource in an unsafe allocation state.', deadlock: safety });
    }
    const [insert] = await conn.execute(
      `INSERT INTO bookings(user_id,resource_id,start_time,end_time,priority,service_time,status) VALUES(?,?,?,?,?,?,'PENDING')`,
      [req.user.userId, resourceId, startTime, endTime, priority, serviceTime]
    );
    const bookingId = insert.insertId;
    await conn.execute(`INSERT INTO processes(booking_id,arrival_time,burst_time,priority,state) VALUES(?,0,?,?,'READY')`, [bookingId, serviceTime, priority]);
    await conn.commit();
    res.status(201).json({ bookingId, status: 'PENDING', message: 'Booking request added to the resource scheduling queue.' });
  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch {} }
    console.error('Booking creation failed:', error.message);
    res.status(500).json({ error: 'Booking request failed. No changes were saved.' });
  } finally { conn?.release(); }
});

// The assigned resource admin schedules all pending processes for that resource as one batch.
app.post('/api/scheduling/run', requireAuth, allowRoles('ADMIN'), async (req, res) => {
  const algorithmOverride = String(req.body.algorithm || '').toUpperCase();
  const timeQuantum = Number(req.body.timeQuantum || 2);
  if (algorithmOverride && !['FCFS', 'SJF', 'PRIORITY', 'RR'].includes(algorithmOverride)) return res.status(400).json({ error: 'Unsupported algorithm.' });
  if (!Number.isInteger(timeQuantum) || timeQuantum < 1 || timeQuantum > 100) return res.status(400).json({ error: 'Time quantum must be between 1 and 100.' });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[resource]] = await conn.execute(
      `SELECT r.resource_id,r.resource_type,r.capacity FROM resources r JOIN resource_admins ra ON ra.resource_id=r.resource_id WHERE ra.user_id=? FOR UPDATE`,
      [req.user.userId]
    );
    if (!resource) { await conn.rollback(); return res.status(403).json({ error: 'No resource is assigned to this administrator.' }); }
    const [rows] = await conn.execute(
      `SELECT p.process_id,p.arrival_time,p.burst_time,p.priority,b.booking_id,b.created_at
       FROM processes p JOIN bookings b ON b.booking_id=p.booking_id
       WHERE b.resource_id=? AND b.status='PENDING' AND p.state IN ('NEW','READY')
       ORDER BY b.created_at,p.process_id FOR UPDATE`, [resource.resource_id]
    );
    if (!rows.length) { await conn.rollback(); return res.json({ message: 'No pending processes to schedule.', processCount: 0 }); }
    if (rows.length > 100) { await conn.rollback(); return res.status(400).json({ error: 'The scheduling batch is limited to 100 processes.' }); }
    const [activeBookings] = await conn.execute(
      `SELECT booking_id,status FROM bookings WHERE resource_id=? AND status IN ('PENDING','SCHEDULED')
       AND start_time < NOW() + INTERVAL 1 SECOND AND end_time > NOW() FOR UPDATE`,
      [resource.resource_id]
    );
    const activeScheduled = activeBookings.filter((booking) => booking.status === 'SCHEDULED').length;
    const availableUnits = Number(resource.capacity ?? 1) - activeScheduled;
    const bankerProcesses = activeBookings.map((booking, index) => ({
      id: index + 1,
      allocation: [booking.status === 'SCHEDULED' ? 1 : 0],
      maximum: [1],
    }));
    if (bankerProcesses.length) {
      const safety = availableUnits < 0 ? { safe: false } : await runBanker({ available: [availableUnits], processes: bankerProcesses });
      if (!safety.safe) { await conn.rollback(); return res.status(409).json({ error: 'Scheduling paused: current resource allocation is unsafe.', deadlock: safety }); }
    }
    const firstCreated = new Date(rows[0].created_at).getTime();
    const processes = rows.map(row => ({
      id: Number(row.process_id),
      arrival: Math.max(0, Math.floor((new Date(row.created_at).getTime() - firstCreated) / 60000)),
      burst: Number(row.burst_time),
      priority: Number(row.priority),
    }));
    const minPriority = Math.min(...processes.map(p => p.priority));
    const algorithm = algorithmOverride || selectAlgorithm(resource.resource_type, { priority: minPriority });
    const result = await runScheduler(algorithm, processes, timeQuantum);
    const byId = new Map(result.results.map(item => [Number(item.id), item]));
    const serializedSchedule = JSON.stringify(result.schedule);
    for (const row of rows) {
      const metrics = byId.get(Number(row.process_id));
      if (!metrics) throw new Error(`Scheduler omitted process ${row.process_id}.`);
      await conn.execute(
        `INSERT INTO scheduling_history(booking_id,algorithm,waiting_time,turnaround_time,response_time,scheduled_order) VALUES(?,?,?,?,?,?)`,
        [row.booking_id, algorithm, metrics.waiting_time, metrics.turnaround_time, metrics.response_time, serializedSchedule]
      );
      await conn.execute("UPDATE bookings SET status='SCHEDULED' WHERE booking_id=? AND status='PENDING'", [row.booking_id]);
      await conn.execute("UPDATE processes SET state='SCHEDULED',completion_time=?,waiting_time=?,turnaround_time=?,response_time=? WHERE process_id=?",
        [metrics.completion_time, metrics.waiting_time, metrics.turnaround_time, metrics.response_time, row.process_id]);
    }
    await conn.commit();
    res.json({ algorithm, processCount: rows.length, result });
  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch {} }
    console.error('Scheduling run failed:', error.message);
    res.status(500).json({ error: 'Scheduling failed. The batch was rolled back.' });
  } finally { conn?.release(); }
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled API error:', error);
  res.status(500).json({ error: 'Unexpected server error.' });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`ORBIT backend listening on http://localhost:${port}`));
