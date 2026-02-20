'use client'

import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'

export interface HeroComponentEntry {
  label: string
  description: string
  component: ComponentType
}

/**
 * Registry of React components that can be used as blog hero banners.
 * Each entry uses next/dynamic for code splitting so components are only
 * loaded when actually rendered.
 */
export const HERO_COMPONENTS: Record<string, HeroComponentEntry> = {
  'difficulty-plot-mastery': {
    label: 'Difficulty Plot (Mastery)',
    description: 'DifficultyPlot2D showing mastery progression custom points',
    component: dynamic(() => import('@/components/blog/heroes/DifficultyPlotHero'), { ssr: false }),
  },
  'readiness-all-variants': {
    label: 'Readiness Report (All States)',
    description: 'ReadinessReport showing three readiness states side by side',
    component: dynamic(
      () =>
        import('@/components/practice/ReadinessReport').then((mod) => {
          const ReadinessReport = mod.ReadinessReport
          function ReadinessHero() {
            return (
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  padding: '1rem',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                      color: '#8b949e',
                      textAlign: 'center',
                    }}
                  >
                    Not Ready
                  </div>
                  <ReadinessReport
                    readiness={{
                      'skill-1': {
                        skillId: 'skill-1',
                        isSolid: false,
                        dimensions: {
                          volume: { met: false, opportunities: 3, sessionCount: 1 },
                          speed: { met: false, medianSecondsPerTerm: 8.2 },
                          consistency: {
                            met: false,
                            recentAccuracy: 0.45,
                            lastFiveAllCorrect: false,
                            recentHelpCount: 3,
                          },
                          mastery: { met: false, pKnown: 0.3, confidence: 0.4 },
                        },
                      },
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                      color: '#8b949e',
                      textAlign: 'center',
                    }}
                  >
                    Almost Ready
                  </div>
                  <ReadinessReport
                    readiness={{
                      'skill-1': {
                        skillId: 'skill-1',
                        isSolid: false,
                        dimensions: {
                          volume: { met: true, opportunities: 15, sessionCount: 4 },
                          speed: { met: true, medianSecondsPerTerm: 3.1 },
                          consistency: {
                            met: true,
                            recentAccuracy: 0.88,
                            lastFiveAllCorrect: true,
                            recentHelpCount: 0,
                          },
                          mastery: { met: false, pKnown: 0.62, confidence: 0.7 },
                        },
                      },
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                      color: '#8b949e',
                      textAlign: 'center',
                    }}
                  >
                    Ready
                  </div>
                  <ReadinessReport
                    readiness={{
                      'skill-1': {
                        skillId: 'skill-1',
                        isSolid: true,
                        dimensions: {
                          volume: { met: true, opportunities: 25, sessionCount: 8 },
                          speed: { met: true, medianSecondsPerTerm: 2.5 },
                          consistency: {
                            met: true,
                            recentAccuracy: 0.95,
                            lastFiveAllCorrect: true,
                            recentHelpCount: 0,
                          },
                          mastery: { met: true, pKnown: 0.85, confidence: 0.9 },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            )
          }
          return ReadinessHero
        }),
      { ssr: false }
    ),
  },
  'vision-before-after': {
    label: 'Vision Before/After',
    description: 'Side-by-side comparison of problems with and without vision detection',
    component: dynamic(() => import('@/components/blog/heroes/VisionBeforeAfter'), { ssr: false }),
  },
  'vision-showcase': {
    label: 'Vision Showcase (3 Features)',
    description: 'Triptych showing observation mode, mirror mode, and ArUco auto-crop calibration',
    component: dynamic(() => import('@/components/blog/heroes/VisionShowcase'), { ssr: false }),
  },
  'blame-distribution': {
    label: 'Blame Distribution',
    description:
      'Animated blame attribution for conjunctive BKT — shows how an incorrect answer distributes blame across skills',
    component: dynamic(() => import('@/components/blog/heroes/BlameDistributionHero'), {
      ssr: false,
    }),
  },
  'subtraction-scaffolding': {
    label: 'Subtraction Scaffolding',
    description: 'Triptych showing subtraction problem (352 − 117) at three scaffolding levels',
    component: dynamic(() => import('@/components/blog/heroes/SubtractionScaffoldingHero'), {
      ssr: false,
    }),
  },
  'ten-frames': {
    label: 'Ten-Frames',
    description: 'Triptych showing addition problem (27 + 14) progressing from plain to ten-frames',
    component: dynamic(() => import('@/components/blog/heroes/TenFramesHero'), { ssr: false }),
  },
  'multi-digit': {
    label: 'Multi-Digit',
    description:
      'Triptych showing 4-digit addition (1027 + 2034) with progressive place value scaffolding',
    component: dynamic(() => import('@/components/blog/heroes/MultiDigitHero'), { ssr: false }),
  },
}

/** Get list of available hero components for admin UI dropdowns */
export function getHeroComponentList(): Array<{ id: string; label: string; description: string }> {
  return Object.entries(HERO_COMPONENTS).map(([id, entry]) => ({
    id,
    label: entry.label,
    description: entry.description,
  }))
}
