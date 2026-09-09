/**
 * ProportionBar locked segments: muted-but-live (never `disabled`), tapping opens the
 * "why" popover instead of cycling the weight, and no add/remove toggle is offered.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ProportionBar, type ProportionBarSegment } from '../ProportionBar'

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

beforeAll(() => {
  // Radix Popper measures with ResizeObserver, which jsdom lacks
  if (!('ResizeObserver' in globalThis)) {
    class RO {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.assign(globalThis, { ResizeObserver: RO })
  }
})

const COLORS: ProportionBarSegment['colors'] = {
  lightBg: '#eee',
  lightBgBoosted: '#ddd',
  darkBg: '#333',
  darkBgBoosted: '#444',
  lightAccent: '#0a0',
  darkAccent: '#0f0',
}

function segments(locked: boolean): ProportionBarSegment[] {
  return [
    { key: 'abacus', emoji: '🧮', label: 'Abacus', weight: 2, colors: COLORS },
    { key: 'visualization', emoji: '🧠', label: 'Visualize', weight: 1, colors: COLORS },
    {
      key: 'linear',
      emoji: '📝',
      label: 'Linear',
      weight: 0,
      colors: COLORS,
      locked: locked ? { content: <p>Locked because reasons</p> } : undefined,
    },
  ]
}

describe('ProportionBar locked segment', () => {
  it('renders the lock idiom without disabling the control', () => {
    const { container } = render(
      <ProportionBar
        label="Practice Modes"
        dataSetting="practice-modes"
        segments={segments(true)}
        onCycleWeight={vi.fn()}
        onDisable={vi.fn()}
        enabledCount={2}
      />
    )
    const locked = container.querySelector<HTMLButtonElement>(
      '[data-element="mode-segment-locked"][data-part="linear"]'
    )
    expect(locked).not.toBeNull()
    expect(locked!.disabled).toBe(false)
    // Live control: no aria-disabled either, or screen readers skip the only path to "why"
    expect(locked!.getAttribute('aria-disabled')).toBeNull()
    expect(locked!.textContent).toContain('🔒')
    expect(locked!.querySelector('[data-element="add-hint"]')).toBeNull()
    expect(locked!.querySelector('[data-element="remove-hint"]')).toBeNull()
    // The other segments are untouched
    expect(
      container.querySelector('[data-option="segment-abacus"][data-enabled="true"]')
    ).not.toBeNull()
  })

  it('tapping opens the note instead of cycling the weight', async () => {
    const onCycleWeight = vi.fn()
    const { container } = render(
      <ProportionBar
        label="Practice Modes"
        dataSetting="practice-modes"
        segments={segments(true)}
        onCycleWeight={onCycleWeight}
        onDisable={vi.fn()}
        enabledCount={2}
      />
    )
    fireEvent.click(container.querySelector('[data-element="mode-segment-locked"]')!)
    expect(onCycleWeight).not.toHaveBeenCalled()
    expect(await screen.findByText('Locked because reasons')).toBeInTheDocument()
  })

  it('an unlocked zero-weight segment still cycles on tap', () => {
    const onCycleWeight = vi.fn()
    const { container } = render(
      <ProportionBar
        label="Practice Modes"
        dataSetting="practice-modes"
        segments={segments(false)}
        onCycleWeight={onCycleWeight}
        onDisable={vi.fn()}
        enabledCount={2}
      />
    )
    expect(container.querySelector('[data-element="mode-segment-locked"]')).toBeNull()
    fireEvent.click(container.querySelector('[data-option="segment-linear"]')!)
    expect(onCycleWeight).toHaveBeenCalledWith('linear')
  })
})
