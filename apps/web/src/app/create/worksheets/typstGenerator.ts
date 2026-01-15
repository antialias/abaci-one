// Typst document generator for addition worksheets

import type {
  WorksheetConfig,
  WorksheetProblem,
} from "@/app/create/worksheets/types";
import { resolveDisplayForProblem } from "./displayRules";
import { analyzeProblem, analyzeSubtractionProblem } from "./problemAnalysis";
import { generateQRCodeSVG } from "./qrCodeGenerator";
import {
  generatePlaceValueColors,
  generateProblemStackFunction,
  generateSubtractionProblemStackFunction,
  generateTypstHelpers,
} from "./typstHelpers";

/**
 * Generate a human-readable description of the worksheet settings
 * Format matches the difficulty preset dropdown collapsed view:
 * - Line 1: Digit range + operator + regrouping percentage
 * - Line 2: Scaffolding summary (Always: X, Y / When needed: Z)
 *
 * @param config - The worksheet configuration
 * @returns Object with title (for prominent display) and scaffolding (for detail line)
 */
function generateWorksheetDescription(config: WorksheetConfig): {
  title: string;
  scaffolding: string;
} {
  // Line 1: Digit range + operator + regrouping percentage
  const parts: string[] = [];

  // Digit range (e.g., "2-digit" or "1–3 digit")
  const minDigits = config.digitRange?.min ?? 1;
  const maxDigits = config.digitRange?.max ?? 2;
  if (minDigits === maxDigits) {
    parts.push(`${minDigits}-digit`);
  } else {
    parts.push(`${minDigits}–${maxDigits} digit`);
  }

  // Operator
  if (config.operator === "addition") {
    parts.push("addition");
  } else if (config.operator === "subtraction") {
    parts.push("subtraction");
  } else {
    parts.push("mixed operations");
  }

  // Regrouping percentage (pAnyStart)
  const pAnyStart = (config as any).pAnyStart ?? 0.25;
  const regroupingPercent = Math.round(pAnyStart * 100);
  parts.push(`• ${regroupingPercent}% regrouping`);

  const title = parts.join(" ");

  // Line 2: Scaffolding summary (matches getScaffoldingSummary format)
  const alwaysItems: string[] = [];
  const conditionalItems: string[] = [];

  if (config.displayRules) {
    const rules = config.displayRules;
    const operator = config.operator;

    // Addition-specific scaffolds (skip for subtraction-only)
    if (operator !== "subtraction") {
      if (rules.carryBoxes === "always") alwaysItems.push("carry boxes");
      else if (rules.carryBoxes && rules.carryBoxes !== "never")
        conditionalItems.push("carry boxes");

      if (rules.tenFrames === "always") alwaysItems.push("ten-frames");
      else if (rules.tenFrames && rules.tenFrames !== "never")
        conditionalItems.push("ten-frames");
    }

    // Universal scaffolds
    if (rules.answerBoxes === "always") alwaysItems.push("answer boxes");
    else if (rules.answerBoxes && rules.answerBoxes !== "never")
      conditionalItems.push("answer boxes");

    if (rules.placeValueColors === "always")
      alwaysItems.push("place value colors");
    else if (rules.placeValueColors && rules.placeValueColors !== "never")
      conditionalItems.push("place value colors");

    // Subtraction-specific scaffolds (skip for addition-only)
    if (operator !== "addition") {
      if (rules.borrowNotation === "always")
        alwaysItems.push("borrow notation");
      else if (rules.borrowNotation && rules.borrowNotation !== "never")
        conditionalItems.push("borrow notation");

      if (rules.borrowingHints === "always")
        alwaysItems.push("borrowing hints");
      else if (rules.borrowingHints && rules.borrowingHints !== "never")
        conditionalItems.push("borrowing hints");
    }
  }

  // Build scaffolding summary string
  const scaffoldingParts: string[] = [];
  if (alwaysItems.length > 0) {
    scaffoldingParts.push(`Always: ${alwaysItems.join(", ")}`);
  }
  if (conditionalItems.length > 0) {
    scaffoldingParts.push(`When needed: ${conditionalItems.join(", ")}`);
  }

  const scaffolding =
    scaffoldingParts.length > 0
      ? scaffoldingParts.join(" • ")
      : "No scaffolding";

  return { title, scaffolding };
}

