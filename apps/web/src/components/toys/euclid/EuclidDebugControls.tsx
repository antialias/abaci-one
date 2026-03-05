import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { MacroCeremonyState, GhostLayer } from './types'
import { ToyDebugPanel, DebugSlider, DebugCheckbox } from '../ToyDebugPanel'
import {
  getFriction,
  setFriction,
  getFrictionRange,
} from './render/renderToolOverlay'
import {
  getGhostFalloff,
  setGhostFalloff,
  getGhostFalloffRange,
  getGhostBaseOpacity,
  setGhostBaseOpacity,
  getGhostBaseOpacityRange,
} from './render/renderGhostGeometry'

interface EuclidDebugControlsProps {
  ceremonyFocusMode: boolean
  setCeremonyFocusMode: (v: boolean) => void
  ceremonySpeed: number
  setCeremonySpeed: (v: number) => void
  ceremonyPaused: boolean
  setCeremonyPaused: (v: boolean) => void
  ceremonyTick: number
  setCeremonyTick: Dispatch<SetStateAction<number>>
  macroRevealRef: MutableRefObject<MacroCeremonyState | null>
  ghostLayersRef: MutableRefObject<GhostLayer[]>
  needsDrawRef: MutableRefObject<boolean>
  showContextDebug: boolean
  setShowContextDebug: (v: boolean) => void
  music: { isPlaying: boolean; toggle: () => void }
  macroPreviewAutoFitRef: MutableRefObject<boolean>
  frictionCoeff: number
  setFrictionCoeff: (v: number) => void
  ghostBaseOpacityVal: number
  setGhostBaseOpacityVal: (v: number) => void
  ghostFalloffCoeff: number
  setGhostFalloffCoeff: (v: number) => void
  autoCompleting: boolean
  setAutoCompleting: (v: boolean) => void
  isComplete: boolean
  stepsLength: number
}

