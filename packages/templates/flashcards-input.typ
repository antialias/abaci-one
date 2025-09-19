// Input-based wrapper for flashcards.typ
// This template accepts parameters via Typst's --input system

#import "flashcards.typ": generate-flashcards

// Parse input parameters with defaults
#let numbers = if "numbers" in sys.inputs {
  // Parse comma-separated string to array of integers
  sys.inputs.numbers.split(",").map(s => int(s.trim()))
} else {
  (0, 1, 2, 3, 4, 5, 6, 7, 8, 9)
}

#let cards-per-page = if "cards_per_page" in sys.inputs {
  int(sys.inputs.cards_per_page)
} else { 6 }

#let paper-size = if "paper_size" in sys.inputs {
  sys.inputs.paper_size
} else { "us-letter" }

#let orientation = if "orientation" in sys.inputs {
  sys.inputs.orientation
} else { "portrait" }

// Parse margins (expecting format like "0.5in,0.5in,0.5in,0.5in" for top,bottom,left,right)
#let margins = if "margins" in sys.inputs {
  let parts = sys.inputs.margins.split(",")
  (
    top: eval(parts.at(0).trim()),
    bottom: eval(parts.at(1).trim()),
    left: eval(parts.at(2).trim()),
    right: eval(parts.at(3).trim())
  )
} else {
  (top: 0.5in, bottom: 0.5in, left: 0.5in, right: 0.5in)
}

#let gutter = if "gutter" in sys.inputs {
  eval(sys.inputs.gutter)
} else { 5mm }

#let show-cut-marks = if "show_cut_marks" in sys.inputs {
  sys.inputs.show_cut_marks == "true"
} else { false }

#let show-registration = if "show_registration" in sys.inputs {
  sys.inputs.show_registration == "true"
} else { false }

#let font-family = if "font_family" in sys.inputs {
  sys.inputs.font_family
} else { "DejaVu Sans" }

#let font-size = if "font_size" in sys.inputs {
  eval(sys.inputs.font_size)
} else { 48pt }

#let columns = if "columns" in sys.inputs {
  if sys.inputs.columns == "auto" { auto } else { int(sys.inputs.columns) }
} else { auto }

#let show-empty-columns = if "show_empty_columns" in sys.inputs {
  sys.inputs.show_empty_columns == "true"
} else { false }

#let hide-inactive-beads = if "hide_inactive_beads" in sys.inputs {
  sys.inputs.hide_inactive_beads == "true"
} else { false }

#let bead-shape = if "bead_shape" in sys.inputs {
  sys.inputs.bead_shape
} else { "diamond" }

#let color-scheme = if "color_scheme" in sys.inputs {
  sys.inputs.color_scheme
} else { "monochrome" }

#let color-palette = if "color_palette" in sys.inputs {
  sys.inputs.color_palette
} else { "default" }

#let colored-numerals = if "colored_numerals" in sys.inputs {
  sys.inputs.colored_numerals == "true"
} else { false }

#let scale-factor = if "scale_factor" in sys.inputs {
  float(sys.inputs.scale_factor)
} else { 0.9 }

// Call the main generation function with parsed parameters
#generate-flashcards(
  numbers,
  cards-per-page: cards-per-page,
  paper-size: paper-size,
  orientation: orientation,
  margins: margins,
  gutter: gutter,
  show-cut-marks: show-cut-marks,
  show-registration: show-registration,
  font-family: font-family,
  font-size: font-size,
  columns: columns,
  show-empty-columns: show-empty-columns,
  hide-inactive-beads: hide-inactive-beads,
  bead-shape: bead-shape,
  color-scheme: color-scheme,
  color-palette: color-palette,
  colored-numerals: colored-numerals,
  scale-factor: scale-factor
)