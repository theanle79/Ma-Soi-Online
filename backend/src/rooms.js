import crypto from "node:crypto";
import { getRoleConfig, shuffleRoles } from "./roles.js";

const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createRoom({ hostName = "Host", playerCount = 8, roleConfig } = {}) {
  const id = crypto.randomUUID();
  const code = generateRoomCode();
  const config = roleConfig || getRoleConfig(playerCount);
  const room = {
    id,
    code,
    hostName,
    hostId: null,
    maxPlayers: playerCount,
    roleConfig: config,
    players: [],
    assignments: null,
    status: "waiting",
    createdAt: new Date().toISOString(),
  };
  rooms.set(id, room);
  return room;
}

export function listRooms() {
  return Array.from(rooms.values()).map(sanitizeRoom);
}

export function getRoom(roomId) {
  return rooms.get(roomId) ?? null;
}

export function getRoomByCode(code) {
  for (const room of rooms.values()) {
    if (room.code === code) return room;
  }
  return null;
}

export function addPlayerToRoom(roomId, player) {
  const room = getRoom(roomId);
  if (!room) return null;
  if (room.status !== "waiting") return null;

  const existing = room.players.find((p) => p.id === player.id);
  if (!existing) {
    if (room.players.length >= room.maxPlayers) return null;
    const duplicateName = room.players.some((p) => p.name.toLowerCase() === (player.name || "").toLowerCase());
    if (duplicateName) return { error: "duplicate_name" };

    room.players.push({
      id: player.id,
      name: player.name || "Player",
      joinedAt: new Date().toISOString(),
    });
  }
  return sanitizeRoomForPlayers(room);
}

export function removePlayerFromRoom(roomId, playerId) {
  const room = getRoom(roomId);
  if (!room) return null;
  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.hostId === playerId) {
    if (room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.hostName = room.players[0].name;
    }
  }
  return sanitizeRoomForPlayers(room);
}

export function dealRoles(roomId) {
  const room = getRoom(roomId);
  if (!room) return null;
  if (room.players.length !== room.maxPlayers) return { error: "not_enough_players" };

  const shuffled = shuffleRoles(room.roleConfig);
  const assignments = {};
  room.players.forEach((player, index) => {
    assignments[player.id] = shuffled[index];
  });
  room.assignments = assignments;
  room.status = "dealt";
  return sanitizeRoom(room);
}

export function resetRoom(roomId) {
  const room = getRoom(roomId);
  if (!room) return null;
  room.assignments = null;
  room.status = "waiting";
  return sanitizeRoom(room);
}

export function getPlayerRole(roomId, playerId) {
  const room = getRoom(roomId);
  if (!room || !room.assignments) return null;
  return room.assignments[playerId] || null;
}

function sanitizeRoom(room) {
  if (!room) return null;
  return {
    id: room.id,
    code: room.code,
    hostName: room.hostName,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    roleConfig: room.roleConfig,
    players: room.players,
    playerCount: room.players.length,
    status: room.status,
    hasAssignments: !!room.assignments,
    createdAt: room.createdAt,
  };
}

function sanitizeRoomForPlayers(room) {
  const r = sanitizeRoom(room);
  return r;
}
