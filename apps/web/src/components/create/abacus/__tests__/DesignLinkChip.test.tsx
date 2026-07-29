/**
 * DesignLinkChip (Gitea #25) — the "Copy design link" front door. Pins the
 * orchestration contract: save first; a failed save shows the retry line and
 * never touches the URL; a successful save updates the URL BEFORE the
 * clipboard write, so a refused clipboard can honestly point at the address
 * bar; the copied href is the studio's own URL derivation (design + player).
 * Context and clipboard are mocked at the module seam — the chip is pure
 * orchestration + presentation.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useClipboard } from '@/hooks/useClipboard'
import { useAbacusStudio } from '../AbacusStudioContext'
import { DesignLinkChip } from '../DesignLinkChip'

vi.mock('../AbacusStudioContext', () => ({
  useAbacusStudio: vi.fn(),
}))
vi.mock('@/hooks/useClipboard', () => ({
  useClipboard: vi.fn(),
}))

const saveDesignSnapshot = vi.fn()
const copy = vi.fn()

function studio(overrides: Record<string, unknown> = {}) {
  vi.mocked(useAbacusStudio).mockReturnValue({
    saveDesignSnapshot,
    designLinkPending: false,
    savedDesignId: null,
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: partial context value
  } as any)
}

function clipboard(overrides: Record<string, unknown> = {}) {
  vi.mocked(useClipboard).mockReturnValue({
    copied: false,
    copy,
    reset: vi.fn(),
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: partial hook value
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  studio()
  clipboard()
  saveDesignSnapshot.mockResolvedValue('dsn-9')
  copy.mockResolvedValue(true)
})

describe('DesignLinkChip', () => {
  it('walks rest → saving → copied through the label', () => {
    const { rerender } = render(<DesignLinkChip selectedPlayerId={null} onDesignSaved={vi.fn()} />)
    expect(screen.getByText('🔗 Copy design link')).toBeInTheDocument()

    studio({ designLinkPending: true })
    rerender(<DesignLinkChip selectedPlayerId={null} onDesignSaved={vi.fn()} />)
    const saving = screen.getByText('Saving design…')
    expect((saving as HTMLButtonElement).disabled).toBe(true)

    studio()
    clipboard({ copied: true })
    rerender(<DesignLinkChip selectedPlayerId={null} onDesignSaved={vi.fn()} />)
    expect(screen.getByText('✓ Link copied')).toBeInTheDocument()
  })

  it('copies the studio URL for the minted id, keeping the player selection', async () => {
    const onDesignSaved = vi.fn()
    render(<DesignLinkChip selectedPlayerId="p-1" onDesignSaved={onDesignSaved} />)

    fireEvent.click(screen.getByText('🔗 Copy design link'))

    await waitFor(() =>
      expect(copy).toHaveBeenCalledWith(
        `${window.location.origin}/create/abacus?design=dsn-9&player=p-1`
      )
    )
    expect(onDesignSaved).toHaveBeenCalledWith('dsn-9')
  })

  it('a failed save shows the retry line and never touches URL or clipboard', async () => {
    saveDesignSnapshot.mockResolvedValue(null)
    const onDesignSaved = vi.fn()
    const { container } = render(
      <DesignLinkChip selectedPlayerId={null} onDesignSaved={onDesignSaved} />
    )

    fireEvent.click(screen.getByText('🔗 Copy design link'))

    await waitFor(() =>
      expect(container.querySelector('[data-element="abacus-design-link-error"]')).not.toBeNull()
    )
    expect(screen.getByText("Couldn't save the design — try again.")).toBeInTheDocument()
    expect(onDesignSaved).not.toHaveBeenCalled()
    expect(copy).not.toHaveBeenCalled()
  })

  it('a refused clipboard points at the address bar — AFTER the URL was updated', async () => {
    copy.mockResolvedValue(false)
    const onDesignSaved = vi.fn()
    const { container } = render(
      <DesignLinkChip selectedPlayerId={null} onDesignSaved={onDesignSaved} />
    )

    fireEvent.click(screen.getByText('🔗 Copy design link'))

    await waitFor(() =>
      expect(container.querySelector('[data-element="abacus-design-link-note"]')).not.toBeNull()
    )
    expect(screen.getByText('Design saved — its link is in the address bar.')).toBeInTheDocument()
    expect(onDesignSaved).toHaveBeenCalledWith('dsn-9') // the note's claim is true
  })

  // The tooltip is the only place the studio says WHO can open the link, so it
  // must never over-claim. Each state gets its own sentence, and in particular
  // "Only you can open it" is licensed by exactly one of them (#24).
  describe('who-can-open-it tooltip', () => {
    const tip = () => screen.getByText('🔗 Copy design link').getAttribute('title')

    it('promises privacy only for a design that is provably yours and private', () => {
      studio({ savedDesignId: 'dsn-9', designAccess: 'manageable', designShared: false })
      render(<DesignLinkChip selectedPlayerId={null} onDesignSaved={vi.fn()} />)
      expect(tip()).toBe('This design is saved — copy its link. Only you can open it.')
    })

    it('says it is open when it is yours and shared', () => {
      studio({ savedDesignId: 'dsn-9', designAccess: 'manageable', designShared: true })
      render(<DesignLinkChip selectedPlayerId={null} onDesignSaved={vi.fn()} />)
      expect(tip()).toContain('anyone with the link can open it')
    })

    it("never calls someone else's shared design private — it offers a copy instead", () => {
      // reading it at all proves it is shared; the old code claimed the opposite
      studio({ savedDesignId: 'dsn-9', designAccess: 'not-yours', designShared: false })
      render(<DesignLinkChip selectedPlayerId={null} onDesignSaved={vi.fn()} />)
      expect(tip()).not.toContain('Only you')
      expect(tip()).toContain('opens for anyone')
      expect(tip()).toContain('copy of your own')
    })

    it('claims nothing when access is unknown — a failed load, or a partial context', () => {
      studio({ savedDesignId: 'dsn-9', designAccess: 'unknown', designShared: false })
      render(<DesignLinkChip selectedPlayerId={null} onDesignSaved={vi.fn()} />)
      expect(tip()).toBe('This design is saved — copy its link.')

      studio({ savedDesignId: 'dsn-9' }) // designAccess absent entirely
      const { container } = render(
        <DesignLinkChip selectedPlayerId={null} onDesignSaved={vi.fn()} />
      )
      const button = container.querySelector('[data-action="copy-design-link"]')
      expect(button?.getAttribute('title')).toBe('This design is saved — copy its link.')
    })
  })

  it('a fresh attempt clears the previous outcome line', async () => {
    saveDesignSnapshot.mockResolvedValueOnce(null)
    const { container } = render(<DesignLinkChip selectedPlayerId={null} onDesignSaved={vi.fn()} />)

    fireEvent.click(screen.getByText('🔗 Copy design link'))
    await waitFor(() =>
      expect(container.querySelector('[data-element="abacus-design-link-error"]')).not.toBeNull()
    )

    fireEvent.click(screen.getByText('🔗 Copy design link'))
    await waitFor(() => expect(copy).toHaveBeenCalled())
    expect(container.querySelector('[data-element="abacus-design-link-error"]')).toBeNull()
  })
})
