import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { makeRandom, useDisposable } from '@/joespresso/scene/utils'
import { CYL, FOLIAGE_MATS, LUMPS, lumpMaterial, SPHERE } from './foliage'
import { outBack } from './intro'
import { ridePose } from './ridePose'
import { getTuner } from './tuner'

/**
 * ทิวทัศน์ในพอร์ทัล — เนินหญ้า ทางเดิน กังหันลม ตาม ref
 *
 * เป็นภูมิประเทศจริง ไม่ใช่ฉากตัดกระดาษ: ผืนพื้นเป็นตารางที่ยกจุดตามฟังก์ชันความสูง
 * ของทุกชิ้น (ต้นไม้ ทาง กังหัน) หาความสูงจากฟังก์ชันเดียวกัน จึงยืนติดพื้นเสมอโดยไม่ต้อง
 * ไล่จัดตำแหน่งทีละชิ้น และเมื่อกล้องขยับ ของใกล้กับของไกลเลื่อนคนละอัตรา = มีความลึกจริง
 *
 * ทำไมไม่ใช้เนินแบนซ้อนชั้นแบบ ref ตรง ๆ: ฉากนี้อยู่หลังกรอบหน้าต่างที่กล้องแพนผ่าน
 * ตลอดอินโทร ชั้นแบนจะเลื่อนพร้อมกันทั้งผืน อ่านเป็นฉากหลังที่ทาสีไว้ ไม่ใช่ "อีกที่หนึ่ง"
 * ที่มองผ่านช่องออกไป
 *
 * แกน: x = ซ้าย/ขวา, y = สูง, z = ลึกเข้าไป (ยิ่งลบยิ่งไกล)
 */

/* ---------- จานสี (สุ่มพิกเซลจาก ref) ---------- */
const SKY_TOP = '#69c4ef'
const SKY_LOW = '#e4f6fb'
/** ไล่สีฟ้าของฉากนี้ — ผนังพอร์ทัลใช้ชุดเดียวกัน จะได้ไม่มีรอยต่อสีที่ขอบผืน */
export const SKY_STOPS = [
  [0, SKY_TOP],
  [1, SKY_LOW],
]
const SUN = '#f7c04a'
const CLOUD = '#fbfdfb'
const GRASS_HIGH = '#79c93a'
const GRASS_MID = '#4aa622'
const GRASS_LOW = '#28791b'
const PATH_COL = '#ece5d8'
const TURBINE_COL = '#f4faf6'

/** ขนาดผืนพื้น (หน่วยฉาก) และความละเอียดตาราง */
/**
 * ผืนพื้นต้องอยู่ในช่องว่างระหว่างกรอบหน้าต่างกับผนังพอร์ทัล (ราว 44 หน่วย) — ลึกกว่านั้น
 * ท้ายผืนจะทะลุออกหลังผนังแล้วขอบตารางจะโผล่ ฉากจึงย่อส่วนเป็นโลกจิ๋ว ไม่ใช่ทุ่งขนาดจริง
 */
const LAND_W = 130
const LAND_D = 48
const SEG_X = 90
const SEG_Z = 54
/**
 * ขอบหน้าของผืน — ยื่นเลยระนาบกรอบหน้าต่างออกมาทางผู้ชม
 *
 * ถ้าขอบหน้าอยู่หลังกรอบ กล้องจะเห็น "ที่ว่างใต้ขอบผืน" เป็นรอยตัดขวางกลางกรอบ (พื้นขาด)
 * ยื่นออกมาแล้ว stencil ของหน้าต่างเป็นตัวตัดให้เอง เห็นเป็นพื้นที่ทอดต่อเนื่องจากขอบล่าง
 */
const NEAR_Z = 22

