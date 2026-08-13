import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { gradientTexture, makeRandom } from './utils'
import { hillY, FRONT_HILL } from './Terrain'
import { blobGeometry } from './Blob'

/** วางของให้ฐานแตะผิวเนินหน้าพอดี */
const onHill = (x, z, sink = 0) => [x, hillY(x, z) - sink, z]

const UP = new THREE.Vector3(0, 1, 0)

/**
 * วางของให้ "ตั้งบนผิวโดม" จริง: ตำแหน่งบนผิว + quaternion หมุนแกน +Y
 * ให้ตรง normal ของ ellipsoid ณ จุดนั้น (ของแบนจะแนบผิวทุกความชัน)
 */
function hillAlign(x, z, lift = 0) {
  const { R, sx, sy, cy } = FRONT_HILL
  const y = hillY(x, z)
  const n = new THREE.Vector3(
    x / ((sx * R) * (sx * R)),
    (y - cy) / ((sy * R) * (sy * R)),
    z / (R * R),
  ).normalize()
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, n)
  return { position: [x + n.x * lift, y + n.y * lift, z + n.z * lift], quaternion }
}

/**
 * texture พุ่ม: ไล่เฉดบนอ่อน-ล่างเข้ม + เส้น doodle วาดมือสีเข้มบาง ๆ
 * ใช้กับ planar UV -> เส้นเป็นลายแบนบนผิวแบบภาพ ref ไม่ใช่ท่อนูน 3D
 */
function doodleTexture({ top, bottom, line, seed = 1, strokes = 3, vertical = false }) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, 512)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 512)

  const rnd = makeRandom(seed)
  ctx.strokeStyle = line
  ctx.globalAlpha = 0.8
  ctx.lineCap = 'round'
  for (let i = 0; i < strokes; i++) {
    ctx.lineWidth = 7 + rnd() * 4
    ctx.beginPath()
    if (vertical) {
      const x = 130 + rnd() * 250
      const y0 = 40 + rnd() * 110
      ctx.moveTo(x, y0)
      ctx.bezierCurveTo(
        x - 35 - rnd() * 40, y0 + 110,
        x + 35 + rnd() * 40, y0 + 230,
        x - 10 + rnd() * 20, y0 + 340,
      )
    } else {
      // พุ่มจมในเนิน เห็นเฉพาะแถบบนของ sphere -> เส้นต้องอยู่โซนบนของ canvas
      const y = 45 + rnd() * 120
      ctx.moveTo(60 + rnd() * 90, y)
      ctx.bezierCurveTo(
        180, y - 35 - rnd() * 45,
        330, y + 25 + rnd() * 55,
        390 + rnd() * 70, y - 15 + rnd() * 35,
      )
    }
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/** sphere ที่ UV ถูกเขียนใหม่เป็น planar (มองจากหน้า) — texture เลยแปะหน้าพุ่มตรง ๆ */
function planarSphereGeo() {
  const g = new THREE.SphereGeometry(1, 28, 20)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / 2 + 0.5, pos.getY(i) / 2 + 0.5)
  }
  uv.needsUpdate = true
  return g
}

/** เฉดสีพุ่มตาม palette #008168 / #00B48F / #4FCDA6 */
const MOUND_SHADE = {
  light: { top: '#3CCBA5', bottom: '#008A6C', line: '#005E49' },
  dark: { top: '#17A186', bottom: '#005843', line: '#003D2F' },
}

/**
 * พุ่มไม้ = ก้อนเมฆ (ก้อนกลาง + ข้าง 2 + ปุ่มบน 2 แบบ Cloud ใน Sky)
 * จมลงเนินให้เห็นแค่ส่วนบน
 */
const BUSH_BLOBS = [
  [0, 0, 0, 1],
  [-1.05, -0.18, 0, 0.7],
  [1.0, -0.2, 0, 0.72],
  [0.42, 0.34, 0.1, 0.66],
  [-0.5, 0.28, -0.1, 0.6],
]

