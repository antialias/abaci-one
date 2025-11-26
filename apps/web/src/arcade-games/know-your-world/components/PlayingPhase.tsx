'use client'

import { css } from '@styled/css'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useKnowYourWorld } from '../Provider'
import { getFilteredMapDataSync } from '../maps'
import { MapRenderer } from './MapRenderer'
import { GameInfoPanel } from './GameInfoPanel'
import { useViewerId } from '@/lib/arcade/game-sdk'
import { useGameMode } from '@/lib/arcade/game-sdk'

export function PlayingPhase() {
  const { state, clickRegion, giveUp, otherPlayerCursors, sendCursorUpdate } = useKnowYourWorld()
  const { data: viewerId } = useViewerId()
  const { activePlayers } = useGameMode()

  // Find the local player ID (first player that belongs to this viewer)
  // In most cases, each user controls one player
  const localPlayerId = Array.from(activePlayers)[0] || ''

  const mapData = getFilteredMapDataSync(
    state.selectedMap,
    state.selectedContinent,
    state.difficulty
  )
  const totalRegions = mapData.regions.length
  const foundCount = state.regionsFound.length
  const progress = (foundCount / totalRegions) * 100

  // Get the display name for the current prompt
  const currentRegionName = state.currentPrompt
    ? (mapData.regions.find((r) => r.id === state.currentPrompt)?.name ?? null)
    : null

  // Debug logging
  console.log('[PlayingPhase] Current prompt lookup:', {
    currentPrompt: state.currentPrompt,
    currentRegionName,
    difficulty: state.difficulty,
    totalFilteredRegions: mapData.regions.length,
    filteredRegionIds: mapData.regions.map((r) => r.id).slice(0, 10),
    regionsToFindCount: state.regionsToFind.length,
    regionsToFindSample: state.regionsToFind.slice(0, 5),
  })

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
            foundCount={foundCount}
            totalRegions={totalRegions}
            progress={progress}
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
              difficulty={state.difficulty}
              selectedMap={state.selectedMap}
              selectedContinent={state.selectedContinent}
              onRegionClick={clickRegion}
              guessHistory={state.guessHistory}
              playerMetadata={state.playerMetadata}
              giveUpReveal={state.giveUpReveal}
              onGiveUp={giveUp}
              gameMode={state.gameMode}
              currentPlayer={state.currentPlayer}
              localPlayerId={localPlayerId}
              otherPlayerCursors={otherPlayerCursors}
              onCursorUpdate={sendCursorUpdate}
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}
