import type { Meta, StoryObj } from '@storybook/react'
import { AbacusStatic } from './AbacusStatic'
import { AbacusReact } from './AbacusReact'

/**
 * Abacus Cropping - Automatic viewBox cropping to active beads
 *
 * ## Overview:
 * The `cropToActiveBeads` prop automatically crops the SVG viewBox to show only active beads,
 * making it perfect for:
 * - Compact inline displays
 * - Favicon generation (see /icon route)
 * - Focus on active beads without distraction
 * - Responsive layouts where space is limited
 *
 * ## Key Features:
 * - ✅ Works with both AbacusStatic and AbacusReact
 * - ✅ Configurable padding (top, bottom, left, right)
 * - ✅ Maintains aspect ratio
 * - ✅ Preserves frame elements (posts, bar) if enabled
 * - ✅ Dynamic cropping based on value
 *
 * ## API:
 * ```tsx
 * // Simple boolean
 * <AbacusStatic value={15} cropToActiveBeads />
 *
 * // With custom padding
 * <AbacusStatic
 *   value={15}
 *   cropToActiveBeads={{
 *     padding: { top: 8, bottom: 2, left: 5, right: 5 }
 *   }}
 * />
 * ```
 */
const meta = {
  title: 'AbacusStatic/Cropping',
  component: AbacusStatic,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AbacusStatic>

export default meta
type Story = StoryObj<typeof meta>

export const CroppedVsUncropped: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
          <AbacusStatic value={15} hideInactiveBeads />
        </div>
        <p style={{ marginTop: '10px', color: '#64748b' }}>Without Cropping</p>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>Full abacus frame shown</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ border: '2px solid #3b82f6', borderRadius: '8px', padding: '10px' }}>
          <AbacusStatic value={15} hideInactiveBeads cropToActiveBeads />
        </div>
        <p style={{ marginTop: '10px', color: '#3b82f6', fontWeight: 'bold' }}>With Cropping</p>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>Focused on active beads</p>
      </div>
    </div>
  ),
}

export const DifferentValues: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
      {[1, 5, 10, 15, 20, 25, 30, 31].map((value) => (
        <div key={value} style={{ textAlign: 'center' }}>
          <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '10px', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AbacusStatic
              value={value}
              columns={2}
              hideInactiveBeads
              cropToActiveBeads
              scaleFactor={1.2}
            />
          </div>
          <p style={{ marginTop: '10px', fontSize: '16px', fontWeight: 'bold', color: '#475569' }}>{value}</p>
        </div>
      ))}
    </div>
  ),
}

export const CustomPadding: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
          <AbacusStatic
            value={15}
            hideInactiveBeads
            cropToActiveBeads
          />
        </div>
        <p style={{ marginTop: '10px', color: '#64748b' }}>Default Padding</p>
        <p style={{ fontSize: '11px', color: '#94a3b8' }}>No custom padding</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
          <AbacusStatic
            value={15}
            hideInactiveBeads
            cropToActiveBeads={{ padding: { top: 20, bottom: 20, left: 20, right: 20 } }}
          />
        </div>
        <p style={{ marginTop: '10px', color: '#64748b' }}>Generous Padding</p>
        <p style={{ fontSize: '11px', color: '#94a3b8' }}>20px all around</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
          <AbacusStatic
            value={15}
            hideInactiveBeads
            cropToActiveBeads={{ padding: { top: 2, bottom: 2, left: 2, right: 2 } }}
          />
        </div>
        <p style={{ marginTop: '10px', color: '#64748b' }}>Tight Crop</p>
        <p style={{ fontSize: '11px', color: '#94a3b8' }}>2px minimal padding</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
          <AbacusStatic
            value={15}
            hideInactiveBeads
            cropToActiveBeads={{ padding: { top: 15, bottom: 2, left: 5, right: 5 } }}
          />
        </div>
        <p style={{ marginTop: '10px', color: '#64748b' }}>Asymmetric</p>
        <p style={{ fontSize: '11px', color: '#94a3b8' }}>More top space</p>
      </div>
    </div>
  ),
}

