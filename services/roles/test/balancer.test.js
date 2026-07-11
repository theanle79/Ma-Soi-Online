import assert from "node:assert/strict";
import test from "node:test";
import { BALANCE_MODES } from "../src/catalog.js";
import { generateBalancedSelection, getSelectionStats } from "../src/balancer.js";

for (const playerCount of [6, 9, 12, 24]) {
  for (const mode of Object.keys(BALANCE_MODES)) {
    test(`creates a ${mode} role set for ${playerCount} players`, () => {
      const generated = generateBalancedSelection(playerCount, mode);
      const stats = getSelectionStats(generated.selections, mode);
      assert.equal(stats.totalSlots, playerCount);
      assert.equal(stats.balance.withinTarget, true);
    });
  }
}

test("avoids the immediately previous random role set", () => {
  const first = generateBalancedSelection(12, "balanced");
  const second = generateBalancedSelection(12, "balanced", first.signature);
  assert.notEqual(first.signature, second.signature);
});
