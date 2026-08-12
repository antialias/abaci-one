'use client'

import { css } from '@styled/css'
import Link from 'next/link'
import type { CreateToolMeta } from '@/lib/create-tools/createToolList'
import { CreateToolPreviewSlot, type PreviewLoading } from './CreateToolPreviewSlot'

export type CreateToolCardVariant = 'flagship' | 'default' | 'compact'

interface CreateToolCardProps {
  tool: CreateToolMeta
  variant?: CreateToolCardVariant
  title: string
  description: string
  features: string[]
  buttonText: string
  /** Small label above the title, e.g. "Start here" on the flagship. */
  eyebrow?: string
}

/**
 * The primary row is above the fold at every breakpoint we care about; the
 * "More printables" row is not, so it waits for the browser's lazy-loading.
 */
const PREVIEW_LOADING: Record<CreateToolCardVariant, PreviewLoading> = {
  flagship: 'priority',
  default: 'priority',
  compact: 'lazy',
}

/**
 * The grid track each variant occupies, so the browser can pick a srcset entry
 * instead of downloading the full-size capture. Mirrors the grids in
 * `CreateHubContent`: primary is 1 / 2 / 3-up capped at 1200px, secondary is
 * 1 / 2-up, and the flagship spans both columns until it settles into a third
 * at `lg`.
 */
const PREVIEW_SIZES: Record<CreateToolCardVariant, string> = {
  flagship: '(min-width: 1200px) 380px, (min-width: 1024px) 33vw, 100vw',
  default: '(min-width: 1200px) 380px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  compact: '(min-width: 1200px) 580px, (min-width: 640px) 50vw, 100vw',
}

/**
 * One frame shape for every card. Cards sit shoulder to shoulder in a grid, so
 * a per-variant ratio would drop each card's title onto a different line — and
 * the flagship shares the primary row with `default` cards at `lg` anyway. The
 * artifacts range from 1.12 to 1.60; `contain` absorbs the difference against
 * each capture's own backdrop.
 */
const PREVIEW_FRAME = '4 / 3'

/**
 * One tool on the /create hub: a live miniature of what the tool produces,
 * above the copy.
 *
 * A11y shape worth keeping: the card is an `<article>` containing exactly ONE
 * real link — the CTA, which carries the accessible name. The whole tile is
 * still clickable via an inset `_before` overlay on that link, so pointer users
 * get a big target while screen-reader and keyboard users get a single stop
 * instead of a duplicate title-link/CTA-link pair. Focus styling therefore
 * lives on the card via `_focusWithin`.
 */
