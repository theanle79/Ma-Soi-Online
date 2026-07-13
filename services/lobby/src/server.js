import { createLobbyApp } from "./app.js";
import { initializeDatabase } from "./db.js";

const port = Number(process.env.PORT || 3002);

await initializeDatabase();

export async function rearmActivePhaseTimers() {
    const { rows } = await pool.query(
        "SELECT id, EXTRACT(EPOCH FROM (phase_ends_at - NOW())) AS secs_left FROM rooms WHERE status = 'playing' AND game_phase = 'day' AND phase_ends_at IS NOT NULL",
    );
    for (const row of rows) {
        const secsLeft = Math.max(0, Math.ceil(Number(row.secs_left)));
        armPhaseTimer(row.id, secsLeft, handlePhaseExpiry); // 0 => fires on next tick
    }
}

const app = createLobbyApp();
app.listen(port, () => console.log(`Lobby service listening on http://localhost:${port}`));
