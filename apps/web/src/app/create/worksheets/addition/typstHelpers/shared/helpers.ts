// Shared Typst helper functions and components
// Reusable across addition and subtraction worksheets

import { TYPST_CONSTANTS } from "./types";

/**
 * Generate Typst helper functions (ten-frames, diagonal boxes, etc.)
 * These are shared between addition and subtraction problems
 */
export function generateTypstHelpers(cellSize: number): string {
  return String.raw`
// Ten-frame helper - stacked 2 frames vertically, sized to fit cell width
#let ten-frame-spacing = 0pt
#let ten-frame-cell-stroke = ${TYPST_CONSTANTS.TEN_FRAME_CELL_STROKE_WIDTH}pt
#let ten-frame-cell-color = rgb(0, 0, 0, 30%)
#let ten-frame-outer-stroke = ${TYPST_CONSTANTS.TEN_FRAME_STROKE_WIDTH}pt
#let ten-frames-stacked(cell-width, top-color, bottom-color) = {
  let cell-w = cell-width / 5
  let cell-h = cell-w  // Square cells
  stack(
    dir: ttb,
    spacing: ten-frame-spacing,
    // Top ten-frame (carry to next place value)
    box(stroke: ten-frame-outer-stroke + black, inset: 0pt)[
      #grid(
        columns: 5, rows: 2, gutter: 0pt, stroke: none,
        ..for i in range(0, 10) {
          (box(width: cell-w, height: cell-h, fill: top-color, stroke: ten-frame-cell-stroke + ten-frame-cell-color)[],)
        }
      )
    ],
    // Bottom ten-frame (current place value overflow)
    box(stroke: ten-frame-outer-stroke + black, inset: 0pt)[
      #grid(
        columns: 5, rows: 2, gutter: 0pt, stroke: none,
        ..for i in range(0, 10) {
          (box(width: cell-w, height: cell-h, fill: bottom-color, stroke: ten-frame-cell-stroke + ten-frame-cell-color)[],)
        }
      )
    ]
  )
}

// Diagonal-split box for carry cells
// Shows the transition from one place value to another
// source-color: color of the place value where the carry comes FROM (right side)
// dest-color: color of the place value where the carry goes TO (left side)
#let diagonal-split-box(cell-size, source-color, dest-color) = {
  box(width: cell-size, height: cell-size, stroke: ${TYPST_CONSTANTS.CELL_STROKE_WIDTH}pt)[
    // Bottom-right triangle (source place value)
    #place(
      bottom + right,
      polygon(
        fill: source-color,
        stroke: none,
        (0pt, 0pt),           // bottom-left corner of triangle
        (cell-size, 0pt),     // bottom-right corner
        (cell-size, cell-size) // top-right corner
      )
    )
    // Top-left triangle (destination place value)
    #place(
      top + left,
      polygon(
        fill: dest-color,
        stroke: none,
        (0pt, 0pt),           // top-left corner
        (cell-size, cell-size), // bottom-right corner of triangle
        (0pt, cell-size)      // bottom-left corner
      )
    )
  ]
}
`;
}
