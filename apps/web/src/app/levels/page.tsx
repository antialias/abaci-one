'use client'

import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../styled-system/css'
import { container, stack } from '../../../styled-system/patterns'

export default function LevelsPage() {
  return (
    <PageWithNav navTitle="Kyu & Dan Levels" navEmoji="📊">
      <div className={css({ bg: 'gray.900', minHeight: '100vh' })}>
        {/* Hero Section */}
        <div
          className={css({
            background:
              'linear-gradient(135deg, rgba(17, 24, 39, 1) 0%, rgba(124, 58, 237, 0.3) 50%, rgba(17, 24, 39, 1) 100%)',
            color: 'white',
            py: { base: '12', md: '16' },
            position: 'relative',
            overflow: 'hidden',
          })}
        >
          {/* Background pattern */}
          <div
            className={css({
              position: 'absolute',
              inset: 0,
              opacity: 0.1,
              backgroundImage:
                'radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.15) 1px, transparent 0)',
              backgroundSize: '40px 40px',
            })}
          />

          <div className={container({ maxW: '6xl', px: '4', position: 'relative' })}>
            <div className={css({ textAlign: 'center', maxW: '5xl', mx: 'auto' })}>
              {/* Main headline */}
              <h1
                className={css({
                  fontSize: { base: '3xl', md: '5xl', lg: '6xl' },
                  fontWeight: 'bold',
                  mb: '4',
                  lineHeight: 'tight',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
                  backgroundClip: 'text',
                  color: 'transparent',
                })}
              >
                Understanding Kyu & Dan Levels
              </h1>

              {/* Subtitle */}
              <p
                className={css({
                  fontSize: { base: 'lg', md: 'xl' },
                  color: 'gray.300',
                  mb: '6',
                  maxW: '3xl',
                  mx: 'auto',
                  lineHeight: '1.6',
                })}
              >
                Learn about the official Japanese soroban ranking system used by the Japan Abacus
                Federation
              </p>

              {/* Journey progression emojis */}
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '4',
                  mb: '8',
                  flexWrap: 'wrap',
                })}
              >
                {[
                  { emoji: '🧒', label: '10 Kyu' },
                  { emoji: '→', label: '', isArrow: true },
                  { emoji: '🧑', label: '5 Kyu' },
                  { emoji: '→', label: '', isArrow: true },
                  { emoji: '🧔', label: '1 Kyu' },
                  { emoji: '→', label: '', isArrow: true },
                  { emoji: '🧙', label: 'Dan' },
                ].map((step, i) => (
                  <div
                    key={i}
                    className={css({
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '1',
                      opacity: step.isArrow ? 0.5 : 1,
                    })}
                  >
                    <div
                      className={css({
                        fontSize: step.isArrow ? 'xl' : '4xl',
                        color: step.isArrow ? 'gray.500' : 'yellow.400',
                      })}
                    >
                      {step.emoji}
                    </div>
                    {step.label && (
                      <div className={css({ fontSize: 'xs', color: 'gray.400' })}>{step.label}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main content container */}
        <div className={container({ maxW: '7xl', px: '4', py: '12' })}>
          {/* Placeholder for Phase 2 */}
          <section className={stack({ gap: '8' })}>
            <div className={css({ textAlign: 'center' })}>
              <h2
                className={css({
                  fontSize: { base: '2xl', md: '3xl' },
                  fontWeight: 'bold',
                  color: 'white',
                  mb: '4',
                })}
              >
                Kyu Levels (10th to 1st)
              </h2>
              <p className={css({ color: 'gray.400', fontSize: 'md', mb: '8' })}>
                Content coming in Phase 2...
              </p>
            </div>

            {/* Placeholder card */}
            <div
              className={css({
                bg: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid',
                borderColor: 'gray.700',
                rounded: 'xl',
                p: '8',
                textAlign: 'center',
              })}
            >
              <p className={css({ color: 'gray.300' })}>
                Phase 1 Complete! Basic page structure and routing are ready for testing.
              </p>
              <p className={css({ color: 'gray.400', mt: '2', fontSize: 'sm' })}>
                Test by visiting: <code>/levels</code>
              </p>
            </div>
          </section>
        </div>
      </div>
    </PageWithNav>
  )
}
