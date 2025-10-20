'use client'

import type React from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Subtitle } from '../data/abaciOneSubtitles'
import { getRandomSubtitle, subtitles } from '../data/abaciOneSubtitles'

interface HomeHeroContextValue {
  subtitle: Subtitle
  abacusValue: number
  setAbacusValue: (value: number) => void
  isHeroVisible: boolean
  setIsHeroVisible: (visible: boolean) => void
}

const HomeHeroContext = createContext<HomeHeroContextValue | null>(null)

export { HomeHeroContext }

export function HomeHeroProvider({ children }: { children: React.ReactNode }) {
  // Use first subtitle for SSR, then select random one on client mount
  const [subtitle, setSubtitle] = useState<Subtitle>(subtitles[0])

  // Select random subtitle only on client side to avoid SSR mismatch
  useEffect(() => {
    setSubtitle(getRandomSubtitle())
  }, [])

  // Shared abacus value (so it stays consistent during morph)
  const [abacusValue, setAbacusValue] = useState(1234)

  // Track hero visibility for nav branding
  const [isHeroVisible, setIsHeroVisible] = useState(true)

  const value = useMemo(
    () => ({
      subtitle,
      abacusValue,
      setAbacusValue,
      isHeroVisible,
      setIsHeroVisible,
    }),
    [subtitle, abacusValue, isHeroVisible]
  )

  return <HomeHeroContext.Provider value={value}>{children}</HomeHeroContext.Provider>
}

export function useHomeHero() {
  const context = useContext(HomeHeroContext)
  if (!context) {
    throw new Error('useHomeHero must be used within HomeHeroProvider')
  }
  return context
}
