'use client'

import { musicMatchingGame } from '@/arcade-games/music-matching'

// Force dynamic rendering to avoid build-time initialization errors
export const dynamic = 'force-dynamic'

const { Provider, GameComponent } = musicMatchingGame

export default function MusicMatchingPage() {
  return (
    <Provider>
      <GameComponent />
    </Provider>
  )
}
