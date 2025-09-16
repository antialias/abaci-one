#import "../flashcards.typ": draw-soroban

#set page(width: 250pt, height: 120pt, margin: 8pt, fill: white)
#set text(size: 10pt)

#align(center + horizon)[
  #text(weight: "bold", size: 12pt)[Number: 123]
  #v(8pt)
  #draw-soroban(123, columns: auto, bead-shape: "circle", color-scheme: "heaven-earth", base-size: 1.0)
]