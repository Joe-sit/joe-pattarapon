import { useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { Mesh, MeshStandardMaterial } from 'three'

/**
 * Shared state the GSAP timeline owns.
 * - `reveal` cross-fades the flat SVG silhouettes into these solids.
 * - `spin` ramps the rotation in *after* the handoff, so the swap happens while
 *   both are perfectly aligned and only then does the shape read as 3D.
 */
export type MorphProgress = { reveal: number; spin: number }

/** World-space span the row occupies, used to size the ortho camera. */
const ROW_SPAN = 6.9

/** Fraction of the viewport width the row should fill — matches the open eye. */
const ROW_WIDTH = 0.44

/** Splash stage width, shared with SplashScreen's SVG viewBox. */
const STAGE = 1000

/**
 * Stage units per world unit. Everything below is written in stage units so it
 * matches the SVG morph targets exactly, then converted once.
 */
const STAGE_PER_WORLD = (STAGE * ROW_WIDTH) / ROW_SPAN

const toWorld = (stageUnits: number) => stageUnits / STAGE_PER_WORLD

type ShapeSpec = {
  /** Offset from stage centre. Stage y grows downward; world y grows up. */
  stageX: number
  stageY: number
  color: string
  /** Radians per second on each axis once `spin` reaches 1. */
  spin: [number, number]
}

/**
 * Positions measured through SplashScreen's `WORDMARK_PLACE`
 * (translate 351.075, 440.2 · scale 1.15), so each solid sits exactly where its
 * flat silhouette ended up.
 */
const SPECS: Record<'j' | 'o' | 'e', ShapeSpec> = {
  j: { stageX: -102.35, stageY: -11.5, color: '#FD5000', spin: [0.35, 0.75] },
  o: { stageX: -8.63, stageY: -11.5, color: '#1868DB', spin: [0.5, 0.6] },
  e: { stageX: 81.08, stageY: -12.08, color: '#EF4343', spin: [0.55, 0.7] },
}

/** Silhouette dimensions, in stage units — the flat targets they take over from. */
const SIZES = {
  triangle: { width: 93.15, height: 96.6 },
  circle: { radius: 43.13 },
  square: { width: 89.7, height: 90.85 },
}

/** Keeps the row the same on-screen width regardless of viewport size. */
function OrthoFit() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  const zoom = (size.width * ROW_WIDTH) / ROW_SPAN
  if (camera.zoom !== zoom) {
    camera.zoom = zoom
    camera.updateProjectionMatrix()
  }

  return null
}

type ShapeProps = {
  spec: ShapeSpec
  progress: RefObject<MorphProgress>
  children: React.ReactNode
}

function Shape({ spec, progress, children }: ShapeProps) {
  const ref = useRef<Mesh>(null)

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return

    const { reveal, spin } = progress.current
    const material = mesh.material as MeshStandardMaterial
    material.opacity = reveal
    mesh.visible = reveal > 0

    mesh.rotation.x += delta * spec.spin[0] * spin
    mesh.rotation.y += delta * spec.spin[1] * spin
  })

  return (
    <mesh ref={ref} position={[toWorld(spec.stageX), toWorld(-spec.stageY), 0]} visible={false}>
      {children}
      <meshStandardMaterial
        color={spec.color}
        roughness={0.34}
        metalness={0.06}
        transparent
        opacity={0}
      />
    </mesh>
  )
}

function Scene({ progress }: { progress: RefObject<MorphProgress> }) {
  return (
    <>
      <OrthoFit />
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 5, 4]} intensity={1.7} />
      <directionalLight position={[-4, -2, -3]} intensity={0.35} />

      {/* J → triangle. A smooth cone silhouettes as a clean triangle head-on. */}
      <Shape spec={SPECS.j} progress={progress}>
        <coneGeometry
          args={[toWorld(SIZES.triangle.width) / 2, toWorld(SIZES.triangle.height), 64]}
        />
      </Shape>

      {/* O → sphere */}
      <Shape spec={SPECS.o} progress={progress}>
        <sphereGeometry args={[toWorld(SIZES.circle.radius), 64, 48]} />
      </Shape>

      {/* E → cube */}
      <Shape spec={SPECS.e} progress={progress}>
        <boxGeometry
          args={[
            toWorld(SIZES.square.width),
            toWorld(SIZES.square.height),
            toWorld(SIZES.square.width),
          ]}
        />
      </Shape>
    </>
  )
}

/**
 * The solids the letters resolve into. Rendered as a transparent DOM layer
 * behind the splash SVG, so the eye's mask is what reveals it — no CSS
 * clip-path duplication of the animated aperture.
 *
 * The camera looks straight down -Z so each solid's resting silhouette is
 * exactly the flat shape the SVG morphed into.
 */
export function SplashShapes({ progress }: { progress: RefObject<MorphProgress> }) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 10], near: -50, far: 100 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <Scene progress={progress} />
    </Canvas>
  )
}
