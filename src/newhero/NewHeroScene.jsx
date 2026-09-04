import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Grid, Lightformer, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { Mascot } from '@/joespresso/scene/Mascot'
import { useDisposable, makeRandom, gradientTexture, LOW_END, damp, clamp, addCel, makeCelUniforms } from '@/joespresso/scene/utils'
import { DEFAULTS, getTuner, useTuner } from './tuner'
import { roundedBoxGeo } from './geo'
import { Rider } from './Rider'
import { DAY_SKY } from '@/joespresso/scene/Sky'
import { Globe } from './Globe'
import { StackedWindows } from './StackedWindows'
import { Tetris } from './Tetris'
import { CameraFX } from './CameraFX'
import { Switch } from './Switch'
import { Cursor } from './Cursor'
import { Appear } from './Appear'
import { IntroClock, introTime, outBack as introBack } from './intro'
import { Entrance, entranceBlend, entranceSample, entranceU } from './Entrance'
import { portalRide } from './portalRide'
import { entranceLift } from './entranceLift'

/**
 * ฉาก hero ใหม่ — "โต้คลื่นบนริบบิ้นหมากรุก" (คอมพ์ 12739:337)
 *
 * ภาพ ref เป็นชีทชิ้นส่วน + ภาพฉากประกอบเสร็จ: ตัวละครยืนเซิร์ฟบอร์ดไถลไปตามริบบิ้น
 * ลายหมากรุกที่ลอยบิดอยู่กลางอากาศ รอบตัวเป็นของลอยตามธีม (ป้ายสัญญาณ, ไอคอนแอป,
 * ไพ่, โดนัทลายลูกกวาด, เพชร, หมากรุก, บล็อก, คอนเฟตติ) บนพื้นไล่สี teal→เขียว
 * มีแผงโค้งสีครีมเรียงเป็นฉากหลังชั้นกลาง
 *
 * ทุกชิ้นปั้นในโค้ด ไม่มี GLB ใหม่ — ภาษาเดียวกับ mascot (ทรงเรขาคณิต สีจัดจ้าน แสงแบน)
 * ตัวละครใช้ Mascot ตัวเดิมท่า skydive (แขนกาง เข่าย่อ) ซึ่งอ่านเป็นท่าทรงตัวบนบอร์ดพอดี
 *
 * ของทุกชิ้นลอยเลี้ยงตัวช้า ๆ คนละเฟส/ความถี่ (ไม่เป็นเท่าตัวกัน — ผลรวมไม่วนซ้ำให้ตาจับ)
 * กล้องนิ่ง มี parallax ตามเมาส์นิด ๆ ทั้งฉากจึง "หายใจ" โดยไม่มีอะไรแย่งสายตา
 */

/* ---------- จานสี ----------
   ชุดน้ำเงินอ่านจากคอมพ์ 12739:158699 โดยสุ่มพิกเซล: พื้น #265ada / หน้าต่าง #3c6bde */
const BG_TOP = '#2f66e2'
const BG_MID = '#265ada'
const BG_BOT = '#1e4dc4'
const CREAM = '#3c6bde'
/** เลขที่ใช้ทำเครื่องหมายพื้นที่ "ในหน้าต่าง" บน stencil buffer */
const STENCIL_REF = 1

/** สีเนื้อหน้าต่าง — ขาวล้วน ตัดกับพื้นน้ำเงินของหน้า */
const INNER_BG = '#ffffff'
const GREEN_DEEP = '#1d4a38'
const GREEN_MAIN = '#3cb464'
const GREEN_SOFT = '#8fd98a'
const ORANGE = '#f2793b'
const PURPLE = '#b44be0'
const BLUE = '#4f7df9'
const RED = '#e8492e'

/* ---------- textures (canvas วาดครั้งเดียว ระดับโมดูล — แชร์ทุก instance ห้าม dispose) ---------- */

/**
 * ผิวถนน = ตารางคอมมิตแบบ GitHub
 *
 * 7 แถวเพราะเป็นวันในสัปดาห์ ไม่ใช่เลขที่เลือกให้พอดีรูป — ปูซ้ำตามยาวริบบิ้นแล้ว
 * แต่ละคอลัมน์จึงอ่านเป็นสัปดาห์ที่ไล่ออกไป เหมือนหน้าโปรไฟล์จริง
 *
 * ระดับสีสุ่มด้วยเมล็ดคงที่ (makeRandom) ไม่ใช่ Math.random — เทกซ์เจอร์ต้องออกมา
 * เหมือนเดิมทุกครั้งที่โหลด ไม่งั้นหน้าตาถนนเปลี่ยนไปทุกรีเฟรชโดยไม่มีใครสั่ง
 */
/**
 * ชุดสีธีม dark dimmed ของ GitHub — เทาอมน้ำเงินนุ่ม ไม่ใช่ดำสนิทแบบธีม dark
 * ช่องระดับ 0 ต้องต่างจากสีพื้นเสมอ ไม่งั้นวันที่ไม่มีคอมมิตหายไปกับพื้นจนไม่เห็นเป็นตาราง
 */
const HEAT_BG = '#22272e'
const HEAT_LEVELS = ['#2d333b', '#1b4721', '#2f6b36', '#478b48', '#63c363']
/** จำนวนแถว = วันในสัปดาห์ */
const HEAT_ROWS = 7

function heatmapTile(size = 1024) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = HEAT_BG
  ctx.fillRect(0, 0, size, size)

  const cell = size / HEAT_ROWS
  // ช่องไฟกว้างขึ้นเล็กน้อย — ขอบช่องที่ชัดคือสิ่งที่ทำให้ตารางอ่านออกตอนอยู่ไกล
  const pad = cell * 0.16
  const box = cell - pad * 2
  const r = box * 0.24
  const rnd = makeRandom(7)
  for (let y = 0; y < HEAT_ROWS; y++) {
    for (let x = 0; x < HEAT_ROWS; x++) {
      /**
       * ถ่วงให้ช่องจาง ๆ เยอะกว่าช่องเข้ม — ตารางจริงมีวันที่ไม่ได้คอมมิตเยอะที่สุด
       * สุ่มแบบกระจายเท่ากันจะได้ผืนเขียวทึบซึ่งอ่านไม่ออกว่าเป็นตารางคอมมิต
       */
      const u = rnd()
      const lv = u < 0.34 ? 0 : u < 0.56 ? 1 : u < 0.76 ? 2 : u < 0.91 ? 3 : 4
      ctx.fillStyle = HEAT_LEVELS[lv]
      const bx = x * cell + pad
      const by = y * cell + pad
      ctx.beginPath()
      ctx.roundRect(bx, by, box, box, r)
      ctx.fill()
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}
const checkerTex = heatmapTile()

/** ลายทางลูกกวาดแดง-ขาว — ปูรอบหน้าตัดของโดนัท */
function candyStripes(size = 256) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = 32
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#f6f0e4'
  ctx.fillRect(0, 0, size, 32)
  ctx.fillStyle = RED
  const n = 4
  for (let i = 0; i < n; i++) ctx.fillRect((i / n) * size, 0, size / (n * 2), 32)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}
const candyTex = candyStripes()

/** วงเป้าฟ้า-ขาวซ้อนกัน — แปะหน้าตัดของทรงกระบอกแบน */
function targetFace(size = 512) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const rings = ['#2e6bd8', '#f2f4ef', '#3f8ff2', '#f2f4ef', '#5eb1f5']
  rings.forEach((col, i) => {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, (size / 2) * (1 - i / rings.length), 0, Math.PI * 2)
    ctx.fill()
  })
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** glyph บนแผ่นใส — ใช้กับไอคอน/ไพ่ (วาดฟรอนต์เดียวพอ ด้านหลังเป็นเนื้อสีล้วน) */
function glyphTexture(draw, size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  draw(ctx, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** สัญลักษณ์ wifi (จุด + ส่วนโค้งสองชั้น) */
const wifiGlyph = glyphTexture((ctx, s) => {
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = s * 0.075
  ctx.lineCap = 'round'
  const cx = s / 2
  const cy = s * 0.68
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.055, 0, Math.PI * 2)
  ctx.fill()
  for (const r of [0.18, 0.32]) {
    ctx.beginPath()
    ctx.arc(cx, cy, s * r, Math.PI * 1.22, Math.PI * 1.78)
    ctx.stroke()
  }
})

/** เสาสัญญาณ (จุด + เสา + คลื่นแผ่สองข้าง) — หน้าตัดของป้ายทรงกระบอก */
const beaconGlyph = glyphTexture((ctx, s) => {
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = s * 0.05
  ctx.lineCap = 'round'
  const cx = s / 2
  const cy = s * 0.42
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx, s * 0.78)
  ctx.stroke()
  for (const r of [0.16, 0.27]) {
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(cx, cy, s * r, side < 0 ? Math.PI * 0.75 : -Math.PI * 0.25, side < 0 ? Math.PI * 1.25 : Math.PI * 0.25)
      ctx.stroke()
    }
  }
})

/** เครื่องบินส้มแบบไอคอน — ลำตัว + ปีกกวาด + หาง */
const planeGlyph = glyphTexture((ctx, s) => {
  ctx.fillStyle = ORANGE
  ctx.translate(s / 2, s / 2)
  ctx.rotate(-Math.PI / 4)
  const u = s / 100
  ctx.beginPath()
  ctx.moveTo(0, -34 * u)
  ctx.quadraticCurveTo(6 * u, -20 * u, 5 * u, -6 * u)
  ctx.lineTo(30 * u, 8 * u)
  ctx.lineTo(30 * u, 16 * u)
  ctx.lineTo(4 * u, 8 * u)
  ctx.lineTo(3 * u, 22 * u)
  ctx.lineTo(12 * u, 30 * u)
  ctx.lineTo(12 * u, 35 * u)
  ctx.lineTo(0, 31 * u)
  ctx.lineTo(-12 * u, 35 * u)
  ctx.lineTo(-12 * u, 30 * u)
  ctx.lineTo(-3 * u, 22 * u)
  ctx.lineTo(-4 * u, 8 * u)
  ctx.lineTo(-30 * u, 16 * u)
  ctx.lineTo(-30 * u, 8 * u)
  ctx.lineTo(-5 * u, -6 * u)
  ctx.quadraticCurveTo(-6 * u, -20 * u, 0, -34 * u)
  ctx.fill()
})

