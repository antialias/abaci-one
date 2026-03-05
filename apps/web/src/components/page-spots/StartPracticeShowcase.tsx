'use client'

import { css } from '../../../styled-system/css'

/**
 * Static showcase of the StartPracticeModal for marketing page spots.
 * Recreates the visual appearance without context providers or interactivity.
 */
export function StartPracticeShowcase() {
  return (
    <div
      data-component="start-practice-showcase"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '1rem',
      })}
    >
      <div
        className={css({
          width: '360px',
          maxWidth: '100%',
          borderRadius: '20px',
          boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          position: 'relative',
        })}
        style={{
          background: 'linear-gradient(150deg, #ffffff 0%, #f8fafc 60%, #f0f9ff 100%)',
        }}
      >
        {/* Close button (decorative) */}
        <div
          className={css({
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            color: '#9ca3af',
            backgroundColor: 'rgba(0,0,0,0.04)',
            borderRadius: '50%',
          })}
        >
          ✕
        </div>

        {/* Session Focus Info — maintenance mode variant */}
        <div
          className={css({
            borderRadius: '12px',
            padding: '0.875rem 1rem',
            display: 'flex',
            gap: '0.625rem',
            alignItems: 'flex-start',
          })}
          style={{
            background:
              'linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(139, 92, 246, 0.04) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <span className={css({ fontSize: '1.5rem', lineHeight: 1 })}>✨</span>
          <div>
            <p className={css({ fontSize: '0.875rem', fontWeight: '600', color: '#1d4ed8' })}>
              Mixed review (8 skills)
            </p>
            <p className={css({ fontSize: '0.75rem', marginTop: '0.125rem', color: '#6b7280' })}>
              Keeping all your skills sharp
            </p>
          </div>
        </div>

        {/* Plan indicator pill */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <span
            className={css({
              fontSize: '0.6875rem',
              fontWeight: '600',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              color: '#2563eb',
            })}
            style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
            }}
          >
            Family Plan
          </span>
        </div>

        {/* Session Config Summary */}
        <div
          className={css({
            borderRadius: '12px',
            overflow: 'hidden',
          })}
          style={{
            background: 'rgba(0,0,0,0.03)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <div
            className={css({
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '1rem',
            })}
          >
            {/* Duration */}
            <div className={css({ textAlign: 'center' })}>
              <div
                className={css({
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#2563eb',
                  lineHeight: 1,
                })}
              >
                15
              </div>
              <div
                className={css({ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' })}
              >
                min
              </div>
            </div>

            <Dot />

            {/* Problems */}
            <div className={css({ textAlign: 'center' })}>
              <div
                className={css({
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#16a34a',
                  lineHeight: 1,
                })}
              >
                ~24
              </div>
              <div
                className={css({ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' })}
              >
                problems
              </div>
            </div>

            <Dot />

            {/* Practice modes */}
            <div className={css({ display: 'flex', alignItems: 'center', gap: '0.375rem' })}>
              <ModeChip emoji="🧮" count={10} />
              <ModeChip emoji="🧠" count={8} />
              <ModeChip emoji="💭" count={6} />
            </div>

            <Dot />

            {/* Game break */}
            <div className={css({ textAlign: 'center' })}>
              <div className={css({ fontSize: '0.875rem', lineHeight: 1 })}>🎮</div>
              <div
                className={css({
                  fontSize: '0.6875rem',
                  fontWeight: '600',
                  color: '#d97706',
                  marginTop: '0.125rem',
                })}
              >
                5m
              </div>
            </div>

            {/* Expand indicator */}
            <span
              className={css({ fontSize: '0.625rem', color: '#9ca3af', marginLeft: '0.25rem' })}
            >
              ▼
            </span>
          </div>
        </div>

        {/* Start button */}
        <button
          type="button"
          className={css({
            width: '100%',
            padding: '1rem',
            fontSize: '1.0625rem',
            fontWeight: 'bold',
            color: 'white',
            borderRadius: '12px',
            border: 'none',
            cursor: 'default',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          })}
          style={{
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            boxShadow: '0 6px 20px rgba(34, 197, 94, 0.35)',
          }}
        >
          <span>Let's Go!</span>
          <span>→</span>
        </button>
      </div>
    </div>
  )
}

function Dot() {
  return <span className={css({ fontSize: '0.5rem', color: '#d1d5db', lineHeight: 1 })}>●</span>
}

function ModeChip({ emoji, count }: { emoji: string; count: number }) {
  return (
    <div className={css({ textAlign: 'center' })}>
      <div className={css({ fontSize: '0.8125rem', lineHeight: 1 })}>{emoji}</div>
      <div
        className={css({
          fontSize: '0.625rem',
          fontWeight: '600',
          color: '#16a34a',
          marginTop: '0.125rem',
        })}
      >
        {count}
      </div>
    </div>
  )
}

/**
 * Expanded form of the StartPracticeModal showcase — shows the full settings panel.
 */
export function StartPracticeShowcaseExpanded() {
  return (
    <div
      data-component="start-practice-showcase-expanded"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '1rem',
      })}
    >
      <div
        className={css({
          width: '360px',
          maxWidth: '100%',
          borderRadius: '20px',
          boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          position: 'relative',
        })}
        style={{
          background: 'linear-gradient(150deg, #ffffff 0%, #f8fafc 60%, #f0f9ff 100%)',
        }}
      >
        {/* Close button (decorative) */}
        <div
          className={css({
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            color: '#9ca3af',
            backgroundColor: 'rgba(0,0,0,0.04)',
            borderRadius: '50%',
          })}
        >
          ✕
        </div>

        {/* Session Focus Info */}
        <div
          className={css({
            borderRadius: '12px',
            padding: '0.875rem 1rem',
            display: 'flex',
            gap: '0.625rem',
            alignItems: 'flex-start',
          })}
          style={{
            background:
              'linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(139, 92, 246, 0.04) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <span className={css({ fontSize: '1.5rem', lineHeight: 1 })}>✨</span>
          <div>
            <p className={css({ fontSize: '0.875rem', fontWeight: '600', color: '#1d4ed8' })}>
              Mixed review (8 skills)
            </p>
            <p className={css({ fontSize: '0.75rem', marginTop: '0.125rem', color: '#6b7280' })}>
              Keeping all your skills sharp
            </p>
          </div>
        </div>

        {/* Plan indicator pill */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <span
            className={css({
              fontSize: '0.6875rem',
              fontWeight: '600',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              color: '#2563eb',
            })}
            style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
            }}
          >
            Family Plan
          </span>
        </div>

        {/* Session Settings Header with collapse indicator */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 0.25rem',
          })}
        >
          <span
            className={css({
              fontSize: '0.6875rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#6b7280',
            })}
          >
            Session Settings
          </span>
          <span className={css({ fontSize: '0.625rem', color: '#9ca3af' })}>▲</span>
        </div>

        {/* Duration Selector */}
        <SettingSection label="Duration">
          <div className={css({ display: 'flex', gap: '0.375rem' })}>
            <DurationPill minutes={5} problems="~8" selected={false} />
            <DurationPill minutes={10} problems="~16" selected={false} />
            <DurationPill minutes={15} problems="~24" selected />
            <DurationPill minutes={20} problems="~32" selected={false} />
          </div>
        </SettingSection>

        {/* Practice Modes Proportion Bar */}
        <SettingSection label="Practice Modes">
          <ProportionBarStatic
            segments={[
              {
                emoji: '🧮',
                label: 'Abacus',
                weight: 10,
                color: 'rgba(22, 163, 74, 0.15)',
                accent: '#16a34a',
              },
              {
                emoji: '🧠',
                label: 'Visual',
                weight: 8,
                color: 'rgba(22, 163, 74, 0.10)',
                accent: '#16a34a',
              },
              {
                emoji: '💭',
                label: 'Linear',
                weight: 6,
                color: 'rgba(22, 163, 74, 0.06)',
                accent: '#16a34a',
              },
            ]}
          />
        </SettingSection>

        {/* Purpose Distribution Bar */}
        <SettingSection label="Purpose">
          <ProportionBarStatic
            segments={[
              {
                emoji: '🎯',
                label: 'Focus',
                weight: 4,
                color: 'rgba(37, 99, 235, 0.10)',
                accent: '#2563eb',
              },
              {
                emoji: '🔁',
                label: 'Reinforce',
                weight: 3,
                color: 'rgba(234, 88, 12, 0.10)',
                accent: '#ea580c',
              },
              {
                emoji: '📖',
                label: 'Review',
                weight: 2,
                color: 'rgba(22, 163, 74, 0.10)',
                accent: '#16a34a',
              },
              {
                emoji: '⚡',
                label: 'Challenge',
                weight: 1,
                color: 'rgba(147, 51, 234, 0.10)',
                accent: '#9333ea',
              },
            ]}
          />
        </SettingSection>

        {/* Problem Length Selector */}
        <SettingSection label="Problem Length">
          <div className={css({ display: 'flex', gap: '0.375rem' })}>
            <LengthPill label="Shorter" selected={false} />
            <LengthPill label="Recommended" selected />
            <LengthPill label="Longer" selected={false} />
          </div>
          <div
            className={css({
              fontSize: '0.625rem',
              color: '#6b7280',
              textAlign: 'center',
              marginTop: '0.375rem',
            })}
          >
            2–3 terms per problem
          </div>
        </SettingSection>

        {/* Game Break Settings */}
        <div
          className={css({
            borderRadius: '10px',
            padding: '0.625rem',
          })}
          style={{
            background:
              'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.05) 50%, rgba(6, 182, 212, 0.08) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
          }}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            })}
          >
            <div className={css({ display: 'flex', alignItems: 'center', gap: '0.375rem' })}>
              <span className={css({ fontSize: '0.875rem' })}>🎮</span>
              <span
                className={css({
                  fontSize: '0.6875rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  color: '#7c3aed',
                })}
              >
                Game Breaks
              </span>
            </div>
            <span
              className={css({
                fontSize: '0.6875rem',
                fontWeight: '700',
                padding: '0.125rem 0.5rem',
                borderRadius: '6px',
                color: '#0891b2',
              })}
              style={{
                background: 'rgba(139, 92, 246, 0.15)',
              }}
            >
              ON
            </span>
          </div>
          {/* Duration track */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginTop: '0.5rem',
            })}
          >
            {['3m', '5m', '7m'].map((d, i) => (
              <span
                key={d}
                className={css({
                  fontSize: i === 1 ? '0.8125rem' : '0.6875rem',
                  fontWeight: '600',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  color: i === 1 ? 'white' : '#7c3aed',
                })}
                style={{
                  background: i === 1 ? '#7c3aed' : 'transparent',
                  boxShadow: i === 1 ? '0 0 12px rgba(139, 92, 246, 0.6)' : 'none',
                  transform: i === 1 ? 'scale(1.1)' : 'none',
                  opacity: i === 1 ? 1 : 0.45 + i * 0.25,
                }}
              >
                {d}
              </span>
            ))}
          </div>
          <div
            className={css({
              fontSize: '0.625rem',
              fontStyle: 'italic',
              color: '#818cf8',
              textAlign: 'center',
              marginTop: '0.375rem',
            })}
          >
            5 min game break after practice
          </div>
        </div>

        {/* Start button */}
        <button
          type="button"
          className={css({
            width: '100%',
            padding: '1rem',
            fontSize: '1.0625rem',
            fontWeight: 'bold',
            color: 'white',
            borderRadius: '12px',
            border: 'none',
            cursor: 'default',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          })}
          style={{
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            boxShadow: '0 6px 20px rgba(34, 197, 94, 0.35)',
          }}
        >
          <span>Let&apos;s Go!</span>
          <span>→</span>
        </button>
      </div>
    </div>
  )
}

function SettingSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className={css({
          fontSize: '0.6875rem',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#9ca3af',
          marginBottom: '0.5rem',
        })}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function DurationPill({
  minutes,
  problems,
  selected,
}: {
  minutes: number
  problems: string
  selected: boolean
}) {
  return (
    <div
      className={css({
        flex: 1,
        textAlign: 'center',
        padding: '0.5rem 0.25rem',
        borderRadius: '8px',
        transition: 'all 0.15s ease',
      })}
      style={{
        background: selected ? 'rgba(59, 130, 246, 0.08)' : 'rgba(0,0,0,0.03)',
        border: selected ? '2px solid #3b82f6' : '2px solid rgba(0,0,0,0.06)',
      }}
    >
      <div
        className={css({
          fontSize: '0.9375rem',
          fontWeight: '600',
        })}
        style={{ color: selected ? '#2563eb' : '#334155' }}
      >
        {minutes}m
      </div>
      <div className={css({ fontSize: '0.625rem', color: '#94a3b8' })}>{problems}</div>
    </div>
  )
}

interface Segment {
  emoji: string
  label: string
  weight: number
  color: string
  accent: string
}

function ProportionBarStatic({ segments }: { segments: Segment[] }) {
  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0)
  return (
    <div
      className={css({
        display: 'flex',
        height: '56px',
        borderRadius: '12px',
        overflow: 'hidden',
        gap: '2px',
      })}
      style={{ background: 'rgba(0,0,0,0.04)' }}
    >
      {segments.map((seg) => (
        <div
          key={seg.label}
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            padding: '0 0.25rem',
            position: 'relative',
          })}
          style={{
            flex: seg.weight,
            background: seg.color,
          }}
        >
          {/* Problem count badge */}
          <div
            className={css({
              position: 'absolute',
              top: '2px',
              right: '4px',
              height: '20px',
              minWidth: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6875rem',
              fontWeight: 'bold',
              color: 'white',
              borderRadius: '10px',
              padding: '0 4px',
            })}
            style={{ background: '#22c55e' }}
          >
            {seg.weight}
          </div>
          <div className={css({ fontSize: '1.25rem', lineHeight: 1 })}>{seg.emoji}</div>
          {totalWeight > 3 && (
            <div
              className={css({
                fontSize: '0.625rem',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              })}
              style={{ color: seg.accent }}
            >
              {seg.label}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function LengthPill({ label, selected }: { label: string; selected: boolean }) {
  return (
    <div
      className={css({
        flex: 1,
        textAlign: 'center',
        padding: '0.5rem 0.25rem',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: '600',
      })}
      style={{
        background: selected ? '#7c3aed' : 'rgba(0,0,0,0.04)',
        color: selected ? 'white' : '#6b7280',
      }}
    >
      {label}
    </div>
  )
}