export const WithColorSchemes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
      {(['place-value', 'monochrome', 'heaven-earth', 'alternating'] as const).map((scheme) => (
        <div key={scheme} style={{ textAlign: 'center' }}>
          <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '10px', background: 'white' }}>
            <AbacusStatic
              value={123}
              colorScheme={scheme}
              hideInactiveBeads
              cropToActiveBeads
              scaleFactor={0.9}
            />
          </div>
          <p style={{ marginTop: '10px', color: '#64748b', fontSize: '14px' }}>
            {scheme.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </p>
        </div>
      ))}
    </div>
  ),
}

export const DifferentColumnCounts: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '15px', background: 'white' }}>
          <AbacusStatic
            value={9}
            columns={1}
            hideInactiveBeads
            cropToActiveBeads
            scaleFactor={1.5}
          />
        </div>
        <p style={{ marginTop: '10px', color: '#64748b' }}>1 Column</p>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>Value: 9</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '15px', background: 'white' }}>
          <AbacusStatic
            value={25}
            columns={2}
            hideInactiveBeads
            cropToActiveBeads
            scaleFactor={1.5}
          />
        </div>
        <p style={{ marginTop: '10px', color: '#64748b' }}>2 Columns</p>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>Value: 25</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '15px', background: 'white' }}>
          <AbacusStatic
            value={456}
            columns={3}
            hideInactiveBeads
            cropToActiveBeads
            scaleFactor={1.2}
          />
        </div>
        <p style={{ marginTop: '10px', color: '#64748b' }}>3 Columns</p>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>Value: 456</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '15px', background: 'white' }}>
          <AbacusStatic
            value={9876}
            columns={4}
            hideInactiveBeads
            cropToActiveBeads
            scaleFactor={1.0}
          />
        </div>
        <p style={{ marginTop: '10px', color: '#64748b' }}>4 Columns</p>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>Value: 9876</p>
      </div>
    </div>
  ),
}

export const InlineEquation: Story = {
  render: () => (
    <div style={{ fontSize: '32px', display: 'flex', alignItems: 'center', gap: '15px', fontFamily: 'system-ui' }}>
      <span>If</span>
      <div style={{ border: '2px solid #e2e8f0', borderRadius: '6px', padding: '5px', background: 'white' }}>
        <AbacusStatic value={5} columns={1} hideInactiveBeads cropToActiveBeads scaleFactor={1.2} />
      </div>
      <span>+</span>
      <div style={{ border: '2px solid #e2e8f0', borderRadius: '6px', padding: '5px', background: 'white' }}>
        <AbacusStatic value={3} columns={1} hideInactiveBeads cropToActiveBeads scaleFactor={1.2} />
      </div>
      <span>=</span>
      <div style={{ border: '2px solid #10b981', borderRadius: '6px', padding: '5px', background: '#f0fdf4' }}>
        <AbacusStatic value={8} columns={1} hideInactiveBeads cropToActiveBeads scaleFactor={1.2} />
      </div>
      <span>then what is</span>
      <div style={{ border: '2px solid #e2e8f0', borderRadius: '6px', padding: '5px', background: 'white' }}>
        <AbacusStatic value={10} columns={2} hideInactiveBeads cropToActiveBeads scaleFactor={1.0} />
      </div>
      <span>+</span>
      <div style={{ border: '2px solid #e2e8f0', borderRadius: '6px', padding: '5px', background: 'white' }}>
        <AbacusStatic value={15} columns={2} hideInactiveBeads cropToActiveBeads scaleFactor={1.0} />
      </div>
      <span>?</span>
    </div>
  ),
}

export const FaviconStyle: Story = {
  render: () => (
    <div>
      <p style={{ marginBottom: '20px', color: '#64748b', maxWidth: '600px' }}>
        These examples show how cropping is used for the dynamic favicon (see <code>/icon</code> route).
        Each day of the month gets its own cropped abacus icon.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '15px', maxWidth: '800px' }}>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
          <div key={day} style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              padding: '4px',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto'
            }}>
              <AbacusStatic
                value={day}
                columns={2}
                hideInactiveBeads
                cropToActiveBeads={{
                  padding: { top: 6, bottom: 2, left: 4, right: 4 }
                }}
                scaleFactor={0.8}
                customStyles={{
                  columnPosts: { fill: '#1c1917', stroke: '#0c0a09', strokeWidth: 2 },
                  reckoningBar: { fill: '#1c1917', stroke: '#0c0a09', strokeWidth: 3 },
                  columns: {
                    0: { heavenBeads: { fill: '#fbbf24', stroke: '#f59e0b', strokeWidth: 2 }, earthBeads: { fill: '#fbbf24', stroke: '#f59e0b', strokeWidth: 2 } },
                    1: { heavenBeads: { fill: '#a855f7', stroke: '#7e22ce', strokeWidth: 2 }, earthBeads: { fill: '#a855f7', stroke: '#7e22ce', strokeWidth: 2 } },
                  },
                }}
              />
            </div>
            <p style={{ marginTop: '8px', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>{day}</p>
          </div>
        ))}
      </div>
    </div>
  ),
}

