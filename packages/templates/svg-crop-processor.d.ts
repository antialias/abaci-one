/**
 * @fileoverview TypeScript definitions for SVG Crop Processor
 *
 * Provides complete type safety for the standalone SVG crop mark extraction
 * and viewBox optimization functionality.
 *
 * @author Soroban Flashcards Team
 * @version 1.0.0
 */

/**
 * Represents a single crop mark position in 2D space.
 */
export interface CropMark {
  /** X coordinate of the crop mark */
  x: number;
  /** Y coordinate of the crop mark */
  y: number;
}

/**
 * Complete crop analysis results including boundaries and optimization data.
 */
export interface CropResult {
  /** Optimized viewBox string in format "x y width height" */
  viewBox: string;
  /** Cropped width in points */
  width: number;
  /** Cropped height in points */
  height: number;
  /** Left boundary coordinate */
  minX: number;
  /** Top boundary coordinate */
  minY: number;
  /** Right boundary coordinate */
  maxX: number;
  /** Bottom boundary coordinate */
  maxY: number;
  /** Detected crop marks organized by semantic position */
  cropMarks: {
    left: CropMark;
    right: CropMark;
    top: CropMark;
    bottom: CropMark;
  };
  /** File size reduction percentage (0-100) */
  reduction: number;
}

/**
 * Complete SVG processing results including optimized content and metadata.
 */
export interface ProcessResult {
  /** Optimized SVG content with updated viewBox and dimensions */
  svg: string;
  /** Detailed crop analysis information */
  cropData: CropResult;
  /** Bead annotation extraction results (null if disabled) */
  beadData: BeadAnnotationResult | null;
  /** Whether processing completed successfully */
  success: boolean;
  /** Array of non-fatal warnings encountered during processing */
  warnings: string[];
}

/**
 * Represents parsed bead annotation data extracted from bead IDs.
 */
export interface BeadData {
  /** Original bead ID string */
  id: string;
  /** Bead type (heaven or earth) */
  type?: 'heaven' | 'earth';
  /** Bead position (same as type for compatibility) */
  position?: 'heaven' | 'earth';
  /** Column number (place value) */
  column?: number;
  /** Place value (same as column) */
  placeValue?: number;
  /** Earth bead position (1-4 for earth beads) */
  earthPosition?: number;
  /** Whether the bead is active/selected */
  active?: boolean;
  /** Bead state (active or inactive) */
  state?: 'active' | 'inactive';
}

/**
 * Results from bead annotation extraction.
 */
export interface BeadAnnotationResult {
  /** Number of bead links found and processed */
  count: number;
  /** Parsed bead data for each found bead */
  beads: BeadData[];
  /** Raw link information for debugging */
  links: Array<{
    id: string;
    data: BeadData;
    originalElement: string;
    innerContent: string;
  }>;
}

/**
 * Options for customizing SVG processing behavior.
 */
export interface ProcessOptions {
  /**
   * Remove crop mark elements from the output SVG.
   * Note: This makes debugging more difficult.
   * @default false
   */
  removeCropMarks?: boolean;

  /**
   * Update SVG width/height attributes to match the viewBox aspect ratio.
   * Recommended for proper display scaling.
   * @default true
   */
  preserveAspectRatio?: boolean;

  /**
   * Extract bead annotation links and convert them to data attributes.
   * Processes bead:// protocol links and converts them to HTML5 data attributes.
   * @default true
   */
  extractBeadAnnotations?: boolean;
}

/**
 * Error codes for programmatic error handling.
 */
export type SVGCropErrorCode =
  | 'INVALID_INPUT'
  | 'EMPTY_INPUT'
  | 'INVALID_SVG_FORMAT'
  | 'NO_CROP_MARKS'
  | 'INSUFFICIENT_CROP_MARKS'
  | 'INVALID_DIMENSIONS'
  | 'PROCESSING_ERROR'
  | 'INVALID_FILE_TYPE'
  | 'FILE_READ_ERROR';

/**
 * Specialized error class for SVG crop processing failures.
 * Provides structured error information for better debugging.
 */
export class SVGCropError extends Error {
  /** Human-readable error message */
  readonly message: string;

  /** Programmatic error code for handling specific error types */
  readonly code: SVGCropErrorCode;

  /** Additional context and debugging information */
  readonly details: Record<string, unknown>;

  /**
   * Creates a new SVG crop processing error.
   *
   * @param message - Human-readable error description
   * @param code - Programmatic error code
   * @param details - Additional error context
   */
  constructor(message: string, code: SVGCropErrorCode, details?: Record<string, unknown>);
}

/**
 * Extract crop marks from SVG content and calculate optimal viewBox dimensions.
 *
 * This function analyzes SVG content to find crop mark elements (tiny red rectangles)
 * and calculates the minimal viewBox that contains all content within the crop boundaries.
 *
 * @param svgContent - Raw SVG content as string
 * @returns Detailed crop analysis results
 * @throws {SVGCropError} When crop marks cannot be found or processed
 *
 * @example
 * ```typescript
 * import { extractCropMarks } from '@soroban/templates/svg-crop-processor';
 *
 * const cropData = extractCropMarks(svgContent);
 * console.log(`Crop boundaries: ${cropData.minX}, ${cropData.minY} to ${cropData.maxX}, ${cropData.maxY}`);
 * console.log(`Optimized dimensions: ${cropData.width} × ${cropData.height}`);
 * ```
 */
