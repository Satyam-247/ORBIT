# ORBIT Frontend Redesign

This is a drop-in replacement for the existing Vite/React frontend. It keeps the current backend API contract:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/resources`
- `GET /api/bookings` (JWT required)
- `POST /api/bookings` (JWT required)

## Apply to your existing repository

Copy `index.html` to `frontend/index.html`, and copy `src/main.jsx` and `src/styles.css` to `frontend/src/`, replacing the existing files.

No additional npm packages are required. The UI uses React and CSS already present in the project. Google Fonts are loaded remotely; system fonts are used as fallbacks.

## Run

Terminal 1:

```cmd
cd path\to\ORBIT\backend
npm run dev
```

Terminal 2:

```cmd
cd path\to\ORBIT\frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (usually `http://localhost:5173`). Register a student account, then sign in. The backend must be running and `.env` must be configured.

## Notes

- This redesign does not change the database schema or backend routes.
- Public registration creates a STUDENT account, as enforced by the existing backend.
- The admin UI is currently a shared layout and resource overview; full resource CRUD and analytics need backend endpoints before they can be implemented safely.
