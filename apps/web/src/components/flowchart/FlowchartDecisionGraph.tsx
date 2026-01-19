'use client'

import { useState, useEffect } from 'react'
import useMeasure from 'react-use-measure'
import { css, cx } from '../../../styled-system/css'

interface DecisionOption {
  label: string
  value: string
  /** Label shown on the edge path (e.g., "Yes", "No", "Undo +") */
  pathLabel?: string
  /** Where this option leads (next node title) */
  leadsTo?: string
}

interface FlowchartDecisionGraphProps {
  /** Title of the current decision node */
  nodeTitle: string
  /** Body content of the decision node (the actual question) */
  nodeBody: string[]
  /** The available options */
  options: DecisionOption[]
  /** Called when user selects an option */
  onSelect: (value: string) => void
  /** Wrong answer for shake animation feedback */
  wrongAnswer?: string
  /** Correct answer to highlight */
  correctAnswer?: string
  /** Whether to disable interactions during feedback */
  disabled?: boolean
  /** Whether there's a previous node to connect from */
  hasPreviousNode?: boolean
}

// Layout constants
const BUTTON_WIDTH = 100
const BUTTON_HEIGHT = 36
const BUTTON_GAP = 20
const EDGE_LENGTH = 40
const LABEL_OFFSET_Y = -8
const MIN_DIAMOND_SIZE = 44
const DIAMOND_PADDING = 8 // Padding around text inside diamond
const INCOMING_EDGE_LENGTH = 24 // Length of edge from previous node

/**
 * Flowchart-style decision visualization using pure SVG with foreignObject for buttons.
 * Layout: [Option A] ←─ ◇ ─→ [Option B]
 */
