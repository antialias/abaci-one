'use client'

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { TtsAudioManager } from '@/lib/audio/TtsAudioManager'
import { SubtitleOverlay } from '@/components/audio/SubtitleOverlay'

const LS_KEY_ENABLED = 'audio-help-enabled'
const LS_KEY_VOLUME = 'audio-help-volume'

function readLocalStorage(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

const AudioManagerContext = createContext<TtsAudioManager | null>(null)

export function AudioManagerProvider({ children }: { children: ReactNode }) {
  const managerRef = useRef<TtsAudioManager | null>(null)
  if (!managerRef.current) {
    managerRef.current = new TtsAudioManager()
  }
  const manager = managerRef.current

  // Apply persisted enabled / volume on first render
  useEffect(() => {
    const enabled = readLocalStorage(LS_KEY_ENABLED, 'false') === 'true'
    const volume = Number(readLocalStorage(LS_KEY_VOLUME, '80')) / 100
    manager.configure({ enabled, volume })
  }, [manager])

  // Flush collected clips on visibility change and before unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        manager.flush()
      }
    }
    const handleBeforeUnload = () => {
      manager.flush()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [manager])

  // Load pre-generated clip manifest on mount
  useEffect(() => {
    let cancelled = false
    fetch('/api/settings/voice-chain')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.voiceChain) {
          manager.loadPregenManifest(data.voiceChain)
        }
      })
      .catch(() => {
        // Non-fatal — browser TTS fallback works without manifest
      })
    return () => {
      cancelled = true
    }
  }, [manager])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      manager.flush()
      manager.dispose()
    }
  }, [manager])

  return (
    <AudioManagerContext.Provider value={manager}>
      {children}
      <SubtitleOverlay />
    </AudioManagerContext.Provider>
  )
}

/**
 * Access the raw TtsAudioManager instance.
 * Prefer `useAudioManager()` for reactive state.
 */
export function useAudioManagerInstance(): TtsAudioManager {
  const ctx = useContext(AudioManagerContext)
  if (!ctx) {
    throw new Error('useAudioManagerInstance must be used within AudioManagerProvider')
  }
  return ctx
}
