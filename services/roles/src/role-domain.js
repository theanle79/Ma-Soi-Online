import { getSelectionStats } from "./balancer.js";
import { BALANCE_MODES, ROLE_BY_ID } from "./catalog.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function appError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function requireUuid(value, label) {
  if (!value || !UUID_PATTERN.test(String(value))) {
    throw appError("missing_id", `${label} không hợp lệ.`);
  }
  return String(value);
}

export function normalizeSelections(input) {
  if (!Array.isArray(input)) throw appError("invalid_roles", "Danh sách vai trò không hợp lệ.");
  const selections = input
    .map((item) => ({ roleId: String(item?.roleId || ""), quantity: Number(item?.quantity) }))
    .filter((item) => item.quantity > 0);
  try {
    return getSelectionStats(selections);
  } catch (error) {
    throw appError("invalid_roles", error.message);
  }
}

export function normalizeMode(value) {
  return BALANCE_MODES[value] ? value : "balanced";
}

export function expandedRoleIds(selectedRoles) {
  return selectedRoles.flatMap((role) => Array.from({ length: role.quantity }, () => role.id));
}

export function assertReadyForAssignment(setup, lobbyRoom) {
  if (lobbyRoom.playerCount < 6) {
    throw appError("not_enough_players", "Cần ít nhất 6 người chơi để phân vai.", 409);
  }
  if (setup.totalSlots !== lobbyRoom.playerCount) {
    throw appError(
      "incomplete_role_set",
      `Cần chọn đúng ${lobbyRoom.playerCount} vai cho ${lobbyRoom.playerCount} người chơi.`,
      409,
    );
  }
}

export function validateManualAssignments(assignments, setup, lobbyRoom) {
  if (!Array.isArray(assignments)) throw appError("invalid_assignments", "Danh sách phân vai không hợp lệ.");
  assertReadyForAssignment(setup, lobbyRoom);
  if (assignments.length !== lobbyRoom.players.length) {
    throw appError("invalid_assignments", "Mỗi người chơi phải có đúng một vai.");
  }

  const expectedPlayers = new Set(lobbyRoom.players.map((player) => player.id));
  const assignedPlayers = new Set();
  const assignedRoleCounts = new Map();
  for (const assignment of assignments) {
    const playerId = String(assignment?.playerId || "");
    const roleId = String(assignment?.roleId || "");
    if (!expectedPlayers.has(playerId) || assignedPlayers.has(playerId)) {
      throw appError("invalid_assignments", "Không thể gán trùng vai cho một người hoặc gán cho Quan Trò.");
    }
    if (!ROLE_BY_ID.has(roleId)) throw appError("invalid_roles", "Có vai trò không tồn tại.");
    assignedPlayers.add(playerId);
    assignedRoleCounts.set(roleId, (assignedRoleCounts.get(roleId) || 0) + 1);
  }
  if (assignedPlayers.size !== expectedPlayers.size) {
    throw appError("invalid_assignments", "Mỗi người chơi phải có đúng một vai.");
  }
  const selectedCounts = new Map(setup.selectedRoles.map((role) => [role.id, role.quantity]));
  for (const [roleId, expectedCount] of selectedCounts) {
    if ((assignedRoleCounts.get(roleId) || 0) !== expectedCount) {
      throw appError("invalid_assignments", "Phân vai phải khớp với bộ vai đã chọn.");
    }
  }
}