export function FlowchartDecisionGraph({
  nodeTitle,
  nodeBody,
  options,
  onSelect,
  wrongAnswer,
  correctAnswer,
  disabled = false,
  hasPreviousNode = false,
}: FlowchartDecisionGraphProps) {
  const [isShaking, setIsShaking] = useState(false)
  const [measureRef, bounds] = useMeasure()

  // Shake animation on wrong answer
  useEffect(() => {
    if (wrongAnswer) {
      setIsShaking(true)
      const timer = setTimeout(() => setIsShaking(false), 500)
      return () => clearTimeout(timer)
    }
  }, [wrongAnswer])

  const displayLabel = `📍 ${nodeTitle}`

  // Calculate diamond size based on measured text width
  // Text can extend slightly beyond inscribed rectangle, so use 0.9 factor
  const textWidth = bounds.width || displayLabel.length * 7 // Fallback estimate until measured
  const diamondSize = Math.max(MIN_DIAMOND_SIZE, Math.ceil((textWidth + DIAMOND_PADDING) / 0.9))
  const incomingEdgeSpace = hasPreviousNode ? INCOMING_EDGE_LENGTH : 0
  const svgHeight = diamondSize + 20 + incomingEdgeSpace // Vertical padding + incoming edge

  // Calculate SVG width based on number of options
  const totalButtonsWidth = options.length * BUTTON_WIDTH + (options.length - 1) * BUTTON_GAP
  const svgWidth = totalButtonsWidth + diamondSize + EDGE_LENGTH * 2 + 40

  // Center point - offset down if there's an incoming edge
  const centerX = svgWidth / 2
  const centerY = (svgHeight + incomingEdgeSpace) / 2

  // Diamond corners (rotated square)
  const diamondHalf = diamondSize / 2
  const diamondLeft = centerX - diamondHalf
  const diamondRight = centerX + diamondHalf

  // Split options: left half and right half
  const leftOptions = options.slice(0, Math.ceil(options.length / 2))
  const rightOptions = options.slice(Math.ceil(options.length / 2))

  // Calculate button positions
  const getLeftButtonX = (idx: number) => {
    const totalLeft = leftOptions.length * BUTTON_WIDTH + (leftOptions.length - 1) * BUTTON_GAP
    const startX = diamondLeft - EDGE_LENGTH - totalLeft
    return startX + idx * (BUTTON_WIDTH + BUTTON_GAP)
  }

  const getRightButtonX = (idx: number) => {
    const startX = diamondRight + EDGE_LENGTH
    return startX + idx * (BUTTON_WIDTH + BUTTON_GAP)
  }

  const buttonY = centerY - BUTTON_HEIGHT / 2

  return (
    <div
      data-testid="decision-graph"
      data-option-count={options.length}
      className={cx(
        css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2',
          padding: '2',
        }),
        isShaking ? 'shake-animation' : ''
      )}
    >
      {/* Hidden span for measuring text width */}
      <span
        ref={measureRef}
        data-element="measure-span"
        className={css({
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          fontSize: '12px',
          fontWeight: 'bold',
          pointerEvents: 'none',
        })}
      >
        {displayLabel}
      </span>

      {/* Question content from node body */}
      {nodeBody.length > 0 && (
        <div
          data-element="decision-question"
          className={css({
            textAlign: 'center',
            fontSize: 'sm',
            fontWeight: 'medium',
            color: { base: 'gray.700', _dark: 'gray.200' },
            maxWidth: '400px',
          })}
        >
          {nodeBody.map((line, idx) => (
            <p key={idx} data-element="decision-question-line">
              {line}
            </p>
          ))}
        </div>
      )}

      <svg
        data-element="decision-graph-svg"
        data-svg-width={svgWidth}
        data-svg-height={svgHeight}
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className={css({ overflow: 'visible' })}
      >
        {/* Layer 1: Edge lines (bottom layer) */}
        <g data-element="edges-layer">
          {/* Incoming edge from previous node */}
          {hasPreviousNode && (
            <g data-element="incoming-edge-group">
              <line
                data-element="incoming-edge-line"
                x1={centerX}
                y1={0}
                x2={centerX}
                y2={centerY - diamondHalf}
                strokeWidth={2}
                className={css({
                  stroke: { base: '#9ca3af', _dark: '#6b7280' },
                })}
              />
              {/* Arrow pointing down to diamond */}
              <polygon
                data-element="incoming-edge-arrow"
                points={`${centerX - 4},${centerY - diamondHalf - 6} ${centerX + 4},${centerY - diamondHalf - 6} ${centerX},${centerY - diamondHalf}`}
                className={css({
                  fill: { base: '#9ca3af', _dark: '#6b7280' },
                })}
              />
            </g>
          )}

          {/* Left side edges */}
          {leftOptions.map((option, idx) => {
            const buttonX = getLeftButtonX(idx)
            const edgeStartX = buttonX + BUTTON_WIDTH
            const edgeEndX = diamondLeft

            return (
              <g
                key={option.value}
                data-element="left-edge-group"
                data-option-index={idx}
                data-option-value={option.value}
              >
                <line
                  data-element="edge-line"
                  data-edge-side="left"
                  x1={edgeStartX}
                  y1={centerY}
                  x2={edgeEndX}
                  y2={centerY}
                  strokeWidth={2}
                  className={css({
                    stroke: { base: '#9ca3af', _dark: '#6b7280' },
                  })}
                />
                <polygon
                  data-element="edge-arrow"
                  data-arrow-side="left"
                  points={`${edgeStartX + 8},${centerY - 4} ${edgeStartX + 8},${centerY + 4} ${edgeStartX},${centerY}`}
                  className={css({
                    fill: { base: '#9ca3af', _dark: '#6b7280' },
                  })}
                />
                {option.pathLabel && (
                  <text
                    data-element="edge-label"
                    data-label-text={option.pathLabel}
                    x={(edgeStartX + edgeEndX) / 2}
                    y={centerY + LABEL_OFFSET_Y}
                    textAnchor="middle"
                    className={css({
                      fontSize: '11px',
                      fontWeight: 'medium',
                      fill: { base: '#6b7280', _dark: '#9ca3af' },
                    })}
                  >
                    {option.pathLabel}
                  </text>
                )}
              </g>
            )
          })}

          {/* Right side edges */}
          {rightOptions.map((option, idx) => {
            const actualIdx = leftOptions.length + idx
            const buttonX = getRightButtonX(idx)
            const edgeStartX = diamondRight
            const edgeEndX = buttonX

            return (
              <g
                key={option.value}
                data-element="right-edge-group"
                data-option-index={actualIdx}
                data-option-value={option.value}
              >
                <line
                  data-element="edge-line"
                  data-edge-side="right"
                  x1={edgeStartX}
                  y1={centerY}
                  x2={edgeEndX}
                  y2={centerY}
                  strokeWidth={2}
                  className={css({
                    stroke: { base: '#9ca3af', _dark: '#6b7280' },
                  })}
                />
                <polygon
                  data-element="edge-arrow"
                  data-arrow-side="right"
                  points={`${edgeEndX - 8},${centerY - 4} ${edgeEndX - 8},${centerY + 4} ${edgeEndX},${centerY}`}
                  className={css({
                    fill: { base: '#9ca3af', _dark: '#6b7280' },
                  })}
                />
                {option.pathLabel && (
                  <text
                    data-element="edge-label"
                    data-label-text={option.pathLabel}
                    x={(edgeStartX + edgeEndX) / 2}
                    y={centerY + LABEL_OFFSET_Y}
                    textAnchor="middle"
                    className={css({
                      fontSize: '11px',
                      fontWeight: 'medium',
                      fill: { base: '#6b7280', _dark: '#9ca3af' },
                    })}
                  >
                    {option.pathLabel}
                  </text>
                )}
              </g>
            )
          })}
        </g>

        {/* Layer 2: Diamond decision node (middle layer, on top of edges) */}
        <g data-element="diamond-group" transform={`translate(${centerX}, ${centerY})`}>
          <rect
            data-element="diamond-shape"
            x={-diamondHalf}
            y={-diamondHalf}
            width={diamondSize}
            height={diamondSize}
            rx={4}
            transform="rotate(45)"
            className={css({
              fill: { base: '#dbeafe', _dark: '#1e3a5f' },
              stroke: { base: '#3b82f6', _dark: '#60a5fa' },
              strokeWidth: 2,
            })}
          />
          {/* Title label inside diamond using foreignObject */}
          <foreignObject
            data-element="diamond-label-container"
            x={-diamondHalf * 0.7}
            y={-diamondHalf * 0.35}
            width={diamondSize * 0.7}
            height={diamondSize * 0.35}
          >
            <div
              data-element="diamond-label"
              data-node-title={nodeTitle}
              className={css({
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                color: { base: '#1e40af', _dark: '#93c5fd' },
                textAlign: 'center',
                lineHeight: 'tight',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              })}
            >
              {displayLabel}
            </div>
          </foreignObject>
        </g>

        {/* Layer 3: Buttons (top layer, interactive) */}
        <g data-element="buttons-layer">
          {/* Left side buttons */}
          {leftOptions.map((option, idx) => {
            const buttonX = getLeftButtonX(idx)
            const isCorrect = correctAnswer === option.value
            const isWrong = wrongAnswer === option.value

            return (
              <foreignObject
                key={option.value}
                data-element="option-button-container"
                data-option-index={idx}
                data-option-value={option.value}
                x={buttonX}
                y={buttonY}
                width={BUTTON_WIDTH}
                height={BUTTON_HEIGHT}
              >
                <button
                  data-testid={`decision-graph-option-${idx}`}
                  data-element="option-button"
                  data-option-value={option.value}
                  data-option-label={option.label}
                  data-is-correct={isCorrect}
                  data-is-wrong={isWrong}
                  data-side="left"
                  onClick={() => !disabled && onSelect(option.value)}
                  disabled={disabled}
                  className={css({
                    width: '100%',
                    height: '100%',
                    borderRadius: 'lg',
                    border: '2px solid',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    fontSize: 'sm',
                    fontWeight: 'semibold',
                    backgroundColor: isCorrect
                      ? { base: '#dcfce7', _dark: '#166534' }
                      : isWrong
                        ? { base: '#fee2e2', _dark: '#991b1b' }
                        : { base: 'white', _dark: '#374151' },
                    borderColor: isCorrect
                      ? { base: '#22c55e', _dark: '#4ade80' }
                      : isWrong
                        ? { base: '#ef4444', _dark: '#f87171' }
                        : { base: '#93c5fd', _dark: '#3b82f6' },
                    color: isCorrect
                      ? { base: '#166534', _dark: '#bbf7d0' }
                      : isWrong
                        ? { base: '#991b1b', _dark: '#fecaca' }
                        : { base: '#1f2937', _dark: '#e5e7eb' },
                    _hover: disabled
                      ? {}
                      : {
                          borderColor: { base: '#3b82f6', _dark: '#60a5fa' },
                          transform: 'scale(1.02)',
                        },
                  })}
                >
                  {isCorrect && '✓ '}
                  {isWrong && '✗ '}
                  {option.label}
                </button>
              </foreignObject>
            )
          })}

          {/* Right side buttons */}
          {rightOptions.map((option, idx) => {
            const actualIdx = leftOptions.length + idx
            const buttonX = getRightButtonX(idx)
            const isCorrect = correctAnswer === option.value
            const isWrong = wrongAnswer === option.value

            return (
              <foreignObject
                key={option.value}
                data-element="option-button-container"
                data-option-index={actualIdx}
                data-option-value={option.value}
                x={buttonX}
                y={buttonY}
                width={BUTTON_WIDTH}
                height={BUTTON_HEIGHT}
              >
                <button
                  data-testid={`decision-graph-option-${actualIdx}`}
                  data-element="option-button"
                  data-option-value={option.value}
                  data-option-label={option.label}
                  data-is-correct={isCorrect}
                  data-is-wrong={isWrong}
                  data-side="right"
                  onClick={() => !disabled && onSelect(option.value)}
                  disabled={disabled}
                  className={css({
                    width: '100%',
                    height: '100%',
                    borderRadius: 'lg',
                    border: '2px solid',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    fontSize: 'sm',
                    fontWeight: 'semibold',
                    backgroundColor: isCorrect
                      ? { base: '#dcfce7', _dark: '#166534' }
                      : isWrong
                        ? { base: '#fee2e2', _dark: '#991b1b' }
                        : { base: 'white', _dark: '#374151' },
                    borderColor: isCorrect
                      ? { base: '#22c55e', _dark: '#4ade80' }
                      : isWrong
                        ? { base: '#ef4444', _dark: '#f87171' }
                        : { base: '#93c5fd', _dark: '#3b82f6' },
                    color: isCorrect
                      ? { base: '#166534', _dark: '#bbf7d0' }
                      : isWrong
                        ? { base: '#991b1b', _dark: '#fecaca' }
                        : { base: '#1f2937', _dark: '#e5e7eb' },
                    _hover: disabled
                      ? {}
                      : {
                          borderColor: { base: '#3b82f6', _dark: '#60a5fa' },
                          transform: 'scale(1.02)',
                        },
                  })}
                >
                  {isCorrect && '✓ '}
                  {isWrong && '✗ '}
                  {option.label}
                </button>
              </foreignObject>
            )
          })}
        </g>
      </svg>

      {/* Shake animation styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
              20%, 40%, 60%, 80% { transform: translateX(8px); }
            }
            .shake-animation {
              animation: shake 0.5s ease-in-out;
            }
          `,
        }}
      />
    </div>
  )
}