export function EuclidDebugControls({
  ceremonyFocusMode,
  setCeremonyFocusMode,
  ceremonySpeed,
  setCeremonySpeed,
  ceremonyPaused,
  setCeremonyPaused,
  ceremonyTick,
  setCeremonyTick,
  macroRevealRef,
  ghostLayersRef,
  needsDrawRef,
  showContextDebug,
  setShowContextDebug,
  music,
  macroPreviewAutoFitRef,
  frictionCoeff,
  setFrictionCoeff,
  ghostBaseOpacityVal,
  setGhostBaseOpacityVal,
  ghostFalloffCoeff,
  setGhostFalloffCoeff,
  autoCompleting,
  setAutoCompleting,
  isComplete,
  stepsLength,
}: EuclidDebugControlsProps) {
  return (
    <ToyDebugPanel title="Euclid">
      {/* Focus mode toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          data-action="debug-focus-all"
          onClick={() => setCeremonyFocusMode(false)}
          style={{
            flex: 1,
            padding: '4px 8px',
            borderRadius: 4,
            border: 'none',
            background: !ceremonyFocusMode ? 'rgba(129,140,248,0.8)' : 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          All
        </button>
        <button
          data-action="debug-focus-ceremony"
          onClick={() => setCeremonyFocusMode(true)}
          style={{
            flex: 1,
            padding: '4px 8px',
            borderRadius: 4,
            border: 'none',
            background: ceremonyFocusMode ? 'rgba(129,140,248,0.8)' : 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Ceremony
        </button>
      </div>

      {/* ── Ceremony debug section (always visible) ── */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            opacity: 0.5,
          }}
        >
          Ceremony
        </div>

        {/* Speed slider */}
        <DebugSlider
          label="Playback speed"
          value={ceremonySpeed}
          min={0.1}
          max={5}
          step={0.1}
          onChange={(v) => {
            setCeremonySpeed(v)
            needsDrawRef.current = true
          }}
          formatValue={(v) => `${v.toFixed(1)}x`}
        />

        {/* Transport controls */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Prev */}
          <button
            data-action="ceremony-prev"
            disabled={!macroRevealRef.current || macroRevealRef.current.revealed <= 0}
            onClick={() => {
              const cer = macroRevealRef.current
              if (!cer || cer.revealed <= 0) return
              // Un-reveal the last group
              cer.revealed--
              cer.allShownMs = null
              cer.narrationFired = false
              // Remove element animations for the group we just hid
              const entry = cer.sequence[cer.revealed]
              const layer = ghostLayersRef.current.find(
                (gl) => `${gl.atStep}:${gl.depth}` === entry.layerKey
              )
              if (layer?.revealGroups) {
                const group = layer.revealGroups[entry.groupIndex - 1]
                if (group) {
                  for (const idx of group) {
                    cer.elementAnims.delete(`${entry.layerKey}:${idx}`)
                  }
                }
              }
              cer.lastRevealMs = performance.now()
              needsDrawRef.current = true
              setCeremonyTick((t) => t + 1)
            }}
            style={{
              flex: 1,
              padding: '5px 0',
              borderRadius: 4,
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
              opacity: !macroRevealRef.current || macroRevealRef.current.revealed <= 0 ? 0.3 : 1,
            }}
          >
            {'<'}
          </button>

          {/* Pause / Play */}
          <button
            data-action="ceremony-pause"
            onClick={() => {
              const next = !ceremonyPaused
              setCeremonyPaused(next)
              // When unpausing, reset the delay timer so the next group doesn't fire instantly
              if (!next && macroRevealRef.current) {
                macroRevealRef.current.lastRevealMs = performance.now()
                if (macroRevealRef.current.allShownMs !== null) {
                  macroRevealRef.current.allShownMs = performance.now()
                }
              }
              needsDrawRef.current = true
            }}
            style={{
              flex: 1,
              padding: '5px 0',
              borderRadius: 4,
              border: 'none',
              background: ceremonyPaused ? 'rgba(129,140,248,0.8)' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {ceremonyPaused ? '\u25B6' : '\u23F8'}
          </button>

          {/* Next */}
          <button
            data-action="ceremony-next"
            disabled={
              !macroRevealRef.current ||
              macroRevealRef.current.revealed >= macroRevealRef.current.sequence.length
            }
            onClick={() => {
              const cer = macroRevealRef.current
              if (!cer || cer.revealed >= cer.sequence.length) return
              const now = performance.now()
              cer.revealed++
              cer.lastRevealMs = now
              // Start draw animations for the newly revealed group
              const entry = cer.sequence[cer.revealed - 1]
              const layer = ghostLayersRef.current.find(
                (gl) => `${gl.atStep}:${gl.depth}` === entry.layerKey
              )
              if (layer?.revealGroups) {
                const group = layer.revealGroups[entry.groupIndex - 1]
                if (group) {
                  const speed = Math.max(0.01, ceremonySpeed)
                  for (const idx of group) {
                    const el = layer.elements[idx]
                    if (!el) continue
                    const baseDurationMs =
                      el.kind === 'circle' ? 700 : el.kind === 'segment' ? 400 : 0
                    cer.elementAnims.set(`${entry.layerKey}:${idx}`, {
                      startMs: now,
                      durationMs: baseDurationMs / speed,
                    })
                  }
                }
              }
              if (cer.revealed >= cer.sequence.length) {
                cer.allShownMs = now
              }
              needsDrawRef.current = true
              setCeremonyTick((t) => t + 1)
            }}
            style={{
              flex: 1,
              padding: '5px 0',
              borderRadius: 4,
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
              opacity:
                !macroRevealRef.current ||
                macroRevealRef.current.revealed >= macroRevealRef.current.sequence.length
                  ? 0.3
                  : 1,
            }}
          >
            {'>'}
          </button>
        </div>

        {/* Ceremony state readout */}
        {(() => {
          void ceremonyTick // subscribe to tick updates
          const cer = macroRevealRef.current
          if (!cer) {
            return (
              <div style={{ fontSize: 10, opacity: 0.4, fontFamily: 'monospace' }}>
                No active ceremony
              </div>
            )
          }
          const total = cer.sequence.length
          const preRevealed = cer.preRevealedLayers.size
          const phase =
            cer.allShownMs !== null
              ? cer.narrationFired
                ? 'post-narration'
                : 'narrating'
              : 'revealing'
          // Identify current layer being revealed
          const currentEntry = cer.revealed < total ? cer.sequence[cer.revealed] : null
          return (
            <div
              style={{
                fontSize: 10,
                fontFamily: 'monospace',
                lineHeight: 1.5,
                opacity: 0.85,
              }}
            >
              <div>
                Group:{' '}
                <span style={{ color: '#818cf8' }}>
                  {cer.revealed}/{total}
                </span>
                {preRevealed > 0 && (
                  <span style={{ opacity: 0.5 }}> (+{preRevealed} pre-revealed)</span>
                )}
              </div>
              <div>
                Phase: <span style={{ color: '#86efac' }}>{phase}</span>
              </div>
              {currentEntry && (
                <div style={{ opacity: 0.6 }}>
                  Next: {currentEntry.layerKey} g{currentEntry.groupIndex} ({currentEntry.msDelay}
                  ms)
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* ── General controls (hidden in focus mode) ── */}
      {!ceremonyFocusMode && (
        <>
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <DebugCheckbox
              label="Construction music"
              checked={music.isPlaying}
              onChange={() => music.toggle()}
            />
            <DebugCheckbox
              label="Context debug"
              checked={showContextDebug}
              onChange={(v) => {
                setShowContextDebug(v)
                localStorage.setItem('euclid-show-context-debug', v ? '1' : '0')
              }}
            />
            <DebugCheckbox
              label="Macro preview auto-fit"
              checked={macroPreviewAutoFitRef.current}
              onChange={(v) => {
                macroPreviewAutoFitRef.current = v
              }}
            />
          </div>
          <DebugSlider
            label="Friction (β)"
            value={frictionCoeff}
            min={getFrictionRange().min}
            max={getFrictionRange().max}
            step={0.001}
            onChange={(v) => {
              setFrictionCoeff(v)
              setFriction(v)
            }}
            formatValue={(v) => v.toFixed(3)}
          />
          <DebugSlider
            label="Ghost opacity"
            value={ghostBaseOpacityVal}
            min={getGhostBaseOpacityRange().min}
            max={getGhostBaseOpacityRange().max}
            step={0.01}
            onChange={(v) => {
              setGhostBaseOpacityVal(v)
              setGhostBaseOpacity(v)
              needsDrawRef.current = true
            }}
            formatValue={(v) => v.toFixed(2)}
          />
          <DebugSlider
            label="Ghost depth falloff"
            value={ghostFalloffCoeff}
            min={getGhostFalloffRange().min}
            max={getGhostFalloffRange().max}
            step={0.01}
            onChange={(v) => {
              setGhostFalloffCoeff(v)
              setGhostFalloff(v)
              needsDrawRef.current = true
            }}
            formatValue={(v) => v.toFixed(2)}
          />
          {!isComplete && stepsLength > 0 && (
            <button
              data-action="auto-complete"
              onClick={() => setAutoCompleting(true)}
              disabled={autoCompleting}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: autoCompleting ? 'rgba(129,140,248,0.4)' : 'rgba(129,140,248,0.8)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                cursor: autoCompleting ? 'default' : 'pointer',
                opacity: autoCompleting ? 0.7 : 1,
              }}
            >
              {autoCompleting ? 'Completing…' : 'Complete Construction'}
            </button>
          )}
        </>
      )}
    </ToyDebugPanel>
  )
}
