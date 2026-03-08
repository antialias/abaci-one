'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { css } from '../../../../../styled-system/css'
import {
  usePlayerSessionPreferences,
  useSavePlayerSessionPreferences,
} from '@/hooks/usePlayerSessionPreferences'
import { getPracticeApprovedGames } from '@/lib/arcade/practice-approved-games'
import {
  DEFAULT_SESSION_PREFERENCES,
  SESSION_SONG_GENRES,
} from '@/db/schema/player-session-preferences'
import type { KidLanguageStyle } from '@/db/schema/player-session-preferences'
import { KID_LANGUAGE_STYLES, getRecommendedKidLanguageStyle } from '@/lib/kidLanguageStyle'
import { getAgeFromBirthday } from '@/lib/playerAge'
import { InteractiveDice } from '@/components/ui/InteractiveDice'

// ============================================================================
// Types
// ============================================================================

interface SettingsTabProps {
  studentId: string
  studentName: string
  studentBirthday?: string | null
  isDark: boolean
  onManageSkills: () => void
  /** Whether celebration songs are available (feature flag + tier). */
  songEnabled?: boolean
}

// ============================================================================
// SettingsTab
// ============================================================================

export function SettingsTab({
  studentId,
  studentName,
  studentBirthday,
  isDark,
  onManageSkills,
  songEnabled = false,
}: SettingsTabProps) {
  const { data: preferences, isLoading } = usePlayerSessionPreferences(studentId)
  const saveMutation = useSavePlayerSessionPreferences(studentId)

  const allApprovedGames = useMemo(() => getPracticeApprovedGames(), [])

  const enabledGames: string[] = useMemo(
    () =>
      preferences?.gameBreakEnabledGames ?? DEFAULT_SESSION_PREFERENCES.gameBreakEnabledGames ?? [],
    [preferences?.gameBreakEnabledGames]
  )

  const handleToggleGame = useCallback(
    (gameName: string) => {
      const current = preferences?.gameBreakEnabledGames ?? []
      const isEnabled = current.includes(gameName)
      const updated = isEnabled ? current.filter((g) => g !== gameName) : [...current, gameName]

      saveMutation.mutate({
        ...(preferences ?? DEFAULT_SESSION_PREFERENCES),
        gameBreakEnabledGames: updated,
      })
    },
    [preferences, saveMutation]
  )

  const enabledCount = enabledGames.length
  const resolvedAge = useMemo(() => getAgeFromBirthday(studentBirthday), [studentBirthday])
  const recommendedLanguageStyle = useMemo(
    () => getRecommendedKidLanguageStyle(resolvedAge),
    [resolvedAge]
  )
  const currentLanguageStyle = (preferences?.kidLanguageStyle ??
    recommendedLanguageStyle) as KidLanguageStyle

  const handleSelectLanguageStyle = useCallback(
    (style: KidLanguageStyle) => {
      saveMutation.mutate({
        ...(preferences ?? DEFAULT_SESSION_PREFERENCES),
        kidLanguageStyle: style,
      })
    },
    [preferences, saveMutation]
  )

  const songEnabledForStudent = preferences?.sessionSongEnabled ?? true
  const songGenre = preferences?.sessionSongGenre ?? 'shuffle'

  const handleToggleSong = useCallback(() => {
    saveMutation.mutate({
      ...(preferences ?? DEFAULT_SESSION_PREFERENCES),
      sessionSongEnabled: !songEnabledForStudent,
    })
  }, [preferences, saveMutation, songEnabledForStudent])

  const handleSelectSongGenre = useCallback(
    (genre: string) => {
      saveMutation.mutate({
        ...(preferences ?? DEFAULT_SESSION_PREFERENCES),
        sessionSongGenre: genre,
      })
    },
    [preferences, saveMutation]
  )

  return (
    <div data-component="settings-tab">
      {/* Game Break Games Pane */}
      <section
        data-section="game-break-games"
        className={css({
          marginBottom: '2rem',
        })}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
          })}
        >
          <h3
            className={css({
              fontSize: '1.125rem',
              fontWeight: '700',
              color: isDark ? 'gray.100' : 'gray.800',
            })}
          >
            Game Break Games
          </h3>
          <span
            className={css({
              fontSize: '0.75rem',
              fontWeight: '500',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
            })}
            style={{
              backgroundColor:
                enabledCount > 0
                  ? isDark
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(34, 197, 94, 0.1)'
                  : isDark
                    ? 'rgba(234, 179, 8, 0.15)'
                    : 'rgba(234, 179, 8, 0.1)',
              color:
                enabledCount > 0
                  ? isDark
                    ? '#86efac'
                    : '#16a34a'
                  : isDark
                    ? '#fde047'
                    : '#ca8a04',
            }}
          >
            {enabledCount} of {allApprovedGames.length} enabled
          </span>
        </div>

        <p
          className={css({
            fontSize: '0.8125rem',
            color: isDark ? 'gray.400' : 'gray.600',
            marginBottom: '1rem',
            lineHeight: '1.5',
          })}
        >
          Choose which games {studentName} can play during practice breaks.
        </p>

        {enabledCount === 0 && (
          <div
            data-element="no-games-warning"
            className={css({
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.8125rem',
              fontWeight: '500',
            })}
            style={{
              backgroundColor: isDark ? 'rgba(234, 179, 8, 0.12)' : 'rgba(234, 179, 8, 0.08)',
              color: isDark ? '#fde047' : '#a16207',
              border: `1px solid ${isDark ? 'rgba(234, 179, 8, 0.25)' : 'rgba(234, 179, 8, 0.2)'}`,
            }}
          >
            Enable at least one game to use game breaks during practice.
          </div>
        )}

        {isLoading ? (
          <div
            className={css({
              display: 'flex',
              justifyContent: 'center',
              padding: '2rem',
              color: isDark ? 'gray.500' : 'gray.400',
              fontSize: '0.875rem',
            })}
          >
            Loading preferences...
          </div>
        ) : (
          <div
            data-element="game-grid"
            className={css({
              display: 'grid',
              gridTemplateColumns: {
                base: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
              gap: '0.75rem',
            })}
          >
            {allApprovedGames.map((game) => {
              const isEnabled = enabledGames.includes(game.manifest.name)
              return (
                <button
                  key={game.manifest.name}
                  type="button"
                  data-game={game.manifest.name}
                  data-enabled={isEnabled}
                  data-action="toggle-game"
                  onClick={() => handleToggleGame(game.manifest.name)}
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.875rem 1rem',
                    borderRadius: '12px',
                    border: '2px solid',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    width: '100%',
                    _hover: {
                      transform: 'translateY(-1px)',
                    },
                  })}
                  style={{
                    borderColor: isEnabled
                      ? isDark
                        ? 'rgba(139, 92, 246, 0.4)'
                        : 'rgba(139, 92, 246, 0.3)'
                      : isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.08)',
                    backgroundColor: isEnabled
                      ? isDark
                        ? 'rgba(139, 92, 246, 0.12)'
                        : 'rgba(139, 92, 246, 0.06)'
                      : isDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(0,0,0,0.02)',
                    boxShadow: isEnabled
                      ? isDark
                        ? '0 0 12px rgba(139, 92, 246, 0.2)'
                        : '0 0 12px rgba(139, 92, 246, 0.1)'
                      : 'none',
                    opacity: isEnabled ? 1 : 0.6,
                  }}
                >
                  <span
                    className={css({
                      fontSize: '1.75rem',
                      flexShrink: 0,
                    })}
                  >
                    {game.manifest.icon}
                  </span>
                  <div className={css({ flex: 1, minWidth: 0 })}>
                    <div
                      className={css({
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      })}
                      style={{
                        color: isEnabled
                          ? isDark
                            ? '#e5e7eb'
                            : '#374151'
                          : isDark
                            ? '#9ca3af'
                            : '#6b7280',
                      }}
                    >
                      {game.manifest.displayName}
                    </div>
                  </div>
                  {/* Toggle indicator */}
                  <div
                    className={css({
                      width: '40px',
                      height: '22px',
                      borderRadius: '11px',
                      position: 'relative',
                      flexShrink: 0,
                      transition: 'background-color 0.15s ease',
                    })}
                    style={{
                      backgroundColor: isEnabled
                        ? isDark
                          ? '#8b5cf6'
                          : '#7c3aed'
                        : isDark
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(0,0,0,0.12)',
                    }}
                  >
                    <div
                      className={css({
                        position: 'absolute',
                        top: '2px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        transition: 'left 0.15s ease',
                        backgroundColor: 'white',
                      })}
                      style={{
                        left: isEnabled ? '20px' : '2px',
                      }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Communication Style */}
      <section
        data-section="player-communication-style"
        className={css({
          marginBottom: '2rem',
        })}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
          })}
        >
          <h3
            className={css({
              fontSize: '1.125rem',
              fontWeight: '700',
              color: isDark ? 'gray.100' : 'gray.800',
            })}
          >
            Communication Style
          </h3>
          {resolvedAge != null && (
            <span
              className={css({
                fontSize: '0.75rem',
                fontWeight: '500',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
              })}
              style={{
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                color: isDark ? '#93c5fd' : '#2563eb',
              }}
            >
              Recommended for age {resolvedAge}
            </span>
          )}
        </div>

        <p
          className={css({
            fontSize: '0.8125rem',
            color: isDark ? 'gray.400' : 'gray.600',
            marginBottom: '1rem',
            lineHeight: '1.5',
          })}
        >
          Choose how formal the explanations feel for {studentName}. This applies across the app
          when player-facing language is available.
        </p>

        <div
          data-element="kid-language-grid"
          className={css({
            display: 'grid',
            gridTemplateColumns: { base: '1fr', sm: 'repeat(3, 1fr)' },
            gap: '0.75rem',
          })}
        >
          {KID_LANGUAGE_STYLES.map((style) => {
            const isSelected = currentLanguageStyle === style.id
            const isRecommended = recommendedLanguageStyle === style.id
            return (
              <button
                key={style.id}
                type="button"
                data-language-style={style.id}
                data-selected={isSelected}
                onClick={() => handleSelectLanguageStyle(style.id)}
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  padding: '0.85rem 0.9rem',
                  textAlign: 'left',
                  borderRadius: '12px',
                  border: '2px solid',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  _hover: {
                    transform: 'translateY(-1px)',
                  },
                })}
                style={{
                  borderColor: isSelected
                    ? isDark
                      ? 'rgba(34, 197, 94, 0.5)'
                      : 'rgba(34, 197, 94, 0.4)'
                    : isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.08)',
                  backgroundColor: isSelected
                    ? isDark
                      ? 'rgba(34, 197, 94, 0.12)'
                      : 'rgba(34, 197, 94, 0.08)'
                    : isDark
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(0,0,0,0.02)',
                  color: isSelected
                    ? isDark
                      ? '#e5e7eb'
                      : '#14532d'
                    : isDark
                      ? '#9ca3af'
                      : '#374151',
                }}
              >
                <div
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                  })}
                >
                  <span
                    className={css({
                      fontSize: '0.875rem',
                      fontWeight: '700',
                    })}
                  >
                    {style.label}
                  </span>
                  {isRecommended && (
                    <span
                      className={css({
                        fontSize: '0.625rem',
                        fontWeight: '600',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '999px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      })}
                      style={{
                        backgroundColor: isDark
                          ? 'rgba(148, 163, 184, 0.2)'
                          : 'rgba(148, 163, 184, 0.25)',
                        color: isDark ? '#e2e8f0' : '#475569',
                      }}
                    >
                      Recommended
                    </span>
                  )}
                </div>
                <span
                  className={css({
                    fontSize: '0.75rem',
                    lineHeight: '1.4',
                    color: isSelected ? (isDark ? '#d1fae5' : '#166534') : undefined,
                  })}
                >
                  {style.description}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Celebration Songs */}
      {songEnabled && (
        <section
          data-section="celebration-songs"
          className={css({
            marginBottom: '2rem',
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
            })}
          >
            <h3
              className={css({
                fontSize: '1.125rem',
                fontWeight: '700',
                color: isDark ? 'gray.100' : 'gray.800',
              })}
            >
              Celebration Songs
            </h3>
            {/* Enable/Disable toggle */}
            <button
              type="button"
              data-action="toggle-song"
              data-enabled={songEnabledForStudent}
              onClick={handleToggleSong}
              className={css({
                width: '40px',
                height: '22px',
                borderRadius: '11px',
                position: 'relative',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background-color 0.15s ease',
              })}
              style={{
                backgroundColor: songEnabledForStudent
                  ? isDark
                    ? '#8b5cf6'
                    : '#7c3aed'
                  : isDark
                    ? 'rgba(255,255,255,0.12)'
                    : 'rgba(0,0,0,0.12)',
              }}
            >
              <div
                className={css({
                  position: 'absolute',
                  top: '2px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  transition: 'left 0.15s ease',
                  backgroundColor: 'white',
                })}
                style={{
                  left: songEnabledForStudent ? '20px' : '2px',
                }}
              />
            </button>
          </div>

          <p
            className={css({
              fontSize: '0.8125rem',
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '1rem',
              lineHeight: '1.5',
            })}
          >
            {songEnabledForStudent
              ? `A personalized song is generated for ${studentName} after each practice session.`
              : `Celebration songs are turned off for ${studentName}.`}
          </p>

          {/* Genre Picker (only shown when enabled) */}
          {songEnabledForStudent && (
            <SongGenreCombobox value={songGenre} onChange={handleSelectSongGenre} isDark={isDark} />
          )}
        </section>
      )}

      {/* Skills Pane */}
      <section data-section="skills-shortcut">
        <h3
          className={css({
            fontSize: '1.125rem',
            fontWeight: '700',
            color: isDark ? 'gray.100' : 'gray.800',
            marginBottom: '0.75rem',
          })}
        >
          Skills
        </h3>
        <p
          className={css({
            fontSize: '0.8125rem',
            color: isDark ? 'gray.400' : 'gray.600',
            marginBottom: '1rem',
            lineHeight: '1.5',
          })}
        >
          Manage which skills {studentName} is practicing.
        </p>
        <button
          type="button"
          data-action="manage-skills"
          onClick={onManageSkills}
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            borderRadius: '10px',
            border: '1px solid',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            _hover: {
              transform: 'translateY(-1px)',
            },
          })}
          style={{
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.06)',
            borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
            color: isDark ? '#93c5fd' : '#2563eb',
          }}
        >
          <span>Manage Skills</span>
        </button>
      </section>
    </div>
  )
}

