/**
 * The chip row is now shared between the tool pages' cross-links and the
 * homepage's printable-tools section, so its contract is what keeps the two
 * from drifting: every chip is a real link to a registry href, the row carries
 * no images, and the two tones are distinct classes rather than one theme-aware
 * set (the homepage is dark in both light and dark mode).
 *
 * next-intl is globally mocked to echo the key, so these are structural
 * assertions; the copy is covered by the i18n completeness suite.
 */
import { render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CREATE_TOOLS, getSortedCreateTools } from '@/lib/create-tools/createToolList'
import { CreateToolChips, type CreateToolChipTone } from '../CreateToolChips'

function renderChips(tone?: CreateToolChipTone) {
  render(<CreateToolChips tools={getSortedCreateTools()} tone={tone} />)
  return document.querySelector<HTMLElement>('[data-element="create-tool-chips"]') as HTMLElement
}

describe('CreateToolChips', () => {
  it('links every tool in the registry, at its own href', () => {
    const links = within(renderChips()).getAllByRole('link')

    expect(links).toHaveLength(CREATE_TOOLS.length)
    for (const link of links) {
      const tool = CREATE_TOOLS.find((t) => t.id === link.getAttribute('data-tool-id'))
      expect(tool, link.getAttribute('data-tool-id') ?? '?').toBeDefined()
      expect(link).toHaveAttribute('href', tool?.href)
    }
  })

  it('names each chip in text, since the emoji badge is hidden from AT', () => {
    for (const link of within(renderChips()).getAllByRole('link')) {
      // The badge and the arrow are both aria-hidden, so an accessible name can
      // only come from the title. A chip that reads as "🧮 →" is unusable.
      expect(link).toHaveAccessibleName(/\S/)
      expect(link.querySelector('[data-element="chip-arrow"]')).toHaveAttribute(
        'aria-hidden',
        'true'
      )
    }
  })

  it('leads with the primary tier', () => {
    const tiers = within(renderChips())
      .getAllByRole('link')
      .map((a) => CREATE_TOOLS.find((t) => t.id === a.getAttribute('data-tool-id'))?.tier)
    expect(tiers).toEqual(['primary', 'primary', 'primary', 'secondary', 'secondary'])
  })

  it('renders no images — the row must stay weightless', () => {
    // The whole reason this is chips and not hub cards: the homepage already
    // carries AbacusReact, and each tool page already has a live preview.
    expect(renderChips().querySelectorAll('img, picture, svg')).toHaveLength(0)
  })

  it('gives the dark tone different classes from the themed one', () => {
    // Panda extracts styles statically, so a css() call keyed on the runtime
    // `tone` would silently emit nothing. If this regresses, the homepage row
    // renders dark-on-dark rather than merely looking wrong.
    const classesFor = (tone: CreateToolChipTone) => {
      document.body.innerHTML = ''
      const row = renderChips(tone)
      expect(row).toHaveAttribute('data-tone', tone)
      return within(row).getAllByRole('link')[0]?.className ?? ''
    }

    const surface = classesFor('surface')
    const dark = classesFor('dark')
    expect(surface).not.toBe('')
    expect(dark).not.toBe(surface)
  })

  it('defaults to the themed tone', () => {
    expect(renderChips()).toHaveAttribute('data-tone', 'surface')
  })
})
