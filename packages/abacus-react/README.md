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

### Tutorial System

Educational guidance with tooltips

<img src="https://raw.githubusercontent.com/antialias/soroban-abacus-flashcards/main/packages/abacus-react/examples/tutorial-mode.svg" alt="Tutorial System">

```tsx
<AbacusReact
  value={42}
  columns={2}
  interactive={true}
  overlays={[{
    id: 'tip',
    type: 'tooltip',
    target: { type: 'bead', columnIndex: 0, beadType: 'earth', beadPosition: 1 },
    content: <div>Click this bead!</div>,
    offset: { x: 0, y: -30 }
  }]}
  callbacks={{
    onBeadClick: (event) => {
      if (event.columnIndex === 0 && event.beadType === 'earth' && event.position === 1) {
        console.log('Correct!');
      }
    }
  }}
/>
```

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

  // Interaction
  interactive?: boolean;             // Enable user interactions
  animated?: boolean;               // Enable animations
  gestures?: boolean;               // Enable drag gestures
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
  AbacusReact,
  AbacusConfig,
  BeadConfig,
  BeadClickEvent,
  AbacusCustomStyles,
  AbacusOverlay,
  AbacusCallbacks,
  useAbacusDimensions
} from '@soroban/abacus-react';

// All interfaces fully typed for excellent developer experience
```

## Contributing

Contributions welcome! Please see our contributing guidelines and feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details.
