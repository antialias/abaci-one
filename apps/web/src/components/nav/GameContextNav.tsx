import React from 'react'
import { ActivePlayersList } from './ActivePlayersList'
import { AddPlayerButton } from './AddPlayerButton'
import { FullscreenPlayerSelection } from './FullscreenPlayerSelection'
import { GameControlButtons } from './GameControlButtons'
import { GameModeIndicator } from './GameModeIndicator'
import { NetworkPlayerIndicator } from './NetworkPlayerIndicator'
import { RoomInfo } from './RoomInfo'

type GameMode = 'none' | 'single' | 'battle' | 'tournament'

interface Player {
  id: string
  name: string
  emoji: string
}

interface NetworkPlayer {
  id: string
  emoji?: string
  name?: string
}

interface ArcadeRoomInfo {
  gameName: string
  playerCount: number
}

interface GameContextNavProps {
  navTitle: string
  navEmoji?: string
  gameMode: GameMode
  activePlayers: Player[]
  inactivePlayers: Player[]
  shouldEmphasize: boolean
  showFullscreenSelection: boolean
  onAddPlayer: (playerId: string) => void
  onRemovePlayer: (playerId: string) => void
  onConfigurePlayer: (playerId: string) => void
  onExitSession?: () => void
  onSetup?: () => void
  onNewGame?: () => void
  canModifyPlayers?: boolean
  // Arcade session info
  networkPlayers?: NetworkPlayer[]
  roomInfo?: ArcadeRoomInfo
}

export function GameContextNav({
  navTitle,
  navEmoji,
  gameMode,
  activePlayers,
  inactivePlayers,
  shouldEmphasize,
  showFullscreenSelection,
  onAddPlayer,
  onRemovePlayer,
  onConfigurePlayer,
  onExitSession,
  onSetup,
  onNewGame,
  canModifyPlayers = true,
  networkPlayers = [],
  roomInfo,
}: GameContextNavProps) {
  const [_isTransitioning, setIsTransitioning] = React.useState(false)
  const [layoutMode, setLayoutMode] = React.useState<'column' | 'row'>(
    showFullscreenSelection ? 'column' : 'row'
  )
  const [containerWidth, setContainerWidth] = React.useState<string>(
    showFullscreenSelection ? '100%' : 'auto'
  )

  React.useEffect(() => {
    if (showFullscreenSelection) {
      // Switching to fullscreen - change layout and width immediately
      setLayoutMode('column')
      setContainerWidth('100%')
    } else {
      // Switching away from fullscreen - delay layout change until transition completes
      setIsTransitioning(true)
      setContainerWidth('auto')
      const timer = setTimeout(() => {
        setLayoutMode('row')
        setIsTransitioning(false)
      }, 400) // Match transition duration
      return () => clearTimeout(timer)
    }
  }, [showFullscreenSelection])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: layoutMode,
        alignItems: showFullscreenSelection ? 'stretch' : 'center',
        gap: shouldEmphasize ? '16px' : '12px',
        width: containerWidth,
        transition: 'gap 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: shouldEmphasize ? '16px' : '12px',
          justifyContent: showFullscreenSelection ? 'center' : 'flex-start',
          width: showFullscreenSelection ? '100%' : 'auto',
        }}
      >
        <h1
          style={{
            fontSize: showFullscreenSelection ? '32px' : '18px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
            backgroundClip: 'text',
            color: 'transparent',
            margin: 0,
            transition: 'font-size 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {navEmoji && `${navEmoji} `}
          {navTitle}
        </h1>

        <GameModeIndicator
          gameMode={gameMode}
          shouldEmphasize={shouldEmphasize}
          showFullscreenSelection={showFullscreenSelection}
        />

        {/* Room Info - show when in arcade session */}
        {roomInfo && !showFullscreenSelection && (
          <RoomInfo
            gameName={roomInfo.gameName}
            playerCount={roomInfo.playerCount}
            shouldEmphasize={shouldEmphasize}
          />
        )}

        {/* Network Players - show other players in the room */}
        {networkPlayers.length > 0 && !showFullscreenSelection && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: shouldEmphasize ? '12px' : '6px',
            }}
          >
            {networkPlayers.map((player) => (
              <NetworkPlayerIndicator
                key={player.id}
                player={player}
                shouldEmphasize={shouldEmphasize}
              />
            ))}
          </div>
        )}

        {/* Game Control Buttons - only show during active game */}
        {!showFullscreenSelection && !canModifyPlayers && (
          <GameControlButtons onSetup={onSetup} onNewGame={onNewGame} onQuit={onExitSession} />
        )}

        {/* Active Players + Add Button */}
        {(activePlayers.length > 0 ||
          (shouldEmphasize && inactivePlayers.length > 0 && canModifyPlayers)) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: shouldEmphasize ? '12px' : '2px',
              padding: shouldEmphasize ? '12px 20px' : '0',
              background: shouldEmphasize
                ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))'
                : 'transparent',
              borderRadius: shouldEmphasize ? '16px' : '0',
              border: shouldEmphasize ? '3px solid rgba(255, 255, 255, 0.25)' : 'none',
              boxShadow: shouldEmphasize
                ? '0 6px 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255,255,255,0.3)'
                : 'none',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: shouldEmphasize ? 'scale(1.05)' : 'scale(1)',
              opacity: canModifyPlayers ? 1 : 0.6,
              pointerEvents: canModifyPlayers ? 'auto' : 'none',
            }}
          >
            <ActivePlayersList
              activePlayers={activePlayers}
              shouldEmphasize={shouldEmphasize}
              onRemovePlayer={onRemovePlayer}
              onConfigurePlayer={onConfigurePlayer}
            />

            {canModifyPlayers && (
              <AddPlayerButton
                inactivePlayers={inactivePlayers}
                shouldEmphasize={shouldEmphasize}
                onAddPlayer={onAddPlayer}
              />
            )}
          </div>
        )}
      </div>

      {/* Fullscreen player selection grid */}
      <FullscreenPlayerSelection
        inactivePlayers={inactivePlayers}
        onSelectPlayer={onAddPlayer}
        onConfigurePlayer={onConfigurePlayer}
        isVisible={showFullscreenSelection}
      />

      {/* Add keyframes for animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes expandIn {
          from {
            opacity: 0;
            transform: scaleY(0.8);
          }
          to {
            opacity: 1;
            transform: scaleY(1);
          }
        }
      `,
        }}
      />
    </div>
  )
}
