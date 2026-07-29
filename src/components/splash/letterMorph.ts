import { interpolate, combine } from 'flubber'

/**
 * Every path here is in wordmark space — the same 259x104 coordinate system the
 * splash wordmark is drawn in — so the morph targets line up with the letters
 * they grow out of, and with the 3D solids that take over afterwards.
 */

/** J, exactly as drawn in the wordmark. */
export const J_PATH = 'M0 0H81V43.5C81 65.8675 62.8675 84 40.5 84V84C18.1325 84 0 65.8675 0 43.5V0Z'

/** E's outer silhouette (the front tab and counters are separate and fade). */
export const E_PATH = 'M174 2H232V81H174V65H162V18H174Z'

/** The four `O` petals at their resting transforms. */
const PETALS = [
  { cx: 117.717, cy: 62.9484, rx: 15.1684, ry: 18.4624, rot: 59.365 },
  { cx: 126.342, cy: 20.4592, rx: 15.1684, ry: 18.4624, rot: 59.365 },
  { cx: 99.732, cy: 41.2846, rx: 14.1752, ry: 19.4078, rot: 28.5804 },
  { cx: 144.851, cy: 41.4516, rx: 14.1752, ry: 19.4078, rot: 28.5804 },
]

/** A rotated ellipse as a path — two arcs, with the tilt carried by `A`'s rotation. */
function ellipsePath({
  cx,
  cy,
  rx,
  ry,
  rot,
}: {
  cx: number
  cy: number
  rx: number
  ry: number
  rot: number
}) {
  const rad = (rot * Math.PI) / 180
  const dx = rx * Math.cos(rad)
  const dy = rx * Math.sin(rad)
  const x1 = cx - dx
  const y1 = cy - dy
  const x2 = cx + dx
  const y2 = cy + dy
  return `M${x1} ${y1} A${rx} ${ry} ${rot} 0 1 ${x2} ${y2} A${rx} ${ry} ${rot} 0 1 ${x1} ${y1} Z`
}

export const PETAL_PATHS = PETALS.map(ellipsePath)

// ── Morph targets ───────────────────────────────────────────────────
// Each one is the flat silhouette of the 3D solid that replaces the letter,
// drawn at the same size and place, so the 2D→3D handoff is pixel-aligned.

/** J → triangle. Apex top-centre, base on the letter's baseline. */
export const TRIANGLE = { apexX: 40.5, top: 0, bottom: 84, left: 0, right: 81 }
export const TRIANGLE_PATH = `M${TRIANGLE.apexX} ${TRIANGLE.top} L${TRIANGLE.right} ${TRIANGLE.bottom} L${TRIANGLE.left} ${TRIANGLE.bottom} Z`

/** O → circle, centred on the petal cluster. */
export const CIRCLE = { cx: 122, cy: 42, r: 37.5 }
export const CIRCLE_PATH = `M${CIRCLE.cx - CIRCLE.r} ${CIRCLE.cy} A${CIRCLE.r} ${CIRCLE.r} 0 1 1 ${
  CIRCLE.cx + CIRCLE.r
} ${CIRCLE.cy} A${CIRCLE.r} ${CIRCLE.r} 0 1 1 ${CIRCLE.cx - CIRCLE.r} ${CIRCLE.cy} Z`

/** E → square, spanning the letter including its front tab. */
export const SQUARE = { left: 161, right: 239, top: 2, bottom: 81 }
export const SQUARE_PATH = `M${SQUARE.left} ${SQUARE.top} H${SQUARE.right} V${SQUARE.bottom} H${SQUARE.left} Z`

/** Denser sampling than the default — keeps the curved letters from kinking. */
const OPTS = { maxSegmentLength: 2 }

export type LetterMorphs = {
  j: (t: number) => string
  e: (t: number) => string
  /** All four petals in one path — `single` merges them as they close up. */
  o: (t: number) => string
}

export function buildLetterMorphs(): LetterMorphs {
  return {
    j: interpolate(J_PATH, TRIANGLE_PATH, OPTS),
    e: interpolate(E_PATH, SQUARE_PATH, OPTS),
    o: combine(PETAL_PATHS, CIRCLE_PATH, { ...OPTS, single: true }),
  }
}
