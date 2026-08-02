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
import { Blueprint, MAX_UNROLL } from './Blueprint'
import {
  createGradientTexture,
  createPlatformTexture,
  createRayTexture,
  type Outline,
} from './flatTextures'
import { puzzlePiece, puzzleSet, type PieceSpec } from './puzzleShape'
import {
  CAMERA,
  EYE_OPEN_AT,
  ORB_RISE_FROM_Y,
  STORY,
  beat,
  easeInOutCubic,
  orbDropY,
  orbRiseY,
  easeOutSine,
  unrollProgress,
  GLOW_LEAD,
  GLOW_RISE,
  panProgress,
  smootherStepD,
} from './story'
import { setPuzzleDone } from '@/stores/heroStory'
import { usePalette } from '@/stores/theme'

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
const SHEET = { width: 3.9, length: 6.4, z: -0.55, artZ: -0.4 }
/** Wafer-thin: enough edge to read as a layer, not enough to read as a block. */
const PIECE = { size: 1.4, depth: 0.035, gap: 0.015 }

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
  el: 20,
  dist: 14.5,
  targetY: CAMERA.restY,
  fov: 15,
}

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

/**
 * Shadow cast onto the blueprint. Light is directly overhead on purpose: any
 * offset towards the camera puts part of the shadow *in front* of the piece at
 * this shallow pitch, and it reads as the shadow punching through.
 */
const SHADOW = {
  opacity: 0.26,
  /**
   * Ground offset per unit of height, taken from the directional light at
   * [-7, 9, 4]: the rays travel (7, -9, -4), so a piece h above the sheet
   * throws its shadow 7/9 h to the right and 4/9 h away from the camera. Away
   * matters — offsetting towards the camera puts the shadow in front of the
   * piece at this pitch and it reads as punching through.
   */
  perHeight: { x: 7 / 9, z: -4 / 9 },
  /** The orbs' own shadows sit on a lit piece, so they read darker. */
  orbOpacity: 0.34,
}

/**
 * Applies the spherical camera params and keeps the lens aimed at the target.
 *
 * The opening move animates `targetY` only. Camera and look-at both hang off
 * it, so they travel together and the lens keeps its pitch — a pedestal move
 * down onto the platform, not a tilt.
 */
