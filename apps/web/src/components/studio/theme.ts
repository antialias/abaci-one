// theme.ts — the Abacus Studio's one source of colour, radius, spacing and type
// (Gitea #43, design "Proposed +" — the reference render is
// docs/mockups/studio-theme-c.html, skin `.plus`).
//
// Plain TS constants on purpose, not Panda tokens: every studio component is
// inline-styled (`style={{…}}`), and a token object lets those styles read
// `STUDIO.color.accent` instead of the 45-odd rgba literals a rail used to
// carry. A guard test (studio/__tests__/theme-guard.test.ts) fails the build
// the moment a studio file grows a colour literal that is not in this file.
//
// Three rules the values encode:
//   1. ONE accent. Cyan #06b6d4 everywhere a control is "on" — the slider
//      thumb, the checkbox, the active segment, the chosen option. The indigo
//      #818cf8 of the borrowed debug-panel controls is gone.
//   2. Labels ≥ values. A label is 12/500 muted above a 12 primary value; a
//      section header is a 10 px ruled eyebrow. The scale is 13/12/11/10;
//      the only 14 px in a rail is its heading (the guard bans every other
//      size outside the scale).
//   3. Notices tint, they don't box. A tone is a 3 px left bar on a ~0.2-alpha
//      wash — the outline boxes of the old warn/advisory panels are gone.

import type { CSSProperties } from 'react'

export type StudioTone = 'ok' | 'warn' | 'danger' | 'info'

const ACCENT = '#06b6d4'
const MUTED = 'rgba(148,163,184,0.95)'
const BORDER = 'rgba(148,163,184,0.18)'

