import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { io } from "socket.io-client";

const gatewayUrl = process.env.GATEWAY_URL || "http://localhost:3001";
const timeout = 8_000;

function connectClient() {
  return new Promise((resolve, reject) => {
    const socket = io(gatewayUrl, { transports: ["websocket"], forceNew: true });
    const timer = setTimeout(() => reject(new Error("Socket connection timed out")), timeout);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", reject);
  });
}

function waitFor(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    function listener(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, listener);
      resolve(payload);
    }
    socket.on(event, listener);
  });
}

function emitAndWait(socket, emittedEvent, payload, receivedEvent, predicate) {
  const event = waitFor(socket, receivedEvent, predicate);
  socket.emit(emittedEvent, payload);
  return event;
}

test("runs the persistent lobby, balanced role deal, and day transition flow", async (t) => {
  const sockets = [];
  t.after(() => sockets.forEach((socket) => socket.disconnect()));

  const host = await connectClient();
  sockets.push(host);
  const hostId = crypto.randomUUID();
  const emptyRoom = await emitAndWait(host, "room:create", { hostName: "Quan Tro Test", hostId }, "room:created");
  const missingPlayers = await emitAndWait(host, "room:start", {}, "room:error", (error) => error.code === "not_enough_players");
  assert.match(missingPlayers.message, /ít nhất 6/i);

  const roomState = await emitAndWait(host, "room:create", { hostName: "Quan Tro Chính", hostId: crypto.randomUUID() }, "room:created");
  const roomCode = roomState.room.code;
  const playerClients = [];
  const playerIds = [];
  for (let index = 1; index <= 6; index += 1) {
    const player = await connectClient();
    sockets.push(player);
    playerClients.push(player);
    const playerId = crypto.randomUUID();
    playerIds.push(playerId);
    const joined = await emitAndWait(
      player,
      "room:join",
      { roomCode, playerName: `Người chơi ${index}`, playerId },
      "room:joined",
    );
    assert.equal(joined.room.playerCount, index);
  }

  const assigning = await emitAndWait(host, "room:start", {}, "room:updated", (state) => state.room.status === "assigning");
  assert.equal(assigning.room.playerCount, 6);

  const catalog = await emitAndWait(host, "roles:catalog", {}, "roles:catalog", (result) => result.roles.length === 35);
  assert.match(catalog.roles.find((role) => role.id === "witch").moderatorScript, /bình thuốc cứu/i);
  const firstRequestId = crypto.randomUUID();
  const firstGenerated = await emitAndWait(host, "roles:generate", { balanceMode: "balanced", requestId: firstRequestId }, "roles:host-view", (state) => state.requestId === firstRequestId);
  const secondRequestId = crypto.randomUUID();
  const secondGenerated = await emitAndWait(host, "roles:generate", { balanceMode: "balanced", requestId: secondRequestId }, "roles:host-view", (state) => state.requestId === secondRequestId);
  assert.equal(secondGenerated.setup.balance.withinTarget, true);
  assert.notEqual(firstGenerated.setup.lastGeneratedSignature, secondGenerated.setup.lastGeneratedSignature);

  const dealt = await emitAndWait(host, "roles:assign-random", {}, "roles:host-view", (state) => state.assignments.length === 6);
  assert.equal(new Set(dealt.assignments.map((assignment) => assignment.playerId)).size, 6);

  await emitAndWait(
    host,
    "roles:configure",
    { balanceMode: "balanced", selections: [{ roleId: "werewolf", quantity: 2 }, { roleId: "villager", quantity: 4 }] },
    "roles:host-view",
    (state) => state.setup.totalSlots === 6 && state.assignments.length === 0,
  );
  await emitAndWait(
    host,
    "roles:assign-manual",
    { assignments: playerIds.map((playerId, index) => ({ playerId, roleId: index < 2 ? "werewolf" : "villager" })) },
    "roles:host-view",
    (state) => state.assignments.length === 6,
  );

  const playerRoleWait = waitFor(playerClients[0], "player:state", (state) => Boolean(state.role));
  const playing = await emitAndWait(host, "roles:finalize", {}, "room:updated", (state) => state.room.status === "playing");
  const playerState = await playerRoleWait;
  assert.equal(playing.room.gamePhase, "night");
  assert.ok(playerState.role.name);

  const firstPlayerId = playerIds[2];
  await emitAndWait(host, "game:mark-death", { playerId: firstPlayerId, markDead: true }, "room:updated", (state) => state.room.players.find((player) => player.id === firstPlayerId)?.pendingDeath);
  const day = await emitAndWait(host, "game:begin-day", {}, "room:updated", (state) => state.room.gamePhase === "day");
  assert.equal(day.room.players.find((player) => player.id === firstPlayerId)?.isAlive, false);

  const daytimePlayerId = playerIds[3];
  const ended = await emitAndWait(
    host,
    "game:mark-death",
    { playerId: daytimePlayerId, markDead: true },
    "room:updated",
    (state) => state.room.status === "ended",
  );
  assert.equal(ended.room.players.find((player) => player.id === daytimePlayerId)?.isAlive, false);
  assert.equal(ended.room.winner, "werewolf");
  assert.match(ended.room.endReason, /bằng hoặc nhiều hơn/i);

  assert.ok(emptyRoom.room.code);
});
