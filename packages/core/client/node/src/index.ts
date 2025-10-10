/**
 * Soroban Flashcard Generator - Node.js Interface
 * Re-export main generator functionality
 */

export * from "./soroban-generator";

// Export bridge generator with different name to avoid conflicts
export {
  SorobanGenerator as SorobanGeneratorBridge,
  FlashcardConfig as BridgeFlashcardConfig,
  FlashcardResult as BridgeFlashcardResult,
} from "./soroban-generator-bridge";

// Default export for convenience
export { SorobanGenerator as default } from "./soroban-generator";
