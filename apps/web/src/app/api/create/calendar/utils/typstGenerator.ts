interface TypstMonthlyConfig {
  month: number;
  year: number;
  paperSize: "us-letter" | "a4" | "a3" | "tabloid";
  daysInMonth: number;
}

interface TypstDailyConfig {
  month: number;
  year: number;
  paperSize: "us-letter" | "a4" | "a3" | "tabloid";
  daysInMonth: number;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay(); // 0 = Sunday
}

function getDayOfWeek(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

type PaperSize = "us-letter" | "a4" | "a3" | "tabloid";

interface PaperConfig {
  typstName: string;
  marginX: string;
  marginY: string;
}

function getPaperConfig(size: string): PaperConfig {
  const configs: Record<PaperSize, PaperConfig> = {
    // Tight margins to maximize space for calendar grid
    "us-letter": { typstName: "us-letter", marginX: "0.5in", marginY: "0.5in" },
    // A4 is slightly taller/narrower than US Letter - adjust margins proportionally
    a4: { typstName: "a4", marginX: "1.3cm", marginY: "1.3cm" },
    // A3 is 2x area of A4 - can use same margins but will scale content larger
    a3: { typstName: "a3", marginX: "1.5cm", marginY: "1.5cm" },
    // Tabloid (11" × 17") is larger - can use more margin
    tabloid: { typstName: "us-tabloid", marginX: "0.75in", marginY: "0.75in" },
  };
  return configs[size as PaperSize] || configs["us-letter"];
}

export function generateMonthlyTypst(config: TypstMonthlyConfig): string {
  const { paperSize } = config;
  const paperConfig = getPaperConfig(paperSize);

  // Single-page design: use one composite SVG that scales to fit
  // This prevents overflow - Typst will scale the image to fit available space
  return `#set page(
  paper: "${paperConfig.typstName}",
  margin: (x: ${paperConfig.marginX}, y: ${paperConfig.marginY}),
)

// Composite calendar SVG - scales to fit page (prevents multi-page overflow)
#align(center + horizon)[
  #image("calendar.svg", width: 100%, fit: "contain")
]
`;
}

export function generateDailyTypst(config: TypstDailyConfig): string {
  const { month, year, paperSize, daysInMonth } = config;
  const paperConfig = getPaperConfig(paperSize);
  const monthName = MONTH_NAMES[month - 1];

  let pages = "";

  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = getDayOfWeek(year, month, day);

    pages += `
#page(
  paper: "${paperConfig.typstName}",
  margin: (x: ${paperConfig.marginX}, y: ${paperConfig.marginY}),
)[
  #set text(font: "Georgia")

  // Decorative borders
  #rect(
    width: 100%,
    height: 100%,
    stroke: (paint: rgb("#2563eb"), thickness: 3pt),
    radius: 8pt,
    inset: 0pt,
  )[
    #rect(
      width: 100%,
      height: 100%,
      stroke: (paint: rgb("#2563eb"), thickness: 1pt),
      radius: 4pt,
      inset: 10pt,
    )[
      #v(10pt)

      // Header section with background
      #rect(
        width: 100%,
        height: 90pt,
        fill: rgb("#eff6ff"),
        stroke: (paint: rgb("#2563eb"), thickness: 2pt),
        radius: 6pt,
      )[
        #align(center)[
          #v(15pt)
          #text(size: 32pt, weight: "bold", fill: rgb("#1e40af"), tracking: 2pt)[
            ${monthName.toUpperCase()}
          ]
          #v(5pt)
          #image("year.svg", width: 15%)
        ]
      ]

      #v(15pt)

      // Day of week (large and prominent)
      #align(center)[
        #text(size: 28pt, weight: "bold", fill: rgb("#1e3a8a"))[
          ${dayOfWeek}
        ]
      ]

      #v(10pt)

      // Day abacus (main focus, large)
      #align(center)[
        #image("day-${day}.svg", width: 45%)
      ]

      #v(10pt)

      // Full date
      #align(center)[
        #text(size: 18pt, weight: 500, fill: rgb("#475569"))[
          ${monthName} ${day}, ${year}
        ]
      ]

      #v(1fr)

      // Notes section with decorative box
      #rect(
        width: 100%,
        height: 90pt,
        fill: rgb("#fefce8"),
        stroke: (paint: rgb("#ca8a04"), thickness: 2pt),
        radius: 4pt,
      )[
        #v(8pt)
        #text(size: 14pt, weight: "bold", fill: rgb("#854d0e"))[
          #h(10pt) Notes:
        ]
        #v(8pt)
        #line(length: 95%, stroke: (paint: rgb("#ca8a04"), thickness: 1pt))
        #v(8pt)
        #line(length: 95%, stroke: (paint: rgb("#ca8a04"), thickness: 1pt))
        #v(8pt)
        #line(length: 95%, stroke: (paint: rgb("#ca8a04"), thickness: 1pt))
      ]

      #v(10pt)
    ]
  ]
]

${day < daysInMonth ? "" : ""}`;

    if (day < daysInMonth) {
      pages += "\n";
    }
  }

  return pages;
}
