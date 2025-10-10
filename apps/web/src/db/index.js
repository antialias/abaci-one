"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schema = exports.db = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const better_sqlite3_2 = require("drizzle-orm/better-sqlite3");
const schema = __importStar(require("./schema"));
exports.schema = schema;
/**
 * Database connection and client
 *
 * Creates a singleton SQLite connection with Drizzle ORM.
 * Enables foreign key constraints (required for cascading deletes).
 *
 * IMPORTANT: The database connection is lazy-loaded to avoid accessing
 * the database at module import time, which would cause build failures
 * when the database doesn't exist (e.g., in CI/CD environments).
 */
const databaseUrl = process.env.DATABASE_URL || './data/sqlite.db';
let _sqlite = null;
let _db = null;
/**
 * Get the database connection (lazy-loaded singleton)
 * Only creates the connection when first accessed at runtime
 */
function getDb() {
    if (!_db) {
        _sqlite = new better_sqlite3_1.default(databaseUrl);
        // Enable foreign keys (SQLite requires explicit enable)
        _sqlite.pragma('foreign_keys = ON');
        // Enable WAL mode for better concurrency
        _sqlite.pragma('journal_mode = WAL');
        _db = (0, better_sqlite3_2.drizzle)(_sqlite, { schema });
    }
    return _db;
}
/**
 * Database client instance
 * Uses a Proxy to lazy-load the connection on first access
 */
exports.db = new Proxy({}, {
    get(_target, prop) {
        return getDb()[prop];
    },
});
