import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  addPlayerToRoom,
  createRoom,
  listRooms,
  removePlayerFromRoom
} from "./rooms.js";
import { DEFAULT_ROLE_SET } from "./roles.js";

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "ma-soi-online-backend"
  });
});

app.get("/roles", (_request, response) => {
  response.json({ roles: DEFAULT_ROLE_SET });
});

app.get("/rooms", (_request, response) => {
  response.json({ rooms: listRooms() });
});

app.post("/rooms", (request, response) => {
  const room = createRoom(request.body);
  io.emit("rooms:updated", listRooms());
  response.status(201).json({ room });
});

io.on("connection", (socket) => {
  socket.emit("rooms:updated", listRooms());

  socket.on("room:join", ({ roomId, playerName } = {}) => {
    if (!roomId) {
      socket.emit("room:error", { message: "roomId is required" });
      return;
    }

    const room = addPlayerToRoom(roomId, {
      id: socket.id,
      name: playerName
    });

    if (!room) {
      socket.emit("room:error", { message: "Room not found" });
      return;
    }

    socket.join(roomId);
    io.to(roomId).emit("room:updated", room);
    io.emit("rooms:updated", listRooms());
  });

  socket.on("room:leave", ({ roomId } = {}) => {
    if (!roomId) {
      return;
    }

    const room = removePlayerFromRoom(roomId, socket.id);
    socket.leave(roomId);

    if (room) {
      io.to(roomId).emit("room:updated", room);
      io.emit("rooms:updated", listRooms());
    }
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) {
        continue;
      }

      const room = removePlayerFromRoom(roomId, socket.id);

      if (room) {
        io.to(roomId).emit("room:updated", room);
      }
    }

    io.emit("rooms:updated", listRooms());
  });
});

httpServer.listen(PORT, () => {
  console.log(`Ma Soi Online backend listening on http://localhost:${PORT}`);
});