function CameraRig({ params, now }: { params: CameraParams; now: { current: number } }) {
  const camera = useThree((s) => s.camera)
  /** Where the sway has got to, chasing the pointer. */
  const sway = useRef({ x: 0, y: 0 })

  useFrame((state, delta) => {
    const targetY = MathUtils.lerp(CAMERA.fromY, params.targetY, panProgress(now.current))

    // Exponential chase rather than the raw pointer: the lens has weight, and
    // it keeps drifting for a moment after the pointer stops. Framerate
    // independent, so it settles the same on any machine.
    const k = 1 - Math.exp(-delta * SWAY.chase)
    sway.current.x += (state.pointer.x - sway.current.x) * k
    sway.current.y += (state.pointer.y - sway.current.y) * k

    // Scaled by the pan: while the camera is still coming down the story owns
    // the frame, and a lens wandering under it reads as two moves at once.
    const hold = panProgress(now.current)
    const az = MathUtils.degToRad(params.az + sway.current.x * SWAY.az * hold)
    const el = MathUtils.degToRad(params.el + sway.current.y * SWAY.el * hold)

    camera.position.set(
      params.dist * Math.cos(el) * Math.sin(az),
      targetY + params.dist * Math.sin(el),
      params.dist * Math.cos(el) * Math.cos(az),
    )
    camera.lookAt(0, targetY, 0)
    if ('fov' in camera && camera.fov !== params.fov) {
      camera.fov = params.fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}

/**
 * How far the lens wanders with the pointer, in degrees at the edge of the
 * frame, and how fast it chases (per second).
 *
 * Small on purpose: enough that the platform's near corners shift against each
 * other and the scene reads as a space rather than a picture, not enough to
 * fight the composition or to swing the horizon.
 */
const SWAY = { az: 2.4, el: 1.2, chase: 3.5 }

/** The slab the blueprint rests on, running away from the camera. */
function Platform() {
  const { scene: colors } = usePalette()

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
        lineColor: colors.grid,
        stops: [
          [0, colors.platform[0]],
          [0.5, colors.platform[1]],
          [1, colors.platform[2]],
        ],
      }),
    [colors],
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

/** Resting height of a placed piece above the sheet. */
const REST_LIFT = 0.012
/** An orb rides on the top face of its piece. */
const RIDER = {
  radius: 0.13,
  /** Tangent reads as embedded, so it hovers a hair over the face. */
  gap: 0.025,
  get y() {
    return PIECE.depth / 2 + this.radius + this.gap
  },
}

/** Which piece the intro orb delivers: the pink one, bottom-left. */
const LEAD_INDEX = 2

/**
 * Bank angle taken from the move's own acceleration, and the ring-out after it
 * lands. `gain` is per unit of acceleration; the clamp keeps a long approach
 * from laying the piece on its side.
 */
const TILT = { gain: 0.045, max: 0.18, settle: 0.025, rate: 14, decay: 5 }

/** Order the remaining pieces are fetched in. */
const FETCH_ORDER = [0, 1, 3]

/**
 * Where each fetched piece comes in from, in sheet-space units, and how high.
 *
 * At this camera the frame runs out around x = ±3.6 at the sheet, so these sit
 * well outside it: the pieces drift in from off screen rather than appearing in
 * mid-air. Each comes from a different side so they do not read as a queue.
 */
const ENTRY: Record<number, { x: number; z: number; y: number }> = {
  0: { x: -6.4, z: -1.1, y: 1.05 },
  1: { x: 6.4, z: -1.6, y: 1.2 },
  3: { x: 6.6, z: 1.8, y: 0.9 },
}

/** Where the intro orb hands over to the puzzle: on top of the lead piece. */
type Ride = { x: number; y: number; z: number; progress: number }

/**
 * The sphere the eye of the splash opens onto, and what it does next.
 *
 * It starts exactly on the camera's opening look-at point — that is what puts
 * it dead centre of the aperture; any offset in x or z drifts it off, and an
 * offset in z drifts it vertically too, because the lens is pitched down.
 *
 * From there it sinks onto the lead piece waiting at the centre of the
 * blueprint and carries it to its slot, then stays put riding it. It is the
 * first of the orbs that bring the puzzle together, and they all stay on.
 */
const ORB = { from: { radius: 0.34 } }

/**
 * The lit surface, shared by the orbs and the jigsaw pieces.
 *
 * Nothing here is animated and nothing is painted on: the sun is already off to
 * the left, and the point is only that the orb answers it.
 *
 * Two returns from the one light, both wide: the matte body carries the shape,
 * and the sheen — a grazing-angle term — opens the terminator out and keeps the
 * shadow side from going to ink. A tighter, glossier surface would put a
 * pinpoint on the orb, which reads as glass and pulls focus from its job of
 * leading the eye down to the platform.
 *
 * No clear coat. It brightened the lit side nicely, but a coat reflects the
 * environment, and there is no environment map here — so at the silhouette,
 * where its Fresnel term takes over from the body underneath, it had nothing to
 * reflect and drew a black rim around every orb.
 */
const LIT_SURFACE = {
  roughness: 0.7,
  metalness: 0,
  sheen: 0.25,
  sheenRoughness: 0.9,
  sheenColor: '#FFFFFF',
  /**
   * A little of the orb's own colour, added flat. The sun is the only light and
   * the ambient behind it is deliberately low, so the shadow half would
   * otherwise fall to a muddy near-black; this keeps it a dark version of the
   * colour instead of a grey one.
   */
  emissiveIntensity: 0.22,
} as const

/**
 * A key light for the orbs alone, on its own layer.
 *
 * The scene's sun is set to the brightness the blueprint wants, and that leaves
 * the orbs reading flat. Three lights only what shares a layer with them, so
 * this one sits on layer 1 with the orbs and nothing else — it can be pushed
 * hard enough to wash the lit side out towards white without touching the sheet.
 *
 * It comes from the same direction as the sun, so the two agree and the orbs
 * still look lit by what is visibly lighting the scene.
 */
type OrbProps = {
  now: { current: number }
  /** Live seat on the lead piece, written by the puzzle each frame. */
  ride: { current: Ride }
}

function FocalOrb({ now, ride }: OrbProps) {
  const meshRef = useRef<Mesh>(null)
  const color = usePalette().scene.orbs[LEAD_INDEX]

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    // The same curve `orbDropY` runs — the camera hangs off that, so anything
    // else here puts the orb off centre in the frame that is following it.
    const e = easeOutSine(beat(now.current, STORY.orbDrop.at, STORY.orbDrop.duration))
    const seat = ride.current
    const scale = RIDER.radius / ORB.from.radius

    // The seat is a live value, so the descent aims at wherever the lead piece
    // is: no hand-tuned landing coordinate to drift out of sync.
    // Before the descent this is the climb up into the middle of the lid; once
    // the descent starts it is a constant, so the two phases join without a
    // seam and without a branch here.
    mesh.position.set(
      MathUtils.lerp(0, seat.x, e),
      MathUtils.lerp(orbRiseY(now.current), seat.y, e),
      MathUtils.lerp(0, seat.z, e),
    )
    mesh.scale.setScalar(MathUtils.lerp(1, scale, e))
  })

  return (
    <mesh
      ref={meshRef}
      position={[0, ORB_RISE_FROM_Y, 0]}
      renderOrder={2}
    >
      <sphereGeometry args={[ORB.from.radius, 48, 32]} />
      {/* Standard, not Lambert: the orbs are the objects meant to read as real
          surfaces, so they need the specular lobe the sun puts on them.
          Transparent only to sort it after the shadow it casts. */}
      <meshPhysicalMaterial
        color={color}
        emissive={color}
        {...LIT_SURFACE}
        toneMapped={false}
        transparent
      />
    </mesh>
  )
}

