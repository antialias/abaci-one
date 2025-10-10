"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.abacusSettings = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const users_1 = require("./users");
/**
 * Abacus display settings table - UI preferences per user
 *
 * One-to-one with users table. Stores abacus display configuration.
 * Deleted when user is deleted (cascade).
 */
exports.abacusSettings = (0, sqlite_core_1.sqliteTable)('abacus_settings', {
    /** Primary key and foreign key to users table */
    userId: (0, sqlite_core_1.text)('user_id')
        .primaryKey()
        .references(() => users_1.users.id, { onDelete: 'cascade' }),
    /** Color scheme for beads */
    colorScheme: (0, sqlite_core_1.text)('color_scheme', {
        enum: ['monochrome', 'place-value', 'heaven-earth', 'alternating'],
    })
        .notNull()
        .default('place-value'),
    /** Bead shape */
    beadShape: (0, sqlite_core_1.text)('bead_shape', {
        enum: ['diamond', 'circle', 'square'],
    })
        .notNull()
        .default('diamond'),
    /** Color palette */
    colorPalette: (0, sqlite_core_1.text)('color_palette', {
        enum: ['default', 'colorblind', 'mnemonic', 'grayscale', 'nature'],
    })
        .notNull()
        .default('default'),
    /** Hide inactive beads */
    hideInactiveBeads: (0, sqlite_core_1.integer)('hide_inactive_beads', { mode: 'boolean' }).notNull().default(false),
    /** Color numerals based on place value */
    coloredNumerals: (0, sqlite_core_1.integer)('colored_numerals', { mode: 'boolean' }).notNull().default(false),
    /** Scale factor for abacus size */
    scaleFactor: (0, sqlite_core_1.real)('scale_factor').notNull().default(1.0),
    /** Show numbers below abacus */
    showNumbers: (0, sqlite_core_1.integer)('show_numbers', { mode: 'boolean' }).notNull().default(true),
    /** Enable animations */
    animated: (0, sqlite_core_1.integer)('animated', { mode: 'boolean' }).notNull().default(true),
    /** Enable interaction */
    interactive: (0, sqlite_core_1.integer)('interactive', { mode: 'boolean' }).notNull().default(false),
    /** Enable gesture controls */
    gestures: (0, sqlite_core_1.integer)('gestures', { mode: 'boolean' }).notNull().default(false),
    /** Enable sound effects */
    soundEnabled: (0, sqlite_core_1.integer)('sound_enabled', { mode: 'boolean' }).notNull().default(true),
    /** Sound volume (0.0 - 1.0) */
    soundVolume: (0, sqlite_core_1.real)('sound_volume').notNull().default(0.8),
});