/**
 * Chunk array into pages of specified size
 */
function chunkProblems(
  problems: WorksheetProblem[],
  pageSize: number,
): WorksheetProblem[][] {
  const pages: WorksheetProblem[][] = [];
  for (let i = 0; i < problems.length; i += pageSize) {
    pages.push(problems.slice(i, i + pageSize));
  }
  return pages;
}

/**
 * Calculate maximum number of digits in any problem on this page
 * Returns max digits across all operands (handles both addition and subtraction)
 */
function calculateMaxDigits(problems: WorksheetProblem[]): number {
  let maxDigits = 1;
  for (const problem of problems) {
    if (problem.operator === "add") {
      const digitsA = problem.a.toString().length;
      const digitsB = problem.b.toString().length;
      const maxProblemDigits = Math.max(digitsA, digitsB);
      maxDigits = Math.max(maxDigits, maxProblemDigits);
    } else {
      // Subtraction
      const digitsMinuend = problem.minuend.toString().length;
      const digitsSubtrahend = problem.subtrahend.toString().length;
      const maxProblemDigits = Math.max(digitsMinuend, digitsSubtrahend);
      maxDigits = Math.max(maxDigits, maxProblemDigits);
    }
  }
  return maxDigits;
}

/**
 * Generate Typst source code for a single page
 * @param qrCodeSvg - Optional raw SVG string for QR code to embed
 * @param shareCode - Optional share code to display under QR code (e.g., "k7mP2qR")
 * @param domain - Optional domain name for branding (e.g., "abaci.one")
 */
