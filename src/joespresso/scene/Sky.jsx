import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { modeState } from '../mode'
import { gradientTexture, makeRandom, useDisposable, useStaticSubtree } from './utils'
import { blobGeometry } from './Blob'

/**
 * กลางคืนไม่ได้ทำด้วยการ "หรี่กลางวัน"
 *
 * เคยลองหรี่ผนังฟ้ากับดวงอาทิตย์ลงเฉย ๆ (คูณสีลง) ได้ฟ้าสีน้ำตาลหม่นกับดวงอาทิตย์สีสนิม
 * เพราะสีตั้งต้นเป็นชุดอุ่นทั้งหมด ยิ่งหรี่ยิ่งขุ่น ไม่ใช่กลางคืน
 * คราวนี้ซ้อน "ฟ้ากลางคืน" กับ "ดวงจันทร์" เป็นของอีกชุดแล้วไล่สลับหน้ากัน — สีของกลางคืน
 * จึงเป็นสีที่เลือกเองทั้งชุด (คราม/blurple) ไม่ใช่ผลพลอยได้จากการหรี่สีกลางวัน
 */
const NIGHT_SKY = [
  [0, '#6065E8'],
  [0.5, '#4A50CE'],
  [1, '#3A40AE'],
]
/** ดวงอาทิตย์เหลือความสว่างเท่านี้ตอนกลางคืน (ไม่หายไปเลย — เหลือเป็นเรืองแสงจาง ๆ หลังดวงจันทร์) */
const SUN_DIM = 0.03

/** ผนังไล่สีด้านหลังทั้งฉาก + ดวงอาทิตย์ + เมฆ */
/** sunAt — ตำแหน่งดวงอาทิตย์ทางเลือก (หน้า /2026 ย้ายไปมุมขวาบนของ view ที่แพนขวา) */
export function Sky({ sunAt }) {
  const bg = useMemo(
    () =>
      gradientTexture([
        [0, '#FBE3C8'],
        [0.45, '#F8D3B4'],
        [1, '#F6C9A8'],
      ]),
    [],
  )
  const night = useMemo(() => gradientTexture(NIGHT_SKY), [])
  useDisposable(bg)
  useDisposable(night)

  // ฟ้าไม่เคยขยับ — ตัดออกจาก matrix update ทุกเฟรม
  const ref = useRef(null)
  useStaticSubtree(ref)

  const nightWall = useRef()
  useFade(nightWall)

  return (
    <group ref={ref}>
      {/* ผนังหลัง — ไม่รับแสง จะได้สีเรียบเนียน */}
      <mesh position={[0, 4, -26]} renderOrder={-1}>
        <planeGeometry args={[90, 46]} />
        <meshBasicMaterial map={bg} toneMapped={false} />
      </mesh>
      {/* ฟ้ากลางคืนซ้อนหน้าฟ้ากลางวัน จางเข้ามาแทนกันตอนสลับโหมด */}
      <mesh ref={nightWall} position={[0, 4, -25.9]} renderOrder={-1}>
        <planeGeometry args={[90, 46]} />
        <meshBasicMaterial map={night} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* ดวงจันทร์ขึ้นแทนที่ดวงอาทิตย์ตรงตำแหน่งเดิม — เยื้องซ้ายนิดเดียวให้เสี้ยวไม่ทับขอบดวงอาทิตย์
          (เคยวางไว้มุมซ้ายบน แล้วมันไปโผล่หลังก้อนเมฆ มองไม่เห็นเลยทั้งดวง) */}
      <Sun position={sunAt ?? [1.2, 6.2, -22]} radius={4.2} />
      <Moon position={[-2.6, 5.2, -21]} radius={2.2} />

      <Cloud position={[-4.6, 4.4, -14]} scale={1} />
      <Cloud position={[5.2, 3.4, -12]} scale={0.78} />
      <Cloud position={[-9, 6.2, -18]} scale={0.6} />
      {/* เมฆคั่นหน้าดวงอาทิตย์ล่างแบบ ref */}
      <Cloud position={[-2.6, 3.3, -20.5]} scale={0.85} />
    </group>
  )
}

/**
 * ไล่ค่าตามโหมด 0..1 — 1 = กลางคืนเต็มที่
 * ใช้เวลาหน่วงชุดเดียวกับ DevGrade ของทั้งฉาก ไม่งั้นฟ้ากับแสงจะเปลี่ยนคนละจังหวะ
 */