/**
 * ความสูงของพื้นที่จุดใด ๆ — ผลรวมของคลื่นไซน์คนละคาบ
 *
 * ใช้ไซน์ไม่ใช่นอยส์: เนินใน ref เป็นลอนใหญ่ที่อ่านรูปทรงได้ ไม่ใช่ผิวขรุขระ และฟังก์ชัน
 * ปิดแบบนี้เรียกซ้ำได้ทุกที่ (วางต้นไม้/ทาง/กังหันใช้ตัวเดียวกับที่ปั้นพื้น) ผลลัพธ์เหมือนเดิม
 * ทุกครั้งโดยไม่ต้องเก็บตารางความสูงไว้
 */
function heightAt(x, z) {
  return (
    2.1 * Math.sin(x * 0.1) * Math.cos(z * 0.14) +
    1.35 * Math.sin(x * 0.038 + 1.7) +
    1.05 * Math.cos(z * 0.105 + 0.6) +
    0.65 * Math.sin((x * 0.06 + z * 0.11) + 2.2)
  )
}

/** เส้นกลางของทางเดิน — คดจากหน้าสุดเข้าไปหาขอบฟ้า (พิกัด xz) */
const PATH_PTS = [
  new THREE.Vector3(-2, 0, NEAR_Z),
  new THREE.Vector3(-4.5, 0, 0),
  new THREE.Vector3(-1.5, 0, -5),
  new THREE.Vector3(3, 0, -10),
  new THREE.Vector3(0.6, 0, -15),
  new THREE.Vector3(-3.5, 0, -20),
  new THREE.Vector3(-2, 0, -25),
]
const PATH_CURVE = new THREE.CatmullRomCurve3(PATH_PTS, false, 'catmullrom', 0.4)
/** ครึ่งความกว้างของทาง: กว้างตรงหน้า แคบเมื่อไกลออกไป (ตาม ref) */
const PATH_HALF_NEAR = 2.2
const PATH_HALF_FAR = 0.55
const PATH_SEGS = 90

/** ตัวอย่างจุดบนเส้นทาง — ใช้ทั้งปั้นถนนและกันไม่ให้ต้นไม้ไปยืนกลางทาง */
const PATH_SAMPLES = Array.from({ length: PATH_SEGS + 1 }, (_, i) => PATH_CURVE.getPoint(i / PATH_SEGS))

/** ระยะจากจุด xz ถึงเส้นทางที่ใกล้ที่สุด — พอสำหรับการเว้นระยะ ไม่ต้องแม่นระดับเส้นโค้ง */
function distToPath(x, z) {
  let best = Infinity
  for (const p of PATH_SAMPLES) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2
    if (d < best) best = d
  }
  return Math.sqrt(best)
}

/**
 * ผืนพื้น — ตารางที่ยกจุดตาม heightAt แล้วระบายสีที่จุดยอดตามความสูง
 *
 * ระบายที่จุดยอด (vertexColors) ไม่ใช่เท็กซ์เจอร์: ต้องการแค่ "ยอดเนินสว่าง ท้องเนินเข้ม"
 * ซึ่งเป็นฟังก์ชันของความสูงล้วน ๆ เท็กซ์เจอร์จะกินหน่วยความจำและต้องคิด uv เพิ่มเปล่า ๆ
 */
function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(LAND_W, LAND_D, SEG_X, SEG_Z)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const col = new Float32Array(pos.count * 3)
    const cLow = new THREE.Color(GRASS_LOW)
    const cMid = new THREE.Color(GRASS_MID)
    const cHigh = new THREE.Color(GRASS_HIGH)
    const cHaze = new THREE.Color(SKY_LOW)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      // ระนาบถูกสร้างโดยมีศูนย์กลางที่ 0 — เลื่อนให้ขอบหน้าอยู่ที่ NEAR_Z
      const z = pos.getZ(i) + (NEAR_Z - LAND_D / 2)
      const h = heightAt(x, z)
      pos.setY(i, h)
      pos.setZ(i, z)
      const t = Math.min(1, Math.max(0, (h + 5) / 10))
      c.copy(cLow).lerp(cMid, Math.min(1, t * 2))
      if (t > 0.5) c.lerp(cHigh, (t - 0.5) * 2)
      /**
       * ทัศนมิติเชิงอากาศ — ยิ่งไกลยิ่งจางเข้าหาสีฟ้าที่ขอบฟ้า
       *
       * ฉากนี้ไม่มีหมอกจริง (fog ของ three จะไปโดนของนอกพอร์ทัลด้วย) แต่สิ่งที่ตาอ่านว่า
       * "ลึก" คือคอนทราสต์ที่ลดลงตามระยะ ระบายลงสีจุดยอดได้ผลเดียวกันโดยไม่แตะฉากอื่น
       */
      const depth = Math.min(1, Math.max(0, (NEAR_Z - 6 - z) / (LAND_D * 0.85)))
      c.lerp(cHaze, depth * depth * 0.24)
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [])
  useDisposable(geo)
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  )
}

