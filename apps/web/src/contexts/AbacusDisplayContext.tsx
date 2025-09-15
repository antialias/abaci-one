'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'

// Abacus display configuration types
export type ColorScheme = 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating'
export type BeadShape = 'diamond' | 'circle' | 'square'

export interface AbacusDisplayConfig {
  colorScheme: ColorScheme
  beadShape: BeadShape
  hideInactiveBeads: boolean
  coloredNumerals: boolean
  scaleFactor: number
}

export interface AbacusDisplayContextType {
  config: AbacusDisplayConfig
  updateConfig: (updates: Partial<AbacusDisplayConfig>) => void
  resetToDefaults: () => void
}

// Default configuration - matches current create page defaults
const DEFAULT_CONFIG: AbacusDisplayConfig = {
  colorScheme: 'place-value',
  beadShape: 'diamond',
  hideInactiveBeads: false,
  coloredNumerals: false,
  scaleFactor: 1.0 // Normalized for display, can be scaled per component
}

const STORAGE_KEY = 'soroban-abacus-display-config'

// Load config from localStorage with fallback to defaults
function loadConfigFromStorage(): AbacusDisplayConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate that all required fields are present and have valid values
      return {
        colorScheme: ['monochrome', 'place-value', 'heaven-earth', 'alternating'].includes(parsed.colorScheme)
          ? parsed.colorScheme : DEFAULT_CONFIG.colorScheme,
        beadShape: ['diamond', 'circle', 'square'].includes(parsed.beadShape)
          ? parsed.beadShape : DEFAULT_CONFIG.beadShape,
        hideInactiveBeads: typeof parsed.hideInactiveBeads === 'boolean'
          ? parsed.hideInactiveBeads : DEFAULT_CONFIG.hideInactiveBeads,
        coloredNumerals: typeof parsed.coloredNumerals === 'boolean'
          ? parsed.coloredNumerals : DEFAULT_CONFIG.coloredNumerals,
        scaleFactor: typeof parsed.scaleFactor === 'number' && parsed.scaleFactor > 0
          ? parsed.scaleFactor : DEFAULT_CONFIG.scaleFactor
      }
    }
  } catch (error) {
    console.warn('Failed to load abacus config from localStorage:', error)
  }

  return DEFAULT_CONFIG
}

// Save config to localStorage
function saveConfigToStorage(config: AbacusDisplayConfig): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (error) {
    console.warn('Failed to save abacus config to localStorage:', error)
  }
}

const AbacusDisplayContext = createContext<AbacusDisplayContextType | null>(null)

export function useAbacusDisplay() {
  const context = useContext(AbacusDisplayContext)
  if (!context) {
    throw new Error('useAbacusDisplay must be used within an AbacusDisplayProvider')
  }
  return context
}

interface AbacusDisplayProviderProps {
  children: ReactNode
  initialConfig?: Partial<AbacusDisplayConfig>
}

export function AbacusDisplayProvider({
  children,
  initialConfig = {}
}: AbacusDisplayProviderProps) {
  const [config, setConfig] = useState<AbacusDisplayConfig>(() => {
    // Always start with defaults to ensure server/client consistency
    return { ...DEFAULT_CONFIG, ...initialConfig }
  })

  // Load from localStorage only after hydration
  useEffect(() => {
    const stored = loadConfigFromStorage()
    setConfig(stored)
  }, [])

  // Save to localStorage whenever config changes
  useEffect(() => {
    saveConfigToStorage(config)
  }, [config])

  const updateConfig = useCallback((updates: Partial<AbacusDisplayConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...updates }
      return newConfig
    })
  }, [])

  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
  }, [])

  const value: AbacusDisplayContextType = {
    config,
    updateConfig,
    resetToDefaults
  }

  return (
    <AbacusDisplayContext.Provider value={value}>
      {children}
    </AbacusDisplayContext.Provider>
  )
}

// Convenience hook for components that need specific config values
export function useAbacusConfig() {
  const { config } = useAbacusDisplay()
  return config
}