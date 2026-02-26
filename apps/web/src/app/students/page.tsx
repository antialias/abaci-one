'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import type { Player } from '@/db/schema/players'
import {
  useCreatePlayer,
  useDeletePlayer,
  useUpdatePlayer,
  useUserPlayers,
} from '@/hooks/useUserPlayers'
import { css } from '../../../styled-system/css'

// Available emojis for student selection
const AVAILABLE_EMOJIS = ['🦊', '🐸', '🐻', '🐼', '🐨', '🦁', '🐯', '🐮', '🐷', '🐵', '🦄', '🐝']

// Available colors for student avatars
const AVAILABLE_COLORS = [
  '#FFB3BA', // light pink
  '#FFDFBA', // light orange
  '#FFFFBA', // light yellow
  '#BAFFC9', // light green
  '#BAE1FF', // light blue
  '#DCC6E0', // light purple
  '#F0E68C', // khaki
  '#98D8C8', // mint
  '#F7DC6F', // gold
  '#BB8FCE', // orchid
  '#85C1E9', // sky blue
  '#F8B500', // amber
]

type ViewMode = 'list' | 'create' | 'edit'

interface EditingStudent {
  id: string
  name: string
  emoji: string
  color: string
}

/**
 * Players management page
 * Allows creating, editing, and deleting players
 */
