import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import { BALANCE_MODES, ROLE_BY_ID, ROLE_CATALOG } from "./catalog.js";
import { balanceFor, generateBalancedSelection, getSelectionStats, shuffle } from "./balancer.js";
import { inTransaction, pool } from "./db.js";
import {
  appError,
  assertReadyForAssignment,
  expandedRoleIds,
  normalizeMode,
  normalizeSelections,
  requireUuid,
  validateManualAssignments,
} from "./role-domain.js";
import { evaluateWinner } from "./win.js";

function normalizeBaseUrl(baseUrl) {
  const normalized = String(baseUrl || "").trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(normalized) ? normalized : `http://${normalized}`;
}

const LOBBY_SERVICE_URL = normalizeBaseUrl(process.env.LOBBY_SERVICE_URL || "http://localhost:3002");
const SERVICE_AUTH_TOKEN = process.env.SERVICE_AUTH_TOKEN || "";

async function fetchEligibility(roomId, actorId) {
  const response = await fetch(`${LOBBY_SERVICE_URL}/internal/rooms/${roomId}/eligibility?actorId=${encodeURIComponent(actorId)}`, {
    headers: SERVICE_AUTH_TOKEN ? { authorization: `Bearer ${SERVICE_AUTH_TOKEN}` } : undefined,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw appError(body.error || "lobby_unavailable", body.message || "Không thể xác thực phòng.", response.status);
  return body.room;
}

async function assertHostForRoleWork(roomId, hostId) {
  const lobbyRoom = await fetchEligibility(roomId, hostId);
  if (!lobbyRoom.actorIsHost) throw appError("not_host", "Chỉ Quan Trò mới có thể thay đổi vai trò.", 403);
  if (lobbyRoom.status !== "assigning") {
    throw appError("invalid_room_state", "Phòng chưa ở bước phân vai.", 409);
  }
  return lobbyRoom;
}

function mapSelectedRole(row) {
  const role = ROLE_BY_ID.get(row.role_id);
  return { ...role, quantity: Number(row.quantity) };
}

async function getSetupState(client, roomId) {
  const setup = await client.query("SELECT * FROM room_role_setups WHERE room_id = $1", [roomId]);
  const roleRows = await client.query(
    `SELECT selected_roles.role_id, selected_roles.quantity
     FROM selected_roles
     WHERE selected_roles.room_id = $1
     ORDER BY selected_roles.role_id ASC`,
    [roomId],
  );
  const mode = setup.rows[0]?.balance_mode || "balanced";
  const raw = roleRows.rows.map((row) => ({ roleId: row.role_id, quantity: Number(row.quantity) }));
  const stats = getSelectionStats(raw, mode);
  return {
    roomId,
    balanceMode: mode,
    selectedRoles: roleRows.rows.map(mapSelectedRole),
    totalSlots: stats.totalSlots,
    balance: stats.balance,
    lastGeneratedSignature: setup.rows[0]?.last_generated_signature || null,
  };
}

async function saveSetup(client, roomId, stats, mode, signature = null) {
  await client.query(
    `INSERT INTO room_role_setups (room_id, balance_mode, last_generated_signature, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (room_id) DO UPDATE SET
       balance_mode = EXCLUDED.balance_mode,
       last_generated_signature = EXCLUDED.last_generated_signature,
       updated_at = NOW()`,
    [roomId, mode, signature],
  );
  await client.query("DELETE FROM selected_roles WHERE room_id = $1", [roomId]);
  for (const selection of stats.selections) {
    await client.query(
      "INSERT INTO selected_roles (room_id, role_id, quantity) VALUES ($1, $2, $3)",
      [roomId, selection.roleId, selection.quantity],
    );
  }
  await client.query("DELETE FROM assignments WHERE room_id = $1", [roomId]);
}

async function getAssignments(client, roomId) {
  const result = await client.query(
    "SELECT player_id, role_id FROM assignments WHERE room_id = $1 ORDER BY assigned_at ASC",
    [roomId],
  );
  return result.rows.map((row) => ({ playerId: row.player_id, roleId: row.role_id }));
}

async function writeAssignments(client, roomId, assignments) {
  await client.query("DELETE FROM assignments WHERE room_id = $1", [roomId]);
  for (const assignment of assignments) {
    await client.query(
      "INSERT INTO assignments (room_id, player_id, role_id) VALUES ($1, $2, $3)",
      [roomId, assignment.playerId, assignment.roleId],
    );
  }
}

export function createRoleApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", async (_req, res, next) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", service: "role-service" });
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res, next) => {
    const expectedToken = process.env.SERVICE_AUTH_TOKEN;
    if (!expectedToken || req.get("authorization") === `Bearer ${expectedToken}`) return next();
    return res.status(401).json({ error: "service_unauthorized", message: "Yêu cầu nội bộ không hợp lệ." });
  });

  app.get("/roles", (_req, res) => {
    res.json({ roles: ROLE_CATALOG, balanceModes: Object.values(BALANCE_MODES) });
  });

  app.get("/rooms/:roomId", async (req, res, next) => {
    try {
      const setup = await getSetupState(pool, req.params.roomId);
      res.json({ setup });
    } catch (error) {
      next(error);
    }
  });

  app.get("/rooms/:roomId/host-view", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.query.actorId, "Mã Quan Trò");
      await assertHostForRoleWork(req.params.roomId, hostId);
      const setup = await getSetupState(pool, req.params.roomId);
      const assignments = await getAssignments(pool, req.params.roomId);
      res.json({ setup, assignments });
    } catch (error) {
      next(error);
    }
  });

  app.get("/rooms/:roomId/players/:playerId/role", async (req, res, next) => {
    try {
      const assignment = await pool.query(
        "SELECT role_id FROM assignments WHERE room_id = $1 AND player_id = $2",
        [req.params.roomId, req.params.playerId],
      );
      if (assignment.rowCount === 0) throw appError("role_not_assigned", "Vai trò chưa được chia.", 404);
      res.json({ role: ROLE_BY_ID.get(assignment.rows[0].role_id) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/internal/rooms/:roomId/win-check", async (req, res, next) => {
    try {
      const alivePlayerIds = Array.isArray(req.body.alivePlayerIds)
        ? req.body.alivePlayerIds.map((playerId) => requireUuid(playerId, "Mã người chơi"))
        : [];
      const assignments = await getAssignments(pool, req.params.roomId);
      if (assignments.length === 0) {
        throw appError("roles_not_assigned", "Phòng chưa có dữ liệu phân vai.", 409);
      }
      res.json({ result: evaluateWinner(assignments, alivePlayerIds) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/configure", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const lobbyRoom = await assertHostForRoleWork(req.params.roomId, hostId);
      const mode = normalizeMode(req.body.balanceMode);
      const stats = normalizeSelections(req.body.selections);
      if (stats.totalSlots > lobbyRoom.playerCount) {
        throw appError("too_many_roles", `Không thể chọn quá ${lobbyRoom.playerCount} vai.`, 409);
      }
      const setup = await inTransaction(async (client) => {
        await saveSetup(client, req.params.roomId, stats, mode);
        return getSetupState(client, req.params.roomId);
      });
      res.json({ setup });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/generate", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const lobbyRoom = await assertHostForRoleWork(req.params.roomId, hostId);
      if (lobbyRoom.playerCount < 6) throw appError("not_enough_players", "Cần ít nhất 6 người chơi để tạo bộ vai.", 409);
      const mode = normalizeMode(req.body.balanceMode);
      const previous = await getSetupState(pool, req.params.roomId);
      const generated = generateBalancedSelection(lobbyRoom.playerCount, mode, previous.lastGeneratedSignature);
      if (!generated.balance.withinTarget) {
        throw appError("balance_unavailable", "Không thể tạo bộ vai đúng khoảng điểm đã chọn. Hãy đổi mức cân bằng.", 409);
      }
      const stats = normalizeSelections(generated.selections);
      const setup = await inTransaction(async (client) => {
        await saveSetup(client, req.params.roomId, stats, mode, generated.signature);
        return getSetupState(client, req.params.roomId);
      });
      res.json({ setup });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/assign-random", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const lobbyRoom = await assertHostForRoleWork(req.params.roomId, hostId);
      const setup = await getSetupState(pool, req.params.roomId);
      assertReadyForAssignment(setup, lobbyRoom);
      const roleIds = shuffle(expandedRoleIds(setup.selectedRoles));
      const players = shuffle(lobbyRoom.players);
      const assignments = players.map((player, index) => ({ playerId: player.id, roleId: roleIds[index] }));
      const saved = await inTransaction(async (client) => {
        await writeAssignments(client, req.params.roomId, assignments);
        return getAssignments(client, req.params.roomId);
      });
      res.json({ setup, assignments: saved });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/assign-manual", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const lobbyRoom = await assertHostForRoleWork(req.params.roomId, hostId);
      const setup = await getSetupState(pool, req.params.roomId);
      validateManualAssignments(req.body.assignments, setup, lobbyRoom);
      const saved = await inTransaction(async (client) => {
        await writeAssignments(client, req.params.roomId, req.body.assignments);
        return getAssignments(client, req.params.roomId);
      });
      res.json({ setup, assignments: saved });
    } catch (error) {
      next(error);
    }
  });

  app.post("/rooms/:roomId/finalize", async (req, res, next) => {
    try {
      const hostId = requireUuid(req.body.hostId, "Mã Quan Trò");
      const lobbyRoom = await assertHostForRoleWork(req.params.roomId, hostId);
      const setup = await getSetupState(pool, req.params.roomId);
      assertReadyForAssignment(setup, lobbyRoom);
      const assignments = await getAssignments(pool, req.params.roomId);
      validateManualAssignments(assignments, setup, lobbyRoom);
      res.json({ setup, assignments });
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
