/**
 * Network Cursors Component
 *
 * Renders other players' cursors in multiplayer games.
 * Shows crosshair with player color and emoji badge.
 *
 * Features:
 * - Converts SVG coordinates to screen coordinates
 * - Handles letterboxing from preserveAspectRatio
 * - Groups players by session in cooperative mode
 * - Hides own cursor and respects turn-based visibility
 */

"use client";

import type { RefObject } from "react";
import { getRenderedViewport } from "../labels";

// ============================================================================
// Types
// ============================================================================

interface CursorPosition {
  x: number;
  y: number;
  playerId: string;
}

interface Player {
  id: string;
  emoji: string;
  color: string;
}

interface ParsedViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NetworkCursorsProps {
  /** Ref to SVG element */
  svgRef: RefObject<SVGSVGElement>;
  /** Ref to container element */
  containerRef: RefObject<HTMLDivElement>;
  /** Parsed viewBox dimensions */
  parsedViewBox: ParsedViewBox;
  /** Other players' cursor positions keyed by user ID */
  otherPlayerCursors: Record<string, CursorPosition | null>;
  /** Current viewer's ID (to exclude own cursor) */
  viewerId?: string | null;
  /** Current game mode */
  gameMode?: "cooperative" | "race" | "turn-based";
  /** Current active player (for turn-based) */
  currentPlayer?: string | null;
  /** Local player ID */
  localPlayerId?: string;
  /** Player metadata keyed by player ID */
  playerMetadata: Record<string, Player>;
  /** Member players keyed by user ID (arrays for cooperative) */
  memberPlayers: Record<string, Player[]>;
}

// ============================================================================
// Component
// ============================================================================

export function NetworkCursors({
  svgRef,
  containerRef,
  parsedViewBox,
  otherPlayerCursors,
  viewerId,
  gameMode,
  currentPlayer,
  localPlayerId,
  playerMetadata,
  memberPlayers,
}: NetworkCursorsProps) {
  // Need both refs to render
  if (!svgRef.current || !containerRef.current) {
    return null;
  }

  return (
    <>
      {Object.entries(otherPlayerCursors).map(([cursorUserId, position]) => {
        // Skip our own cursor (by viewerId) and null positions
        if (cursorUserId === viewerId || !position) return null;

        // In turn-based mode, only show other cursors when it's not our turn
        if (gameMode === "turn-based" && currentPlayer === localPlayerId)
          return null;

        // Get player metadata for emoji and color (playerId is in position data)
        // First check playerMetadata, then fall back to memberPlayers (for remote players)
        let player = playerMetadata[position.playerId];
        if (!player) {
          // Player not in local playerMetadata - look through memberPlayers
          // memberPlayers is keyed by userId and contains arrays of players
          for (const players of Object.values(memberPlayers)) {
            const found = players.find((p) => p.id === position.playerId);
            if (found) {
              player = found;
              break;
            }
          }
        }
        if (!player) {
          return null;
        }

        // In collaborative mode, find all players from the same session and show all their emojis
        // Use memberPlayers (from roomData) which is the canonical source of player ownership
        const sessionPlayers =
          gameMode === "cooperative" &&
          cursorUserId &&
          memberPlayers[cursorUserId]
            ? memberPlayers[cursorUserId]
            : [player];

        // Convert SVG coordinates to screen coordinates (accounting for preserveAspectRatio letterboxing)
        const svgRect = svgRef.current!.getBoundingClientRect();
        const containerRect = containerRef.current!.getBoundingClientRect();
        const {
          x: viewBoxX,
          y: viewBoxY,
          width: viewBoxW,
          height: viewBoxH,
        } = parsedViewBox;
        const viewport = getRenderedViewport(
          svgRect,
          viewBoxX,
          viewBoxY,
          viewBoxW,
          viewBoxH,
        );
        const svgOffsetX =
          svgRect.left - containerRect.left + viewport.letterboxX;
        const svgOffsetY =
          svgRect.top - containerRect.top + viewport.letterboxY;
        const screenX = (position.x - viewBoxX) * viewport.scale + svgOffsetX;
        const screenY = (position.y - viewBoxY) * viewport.scale + svgOffsetY;

        // Check if cursor is within rendered viewport bounds
        if (
          screenX < svgOffsetX ||
          screenX > svgOffsetX + viewport.renderedWidth ||
          screenY < svgOffsetY ||
          screenY > svgOffsetY + viewport.renderedHeight
        ) {
          return null;
        }

        return (
          <div
            key={`cursor-${cursorUserId}`}
            data-element="other-player-cursor"
            data-player-id={position.playerId}
            data-user-id={cursorUserId}
            style={{
              position: "absolute",
              left: screenX,
              top: screenY,
              pointerEvents: "none",
              zIndex: 100,
            }}
          >
            {/* Crosshair - centered on the cursor position */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              style={{
                position: "absolute",
                left: -12, // Half of width to center
                top: -12, // Half of height to center
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
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

            {/* Emoji badge - positioned below the crosshair */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 14, // Below the crosshair (12px half-height + 2px gap)
                transform: "translateX(-50%)",
                fontSize: "16px",
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                whiteSpace: "nowrap",
              }}
            >
              {sessionPlayers.map((p) => p.emoji).join("")}
            </div>
          </div>
        );
      })}
    </>
  );
}