/**
 * ทางเดิน — แถบที่วางทาบไปบนผิวพื้น ไม่ใช่แผ่นแบนลอย
 *
 * ขอบทางทั้งสองข้างอ่านความสูงจาก heightAt ที่ตำแหน่งของตัวเอง ทางจึงขึ้นลงตามเนินและ
 * หายไปหลังสันเองเมื่อเนินบัง ยกขึ้นจากผิวนิดเดียวกัน z-fighting
 */
function Path() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const verts = new Float32Array((PATH_SEGS + 1) * 2 * 3)
    const idx = []
    const tan = new THREE.Vector3()
    for (let i = 0; i <= PATH_SEGS; i++) {
      const u = i / PATH_SEGS
      const p = PATH_CURVE.getPoint(u)
      PATH_CURVE.getTangent(u, tan)
      // เส้นตั้งฉากในระนาบ xz (หมุนแทนเจนต์ 90°)
      const nx = -tan.z
      const nz = tan.x
      const len = Math.hypot(nx, nz) || 1
      const half = PATH_HALF_NEAR + (PATH_HALF_FAR - PATH_HALF_NEAR) * u
      for (const side of [-1, 1]) {
        const x = p.x + (nx / len) * half * side
        const z = p.z + (nz / len) * half * side
        const k = (i * 2 + (side < 0 ? 0 : 1)) * 3
        verts[k] = x
        verts[k + 1] = heightAt(x, z) + 0.06
        verts[k + 2] = z
      }
      if (i < PATH_SEGS) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [])
  useDisposable(geo)
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={PATH_COL} roughness={0.98} metalness={0} />
    </mesh>
  )
}

/** ใบพัดหนึ่งใบ — เรียวจากดุมไปปลาย ปลายมน รีดหนาให้มีปริมาตร */
function bladeGeometry(len, wide, thick) {
  const s = new THREE.Shape()
  s.moveTo(0, -wide * 0.5)
  s.quadraticCurveTo(len * 0.55, -wide * 0.42, len, -wide * 0.12)
  s.quadraticCurveTo(len * 1.04, 0, len, wide * 0.12)
  s.quadraticCurveTo(len * 0.55, wide * 0.3, 0, wide * 0.5)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 12 })
  g.translate(0, 0, -thick / 2)
  return g
}

/**
 * กังหันลม — เสาทรงกระบอกสอบขึ้น ใบพัดรีดหนา หมุนรอบแกน z จริง
 *
 * ใบพัดสามใบอยู่ในกลุ่มเดียวแล้วหมุนทั้งกลุ่ม ถูกกว่าหมุนทีละใบ และมุมระหว่างใบจะไม่เพี้ยน
 * จากการสะสมค่า โคนเสาอ่านความสูงจาก heightAt จึงยืนบนเนินพอดีไม่ว่าจะย้ายไปตรงไหน
 */