export function CreateToolCard({
  tool,
  variant = 'default',
  title,
  description,
  features,
  buttonText,
  eyebrow,
}: CreateToolCardProps) {
  const { theme } = tool
  const compact = variant === 'compact'

  return (
    <article
      data-element="create-tool-card"
      data-tool-id={tool.id}
      data-tier={tool.tier}
      data-variant={variant}
      className={css({
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bg: 'bg.surface',
        borderRadius: { base: '2xl', md: '3xl' },
        border: '1px solid',
        borderColor: 'border.default',
        overflow: 'hidden',
        boxShadow: compact
          ? '0 4px 16px rgba(0,0,0,0.10)'
          : { base: '0 10px 40px rgba(0,0,0,0.15)', md: '0 16px 50px rgba(0,0,0,0.18)' },
        transition:
          'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s, border-color 0.25s',
        _hover: {
          borderColor: 'border.emphasized',
          _motionSafe: {
            md: { transform: 'translateY(-6px)' },
          },
          boxShadow: compact
            ? '0 10px 28px rgba(0,0,0,0.16)'
            : { base: '0 16px 50px rgba(0,0,0,0.2)', md: '0 26px 70px rgba(0,0,0,0.24)' },
        },
        _focusWithin: {
          outline: '2px solid',
          outlineColor: 'blue.500',
          outlineOffset: '2px',
        },
      })}
    >
      {/* colorway bar — inline style because the gradient is per-tool data */}
      <div
        className={css({
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: { base: '4px', md: '6px' },
          zIndex: 1,
        })}
        style={{ background: theme.gradient }}
      />

      <div
        className={css({
          p: compact ? 3 : { base: 3, md: 4 },
          pt: compact ? 4 : { base: 4, md: 5 },
        })}
      >
        <CreateToolPreviewSlot
          preview={tool.preview}
          loading={PREVIEW_LOADING[variant]}
          sizes={PREVIEW_SIZES[variant]}
          frame={PREVIEW_FRAME}
        />
      </div>

      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          px: compact ? 4 : { base: 5, md: 6 },
          pb: compact ? 4 : { base: 5, md: 6 },
          gap: compact ? 2 : { base: 2, md: 3 },
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
          <span
            aria-hidden="true"
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: compact ? '26px' : '32px',
              height: compact ? '26px' : '32px',
              borderRadius: 'lg',
              fontSize: compact ? 'sm' : 'md',
              flexShrink: 0,
            })}
            style={{ background: theme.gradient }}
          >
            {tool.emoji}
          </span>
          {eyebrow ? (
            <span
              data-element="create-tool-eyebrow"
              className={css({
                fontSize: '2xs',
                fontWeight: 'bold',
                letterSpacing: 'wider',
                textTransform: 'uppercase',
                color: 'text.muted',
              })}
            >
              {eyebrow}
            </span>
          ) : null}
        </div>

        <h3
          className={css({
            fontSize: compact ? 'md' : { base: 'lg', md: 'xl' },
            fontWeight: 'bold',
            color: 'text.primary',
            letterSpacing: 'tight',
          })}
        >
          {title}
        </h3>

        <p
          className={css({
            fontSize: compact ? 'xs' : { base: 'sm', md: 'md' },
            color: 'text.secondary',
            lineHeight: '1.6',
          })}
        >
          {description}
        </p>

        {/* Features are supporting detail; the preview does this job on small
            screens and on the compact card, so they're dropped there. */}
        {compact ? null : (
          <ul
            className={css({
              listStyle: 'none',
              display: { base: 'none', sm: 'flex' },
              flexDirection: 'column',
              gap: 2,
              mt: 1,
            })}
          >
            {features.map((feature) => (
              <li
                key={feature}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  fontSize: { base: 'xs', md: 'sm' },
                  color: 'text.secondary',
                })}
              >
                <span
                  aria-hidden="true"
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    borderRadius: 'full',
                    bg: theme.checkBg,
                    color: theme.checkColor,
                    fontSize: '2xs',
                    fontWeight: 'bold',
                    flexShrink: 0,
                  })}
                >
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        )}

        <div className={css({ mt: 'auto', pt: compact ? 2 : { base: 3, md: 4 } })}>
          <Link
            href={tool.href}
            data-action="open-create-tool"
            data-tool-id={tool.id}
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontWeight: 'bold',
              borderRadius: 'xl',
              transition: 'transform 0.2s, box-shadow 0.2s',
              // the tile-wide hit area; the link itself stays the only tab stop
              _before: {
                content: '""',
                position: 'absolute',
                inset: 0,
                zIndex: 2,
              },
              _focusVisible: { outline: 'none' },
              ...(compact
                ? {
                    color: 'text.primary',
                    fontSize: 'sm',
                    _hover: { color: 'blue.600' },
                  }
                : {
                    color: 'white',
                    fontSize: { base: 'sm', md: 'md' },
                    px: { base: 4, md: 5 },
                    py: { base: 2, md: 3 },
                  }),
            })}
            style={
              compact
                ? undefined
                : { background: theme.gradient, boxShadow: `0 4px 15px ${theme.shadowColor}` }
            }
          >
            <span>{buttonText}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  )
}
