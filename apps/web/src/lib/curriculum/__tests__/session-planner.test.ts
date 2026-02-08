/**
 * @vitest-environment node
 *
 * Session Planner Tests
 *
 * Tests for exported classes and pure functions from session-planner.ts.
 * Most session-planner functions are async and DB-dependent; those are tested
 * in integration tests. Here we test the exported Error classes and
 * validate the module structure.
 */

import { describe, expect, it } from 'vitest'
import {
  ActiveSessionExistsError,
  NoSkillsEnabledError,
} from '@/lib/curriculum/session-planner'

// =============================================================================
// ActiveSessionExistsError
// =============================================================================

describe('ActiveSessionExistsError', () => {
  it('has the correct name', () => {
    const err = new ActiveSessionExistsError({} as any)
    expect(err.name).toBe('ActiveSessionExistsError')
  })

  it('has the correct error code', () => {
    const err = new ActiveSessionExistsError({} as any)
    expect(err.code).toBe('ACTIVE_SESSION_EXISTS')
  })

  it('has the expected message', () => {
    const err = new ActiveSessionExistsError({} as any)
    expect(err.message).toBe('An active session already exists for this player')
  })

  it('stores the existing session', () => {
    const mockSession = { id: 'session-123', status: 'in_progress' } as any
    const err = new ActiveSessionExistsError(mockSession)
    expect(err.existingSession).toBe(mockSession)
    expect(err.existingSession.id).toBe('session-123')
  })

  it('is an instance of Error', () => {
    const err = new ActiveSessionExistsError({} as any)
    expect(err).toBeInstanceOf(Error)
  })

  it('is an instance of ActiveSessionExistsError', () => {
    const err = new ActiveSessionExistsError({} as any)
    expect(err).toBeInstanceOf(ActiveSessionExistsError)
  })

  it('can be caught in a try/catch block', () => {
    try {
      throw new ActiveSessionExistsError({ id: 'test' } as any)
    } catch (err) {
      expect(err).toBeInstanceOf(ActiveSessionExistsError)
      if (err instanceof ActiveSessionExistsError) {
        expect(err.code).toBe('ACTIVE_SESSION_EXISTS')
        expect(err.existingSession.id).toBe('test')
      }
    }
  })
})

// =============================================================================
// NoSkillsEnabledError
// =============================================================================

describe('NoSkillsEnabledError', () => {
  it('has the correct name', () => {
    const err = new NoSkillsEnabledError()
    expect(err.name).toBe('NoSkillsEnabledError')
  })

  it('has the correct error code', () => {
    const err = new NoSkillsEnabledError()
    expect(err.code).toBe('NO_SKILLS_ENABLED')
  })

  it('has a descriptive message', () => {
    const err = new NoSkillsEnabledError()
    expect(err.message).toContain('no skills are enabled')
    expect(err.message).toContain('skill selector')
  })

  it('is an instance of Error', () => {
    const err = new NoSkillsEnabledError()
    expect(err).toBeInstanceOf(Error)
  })

  it('is an instance of NoSkillsEnabledError', () => {
    const err = new NoSkillsEnabledError()
    expect(err).toBeInstanceOf(NoSkillsEnabledError)
  })

  it('can be caught and discriminated by code property', () => {
    try {
      throw new NoSkillsEnabledError()
    } catch (err: any) {
      expect(err.code).toBe('NO_SKILLS_ENABLED')
    }
  })
})
