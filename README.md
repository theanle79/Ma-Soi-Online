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

- Node.js 20 or newer
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
