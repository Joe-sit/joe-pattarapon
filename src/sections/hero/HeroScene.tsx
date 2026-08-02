import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  ExtrudeGeometry,
  MathUtils,
  ShapeGeometry,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from 'three'
import { Blueprint } from './Blueprint'
import { createGradientTexture, createPlatformTexture, type Outline } from './flatTextures'
import { puzzlePiece, puzzleSet, type PieceSpec } from './puzzleShape'
import { useIntroDone } from '@/stores/intro'

// ── Scene dimensions ────────────────────────────────────────────────
/**
 * Length is set so the far edge lands inside the frame with sky above it — at
 * this camera the ground runs out of view around z = -13, so a longer slab just
 * disappears off the top instead of ending on a visible cut.
 */
const PLATFORM = { width: 5.6, length: 8, height: 0.16 }
/**
 * The sheet is longer than the drawing it carries: the spare length runs off
 * towards the camera and is what stays curled, so the roll can read as a stub
 * without eating into the guides. `artZ` pulls the drawn area back off centre
 * so it sits where it did before the sheet was lengthened.
 */
const SHEET = { width: 3.9, length: 6.4, z: 0, artZ: -0.4 }
/** Wafer-thin: enough edge to read as a layer, not enough to read as a block. */
const PIECE = { size: 1.4, depth: 0.035, gap: 0.015 }

/** Timing, in seconds from the splash clearing. */
const TIMING = {
  unrollDelay: 0.35,
  unrollDuration: 2.4,
  // The guides are drawn on while the sheet is still unrolling and finish
  // before the first piece lands on them.
  guideDelay: 1.4,
  guideDuration: 1.6,
  /** Measured from the moment the sheet is open, not from the splash. */
  pieceDelay: 0.2,
  pieceStagger: 0.34,
  pieceDuration: 1.15,
}

/** Camera as spherical params — the DEV tuner drives exactly these. */
export type CameraParams = {
  az: number
  el: number
  dist: number
  targetY: number
  fov: number
}

const DEFAULT_CAMERA: CameraParams = {
  az: 0,
  el: 24,
  dist: 14.5,
  targetY: 1.05,
  fov: 15,
}

/**
 * How far the sheet must be open before the pieces start arriving. The intro
 * only unrolls half, so in practice this waits for the reader to scroll.
 */
const PIECE_GATE = 0.92

/** One set, shared: the meshes and the blueprint guides must agree exactly. */
const PIECE_SPECS = puzzleSet(['0', '1', '2', '3'])

/** Slot centre on the sheet, in sheet-local world units. */
function slot(spec: PieceSpec) {
  const step = PIECE.size + PIECE.gap
  return { x: (spec.col - 0.5) * step, z: (spec.row - 0.5) * step + SHEET.artZ }
}

/**
 * The guides drawn on the blueprint: the pieces' own outlines, tabs and all.
 *
 * The shapes live in XY and the meshes get `rotateX(-90°)`, which sends +y to
 * -z — the guides have to follow that or they land mirrored.
 */
function guideOutlines(): Outline[] {
  return PIECE_SPECS.map((spec) => {
    const { x, z } = slot(spec)
    return puzzlePiece(PIECE.size, spec.tabs)
      .getPoints(20)
      .map<[number, number]>((p) => [x + p.x, z - p.y])
  })
}

/** Pastel tints of the brand hues, plus a mint — flat fills, no shading. */
const PIECE_GRADIENTS: [string, string][] = [
  ['#FFFFFF', '#8FE6D6'],
  ['#FFF6C2', '#FFD84D'],
  ['#FFC3D2', '#FF8FA8'],
  ['#EAF7C8', '#B9E06B'],
]

/**
 * Shadow cast onto the blueprint. Light is directly overhead on purpose: any
 * offset towards the camera puts part of the shadow *in front* of the piece at
 * this shallow pitch, and it reads as the shadow punching through.
 */
const SHADOW = { color: '#1B3C6B', opacity: 0.26 }

function easeOutBack(t: number) {
  const c = 1.4
  const p = t - 1
  return 1 + (c + 1) * p * p * p + c * p * p
}

