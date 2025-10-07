import * as HoverCard from '@radix-ui/react-hover-card'
import type { Meta, StoryObj } from '@storybook/react'
import type React from 'react'
import { useState } from 'react'
import { TutorialUIProvider, useTutorialUI } from './TutorialUIContext'

// Demo tooltip component that uses the focus gate
function DemoTooltip({
  children,
  content,
  hintType,
}: {
  children: React.ReactNode
  content: string
  hintType: 'term' | 'bead'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const ui = useTutorialUI()

  const handleOpenChange = (open: boolean) => {
    if (open) {
      const granted = ui.requestFocus(hintType)
      if (granted) {
        setIsOpen(true)
      }
    } else {
      ui.releaseFocus(hintType)
      setIsOpen(false)
    }
  }

  const isActive = ui.hintFocus === hintType
  const bgColor = hintType === 'term' ? '#3b82f6' : '#10b981'
  const activeBg = hintType === 'term' ? '#1d4ed8' : '#047857'

  return (
    <HoverCard.Root open={isOpen} onOpenChange={handleOpenChange} openDelay={100} closeDelay={200}>
      <HoverCard.Trigger asChild>
        <button
          style={{
            padding: '8px 16px',
            margin: '4px',
            backgroundColor: isActive ? activeBg : bgColor,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: isActive ? 'bold' : 'normal',
            opacity: ui.hintFocus === 'none' || ui.hintFocus === hintType ? 1 : 0.5,
            transition: 'all 0.2s ease',
          }}
        >
          {children}
        </button>
      </HoverCard.Trigger>

      <HoverCard.Portal>
        <HoverCard.Content
          style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            maxWidth: '300px',
            zIndex: 50,
          }}
          sideOffset={8}
        >
          <div>
            <strong>{hintType === 'term' ? '📝 Term Tooltip' : '🟢 Bead Tooltip'}</strong>
            <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#6b7280' }}>{content}</p>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#9ca3af' }}>
              Focus owner: <code>{ui.hintFocus}</code>
            </p>
          </div>
          <HoverCard.Arrow />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}

function FocusStatus() {
  const ui = useTutorialUI()

  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: '#f3f4f6',
        borderRadius: '6px',
        marginBottom: '20px',
        fontFamily: 'monospace',
        fontSize: '14px',
      }}
    >
      <strong>Focus Status:</strong> <code>{ui.hintFocus}</code>
      <br />
      <small style={{ color: '#6b7280' }}>Only one tooltip type can have focus at a time</small>
    </div>
  )
}

function TooltipGateDemo() {
  return (
    <div style={{ padding: '20px' }}>
      <h3>Single-Owner Tooltip Gate Demo</h3>
      <p>Try hovering over these buttons. Only one tooltip can be open at a time:</p>

      <FocusStatus />

      <div style={{ marginBottom: '30px' }}>
        <h4>Term Tooltips (Blue)</h4>
        <DemoTooltip hintType="term" content="This explains what the mathematical term means.">
          Hover: Term A
        </DemoTooltip>
        <DemoTooltip hintType="term" content="This shows reasoning for this part of the equation.">
          Hover: Term B
        </DemoTooltip>
        <DemoTooltip hintType="term" content="This demonstrates the calculation step.">
          Hover: Term C
        </DemoTooltip>
      </div>

      <div>
        <h4>Bead Tooltips (Green)</h4>
        <DemoTooltip hintType="bead" content="This shows which bead to move and how.">
          Hover: Bead 1
        </DemoTooltip>
        <DemoTooltip hintType="bead" content="This explains the physical movement required.">
          Hover: Bead 2
        </DemoTooltip>
        <DemoTooltip hintType="bead" content="This guides the hand position for this action.">
          Hover: Bead 3
        </DemoTooltip>
      </div>

      <div
        style={{
          marginTop: '30px',
          padding: '16px',
          backgroundColor: '#fff3cd',
          borderRadius: '6px',
          border: '1px solid #ffeaa7',
        }}
      >
        <h4>🧪 Test the Gate:</h4>
        <ol>
          <li>Hover over a blue "Term" button → tooltip opens</li>
          <li>
            While keeping mouse on blue button, try hovering green "Bead" button → green tooltip
            blocked
          </li>
          <li>Move mouse away from blue button → blue tooltip closes</li>
          <li>Now hover green "Bead" button → green tooltip opens</li>
          <li>Try hovering another green button → focus transfers between green tooltips</li>
        </ol>
      </div>
    </div>
  )
}

