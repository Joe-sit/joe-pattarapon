import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox, SoftShadows } from '@react-three/drei'
import * as THREE from 'three'
import { HeroRider, armPoseFromTuner } from '@/newhero/HeroRider'
import { getTuner } from '@/newhero/tuner'
import { loadVoxelHand, makeGripHand, poseGripHand, type GripHand } from '@/sections/hero/voxelHand'
import { TUNE_DEFAULTS } from '@/sections/hero/grassTune'

/**
 * /measure — จัดองค์ประกอบตามภาพ ref ของ Joe (ตัวละครถือไม้บรรทัดวัดส้ม + แกนวัดสีขาว + ฉากหลังสวนเบลอ)
 * รอบแรกเป็น "ดินปั้น" (clay render): ทุกชิ้นสีดินครีมด้านเดียวกัน แสงนุ่มจากแผงไฟ (Lightformer) + เงานุ่ม (PCSS)
 * ดูแค่ทรง/จัดวาง/แสงก่อน ค่อยลงสีทีหลัง
 *
 *   ขวา     ตัวละคร (ริกตัวเดียวกับ hero) หัวโตล้นขอบขวาและขอบบน หันสามส่วนมาทางกลาง
 *   กลาง    device (มือถือ) แทนผลส้ม — แนบขอบไม้บรรทัด (กำลังถูกวัด)
 *   ขวากลาง ไม้บรรทัดตั้งเอียงนิด ขีดเซาะ · มือ (โวเซล — sections/hero/voxelHand) จับบน/ล่าง มีแขนเสื้อยาวออกนอกกรอบ (ไม่ลอย)
 *   ซ้าย    ก้อนกลมเบลอ (ระยะชัดตื้น) แทนสวนส้ม — แคนวาสแยก เบลอด้วย CSS
 *   ทับ     แกนวัดสีขาว 0/5/10 (DOM SVG)
 * วางทุกชิ้นด้วยสัดส่วนจอ (fx, fy) บนระนาบที่ลึก z — องค์ประกอบตรงภาพ ref ทุกขนาดจอ
 */
const CLAY = '#ddd6cb'
const CLAY_DARK = '#b9b1a5'
const FOV = 24
const CAM_Z = 10

const Rider = HeroRider as unknown as React.ComponentType<Record<string, unknown>>

/** ดินปั้น: ครีมด้าน ผิวนุ่ม (roughness สูงแต่ไม่สุด — ยังมีไฮไลต์กว้าง ๆ แบบดินจริง) */
function useClayMats() {
  const mats = useMemo(
    () => ({
      clay: new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.72, metalness: 0, envMapIntensity: 0.9 }),
      dark: new THREE.MeshStandardMaterial({ color: CLAY_DARK, roughness: 0.72, metalness: 0, envMapIntensity: 0.9 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  return mats
}

/** ทาดินทั้งฉาก (ตาคงสีไว้ — บอกทิศหน้า) · กวาดซ้ำเป็นระยะ: ริกปั้น mesh เพิ่มหลังโหลด */
function ClayPaint({ mats }: { mats: ReturnType<typeof useClayMats> }) {
  const scene = useThree((s) => s.scene)
  const next = useRef(0)
  useFrame((_, dt) => {
    next.current -= dt
    if (next.current > 0) return
    next.current = 0.4
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !m.material || m.userData.keepColor) return
      if (m.material === mats.clay || m.material === mats.dark) return
      const src = m.material as THREE.MeshStandardMaterial
      /* ผม/ของสีเข้มเดิม → ดินโทนเข้มกว่า (ทรงหัวไม่กลืนกับผม) */
      const dark = !!src.color && src.color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.2
      m.material = dark ? mats.dark : mats.clay
      m.castShadow = true
      m.receiveShadow = true
    })
  })
  return null
}

/** ระนาบลึก z: พิกัดสัดส่วนจอ (fx ซ้าย→ขวา, fy บน→ล่าง) → พิกัดโลก (คิดเพอร์สเปกทีฟตามระยะจากกล้อง) */
function useScreen() {
  const size = useThree((s) => s.size)
  const t = Math.tan((FOV * Math.PI) / 360)
  const aspect = size.width / Math.max(1, size.height)
  const visH = 2 * CAM_Z * t
  return {
    visH,
    at: (fx: number, fy: number, z = 0): [number, number, number] => {
      const h = 2 * (CAM_Z - z) * t
      return [(fx - 0.5) * h * aspect, (0.5 - fy) * h, z]
    },
  }
}

