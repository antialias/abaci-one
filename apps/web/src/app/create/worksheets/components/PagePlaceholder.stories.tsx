import type { Meta, StoryObj } from '@storybook/react'
import { PagePlaceholder } from './PagePlaceholder'

const meta = {
  title: 'Worksheets/Virtual Loading/PagePlaceholder',
  component: PagePlaceholder,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PagePlaceholder>

export default meta
type Story = StoryObj<typeof meta>

export const Portrait: Story = {
  args: {
    pageNumber: 1,
    orientation: 'portrait',
    rows: 5,
    cols: 4,
    loading: false,
  },
}

export const Landscape: Story = {
  args: {
    pageNumber: 1,
    orientation: 'landscape',
    rows: 4,
    cols: 5,
    loading: false,
  },
}

export const LoadingState: Story = {
  args: {
    pageNumber: 5,
    orientation: 'portrait',
    rows: 5,
    cols: 4,
    loading: true,
  },
}

export const LoadingLandscape: Story = {
  args: {
    pageNumber: 8,
    orientation: 'landscape',
    rows: 4,
    cols: 5,
    loading: true,
  },
}

export const TwoColumns: Story = {
  args: {
    pageNumber: 2,
    orientation: 'portrait',
    rows: 10,
    cols: 2,
    loading: false,
  },
}

export const FiveColumns: Story = {
  args: {
    pageNumber: 3,
    orientation: 'landscape',
    rows: 3,
    cols: 5,
    loading: false,
  },
}

export const VirtualScrollSimulation: Story = {
  render: () => {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '48px',
          padding: '20px',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <div>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>
            Virtual Scroll: Multi-Page Worksheet Loading
          </h3>
          <p
            style={{ marginBottom: '24px', fontSize: '13px', color: '#6b7280', maxWidth: '600px' }}
          >
            This demonstrates how placeholder pages appear during virtual scrolling. Pages load
            on-demand as they become visible in the viewport, showing a loading state while the SVG
            is being generated and fetched.
          </p>
        </div>

        {/* Page 1 - Already loaded */}
        <div>
          <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: '#059669' }}>
            ✓ Loaded
          </div>
          <div
            style={{
              border: '2px solid #10b981',
              borderRadius: '8px',
              padding: '8px',
              background: '#f0fdf4',
            }}
          >
            <PagePlaceholder
              pageNumber={1}
              orientation="portrait"
              rows={5}
              cols={4}
              loading={false}
            />
          </div>
        </div>

        {/* Page 2 - Loading */}
        <div>
          <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: '#f59e0b' }}>
            ⏳ Loading...
          </div>
          <div
            style={{
              border: '2px solid #f59e0b',
              borderRadius: '8px',
              padding: '8px',
              background: '#fffbeb',
            }}
          >
            <PagePlaceholder
              pageNumber={2}
              orientation="portrait"
              rows={5}
              cols={4}
              loading={true}
            />
          </div>
        </div>

        {/* Page 3 - Not yet visible */}
        <div>
          <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
            ⏸ Not yet loaded
          </div>
          <div
            style={{
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              padding: '8px',
              background: '#f9fafb',
            }}
          >
            <PagePlaceholder
              pageNumber={3}
              orientation="portrait"
              rows={5}
              cols={4}
              loading={false}
            />
          </div>
        </div>
      </div>
    )
  },
}

export const DenseLayout: Story = {
  args: {
    pageNumber: 1,
    orientation: 'portrait',
    rows: 8,
    cols: 3,
    loading: false,
  },
}

export const SparseLayout: Story = {
  args: {
    pageNumber: 1,
    orientation: 'landscape',
    rows: 2,
    cols: 4,
    loading: false,
  },
}

export const ComparisonView: Story = {
  render: () => {
    return (
      <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>Portrait</h4>
          <p style={{ marginBottom: '16px', fontSize: '12px', color: '#6b7280' }}>8.5" × 11"</p>
          <PagePlaceholder
            pageNumber={1}
            orientation="portrait"
            rows={5}
            cols={4}
            loading={false}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>Landscape</h4>
          <p style={{ marginBottom: '16px', fontSize: '12px', color: '#6b7280' }}>11" × 8.5"</p>
          <PagePlaceholder
            pageNumber={1}
            orientation="landscape"
            rows={4}
            cols={5}
            loading={false}
          />
        </div>
      </div>
    )
  },
}

export const LoadingAnimation: Story = {
  render: () => {
    return (
      <div>
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            background: '#eff6ff',
            borderRadius: '6px',
            fontSize: '13px',
          }}
        >
          <strong>ℹ️ Loading Behavior:</strong>
          <p style={{ margin: '8px 0 0 0' }}>
            Notice the spinning hourglass emoji and "Loading page X..." text. The entire placeholder
            pulses to indicate active loading. This appears when pages are being fetched from the
            API.
          </p>
        </div>
        <PagePlaceholder pageNumber={7} orientation="portrait" rows={5} cols={4} loading={true} />
      </div>
    )
  },
}
