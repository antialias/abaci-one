import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ConfigSidebar } from './ConfigSidebar'
import { WorksheetConfigProvider } from './WorksheetConfigContext'
import type { WorksheetFormState } from '../types'

const meta = {
  title: 'Worksheets/Config Panel/ConfigSidebar',
  component: ConfigSidebar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ConfigSidebar>

export default meta
type Story = StoryObj<typeof meta>

const mockFormState: WorksheetFormState = {
  operator: 'addition',
  mode: 'manual',
  digitRange: { min: 2, max: 3 },
  problemsPerPage: 20,
  pages: 5,
  cols: 4,
  orientation: 'portrait',
  name: 'Student Name',
  displayRules: {
    tenFrames: 'sometimes',
    carryBoxes: 'sometimes',
    placeValueColors: 'sometimes',
    answerBoxes: 'always',
    problemNumbers: 'always',
    cellBorders: 'always',
    borrowNotation: 'never',
    borrowingHints: 'never',
  },
  pAnyStart: 0.3,
  pAllStart: 0.1,
  interpolate: false,
  seed: 12345,
}

// Wrapper to provide context
function SidebarWrapper({
  initialState,
  isSaving = false,
  lastSaved = null,
  isReadOnly = false,
}: {
  initialState?: Partial<WorksheetFormState>
  isSaving?: boolean
  lastSaved?: Date | null
  isReadOnly?: boolean
}) {
  const [formState, setFormState] = useState<WorksheetFormState>({
    ...mockFormState,
    ...initialState,
  })

  const updateFormState = (updates: Partial<WorksheetFormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }))
  }

  return (
    <div
      style={{
        height: '100vh',
        width: '400px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <WorksheetConfigProvider formState={formState} updateFormState={updateFormState}>
        <ConfigSidebar isSaving={isSaving} lastSaved={lastSaved} isReadOnly={isReadOnly} />
      </WorksheetConfigProvider>
    </div>
  )
}

export const DefaultState: Story = {
  render: () => <SidebarWrapper />,
}

export const Saving: Story = {
  render: () => <SidebarWrapper isSaving={true} />,
}

export const Saved: Story = {
  render: () => <SidebarWrapper lastSaved={new Date()} />,
}

export const ReadOnly: Story = {
  render: () => <SidebarWrapper isReadOnly={true} />,
}

export const AdditionMode: Story = {
  render: () => <SidebarWrapper initialState={{ operator: 'addition' }} />,
}

export const SubtractionMode: Story = {
  render: () => <SidebarWrapper initialState={{ operator: 'subtraction' }} />,
}

export const MixedMode: Story = {
  render: () => <SidebarWrapper initialState={{ operator: 'mixed' }} />,
}

export const SmartMode: Story = {
  render: () => (
    <SidebarWrapper
      initialState={{
        mode: 'custom',
        difficultyProfile: 'earlyLearner',
      }}
    />
  ),
}

export const MasteryMode: Story = {
  render: () => (
    <SidebarWrapper
      initialState={{
        mode: 'mastery',
        currentAdditionSkillId: 'add-2digit-no-regroup',
      }}
    />
  ),
}

export const LandscapeLayout: Story = {
  render: () => (
    <SidebarWrapper
      initialState={{
        orientation: 'landscape',
        cols: 5,
        problemsPerPage: 25,
      }}
    />
  ),
}

export const InteractiveTabs: Story = {
  render: () => {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          gap: '20px',
          padding: '20px',
        }}
      >
        <div style={{ width: '400px' }}>
          <SidebarWrapper />
        </div>
        <div
          style={{
            flex: 1,
            background: '#f3f4f6',
            borderRadius: '12px',
            padding: '20px',
            overflow: 'auto',
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
            Tab Navigation
          </h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontSize: '14px',
            }}
          >
            <div>
              <strong>📝 Content Tab:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>
                Choose operator (Addition, Subtraction, or Mixed) and select mode (Manual, Smart, or
                Mastery).
              </p>
            </div>
            <div>
              <strong>📐 Layout Tab:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>
                Configure page orientation, problems per page, number of pages, and column layout.
              </p>
            </div>
            <div>
              <strong>🎯 Scaffolding Tab:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>
                Control when visual aids appear (ten-frames, carry boxes, place value colors, etc.).
                Set rules like "always", "never", or "when regrouping".
              </p>
            </div>
            <div>
              <strong>⚡ Difficulty Tab:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>
                Adjust regrouping frequency, difficulty presets, and progressive difficulty
                settings.
              </p>
            </div>
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                background: '#eff6ff',
                borderRadius: '6px',
              }}
            >
              <strong>💡 Pro Tip:</strong>
              <p
                style={{
                  margin: '4px 0 0 0',
                  color: '#3b82f6',
                  fontSize: '13px',
                }}
              >
                Active tab is saved to sessionStorage. When you return, the same tab will be
                selected.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
}

export const AllTabsShowcase: Story = {
  render: () => {
    return (
      <div
        style={{
          height: '100vh',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '20px',
          padding: '20px',
        }}
      >
        {['operator', 'layout', 'scaffolding', 'difficulty'].map((tab) => {
          // Force tab by manipulating sessionStorage before mount
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('worksheet-config-active-tab', tab)
          }

          return (
            <div key={tab} style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  background: '#1f2937',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '6px 6px 0 0',
                  fontSize: '13px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {tab} Tab
              </div>
              <div
                style={{
                  flex: 1,
                  border: '2px solid #1f2937',
                  borderTop: 'none',
                }}
              >
                <SidebarWrapper />
              </div>
            </div>
          )
        })}
      </div>
    )
  },
}

export const ComparisonReadOnlyVsEditable: Story = {
  render: () => {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          gap: '20px',
          padding: '20px',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              background: '#3b82f6',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px 8px 0 0',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            ✏️ Editable
          </div>
          <div style={{ flex: 1, border: '2px solid #3b82f6', borderTop: 'none' }}>
            <SidebarWrapper isReadOnly={false} />
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              background: '#6b7280',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px 8px 0 0',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            👁️ Read-Only
          </div>
          <div style={{ flex: 1, border: '2px solid #6b7280', borderTop: 'none' }}>
            <SidebarWrapper isReadOnly={true} />
          </div>
        </div>
      </div>
    )
  },
}

export const DenseProblemsLayout: Story = {
  render: () => (
    <SidebarWrapper
      initialState={{
        problemsPerPage: 40,
        cols: 5,
        orientation: 'landscape',
      }}
    />
  ),
}

export const MinimalProblems: Story = {
  render: () => (
    <SidebarWrapper
      initialState={{
        problemsPerPage: 6,
        cols: 2,
        pages: 1,
      }}
    />
  ),
}

export const WithStudentName: Story = {
  render: () => <SidebarWrapper initialState={{ name: 'Alex Martinez' }} />,
}

export const EmptyStudentName: Story = {
  render: () => <SidebarWrapper initialState={{ name: '' }} />,
}
