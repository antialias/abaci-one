/**
 * Web fonts loaded via `next/font/google`.
 *
 * Inter is the workhorse for body and UI; Fraunces is the celebration display
 * face — a variable serif with `opsz` (optical sizing) and `SOFT` axes so we
 * can dial up softness on the public song-share page where the moment calls
 * for warmth, while keeping a stiffer/quieter posture elsewhere.
 *
 * Both expose CSS variables so Panda CSS tokens (panda.config.ts) can resolve
 * to them.
 */

import { Fraunces, Inter } from 'next/font/google'

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Variable build: weight is implicit (axis), so we pass `axes` for the extra
// SOFT + opsz dimensions rather than a `weight` array.
export const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  style: ['normal', 'italic'],
  axes: ['SOFT', 'opsz'],
})