function Turbine({ x, z, h = 15, speed = 0.5, phase = 0, yaw = 0 }) {
  const mast = useMemo(() => new THREE.CylinderGeometry(0.16, 0.42, h, 14), [h])
  const blade = useMemo(() => bladeGeometry(h * 0.52, h * 0.075, 0.18), [h])
  const hub = useMemo(() => new THREE.SphereGeometry(h * 0.035, 16, 12), [h])
  useDisposable([mast, blade, hub])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: TURBINE_COL, roughness: 0.6, metalness: 0 }), [])
  useDisposable(mat)

  const rotor = useRef()
  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.z += speed * dt
  })

  return (
    <group position={[x, heightAt(x, z), z]} rotation={[0, yaw, 0]}>
      <mesh geometry={mast} material={mat} position={[0, h / 2, 0]} />
      <group ref={rotor} position={[0, h, h * 0.05]} rotation={[0, 0, phase]}>
        <mesh geometry={hub} material={mat} />
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={blade} material={mat} rotation={[0, 0, (i * Math.PI * 2) / 3]} />
        ))}
      </group>
    </group>
  )
}

/** ก้อนเมฆ — ลูกกลมกดแบนสามลูกเกาะกัน ลอยข้ามฟ้าแล้ววนกลับมาทางซ้าย */
function Cloud({ x, y, z, s = 1, speed }) {
  const geo = useMemo(() => new THREE.SphereGeometry(1, 20, 14), [])
  useDisposable(geo)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: CLOUD, roughness: 1, metalness: 0 }), [])
  useDisposable(mat)
  const ref = useRef()
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    g.position.x += speed * dt
    if (g.position.x > LAND_W * 0.6) g.position.x = -LAND_W * 0.6
  })
  return (
    <group ref={ref} position={[x, y, z]} scale={s}>
      <mesh geometry={geo} material={mat} scale={[3.4, 1.0, 1.6]} />
      <mesh geometry={geo} material={mat} position={[-1.9, -0.18, 0]} scale={[1.5, 0.8, 1.3]} />
      <mesh geometry={geo} material={mat} position={[1.8, -0.1, 0.1]} scale={[1.8, 0.86, 1.4]} />
    </group>
  )
}

/** กังหัน: [x, z, สูง, ตัวคูณความเร็ว, เฟสเริ่ม] */
const TURBINES = [
  [-19, -18, 7.5, 0.6, 0.4],
  [-12, -22, 6.4, 0.72, 1.9],
  [15, -17, 8.2, 0.66, 2.6],
  [24, -11, 9.5, 0.85, 0.9],
  [9, -23, 6.8, 0.55, 2.2],
]
const TURBINE_XZ = TURBINES.map((t) => [t[0], t[1]])

/**
 * ของประดับบนพื้น — ชิ้นเดียวกับที่ปั้นไว้ในลูกโลก (foliage.jsx)
 *
 * ไม่ได้สุ่มพิกัดแบบสม่ำเสมอ เพราะการสุ่มแบบนั้นให้ทั้งกระจุกที่บังกันเองและหลุมโล่งใหญ่ ๆ
 * ที่อ่านเป็น "ลืมวาง" ใช้วิธี best-candidate แทน: สุ่มผู้สมัครหลายจุดต่อหนึ่งชิ้นแล้วเลือก
 * จุดที่ ไกลจากของที่วางไปแล้วที่สุด — ของจึงไปลงตรงที่ยังว่าง กระจายทั่วทุ่งเองโดยไม่ต้อง
 * วางมือ (Mitchell best-candidate เป็นบลูนอยส์แบบถูกที่สุดที่ไม่ต้องเก็บกริด)
 *
 * แล้วค่อยเติมเป็นกอ: ต้นไม้ใหญ่บางต้นมีลูกไม้เล็กล้อมรอบ — ธรรมชาติขึ้นเป็นกลุ่ม ไม่ใช่
 * เรียงห่างเท่ากันหมด ซึ่งจะกลับไปดูเป็นของที่ถูกโปรยเหมือนกันทั้งทุ่ง
 *
 * ชนิดของเลือกตามระยะจากทางเดินและระยะลึก: ใกล้ทาง = ของเตี้ย (ดอกไม้/เห็ด/กรวด) เพราะ
 * ต้นใหญ่ติดทางจะบังทางจนมองไม่เห็น, ไกลออกไป = ต้นไม้ใหญ่ ทำให้เกิดชั้นความลึก
 */
