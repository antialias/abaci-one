'use client'

import dynamic from 'next/dynamic'
import type React from 'react'
import { useContext } from 'react'
import { AppNavBar } from './AppNavBar'
import type { RosterWarning } from './nav/GameContextNav'
import type { PlayerBadge } from './nav/types'
import { PreviewModeContext } from '@/contexts/PreviewModeContext'

// Lazy load GameContextNav - it pulls in game mode hooks and arcade room components
// Only loaded when navTitle is provided (arcade games, not practice pages)
const GameContextNav = dynamic(() => import('./nav/GameContextNav').then((m) => m.GameContextNav), {
  ssr: false,
})

// Lazy load dialogs and notifications - these are rarely visible initially
const PlayerConfigDialog = dynamic(
  () => import('./nav/PlayerConfigDialog').then((m) => m.PlayerConfigDialog),
  { ssr: false }
)
const ModerationNotifications = dynamic(
  () => import('./nav/ModerationNotifications').then((m) => m.ModerationNotifications),
  { ssr: false }
)

// Lazy load the game nav content component - this contains the hooks
// that pull in GameModeContext and useRoomData (100KB+ of arcade dependencies)
const GameNavContent = dynamic(() => import('./nav/GameNavContent').then((m) => m.GameNavContent), {
  ssr: false,
})

interface PageWithNavProps {
  navTitle?: string
  navEmoji?: string
  gameName?: 'matching' | 'memory-quiz' | 'complement-race' // Internal game name for API
  emphasizePlayerSelection?: boolean
  disableFullscreenSelection?: boolean // Disable "Select Your Champions" overlay
  onExitSession?: () => void
  onSetup?: () => void
  onNewGame?: () => void
  children: React.ReactNode
  // Game state for turn indicator
  currentPlayerId?: string
  playerScores?: Record<string, number>
  playerStreaks?: Record<string, number>
  playerBadges?: Record<string, PlayerBadge>
  // Game-specific roster warnings
  rosterWarning?: RosterWarning
  // Side assignments (for 2-player games like Rithmomachia)
  whitePlayerId?: string | null
  blackPlayerId?: string | null
  onAssignWhitePlayer?: (playerId: string | null) => void
  onAssignBlackPlayer?: (playerId: string | null) => void
  // Game phase (for showing spectating vs assign)
  gamePhase?: 'setup' | 'playing' | 'results'
  // Custom mode display (overrides player-count-based mode)
  customModeLabel?: string
  customModeEmoji?: string
  customModeColor?: string
}

/**
 * PageWithNav - Lightweight wrapper that conditionally loads game features
 *
 * For non-game pages (no navTitle): renders just AppNavBar + children
 * For game pages (with navTitle): lazy-loads GameNavContent which contains
 * the hooks for GameModeContext, useRoomData, etc.
 *
 * This reduces the practice session report page bundle by ~100KB by not
 * loading arcade game dependencies on non-game pages.
 */
export function PageWithNav({
  navTitle,
  navEmoji,
  gameName,
  emphasizePlayerSelection = false,
  disableFullscreenSelection = false,
  onExitSession,
  onSetup,
  onNewGame,
  children,
  currentPlayerId,
  playerScores,
  playerStreaks,
  playerBadges,
  rosterWarning,
  whitePlayerId,
  blackPlayerId,
  onAssignWhitePlayer,
  onAssignBlackPlayer,
  gamePhase,
  customModeLabel,
  customModeEmoji,
  customModeColor,
}: PageWithNavProps) {
  // In preview mode, render just the children without navigation
  const previewMode = useContext(PreviewModeContext)
  if (previewMode?.isPreview) {
    return <>{children}</>
  }

  // For game pages (with navTitle), render the full GameNavContent
  // which includes all game-related hooks and components
  if (navTitle) {
    return (
      <GameNavContent
        navTitle={navTitle}
        navEmoji={navEmoji}
        gameName={gameName}
        emphasizePlayerSelection={emphasizePlayerSelection}
        disableFullscreenSelection={disableFullscreenSelection}
        onExitSession={onExitSession}
        onSetup={onSetup}
        onNewGame={onNewGame}
        currentPlayerId={currentPlayerId}
        playerScores={playerScores}
        playerStreaks={playerStreaks}
        playerBadges={playerBadges}
        rosterWarning={rosterWarning}
        whitePlayerId={whitePlayerId}
        blackPlayerId={blackPlayerId}
        onAssignWhitePlayer={onAssignWhitePlayer}
        onAssignBlackPlayer={onAssignBlackPlayer}
        gamePhase={gamePhase}
        customModeLabel={customModeLabel}
        customModeEmoji={customModeEmoji}
        customModeColor={customModeColor}
      >
        {children}
      </GameNavContent>
    )
  }

  // For non-game pages, render just the AppNavBar without game features
  // This avoids loading GameModeContext, useRoomData, etc.
  return (
    <>
      <AppNavBar navSlot={null} />
      {children}
    </>
  )
}
