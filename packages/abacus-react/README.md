# @soroban/abacus-react

A comprehensive React component for rendering interactive Soroban (Japanese abacus) visualizations with advanced customization and tutorial capabilities.

## Features

- 🎯 **Interactive beads** - Click to toggle or use directional gestures
- 🎨 **Complete visual customization** - Style every element individually
- 🎓 **Tutorial system** - Built-in overlay and guidance capabilities
- ⚡ **React Spring animations** - Smooth bead movements and transitions
- 📱 **Responsive scaling** - Configurable scale factor for different sizes
- 🌈 **Multiple color schemes** - Monochrome, place-value, alternating, heaven-earth
- 🔧 **Developer-friendly** - Comprehensive hooks and callback system
- 🎭 **Flexible shapes** - Diamond, square, or circle beads
- 🧩 **Framework-free SVG** - Complete control over rendering

## Installation

```bash
npm install @soroban/abacus-react
# or
pnpm add @soroban/abacus-react
# or
yarn add @soroban/abacus-react
```

## Basic Usage

```tsx
import { AbacusReact } from '@soroban/abacus-react';

function MyApp() {
  return (
    <AbacusReact
      value={123}
      columns={3}
      interactive={true}
      showNumbers={true}
      animated={true}
    />
  );
}
```

## Advanced Tutorial System

Build interactive educational experiences with precise bead targeting and overlay positioning:

```tsx
import { AbacusReact, BeadClickEvent } from '@soroban/abacus-react';

function TutorialExample() {
  const [step, setStep] = useState(0);
  const [beadRefs, setBeadRefs] = useState(new Map());

  const handleBeadClick = (event: BeadClickEvent) => {
    // Validate clicks against tutorial targets
    if (event.columnIndex === 0 && event.beadType === 'earth') {
      setStep(step + 1);
    }
  };

  const handleBeadRef = (bead: BeadConfig, element: SVGElement | null) => {
    // Collect references to individual beads for precise positioning
    const key = `${bead.columnIndex}-${bead.type}-${bead.position}`;
    if (element) {
      beadRefs.set(key, element);
    }
  };

  return (
    <AbacusReact
      value={123}
      columns={3}
      interactive={true}

      // Highlight specific beads
      highlightBeads={[
        { columnIndex: 0, beadType: 'earth', position: 0 }
      ]}

      // Custom styling for tutorial
      customStyles={{
        beads: {
          0: { // Column 0
            earth: {
              0: { fill: '#ff6b35', stroke: '#d63031', strokeWidth: 2 }
            }
          }
        }
      }}

      // Overlay system for tooltips and guidance
      overlays={[{
        id: 'tutorial-tip',
        type: 'tooltip',
        target: {
          type: 'bead',
          columnIndex: 0,
          beadType: 'earth',
          beadPosition: 0
        },
        content: <div>Click this bead!</div>,
        offset: { x: 0, y: -20 }
      }]}

      // Enhanced callbacks
      callbacks={{
        onBeadClick: handleBeadClick,
        onBeadRef: handleBeadRef
      }}
    />
  );
}
```