export const STUDIO = {
  color: {
    /** page/canvas behind everything */
    bg: '#0b0f14',
    /** the two docked rails and the toolbar */
    rail: '#0f1419',
    /** cards, toggle rows, job rows */
    surface: 'rgba(255,255,255,0.035)',
    surfaceRaised: 'rgba(255,255,255,0.07)',
    surfaceBorder: 'rgba(148,163,184,0.16)',
    /** inputs: select, text, color swatch well */
    control: 'rgba(255,255,255,0.06)',
    controlBorder: 'rgba(148,163,184,0.22)',
    /** rules under eyebrows, between mapping groups, around cards */
    border: BORDER,
    borderStrong: 'rgba(148,163,184,0.35)',
    hairline: 'rgba(148,163,184,0.14)',
    /** slider track, unfilled */
    track: 'rgba(255,255,255,0.2)',
    /** neutral button fill/border (fix buttons, chips, secondary on a tint) */
    buttonFill: 'rgba(255,255,255,0.08)',
    buttonBorder: 'rgba(255,255,255,0.18)',
    /** primary/submit while disabled */
    disabledFill: 'rgba(255,255,255,0.05)',
    text: '#f3f4f6',
    text2: 'rgba(203,213,225,0.9)',
    muted: MUTED,
    muted2: 'rgba(148,163,184,0.85)',
    /** on-white text for gradient buttons / active segments */
    onAccent: '#fff',
    accent: ACCENT,
    accentSoft: 'rgba(6,182,212,0.12)',
    accentBorder: 'rgba(6,182,212,0.45)',
    accentFill: 'rgba(6,182,212,0.2)',
    accentBorderStrong: 'rgba(6,182,212,0.6)',
    accentText: '#67e8f9',
    /** near-white on an accent fill — the ON pill's text (mock-up `.trow.on .tb`) */
    accentTextStrong: 'rgba(207,250,254,0.98)',
    /** the halo around a slider thumb / focused control */
    accentRing: 'rgba(6,182,212,0.18)',
    /** resize-handle hover */
    accentHover: 'rgba(6,182,212,0.28)',
    /** the resize handle's grip dots — the only mark on the rail divider */
    grip: 'rgba(148,163,184,0.65)',
    tone: {
      ok: { text: 'rgba(134,239,172,0.95)', bg: 'rgba(6,78,59,0.20)', bar: 'rgba(52,211,153,0.9)' },
      warn: {
        text: 'rgba(254,243,199,0.96)',
        bg: 'rgba(120,53,15,0.22)',
        bar: 'rgba(251,191,36,0.9)',
      },
      danger: {
        text: 'rgba(254,226,226,0.96)',
        bg: 'rgba(127,29,29,0.22)',
        bar: 'rgba(248,113,113,0.9)',
      },
      info: {
        text: 'rgba(219,234,254,0.96)',
        bg: 'rgba(30,58,138,0.20)',
        bar: 'rgba(96,165,250,0.9)',
      },
    } satisfies Record<StudioTone, { text: string; bg: string; bar: string }>,
    /** inline (un-boxed) warning text, e.g. "fit is tight" beside a value */
    warnInline: 'rgba(251,191,36,0.92)',
    /** inline error text on a dark rail (schema failed to load, etc.) */
    dangerInline: 'rgba(252,165,165,0.95)',
    /** native <option> text — the popup is light on every platform */
    optionText: '#111',
    optionTextDisabled: '#888',
    /** the hero's glass chrome: the explode pill, the emphasis caption and the
     *  HUD float ON the 3D scene, so they need a translucent dark plate the
     *  rail's flat surfaces can't give (mock-up `.pill` / `.hud`). */
    canvas: {
      /** resting pill / caption plate */
      chrome: 'rgba(17,24,39,0.7)',
      /** the HUD's slightly denser plate (it carries mono text) */
      chromeStrong: 'rgba(17,24,39,0.82)',
      /** an engaged pill: darker and cooler, not the rail's accent wash */
      chromeOn: 'rgba(8,22,30,0.85)',
      /** an engaged pill's rim — cyan-300, brighter than a rail's accentBorder */
      chromeBorderOn: 'rgba(103,232,249,0.5)',
      /** an engaged pill's text */
      textOn: '#e6faff',
      /** a failed render in the HUD (mono, on the dark plate) */
      error: '#ff7b72',
    },
  },
  gradient: {
    accent: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  },
  shadow: {
    primary: '0 4px 14px rgba(6,182,212,0.35)',
    fab: '0 6px 20px rgba(6,182,212,0.45)',
    thumb: 'inset 0 0 0 2px rgba(255,255,255,0.6)',
    /** the glow under an engaged canvas pill (mock-up `.pill.on`) */
    canvasOn: '0 2px 14px rgba(6,182,212,0.22)',
  },
  radius: {
    panel: 12,
    card: 10,
    toggleRow: 10,
    segmented: 10,
    choice: 10,
    control: 8,
    button: 8,
    notice: 6,
    swatch: 6,
    pill: 999,
  },
  space: {
    /** between top-level sections in a rail */
    rail: 20,
    /** between the header and the fields of a section, and between fields */
    section: 14,
    /** label → control */
    field: 5,
    /** rows inside a card */
    card: 8,
  },
  type: {
    /** the rail's title ("Design", "Print") — the only 14 px in a rail */
    heading: { fontSize: 14, fontWeight: 700, color: '#f3f4f6' },
    /** a control's label, above or beside its value */
    label: { fontSize: 12, fontWeight: 500, color: MUTED },
    /** the value beside a label (slider readout, hex) */
    value: { fontSize: 12, color: '#f3f4f6', fontVariantNumeric: 'tabular-nums' },
    /** a control's OWN name rather than a caption for one: a choice option's
     *  title, a notice's title, a toggle row's label */
    strong: { fontSize: 12, fontWeight: 600, lineHeight: 1.3, color: '#f3f4f6' },
    /** explanatory copy under a control */
    note: { fontSize: 11, lineHeight: 1.45, color: MUTED },
    /** section header / card heading / mapping group label */
    eyebrow: {
      fontSize: 10,
      fontWeight: 600,
      lineHeight: 1.4,
      textTransform: 'uppercase',
      letterSpacing: '0.09em',
      color: MUTED,
    },
  },
} as const

// ---------------------------------------------------------------------------
// Style fragments — spread these; do not re-derive them per file.

/** A section header: eyebrow type on a full-width hairline rule. */
export const EYEBROW_RULED: CSSProperties = {
  ...STUDIO.type.eyebrow,
  padding: '6px 0',
  borderBottom: `1px solid ${STUDIO.color.border}`,
}

/** An input's box: select, text input, the color well. ≈32 px tall. */
export const CONTROL: CSSProperties = {
  background: STUDIO.color.control,
  border: `1px solid ${STUDIO.color.controlBorder}`,
  borderRadius: STUDIO.radius.control,
  padding: '8px 10px',
  fontSize: 12,
  color: STUDIO.color.text,
}

/** A card: commitment card, the print-plate preview frame. */
export const CARD: CSSProperties = {
  background: STUDIO.color.surface,
  border: `1px solid ${STUDIO.color.surfaceBorder}`,
  borderRadius: STUDIO.radius.card,
  padding: '12px 14px',
}

