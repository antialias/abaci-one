'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RosterWarning } from '@/components/nav/GameContextNav'
import type { PlayerBadge } from '@/components/nav/types'
import { PageWithNav } from '@/components/PageWithNav'
import { StandardGameLayout } from '@/components/StandardGameLayout'
import { useFullscreen } from '@/contexts/FullscreenContext'
import { useGameMode } from '@/contexts/GameModeContext'
import { useAbacusSettings } from '@/hooks/useAbacusSettings'
import { useDeactivatePlayer, useKickUser, useRoomData } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import { css } from '../../../../styled-system/css'
import { useRithmomachia } from '../Provider'
import { PlayingGuideModal } from './PlayingGuideModal'
import { PlayingPhase } from './phases/PlayingPhase'
import { ResultsPhase } from './phases/ResultsPhase'
import { SetupPhase } from './phases/SetupPhase'

function useRosterWarning(phase: 'setup' | 'playing'): RosterWarning | undefined {
  const { rosterStatus, whitePlayerId, blackPlayerId } = useRithmomachia()
  const { players: playerMap, activePlayers: activePlayerIds, addPlayer, setActive } = useGameMode()
  const { roomData } = useRoomData()
  const { data: viewerId } = useViewerId()
  const { mutate: kickUser } = useKickUser()
  const { mutate: deactivatePlayer } = useDeactivatePlayer()

  return useMemo(() => {
    // Don't show notice for 'ok' or 'noLocalControl' (observers are allowed)
    if (rosterStatus.status === 'ok' || rosterStatus.status === 'noLocalControl') {
      return undefined
    }

    const playersArray = Array.from(playerMap.values()).sort((a, b) => {
      const aTime =
        typeof a.createdAt === 'number'
          ? a.createdAt
          : a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : 0
      const bTime =
        typeof b.createdAt === 'number'
          ? b.createdAt
          : b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : 0
      return aTime - bTime
    })

    const isHost =
      roomData && viewerId
        ? roomData.members.find((m) => m.userId === viewerId)?.isCreator === true
        : false

    const removableLocalPlayers = playersArray.filter(
      (player) =>
        player.isLocal !== false &&
        activePlayerIds.has(player.id) &&
        player.id !== whitePlayerId &&
        player.id !== blackPlayerId
    )

    const kickablePlayers =
      isHost && roomData
        ? playersArray.filter(
            (player) =>
              player.isLocal === false &&
              activePlayerIds.has(player.id) &&
              player.id !== whitePlayerId &&
              player.id !== blackPlayerId
          )
        : []

    const inactiveLocalPlayer = playersArray.find(
      (player) => player.isLocal !== false && !activePlayerIds.has(player.id)
    )

    const handleKick = (player: any) => {
      if (!roomData) return
      for (const [userId, players] of Object.entries(roomData.memberPlayers)) {
        if (players.some((p) => p.id === player.id)) {
          kickUser({ roomId: roomData.id, userId })
          break
        }
      }
    }

    if (rosterStatus.status === 'tooFew') {
      // During setup, don't show nav banner - SetupPlayerRequirement panel handles this
      if (phase === 'setup') {
        return undefined
      }

      // During playing phase, show nav warning banner
      const actions = []
      if (inactiveLocalPlayer) {
        actions.push({
          label: `Activate ${inactiveLocalPlayer.name}`,
          onClick: () => setActive(inactiveLocalPlayer.id, true),
        })
      } else {
        actions.push({
          label: 'Create local player',
          onClick: () => addPlayer({ isActive: true }),
        })
      }

      return {
        heading: 'Need two active players',
        description: 'Gameplay is paused until two players are active.',
        actions,
      }
    }

    return undefined
  }, [
    rosterStatus.status,
    phase,
    playerMap,
    activePlayerIds,
    whitePlayerId,
    blackPlayerId,
    roomData,
    viewerId,
    addPlayer,
    setActive,
    kickUser,
    deactivatePlayer,
  ])
}