type PiecesProps = {
  now: { current: number }
  /** Written back each frame: the seat the intro orb rides on. */
  ride: { current: Ride }
  sheetY: number
  /** Kept in step with the sheet, so the pieces land on it wherever it sits. */
  sheetZ: number
}

/**
 * Puts an orb's shadow on the face below it. `height` is the orb's centre above
 * that face: it slides along the light, spreads and fades with distance.
 */
function setOrbShadow(shadow: Mesh, height: number, visible: boolean) {
  const h = Math.max(0, height)
  shadow.position.set(h * SHADOW.perHeight.x, PIECE.depth / 2 + 0.002, h * SHADOW.perHeight.z)
  // A touch wider than the orb, so a crescent of it shows past the silhouette
  // — that edge is what reads as contact.
  shadow.scale.setScalar(1.3 + h * 0.5)
  shadow.visible = visible && h < 1.6
  const material = shadow.material as MeshBasicMaterial
  material.opacity = SHADOW.orbOpacity * Math.max(0, 1 - h * 0.6)
}

/** Four flat pieces, each carried onto the sheet by an orb. */
function JigsawPieces({ now, ride, sheetY, sheetZ }: PiecesProps) {
  const groupRef = useRef<Group>(null)
  const shadowsRef = useRef<Group>(null)

  const specs = PIECE_SPECS
  const { scene: colors } = usePalette()

  const textures = useMemo(
    () => colors.pieces.map(([from, to]) => createGradientTexture(from, to)),
    [colors],
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
  /** Centre of the 2x2 — where the lead piece waits for the orb. */
  const centre = useMemo(() => ({ x: 0, z: SHEET.artZ }), [])

  useFrame(() => {
    const group = groupRef.current
    const shadows = shadowsRef.current
    if (!group || !shadows) return
    const t0 = now.current
    const rest = sheetY + REST_LIFT
    // How far the flat run of the sheet has reached, in the same local z the
    // pieces are laid out in. The sheet is pinned at its far edge.
    const unrolled = unrollProgress(t0) * MAX_UNROLL
    const flatEdge = -SHEET.length / 2 + SHEET.length * unrolled

    group.children.forEach((child, i) => {
      const target = layout[i]
      const lead = i === LEAD_INDEX
      const order = FETCH_ORDER.indexOf(i)
      const start = lead ? STORY.leadMove.at : STORY.others.at + order * STORY.others.stagger
      const duration = lead ? STORY.leadMove.duration : STORY.others.duration

      // Where the move runs from, so the tilt can be worked out from the same
      // numbers that drive the position.
      const entry = ENTRY[i]
      const fromX = lead ? centre.x : entry.x
      const fromZ = lead ? centre.z : entry.z

      const { e, dd } = smootherStepD(beat(t0, start, duration))
      const x = MathUtils.lerp(fromX, target.x, e)
      const z = MathUtils.lerp(fromZ, target.z, e)

      // Momentum: the piece banks into its own acceleration — nose up while it
      // is picking up speed, nose down as it brakes into the slot — then rings
      // out a little once it is down.
      const gain = TILT.gain / (duration * duration)
      const age = Math.max(0, t0 - (start + duration))
      const ring = Math.exp(-age * TILT.decay) * Math.sin(age * TILT.rate) * TILT.settle
      const tiltX = MathUtils.clamp((target.z - fromZ) * dd * gain, -TILT.max, TILT.max) + ring
      const tiltZ = MathUtils.clamp(-(target.x - fromX) * dd * gain, -TILT.max, TILT.max) - ring
      child.rotation.set(tiltX, 0, tiltZ)

      // A tilted piece dips a corner by half its width times the angle. Lifting
      // by that much is what keeps it off the sheet instead of through it.
      const clearance = (PIECE.size / 2) * (Math.abs(tiltX) + Math.abs(tiltZ))

      let y: number
      let shown: boolean

      if (lead) {
        // The lead piece is not delivered — it is already lying on the paper,
        // and the unroll uncovers it. Visible once the flat run has passed its
        // near edge, which is the moment the roll stops covering it.
        y = rest + Math.sin(Math.PI * e) * 0.1
        shown = flatEdge > centre.z + PIECE.size / 2
      } else {
        y = MathUtils.lerp(sheetY + entry.y, rest + i * 0.001, e)
        shown = beat(t0, start, duration) > 0
      }
      y += clearance

      child.position.set(x, y, z)
      child.visible = shown

      // The shadow is a sibling, not a child: as a child it inherited the tilt
      // and stopped lying on the sheet. It tracks the piece along the light
      // instead, and stays flat.
      const shadow = shadows.children[i] as Mesh
      const height = Math.max(0, y - sheetY)
      shadow.position.set(
        x + height * SHADOW.perHeight.x,
        sheetY + 0.004,
        z + height * SHADOW.perHeight.z,
      )
      // Height reads through spread and fade.
      shadow.scale.setScalar(1 + height * 0.22)
      shadow.visible = shown
      const shadowMaterial = shadow.material as MeshBasicMaterial
      shadowMaterial.opacity = SHADOW.opacity * Math.max(0, 1 - height * 0.5)

      // The rider. The lead piece's orb is the one from the intro, which flies
      // itself — this one only reports the seat it should sit in.
      const rider = child.children[1] as Mesh
      if (lead) {
        rider.visible = false
        ride.current.x = x
        ride.current.y = y + RIDER.y
        ride.current.z = sheetZ + z
        ride.current.progress = beat(t0, start, duration)
        // The intro orb is still flying its own descent, so its shadow tracks
        // that height rather than the seated one.
        setOrbShadow(child.children[2] as Mesh, orbDropY(t0) - (y + PIECE.depth / 2), shown)
        return
      }

      // Orbs stay on their pieces once delivered — they are part of the
      // finished picture, not a delivery mechanism that tidies itself away.
      const appear = beat(t0, start - STORY.orbIn, STORY.orbIn)
      rider.scale.setScalar(easeInOutCubic(appear))
      rider.visible = appear > 0

      // The orb's own shadow, on the face it is sitting on. Same light as the
      // piece shadows, so both fall the same way.
      setOrbShadow(child.children[2] as Mesh, RIDER.radius + RIDER.gap, appear > 0)
    })
  })

  return (
    <>
      <group ref={shadowsRef} position={[0, 0, sheetZ]}>
        {specs.map((spec, i) => (
          <mesh key={spec.color} geometry={shadowGeometries[i]} visible={false} renderOrder={-1}>
            <meshBasicMaterial
              color={colors.shadow}
              transparent
              opacity={SHADOW.opacity}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      <group ref={groupRef} position={[0, 0, sheetZ]}>
        {specs.map((spec, i) => (
          <group key={spec.color} visible={false}>
            <mesh geometry={geometries[i]}>
              {/* Lit, not a flat fill: the top face takes the same sun as the
                  orbs riding on it, and the extruded walls fall away from it,
                  so the piece reads as a slab with thickness.

                  Lambert, like the sheet: the lights are balanced so an upward
                  face lands back on the colour it had as an unlit fill, which
                  keeps the artwork's own tints intact. The physical material
                  used on the orbs answers the same lights far brighter and
                  washed the pieces out. */}
              <meshLambertMaterial map={textures[i]} toneMapped={false} />
            </mesh>
            {/* Orbs are marked transparent purely to put them in the sorted
                pass after their own shadows — see the shadow below. */}
            <mesh position={[0, RIDER.y, 0]} visible={false} renderOrder={2}>
              <sphereGeometry args={[RIDER.radius, 32, 24]} />
              <meshPhysicalMaterial
                color={colors.orbs[i]}
                emissive={colors.orbs[i]}
                {...LIT_SURFACE}
                transparent
              />
            </mesh>
            {/* A decal on the piece's own face. Depth testing it against that
                face is hopeless — a couple of millimetres is under the depth
                buffer's resolution out here, so it loses and vanishes. Instead
                it skips the test entirely and relies on draw order: pieces are
                opaque and go first, then this, then the orb above it. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={1}>
              <circleGeometry args={[RIDER.radius, 32]} />
              <meshBasicMaterial
                color={colors.shadow}
                transparent
                opacity={SHADOW.orbOpacity}
                depthTest={false}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
      </group>
    </>
  )
}

/**
 * The clock every part of the scene reads. Runs at a negative priority so it is
 * already up to date when the rest of the frame's callbacks fire.
 *
 * It starts on mount rather than on the splash's cue, at `-EYE_OPEN_AT`, so the
 * orb's climb plays inside the opening lid. Everything else sits at a beat past
 * zero, so nothing else moves during the pre-roll.
 */
function StoryClock({ now }: { now: { current: number } }) {
  useFrame((_, delta) => {
    now.current += delta
    if (now.current >= STORY.title) setPuzzleDone()
  }, -1)

  return null
}

function Scene({ params }: { params: CameraParams }) {
  const now = useRef(-EYE_OPEN_AT)
  const sheetY = PLATFORM.height + 0.01
  /** Seat for the intro orb: starts over the centre, then rides the lead piece. */
  const ride = useRef<Ride>({
    x: 0,
    y: sheetY + REST_LIFT + RIDER.y,
    z: SHEET.z + SHEET.artZ,
    progress: 0,
  })
  const outlines = useMemo(guideOutlines, [])

  return (
    <>
      <StoryClock now={now} />
      <CameraRig params={params} now={now} />

      {/* The blueprint and the orbs are the lit materials; the platform and the
          pieces are painted textures and ignore both of these.

          The intensities look high because three no longer uses legacy light
          units: on a Lambert surface these two land the flat part of the sheet
          back at the brightness it had as an unlit basic material.

          The split between them is what shapes the orbs. Both were once much
          flatter — ambient 1.6 against 2.3 — which lit the sheet the same but
          left a sphere nearly shadeless. These two keep the sheet's total
          (a plane facing up takes 0.745 of the sun) and move the weight onto
          the sun, so the orbs get a real light side and a real dark one. */}
      <ambientLight intensity={0.55} />
      {/* Aimed to match the sun in the sky band: high, and off to the left. */}
      <directionalLight position={[-7, 9, 4]} intensity={3.72} />

      <Platform />
      <FocalOrb now={now} ride={ride} />
      <Blueprint
        width={SHEET.width}
        length={SHEET.length}
        y={sheetY}
        z={SHEET.z}
        outlines={outlines}
        now={now}
      />
      <JigsawPieces
        now={now}
        ride={ride}
        sheetY={sheetY}
        sheetZ={SHEET.z}
      />
      <PuzzleRays now={now} sheetY={sheetY} sheetZ={SHEET.z} />
    </>
  )
}

/**
 * Light rising off the finished puzzle.
 *
 * Two planes crossed at a right angle rather than one: a single billboard is
 * flat from any angle the pointer sway reaches, and the pair reads as a volume
 * standing on the sheet. Additive, so it only ever adds light.
 */
const RAYS = {
  /** Spans the assembled block, with a little spill past its edges. */
  get width() {
    return (PIECE.size * 2 + PIECE.gap) * 1.16
  },
  height: 1.2,
  opacity: 0.75,
  /**
   * Leaned to match the scene's one light: the sun is off to the left, so
   * anything rising off the sheet drifts to the right — the same direction
   * every shadow in the scene is thrown.
   */
  lean: -0.1,
}

function PuzzleRays({ now, sheetY, sheetZ }: { now: { current: number }; sheetY: number; sheetZ: number }) {
  const groupRef = useRef<Group>(null)
  const texture = useMemo(createRayTexture, [])

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const lit = beat(now.current, STORY.title - GLOW_LEAD, GLOW_RISE)
    group.visible = lit > 0.001
    if (!group.visible) return

    for (const child of group.children) {
      const material = (child as Mesh).material as MeshBasicMaterial
      material.opacity = RAYS.opacity * lit
    }
  })

  return (
    <group
      ref={groupRef}
      // Standing on the pieces' top faces, not on the sheet: from the sheet the
      // column runs through the slabs, and its lower half comes out in front of
      // the far row as a hard diagonal across them.
      position={[0, sheetY + PIECE.depth + 0.02, sheetZ + SHEET.artZ]}
      rotation={[0, 0, RAYS.lean]}
      visible={false}
    >
      {[0, Math.PI / 2].map((turn) => (
        <mesh key={turn} rotation={[0, turn, 0]} position={[0, RAYS.height / 2, 0]} renderOrder={3}>
          <planeGeometry args={[RAYS.width, RAYS.height]} />
          {/* Straight alpha, not additive: additive can only brighten, and on
              the light themes the sky behind this is already near white, so
              there was nothing left to add. A tinted haze reads on both. */}
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
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
    <div className="absolute top-24 right-6 z-50 w-56 rounded-2xl bg-panel/95 p-3 text-xs shadow-3xl backdrop-blur">
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
          className="rounded-full px-3 py-2 font-medium text-ink transition hover:bg-ink/10"
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

  return (
    <>
      <Canvas
        // A tight near/far ratio keeps depth precision usable — at near 0.1 the
        // buffer is too coarse at this distance and coplanar surfaces fight.
        camera={{ fov: DEFAULT_CAMERA.fov, near: 2, far: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene params={params} />
      </Canvas>

      {/* Off by default even in dev — it sits over the scene and gets in the way
          of judging it. Turn it on with VITE_HERO_TUNER=1 in .env.local. */}
      {import.meta.env.DEV && import.meta.env.VITE_HERO_TUNER === '1' && (
        <CameraTuner params={params} onChange={setParams} />
      )}
    </>
  )
}
