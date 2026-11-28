import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import penNibSvg from '@/assets/icons/pen-nib.svg?raw'
import { ISO_Q, ISO_S, SIGN_FOOT, SLAB, isoAnchor, magStart } from './isoStage'

/**
 * ฉากสกิลมุมไอโซ — แผ่นเรียบหนึ่งแผ่นต่อสกิล ต่อกันเป็นพื้นเดียว และ "การ์ด" ใบเดียวที่เดินทางข้ามทุกแผ่น
 * (การ์ดอยู่กับพื้น ไม่ใช่กับแผ่น — แผ่นไหลผ่านใต้มัน มันจึงถูกส่งต่อจากสกิลหนึ่งไปอีกสกิล)
 *
 *   Research  แว่นขยาย (บินมาจากช่องค้นหาของฟอง) ส่องกระดาษทีละแผ่น แผ่นที่ส่องแล้วติดจุดฟ้า
 *             แล้วกระดาษทั้งหมดรวมตัวเป็นการ์ดใบเดียว = สิ่งที่ค้นพบ (สองบรรทัด)
 *   Design    ปากกาออกแบบวาดโครงลงบนการ์ดทีละชิ้น — หัว รูป ปุ่ม (ยังเป็นเส้นโครง)
 *   Coding    เทอร์มินัลข้าง ๆ พิมพ์โค้ดทีละบรรทัด โครงบนการ์ดเติมสีจริงทีละชิ้น การ์ดยกตั้งเป็นจอ ติดเครื่องหมายเสร็จ
 *
 * act[i] = ความคืบหน้าของเรื่องบนแผ่น i (0..1) ระหว่างที่แผ่นจอดนิ่งใต้ป้าย (ดู BEAT.tour ใน BubbleTraveler)
 * สีแบนไม่รับแสง เส้นขอบกรมท่าบาง — ทุกอย่างคิดจากการเลื่อน เลื่อนกลับได้
 */
export type IsoPose = { on: boolean; iso: number; grow: number; page: number; mag: number; lift: number; act: number[] }

