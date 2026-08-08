import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import { Mascot } from './Mascot'
import { DebugOverlay, PartPicker, useMascotDebug } from './MascotDebug'

/**
 * Square to the lens. The body does not turn any more — only the head does, so
 * the pose it rests in has to be the one the head turns *away* from and back
 * to, and that is dead front.
 */
const POSE = { yaw: 0, pitch: 0 }

/**
 * How far the pointer can turn the head, and how fast it gets there.
 *
 * Yaw runs wider than pitch on purpose, and by a lot. A head that nods as far
 * as it swivels reads as a puppet on a stick — but the harder limit is
 * geometric: pitch swings the jaw *down*, and the shirt has to be dropped clear
 * of wherever it can reach, which shows as neck under the chin. See TORSO.top,
 * which is derived from these two numbers and has to be redone if they change.
 */
const FOLLOW = { yaw: 0.5, pitch: 0.1, chase: 3.2 }

/** A slow breath, so he is never completely still. */
const IDLE = { rise: 0.03, speed: 0.9 }

/** Where the figure stands. Everything about the shot is measured off this. */
const FRAME_Y = 0.95

/**
 * He fills the shot and runs off the bottom of it, head high, body cut by the
 * frame rather than by any hem.
 *
 * The numbers are read off a reference shot and converted, not guessed:
 *
 *     hair to chin   51% of the frame height  ->  frame 2.76 tall  ->  dist 6.0
 *     top of hair    18% down from the top    ->  aim 0.89
 *
 * `targetY` lands within a whisker of the head's own centre, which is what a
 * shot composed this way always comes to: the head sits in the middle of the
 * picture and everything below it is allowed to leave. The frame bottom falls
 * at -0.49, mid-shirt, so the hem at -1.29 never comes into it — the shirt has
 * a real bottom edge now, and this is what keeps it out of shot.
 *
 * `elevation` is back up because the aim no longer supplies any tilt of its
 * own. It exists to keep the tops of the blocks in shot — the slab of hair, the
 * shoulders — since a lens level with the figure sees none of them and catches
 * the underside of the hair instead.
 */
const VIEW = { elevation: 0.1, dist: 10.5, targetY: FRAME_Y - 0.7 }

/**
 * Pulled back off the hero framing while the arms are being built, so the fold
 * and the hands are actually in shot to be judged.
 *
 * The hero framing is `{ elevation: 0.1, dist: 6, targetY: FRAME_Y - 0.06 }` —
 * the one matched to the reference, head high and the body running off the
 * bottom. At that distance the folded arms sit on the crop line and the hands
 * are cut, which is a composition decision still to make: the reference has no
 * arms in shot at all, and this figure's arms are the part holding the cup.
 */

function Lens() {
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    camera.position.set(
      0,
      VIEW.targetY + VIEW.dist * Math.sin(VIEW.elevation),
      VIEW.dist * Math.cos(VIEW.elevation),
    )
    camera.lookAt(0, VIEW.targetY, 0)
  }, [camera])

  return null
}

function Rig({ frozen }: { frozen: boolean }) {
  const body = useRef<Group>(null)
  const head = useRef<Group>(null)
  const aim = useRef({ x: 0, y: 0 })

  useFrame((state, delta) => {
    // Frame-rate independent chase: a plain lerp by a constant would track
    // faster on a 120Hz screen than on a 60Hz one.
    // Frozen while the parts are being named: a head that swings towards the
    // pointer walks out from under it, and picking anything on it is a chase.
    const target = frozen ? { x: 0, y: 0 } : state.pointer
    const k = 1 - Math.exp(-delta * FOLLOW.chase)
    aim.current.x = MathUtils.lerp(aim.current.x, target.x, k)
    aim.current.y = MathUtils.lerp(aim.current.y, target.y, k)

    // The head follows; the body only breathes. Turning the whole figure reads
    // as the model being spun, turning the head reads as him looking at you.
    if (head.current) {
      head.current.rotation.y = POSE.yaw + aim.current.x * FOLLOW.yaw
      head.current.rotation.x = POSE.pitch - aim.current.y * FOLLOW.pitch
    }
    if (body.current) {
      body.current.position.y =
        FRAME_Y + Math.sin(state.clock.elapsedTime * IDLE.speed) * IDLE.rise
    }
  })

  return (
    <group ref={body} position={[0, FRAME_Y, 0]}>
      <Mascot headRef={head} />
    </group>
  )
}

export function MascotScene() {
  const debug = useMascotDebug()

  return (
    <>
      {/* `flat`: no tone mapping. The mascot's colours are the drawing's own,
          and ACES pulls every one of them off its hex. */}
      <Canvas flat shadows="soft" dpr={[1, 2]} camera={{ fov: 26 }}>
      <Lens />
      {/*
        Flat lighting, after Source with `mat_phong 0`: no specular at all, and
        a diffuse term that wraps so far around the form that there is no hard
        terminator anywhere on it. Blocks separate by which way they face, not
        by falling off a lit edge into shadow.

        A hemisphere light does the wrapping honestly. It is an ambient cube in
        two directions — sky above, ground below, blended by the surface normal
        — so every face already has its own value before any lamp is involved,
        and none of them can go black. That replaces both the straight-down
        top-lift and the back fill this used to run.

        What is left of the key is only enough to keep the two side faces apart
        from the front. Aimed at these three ratios against a front face at 1:

            top 1.25    lit side 0.90    unlit side and back 0.68

        Against the previous 1.63 / 0.82 / 0.63 — the same reading, compressed.
        The cost is real and worth knowing: the hair's top plane no longer
        separates from its front the way the artwork's #323337 does from
        #1A1A1A. Flat was the ask; that contrast is what pays for it.

        Numbers are tuned, not derived — three's ambient, hemisphere and
        directional terms do not reach the surface on the same scale.
      */}
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#fffaf2', '#b8bcc4', 1.2]} />

      {/* Front-right key, weak. Also the only shadow caster: two would cross
          the folded arms with two different shadows. Taking so little of the
          total, its shadow lands as a soft drop rather than a hole — which is
          all the crossed forearms need to come apart. The frustum is sized to
          the figure; the default is metres wide and spends the map on sky. */}
      <directionalLight
        position={[3.5, 6.5, 5]}
        intensity={1.17}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-camera-left={-2.2}
        shadow-camera-right={2.2}
        shadow-camera-top={2.6}
        shadow-camera-bottom={-2.6}
      />

        <Rig frozen={debug.enabled} />
        <PartPicker
          enabled={debug.enabled}
          hover={debug.hover}
          setHover={debug.setHover}
        />
      </Canvas>

      <DebugOverlay
        enabled={debug.enabled}
        hover={debug.hover}
        onToggle={debug.toggle}
      />
    </>
  )
}
