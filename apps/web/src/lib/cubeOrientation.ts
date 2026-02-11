/**
 * Pure cube orientation state machine for tracking which face is on which side of a die.
 *
 * Standard die convention: opposite faces sum to 7
 *   1 opposite 6, 2 opposite 5, 3 opposite 4
 *
 * Coordinate system (viewer's perspective):
 *   front = face toward viewer (the displayed value)
 *   top   = face pointing up
 *   right = face pointing right
 *   back  = 7 - front, bottom = 7 - top, left = 7 - right
 */

export interface CubeOrientation {
  front: number // face toward viewer (the displayed value)
  top: number // face pointing up
  right: number // face pointing right
}

/**
 * Initial orientations derived from DICE_FACE_ROTATIONS in InteractiveDice.tsx:
 *   Face 1: rotateX=0,   rotateY=0    → front face (front=1)
 *   Face 2: rotateX=0,   rotateY=-90  → right face rotated to front (front=2)
 *   Face 3: rotateX=-90, rotateY=0    → top face rotated to front (front=3)
 *   Face 4: rotateX=90,  rotateY=0    → bottom face rotated to front (front=4)
 *   Face 5: rotateX=0,   rotateY=90   → left face rotated to front (front=5)
 *   Face 6: rotateX=0,   rotateY=180  → back face rotated to front (front=6)
 */
const INITIAL_ORIENTATIONS: Record<number, CubeOrientation> = {
  1: { front: 1, top: 3, right: 2 },
  2: { front: 2, top: 3, right: 6 },
  3: { front: 3, top: 6, right: 2 },
  4: { front: 4, top: 1, right: 2 },
  5: { front: 5, top: 3, right: 1 },
  6: { front: 6, top: 3, right: 5 },
}

/** Get the initial orientation for a given front face value (1-6). */
export function orientationForFace(face: number): CubeOrientation {
  return INITIAL_ORIENTATIONS[face] ?? INITIAL_ORIENTATIONS[1]
}

/** Tip the cube upward (top edge lifts, bottom edge is pivot). */
export function tipUp(o: CubeOrientation): CubeOrientation {
  return { front: o.top, top: 7 - o.front, right: o.right }
}

/** Tip the cube downward (bottom edge lifts, top edge is pivot). */
export function tipDown(o: CubeOrientation): CubeOrientation {
  return { front: 7 - o.top, top: o.front, right: o.right }
}

/** Tip the cube to the right (right edge lifts, left edge is pivot). */
export function tipRight(o: CubeOrientation): CubeOrientation {
  return { front: o.right, top: o.top, right: 7 - o.front }
}

/** Tip the cube to the left (left edge lifts, right edge is pivot). */
export function tipLeft(o: CubeOrientation): CubeOrientation {
  return { front: 7 - o.right, top: o.top, right: o.front }
}

export type TipDirection = 'up' | 'down' | 'left' | 'right'

const TIP_FNS: Record<TipDirection, (o: CubeOrientation) => CubeOrientation> = {
  up: tipUp,
  down: tipDown,
  left: tipLeft,
  right: tipRight,
}

/** Apply a named tip direction to an orientation. */
export function applyTip(o: CubeOrientation, direction: TipDirection): CubeOrientation {
  return TIP_FNS[direction](o)
}

/** Validate that an orientation is consistent (all 6 faces accounted for, opposites sum to 7). */
export function isValidOrientation(o: CubeOrientation): boolean {
  const back = 7 - o.front
  const bottom = 7 - o.top
  const left = 7 - o.right
  const faces = new Set([o.front, back, o.top, bottom, o.right, left])
  if (faces.size !== 6) return false
  for (let i = 1; i <= 6; i++) {
    if (!faces.has(i)) return false
  }
  return true
}