/** มือถือกลางภาพ (แทนผลส้ม) — แผ่นมนหนา จอเว้าลงนิด เกาะบน · แนบขอบซ้ายของไม้บรรทัด */
function Device() {
  const { visH, at } = useScreen()
  const h = visH * 0.42
  const w = h * 0.49
  return (
    <group position={at(0.515, 0.41, 0.7)} rotation={[0.06, -0.3, 0.06]}>
      <RoundedBox args={[w, h, w * 0.13]} radius={w * 0.17} smoothness={6} castShadow receiveShadow>
        <meshStandardMaterial color={CLAY} roughness={0.68} />
      </RoundedBox>
      <RoundedBox args={[w * 0.86, h * 0.93, w * 0.02]} radius={w * 0.13} smoothness={4} position={[0, 0, w * 0.058]} receiveShadow>
        <meshStandardMaterial color={CLAY_DARK} roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[w * 0.3, w * 0.07, w * 0.02]} radius={w * 0.03} smoothness={3} position={[0, h * 0.425, w * 0.07]}>
        <meshStandardMaterial color={CLAY} roughness={0.68} />
      </RoundedBox>
    </group>
  )
}

/** ไม้บรรทัดตั้ง เรียว ขอบมน ขีดเซาะ (ขีดยาวทุก 5) — เอียงนิดตามภาพ ref */
function Ruler() {
  const { visH, at } = useScreen()
  const h = visH * 0.96
  const w = visH * 0.055
  const ticks = 40
  return (
    <group position={at(0.625, 0.48, 0.55)} rotation={[0.04, -0.3, -0.14]}>
      <RoundedBox args={[w, h, w * 0.2]} radius={w * 0.08} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color={CLAY} roughness={0.7} />
      </RoundedBox>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const long = i % 5 === 0
        const tw = w * (long ? 0.5 : 0.26)
        return (
          <mesh key={i} position={[-w / 2 + tw / 2 + w * 0.06, -h / 2 + (h * 0.9 * i) / ticks + h * 0.05, w * 0.101]} receiveShadow>
            <boxGeometry args={[tw, w * 0.035, w * 0.01]} />
            <meshStandardMaterial color={CLAY_DARK} roughness={0.8} />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * มือจับไม้บรรทัด บน/ล่าง + แขนเสื้อ (ทรงกระบอกมน) ยื่นออกนอกกรอบ — แบบภาพ ref (แขนบนมาจากขวาบน แขนล่างมาจากขวาล่าง)
 * มือ = โวเซล ท่ากำ (ชุดเดียวกับมือถือมือถือในเรื่องหลัก)
 */
function Arms() {
  const { visH, at } = useScreen()
  const top = useRef<THREE.Group>(null)
  const bot = useRef<THREE.Group>(null)
  useEffect(() => {
    let dead = false
    const made: GripHand[] = []
    loadVoxelHand().then((gl) => {
      if (dead) return
      for (const g of [top.current, bot.current]) {
        if (!g) continue
        const h = makeGripHand(gl, 1)
        poseGripHand(h, { ...TUNE_DEFAULTS, gripX: 0, gripY: 0, gripZ: 0, gripRZ: 0, gripS: 1, curlB: 80, curlM: 70, curlT: 50 }, 1, 1)
        h.meshes.forEach((m) => {
          m.castShadow = true
          m.receiveShadow = true
        })
        g.add(h.root)
        made.push(h)
      }
    })
    return () => {
      dead = true
      made.forEach((h) => {
        h.root.removeFromParent()
        h.dispose()
      })
    }
  }, [])
  const s = visH * 0.17
  const r = visH * 0.045
  /* ข้อมือ (ปลายแขนเสื้อ) → ปลายอีกข้างนอกกรอบ: บนไปขวาบน ล่างไปขวาล่าง */
  const topHand = at(0.655, 0.1, 0.7)
  const botHand = at(0.6, 0.86, 0.75)
  return (
    <>
      <group ref={top} position={topHand} rotation={[0.2, -0.9, -1.9]} scale={s} />
      <Sleeve from={[topHand[0] + r * 1.2, topHand[1] + r * 0.6, topHand[2] - r]} to={at(0.92, -0.25, 0.2)} r={r} />
      <group ref={bot} position={botHand} rotation={[0.1, -0.8, -1.2]} scale={s} />
      <Sleeve from={[botHand[0] + r * 1.2, botHand[1] - r * 0.4, botHand[2] - r]} to={at(0.95, 1.3, 0.3)} r={r} />
    </>
  )
}

/** แขนเสื้อทรงแคปซูลจากจุดหนึ่งไปอีกจุด (ตั้งแกนด้วยเวกเตอร์ ไม่ซ้อนมุมหมุน — ไม่ชี้ผิดทาง) */
function Sleeve({ from, to, r }: { from: [number, number, number]; to: [number, number, number]; r: number }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const d = b.clone().sub(a)
    const len = d.length()
    return {
      pos: a.clone().add(b).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()),
      len,
    }
  }, [from, to])
  return (
    <mesh position={pos} quaternion={quat} castShadow receiveShadow>
      <capsuleGeometry args={[r, Math.max(0.01, len - r * 2), 8, 24]} />
      <meshStandardMaterial color={CLAY} roughness={0.72} />
    </mesh>
  )
}

