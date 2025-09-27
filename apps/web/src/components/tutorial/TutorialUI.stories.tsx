import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { TutorialUIProvider, useTutorialUI } from './TutorialUIContext'
import { CoachBar } from './CoachBar/CoachBar'
import { ReasonTooltip } from './ReasonTooltip'
import type { PedagogicalSegment } from './DecompositionWithReasons'
import * as HoverCard from '@radix-ui/react-hover-card'
import './CoachBar/coachbar.css'
import './reason-tooltip.css'

// Enhanced demo components
function MockBeadTooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const ui = useTutorialUI()

  const handleOpenChange = (open: boolean) => {
    if (open) {
      const granted = ui.requestFocus('bead')
      if (granted) {
        setIsOpen(true)
      }
    } else {
      ui.releaseFocus('bead')
      setIsOpen(false)
    }
  }

  return (
    <HoverCard.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      openDelay={150}
      closeDelay={400}
    >
      <HoverCard.Trigger asChild>
        <div
          style={{
            width: '40px',
            height: '40px',
            backgroundColor: ui.hintFocus === 'bead' ? '#059669' : '#10b981',
            borderRadius: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            margin: '4px',
            opacity: ui.hintFocus === 'none' || ui.hintFocus === 'bead' ? 1 : 0.5,
            transition: 'all 0.2s ease',
            border: ui.hintFocus === 'bead' ? '2px solid #065f46' : '2px solid transparent'
          }}
        >
          {children}
        </div>
      </HoverCard.Trigger>

      <HoverCard.Portal>
        <HoverCard.Content
          style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #10b981',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            maxWidth: '250px',
            zIndex: 50
          }}
          sideOffset={8}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>🟢</span>
              <strong style={{ color: '#065f46' }}>Bead Movement</strong>
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: '#047857' }}>
              {content}
            </p>
          </div>
          <HoverCard.Arrow style={{ fill: '#ecfdf5', stroke: '#10b981' }} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}

function MockTermWithTooltip({
  children,
  segment,
  termIndex
}: {
  children: React.ReactNode
  segment: PedagogicalSegment
  termIndex: number
}) {
  return (
    <ReasonTooltip
      termIndex={termIndex}
      segment={segment}
      originalValue="50"
    >
      <span
        style={{
          display: 'inline-block',
          padding: '4px 8px',
          backgroundColor: '#dbeafe',
          border: '1px solid #3b82f6',
          borderRadius: '4px',
          cursor: 'pointer',
          margin: '0 2px',
          color: '#1e40af',
          fontFamily: 'monospace'
        }}
      >
        {children}
      </span>
    </ReasonTooltip>
  )
}

const createMockSegment = (overrides: Partial<PedagogicalSegment> = {}): PedagogicalSegment => ({
  id: 'demo-segment',
  place: 1,
  digit: 5,
  a: 0,
  L: 0,
  U: 0,
  goal: 'Add 5 to tens place',
  plan: [{
    rule: 'Direct',
    conditions: ['L+d <= 4'],
    explanation: ['Simple addition']
  }],
  expression: '50',
  termIndices: [0],
  termRange: { startIndex: 0, endIndex: 2 },
  readable: {
    title: 'Direct Move',
    subtitle: 'Heaven bead helps',
    summary: 'Add 5 to the tens place using the heaven bead.',
    chips: [
      { label: 'Digit being added', value: '5' },
      { label: 'Target place', value: 'tens' },
      { label: 'Rod shows', value: '0 (empty)' }
    ],
    stepsFriendly: ['Press the heaven bead down in tens column'],
    validation: { ok: true, issues: [] }
  },
  ...overrides
})

