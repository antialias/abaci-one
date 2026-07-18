'use client'

// /create/abacus — "Your Abacus": the single home for making your on-screen
// abacus a real, camera-readable object. The page forks on the user's actual
// situation instead of cramming both tools into one scroll:
//   • "Use the one I have" → stick-on paper ArUco markers (default; no printer).
//   • "Print a new one"    → 3D-print a frame with the markers baked in.
// Both converge on the same read-back: 📷 My Abacus vision finds the four
// markers and rectifies the user's N-column abacus from a camera. One shared
// identity (columns + colors, from AbacusDisplayConfig) grounds both paths.
// Absorbs the former /create/vision-markers and /toys/abacus-studio routes.

import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import { AbacusMarkerSheet } from '@/components/create/abacus/AbacusMarkerSheet'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../styled-system/css'

// three.js + OpenSCAD-WASM is heavy; only load it when the "print a new one"
// path is chosen. The default path is paper markers, which fits the far larger
// no-3D-printer audience and needs none of it.
const AbacusStudioViewer = dynamic(
  () => import('@/components/create/abacus/AbacusStudioViewer').then((m) => m.AbacusStudioViewer),
  {
    ssr: false,
    loading: () => (
      <div
        data-element="abacus-viewer-loading"
        className={css({
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(226,232,240,0.7)',
          fontSize: 'sm',
        })}
      >
        Loading 3D preview…
      </div>
    ),
  }
)

const CYAN_GRADIENT = 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'

type MakePath = 'markers' | 'print'

const PATHS: { id: MakePath; emoji: string; title: string; blurb: string; tag: string }[] = [
  {
    id: 'markers',
    emoji: '🏷️',
    title: 'Use the one I have',
    blurb: 'Print four corner markers and stick them onto an abacus you already own.',
    tag: 'Just paper + tape',
  },
  {
    id: 'print',
    emoji: '🖨️',
    title: 'Print a new one',
    blurb: 'Design and 3D-print a frame with the ArUco markers baked right in.',
    tag: 'Needs a 3D printer',
  },
]

const SCHEME_LABEL: Record<string, string> = {
  monochrome: 'Monochrome',
  'place-value': 'Place-value colors',
  'heaven-earth': 'Heaven & earth colors',
  alternating: 'Alternating colors',
}

