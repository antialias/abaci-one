"use client";

import { useEffect, useRef } from "react";
import { PageWithNav } from "@/components/PageWithNav";
import { useArcadeRedirect } from "@/hooks/useArcadeRedirect";
import { css } from "../../../styled-system/css";
import { EnhancedChampionArena } from "../../components/EnhancedChampionArena";
import {
  FullscreenProvider,
  useFullscreen,
} from "../../contexts/FullscreenContext";

function ArcadeContent() {
  const { setFullscreenElement } = useFullscreen();
  const arcadeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Register this component's main div as the fullscreen element
    if (arcadeRef.current) {
      setFullscreenElement(arcadeRef.current);
    }
  }, [setFullscreenElement]);

  return (
    <div
      ref={arcadeRef}
      className={css({
        minHeight: "calc(100vh - 80px)", // Account for mini nav height
        background:
          "linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        py: { base: "4", md: "6" },
      })}
    >
      {/* Animated background elements */}
      <div
        className={css({
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%)
        `,
          animation: "arcadeFloat 20s ease-in-out infinite",
        })}
      />

      {/* Main Champion Arena - takes remaining space */}
      <div
        className={css({
          flex: 1,
          display: "flex",
          px: { base: "2", md: "4" },
          position: "relative",
          zIndex: 1,
          minHeight: 0, // Important for flex children
        })}
      >
        <EnhancedChampionArena
          onConfigurePlayer={() => {}}
          className={css({
            width: "100%",
            height: "100%",
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
            display: "flex",
            flexDirection: "column",
          })}
        />
      </div>
    </div>
  );
}

function ArcadePageWithRedirect() {
  const { canModifyPlayers } = useArcadeRedirect({ currentGame: null });

  return (
    <PageWithNav
      navTitle="Champion Arena"
      navEmoji="🏟️"
      emphasizeGameContext={true}
      canModifyPlayers={canModifyPlayers}
    >
      <ArcadeContent />
    </PageWithNav>
  );
}

export default function ArcadePage() {
  return (
    <FullscreenProvider>
      <ArcadePageWithRedirect />
    </FullscreenProvider>
  );
}

// Arcade-specific animations
const arcadeAnimations = `
@keyframes arcadeFloat {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
    opacity: 0.7;
  }
  33% {
    transform: translateY(-20px) rotate(1deg);
    opacity: 1;
  }
  66% {
    transform: translateY(-10px) rotate(-1deg);
    opacity: 0.8;
  }
}

@keyframes arcadePulse {
  0%, 100% {
    box-shadow: 0 0 20px rgba(96, 165, 250, 0.3);
  }
  50% {
    box-shadow: 0 0 40px rgba(96, 165, 250, 0.6);
  }
}
`;

// Inject arcade animations
if (
  typeof document !== "undefined" &&
  !document.getElementById("arcade-animations")
) {
  const style = document.createElement("style");
  style.id = "arcade-animations";
  style.textContent = arcadeAnimations;
  document.head.appendChild(style);
}