## Customization API

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
    },
    2: { // Ones column
      numerals: { color: '#9b59b6', fontWeight: 'bold' }
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

### Bead Reference System

Access individual bead DOM elements for advanced positioning:

```tsx
function AdvancedTutorial() {
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

### Overlay System

Inject custom UI elements positioned relative to abacus components:

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
        {/* CSS arrow pointing to target */}
        <div style={{
          position: 'absolute',
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          borderTop: '6px solid #333',
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent'
        }} />
      </div>
    ),
    offset: { x: 0, y: -30 },
    visible: true
  },

  {
    id: 'column-label',
    type: 'highlight',
    target: { type: 'column', columnIndex: 2 },
    content: <div>Ones column</div>,
    offset: { x: 0, y: -80 }
  },

  {
    id: 'coordinate-marker',
    type: 'custom',
    target: { type: 'coordinates', x: 100, y: 50 },
    content: <div>Custom position</div>
  }
];

<AbacusReact overlays={overlays} />
```

## Event Callbacks

### Enhanced Bead Events

Get detailed information about every interaction:

```tsx
const handleBeadClick = (event: BeadClickEvent) => {
  console.log('Bead clicked:', {
    columnIndex: event.columnIndex,    // 0, 1, 2...
    beadType: event.beadType,         // 'heaven' | 'earth'
    position: event.position,         // 0-3 for earth beads
    active: event.active,             // Current state
    value: event.value,               // Numeric value (1 or 5)
    bead: event.bead                  // Full bead config
  });

  // Tutorial validation example
  if (event.columnIndex === targetColumn && event.beadType === targetType) {
    advanceToNextStep();
  }
};

const callbacks = {
  onBeadClick: handleBeadClick,
  onBeadHover: (event) => showHoverTooltip(event),
  onBeadLeave: (event) => hideHoverTooltip(event),
  onValueChange: (newValue) => updateDisplay(newValue),
  onColumnClick: (columnIndex) => highlightColumn(columnIndex),
  onNumeralClick: (columnIndex, value) => editColumnValue(columnIndex, value),
  onBeadRef: (bead, element) => storeBeadReference(bead, element)
};

<AbacusReact callbacks={callbacks} />
```

## Configuration Options

### Display Configuration

```tsx
interface AbacusConfig {
  // Basic setup
  value?: number;                    // 0-99999, value to display
  columns?: number | 'auto';         // Number of columns or auto-calculate
  showEmptyColumns?: boolean;        // Show leading zero columns
  showNumbers?: boolean;             // Show place value numbers

  // Visual appearance
  beadShape?: 'diamond' | 'square' | 'circle';
  colorScheme?: 'monochrome' | 'place-value' | 'alternating' | 'heaven-earth';
  colorPalette?: 'default' | 'colorblind' | 'mnemonic' | 'grayscale' | 'nature';
  scaleFactor?: number;              // 0.5 - 3.0, size multiplier
  hideInactiveBeads?: boolean;       // Hide/show inactive beads

  // Interaction
  interactive?: boolean;             // Enable user interactions
  gestures?: boolean;               // Enable drag gestures
  animated?: boolean;               // Enable animations

  // Advanced customization
  customStyles?: AbacusCustomStyles; // Granular styling
  overlays?: AbacusOverlay[];       // UI overlays
  callbacks?: AbacusCallbacks;      // Event handlers

  // Tutorial features
  highlightColumns?: number[];       // Highlight specific columns
  highlightBeads?: BeadTarget[];    // Highlight specific beads
  disabledColumns?: number[];       // Disable interactions
  disabledBeads?: BeadTarget[];     // Disable specific beads
}
```

### Highlighting and Disabling

```tsx
// Highlight specific elements for tutorials
<AbacusReact
  highlightColumns={[0, 2]}         // Highlight hundreds and ones
  highlightBeads={[
    { columnIndex: 1, beadType: 'heaven' },
    { columnIndex: 0, beadType: 'earth', position: 2 }
  ]}

  disabledColumns={[2]}             // Disable ones column
  disabledBeads={[
    { columnIndex: 0, beadType: 'earth', position: 3 }
  ]}
/>
```

## Hooks

### useAbacusDimensions

Get exact sizing information for layout planning:

```tsx
import { useAbacusDimensions } from '@soroban/abacus-react';

function MyComponent() {
  const dimensions = useAbacusDimensions(3, 1.2); // 3 columns, 1.2x scale

  console.log('Abacus size:', {
    width: dimensions.width,           // Total width in pixels
    height: dimensions.height,         // Total height in pixels
    rodSpacing: dimensions.rodSpacing, // Distance between columns
    beadSize: dimensions.beadSize      // Individual bead size
  });

  return (
    <div style={{ width: dimensions.width, height: dimensions.height }}>
      <AbacusReact columns={3} scaleFactor={1.2} />
    </div>
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

## Educational Use Cases

### Interactive Math Lessons

```tsx
function MathLesson() {
  const [problem, setProblem] = useState({ a: 23, b: 45 });
  const [step, setStep] = useState('show-first');

  return (
    <div>
      <h3>Add {problem.a} + {problem.b}</h3>

      {step === 'show-first' && (
        <AbacusReact
          value={problem.a}
          overlays={[{
            id: 'instruction',
            target: { type: 'coordinates', x: 200, y: 20 },
            content: <div>This represents {problem.a}</div>
          }]}
        />
      )}

      {step === 'add-second' && (
        <AbacusReact
          value={problem.a}
          interactive={true}
          callbacks={{
            onValueChange: (value) => {
              if (value === problem.a + problem.b) {
                celebrate();
              }
            }
          }}
        />
      )}
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

## Contributing

Contributions welcome! Please see our contributing guidelines and feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details.