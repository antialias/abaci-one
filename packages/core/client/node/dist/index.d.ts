/**
 * Node.js TypeScript wrapper for Soroban Flashcard Generator
 * Calls Python functions via child_process
 */
interface FlashcardConfig$1 {
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
declare class SorobanGenerator$1 {
    private pythonPath;
    private generatorPath;
    private projectRoot;
    constructor(projectRoot?: string);
    private findPython;
    /**
     * Generate flashcards and return PDF as Buffer
     */
    generate(config: FlashcardConfig$1): Promise<Buffer>;
    /**
     * Generate flashcards and save to file
     */
    generateToFile(config: FlashcardConfig$1, outputPath: string): Promise<void>;
    /**
     * Generate flashcards and return as base64 string
     */
    generateBase64(config: FlashcardConfig$1): Promise<string>;
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

/**
 * TypeScript wrapper using python-shell for clean function interface
 * No CLI arguments - just function calls with objects
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
    format?: 'pdf' | 'svg';
    mode?: 'single-card' | 'flashcards';
    number?: number;
}
interface FlashcardResult {
    pdf: string;
    count: number;
    numbers: number[];
}
declare class SorobanGenerator {
    private pythonShell;
    private projectRoot;
    constructor(projectRoot?: string);
    /**
     * Initialize persistent Python process for better performance
     */
    initialize(): Promise<void>;
    /**
     * Generate flashcards - clean function interface
     */
    generate(config: FlashcardConfig): Promise<FlashcardResult>;
    /**
     * Generate and return as Buffer
     */
    generateBuffer(config: FlashcardConfig): Promise<Buffer>;
    /**
     * Clean up Python process
     */
    close(): Promise<void>;
}

export { FlashcardConfig as BridgeFlashcardConfig, FlashcardResult as BridgeFlashcardResult, FlashcardConfig$1 as FlashcardConfig, SorobanGenerator$1 as SorobanGenerator, SorobanGenerator as SorobanGeneratorBridge, SorobanGenerator$1 as default, expressExample };
