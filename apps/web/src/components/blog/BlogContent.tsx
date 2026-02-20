'use client'

import { INLINE_COMPONENTS } from '@/lib/blog/inlineComponentRegistry'
import { css } from '../../../styled-system/css'

interface EmbedConfig {
  type: 'component' | 'html'
  componentId?: string
}

type EmbedConfigMap = Record<string, EmbedConfig>

/** Content component that handles inline embed injection */
export function BlogContent({
  html,
  embedConfigs,
  embedHtmlMap,
}: {
  html: string
  embedConfigs: EmbedConfigMap
  embedHtmlMap: Record<string, string>
}) {
  // Find all <!-- EMBED: id "description" --> markers in the rendered HTML
  const embedPattern = /<!--\s*EMBED:\s*([\w-]+)\s+"([^"]+)"\s*-->/g
  const injections: Array<{
    position: number
    length: number
    embedId: string
  }> = []

  let match
  while ((match = embedPattern.exec(html)) !== null) {
    injections.push({
      position: match.index,
      length: match[0].length,
      embedId: match[1],
    })
  }

  // If no embeds, render full content
  if (injections.length === 0) {
    return (
      <div
        data-section="article-content"
        className={articleContentStyles}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  // Split HTML at injection points and render with embeds
  const segments: React.ReactNode[] = []
  let lastPosition = 0

  for (let i = 0; i < injections.length; i++) {
    const { position, length, embedId } = injections[i]

    // Add HTML segment before this injection
    const htmlSegment = html.slice(lastPosition, position)
    if (htmlSegment) {
      segments.push(
        <div
          key={`html-${i}`}
          data-section={`article-content-${i}`}
          className={articleContentStyles}
          dangerouslySetInnerHTML={{ __html: htmlSegment }}
        />
      )
    }

    // Resolve the embed
    const config = embedConfigs[embedId]
    if (config?.type === 'component' && config.componentId) {
      const entry = INLINE_COMPONENTS[config.componentId]
      if (entry) {
        const EmbedComponent = entry.component
        segments.push(<EmbedComponent key={`embed-${embedId}`} />)
      }
    } else if (config?.type === 'html') {
      const embedHtml = embedHtmlMap[embedId]
      if (embedHtml) {
        segments.push(
          <div
            key={`embed-${embedId}`}
            data-element={`inline-embed-${embedId}`}
            dangerouslySetInnerHTML={{ __html: embedHtml }}
          />
        )
      }
    }
    // If no config found, the marker is consumed silently

    lastPosition = position + length
  }

  // Add remaining HTML after last injection
  const remainingHtml = html.slice(lastPosition)
  if (remainingHtml) {
    segments.push(
      <div
        key="html-final"
        data-section="article-content-final"
        className={articleContentStyles}
        dangerouslySetInnerHTML={{ __html: remainingHtml }}
      />
    )
  }

  return <>{segments}</>
}

export const articleContentStyles = css({
  fontSize: { base: '1rem', md: '1.125rem' },
  lineHeight: '1.75',
  color: 'text.primary',

  // Typography styles for markdown content
  '& h1': {
    fontSize: { base: '1.875rem', md: '2.25rem' },
    fontWeight: 'bold',
    mt: '2.5rem',
    mb: '1rem',
    lineHeight: '1.25',
    color: 'text.primary',
  },
  '& h2': {
    fontSize: { base: '1.5rem', md: '1.875rem' },
    fontWeight: 'bold',
    mt: '2rem',
    mb: '0.875rem',
    lineHeight: '1.3',
    color: 'accent.emphasis',
  },
  '& h3': {
    fontSize: { base: '1.25rem', md: '1.5rem' },
    fontWeight: 600,
    mt: '1.75rem',
    mb: '0.75rem',
    lineHeight: '1.4',
    color: 'accent.default',
  },
  '& p': {
    mb: '1.25rem',
  },
  '& strong': {
    fontWeight: 600,
    color: 'text.primary',
  },
  '& a': {
    color: 'accent.emphasis',
    textDecoration: 'underline',
    _hover: {
      color: 'accent.default',
    },
  },
  '& ul, & ol': {
    pl: '1.5rem',
    mb: '1.25rem',
  },
  '& li': {
    mb: '0.5rem',
  },
  '& code': {
    bg: 'bg.muted',
    px: '0.375rem',
    py: '0.125rem',
    borderRadius: '0.25rem',
    fontSize: '0.875em',
    fontFamily: 'monospace',
    color: 'accent.emphasis',
    border: '1px solid',
    borderColor: 'accent.default',
  },
  '& pre': {
    bg: 'bg.surface',
    border: '1px solid',
    borderColor: 'border.default',
    color: 'text.primary',
    p: '1rem',
    borderRadius: '0.5rem',
    overflow: 'auto',
    mb: '1.25rem',
  },
  '& pre code': {
    bg: 'transparent',
    p: '0',
    border: 'none',
    color: 'inherit',
    fontSize: '0.875rem',
  },
  '& blockquote': {
    borderLeft: '4px solid',
    borderColor: 'accent.default',
    pl: '1rem',
    py: '0.5rem',
    my: '1.5rem',
    color: 'text.secondary',
    fontStyle: 'italic',
    bg: 'accent.subtle',
    borderRadius: '0 0.25rem 0.25rem 0',
  },
  '& hr': {
    my: '2rem',
    borderColor: 'border.muted',
  },
  '& table': {
    width: '100%',
    mb: '1.25rem',
    borderCollapse: 'collapse',
  },
  '& th': {
    bg: 'accent.muted',
    px: '1rem',
    py: '0.75rem',
    textAlign: 'left',
    fontWeight: 600,
    borderBottom: '2px solid',
    borderColor: 'accent.default',
    color: 'accent.emphasis',
  },
  '& td': {
    px: '1rem',
    py: '0.75rem',
    borderBottom: '1px solid',
    borderColor: 'border.muted',
    color: 'text.secondary',
  },
  '& tr:hover td': {
    bg: 'accent.subtle',
  },
})
