"use client";

import { useComplementRace } from "../context/ComplementRaceContext";
import { GameControls } from "./GameControls";
import { GameCountdown } from "./GameCountdown";
import { GameDisplay } from "./GameDisplay";
import { GameIntro } from "./GameIntro";
import { GameResults } from "./GameResults";

export function ComplementRaceGame() {
  const { state } = useComplementRace();

  return (
    <div
      data-component="game-page-root"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: "20px 8px",
        minHeight: "100vh",
        maxHeight: "100vh",
        background:
          state.style === "sprint"
            ? "linear-gradient(to bottom, #2563eb 0%, #60a5fa 100%)"
            : "radial-gradient(ellipse at center, #8db978 0%, #7ba565 40%, #6a9354 100%)",
        position: "relative",
      }}
    >
      {/* Background pattern - subtle grass texture */}
      {state.style !== "sprint" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 0,
            opacity: 0.15,
          }}
        >
          <svg width="100%" height="100%">
            <defs>
              <pattern
                id="grass-texture"
                x="0"
                y="0"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <rect width="40" height="40" fill="transparent" />
                <line
                  x1="2"
                  y1="5"
                  x2="8"
                  y2="5"
                  stroke="#2d5016"
                  strokeWidth="1"
                  opacity="0.3"
                />
                <line
                  x1="15"
                  y1="8"
                  x2="20"
                  y2="8"
                  stroke="#2d5016"
                  strokeWidth="1"
                  opacity="0.25"
                />
                <line
                  x1="25"
                  y1="12"
                  x2="32"
                  y2="12"
                  stroke="#2d5016"
                  strokeWidth="1"
                  opacity="0.2"
                />
                <line
                  x1="5"
                  y1="18"
                  x2="12"
                  y2="18"
                  stroke="#2d5016"
                  strokeWidth="1"
                  opacity="0.3"
                />
                <line
                  x1="28"
                  y1="22"
                  x2="35"
                  y2="22"
                  stroke="#2d5016"
                  strokeWidth="1"
                  opacity="0.25"
                />
                <line
                  x1="10"
                  y1="30"
                  x2="16"
                  y2="30"
                  stroke="#2d5016"
                  strokeWidth="1"
                  opacity="0.2"
                />
                <line
                  x1="22"
                  y1="35"
                  x2="28"
                  y2="35"
                  stroke="#2d5016"
                  strokeWidth="1"
                  opacity="0.3"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grass-texture)" />
          </svg>
        </div>
      )}

      {/* Subtle tree clusters around edges - top-down view with gentle sway */}
      {state.style !== "sprint" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          {/* Top-left tree cluster */}
          <div
            style={{
              position: "absolute",
              top: "5%",
              left: "3%",
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #4a7c3a 0%, #3d6630 60%, transparent 70%)",
              opacity: 0.2,
              filter: "blur(4px)",
              animation: "treeSway1 8s ease-in-out infinite",
            }}
          />

          {/* Top-right tree cluster */}
          <div
            style={{
              position: "absolute",
              top: "8%",
              right: "5%",
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #4a7c3a 0%, #3d6630 60%, transparent 70%)",
              opacity: 0.18,
              filter: "blur(5px)",
              animation: "treeSway2 10s ease-in-out infinite",
            }}
          />

          {/* Bottom-left tree cluster */}
          <div
            style={{
              position: "absolute",
              bottom: "10%",
              left: "8%",
              width: "90px",
              height: "90px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #4a7c3a 0%, #3d6630 60%, transparent 70%)",
              opacity: 0.15,
              filter: "blur(4px)",
              animation: "treeSway1 9s ease-in-out infinite reverse",
            }}
          />

          {/* Bottom-right tree cluster */}
          <div
            style={{
              position: "absolute",
              bottom: "5%",
              right: "4%",
              width: "110px",
              height: "110px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #4a7c3a 0%, #3d6630 60%, transparent 70%)",
              opacity: 0.2,
              filter: "blur(6px)",
              animation: "treeSway2 11s ease-in-out infinite",
            }}
          />

          {/* Additional smaller clusters for depth */}
          <div
            style={{
              position: "absolute",
              top: "40%",
              left: "2%",
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #4a7c3a 0%, #3d6630 60%, transparent 70%)",
              opacity: 0.12,
              filter: "blur(3px)",
              animation: "treeSway1 7s ease-in-out infinite",
            }}
          />

          <div
            style={{
              position: "absolute",
              top: "55%",
              right: "3%",
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #4a7c3a 0%, #3d6630 60%, transparent 70%)",
              opacity: 0.14,
              filter: "blur(4px)",
              animation: "treeSway2 8.5s ease-in-out infinite reverse",
            }}
          />
        </div>
      )}

      {/* Flying bird shadows - very subtle from aerial view */}
      {state.style !== "sprint" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "30%",
              left: "-5%",
              width: "15px",
              height: "8px",
              background: "rgba(0, 0, 0, 0.08)",
              borderRadius: "50%",
              filter: "blur(2px)",
              animation: "birdFly1 20s linear infinite",
            }}
          />

          <div
            style={{
              position: "absolute",
              top: "60%",
              left: "-5%",
              width: "12px",
              height: "6px",
              background: "rgba(0, 0, 0, 0.06)",
              borderRadius: "50%",
              filter: "blur(2px)",
              animation: "birdFly2 28s linear infinite",
            }}
          />

          <div
            style={{
              position: "absolute",
              top: "45%",
              left: "-5%",
              width: "10px",
              height: "5px",
              background: "rgba(0, 0, 0, 0.05)",
              borderRadius: "50%",
              filter: "blur(1px)",
              animation: "birdFly1 35s linear infinite",
              animationDelay: "-12s",
            }}
          />
        </div>
      )}

      {/* Subtle cloud shadows moving across field */}
      {state.style !== "sprint" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-10%",
              left: "-20%",
              width: "300px",
              height: "200px",
              background:
                "radial-gradient(ellipse, rgba(0, 0, 0, 0.03) 0%, transparent 60%)",
              borderRadius: "50%",
              filter: "blur(20px)",
              animation: "cloudShadow1 45s linear infinite",
            }}
          />

          <div
            style={{
              position: "absolute",
              top: "-10%",
              left: "-20%",
              width: "250px",
              height: "180px",
              background:
                "radial-gradient(ellipse, rgba(0, 0, 0, 0.025) 0%, transparent 60%)",
              borderRadius: "50%",
              filter: "blur(25px)",
              animation: "cloudShadow2 60s linear infinite",
              animationDelay: "-20s",
            }}
          />
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes treeSway1 {
          0%, 100% { transform: scale(1) translate(0, 0); }
          25% { transform: scale(1.02) translate(2px, -1px); }
          50% { transform: scale(0.98) translate(-1px, 1px); }
          75% { transform: scale(1.01) translate(-2px, -1px); }
        }
        @keyframes treeSway2 {
          0%, 100% { transform: scale(1) translate(0, 0); }
          30% { transform: scale(1.015) translate(-2px, 1px); }
          60% { transform: scale(0.985) translate(2px, -1px); }
          80% { transform: scale(1.01) translate(1px, 1px); }
        }
        @keyframes birdFly1 {
          0% { transform: translate(0, 0); }
          100% { transform: translate(calc(100vw + 100px), -20vh); }
        }
        @keyframes birdFly2 {
          0% { transform: translate(0, 0); }
          100% { transform: translate(calc(100vw + 100px), 15vh); }
        }
        @keyframes cloudShadow1 {
          0% { transform: translate(0, 0); }
          100% { transform: translate(calc(100vw + 400px), 30vh); }
        }
        @keyframes cloudShadow2 {
          0% { transform: translate(0, 0); }
          100% { transform: translate(calc(100vw + 350px), -20vh); }
        }
      `}</style>

      <div
        style={{
          maxWidth: "100%",
          margin: "0 auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
        }}
      >
        {state.gamePhase === "intro" && <GameIntro />}
        {state.gamePhase === "controls" && <GameControls />}
        {state.gamePhase === "countdown" && <GameCountdown />}
        {state.gamePhase === "playing" && <GameDisplay />}
        {state.gamePhase === "results" && <GameResults />}
      </div>
    </div>
  );
}
