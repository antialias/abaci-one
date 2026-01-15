/**
 * Layout constants for the worksheet generator
 * These ensure consistent spacing and sizing across components
 */

export const LAYOUT_CONSTANTS = {
  /**
   * Total height to subtract from viewport for SVG preview container
   * This is the empirically determined value that prevents overflow
   * while ensuring the worksheet fits within the viewport.
   *
   * Breakdown:
   * - Nav bar: ~64px
   * - Page padding top: 80px (pt-20)
   * - Page header (title + subtitle): ~40px
   * - Preview panel chrome (header, gaps, info): ~36px
   * Total: ~220px
   */
  SVG_PREVIEW_VIEWPORT_OFFSET: 220,
} as const;

/**
 * Get the CSS calc() expression for max-height of SVG preview
 */
export function getPreviewMaxHeight(): string {
  return `calc(100vh - ${LAYOUT_CONSTANTS.SVG_PREVIEW_VIEWPORT_OFFSET}px)`;
}
