#let draw-soroban(value, columns: auto, show-empty: false, hide-inactive: false, bead-shape: "diamond", color-scheme: "monochrome", color-palette: "default", base-size: 1.0) = {
  // Parse the value into digits
  let digits = if type(value) == int {
    str(value).clusters().map(d => int(d))
  } else {
    panic("Value must be an integer")
  }
  
  // Determine number of columns
  let num-columns = if columns == auto {
    digits.len()
  } else {
    columns
  }
  
  // Pad with leading zeros if needed
  let padded-digits = if digits.len() < num-columns {
    (0,) * (num-columns - digits.len()) + digits
  } else {
    digits.slice(calc.max(0, digits.len() - num-columns))
  }
  
  // Skip leading zeros if show-empty is false
  let start-idx = if not show-empty {
    let first-nonzero = padded-digits.position(d => d != 0)
    if first-nonzero == none { 0 } else { first-nonzero }
  } else { 0 }
  
  let display-digits = padded-digits.slice(start-idx)
  if display-digits.len() == 0 { display-digits = (0,) }
  
  // Drawing parameters scaled by base-size
  let rod-width = 3pt * base-size
  let bead-size = 12pt * base-size
  let bead-spacing = 4pt * base-size  // Original spacing (will be overridden for adjacent same-type beads)
  let adjacent-spacing = 0.5pt * base-size  // Minimal spacing for adjacent beads of same type
  let column-spacing = 25pt * base-size
  let heaven-earth-gap = 30pt * base-size
  let bar-thickness = 2pt * base-size
  
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
  
  let get-column-color(col-idx, total-cols, scheme) = {
    if scheme == "place-value" {
      // Right-to-left: rightmost is ones
      let place-idx = total-cols - col-idx - 1
      let color-idx = calc.rem(place-idx, place-value-colors.len())
      place-value-colors.at(color-idx)
    } else if scheme == "alternating" {
      if calc.rem(col-idx, 2) == 0 { rgb("#1E88E5") } else { rgb("#43A047") }
    } else if scheme == "heaven-earth" {
      black  // Will be overridden per bead type
    } else {
      black  // monochrome
    }
  }
  
  let inactive-color = gray.lighten(70%)
  let active-color = black
  
  // Function to draw a bead based on shape with annotation
  // y parameter represents the CENTER of where the bead should be
  let draw-bead(x, y, shape, fill-color, annotation-id) = {
    let bead-element = if shape == "diamond" {
      // Horizontally elongated diamond (rhombus)
      place(
        dx: x - bead-size * 0.7,
        dy: y - bead-size / 2,
        polygon(
          (bead-size * 0.7, 0pt),           // left point
          (bead-size * 1.4, bead-size / 2), // top point
          (bead-size * 0.7, bead-size),      // right point
          (0pt, bead-size / 2),              // bottom point
          fill: fill-color,
          stroke: 0.5pt + black
        )
      )
    } else if shape == "square" {
      // Square bead
      place(
        dx: x - bead-size / 2,
        dy: y - bead-size / 2,
        rect(
          width: bead-size,
          height: bead-size,
          fill: fill-color,
          stroke: 0.5pt + black,
          radius: 1pt  // Slight rounding
        )
      )
    } else {
      // Circle (traditional option)
      // Use a box to position the circle from top-left like other shapes
      place(
        dx: x - bead-size / 2,
        dy: y - bead-size / 2,
        box(
          width: bead-size,
          height: bead-size,
          align(center + horizon, circle(
            radius: bead-size / 2,
            fill: fill-color,
            stroke: 0.5pt + black
          ))
        )
      )
    }

    // Wrap the bead in a link for annotation
    link("bead://" + annotation-id, bead-element)
  }
  
  // Calculate total width and height
  let total-width = display-digits.len() * column-spacing
  let total-height = heaven-earth-gap + 5 * (bead-size + bead-spacing) + 10pt
  
  box(width: total-width, height: total-height)[
    #place(top + left)[
      #for (idx, digit) in display-digits.enumerate() [
        #let x-offset = idx * column-spacing + column-spacing / 2
        // Calculate place value (0=ones, 1=tens, 2=hundreds, etc.) for stable column IDs
        #let place-value = display-digits.len() - idx - 1
        
        // Decompose digit into heaven (5s) and earth (1s) beads
        #let heaven-active = if digit >= 5 { 1 } else { 0 }
        #let earth-active = calc.rem(digit, 5)
        
        // Calculate bead positions and rod bounds
        #let active-gap = 1pt  // Gap between active beads and reckoning bar (keep original)
        #let inactive-gap = 8pt  // Gap between inactive beads and active beads/bar (increased)
        
        // Calculate heaven bead position
        #let heaven-y = if heaven-active == 1 {
          // Active heaven bead: positioned close to reckoning bar (original spacing)
          heaven-earth-gap - bead-size / 2 - active-gap
        } else {
          // Inactive heaven bead: positioned away from reckoning bar with larger gap
          heaven-earth-gap - inactive-gap - bead-size / 2
        }
        
        // Calculate furthest earth bead position
        #let furthest-earth-y = if earth-active > 0 {
          // Position of the last inactive earth bead (or last active if all are active)
          if earth-active == 4 {
            // All earth beads are active - furthest is the 4th active bead (using adjacent spacing)
            heaven-earth-gap + bar-thickness + active-gap + bead-size / 2 + 3 * (bead-size + adjacent-spacing)
          } else {
            // Some inactive beads - furthest is the last inactive bead
            heaven-earth-gap + bar-thickness + active-gap + bead-size / 2 + (earth-active - 1) * (bead-size + adjacent-spacing) + bead-size / 2 + inactive-gap + bead-size / 2 + (4 - 1 - earth-active) * (bead-size + adjacent-spacing)
          }
        } else {
          // No active beads: furthest is the last inactive bead (using adjacent spacing)
          heaven-earth-gap + bar-thickness + inactive-gap + bead-size / 2 + 3 * (bead-size + adjacent-spacing)
        }
        
        // Calculate rod bounds (from outermost visible bead to outermost visible bead)
        #let rod-start-y = if heaven-active == 1 or not hide-inactive {
          heaven-y - bead-size / 2
        } else {
          // No heaven bead visible - start at reckoning bar
          heaven-earth-gap - bar-thickness / 2
        }
        
        #let rod-end-y = if not hide-inactive or earth-active > 0 {
          furthest-earth-y + bead-size / 2
        } else {
          // No earth beads visible - end at reckoning bar
          heaven-earth-gap + bar-thickness / 2
        }
        
        #let rod-height = rod-end-y - rod-start-y
        
        // Draw rod with calculated bounds
        #place(
          dx: x-offset - rod-width / 2,
          dy: rod-start-y,
          rect(
            width: rod-width,
            height: rod-height,
            fill: gray.lighten(80%),
            stroke: none
          )
        )
        
        // Draw heaven bead
        #let bead-color = if heaven-active == 1 {
          if color-scheme == "heaven-earth" {
            rgb("#F18F01")  // Orange for heaven beads
          } else {
            get-column-color(idx, display-digits.len(), color-scheme)
          }
        } else {
          inactive-color
        }
        
        #if heaven-active == 1 or not hide-inactive [
          #draw-bead(
            x-offset,
            heaven-y,
            bead-shape,
            bead-color,
            "heaven-col" + str(place-value) + "-active" + str(heaven-active)
          )
        ]
        
        // Draw earth beads
        #for i in range(4) [
          #let is-active = i < earth-active
          #let earth-y = if is-active {
            // Active beads: positioned near reckoning bar, adjacent beads touch
            heaven-earth-gap + bar-thickness + active-gap + bead-size / 2 + i * (bead-size + adjacent-spacing)
          } else {
            // Inactive beads: positioned after the active beads + gap, or after reckoning bar + gap if no active beads
            if earth-active > 0 {
              // Position after the last active bead + gap, then adjacent inactive beads touch
              heaven-earth-gap + bar-thickness + active-gap + bead-size / 2 + (earth-active - 1) * (bead-size + adjacent-spacing) + bead-size / 2 + inactive-gap + bead-size / 2 + (i - earth-active) * (bead-size + adjacent-spacing)
            } else {
              // No active beads: position after reckoning bar + gap, adjacent inactive beads touch
              heaven-earth-gap + bar-thickness + inactive-gap + bead-size / 2 + i * (bead-size + adjacent-spacing)
            }
          }
          
          #let earth-bead-color = if is-active {
            if color-scheme == "heaven-earth" {
              rgb("#2E86AB")  // Blue for earth beads
            } else {
              get-column-color(idx, display-digits.len(), color-scheme)
            }
          } else {
            inactive-color
          }
          
          #if is-active or not hide-inactive [
            #draw-bead(
              x-offset,
              earth-y,
              bead-shape,
              earth-bead-color,
              "earth-col" + str(place-value) + "-pos" + str(i) + "-active" + str(if is-active { 1 } else { 0 })
            )
          ]
        ]
      ]
      
      // Draw reckoning bar
      #place(
        dx: 0pt,
        dy: heaven-earth-gap,
        rect(
          width: total-width,
          height: bar-thickness,
          fill: black,
          stroke: none
        )
      )
    ]
  ]
}

