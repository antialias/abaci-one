// src/soroban-flashcards.ts
var SorobanFlashcardClient = class {
  apiUrl;
  constructor(apiUrl = "http://localhost:8000") {
    this.apiUrl = apiUrl;
  }
  /**
   * Generate flashcards and return as base64 PDF
   */
  async generate(config) {
    const response = await fetch(`${this.apiUrl}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
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
          right: "0.5in"
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
        format: "base64"
      })
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
  async generateAndDownload(config, filename = "flashcards.pdf") {
    const result = await this.generate(config);
    const pdfBytes = atob(result.pdf);
    const byteArray = new Uint8Array(pdfBytes.length);
    for (let i = 0; i < pdfBytes.length; i++) {
      byteArray[i] = pdfBytes.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: "application/pdf" });
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
  async generateAndOpen(config) {
    const result = await this.generate(config);
    const pdfBytes = atob(result.pdf);
    const byteArray = new Uint8Array(pdfBytes.length);
    for (let i = 0; i < pdfBytes.length; i++) {
      byteArray[i] = pdfBytes.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }
  /**
   * Check API health
   */
  async health() {
    try {
      const response = await fetch(`${this.apiUrl}/health`);
      const data = await response.json();
      return data.status === "healthy";
    } catch {
      return false;
    }
  }
};
async function example() {
  const client = new SorobanFlashcardClient();
  await client.generateAndDownload({
    range: "0-99",
    cardsPerPage: 6,
    colorScheme: "place-value",
    coloredNumerals: true,
    showCutMarks: true
  });
  await client.generateAndDownload(
    {
      range: "0-100",
      step: 5,
      cardsPerPage: 6
    },
    "counting-by-5s.pdf"
  );
}
export {
  SorobanFlashcardClient,
  SorobanFlashcardClient as default,
  example
};