/** Applies the spherical camera params and keeps the lens aimed at the target. */
function CameraRig({ params }: { params: CameraParams }) {
  const camera = useThree((s) => s.camera)

  useFrame(() => {
    const az = MathUtils.degToRad(params.az)
    const el = MathUtils.degToRad(params.el)

    camera.position.set(
      params.dist * Math.cos(el) * Math.sin(az),
      params.targetY + params.dist * Math.sin(el),
      params.dist * Math.cos(el) * Math.cos(az),
    )
    camera.lookAt(0, params.targetY, 0)
    if ('fov' in camera && camera.fov !== params.fov) {
      camera.fov = params.fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}

/** The slab the blueprint rests on, running away from the camera. */
function Platform() {
  // Near edge is the saturated end; it washes out towards the horizon but stays
  // fully opaque, so the slab ends on a clean cut rather than dissolving. The
  // grid is ruled onto this surface, so it belongs to the slab and stops where
  // the slab does.
  const surface = useMemo(
    () =>
      createPlatformTexture({
        width: PLATFORM.width,
        length: PLATFORM.length,
        cell: 0.85,
        lineColor: 'rgba(255,255,255,0.85)',
        stops: [
          [0, '#7EC2F5'],
          [0.5, '#B2DCFA'],
          [1, '#E4F3FF'],
        ],
      }),
    [],
  )

  return (
    <group>
      {/* Slab. Flat fill so it stays a plane of colour, not a lit box. */}
      <mesh position={[0, PLATFORM.height / 2, -PLATFORM.length / 2 + 3.4]}>
        <boxGeometry args={[PLATFORM.width, PLATFORM.height, PLATFORM.length]} />
        <meshBasicMaterial map={surface} toneMapped={false} />
      </mesh>

    </group>
  )
}

type PiecesProps = {
  sheetProgress: { current: number }
  sheetY: number
  /** Kept in step with the sheet, so the pieces land on it wherever it sits. */
  sheetZ: number
  active: boolean
}

/** Four flat pieces drifting down and clicking together on the sheet. */
function JigsawPieces({ sheetProgress, sheetY, sheetZ, active }: PiecesProps) {
  const groupRef = useRef<Group>(null)
  const elapsed = useRef(0)

  const specs = PIECE_SPECS

  const textures = useMemo(
    () => PIECE_GRADIENTS.map(([from, to]) => createGradientTexture(from, to)),
    [],
  )

  const geometries = useMemo(
    () =>
      specs.map((spec) => {
        // No bevel: a bevelled rim catches light and reads as a solid block.
        const geo = new ExtrudeGeometry(puzzlePiece(PIECE.size, spec.tabs), {
          depth: PIECE.depth,
          bevelEnabled: false,
        })
        geo.rotateX(-Math.PI / 2)
        geo.translate(0, PIECE.depth / 2, 0)
        return geo
      }),
    [specs],
  )

  // Shadows use the flat outline, not the extrusion: extruded side walls sit at
  // the same height as the piece and read as a second object stacked on it.
  const shadowGeometries = useMemo(
    () =>
      specs.map((spec) => {
        const geo = new ShapeGeometry(puzzlePiece(PIECE.size, spec.tabs))
        geo.rotateX(-Math.PI / 2)
        return geo
      }),
    [specs],
  )

  const layout = useMemo(() => specs.map(slot), [specs])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    // The clock itself waits for the sheet, so the pieces still fly in properly
    // whenever the scroll finishes the unroll instead of snapping to placed.
    if (active && sheetProgress.current >= PIECE_GATE) elapsed.current += delta

    group.children.forEach((child, i) => {
      const start = TIMING.pieceDelay + i * TIMING.pieceStagger
      const raw = (elapsed.current - start) / TIMING.pieceDuration
      const t = Math.max(0, Math.min(1, raw))
      const e = t <= 0 ? 0 : easeOutBack(t)

      const target = layout[i]
      // Pieces slide in across the sheet plane, so the motion stays 2.5D.
      const driftX = target.x * 2.4
      const driftZ = target.z * 1.6 + 1.1

      // Once settled, a slow drift keeps the composition alive.
      const idle = Math.max(0, elapsed.current - start - TIMING.pieceDuration)
      const bob = Math.sin(idle * 0.7 + i * 1.3) * 0.012 * e

      child.position.set(
        MathUtils.lerp(driftX, target.x, e),
        MathUtils.lerp(sheetY + 0.9, sheetY + 0.012 + i * 0.001, e) + bob,
        MathUtils.lerp(driftZ, target.z, e),
      )
      child.rotation.set(0, MathUtils.lerp(i % 2 === 0 ? 0.35 : -0.35, 0, e), 0)
      child.scale.setScalar(MathUtils.lerp(0.75, 1, Math.min(1, t * 1.6)))
      child.visible = t > 0

      // The shadow stays down on the sheet while the piece rides above it — the
      // gap between the two is what sells the height.
      const shadow = child.children[0] as Mesh
      const height = Math.max(0, child.position.y - sheetY)
      shadow.position.set(0, sheetY + 0.004 - child.position.y, 0)
      // Height reads through spread and fade instead of displacement.
      shadow.scale.setScalar(1 + height * 0.22)
      const material = shadow.material as MeshBasicMaterial
      material.opacity = SHADOW.opacity * Math.max(0, 1 - height * 0.5)
    })
  })

  return (
    <group ref={groupRef} position={[0, 0, sheetZ]}>
      {specs.map((spec, i) => (
        <group key={spec.color} visible={false}>
          <mesh geometry={shadowGeometries[i]} renderOrder={-1}>
            <meshBasicMaterial
              color={SHADOW.color}
              transparent
              opacity={SHADOW.opacity}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh geometry={geometries[i]}>
            <meshBasicMaterial map={textures[i]} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Scene({ params, active }: { params: CameraParams; active: boolean }) {
  const sheetProgress = useRef(0)
  const sheetY = PLATFORM.height + 0.01
  const outlines = useMemo(guideOutlines, [])

  return (
    <>
      <CameraRig params={params} />

      {/* The blueprint is the only lit material; the platform and the pieces
          are painted textures and ignore both of these. Ambient sets the base
          tone, the directional light does the shading on the curl.

          The intensities look high because three no longer uses legacy light
          units: on a Lambert surface these two land the flat part of the sheet
          back at the brightness it had as an unlit basic material. */}
      <ambientLight intensity={1.6} />
      {/* Aimed to match the sun in the sky band: high, and off to the left. */}
      <directionalLight position={[-7, 9, 4]} intensity={2.3} />

      <Platform />
      <Blueprint
        width={SHEET.width}
        length={SHEET.length}
        y={sheetY}
        z={SHEET.z}
        outlines={outlines}
        drawDelay={TIMING.guideDelay}
        drawDuration={TIMING.guideDuration}
        delay={TIMING.unrollDelay}
        duration={TIMING.unrollDuration}
        active={active}
        progressRef={sheetProgress}
      />
      <JigsawPieces
        sheetProgress={sheetProgress}
        sheetY={sheetY}
        sheetZ={SHEET.z}
        active={active}
      />
    </>
  )
}

/** The snippet the copy button hands back, ready to paste over DEFAULT_CAMERA. */
function cameraSnippet(params: CameraParams): string {
  return [
    'const DEFAULT_CAMERA: CameraParams = {',
    `  az: ${params.az},`,
    `  el: ${params.el},`,
    `  dist: ${params.dist},`,
    `  targetY: ${params.targetY},`,
    `  fov: ${params.fov},`,
    '}',
  ].join('\n')
}

/** Sliders for the camera params. Dial by eye, then bake into DEFAULT_CAMERA. */
function CameraTuner({
  params,
  onChange,
}: {
  params: CameraParams
  onChange: (next: CameraParams) => void
}) {
  const [copied, setCopied] = useState(false)

  const fields: { key: keyof CameraParams; min: number; max: number; step: number }[] = [
    { key: 'az', min: -90, max: 90, step: 1 },
    { key: 'el', min: -10, max: 80, step: 1 },
    { key: 'dist', min: 2, max: 20, step: 0.1 },
    { key: 'targetY', min: -2, max: 4, step: 0.05 },
    { key: 'fov', min: 5, max: 90, step: 1 },
  ]

  const copy = async () => {
    await navigator.clipboard.writeText(cameraSnippet(params))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="absolute top-24 right-6 z-50 w-56 rounded-2xl bg-white/90 p-3 text-xs shadow-3xl backdrop-blur">
      <p className="mb-2 font-medium text-ink">Hero camera (dev)</p>
      {fields.map((field) => (
        <label key={field.key} className="mb-2 block">
          <span className="flex justify-between text-ink-muted">
            {field.key}
            <span>{params[field.key]}</span>
          </span>
          <input
            type="range"
            className="w-full"
            min={field.min}
            max={field.max}
            step={field.step}
            value={params[field.key]}
            onChange={(e) => onChange({ ...params, [field.key]: Number(e.target.value) })}
          />
        </label>
      ))}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex-1 rounded-full bg-brand-orange px-3 py-2 font-medium text-white transition-colors hover:bg-brand-orange-dark"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_CAMERA)}
          className="rounded-full px-3 py-2 font-medium text-ink transition hover:bg-black/5"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

/**
 * The landing scene: a platform running into the distance, a blueprint
 * unrolling across it, and four jigsaw pieces assembling on the sheet.
 *
 * Everything is unlit and near-flat on purpose — the look is layered 2.5D
 * artwork placed in perspective, not solid modelled objects.
 */
export function HeroScene() {
  const [params, setParams] = useState(DEFAULT_CAMERA)
  // Hold the sheet rolled and the pieces off-stage until the splash clears —
  // otherwise the whole sequence plays out behind it, unseen.
  const active = useIntroDone()

  return (
    <>
      <Canvas
        // A tight near/far ratio keeps depth precision usable — at near 0.1 the
        // buffer is too coarse at this distance and coplanar surfaces fight.
        camera={{ fov: DEFAULT_CAMERA.fov, near: 2, far: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene params={params} active={active} />
      </Canvas>

      {import.meta.env.DEV && <CameraTuner params={params} onChange={setParams} />}
    </>
  )
}
