import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

/**
 * Flat-shaded look: colour comes from painted textures rather than lighting, so
 * the scene reads as layered 2.5D artwork instead of solid 3D objects.
 */

function canvas2d(width: number, height: number) {
  const el = document.createElement('canvas')
  el.width = width
  el.height = height
  const ctx = el.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  return { el, ctx }
}

/**
 * `anisotropy` matters for any surface seen at a grazing angle: without it the
 * mip chain averages ruled lines into mush as the surface recedes. 16 is the
 * common hardware maximum and three clamps to whatever the GPU reports.
 */
function finish(el: HTMLCanvasElement, anisotropy = 1): Texture {
  const texture = new CanvasTexture(el)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = anisotropy
  return texture
}

/** Soft diagonal gradient, the fill used on every jigsaw piece. */
export function createGradientTexture(from: string, to: string): Texture {
  const { el, ctx } = canvas2d(256, 256)
  const gradient = ctx.createLinearGradient(0, 256, 256, 0)
  gradient.addColorStop(0, from)
  gradient.addColorStop(1, to)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 256)
  return finish(el)
}

/**
 * The platform surface: the vertical gradient with a grid ruled onto it.
 *
 * The canvas is sized to the slab's own proportions and the cell count derived
 * from world units, so the squares stay square instead of stretching with the
 * texture.
 */
export function createPlatformTexture({
  width,
  length,
  cell,
  stops,
  lineColor,
}: {
  width: number
  length: number
  cell: number
  stops: [number, string][]
  lineColor: string
}): Texture {
  const across = 2048
  const along = Math.round((across * length) / width)
  const { el, ctx } = canvas2d(across, along)

  const gradient = ctx.createLinearGradient(0, along, 0, 0)
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, across, along)

  const pxPerUnit = across / width
  const lineWidth = 3
  ctx.fillStyle = lineColor

  // Filled rects on whole pixels rather than strokes: a stroke centred on a
  // fractional coordinate is antialiased across two columns and reads as blur.
  const vertical = (x: number) => {
    const left = Math.round(x - lineWidth / 2)
    if (left + lineWidth < 0 || left > across) return
    ctx.fillRect(left, 0, lineWidth, along)
  }
  const horizontal = (y: number) => {
    const top = Math.round(y - lineWidth / 2)
    if (top + lineWidth < 0 || top > along) return
    ctx.fillRect(0, top, across, lineWidth)
  }

  // Rule from the centre outwards so the grid stays symmetrical on the slab.
  for (let x = across / 2; x <= across + lineWidth; x += cell * pxPerUnit) {
    vertical(x)
    vertical(across - x)
  }
  for (let y = along; y >= -lineWidth; y -= cell * pxPerUnit) {
    horizontal(y)
  }

  return finish(el, 16)
}

/**
 * The back of the blueprint sheet — what shows on the curl of the roll. A
 * horizontal cyan gradient, so the underside reads as a different stock rather
 * than a dimmer copy of the drawing.
 */
export function createSheetBackTexture(): Texture {
  const { el, ctx } = canvas2d(256, 8)
  const gradient = ctx.createLinearGradient(0, 0, 256, 0)
  gradient.addColorStop(0, '#7CF5EE')
  gradient.addColorStop(1, '#4FC3F7')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 8)
  return finish(el)
}

/** A closed outline in sheet-local world units, as [x, z] pairs. */
export type Outline = [number, number][]

export type BlueprintPainter = {
  texture: Texture
  /** Redraw with the guides revealed up to `progress` (0..1). */
  paint(progress: number): void
}

/**
 * The blueprint sheet: a flat blue field with dashed setting-out guides drawn
 * in the jigsaw's own outlines, tabs and notches included — the sheet reads as
 * the plan the pieces are laid out against rather than a generic grid.
 *
 * `paint` walks the outlines as one continuous run and stops partway, so the
 * guides can be drawn on over time like a pen tracing the plan. The texture is
 * only re-uploaded while that is happening; once `paint(1)` lands nothing else
 * touches the canvas.
 */
export function createBlueprintPainter({
  width,
  length,
  outlines,
}: {
  /** Sheet size in world units. */
  width: number
  length: number
  outlines: Outline[]
}): BlueprintPainter {
  const across = 1024
  const along = Math.round((across * length) / width)
  const { el, ctx } = canvas2d(across, along)
  const texture = finish(el, 16)

  // Outlines arrive in world units centred on the sheet. Canvas y = 0 is the
  // far edge: the plane's v = 1 row, which rotateX(-90°) puts at -length/2.
  const toPixels = (outline: Outline) =>
    outline.map<[number, number]>(([x, z]) => [
      ((x + width / 2) / width) * across,
      ((z + length / 2) / length) * along,
    ])

  const paths = outlines.map(toPixels)

  // Segment lengths, cached so `paint` is a walk rather than a re-measure.
  const spans = paths.map((points) => {
    const lengths: number[] = []
    let total = 0
    for (let i = 1; i < points.length; i += 1) {
      const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
      lengths.push(d)
      total += d
    }
    return { lengths, total }
  })
  const grandTotal = spans.reduce((sum, s) => sum + s.total, 0)

  function paint(progress: number) {
    const clamped = Math.max(0, Math.min(1, progress))

    ctx.fillStyle = '#4B86E8'
    ctx.fillRect(0, 0, across, along)

    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.setLineDash([18, 14])

    let budget = grandTotal * clamped
    ctx.beginPath()

    for (let p = 0; p < paths.length && budget > 0; p += 1) {
      const points = paths[p]
      const { lengths } = spans[p]
      ctx.moveTo(points[0][0], points[0][1])

      for (let i = 1; i < points.length; i += 1) {
        const seg = lengths[i - 1]
        if (budget >= seg) {
          ctx.lineTo(points[i][0], points[i][1])
          budget -= seg
          continue
        }
        // Stop mid-segment so the pen tip moves smoothly, not point to point.
        const f = seg > 0 ? budget / seg : 0
        const [ax, ay] = points[i - 1]
        const [bx, by] = points[i]
        ctx.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f)
        budget = 0
        break
      }
    }

    ctx.stroke()
    texture.needsUpdate = true
  }

  paint(0)
  return { texture, paint }
}
