'use client'

import React from 'react'
import { useGameMode } from '../contexts/GameModeContext'
import { useArcadeGuard } from '../hooks/useArcadeGuard'
import { useRoomData } from '../hooks/useRoomData'
import { useViewerId } from '../hooks/useViewerId'
import { AppNavBar } from './AppNavBar'
import { GameContextNav } from './nav/GameContextNav'
import { PlayerConfigDialog } from './nav/PlayerConfigDialog'

interface PageWithNavProps {
  navTitle?: string
  navEmoji?: string
  emphasizeGameContext?: boolean
  onExitSession?: () => void
  onSetup?: () => void
  onNewGame?: () => void
  canModifyPlayers?: boolean
  children: React.ReactNode
}

export function PageWithNav({
  navTitle,
  navEmoji,
  emphasizeGameContext = false,
  onExitSession,
  onSetup,
  onNewGame,
  canModifyPlayers = true,
  children,
}: PageWithNavProps) {
  const { players, activePlayers, setActive, activePlayerCount } = useGameMode()
  const { hasActiveSession, activeSession } = useArcadeGuard({ enabled: false }) // Don't redirect, just get info
  const { roomData, isInRoom } = useRoomData()
  const { data: viewerId } = useViewerId()
  const [mounted, setMounted] = React.useState(false)
  const [configurePlayerId, setConfigurePlayerId] = React.useState<string | null>(null)

  // Delay mounting animation slightly for smooth transition
  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleRemovePlayer = (playerId: string) => {
    if (!canModifyPlayers) return
    setActive(playerId, false)
  }

  const handleAddPlayer = (playerId: string) => {
    if (!canModifyPlayers) return
    setActive(playerId, true)
  }

  const handleConfigurePlayer = (playerId: string) => {
    setConfigurePlayerId(playerId)
  }

  // Get active and inactive players as arrays
  // Only show LOCAL players in the active/inactive lists (remote players shown separately in networkPlayers)
  const activePlayerList = Array.from(activePlayers)
    .map((id) => players.get(id))
    .filter((p) => p !== undefined && p.isLocal !== false) // Filter out remote players
    .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }))

  const inactivePlayerList = Array.from(players.values())
    .filter((p) => !activePlayers.has(p.id) && p.isLocal !== false) // Filter out remote players
    .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }))

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

  const shouldEmphasize = emphasizeGameContext && mounted
  const showFullscreenSelection = shouldEmphasize && activePlayerCount === 0

  // Compute arcade session info for display
  const roomInfo =
    isInRoom && roomData
      ? {
          roomName: roomData.name,
          gameName: roomData.gameName,
          playerCount: roomData.members.length,
        }
      : hasActiveSession && activeSession
        ? {
            gameName: activeSession.currentGame,
            playerCount: activePlayerCount,
          }
        : undefined

  // Compute network players (other players in the room, excluding current user)
  const networkPlayers: Array<{ id: string; emoji?: string; name?: string }> =
    isInRoom && roomData
      ? roomData.members
          .filter((member) => member.userId !== viewerId)
          .flatMap((member) => {
            const memberPlayerList = roomData.memberPlayers[member.userId] || []
            return memberPlayerList.map((player) => ({
              id: player.id,
              emoji: player.emoji,
              name: `${player.name} (${member.displayName})`,
            }))
          })
      : []

  // Create nav content if title is provided
  const navContent = navTitle ? (
    <GameContextNav
      navTitle={navTitle}
      navEmoji={navEmoji}
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
      canModifyPlayers={canModifyPlayers}
      roomInfo={roomInfo}
      networkPlayers={networkPlayers}
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
    </>
  )
}
