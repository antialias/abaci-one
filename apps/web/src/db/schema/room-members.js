"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomMembers = void 0;
const cuid2_1 = require("@paralleldrive/cuid2");
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const arcade_rooms_1 = require("./arcade-rooms");
exports.roomMembers = (0, sqlite_core_1.sqliteTable)('room_members', {
    id: (0, sqlite_core_1.text)('id')
        .primaryKey()
        .$defaultFn(() => (0, cuid2_1.createId)()),
    roomId: (0, sqlite_core_1.text)('room_id')
        .notNull()
        .references(() => arcade_rooms_1.arcadeRooms.id, { onDelete: 'cascade' }),
    userId: (0, sqlite_core_1.text)('user_id').notNull(), // User/guest ID - UNIQUE: one room per user (enforced by index below)
    displayName: (0, sqlite_core_1.text)('display_name', { length: 50 }).notNull(),
    isCreator: (0, sqlite_core_1.integer)('is_creator', { mode: 'boolean' }).notNull().default(false),
    joinedAt: (0, sqlite_core_1.integer)('joined_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date()),
    lastSeen: (0, sqlite_core_1.integer)('last_seen', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date()),
    isOnline: (0, sqlite_core_1.integer)('is_online', { mode: 'boolean' }).notNull().default(true),
}, (table) => ({
    // Explicit unique index for clarity and database-level enforcement
    userIdIdx: (0, sqlite_core_1.uniqueIndex)('idx_room_members_user_id_unique').on(table.userId),
}));
