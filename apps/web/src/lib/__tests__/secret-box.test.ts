import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'
import { seal, open } from '../secret-box'

const KEY = randomBytes(32).toString('base64')

describe('secret-box', () => {
  let savedKey: string | undefined

  beforeEach(() => {
    savedKey = process.env.SECRET_BOX_KEY
    process.env.SECRET_BOX_KEY = KEY
  })

  afterEach(() => {
    if (savedKey === undefined) delete process.env.SECRET_BOX_KEY
    else process.env.SECRET_BOX_KEY = savedKey
  })

  it('round-trips a value', () => {
    const sealed = seal('thh-bearer-token-value')
    expect(sealed).toMatch(/^sb1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/)
    expect(open(sealed)).toBe('thh-bearer-token-value')
  })

  it('round-trips empty and unicode strings', () => {
    expect(open(seal(''))).toBe('')
    expect(open(seal('héllo 🧮'))).toBe('héllo 🧮')
  })

  it('produces distinct sealed outputs for the same plaintext (fresh IV)', () => {
    expect(seal('same')).not.toBe(seal('same'))
  })

  it('throws on tampered ciphertext', () => {
    const sealed = seal('secret')
    const parts = sealed.split(':')
    // flip a character in the ciphertext segment
    const ct = parts[3]
    parts[3] = (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1)
    expect(() => open(parts.join(':'))).toThrow(/decryption failed/)
  })

  it('throws on tampered auth tag', () => {
    const sealed = seal('secret')
    const parts = sealed.split(':')
    const tag = parts[2]
    parts[2] = (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1)
    expect(() => open(parts.join(':'))).toThrow(/decryption failed/)
  })

  it('throws when opened under a different key', () => {
    const sealed = seal('secret')
    process.env.SECRET_BOX_KEY = randomBytes(32).toString('base64')
    expect(() => open(sealed)).toThrow(/decryption failed/)
  })

  it('rejects unrecognized formats', () => {
    expect(() => open('not-sealed')).toThrow(/unrecognized sealed format/)
    expect(() => open('sb2:a:b:c')).toThrow(/unrecognized sealed format/)
    expect(() => open('sb1:a:b')).toThrow(/unrecognized sealed format/)
    expect(() => open('sb1::b:c')).toThrow(/unrecognized sealed format/)
  })

  it('throws loudly when the key is missing', () => {
    delete process.env.SECRET_BOX_KEY
    expect(() => seal('x')).toThrow(/SECRET_BOX_KEY is not set/)
  })

  it('throws loudly when the key is not 32 bytes', () => {
    process.env.SECRET_BOX_KEY = randomBytes(16).toString('base64')
    expect(() => seal('x')).toThrow(/exactly 32 bytes/)
  })
})
