import assert from "node:assert/strict";
import test from "node:test";

import { assignPlayerToSlot } from "./assignment-utils.js";

function slot(key, roleId, playerId = "") {
  return { key, roleId, playerId };
}

test("moves an assigned player into an unassigned role slot", () => {
  const slots = [
    slot("werewolf-0", "werewolf"),
    slot("villager-0", "villager", "player-1"),
  ];

  assert.deepEqual(assignPlayerToSlot(slots, "werewolf-0", "player-1"), [
    slot("werewolf-0", "werewolf", "player-1"),
    slot("villager-0", "villager"),
  ]);
});

test("swaps players when the selected player already has another role", () => {
  const slots = [
    slot("witch-0", "witch", "player-1"),
    slot("seer-0", "seer", "player-2"),
  ];

  assert.deepEqual(assignPlayerToSlot(slots, "seer-0", "player-1"), [
    slot("witch-0", "witch", "player-2"),
    slot("seer-0", "seer", "player-1"),
  ]);
});

test("can clear a role without changing the other slots", () => {
  const slots = [
    slot("witch-0", "witch", "player-1"),
    slot("seer-0", "seer", "player-2"),
  ];

  assert.deepEqual(assignPlayerToSlot(slots, "witch-0", ""), [
    slot("witch-0", "witch"),
    slot("seer-0", "seer", "player-2"),
  ]);
});
