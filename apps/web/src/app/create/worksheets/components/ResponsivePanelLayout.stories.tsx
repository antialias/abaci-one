import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ResponsivePanelLayout } from './ResponsivePanelLayout'
import { PagePlaceholder } from './PagePlaceholder'
import type { WorksheetFormState } from '../types'

const meta = {
  title: 'Worksheets/Layout/ResponsivePanelLayout',
  component: ResponsivePanelLayout,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ResponsivePanelLayout>

export default meta
type Story = StoryObj<typeof meta>

// Mock sidebar content
function MockSidebar() {
  return (
    <div style={{ padding: '20px', background: '#f9fafb', height: '100%' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>
        Worksheet Settings
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 500,
              display: 'block',
              marginBottom: '4px',
            }}
          >
            Operator
          </label>
          <select style={{ width: '100%', padding: '6px', fontSize: '12px' }}>
            <option>Addition (+)</option>
            <option>Subtraction (−)</option>
            <option>Mixed (±)</option>
          </select>
        </div>
        <div>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 500,
              display: 'block',
              marginBottom: '4px',
            }}
          >
            Digit Range
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              value={2}
              style={{ width: '60px', padding: '6px', fontSize: '12px' }}
            />
            <span style={{ fontSize: '12px' }}>to</span>
            <input
              type="number"
              value={3}
              style={{ width: '60px', padding: '6px', fontSize: '12px' }}
            />
          </div>
        </div>
        <div>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 500,
              display: 'block',
              marginBottom: '4px',
            }}
          >
            Problems Per Page
          </label>
          <input
            type="number"
            value={20}
            style={{ width: '100%', padding: '6px', fontSize: '12px' }}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 500,
              display: 'block',
              marginBottom: '4px',
            }}
          >
            Pages
          </label>
          <input
            type="number"
            value={5}
            style={{ width: '100%', padding: '6px', fontSize: '12px' }}
          />
        </div>
      </div>
    </div>
  )
}

