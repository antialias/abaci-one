'use client'

import { css } from '@styled/css'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { type CreateToolId, getOtherCreateTools } from '@/lib/create-tools/createToolList'

interface MoreCreateToolsProps {
  /** The tool whose page this is; it's the one entry left out of the row. */
  currentToolId: CreateToolId
}

/**
 * The "where to next" row at the bottom of a create tool's page.
 *
 * Deliberately chips, not cards: the hub's previews are real captured artifacts
 * and a second copy of them at the foot of every tool page would be four more
 * images on a page that already has a live preview doing real work. A chip is
 * an emoji, a title and an arrow — no image, no preview chunk, nothing that can
 * push the page's LCP around.
 *
 * Titles come from the same `create.hub.*` copy the hub cards use, so a tool
 * renamed on the hub is renamed here too.
 */
export function MoreCreateTools({ currentToolId }: MoreCreateToolsProps) {
  const t = useTranslations('create')
  const tools = getOtherCreateTools(currentToolId)
  // Unique per mount so two rows on one page couldn't collide.
  const headingId = `more-create-tools-${currentToolId}`

  return (
    <nav
      data-component="more-create-tools"
      data-current-tool-id={currentToolId}
      aria-labelledby={headingId}
      className={css({
        maxWidth: '1200px',
        mx: 'auto',
        mt: { base: 10, md: 16 },
        pt: { base: 6, md: 8 },
        borderTop: '1px solid',
        borderColor: 'border.default',
      })}
    >
      <h2
        id={headingId}
        className={css({
          fontSize: { base: 'lg', md: 'xl' },
          fontWeight: 'bold',
          color: 'text.primary',
          letterSpacing: 'tight',
        })}
      >
        {t('crossLinks.heading')}
      </h2>
      <p
        className={css({
          fontSize: { base: 'sm', md: 'md' },
          color: 'text.secondary',
          mt: 1,
          mb: { base: 4, md: 5 },
        })}
      >
        {t('crossLinks.subheading')}
      </p>

      <ul
        className={css({
          listStyle: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          gap: { base: 2, md: 3 },
        })}
      >
        {tools.map((tool) => (
          <li key={tool.id}>
            <Link
              href={tool.href}
              data-action="open-create-tool"
              data-tool-id={tool.id}
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                px: { base: 3, md: 4 },
                py: { base: 2, md: 3 },
                bg: 'bg.surface',
                border: '1px solid',
                borderColor: 'border.default',
                borderRadius: 'xl',
                fontSize: { base: 'sm', md: 'md' },
                fontWeight: 'medium',
                color: 'text.primary',
                transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                _hover: {
                  borderColor: 'border.emphasized',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.10)',
                  _motionSafe: { transform: 'translateY(-2px)' },
                },
                _focusVisible: {
                  outline: '2px solid',
                  outlineColor: 'blue.500',
                  outlineOffset: '2px',
                },
              })}
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
              <span aria-hidden="true" className={css({ color: 'text.muted' })}>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default MoreCreateTools
