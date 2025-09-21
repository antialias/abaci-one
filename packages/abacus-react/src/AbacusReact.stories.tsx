import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AbacusReact, useAbacusDimensions } from './AbacusReact';
import React, { useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

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
      control: { type: 'boolean' },
      description: 'Show place value numbers below each column',
    },
    onClick: { action: 'bead-clicked' },
    onValueChange: { action: 'value-changed' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Essential Use Cases
export const InteractiveAbacus: Story = {
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
      if (newValue !== lastValueRef.current) {
        lastValueRef.current = newValue;
        setValueChanges(prev => prev + 1);
      }
    };

    return (
      <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#2c3e50' }}>
          🎯 Interactive Abacus
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
            showNumbers={true}
            animated={true}
            onClick={handleBeadClick}
            onValueChange={handleValueChange}
          />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive abacus for teaching and practice. Users can drag beads, click to toggle, and edit numbers directly.',
      },
    },
  },
};

export const DisplayAbacus: Story = {
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    scaleFactor: 1,
    animated: true,
    interactive: false,
    showNumbers: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Static display abacus for showing values without user interaction.',
      },
    },
  },
};

export const CompactDisplay: Story = {
  args: {
    value: 999,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'monochrome',
    scaleFactor: 0.8,
    animated: false,
    interactive: false,
    showNumbers: false,
    hideInactiveBeads: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact display without numbers or inactive beads - ideal for embedding in content.',
      },
    },
  },
};

// Color Schemes
export const ColorSchemes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '30px', gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: '800px' }}>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Monochrome</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Traditional black/white scheme</p>
        <AbacusReact value={678} columns={3} colorScheme="monochrome" scaleFactor={0.9} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Place Value</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Each place has unique color</p>
        <AbacusReact value={1234} columns={4} colorScheme="place-value" scaleFactor={0.9} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Alternating</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Blue/green alternating columns</p>
        <AbacusReact value={555} columns={3} colorScheme="alternating" scaleFactor={0.9} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Heaven Earth</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Red heaven, blue earth beads</p>
        <AbacusReact value={789} columns={3} colorScheme="heaven-earth" scaleFactor={0.9} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison of all available color schemes for different visual preferences and learning styles.',
      },
    },
  },
};

// Bead Shapes
export const BeadShapes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Diamond</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Traditional shape</p>
        <AbacusReact value={42} columns={2} beadShape="diamond" colorScheme="place-value" scaleFactor={1.1} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Circle</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Modern rounded style</p>
        <AbacusReact value={42} columns={2} beadShape="circle" colorScheme="place-value" scaleFactor={1.1} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Square</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Geometric angular style</p>
        <AbacusReact value={42} columns={2} beadShape="square" colorScheme="place-value" scaleFactor={1.1} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison of available bead shapes: diamond (traditional), circle (modern), and square (geometric).',
      },
    },
  },
};

// Accessibility Features
export const AccessibilityPalettes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '30px', gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: '800px' }}>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Colorblind Friendly</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>High contrast, accessible colors</p>
        <AbacusReact value={12345} columns={5} colorScheme="place-value" colorPalette="colorblind" scaleFactor={0.7} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Grayscale</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Print-friendly monochrome</p>
        <AbacusReact value={1111} columns={4} colorScheme="place-value" colorPalette="grayscale" scaleFactor={0.7} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Mnemonic</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Memory-aid color associations</p>
        <AbacusReact value={6789} columns={4} colorScheme="place-value" colorPalette="mnemonic" scaleFactor={0.7} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Nature</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Earth-tone palette</p>
        <AbacusReact value={5432} columns={4} colorScheme="place-value" colorPalette="nature" scaleFactor={0.7} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Specialized color palettes for accessibility, printing, and memory aids.',
      },
    },
  },
};

// Scale Factor Sizes
export const ScaleFactors: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Small (0.7x)</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Compact for dense layouts</p>
        <AbacusReact value={123} columns={3} scaleFactor={0.7} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Normal (1.0x)</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Standard size</p>
        <AbacusReact value={123} columns={3} scaleFactor={1.0} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Large (1.5x)</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0' }}>Better visibility</p>
        <AbacusReact value={123} columns={3} scaleFactor={1.5} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different scale factors for various use cases: compact layouts, standard display, and enhanced visibility.',
      },
    },
  },
};

