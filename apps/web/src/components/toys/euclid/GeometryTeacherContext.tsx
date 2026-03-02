'use client'

/**
 * React context for the active geometry teacher character.
 *
 * Provides a GeometryTeacherConfig to all descendants, allowing
 * components and hooks to read character-specific config without
 * hardcoding imports.
 */

import { createContext, useContext } from 'react'
import type { GeometryTeacherConfig } from './GeometryTeacherConfig'

const GeometryTeacherContext = createContext<GeometryTeacherConfig | null>(null)

export function GeometryTeacherProvider({
  config,
  children,
}: {
  config: GeometryTeacherConfig
  children: React.ReactNode
}) {
  return (
    <GeometryTeacherContext.Provider value={config}>{children}</GeometryTeacherContext.Provider>
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
