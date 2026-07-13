import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  addPlayerToRoom,
  createRoom,
  dealRoles,
  getPlayerRole,
  getRoom,
  getRoomByCode,
  listRooms,
  removePlayerFromRoom,
  resetRoom,
} from "./rooms.js";
import { getRoleConfig, ROLES } from "./roles.js";

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGINS, methods: ["GET", "POST"] },
});

app.use(cors({ origin: CLIENT_ORIGINS }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ma-soi-online-backend" });
});

app.get("/rooms", (_req, res) => {
  res.json({ rooms: listRooms() });
});

app.get("/roles/config/:playerCount", (req, res) => {
  const count = parseInt(req.params.playerCount, 10);
  if (count < 6 || count > 12) {
    return res.status(400).json({ error: "Player count must be 6-12" });
  }
  res.json({ config: getRoleConfig(count), total: count });
});

app.post("/rooms", (req, res) => {
  const { hostName, playerCount, roleConfig } = req.body;
  if (playerCount < 6 || playerCount > 12) {
    return res.status(400).json({ error: "Player count must be 6-12" });
  }
  const room = createRoom({ hostName, playerCount, roleConfig });
  io.emit("rooms:updated", listRooms());
  res.status(201).json({ room });
});

io.on("connection", (socket) => {
  socket.emit("rooms:updated", listRooms());

  socket.on("room:create", ({ hostName, playerCount } = {}) => {
    const room = createRoom({ hostName, playerCount: playerCount || 8 });
    room.hostId = socket.id;
    socket.join(room.id);
    socket.emit("room:created", room);
    io.emit("rooms:updated", listRooms());
  });

  socket.on("room:join", ({ roomCode, playerName } = {}) => {
    if (!roomCode || !playerName) {
      socket.emit("room:error", { message: "Vui lòng nhập mã phòng và tên của bạn." });
      return;
    }
    const room = getRoomByCode(roomCode);
    if (!room) {
      socket.emit("room:error", { message: "Mã phòng không tồn tại." });
      return;
    }
    if (room.status !== "waiting") {
      socket.emit("room:error", { message: "Phòng đã bắt đầu chia vai." });
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      socket.emit("room:error", { message: "Phòng đã đầy người chơi." });
      return;
    }
    const duplicate = room.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase());
    if (duplicate) {
      socket.emit("room:error", { message: `Tên "${playerName}" đã có trong phòng. Vui lòng chọn tên khác.` });
      return;
    }

    const player = { id: socket.id, name: playerName };
    const result = addPlayerToRoom(room.id, player);
    if (result && result.error === "duplicate_name") {
      socket.emit("room:error", { message: "Tên này đã được sử dụng." });
      return;
    }
    if (!result) {
      socket.emit("room:error", { message: "Không thể tham gia phòng." });
      return;
    }

    socket.join(room.id);
    socket.emit("room:joined", { room: result, playerId: socket.id });
    io.to(room.id).emit("room:updated", result);
    io.emit("rooms:updated", listRooms());
  });

  socket.on("room:deal", ({ roomId } = {}) => {
    const room = getRoom(roomId);
    if (!room) {
      socket.emit("room:error", { message: "Phòng không tồn tại." });
      return;
    }
    if (room.hostId !== socket.id) {
      socket.emit("room:error", { message: "Chỉ Host mới có thể chia bài." });
      return;
    }
    const result = dealRoles(roomId);
    if (result && result.error === "not_enough_players") {
      socket.emit("room:error", { message: "Chưa đủ người chơi để chia vai." });
      return;
    }
    if (!result) {
      socket.emit("room:error", { message: "Chia vai thất bại." });
      return;
    }

    io.to(roomId).emit("room:updated", result);

    for (const p of room.players) {
      const roleId = getPlayerRole(roomId, p.id);
      const role = Object.values(ROLES).find((r) => r.id === roleId);
      io.to(p.id).emit("role:assigned", { role });
    }
  });

  socket.on("room:reset", ({ roomId } = {}) => {
    const room = getRoom(roomId);
    if (!room) {
      socket.emit("room:error", { message: "Phòng không tồn tại." });
      return;
    }
    if (room.hostId !== socket.id) {
      socket.emit("room:error", { message: "Chỉ Host mới có thể reset." });
      return;
    }
    const result = resetRoom(roomId);
    if (result) {
      io.to(roomId).emit("room:updated", result);
      io.emit("rooms:updated", listRooms());
    }
  });

  socket.on("room:leave", ({ roomId } = {}) => {
    const room = removePlayerFromRoom(roomId, socket.id);
    socket.leave(roomId);
    if (room) {
      io.to(roomId).emit("room:updated", room);
      io.emit("rooms:updated", listRooms());
    }
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      const room = removePlayerFromRoom(roomId, socket.id);
      if (room) io.to(roomId).emit("room:updated", room);
    }
    io.emit("rooms:updated", listRooms());
  });
});

httpServer.listen(PORT, () => {
  console.log(`Ma Soi Online backend listening on http://localhost:${PORT}`);
});