export default function StudentsPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingStudent, setEditingStudent] = useState<EditingStudent | null>(null)

  // Form state for new/editing student
  const [formName, setFormName] = useState('')
  const [formEmoji, setFormEmoji] = useState(AVAILABLE_EMOJIS[0])
  const [formColor, setFormColor] = useState(AVAILABLE_COLORS[0])

  // React Query hooks
  const { data: players = [], isLoading } = useUserPlayers()
  const createPlayer = useCreatePlayer()
  const updatePlayer = useUpdatePlayer()
  const deletePlayer = useDeletePlayer()

  // Start creating a new student
  const handleStartCreate = useCallback(() => {
    setFormName('')
    setFormEmoji(AVAILABLE_EMOJIS[Math.floor(Math.random() * AVAILABLE_EMOJIS.length)])
    setFormColor(AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)])
    setEditingStudent(null)
    setViewMode('create')
  }, [])

  // Start editing an existing student
  const handleStartEdit = useCallback((player: Player) => {
    setFormName(player.name)
    setFormEmoji(player.emoji)
    setFormColor(player.color)
    setEditingStudent({
      id: player.id,
      name: player.name,
      emoji: player.emoji,
      color: player.color,
    })
    setViewMode('edit')
  }, [])

  // Cancel form and return to list
  const handleCancel = useCallback(() => {
    setFormName('')
    setEditingStudent(null)
    setViewMode('list')
  }, [])

  // Submit form (create or update)
  const handleSubmit = useCallback(() => {
    if (!formName.trim()) return

    if (viewMode === 'create') {
      createPlayer.mutate(
        {
          name: formName.trim(),
          emoji: formEmoji,
          color: formColor,
        },
        {
          onSuccess: () => {
            setViewMode('list')
            setFormName('')
          },
        }
      )
    } else if (viewMode === 'edit' && editingStudent) {
      updatePlayer.mutate(
        {
          id: editingStudent.id,
          updates: {
            name: formName.trim(),
            emoji: formEmoji,
            color: formColor,
          },
        },
        {
          onSuccess: () => {
            setViewMode('list')
            setEditingStudent(null)
            setFormName('')
          },
        }
      )
    }
  }, [viewMode, formName, formEmoji, formColor, editingStudent, createPlayer, updatePlayer])

  // Delete a student
  const handleDelete = useCallback(
    (id: string) => {
      if (!window.confirm('Are you sure you want to delete this player? This cannot be undone.')) {
        return
      }
      deletePlayer.mutate(id, {
        onSuccess: () => {
          if (editingStudent?.id === id) {
            setViewMode('list')
            setEditingStudent(null)
          }
        },
      })
    },
    [deletePlayer, editingStudent]
  )

  // Navigate to practice
  const handleNavigateToPractice = useCallback(() => {
    window.location.href = '/practice'
  }, [])

  const isPending = createPlayer.isPending || updatePlayer.isPending || deletePlayer.isPending

  return (
    <PageWithNav>
      <main
        data-component="students-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          paddingTop: '2rem',
          paddingLeft: '2rem',
          paddingRight: '2rem',
          paddingBottom: '2rem',
        })}
      >
        <div
          className={css({
            maxWidth: '800px',
            margin: '0 auto',
          })}
        >
          {/* Header */}
          <header
            className={css({
              textAlign: 'center',
              marginBottom: '2rem',
            })}
          >
            <h1
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
                marginBottom: '0.5rem',
              })}
            >
              Manage Players
            </h1>
            <p
              className={css({
                fontSize: '1rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Add, edit, or remove players across practice, Euclid, and number line
            </p>
          </header>

          {/* List View */}
          {viewMode === 'list' && (
            <div data-section="student-list">
              {isLoading ? (
                <div
                  className={css({
                    textAlign: 'center',
                    padding: '3rem',
                    color: 'gray.500',
                  })}
                >
                  Loading players...
                </div>
              ) : players.length === 0 ? (
                <div
                  data-element="empty-state"
                  className={css({
                    textAlign: 'center',
                    padding: '3rem',
                    backgroundColor: isDark ? 'gray.800' : 'white',
                    borderRadius: '16px',
                    boxShadow: 'md',
                  })}
                >
                  <div
                    className={css({
                      fontSize: '3rem',
                      marginBottom: '1rem',
                    })}
                  >
                    👋
                  </div>
                  <h2
                    className={css({
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color: isDark ? 'gray.100' : 'gray.800',
                      marginBottom: '0.5rem',
                    })}
                  >
                    No players yet
                  </h2>
                  <p
                    className={css({
                      color: isDark ? 'gray.400' : 'gray.600',
                      marginBottom: '1.5rem',
                    })}
                  >
                    Add your first player to get started across the app.
                  </p>
                  <button
                    type="button"
                    data-action="add-first-student"
                    onClick={handleStartCreate}
                    className={css({
                      padding: '0.75rem 2rem',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      color: 'white',
                      backgroundColor: 'green.500',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      _hover: { backgroundColor: 'green.600' },
                    })}
                  >
                    Add Player
                  </button>
                </div>
              ) : (
                <>
                  {/* Player cards */}
                  <div
                    className={css({
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1.5rem',
                    })}
                  >
                    {players.map((player) => (
                      <div
                        key={player.id}
                        data-element="student-card"
                        data-student-id={player.id}
                        className={css({
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '1.5rem',
                          backgroundColor: isDark ? 'gray.800' : 'white',
                          borderRadius: '12px',
                          boxShadow: 'sm',
                          transition: 'all 0.2s',
                          _hover: {
                            boxShadow: 'md',
                            transform: 'translateY(-2px)',
                          },
                        })}
                      >
                        {/* Avatar */}
                        <div
                          className={css({
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem',
                          })}
                          style={{ backgroundColor: player.color }}
                        >
                          {player.emoji}
                        </div>

                        {/* Name */}
                        <h3
                          className={css({
                            fontSize: '1.125rem',
                            fontWeight: 'bold',
                            color: isDark ? 'gray.100' : 'gray.800',
                            textAlign: 'center',
                          })}
                        >
                          {player.name}
                        </h3>

                        {/* Actions */}
                        <div
                          className={css({
                            display: 'flex',
                            gap: '0.5rem',
                            flexWrap: 'wrap',
                          })}
                        >
                          <Link
                            href={`/players/${player.id}/settings`}
                            data-action="open-settings"
                            className={css({
                              padding: '0.5rem 1rem',
                              fontSize: '0.875rem',
                              color: isDark ? 'emerald.200' : 'emerald.700',
                              backgroundColor: isDark ? 'emerald.900/40' : 'emerald.50',
                              borderRadius: '6px',
                              border: 'none',
                              cursor: 'pointer',
                              textDecoration: 'none',
                              _hover: {
                                backgroundColor: isDark ? 'emerald.900/60' : 'emerald.100',
                              },
                            })}
                          >
                            Settings
                          </Link>
                          <button
                            type="button"
                            data-action="edit-student"
                            onClick={() => handleStartEdit(player)}
                            className={css({
                              padding: '0.5rem 1rem',
                              fontSize: '0.875rem',
                              color: isDark ? 'blue.300' : 'blue.600',
                              backgroundColor: isDark ? 'blue.900/30' : 'blue.50',
                              borderRadius: '6px',
                              border: 'none',
                              cursor: 'pointer',
                              _hover: {
                                backgroundColor: isDark ? 'blue.900/50' : 'blue.100',
                              },
                            })}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            data-action="delete-student"
                            onClick={() => handleDelete(player.id)}
                            disabled={deletePlayer.isPending}
                            className={css({
                              padding: '0.5rem 1rem',
                              fontSize: '0.875rem',
                              color: isDark ? 'red.300' : 'red.600',
                              backgroundColor: isDark ? 'red.900/30' : 'red.50',
                              borderRadius: '6px',
                              border: 'none',
                              cursor: 'pointer',
                              _hover: {
                                backgroundColor: isDark ? 'red.900/50' : 'red.100',
                              },
                              _disabled: {
                                opacity: 0.5,
                                cursor: 'not-allowed',
                              },
                            })}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div
                    className={css({
                      display: 'flex',
                      gap: '1rem',
                      justifyContent: 'center',
                    })}
                  >
                    <button
                      type="button"
                      data-action="add-student"
                      onClick={handleStartCreate}
                      className={css({
                        padding: '0.75rem 2rem',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        color: 'white',
                        backgroundColor: 'green.500',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        _hover: { backgroundColor: 'green.600' },
                      })}
                    >
                      Add Player
                    </button>
                    <button
                      type="button"
                      data-action="go-to-practice"
                      onClick={handleNavigateToPractice}
                      className={css({
                        padding: '0.75rem 2rem',
                        fontSize: '1rem',
                        color: isDark ? 'gray.300' : 'gray.600',
                        backgroundColor: isDark ? 'gray.700' : 'gray.200',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        _hover: {
                          backgroundColor: isDark ? 'gray.600' : 'gray.300',
                        },
                      })}
                    >
                      Go to Practice
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Create/Edit Form */}
          {(viewMode === 'create' || viewMode === 'edit') && (
            <div
              data-section="student-form"
              className={css({
                padding: '2rem',
                backgroundColor: isDark ? 'gray.800' : 'white',
                borderRadius: '16px',
                boxShadow: 'md',
              })}
            >
              <h2
                className={css({
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: isDark ? 'gray.100' : 'gray.800',
                  marginBottom: '1.5rem',
                  textAlign: 'center',
                })}
              >
                {viewMode === 'create' ? 'Add New Player' : 'Edit Player'}
              </h2>

              {/* Preview */}
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '1.5rem',
                })}
              >
                <div
                  data-element="avatar-preview"
                  className={css({
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.5rem',
                    boxShadow: 'md',
                  })}
                  style={{ backgroundColor: formColor }}
                >
                  {formEmoji}
                </div>
              </div>

              {/* Name input */}
              <div className={css({ marginBottom: '1.5rem' })}>
                <label
                  htmlFor="student-name"
                  className={css({
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    color: isDark ? 'gray.300' : 'gray.700',
                    marginBottom: '0.5rem',
                  })}
                >
                  Player Name
                </label>
                <input
                  id="student-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter player name"
                  className={css({
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.300',
                    backgroundColor: isDark ? 'gray.700' : 'white',
                    color: isDark ? 'gray.100' : 'gray.800',
                    _focus: {
                      outline: 'none',
                      borderColor: 'blue.500',
                      boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.3)',
                    },
                  })}
                />
              </div>

              {/* Emoji selector */}
              <div className={css({ marginBottom: '1.5rem' })}>
                <label
                  className={css({
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    color: isDark ? 'gray.300' : 'gray.700',
                    marginBottom: '0.5rem',
                  })}
                >
                  Avatar
                </label>
                <div
                  className={css({
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  })}
                >
                  {AVAILABLE_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormEmoji(emoji)}
                      className={css({
                        width: '48px',
                        height: '48px',
                        fontSize: '1.5rem',
                        borderRadius: '8px',
                        border: '2px solid',
                        borderColor: formEmoji === emoji ? 'blue.500' : 'transparent',
                        backgroundColor: isDark ? 'gray.700' : 'gray.100',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        _hover: {
                          backgroundColor: isDark ? 'gray.600' : 'gray.200',
                        },
                      })}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color selector */}
              <div className={css({ marginBottom: '2rem' })}>
                <label
                  className={css({
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    color: isDark ? 'gray.300' : 'gray.700',
                    marginBottom: '0.5rem',
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
                      onClick={() => setFormColor(color)}
                      className={css({
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: '3px solid',
                        borderColor: formColor === color ? 'blue.500' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        _hover: {
                          transform: 'scale(1.1)',
                        },
                      })}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Form actions */}
              <div
                className={css({
                  display: 'flex',
                  gap: '0.75rem',
                })}
              >
                <button
                  type="button"
                  data-action="cancel"
                  onClick={handleCancel}
                  disabled={isPending}
                  className={css({
                    flex: 1,
                    padding: '0.75rem',
                    fontSize: '1rem',
                    color: isDark ? 'gray.300' : 'gray.600',
                    backgroundColor: isDark ? 'gray.700' : 'gray.200',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    _hover: {
                      backgroundColor: isDark ? 'gray.600' : 'gray.300',
                    },
                    _disabled: {
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    },
                  })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-action="save"
                  onClick={handleSubmit}
                  disabled={isPending || !formName.trim()}
                  className={css({
                    flex: 2,
                    padding: '0.75rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: isPending ? 'gray.400' : 'green.500',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    _hover: {
                      backgroundColor: isPending ? 'gray.400' : 'green.600',
                    },
                    _disabled: {
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    },
                  })}
                >
                  {isPending ? 'Saving...' : viewMode === 'create' ? 'Add Player' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </PageWithNav>
  )
}
