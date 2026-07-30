/**
 * MyDesignsList (Gitea #11, grown from #24) — "my abacuses". Pins what makes it
 * a revocation guarantee rather than decoration: it is invisible until you have
 * saved something, the collapsed LABEL still admits how many designs are public,
 * a design whose stored envelope no longer parses still gets a row (an
 * un-openable design you cannot un-share is exactly the hole #24 closed), and
 * each row offers the one action that means something for it. Plus the naming
 * affordance, and an undo that outlives the row it removed.
 *
 * The hook is mocked; this is presentation.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMyDesigns } from '@/hooks/useMyDesigns'
import { MyDesignsList } from '../MyDesignsList'

vi.mock('@/hooks/useMyDesigns', () => ({
  useMyDesigns: vi.fn(),
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
const rename = vi.fn()
const remove = vi.fn()
const undoRemove = vi.fn()

function list(overrides: Record<string, unknown> = {}) {
  const designs = (overrides.designs ?? []) as { sharedAt: number | null }[]
  vi.mocked(useMyDesigns).mockReturnValue({
    designs: [],
    truncated: false,
    sharedCount: designs.filter((d) => d.sharedAt !== null).length,
    unshare,
    unsharingId: null,
    unshareFailed: false,
    rename,
    renameFailed: false,
    remove,
    removingId: null,
    removeFailed: false,
    undoable: null,
    undoRemove,
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: partial hook value
  } as any)
}

const design = (over: Record<string, unknown> = {}) => ({
  id: 'dsn-1',
  name: null,
  sharedAt: null,
  createdAt: 1_700_000_000_000,
  cols: 13,
  label: 'Mira',
  ...over,
})

/** the panel is collapsed by default — the label is the only thing on screen */
const openPanel = () => fireEvent.click(screen.getByText(/My abacuses/))

beforeEach(() => {
  vi.clearAllMocks()
  list()
})

