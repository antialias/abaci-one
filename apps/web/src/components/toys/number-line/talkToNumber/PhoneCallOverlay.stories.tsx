import { useRef } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { PhoneCallOverlay } from './PhoneCallOverlay'
import type { CallState } from './useRealtimeVoice'

const CONTAINER_WIDTH = 480
const CONTAINER_HEIGHT = 400

/** Simulates the number-line viewport that PhoneCallOverlay renders inside. */
function CallContainer(props: {
  number: number
  state: CallState
  error: string | null
  errorCode: string | null
  timeRemaining?: number | null
  transferTarget?: number | null
  conferenceNumbers?: number[]
  currentSpeaker?: number | null
  isSpeaking?: boolean
  isDark?: boolean
}) {
  const callBoxRef = useRef<HTMLDivElement>(null)
  const isDark = props.isDark ?? false

  return (
    <div
      style={{
        position: 'relative',
        width: CONTAINER_WIDTH,
        height: CONTAINER_HEIGHT,
        backgroundColor: isDark ? '#111827' : '#f9fafb',
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
      }}
    >
      <PhoneCallOverlay
        number={props.number}
        state={props.state}
        timeRemaining={props.timeRemaining ?? null}
        error={props.error}
        errorCode={props.errorCode}
        transferTarget={props.transferTarget ?? null}
        conferenceNumbers={props.conferenceNumbers ?? []}
        currentSpeaker={props.currentSpeaker ?? null}
        isSpeaking={props.isSpeaking ?? false}
        onHangUp={() => {}}
        onRemoveFromCall={() => {}}
        onRetry={() => {}}
        onDismiss={() => {}}
        containerWidth={CONTAINER_WIDTH}
        containerHeight={CONTAINER_HEIGHT}
        isDark={isDark}
        callBoxContainerRef={callBoxRef}
      />
    </div>
  )
}

const meta: Meta<typeof PhoneCallOverlay> = {
  title: 'NumberLine/PhoneCallOverlay',
  component: PhoneCallOverlay,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof PhoneCallOverlay>

// ── Error states (the new behavior) ──────────────────────────────────

export const ErrorQuotaExhausted: Story = {
  name: 'Error: Quota Exhausted (no retry)',
  render: () => (
    <CallContainer
      number={7}
      state="error"
      error="Phone calls are taking a break right now. Try again later!"
      errorCode="quota_exceeded"
    />
  ),
}

export const ErrorQuotaExhaustedDark: Story = {
  name: 'Error: Quota Exhausted (dark)',
  render: () => (
    <CallContainer
      number={7}
      state="error"
      error="Phone calls are taking a break right now. Try again later!"
      errorCode="quota_exceeded"
      isDark
    />
  ),
}

export const ErrorRateLimited: Story = {
  name: 'Error: Rate Limited (retryable)',
  render: () => (
    <CallContainer
      number={42}
      state="error"
      error="42 is busy right now. Try again in a moment!"
      errorCode="rate_limited"
    />
  ),
}

export const ErrorRateLimitedDark: Story = {
  name: 'Error: Rate Limited (dark)',
  render: () => (
    <CallContainer
      number={42}
      state="error"
      error="42 is busy right now. Try again in a moment!"
      errorCode="rate_limited"
      isDark
    />
  ),
}

export const ErrorConnectionFailed: Story = {
  name: 'Error: Connection Failed (retryable)',
  render: () => (
    <CallContainer
      number={3.14159}
      state="error"
      error="3.14159 couldn't pick up the phone. Try calling again!"
      errorCode="connection_error"
    />
  ),
}

export const ErrorMicDenied: Story = {
  name: 'Error: Microphone Denied (retryable)',
  render: () => (
    <CallContainer
      number={10}
      state="error"
      error="Microphone access denied. Please allow microphone access to talk to numbers!"
      errorCode="mic_denied"
    />
  ),
}

export const ErrorGenericServer: Story = {
  name: 'Error: Generic Server Error (retryable)',
  render: () => (
    <CallContainer
      number={100}
      state="error"
      error="Something went wrong during the call."
      errorCode="unavailable"
    />
  ),
}

// ── Other call states for context ────────────────────────────────────

export const Ringing: Story = {
  name: 'Ringing',
  render: () => (
    <CallContainer
      number={7}
      state="ringing"
      error={null}
      errorCode={null}
    />
  ),
}

export const ActiveCall: Story = {
  name: 'Active Call',
  render: () => (
    <CallContainer
      number={7}
      state="active"
      error={null}
      errorCode={null}
      timeRemaining={95}
      conferenceNumbers={[7]}
      currentSpeaker={7}
      isSpeaking
    />
  ),
}

export const Ending: Story = {
  name: 'Ending',
  render: () => (
    <CallContainer
      number={7}
      state="ending"
      error={null}
      errorCode={null}
    />
  ),
}

export const Transferring: Story = {
  name: 'Transferring',
  render: () => (
    <CallContainer
      number={7}
      state="transferring"
      error={null}
      errorCode={null}
      transferTarget={12}
    />
  ),
}
