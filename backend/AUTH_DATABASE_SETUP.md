# ORBIT Database + Authentication module

## What this module implements
- MySQL `users` table with unique email and `STUDENT`, `FACULTY`, `ADMIN` roles.
- Public registration always creates a `STUDENT`; clients cannot self-assign elevated roles.
- Password hashing using bcrypt (12 salt rounds); plaintext passwords are never stored.
- Login issues an 8-hour JWT.
- `requireAuth` validates bearer tokens; `allowRoles(...)` is available for role-restricted routes.
- `/api/auth/me` returns the authenticated account.
- Booking creation uses a MySQL transaction and rolls back booking/process/history changes on failure.
- Booking list requires authentication; students/faculty only see their own bookings, admins can see all.
- `scripts/test-transaction.js` verifies rollback behavior. Run it before describing ACID behavior as verified.

## Setup
1. In MySQL Workbench, run `database/schema.sql` against the local MySQL server. If the schema already exists, back it up first; this script is intended for initial setup and will not migrate an existing `users` table.
2. In `backend`, copy `.env.example` to `.env` and set the actual MySQL password and a long random `JWT_SECRET` (at least 32 characters). Never commit `.env`.
3. Install dependencies: `npm install`.
4. Start backend: `npm run dev`.
5. Check `http://localhost:5000/api/health`.
6. Verify transaction rollback in a second terminal: `npm run test:transaction`.

## API smoke tests
Register:
`POST http://localhost:5000/api/auth/register`
```json
{"name":"Test Student","email":"student1@example.com","password":"test-password-123"}
```
Login:
`POST http://localhost:5000/api/auth/login`
```json
{"email":"student1@example.com","password":"test-password-123"}
```
Copy `token` from login and call `GET http://localhost:5000/api/auth/me` with header:
`Authorization: Bearer <token>`

Protected booking calls must also send that bearer token. `POST /api/bookings` takes `resourceId`, `startTime`, `endTime`, and optional `priority` (1-5) and `serviceTime`.

## Important accuracy note
A successful SQL script run only establishes that the schema was created. Do not claim authentication or ACID verification is complete until registration/login, protected endpoints, a failed booking rollback, and `npm run test:transaction` have been tested on your MySQL instance.
