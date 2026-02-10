'use client'

import { useEffect, useRef } from 'react'
import { useTTS } from '@/hooks/useTTS'
import type { TransitionMessage } from '../partTransitionMessages'

interface UsePartTransitionAudioOptions {
  isVisible: boolean
  message: TransitionMessage
  abacusAction: string | null
}

/**
 * Speaks the part transition message when the transition screen becomes visible.
 *
 * Uses hash-based clip IDs since messages are randomly selected from pools.
 * Only plays once per visibility change.
 */
export function usePartTransitionAudio({
  isVisible,
  message,
  abacusAction,
}: UsePartTransitionAudioOptions) {
  const spokenText = [message.headline, message.subtitle, abacusAction].filter(Boolean).join('. ')

  const speak = useTTS({ say: { en: spokenText }, tone: 'tutorial-instruction' })

  const hasPlayedRef = useRef(false)

  useEffect(() => {
    if (isVisible && !hasPlayedRef.current) {
      hasPlayedRef.current = true
      speak()
    }
    if (!isVisible) {
      hasPlayedRef.current = false
    }
  }, [isVisible, speak])
}