/** geometry พุ่มหลอมเป็นก้อนเดียว — สร้างครั้งเดียว ใช้ร่วมกันทุกกอ */
let bushGeoCache = null
function bushGeo() {
  if (!bushGeoCache) bushGeoCache = blobGeometry(BUSH_BLOBS)
  return bushGeoCache
}

function BushCloud({ position, scale = 1, dark = false, seed = 20 }) {
  const geo = useMemo(() => bushGeo(), [])
  const shade = dark ? MOUND_SHADE.dark : MOUND_SHADE.light
  const tex = useMemo(
    () => doodleTexture({ ...shade, seed: seed * 13 + 1, strokes: 2 }),
    [shade, seed],
  )
  return (
    <mesh geometry={geo} position={position} scale={scale * 2} castShadow receiveShadow>
      <meshStandardMaterial map={tex} roughness={1} metalness={0} />
    </mesh>
  )
}

/** พุ่มแท่งสูงทรงแคปซูล + ลายเส้นตั้ง (ref ฝั่งขวา) */
function TallBush({ position, scale = 1, dark = false, seed = 5 }) {
  const geo = useMemo(() => planarSphereGeo(), [])
  const tex = useMemo(() => {
    const shade = dark ? MOUND_SHADE.dark : MOUND_SHADE.light
    return doodleTexture({ ...shade, seed, strokes: 3, vertical: true })
  }, [dark, seed])
  return (
    <mesh geometry={geo} position={position} scale={[0.85 * scale, 1.9 * scale, 0.85 * scale]} castShadow receiveShadow>
      <meshStandardMaterial map={tex} roughness={1} metalness={0} />
    </mesh>
  )
}

/**
 * ใบไม้ใหญ่หน้ากล้อง — layer 08 มุมล่างของเฟรม
 */
/**
 * ผิวใบ 3D: กริดพาราเมตริก ทรงหยดน้ำ พับเป็นสัน V ตามเส้นกลางใบ + แอ่นตามยาว ปลายงอน
 * u: -1..1 (ซ้าย-ขวา), v: 0..1 (โคน-ปลาย)
 */
function leafPoint(u, v, out) {
  const w = 0.72 * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.8)), 0.9)
  out.x = u * w
  out.y = v * 2.3
  out.z = -0.34 * Math.abs(u) * w + 0.15 * Math.sin(v * Math.PI) + 0.28 * v * v
  return out
}

function makeLeafGeometry(segU = 14, segV = 26) {
  const verts = []
  const uvs = []
  const idx = []
  const p = new THREE.Vector3()
  for (let j = 0; j <= segV; j++) {
    const v = j / segV
    for (let i = 0; i <= segU; i++) {
      const u = (i / segU) * 2 - 1
      leafPoint(u, v, p)
      verts.push(p.x, p.y, p.z)
      uvs.push(i / segU, v)
    }
  }
  const row = segU + 1
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * row + i
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/**
 * texture ใบ: ไล่เฉดโคนเข้ม-ปลายสว่าง + เส้นกลางใบวาดเป็น stroke แบน
 * แบบเดียวกับเส้น doodle บนพุ่ม (ไม่ใช่ tube 3D)
 */
const leafTexCache = new Map()
function leafTexture(color, vein) {
  const key = color + vein
  if (leafTexCache.has(key)) return leafTexCache.get(key)
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const col = new THREE.Color(color)
  const base = col.clone().lerp(new THREE.Color('#00251C'), 0.35)
  const tip = col.clone().lerp(new THREE.Color('#BFF5E2'), 0.28)
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, `#${tip.getHexString()}`)
  g.addColorStop(1, `#${base.getHexString()}`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)

  ctx.strokeStyle = vein
  ctx.globalAlpha = 0.85
  ctx.lineCap = 'round'
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.moveTo(128, 238)
  ctx.bezierCurveTo(122, 180, 132, 110, 128, 30)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  leafTexCache.set(key, tex)
  return tex
}

