'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { UserStatsProfile } from '../types/player'
import { STORAGE_KEY_STATS, STORAGE_KEY_V1, extractStatsFromV1 } from '../lib/playerMigration'

export interface UserProfileContextType {
  profile: UserStatsProfile
  updateGameStats: (stats: Partial<UserStatsProfile>) => void
  resetProfile: () => void
}

const defaultProfile: UserStatsProfile = {
  gamesPlayed: 0,
  totalWins: 0,
  favoriteGameType: null,
  bestTime: null,
  highestAccuracy: 0
}

const UserProfileContext = createContext<UserProfileContextType | null>(null)

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserStatsProfile>(defaultProfile)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load profile from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Try to load from new stats storage
        let stored = localStorage.getItem(STORAGE_KEY_STATS)

        if (!stored) {
          // Check for V1 data to migrate stats from
          const v1Data = localStorage.getItem(STORAGE_KEY_V1)
          if (v1Data) {
            const v1Profile = JSON.parse(v1Data)
            const migratedStats = extractStatsFromV1(v1Profile)
            setProfile(migratedStats)
            // Save to new location
            localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(migratedStats))
            console.log('✅ Migrated stats from V1 to new storage')
          }
        } else {
          const parsedProfile = JSON.parse(stored)
          // Merge with defaults to handle new fields
          const mergedProfile = { ...defaultProfile, ...parsedProfile }
          setProfile(mergedProfile)
        }

        setIsInitialized(true)
      } catch (error) {
        console.warn('Failed to load user stats from localStorage:', error)
        setIsInitialized(true)
      }
    }
  }, [])

  // Save profile to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (typeof window !== 'undefined' && isInitialized) {
      try {
        localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(profile))
      } catch (error) {
        console.warn('Failed to save user stats to localStorage:', error)
      }
    }
  }, [profile, isInitialized])

  const updateGameStats = (stats: Partial<UserStatsProfile>) => {
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
