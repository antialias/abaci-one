# @soroban/templates - Usage Examples

This directory contains practical examples showing how to use the `@soroban/templates` package in different environments.

## 📁 Examples Overview

| File | Environment | Description |
|------|-------------|-------------|
| [`node-example.js`](./node-example.js) | Node.js | Basic Node.js usage with comprehensive examples |
| [`python-example.py`](./python-example.py) | Python | Python integration with CLI simulation |
| [`nextjs-example.ts`](./nextjs-example.ts) | TypeScript/Next.js | Full Next.js API route implementation |

## 🚀 Running the Examples

### Node.js Example

```bash
# From the templates directory
cd packages/templates
node examples/node-example.js
```

**What it demonstrates:**
- Direct template path access
- Dynamic path resolution
- Template content loading
- Simulated API usage
- Error handling
- Webpack-safe patterns

### Python Example

```bash
# From the templates directory
cd packages/templates
python3 examples/python-example.py
```

**What it demonstrates:**
- Template path access
- Template verification
- Content analysis
- CLI simulation
- Batch processing
- pathlib integration
- Error handling

### TypeScript/Next.js Example

The TypeScript example is a reference implementation showing:
- Complete Next.js API route setup
- TypeScript interfaces and types
- React hooks for frontend integration
- Template validation utilities
- Middleware patterns
- Error handling and validation

**To use in your project:**
1. Copy relevant parts to your Next.js API routes
2. Install the package: `npm install @soroban/templates`
3. Add proper imports and dependencies

## 🎯 Key Patterns Demonstrated

### 1. Safe Template Loading

```javascript
// Node.js - Always check file existence
const fs = require('fs');
const { FLASHCARDS_TEMPLATE } = require('@soroban/templates');

if (fs.existsSync(FLASHCARDS_TEMPLATE)) {
  const content = fs.readFileSync(FLASHCARDS_TEMPLATE, 'utf-8');
  // Use the content...
}
```

```python
# Python - Use pathlib for robust file handling
from pathlib import Path
from soroban_templates import FLASHCARDS_TEMPLATE

template_path = Path(FLASHCARDS_TEMPLATE)
if template_path.exists():
    content = template_path.read_text(encoding='utf-8')
    # Use the content...
```

### 2. Dynamic Path Resolution

```javascript
// For webpack compatibility
const { getTemplatePath } = require('@soroban/templates');

try {
  const path = getTemplatePath('flashcards.typ');
  // Use the path...
} catch (error) {
  console.error('Template not found:', error.message);
}
```

### 3. Template Content Integration

```typescript
// TypeScript - Building Typst content
function buildTypstContent(number: number, template: string): string {
  return `
${template}

#set page(width: 120pt, height: 160pt)
#draw-soroban(${number}, color-scheme: "place-value")
`;
}
```

## 🧪 Testing the Examples

All examples include built-in verification and error handling. They will:

- ✅ Verify template files exist
- ✅ Check template content integrity
- ✅ Test path resolution in different contexts
- ✅ Demonstrate error handling
- ✅ Show integration patterns

## 💡 Integration Tips

### For Web Applications (Next.js, Express, etc.)

1. **Use dynamic path resolution** with `getTemplatePath()` for webpack compatibility
2. **Cache template content** after first load for performance
3. **Validate templates** on application startup
4. **Handle errors gracefully** with meaningful error messages

### For CLI Applications

1. **Use direct paths** (`FLASHCARDS_TEMPLATE`, `SINGLE_CARD_TEMPLATE`)
2. **Verify templates** with `verify_templates()` before processing
3. **Use pathlib** (Python) or `path` module (Node.js) for robust file handling
4. **Implement batch processing** patterns for multiple files

### For Development

1. **Run the examples** to understand the API
2. **Check file paths** when debugging path resolution issues
3. **Use the test scripts** to verify package integrity
4. **Reference the TypeScript example** for type-safe integration

## 🔧 Troubleshooting

### Path Resolution Issues

If you encounter path resolution problems:

1. Check your current working directory: `console.log(process.cwd())`
2. Use `getTemplatePath()` instead of direct constants in webpack contexts
3. Verify templates exist: `fs.existsSync(FLASHCARDS_TEMPLATE)`

### Import Issues

For import problems:

```javascript
// Node.js/CommonJS
const templates = require('@soroban/templates');

// ES Modules/TypeScript
import { FLASHCARDS_TEMPLATE } from '@soroban/templates';

// Python
from soroban_templates import FLASHCARDS_TEMPLATE
```

### Webpack Issues

For webpack bundling problems:
- Always use `getTemplatePath()` in webpack contexts
- Never use `fs.readFileSync()` with direct paths in client code
- Handle template loading in API routes or server-side code only

---

**Need more help?** Check the main [README.md](../README.md) or run the test suite with `npm test`.