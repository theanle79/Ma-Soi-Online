import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createServiceClient, GatewayError } from "./service-client.js";

const PORT = Number(process.env.PORT || 3001);
const LOBBY_SERVICE_URL = process.env.LOBBY_SERVICE_URL || "http://localhost:3002";
const ROLE_SERVICE_URL = process.env.ROLE_SERVICE_URL || "http://localhost:3003";
const SERVICE_AUTH_TOKEN = process.env.SERVICE_AUTH_TOKEN || "";
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGINS, methods: ["GET", "POST"] },
});
const sessions = new Map();

app.use(cors({ origin: CLIENT_ORIGINS }));
app.use(express.json());

const lobby = createServiceClient(LOBBY_SERVICE_URL, SERVICE_AUTH_TOKEN);
const roles = createServiceClient(ROLE_SERVICE_URL, SERVICE_AUTH_TOKEN);

function sessionFor(socket, { hostOnly = false } = {}) {
  const session = sessions.get(socket.id);
  if (!session) throw new GatewayError("not_in_room", "Bạn chưa tham gia phòng.", 403);
  if (hostOnly && !session.isHost) throw new GatewayError("not_host", "Chỉ Quan Trò mới có thể thực hiện việc này.", 403);
  return session;
}

function emitSocketError(socket, error) {
  socket.emit("room:error", { code: error.code || "internal_error", message: error.message || "Đã có lỗi xảy ra." });
}

async function buildRoomState(roomId) {
  const [{ room }, { setup }] = await Promise.all([
    lobby(`/rooms/${roomId}`),
    roles(`/rooms/${roomId}`),
  ]);
  return { room, roleSetup: setup };
}

async function broadcastRoom(roomId) {
  const state = await buildRoomState(roomId);
  io.to(roomId).emit("room:updated", state);
  return state;
}

async function resolveGameAndBroadcast(roomId, hostId) {
  let state = await buildRoomState(roomId);
  if (state.room.status === "playing") {
    const alivePlayerIds = state.room.players
      .filter((player) => player.isAlive)
      .map((player) => player.id);
    const { result } = await roles(`/internal/rooms/${roomId}/win-check`, {
      method: "POST",
      body: { alivePlayerIds },
    });
    if (result.winner) {
      await lobby(`/rooms/${roomId}/end`, {
        method: "POST",
        body: { hostId, winner: result.winner, reason: result.reason },
      });
      state = await buildRoomState(roomId);
    }
  }
  io.to(roomId).emit("room:updated", state);
  return state;
}

async function emitHostView(socket, session) {
  const state = await buildRoomState(session.roomId);
  if (state.room.status !== "assigning") return;
  const { setup, assignments } = await roles(
    `/rooms/${session.roomId}/host-view?actorId=${encodeURIComponent(session.actorId)}`,
  );
  socket.emit("roles:host-view", { setup, assignments });
}

async function emitPlayerState(socket, session) {
  const state = await buildRoomState(session.roomId);
  if (session.isHost || state.room.status !== "playing") return;
  let role = null;
  try {
    ({ role } = await roles(`/rooms/${session.roomId}/players/${session.actorId}/role`));
  } catch (error) {
    if (error.code !== "role_not_assigned") throw error;
  }
  socket.emit("player:state", { ...state, role });
}

async function emitRoomClosed(roomId, message) {
  io.to(roomId).emit("room:closed", { message });
  const sockets = await io.in(roomId).fetchSockets();
  for (const socket of sockets) {
    sessions.delete(socket.id);
    socket.leave(roomId);
  }
}

function handle(socket, handler) {
  return async (payload = {}) => {
    try {
      await handler(payload);
    } catch (error) {
      emitSocketError(socket, error);
    }
  };
}

app.get("/health", async (_req, res) => {
  try {
    const [lobbyHealth, roleHealth] = await Promise.all([lobby("/health"), roles("/health")]);
    res.json({ status: "ok", service: "realtime-gateway", dependencies: [lobbyHealth.service, roleHealth.service] });
  } catch (error) {
    res.status(error.status || 503).json({ status: "degraded", service: "realtime-gateway", error: error.message });
  }
});

