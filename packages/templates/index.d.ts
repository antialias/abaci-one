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

// SVG Post-Processing Types

/**
 * Crop mark coordinate information.
 */
export interface CropMark {
  /** X coordinate of the crop mark */
  x: number;
  /** Y coordinate of the crop mark */
  y: number;
}

/**
 * Crop processing result with optimization data.
 */
export interface CropResult {
  /** Optimized viewBox string "x y width height" */
  viewBox: string;
  /** Cropped width */
  width: number;
  /** Cropped height */
  height: number;
  /** Left boundary */
  minX: number;
  /** Top boundary */
  minY: number;
  /** Right boundary */
  maxX: number;
  /** Bottom boundary */
  maxY: number;
  /** Detected crop marks by type */
  cropMarks: Record<string, CropMark>;
  /** File size reduction percentage (0-100) */
  reduction: number;
}

/**
 * Bead annotation data extracted from links.
 */
export interface BeadData {
  /** Bead identifier */
  id: string;
  /** Bead type (heaven/earth) */
  type?: string;
  /** Position (heaven/earth) */
  position?: string;
  /** Column/place value */
  column?: number;
  /** Place value */
  placeValue?: number;
  /** Earth bead position */
  earthPosition?: number;
  /** Active state */
  active?: boolean;
  /** State (active/inactive) */
  state?: string;
}

/**
 * Complete SVG processing result.
 */
export interface ProcessResult {
  /** Optimized SVG content with updated viewBox */
  svg: string;
  /** Detailed crop information */
  cropData: CropResult;
  /** Bead annotation data (if extracted) */
  beadData?: {
    /** Number of beads found */
    count: number;
    /** Extracted bead data */
    beads: BeadData[];
    /** Original link elements */
    links: any[];
  } | null;
  /** Whether processing succeeded */
  success: boolean;
  /** Non-fatal issues encountered */
  warnings: string[];
}

/**
 * SVG processing options.
 */
export interface ProcessOptions {
  /** Remove crop mark elements from output */
  removeCropMarks?: boolean;
  /** Update width/height to match viewBox */
  preserveAspectRatio?: boolean;
  /** Convert bead links to data attributes */
  extractBeadAnnotations?: boolean;
}

/**
 * Custom error class for SVG crop processing failures.
 */
export class SVGCropError extends Error {
  /** Error code for programmatic handling */
  code: string;
  /** Additional error context */
  details: Record<string, any>;

  constructor(message: string, code: string, details?: Record<string, any>);
}

/**
 * Process SVG content by extracting crop marks and optimizing viewBox.
 * Returns both the optimized SVG and detailed crop information.
 *
 * @param svgContent - Raw SVG content as string
 * @param options - Processing options
 * @returns Complete processing results
 * @throws SVGCropError When processing fails
 *
 * @example
 * ```typescript
 * import { processSVG } from '@soroban/templates';
 *
 * const result = processSVG(svgContent, {
 *   extractBeadAnnotations: true // Convert bead links to data attributes
 * });
 * console.log(`Reduced size by ${result.cropData.reduction}%`);
 * console.log(`Found ${result.beadData?.count} interactive beads`);
 *
 * // Save optimized SVG
 * fs.writeFileSync('optimized.svg', result.svg);
 * ```
 */
export function processSVG(
  svgContent: string,
  options?: ProcessOptions,
): ProcessResult;

/**
 * Browser-compatible file processing function.
 * Processes File objects or Blob objects directly in the browser.
 *
 * @param file - SVG file to process
 * @param options - Processing options
 * @returns Processing results
 * @throws SVGCropError When processing fails
 *
 * @example
 * ```typescript
 * // In browser with file input
 * const fileInput = document.getElementById('svg-upload') as HTMLInputElement;
 * fileInput.addEventListener('change', async (e) => {
 *   const file = e.target.files?.[0];
 *   if (file) {
 *     try {
 *       const result = await processSVGFile(file);
 *       console.log(`Optimized! Reduction: ${result.cropData.reduction}%`);
 *     } catch (error) {
 *       console.error('Processing failed:', error.message);
 *     }
 *   }
 * });
 * ```
 */
export function processSVGFile(
  file: File | Blob,
  options?: ProcessOptions,
): Promise<ProcessResult>;

/**
 * Extract crop marks from SVG content and calculate optimal viewBox.
 *
 * @param svgContent - Raw SVG content as string
 * @returns Crop analysis results
 * @throws SVGCropError When crop marks cannot be found or processed
 */
export function extractCropMarks(svgContent: string): CropResult;

/**
 * Extract bead annotation data from link elements and convert to data attributes.
 * Processes SVG links with bead:// protocol and converts them to data attributes.
 *
 * @param svgContent - Raw SVG content as string
 * @returns Extraction results with processed SVG and bead data
 */
export function extractBeadAnnotations(svgContent: string): {
  /** SVG with bead links converted to data attributes */
  processedSVG: string;
  /** Found bead link data */
  beadLinks: any[];
  /** Processing warnings */
  warnings: string[];
  /** Number of beads processed */
  count: number;
};
