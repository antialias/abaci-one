/**
 * Tests that game break socket event types are properly defined and registered
 * in both server-to-client and client-to-server event maps.
 */
import { describe, expect, it } from 'vitest'
import type {
  ClassroomClientToServerEvents,
  ClassroomServerToClientEvents,
  GameBreakStartedEvent,
  GameBreakPhaseEvent,
  GameBreakEndedEvent,
} from '../socket-events'

describe('game break socket event types', () => {
  describe('GameBreakStartedEvent', () => {
    it('has required fields', () => {
      const event: GameBreakStartedEvent = {
        sessionId: 'session-123',
        roomId: 'room-abc',
        gameName: 'Memory Match',
        gameId: 'matching',
      }

      expect(event.sessionId).toBe('session-123')
      expect(event.roomId).toBe('room-abc')
      expect(event.gameName).toBe('Memory Match')
      expect(event.gameId).toBe('matching')
    })
  })

  describe('GameBreakPhaseEvent', () => {
    it('accepts all valid phases', () => {
      const phases: GameBreakPhaseEvent['phase'][] = ['selecting', 'playing', 'completed']

      for (const phase of phases) {
        const event: GameBreakPhaseEvent = {
          sessionId: 'session-123',
          roomId: 'room-abc',
          phase,
        }
        expect(event.phase).toBe(phase)
      }
    })
  })

  describe('GameBreakEndedEvent', () => {
    it('accepts all valid reasons', () => {
      const reasons: GameBreakEndedEvent['reason'][] = ['gameFinished', 'timeout', 'skipped']

      for (const reason of reasons) {
        const event: GameBreakEndedEvent = {
          sessionId: 'session-123',
          roomId: 'room-abc',
          reason,
        }
        expect(event.reason).toBe(reason)
      }
    })

    it('accepts optional summary', () => {
      const withSummary: GameBreakEndedEvent = {
        sessionId: 'session-123',
        roomId: 'room-abc',
        reason: 'gameFinished',
        summary: { gameName: 'Memory Match', headline: 'Perfect!' },
      }
      expect(withSummary.summary?.gameName).toBe('Memory Match')
      expect(withSummary.summary?.headline).toBe('Perfect!')

      const withoutSummary: GameBreakEndedEvent = {
        sessionId: 'session-123',
        roomId: 'room-abc',
        reason: 'timeout',
      }
      expect(withoutSummary.summary).toBeUndefined()
    })
  })

  describe('event map registration', () => {
    it('server-to-client events include all game break events', () => {
      // TypeScript compile-time check — if these types don't exist in the map, this won't compile
      type HasStarted = ClassroomServerToClientEvents['game-break-started']
      type HasPhase = ClassroomServerToClientEvents['game-break-phase']
      type HasEnded = ClassroomServerToClientEvents['game-break-ended']

      // Runtime assertion that the types resolve to functions
      const _started: HasStarted = (_data: GameBreakStartedEvent) => {}
      const _phase: HasPhase = (_data: GameBreakPhaseEvent) => {}
      const _ended: HasEnded = (_data: GameBreakEndedEvent) => {}

      expect(_started).toBeDefined()
      expect(_phase).toBeDefined()
      expect(_ended).toBeDefined()
    })

    it('client-to-server events include all game break events', () => {
      type HasStarted = ClassroomClientToServerEvents['game-break-started']
      type HasPhase = ClassroomClientToServerEvents['game-break-phase']
      type HasEnded = ClassroomClientToServerEvents['game-break-ended']

      const _started: HasStarted = (_data: GameBreakStartedEvent) => {}
      const _phase: HasPhase = (_data: GameBreakPhaseEvent) => {}
      const _ended: HasEnded = (_data: GameBreakEndedEvent) => {}

      expect(_started).toBeDefined()
      expect(_phase).toBeDefined()
      expect(_ended).toBeDefined()
    })
  })
})
