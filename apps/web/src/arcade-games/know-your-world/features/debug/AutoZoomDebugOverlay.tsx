/**
 * Auto Zoom Debug Overlay
 *
 * Shows debug visualization for the auto-zoom detection system:
 * - Detection box (50px) around cursor
 * - Region analysis with acceptance/rejection info
 * - Zoom decision details
 *
 * Only rendered when visual debug mode is enabled.
 */

"use client";

import type { RefObject } from "react";
import type {
  AdaptiveZoomSearchResult,
  RegionZoomDecision,
} from "../../utils/adaptiveZoomSearch";

// ============================================================================
// Types
// ============================================================================

export interface DetectedRegion {
  id: string;
  pixelWidth: number;
  pixelHeight: number;
  isVerySmall: boolean;
}

export interface AutoZoomDebugOverlayProps {
  /** Current cursor position in container coordinates */
  cursorPosition: { x: number; y: number };
  /** Reference to the container element */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Function to detect regions at a point */
  detectRegions: (
    x: number,
    y: number,
  ) => {
    detectedRegions: DetectedRegion[];
    hasSmallRegion: boolean;
    detectedSmallestSize: number;
  };
  /** Debug info from the zoom search algorithm */
  zoomSearchDebugInfo: AdaptiveZoomSearchResult | null;
  /** Target left position for magnifier (to position overlay on opposite side) */
  targetLeft: number;
  /** Function to get current zoom level */
  getCurrentZoom: () => number;
  /** Current target zoom level */
  targetZoom: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Debug overlay showing auto-zoom detection visualization.
 */
export function AutoZoomDebugOverlay({
  cursorPosition,
  containerRef,
  detectRegions,
  zoomSearchDebugInfo,
  targetLeft,
  getCurrentZoom,
  targetZoom,
}: AutoZoomDebugOverlayProps) {
  const { detectedRegions, hasSmallRegion, detectedSmallestSize } =
    detectRegions(cursorPosition.x, cursorPosition.y);

  // Position on opposite side from magnifier
  const containerWidth =
    containerRef.current?.getBoundingClientRect().width ?? 0;
  const magnifierOnLeft = targetLeft < containerWidth / 2;

  return (
    <>
      {/* Detection box - 50px box around cursor */}
      <div
        style={{
          position: "absolute",
          left: `${cursorPosition.x - 25}px`,
          top: `${cursorPosition.y - 25}px`,
          width: "50px",
          height: "50px",
          border: "2px dashed yellow",
          pointerEvents: "none",
          zIndex: 150,
        }}
      />

      {/* Detection info overlay - opposite side from magnifier */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: magnifierOnLeft ? undefined : "10px",
          right: magnifierOnLeft ? "10px" : undefined,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          color: "white",
          padding: "10px",
          borderRadius: "4px",
          fontSize: "12px",
          fontFamily: "monospace",
          pointerEvents: "none",
          zIndex: 150,
          maxWidth: "300px",
        }}
      >
        <div>
          <strong>Detection Box (50px)</strong>
        </div>
        <div>Regions detected: {detectedRegions.length}</div>
        <div>Has small region: {hasSmallRegion ? "YES" : "NO"}</div>
        <div>
          Smallest size:{" "}
          {detectedSmallestSize === Number.POSITIVE_INFINITY
            ? "∞"
            : `${detectedSmallestSize.toFixed(1)}px`}
        </div>

        {/* Zoom Decision Details */}
        {zoomSearchDebugInfo && (
          <>
            <div
              style={{
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: "1px solid #444",
              }}
            >
              <strong>Zoom Decision:</strong>
            </div>
            <div style={{ fontSize: "10px", marginLeft: "8px" }}>
              Final zoom:{" "}
              <strong>{zoomSearchDebugInfo.zoom.toFixed(1)}×</strong>
              {!zoomSearchDebugInfo.foundGoodZoom && " (fallback to min)"}
            </div>
            <div style={{ fontSize: "10px", marginLeft: "8px" }}>
              Accepted:{" "}
              <strong>{zoomSearchDebugInfo.acceptedRegionId || "none"}</strong>
            </div>
            <div style={{ fontSize: "10px", marginLeft: "8px" }}>
              Thresholds:{" "}
              {(zoomSearchDebugInfo.acceptanceThresholds.min * 100).toFixed(0)}%
              -{" "}
              {(zoomSearchDebugInfo.acceptanceThresholds.max * 100).toFixed(0)}%
              of magnifier
            </div>

            <div style={{ marginTop: "8px" }}>
              <strong>Region Analysis (top 3):</strong>
            </div>
            {Array.from(
              new Map<string, RegionZoomDecision>(
                zoomSearchDebugInfo.regionDecisions.map((d) => [d.regionId, d]),
              ).values(),
            )
              .sort((a, b) => b.importance - a.importance)
              .slice(0, 3)
              .map((decision) => {
                const marker = decision.wasAccepted ? "✓" : "✗";
                const color = decision.wasAccepted ? "#0f0" : "#888";
                return (
                  <div
                    key={`decision-${decision.regionId}`}
                    style={{
                      fontSize: "9px",
                      marginLeft: "8px",
                      color,
                    }}
                  >
                    {marker} {decision.regionId}:{" "}
                    {decision.currentSize.width.toFixed(0)}×
                    {decision.currentSize.height.toFixed(0)}px
                    {decision.rejectionReason &&
                      ` (${decision.rejectionReason})`}
                  </div>
                );
              })}
          </>
        )}

        <div
          style={{
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: "1px solid #444",
          }}
        >
          <strong>Detected Regions ({detectedRegions.length}):</strong>
        </div>
        {detectedRegions.map((region) => (
          <div key={region.id} style={{ fontSize: "10px", marginLeft: "8px" }}>
            • {region.id}: {region.pixelWidth.toFixed(1)}×
            {region.pixelHeight.toFixed(1)}px
            {region.isVerySmall ? " (SMALL)" : ""}
          </div>
        ))}
        <div style={{ marginTop: "8px" }}>
          <strong>Current Zoom:</strong> {getCurrentZoom().toFixed(1)}×
        </div>
        <div>
          <strong>Target Zoom:</strong> {targetZoom.toFixed(1)}×
        </div>
      </div>
    </>
  );
}
