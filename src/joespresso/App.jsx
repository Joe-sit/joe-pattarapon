import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Sky } from './scene/Sky'
import { Terrain } from './scene/Terrain'
import { Foliage } from './scene/Foliage'
import { Panels } from './scene/Panels'
import { Mascot } from './scene/Mascot'
import { Curvilinear } from './scene/Curvilinear'
import { useControls } from 'leva'
import { addRim, clamp, damp, lerp, LOW_END } from './scene/utils'
import { scrollState } from './scroll'

/** ใส่ rim light ให้วัตถุทึบทั้งฉาก — ขอบติดแสงขาวนวล (layer 09) */
function RimLight({ color = '#FFF3DC', intensity = 0.5, power = 4.2 }) {
  const { scene } = useThree()
  useEffect(() => {
    const apply = () => {
      scene.traverse((o) => {
        if (!o.isMesh) return
        const m = o.material
        // เว้นของโปร่งแสง (panel แก้ว) กับของที่ไม่ใช่ standard (ฟ้า/ดวงอาทิตย์)
        if (!m || !m.isMeshStandardMaterial || m.transparent) return
        addRim(m, { color, intensity, power })
        m.needsUpdate = true
      })
    }
    apply()
    // ของที่โหลด/ mount ทีหลัง (GLB, Suspense) — วนเก็บซ้ำ (addRim กันฉีดซ้ำให้แล้ว)
    const t1 = setTimeout(apply, 1500)
    const t2 = setTimeout(apply, 4000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [scene, color, intensity, power])
  return null
}

/** กล้องเอียงตามเมาส์เล็กน้อย — ให้ฉากมีมิติโดยไม่ต้องหมุนวัตถุ */
function CameraRig({ strength = 1 }) {
  const { camera } = useThree()
  const target = useRef({ x: 0, y: 0 })
  const cur = useRef({ x: 0, y: 0 })
  const look = useRef(new THREE.Vector3(0, 1.9, 0))

  const sp = useRef(0) // scroll progress แบบหน่วง ให้กล้อง glide

  // debugger: จูนมุมกล้อง/perspective สด ๆ
  const cam = useControls('Camera', {
    camY: { value: 4.1, min: 1, max: 10, step: 0.1 },
    camZ: { value: 14.5, min: 8, max: 30, step: 0.25 },
    fov: { value: 24, min: 12, max: 60, step: 1 },
    lookY: { value: 1.9, min: -2, max: 5, step: 0.1 },
  })

  // ปลายทางตอน scroll สุด — วนมาหน้า mascot มุมเฉียง, mascot ชิดซ้าย เหลือที่ว่างขวา
  // หน้าของ mascot ชี้ไปทาง -Z (วัดจากตำแหน่ง mesh ตา) กล้องเลยต้องวนไปฝั่ง -Z
  // แล้วเยื้อง ~30° ให้ได้มุม 3/4; เป้ามองเยื้องขวา+ต่ำกว่าหัว เพื่อดันตัวไปซ้ายและหัวขึ้นบน
  const fc = useControls('Focus Cam', {
    focusX: { value: 2.48, min: -8, max: 8, step: 0.1 },
    focusY: { value: 2.87, min: 0, max: 8, step: 0.1 },
    focusZ: { value: -4.12, min: -12, max: 12, step: 0.1 },
    focusLookX: { value: -0.85, min: -5, max: 5, step: 0.05 },
    focusLookY: { value: 2.25, min: 0, max: 6, step: 0.05 },
    focusLookZ: { value: 0.48, min: -6, max: 6, step: 0.05 },
    focusFov: { value: 24, min: 12, max: 60, step: 1 },
  })

  // debugger: จูนการขยับตามเมาส์ — ส่วนของกล้อง (ของหัว mascot อยู่ในกลุ่มเดียวกัน ที่ Mascot.jsx)
  const fol = useControls('Follow Cursor', {
    camSwayX: { value: 1.5, min: 0, max: 6, step: 0.05, label: 'กล้อง ซ้ายขวา' },
    camSwayY: { value: 0.7, min: 0, max: 6, step: 0.05, label: 'กล้อง บนล่าง' },
    camEase: { value: 0.045, min: 0.005, max: 0.3, step: 0.005, label: 'กล้อง หน่วง' },
    focusSway: { value: 0.25, min: 0, max: 1, step: 0.01, label: 'ตอน focus' },
  })

  useFrame(({ pointer }, delta) => {
    // dt ตัดเพดานไว้ — สลับแท็บกลับมาแล้ว delta ก้อนใหญ่จะทำให้กล้องกระโดด
    const dt = Math.min(delta, 0.05)
    target.current.x = clamp(pointer.x, -1, 1)
    target.current.y = clamp(pointer.y, -1, 1)
    cur.current.x = damp(cur.current.x, target.current.x, fol.camEase, dt)
    cur.current.y = damp(cur.current.y, target.current.y, fol.camEase, dt)

    // scroll blend: smoothstep + หน่วงเล็กน้อย
    sp.current = damp(sp.current, scrollState.p, 0.12, dt)
    const t = sp.current
    const k = t * t * (3 - 2 * t)
    // ตอน focus ลด parallax ลงเหลือตาม focusSway (ระยะใกล้ ขยับนิดเดียวก็เหวี่ยงแรง)
    const sway = strength * (1 - k * (1 - fol.focusSway))

    const bx = cur.current.x * fol.camSwayX * sway
    const by = cam.camY + cur.current.y * fol.camSwayY * sway
    const bz = cam.camZ

    camera.position.x = lerp(bx, fc.focusX + cur.current.x * fol.camSwayX * 0.23 * sway, k)
    camera.position.y = lerp(by, fc.focusY + cur.current.y * fol.camSwayY * 0.29 * sway, k)
    camera.position.z = lerp(bz, fc.focusZ, k)

    look.current.set(lerp(0, fc.focusLookX, k), lerp(cam.lookY, fc.focusLookY, k), lerp(0, fc.focusLookZ, k))

    const fov = lerp(cam.fov, fc.focusFov, k)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    camera.lookAt(look.current)
  })
  return null
}

function Lights() {
  return (
    <>
      {/* เงานุ่มด้วย PCFSoft (shadows="soft" ที่ Canvas) — PCSS ของ drei ใช้กับ three r182 ไม่ได้แล้ว
          (shadow map เปลี่ยนเป็น depth texture, unpackRGBAToDepth ใช้ไม่ได้ → shader ทึบทั้งฉาก compile พัง) */}

      {/* ambient อุ่นแรงขึ้น — ref โดมเรืองแสงฟุ้ง เงาไม่จม */}
      <ambientLight intensity={0.95} color="#FFE4D2" />
      <hemisphereLight args={['#FFDDC0', '#7BA184', 0.7]} />

      {/* key — ย้อนแสงจากตำแหน่งดวงอาทิตย์ (หลังบน) เงาทอดยาวเข้าหากล้อง
          normalBias กัน shadow acne — ลายขั้นบันไดเห็นชัดมากตอนกล้อง focus เข้าใกล้หน้า */}
      <directionalLight
        castShadow
        position={[1.5, 8.5, -13]}
        intensity={2.6}
        color="#FFD9A8"
        shadow-mapSize={LOW_END ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.05}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-far={60}
      />
      {/* fill หน้า — bounce อุ่นจากฝั่งกล้อง ไม่ให้ด้านหน้าจมมืด */}
      <directionalLight position={[-5, 4, 13]} intensity={1.0} color="#FFDFC8" />
      {/* fill เย็นจาง ๆ จากซ้าย เพิ่มมิติ */}
      <directionalLight position={[-11, 2, -2]} intensity={0.3} color="#D9C8FF" />
    </>
  )
}

export function Scene() {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, LOW_END ? 1.5 : 2]}
      camera={{ position: [0, 4.1, 14.5], fov: 24, near: 0.1, far: 120 }}
      // ภาพสุดท้ายออกจาก EffectComposer — AA มาจาก MSAA ของ render target ไม่ใช่ของ canvas
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <color attach="background" args={['#F8D9BC']} />
      <fog attach="fog" args={['#F6CDA8', 30, 64]} />

      <Lights />
      <CameraRig />
      <Curvilinear strength={0.06} />
      <RimLight />

      <Sky />
      <Terrain />
      <Foliage />
      <Panels />

      <Suspense fallback={null}>
        {/* y: ยืดขาตาม comp แล้วฝ่าเท้าลงไปอีก 0.68 หน่วยโมเดล (×0.55 = 0.374) ยกตัวขึ้นชดเชย */}
        <Mascot position={[0, 2.61, 0.9]} scale={0.55} rotation={[0, -0.32, 0]} facingAway />
      </Suspense>

      {/* <ContactShadows
        position={[0, -0.12, 2.2]}
        opacity={0.32}
        scale={9}
        blur={2.6}
        far={4}
        color="#8A4A2A"
      /> */}
    </Canvas>
  )
}
