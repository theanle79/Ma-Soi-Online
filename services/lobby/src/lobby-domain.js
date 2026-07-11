import crypto from "node:crypto";

export const PLAYER_LIMIT = 24;
export const MIN_START_PLAYERS = 6;
export const WINNERS = new Set(["village", "werewolf", "vampire", "draw"]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function appError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function normalizeName(value, label) {
  const name = String(value || "").trim();
  if (!name) throw appError("missing_name", `Cần nhập ${label}.`);
  if (name.length > 32) throw appError("name_too_long", `${label} tối đa 32 ký tự.`);
  return name;
}

export function isUuid(value) {
  return UUID_PATTERN.test(String(value));
}

export function requireUuid(value, label) {
  if (!value || !isUuid(value)) {
    throw appError("missing_id", `${label} không hợp lệ.`);
  }
  return String(value);
}

export function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[crypto.randomInt(alphabet.length)];
  }
  return code;
}

export function mapRoom(row, players) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    hostId: row.host_id,
    hostName: row.host_name,
    status: row.status,
    playerLimit: row.player_limit,
    playerCount: players.length,
    gameDay: row.game_day,
    gamePhase: row.game_phase,
    winner: row.winner,
    endReason: row.end_reason,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    players: players.map((player) => ({
      id: player.player_id,
      name: player.name,
      joinedAt: player.joined_at,
      isAlive: player.is_alive,
      pendingDeath: player.pending_death,
    })),
  };
}

export function assertHost(room, hostId) {
  if (room.host_id !== hostId) {
    throw appError("not_host", "Chỉ Quan Trò mới có thể thực hiện việc này.", 403);
  }
}

export function assertRoomStatus(room, allowed) {
  if (!allowed.includes(room.status)) {
    throw appError("invalid_room_state", "Phòng không ở trạng thái phù hợp cho thao tác này.", 409);
  }
}
