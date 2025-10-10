"use strict";
/**
 * Game validator registry
 * Maps game names to their validators
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
exports.matchingGameValidator = void 0;
exports.getValidator = getValidator;
const MatchingGameValidator_1 = require("./MatchingGameValidator");
const validators = new Map([
    ['matching', MatchingGameValidator_1.matchingGameValidator],
    // Add other game validators here as they're implemented
]);
function getValidator(gameName) {
    const validator = validators.get(gameName);
    if (!validator) {
        throw new Error(`No validator found for game: ${gameName}`);
    }
    return validator;
}
var MatchingGameValidator_2 = require("./MatchingGameValidator");
Object.defineProperty(exports, "matchingGameValidator", { enumerable: true, get: function () { return MatchingGameValidator_2.matchingGameValidator; } });
__exportStar(require("./types"), exports);
