#import "../flashcards.typ": draw-soroban

#set page(width: 200pt, height: 100pt, margin: 8pt, fill: white)
#set text(size: 10pt)

#align(center + horizon)[
  #text(weight: "bold", size: 12pt)[Number: 5]
  #v(8pt)
  #draw-soroban(5, columns: auto, bead-shape: "diamond", color-scheme: "place-value", base-size: 1.2)
]