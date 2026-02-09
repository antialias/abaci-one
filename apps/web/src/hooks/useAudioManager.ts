'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import type { ManagerSnapshot } from '@/lib/audio/TtsAudioManager'

const LS_KEY_ENABLED = 'audio-help-enabled'
const LS_KEY_VOLUME = 'audio-help-volume'

export interface UseAudioManagerReturn extends ManagerSnapshot {
  stop: () => void
  setEnabled: (enabled: boolean) => void
  setVolume: (volume: number) => void
}

export function useAudioManager(): UseAudioManagerReturn {
  const manager = useAudioManagerInstance()

  const snapshot = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot
  )

  const stop = useCallback(() => manager.stop(), [manager])

  const setEnabled = useCallback(
    (enabled: boolean) => {
      manager.configure({ enabled })
      try {
        localStorage.setItem(LS_KEY_ENABLED, String(enabled))
      } catch {}
    },
    [manager]
  )

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v))
      manager.configure({ volume: clamped })
      try {
        localStorage.setItem(LS_KEY_VOLUME, String(Math.round(clamped * 100)))
      } catch {}
    },
    [manager]
  )

  return {
    ...snapshot,
    stop,
    setEnabled,
    setVolume,
  }
}