#let scale-to-fit(content, max-width, max-height, manual-scale: 1.0) = {
  context {
    // Measure the content
    let measured = measure(content)
    
    // Calculate scale factors
    let scale-x = max-width / measured.width
    let scale-y = max-height / measured.height
    
    // Use the smaller scale to maintain aspect ratio
    let auto-scale = calc.min(scale-x, scale-y)
    
    // Apply manual scale adjustment
    let final-scale = auto-scale * manual-scale
    
    // Return scaled content
    scale(x: final-scale * 100%, y: final-scale * 100%)[#content]
  }
}

#let flashcard(
  front-content,
  back-content,
  card-width: 3.5in,
  card-height: 2.5in,
  safe-margin: 5mm,
  show-cut-marks: false,
  show-registration: false,
  scale-factor: 0.9
) = {
  let usable-width = card-width - 2 * safe-margin
  let usable-height = card-height - 2 * safe-margin
  
  let card = rect(
    width: card-width,
    height: card-height,
    stroke: if show-cut-marks { 0.25pt + gray } else { none },
    radius: 0pt
  )[
    #align(center + horizon)[
      #scale-to-fit(front-content, usable-width, usable-height, manual-scale: scale-factor)
    ]
    
    // Registration mark
    #if show-registration {
      place(
        bottom + right,
        dx: -2mm,
        dy: -2mm,
        circle(radius: 0.5mm, fill: gray.lighten(70%))
      )
    }
  ]
  
  (
    front: card,
    back: rect(
      width: card-width,
      height: card-height,
      stroke: if show-cut-marks { 0.25pt + gray } else { none },
      radius: 0pt
    )[
      #align(center + horizon)[
        #scale-to-fit(back-content, usable-width, usable-height, manual-scale: scale-factor)
      ]
      
      // Registration mark
      #if show-registration {
        place(
          bottom + left,
          dx: 2mm,
          dy: -2mm,
          circle(radius: 0.5mm, fill: gray.lighten(70%))
        )
      }
    ]
  )
}

