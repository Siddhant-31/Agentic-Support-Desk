import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { pool } from "./pool";

// A deliberately minimal migration runner: no migration-tracking table,
// no rollback support. Every .sql file in migrations/ is written to be
// safely re-runnable (CREATE TABLE IF NOT EXISTS, etc), so running this
// twice is harmless. For a larger project, swap this for a real
// migration tool (drizzle-kit, node-pg-migrate, Flyway, etc) - but for a
// small, mostly-additive schema like this one, that's more tooling than
// the problem needs yet.

async function main() {
  dotenv.config();

  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Add it to server/.env before running migrations.",
    );
    process.exit(1);
  }

  const dir = path.join(__dirname, "..", "..", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // filenames are numbered (0001_, 0002_, ...) so this is chronological

  console.log(`Found ${files.length} migration file(s) in ${dir}`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf-8");
    console.log(`Running ${file}...`);
    await pool.query(sql);
    console.log(`  done.`);
  }

  console.log("All migrations applied.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
