import { animated, to, useSpring } from "@react-spring/web";
import { useCaptureContext } from "../../contexts/CaptureContext";

/**
 * Error notification when no capture is possible
 */
export function CaptureErrorDialog() {
  const { layout, closing } = useCaptureContext();
  const { targetPos, cellSize } = layout;
  const entranceSpring = useSpring({
    from: { opacity: 0, y: -20 },
    opacity: closing ? 0 : 1,
    y: closing ? -20 : 0,
    config: { tension: 300, friction: 25 },
  });

  return (
    <animated.g
      style={{
        opacity: entranceSpring.opacity,
      }}
      transform={to(
        [entranceSpring.y],
        (y) => `translate(${targetPos.x}, ${targetPos.y + y})`,
      )}
    >
      <foreignObject
        x={-cellSize * 1.8}
        y={-cellSize * 0.5}
        width={cellSize * 3.6}
        height={cellSize}
        style={{ overflow: "visible" }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            color: "#f1f5f9",
            padding: `${cellSize * 0.12}px ${cellSize * 0.18}px`,
            borderRadius: `${cellSize * 0.12}px`,
            fontSize: `${cellSize * 0.16}px`,
            fontWeight: 500,
            textAlign: "center",
            boxShadow:
              "0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: `${cellSize * 0.1}px`,
            backdropFilter: "blur(8px)",
            letterSpacing: "0.01em",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: `${cellSize * 0.2}px`,
              opacity: 0.7,
            }}
          >
            ⚠
          </span>
          <span>No valid relation</span>
        </div>
      </foreignObject>
    </animated.g>
  );
}
