"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Textfit } from "react-textfit";
import { css } from "../../../../styled-system/css";
import { Z_INDEX } from "@/constants/zIndex";
import { useAbacusSettings } from "@/hooks/useAbacusSettings";
import { useViewport } from "@/contexts/ViewportContext";
import { OverviewSection } from "./guide-sections/OverviewSection";
import { PiecesSection } from "./guide-sections/PiecesSection";
import { CaptureSection } from "./guide-sections/CaptureSection";
import { StrategySection } from "./guide-sections/StrategySection";
import { HarmonySection } from "./guide-sections/HarmonySection";
import { VictorySection } from "./guide-sections/VictorySection";

interface PlayingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  standalone?: boolean; // True when opened in popup window
  docked?: boolean; // True when docked to side
  onDock?: (side: "left" | "right") => void;
  onUndock?: () => void;
  onDockPreview?: (side: "left" | "right" | null) => void; // Preview docking without committing
}

type Section =
  | "overview"
  | "pieces"
  | "capture"
  | "strategy"
  | "harmony"
  | "victory";

export function PlayingGuideModal({
  isOpen,
  onClose,
  standalone = false,
  docked = false,
  onDock,
  onUndock,
  onDockPreview,
}: PlayingGuideModalProps) {
  const t = useTranslations("rithmomachia.guide");
  const { data: abacusSettings } = useAbacusSettings();
  const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false;
  const viewport = useViewport();

  const [activeSection, setActiveSection] = useState<Section>("overview");

  // Load saved position and size from localStorage
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const saved = localStorage.getItem("rithmomachia-guide-position");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { x: 0, y: 0 };
      }
    }
    return { x: 0, y: 0 };
  });

  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window === "undefined") return { width: 800, height: 600 };
    const saved = localStorage.getItem("rithmomachia-guide-size");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { width: 800, height: 600 };
      }
    }
    return { width: 800, height: 600 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? viewport.width : 800,
  );
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>("");
  const [resizeStart, setResizeStart] = useState({
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  });
  const [isHovered, setIsHovered] = useState(false);
  const [dockPreview, setDockPreview] = useState<"left" | "right" | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const hasUndockedRef = useRef(false); // Track if we've undocked during current drag
  const undockPositionRef = useRef<{ x: number; y: number } | null>(null); // Position at moment of undocking
  const [dragTransform, setDragTransform] = useState<{
    x: number;
    y: number;
  } | null>(null); // Visual transform while dragging from dock

  // Save position to localStorage whenever it changes
  useEffect(() => {
    if (!docked && !standalone) {
      localStorage.setItem(
        "rithmomachia-guide-position",
        JSON.stringify(position),
      );
    }
  }, [position, docked, standalone]);

  // Save size to localStorage whenever it changes
  useEffect(() => {
    if (!docked && !standalone) {
      localStorage.setItem("rithmomachia-guide-size", JSON.stringify(size));
    }
  }, [size, docked, standalone]);

  // Track window width for responsive behavior
  useEffect(() => {
    setWindowWidth(viewport.width);
  }, [viewport.width]);

  // Center modal on mount (not in standalone mode)
  useEffect(() => {
    if (isOpen && modalRef.current && !standalone) {
      const rect = modalRef.current.getBoundingClientRect();
      setPosition({
        x: (viewport.width - rect.width) / 2,
        y: Math.max(50, (viewport.height - rect.height) / 2),
      });
    }
  }, [isOpen, standalone]);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    console.log(
      "[GUIDE_DRAG] === MOUSE DOWN === windowWidth: " +
        viewport.width +
        ", standalone: " +
        standalone +
        ", docked: " +
        docked,
    );
    if (viewport.width < 768 || standalone) {
      console.log("[GUIDE_DRAG] Skipping drag - mobile or standalone");
      return; // No dragging on mobile or standalone
    }
    console.log(
      "[GUIDE_DRAG] Starting drag - docked: " +
        docked +
        ", position: " +
        JSON.stringify(position) +
        ", size: " +
        JSON.stringify(size),
    );
    setIsDragging(true);
    hasUndockedRef.current = false; // Reset undock tracking for new drag
    undockPositionRef.current = null; // Clear undock position
    setDragTransform(null); // Clear any previous transform

    // When docked, we need to track the initial mouse position for undocking
    if (docked) {
      console.log(
        "[GUIDE_DRAG] Docked - setting dragStart to clientX: " +
          e.clientX +
          ", clientY: " +
          e.clientY,
      );
      setDragStart({
        x: e.clientX,
        y: e.clientY,
      });
    } else {
      console.log(
        "[GUIDE_DRAG] Not docked - setting dragStart offset: " +
          (e.clientX - position.x) +
          ", " +
          (e.clientY - position.y),
      );
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    if (viewport.width < 768 || standalone) return;
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setDragStart({ x: e.clientX, y: e.clientY });
    // Save initial dimensions and position for resize calculation
    setResizeStart({
      width: size.width,
      height: size.height,
      x: position.x,
      y: position.y,
    });
  };

  // Bust-out button handler
  const handleBustOut = () => {
    const url = `${window.location.origin}/arcade/rithmomachia/guide`;
    const features =
      "width=600,height=800,menubar=no,toolbar=no,location=no,status=no";
    window.open(url, "RithmomachiaGuide", features);
    onClose(); // Close the modal version after opening in new window
  };

  // Mouse move effect for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        console.log(
          "[GUIDE_DRAG] Mouse move - clientX: " +
            e.clientX +
            ", clientY: " +
            e.clientY +
            ", docked: " +
            docked +
            ", hasUndocked: " +
            hasUndockedRef.current,
        );

        // When docked and haven't undocked yet, check if we've dragged far enough away to undock
        if (docked && onUndock && !hasUndockedRef.current) {
          const UNDOCK_THRESHOLD = 50; // pixels to drag before undocking
          const dragDistance = Math.sqrt(
            (e.clientX - dragStart.x) ** 2 + (e.clientY - dragStart.y) ** 2,
          );

          console.log(
            "[GUIDE_DRAG] Checking threshold - distance: " +
              dragDistance +
              ", threshold: " +
              UNDOCK_THRESHOLD +
              ", dragStart: " +
              JSON.stringify(dragStart),
          );

          if (dragDistance > UNDOCK_THRESHOLD) {
            console.log(
              "[GUIDE_DRAG] === THRESHOLD EXCEEDED === Marking as virtually undocked",
            );
            hasUndockedRef.current = true;
            // Don't call onUndock() yet - wait until mouse up to avoid unmounting during drag
            // After undocking, set dragStart as offset from position to cursor for smooth continued dragging
            if (modalRef.current) {
              const rect = modalRef.current.getBoundingClientRect();
              console.log(
                "[GUIDE_DRAG] Modal rect - left: " +
                  rect.left +
                  ", top: " +
                  rect.top +
                  ", width: " +
                  rect.width +
                  ", height: " +
                  rect.height,
              );

              // Store the undock position in ref for immediate access
              undockPositionRef.current = {
                x: rect.left,
                y: rect.top,
              };
              console.log(
                "[GUIDE_DRAG] Stored undock position in ref: " +
                  JSON.stringify(undockPositionRef.current),
              );

              // Set dragStart as offset from current position to cursor
              const newDragStartX = e.clientX - rect.left;
              const newDragStartY = e.clientY - rect.top;
              console.log(
                "[GUIDE_DRAG] New dragStart offset: " +
                  newDragStartX +
                  ", " +
                  newDragStartY,
              );
              setDragStart({
                x: newDragStartX,
                y: newDragStartY,
              });
              // Also store the position for state (used when actually undocking)
              setPosition({
                x: rect.left,
                y: rect.top,
              });
            }
          } else {
            console.log("[GUIDE_DRAG] Below threshold - returning early");
            // Still below threshold - don't apply any transform yet
            return;
          }
        }

        // Virtually undocked or already floating - update position
        if (hasUndockedRef.current || !docked) {
          const newX = e.clientX - dragStart.x;
          const newY = e.clientY - dragStart.y;
          console.log(
            "[GUIDE_DRAG] Calculating position - newX: " +
              newX +
              ", newY: " +
              newY +
              ", dragStart: " +
              JSON.stringify(dragStart),
          );

          if (hasUndockedRef.current && docked) {
            // Still docked but virtually undocked - use transform for visual movement
            // Use undockPositionRef instead of position state to avoid stale closure
            if (undockPositionRef.current) {
              const transformX = newX - undockPositionRef.current.x;
              const transformY = newY - undockPositionRef.current.y;
              console.log(
                "[GUIDE_DRAG] === SETTING TRANSFORM === x: " +
                  transformX +
                  ", y: " +
                  transformY +
                  ", undockPosition: " +
                  JSON.stringify(undockPositionRef.current),
              );
              setDragTransform({ x: transformX, y: transformY });
            }
          } else {
            // Actually floating - use position
            console.log(
              "[GUIDE_DRAG] Floating - setting position: " + newX + ", " + newY,
            );
            setPosition({
              x: newX,
              y: newY,
            });
          }

          // Check if we're near edges for docking preview (works for floating or virtually undocked)
          console.log(
            "[GUIDE_DRAG] Checking docking preview - onDock: " +
              (onDock ? "defined" : "undefined") +
              ", onDockPreview: " +
              (onDockPreview ? "defined" : "undefined") +
              ", docked: " +
              docked +
              ", hasUndocked: " +
              hasUndockedRef.current,
          );
          if (onDock && onDockPreview && (!docked || hasUndockedRef.current)) {
            const DOCK_THRESHOLD = 100;
            console.log(
              "[GUIDE_DRAG] Docking preview condition passed - checking edges, clientX: " +
                e.clientX,
            );
            if (e.clientX < DOCK_THRESHOLD) {
              setDockPreview("left");
              onDockPreview("left");
            } else if (e.clientX > viewport.width - DOCK_THRESHOLD) {
              setDockPreview("right");
              onDockPreview("right");
            } else {
              setDockPreview(null);
              onDockPreview(null);
            }
          }
        }
      } else if (isResizing) {
        // Calculate delta from initial resize start position
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = resizeStart.x;
        let newY = resizeStart.y;

        // Handle different resize directions - calculate from initial state
        // Ultra-flexible minimum width for narrow layouts
        const minWidth = 150;
        const minHeight = 300;

        if (resizeDirection.includes("e")) {
          newWidth = Math.max(
            minWidth,
            Math.min(viewport.width * 0.9, resizeStart.width + deltaX),
          );
        }
        if (resizeDirection.includes("w")) {
          const desiredWidth = resizeStart.width - deltaX;
          newWidth = Math.max(
            minWidth,
            Math.min(viewport.width * 0.9, desiredWidth),
          );
          // Move left edge by the amount we actually changed width
          newX = resizeStart.x + (resizeStart.width - newWidth);
        }
        if (resizeDirection.includes("s")) {
          newHeight = Math.max(
            minHeight,
            Math.min(viewport.height * 0.9, resizeStart.height + deltaY),
          );
        }
        if (resizeDirection.includes("n")) {
          const desiredHeight = resizeStart.height - deltaY;
          newHeight = Math.max(
            minHeight,
            Math.min(viewport.height * 0.9, desiredHeight),
          );
          // Move top edge by the amount we actually changed height
          newY = resizeStart.y + (resizeStart.height - newHeight);
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      console.log(
        "[GUIDE_DRAG] === MOUSE UP === clientX: " +
          e.clientX +
          ", docked: " +
          docked +
          ", hasUndocked: " +
          hasUndockedRef.current +
          ", isDragging: " +
          isDragging +
          ", onDock: " +
          (onDock ? "defined" : "undefined"),
      );

      // Check for docking when releasing drag (works for floating or virtually undocked)
      if (isDragging && onDock && (!docked || hasUndockedRef.current)) {
        const DOCK_THRESHOLD = 100; // pixels from edge to trigger docking
        console.log(
          "[GUIDE_DRAG] Checking for dock - clientX: " +
            e.clientX +
            ", threshold: " +
            DOCK_THRESHOLD +
            ", windowWidth: " +
            viewport.width,
        );

        if (e.clientX < DOCK_THRESHOLD) {
          console.log(
            "[GUIDE_DRAG] Mouse up - near left edge, calling onDock(left)",
          );
          onDock("left");
          // Don't call onUndock if we're re-docking
          setIsDragging(false);
          setIsResizing(false);
          setResizeDirection("");
          setDockPreview(null);
          setDragTransform(null);
          if (onDockPreview) {
            onDockPreview(null);
          }
          console.log("[GUIDE_DRAG] Cleared state after re-dock to left");
          return;
        } else if (e.clientX > viewport.width - DOCK_THRESHOLD) {
          console.log(
            "[GUIDE_DRAG] Mouse up - near right edge, calling onDock(right)",
          );
          onDock("right");
          // Don't call onUndock if we're re-docking
          setIsDragging(false);
          setIsResizing(false);
          setResizeDirection("");
          setDockPreview(null);
          setDragTransform(null);
          if (onDockPreview) {
            onDockPreview(null);
          }
          console.log("[GUIDE_DRAG] Cleared state after re-dock to right");
          return;
        }
      }

      // If we virtually undocked during this drag and didn't re-dock, now actually undock
      if (hasUndockedRef.current && docked && onUndock) {
        console.log(
          "[GUIDE_DRAG] Mouse up - calling deferred onUndock() with final position: " +
            JSON.stringify(position),
        );
        onUndock();
      }

      console.log("[GUIDE_DRAG] Mouse up - clearing all drag state");
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection("");
      setDockPreview(null); // Clear dock preview when drag ends
      setDragTransform(null); // Clear drag transform
      if (onDockPreview) {
        onDockPreview(null); // Clear parent preview state
      }
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    isResizing,
    dragStart,
    resizeDirection,
    resizeStart,
    docked,
    onUndock,
    onDock,
    onDockPreview,
  ]);

  if (!isOpen && !standalone && !docked) return null;

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: "overview", label: t("sections.overview"), icon: "🎯" },
    { id: "pieces", label: t("sections.pieces"), icon: "♟️" },
    { id: "capture", label: t("sections.capture"), icon: "⚔️" },
    { id: "strategy", label: t("sections.strategy"), icon: "🧠" },
    { id: "harmony", label: t("sections.harmony"), icon: "🎵" },
    { id: "victory", label: t("sections.victory"), icon: "👑" },
  ];

  // Determine layout mode based on modal width (or window width if standalone)
  const effectiveWidth = standalone ? windowWidth : size.width;
  const isVeryNarrow = effectiveWidth < 250;
  const isNarrow = effectiveWidth < 400;
  const isMedium = effectiveWidth < 600;

  const renderResizeHandles = () => {
    if (!isHovered || viewport.width < 768 || standalone) return null;

    const handleStyle = {
      position: "absolute" as const,
      bg: "transparent",
      zIndex: 1,
      _hover: { borderColor: "#3b82f6" },
    };

    return (
      <>
        {/* North */}
        <div
          data-element="resize-n"
          className={css({
            ...handleStyle,
            top: 0,
            left: "8px",
            right: "8px",
            height: "8px",
            cursor: "ns-resize",
            borderTop: "2px solid transparent",
          })}
          onMouseDown={(e) => handleResizeStart(e, "n")}
        />
        {/* South */}
        <div
          data-element="resize-s"
          className={css({
            ...handleStyle,
            bottom: 0,
            left: "8px",
            right: "8px",
            height: "8px",
            cursor: "ns-resize",
            borderBottom: "2px solid transparent",
          })}
          onMouseDown={(e) => handleResizeStart(e, "s")}
        />
        {/* East */}
        <div
          data-element="resize-e"
          className={css({
            ...handleStyle,
            right: 0,
            top: "8px",
            bottom: "8px",
            width: "8px",
            cursor: "ew-resize",
            borderRight: "2px solid transparent",
          })}
          onMouseDown={(e) => handleResizeStart(e, "e")}
        />
        {/* West */}
        <div
          data-element="resize-w"
          className={css({
            ...handleStyle,
            left: 0,
            top: "8px",
            bottom: "8px",
            width: "8px",
            cursor: "ew-resize",
            borderLeft: "2px solid transparent",
          })}
          onMouseDown={(e) => handleResizeStart(e, "w")}
        />
        {/* NorthEast */}
        <div
          data-element="resize-ne"
          className={css({
            ...handleStyle,
            top: 0,
            right: 0,
            width: "8px",
            height: "8px",
            cursor: "nesw-resize",
            border: "2px solid transparent",
          })}
          onMouseDown={(e) => handleResizeStart(e, "ne")}
        />
        {/* NorthWest */}
        <div
          data-element="resize-nw"
          className={css({
            ...handleStyle,
            top: 0,
            left: 0,
            width: "8px",
            height: "8px",
            cursor: "nwse-resize",
            border: "2px solid transparent",
          })}
          onMouseDown={(e) => handleResizeStart(e, "nw")}
        />
        {/* SouthEast */}
        <div
          data-element="resize-se"
          className={css({
            ...handleStyle,
            bottom: 0,
            right: 0,
            width: "8px",
            height: "8px",
            cursor: "nwse-resize",
            border: "2px solid transparent",
          })}
          onMouseDown={(e) => handleResizeStart(e, "se")}
        />
        {/* SouthWest */}
        <div
          data-element="resize-sw"
          className={css({
            ...handleStyle,
            bottom: 0,
            left: 0,
            width: "8px",
            height: "8px",
            cursor: "nesw-resize",
            border: "2px solid transparent",
          })}
          onMouseDown={(e) => handleResizeStart(e, "sw")}
        />
      </>
    );
  };

  const modalContent = (() => {
    const styleConfig: React.CSSProperties = {
      // When virtually undocked (dragTransform present), use fixed positioning to break out of Panel
      position: dragTransform || !docked ? "fixed" : "relative",
      background: "white",
      borderRadius:
        standalone || (docked && !dragTransform)
          ? 0
          : isVeryNarrow
            ? "8px"
            : "12px",
      boxShadow:
        standalone || (docked && !dragTransform)
          ? "none"
          : "0 20px 60px rgba(0, 0, 0, 0.3)",
      border:
        standalone || (docked && !dragTransform) ? "none" : "1px solid #e5e7eb",
      display: "flex",
      flexDirection: "column" as const,
      overflow: "hidden",
      ...(dragTransform && undockPositionRef.current
        ? // Virtually undocked - show at drag position using ref position
          {
            left: `${undockPositionRef.current.x + dragTransform.x}px`,
            top: `${undockPositionRef.current.y + dragTransform.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            zIndex: Z_INDEX.MODAL,
          }
        : docked
          ? // Still docked
            { width: "100%", height: "100%" }
          : standalone
            ? // Standalone mode
              { top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 1 }
            : // Actually floating
              {
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                zIndex: Z_INDEX.MODAL,
              }),
      // 80% opacity when showing dock preview or when not hovered on desktop
      opacity:
        dockPreview !== null
          ? 0.8
          : !standalone && !docked && viewport.width >= 768 && !isHovered
            ? 0.8
            : 1,
      transition: "opacity 0.2s ease",
    };

    console.log(
      "[GUIDE_DRAG] Rendering with style - position: " +
        styleConfig.position +
        ", left: " +
        (styleConfig.left ?? "none") +
        ", top: " +
        (styleConfig.top ?? "none") +
        ", dragTransform: " +
        JSON.stringify(dragTransform) +
        ", docked: " +
        docked,
    );

    return (
      <div
        ref={modalRef}
        data-component="playing-guide-modal"
        style={styleConfig}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {!docked && renderResizeHandles()}

        {/* Header */}
        <div
          data-element="modal-header"
          className={css({
            bg: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
            userSelect: "none",
            flexShrink: 0,
            position: "relative",
          })}
          style={{
            padding: isVeryNarrow ? "8px" : isNarrow ? "12px" : "24px",
            cursor: isDragging
              ? "grabbing"
              : !standalone && viewport.width >= 768
                ? "grab"
                : "default",
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Close and utility buttons - top right */}
          <div
            style={{
              position: "absolute",
              top: isVeryNarrow ? "4px" : "8px",
              right: isVeryNarrow ? "4px" : "8px",
              display: "flex",
              alignItems: "center",
              gap: isVeryNarrow ? "4px" : "8px",
            }}
          >
            {/* Bust-out button (only if not already standalone/docked and not very narrow) */}
            {!standalone && !docked && !isVeryNarrow && (
              <button
                type="button"
                data-action="bust-out-guide"
                onClick={handleBustOut}
                style={{
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: isVeryNarrow ? "4px" : "6px",
                  width: isVeryNarrow ? "24px" : "32px",
                  height: isVeryNarrow ? "24px" : "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: isVeryNarrow ? "12px" : "16px",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#d1d5db")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "#e5e7eb")
                }
                title={t("bustOut")}
              >
                ↗
              </button>
            )}

            {/* Close button */}
            <button
              type="button"
              data-action="close-guide"
              onClick={onClose}
              style={{
                background: "#e5e7eb",
                color: "#374151",
                border: "none",
                borderRadius: isVeryNarrow ? "4px" : "6px",
                width: isVeryNarrow ? "24px" : "32px",
                height: isVeryNarrow ? "24px" : "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: isVeryNarrow ? "14px" : "18px",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#d1d5db")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#e5e7eb")
              }
            >
              ✕
            </button>
          </div>

          {/* Centered title and subtitle - hide when very narrow */}
          {!isVeryNarrow && (
            <div style={{ textAlign: "center" }}>
              <h1
                style={{
                  fontSize: isNarrow ? "16px" : isMedium ? "20px" : "28px",
                  fontWeight: "bold",
                  color: "#111827",
                  marginBottom: isNarrow ? "4px" : "8px",
                  lineHeight: 1.2,
                }}
              >
                {t("title")}
              </h1>
              {!isNarrow && (
                <p
                  style={{
                    fontSize: isMedium ? "12px" : "16px",
                    color: "#6b7280",
                    marginBottom: isMedium ? "8px" : "16px",
                    lineHeight: 1.3,
                  }}
                >
                  {t("subtitle")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation Tabs - fully responsive, always fit in available width */}
        <div
          data-element="guide-nav"
          style={{
            display: "flex",
            flexDirection: "row",
            borderBottom: "2px solid #e5e7eb",
            background: "#f9fafb",
            flexShrink: 0,
          }}
        >
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              data-action={`navigate-${section.id}`}
              onClick={() => setActiveSection(section.id)}
              style={{
                flex: "1 1 0", // Equal width tabs
                minWidth: 0, // Allow shrinking below content size
                padding: isVeryNarrow
                  ? "10px 6px"
                  : isNarrow
                    ? "10px 8px"
                    : "14px 20px",
                fontSize: isVeryNarrow ? "16px" : isNarrow ? "12px" : "14px",
                fontWeight: activeSection === section.id ? "bold" : "500",
                color: activeSection === section.id ? "#7c2d12" : "#6b7280",
                background:
                  activeSection === section.id ? "white" : "transparent",
                cursor: "pointer",
                transition: "all 0.2s",
                border: "none",
                borderBottom: `3px solid ${activeSection === section.id ? "#7c2d12" : "transparent"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: isVeryNarrow ? "0" : isNarrow ? "4px" : "6px",
                lineHeight: 1,
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                if (activeSection !== section.id) {
                  e.currentTarget.style.background = "#f3f4f6";
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== section.id) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
              title={section.label}
            >
              <span
                style={{
                  fontSize: isVeryNarrow ? "18px" : "inherit",
                  flexShrink: 0,
                }}
              >
                {section.icon}
              </span>
              {!isVeryNarrow && (
                <Textfit
                  mode="single"
                  min={8}
                  max={isNarrow ? 12 : 14}
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {section.label}
                </Textfit>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          data-element="guide-content"
          style={{
            flex: 1,
            overflow: "auto",
            padding: isVeryNarrow ? "8px" : isNarrow ? "12px" : "24px",
            fontSize: isVeryNarrow ? "12px" : isNarrow ? "13px" : "14px",
            lineHeight: 1.5,
          }}
        >
          {activeSection === "overview" && (
            <OverviewSection useNativeAbacusNumbers={useNativeAbacusNumbers} />
          )}
          {activeSection === "pieces" && (
            <PiecesSection useNativeAbacusNumbers={useNativeAbacusNumbers} />
          )}
          {activeSection === "capture" && (
            <CaptureSection useNativeAbacusNumbers={useNativeAbacusNumbers} />
          )}
          {activeSection === "strategy" && (
            <StrategySection useNativeAbacusNumbers={useNativeAbacusNumbers} />
          )}
          {activeSection === "harmony" && (
            <HarmonySection useNativeAbacusNumbers={useNativeAbacusNumbers} />
          )}
          {activeSection === "victory" && (
            <VictorySection useNativeAbacusNumbers={useNativeAbacusNumbers} />
          )}
        </div>
      </div>
    );
  })(); // Invoke the IIFE

  // If standalone, just render the content without Dialog wrapper
  if (standalone) {
    return modalContent;
  }

  // Otherwise, just render the modal (parent will handle preview rendering)
  return modalContent;
}
