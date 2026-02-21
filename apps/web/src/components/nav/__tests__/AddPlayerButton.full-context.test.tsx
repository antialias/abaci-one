import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { GameContextNav } from '../GameContextNav'

// Mock Next.js navigation hooks (required by AddPlayerButton, PendingInvitations, RoomInfo, etc.)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock ToastContext (required by PendingInvitations and other sub-components)
vi.mock('@/components/common/ToastContext', () => ({
  useToast: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
  }),
}))

// Mock PendingInvitations to avoid fetch calls in tests
vi.mock('../PendingInvitations', () => ({
  PendingInvitations: () => null,
}))

// Mock useUserId (used by GameContextNav)
vi.mock('@/hooks/useUserId', () => ({
  useUserId: () => ({ data: 'test-viewer-id' }),
}))

// Mock useRoomData (used by GameContextNav, RoomInfo, AddPlayerButton)
vi.mock('@/hooks/useRoomData', () => ({
  useRoomData: () => ({
    roomData: null,
    isInRoom: false,
    refetch: vi.fn(),
    getRoomShareUrl: vi.fn(() => 'https://example.com/room/ABC123'),
    isLoading: false,
  }),
  useCreateRoom: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useJoinRoom: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useGetRoomByCode: () => ({ mutateAsync: vi.fn() }),
  useLeaveRoom: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClearRoomGame: () => ({ mutate: vi.fn(), isPending: false }),
}))

// Mock InvitePlayersTab to simulate room creation
vi.mock('../InvitePlayersTab', () => ({
  InvitePlayersTab: () => {
    const [status, setStatus] = React.useState<'loading' | 'success'>('loading')

    React.useEffect(() => {
      const timer = setTimeout(() => setStatus('success'), 100)
      return () => clearTimeout(timer)
    }, [])

    if (status === 'loading') {
      return <div>Creating room...</div>
    }

    return (
      <div>
        <div>ABC123</div>
        <div>Share Link</div>
      </div>
    )
  },
}))

// The second tab label when isInRoom=true is "📨 Invite More"
const INVITE_TAB_LABEL = '📨 Invite More'

describe('AddPlayerButton - Full Context Re-render Test', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  it('keeps popover open when GameContextNav re-renders with roomInfo', async () => {
    const mockPlayers = [
      { id: 'player-1', name: 'Player 1', emoji: '😀' },
      { id: 'player-2', name: 'Player 2', emoji: '😎' },
    ]

    // Start with roomInfo present so isInRoom=true and InvitePlayersTab mock is used
    const roomInfo = {
      roomId: 'test-room',
      roomName: 'Quick Room',
      gameName: 'matching' as const,
      playerCount: 1,
      joinCode: 'ABC123',
    }

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <GameContextNav
          navTitle="Champion Arena"
          navEmoji="🏟️"
          gameMode="single"
          activePlayers={mockPlayers.slice(0, 1)}
          inactivePlayers={mockPlayers.slice(1)}
          shouldEmphasize={true}
          showFullscreenSelection={false}
          onAddPlayer={vi.fn()}
          onRemovePlayer={vi.fn()}
          onConfigurePlayer={vi.fn()}
          roomInfo={roomInfo}
        />
      </QueryClientProvider>
    )

    // Step 1: Open the popover
    const addButton = screen.getByTitle('Add player')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText(INVITE_TAB_LABEL)).toBeInTheDocument()
    })

    // Step 2: Click Invite tab
    const inviteTab = screen.getByText(INVITE_TAB_LABEL)
    fireEvent.click(inviteTab)

    // Step 3: Verify loading state
    await waitFor(() => {
      expect(screen.getByText('Creating room...')).toBeInTheDocument()
    })

    // Step 4: Wait for room creation to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150))
    })

    // Step 5: SIMULATE PRODUCTION BEHAVIOR - Re-render with updated roomInfo
    // This is what happens in production when room state changes (e.g., new player joins)
    rerender(
      <QueryClientProvider client={queryClient}>
        <GameContextNav
          navTitle="Champion Arena"
          navEmoji="🏟️"
          gameMode="single"
          activePlayers={mockPlayers.slice(0, 1)}
          inactivePlayers={mockPlayers.slice(1)}
          shouldEmphasize={true}
          showFullscreenSelection={false}
          onAddPlayer={vi.fn()}
          onRemovePlayer={vi.fn()}
          onConfigurePlayer={vi.fn()}
          roomInfo={{
            ...roomInfo,
            playerCount: 2, // Player count changed - triggers re-render
          }}
        />
      </QueryClientProvider>
    )

    // Step 6: CRITICAL TEST - Is popover still visible after re-render?
    await waitFor(
      () => {
        // Try to find the popover content
        const inviteText = screen.queryByText('ABC123')
        const shareLink = screen.queryByText('Share Link')

        if (!inviteText || !shareLink) {
          throw new Error('Popover closed after re-render!')
        }

        expect(inviteText).toBeInTheDocument()
        expect(shareLink).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })
})
