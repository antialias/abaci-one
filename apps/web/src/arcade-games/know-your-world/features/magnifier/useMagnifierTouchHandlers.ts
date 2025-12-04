/**
 * Magnifier Touch Handlers Hook
 *
 * Extracts touch handling logic for the magnifier overlay.
 * Handles:
 * - Single-finger panning (drag to move cursor position)
 * - Two-finger pinch-to-zoom
 * - Tap-to-select (tap on region to select it)
 *
 * This hook MUST be called inside MagnifierProvider and MapGameProvider.
 * It consumes from both contexts to get the state it needs.
 */

'use client'

import { useCallback, useRef } from 'react'

import { findOptimalZoom } from '../../utils/adaptiveZoomSearch'
import { getMagnifierDimensions } from '../../utils/magnifierDimensions'
import { useMapGameContext } from '../game'
import { getRenderedViewport } from '../labels'
import { useMagnifierContext } from './MagnifierContext'
import {
  applyPanDelta,
  calculateTouchMultiplier,
  clampToSvgBounds,
  parseViewBoxDimensions,
} from './panningMath'

// ============================================================================
// Constants
// ============================================================================

const MAX_ZOOM = 50
const SAFE_ZONE_MARGINS = {
  top: 60,
  right: 8,
  bottom: 8,
  left: 8,
}

// ============================================================================
// Types
// ============================================================================

export interface UseMagnifierTouchHandlersOptions {
  /** Callback when cursor position updates (for multiplayer) */
  onCursorUpdate?: (
    position: { x: number; y: number } | null,
    hoveredRegionId: string | null
  ) => void
  /** Current game mode */
  gameMode?: 'cooperative' | 'race' | 'turn-based'
  /** Current player (for turn-based) */
  currentPlayer?: string | null
  /** Local player ID */
  localPlayerId?: string
  /** Check hot/cold feedback */
  checkHotCold?: (params: {
    cursorPosition: { x: number; y: number }
    targetCenter: { x: number; y: number }
    hoveredRegionId: string | null
    cursorSvgPosition: { x: number; y: number }
  }) => void
  /** Whether in takeover state (multiplayer) */
  isInTakeover?: boolean
  /** Display viewBox string */
  displayViewBox: string
  /** Regions found (for filtering zoom calculations) */
  regionsFound: string[]
  /** Ref to hot/cold enabled state */
  hotColdEnabledRef: React.MutableRefObject<boolean>
  /** Cache of largest piece sizes */
  largestPieceSizesRef: React.MutableRefObject<Map<string, { width: number; height: number }>>
  /** Detect regions at cursor position */
  detectRegions: (
    cursorX: number,
    cursorY: number
  ) => {
    regionUnderCursor: string | null
    detectedRegions: Array<{
      id: string
      pixelWidth: number
      pixelHeight: number
      pixelArea: number
      isVerySmall: boolean
      screenSize: number
    }>
    detectedSmallestSize: number
  }
}

export interface UseMagnifierTouchHandlersReturn {
  /** Handle touch start on magnifier */
  handleMagnifierTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void
  /** Handle touch move on magnifier */
  handleMagnifierTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void
  /** Handle touch end on magnifier */
  handleMagnifierTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => void
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMagnifierTouchHandlers(
  options: UseMagnifierTouchHandlersOptions
): UseMagnifierTouchHandlersReturn {
  const {
    onCursorUpdate,
    gameMode,
    currentPlayer,
    localPlayerId,
    checkHotCold,
    isInTakeover = false,
    displayViewBox,
    regionsFound,
    hotColdEnabledRef,
    largestPieceSizesRef,
    detectRegions,
  } = options

  // -------------------------------------------------------------------------
  // Context Consumption
  // -------------------------------------------------------------------------
  const {
    magnifierRef,
    svgRef,
    containerRef,
    cursorPositionRef,
    isMagnifierExpanded,
    setIsMagnifierExpanded,
    getCurrentZoom,
    setTargetZoom,
    zoomSpring,
    interaction,
    parsedViewBox,
  } = useMagnifierContext()

  const {
    mapData,
    currentPrompt,
    celebration,
    handleRegionClickWithCelebration,
    isGiveUpAnimating,
  } = useMapGameContext()
  // Note: hoveredRegion and setHoveredRegion are no longer used from context
  // State machine (interaction.hoveredRegionId) is now authoritative via TOUCH_MOVE dispatch

  // Get isPinching from state machine
  const isPinchingFromMachine = interaction.isPinching

  // -------------------------------------------------------------------------
  // Refs for touch tracking (internal to this hook)
  // -------------------------------------------------------------------------
  const magnifierTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const magnifierDidMoveRef = useRef(false)
  const magnifierTapPositionRef = useRef<{ x: number; y: number } | null>(null)
  const pinchStartDistanceRef = useRef<number | null>(null)
  const pinchStartZoomRef = useRef<number | null>(null)

  // -------------------------------------------------------------------------
  // Helper: Calculate distance between two touch points
  // -------------------------------------------------------------------------
  const getTouchDistance = useCallback((touches: React.TouchList): number => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }, [])

