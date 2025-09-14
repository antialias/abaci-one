/**
 * Example TypeScript server using the Soroban generator
 * This shows how to call the PDF generation directly from TypeScript
 */

import express from 'express';
import { SorobanGenerator } from './soroban-generator';

const app = express();
app.use(express.json());

// Initialize the generator once
const generator = new SorobanGenerator();

// Direct usage - just call the function from TypeScript
app.post('/api/generate-pdf', async (req, res) => {
  try {
    // Call the generator directly from TypeScript
    const pdfBuffer = await generator.generate({
      range: req.body.range || '0-9',
      cardsPerPage: req.body.cardsPerPage || 6,
      colorScheme: req.body.colorScheme || 'monochrome',
      showCutMarks: req.body.showCutMarks || false,
      // ... other config options
    });

    // Send PDF directly to client
    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=flashcards.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Example: Generate specific sets programmatically
app.get('/api/presets/:preset', async (req, res) => {
  try {
    let config;
    
    switch (req.params.preset) {
      case 'basic':
        config = { range: '0-9' };
        break;
      case 'counting-by-5':
        config = { range: '0-100', step: 5 };
        break;
      case 'place-value':
        config = { 
          range: '0-999', 
          colorScheme: 'place-value' as const,
          coloredNumerals: true 
        };
        break;
      default:
        return res.status(404).json({ error: 'Unknown preset' });
    }

    // Direct function call from TypeScript
    const pdfBuffer = await generator.generate(config);
    
    res.contentType('application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simple usage in any async function
async function generateFlashcardsDirectly() {
  const generator = new SorobanGenerator();
  
  // Just call it like any TypeScript function
  const pdfBuffer = await generator.generate({
    range: '0-99',
    cardsPerPage: 6,
    colorScheme: 'place-value',
    coloredNumerals: true
  });
  
  // Now you have the PDF as a Buffer, use it however you want
  return pdfBuffer;
}

// Next.js API route example
export async function nextJsApiRoute(req: any, res: any) {
  const generator = new SorobanGenerator();
  
  // Direct call from TypeScript
  const pdf = await generator.generate(req.body);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdf);
}

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});