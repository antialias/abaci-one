/**
 * SharedDesignsList (Gitea #24) — the way back to a design you shared and then
 * edited past. Pins what makes it a revocation guarantee rather than decoration:
 * it is invisible until you have actually shared something, every listed design
 * carries its own un-share, and a design whose stored envelope no longer parses
 * still gets a row — an un-openable design you cannot un-share is exactly the
 * hole this closes. The hook is mocked; this is presentation.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSharedDesigns } from '@/hooks/useSharedDesigns'
import { SharedDesignsList } from '../SharedDesignsList'

vi.mock('@/hooks/useSharedDesigns', () => ({
  useSharedDesigns: vi.fn(),
}))
vi.mock('next/link', () => ({
  // forwards the rest of the props — target/rel are part of what's pinned here
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const unshare = vi.fn()

function ledger(overrides: Record<string, unknown> = {}) {
  vi.mocked(useSharedDesigns).mockReturnValue({
    designs: [],
    truncated: false,
    unshare,
    unsharingId: null,
    unshareFailed: false,
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: partial hook value
  } as any)
}

const design = (over: Record<string, unknown> = {}) => ({
  id: 'dsn-1',
  sharedAt: 1_700_000_000_000,
  cols: 13,
  label: 'Mira',
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  ledger()
})

describe('SharedDesignsList', () => {
  it('renders nothing at all when you have shared nothing', () => {
    const { container } = render(<SharedDesignsList />)
    expect(container.querySelector('[data-element="abacus-shared-designs"]')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('names each shared design and links to the link strangers hold', () => {
    ledger({ designs: [design()] })
    const { container } = render(<SharedDesignsList />)

    expect(screen.getByText('“Mira”')).toBeInTheDocument()
    expect(container.querySelector('a')?.getAttribute('href')).toContain('design=dsn-1')
  })

  it('opens in a new tab, so looking never costs you unsaved edits', () => {
    // in-place navigation would hydrate that design over the studio's live
    // state and discard uncommitted work, with no undo — Back restores the URL,
    // not the params
    ledger({ designs: [design()] })
    const { container } = render(<SharedDesignsList />)

    const link = container.querySelector('a')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('still lists — and can still revoke — a design that no longer parses', () => {
    // no label, no cols: unopenable, but public, so it MUST be revocable
    ledger({ designs: [design({ id: 'dsn-broken', label: null, cols: null })] })
    render(<SharedDesignsList />)

    expect(screen.getByText('Saved design')).toBeInTheDocument()
    fireEvent.click(screen.getByText('🔒 Un-share'))
    expect(unshare).toHaveBeenCalledWith('dsn-broken')
  })

  it('falls back to the shape when there is no engraved name', () => {
    ledger({ designs: [design({ label: null })] })
    render(<SharedDesignsList />)
    expect(screen.getByText('13-column abacus')).toBeInTheDocument()
  })

  it('un-shares in one click, with no confirm step', () => {
    ledger({ designs: [design(), design({ id: 'dsn-2', label: 'Theo' })] })
    render(<SharedDesignsList />)

    fireEvent.click(screen.getAllByText('🔒 Un-share')[1])
    expect(unshare).toHaveBeenCalledTimes(1)
    expect(unshare).toHaveBeenCalledWith('dsn-2')
  })

  it('quiets only the row in flight', () => {
    ledger({ designs: [design(), design({ id: 'dsn-2', label: 'Theo' })], unsharingId: 'dsn-2' })
    render(<SharedDesignsList />)

    const buttons = screen.getAllByText('🔒 Un-share') as HTMLButtonElement[]
    expect(buttons[0].disabled).toBe(false)
    expect(buttons[1].disabled).toBe(true)
  })

  it('says so in place when a revoke fails, and keeps the row', () => {
    ledger({ designs: [design()], unshareFailed: true })
    const { container } = render(<SharedDesignsList />)

    expect(container.querySelector('[data-element="abacus-shared-designs-error"]')).not.toBeNull()
    expect(screen.getByText('“Mira”')).toBeInTheDocument()
  })

  it('admits when the list is capped rather than implying it is complete', () => {
    ledger({ designs: [design()], truncated: true })
    render(<SharedDesignsList />)
    expect(screen.getByText('Showing the 50 most recently shared.')).toBeInTheDocument()
  })
})
