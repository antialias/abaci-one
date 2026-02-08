import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { UserProfileProvider, useUserProfile } from '../UserProfileContext'

// Mock the hooks
const mockMutate = vi.fn()
vi.mock('@/hooks/useUserStats', () => ({
  useUserStats: () => ({
    data: {
      gamesPlayed: 10,
      totalWins: 5,
      favoriteGameType: 'abacus-numeral' as const,
      bestTime: 30.5,
      highestAccuracy: 95,
    },
    isLoading: false,
  }),
  useUpdateUserStats: () => ({
    mutate: mockMutate,
  }),
}))

function wrapper({ children }: { children: ReactNode }) {
  return <UserProfileProvider>{children}</UserProfileProvider>
}

describe('UserProfileContext', () => {
  it('throws when useUserProfile is used outside provider', () => {
    expect(() => {
      renderHook(() => useUserProfile())
    }).toThrow('useUserProfile must be used within a UserProfileProvider')
  })

  it('provides profile from database stats', () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper })
    expect(result.current.profile).toEqual({
      gamesPlayed: 10,
      totalWins: 5,
      favoriteGameType: 'abacus-numeral',
      bestTime: 30.5,
      highestAccuracy: 95,
    })
  })

  it('provides isLoading state', () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper })
    expect(result.current.isLoading).toBe(false)
  })

  it('provides updateGameStats function', () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper })
    expect(typeof result.current.updateGameStats).toBe('function')
  })

  it('calls mutation on updateGameStats', () => {
    mockMutate.mockClear()
    const { result } = renderHook(() => useUserProfile(), { wrapper })

    act(() => {
      result.current.updateGameStats({ gamesPlayed: 11 })
    })

    expect(mockMutate).toHaveBeenCalledWith({ gamesPlayed: 11 })
  })

  it('provides resetProfile function', () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper })
    expect(typeof result.current.resetProfile).toBe('function')
  })

  it('calls mutation with default profile on resetProfile', () => {
    mockMutate.mockClear()
    const { result } = renderHook(() => useUserProfile(), { wrapper })

    act(() => {
      result.current.resetProfile()
    })

    expect(mockMutate).toHaveBeenCalledWith({
      gamesPlayed: 0,
      totalWins: 0,
      favoriteGameType: null,
      bestTime: null,
      highestAccuracy: 0,
    })
  })
})
