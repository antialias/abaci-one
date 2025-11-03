import type { Meta, StoryObj } from '@storybook/react';
import { StandaloneBead } from './StandaloneBead';
import { AbacusDisplayProvider } from './AbacusContext';
import React from 'react';

const meta: Meta<typeof StandaloneBead> = {
  title: 'Soroban/Components/StandaloneBead',
  component: StandaloneBead,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A standalone bead component that can be used outside of the full abacus for icons, decorations, or UI elements. Respects AbacusDisplayContext for consistent styling.'
      }
    }
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Basic Examples
export const BasicDiamond: Story = {
  name: 'Basic Diamond',
  args: {
    size: 28,
    shape: 'diamond',
    color: '#000000',
    animated: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Default diamond-shaped bead'
      }
    }
  }
};

export const BasicCircle: Story = {
  name: 'Basic Circle',
  args: {
    size: 28,
    shape: 'circle',
    color: '#000000',
    animated: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Circle-shaped bead'
      }
    }
  }
};

export const BasicSquare: Story = {
  name: 'Basic Square',
  args: {
    size: 28,
    shape: 'square',
    color: '#000000',
    animated: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Square-shaped bead with rounded corners'
      }
    }
  }
};

// Size Variations
export const SizeVariations: Story = {
  name: 'Size Variations',
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead size={16} color="#8b5cf6" />
        <p style={{ fontSize: '12px', marginTop: '8px' }}>16px</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead size={28} color="#8b5cf6" />
        <p style={{ fontSize: '12px', marginTop: '8px' }}>28px (default)</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead size={40} color="#8b5cf6" />
        <p style={{ fontSize: '12px', marginTop: '8px' }}>40px</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead size={64} color="#8b5cf6" />
        <p style={{ fontSize: '12px', marginTop: '8px' }}>64px</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Beads scale to any size while maintaining proportions'
      }
    }
  }
};

// Color Variations
export const ColorPalette: Story = {
  name: 'Color Palette',
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', maxWidth: '400px' }}>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead color="#ef4444" size={32} />
        <p style={{ fontSize: '10px', marginTop: '4px' }}>Red</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead color="#f97316" size={32} />
        <p style={{ fontSize: '10px', marginTop: '4px' }}>Orange</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead color="#eab308" size={32} />
        <p style={{ fontSize: '10px', marginTop: '4px' }}>Yellow</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead color="#22c55e" size={32} />
        <p style={{ fontSize: '10px', marginTop: '4px' }}>Green</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead color="#3b82f6" size={32} />
        <p style={{ fontSize: '10px', marginTop: '4px' }}>Blue</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead color="#8b5cf6" size={32} />
        <p style={{ fontSize: '10px', marginTop: '4px' }}>Purple</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead color="#ec4899" size={32} />
        <p style={{ fontSize: '10px', marginTop: '4px' }}>Pink</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead color="#6b7280" size={32} />
        <p style={{ fontSize: '10px', marginTop: '4px' }}>Gray</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Beads support any hex color value'
      }
    }
  }
};

// Shape Comparison
export const AllShapes: Story = {
  name: 'All Shapes',
  render: () => (
    <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead shape="diamond" color="#8b5cf6" size={40} />
        <p style={{ fontSize: '12px', marginTop: '8px' }}>Diamond</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead shape="circle" color="#8b5cf6" size={40} />
        <p style={{ fontSize: '12px', marginTop: '8px' }}>Circle</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead shape="square" color="#8b5cf6" size={40} />
        <p style={{ fontSize: '12px', marginTop: '8px' }}>Square</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Compare all three available bead shapes'
      }
    }
  }
};

// Active vs Inactive
export const ActiveState: Story = {
  name: 'Active vs Inactive',
  render: () => (
    <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead color="#8b5cf6" size={40} active={true} />
        <p style={{ fontSize: '12px', marginTop: '8px' }}>Active</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <StandaloneBead color="#8b5cf6" size={40} active={false} />
        <p style={{ fontSize: '12px', marginTop: '8px' }}>Inactive (grayed out)</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Inactive beads are automatically rendered in gray'
      }
    }
  }
};

// With Context Provider
export const WithContextProvider: Story = {
  name: 'Using Context Provider',
  render: () => (
    <AbacusDisplayProvider initialConfig={{ beadShape: 'circle', colorScheme: 'place-value' }}>
      <div style={{ display: 'flex', gap: '20px' }}>
        <StandaloneBead size={40} color="#ef4444" />
        <StandaloneBead size={40} color="#f97316" />
        <StandaloneBead size={40} color="#eab308" />
        <StandaloneBead size={40} color="#22c55e" />
        <StandaloneBead size={40} color="#3b82f6" />
      </div>
    </AbacusDisplayProvider>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Beads inherit shape from AbacusDisplayProvider context. Here they are all circles because the provider sets beadShape to "circle".'
      }
    }
  }
};

// Use Case: Icon
export const AsIcon: Story = {
  name: 'As Icon',
  render: () => (
    <button
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        background: 'white',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500'
      }}
    >
      <StandaloneBead size={20} color="#8b5cf6" shape="circle" />
      Abacus Settings
    </button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Using StandaloneBead as an icon in buttons or UI elements'
      }
    }
  }
};

// Use Case: Decoration
export const AsDecoration: Story = {
  name: 'As Decoration',
  render: () => (
    <div style={{
      border: '2px solid #e5e7eb',
      borderRadius: '8px',
      padding: '20px',
      background: 'linear-gradient(to bottom right, #f9fafb, #ffffff)',
      maxWidth: '300px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <StandaloneBead size={24} color="#8b5cf6" shape="diamond" />
        <h3 style={{ margin: 0, fontSize: '18px' }}>Learning Progress</h3>
      </div>
      <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
        You've mastered basic addition! Keep practicing to improve your speed.
      </p>
      <div style={{ display: 'flex', gap: '4px', marginTop: '16px' }}>
        <StandaloneBead size={16} color="#22c55e" shape="circle" />
        <StandaloneBead size={16} color="#22c55e" shape="circle" />
        <StandaloneBead size={16} color="#22c55e" shape="circle" />
        <StandaloneBead size={16} color="#e5e7eb" shape="circle" active={false} />
        <StandaloneBead size={16} color="#e5e7eb" shape="circle" active={false} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Using beads as decorative elements in cards or panels'
      }
    }
  }
};

// Use Case: Progress Indicator
export const AsProgressIndicator: Story = {
  name: 'As Progress Indicator',
  render: () => {
    const [progress, setProgress] = React.useState(3);
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
          {[1, 2, 3, 4, 5].map((step) => (
            <StandaloneBead
              key={step}
              size={32}
              color="#8b5cf6"
              shape="circle"
              active={step <= progress}
            />
          ))}
        </div>
        <p style={{ fontSize: '14px', marginBottom: '12px' }}>Step {progress} of 5</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            onClick={() => setProgress(Math.max(1, progress - 1))}
            disabled={progress === 1}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              background: progress === 1 ? '#f3f4f6' : 'white',
              cursor: progress === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          <button
            onClick={() => setProgress(Math.min(5, progress + 1))}
            disabled={progress === 5}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              background: progress === 5 ? '#f3f4f6' : 'white',
              cursor: progress === 5 ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive progress indicator using beads'
      }
    }
  }
};

// Animated
export const Animated: Story = {
  name: 'With Animation',
  args: {
    size: 40,
    color: '#8b5cf6',
    animated: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Beads support React Spring animations (subtle scale effect)'
      }
    }
  }
};
