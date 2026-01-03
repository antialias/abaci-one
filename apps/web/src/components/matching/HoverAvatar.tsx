"use client";

import { animated, useSpring } from "@react-spring/web";
import { useEffect, useRef, useState } from "react";
import { css } from "../../../styled-system/css";

export interface HoverAvatarProps {
  playerId: string;
  playerInfo: { emoji: string; name: string; color?: string };
  cardElement: HTMLElement | null;
  isPlayersTurn: boolean;
  isCardFlipped: boolean;
}

/**
 * Animated avatar that follows a player's cursor as they hover over cards.
 * Used in multiplayer mode to show remote player presence.
 */
export function HoverAvatar({
  playerId,
  playerInfo,
  cardElement,
  isPlayersTurn,
  isCardFlipped,
}: HoverAvatarProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const isFirstRender = useRef(true);

  // Update position when card element changes
  useEffect(() => {
    if (cardElement) {
      const rect = cardElement.getBoundingClientRect();
      // Calculate the center of the card for avatar positioning
      const avatarCenterX = rect.left + rect.width / 2;
      const avatarCenterY = rect.top + rect.height / 2;

      setPosition({
        x: avatarCenterX,
        y: avatarCenterY,
      });
    }
  }, [cardElement]);

  // Smooth spring animation for position changes
  const springProps = useSpring({
    x: position?.x ?? 0,
    y: position?.y ?? 0,
    // Hide avatar if: no position, not player's turn, no card element, OR card is flipped
    opacity: position && isPlayersTurn && cardElement && !isCardFlipped ? 1 : 0,
    config: {
      tension: 280,
      friction: 60,
      mass: 1,
    },
    immediate: isFirstRender.current, // Skip animation on first render only
  });

  // Clear first render flag after initial render
  useEffect(() => {
    if (position && isFirstRender.current) {
      isFirstRender.current = false;
    }
  }, [position]);

  // Don't render until we have a position
  if (!position) return null;

  return (
    <animated.div
      style={{
        position: "fixed",
        // Don't use translate, just position directly at the calculated point
        left: springProps.x.to((x) => `${x}px`),
        top: springProps.y.to((y) => `${y}px`),
        opacity: springProps.opacity,
        width: "80px",
        height: "80px",
        marginLeft: "-40px", // Center horizontally (half of width)
        marginTop: "-40px", // Center vertically (half of height)
        borderRadius: "50%",
        background:
          playerInfo.color || "linear-gradient(135deg, #667eea, #764ba2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "48px",
        // 3D elevation effect
        boxShadow:
          "0 12px 30px rgba(0,0,0,0.5), 0 6px 12px rgba(0,0,0,0.4), 0 0 40px rgba(102, 126, 234, 0.8)",
        border: "4px solid white",
        zIndex: 1000,
        pointerEvents: "none",
        filter: "drop-shadow(0 0 12px rgba(102, 126, 234, 0.9))",
      }}
      className={css({
        animation: "hoverFloat 2s ease-in-out infinite",
      })}
      title={`${playerInfo.name} is considering this card`}
    >
      {playerInfo.emoji}
    </animated.div>
  );
}

// Add hover float animation
const hoverFloatAnimation = `
@keyframes hoverFloat {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-6px);
  }
}
`;

// Inject animation styles
if (
  typeof document !== "undefined" &&
  !document.getElementById("hover-avatar-animations")
) {
  const style = document.createElement("style");
  style.id = "hover-avatar-animations";
  style.textContent = hoverFloatAnimation;
  document.head.appendChild(style);
}