export default function CreateAbacusPage() {
  const config = useAbacusConfig()
  const [path, setPath] = useState<MakePath>('markers')
  const columns = config.physicalAbacusColumns

  return (
    <PageWithNav navTitle="Your Abacus" navEmoji="🧮">
      <div
        data-component="create-abacus"
        className={css({
          minHeight: '100vh',
          bg: 'bg.canvas',
          pt: { base: 20, md: 24 },
          pb: { base: 8, md: 16 },
          px: { base: 4, sm: 6, md: 8 },
        })}
      >
        <div className={css({ maxWidth: '960px', mx: 'auto' })}>
          {/* Header */}
          <header className={css({ textAlign: 'center', mb: { base: 6, md: 8 } })}>
            <h1
              className={css({
                fontSize: { base: '2xl', sm: '3xl', md: '4xl' },
                fontWeight: 'extrabold',
                color: 'text.primary',
                letterSpacing: 'tight',
                mb: 3,
              })}
            >
              Make your abacus real
            </h1>
            <p
              className={css({
                fontSize: { base: 'md', md: 'lg' },
                color: 'text.secondary',
                lineHeight: '1.7',
                maxWidth: '620px',
                mx: 'auto',
              })}
            >
              Turn the abacus you use on screen into something you can hold — printed with the four
              corner markers that let a camera read it back into the app.
            </p>
          </header>

          {/* Identity strip — the shared thing both paths make real */}
          <section
            data-element="abacus-identity"
            className={css({
              display: 'flex',
              flexDirection: { base: 'column', sm: 'row' },
              alignItems: 'center',
              gap: { base: 4, sm: 6 },
              bg: 'bg.surface',
              border: '1px solid',
              borderColor: 'border.default',
              borderRadius: '2xl',
              p: { base: 4, md: 5 },
            })}
          >
            <div
              data-element="abacus-identity-preview"
              className={css({
                bg: 'bg.canvas',
                borderRadius: 'xl',
                px: 4,
                py: 3,
                maxWidth: '100%',
                minWidth: 0,
                overflowX: 'auto',
                display: 'flex',
                justifyContent: 'center',
              })}
            >
              <AbacusReact
                value={0}
                columns={columns}
                colorScheme={config.colorScheme}
                colorPalette={config.colorPalette}
                scaleFactor={0.7}
                interactive={false}
                animated={false}
                showNumbers={false}
              />
            </div>
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                alignItems: { base: 'center', sm: 'flex-start' },
                textAlign: { base: 'center', sm: 'left' },
              })}
            >
              <span
                className={css({
                  fontSize: 'xs',
                  fontWeight: 'bold',
                  letterSpacing: 'wider',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                })}
              >
                This is your abacus
              </span>
              <div className={css({ display: 'flex', gap: 2, flexWrap: 'wrap' })}>
                <span data-element="abacus-chip-columns" className={chip}>
                  {columns} columns
                </span>
                <span data-element="abacus-chip-colors" className={chip}>
                  {SCHEME_LABEL[config.colorScheme] ?? 'Custom colors'}
                </span>
              </div>
              <Link
                href="/settings"
                data-action="edit-abacus-settings"
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  color: 'cyan.600',
                  _hover: { textDecoration: 'underline' },
                })}
              >
                Change in Settings →
              </Link>
            </div>
          </section>

          {/* The fork — pick your situation, see only that tool */}
          <section data-element="abacus-fork" className={css({ mt: { base: 8, md: 10 } })}>
            <h2
              className={css({
                fontSize: { base: 'lg', md: 'xl' },
                fontWeight: 'bold',
                color: 'text.primary',
                textAlign: 'center',
                mb: { base: 4, md: 5 },
              })}
            >
              How do you want to make it?
            </h2>
            <div
              role="radiogroup"
              aria-label="How do you want to make your abacus"
              className={css({
                display: 'grid',
                gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)' },
                gap: { base: 3, md: 4 },
              })}
            >
              {PATHS.map((p) => (
                <ForkCard
                  key={p.id}
                  {...p}
                  selected={path === p.id}
                  onSelect={() => setPath(p.id)}
                />
              ))}
            </div>
          </section>

          {/* The chosen tool */}
          <section data-element="abacus-tool" className={css({ mt: { base: 6, md: 8 } })}>
            {path === 'print' ? (
              <div data-element="abacus-tool-print">
                <div
                  className={css({
                    height: 'min(70vh, 680px)',
                    borderRadius: 'xl',
                    overflow: 'hidden',
                    shadow: 'lg',
                    border: '1px solid',
                    borderColor: 'border.default',
                    bg: '#15181c',
                  })}
                >
                  <AbacusStudioViewer />
                </div>
                <p
                  className={css({
                    mt: 3,
                    fontSize: 'sm',
                    color: 'text.secondary',
                    lineHeight: '1.6',
                    textAlign: 'center',
                  })}
                >
                  Rotate to inspect, adjust it under <strong>Customize</strong>, then hit{' '}
                  <strong>Download STL to print</strong>. The four corner markers are baked into the
                  frame — nothing to stick on.
                </p>
              </div>
            ) : (
              <div data-element="abacus-tool-markers">
                <AbacusMarkerSheet columnCount={columns} />
              </div>
            )}
          </section>

          {/* Read-back payoff — the shared destination of both paths */}
          <section
            data-element="abacus-readback"
            className={css({
              mt: { base: 10, md: 14 },
              pt: { base: 8, md: 10 },
              borderTop: '1px solid',
              borderColor: 'border.default',
            })}
          >
            <h2
              className={css({
                fontSize: { base: 'lg', md: 'xl' },
                fontWeight: 'bold',
                color: 'text.primary',
                textAlign: 'center',
                mb: 2,
              })}
            >
              Then read it back
            </h2>
            <p
              className={css({
                fontSize: 'sm',
                color: 'text.secondary',
                textAlign: 'center',
                mb: { base: 6, md: 8 },
              })}
            >
              Either path ends at the same place — a physical abacus the camera can see.
            </p>
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: { base: '1fr', sm: 'repeat(3, 1fr)' },
                gap: { base: 4, md: 5 },
              })}
            >
              <Step
                n={1}
                title="Make it real"
                body={
                  path === 'print'
                    ? 'Print your frame — the markers come with it.'
                    : 'Print and stick the four corner markers.'
                }
              />
              <Step
                n={2}
                title="Open 📷 My Abacus"
                body="Open the floating My Abacus widget and turn on vision."
              />
              <Step
                n={3}
                title="It reads back"
                body={`The camera finds the four markers and rectifies your ${columns}-column abacus.`}
              />
            </div>
          </section>
        </div>
      </div>
    </PageWithNav>
  )
}

