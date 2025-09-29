'use client'

import React from 'react'
import { AppNavBar } from './AppNavBar'
import { useGameMode } from '../contexts/GameModeContext'
import { useUserProfile } from '../contexts/UserProfileContext'
import { GameContextNav } from './nav/GameContextNav'

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

  // Transform players to use profile emojis for players 1 and 2
  const activePlayers = players
    .filter(p => p.isActive)
    .map(player => ({
      ...player,
      emoji: player.id === 1 ? profile.player1Emoji : player.id === 2 ? profile.player2Emoji : player.emoji,
      name: player.id === 1 ? profile.player1Name : player.id === 2 ? profile.player2Name : player.name
    }))

  const inactivePlayers = players
    .filter(p => !p.isActive)
    .map(player => ({
      ...player,
      emoji: player.id === 1 ? profile.player1Emoji : player.id === 2 ? profile.player2Emoji : player.emoji,
      name: player.id === 1 ? profile.player1Name : player.id === 2 ? profile.player2Name : player.name
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
    />
  ) : null

  return (
    <>
      <AppNavBar navSlot={navContent} />
      {children}
    </>
  )
}