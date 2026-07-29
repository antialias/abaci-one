/**
 * Deterministic, key-order-independent serialization — two objects that differ
 * only in property insertion order serialize identically. Shared by the print
 * idempotency signature (React re-renders that rebuild state objects must not
 * spuriously rotate the key) and the abacus design-snapshot content hash
 * (identical designs submitted twice must converge on one stored row).
 */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`
}
