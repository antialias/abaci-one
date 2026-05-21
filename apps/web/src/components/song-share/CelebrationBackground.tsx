/**
 * Fixed-position decorative backdrop for the public song-share page.
 *
 * Two layers stacked behind the main content:
 *   1. A warm radial gradient (lavender → cream → blush) that hugs viewport
 *      corners so the page feels lit rather than flat.
 *   2. A sparse SVG constellation of soroban beads + musical notes at ~4%
 *      opacity to give texture without distracting from the player.
 *
 * `aria-hidden` because nothing here is content — the page is fully usable
 * with the layer disabled (the gradient survives as a CSS-only fallback).
 */

import { css } from '../../../styled-system/css'

export function CelebrationBackground() {
  return (
    <div
      aria-hidden="true"
      data-component="celebration-background"
      className={css({
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      })}
    >
      {/* Layer 1 — warm radial gradient base. */}
      <div
        className={css({
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(120% 80% at 10% -10%, #ede9fe 0%, transparent 60%), radial-gradient(100% 70% at 100% 110%, #ffedd5 0%, transparent 60%), linear-gradient(180deg, #fdf4ff 0%, #fff7ed 55%, #fef3c7 100%)',
        })}
      />

      {/* Layer 2 — constellation. SVG inlined so it ships zero asset cost. */}
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className={css({
          position: 'absolute',
          inset: 0,
          w: '100%',
          h: '100%',
          opacity: 0.05,
        })}
      >
        <defs>
          <g id="cb-bead">
            <ellipse cx="0" cy="0" rx="14" ry="9" fill="#7c3aed" />
            <ellipse cx="0" cy="-2" rx="10" ry="4" fill="#a78bfa" opacity="0.6" />
          </g>
          <g id="cb-note">
            <circle cx="0" cy="0" r="6" fill="#0f172a" />
            <rect x="5" y="-22" width="2" height="22" fill="#0f172a" />
            <path d="M 7 -22 Q 18 -18 14 -8" stroke="#0f172a" strokeWidth="2" fill="none" />
          </g>
          <g id="cb-diamond">
            <polygon points="0,-10 10,0 0,10 -10,0" fill="#fbbf24" />
          </g>
        </defs>

        {/* Beads scattered across the canvas. */}
        <use href="#cb-bead" x="80" y="120" />
        <use href="#cb-bead" x="380" y="60" />
        <use href="#cb-bead" x="1080" y="170" />
        <use href="#cb-bead" x="220" y="640" />
        <use href="#cb-bead" x="960" y="680" />
        <use href="#cb-bead" x="640" y="740" />

        {/* Musical notes. */}
        <use href="#cb-note" x="180" y="320" />
        <use href="#cb-note" x="980" y="380" transform="rotate(8 980 380)" />
        <use href="#cb-note" x="60" y="500" transform="rotate(-12 60 500)" />
        <use href="#cb-note" x="1100" y="560" />

        {/* Brand diamonds. */}
        <use href="#cb-diamond" x="500" y="180" />
        <use href="#cb-diamond" x="820" y="120" />
        <use href="#cb-diamond" x="340" y="500" />
        <use href="#cb-diamond" x="760" y="540" />
      </svg>
    </div>
  )
}
