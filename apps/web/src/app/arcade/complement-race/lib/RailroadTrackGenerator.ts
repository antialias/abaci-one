/**
 * Railroad Track Generator
 *
 * Generates dynamic curved railroad tracks with proper ballast, ties, and rails.
 * Based on the original Python implementation with SVG path generation.
 */

export interface Waypoint {
  x: number
  y: number
}

export interface TrackElements {
  ballastPath: string
  referencePath: string
  ties: Array<{ x1: number; y1: number; x2: number; y2: number }>
  leftRailPath: string
  rightRailPath: string
}

export class RailroadTrackGenerator {
  private viewWidth: number
  private viewHeight: number

  constructor(viewWidth = 800, viewHeight = 600) {
    this.viewWidth = viewWidth
    this.viewHeight = viewHeight
  }

  /**
   * Generate complete track elements for rendering
   */
  generateTrack(routeNumber: number = 1): TrackElements {
    const waypoints = this.generateTrackWaypoints(routeNumber)
    const pathData = this.generateSmoothPath(waypoints)

    return {
      ballastPath: pathData,
      referencePath: pathData,
      ties: [],
      leftRailPoints: [],
      rightRailPoints: []
    }
  }

  /**
   * Seeded random number generator for deterministic randomness
   */
  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }

  /**
   * Generate waypoints for track with controlled randomness
   * Based on route number for variety across different routes
   */
  private generateTrackWaypoints(routeNumber: number): Waypoint[] {
    // Base waypoints - tracks span from left tunnel (x=20) to right tunnel (x=780)
    // viewBox is "-50 -50 900 700", so x ranges from -50 to 850
    const baseWaypoints: Waypoint[] = [
      { x: 20, y: 300 },   // Start at left tunnel center
      { x: 120, y: 260 },  // Emerging from left tunnel
      { x: 240, y: 200 },  // Climb into hills
      { x: 380, y: 170 },  // Mountain pass
      { x: 520, y: 220 },  // Descent to valley
      { x: 660, y: 160 },  // Bridge over canyon
      { x: 780, y: 300 }   // Enter right tunnel center
    ]

    // Add deterministic randomness based on route number (but keep start/end fixed)
    return baseWaypoints.map((point, index) => {
      if (index === 0 || index === baseWaypoints.length - 1) {
        return point // Keep start/end points fixed
      }

      // Use seeded randomness for consistent track per route
      const seed1 = routeNumber * 12.9898 + index * 78.233
      const seed2 = routeNumber * 43.789 + index * 67.123
      const randomX = (this.seededRandom(seed1) - 0.5) * 60 // ±30 pixels
      const randomY = (this.seededRandom(seed2) - 0.5) * 80 // ±40 pixels

      return {
        x: point.x + randomX,
        y: point.y + randomY
      }
    })
  }

  /**
   * Generate smooth cubic bezier curves through waypoints
   */
  private generateSmoothPath(waypoints: Waypoint[]): string {
    if (waypoints.length < 2) return ''

    let pathData = `M ${waypoints[0].x} ${waypoints[0].y}`

    for (let i = 1; i < waypoints.length; i++) {
      const current = waypoints[i]
      const previous = waypoints[i - 1]

      // Calculate control points for smooth curves
      const dx = current.x - previous.x
      const dy = current.y - previous.y

      const cp1x = previous.x + dx * 0.3
      const cp1y = previous.y + dy * 0.2
      const cp2x = current.x - dx * 0.3
      const cp2y = current.y - dy * 0.2

      pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${current.x} ${current.y}`
    }

    return pathData
  }

  /**
   * Generate gentle curves through densely sampled waypoints
   * Uses very gentle control points to avoid wobbles in straight sections
   */
  private generateGentlePath(waypoints: Waypoint[]): string {
    if (waypoints.length < 2) return ''

    let pathData = `M ${waypoints[0].x} ${waypoints[0].y}`

    for (let i = 1; i < waypoints.length; i++) {
      const current = waypoints[i]
      const previous = waypoints[i - 1]

      // Use extremely gentle control points for very dense sampling
      const dx = current.x - previous.x
      const dy = current.y - previous.y

      const cp1x = previous.x + dx * 0.33
      const cp1y = previous.y + dy * 0.33
      const cp2x = current.x - dx * 0.33
      const cp2y = current.y - dy * 0.33

      pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${current.x} ${current.y}`
    }

    return pathData
  }

  /**
   * Generate railroad ties and rails along the path
   * This requires an SVG path element to measure
   */
  generateTiesAndRails(pathElement: SVGPathElement): {
    ties: Array<{ x1: number; y1: number; x2: number; y2: number }>
    leftRailPath: string
    rightRailPath: string
  } {
    const pathLength = pathElement.getTotalLength()
    const tieSpacing = 12 // Distance between ties in pixels
    const gaugeWidth = 15 // Standard gauge (tie extends 15px each side)
    const tieCount = Math.floor(pathLength / tieSpacing)

    const ties: Array<{ x1: number; y1: number; x2: number; y2: number }> = []

    // Generate ties at normal spacing
    for (let i = 0; i < tieCount; i++) {
      const distance = i * tieSpacing
      const point = pathElement.getPointAtLength(distance)

      // Calculate perpendicular angle for tie orientation
      const nextDistance = Math.min(distance + 2, pathLength)
      const nextPoint = pathElement.getPointAtLength(nextDistance)
      const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x)
      const perpAngle = angle + Math.PI / 2

      // Calculate tie end points
      const leftX = point.x + Math.cos(perpAngle) * gaugeWidth
      const leftY = point.y + Math.sin(perpAngle) * gaugeWidth
      const rightX = point.x - Math.cos(perpAngle) * gaugeWidth
      const rightY = point.y - Math.sin(perpAngle) * gaugeWidth

      // Store tie
      ties.push({ x1: leftX, y1: leftY, x2: rightX, y2: rightY })
    }

    // Generate rail paths as smooth curves (not polylines)
    // Sample points along the path and create offset waypoints
    const railSampling = 2 // Sample every 2 pixels for waypoints (very dense sampling for smooth curves)
    const sampleCount = Math.floor(pathLength / railSampling)

    const leftRailWaypoints: Waypoint[] = []
    const rightRailWaypoints: Waypoint[] = []

    for (let i = 0; i <= sampleCount; i++) {
      const distance = Math.min(i * railSampling, pathLength)
      const point = pathElement.getPointAtLength(distance)

      // Calculate perpendicular angle with longer lookahead for smoother curves
      const nextDistance = Math.min(distance + 8, pathLength)
      const nextPoint = pathElement.getPointAtLength(nextDistance)
      const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x)
      const perpAngle = angle + Math.PI / 2

      // Calculate offset positions for rails
      const leftX = point.x + Math.cos(perpAngle) * gaugeWidth
      const leftY = point.y + Math.sin(perpAngle) * gaugeWidth
      const rightX = point.x - Math.cos(perpAngle) * gaugeWidth
      const rightY = point.y - Math.sin(perpAngle) * gaugeWidth

      leftRailWaypoints.push({ x: leftX, y: leftY })
      rightRailWaypoints.push({ x: rightX, y: rightY })
    }

    // Generate smooth curved paths through the rail waypoints with gentle control points
    const leftRailPath = this.generateGentlePath(leftRailWaypoints)
    const rightRailPath = this.generateGentlePath(rightRailWaypoints)

    return { ties, leftRailPath, rightRailPath }
  }

  /**
   * Calculate train position and rotation along path
   */
  getTrainTransform(
    pathElement: SVGPathElement,
    progress: number // 0-100%
  ): { x: number; y: number; rotation: number } {
    const pathLength = pathElement.getTotalLength()
    const targetLength = (progress / 100) * pathLength

    // Get exact point on curved path
    const point = pathElement.getPointAtLength(targetLength)

    // Calculate rotation based on path direction
    const lookAheadDistance = Math.min(5, pathLength - targetLength)
    const nextPoint = pathElement.getPointAtLength(targetLength + lookAheadDistance)

    // Calculate angle between current and next point
    const deltaX = nextPoint.x - point.x
    const deltaY = nextPoint.y - point.y
    const angleRadians = Math.atan2(deltaY, deltaX)
    const angleDegrees = angleRadians * (180 / Math.PI)

    return {
      x: point.x,
      y: point.y,
      rotation: angleDegrees
    }
  }
}