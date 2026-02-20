'use client'

import { Suspense } from 'react'
import { css } from '../../../styled-system/css'
import { HERO_COMPONENTS } from '@/lib/blog/heroComponentRegistry'

interface HeroComponentBannerProps {
  componentId: string
}

export function HeroComponentBanner({ componentId }: HeroComponentBannerProps) {
  const entry = HERO_COMPONENTS[componentId]
  if (!entry) {
    return (
      <div
        data-element="hero-component-error"
        className={css({
          position: 'relative',
          width: '100%',
          aspectRatio: { base: '16 / 9', md: '2.4 / 1' },
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'bg.muted',
          color: 'text.muted',
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
      data-element="hero-component-banner"
      className={css({
        position: 'relative',
        width: '100%',
        aspectRatio: { base: '16 / 9', md: '2.4 / 1' },
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
              bg: 'bg.muted',
              color: 'text.muted',
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
