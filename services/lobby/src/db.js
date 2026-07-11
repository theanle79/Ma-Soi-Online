import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.LOBBY_DATABASE_URL || "postgres://ma_soi:ma_soi@localhost:5433/ma_soi_lobby",
});

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id UUID PRIMARY KEY,
      code VARCHAR(6) NOT NULL UNIQUE,
      host_id UUID NOT NULL,
      host_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'assigning', 'playing', 'closed')),
      player_limit SMALLINT NOT NULL DEFAULT 24 CHECK (player_limit = 24),
      game_day INTEGER NOT NULL DEFAULT 0,
      game_phase TEXT NOT NULL DEFAULT 'lobby' CHECK (game_phase IN ('lobby', 'role_assignment', 'night', 'day', 'closed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS participants (
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      player_id UUID NOT NULL,
      name TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_alive BOOLEAN NOT NULL DEFAULT TRUE,
      pending_death BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (room_id, player_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS participants_unique_name_per_room
      ON participants (room_id, LOWER(name));

    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS winner TEXT;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS end_reason TEXT;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

    ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
    ALTER TABLE rooms ADD CONSTRAINT rooms_status_check
      CHECK (status IN ('waiting', 'assigning', 'playing', 'ended', 'closed'));

    ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_phase_check;
    ALTER TABLE rooms ADD CONSTRAINT rooms_game_phase_check
      CHECK (game_phase IN ('lobby', 'role_assignment', 'night', 'day', 'ended', 'closed'));
  `);
}

export async function inTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await callback(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
