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
    it('should create a new session with unique ID', async () => {
      const session = await createRemoteCameraSession()

      expect(session.id).toBeDefined()
      expect(session.id.length).toBeGreaterThan(0)
      expect(session.phoneConnected).toBe(false)
    })

    it('should set correct timestamps on creation', async () => {
      const now = new Date()
      vi.setSystemTime(now)

      const session = await createRemoteCameraSession()

      expect(new Date(session.createdAt).getTime()).toBe(now.getTime())
      expect(new Date(session.lastActivityAt).getTime()).toBe(now.getTime())
      // TTL should be 60 minutes
      expect(new Date(session.expiresAt).getTime()).toBe(now.getTime() + 60 * 60 * 1000)
    })

    it('should create multiple sessions with unique IDs', async () => {
      const session1 = await createRemoteCameraSession()
      const session2 = await createRemoteCameraSession()

      expect(session1.id).not.toBe(session2.id)
      expect(await getSessionCount()).toBe(2)
    })
  })

  describe('getRemoteCameraSession', () => {
    it('should retrieve an existing session', async () => {
      const created = await createRemoteCameraSession()
      const retrieved = await getRemoteCameraSession(created.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved?.id).toBe(created.id)
    })

    it('should return null for non-existent session', async () => {
      const session = await getRemoteCameraSession('non-existent-id')
      expect(session).toBeNull()
    })

    it('should return null for expired session', async () => {
      const session = await createRemoteCameraSession()
      const sessionId = session.id

      // Advance time past expiration (61 minutes)
      vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000))

      const retrieved = await getRemoteCameraSession(sessionId)
      expect(retrieved).toBeNull()
    })
  })

  describe('getOrCreateSession', () => {
    it('should create new session with provided ID if not exists', async () => {
      const customId = 'my-custom-session-id'
      const session = await getOrCreateSession(customId)

      expect(session.id).toBe(customId)
      expect(session.phoneConnected).toBe(false)
    })

    it('should return existing session if not expired', async () => {
      const customId = 'existing-session'
      const original = await getOrCreateSession(customId)

      // Mark phone connected to verify we get same session
      await markPhoneConnected(customId)

      const retrieved = await getOrCreateSession(customId)

      expect(retrieved.id).toBe(original.id)
      expect(retrieved.phoneConnected).toBe(true)
    })

    it('should renew TTL when accessing existing session', async () => {
      const now = new Date()
      vi.setSystemTime(now)

      const customId = 'session-to-renew'
      const original = await getOrCreateSession(customId)
      const originalExpiry = new Date(original.expiresAt).getTime()

      // Advance time by 30 minutes
      vi.setSystemTime(new Date(now.getTime() + 30 * 60 * 1000))

      const retrieved = await getOrCreateSession(customId)

      // Expiry should be extended from current time
      expect(new Date(retrieved.expiresAt).getTime()).toBeGreaterThan(originalExpiry)
    })

    it('should create new session if existing one expired', async () => {
      const customId = 'expired-session'
      await getOrCreateSession(customId)
      await markPhoneConnected(customId) // Mark to distinguish

      // Advance time past expiration
      vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000))

      const newSession = await getOrCreateSession(customId)

      // Should be a fresh session (not phone connected)
      expect(newSession.id).toBe(customId)
      expect(newSession.phoneConnected).toBe(false)
    })
  })

  describe('renewSessionTTL', () => {
    it('should extend session expiration time', async () => {
      const now = new Date()
      vi.setSystemTime(now)

      const session = await createRemoteCameraSession()
      const originalExpiry = new Date(session.expiresAt).getTime()

      // Advance time by 30 minutes
      vi.setSystemTime(new Date(now.getTime() + 30 * 60 * 1000))

      const renewed = await renewSessionTTL(session.id)

      expect(renewed).toBe(true)

      const updatedSession = await getRemoteCameraSession(session.id)
      expect(new Date(updatedSession!.expiresAt).getTime()).toBeGreaterThan(originalExpiry)
    })

    it('should update lastActivityAt', async () => {
      const now = new Date()
      vi.setSystemTime(now)

      const session = await createRemoteCameraSession()

      // Advance time
      const later = new Date(now.getTime() + 10 * 60 * 1000)
      vi.setSystemTime(later)

      await renewSessionTTL(session.id)

      const updatedSession = await getRemoteCameraSession(session.id)
      expect(new Date(updatedSession!.lastActivityAt).getTime()).toBe(later.getTime())
    })

    it('should return false for non-existent session', async () => {
      const result = await renewSessionTTL('non-existent')
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

    it('should store calibration data', async () => {
      const session = await createRemoteCameraSession()

      const result = await setSessionCalibration(session.id, testCalibration)

      expect(result).toBe(true)
    })

    it('should retrieve calibration data', async () => {
      const session = await createRemoteCameraSession()
      await setSessionCalibration(session.id, testCalibration)

      const retrieved = await getSessionCalibration(session.id)

      expect(retrieved).toEqual(testCalibration)
    })

    it('should return null for session without calibration', async () => {
      const session = await createRemoteCameraSession()

      const calibration = await getSessionCalibration(session.id)

      expect(calibration).toBeNull()
    })

    it('should return null for non-existent session', async () => {
      const calibration = await getSessionCalibration('non-existent')
      expect(calibration).toBeNull()
    })

    it('should renew TTL when setting calibration', async () => {
      const now = new Date()
      vi.setSystemTime(now)

      const session = await createRemoteCameraSession()
      const originalExpiry = new Date(session.expiresAt).getTime()

      // Advance time
      vi.setSystemTime(new Date(now.getTime() + 30 * 60 * 1000))

      await setSessionCalibration(session.id, testCalibration)

      const updatedSession = await getRemoteCameraSession(session.id)
      expect(new Date(updatedSession!.expiresAt).getTime()).toBeGreaterThan(originalExpiry)
    })

    it('should persist calibration across session retrievals', async () => {
      const customId = 'calibrated-session'
      const session = await getOrCreateSession(customId)
      await setSessionCalibration(session.id, testCalibration)

      // Simulate reconnection by getting session again
      const reconnected = await getOrCreateSession(customId)

      expect(reconnected.calibration).toEqual(testCalibration)
    })
  })

  describe('phone connection state', () => {
    it('should mark phone as connected', async () => {
      const session = await createRemoteCameraSession()

      const result = await markPhoneConnected(session.id)

      expect(result).toBe(true)
      const updated = await getRemoteCameraSession(session.id)
      expect(updated?.phoneConnected).toBe(true)
    })

    it('should mark phone as disconnected', async () => {
      const session = await createRemoteCameraSession()
      await markPhoneConnected(session.id)

      const result = await markPhoneDisconnected(session.id)

      expect(result).toBe(true)
      const updated = await getRemoteCameraSession(session.id)
      expect(updated?.phoneConnected).toBe(false)
    })

    it('should extend TTL when phone connects', async () => {
      const now = new Date()
      vi.setSystemTime(now)

      const session = await createRemoteCameraSession()

      // Advance time
      vi.setSystemTime(new Date(now.getTime() + 30 * 60 * 1000))

      await markPhoneConnected(session.id)

      const updated = await getRemoteCameraSession(session.id)
      // Expiry should be 60 mins from now (not from creation)
      expect(new Date(updated!.expiresAt).getTime()).toBeGreaterThan(now.getTime() + 60 * 60 * 1000)
    })

    it('should return false for non-existent session', async () => {
      expect(await markPhoneConnected('non-existent')).toBe(false)
      expect(await markPhoneDisconnected('non-existent')).toBe(false)
    })
  })

  describe('deleteRemoteCameraSession', () => {
    it('should delete existing session', async () => {
      const session = await createRemoteCameraSession()

      const result = await deleteRemoteCameraSession(session.id)

      expect(result).toBe(true)
      expect(await getRemoteCameraSession(session.id)).toBeNull()
    })

    it('should return false for non-existent session', async () => {
      const result = await deleteRemoteCameraSession('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('session count', () => {
    it('should track total sessions', async () => {
      expect(await getSessionCount()).toBe(0)

      await createRemoteCameraSession()
      expect(await getSessionCount()).toBe(1)

      await createRemoteCameraSession()
      expect(await getSessionCount()).toBe(2)
    })
  })
})
