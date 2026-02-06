import type { Meta, StoryObj } from '@storybook/react'
import type { PedagogicalSegment } from '../DecompositionWithReasons'
import { TutorialUIProvider } from '../TutorialUIContext'
import { CoachBar } from './CoachBar'
import './coachbar.css'

// Mock segments for demonstration
const createMockSegment = (overrides: Partial<PedagogicalSegment> = {}): PedagogicalSegment => ({
  id: 'mock-segment-1',
  place: 0,
  digit: 5,
  a: 0,
  L: 0,
  U: 0,
  goal: 'Add 5 to ones place',
  plan: [
    {
      rule: 'Direct',
      conditions: ['L+d <= 4'],
      explanation: ['Simple addition'],
    },
  ],
  expression: '5',
  stepIndices: [0],
  termIndices: [0],
  termRange: { startIndex: 0, endIndex: 1 },
  startValue: 0,
  endValue: 5,
  startState: { 0: { heavenActive: false, earthActive: 0 } },
  endState: { 0: { heavenActive: true, earthActive: 0 } },
  readable: {
    title: 'Direct Move',
    subtitle: 'Simple bead movement',
    summary: 'Add 5 to the ones place using the heaven bead.',
    chips: [
      { label: 'Digit being added', value: '5' },
      { label: 'Target place', value: 'ones' },
    ],
    why: [],
    stepsFriendly: ['Press the heaven bead down'],
    validation: { ok: true, issues: [] },
  },
  ...overrides,
})

type CoachBarStoryArgs = {
  mockSegment?: PedagogicalSegment | null
  canHideCoachBar?: boolean
}

const meta: Meta<typeof CoachBar> = {
  title: 'Tutorial/CoachBar',
  component: CoachBar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The CoachBar shows contextual guidance during tutorial steps. It displays the current segment's title, summary, and optional context chips.

**Features:**
- Sticky positioning at top of tutorial
- Shows segment title + summary
- Optional context chips (first 2)
- Hide button (when enabled)
- Safe rendering when data is missing
- Accessibility with \`role="status"\` and \`aria-live="polite"\`
        `,
      },
    },
  },
  decorators: [
    (Story: any, context: any) => {
      const segment = context.args.mockSegment || null
      const canHide = context.args.canHideCoachBar ?? true

      return (
        <TutorialUIProvider initialSegment={segment} canHideCoachBar={canHide}>
          <div style={{ height: '400px', background: '#f5f5f5' }}>
            <Story />
            <div style={{ padding: '20px', marginTop: '20px' }}>
              <h3>Tutorial Content Below</h3>
              <p>This simulates the tutorial content that would appear below the Coach Bar.</p>
              <p>The Coach Bar is sticky positioned and will stay at the top when scrolling.</p>
              <div
                style={{
                  height: '300px',
                  background: '#e0e0e0',
                  padding: '20px',
                  marginTop: '20px',
                }}
              >
                <p>More tutorial content...</p>
              </div>
            </div>
          </div>
        </TutorialUIProvider>
      )
    },
  ],
}

export default meta
type Story = StoryObj<CoachBarStoryArgs>

export const Default: Story = {
  args: {
    mockSegment: createMockSegment(),
  },
}

export const DirectMove: Story = {
  args: {
    mockSegment: createMockSegment({
      readable: {
        title: 'Direct Move',
        subtitle: 'Simple bead movement',
        summary: 'Add 3 to the ones place. It fits here, so just move 3 lower beads.',
        chips: [
          { label: 'Digit being added', value: '3' },
          { label: 'Rod shows', value: '0 (empty)' },
        ],
        why: [],
        stepsFriendly: ['Move 3 earth beads down'],
        validation: { ok: true, issues: [] },
      },
    }),
  },
}

export const FiveComplement: Story = {
  args: {
    mockSegment: createMockSegment({
      readable: {
        title: 'Five Friend',
        subtitle: 'Using pairs that make 5',
        summary:
          "Add 8 to the ones place, but there isn't room for that many lower beads. Use 5's friend: press the heaven bead (5) and lift 2 — that's +5 − 2.",
        chips: [
          { label: 'Target digit', value: '8' },
          { label: 'Five friend', value: '5 - 2 = 3' },
        ],
        why: [],
        stepsFriendly: [
          'Press heaven bead down (+5)',
          'Lift 2 earth beads (-2)',
          'Result: +5 - 2 = +3, but we wanted +8, so +8 total',
        ],
        validation: { ok: true, issues: [] },
      },
    }),
  },
}