const C = {
  ink: '#14204a',
  paper: '#ffffff',
  paperS: '#dfe5f3',
  wire: '#eef2fa',
  mute: '#c4cde2',
  lav: '#e9e3f6',
  orange: '#fd5000',
  purple: '#ad85fe',
  blue: '#158ffc',
  blueD: '#0b63c9',
  night: '#1d2140',
  code: '#7cf0a6',
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}
const outBack = (x: number) => {
  const u = clamp01(x) - 1
  return 1 + 2.2 * u * u * u + 1.2 * u * u
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

type Bag = { geos: THREE.BufferGeometry[]; mats: THREE.Material[]; texs: THREE.Texture[]; line: THREE.LineBasicMaterial }

function mat(bag: Bag, color: string, map?: THREE.Texture) {
  const m = new THREE.MeshBasicMaterial({ color: map ? '#ffffff' : color, map: map ?? null, toneMapped: false })
  bag.mats.push(m)
  return m
}

/** เมช + เส้นขอบกรมท่า (ขอบที่หักมุมเกิน 25°) */
function outlined(bag: Bag, geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[]) {
  bag.geos.push(geo)
  const g = new THREE.Group()
  g.add(new THREE.Mesh(geo, m))
  const eg = new THREE.EdgesGeometry(geo, 25)
  bag.geos.push(eg)
  g.add(new THREE.LineSegments(eg, bag.line))
  return g
}

/** กล่องวางบนพื้น (ฐาน y 0) สีเดียวทุกด้าน หรือ [บน, ข้าง] */
function box(bag: Bag, w: number, h: number, d: number, top: THREE.Material, side?: THREE.Material) {
  const geo = new THREE.BoxGeometry(w, h, d)
  geo.translate(0, h / 2, 0)
  const s = side ?? top
  return outlined(bag, geo, [s, s, top, s, s, s])
}

/** ลายบรรทัดบนกระดาษ */
function textTex() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 192
  const x = c.getContext('2d') as CanvasRenderingContext2D
  x.fillStyle = C.paper
  x.fillRect(0, 0, 256, 192)
  x.fillStyle = C.mute
  for (let y = 34, i = 0; y < 170; y += 22, i += 1) x.fillRect(28, y, i % 3 === 2 ? 120 : 200, 7)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** ด้านหน้าของแผ่น: สีสกิลไล่เข้มลงที่ขอบล่าง */
function sideTex(color: string) {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 64
  const x = c.getContext('2d') as CanvasRenderingContext2D
  const g = x.createLinearGradient(0, 0, 0, 64)
  g.addColorStop(0, color)
  g.addColorStop(1, new THREE.Color(color).multiplyScalar(0.7).getStyle())
  x.fillStyle = g
  x.fillRect(0, 0, 4, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** แผ่นเรียบ: ผิวบนขาวอมสีสกิลจาง ๆ ด้านหน้าสีสกิล ปลายซ้ายสีอ่อน */
function platform(bag: Bag, color: string) {
  const side = sideTex(color)
  bag.texs.push(side)
  const geo = new THREE.BoxGeometry(SLAB.L, SLAB.T, SLAB.D)
  geo.translate(0, -SLAB.T / 2, 0)
  const white = new THREE.Color('#ffffff')
  const top = mat(bag, new THREE.Color(color).lerp(white, 0.93).getStyle())
  const end = mat(bag, new THREE.Color(color).lerp(white, 0.6).getStyle())
  const s = mat(bag, '#ffffff', side)
  return outlined(bag, geo, [s, end, top, s, s, s])
}

/* ---------------------------------------------------------------- การ์ดที่เดินทาง */

/** การ์ดวางที่จุดนี้บนพื้น (ตรงกลางแผ่นที่จอดใต้ป้าย) */
const CARD_P = new THREE.Vector3(-0.1, 0, 0.0)
const CARD = { w: 0.3, d: 0.2, h: 0.008 }
/** ชิ้นบนการ์ด (x, z, w, d) · สีสุดท้ายตอนเขียนโค้ดเสร็จ */
const BLOCKS = [
  { key: 'header', x: 0, z: -0.068, w: 0.25, d: 0.026, fin: C.ink },
  { key: 'image', x: -0.068, z: 0.012, w: 0.1, d: 0.08, fin: C.blue },
  { key: 'button', x: 0.068, z: 0.064, w: 0.1, d: 0.028, fin: C.orange },
] as const
/** สองบรรทัด "สิ่งที่ค้นพบ" — มีตั้งแต่จบ Research */
const LINES = [
  { x: 0.068, z: -0.012, w: 0.1 },
  { x: 0.055, z: 0.018, w: 0.074 },
]

function buildCard(bag: Bag) {
  const g = new THREE.Group()
  g.add(box(bag, CARD.w, CARD.h, CARD.d, mat(bag, C.paper), mat(bag, C.paperS)))
  const blocks = BLOCKS.map((b) => {
    const m = mat(bag, C.wire)
    const o = box(bag, b.w, 0.004, b.d, m)
    o.position.set(b.x, CARD.h, b.z)
    g.add(o)
    return { o, m, fin: new THREE.Color(b.fin) }
  })
  const lineM = mat(bag, C.mute)
  const lines = LINES.map((l) => {
    const o = box(bag, l.w, 0.003, 0.012, lineM)
    o.position.set(l.x, CARD.h, l.z)
    g.add(o)
    return o
  })
  /* เครื่องหมายเสร็จ: วงกลมฟ้า + ติ๊กขาวสองท่อน */
  const badge = new THREE.Group()
  const disc = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 40)
  disc.translate(0, 0.005, 0)
  badge.add(outlined(bag, disc, mat(bag, C.blue)))
  const tickM = mat(bag, '#ffffff')
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.004, 0.006), tickM)
  t1.position.set(-0.007, 0.012, 0.004)
  t1.rotation.y = -0.8
  const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.006), tickM)
  t2.position.set(0.007, 0.012, -0.002)
  t2.rotation.y = 0.75
  bag.geos.push(t1.geometry, t2.geometry)
  badge.add(t1, t2)
  badge.position.set(CARD.w / 2 - 0.01, CARD.h, -CARD.d / 2 + 0.01)
  g.add(badge)
  return { g, blocks, lineM, lines, badge }
}

