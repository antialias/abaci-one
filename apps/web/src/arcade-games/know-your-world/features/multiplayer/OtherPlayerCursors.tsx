/**
 * OtherPlayerCursors Component
 *
 * Renders cursors for other players in multiplayer mode.
 * Shows crosshairs and player emojis at cursor positions.
 * Uses MapRendererContext for shared refs and viewport info.
 */

'use client'

import { memo } from 'react'
import type { Player } from '@/types/player'
import { useMapRendererContext } from '../map-renderer'
import { getRenderedViewport } from '../labels'

// ============================================================================
// Types
// ============================================================================

export interface CursorPosition {
  x: number
  y: number
  playerId: string
}

export interface OtherPlayerCursorsProps {
  /** Map of user ID to cursor position */
  otherPlayerCursors: Record<string, CursorPosition | null>
  /** Current viewer's user ID (to filter out own cursor) */
  viewerId: string | null
  /** Game mode */
  gameMode: 'cooperative' | 'race' | 'turn-based' | undefined
  /** Current player ID (for turn-based mode) */
  currentPlayer: string | null | undefined
  /** Local player ID */
  localPlayerId: string | null | undefined
  /** Player metadata by player ID */
  playerMetadata: Record<string, Player>
  /** Member players by user ID (for looking up remote players) */
  memberPlayers: Record<string, Player[]>
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders cursors for other players in multiplayer sessions.
 * Shows in cooperative mode (always) and turn-based mode (when not our turn).
 */
export const OtherPlayerCursors = memo(function OtherPlayerCursors({
  otherPlayerCursors,
  viewerId,
  gameMode,
  currentPlayer,
  localPlayerId,
  playerMetadata,
  memberPlayers,
}: OtherPlayerCursorsProps) {
  // Get shared state from context
  const { svgRef, containerRef, parsedViewBox } = useMapRendererContext()

  if (!svgRef.current || !containerRef.current) return null

  return (
    <>
      {Object.entries(otherPlayerCursors).map(([cursorUserId, position]) => {
        // Skip our own cursor (by viewerId) and null positions
        if (cursorUserId === viewerId || !position) return null

        // In turn-based mode, only show other cursors when it's not our turn
        if (gameMode === 'turn-based' && currentPlayer === localPlayerId) return null

        // Get player metadata for emoji and color (playerId is in position data)
        // First check playerMetadata, then fall back to memberPlayers (for remote players)
        let player = playerMetadata[position.playerId]
        if (!player) {
          // Player not in local playerMetadata - look through memberPlayers
          // memberPlayers is keyed by userId and contains arrays of players
          for (const players of Object.values(memberPlayers)) {
            const found = players.find((p) => p.id === position.playerId)
            if (found) {
              player = found
              break
            }
          }
        }
        if (!player) {
          console.log(
            '[CursorShare] ⚠️ No player found in playerMetadata or memberPlayers for playerId:',
            position.playerId
          )
          return null
        }

        // In collaborative mode, find all players from the same session and show all their emojis
        // Use memberPlayers (from roomData) which is the canonical source of player ownership
        const sessionPlayers =
          gameMode === 'cooperative' && cursorUserId && memberPlayers[cursorUserId]
            ? memberPlayers[cursorUserId]
            : [player]

        // Convert SVG coordinates to screen coordinates (accounting for preserveAspectRatio letterboxing)
        const svgRect = svgRef.current!.getBoundingClientRect()
        const containerRect = containerRef.current!.getBoundingClientRect()
        const viewport = getRenderedViewport(
          svgRect,
          parsedViewBox.x,
          parsedViewBox.y,
          parsedViewBox.width,
          parsedViewBox.height
        )
        const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
        const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
        const screenX = (position.x - parsedViewBox.x) * viewport.scale + svgOffsetX
        const screenY = (position.y - parsedViewBox.y) * viewport.scale + svgOffsetY

        // Check if cursor is within rendered viewport bounds
        if (
          screenX < svgOffsetX ||
          screenX > svgOffsetX + viewport.renderedWidth ||
          screenY < svgOffsetY ||
          screenY > svgOffsetY + viewport.renderedHeight
        ) {
          return null
        }

        return (
          <div
            key={`cursor-${cursorUserId}`}
            data-element="other-player-cursor"
            data-player-id={position.playerId}
            data-user-id={cursorUserId}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              pointerEvents: 'none',
              zIndex: 100,
            }}
          >
            {/* Crosshair - centered on the cursor position */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              style={{
                position: 'absolute',
                left: -12, // Half of width to center
                top: -12, // Half of height to center
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
              }}
            >
              {/* Outer ring */}
              <circle
                cx="12"
                cy="12"
                r="8"
                fill="none"
                stroke={player.color}
                strokeWidth="2"
                opacity="0.8"
              />
              {/* Cross lines */}
              <line
                x1="12"
                y1="2"
                x2="12"
                y2="8"
                stroke={player.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="12"
                y1="16"
                x2="12"
                y2="22"
                stroke={player.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="2"
                y1="12"
                x2="8"
                y2="12"
                stroke={player.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="16"
                y1="12"
                x2="22"
                y2="12"
                stroke={player.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Center dot */}
              <circle cx="12" cy="12" r="2" fill={player.color} />
            </svg>
            {/* Player emoji label(s) - positioned below crosshair */}
            {/* In collaborative mode, show all emojis from the same session */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 14, // Below the crosshair (12px half-height + 2px gap)
                transform: 'translateX(-50%)',
                fontSize: '16px',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                whiteSpace: 'nowrap',
              }}
            >
              {sessionPlayers.map((p) => p.emoji).join('')}
            </div>
          </div>
        )
      })}
    </>
  )
})
