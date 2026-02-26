'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { EmojiPicker } from '@/components/EmojiPicker'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../../styled-system/css'
import { useUpdatePlayer, useUserPlayers } from '@/hooks/useUserPlayers'
import { SettingsTab } from '@/app/practice/[studentId]/dashboard/SettingsTab'
import { ManualSkillSelector } from '@/components/practice/ManualSkillSelector'
import { usePlayerCurriculumQuery, useSetMasteredSkills } from '@/hooks/usePlayerCurriculum'
import type { PlayerSkillMastery } from '@/db/schema/player-skill-mastery'

const AVAILABLE_COLORS = [
  '#FFB3BA',
  '#FFDFBA',
  '#FFFFBA',
  '#BAFFC9',
  '#BAE1FF',
  '#DCC6E0',
  '#F0E68C',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E9',
  '#F8B500',
]

interface PlayerSettingsClientProps {
  playerId: string
}

export function PlayerSettingsClient({ playerId }: PlayerSettingsClientProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { data: players = [], isLoading } = useUserPlayers()
  const updatePlayer = useUpdatePlayer()
  const curriculumQuery = usePlayerCurriculumQuery(playerId)
  const setMasteredSkills = useSetMasteredSkills()

  const player = useMemo(() => players.find((p) => p.id === playerId), [players, playerId])

  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showManualSkillModal, setShowManualSkillModal] = useState(false)
  const [localName, setLocalName] = useState('')
  const [localAge, setLocalAge] = useState('')
  const [ageError, setAgeError] = useState<string | null>(null)

  useEffect(() => {
    if (!player) return
    setLocalName(player.name)
    setLocalAge(player.age != null ? String(player.age) : '')
    setAgeError(null)
  }, [player?.id, player?.name, player?.age])

  const handleSaveName = useCallback(() => {
    if (!player) return
    const trimmed = localName.trim()
    if (!trimmed || trimmed === player.name) return
    updatePlayer.mutate({ id: player.id, updates: { name: trimmed } })
  }, [localName, player, updatePlayer])

  const handleSaveAge = useCallback(() => {
    if (!player) return
    const trimmed = localAge.trim()
    if (!trimmed) {
      if (player.age !== null) {
        updatePlayer.mutate({ id: player.id, updates: { age: null } })
      }
      setAgeError(null)
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 120) {
      setLocalAge(player.age != null ? String(player.age) : '')
      setAgeError('Please enter a number between 1 and 120.')
      return
    }
    const nextAge = Math.floor(parsed)
    if (nextAge === player.age) return
    setAgeError(null)
    updatePlayer.mutate({ id: player.id, updates: { age: nextAge } })
  }, [localAge, player, updatePlayer])

  const handleSelectEmoji = useCallback(
    (emoji: string) => {
      if (!player) return
      updatePlayer.mutate({ id: player.id, updates: { emoji } })
      setShowEmojiPicker(false)
    },
    [player, updatePlayer]
  )

  const handleSelectColor = useCallback(
    (color: string) => {
      if (!player || color === player.color) return
      updatePlayer.mutate({ id: player.id, updates: { color } })
    },
    [player, updatePlayer]
  )

  const skillMasteryData = useMemo(
    () => (curriculumQuery.data?.skills ?? []) as PlayerSkillMastery[],
    [curriculumQuery.data?.skills]
  )

  const masteredSkillIds = useMemo(
    () => skillMasteryData.filter((skill) => skill.isPracticing).map((skill) => skill.skillId),
    [skillMasteryData]
  )

  const handleSaveManualSkills = useCallback(
    async (nextMasteredSkills: string[]) => {
      await setMasteredSkills.mutateAsync({
        playerId,
        masteredSkillIds: nextMasteredSkills,
      })
    },
    [playerId, setMasteredSkills]
  )

  if (isLoading) {
    return (
      <PageWithNav>
        <main
          className={css({
            minHeight: '100vh',
            backgroundColor: isDark ? 'gray.900' : 'gray.50',
            padding: '2rem',
          })}
        >
          <div
            className={css({
              textAlign: 'center',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            Loading player settings...
          </div>
        </main>
      </PageWithNav>
    )
  }

  if (!player) {
    return (
      <PageWithNav>
        <main
          className={css({
            minHeight: '100vh',
            backgroundColor: isDark ? 'gray.900' : 'gray.50',
            padding: '2rem',
          })}
        >
          <div
            className={css({
              maxWidth: '720px',
              margin: '0 auto',
              textAlign: 'center',
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: 'md',
            })}
          >
            <h2
              className={css({
                fontSize: '1.5rem',
                fontWeight: '700',
                color: isDark ? 'gray.100' : 'gray.800',
                marginBottom: '0.75rem',
              })}
            >
              Player not found
            </h2>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.600',
                marginBottom: '1.5rem',
              })}
            >
              This player may have been removed or is no longer accessible.
            </p>
            <Link
              href="/players"
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.75rem 1.5rem',
                borderRadius: '999px',
                fontWeight: '600',
                backgroundColor: 'blue.500',
                color: 'white',
                textDecoration: 'none',
                _hover: { backgroundColor: 'blue.600' },
              })}
            >
              Back to Players
            </Link>
          </div>
        </main>
      </PageWithNav>
    )
  }

  if (showEmojiPicker) {
    return (
      <EmojiPicker
        currentEmoji={player.emoji}
        onEmojiSelect={handleSelectEmoji}
        onClose={() => setShowEmojiPicker(false)}
        title={`Choose character for ${player.name}`}
        accentColor="green"
        isDark={isDark}
      />
    )
  }

  return (
    <PageWithNav>
      <main
        data-component="player-settings-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          padding: '2rem',
        })}
      >
        <div
          className={css({
            maxWidth: '860px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          })}
        >
          <header
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            })}
          >
            <div>
              <Link
                href="/players"
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: isDark ? 'gray.300' : 'gray.600',
                  textDecoration: 'none',
                  marginBottom: '0.5rem',
                  _hover: { color: isDark ? 'gray.100' : 'gray.800' },
                })}
              >
                ← Back to Players
              </Link>
              <h1
                className={css({
                  fontSize: '2rem',
                  fontWeight: '800',
                  color: isDark ? 'white' : 'gray.900',
                })}
              >
                Player Settings
              </h1>
            </div>
            <div
              className={css({
                fontSize: '0.8rem',
                fontWeight: '600',
                color: updatePlayer.isPending
                  ? isDark
                    ? 'yellow.300'
                    : 'yellow.600'
                  : isDark
                    ? 'green.300'
                    : 'green.600',
              })}
            >
              {updatePlayer.isPending ? 'Saving changes…' : 'Changes saved automatically'}
            </div>
          </header>

          <section
            data-section="player-identity"
            className={css({
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: 'md',
            })}
          >
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: { base: '1fr', md: '160px 1fr' },
                gap: '1.5rem',
                alignItems: 'center',
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                })}
              >
                <div
                  className={css({
                    width: '120px',
                    height: '120px',
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '3rem',
                    boxShadow: 'md',
                  })}
                  style={{ backgroundColor: player.color }}
                >
                  {player.emoji}
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(true)}
                  className={css({
                    padding: '0.5rem 1rem',
                    borderRadius: '999px',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.300',
                    backgroundColor: isDark ? 'gray.700' : 'gray.100',
                    color: isDark ? 'gray.200' : 'gray.700',
                    fontWeight: '600',
                    cursor: 'pointer',
                    _hover: {
                      backgroundColor: isDark ? 'gray.600' : 'gray.200',
                    },
                  })}
                >
                  Change Character
                </button>
              </div>

              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                })}
              >
                <div>
                  <label
                    className={css({
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      color: isDark ? 'gray.300' : 'gray.600',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    })}
                  >
                    Name
                  </label>
                  <input
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur()
                      }
                    }}
                    className={css({
                      width: '100%',
                      padding: '0.75rem 1rem',
                      fontSize: '1rem',
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: isDark ? 'gray.600' : 'gray.300',
                      backgroundColor: isDark ? 'gray.700' : 'white',
                      color: isDark ? 'gray.100' : 'gray.800',
                    })}
                  />
                </div>

                <div>
                  <label
                    className={css({
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      color: isDark ? 'gray.300' : 'gray.600',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    })}
                  >
                    Age (optional)
                  </label>
                  <input
                    value={localAge}
                    onChange={(e) => {
                      setLocalAge(e.target.value)
                      if (ageError) setAgeError(null)
                    }}
                    onBlur={handleSaveAge}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur()
                      }
                    }}
                    inputMode="numeric"
                    className={css({
                      width: '100%',
                      maxWidth: '200px',
                      padding: '0.6rem 0.85rem',
                      fontSize: '0.95rem',
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: ageError
                        ? isDark
                          ? 'red.400'
                          : 'red.500'
                        : isDark
                          ? 'gray.600'
                          : 'gray.300',
                      backgroundColor: isDark ? 'gray.700' : 'white',
                      color: isDark ? 'gray.100' : 'gray.800',
                    })}
                  />
                  <p
                    className={css({
                      marginTop: '0.4rem',
                      fontSize: '0.75rem',
                      color: ageError ? (isDark ? 'red.300' : 'red.600') : isDark ? 'gray.400' : 'gray.500',
                    })}
                  >
                    {ageError ?? 'Used to recommend the right communication style.'}
                  </p>
                </div>

                <div>
                  <label
                    className={css({
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      color: isDark ? 'gray.300' : 'gray.600',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    })}
                  >
                    Color
                  </label>
                  <div
                    className={css({
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    })}
                  >
                    {AVAILABLE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleSelectColor(color)}
                        className={css({
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          border: '3px solid',
                          borderColor: color === player.color ? 'blue.500' : 'transparent',
                          cursor: 'pointer',
                          transition: 'transform 0.15s ease',
                          _hover: { transform: 'scale(1.05)' },
                        })}
                        style={{ backgroundColor: color }}
                        aria-label={`Set color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            data-section="player-settings"
            className={css({
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: 'md',
            })}
          >
            <SettingsTab
              studentId={player.id}
              studentName={player.name}
              studentAge={player.age}
              isDark={isDark}
              onManageSkills={() => {
                setShowManualSkillModal(true)
              }}
            />
          </section>

          <ManualSkillSelector
            studentName={player.name}
            playerId={player.id}
            open={showManualSkillModal}
            onClose={() => setShowManualSkillModal(false)}
            onSave={handleSaveManualSkills}
            currentMasteredSkills={masteredSkillIds}
            skillMasteryData={skillMasteryData}
          />
        </div>
      </main>
    </PageWithNav>
  )
}
