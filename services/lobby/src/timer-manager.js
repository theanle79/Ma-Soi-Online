const timers = new Map();
const disconnectTimers = new Map();
export const DISCONNECT_GRACE_PERIOD_SECONDS = 30;

export const DISCUSSION_PHASE_SECONDS = 300;

export function armPhaseTimer(roomId, seconds, onExpire) {
    clearPhaseTimer(roomId);

    const handle = setTimeout(() => {
        timers.delete(roomId);

        Promise.resolve()
            .then(() => onExpire(roomId))
            .catch((error) => console.error("Error in phase timer callback:", error));
    }, seconds * 1000);

    if (typeof handle.unref === "function") {handle.unref();}
    timers.set(roomId, handle);
}

export function clearPhaseTimer(roomId) {
    const handle = timers.get(roomId);
    if (!handle) return false;
    clearTimeout(handle);
    timers.delete(roomId);
    return true;
}

export function armDisconnectionTimer(playerId, roomId, onExpire) {
    clearDisconnectionTimer(playerId);

    const handle = setTimeout(() => {
        disconnectTimers.delete(playerId);

        Promise.resolve()
            .then(() => onExpire(playerId, roomId))
            .catch((error) => console.error(`Error in disconnect timer callback for player ${playerId}:`, error));
    }, DISCONNECT_GRACE_PERIOD_SECONDS * 1000);

    if (typeof handle.unref === "function") {
        handle.unref();
    }

    disconnectTimers.set(playerId, handle);
}

export function clearDisconnectionTimer(playerId) {
    const handle = disconnectTimers.get(playerId);

    if (!handle) return false;

    clearTimeout(handle);
    disconnectTimers.delete(playerId);

    return true;
}