import type { TicketProcessValue, TicketStyle } from '@eink/print-dialog'

/**
 * Runtime guard for a persisted TicketStyle — the print-settings overlay the
 * user tunes in the print dialog (base preset name + sparse process
 * overrides). `@eink/print-dialog` exports the TYPE but no runtime validator,
 * and the overlay round-trips through a DB text column, so writes are gated
 * here. Returns null on anything that isn't a structurally valid TicketStyle;
 * semantic validity against a capability doc (unknown preset, out-of-range
 * value) is the service's call at submit time, not ours.
 */

function isScalar(v: unknown): v is number | boolean | string {
  return (
    (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean' || typeof v === 'string'
  )
}

function isProcessValue(v: unknown): v is TicketProcessValue {
  return isScalar(v) || (Array.isArray(v) && v.length > 0 && v.every(isScalar))
}

export function parseTicketStyle(input: unknown): TicketStyle | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null
  const { basePreset, process } = input as { basePreset?: unknown; process?: unknown }

  if (typeof basePreset !== 'string' || basePreset.length === 0) return null
  if (typeof process !== 'object' || process === null || Array.isArray(process)) return null

  const entries = Object.entries(process as Record<string, unknown>)
  if (!entries.every(([, v]) => isProcessValue(v))) return null

  return {
    basePreset,
    process: Object.fromEntries(entries) as Readonly<Record<string, TicketProcessValue>>,
  }
}
