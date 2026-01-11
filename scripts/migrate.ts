import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

const { Pool } = pg;

async function migrate() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log("Running migrations...");

    const migrationPath = join(
      process.cwd(),
      "db/migrations/001_initial_schema.sql"
    );
    const migration = readFileSync(migrationPath, "utf-8");

    await pool.query(migration);

    console.log("Migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
