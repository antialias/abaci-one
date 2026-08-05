'use client'

// DesignInspectorRail — the studio's LEFT docked rail (Gitea epic #5, full-bleed
// CP1a). "For whom, and the design details" live here, fabrication-neutral:
//   • a live 2D mini-preview of the current design (tracks every edit),
//   • the player picker + owner/identity chips (the shared identity both outputs
//     make real),
//   • the sync/save/reset controls (lifted out of the viewer overlay), and
//   • the Customize disclosure (design sliders/selects).
// The headline fabrication chooser (paper ↔ 3D print) does NOT live here anymore —
// it was promoted to the shell's persistent top toolbar (FabricationSwitch) so it
// reads on every breakpoint instead of hiding in the mobile drawer. This rail
// reads the shared studio store; the page owns only the ?player= URL, so it
// passes the picker's selection down.

import { AbacusReact } from '@soroban/abacus-react'
import { PlayerPicker } from '@/components/shared/PlayerPicker'
import { Disclosure } from '@/components/studio/Disclosure'
import { StudioSelect } from '@/components/studio/StudioSelect'
import { StudioTextInput } from '@/components/studio/StudioTextInput'
import { DebugCheckbox, DebugColor, DebugSlider } from '@/components/toys/ToyDebugPanel'
import {
  ABACUS_COLOR_PALETTES,
  ABACUS_COLOR_SCHEMES,
  type AbacusColorPalette,
  type AbacusColorScheme,
} from '@/lib/abacus/identity'
import { useAbacusStudio } from './AbacusStudioContext'
import {
  AID_OPTS,
  aidNote,
  BRIM_PRESETS,
  BUMPER_PRESETS,
  type BumperPreset,
  bumperLabel,
  bumperParams,
  bumperProud,
  type FeetFit,
  feetEffective,
  feetFit,
  isModular,
  matchBrim,
  matchBumper,
  placeAids,
  SLOT_LABEL,
  type TextSlot,
} from './abacus-model'
import { DesignLinkChip } from './DesignLinkChip'
import { MyDesignsList } from './MyDesignsList'

const SCHEME_LABEL: Record<string, string> = {
  monochrome: 'Monochrome',
  'place-value': 'Place-value colors',
  'heaven-earth': 'Heaven & earth colors',
  alternating: 'Alternating colors',
}
/** Sentinel rows for dimensions that match no preset — a design saved before
 *  the presets existed, or one hand-tuned through the params. Shown rather than
 *  silently snapped to the nearest preset, which would edit geometry the user
 *  never asked us to touch. */
const CUSTOM_BUMPER = '__custom_bumper__'
const CUSTOM_BRIM = '__custom_brim__'
/** The eight engravable slots, in the scad's own order. The four top-face rails
 *  carry a `slot` because a teaching aid can claim them; the four outer walls
 *  are words-only. Labelled so top-face left and wall left can't be confused. */
type WordKey = `${TextSlot}_text` | 'edge_front' | 'edge_back' | 'edge_left' | 'edge_right'
const WORD_FIELDS: { key: WordKey; label: string; slot?: TextSlot }[] = [
  { key: 'top_text', label: SLOT_LABEL.top, slot: 'top' },
  { key: 'bottom_text', label: SLOT_LABEL.bottom, slot: 'bottom' },
  { key: 'left_text', label: SLOT_LABEL.left, slot: 'left' },
  { key: 'right_text', label: SLOT_LABEL.right, slot: 'right' },
  { key: 'edge_front', label: 'front wall' },
  { key: 'edge_back', label: 'back wall' },
  { key: 'edge_left', label: 'left wall' },
  { key: 'edge_right', label: 'right wall' },
]
/** The word fields laid out ACROSS the column seams — they don't print on
 *  snap-together columns (textSlots gates them), so the rail says so instead of
 *  accepting words that would silently never appear. Mirror of the complement
 *  set MODULAR_TEXT_SLOT_INDICES in abacus-model. */