export const AbacusReactCropping: Story = {
  render: () => (
    <div>
      <p style={{ marginBottom: '20px', color: '#64748b', maxWidth: '600px' }}>
        Cropping also works with <code>AbacusReact</code> (the interactive animated version).
        This is useful for interactive tutorials where you want to focus on specific beads.
      </p>
      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '15px', background: 'white' }}>
            <AbacusReact
              value={15}
              columns={2}
              hideInactiveBeads
              cropToActiveBeads
              animated
              interactive
              scaleFactor={1.5}
            />
          </div>
          <p style={{ marginTop: '10px', color: '#64748b' }}>Interactive + Cropped</p>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>Try clicking the beads!</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '15px', background: 'white' }}>
            <AbacusReact
              value={9}
              columns={1}
              hideInactiveBeads
              cropToActiveBeads={{ padding: { top: 10, bottom: 10, left: 10, right: 10 } }}
              animated
              interactive
              scaleFactor={2.0}
            />
          </div>
          <p style={{ marginTop: '10px', color: '#64748b' }}>Single Column</p>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>Value: 9</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '15px', background: 'white' }}>
            <AbacusReact
              value={456}
              columns={3}
              hideInactiveBeads
              cropToActiveBeads
              animated
              interactive
              scaleFactor={1.2}
              colorScheme="heaven-earth"
            />
          </div>
          <p style={{ marginTop: '10px', color: '#64748b' }}>Three Columns</p>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>Heaven-Earth colors</p>
        </div>
      </div>
    </div>
  ),
}

export const ComparisonGrid: Story = {
  render: () => {
    const testValues = [
      { value: 1, label: 'Minimal (1)' },
      { value: 5, label: 'Heaven only (5)' },
      { value: 4, label: 'Earth only (4)' },
      { value: 9, label: 'Maximum (9)' },
      { value: 15, label: 'Two columns (15)' },
      { value: 99, label: 'Two nines (99)' },
    ]

    return (
      <div>
        <p style={{ marginBottom: '20px', color: '#64748b', maxWidth: '700px' }}>
          Comparison showing how cropping adapts to different bead configurations.
          Notice how the viewBox changes dynamically based on active beads.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {testValues.map(({ value, label }) => (
            <div key={value}>
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#475569' }}>{label}</h4>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ border: '2px solid #e2e8f0', borderRadius: '6px', padding: '10px', minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AbacusStatic
                        value={value}
                        columns="auto"
                        hideInactiveBeads
                        scaleFactor={1.0}
                      />
                    </div>
                    <p style={{ marginTop: '5px', fontSize: '11px', color: '#94a3b8' }}>Normal</p>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ border: '2px solid #3b82f6', borderRadius: '6px', padding: '10px', minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff' }}>
                      <AbacusStatic
                        value={value}
                        columns="auto"
                        hideInactiveBeads
                        cropToActiveBeads
                        scaleFactor={1.0}
                      />
                    </div>
                    <p style={{ marginTop: '5px', fontSize: '11px', color: '#3b82f6', fontWeight: 'bold' }}>Cropped</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
}

export const BeadShapesWithCropping: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
      {(['circle', 'diamond', 'square'] as const).map((shape) => (
        <div key={shape} style={{ textAlign: 'center' }}>
          <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '15px', background: 'white' }}>
            <AbacusStatic
              value={25}
              columns={2}
              beadShape={shape}
              hideInactiveBeads
              cropToActiveBeads
              scaleFactor={1.5}
            />
          </div>
          <p style={{ marginTop: '10px', color: '#64748b', textTransform: 'capitalize' }}>{shape}</p>
        </div>
      ))}
    </div>
  ),
}
