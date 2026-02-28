import { describe, it, expect } from 'vitest'
import {
  getFoundationIdForCitation,
  getFoundationHref,
  getPropIdForCitation,
  getPropositionHref,
} from '../foundations/citationUtils'

describe('getFoundationIdForCitation', () => {
  it('maps definition citations', () => {
    expect(getFoundationIdForCitation('Def.1')).toBe('def-1')
    expect(getFoundationIdForCitation('Def.15')).toBe('def-15')
  })

  it('maps postulate citations', () => {
    expect(getFoundationIdForCitation('Post.1')).toBe('post-1')
    expect(getFoundationIdForCitation('Post.5')).toBe('post-5')
  })

  it('maps common notion citations', () => {
    expect(getFoundationIdForCitation('C.N.1')).toBe('cn-1')
    expect(getFoundationIdForCitation('C.N.3')).toBe('cn-3')
  })

  it('returns null for proposition citations', () => {
    expect(getFoundationIdForCitation('I.1')).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(getFoundationIdForCitation(null)).toBeNull()
    expect(getFoundationIdForCitation(undefined)).toBeNull()
  })

  it('returns null for unrecognized formats', () => {
    expect(getFoundationIdForCitation('random')).toBeNull()
    expect(getFoundationIdForCitation('')).toBeNull()
  })
})

describe('getFoundationHref', () => {
  it('returns href with focus param for foundations', () => {
    expect(getFoundationHref('Def.1')).toBe('/toys/euclid?focus=def-1')
    expect(getFoundationHref('Post.3')).toBe('/toys/euclid?focus=post-3')
    expect(getFoundationHref('C.N.2')).toBe('/toys/euclid?focus=cn-2')
  })

  it('returns null for propositions', () => {
    expect(getFoundationHref('I.1')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(getFoundationHref(null)).toBeNull()
  })
})

describe('getPropIdForCitation', () => {
  it('extracts proposition number', () => {
    expect(getPropIdForCitation('I.1')).toBe(1)
    expect(getPropIdForCitation('I.47')).toBe(47)
  })

  it('returns null for non-proposition citations', () => {
    expect(getPropIdForCitation('Def.1')).toBeNull()
    expect(getPropIdForCitation('Post.3')).toBeNull()
    expect(getPropIdForCitation('C.N.1')).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(getPropIdForCitation(null)).toBeNull()
    expect(getPropIdForCitation(undefined)).toBeNull()
  })
})

describe('getPropositionHref', () => {
  it('returns proposition page href', () => {
    expect(getPropositionHref('I.1')).toBe('/toys/euclid/1')
    expect(getPropositionHref('I.47')).toBe('/toys/euclid/47')
  })

  it('returns null for non-proposition citations', () => {
    expect(getPropositionHref('Def.1')).toBeNull()
  })

  it('returns null for null', () => {
    expect(getPropositionHref(null)).toBeNull()
  })
})
