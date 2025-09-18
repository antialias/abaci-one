import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AbacusReact, useAbacusDimensions } from './AbacusReact';
import React, { useState } from 'react';

const meta: Meta<typeof AbacusReact> = {
  title: 'Soroban/AbacusReact',
  component: AbacusReact,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# AbacusReact Component

A complete React component for rendering interactive Soroban (Japanese abacus) SVGs with animations and directional gesture interactions.

## Features

- 🎨 **Framework-free SVG rendering** - Complete control over all elements and viewBox
- 🎯 **Interactive beads** - Click to toggle or use directional gestures
- 🔄 **Directional gestures** - Drag beads in natural directions to activate/deactivate
- 🌈 **Multiple color schemes** - Monochrome, place-value, alternating, heaven-earth
- 🎭 **Bead shapes** - Diamond, square, or circle beads
- ⚡ **React Spring animations** - Smooth bead movements and transitions
- 🔧 **Hooks interface** - Size calculation and state management hooks
- 📱 **Responsive scaling** - Configurable scale factor for different sizes
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'number', min: 0, max: 99999 },
      description: 'The numeric value to display on the abacus',
    },
    columns: {
      control: { type: 'select' },
      options: ['auto', 1, 2, 3, 4, 5],
      description: 'Number of columns or auto-calculate based on value',
    },
    beadShape: {
      control: { type: 'select' },
      options: ['diamond', 'square', 'circle'],
      description: 'Shape of the beads',
    },
    colorScheme: {
      control: { type: 'select' },
      options: ['monochrome', 'place-value', 'alternating', 'heaven-earth'],
      description: 'Color scheme strategy',
    },
    colorPalette: {
      control: { type: 'select' },
      options: ['default', 'colorblind', 'mnemonic', 'grayscale', 'nature'],
      description: 'Color palette for place values',
    },
    scaleFactor: {
      control: { type: 'range', min: 0.5, max: 3, step: 0.1 },
      description: 'Scale multiplier for component size',
    },
    animated: {
      control: { type: 'boolean' },
      description: 'Enable react-spring animations',
    },
    interactive: {
      control: { type: 'boolean' },
      description: 'Enable user interactions (gestures and clicks) - when true, users can modify the abacus',
    },
    gestures: {
      control: { type: 'boolean' },
      description: 'Enable directional gesture interactions (legacy prop, use interactive instead)',
    },
    hideInactiveBeads: {
      control: { type: 'boolean' },
      description: 'Hide inactive beads completely',
    },
    showEmptyColumns: {
      control: { type: 'boolean' },
      description: 'Show leading zero columns',
    },
    showNumbers: {
      control: {
        type: 'select',
        options: ['never', 'always', 'toggleable']
      },
      description: 'Control visibility of place value numbers: never (no numbers, compact), always (always show), toggleable (toggle button)',
    },
    onClick: { action: 'bead-clicked' },
    onValueChange: { action: 'value-changed' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Basic Examples
export const BasicNumber: Story = {
  args: {
    value: 5,
    columns: 1,
    beadShape: 'diamond',
    colorScheme: 'monochrome',
    scaleFactor: 1,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Basic representation of the number 5 using a single column with diamond-shaped beads.',
      },
    },
  },
};

export const MultiColumn: Story = {
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 1,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Multi-column abacus showing 123 with place-value colors (ones=blue, tens=magenta, hundreds=orange).',
      },
    },
  },
};

export const CircleBeads: Story = {
  args: {
    value: 42,
    columns: 2,
    beadShape: 'circle',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 1.2,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstration of circular bead shapes with larger scale factor for better visibility.',
      },
    },
  },
};

export const SquareBeads: Story = {
  args: {
    value: 999,
    columns: 3,
    beadShape: 'square',
    colorScheme: 'alternating',
    scaleFactor: 0.8,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact design using square beads with alternating column colors.',
      },
    },
  },
};

// Color Scheme Examples
export const MonochromeScheme: Story = {
  args: {
    value: 678,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'monochrome',
    scaleFactor: 1,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Traditional monochrome color scheme - all active beads are black.',
      },
    },
  },
};

export const PlaceValueScheme: Story = {
  args: {
    value: 1234,
    columns: 4,
    beadShape: 'circle',
    colorScheme: 'place-value',
    colorPalette: 'mnemonic',
    scaleFactor: 0.9,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Place-value coloring with mnemonic palette - each place value has a memorable color association.',
      },
    },
  },
};

export const AlternatingScheme: Story = {
  args: {
    value: 555,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'alternating',
    scaleFactor: 1,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Alternating column colors (blue/green) to help distinguish place values.',
      },
    },
  },
};