const CROSSING_WORD_KEYS: ReadonlySet<WordKey> = new Set([
  'top_text',
  'bottom_text',
  'edge_front',
  'edge_back',
])
/** A greyed row's own label has to carry both the reason and the lever — a
 *  <select> has nowhere else to put them. When neither lever reaches, say that
 *  outright rather than trailing an empty "needs". */
const unfitSuffix = (fit: FeetFit): string => {
  const levers = [
    fit.minBorderW ? `${fit.minBorderW.toFixed(1)} mm brim` : null,
    fit.minScale ? `size ×${fit.minScale.toFixed(2)}` : null,
  ].filter(Boolean)
  return levers.length ? ` — needs ${levers.join(' or ')}` : ' — too big for this frame'
}

export interface DesignInspectorRailProps {
  /** ?player= value (pre-fallback), for the picker + notice */
  selectedPlayerId: string | null
  onSelectPlayer: (playerId: string | null) => void
  /** the selected player's row failed to load → we're showing the user's own */
  playerUnavailable: boolean
  /** the ?design= snapshot failed to load (not shared with you / gone,
   *  Gitea #22 + #24) → the studio opened without it. The route answers one
   *  404 for every case on purpose, so the notice must not guess which. */
  designUnavailable?: boolean
  /** the link chip saved the design (Gitea #25) → the page mirrors the minted
   *  id into the ?design= URL */
  onDesignSaved: (designId: string) => void
}

