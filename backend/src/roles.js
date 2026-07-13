export const ROLES = {
  WEREWOLF: { id: "werewolf", name: "Ma Sói", faction: "werewolf", description: "Ban đêm chọn một người để tiêu diệt.", icon: "🐺", glow: "240, 60, 60" },
  VILLAGER: { id: "villager", name: "Dân Làng", faction: "village", description: "Không có kỹ năng đặc biệt. Dùng trí tuệ tập thể để tìm ra Ma Sói.", icon: "🌾", glow: "200, 170, 60" },
  SEER: { id: "seer", name: "Tiên Tri", faction: "village", description: "Ban đêm có thể soi sự thật về một người chơi.", icon: "🔮", glow: "60, 130, 200" },
  GUARD: { id: "guard", name: "Bảo Vệ", faction: "village", description: "Ban đêm chọn một người để bảo vệ khỏi Ma Sói.", icon: "🛡️", glow: "80, 190, 140" },
  WITCH: { id: "witch", name: "Phù Thủy", faction: "village", description: "Có thuốc cứu người và thuốc giết người — mỗi loại dùng một lần.", icon: "🧪", glow: "160, 80, 200" },
  HUNTER: { id: "hunter", name: "Thợ Săn", faction: "village", description: "Khi bị loại, có thể kéo theo một người chơi khác.", icon: "🏹", glow: "200, 120, 40" },
};

export const ROLE_CONFIGS = {
  6:  [{ id: "werewolf", count: 2 }, { id: "villager", count: 3 }, { id: "seer", count: 1 }],
  7:  [{ id: "werewolf", count: 2 }, { id: "villager", count: 4 }, { id: "seer", count: 1 }],
  8:  [{ id: "werewolf", count: 2 }, { id: "villager", count: 4 }, { id: "seer", count: 1 }, { id: "guard", count: 1 }],
  9:  [{ id: "werewolf", count: 3 }, { id: "villager", count: 4 }, { id: "seer", count: 1 }, { id: "guard", count: 1 }],
  10: [{ id: "werewolf", count: 3 }, { id: "villager", count: 4 }, { id: "seer", count: 1 }, { id: "guard", count: 1 }, { id: "witch", count: 1 }],
  11: [{ id: "werewolf", count: 3 }, { id: "villager", count: 5 }, { id: "seer", count: 1 }, { id: "guard", count: 1 }, { id: "witch", count: 1 }],
  12: [{ id: "werewolf", count: 3 }, { id: "villager", count: 5 }, { id: "seer", count: 1 }, { id: "guard", count: 1 }, { id: "witch", count: 1 }, { id: "hunter", count: 1 }],
};

export function getRoleConfig(playerCount) {
  return ROLE_CONFIGS[playerCount] || ROLE_CONFIGS[6];
}

export function expandRoles(config) {
  const roles = [];
  for (const entry of config) {
    for (let i = 0; i < entry.count; i++) {
      roles.push(entry.id);
    }
  }
  return roles;
}

export function shuffleRoles(config) {
  const expanded = expandRoles(config);
  for (let i = expanded.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [expanded[i], expanded[j]] = [expanded[j], expanded[i]];
  }
  return expanded;
}
