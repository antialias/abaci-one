'use client'

import React from 'react'
import { useGameMode } from '../contexts/GameModeContext'
import { useRoomData } from '../hooks/useRoomData'
import { useViewerId } from '../hooks/useViewerId'
import { AppNavBar } from './AppNavBar'
import { GameContextNav, type RosterWarning } from './nav/GameContextNav'
import type { PlayerBadge } from './nav/types'
import { PlayerConfigDialog } from './nav/PlayerConfigDialog'
import { ModerationNotifications } from './nav/ModerationNotifications'

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
}

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
}: PageWithNavProps) {
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

  // Create nav content if title is provided
  // Pass lifted state to preserve popover state across remounts
  const navContent = navTitle ? (
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
    />
  ) : null

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
