# @soroban/abacus-react

A comprehensive React component for rendering interactive Soroban (Japanese abacus) visualizations with advanced tutorial capabilities, directional gestures, and complete visual customization.

## Features

- 🎯 **Interactive beads** - Click to toggle or use directional drag gestures
- 🎨 **Complete visual customization** - Style every element individually with granular control
- 📱 **Responsive scaling** - Configurable scale factor for different display sizes
- 🌈 **Multiple color schemes** - Monochrome, place-value, alternating, heaven-earth
- 🎭 **Flexible bead shapes** - Diamond, square, or circle beads
- ⚡ **React Spring animations** - Smooth bead movements and state transitions
- 🔧 **Developer-friendly** - Comprehensive hooks, callbacks, and ref system
- 🎓 **Tutorial system** - Built-in overlay system with tooltips and highlights
- 🧩 **Framework-free SVG** - Complete control over rendering and styling
- 🏗️ **Type-safe APIs** - Full TypeScript support with branded types
- 📐 **Precise positioning** - Place-value based bead targeting system
- 🎮 **Directional gestures** - Natural drag interactions for bead manipulation

## Installation

### From npm (recommended)

```bash
npm install @soroban/abacus-react
# or
pnpm add @soroban/abacus-react
# or
yarn add @soroban/abacus-react
```

### From GitHub Packages

```bash
# Configure npm to use GitHub Packages for @soroban scope
echo "@soroban:registry=https://npm.pkg.github.com" >> .npmrc

# Then install
npm install @soroban/abacus-react
```

The package is published to both npm and GitHub Packages simultaneously for redundancy and choice.

## Quick Start

### Basic Usage

Simple static abacus display:

```tsx
import { AbacusReact } from '@soroban/abacus-react';

<AbacusReact
  value={123}
  columns={3}
  showNumbers={true}
  scaleFactor={1.0}
/>
```

### Interactive Mode

Clickable abacus with animations and callbacks:

```tsx
<AbacusReact
  value={456}
  columns={3}
  interactive={true}
  animated={true}
  gestures={true}
  showNumbers={true}
  callbacks={{
    onValueChange: (newValue) => console.log('New value:', newValue),
    onBeadClick: (event) => console.log('Bead clicked:', event)
  }}
/>
```

### Custom Styling

Personalized colors and visual themes:

```tsx
<AbacusReact
  value={789}
  columns={3}
  colorScheme="place-value"
  beadShape="circle"
  colorPalette="nature"
  customStyles={{
    heavenBeads: { fill: '#2ecc71', stroke: '#27ae60' },
    earthBeads: { fill: '#3498db', stroke: '#2980b9' },
    numerals: { color: '#2c3e50', fontWeight: 'bold' },
    reckoningBar: { stroke: '#34495e', strokeWidth: 3 }
  }}
  highlightBeads={[
    { placeValue: 2, beadType: 'heaven' },  // Hundreds place heaven bead
    { placeValue: 0, beadType: 'earth', position: 1 }  // Ones place, second earth bead
  ]}
/>
```

### Tutorial System

Educational guidance with interactive overlays:

```tsx
<AbacusReact
  value={42}
  columns={2}
  interactive={true}
  overlays={[{
    id: 'tutorial-tip',
    type: 'tooltip',
    target: {
      type: 'bead',
      columnIndex: 0,
      beadType: 'earth',
      beadPosition: 1
    },
    content: (
      <div style={{
        background: '#333',
        color: 'white',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        Click this bead to add 1!
      </div>
    ),
    offset: { x: 0, y: -30 }
  }]}
  stepBeadHighlights={[{
    placeValue: 0,
    beadType: 'earth',
    position: 1,
    stepIndex: 0,
    direction: 'activate',
    order: 1
  }]}
  showDirectionIndicators={true}
  callbacks={{
    onBeadClick: (event) => {
      if (event.placeValue === 0 && event.beadType === 'earth' && event.position === 1) {
        console.log('Tutorial step completed!');
      }
    }
  }}
/>
```

## Core API

### AbacusConfig Interface

