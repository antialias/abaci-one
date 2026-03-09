# Abacus Image API

Generate images of a Japanese soroban (abacus) representing any number.

**Base URL:** `https://abaci.one/api/abacus-image`

## Quick Start

```
# SVG of the number 42
https://abaci.one/api/abacus-image?value=42

# PNG of the number 123, 800px wide
https://abaci.one/api/abacus-image?value=123&format=png&width=800

# Minimal: just the active beads, no frame
https://abaci.one/api/abacus-image?value=7&compact=true&hideInactiveBeads=true

# Monochrome for e-ink displays
https://abaci.one/api/abacus-image?value=72&format=png&colorScheme=monochrome&width=600
```

## Endpoint

```
GET /api/abacus-image
```

Returns an image (SVG or PNG) of a soroban abacus displaying the given number.

## Parameters

All parameters are passed as query string parameters.

### Required

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | integer | The number to display. Range: 0–9,999,999,999. |

### Optional

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | `svg` or `png` | `svg` | Output image format. SVG is vector, PNG is rasterized. |
| `width` | integer (50–2000) | `400` | Output width in pixels. Only affects PNG; SVG scales naturally. |
| `columns` | integer (1–13) or `auto` | `auto` | Number of rods on the abacus. `auto` uses the minimum needed to represent the value. Set higher to add leading zero columns (e.g., `columns=4` for `value=42` shows `0042`). |
| `colorScheme` | string | `place-value` | How beads are colored. See Color Schemes below. |
| `colorPalette` | string | `default` | Which color palette to use with `place-value` scheme. Options: `default`, `pastel`, `vibrant`, `earth-tones`. |
| `beadShape` | string | `circle` | Bead shape: `circle`, `diamond`, or `square`. |
| `hideInactiveBeads` | boolean | `false` | When `true`, only active (pushed) beads are visible. |
| `compact` | boolean | `false` | When `true`, hides the frame, rods, and reckoning bar. Shows only beads. |
| `showNumbers` | boolean | `true` | When `true`, shows digit labels below each column. |

Boolean parameters accept `true`/`false` or `1`/`0`.

## Color Schemes

| Scheme | Description | Best for |
|--------|-------------|----------|
| `place-value` | Each column has a distinct color (ones=red, tens=amber, hundreds=green, etc.) | Color displays, educational use |
| `monochrome` | All beads are the same blue color | E-ink displays, printing, simple contexts |
| `heaven-earth` | Heaven beads (top, value=5) are blue; earth beads (bottom, value=1) are green | Teaching bead types |
| `alternating` | Columns alternate between two colors | Visual separation without place-value semantics |

## Response

### Success

- **SVG:** `Content-Type: image/svg+xml` — valid SVG XML string
- **PNG:** `Content-Type: image/png` — PNG image binary

Both include `Cache-Control: public, max-age=31536000, immutable` since the same parameters always produce the same image.

### Errors

Returns JSON with HTTP 400:

```json
{ "error": "Missing required parameter: value" }
```

## How a Soroban Works

A soroban has vertical rods divided by a horizontal bar (the "reckoning bar"):

- **Above the bar:** 1 heaven bead per rod, worth 5 when pushed down toward the bar
- **Below the bar:** 4 earth beads per rod, each worth 1 when pushed up toward the bar
- **Each rod** represents a place value: rightmost = ones, next = tens, etc.

To read a number, sum the active beads on each rod:
- Rod shows 7 → heaven bead active (5) + 2 earth beads active (2) = 7
- Rod shows 3 → heaven bead inactive (0) + 3 earth beads active (3) = 3

## Examples

| URL | Renders |
|-----|---------|
| `?value=0` | Empty abacus (1 rod, no active beads) |
| `?value=5` | Single rod with heaven bead active |
| `?value=9` | Single rod, heaven + 4 earth beads active |
| `?value=100` | Three rods, hundreds rod has 1 earth bead active |
| `?value=42&compact=true&hideInactiveBeads=true` | Just the active beads for 42, no frame |
| `?value=42&format=png&colorScheme=monochrome&width=200` | Small monochrome PNG |

## E-Ink Display Tips

For e-ink / low-color displays:
- Use `colorScheme=monochrome` for single-color beads
- Use `format=png` with an appropriate `width` for your display resolution
- `compact=true` removes the frame if you want a minimal look
- The default abacus has a light gray frame and white background — works well on white e-ink
- SVG has a transparent background; PNG has a white background via sharp rendering
