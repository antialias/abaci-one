'use client'

/**
 * React context for the active geometry teacher character.
 *
 * Provides a GeometryTeacherConfig to all descendants, allowing
 * components and hooks to read character-specific config without
 * hardcoding imports.
 *
 * Also wraps children in a VoiceChainProvider so that any useTTS
 * calls within the subtree automatically use the character's voice.
 */

import { createContext, useContext, useMemo } from 'react'
import type { GeometryTeacherConfig } from './GeometryTeacherConfig'
import { VoiceChainProvider } from '@/lib/audio/VoiceChainContext'
import { PregeneratedVoice } from '@/lib/audio/voiceSource'

const GeometryTeacherContext = createContext<GeometryTeacherConfig | null>(null)

export function GeometryTeacherProvider({
  config,
  children,
}: {
  config: GeometryTeacherConfig
  children: React.ReactNode
}) {
  const ttsVoice = config.voice.ttsVoice ?? config.voice.id
  const characterChain = useMemo(() => [new PregeneratedVoice(ttsVoice)], [ttsVoice])

  return (
    <GeometryTeacherContext.Provider value={config}>
      <VoiceChainProvider voices={characterChain}>{children}</VoiceChainProvider>
    </GeometryTeacherContext.Provider>
  )
}

/** Read the active geometry teacher config. Throws if used outside a provider. */
export function useGeometryTeacher(): GeometryTeacherConfig {
  const config = useContext(GeometryTeacherContext)
  if (!config) {
    throw new Error('useGeometryTeacher must be used within a GeometryTeacherProvider')
  }
  return config
}
