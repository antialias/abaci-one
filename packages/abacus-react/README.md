# @soroban/abacus-react

A comprehensive React component for rendering interactive Soroban (Japanese abacus) visualizations with advanced customization and tutorial capabilities.

## Features

- 🎯 **Interactive beads** - Click to toggle or use directional gestures
- 🎨 **Complete visual customization** - Style every element individually
- 📱 **Responsive scaling** - Configurable scale factor for different sizes
- 🌈 **Multiple color schemes** - Monochrome, place-value, alternating, heaven-earth
- 🎭 **Flexible shapes** - Diamond, square, or circle beads
- ⚡ **React Spring animations** - Smooth bead movements and transitions
- 🔧 **Developer-friendly** - Comprehensive hooks and callback system
- 🎓 **Tutorial system** - Built-in overlay and guidance capabilities
- 🧩 **Framework-free SVG** - Complete control over rendering
- ✨ **3D Enhancement** - Three levels of progressive 3D effects for immersive visuals

## Installation

```bash
npm install @soroban/abacus-react
# or
pnpm add @soroban/abacus-react
# or
yarn add @soroban/abacus-react
```

## Quick Start


### Basic Usage

Simple abacus showing a number

<img src="https://raw.githubusercontent.com/antialias/soroban-abacus-flashcards/main/packages/abacus-react/examples/basic-usage.svg" alt="Basic Usage">

```tsx
<AbacusReact
  value={123}
  columns={3}
  showNumbers={true}
  scaleFactor={1.0}
/>
```

### Interactive Mode

Clickable abacus with animations

<img src="https://raw.githubusercontent.com/antialias/soroban-abacus-flashcards/main/packages/abacus-react/examples/interactive.svg" alt="Interactive Mode">

```tsx
<AbacusReact
  value={456}
  columns={3}
  interactive={true}
  animated={true}
  showNumbers={true}
  callbacks={{
    onValueChange: (newValue) => console.log('New value:', newValue),
    onBeadClick: (event) => console.log('Bead clicked:', event)
  }}
/>
```

### Custom Styling

Personalized colors and highlights

<img src="https://raw.githubusercontent.com/antialias/soroban-abacus-flashcards/main/packages/abacus-react/examples/custom-styling.svg" alt="Custom Styling">

```tsx
<AbacusReact
  value={789}
  columns={3}
  colorScheme="place-value"
  beadShape="circle"
  customStyles={{
    heavenBeads: { fill: '#ff6b35' },
    earthBeads: { fill: '#3498db' },
    numerals: { color: '#2c3e50', fontWeight: 'bold' }
  }}
  highlightBeads={[
    { columnIndex: 1, beadType: 'heaven' }
  ]}
/>
```

### Theme Presets

Use pre-defined themes for quick styling:

```tsx
import { AbacusReact, ABACUS_THEMES } from '@soroban/abacus-react';

// Available themes: 'light', 'dark', 'trophy', 'translucent', 'solid', 'traditional'
<AbacusReact
  value={123}
  columns={3}
  customStyles={ABACUS_THEMES.dark}
/>

<AbacusReact
  value={456}
  columns={3}
  customStyles={ABACUS_THEMES.trophy}  // Golden frame for achievements
/>

<AbacusReact
  value={789}
  columns={3}
  customStyles={ABACUS_THEMES.traditional}  // Brown wooden appearance
/>
```

**Available Themes:**
- `light` - Solid white frame with subtle gray accents (best for light backgrounds)
- `dark` - Translucent white with subtle glow (best for dark backgrounds)
- `trophy` - Golden frame with warm tones (best for achievements/rewards)
- `translucent` - Nearly invisible frame (best for inline/minimal UI)
- `solid` - Black frame (best for high contrast/educational contexts)
- `traditional` - Brown wooden appearance (best for traditional soroban aesthetic)

### Compact/Inline Display

Create mini abacus displays for inline use:

```tsx
// Compact mode - automatically hides frame and optimizes spacing
<AbacusReact
  value={7}
  columns={1}
  compact={true}
  hideInactiveBeads={true}
  scaleFactor={0.7}
/>

// Or manually control frame visibility
<AbacusReact
  value={42}
  columns={2}
  frameVisible={false}  // Hide column posts and reckoning bar
/>
```

### Tutorial System

Educational guidance with tooltips and column highlighting

<img src="https://raw.githubusercontent.com/antialias/soroban-abacus-flashcards/main/packages/abacus-react/examples/tutorial-mode.svg" alt="Tutorial System">

