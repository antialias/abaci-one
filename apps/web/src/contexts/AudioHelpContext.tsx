'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { clearCache, preloadClips, closeAudioContext } from '@/lib/audio/audioClipCache'
import { playSequence as playSeq, cancel as cancelSeq } from '@/lib/audio/audioSequencer'
import type { SequenceItem } from '@/lib/audio/problemReader'

const LS_KEY_ENABLED = 'audio-help-enabled'
const LS_KEY_VOLUME = 'audio-help-volume'

const COMMON_CLIP_IDS = [
  'number-0',
  'number-1',
  'number-2',
  'number-3',
  'number-4',
  'number-5',
  'number-6',
  'number-7',
  'number-8',
  'number-9',
  'number-10',
  'operator-plus',
  'operator-minus',
  'feedback-correct',
  'feedback-great-job',
  'feedback-nice-work',
  'feedback-the-answer-is',
  'feedback-try-again',
]

interface AudioHelpContextValue {
  isEnabled: boolean
  setEnabled: (enabled: boolean) => void
  volume: number
  setVolume: (volume: number) => void
  playSequence: (items: SequenceItem[]) => Promise<void>
  playClip: (clipId: string) => Promise<void>
  stop: () => void
  isPlaying: boolean
}

const AudioHelpContext = createContext<AudioHelpContextValue | null>(null)

function readLocalStorage(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function AudioHelpProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setEnabledState] = useState(
    () => readLocalStorage(LS_KEY_ENABLED, 'false') === 'true'
  )
  const [volume, setVolumeState] = useState(
    () => Number(readLocalStorage(LS_KEY_VOLUME, '80')) / 100
  )
  const [playing, setPlaying] = useState(false)
  const [voice, setVoice] = useState<string | null>(null)
  const preloadedRef = useRef(false)
  const prevVoiceRef = useRef<string | null>(null)

  // Fetch active voice from server on mount
  useEffect(() => {
    let cancelled = false
    fetch('/api/settings/audio-voice')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.audioVoice) {
          setVoice(data.audioVoice)
        }
      })
      .catch(() => {
        // Fall back to 'nova' if fetch fails
        if (!cancelled) setVoice('nova')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Clear buffer cache when voice changes
  useEffect(() => {
    if (voice && prevVoiceRef.current && prevVoiceRef.current !== voice) {
      clearCache()
      preloadedRef.current = false
    }
    prevVoiceRef.current = voice
  }, [voice])

  const setEnabled = useCallback((enabled: boolean) => {
    setEnabledState(enabled)
    try {
      localStorage.setItem(LS_KEY_ENABLED, String(enabled))
    } catch {}
    if (!enabled) {
      cancelSeq()
      setPlaying(false)
    }
  }, [])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    setVolumeState(clamped)
    try {
      localStorage.setItem(LS_KEY_VOLUME, String(Math.round(clamped * 100)))
    } catch {}
  }, [])

  // Preload common clips when first enabled and voice is loaded
  useEffect(() => {
    if (isEnabled && !preloadedRef.current && voice) {
      preloadedRef.current = true
      preloadClips(COMMON_CLIP_IDS, voice)
    }
  }, [isEnabled, voice])

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      cancelSeq()
      closeAudioContext()
    }
  }, [])

  const playSequence = useCallback(
    async (items: SequenceItem[]) => {
      if (!isEnabled || !voice) return
      setPlaying(true)
      try {
        await playSeq(items, volume, voice)
      } finally {
        setPlaying(false)
      }
    },
    [isEnabled, volume, voice]
  )

  const playClip = useCallback(
    async (clipId: string) => {
      if (!isEnabled || !voice) return
      setPlaying(true)
      try {
        await playSeq([{ clipId, pauseAfterMs: 0 }], volume, voice)
      } finally {
        setPlaying(false)
      }
    },
    [isEnabled, volume, voice]
  )

  const stop = useCallback(() => {
    cancelSeq()
    setPlaying(false)
  }, [])

  const value = useMemo(
    (): AudioHelpContextValue => ({
      isEnabled,
      setEnabled,
      volume,
      setVolume,
      playSequence,
      playClip,
      stop,
      isPlaying: playing,
    }),
    [isEnabled, setEnabled, volume, setVolume, playSequence, playClip, stop, playing]
  )

  return <AudioHelpContext.Provider value={value}>{children}</AudioHelpContext.Provider>
}

export function useAudioHelp(): AudioHelpContextValue {
  const ctx = useContext(AudioHelpContext)
  if (!ctx) {
    throw new Error('useAudioHelp must be used within AudioHelpProvider')
  }
  return ctx
}
