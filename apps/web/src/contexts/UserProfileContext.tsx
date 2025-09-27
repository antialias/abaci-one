'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// Available character emojis for players (deduplicated)
export const PLAYER_EMOJIS = [
  // People & Characters
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇',
  '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨',
  '🧐', '🤓', '😎', '🥸', '🥳', '😏', '😒', '😞', '😔', '😟', '😕',

  // Fantasy & Fun
  '🤠', '🥷', '👑', '🎭', '🤖', '👻', '💀', '👽', '🤡', '🧙‍♂️', '🧙‍♀️', '🧚‍♂️',
  '🧚‍♀️', '🧛‍♂️', '🧛‍♀️', '🧜‍♂️', '🧜‍♀️', '🧝‍♂️', '🧝‍♀️', '🦸‍♂️', '🦸‍♀️', '🦹‍♂️',

  // Animals
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁',
  '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🦆', '🐧', '🐦', '🐤',
  '🐣', '🐥', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋',

  // Objects & Symbols
  '⭐', '🌟', '💫', '✨', '⚡', '🔥', '🌈', '🎪', '🎨', '🎯',
  '🎲', '🎮', '🕹️', '🎸', '🎺', '🎷', '🥁', '🎻', '🎤', '🎧', '🎬', '🎥',

  // Food & Drinks
  '🍎', '🍊', '🍌', '🍇', '🍓', '🥝', '🍑', '🥭', '🍍', '🥥', '🥑', '🍆',
  '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰'
]

export interface UserProfile {
  player1Emoji: string
  player2Emoji: string
  player1Name: string
  player2Name: string
  gamesPlayed: number
  totalWins: number
  favoriteGameType: 'abacus-numeral' | 'complement-pairs' | null
  bestTime: number | null
  highestAccuracy: number
}

export interface UserProfileContextType {
  profile: UserProfile
  updatePlayerEmoji: (player: 1 | 2, emoji: string) => void
  updatePlayerName: (player: 1 | 2, name: string) => void
  updateGameStats: (stats: Partial<Pick<UserProfile, 'gamesPlayed' | 'totalWins' | 'favoriteGameType' | 'bestTime' | 'highestAccuracy'>>) => void
  resetProfile: () => void
}

const defaultProfile: UserProfile = {
  player1Emoji: '😀',
  player2Emoji: '😎',
  player1Name: 'Player 1',
  player2Name: 'Player 2',
  gamesPlayed: 0,
  totalWins: 0,
  favoriteGameType: null,
  bestTime: null,
  highestAccuracy: 0
}

const STORAGE_KEY = 'soroban-memory-pairs-profile'

const UserProfileContext = createContext<UserProfileContextType | null>(null)

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile)

  // Load profile from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsedProfile = JSON.parse(stored)
          // Merge with defaults to handle new fields
          setProfile({ ...defaultProfile, ...parsedProfile })
        }
      } catch (error) {
        console.warn('Failed to load user profile from localStorage:', error)
      }
    }
  }, [])

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
      } catch (error) {
        console.warn('Failed to save user profile to localStorage:', error)
      }
    }
  }, [profile])

  const updatePlayerEmoji = (player: 1 | 2, emoji: string) => {
    setProfile(prev => ({
      ...prev,
      [`player${player}Emoji`]: emoji
    }))
  }

  const updatePlayerName = (player: 1 | 2, name: string) => {
    setProfile(prev => ({
      ...prev,
      [`player${player}Name`]: name
    }))
  }

  const updateGameStats = (stats: Partial<Pick<UserProfile, 'gamesPlayed' | 'totalWins' | 'favoriteGameType' | 'bestTime' | 'highestAccuracy'>>) => {
    setProfile(prev => ({
      ...prev,
      ...stats
    }))
  }

  const resetProfile = () => {
    setProfile(defaultProfile)
  }

  const contextValue: UserProfileContextType = {
    profile,
    updatePlayerEmoji,
    updatePlayerName,
    updateGameStats,
    resetProfile
  }

  return (
    <UserProfileContext.Provider value={contextValue}>
      {children}
    </UserProfileContext.Provider>
  )
}

export function useUserProfile(): UserProfileContextType {
  const context = useContext(UserProfileContext)
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider')
  }
  return context
}