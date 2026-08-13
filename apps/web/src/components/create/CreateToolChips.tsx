'use client'

import { css, cx } from '@styled/css'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { CreateToolMeta } from '@/lib/create-tools/createToolList'

/**
 * Which background the row is sitting on.
 *
 * `surface` follows the theme. `dark` is for the sections that are dark in both
 * light and dark mode — the homepage is one long dark page with hardcoded
 * `white`/`gray.400` text, so semantic tokens there render light-on-light.
 */
export type CreateToolChipTone = 'surface' | 'dark'

export type CreateToolChipAlign = 'start' | 'center'

interface CreateToolChipsProps {
  tools: readonly CreateToolMeta[]
  tone?: CreateToolChipTone
  /**
   * Centring belongs to the list, not to a wrapper around it: a flex parent
   * shrink-wraps the list to its widest chip, which on a 375px screen wraps
   * five chips onto five rows instead of three.
   */
  align?: CreateToolChipAlign
}

/**
 * A row of tool chips: emoji, title, arrow. No preview image.
 *
 * The hub's previews are real captured artifacts, and a second copy of them
 * anywhere else would be four more images on a page that already has something
 * doing real work — a live tool preview, or the homepage's draggable
 * flashcards. A chip costs nothing that can move the page's LCP around.
 *
 * Titles come from the same `create.hub.*` copy the hub cards use, so a tool
 * renamed on the hub is renamed everywhere it is linked.
 */
export function CreateToolChips({
  tools,
  tone = 'surface',
  align = 'start',
}: CreateToolChipsProps) {
  const t = useTranslations('create')

  return (
    <ul
      data-element="create-tool-chips"
      data-tone={tone}
      data-align={align}
      className={cx(
        css({
          listStyle: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          gap: { base: 2, md: 3 },
        }),
        CHIP_ALIGN[align]
      )}
    >
      {tools.map((tool) => (
        <li key={tool.id} className={css({ width: { base: '100%', sm: 'auto' } })}>
          <Link
            href={tool.href}
            data-action="open-create-tool"
            data-tool-id={tool.id}
            className={cx(chipBase, CHIP_TONE[tone])}
          >
            <span
              aria-hidden="true"
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: 'lg',
                fontSize: 'sm',
                flexShrink: 0,
              })}
              style={{ background: tool.theme.gradient }}
            >
              {tool.emoji}
            </span>
            <span>{t(`hub.${tool.i18nKey}.title`)}</span>
            <span
              aria-hidden="true"
              data-element="chip-arrow"
              className={css({ marginInlineStart: { base: 'auto', sm: 0 } })}
            >
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

const chipBase = css({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  // Full-width rows below `sm`: the shortest chip is still two thirds of a
  // 375px screen, so nothing can ever pair up there and centred pills just read
  // as a ragged stack. From `sm` they go back to shrink-to-fit.
  width: '100%',
  px: { base: 3, md: 4 },
  py: { base: 2, md: 3 },
  border: '1px solid',
  borderRadius: 'xl',
  fontSize: { base: 'sm', md: 'md' },
  fontWeight: 'medium',
  transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
  _hover: {
    boxShadow: '0 6px 18px rgba(0,0,0,0.10)',
    _motionSafe: { transform: 'translateY(-2px)' },
  },
  _focusVisible: {
    outline: '2px solid',
    outlineColor: 'blue.500',
    outlineOffset: '2px',
  },
})

const CHIP_ALIGN: Record<CreateToolChipAlign, string> = {
  start: css({ justifyContent: 'flex-start' }),
  center: css({ justifyContent: 'center' }),
}

/**
 * Built once at module scope, not from the `tone` value: Panda extracts styles
 * statically, so a `css()` call keyed on a runtime variable produces no class
 * at all.
 */
const CHIP_TONE: Record<CreateToolChipTone, string> = {
  surface: css({
    bg: 'bg.surface',
    borderColor: 'border.default',
    color: 'text.primary',
    '& [data-element="chip-arrow"]': { color: 'text.muted' },
    _hover: { borderColor: 'border.emphasized' },
  }),
  dark: css({
    bg: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    color: 'white',
    '& [data-element="chip-arrow"]': { color: 'rgba(255, 255, 255, 0.55)' },
    _hover: { borderColor: 'rgba(255, 255, 255, 0.4)' },
  }),
}

export default CreateToolChips
