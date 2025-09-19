#!/usr/bin/env node

/**
 * Generate SVG examples and README content for AbacusReact
 *
 * This script creates actual SVG files using react-dom/server and
 * generates a balanced README with usage examples.
 */

const fs = require('fs').promises;
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Setup comprehensive DOM globals for React Spring and dependencies
const { JSDOM } = require('jsdom');

if (typeof global.window === 'undefined') {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.SVGElement = dom.window.SVGElement;
  global.Element = dom.window.Element;
  global.requestAnimationFrame = dom.window.requestAnimationFrame || function(cb) { return setTimeout(cb, 16); };
  global.cancelAnimationFrame = dom.window.cancelAnimationFrame || function(id) { return clearTimeout(id); };

  // Add customElements for number-flow compatibility
  global.customElements = {
    define: function() {},
    get: function() { return undefined; },
    whenDefined: function() { return Promise.resolve(); }
  };

  // Add ResizeObserver mock
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock React Spring to return static components but preserve all SVG elements
  const createAnimatedComponent = (tag) => {
    // Return a React component that forwards props to the base element
    return React.forwardRef((props, ref) => {
      return React.createElement(tag, { ...props, ref });
    });
  };

  const mockAnimated = {
    div: createAnimatedComponent('div'),
    svg: createAnimatedComponent('svg'),
    g: createAnimatedComponent('g'),
    circle: createAnimatedComponent('circle'),
    rect: createAnimatedComponent('rect'),
    path: createAnimatedComponent('path'),
    text: createAnimatedComponent('text'),
    polygon: createAnimatedComponent('polygon'),
    line: createAnimatedComponent('line'),
    foreignObject: createAnimatedComponent('foreignObject')
  };

  // Mock @react-spring/web with better stubs
  require.cache[require.resolve('@react-spring/web')] = {
    exports: {
      useSpring: () => [{ x: 0, y: 0 }, { start: () => {}, set: () => {} }],
      useSpringValue: () => ({ start: () => {}, get: () => 0, to: () => {} }),
      animated: mockAnimated,
      config: { default: {}, slow: {}, wobbly: {}, stiff: {} },
      to: (springs, fn) => fn ? fn(springs) : springs
    }
  };

  // Mock @use-gesture/react with proper signatures
  require.cache[require.resolve('@use-gesture/react')] = {
    exports: {
      useDrag: () => () => ({}),
      useGesture: () => () => ({})
    }
  };

  // Mock @number-flow/react with aggressive SVG text replacement
  require.cache[require.resolve('@number-flow/react')] = {
    exports: {
      __esModule: true,
      default: ({ children, value, format, style, ...props }) => {
        // Use value if provided, otherwise fallback to children
        const displayValue = value !== undefined ? value : children;
        // Return raw text content - React will render this as a text node
        return String(displayValue);
      }
    }
  };
}

// Import our component after setting up globals - use source directly
const { AbacusReact } = require('./src/AbacusReact.tsx');

