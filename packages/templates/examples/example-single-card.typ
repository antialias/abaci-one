#import "../single-card.typ": generate-single-card

#set page(width: 140pt, height: 200pt, margin: 0pt, fill: white)

#generate-single-card(
  42,
  side: "front",
  bead-shape: "diamond",
  color-scheme: "place-value",
  font-size: 24pt,
  width: 140pt,
  height: 200pt
)