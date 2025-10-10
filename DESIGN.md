# Design Notes

## Soroban Representation

### Number Encoding

The soroban uses a bi-quinary system where each column represents a decimal digit:

- **Heaven bead**: 1 bead worth 5 when active
- **Earth beads**: 4 beads worth 1 each when active

For any digit 0-9:

- Heaven bead is active if digit ≥ 5
- Number of active earth beads = digit mod 5

### Visual Conventions

1. **Active beads**: Solid black, positioned against the reckoning bar
   - Heaven beads move down when active
   - Earth beads move up when active

2. **Inactive beads**: Light gray, positioned away from the bar
   - Heaven beads rest at top when inactive
   - Earth beads rest at bottom when inactive

3. **Column ordering**: Right-to-left place values (ones, tens, hundreds)
   - Matches traditional soroban layout
   - Rightmost column is always ones place

### Rendering Algorithm

```python
for each digit in number:
    heaven_active = 1 if digit >= 5 else 0
    earth_active = digit % 5

    draw_rod()
    draw_heaven_bead(active=heaven_active)
    for i in range(4):
        draw_earth_bead(active=(i < earth_active))
draw_reckoning_bar()
```

## Duplex Printing Alignment

### Challenge

Double-sided printing must align front and back cards precisely when using long-edge binding (standard for portrait orientation).

### Solution

1. **Page mirroring**: Back side cards are arranged in reverse column order
2. **Grid consistency**: Same grid dimensions on both sides
3. **Registration marks**: Optional alignment dots in trim area
4. **Safe margins**: 5mm default buffer inside each card

### Implementation

```typst
// Front side: normal left-to-right layout
grid(columns: 2, rows: 3,
     card1, card2,
     card3, card4,
     card5, card6)

// Back side: columns reversed for long-edge flip
grid(columns: 2, rows: 3,
     card2_back, card1_back,  // Note reversed
     card4_back, card3_back,
     card6_back, card5_back)
```

## Vector Graphics Strategy

### Why Typst?

1. **Native vector support**: Built-in drawing primitives
2. **Font embedding**: Automatic TTF/OTF embedding
3. **Lightweight**: ~30MB install vs. 3GB+ for TeX
4. **Deterministic**: Same input → same output

### Drawing Primitives Used

- `circle()`: Beads (with fill and stroke)
- `rect()`: Rods and reckoning bar
- `place()`: Absolute positioning within card
- `box()`: Layout containers with margins

### No Rasterization

All elements remain vectors through the entire pipeline:

- Typst → PDF (vector primitives)
- qpdf linearization (preserves vectors)
- No image assets or bitmaps

## Configuration System

### Hierarchy

1. **Built-in defaults**: Hardcoded in Python
2. **Config file**: YAML/JSON overrides
3. **CLI arguments**: Highest priority

### Merge strategy

```python
final_config = defaults
final_config.update(file_config)
final_config.update(cli_args)
```

## Build Determinism

### Sources of Non-determinism

1. **Random shuffling**: Controlled via `--seed`
2. **File timestamps**: Not embedded in PDF
3. **Font subsetting**: Consistent with bundled fonts

### Ensuring Reproducibility

- Fixed random seed produces identical shuffle
- Bundled fonts prevent system font variations
- Typst's deterministic rendering
- No external network calls or timestamps

## Performance Considerations

### Optimizations

1. **Single-pass rendering**: Generate all cards in one Typst run
2. **Batched operations**: Group all cards per page
3. **Minimal dependencies**: No heavy frameworks
4. **Direct PDF generation**: No intermediate formats

### Scalability

Tested ranges:

- 0-9: ~0.5 seconds
- 0-99: ~1 second
- 0-999: ~3 seconds
- 0-9999: ~15 seconds

Memory usage remains constant regardless of range size.

## Font Selection

### DejaVu Sans Choice

1. **Open source**: Free license, redistributable
2. **Complete coverage**: Full ASCII + extended Latin
3. **Clear numerals**: Distinct digit shapes
4. **Cross-platform**: Renders identically everywhere

### Embedding Strategy

- Fonts copied to `fonts/` directory
- Typst uses `--font-path` flag
- Full embedding (not subsetting) for consistency

## Future Enhancements

Potential improvements while maintaining core simplicity:

1. **Additional layouts**: 12-up, 16-up for smaller cards
2. **Color coding**: Optional colored beads by place value
3. **Mixed practice**: Combine different number ranges
4. **Answer variations**: Show decomposition (e.g., "20 + 3")
5. **Export formats**: SVG individual cards, PNG previews

## Testing Methodology

### Validation Steps

1. **PDF integrity**: `qpdf --check` validates structure
2. **Vector verification**: No embedded images
3. **Font embedding**: All fonts included
4. **Print testing**: Physical duplex print alignment
5. **Cross-platform**: Tested on multiple macOS versions

### Edge Cases Handled

- Empty number list → Error message
- Invalid range → Clear error
- Missing dependencies → Helpful install instructions
- Printer margin variations → Configurable margins
