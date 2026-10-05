import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { DeviceScene } from './DeviceScene'
import { DESK, DesktopUI, widgetAt, type DesktopApi } from './DesktopUI'

/**
 * รางเล่าบริการทีละหน้า เลื่อนแนวนอนตามการเลื่อนลง — ต่อจากฟองคำพูดที่กลายเป็นหัวข้อ + วงกลมสามวงมุมซ้ายบน
 * (ดู BubbleTraveler) ผัง: Figma "Joe Space" โหนด 1572:3831 (MacBook Air 1280×832) · สี: ภาพอ้างอิงคอร์ส 포트폴리오 프플완
 *
 * ฉากเป็นแผ่นหนา 3D วางบนระนาบพื้นที่เอียงอยู่ในโลกจริง — ไม่ใช่ DOM บิดแบบ 2D อีกแล้ว
 *
 * ในแบบทุกชิ้นใช้ทรานส์ฟอร์ม 2D เดียวกัน M = rotate(−27.07°)·scaleY(.99)·skewX(6.62°) ซึ่งเป็นภาพฉายของ
 * ระนาบที่เอียงในโลก 3D ผ่านกล้องออร์โธ: แกน x/y ของระนาบในโลก = คอลัมน์ของ M เติมแกนลึก (z) ให้สองแกน
 * ตั้งฉากและยาวเท่ากัน (แก้สมการได้ z = −0.336 / −0.345 · ยาว 1.0549) — มองจากกล้องจึงได้ผังตรงแบบทุกพิกเซล
 * แต่ความหนาของแผ่นยื่นตามแกนตั้งฉากของระนาบจริง ด้านข้างโผล่ทางซ้ายล่าง (ตรงกับเงาแข็ง −2px 8px ในแบบ)
 *
 * อยู่ในแคนวาสเดียวกับฟอง (กล้องออร์โธหน่วยพิกเซล) ข้างในพาเนลแก้วที่ฟองขยายมา — วางหน้าแก้วในแกนลึก
 * (แก้วโปร่งวาดทีหลัง ถ้าฉากอยู่หลังมัน เนื้อกรมท่าของพาเนลจะทาทับฉาก) แล้วตัดขอบตามกรอบเนื้อหาด้วย scissor
 */

/** บริการตามลำดับหน้า (เมนูวงกลม / จุดบอกหน้า / หัวพาเนล) — หน้าแรกคือแนะนำตัว ฉาก UX/UI อยู่หน้า UXUI_PAGE */
/** สกิลตามลำดับ (จุดบอกหน้า / หัวพาเนล / ชั้นในหัวของ About me — ดู AboutFigure) */
export const SERVICES = ['UX/UI', 'Coding', 'Research'] as const
/** กรอบของทุกชิ้นในฉาก UX/UI บนจอในแบบ (จากกล่องของแต่ละชิ้นใน Figma รวมความหนา) — ใช้ย่อให้อยู่ในพาเนลครบ */
const SCENE_BB = { x0: -260, y0: 30, x1: 1795, y1: 1130 }
const UXUI_PAGE = 1
/** ฉากแฟ้มงาน + ถาดปุ่มอุปกรณ์ (ดู ./DeviceScene) — ขนาดสูงราว 86% ของกรอบเนื้อหา */
/** ฉากแฟ้มงาน + ถาดอุปกรณ์ เป็นตอนจบ "ส่งมอบ" ต่อจาก Coding */
const DEVICE_ON = true
/** ฉากถาดอุปกรณ์โผล่เฉพาะช่วงส่งมอบ (ship) ไม่ใช่หน้าของตัวเอง — วางกลางล่างของพาเนล */
const SHIP_AT = { x: 0.5, y: 0.6 }
/** จุดบนปุ่มแท็บเล็ต (ปุ่มกลาง สีส้ม) ในพิกัดของ DeviceScene — จอเดสก์ท็อปย่อลงไปเสียบตรงนี้ */
const TABLET_KEY = new THREE.Vector3(40, -230, 200)
/**
 * ฟองไอเดีย (หน้าแนะนำตัว): ฟองความคิดลอยจากหัวตัวละคร มีหลอดไฟข้างใน — เลื่อนไป UX/UI ฟองลอยตามไปแล้วแตก
 * เป็นบล็อกออกแบบ (บล็อกผุดขึ้นตรงที่ฟองหายไป) · ตำแหน่งเป็นสัดส่วนของกรอบเนื้อหา
 */
