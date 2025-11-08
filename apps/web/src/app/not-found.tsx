"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import type { CustomBeadContent } from "@soroban/abacus-react";
import { AbacusReact, useAbacusDisplay } from "@soroban/abacus-react";
import { PageWithNav } from "@/components/PageWithNav";
import { css } from "../../styled-system/css";
import { stack } from "../../styled-system/patterns";

// HTTP Status Code Easter Eggs with dynamic bead rendering and themed backgrounds
const STATUS_CODE_EASTER_EGGS: Record<
  number,
  {
    customBeadContent: CustomBeadContent;
    message: string;
    bgGradient?: string;
    textColor?: string;
    glowColor?: string;
  }
> = {
  200: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => (bead.active ? "✅" : "⭕"),
    },
    message: "Everything's counting perfectly!",
    bgGradient: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
    textColor: "#d1fae5",
    glowColor: "rgba(16, 185, 129, 0.3)",
  },
  201: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => (bead.type === "heaven" ? "🥚" : "🐣"),
    },
    message: "Something new has been counted into existence!",
    bgGradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    textColor: "#78350f",
    glowColor: "rgba(253, 230, 138, 0.4)",
  },
  301: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => (bead.active ? "🚚" : "📦"),
    },
    message: "These numbers have permanently relocated!",
    bgGradient: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
    textColor: "#3730a3",
    glowColor: "rgba(199, 210, 254, 0.4)",
  },
  400: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => (bead.active ? "❌" : "❓"),
    },
    message: "Those numbers don't make sense!",
    bgGradient: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
    textColor: "#991b1b",
    glowColor: "rgba(254, 202, 202, 0.4)",
  },
  401: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => (bead.active ? "🔒" : "🔑"),
    },
    message: "These numbers are classified!",
    bgGradient: "linear-gradient(135deg, #1f2937 0%, #374151 100%)",
    textColor: "#fbbf24",
    glowColor: "rgba(251, 191, 36, 0.3)",
  },
  403: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => (bead.type === "heaven" ? "🚫" : "⛔"),
    },
    message: "You're not allowed to count these numbers!",
    bgGradient: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)",
    textColor: "#fef2f2",
    glowColor: "rgba(127, 29, 29, 0.5)",
  },
  418: {
    customBeadContent: { type: "emoji", value: "🫖" },
    message: "Perhaps you're pouring in the wrong direction?",
    bgGradient: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
    textColor: "#064e3b",
    glowColor: "rgba(167, 243, 208, 0.4)",
  },
  420: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => {
        const emojis = ["🌿", "🍃", "🌱", "🪴"];
        return emojis[bead.position % emojis.length] || "🌿";
      },
    },
    message: "Whoa dude, these numbers are like... relative, man",
    bgGradient:
      "linear-gradient(135deg, #6ee7b7 20%, #34d399 50%, #10b981 80%)",
    textColor: "#022c22",
    glowColor: "rgba(52, 211, 153, 0.6)",
  },
  451: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => (bead.active ? "🤐" : "▓"),
    },
    message:
      "[REDACTED] - This number has been removed by the Ministry of Mathematics",
    bgGradient: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
    textColor: "#9ca3af",
    glowColor: "rgba(156, 163, 175, 0.2)",
  },
  500: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => {
        const fireEmojis = ["🔥", "💥", "⚠️"];
        return bead.active
          ? fireEmojis[bead.position % fireEmojis.length] || "🔥"
          : "💨";
      },
    },
    message: "The abacus has caught fire!",
    bgGradient:
      "linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f97316 100%)",
    textColor: "#fff7ed",
    glowColor: "rgba(239, 68, 68, 0.6)",
  },
  503: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => {
        const tools = ["🔧", "🔨", "🪛", "⚙️"];
        return bead.active
          ? tools[bead.placeValue % tools.length] || "🔧"
          : "⚪";
      },
    },
    message: "Pardon our dust, we're upgrading the beads!",
    bgGradient: "linear-gradient(135deg, #fef3c7 0%, #fde047 100%)",
    textColor: "#713f12",
    glowColor: "rgba(253, 224, 71, 0.4)",
  },
  666: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => {
        const demons = ["😈", "👹", "👺", "💀"];
        return bead.active
          ? demons[bead.position % demons.length] || "😈"
          : "🔥";
      },
    },
    message: "Your soul now belongs to arithmetic!",
    bgGradient:
      "linear-gradient(135deg, #7c2d12 0%, #991b1b 50%, #450a0a 100%)",
    textColor: "#fef2f2",
    glowColor: "rgba(153, 27, 27, 0.7)",
  },
  777: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => {
        const lucky = ["🎰", "🍀", "💰", "🎲", "⭐"];
        return bead.active
          ? lucky[bead.placeValue % lucky.length] || "🎰"
          : "⚪";
      },
    },
    message: "Jackpot! You've mastered the soroban!",
    bgGradient:
      "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)",
    textColor: "#422006",
    glowColor: "rgba(251, 191, 36, 0.6)",
  },
  911: {
    customBeadContent: {
      type: "emoji-function",
      value: (bead) => {
        const emergency = ["🚨", "🚑", "🚒", "👮"];
        return bead.active
          ? emergency[bead.position % emergency.length] || "🚨"
          : "⚫";
      },
    },
    message: "EMERGENCY: Someone needs help with their math homework!",
    bgGradient: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
    textColor: "#fef2f2",
    glowColor: "rgba(220, 38, 38, 0.5)",
  },
};

