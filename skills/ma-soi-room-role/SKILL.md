---
name: ma-soi-room-role
description: Implement or review Ma Soi Online room, lobby, game-start, and role-assignment work. Use for Quan Tro rules, six-player start validation, waiting screens, manual or random roles, or extracting Lobby, Role, and Realtime Gateway services.
---

# Ma Soi Room Role

## Context

- Frontend: React/Vite in frontend/; backend: Express/Socket.io in backend/.
- Current state is in-memory. Do not add dependencies, persistence, or unrelated features.

## Locked rules

- Quan Tro is the host, never a player or role recipient.
- Start requires at least 6 non-host players; enforce in UI and service logic.
- Start changes room state to assigning: players wait, Quan Tro assigns roles.
- Role assignments must use eligible non-host members only; reject duplicates and insufficient players.

## Service boundaries

- realtime-gateway: Socket.io/API translation and broadcasts; no domain state.
- lobby-service: rooms, host, membership, eligibility, and start-state guard.
- role-service: role slots, selection, manual/random assignment, and assignment validation.
- Services never access another service's store; Role Service asks Lobby Service for eligibility.

## Workflow

1. Inspect first: rg -n "playerCount|maxPlayers|room:deal|assignments|hostId" frontend/src backend/src
2. Make the smallest scoped change. Preserve unrelated behavior.
3. Keep client events and service contracts explicit and idempotent.
4. Verify build plus the affected join, start, waiting, manual, random, and host-exclusion paths.

## Completion report

State changed files, validation run, and any unresolved product decision. Keep the report under 120 words.
