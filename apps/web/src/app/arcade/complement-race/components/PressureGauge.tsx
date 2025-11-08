"use client";

import { animated, useSpring } from "@react-spring/web";
import { AbacusReact } from "@soroban/abacus-react";
import { useAbacusSettings } from "@/hooks/useAbacusSettings";

interface PressureGaugeProps {
  pressure: number; // 0-150 PSI
}

export function PressureGauge({ pressure }: PressureGaugeProps) {
  // Get native abacus numbers setting
  const { data: abacusSettings } = useAbacusSettings();
  const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false;
  const maxPressure = 150;

  // Animate pressure value smoothly with spring physics
  const spring = useSpring({
    pressure,
    config: {
      tension: 120,
      friction: 14,
      clamp: false,
    },
  });

  // Calculate needle angle - sweeps 180° from left to right
  // 0 PSI = 180° (pointing left), 150 PSI = 0° (pointing right)
  const angle = spring.pressure.to((p) => 180 - (p / maxPressure) * 180);

  // Get pressure color (animated)
  const color = spring.pressure.to((p) => {
    if (p < 50) return "#ef4444"; // Red (low)
    if (p < 100) return "#f59e0b"; // Orange (medium)
    return "#10b981"; // Green (high)
  });

  return (
    <div
      style={{
        position: "relative",
        background: "rgba(255, 255, 255, 0.95)",
        padding: "16px",
        borderRadius: "12px",
        minWidth: "220px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: "12px",
          color: "#6b7280",
          marginBottom: "8px",
          fontWeight: "bold",
          textAlign: "center",
        }}
      >
        PRESSURE
      </div>

      {/* SVG Gauge */}
      <svg
        viewBox="-40 -20 280 170"
        style={{
          width: "100%",
          height: "auto",
          marginBottom: "8px",
        }}
      >
        {/* Background arc - semicircle from left to right (bottom half) */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {[0, 50, 100, 150].map((psi, index) => {
          // Angle from 180° (left) to 0° (right)
          const tickAngle = 180 - (psi / maxPressure) * 180;
          const tickRad = (tickAngle * Math.PI) / 180;
          const x1 = 100 + Math.cos(tickRad) * 70;
          const y1 = 100 - Math.sin(tickRad) * 70; // Subtract for SVG coords
          const x2 = 100 + Math.cos(tickRad) * 80;
          const y2 = 100 - Math.sin(tickRad) * 80; // Subtract for SVG coords

          // Position for abacus label
          const labelX = 100 + Math.cos(tickRad) * 112;
          const labelY = 100 - Math.sin(tickRad) * 112;

          return (
            <g key={`tick-${index}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <foreignObject
                x={labelX - 30}
                y={labelY - 25}
                width="60"
                height="100"
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 0,
                  }}
                >
                  {useNativeAbacusNumbers ? (
                    <AbacusReact
                      value={psi}
                      columns={3}
                      interactive={false}
                      showNumbers={false}
                      hideInactiveBeads={false}
                      scaleFactor={0.6}
                      customStyles={{
                        columnPosts: { opacity: 0 },
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#1f2937",
                      }}
                    >
                      {psi}
                    </div>
                  )}
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* Center pivot */}
        <circle cx="100" cy="100" r="4" fill="#1f2937" />

        {/* Needle - animated */}
        <animated.line
          x1="100"
          y1="100"
          x2={angle.to((a) => 100 + Math.cos((a * Math.PI) / 180) * 70)}
          y2={angle.to((a) => 100 - Math.sin((a * Math.PI) / 180) * 70)}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          style={{
            filter: color.to((c) => `drop-shadow(0 2px 3px ${c})`),
          }}
        />
      </svg>

      {/* Pressure readout */}
      <div
        style={{
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          minHeight: "32px",
        }}
      >
        {useNativeAbacusNumbers ? (
          <>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 0,
              }}
            >
              <AbacusReact
                value={Math.round(pressure)}
                columns={3}
                interactive={false}
                showNumbers={false}
                hideInactiveBeads={true}
                scaleFactor={0.35}
                customStyles={{
                  columnPosts: { opacity: 0 },
                }}
              />
            </div>
            <span
              style={{ fontSize: "12px", color: "#6b7280", fontWeight: "bold" }}
            >
              PSI
            </span>
          </>
        ) : (
          <div
            style={{ fontSize: "20px", fontWeight: "bold", color: "#1f2937" }}
          >
            {Math.round(pressure)}{" "}
            <span style={{ fontSize: "12px", color: "#6b7280" }}>PSI</span>
          </div>
        )}
      </div>
    </div>
  );
}