export const TenComplement: Story = {
  args: {
    mockSegment: createMockSegment({
      readable: {
        title: 'Ten Friend',
        subtitle: 'Using pairs that make 10',
        summary:
          "Add 7 to the ones place to make 10. Carry to tens place, then take 3 here (that's +10 − 3).",
        chips: [
          { label: 'Target digit', value: '7' },
          { label: 'Ten friend', value: '10 - 3 = 7' },
        ],
        why: [],
        stepsFriendly: [
          'Add 1 to tens place (+10)',
          'Subtract 3 from ones place (-3)',
          'Result: +10 - 3 = +7',
        ],
        validation: { ok: true, issues: [] },
      },
    }),
  },
}

export const WithLongContent: Story = {
  args: {
    mockSegment: createMockSegment({
      readable: {
        title: 'Complex Chain Reaction',
        subtitle: 'Multiple cascading operations',
        summary:
          "Add 9 to the hundreds place to make 10. Since the next rod is also 9, the carry ripples up through multiple places, then take 1 here (that's +10 − 1). This demonstrates how the Coach Bar handles longer content gracefully.",
        chips: [
          { label: 'Starting position', value: 'hundreds = 9' },
          { label: 'Cascade effect', value: 'ripples to thousands' },
        ],
        why: [],
        stepsFriendly: ['Complex multi-step operation'],
        validation: { ok: true, issues: [] },
      },
    }),
  },
}

export const WithMinimalContent: Story = {
  args: {
    mockSegment: createMockSegment({
      readable: {
        title: 'Step',
        summary: 'Short instruction.',
        chips: [],
        why: [],
        stepsFriendly: [],
        validation: { ok: true, issues: [] },
      },
    }),
  },
}

export const NoHideButton: Story = {
  args: {
    mockSegment: createMockSegment(),
    canHideCoachBar: false,
  },
}

export const Hidden: Story = {
  decorators: [
    (_Story) => {
      return (
        <TutorialUIProvider initialSegment={createMockSegment()} canHideCoachBar>
          <div style={{ height: '200px', background: '#f5f5f5', padding: '20px' }}>
            <p>
              <strong>Coach Bar is hidden</strong>
            </p>
            <p>This shows the tutorial content when the Coach Bar has been dismissed.</p>
            <p>You can toggle the Coach Bar visibility in the Controls panel.</p>
          </div>
        </TutorialUIProvider>
      )
    },
  ],
  args: {},
}

export const NoSegment: Story = {
  decorators: [
    (Story) => {
      return (
        <TutorialUIProvider initialSegment={null} canHideCoachBar>
          <div style={{ height: '200px', background: '#f5f5f5', padding: '20px' }}>
            <Story />
            <p>
              <strong>No active segment</strong>
            </p>
            <p>When there's no active segment or no summary, the Coach Bar doesn't render.</p>
          </div>
        </TutorialUIProvider>
      )
    },
  ],
  args: {},
}

export const Interactive: Story = {
  decorators: [
    (Story) => {
      const segments = [
        createMockSegment({
          id: 'step-1',
          readable: {
            title: 'Step 1: Direct Move',
            summary: 'Add 2 to the ones place. Simple bead movement.',
            chips: [{ label: 'Action', value: 'Move 2 earth beads' }],
            why: [],
            stepsFriendly: [],
            validation: { ok: true, issues: [] },
          },
        }),
        createMockSegment({
          id: 'step-2',
          readable: {
            title: 'Step 2: Five Friend',
            summary: "Add 7 to the ones place using 5's friend.",
            chips: [{ label: 'Strategy', value: '5 + 2 = 7' }],
            why: [],
            stepsFriendly: [],
            validation: { ok: true, issues: [] },
          },
        }),
        createMockSegment({
          id: 'step-3',
          readable: {
            title: 'Step 3: Complete',
            summary: 'Tutorial step completed successfully!',
            chips: [{ label: 'Result', value: 'Target reached' }],
            why: [],
            stepsFriendly: [],
            validation: { ok: true, issues: [] },
          },
        }),
      ]

      return (
        <TutorialUIProvider initialSegment={segments[0]} canHideCoachBar>
          <div style={{ height: '400px', background: '#f5f5f5' }}>
            <Story />
            <div style={{ padding: '20px' }}>
              <h3>Interactive Demo</h3>
              <p>The Coach Bar updates as you progress through tutorial steps.</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                {segments.map((segment, index) => (
                  <button
                    key={segment.id}
                    onClick={() => {
                      // In a real tutorial, this would be handled by tutorial context
                      window.dispatchEvent(
                        new CustomEvent('demo-segment-change', {
                          detail: segment,
                        })
                      )
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Go to Step {index + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </TutorialUIProvider>
      )
    },
  ],
  args: {},
}
