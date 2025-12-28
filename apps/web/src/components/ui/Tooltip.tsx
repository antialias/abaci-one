'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { css, cx } from '../../../styled-system/css'

export interface TooltipProps {
  /** The element that triggers the tooltip */
  children: ReactNode
  /** The tooltip content - can be a string or rich JSX */
  content: ReactNode
  /** Side of the trigger to render the tooltip */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Alignment relative to the trigger */
  align?: 'start' | 'center' | 'end'
  /** Delay before showing (ms) */
  delayDuration?: number
  /** Additional class name for the content */
  contentClassName?: string
  /** Whether the tooltip is open (controlled mode) */
  open?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
}

const contentStyles = css({
  // Must be above modals (10001) so tooltips inside modals are visible
  zIndex: 15000,
  overflow: 'hidden',
  borderRadius: '8px',
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  lineHeight: '1.4',
  maxWidth: '320px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
  backgroundColor: 'gray.900',
  color: 'gray.100',
  // Animation
  animationDuration: '200ms',
  animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
  willChange: 'transform, opacity',
  '&[data-state="delayed-open"]': {
    '&[data-side="top"]': { animationName: 'slideDownAndFade' },
    '&[data-side="right"]': { animationName: 'slideLeftAndFade' },
    '&[data-side="bottom"]': { animationName: 'slideUpAndFade' },
    '&[data-side="left"]': { animationName: 'slideRightAndFade' },
  },
})

const arrowStyles = css({
  fill: 'gray.900',
})

/**
 * Tooltip component using Radix UI primitives
 *
 * Usage:
 * ```tsx
 * <Tooltip content="This is a tooltip">
 *   <button>Hover me</button>
 * </Tooltip>
 *
 * // Rich content
 * <Tooltip content={<div><strong>Title</strong><p>Description</p></div>}>
 *   <span>Info</span>
 * </Tooltip>
 * ```
 */
export function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  delayDuration = 200,
  contentClassName,
  open,
  onOpenChange,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root delayDuration={delayDuration} open={open} onOpenChange={onOpenChange}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={6}
            className={cx(contentStyles, contentClassName)}
          >
            {content}
            <TooltipPrimitive.Arrow className={arrowStyles} width={12} height={6} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

/**
 * Provider that enables tooltips for all children
 * Wrap your app or a section with this to enable tooltips
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider>{children}</TooltipPrimitive.Provider>
}

// Re-export primitives for advanced use cases
export { TooltipPrimitive }