function generatePageTypst(
  config: WorksheetConfig,
  pageProblems: WorksheetProblem[],
  problemOffset: number,
  rowsPerPage: number,
  qrCodeSvg?: string,
  shareCode?: string,
  domain?: string,
): string {
  // Calculate maximum digits for proper column layout
  const maxDigits = calculateMaxDigits(pageProblems);

  // Enrich problems with display options based on mode
  // All V4 modes (custom, mastery, manual) use displayRules for conditional scaffolding
  const enrichedProblems = pageProblems.map((p, index) => {
    // Analyze problem complexity for conditional display rules
    const meta =
      p.operator === "add"
        ? analyzeProblem(p.a, p.b)
        : analyzeSubtractionProblem(p.minuend, p.subtrahend);

    // Choose display rules based on operator (for mastery+mixed mode)
    let rulesForProblem = config.displayRules as any;

    if (config.mode === "mastery") {
      const masteryConfig = config as any;
      // If we have operator-specific rules (mastery+mixed), use them
      if (p.operator === "add" && masteryConfig.additionDisplayRules) {
        console.log(
          `[typstGenerator] Problem ${index}: Using additionDisplayRules for ${p.operator} problem`,
        );
        rulesForProblem = masteryConfig.additionDisplayRules;
      } else if (
        p.operator === "sub" &&
        masteryConfig.subtractionDisplayRules
      ) {
        console.log(
          `[typstGenerator] Problem ${index}: Using subtractionDisplayRules for ${p.operator} problem`,
        );
        rulesForProblem = masteryConfig.subtractionDisplayRules;
      } else {
        console.log(
          `[typstGenerator] Problem ${index}: Using global displayRules for ${p.operator} problem`,
        );
      }
    }

    console.log(`[typstGenerator] Problem ${index} display rules:`, {
      operator: p.operator,
      rulesForProblem,
    });

    const displayOptions = resolveDisplayForProblem(rulesForProblem, meta);

    console.log(
      `[typstGenerator] Problem ${index} resolved display options:`,
      displayOptions,
    );

    return {
      ...p,
      ...displayOptions, // Now includes showBorrowNotation and showBorrowingHints from resolved rules
    };
  });

  // Generate Typst problem data with per-problem display flags
  const problemsTypst = enrichedProblems
    .map((p) => {
      if (p.operator === "add") {
        return `  (operator: "+", a: ${p.a}, b: ${p.b}, showCarryBoxes: ${p.showCarryBoxes}, showAnswerBoxes: ${p.showAnswerBoxes}, showPlaceValueColors: ${p.showPlaceValueColors}, showTenFrames: ${p.showTenFrames}, showProblemNumbers: ${p.showProblemNumbers}, showCellBorder: ${p.showCellBorder}, showBorrowNotation: ${p.showBorrowNotation}, showBorrowingHints: ${p.showBorrowingHints}),`;
      } else {
        return `  (operator: "−", minuend: ${p.minuend}, subtrahend: ${p.subtrahend}, showCarryBoxes: ${p.showCarryBoxes}, showAnswerBoxes: ${p.showAnswerBoxes}, showPlaceValueColors: ${p.showPlaceValueColors}, showTenFrames: ${p.showTenFrames}, showProblemNumbers: ${p.showProblemNumbers}, showCellBorder: ${p.showCellBorder}, showBorrowNotation: ${p.showBorrowNotation}, showBorrowingHints: ${p.showBorrowingHints}),`;
      }
    })
    .join("\n");

  // Calculate actual number of rows on this page
  const actualRows = Math.ceil(pageProblems.length / config.cols);

  // Use smaller margins to maximize space
  const margin = 0.4;
  const contentWidth = config.page.wIn - margin * 2;
  const contentHeight = config.page.hIn - margin * 2;

  // Calculate grid spacing based on ACTUAL rows on this page
  const headerHeight = 0.35; // inches for header
  const availableHeight = contentHeight - headerHeight;
  const problemBoxHeight = availableHeight / actualRows;
  const problemBoxWidth = contentWidth / config.cols;

  // Calculate cell size assuming MAXIMUM possible embellishments
  // Check if ANY problem on this page might show ten-frames
  const anyProblemMayShowTenFrames = enrichedProblems.some(
    (p) => p.showTenFrames,
  );

  // Calculate cell size to fill the entire problem box
  // Base vertical stack: carry row + addend1 + addend2 + line + answer = 5 rows
  // With ten-frames: add 0.8 * cellSize row
  // Total with ten-frames: ~5.8 rows
  //
  // Horizontal constraint: maxDigits columns + 1 for + sign
  // Cell size must fit: (maxDigits + 1) * cellSize <= problemBoxWidth
  const maxCellSizeForWidth = problemBoxWidth / (maxDigits + 1);
  const maxCellSizeForHeight = anyProblemMayShowTenFrames
    ? problemBoxHeight / 6.0
    : problemBoxHeight / 4.5;

  // Use the smaller of width/height constraints
  const cellSize = Math.min(maxCellSizeForWidth, maxCellSizeForHeight);

  return String.raw`
// addition-worksheet-page.typ (auto-generated)

#set page(
  width: ${config.page.wIn}in,
  height: ${config.page.hIn}in,
  margin: ${margin}in,
  fill: white
)
#set text(size: ${config.fontSize}pt, font: "New Computer Modern Math")

// Single non-breakable block to ensure one page
#block(breakable: false)[

#let heavy-stroke = 0.8pt
// In V4, all modes use displayRules - check if tenFrames is set to "always"
#let show-ten-frames-for-all = ${config.displayRules.tenFrames === "always" ? "true" : "false"}

${generatePlaceValueColors()}

${generateTypstHelpers(cellSize)}

${generateProblemStackFunction(cellSize, maxDigits)}

${generateSubtractionProblemStackFunction(cellSize, maxDigits)}

#let problem-box(problem, index) = {
  // Extract per-problem display flags
  let grid-stroke = if problem.showCellBorder { (thickness: 1pt, dash: "dashed", paint: gray.darken(20%)) } else { none }

  box(
    inset: (top: 0pt, bottom: -${(cellSize / 3).toFixed(3)}in, left: 0pt, right: 0pt),
    width: ${problemBoxWidth}in,
    height: ${problemBoxHeight}in,
    stroke: grid-stroke
  )[
    // Problem number in top-left corner of the cell
    #if problem.showProblemNumbers and index != none {
      place(top + left, dx: 0.02in, dy: 0.02in)[
        #text(size: ${(cellSize * 72 * 0.4).toFixed(1)}pt, weight: "bold", font: "New Computer Modern Math")[\##(index + 1).]
      ]
    }
    #align(center + horizon)[
      #if problem.operator == "+" {
        problem-stack(
          problem.a, problem.b, index,
          problem.showCarryBoxes,
          problem.showAnswerBoxes,
          problem.showPlaceValueColors,
          problem.showTenFrames,
          false  // Don't show problem numbers here - shown at cell level
        )
      } else {
        subtraction-problem-stack(
          problem.minuend, problem.subtrahend, index,
          problem.showCarryBoxes,      // show-borrows (whether to show borrow boxes)
          problem.showAnswerBoxes,
          problem.showPlaceValueColors,
          problem.showTenFrames,
          false,  // Don't show problem numbers here - shown at cell level
          problem.showBorrowNotation,  // show-borrow-notation (scratch work boxes in minuend)
          problem.showBorrowingHints   // show-borrowing-hints (hints with arrows)
        )
      }
    ]
  ]
}

#let problems = (
${problemsTypst}
)

// Letterhead with worksheet description, student info, and QR code
${(() => {
  const description = generateWorksheetDescription(config);
  // Check if user specified a real name (not the default 'Student' placeholder)
  // Validation defaults empty names to 'Student', so we treat that as "no name specified"
  const hasName =
    config.name &&
    config.name.trim().length > 0 &&
    config.name.trim() !== "Student";
  const brandDomain = domain || "abaci.one";
  const breadcrumb = "Create › Worksheets";

  // When name is empty, description gets more prominence (larger font)
  const titleSize = hasName ? "0.7em" : "0.85em";
  const scaffoldSize = hasName ? "0.5em" : "0.6em";

  return `#box(
  width: 100%,
  stroke: (bottom: 1pt + gray),
  inset: (bottom: 2pt),
)[
  #grid(
    columns: (1fr, auto),
    column-gutter: 0.1in,
    align: (left + top, right + top),
    // Left side: Description, Name (if specified)
    [
      // Title line: digit range, operator, regrouping %
      #text(size: ${titleSize}, weight: "bold")[${description.title}] \\
      // Scaffolding summary
      #text(size: ${scaffoldSize}, fill: gray.darken(20%))[${description.scaffolding}]
      ${
        hasName
          ? ` \\
      // Name row (date moved to right side)
      #grid(
        columns: (auto, 1fr),
        column-gutter: 4pt,
        align: (left + horizon, left + horizon),
        text(size: 0.65em)[*Name:*],
        box(stroke: (bottom: 0.5pt + black))[#h(0.25em)${config.name}#h(1fr)]
      )`
          : ""
      }
    ],
    // Right side: Date + QR code, share code, domain, breadcrumb
    [
      ${
        qrCodeSvg
          ? `#align(right)[
        #stack(dir: ttb, spacing: 0pt, align(right)[
          // Date and QR code on same row, top-aligned
          #grid(
            columns: (auto, auto),
            column-gutter: 0.1in,
            align: (right + top, right + top),
            text(size: 0.6em)[*Date:* ${config.date}],
            image(bytes("${qrCodeSvg.replace(/"/g, '\\"').replace(/\n/g, "")}"), format: "svg", width: 0.5in, height: 0.5in)
          )
        ], align(right)[
          // Share code and domain/breadcrumb tightly packed
          #set par(leading: 0pt)
          #text(size: 5pt, font: "Courier New", fill: gray.darken(20%))[${shareCode || "PREVIEW"}] \\
          #text(size: 0.4em, fill: gray.darken(10%), weight: "medium")[${brandDomain}] #text(size: 0.35em, fill: gray)[${breadcrumb}]
        ])
      ]`
          : `#align(right)[
        #stack(dir: ttb, spacing: 1pt, align(right)[
          #text(size: 0.6em)[*Date:* ${config.date}]
        ], align(right)[
          #text(size: 0.5em, fill: gray.darken(10%), weight: "medium")[${brandDomain}]
        ], align(right)[
          #text(size: 0.4em, fill: gray)[${breadcrumb}]
        ])
      ]`
      }
    ]
  )
]`;
})()}
#v(-0.25in)

// Problem grid - exactly ${actualRows} rows × ${config.cols} columns
#grid(
  columns: ${config.cols},
  column-gutter: 0pt,
  row-gutter: 0pt,
  ..for r in range(0, ${actualRows}) {
    for c in range(0, ${config.cols}) {
      let idx = r * ${config.cols} + c
      if idx < problems.len() {
        (problem-box(problems.at(idx), ${problemOffset} + idx),)
      } else {
        (box(width: ${problemBoxWidth}in, height: ${problemBoxHeight}in),)
      }
    }
  }
)

] // End of constrained block
`;
}

