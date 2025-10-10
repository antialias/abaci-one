# AbacusReact Component

A complete React component for rendering interactive Soroban (Japanese abacus) SVGs with animations, drag interactions, and comprehensive configuration options.

## Features

- 🎨 **Framework-free SVG rendering** - Complete control over all elements and viewBox
- 🎯 **Interactive beads** - Click to toggle or drag with @use-gesture/react
- 🌈 **Multiple color schemes** - Monochrome, place-value, alternating, heaven-earth
- 🎭 **Bead shapes** - Diamond, square, or circle beads
- ⚡ **React Spring animations** - Smooth bead movements and transitions
- 🔧 **Hooks interface** - Size calculation and state management hooks
- 📱 **Responsive scaling** - Configurable scale factor for different sizes
- ♿ **Accessibility** - Colorblind-friendly palettes and semantic interactions

## Installation

```bash
# Required peer dependencies
npm install react @react-spring/web @use-gesture/react

# For TypeScript projects
npm install --save-dev @types/react typescript
```

## Basic Usage

```tsx
import { AbacusReact } from "./AbacusReact";

function MyComponent() {
  return <AbacusReact value={123} />;
}
```

## Advanced Usage with Hooks

```tsx
import {
  AbacusReact,
  useAbacusState,
  useAbacusDimensions,
} from "./AbacusReact";

function InteractiveAbacus() {
  const { value, setValue, toggleBead } = useAbacusState(0);
  const dimensions = useAbacusDimensions(4, 1.2);

  return (
    <div style={{ width: dimensions.width, height: dimensions.height }}>
      <AbacusReact
        value={value}
        columns={4}
        animated={true}
        draggable={true}
        colorScheme="place-value"
        colorPalette="colorblind"
        onValueChange={setValue}
        onClick={(bead) => toggleBead(bead, 4)}
      />
    </div>
  );
}
```

## API Reference

### AbacusReact Props

| Prop                | Type                                                                 | Default        | Description                         |
| ------------------- | -------------------------------------------------------------------- | -------------- | ----------------------------------- |
| `value`             | `number`                                                             | `0`            | The numeric value to display        |
| `columns`           | `number \| 'auto'`                                                   | `'auto'`       | Number of columns or auto-calculate |
| `showEmptyColumns`  | `boolean`                                                            | `false`        | Show leading zero columns           |
| `hideInactiveBeads` | `boolean`                                                            | `false`        | Hide inactive beads completely      |
| `beadShape`         | `'diamond' \| 'square' \| 'circle'`                                  | `'diamond'`    | Shape of the beads                  |
| `colorScheme`       | `'monochrome' \| 'place-value' \| 'alternating' \| 'heaven-earth'`   | `'monochrome'` | Color scheme strategy               |
| `colorPalette`      | `'default' \| 'colorblind' \| 'mnemonic' \| 'grayscale' \| 'nature'` | `'default'`    | Color palette for place values      |
| `scaleFactor`       | `number`                                                             | `1`            | Scale multiplier for size           |
| `animated`          | `boolean`                                                            | `true`         | Enable react-spring animations      |
| `draggable`         | `boolean`                                                            | `false`        | Enable drag interactions            |
| `onClick`           | `(bead: BeadConfig) => void`                                         | `undefined`    | Bead click handler                  |
| `onValueChange`     | `(newValue: number) => void`                                         | `undefined`    | Value change handler                |

### Hooks

#### `useAbacusDimensions(columns: number, scaleFactor?: number)`

Calculate component dimensions for layout planning.

**Returns:**

```tsx
{
  width: number; // Total component width
  height: number; // Total component height
  rodSpacing: number; // Distance between rods
  beadSize: number; // Size of individual beads
}
```

#### `useAbacusState(initialValue?: number)`

Manage abacus state with proper bead logic.

**Returns:**

```tsx
{
  value: number;                                    // Current numeric value
  setValue: (value: number) => void;                // Set new value
  getColumnValue: (columnIndex: number, totalColumns: number) => number;  // Get value for specific column
  setColumnValue: (columnIndex: number, totalColumns: number, newValue: number) => void;  // Set column value
  toggleBead: (bead: BeadConfig, totalColumns: number) => void;  // Toggle individual bead
}
```

### Types

#### `BeadConfig`

```tsx
interface BeadConfig {
  type: "heaven" | "earth"; // Bead type (heaven=5, earth=1)
  value: number; // Numeric value of this bead
  active: boolean; // Whether bead is active
  position: number; // Position within its type group
  columnIndex: number; // Column index (0-based)
}
```

#### `AbacusDimensions`

```tsx
interface AbacusDimensions {
  width: number;
  height: number;
  rodSpacing: number;
  beadSize: number;
}
```

## Color Schemes

### `monochrome`

All beads are black when active, gray when inactive.

### `place-value`

Colors based on place value (ones, tens, hundreds, etc.) using the selected palette.

### `alternating`

Alternates between two colors for adjacent columns.

### `heaven-earth`

Different colors for heaven beads (red) vs earth beads (blue).

## Color Palettes

- **`default`**: Balanced, professional colors
- **`colorblind`**: High contrast, colorblind-friendly
- **`mnemonic`**: Memory-aid colors with meaningful associations
- **`grayscale`**: Monochrome shades for printing
- **`nature`**: Earth-tone inspired palette

## Abacus Logic

### Soroban Structure

- **Heaven beads**: 1 per column, represents value 5
- **Earth beads**: 4 per column, each represents value 1
- **Total per column**: 0-9 (0-4 earth beads + 0-1 heaven bead)

### Interaction Behavior

#### Click Interactions

- **Heaven bead**: Toggles between 0 and 5
- **Earth bead**: Activates/deactivates this bead and all lower-positioned earth beads

#### Drag Interactions (when enabled)

- Beads can be dragged but snap back to original positions
- Useful for tactile interaction without changing values
- Can be extended to implement custom drag-to-value logic

## Performance Considerations

- **SVG Rendering**: Uses native SVG for optimal performance
- **Animation**: React Spring provides hardware-accelerated animations
- **Memoization**: Component automatically memoizes expensive calculations
- **Event Handling**: Optimized click and drag event handling

## Browser Support

- Modern browsers with SVG and ES6+ support
- React 18+ required
- CSS transforms for animations

## Examples

See `AbacusExample.tsx` for a comprehensive demo with all configuration options.

### Simple Display

```tsx
<AbacusReact value={42} />
```

### Educational Mode

```tsx
<AbacusReact
  value={123}
  colorScheme="place-value"
  colorPalette="mnemonic"
  beadShape="circle"
  showEmptyColumns={true}
/>
```

### Interactive Game

```tsx
<AbacusReact
  value={gameValue}
  animated={true}
  draggable={false}
  onClick={(bead) => handleBeadClick(bead)}
  onValueChange={(newValue) => setGameValue(newValue)}
/>
```

### Large Display

```tsx
<AbacusReact
  value={5678}
  scaleFactor={2}
  beadShape="diamond"
  colorScheme="alternating"
  hideInactiveBeads={true}
/>
```

## Development

The component is written in TypeScript and includes comprehensive type definitions. It follows React best practices and is designed for easy integration into existing projects.

### Architecture

- **Pure functional components** with hooks
- **Immutable state management**
- **Separation of concerns** between display and interaction logic
- **Configurable rendering pipeline**

### Testing

Test the component with the interactive example:

```bash
# In your React project
npm install @react-spring/web @use-gesture/react
# Copy AbacusReact.tsx and AbacusExample.tsx
# Import and use AbacusExample in your app
```