/** A toggle row (slow first layer, two-stage): surface when off, accent when on. */
export function toggleRow(on: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '10px 12px',
    borderRadius: STUDIO.radius.toggleRow,
    background: on ? STUDIO.color.accentSoft : STUDIO.color.surface,
    border: `1px solid ${on ? STUDIO.color.accentBorder : STUDIO.color.surfaceBorder}`,
  }
}

/** A notice: 3 px tone bar on a tone wash, no outline. */
export function notice(tone: StudioTone): CSSProperties {
  const t = STUDIO.color.tone[tone]
  return {
    borderLeft: `3px solid ${t.bar}`,
    background: t.bg,
    color: t.text,
    borderRadius: STUDIO.radius.notice,
    padding: '8px 10px 8px 12px',
    fontSize: 12,
    lineHeight: 1.5,
  }
}

export type StudioButtonKind = 'primary' | 'secondary' | 'chip' | 'fix' | 'pill' | 'danger'

/**
 * The studio's buttons. `primary` is the ONE gradient+shadow style (submit,
 * download, print the coupon); `secondary` is the transparent bordered
 * action; `chip` is the small pill (copy link, share); `fix` is the neutral
 * button inside a notice; `pill` is the on/off button in a toggle row.
 */
export function button(kind: StudioButtonKind, opts: { disabled?: boolean; on?: boolean } = {}) {
  const base: CSSProperties = {
    fontWeight: 600,
    cursor: opts.disabled ? 'not-allowed' : 'pointer',
    color: STUDIO.color.text,
    fontSize: 12,
  }
  switch (kind) {
    case 'primary':
      return opts.disabled
        ? {
            ...base,
            fontWeight: 700,
            padding: 12,
            borderRadius: STUDIO.radius.card,
            background: STUDIO.color.disabledFill,
            border: `1px solid ${STUDIO.color.border}`,
            color: STUDIO.color.muted,
            fontSize: 13,
          }
        : {
            ...base,
            fontWeight: 700,
            padding: 12,
            borderRadius: STUDIO.radius.card,
            background: STUDIO.gradient.accent,
            border: 'none',
            color: STUDIO.color.onAccent,
            boxShadow: STUDIO.shadow.primary,
            fontSize: 13,
          }
    case 'secondary':
      return {
        ...base,
        padding: '10px 12px',
        borderRadius: STUDIO.radius.button,
        background: 'transparent',
        border: `1px solid ${STUDIO.color.borderStrong}`,
        opacity: opts.disabled ? 0.55 : 1,
      }
    case 'chip':
      return {
        ...base,
        fontSize: 11,
        padding: '4px 10px',
        borderRadius: STUDIO.radius.pill,
        background: STUDIO.color.buttonFill,
        border: `1px solid ${STUDIO.color.buttonBorder}`,
        opacity: opts.disabled ? 0.55 : 1,
      }
    case 'fix':
      return {
        ...base,
        fontSize: 11,
        padding: '5px 9px',
        borderRadius: STUDIO.radius.notice,
        background: STUDIO.color.buttonFill,
        border: `1px solid ${STUDIO.color.buttonBorder}`,
        color: 'inherit',
        opacity: opts.disabled ? 0.55 : 1,
      }
    case 'pill':
      return {
        ...base,
        fontWeight: 700,
        fontSize: 11,
        padding: '6px 12px',
        borderRadius: STUDIO.radius.pill,
        background: opts.on ? STUDIO.color.accentFill : STUDIO.color.control,
        border: `1px solid ${opts.on ? STUDIO.color.accentBorderStrong : STUDIO.color.borderStrong}`,
        color: opts.on ? STUDIO.color.accentTextStrong : STUDIO.color.text2,
        opacity: opts.disabled ? 0.55 : 1,
      }
    // the one destructive action in the studio (stop a running print): a
    // secondary's shape in the danger tone, so it never reads as "just another
    // button" and never competes with the primary
    case 'danger':
      return {
        ...base,
        fontWeight: 700,
        padding: '10px 12px',
        borderRadius: STUDIO.radius.button,
        background: STUDIO.color.tone.danger.bg,
        border: `1px solid ${STUDIO.color.tone.danger.bar}`,
        color: STUDIO.color.tone.danger.text,
        opacity: opts.disabled ? 0.55 : 1,
      }
  }
}
