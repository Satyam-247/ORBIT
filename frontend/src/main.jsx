import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const navItems = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'book', label: 'Book a resource', icon: '＋' },
  { id: 'bookings', label: 'My bookings', icon: '▤' },
  { id: 'resources', label: 'Resources', icon: '◫' },
];
const initialForm = () => {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return { resourceId: '', startTime: local(start), endTime: local(end), priority: 3, serviceTime: 30 };
};

async function api(path, options = {}, token = '') {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) };
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) throw new Error('Your session expired. Please sign in again.');
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  return data;
}

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span>; }
function Status({ value }) {
  const status = String(value || 'PENDING').toLowerCase();
  return <span className={`status status-${status}`}>{String(value || 'PENDING').replaceAll('_', ' ')}</span>;
}
function EmptyState({ icon = '▤', title, detail, action, onAction }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{detail}</p>{action && <button className="button button-primary" onClick={onAction}>{action}</button>}</div>;
}
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (mode === 'register') {
        await api('/auth/register', { method: 'POST', body: JSON.stringify(form) });
        setMode('login'); setError('Account created. Sign in with your new credentials.');
      } else {
        const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: form.email, password: form.password }) });
        onLogin(data);
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-shell">
    <div className="auth-visual">
      <div className="brand brand-light"><div className="brand-mark">O</div><span>ORBIT</span></div>
      <div className="auth-visual-copy"><span className="eyebrow">CAMPUS RESOURCE PLATFORM</span><h1>Your campus,<br /><em>in sync.</em></h1><p>One place to book spaces, manage resources and keep campus life moving.</p></div>
      <div className="orbit-graphic"><div className="orbit-ring ring-one"/><div className="orbit-ring ring-two"/><div className="orbit-core">O</div><span className="orbit-node node-one">⌂</span><span className="orbit-node node-two">▤</span><span className="orbit-node node-three">◷</span></div>
      <div className="auth-visual-foot"><span>SMARTER RESOURCE ALLOCATION</span><span>BUILT FOR CAMPUS LIFE</span></div>
    </div>
    <div className="auth-panel"><div className="auth-form-wrap"><div className="mobile-brand brand"><div className="brand-mark">O</div><span>ORBIT</span></div><span className="eyebrow">WELCOME TO ORBIT</span><h2>{mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</h2><p className="muted">{mode === 'login' ? 'Manage your campus bookings from one dashboard.' : 'Get started with your campus resource account.'}</p>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'register' && <label>Full name<input autoComplete="name" required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Your full name" /></label>}
        <label>Email address<input type="email" autoComplete="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@university.edu" /></label>
        <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required value={form.password} onChange={e => update('password', e.target.value)} placeholder="At least 8 characters" /></label>
        {error && <div className={error.startsWith('Account created') ? 'notice notice-success' : 'notice notice-error'}>{error}</div>}
        <button className="button button-primary button-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <span>↗</span></button>
      </form>
      <p className="auth-switch">{mode === 'login' ? 'New to ORBIT?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
      <p className="auth-note">By continuing, you agree to use campus resources responsibly.</p>
    </div></div>
  </div>;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('orbit_token') || '');
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('orbit_user') || 'null'); } catch { return null; } });
  const [page, setPage] = useState('overview');
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState('');
  const [apiState, setApiState] = useState('checking');

  const logout = useCallback(() => {
    localStorage.removeItem('orbit_token'); localStorage.removeItem('orbit_user');
    setToken(''); setUser(null); setBookings([]); setMessage(null); setPage('overview');
  }, []);
  const handleLogin = (data) => {
    localStorage.setItem('orbit_token', data.token); localStorage.setItem('orbit_user', JSON.stringify(data.user));
    setToken(data.token); setUser(data.user); setMessage({ type: 'success', text: `Welcome back, ${data.user.name.split(' ')[0]}.` });
  };

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [resourceData, bookingData] = await Promise.all([
        api('/resources'), api('/bookings', {}, token),
      ]);
      setResources(Array.isArray(resourceData) ? resourceData : []);
      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setApiState('online');
    } catch (err) {
      if (/session expired|invalid or expired token|authentication required/i.test(err.message)) logout();
      setApiState('error'); setMessage({ type: 'error', text: err.message });
    } finally { setLoading(false); }
  }, [token, logout]);

  useEffect(() => { if (token) loadData(); }, [token, loadData]);
  useEffect(() => {
    api('/health').then(() => setApiState('online')).catch(() => setApiState('error'));
  }, []);

  const scheduled = bookings.filter(b => ['SCHEDULED', 'CONFIRMED'].includes(String(b.status).toUpperCase()));
  const pending = bookings.filter(b => String(b.status).toUpperCase() === 'PENDING');
  const filteredResources = resources.filter(r => `${r.name} ${r.resource_type}`.toLowerCase().includes(search.toLowerCase()));
  const upcoming = useMemo(() => [...bookings].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)).filter(b => new Date(b.end_time) >= new Date()), [bookings]);
  const setField = (key, value) => setForm(old => ({ ...old, [key]: value }));

  async function submitBooking(e) {
    e.preventDefault(); setBusy(true); setMessage(null);
    try {
      const result = await api('/bookings', { method: 'POST', body: JSON.stringify({ ...form, resourceId: Number(form.resourceId), priority: Number(form.priority), serviceTime: Number(form.serviceTime) }) }, token);
      setMessage({ type: 'success', text: `Booking #${result.bookingId} scheduled with ${result.algorithm}.` });
      setForm(initialForm()); await loadData(); setPage('bookings');
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  if (!token || !user) return <AuthScreen onLogin={handleLogin} />;
  const pageTitle = { overview: 'Overview', book: 'Book a resource', bookings: 'My bookings', resources: 'Campus resources' }[page] || 'Overview';
  const pageSub = { overview: 'Here’s what’s happening across your campus.', book: 'Find a space and reserve the time you need.', bookings: 'Track your reservations and scheduling status.', resources: 'Explore the spaces and services available to you.' }[page] || '';

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">O</div><span>ORBIT</span><small> CAMPUS</small></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav">{navItems.map(item => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMessage(null); }}><Icon>{item.icon}</Icon><span>{item.label}</span>{item.id === 'bookings' && bookings.length > 0 && <small>{bookings.length}</small>}</button>)}</nav>
      {user.role === 'ADMIN' && <><div className="workspace-label nav-spacer">ADMINISTRATION</div><button className={`nav-item ${page === 'resources' ? 'active' : ''}`} onClick={() => setPage('resources')}><Icon>⚙</Icon><span>Resource overview</span></button></>}
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon">✳</div><strong>Need a hand?</strong><p>Keep your campus plans running smoothly.</p><button onClick={() => setMessage({ type: 'info', text: 'For support, contact your campus administrator.' })}>Get support <span>↗</span></button></div><div className="profile-row"><div className="avatar">{(user.name || 'U').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}</div><div className="profile-info"><strong>{user.name}</strong><span>{user.role || 'STUDENT'}</span></div><button className="logout-button" title="Sign out" onClick={logout}>↪</button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{pageTitle}</strong></div><div className="topbar-actions"><span className={`connection ${apiState}`}><i />{apiState === 'online' ? 'System online' : apiState === 'error' ? 'Connection issue' : 'Checking connection'}</span><button className="icon-button notification-button" title="Notifications" onClick={() => setMessage({ type: 'info', text: 'You’re all caught up. No new notifications.' })}>♧<i /></button><div className="top-avatar">{(user.name || 'U')[0].toUpperCase()}</div></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">YOUR CAMPUS, ORGANIZED</div><h1>{pageTitle}<span className="heading-period">.</span></h1><p>{pageSub}</p></div>{page !== 'book' && <button className="button button-primary" onClick={() => { setPage('book'); setMessage(null); }}><span>＋</span> New booking</button>}</div>
        {message && <div className={`notice notice-${message.type}`} role="status"><span>{message.type === 'success' ? '✓' : message.type === 'error' ? '!' : 'i'}</span>{message.text}<button onClick={() => setMessage(null)} aria-label="Dismiss">×</button></div>}
        {page === 'overview' && <>
          <section className="welcome-banner"><div className="welcome-copy"><span className="banner-tag"><i /> YOUR CAMPUS AT A GLANCE</span><h2>Make room for<br /><em>what matters.</em></h2><p>Book smarter. Spend less time coordinating. Get on with your day.</p><button className="button button-white" onClick={() => setPage('book')}>Reserve a resource <span>↗</span></button></div><div className="banner-art"><div className="art-sun"/><div className="art-building building-back"><span/><span/><span/></div><div className="art-building building-front"><span/><span/><span/><span/></div><div className="art-path"/><div className="art-spark spark-one">✳</div><div className="art-spark spark-two">✦</div></div></section>
          <div className="section-title-row"><div><h2>Overview</h2><p>A quick look at your resource activity.</p></div><button className="text-button" onClick={loadData}>↻ Refresh data</button></div>
          <section className="stats-grid">
            <StatCard label="Total bookings" value={bookings.length} note="All your reservations" icon="▤" tone="violet" />
            <StatCard label="Scheduled" value={scheduled.length} note="Ready to go" icon="✓" tone="green" />
            <StatCard label="Pending" value={pending.length} note="Awaiting processing" icon="◷" tone="amber" />
            <StatCard label="Available resources" value={resources.length} note="Currently bookable" icon="◫" tone="blue" />
          </section>
          <section className="overview-grid"><div className="panel upcoming-panel"><div className="panel-heading"><div><h3>Upcoming bookings</h3><p>Your next campus reservations</p></div><button className="text-button" onClick={() => setPage('bookings')}>View all <span>→</span></button></div>{loading ? <LoadingRows /> : upcoming.length ? <div className="booking-list">{upcoming.slice(0, 4).map(b => <BookingRow key={b.booking_id} booking={b} />)}</div> : <EmptyState icon="◷" title="Nothing on your calendar" detail="Your upcoming reservations will appear here." action="Book a resource" onAction={() => setPage('book')} />}</div>
            <div className="panel resources-panel"><div className="panel-heading"><div><h3>Explore resources</h3><p>Spaces available to book</p></div><button className="round-arrow" onClick={() => setPage('resources')}>↗</button></div>{resources.slice(0, 4).map((r, i) => <ResourceMini key={r.resource_id} resource={r} index={i} onBook={() => { setField('resourceId', String(r.resource_id)); setPage('book'); }} />)}{!resources.length && !loading && <p className="muted small-pad">No resources available right now.</p>}</div></section>
        </>}
        {page === 'book' && <section className="booking-layout"><div className="panel booking-panel"><div className="panel-heading"><div><h3>Reservation details</h3><p>Choose your resource and preferred time.</p></div><span className="step-pill">STEP 01 / 01</span></div><form onSubmit={submitBooking} className="booking-form">
          <label className="field-full">Resource<select required value={form.resourceId} onChange={e => setField('resourceId', e.target.value)}><option value="">Select a resource</option>{resources.map(r => <option key={r.resource_id} value={r.resource_id}>{r.name} · {prettyType(r.resource_type)}</option>)}</select></label>
          <label>Start date & time<input type="datetime-local" required value={form.startTime} onChange={e => setField('startTime', e.target.value)} /></label>
          <label>End date & time<input type="datetime-local" required min={form.startTime} value={form.endTime} onChange={e => setField('endTime', e.target.value)} /></label>
          <label>Priority<select value={form.priority} onChange={e => setField('priority', e.target.value)}><option value="1">1 · Highest</option><option value="2">2 · High</option><option value="3">3 · Normal</option><option value="4">4 · Low</option><option value="5">5 · Lowest</option></select><span className="field-hint">Priority is used by the scheduling policy.</span></label>
          <label>Service duration<input type="number" min="1" max="600" required value={form.serviceTime} onChange={e => setField('serviceTime', e.target.value)} /><span className="field-hint">Estimated service time in minutes.</span></label>
          <div className="form-footnote field-full"><span>ⓘ</span> Your booking will be checked for availability and processed by ORBIT’s scheduling engine.</div>
          <div className="field-full form-actions"><button type="button" className="button button-secondary" onClick={() => setForm(initialForm())}>Reset form</button><button disabled={busy || !resources.length} className="button button-primary">{busy ? 'Processing booking…' : 'Confirm booking'} <span>↗</span></button></div>
        </form></div><aside className="booking-aside"><div className="aside-illustration"><div className="calendar-art"><div className="calendar-top"/><div className="calendar-grid">{Array.from({length: 12}, (_, i) => <i key={i}/>)}</div><div className="calendar-check">✓</div></div><span className="aside-star star-a">✦</span><span className="aside-star star-b">✳</span></div><div className="aside-copy"><span className="eyebrow">HOW IT WORKS</span><h3>Booked in a few steps.</h3><ul><li><span>1</span><div><strong>Choose a resource</strong><p>Find the space or service you need.</p></div></li><li><span>2</span><div><strong>Set your time</strong><p>Pick a start and end time.</p></div></li><li><span>3</span><div><strong>ORBIT schedules it</strong><p>Availability is checked and the request is processed.</p></div></li></ul></div><div className="policy-note"><span>✳</span><p><strong>Smart scheduling</strong><br />ORBIT selects a scheduling policy internally based on the resource and request.</p></div></aside></section>}
        {page === 'bookings' && <section className="panel table-panel"><div className="panel-heading table-heading"><div><h3>Booking history</h3><p>{bookings.length} reservation{bookings.length === 1 ? '' : 's'} in your account</p></div><button className="button button-secondary button-small" onClick={loadData}>↻ Refresh</button></div>{loading ? <LoadingRows /> : bookings.length ? <div className="table-wrap"><table><thead><tr><th>RESOURCE</th><th>DATE & TIME</th><th>PRIORITY</th><th>STATUS</th><th>BOOKING</th></tr></thead><tbody>{[...bookings].sort((a,b) => b.booking_id-a.booking_id).map(b => <tr key={b.booking_id}><td><div className="table-resource"><div className={`resource-symbol symbol-${typeTone(b.resource_type)}`}>{typeIcon(b.resource_type)}</div><div><strong>{b.resource_name || 'Campus resource'}</strong><span>{prettyType(b.resource_type)}</span></div></div></td><td><strong>{formatDate(b.start_time)}</strong><span className="cell-sub">{formatTime(b.start_time)} – {formatTime(b.end_time)}</span></td><td><span className="priority-dot">P{b.priority}</span></td><td><Status value={b.status}/></td><td><span className="booking-number">#{String(b.booking_id).padStart(4, '0')}</span></td></tr>)}</tbody></table></div> : <EmptyState title="No bookings yet" detail="When you make a reservation, it will show up here." action="Create your first booking" onAction={() => setPage('book')} />}</section>}
        {page === 'resources' && <><div className="resource-toolbar"><div className="search-box"><span>⌕</span><input placeholder="Search resources or categories…" value={search} onChange={e => setSearch(e.target.value)} /></div><span className="result-count">{filteredResources.length} resources available</span></div>{loading ? <LoadingRows /> : filteredResources.length ? <div className="resource-grid">{filteredResources.map((r, i) => <ResourceCard key={r.resource_id} resource={r} index={i} onBook={() => { setField('resourceId', String(r.resource_id)); setPage('book'); }} />)}</div> : <EmptyState icon="⌕" title="No matching resources" detail="Try another search term or check back later." />}</>}
        <footer className="page-footer"><span>© 2026 ORBIT · Organized Resource Booking</span><span><i className={`footer-dot ${apiState}`} /> {apiState === 'online' ? 'All systems operational' : 'Check backend connection'}</span></footer>
      </div>
    </main>
  </div>;
}

function StatCard({ label, value, note, icon, tone }) { return <div className="stat-card"><div className={`stat-icon tone-${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div><div className={`stat-decoration deco-${tone}`} /></div>; }
function BookingRow({ booking }) { return <div className="booking-row"><div className={`date-tile tile-${typeTone(booking.resource_type)}`}><strong>{new Date(booking.start_time).toLocaleDateString('en-IN', { day: '2-digit' })}</strong><span>{new Date(booking.start_time).toLocaleDateString('en-IN', { month: 'short' })}</span></div><div className="booking-row-main"><strong>{booking.resource_name || 'Campus resource'}</strong><span>{formatDate(booking.start_time)} · {formatTime(booking.start_time)} – {formatTime(booking.end_time)}</span></div><Status value={booking.status}/></div>; }
function ResourceMini({ resource, index, onBook }) { return <div className="resource-mini"><div className={`resource-symbol symbol-${typeTone(resource.resource_type)}`}>{typeIcon(resource.resource_type)}</div><div className="resource-mini-info"><strong>{resource.name}</strong><span>{prettyType(resource.resource_type)}</span></div><span className="available-dot" title="Available"/><button className="mini-arrow" onClick={onBook} aria-label={`Book ${resource.name}`}>↗</button></div>; }
function ResourceCard({ resource, index, onBook }) { const tone = typeTone(resource.resource_type); return <article className="resource-card"><div className={`resource-card-art art-${tone}`}><span className="resource-art-icon">{typeIcon(resource.resource_type)}</span><span className="resource-card-category">{prettyType(resource.resource_type)}</span><div className="art-orbit-circle"/><div className="art-orbit-line"/></div><div className="resource-card-body"><div className="resource-card-title"><h3>{resource.name}</h3><span className="available-label"><i/> Available</span></div><p>Available for campus booking through ORBIT.</p><div className="resource-card-footer"><span><i className="available-dot"/> Ready to reserve</span><button className="button button-primary button-small" onClick={onBook}>Book resource <span>↗</span></button></div></div></article>; }
function LoadingRows() { return <div className="loading-state"><span className="spinner"/> Loading your campus data…</div>; }
function prettyType(type = '') { const t = String(type).toUpperCase(); return ({ LAB: 'Computer lab', LIBRARY: 'Library', CANTEEN: 'Canteen', PRINTING: 'Printing service' })[t] || (type ? String(type).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : 'Campus resource'); }
function typeTone(type = '') { return ({ LAB: 'violet', LIBRARY: 'green', CANTEEN: 'orange', PRINTING: 'blue' })[String(type).toUpperCase()] || 'violet'; }
function typeIcon(type = '') { return ({ LAB: '⌘', LIBRARY: '▤', CANTEEN: '✳', PRINTING: '▧' })[String(type).toUpperCase()] || '◫'; }
function formatDate(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Date not set' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function formatTime(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }

createRoot(document.getElementById('root')).render(<App />);