const IDEA = { x: 0.5, y: 0.3, size: 0.2 }
/**
 * จอเดสก์ท็อป — แผงม่วงในแบบ (1573:3850 กลางที่ 1248, 502) ทำเป็นสัดส่วน 16:10 widget หล่นลงมาประกอบเป็นหน้า
 * แล้วเลื่อนต่อไป Coding: จอไม่เลื่อนหายไปกับหน้า แต่ลอยมากลางพาเนล ขยายขึ้น และแยกชั้นเชิงเทคนิค (ดู DesktopUI)
 */
const DESK_AT = { x: 1248.33, y: 502.5 }
const DESK_Q = new THREE.Quaternion()
const FLY_TO = new THREE.Vector3()
const SHIP_TO = new THREE.Vector3()
const FLY_FROM = new THREE.Vector3()
const FLY_S = new THREE.Matrix4()
const DESK_AXIS = new THREE.Vector3()
const DESK_V = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
const CODING_PAGE = 2
/**
 * บล็อกออกแบบ (ลำดับใน UXUI) บินเข้าจอไปเป็น widget ลำดับไหน (ดู DesktopUI) — design system กลายเป็นหน้า UI
 * การ์ดน้ำเงิน → Sidebar · การ์ด UX/UI → NavBar · แคปซูล (+ปุ่มของมัน) → Button · ไทล์ขาว → StatCard · ไทล์เขียว → Chart
 */
const BLOCK_TO_WIDGET: Record<number, number> = { 0: 1, 1: 0, 2: 7, 3: 7, 4: 2, 5: 5 }
const WIDGET_FROM_BLOCK: Record<number, number> = { 1: 0, 0: 1, 7: 2, 2: 4, 5: 5 }
/** ลำดับที่บินเข้า (เร็ว → ช้า) */
const FLY_ORDER: Record<number, number> = { 1: 0, 0: 1, 4: 2, 5: 3, 2: 4, 3: 4 }
/** จังหวะบนแกนหน้า: บล็อกบินเข้าจอ (1.0 → 1.45) · จอลอยมากลางแล้วแยกชั้น (1.5 → 2) */
const FLY = { from: 1.0, each: 0.06, dur: 0.3 }
const BUILD = { from: CODING_PAGE - 0.5, dur: 0.5 }
const flyOf = (block: number, page: number) => clamp01((page - FLY.from - FLY_ORDER[block] * FLY.each) / FLY.dur)
const DEVICE = { x: 0.5, y: 0.5, size: 0.86 / 1000 }
/** กรอบของแบบ — วางฉากด้วยสเกลคลุมจอ (cover) จัดกลาง */
export const FW = 1280
const FH = 832

/** ฐานของระนาบในโลก (ต่อหน่วยพิกเซลในแบบ) — คอลัมน์ของ M (แกน y โลกชี้ขึ้น) + ลึกที่แก้สมการได้ */
const M = { a: 0.89045, b: -0.45508, c: 0.55387, d: 0.82873 }
const AX = new THREE.Vector3(M.a, -M.b, -0.33599)
const AY = new THREE.Vector3(-M.c, M.d, -0.34542) // แกน y ของแผ่นชี้ "ขึ้น" (แบบนับ y ลง จึงกลับทิศ)
const AN = new THREE.Vector3().crossVectors(AX, AY).normalize().multiplyScalar(AX.length())
/** พิกัดบนระนาบ (y ลง) จากจุดบนจอในแบบ — ใช้ M⁻¹ */
const DET = M.a * M.d - M.c * M.b
const unproject = (dx: number, dy: number) => ({ x: (M.d * dx - M.c * dy) / DET, y: (-M.b * dx + M.a * dy) / DET })

type Shape = { x: number; y: number; w: number; h: number; r: number; c: string; depth: number; base: number; card?: boolean }
/**
 * กลางของแต่ละชิ้น (พิกัดบนจอในแบบ) + ขนาดบนระนาบ เรียงตามลำดับที่ผุดขึ้น — วงเล็บท้ายคือ node id
 * depth = ความหนา · base = ยกจากพื้น (ชิ้นที่วางซ้อนบนชิ้นอื่น)
 */
