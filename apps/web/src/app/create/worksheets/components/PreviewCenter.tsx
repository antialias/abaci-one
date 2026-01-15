"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { animated, useSpring } from "@react-spring/web";
import { css } from "@styled/css";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { WorksheetFormState } from "@/app/create/worksheets/types";
import { UploadWorksheetModal } from "@/components/worksheets/UploadWorksheetModal";
import { useTheme } from "@/contexts/ThemeContext";
import { extractConfigFields } from "../utils/extractConfigFields";
import { FloatingPageIndicator } from "./FloatingPageIndicator";
import { LoadShareCodeModal } from "./LoadShareCodeModal";
import { ShareModal } from "./ShareModal";
import { useWorksheetConfig } from "./WorksheetConfigContext";
import { WorksheetPreview } from "./WorksheetPreview";
import { DuplicateWarningBanner } from "./worksheet-preview/DuplicateWarningBanner";
import { WorksheetPreviewProvider } from "./worksheet-preview/WorksheetPreviewContext";

// Dot patterns for each dice face (positions as fractions of face size)
const DICE_DOT_PATTERNS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.25, 0.25],
    [0.75, 0.75],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.25, 0.2],
    [0.25, 0.5],
    [0.25, 0.8],
    [0.75, 0.2],
    [0.75, 0.5],
    [0.75, 0.8],
  ],
};

// Rotation needed to show each face
// Standard dice: 1 opposite 6, 2 opposite 5, 3 opposite 4
const DICE_FACE_ROTATIONS: Record<
  number,
  { rotateX: number; rotateY: number }
> = {
  1: { rotateX: 0, rotateY: 0 }, // front
  2: { rotateX: 0, rotateY: -90 }, // right
  3: { rotateX: -90, rotateY: 0 }, // top
  4: { rotateX: 90, rotateY: 0 }, // bottom
  5: { rotateX: 0, rotateY: 90 }, // left
  6: { rotateX: 0, rotateY: 180 }, // back
};

/**
 * 3D Dice Icon using react-spring for smooth animations
 *
 * Creates a cube with 6 faces, each showing the appropriate dot pattern.
 * The cube rotates on all 3 axes when rolling, with physics-based easing.
 */
function DiceIcon({
  className,
  rotateX,
  rotateY,
  rotateZ,
  isDark,
}: {
  className?: string;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  isDark: boolean;
}) {
  const size = 22;
  const halfSize = size / 2;

  // Animate rotation with react-spring
  const springProps = useSpring({
    rotateX,
    rotateY,
    rotateZ,
    config: {
      tension: 120,
      friction: 14,
    },
  });

  // Theme-aware colors
  // Dark mode: lighter indigo with more contrast against dark backgrounds
  // Light mode: deeper indigo that stands out against light backgrounds
  const faceBackground = isDark ? "#818cf8" : "#4f46e5"; // indigo-400 dark, indigo-600 light
  const faceBorder = isDark
    ? "rgba(255, 255, 255, 0.6)"
    : "rgba(255, 255, 255, 0.5)";
  const dotColor = isDark ? "#1e1b4b" : "white"; // indigo-950 dots on light bg in dark mode

  // Render dots for a face
  const renderDots = (face: number) => {
    const dots = DICE_DOT_PATTERNS[face] || [];
    return dots.map(([x, y], i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: "18%",
          height: "18%",
          backgroundColor: dotColor,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
    ));
  };

  // Common face styles - opaque background to prevent artifacts during rotation
  const faceStyle: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    backgroundColor: faceBackground,
    border: `1.5px solid ${faceBorder}`,
    borderRadius: 2,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        perspective: 100,
        perspectiveOrigin: "center",
      }}
    >
      <animated.div
        data-dice-cube
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
          transform: springProps.rotateX.to(
            (rx) =>
              `rotateX(${rx}deg) rotateY(${springProps.rotateY.get()}deg) rotateZ(${springProps.rotateZ.get()}deg)`,
          ),
        }}
      >
        {/* Front face (1) */}
        <div style={{ ...faceStyle, transform: `translateZ(${halfSize}px)` }}>
          {renderDots(1)}
        </div>
        {/* Back face (6) */}
        <div
          style={{
            ...faceStyle,
            transform: `rotateY(180deg) translateZ(${halfSize}px)`,
          }}
        >
          {renderDots(6)}
        </div>
        {/* Right face (2) */}
        <div
          style={{
            ...faceStyle,
            transform: `rotateY(90deg) translateZ(${halfSize}px)`,
          }}
        >
          {renderDots(2)}
        </div>
        {/* Left face (5) */}
        <div
          style={{
            ...faceStyle,
            transform: `rotateY(-90deg) translateZ(${halfSize}px)`,
          }}
        >
          {renderDots(5)}
        </div>
        {/* Top face (3) */}
        <div
          style={{
            ...faceStyle,
            transform: `rotateX(90deg) translateZ(${halfSize}px)`,
          }}
        >
          {renderDots(3)}
        </div>
        {/* Bottom face (4) */}
        <div
          style={{
            ...faceStyle,
            transform: `rotateX(-90deg) translateZ(${halfSize}px)`,
          }}
        >
          {renderDots(4)}
        </div>
      </animated.div>
    </div>
  );
}

