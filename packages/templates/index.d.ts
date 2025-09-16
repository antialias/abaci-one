/**
 * @fileoverview TypeScript definitions for Soroban Templates
 *
 * Provides type-safe access to Typst templates for soroban abacus
 * flashcard generation in TypeScript projects.
 *
 * @author Soroban Flashcards Team
 * @version 0.1.0
 */

/**
 * Absolute path to the main flashcards Typst template.
 *
 * This template provides the complete `draw-soroban()` function with full
 * feature support including:
 * - Multiple bead shapes (diamond, circle, square)
 * - Color schemes (monochrome, place-value, heaven-earth, alternating)
 * - Interactive bead annotations
 * - Customizable dimensions and styling
 *
 * @example
 * ```typescript
 * import { FLASHCARDS_TEMPLATE } from '@soroban/templates';
 * const template = fs.readFileSync(FLASHCARDS_TEMPLATE, 'utf-8');
 * ```
 */
export const FLASHCARDS_TEMPLATE: string;

/**
 * Absolute path to the single-card Typst template.
 *
 * This template is optimized for generating individual flashcards and
 * provides the `generate-single-card()` function with:
 * - Front/back side generation
 * - PNG export optimization
 * - Transparent background support
 * - Custom dimensions and fonts
 *
 * @example
 * ```typescript
 * import { SINGLE_CARD_TEMPLATE } from '@soroban/templates';
 * const template = fs.readFileSync(SINGLE_CARD_TEMPLATE, 'utf-8');
 * ```
 */
export const SINGLE_CARD_TEMPLATE: string;

/**
 * Dynamic template path resolver that works across different execution contexts.
 *
 * This function handles path resolution in various environments:
 * - Monorepo root execution
 * - Web app execution (apps/web)
 * - Webpack bundling contexts
 *
 * The dynamic resolution prevents webpack from statically analyzing and
 * mangling the paths during build time.
 *
 * @param filename - Template filename (e.g., 'flashcards.typ')
 * @returns Absolute path to the template file
 *
 * @example
 * ```typescript
 * import { getTemplatePath } from '@soroban/templates';
 * const templatePath = getTemplatePath('flashcards.typ');
 * const content = fs.readFileSync(templatePath, 'utf-8');
 * ```
 */
export function getTemplatePath(filename: string): string;