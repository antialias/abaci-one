/**
 * Arithmetic's browser half (practice-kinds plan §1.3, K9), as far as K3
 * needs it: its optimistic check (amendment A11), the same comparison the
 * server's `judge` makes and the screen has always shown at once
 * (`ActiveSession`'s `answerNum === problem.answer`). Display only. K5 adds
 * the views here (`browser.tsx`) and moves the screen onto it.
 *
 * Client-safe.
 */

import type { BrowserKind } from '../browser-kind'
import type { ArithmeticItem } from './state'

export const arithmeticBrowserKind: BrowserKind<ArithmeticItem, number> = {
  id: 'arithmetic',
  check: (item, answer) => item.problem !== undefined && answer === item.problem.answer,
}
