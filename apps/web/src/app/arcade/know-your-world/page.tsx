'use client'

import { knowYourWorldGame } from '@/arcade-games/know-your-world'

const { Provider, GameComponent } = knowYourWorldGame

// Opt-out of static generation due to ES module dependencies in map data
export const dynamic = 'force-dynamic'

export default function KnowYourWorldPage() {
  return (
    <Provider>
      <GameComponent />
    </Provider>
  )
}
