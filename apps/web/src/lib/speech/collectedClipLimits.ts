/**
 * Lives outside the route file: a Next.js route module may export only its
 * handlers and route settings, so `next build` refuses any other export.
 */
import { MAX_SPEECH_CHARS } from './model'

/**
 * Bounds on one flush, so a guest can't write unbounded junk per request.
 * Real flushes sit far inside them: the client sends every clip played since
 * page load, usually by sendBeacon, which caps the body at 64 KB (about 1,000
 * of the smallest entries). In prod the longest say text is 705 characters,
 * tone 333, clip id 195, and every row's locale is `en`.
 */
export const FLUSH_LIMITS = {
  clips: 1000,
  /** Longer can't be spoken (the door's limit), so it's never a real clip. */
  textChars: MAX_SPEECH_CHARS,
  toneChars: 1000,
  clipIdChars: 1000,
  localesPerClip: 8,
  localeChars: 35,
} as const
