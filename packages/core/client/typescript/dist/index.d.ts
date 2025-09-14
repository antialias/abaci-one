/**
 * TypeScript client for Soroban Flashcard Generator API
 */
interface FlashcardConfig {
    range: string;
    step?: number;
    cardsPerPage?: number;
    paperSize?: 'us-letter' | 'a4' | 'a3' | 'a5';
    orientation?: 'portrait' | 'landscape';
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
    beadShape?: 'diamond' | 'circle' | 'square';
    colorScheme?: 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating';
    coloredNumerals?: boolean;
    scaleFactor?: number;
}
interface FlashcardResponse {
    pdf: string;
    count: number;
    numbers: number[];
}
declare class SorobanFlashcardClient {
    private apiUrl;
    constructor(apiUrl?: string);
    /**
     * Generate flashcards and return as base64 PDF
     */
    generate(config: FlashcardConfig): Promise<FlashcardResponse>;
    /**
     * Generate flashcards and download as PDF file
     */
    generateAndDownload(config: FlashcardConfig, filename?: string): Promise<void>;
    /**
     * Generate flashcards and open in new tab
     */
    generateAndOpen(config: FlashcardConfig): Promise<void>;
    /**
     * Check API health
     */
    health(): Promise<boolean>;
}
declare function example(): Promise<void>;

export { FlashcardConfig, FlashcardResponse, SorobanFlashcardClient, SorobanFlashcardClient as default, example };
