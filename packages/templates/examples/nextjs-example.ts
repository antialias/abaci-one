/**
 * Next.js TypeScript Example: Using @soroban/templates
 *
 * This example demonstrates how to integrate the templates package
 * into a Next.js API route with full TypeScript support.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getTemplatePath, FLASHCARDS_TEMPLATE, SINGLE_CARD_TEMPLATE } from '@soroban/templates';

// Type definitions for our API
interface SorobanGenerationRequest {
  number: number;
  template?: 'flashcards' | 'single-card';
  options?: {
    beadShape?: 'diamond' | 'circle' | 'square';
    colorScheme?: 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating';
    colorPalette?: 'default' | 'colorblind' | 'mnemonic' | 'grayscale' | 'nature';
    hideInactiveBeads?: boolean;
    showEmptyColumns?: boolean;
    scaleFactor?: number;
  };
}

interface SorobanGenerationResponse {
  success: boolean;
  data?: {
    number: number;
    templateUsed: string;
    generatedContent?: string;
    contentLength: number;
  };
  error?: string;
}

/**
 * Example API Route: Generate Soroban Content
 *
 * Usage:
 * POST /api/generate-soroban
 * {
 *   "number": 1234,
 *   "template": "flashcards",
 *   "options": {
 *     "colorScheme": "place-value",
 *     "beadShape": "diamond"
 *   }
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<SorobanGenerationResponse>> {
  try {
    const body: SorobanGenerationRequest = await request.json();
    const { number, template = 'flashcards', options = {} } = body;

    // Validate input
    if (typeof number !== 'number' || number < 0 || number > 99999) {
      return NextResponse.json({
        success: false,
        error: 'Number must be between 0 and 99999'
      }, { status: 400 });
    }

    // Get the appropriate template
    const templatePath = template === 'single-card'
      ? getTemplatePath('single-card.typ')
      : getTemplatePath('flashcards.typ');

    // Load template content
    const templateContent = fs.readFileSync(templatePath, 'utf-8');

    // Build Typst content with user options
    const typstContent = buildTypstContent(number, templateContent, options);

    // In a real implementation, you would:
    // 1. Pass this to a Typst compiler (typst.ts, python subprocess, etc.)
    // 2. Return the generated SVG, PDF, or PNG
    // 3. Handle caching and optimization

    return NextResponse.json({
      success: true,
      data: {
        number,
        templateUsed: templatePath,
        contentLength: typstContent.length,
        // generatedContent: typstContent // Uncomment for debugging
      }
    });

  } catch (error) {
    console.error('Soroban generation failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Helper function to build Typst content with options
 */
function buildTypstContent(
  number: number,
  template: string,
  options: SorobanGenerationRequest['options'] = {}
): string {
  const {
    beadShape = 'diamond',
    colorScheme = 'place-value',
    colorPalette = 'default',
    hideInactiveBeads = false,
    showEmptyColumns = false,
    scaleFactor = 1.0
  } = options;

  return `
${template}

#set page(width: 120pt, height: 160pt, margin: 0pt, fill: white)
#set text(font: "DejaVu Sans", size: 48pt, fallback: true)

#align(center + horizon)[
  #box(width: 114pt, height: 152pt)[
    #align(center + horizon)[
      #scale(x: ${scaleFactor * 100}%, y: ${scaleFactor * 100}%)[
        #draw-soroban(
          ${number},
          columns: auto,
          show-empty: ${showEmptyColumns},
          hide-inactive: ${hideInactiveBeads},
          bead-shape: "${beadShape}",
          color-scheme: "${colorScheme}",
          color-palette: "${colorPalette}",
          base-size: 1.0
        )
      ]
    ]
  ]
]
`;
}

/**
 * Example React Hook for using the API
 */
export function useSorobanGeneration() {
  const generateSoroban = async (
    request: SorobanGenerationRequest
  ): Promise<SorobanGenerationResponse> => {
    const response = await fetch('/api/generate-soroban', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    return response.json();
  };

  return { generateSoroban };
}

/**
 * Example React Component using the templates
 */
export function SorobanGenerator({ number }: { number: number }) {
  const [result, setResult] = useState<SorobanGenerationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { generateSoroban } = useSorobanGeneration();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await generateSoroban({
        number,
        template: 'flashcards',
        options: {
          colorScheme: 'place-value',
          beadShape: 'diamond'
        }
      });
      setResult(response);
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="soroban-generator">
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : `Generate Soroban for ${number}`}
      </button>

      {result && (
        <div className="result">
          {result.success ? (
            <div>
              ✅ Generated successfully!
              <div>Content length: {result.data?.contentLength} chars</div>
              <div>Template: {result.data?.templateUsed}</div>
            </div>
          ) : (
            <div>❌ Error: {result.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Advanced example: Template validation utility
 */
export class TemplateValidator {
  static async validateTemplates(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check if templates exist and are readable
      const flashcardsExists = fs.existsSync(FLASHCARDS_TEMPLATE);
      const singleCardExists = fs.existsSync(SINGLE_CARD_TEMPLATE);

      if (!flashcardsExists) {
        errors.push('Flashcards template not found');
      }

      if (!singleCardExists) {
        errors.push('Single card template not found');
      }

      // Check template content
      if (flashcardsExists) {
        const content = fs.readFileSync(FLASHCARDS_TEMPLATE, 'utf-8');
        if (!content.includes('draw-soroban')) {
          errors.push('Flashcards template missing draw-soroban function');
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }
}

/**
 * Example middleware for template validation
 */
export function templateValidationMiddleware() {
  return async (request: NextRequest) => {
    const validation = await TemplateValidator.validateTemplates();

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Template validation failed',
        details: validation.errors
      }, { status: 503 });
    }

    // Continue to the next handler
    return NextResponse.next();
  };
}

// Note: This is a TypeScript example file for reference.
// To use in a real Next.js project:
// 1. Install @soroban/templates: npm install @soroban/templates
// 2. Copy relevant parts to your API routes
// 3. Add proper React imports: import { useState } from 'react'
// 4. Integrate with your Typst compilation setup