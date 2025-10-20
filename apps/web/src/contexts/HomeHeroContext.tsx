'use client'

import type React from 'react'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Subtitle } from '../data/abaciOneSubtitles'
import { subtitles } from '../data/abaciOneSubtitles'

interface HomeHeroContextValue {
  subtitle: Subtitle
  abacusValue: number
  setAbacusValue: (value: number) => void
  isHeroVisible: boolean
  setIsHeroVisible: (visible: boolean) => void
  isAbacusLoaded: boolean
}

const HomeHeroContext = createContext<HomeHeroContextValue | null>(null)

export { HomeHeroContext }

export function HomeHeroProvider({ children }: { children: React.ReactNode }) {
  // Use first subtitle for SSR, then select random one on client mount
  const [subtitle, setSubtitle] = useState<Subtitle>(subtitles[0])

  // Select random subtitle only on client side, persist per-session
  useEffect(() => {
    // Check if we have a stored subtitle index for this session
    const storedIndex = sessionStorage.getItem('heroSubtitleIndex')

    if (storedIndex !== null) {
      // Use the stored subtitle index
      const index = parseInt(storedIndex, 10)
      if (!Number.isNaN(index) && index >= 0 && index < subtitles.length) {
        setSubtitle(subtitles[index])
        return
      }
    }

    // Generate a new random index and store it
    const randomIndex = Math.floor(Math.random() * subtitles.length)
    sessionStorage.setItem('heroSubtitleIndex', randomIndex.toString())
    setSubtitle(subtitles[randomIndex])
  }, [])

  // Shared abacus value - always start at 0 for SSR/hydration consistency
  const [abacusValue, setAbacusValue] = useState(0)
  const [isAbacusLoaded, setIsAbacusLoaded] = useState(false)
  const isLoadingFromStorage = useRef(false)

  // Load from sessionStorage after mount (client-only, no hydration mismatch)
  useEffect(() => {
    console.log('[HeroAbacus] Loading from sessionStorage...')
    isLoadingFromStorage.current = true // Block saves during load

    const saved = sessionStorage.getItem('heroAbacusValue')
    console.log('[HeroAbacus] Saved value from storage:', saved)

    if (saved) {
      const parsedValue = parseInt(saved, 10)
      console.log('[HeroAbacus] Parsed value:', parsedValue)
      if (!Number.isNaN(parsedValue)) {
        console.log('[HeroAbacus] Setting abacus value to:', parsedValue)
        setAbacusValue(parsedValue)
      }
    } else {
      console.log('[HeroAbacus] No saved value found, staying at 0')
    }

    // Use setTimeout to ensure the value has been set before we allow saves
    setTimeout(() => {
      isLoadingFromStorage.current = false
      setIsAbacusLoaded(true)
      console.log('[HeroAbacus] Load complete, allowing saves now and fading in')
    }, 0)
  }, [])

  // Persist value to sessionStorage when it changes (but skip during load)
  useEffect(() => {
    console.log(
      '[HeroAbacus] Save effect triggered. Value:',
      abacusValue,
      'isLoadingFromStorage:',
      isLoadingFromStorage.current
    )

    if (!isLoadingFromStorage.current) {
      console.log('[HeroAbacus] Saving to sessionStorage:', abacusValue)
      sessionStorage.setItem('heroAbacusValue', abacusValue.toString())
      console.log(
        '[HeroAbacus] Saved successfully. Storage now contains:',
        sessionStorage.getItem('heroAbacusValue')
      )
    } else {
      console.log('[HeroAbacus] Skipping save (currently loading from storage)')
    }
  }, [abacusValue])

  // Track hero visibility for nav branding
  const [isHeroVisible, setIsHeroVisible] = useState(true)

  const value = useMemo(
    () => ({
      subtitle,
      abacusValue,
      setAbacusValue,
      isHeroVisible,
      setIsHeroVisible,
      isAbacusLoaded,
    }),
    [subtitle, abacusValue, isHeroVisible, isAbacusLoaded]
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
