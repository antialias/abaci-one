/**
 * Symmetric encryption-at-rest for small secrets (print-service bearer tokens,
 * webhook ring secrets). Server-only: uses node:crypto, keyed by SECRET_BOX_KEY.
 *
 * Sealed format (all segments base64url): `sb1:<iv>:<authTag>:<ciphertext>`
 * AES-256-GCM — authenticated, so tampering or a wrong key fails loudly on open.
 *
 * Key management: SECRET_BOX_KEY must decode to exactly 32 bytes
 * (`openssl rand -base64 32`). Rotating the key orphans everything sealed under
 * the old one — for print connections the recovery is simply re-pairing.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const VERSION = 'sb1'

function loadKey(): Buffer {
  const raw = process.env.SECRET_BOX_KEY
  if (!raw) {
    throw new Error('SECRET_BOX_KEY is not set — generate one with `openssl rand -base64 32`')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('SECRET_BOX_KEY must decode to exactly 32 bytes (`openssl rand -base64 32`)')
  }
  return key
}

/** Encrypt a UTF-8 string. Fresh random IV per call — sealing the same value twice yields different outputs. */
export function seal(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':')
}

/** Decrypt a sealed string. Throws on unknown format, wrong key, or tampered data — never returns garbage. */
export function open(sealed: string): string {
  const segments = sealed.split(':')
  // The ciphertext segment may be empty (GCM authenticates empty plaintext); iv and tag cannot.
  if (segments.length !== 4 || segments[0] !== VERSION || !segments[1] || !segments[2]) {
    throw new Error('secret-box: unrecognized sealed format')
  }
  const [, ivB64, tagB64, ctB64] = segments
  const decipher = createDecipheriv('aes-256-gcm', loadKey(), Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new Error('secret-box: decryption failed (wrong key or tampered data)')
  }
}
