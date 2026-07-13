# Ma Soi Online MVP

Project skeleton for a local Ma Soi Online MVP.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Real-time: Socket.io
- Storage: in-memory rooms only

## Project Structure

```text
frontend/
backend/
  src/
    server.js
    rooms.js
    roles.js
```

## Prerequisites

- Node.js 20.19 or newer
- npm

## Setup

Install frontend dependencies:

```bash
cd frontend
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
```

## Run Locally

Start the backend:

```bash
cd backend
npm run dev
```

The backend runs on `http://localhost:3001`.

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Available Backend Endpoints

- `GET /health` - backend status
- `GET /rooms` - list in-memory rooms
- `POST /rooms` - create an in-memory room

## Notes

- Game logic is intentionally not implemented yet.
- Rooms are stored in memory and reset when the backend restarts.
- Socket.io currently supports connection, room joining, and room leaving events for local wiring.

## CI/CD

GitHub Actions validates the frontend and backend for pull requests and pushes to `Dev` and `master`.

- `Dev`: CI only.
- `master`: production branch. The frontend deploys to Vercel and Render deploys the backend after GitHub checks pass.

The deployed frontend is `frontend`.

### One-time configuration

1. Create a Render Blueprint from `render.yaml` and connect it to this GitHub repository. Set the `CLIENT_ORIGIN` value to the Vercel production URL. Keep the service at one instance while rooms use in-memory storage.
2. In the Vercel project, set the production `VITE_API_URL` environment variable to the public Render backend URL, for example `https://your-service.onrender.com`.
3. In the GitHub repository, add these Actions secrets:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
4. Protect `master` in GitHub and require the `Frontend` and `Backend` CI checks before merging.

The backend health endpoint is checked at `/health`. Deploying or restarting the Render service clears all rooms because they are intentionally stored in memory.