```tsx
interface AbacusConfig {
  // Display
  value?: number;                    // 0-99999, number to display
  columns?: number | 'auto';         // Number of columns or auto-calculate
  showNumbers?: boolean;             // Show place value numbers below
  scaleFactor?: number;              // 0.5 - 3.0, size multiplier
  showEmptyColumns?: boolean;        // Display columns with value 0

  // Appearance
  beadShape?: 'diamond' | 'square' | 'circle';
  colorScheme?: 'monochrome' | 'place-value' | 'alternating' | 'heaven-earth';
  colorPalette?: 'default' | 'colorblind' | 'mnemonic' | 'grayscale' | 'nature';
  hideInactiveBeads?: boolean;       // Hide/show inactive beads

  // Interaction
  interactive?: boolean;             // Enable user interactions
  animated?: boolean;               // Enable React Spring animations
  gestures?: boolean;               // Enable directional drag gestures

  // Advanced
  customStyles?: AbacusCustomStyles; // Granular styling control
  callbacks?: AbacusCallbacks;       // Event handlers
  overlays?: AbacusOverlay[];        // Tutorial overlay system
  highlightBeads?: BeadHighlight[];  // Highlight specific beads
  stepBeadHighlights?: StepBeadHighlight[]; // Progressive tutorial highlighting
  showDirectionIndicators?: boolean; // Show movement direction indicators
  disabledBeads?: BeadHighlight[];   // Disable specific bead interactions
}
```

### Event System

```tsx
interface AbacusCallbacks {
  onValueChange?: (newValue: number) => void;
  onBeadClick?: (event: BeadClickEvent) => void;
  onBeadHover?: (event: BeadClickEvent) => void;
  onBeadLeave?: (event: BeadClickEvent) => void;
  onColumnClick?: (columnIndex: number, event: React.MouseEvent) => void;
  onNumeralClick?: (columnIndex: number, value: number, event: React.MouseEvent) => void;
  onBeadRef?: (bead: BeadConfig, element: SVGElement | null) => void;
}

interface BeadClickEvent {
  bead: BeadConfig;                 // Complete bead configuration
  columnIndex: number;              // 0, 1, 2... (array index)
  placeValue: ValidPlaceValues;     // 0=ones, 1=tens, 2=hundreds...
  beadType: 'heaven' | 'earth';     // Type of bead
  position: number;                 // Position within type (0-3 for earth)
  active: boolean;                  // Current activation state
  value: number;                    // Numeric value (1 or 5)
  event: React.MouseEvent;          // Original mouse event
}
```

## Advanced Features

### Place-Value Based Targeting

Target beads by mathematical place value instead of visual column position:

```tsx
// Target beads by place value (recommended)
const placeValueHighlights = [
  { placeValue: 0, beadType: 'earth', position: 2 },  // Ones place, 3rd earth bead
  { placeValue: 1, beadType: 'heaven' },              // Tens place, heaven bead
  { placeValue: 2, beadType: 'earth', position: 0 }   // Hundreds place, 1st earth bead
];

// Legacy column-index targeting (still supported)
const columnHighlights = [
  { columnIndex: 2, beadType: 'earth', position: 2 }, // Rightmost column
  { columnIndex: 1, beadType: 'heaven' },             // Middle column
  { columnIndex: 0, beadType: 'earth', position: 0 }  // Leftmost column
];

<AbacusReact highlightBeads={placeValueHighlights} />
```

### Progressive Tutorial Steps

Create multi-step interactive tutorials:

```tsx
const tutorialSteps = [
  {
    placeValue: 0,
    beadType: 'earth',
    position: 0,
    stepIndex: 0,
    direction: 'activate',
    order: 1
  },
  {
    placeValue: 0,
    beadType: 'earth',
    position: 1,
    stepIndex: 1,
    direction: 'activate',
    order: 1
  },
  {
    placeValue: 1,
    beadType: 'heaven',
    stepIndex: 2,
    direction: 'activate',
    order: 1
  }
];

<AbacusReact
  stepBeadHighlights={tutorialSteps}
  currentStep={currentStepIndex}
  showDirectionIndicators={true}
  interactive={true}
/>
```

### Granular Style Customization

Target any visual element with precise control:

