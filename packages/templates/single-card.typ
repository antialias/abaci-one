// Single card template for PNG export
// Renders one card at a time with optional transparent background

#import "flashcards.typ": draw-soroban

// Local definition of create-colored-numeral since it's not exported
#let create-colored-numeral(num, scheme, use-colors, font-size, color-palette: "default") = {
  // Color palette definitions - all colorblind-friendly
  let color-palettes = (
    "default": (
      rgb("#2E86AB"),  // ones - blue
      rgb("#A23B72"),  // tens - magenta
      rgb("#F18F01"),  // hundreds - orange
      rgb("#6A994E"),  // thousands - green
      rgb("#BC4B51"),  // ten-thousands - red
    ),
    "colorblind": (
      rgb("#0173B2"),  // ones - strong blue
      rgb("#DE8F05"),  // tens - orange
      rgb("#CC78BC"),  // hundreds - pink
      rgb("#029E73"),  // thousands - teal green
      rgb("#D55E00"),  // ten-thousands - vermillion
    ),
    "mnemonic": (
      rgb("#1f77b4"),  // ones - BLUE (Blue = Basic/Beginning)
      rgb("#ff7f0e"),  // tens - ORANGE (Orange = Ten commandments) 
      rgb("#2ca02c"),  // hundreds - GREEN (Green = Grass/Ground)
      rgb("#d62728"),  // thousands - RED (Red = Thousand suns/fire)
      rgb("#9467bd"),  // ten-thousands - PURPLE (Purple = Prestigious/Premium)
    ),
    "grayscale": (
      rgb("#000000"),  // ones - black
      rgb("#404040"),  // tens - dark gray
      rgb("#808080"),  // hundreds - medium gray
      rgb("#b0b0b0"),  // thousands - light gray
      rgb("#d0d0d0"),  // ten-thousands - very light gray
    ),
    "nature": (
      rgb("#4E79A7"),  // ones - sky blue
      rgb("#F28E2C"),  // tens - sunset orange
      rgb("#E15759"),  // hundreds - coral red
      rgb("#76B7B2"),  // thousands - seafoam green
      rgb("#59A14F"),  // ten-thousands - forest green
    ),
  )
  
  // Get the selected color palette
  let place-value-colors = color-palettes.at(color-palette, default: color-palettes.at("default"))
  
  if not use-colors or scheme == "monochrome" {
    // Plain black text
    text(size: font-size)[#num]
  } else if scheme == "place-value" {
    // Color each digit according to its place value
    let digits = str(num).clusters()
    let num-digits = digits.len()
    let colored-digits = ()
    
    for (idx, digit) in digits.enumerate() {
      let place-idx = num-digits - idx - 1  // 0 = ones, 1 = tens, etc.
      let color-idx = calc.rem(place-idx, place-value-colors.len())
      let digit-color = place-value-colors.at(color-idx)
      colored-digits += (text(fill: digit-color, size: font-size)[#digit],)
    }
    
    colored-digits.join()
  } else if scheme == "heaven-earth" {
    // For heaven-earth, use orange (heaven bead color)
    text(size: font-size, fill: rgb("#F18F01"))[#num]
  } else if scheme == "alternating" {
    // For alternating, we could alternate digit colors
    let digits = str(num).clusters()
    let colored-digits = ()
    
    for (idx, digit) in digits.enumerate() {
      let digit-color = if calc.rem(idx, 2) == 0 { rgb("#1E88E5") } else { rgb("#43A047") }
      colored-digits += (text(fill: digit-color, size: font-size)[#digit],)
    }
    
    colored-digits.join()
  } else {
    // Fallback to plain text
    text(size: font-size)[#num]
  }
}

#let generate-single-card(
  number,
  side: "front",  // "front" or "back"
  bead-shape: "diamond",
  color-scheme: "monochrome",
  colored-numerals: false,
  hide-inactive-beads: false,
  show-empty-columns: false,
  columns: auto,
  transparent: false,
  width: 3.5in,
  height: 2.5in,
  font-size: 48pt,
  font-family: "DejaVu Sans",
  scale-factor: 1.0,
  color-palette: "default",
  show-crop-marks: false,
  crop-margin: 10pt,
) = {
  // Set page size to exact card dimensions
  set page(
    width: width,
    height: height,
    margin: 0pt,
    fill: if transparent { none } else { white }
  )
  
  // Set font
  set text(font: font-family, size: font-size, fallback: true)
  
  // Calculate padding for content
  let padding = width * 0.05
  
  // Render the appropriate side
  if side == "front" {
    // Soroban side
    align(center + horizon)[
      #box(
        width: width - 2 * padding,
        height: height - 2 * padding
      )[
        #align(center + horizon)[
          #scale(x: scale-factor * 100%, y: scale-factor * 100%)[
            #draw-soroban(
              number,
              columns: columns,
              show-empty: show-empty-columns,
              hide-inactive: hide-inactive-beads,
              bead-shape: bead-shape,
              color-scheme: color-scheme,
              color-palette: color-palette,
              base-size: 1.0
            )
          ]
        ]
      ]
    ]
  } else {
    // Numeral side
    align(center + horizon)[
      #create-colored-numeral(number, color-scheme, colored-numerals, font-size * scale-factor, color-palette: color-palette)
    ]
  }

  // Add crop marks for consistent viewBox handling
  // These marks define the intended crop boundaries for both sides
  let crop-mark-size = 2pt
  let crop-mark-stroke = if show-crop-marks { 0.5pt } else { 0pt }
  let crop-mark-color = if show-crop-marks { red } else { none }

  // Calculate crop boundaries with margin
  let crop-left = -crop-margin
  let crop-right = width + crop-margin
  let crop-top = -crop-margin
  let crop-bottom = height + crop-margin

  // Top crop mark (centered on top edge)
  place(
    dx: width / 2 - crop-mark-size / 2,
    dy: crop-top,
    link("crop-mark://top",
      rect(
        width: crop-mark-size,
        height: crop-mark-size,
        fill: crop-mark-color,
        stroke: crop-mark-stroke + crop-mark-color
      )
    )
  )

  // Bottom crop mark (centered on bottom edge)
  place(
    dx: width / 2 - crop-mark-size / 2,
    dy: crop-bottom - crop-mark-size,
    link("crop-mark://bottom",
      rect(
        width: crop-mark-size,
        height: crop-mark-size,
        fill: crop-mark-color,
        stroke: crop-mark-stroke + crop-mark-color
      )
    )
  )

  // Left crop mark (centered on left edge)
  place(
    dx: crop-left,
    dy: height / 2 - crop-mark-size / 2,
    link("crop-mark://left",
      rect(
        width: crop-mark-size,
        height: crop-mark-size,
        fill: crop-mark-color,
        stroke: crop-mark-stroke + crop-mark-color
      )
    )
  )

  // Right crop mark (centered on right edge)
  place(
    dx: crop-right - crop-mark-size,
    dy: height / 2 - crop-mark-size / 2,
    link("crop-mark://right",
      rect(
        width: crop-mark-size,
        height: crop-mark-size,
        fill: crop-mark-color,
        stroke: crop-mark-stroke + crop-mark-color
      )
    )
  )

  // Center reference mark for debugging alignment
  place(
    dx: width / 2 - crop-mark-size / 2,
    dy: height / 2 - crop-mark-size / 2,
    link("crop-mark://center",
      rect(
        width: crop-mark-size,
        height: crop-mark-size,
        fill: crop-mark-color,
        stroke: crop-mark-stroke + crop-mark-color
      )
    )
  )
}