// small pill used for the identity chips
const chip = css({
  display: 'inline-flex',
  alignItems: 'center',
  px: 3,
  py: 1,
  borderRadius: 'full',
  bg: 'bg.canvas',
  border: '1px solid',
  borderColor: 'border.default',
  fontSize: 'sm',
  fontWeight: 'medium',
  color: 'text.primary',
})

function ForkCard({
  emoji,
  title,
  blurb,
  tag,
  selected,
  onSelect,
}: {
  emoji: string
  title: string
  blurb: string
  tag: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-action="choose-abacus-path"
      data-selected={selected}
      onClick={onSelect}
      className={css({
        position: 'relative',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: { base: 4, md: 5 },
        pt: { base: 5, md: 6 },
        borderRadius: 'xl',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: selected ? 'cyan.500' : 'border.default',
        bg: 'bg.surface',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        boxShadow: selected ? '0 8px 24px rgba(6, 182, 212, 0.18)' : 'none',
        _hover: { borderColor: selected ? 'cyan.500' : 'border.emphasized', transform: 'translateY(-2px)' },
      })}
    >
      {/* selected accent bar */}
      {selected && (
        <span
          aria-hidden="true"
          className={css({ position: 'absolute', top: 0, left: 0, right: 0, height: '4px' })}
          style={{ background: CYAN_GRADIENT }}
        />
      )}
      <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
        <span className={css({ fontSize: '2xl' })}>{emoji}</span>
        <span
          data-element="fork-check"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '22px',
            height: '22px',
            borderRadius: 'full',
            fontSize: 'xs',
            fontWeight: 'bold',
            color: selected ? 'white' : 'transparent',
            border: selected ? 'none' : '2px solid',
            borderColor: 'border.default',
          })}
          style={selected ? { background: CYAN_GRADIENT } : undefined}
        >
          ✓
        </span>
      </div>
      <h3 className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'text.primary' })}>{title}</h3>
      <p className={css({ fontSize: 'sm', color: 'text.secondary', lineHeight: '1.5', flex: 1 })}>
        {blurb}
      </p>
      <span
        className={css({
          fontSize: 'xs',
          fontWeight: 'semibold',
          color: 'text.secondary',
          bg: 'bg.canvas',
          border: '1px solid',
          borderColor: 'border.default',
          borderRadius: 'md',
          px: 2,
          py: 1,
          alignSelf: 'flex-start',
        })}
      >
        {tag}
      </span>
    </button>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div
      data-element="abacus-readback-step"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: 4,
        borderRadius: 'xl',
        bg: 'bg.surface',
        border: '1px solid',
        borderColor: 'border.default',
      })}
    >
      <span
        className={css({
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: 'full',
          color: 'white',
          fontSize: 'sm',
          fontWeight: 'bold',
        })}
        style={{ background: CYAN_GRADIENT }}
      >
        {n}
      </span>
      <h3 className={css({ fontSize: 'md', fontWeight: 'semibold', color: 'text.primary' })}>
        {title}
      </h3>
      <p className={css({ fontSize: 'sm', color: 'text.secondary', lineHeight: '1.5' })}>{body}</p>
    </div>
  )
}