export const HeavenEarthScheme: Story = {
  args: {
    value: 789,
    columns: 3,
    beadShape: 'circle',
    colorScheme: 'heaven-earth',
    scaleFactor: 1,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Heaven-earth color scheme - heaven beads (value 5) are red, earth beads (value 1) are blue.',
      },
    },
  },
};

// Special Cases
export const EmptyAbacus: Story = {
  args: {
    value: 0,
    columns: 1,
    beadShape: 'circle',
    colorScheme: 'monochrome',
    scaleFactor: 2,
    hideInactiveBeads: false,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty abacus showing all inactive beads - demonstrates the zero state.',
      },
    },
  },
};

export const HiddenInactiveBeads: Story = {
  args: {
    value: 555,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'nature',
    hideInactiveBeads: true,
    scaleFactor: 1.4,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Clean design with inactive beads hidden - only shows the active beads.',
      },
    },
  },
};

export const LargeScale: Story = {
  args: {
    value: 7,
    columns: 1,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 2.5,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Large scale demonstration for presentations or accessibility needs.',
      },
    },
  },
};

// Color Palette Comparison
export const ColorblindPalette: Story = {
  args: {
    value: 12345,
    columns: 5,
    beadShape: 'circle',
    colorScheme: 'place-value',
    colorPalette: 'colorblind',
    scaleFactor: 0.8,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Colorblind-friendly palette designed for maximum accessibility and contrast.',
      },
    },
  },
};

export const GrayscalePalette: Story = {
  args: {
    value: 1111,
    columns: 4,
    beadShape: 'square',
    colorScheme: 'place-value',
    colorPalette: 'grayscale',
    scaleFactor: 1,
    animated: true,
    interactive: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Grayscale palette suitable for printing or monochrome displays.',
      },
    },
  },
};

// Interactive Examples
export const InteractiveExample: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value || 123);
    const [clickCount, setClickCount] = useState(0);

    const handleBeadClick = (bead: any) => {
      setClickCount(prev => prev + 1);
      action('bead-clicked')(bead);
    };

    const handleValueChange = (newValue: number) => {
      setValue(newValue);
      action('value-changed')(newValue);
    };

    const resetValue = () => {
      setValue(args.value || 123);
      setClickCount(0);
    };

    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3>Interactive Abacus Demo</h3>
          <p>Click beads to change values • Current Value: <strong>{value}</strong> • Clicks: <strong>{clickCount}</strong></p>
          <button
            onClick={resetValue}
            style={{
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            Reset
          </button>
        </div>
        <AbacusReact
          {...args}
          value={value}
          onClick={handleBeadClick}
          onValueChange={handleValueChange}
        />
      </div>
    );
  },
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 1.2,
    animated: true,
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive example with click counter and reset functionality. Click the beads to toggle their states!',
      },
    },
  },
};

