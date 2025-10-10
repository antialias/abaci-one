/**
 * TypeScript client for Soroban Flashcard Generator API
 */

export interface FlashcardConfig {
  range: string;
  step?: number;
  cardsPerPage?: number;
  paperSize?: "us-letter" | "a4" | "a3" | "a5";
  orientation?: "portrait" | "landscape";
  margins?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  gutter?: string;
  shuffle?: boolean;
  seed?: number;
  showCutMarks?: boolean;
  showRegistration?: boolean;
  fontFamily?: string;
  fontSize?: string;
  columns?: string | number;
  showEmptyColumns?: boolean;
  hideInactiveBeads?: boolean;
  beadShape?: "diamond" | "circle" | "square";
  colorScheme?: "monochrome" | "place-value" | "heaven-earth" | "alternating";
  coloredNumerals?: boolean;
  scaleFactor?: number;
}

export interface FlashcardResponse {
  pdf: string; // base64 encoded PDF
  count: number;
  numbers: number[];
}

export class SorobanFlashcardClient {
  private apiUrl: string;

  constructor(apiUrl: string = "http://localhost:8000") {
    this.apiUrl = apiUrl;
  }

  /**
   * Generate flashcards and return as base64 PDF
   */
  async generate(config: FlashcardConfig): Promise<FlashcardResponse> {
    const response = await fetch(`${this.apiUrl}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: config.range,
        step: config.step ?? 1,
        cards_per_page: config.cardsPerPage ?? 6,
        paper_size: config.paperSize ?? "us-letter",
        orientation: config.orientation ?? "portrait",
        margins: config.margins ?? {
          top: "0.5in",
          bottom: "0.5in",
          left: "0.5in",
          right: "0.5in",
        },
        gutter: config.gutter ?? "5mm",
        shuffle: config.shuffle ?? false,
        seed: config.seed,
        show_cut_marks: config.showCutMarks ?? false,
        show_registration: config.showRegistration ?? false,
        font_family: config.fontFamily ?? "DejaVu Sans",
        font_size: config.fontSize ?? "48pt",
        columns: config.columns ?? "auto",
        show_empty_columns: config.showEmptyColumns ?? false,
        hide_inactive_beads: config.hideInactiveBeads ?? false,
        bead_shape: config.beadShape ?? "diamond",
        color_scheme: config.colorScheme ?? "monochrome",
        colored_numerals: config.coloredNumerals ?? false,
        scale_factor: config.scaleFactor ?? 0.9,
        format: "base64",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to generate flashcards");
    }

    return response.json();
  }

  /**
   * Generate flashcards and download as PDF file
   */
  async generateAndDownload(
    config: FlashcardConfig,
    filename: string = "flashcards.pdf",
  ): Promise<void> {
    const result = await this.generate(config);

    // Convert base64 to blob
    const pdfBytes = atob(result.pdf);
    const byteArray = new Uint8Array(pdfBytes.length);
    for (let i = 0; i < pdfBytes.length; i++) {
      byteArray[i] = pdfBytes.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: "application/pdf" });

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate flashcards and open in new tab
   */
  async generateAndOpen(config: FlashcardConfig): Promise<void> {
    const result = await this.generate(config);

    // Convert base64 to blob
    const pdfBytes = atob(result.pdf);
    const byteArray = new Uint8Array(pdfBytes.length);
    for (let i = 0; i < pdfBytes.length; i++) {
      byteArray[i] = pdfBytes.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: "application/pdf" });

    // Open in new tab
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  /**
   * Check API health
   */
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`);
      const data = await response.json();
      return data.status === "healthy";
    } catch {
      return false;
    }
  }
}

// Example usage function
export async function example() {
  const client = new SorobanFlashcardClient();

  // Generate and download flashcards for 0-99 with place-value coloring
  await client.generateAndDownload({
    range: "0-99",
    cardsPerPage: 6,
    colorScheme: "place-value",
    coloredNumerals: true,
    showCutMarks: true,
  });

  // Generate counting by 5s
  await client.generateAndDownload(
    {
      range: "0-100",
      step: 5,
      cardsPerPage: 6,
    },
    "counting-by-5s.pdf",
  );
}