```tsx
const advancedStyles = {
  // Global defaults
  heavenBeads: { fill: '#e74c3c', stroke: '#c0392b' },
  earthBeads: { fill: '#3498db', stroke: '#2980b9' },
  activeBeads: { opacity: 1.0 },
  inactiveBeads: { opacity: 0.3 },

  // Column-specific overrides (by array index)
  columns: {
    0: { // Leftmost column (highest place value)
      heavenBeads: { fill: '#f39c12' },
      earthBeads: { fill: '#e67e22' },
      backgroundGlow: { fill: '#fff3cd', opacity: 0.3 }
    }
  },

  // Individual bead targeting (by array index)
  beads: {
    1: { // Middle column
      heaven: { fill: '#9b59b6' },
      earth: {
        0: { fill: '#1abc9c' }, // First earth bead
        1: { fill: '#16a085' }, // Second earth bead
        2: { fill: '#17a2b8' }, // Third earth bead
        3: { fill: '#138496' }  // Fourth earth bead
      }
    }
  },

  // UI elements
  reckoningBar: { stroke: '#34495e', strokeWidth: 3 },
  columnPosts: { stroke: '#7f8c8d', strokeWidth: 2 },
  numerals: {
    color: '#2c3e50',
    fontSize: '16px',
    fontFamily: 'monospace',
    fontWeight: 'bold'
  }
};

<AbacusReact customStyles={advancedStyles} />
```

### Overlay System

Create rich interactive educational experiences:

```tsx
const educationalOverlays = [
  {
    id: 'value-explanation',
    type: 'tooltip',
    target: { type: 'bead', columnIndex: 0, beadType: 'heaven' },
    content: (
      <div className="tutorial-tooltip">
        <h4>Heaven Bead</h4>
        <p>Worth 5 in this place value</p>
        <button onClick={() => nextStep()}>Got it!</button>
      </div>
    ),
    offset: { x: 0, y: -40 }
  },
  {
    id: 'direction-arrow',
    type: 'arrow',
    target: { type: 'bead', columnIndex: 1, beadType: 'earth', beadPosition: 0 },
    content: <div className="arrow-down">⬇</div>,
    offset: { x: 0, y: -20 }
  }
];

<AbacusReact
  overlays={educationalOverlays}
  interactive={true}
  callbacks={{
    onBeadClick: handleTutorialProgression
  }}
/>
```

### Dimension Calculation Hook

Get exact sizing information for layout planning:

```tsx
import { useAbacusDimensions } from '@soroban/abacus-react';

function ResponsiveAbacusContainer() {
  const dimensions = useAbacusDimensions(
    5,     // columns
    1.2,   // scale factor
    true   // show numbers
  );

  return (
    <div
      style={{
        width: dimensions.width,
        height: dimensions.height,
        border: '1px solid #ccc',
        padding: '10px'
      }}
    >
      <AbacusReact
        columns={5}
        scaleFactor={1.2}
        showNumbers={true}
        value={12345}
      />
    </div>
  );
}
```

### Bead Reference System

Access individual bead DOM elements for advanced positioning:

```tsx
function AdvancedPositioning() {
  const beadRefs = useRef(new Map<string, SVGElement>());

  const handleBeadRef = (bead: BeadConfig, element: SVGElement | null) => {
    const key = `${bead.columnIndex}-${bead.type}-${bead.position}`;
    if (element) {
      beadRefs.current.set(key, element);

      // Position custom elements relative to beads
      const rect = element.getBoundingClientRect();
      console.log(`Bead at column ${bead.columnIndex} positioned at:`, rect);
    }
  };

  return (
    <AbacusReact
      callbacks={{ onBeadRef: handleBeadRef }}
      interactive={true}
    />
  );
}
```

## TypeScript Support

Full TypeScript definitions with branded types for enhanced type safety:

```tsx
import {
  AbacusReact,
  AbacusConfig,
  BeadConfig,
  BeadClickEvent,
  AbacusCustomStyles,
  AbacusOverlay,
  AbacusCallbacks,
  useAbacusDimensions,
  PlaceValueBead,
  ColumnIndexBead,
  StepBeadHighlight,
  PlaceValue,
  ColumnIndex,
  ValidPlaceValues,
  EarthBeadPosition
} from '@soroban/abacus-react';

// Branded types prevent mixing place values and column indices
const placeValue: ValidPlaceValues = 2; // hundreds place
const earthPosition: EarthBeadPosition = 3; // fourth earth bead

// Type-safe bead specification
const bead: PlaceValueBead = {
  placeValue: 1,    // tens place
  beadType: 'earth',
  position: 2       // third earth bead
};
```

## Educational Use Cases

### Interactive Math Lessons

