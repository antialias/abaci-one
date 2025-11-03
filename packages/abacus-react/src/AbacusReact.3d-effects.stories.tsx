import type { Meta, StoryObj } from '@storybook/react';
import { AbacusReact } from './AbacusReact';
import React, { useEffect, useRef } from 'react';
import './Abacus3D.css';

const meta: Meta<typeof AbacusReact> = {
  title: 'Soroban/3D Effects Showcase',
  component: AbacusReact,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# 3D Enhancement Showcase

Three levels of progressive 3D enhancement for the abacus to make interactions feel satisfying and real.

## Proposal 1: Subtle (CSS Perspective + Shadows)
- Light perspective tilt
- Depth shadows on active beads
- Smooth transitions
- **Zero performance cost**

## Proposal 2: Realistic (Lighting + Materials)
- Everything from Proposal 1 +
- Realistic lighting effects
- Material-based bead rendering (glossy/satin/matte)
- Ambient occlusion
- Frame depth

## Proposal 3: Delightful (Physics + Micro-interactions)
- Everything from Proposal 2 +
- Enhanced physics with satisfying bounce
- Clack ripple effects when beads snap
- Hover parallax
- Maximum satisfaction

**Note:** Currently these are CSS-only demos. Full integration with React Spring physics coming next!
        `
      }
    }
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component to apply 3D CSS classes
const Wrapper3D: React.FC<{
  children: React.ReactNode;
  level: 'subtle' | 'realistic' | 'delightful';
  lighting?: 'top-down' | 'ambient' | 'dramatic';
}> = ({ children, level, lighting }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const svg = containerRef.current.querySelector('.abacus-svg');
      const beads = containerRef.current.querySelectorAll('.abacus-bead');

      // Add classes to container
      containerRef.current.classList.add('abacus-3d-container');
      containerRef.current.classList.add(`enhanced-${level}`);
      if (lighting) {
        containerRef.current.classList.add(`lighting-${lighting}`);
      }

      // Apply will-change for performance
      if (level === 'delightful') {
        beads.forEach(bead => {
          (bead as HTMLElement).style.willChange = 'transform, filter';
        });
      }
    }
  }, [level, lighting]);

  return <div ref={containerRef}>{children}</div>;
};

// ============================================
// PROPOSAL 1: SUBTLE
// ============================================

export const Subtle_Static: Story = {
  name: '1. Subtle - Static Display',
  render: () => (
    <Wrapper3D level="subtle">
      <AbacusReact
        value={12345}
        columns={5}
        showNumbers
        colorScheme="place-value"
        scaleFactor={1.2}
      />
    </Wrapper3D>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Subtle 3D with light perspective tilt and depth shadows. Notice the slight elevation of active beads.'
      }
    }
  }
};

export const Subtle_Interactive: Story = {
  name: '1. Subtle - Interactive',
  render: () => (
    <Wrapper3D level="subtle">
      <AbacusReact
        value={678}
        columns={3}
        showNumbers
        interactive
        animated
        soundEnabled
        colorScheme="heaven-earth"
        scaleFactor={1.2}
      />
    </Wrapper3D>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Subtle 3D + interaction. Click beads to see depth shadows change. Notice how the perspective gives a sense of physicality.'
      }
    }
  }
};

export const Subtle_Tutorial: Story = {
  name: '1. Subtle - Tutorial Mode',
  render: () => {
    const [step, setStep] = React.useState(0);
    const highlights = [
      { placeValue: 0, beadType: 'earth' as const, position: 2 },
      { placeValue: 1, beadType: 'heaven' as const },
      { placeValue: 2, beadType: 'earth' as const, position: 0 },
    ];

    return (
      <div style={{ textAlign: 'center' }}>
        <Wrapper3D level="subtle">
          <AbacusReact
            value={123}
            columns={3}
            showNumbers
            interactive
            animated
            highlightBeads={[highlights[step]]}
            colorScheme="place-value"
            scaleFactor={1.2}
          />
        </Wrapper3D>
        <div style={{ marginTop: '20px' }}>
          <button onClick={() => setStep((step + 1) % 3)} style={{ padding: '8px 16px' }}>
            Next Step ({step + 1}/3)
          </button>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Tutorial mode with subtle 3D effects. The depth helps highlight which bead to focus on.'
      }
    }
  }
};

// ============================================
// PROPOSAL 2: REALISTIC
// ============================================

export const Realistic_TopDown: Story = {
  name: '2. Realistic - Top-Down Lighting',
  render: () => (
    <Wrapper3D level="realistic" lighting="top-down">
      <AbacusReact
        value={24680}
        columns={5}
        showNumbers
        colorScheme="place-value"
        beadShape="circle"
        scaleFactor={1.2}
      />
    </Wrapper3D>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Realistic 3D with top-down lighting. Notice the enhanced shadows and sense of illumination from above.'
      }
    }
  }
};

export const Realistic_Ambient: Story = {
  name: '2. Realistic - Ambient Lighting',
  render: () => (
    <Wrapper3D level="realistic" lighting="ambient">
      <AbacusReact
        value={13579}
        columns={5}
        showNumbers
        colorScheme="place-value"
        beadShape="diamond"
        scaleFactor={1.2}
      />
    </Wrapper3D>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Realistic 3D with ambient lighting. Softer, more even illumination creates a cozy feel.'
      }
    }
  }
};

export const Realistic_Dramatic: Story = {
  name: '2. Realistic - Dramatic Lighting',
  render: () => (
    <Wrapper3D level="realistic" lighting="dramatic">
      <AbacusReact
        value={99999}
        columns={5}
        showNumbers
        colorScheme="heaven-earth"
        beadShape="square"
        colorPalette="colorblind"
        scaleFactor={1.2}
      />
    </Wrapper3D>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Realistic 3D with dramatic lighting. Strong directional light creates bold shadows and depth.'
      }
    }
  }
};

export const Realistic_Interactive: Story = {
  name: '2. Realistic - Interactive',
  render: () => (
    <Wrapper3D level="realistic" lighting="top-down">
      <AbacusReact
        value={555}
        columns={3}
        showNumbers
        interactive
        animated
        soundEnabled
        colorScheme="place-value"
        colorPalette="nature"
        scaleFactor={1.3}
      />
    </Wrapper3D>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Realistic 3D + interaction. Click beads and watch the enhanced shadows and lighting respond. Feel that satisfaction!'
      }
    }
  }
};

export const Realistic_AllShapes: Story = {
  name: '2. Realistic - All Bead Shapes',
  render: () => (
    <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Wrapper3D level="realistic" lighting="top-down">
          <AbacusReact
            value={777}
            columns={3}
            showNumbers
            beadShape="diamond"
            colorScheme="place-value"
          />
        </Wrapper3D>
        <p style={{ marginTop: '12px', fontSize: '14px' }}>Diamond</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <Wrapper3D level="realistic" lighting="top-down">
          <AbacusReact
            value={777}
            columns={3}
            showNumbers
            beadShape="circle"
            colorScheme="place-value"
          />
        </Wrapper3D>
        <p style={{ marginTop: '12px', fontSize: '14px' }}>Circle</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <Wrapper3D level="realistic" lighting="top-down">
          <AbacusReact
            value={777}
            columns={3}
            showNumbers
            beadShape="square"
            colorScheme="place-value"
          />
        </Wrapper3D>
        <p style={{ marginTop: '12px', fontSize: '14px' }}>Square</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Realistic 3D works beautifully with all three bead shapes.'
      }
    }
  }
};

// ============================================
// PROPOSAL 3: DELIGHTFUL
// ============================================

export const Delightful_Static: Story = {
  name: '3. Delightful - Maximum Depth',
  render: () => (
    <Wrapper3D level="delightful">
      <AbacusReact
        value={11111}
        columns={5}
        showNumbers
        colorScheme="alternating"
        beadShape="circle"
        colorPalette="mnemonic"
        scaleFactor={1.2}
      />
    </Wrapper3D>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Delightful 3D with maximum depth and richness. The beads really pop off the page!'
      }
    }
  }
};

export const Delightful_Interactive: Story = {
  name: '3. Delightful - Interactive (Physics Ready)',
  render: () => (
    <Wrapper3D level="delightful">
      <AbacusReact
        value={987}
        columns={3}
        showNumbers
        interactive
        animated
        soundEnabled
        colorScheme="place-value"
        scaleFactor={1.3}
      />
    </Wrapper3D>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Delightful 3D + interaction. This is the CSS foundation - physics effects (wobble, clack ripple) will be added in the next iteration. Already feels great!'
      }
    }
  }
};

export const Delightful_LargeScale: Story = {
  name: '3. Delightful - Large Scale',
  render: () => (
    <Wrapper3D level="delightful">
      <AbacusReact
        value={9876543210}
        columns={10}
        showNumbers
        colorScheme="place-value"
        scaleFactor={1}
      />
    </Wrapper3D>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Delightful 3D scales beautifully even with many columns. The depth hierarchy helps organize the visual.'
      }
    }
  }
};

// ============================================
// COMPARISON VIEWS
// ============================================

export const CompareAllLevels: Story = {
  name: 'Compare All Three Levels',
  render: () => {
    const value = 4242;
    const columns = 4;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '60px', padding: '20px' }}>
        {/* No 3D */}
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '20px', color: '#666' }}>
            No Enhancement (Current)
          </h3>
          <AbacusReact
            value={value}
            columns={columns}
            showNumbers
            colorScheme="place-value"
            scaleFactor={1.2}
          />
        </div>

        {/* Subtle */}
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '20px', color: '#666' }}>
            Proposal 1: Subtle 😊
          </h3>
          <Wrapper3D level="subtle">
            <AbacusReact
              value={value}
              columns={columns}
              showNumbers
              colorScheme="place-value"
              scaleFactor={1.2}
            />
          </Wrapper3D>
          <p style={{ fontSize: '12px', color: '#888', marginTop: '12px' }}>
            Light tilt + depth shadows
          </p>
        </div>

        {/* Realistic */}
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '20px', color: '#666' }}>
            Proposal 2: Realistic 😍
          </h3>
          <Wrapper3D level="realistic" lighting="top-down">
            <AbacusReact
              value={value}
              columns={columns}
              showNumbers
              colorScheme="place-value"
              scaleFactor={1.2}
            />
          </Wrapper3D>
          <p style={{ fontSize: '12px', color: '#888', marginTop: '12px' }}>
            Lighting + materials + ambient occlusion
          </p>
        </div>

        {/* Delightful */}
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '20px', color: '#666' }}>
            Proposal 3: Delightful 🤩
          </h3>
          <Wrapper3D level="delightful">
            <AbacusReact
              value={value}
              columns={columns}
              showNumbers
              colorScheme="place-value"
              scaleFactor={1.2}
            />
          </Wrapper3D>
          <p style={{ fontSize: '12px', color: '#888', marginTop: '12px' }}>
            Maximum depth + enhanced lighting (physics effects coming next!)
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Side-by-side comparison of all three enhancement levels. Which feels best to you?'
      }
    }
  }
};

export const CompareInteractive: Story = {
  name: 'Compare Interactive (Side-by-Side)',
  render: () => {
    const [value1, setValue1] = React.useState(123);
    const [value2, setValue2] = React.useState(456);
    const [value3, setValue3] = React.useState(789);

    return (
      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Subtle</h4>
          <Wrapper3D level="subtle">
            <AbacusReact
              value={value1}
              onValueChange={(v) => setValue1(Number(v))}
              columns={3}
              showNumbers
              interactive
              animated
              colorScheme="place-value"
            />
          </Wrapper3D>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Realistic</h4>
          <Wrapper3D level="realistic" lighting="top-down">
            <AbacusReact
              value={value2}
              onValueChange={(v) => setValue2(Number(v))}
              columns={3}
              showNumbers
              interactive
              animated
              colorScheme="place-value"
            />
          </Wrapper3D>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Delightful</h4>
          <Wrapper3D level="delightful">
            <AbacusReact
              value={value3}
              onValueChange={(v) => setValue3(Number(v))}
              columns={3}
              showNumbers
              interactive
              animated
              colorScheme="place-value"
            />
          </Wrapper3D>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Try all three side-by-side! Click beads and feel the difference in satisfaction.'
      }
    }
  }
};

// ============================================
// FEATURE TESTS
// ============================================

export const ColorSchemes_With3D: Story = {
  name: '3D Works With All Color Schemes',
  render: () => {
    const value = 333;
    const schemes: Array<'monochrome' | 'place-value' | 'alternating' | 'heaven-earth'> = [
      'monochrome',
      'place-value',
      'alternating',
      'heaven-earth'
    ];

    return (
      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {schemes.map(scheme => (
          <div key={scheme} style={{ textAlign: 'center' }}>
            <Wrapper3D level="realistic" lighting="top-down">
              <AbacusReact
                value={value}
                columns={3}
                showNumbers
                colorScheme={scheme}
              />
            </Wrapper3D>
            <p style={{ fontSize: '12px', marginTop: '8px', textTransform: 'capitalize' }}>
              {scheme}
            </p>
          </div>
        ))}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'The 3D effects work seamlessly with all existing color schemes.'
      }
    }
  }
};

export const ColorPalettes_With3D: Story = {
  name: '3D Works With All Palettes',
  render: () => {
    const value = 555;
    const palettes: Array<'default' | 'colorblind' | 'mnemonic' | 'grayscale' | 'nature'> = [
      'default',
      'colorblind',
      'mnemonic',
      'grayscale',
      'nature'
    ];

    return (
      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {palettes.map(palette => (
          <div key={palette} style={{ textAlign: 'center' }}>
            <Wrapper3D level="realistic" lighting="top-down">
              <AbacusReact
                value={value}
                columns={3}
                showNumbers
                colorScheme="place-value"
                colorPalette={palette}
              />
            </Wrapper3D>
            <p style={{ fontSize: '12px', marginTop: '8px', textTransform: 'capitalize' }}>
              {palette}
            </p>
          </div>
        ))}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'The 3D effects enhance all color palettes beautifully.'
      }
    }
  }
};
