import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { classroomKeys, entryPromptKeys, playerKeys } from '@/lib/queryKeys'
import {
  type ClassroomEventType,
  getInvalidationKeys,
  invalidateForEvent,
} from '../query-invalidations'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const C = 'classroom-1'
const P = 'player-1'

/** All event types that represent a change in enrollment state */
const ENROLLMENT_EVENTS: ClassroomEventType[] = ['enrollmentCompleted', 'studentUnenrolled']

/** All event types that represent a change in presence state */
const PRESENCE_EVENTS: ClassroomEventType[] = ['studentEntered', 'studentLeft', 'studentUnenrolled']

/** Every event type (for exhaustiveness checks) */
const ALL_EVENTS: ClassroomEventType[] = [
  'requestCreated',
  'requestApproved',
  'requestDenied',
  'enrollmentCompleted',
  'studentUnenrolled',
  'studentEntered',
  'studentLeft',
  'sessionStarted',
  'sessionEnded',
  'entryPromptCreated',
  'entryPromptAccepted',
  'entryPromptDeclined',
]

function keysAsStrings(keys: readonly (readonly string[])[]): string[][] {
  return keys.map((k) => [...k])
}

// ---------------------------------------------------------------------------
// Enrollment symmetry — the invariant that caused the original bug
// ---------------------------------------------------------------------------

