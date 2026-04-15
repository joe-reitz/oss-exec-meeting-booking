import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("DATABASE_URL not set, skipping migration");
  process.exit(0);
}

const sql = neon(databaseUrl);
const migrationSql = readFileSync(new URL("../drizzle/0000_melted_ben_urich.sql", import.meta.url), "utf-8");

const statements = migrationSql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  try {
    await sql.query(statement);
  } catch (err) {
    // 42710 = type already exists, 42P07 = table already exists
    if (err.code === "42710" || err.code === "42P07") {
      continue;
    }
    throw err;
  }
}

console.log("Migration complete");
