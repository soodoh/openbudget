import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

const envVars = process.env as Record<string, string | undefined>;
const sqlite = new Database(envVars.DATABASE_URL ?? "data/sqlite.db");
const sqliteTyped = sqlite as unknown as { exec(sql: string): void };
sqliteTyped.exec("PRAGMA journal_mode = WAL;");
sqliteTyped.exec("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });

// Auto-migrate on startup (idempotent — no-op if already up-to-date)
migrate(db, { migrationsFolder: "./drizzle" });