export function extractCropMarks(svgContent: string): CropResult;

/**
 * Process SVG content by extracting crop marks and optimizing viewBox.
 *
 * This is the main processing function that combines crop mark extraction with
 * SVG optimization. It returns both the optimized SVG content and detailed
 * analysis information.
 *
 * @param svgContent - Raw SVG content as string
 * @param options - Processing customization options
 * @returns Complete processing results including optimized SVG
 * @throws {SVGCropError} When processing fails
 *
 * @example
 * ```typescript
 * import { processSVG } from '@soroban/templates/svg-crop-processor';
 *
 * try {
 *   const result = processSVG(svgContent, {
 *     preserveAspectRatio: true,
 *     removeCropMarks: false
 *   });
 *
 *   console.log(`Processing successful! Reduced size by ${result.cropData.reduction}%`);
 *   console.log(`New dimensions: ${result.cropData.width} × ${result.cropData.height}`);
 *
 *   if (result.warnings.length > 0) {
 *     console.warn('Warnings:', result.warnings);
 *   }
 *
 *   // Use the optimized SVG
 *   fs.writeFileSync('optimized.svg', result.svg);
 *
 * } catch (error) {
 *   if (error instanceof SVGCropError) {
 *     console.error(`Crop processing failed: ${error.message}`);
 *     console.error(`Error code: ${error.code}`);
 *     console.error('Details:', error.details);
 *   } else {
 *     console.error('Unexpected error:', error);
 *   }
 * }
 * ```
 */
export function processSVG(svgContent: string, options?: ProcessOptions): ProcessResult;

/**
 * Extract bead annotation data from link elements and convert to data attributes.
 *
 * Processes SVG links with bead:// protocol and converts them to HTML5 data attributes
 * directly on the bead elements. This function is automatically called by processSVG
 * when extractBeadAnnotations is enabled, but can also be used standalone.
 *
 * @param svgContent - Raw SVG content as string
 * @returns Extraction results including processed SVG and bead data
 * @throws {SVGCropError} When extraction fails
 *
 * @example
 * ```typescript
 * import { extractBeadAnnotations } from '@soroban/templates/svg-crop-processor';
 *
 * const result = extractBeadAnnotations(svgContent);
 * console.log(`Found ${result.count} interactive beads`);
 * console.log('Bead data:', result.beads);
 *
 * // Use processed SVG with data attributes
 * document.querySelector('#soroban-display').innerHTML = result.processedSVG;
 * ```
 */
export function extractBeadAnnotations(svgContent: string): {
  /** SVG content with links converted to data attributes */
  processedSVG: string;
  /** Array of extracted bead link information */
  beadLinks: Array<{
    id: string;
    data: BeadData;
    originalElement: string;
    innerContent: string;
  }>;
  /** Non-fatal warnings encountered */
  warnings: string[];
  /** Number of bead links processed */
  count: number;
};

/**
 * Browser-compatible file processing function.
 *
 * Processes File or Blob objects directly in browser environments without
 * requiring Node.js filesystem APIs. Perfect for client-side SVG optimization.
 *
 * @param file - SVG file to process (File or Blob object)
 * @param options - Processing customization options
 * @returns Promise resolving to complete processing results
 * @throws {SVGCropError} When processing fails
 *
 * @example
 * ```typescript
 * import { processSVGFile } from '@soroban/templates/svg-crop-processor';
 *
 * // Handle file upload in browser
 * const fileInput = document.getElementById('svg-upload') as HTMLInputElement;
 * fileInput.addEventListener('change', async (e) => {
 *   const file = (e.target as HTMLInputElement).files?.[0];
 *   if (!file) return;
 *
 *   try {
 *     const result = await processSVGFile(file, {
 *       preserveAspectRatio: true,
 *       extractBeadAnnotations: true
 *     });
 *
 *     console.log(`File optimized! Reduction: ${result.cropData.reduction}%`);
 *     console.log(`Found ${result.beadData?.count || 0} interactive beads`);
 *
 *     // Create download link for optimized SVG
 *     const blob = new Blob([result.svg], { type: 'image/svg+xml' });
 *     const url = URL.createObjectURL(blob);
 *
 *     const link = document.createElement('a');
 *     link.href = url;
 *     link.download = 'optimized.svg';
 *     link.click();
 *
 *   } catch (error) {
 *     console.error('Processing failed:', error.message);
 *   }
 * });
 * ```
 */
export function processSVGFile(file: File | Blob, options?: ProcessOptions): Promise<ProcessResult>;

/**
 * Browser global namespace when loaded via script tag.
 * Available as `window.SorobanSVGCropProcessor` in browser environments.
 */
declare global {
  interface Window {
    SorobanSVGCropProcessor: {
      processSVG: typeof processSVG;
      processSVGFile: typeof processSVGFile;
      extractCropMarks: typeof extractCropMarks;
      extractBeadAnnotations: typeof extractBeadAnnotations;
      SVGCropError: typeof SVGCropError;
    };
  }
}