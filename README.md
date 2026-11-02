# ORBIT

**Organized Resource Booking & Intelligent Task Scheduling**

ORBIT is a campus resource-booking application with role-based access, MySQL persistence, a C scheduling engine, and a Banker's Algorithm demonstration module.

## Included in this consolidated build

- Student, Faculty, and resource-scoped Admin accounts.
- JWT authentication and bcrypt password hashing.
- Admin invitation-code gate for public admin registration.
- Server-enforced resource and booking visibility.
- Capacity-aware overlapping booking checks under a resource-row transaction lock.
- Booking requests enter a READY process queue instead of being marked scheduled immediately.
- Admins can run a batch of up to 100 queued processes for their assigned resource.
- C scheduling algorithms: FCFS, non-preemptive SJF, non-preemptive Priority, and Round Robin.
- Scheduler output includes process metrics and a Gantt-style execution timeline.
- Banker's Algorithm safety/request demonstration in `scheduler/deadlock.c`.

## Requirements

- Node.js 20 or newer.
- MySQL 8.0 or compatible MySQL release.
- GCC/MinGW compiler available as `gcc` (for Windows, install MinGW-w64 and ensure `gcc.exe` is on PATH).

## 1. Database setup

Create the database and tables:

```sql
SOURCE database/schema.sql;
```

If you are upgrading an existing ORBIT database rather than creating a fresh one, take a backup first and apply the required migrations in order. Do not re-run the full schema blindly against an existing production database.

For an existing database that already has the original `users`, `resources`, `bookings`, `processes`, and `scheduling_history` tables:

```sql
SOURCE database/migrations/001_create_resource_admins.sql;
SOURCE database/migrations/002_process_scheduling_fields.sql;
SOURCE database/migrations/003_one_resource_per_admin.sql;
```

Migrations 002 and 003 are intended for the original schema only. Inspect your current columns and existing admin assignments before applying them if you have already made schema changes. Migration 003 requires each admin user to be assigned to no more than one resource.

## 2. Backend setup

Open a terminal in `backend`:

```bash
npm install
```

Copy `.env.example` to `.env` and set your own values:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`: random secret with at least 32 characters
- `ADMIN_REGISTRATION_CODE`: private code required to register an Admin account
- `CORS_ORIGIN`: frontend origin, normally `http://localhost:5173`
- `SCHEDULER_PATH` (optional): override the compiled scheduler executable path
- `DEADLOCK_PATH` (optional): override the compiled Banker checker path

Do not commit `.env`.

Compile the C programs from the backend directory:

```bash
npm run build:scheduler
npm run build:deadlock
```

Start the backend:

```bash
npm run dev
```

The API runs at `http://localhost:5000` by default.

## 3. Frontend setup

Open a second terminal in `frontend`:

```bash
npm install
```

Copy `.env.example` to `.env` if your backend is not at the default URL. Then run:

```bash
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

## 4. Main workflow

1. Register as Student or Faculty and sign in.
2. Submit a booking request for a resource and time range.
3. The backend checks resource capacity in a transaction and creates a booking plus a READY process.
4. Sign in as the Admin assigned to that resource.
5. The Admin dashboard shows only that assigned resource and its bookings.
6. Select an algorithm (or automatic policy) and run the scheduling batch.
7. The C engine returns the execution timeline and waiting/turnaround/response metrics. The backend stores the metrics and updates the booking/process state.

## API summary

- `GET /api/health`
- `GET /api/auth/admin-resources`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/resources` (authenticated; Admin is resource-scoped)
- `GET /api/bookings` (authenticated; Admin is resource-scoped, others see their own)
- `GET /api/deadlock/state` (Admin only; live Banker safety state for the assigned resource)
- `POST /api/bookings` (Student/Faculty only)
- `POST /api/scheduling/run` (Admin only; assigned resource only)

## Important design notes and remaining production work

This is an integrated academic MVP, not a certified production booking platform. The following are intentionally not claimed as complete:

- The C scheduler simulates process service order. It does not execute real campus work or wait until the actual booking start time.
- Booking capacity is modelled as one capacity unit per booking. If different resource types consume different quantities, add a requested-unit field and allocation ledger.
- The booking overlap check uses row locking on the resource record. For deployments with high concurrency or multi-instance workers, add stronger idempotency and transaction/concurrency tests.
- Admin registration uses a shared invitation code. A production deployment should replace this with invitation tokens issued by a trusted super-admin.
- Add password reset/email verification through a configured mail provider, rate limiting, audit logs, notifications, automated API/browser tests, backups, and deployment secrets management before public deployment.

## Scheduler input protocol

The scheduler reads:

```text
ALGORITHM
PROCESS_COUNT
[TIME_QUANTUM for RR]
process_id,arrival,burst,priority
...
```

Priority 1 is the highest priority. The scheduler supports at most 100 processes per run. Arrival values are relative simulation times, not Unix timestamps.

## Troubleshooting

- **Scheduler executable missing:** run `npm run build:scheduler` from `backend`; verify `SCHEDULER_PATH` points to the generated file.
- **Database connection failed:** verify MySQL is running and `.env` matches the database credentials.
- **Admin cannot see resources:** verify the `resource_admins` mapping exists and the account is assigned to a resource.
- **Admin registration rejected:** set the same `ADMIN_REGISTRATION_CODE` in backend `.env` and enter it in the registration form.
- **Port 5000 already in use:** stop the existing backend process instead of starting another copy.

## Banker safety monitor integration

The C Banker safety checker is invoked by the backend for each new booking request and is exposed to assigned resource admins at `GET /api/deadlock/state`. The monitor uses live bookings overlapping the current time window for the admin's assigned resource. The current ORBIT booking model has one resource per booking, so this integration models **one resource type with one unit per active booking**. It is a dynamic safety check for that model, but it is not a general multi-resource deadlock detector or recovery engine.

Build both native programs from source after extracting the project:

```bash
cd backend
npm install
npm run build:scheduler
npm run build:deadlock
npm test
```

On Windows, the scripts produce `scheduler.exe` and `deadlock.exe` in the `scheduler` directory. On Linux/macOS, compile to `scheduler` and `deadlock` (without `.exe`) because the runtime selects the platform-specific name. The Python regression tests compile temporary test binaries themselves and do not depend on prebuilt executables.

### Current scope and remaining production work

- The Banker monitor is single-resource-type because a booking currently references one resource. Supporting simultaneous claims on multiple resource types requires a multi-resource booking/claim model and corresponding UI.
- Unsafe requests are rejected before the booking transaction commits. Since the current app uses avoidance and a single resource type with finite booking windows, it does not intentionally create deadlocks. A genuine multi-resource wait-for/resource-allocation-graph detector and recovery policy requires modelling processes that can hold one resource while waiting for another; that is not represented in the current booking schema.
- Email verification and password reset require a configured email provider (SMTP credentials or a transactional email service). They are not enabled by this source package; do not claim they work until a provider is configured and tested.
- Live MySQL concurrency testing, browser end-to-end testing, deployment hardening, rate limiting, and production observability still need to be run in the target environment.
