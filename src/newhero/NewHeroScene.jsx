import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import { Mascot } from '@/joespresso/scene/Mascot'
import { useDisposable, makeRandom, LOW_END, damp, clamp } from '@/joespresso/scene/utils'
import { DEFAULTS, getTuner, useTuner } from './tuner'
import { roundedBoxGeo } from './geo'
import { Rider } from './Rider'

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
/** สีเนื้อหน้าต่าง — ขาวล้วน ตัดกับพื้นน้ำเงินของหน้า */
const INNER_BG = '#ffffff'
const GREEN_DEEP = '#1d4a38'
const GREEN_MAIN = '#3cb464'
const GREEN_SOFT = '#8fd98a'
const CHECKER_DARK = '#262019'
const CHECKER_LIGHT = '#f4ecd9'
const CHECKER_LINE = '#7fd0a2'
const ORANGE = '#f2793b'
const PURPLE = '#b44be0'
const BLUE = '#4f7df9'
const RED = '#e8492e'

/* ---------- textures (canvas วาดครั้งเดียว ระดับโมดูล — แชร์ทุก instance ห้าม dispose) ---------- */

/** กระเบื้องหมากรุก 2x2 พร้อมเส้นตารางเขียวจาง ๆ — RepeatWrapping แล้วปูยาวตามริบบิ้น */
function checkerTile(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const h = size / 2
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 2; x++) {
      ctx.fillStyle = (x + y) & 1 ? CHECKER_LIGHT : CHECKER_DARK
      ctx.fillRect(x * h, y * h, h, h)
    }
  ctx.strokeStyle = CHECKER_LINE
  ctx.lineWidth = size * 0.018
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(i * h, 0)
    ctx.lineTo(i * h, size)
    ctx.moveTo(0, i * h)
    ctx.lineTo(size, i * h)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}