const UXUI: Shape[] = [
  { x: 116.735, y: 471.037, w: 529.255, h: 311.669, r: 40, c: '#3b6fe3', depth: 22, base: 0 }, // การ์ดซ้าย น้ำเงิน (1573:3831)
  { x: 288.33, y: 771.18, w: 1034.175, h: 288.079, r: 40, c: '#e8ebf3', depth: 22, base: 22, card: true }, // การ์ด UX/UI (1573:3844)
  { x: 628.27, y: 293.4, w: 309.471, h: 149.586, r: 74.79, c: '#c592f2', depth: 30, base: 0 }, // แคปซูลค้นหา (1573:3852)
  { x: 557.19, y: 327.41, w: 98.523, h: 98.523, r: 49.26, c: '#f5f3fb', depth: 14, base: 30 }, // ปุ่มในแคปซูล (1573:3859)
  { x: 112.51, y: 491.72, w: 200, h: 200, r: 40, c: '#eef0f6', depth: 30, base: 22 }, // ไทล์ชิปสี ขาว (1573:3832)
  { x: 326.51, y: 383.72, w: 200, h: 200, r: 40, c: '#5fdf45', depth: 30, base: 22 }, // ไทล์ Figma เขียว (1573:3833)
]
const INK = '#3b6fe3'

/**
 * ตัว UX/UI กับเส้นไกด์ประบนการ์ด (พิกัดในกรอบการ์ด 1034×288 แกน y ลง) — ตำแหน่งแปลงจากชิ้นลอยในแบบ
 * (1573:3843/3845/3847) เข้าระนาบของการ์ด สองคำนั่งเส้นเดียวกันที่ y 136 · DM Sans Light 148 สูงตัวพิมพ์ใหญ่ 103.6
 * เส้นตั้งชิดเนื้อตัว U ซ้ายสุด / I ขวาสุด (วัดจากฟอนต์) · ขีด / เป็นสี่เหลี่ยมด้านขนาน หัวท้ายตัดเรียบตามเส้นบน-ล่าง
 */
const LINE_Y = 136
const CAP = 103.6
const WORDS = [
  { x: 655.87, w: 182.48, inkL: 10.36, inkR: 176.42, text: 'UX' },
  { x: 888.55, w: 129.35, inkL: 10.36, inkR: 117.66, text: 'UI' },
]
const SLASH = { x: 781.5, lean: -0.4839, w: 9 / 0.9438 }
const ROWS = [LINE_Y - CAP / 2, LINE_Y + CAP / 2]
const COLS = [WORDS[0].x - WORDS[0].w / 2 + WORDS[0].inkL, WORDS[1].x - WORDS[1].w / 2 + WORDS[1].inkR]
/** จุดของเส้นประ: เม็ดกลม 3 ห่างกัน 6 (เท่าเส้น dotted 3px เดิม) */
const DOT = { r: 1.5, gap: 6, color: '#8894b0' }
const FONT_UI = '/fonts/dm-sans-light.json'

/**
 * พาเนลแบบหน้าต่าง Spotlight (macOS) — ตัวฟองคำพูดเองที่ขยายเป็นพาเนล (ดู BubbleTraveler) ฉากบริการอยู่ข้างใน
 * หัวพาเนล: ไอคอนบริการ + ข้อความของฟอง ซ้าย · จุดบอกหน้าขวา · เนื้อหาใต้หัว เว้นขอบรอบตัว
 */
export function panelLayout(W: number, H: number) {
  const sh = W / FW
  /* เกือบเต็มจอ — เว้นขอบรอบตัวพอให้เห็นว่าเป็นหน้าต่างแก้วลอยบนฟ้า (ขอบซ้ายเผื่อแถบจุดนำทางของหน้า) */
  const m = Math.max(16, 24 * sh)
  const w = W - m * 2 - 44 * sh
  const h = H - m * 2
  const cx = W / 2 + 22 * sh
  const cy = H / 2
  const left = cx - w / 2
  const top = cy - h / 2
  const head = 46 * sh
  const pad = 22 * sh
  return {
    cx,
    cy,
    w,
    h,
    r: 34 * sh,
    left,
    top,
    /** กลางแนวตั้งของหัวพาเนล */
    headY: top + head,
    /** ไอคอนกลางที่ x นี้ · ข้อความเริ่มที่ x นี้ · จุดบอกหน้าจบที่ x นี้ */
    iconX: left + 44 * sh,
    textX: left + 78 * sh,
    dotsR: left + w - 40 * sh,
    content: { x: left + pad, y: top + head * 2, w: w - pad * 2, h: h - head * 2 - pad },
  }
}
/** กรอบเนื้อหาของพาเนลบนจอเฟรมนี้ (px) — ฟองตั้งค่า (ดู BubbleTraveler) ฉากบริการอ่าน */
export const panelBox = { on: false, x: 0, y: 0, w: 1, h: 1 }

