/**
 * DesignShareToggle (Gitea #24) — who may open the saved design link. Pins the
 * properties that keep it from becoming a third save verb or a scary modal:
 * it renders only for an owner with something saved, each direction is ONE
 * click with no confirm step (the control is its own undo), and a refused
 * flip says so in place. Presentational — the studio context is mocked.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAbacusStudio } from '../AbacusStudioContext'
import { DesignShareToggle } from '../DesignShareToggle'

vi.mock('../AbacusStudioContext', () => ({
  useAbacusStudio: vi.fn(),
}))

const setDesignShared = vi.fn()

function studio(overrides: Record<string, unknown> = {}) {
  vi.mocked(useAbacusStudio).mockReturnValue({
    designShared: false,
    canShareDesign: true,
    setDesignShared,
    designSharePending: false,
    designShareFailed: false,
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: partial context value
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  studio()
})

describe('DesignShareToggle', () => {
  it('renders nothing when the viewer has no sharing to manage', () => {
    studio({ canShareDesign: false })
    const { container } = render(<DesignShareToggle />)
    expect(container.querySelector('[data-element="abacus-design-share"]')).toBeNull()

    // …including the partial-mock case: other suites stub the context without
    // these fields, and the toggle must stay invisible rather than throw.
    studio({ canShareDesign: undefined })
    const { container: bare } = render(<DesignShareToggle />)
    expect(bare.querySelector('[data-element="abacus-design-share"]')).toBeNull()
  })

  it('shares in one click — no confirm step', () => {
    render(<DesignShareToggle />)
    fireEvent.click(screen.getByText('🔗 Anyone with the link'))
    expect(setDesignShared).toHaveBeenCalledTimes(1)
    expect(setDesignShared).toHaveBeenCalledWith(true)
  })

  it('un-shares in one click — the control is its own undo', () => {
    studio({ designShared: true })
    render(<DesignShareToggle />)
    fireEvent.click(screen.getByText('🔒 Only me'))
    expect(setDesignShared).toHaveBeenCalledTimes(1)
    expect(setDesignShared).toHaveBeenCalledWith(false)
  })

  it('disables both segments while a flip is in flight', () => {
    studio({ designSharePending: true })
    render(<DesignShareToggle />)
    expect((screen.getByText('🔒 Only me') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByText('🔗 Anyone with the link') as HTMLButtonElement).disabled).toBe(true)
  })

  it('says so in place when the flip fails', () => {
    studio({ designShareFailed: true })
    const { container } = render(<DesignShareToggle />)
    expect(container.querySelector('[data-element="abacus-design-share-error"]')).not.toBeNull()
    expect(screen.getByText("Couldn't change who can open this — try again.")).toBeInTheDocument()
  })
})