interface PreviewCenterProps {
  formState: WorksheetFormState;
  initialPreview?: string[];
  onGenerate: () => Promise<void>;
  status: "idle" | "generating" | "success" | "error";
  isReadOnly?: boolean;
  onShare?: () => Promise<void>;
  onEdit?: () => void;
}

export function PreviewCenter({
  formState,
  initialPreview,
  onGenerate,
  status,
  isReadOnly = false,
  onShare,
  onEdit,
}: PreviewCenterProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { onChange } = useWorksheetConfig();
  const isDark = resolvedTheme === "dark";
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isLoadShareModalOpen, setIsLoadShareModalOpen] = useState(false);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  // Dice rotation state for react-spring animation
  // We track cumulative spins to add visual flair, then compute final rotation
  // to land on the correct face derived from the seed
  const [spinCount, setSpinCount] = useState(0);
  // Track which face we're showing (for ensuring consecutive rolls differ)
  const [currentFace, setCurrentFace] = useState(
    () => ((formState.seed ?? 0) % 5) + 2,
  );

  // Draggable dice state with physics simulation
  const [isDragging, setIsDragging] = useState(false);
  const [diceOrigin, setDiceOrigin] = useState({ x: 0, y: 0 });
  const diceButtonRef = useRef<HTMLButtonElement>(null);
  const diceContainerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Physics state for thrown dice
  const [isFlying, setIsFlying] = useState(false);
  const dicePhysics = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scale: 1, // Grows to 3x when flying, shrinks back when settling
  });
  const lastPointerPos = useRef({ x: 0, y: 0, time: 0 });
  // Track velocity samples for smoother flick detection
  const velocitySamples = useRef<
    Array<{ vx: number; vy: number; time: number }>
  >([]);
  const animationFrameRef = useRef<number>();

  // Ref to the portal dice element for direct DOM manipulation during drag/flying (avoids re-renders)
  const portalDiceRef = useRef<HTMLDivElement>(null);

  // Compute target rotation for the current face (needed by physics simulation)
  const targetFaceRotation = DICE_FACE_ROTATIONS[currentFace] || {
    rotateX: 0,
    rotateY: 0,
  };

  // Physics simulation for thrown dice - uses direct DOM manipulation for performance
  useEffect(() => {
    if (!isFlying) return;

    const BASE_GRAVITY = 0.8; // Base pull toward origin
    const BASE_FRICTION = 0.94; // Base velocity dampening (slightly less friction for longer flight)
    const ROTATION_FACTOR = 0.5; // How much velocity affects rotation
    const STOP_THRESHOLD = 2; // Distance threshold to snap home
    const VELOCITY_THRESHOLD = 0.5; // Velocity threshold to snap home
    const CLOSE_RANGE = 40; // Distance at which extra damping kicks in
    const MAX_SCALE = 3; // Maximum scale when flying
    const SCALE_GROW_SPEED = 0.2; // How fast to grow (faster)
    const SCALE_SHRINK_SPEED = 0.06; // How fast to shrink when close (slower for drama)
    const BOUNCE_DAMPING = 0.7; // How much velocity is retained on bounce (0-1)
    const DICE_SIZE = 22; // Size of the dice in pixels

    // Calculate initial throw power to adjust gravity (stronger throws = weaker initial gravity)
    const initialSpeed = Math.sqrt(
      dicePhysics.current.vx * dicePhysics.current.vx +
        dicePhysics.current.vy * dicePhysics.current.vy,
    );
    const throwPower = Math.min(initialSpeed / 20, 1); // 0-1 based on throw strength

    let frameCount = 0;

    const animate = () => {
      const p = dicePhysics.current;
      const el = portalDiceRef.current;
      if (!el) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      frameCount++;

      // Calculate distance to origin
      const dist = Math.sqrt(p.x * p.x + p.y * p.y);

      // Gravity ramps up over time (weak at first for strong throws, then strengthens)
      const gravityRampUp = Math.min(frameCount / 30, 1); // Full gravity after ~0.5s
      const effectiveGravity =
        BASE_GRAVITY * (0.3 + 0.7 * gravityRampUp) * (1 - throwPower * 0.5);

      // Apply spring force toward origin (proportional to distance)
      if (dist > 0) {
        // Quadratic falloff for more natural feel
        const pullStrength = effectiveGravity * (dist / 50) ** 1.2;
        p.vx += (-p.x / dist) * pullStrength;
        p.vy += (-p.y / dist) * pullStrength;
      }

      // Apply friction - extra damping when close to prevent oscillation
      const friction = dist < CLOSE_RANGE ? 0.88 : BASE_FRICTION;
      p.vx *= friction;
      p.vy *= friction;

      // Update position
      p.x += p.vx;
      p.y += p.vy;

      // Viewport edge bounce - calculate absolute position and check bounds
      const scaledSize = DICE_SIZE * p.scale;
      const absoluteX = diceOrigin.x + p.x;
      const absoluteY = diceOrigin.y + p.y;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Left edge bounce
      if (absoluteX < 0) {
        p.x = -diceOrigin.x; // Position at left edge
        p.vx = Math.abs(p.vx) * BOUNCE_DAMPING; // Reverse and dampen
        // Add extra spin on bounce
        p.rotationZ += p.vx * 5;
      }
      // Right edge bounce
      if (absoluteX + scaledSize > viewportWidth) {
        p.x = viewportWidth - diceOrigin.x - scaledSize;
        p.vx = -Math.abs(p.vx) * BOUNCE_DAMPING;
        p.rotationZ -= p.vx * 5;
      }
      // Top edge bounce
      if (absoluteY < 0) {
        p.y = -diceOrigin.y;
        p.vy = Math.abs(p.vy) * BOUNCE_DAMPING;
        p.rotationZ += p.vy * 5;
      }
      // Bottom edge bounce
      if (absoluteY + scaledSize > viewportHeight) {
        p.y = viewportHeight - diceOrigin.y - scaledSize;
        p.vy = -Math.abs(p.vy) * BOUNCE_DAMPING;
        p.rotationZ -= p.vy * 5;
      }

      // Update rotation based on velocity (dice rolls as it moves)
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);

      // As dice gets closer to home, gradually lerp rotation toward final face
      // settleProgress: 0 = far away (full physics rotation), 1 = at home (target rotation)
      const SETTLE_START_DIST = 150; // Start settling rotation at this distance
      const settleProgress = Math.max(0, 1 - dist / SETTLE_START_DIST);
      const settleFactor = settleProgress * settleProgress * settleProgress; // Cubic easing for smooth settle

      // Physics rotation (tumbling)
      const physicsRotationDelta = {
        x: p.vy * ROTATION_FACTOR * 12,
        y: -p.vx * ROTATION_FACTOR * 12,
        z: speed * ROTATION_FACTOR * 3,
      };

      // Apply physics rotation, but reduced as we settle
      p.rotationX += physicsRotationDelta.x * (1 - settleFactor);
      p.rotationY += physicsRotationDelta.y * (1 - settleFactor);
      p.rotationZ += physicsRotationDelta.z * (1 - settleFactor);

      // Lerp toward target face rotation as we settle
      // Target rotation should show the correct face (from DICE_FACE_ROTATIONS)
      const lerpSpeed = 0.08 * settleFactor; // Faster lerp as we get closer
      if (settleFactor > 0.01) {
        // Normalize rotations to find shortest path to target
        const targetX = targetFaceRotation.rotateX;
        const targetY = targetFaceRotation.rotateY;
        const targetZ = 0; // Final Z rotation should be 0 (flat)

        // Normalize current rotation to -180 to 180 range for smooth interpolation
        const normalizeAngle = (angle: number) => {
          let normalized = angle % 360;
          if (normalized > 180) normalized -= 360;
          if (normalized < -180) normalized += 360;
          return normalized;
        };

        const currentX = normalizeAngle(p.rotationX);
        const currentY = normalizeAngle(p.rotationY);
        const currentZ = normalizeAngle(p.rotationZ);

        // Lerp each axis toward target
        p.rotationX = currentX + (targetX - currentX) * lerpSpeed;
        p.rotationY = currentY + (targetY - currentY) * lerpSpeed;
        p.rotationZ = currentZ + (targetZ - currentZ) * lerpSpeed;
      }

      // Update scale - grow when far/fast, shrink when close/slow
      const targetScale =
        dist > CLOSE_RANGE
          ? MAX_SCALE
          : 1 + ((MAX_SCALE - 1) * dist) / CLOSE_RANGE;
      if (p.scale < targetScale) {
        p.scale = Math.min(p.scale + SCALE_GROW_SPEED, targetScale);
      } else if (p.scale > targetScale) {
        p.scale = Math.max(p.scale - SCALE_SHRINK_SPEED, targetScale);
      }

      // Update DOM directly - no React re-renders
      // Scale from center, offset position to keep visual center stable
      const scaleOffset = ((p.scale - 1) * 22) / 2; // 22 is dice size
      el.style.transform = `translate(${p.x - scaleOffset}px, ${p.y - scaleOffset}px) scale(${p.scale})`;

      // Dynamic shadow based on scale (larger = higher = bigger shadow)
      const shadowSize = (p.scale - 1) * 10;
      const shadowOpacity = Math.min((p.scale - 1) * 0.2, 0.4);
      el.style.filter =
        shadowSize > 0
          ? `drop-shadow(0 ${shadowSize}px ${shadowSize * 1.5}px rgba(0,0,0,${shadowOpacity}))`
          : "none";

      // Update dice rotation
      const diceEl = el.querySelector("[data-dice-cube]") as HTMLElement | null;
      if (diceEl) {
        diceEl.style.transform = `rotateX(${p.rotationX}deg) rotateY(${p.rotationY}deg) rotateZ(${p.rotationZ}deg)`;
      }

      // Check if we should stop - snap to home when close, slow, small, AND rotation is settled
      const totalVelocity = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const rotationSettled =
        Math.abs(p.rotationX - targetFaceRotation.rotateX) < 5 &&
        Math.abs(p.rotationY - targetFaceRotation.rotateY) < 5 &&
        Math.abs(p.rotationZ) < 5;

      if (
        dist < STOP_THRESHOLD &&
        totalVelocity < VELOCITY_THRESHOLD &&
        p.scale < 1.1 &&
        rotationSettled
      ) {
        // Dice has returned home - clear shadow
        el.style.filter = "none";
        setIsFlying(false);
        dicePhysics.current = {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          rotationX: targetFaceRotation.rotateX,
          rotationY: targetFaceRotation.rotateY,
          rotationZ: 0,
          scale: 1,
        };
        return;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    isFlying,
    diceOrigin.x,
    diceOrigin.y,
    targetFaceRotation.rotateX,
    targetFaceRotation.rotateY,
  ]);

  // Compute dice rotation for react-spring animation (used when not flying)
  const diceRotation = {
    rotateX: spinCount * 360 + targetFaceRotation.rotateX,
    rotateY: spinCount * 360 + targetFaceRotation.rotateY,
    rotateZ: spinCount * 180, // Z rotation for extra tumble effect
  };
  const isGenerating = status === "generating";
  const [pageData, setPageData] = useState<{
    currentPage: number;
    totalPages: number;
    jumpToPage: (pageIndex: number) => void;
  } | null>(null);

  // Shuffle problems by generating a new random seed
  const handleShuffle = useCallback(() => {
    // Generate a new random seed (use modulo to keep it in 32-bit int range)
    const newSeed = Date.now() % 2147483647;
    onChange({ seed: newSeed });

    // Calculate target face from seed (2-6, excluding 1 so it's clearly a dice)
    // baseFace is deterministic based on seed
    const baseFace = (newSeed % 5) + 2;

    // Ensure it's different from the current face
    const targetFace =
      baseFace === currentFace ? (baseFace === 6 ? 2 : baseFace + 1) : baseFace;

    // Add 1-2 full spins for visual drama
    const extraSpins = Math.floor(Math.random() * 2) + 1;

    setSpinCount((prev) => prev + extraSpins);
    setCurrentFace(targetFace);
  }, [onChange, currentFace]);

  // Dice drag handlers for the easter egg - drag dice off and release to roll
  const handleDicePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isGenerating) return;
      e.preventDefault();
      e.stopPropagation();

      // Cancel any ongoing physics animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setIsFlying(false);

      // Capture the pointer
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      // Get the dice container's position for portal rendering
      if (diceContainerRef.current) {
        const rect = diceContainerRef.current.getBoundingClientRect();
        setDiceOrigin({ x: rect.left, y: rect.top });
      }

      dragStartPos.current = { x: e.clientX, y: e.clientY };
      lastPointerPos.current = {
        x: e.clientX,
        y: e.clientY,
        time: performance.now(),
      };
      velocitySamples.current = []; // Reset velocity tracking
      dicePhysics.current = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
      };
      setIsDragging(true);
    },
    [isGenerating],
  );

  const handleDicePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();

      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;

      // Calculate drag velocity for live rotation
      const now = performance.now();
      const dt = Math.max(now - lastPointerPos.current.time, 8);
      const vx = (e.clientX - lastPointerPos.current.x) / dt;
      const vy = (e.clientY - lastPointerPos.current.y) / dt;

      // Update rotation based on drag velocity (dice tumbles while being dragged)
      const p = dicePhysics.current;
      p.rotationX += vy * 8;
      p.rotationY -= vx * 8;
      p.rotationZ += Math.sqrt(vx * vx + vy * vy) * 2;

      // Scale up slightly based on distance (feels like pulling it out)
      const dist = Math.sqrt(dx * dx + dy * dy);
      p.scale = 1 + Math.min(dist / 150, 0.5); // Max 1.5x during drag

      // Update DOM directly to avoid React re-renders during drag
      if (portalDiceRef.current) {
        const scaleOffset = ((p.scale - 1) * 22) / 2;
        portalDiceRef.current.style.transform = `translate(${dx - scaleOffset}px, ${dy - scaleOffset}px) scale(${p.scale})`;
        // Add shadow that grows with distance
        const shadowSize = Math.min(dist / 10, 20);
        const shadowOpacity = Math.min(dist / 200, 0.4);
        portalDiceRef.current.style.filter = `drop-shadow(0 ${shadowSize}px ${shadowSize * 1.5}px rgba(0,0,0,${shadowOpacity}))`;

        // Update dice rotation
        const diceEl = portalDiceRef.current.querySelector(
          "[data-dice-cube]",
        ) as HTMLElement | null;
        if (diceEl) {
          diceEl.style.transform = `rotateX(${p.rotationX}deg) rotateY(${p.rotationY}deg) rotateZ(${p.rotationZ}deg)`;
        }
      }

      // Store position in ref for use when releasing
      p.x = dx;
      p.y = dy;

      // Track velocity samples for flick detection (keep last 5 samples, ~80ms window)
      velocitySamples.current.push({ vx, vy, time: now });
      if (velocitySamples.current.length > 5) {
        velocitySamples.current.shift();
      }

      // Track velocity for throw calculation
      lastPointerPos.current = { x: e.clientX, y: e.clientY, time: now };
    },
    [isDragging],
  );

  const handleDicePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();

      // Release the pointer
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      // Calculate throw velocity from velocity samples (average of recent samples for smooth flick)
      const samples = velocitySamples.current;
      let vx = 0;
      let vy = 0;

      if (samples.length > 0) {
        // Weight recent samples more heavily
        let totalWeight = 0;
        for (let i = 0; i < samples.length; i++) {
          const weight = i + 1; // Later samples get higher weight
          vx += samples[i].vx * weight;
          vy += samples[i].vy * weight;
          totalWeight += weight;
        }
        vx /= totalWeight;
        vy /= totalWeight;
      }

      // Get position from physics ref (set during drag)
      const posX = dicePhysics.current.x;
      const posY = dicePhysics.current.y;

      // Calculate distance dragged
      const distance = Math.sqrt(posX ** 2 + posY ** 2);

      // Calculate flick speed
      const flickSpeed = Math.sqrt(vx * vx + vy * vy);

      // If dragged more than 20px OR flicked fast enough, trigger throw physics
      if (distance > 20 || flickSpeed > 0.3) {
        // Amplify throw velocity significantly for satisfying flick
        const throwMultiplier = 25; // Much stronger throw!

        // Initialize physics with current position and throw velocity
        dicePhysics.current = {
          x: posX,
          y: posY,
          vx: vx * throwMultiplier,
          vy: vy * throwMultiplier,
          rotationX: dicePhysics.current.rotationX, // Keep current rotation
          rotationY: dicePhysics.current.rotationY,
          rotationZ: dicePhysics.current.rotationZ,
          scale: dicePhysics.current.scale, // Keep current scale
        };
        setIsFlying(true);
        // Trigger shuffle when thrown
        handleShuffle();
      } else {
        // Not thrown far enough, snap back
        dicePhysics.current = {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scale: 1,
        };
      }

      setIsDragging(false);
    },
    [isDragging, handleShuffle],
  );

  // Detect scrolling in the scroll container
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolling(true);

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set new timeout to hide after 1 second of no scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1000);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Upload complete handler
  const handleUploadComplete = (attemptId: string) => {
    router.push(`/worksheets/attempts/${attemptId}`);
  };

  // Quick share - copy link to clipboard without showing modal
  const handleQuickShare = async () => {
    setIsGeneratingShare(true);
    setJustCopied(false);

    try {
      const response = await fetch("/api/worksheets/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worksheetType: "addition",
          config: extractConfigFields(formState),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create share link");
      }

      const data = await response.json();
      await navigator.clipboard.writeText(data.url);

      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch (err) {
      console.error("Failed to create share link:", err);
      // TODO: Show error toast
    } finally {
      setIsGeneratingShare(false);
    }
  };

  return (
    <div
      data-component="preview-center"
      className={css({
        h: "full",
        w: "full",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        position: "relative",
      })}
    >
      {/* Floating Action Button - Top Right */}
      <div
        data-component="floating-action-button"
        className={css({
          position: "fixed",
          top: "24",
          right: "4",
          zIndex: 1000,
          display: "flex",
          borderRadius: "lg",
          overflow: "hidden",
          shadow: "lg",
          border: "2px solid",
          borderColor: "brand.700",
        })}
      >
        {/* Main Action Button - Edit in read-only mode, Download in edit mode */}
        <button
          type="button"
          data-action={isReadOnly ? "edit-worksheet" : "download-pdf"}
          onClick={isReadOnly ? onEdit : onGenerate}
          disabled={isGenerating}
          className={css({
            px: "4",
            py: "2.5",
            bg: "brand.600",
            color: "white",
            fontSize: "sm",
            fontWeight: "bold",
            cursor: isGenerating ? "not-allowed" : "pointer",
            opacity: isGenerating ? "0.7" : "1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "2",
            transition: "all 0.2s",
            _hover: isGenerating
              ? {}
              : {
                  bg: "brand.700",
                },
          })}
        >
          {isReadOnly ? (
            <>
              <span className={css({ fontSize: "lg" })}>✏️</span>
              <span>Edit</span>
            </>
          ) : isGenerating ? (
            <>
              <div
                className={css({
                  w: "4",
                  h: "4",
                  border: "2px solid",
                  borderColor: "white",
                  borderTopColor: "transparent",
                  rounded: "full",
                  animation: "spin 1s linear infinite",
                })}
              />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <span className={css({ fontSize: "lg" })}>⬇️</span>
              <span>Download</span>
            </>
          )}
        </button>

        {/* Shuffle Button - only in edit mode (1/3 split secondary action) */}
        {/* Easter egg: drag the dice off and release to roll it back! */}
        {!isReadOnly && (
          <button
            ref={diceButtonRef}
            type="button"
            data-action="shuffle-problems"
            onClick={handleShuffle}
            onPointerDown={handleDicePointerDown}
            onPointerMove={handleDicePointerMove}
            onPointerUp={handleDicePointerUp}
            onPointerCancel={handleDicePointerUp}
            disabled={isGenerating}
            title="Shuffle problems (drag or click to roll)"
            className={css({
              px: "3",
              py: "2.5",
              bg: "brand.600",
              color: "white",
              cursor: isDragging
                ? "grabbing"
                : isGenerating
                  ? "not-allowed"
                  : "grab",
              opacity: isGenerating ? "0.7" : "1",
              borderLeft: "1px solid",
              borderColor: "brand.700",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
              touchAction: "none", // Prevent scroll on touch devices
              userSelect: "none",
              _hover: isGenerating
                ? {}
                : {
                    bg: "brand.700",
                  },
            })}
          >
            {/* Dice container - hidden when dragging/flying since we show portal version */}
            <div
              ref={diceContainerRef}
              style={{
                opacity: isDragging || isFlying ? 0 : 1,
                pointerEvents: "none",
              }}
            >
              <DiceIcon
                rotateX={diceRotation.rotateX}
                rotateY={diceRotation.rotateY}
                rotateZ={diceRotation.rotateZ}
                isDark={isDark}
              />
            </div>
          </button>
        )}

        {/* Portal-rendered dice when dragging/flying - renders outside button to avoid clipping */}
        {/* All transforms are applied directly via ref for performance - no React re-renders */}
        {(isDragging || isFlying) &&
          createPortal(
            <div
              ref={portalDiceRef}
              style={{
                position: "fixed",
                left: diceOrigin.x,
                top: diceOrigin.y,
                // Transform is updated directly via ref during drag/flying
                transform: "translate(0px, 0px)",
                pointerEvents: "none",
                zIndex: 100000,
                cursor: isDragging ? "grabbing" : "default",
                willChange: "transform", // Hint to browser for GPU acceleration
              }}
            >
              {/* During flying, rotation is updated directly on data-dice-cube element */}
              <DiceIcon
                rotateX={diceRotation.rotateX}
                rotateY={diceRotation.rotateY}
                rotateZ={diceRotation.rotateZ}
                isDark={isDark}
              />
            </div>,
            document.body,
          )}

        {/* Dropdown Trigger */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              data-action="open-actions-dropdown"
              disabled={isGenerating}
              className={css({
                px: "2",
                bg: "brand.600",
                color: "white",
                cursor: isGenerating ? "not-allowed" : "pointer",
                opacity: isGenerating ? "0.7" : "1",
                borderLeft: "1px solid",
                borderColor: "brand.700",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
                _hover: isGenerating
                  ? {}
                  : {
                      bg: "brand.700",
                    },
              })}
            >
              <span className={css({ fontSize: "xs" })}>▼</span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className={css({
                bg: "white",
                borderRadius: "lg",
                shadow: "lg",
                border: "1px solid",
                borderColor: "gray.200",
                overflow: "hidden",
                minW: "160px",
                zIndex: 10000,
              })}
            >
              {/* Read-only mode shows Download and Share */}
              {isReadOnly ? (
                <>
                  <DropdownMenu.Item
                    data-action="download-worksheet"
                    onClick={onGenerate}
                    className={css({
                      px: "4",
                      py: "2.5",
                      fontSize: "sm",
                      fontWeight: "medium",
                      color: "gray.700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "2",
                      outline: "none",
                      _hover: {
                        bg: "blue.50",
                        color: "blue.700",
                      },
                      _focus: {
                        bg: "blue.50",
                        color: "blue.700",
                      },
                    })}
                  >
                    <span className={css({ fontSize: "lg" })}>⬇️</span>
                    <span>Download</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    data-action="share-worksheet"
                    asChild
                    className={css({
                      outline: "none",
                    })}
                  >
                    <div
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        w: "full",
                      })}
                    >
                      {/* Main share button - opens QR modal */}
                      <button
                        onClick={onShare}
                        className={css({
                          flex: "1",
                          px: "4",
                          py: "2.5",
                          fontSize: "sm",
                          fontWeight: "medium",
                          color: "gray.700",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "2",
                          outline: "none",
                          bg: "transparent",
                          border: "none",
                          _hover: {
                            bg: "blue.50",
                            color: "blue.700",
                          },
                        })}
                      >
                        <span className={css({ fontSize: "lg" })}>📱</span>
                        <span>Share</span>
                      </button>

                      {/* Copy shortcut */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickShare();
                        }}
                        disabled={isGeneratingShare}
                        className={css({
                          px: "3",
                          py: "2.5",
                          fontSize: "lg",
                          color: justCopied ? "green.700" : "gray.600",
                          cursor: isGeneratingShare ? "wait" : "pointer",
                          bg: justCopied ? "green.50" : "transparent",
                          border: "none",
                          borderLeft: "1px solid",
                          borderColor: "gray.200",
                          outline: "none",
                          opacity: isGeneratingShare ? "0.6" : "1",
                          transition: "all 0.2s",
                          _hover:
                            isGeneratingShare || justCopied
                              ? {}
                              : {
                                  bg: "green.50",
                                  color: "green.700",
                                },
                        })}
                        title={justCopied ? "Copied!" : "Copy share link"}
                      >
                        {isGeneratingShare ? "⏳" : justCopied ? "✓" : "📋"}
                      </button>
                    </div>
                  </DropdownMenu.Item>
                </>
              ) : (
                <>
                  <DropdownMenu.Item
                    data-action="share-worksheet"
                    asChild
                    className={css({
                      outline: "none",
                    })}
                  >
                    <div
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        w: "full",
                      })}
                    >
                      {/* Main share button - opens QR modal */}
                      <button
                        onClick={() => setIsShareModalOpen(true)}
                        className={css({
                          flex: "1",
                          px: "4",
                          py: "2.5",
                          fontSize: "sm",
                          fontWeight: "medium",
                          color: "gray.700",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "2",
                          outline: "none",
                          bg: "transparent",
                          border: "none",
                          _hover: {
                            bg: "blue.50",
                            color: "blue.700",
                          },
                        })}
                      >
                        <span className={css({ fontSize: "lg" })}>📱</span>
                        <span>Share</span>
                      </button>

                      {/* Copy shortcut */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickShare();
                        }}
                        disabled={isGeneratingShare}
                        className={css({
                          px: "3",
                          py: "2.5",
                          fontSize: "lg",
                          color: justCopied ? "green.700" : "gray.600",
                          cursor: isGeneratingShare ? "wait" : "pointer",
                          bg: justCopied ? "green.50" : "transparent",
                          border: "none",
                          borderLeft: "1px solid",
                          borderColor: "gray.200",
                          outline: "none",
                          opacity: isGeneratingShare ? "0.6" : "1",
                          transition: "all 0.2s",
                          _hover:
                            isGeneratingShare || justCopied
                              ? {}
                              : {
                                  bg: "green.50",
                                  color: "green.700",
                                },
                        })}
                        title={justCopied ? "Copied!" : "Copy share link"}
                      >
                        {isGeneratingShare ? "⏳" : justCopied ? "✓" : "📋"}
                      </button>
                    </div>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    data-action="upload-worksheet"
                    onClick={() => setIsUploadModalOpen(true)}
                    className={css({
                      px: "4",
                      py: "2.5",
                      fontSize: "sm",
                      fontWeight: "medium",
                      color: "gray.700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "2",
                      outline: "none",
                      _hover: {
                        bg: "purple.50",
                        color: "purple.700",
                      },
                      _focus: {
                        bg: "purple.50",
                        color: "purple.700",
                      },
                    })}
                  >
                    <span className={css({ fontSize: "lg" })}>⬆️</span>
                    <span>Upload</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    data-action="load-share-code"
                    onClick={() => setIsLoadShareModalOpen(true)}
                    className={css({
                      px: "4",
                      py: "2.5",
                      fontSize: "sm",
                      fontWeight: "medium",
                      color: "gray.700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "2",
                      outline: "none",
                      _hover: {
                        bg: "amber.50",
                        color: "amber.700",
                      },
                      _focus: {
                        bg: "amber.50",
                        color: "amber.700",
                      },
                    })}
                  >
                    <span className={css({ fontSize: "lg" })}>🔗</span>
                    <span>Load Share Code</span>
                  </DropdownMenu.Item>
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Share Modal and Upload Modal (only shown in edit mode) */}
      {!isReadOnly && (
        <>
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            worksheetType="addition"
            config={formState}
            isDark={isDark}
          />

          <UploadWorksheetModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onUploadComplete={handleUploadComplete}
          />

          <LoadShareCodeModal
            isOpen={isLoadShareModalOpen}
            onClose={() => setIsLoadShareModalOpen(false)}
            isDark={isDark}
          />
        </>
      )}

      {/* Floating elements - positioned absolutely relative to preview-center */}
      <WorksheetPreviewProvider formState={formState}>
        {/* Dismissable warning banner */}
        <DuplicateWarningBanner />

        {/* Floating page indicator */}
        {pageData && pageData.totalPages > 1 && (
          <FloatingPageIndicator
            currentPage={pageData.currentPage}
            totalPages={pageData.totalPages}
            onJumpToPage={pageData.jumpToPage}
            isScrolling={isScrolling}
          />
        )}
      </WorksheetPreviewProvider>

      <div
        ref={scrollContainerRef}
        className={css({
          flex: "1",
          w: "full",
          minH: "full",
          h: "full",
          overflow: "auto",
        })}
      >
        <WorksheetPreview
          formState={formState}
          initialData={initialPreview}
          isScrolling={isScrolling}
          onPageDataReady={setPageData}
        />
      </div>
    </div>
  );
}