export default function NotFound() {
  const [abacusValue, setAbacusValue] = useState(404);
  const [activeEasterEgg, setActiveEasterEgg] = useState<number | null>(null);
  const [fadeKey, setFadeKey] = useState(0);
  const { updateConfig, resetToDefaults } = useAbacusDisplay();

  // Easter egg activation - update global abacus config when special codes are entered
  useEffect(() => {
    const easterEgg = STATUS_CODE_EASTER_EGGS[abacusValue];

    if (easterEgg && activeEasterEgg !== abacusValue) {
      setActiveEasterEgg(abacusValue);
      setFadeKey((prev) => prev + 1); // Trigger fade animation

      // Update global abacus display config to use custom beads
      // This affects ALL abaci rendered in the app until page reload!
      updateConfig({
        beadShape: "custom",
        customBeadContent: easterEgg.customBeadContent,
      });

      // Store active easter egg in window so it persists across navigation
      (window as any).__easterEggMode = abacusValue;
    } else if (!easterEgg && activeEasterEgg !== null) {
      // User changed away from an easter egg code - reset to defaults
      setActiveEasterEgg(null);
      setFadeKey((prev) => prev + 1); // Trigger fade animation
      resetToDefaults();
      (window as any).__easterEggMode = null;
    }
  }, [abacusValue, activeEasterEgg, updateConfig, resetToDefaults]);

  // Get current theme
  const currentTheme = activeEasterEgg
    ? STATUS_CODE_EASTER_EGGS[activeEasterEgg]
    : null;

  return (
    <PageWithNav>
      <style>
        {`
          @keyframes fadeInText {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
      <div
        className={css({
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: currentTheme?.bgGradient || "bg.canvas",
          padding: { base: "1rem", sm: "2rem" },
          paddingTop: { base: "10rem", sm: "12rem", md: "14rem", lg: "16rem" },
          transition: "background 0.6s ease-in-out",
          position: "relative",
          overflow: "hidden",
        })}
      >
        {/* Animated glow effect */}
        {currentTheme?.glowColor && (
          <div
            className={css({
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at 50% 40%, ${currentTheme.glowColor} 0%, transparent 70%)`,
              animation: "pulse 3s ease-in-out infinite",
              pointerEvents: "none",
            })}
          />
        )}

        <div
          className={stack({
            gap: { base: "1.5rem", sm: "2rem", md: "3rem" },
            alignItems: "center",
            textAlign: "center",
            maxWidth: "900px",
            width: "100%",
            position: "relative",
            zIndex: 1,
          })}
        >
          {/* Interactive Abacus */}
          <div
            className={css({
              position: "relative",
              width: "100%",
              maxWidth: { base: "90vw", sm: "500px", md: "600px", lg: "700px" },
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <div
              className={css({
                transform: {
                  base: "scale(1.5)",
                  sm: "scale(2)",
                  md: "scale(2.5)",
                  lg: "scale(3)",
                },
                transformOrigin: "center",
              })}
            >
              <AbacusReact
                value={abacusValue}
                columns={3}
                showNumbers={false}
                onValueChange={setAbacusValue}
              />
            </div>
          </div>

          {/* Main message */}
          <div
            className={stack({
              gap: "1rem",
              marginTop: { base: "2rem", sm: "3rem", md: "4rem" },
            })}
          >
            <h1
              key={fadeKey}
              className={css({
                fontSize: {
                  base: "1.75rem",
                  sm: "2.5rem",
                  md: "3.5rem",
                  lg: "4rem",
                },
                fontWeight: "black",
                color: currentTheme?.textColor || "text.primary",
                lineHeight: "1.1",
                textShadow: currentTheme?.glowColor
                  ? `0 0 20px ${currentTheme.glowColor}, 0 0 40px ${currentTheme.glowColor}`
                  : "none",
                transition: "color 0.6s ease-in-out, text-shadow 0.6s ease-in-out",
                letterSpacing: "-0.02em",
                px: { base: "1rem", sm: "2rem" },
                minHeight: {
                  base: "calc(1.75rem * 1.1 * 2)",
                  sm: "calc(2.5rem * 1.1 * 2)",
                  md: "calc(3.5rem * 1.1 * 2)",
                  lg: "calc(4rem * 1.1 * 2)",
                },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              })}
              style={{
                animation: "fadeInText 0.5s ease-out",
              }}
            >
              {activeEasterEgg
                ? STATUS_CODE_EASTER_EGGS[activeEasterEgg].message
                : "Oops! We've lost count."}
            </h1>
          </div>
        </div>
      </div>
    </PageWithNav>
  );
}