/**
 * Calculate the answer for a problem
 */
function calculateAnswer(problem: WorksheetProblem): number {
  if (problem.operator === "add") {
    return problem.a + problem.b;
  } else {
    return problem.minuend - problem.subtrahend;
  }
}

/**
 * Format a problem as a string for the answer key
 * Example: "45 + 27 = 72" or "89 − 34 = 55"
 */
function formatProblemWithAnswer(
  problem: WorksheetProblem,
  index: number,
  showNumber: boolean,
): string {
  const answer = calculateAnswer(problem);
  if (problem.operator === "add") {
    const prefix = showNumber ? `*${index + 1}.* ` : "";
    return `${prefix}${problem.a} + ${problem.b} = *${answer}*`;
  } else {
    const prefix = showNumber ? `*${index + 1}.* ` : "";
    return `${prefix}${problem.minuend} − ${problem.subtrahend} = *${answer}*`;
  }
}

/**
 * Generate Typst source code for answer key page(s)
 * Displays problems with answers grouped by worksheet page
 * @param qrCodeSvg - Optional raw SVG string for QR code to embed
 * @param shareCode - Optional share code to display under QR code
 */
function generateAnswerKeyTypst(
  config: WorksheetConfig,
  problems: WorksheetProblem[],
  showProblemNumbers: boolean,
  qrCodeSvg?: string,
  shareCode?: string,
): string[] {
  const { problemsPerPage } = config;
  const worksheetPageCount = Math.ceil(problems.length / problemsPerPage);

  // Group problems by worksheet page
  const worksheetPages: WorksheetProblem[][] = [];
  for (let i = 0; i < problems.length; i += problemsPerPage) {
    worksheetPages.push(problems.slice(i, i + problemsPerPage));
  }

  // Generate answer sections for each worksheet page
  // Each section is wrapped in a non-breakable block to keep page answers together
  const generatePageSection = (
    pageProblems: WorksheetProblem[],
    worksheetPageNum: number,
    globalOffset: number,
  ): string => {
    const answers = pageProblems
      .map((problem, i) => {
        const globalIndex = globalOffset + i;
        return formatProblemWithAnswer(
          problem,
          globalIndex,
          showProblemNumbers,
        );
      })
      .join(" \\\n");

    // Only show page header if there are multiple worksheet pages
    // Wrap in block(breakable: false) to prevent splitting across columns/pages
    if (worksheetPageCount > 1) {
      return `#block(breakable: false)[
  #text(size: 10pt, weight: "bold")[Page ${worksheetPageNum}] \\
  ${answers}
]`;
    }
    return answers;
  };

  // Generate all page sections
  const allSections = worksheetPages.map((pageProblems, idx) =>
    generatePageSection(pageProblems, idx + 1, idx * problemsPerPage),
  );

  // Combine sections with spacing between page groups
  const combinedAnswers =
    worksheetPageCount > 1
      ? allSections.join("\n\n#v(0.5em)\n\n")
      : allSections[0];

  // For now, generate a single answer key page
  // TODO: If content exceeds page height, could split into multiple pages
  const pageTypst = String.raw`
// answer-key-page.typ (auto-generated)

#set page(
  width: ${config.page.wIn}in,
  height: ${config.page.hIn}in,
  margin: 0.5in,
  fill: white
)
#set text(size: 11pt, font: "New Computer Modern Math")

// Header - matches worksheet header format
#grid(
  columns: (1fr, 1fr),
  align: (left, right),
  text(size: 0.75em, weight: "bold")[${config.name}],
  text(size: 0.65em)[${config.date}]
)
#v(0.15in)
#align(center)[
  #text(size: 14pt, weight: "bold")[Answer Key]
]
#v(0.25in)

// Answers in 3 columns, grouped by worksheet page
#columns(3, gutter: 1.5em)[
  #set par(leading: 0.8em)
  ${combinedAnswers}
]

${
  qrCodeSvg
    ? `// QR code linking to shared worksheet with share code below
#place(bottom + left, dx: 0.1in, dy: -0.1in)[
  #stack(dir: ttb, spacing: 2pt, align(center)[#image(bytes("${qrCodeSvg.replace(/"/g, '\\"').replace(/\n/g, "")}"), format: "svg", width: 0.63in, height: 0.63in)], align(center)[#text(size: 7pt, font: "Courier New")[${shareCode || "PREVIEW"}]])
]`
    : ""
}
`;

  return [pageTypst];
}