/* ---------------------------------------------------------------- แผ่นของแต่ละสกิล */

/** กระดาษที่แว่นส่อง (x, z, หมุน) — แว่นไล่ส่องตามลำดับนี้ */
const SHEETS = [
  { x: -0.36, z: -0.06, ry: 0.22 },
  { x: -0.12, z: -0.14, ry: -0.12 },
  { x: -0.3, z: 0.13, ry: -0.3 },
  { x: -0.05, z: 0.04, ry: 0.15 },
]
const MAG_Y = 0.055

function researchSlab(bag: Bag, tex: THREE.Texture) {
  const g = new THREE.Group()
  g.add(platform(bag, C.blue))
  const paperTop = mat(bag, '#ffffff', tex)
  const paperSide = mat(bag, C.paperS)
  const markM = mat(bag, C.blue)
  const sheets = SHEETS.map((s) => {
    const o = new THREE.Group()
    o.add(box(bag, 0.15, 0.004, 0.11, paperTop, paperSide))
    const mg = new THREE.CylinderGeometry(0.013, 0.013, 0.004, 24)
    mg.translate(0, 0.002, 0)
    const mark = outlined(bag, mg, markM)
    mark.position.set(0.05, 0.004, -0.032)
    o.add(mark)
    o.position.set(s.x, 0, s.z)
    o.rotation.y = s.ry
    g.add(o)
    return { o, mark }
  })
  /* จุดหมายของแว่น (แว่นจริงอยู่นอกพื้น บินมาจากฟอง — ดู Mag) นอนเกือบราบ เอียงเข้าหาคนดู */
  const magEnd = new THREE.Object3D()
  magEnd.rotation.set(-1.15, 0, 0.62, 'YXZ')
  magEnd.scale.setScalar(0.085)
  g.add(magEnd)
  return { g, sheets, magEnd }
}

function designSlab(bag: Bag) {
  const g = new THREE.Group()
  g.add(platform(bag, C.orange))
  const data = new SVGLoader().parse(penNibSvg)
  const nibGeo = new THREE.ExtrudeGeometry(
    data.paths.flatMap((p) => SVGLoader.createShapes(p)),
    { depth: 4, bevelEnabled: false, curveSegments: 8 },
  )
  /* ปลายปากกาที่จุดกำเนิด (ล่างกลางของไอคอน) — วางปลายลงบนการ์ดได้ตรง ๆ */
  nibGeo.translate(-16, -32, -2)
  nibGeo.scale(-1 / 32, -1 / 32, 1 / 32)
  nibGeo.rotateY(Math.PI)
  const nib = outlined(bag, nibGeo, [mat(bag, C.orange), mat(bag, '#b83a00')])
  nib.scale.setScalar(0.17)
  const pen = new THREE.Group()
  pen.add(nib)
  g.add(pen)
  return { g, pen }
}

function codingSlab(bag: Bag) {
  const g = new THREE.Group()
  g.add(platform(bag, C.purple))
  /* เทอร์มินัล: แผ่นมืด บรรทัดโค้ดยาวออกทีละบรรทัด */
  const term = new THREE.Group()
  term.add(box(bag, 0.17, 0.014, 0.12, mat(bag, C.night)))
  const codeM = mat(bag, C.code)
  const purpleM = mat(bag, C.purple)
  const rows = [0.09, 0.12, 0.06, 0.1, 0.07].map((w, i) => {
    const geo = new THREE.BoxGeometry(1, 0.002, 0.009)
    geo.translate(0.5, 0.001, 0)
    bag.geos.push(geo)
    const o = new THREE.Mesh(geo, i % 2 ? purpleM : codeM)
    o.position.set(-0.065 + (i === 2 || i === 3 ? 0.015 : 0), 0.014, -0.04 + i * 0.02)
    o.userData.w = w
    term.add(o)
    return o
  })
  term.position.set(-0.4, 0, 0.06)
  term.rotation.y = 0.12
  g.add(term)
  return { g, term, rows }
}