// Mock preview content with virtual loading demonstration
function MockPreviewWithVirtualLoading({ pages = 5 }: { pages?: number }) {
  const [loadedPages, setLoadedPages] = useState(new Set([0]))

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        background: '#e5e7eb',
        padding: '20px',
      }}
      onScroll={(e) => {
        const container = e.currentTarget
        const scrollTop = container.scrollTop
        const clientHeight = container.clientHeight

        // Simulate loading pages as they come into view
        // Each page is about 1056px + 48px gap = 1104px
        const pageHeight = 1104
        const visiblePageStart = Math.floor(scrollTop / pageHeight)
        const visiblePageEnd = Math.ceil((scrollTop + clientHeight) / pageHeight)

        const newLoadedPages = new Set(loadedPages)
        for (let i = visiblePageStart; i <= Math.min(visiblePageEnd, pages - 1); i++) {
          if (!newLoadedPages.has(i)) {
            newLoadedPages.add(i)
            // Simulate async loading delay
            setTimeout(() => {
              setLoadedPages((prev) => new Set([...prev, i]))
            }, 500)
          }
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '48px',
          alignItems: 'center',
        }}
      >
        {Array.from({ length: pages }).map((_, index) => (
          <div key={index} style={{ width: '100%', maxWidth: '816px' }}>
            <PagePlaceholder
              pageNumber={index + 1}
              orientation="portrait"
              rows={5}
              cols={4}
              loading={!loadedPages.has(index)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

const mockConfig: Partial<WorksheetFormState> = {
  operator: 'addition',
  digitRange: { min: 2, max: 3 },
  problemsPerPage: 20,
  pages: 5,
  cols: 4,
}

export const DesktopLayout: Story = {
  args: {
    config: mockConfig,
    sidebarContent: <MockSidebar />,
    previewContent: <MockPreviewWithVirtualLoading pages={5} />,
  },
  render: () => (
    <div style={{ height: '100vh', width: '100vw' }}>
      <ResponsivePanelLayout
        config={mockConfig}
        sidebarContent={<MockSidebar />}
        previewContent={<MockPreviewWithVirtualLoading pages={5} />}
      />
    </div>
  ),
}

export const WithVirtualLoading: Story = {
  args: {
    config: mockConfig,
    sidebarContent: <MockSidebar />,
    previewContent: <MockPreviewWithVirtualLoading pages={20} />,
  },
  render: () => {
    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: '#eff6ff',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            maxWidth: '600px',
          }}
        >
          <strong>🎯 Virtual Loading Demo:</strong> Scroll down in the preview panel to see pages
          load on-demand. Pages show a loading state (spinning hourglass) while being fetched, then
          display the placeholder once loaded.
        </div>
        <ResponsivePanelLayout
          config={mockConfig}
          sidebarContent={<MockSidebar />}
          previewContent={<MockPreviewWithVirtualLoading pages={20} />}
        />
      </div>
    )
  },
}

export const SinglePage: Story = {
  args: {
    config: { ...mockConfig, pages: 1 },
    sidebarContent: <MockSidebar />,
    previewContent: <MockPreviewWithVirtualLoading pages={1} />,
  },
  render: () => (
    <div style={{ height: '100vh', width: '100vw' }}>
      <ResponsivePanelLayout
        config={{ ...mockConfig, pages: 1 }}
        sidebarContent={<MockSidebar />}
        previewContent={<MockPreviewWithVirtualLoading pages={1} />}
      />
    </div>
  ),
}

export const ManyPages: Story = {
  args: {
    config: { ...mockConfig, pages: 50 },
    sidebarContent: <MockSidebar />,
    previewContent: <MockPreviewWithVirtualLoading pages={50} />,
  },
  render: () => (
    <div style={{ height: '100vh', width: '100vw' }}>
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: '#fef3c7',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '13px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        }}
      >
        <strong>⚡ Performance:</strong> 50 pages × 20 problems = 1,000 problems. Virtual loading
        keeps it smooth!
      </div>
      <ResponsivePanelLayout
        config={{ ...mockConfig, pages: 50 }}
        sidebarContent={<MockSidebar />}
        previewContent={<MockPreviewWithVirtualLoading pages={50} />}
      />
    </div>
  ),
}

export const LandscapeOrientation: Story = {
  args: {
    config: { ...mockConfig, orientation: 'landscape' },
    sidebarContent: <MockSidebar />,
    previewContent: <MockPreviewWithVirtualLoading pages={5} />,
  },
  render: () => {
    function LandscapePreview() {
      const [loadedPages, setLoadedPages] = useState(new Set([0]))

      return (
        <div
          style={{
            height: '100%',
            overflow: 'auto',
            background: '#e5e7eb',
            padding: '20px',
          }}
          onScroll={(e) => {
            const container = e.currentTarget
            const scrollTop = container.scrollTop
            const clientHeight = container.clientHeight
            const pageHeight = 864 // 816px + 48px gap
            const visiblePageStart = Math.floor(scrollTop / pageHeight)
            const visiblePageEnd = Math.ceil((scrollTop + clientHeight) / pageHeight)

            const newLoadedPages = new Set(loadedPages)
            for (let i = visiblePageStart; i <= Math.min(visiblePageEnd, 4); i++) {
              if (!newLoadedPages.has(i)) {
                newLoadedPages.add(i)
                setTimeout(() => {
                  setLoadedPages((prev) => new Set([...prev, i]))
                }, 500)
              }
            }
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '48px',
              alignItems: 'center',
            }}
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} style={{ width: '100%', maxWidth: '1056px' }}>
                <PagePlaceholder
                  pageNumber={index + 1}
                  orientation="landscape"
                  rows={4}
                  cols={5}
                  loading={!loadedPages.has(index)}
                />
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <ResponsivePanelLayout
          config={{ ...mockConfig, orientation: 'landscape' }}
          sidebarContent={<MockSidebar />}
          previewContent={<LandscapePreview />}
        />
      </div>
    )
  },
}

export const ResizablePanels: Story = {
  args: {
    config: mockConfig,
    sidebarContent: <MockSidebar />,
    previewContent: <MockPreviewWithVirtualLoading pages={5} />,
  },
  render: () => (
    <div style={{ height: '100vh', width: '100vw' }}>
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: '#eff6ff',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '13px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        }}
      >
        <strong>↔️ Resizable:</strong> Drag the divider between panels to adjust the layout. Your
        preference is saved automatically!
      </div>
      <ResponsivePanelLayout
        config={mockConfig}
        sidebarContent={<MockSidebar />}
        previewContent={<MockPreviewWithVirtualLoading pages={5} />}
      />
    </div>
  ),
}
