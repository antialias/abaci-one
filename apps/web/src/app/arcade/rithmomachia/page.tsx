'use client'

import { rithmomachiaGame } from '@/arcade-games/rithmomachia'

const { Provider, GameComponent } = rithmomachiaGame

export default function RithmomachiaPage() {
  return (
    <Provider>
      <GameComponent />
    </Provider>
  )
}
