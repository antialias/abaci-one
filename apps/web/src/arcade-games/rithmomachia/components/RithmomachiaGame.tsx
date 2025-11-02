'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { PlayerBadge } from '@/components/nav/types'
import { PageWithNav } from '@/components/PageWithNav'
import { StandardGameLayout } from '@/components/StandardGameLayout'
import { useFullscreen } from '@/contexts/FullscreenContext'
import { useAbacusSettings } from '@/hooks/useAbacusSettings'
import { css } from '../../../../styled-system/css'
import { useRosterWarning } from '../hooks/useRosterWarning'
import { useRithmomachia } from '../Provider'
import { PlayingGuideModal } from './PlayingGuideModal'
import { PlayingPhase } from './phases/PlayingPhase'
import { ResultsPhase } from './phases/ResultsPhase'
import { SetupPhase } from './phases/SetupPhase'

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
  const [guideDocked, setGuideDocked] = useState(false)
  const [guideDockSide, setGuideDockSide] = useState<'left' | 'right'>('right')
  const [dockPreviewSide, setDockPreviewSide] = useState<'left' | 'right' | null>(null)

  useEffect(() => {
    // Register this component's main div as the fullscreen element
    if (gameRef.current) {
      setFullscreenElement(gameRef.current)
    }
  }, [setFullscreenElement])

  // Debug logging for state changes
  useEffect(() => {
    console.log('[RithmomachiaGame] State changed', {
      isGuideOpen,
      guideDocked,
      guideDockSide,
    })
  }, [isGuideOpen, guideDocked, guideDockSide])

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

  const handleOpenGuide = () => {
    console.log('[RithmomachiaGame] handleOpenGuide called')
    setIsGuideOpen(true)
    setGuideDocked(true) // Default to docked on right
    setGuideDockSide('right')
    console.log('[RithmomachiaGame] Guide opened in docked right position')
  }

  const handleDock = (side: 'left' | 'right') => {
    console.log('[RithmomachiaGame] handleDock called', { side })
    setGuideDockSide(side)
    setGuideDocked(true)
    setDockPreviewSide(null) // Clear preview when committing to dock
    console.log('[RithmomachiaGame] Docked state updated', {
      guideDocked: true,
      guideDockSide: side,
    })
  }

  const handleUndock = () => {
    console.log('[RithmomachiaGame] handleUndock called')
    setGuideDocked(false)
    console.log('[RithmomachiaGame] Undocked state updated', { guideDocked: false })
  }

  const handleDockPreview = (side: 'left' | 'right' | null) => {
    console.log('[RithmomachiaGame] handleDockPreview called', { side })
    setDockPreviewSide(side)
  }

  const gameContent = (
    <div
      className={css({
        flex: 1,
        padding: guideDocked ? 0 : { base: '12px', sm: '16px', md: '20px' },
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
          maxWidth: guideDocked ? 'none' : '1200px',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: guideDocked ? 0 : { base: '12px', md: '20px' },
          padding: { base: '12px', sm: '16px', md: '24px', lg: '32px' },
          boxShadow: guideDocked ? 'none' : '0 10px 30px rgba(0,0,0,0.2)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          height: '100%',
        })}
      >
        {state.gamePhase === 'setup' && <SetupPhase onOpenGuide={handleOpenGuide} />}
        {state.gamePhase === 'playing' && <PlayingPhase onOpenGuide={handleOpenGuide} />}
        {state.gamePhase === 'results' && <ResultsPhase />}
      </main>
    </div>
  )

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
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          })}
        >
          {(guideDocked || dockPreviewSide) && isGuideOpen ? (
            <PanelGroup direction="horizontal" style={{ flex: 1 }}>
              {(guideDocked ? guideDockSide : dockPreviewSide) === 'left' && (
                <>
                  <Panel defaultSize={35} minSize={20} maxSize={50}>
                    <PlayingGuideModal
                      isOpen={true}
                      onClose={() => setIsGuideOpen(false)}
                      docked={true} // Always render as docked when in panel
                      onUndock={guideDocked ? handleUndock : undefined} // Only show undock button when truly docked
                      onDockPreview={handleDockPreview}
                    />
                  </Panel>
                  <PanelResizeHandle
                    className={css({
                      width: '2px',
                      background: '#e5e7eb',
                      cursor: 'col-resize',
                      transition: 'all 0.2s',
                      _hover: {
                        background: '#9ca3af',
                        width: '3px',
                      },
                    })}
                  />
                  <Panel minSize={50}>{gameContent}</Panel>
                </>
              )}
              {(guideDocked ? guideDockSide : dockPreviewSide) === 'right' && (
                <>
                  <Panel minSize={50}>{gameContent}</Panel>
                  <PanelResizeHandle
                    className={css({
                      width: '2px',
                      background: '#e5e7eb',
                      cursor: 'col-resize',
                      transition: 'all 0.2s',
                      _hover: {
                        background: '#9ca3af',
                        width: '3px',
                      },
                    })}
                  />
                  <Panel defaultSize={35} minSize={20} maxSize={50}>
                    <PlayingGuideModal
                      isOpen={true}
                      onClose={() => setIsGuideOpen(false)}
                      docked={true} // Always render as docked when in panel
                      onUndock={guideDocked ? handleUndock : undefined} // Only show undock button when truly docked
                      onDockPreview={handleDockPreview}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>
          ) : (
            gameContent
          )}
        </div>
      </StandardGameLayout>

      {/* Playing Guide Modal - only show when not docked */}
      {!guideDocked && (
        <PlayingGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
          docked={false}
          onDock={handleDock}
          onDockPreview={handleDockPreview}
        />
      )}
    </PageWithNav>
  )
}

/**
 * Setup phase: game configuration and start button.
 */