function useNight(ref) {
  const k = useRef(0)
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    k.current += ((modeState.dev ? 1 : 0) - k.current) * (1 - Math.exp(-dt / 0.35))
    ref(k.current)
  })
}

/** จางเข้ามาตอนกลางคืน (ของกลางคืน) */
function useFade(mesh) {
  useNight((k) => {
    const m = mesh.current?.material
    if (m) {
      m.opacity = k
      mesh.current.visible = k > 0.002
    }
  })
}

/** หรี่ลงตอนกลางคืน (ของกลางวัน) */
function useDim(mesh, dim) {
  useNight((k) => {
    const m = mesh.current?.material
    if (m) m.color.setScalar(1 - (1 - dim) * k)
  })
}

/**
 * ดวงจันทร์ — เสี้ยว ไม่ใช่วงกลม
 *
 * ทำด้วยวงกลมสองใบ: ใบสว่างเต็ม แล้ววาดใบที่เป็น "สีฟ้ากลางคืน" ทับเยื้องไป กินเนื้อออกเป็นเสี้ยว
 * ถูกกว่าการทำ shape/มาสก์จริง และเปลี่ยนความอ้วนของเสี้ยวได้ด้วยการเลื่อนใบที่บังอย่างเดียว
 */
function Moon({ position, radius }) {
  const glow = useMemo(() => radialGlow('#C9D2FF'), [])
  useDisposable(glow)
  const halo = useRef()
  const disc = useRef()
  const bite = useRef()
  useFade(halo)
  useFade(disc)
  useFade(bite)
  return (
    <group position={position}>
      <mesh ref={halo} position={[0, 0, -0.2]}>
        <planeGeometry args={[radius * 5, radius * 5]} />
        <meshBasicMaterial map={glow} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={disc} position={[0, 0, -0.1]}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial color="#EEF1FF" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={bite} position={[radius * 0.62, radius * 0.16, -0.05]}>
        <circleGeometry args={[radius * 0.92, 64]} />
        <meshBasicMaterial color={NIGHT_SKY[0][1]} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** glow วงกลมขอบฟุ้ง — radial gradient จางออกจนใส */
function radialGlow(color) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(128, 128, 30, 128, 128, 128)
  g.addColorStop(0, `${color}CC`)
  g.addColorStop(0.55, `${color}55`)
  g.addColorStop(1, `${color}00`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Sun({ position, radius }) {
  // layer 04 — ส้มไล่เฉด สว่างบนเข้มล่าง + glow ฟุ้งละลายเข้ากับฟ้าแบบ ref
  const grad = useMemo(
    () => gradientTexture([[0, '#FFB23E'], [1, '#F07A22']]),
    [],
  )
  const glow = useMemo(() => radialGlow('#FFC97E'), [])
  // แยกเรียกทีละตัว — ส่ง array literal เข้าไปจะเป็น ref ใหม่ทุก render, effect รันซ้ำแล้ว dispose ทิ้งทันที
  useDisposable(grad)
  useDisposable(glow)
  const halo = useRef()
  const disc = useRef()
  useDim(halo, SUN_DIM)
  useDim(disc, SUN_DIM)
  return (
    <group position={position}>
      <mesh ref={halo} position={[0, 0, -0.15]}>
        <planeGeometry args={[radius * 3.4, radius * 3.4]} />
        <meshBasicMaterial map={glow} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={disc}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial map={grad} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** เมฆ = metaball หลอมเป็นก้อนเดียว ไม่เห็นรอยต่อ sphere */
let cloudGeoCache = null
function cloudGeo() {
  if (!cloudGeoCache) {
    const rnd = makeRandom(7)
    const blobs = [
      [0, 0, 0, 1],
      [-1.05, -0.18, 0, 0.7],
      [1.0, -0.2, 0, 0.72],
      [0.42, 0.34, 0.1, 0.66],
      [-0.5, 0.28, -0.1, 0.6],
    ].map((b) => b.map((v, i) => (i === 3 ? v * (0.92 + rnd() * 0.16) : v)))
    cloudGeoCache = blobGeometry(blobs)
  }
  return cloudGeoCache
}

function Cloud({ position, scale = 1 }) {
  const geo = useMemo(() => cloudGeo(), [])
  return (
    <mesh geometry={geo} position={position} scale={scale * 2}>
      <meshStandardMaterial color="#FFFFFF" roughness={1} metalness={0} />
    </mesh>
  )
}