```tsx
function AdditionLesson() {
  const [problem] = useState({ a: 23, b: 45 });
  const [step, setStep] = useState('show-first');
  const [userValue, setUserValue] = useState(0);

  const checkAnswer = (newValue: number) => {
    setUserValue(newValue);
    if (newValue === problem.a + problem.b) {
      setStep('completed');
      showCelebration();
    }
  };

  return (
    <div className="math-lesson">
      <h3>Add {problem.a} + {problem.b}</h3>

      <AbacusReact
        value={step === 'show-first' ? problem.a : userValue}
        columns={3}
        interactive={step === 'user-input'}
        animated={true}
        showNumbers={true}
        callbacks={{ onValueChange: checkAnswer }}
        highlightBeads={step === 'hint' ? getHintBeads() : []}
      />

      {step === 'completed' && (
        <div className="success">
          🎉 Correct! {problem.a} + {problem.b} = {problem.a + problem.b}
        </div>
      )}
    </div>
  );
}
```

### Assessment and Quizzing

```tsx
function AbacusQuiz() {
  const [answers, setAnswers] = useState<BeadClickEvent[]>([]);
  const [feedback, setFeedback] = useState<string>('');

  const validateAnswer = (event: BeadClickEvent) => {
    const isCorrect = checkBeadClick(event, expectedAnswer);

    setAnswers(prev => [...prev, event]);

    if (isCorrect) {
      setFeedback('Correct! Well done.');
      advanceToNextQuestion();
    } else {
      setFeedback('Try again. Remember: this bead represents...');
      showHint(event);
    }
  };

  return (
    <div className="abacus-quiz">
      <AbacusReact
        value={currentQuestionValue}
        interactive={true}
        callbacks={{ onBeadClick: validateAnswer }}
        customStyles={getAnswerHighlighting(answers)}
        overlays={currentHints}
      />
      <div className="feedback">{feedback}</div>
    </div>
  );
}
```

## Color Schemes and Accessibility

### Built-in Color Schemes

- **`monochrome`** - Single color for all beads
- **`place-value`** - Different colors for each place value column
- **`alternating`** - Alternating colors between columns
- **`heaven-earth`** - Different colors for heaven vs earth beads

### Accessibility Palettes

- **`colorblind`** - High contrast, colorblind-friendly palette
- **`grayscale`** - Monochrome grayscale for maximum compatibility
- **`mnemonic`** - Colors that aid memory and learning
- **`nature`** - Earth-tone palette for reduced eye strain

```tsx
<AbacusReact
  colorScheme="place-value"
  colorPalette="colorblind"
  value={12345}
  columns={5}
/>
```

## Publishing and Versioning

This package uses [semantic-release](https://semantic-release.gitbook.io/) for automated publishing. Versions are determined by conventional commit messages:

### Commit Message Format

Use these prefixes for commits that affect the `packages/abacus-react` directory:

```bash
# New features (minor version bump)
feat(abacus-react): add gesture recognition system

# Bug fixes (patch version bump)
fix(abacus-react): resolve animation timing issues

# Performance improvements (patch version bump)
perf(abacus-react): optimize bead rendering performance

# Breaking changes (major version bump)
feat(abacus-react)!: redesign callback API
# or
feat(abacus-react): change component interface

BREAKING CHANGE: callback functions now receive different parameters
```

### Release Process

1. **Automatic**: Releases happen automatically when changes are pushed to `main` branch
2. **Dual publishing**: Package is published to both npm and GitHub Packages simultaneously
3. **Manual testing**: Run `pnpm release:dry-run` to test release without publishing
4. **Version tags**: Releases are tagged as `abacus-react-v1.2.3` (separate from monorepo versions)

### Development Commands

```bash
# Build the package
pnpm build

# Run tests
pnpm test:run

# Run Storybook locally
pnpm storybook

# Test release process (dry run)
pnpm release:dry-run
```

## Live Documentation

- **Storybook**: [Component examples and documentation](https://antialias.github.io/soroban-abacus-flashcards/abacus-react/)
- **Source Code**: [GitHub Repository](https://github.com/antialias/soroban-abacus-flashcards/tree/main/packages/abacus-react)

## Contributing

Contributions welcome! Please see our [contributing guidelines](../../CONTRIBUTING.md) and feel free to submit issues or pull requests.

## License

MIT License - see [LICENSE](../../LICENSE) file for details.