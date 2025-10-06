/**
 * Geographic landmarks for Steam Train Journey
 * Landmarks add visual variety to the landscape based on route themes
 */

export interface Landmark {
  emoji: string
  position: number // 0-100% along track
  offset: { x: number; y: number } // Offset from track position
  size: number // Font size multiplier
}

/**
 * Generate landmarks for a specific route
 * Different route themes have different landmark types
 */
export function generateLandmarks(routeNumber: number): Landmark[] {
  const seed = routeNumber * 456.789

  // Deterministic randomness for landmark placement
  const random = (index: number) => {
    return Math.abs(Math.sin(seed + index * 2.7))
  }

  const landmarks: Landmark[] = []

  // Route theme determines landmark types
  const themeIndex = (routeNumber - 1) % 10

  // Generate 4-6 landmarks along the route
  const landmarkCount = Math.floor(random(0) * 3) + 4

  for (let i = 0; i < landmarkCount; i++) {
    const position = (i + 1) * (100 / (landmarkCount + 1))
    const offsetSide = random(i) > 0.5 ? 1 : -1
    const offsetDistance = 30 + random(i + 10) * 40

    let emoji = '🌳' // Default tree
    let size = 24

    // Choose emoji based on theme and position
    switch (themeIndex) {
      case 0: // Prairie Express
        emoji = random(i) > 0.6 ? '🌾' : '🌻'
        size = 20
        break
      case 1: // Mountain Climb
        emoji = random(i) > 0.5 ? '⛰️' : '🗻'
        size = 32
        break
      case 2: // Coastal Run
        emoji = random(i) > 0.7 ? '🌊' : random(i) > 0.4 ? '🏖️' : '⛵'
        size = 24
        break
      case 3: // Desert Crossing
        emoji = random(i) > 0.6 ? '🌵' : '🏜️'
        size = 28
        break
      case 4: // Forest Trail
        emoji = random(i) > 0.7 ? '🌲' : random(i) > 0.4 ? '🌳' : '🦌'
        size = 26
        break
      case 5: // Canyon Route
        emoji = random(i) > 0.5 ? '🏞️' : '🪨'
        size = 30
        break
      case 6: // River Valley
        emoji = random(i) > 0.6 ? '🌊' : random(i) > 0.3 ? '🌳' : '🦆'
        size = 24
        break
      case 7: // Highland Pass
        emoji = random(i) > 0.6 ? '🗻' : '☁️'
        size = 28
        break
      case 8: // Lakeside Journey
        emoji = random(i) > 0.7 ? '🏞️' : random(i) > 0.4 ? '🌳' : '🦢'
        size = 26
        break
      case 9: // Grand Circuit
        emoji = random(i) > 0.7 ? '🎪' : random(i) > 0.4 ? '🎡' : '🎠'
        size = 28
        break
    }

    // Add bridges at specific positions (around 40-60%)
    if (position > 40 && position < 60 && random(i + 20) > 0.7) {
      emoji = '🌉'
      size = 36
    }

    landmarks.push({
      emoji,
      position,
      offset: {
        x: offsetSide * offsetDistance,
        y: random(i + 5) * 20 - 10
      },
      size
    })
  }

  return landmarks
}