// Hidden Beads Behavior
export const HiddenBeadsBehavior: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Interactive + Hidden</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0', maxWidth: '180px' }}>
          Hover to reveal inactive beads<br/>
          Click beads to toggle them
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
            interactive={true}
            hideInactiveBeads={true}
            scaleFactor={1.1}
          />
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Display + Hidden</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0', maxWidth: '180px' }}>
          Inactive beads stay hidden<br/>
          No interactions
        </p>
        <div style={{
          border: '2px dashed #e74c3c',
          display: 'inline-block',
          padding: '15px',
          borderRadius: '8px'
        }}>
          <AbacusReact
            value={123}
            columns={3}
            interactive={false}
            hideInactiveBeads={true}
            scaleFactor={1.1}
          />
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>All Beads Visible</h4>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 15px 0', maxWidth: '180px' }}>
          Inactive beads are dimmed<br/>
          Always visible
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
            interactive={true}
            hideInactiveBeads={false}
            scaleFactor={1.1}
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates different behaviors for inactive beads: hidden with hover reveal, always hidden, and always visible.',
      },
    },
  },
};

// Tutorial and Customization Features
export const TutorialExample: Story = {
  render: () => {
    const [step, setStep] = React.useState(0);
    const [currentValue, setCurrentValue] = React.useState(123);
    const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);
    const beadRefs = React.useRef<Map<string, SVGElement>>(new Map());
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [showTooltip, setShowTooltip] = React.useState(true);

    const tutorialSteps = [
      {
        title: "Welcome to the Abacus Tutorial!",
        description: "Click on the highlighted bead to continue.",
        highlightBeads: [{ columnIndex: 4, beadType: 'earth' as const, position: 0 }],
        targetBead: { columnIndex: 4, beadType: 'earth' as const, position: 0 },
        overlays: [{
          id: 'welcome-tooltip',
          type: 'tooltip' as const,
          target: { type: 'bead' as const, columnIndex: 4, beadType: 'earth' as const, beadPosition: 0 },
          content: <div style={{
            background: '#333',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            position: 'relative',
            pointerEvents: 'none',
            transform: 'translateX(-50%) translateY(-100%)',
            whiteSpace: 'nowrap'
          }}>
            Click the highlighted orange bead!
            <div style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '0',
              height: '0',
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #333'
            }} />
          </div>,
          offset: { x: 0, y: -20 },
          visible: true
        }]
      },
      {
        title: "Great! Now try the ones column",
        description: "Click on any bead in the rightmost column.",
        highlightColumns: [2],
        targetColumn: 2
      },
      {
        title: "Perfect! Tutorial complete!",
        description: "You've learned the basics of using the abacus."
      }
    ];

    const currentStepData = tutorialSteps[step] || tutorialSteps[0];

    const handleBeadClick = (event: any) => {
      console.log('Bead clicked:', event);

      // Validate the click is for the current step's target
      const currentStep = tutorialSteps[step];
      let isCorrectTarget = false;

      if (step === 0) {
        // Step 1: Must click the specific highlighted bead (column 0, earth, position 0)
        const target = currentStep.highlightBeads?.[0];
        isCorrectTarget = target &&
          event.columnIndex === target.columnIndex &&
          event.beadType === target.beadType &&
          event.position === target.position;
      } else if (step === 1) {
        // Step 2: Must click any bead in the hundreds column (column 2)
        isCorrectTarget = event.columnIndex === 2;
      }

      if (isCorrectTarget && step < tutorialSteps.length - 1) {
        setShowTooltip(false); // Hide current tooltip
        setStep(step + 1);
        setTimeout(() => setShowTooltip(true), 100); // Show tooltip for next step after brief delay
        setFeedbackMessage('✅ Correct! Moving to next step...');
        setTimeout(() => setFeedbackMessage(null), 2000);
      } else if (!isCorrectTarget) {
        // Give feedback for incorrect clicks
        let message = 'Please follow the tutorial instructions.';
        if (step === 0) {
          message = '⚠️ Click the highlighted orange bead in the hundreds column (leftmost).';
        } else if (step === 1) {
          message = '⚠️ Click any bead in the ones column (rightmost column).';
        }
        setFeedbackMessage(message);
        setTimeout(() => setFeedbackMessage(null), 3000);
      }
    };

    const handleBeadRef = (bead: any, element: SVGElement | null) => {
      const key = `${bead.columnIndex}-${bead.type}-${bead.position}`;
      if (element) {
        beadRefs.current.set(key, element);
      } else {
        beadRefs.current.delete(key);
      }
    };

    // Get the target bead element for the current step
    const getTargetBeadElement = () => {
      const targetBead = currentStepData.targetBead;
      if (!targetBead) return null;

      const key = `${targetBead.columnIndex}-${targetBead.beadType}-${targetBead.position}`;
      return beadRefs.current.get(key) || null;
    };

    const customStyles = {
      // Highlight specific beads with bright colors
      columns: {
        [currentStepData.highlightColumns?.[0] || -1]: {
          heavenBeads: { stroke: '#ff6b35', strokeWidth: 3 },
          earthBeads: { stroke: '#ff6b35', strokeWidth: 3 }
        }
      },
      // Individual bead highlighting
      beads: currentStepData.highlightBeads?.reduce((acc, bead) => ({
        ...acc,
        [bead.columnIndex]: {
          [bead.beadType]: bead.beadType === 'earth' && bead.position !== undefined
            ? { [bead.position]: { fill: '#ff6b35', stroke: '#d63031', strokeWidth: 2 } }
            : { fill: '#ff6b35', stroke: '#d63031', strokeWidth: 2 }
        }
      }), {})
    };

    return (
      <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <style>{`
          @keyframes fadeInRight {
            from {
              opacity: 0;
              transform: translateY(-50%) translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(-50%) translateX(0);
            }
          }
        `}</style>
        <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>
          🎓 Interactive Tutorial System
        </h3>

        <div style={{
          background: '#f8f9fa',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #e9ecef'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#495057' }}>
            Step {step + 1} of {tutorialSteps.length}: {currentStepData.title}
          </h4>
          <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
            {currentStepData.description}
          </p>
        </div>


        <Tooltip.Provider>
          <div
            ref={(el) => {
              if (el) containerRef.current = el;
            }}
            style={{ position: 'relative' }}
          >
            <AbacusReact
              value={currentValue}
              columns={3}
              interactive={true}
              showNumbers={true}
              scaleFactor={1.2}
              customStyles={customStyles}
              highlightColumns={currentStepData.highlightColumns}
              highlightBeads={currentStepData.highlightBeads}
              callbacks={{
                onBeadClick: handleBeadClick,
                onValueChange: setCurrentValue,
                onBeadRef: handleBeadRef
              }}
              overlays={showTooltip && currentStepData.overlays ? currentStepData.overlays : []}
            />

            {/* Floating feedback toast - positioned to the right side */}
            {feedbackMessage && (
              <div style={{
                position: 'absolute',
                top: '50%',
                right: '-320px',
                transform: 'translateY(-50%)',
                background: feedbackMessage.startsWith('✅') ? '#d4edda' : '#f8d7da',
                color: feedbackMessage.startsWith('✅') ? '#155724' : '#721c24',
                padding: '12px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                border: `1px solid ${feedbackMessage.startsWith('✅') ? '#c3e6cb' : '#f5c6cb'}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1001,
                pointerEvents: 'none',
                maxWidth: '280px',
                textAlign: 'center',
                animation: feedbackMessage ? 'fadeInRight 0.3s ease-out' : undefined
              }}>
                {feedbackMessage}
              </div>
            )}
          </div>
        </Tooltip.Provider>

        <div style={{ marginTop: '20px' }}>
          <button
            onClick={() => {
              setStep(0);
              setShowTooltip(true);
              setFeedbackMessage(null);
            }}
            style={{
              padding: '8px 16px',
              marginRight: '10px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Restart Tutorial
          </button>
          <button
            onClick={() => setStep(Math.min(step + 1, tutorialSteps.length - 1))}
            style={{
              padding: '8px 16px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Next Step
          </button>
        </div>

        <div style={{ marginTop: '20px', fontSize: '12px', color: '#6c757d' }}>
          <p><strong>Features demonstrated:</strong></p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'left' }}>
            <div>
              • Custom bead styling<br/>
              • Column highlighting<br/>
              • Individual bead targeting
            </div>
            <div>
              • Tooltip overlays<br/>
              • Granular click callbacks<br/>
              • Bead element refs for precise positioning<br/>
              • Tutorial state management
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
**Advanced Tutorial System Example**

This story demonstrates the comprehensive customization API for building interactive tutorials:

**Customization Features:**
- \`customStyles\`: Granular styling control for beads, columns, and UI elements
- \`highlightColumns\`: Highlight entire columns with custom styling
- \`highlightBeads\`: Target specific beads for emphasis
- \`callbacks.onBeadClick\`: Detailed click event information for each bead
- \`callbacks.onBeadRef\`: Access to individual bead DOM elements for precise positioning
- \`overlays\`: Inject tooltips, arrows, and custom markup positioned relative to abacus elements

**Tutorial Patterns:**
- Step-by-step guided interactions
- Visual highlighting and emphasis
- Contextual tooltips and help text
- State-driven customization changes
- Progress tracking and navigation

**Use Cases:**
- Interactive learning applications
- Step-by-step math tutorials
- Guided practice exercises
- Assessment and testing tools
- Accessibility enhancements

This API provides everything needed to build sophisticated educational interfaces around the abacus component.
        `,
      },
    },
  },
};

// Developer Reference
export const DeveloperReference: Story = {
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
        story: 'All controls available for testing. Use the useAbacusDimensions hook for layout planning.',
      },
    },
    controls: { expanded: true },
  },
};