/**
 * Extract share code from a share URL
 * @param shareUrl - Full URL like "https://abaci.one/worksheets/shared/k7mP2qR"
 * @returns The share code (e.g., "k7mP2qR") or undefined
 */
function extractShareCode(shareUrl?: string): string | undefined {
  if (!shareUrl) return undefined;
  // URL format: https://abaci.one/worksheets/shared/{shareCode}
  const match = shareUrl.match(/\/worksheets\/shared\/([a-zA-Z0-9]+)$/);
  return match ? match[1] : undefined;
}

/**
 * Generate Typst source code for the worksheet (returns array of page sources)
 * @param shareUrl - Optional share URL for QR code embedding (required if config.includeQRCode is true)
 * @param domain - Optional domain name for branding (defaults to extracting from shareUrl or "abaci.one")
 */
export async function generateTypstSource(
  config: WorksheetConfig,
  problems: WorksheetProblem[],
  shareUrl?: string,
  domain?: string,
): Promise<string[]> {
  // Use the problemsPerPage directly from config (primary state)
  const problemsPerPage = config.problemsPerPage;
  const rowsPerPage = problemsPerPage / config.cols;

  // Generate QR code if enabled and shareUrl is provided
  let qrCodeSvg: string | undefined;
  let shareCode: string | undefined;
  if (config.includeQRCode && shareUrl) {
    qrCodeSvg = await generateQRCodeSVG(shareUrl, 200); // Higher res for print quality
    shareCode = extractShareCode(shareUrl);
  }

  // Extract domain from shareUrl if not provided explicitly
  let brandDomain = domain;
  if (!brandDomain && shareUrl) {
    try {
      const url = new URL(shareUrl);
      brandDomain = url.hostname;
    } catch {
      // Invalid URL, use default
    }
  }

  // Chunk problems into discrete pages
  const pages = chunkProblems(problems, problemsPerPage);

  // Generate separate Typst source for each worksheet page
  const worksheetPages = pages.map((pageProblems, pageIndex) =>
    generatePageTypst(
      config,
      pageProblems,
      pageIndex * problemsPerPage,
      rowsPerPage,
      qrCodeSvg,
      shareCode,
      brandDomain,
    ),
  );

  // If answer key is requested, append answer key page(s)
  if (config.includeAnswerKey) {
    // Check if problem numbers are shown (from displayRules)
    const showProblemNumbers = config.displayRules?.problemNumbers !== "never";
    const answerKeyPages = generateAnswerKeyTypst(
      config,
      problems,
      showProblemNumbers,
      qrCodeSvg,
      shareCode,
    );
    return [...worksheetPages, ...answerKeyPages];
  }

  return worksheetPages;
}