const NEAR_KINDS = ['flower', 'flower', 'mushroom', 'berry', 'bush', 'pebble']
const FAR_KINDS = ['cone', 'cone', 'round', 'bush', 'round', 'stump']

function pickKind(rand, dPath, far) {
  const openField = Math.min(1, dPath / 14) * 0.65 + far * 0.35
  const table = rand() < openField ? FAR_KINDS : NEAR_KINDS
  return table[Math.floor(rand() * table.length)]
}

function makeItem(rand, x, z) {
  const far = Math.min(1, (NEAR_Z - z) / LAND_D)
  const kind = pickKind(rand, distToPath(x, z), far)
  /**
   * ของไกลถูกขยายชดเชย ไม่งั้นหายไปเลยเมื่ออยู่ท้ายผืน — แต่ชดเชยไม่เต็มร้อย
   * ยังต้องเล็กกว่าของใกล้อยู่บ้าง ไม่งั้นความลึกหายหมด
   */
  const tree = kind === 'cone' || kind === 'round'
  const base = tree ? 0.8 + rand() * 1.0 : 0.35 + rand() * 0.7
  /**
   * ความต่างรายต้น: หันคนละมุม เอียงคนละนิด อ้วน/ผอมไม่เท่ากัน และใบคนละเฉด
   *
   * ทรงของประดับมีไม่กี่แบบ ถ้าวางตรงเป๊ะทุกต้นแล้วสีเดียวกันหมด ทุ่งจะอ่านเป็นของชิ้นเดียว
   * ที่ถูกก๊อบวาง การสุ่มสี่อย่างนี้ถูกกว่าการปั้นทรงเพิ่ม และให้ความหลากหลายที่ตาจับได้จริง
   */
  return {
    kind,
    x,
    z,
    s: base * (1 + far * 0.55),
    yaw: rand() * Math.PI * 2,
    tiltX: (rand() * 2 - 1) * 0.09,
    tiltZ: (rand() * 2 - 1) * 0.09,
    // สัดส่วนสูง/กว้างรายต้น — ต่ำกว่า 1 = อ้วนเตี้ย, สูงกว่า 1 = สูงชะลูด
    slim: 0.82 + rand() * 0.45,
    squash: 0.55 + rand() * 0.3,
    // ความหน่วงส่วนตัว 0..1 — สุ่มคงที่ตาม seed พืชจึงไม่ผุดพร้อมกันเป๊ะและผังไม่เปลี่ยนทุกเฟรม
    jitter: rand(),
    mat: tree
      ? FOLIAGE_MATS.leaves[Math.floor(rand() * FOLIAGE_MATS.leaves.length)]
      : kind === 'bush'
        ? FOLIAGE_MATS.grass[Math.floor(rand() * 4)]
        : undefined,
  }
}

/** จุดนี้วางของได้ไหม — ห้ามทับทางเดินและห้ามทับเสากังหัน */
function freeSpot(x, z, margin = 3.2) {
  if (distToPath(x, z) < margin) return false
  return !TURBINE_XZ.some((t) => (t[0] - x) ** 2 + (t[1] - z) ** 2 < 20)
}

/** ระยะกำลังสองถึงของที่ใกล้ที่สุดในผัง — ตัวชี้ว่า "ตรงนี้ว่างแค่ไหน" */
function nearestSq(list, x, z) {
  let best = Infinity
  for (const o of list) {
    const d = (o.x - x) ** 2 + (o.z - z) ** 2
    if (d < best) best = d
  }
  return best
}

