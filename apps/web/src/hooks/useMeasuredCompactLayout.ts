import {
  type MutableRefObject,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

export interface CompactItem {
  id: string
  element: ReactNode
}

export interface UseMeasuredCompactLayoutResult {
  /** Ref to attach to the container element (for measuring available width) */
  containerRef: MutableRefObject<HTMLDivElement | null>
  /** Ref map for individual items - used internally by MeasurementContainer */
  itemRefs: MutableRefObject<Map<string, HTMLDivElement>>
  /** Items grouped into rows based on measured fit */
  rows: CompactItem[][]
  /** Whether measurements are complete and rows are ready */
  isReady: boolean
}

/**
 * Groups items into rows based on actual measured widths.
 *
 * Uses useLayoutEffect to measure before paint, so there's no flash of wrong layout.
 *
 * @param items - Items to measure and group
 * @param gap - Gap between items in pixels
 * @returns Object with containerRef, itemRefs, grouped rows, and ready state
 *
 * @example
 * ```tsx
 * const { containerRef, itemRefs, rows, isReady } = useMeasuredCompactLayout(items, 12)
 *
 * return (
 *   <div ref={containerRef} style={{ position: 'relative' }}>
 *     <MeasurementContainer items={items} itemRefs={itemRefs} />
 *     {isReady && rows.map((row, i) => (
 *       <div key={i} style={{ display: 'flex', gap: 12 }}>
 *         {row.map(item => <Fragment key={item.id}>{item.element}</Fragment>)}
 *       </div>
 *     ))}
 *   </div>
 * )
 * ```
 */
export function useMeasuredCompactLayout(
  items: CompactItem[],
  gap: number
): UseMeasuredCompactLayoutResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const [rows, setRows] = useState<CompactItem[][]>([])
  const [isReady, setIsReady] = useState(false)
  const [measurementTrigger, setMeasurementTrigger] = useState(0)

  // Create a stable items key for dependency tracking
  const itemsKey = items.map((item) => item.id).join(',')

  // Measure and group - runs synchronously before paint
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    if (items.length === 0) {
      setRows([])
      setIsReady(true)
      return
    }

    const containerWidth = container.getBoundingClientRect().width

    // Measure each item
    const measurements: { item: CompactItem; width: number }[] = []
    for (const item of items) {
      const el = itemRefs.current.get(item.id)
      if (el) {
        measurements.push({
          item,
          width: el.getBoundingClientRect().width,
        })
      }
    }

    // Group items that fit together
    const grouped = groupByFit(measurements, containerWidth, gap)
    setRows(grouped)
    setIsReady(true)
  }, [itemsKey, gap, measurementTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-measure on container resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      // Trigger re-measurement
      setMeasurementTrigger((t) => t + 1)
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return {
    containerRef,
    itemRefs,
    rows,
    isReady,
  }
}

/**
 * Groups items into rows based on whether they fit within the container width.
 */
function groupByFit(
  measurements: { item: CompactItem; width: number }[],
  containerWidth: number,
  gap: number
): CompactItem[][] {
  if (containerWidth <= 0) {
    // If container has no width, put each item in its own row
    return measurements.map(({ item }) => [item])
  }

  const rows: CompactItem[][] = []
  let currentRow: CompactItem[] = []
  let currentWidth = 0

  for (const { item, width } of measurements) {
    const widthNeeded = currentRow.length > 0 ? width + gap : width

    if (currentWidth + widthNeeded <= containerWidth) {
      currentRow.push(item)
      currentWidth += widthNeeded
    } else {
      if (currentRow.length > 0) {
        rows.push(currentRow)
      }
      currentRow = [item]
      currentWidth = width
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow)
  }

  return rows
}