```tsx
<AbacusReact
  value={42}
  columns={3}
  interactive={true}
  // Highlight the tens column with a label
  highlightColumns={[1]}  // Highlight column index 1 (tens)
  columnLabels={['ones', 'tens', 'hundreds']}  // Add labels to columns
  overlays={[{
    id: 'tip',
    type: 'tooltip',
    target: { type: 'bead', columnIndex: 1, beadType: 'earth', beadPosition: 1 },
    content: <div>Click this bead in the tens column!</div>,
    offset: { x: 0, y: -30 }
  }]}
  callbacks={{
    onBeadClick: (event) => {
      if (event.columnIndex === 1 && event.beadType === 'earth' && event.position === 1) {
        console.log('Correct! You clicked the tens column.');
      }
    }
  }}
/>
```

**Column Highlighting:**
- `highlightColumns` - Array of column indices to highlight (e.g., `[0, 2]` highlights first and third columns)
- `columnLabels` - Optional labels displayed above each column (indexed left to right)

## 3D Enhancement

Make the abacus feel tangible and satisfying with three progressive levels of 3D effects.

### Subtle Mode

Light depth shadows and perspective for subtle dimensionality.

```tsx
<AbacusReact
  value={12345}
  columns={5}
  enhanced3d="subtle"
  interactive
  animated
/>
```

### Realistic Mode

Material-based rendering with lighting effects and textures.

```tsx
<AbacusReact
  value={7890}
  columns={4}
  enhanced3d="realistic"
  material3d={{
    heavenBeads: 'glossy',   // 'glossy' | 'satin' | 'matte'
    earthBeads: 'satin',
    lighting: 'top-down',    // 'top-down' | 'ambient' | 'dramatic'
    woodGrain: true          // Add wood texture to frame
  }}
  interactive
  animated
/>
```

**Materials:**
- `glossy` - High shine with strong highlights
- `satin` - Balanced shine (default)
- `matte` - Subtle shading, no shine

**Lighting:**
- `top-down` - Balanced directional light from above
- `ambient` - Soft light from all directions
- `dramatic` - Strong directional light for high contrast

### Delightful Mode

Maximum satisfaction with enhanced physics and interactive effects.

```tsx
<AbacusReact
  value={8642}
  columns={4}
  enhanced3d="delightful"
  material3d={{
    heavenBeads: 'glossy',
    earthBeads: 'satin',
    lighting: 'dramatic',
    woodGrain: true
  }}
  physics3d={{
    hoverParallax: true      // Beads lift on hover with Z-depth
  }}
  interactive
  animated
  soundEnabled
/>
```

**Physics Options:**
- `hoverParallax` - Beads near mouse cursor lift up with depth perception

All 3D modes work with existing configurations and preserve exact geometry.

## Core API

### Basic Props

```tsx
interface AbacusConfig {
  // Display
  value?: number;                    // 0-99999, number to display
  columns?: number | 'auto';         // Number of columns or auto-calculate
  showNumbers?: boolean;             // Show place value numbers
  scaleFactor?: number;              // 0.5 - 3.0, size multiplier

  // Appearance
  beadShape?: 'diamond' | 'square' | 'circle';
  colorScheme?: 'monochrome' | 'place-value' | 'alternating' | 'heaven-earth';
  colorPalette?: 'default' | 'colorblind' | 'mnemonic' | 'grayscale' | 'nature';
  hideInactiveBeads?: boolean;       // Hide/show inactive beads

  // Layout & Frame
  frameVisible?: boolean;            // Show/hide column posts and reckoning bar
  compact?: boolean;                 // Compact layout (implies frameVisible=false)

  // Interaction
  interactive?: boolean;             // Enable user interactions
  animated?: boolean;               // Enable animations
  gestures?: boolean;               // Enable drag gestures

  // Tutorial Features
  highlightColumns?: number[];       // Highlight specific columns by index
  columnLabels?: string[];           // Optional labels for columns
}
```

### Event Callbacks

```tsx
interface AbacusCallbacks {
  onValueChange?: (newValue: number) => void;
  onBeadClick?: (event: BeadClickEvent) => void;
  onBeadHover?: (event: BeadClickEvent) => void;
  onBeadLeave?: (event: BeadClickEvent) => void;
  onColumnClick?: (columnIndex: number) => void;
  onNumeralClick?: (columnIndex: number, value: number) => void;
  onBeadRef?: (bead: BeadConfig, element: SVGElement | null) => void;
}

interface BeadClickEvent {
  columnIndex: number;              // 0, 1, 2...
  beadType: 'heaven' | 'earth';     // Type of bead
  position: number;                 // Position within type (0-3 for earth)
  active: boolean;                  // Current state
  value: number;                    // Numeric value (1 or 5)
  bead: BeadConfig;                 // Full bead configuration
}
```

