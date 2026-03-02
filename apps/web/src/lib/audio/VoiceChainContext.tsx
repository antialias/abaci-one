'use client'

/**
 * Nestable context for stacking voice sources onto the global TTS voice chain.
 *
 * Each <VoiceChainProvider> prepends its voices on top of any parent's,
 * so the innermost provider has highest priority.
 */

import { createContext, useContext, useMemo } from 'react'
import type { VoiceSource } from './voiceSource'

const VoiceChainContext = createContext<VoiceSource[]>([])

/** Read the accumulated voice-chain overrides from context. */
export function useVoiceChainOverrides(): VoiceSource[] {
  return useContext(VoiceChainContext)
}

/**
 * Stack additional voice sources on top of any parent chain.
 *
 * Nesting multiple providers concatenates their voices (inner first):
 * ```tsx
 * <VoiceChainProvider voices={[ash]}>       // outer
 *   <VoiceChainProvider voices={[echo]}>    // inner
 *     {/* effective: [echo, ash] *\/}
 *   </VoiceChainProvider>
 * </VoiceChainProvider>
 * ```
 */
export function VoiceChainProvider({
  voices,
  children,
}: {
  voices: VoiceSource[]
  children: React.ReactNode
}) {
  const parentChain = useContext(VoiceChainContext)
  const combined = useMemo(() => [...voices, ...parentChain], [voices, parentChain])
  return <VoiceChainContext.Provider value={combined}>{children}</VoiceChainContext.Provider>
}
