# Soroban Flashcard Generator - Node.js API Documentation

## Installation

```bash
npm install python-shell
```

## Basic Usage

```typescript
import { SorobanGenerator } from './soroban-generator-bridge';

const generator = new SorobanGenerator();
const result = await generator.generate({
  range: '0-99',
  cardsPerPage: 6
});
```

## API Reference

### `SorobanGenerator`

The main class for generating flashcards from Node.js/TypeScript.

#### Constructor

```typescript
new SorobanGenerator(projectRoot?: string)
```

- `projectRoot` (optional): Path to the soroban-abacus-flashcards directory. Defaults to `../../` from the module location.

#### Methods

##### `generate(config: FlashcardConfig): Promise<FlashcardResult>`

Generate flashcards with the specified configuration.

**Parameters:**
- `config`: Configuration object (see FlashcardConfig below)

**Returns:** Promise resolving to:
```typescript
{
  pdf: string;      // Base64 encoded PDF
  count: number;    // Number of flashcards generated
  numbers: number[]; // Array of numbers (limited to first 100)
}
```

##### `generateBuffer(config: FlashcardConfig): Promise<Buffer>`

Generate flashcards and return as Node.js Buffer.

**Parameters:**
- `config`: Configuration object

**Returns:** Promise resolving to Buffer containing PDF data

##### `initialize(): Promise<void>`

Initialize a persistent Python process for better performance when generating multiple PDFs.

##### `close(): Promise<void>`

Clean up the persistent Python process.

### Configuration Interface

```typescript
interface FlashcardConfig {
  // Required
  range: string;              // e.g., "0-99" or "1,2,5,10"
  
  // Optional
  step?: number;              // Increment (default: 1)
  cardsPerPage?: number;      // 1-30+ (default: 6)
  paperSize?: 'us-letter' | 'a4' | 'a3' | 'a5';
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top?: string;           // e.g., "0.5in"
    bottom?: string;
    left?: string;
    right?: string;
  };
  gutter?: string;           // Space between cards (default: "5mm")
  shuffle?: boolean;         // Randomize order
  seed?: number;             // Random seed for deterministic shuffle
  showCutMarks?: boolean;    // Show cutting guides
  showRegistration?: boolean; // Show alignment marks
  fontFamily?: string;       // Font name (default: "DejaVu Sans")
  fontSize?: string;         // Font size (default: "48pt")
  columns?: string | number; // "auto" or specific number
  showEmptyColumns?: boolean;
  hideInactiveBeads?: boolean;
  beadShape?: 'diamond' | 'circle' | 'square';
  colorScheme?: 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating';
  coloredNumerals?: boolean; // Color numerals to match beads
  scaleFactor?: number;      // 0.1 to 1.0 (default: 0.9)
}
```

## Examples

### Basic Generation

```typescript
const generator = new SorobanGenerator();

// Simple 0-9 flashcards
const result = await generator.generate({
  range: '0-9'
});
```

### Skip Counting

```typescript
// Count by 5s from 0 to 100
const result = await generator.generate({
  range: '0-100',
  step: 5,
  cardsPerPage: 12
});
```

### Educational Colors

```typescript
// Place-value coloring for learning
const result = await generator.generate({
  range: '0-999',
  colorScheme: 'place-value',
  coloredNumerals: true,
  showCutMarks: true
});
```

### Express.js Route

```typescript
app.post('/api/flashcards', async (req, res) => {
  try {
    const generator = new SorobanGenerator();
    const config = {
      range: req.body.range || '0-9',
      cardsPerPage: req.body.cardsPerPage || 6,
      colorScheme: req.body.colorScheme || 'monochrome',
      ...req.body
    };
    
    const result = await generator.generate(config);
    
    if (req.query.format === 'json') {
      // Return metadata
      res.json({
        count: result.count,
        numbers: result.numbers
      });
    } else {
      // Return PDF
      const pdfBuffer = Buffer.from(result.pdf, 'base64');
      res.contentType('application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=flashcards.pdf');
      res.send(pdfBuffer);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Next.js API Route

```typescript
// pages/api/flashcards.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { SorobanGenerator } from '@/lib/soroban-generator-bridge';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const generator = new SorobanGenerator();
    const result = await generator.generate(req.body);
    const pdfBuffer = Buffer.from(result.pdf, 'base64');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=flashcards.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### Performance Optimization

For generating multiple PDFs, use persistent mode:

```typescript
const generator = new SorobanGenerator();

// Initialize once
await generator.initialize();

// Generate multiple PDFs quickly
for (const config of configs) {
  const result = await generator.generate(config);
  // Process result...
}

// Clean up when done
await generator.close();
```

## Requirements

- Node.js 14+
- Python 3.8+
- Typst (installed via `brew install typst`)
- qpdf (optional, for PDF optimization)

## Error Handling

The generator will throw errors for:
- Missing Python installation
- Missing Typst installation
- Invalid configuration
- Typst compilation errors

Always wrap calls in try/catch blocks:

```typescript
try {
  const result = await generator.generate(config);
} catch (error) {
  console.error('Generation failed:', error.message);
}
```

## TypeScript Types

All interfaces and types are included in the module. Import them as needed:

```typescript
import { 
  SorobanGenerator,
  FlashcardConfig,
  FlashcardResult 
} from './soroban-generator-bridge';
```