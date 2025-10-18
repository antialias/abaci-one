/**
 * Node.js TypeScript wrapper for Soroban Flashcard Generator
 * Calls Python functions via child_process
 */
interface FlashcardConfig {
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
declare class SorobanGenerator {
    private pythonPath;
    private generatorPath;
    private projectRoot;
    constructor(projectRoot?: string);
    private findPython;
    /**
     * Generate flashcards and return PDF as Buffer
     */
    generate(config: FlashcardConfig): Promise<Buffer>;
    /**
     * Generate flashcards and save to file
     */
    generateToFile(config: FlashcardConfig, outputPath: string): Promise<void>;
    /**
     * Generate flashcards and return as base64 string
     */
    generateBase64(config: FlashcardConfig): Promise<string>;
    private executePython;
    /**
     * Check if all dependencies are installed
     */
    checkDependencies(): Promise<{
        python: boolean;
        typst: boolean;
        qpdf: boolean;
    }>;
}
declare function expressExample(): Promise<void>;

export { type FlashcardConfig, SorobanGenerator, SorobanGenerator as default, expressExample };
