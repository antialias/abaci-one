import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./index";

/**
 * Migration runner
 *
 * Runs all pending migrations in the drizzle/ folder.
 * Safe to run multiple times (migrations are idempotent).
 *
 * Usage: pnpm db:migrate
 */

try {
  console.log("🔄 Running migrations...");

  migrate(db, { migrationsFolder: "./drizzle" });

  console.log("✅ Migrations complete");
  process.exit(0);
} catch (error) {
  console.error("❌ Migration failed:", error);
  process.exit(1);
}