let leafGeoCache = null

function BigLeaf({ position, rotation = [0, 0, 0], scale = 1, color = '#008168', vein = '#00432F' }) {
  const geo = useMemo(() => {
    if (!leafGeoCache) leafGeoCache = makeLeafGeometry()
    return leafGeoCache
  }, [])
  const tex = useMemo(() => leafTexture(color, vein), [color, vein])
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial map={tex} roughness={1} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/**
 * ต้นแฉกแท่ง — แคปซูลปลายมนกางรัศมี โผล่หลังพุ่ม (ref มุมซ้ายบน)
 */
/**
 * ต้นแฉก: แฉกทุกอันนิ่งและใช้ material เดียวกัน — หลอมเป็น geometry ก้อนเดียว
 * ตอนแยก mesh มันกิน 14 draw call ต่อกอ แล้วโดนนับซ้ำอีกรอบตอน render shadow map
 * ทรงเหมือนกันทุกกอ (ต่างแค่ scale/สี) เลย cache ตามจำนวนแฉก
 */
const spikeGeoCache = new Map()
function spikeFanGeo(blades) {
  let g = spikeGeoCache.get(blades)
  if (g) return g
  const start = -1.25
  const span = 2.5
  const parts = [new THREE.SphereGeometry(0.45, 14, 10)]
  const m = new THREE.Matrix4()
  for (let i = 0; i < blades; i++) {
    const a = start + (i / (blades - 1)) * span
    const len = 0.8 + 0.3 * Math.sin((i / (blades - 1)) * Math.PI)
    const blade = new THREE.CapsuleGeometry(0.11, len, 4, 8)
    blade.applyMatrix4(m.makeTranslation(0, 0.38 + len / 2, 0).premultiply(new THREE.Matrix4().makeRotationZ(-a)))
    parts.push(blade)
  }
  g = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  spikeGeoCache.set(blades, g)
  return g
}

function SpikeFan({ position, scale = 1, color = '#008168', blades = 13 }) {
  const geo = useMemo(() => spikeFanGeo(blades), [blades])
  return (
    <mesh geometry={geo} position={position} scale={scale} castShadow>
      <meshStandardMaterial color={color} roughness={1} metalness={0} />
    </mesh>
  )
}

/**
 * ดอก splat แบนแปะบนผิวโดม — กลีบมนกางรัศมีรอบวง (ref: ดอกเหลืองข้างเท้าตัวละคร)
 */
function PetalSplat({ position, quaternion, scale = 1, color = '#F7C55F', petals = 7 }) {
  // ตั้งขึ้นจากพื้น: กลีบอยู่ระนาบ XY (หันกล้อง) ยกใจกลางให้กลีบล่างแตะพื้นพอดี
  return (
    <group position={position} quaternion={quaternion} scale={scale}>
      <group position={[0, 0.78, 0]}>
        {Array.from({ length: petals }, (_, i) => {
          const a = (i / petals) * Math.PI * 2
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0]}
              rotation={[0, 0, a - Math.PI / 2]}
              scale={[1, 1, 0.35]}
            >
              <capsuleGeometry args={[0.17, 0.34, 4, 10]} />
              <meshStandardMaterial color={color} roughness={1} metalness={0} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

const flatFanCache = new Map()
function flatFanGeo(blades) {
  let g = flatFanCache.get(blades)
  if (g) return g
  const r0 = 0.14
  const r1 = 1.0
  const h0 = 0.035
  const h1 = 0.16
  const sh = new THREE.Shape()
  sh.moveTo(-h0, r0)
  sh.lineTo(-h1, r1 - 0.14)
  sh.quadraticCurveTo(0, r1 + 0.07, h1, r1 - 0.14)
  sh.lineTo(h0, r0)
  sh.quadraticCurveTo(0, r0 - 0.03, -h0, r0)
  const blade = new THREE.ExtrudeGeometry(sh, {
    depth: 0.06,
    bevelEnabled: true,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    bevelSegments: 3,
    curveSegments: 12,
  })
  const m = new THREE.Matrix4()
  const parts = Array.from({ length: blades }, (_, i) => {
    const a = 0.08 + (i / (blades - 1)) * (Math.PI - 0.16)
    return blade.clone().applyMatrix4(m.makeRotationZ(a - Math.PI / 2))
  })
  g = mergeGeometries(parts)
  blade.dispose()
  for (const p of parts) p.dispose()
  flatFanCache.set(blades, g)
  return g
}

/**
 * แฉกครึ่งวงแบนแปะบนผิว — แท่งบางกางรัศมี (ref: แฉกส้มบนพื้นหน้าตัวละคร)
 */
function FlatFan({ position, quaternion, scale = 1, color = '#F58A63', blades = 9 }) {
  // กลีบ = แผ่น wedge สามเหลี่ยมปลายมน กางชิดกันเป็นพัดครึ่งวงทึบ (แบบ ref)
  // กลีบทั้งพัดนิ่งและสีเดียวกัน — หลอมก้อนเดียว (แยก mesh = 9 draw call ต่อพัด)
  const geo = useMemo(() => flatFanGeo(blades), [blades])
  return (
    <group position={position} quaternion={quaternion} scale={scale}>
      <ShadowBlob w={2.4} l={0.75} dz={0.35} opacity={0.32} />
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color={color} roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}

/** กระจุกปุ่มนูน — ก้อนกลมไร้ก้าน 2-4 ลูกเกาะกลุ่มบนผิวโดม */
function NubCluster({ position, scale = 1, color = '#F2653F' }) {
  const nubs = [
    [0, 0, 0, 0.22],
    [0.3, -0.03, 0.1, 0.16],
    [-0.26, -0.04, -0.06, 0.14],
    [0.08, -0.02, -0.24, 0.12],
  ]
  return (
    <group position={position} scale={scale}>
      {nubs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y + r * 0.55, z]} castShadow receiveShadow>
          <sphereGeometry args={[r, 16, 12]} />
          <meshStandardMaterial color={color} roughness={1} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}

/** เงา blob นุ่มแนบผิว — แดดอยู่หลัง เงาเลยยืดมาทางกล้อง (+z local) */
let shadowTexCache = null
function shadowTex() {
  if (!shadowTexCache) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64)
    g.addColorStop(0, 'rgba(60, 20, 30, 0.85)')
    g.addColorStop(0.6, 'rgba(60, 20, 30, 0.4)')
    g.addColorStop(1, 'rgba(60, 20, 30, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    shadowTexCache = new THREE.CanvasTexture(c)
  }
  return shadowTexCache
}

// plane 1x1 ก้อนเดียวใช้ร่วมทุกเงา — <planeGeometry> ใน JSX ปั้นใหม่ทุก instance
const QUAD = new THREE.PlaneGeometry(1, 1)

function ShadowBlob({ w = 0.6, l = 0.4, dz = 0.2, opacity = 0.3 }) {
  return (
    <mesh
      geometry={QUAD}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.02, dz]}
      scale={[w, l, 1]}
      renderOrder={1}
    >
      <meshBasicMaterial map={shadowTex()} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

// ก้อนกรวดทุกลูกเป็นทรงเดียวกัน ต่างแค่ scale/สี — geometry ก้อนเดียวพอ
const PEBBLE_GEO = new THREE.SphereGeometry(0.22, 16, 12)

function Pebble({ position, quaternion, scale = 1, color }) {
  return (
    <group position={position} quaternion={quaternion}>
      <ShadowBlob w={0.85 * scale} l={0.5 * scale} dz={0.2 * scale + 0.06} />
      <mesh geometry={PEBBLE_GEO} scale={[scale, scale * 0.58, scale]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}

export function Foliage() {
  return (
    <group>
      {/* layer 06 — พุ่มทรงเมฆจมครึ่ง: หลังเข้มสูงกว่า หน้าอ่อนเตี้ยกว่า */}
      {/* อยู่หลังโดม (z ลึกกว่าสัน) ให้สันโดมบังฐานพุ่ม */}
      <BushCloud position={onHill(-5.0, -6.2, 0.45)} scale={1.35} dark seed={21} />
      <BushCloud position={onHill(2.5, -6.4, 0.45)} scale={1.5} dark seed={23} />
      <BushCloud position={onHill(7.0, -5.8, 0.4)} scale={1.3} dark seed={25} />
      <BushCloud position={onHill(-7.5, -4.6, 0.6)} scale={1.25} seed={22} />
      <BushCloud position={onHill(-1.0, -4.4, 0.7)} scale={1.3} seed={24} />
      <BushCloud position={onHill(6.0, -4.5, 0.6)} scale={1.25} seed={26} />
      <SpikeFan position={onHill(-3.3, -6.8, -1.1)} scale={1.1} />
      <SpikeFan position={onHill(-8.0, -5.2, -0.7)} scale={0.8} color="#009B7C" />

      {/* พุ่มแท่งสูงลายเส้นตั้ง ฝั่งขวาแบบ ref */}
      <TallBush position={[7.9, -1.9, -4.6]} scale={1.2} dark seed={11} />
      <TallBush position={[9.0, -2.3, -4.0]} scale={1.45} seed={12} />
      <TallBush position={[10.2, -2.0, -3.2]} scale={1.0} dark seed={13} />

      {/* layer 07 — ของบนโดมแบบ ref: แฉกส้ม + ดอกเหลือง + ปุ่มครึ่งวงเดี่ยวกระจายห่าง ๆ */}
      <FlatFan {...hillAlign(-1.6, 2.2, 0.04)} scale={0.8} color="#F2653F" />

      <Pebble {...hillAlign(-5.2, 1.6)} scale={0.95} color="#35C4A9" />
      <Pebble {...hillAlign(-4.0, 0.9)} scale={0.8} color="#F2A0DC" />
      <Pebble {...hillAlign(-3.2, 2.6)} scale={0.75} color="#C89BF2" />
      <Pebble {...hillAlign(-0.6, 3.2)} scale={0.8} color="#E0B3F2" />
      <Pebble {...hillAlign(3.4, 2.7)} scale={0.95} color="#35C4A9" />
      <Pebble {...hillAlign(5.0, 1.7)} scale={1.1} color="#4ECFB7" />
      <Pebble {...hillAlign(4.2, 0.8)} scale={0.75} color="#C89BF2" />
      <Pebble {...hillAlign(-2.4, 1.0)} scale={0.7} color="#F7C55F" />


      {/* layer 08 — กอใบขนาบสองมุมล่าง เล็กลงตามสัดส่วน ref */}
      {/* กอใบขนาบสองมุมล่าง — โคนจมนอกเฟรม ปลายชี้เข้ากลาง */}
      <BigLeaf position={[-3.35, 0.3, 6.0]} scale={0.62} rotation={[0.1, 0.3, -0.7]} />
      <BigLeaf position={[-3.7, 0.15, 5.7]} scale={0.48} rotation={[0.1, 0.2, -0.25]} color="#00B48F" vein="#005741" />
      <BigLeaf position={[-3.05, 0.05, 5.45]} scale={0.36} rotation={[0.05, 0, -1.05]} color="#006B57" vein="#003429" />
      <BigLeaf position={[3.4, 0.28, 6.0]} scale={0.6} rotation={[0.1, -0.3, 0.7]} />
      <BigLeaf position={[3.75, 0.13, 5.7]} scale={0.46} rotation={[0.1, -0.2, 0.25]} color="#00B48F" vein="#005741" />
      <BigLeaf position={[3.1, 0.03, 5.45]} scale={0.35} rotation={[0.05, 0, 1.05]} color="#006B57" vein="#003429" />
    </group>
  )
}