/** ตัวละคร: หัวโตล้นขอบขวา/บน กลางหัวที่ (0.83, 0.3) จอ — วัดกรอบครั้งแรก แล้วย่อ/เลื่อนให้หัวลงตรงจุด */
function Character() {
  const { visH, at } = useScreen()
  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const fit = useRef({ n: 0, done: false })
  const armPose = useMemo(() => {
    const a = { ...armPoseFromTuner(getTuner()) } as Record<string, number>
    /* แขนลงแนบตัว (ท่าที่จูนแล้วในฉากหญ้า — sections/hero/grassTune) · มือจับไม้บรรทัดเป็นมือแยกพร้อมแขนเสื้อ */
    const T = TUNE_DEFAULTS
    const D2R = Math.PI / 180
    for (const k of ['aimX', 'aimY', 'aimZ', 'aimOut', 'aimUp', 'aimFwd', 'mugOut', 'mugUp', 'mugFwd']) a[k] = T[k]
    for (const k of ['elbowX', 'elbowY', 'elbowZ', 'wristX', 'wristY', 'wristZ', 'mugShX', 'mugShY', 'mugShZ', 'mugElX', 'mugElY', 'mugElZ', 'mugWristX', 'mugWristY', 'mugWristZ'])
      a[k] = T[k] * D2R
    return a
  }, [])
  const follow = useMemo(
    () => ({
      headYaw: 0,
      headPitch: 0,
      headRoll: 0,
      headEase: 1,
      headBaseYaw: (-30 * Math.PI) / 180,
      headBasePitch: (4 * Math.PI) / 180,
      headBaseRoll: (-8 * Math.PI) / 180,
      headFollow: 0,
      headCurve: 1,
      headDead: 0,
      headBounce: 0,
      headIdleBack: 0,
    }),
    [],
  )
  useFrame(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i || fit.current.done) return
    if (++fit.current.n < 8) return
    i.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(i)
    if (box.isEmpty()) return
    /* สูงทั้งตัว ≈ 2.5 จอ (หัวสูงราว 0.8 จอ ล้นขอบขวาและบนแบบภาพ ref) — อยู่หลังไม้บรรทัด */
    const k = (visH * 2.5) / (box.max.y - box.min.y)
    o.scale.setScalar(k)
    o.updateWorldMatrix(true, true)
    let head: THREE.Object3D | null = null
    i.traverse((c) => {
      if (c.name === 'HeadGroup') head = c
    })
    const hp = new THREE.Vector3()
    if (head) (head as THREE.Object3D).getWorldPosition(hp)
    else box.getCenter(hp)
    const want = new THREE.Vector3(...at(0.84, 0.36, -2))
    o.position.add(want.sub(hp))
    fit.current.done = true
  })
  return (
    <group ref={outer} rotation={[0, -0.5, 0]}>
      <group ref={inner}>
        <Suspense fallback={null}>
          <Rider noLean noBoard noWind noIdle armPose={armPose} followOverride={follow} />
        </Suspense>
      </group>
    </group>
  )
}

