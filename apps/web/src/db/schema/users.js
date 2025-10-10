"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.users = void 0;
const cuid2_1 = require("@paralleldrive/cuid2");
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
/**
 * Users table - stores both guest and authenticated users
 *
 * Guest users are created automatically on first visit via middleware.
 * They can upgrade to full accounts later while preserving their data.
 */
exports.users = (0, sqlite_core_1.sqliteTable)('users', {
    id: (0, sqlite_core_1.text)('id')
        .primaryKey()
        .$defaultFn(() => (0, cuid2_1.createId)()),
    /** Stable guest ID from HttpOnly cookie - unique per browser session */
    guestId: (0, sqlite_core_1.text)('guest_id').notNull().unique(),
    /** When this user record was created */
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date()),
    /** When guest upgraded to full account (null for guests) */
    upgradedAt: (0, sqlite_core_1.integer)('upgraded_at', { mode: 'timestamp' }),
    /** Email (only set after upgrade) */
    email: (0, sqlite_core_1.text)('email').unique(),
    /** Display name (only set after upgrade) */
    name: (0, sqlite_core_1.text)('name'),
});