## Advanced Customization

### Granular Styling

Target any visual element with precise control:

```tsx
const customStyles = {
  // Global defaults
  heavenBeads: { fill: '#ff6b35' },
  earthBeads: { fill: '#3498db' },
  activeBeads: { opacity: 1.0 },
  inactiveBeads: { opacity: 0.3 },

  // Column-specific overrides
  columns: {
    0: { // Hundreds column
      heavenBeads: { fill: '#e74c3c' },
      earthBeads: { fill: '#2ecc71' }
    }
  },

  // Individual bead targeting
  beads: {
    1: { // Middle column
      heaven: { fill: '#f39c12' },
      earth: {
        0: { fill: '#1abc9c' }, // First earth bead
        3: { fill: '#e67e22' }  // Fourth earth bead
      }
    }
  },

  // UI elements
  reckoningBar: { stroke: '#34495e', strokeWidth: 3 },
  columnPosts: { stroke: '#7f8c8d' },
  numerals: {
    color: '#2c3e50',
    fontSize: '14px',
    fontFamily: 'monospace'
  }
};

<AbacusReact customStyles={customStyles} />
```

### Tutorial and Overlay System

Create interactive educational experiences:

```tsx
const overlays = [
  {
    id: 'welcome-tooltip',
    type: 'tooltip',
    target: {
      type: 'bead',
      columnIndex: 0,
      beadType: 'earth',
      beadPosition: 0
    },
    content: (
      <div style={{
        background: '#333',
        color: 'white',
        padding: '8px',
        borderRadius: '4px'
      }}>
        Click me to start!
      </div>
    ),
    offset: { x: 0, y: -30 }
  }
];

<AbacusReact
  overlays={overlays}
  highlightBeads={[
    { columnIndex: 0, beadType: 'earth', position: 0 }
  ]}
  callbacks={{
    onBeadClick: (event) => {
      if (event.columnIndex === 0 && event.beadType === 'earth' && event.position === 0) {
        console.log('Tutorial step completed!');
      }
    }
  }}
/>
```

### Bead Reference System

Access individual bead DOM elements for advanced positioning:

```tsx
function AdvancedExample() {
  const beadRefs = useRef(new Map<string, SVGElement>());

  const handleBeadRef = (bead: BeadConfig, element: SVGElement | null) => {
    const key = `${bead.columnIndex}-${bead.type}-${bead.position}`;
    if (element) {
      beadRefs.current.set(key, element);

      // Now you can position tooltips, highlights, etc. precisely
      const rect = element.getBoundingClientRect();
      console.log(`Bead at column ${bead.columnIndex} is at:`, rect);
    }
  };

  return (
    <AbacusReact
      callbacks={{ onBeadRef: handleBeadRef }}
      // ... other props
    />
  );
}
```

## Hooks

### useAbacusDiff

Calculate bead differences between values for tutorials and animations:

```tsx
import { useAbacusDiff } from '@soroban/abacus-react';

function Tutorial() {
  const [currentValue, setCurrentValue] = useState(5);
  const targetValue = 15;

  // Get diff information: which beads need to move
  const diff = useAbacusDiff(currentValue, targetValue);

  return (
    <div>
      <p>{diff.summary}</p> {/* "add heaven bead in tens column, then..." */}
      <AbacusReact
        value={currentValue}
        stepBeadHighlights={diff.highlights}  // Highlight beads that need to change
        interactive
        onValueChange={setCurrentValue}
      />
      <p>Changes needed: {diff.changes.length}</p>
    </div>
  );
}
```

**Returns:**
- `changes` - Array of bead movements with direction and order
- `highlights` - Bead highlight data for stepBeadHighlights prop
- `hasChanges` - Boolean indicating if any changes needed
- `summary` - Human-readable description of changes (e.g., "add heaven bead in ones column")

### useAbacusState

Convert numbers to abacus bead states:

```tsx
import { useAbacusState } from '@soroban/abacus-react';

function BeadAnalyzer() {
  const value = 123;
  const state = useAbacusState(value);

  // Check bead positions
  const onesHasHeaven = state[0].heavenActive;  // false (3 < 5)
  const tensEarthCount = state[1].earthActive;  // 2 (20 = 2 tens)

  return <div>Ones column heaven bead: {onesHasHeaven ? 'active' : 'inactive'}</div>;
}
```

### useAbacusDimensions

Get exact sizing information for layout planning:

