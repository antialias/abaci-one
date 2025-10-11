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
  roomName?: string
  gameName: string
  playerCount: number
  joinCode?: string
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
  // 2x2 grid layout for normal mode, column for fullscreen
  if (showFullscreenSelection) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          width: '100%',
        }}
      >
        <h1
          style={{
            fontSize: '32px',
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

        <FullscreenPlayerSelection
          inactivePlayers={inactivePlayers}
          onSelectPlayer={onAddPlayer}
          onConfigurePlayer={onConfigurePlayer}
          isVisible={showFullscreenSelection}
        />

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

  // Normal 2x2 grid layout
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: 'auto',
      }}
    >
      {/* Row 1: Title | Mode + Room */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          justifyContent: 'space-between',
        }}
      >
        {/* Left: Title */}
        <h1
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
            backgroundClip: 'text',
            color: 'transparent',
            margin: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {navEmoji && `${navEmoji} `}
          {navTitle}
        </h1>

        {/* Right: Mode + Room */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <GameModeIndicator gameMode={gameMode} shouldEmphasize={shouldEmphasize} showFullscreenSelection={false} />

          {roomInfo && (
            <RoomInfo
              roomName={roomInfo.roomName}
              gameName={roomInfo.gameName}
              playerCount={roomInfo.playerCount}
              joinCode={roomInfo.joinCode}
              shouldEmphasize={shouldEmphasize}
            />
          )}
        </div>
      </div>

      {/* Row 2: Controls | Players */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          justifyContent: 'space-between',
        }}
      >
        {/* Left: Control buttons */}
        <div>
          {!canModifyPlayers && (
            <GameControlButtons onSetup={onSetup} onNewGame={onNewGame} onQuit={onExitSession} />
          )}
        </div>

        {/* Right: Network players + Your players */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: shouldEmphasize ? '12px' : '8px',
          }}
        >
          {/* Network Players */}
          {networkPlayers.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {networkPlayers.map((player) => (
                <NetworkPlayerIndicator key={player.id} player={player} shouldEmphasize={shouldEmphasize} />
              ))}
            </div>
          )}

          {/* Active Players + Add Button */}
          {(activePlayers.length > 0 || (shouldEmphasize && inactivePlayers.length > 0 && canModifyPlayers)) && (
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
      </div>

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