io.on("connection", (socket) => {
  socket.on("room:create", handle(socket, async ({ hostName, hostId }) => {
    const { room } = await lobby("/rooms", { method: "POST", body: { hostName, hostId } });
    sessions.set(socket.id, { roomId: room.id, actorId: hostId, isHost: true });
    socket.join(room.id);
    const state = await buildRoomState(room.id);
    socket.emit("room:created", state);
  }));

  socket.on("room:join", handle(socket, async ({ roomCode, playerName, playerId }) => {
    const { room } = await lobby(`/rooms/${encodeURIComponent(String(roomCode || "").toUpperCase())}/join`, {
      method: "POST",
      body: { playerName, playerId },
    });
    sessions.set(socket.id, { roomId: room.id, actorId: playerId, isHost: false });
    socket.join(room.id);
    const state = await buildRoomState(room.id);
    socket.emit("room:joined", state);
    io.to(room.id).emit("room:updated", state);
  }));

  socket.on("room:resume", handle(socket, async ({ roomId, actorId }) => {
    const state = await buildRoomState(roomId);
    const isHost = state.room.hostId === actorId;
    const isPlayer = state.room.players.some((player) => player.id === actorId);
    if (!isHost && !isPlayer) {
      throw new GatewayError("not_in_room", "Bạn không thuộc phòng này.", 403);
    }
    if (state.room.status === "closed") {
      throw new GatewayError("invalid_room_state", "Phòng đã đóng.", 409);
    }
    const session = { roomId: state.room.id, actorId, isHost };
    sessions.set(socket.id, session);
    socket.join(session.roomId);
    socket.emit("room:resumed", state);
    await emitHostView(socket, session);
    await emitPlayerState(socket, session);
  }));

  socket.on("room:start", handle(socket, async () => {
    const session = sessionFor(socket, { hostOnly: true });
    await lobby(`/rooms/${session.roomId}/start`, { method: "POST", body: { hostId: session.actorId } });
    await broadcastRoom(session.roomId);
    await emitHostView(socket, session);
  }));

  socket.on("roles:catalog", handle(socket, async () => {
    const catalog = await roles("/roles");
    socket.emit("roles:catalog", catalog);
  }));

  socket.on("roles:configure", handle(socket, async ({ selections, balanceMode }) => {
    const session = sessionFor(socket, { hostOnly: true });
    await roles(`/rooms/${session.roomId}/configure`, {
      method: "POST",
      body: { hostId: session.actorId, selections, balanceMode },
    });
    await broadcastRoom(session.roomId);
    await emitHostView(socket, session);
  }));

  socket.on("roles:generate", handle(socket, async ({ balanceMode, requestId }) => {
    const session = sessionFor(socket, { hostOnly: true });
    const { setup } = await roles(`/rooms/${session.roomId}/generate`, {
      method: "POST",
      body: { hostId: session.actorId, balanceMode },
    });
    await broadcastRoom(session.roomId);
    socket.emit("roles:host-view", { setup, assignments: [], requestId: requestId || null });
  }));

  socket.on("roles:assign-random", handle(socket, async () => {
    const session = sessionFor(socket, { hostOnly: true });
    const result = await roles(`/rooms/${session.roomId}/assign-random`, {
      method: "POST",
      body: { hostId: session.actorId },
    });
    socket.emit("roles:host-view", result);
  }));

  socket.on("roles:assign-manual", handle(socket, async ({ assignments }) => {
    const session = sessionFor(socket, { hostOnly: true });
    const result = await roles(`/rooms/${session.roomId}/assign-manual`, {
      method: "POST",
      body: { hostId: session.actorId, assignments },
    });
    socket.emit("roles:host-view", result);
  }));

  socket.on("roles:finalize", handle(socket, async () => {
    const session = sessionFor(socket, { hostOnly: true });
    await roles(`/rooms/${session.roomId}/finalize`, { method: "POST", body: { hostId: session.actorId } });
    await lobby(`/rooms/${session.roomId}/play`, { method: "POST", body: { hostId: session.actorId } });
    const state = await resolveGameAndBroadcast(session.roomId, session.actorId);
    if (state.room.status !== "playing") return;
    const roomSockets = await io.in(session.roomId).fetchSockets();
    await Promise.all(roomSockets.map((roomSocket) => {
      const roomSession = sessions.get(roomSocket.id);
      return roomSession ? emitPlayerState(roomSocket, roomSession) : Promise.resolve();
    }));
  }));

  socket.on("game:mark-death", handle(socket, async ({ playerId, markDead }) => {
    const session = sessionFor(socket, { hostOnly: true });
    await lobby(`/rooms/${session.roomId}/players/${playerId}/pending-death`, {
      method: "POST",
      body: { hostId: session.actorId, markDead },
    });
    await resolveGameAndBroadcast(session.roomId, session.actorId);
  }));

  socket.on("game:begin-day", handle(socket, async () => {
    const session = sessionFor(socket, { hostOnly: true });
    await lobby(`/rooms/${session.roomId}/begin-day`, { method: "POST", body: { hostId: session.actorId } });
    await resolveGameAndBroadcast(session.roomId, session.actorId);
  }));

  socket.on("game:begin-night", handle(socket, async () => {
    const session = sessionFor(socket, { hostOnly: true });
    await lobby(`/rooms/${session.roomId}/begin-night`, { method: "POST", body: { hostId: session.actorId } });
    await broadcastRoom(session.roomId);
  }));

  socket.on("game:continue", handle(socket, async () => {
    const session = sessionFor(socket, { hostOnly: true });
    // Remove private roles before reopening the lobby. If this fails, the ended room is unchanged and retryable.
    await roles(`/rooms/${session.roomId}/reset-assignments`, { method: "POST", body: { hostId: session.actorId } });
    await lobby(`/rooms/${session.roomId}/continue`, { method: "POST", body: { hostId: session.actorId } });
    await broadcastRoom(session.roomId);
  }));

  socket.on("room:disband", handle(socket, async () => {
    const session = sessionFor(socket, { hostOnly: true });
    await lobby(`/rooms/${session.roomId}/disband`, { method: "POST", body: { hostId: session.actorId } });
    await emitRoomClosed(session.roomId, "Quản Trò đã giải tán phòng.");
  }));

  socket.on("room:leave", handle(socket, async () => {
    const session = sessionFor(socket);
    if (session.isHost) {
      await lobby(`/rooms/${session.roomId}/close`, { method: "POST", body: { hostId: session.actorId } });
      await emitRoomClosed(session.roomId, "Quan Trò đã rời phòng. Phòng đã được đóng.");
      return;
    }
    await lobby(`/rooms/${session.roomId}/players/${session.actorId}`, { method: "DELETE" });
    sessions.delete(socket.id);
    socket.leave(session.roomId);
    await broadcastRoom(session.roomId);
  }));

  socket.on("disconnecting", () => {
    sessions.delete(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Realtime gateway listening on http://localhost:${PORT}`);
});
