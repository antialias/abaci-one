"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { css } from "../../styled-system/css";
import {
  FullscreenProvider,
  useFullscreen,
} from "../contexts/FullscreenContext";

interface FullscreenGameLayoutProps {
  children: ReactNode;
  title: string;
}

function FullscreenGameContent({ children, title }: FullscreenGameLayoutProps) {
  const router = useRouter();
  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen();

  // Note: Automatic fullscreen entry removed - users must manually enter fullscreen
  // Client-side navigation now preserves fullscreen state without needing auto-entry

  const _handleExitGame = () => {
    console.log(
      "🔄 FullscreenGameLayout: Navigating to arcade with Next.js router (no page reload)",
    );
    // Navigate back to arcade using client-side routing
    router.push("/arcade");
  };

  return (
    <div
      className={css({
        minH: "screen",
        background: isFullscreen
          ? "linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)"
          : "white",
      })}
    >
      {/* Note: Fullscreen navigation is now handled by the enhanced AppNavBar */}

      {/* Game content */}
      <div
        className={css({
          pt: isFullscreen ? "16" : "0", // Account for fixed nav in fullscreen
          minH: "screen",
        })}
      >
        {children}
      </div>
    </div>
  );
}

export function FullscreenGameLayout({
  children,
  title,
}: FullscreenGameLayoutProps) {
  return (
    <FullscreenProvider>
      <FullscreenGameContent title={title}>{children}</FullscreenGameContent>
    </FullscreenProvider>
  );
}
