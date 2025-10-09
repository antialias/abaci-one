import { render, screen, waitFor } from '@testing-library/react'
import * as nextNavigation from 'next/navigation'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as arcadeGuard from '@/hooks/useArcadeGuard'
import * as roomData from '@/hooks/useRoomData'
import * as viewerId from '@/hooks/useViewerId'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useParams: vi.fn(),
}))

// Mock hooks
vi.mock('@/hooks/useArcadeGuard')
vi.mock('@/hooks/useRoomData')
vi.mock('@/hooks/useViewerId')
vi.mock('@/hooks/useUserPlayers', () => ({
  useUserPlayers: () => ({ data: [], isLoading: false }),
  useCreatePlayer: () => ({ mutate: vi.fn() }),
  useUpdatePlayer: () => ({ mutate: vi.fn() }),
  useDeletePlayer: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/hooks/useArcadeSocket', () => ({
  useArcadeSocket: () => ({
    connected: false,
    joinSession: vi.fn(),
    socket: null,
    sendMove: vi.fn(),
    exitSession: vi.fn(),
    pingSession: vi.fn(),
  }),
}))

// Mock styled-system
vi.mock('../../../../styled-system/css', () => ({
  css: () => '',
}))

// Mock components
vi.mock('@/components/PageWithNav', () => ({
  PageWithNav: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Import pages after mocks
import RoomBrowserPage from '../page'

describe('Room Navigation with Active Sessions', () => {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(nextNavigation, 'useRouter').mockReturnValue(mockRouter as any)
    vi.spyOn(nextNavigation, 'usePathname').mockReturnValue('/arcade-rooms')
    vi.spyOn(viewerId, 'useViewerId').mockReturnValue({
      data: 'test-user',
      isLoading: false,
      isPending: false,
      error: null,
    } as any)
    global.fetch = vi.fn()
  })

  describe('RoomBrowserPage', () => {
    it('should render room browser without redirecting when user has active game session', async () => {
      // User has an active game session
      vi.spyOn(arcadeGuard, 'useArcadeGuard').mockReturnValue({
        hasActiveSession: true,
        loading: false,
        activeSession: {
          gameUrl: '/arcade/room',
          currentGame: 'matching',
        },
      })

      // User is in a room
      vi.spyOn(roomData, 'useRoomData').mockReturnValue({
        roomData: {
          id: 'room-1',
          name: 'Test Room',
          code: 'ABC123',
          gameName: 'matching',
          members: [],
          memberPlayers: {},
        },
        isLoading: false,
        isInRoom: true,
        notifyRoomOfPlayerUpdate: vi.fn(),
      })

      // Mock rooms API
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          rooms: [
            {
              id: 'room-1',
              code: 'ABC123',
              name: 'Test Room',
              gameName: 'matching',
              status: 'lobby',
              createdAt: new Date(),
              creatorName: 'Test User',
              isLocked: false,
            },
          ],
        }),
      })

      render(<RoomBrowserPage />)

      // Should render the page
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Rooms')).toBeInTheDocument()
      })

      // Should NOT redirect to /arcade/room
      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    it('should NOT redirect when PageWithNav uses arcade guard with enabled=false', async () => {
      // Simulate PageWithNav calling useArcadeGuard with enabled=false
      const arcadeGuardSpy = vi.spyOn(arcadeGuard, 'useArcadeGuard')

      // User has an active game session
      arcadeGuardSpy.mockReturnValue({
        hasActiveSession: true,
        loading: false,
        activeSession: {
          gameUrl: '/arcade/room',
          currentGame: 'matching',
        },
      })

      vi.spyOn(roomData, 'useRoomData').mockReturnValue({
        roomData: null,
        isLoading: false,
        isInRoom: false,
        notifyRoomOfPlayerUpdate: vi.fn(),
      })

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ rooms: [] }),
      })

      render(<RoomBrowserPage />)

      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Rooms')).toBeInTheDocument()
      })

      // PageWithNav should have called useArcadeGuard with enabled=false
      // This is tested in PageWithNav's own tests, but we verify no redirect happened
      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    it('should allow navigation to room detail even with active session', async () => {
      vi.spyOn(arcadeGuard, 'useArcadeGuard').mockReturnValue({
        hasActiveSession: true,
        loading: false,
        activeSession: {
          gameUrl: '/arcade/room',
          currentGame: 'matching',
        },
      })

      vi.spyOn(roomData, 'useRoomData').mockReturnValue({
        roomData: null,
        isLoading: false,
        isInRoom: false,
        notifyRoomOfPlayerUpdate: vi.fn(),
      })

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          rooms: [
            {
              id: 'room-1',
              code: 'ABC123',
              name: 'Test Room',
              gameName: 'matching',
              status: 'lobby',
              createdAt: new Date(),
              creatorName: 'Test User',
              isLocked: false,
              isMember: true,
            },
          ],
        }),
      })

      render(<RoomBrowserPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Room')).toBeInTheDocument()
      })

      // Click on the room card
      const roomCard = screen.getByText('Test Room').parentElement
      roomCard?.click()

      // Should navigate to room detail, not to /arcade/room
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/arcade-rooms/room-1')
      })
    })
  })

  describe('Room navigation edge cases', () => {
    it('should handle rapid navigation between room pages without redirect loops', async () => {
      vi.spyOn(arcadeGuard, 'useArcadeGuard').mockReturnValue({
        hasActiveSession: true,
        loading: false,
        activeSession: {
          gameUrl: '/arcade/room',
          currentGame: 'matching',
        },
      })

      vi.spyOn(roomData, 'useRoomData').mockReturnValue({
        roomData: null,
        isLoading: false,
        isInRoom: false,
        notifyRoomOfPlayerUpdate: vi.fn(),
      })

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ rooms: [] }),
      })

      const { rerender } = render(<RoomBrowserPage />)

      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Rooms')).toBeInTheDocument()
      })

      // Simulate pathname changes (navigating between room pages)
      vi.spyOn(nextNavigation, 'usePathname').mockReturnValue('/arcade-rooms/room-1')
      rerender(<RoomBrowserPage />)

      vi.spyOn(nextNavigation, 'usePathname').mockReturnValue('/arcade-rooms')
      rerender(<RoomBrowserPage />)

      // Should never redirect to game page
      expect(mockRouter.push).not.toHaveBeenCalledWith('/arcade/room')
    })

    it('should allow user to leave room and browse other rooms during active game', async () => {
      // User is in a room with an active game
      vi.spyOn(arcadeGuard, 'useArcadeGuard').mockReturnValue({
        hasActiveSession: true,
        loading: false,
        activeSession: {
          gameUrl: '/arcade/room',
          currentGame: 'matching',
        },
      })

      vi.spyOn(roomData, 'useRoomData').mockReturnValue({
        roomData: {
          id: 'room-1',
          name: 'Current Room',
          code: 'ABC123',
          gameName: 'matching',
          members: [],
          memberPlayers: {},
        },
        isLoading: false,
        isInRoom: true,
        notifyRoomOfPlayerUpdate: vi.fn(),
      })

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          rooms: [
            {
              id: 'room-1',
              name: 'Current Room',
              code: 'ABC123',
              gameName: 'matching',
              status: 'playing',
              isMember: true,
            },
            {
              id: 'room-2',
              name: 'Other Room',
              code: 'DEF456',
              gameName: 'memory-quiz',
              status: 'lobby',
              isMember: false,
            },
          ],
        }),
      })

      render(<RoomBrowserPage />)

      await waitFor(() => {
        expect(screen.getByText('Current Room')).toBeInTheDocument()
        expect(screen.getByText('Other Room')).toBeInTheDocument()
      })

      // Should be able to view both rooms without redirect
      expect(mockRouter.push).not.toHaveBeenCalled()
    })
  })
})