  // -------------------------------------------------------------------------
  // Touch Start Handler
  // -------------------------------------------------------------------------
  const handleMagnifierTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      // Stop propagation to prevent map container from receiving this touch
      e.stopPropagation()

      // Handle two-finger touch (pinch start)
      if (e.touches.length === 2) {
        const distance = getTouchDistance(e.touches)
        pinchStartDistanceRef.current = distance
        pinchStartZoomRef.current = getCurrentZoom()
        // Dispatch to state machine (single source of truth for isPinching)
        interaction.dispatch({ type: 'PINCH_START' })
        setIsMagnifierExpanded(true) // Expand magnifier to fill leftover area during pinch
        // State machine handles dragging state via PINCH_START (transitions to magnifierPinching)
        magnifierTouchStartRef.current = null
        // Note: touchAction: 'none' CSS prevents browser gestures
        return
      }

      // Handle single-finger touch (pan/tap)
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        magnifierTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
        magnifierDidMoveRef.current = false // Reset movement tracking

        // Record tap position relative to magnifier for tap-to-select
        if (magnifierRef.current) {
          const magnifierRect = magnifierRef.current.getBoundingClientRect()
          magnifierTapPositionRef.current = {
            x: touch.clientX - magnifierRect.left,
            y: touch.clientY - magnifierRect.top,
          }
        }

