import { useState, useEffect, useRef } from 'react'
import type { ChatCallState, ChatMessage } from '@/lib/character/types'
import { generateId } from '@/lib/character/useCharacterChat'
import type { UseGeometryVoiceReturn } from '../agent/useGeometryVoice'

interface UseChatModeManagerOptions {
  euclidVoice: UseGeometryVoiceReturn
  euclidCallVisible: boolean
  hecklerPreDialRef: React.MutableRefObject<boolean>
  addMessage: (msg: ChatMessage) => void
}

export function useChatModeManager({
  euclidVoice,
  euclidCallVisible,
  hecklerPreDialRef,
  addMessage,
}: UseChatModeManagerOptions) {
  // Chat mode: closed (hidden), docked (in proof column), floating (old quad popup)
  const [chatMode, setChatMode] = useState<'closed' | 'docked' | 'floating'>('closed')
  const [mobileDockedExpanded, setMobileDockedExpanded] = useState(false)

  // Floating chat animation (only when mode === 'floating')
  const [chatMounted, setChatMounted] = useState(false)
  const [chatExpanded, setChatExpanded] = useState(false)

  useEffect(() => {
    if (chatMode === 'floating') {
      setChatMounted(true)
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setChatExpanded(true))
      })
      return () => cancelAnimationFrame(raf)
    } else {
      setChatExpanded(false)
      if (chatMounted) {
        const timer = setTimeout(() => setChatMounted(false), 250)
        return () => clearTimeout(timer)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMode])

  // Auto-open docked chat when a visible call starts (skip heckler pre-dial)
  useEffect(() => {
    if (euclidVoice.state === 'active' && chatMode === 'closed') {
      setChatMode('docked')
    }
    // Also open on normal ringing (non-heckler pre-dial)
    if (euclidVoice.state === 'ringing' && !hecklerPreDialRef.current && chatMode === 'closed') {
      setChatMode('docked')
    }
  }, [euclidVoice.state, chatMode])

  // Build chatCallState from euclidVoice
  const chatCallState: ChatCallState | undefined = euclidCallVisible
    ? {
        state: euclidVoice.state as ChatCallState['state'],
        timeRemaining: euclidVoice.timeRemaining,
        isSpeaking: euclidVoice.isSpeaking,
        isThinking: euclidVoice.isThinking,
        thinkingLabel: 'Consulting scrolls',
        error: euclidVoice.error,
        errorCode: euclidVoice.errorCode,
        onHangUp: euclidVoice.hangUp,
        onRetry: euclidVoice.dial,
      }
    : undefined

  // Inject "Call ended" event when transitioning from active → ending
  const prevVoiceStateRef = useRef(euclidVoice.state)
  useEffect(() => {
    const prev = prevVoiceStateRef.current
    prevVoiceStateRef.current = euclidVoice.state
    if (prev === 'active' && euclidVoice.state === 'ending') {
      addMessage({
        id: generateId(),
        role: 'user' as const,
        content: 'Call ended',
        timestamp: Date.now(),
        isEvent: true,
      })
    }
  }, [euclidVoice.state, addMessage])

  return {
    chatMode,
    setChatMode,
    mobileDockedExpanded,
    setMobileDockedExpanded,
    chatMounted,
    chatExpanded,
    chatCallState,
  }
}
