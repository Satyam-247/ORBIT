# ORBIT MVP

## Setup

1. Run `database/schema.sql` in MySQL Workbench.
2. Compile scheduler from `scheduler` with `gcc scheduler.c -o scheduler.exe`.
3. In `backend`, run `npm install`, copy `.env.example` to `.env`, enter MySQL password, then `npm run dev`.
4. In `frontend`, run `npm install`, then `npm run dev`.

Frontend: http://localhost:5173
Backend: http://localhost:5000/api/health

This MVP implements the core Phase-II pipeline: React -> Node/Express -> MySQL, Node policy selection -> C scheduler, scheduler result -> MySQL -> React.

## Database + Authentication
See `backend/AUTH_DATABASE_SETUP.md` for setup, registration/login API tests, JWT use, role behavior, and the ACID rollback test. Do not commit `backend/.env` or any real database password/JWT secret.
