import crypto from "node:crypto";
import { BALANCE_MODES, ROLE_BY_ID } from "./catalog.js";

function randomItem(items) {
  return items[crypto.randomInt(items.length)];
}

function addRole(counts, roleId) {
  counts.set(roleId, (counts.get(roleId) || 0) + 1);
}

function canAdd(counts, role) {
  return (counts.get(role.id) || 0) < role.max;
}

function scoreSelection(counts) {
  return [...counts.entries()].reduce((score, [roleId, quantity]) => score + ROLE_BY_ID.get(roleId).value * quantity, 0);
}

function selectionSignature(counts) {
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([id, count]) => `${id}:${count}`).join("|");
}

function expandCandidate(counts) {
  return [...counts.entries()]
    .map(([roleId, quantity]) => ({ roleId, quantity }))
    .sort((left, right) => left.roleId.localeCompare(right.roleId));
}

function weightedPool(roles) {
  return roles.flatMap((role) => Array.from({ length: role.weight }, () => role));
}

function buildCandidate(playerCount) {
  const counts = new Map();
  const wolfCount = Math.max(2, Math.ceil(playerCount / 4));
  const leadWolf = ROLE_BY_ID.get("werewolf");
  addRole(counts, leadWolf.id);

  const wolfPool = weightedPool([
    { ...ROLE_BY_ID.get("werewolf"), weight: 8 },
    { ...ROLE_BY_ID.get("wolf_cub"), weight: 2 },
    { ...ROLE_BY_ID.get("minion"), weight: 2 },
    { ...ROLE_BY_ID.get("alpha_wolf"), weight: 1 },
    { ...ROLE_BY_ID.get("fruit_wolf"), weight: 1 },
    { ...ROLE_BY_ID.get("fang_face"), weight: 1 },
    { ...ROLE_BY_ID.get("sorceress"), weight: 1 },
  ]);
  while ([...counts.values()].reduce((sum, value) => sum + value, 0) < wolfCount) {
    const available = wolfPool.filter((role) => canAdd(counts, role));
    if (!available.length) break;
    addRole(counts, randomItem(available).id);
  }

  const nonWolfPool = weightedPool([
    { ...ROLE_BY_ID.get("villager"), weight: 16 },
    { ...ROLE_BY_ID.get("seer"), weight: 4 },
    { ...ROLE_BY_ID.get("guard"), weight: 4 },
    { ...ROLE_BY_ID.get("witch"), weight: 3 },
    { ...ROLE_BY_ID.get("hunter"), weight: 3 },
    { ...ROLE_BY_ID.get("cupid"), weight: 2 },
    { ...ROLE_BY_ID.get("mayor"), weight: 2 },
    { ...ROLE_BY_ID.get("cursed"), weight: 2 },
    { ...ROLE_BY_ID.get("prince"), weight: 2 },
    { ...ROLE_BY_ID.get("aura_seer"), weight: 2 },
    { ...ROLE_BY_ID.get("apprentice_seer"), weight: 2 },
    { ...ROLE_BY_ID.get("investigator"), weight: 2 },
    { ...ROLE_BY_ID.get("mentalist"), weight: 2 },
    { ...ROLE_BY_ID.get("tanner"), weight: 1 },
    { ...ROLE_BY_ID.get("hoodlum"), weight: 1 },
    { ...ROLE_BY_ID.get("cult_leader"), weight: 1 },
    { ...ROLE_BY_ID.get("vampire"), weight: 1 },
    { ...ROLE_BY_ID.get("tough_guy"), weight: 1 },
    { ...ROLE_BY_ID.get("diseased"), weight: 1 },
    { ...ROLE_BY_ID.get("old_hag"), weight: 1 },
    { ...ROLE_BY_ID.get("gambler"), weight: 1 },
  ]);

  while ([...counts.values()].reduce((sum, value) => sum + value, 0) < playerCount) {
    const available = nonWolfPool.filter((role) => canAdd(counts, role));
    if (!available.length) break;
    addRole(counts, randomItem(available).id);
  }
  return counts;
}

export function balanceFor(modeId, score) {
  const mode = BALANCE_MODES[modeId] || BALANCE_MODES.balanced;
  return {
    mode: mode.id,
    label: mode.name,
    score,
    target: mode.target,
    min: mode.min,
    max: mode.max,
    withinTarget: score >= mode.min && score <= mode.max,
    guidance: mode.guidance,
  };
}

export function generateBalancedSelection(playerCount, modeId = "balanced", previousSignature = null) {
  const mode = BALANCE_MODES[modeId] || BALANCE_MODES.balanced;
  let closest = null;
  const acceptable = [];

  for (let attempt = 0; attempt < 6000; attempt += 1) {
    const counts = buildCandidate(playerCount);
    const score = scoreSelection(counts);
    const signature = selectionSignature(counts);
    if (signature === previousSignature) continue;
    const candidate = { counts, score, signature };
    if (score >= mode.min && score <= mode.max) acceptable.push(candidate);
    if (!closest || Math.abs(score - mode.target) < Math.abs(closest.score - mode.target)) {
      closest = candidate;
    }
  }

  const chosen = acceptable.length ? randomItem(acceptable) : closest;
  if (!chosen) throw new Error("Could not generate a balanced role set.");
  return {
    selections: expandCandidate(chosen.counts),
    signature: chosen.signature,
    balance: balanceFor(mode.id, chosen.score),
  };
}

export function getSelectionStats(selections, modeId = "balanced") {
  const normalized = new Map();
  for (const selection of selections) {
    const role = ROLE_BY_ID.get(selection.roleId);
    if (!role || !Number.isInteger(selection.quantity) || selection.quantity < 1) {
      throw new Error("Invalid role selection.");
    }
    if (selection.quantity > role.max) throw new Error(`${role.name} vượt quá giới hạn.`);
    normalized.set(role.id, (normalized.get(role.id) || 0) + selection.quantity);
  }
  for (const [roleId, quantity] of normalized) {
    if (quantity > ROLE_BY_ID.get(roleId).max) throw new Error(`${ROLE_BY_ID.get(roleId).name} vượt quá giới hạn.`);
  }
  const totalSlots = [...normalized.values()].reduce((sum, quantity) => sum + quantity, 0);
  const score = scoreSelection(normalized);
  return {
    selections: expandCandidate(normalized),
    totalSlots,
    signature: selectionSignature(normalized),
    balance: balanceFor(modeId, score),
  };
}

export function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const otherIndex = crypto.randomInt(index + 1);
    [copy[index], copy[otherIndex]] = [copy[otherIndex], copy[index]];
  }
  return copy;
}
