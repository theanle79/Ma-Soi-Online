import crypto from "node:crypto";

const rooms = new Map();

export function createRoom({ name = "New Room", hostName = "Host" } = {}) {
  const id = crypto.randomUUID();
  const room = {
    id,
    name,
    hostName,
    players: [],
    status: "waiting",
    createdAt: new Date().toISOString()
  };

  rooms.set(id, room);
  return room;
}

export function listRooms() {
  return Array.from(rooms.values());
}

export function getRoom(roomId) {
  return rooms.get(roomId) ?? null;
}

export function addPlayerToRoom(roomId, player) {
  const room = getRoom(roomId);

  if (!room) {
    return null;
  }

  const existingPlayer = room.players.find((item) => item.id === player.id);

  if (!existingPlayer) {
    room.players.push({
      id: player.id,
      name: player.name || "Player"
    });
  }

  return room;
}

export function removePlayerFromRoom(roomId, playerId) {
  const room = getRoom(roomId);

  if (!room) {
    return null;
  }

  room.players = room.players.filter((player) => player.id !== playerId);
  return room;
}
