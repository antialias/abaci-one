import React from 'react'
import { GameModeIndicator } from './GameModeIndicator'
import { ActivePlayersList } from './ActivePlayersList'
import { AddPlayerButton } from './AddPlayerButton'
import { FullscreenPlayerSelection } from './FullscreenPlayerSelection'

type GameMode = 'none' | 'single' | 'battle' | 'tournament'

interface Player {
  id: number
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
  onAddPlayer: (playerId: number) => void
  onRemovePlayer: (playerId: number) => void
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
  onRemovePlayer
}: GameContextNavProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: showFullscreenSelection ? 'column' : 'row',
      alignItems: showFullscreenSelection ? 'stretch' : 'center',
      gap: shouldEmphasize ? '16px' : '12px',
      width: showFullscreenSelection ? '100%' : 'auto',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
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

        {/* Active Players + Add Button */}
        {(activePlayers.length > 0 || (shouldEmphasize && inactivePlayers.length > 0)) && (
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
            transform: shouldEmphasize ? 'scale(1.05)' : 'scale(1)'
          }}>
            <ActivePlayersList
              activePlayers={activePlayers}
              shouldEmphasize={shouldEmphasize}
              onRemovePlayer={onRemovePlayer}
            />

            <AddPlayerButton
              inactivePlayers={inactivePlayers}
              shouldEmphasize={shouldEmphasize}
              onAddPlayer={onAddPlayer}
            />
          </div>
        )}
      </div>

      {/* Fullscreen player selection grid */}
      {showFullscreenSelection && (
        <FullscreenPlayerSelection
          inactivePlayers={inactivePlayers}
          onSelectPlayer={onAddPlayer}
        />
      )}

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