#let generate-flashcards(
  numbers,
  cards-per-page: 6,
  paper-size: "us-letter",
  orientation: "portrait",
  margins: (top: 0.5in, bottom: 0.5in, left: 0.5in, right: 0.5in),
  gutter: 5mm,
  show-cut-marks: false,
  show-registration: false,
  font-family: "DejaVu Sans",
  font-size: 48pt,
  columns: auto,
  show-empty-columns: false,
  hide-inactive-beads: false,
  bead-shape: "diamond",
  color-scheme: "monochrome",
  color-palette: "default",
  colored-numerals: false,
  scale-factor: 0.9  // Manual scale adjustment (0.1 to 1.0)
) = {
  // Set document properties
  set document(
    title: "Soroban Flashcards", 
    author: "Soroban Flashcard Generator",
    keywords: ("soroban", "abacus", "flashcards", "education", "math"),
    date: auto
  )
  set page(
    paper: paper-size,
    margin: margins,
    flipped: orientation == "landscape"
  )
  
  set text(font: font-family, size: font-size, fallback: true)
  
  // Calculate card dimensions
  let page-width = if orientation == "portrait" { 8.5in } else { 11in }
  let page-height = if orientation == "portrait" { 11in } else { 8.5in }
  
  let usable-width = page-width - margins.left - margins.right
  let usable-height = page-height - margins.top - margins.bottom
  
  // Determine grid layout
  let (cols, rows) = if cards-per-page == 1 {
    (1, 1)
  } else if cards-per-page == 2 {
    (1, 2)
  } else if cards-per-page == 3 {
    (1, 3)
  } else if cards-per-page == 4 {
    (2, 2)
  } else if cards-per-page == 6 {
    (2, 3)
  } else if cards-per-page == 8 {
    (2, 4)
  } else if cards-per-page == 9 {
    (3, 3)
  } else if cards-per-page == 10 {
    (2, 5)
  } else if cards-per-page == 12 {
    (3, 4)
  } else if cards-per-page == 15 {
    (3, 5)
  } else if cards-per-page == 16 {
    (4, 4)
  } else if cards-per-page == 18 {
    (3, 6)
  } else if cards-per-page == 20 {
    (4, 5)
  } else if cards-per-page == 24 {
    (4, 6)
  } else if cards-per-page == 25 {
    (5, 5)
  } else if cards-per-page == 30 {
    (5, 6)
  } else {
    // Try to find a reasonable grid for other values
    let sqrt-cards = calc.sqrt(cards-per-page)
    let cols-guess = calc.ceil(sqrt-cards)
    let rows-guess = calc.ceil(cards-per-page / cols-guess)
    (cols-guess, rows-guess)
  }
  
  let card-width = (usable-width - gutter * (cols - 1)) / cols
  let card-height = (usable-height - gutter * (rows - 1)) / rows
  
  // Adaptive sizing based on card dimensions
  // Calculate a base scale factor based on card size compared to default
  let default-card-width = 3.5in
  let default-card-height = 2.5in
  let width-scale = card-width / default-card-width
  let height-scale = card-height / default-card-height
  let base-scale = calc.min(width-scale, height-scale)
  
  // Adaptive font size based on card dimensions
  let base-font-size = if font-size == 48pt {
    // Auto-scale default font size based on card height
    48pt * base-scale
  } else {
    font-size
  }
  
  // Function to create colored numeral based on color scheme
  let create-colored-numeral(num, scheme, use-colors, font-size) = {
    // Use the exact same colors as the beads
    let place-value-colors = (
      rgb("#2E86AB"),  // ones - blue (same as beads)
      rgb("#A23B72"),  // tens - magenta (same as beads)
      rgb("#F18F01"),  // hundreds - orange (same as beads)
      rgb("#6A994E"),  // thousands - green (same as beads)
      rgb("#BC4B51"),  // ten-thousands - red (same as beads)
    )
    
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
      text(size: font-size)[#num]
    }
  }
  
  // Generate cards
  let cards = numbers.map(num => {
    flashcard(
      draw-soroban(num, columns: columns, show-empty: show-empty-columns, hide-inactive: hide-inactive-beads, bead-shape: bead-shape, color-scheme: color-scheme, color-palette: color-palette, base-size: base-scale),
      create-colored-numeral(num, color-scheme, colored-numerals, base-font-size),
      card-width: card-width,
      card-height: card-height,
      show-cut-marks: show-cut-marks,
      show-registration: show-registration,
      scale-factor: scale-factor
    )
  })
  
  // Function to draw cutting guides
  let draw-cutting-guides(cols, rows, card-width, card-height, gutter, usable-width, usable-height) = {
    // Use subtle gray lines that won't be too distracting if cut is slightly off
    let guide-color = gray.lighten(50%)
    let guide-stroke = 0.25pt + guide-color
    
    // Draw horizontal cutting guides
    for row in range(rows - 1) {
      let y-pos = (row + 1) * card-height + row * gutter + gutter / 2
      place(
        dx: -margins.left,  // Extend to page edge
        dy: y-pos,
        line(
          start: (0pt, 0pt),
          end: (usable-width + margins.left + margins.right, 0pt),
          stroke: guide-stroke
        )
      )
    }
    
    // Draw vertical cutting guides
    for col in range(cols - 1) {
      let x-pos = (col + 1) * card-width + col * gutter + gutter / 2
      place(
        dx: x-pos,
        dy: -margins.top,  // Extend to page edge
        line(
          start: (0pt, 0pt),
          end: (0pt, usable-height + margins.top + margins.bottom),
          stroke: guide-stroke
        )
      )
    }
  }
  
  // Layout pages - alternating front and back for duplex printing
  let total-cards = cards.len()
  let total-pages = calc.ceil(total-cards / cards-per-page)
  
  // Generate all pages in front/back pairs for proper duplex printing
  for page-idx in range(total-pages) {
    let start-idx = page-idx * cards-per-page
    let end-idx = calc.min(start-idx + cards-per-page, total-cards)
    let page-cards = cards.slice(start-idx, end-idx)
    
    // FRONT SIDE (odd page numbers: 1, 3, 5...)
    // This will be the soroban bead side
    place(
      grid(
        columns: (card-width,) * cols,
        rows: (card-height,) * rows,
        column-gutter: gutter,
        row-gutter: gutter,
        ..page-cards.map(c => c.front)
      )
    )
    
    // Draw cutting guides on top if enabled
    if show-cut-marks {
      draw-cutting-guides(cols, rows, card-width, card-height, gutter, usable-width, usable-height)
    }
    
    // Always add page break after front side
    pagebreak()
    
    // BACK SIDE (even page numbers: 2, 4, 6...)
    // This will be the numeral side
    // Mirrored horizontally for long-edge duplex binding
    place(
      grid(
        columns: (card-width,) * cols,
        rows: (card-height,) * rows,
        column-gutter: gutter,
        row-gutter: gutter,
        ..range(rows).map(r => {
          // Reverse columns for proper back-side alignment
          range(cols).rev().map(c => {
            let idx = r * cols + c
            if idx < page-cards.len() {
              page-cards.at(idx).back
            } else {
              // Empty space for incomplete grids
              rect(width: card-width, height: card-height, stroke: none)[]
            }
          })
        }).flatten()
      )
    )
    
    // Draw cutting guides on back side too
    if show-cut-marks {
      draw-cutting-guides(cols, rows, card-width, card-height, gutter, usable-width, usable-height)
    }
    
    // Add page break except after the last page
    if page-idx < total-pages - 1 {
      pagebreak()
    }
  }
}