```tsx
import { useAbacusDimensions } from '@soroban/abacus-react';

function MyComponent() {
  const dimensions = useAbacusDimensions(3, 1.2); // 3 columns, 1.2x scale

  return (
    <div style={{ width: dimensions.width, height: dimensions.height }}>
      <AbacusReact columns={3} scaleFactor={1.2} />
    </div>
  );
}
```

## Utility Functions

Low-level functions for working with abacus states and calculations:

### numberToAbacusState

Convert a number to bead positions:

```tsx
import { numberToAbacusState } from '@soroban/abacus-react';

const state = numberToAbacusState(123, 5); // 5 columns
// Returns: {
//   0: { heavenActive: false, earthActive: 3 },  // ones = 3
//   1: { heavenActive: false, earthActive: 2 },  // tens = 2
//   2: { heavenActive: true, earthActive: 0 },   // hundreds = 1
//   ...
// }
```

### abacusStateToNumber

Convert bead positions back to a number:

```tsx
import { abacusStateToNumber } from '@soroban/abacus-react';

const state = {
  0: { heavenActive: false, earthActive: 3 },
  1: { heavenActive: false, earthActive: 2 },
  2: { heavenActive: true, earthActive: 0 }
};

const value = abacusStateToNumber(state); // 123
```

### calculateBeadDiff

Calculate the exact bead movements needed between two states:

```tsx
import { calculateBeadDiff, numberToAbacusState } from '@soroban/abacus-react';

const fromState = numberToAbacusState(5);
const toState = numberToAbacusState(15);
const diff = calculateBeadDiff(fromState, toState);

console.log(diff.summary); // "add heaven bead in tens column"
console.log(diff.changes);  // Detailed array of movements with order
```

### calculateBeadDiffFromValues

Convenience wrapper for calculating diff from numbers:

```tsx
import { calculateBeadDiffFromValues } from '@soroban/abacus-react';

const diff = calculateBeadDiffFromValues(42, 57);
// Equivalent to: calculateBeadDiff(numberToAbacusState(42), numberToAbacusState(57))
```

### validateAbacusValue

Check if a value is within the supported range:

```tsx
import { validateAbacusValue } from '@soroban/abacus-react';

const result = validateAbacusValue(123456, 5); // 5 columns max
console.log(result.isValid);  // false
console.log(result.error);    // "Value exceeds maximum for 5 columns (max: 99999)"
```

### areStatesEqual

Compare two abacus states:

```tsx
import { areStatesEqual, numberToAbacusState } from '@soroban/abacus-react';

const state1 = numberToAbacusState(123);
const state2 = numberToAbacusState(123);
const isEqual = areStatesEqual(state1, state2); // true
```

## Educational Use Cases

### Interactive Math Lessons

```tsx
function MathLesson() {
  const [problem, setProblem] = useState({ a: 23, b: 45 });
  const [step, setStep] = useState('show-first');

  return (
    <div>
      <h3>Add {problem.a} + {problem.b}</h3>

      <AbacusReact
        value={step === 'show-first' ? problem.a : 0}
        interactive={step === 'add-second'}
        callbacks={{
          onValueChange: (value) => {
            if (value === problem.a + problem.b) {
              celebrate();
            }
          }
        }}
      />
    </div>
  );
}
```

### Assessment Tools

```tsx
function AbacusQuiz() {
  const [answers, setAnswers] = useState([]);

  const checkAnswer = (event: BeadClickEvent) => {
    const isCorrect = validateBeadClick(event, expectedAnswer);
    recordAnswer(event, isCorrect);

    if (isCorrect) {
      showSuccessFeedback();
    } else {
      showHint(event);
    }
  };

  return (
    <AbacusReact
      interactive={true}
      callbacks={{ onBeadClick: checkAnswer }}
      customStyles={getAnswerHighlighting(answers)}
    />
  );
}
```

## TypeScript Support

Full TypeScript definitions included:

```tsx
import {
  // Components
  AbacusReact,

  // Hooks
  useAbacusDiff,
  useAbacusState,
  useAbacusDimensions,

  // Utility Functions
  numberToAbacusState,
  abacusStateToNumber,
  calculateBeadDiff,
  calculateBeadDiffFromValues,
  validateAbacusValue,
  areStatesEqual,

  // Theme Presets
  ABACUS_THEMES,

  // Types
  AbacusConfig,
  BeadConfig,
  BeadClickEvent,
  AbacusCustomStyles,
  AbacusOverlay,
  AbacusCallbacks,
  AbacusState,
  BeadState,
  BeadDiffResult,
  BeadDiffOutput,
  AbacusThemeName
} from '@soroban/abacus-react';

// All interfaces fully typed for excellent developer experience
```

## Contributing

Contributions welcome! Please see our contributing guidelines and feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details.
