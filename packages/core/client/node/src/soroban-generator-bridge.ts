/**
 * TypeScript wrapper using python-shell for clean function interface
 * No CLI arguments - just function calls with objects
 */

import { PythonShell } from 'python-shell';
import * as path from 'path';

export interface FlashcardConfig {
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

export interface FlashcardResult {
  pdf: string;  // base64 encoded PDF or SVG content (depending on format)
  count: number;
  numbers: number[];
}

export class SorobanGenerator {
  private pythonShell: PythonShell | null = null;
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || path.join(__dirname, '../../');
  }

  /**
   * Initialize persistent Python process for better performance
   */
  async initialize(): Promise<void> {
    if (this.pythonShell) return;

    this.pythonShell = new PythonShell(
      path.join('src', 'bridge.py'),
      {
        mode: 'json',
        pythonPath: 'python3',
        pythonOptions: ['-u'], // Unbuffered
        scriptPath: this.projectRoot,
      }
    );
  }

  /**
   * Generate flashcards - clean function interface
   */
  async generate(config: FlashcardConfig): Promise<FlashcardResult> {
    // One-shot mode if not initialized
    if (!this.pythonShell) {
      return new Promise((resolve, reject) => {
        const shell = new PythonShell(
          path.join('src', 'bridge.py'),
          {
            mode: 'json',
            pythonPath: 'python3',
            scriptPath: this.projectRoot,
          }
        );

        shell.on('message', (message: any) => {
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message as FlashcardResult);
          }
        });

        shell.on('error', (err: any) => {
          reject(err);
        });

        shell.send(config);
        shell.end((err: any, code: any, signal: any) => {
          if (err) reject(err);
        });
      });
    }

    // Persistent mode
    return new Promise((resolve, reject) => {
      if (!this.pythonShell) {
        reject(new Error('Not initialized'));
        return;
      }

      const handler = (message: any) => {
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message as FlashcardResult);
        }
        this.pythonShell?.removeListener('message', handler);
      };

      this.pythonShell.on('message', handler);
      this.pythonShell.send(config);
    });
  }

  /**
   * Generate and return as Buffer
   */
  async generateBuffer(config: FlashcardConfig): Promise<Buffer> {
    const result = await this.generate(config);
    return Buffer.from(result.pdf, 'base64');
  }

  /**
   * Clean up Python process
   */
  async close(): Promise<void> {
    if (this.pythonShell) {
      this.pythonShell.end(() => {});
      this.pythonShell = null;
    }
  }
}

// Example usage - just like calling a regular TypeScript function
async function example() {
  const generator = new SorobanGenerator();
  
  // Just call it like a function!
  const result = await generator.generate({
    range: '0-99',
    cardsPerPage: 6,
    colorScheme: 'place-value',
    coloredNumerals: true,
    showCutMarks: true
  });
  
  // You get back a clean result object
  console.log(`Generated ${result.count} flashcards`);
  
  // Convert to Buffer if needed
  const pdfBuffer = Buffer.from(result.pdf, 'base64');
  
  // Or use persistent mode for better performance
  await generator.initialize();
  
  // Now calls are faster
  const result2 = await generator.generate({ range: '0-9' });
  const result3 = await generator.generate({ range: '10-19' });
  
  await generator.close();
}

// Express example - clean function calls
export function expressRoute(app: any) {
  const generator = new SorobanGenerator();

  app.post('/api/flashcards', async (req: any, res: any) => {
    try {
      // Just pass the config object directly!
      const result = await generator.generate(req.body);
      
      // Send back JSON or PDF
      if (req.query.format === 'json') {
        res.json(result);
      } else {
        const pdfBuffer = Buffer.from(result.pdf, 'base64');
        res.contentType('application/pdf');
        res.send(pdfBuffer);
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
}