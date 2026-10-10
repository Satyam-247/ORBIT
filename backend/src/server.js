import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { selectAlgorithm } from './policy.js';
import { runScheduler } from './scheduler.js';
import authRoutes from './routes/auth.js';
import { requireAuth, allowRoles } from './middleware/auth.js';
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', authRoutes);

app.get('/api/health', async (_req,res) => {
  try { await pool.query('SELECT 1'); res.json({ok:true,database:'connected'}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});

app.get('/api/resources', async (_req,res) => {
  try { const [rows] = await pool.query("SELECT * FROM resources WHERE status='AVAILABLE'"); res.json(rows); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/bookings', requireAuth, async (req,res) => {
  try {
    const base = `SELECT b.booking_id,b.user_id,b.start_time,b.end_time,b.status,b.priority,b.service_time,r.name resource_name,r.resource_type FROM bookings b JOIN resources r ON r.resource_id=b.resource_id`;
    const [rows] = req.user.role === 'ADMIN'
      ? await pool.query(`${base} ORDER BY b.booking_id DESC`)
      : await pool.execute(`${base} WHERE b.user_id=? ORDER BY b.booking_id DESC`, [req.user.userId]);
    res.json(rows);
  } catch(e) { res.status(500).json({error:'Could not load bookings.'}); }
});

app.post('/api/bookings', requireAuth, async (req,res) => {
  const {resourceId,startTime,endTime,priority=3,serviceTime=30}=req.body;
  const userId = req.user.userId;
  if(!resourceId || !startTime || !endTime || !Number.isInteger(Number(serviceTime)) || Number(serviceTime) < 1 || !Number.isInteger(Number(priority)) || Number(priority) < 1 || Number(priority) > 5) return res.status(400).json({error:'resourceId, startTime, endTime, positive serviceTime, and priority 1-5 are required'});
  if (new Date(startTime) >= new Date(endTime)) return res.status(400).json({error:'endTime must be later than startTime'});
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[resource]]=await conn.query("SELECT * FROM resources WHERE resource_id=? AND status='AVAILABLE' FOR UPDATE",[resourceId]);
    if(!resource){await conn.rollback();return res.status(404).json({error:'Resource unavailable'});}
    const [overlaps] = await conn.query("SELECT booking_id FROM bookings WHERE resource_id=? AND status IN ('PENDING','SCHEDULED') AND start_time < ? AND end_time > ? FOR UPDATE", [resourceId, endTime, startTime]);
    if (overlaps.length) { await conn.rollback(); return res.status(409).json({error:'Resource is already booked during that time window'}); }
    const [b]=await conn.query(`INSERT INTO bookings(user_id,resource_id,start_time,end_time,priority,service_time,status) VALUES(?,?,?,?,?,?, 'PENDING')`,[userId,resourceId,startTime,endTime,priority,serviceTime]);
    const bookingId=b.insertId;
    const arrival=Math.floor(Date.now()/1000);
    await conn.query(`INSERT INTO processes(booking_id,arrival_time,burst_time,priority,state) VALUES(?,?,?,?, 'READY')`,[bookingId,arrival,serviceTime,priority]);
    const [[p]]=await conn.query('SELECT process_id,arrival_time,burst_time,priority FROM processes WHERE booking_id=?',[bookingId]);
    const algorithm=selectAlgorithm(resource.resource_type,{priority});
    const result=await runScheduler(algorithm,[{id:p.process_id,arrival:p.arrival_time,burst:p.burst_time,priority:p.priority}]);
    const r=result.results[0];
    await conn.query(`INSERT INTO scheduling_history(booking_id,algorithm,waiting_time,turnaround_time,response_time,scheduled_order) VALUES(?,?,?,?,?,?)`,[bookingId,algorithm,r.waiting_time,r.turnaround_time,r.response_time,JSON.stringify(result.schedule)]);
    await conn.query("UPDATE bookings SET status='SCHEDULED' WHERE booking_id=?",[bookingId]);
    await conn.query("UPDATE processes SET state='COMPLETED' WHERE booking_id=?",[bookingId]);
    await conn.commit();
    res.status(201).json({bookingId,algorithm,schedulerResult:result});
  } catch(e) { try { await conn.rollback(); } catch {} console.error(e); res.status(500).json({error:'Booking transaction failed; changes were rolled back.'}); }
  finally { conn.release(); }
});

app.listen(Number(process.env.PORT||5000),()=>console.log(`ORBIT backend: http://localhost:${process.env.PORT||5000}`));