/**
 * Main Rithmomachia game component.
 * Orchestrates the game phases and UI.
 */
export function RithmomachiaGame() {
  const router = useRouter()
  const {
    state,
    resetGame,
    goToSetup,
    whitePlayerId,
    blackPlayerId,
    assignWhitePlayer,
    assignBlackPlayer,
  } = useRithmomachia()

  // Get abacus settings for native abacus numbers
  const { data: abacusSettings } = useAbacusSettings()
  const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false
  const { setFullscreenElement } = useFullscreen()
  const gameRef = useRef<HTMLDivElement>(null)
  const rosterWarning = useRosterWarning(state.gamePhase === 'setup' ? 'setup' : 'playing')
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  useEffect(() => {
    // Register this component's main div as the fullscreen element
    if (gameRef.current) {
      setFullscreenElement(gameRef.current)
    }
  }, [setFullscreenElement])

  const currentPlayerId = useMemo(() => {
    if (state.turn === 'W') {
      return whitePlayerId ?? undefined
    }
    if (state.turn === 'B') {
      return blackPlayerId ?? undefined
    }
    return undefined
  }, [state.turn, whitePlayerId, blackPlayerId])

  const playerBadges = useMemo<Record<string, PlayerBadge>>(() => {
    const badges: Record<string, PlayerBadge> = {}
    if (whitePlayerId) {
      badges[whitePlayerId] = {
        label: 'White',
        icon: '⚪',
        background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(226, 232, 240, 0.9))',
        color: '#0f172a',
        borderColor: 'rgba(226, 232, 240, 0.8)',
        shadowColor: 'rgba(148, 163, 184, 0.35)',
      }
    }
    if (blackPlayerId) {
      badges[blackPlayerId] = {
        label: 'Black',
        icon: '⚫',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.94))',
        color: '#f8fafc',
        borderColor: 'rgba(30, 41, 59, 0.9)',
        shadowColor: 'rgba(15, 23, 42, 0.45)',
      }
    }
    return badges
  }, [whitePlayerId, blackPlayerId])

  return (
    <PageWithNav
      navTitle="Rithmomachia"
      navEmoji="🎲"
      emphasizePlayerSelection={state.gamePhase === 'setup'}
      onExitSession={() => {
        router.push('/arcade')
      }}
      onNewGame={resetGame}
      onSetup={goToSetup}
      currentPlayerId={currentPlayerId}
      playerBadges={playerBadges}
      rosterWarning={rosterWarning}
      whitePlayerId={whitePlayerId}
      blackPlayerId={blackPlayerId}
      onAssignWhitePlayer={assignWhitePlayer}
      onAssignBlackPlayer={assignBlackPlayer}
      gamePhase={state.gamePhase}
    >
      <StandardGameLayout>
        <div
          ref={gameRef}
          className={css({
            flex: 1,
            padding: { base: '12px', sm: '16px', md: '20px' },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            overflow: 'auto',
          })}
        >
          <main
            className={css({
              width: '100%',
              maxWidth: '1200px',
              background: 'rgba(255,255,255,0.95)',
              borderRadius: { base: '12px', md: '20px' },
              padding: { base: '12px', sm: '16px', md: '24px', lg: '32px' },
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            })}
          >
            {state.gamePhase === 'setup' && <SetupPhase onOpenGuide={() => setIsGuideOpen(true)} />}
            {state.gamePhase === 'playing' && (
              <PlayingPhase onOpenGuide={() => setIsGuideOpen(true)} />
            )}
            {state.gamePhase === 'results' && <ResultsPhase />}
          </main>
        </div>
      </StandardGameLayout>

      {/* Playing Guide Modal - persists across all phases */}
      <PlayingGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </PageWithNav>
  )
}

/**
 * Setup phase: game configuration and start button.
 */