/** ดอกจิกบนไพ่ — ตัวอักษร ♣ ตรง ๆ วางเรียงแบบไพ่ 3 ดอก */
const clubGlyph = glyphTexture((ctx, s) => {
  ctx.fillStyle = '#20241f'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${s * 0.34}px system-ui, sans-serif`
  ctx.fillText('♣', s * 0.5, s * 0.28)
  ctx.fillText('♣', s * 0.32, s * 0.66)
  ctx.fillText('♣', s * 0.68, s * 0.66)
  ctx.font = `${s * 0.15}px system-ui, sans-serif`
  ctx.fillText('♣', s * 0.13, s * 0.12)
  ctx.save()
  ctx.translate(s * 0.87, s * 0.88)
  ctx.rotate(Math.PI)
  ctx.fillText('♣', 0, 0)
  ctx.restore()
})

/* ---------- geometry ช่วย ---------- */

/**
 * ริบบิ้นหมากรุก — แถบโค้งบิดตามเส้นทาง Catmull-Rom
 *
 * เดินตามเส้นโค้งแล้ววางหน้าตัดกว้าง w ทีละสเต็ป โดยบิดหน้าตัดรอบแกนสัมผัส (twist)
 * ค่อย ๆ เพิ่มตามระยะ — ได้ริบบิ้นที่ "ม้วนตัว" แบบภาพ ref ไม่ใช่แถบแบนราบ
 * uv แกน u คิดจากระยะจริงหารครึ่งความกว้าง — ช่องหมากรุกจึงเป็นจัตุรัสตลอดเส้น
 */
/**
 * เฟรมของผิวริบบิ้นที่พารามิเตอร์ t: จุดกึ่งกลางผิวบน (รวมคลื่น) ทิศสัมผัส และตั้งฉากผิว
 * เป็นแหล่งเดียวของสูตร — ทั้ง geometry และ "ของที่วิ่งบนริบบิ้น" (ตัวละคร) ใช้ตัวนี้
 * ไม่งั้นสองที่คำนวณคนละสูตรแล้วตัวละครลอย/จมจากผิวจริง
 */
const RIB_UP = new THREE.Vector3(0, 1, 0)
function ribbonFrame(curve, t, wave, waves, out) {
  const { P, T, S, N } = out
  curve.getPointAt(t, P)
  curve.getTangentAt(t, T)
  S.crossVectors(T, RIB_UP).normalize()
  const tw = Math.sin(t * Math.PI * 1.6 + 0.4) * 0.16 + t * 0.2 - 0.08
  S.applyAxisAngle(T, tw)
  N.crossVectors(S, T).normalize()
  const lift = Math.sin(t * Math.PI * 2 * waves + 0.6) * wave
  P.addScaledVector(N, lift)
  return out
}

function ribbonGeometry(
  points,
  w = 3.1,
  thick = 0.18,
  wave = 0.35,
  waves = 2.5,
  segs = 300,
  from = 0,
  to = 1,
) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.6)
  const len = curve.getLength()
  const pos = []
  const uv = []
  const idxTop = []
  const idxRest = []
  const P = new THREE.Vector3()
  const T = new THREE.Vector3()
  const S = new THREE.Vector3()
  const N = new THREE.Vector3()
  const frame = { P, T, S, N }
  const hw = w / 2
  for (let i = 0; i <= segs; i++) {
    /**
     * t ยังเป็นพารามิเตอร์ของ "เส้นเต็ม" เสมอ แม้จะสร้างแค่บางช่วง
     * เกลียวกับคลื่นคิดจาก t และ uv คิดจาก t × ความยาวเต็ม — ถ้า normalize ใหม่ต่อช่วง
     * สองท่อนจะมีเฟสคนละชุดแล้วต่อกันไม่สนิทตรงรอยตัด
     */
    const t = from + (to - from) * (i / segs)
    /**
     * บิดรอบแกนสัมผัสนิดเดียวพอ — มันคือถนนที่เอียงตามโค้ง ไม่ใช่ริบบิ้นที่ม้วนตัว
     * และคลื่นตามยาวยกตาม "แนวตั้งฉากกับผิว" ไม่ใช่แกน y ของโลก (สูตรอยู่ใน ribbonFrame)
     */
    ribbonFrame(curve, t, wave, waves, frame)
    const cx = P.x
    const cy = P.y
    const cz = P.z
    // สี่มุมต่อสเต็ป: บนซ้าย บนขวา ล่างซ้าย ล่างขวา (ล่าง = ถอยตามแนวตั้งฉากลงไป thick)
    pos.push(cx - S.x * hw, cy - S.y * hw, cz - S.z * hw)
    pos.push(cx + S.x * hw, cy + S.y * hw, cz + S.z * hw)
    pos.push(cx - S.x * hw - N.x * thick, cy - S.y * hw - N.y * thick, cz - S.z * hw - N.z * thick)
    pos.push(cx + S.x * hw - N.x * thick, cy + S.y * hw - N.y * thick, cz + S.z * hw - N.z * thick)
    /**
     * v วิ่ง 0→1 ตลอดความกว้าง ไม่ใช่ 0→2
     *
     * เดิมใช้ 0→2 เทกซ์เจอร์จึงปูซ้ำสองรอบขวางถนน ได้ 14 ช่องต่อความกว้าง ทั้งที่
     * ตารางคอมมิตต้องมี 7 ช่องต่อคอลัมน์พอดี (เจ็ดวันในสัปดาห์)
     *
     * u หารด้วยความกว้างเต็ม ไม่ใช่ครึ่งความกว้าง — ต้องขยับคู่กัน ไม่งั้นช่องจะไม่จัตุรัส
     * (v ครอบ 1 หน่วยเทกซ์เจอร์ต่อความกว้าง u ก็ต้องครอบ 1 หน่วยต่อระยะเท่าความกว้าง)
     */
    const u = (t * len) / w
    uv.push(u, 0, u, 1, u, 0, u, 1)
    if (i < segs) {
      const a = i * 4
      const b = a + 4
      idxTop.push(a, a + 1, b, a + 1, b + 1, b)
      // ผิวล่าง + สันสองข้าง ใช้วัสดุอีกตัว จะได้เห็นความหนาเป็นสีทึบ ไม่ใช่ลายหมากรุกซ้ำ
      idxRest.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3)
      idxRest.push(a, b, a + 2, a + 2, b, b + 2)
      idxRest.push(a + 1, a + 3, b + 1, a + 3, b + 3, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex([...idxTop, ...idxRest])
  g.addGroup(0, idxTop.length, 0)
  g.addGroup(idxTop.length, idxRest.length, 1)
  g.computeVertexNormals()
  return g
}

/**
 * ลอยเลี้ยงตัว — ห่อของหนึ่งชิ้นแล้วโยกตำแหน่ง/เอียงช้า ๆ
 * ความถี่สุ่มต่อชิ้นจากเฟส ไม่เป็นเท่าตัวกัน ทั้งฉากจึงไม่โยกพร้อมกันเป็นจังหวะเดียว
 */
function Float({ children, amp = 0.28, rot = 0.06, phase = 0, speed = 1, ...props }) {
  const ref = useRef()
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime * speed + phase
    g.position.y = Math.sin(t * 0.63) * amp
    g.rotation.z = Math.sin(t * 0.41 + 1.1) * rot
    g.rotation.x = Math.sin(t * 0.52 + 2.3) * rot * 0.6
  })
  return (
    <group {...props}>
      <group ref={ref}>{children}</group>
    </group>
  )
}

/* ---------- ชิ้นส่วน ---------- */

/**
 * โหมด clay — เลียนมุมมอง solid/clay ของ Blender ไว้ตรวจรูปทรงกับ perspective
 *
 * ตัดสีและเทกซ์เจอร์ออกทั้งหมด เหลือดินเหนียวสีเดียวบนพื้นหลังเทา สิ่งที่เหลือให้ตาอ่าน
 * มีแค่รูปทรง เงา และเส้นลู่ — ซึ่งเป็นสิ่งเดียวที่กำลังจัดอยู่ตอนนี้
 */
const CLAY_COLOR = '#b9b4ac'
const CLAY_BG_TOP = '#4a4a4a'
const CLAY_BG_BOT = '#282828'
const GRID = {
  clay: { line: '#5a5a5a', major: '#767676' },
  color: { line: '#3aa585', major: '#1d7f66' },
}

/**
 * ห่อของที่เป็น "ชิ้นงาน" (ไม่รวมพื้นหลังกับเส้นกริด) แล้วยัดวัสดุ clay ทับทุก mesh
 *
 * ใช้ traverse แทน scene.overrideMaterial เพราะ override ของ three กินทั้ง scene —
 * พื้นหลังกับกริดจะกลายเป็นดินเหนียวไปด้วย แล้วจอจะเหลือแค่สีเดียวทั้งจอ
 */
/**
 * ผิวพลาสติกเงา — ทับค่าความด้าน/แรงสะท้อนของทุกวัสดุในฉาก
 *
 * "พลาสติก" ในภาษาของ PBR คือ: ไม่ใช่โลหะ (metalness 0) ผิวเรียบ (roughness ต่ำ)
 * จึงสะท้อนแผงไฟจาก environment เป็นไฮไลต์นุ่ม ๆ และมีจุดสะท้อนคมจากไฟ key
 * ไม่แตะสี — สีเดิมของทุกชิ้นอยู่ครบ เปลี่ยนแค่ "เนื้อวัสดุ"
 *
 * ทำแบบไล่ทับเป็นระยะ ไม่ใช่ครั้งเดียว: mascot กับของในพอร์ทัลสร้างวัสดุทีหลัง
 * (โหลด GLB / สร้างใน effect) ทำครั้งเดียวตอน mount แล้วชิ้นที่มาทีหลังจะยังด้านอยู่
 * เช็คจากกุญแจใน userData จึงเขียนซ้ำเฉพาะชิ้นที่ยังไม่ได้ค่าชุดนี้ — ราคาแทบศูนย์
 *
 * ข้าม: แก้ว (transmission) ที่มีสูตรของตัวเอง, วัสดุที่ไม่มี roughness (basic), หน้ากาก stencil
 */
function Gloss({ on, rough, env, cel, children }) {
  const g = useRef()
  const frame = useRef(0)
  /**
   * uniform ของ cel shading — ชุดเดียวทั้งฉาก (ดู makeCelUniforms)
   * ค่าถูกเขียนทุกเฟรมจาก tuner ราคาแค่ assignment ไม่กี่ตัว
   */
  const celU = useMemo(makeCelUniforms, [])
  useFrame(() => {
    const root = g.current
    if (!root) return
    frame.current += 1
    celU.celOn.value = cel ? 1 : 0
    if (cel) {
      celU.celEdge.value = cel.edge
      celU.celHiEdge.value = cel.hiEdge
      celU.celSoft.value = cel.soft
      celU.celShadow.value = cel.shadow
      celU.celLit.value = cel.lit
      celU.celHi.value = cel.hi
      celU.celTint.value = cel.tint
    }
    /**
     * ทุก 2 เฟรม (ไม่ใช่ 6) — ตัวละครโหลดทีหลัง วัสดุที่โผล่ใหม่ต้องได้ cel ก่อนถูก compile
     * ครั้งแรก ไม่งั้น compile สองรอบ (รอบสองสะดุดกลางท่าไหลเข้าฉาก) traverse ราคาถูกมาก
     */
    if (frame.current % 2 !== 0) return
    const key = on ? `${rough}|${env}` : 'off'
    root.traverse((o) => {
      if (!o.material || o.userData.noClay) return
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        /**
         * แก้วของ drei (MeshTransmissionMaterial) ตั้ง transmission ของวัสดุฐานเป็น 0 แล้วเก็บ
         * ค่าจริงไว้ใน uniform `_transmission` — เช็คแค่ m.transmission จึงหลุด แล้วแก้วโดน
         * roughness 1 + cel ทับ กลายเป็นฝ้าขาวเม็ด ๆ ทั้งก้อน
         */
        if (
          !('roughness' in m) ||
          m.isMeshTransmissionMaterial ||
          m.uniforms?._transmission ||
          (m.transmission ?? 0) > 0
        ) continue
        if (!m.userData.celApplied) {
          addCel(m, celU)
          // วัสดุที่ compile ไปแล้วต้องขอโปรแกรมใหม่ — onBeforeCompile ที่เพิ่มทีหลังไม่ถูกเรียกเอง
          m.needsUpdate = true
        }
        if (m.userData.glossKey === key) continue
        // จำค่าเดิมครั้งแรกที่เจอ — ปิดแล้วต้องคืนเนื้อวัสดุเดิมได้ ไม่ใช่ค้างเงา
        if (m.userData.glossOrig === undefined) {
          m.userData.glossOrig = { roughness: m.roughness, metalness: m.metalness, env: m.envMapIntensity }
        }
        const o0 = m.userData.glossOrig
        m.roughness = on ? rough : o0.roughness
        m.metalness = on ? 0 : o0.metalness
        m.envMapIntensity = on ? env : o0.env
        m.userData.glossKey = key
      }
    })
  })
  return <group ref={g}>{children}</group>
}

function Clay({ on, children }) {
  const g = useRef()
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: CLAY_COLOR, roughness: 0.92, metalness: 0 }),
    [],
  )
  useDisposable(mat)
  /**
   * สลับวัสดุทุกเฟรม (ราคาแค่ traverse) ไม่ใช่ครั้งเดียวใน effect
   *
   * ของเดิมเป็น useLayoutEffect ที่จำ "วัสดุตอนนั้น" ไว้ใน Map แล้วคืนตอน cleanup — พัง
   * สองทาง: (1) deps มี children จึงรันใหม่ทุกครั้งที่แผงขยับ (2) มันจำวัสดุของตัวละครไว้
   * "ก่อน" rig ของ Mascot จะสลับเป็นวัสดุจริง (layout effect มาก่อน effect) พอแผงขยับครั้งถัดไป
   * cleanup ก็เอาวัสดุดิบของ GLB (ที่ Entrance เคยติด stencil ไว้) ยัดกลับ — หัวเลยหายไปอยู่
   * ในพอร์ทัล เห็นแต่ก้อนผมหลัง
   *
   * ทำแบบเดียวกับ Gloss: เดินทุกเฟรม เจอชิ้นที่ยังไม่ใช่ดินก็สลับแล้วจดของจริงไว้ใน
   * userData.clayFrom (ชื่อเดียวกับที่ Mascot ใช้หาวัสดุจริงอยู่แล้ว) ปิดโหมดก็คืนจากตรงนั้น
   * ข้าม: หน้ากาก stencil ของหน้าต่าง (noClay) และชิ้นที่ต้องคงสี (keepColor เช่น ตา/หน้า)
   */
  useFrame(() => {
    const root = g.current
    if (!root) return
    root.traverse((o) => {
      if (!o.material || o.userData.noClay || o.userData.keepColor) return
      if (on) {
        if (o.material !== mat) {
          o.userData.clayFrom = o.material
          o.material = mat
        }
      } else if (o.material === mat && o.userData.clayFrom) {
        o.material = o.userData.clayFrom
        delete o.userData.clayFrom
      }
    })
  })
  return <group ref={g}>{children}</group>
}

/** พื้นหลังไล่สีเกาะกล้อง — โหมด clay ใช้เทาเรียบแบบวิวพอร์ต ไม่มีตาราง */
function Backdrop({ clay }) {
  const tex = useMemo(() => {
    const CLAY = clay
    const S = 512
    const c = document.createElement('canvas')
    c.width = c.height = S
    const ctx = c.getContext('2d')
    const g = CLAY ? ctx.createLinearGradient(0, 0, 0, S) : ctx.createLinearGradient(0, S, S, 0)
    if (CLAY) {
      g.addColorStop(0, CLAY_BG_TOP)
      g.addColorStop(1, CLAY_BG_BOT)
    } else {
      // ใน ref มุมล่างซ้ายเขียวจัด ไล่ไปเป็น teal ทางขวาบน ไม่ใช่ไล่ตั้งขึ้น
      g.addColorStop(0, BG_TOP)
      g.addColorStop(0.5, BG_MID)
      g.addColorStop(1, BG_BOT)
    }
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [clay])
  useDisposable(tex)
  /**
   * แผ่นพื้นหลังเกาะกล้อง ไม่ใช่แผ่นนิ่งกลางฉาก
   *
   * กล้องก้ม 18° กรวยภาพจึงเลื่อนลงไปตกที่ครึ่งล่างของแผ่น ถ้าวางนิ่งต้องทำแผ่นใหญ่มาก
   * เพื่อกันขอบโผล่ แล้วไล่สีก็จะถูกบีบจนเห็นแค่แถบเดียว = พื้นหลังสีเรียบ
   * เกาะกล้องแล้วขนาดพอดีกรวยเสมอ ไล่สีเต็มเฟรมทุกอัตราส่วน
   */
  const ref = useRef()
  const DIST = 60
  useFrame(({ camera }) => {
    const m = ref.current
    if (!m) return
    m.quaternion.copy(camera.quaternion)
    m.position.set(0, 0, -DIST).applyQuaternion(camera.quaternion).add(camera.position)
    const h = 2 * DIST * Math.tan((camera.fov * Math.PI) / 360) * 1.04
    m.scale.set(h * camera.aspect, h, 1)
  })
  return (
    <mesh ref={ref} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} depthWrite={false} />
    </mesh>
  )
}

/** วงกลมนุ่ม ๆ ลอยเป็นฉากหลังบนซ้าย (decorative spheres ในชีท — ในฉากจริงถูกใช้แบบแบน) */
function SoftCircles() {
  return (
    <group position={[-6.5, 6.4, -19]}>
      {/* ทรงกลมจริง ไม่ใช่จานแบน — จานแบนไม่มีไล่แสง เลยอ่านเป็นรอยเปื้อนบนพื้นหลัง */}
      <mesh position={[-1.4, 0.2, 0]}>
        <sphereGeometry args={[2.6, 32, 24]} />
        <meshStandardMaterial color="#86dfa4" roughness={0.85} />
      </mesh>
      <mesh position={[1.9, 1.4, 1.2]}>
        <sphereGeometry args={[1.5, 32, 24]} />
        <meshStandardMaterial color="#5fcf94" roughness={0.85} />
      </mesh>
    </group>
  )
}

/**
 * แผงครีมฉากกลาง — กล่องมุมมนมีความหนาจริง (BACKGROUND PANELS ในชีท)
 *
 * ชีท perspective วาดแผงเป็นกล่อง เห็นหน้าข้างลู่เข้า VP ไม่ใช่ป้ายแบนหันหน้าเข้ากล้อง
 * ความหนาจึงต้องพอให้เห็นสันข้าง (~1.4 หน่วยขึ้นไป) และแผงทั้งแถบต้องหันไปทางเดียวกัน
 * แล้วปล่อยให้ perspective เป็นตัวเปิดหน้าข้างของใบที่อยู่นอกแนวกลางเอง
 *
 * `band` = สัดส่วนความสูงของแถบเขียวที่ฐาน (0 = ไม่มี) — ใน ref มีเฉพาะบางใบ และเป็น
 * เขียวอ่อน ไม่ใช่เขียวเข้มทึบ ถ้าใส่ทุกใบเท่ากันทั้งแถบจะอ่านเป็นรั้ว ไม่ใช่ฉากหลัง
 */
const PANEL_BAND = '#8ccf90'
const PANEL_BAND_LINE = '#c6e7bd'

function Panel({ w = 5.2, h = 6.5, d = 1.7, band = 0, cells = 0, stripe = false, portal = false, tint = INNER_BG, ...props }) {
  /**
   * หน้าต่าง = ช่องมองทะลุไปอีกฉาก ทำด้วย stencil buffer
   *
   * วาดตัวหน้าต่างโดยไม่เขียนสี (colorWrite=false) แต่เขียนเลข STENCIL_REF ลง stencil
   * แล้วของในฉากข้างในตั้งเงื่อนไขว่าจะวาดเฉพาะพิกเซลที่ stencil ตรงเลขนั้น — ผลคือ
   * ฉากข้างในโผล่เฉพาะในกรอบหน้าต่าง เหมือนมองผ่านช่อง
   *
   * เคยลอง MeshPortalMaterial ของ drei แล้วภาพในช่องไม่ตรงตำแหน่งกับฉากหลัก (คลาด
   * แนวตั้งราว 100 px) เพราะมันเรนเดอร์ลง render target แล้วสุ่มตัวอย่างกลับด้วยพิกัดจอ
   * ซึ่งพลาดง่ายเมื่อขนาด target กับขนาดจอไม่ตรงกัน stencil ไม่มีปัญหานั้นเลย เพราะ
   * ทุกอย่างวาดด้วยกล้องตัวเดียวกันในบัฟเฟอร์เดียวกัน ตำแหน่งจึงตรงโดยอัตโนมัติ
   */
  const r = Math.min(w, h) * 0.17
  const geo = useMemo(() => roundedBoxGeo(w, h, d, r), [w, h, d, r])
  useDisposable(geo)

  const bh = h * band
  return (
    <group {...props}>
      <mesh geometry={geo} renderOrder={portal ? -2 : 0} userData={{ noClay: portal }}>
        {portal ? (
          <meshBasicMaterial
            colorWrite={false}
            depthWrite={false}
            stencilWrite
            stencilRef={STENCIL_REF}
            stencilFunc={THREE.AlwaysStencilFunc}
            stencilZPass={THREE.ReplaceStencilOp}
          />
        ) : (
          <meshStandardMaterial color={tint} roughness={0.95} />
        )}
      </mesh>
      {band > 0 && (
        <group position={[0, -h / 2 + bh / 2, d / 2 - 0.02]}>
          <mesh>
            <boxGeometry args={[w * 0.995, bh, 0.12]} />
            <meshStandardMaterial color={PANEL_BAND} roughness={0.85} />
          </mesh>
          {Array.from({ length: Math.max(0, cells - 1) }, (_, i) => (
            <mesh key={i} position={[w * 0.995 * ((i + 1) / cells - 0.5), 0, 0.07]}>
              <boxGeometry args={[0.07, bh * 0.96, 0.04]} />
              <meshStandardMaterial color={PANEL_BAND_LINE} roughness={0.9} />
            </mesh>
          ))}
        </group>
      )}
      {stripe && (
        <mesh position={[0, -h * 0.05, d / 2 + 0.02]}>
          <planeGeometry args={[w * 0.6, h * 0.4]} />
          <meshBasicMaterial map={candyStripesGreen} />
        </mesh>
      )}
    </group>
  )
}

/** ลายทางผ้าใบเขียว-ขาวของแผงกลาง */
const candyStripesGreen = (() => {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 32
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#f2ecdc'
  ctx.fillRect(0, 0, 256, 32)
  ctx.fillStyle = GREEN_MAIN
  for (let i = 0; i < 8; i++) ctx.fillRect(i * 32, 0, 14, 32)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
})()

/** ป้ายทรงกระบอกนอน หน้าตัดเป็นเสาสัญญาณ (SIGN - WIFI) */
function BeaconSign(props) {
  const mats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: GREEN_SOFT, roughness: 0.8 })
    const cap = new THREE.MeshStandardMaterial({ color: GREEN_MAIN, roughness: 0.7, map: null })
    return [side, cap, new THREE.MeshStandardMaterial({ color: '#6cc276', roughness: 0.8 })]
  }, [])
  useDisposable(mats)
  return (
    <group {...props}>
      <mesh rotation={[0, 0, -Math.PI / 2]} material={mats}>
        <cylinderGeometry args={[1.45, 1.45, 4.4, 40]} />
      </mesh>
      {/* หน้า glyph ลอยหน้าฝาซ้ายนิดเดียว — ง่ายกว่าไล่ UV ของฝา cylinder */}
      <mesh position={[-2.21, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <circleGeometry args={[1.32, 40]} />
        <meshStandardMaterial color={GREEN_MAIN} roughness={0.7} />
      </mesh>
      <mesh position={[-2.24, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.3, 2.3]} />
        <meshBasicMaterial map={beaconGlyph} transparent />
      </mesh>
    </group>
  )
}

/** ไอคอนแอปมุมมน + glyph (ใช้ทั้ง wifi ฟ้าและหัวใจ) */
function AppIcon({ color = BLUE, glyph = wifiGlyph, size = 1.7, ...props }) {
  const geo = useMemo(() => roundedBoxGeo(size, size, size * 0.42, size * 0.26), [size])
  useDisposable(geo)
  return (
    <group {...props}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, size * 0.22]}>
        <planeGeometry args={[size * 0.92, size * 0.92]} />
        <meshBasicMaterial map={glyph} transparent />
      </mesh>
    </group>
  )
}

/** เหรียญเขียวลายเครื่องบินส้ม (ICON - AIRPLANE) */
function PlaneCoin(props) {
  return (
    <group {...props}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.05, 1.05, 0.34, 40]} />
        <meshStandardMaterial color={GREEN_MAIN} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.18]}>
        <planeGeometry args={[1.7, 1.7]} />
        <meshBasicMaterial map={planeGlyph} transparent />
      </mesh>
    </group>
  )
}

/** ไพ่ดอกจิก — แผ่นมุมมนขาว + ลายดอก */
function PlayingCard(props) {
  const geo = useMemo(() => roundedBoxGeo(1.7, 2.4, 0.1, 0.2), [])
  useDisposable(geo)
  return (
    <group {...props}>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#f4f1e6" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[1.55, 2.25]} />
        <meshBasicMaterial map={clubGlyph} transparent />
      </mesh>
    </group>
  )
}

/** โดนัทลายลูกกวาด (CANDY FLOAT) */
function CandyFloat(props) {
  const tex = useMemo(() => {
    const t = candyTex.clone()
    t.repeat.set(9, 1)
    t.needsUpdate = true
    return t
  }, [])
  useDisposable(tex)
  return (
    <mesh {...props}>
      <torusGeometry args={[1.55, 0.68, 24, 64]} />
      <meshStandardMaterial map={tex} roughness={0.75} />
    </mesh>
  )
}

/** วงเป้าฟ้า (TARGET RING) */
function TargetRing(props) {
  const tex = useMemo(() => targetFace(), [])
  useDisposable(tex)
  return (
    <group {...props}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.6, 1.6, 0.5, 48]} />
        <meshStandardMaterial color="#2e6bd8" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.26]}>
        <circleGeometry args={[1.58, 48]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  )
}

/** เพชรม่วง — ทรง 12 หน้า flat shading + สันขอบสีอ่อน */
function Gem(props) {
  const edges = useMemo(() => {
    const g = new THREE.DodecahedronGeometry(1)
    const e = new THREE.EdgesGeometry(g, 10)
    g.dispose()
    return e
  }, [])
  useDisposable(edges)
  return (
    <group {...props}>
      <mesh scale={[1, 0.82, 1]}>
        <dodecahedronGeometry args={[1]} />
        <meshStandardMaterial color={PURPLE} roughness={0.45} flatShading />
      </mesh>
      <lineSegments geometry={edges} scale={[1, 0.82, 1]}>
        <lineBasicMaterial color="#e2a5f5" />
      </lineSegments>
    </group>
  )
}

/** เบี้ยหมากรุกเขียวเข้ม — ปั้นด้วย Lathe จากโปรไฟล์ */
function GamePawn(props) {
  const geo = useMemo(() => {
    const pts = [
      [0.0, 0],
      [0.62, 0],
      [0.62, 0.16],
      [0.42, 0.3],
      [0.3, 0.62],
      [0.26, 0.98],
      [0.4, 1.12],
      [0.4, 1.2],
      [0.24, 1.26],
      [0.34, 1.5],
      [0.28, 1.74],
      [0.0, 1.84],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    return new THREE.LatheGeometry(pts, 36)
  }, [])
  useDisposable(geo)
  return (
    <mesh geometry={geo} {...props}>
      <meshStandardMaterial color={GREEN_DEEP} roughness={0.6} />
    </mesh>
  )
}

/** กลุ่มบล็อก 2x2 — สีเดียวทั้งกลุ่ม (BLOCKS ในชีท) */
function Blocks({ color = GREEN_MAIN, unit = 0.55, ...props }) {
  const cells = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [1, 0, 1],
  ]
  return (
    <group {...props}>
      {cells.map(([x, y, z], i) => (
        <mesh key={i} position={[x * unit, y * unit, z * unit]}>
          <boxGeometry args={[unit * 0.94, unit * 0.94, unit * 0.94]} />
          <meshStandardMaterial color={color} roughness={0.65} />
        </mesh>
      ))}
    </group>
  )
}

/** บล็อกกระเบื้องครีมฝาเขียว (TILE BLOCK) */
function TileBlock(props) {
  const geo = useMemo(() => roundedBoxGeo(2.4, 2.4, 1.2, 0.5), [])
  useDisposable(geo)
  return (
    <group {...props}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={CREAM} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.62, 0.1]}>
        <boxGeometry args={[2.3, 0.7, 1.1]} />
        <meshStandardMaterial color={GREEN_DEEP} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.02, 0.1]}>
        <boxGeometry args={[2.3, 0.26, 1.16]} />
        <meshStandardMaterial color={GREEN_SOFT} roughness={0.8} />
      </mesh>
    </group>
  )
}

/** จานเขียวใหญ่หลังแผง (LARGE CYLINDER) */
function BigDisc(props) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} {...props}>
      <cylinderGeometry args={[2.6, 2.6, 0.9, 48]} />
      <meshStandardMaterial color="#57b96b" roughness={0.8} />
    </mesh>
  )
}

/** คอนเฟตติ: เม็ดกลม/เม็ดแคปซูลกระจายทั่วฉาก — InstancedMesh เดียว สีต่อเม็ด */
function Confetti({ count = 26 }) {
  const ref = useRef()
  const data = useMemo(() => {
    const rnd = makeRandom(13)
    const colors = [ORANGE, '#f7c980', '#2fbf8f', BLUE, '#7c5cf0', PURPLE, '#e8492e']
    return Array.from({ length: count }, (_, i) => {
      let x = (rnd() - 0.5) * 24
      const y = (rnd() - 0.5) * 13
      // เว้นย่านกลางจอ — นั่นคือที่ของตัวละคร เม็ดที่ลอยตรงนั้นอ่านเป็นสิ่งสกปรกบนเลนส์
      if (Math.abs(x) < 3 && Math.abs(y) < 3) x += Math.sign(x || 1) * 3.5
      return {
      p: new THREE.Vector3(x, y, -6 + rnd() * 10),
      s: 0.07 + rnd() * 0.15,
      flat: rnd() > 0.3,
      c: new THREE.Color(colors[i % colors.length]),
      ph: rnd() * Math.PI * 2,
      }
    })
  }, [count])
  const M = useMemo(() => new THREE.Matrix4(), [])
  const Q = useMemo(() => new THREE.Quaternion(), [])
  const V = useMemo(() => new THREE.Vector3(), [])
  const E = useMemo(() => new THREE.Euler(), [])
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    data.forEach((d, i) => {
      E.set(t * 0.3 + d.ph, d.ph, t * 0.24 + d.ph * 2)
      Q.setFromEuler(E)
      V.set(d.s * (d.flat ? 2.6 : 1), d.s * (d.flat ? 0.42 : 1), d.s * (d.flat ? 0.42 : 1))
      M.compose(
        // ลอยขึ้นลงคนละเฟส — ตำแหน่งฐานนิ่ง ไม่เดินทาง
        new THREE.Vector3(d.p.x, d.p.y + Math.sin(t * 0.5 + d.ph) * 0.35, d.p.z),
        Q,
        V,
      )
      mesh.setMatrixAt(i, M)
      if (mesh.instanceColor === null) mesh.setColorAt(i, d.c)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 10]} />
      <meshStandardMaterial roughness={0.7} />
    </instancedMesh>
  )
}

/** เส้นริบบิ้นหยัก ๆ เล็ก ๆ (CONFETTI / RIBBONS) — ท่อบางตามเส้นโค้ง sine */
function Squiggle({ color = '#59d3a8', ...props }) {
  const geo = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      pts.push(new THREE.Vector3(t * 2.4, Math.sin(t * Math.PI * 2.4) * 0.32, 0))
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.09, 8, false)
  }, [])
  useDisposable(geo)
  return (
    <mesh geometry={geo} {...props}>
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  )
}

/** จุดหมุนของริบบิ้น = ปากช่องบานที่ 2 ตรงที่มันโผล่ออกมา (พิกัดในกลุ่มแถบหน้าต่าง) */
const RIBBON_PIVOT = [-3.5, 2.45, 0.7]

/** จุดควบคุมริบบิ้นหลัก — พิกัดในกลุ่มแถบหน้าต่าง (ดูคำอธิบายใน CheckerRibbon) */
export const RIBBON_PATH = [
    /**
     * ช่วงหลัง: ในโพรงบานที่ 1 → ลอดหลังกรอบ → ปากช่องบานที่ 2
     *
     * ชุดจุดนี้ได้จากการค้นหา ไม่ใช่การกะ: วัด "มุมที่ทิศทางเส้นหักต่อหนึ่งสเต็ป"
     * ตลอดเส้นแล้วเลือกชุดที่ค่าสูงสุดต่ำที่สุด — มุมหักคือสิ่งที่ทำให้ริบบิ้นตะแคง
     * จนเห็นเป็นสันบางแล้วบานออกตรงรอยต่อ ไม่ใช่รูโหว่ในเรขาคณิต
     *
     * ได้ 1.51° จากเดิม 2.08° (ลองด้วยมือก่อนหน้านี้ได้ 4.32° คือแย่ลง — เลยต้องวัด)
     *
     * เงื่อนไขที่ล็อกไว้ระหว่างค้นหา: จุดปากช่องคงเดิมเป๊ะ และความยาวรวมต่างจากเดิม
     * ไม่เกิน 0.7% เพราะเฟสของคลื่นคิดจากระยะตามเส้น ถ้ายาวเปลี่ยนมากคลื่นจะเลื่อน
     * ไปทั้งเส้น รวมช่วงหน้าที่จัดไว้แล้ว
     */
    new THREE.Vector3(-9.6, 2.7, -3.9),
    new THREE.Vector3(-8.3, 2.66, -3.0),
    new THREE.Vector3(-6.1, 2.58, -2.1),
    new THREE.Vector3(-4.6, 2.52, -1.1),
    new THREE.Vector3(-3.5, 2.45, 0.7),
    /**
     * ขาออกต้องลด x ท้องถิ่นลงขณะที่ z เพิ่ม
     *
     * แกน +z ของกลุ่มชี้ออกมาทางกล้อง "เยื้องขวา" (sin26° ≈ 0.44) เดินตรงตาม z
     * อย่างเดียวจะลอยไปทับบานที่ 3 แล้วเลยไปโซนข้อความ ถอย x ไปทางซ้ายพอ ๆ กัน
     * จึงได้เส้นที่พุ่งเข้าหาคนดูตรง ๆ แล้วดำดิ่งออกขอบล่าง
     */
    new THREE.Vector3(-3.7, 2.0, 3.2),
    new THREE.Vector3(-4.1, 0.8, 7.0),
    new THREE.Vector3(-4.9, -1.4, 11.0),
    // ปลายต้องพ้นขอบล่างของเฟรม ไม่ใช่จบกลางอากาศ — เอียงซ้ายเพิ่มไม่ให้ไปทับโซนข้อความ
    new THREE.Vector3(-7.0, -4.8, 16.0),
]


/**
 * ของที่อยู่ "ในหน้าต่าง" — วาดเฉพาะพิกเซลที่ stencil ถูกทำเครื่องหมายไว้โดยหน้าต่าง
 *
 * ไล่ตั้งค่า stencil ให้ทุกวัสดุด้วย traverse แทนการส่ง prop ทีละชิ้น เพราะของในนี้
 * เป็นเมชธรรมดาหลายชิ้น การลืมตั้งแค่ชิ้นเดียวจะทำให้มันโผล่นอกกรอบหน้าต่างทันที
 *
 * depthTest ยังเปิดอยู่ ของที่อยู่หน้าหน้าต่าง (ริบบิ้น ตัวละคร) จึงบังพอร์ทัลได้ตามจริง
 */
function InsideWindow({ children }) {
  const g = useRef()
  /**
   * ไล่ตั้ง stencil ซ้ำทุกเฟรมช่วงแรก ไม่ใช่ครั้งเดียวตอน mount
   *
   * ฉาก joespresso สร้างเมชหลายชิ้นหลังจากนั้น (โหลด GLB, สร้าง geometry ใน effect)
   * ตั้งครั้งเดียวแล้วชิ้นที่มาทีหลังจะไม่มีเงื่อนไข stencil แล้วโผล่นอกกรอบหน้าต่างทันที
   * ตั้งเฉพาะชิ้นที่ยังไม่ถูกตั้ง (ดูจาก stencilRef) เพื่อไม่ให้ต้อง needsUpdate ทุกเฟรม
   */
  const frames = useRef(0)
  useFrame(() => {
    const root = g.current
    if (!root || frames.current > 240) return
    frames.current += 1
    root.traverse((o) => {
      /**
       * เปิด matrixWorldAutoUpdate กลับให้ทุกชิ้นในพอร์ทัล
       *
       * Sky กับ Terrain ของ joespresso เรียก useStaticSubtree ซึ่งปิดธงนี้ทั้งกิ่ง
       * (ของสองชิ้นนั้นไม่เคยขยับในหน้าเดิม จึงตัดออกจากงานคำนวณทุกเฟรม)
       * ผลข้างเคียงที่นี่คือพอกลุ่มแม่ขยับ ลูกไม่คำนวณ matrixWorld ใหม่เลย สไลเดอร์
       * ตำแหน่ง/สเกล/หมุนจึงไม่มีผล — และ updateMatrixWorld(true) ก็ช่วยไม่ได้
       * เพราะโค้ดของ three ข้ามการคำนวณเมื่อธงนี้เป็น false ไม่ว่าจะ force หรือไม่
       */
      o.matrixWorldAutoUpdate = true
      if (!o.material) return
      o.renderOrder = 1
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.stencilWrite && m.stencilRef === STENCIL_REF) continue
        m.stencilWrite = true
        m.stencilRef = STENCIL_REF
        m.stencilFunc = THREE.EqualStencilFunc
        m.needsUpdate = true
      }
    })
  })
  return <group ref={g}>{children}</group>
}

/**
 * ริบบิ้นของฉากในหน้าต่าง — คนละชิ้นกับเส้นหลัก ไม่ได้ผูกกับตำแหน่งบาน
 *
 * แยกเป็นวัตถุของตัวเองเพราะเส้นหลักต้องเริ่มที่ปากช่องพอดี ส่วนชิ้นนี้แค่ต้องอยู่ใน
 * กรอบหน้าต่างให้สวย จะวางตรงไหนก็ได้ตราบใดที่ยังอยู่หลังระนาบบาน — ผูกสองเรื่องนี้
 * เข้าด้วยกันเมื่อไร การขยับบานทีเดียวจะพังทั้งสองฝั่ง
 */
/** จุดควบคุมริบบิ้นในพอร์ทัล — พิกัดท้องถิ่นของ mesh (ก่อน offset/rot/scale) */
export const PORTAL_PATH = [
  new THREE.Vector3(-46, 10, -16),
  new THREE.Vector3(-26, 4, -8),
  new THREE.Vector3(-8, 0, -2),
  new THREE.Vector3(12, -3, 2),
  new THREE.Vector3(32, -8, 10),
  new THREE.Vector3(52, -16, 22),
]

function PortalRibbon({ width, thick, wave, waves, scale, offset, rot }) {
  const mesh = useRef()
  const curve = useMemo(() => new THREE.CatmullRomCurve3(PORTAL_PATH, false, 'catmullrom', 0.6), [])
  useEffect(() => {
    portalRide.curve = curve
    return () => {
      if (portalRide.curve === curve) portalRide.curve = null
    }
  }, [curve])
  useEffect(() => {
    portalRide.mesh = mesh.current
    portalRide.wave = wave
    portalRide.waves = waves
    return () => {
      if (portalRide.mesh === mesh.current) portalRide.mesh = null
    }
  }, [wave, waves, scale, offset, rot])
  const geo = useMemo(
    () =>
      ribbonGeometry(
        PORTAL_PATH,
        width,
        thick,
        wave,
        waves,
        RIB_SEGS,
      ),
    [width, thick, wave, waves],
  )
  useDisposable(geo)
  // อินโทร: วาดจากท้ายสุดในหน้าต่างมาถึงปากบาน ก่อนส่งไม้ต่อให้เส้นข้างนอก
  useRibbonDraw(geo, 'portal')
  const tex = useMemo(() => {
    const t = checkerTex.clone()
    t.needsUpdate = true
    return t
  }, [])
  useDisposable(tex)
  return (
    <mesh ref={mesh} geometry={geo} position={offset} rotation={rot} scale={scale}>
      <meshStandardMaterial attach="material-0" map={tex} roughness={0.85} side={THREE.DoubleSide} />
      <meshStandardMaterial attach="material-1" color={GREEN_DEEP} roughness={0.75} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** ฉากที่อยู่หลังหน้าต่าง — โทนอุ่นเข้ม ตัดกับพื้นน้ำเงินของหน้า จึงอ่านว่าเป็นคนละที่ */
function WindowWorld({
  z = -46,
  ribbon,
  /** ลูกโลกจิ๋ว: null = ไม่แสดง */
  globe,
  wall = true,
  hemi = 0.7,
  /** ชื่อ keyLight ไม่ใช่ key — `key` เป็นชื่อสงวนของ React ส่งเป็น prop ไม่ได้ */
  keyLight = 1.1,
  stack,
  tetris,
}) {
  const skyTex = useMemo(() => gradientTexture(DAY_SKY), [])
  useDisposable(skyTex)

  return (
    <group position={[0, 0, z]}>
      {/**
       * ผนังหลังสุดสีขาว — ทึบพอที่จะกันไม่ให้พื้นหลังน้ำเงินของหน้าลอดออกมา
       *
       * ใช้ meshBasicMaterial ไม่ใช่ standard: ผนังต้องขาวเท่ากันทั้งผืนไม่ว่าไฟจะตกยังไง
       * ถ้ารับแสงมันจะมีไล่เฉดแล้วอ่านเป็น "กำแพงที่ถูกส่อง" แทนที่จะเป็นที่ว่างสีขาว
       */}
      {wall && (
        /**
         * ผนังพอร์ทัลใช้ไล่สีฟ้าชุดเดียวกับฉาก joespresso (DAY_SKY)
         *
         * ฉากนั้นมีผนังฟ้าของตัวเองอยู่แล้ว แต่มันกว้างแค่ 90 หน่วยและอยู่ที่ z -26
         * ของฉากเอง พอย่อ/เลื่อนฉากให้พอดีกรอบหน้าต่าง ขอบผนังนั้นจะโผล่เป็นเส้นตัด
         * กลางหน้าต่าง จึงปิดผนังของฉาก (noBackdrop) แล้วใช้ผนังใบนี้ใบเดียวแทน
         *
         * สีดึงจากค่าที่ export มาจาก Sky.jsx ไม่ได้ก๊อบตัวเลขมาวาง — ก๊อบแล้ววันหนึ่ง
         * จะแก้ที่เดียวแล้วอีกที่ไม่ตาม
         */
        <mesh position={[0, 0, -22]}>
          <planeGeometry args={[220, 150]} />
          <meshBasicMaterial map={skyTex} toneMapped={false} />
        </mesh>
      )}
      {/* พื้นหลังขาวสว่างกว่าเดิมมาก ไฟจึงต้องลดลง ไม่งั้นของในฉากจะซีดจนกลืนกับผนัง */}
      <hemisphereLight intensity={hemi} color="#ffffff" groundColor="#c9d4e8" />
      <directionalLight position={[-8, 10, 6]} intensity={keyLight} color="#fff2e2" />
      {globe && (
        /**
         * ลูกโลกจิ๋ววนลูป — แทนภูมิทัศน์ joespresso เดิม (ฟ้า/เนิน/ต้นไม้) ที่เอาออกไป
         * ปั้นที่รัศมี 1 ต้องขยายและวางให้พอดีกรอบหน้าต่าง
         */
        <Globe
          spinBoost={globe.spinBoost}
          position={globe.pos}
          rotation={globe.rot}
          scale={globe.scale}
          speed={globe.speed}
          seed={globe.seed}
          road={globe.road}
          bushes={globe.bushes}
          cones={globe.cones}
          rounds={globe.rounds}
          mushrooms={globe.mushrooms}
          flowers={globe.flowers}
          berries={globe.berries}
          pebbles={globe.pebbles}
          propScale={globe.propScale}
        />
      )}
      {stack && (
        <StackedWindows
          count={stack.count}
          step={stack.step}
          w={stack.w}
          h={stack.h}
          barRatio={stack.barRatio}
          depth={stack.depth}
          radius={stack.radius}
          btnRatio={stack.btnRatio}
          inset={stack.inset}
          position={stack.pos}
          rotation={stack.rot}
          scale={stack.scale}
        />
      )}
      {tetris && (
        <Tetris
          shape={tetris.shape}
          depth={tetris.depth}
          radius={tetris.radius}
          gap={tetris.gap}
          position={tetris.pos}
          rotation={tetris.rot}
          scale={tetris.scale}
        />
      )}
      <PortalRibbon {...ribbon} />
    </group>
  )
}

/** ริบบิ้นหมากรุกเส้นหลัก */
/** จำนวนสเต็ปของริบบิ้น (ทั้งในพอร์ทัลและข้างนอก) — ใช้ทั้งตอนสร้างและตอนนับ index ที่วาดในอินโทร */
const RIB_SEGS = 260

/**
 * อินโทร: ริบบิ้น "วาด" ต่อเนื่องเป็นเส้นเดียว — เริ่มจากเส้นในพอร์ทัล (ท้ายสุดในหน้าต่าง) ไล่มาถึง
 * ปากบาน แล้วต่อด้วยเส้นข้างนอกจนสุดปลาย ความคืบหน้ารวม 0..1 ผ่อนแบบ ease-out ทีเดียวทั้งเส้น
 * แล้วค่อยแบ่งช่วงให้สองชิ้นตาม inRibSplit (สัดส่วนของเส้นในพอร์ทัล) จังหวะจึงไม่สะดุดที่รอยต่อ
 *
 * ไม่สร้าง geometry ใหม่ แค่จำกัดจำนวน index ที่วาดของแต่ละกลุ่มวัสดุ (ผิวบน 6 index/สเต็ป
 * สันข้าง+ผิวล่าง 18) geometry เรียงสเต็ปตามทิศการวิ่ง จึงงอกไปข้างหน้าพอดี
 * onStep(e) = ความคืบหน้าท้องถิ่น 0..1 ของชิ้นนี้ (ให้เส้นข้างนอกใช้ก่อคลื่น)
 */
function useRibbonDraw(geo, part, onStep) {
  const drawn = useRef(-1)
  useFrame(() => {
    const t = getTuner()
    let local = 1
    if (t.intro > 0.5) {
      const u = Math.min(1, Math.max(0, (introTime() - t.inRibAt) / Math.max(0.01, t.inRibDur)))
      const e = 1 - Math.pow(1 - u, 3)
      const f = Math.min(0.95, Math.max(0.05, t.inRibSplit))
      local = part === 'portal' ? Math.min(1, e / f) : Math.min(1, Math.max(0, (e - f) / (1 - f)))
    }
    const k = Math.round(RIB_SEGS * local)
    if (k === drawn.current) return
    drawn.current = k
    const [top, rest] = geo.groups
    if (top) top.count = k * 6
    if (rest) rest.count = k * 18
    onStep?.(local)
  })
}

function CheckerRibbon({ width, thick, wave, waves, scale, offset, rot }) {
  /**
   * เส้นทางเป็น "ถนน" ที่วิ่งเข้าหาคนดู ไม่ใช่แถบพาดขวางจอ
   *
   * ใน ref ช่องหมากรุกเล็กจิ๋วตรงที่มันโผล่จากหลังแผง แล้วโตขึ้นเรื่อย ๆ จนคับขอบล่าง
   * ของเฟรม — นั่นคือ perspective ของเส้นที่เดินเข้าหากล้อง ไม่ใช่ริบบิ้นที่กว้างขึ้น
   * จุดควบคุมจึงไล่ z จาก -13 (หลังแผง) มาถึง +10 (เกือบชนเลนส์) และไล่ลงตาม y
   * เพื่อให้มันออกขอบล่างพอดี ไม่ใช่พุ่งทะลุกลางจอ
   */
  /**
   * จุดควบคุมเป็นพิกัด "ในกลุ่มแถบหน้าต่าง" ไม่ใช่พิกัดโลก
   *
   * ริบบิ้นต้องผูกกับหน้าต่าง ไม่ใช่ลอยอิสระ: มันเริ่มในโพรงของบานที่ 1 ไหลไปทางขวา
   * ลอดหลังกรอบ แล้วโผล่ออกทางช่องของบานที่ 2 พิกัดท้องถิ่นทำให้ตำแหน่งพวกนี้เขียนตรง ๆ
   * จากตำแหน่งบาน (ศูนย์กลางบานอยู่ที่ x = panelX + (i-1)·panelGap) และยังตรงอยู่แม้
   * จะหมุน bandYaw หรือขยับ panelZ ทีหลัง
   *
   * แกน +z ของกลุ่มนี้ชี้ออกมาทางกล้องเยื้องขวา (หมุน 26°) — ไล่ z ขึ้นคือวิ่งเข้าหาคนดู
   */
  const PATH = RIBBON_PATH

  /**
   * ริบบิ้นเส้นนี้เริ่มที่ "ปากช่องบานที่ 2" ไม่มีหางลากไปข้างหลังอีกแล้ว
   *
   * หางเดิมอยู่ในช่องว่างระหว่างบาน ไม่ได้อยู่หลังบานไหนเลย จึงเห็นเป็นริบบิ้นพาด
   * พื้นหลังแทนที่จะเป็นของในหน้าต่าง — ตัดทิ้ง แล้วไปทำเป็นวัตถุแยกในฉากของหน้าต่าง
   * (ดู PortalRibbon) ซึ่งวางอิสระได้โดยไม่ต้องผูกกับตำแหน่งบาน
   *
   * หาจุดเริ่มจากระยะตามเส้นจริง (getPointAt) ไม่ใช่ index ของจุดควบคุมหารจำนวนจุด
   * เพราะช่วงระหว่างจุดควบคุมยาวไม่เท่ากัน ใช้ index จะเริ่มเลยหรือไม่ถึงปากช่อง
   */
  const tCut = useMemo(() => {
    const c = new THREE.CatmullRomCurve3(PATH, false, 'catmullrom', 0.6)
    const exit = PATH[4]
    const P = new THREE.Vector3()
    let best = 0
    let bestD = Infinity
    for (let i = 0; i <= 600; i++) {
      const t = i / 600
      const d = c.getPointAt(t, P).distanceTo(exit)
      if (d < bestD) {
        bestD = d
        best = t
      }
    }
    return best
  }, [PATH])

  const geoFront = useMemo(
    () => ribbonGeometry(PATH, width, thick, wave, waves, RIB_SEGS, tCut, 1),
    [PATH, width, thick, wave, waves, tCut],
  )
  useDisposable(geoFront)
  /** ตำแหน่งจุดยอดชุด "คลื่นเต็ม" กับ "แบน" — อินโทรผสมสองชุดนี้ให้คลื่นค่อย ๆ ก่อตัวตอนวาด */
  const wavePos = useMemo(() => {
    const full = geoFront.attributes.position.array.slice()
    const flatGeo = ribbonGeometry(PATH, width, thick, 0, waves, RIB_SEGS, tCut, 1)
    const flat = flatGeo.attributes.position.array.slice()
    flatGeo.dispose()
    return { full, flat }
  }, [geoFront, PATH, width, thick, waves, tCut])
  // คลื่นก่อตัวตามหลังปลายที่กำลังวาด: ผสมตำแหน่งจุดยอดจากแบน → คลื่นเต็ม
  useRibbonDraw(geoFront, 'outer', (e) => {
    const arr = geoFront.attributes.position.array
    const { full, flat } = wavePos
    for (let i = 0; i < arr.length; i += 1) arr[i] = flat[i] + (full[i] - flat[i]) * e
    geoFront.attributes.position.needsUpdate = true
    if (e >= 1) geoFront.computeVertexNormals()
  })

  /**
   * anisotropy สูงสุดเท่าที่การ์ดรองรับ — ตัวชี้ขาดความคมของผิวที่วางเกือบขนานสายตา
   *
   * ถนนพุ่งหนีกล้อง แต่ละพิกเซลจึงกินเนื้อเทกซ์เจอร์เป็นแถบยาว ๆ ตัวกรองปกติเฉลี่ย
   * เป็นวงกลมจึงเบลอทั้งที่ความละเอียดพอ ค่าเดิมตั้งไว้ตายตัวที่ 8 ซึ่งมักต่ำกว่า
   * ที่การ์ดทำได้ (ส่วนใหญ่ 16)
   */
  const maxAniso = useThree((st) => st.gl.capabilities.getMaxAnisotropy())
  const tex = useMemo(() => {
    const t = checkerTex.clone()
    t.anisotropy = maxAniso
    t.needsUpdate = true
    return t
  }, [maxAniso])
  useDisposable(tex)
  return (
    /**
     * หมุนรอบ "ปากทางออกที่บานที่ 2" ไม่ใช่รอบจุดกำเนิดของกลุ่ม
     *
     * จุดกำเนิดอยู่กลางแถบหน้าต่าง หมุนรอบจุดนั้นแล้วริบบิ้นเหวี่ยงหลุดออกจากบานทันที
     * ปักหมุดที่ปากทางออกแล้วหมุน ปลายที่โผล่ออกมาจึงกวาดไปมาโดยที่หัวยังคาอยู่ในหน้าต่าง
     */
    <group position={RIBBON_PIVOT} rotation={rot}>
    <group position={[-RIBBON_PIVOT[0], -RIBBON_PIVOT[1], -RIBBON_PIVOT[2]]}>
    <group position={offset} scale={scale}>
      <mesh geometry={geoFront}>
        {/* ผิวบน = ตารางคอมมิต / ผิวล่างกับสันข้าง = สีทึบ ให้เห็นว่าเป็นแผ่นมีความหนา */}
        <meshStandardMaterial attach="material-0" map={tex} roughness={0.85} side={THREE.DoubleSide} />
        <meshStandardMaterial attach="material-1" color={GREEN_DEEP} roughness={0.75} side={THREE.DoubleSide} />
      </mesh>
    </group>
    </group>
    </group>
  )
}

/**
 * ริบบิ้นกระจก — แถบโปร่งแสงฟุ้ง ๆ สีขาวฟ้า โค้งพุ่งออกจากปากบานที่ 2
 *
 * ภาพอ้างอิงเป็นแถบเหมือนกระจกฝ้าบาง ๆ ที่หักเหฉากหลังและมีไฮไลต์ขาว — จึงเป็น
 * MeshTransmissionMaterial (เบลอฉากหลังแบบกระจก ไม่ใช่ฝ้าทึบ) บน geometry ริบบิ้นตัวเดียวกับ
 * เส้นหมากรุก (มีความหนา สันข้างรับแสงเป็นเส้นสว่าง) ไม่มีคลื่น ไม่มีลาย
 *
 * เส้นทางเป็นพิกัดสัมพัทธ์กับปากช่อง (RIBBON_PIVOT) แล้วค่อยเลื่อน/หมุน/ย่อขยายทั้งชิ้นด้วยปุ่ม
 * โค้งไปทางขวาแล้วม้วนขึ้น — ปลายที่ม้วนคือจุดที่ตาอ่านว่า "แถบ" ไม่ใช่ "ถนน"
 */
const GLASS_PATH = [
  new THREE.Vector3(-1.5, 0.2, -2.5),
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(2.4, -0.4, 2.6),
  new THREE.Vector3(5.6, -1.2, 5.2),
  new THREE.Vector3(9.4, -0.6, 6.4),
  new THREE.Vector3(12.6, 1.6, 5.4),
  new THREE.Vector3(14.2, 4.2, 2.6),
  new THREE.Vector3(13.0, 6.2, -0.6),
]

function GlassRibbon({ width, thick, scale, offset, rot, rough, transmission, chroma, ior, tint }) {
  const geo = useMemo(
    () => ribbonGeometry(GLASS_PATH, width, thick, 0, 1, 220),
    [width, thick],
  )
  useDisposable(geo)
  return (
    <group position={RIBBON_PIVOT} rotation={rot}>
      <group position={[-RIBBON_PIVOT[0], -RIBBON_PIVOT[1], -RIBBON_PIVOT[2]]}>
        <group position={offset} scale={scale}>
          <mesh geometry={geo} renderOrder={2} userData={{ noClay: true }}>
            {/* ผิวบน/ล่างและสันข้างเป็นวัสดุเดียวกัน — กระจกไม่มี "ผิวหน้า" ให้ปูลาย */}
            <MeshTransmissionMaterial
              attach="material-0"
              color={tint}
              transmission={transmission}
              thickness={thick * 3}
              ior={ior}
              roughness={rough}
              anisotropicBlur={0.4}
              chromaticAberration={chroma}
              samples={4}
              resolution={256}
              attenuationDistance={4}
              attenuationColor="#dff1ff"
              side={THREE.DoubleSide}
              transparent
            />
            <MeshTransmissionMaterial
              attach="material-1"
              color={tint}
              transmission={transmission}
              thickness={thick * 3}
              ior={ior}
              roughness={rough}
              anisotropicBlur={0.4}
              chromaticAberration={chroma}
              samples={4}
              resolution={256}
              attenuationDistance={4}
              attenuationColor="#dff1ff"
              side={THREE.DoubleSide}
              transparent
            />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/**
 * ตัวละครบนบอร์ด
 *
 * เคยใช้ท่า `skydive` ซึ่งเป็นท่านอนคว่ำกางแขน (ทำไว้ให้ฉาก tunnel) พอเอามาวางบนบอร์ด
 * มันอ่านเป็น "นอนราบอยู่บนถนน" ไม่ใช่ยืนโต้ — ใน ref ตัวละครยืน เข่างอ ชูหมัดข้างหนึ่ง
 * ท่าตั้งต้นของ Mascot คือยืน จึงเอียงลำตัวเอาเองแทนการยืมท่าผิดประเภท
 */
function Surfer(props) {
  const bob = useRef()
  useFrame(() => {
    const g = bob.current
    if (!g) return
    const t = clock.elapsedTime
    // โยกเหมือนกำลังเลี้ยงตัวบนคลื่น: ยกตัว + กระดกหัวบอร์ด + เอียงข้างเล็กน้อย
    g.position.y = Math.sin(t * 0.9) * 0.18
    g.rotation.x = Math.sin(t * 0.7 + 1.2) * 0.06
    g.rotation.z = Math.sin(t * 0.55 + 0.4) * 0.08
  })
  return (
    <group {...props}>
      <group ref={bob}>
        {/* บอร์ด: จานรีเขียวเข้ม กระดกหน้าเข้ากล้องนิดหนึ่ง — มุมพอดีขอบจะอ่านเป็นแท่ง */}
        <mesh position={[0, -0.05, 0]} rotation={[0.26, 0.34, 0]} scale={[1.35, 0.42, 0.44]}>
          <cylinderGeometry args={[1, 1, 0.16, 36]} />
          <meshStandardMaterial color={GREEN_DEEP} roughness={0.6} />
        </mesh>
        {/* เอียงตัวไปทางที่บอร์ดวิ่ง + บิดลำตัวเข้าหากล้องนิดหนึ่ง = ท่าเลี้ยงตัวบนบอร์ด */}
        <group position={[0, 2.02, 0]} rotation={[0.06, -0.35, -0.12]}>
          <Suspense fallback={null}>
            <Mascot scale={0.46} isolated noIdle noMug />
          </Suspense>
        </group>
      </group>
    </group>
  )
}

/** กล้อง parallax ตามเมาส์นิด ๆ — ฉากนิ่งสนิทจะอ่านเป็นภาพนิ่ง */
/**
 * กล้องแก้จากชีท perspective (12739:158714) ด้วยการวัดพิกเซล ไม่ได้กะจากสายตา
 *
 * วัดจากชีท 1199x735: เส้น horizon (เส้นแดง) อยู่แถว y=185, จุด vanishing สองข้าง
 * (จุดที่เส้นน้ำเงินหนาแน่นสุดบนเส้น horizon) อยู่ x=25 กับ x=1165
 *
 * แก้กลับเป็นค่ากล้อง — ให้ dL, dR = ระยะจาก VP ถึงกลางเฟรม, hOff = ระยะ horizon ถึงกลางเฟรม:
 *   k = sqrt(dL·dR) = f/cos(pitch) = 570 px
 *   pitch = asin(hOff / k)          = 18.67°
 *   f     = k·cos(pitch)            = 540 px
 *   fovY  = 2·atan((H/2) / f)       = 68.48°
 *   yaw ของแกนพื้น = atan(dL / k)    = 45.2°  → ตารางพื้นวางเฉียง 45° ไม่ใช่ขนานแกนโลก
 *
 * ข้อสำคัญ: ตำแหน่ง horizon ในเฟรมขึ้นกับ fov กับ pitch เท่านั้น ไม่เกี่ยวกับความสูงกล้อง
 * ("perspective ตรง ref" = fov กับ pitch ตรง; ความสูงกล้องกับขนาดของ = การจัดองค์ประกอบ)
 *
 * ค่าจริงทั้งหมดอยู่ใน tuner.js (DEFAULTS) ปรับสดได้จากแผงใน dev — ดู CameraTuner.jsx
 */
const RAD = Math.PI / 180

/**
 * gizmo เส้นทางเข้า — dev เท่านั้น
 *
 * จุดพวกนี้ไม่ได้ตั้งเอง แต่วัดจากกึ่งกลางความกว้างของริบบิ้น (ดู ribbonWaypoints ใน Entrance)
 * ใช้ตัวคิดเดียวกับตัวละครเป๊ะ เส้นที่เห็นจึงเป็นเส้นที่มันวิ่งจริง ไม่ใช่เส้นที่วาดเลียนแบบไว้
 */
const GIZ_SEGS = 120
const GIZ_F = { P: new THREE.Vector3(), T: new THREE.Vector3(), S: new THREE.Vector3(), N: new THREE.Vector3() }
const GIZ_V = new THREE.Vector3()
const GIZ_END = new THREE.Vector3()
const GIZ_REST = new THREE.Vector3()
const GIZ_TAN = new THREE.Vector3()

/** กลุ่มที่ gizmo อยู่ = พิกัดเดียวกับริบบิ้นเส้นหลักและตัวละคร */
const gizmoParent = (mesh) => mesh?.parent ?? mesh

function PathGizmo({ ride }) {
  const tube = useRef()
  const last = useRef('')
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(Array.from({ length: GIZ_SEGS + 1 }, () => new THREE.Vector3()), false, 'catmullrom', 0.5),
    [],
  )
  // ท่อแทนเส้น 1px — WebGL วาดเส้นได้บางเดียว มองไม่เห็นบนฉากที่มีลายเยอะ
  useFrame(() => {
    const t = getTuner()
    if (!ride || !tube.current) return
    /**
     * สร้างใหม่เฉพาะตอนค่าที่กำหนดรูปเส้นเปลี่ยน — ทั้งของทางเข้าและของตัวริบบิ้นเอง
     * (เส้นเกาะผิวริบบิ้น ขยับริบบิ้นทีเดียวเส้นต้องตามไปด้วย)
     */
    const key = [
      t.enPT0, t.enT0, t.enT1, t.enUp, t.enBackZ, t.enBlend, t.enBurstAt, t.enBurstAmt,
      t.skaterX, t.skaterY, t.skaterZ,
      t.ribbonX, t.ribbonY, t.ribbonZ, t.ribbonRotX, t.ribbonRotY, t.ribbonRotZ,
      t.ribbonScale, t.ribbonWave, t.ribbonWaves,
      t.prX, t.prY, t.prZ, t.prRotX, t.prRotY, t.prRotZ, t.prScale, t.prWave, t.prWaves,
      entranceLift.value.toFixed(2),
    ].join('|')
    if (key === last.current) return
    last.current = key
    /**
     * เส้นที่วาด = สูตรเดียวกับที่ตัวละครใช้ทุกบรรทัด (ระยะทางตามจังหวะพุ่ง + คลื่นของผิว
     * + การเลื่อนเข้าที่หยุดช่วงท้าย) ไม่ใช่เส้นที่วาดเลียนแบบไว้คนละสูตร
     */
    entranceSample(ride, t, 1, GIZ_END, GIZ_TAN, GIZ_F, gizmoParent(tube.current), null, entranceLift.value)
    for (let i = 0; i <= GIZ_SEGS; i += 1) {
      const pp = i / GIZ_SEGS
      entranceSample(ride, t, entranceU(t, pp), GIZ_V, GIZ_TAN, GIZ_F, gizmoParent(tube.current), null, entranceLift.value)
      const bl = entranceBlend(t, pp)
      curve.points[i]
        .copy(GIZ_V)
        .addScaledVector(GIZ_END, -bl)
        .addScaledVector(GIZ_REST.set(t.skaterX, t.skaterY, t.skaterZ), bl)
    }
    curve.updateArcLengths()
    const old = tube.current.geometry
    tube.current.geometry = new THREE.TubeGeometry(curve, 200, 0.1, 6, false)
    old?.dispose()
  })
  return (
    <mesh ref={tube} renderOrder={5}>
      <meshBasicMaterial color="#6ee7b7" depthTest={false} transparent opacity={0.9} />
    </mesh>
  )
}

function CameraRig() {
  useFrame((state, dt) => {
    const cam = state.camera
    /**
     * จอแคบต้องถอยกล้อง ไม่ใช่ปล่อยให้ตัวละครโดนขอบตัด
     *
     * เฟรมนี้จัดไว้ที่อัตราส่วนราว 16:10 ของคอมพ์ พอจอเป็นแนวตั้ง ความกว้างที่เห็นหดลง
     * ตามสัดส่วนทันที (fov คุมแกนตั้ง) ของที่วางไว้ริมซ้าย-ขวาจึงหลุดเฟรมไปหมด
     * ถอยตามส่วนกลับของอัตราส่วน แล้วเลื่อนกล้องตามตัวละครซึ่งอยู่ค่อนซ้าย
     */
    // ถอยได้จำกัด — ถอยเกิน 1.25 เท่าแล้วครึ่งบนของจอเหลือแต่พื้นหลังว่าง เสียเฟรมกว่าโดนตัด
    const t = getTuner()
    const fit = clamp(1.62 / (state.size.width / state.size.height), 1, t.fitMax)
    /**
     * อินโทรของกล้อง: เริ่มจากมุมที่เข้าใกล้/ต่ำ/เฉียงกว่า แล้วค่อย ๆ ถอยกลับมาที่มุมจริง
     * ฉากมีชั้นลึก (หน้าต่าง → ริบบิ้น → ตัวละคร → ของลอยหน้าสุด) กล้องที่เคลื่อนคือสิ่งที่
     * ทำให้เห็น parallax ของชั้นเหล่านั้น — ทุกอย่างโผล่บนกล้องนิ่งจะแบนเหมือนสไลด์
     */
    const it = t.intro > 0.5 ? introTime() : 99
    const k = it < 0 ? 1 : Math.pow(1 - Math.min(1, it / Math.max(0.05, t.inCamDur)), 5)
    const dollyZ = t.inCamDolly * k
    const dollyX = t.inCamX * k
    const dollyY = t.inCamY * k
    cam.position.z = damp(cam.position.z, t.camZ * fit + dollyZ, 0.06, dt)
    cam.position.x = damp(cam.position.x, t.camX - (fit - 1) * 2.1 + state.pointer.x * 0.6 + dollyX, 0.06, dt)
    cam.position.y = damp(cam.position.y, t.camY + state.pointer.y * 0.4 + dollyY, 0.06, dt)
    // fov มาจากแผงปรับ — เปลี่ยนแล้วต้อง updateProjectionMatrix เอง
    if (cam.fov !== t.fov) {
      cam.fov = t.fov
      cam.updateProjectionMatrix()
    }
    /**
     * ตั้งมุมก้มตรง ๆ ไม่ใช้ lookAt
     *
     * lookAt จุดคงที่ทำให้มุมก้มเปลี่ยนทุกครั้งที่กล้องขยับ (parallax/ถอยตามอัตราส่วน)
     * แล้วเส้น horizon ก็เลื่อนตาม — perspective ที่วัดมาจาก ref จะไม่นิ่ง
     */
    cam.rotation.order = 'YXZ'
    cam.rotation.set(-t.pitch * RAD, t.inCamYaw * RAD * k, 0)
  })
  return null
}

/* ---------- ฉากรวม ---------- */

function Scene() {
  const t = useTuner()
  const clay = t.clay > 0.5
  const props = t.props > 0.5
  const skater = t.skater > 0.5
  /**
   * โหมด clay ปิดพอร์ทัลเสมอ
   *
   * clay มีไว้ดูรูปทรงของโมเดล การเปิดพอร์ทัลค้างไว้ทำให้ฉากในหน้าต่าง (ซึ่งอยู่นอก
   * กลุ่ม Clay จึงยังมีสีของตัวเอง) กินพื้นที่ครึ่งจอ แล้วหน้าต่างก็ไม่เหลือรูปทรง
   * ให้ตรวจเพราะมันเป็นหน้ากากที่ไม่เขียนสี — เหลือเป็นเทาปนขาวทั้งจอ อ่านอะไรไม่ได้
   */
  const portal = t.portal > 0.5 && !clay
  const grid = clay ? GRID.clay : GRID.color
  // exposure อยู่บนตัว renderer ไม่ใช่ใน scene graph จึงต้องเขียนเองเมื่อค่าเปลี่ยน
  /**
   * เรื่องราวของอินโทร (ฟังก์ชันอ่านทุกเฟรม ไม่ผ่าน React):
   * เคอร์เซอร์พุ่งเข้ามาแล้ว "คลิก" → สวิตช์สับจากปิดเป็นเปิด (เด้งเกินนิด) → ดาวในหน้าต่าง
   * หมุนติ้วตอนบานเปิดแล้วค่อยผ่อนเป็นความเร็วปกติ
   */
  const clickAt = t.enDelay + t.enDur + t.inPropAt + t.inClickAt
  const swPos = useMemo(
    () => () => {
      const tt = getTuner()
      if (tt.intro < 0.5) return tt.bcPos
      const u = (introTime() - clickAt) / 0.35
      if (u <= 0) return 0
      return tt.bcPos * (u >= 1 ? 1 : introBack(u, 1.7))
    },
    [clickAt],
  )
  const cuPress = useMemo(
    () => () => {
      const tt = getTuner()
      if (tt.intro < 0.5) return 0
      const u = (introTime() - clickAt + 0.14) / 0.28
      return u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI)
    },
    [clickAt],
  )
  const gbSpin = useMemo(
    () => () => {
      const tt = getTuner()
      if (tt.intro < 0.5) return 0
      const it = introTime()
      return it < 0 ? 0 : tt.inGlobeSpin * Math.exp(-it * 1.2)
    },
    [],
  )
  const flat = t.flat > 0.5 && !clay
  const flatTone = flat && t.flatTone < 0.5
  useFrame(({ gl }) => {
    if (gl.toneMappingExposure !== t.exposure) gl.toneMappingExposure = t.exposure
    /**
     * โหมดแบนไม่เอา ACES — มันบีบสีสด ๆ ให้หม่นและไล่เฉดกลับเข้ามาในชั้นที่ตั้งใจให้แบน
     * three ตรวจ toneMapping ของ renderer ทุกครั้งที่ setProgram จึงสลับได้โดยไม่ต้อง needsUpdate
     */
    const tm = flatTone ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping
    if (gl.toneMapping !== tm) gl.toneMapping = tm
  })
  /** cel shading: โหมดแบนบังคับผิวด้าน (roughness 1) แล้วตัดแสงเป็น 3 ชั้นที่ shader */
  const cel = flat
    ? {
        edge: t.flatEdge,
        hiEdge: t.flatHiEdge,
        soft: t.flatSoft,
        shadow: t.flatShadow,
        lit: t.flatLit,
        hi: t.flatHi,
        tint: t.flatTint,
      }
    : null
  /**
   * ริบบิ้นตัวเดียวกัน ใช้ทั้งในฉากของหน้าต่างและในฉากหลัก
   *
   * ฉากใน portal ใช้กล้องตัวเดียวกัน พิกัดโลกจึงตรงกันเป๊ะ ไม่ต้องชดเชยอะไร
   * ส่วนที่อยู่หลังบานกระจกจะถูกเห็นผ่านหน้าต่าง ส่วนที่พ้นออกมาแล้วเห็นจากฉากหลัก
   */
  /**
   * เส้นทางให้ตัวละครไถลบนริบบิ้นจริง — เส้นเดียวกับ geometry + เมทริกซ์ของกลุ่มที่ห่อมัน
   * (หมุนรอบปากช่อง, ออฟเซ็ต, สเกล) แปลงเป็นพิกัดกลุ่มแถบหน้าต่างซึ่งเป็นพิกัดของตัวละคร
   */
  /**
   * เส้นทางให้ตัวละครไถลบนริบบิ้นจริง — เส้นเดียวกับ geometry + เมทริกซ์ของกลุ่มที่ห่อมัน
   * (หมุนรอบปากช่อง, ออฟเซ็ต, สเกล) แปลงเป็นพิกัดกลุ่มแถบหน้าต่างซึ่งเป็นพิกัดของตัวละคร
   */
  const ride = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(RIBBON_PATH, false, 'catmullrom', 0.6)
    const piv = new THREE.Vector3(...RIBBON_PIVOT)
    const m = new THREE.Matrix4()
      .makeTranslation(piv.x, piv.y, piv.z)
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(t.ribbonRotX * RAD, t.ribbonRotY * RAD, t.ribbonRotZ * RAD)))
      .multiply(new THREE.Matrix4().makeTranslation(-piv.x, -piv.y, -piv.z))
      .multiply(new THREE.Matrix4().makeTranslation(t.ribbonX, t.ribbonY, t.ribbonZ))
      .multiply(new THREE.Matrix4().makeScale(t.ribbonScale, t.ribbonScale, t.ribbonScale))
    // t ของ "ปากช่องบานที่ 2" บนเส้นหลัก — จุดที่ริบบิ้นหน้าเริ่มถูกวาด (ดู tCut ใน CheckerRibbon)
    const exit = RIBBON_PATH[4]
    const P = new THREE.Vector3()
    let mouthT = 0
    let bestD = Infinity
    for (let i = 0; i <= 600; i++) {
      const d = curve.getPointAt(i / 600, P).distanceTo(exit)
      if (d < bestD) {
        bestD = d
        mouthT = i / 600
      }
    }
    return {
      curve,
      matrix: m,
      wave: t.ribbonWave,
      waves: t.ribbonWaves,
      frame: ribbonFrame,
      mouthT,
    }
  }, [t.ribbonRotX, t.ribbonRotY, t.ribbonRotZ, t.ribbonX, t.ribbonY, t.ribbonZ, t.ribbonScale, t.ribbonWave, t.ribbonWaves])
  const ribbon = (
    <CheckerRibbon
      width={t.ribbonW}
      thick={t.ribbonThick}
      wave={t.ribbonWave}
      waves={t.ribbonWaves}
      scale={t.ribbonScale}
      offset={[t.ribbonX, t.ribbonY, t.ribbonZ]}
      rot={[t.ribbonRotX * RAD, t.ribbonRotY * RAD, t.ribbonRotZ * RAD]}
    />
  )
  // ref ไม่มีพื้น ของทุกชิ้นลอยในที่ว่าง — ตารางพื้นเป็นแค่ตัวช่วยตอนจัดมุม
  const showGrid = t.grid > 0.5
  return (
    <Gloss
      on={(flat || t.gloss > 0.5) && !clay}
      rough={flat ? 1 : t.glossRough}
      env={flat ? t.flatEnv : t.glossEnv}
      cel={cel}
    >
      <IntroClock />
      {clay ? (
        /**
         * ไฟแบบ studio ของวิวพอร์ต: key เฉียงบนซ้าย, fill อ่อนฝั่งตรงข้าม, rim จากหลัง
         * ambient ต่ำกว่าโหมดสี เพราะ clay ต้องอ่านรูปทรงจากไล่เงา ไม่ใช่จากสี
         */
        <>
          {/* ค่าชุดนี้ลดลงจากเดิมราวครึ่ง — ตอนตั้งครั้งแรกยังไม่มี exposure มาคูณทับ
              รวมกันแล้วดินเหนียวสว่างจนชนเพดาน ทุกหน้าขาวเท่ากันจนอ่านทรงไม่ออก */}
          <ambientLight intensity={0.22} color="#ffffff" />
          <directionalLight position={[-6, 9, 7]} intensity={0.85} color="#ffffff" />
          <directionalLight position={[7, 2, 5]} intensity={0.28} color="#dfe6ee" />
          <directionalLight position={[0, 4, -10]} intensity={0.3} color="#ffffff" />
        </>
      ) : (
        <>
          {/**
           * ชุดไฟสามดวง + ฟ้า/พื้น แทนการดัน ambient ให้สว่าง
           *
           * ambient สูง ๆ สว่างจริงแต่ทุกหน้าได้แสงเท่ากันหมด ทรงเลยแบนเป็นกระดาษตัด
           * ความ "กระจ่างและมีชีวิต" มาจากการที่แต่ละหน้าได้แสงคนละค่า ไม่ใช่ค่าเฉลี่ยที่สูงขึ้น
           * จึงลด ambient ลงแล้วไปเพิ่มที่ key/fill/rim แทน
           *
           * hemisphereLight คือตัวที่ให้ "ชีวิต" ถูกที่สุด — ด้านบนรับสีฟ้าของหน้า
           * ด้านล่างรับสีอุ่นสะท้อนขึ้นมา เงาจึงมีสีแทนที่จะเป็นเทาตาย
           */}
          <ambientLight intensity={t.ambIntensity} color="#ffffff" />
          <hemisphereLight
            intensity={t.hemiIntensity}
            color={BG_MID}
            groundColor="#ffd9a8"
          />
          {/* key: เฉียงบนซ้ายหน้า อุ่น — ตัวกำหนดทิศของเงาทั้งฉาก */}
          <directionalLight position={[-5, 8, 7]} intensity={t.keyIntensity} color="#fff4e2" />
          {/* fill: ฝั่งตรงข้าม เย็น รับสีพื้นน้ำเงินของหน้า ไม่ให้ด้านมืดเป็นดำตัน */}
          <directionalLight position={[7, 1, 5]} intensity={t.fillIntensity} color="#cfe0ff" />
          {/* rim: จากหลัง ตัดขอบตัวละครออกจากแผงขาวข้างหลัง */}
          <directionalLight position={[2, 6, -9]} intensity={t.rimIntensity} color="#ffffff" />
          {/**
           * แผงไฟนุ่ม (Environment + Lightformer) — หัวใจของหน้าตาแบบ claymorphism
           *
           * ไฟจุด/ไฟทิศทางให้ "ขอบเงาคม" เสมอ ต่อให้ลด intensity ลงก็ยังเป็นเงาที่มีขอบ
           * ดินน้ำมันไม่ใช่แบบนั้น: มันรับแสงจากแผงกว้าง ๆ รอบตัว ไล่จากสว่างไปมืดยาว ๆ
           * ไม่มีจุดไฮไลต์แข็ง ๆ Lightformer คือแผงแบบนั้น — วางเป็นวัตถุเรืองแสงในฉาก
           * แล้วอบเป็น environment map ให้ทุกผิวเอาไปใช้
           *
           * frames={1} อบครั้งเดียวตอนขึ้นฉาก ไม่ได้เรนเดอร์ซ้ำทุกเฟรม
           * (ไม่มีอะไรในแผงไฟขยับ อบใหม่ทุกเฟรมคือจ่ายค่า cube render ฟรี ๆ)
           */}
          <Environment resolution={128} frames={1}>
            {/* แผงหลักเฉียงบนซ้าย อุ่น — ตรงทิศเดียวกับ key ให้เงาไปทางเดียวกัน */}
            <Lightformer
              form="rect"
              intensity={t.envIntensity * 2.2}
              position={[-6, 8, 8]}
              scale={[14, 14, 1]}
              color="#fff1dc"
            />
            {/* แผงรองฝั่งตรงข้าม เย็น รับสีพื้นน้ำเงินของหน้า */}
            <Lightformer
              form="rect"
              intensity={t.envIntensity}
              position={[8, 2, 5]}
              scale={[10, 10, 1]}
              color="#d5e6ff"
            />
            {/* แผงล่าง อุ่น — แสงสะท้อนขึ้นมาจากพื้น ทำให้ใต้คางกับใต้แขนไม่ทึบ */}
            <Lightformer
              form="ring"
              intensity={t.envIntensity * 0.7}
              position={[0, -8, 4]}
              scale={16}
              color="#ffdcae"
            />
          </Environment>
        </>
      )}

      {/**
       * เอฟเฟกต์กล้อง — ต้องอยู่ในฉาก เพราะมันเข้าไปแทนลูปวาดของ r3f (useFrame priority 1)
       * ปิดไว้ (fx = 0) แล้วไม่มีต้นทุนอะไรเลย ฉากวาดตามปกติ
       */}
      {(t.fx > 0.5 || t.rimFx > 0.5) && (
        <CameraFX
          rim={t.rimFx > 0.5 ? t.rimFxInt : 0}
          rimW={t.rimFxW}
          rimSoft={t.rimFxSoft}
          rimThresh={t.rimFxThresh}
          rimMix={t.rimFxMix}
          rimAngle={t.rimFxAngle}
          rimFall={t.rimFxFall}
          rimShade={t.rimFxShade}
          rimBack={t.rimFxBack}
          tone={flatTone ? 0 : 1}
          fish={t.fxFish}
          skewX={t.fxSkewX}
          skewY={t.fxSkewY}
          zoom={t.fxZoom}
          chroma={t.fxChroma}
          bulge={t.fxBulge}
          bulgeR={t.fxBulgeR}
          bulgeX={t.fxBulgeX}
          bulgeY={t.fxBulgeY}
        />
      )}

      <Backdrop clay={clay} />
      {/**
       * พื้นตาราง — วางที่ y -7.2 ซึ่งเป็นระดับฐานของแผงพอดี แผงจึงยืนบนพื้นจริง ไม่ใช่ลอย
       * fade ก่อนถึงเส้น horizon ไม่งั้นเส้นจะถี่จนกลายเป็นแถบทึบตรงขอบฟ้า (moiré)
       */}
      {showGrid && (
      <Grid
        position={[0, t.gridY, 0]}
        rotation={[0, t.groundYaw * RAD, 0]}
        infiniteGrid
        cellSize={t.gridCell}
        cellThickness={1.0}
        cellColor={grid.line}
        sectionSize={t.gridCell * 4}
        sectionThickness={2.0}
        sectionColor={grid.major}
        fadeDistance={95}
        fadeStrength={1.0}
        fadeFrom={0}
      />
      )}
      {/* ทุกอย่างในนี้โดนวัสดุ clay ทับ — พื้นหลังกับกริดอยู่นอก จึงคงสีวิวพอร์ตไว้ */}
      <Clay on={clay}>
      {props && <SoftCircles />}

      {/**
       * แถบแผงครีม = เวทีกลางภาพ ไม่ใช่แผงลอยเป็นใบ ๆ
       *
       * ใน ref แผงเรียงต่อกันเกือบทึบตลอดความกว้าง และใบริมสุดถูกขอบเฟรมตัด — มันคือ
       * "พื้นหลังชั้นกลาง" ที่ของทุกชิ้นวางอยู่หน้ามัน ถ้าเว้นช่องให้เห็นพื้นหลังระหว่างใบ
       * ทั้งฉากจะกลายเป็นของลอยกระจายในที่ว่าง ซึ่งเป็นสิ่งที่ผิดที่สุดของเวอร์ชันก่อน
       * (ที่ z -11 ครึ่งความกว้างเฟรมราว 15 หน่วย ใบริมจึงต้องเลย ±13 ออกไป)
       */}
      {/**
       * หมุนรอบ "ระนาบแผง" ไม่ใช่รอบจุดกำเนิดโลก
       *
       * ถ้าใส่ rotation ให้กลุ่มที่มี Panel วางอยู่ที่ z = panelZ กลุ่มจะหมุนรอบ (0,0,0)
       * ซึ่งลาก x ของทุกใบไปด้วยเป็นระยะ panelZ·sin(yaw) — เลื่อนไปทั้งแถบเกือบหนึ่งช่อง
       * ย้าย panelZ ออกมาเป็น position ของกลุ่มนอก แล้วหมุนกลุ่มใน ตำแหน่งจึงตรงกับ
       * สมการที่แก้จากเส้นที่วาดไว้
       */}
      <group position={[0, 0, t.panelZ]}>
      <group rotation={[0, t.bandYaw * RAD, 0]}>
        {/**
         * ขนาดถอดจากสัดส่วนในเฟรมของ ref: แผงกินความสูงจาก 28% ถึง 71% ของเฟรม
         * ก่อนหน้านี้กินแค่ 24-51% เพราะแผงเตี้ยเกิน ทั้งแถบเลยอ่านเป็นแนวรั้วไกล ๆ
         * ไม่ใช่เวทีที่ของทุกชิ้นวางอยู่หน้า — ฐานแผงต้องต่ำจนถนนวิ่งตัดหน้ามันได้
         */}
        {/**
         * ห้าใบเท่ากันเป๊ะ: w/h/d เท่ากัน ระยะห่างเท่ากัน อยู่ระนาบ z เดียวกัน
         * ขนาดที่เห็นในเฟรมต่างกันเองจาก perspective — ไม่ต้องไปสุ่มขนาดช่วย
         */}
        {/**
         * ขนาดแก้จากสมการฉายภาพ ไม่ได้ลองปรับเอา — ที่ระนาบ z -11 กล้องชุดนี้เห็น
         * กว้าง ±30.7 หน่วย และแถบแผงของ ref กินแนวตั้งจาก y 4.68 ถึง -12.36
         * และแถบแผงใน ref กินแนวตั้งจาก y 4.68 (จอ 28%) ถึง -10.94 (จอ 68%)
         * ดังนั้นสูง 15.62 ฐาน -10.94 กว้าง 11.5 ห่างกัน 13.3
         */}
        {Array.from({ length: Math.round(t.panelCount) }, (_, i) => {
          // เรียงสมมาตรรอบศูนย์ ระยะห่างเท่ากันทุกช่อง ไม่ว่าจะกี่ใบ
          const x = t.panelX + (i - (Math.round(t.panelCount) - 1) / 2) * t.panelGap
          return (
            /* อินโทร: บานโผล่ทีละบานจากซ้ายไปขวา (ขยายจากศูนย์ เลยเป้านิดแล้วดีดกลับ) */
            <Appear
              key={i}
              at={t.inWinAt + i * t.inWinStep}
              dur={t.inWinDur}
              over={t.inOver}
              rise={t.inWinRise}
              tilt={t.inWinTilt * RAD}
              position={[x, t.panelBase + t.panelH / 2, 0]}
            >
              <Panel w={t.panelW} h={t.panelH} d={t.panelD} portal={portal} />
            </Appear>
          )
        })}
        {ribbon}
        {/* ริบบิ้นกระจก — พุ่งออกจากปากบานที่ 2 คนละชิ้นกับเส้นหมากรุก */}
        {t.gr > 0.5 && !clay && (
          <GlassRibbon
            width={t.grW}
            thick={t.grThick}
            scale={t.grScale}
            offset={[t.grX, t.grY, t.grZ]}
            rot={[t.grRotX * RAD, t.grRotY * RAD, t.grRotZ * RAD]}
            rough={t.grRough}
            transmission={t.grTrans}
            chroma={t.grChroma}
            ior={t.grIor}
            tint="#eef7ff"
          />
        )}
        {/**
         * สวิตช์ — ลอยอยู่หน้าแถบหน้าต่าง ไม่ใช่ของในพอร์ทัล
         *
         * อยู่ในกลุ่มเดียวกับริบบิ้น/ตัวละคร พิกัดจึงเป็นระบบเดียวกับของสองชิ้นนั้น
         * วางเทียบกับปากหน้าต่างได้ตรง ๆ และยังตามไปด้วยเมื่อหมุน bandYaw
         */}
        {t.bc > 0.5 && (
          <Appear
            at={t.enDelay + t.enDur + t.inPropAt + t.inPropGap}
            dur={t.inPropDur}
            over={t.inOver}
            from={[-3 * t.inPropDist, -0.5 * t.inPropDist, -5 * t.inPropDist]}
          >
          <Switch
            len={t.bcLen}
            radius={t.bcRadius}
            thickness={t.bcThick}
            knobSize={t.bcKnob}
            knobThick={t.bcKnobThick}
            knobProud={t.bcKnobProud}
            pos={t.bcPos}
            posAt={swPos}
            opacity={t.bcOpacity}
            icon={t.bcIcon}
            outline={t.bcOutline}
            outlineAlpha={t.bcOutlineAlpha}
            showEdges={t.bcEdges > 0.5}
            edgeAngle={t.bcEdgeAngle}
            glass={t.bcGlass}
            blur={t.bcBlur}
            env={t.bcEnv}
            ior={t.bcIor}
            chroma={t.bcChroma}
            position={[t.bcX, t.bcY, t.bcZ]}
            rotation={[t.bcRotX * RAD, t.bcRotY * RAD, t.bcRotZ * RAD]}
            scale={t.bcScale}
          />
          </Appear>
        )}
        {/* เคอร์เซอร์พิกเซล — ของลอยหน้าหน้าต่าง นอกพอร์ทัล พิกัดกลุ่มเดียวกับสวิตช์ */}
        {t.cu > 0.5 && (
          <Appear
            at={t.enDelay + t.enDur + t.inPropAt}
            dur={t.inPropDur}
            over={t.inOver}
            from={[3 * t.inPropDist, 2 * t.inPropDist, -5 * t.inPropDist]}
          >
          <Cursor
            pressAt={cuPress}
            aim={t.cuAim}
            aimMax={t.cuAimMax * RAD}
            aimEase={t.cuAimEase}
            depth={t.cuDepth}
            outline={t.cuOutline}
            position={[t.cuX, t.cuY, t.cuZ]}
            rotation={[t.cuRotX * RAD, t.cuRotY * RAD, t.cuRotZ * RAD]}
            scale={t.cuScale}
          />
          </Appear>
        )}
        {/* เส้นทางวางเอง (debug): เส้น + ลูกบอลที่ waypoint ในพิกัดกลุ่มนี้ */}
        {import.meta.env.DEV && t.enPath > 0.5 && t.enShowPath > 0.5 && <PathGizmo ride={ride} />}
        {/* ตัวละครอยู่ในพิกัดกลุ่มเดียวกับริบบิ้น จะได้วางบนถนนได้ตรง ๆ ไม่ต้องแปลงพิกัด */}
        {/**
         * ตัวละครห่อด้วย Entrance: กลุ่มนอกถือปลายทาง (ค่าจากแผง) กลุ่มในวิ่งเข้ามาจาก
         * ในหน้าต่าง — ค่า skaterX/Y/Z จึงยังหมายถึง "ที่หยุด" เหมือนเดิม
         */}
        {skater && (
          <Entrance
            replay={t.enReplay}
            ride={ride}
            rideMode={t.enRide > 0.5}
            pathMode={t.enPath > 0.5}
            position={[t.skaterX, t.skaterY, t.skaterZ]}
            rotation={[t.skaterRotX * RAD, t.skaterRotY * RAD, t.skaterRotZ * RAD]}
            scale={t.skaterScale}
          >
          <Rider
            bob={t.idle > 0.5}
            breathe={t.breathe > 0.5}
            idleAmp={t.idleAmp}
            idleSpeed={t.idleSpeed}
            rimPower={t.rimPower}
            rimBoost={t.rimBoost}
            rimEdge={t.rimEdge}
            rimSoft={t.rimSoft}
            rimDirMix={t.rimDirMix}
            rimYaw={t.rimYaw}
            rimPitch={t.rimPitch}
            flatBands={t.flatBands}
            mascotScale={t.mascotScale}
            mascotLift={t.mascotLift}
            boardScale={t.boardScale}
            armScale={t.armScale}
            foreScale={t.foreScale}
            boardRot={[t.boardRotX * RAD, t.boardRotY * RAD, t.boardRotZ * RAD]}
            boardOffset={[t.boardX, t.boardY, t.boardZ]}
            boardSpec={{
              deckLen: t.bdLen,
              deckWide: t.bdWide,
              deckThick: t.bdThick,
              kickStart: t.bdKickAt,
              kickH: t.bdKick,
              concave: t.bdConcave,
              truckX: t.bdTruckX,
              wheelR: t.bdWheelR,
              wheelW: t.bdWheelW,
              deckY: t.bdRideY,
            }}
            followOverride={{
              headYaw: t.hf > 0.5 ? t.hfYaw : 0,
              headPitch: t.hf > 0.5 ? t.hfPitch : 0,
              headRoll: t.hf > 0.5 ? t.hfRoll : 0,
              headEase: t.hfEase,
              headBaseYaw: t.hfBaseYaw,
              headBaseRoll: t.hfBaseRoll,
              headBasePitch: t.hfBasePitch,
              headFollow: t.hfFollow,
              headCurve: t.hfCurve,
              headDead: t.hfDead,
              headBounce: t.hfBounce,
              headIdleBack: t.hfIdleBack,
            }}
            facePose={{
              eye: t.fcEye,
              gap: t.fcGap,
              eyeY: t.fcEyeY,
              pupil: t.fcPupil,
              pupilX: t.fcPupilX,
              pupilY: t.fcPupilY,
              look: t.fcLook,
              brow: t.fcBrow,
              browY: t.fcBrowY,
              browArc: t.fcBrowArc,
              browTilt: t.fcBrowTilt * RAD,
              mouth: t.fcMouth,
              mouthH: t.fcMouthH,
              mouthX: t.fcMouthX,
              mouthY: t.fcMouthY,
              x: t.fcX,
              y: t.fcY,
              z: t.fcZ,
              rotX: t.fcRotX * RAD,
              rotY: t.fcRotY * RAD,
              rotZ: t.fcRotZ * RAD,
              scale: t.fcScale,
              lookEvery: t.fcLookEvery,
              blinkEvery: t.fcBlinkEvery,
            }}
            torsoPose={{
              leanX: t.leanX * RAD,
              leanZ: t.leanZ * RAD,
              foldX: t.foldX * RAD,
              foldY: t.foldY * RAD,
              foldZ: t.foldZ * RAD,
              headX: t.headX * RAD,
            }}
            legPose={{
              spread: t.legSpread,
              stagger: t.legStagger,
              L: {
                hipX: t.hipLX * RAD,
                hipY: t.hipLY * RAD,
                hipZ: t.hipLZ * RAD,
                knee: t.kneeL * RAD,
                ankle: t.ankleL * RAD,
              },
              R: {
                hipX: t.hipRX * RAD,
                hipY: t.hipRY * RAD,
                hipZ: t.hipRZ * RAD,
                knee: t.kneeR * RAD,
                ankle: t.ankleR * RAD,
              },
            }}
            armPose={{
              /* เลื่อนโคนแขน — ไม่ใช่องศา จึงไม่คูณ RAD */
              aimOut: t.aimOut,
              aimUp: t.aimUp,
              aimFwd: t.aimFwd,
              mugOut: t.mugOut,
              mugUp: t.mugUp,
              mugFwd: t.mugFwd,
              aimRotX: t.aimRotX * RAD,
              aimRotY: t.aimRotY * RAD,
              aimRotZ: t.aimRotZ * RAD,
              mugRotX: t.mugRotX * RAD,
              mugRotY: t.mugRotY * RAD,
              mugRotZ: t.mugRotZ * RAD,
              aimX: t.aimX,
              aimY: t.aimY,
              aimZ: t.aimZ,
              elbowX: t.elbowX * RAD,
              elbowY: t.elbowY * RAD,
              elbowZ: t.elbowZ * RAD,
              handScale: t.handScale,
              handX: t.handX,
              handY: t.handY,
              handZ: t.handZ,
              wristX: t.wristX * RAD,
              wristY: t.wristY * RAD,
              wristZ: t.wristZ * RAD,
              mugShX: t.mugShX * RAD,
              mugShY: t.mugShY * RAD,
              mugShZ: t.mugShZ * RAD,
              mugHandScale: t.mugHandScale,
              mugHandX: t.mugHandX,
              mugHandY: t.mugHandY,
              mugHandZ: t.mugHandZ,
              mugWristX: t.mugWristX * RAD,
              mugWristY: t.mugWristY * RAD,
              mugWristZ: t.mugWristZ * RAD,
              mugElX: t.mugElX * RAD,
              mugElY: t.mugElY * RAD,
              mugElZ: t.mugElZ * RAD,
            }}
          />
          </Entrance>
        )}
      </group>
      </group>
      {/* ต้องอยู่หลังแถบหน้าต่างในลำดับ JSX — หน้ากาก stencil ต้องถูกวาดก่อนของข้างใน */}
      {portal && (
        <InsideWindow>
          <WindowWorld
            z={t.portalZ}
            globe={
              t.gb > 0.5 && {
                pos: [t.gbX, t.gbY, t.gbZ],
                rot: [t.gbRotX * RAD, t.gbRotY * RAD, t.gbRotZ * RAD],
                scale: t.gbScale,
                speed: t.gbSpeed,
                seed: Math.round(t.gbSeed),
                road: t.gbRoad,
                bushes: Math.round(t.gbBushes),
                cones: Math.round(t.gbCones),
                rounds: Math.round(t.gbRounds),
                mushrooms: Math.round(t.gbMushrooms),
                flowers: Math.round(t.gbFlowers),
                berries: Math.round(t.gbBerries),
                pebbles: Math.round(t.gbPebbles),
                propScale: t.gbProp,
                spinBoost: gbSpin,
              }
            }
            wall={t.portalWall > 0.5}
            hemi={t.portalHemi}
            keyLight={t.portalKey}
            stack={
              t.sw > 0.5 && {
                count: t.swCount,
                step: [t.swDX, t.swDY, t.swDZ],
                w: t.swW,
                h: t.swH,
                barRatio: t.swBar,
                depth: t.swDepth,
                radius: t.swRadius,
                btnRatio: t.swBtn,
                inset: t.swInset,
                pos: [t.swX, t.swY, t.swZ],
                rot: [t.swRotX * RAD, t.swRotY * RAD, t.swRotZ * RAD],
                scale: t.swScale,
              }
            }
            tetris={
              t.te > 0.5 && {
                shape: t.teShape,
                depth: t.teDepth,
                radius: t.teRadius,
                gap: t.teGap,
                pos: [t.teX, t.teY, t.teZ],
                rot: [t.teRotX * RAD, t.teRotY * RAD, t.teRotZ * RAD],
                scale: t.teScale,
              }
            }
            ribbon={{
              width: t.prW,
              thick: t.prThick,
              wave: t.prWave,
              waves: t.prWaves,
              scale: t.prScale,
              offset: [t.prX, t.prY, t.prZ],
              rot: [t.prRotX * RAD, t.prRotY * RAD, t.prRotZ * RAD],
            }}
          />
        </InsideWindow>
      )}
      {props && (
        <>
          <BigDisc position={[9.2, -0.3, -13.5]} scale={1.15} />
          <TileBlock position={[7.6, -1.1, -6.5]} rotation={[0.08, -0.4, 0]} />
        </>
      )}

      {props && (
        /**
         * ของลอยทั้งชุดถูกจัดตำแหน่งไว้ตอนฉากยังเล็กกว่านี้ (fov 44 แผงสูง 10)
         * พอกล้องเปลี่ยนตาม ref ฉากโตขึ้นราวหนึ่งเท่าครึ่ง ของเลยจมอยู่กลางเฟรม
         * ยกทั้งชุดด้วยสเกล/ออฟเซ็ตเดียว ปรับจากแผงได้ ดีกว่าไล่แก้ทีละชิ้นสามสิบชิ้น
         */
        <group scale={t.propScale} position={[t.propX, t.propY, t.propZ]}>
      {/* ตัวละครยืนบนถนน ณ ช่วงที่มันเริ่มโตเข้าหากล้อง — จุดที่สายตาตกก่อนของทุกชิ้น */}
      <Surfer position={[-1.9, -2.6, 1.4]} rotation={[0, 0.2, 0.04]} scale={1.7} />

      {/* ของลอยรอบตัว — ตำแหน่งตามภาพฉากประกอบเสร็จ */}
      <Float position={[3.4, 1.3, -1.8]} phase={1.2} rot={0.09}>
        <BeaconSign scale={1.0} rotation={[0.1, 0.62, -0.12]} />
      </Float>
      <Float position={[-9.6, -0.5, -1.5]} phase={2.6}>
        <AppIcon size={2} rotation={[0.05, 0.5, -0.12]} />
      </Float>
      <Float position={[-4.8, 1.7, -3.5]} phase={4.1}>
        <PlaneCoin scale={1.05} rotation={[0.1, -0.3, 0.15]} />
      </Float>
      <Float position={[-6.8, 2.9, -4.5]} phase={0.7} amp={0.2}>
        <AppIcon color="#f2b8cf" glyph={heartGlyph} size={1.2} rotation={[0, 0.3, 0.2]} />
      </Float>
      <Float position={[5.4, 0.1, -3.0]} phase={3.3}>
        <PlayingCard scale={1.15} rotation={[0.05, -0.4, 0.16]} />
        <PlayingCard scale={1.15} position={[1.3, -0.6, -0.6]} rotation={[0.02, -0.55, -0.1]} />
      </Float>
      <Float position={[1.7, -1.9, -1.8]} phase={5.2} amp={0.2}>
        <TargetRing scale={0.95} rotation={[0.1, 0.32, 0]} />
      </Float>
      {/* โดนัทกินมุมล่างขวาจนโดนขอบตัด — ชิ้น foreground ที่ทำให้เฟรมมีชั้นหน้าจริง ๆ */}
      <Float position={[6.2, -2.4, 3.2]} phase={1.9} rot={0.1}>
        <CandyFloat scale={1.2} rotation={[0.55, -0.75, 0.45]} />
      </Float>
      <Float position={[0.4, -3.4, 4.4]} phase={2.2} rot={0.18}>
        <Gem scale={1.05} rotation={[0.4, 0.6, 0.2]} />
      </Float>
      <Float position={[-4.2, -1.7, -2.0]} phase={0.4}>
        <GamePawn scale={1.25} rotation={[0.06, 0, -0.08]} />
      </Float>
      <Float position={[-5.6, 0.1, -3.0]} phase={3.8} amp={0.2}>
        <Blocks color={GREEN_MAIN} unit={0.62} rotation={[0.2, 0.5, 0.1]} />
      </Float>
      <Float position={[-3.3, -1.3, -2.6]} phase={4.6} amp={0.18}>
        <Blocks color={RED} unit={0.5} rotation={[0.3, -0.4, 0]} />
      </Float>
      <Float position={[2.4, -2.6, 0.6]} phase={5.7} amp={0.16}>
        <Blocks color={PURPLE} unit={0.42} rotation={[0.4, 0.7, 0.2]} />
      </Float>

      <Float position={[-6.4, 4.0, -5]} phase={2.9} amp={0.2}>
        <Squiggle rotation={[0.2, 0.4, 0.5]} />
      </Float>
      <Float position={[5.6, 3.8, -5]} phase={4.9} amp={0.2}>
        <Squiggle color="#4f9df9" rotation={[-0.3, -0.5, -0.7]} />
      </Float>
      <Float position={[7.4, -2.0, -1]} phase={0.9} amp={0.24}>
        <Squiggle color="#39c7b8" rotation={[0.5, 0.2, 1.2]} scale={0.9} />
      </Float>

      {/* ลูกกลมเขียวมุมล่างซ้าย — โดนขอบตัดครึ่งใบเหมือน ref ถ่วงน้ำหนักฝั่งตรงข้ามโดนัท */}
      <Float position={[-8.8, -3.2, 2.6]} phase={3.1} amp={0.18}>
        <mesh>
          <sphereGeometry args={[2.1, 32, 24]} />
          <meshStandardMaterial color="#4fbe6e" roughness={0.6} />
        </mesh>
      </Float>

      <Confetti />
        </group>
      )}
      </Clay>

      <CameraRig />
    </Gloss>
  )
}

/** หัวใจชมพู — ไอคอนเล็กมุมบนซ้ายของ ref */
const heartGlyph = glyphTexture((ctx, s) => {
  ctx.fillStyle = '#e0407c'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${s * 0.62}px system-ui, sans-serif`
  ctx.fillText('♥', s / 2, s * 0.56)
})

export default function NewHeroScene() {
  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, LOW_END ? 1.5 : 2]}
      camera={{
        position: [DEFAULTS.camX, DEFAULTS.camY, DEFAULTS.camZ],
        fov: DEFAULTS.fov,
        near: 0.1,
        far: 140,
      }}
      /**
       * exposure ยกความสว่างทั้งภาพ "หลัง" คำนวณแสงเสร็จ
       * ต่างจากการเร่ง intensity ของไฟทีละดวง ซึ่งจะดันด้านสว่างจนไหม้ก่อนที่ด้านมืด
       * จะสว่างพอ — ที่นี่อัตราส่วนระหว่างด้านสว่างกับด้านมืดคงเดิม
       */
      // stencil ต้องเปิดเอง — พอร์ทัลของหน้าต่างใช้ stencil buffer เป็นตัวจำกัดพื้นที่วาด
      gl={{ antialias: true, stencil: true, toneMappingExposure: DEFAULTS.exposure }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}