const checkerTex = checkerTile()

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
function ribbonGeometry(points, w = 3.1, thick = 0.18, wave = 0.35, waves = 2.5, segs = 300) {
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
  const UP = new THREE.Vector3(0, 1, 0)
  const hw = w / 2
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    curve.getPointAt(t, P)
    curve.getTangentAt(t, T)
    S.crossVectors(T, UP).normalize()
    /**
     * บิดรอบแกนสัมผัสนิดเดียวพอ — มันคือถนนที่เอียงตามโค้ง ไม่ใช่ริบบิ้นที่ม้วนตัว
     * บิดเยอะ (เคยใช้ 0.55) แล้วหน้ากระเบื้องหันหนีกล้องเป็นช่วง ๆ อ่านเป็นแถบผ้าลอย
     */
    const tw = Math.sin(t * Math.PI * 1.6 + 0.4) * 0.16 + t * 0.2 - 0.08
    S.applyAxisAngle(T, tw)
    N.crossVectors(S, T).normalize()
    /**
     * คลื่นตามยาว — ยกผิวขึ้นลงตาม "แนวตั้งฉากกับผิว" ไม่ใช่ตามแกน y ของโลก
     * ยกตามแกน y ริบบิ้นช่วงที่บิดจะยกเฉียง คลื่นเลยดูเหมือนถนนเป็นลูกคลื่นทั้งก้อน
     * ยกตามแนวตั้งฉากได้ผ้าที่กระเพื่อมจริง และคลื่นแรงเท่ากันตลอดเส้นไม่ว่าบิดเท่าไร
     */
    const lift = Math.sin(t * Math.PI * 2 * waves + 0.6) * wave
    const cx = P.x + N.x * lift
    const cy = P.y + N.y * lift
    const cz = P.z + N.z * lift
    // สี่มุมต่อสเต็ป: บนซ้าย บนขวา ล่างซ้าย ล่างขวา (ล่าง = ถอยตามแนวตั้งฉากลงไป thick)
    pos.push(cx - S.x * hw, cy - S.y * hw, cz - S.z * hw)
    pos.push(cx + S.x * hw, cy + S.y * hw, cz + S.z * hw)
    pos.push(cx - S.x * hw - N.x * thick, cy - S.y * hw - N.y * thick, cz - S.z * hw - N.z * thick)
    pos.push(cx + S.x * hw - N.x * thick, cy + S.y * hw - N.y * thick, cz + S.z * hw - N.z * thick)
    const u = (t * len) / hw
    uv.push(u, 0, u, 2, u, 0, u, 2)
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
  useFrame(({ clock }) => {
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
function Clay({ on, children }) {
  const g = useRef()
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: CLAY_COLOR, roughness: 0.92, metalness: 0 }),
    [],
  )
  useDisposable(mat)
  useLayoutEffect(() => {
    const root = g.current
    if (!root) return
    // จำวัสดุเดิมไว้ทุกชิ้น ปิดโหมดแล้วต้องคืนสีกลับได้ ไม่ใช่ต้องรีเฟรชหน้า
    const orig = new Map()
    root.traverse((o) => {
      if (!o.material) return
      orig.set(o, o.material)
      if (on) o.material = mat
    })
    return () => orig.forEach((m, o) => (o.material = m))
  }, [mat, on, children])
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

function Panel({ w = 5.2, h = 6.5, d = 1.7, band = 0, cells = 0, stripe = false, ...props }) {
  /**
   * หน้าต่าง = แผ่นมุมมนสีขาว ไม่มีกรอบ
   *
   * เคยทำเป็นกรอบเจาะรูซ้อนกับกล่องโพรงด้านหลัง (BackSide) เพื่อให้เห็นเป็นช่องลึก
   * แต่กรอบหนาไปบังริบบิ้นตอนลอดออกมา และคอมพ์เองก็เป็นแผ่นมุมมนเรียบ ๆ ไม่มีขอบ
   * เหลือกล่องเดียวจึงตรงกับคอมพ์กว่า และริบบิ้นผ่านหน้า/หลังได้โดยไม่มีอะไรมาคั่น
   */
  const r = Math.min(w, h) * 0.17
  const geo = useMemo(() => roundedBoxGeo(w, h, d, r), [w, h, d, r])
  useDisposable(geo)

  const bh = h * band
  return (
    <group {...props}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={INNER_BG} roughness={0.95} />
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
  useFrame(({ clock }) => {
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

/** ริบบิ้นหมากรุกเส้นหลัก */
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
  const geo = useMemo(
    () =>
      ribbonGeometry([
        // ในโพรงบานที่ 1 (โพรงลึกจาก z 0.15 ถึง -4.85)
        new THREE.Vector3(-9.6, 2.7, -3.9),
        new THREE.Vector3(-8.6, 2.65, -2.4),
        // ลอดหลังกรอบระหว่างบาน 1 กับ 2 — ยังลึกกว่าระนาบกรอบ จึงอ่านเป็นของที่อยู่ข้างหลัง
        new THREE.Vector3(-6.6, 2.55, -1.6),
        new THREE.Vector3(-4.8, 2.5, -1.0),
        // ถึงปากช่องบานที่ 2 แล้วโผล่ออกมา (z > d/2 คือพ้นหน้ากรอบ)
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
      ], width, thick, wave, waves),
    [width, thick, wave, waves],
  )
  useDisposable(geo)
  const tex = useMemo(() => {
    const t = checkerTex.clone()
    t.needsUpdate = true
    return t
  }, [])
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
    <mesh geometry={geo} position={offset} scale={scale}>
      {/* ผิวบน = ลายหมากรุก / ผิวล่างกับสันข้าง = สีทึบ ให้เห็นว่ามันเป็นแผ่นมีความหนา */}
      <meshStandardMaterial attach="material-0" map={tex} roughness={0.85} side={THREE.DoubleSide} />
      <meshStandardMaterial attach="material-1" color={GREEN_DEEP} roughness={0.75} side={THREE.DoubleSide} />
    </mesh>
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
  useFrame(({ clock }) => {
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
    cam.position.z = damp(cam.position.z, t.camZ * fit, 0.06, dt)
    cam.position.x = damp(cam.position.x, t.camX - (fit - 1) * 2.1 + state.pointer.x * 0.6, 0.06, dt)
    cam.position.y = damp(cam.position.y, t.camY + state.pointer.y * 0.4, 0.06, dt)
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
    cam.rotation.set(-t.pitch * RAD, 0, 0)
  })
  return null
}

/* ---------- ฉากรวม ---------- */

function Scene() {
  const t = useTuner()
  const clay = t.clay > 0.5
  const props = t.props > 0.5
  const skater = t.skater > 0.5
  const grid = clay ? GRID.clay : GRID.color
  /**
   * ริบบิ้นตัวเดียวกัน ใช้ทั้งในฉากของหน้าต่างและในฉากหลัก
   *
   * ฉากใน portal ใช้กล้องตัวเดียวกัน พิกัดโลกจึงตรงกันเป๊ะ ไม่ต้องชดเชยอะไร
   * ส่วนที่อยู่หลังบานกระจกจะถูกเห็นผ่านหน้าต่าง ส่วนที่พ้นออกมาแล้วเห็นจากฉากหลัก
   */
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
    <>
      {clay ? (
        /**
         * ไฟแบบ studio ของวิวพอร์ต: key เฉียงบนซ้าย, fill อ่อนฝั่งตรงข้าม, rim จากหลัง
         * ambient ต่ำกว่าโหมดสี เพราะ clay ต้องอ่านรูปทรงจากไล่เงา ไม่ใช่จากสี
         */
        <>
          <ambientLight intensity={0.42} color="#ffffff" />
          <directionalLight position={[-6, 9, 7]} intensity={1.5} color="#ffffff" />
          <directionalLight position={[7, 2, 5]} intensity={0.5} color="#dfe6ee" />
          <directionalLight position={[0, 4, -10]} intensity={0.55} color="#ffffff" />
        </>
      ) : (
        <>
          {/* ambient เขียวอ่อนทำให้ครีมกลายเป็นเทา — ใน ref แผงเป็นเบจอุ่น */}
          <ambientLight intensity={0.85} color="#ffffff" />
          <directionalLight position={[-4, 7, 8]} intensity={1.15} color="#fff6e8" />
          <directionalLight position={[6, -2, 4]} intensity={0.28} color="#bfffdf" />
        </>
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
            <Panel
              key={i}
              position={[x, t.panelBase + t.panelH / 2, 0]}
              w={t.panelW}
              h={t.panelH}
              d={t.panelD}
            />
          )
        })}
        {ribbon}
        {/* ตัวละครอยู่ในพิกัดกลุ่มเดียวกับริบบิ้น จะได้วางบนถนนได้ตรง ๆ ไม่ต้องแปลงพิกัด */}
        {skater && (
          <Rider
            position={[t.skaterX, t.skaterY, t.skaterZ]}
            rotation={[t.skaterRotX * RAD, t.skaterRotY * RAD, t.skaterRotZ * RAD]}
            scale={t.skaterScale}
            mascotScale={t.mascotScale}
            mascotLift={t.mascotLift}
            boardScale={t.boardScale}
            armScale={t.armScale}
            foreScale={t.foreScale}
            boardRot={[t.boardRotX * RAD, t.boardRotY * RAD, t.boardRotZ * RAD]}
            boardSpec={{
              deckLen: t.bdLen,
              deckWide: t.bdWide,
              deckThick: t.bdThick,
              tipLen: t.bdTip,
              kick: t.bdKick * RAD,
              truckX: t.bdTruckX,
              wheelR: t.bdWheelR,
              wheelW: t.bdWheelW,
              deckY: t.bdRideY,
            }}
            legPose={{
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
              aimX: t.aimX,
              aimY: t.aimY,
              aimZ: t.aimZ,
              elbowX: t.elbowX * RAD,
              elbowY: t.elbowY * RAD,
              elbowZ: t.elbowZ * RAD,
              wristX: t.wristX * RAD,
              wristY: t.wristY * RAD,
              wristZ: t.wristZ * RAD,
              mugShX: t.mugShX * RAD,
              mugShY: t.mugShY * RAD,
              mugShZ: t.mugShZ * RAD,
              mugElX: t.mugElX * RAD,
              mugElY: t.mugElY * RAD,
              mugElZ: t.mugElZ * RAD,
            }}
          />
        )}
      </group>
      </group>
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
    </>
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
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}
