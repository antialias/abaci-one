"use client";

import { animated, useSpring } from "@react-spring/web";
import type { Piece } from "../../types";
import { PieceRenderer } from "../PieceRenderer";

export interface SvgPieceProps {
  piece: Piece;
  cellSize: number;
  padding: number;
  labelMargin?: number;
  opacity?: number;
  useNativeAbacusNumbers?: boolean;
  selected?: boolean;
  shouldRotate?: boolean;
}

export function SvgPiece({
  piece,
  cellSize,
  padding,
  labelMargin = 0,
  opacity = 1,
  useNativeAbacusNumbers = false,
  selected = false,
  shouldRotate = false,
}: SvgPieceProps) {
  const file = piece.square.charCodeAt(0) - 65; // A=0
  const rank = Number.parseInt(piece.square.slice(1), 10); // 1-8
  const row = 8 - rank; // Invert for display

  const x = labelMargin + padding + file * cellSize;
  const y = padding + row * cellSize;

  const spring = useSpring({
    x,
    y,
    config: { tension: 280, friction: 60 },
  });

  const pieceSize = cellSize * 0.85;

  return (
    <animated.g
      transform={spring.x.to((xVal) => `translate(${xVal}, ${spring.y.get()})`)}
    >
      <foreignObject x={0} y={0} width={cellSize} height={cellSize}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity,
          }}
        >
          <PieceRenderer
            type={piece.type}
            color={piece.color}
            value={
              piece.type === "P"
                ? piece.pyramidFaces?.[0] || 0
                : piece.value || 0
            }
            size={pieceSize}
            useNativeAbacusNumbers={useNativeAbacusNumbers}
            selected={selected}
            pyramidFaces={piece.type === "P" ? piece.pyramidFaces : undefined}
            shouldRotate={shouldRotate}
          />
        </div>
      </foreignObject>
    </animated.g>
  );
}
