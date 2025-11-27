import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { getLanguageForRegion, speakText, shouldShowAccentOption } from '../utils/speechSynthesis'

// Map app locales to BCP 47 language tags for speech synthesis
const LOCALE_TO_LANG: Record<string, string> = {
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  ja: 'ja-JP',
  hi: 'hi-IN',
  la: 'it-IT', // Latin fallback to Italian (closest available)
  goh: 'de-DE', // Old High German fallback to German
}

/**
 * Hook to manage available speech synthesis voices.
 * Handles the async loading of voices across different browsers.
 */
export function useAvailableVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    // Check if speech synthesis is available
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return
    }

    const updateVoices = () => {
      const availableVoices = speechSynthesis.getVoices()
      setVoices(availableVoices)
    }

    // Try immediately (works in some browsers like Firefox)
    updateVoices()

    // Listen for async load (required in Chrome, Safari, etc.)
    speechSynthesis.addEventListener('voiceschanged', updateVoices)

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', updateVoices)
    }
  }, [])

  return voices
}

/**
 * Hook to speak hints with region-appropriate voices.
 *
 * Returns:
 * - speak: function to speak text (respects withAccent param)
 * - stop: function to stop speaking
 * - isSpeaking: whether currently speaking
 * - isSupported: whether speech synthesis is available
 * - hasAccentOption: whether region language differs from user's locale
 */
export function useSpeakHint(map: string, regionId: string | null) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)
  const voices = useAvailableVoices()
  const locale = useLocale()

  // Check if speech synthesis is supported
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Get language codes
  const userLang = LOCALE_TO_LANG[locale] || 'en-US'
  const regionLang = regionId ? getLanguageForRegion(map, regionId) : userLang

  // Check if accent option should be shown
  // This considers both language difference AND voice quality
  const hasAccentOption = useMemo(() => {
    return shouldShowAccentOption(voices, regionLang, userLang)
  }, [voices, regionLang, userLang])

  // Clean up on unmount or when region changes
  useEffect(() => {
    return () => {
      if (cancelRef.current) {
        cancelRef.current()
        cancelRef.current = null
      }
    }
  }, [regionId])

  // Internal speak function that takes a language
  const speakWithLang = useCallback(
    (text: string, targetLang: string) => {
      if (!isSupported) return

      // Cancel any ongoing speech
      if (cancelRef.current) {
        cancelRef.current()
      }

      const { cancel } = speakText(text, targetLang, {
        rate: 0.85, // Slower for children
        onStart: () => setIsSpeaking(true),
        onEnd: () => {
          setIsSpeaking(false)
          cancelRef.current = null
        },
        onError: () => {
          setIsSpeaking(false)
          cancelRef.current = null
        },
      })

      cancelRef.current = cancel
    },
    [isSupported]
  )

  // Speak text, optionally with region accent
  const speak = useCallback(
    (text: string, withAccent: boolean = false) => {
      const targetLang = withAccent && hasAccentOption ? regionLang : userLang
      speakWithLang(text, targetLang)
    },
    [hasAccentOption, regionLang, userLang, speakWithLang]
  )

  const stop = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current()
      cancelRef.current = null
    }
    setIsSpeaking(false)
  }, [])

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
    hasVoices: voices.length > 0,
    hasAccentOption,
  }
}
