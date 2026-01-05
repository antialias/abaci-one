"use client";

import { useState, useCallback, useEffect } from "react";
import { css } from "@styled/css";
import { setRuntimeCrop, setCropModeActive } from "../customCrops";

/**
 * Dev-only tool for drawing bounding boxes to get crop coordinates
 * Activated with Ctrl+Shift+B (or Cmd+Shift+B on Mac)
 *
 * Usage:
 * 1. Press Ctrl+Shift+B to activate crop mode
 * 2. Click and drag to draw a bounding box
 * 3. A JSON file is automatically downloaded
 * 4. Save it to: apps/web/src/arcade-games/know-your-world/pending-crop.json
 * 5. Run: npm run apply-crop
 * 6. Press Escape or Ctrl+Shift+B again to deactivate
 */

interface DevCropToolProps {
  svgRef: React.RefObject<SVGSVGElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  viewBox: string;
  mapId: string;
  continentId: string;
}

interface CropBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function DevCropTool({
  svgRef,
  containerRef,
  viewBox,
  mapId,
  continentId,
}: DevCropToolProps) {
  const [isActive, setIsActive] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cropBox, setCropBox] = useState<CropBox | null>(null);
  const [finalBox, setFinalBox] = useState<CropBox | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Reset crop for current map/continent
  const resetCrop = useCallback(() => {
    console.log(`[DevCropTool] Resetting crop for ${mapId}/${continentId}`);
    setSaveStatus("saving");
    fetch(`/api/dev/save-crop?mapId=${mapId}&continentId=${continentId}`, {
      method: "DELETE",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log(`✅ Crop reset!`);
          // Update runtime crop immediately for live update
          setRuntimeCrop(mapId, continentId, null);
          setSaveStatus("saved");
          setFinalBox(null);
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          console.error("❌ Failed to reset crop:", data.error);
          setSaveStatus("error");
        }
      })
      .catch((err) => {
        console.error("❌ Failed to reset crop:", err);
        setSaveStatus("error");
      });
  }, [mapId, continentId]);

  // Parse viewBox
  const viewBoxParts = viewBox.split(" ").map(Number);
  const viewBoxX = viewBoxParts[0] || 0;
  const viewBoxY = viewBoxParts[1] || 0;
  const viewBoxWidth = viewBoxParts[2] || 1000;
  const viewBoxHeight = viewBoxParts[3] || 1000;

  // Convert screen coordinates to SVG coordinates
  // IMPORTANT: Must account for SVG letterboxing due to preserveAspectRatio="xMidYMid meet"
  const screenToSvg = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      const container = containerRef.current;
      if (!svg || !container) return null;

      const containerRect = container.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();

      // With preserveAspectRatio="xMidYMid meet", the SVG uses uniform scaling
      // and centers the content, creating letterboxing
      const scaleX = svgRect.width / viewBoxWidth;
      const scaleY = svgRect.height / viewBoxHeight;
      const actualScale = Math.min(scaleX, scaleY);

      // Calculate letterbox offsets (content is centered)
      const renderedWidth = viewBoxWidth * actualScale;
      const renderedHeight = viewBoxHeight * actualScale;
      const offsetX = (svgRect.width - renderedWidth) / 2;
      const offsetY = (svgRect.height - renderedHeight) / 2;

      // Position relative to SVG element
      const relX = screenX - svgRect.left;
      const relY = screenY - svgRect.top;

      // Convert to SVG coordinates, accounting for letterbox offset
      return {
        x: viewBoxX + (relX - offsetX) / actualScale,
        y: viewBoxY + (relY - offsetY) / actualScale,
      };
    },
    [svgRef, containerRef, viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight],
  );

  // Convert SVG coordinates to screen coordinates (for display)
  // IMPORTANT: Must account for SVG letterboxing due to preserveAspectRatio="xMidYMid meet"
  const svgToScreen = useCallback(
    (svgX: number, svgY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      const container = containerRef.current;
      if (!svg || !container) return null;

      const containerRect = container.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();

      // With preserveAspectRatio="xMidYMid meet", the SVG uses uniform scaling
      const scaleX = svgRect.width / viewBoxWidth;
      const scaleY = svgRect.height / viewBoxHeight;
      const actualScale = Math.min(scaleX, scaleY);

      // Calculate letterbox offsets (content is centered)
      const renderedWidth = viewBoxWidth * actualScale;
      const renderedHeight = viewBoxHeight * actualScale;
      const offsetX = (svgRect.width - renderedWidth) / 2;
      const offsetY = (svgRect.height - renderedHeight) / 2;

      // Convert SVG coordinates to screen, accounting for letterbox offset
      return {
        x:
          (svgX - viewBoxX) * actualScale +
          offsetX +
          (svgRect.left - containerRect.left),
        y:
          (svgY - viewBoxY) * actualScale +
          offsetY +
          (svgRect.top - containerRect.top),
      };
    },
    [svgRef, containerRef, viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight],
  );

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+B (or Cmd+Shift+B on Mac)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "b"
      ) {
        e.preventDefault();
        const newActive = !isActive;
        setIsActive(newActive);
        setCropModeActive(newActive);
        if (isActive) {
          setCropBox(null);
          setFinalBox(null);
        }
      }
      // R to reset crop (when in crop mode)
      if (e.key.toLowerCase() === "r") {
        console.log(
          "[DevCropTool] R pressed, isActive:",
          isActive,
          "isDrawing:",
          isDrawing,
        );
        if (isActive && !isDrawing) {
          e.preventDefault();
          resetCrop();
        }
      }
      // Escape to deactivate
      if (e.key === "Escape" && isActive) {
        setIsActive(false);
        setCropModeActive(false);
        setCropBox(null);
        setFinalBox(null);
        setIsDrawing(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, isDrawing, resetCrop]);

  // Handle mouse events for drawing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive) return;

      const svgCoords = screenToSvg(e.clientX, e.clientY);
      if (!svgCoords) return;

      setIsDrawing(true);
      setFinalBox(null);
      setCropBox({
        startX: svgCoords.x,
        startY: svgCoords.y,
        endX: svgCoords.x,
        endY: svgCoords.y,
      });
    },
    [isActive, screenToSvg],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive || !isDrawing || !cropBox) return;

      const svgCoords = screenToSvg(e.clientX, e.clientY);
      if (!svgCoords) return;

      setCropBox((prev) =>
        prev ? { ...prev, endX: svgCoords.x, endY: svgCoords.y } : null,
      );
    },
    [isActive, isDrawing, cropBox, screenToSvg],
  );

  const handleMouseUp = useCallback(() => {
    if (!isActive || !isDrawing || !cropBox) return;

    setIsDrawing(false);

    // Calculate final box (normalize so min is start)
    const minX = Math.min(cropBox.startX, cropBox.endX);
    const maxX = Math.max(cropBox.startX, cropBox.endX);
    const minY = Math.min(cropBox.startY, cropBox.endY);
    const maxY = Math.max(cropBox.startY, cropBox.endY);

    const finalCropBox = {
      startX: minX,
      startY: minY,
      endX: maxX,
      endY: maxY,
    };

    setFinalBox(finalCropBox);
    setCropBox(null);

    // Calculate viewBox string
    const width = maxX - minX;
    const height = maxY - minY;
    const viewBoxStr = `${minX.toFixed(2)} ${minY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`;

    console.log(
      `[DevCropTool] Saving crop for ${mapId}/${continentId}: ${viewBoxStr}`,
    );
    setSaveStatus("saving");

    // POST to API to save directly to customCrops.ts
    fetch("/api/dev/save-crop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mapId,
        continentId,
        viewBox: viewBoxStr,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log(`✅ Crop saved!`);
          console.log("Updated crops:", data.crops);
          // Update runtime crop immediately for live update
          setRuntimeCrop(mapId, continentId, viewBoxStr);
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          console.error("❌ Failed to save crop:", data.error);
          setSaveStatus("error");
        }
      })
      .catch((err) => {
        console.error("❌ Failed to save crop:", err);
        setSaveStatus("error");
      });
  }, [isActive, isDrawing, cropBox, mapId, continentId]);

  // Don't render in production
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  // Calculate screen coordinates for display
  const currentBox = cropBox || finalBox;
  let screenBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null = null;

  if (currentBox) {
    const minX = Math.min(currentBox.startX, currentBox.endX);
    const maxX = Math.max(currentBox.startX, currentBox.endX);
    const minY = Math.min(currentBox.startY, currentBox.endY);
    const maxY = Math.max(currentBox.startY, currentBox.endY);

    const topLeft = svgToScreen(minX, minY);
    const bottomRight = svgToScreen(maxX, maxY);

    if (topLeft && bottomRight) {
      screenBox = {
        left: topLeft.x,
        top: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      };
    }
  }

  return (
    <>
      {/* Overlay for capturing mouse events when active */}
      {isActive && (
        <div
          data-element="crop-tool-overlay"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={css({
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            cursor: "crosshair",
          })}
        />
      )}

      {/* Draw the bounding box */}
      {screenBox && (
        <div
          data-element="crop-box"
          className={css({
            position: "absolute",
            border: "2px dashed",
            borderColor: finalBox ? "green.500" : "red.500",
            bg: finalBox ? "green.500/20" : "red.500/20",
            pointerEvents: "none",
            zIndex: 1001,
          })}
          style={{
            left: `${screenBox.left}px`,
            top: `${screenBox.top}px`,
            width: `${screenBox.width}px`,
            height: `${screenBox.height}px`,
          }}
        >
          {/* Show dimensions */}
          {finalBox && (
            <div
              className={css({
                position: "absolute",
                bottom: "-24px",
                left: "50%",
                transform: "translateX(-50%)",
                bg: "green.700",
                color: "white",
                px: 2,
                py: 1,
                rounded: "md",
                fontSize: "xs",
                fontFamily: "mono",
                whiteSpace: "nowrap",
              })}
            >
              {(finalBox.endX - finalBox.startX).toFixed(0)} ×{" "}
              {(finalBox.endY - finalBox.startY).toFixed(0)}
            </div>
          )}
        </div>
      )}

      {/* Status indicator */}
      {isActive && (
        <div
          data-element="crop-tool-status"
          className={css({
            position: "absolute",
            top: 2,
            left: 2,
            bg: "red.600",
            color: "white",
            px: 3,
            py: 2,
            rounded: "md",
            fontSize: "sm",
            fontWeight: "bold",
            zIndex: 1002,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          })}
        >
          <div>
            🎯 CROP MODE: {mapId}/{continentId}
          </div>
          <div className={css({ fontSize: "xs", fontWeight: "normal" })}>
            Draw a box • R to reset • ESC to exit
          </div>
          {saveStatus === "saving" && (
            <div
              className={css({
                fontSize: "xs",
                fontWeight: "normal",
                color: "yellow.200",
              })}
            >
              ⏳ Saving...
            </div>
          )}
          {saveStatus === "saved" && (
            <div
              className={css({
                fontSize: "xs",
                fontWeight: "normal",
                color: "green.200",
              })}
            >
              ✅ Saved! Map updated live.
            </div>
          )}
          {saveStatus === "error" && (
            <div
              className={css({
                fontSize: "xs",
                fontWeight: "normal",
                color: "red.200",
              })}
            >
              ❌ Error saving. Check console.
            </div>
          )}
        </div>
      )}
    </>
  );
}
