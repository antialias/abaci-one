"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { UserStats } from "@/db/schema/user-stats";
import { useUpdateUserStats, useUserStats } from "@/hooks/useUserStats";

// Client-side stats type (compatible with old UserStatsProfile)
export interface UserStatsProfile {
  gamesPlayed: number;
  totalWins: number;
  favoriteGameType: "abacus-numeral" | "complement-pairs" | null;
  bestTime: number | null;
  highestAccuracy: number;
}

export interface UserProfileContextType {
  profile: UserStatsProfile;
  updateGameStats: (stats: Partial<UserStatsProfile>) => void;
  resetProfile: () => void;
  isLoading: boolean;
}

const defaultProfile: UserStatsProfile = {
  gamesPlayed: 0,
  totalWins: 0,
  favoriteGameType: null,
  bestTime: null,
  highestAccuracy: 0,
};

const UserProfileContext = createContext<UserProfileContextType | null>(null);

// Convert DB stats to client profile type
function toClientProfile(dbStats: UserStats | undefined): UserStatsProfile {
  if (!dbStats) return defaultProfile;

  return {
    gamesPlayed: dbStats.gamesPlayed,
    totalWins: dbStats.totalWins,
    favoriteGameType: dbStats.favoriteGameType,
    bestTime: dbStats.bestTime,
    highestAccuracy: dbStats.highestAccuracy,
  };
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { data: dbStats, isLoading } = useUserStats();
  const { mutate: updateStats } = useUpdateUserStats();

  const profile = toClientProfile(dbStats);

  const updateGameStats = (stats: Partial<UserStatsProfile>) => {
    updateStats(stats);
  };

  const resetProfile = () => {
    updateStats(defaultProfile);
  };

  const contextValue: UserProfileContextType = {
    profile,
    updateGameStats,
    resetProfile,
    isLoading,
  };

  return (
    <UserProfileContext.Provider value={contextValue}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileContextType {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
}
