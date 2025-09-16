# 🧮 Soroban Templates Gallery

A simple, self-contained gallery for visualizing soroban template renderings with different configurations. Works like Storybook but requires no build process or complex setup.

## 🚀 Quick Start

### Option 1: Generate and View (Recommended)

```bash
# 1. Navigate to templates directory
cd packages/templates

# 2. Generate gallery examples
node generate-gallery.js

# 3. Open gallery in browser
open gallery.html
# Or manually: File > Open > gallery.html in any browser
```

### Option 2: View Template Only

```bash
# Just open the gallery HTML (with placeholder SVGs)
open gallery.html
```

## 📁 What You Get

```
packages/templates/
├── gallery.html          # Main gallery interface
├── generate-gallery.js   # SVG generation script
├── gallery/              # Generated SVG files
│   ├── basic-5.svg
│   ├── colorful-123.svg
│   ├── circles-42.svg
│   └── ...
└── GALLERY.md            # This file
```

## 🎨 Gallery Features

### 📊 **Example Showcase**
- **6 curated examples** with different numbers and configurations
- **Visual comparison** of bead shapes, color schemes, and scales
- **Configuration details** for each example
- **One-click generation** per example or all at once

### 🛠️ **Examples Included**
1. **Basic 5** - Simple single digit with default settings
2. **Colorful 123** - Place-value colors with diamond beads
3. **Circle Beads 42** - Circular beads with heaven-earth colors
4. **Large Scale 7** - Maximum scale for detail work
5. **Compact 999** - Hidden inactive beads for clean look
6. **Educational 1234** - Four digits with empty columns shown

### ✨ **Gallery Controls**
- **Generate All** - Create all examples at once
- **Clear All** - Reset gallery to initial state
- **Export Config** - Download configuration as JSON
- **Individual Generate** - Create specific examples

## 🔧 Technical Details

### **No Build Required**
- Pure HTML + vanilla JavaScript
- Works in any modern browser
- No TypeScript compilation needed
- No package dependencies

### **Typst Integration**
- Uses `typst` CLI for actual SVG generation
- Generates temporary `.typ` files with configurations
- Compiles to SVG format for web display
- Cleans up temporary files automatically

### **Self-Contained**
- Lives entirely in `packages/templates/`
- Uses existing template files (`flashcards.typ`)
- Generated SVGs stored in `gallery/` subdirectory
- Can be version controlled or ignored as needed

## 🎯 Usage Scenarios

### **Rapid Prototyping**
```bash
# Quickly test different configurations
node generate-gallery.js
open gallery.html
```

### **Documentation**
```bash
# Generate examples for README or docs
node generate-gallery.js
# Copy SVGs from gallery/ to documentation
```

### **Design Review**
```bash
# Share gallery.html with team for visual review
# No development environment needed on reviewer's machine
```

### **Configuration Testing**
1. Edit examples in `generate-gallery.js`
2. Add new configurations
3. Run generator to see results
4. Iterate on designs

## 🔄 Customizing Examples

Edit the `examples` array in `generate-gallery.js`:

```javascript
const examples = [
    {
        id: 'my-example',
        title: 'My Custom Example',
        description: 'Testing a specific configuration',
        number: 456,
        config: {
            bead_shape: 'circle',
            color_scheme: 'alternating',
            base_size: 1.5,
            hide_inactive: true,
            show_empty: false,
            columns: 'auto'
        }
    },
    // ... more examples
];
```

Then regenerate:
```bash
node generate-gallery.js
```

## 📋 Requirements

- **Node.js** (for running the generator script)
- **Typst CLI** (for SVG compilation)
- **Modern browser** (for viewing the gallery)

### Installing Typst

```bash
# macOS (Homebrew)
brew install typst

# Or download from: https://typst.app/download/
```

## 🚫 What This Isn't

- **Not a build tool** - No webpack, no compilation pipeline
- **Not a development server** - Static files only
- **Not a component library** - Focused on template visualization
- **Not production-ready** - For development and design work

## 💡 Tips

### **File Organization**
- Keep `gallery/` in `.gitignore` if SVGs are temporary
- Commit `gallery/` if you want to share generated examples
- Update examples in `generate-gallery.js` for consistency

### **Performance**
- Generator creates temporary files, then cleans up
- SVG files are optimized by Typst automatically
- Gallery loads SVGs as images for fast rendering

### **Sharing**
- Send `gallery.html` + `gallery/` folder to share gallery
- Or host on any static file server
- Works offline once generated

---

**Perfect for rapid soroban template iteration without complex tooling! 🧮✨**