function IntegratedDemo() {
  const ui = useTutorialUI()
  const [currentSegment, setCurrentSegment] = useState(createMockSegment())

  const segments = [
    createMockSegment({
      id: 'step-1',
      readable: {
        title: 'Step 1: Direct Move',
        subtitle: 'Simple bead movement',
        summary: 'Add 3 to the ones place. It fits here, so just move 3 lower beads.',
        chips: [
          { label: 'Digit', value: '3' },
          { label: 'Place', value: 'ones' }
        ],
        stepsFriendly: ['Move 3 earth beads down'],
        validation: { ok: true, issues: [] }
      }
    }),
    createMockSegment({
      id: 'step-2',
      readable: {
        title: 'Step 2: Five Friend',
        subtitle: "Using 5's friend",
        summary: 'Add 7 to the ones place using 5\'s friend: press the heaven bead (5) and lift 2.',
        chips: [
          { label: 'Target', value: '7' },
          { label: 'Strategy', value: '5 + 2' }
        ],
        stepsFriendly: ['Press heaven bead', 'Lift 2 earth beads'],
        validation: { ok: true, issues: [] }
      }
    }),
    createMockSegment({
      id: 'step-3',
      readable: {
        title: 'Step 3: Ten Friend',
        subtitle: "Using 10's friend",
        summary: 'Add 8 to the ones place to make 10. Carry to tens place, then take 2 here.',
        chips: [
          { label: 'Target', value: '8' },
          { label: 'Strategy', value: '10 - 2' }
        ],
        stepsFriendly: ['Add 1 to tens', 'Subtract 2 from ones'],
        validation: { ok: true, issues: [] }
      }
    })
  ]

  // Update the active segment when buttons are clicked
  const handleStepChange = (segment: PedagogicalSegment) => {
    setCurrentSegment(segment)
    ui.setActiveSegment(segment)
  }

  return (
    <div style={{ height: '100vh', backgroundColor: '#f9fafb' }}>
      <CoachBar />

      <div style={{ padding: '20px' }}>
        <h2>Tutorial UI Integration Demo</h2>
        <p>This demonstrates the Coach Bar and single-owner tooltip gate working together.</p>

        {/* Focus status indicator */}
        <div style={{
          padding: '12px',
          backgroundColor: ui.hintFocus === 'none' ? '#f3f4f6' :
                          ui.hintFocus === 'term' ? '#dbeafe' : '#d1fae5',
          borderRadius: '6px',
          marginBottom: '20px',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          <strong>Current Focus:</strong> <code>{ui.hintFocus}</code>
          {ui.hintFocus !== 'none' && (
            <span style={{ marginLeft: '10px', fontSize: '12px', color: '#6b7280' }}>
              (Only {ui.hintFocus} tooltips can open)
            </span>
          )}
        </div>

        {/* Step navigation */}
        <div style={{ marginBottom: '30px' }}>
          <h3>Tutorial Steps</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            {segments.map((segment, index) => (
              <button
                key={segment.id}
                onClick={() => handleStepChange(segment)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: currentSegment.id === segment.id ? '#3b82f6' : '#e5e7eb',
                  color: currentSegment.id === segment.id ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: currentSegment.id === segment.id ? 'bold' : 'normal'
                }}
              >
                Step {index + 1}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Click the steps above to see how the Coach Bar updates with different content.
          </p>
        </div>

        {/* Mathematical expression with term tooltips */}
        <div style={{ marginBottom: '30px' }}>
          <h3>Mathematical Expression (Term Tooltips)</h3>
          <div style={{
            padding: '20px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '18px',
            fontFamily: 'monospace'
          }}>
            <span>27 + </span>
            <MockTermWithTooltip segment={currentSegment} termIndex={0}>
              50
            </MockTermWithTooltip>
            <span> + </span>
            <MockTermWithTooltip segment={currentSegment} termIndex={1}>
              30
            </MockTermWithTooltip>
            <span> = ?</span>
          </div>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '10px' }}>
            Hover over the blue terms to see pedagogical tooltips (term focus).
          </p>
        </div>

        {/* Abacus representation with bead tooltips */}
        <div style={{ marginBottom: '30px' }}>
          <h3>Abacus Representation (Bead Tooltips)</h3>
          <div style={{
            padding: '20px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px' }}>Hundreds</h4>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <MockBeadTooltip content="Heaven bead: Press down to add 5 to hundreds place">
                    ⚪
                  </MockBeadTooltip>
                  <div style={{ height: '2px', width: '50px', backgroundColor: '#8b5cf6', margin: '4px 0' }} />
                  <MockBeadTooltip content="Earth bead 1: Press down to add 1 to hundreds place">
                    🔵
                  </MockBeadTooltip>
                  <MockBeadTooltip content="Earth bead 2: Press down to add 1 to hundreds place">
                    🔵
                  </MockBeadTooltip>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px' }}>Tens</h4>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <MockBeadTooltip content="Heaven bead: Press down to add 5 to tens place">
                    ⚪
                  </MockBeadTooltip>
                  <div style={{ height: '2px', width: '50px', backgroundColor: '#8b5cf6', margin: '4px 0' }} />
                  <MockBeadTooltip content="Earth bead 1: Currently active for this step">
                    🔵
                  </MockBeadTooltip>
                  <MockBeadTooltip content="Earth bead 2: Press down to add 1 to tens place">
                    🔵
                  </MockBeadTooltip>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px' }}>Ones</h4>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <MockBeadTooltip content="Heaven bead: Press down to add 5 to ones place">
                    ⚪
                  </MockBeadTooltip>
                  <div style={{ height: '2px', width: '50px', backgroundColor: '#8b5cf6', margin: '4px 0' }} />
                  <MockBeadTooltip content="Earth bead 1: Press down to add 1 to ones place">
                    🔵
                  </MockBeadTooltip>
                  <MockBeadTooltip content="Earth bead 2: Press down to add 1 to ones place">
                    🔵
                  </MockBeadTooltip>
                </div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '10px' }}>
            Hover over the beads to see movement instructions (bead focus).
          </p>
        </div>

        {/* Testing instructions */}
        <div style={{
          padding: '16px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px'
        }}>
          <h4 style={{ margin: '0 0 10px', color: '#92400e' }}>🧪 Test the Single-Owner Gate:</h4>
          <ol style={{ margin: 0, paddingLeft: '20px', color: '#92400e' }}>
            <li>Hover over a blue mathematical term → term tooltip opens</li>
            <li>While keeping mouse over the term, try hovering a green bead → bead tooltip is blocked</li>
            <li>Move mouse away from term → term tooltip closes</li>
            <li>Now hover over a green bead → bead tooltip opens successfully</li>
            <li>Try hovering between beads → focus stays with bead tooltips</li>
            <li>Switch tutorial steps → Coach Bar updates with new content</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

const meta: Meta<typeof TutorialUIProvider> = {
  title: 'Tutorial/Complete Tutorial UI',
  component: TutorialUIProvider,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Complete integration demo showing the Coach Bar and single-owner tooltip gate working together in a realistic tutorial scenario.

This story demonstrates:
- **Coach Bar** showing contextual guidance
- **Term tooltips** explaining mathematical concepts
- **Bead tooltips** showing physical movements
- **Single-owner gate** ensuring only one tooltip type is active
- **Dynamic content** updating as tutorial progresses
        `
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Complete: Story = {
  render: () => (
    <TutorialUIProvider>
      <IntegratedDemo />
    </TutorialUIProvider>
  )
}

export const CoachBarOnly: Story = {
  render: () => (
    <TutorialUIProvider
      initialSegment={createMockSegment({
        readable: {
          title: 'Adding Large Numbers',
          subtitle: 'Multi-step process',
          summary: 'When adding 789 + 456, we break it down into place values and handle each column systematically.',
          chips: [
            { label: 'Problem', value: '789 + 456' },
            { label: 'Strategy', value: 'Column by column' }
          ],
          stepsFriendly: [],
          validation: { ok: true, issues: [] }
        }
      })}
    >
      <div style={{ height: '100vh', backgroundColor: '#f9fafb' }}>
        <CoachBar />
        <div style={{ padding: '20px' }}>
          <h2>Coach Bar Only Demo</h2>
          <p>This shows just the Coach Bar without the tooltip interactions.</p>
          <div style={{ height: '400px', backgroundColor: '#e5e7eb', borderRadius: '8px', padding: '20px' }}>
            <p>Tutorial content would go here...</p>
          </div>
        </div>
      </div>
    </TutorialUIProvider>
  )
}