/** แว่นขยาย: วงหนา ผนังเข้ม เลนส์ม่วงอ่อนมีแสงสะท้อน ด้ามสองท่อน — วงนอกรัศมี 1 หน่วย ด้ามชี้ขวาล่าง */
function buildMag(bag: Bag) {
  const g = new THREE.Group()
  const ring = new THREE.Shape().absarc(0, 0, 1, 0, Math.PI * 2, false)
  ring.holes.push(new THREE.Path().absarc(0, 0, 0.787, 0, Math.PI * 2, true))
  const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.32, bevelEnabled: false, curveSegments: 64 })
  ringGeo.translate(0, 0, -0.16)
  const cap = mat(bag, C.blue)
  const wall = mat(bag, C.blueD)
  g.add(outlined(bag, ringGeo, [cap, wall]))
  const lens = new THREE.Group()
  const lensGeo = new THREE.CylinderGeometry(0.79, 0.79, 0.05, 64)
  lensGeo.rotateX(Math.PI / 2)
  bag.geos.push(lensGeo)
  lens.add(new THREE.Mesh(lensGeo, mat(bag, C.lav)))
  const hiGeo = new THREE.CircleGeometry(1, 40)
  bag.geos.push(hiGeo)
  const hiM = mat(bag, '#ffffff')
  const hi = new THREE.Mesh(hiGeo, hiM)
  hi.scale.set(0.42, 0.2, 1)
  hi.position.set(0.12, 0.3, 0.03)
  hi.rotation.z = 0.15
  lens.add(hi)
  const hi2 = new THREE.Mesh(hiGeo, hiM)
  hi2.scale.setScalar(0.09)
  hi2.position.set(-0.46, 0.22, 0.03)
  lens.add(hi2)
  g.add(lens)
  /* ด้าม: ทิศขวาล่างแบบแว่นในช่องค้นหา (ดู searchGeo ของฟอง) */
  const dir = new THREE.Vector3(Math.SQRT1_2, -Math.SQRT1_2, 0)
  const neck = outlined(bag, new THREE.CylinderGeometry(0.13, 0.13, 0.62, 24), wall)
  neck.position.copy(dir).multiplyScalar(1.24)
  neck.rotation.z = Math.PI / 4
  g.add(neck)
  const grip = outlined(bag, new THREE.CylinderGeometry(0.24, 0.24, 1, 32), cap)
  grip.rotation.z = Math.PI / 4
  g.add(grip)
  g.userData = { lens, grip, dir, cap, wall }
  return g
}

/* ---------------------------------------------------------------- เส้นทาง */

/** แว่น: เหนือกระดาษแผ่นแรก → ไล่ส่องทีละแผ่น (ช่วงละ 0.15) → ถอยขึ้นไปพักหลังแผ่นตอนกระดาษรวมเป็นการ์ด */
const MAG_REST = new THREE.Vector3(-0.3, 0.1, -0.2)
function magPath(r: number, out: THREE.Vector3) {
  const hop = 0.15
  const k = Math.min(SHEETS.length - 1, Math.floor(r / hop))
  const u = smooth(((r - k * hop) / hop) * 1.8)
  const a = SHEETS[Math.max(0, k - 1)]
  const b = SHEETS[k]
  out.set(lerp(a.x, b.x, k === 0 ? 1 : u), MAG_Y + Math.sin(u * Math.PI) * 0.03 * (k ? 1 : 0), lerp(a.z, b.z, k === 0 ? 1 : u))
  const back = smooth((r - 0.6) / 0.3)
  return out.lerp(MAG_REST, back)
}

/** ปากกา: ลอยรอเหนือการ์ด → ลงวาดชิ้นที่ k ในช่วง [k/4, (k+1)/4] (ลากจากซ้ายไปขวาของชิ้น) → ยกขึ้นพัก */
const PEN_REST = new THREE.Vector3(0.18, 0.14, -0.12)
function penPath(d: number, out: THREE.Vector3) {
  const k = Math.floor(d * 4)
  if (k >= BLOCKS.length) {
    const b = BLOCKS[BLOCKS.length - 1]
    return out.set(CARD_P.x + b.x + b.w / 2, 0.08, CARD_P.z + b.z).lerp(PEN_REST, smooth((d - 0.75) / 0.2))
  }
  const b = BLOCKS[k]
  const u = clamp01(d * 4 - k)
  const draw = smooth((u - 0.2) / 0.7)
  const down = smooth(u / 0.2) * (1 - smooth((u - 0.92) / 0.08))
  return out.set(CARD_P.x + b.x + lerp(-b.w / 2, b.w / 2, draw), lerp(0.08, CARD.h + 0.004, down), CARD_P.z + b.z)
}

