/**
 * Tests for useRemoteCameraSession hook
 *
 * Tests session creation, validation, and the validateAndSetSession flow
 * that prevents stale session IDs from being reused.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRemoteCameraSession } from '../useRemoteCameraSession'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useRemoteCameraSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createSession', () => {
    it('should create a new session via API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'new-session-123',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
      })

      const { result } = renderHook(() => useRemoteCameraSession())

      await act(async () => {
        const session = await result.current.createSession()
        expect(session).not.toBeNull()
        expect(session?.sessionId).toBe('new-session-123')
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/remote-camera', {
        method: 'POST',
      })
    })

    it('should set isCreating while creating session', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      mockFetch.mockReturnValueOnce(promise)

      const { result } = renderHook(() => useRemoteCameraSession())

      let createPromise: Promise<unknown>
      act(() => {
        createPromise = result.current.createSession()
      })

      expect(result.current.isCreating).toBe(true)

      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({
            sessionId: 'session-123',
            expiresAt: new Date().toISOString(),
          }),
        })
        await createPromise
      })

      expect(result.current.isCreating).toBe(false)
    })

    it('should set error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      })

      const { result } = renderHook(() => useRemoteCameraSession())

      await act(async () => {
        const session = await result.current.createSession()
        expect(session).toBeNull()
      })

      expect(result.current.error).toBe('Server error')
    })
  })

  describe('validateAndSetSession', () => {
    it('should validate existing session against server and use it if valid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'existing-session-456',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          phoneConnected: true,
        }),
      })

      const { result } = renderHook(() => useRemoteCameraSession())

      let isValid: boolean
      await act(async () => {
        isValid = await result.current.validateAndSetSession('existing-session-456')
      })

      expect(isValid!).toBe(true)
      expect(result.current.session).not.toBeNull()
      expect(result.current.session?.sessionId).toBe('existing-session-456')
      expect(result.current.session?.phoneConnected).toBe(true)

      expect(mockFetch).toHaveBeenCalledWith('/api/remote-camera?sessionId=existing-session-456')
    })

    it('should return false for expired/invalid session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Session not found or expired' }),
      })

      const { result } = renderHook(() => useRemoteCameraSession())

      let isValid: boolean
      await act(async () => {
        isValid = await result.current.validateAndSetSession('stale-session-789')
      })

      expect(isValid!).toBe(false)
      expect(result.current.session).toBeNull()
    })

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useRemoteCameraSession())

      let isValid: boolean
      await act(async () => {
        isValid = await result.current.validateAndSetSession('session-xyz')
      })

      expect(isValid!).toBe(false)
      expect(result.current.session).toBeNull()
    })

    it('should show loading state during validation', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      mockFetch.mockReturnValueOnce(promise)

      const { result } = renderHook(() => useRemoteCameraSession())

      let validatePromise: Promise<boolean>
      act(() => {
        validatePromise = result.current.validateAndSetSession('session-abc')
      })

      expect(result.current.isCreating).toBe(true)

      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({
            sessionId: 'session-abc',
            expiresAt: new Date().toISOString(),
          }),
        })
        await validatePromise
      })

      expect(result.current.isCreating).toBe(false)
    })

    it('should URL-encode session ID in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const { result } = renderHook(() => useRemoteCameraSession())

      await act(async () => {
        await result.current.validateAndSetSession('session/with/slashes')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/remote-camera?sessionId=session%2Fwith%2Fslashes'
      )
    })
  })

  describe('clearSession', () => {
    it('should clear the current session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'session-to-clear',
          expiresAt: new Date().toISOString(),
        }),
      })

      const { result } = renderHook(() => useRemoteCameraSession())

      await act(async () => {
        await result.current.createSession()
      })

      expect(result.current.session).not.toBeNull()

      act(() => {
        result.current.clearSession()
      })

      expect(result.current.session).toBeNull()
      expect(result.current.error).toBeNull()
    })
  })

  describe('getPhoneUrl', () => {
    it('should return null when no session exists', () => {
      const { result } = renderHook(() => useRemoteCameraSession())

      expect(result.current.getPhoneUrl()).toBeNull()
    })

    it('should return URL with session ID when session exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'url-test-session',
          expiresAt: new Date().toISOString(),
        }),
      })

      const { result } = renderHook(() => useRemoteCameraSession())

      await act(async () => {
        await result.current.createSession()
      })

      const url = result.current.getPhoneUrl()
      expect(url).toContain('/remote-camera/url-test-session')
    })
  })
})