// Sizing Demo
// Gesture Testing
export const DirectionalGestures: Story = {
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 1.5,
    animated: true,
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Directional Gesture Testing**

Test the new directional gesture system:
- **Heaven beads**: Drag down toward the bar to activate, drag up away from bar to deactivate
- **Earth beads**: Drag up toward the bar to activate, drag down away from bar to deactivate
- **Direction reversals**: Change drag direction mid-gesture and watch the bead follow
- **Independent behavior**: Each bead responds only to its own gesture, beads don't push each other

The gesture system tracks cursor movement direction and toggles beads based on natural abacus movements.
        `,
      },
    },
  },
};

export const SizingDemo: Story = {
  render: (args) => {
    const dimensions = useAbacusDimensions(3, args.scaleFactor || 1);

    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3>Sizing Information</h3>
          <p>
            <strong>Dimensions:</strong> {dimensions.width.toFixed(1)} × {dimensions.height.toFixed(1)}px<br/>
            <strong>Rod Spacing:</strong> {dimensions.rodSpacing.toFixed(1)}px<br/>
            <strong>Bead Size:</strong> {dimensions.beadSize.toFixed(1)}px
          </p>
        </div>
        <div
          style={{
            border: '2px dashed #ccc',
            display: 'inline-block',
            padding: '10px',
            borderRadius: '8px'
          }}
        >
          <AbacusReact {...args} />
        </div>
      </div>
    );
  },
  args: {
    value: 567,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    scaleFactor: 1,
    animated: true,
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstration of the useAbacusDimensions hook for layout planning. The dashed border shows the exact component dimensions.',
      },
    },
  },
};

// CSS-based Hidden Inactive Beads Testing
export const CSSHiddenInactiveBeads: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value || 555);

    const handleBeadClick = (bead: any) => {
      action('bead-clicked')(bead);
    };

    const handleValueChange = (newValue: number) => {
      setValue(newValue);
      action('value-changed')(newValue);
    };

    const resetValue = () => {
      setValue(args.value || 555);
    };

    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3>CSS-Based Hidden Inactive Beads</h3>
          <p><strong>Instructions:</strong> Click beads to make them inactive, then hover over the abacus to see smooth opacity transitions!</p>
          <p>Current Value: <strong>{value}</strong></p>
          <button
            onClick={resetValue}
            style={{
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            Reset to 555
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', alignItems: 'flex-start' }}>
          <div>
            <h4>Normal Mode</h4>
            <AbacusReact
              {...args}
              value={value}
              hideInactiveBeads={false}
              onClick={handleBeadClick}
              onValueChange={handleValueChange}
            />
          </div>

          <div>
            <h4>CSS Hidden Inactive Mode</h4>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              • Inactive beads: opacity 0<br/>
              • Hover abacus: opacity 0.5<br/>
              • Hover bead: opacity 1
            </p>
            <AbacusReact
              {...args}
              value={value}
              hideInactiveBeads={true}
              onClick={handleBeadClick}
              onValueChange={handleValueChange}
            />
          </div>
        </div>
      </div>
    );
  },
  args: {
    value: 555,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 1.2,
    animated: true,
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**CSS-Based Hidden Inactive Beads System**

This implementation uses pure CSS for smooth opacity transitions:

1. **Default State**: Inactive beads have \`opacity: 0\` (completely hidden)
2. **Abacus Hover**: All inactive beads get \`opacity: 0.5\` (semi-transparent)
3. **Individual Bead Hover**: Specific inactive bead gets \`opacity: 1\` (fully visible)
4. **Smooth Transitions**: All opacity changes use \`transition: opacity 0.2s ease-in-out\`

**Features**:
- ✅ Clean CSS-only implementation
- ✅ Smooth opacity transitions (0.2s ease-in-out)
- ✅ No JavaScript hover state management
- ✅ No cursor flickering issues
- ✅ Inactive beads remain clickable when visible
- ✅ Works with all existing gesture and click functionality

**Testing**: Click beads to make them inactive, then hover over the abacus to see the smooth opacity transitions in action!
        `,
      },
    },
  },
};

// Interactive Place Value Editing
export const InteractivePlaceValueEditing: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value || 123);

    const handleBeadClick = (bead: any) => {
      action('bead-clicked')(bead);
    };

    const handleValueChange = (newValue: number) => {
      setValue(newValue);
      action('value-changed')(newValue);
    };

    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3>Interactive Place Value Editing</h3>
          <p><strong>Instructions:</strong> Click on the number displays below each column to edit them directly!</p>
          <p>Current Value: <strong>{value}</strong></p>
        </div>

        <AbacusReact
          {...args}
          value={value}
          onClick={handleBeadClick}
          onValueChange={handleValueChange}
        />

        <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          <p><strong>How to use:</strong> Click numbers below columns → Type 0-9 → Press Enter/Esc</p>
        </div>
      </div>
    );
  },
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    scaleFactor: 1.2,
    animated: true,
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'SVG-based interactive place value editing with perfect alignment to abacus columns.',
      },
    },
  },
};

// Numbers Display Feature
export const NumbersNever: Story = {
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'monochrome',
    showNumbers: 'never',
    scaleFactor: 1,
    animated: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact abacus with no place value numbers displayed. Component height is optimized to not include space for numbers.',
      },
    },
  },
};

export const NumbersAlways: Story = {
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'monochrome',
    showNumbers: 'always',
    scaleFactor: 1,
    animated: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Abacus with place value numbers always visible below each column.',
      },
    },
  },
};

export const NumbersToggleable: Story = {
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'monochrome',
    showNumbers: 'toggleable',
    scaleFactor: 1,
    animated: true,
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Abacus with a toggle button (top-right) to show/hide place value numbers. Click the button to test the functionality.',
      },
    },
  },
};

