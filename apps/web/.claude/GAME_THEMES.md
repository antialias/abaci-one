# Game Theme Standardization

## Problem

Previously, each game manually specified `color`, `gradient`, and `borderColor` in their manifest. This led to:
- Inconsistent appearance across game cards
- No guidance on what colors/gradients to use
- Easy to choose saturated colors that don't match the pastel style
- Duplication and maintenance burden

## Solution

**Standard theme presets** in `/src/lib/arcade/game-themes.ts`

All games now use predefined color themes that ensure consistent, professional appearance.

## Usage

### 1. Import from the Game SDK

```typescript
import { defineGame, getGameTheme } from '@/lib/arcade/game-sdk'
import type { GameManifest } from '@/lib/arcade/game-sdk'
```

### 2. Use the Theme Spread Operator

```typescript
const manifest: GameManifest = {
  name: 'my-game',
  displayName: 'My Awesome Game',
  icon: '🎮',
  description: 'A fun game',
  longDescription: 'More details...',
  maxPlayers: 4,
  difficulty: 'Intermediate',
  chips: ['🎯 Feature 1', '⚡ Feature 2'],
  ...getGameTheme('blue'),  // ← Just add this!
  available: true,
}
```

That's it! The theme automatically provides:
- `color: 'blue'`
- `gradient: 'linear-gradient(135deg, #dbeafe, #bfdbfe)'`
- `borderColor: 'blue.200'`

## Available Themes

All themes use Tailwind's 100-200 color range for soft pastel appearance:

| Theme | Color Range | Use Case |
|-------|-------------|----------|
| `blue` | blue-100 to blue-200 | Memory, puzzle games |
| `purple` | purple-100 to purple-200 | Strategic, battle games |
| `green` | green-100 to green-200 | Growth, achievement games |
| `teal` | teal-100 to teal-200 | Creative, sorting games |
| `indigo` | indigo-100 to indigo-200 | Deep thinking games |
| `pink` | pink-100 to pink-200 | Fun, casual games |
| `orange` | orange-100 to orange-200 | Speed, energy games |
| `yellow` | yellow-100 to yellow-200 | Bright, happy games |
| `red` | red-100 to red-200 | Competition, challenge |
| `gray` | gray-100 to gray-200 | Neutral games |

## Examples

### Current Games

```typescript
// Memory Lightning - blue theme
...getGameTheme('blue')

// Matching Pairs Battle - purple theme
...getGameTheme('purple')

// Card Sorting Challenge - teal theme
...getGameTheme('teal')

// Speed Complement Race - blue theme
...getGameTheme('blue')
```

## Benefits

✅ **Consistency** - All games have the same professional pastel look
✅ **Simple** - One line instead of three properties
✅ **Maintainable** - Update all games by changing the theme definition
✅ **Discoverable** - TypeScript autocomplete shows available themes
✅ **No mistakes** - Can't accidentally use wrong color values

## Advanced Usage

If you need to inspect or customize a theme:

```typescript
import { GAME_THEMES } from '@/lib/arcade/game-sdk'
import type { GameTheme } from '@/lib/arcade/game-sdk'

// Access a specific theme
const blueTheme: GameTheme = GAME_THEMES.blue

// Use it
const manifest: GameManifest = {
  // ... other fields
  ...blueTheme,
  // Or customize:
  color: blueTheme.color,
  gradient: 'linear-gradient(135deg, #custom, #values)', // override
  borderColor: blueTheme.borderColor,
}
```

## Adding New Themes

To add a new theme, edit `/src/lib/arcade/game-themes.ts`:

```typescript
export const GAME_THEMES = {
  // ... existing themes
  mycolor: {
    color: 'mycolor',
    gradient: 'linear-gradient(135deg, #lighter, #darker)', // Use Tailwind 100-200
    borderColor: 'mycolor.200',
  },
} as const satisfies Record<string, GameTheme>
```

Then update the TypeScript type:
```typescript
export type GameThemeName = keyof typeof GAME_THEMES
```

## Migration Checklist

When creating a new game:

- [x] Import `getGameTheme` from `@/lib/arcade/game-sdk`
- [x] Use `...getGameTheme('theme-name')` in manifest
- [x] Remove manual `color`, `gradient`, `borderColor` properties
- [x] Choose a theme that matches your game's vibe

## Summary

**Old way** (error-prone, inconsistent):
```typescript
color: 'teal',
gradient: 'linear-gradient(135deg, #99f6e4, #5eead4)',  // Too saturated!
borderColor: 'teal.200',
```

**New way** (simple, consistent):
```typescript
...getGameTheme('teal')
```