/** ท่าของเฟรมนี้ — stage = ชิ้นผุดขึ้น · slide = ข้ามหน้า (0..1) · lift = เลื่อนขึ้นไปพร้อมท้าย section (px) */
export type ServicePose = { stage: number; slide: number; lift: number; ship: number }

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const outBack = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2
const inOutE = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)

function roundRect(w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  const s = new THREE.Shape()
  const x0 = -w / 2
  const y0 = -h / 2
  s.moveTo(x0 + rr, y0)
  s.lineTo(x0 + w - rr, y0)
  s.absarc(x0 + w - rr, y0 + rr, rr, -Math.PI / 2, 0, false)
  s.lineTo(x0 + w, y0 + h - rr)
  s.absarc(x0 + w - rr, y0 + h - rr, rr, 0, Math.PI / 2, false)
  s.lineTo(x0 + rr, y0 + h)
  s.absarc(x0 + rr, y0 + h - rr, rr, Math.PI / 2, Math.PI, false)
  s.lineTo(x0, y0 + rr)
  s.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false)
  return s
}
/** แผ่นหนามุมมน ขอบลบเหลี่ยมนิดเดียว ฐานที่ z = 0 */
function slab(sh: Shape) {
  const bev = 2.5
  const g = new THREE.ExtrudeGeometry(roundRect(sh.w, sh.h, sh.r), {
    depth: sh.depth - bev * 2,
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev,
    bevelSegments: 2,
    curveSegments: 24,
  })
  g.translate(0, 0, bev)
  return g
}

/**
 * ผิวแบนแบบภาพประกอบ: หน้าบนเป็นสีตามแบบเป๊ะ ด้านข้างเข้มลง (ไม่ใช้ไฟของแคนวาส — ไฟนั้นตั้งไว้ให้แก้วฟอง
 * สว่างจัด สีจะซีดเพี้ยน) ด้านที่หันซ้าย/ล่างเข้มกว่าด้านขวา/บนนิดหน่อย ให้อ่านทิศแสงได้
 */
