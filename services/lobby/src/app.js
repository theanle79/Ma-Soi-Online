import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import { inTransaction, pool } from "./db.js";
import {
  appError,
  assertHost,
  assertRoomStatus,
  generateRoomCode,
  isUuid,
  mapRoom,
  MIN_START_PLAYERS,
  normalizeName,
  PLAYER_LIMIT,
  requireUuid,
  WINNERS,
} from "./lobby-domain.js";

async function findRoom(client, idOrCode, { lock = false } = {}) {
  const query = isUuid(idOrCode)
    ? "SELECT * FROM rooms WHERE id = $1"
    : "SELECT * FROM rooms WHERE code = $1";
  const suffix = lock ? " FOR UPDATE" : "";
  const result = await client.query(`${query}${suffix}`, [String(idOrCode).toUpperCase()]);
  return result.rows[0] || null;
}

async function roomSnapshot(client, idOrCode) {
  const room = await findRoom(client, idOrCode);
  if (!room) return null;
  const players = await client.query(
    "SELECT * FROM participants WHERE room_id = $1 ORDER BY joined_at ASC",
    [room.id],
  );
  return mapRoom(room, players.rows);
}

export function createLobbyApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", async (_req, res, next) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", service: "lobby-service" });
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res, next) => {
    const expectedToken = process.env.SERVICE_AUTH_TOKEN;
    if (!expectedToken || req.get("authorization") === `Bearer ${expectedToken}`) return next();
    return res.status(401).json({ error: "service_unauthorized", message: "Yêu cầu nội bộ không hợp lệ." });
  });

  app.get("/rooms", async (_req, res, next) => {
    try {
      const result = await pool.query("SELECT id FROM rooms WHERE status <> 'closed' ORDER BY created_at DESC");
      const rooms = [];
      for (const row of result.rows) {
        rooms.push(await roomSnapshot(pool, row.id));
      }
      res.json({ rooms });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms", async (req, res, next) => {
    try {
      const hostName = normalizeName(req.body.hostName, "tên Quan Trò");
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const room = await inTransaction(async (client) => {
        let code;
        for (let attempts = 0; attempts < 10; attempts += 1) {
          code = generateRoomCode();
          const exists = await client.query("SELECT 1 FROM rooms WHERE code = $1", [code]);
          if (exists.rowCount === 0) break;
        }
        const id = crypto.randomUUID();
        await client.query(
          "INSERT INTO rooms (id, code, host_id, host_name, player_limit) VALUES ($1, $2, $3, $4, $5)",
          [id, code, hostId, hostName, PLAYER_LIMIT],
        );
        return roomSnapshot(client, id);
      });
      res.status(201).json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.get("/rooms/:roomId", async (req, res, next) => {
    try {
      const room = await roomSnapshot(pool, req.params.roomId);
      if (!room) throw appError("room_not_found", "Không tìm thấy phòng.", 404);
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.get("/rooms/code/:code", async (req, res, next) => {
    try {
      const room = await roomSnapshot(pool, req.params.code);
      if (!room) throw appError("room_not_found", "Mã phòng không tồn tại.", 404);
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:code/join", async (req, res, next) => {
    try {
      const playerName = normalizeName(req.body.playerName, "tên người chơi");
      const playerId = requireUuid(req.body.playerId, "Mã người chơi");
      const room = await inTransaction(async (client) => {
        const found = await findRoom(client, req.params.code, { lock: true });
        if (!found) throw appError("room_not_found", "Mã phòng không tồn tại.", 404);
        assertRoomStatus(found, ["waiting"]);
        const count = await client.query("SELECT COUNT(*)::int AS count FROM participants WHERE room_id = $1", [found.id]);
        if (count.rows[0].count >= PLAYER_LIMIT) {
          throw appError("room_full", "Phòng đã đủ 24 người chơi.", 409);
        }
        const existingId = await client.query(
          "SELECT * FROM participants WHERE room_id = $1 AND player_id = $2",
          [found.id, playerId],
        );
        if (existingId.rowCount === 0) {
          try {
            await client.query(
              "INSERT INTO participants (room_id, player_id, name) VALUES ($1, $2, $3)",
              [found.id, playerId, playerName],
            );
          } catch (error) {
            if (error.code === "23505") {
              throw appError("duplicate_player", "Tên này đã có trong phòng. Hãy chọn tên khác.", 409);
            }
            throw error;
          }
        }
        return roomSnapshot(client, found.id);
      });
      res.status(201).json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/start", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const room = await inTransaction(async (client) => {
        const found = await findRoom(client, req.params.roomId, { lock: true });
        if (!found) throw appError("room_not_found", "Không tìm thấy phòng.", 404);
        assertHost(found, hostId);
        assertRoomStatus(found, ["waiting"]);
        const count = await client.query("SELECT COUNT(*)::int AS count FROM participants WHERE room_id = $1", [found.id]);
        if (count.rows[0].count < MIN_START_PLAYERS) {
          throw appError("not_enough_players", "Cần ít nhất 6 người chơi để bắt đầu.", 409);
        }
        await client.query(
          "UPDATE rooms SET status = 'assigning', game_phase = 'role_assignment' WHERE id = $1",
          [found.id],
        );
        return roomSnapshot(client, found.id);
      });
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/play", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const room = await inTransaction(async (client) => {
        const found = await findRoom(client, req.params.roomId, { lock: true });
        if (!found) throw appError("room_not_found", "Không tìm thấy phòng.", 404);
        assertHost(found, hostId);
        assertRoomStatus(found, ["assigning"]);
        await client.query(
          "UPDATE rooms SET status = 'playing', game_phase = 'night', game_day = 1 WHERE id = $1",
          [found.id],
        );
        return roomSnapshot(client, found.id);
      });
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/players/:playerId/pending-death", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const playerId = requireUuid(req.params.playerId, "Mã người chơi");
      const markDead = Boolean(req.body.markDead);
      const room = await inTransaction(async (client) => {
        const found = await findRoom(client, req.params.roomId, { lock: true });
        if (!found) throw appError("room_not_found", "Không tìm thấy phòng.", 404);
        assertHost(found, hostId);
        assertRoomStatus(found, ["playing"]);
        let update;
        if (found.game_phase === "night") {
          update = await client.query(
            "UPDATE participants SET pending_death = $1 WHERE room_id = $2 AND player_id = $3 AND is_alive = TRUE RETURNING player_id",
            [markDead, found.id, playerId],
          );
        } else if (found.game_phase === "day") {
          if (!markDead) {
            throw appError("cannot_undo_day_death", "Không thể bỏ ghi nhận tử vong ban ngày. Hãy kiểm tra trước khi xác nhận.", 409);
          }
          update = await client.query(
            "UPDATE participants SET is_alive = FALSE, pending_death = FALSE WHERE room_id = $1 AND player_id = $2 AND is_alive = TRUE RETURNING player_id",
            [found.id, playerId],
          );
        } else {
          throw appError("invalid_game_phase", "Chỉ có thể ghi nhận tử vong trong đêm hoặc ban ngày.", 409);
        }
        if (update.rowCount === 0) throw appError("player_not_found", "Người chơi không còn hợp lệ.", 404);
        return roomSnapshot(client, found.id);
      });
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/begin-day", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const room = await inTransaction(async (client) => {
        const found = await findRoom(client, req.params.roomId, { lock: true });
        if (!found) throw appError("room_not_found", "Không tìm thấy phòng.", 404);
        assertHost(found, hostId);
        assertRoomStatus(found, ["playing"]);
        if (found.game_phase !== "night") throw appError("invalid_game_phase", "Hiện chưa phải ban đêm.", 409);
        await client.query(
          "UPDATE participants SET is_alive = FALSE, pending_death = FALSE WHERE room_id = $1 AND pending_death = TRUE",
          [found.id],
        );
        await client.query("UPDATE rooms SET game_phase = 'day' WHERE id = $1", [found.id]);
        return roomSnapshot(client, found.id);
      });
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/begin-night", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const room = await inTransaction(async (client) => {
        const found = await findRoom(client, req.params.roomId, { lock: true });
        if (!found) throw appError("room_not_found", "Không tìm thấy phòng.", 404);
        assertHost(found, hostId);
        assertRoomStatus(found, ["playing"]);
        if (found.game_phase !== "day") throw appError("invalid_game_phase", "Hãy bắt đầu ban ngày trước.", 409);
        await client.query("UPDATE rooms SET game_phase = 'night', game_day = game_day + 1 WHERE id = $1", [found.id]);
        return roomSnapshot(client, found.id);
      });
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/end", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const winner = String(req.body.winner || "");
      const reason = String(req.body.reason || "").trim();
      if (!WINNERS.has(winner) || !reason) {
        throw appError("invalid_winner", "Kết quả ván chơi không hợp lệ.");
      }
      const room = await inTransaction(async (client) => {
        const found = await findRoom(client, req.params.roomId, { lock: true });
        if (!found) throw appError("room_not_found", "Không tìm thấy phòng.", 404);
        assertHost(found, hostId);
        assertRoomStatus(found, ["playing"]);
        await client.query(
          `UPDATE rooms
           SET status = 'ended', game_phase = 'ended', winner = $1, end_reason = $2, ended_at = NOW()
           WHERE id = $3`,
          [winner, reason, found.id],
        );
        return roomSnapshot(client, found.id);
      });
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/continue", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quản Trò");
      const room = await inTransaction(async (client) => {
        const found = await findRoom(client, req.params.roomId, { lock: true });
        if (!found) throw appError("room_not_found", "Không tìm thấy phòng.", 404);
        assertHost(found, hostId);
        assertRoomStatus(found, ["ended"]);
        await client.query(
          `UPDATE rooms
           SET status = 'waiting', game_day = 0, game_phase = 'lobby',
               winner = NULL, end_reason = NULL, ended_at = NULL
           WHERE id = $1`,
          [found.id],
        );
        await client.query(
          "UPDATE participants SET is_alive = TRUE, pending_death = FALSE WHERE room_id = $1",
          [found.id],
        );
        return roomSnapshot(client, found.id);
      });
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/disband", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quản Trò");
      const room = await inTransaction(async (client) => {
        const found = await findRoom(client, req.params.roomId, { lock: true });
        if (!found) throw appError("room_not_found", "Không tìm thấy phòng.", 404);
        assertHost(found, hostId);
        assertRoomStatus(found, ["ended"]);
        await client.query(
          "UPDATE rooms SET status = 'closed', game_phase = 'closed', closed_at = NOW() WHERE id = $1",
          [found.id],
        );
        return roomSnapshot(client, found.id);
      });
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/rooms/:roomId/players/:playerId", async (req, res, next) => {
    try {
      const playerId = requireUuid(req.params.playerId, "Mã người chơi");
      const room = await inTransaction(async (client) => {
        const found = await findRoom(client, req.params.roomId, { lock: true });
        if (!found) throw appError("room_not_found", "Không tìm thấy phòng.", 404);
        if (found.host_id === playerId) {
          await client.query(
            "UPDATE rooms SET status = 'closed', game_phase = 'closed', closed_at = NOW() WHERE id = $1",
            [found.id],
          );
        } else {
          assertRoomStatus(found, ["waiting"]);
          await client.query("DELETE FROM participants WHERE room_id = $1 AND player_id = $2", [found.id, playerId]);
        }
        return roomSnapshot(client, found.id);
      });
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/close", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const room = await inTransaction(async (client) => {
        const found = await findRoom(client, req.params.roomId, { lock: true });
        if (!found) throw appError("room_not_found", "Không tìm thấy phòng.", 404);
        assertHost(found, hostId);
        await client.query(
          "UPDATE rooms SET status = 'closed', game_phase = 'closed', closed_at = NOW() WHERE id = $1",
          [found.id],
        );
        return roomSnapshot(client, found.id);
      });
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.get("/internal/rooms/:roomId/eligibility", async (req, res, next) => {
    try {
      const room = await roomSnapshot(pool, req.params.roomId);
      if (!room) throw appError("room_not_found", "Không tìm thấy phòng.", 404);
      const actorId = req.query.actorId ? String(req.query.actorId) : null;
      res.json({
        room: {
          id: room.id,
          status: room.status,
          gamePhase: room.gamePhase,
          hostId: room.hostId,
          actorIsHost: actorId === room.hostId,
          playerCount: room.playerCount,
          players: room.players.map(({ id, name, isAlive }) => ({ id, name, isAlive })),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ error: error.code || "internal_error", message: error.message || "Đã có lỗi xảy ra." });
  });

  return app;
}
