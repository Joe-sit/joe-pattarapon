import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

/**
 * The mascot's shirt.
 *
 * The drawing's pattern is a retro liquid print: a cream ground with black and
 * orange ribbons curling across it. The thing that makes it read as *that*
 * print rather than as stripes is that the ribbons are short hooks and curls
 * which start and stop — a set of waves running the full width, however wavy,
 * comes out as an animal skin.
 *
 * So the tile is a scatter of individual strokes, each one a curve with round
 * caps, and it is made to tile by drawing the whole set nine times on a 3x3 of
 * offsets: anything that runs off an edge comes back on the opposite one
 * because it is literally drawn there too.
 *
 * Painted at a fixed 512² so the print keeps its resolution however big the
 * shirt gets on screen; how big it appears is the mesh's `repeat`, not this.
 */
const SHIRT = {
  size: 512,
  cream: '#EDE2CF',
  sand: '#D9C9AE',
  ink: '#232224',
  orange: '#CE7839',
}

type Stroke = {
  /** Control points in tile space, 0..1. Drawn as a smoothed polyline. */
  points: [number, number][]
  /** Thickness as a fraction of the tile. */
  width: number
  color: string
}

/**
 * One tile of the print.
 *
 * Two rules hold the look together, and breaking either one is what the first
 * two attempts at this did:
 *
 *  - **No two ribbons the same length or thickness.** A tile of hooks all cut
 *    to one size prints as a field of identical commas, however well they
 *    tile; a tile of equal-thickness waves running the full width prints as an
 *    animal skin. The variety is the pattern.
 *  - **The orange goes in the gaps, not on the black.** Laid over an ink
 *    ribbon on a near-identical path it stops being its own mark and becomes a
 *    stripe down the middle of that one.
 */
const STROKES: Stroke[] = [
  // Long ink ribbons. These carry the flow; everything else fills around them.
  //
  // Thicknesses are held well under what they can take in isolation. Each is
  // drawn again one tile away on every side, so a ribbon that merely looks
  // generous inside the square meets its own copy across the seam, and the
  // cream between them closes up into one black field.
  { points: [[-0.12, 0.24], [0.16, 0.05], [0.44, 0.26], [0.68, 0.13]], width: 0.115, color: SHIRT.ink },
  { points: [[0.04, 0.58], [0.28, 0.72], [0.54, 0.6], [0.8, 0.76], [1.04, 0.64]], width: 0.09, color: SHIRT.ink },
  // Short ones, cut off well before an edge so the field has ends in it.
  { points: [[0.8, 0.28], [0.98, 0.42], [1.14, 0.34]], width: 0.12, color: SHIRT.ink },
  { points: [[0.34, 0.92], [0.58, 1.05], [0.82, 0.95]], width: 0.1, color: SHIRT.ink },
  { points: [[0.16, 0.36], [0.3, 0.44]], width: 0.06, color: SHIRT.ink },

  // Sand, softening the cream where it would otherwise read as a bald patch.
  { points: [[0.54, 0.36], [0.74, 0.46], [0.94, 0.36]], width: 0.06, color: SHIRT.sand },
  { points: [[-0.02, 0.86], [0.12, 0.94], [0.1, 1.08]], width: 0.055, color: SHIRT.sand },
  { points: [[0.62, 0.66], [0.7, 0.54]], width: 0.045, color: SHIRT.sand },

  // Orange, thin and always on cream.
  { points: [[0.5, 0.02], [0.66, 0.34], [0.56, 0.5]], width: 0.045, color: SHIRT.orange },
  { points: [[0.02, 0.44], [0.18, 0.5], [0.16, 0.62]], width: 0.038, color: SHIRT.orange },
  { points: [[0.86, 0.02], [0.94, 0.14], [1.08, 0.16]], width: 0.04, color: SHIRT.orange },
  { points: [[0.3, 0.78], [0.46, 0.84], [0.52, 0.98]], width: 0.042, color: SHIRT.orange },
  { points: [[0.86, 0.86], [1.0, 0.94]], width: 0.05, color: SHIRT.orange },
]

/**
 * Traces the points as a curve rather than as segments — the print has no
 * corners in it anywhere, and a polyline shows every one of its joints at the
 * thicknesses these strokes run at.
 */
function trace(ctx: CanvasRenderingContext2D, pts: [number, number][], s: number, dx: number, dy: number) {
  const p = pts.map(([x, y]) => [(x + dx) * s, (y + dy) * s] as [number, number])
  ctx.beginPath()
  ctx.moveTo(p[0][0], p[0][1])

  if (p.length === 2) {
    ctx.lineTo(p[1][0], p[1][1])
  } else {
    // Midpoint-to-midpoint quadratics: each interior point becomes the control
    // handle for the curve passing between its two neighbours' midpoints.
    for (let i = 1; i < p.length - 1; i += 1) {
      const mx = (p[i][0] + p[i + 1][0]) / 2
      const my = (p[i][1] + p[i + 1][1]) / 2
      ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my)
    }
    ctx.quadraticCurveTo(p[p.length - 2][0], p[p.length - 2][1], p[p.length - 1][0], p[p.length - 1][1])
  }
  ctx.stroke()
}

export function createShirtTexture(): Texture {
  const el = document.createElement('canvas')
  el.width = SHIRT.size
  el.height = SHIRT.size
  const ctx = el.getContext('2d')!
  const s = SHIRT.size

  ctx.fillStyle = SHIRT.cream
  ctx.fillRect(0, 0, s, s)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const stroke of STROKES) {
    ctx.lineWidth = stroke.width * s
    ctx.strokeStyle = stroke.color
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        trace(ctx, stroke.points, s, dx, dy)
      }
    }
  }

  const texture = new CanvasTexture(el)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  return texture
}
