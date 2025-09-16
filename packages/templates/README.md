# @soroban/templates

> Shared Typst templates for Soroban abacus flashcard generation

A clean, dual-interface package providing Typst templates for generating soroban abacus visualizations in both Node.js/TypeScript and Python environments.

## ⚡ Quick Start

**Get production-ready soroban templates in under 60 seconds:**

### 📦 Install

```bash
pnpm add @soroban/templates    # or npm install @soroban/templates
```

### 🟨 Node.js/TypeScript (Next.js, Express, etc.)

```typescript
import { FLASHCARDS_TEMPLATE, getTemplatePath } from '@soroban/templates';
import fs from 'fs';

// Method 1: Direct path (most common)
const template = fs.readFileSync(FLASHCARDS_TEMPLATE, 'utf-8');

// Method 2: Dynamic resolution (webpack-safe)
const templatePath = getTemplatePath('flashcards.typ');
const template = fs.readFileSync(templatePath, 'utf-8');

// Use with your Typst compiler...
// const svg = await typst.compile(template, { number: 1234 });
```

### 🐍 Python (CLI tools, scripts)

```python
from soroban_templates import FLASHCARDS_TEMPLATE, verify_templates

# Verify templates are ready
verify_templates()  # Throws if anything is wrong

# Load and use
with open(FLASHCARDS_TEMPLATE, 'r') as f:
    template = f.read()

# Use with Typst CLI...
# subprocess.run(['typst', 'compile', FLASHCARDS_TEMPLATE, 'output.pdf'])
```

**What you get:**
- ✅ `flashcards.typ` - Full-featured soroban template with `draw-soroban()` function
- ✅ `single-card.typ` - Optimized single card template
- ✅ Webpack compatibility (Next.js, Vite, etc.)
- ✅ Monorepo support (PNPM workspaces, uv)
- ✅ TypeScript definitions included