        // State machine handles dragging state via TOUCH_MOVE (transitions to magnifierPanning)
        // Note: touchAction: 'none' CSS prevents scrolling
      }
    },
    [getTouchDistance, getCurrentZoom, interaction, setIsMagnifierExpanded, magnifierRef]
  )

  // -------------------------------------------------------------------------
  // Touch Move Handler
  // -------------------------------------------------------------------------
  const handleMagnifierTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      // Stop propagation to prevent map container from receiving this touch
      e.stopPropagation()

      // Handle two-finger pinch gesture
      if (e.touches.length === 2 && isPinchingFromMachine) {
        const currentDistance = getTouchDistance(e.touches)
        const startDistance = pinchStartDistanceRef.current
        const startZoom = pinchStartZoomRef.current

        if (startDistance && startZoom && currentDistance > 0) {
          // Calculate new zoom based on pinch scale
          const scale = currentDistance / startDistance
          const newZoom = Math.max(1, Math.min(MAX_ZOOM, startZoom * scale))
          setTargetZoom(newZoom)
        }

        // Note: touchAction: 'none' CSS prevents browser zoom gestures
        return
      }

      // Handle single-finger panning
      const touchStart = magnifierTouchStartRef.current
      if (!touchStart || e.touches.length !== 1) return
      if (!cursorPositionRef.current) return
      if (!svgRef.current || !containerRef.current) return

      const touch = e.touches[0]
      const deltaX = touch.clientX - touchStart.x
      const deltaY = touch.clientY - touchStart.y

      // Get container and SVG measurements early (needed for coordinate conversion)
      const containerRect = containerRef.current.getBoundingClientRect()
      const svgRect = svgRef.current.getBoundingClientRect()

      // Convert touch position to container coordinates for state machine
      // (State machine stores touchCenter in container coords, not client coords)
      const touchContainerX = touch.clientX - containerRect.left
      const touchContainerY = touch.clientY - containerRect.top

      // Dispatch TOUCH_MOVE to state machine - this transitions to magnifierPanning phase
      // Note: position must be in container coordinates to match how map panning works
      interaction.dispatch({
        type: 'TOUCH_MOVE',
        position: { x: touchContainerX, y: touchContainerY },
        touchCount: 1,
      })

      // Track if user has moved significantly (more than 5px = definitely a drag, not a tap)
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        magnifierDidMoveRef.current = true
      }

      // Update start position for next move (keep in client coords for delta calculation)
      magnifierTouchStartRef.current = { x: touch.clientX, y: touch.clientY }

      // Parse viewBox and get magnifier dimensions
      const viewBox = parseViewBoxDimensions(displayViewBox)
      const leftoverWidth = containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
      const leftoverHeight = containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom
      const { width: magnifierWidth, height: magnifierHeight } = getMagnifierDimensions(
        leftoverWidth,
        leftoverHeight
      )
      const actualMagnifierWidth = isMagnifierExpanded ? leftoverWidth : magnifierWidth
      const actualMagnifierHeight = isMagnifierExpanded ? leftoverHeight : magnifierHeight
      const currentZoom = getCurrentZoom()

      // Calculate touch multiplier for 1:1 panning using extracted utility
      const { multiplier: touchMultiplier } = calculateTouchMultiplier(
        {
          viewBoxWidth: viewBox.width,
          viewBoxHeight: viewBox.height,
          svgWidth: svgRect.width,
          svgHeight: svgRect.height,
        },
        {
          width: actualMagnifierWidth,
          height: actualMagnifierHeight,
          zoom: currentZoom,
        }
      )

      // Apply pan delta and clamp to SVG bounds
      const svgOffsetX = svgRect.left - containerRect.left
      const svgOffsetY = svgRect.top - containerRect.top
      const newCursor = applyPanDelta(
        cursorPositionRef.current,
        { x: deltaX, y: deltaY },
        touchMultiplier
      )
      const clamped = clampToSvgBounds(newCursor, {
        left: svgOffsetX,
        top: svgOffsetY,
        width: svgRect.width,
        height: svgRect.height,
      })
      const clampedX = clamped.x
      const clampedY = clamped.y

      // Update cursor position ref for synchronous access
      cursorPositionRef.current = clamped

      // Run region detection to get hoveredRegionId and regions for adaptive zoom
      const {
        regionUnderCursor,
        detectedRegions: detectedRegionObjects,
        detectedSmallestSize,
      } = detectRegions(clampedX, clampedY)

      // Dispatch to state machine with clamped position AND regionId
      // This updates both cursor position and hovered region in one dispatch
      interaction.dispatch({
        type: 'TOUCH_MOVE',
        position: clamped,
        touchCount: 1,
        regionId: regionUnderCursor,
      })
      // hoveredRegion is now derived from state machine (interaction.hoveredRegionId)

      // Hot/cold feedback for magnifier panning
      if (hotColdEnabledRef.current && currentPrompt && !isGiveUpAnimating && !isInTakeover) {
        const targetRegion = mapData.regions.find((r) => r.id === currentPrompt)
        if (targetRegion && checkHotCold) {
          const { x: viewBoxX, y: viewBoxY, width: viewBoxW, height: viewBoxH } = parsedViewBox
          const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxW, viewBoxH)
          const svgOffsetXWithLetterbox = svgRect.left - containerRect.left + viewport.letterboxX
          const svgOffsetYWithLetterbox = svgRect.top - containerRect.top + viewport.letterboxY
          const targetPixelX =
            (targetRegion.center[0] - viewBoxX) * viewport.scale + svgOffsetXWithLetterbox
          const targetPixelY =
            (targetRegion.center[1] - viewBoxY) * viewport.scale + svgOffsetYWithLetterbox
          const cursorSvgX = (clampedX - svgOffsetXWithLetterbox) / viewport.scale + viewBoxX
          const cursorSvgY = (clampedY - svgOffsetYWithLetterbox) / viewport.scale + viewBoxY

          checkHotCold({
            cursorPosition: { x: clampedX, y: clampedY },
            targetCenter: { x: targetPixelX, y: targetPixelY },
            hoveredRegionId: regionUnderCursor,
            cursorSvgPosition: { x: cursorSvgX, y: cursorSvgY },
          })
        }
      }

      // Auto-zoom based on regions at cursor position (same as map drag behavior)
      // Filter out found regions from zoom calculations
      const unfoundRegionObjects = detectedRegionObjects.filter((r) => !regionsFound.includes(r.id))

      // Calculate optimal zoom for the new cursor position
      const zoomSearchResult = findOptimalZoom({
        detectedRegions: unfoundRegionObjects,
        detectedSmallestSize,
        cursorX: clampedX,
        cursorY: clampedY,
        containerRect,
        svgRect,
        mapData,
        svgElement: svgRef.current,
        largestPieceSizesCache: largestPieceSizesRef.current,
        maxZoom: MAX_ZOOM,
        minZoom: 1,
        pointerLocked: false, // Mobile never uses pointer lock
      })

      setTargetZoom(zoomSearchResult.zoom)

      // Broadcast cursor update to other players (if in multiplayer)
      if (
        onCursorUpdate &&
        (gameMode !== 'turn-based' || currentPlayer === localPlayerId) &&
        containerRef.current &&
        svgRef.current
      ) {
        const { x: viewBoxX, y: viewBoxY, width: viewBoxW, height: viewBoxH } = parsedViewBox
        const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxW, viewBoxH)
        const svgOffsetXWithLetterbox = svgRect.left - containerRect.left + viewport.letterboxX
        const svgOffsetYWithLetterbox = svgRect.top - containerRect.top + viewport.letterboxY
        const cursorSvgX = (clampedX - svgOffsetXWithLetterbox) / viewport.scale + viewBoxX
        const cursorSvgY = (clampedY - svgOffsetYWithLetterbox) / viewport.scale + viewBoxY
        onCursorUpdate({ x: cursorSvgX, y: cursorSvgY }, regionUnderCursor)
      }

      // Note: No preventDefault() needed here - the container has touchAction: 'none' CSS
      // which prevents scrolling without triggering passive event listener warnings
    },
    [
      isPinchingFromMachine,
      isMagnifierExpanded,
      getTouchDistance,
      setTargetZoom,
      detectRegions,
      onCursorUpdate,
      gameMode,
      currentPlayer,
      localPlayerId,
      displayViewBox,
      getCurrentZoom,
      regionsFound,
      mapData,
      currentPrompt,
      isGiveUpAnimating,
      isInTakeover,
      checkHotCold,
      svgRef,
      containerRef,
      cursorPositionRef,
      // Note: hoveredRegion and setHoveredRegion removed - state machine is authoritative
      hotColdEnabledRef,
      largestPieceSizesRef,
      parsedViewBox,
    ]
  )

  // -------------------------------------------------------------------------
  // Touch End Handler
  // -------------------------------------------------------------------------
  const handleMagnifierTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const currentPhase = interaction.state.mode === 'mobile' ? interaction.state.phase : 'N/A'
      console.log('[handleMagnifierTouchEnd] Called', {
        currentPhase,
        isPinchingFromMachine,
        touchesLength: e.touches.length,
        changedTouchesLength: e.changedTouches.length,
        didMove: magnifierDidMoveRef.current,
      })
      // Always stop propagation to prevent map container from receiving touch end
      // (which would trigger dismissMagnifier via handleMapTouchEnd)
      e.stopPropagation()

      // Reset pinch state
      if (isPinchingFromMachine) {
        // Dispatch to state machine (single source of truth for isPinching)
        interaction.dispatch({ type: 'PINCH_END' })
        pinchStartDistanceRef.current = null
        pinchStartZoomRef.current = null
        // If still have one finger down, don't reset drag state - they might continue panning
        if (e.touches.length === 1) {
          // User lifted one finger but still has one down - start panning
          const touch = e.touches[0]
          magnifierTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
          // State machine will transition to magnifierPanning on TOUCH_MOVE
        }
        return
      }

      // Check if this was a tap (no significant movement) vs a drag
      // If the user just tapped on the magnifier, select the region at the tap position
      const didMove = magnifierDidMoveRef.current
      const tapPosition = magnifierTapPositionRef.current

      // Dispatch TOUCH_END to state machine - this transitions from magnifierPanning back to magnifierActive
      interaction.dispatch({
        type: 'TOUCH_END',
        touchCount: e.touches.length, // Number of fingers still touching
      })
      console.log('[handleMagnifierTouchEnd] After dispatch, new phase:',
        interaction.state.mode === 'mobile' ? interaction.state.phase : 'N/A')

      // State machine is authoritative for dragging state (magnifierPanning phase)
      magnifierTouchStartRef.current = null
      magnifierDidMoveRef.current = false
      magnifierTapPositionRef.current = null

      // If there was a changed touch that ended and it wasn't a drag, check for tap-to-select
      if (e.changedTouches.length === 1 && !didMove && tapPosition) {
        // Convert tap position on magnifier to SVG coordinates
        if (
          magnifierRef.current &&
          svgRef.current &&
          containerRef.current &&
          cursorPositionRef.current
        ) {
          const magnifierRect = magnifierRef.current.getBoundingClientRect()
          const containerRect = containerRef.current.getBoundingClientRect()
          const svgRect = svgRef.current.getBoundingClientRect()

          // Get the current zoom level
          const currentZoom = zoomSpring.get()

          // Parse the main map viewBox
          const { x: viewBoxX, y: viewBoxY, width: viewBoxW, height: viewBoxH } = parsedViewBox

          // Get viewport info for coordinate conversion
          const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxW, viewBoxH)
          const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
          const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY

          // Current cursor position in SVG coordinates (center of magnifier view)
          const cursorSvgX = (cursorPositionRef.current.x - svgOffsetX) / viewport.scale + viewBoxX
          const cursorSvgY = (cursorPositionRef.current.y - svgOffsetY) / viewport.scale + viewBoxY

          // Magnifier viewBox dimensions
          const magnifiedWidth = viewBoxW / currentZoom
          const magnifiedHeight = viewBoxH / currentZoom

          // Convert tap position (relative to magnifier) to SVG coordinates
          // Tap at (0,0) is top-left of magnifier = cursorSvg - magnifiedSize/2
          // Tap at (magnifierWidth, magnifierHeight) is bottom-right = cursorSvg + magnifiedSize/2
          const tapSvgX =
            cursorSvgX - magnifiedWidth / 2 + (tapPosition.x / magnifierRect.width) * magnifiedWidth
          const tapSvgY =
            cursorSvgY -
            magnifiedHeight / 2 +
            (tapPosition.y / magnifierRect.height) * magnifiedHeight

          // Convert SVG coordinates back to container coordinates for region detection
          const tapContainerX = (tapSvgX - viewBoxX) * viewport.scale + svgOffsetX
          const tapContainerY = (tapSvgY - viewBoxY) * viewport.scale + svgOffsetY

          // Run region detection at the tap position
          const { regionUnderCursor } = detectRegions(tapContainerX, tapContainerY)

          if (regionUnderCursor && !celebration) {
            const region = mapData.regions.find((r) => r.id === regionUnderCursor)
            if (region) {
              handleRegionClickWithCelebration(regionUnderCursor, region.name)
            }
          }
        }
      }
    },
    [
      isPinchingFromMachine,
      interaction,
      detectRegions,
      mapData.regions,
      handleRegionClickWithCelebration,
      celebration,
      zoomSpring,
      magnifierRef,
      svgRef,
      containerRef,
      cursorPositionRef,
      parsedViewBox,
    ]
  )

  return {
    handleMagnifierTouchStart,
    handleMagnifierTouchMove,
    handleMagnifierTouchEnd,
  }
}
