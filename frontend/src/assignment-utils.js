export function assignPlayerToSlot(slots, targetKey, playerId) {
  const targetSlot = slots.find((slot) => slot.key === targetKey);
  if (!targetSlot || targetSlot.playerId === playerId) return slots;

  const sourceSlot = playerId
    ? slots.find((slot) => slot.key !== targetKey && slot.playerId === playerId)
    : null;

  return slots.map((slot) => {
    if (slot.key === targetKey) return { ...slot, playerId };
    if (slot.key === sourceSlot?.key) return { ...slot, playerId: targetSlot.playerId };
    return slot;
  });
}

export function areAllPlayersAssigned(slots, players) {
  if (!Array.isArray(slots) || !Array.isArray(players) || slots.length !== players.length || players.length === 0) return false;

  const expectedPlayerIds = new Set(players.map((player) => player.id).filter(Boolean));
  if (expectedPlayerIds.size !== players.length) return false;

  const assignedPlayerIds = new Set();
  for (const slot of slots) {
    if (!expectedPlayerIds.has(slot.playerId) || assignedPlayerIds.has(slot.playerId)) return false;
    assignedPlayerIds.add(slot.playerId);
  }
  return assignedPlayerIds.size === expectedPlayerIds.size;
}
