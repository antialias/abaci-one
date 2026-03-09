/**
 * Tests that session flow state socket event types are properly defined
 * and registered in both server-to-client and client-to-server event maps.
 */
import { describe, expect, it } from 'vitest'
import type {
  ClassroomClientToServerEvents,
  ClassroomServerToClientEvents,
  SessionFlowStateEvent,
} from '../socket-events'

describe('session flow state socket event types', () => {
  describe('SessionFlowStateEvent', () => {
    it('has required fields', () => {
      const event: SessionFlowStateEvent = {
        sessionId: 'session-123',
        flowState: 'practicing',
      }

      expect(event.sessionId).toBe('session-123')
      expect(event.flowState).toBe('practicing')
    })

    it('accepts all valid flow states', () => {
      const states: SessionFlowStateEvent['flowState'][] = [
        'practicing',
        'part_transition',
        'break_pending',
        'break_active',
        'break_results',
        'completed',
        'abandoned',
      ]

      for (const flowState of states) {
        const event: SessionFlowStateEvent = {
          sessionId: 'session-123',
          flowState,
        }
        expect(event.flowState).toBe(flowState)
      }
    })

    it('accepts optional breakContext', () => {
      const withContext: SessionFlowStateEvent = {
        sessionId: 'session-123',
        flowState: 'break_active',
        breakContext: {
          roomId: 'room-abc',
          gameName: 'Memory Match',
          gameId: 'matching',
          phase: 'playing',
        },
      }
      expect(withContext.breakContext?.roomId).toBe('room-abc')
      expect(withContext.breakContext?.gameName).toBe('Memory Match')
      expect(withContext.breakContext?.phase).toBe('playing')

      const withoutContext: SessionFlowStateEvent = {
        sessionId: 'session-123',
        flowState: 'practicing',
      }
      expect(withoutContext.breakContext).toBeUndefined()
    })

    it('breakContext accepts all valid phases', () => {
      const phases = ['selecting', 'playing', 'completed'] as const

      for (const phase of phases) {
        const event: SessionFlowStateEvent = {
          sessionId: 'session-123',
          flowState: 'break_active',
          breakContext: {
            roomId: 'room-abc',
            gameName: 'Test Game',
            gameId: 'test',
            phase,
          },
        }
        expect(event.breakContext?.phase).toBe(phase)
      }
    })
  })

  describe('event map registration', () => {
    it('server-to-client events include session-flow-state', () => {
      type HasFlowState = ClassroomServerToClientEvents['session-flow-state']
      const _handler: HasFlowState = (_data: SessionFlowStateEvent) => {}
      expect(_handler).toBeDefined()
    })

    it('client-to-server events include session-flow-state', () => {
      type HasFlowState = ClassroomClientToServerEvents['session-flow-state']
      const _handler: HasFlowState = (_data: SessionFlowStateEvent) => {}
      expect(_handler).toBeDefined()
    })
  })
})
