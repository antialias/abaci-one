'use client'

import Link from 'next/link'
import { useMemo, type ReactNode } from 'react'
import { css } from '../../../styled-system/css'

export interface TrainingImageMeta {
  filename: string
  digit: number
  timestamp: number
  playerId: string
  sessionId: string
  columnIndex: number
  imageUrl: string
}

export type GroupBy = 'digit' | 'player' | 'session' | 'none'

export interface TrainingImageViewerProps {
  /** Images to display */
  images: TrainingImageMeta[]
  /** Loading state */
  loading?: boolean
  /** Error message if any */
  error?: string | null
  /** Current filter for digit */
  filterDigit?: string
  /** Current filter for player */
  filterPlayer?: string
  /** Current filter for session */
  filterSession?: string
  /** How to group images */
  groupBy?: GroupBy
  /** Callback when digit filter changes */
  onFilterDigitChange?: (value: string) => void
  /** Callback when player filter changes */
  onFilterPlayerChange?: (value: string) => void
  /** Callback when session filter changes */
  onFilterSessionChange?: (value: string) => void
  /** Callback when group by changes */
  onGroupByChange?: (value: GroupBy) => void
  /** Callback when refresh is clicked */
  onRefresh?: () => void
  /** Custom renderer for each image (for stories with AbacusStatic) */
  renderImage?: (image: TrainingImageMeta) => ReactNode
}

/**
 * TrainingImageViewer - Displays collected abacus column training images
 *
 * This is the presentational component for the /vision-training page.
 * It can be used with real API data or mock data in Storybook.
 */
