/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { trustedClientAddress } from '../requestIdentity'

describe('trustedClientAddress', () => {
  const h = (xff?: string) => new Headers(xff === undefined ? {} : { 'x-forwarded-for': xff })

  it('takes the hop the proxy in front of the pod appended (rightmost)', () => {
    expect(trustedClientAddress(h('10.42.0.1'))).toBe('10.42.0.1')
    expect(trustedClientAddress(h('1.2.3.4, 6.6.6.6 , 10.42.0.1'))).toBe('10.42.0.1')
  })

  it('is null with no proxy (dev)', () => {
    expect(trustedClientAddress(h())).toBeNull()
    expect(trustedClientAddress(h(' , '))).toBeNull()
  })
})
