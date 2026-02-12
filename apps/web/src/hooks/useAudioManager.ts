'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import type { ManagerSnapshot, SubtitleAnchor } from '@/lib/audio/TtsAudioManager'

const LS_KEY_ENABLED = 'audio-help-enabled'
const LS_KEY_VOLUME = 'audio-help-volume'
const LS_KEY_SUBTITLE_SPEED = 'audio-subtitle-speed'

export interface UseAudioManagerReturn extends ManagerSnapshot {
  stop: () => void
  setEnabled: (enabled: boolean) => void
  setVolume: (volume: number) => void
  dismissSubtitle: () => void
  setSubtitleDurationMultiplier: (multiplier: number) => void
  setSubtitleBottomOffset: (offset: number) => void
  setSubtitleAnchor: (anchor: SubtitleAnchor) => void
}

export function useAudioManager(): UseAudioManagerReturn {
  const manager = useAudioManagerInstance()

  const snapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot)

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

  const dismissSubtitle = useCallback(() => manager.dismissSubtitle(), [manager])

  const setSubtitleDurationMultiplier = useCallback(
    (multiplier: number) => {
      manager.configure({ subtitleDurationMultiplier: multiplier })
      try {
        localStorage.setItem(LS_KEY_SUBTITLE_SPEED, String(multiplier))
      } catch {}
    },
    [manager]
  )

  const setSubtitleBottomOffset = useCallback(
    (offset: number) => {
      manager.configure({ subtitleBottomOffset: offset })
    },
    [manager]
  )

  const setSubtitleAnchor = useCallback(
    (anchor: SubtitleAnchor) => {
      manager.configure({ subtitleAnchor: anchor })
    },
    [manager]
  )

  return {
    ...snapshot,
    stop,
    setEnabled,
    setVolume,
    dismissSubtitle,
    setSubtitleDurationMultiplier,
    setSubtitleBottomOffset,
    setSubtitleAnchor,
  }
}
