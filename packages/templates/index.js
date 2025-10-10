/**
 * @fileoverview Soroban Templates - Node.js/TypeScript Interface
 *
 * Provides clean, webpack-safe access to Typst templates for soroban abacus
 * flashcard generation. Handles path resolution across different execution
 * contexts (monorepo root, web app, etc.).
 *
 * @author Soroban Flashcards Team
 * @version 0.1.0
 */

const path = require("path");

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
 * @param {string} filename - Template filename (e.g., 'flashcards.typ')
 * @returns {string} Absolute path to the template file
 *
 * @example
 * ```javascript
 * const templatePath = getTemplatePath('flashcards.typ');
 * const content = fs.readFileSync(templatePath, 'utf-8');
 * ```
 */
function getTemplatePath(filename) {
  // Resolve relative to the correct templates directory
  const cwd = process.cwd();
  let templatesDir;

  if (cwd.includes("apps/web")) {
    // Running from web app, go up two levels
    templatesDir = path.resolve(
      cwd,
      "..",
      "..",
      "packages",
      "templates",
      filename,
    );
  } else if (
    cwd.endsWith("packages/templates") ||
    cwd.includes("packages/templates")
  ) {
    // Running from templates directory itself
    templatesDir = path.resolve(cwd, filename);
  } else {
    // Running from monorepo root or other location
    templatesDir = path.resolve(cwd, "packages", "templates", filename);
  }

  // Verify the file exists
  const fs = require("fs");
  if (!fs.existsSync(templatesDir)) {
    const templatesDirectoryPath = path.dirname(templatesDir);
    throw new Error(
      `Template file '${filename}' not found in ${templatesDirectoryPath}`,
    );
  }

  return templatesDir;
}

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
 * @type {string}
 * @example
 * ```javascript
 * import { FLASHCARDS_TEMPLATE } from '@soroban/templates';
 * const template = fs.readFileSync(FLASHCARDS_TEMPLATE, 'utf-8');
 * ```
 */
const FLASHCARDS_TEMPLATE = getTemplatePath("flashcards.typ");

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
 * @type {string}
 * @example
 * ```javascript
 * import { SINGLE_CARD_TEMPLATE } from '@soroban/templates';
 * const template = fs.readFileSync(SINGLE_CARD_TEMPLATE, 'utf-8');
 * ```
 */
const SINGLE_CARD_TEMPLATE = getTemplatePath("single-card.typ");

// Import SVG post-processor
const svgProcessor = require("./svg-crop-processor");

/**
 * Template exports for Node.js/TypeScript environments.
 *
 * All exports provide absolute paths that work across different execution
 * contexts and are safe for webpack bundling.
 *
 * @module @soroban/templates
 */
module.exports = {
  /** @see {FLASHCARDS_TEMPLATE} */
  FLASHCARDS_TEMPLATE,
  /** @see {SINGLE_CARD_TEMPLATE} */
  SINGLE_CARD_TEMPLATE,
  /** @see {getTemplatePath} */
  getTemplatePath,

  // SVG Post-Processing
  /** @see {svg-crop-processor} */
  processSVG: svgProcessor.processSVG,
  /** @see {svg-crop-processor} */
  processSVGFile: svgProcessor.processSVGFile,
  /** @see {svg-crop-processor} */
  extractCropMarks: svgProcessor.extractCropMarks,
  /** @see {svg-crop-processor} */
  extractBeadAnnotations: svgProcessor.extractBeadAnnotations,
  /** @see {svg-crop-processor} */
  SVGCropError: svgProcessor.SVGCropError,
};