export function DesignInspectorRail({
  selectedPlayerId,
  onSelectPlayer,
  playerUnavailable,
  designUnavailable = false,
  onDesignSaved,
}: DesignInspectorRailProps) {
  const {
    params,
    set,
    synced,
    resync,
    playerId,
    playerName,
    playerPossessive,
    canWriteIdentity,
    savableIdentity,
    saveAsPlayerAbacus,
    saveIsPending,
    saveIsError,
    savedDesignId,
  } = useAbacusStudio()

  // Where the teaching aids actually landed. Derived per render on purpose —
  // nothing is written back, so hydrating a saved design can't mutate it (see
  // placeAids). The selects show the stored intent; the labels and caption show
  // the outcome, which is the only way "automatic" stays honest.
  const placements = placeAids(params)
  const notes = placements.map((pl) => aidNote(params, pl)).filter((n): n is string => n !== null)

  const ownerLabel = playerUnavailable
    ? 'This is your abacus'
    : playerName
      ? `This is ${playerName}'s abacus`
      : selectedPlayerId
        ? 'This is their abacus'
        : 'This is your abacus'

  return (
    <div
      data-component="design-inspector-rail"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '16px',
        color: 'rgba(243,244,246,1)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>Your abacus</div>

      {/* live mini-preview — the identity, reflecting every design edit */}
      <div
        data-element="design-mini-preview"
        style={{
          display: 'flex',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 10,
          padding: '12px 8px',
          overflowX: 'auto',
        }}
      >
        <AbacusReact
          value={0}
          columns={params.cols}
          colorScheme={params.color_scheme as AbacusColorScheme}
          colorPalette={params.color_palette as AbacusColorPalette}
          scaleFactor={0.6}
          interactive={false}
          animated={false}
          showNumbers={false}
        />
      </div>

      {/* who this abacus is for + its identity chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PlayerPicker selectedPlayerId={selectedPlayerId} onSelect={onSelectPlayer} isDark />
        <span
          data-element="abacus-identity-owner"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'rgba(148,163,184,0.95)',
          }}
        >
          {ownerLabel}
        </span>
        {playerUnavailable && (
          <span
            data-element="abacus-identity-unavailable"
            style={{ fontSize: 11, color: 'rgba(148,163,184,0.95)' }}
          >
            Couldn't load that player's abacus — showing yours instead.
          </span>
        )}
        {designUnavailable && (
          <span
            data-element="abacus-design-unavailable"
            style={{ fontSize: 11, color: 'rgba(148,163,184,0.95)' }}
          >
            That design is private or no longer available — starting from the abacus instead. If
            it's yours, open it from the account that made it.
          </span>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span data-element="abacus-chip-columns" style={chipStyle}>
            {params.cols} columns
          </span>
          <span data-element="abacus-chip-colors" style={chipStyle}>
            {SCHEME_LABEL[params.color_scheme] ?? 'Custom colors'}
          </span>
        </div>
      </div>

      {/* sync/save/reset — lifted from the viewer overlay (identity concern) */}
      <div
        data-element="abacus-studio-sync-status"
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 11,
            color: synced ? 'rgba(134,239,172,0.95)' : 'rgba(252,211,77,0.95)',
          }}
        >
          <span>
            {synced
              ? `● showing ${playerId ? `${playerPossessive} abacus` : 'your abacus'}`
              : '● customized'}
          </span>
          {!synced && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {playerId && (
                <button
                  type="button"
                  data-action="save-as-player-abacus"
                  onClick={saveAsPlayerAbacus}
                  disabled={!canWriteIdentity || !savableIdentity || saveIsPending}
                  title={
                    canWriteIdentity
                      ? undefined
                      : `Only a parent — or a teacher while ${playerName ?? 'this student'} is in class — can change their abacus`
                  }
                  style={{
                    padding: '3px 8px',
                    borderRadius: 5,
                    border: '1px solid rgba(6,182,212,0.6)',
                    background: 'rgba(6,182,212,0.15)',
                    color: 'rgba(165,243,252,1)',
                    fontSize: 11,
                    cursor:
                      !canWriteIdentity || !savableIdentity || saveIsPending
                        ? 'default'
                        : 'pointer',
                    opacity: !canWriteIdentity || !savableIdentity ? 0.55 : 1,
                  }}
                >
                  {saveIsPending ? 'saving…' : `make this ${playerPossessive} abacus`}
                </button>
              )}
              <button
                type="button"
                data-action="reset-to-my-abacus"
                onClick={resync}
                style={{
                  padding: '3px 8px',
                  borderRadius: 5,
                  border: '1px solid rgba(148,163,184,0.5)',
                  background: 'transparent',
                  color: 'rgba(226,232,240,1)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                reset to {playerId ? `${playerPossessive} abacus` : 'my abacus'}
              </button>
            </div>
          )}
        </div>
        {saveIsError && (
          <span
            data-element="abacus-identity-save-error"
            style={{ fontSize: 11, color: 'rgba(252,165,165,0.95)' }}
          >
            Couldn't save — check your access and try again.
          </span>
        )}
      </div>

      {/* design link (Gitea #25) — adjacent to the identity save so the two
          save-ish acts read as one neighborhood, but a clearly different verb:
          the identity save is about a PERSON, this is about an ADDRESS */}
      <DesignLinkChip selectedPlayerId={selectedPlayerId} onDesignSaved={onDesignSaved} />

      {/* "My abacuses" (#11) — everything you've saved or printed, grown from
          #24's ledger of what you've made public. A sibling of the chip rather
          than a child of it: the chip is pure orchestration over a mocked
          context seam, and this fetches. Renders nothing until you have saved
          something. */}
      <MyDesignsList currentDesignId={savedDesignId} />

      {/* the fabrication chooser (paper ↔ 3D print) now lives in the shell's
          persistent top toolbar (FabricationSwitch), not here */}

      {/* design knobs, tucked behind progressive disclosure */}
      <Disclosure label="Customize" dataElement="abacus-studio-customize">
        <DebugSlider
          label="size ×"
          value={params.scale_factor}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(v) => set('scale_factor', v)}
          formatValue={(v) => v.toFixed(2)}
        />
        <DebugSlider
          label="columns"
          value={params.cols}
          min={3}
          max={21}
          step={1}
          onChange={(v) => set('cols', v)}
        />
        <DebugSlider
          label="fit gap (mm)"
          value={params.clearance}
          min={0.1}
          max={0.8}
          step={0.01}
          onChange={(v) => set('clearance', v)}
          formatValue={(v) => v.toFixed(2)}
        />
        <DebugSlider
          label="$fn (quality)"
          value={params.fn}
          min={8}
          max={64}
          step={1}
          onChange={(v) => set('fn', v)}
        />
        <StudioSelect
          label="color scheme"
          value={params.color_scheme}
          options={[...ABACUS_COLOR_SCHEMES]}
          onChange={(v) => set('color_scheme', v)}
        />
        <StudioSelect
          label="palette"
          value={params.color_palette}
          options={[...ABACUS_COLOR_PALETTES]}
          onChange={(v) => set('color_palette', v)}
        />
        {/* Writing (Gitea #28) — the eight engravable slots, and the two
            teaching aids that compete with them for the same rails.

            ONE RULE: one slot, one occupant; words win; the UI always names the
            occupant. An aid's rail is DERIVED, never stored (see placeAids), so
            the select shows the stored intent while the 'auto' option's label
            shows where automatic placement lands — "auto — left side". That label
            is present whatever the intent, deliberately: it's the only thing that
            keeps a hand-pinned "right side" from reading as the default.

            Below ~6 columns the top rail is too short for five facts and the side
            rails don't shrink with the column count, so 'auto' rotates the aids
            onto the sides — as a PAIR, mirrored, never one rotated and one
            horizontal. The caption says which rail and why. */}
        <Disclosure label="Writing" dataElement="abacus-writing" dataAction="toggle-writing">
          {placements.map((place) => (
            <StudioSelect
              key={place.aid.key}
              label={place.aid.label}
              value={place.intent}
              options={AID_OPTS.map((o) => ({
                value: o,
                label:
                  o === 'auto'
                    ? place.autoSlot
                      ? `auto — ${SLOT_LABEL[place.autoSlot]}`
                      : 'auto — nowhere free'
                    : o === 'off'
                      ? o
                      : SLOT_LABEL[o as TextSlot],
              }))}
              onChange={(v) => set(place.aid.key, v)}
              dataElement={`abacus-${place.aid.key}`}
              dataAction={`set-${place.aid.key}`}
            />
          ))}
          {notes.length > 0 && (
            <span
              data-element="abacus-writing-note"
              style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(148,163,184,0.95)' }}
            >
              {notes.join(' ')}
            </span>
          )}
          <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.7)' }}>
            your own words — space-separated, one word per engraving
          </span>
          {WORD_FIELDS.map(({ key, label, slot }) => {
            const held = slot ? placements.find((x) => x.slot === slot) : undefined
            // In modular mode a crossing slot can't also be aid-held (placeAids
            // filters those homes out), so the two reasons never compete.
            const crossing = isModular(params) && CROSSING_WORD_KEYS.has(key)
            return (
              <StudioTextInput
                key={key}
                label={label}
                value={params[key]}
                onChange={(v) => set(key, v)}
                disabled={held !== undefined || crossing}
                disabledReason={
                  held
                    ? `showing ${held.aid.label}`
                    : crossing
                      ? 'crosses the column seams — one-piece only'
                      : undefined
                }
                dataElement={`abacus-words-${key}`}
                dataAction={`set-${key}`}
              />
            )
          })}
        </Disclosure>
        {/* Inlay ink (Gitea #26): the writing prints as filament plugs pressed
            into its pockets, one 3MF body per color group. Rainbow costs up to
            five ink slots on the plate — one per group — so the choice belongs
            in front of the user, not buried in params. */}
        <StudioSelect
          label="text ink"
          value={params.text_fill}
          options={[
            { value: 'rainbow', label: 'rainbow (up to 5 filaments)' },
            { value: 'single', label: 'one color' },
          ]}
          onChange={(v) => set('text_fill', v)}
          dataElement="abacus-text-fill"
          dataAction="set-text-fill"
        />
        {params.text_fill === 'single' && (
          <DebugColor
            label="text color"
            value={params.text_color}
            onChange={(v) => set('text_color', v)}
          />
        )}
        <DebugCheckbox
          label="ArUco corner markers"
          checked={params.show_markers}
          onChange={(v) => set('show_markers', v)}
        />
        {/* Feet (Gitea #23): printed = in-place TPU feet, the default — the
            print stands on them and the bottom face rides supports; adhesive =
            today's empty dovetail pockets for stick-on bumpers; none. Retention
            only means anything for printed feet, so the second select follows
            the first conditionally. */}
        <StudioSelect
          label="feet"
          value={params.feet_mode}
          options={[
            { value: 'printed', label: 'printed TPU feet' },
            { value: 'adhesive', label: 'pockets for stick-on feet' },
            { value: 'none', label: 'no feet' },
          ]}
          onChange={(v) => set('feet_mode', v)}
          dataElement="abacus-feet-mode"
          dataAction="set-feet-mode"
        />
        {/* Stick-on bumpers are bought, not printed, so the menu is the range
            you can actually buy — labelled in the inches it's sold in, and
            converted to mm on the way into the model.

            Why some rows are greyed rather than absent: at every column the
            bead and end channels open through the bottom face, so a pocket can
            only live in the solid border strip. A 1/2" bumper wants 15.7 mm of
            a 13.0 mm strip at stock settings. Hiding those rows would claim we
            don't support the hardware; greying them with the number says "not
            at these settings" and names the two levers that fix it. Without
            this the scad's own assert() would throw mid-export instead. */}
        {params.feet_mode === 'adhesive' && (
          <>
            <StudioSelect
              label="stick-on bumper"
              value={matchBumper(params)?.id ?? CUSTOM_BUMPER}
              options={[
                ...(matchBumper(params)
                  ? []
                  : [{ value: CUSTOM_BUMPER, label: `custom — ${params.feet_w.toFixed(2)} mm` }]),
                ...BUMPER_PRESETS.map((b) => {
                  const fit = feetFit({ ...params, ...bumperParams(b) })
                  return {
                    value: b.id,
                    label: fit.fits ? bumperLabel(b) : `${bumperLabel(b)}${unfitSuffix(fit)}`,
                    disabled: !fit.fits,
                  }
                }),
              ]}
              onChange={(v) => {
                const b = BUMPER_PRESETS.find((x) => x.id === v)
                if (!b) return
                // one gesture, three params — the dimensions stay the single
                // source of truth and the menu selection is derived back off
                // them (matchBumper), so there's no preset id to fall out of
                // sync with the geometry.
                const q = bumperParams(b)
                set('feet_shape', q.feet_shape)
                set('feet_w', q.feet_w)
                set('feet_depth', q.feet_depth)
              }}
              dataElement="abacus-bumper-preset"
              dataAction="set-bumper-preset"
            />
            {/* The pocket takes half the bumper's thickness, so the rest is
                real ride height. Saying the number beats making them measure. */}
            {matchBumper(params) && (
              <p
                data-component="DesignInspectorRail"
                data-element="abacus-bumper-note"
                style={{
                  fontSize: 11,
                  color: 'rgba(148,163,184,0.95)',
                  lineHeight: 1.4,
                  margin: 0,
                }}
              >
                {params.feet_depth.toFixed(2)} mm pocket, so it stands{' '}
                {bumperProud(matchBumper(params) as BumperPreset).toFixed(2)} mm proud.
              </p>
            )}
          </>
        )}
        {/* The brim is the flush band around the bead field (border_w) — never
            had a control until now, so every abacus so far used stock 5.25 mm.
            It sits here rather than with the frame knobs because this is what
            it's for: it's half of what sets the border strip, and therefore
            what decides whether a big bumper can be seated at stock size at
            all. Millimetres, not inches — unlike the bumpers this is our
            geometry, not something sold by the fraction. */}
        <StudioSelect
          label="brim (border width)"
          value={matchBrim(params)?.id ?? CUSTOM_BRIM}
          options={[
            ...(matchBrim(params)
              ? []
              : [{ value: CUSTOM_BRIM, label: `custom — ${params.border_w.toFixed(2)} mm` }]),
            ...BRIM_PRESETS.map((b) => ({ value: b.id, label: b.label })),
          ]}
          onChange={(v) => {
            const b = BRIM_PRESETS.find((x) => x.id === v)
            if (b) set('border_w', b.border_w)
          }}
          dataElement="abacus-brim-preset"
          dataAction="set-brim-preset"
        />
        {params.feet_mode === 'printed' && (
          <>
            <StudioSelect
              label="feet retention"
              value={params.feet_retention}
              options={[
                { value: 'crossbar', label: 'linked crossbar (strongest)' },
                { value: 'dovetail', label: 'dovetail (friction fit)' },
              ]}
              onChange={(v) => set('feet_retention', v)}
              dataElement="abacus-feet-retention"
              dataAction="set-feet-retention"
            />
            {/* The bar is real-world sized but the frame it hides in scales, so a
                small enough abacus has nowhere to put it. Say so rather than
                letting the select claim retention the print won't have. */}
            {feetEffective(params).crossbarTooThin && (
              <p
                data-component="DesignInspectorRail"
                data-element="abacus-feet-crossbar-note"
                style={{ fontSize: 11, color: '#b45309', lineHeight: 1.4, margin: '2px 0 0' }}
              >
                At this size the frame is too thin to hide a crossbar — these feet use the dovetail
                flare. Raise size × to about 0.75 to get the linked bar back.
              </p>
            )}
          </>
        )}
        {/* Guards EVERY mode, not just the bumper menu. The width outlives the
            mode it was chosen in: pick a 1/2" bumper, switch to printed, and
            feet_w is still 12.7 mm — with a WIDER seat, since printed feet trade
            the fit gap for a 0.35 mm retention flare. The greyed menu rows can't
            catch that, and the alternative is the scad asserting mid-export.

            Two failures, two sentences: too wide is a plan-view problem (the
            seat vs the strip) and the brim can fix it; too deep is a section
            one (the pocket vs the slab) and only size can, because a bumper's
            thickness is real hardware that never scales. */}
        {(() => {
          const fit = params.feet_mode === 'none' ? null : feetFit(params)
          if (!fit || fit.fits) return null
          return (
            <p
              data-component="DesignInspectorRail"
              data-element="abacus-feet-fit-note"
              style={{ fontSize: 11, color: '#b45309', lineHeight: 1.4, margin: '2px 0 0' }}
            >
              {fit.tooWide
                ? `These feet are too wide to seat here: each pocket needs ${fit.needs.toFixed(1)} mm of the ${fit.has.toFixed(1)} mm border strip, so it would cut into the bead channels.`
                : `This pocket is too deep for the frame at this size: it needs ${fit.needsDepth.toFixed(1)} mm of the ${fit.hasDepth.toFixed(1)} mm slab to leave 2 mm of material above it.`}{' '}
              {fit.minBorderW ? `Widen the brim to ${fit.minBorderW.toFixed(1)} mm` : ''}
              {fit.minBorderW && fit.minScale ? ', or raise ' : fit.minScale ? 'Raise ' : ''}
              {fit.minScale ? `size × to ${fit.minScale.toFixed(2)}` : ''}
              {fit.minBorderW || fit.minScale ? '.' : 'Choose a smaller foot.'}
            </p>
          )
        })()}
      </Disclosure>
    </div>
  )
}

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(148,163,184,0.25)',
  fontSize: 11,
  fontWeight: 500,
  color: 'rgba(226,232,240,0.95)',
} as const
