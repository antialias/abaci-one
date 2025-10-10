# Installation Guide

## Quick Install (macOS)

```bash
# Using the Makefile
make install

# Then generate PDFs
make
```

## Manual Installation

### 1. Install Typst

Typst is the rendering engine that generates PDFs from templates.

#### Option A: Using Homebrew (Recommended)

```bash
brew install typst
```

#### Option B: Direct Download

1. Visit https://github.com/typst/typst/releases
2. Download the latest macOS binary
3. Extract and move to your PATH:

```bash
tar xzf typst-*.tar.gz
sudo mv typst /usr/local/bin/
```

#### Option C: Using Cargo (Rust)

```bash
cargo install typst-cli
```

### 2. Install qpdf (Optional but Recommended)

qpdf is used for PDF linearization and validation.

```bash
brew install qpdf
```

### 3. Install Python Dependencies

```bash
pip3 install -r requirements.txt
# Or directly:
pip3 install pyyaml
```

## Verify Installation

```bash
# Check all dependencies
which typst && echo "✓ Typst installed"
which qpdf && echo "✓ qpdf installed"
python3 -c "import yaml" && echo "✓ PyYAML installed"

# Run a test build
make test
```

## Troubleshooting

### "command not found: brew"

Install Homebrew first:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### "command not found: pip3"

Python 3 should be included with macOS. If not:

```bash
brew install python3
```

### "Permission denied" errors

Use sudo for system-wide installation:

```bash
sudo pip3 install pyyaml
```

Or use user installation:

```bash
pip3 install --user pyyaml
```

### Typst font errors

The bundled fonts should work automatically. If you see font errors:

1. Verify fonts exist: `ls fonts/*.ttf`
2. Explicitly specify font path: `python3 src/generate.py --font-path fonts/`

## Dependencies Summary

| Component | Required | Purpose             | Size                |
| --------- | -------- | ------------------- | ------------------- |
| Python 3  | Yes      | Script execution    | Included with macOS |
| Typst     | Yes      | PDF generation      | ~30MB               |
| PyYAML    | Yes      | Config file parsing | <1MB                |
| qpdf      | Optional | PDF optimization    | ~5MB                |

## Platform Support

This tool is designed for macOS but should work on:

- **macOS**: Full support (10.15+)
- **Linux**: Should work with same dependencies
- **Windows**: Requires WSL or manual adaptation

## Next Steps

After installation:

1. Run `make` to generate default flashcards
2. Check `out/flashcards.pdf` for output
3. Run `make samples` for more examples
4. Customize with your own configuration
