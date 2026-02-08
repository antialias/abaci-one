/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock next/headers
const mockHeadersGet = vi.fn()
const mockCookiesGet = vi.fn()

vi.mock('next/headers', () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: mockHeadersGet,
    })
  ),
  cookies: vi.fn(() =>
    Promise.resolve({
      get: mockCookiesGet,
    })
  ),
}))

// Mock @/auth
const mockAuth = vi.fn()
vi.mock('@/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}))

// Mock guest-token
const mockVerifyGuestToken = vi.fn()
vi.mock('../guest-token', () => ({
  GUEST_COOKIE_NAME: 'guest',
  verifyGuestToken: (...args: any[]) => mockVerifyGuestToken(...args),
}))

describe('viewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(null)
    mockHeadersGet.mockReturnValue(null)
    mockCookiesGet.mockReturnValue(undefined)
  })

  describe('getViewer', () => {
    it('returns user kind when authenticated via NextAuth', async () => {
      const { getViewer } = await import('../viewer')

      const session = {
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        expires: new Date().toISOString(),
      }
      mockAuth.mockResolvedValue(session)

      const viewer = await getViewer()

      expect(viewer.kind).toBe('user')
      if (viewer.kind === 'user') {
        expect(viewer.session).toBe(session)
      }
    })

    it('returns guest kind when x-guest-id header is present', async () => {
      const { getViewer } = await import('../viewer')

      mockAuth.mockResolvedValue(null)
      mockHeadersGet.mockReturnValue('guest-abc-123')

      const viewer = await getViewer()

      expect(viewer.kind).toBe('guest')
      if (viewer.kind === 'guest') {
        expect(viewer.guestId).toBe('guest-abc-123')
      }
    })

    it('returns guest kind from cookie when header is not present', async () => {
      const { getViewer } = await import('../viewer')

      mockAuth.mockResolvedValue(null)
      mockHeadersGet.mockReturnValue(null)
      mockCookiesGet.mockReturnValue({ value: 'signed-jwt-token' })
      mockVerifyGuestToken.mockResolvedValue({ sid: 'guest-from-cookie' })

      const viewer = await getViewer()

      expect(viewer.kind).toBe('guest')
      if (viewer.kind === 'guest') {
        expect(viewer.guestId).toBe('guest-from-cookie')
      }
      expect(mockVerifyGuestToken).toHaveBeenCalledWith('signed-jwt-token')
    })

    it('returns unknown when no auth, no header, no cookie', async () => {
      const { getViewer } = await import('../viewer')

      mockAuth.mockResolvedValue(null)
      mockHeadersGet.mockReturnValue(null)
      mockCookiesGet.mockReturnValue(undefined)

      const viewer = await getViewer()

      expect(viewer.kind).toBe('unknown')
    })

    it('returns unknown when cookie verification fails', async () => {
      const { getViewer } = await import('../viewer')

      mockAuth.mockResolvedValue(null)
      mockHeadersGet.mockReturnValue(null)
      mockCookiesGet.mockReturnValue({ value: 'invalid-token' })
      mockVerifyGuestToken.mockRejectedValue(new Error('Invalid token'))

      const viewer = await getViewer()

      expect(viewer.kind).toBe('unknown')
    })

    it('prefers authenticated session over guest header', async () => {
      const { getViewer } = await import('../viewer')

      const session = {
        user: { id: 'user-1', name: 'Test' },
        expires: new Date().toISOString(),
      }
      mockAuth.mockResolvedValue(session)
      mockHeadersGet.mockReturnValue('guest-id-ignored')

      const viewer = await getViewer()

      expect(viewer.kind).toBe('user')
    })

    it('prefers guest header over cookie', async () => {
      const { getViewer } = await import('../viewer')

      mockAuth.mockResolvedValue(null)
      mockHeadersGet.mockReturnValue('guest-from-header')
      mockCookiesGet.mockReturnValue({ value: 'cookie-token' })

      const viewer = await getViewer()

      expect(viewer.kind).toBe('guest')
      if (viewer.kind === 'guest') {
        expect(viewer.guestId).toBe('guest-from-header')
      }
      // Should NOT have tried to verify the cookie
      expect(mockVerifyGuestToken).not.toHaveBeenCalled()
    })
  })

  describe('getViewerId', () => {
    it('returns user id for authenticated users', async () => {
      const { getViewerId } = await import('../viewer')

      const session = {
        user: { id: 'db-user-id-123' },
        expires: new Date().toISOString(),
      }
      mockAuth.mockResolvedValue(session)

      const id = await getViewerId()
      expect(id).toBe('db-user-id-123')
    })

    it('returns guestId for guest viewers', async () => {
      const { getViewerId } = await import('../viewer')

      mockAuth.mockResolvedValue(null)
      mockHeadersGet.mockReturnValue('guest-xyz')

      const id = await getViewerId()
      expect(id).toBe('guest-xyz')
    })

    it('throws for unknown viewers', async () => {
      const { getViewerId } = await import('../viewer')

      mockAuth.mockResolvedValue(null)
      mockHeadersGet.mockReturnValue(null)
      mockCookiesGet.mockReturnValue(undefined)

      await expect(getViewerId()).rejects.toThrow('No valid viewer session found')
    })
  })

  describe('getDbUserId', () => {
    it('returns session user.id for authenticated users', async () => {
      const { getDbUserId } = await import('../viewer')

      const session = {
        user: { id: 'auth-user-id' },
        expires: new Date().toISOString(),
      }
      mockAuth.mockResolvedValue(session)

      const id = await getDbUserId()
      expect(id).toBe('auth-user-id')
    })

    it('throws for unknown viewers', async () => {
      const { getDbUserId } = await import('../viewer')

      mockAuth.mockResolvedValue(null)
      mockHeadersGet.mockReturnValue(null)
      mockCookiesGet.mockReturnValue(undefined)

      await expect(getDbUserId()).rejects.toThrow('No valid viewer session found')
    })
  })

  describe('getViewerUser', () => {
    it('throws for unknown viewers', async () => {
      const { getViewerUser } = await import('../viewer')

      mockAuth.mockResolvedValue(null)
      mockHeadersGet.mockReturnValue(null)
      mockCookiesGet.mockReturnValue(undefined)

      await expect(getViewerUser()).rejects.toThrow('No valid viewer session found')
    })
  })
})
