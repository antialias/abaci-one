/**
 * @vitest-environment node
 *
 * Tests for Remote Camera Session Manager
 *
 * Tests session creation, TTL management, activity-based renewal,
 * and calibration persistence.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRemoteCameraSession,
  deleteRemoteCameraSession,
  getOrCreateSession,
  getRemoteCameraSession,
  getSessionCalibration,
  getSessionCount,
  markPhoneConnected,
  markPhoneDisconnected,
  renewSessionTTL,
  setSessionCalibration,
} from '../session-manager'

describe('Remote Camera Session Manager', () => {
  beforeEach(() => {
    // Clear all sessions before each test
    // Access the global sessions map directly
    if (globalThis.__remoteCameraSessions) {
      globalThis.__remoteCameraSessions.clear()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createRemoteCameraSession', () => {
    it('should create a new session with unique ID', () => {
      const session = createRemoteCameraSession()

      expect(session.id).toBeDefined()
      expect(session.id.length).toBeGreaterThan(0)
      expect(session.phoneConnected).toBe(false)
    })

    it('should set correct timestamps on creation', () => {
      const now = new Date()
      vi.setSystemTime(now)

      const session = createRemoteCameraSession()

      expect(session.createdAt.getTime()).toBe(now.getTime())
      expect(session.lastActivityAt.getTime()).toBe(now.getTime())
      // TTL should be 60 minutes
      expect(session.expiresAt.getTime()).toBe(now.getTime() + 60 * 60 * 1000)
    })

    it('should create multiple sessions with unique IDs', () => {
      const session1 = createRemoteCameraSession()
      const session2 = createRemoteCameraSession()

      expect(session1.id).not.toBe(session2.id)
      expect(getSessionCount()).toBe(2)
    })
  })

  describe('getRemoteCameraSession', () => {
    it('should retrieve an existing session', () => {
      const created = createRemoteCameraSession()
      const retrieved = getRemoteCameraSession(created.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved?.id).toBe(created.id)
    })

    it('should return null for non-existent session', () => {
      const session = getRemoteCameraSession('non-existent-id')
      expect(session).toBeNull()
    })

    it('should return null for expired session', () => {
      const session = createRemoteCameraSession()
      const sessionId = session.id

      // Advance time past expiration (61 minutes)
      vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000))

      const retrieved = getRemoteCameraSession(sessionId)
      expect(retrieved).toBeNull()
    })
  })

  describe('getOrCreateSession', () => {
    it('should create new session with provided ID if not exists', () => {
      const customId = 'my-custom-session-id'
      const session = getOrCreateSession(customId)

      expect(session.id).toBe(customId)
      expect(session.phoneConnected).toBe(false)
    })

    it('should return existing session if not expired', () => {
      const customId = 'existing-session'
      const original = getOrCreateSession(customId)

      // Mark phone connected to verify we get same session
      markPhoneConnected(customId)

      const retrieved = getOrCreateSession(customId)

      expect(retrieved.id).toBe(original.id)
      expect(retrieved.phoneConnected).toBe(true)
    })

    it('should renew TTL when accessing existing session', () => {
      const now = new Date()
      vi.setSystemTime(now)

      const customId = 'session-to-renew'
      const original = getOrCreateSession(customId)
      const originalExpiry = original.expiresAt.getTime()

      // Advance time by 30 minutes
      vi.setSystemTime(new Date(now.getTime() + 30 * 60 * 1000))

      const retrieved = getOrCreateSession(customId)

      // Expiry should be extended from current time
      expect(retrieved.expiresAt.getTime()).toBeGreaterThan(originalExpiry)
    })

    it('should create new session if existing one expired', () => {
      const customId = 'expired-session'
      const original = getOrCreateSession(customId)
      markPhoneConnected(customId) // Mark to distinguish

      // Advance time past expiration
      vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000))

      const newSession = getOrCreateSession(customId)

      // Should be a fresh session (not phone connected)
      expect(newSession.id).toBe(customId)
      expect(newSession.phoneConnected).toBe(false)
    })
  })

  describe('renewSessionTTL', () => {
    it('should extend session expiration time', () => {
      const now = new Date()
      vi.setSystemTime(now)

      const session = createRemoteCameraSession()
      const originalExpiry = session.expiresAt.getTime()

      // Advance time by 30 minutes
      vi.setSystemTime(new Date(now.getTime() + 30 * 60 * 1000))

      const renewed = renewSessionTTL(session.id)

      expect(renewed).toBe(true)

      const updatedSession = getRemoteCameraSession(session.id)
      expect(updatedSession?.expiresAt.getTime()).toBeGreaterThan(originalExpiry)
    })

    it('should update lastActivityAt', () => {
      const now = new Date()
      vi.setSystemTime(now)

      const session = createRemoteCameraSession()

      // Advance time
      const later = new Date(now.getTime() + 10 * 60 * 1000)
      vi.setSystemTime(later)

      renewSessionTTL(session.id)

      const updatedSession = getRemoteCameraSession(session.id)
      expect(updatedSession?.lastActivityAt.getTime()).toBe(later.getTime())
    })

    it('should return false for non-existent session', () => {
      const result = renewSessionTTL('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('calibration persistence', () => {
    const testCalibration = {
      corners: {
        topLeft: { x: 10, y: 10 },
        topRight: { x: 100, y: 10 },
        bottomLeft: { x: 10, y: 100 },
        bottomRight: { x: 100, y: 100 },
      },
    }

    it('should store calibration data', () => {
      const session = createRemoteCameraSession()

      const result = setSessionCalibration(session.id, testCalibration)

      expect(result).toBe(true)
    })

    it('should retrieve calibration data', () => {
      const session = createRemoteCameraSession()
      setSessionCalibration(session.id, testCalibration)

      const retrieved = getSessionCalibration(session.id)

      expect(retrieved).toEqual(testCalibration)
    })

    it('should return null for session without calibration', () => {
      const session = createRemoteCameraSession()

      const calibration = getSessionCalibration(session.id)

      expect(calibration).toBeNull()
    })

    it('should return null for non-existent session', () => {
      const calibration = getSessionCalibration('non-existent')
      expect(calibration).toBeNull()
    })

    it('should renew TTL when setting calibration', () => {
      const now = new Date()
      vi.setSystemTime(now)

      const session = createRemoteCameraSession()
      const originalExpiry = session.expiresAt.getTime()

      // Advance time
      vi.setSystemTime(new Date(now.getTime() + 30 * 60 * 1000))

      setSessionCalibration(session.id, testCalibration)

      const updatedSession = getRemoteCameraSession(session.id)
      expect(updatedSession?.expiresAt.getTime()).toBeGreaterThan(originalExpiry)
    })

    it('should persist calibration across session retrievals', () => {
      const customId = 'calibrated-session'
      const session = getOrCreateSession(customId)
      setSessionCalibration(session.id, testCalibration)

      // Simulate reconnection by getting session again
      const reconnected = getOrCreateSession(customId)

      expect(reconnected.calibration).toEqual(testCalibration)
    })
  })

  describe('phone connection state', () => {
    it('should mark phone as connected', () => {
      const session = createRemoteCameraSession()

      const result = markPhoneConnected(session.id)

      expect(result).toBe(true)
      const updated = getRemoteCameraSession(session.id)
      expect(updated?.phoneConnected).toBe(true)
    })

    it('should mark phone as disconnected', () => {
      const session = createRemoteCameraSession()
      markPhoneConnected(session.id)

      const result = markPhoneDisconnected(session.id)

      expect(result).toBe(true)
      const updated = getRemoteCameraSession(session.id)
      expect(updated?.phoneConnected).toBe(false)
    })

    it('should extend TTL when phone connects', () => {
      const now = new Date()
      vi.setSystemTime(now)

      const session = createRemoteCameraSession()

      // Advance time
      vi.setSystemTime(new Date(now.getTime() + 30 * 60 * 1000))

      markPhoneConnected(session.id)

      const updated = getRemoteCameraSession(session.id)
      // Expiry should be 60 mins from now (not from creation)
      expect(updated?.expiresAt.getTime()).toBeGreaterThan(now.getTime() + 60 * 60 * 1000)
    })

    it('should return false for non-existent session', () => {
      expect(markPhoneConnected('non-existent')).toBe(false)
      expect(markPhoneDisconnected('non-existent')).toBe(false)
    })
  })

  describe('deleteRemoteCameraSession', () => {
    it('should delete existing session', () => {
      const session = createRemoteCameraSession()

      const result = deleteRemoteCameraSession(session.id)

      expect(result).toBe(true)
      expect(getRemoteCameraSession(session.id)).toBeNull()
    })

    it('should return false for non-existent session', () => {
      const result = deleteRemoteCameraSession('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('session count', () => {
    it('should track total sessions', () => {
      expect(getSessionCount()).toBe(0)

      createRemoteCameraSession()
      expect(getSessionCount()).toBe(1)

      createRemoteCameraSession()
      expect(getSessionCount()).toBe(2)
    })
  })
})