[Jump to examples →](#-usage-examples) • [See all features →](#-template-features)

## 📋 Template Features

### `flashcards.typ` - Full Featured Template

- **Core Function**: `draw-soroban(value, ...options)`
- **Bead Shapes**: `diamond`, `circle`, `square`
- **Color Schemes**: `monochrome`, `place-value`, `heaven-earth`, `alternating`
- **Color Palettes**: `default`, `colorblind`, `mnemonic`, `grayscale`, `nature`
- **Advanced Options**:
  - Hide inactive beads
  - Show empty columns
  - Custom column counts
  - Scale factors
  - Interactive bead annotations

### `single-card.typ` - Optimized Single Cards

- **Function**: `generate-single-card(number, side, ...options)`
- **Sides**: `front` (soroban), `back` (numeral)
- **PNG Export Ready**: Transparent backgrounds supported
- **Custom Dimensions**: Configurable width/height
- **Font Options**: Family, size, colored numerals

## 🔧 Installation & Setup

### Node.js Projects

1. **Add to package.json dependencies:**
```json
{
  "dependencies": {
    "@soroban/templates": "workspace:*"
  }
}
```

2. **Install via PNPM:**
```bash
pnpm install
```

### Python Projects

1. **With uv workspace:**
```bash
uv add --dev ../packages/templates
```

2. **Or add to pyproject.toml:**
```toml
[tool.uv.workspace]
members = ["packages/templates"]

[project]
dependencies = ["soroban-templates"]
```

## 🏗️ Architecture

```
packages/templates/
├── 📄 flashcards.typ       # Main Typst template
├── 📄 single-card.typ      # Single card Typst template
├── 🟨 index.js             # Node.js interface
├── 🔷 index.d.ts           # TypeScript definitions
├── 🐍 __init__.py          # Python interface
├── 📦 package.json         # Node.js package config
├── 🔧 pyproject.toml       # Python package config
├── 🧪 test.js              # Node.js tests
├── 🧪 test.py              # Python tests
└── 📚 README.md           # This file
```

## 💡 Usage Examples

### Next.js API Route

```typescript
// pages/api/generate-soroban.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTemplatePath } from '@soroban/templates';
import fs from 'fs';

export async function POST(request: NextRequest) {
  const { number } = await request.json();

  // Webpack-safe path resolution
  const templatePath = getTemplatePath('flashcards.typ');
  const template = fs.readFileSync(templatePath, 'utf-8');

  // Use with typst.ts or other Typst compiler
  // ... generate SVG/PNG

  return NextResponse.json({ success: true });
}
```

### Python CLI Script

```python
#!/usr/bin/env python3
from soroban_templates import FLASHCARDS_TEMPLATE
import subprocess

def generate_flashcard(number: int, output_path: str):
    \"\"\"Generate a flashcard using the shared template\"\"\"

    # Build typst command
    cmd = [
        'typst', 'compile',
        '--input', f'number={number}',
        FLASHCARDS_TEMPLATE,
        output_path
    ]

    subprocess.run(cmd, check=True)
    print(f"Generated flashcard for {number} -> {output_path}")

if __name__ == "__main__":
    generate_flashcard(1234, "output.pdf")
```

### React Component Integration

```typescript
// components/SorobanDisplay.tsx
import { useState, useEffect } from 'react';

export function SorobanDisplay({ number }: { number: number }) {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    // Call your API route that uses @soroban/templates
    fetch('/api/typst-svg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number })
    })
    .then(res => res.json())
    .then(data => setSvg(data.svg));
  }, [number]);

  return (
    <div dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
```

## 🧪 Testing

### Run All Tests

```bash
# Node.js tests
pnpm --filter @soroban/templates test:node

# Python tests
pnpm --filter @soroban/templates test:python

# Both
pnpm --filter @soroban/templates test
```

### Manual Testing

```bash
# Test Node.js interface
node -e "console.log(require('@soroban/templates'))"

# Test Python interface
python3 -c "from soroban_templates import *; print(FLASHCARDS_TEMPLATE)"
```

## 🔍 Troubleshooting

### Webpack Issues in Next.js

The package handles webpack static analysis automatically using dynamic path resolution. If you encounter issues:

```typescript
// Use the function export instead of direct paths
import { getTemplatePath } from '@soroban/templates';
const path = getTemplatePath('flashcards.typ'); // ✅ Works with webpack
```

### Python Import Issues

Ensure you're importing from the correct namespace:

```python
# ✅ Correct
from soroban_templates import FLASHCARDS_TEMPLATE

# ❌ Wrong
from packages.templates import FLASHCARDS_TEMPLATE
```

### Path Resolution Issues

The package automatically handles different environments:

- **Monorepo root**: `packages/templates/`
- **Web app context**: `../../packages/templates/`
- **Python context**: Absolute paths via `__file__`

## 📝 API Reference

### Node.js/TypeScript Exports

```typescript
interface TemplateExports {
  /** Absolute path to flashcards.typ template */
  FLASHCARDS_TEMPLATE: string;

  /** Absolute path to single-card.typ template */
  SINGLE_CARD_TEMPLATE: string;

  /** Dynamic path resolver - webpack safe */
  getTemplatePath(filename: string): string;
}
```

### Python Exports

```python
# Module: soroban_templates
FLASHCARDS_TEMPLATE: str    # Absolute path to flashcards.typ
SINGLE_CARD_TEMPLATE: str   # Absolute path to single-card.typ
```

## 🤝 Contributing

### Adding New Templates

1. Add `.typ` file to `packages/templates/`
2. Export path constant in `index.js` and `index.d.ts`
3. Export path constant in `__init__.py`
4. Add tests in `test.js` and `test.py`
5. Update this README

### Testing Changes

```bash
# Run comprehensive tests
pnpm --filter @soroban/templates test

# Test in web app context
curl http://localhost:3000/api/typst-template

# Test Python CLI integration
python3 -c "from soroban_templates import *; print('OK')"
```

## 📄 License

MIT License - Part of the Soroban Flashcards monorepo.

---

**Built for the Soroban Flashcards project** - Clean templates, clean interfaces, clean code. 🧮✨