const meta: Meta<typeof TutorialUIProvider> = {
  title: 'Tutorial/TutorialUIContext',
  component: TutorialUIProvider,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The TutorialUIContext provides a single-owner tooltip gate system for tutorial interfaces. It ensures only one type of tooltip (term or bead) can be active at a time.

**Key Features:**
- **Single-owner focus**: Only 'term' OR 'bead' tooltips can be open at once
- **Focus ownership**: \`requestFocus()\` returns true if granted, false if denied
- **Active segment tracking**: Manages current pedagogical segment for Coach Bar
- **Debug logging**: Console logs focus conflicts in development mode
- **Graceful fallbacks**: Safe operation outside tutorial context

**Focus States:**
- \`'none'\`: No tooltips have focus (initial state)
- \`'term'\`: Term tooltips own focus (bead tooltips blocked)
- \`'bead'\`: Bead tooltips own focus (term tooltips blocked)
        `,
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const TooltipGate: Story = {
  render: () => (
    <TutorialUIProvider>
      <TooltipGateDemo />
    </TutorialUIProvider>
  ),
}

export const MultipleProviders: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '20px' }}>
      <div style={{ border: '2px solid #3b82f6', borderRadius: '8px', padding: '16px' }}>
        <h3 style={{ color: '#3b82f6', marginTop: 0 }}>Tutorial A</h3>
        <TutorialUIProvider>
          <FocusStatus />
          <DemoTooltip hintType="term" content="Term tooltip in Tutorial A">
            Tutorial A - Term
          </DemoTooltip>
          <DemoTooltip hintType="bead" content="Bead tooltip in Tutorial A">
            Tutorial A - Bead
          </DemoTooltip>
        </TutorialUIProvider>
      </div>

      <div style={{ border: '2px solid #10b981', borderRadius: '8px', padding: '16px' }}>
        <h3 style={{ color: '#10b981', marginTop: 0 }}>Tutorial B</h3>
        <TutorialUIProvider>
          <FocusStatus />
          <DemoTooltip hintType="term" content="Term tooltip in Tutorial B">
            Tutorial B - Term
          </DemoTooltip>
          <DemoTooltip hintType="bead" content="Bead tooltip in Tutorial B">
            Tutorial B - Bead
          </DemoTooltip>
        </TutorialUIProvider>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Each TutorialUIProvider creates an independent tooltip gate. Tooltips in different tutorials can be open simultaneously.',
      },
    },
  },
}

export const FocusDebugger: Story = {
  render: () => {
    function DebugPanel() {
      const ui = useTutorialUI()
      const [logs, setLogs] = useState<string[]>([])

      // Mock requesting focus programmatically
      const testRequest = (type: 'term' | 'bead') => {
        const granted = ui.requestFocus(type)
        const timestamp = new Date().toLocaleTimeString()
        setLogs((prev) => [
          ...prev.slice(-10),
          `${timestamp}: Request ${type} → ${granted ? 'GRANTED' : 'DENIED'}`,
        ])
      }

      const testRelease = (type: 'term' | 'bead') => {
        ui.releaseFocus(type)
        const timestamp = new Date().toLocaleTimeString()
        setLogs((prev) => [...prev.slice(-10), `${timestamp}: Released ${type}`])
      }

      return (
        <div style={{ padding: '20px' }}>
          <h3>Focus Debugger</h3>

          <FocusStatus />

          <div style={{ marginBottom: '20px' }}>
            <h4>Manual Focus Control</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => testRequest('term')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                Request Term Focus
              </button>
              <button
                onClick={() => testRequest('bead')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                Request Bead Focus
              </button>
              <button
                onClick={() => testRelease('term')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                Release Term
              </button>
              <button
                onClick={() => testRelease('bead')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                Release Bead
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4>Interactive Tooltips</h4>
            <DemoTooltip hintType="term" content="Debug term tooltip">
              Term Tooltip
            </DemoTooltip>
            <DemoTooltip hintType="bead" content="Debug bead tooltip">
              Bead Tooltip
            </DemoTooltip>
          </div>

          <div>
            <h4>Focus Event Log</h4>
            <div
              style={{
                backgroundColor: '#1f2937',
                color: '#f9fafb',
                padding: '12px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '12px',
                height: '150px',
                overflowY: 'auto',
              }}
            >
              {logs.length === 0 ? (
                <em style={{ color: '#9ca3af' }}>No events yet...</em>
              ) : (
                logs.map((log, i) => <div key={i}>{log}</div>)
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
      <TutorialUIProvider>
        <DebugPanel />
      </TutorialUIProvider>
    )
  },
  parameters: {
    docs: {
      description: {
        story:
          'Debug panel for testing focus management programmatically. Use the buttons to manually request/release focus and observe the behavior.',
      },
    },
  },
}