function useScatter(seed, count) {
  return useMemo(() => {
    const rand = makeRandom(seed)
    const out = []
    const halfW = LAND_W / 2 - 4
    let guard = 0
    while (out.length < count && guard < count * 60) {
      guard += 1
      // เลือกผู้สมัครที่ "ว่างที่สุด" — ยิ่งของเยอะ ยิ่งต้องมองหลายจุดกว่าจะเจอที่ว่างจริง
      let bx = 0
      let bz = 0
      let bestGap = -1
      for (let k = 0; k < 10; k++) {
        const x = (rand() * 2 - 1) * halfW
        const z = NEAR_Z - rand() * (LAND_D - 4)
        if (!freeSpot(x, z)) continue
        const gap = out.length ? nearestSq(out, x, z) : Infinity
        if (gap > bestGap) {
          bestGap = gap
          bx = x
          bz = z
        }
      }
      if (bestGap < 0) continue
      const anchor = makeItem(rand, bx, bz)
      out.push(anchor)

      // กอ: ต้นใหญ่ราวหนึ่งในสามมีลูกเล็กเกาะรอบ ๆ ระยะไม่เกินสองเท่าของขนาดตัวเอง
      const big = anchor.kind === 'cone' || anchor.kind === 'round'
      if (big && rand() < 0.34) {
        const n = 1 + Math.floor(rand() * 3)
        for (let k = 0; k < n && out.length < count; k++) {
          const a = rand() * Math.PI * 2
          const r = anchor.s * (1.3 + rand() * 1.6)
          const x = bx + Math.cos(a) * r
          const z = bz + Math.sin(a) * r
          if (Math.abs(x) > halfW || z > NEAR_Z || z < NEAR_Z - LAND_D) continue
          if (!freeSpot(x, z, 2.4)) continue
          const child = makeItem(rand, x, z)
          child.s *= 0.55 + rand() * 0.3
          out.push(child)
        }
      }
    }
    return out
  }, [seed, count])
}

/** ที่พักตำแหน่งตัวละครในพิกัดของทุ่ง — ตัวเดียวใช้ซ้ำทุกเฟรม ไม่สร้าง Vector3 ในลูป */
const SPROUT_WORLD = new THREE.Vector3()
/** ที่พักคำนวณเมทริกซ์ของ instance — ตัวเดียวใช้ซ้ำทุกชิ้นทุกเฟรม */
const ITEM_OBJ = new THREE.Object3D()
const LUMP_OBJ = new THREE.Object3D()
const OUT_MAT = new THREE.Matrix4()

/**
 * จัดของทั้งทุ่งเป็นกลุ่ม instance — หนึ่งกลุ่มต่อ (ชนิด × ชิ้นส่วน × วัสดุ)
 *
 * ทุ่งมีของราวร้อยชิ้น ชิ้นละ 1–7 ก้อน = mesh สามร้อยกว่าใบ ซึ่งเท่ากับ draw call สามร้อยกว่า
 * ครั้งต่อเฟรม (มากกว่าครึ่งของทั้งฉาก) ทุกก้อนใช้ลูกกลม/ทรงกระบอกใบเดียวกันอยู่แล้ว
 * ต่างกันแค่เมทริกซ์ จึงยุบเป็น InstancedMesh ได้ตรง ๆ — เหลือราวยี่สิบครั้ง
 *
 * แยกตามวัสดุด้วยเพราะ instance ชุดหนึ่งใช้วัสดุได้ใบเดียว (พุ่ม/ใบไม้สุ่มเฉดรายต้น
 * จึงกลายเป็นหลายกลุ่ม — ยังนับเป็นหลักสิบ ไม่ใช่หลักร้อย)
 */
function useInstanceGroups(items) {
  return useMemo(() => {
    const groups = new Map()
    items.forEach((it, i) => {
      const lumps = LUMPS[it.kind]
      if (!lumps) return
      lumps.forEach((l, li) => {
        const mat = lumpMaterial(l, it.mat)
        const key = `${it.kind}:${li}:${mat.uuid}`
        let g = groups.get(key)
        if (!g) {
          g = { key, geo: l.geo === 's' ? SPHERE : CYL, mat, lump: l, idx: [] }
          groups.set(key, g)
        }
        g.idx.push(i)
      })
    })
    return [...groups.values()]
  }, [items])
}