describe('MyDesignsList', () => {
  it('renders nothing at all when you have saved nothing', () => {
    const { container } = render(<MyDesignsList />)
    expect(container.querySelector('[data-element="abacus-my-designs"]')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('admits in the collapsed label how many are public', () => {
    // this is what keeps #24's promise while the panel is shut: you can always
    // see that something of yours is open to anyone with its link
    list({ designs: [design(), design({ id: 'dsn-2', sharedAt: 1_700_000_000_000 })] })
    render(<MyDesignsList />)
    expect(screen.getByText('My abacuses (2) · 1 shared')).toBeInTheDocument()
  })

  it('leaves the shared count off when nothing is public', () => {
    list({ designs: [design()] })
    render(<MyDesignsList />)
    expect(screen.getByText('My abacuses (1)')).toBeInTheDocument()
  })

  it('prefers the name, then the engraving, then the shape', () => {
    list({
      designs: [
        design({ id: 'a', name: 'Ada’s abacus' }),
        design({ id: 'b', label: 'Mira' }),
        design({ id: 'c', label: null }),
        design({ id: 'd', label: null, cols: null }),
      ],
    })
    render(<MyDesignsList />)
    openPanel()

    expect(screen.getByText('Ada’s abacus')).toBeInTheDocument()
    expect(screen.getByText('“Mira”')).toBeInTheDocument()
    expect(screen.getByText('13-column abacus')).toBeInTheDocument()
    expect(screen.getByText('Saved design')).toBeInTheDocument()
  })

  it('opens in a new tab, so looking never costs you unsaved edits', () => {
    // in-place navigation would hydrate that design over the studio's live
    // state and discard uncommitted work, with no undo — Back restores the URL,
    // not the params
    list({ designs: [design()] })
    const { container } = render(<MyDesignsList />)
    openPanel()

    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toContain('design=dsn-1')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('marks the design that is currently on screen', () => {
    list({ designs: [design({ id: 'dsn-1' }), design({ id: 'dsn-2', label: 'Theo' })] })
    const { container } = render(<MyDesignsList currentDesignId="dsn-2" />)
    openPanel()

    const marked = container.querySelectorAll('[data-element="abacus-my-design-open"]')
    expect(marked).toHaveLength(1)
    expect(marked[0].closest('[data-design-id]')?.getAttribute('data-design-id')).toBe('dsn-2')
  })

  it('offers exactly the action that means something for each row', () => {
    list({
      designs: [design({ id: 'pub', sharedAt: 1_700_000_000_000 }), design({ id: 'priv' })],
    })
    const { container } = render(<MyDesignsList />)
    openPanel()

    const row = (id: string) => container.querySelector(`[data-design-id="${id}"]`)
    // a public design's question is "should it still be?"…
    expect(row('pub')?.querySelector('[data-action="unshare-design"]')).not.toBeNull()
    expect(row('pub')?.querySelector('[data-action="remove-design"]')).toBeNull()
    // …a private one's is "do I still want to see it?"
    expect(row('priv')?.querySelector('[data-action="remove-design"]')).not.toBeNull()
    expect(row('priv')?.querySelector('[data-action="unshare-design"]')).toBeNull()
  })

  it('still lists — and can still revoke — a design that no longer parses', () => {
    // no label, no cols: unopenable, but public, so it MUST be revocable
    list({
      designs: [design({ id: 'dsn-broken', label: null, cols: null, sharedAt: 1_700_000_000_000 })],
    })
    render(<MyDesignsList />)
    openPanel()

    expect(screen.getByText('Saved design')).toBeInTheDocument()
    fireEvent.click(screen.getByText('🔒 Un-share'))
    expect(unshare).toHaveBeenCalledWith('dsn-broken')
  })

  it('removes in one click, with no confirm step', () => {
    list({ designs: [design(), design({ id: 'dsn-2', label: 'Theo' })] })
    render(<MyDesignsList />)
    openPanel()

    fireEvent.click(screen.getAllByText('✕ Remove')[1])
    expect(remove).toHaveBeenCalledTimes(1)
    // the whole row, because the undo offer needs its NAME after it's gone
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'dsn-2' }))
  })

  it('quiets only the row in flight', () => {
    list({
      designs: [design(), design({ id: 'dsn-2', label: 'Theo' })],
      removingId: 'dsn-2',
    })
    render(<MyDesignsList />)
    openPanel()

    const buttons = screen.getAllByText('✕ Remove') as HTMLButtonElement[]
    expect(buttons[0].disabled).toBe(false)
    expect(buttons[1].disabled).toBe(true)
  })

  it('says so in place when something fails, and keeps the row', () => {
    list({ designs: [design()], removeFailed: true })
    const { container } = render(<MyDesignsList />)
    openPanel()

    expect(container.querySelector('[data-element="abacus-my-designs-error"]')).not.toBeNull()
    expect(screen.getByText('“Mira”')).toBeInTheDocument()
  })

  it('admits when the list is capped rather than implying it is complete', () => {
    list({ designs: [design()], truncated: true })
    render(<MyDesignsList />)
    openPanel()
    expect(screen.getByText('Showing your 50 most recent.')).toBeInTheDocument()
  })
})

describe('MyDesignsList naming', () => {
  const startEditing = () => {
    render(<MyDesignsList />)
    openPanel()
    fireEvent.click(screen.getByText('✎'))
    return screen.getByLabelText('Design name') as HTMLInputElement
  }

  it('opens on the current name and commits on Enter', () => {
    list({ designs: [design({ name: 'Ada’s abacus' })] })
    const input = startEditing()
    expect(input.value).toBe('Ada’s abacus')

    fireEvent.change(input, { target: { value: '  Ben’s abacus  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(rename).toHaveBeenCalledWith('dsn-1', 'Ben’s abacus')
  })

  it('commits on blur too — clicking away should not lose what you typed', () => {
    list({ designs: [design()] })
    const input = startEditing()

    fireEvent.change(input, { target: { value: 'Mira’s' } })
    fireEvent.blur(input)
    expect(rename).toHaveBeenCalledWith('dsn-1', 'Mira’s')
  })

  it('abandons on Escape, even though the blur that follows would commit', () => {
    list({ designs: [design({ name: 'Original' })] })
    const input = startEditing()

    fireEvent.change(input, { target: { value: 'Discard me' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)
    expect(rename).not.toHaveBeenCalled()
    expect(screen.getByText('Original')).toBeInTheDocument()
  })

  it('takes a name back off when you empty the field', () => {
    list({ designs: [design({ name: 'Ada’s abacus' })] })
    const input = startEditing()

    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(rename).toHaveBeenCalledWith('dsn-1', null)
  })

  it('does not write when the name is unchanged', () => {
    list({ designs: [design({ name: 'Ada’s abacus' })] })
    const input = startEditing()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(rename).not.toHaveBeenCalled()
  })

  it('caps the field at what the server will accept', () => {
    list({ designs: [design()] })
    expect(startEditing().maxLength).toBe(60)
  })
})

describe('MyDesignsList undo', () => {
  it('offers the removal back by name', () => {
    list({ designs: [design({ id: 'dsn-2' })], undoable: { id: 'dsn-9', name: 'Ada’s abacus' } })
    render(<MyDesignsList />)
    openPanel()

    expect(screen.getByText('Removed “Ada’s abacus”')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Undo'))
    expect(undoRemove).toHaveBeenCalledWith('dsn-9')
  })

  it('survives removing your LAST design — the one moment undo matters most', () => {
    // an empty list would otherwise unmount the offer along with the row
    list({ designs: [], undoable: { id: 'dsn-9', name: null } })
    render(<MyDesignsList />)
    openPanel()

    expect(screen.getByText('Removed that design')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Undo'))
    expect(undoRemove).toHaveBeenCalledWith('dsn-9')
  })
})
