import pg from "pg";
import { ROLE_CATALOG } from "./catalog.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.ROLE_DATABASE_URL || "postgres://ma_soi:ma_soi@localhost:5434/ma_soi_roles",
});

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      team TEXT NOT NULL,
      value INTEGER NOT NULL,
      phase TEXT NOT NULL,
      night_order INTEGER NOT NULL,
      wakes_at_night TEXT NOT NULL,
      recommended BOOLEAN NOT NULL DEFAULT FALSE,
      ability TEXT NOT NULL,
      max_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_role_setups (
      room_id UUID PRIMARY KEY,
      balance_mode TEXT NOT NULL DEFAULT 'balanced',
      last_generated_signature TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS selected_roles (
      room_id UUID NOT NULL REFERENCES room_role_setups(room_id) ON DELETE CASCADE,
      role_id TEXT NOT NULL REFERENCES roles(id),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      PRIMARY KEY (room_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      room_id UUID NOT NULL REFERENCES room_role_setups(room_id) ON DELETE CASCADE,
      player_id UUID NOT NULL,
      role_id TEXT NOT NULL REFERENCES roles(id),
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, player_id)
    );
  `);

  for (const role of ROLE_CATALOG) {
    await pool.query(
      `INSERT INTO roles (id, name, team, value, phase, night_order, wakes_at_night, recommended, ability, max_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, team = EXCLUDED.team, value = EXCLUDED.value, phase = EXCLUDED.phase,
         night_order = EXCLUDED.night_order, wakes_at_night = EXCLUDED.wakes_at_night,
         recommended = EXCLUDED.recommended, ability = EXCLUDED.ability, max_count = EXCLUDED.max_count`,
      [role.id, role.name, role.team, role.value, role.phase, role.nightOrder, role.wakesAtNight, Boolean(role.recommended), role.ability, role.max],
    );
  }
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
