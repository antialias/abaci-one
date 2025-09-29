'use client'

import React from 'react'
import { AppNavBar } from './AppNavBar'
import { useGameMode } from '../contexts/GameModeContext'
import { useUserProfile } from '../contexts/UserProfileContext'
import { GameContextNav } from './nav/GameContextNav'
import { PlayerConfigDialog } from './nav/PlayerConfigDialog'

interface PageWithNavProps {
  navTitle?: string
  navEmoji?: string
  emphasizeGameContext?: boolean
  children: React.ReactNode
}

export function PageWithNav({ navTitle, navEmoji, emphasizeGameContext = false, children }: PageWithNavProps) {
  const { players, activePlayerCount, updatePlayer } = useGameMode()
  const { profile } = useUserProfile()
  const [mounted, setMounted] = React.useState(false)
  const [configurePlayerId, setConfigurePlayerId] = React.useState<1 | 2 | 3 | 4 | null>(null)

  // Delay mounting animation slightly for smooth transition
  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleRemovePlayer = (playerId: number) => {
    updatePlayer(playerId, { isActive: false })
  }

  const handleAddPlayer = (playerId: number) => {
    updatePlayer(playerId, { isActive: true })
  }

  const handleConfigurePlayer = (playerId: number) => {
    // Support configuring all players (1-4)
    if (playerId >= 1 && playerId <= 4) {
      setConfigurePlayerId(playerId as 1 | 2 | 3 | 4)
    }
  }

  // Transform players to use profile emojis and names for all players
  const getPlayerEmoji = (playerId: number) => {
    switch (playerId) {
      case 1: return profile.player1Emoji
      case 2: return profile.player2Emoji
      case 3: return profile.player3Emoji
      case 4: return profile.player4Emoji
      default: return players.find(p => p.id === playerId)?.emoji || '😀'
    }
  }

  const getPlayerName = (playerId: number) => {
    switch (playerId) {
      case 1: return profile.player1Name
      case 2: return profile.player2Name
      case 3: return profile.player3Name
      case 4: return profile.player4Name
      default: return players.find(p => p.id === playerId)?.name || `Player ${playerId}`
    }
  }

  const activePlayers = players
    .filter(p => p.isActive)
    .map(player => ({
      ...player,
      emoji: getPlayerEmoji(player.id),
      name: getPlayerName(player.id)
    }))

  const inactivePlayers = players
    .filter(p => !p.isActive)
    .map(player => ({
      ...player,
      emoji: getPlayerEmoji(player.id),
      name: getPlayerName(player.id)
    }))

  // Compute game mode from active player count
  const gameMode = activePlayerCount === 0 ? 'none' :
                   activePlayerCount === 1 ? 'single' :
                   activePlayerCount === 2 ? 'battle' :
                   activePlayerCount >= 3 ? 'tournament' : 'none'

  const shouldEmphasize = emphasizeGameContext && mounted
  const showFullscreenSelection = shouldEmphasize && activePlayerCount === 0

  // Create nav content if title is provided
  const navContent = navTitle ? (
    <GameContextNav
      navTitle={navTitle}
      navEmoji={navEmoji}
      gameMode={gameMode}
      activePlayers={activePlayers}
      inactivePlayers={inactivePlayers}
      shouldEmphasize={shouldEmphasize}
      showFullscreenSelection={showFullscreenSelection}
      onAddPlayer={handleAddPlayer}
      onRemovePlayer={handleRemovePlayer}
      onConfigurePlayer={handleConfigurePlayer}
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