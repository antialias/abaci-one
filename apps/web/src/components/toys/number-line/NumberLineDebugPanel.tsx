import { useState, useCallback, useMemo } from 'react'
import type { MutableRefObject } from 'react'
import type { TickThresholds } from './types'
import { DEFAULT_TICK_THRESHOLDS } from './types'
import { ToyDebugPanel, DebugSlider } from '../ToyDebugPanel'
import {
  NUM_LEVELS,
  setStepTimingDecay,
  getStepTimingDecay,
  arcCountAtProgress,
} from './constants/demos/goldenRatioDemo'
import { scrubberToProgress, getScrubberLogBase, setScrubberLogBase } from './syncDemoScrubberDOM'
import {
  getSieveTrackingRange,
  setSieveTrackingRange,
  getSieveFollowHops,
  setSieveFollowHops,
} from './primes/renderSieveOverlay'
import { getSieveSpeed, setSieveSpeed } from './primes/usePrimeTour'
import type { usePhiCenteringMode } from './constants/demos/usePhiCenteringMode'

interface NumberLineDebugPanelProps {
  thresholdsRef: MutableRefObject<TickThresholds>
  scheduleRedraw: () => void
  constantsEnabled: boolean
  setConstantsEnabled: (v: boolean) => void
  primesEnabled: boolean
  setPrimesEnabled: (v: boolean) => void
  centering: ReturnType<typeof usePhiCenteringMode>
  resolvedTheme: string
}

