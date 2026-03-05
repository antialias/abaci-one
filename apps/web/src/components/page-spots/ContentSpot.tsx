'use client'

import { Suspense } from 'react'
import { css } from '../../../styled-system/css'
import { SPOT_COMPONENTS } from '@/lib/page-spots/spotComponentRegistry'
import type { SpotConfig } from '@/lib/page-spots/types'

interface ContentSpotProps {
  config: SpotConfig
  /** CSS aspect-ratio string, e.g. "16 / 9" */
  aspectRatio?: string
  /** Pre-loaded HTML (for html-type spots, loaded server-side) */
  html?: string | null
  /** Public image URL (for generated-type spots, resolved server-side) */
  imageUrl?: string | null
}

export function ContentSpot({ config, aspectRatio, html, imageUrl }: ContentSpotProps) {
  switch (config.type) {
    case 'component':
      return <ComponentSpot componentId={config.componentId} aspectRatio={aspectRatio} />
    case 'html':
      return <HtmlSpot html={html ?? null} aspectRatio={aspectRatio} />
    case 'generated':
      return (
        <GeneratedSpot
          imageUrl={imageUrl ?? null}
          focalPoint={config.focalPoint}
          aspectRatio={aspectRatio}
        />
      )
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ComponentSpot({
  componentId,
  aspectRatio,
}: {
  componentId: string
  aspectRatio?: string
}) {
  const entry = SPOT_COMPONENTS[componentId]
  if (!entry) {
    return (
      <div
        data-element="content-spot-error"
        className={css({
          width: '100%',
          aspectRatio: aspectRatio ?? '16 / 9',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: '#161b22',
          color: '#8b949e',
          fontSize: '0.875rem',
        })}
      >
        Unknown component: {componentId}
      </div>
    )
  }

  const Component = entry.component

  return (
    <div
      data-element="content-spot-component"
      className={css({
        position: 'relative',
        width: '100%',
        aspectRatio: aspectRatio ?? '16 / 9',
        overflow: 'hidden',
      })}
    >
      <Suspense
        fallback={
          <div
            className={css({
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bg: '#161b22',
              color: '#8b949e',
              fontSize: '0.875rem',
            })}
          >
            Loading...
          </div>
        }
      >
        <Component />
      </Suspense>
    </div>
  )
}

function HtmlSpot({ html, aspectRatio }: { html: string | null; aspectRatio?: string }) {
  if (!html) {
    return (
      <div
        data-element="content-spot-empty"
        className={css({
          width: '100%',
          aspectRatio: aspectRatio ?? '16 / 9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: '#161b22',
          color: '#8b949e',
          fontSize: '0.875rem',
        })}
      >
        No HTML content
      </div>
    )
  }

  return (
    <div
      data-element="content-spot-html"
      className={css({
        width: '100%',
        aspectRatio: aspectRatio ?? '16 / 9',
        overflow: 'hidden',
      })}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function GeneratedSpot({
  imageUrl,
  focalPoint,
  aspectRatio,
}: {
  imageUrl: string | null
  focalPoint?: { x: number; y: number }
  aspectRatio?: string
}) {
  if (!imageUrl) {
    return (
      <div
        data-element="content-spot-empty"
        className={css({
          width: '100%',
          aspectRatio: aspectRatio ?? '16 / 9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: '#161b22',
          color: '#8b949e',
          fontSize: '0.875rem',
        })}
      >
        No image generated
      </div>
    )
  }

  return (
    <div
      data-element="content-spot-image"
      className={css({
        width: '100%',
        aspectRatio: aspectRatio ?? '16 / 9',
        overflow: 'hidden',
        position: 'relative',
      })}
    >
      <img
        src={imageUrl}
        alt=""
        className={css({
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        })}
        style={focalPoint ? { objectPosition: `${focalPoint.x}% ${focalPoint.y}%` } : undefined}
      />
    </div>
  )
}
