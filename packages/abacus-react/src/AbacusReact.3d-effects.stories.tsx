import type { Meta, StoryObj } from '@storybook/react';
import { AbacusReact } from './AbacusReact';
import React from 'react';

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
- Realistic lighting effects with material gradients
- Glossy/Satin/Matte bead materials
- Wood grain textures on frame
- Enhanced physics for realistic motion

## Proposal 3: Delightful (Physics + Micro-interactions)
- Everything from Proposal 2 +
- Enhanced physics with satisfying bounce
- Hover parallax with Z-depth lift
- Maximum satisfaction
        `
      }
    }
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================
// SIDE-BY-SIDE COMPARISON
// ============================================

export const CompareAllLevels: Story = {
  name: '🎯 Compare All Levels',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '60px', alignItems: 'center' }}>
      <div>
        <h3 style={{ marginBottom: '10px', textAlign: 'center' }}>No Enhancement</h3>
        <AbacusReact
          value={4242}
          columns={4}
          showNumbers
          interactive
          animated
          colorScheme="place-value"
          scaleFactor={1.2}
        />
      </div>

      <div>
        <h3 style={{ marginBottom: '10px', textAlign: 'center' }}>Proposal 1: Subtle</h3>
        <AbacusReact
          value={4242}
          columns={4}
          showNumbers
          interactive
          animated
          colorScheme="place-value"
          scaleFactor={1.2}
          enhanced3d="subtle"
        />
      </div>

      <div>
        <h3 style={{ marginBottom: '10px', textAlign: 'center' }}>Proposal 2: Realistic (Satin Beads + Wood Frame)</h3>
        <AbacusReact
          value={4242}
          columns={4}
          showNumbers
          interactive
          animated
          colorScheme="place-value"
          scaleFactor={1.2}
          enhanced3d="realistic"
          material3d={{
            heavenBeads: 'satin',
            earthBeads: 'satin',
            lighting: 'top-down',
            woodGrain: true
          }}
        />
      </div>

      <div>
        <h3 style={{ marginBottom: '10px', textAlign: 'center' }}>Proposal 3: Delightful (Glossy + Parallax)</h3>
        <AbacusReact
          value={4242}
          columns={4}
          showNumbers
          interactive
          animated
          colorScheme="place-value"
          scaleFactor={1.2}
          enhanced3d="delightful"
          material3d={{
            heavenBeads: 'glossy',
            earthBeads: 'glossy',
            lighting: 'dramatic',
            woodGrain: true
          }}
          physics3d={{
            hoverParallax: true
          }}
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Side-by-side comparison of all three enhancement levels. **Click beads** to see how they move! **Hover over the Delightful version** to see parallax effect.'
      }
    }
  }
};

// ============================================
// PROPOSAL 1: SUBTLE
// ============================================

export const Subtle_Basic: Story = {
  name: '1️⃣ Subtle - Basic',
  args: {
    value: 12345,
    columns: 5,
    showNumbers: true,
    interactive: true,
    animated: true,
    colorScheme: 'place-value',
    scaleFactor: 1.2,
    enhanced3d: 'subtle'
  },
  parameters: {
    docs: {
      description: {
        story: 'Subtle 3D with light perspective tilt and depth shadows. Click beads to interact!'
      }
    }
  }
};

// ============================================
// PROPOSAL 2: REALISTIC (Materials)
// ============================================

export const Realistic_GlossyBeads: Story = {
  name: '2️⃣ Realistic - Glossy Beads',
  args: {
    value: 7890,
    columns: 4,
    showNumbers: true,
    interactive: true,
    animated: true,
    colorScheme: 'heaven-earth',
    scaleFactor: 1.3,
    enhanced3d: 'realistic',
    material3d: {
      heavenBeads: 'glossy',
      earthBeads: 'glossy',
      lighting: 'top-down'
    }
  },
  parameters: {
    docs: {
      description: {
        story: '**Glossy material** with high shine and strong highlights. Notice the radial gradients on the beads!'
      }
    }
  }
};

export const Realistic_SatinBeads: Story = {
  name: '2️⃣ Realistic - Satin Beads',
  args: {
    value: 7890,
    columns: 4,
    showNumbers: true,
    interactive: true,
    animated: true,
    colorScheme: 'heaven-earth',
    scaleFactor: 1.3,
    enhanced3d: 'realistic',
    material3d: {
      heavenBeads: 'satin',
      earthBeads: 'satin',
      lighting: 'top-down'
    }
  },
  parameters: {
    docs: {
      description: {
        story: '**Satin material** (default) with balanced shine. Medium highlights, smooth appearance.'
      }
    }
  }
};

export const Realistic_MatteBeads: Story = {
  name: '2️⃣ Realistic - Matte Beads',
  args: {
    value: 7890,
    columns: 4,
    showNumbers: true,
    interactive: true,
    animated: true,
    colorScheme: 'heaven-earth',
    scaleFactor: 1.3,
    enhanced3d: 'realistic',
    material3d: {
      heavenBeads: 'matte',
      earthBeads: 'matte',
      lighting: 'ambient'
    }
  },
  parameters: {
    docs: {
      description: {
        story: '**Matte material** with subtle shading, no shine. Flat, understated appearance.'
      }
    }
  }
};

export const Realistic_MixedMaterials: Story = {
  name: '2️⃣ Realistic - Mixed Materials',
  args: {
    value: 5678,
    columns: 4,
    showNumbers: true,
    interactive: true,
    animated: true,
    colorScheme: 'heaven-earth',
    scaleFactor: 1.3,
    enhanced3d: 'realistic',
    material3d: {
      heavenBeads: 'glossy',  // Heaven beads are shiny
      earthBeads: 'matte',    // Earth beads are flat
      lighting: 'dramatic'
    }
  },
  parameters: {
    docs: {
      description: {
        story: '**Mixed materials**: Glossy heaven beads (5-value) + Matte earth beads (1-value). Different visual weight!'
      }
    }
  }
};

export const Realistic_WoodGrain: Story = {
  name: '2️⃣ Realistic - Wood Grain Frame',
  args: {
    value: 3456,
    columns: 4,
    showNumbers: true,
    interactive: true,
    animated: true,
    colorScheme: 'monochrome',
    scaleFactor: 1.3,
    enhanced3d: 'realistic',
    material3d: {
      heavenBeads: 'satin',
      earthBeads: 'satin',
      lighting: 'top-down',
      woodGrain: true  // Enable wood texture on frame
    }
  },
  parameters: {
    docs: {
      description: {
        story: '**Wood grain texture** overlaid on the frame (rods and reckoning bar). Traditional soroban aesthetic!'
      }
    }
  }
};

export const Realistic_LightingComparison: Story = {
  name: '2️⃣ Realistic - Lighting Comparison',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'center' }}>
      <div>
        <h4 style={{ marginBottom: '10px', textAlign: 'center' }}>Top-Down Lighting</h4>
        <AbacusReact
          value={999}
          columns={3}
          showNumbers
          interactive
          animated
          colorScheme="place-value"
          scaleFactor={1.2}
          enhanced3d="realistic"
          material3d={{
            heavenBeads: 'glossy',
            earthBeads: 'glossy',
            lighting: 'top-down'
          }}
        />
      </div>

      <div>
        <h4 style={{ marginBottom: '10px', textAlign: 'center' }}>Ambient Lighting</h4>
        <AbacusReact
          value={999}
          columns={3}
          showNumbers
          interactive
          animated
          colorScheme="place-value"
          scaleFactor={1.2}
          enhanced3d="realistic"
          material3d={{
            heavenBeads: 'glossy',
            earthBeads: 'glossy',
            lighting: 'ambient'
          }}
        />
      </div>

      <div>
        <h4 style={{ marginBottom: '10px', textAlign: 'center' }}>Dramatic Lighting</h4>
        <AbacusReact
          value={999}
          columns={3}
          showNumbers
          interactive
          animated
          colorScheme="place-value"
          scaleFactor={1.2}
          enhanced3d="realistic"
          material3d={{
            heavenBeads: 'glossy',
            earthBeads: 'glossy',
            lighting: 'dramatic'
          }}
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Compare different **lighting styles**: top-down (balanced), ambient (soft all around), dramatic (strong directional).'
      }
    }
  }
};

// ============================================
// PROPOSAL 3: DELIGHTFUL (Physics)
// ============================================

export const Delightful_FullExperience: Story = {
  name: '3️⃣ Delightful - Full Experience',
  args: {
    value: 8642,
    columns: 4,
    showNumbers: true,
    interactive: true,
    animated: true,
    soundEnabled: true,
    colorScheme: 'rainbow',
    scaleFactor: 1.4,
    enhanced3d: 'delightful',
    material3d: {
      heavenBeads: 'glossy',
      earthBeads: 'satin',
      lighting: 'dramatic',
      woodGrain: true
    },
    physics3d: {
      hoverParallax: true
    }
  },
  parameters: {
    docs: {
      description: {
        story: '🎉 **Full delightful experience!** Click beads to see enhanced physics. Hover your mouse over the abacus to see parallax lift. Sound enabled for maximum satisfaction!'
      }
    }
  }
};

export const Delightful_HoverParallax: Story = {
  name: '3️⃣ Delightful - Hover Parallax',
  args: {
    value: 1234,
    columns: 4,
    showNumbers: true,
    interactive: true,
    animated: true,
    colorScheme: 'place-value',
    scaleFactor: 1.3,
    enhanced3d: 'delightful',
    material3d: {
      heavenBeads: 'satin',
      earthBeads: 'satin',
      lighting: 'ambient'
    },
    physics3d: {
      hoverParallax: true  // Enable hover parallax
    }
  },
  parameters: {
    docs: {
      description: {
        story: '**Hover parallax enabled!** Move your mouse over the abacus. Beads near your cursor will lift up with Z-depth. Creates magical depth perception!'
      }
    }
  }
};

export const Delightful_Traditional: Story = {
  name: '3️⃣ Delightful - Traditional Wood',
  args: {
    value: 99999,
    columns: 5,
    showNumbers: true,
    interactive: true,
    animated: true,
    colorScheme: 'monochrome',
    scaleFactor: 1.2,
    enhanced3d: 'delightful',
    material3d: {
      heavenBeads: 'matte',
      earthBeads: 'matte',
      lighting: 'ambient',
      woodGrain: true
    },
    physics3d: {
      hoverParallax: true
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Traditional aesthetic with **wood grain frame** + modern delightful physics. Best of both worlds!'
      }
    }
  }
};

// ============================================
// INTERACTIVE PLAYGROUND
// ============================================

export const Playground: Story = {
  name: '🎮 Interactive Playground',
  render: () => {
    const [level, setLevel] = React.useState<'subtle' | 'realistic' | 'delightful'>('delightful');
    const [material, setMaterial] = React.useState<'glossy' | 'satin' | 'matte'>('glossy');
    const [lighting, setLighting] = React.useState<'top-down' | 'ambient' | 'dramatic'>('dramatic');
    const [woodGrain, setWoodGrain] = React.useState(true);
    const [parallax, setParallax] = React.useState(true);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
          padding: '20px',
          background: '#f5f5f5',
          borderRadius: '8px',
          maxWidth: '600px'
        }}>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Enhancement Level</label>
            <select value={level} onChange={e => setLevel(e.target.value as any)} style={{ width: '100%', padding: '5px' }}>
              <option value="subtle">Subtle</option>
              <option value="realistic">Realistic</option>
              <option value="delightful">Delightful</option>
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Bead Material</label>
            <select value={material} onChange={e => setMaterial(e.target.value as any)} style={{ width: '100%', padding: '5px' }}>
              <option value="glossy">Glossy</option>
              <option value="satin">Satin</option>
              <option value="matte">Matte</option>
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Lighting</label>
            <select value={lighting} onChange={e => setLighting(e.target.value as any)} style={{ width: '100%', padding: '5px' }}>
              <option value="top-down">Top-Down</option>
              <option value="ambient">Ambient</option>
              <option value="dramatic">Dramatic</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input type="checkbox" checked={woodGrain} onChange={e => setWoodGrain(e.target.checked)} />
              <span>Wood Grain</span>
            </label>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input type="checkbox" checked={parallax} onChange={e => setParallax(e.target.checked)} />
              <span>Hover Parallax (Delightful)</span>
            </label>
          </div>
        </div>

        <AbacusReact
          value={6789}
          columns={4}
          showNumbers
          interactive
          animated
          soundEnabled
          colorScheme="rainbow"
          scaleFactor={1.4}
          enhanced3d={level}
          material3d={{
            heavenBeads: material,
            earthBeads: material,
            lighting: lighting,
            woodGrain: woodGrain
          }}
          physics3d={{
            hoverParallax: parallax
          }}
        />

        <p style={{ maxWidth: '500px', textAlign: 'center', color: '#666' }}>
          Click beads to interact! Try different combinations above to find your favorite look and feel.
        </p>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Experiment with all the 3D options! Mix and match materials, lighting, and physics to find your perfect configuration.'
      }
    }
  }
};
