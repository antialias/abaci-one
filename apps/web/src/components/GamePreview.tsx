"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  GameComponent,
  GameProviderComponent,
} from "@/lib/arcade/game-sdk/types";
import { MockArcadeEnvironment } from "./MockArcadeEnvironment";
import { PreviewModeContext } from "@/contexts/PreviewModeContext";
import { ViewportProvider } from "@/contexts/ViewportContext";
import { getMockGameState } from "./MockGameStates";

// Re-export for backwards compatibility
export { PreviewModeContext } from "@/contexts/PreviewModeContext";

// Dynamic import breaks webpack's import chain, preventing useRoomData
// from being bundled with useUserPlayers in shared chunks
const GameModeProviderWithHooks = dynamic(
  () =>
    import("@/contexts/GameModeProviderWithHooks").then(
      (m) => m.GameModeProviderWithHooks,
    ),
  { ssr: false },
);

interface GamePreviewProps {
  GameComponent: GameComponent;
  Provider: GameProviderComponent;
  gameName: string;
}

/**
 * Error boundary to prevent game errors from crashing the page
 */
class GameErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(`Game preview error (${error.message}):`, error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Wrapper for displaying games in demo/preview mode
 * Provides mock arcade contexts so games can render
 */
export function GamePreview({
  GameComponent,
  Provider,
  gameName,
}: GamePreviewProps) {
  // Don't render on first mount to avoid hydration issues
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get mock state for this game
  const mockState = useMemo(() => getMockGameState(gameName), [gameName]);

  // Preview mode context value
  const previewModeValue = useMemo(
    () => ({
      isPreview: true,
      mockState,
    }),
    [mockState],
  );

  if (!mounted) {
    return null;
  }

  return (
    <GameErrorBoundary
      fallback={
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "rgba(255, 255, 255, 0.4)",
            fontSize: "14px",
            textAlign: "center",
            padding: "20px",
          }}
        >
          <span style={{ fontSize: "48px", marginBottom: "10px" }}>🎮</span>
          Game Demo
        </div>
      }
    >
      <PreviewModeContext.Provider value={previewModeValue}>
        <MockArcadeEnvironment gameName={gameName}>
          <GameModeProviderWithHooks>
            {/*
              Mock viewport: Provide 1440x900 dimensions to games via ViewportContext
              This prevents layout issues when games check viewport size
            */}
            <ViewportProvider width={1440} height={900}>
              <div
                style={{
                  width: "1440px",
                  height: "900px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <Provider>
                  <GameComponent />
                </Provider>
              </div>
            </ViewportProvider>
          </GameModeProviderWithHooks>
        </MockArcadeEnvironment>
      </PreviewModeContext.Provider>
    </GameErrorBoundary>
  );
}
