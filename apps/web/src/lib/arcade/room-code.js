"use strict";
/**
 * Room code generation utility
 * Generates short, memorable codes for joining rooms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRoomCode = generateRoomCode;
exports.isValidRoomCode = isValidRoomCode;
exports.normalizeRoomCode = normalizeRoomCode;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars: 0,O,1,I
const CODE_LENGTH = 6;
/**
 * Generate a random 6-character room code
 * Format: ABC123 (uppercase letters + numbers, no ambiguous chars)
 */
function generateRoomCode() {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        const randomIndex = Math.floor(Math.random() * CHARS.length);
        code += CHARS[randomIndex];
    }
    return code;
}
/**
 * Validate a room code format
 */
function isValidRoomCode(code) {
    if (code.length !== CODE_LENGTH)
        return false;
    return code.split('').every((char) => CHARS.includes(char));
}
/**
 * Normalize a room code (uppercase, remove spaces/dashes)
 */
function normalizeRoomCode(code) {
    return code.toUpperCase().replace(/[\s-]/g, '');
}
