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