// Size Comparison
export const SizeComparisonNever: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
          showNumbers="never"
        </div>
        <div style={{
          border: '2px dashed #e74c3c',
          display: 'inline-block',
          padding: '10px',
          borderRadius: '8px'
        }}>
          <AbacusReact
            value={123}
            columns={3}
            showNumbers="never"
            beadShape="diamond"
            colorScheme="monochrome"
            scaleFactor={0.8}
          />
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
          showNumbers="always"
        </div>
        <div style={{
          border: '2px dashed #27ae60',
          display: 'inline-block',
          padding: '10px',
          borderRadius: '8px'
        }}>
          <AbacusReact
            value={123}
            columns={3}
            showNumbers="always"
            beadShape="diamond"
            colorScheme="monochrome"
            scaleFactor={0.8}
          />
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
          showNumbers="toggleable"
        </div>
        <div style={{
          border: '2px dashed #3498db',
          display: 'inline-block',
          padding: '10px',
          borderRadius: '8px'
        }}>
          <AbacusReact
            value={123}
            columns={3}
            showNumbers="toggleable"
            beadShape="diamond"
            colorScheme="monochrome"
            scaleFactor={0.8}
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Side-by-side comparison showing the height differences between the three showNumbers modes.',
      },
    },
  },
};

// Interactive vs Non-Interactive Comparison
export const InteractiveComparison: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '16px' }}>Interactive Abacus</h3>
        <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#666' }}>
          • Click beads to toggle<br/>
          • Drag gestures enabled<br/>
          • Grab cursor on beads
        </p>
        <div style={{
          border: '2px dashed #27ae60',
          display: 'inline-block',
          padding: '15px',
          borderRadius: '8px'
        }}>
          <AbacusReact
            value={42}
            columns={2}
            beadShape="diamond"
            colorScheme="place-value"
            scaleFactor={1.2}
            interactive={true}
          />
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '16px' }}>Display-Only Abacus</h3>
        <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#666' }}>
          • No user interactions<br/>
          • Default cursor<br/>
          • Pure display component
        </p>
        <div style={{
          border: '2px dashed #e74c3c',
          display: 'inline-block',
          padding: '15px',
          borderRadius: '8px'
        }}>
          <AbacusReact
            value={42}
            columns={2}
            beadShape="diamond"
            colorScheme="place-value"
            scaleFactor={1.2}
            interactive={false}
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Side-by-side comparison showing the difference between interactive and display-only abacus components. Hover over the beads to see the different cursor behaviors.',
      },
    },
  },
};

// Hidden Beads Opacity Behavior
export const HiddenBeadsOpacityDemo: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Interactive + Hidden Inactive</h3>
        <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#666', maxWidth: '200px' }}>
          • Inactive beads: opacity 0<br/>
          • Hover abacus: opacity 0.5<br/>
          • Hover bead: opacity 1<br/>
          • Click to toggle beads
        </p>
        <div style={{
          border: '2px dashed #3498db',
          display: 'inline-block',
          padding: '15px',
          borderRadius: '8px'
        }}>
          <AbacusReact
            value={123}
            columns={3}
            beadShape="diamond"
            colorScheme="place-value"
            scaleFactor={1.1}
            interactive={true}
            hideInactiveBeads={true}
          />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Display-Only + Hidden Inactive</h3>
        <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#666', maxWidth: '200px' }}>
          • Inactive beads: opacity 0<br/>
          • <strong>No hover effects</strong><br/>
          • Always stays hidden<br/>
          • No interactions
        </p>
        <div style={{
          border: '2px dashed #e67e22',
          display: 'inline-block',
          padding: '15px',
          borderRadius: '8px'
        }}>
          <AbacusReact
            value={123}
            columns={3}
            beadShape="diamond"
            colorScheme="place-value"
            scaleFactor={1.1}
            interactive={false}
            hideInactiveBeads={true}
          />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Interactive + All Beads Visible</h3>
        <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#666', maxWidth: '200px' }}>
          • All beads always visible<br/>
          • Inactive beads dimmed<br/>
          • Click to toggle<br/>
          • Full interactivity
        </p>
        <div style={{
          border: '2px dashed #27ae60',
          display: 'inline-block',
          padding: '15px',
          borderRadius: '8px'
        }}>
          <AbacusReact
            value={123}
            columns={3}
            beadShape="diamond"
            colorScheme="place-value"
            scaleFactor={1.1}
            interactive={true}
            hideInactiveBeads={false}
          />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Display-Only + All Beads Visible</h3>
        <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#666', maxWidth: '200px' }}>
          • All beads always visible<br/>
          • Inactive beads dimmed<br/>
          • No interactions<br/>
          • Static display
        </p>
        <div style={{
          border: '2px dashed #8e44ad',
          display: 'inline-block',
          padding: '15px',
          borderRadius: '8px'
        }}>
          <AbacusReact
            value={123}
            columns={3}
            beadShape="diamond"
            colorScheme="place-value"
            scaleFactor={1.1}
            interactive={false}
            hideInactiveBeads={false}
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
**Interactive vs Display-Only Behavior with Hidden Inactive Beads**

