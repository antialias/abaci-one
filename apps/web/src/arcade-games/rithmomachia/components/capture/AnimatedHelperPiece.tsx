"use client";

import { animated, to, useSpring } from "@react-spring/web";
import type { Piece } from "../../types";
import { getEffectiveValue } from "../../utils/pieceSetup";
import { PieceRenderer } from "../PieceRenderer";

interface AnimatedHelperPieceProps {
  piece: Piece;
  boardPos: { x: number; y: number };
  ringX: number;
  ringY: number;
  cellSize: number;
  onSelectHelper: (pieceId: string) => void;
  closing: boolean;
  onHover?: (pieceId: string | null) => void;
  useNativeAbacusNumbers?: boolean;
}

export function AnimatedHelperPiece({
  piece,
  boardPos,
  ringX,
  ringY,
  cellSize,
  onSelectHelper,
  closing,
  onHover,
  useNativeAbacusNumbers = false,
}: AnimatedHelperPieceProps) {
  console.log(
    `[AnimatedHelperPiece] Rendering piece ${piece.id}: boardPos=(${boardPos.x}, ${boardPos.y}), ringPos=(${ringX}, ${ringY}), closing=${closing}`,
  );

  // Animate from board position to ring position
  const spring = useSpring({
    from: { x: boardPos.x, y: boardPos.y, opacity: 0 },
    x: closing ? boardPos.x : ringX,
    y: closing ? boardPos.y : ringY,
    opacity: closing ? 0 : 1,
    config: { tension: 280, friction: 20 },
  });

  console.log(
    `[AnimatedHelperPiece] Spring config for ${piece.id}: from=(${boardPos.x}, ${boardPos.y}), to=(${closing ? boardPos.x : ringX}, ${closing ? boardPos.y : ringY})`,
  );

  const value = getEffectiveValue(piece);
  if (value === undefined || value === null) return null;

  return (
    <animated.g
      style={{
        opacity: spring.opacity,
        cursor: "pointer",
      }}
      transform={to([spring.x, spring.y], (x, y) => `translate(${x}, ${y})`)}
      onClick={(e) => {
        e.stopPropagation();
        onSelectHelper(piece.id);
      }}
      onMouseEnter={() => onHover?.(piece.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Render the actual piece with a highlight ring */}
      <circle
        cx={0}
        cy={0}
        r={cellSize * 0.5}
        fill="rgba(250, 204, 21, 0.3)"
        stroke="rgba(250, 204, 21, 0.9)"
        strokeWidth={4}
      />
      <g transform={`translate(${-cellSize / 2}, ${-cellSize / 2})`}>
        <PieceRenderer
          type={piece.type}
          color={piece.color}
          value={value}
          size={cellSize}
          useNativeAbacusNumbers={useNativeAbacusNumbers}
        />
      </g>
    </animated.g>
  );
}