// Key example configurations for different use cases
const examples = [
  {
    name: 'basic-usage',
    title: 'Basic Usage',
    description: 'Simple abacus showing a number',
    code: `<AbacusReact
  value={123}
  columns={3}
  showNumbers={true}
  scaleFactor={1.0}
/>`,
    props: {
      value: 123,
      columns: 3,
      showNumbers: true,
      scaleFactor: 1.0,
      animated: false // Disable animations for static SVG
    }
  },
  {
    name: 'interactive',
    title: 'Interactive Mode',
    description: 'Clickable abacus with animations',
    code: `<AbacusReact
  value={456}
  columns={3}
  interactive={true}
  animated={true}
  showNumbers={true}
  callbacks={{
    onValueChange: (newValue) => console.log('New value:', newValue),
    onBeadClick: (event) => console.log('Bead clicked:', event)
  }}
/>`,
    props: {
      value: 456,
      columns: 3,
      interactive: true,
      animated: false, // Disable animations for static SVG
      showNumbers: true
    }
  },
  {
    name: 'custom-styling',
    title: 'Custom Styling',
    description: 'Personalized colors and highlights',
    code: `<AbacusReact
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
/>`,
    props: {
      value: 789,
      columns: 3,
      colorScheme: 'place-value',
      beadShape: 'circle',
      animated: false, // Disable animations for static SVG
      customStyles: {
        heavenBeads: { fill: '#ff6b35' },
        earthBeads: { fill: '#3498db' },
        numerals: { color: '#2c3e50', fontWeight: 'bold' }
      },
      highlightBeads: [
        { columnIndex: 1, beadType: 'heaven' }
      ]
    }
  },
  {
    name: 'tutorial-mode',
    title: 'Tutorial System',
    description: 'Educational guidance with tooltips',
    code: `<AbacusReact
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
/>`,
    props: {
      value: 42,
      columns: 2,
      interactive: true,
      animated: false, // Disable animations for static SVG
      showNumbers: true
    }
  }
];

/**
 * Generate SVG examples using react-dom/server
 */