export function TrainingImageViewer({
  images,
  loading = false,
  error = null,
  filterDigit = '',
  filterPlayer = '',
  filterSession = '',
  groupBy = 'digit',
  onFilterDigitChange,
  onFilterPlayerChange,
  onFilterSessionChange,
  onGroupByChange,
  onRefresh,
  renderImage,
}: TrainingImageViewerProps) {
  // Get unique values for filter dropdowns
  const uniquePlayers = useMemo(() => [...new Set(images.map((i) => i.playerId))].sort(), [images])
  const uniqueSessions = useMemo(
    () => [...new Set(images.map((i) => i.sessionId))].sort(),
    [images]
  )

  // Group images
  const groupedImages = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Images': images }
    }

    const groups: Record<string, TrainingImageMeta[]> = {}

    for (const img of images) {
      let key: string
      switch (groupBy) {
        case 'digit':
          key = `Digit ${img.digit}`
          break
        case 'player':
          key = `Player ${img.playerId}`
          break
        case 'session':
          key = `Session ${img.sessionId}`
          break
        default:
          key = 'All'
      }

      if (!groups[key]) groups[key] = []
      groups[key].push(img)
    }

    return groups
  }, [images, groupBy])

  // Stats
  const stats = useMemo(() => {
    const digitCounts: Record<number, number> = {}
    for (const img of images) {
      digitCounts[img.digit] = (digitCounts[img.digit] || 0) + 1
    }
    return {
      total: images.length,
      players: uniquePlayers.length,
      sessions: uniqueSessions.length,
      digitCounts,
    }
  }, [images, uniquePlayers, uniqueSessions])

  return (
    <div
      data-component="training-image-viewer"
      className={css({
        minHeight: '100vh',
        bg: 'gray.900',
        color: 'gray.100',
        p: 4,
      })}
    >
      <header className={css({ mb: 6 })}>
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
          })}
        >
          <div>
            <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 2 })}>
              Vision Training Data
            </h1>
            <p className={css({ color: 'gray.400', fontSize: 'sm' })}>
              Collected abacus column images for training the classifier model
            </p>
          </div>
          <Link
            href="/vision-training/train"
            className={css({
              px: 4,
              py: 2,
              bg: 'green.600',
              color: 'white',
              fontWeight: 'semibold',
              borderRadius: 'md',
              textDecoration: 'none',
              _hover: { bg: 'green.700' },
            })}
          >
            Train Model
          </Link>
        </div>
      </header>

      {/* Stats bar */}
      <div
        data-element="stats"
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          mb: 6,
          p: 4,
          bg: 'gray.800',
          borderRadius: 'lg',
        })}
      >
        <div>
          <div className={css({ fontSize: 'xs', color: 'gray.500', textTransform: 'uppercase' })}>
            Total Images
          </div>
          <div className={css({ fontSize: '2xl', fontWeight: 'bold' })}>{stats.total}</div>
        </div>
        <div>
          <div className={css({ fontSize: 'xs', color: 'gray.500', textTransform: 'uppercase' })}>
            Players
          </div>
          <div className={css({ fontSize: '2xl', fontWeight: 'bold' })}>{stats.players}</div>
        </div>
        <div>
          <div className={css({ fontSize: 'xs', color: 'gray.500', textTransform: 'uppercase' })}>
            Sessions
          </div>
          <div className={css({ fontSize: '2xl', fontWeight: 'bold' })}>{stats.sessions}</div>
        </div>
        <div className={css({ flex: 1, minWidth: '200px' })}>
          <div
            className={css({
              fontSize: 'xs',
              color: 'gray.500',
              textTransform: 'uppercase',
              mb: 1,
            })}
          >
            By Digit
          </div>
          <div className={css({ display: 'flex', gap: 2, flexWrap: 'wrap' })}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <div
                key={d}
                className={css({
                  px: 2,
                  py: 1,
                  bg: 'gray.700',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  fontFamily: 'mono',
                })}
              >
                {d}: {stats.digitCounts[d] || 0}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        data-element="filters"
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          mb: 6,
          p: 4,
          bg: 'gray.800',
          borderRadius: 'lg',
        })}
      >
        <div>
          <label className={css({ display: 'block', fontSize: 'xs', color: 'gray.500', mb: 1 })}>
            Digit
          </label>
          <select
            value={filterDigit}
            onChange={(e) => onFilterDigitChange?.(e.target.value)}
            className={css({
              px: 3,
              py: 2,
              bg: 'gray.700',
              border: '1px solid',
              borderColor: 'gray.600',
              borderRadius: 'md',
              color: 'gray.100',
              minWidth: '120px',
            })}
          >
            <option value="">All digits</option>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={css({ display: 'block', fontSize: 'xs', color: 'gray.500', mb: 1 })}>
            Player
          </label>
          <select
            value={filterPlayer}
            onChange={(e) => onFilterPlayerChange?.(e.target.value)}
            className={css({
              px: 3,
              py: 2,
              bg: 'gray.700',
              border: '1px solid',
              borderColor: 'gray.600',
              borderRadius: 'md',
              color: 'gray.100',
              minWidth: '120px',
            })}
          >
            <option value="">All players</option>
            {uniquePlayers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={css({ display: 'block', fontSize: 'xs', color: 'gray.500', mb: 1 })}>
            Session
          </label>
          <select
            value={filterSession}
            onChange={(e) => onFilterSessionChange?.(e.target.value)}
            className={css({
              px: 3,
              py: 2,
              bg: 'gray.700',
              border: '1px solid',
              borderColor: 'gray.600',
              borderRadius: 'md',
              color: 'gray.100',
              minWidth: '120px',
            })}
          >
            <option value="">All sessions</option>
            {uniqueSessions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={css({ display: 'block', fontSize: 'xs', color: 'gray.500', mb: 1 })}>
            Group by
          </label>
          <select
            value={groupBy}
            onChange={(e) => onGroupByChange?.(e.target.value as GroupBy)}
            className={css({
              px: 3,
              py: 2,
              bg: 'gray.700',
              border: '1px solid',
              borderColor: 'gray.600',
              borderRadius: 'md',
              color: 'gray.100',
              minWidth: '120px',
            })}
          >
            <option value="digit">Digit</option>
            <option value="player">Player</option>
            <option value="session">Session</option>
            <option value="none">No grouping</option>
          </select>
        </div>

        {onRefresh && (
          <div className={css({ display: 'flex', alignItems: 'flex-end' })}>
            <button
              type="button"
              onClick={onRefresh}
              className={css({
                px: 4,
                py: 2,
                bg: 'blue.600',
                color: 'white',
                borderRadius: 'md',
                border: 'none',
                cursor: 'pointer',
                _hover: { bg: 'blue.700' },
              })}
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Loading / Error states */}
      {loading && (
        <div className={css({ textAlign: 'center', py: 8, color: 'gray.500' })}>Loading...</div>
      )}

      {error && (
        <div
          className={css({
            p: 4,
            bg: 'red.900/50',
            border: '1px solid',
            borderColor: 'red.700',
            borderRadius: 'lg',
            color: 'red.200',
            mb: 4,
          })}
        >
          {error}
        </div>
      )}

      {/* Image groups */}
      {!loading && !error && (
        <div
          data-element="image-groups"
          className={css({ display: 'flex', flexDirection: 'column', gap: 6 })}
        >
          {Object.entries(groupedImages).map(([groupName, groupImages]) => (
            <div key={groupName} data-group={groupName}>
              <h2
                className={css({
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  mb: 3,
                  pb: 2,
                  borderBottom: '1px solid',
                  borderColor: 'gray.700',
                })}
              >
                {groupName}{' '}
                <span className={css({ color: 'gray.500', fontWeight: 'normal' })}>
                  ({groupImages.length})
                </span>
              </h2>

              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: 3,
                })}
              >
                {groupImages.map((img) => (
                  <div
                    key={img.filename}
                    data-image={img.filename}
                    className={css({
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      p: 2,
                      bg: 'gray.800',
                      borderRadius: 'lg',
                      transition: 'all 0.15s',
                      _hover: {
                        bg: 'gray.700',
                        transform: 'scale(1.05)',
                      },
                    })}
                  >
                    {renderImage ? (
                      renderImage(img)
                    ) : (
                      /* biome-ignore lint/performance/noImgElement: Training images from API, not suitable for next/image optimization */
                      <img
                        src={img.imageUrl}
                        alt={`Digit ${img.digit}`}
                        className={css({
                          width: '64px',
                          height: '128px',
                          objectFit: 'contain',
                          bg: 'black',
                          borderRadius: 'md',
                          mb: 1,
                        })}
                      />
                    )}
                    <div
                      className={css({
                        fontSize: 'xl',
                        fontWeight: 'bold',
                        fontFamily: 'mono',
                      })}
                    >
                      {img.digit}
                    </div>
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: 'gray.500',
                        textAlign: 'center',
                      })}
                    >
                      col {img.columnIndex}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(groupedImages).length === 0 && (
            <div className={css({ textAlign: 'center', py: 8, color: 'gray.500' })}>
              No images collected yet. Enable vision mode and answer some problems correctly!
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TrainingImageViewer
