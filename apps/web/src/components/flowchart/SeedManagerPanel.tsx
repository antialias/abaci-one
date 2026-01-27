'use client'

import { useState, useEffect, useCallback } from 'react'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'

interface SeedStatus {
  id: string
  title: string
  emoji: string
  difficulty: string
  description: string
  isSeeded: boolean
  databaseId?: string
  seededAt?: string
  seededByUserId?: string
}

interface SeedManagerPanelProps {
  onSeedComplete?: () => void
}

/**
 * Debug panel for managing flowchart seeds.
 * Only shown when visual debug is enabled.
 */
export function SeedManagerPanel({ onSeedComplete }: SeedManagerPanelProps) {
  const [seeds, setSeeds] = useState<SeedStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Fetch seed status
  const fetchSeeds = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/flowcharts/seeds')
      if (!response.ok) {
        throw new Error('Failed to fetch seeds')
      }
      const data = await response.json()
      setSeeds(data.seeds || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch seeds')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSeeds()
  }, [fetchSeeds])

  // Seed a single flowchart
  const handleSeed = useCallback(
    async (id: string) => {
      try {
        setActionInProgress(id)
        setError(null)
        const response = await fetch('/api/flowcharts/seeds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'seed', id }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to seed')
        }

        await fetchSeeds()
        onSeedComplete?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to seed')
      } finally {
        setActionInProgress(null)
      }
    },
    [fetchSeeds, onSeedComplete]
  )

  // Seed all flowcharts
  const handleSeedAll = useCallback(async () => {
    try {
      setActionInProgress('all')
      setError(null)
      const response = await fetch('/api/flowcharts/seeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed-all' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to seed all')
      }

      await fetchSeeds()
      onSeedComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed all')
    } finally {
      setActionInProgress(null)
    }
  }, [fetchSeeds, onSeedComplete])

  // Reset a seed to original
  const handleReset = useCallback(
    async (id: string) => {
      try {
        setActionInProgress(id)
        setError(null)
        const response = await fetch('/api/flowcharts/seeds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset', id }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to reset')
        }

        await fetchSeeds()
        onSeedComplete?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reset')
      } finally {
        setActionInProgress(null)
      }
    },
    [fetchSeeds, onSeedComplete]
  )

  const unseededCount = seeds.filter((s) => !s.isSeeded).length

  if (isLoading) {
    return (
      <div
        className={css({
          width: '100%',
          maxWidth: '800px',
          padding: '4',
          borderRadius: 'lg',
          backgroundColor: { base: 'amber.50', _dark: 'amber.950' },
          border: '2px dashed',
          borderColor: { base: 'amber.300', _dark: 'amber.700' },
        })}
      >
        <div className={css({ color: { base: 'amber.700', _dark: 'amber.300' } })}>
          Loading seeds...
        </div>
      </div>
    )
  }

  return (
    <div
      data-component="SeedManagerPanel"
      className={css({
        width: '100%',
        maxWidth: '800px',
        padding: '4',
        borderRadius: 'lg',
        backgroundColor: { base: 'amber.50', _dark: 'amber.950' },
        border: '2px dashed',
        borderColor: { base: 'amber.300', _dark: 'amber.700' },
      })}
    >
      {/* Header */}
      <div className={hstack({ justify: 'space-between', marginBottom: isCollapsed ? '0' : '3' })}>
        <button
          onClick={() => setIsCollapsed((c) => !c)}
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
          })}
        >
          <span
            className={css({
              display: 'inline-block',
              transition: 'transform 0.15s',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              color: { base: 'amber.600', _dark: 'amber.400' },
              fontSize: 'sm',
            })}
          >
            &#9660;
          </span>
          <span>🌱</span>
          <span
            className={css({
              fontWeight: 'semibold',
              color: { base: 'amber.800', _dark: 'amber.200' },
            })}
          >
            Flowchart Seeds
          </span>
          <span
            className={css({
              fontSize: 'sm',
              color: { base: 'amber.600', _dark: 'amber.400' },
            })}
          >
            (Debug Mode)
          </span>
        </button>
        {!isCollapsed && (
          <button
            onClick={handleSeedAll}
            disabled={actionInProgress !== null || unseededCount === 0}
            className={css({
              paddingX: '3',
              paddingY: '1.5',
              borderRadius: 'md',
              fontSize: 'sm',
              fontWeight: 'medium',
              backgroundColor: { base: 'amber.600', _dark: 'amber.500' },
              color: 'white',
              border: 'none',
              cursor: unseededCount === 0 ? 'not-allowed' : 'pointer',
              opacity: unseededCount === 0 ? 0.5 : 1,
              _hover: {
                backgroundColor: unseededCount === 0 ? undefined : { base: 'amber.700', _dark: 'amber.600' },
              },
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
            })}
          >
            {actionInProgress === 'all' ? 'Seeding...' : `Seed All (${unseededCount})`}
          </button>
        )}
      </div>

      {/* Error message */}
      {!isCollapsed && error && (
        <div
          className={css({
            marginBottom: '3',
            padding: '2',
            borderRadius: 'md',
            backgroundColor: { base: 'red.100', _dark: 'red.900' },
            color: { base: 'red.700', _dark: 'red.300' },
            fontSize: 'sm',
          })}
        >
          {error}
        </div>
      )}

      {/* Seed list */}
      {!isCollapsed && <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
        {seeds.map((seed) => (
          <div
            key={seed.id}
            className={hstack({
              justify: 'space-between',
              padding: '2',
              borderRadius: 'md',
              backgroundColor: { base: 'white', _dark: 'gray.800' },
            })}
          >
            <div className={hstack({ gap: '3' })}>
              <span>{seed.emoji}</span>
              <div>
                <div
                  className={css({
                    fontWeight: 'medium',
                    color: { base: 'gray.900', _dark: 'gray.100' },
                  })}
                >
                  {seed.title}
                </div>
                <div
                  className={css({
                    fontSize: 'xs',
                    color: { base: 'gray.500', _dark: 'gray.400' },
                  })}
                >
                  {seed.id}
                </div>
              </div>
            </div>

            <div className={hstack({ gap: '2' })}>
              {/* Status indicator */}
              <div className={hstack({ gap: '1' })}>
                <span
                  className={css({
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: 'full',
                    backgroundColor: seed.isSeeded
                      ? { base: 'green.500', _dark: 'green.400' }
                      : { base: 'gray.300', _dark: 'gray.600' },
                  })}
                />
                <span
                  className={css({
                    fontSize: 'sm',
                    color: { base: 'gray.600', _dark: 'gray.400' },
                  })}
                >
                  {seed.isSeeded ? 'Seeded' : 'Not seeded'}
                </span>
              </div>

              {/* Action buttons */}
              {seed.isSeeded ? (
                <div className={hstack({ gap: '2' })}>
                  <a
                    href={`/flowchart/${seed.id}`}
                    className={css({
                      paddingX: '2',
                      paddingY: '1',
                      borderRadius: 'md',
                      fontSize: 'xs',
                      fontWeight: 'medium',
                      backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
                      color: { base: 'blue.700', _dark: 'blue.300' },
                      textDecoration: 'none',
                      _hover: {
                        backgroundColor: { base: 'blue.200', _dark: 'blue.800' },
                      },
                    })}
                  >
                    Walk
                  </a>
                  <button
                    onClick={() => handleReset(seed.id)}
                    disabled={actionInProgress !== null}
                    title="Delete and re-seed from code (picks up code changes)"
                    className={css({
                      paddingX: '2',
                      paddingY: '1',
                      borderRadius: 'md',
                      fontSize: 'xs',
                      fontWeight: 'medium',
                      backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                      color: { base: 'gray.700', _dark: 'gray.300' },
                      border: 'none',
                      cursor: 'pointer',
                      _hover: {
                        backgroundColor: { base: 'gray.300', _dark: 'gray.600' },
                      },
                      _disabled: {
                        opacity: 0.5,
                        cursor: 'not-allowed',
                      },
                    })}
                  >
                    {actionInProgress === seed.id ? 'Resetting...' : 'Reset'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleSeed(seed.id)}
                  disabled={actionInProgress !== null}
                  className={css({
                    paddingX: '2',
                    paddingY: '1',
                    borderRadius: 'md',
                    fontSize: 'xs',
                    fontWeight: 'medium',
                    backgroundColor: { base: 'amber.500', _dark: 'amber.600' },
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    _hover: {
                      backgroundColor: { base: 'amber.600', _dark: 'amber.700' },
                    },
                    _disabled: {
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    },
                  })}
                >
                  {actionInProgress === seed.id ? 'Seeding...' : 'Seed'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>}

      {/* Help text */}
      {!isCollapsed && <div
        className={css({
          marginTop: '3',
          fontSize: 'xs',
          color: { base: 'amber.600', _dark: 'amber.400' },
          lineHeight: '1.5',
        })}
      >
        <p><strong>Seed:</strong> Copy flowchart from code into database.</p>
        <p><strong>Reset:</strong> Delete and re-seed from code (use after changing seed files).</p>
        <p><strong>Walk:</strong> Open the flowchart walker to test it.</p>
        <p className={css({ marginTop: '2' })}>
          Seeded flowcharts use their seed ID (e.g., <code>sentence-type</code>) and appear in the list below.
        </p>
      </div>}
    </div>
  )
}