function Sprouts({ items, lead, dur, stagger, enabled }) {
  const root = useRef()
  const groups = useInstanceGroups(items)
  const refs = useRef([])
  /** จุดเริ่ม, ทิศที่ตัวละครวิ่ง (+1/-1 ตามแกน x ของทุ่ง) และหัวคลื่นที่ไกลสุดที่เคยไปถึง */
  const startX = useRef(null)
  const dir = useRef(0)
  const front = useRef(0)
  /** ความคืบหน้าการโตของแต่ละต้น 0..1 — เดินด้วยเวลา ไม่ใช่ระยะของหัวคลื่น */
  const grown = useRef(new Float32Array(items.length))
  if (grown.current.length !== items.length) grown.current = new Float32Array(items.length)
  /** ท่าตั้งต้นของแต่ละต้นบนผิว — คำนวณครั้งเดียว ไม่ใช่ทุกเฟรม (heightAt เป็นผลรวมไซน์) */
  const base = useMemo(
    () => items.map((p) => ({ y: heightAt(p.x, p.z), ...p })),
    [items],
  )

  useFrame((_, dt) => {
    const g = root.current
    if (!g) return
    const t = getTuner()
    const off = !enabled || t.en < 0.5
    if (!off) {
      SPROUT_WORLD.set(ridePose.wx, ridePose.wy, ridePose.wz)
      g.worldToLocal(SPROUT_WORLD)
      const x = SPROUT_WORLD.x
      // อินโทรถูกเล่นใหม่ (ความคืบหน้ากลับไปต้นทาง) = ล้างทุกอย่าง ทุ่งกลับมาโล่ง
      if (ridePose.p < 0.02) {
        startX.current = x
        dir.current = 0
        front.current = x
        grown.current.fill(0)
      }
      if (startX.current === null) startX.current = x
      /**
       * ทิศทางอ่านจากการเคลื่อนที่จริง ไม่ได้ฟิกซ์ไว้
       *
       * ตัวละครไถลไปทางไหนขึ้นกับเส้นทางที่จูนไว้ ถ้าฟิกซ์ว่า "ซ้ายไปขวา" แล้ววันหนึ่ง
       * เส้นกลับทิศ พืชจะขึ้นพร้อมกันหมดตั้งแต่เฟรมแรก (หัวคลื่นอยู่เลยปลายทุ่งไปแล้ว)
       */
      if (dir.current === 0 && Math.abs(x - startX.current) > 1) {
        dir.current = Math.sign(x - startX.current)
        front.current = startX.current
      }
      if (dir.current !== 0) front.current = dir.current > 0 ? Math.max(front.current, x) : Math.min(front.current, x)
    }

    const d = dir.current || 1
    const armed = off || dir.current !== 0
    const k = grown.current
    let moved = false
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      /**
       * หัวคลื่นเป็นแค่ "สัญญาณปล่อยตัว" ไม่ใช่ตัวคุมขนาด
       *
       * ตัวละครออกตัวแบบเร่งชี้กำลัง หัวคลื่นจึงกวาดข้ามทุ่งในเสี้ยววินาที ถ้าเอาระยะของ
       * หัวคลื่นมาคูณเป็นขนาดโดยตรง พืชทั้งแถบจะผุดพร้อมกันในเฟรมเดียว (พึ่บ)
       * ปล่อยตัวแล้วให้แต่ละต้นโตด้วยนาฬิกาของตัวเอง จังหวะจึงคงที่ไม่ว่าตัวละครจะเร็วแค่ไหน
       * และ stagger (สุ่มคงที่จากตำแหน่ง) ทำให้ไม่ขึ้นพร้อมกันเป๊ะทั้งแถว
       */
      const passed = off || (armed && (front.current - it.x) * d + lead >= 0)
      const before = k[i]
      if (passed && k[i] < 1) k[i] = Math.min(1, k[i] + dt / Math.max(0.05, dur + it.jitter * stagger))
      if (off) k[i] = 1
      if (k[i] !== before) moved = true
    }
    // ทุกต้นโตเต็มแล้วและไม่มีอะไรเปลี่ยน = ไม่ต้องเขียนเมทริกซ์ใหม่ทั้งทุ่งทุกเฟรม
    if (!moved && refs.current[0] && refs.current[0].userData.primed) return

    for (let gi = 0; gi < groups.length; gi++) {
      const grp = groups[gi]
      const im = refs.current[gi]
      if (!im) continue
      const l = grp.lump
      for (let j = 0; j < grp.idx.length; j++) {
        const i = grp.idx[j]
        const it = base[i]
        const u = k[i]
        // เข้าเป้าแบบเลยนิดแล้วดีดกลับ บนเส้น smoothstep — ต้นไม้ "ดันขึ้น" ไม่ใช่ถูกสวิตช์เปิด
        const e = u <= 0 ? 0 : outBack(u * u * (3 - 2 * u), 1.25)
        ITEM_OBJ.position.set(it.x, it.y, it.z)
        ITEM_OBJ.rotation.set(it.tiltX, it.yaw, it.tiltZ)
        ITEM_OBJ.scale.set(e, e * (0.7 + 0.3 * u) * it.slim, e)
        ITEM_OBJ.updateMatrix()
        const s = it.s
        LUMP_OBJ.position.set(l.pos[0] * s, l.pos[1] * s, l.pos[2] * s)
        LUMP_OBJ.scale.set(l.scale[0] * s, l.scale[1] * s * (l.squashY ? it.squash : 1), l.scale[2] * s)
        LUMP_OBJ.updateMatrix()
        OUT_MAT.multiplyMatrices(ITEM_OBJ.matrix, LUMP_OBJ.matrix)
        im.setMatrixAt(j, OUT_MAT)
      }
      im.instanceMatrix.needsUpdate = true
      im.userData.primed = true
    }
  })

  return (
    <group ref={root}>
      {groups.map((g, i) => (
        <instancedMesh
          key={g.key}
          ref={(el) => {
            refs.current[i] = el
          }}
          args={[g.geo, g.mat, g.idx.length]}
          /* กล่องขอบเขตของ instance คิดจากเมทริกซ์ที่เขียนทีหลัง — ปล่อยให้คัลลิงตัดสินเองแล้ว
             ทั้งทุ่งหายตอนกล้องแพน */
          frustumCulled={false}
        />
      ))}
    </group>
  )
}

