import type { Meta, StoryObj } from '@storybook/react';
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


export const basicUsage: Story = {
  name: 'Basic Usage',
  args: {
  "value": 123,
  "columns": 3,
  "showNumbers": true,
  "scaleFactor": 1,
  "animated": false
},
  parameters: {
    docs: {
      description: {
        story: 'Simple abacus showing a number'
      }
    }
  }
};

export const interactive: Story = {
  name: 'Interactive Mode',
  args: {
  "value": 456,
  "columns": 3,
  "interactive": true,
  "animated": false,
  "showNumbers": true
},
  parameters: {
    docs: {
      description: {
        story: 'Clickable abacus with animations'
      }
    }
  }
};

export const customStyling: Story = {
  name: 'Custom Styling',
  args: {
  "value": 789,
  "columns": 3,
  "colorScheme": "place-value",
  "beadShape": "circle",
  "animated": false,
  "customStyles": {
    "heavenBeads": {
      "fill": "#ff6b35"
    },
    "earthBeads": {
      "fill": "#3498db"
    },
    "numerals": {
      "color": "#2c3e50",
      "fontWeight": "bold"
    }
  },
  "highlightBeads": [
    {
      "columnIndex": 1,
      "beadType": "heaven"
    }
  ]
},
  parameters: {
    docs: {
      description: {
        story: 'Personalized colors and highlights'
      }
    }
  }
};

export const tutorialMode: Story = {
  name: 'Tutorial System',
  args: {
  "value": 42,
  "columns": 2,
  "interactive": true,
  "animated": false,
  "showNumbers": true
},
  parameters: {
    docs: {
      description: {
        story: 'Educational guidance with tooltips'
      }
    }
  }
};

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
