/**
 * The cross-link row's contract: it points at every OTHER tool, in a stable
 * order, with no images — the reason it exists as chips rather than a second
 * set of hub cards.
 *
 * next-intl is globally mocked to echo the key, so these assertions are about
 * structure; the copy itself is covered by the i18n completeness suite.
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CREATE_TOOLS, type CreateToolId } from '@/lib/create-tools/createToolList'
import { MoreCreateTools } from '../MoreCreateTools'

const ALL_IDS = CREATE_TOOLS.map((tool) => tool.id)

function renderFor(currentToolId: CreateToolId) {
  render(<MoreCreateTools currentToolId={currentToolId} />)
  return document.querySelector<HTMLElement>('[data-component="more-create-tools"]') as HTMLElement
}

describe('MoreCreateTools', () => {
  it.each(ALL_IDS)('on the %s page, links to every other tool and not itself', (id) => {
    const row = renderFor(id)
    const links = within(row).getAllByRole('link')

    expect(links).toHaveLength(CREATE_TOOLS.length - 1)
    expect(links.map((a) => a.getAttribute('data-tool-id'))).not.toContain(id)
    for (const link of links) {
      const linked = CREATE_TOOLS.find((t) => t.id === link.getAttribute('data-tool-id'))
      expect(linked, link.getAttribute('data-tool-id') ?? '?').toBeDefined()
      expect(link).toHaveAttribute('href', linked?.href)
      // the emoji badge is aria-hidden, so the title must supply the name
      expect(link.textContent?.trim().length).toBeGreaterThan(0)
    }
  })

  it('puts the primary tools ahead of the secondary ones', () => {
    const row = renderFor('worksheets')
    const tiers = within(row)
      .getAllByRole('link')
      .map((a) => CREATE_TOOLS.find((t) => t.id === a.getAttribute('data-tool-id'))?.tier)
    expect(tiers).toEqual(['primary', 'primary', 'secondary', 'secondary'])
  })

  it('is a landmark named by its own heading', () => {
    const row = renderFor('calendar')
    const heading = within(row).getByRole('heading', { level: 2 })
    expect(row.getAttribute('aria-labelledby')).toBe(heading.id)
    expect(heading.id).not.toBe('')
    expect(screen.getByRole('navigation')).toBe(row)
  })

  it('renders no images — the chips must stay weightless', () => {
    const row = renderFor('flashcards')
    expect(row.querySelectorAll('img')).toHaveLength(0)
  })
})
