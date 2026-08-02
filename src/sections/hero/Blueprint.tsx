import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, FrontSide, PlaneGeometry, type Mesh } from 'three'
import { createBlueprintPainter, createSheetBackTexture, type Outline } from './flatTextures'

export type BlueprintProps = {
  width: number
  length: number
  /** Height above the platform surface. */
  y: number
  /** Push the sheet back from the camera. */
  z: number
  /** Guide outlines, in sheet-local world units. */
  outlines: Outline[]
  /** Seconds before the guides start being drawn on. */
  drawDelay: number
  drawDuration: number
  /** Seconds before the sheet starts unrolling. */
  delay: number
  duration: number
  /** The clock only runs once the scene is actually visible. */
  active: boolean
  /** Written back each frame so the pieces can wait for the sheet. */
  progressRef: { current: number }
}

const SEGMENTS_ALONG = 160
const SEGMENTS_ACROSS = 1

/**
 * How many turns the fully rolled sheet makes. More turns means a tighter,
 * thinner roll — at ~1 turn the roll is as fat as the sheet is long.
 */
const TURNS = 3.6

/**
 * The sheet never fully unrolls: a stub stays curled at the far edge, which is
 * what reads as "a drawing rolled out on the table" rather than a loose plane.
 */
const MAX_UNROLL = 0.88

/**
 * How much of the unroll the intro plays on its own. The rest is the reader's:
 * the sheet rests half rolled and opens as the page is scrolled.
 */
const INTRO_UNROLL = 0.82

/** Scroll distance that spends the remaining unroll, as a fraction of a screen. */
const SCROLL_SPAN = 0.7

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Lenis already smooths `window.scrollY`, so this needs no easing of its own.
 *
 * The span is capped by how far the page can actually scroll: with only the
 * hero and the footer on screen that is a couple of hundred pixels, and a fixed
 * span would leave the sheet stuck half open with no way to finish it.
 */
function scrollFraction() {
  const reachable = document.documentElement.scrollHeight - window.innerHeight
  const span = Math.min(window.innerHeight * SCROLL_SPAN, reachable)
  return span > 0 ? Math.max(0, Math.min(1, window.scrollY / span)) : 0
}

/**
 * A sheet rolled up at its far end that unrolls flat.
 *
 * The flat run keeps its length; everything still rolled wraps around a
 * cylinder whose radius shrinks as the roll is spent, which is what makes it
 * read as paper rather than a bending plane.
 */
export function Blueprint({
  width,
  length,
  y,
  z,
  outlines,
  drawDelay,
  drawDuration,
  delay,
  duration,
  active,
  progressRef,
}: BlueprintProps) {
  const meshRef = useRef<Mesh>(null)
  const elapsed = useRef(0)

  const painter = useMemo(
    () => createBlueprintPainter({ width, length, outlines }),
    [width, length, outlines],
  )
  /** Last painted value, so the texture is only re-uploaded when it changes. */
  const drawn = useRef(-1)
  const backTexture = useMemo(() => createSheetBackTexture(), [])

  const { geometry, base } = useMemo(() => {
    const geo = new PlaneGeometry(width, length, SEGMENTS_ACROSS, SEGMENTS_ALONG)
    // Lay the sheet flat: plane's local +y becomes world -z.
    geo.rotateX(-Math.PI / 2)

    const position = geo.attributes.position
    // Distance of each vertex from the far (fixed) edge, cached once. The sheet
    // is pinned at the far edge and unrolls towards the camera.
    const along = new Float32Array(position.count)
    const across = new Float32Array(position.count)
    for (let i = 0; i < position.count; i += 1) {
      across[i] = position.getX(i)
      along[i] = position.getZ(i) + length / 2
    }
    return { geometry: geo, base: { along, across } }
  }, [width, length])

  useFrame((_, delta) => {
    if (active) elapsed.current += delta
    const t = Math.max(0, Math.min(1, (elapsed.current - delay) / duration))
    const intro = easeInOutCubic(t) * INTRO_UNROLL
    const scrolled = active ? (1 - INTRO_UNROLL) * scrollFraction() : 0
    const norm = Math.min(1, intro + scrolled)
    const p = norm * MAX_UNROLL
    progressRef.current = norm

    // The pen only runs once the paper it draws on is out.
    const draw = Math.max(0, Math.min(1, (elapsed.current - drawDelay) / drawDuration))
    if (draw !== drawn.current) {
      painter.paint(draw)
      drawn.current = draw
    }

    const flat = length * p
    const remaining = length - flat
    const radius = Math.max(remaining / (Math.PI * 2 * TURNS), 0.04)

    const position = geometry.attributes.position
    const farEdge = -length / 2

    for (let i = 0; i < position.count; i += 1) {
      const u = base.along[i]
      if (u <= flat) {
        position.setXYZ(i, base.across[i], 0, farEdge + u)
        continue
      }
      const arc = u - flat
      const theta = arc / radius
      position.setXYZ(
        i,
        base.across[i],
        radius - radius * Math.cos(theta),
        farEdge + flat + radius * Math.sin(theta),
      )
    }
    position.needsUpdate = true
    // The sheet is the one lit surface in the scene, so its normals have to
    // follow the curl — that gradient down the roll is the whole point.
    geometry.computeVertexNormals()
  })

  return (
    <group position={[0, y, z]}>
      {/* Two meshes over one geometry rather than one double-sided material:
          the drawing and the back of the paper are different artwork, and a
          single material can only carry one map. The plane's rotation puts its
          front face up, so BackSide is the underside seen on the curl. */}
      <mesh ref={meshRef} geometry={geometry}>
        {/* Lambert, not basic: everything else in the scene is flat art, but a
            rolled sheet with no shading reads as a printed decal. */}
        <meshLambertMaterial map={painter.texture} side={FrontSide} toneMapped={false} />
      </mesh>
      <mesh geometry={geometry}>
        <meshLambertMaterial map={backTexture} side={BackSide} toneMapped={false} />
      </mesh>
    </group>
  )
}
