'use client'

import { css } from '@styled/css'
import { useTranslations } from 'next-intl'
import { type CreateToolId, getOtherCreateTools } from '@/lib/create-tools/createToolList'
import { CreateToolChips } from './CreateToolChips'

interface MoreCreateToolsProps {
  /** The tool whose page this is; it's the one entry left out of the row. */
  currentToolId: CreateToolId
}

/**
 * The "where to next" row at the bottom of a create tool's page: a heading and
 * a rule around {@link CreateToolChips}, with this page's own tool left out.
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

      <CreateToolChips tools={tools} />
    </nav>
  )
}

export default MoreCreateTools
