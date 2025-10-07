'use client'

import React from 'react'
import { useGameMode } from '../contexts/GameModeContext'
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
  const activePlayerList = Array.from(activePlayers)
    .map((id) => players.get(id))
    .filter((p) => p !== undefined)
    .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }))

  const inactivePlayerList = Array.from(players.values())
    .filter((p) => !activePlayers.has(p.id))
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