// ============================================================================
// SongGenreCombobox — tag input with dropdown for genre mixing
// ============================================================================

const GENRE_DISPLAY: Record<string, string> = Object.fromEntries(
  SESSION_SONG_GENRES.map((g) => [g.id, g.label])
)

function tagLabel(tag: string): string {
  return GENRE_DISPLAY[tag] ?? tag
}

/** Parse comma-separated genre string into array of tags */
function parseTags(value: string): string[] {
  if (!value || value === 'any' || value === 'shuffle') return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Join tags back into stored string. Empty tags → 'shuffle' (default). */
function joinTags(tags: string[]): string {
  return tags.length === 0 ? 'shuffle' : tags.join(', ')
}

/** Pick n random unique items from an array */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

type GenreMode = 'shuffle' | 'any' | 'pick'

function deriveMode(value: string): GenreMode {
  if (value === 'shuffle') return 'shuffle'
  if (value === 'any') return 'any'
  return 'pick'
}

function SongGenreCombobox({
  value,
  onChange,
  isDark,
}: {
  value: string
  onChange: (genre: string) => void
  isDark: boolean
}) {
  const tags = useMemo(() => parseTags(value), [value])
  const mode = deriveMode(value)

  const handleRandomize = useCallback(() => {
    const pool = SESSION_SONG_GENRES.filter((g) => g.id !== 'any' && g.id !== 'shuffle')
    const count = 2 + Math.floor(Math.random() * 2) // 2 or 3
    const picked = pickRandom(pool, count).map((g) => g.id)
    onChange(joinTags(picked))
  }, [onChange])

  const handleModeChange = useCallback(
    (newMode: GenreMode) => {
      if (newMode === 'shuffle') onChange('shuffle')
      else if (newMode === 'any') onChange('any')
      // 'pick' — keep current tags or start empty (will show combobox)
      else if (tags.length === 0) handleRandomize() // seed with a random mix
    },
    [onChange, tags, handleRandomize]
  )

  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Exclude meta modes from dropdown
  const presets = useMemo(
    () => SESSION_SONG_GENRES.filter((g) => g.id !== 'any' && g.id !== 'shuffle'),
    []
  )

  const filtered = useMemo(() => {
    if (!filter) return presets
    const q = filter.toLowerCase()
    return presets.filter((g) => g.label.toLowerCase().includes(q) || g.id.includes(q))
  }, [filter, presets])

  const toggleTag = useCallback(
    (tagId: string) => {
      const has = tags.includes(tagId)
      const next = has ? tags.filter((t) => t !== tagId) : [...tags, tagId]
      onChange(joinTags(next))
      setFilter('')
    },
    [tags, onChange]
  )

  const addTag = useCallback(
    (tagId: string) => {
      if (tags.includes(tagId)) return
      onChange(joinTags([...tags, tagId]))
      setFilter('')
    },
    [tags, onChange]
  )

  const removeTag = useCallback(
    (tagId: string) => {
      onChange(joinTags(tags.filter((t) => t !== tagId)))
    },
    [tags, onChange]
  )

  const handleClearAll = useCallback(() => {
    onChange('shuffle')
    setFilter('')
  }, [onChange])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value)
    setOpen(true)
  }, [])

  const handleInputFocus = useCallback(() => {
    setOpen(true)
  }, [])

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const trimmed = filter.trim().toLowerCase()
        if (filtered.length === 1) {
          toggleTag(filtered[0].id)
        } else if (trimmed) {
          addTag(trimmed)
        }
      } else if (e.key === 'Backspace' && !filter && tags.length > 0) {
        removeTag(tags[tags.length - 1])
      } else if (e.key === 'Escape') {
        setOpen(false)
        setFilter('')
        inputRef.current?.blur()
      }
    },
    [filter, filtered, tags, toggleTag, addTag, removeTag]
  )

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return
    setTimeout(() => {
      setOpen(false)
      setFilter('')
    }, 150)
  }, [])

  const chipStyle = (isDark: boolean) => ({
    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
    color: isDark ? '#c4b5fd' : '#6d28d9',
    borderColor: isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.25)',
  })

  const MODE_OPTIONS: { id: GenreMode; label: string; hint: string }[] = [
    { id: 'shuffle', label: 'Surprise Mix', hint: 'Fresh genre combo each song' },
    { id: 'any', label: 'Rotate', hint: 'One genre at a time, rotated' },
    { id: 'pick', label: 'Pick', hint: 'Choose specific genres' },
  ]

  const activePillStyle = (dark: boolean) => ({
    backgroundColor: dark ? '#8b5cf6' : '#7c3aed',
    color: 'white',
    borderColor: dark ? '#8b5cf6' : '#7c3aed',
  })

  const inactivePillStyle = (dark: boolean) => ({
    backgroundColor: 'transparent',
    color: dark ? '#d1d5db' : '#374151',
    borderColor: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
  })

  return (
    <div
      ref={containerRef}
      data-element="song-genre-combobox"
      className={css({ position: 'relative' })}
      onBlur={handleBlur}
    >
      {/* Mode pills */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: mode === 'pick' ? '0.5rem' : '0',
        })}
      >
        <span
          className={css({
            fontSize: '0.8125rem',
            fontWeight: '600',
            color: isDark ? 'gray.300' : 'gray.600',
            flexShrink: 0,
          })}
        >
          Genre
        </span>
        <div className={css({ display: 'flex', gap: '4px', flexWrap: 'wrap' })}>
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              data-action={`genre-mode-${opt.id}`}
              data-active={mode === opt.id}
              onClick={() => handleModeChange(opt.id)}
              title={opt.hint}
              className={css({
                padding: '2px 10px',
                borderRadius: '999px',
                border: '1.5px solid',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                lineHeight: '1.6',
              })}
              style={mode === opt.id ? activePillStyle(isDark) : inactivePillStyle(isDark)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {mode === 'pick' && (
          <InteractiveDice size={16} title="Randomize genres" onRoll={handleRandomize} />
        )}
      </div>

      {/* Hint text for non-pick modes */}
      {mode !== 'pick' && (
        <p
          className={css({
            fontSize: '0.75rem',
            color: isDark ? 'gray.500' : 'gray.400',
            marginTop: '4px',
          })}
        >
          {MODE_OPTIONS.find((o) => o.id === mode)?.hint}
        </p>
      )}

      {/* Tag input — only shown in pick mode */}
      {mode === 'pick' && (
        <>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
            <div
              data-element="tag-input-wrapper"
              onClick={() => inputRef.current?.focus()}
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '4px',
                flex: 1,
                minH: '32px',
                padding: '3px 6px',
                borderRadius: '8px',
                border: '1.5px solid',
                cursor: 'text',
                transition: 'border-color 0.15s',
              })}
              style={{
                borderColor: open
                  ? isDark
                    ? '#a78bfa'
                    : '#8b5cf6'
                  : isDark
                    ? 'rgba(255,255,255,0.12)'
                    : 'rgba(0,0,0,0.15)',
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'white',
              }}
            >
              {/* Chips */}
              {tags.map((tag) => (
                <span
                  key={tag}
                  data-element="genre-chip"
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '1px 8px',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    border: '1px solid',
                    whiteSpace: 'nowrap',
                    lineHeight: '1.6',
                  })}
                  style={chipStyle(isDark)}
                >
                  {tagLabel(tag)}
                  <button
                    type="button"
                    data-action="remove-genre"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTag(tag)
                    }}
                    className={css({
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      padding: '0 1px',
                      fontSize: '0.8rem',
                      lineHeight: 1,
                      opacity: 0.6,
                      _hover: { opacity: 1 },
                    })}
                    style={{ color: isDark ? '#c4b5fd' : '#6d28d9' }}
                  >
                    ×
                  </button>
                </span>
              ))}

              {/* Text input */}
              <input
                ref={inputRef}
                type="text"
                value={filter}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onKeyDown={handleInputKeyDown}
                placeholder={tags.length === 0 ? 'Type or pick genres…' : 'Add more…'}
                maxLength={60}
                className={css({
                  flex: 1,
                  minW: '80px',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: '500',
                  padding: '2px 4px',
                  background: 'transparent',
                })}
                style={{ color: isDark ? '#e5e7eb' : '#374151' }}
              />
            </div>
          </div>

          {/* Dropdown */}
          {open && (
            <div
              data-element="genre-dropdown"
              className={css({
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                borderRadius: '10px',
                border: '1px solid',
                maxH: '240px',
                overflowY: 'auto',
                zIndex: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              })}
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                backgroundColor: isDark ? '#1f2937' : 'white',
              }}
            >
              {filtered.map((genre) => {
                const selected = tags.includes(genre.id)
                return (
                  <button
                    key={genre.id}
                    type="button"
                    data-genre={genre.id}
                    data-selected={selected}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggleTag(genre.id)}
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.45rem 0.75rem',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: selected ? '700' : '500',
                      transition: 'background 0.1s',
                      _hover: {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      },
                    })}
                    style={{
                      backgroundColor: selected
                        ? isDark
                          ? 'rgba(139, 92, 246, 0.12)'
                          : 'rgba(139, 92, 246, 0.06)'
                        : 'transparent',
                      color: selected
                        ? isDark
                          ? '#c4b5fd'
                          : '#6d28d9'
                        : isDark
                          ? '#d1d5db'
                          : '#374151',
                    }}
                  >
                    <span
                      className={css({
                        width: '16px',
                        fontSize: '0.7rem',
                        textAlign: 'center',
                        flexShrink: 0,
                      })}
                    >
                      {selected ? '✓' : ''}
                    </span>
                    {genre.label}
                  </button>
                )
              })}

              {/* Custom genre option */}
              {filter.trim() && !filtered.some((g) => g.id === filter.trim().toLowerCase()) && (
                <button
                  type="button"
                  data-action="add-custom-genre"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(filter.trim().toLowerCase())}
                  className={css({
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 0.75rem',
                    border: 'none',
                    borderTop: '1px solid',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: '500',
                    fontStyle: 'italic',
                  })}
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    backgroundColor: 'transparent',
                    color: isDark ? '#a78bfa' : '#7c3aed',
                  }}
                >
                  Add &ldquo;{filter.trim()}&rdquo;
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
