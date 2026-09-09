// Abacus Studio — StageAPrepCard story (Gitea #38 / things-haunt-house #463).
//
// The checklist the operator works through at the printer BEFORE the feet stage
// is submitted: pull the AMS tube, load the external spool, set it on the screen.
// It has no inputs — it shows while two-stage is on and nothing has been
// submitted yet — so there is one state to look at.
import type { Meta, StoryObj } from '@storybook/react'
import { StageAPrepCard } from './StageAPrepCard'

const meta: Meta<typeof StageAPrepCard> = {
  title: 'AbacusStudio/StageAPrepCard',
  component: StageAPrepCard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // the studio's dark sidebar column; the card's palette assumes it
      <div
        style={{
          width: 300,
          padding: 12,
          borderRadius: 12,
          background: '#111827',
          color: 'rgba(226,232,240,0.98)',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: 12,
        }}
      >
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof StageAPrepCard>

/** The four steps, plus the footnote on what the print service can and cannot
 *  check for itself (it parks Stage A while an AMS tray is at the nozzle; it
 *  cannot see what sits on the external spool). */
export const BeforeStageA: Story = {}

/** The experimental feet-only variant (Gitea #45): the same feed swap, plus the
 *  line saying Stage A prints only the feet and Stage B prints the supports. */
export const FeetOnlyBeforeStageA: Story = { args: { variant: 'feet-only' } }
