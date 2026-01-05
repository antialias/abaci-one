import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { GameContextNav } from '../GameContextNav'

// Mock InvitePlayersTab to simulate room creation
let triggerRoomCreation: (() => void) | null = null

vi.mock('../InvitePlayersTab', () => ({
  InvitePlayersTab: () => {
    const [status, setStatus] = React.useState<'loading' | 'success'>('loading')

    React.useEffect(() => {
      triggerRoomCreation = () => setStatus('success')
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

describe('AddPlayerButton - Full Context Re-render Test', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    triggerRoomCreation = null
  })

  it('keeps popover open when GameContextNav re-renders with roomInfo', async () => {
    const mockPlayers = [
      { id: 'player-1', name: 'Player 1', emoji: '😀' },
      { id: 'player-2', name: 'Player 2', emoji: '😎' },
    ]

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
          roomInfo={undefined} // NO room initially
        />
      </QueryClientProvider>
    )

    // Step 1: Open the popover
    const addButton = screen.getByTitle('Add player')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('Invite Players 📨')).toBeInTheDocument()
    })

    // Step 2: Click Invite Players tab
    const inviteTab = screen.getByText('Invite Players 📨')
    fireEvent.click(inviteTab)

    // Step 3: Verify loading state
    await waitFor(() => {
      expect(screen.getByText('Creating room...')).toBeInTheDocument()
    })

    // Step 4: Wait for room creation to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150))
    })

    // Step 5: SIMULATE PRODUCTION BEHAVIOR - Re-render with roomInfo
    // This is what happens in production when room is created
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
            // NOW we have roomInfo - this causes left side of nav to change
            roomId: 'test-room',
            roomName: 'Quick Room',
            gameName: 'matching',
            playerCount: 1,
            joinCode: 'ABC123',
          }}
        />
      </QueryClientProvider>
    )

    // Step 6: CRITICAL TEST - Is popover still visible?
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
