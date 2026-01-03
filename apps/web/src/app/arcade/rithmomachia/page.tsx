"use client";

import { rithmomachiaGame } from "@/arcade-games/rithmomachia";

// Force dynamic rendering to avoid build-time initialization errors
export const dynamic = "force-dynamic";

const { Provider, GameComponent } = rithmomachiaGame;

export default function RithmomachiaPage() {
  return (
    <Provider>
      <GameComponent />
    </Provider>
  );
}
