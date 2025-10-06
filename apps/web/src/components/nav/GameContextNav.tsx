import React from 'react'
import { GameModeIndicator } from './GameModeIndicator'
import { ActivePlayersList } from './ActivePlayersList'
import { AddPlayerButton } from './AddPlayerButton'
import { FullscreenPlayerSelection } from './FullscreenPlayerSelection'

type GameMode = 'none' | 'single' | 'battle' | 'tournament'

interface Player {
  id: string
  name: string
  emoji: string
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
  canModifyPlayers?: boolean
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
  canModifyPlayers = true
}: GameContextNavProps) {
  const [isTransitioning, setIsTransitioning] = React.useState(false)
  const [layoutMode, setLayoutMode] = React.useState<'column' | 'row'>(showFullscreenSelection ? 'column' : 'row')
  const [containerWidth, setContainerWidth] = React.useState<string>(showFullscreenSelection ? '100%' : 'auto')

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
    <div style={{
      display: 'flex',
      flexDirection: layoutMode,
      alignItems: showFullscreenSelection ? 'stretch' : 'center',
      gap: shouldEmphasize ? '16px' : '12px',
      width: containerWidth,
      transition: 'gap 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: shouldEmphasize ? '16px' : '12px',
        justifyContent: showFullscreenSelection ? 'center' : 'flex-start',
        width: showFullscreenSelection ? '100%' : 'auto'
      }}>
        <h1 style={{
          fontSize: showFullscreenSelection ? '32px' : '18px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
          backgroundClip: 'text',
          color: 'transparent',
          margin: 0,
          transition: 'font-size 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          {navEmoji && `${navEmoji} `}{navTitle}
        </h1>

        <GameModeIndicator
          gameMode={gameMode}
          shouldEmphasize={shouldEmphasize}
          showFullscreenSelection={showFullscreenSelection}
        />

        {/* Exit Session / Return to Arcade Button - only show during active game */}
        {onExitSession && !showFullscreenSelection && !canModifyPlayers && (
          <button
            onClick={onExitSession}
            style={{
              background: 'linear-gradient(135deg, #3498db, #2980b9)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #2980b9, #1c6ca1)'
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #3498db, #2980b9)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}
          >
            <span>🏟️</span>
            <span>Return to Arcade</span>
          </button>
        )}

        {/* Active Players + Add Button */}
        {(activePlayers.length > 0 || (shouldEmphasize && inactivePlayers.length > 0 && canModifyPlayers)) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: shouldEmphasize ? '12px' : '2px',
            padding: shouldEmphasize ? '12px 20px' : '0',
            background: shouldEmphasize
              ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))'
              : 'transparent',
            borderRadius: shouldEmphasize ? '16px' : '0',
            border: shouldEmphasize ? '3px solid rgba(255, 255, 255, 0.25)' : 'none',
            boxShadow: shouldEmphasize ? '0 6px 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: shouldEmphasize ? 'scale(1.05)' : 'scale(1)',
            opacity: canModifyPlayers ? 1 : 0.6,
            pointerEvents: canModifyPlayers ? 'auto' : 'none'
          }}>
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
      <style dangerouslySetInnerHTML={{ __html: `
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
      ` }} />
    </div>
  )
}