export function NumberLineDebugPanel({
  thresholdsRef,
  scheduleRedraw,
  constantsEnabled,
  setConstantsEnabled,
  primesEnabled,
  setPrimesEnabled,
  centering,
  resolvedTheme,
}: NumberLineDebugPanelProps) {
  const [anchorMax, setAnchorMax] = useState(DEFAULT_TICK_THRESHOLDS.anchorMax)
  const [mediumMax, setMediumMax] = useState(DEFAULT_TICK_THRESHOLDS.mediumMax)
  const [debugDecay, setDebugDecay] = useState(getStepTimingDecay)
  const [debugLogBase, setDebugLogBase] = useState(getScrubberLogBase)
  const [debugTrackingRange, setDebugTrackingRange] = useState(getSieveTrackingRange)
  const [debugFollowHops, setDebugFollowHops] = useState(getSieveFollowHops)
  const [debugSieveSpeed, setDebugSieveSpeed] = useState(getSieveSpeed)

  const arcReadout = useMemo(() => {
    const p50 = scrubberToProgress(0.5)
    const p75 = scrubberToProgress(0.75)
    return { at50: arcCountAtProgress(p50), at75: arcCountAtProgress(p75) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugDecay, debugLogBase])

  // Sync thresholds ref when local state changes
  thresholdsRef.current = { anchorMax, mediumMax }

  const handleDecayChange = useCallback(
    (v: number) => {
      setDebugDecay(v)
      setStepTimingDecay(v)
      scheduleRedraw()
    },
    [scheduleRedraw]
  )

  const handleLogBaseChange = useCallback(
    (v: number) => {
      setDebugLogBase(v)
      setScrubberLogBase(v)
      scheduleRedraw()
    },
    [scheduleRedraw]
  )

  const handleTrackingRangeChange = useCallback(
    (v: number) => {
      setDebugTrackingRange(v)
      setSieveTrackingRange(v)
      scheduleRedraw()
    },
    [scheduleRedraw]
  )

  const handleFollowHopsChange = useCallback(
    (v: number) => {
      setDebugFollowHops(v)
      setSieveFollowHops(v)
      scheduleRedraw()
    },
    [scheduleRedraw]
  )

  const handleSieveSpeedChange = useCallback(
    (v: number) => {
      setDebugSieveSpeed(v)
      setSieveSpeed(v)
      scheduleRedraw()
    },
    [scheduleRedraw]
  )

  return (
    <ToyDebugPanel title="Number Line">
      <DebugSlider
        label="Anchor max"
        value={anchorMax}
        min={1}
        max={20}
        step={1}
        onChange={(v: number) => {
          setAnchorMax(v)
          scheduleRedraw()
        }}
      />
      <DebugSlider
        label="Medium max"
        value={mediumMax}
        min={5}
        max={50}
        step={1}
        onChange={(v: number) => {
          setMediumMax(v)
          scheduleRedraw()
        }}
      />
      <label
        data-element="constants-toggle"
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
      >
        <input
          type="checkbox"
          checked={constantsEnabled}
          onChange={(e) => setConstantsEnabled(e.target.checked)}
        />
        Math Constants
      </label>
      <label
        data-element="primes-toggle"
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
      >
        <input
          type="checkbox"
          checked={primesEnabled}
          onChange={(e) => {
            setPrimesEnabled(e.target.checked)
            scheduleRedraw()
          }}
        />
        Primes (Sieve)
      </label>
      <div
        data-element="phi-tuning-section"
        style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 2 }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            opacity: 0.5,
            marginBottom: 6,
          }}
        >
          φ Scrubber Tuning
        </div>
        <DebugSlider
          label="Step decay"
          value={debugDecay}
          min={0.8}
          max={0.99}
          step={0.005}
          onChange={handleDecayChange}
          formatValue={(v: number) => v.toFixed(3)}
        />
        <DebugSlider
          label="Scrubber log base"
          value={debugLogBase}
          min={1}
          max={32}
          step={0.5}
          onChange={handleLogBaseChange}
          formatValue={(v: number) => v.toFixed(1)}
        />
        <div
          style={{
            fontSize: 10,
            opacity: 0.6,
            fontVariantNumeric: 'tabular-nums',
            marginTop: 2,
          }}
        >
          50% → {arcReadout.at50} arcs · 75% → {arcReadout.at75} arcs · total {NUM_LEVELS}
        </div>
      </div>
      <div
        data-element="phi-centering-section"
        style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 2 }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            opacity: 0.5,
            marginBottom: 6,
          }}
        >
          Phi Image Centering
        </div>
        <label
          data-element="centering-toggle"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          <input
            type="checkbox"
            checked={centering.enabled}
            onChange={(e) => centering.setEnabled(e.target.checked)}
          />
          Enable Centering
        </label>
        {centering.enabled && (
          <>
            <div
              data-element="centering-subject"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                marginTop: 4,
              }}
            >
              <span style={{ opacity: 0.7, minWidth: 50 }}>Subject:</span>
              <button
                data-action="centering-prev-subject"
                onClick={centering.prevSubject}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'inherit',
                  borderRadius: 4,
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                ◀
              </button>
              <span style={{ flex: 1, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {centering.subjectId}
              </span>
              <button
                data-action="centering-next-subject"
                onClick={centering.nextSubject}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'inherit',
                  borderRadius: 4,
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                ▶
              </button>
            </div>
            <div
              data-element="centering-theme"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                marginTop: 4,
              }}
            >
              <span style={{ opacity: 0.7, minWidth: 50 }}>Theme:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <input
                  type="radio"
                  name="centering-theme"
                  checked={centering.theme === 'light'}
                  onChange={() => centering.setTheme('light')}
                />
                light
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <input
                  type="radio"
                  name="centering-theme"
                  checked={centering.theme === 'dark'}
                  onChange={() => centering.setTheme('dark')}
                />
                dark
              </label>
            </div>
            <DebugSlider
              label="Scale"
              value={centering.alignment.scale}
              min={0.1}
              max={3}
              step={0.01}
              onChange={(v: number) => centering.updateAlignment({ scale: v })}
              formatValue={(v: number) => v.toFixed(3)}
            />
            <DebugSlider
              label="Rotation"
              value={centering.alignment.rotation}
              min={-720}
              max={720}
              step={0.5}
              onChange={(v: number) => centering.updateAlignment({ rotation: v })}
              formatValue={(v: number) => `${v.toFixed(1)}°`}
            />
            <DebugSlider
              label="Offset X"
              value={centering.alignment.offsetX}
              min={-1}
              max={1}
              step={0.001}
              onChange={(v: number) => centering.updateAlignment({ offsetX: v })}
              formatValue={(v: number) => v.toFixed(3)}
            />
            <DebugSlider
              label="Offset Y"
              value={centering.alignment.offsetY}
              min={-1}
              max={1}
              step={0.001}
              onChange={(v: number) => centering.updateAlignment({ offsetY: v })}
              formatValue={(v: number) => v.toFixed(3)}
            />
            <div data-element="centering-actions" style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                data-action="centering-reset"
                onClick={centering.resetAlignment}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'inherit',
                  borderRadius: 4,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                Reset
              </button>
              <span style={{ fontSize: 10, opacity: 0.6, display: 'flex', alignItems: 'center' }}>
                {centering.saving ? 'Saving...' : centering.dirty ? 'Unsaved' : 'Saved'}
              </span>
            </div>
            <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>
              Drag=move · Shift+drag=rotate · Scroll=scale
            </div>
          </>
        )}
      </div>
      <div
        data-element="sieve-tuning-section"
        style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 2 }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            opacity: 0.5,
            marginBottom: 6,
          }}
        >
          Sieve Tuning
        </div>
        <DebugSlider
          label="Tracking range"
          value={debugTrackingRange}
          min={5}
          max={60}
          step={1}
          onChange={handleTrackingRangeChange}
          formatValue={(v: number) => `${v} ints`}
        />
        <DebugSlider
          label="Follow hops"
          value={debugFollowHops}
          min={1}
          max={40}
          step={1}
          onChange={handleFollowHopsChange}
        />
        <DebugSlider
          label="Speed"
          value={debugSieveSpeed}
          min={0.25}
          max={4}
          step={0.25}
          onChange={handleSieveSpeedChange}
          formatValue={(v: number) => `${v}x`}
        />
      </div>
    </ToyDebugPanel>
  )
}
