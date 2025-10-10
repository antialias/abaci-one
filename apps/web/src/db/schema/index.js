"use strict";
/**
 * Database schema exports
 *
 * This is the single source of truth for the database schema.
 * All tables, relations, and types are exported from here.
 */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./abacus-settings"), exports);
__exportStar(require("./arcade-rooms"), exports);
__exportStar(require("./arcade-sessions"), exports);
__exportStar(require("./players"), exports);
__exportStar(require("./room-members"), exports);
__exportStar(require("./user-stats"), exports);
__exportStar(require("./users"), exports);
