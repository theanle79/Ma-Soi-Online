# Làng Sói moderator kit

A companion tool for in-person Ma Sói games. It replaces physical role cards and the Quan Trò's paper notes while players continue discussing and voting face to face.

## What works

- A Quan Trò creates a room with no player-count selector.
- Up to 24 regular players can join. The Quan Trò is not a player and never receives a role.
- Role assignment unlocks at 6 regular players and is enforced by Lobby Service.
- The Quan Trò can build a role set manually or generate a new randomized set that fits the chosen Ma Sói balance range.
- The Quan Trò can manually assign each selected role or shuffle and deal them privately.
- Each player sees only their own role on their own device.
- The Quan Trò receives role-specific night and day scripts, can queue overnight deaths, and can record immediate daytime deaths.
- Classic Village, Werewolf, and Vampire victory conditions are detected from the living role assignments and end the game automatically.
- If the Quan Trò disconnects, the room closes.

## Services and data ownership

```text
frontend (React + Vite)
        |
realtime gateway (Socket.io)
   |                    |
Lobby Service       Role Service
rooms, members,     role catalogue, balance,
day and death state selected roles, assignments
   |                    |
Lobby PostgreSQL    Role PostgreSQL
```

The gateway has no game database. The Role Service verifies the current roster through Lobby Service's internal API instead of reading Lobby's database.

## Run locally

Requirements: Docker Desktop, Node.js 24.18 or newer, and npm.

1. Start the two databases and three backend services.

```powershell
docker compose up --build
```

2. In another terminal, install and run the frontend.

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open the local URL shown by Vite. The frontend talks to the gateway at `http://localhost:3001` by default.

## Test the balance generator

```powershell
cd services/roles
npm.cmd install
npm.cmd test
```

The tests confirm that generated sets have the requested player count, remain inside the selected score range, and do not repeat the immediately previous generated set.

## Current boundary

This is intentionally a digital moderator kit. Authentication, matchmaking, in-app voting, chat, independent-role victory automation, and production deployment are future work.
