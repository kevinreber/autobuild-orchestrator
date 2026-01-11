import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { Database } from "~/types/database";

const { Pool } = pg;

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = new Pool({
    connectionString,
    max: 10,
  });

  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool,
    }),
  });
}

// Singleton pattern for the database connection
let db: Kysely<Database> | null = null;

export function getDb(): Kysely<Database> {
  if (!db) {
    db = createDatabase();
  }
  return db;
}

export { type Database };
