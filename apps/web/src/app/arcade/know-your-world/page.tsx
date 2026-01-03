"use client";

import dynamicImport from "next/dynamic";

// Opt-out of static generation due to ES module dependencies in map data
export const dynamic = "force-dynamic";

// Dynamically import the game with SSR disabled to avoid ES module loading issues during build
const KnowYourWorldGame = dynamicImport(
  async () => {
    const { knowYourWorldGame } = await import(
      "@/arcade-games/know-your-world"
    );
    const { Provider, GameComponent } = knowYourWorldGame;

    return function Game() {
      return (
        <Provider>
          <GameComponent />
        </Provider>
      );
    };
  },
  { ssr: false, loading: () => <div>Loading...</div> },
);

export default function KnowYourWorldPage() {
  return <KnowYourWorldGame />;
}
