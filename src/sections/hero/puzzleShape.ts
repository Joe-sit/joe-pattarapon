import { Shape } from 'three'

/** -1 notch, 0 flat edge, +1 tab. */
export type Tab = -1 | 0 | 1

export type PieceTabs = {
  top: Tab
  right: Tab
  bottom: Tab
  left: Tab
}

/** Knob radius as a fraction of the piece edge. */
const KNOB = 0.13

/**
 * One jigsaw piece as a closed 2D shape, centred on the origin.
 *
 * Each edge runs straight to 40% of its length, bulges through a semicircle
 * (outward for a tab, inward for a notch), then runs on to the corner.
 */
export function puzzlePiece(size: number, tabs: PieceTabs): Shape {
  const h = size / 2
  const r = size * KNOB
  const shape = new Shape()

  // Start bottom-left, travel counter-clockwise: bottom → right → top → left.
  shape.moveTo(-h, -h)

  // Bottom edge, +x. Outward is -y.
  if (tabs.bottom === 0) {
    shape.lineTo(h, -h)
  } else {
    shape.lineTo(-r, -h)
    // Clockwise from 180° to 0° passes through 90° (up, i.e. a notch).
    shape.absarc(0, -h, r, Math.PI, 0, tabs.bottom > 0)
    shape.lineTo(h, -h)
  }

  // Right edge, +y. Outward is +x.
  if (tabs.right === 0) {
    shape.lineTo(h, h)
  } else {
    shape.lineTo(h, -r)
    shape.absarc(h, 0, r, -Math.PI / 2, Math.PI / 2, tabs.right < 0)
    shape.lineTo(h, h)
  }

  // Top edge, -x. Outward is +y.
  if (tabs.top === 0) {
    shape.lineTo(-h, h)
  } else {
    shape.lineTo(r, h)
    shape.absarc(0, h, r, 0, Math.PI, tabs.top < 0)
    shape.lineTo(-h, h)
  }

  // Left edge, -y. Outward is -x.
  if (tabs.left === 0) {
    shape.lineTo(-h, -h)
  } else {
    shape.lineTo(-h, r)
    shape.absarc(-h, 0, r, Math.PI / 2, -Math.PI / 2, tabs.left > 0)
    shape.lineTo(-h, -h)
  }

  shape.closePath()
  return shape
}

export type PieceSpec = {
  /** Grid slot: column 0/1, row 0/1 (row 0 is the near edge). */
  col: 0 | 1
  row: 0 | 1
  tabs: PieceTabs
  color: string
}

/**
 * A 2x2 set whose seams interlock: one tab per seam, and its complement on the
 * neighbouring piece. Outer edges stay flat.
 */
export function puzzleSet(colors: [string, string, string, string]): PieceSpec[] {
  // Tab direction for each seam, picked so no two neighbours read the same.
  const seamVertical: [Tab, Tab] = [1, -1] // between columns, per row
  const seamHorizontal: [Tab, Tab] = [-1, 1] // between rows, per column

  const specs: PieceSpec[] = []
  let i = 0

  for (const row of [0, 1] as const) {
    for (const col of [0, 1] as const) {
      specs.push({
        col,
        row,
        tabs: {
          left: col === 1 ? (-seamVertical[row] as Tab) : 0,
          right: col === 0 ? seamVertical[row] : 0,
          bottom: row === 1 ? (-seamHorizontal[col] as Tab) : 0,
          top: row === 0 ? seamHorizontal[col] : 0,
        },
        color: colors[i],
      })
      i += 1
    }
  }

  return specs
}
