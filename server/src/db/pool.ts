import { Pool } from "pg";

// A single shared connection pool for the whole app. Import `pool` from
// here anywhere you need to run a query - never create a second Pool.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  // Errors on idle clients (e.g. connection dropped) shouldn't crash the
  // whole process - just log them.
  console.error("Unexpected Postgres pool error:", err);
});