export function Landscape({
  spin = 0.5,
  cloudSpeed = 0.25,
  seed = 7,
  count = 90,
  grow = true,
  growLead = 26,
  growDur = 0.7,
  growStagger = 0.6,
  ...rest
}) {
  const sky = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 128
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, SKY_TOP)
    g.addColorStop(1, SKY_LOW)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4, 128)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useDisposable(sky)

  const scatter = useScatter(seed, Math.round(count))

  return (
    <group {...rest}>
      {/* ฟ้า — แผ่นตั้งไกลสุด ปิดท้ายผืนพื้นพอดี ไม่ให้เห็นขอบตาราง */}
      <mesh position={[0, 10, NEAR_Z - LAND_D - 1]}>
        <planeGeometry args={[LAND_W * 2.4, 54]} />
        <meshBasicMaterial map={sky} toneMapped={false} />
      </mesh>
      {/* ดวงอาทิตย์ต่ำเหนือขอบฟ้า — แบนได้ ระยะนั้นไม่มีใครอ่านออกว่าเป็นทรงกลม */}
      <mesh position={[-3, 2.4, NEAR_Z - LAND_D - 0.8]}>
        <circleGeometry args={[3.4, 40]} />
        <meshBasicMaterial color={SUN} toneMapped={false} />
      </mesh>

      <Cloud x={-18} y={10} z={-22} s={0.7} speed={cloudSpeed} />
      <Cloud x={5} y={12} z={-24} s={0.9} speed={cloudSpeed * 0.72} />
      <Cloud x={21} y={9} z={-20} s={0.58} speed={cloudSpeed * 1.24} />

      <Terrain />
      <Path />

      {TURBINES.map(([x, z, h, k, phase], i) => (
        <Turbine key={i} x={x} z={z} h={h} speed={spin * k} phase={phase} yaw={0.15 * (i % 3) - 0.15} />
      ))}

      <Sprouts items={scatter} lead={growLead} dur={growDur} stagger={growStagger} enabled={grow} />
    </group>
  )
}
