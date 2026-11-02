import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ROLES = [
  { id: 'STUDENT', label: 'Student', short: 'ST', description: 'Book labs, library spaces, and campus services. Track your own requests.' },
  { id: 'FACULTY', label: 'Faculty', short: 'FC', description: 'Reserve campus resources for teaching and academic activities.' },
  { id: 'ADMIN', label: 'Admin', short: 'AD', description: 'Manage bookings and scheduling for your assigned resource.' },
];

async function request(path, options = {}, token = '') {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function AuthScreen({ onLogin }) {
  const [role, setRole] = useState('STUDENT');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', resourceId: '', adminCode: '' });
  const [adminResources, setAdminResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selectedRole = ROLES.find((item) => item.id === role) || ROLES[0];

  useEffect(() => {
    if (role !== 'ADMIN' || mode !== 'register') return;
    let cancelled = false;
    setResourcesLoading(true);
    request('/auth/admin-resources')
      .then((rows) => { if (!cancelled) setAdminResources(Array.isArray(rows) ? rows : []); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load resources.'); })
      .finally(() => { if (!cancelled) setResourcesLoading(false); });
    return () => { cancelled = true; };
  }, [role, mode]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'register') {
        const fullName = form.name.trim();
        if (!/^[A-Za-z]+(?:\s+[A-Za-z]+)*$/.test(fullName)) {
          throw new Error('Full name must contain only letters and spaces. Numbers and special characters are not allowed.');
        }
        if (role === 'ADMIN') {
          if (!form.resourceId) throw new Error('Select the resource this admin will manage.');
          const selectedResource = adminResources.find((item) => String(item.resource_id) === String(form.resourceId));
          if (selectedResource?.admin_registered) throw new Error('Resource admin already registered.');
        }
        await request('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name: fullName,
            email: form.email.trim(),
            password: form.password,
            role,
            ...(role === 'ADMIN' ? { resourceId: Number(form.resourceId), adminCode: form.adminCode } : {}),
          }),
        });
        setMode('login');
        setNotice(`${selectedRole.label} account created successfully. Sign in with your new credentials.`);
        setForm((previous) => ({ ...previous, password: '', resourceId: '', adminCode: '' }));
      } else {
        const data = await request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: form.email.trim(), password: form.password }),
        });
        if (data.user?.role !== role) {
          throw new Error(`This account is registered as ${data.user?.role || 'an unknown role'}. Select the matching role to continue.`);
        }
        onLogin(data);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-brand-panel">
          <div className="brand-mark">O</div>
          <p className="eyebrow">CAMPUS RESOURCE PLATFORM</p>
          <h1>Make campus<br /><span>work smarter.</span></h1>
          <p className="brand-copy">One place to book campus resources, manage requests, and coordinate access with intelligent scheduling.</p>
          <div className="brand-footer"><span className="pulse-dot" /> ORBIT SYSTEMS <span className="footer-divider">/</span> PHASE II MVP</div>
          <div className="orbit-decoration orbit-decoration-one" />
          <div className="orbit-decoration orbit-decoration-two" />
        </section>

        <section className="auth-form-panel">
          <div className="mobile-brand"><div className="brand-mark small">O</div><span>ORBIT</span></div>
          <div className="form-heading">
            <p className="eyebrow">WELCOME TO ORBIT</p>
            <h2>{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</h2>
            <p className="muted">{mode === 'login' ? 'Choose your account type to get started.' : `Create your ${selectedRole.label.toLowerCase()} account.`}</p>
          </div>

          <div className="role-grid" aria-label="Choose account role">
            {ROLES.map((item) => (
              <button key={item.id} type="button" className={`role-option ${role === item.id ? 'selected' : ''}`} onClick={() => { setRole(item.id); setError(''); setNotice(''); setForm((previous) => ({ ...previous, resourceId: '' })); }} aria-pressed={role === item.id}>
                <span className="role-icon">{item.short}</span>
                <span className="role-label">{item.label}</span>
                <span className="role-check">{role === item.id ? '●' : '○'}</span>
              </button>
            ))}
          </div>
          <p className="role-description">{selectedRole.description}</p>

          <form className="auth-form" onSubmit={submit}>
            {mode === 'register' && <label>Full name<input autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Letters and spaces only" required maxLength={100} pattern="[A-Za-z]+(\s+[A-Za-z]+)*" title="Enter a full name using letters and spaces only. Numbers and special characters are not allowed." /></label>}
            {mode === 'register' && role === 'ADMIN' && <label>Admin invitation code<input type="password" autoComplete="off" value={form.adminCode} onChange={(e) => setForm({ ...form, adminCode: e.target.value })} required placeholder="Enter invitation code" /></label>}
            {mode === 'register' && role === 'ADMIN' && <label>Resource you will manage<select required value={form.resourceId} onChange={(e) => { setForm({ ...form, resourceId: e.target.value }); setError(''); }} disabled={resourcesLoading}><option value="">{resourcesLoading ? 'Loading resources…' : 'Select a resource'}</option>{adminResources.map((resource) => <option key={resource.resource_id} value={resource.resource_id} disabled={Boolean(resource.admin_registered)}>{resource.name} · {resource.resource_type}{resource.admin_registered ? ' · Resource admin already registered' : ''}</option>)}</select>{!resourcesLoading && adminResources.length > 0 && adminResources.every((resource) => Boolean(resource.admin_registered)) && <span className="field-error">Resource admin already registered for every resource. No resource is available for admin registration.</span>}</label>}
            <label>Email address<input type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@college.edu" required /></label>
            <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={mode === 'login' ? 'Enter your password' : 'At least 8 characters'} minLength={mode === 'register' ? 8 : 1} required /></label>
            {error && <div className="alert error" role="alert">{error}</div>}
            {notice && <div className="alert success" role="status">{notice}</div>}
            <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? `Sign in as ${selectedRole.label}` : `Create ${selectedRole.label.toLowerCase()} account`} <span aria-hidden="true">↗</span></button>
          </form>

          <p className="switch-mode">{mode === 'login' ? `New ${selectedRole.label.toLowerCase()} user?` : 'Already have an account?'} <button type="button" onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? `Register as ${selectedRole.label}` : 'Sign in'}</button></p>
          {mode === 'register' && role === 'ADMIN' && <p className="account-note">Each resource can have only one registered admin. Already-assigned resources cannot be selected.</p>}
          <p className="security-note"><span aria-hidden="true">▣</span> Your access is verified against your registered account role.</p>
        </section>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(() => {
    try {
      const token = localStorage.getItem('orbit_token');
      const user = JSON.parse(localStorage.getItem('orbit_user') || 'null');
      return token && user ? { token, user } : null;
    } catch { return null; }
  });
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [scheduleAlgorithm, setScheduleAlgorithm] = useState('AUTO');
  const [timeQuantum, setTimeQuantum] = useState(2);
  const [scheduleResult, setScheduleResult] = useState(null);
  const [deadlockState, setDeadlockState] = useState(null);
  const [form, setForm] = useState({ resourceId: '', startTime: '', endTime: '', priority: 3, serviceTime: 30 });

  const user = session?.user;
  const token = session?.token;

  function login(data) {
    localStorage.setItem('orbit_token', data.token);
    localStorage.setItem('orbit_user', JSON.stringify(data.user));
    setSession({ token: data.token, user: data.user });
    setMessage({ type: 'success', text: `Signed in successfully. Welcome, ${data.user.name.split(' ')[0]}.` });
  }

  function logout() {
    localStorage.removeItem('orbit_token');
    localStorage.removeItem('orbit_user');
    setSession(null);
    setResources([]);
    setBookings([]);
    setDeadlockState(null);
    setMessage({ type: '', text: '' });
  }

  async function loadData() {
    if (!token) return;
    setLoading(true);
    setLoadError('');
    try {
      const [resourceData, bookingData, safetyData] = await Promise.all([
        request('/resources', {}, token),
        request('/bookings', {}, token),
        user?.role === 'ADMIN' ? request('/deadlock/state', {}, token).catch(() => null) : Promise.resolve(null),
      ]);
      setResources(Array.isArray(resourceData) ? resourceData : []);
      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setDeadlockState(safetyData);
    } catch (error) {
      setLoadError(error.message);
      if (/token|auth|account no longer exists|unauthorized|forbidden/i.test(error.message)) logout();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (token) loadData(); }, [token]);

  const filteredResources = useMemo(() => resources.filter((resource) => `${resource.name} ${resource.resource_type}`.toLowerCase().includes(search.toLowerCase())), [resources, search]);
  const scheduledCount = bookings.filter((booking) => booking.status === 'SCHEDULED' || booking.status === 'CONFIRMED').length;
  const pendingCount = bookings.filter((booking) => booking.status === 'PENDING' || booking.status === 'WAITING').length;

  async function submitBooking(event) {
    event.preventDefault();
    setBusy(true);
    setMessage({ type: '', text: '' });
    try {
      const result = await request('/bookings', {
        method: 'POST',
        body: JSON.stringify({ ...form, resourceId: Number(form.resourceId), priority: Number(form.priority), serviceTime: Number(form.serviceTime) }),
      }, token);
      setMessage({ type: 'success', text: `Booking #${result.bookingId} submitted. It is now waiting in the resource scheduling queue.` });
      setForm({ resourceId: '', startTime: '', endTime: '', priority: 3, serviceTime: 30 });
      await loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setBusy(false); }
  }

  async function runScheduling() {
    setBusy(true); setMessage({ type: '', text: '' });
    try {
      const result = await request('/scheduling/run', { method: 'POST', body: JSON.stringify({ algorithm: scheduleAlgorithm === 'AUTO' ? undefined : scheduleAlgorithm, timeQuantum: Number(timeQuantum) }) }, token);
      setMessage({ type: 'success', text: result.processCount ? `${result.processCount} process(es) scheduled using ${result.algorithm}.` : result.message });
      setScheduleResult(result.result || null);
      await loadData();
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  }

  if (!session || !user) return <AuthScreen onLogin={login} />;

  const roleLabel = ROLES.find((item) => item.id === user.role)?.label || user.role;
  const isAdmin = user.role === 'ADMIN';
  const isFaculty = user.role === 'FACULTY';
  const isStudent = user.role === 'STUDENT';
  const roleKey = isAdmin ? 'admin' : isFaculty ? 'faculty' : 'student';
  const visibleBookings = isAdmin ? bookings : bookings.filter((booking) => Number(booking.user_id) === Number(user.userId));
  const workspaceTitle = isAdmin ? 'Campus overview' : isFaculty ? 'Faculty workspace' : 'Student dashboard';
  const workspaceDescription = isAdmin
    ? 'Monitor bookings and availability for your assigned resource.'
    : isFaculty
      ? 'Coordinate resource reservations for classes and academic work.'
      : 'Find a resource, submit a booking, and track your requests.';

  return (
    <div className={`dashboard-page role-${roleKey}`}>
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-mark small">O</div><div><strong>ORBIT</strong><span>RESOURCE SYSTEM</span></div></div>
        <div className="workspace-label">{isAdmin ? 'ADMINISTRATION' : isFaculty ? 'FACULTY TOOLS' : 'STUDENT TOOLS'}</div>
        <div className="nav-item active"><span className="nav-symbol">▦</span> {isAdmin ? 'Campus overview' : isFaculty ? 'Faculty overview' : 'My dashboard'}</div>
        {!isAdmin && <a className="nav-item" href="#booking"><span className="nav-symbol">＋</span> {isFaculty ? 'Reserve a resource' : 'New booking'}</a>}
        <a className="nav-item" href="#history"><span className="nav-symbol">◷</span> {isAdmin ? 'All bookings' : 'My bookings'}</a>
        <a className="nav-item" href="#resources"><span className="nav-symbol">▤</span> Resource directory</a>
        {isAdmin && <div className="admin-note"><strong>Assigned resource only</strong><span>Your account can view and schedule requests for its assigned resource.</span></div>}
        <div className="sidebar-bottom"><div className="user-avatar">{user.name?.charAt(0)?.toUpperCase() || 'U'}</div><div className="user-details"><strong>{user.name}</strong><span>{roleLabel}</span></div><button className="logout-button" onClick={logout} title="Sign out" aria-label="Sign out">↪</button></div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header"><div><p className="eyebrow">{isAdmin ? 'ADMINISTRATION' : isFaculty ? 'FACULTY PORTAL' : 'STUDENT PORTAL'}</p><h1>{workspaceTitle}</h1><p className="muted">{workspaceDescription}</p></div><div className="header-right"><span className="role-pill">{roleLabel} account</span><button className="secondary-button" onClick={loadData} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button></div></header>
        {message.text && <div className={`alert dashboard-alert ${message.type}`} role="status">{message.text}<button onClick={() => setMessage({ type: '', text: '' })} aria-label="Dismiss message">×</button></div>}
        {loadError && <div className="alert error dashboard-alert">Could not load data: {loadError}</div>}

        {isAdmin && <section className="panel scheduling-panel"><div className="panel-heading"><div><p className="eyebrow">OS SCHEDULING ENGINE</p><h2>Process queue execution</h2><p className="muted">Run all pending requests for your assigned resource as one multi-process batch.</p></div><span className="panel-number">OS</span></div><div className="field-row"><label>Algorithm<select value={scheduleAlgorithm} onChange={(e) => setScheduleAlgorithm(e.target.value)}><option value="AUTO">Automatic policy</option><option value="FCFS">FCFS</option><option value="SJF">SJF</option><option value="PRIORITY">Priority</option><option value="RR">Round Robin</option></select></label>{scheduleAlgorithm === 'RR' && <label>Time quantum<input type="number" min="1" max="100" value={timeQuantum} onChange={(e) => setTimeQuantum(e.target.value)} /></label>}</div><button className="primary-button" onClick={runScheduling} disabled={busy || loading || pendingCount === 0}>{busy ? 'Running scheduler…' : 'Run scheduling batch'} <span aria-hidden="true">↗</span></button></section>}

        {isAdmin && scheduleResult && <section className="panel gantt-panel"><div className="panel-heading"><div><p className="eyebrow">SCHEDULING OUTPUT</p><h2>{scheduleResult.algorithm} execution timeline</h2></div><span className="panel-number">G</span></div><div className="gantt-track">{scheduleResult.schedule.map((segment, index) => <div className="gantt-segment" key={`${segment.process}-${segment.start}-${index}`} style={{ flexGrow: Math.max(1, segment.end - segment.start) }} title={`P${segment.process}: ${segment.start} to ${segment.end}`}><strong>P{segment.process}</strong><small>{segment.start}–{segment.end}</small></div>)}</div><div className="gantt-metrics"><span>Avg waiting <strong>{scheduleResult.average_waiting_time}</strong></span><span>Avg turnaround <strong>{scheduleResult.average_turnaround_time}</strong></span><span>Avg response <strong>{scheduleResult.average_response_time}</strong></span></div></section>}

        {isAdmin && <section className="panel deadlock-panel"><div className="panel-heading"><div><p className="eyebrow">RESOURCE SAFETY MONITOR</p><h2>Banker’s algorithm</h2><p className="muted">Live safety check for the currently active booking window on your assigned resource.</p></div><span className="panel-number">OS</span></div>{deadlockState ? <><div className="gantt-metrics"><span>Resource <strong>{deadlockState.resource?.name}</strong></span><span>Capacity <strong>{deadlockState.resource?.capacity}</strong></span><span>Allocated <strong>{deadlockState.allocatedUnits}</strong></span><span>Available <strong>{deadlockState.availableUnits}</strong></span></div><div className={`alert ${deadlockState.safety?.safe ? 'success' : 'error'}`} role="status">{deadlockState.safety?.safe ? 'SAFE STATE' : 'UNSAFE STATE'}{deadlockState.safety?.safeSequence?.length ? ` · Safe sequence: ${deadlockState.safety.safeSequence.map((id) => `B${id}`).join(' → ')}` : ''}</div><p className="muted small-pad">This model treats each active booking as one unit of the assigned resource. It is a single-resource-type Banker safety check, not a multi-resource deadlock detector.</p></> : <p className="empty-state">Safety information is unavailable. Check the deadlock executable and database setup.</p>}</section>}

        <section className="stat-grid">
          <article className="stat-card"><span className="stat-label">{isAdmin ? 'Managed resource bookings' : isFaculty ? 'Your reservations' : 'My bookings'}</span><strong>{visibleBookings.length}</strong><span className="stat-caption">{isAdmin ? 'Requests for your assigned resource' : isFaculty ? 'Academic resource requests' : 'Your submitted requests'}</span><span className="stat-icon violet">▦</span></article>
          <article className="stat-card"><span className="stat-label">Scheduled</span><strong>{scheduledCount}</strong><span className="stat-caption">Confirmed by scheduler</span><span className="stat-icon green">✓</span></article>
          <article className="stat-card"><span className="stat-label">Pending / waiting</span><strong>{pendingCount}</strong><span className="stat-caption">Requests awaiting processing</span><span className="stat-icon amber">◷</span></article>
          <article className="stat-card"><span className="stat-label">Available resources</span><strong>{resources.length}</strong><span className="stat-caption">Currently marked available</span><span className="stat-icon blue">▤</span></article>
        </section>

        <div className="content-grid">
          {!isAdmin && <section className="panel" id="booking"><div className="panel-heading"><div><p className="eyebrow">{isFaculty ? 'ACADEMIC RESOURCE REQUEST' : 'RESOURCE REQUEST'}</p><h2>{isFaculty ? 'Reserve for academic work' : 'Book a resource'}</h2></div><span className="panel-number">01</span></div>
            <form className="booking-form" onSubmit={submitBooking}>
              <label>Resource<select required value={form.resourceId} onChange={(e) => setForm({ ...form, resourceId: e.target.value })}><option value="">Select a resource</option>{resources.map((resource) => <option key={resource.resource_id} value={resource.resource_id}>{resource.name} · {resource.resource_type}</option>)}</select></label>
              <div className="field-row"><label>Start time<input type="datetime-local" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value, endTime: form.endTime && form.endTime <= e.target.value ? '' : form.endTime })} /></label><label>End time<input type="datetime-local" required min={form.startTime || undefined} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></label></div>
              <div className="field-row"><label>Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="1">1 · Highest</option><option value="2">2 · High</option><option value="3">3 · Normal</option><option value="4">4 · Low</option><option value="5">5 · Lowest</option></select></label><label>Service time (minutes)<input type="number" min="1" max="600" required value={form.serviceTime} onChange={(e) => setForm({ ...form, serviceTime: e.target.value })} /></label></div>
              <button className="primary-button" type="submit" disabled={busy || loading || resources.length === 0}>{busy ? 'Submitting request…' : 'Submit booking request'} <span aria-hidden="true">↗</span></button>
            </form>
          </section>}

          <section className="panel resources-panel" id="resources"><div className="panel-heading"><div><p className="eyebrow">{isAdmin ? 'RESOURCE MONITORING' : 'CAMPUS DIRECTORY'}</p><h2>{isAdmin ? 'Campus resource directory' : 'Available resources'}</h2></div><span className="panel-number">02</span></div><div className="search-box"><span>⌕</span><input aria-label="Search resources" placeholder="Search resources…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div className="resource-list">{filteredResources.map((resource) => <article className="resource-row" key={resource.resource_id}><div className="resource-symbol">{resource.resource_type === 'LAB' ? '⌘' : resource.resource_type === 'LIBRARY' ? '▤' : resource.resource_type === 'CANTEEN' ? '⌂' : '▧'}</div><div className="resource-info"><strong>{resource.name}</strong><span>{resource.resource_type} · Capacity {resource.capacity ?? 'N/A'}</span></div><span className="available-tag"><i /> Available</span>{!isAdmin && <button className="text-button" onClick={() => { setForm({ ...form, resourceId: String(resource.resource_id) }); document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' }); }}>Select</button>}</article>)}{!loading && filteredResources.length === 0 && <p className="empty-state">No matching resources found.</p>}</div>
          </section>
        </div>

        <section className="panel history-panel" id="history"><div className="panel-heading"><div><p className="eyebrow">{isAdmin ? 'CAMPUS ACTIVITY' : isFaculty ? 'ACADEMIC ACTIVITY' : 'RECENT ACTIVITY'}</p><h2>{isAdmin ? 'All booking activity' : isFaculty ? 'Your faculty booking history' : 'Your booking history'}</h2></div><span className="panel-number">03</span></div>
          {loading ? <p className="empty-state">Loading booking history…</p> : visibleBookings.length === 0 ? <p className="empty-state">No bookings yet. Submit a booking request to see it here.</p> : <div className="table-wrap"><table><thead><tr><th>Booking</th>{isAdmin && <th>User ID</th>}<th>Resource</th><th>Start time</th><th>Priority</th><th>Status</th></tr></thead><tbody>{visibleBookings.map((booking) => <tr key={booking.booking_id}><td className="booking-id">#{booking.booking_id}</td>{isAdmin && <td>{booking.user_id}</td>}<td>{booking.resource_name}</td><td>{formatDate(booking.start_time)}</td><td><span className="priority-value">P{booking.priority}</span></td><td><span className={`status-tag status-${String(booking.status).toLowerCase()}`}>{booking.status}</span></td></tr>)}</tbody></table></div>}
        </section>
        <footer className="dashboard-footer"><span>ORBIT · Organized Resource Booking & Intelligent Task Scheduling</span><span>{roleLabel} workspace · Authenticated session</span></footer>
      </main>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

createRoot(document.getElementById('root')).render(<App />);
