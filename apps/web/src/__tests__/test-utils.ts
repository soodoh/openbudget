import { Database } from "bun:sqlite";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "../db/schema";

export function createTestDb(): BunSQLiteDatabase<typeof schema> {
	const sqlite = new Database(":memory:");
	const sqliteTyped = sqlite as unknown as { exec(sql: string): void };
	sqliteTyped.exec("PRAGMA foreign_keys = ON;");
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: "./drizzle" });
	return db;
}