describe('query-invalidations', () => {
  describe('enrollment events invalidate BOTH sides', () => {
    it.each(
      ENROLLMENT_EVENTS
    )('%s invalidates classroomKeys.enrollments when classroomId provided', (event) => {
      const keys = keysAsStrings(getInvalidationKeys(event, { classroomId: C, playerId: P }))
      expect(keys).toContainEqual([...classroomKeys.enrollments(C)])
    })

    it.each(
      ENROLLMENT_EVENTS
    )('%s invalidates playerKeys.enrolledClassrooms when playerId provided', (event) => {
      const keys = keysAsStrings(getInvalidationKeys(event, { classroomId: C, playerId: P }))
      expect(keys).toContainEqual([...playerKeys.enrolledClassrooms(P)])
    })
  })

  // ---------------------------------------------------------------------------
  // Presence symmetry
  // ---------------------------------------------------------------------------

  describe('presence events invalidate BOTH sides', () => {
    it.each(
      PRESENCE_EVENTS
    )('%s invalidates classroomKeys.presence when classroomId provided', (event) => {
      const keys = keysAsStrings(getInvalidationKeys(event, { classroomId: C, playerId: P }))
      expect(keys).toContainEqual([...classroomKeys.presence(C)])
    })

    it.each(
      PRESENCE_EVENTS
    )('%s invalidates playerKeys.presence when playerId provided', (event) => {
      const keys = keysAsStrings(getInvalidationKeys(event, { classroomId: C, playerId: P }))
      expect(keys).toContainEqual([...playerKeys.presence(P)])
    })
  })

  // ---------------------------------------------------------------------------
  // Specific event coverage
  // ---------------------------------------------------------------------------

  describe('enrollmentCompleted', () => {
    it('invalidates teacher enrollment list, pending requests, parent approvals, and student enrolled classrooms', () => {
      const keys = keysAsStrings(
        getInvalidationKeys('enrollmentCompleted', { classroomId: C, playerId: P })
      )
      expect(keys).toContainEqual([...classroomKeys.enrollments(C)])
      expect(keys).toContainEqual([...classroomKeys.pendingRequests(C)])
      expect(keys).toContainEqual([...classroomKeys.awaitingParentApproval(C)])
      expect(keys).toContainEqual([...playerKeys.enrolledClassrooms(P)])
      expect(keys).toContainEqual([...classroomKeys.pendingParentApprovals()])
    })

    it('invalidates the player list (which embeds enrolledClassrooms for count display)', () => {
      const keys = keysAsStrings(
        getInvalidationKeys('enrollmentCompleted', { classroomId: C, playerId: P })
      )
      expect(keys).toContainEqual([...playerKeys.listWithSkillData()])
    })
  })

  describe('studentUnenrolled', () => {
    it('invalidates enrollments, presence on both sides', () => {
      const keys = keysAsStrings(
        getInvalidationKeys('studentUnenrolled', { classroomId: C, playerId: P })
      )
      expect(keys).toContainEqual([...classroomKeys.enrollments(C)])
      expect(keys).toContainEqual([...classroomKeys.presence(C)])
      expect(keys).toContainEqual([...playerKeys.enrolledClassrooms(P)])
      expect(keys).toContainEqual([...playerKeys.presence(P)])
    })

    it('invalidates the player list (which embeds enrolledClassrooms for count display)', () => {
      const keys = keysAsStrings(
        getInvalidationKeys('studentUnenrolled', { classroomId: C, playerId: P })
      )
      expect(keys).toContainEqual([...playerKeys.listWithSkillData()])
    })
  })

  describe('requestCreated', () => {
    it('invalidates teacher pending lists and parent approvals', () => {
      const keys = keysAsStrings(getInvalidationKeys('requestCreated', { classroomId: C }))
      expect(keys).toContainEqual([...classroomKeys.pendingRequests(C)])
      expect(keys).toContainEqual([...classroomKeys.awaitingParentApproval(C)])
      expect(keys).toContainEqual([...classroomKeys.pendingParentApprovals()])
    })
  })

  describe('studentEntered / studentLeft', () => {
    it('studentEntered invalidates presence on both sides', () => {
      const keys = keysAsStrings(
        getInvalidationKeys('studentEntered', { classroomId: C, playerId: P })
      )
      expect(keys).toContainEqual([...classroomKeys.presence(C)])
      expect(keys).toContainEqual([...playerKeys.presence(P)])
    })

    it('studentLeft invalidates presence on both sides', () => {
      const keys = keysAsStrings(
        getInvalidationKeys('studentLeft', { classroomId: C, playerId: P })
      )
      expect(keys).toContainEqual([...classroomKeys.presence(C)])
      expect(keys).toContainEqual([...playerKeys.presence(P)])
    })
  })

  describe('session events', () => {
    it('sessionStarted invalidates active sessions', () => {
      const keys = keysAsStrings(getInvalidationKeys('sessionStarted', { classroomId: C }))
      expect(keys).toContainEqual([...classroomKeys.activeSessions(C)])
    })

    it('sessionEnded invalidates active sessions', () => {
      const keys = keysAsStrings(getInvalidationKeys('sessionEnded', { classroomId: C }))
      expect(keys).toContainEqual([...classroomKeys.activeSessions(C)])
    })
  })

  describe('entry prompt events', () => {
    it('entryPromptCreated invalidates pending prompts', () => {
      const keys = keysAsStrings(getInvalidationKeys('entryPromptCreated', {}))
      expect(keys).toContainEqual([...entryPromptKeys.pending()])
    })

    it('entryPromptAccepted invalidates pending prompts AND classroom presence', () => {
      const keys = keysAsStrings(getInvalidationKeys('entryPromptAccepted', { classroomId: C }))
      expect(keys).toContainEqual([...entryPromptKeys.pending()])
      expect(keys).toContainEqual([...classroomKeys.presence(C)])
    })

    it('entryPromptDeclined invalidates pending prompts only', () => {
      const keys = keysAsStrings(getInvalidationKeys('entryPromptDeclined', {}))
      expect(keys).toContainEqual([...entryPromptKeys.pending()])
      expect(keys).not.toContainEqual(expect.arrayContaining(['presence']))
    })
  })

  // ---------------------------------------------------------------------------
  // Graceful degradation — missing params should not crash
  // ---------------------------------------------------------------------------

  describe('missing params produce subset of keys (no crash)', () => {
    it.each(ALL_EVENTS)('%s with no params returns keys without crashing', (event) => {
      expect(() => getInvalidationKeys(event, {})).not.toThrow()
    })

    it('enrollmentCompleted without playerId still invalidates classroom side and player list', () => {
      const keys = keysAsStrings(getInvalidationKeys('enrollmentCompleted', { classroomId: C }))
      expect(keys).toContainEqual([...classroomKeys.enrollments(C)])
      // Per-player key should NOT be present since no playerId
      const perPlayerKeys = keys.filter(
        (k) => k[0] === 'players' && k.includes('enrolled-classrooms')
      )
      expect(perPlayerKeys).toHaveLength(0)
      // But the player list (which embeds enrollment data) should still be invalidated
      expect(keys).toContainEqual([...playerKeys.listWithSkillData()])
    })

    it('studentUnenrolled without classroomId still invalidates player side', () => {
      const keys = keysAsStrings(getInvalidationKeys('studentUnenrolled', { playerId: P }))
      expect(keys).toContainEqual([...playerKeys.enrolledClassrooms(P)])
      expect(keys).toContainEqual([...playerKeys.presence(P)])
      // Classroom side should NOT be present since no classroomId
      const classroomKeysInResult = keys.filter((k) => k[0] === 'classrooms')
      expect(classroomKeysInResult).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // invalidateForEvent matches getInvalidationKeys
  // ---------------------------------------------------------------------------

  describe('invalidateForEvent stays in sync with getInvalidationKeys', () => {
    it.each(
      ALL_EVENTS
    )('%s: invalidateForEvent calls invalidateQueries with exactly the keys from getInvalidationKeys', (event) => {
      const params = { classroomId: C, playerId: P }
      const expectedKeys = getInvalidationKeys(event, params)

      const queryClient = new QueryClient()
      const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()

      invalidateForEvent(queryClient, event, params)

      const calledKeys = spy.mock.calls.map((call) => {
        const opts = call[0] as { queryKey: readonly string[] }
        return [...opts.queryKey]
      })

      expect(calledKeys).toHaveLength(expectedKeys.length)
      for (const key of expectedKeys) {
        expect(calledKeys).toContainEqual([...key])
      }

      spy.mockRestore()
    })
  })
})
