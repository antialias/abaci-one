'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { css } from '@styled/css'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useKnowYourWorld } from '../Provider'
import { getFilteredMapDataBySizesSync, getAssistanceLevel } from '../maps'
import { MapRenderer } from './MapRenderer'
import { GameInfoPanel } from './GameInfoPanel'
import { useViewerId } from '@/lib/arcade/game-sdk'
import { useGameMode } from '@/lib/arcade/game-sdk'

export function PlayingPhase() {
  const { state, clickRegion, giveUp, otherPlayerCursors, sendCursorUpdate, memberPlayers } =
    useKnowYourWorld()
  const { data: viewerId } = useViewerId()
  const { activePlayers, players } = useGameMode()

  // Find the local player ID (the player that belongs to this viewer)
  // Look for a player marked as isLocal, or fall back to first active player
  const localPlayerId = useMemo(() => {
    for (const playerId of activePlayers) {
      const player = players.get(playerId)
      if (player?.isLocal) {
        return playerId
      }
    }
    // Fallback: return first active player (shouldn't happen in normal flow)
    return Array.from(activePlayers)[0] || ''
  }, [activePlayers, players])

  // Wrap sendCursorUpdate to include localPlayerId and viewerId (session ID)
  const handleCursorUpdate = useCallback(
    (cursorPosition: { x: number; y: number } | null, hoveredRegionId: string | null) => {
      if (viewerId) {
        sendCursorUpdate(localPlayerId, viewerId, cursorPosition, hoveredRegionId)
      }
    },
    [localPlayerId, viewerId, sendCursorUpdate]
  )

  const mapData = getFilteredMapDataBySizesSync(
    state.selectedMap,
    state.selectedContinent,
    state.includeSizes
  )
  const totalRegions = mapData.regions.length
  const foundCount = state.regionsFound.length
  const progress = (foundCount / totalRegions) * 100

  // Get the display name and ID for the current prompt
  const currentRegion = state.currentPrompt
    ? mapData.regions.find((r) => r.id === state.currentPrompt)
    : null
  const currentRegionName = currentRegion?.name ?? null
  const currentRegionId = currentRegion?.id ?? null

  // Check if hints are locked (name confirmation required but not yet done)
  const assistanceConfig = getAssistanceLevel(state.assistanceLevel)
  const requiresNameConfirmation = assistanceConfig.nameConfirmationLetters ?? 0

  // Track whether hints have been unlocked for the current region
  const [hintsUnlocked, setHintsUnlocked] = useState(false)

  // Reset hints locked state when region changes
  useEffect(() => {
    setHintsUnlocked(false)
  }, [state.currentPrompt])

  // Hints are locked if name confirmation is required and not yet unlocked
  const hintsLocked = requiresNameConfirmation > 0 && !hintsUnlocked

  // Callback for GameInfoPanel to notify when hints are unlocked
  const handleHintsUnlock = useCallback(() => {
    setHintsUnlocked(true)
  }, [])

  // Error if prompt not found in filtered regions (indicates server/client filter mismatch)
  if (state.currentPrompt && !currentRegion) {
    const errorInfo = {
      currentPrompt: state.currentPrompt,
      includeSizes: state.includeSizes,
      selectedMap: state.selectedMap,
      selectedContinent: state.selectedContinent,
      clientFilteredCount: mapData.regions.length,
      serverRegionsToFindCount: state.regionsToFind.length,
      clientRegionIds: mapData.regions.map((r) => r.id).slice(0, 10), // First 10 for debugging
    }
    console.error('[PlayingPhase] CRITICAL: Prompt not in filtered regions!', errorInfo)
    throw new Error(
      `Server/client filter mismatch: prompt "${state.currentPrompt}" not found in client's ${mapData.regions.length} filtered regions. ` +
        `Server has ${state.regionsToFind.length} regions. includeSizes=${JSON.stringify(state.includeSizes)}`
    )
  }

  return (
    <div
      data-component="playing-phase"
      className={css({
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      <PanelGroup direction="vertical">
        {/* Top Panel: Game Info */}
        <Panel
          defaultSize={20}
          minSize={12}
          maxSize={35}
          className={css({
            // Ensure scrolling on very small screens
            overflow: 'auto',
          })}
        >
          <GameInfoPanel
            mapData={mapData}
            currentRegionName={currentRegionName}
            currentRegionId={currentRegionId}
            selectedMap={state.selectedMap}
            foundCount={foundCount}
            totalRegions={totalRegions}
            progress={progress}
            onHintsUnlock={handleHintsUnlock}
          />
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle
          className={css({
            height: '2px',
            background: '#e5e7eb',
            cursor: 'row-resize',
            transition: 'all 0.2s',
            // Increase hit area for mobile
            position: 'relative',
            _before: {
              content: '""',
              position: 'absolute',
              top: '-4px',
              bottom: '-4px',
              left: 0,
              right: 0,
            },
            _hover: {
              background: '#9ca3af',
              height: '3px',
            },
          })}
        />

        {/* Bottom Panel: Map */}
        <Panel minSize={65}>
          <div
            data-component="map-panel"
            className={css({
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            })}
          >
            <MapRenderer
              mapData={mapData}
              regionsFound={state.regionsFound}
              currentPrompt={state.currentPrompt}
              assistanceLevel={state.assistanceLevel}
              selectedMap={state.selectedMap}
              selectedContinent={state.selectedContinent}
              onRegionClick={clickRegion}
              guessHistory={state.guessHistory}
              playerMetadata={state.playerMetadata}
              giveUpReveal={state.giveUpReveal}
              hintActive={state.hintActive ?? null}
              onGiveUp={giveUp}
              gameMode={state.gameMode}
              currentPlayer={state.currentPlayer}
              localPlayerId={localPlayerId}
              otherPlayerCursors={otherPlayerCursors}
              onCursorUpdate={handleCursorUpdate}
              giveUpVotes={state.giveUpVotes}
              activeUserIds={state.activeUserIds}
              viewerId={viewerId ?? undefined}
              memberPlayers={memberPlayers}
              hintsLocked={hintsLocked}
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}
