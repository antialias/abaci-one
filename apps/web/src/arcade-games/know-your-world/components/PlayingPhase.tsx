'use client'

import { css } from '@styled/css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGameMode, useViewerId } from '@/lib/arcade/game-sdk'
import { getAssistanceLevel, getFilteredMapDataBySizesSync } from '../maps'
import { CROP_UPDATE_EVENT, CROP_MODE_EVENT, type CropModeEventDetail } from '../customCrops'
import { useKnowYourWorld } from '../Provider'
import { MusicControlPanel } from '../music'
import { GameInfoPanel } from './GameInfoPanel'
import { MapRenderer } from './MapRenderer'

export function PlayingPhase() {
  const {
    state,
    clickRegion,
    giveUp,
    otherPlayerCursors,
    sendCursorUpdate,
    memberPlayers,
    sharedContainerRef,
  } = useKnowYourWorld()
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

  // Counter to force re-render when crop is updated via DevCropTool
  // This ensures getFilteredMapDataBySizesSync is called again with the new runtime crop
  const [cropUpdateCounter, setCropUpdateCounter] = useState(0)

  // Track whether crop mode is active (dev only) to hide floating UI
  const [cropModeActive, setCropModeActive] = useState(false)

  // Listen for crop update events from DevCropTool
  useEffect(() => {
    const handleCropUpdate = () => {
      console.log('[PlayingPhase] Received crop update event, forcing re-render')
      setCropUpdateCounter((c) => c + 1)
    }

    window.addEventListener(CROP_UPDATE_EVENT, handleCropUpdate)
    return () => window.removeEventListener(CROP_UPDATE_EVENT, handleCropUpdate)
  }, [])

  // Listen for crop mode state changes to hide floating UI
  useEffect(() => {
    const handleCropModeChange = (e: Event) => {
      const detail = (e as CustomEvent<CropModeEventDetail>).detail
      console.log('[PlayingPhase] Crop mode changed:', detail.active)
      setCropModeActive(detail.active)
    }

    window.addEventListener(CROP_MODE_EVENT, handleCropModeChange)
    return () => window.removeEventListener(CROP_MODE_EVENT, handleCropModeChange)
  }, [])

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
      ref={sharedContainerRef}
      data-component="playing-phase"
      className={css({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        zIndex: 0,
      })}
    >
      {/* Full-viewport Map */}
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
        fillContainer
        difficulty={state.difficulty}
        mapName={mapData.name}
      />

      {/* Floating Game Info UI - hidden during crop mode to allow unobstructed dragging */}
      {!cropModeActive && (
        <>
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
          <MusicControlPanel />
        </>
      )}
    </div>
  )
}
