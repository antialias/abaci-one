'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { CONSTANT_IDS } from '@/components/toys/number-line/talkToNumber/explorationRegistry'

/** All constant IDs that have demos + narration available */
const DEMO_CONSTANT_IDS = [...CONSTANT_IDS]

const ConstantExplorerContext = createContext<{ constantId: string }>({
  constantId: 'pi',
})

export function useConstantExplorerConfig() {
  return useContext(ConstantExplorerContext)
}

/**
 * Provider for the constant-explorer "game".
 *
 * Unlike arcade games, this doesn't use useArcadeSession — there are no moves
 * or networked state. It picks a random constant ID on mount and provides it
 * to the GameComponent via context.
 */
export function ConstantExplorerProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => {
    const constantId = DEMO_CONSTANT_IDS[Math.floor(Math.random() * DEMO_CONSTANT_IDS.length)]
    return { constantId }
  }, [])

  return (
    <ConstantExplorerContext.Provider value={value}>{children}</ConstantExplorerContext.Provider>
  )
}
