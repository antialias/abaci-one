'use client'

import { knowYourWorldGame } from '@/arcade-games/know-your-world'

const { Provider, GameComponent } = knowYourWorldGame

export default function KnowYourWorldPage() {
  return (
    <Provider>
      <GameComponent />
    </Provider>
  )
}
