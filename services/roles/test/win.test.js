import assert from "node:assert/strict";
import test from "node:test";
import { evaluateWinner } from "../src/win.js";

const assignment = (playerId, roleId) => ({ playerId, roleId });

test("village wins when the final hostile role is eliminated", () => {
  const result = evaluateWinner(
    [assignment("wolf", "werewolf"), assignment("seer", "seer"), assignment("villager", "villager")],
    ["seer", "villager"],
  );
  assert.equal(result.winner, "village");
});

test("werewolves win at parity with the remaining opposition", () => {
  const result = evaluateWinner(
    [
      assignment("wolf-1", "werewolf"),
      assignment("wolf-2", "alpha_wolf"),
      assignment("villager-1", "villager"),
      assignment("villager-2", "seer"),
    ],
    ["wolf-1", "wolf-2", "villager-1", "villager-2"],
  );
  assert.equal(result.winner, "werewolf");
});

test("wolf-aligned helpers do not count as living wolves for parity", () => {
  const result = evaluateWinner(
    [assignment("minion", "minion"), assignment("villager", "villager")],
    ["minion", "villager"],
  );
  assert.equal(result.winner, "village");
});

test("mixed hostile factions do not trigger a premature winner", () => {
  const result = evaluateWinner(
    [assignment("wolf", "werewolf"), assignment("vampire", "vampire"), assignment("villager", "villager")],
    ["wolf", "vampire", "villager"],
  );
  assert.equal(result.winner, null);
});
