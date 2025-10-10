"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const migrator_1 = require("drizzle-orm/better-sqlite3/migrator");
const index_1 = require("./index");
/**
 * Migration runner
 *
 * Runs all pending migrations in the drizzle/ folder.
 * Safe to run multiple times (migrations are idempotent).
 *
 * Usage: pnpm db:migrate
 */
try {
    console.log('🔄 Running migrations...');
    (0, migrator_1.migrate)(index_1.db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations complete');
    process.exit(0);
}
catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
}
