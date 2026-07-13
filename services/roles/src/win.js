import { ROLE_BY_ID } from "./catalog.js";

const WOLF_ROLE_IDS = new Set([
  "lone_wolf",
  "werewolf",
  "fruit_wolf",
  "wolf_cub",
  "alpha_wolf",
  "fang_face",
]);

export function evaluateWinner(assignments, alivePlayerIds) {
  const alive = new Set(alivePlayerIds);
  const livingRoles = assignments
    .filter((assignment) => alive.has(assignment.playerId))
    .map((assignment) => ROLE_BY_ID.get(assignment.roleId))
    .filter(Boolean);

  if (livingRoles.length === 0) {
    return {
      winner: "draw",
      reason: "Không còn người chơi sống. Ván chơi kết thúc hòa.",
      counts: { alive: 0, wolves: 0, vampires: 0, opposition: 0 },
    };
  }

  const wolves = livingRoles.filter((role) => WOLF_ROLE_IDS.has(role.id)).length;
  const vampires = livingRoles.filter((role) => role.id === "vampire").length;
  const opposition = livingRoles.length - wolves;
  const counts = { alive: livingRoles.length, wolves, vampires, opposition };

  if (wolves === 0 && vampires === 0) {
    return {
      winner: "village",
      reason: "Không còn Ma Sói hoặc Ma Cà Rồng sống. Phe Dân đã bảo vệ được ngôi làng.",
      counts,
    };
  }

  // With two hostile factions in play, defer victory until one is eliminated.
  if (vampires === 0 && wolves > 0 && wolves >= opposition) {
    return {
      winner: "werewolf",
      reason: `Phe Sói còn ${wolves} Sói, bằng hoặc nhiều hơn ${opposition} người còn lại. Phe Sói đã chiếm ngôi làng.`,
      counts,
    };
  }

  const nonVampires = livingRoles.length - vampires;
  if (wolves === 0 && vampires > 0 && vampires >= nonVampires) {
    return {
      winner: "vampire",
      reason: `Phe Ma Cà Rồng còn ${vampires} người, bằng hoặc nhiều hơn ${nonVampires} người còn lại.`,
      counts,
    };
  }

  return { winner: null, reason: null, counts };
}