async function generateSVGExamples() {
  if (!AbacusReact) {
    console.log('🔨 Building package first...');
    const { execSync } = require('child_process');
    try {
      execSync('pnpm run build', { stdio: 'inherit' });
      AbacusReact = require('./dist/index.cjs.js').AbacusReact;
    } catch (error) {
      console.error('❌ Failed to build package:', error.message);
      throw error;
    }
  }

  console.log('🎨 Generating SVG examples...');

  // Create examples directory
  const examplesDir = path.join(__dirname, 'examples');
  try {
    await fs.mkdir(examplesDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  const generatedFiles = [];

  for (const example of examples) {
    try {
      console.log(`📐 Generating ${example.name}.svg...`);

      // Create React element with the example props
      const element = React.createElement(AbacusReact, example.props);

      // Render using react-dom/server to show the actual component
      const fullMarkup = renderToStaticMarkup(element);

      // Extract just the SVG content from the rendered HTML
      const svgMatch = fullMarkup.match(/<svg[^>]*>.*<\/svg>/s);
      let svgMarkup = svgMatch ? svgMatch[0] : fullMarkup;

      // Add required xmlns attributes for GitHub compatibility
      if (svgMarkup.includes('<svg')) {
        svgMarkup = svgMarkup.replace(
          /<svg([^>]*)>/,
          '<svg$1 xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:h5="http://www.w3.org/1999/xhtml">'
        );
      }

      // Add metadata as comments
      const svgWithMetadata = `<!-- ${example.description} -->
<!-- Generated from: ${JSON.stringify(example.props, null, 2).replace(/-->/g, '--&gt;')} -->
${svgMarkup}`;

      // Save to file
      const filename = `${example.name}.svg`;
      const filepath = path.join(examplesDir, filename);
      await fs.writeFile(filepath, svgWithMetadata, 'utf8');

      generatedFiles.push(filename);
      console.log(`✅ Generated ${filename}`);

    } catch (error) {
      console.error(`❌ Failed to generate ${example.name}:`, error.message);
    }
  }

  // Generate examples index file
  const indexContent = `# AbacusReact Examples

Generated SVG examples demonstrating various features of the AbacusReact component.

## Files

${generatedFiles.map(file => {
  const example = examples.find(ex => `${ex.name}.svg` === file);
  return `- **${file}** - ${example?.description || 'Example usage'}`;
}).join('\n')}

## Usage in Documentation

These SVG files can be embedded directly in markdown:

\`\`\`markdown
![Basic Usage](./examples/basic-usage.svg)
\`\`\`

Or referenced in HTML:

\`\`\`html
<img src="./examples/basic-usage.svg" alt="Basic AbacusReact Usage" />
\`\`\`

---

_Generated automatically by generate-examples.js using react-dom/server_
_Last updated: ${new Date().toISOString()}_
`;

  await fs.writeFile(path.join(examplesDir, 'README.md'), indexContent, 'utf8');

  console.log(`✅ Generated ${generatedFiles.length} SVG example files`);
  console.log(`📂 Examples available in: ${examplesDir}`);

  return generatedFiles;
}


// Generate enhanced Storybook stories
async function generateStorybookStories() {
  const storyContent = `import type { Meta, StoryObj } from '@storybook/react';
import { AbacusReact } from './AbacusReact';
import React from 'react';

const meta: Meta<typeof AbacusReact> = {
  title: 'Examples/AbacusReact',
  component: AbacusReact,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Interactive Soroban (Japanese abacus) component with comprehensive customization options.'
      }
    }
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

${examples.map(example => `
export const ${example.name.replace(/-([a-z])/g, (g) => g[1].toUpperCase())}: Story = {
  name: '${example.title}',
  args: ${JSON.stringify(example.props, null, 2)},
  parameters: {
    docs: {
      description: {
        story: '${example.description}'
      }
    }
  }
};`).join('\n')}

// Advanced tutorial example (from our previous implementation)
export const TutorialExample: Story = {
  name: 'Interactive Tutorial',
  render: () => {
    const [step, setStep] = React.useState(0);
    const [feedbackMessage, setFeedbackMessage] = React.useState('');

    const tutorialSteps = [
      {
        instruction: "Click the orange highlighted bead in the ones column (leftmost)",
        highlightBeads: [{ columnIndex: 0, beadType: 'earth', position: 2 }],
        value: 7
      },
      {
        instruction: "Click anywhere in the ones column (leftmost column)",
        highlightColumns: [0],
        value: 7
      }
    ];

    const currentStep = tutorialSteps[step];

    const handleBeadClick = (event: any) => {
      let isCorrectTarget = false;

      if (step === 0) {
        const target = currentStep.highlightBeads?.[0];
        isCorrectTarget = target &&
          event.columnIndex === target.columnIndex &&
          event.beadType === target.beadType &&
          event.position === target.position;
      } else if (step === 1) {
        isCorrectTarget = event.columnIndex === 0;
      }

      if (isCorrectTarget && step < tutorialSteps.length - 1) {
        setStep(step + 1);
        setFeedbackMessage('✅ Correct! Moving to next step...');
        setTimeout(() => setFeedbackMessage(''), 2000);
      } else if (!isCorrectTarget) {
        setFeedbackMessage('⚠️ Try clicking the highlighted area.');
        setTimeout(() => setFeedbackMessage(''), 3000);
      }
    };

    const handleRestart = () => {
      setStep(0);
      setFeedbackMessage('');
    };

    return (
      <div style={{ position: 'relative', padding: '20px' }}>
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <h3>Interactive Tutorial - Step {step + 1} of {tutorialSteps.length}</h3>
          <p>{currentStep.instruction}</p>
        </div>

        <AbacusReact
          value={currentStep.value}
          columns={1}
          interactive={true}
          animated={true}
          showNumbers={true}
          scaleFactor={1.2}

          highlightColumns={currentStep.highlightColumns}
          highlightBeads={currentStep.highlightBeads}

          customStyles={{
            beads: {
              0: {
                earth: {
                  2: step === 0 ? { fill: '#ff6b35', stroke: '#d63031', strokeWidth: 2 } : undefined
                }
              }
            }
          }}

          overlays={step === 0 ? [{
            id: 'tutorial-tip',
            type: 'tooltip',
            target: {
              type: 'bead',
              columnIndex: 0,
              beadType: 'earth',
              beadPosition: 2
            },
            content: (
              <div style={{
                background: '#333',
                color: 'white',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '12px',
                maxWidth: '120px',
                textAlign: 'center'
              }}>
                Click this bead!
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
            offset: { x: 0, y: -50 }
          }] : []}

          callbacks={{
            onBeadClick: handleBeadClick
          }}
        />

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button onClick={handleRestart} style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            Restart Tutorial
          </button>
        </div>

        {feedbackMessage && (
          <div style={{
            position: 'absolute',
            right: '-300px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            padding: '12px',
            fontSize: '14px',
            maxWidth: '250px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease'
          }}>
            {feedbackMessage}
          </div>
        )}
      </div>
    );
  }
};
`;

  await fs.writeFile(path.join(__dirname, 'src', 'AbacusReact.examples.stories.tsx'), storyContent, 'utf8');
  console.log('✅ Generated AbacusReact.examples.stories.tsx');
}

// Generate balanced README
async function generateREADME() {
  const readmeContent = `# @soroban/abacus-react

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

## Installation

\`\`\`bash
npm install @soroban/abacus-react
# or
pnpm add @soroban/abacus-react
# or
yarn add @soroban/abacus-react
\`\`\`

## Quick Start

${examples.map(example => `
### ${example.title}

${example.description}

<img src="https://raw.githubusercontent.com/antialias/soroban-abacus-flashcards/main/packages/abacus-react/examples/${example.name}.svg" alt="${example.title}">

\`\`\`tsx
${example.code}
\`\`\`
`).join('')}

## Core API

### Basic Props

\`\`\`tsx
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
\`\`\`

### Event Callbacks

\`\`\`tsx
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
\`\`\`

## Advanced Customization

### Granular Styling

Target any visual element with precise control:

\`\`\`tsx
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
\`\`\`

### Tutorial and Overlay System

Create interactive educational experiences:

\`\`\`tsx
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
\`\`\`

### Bead Reference System

Access individual bead DOM elements for advanced positioning:

\`\`\`tsx
function AdvancedExample() {
  const beadRefs = useRef(new Map<string, SVGElement>());

  const handleBeadRef = (bead: BeadConfig, element: SVGElement | null) => {
    const key = \`\${bead.columnIndex}-\${bead.type}-\${bead.position}\`;
    if (element) {
      beadRefs.current.set(key, element);

      // Now you can position tooltips, highlights, etc. precisely
      const rect = element.getBoundingClientRect();
      console.log(\`Bead at column \${bead.columnIndex} is at:\`, rect);
    }
  };

  return (
    <AbacusReact
      callbacks={{ onBeadRef: handleBeadRef }}
      // ... other props
    />
  );
}
\`\`\`

## Hooks

### useAbacusDimensions

Get exact sizing information for layout planning:

\`\`\`tsx
import { useAbacusDimensions } from '@soroban/abacus-react';

function MyComponent() {
  const dimensions = useAbacusDimensions(3, 1.2); // 3 columns, 1.2x scale

  return (
    <div style={{ width: dimensions.width, height: dimensions.height }}>
      <AbacusReact columns={3} scaleFactor={1.2} />
    </div>
  );
}
\`\`\`

## Educational Use Cases

### Interactive Math Lessons

\`\`\`tsx
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
\`\`\`

### Assessment Tools

\`\`\`tsx
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
\`\`\`

## TypeScript Support

Full TypeScript definitions included:

\`\`\`tsx
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
\`\`\`

## Contributing

Contributions welcome! Please see our contributing guidelines and feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details.
`;

  await fs.writeFile(path.join(__dirname, 'README.md'), readmeContent, 'utf8');
  console.log('✅ Generated balanced README.md');
}

// Main execution
async function generateExamples() {
  console.log('🎨 Generating AbacusReact examples and documentation...');

  try {
    // Generate actual SVG files first
    await generateSVGExamples();

    // Then generate Storybook stories and README
    await generateStorybookStories();
    await generateREADME();

    console.log('\n✅ All examples and documentation generated successfully!');
    console.log('📸 Generated SVG examples using react-dom/server');
    console.log('📖 Updated README.md with balanced documentation');
    console.log('📚 Created new Storybook examples in AbacusReact.examples.stories.tsx');

  } catch (error) {
    console.error('💥 Generation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  generateExamples();
}

module.exports = { generateExamples, examples };