This story demonstrates the different opacity behaviors:

1. **Interactive + Hidden Inactive**:
   - Inactive beads start invisible (opacity 0)
   - Hover over abacus → inactive beads become semi-transparent (opacity 0.5)
   - Hover over specific bead → that bead becomes fully visible (opacity 1)
   - Click beads to toggle their state

2. **Display-Only + Hidden Inactive**:
   - Inactive beads are always invisible (opacity 0)
   - No hover effects - they remain hidden at all times
   - No user interactions possible

3. **All Beads Visible Modes**:
   - Interactive: Full interaction with visible inactive beads
   - Display-Only: Static display with no interactions

**Test Instructions**: Hover over each abacus to see the different opacity behaviors!
        `,
      },
    },
  },
};

// Interactive Abacus with Always Visible Numbers
export const InteractiveWithNumbers: Story = {
  render: () => {
    const [value, setValue] = React.useState(456);
    const [beadClicks, setBeadClicks] = React.useState(0);
    const [valueChanges, setValueChanges] = React.useState(0);
    const lastValueRef = React.useRef(456);

    const handleBeadClick = (bead: any) => {
      setBeadClicks(prev => prev + 1);
    };

    const handleValueChange = (newValue: number) => {
      setValue(newValue);

      // Only increment counter if the value actually changed
      if (newValue !== lastValueRef.current) {
        lastValueRef.current = newValue;
        setValueChanges(prev => prev + 1);
      }
    };

    return (
      <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#2c3e50' }}>
          🎯 Fully Interactive Abacus with Visible Numbers
        </h3>

        <div style={{
          marginBottom: '25px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          <div style={{ marginBottom: '10px' }}>
            <strong>Current Value: <span style={{ color: '#e74c3c', fontSize: '18px' }}>{value}</span></strong>
          </div>
          <div style={{ marginBottom: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><strong>Bead Clicks: {beadClicks}</strong></div>
            <div><strong>Value Changes: {valueChanges}</strong></div>
          </div>
          <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
            <strong>How to interact:</strong><br/>
            • <strong>Drag beads</strong> up/down with gestures<br/>
            • <strong>Click beads</strong> to toggle them<br/>
            • <strong>Click numbers</strong> below columns to edit directly<br/>
            • <strong>Use keyboard</strong> (0-9, arrows, Tab, Escape) when editing numbers
          </div>
        </div>

        <div style={{
          border: '3px solid #3498db',
          display: 'inline-block',
          padding: '20px',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <AbacusReact
            value={value}
            columns={3}
            beadShape="diamond"
            colorScheme="place-value"
            scaleFactor={1.3}
            interactive={true}
            showNumbers="always"
            animated={true}
            onClick={handleBeadClick}
            onValueChange={handleValueChange}
          />
        </div>

        <div style={{
          marginTop: '20px',
          fontSize: '12px',
          color: '#7f8c8d',
          lineHeight: '1.5'
        }}>
          <p><strong>✨ Features Demonstrated:</strong></p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'left' }}>
            <div>
              • Directional drag gestures<br/>
              • Click-to-toggle beads<br/>
              • NumberFlow editing
            </div>
            <div>
              • Value change callbacks<br/>
              • Keyboard navigation<br/>
              • Visual feedback
            </div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: `
**Complete Interactive Abacus Experience**

This story demonstrates the full interactive capabilities when both \`interactive={true}\` and \`showNumbers="always"\` are enabled:

**Bead Interactions:**
- **Drag Gestures**: Drag beads in natural directions (heaven beads down to activate, earth beads up to activate)
- **Click Toggle**: Click any bead to toggle its state
- **Visual Feedback**: Grab cursor on hover, smooth animations

**Number Editing:**
- **Click to Edit**: Click on any number below a column to enter edit mode
- **Keyboard Input**: Type 0-9 to change values, use arrows/Tab to navigate
- **Live Updates**: Changes immediately reflect in both the abacus and the value display

**Callbacks & State Management:**
- **onValueChange**: Fires whenever the abacus value changes (from any interaction)
- **onClick**: Fires when beads are clicked (receives bead information)
- **Real-time Updates**: Both interaction counters and value display update live

**Test Instructions:**
1. Try dragging beads up and down
2. Click beads to toggle them
3. Click the numbers below columns to edit them directly
4. Use keyboard navigation when editing numbers (Tab, arrows, 0-9, Escape)

This represents the most feature-complete abacus configuration for interactive applications!
        `,
      },
    },
  },
};