function flatMat(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      void main() {
        vN = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vN;
      void main() {
        vec3 n = normalize(vN);
        float top = smoothstep(0.55, 0.95, n.z);
        float side = 0.7 + 0.08 * dot(n.xy, normalize(vec2(0.6, 0.8)));
        gl_FragColor = vec4(uColor * mix(side, 1.0, top), 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

const BOX = new THREE.Vector4()
/** ตัดการวาดของชิ้นนี้ให้อยู่ในกรอบเนื้อหาของพาเนล — ตั้ง/ปลดรอบวาดของแต่ละชิ้นผ่าน renderer.state */
function clipOn(renderer: THREE.WebGLRenderer) {
  const el = renderer.domElement
  const k = el.width / Math.max(1, el.clientWidth)
  const b = panelBox
  BOX.set(b.x * k, (el.clientHeight - b.y - b.h) * k, b.w * k, b.h * k)
  renderer.state.scissor(BOX)
  renderer.state.setScissorTest(true)
}
function clipOff(renderer: THREE.WebGLRenderer) {
  renderer.state.setScissorTest(false)
}

export function ServiceScene({ pose }: { pose: React.RefObject<ServicePose> }) {
  const font = useLoader(FontLoader, FONT_UI)
  const parts = useMemo(() => {
    const items = UXUI.map((sh) => ({ sh, geo: slab(sh), mat: flatMat(sh.c) }))
    const ink = new THREE.MeshBasicMaterial({ color: INK })
    /* ตัวอักษรนูนบาง ๆ บนหน้าการ์ด — ฐานที่เส้น LINE_Y + CAP/2 (เส้นฐานตัวอักษร) */
    const words = WORDS.map((wd) => {
      /* TTFLoader ขยายพิกัดฟอนต์ 100000 / (unitsPerEm · 72) = 1.389 เท่า — ย่อกลับให้ได้ 148px จริงแบบในแบบ */
      const g = new TextGeometry(wd.text, { font, size: 148 * 0.72, depth: 2, curveSegments: 8, bevelEnabled: false })
      g.translate(wd.x - wd.w / 2, 0, 0)
      return g
    })
    /* ขีด / — สี่เหลี่ยมด้านขนานในกรอบการ์ด (แกน y ลง → กลับเป็นขึ้นตอนใส่ Shape) */
    const top = ROWS[0]
    const bot = ROWS[1]
    const xt = SLASH.x + (top - LINE_Y) * SLASH.lean
    const xb = SLASH.x + (bot - LINE_Y) * SLASH.lean
    const hw = SLASH.w / 2
    const ps = new THREE.Shape([
      new THREE.Vector2(xt - hw, -top),
      new THREE.Vector2(xt + hw, -top),
      new THREE.Vector2(xb + hw, -bot),
      new THREE.Vector2(xb - hw, -bot),
    ])
    const slash = new THREE.ExtrudeGeometry(ps, { depth: 2, bevelEnabled: false })
    /* เม็ดของเส้นประ — ตัดตามมุมมนของการ์ด */
    const card = UXUI.find((s) => s.card) as Shape
    const pts: [number, number][] = []
    const inside = (x: number, y: number) => {
      const r = card.r
      const cx = Math.min(Math.max(x, r), card.w - r)
      const cy = Math.min(Math.max(y, r), card.h - r)
      return Math.hypot(x - cx, y - cy) <= r - DOT.r
    }
    for (const y of ROWS) for (let x = DOT.gap / 2; x < card.w; x += DOT.gap) if (inside(x, y)) pts.push([x, y])
    for (const x of COLS) for (let y = DOT.gap / 2; y < card.h; y += DOT.gap) if (inside(x, y)) pts.push([x, y])
    const dotGeo = new THREE.CircleGeometry(DOT.r, 8)
    const dotMat = new THREE.MeshBasicMaterial({ color: DOT.color })
    const dots = new THREE.InstancedMesh(dotGeo, dotMat, pts.length)
    const m4 = new THREE.Matrix4()
    pts.forEach(([x, y], i) => dots.setMatrixAt(i, m4.makeTranslation(x, -y, 0)))
    dots.instanceMatrix.needsUpdate = true
    return { items, ink, words, slash, dots, dotGeo, dotMat, card }
  }, [font])
  useEffect(
    () => () => {
      parts.items.forEach((p) => {
        p.geo.dispose()
        p.mat.dispose()
      })
      parts.words.forEach((g) => g.dispose())
      parts.ink.dispose()
      parts.slash.dispose()
      parts.dotGeo.dispose()
      parts.dotMat.dispose()
      parts.dots.dispose()
    },
    [parts],
  )

  const root = useRef<THREE.Group>(null)
  const device = useRef<THREE.Group>(null)
  const desk = useRef<THREE.Group>(null)
  const deskApi = useMemo<DesktopApi>(() => ({ current: null }), [])
  const deskBasis = useMemo(() => new THREE.Matrix4(), [])
  const idea = useRef<THREE.Group>(null)
  const ideaParts = useMemo(() => {
    const ball = new THREE.SphereGeometry(1, 32, 20)
    const cloud = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f4f6ff').multiplyScalar(0.62), roughness: 0.5, envMapIntensity: 0.2 })
    const bulb = new THREE.MeshBasicMaterial({ color: '#ffd23f', toneMapped: false })
    const base = new THREE.MeshStandardMaterial({ color: new THREE.Color('#9aa3b5').multiplyScalar(0.62), roughness: 0.5 })
    const neck = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 20)
    return { ball, cloud, bulb, base, neck }
  }, [])
  useEffect(() => () => Object.values(ideaParts).forEach((x) => x.dispose()), [ideaParts])
  const groups = useRef<(THREE.Group | null)[]>([])
  const bodies = useRef<(THREE.Group | null)[]>([])
  const basis = useMemo(() => new THREE.Matrix4(), [])

  useFrame(({ size }) => {
    const p = pose.current
    const rt = root.current
    if (!p || !rt) return
    rt.visible = p.stage > 0
    if (!rt.visible) return
    const W = size.width
    const H = size.height
    /* ฉากคลุมเต็มกรอบเนื้อหาของพาเนล (cover) — ตัดขอบด้วย scissor (ดู clip) · เลื่อนข้ามหน้าทีละความกว้างพาเนล */
    const cb = panelBox
    if (!cb.on) {
      rt.visible = false
      return
    }
    /*
     * ย่อฉากให้อยู่ในพาเนลครบทุกชิ้น (contain) — กรอบของชิ้นทั้งหมดบนจอในแบบ (รวมส่วนที่ล้นกรอบ 1280×832
     * ของแบบเอง) ไม่ใช่คลุมเต็มแล้วตัดขอบ
     */
    const s = Math.min(cb.w / (SCENE_BB.x1 - SCENE_BB.x0), cb.h / (SCENE_BB.y1 - SCENE_BB.y0))
    const page = p.slide * (SERVICES.length - 1)
    const ox = cb.x + (cb.w - (SCENE_BB.x1 - SCENE_BB.x0) * s) / 2 - SCENE_BB.x0 * s + (UXUI_PAGE - page) * cb.w
    const oy = cb.y + (cb.h - (SCENE_BB.y1 - SCENE_BB.y0) * s) / 2 - SCENE_BB.y0 * s

    /* ฟองไอเดีย: อยู่ข้างหัวในหน้าแนะนำตัว เลื่อนไป UX/UI แล้วลอยไปแตกเป็นบล็อกออกแบบ */
    const id = idea.current
    if (id) {
      const kin = clamp01(p.stage / 0.6)
      const go = inOutE(clamp01(page / 0.6))
      const hx = cb.x + cb.w * IDEA.x - page * cb.w
      const hy = cb.y + cb.h * IDEA.y
      /* ลอยไปหากลุ่มบล็อกออกแบบ (กลางกลุ่มราว 330, 560 ในแบบ) ซึ่งกำลังเลื่อนเข้ามาจากขวา — ไปแตกตรงนั้น */
      const tx = ox + 330 * s
      const ty = oy + 560 * s
      const pop = 1 - clamp01((page - 0.4) / 0.25)
      id.visible = kin > 0 && pop > 0.01
      id.position.set(hx + (tx - hx) * go - W / 2, H / 2 - (hy + (ty - hy) * go), 650)
      id.scale.setScalar(Math.max(1e-3, cb.h * IDEA.size * outBack(kin) * (pop < 1 ? pop * (1 + 0.3 * Math.sin(Math.PI * pop)) : 1)))
      id.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh && m.onBeforeRender !== clipOn) {
          m.onBeforeRender = clipOn
          m.onAfterRender = clipOff
        }
      })
    }
    /* ถาดอุปกรณ์: โผล่ตอนส่งมอบ (ship) กลางล่างพาเนล — จอเดสก์ท็อปย่อลงไปเสียบปุ่มแท็บเล็ต */
    const dv = device.current
    const ship = p.ship
    if (dv) {
      /* โผล่หลังชั้นยุบกลับเสร็จ (ship 0.35) ไม่ซ้อนกับภาพแยกชั้น */
      const k = clamp01((ship - 0.3) / 0.3)
      dv.visible = DEVICE_ON && k > 0
      const dx = cb.x + cb.w * SHIP_AT.x
      const dy = cb.y + cb.h * SHIP_AT.y
      dv.position.set(dx - W / 2, H / 2 - dy, 600)
      dv.scale.setScalar(Math.max(1e-3, cb.h * DEVICE.size * outBack(k)))
      dv.updateMatrix()
      dv.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh && m.onBeforeRender !== clipOn) {
          m.onBeforeRender = clipOn
          m.onAfterRender = clipOff
        }
      })
    }
    /* ฐานของระนาบที่สเกลจอนี้ — ทุกชิ้นใช้ชุดเดียวกัน */
    basis.makeBasis(AX.clone().multiplyScalar(s), AY.clone().multiplyScalar(s), AN.clone().multiplyScalar(s))
    /*
     * จอเดสก์ท็อป: เลื่อนเข้ามาพร้อมหน้า UX/UI แต่ไม่เลื่อนออก — พอเลื่อนต่อไป Coding มันลอยมากลางพาเนล
     * ขยายขึ้น แล้วแยกชั้น (ฉากอื่นของ UX/UI เลื่อนออกไปตามปกติ) เรื่องจึงต่อเนื่องจากออกแบบไปเขียนโค้ด
     */
    const dk = desk.current
    if (dk) {
      const pin = Math.max(0, UXUI_PAGE - page) * cb.w
      const sx0 = ox - (UXUI_PAGE - page) * cb.w + pin + DESK_AT.x * s
      const sy0 = oy + DESK_AT.y * s
      const e = inOutE(clamp01((page - BUILD.from) / BUILD.dur))
      const fit = (cb.w * 0.6) / (DESK.w * s)
      const sd = s * (1 + (fit - 1) * e)
      const sx = sx0 + (cb.x + cb.w * 0.5 - sx0) * e
      const sy = sy0 + (cb.y + cb.h * 0.56 - sy0) * e
      const pl = unproject(DESK_AT.x - FW / 2, DESK_AT.y - FH / 2)
      const z = s * (AX.z * pl.x - AY.z * pl.y) * (1 - e)
      /*
       * ตอนแยกชั้น เอนจอไปด้านหลังมากขึ้น (หมุนรอบแกน x ของจอ) — ระนาบเดิมหันเข้าหากล้องเกือบตรง ชั้นที่ยก
       * ตามแกนตั้งฉากจึงพุ่งเข้าหากล้องจนมองไม่เห็นว่าแยก เอนลงแล้วชั้นเรียงซ้อนให้เห็นแบบภาพแยกชิ้น
       */
      DESK_Q.setFromAxisAngle(DESK_AXIS.copy(AX).normalize(), -0.85 * e)
      /*
       * ส่งมอบ: ชั้นยุบกลับเป็นหน้าเดียว (ดู collapse ข้างล่าง) แล้วจอย่อลงไปเสียบปุ่มแท็บเล็ตบนถาดอุปกรณ์
       * ขนาดปลายทาง = กว้างเท่าปุ่ม (236 ในหน่วยของถาด) · หายตอนถึง
       */
      const fly = inOutE(clamp01((ship - 0.5) / 0.4))
      let sdx = sd
      let px = sx - W / 2
      let py = H / 2 - sy
      let pz = z + 600
      if (fly > 0 && dv) {
        SHIP_TO.copy(TABLET_KEY).applyMatrix4(dv.matrix)
        const sEnd = (236 * dv.scale.x) / DESK.w
        sdx = sd + (sEnd - sd) * fly
        px += (SHIP_TO.x - px) * fly
        py += (SHIP_TO.y - py) * fly
        pz += (SHIP_TO.z - pz) * fly
      }
      deskBasis.makeBasis(
        DESK_V[0].copy(AX).applyQuaternion(DESK_Q).multiplyScalar(sdx),
        DESK_V[1].copy(AY).applyQuaternion(DESK_Q).multiplyScalar(sdx),
        DESK_V[2].copy(AN).applyQuaternion(DESK_Q).multiplyScalar(sdx),
      )
      dk.matrix.copy(deskBasis).setPosition(px, py, pz)
      dk.matrixWorldNeedsUpdate = true
      const k = clamp01((clamp01((page - (UXUI_PAGE - 0.7)) / 0.55) - 0.06) / 0.4)
      dk.visible = k > 0 && fly < 0.97
      dk.children[0].position.z = (1 - outBack(k)) * 160
      /* widget ที่มาจากบล็อกออกแบบ ขยายขึ้นตอนบล็อกบินถึง · ที่เหลือหล่นลงมาเติมหลังบล็อกบินเข้าครบ */
      deskApi.current?.(
        (i) => {
          const blk = WIDGET_FROM_BLOCK[i]
          if (blk !== undefined) return clamp01((flyOf(blk, page) - 0.75) / 0.25)
          return clamp01((page - (FLY.from + 0.3) - (i - 3) * 0.04) / 0.2)
        },
        /* ส่งมอบ: ชั้นยุบกลับก่อนจอย่อลงไปเสียบ */
        clamp01((page - BUILD.from) / BUILD.dur) * (1 - inOutE(clamp01(ship / 0.35))),
        (i) => WIDGET_FROM_BLOCK[i] !== undefined,
      )
      dk.traverse((o) => {
        const m = o as THREE.Mesh & THREE.Line
        if ((m.isMesh || m.isLine) && m.onBeforeRender !== clipOn) {
          m.onBeforeRender = clipOn
          m.onAfterRender = clipOff
        }
      })
    }
    UXUI.forEach((sh, i) => {
      const g = groups.current[i]
      if (!g) return
      /* กลางชิ้นบนจอ + ความลึกของจุดนั้นบนระนาบ (ระนาบเอียง จุดต่างที่กันจึงลึกไม่เท่ากัน) */
      const sx = ox + sh.x * s
      const sy = oy + sh.y * s
      const pl = unproject(sh.x - FW / 2, sh.y - FH / 2)
      const z = s * (AX.z * pl.x - AY.z * pl.y)
      g.matrix.copy(basis).setPosition(sx - W / 2, H / 2 - sy, z + 600)
      /* บินเข้าจอไปเป็น widget: เคลื่อนไปจุดของ widget บนจอ ย่อลง แล้วหายตอนถึง (widget ขยายขึ้นแทนที่) */
      const wi = BLOCK_TO_WIDGET[i]
      const fly = wi !== undefined && dk ? flyOf(i, page) : 0
      if (fly > 0 && dk) {
        const at = widgetAt(wi)
        FLY_TO.set(at.x, at.y, at.z).applyMatrix4(dk.matrix)
        FLY_FROM.setFromMatrixPosition(g.matrix)
        const f = inOutE(fly)
        /* โค้งขึ้นกลางทาง (ตามแกนตั้งฉากของระนาบ) — บิน ไม่ใช่ไถล */
        FLY_FROM.lerp(FLY_TO, f).addScaledVector(AN, Math.sin(Math.PI * f) * 120 * s)
        g.matrix.copy(basis).multiply(FLY_S.makeScale(1 - 0.6 * f, 1 - 0.6 * f, 1 - 0.6 * f)).setPosition(FLY_FROM)
      }
      g.visible = fly < 0.97
      g.matrixWorldNeedsUpdate = true
      /* ผุดขึ้นทีละชิ้น: หล่นลงตามแกนตั้งฉากของระนาบ */
      /* ผุดขึ้นตอนเลื่อนเข้าหน้านี้ (ไม่ใช่ตอนพาเนลเปิด — ตอนนั้นยังอยู่หน้าแนะนำตัว) */
      const k = clamp01((clamp01((page - (UXUI_PAGE - 0.7)) / 0.55) - i * 0.06) / 0.4)
      const b = bodies.current[i]
      if (b) {
        b.visible = k > 0
        b.position.z = sh.base + (1 - outBack(k)) * 160
      }
    })
  })

  return (
    <group ref={root} visible={false}>
      <group ref={idea} visible={false}>
        {/* ฟองความคิด: เม็ดเล็กสองเม็ดไล่จากหัว + ก้อนเมฆจากลูกกลมซ้อน + หลอดไฟเหลืองตรงกลาง */}
        <mesh geometry={ideaParts.ball} material={ideaParts.cloud} position={[1.25, -0.95, 0]} scale={0.1} />
        <mesh geometry={ideaParts.ball} material={ideaParts.cloud} position={[0.95, -0.65, 0]} scale={0.16} />
        {[
          [0, 0, 0.42],
          [-0.38, -0.05, 0.3],
          [0.38, -0.06, 0.32],
          [-0.18, 0.24, 0.3],
          [0.22, 0.22, 0.28],
        ].map(([x, y, r], i) => (
          <mesh key={i} geometry={ideaParts.ball} material={ideaParts.cloud} position={[x, y, -0.2]} scale={r} />
        ))}
        <group position={[0, 0.02, 0.32]}>
          <mesh geometry={ideaParts.ball} material={ideaParts.bulb} position={[0, 0.06, 0]} scale={0.16} />
          <mesh geometry={ideaParts.neck} material={ideaParts.base} position={[0, -0.15, 0]} />
        </group>
      </group>
      <group ref={device} visible={false}>
        <DeviceScene />
      </group>
      <group ref={desk} matrixAutoUpdate={false} visible={false}>
        <group>
          <DesktopUI api={deskApi} />
        </group>
      </group>
      {parts.items.map(({ sh, geo, mat }, i) => (
        <group
          key={i}
          matrixAutoUpdate={false}
          ref={(g) => {
            groups.current[i] = g
          }}
        >
          <group
            ref={(g) => {
              bodies.current[i] = g
            }}
          >
            <mesh geometry={geo} material={mat} onBeforeRender={clipOn} onAfterRender={clipOff} />
            {sh.card && (
              /* ของบนหน้าการ์ด: ย้ายจุดศูนย์จากกลางการ์ดไปมุมซ้ายบน (แกน y ลงของกรอบการ์ด) */
              <group position={[-sh.w / 2, sh.h / 2, sh.depth + 0.4]}>
                <primitive object={parts.dots} onBeforeRender={clipOn} onAfterRender={clipOff} />
                <mesh geometry={parts.slash} material={parts.ink} onBeforeRender={clipOn} onAfterRender={clipOff} />
                {parts.words.map((g, j) => (
                  <mesh key={j} geometry={g} material={parts.ink} position={[0, -ROWS[1], 0]} onBeforeRender={clipOn} onAfterRender={clipOff} />
                ))}
              </group>
            )}
          </group>
        </group>
      ))}
    </group>
  )
}
