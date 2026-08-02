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
 * Light rising off the finished puzzle: a soft column with a few brighter
 * streaks in it, brightest at the foot and gone by the top.
 *
 * Drawn as one texture rather than modelled: the whole scene is flat art in
 * perspective, and a real volumetric would be the only physically simulated
 * thing in it.
 */
export function createRayTexture(): Texture {
  const w = 512
  const h = 512
  const { el, ctx } = canvas2d(w, h)

  const column = ctx.createLinearGradient(0, h, 0, 0)
  column.addColorStop(0, 'rgba(120,215,250,0.5)')
  column.addColorStop(0.3, 'rgba(140,225,255,0.22)')
  column.addColorStop(0.62, 'rgba(160,230,255,0)')
  column.addColorStop(1, 'rgba(160,230,255,0)')
  ctx.fillStyle = column
  ctx.fillRect(0, 0, w, h)

  // The streaks. Uneven widths and heights, or they read as a bar chart.
  // Every streak has to die out inside the column's own falloff — one that
  // runs past it reads as a line drawn on the sky rather than as light.
  const rays = [
    { x: 0.16, width: 0.028, top: 0.32, alpha: 0.4 },
    { x: 0.29, width: 0.014, top: 0.18, alpha: 0.3 },
    { x: 0.44, width: 0.04, top: 0.4, alpha: 0.48 },
    { x: 0.57, width: 0.018, top: 0.24, alpha: 0.34 },
    { x: 0.71, width: 0.03, top: 0.36, alpha: 0.44 },
    { x: 0.85, width: 0.015, top: 0.2, alpha: 0.3 },
  ]
  for (const ray of rays) {
    const streak = ctx.createLinearGradient(0, h, 0, h * (1 - ray.top))
    streak.addColorStop(0, `rgba(206,244,255,${ray.alpha})`)
    streak.addColorStop(1, 'rgba(206,244,255,0)')
    ctx.fillStyle = streak
    ctx.fillRect((ray.x - ray.width / 2) * w, h * (1 - ray.top), ray.width * w, h * ray.top)
  }

  // Fade every edge, or the plane's own border shows up as a straight cut
  // across whatever is behind it — at this camera the foot of the column lands
  // right on the far row of pieces, and that is exactly where it showed.
  ctx.globalCompositeOperation = 'destination-out'

  const sides = ctx.createLinearGradient(0, 0, w, 0)
  sides.addColorStop(0, 'rgba(0,0,0,1)')
  sides.addColorStop(0.2, 'rgba(0,0,0,0)')
  sides.addColorStop(0.8, 'rgba(0,0,0,0)')
  sides.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.fillStyle = sides
  ctx.fillRect(0, 0, w, h)

  const foot = ctx.createLinearGradient(0, h, 0, h * 0.82)
  foot.addColorStop(0, 'rgba(0,0,0,1)')
  foot.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = foot
  ctx.fillRect(0, h * 0.82, w, h * 0.18)

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
export function createSheetBackTexture(from: string, to: string): Texture {
  const { el, ctx } = canvas2d(256, 8)
  const gradient = ctx.createLinearGradient(0, 0, 256, 0)
  gradient.addColorStop(0, from)
  gradient.addColorStop(1, to)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 8)
  return finish(el)
}

/** A closed outline in sheet-local world units, as [x, z] pairs. */
export type Outline = [number, number][]

export type BlueprintPainter = {
  texture: Texture
  /**
   * Redraw with the guides revealed up to `progress` (0..1) and lit by `glow`
   * (0..1) — the plan answering the finished picture.
   */
  paint(progress: number, glow?: number): void
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
  fill,
}: {
  /** Sheet size in world units. */
  width: number
  length: number
  outlines: Outline[]
  /** The sheet's field colour. */
  fill: string
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

  /**
   * The aura that spills out from under the assembled puzzle.
   *
   * Drawn on an offscreen canvas so the halo can be separated from the shape
   * casting it: fill the puzzle's own footprint with a heavy canvas shadow,
   * then punch that footprint back out, and what is left is only the light
   * that escaped past its edges. Composited onto the sheet, that reads as glow
   * leaking from beneath the pieces rather than as a drawn outline.
   */
  const AURA = { blur: 46, alpha: 0.95, passes: 3, color: '236,248,255' }

  /**
   * The assembled block's own silhouette, tabs and notches included. Filling
   * the four outlines together gives their union, which is exactly the edge
   * the light has to escape past — a bounding box instead reads as a frame
   * around the puzzle rather than as light coming from under it.
   */
  const footprint = (() => {
    const shape = new Path2D()
    for (const points of paths) {
      shape.moveTo(points[0][0], points[0][1])
      for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i][0], points[i][1])
      shape.closePath()
    }
    return shape
  })()

  function auraLayer(lit: number) {
    const { el: layer, ctx: aura } = canvas2d(across, along)

    aura.fillStyle = '#000'
    aura.shadowColor = `rgba(${AURA.color},${AURA.alpha * lit})`
    // Stacked passes: one canvas shadow is a thin, even halo. Repeating it at
    // shrinking radii builds a falloff that is bright at the seam and gone a
    // little way out, which is what light escaping a gap actually does.
    for (let i = 0; i < AURA.passes; i += 1) {
      aura.shadowBlur = AURA.blur / (i + 1)
      aura.fill(footprint)
    }

    // Keep the halo, drop the shape that cast it — the pieces sit on top of
    // that area anyway, and filling it would flatten the sheet under them.
    aura.shadowBlur = 0
    aura.globalCompositeOperation = 'destination-out'
    aura.fill(footprint)

    return layer
  }

  function paint(progress: number, glow = 0) {
    const clamped = Math.max(0, Math.min(1, progress))
    const lit = Math.max(0, Math.min(1, glow))

    ctx.fillStyle = fill
    ctx.fillRect(0, 0, across, along)

    // Under the guides: the dashes stay the brightest thing on the sheet.
    if (lit > 0) ctx.drawImage(auraLayer(lit), 0, 0)

    ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.35 * lit})`
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.setLineDash([18, 14])

    // Canvas shadow, not a second wide stroke: it follows the dashes exactly,
    // gaps included, so the guides bloom rather than gaining an outline.
    ctx.shadowColor = `rgba(214,236,255,${0.75 * lit})`
    ctx.shadowBlur = 22 * lit

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

    // Twice while lit: canvas shadows are faint, and the second pass lands the
    // bloom on top of the first without touching the dash geometry.
    ctx.stroke()
    if (lit > 0) ctx.stroke()

    ctx.shadowBlur = 0
    texture.needsUpdate = true
  }

  paint(0)
  return { texture, paint }
}