const WHITE = new THREE.Color('#ffffff')
const BLUE = new THREE.Color(C.blue)
const BLUE_D = new THREE.Color(C.blueD)
const WIRE = new THREE.Color(C.wire)
const MUTE = new THREE.Color(C.mute)
const INK = new THREE.Color(C.ink)
const A = new THREE.Vector3()
const EP = new THREE.Vector3()
const EQ = new THREE.Quaternion()
const ES = new THREE.Vector3()
const V = new THREE.Vector3()

export function IsoSkills({ pose }: { pose: React.RefObject<IsoPose> }) {
  const { size } = useThree()
  const root = useRef<THREE.Group>(null)
  const floor = useRef<THREE.Group>(null)
  const track = useRef<THREE.Group>(null)

  const built = useMemo(() => {
    const line = new THREE.LineBasicMaterial({ color: C.ink, toneMapped: false })
    const bag: Bag = { geos: [], mats: [], texs: [], line }
    const tex = textTex()
    bag.texs.push(tex)
    const research = researchSlab(bag, tex)
    const design = designSlab(bag)
    const coding = codingSlab(bag)
    /* แผ่นต่อกันเป็นพื้นเดียว แผ่นถัดไปอยู่ทางซ้ายล่าง — เลื่อนลง พื้นไหลขึ้นขวาบน แผ่นถัดไปเข้ามาใต้ป้าย */
    ;[research.g, design.g, coding.g].forEach((g, i) => (g.position.x = -i * SLAB.SP))
    const card = buildCard(bag)
    card.g.position.copy(CARD_P)
    const mag = buildMag(bag)
    return { bag, research, design, coding, card, mag }
  }, [])
  useEffect(
    () => () => {
      const { bag } = built
      bag.geos.forEach((g) => g.dispose())
      bag.mats.forEach((m) => m.dispose())
      bag.texs.forEach((t) => t.dispose())
      bag.line.dispose()
    },
    [built],
  )

  useFrame(() => {
    const p = pose.current
    const r = root.current
    const f = floor.current
    const tr = track.current
    const { research, design, coding, card, mag } = built
    if (!p || !r || !f || !tr) return
    const W = size.width
    const H = size.height
    const on = p.on && p.iso > 0.001
    r.visible = on && p.grow > 0.001
    mag.visible = on && p.mag > 0.001
    if (!on) return
    const [ar, ad, ac] = p.act

    isoAnchor(W, H, A)
    r.position.set(A.x, A.y - p.lift, A.z)
    r.quaternion.copy(ISO_Q)
    r.scale.setScalar(W * ISO_S)
    /* แผ่นแรกคลี่ออกจากฐานป้าย: ขยายรอบจุดที่ป้ายยืน */
    const gk = Math.max(1e-3, p.grow)
    f.scale.setScalar(gk)
    f.position.copy(SIGN_FOOT).multiplyScalar(1 - gk)
    tr.position.x = p.page * SLAB.SP

    /* ── Research: กระดาษเด้งขึ้นหลังแผ่นคลี่ · ส่องแล้วติดจุด · รวมตัวเข้าการ์ด ── */
    const pop = clamp01((p.grow - 0.55) / 0.45)
    const merge = smooth((ar - 0.62) / 0.26)
    research.sheets.forEach((s, i) => {
      const k = outBack((pop - i * 0.12) / 0.5)
      const src = SHEETS[i]
      s.o.visible = k > 0.001 && merge < 0.999
      s.o.position.set(lerp(src.x, CARD_P.x, merge), merge * 0.012 * (i + 1), lerp(src.z, CARD_P.z, merge))
      s.o.rotation.y = lerp(src.ry, 0, merge)
      s.o.scale.setScalar(Math.max(1e-3, k * lerp(1, 0.9, merge)))
      s.mark.scale.setScalar(Math.max(1e-3, outBack((ar - (i * 0.15 + 0.1)) / 0.08)))
    })
    magPath(ar, V)
    research.magEnd.position.copy(V)

    /* ── การ์ด: เกิดตอนกระดาษรวมตัวเสร็จ ── */
    const born = outBack((ar - 0.84) / 0.14)
    card.g.visible = born > 0.001
    card.g.scale.setScalar(Math.max(1e-3, born))
    /* Design วาดโครงทีละชิ้น (ยืดตามแนวที่ปากกาลาก) · Coding เติมสีจริงทีละชิ้น */
    card.blocks.forEach((b, i) => {
      const drawn = smooth(((ad * 4 - i) - 0.2) / 0.7)
      b.o.visible = drawn > 0.001
      b.o.scale.set(Math.max(1e-3, drawn), 1, 1)
      b.o.position.x = BLOCKS[i].x - (BLOCKS[i].w / 2) * (1 - drawn)
      b.m.color.copy(WIRE).lerp(b.fin, smooth((ac - 0.25 - i * 0.15) / 0.15))
    })
    card.lineM.color.copy(MUTE).lerp(INK, smooth((ac - 0.7) / 0.15))
    /* Coding: การ์ดยกขอบหลังขึ้นเป็นจอเอียงหาคนดู แล้วติดเครื่องหมายเสร็จ */
    const stand = smooth(ac / 0.25)
    card.g.position.set(CARD_P.x, stand * 0.05, CARD_P.z)
    card.g.rotation.x = stand * 0.75
    card.badge.scale.setScalar(Math.max(1e-3, outBack((ac - 0.88) / 0.1)))

    /* ── Design: ปากกาลงวาด ── */
    penPath(ad, V)
    design.pen.position.copy(V)
    design.pen.rotation.set(0, -0.5, 0.35 * (1 - smooth((ad - 0.75) / 0.2)))
    design.pen.visible = Math.abs(p.page - 1) < 1.2

    /* ── Coding: เทอร์มินัลพิมพ์ทีละบรรทัด ── */
    coding.rows.forEach((o, i) => {
      const k = smooth((ac - i * 0.09) / 0.12)
      o.scale.x = Math.max(1e-3, k * o.userData.w)
      o.visible = k > 0.001
    })

    /* แว่น: จากท่าของแว่นในฟอง (magStart) → จุดหมายบนแผ่น Research แล้วติดไปกับแผ่น */
    if (mag.visible) {
      /* จุดหมายคิดจากแผ่นที่คลี่เต็มแล้ว — แว่นบินไปขนาดจริงตั้งแต่ต้น ไม่หดตามแผ่นที่ยังเล็ก */
      f.scale.setScalar(1)
      f.position.set(0, 0, 0)
      r.updateMatrixWorld(true)
      research.magEnd.matrixWorld.decompose(EP, EQ, ES)
      f.scale.setScalar(gk)
      f.position.copy(SIGN_FOOT).multiplyScalar(1 - gk)
      const m = p.mag
      const e = m * m * (3 - 2 * m)
      mag.position.lerpVectors(magStart.p, EP, e)
      mag.quaternion.slerpQuaternions(magStart.q, EQ, e)
      mag.scale.setScalar(magStart.s + (ES.x - magStart.s) * e)
      const u = mag.userData
      u.cap.color.copy(WHITE).lerp(BLUE, clamp01(m * 1.6))
      u.wall.color.copy(WHITE).lerp(BLUE_D, clamp01(m * 1.6))
      u.lens.scale.setScalar(Math.max(1e-3, outBack((m - 0.35) / 0.5)))
      /* ด้ามยืดออก: ท่อนจับงอกต่อจากคอ */
      const gl = Math.max(1e-3, clamp01((m - 0.2) / 0.6))
      u.grip.scale.set(1, gl * 1.3, 1)
      u.grip.position.copy(u.dir).multiplyScalar(1.55 + gl * 0.65)
    }
  })

  return (
    <>
      <group ref={root} visible={false}>
        <group ref={floor}>
          <group ref={track}>
            <primitive object={built.research.g} />
            <primitive object={built.design.g} />
            <primitive object={built.coding.g} />
          </group>
          <primitive object={built.card.g} />
        </group>
      </group>
      <primitive object={built.mag} visible={false} />
    </>
  )
}
