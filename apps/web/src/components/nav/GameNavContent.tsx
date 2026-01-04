'use client'

import dynamic from 'next/dynamic'
import React from 'react'
import { useGameMode } from '../../contexts/GameModeContext'
import { useRoomData } from '../../hooks/useRoomData'
import { useViewerId } from '../../hooks/useViewerId'
import { AppNavBar } from '../AppNavBar'
import type { RosterWarning } from './GameContextNav'
import type { PlayerBadge } from './types'

// Lazy load GameContextNav component (but not the hooks - we need those here)
const GameContextNav = dynamic(() => import('./GameContextNav').then((m) => m.GameContextNav), {
  ssr: false,
})

// Lazy load dialogs and notifications - these are rarely visible initially
const PlayerConfigDialog = dynamic(
  () => import('./PlayerConfigDialog').then((m) => m.PlayerConfigDialog),
  { ssr: false }
)
const ModerationNotifications = dynamic(
  () => import('./ModerationNotifications').then((m) => m.ModerationNotifications),
  { ssr: false }
)

interface GameNavContentProps {
  navTitle: string
  navEmoji?: string
  gameName?: 'matching' | 'memory-quiz' | 'complement-race'
  emphasizePlayerSelection?: boolean
  disableFullscreenSelection?: boolean
  onExitSession?: () => void
  onSetup?: () => void
  onNewGame?: () => void
  children: React.ReactNode
  currentPlayerId?: string
  playerScores?: Record<string, number>
  playerStreaks?: Record<string, number>
  playerBadges?: Record<string, PlayerBadge>
  rosterWarning?: RosterWarning
  whitePlayerId?: string | null
  blackPlayerId?: string | null
  onAssignWhitePlayer?: (playerId: string | null) => void
  onAssignBlackPlayer?: (playerId: string | null) => void
  gamePhase?: 'setup' | 'playing' | 'results'
  customModeLabel?: string
  customModeEmoji?: string
  customModeColor?: string
}

/**
 * GameNavContent - Contains all game-related hooks and navigation
 *
 * This component is lazy-loaded by PageWithNav only when navTitle is provided.
 * It contains the expensive imports: useGameMode, useRoomData, useViewerId
 * which pull in GameModeContext and arcade room dependencies.
 */
export function GameNavContent({
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
}: GameNavContentProps) {
  const { players, activePlayers, setActive, activePlayerCount } = useGameMode()
  const { roomData, isInRoom, moderationEvent, clearModerationEvent } = useRoomData()
  const { data: viewerId } = useViewerId()
  const [mounted, setMounted] = React.useState(false)
  const [configurePlayerId, setConfigurePlayerId] = React.useState<string | null>(null)

  // Lift AddPlayerButton popover state here to survive GameContextNav remounts
  const [showPopover, setShowPopover] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'add' | 'invite'>('add')

  // Delay mounting animation slightly for smooth transition
  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleRemovePlayer = React.useCallback(
    (playerId: string) => {
      setActive(playerId, false)
    },
    [setActive]
  )

  const handleAddPlayer = React.useCallback(
    (playerId: string) => {
      setActive(playerId, true)
    },
    [setActive]
  )

  const handleConfigurePlayer = React.useCallback(
    (playerId: string) => {
      setConfigurePlayerId(playerId)
    },
    [setConfigurePlayerId]
  )

  // Get active and inactive players as arrays
  // Only show LOCAL players in the active/inactive lists (remote players shown separately in networkPlayers)
  // Memoized to prevent unnecessary re-renders
  const activePlayerList = React.useMemo(
    () =>
      Array.from(activePlayers)
        .map((id) => players.get(id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined && p.isLocal !== false),
    [activePlayers, players]
  )

  const inactivePlayerList = React.useMemo(
    () =>
      Array.from(players.values()).filter((p) => !activePlayers.has(p.id) && p.isLocal !== false),
    [players, activePlayers]
  )

  // Compute game mode from active player count
  const gameMode =
    activePlayerCount === 0
      ? 'none'
      : activePlayerCount === 1
        ? 'single'
        : activePlayerCount === 2
          ? 'battle'
          : activePlayerCount >= 3
            ? 'tournament'
            : 'none'

  const shouldEmphasize = emphasizePlayerSelection && mounted
  const showFullscreenSelection =
    !disableFullscreenSelection && shouldEmphasize && activePlayerCount === 0

  // Compute arcade session info for display
  // Memoized to prevent unnecessary re-renders
  const roomInfo = React.useMemo(
    () =>
      isInRoom && roomData
        ? {
            roomId: roomData.id,
            roomName: roomData.name,
            gameName: roomData.gameName,
            playerCount: roomData.members?.length ?? 0,
            joinCode: roomData.code,
          }
        : undefined,
    [isInRoom, roomData]
  )

  // Compute network players (other players in the room, excluding current user)
  // Memoized to prevent unnecessary re-renders
  const networkPlayers = React.useMemo(() => {
    if (!isInRoom || !roomData?.members || !roomData?.memberPlayers) {
      return []
    }

    return roomData.members
      .filter((member) => member.userId !== viewerId)
      .flatMap((member) => {
        const memberPlayerList = roomData.memberPlayers[member.userId] || []
        return memberPlayerList.map((player) => ({
          id: player.id,
          emoji: player.emoji,
          name: player.name,
          color: player.color,
          memberName: member.displayName,
          userId: member.userId, // Add userId for moderation
          isOnline: member.isOnline,
        }))
      })
  }, [isInRoom, roomData, viewerId])

  // Create nav content
  const navContent = (
    <GameContextNav
      navTitle={navTitle}
      navEmoji={navEmoji}
      gameName={gameName}
      gameMode={gameMode}
      activePlayers={activePlayerList}
      inactivePlayers={inactivePlayerList}
      shouldEmphasize={shouldEmphasize}
      showFullscreenSelection={showFullscreenSelection}
      onAddPlayer={handleAddPlayer}
      onRemovePlayer={handleRemovePlayer}
      onConfigurePlayer={handleConfigurePlayer}
      onExitSession={onExitSession}
      onSetup={onSetup}
      onNewGame={onNewGame}
      roomInfo={roomInfo}
      networkPlayers={networkPlayers}
      currentPlayerId={currentPlayerId}
      playerScores={playerScores}
      playerStreaks={playerStreaks}
      playerBadges={playerBadges}
      showPopover={showPopover}
      setShowPopover={setShowPopover}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      rosterWarning={rosterWarning}
      whitePlayerId={whitePlayerId}
      blackPlayerId={blackPlayerId}
      onAssignWhitePlayer={onAssignWhitePlayer}
      onAssignBlackPlayer={onAssignBlackPlayer}
      gamePhase={gamePhase}
      customModeLabel={customModeLabel}
      customModeEmoji={customModeEmoji}
      customModeColor={customModeColor}
    />
  )

  return (
    <>
      <AppNavBar navSlot={navContent} />
      {children}
      {configurePlayerId && (
        <PlayerConfigDialog
          playerId={configurePlayerId}
          onClose={() => setConfigurePlayerId(null)}
        />
      )}
      <ModerationNotifications moderationEvent={moderationEvent} onClose={clearModerationEvent} />
    </>
  )
}