/** ฉากหลังเบลอ: พุ่มกลมซ้อนกัน (สวน) ซ้ายจอ + พื้นเนินลาง ๆ — แคนวาสแยก เบลอด้วย CSS แบบระยะชัดตื้นของภาพ ref */
function Bokeh() {
  const { visH, at } = useScreen()
  const blobs = useMemo(() => {
    let seed = 5
    const r = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    return Array.from({ length: 30 }, () => ({ fx: r() * 0.55, fy: 0.15 + r() * 0.9, s: 0.05 + r() * 0.12, z: -2 - r() * 3 }))
  }, [])
  return (
    <>
      {blobs.map((b, i) => (
        <mesh key={i} position={at(b.fx, b.fy, b.z)} scale={visH * b.s}>
          <sphereGeometry args={[1, 32, 20]} />
          <meshStandardMaterial color={i % 3 === 0 ? CLAY : CLAY_DARK} roughness={0.8} />
        </mesh>
      ))}
    </>
  )
}

/** แสงแบบเรนเดอร์ดินปั้น: แผงไฟนุ่มบนซ้าย (key) · แผงข้างขวา (rim) · ฟ้าบน · ไฟหลักทอดเงานุ่ม */
function Studio({ shadows = true }: { shadows?: boolean }) {
  return (
    <>
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.6} color="#fff7ec" position={[-6, 6, 6]} scale={[10, 8, 1]} />
        <Lightformer intensity={1.6} color="#ffffff" position={[7, 3, 2]} rotation-y={-Math.PI / 2.4} scale={[6, 10, 1]} />
        <Lightformer intensity={0.9} color="#eaf2ff" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[14, 14, 1]} />
      </Environment>
      <ambientLight intensity={0.15} />
      <directionalLight position={[-5, 7, 9]} intensity={1.6} color="#fff4e6" castShadow={shadows} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0006} shadow-normalBias={0.03} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={5} shadow-camera-bottom={-5} />
    </>
  )
}

/** แกนวัดสีขาว (แบบภาพ ref): แนวตั้งซ้ายของ device · แนวนอนใต้ device · ขีดทุกช่อง ตัวเลข 0/5/10 */
function Chart() {
  const ticks = Array.from({ length: 21 }, (_, i) => i)
  /* พิกัด viewBox 1000×562 (สัดส่วน 16:9) — ครอบเต็มจอแบบ slice */
  const ox = 362
  const oy = 382
  const len = 300
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1000 562" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))' }}>
        <line x1={ox} y1={oy} x2={ox} y2={oy - len} />
        <line x1={ox} y1={oy} x2={ox + len} y2={oy} />
        {ticks.map((i) => {
          const d = (len * i) / 20
          const long = i % 10 === 0 ? 12 : i % 5 === 0 ? 9 : 5
          return (
            <g key={i}>
              <line x1={ox} y1={oy - d} x2={ox + long} y2={oy - d} />
              <line x1={ox + d} y1={oy} x2={ox + d} y2={oy - long} />
            </g>
          )
        })}
      </g>
      <g fill="#fff" fontSize="22" fontFamily="ui-sans-serif, system-ui" fontWeight="500" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))' }}>
        <text x={ox - 30} y={oy + 8}>0</text>
        <text x={ox - 28} y={oy - len / 2 + 8}>5</text>
        <text x={ox - 40} y={oy - len + 8}>10</text>
        <text x={ox + len / 2 - 6} y={oy + 34}>5</text>
        <text x={ox + len - 12} y={oy + 34}>10</text>
      </g>
    </svg>
  )
}

function Scene() {
  const mats = useClayMats()
  return (
    <>
      <SoftShadows size={28} samples={14} focus={0.6} />
      <Studio />
      <ClayPaint mats={mats} />
      <Character />
      <Ruler />
      <Device />
      <Arms />
    </>
  )
}

export default function MeasurePage() {
  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-[radial-gradient(120%_90%_at_80%_10%,#f4f1ec,#d9d4cc)]">
      <Canvas className="!absolute inset-0" style={{ filter: 'blur(16px)' }} dpr={1} camera={{ fov: FOV, position: [0, 0, CAM_Z] }} gl={{ toneMapping: THREE.ACESFilmicToneMapping }}>
        <Studio shadows={false} />
        <Bokeh />
      </Canvas>
      <Canvas className="!absolute inset-0" shadows dpr={[1, 2]} camera={{ fov: FOV, position: [0, 0, CAM_Z] }} gl={{ alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Scene />
      </Canvas>
      <Chart />
    </div>
  )
}
