export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
export const EMPTY_SETUP = {
  selectedRoles: [],
  totalSlots: 0,
  balanceMode: "new_players",
  balance: { score: 0, withinTarget: false },
};
export const TEAM_LABELS = {
  village: "Phe Dân",
  werewolf: "Phe Sói",
  vampire: "Ma Cà Rồng",
  other: "Phe riêng",
};
export const WINNER_LABELS = {
  village: "Phe Dân chiến thắng",
  werewolf: "Phe Sói chiến thắng",
  vampire: "Phe Ma Cà Rồng chiến thắng",
  draw: "Ván chơi hòa",
};
export const TEAM_ORDER = ["village", "werewolf", "vampire", "other"];

export function getDeviceId() {
  const key = "ma-soi-device-id";
  const saved = localStorage.getItem(key);
  if (saved) return saved;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

export function joinCodeFromPath() {
  return window.location.pathname.match(/^\/join\/([a-z0-9]{6})$/i)?.[1]?.toUpperCase() || "";
}

export function buildSlots(selectedRoles) {
  return selectedRoles
    .flatMap((role) => Array.from(
      { length: role.quantity },
      (_, index) => ({ key: `${role.id}-${index}`, roleId: role.id, role, playerId: "" }),
    ))
    .sort((left, right) => left.role.nightOrder - right.role.nightOrder
      || left.role.name.localeCompare(right.role.name));
}

export function hydrateSlots(slots, assignments) {
  const queues = new Map();
  assignments.forEach((assignment) => {
    const queue = queues.get(assignment.roleId) || [];
    queue.push(assignment.playerId);
    queues.set(assignment.roleId, queue);
  });
  return slots.map((slot) => ({ ...slot, playerId: queues.get(slot.roleId)?.shift() || "" }));
}

export function formatScore(score) {
  return score > 0 ? `+${score}` : String(score || 0);
}

export function playerInitial(name) {
  return name?.trim().slice(0, 1).toUpperCase() || "?";
}

export function roleWakesTonight(role, gameDay) {
  if (role.wakesAtNight === "every_night") return true;
  if (role.wakesAtNight === "night_one") return gameDay === 1;
  if (role.wakesAtNight === "from_night_two") return gameDay >= 2;
  return false;
}

export function scriptForRole(role, room) {
  const victims = room.players.filter((player) => player.pendingDeath).map((player) => player.name);
  const victimText = victims.length ? victims.join(", ") : "chưa có ai được đánh dấu";
  return (role.moderatorScript || role.ability).replace("{victims}", victimText);
}
