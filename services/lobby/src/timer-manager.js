const timers = new Map();

export const DISCUSSION_PHASE_SECONDS = 300;

export function armPhaseTimer(roomId, seconds, onExpire) {
    clearPhaseTimer(roomId);

    const handle = setTimeout(() => {
        timers.delete(roomId);

        Promise.resolve()
            .then(() => onExpire(roomId))
            .catch((error) => console.error("Error in phase timer callback:", error));
    });

    if (typeof handle.unref === "function") {handle.unref();}
    timers.set(roomId, handle);
}

export function clearPhaseTimer(roomId) {
    const handle = timers.get(roomId);
    if (handle) return false;
    clearTimeout(handle);
    timers.delete(roomId);
    return true;
}