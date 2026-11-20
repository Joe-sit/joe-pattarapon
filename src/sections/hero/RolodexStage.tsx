import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { DEVICE, FOV, STORY_FONT, TAN, smooth, worksPost, type WorkBeats } from './workMotion'
import { WORKS } from './WorksGallery'
import { HOME_ICON, ICON_PX, roadCut, roadPhase } from './roadWorld'
import { paintHome } from './RoadHome'

/**
 * ทางผ่านเข้า Selected Work แบบ "ไอคอนแอประเบิดเป็น rolodex" — ต่อท้ายบท Code (POST_CODE = 'rolodex' ใน ./workMotion)
 *
 * ต้นเรื่องเดียวกับเรื่องถนน (GIF ref — ./roadWorld): เครื่องชนคำ Code → จอเป็นหน้าโฮม → ดันเข้าไอคอนแอป (favicon)
 * ตัดมาแคนวาสนี้ตอนไอคอนกว้าง ICON_PX ของจอ (ท่าเดียวกันพอดี) แล้วเล่นตามคลิป ref (Ecommpay sting 0–1.73 วิ) เป๊ะ ๆ:
 *
 *   0.367  ตัดเฟรมเดียว: พื้นเป็นดำ · ใบหน้ายังเป็นไอคอนแอป (favicon) — ไอคอนคือใบแรกของปึก พลิกออกเป็นใบแรก
 *   0.40   ทั้งก้อนเริ่มหมุนรอบแกนตั้ง เห็นสันการ์ดที่ซ้อนข้างหลัง → 0.47 หมุนจนเห็นด้านข้าง (การ์ดเป็นแผ่น ๆ)
 *   0.50   กางพรวดตามแกนเฉียงขึ้นขวา ขยายเป็นราว 3 เท่า (ease-out แรง ~5 เฟรม) · การ์ดเอียงเป็นทรง V หันเข้าช่องกลาง
 *   0.6–1.47  ค้าง ลอยนิด ๆ — คลื่นพลิก: ทีละใบ พลิกข้ามช่องกลาง (ผ่านจังหวะเห็นแค่สัน) จากกองขวาไปกองซ้าย
 *   1.47–1.73 หุบรัว: ระยะหดเป็นศูนย์ ขนาดกลับเท่าไอคอน ก้อนหมุนต่อทางเดิมจนครบครึ่งรอบ ใบสุดท้าย (favicon) หันหน้าตรง
 *
 * การ์ด flat ล้วน (ไม่รับแสง) ขอบหนาสีโทนเดียวกับตัวการ์ด ข้างในเป็นก้อนกลม/แคปซูลโทนเดียวกัน · มีลายทั้งสองหน้า
 * เวลาของคลิปผูกกับการเลื่อน (rolodexPhase().t) — เลื่อนเร็วสม่ำเสมอได้ภาพเหมือนคลิปทุกเฟรม
 *
 * โครง: กลุ่มนอก = เอียงแกน (roll) + ขนาด · กลุ่มใน = หมุนทั้งก้อน (yaw: 0 → −π/2 ค้าง → −π) · การ์ดเรียงตามแกนลึกของกลุ่มใน
 * หมุนก้อน −π/2 แล้วแกนลึกกลายเป็นแนวนอน (ใบหน้าไปซ้ายสุด) · หมุนต่อถึง −π ใบท้ายสุดกลับมาอยู่หน้าสุด
 */
const ICON_S = 4
const D0 = ICON_S / (2 * TAN * ICON_PX)

/**
 * จังหวะ (worksPost):
 *   OPEN    rolodex เปิดตามคลิป (เวลาคลิป REF0 → HOLD_T: ตัดดำ · ก้อนหมุน · กาง · พลิกไม่กี่ใบ) แล้วค้างทรง V
 *   UNF     Selected Projects: การ์ดหลุดจากปึกทีละใบ ล้มลงเรียงเป็นแถว isometric ลงมุมขวาล่าง กลายเป็นปกงานระหว่างทาง
 *           ไอคอนแอปลงไปนอนเป็นต้นแถว · แถวไหลไม่หยุด · หัวเรื่องซ้ายบน
 *   REFOLD  ปกบินกลับเข้าปึก (ทรง V เดิม) · CLOSE rolodex ปิดย้อนทางเดิมจนเหลือไอคอนหน้าตรง
 *   BACK_HOME ตัดกลับหน้าโฮม → ถอยออกเป็นเครื่อง (./roadWorld) — ต้องเสร็จก่อนหนังสติ๊กของบท Ship โผล่ (~worksPost 2.5)
 */
const P0 = 0.4
const OPEN = [P0, 0.75] as const
const HOLD_T = 1.3
const UNF = [1.15, 0.38] as const
const REFOLD = [1.86, 0.2] as const
const CLOSE = [2.06, 0.17] as const
const BACK_HOME = 2.24
const at01 = (x: number, r: readonly [number, number]) => Math.min(1, Math.max(0, (x - r[0]) / r[1]))
const REF0 = 0.333
/** เฟรมตัดดำของคลิป */
const CUT_T = 0.367

export function rolodexPhase(b: { code: number; works: number }) {
  const rp = roadPhase(b)
  const post = worksPost(b)
  const close = at01(post, CLOSE)
  /* เวลาคลิป: เปิด REF0 → HOLD_T · ปิดย้อน HOLD_T → ก่อนเฟรมตัด (เหลือไอคอนหน้าตรงใบเดียว) */
  const t = post < P0 ? 0 : close > 0 ? HOLD_T - close * (HOLD_T - CUT_T + 0.01) : REF0 + at01(post, OPEN) * (HOLD_T - REF0)
  const unf = smooth(at01(post, UNF)) * (1 - smooth(at01(post, REFOLD)))
  /* พื้นดำตั้งแต่เฟรมตัดของขาเปิด จนตัดกลับหน้าโฮม */
  const black = post >= P0 + ((CUT_T - REF0) / (HOLD_T - REF0)) * OPEN[1] && post < BACK_HOME
  return { post, home: rp.home, dolly: rp.dolly, cut: roadCut(rp), t, unf, black }
}

/** ค่าตามเวลาคลิป: จุดคีย์ [เวลา, ค่า] ต่อกันแบบโค้งต่อเนื่องไม่เลย (monotone cubic) */
type Keys = readonly (readonly [number, number])[]
function track(k: Keys, t: number) {
  if (t <= k[0][0]) return k[0][1]
  const n = k.length - 1
  if (t >= k[n][0]) return k[n][1]
  let i = 0
  while (t > k[i + 1][0]) i++
  const slope = (a: number) => (k[a + 1][1] - k[a][1]) / (k[a + 1][0] - k[a][0])
  const tan = (j: number) => {
    if (j <= 0) return slope(0)
    if (j >= n) return slope(n - 1)
    const a = slope(j - 1)
    const b = slope(j)
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b)
  }
  const h = k[i + 1][0] - k[i][0]
  const u = (t - k[i][0]) / h
  const flatSeg = slope(i) === 0
  const m0 = flatSeg ? 0 : tan(i)
  const m1 = flatSeg ? 0 : tan(i + 1)
  const u2 = u * u
  const u3 = u2 * u
  return (2 * u3 - 3 * u2 + 1) * k[i][1] + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * k[i + 1][1] + (u3 - u2) * h * m1
}

/* ── คีย์จากคลิป (วัดทีละเฟรมที่ 30fps) ── */
/** ขนาดก้อน เทียบไอคอน (คลิปโต ~3 เท่า — ปึกเรามี 13 ใบ ยาวกว่า จึงโตน้อยกว่านิดให้พอดีจอ) */
const K_SCALE: Keys = [[0.367, 1], [0.4, 1.03], [0.433, 1.07], [0.467, 1.2], [0.5, 1.55], [0.533, 1.95], [0.567, 2.2], [0.6, 2.35], [0.633, 2.42], [1.0, 2.5], [1.433, 2.55], [1.5, 2.55], [1.567, 1.9], [1.6, 1.5], [1.633, 1.2], [1.667, 1.05], [1.733, 1]]
/** หมุนทั้งก้อนรอบแกนตั้ง (เรเดียน) */
const K_YAW: Keys = [[0.367, 0], [0.4, -0.35], [0.433, -0.95], [0.467, -1.3], [0.5, -1.5], [0.567, -1.57], [1.433, -1.6], [1.5, -1.9], [1.567, -2.4], [1.6, -2.75], [1.633, -2.95], [1.667, -3.03], [1.7, -3.1], [1.733, -Math.PI]]
/** เอียงแกนปึกบนจอ (ขึ้นขวา) */
const K_ROLL: Keys = [[0.367, 0], [0.4, -0.1], [0.433, -0.04], [0.467, 0.12], [0.5, 0.3], [0.567, 0.42], [0.633, 0.44], [1.433, 0.44], [1.533, 0.3], [1.6, 0.15], [1.667, 0.05], [1.733, 0]]
/** ระยะกางตามแกน (0 = ซ้อนชิดเป็นก้อน) */
const K_SPREAD: Keys = [[0.4, 0], [0.433, 0.12], [0.467, 0.3], [0.5, 0.62], [0.533, 0.85], [0.567, 0.95], [0.633, 1], [1.433, 1], [1.5, 0.7], [1.567, 0.35], [1.633, 0.08], [1.7, 0.02], [1.733, 0]]
/** ทรง V (การ์ดเอียงเข้าหาช่องกลาง) — ตอนก้อนยังหมุน การ์ดขนานกันหมด */
const K_VEE: Keys = [[0.433, 0], [0.5, 0.6], [0.567, 1], [1.467, 1], [1.567, 0.5], [1.633, 0]]
/** ใบที่อยู่ตรงช่องกลาง (เศษ = กำลังพลิก) — ลำดับ 0 = ไอคอนแอป · ถัดไปการ์ดสี (ใช้ถึงเวลา HOLD_T) */
const K_FLIP: Keys = [[0.367, 0], [0.433, 0.33], [0.5, 1.33], [0.567, 2.89], [0.6, 3.89], [0.667, 5.0], [0.833, 5.56], [1.0, 5.89], [1.3, 6.11], [1.433, 6.67], [1.467, 7.22], [1.533, 8.33], [1.6, 9.33], [1.667, 10]]

/** ปึก: ระยะต่อใบตามแกน · ช่องกลาง · ความหนาก้อนตอนซ้อน (สัดส่วนด้านการ์ด) · มุม V ใกล้ช่อง/ปลายปึก — ทั้งปึกยาวราวครึ่งจอแบบคลิป */
const DECK = { pitch: 0.072, gap: 0.3, stack: 0.012, vNear: 0.17, vFar: 0.38 }

/**
 * ลายการ์ด 9 ใบ (สีตามคลิป) — พื้น · ขอบ (หนา) · ก้อนข้างใน
 * ก้อน: ['c', x, y, r, สี] วงกลม · ['r', x, y, w, h, มุม, สี] สี่เหลี่ยมมน (หน่วย 0..1 ของด้านการ์ด)
 */
type Shape = readonly ['c', number, number, number, string] | readonly ['r', number, number, number, number, number, string]
type Art = { fill: string; edge: string; bw?: number; shapes: readonly Shape[] }
const ARTS: readonly Art[] = [
  {
    fill: '#a688f6',
    edge: '#bea6fa',
    shapes: [
      ['r', 0.12, 0.12, 0.26, 0.13, 0.065, '#9470ef'],
      ['r', 0.5, 0.12, 0.38, 0.14, 0.07, '#9470ef'],
      ['r', 0.3, 0.3, 0.42, 0.42, 0.12, '#5d1fa8'],
      ['c', 0.82, 0.38, 0.075, '#8a5de8'],
      ['c', 0.82, 0.58, 0.075, '#8a5de8'],
      ['c', 0.2, 0.84, 0.07, '#6b2bc4'],
      ['r', 0.33, 0.75, 0.3, 0.15, 0.075, '#7a3ad6'],
      ['r', 0.67, 0.77, 0.22, 0.13, 0.065, '#9470ef'],
    ],
  },
  {
    fill: '#e8423f',
    edge: '#c11fbd',
    shapes: [
      ['r', 0.14, 0.14, 0.3, 0.72, 0.15, '#d4306e'],
      ['c', 0.66, 0.3, 0.13, '#f25b78'],
      ['r', 0.5, 0.5, 0.36, 0.36, 0.13, '#c62968'],
    ],
  },
  {
    fill: '#1f6fe3',
    edge: '#39a3ff',
    shapes: [
      ['r', 0.16, 0.12, 0.22, 0.76, 0.11, '#2d8af0'],
      ['r', 0.5, 0.12, 0.22, 0.5, 0.11, '#2d8af0'],
      ['c', 0.7, 0.79, 0.09, '#2d8af0'],
    ],
  },
  {
    fill: '#0a3d1d',
    edge: '#145028',
    shapes: [
      ['c', 0.62, 0.22, 0.1, '#36a862'],
      ['c', 0.38, 0.44, 0.11, '#2f9a58'],
      ['c', 0.64, 0.6, 0.12, '#6ff2a8'],
      ['r', 0.28, 0.7, 0.36, 0.2, 0.1, '#2f9a58'],
    ],
  },
  {
    fill: '#4c0f8c',
    edge: '#3a0a6f',
    shapes: [
      ['r', 0.16, 0.12, 0.3, 0.46, 0.14, '#9c7ced'],
      ['r', 0.44, 0.3, 0.34, 0.56, 0.16, '#a78bf3'],
      ['c', 0.76, 0.8, 0.08, '#9c7ced'],
    ],
  },
  {
    fill: '#a416e3',
    edge: '#ff5b00',
    bw: 0.075,
    shapes: [
      ['r', 0.2, 0.15, 0.28, 0.4, 0.14, '#ff6a12'],
      ['r', 0.44, 0.4, 0.36, 0.45, 0.16, '#ff6a12'],
      ['c', 0.75, 0.24, 0.09, '#c33cf1'],
    ],
  },
  {
    fill: '#2398f5',
    edge: '#1764d6',
    shapes: [
      ['r', 0.52, 0.1, 0.32, 0.2, 0.1, '#3aa9fb'],
      ['c', 0.3, 0.3, 0.13, '#3aa9fb'],
      ['c', 0.6, 0.46, 0.12, '#1c7fe6'],
      ['c', 0.38, 0.7, 0.12, '#3aa9fb'],
      ['c', 0.72, 0.76, 0.1, '#1c7fe6'],
    ],
  },
  {
    fill: '#0b3a1c',
    edge: '#092d15',
    shapes: [
      ['c', 0.7, 0.3, 0.12, '#6ef0a3'],
      ['c', 0.7, 0.55, 0.12, '#6ef0a3'],
      ['r', 0.46, 0.72, 0.42, 0.18, 0.09, '#58e092'],
    ],
  },
  {
    fill: '#b493f8',
    edge: '#c8b0fb',
    shapes: [
      ['r', 0.5, 0.1, 0.38, 0.32, 0.12, '#5b1ca6'],
      ['r', 0.14, 0.38, 0.3, 0.5, 0.14, '#9f7cf0'],
      ['c', 0.7, 0.68, 0.1, '#8a5de8'],
    ],
  },
]

/** วาดลายการ์ด (512 px) — มุมมนแบบไอคอนแอป · ขอบหนาสีโทนเดียวกัน */
function paintArt(a: Art) {
  const S = 512
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const g = cv.getContext('2d')
  if (!g) return cv
  const r = S * 0.225
  g.fillStyle = a.edge
  g.beginPath()
  g.roundRect(0, 0, S, S, r)
  g.fill()
  const bw = S * (a.bw ?? 0.05)
  g.save()
  g.beginPath()
  g.roundRect(bw, bw, S - bw * 2, S - bw * 2, r - bw * 0.8)
  g.fillStyle = a.fill
  g.fill()
  g.clip()
  for (const sh of a.shapes) {
    g.beginPath()
    if (sh[0] === 'c') {
      g.fillStyle = sh[4]
      g.arc(sh[1] * S, sh[2] * S, sh[3] * S, 0, Math.PI * 2)
    } else {
      g.fillStyle = sh[6]
      g.roundRect(sh[1] * S, sh[2] * S, sh[3] * S, sh[4] * S, sh[5] * S)
    }
    g.fill()
  }
  g.restore()
  return cv
}

function rr(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

const flat = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.5, toneMapped: false })

type Live = { t: number; black: boolean; unf: number; post: number }

/* ── Selected Projects: ปกงานแถว isometric ไหลไม่หยุด (มุมขวาล่าง) ── */
/** ปกงาน (หน่วยโลก — ด้านไอคอน = 4) · ระยะห่าง · ความหนา */
const COVER = { w: 7, h: 4.4, gap: 0.9, t: 0.16 }
const PITCH = COVER.w + COVER.gap
/** มุม isometric: ก้มมอง 35.26° · หันแถว 45° ลงขวา */
const ISO_PITCH = Math.atan(Math.SQRT1_2)
/**
 * แถววางบนเส้นที่ผ่านกลางจอ (จุดที่ไอคอนหดหาย) ทแยงลงขวา — กลางแถวอยู่ห่างจากกลางจอ SRC_K × ความสูงโลก ไปทางมุมขวาล่าง
 * ปกคลี่ออกจากกลางจอพอดี · ความเร็วไหล (หน่วย/วินาที) · ไหลเพิ่มตามการเลื่อน
 */
const SRC_K = 0.55
/** ทิศของแกนแถวบนจอหลังหมุน isometric (หัน −45° แล้วก้ม 35.26°) */
const ROW_DIR = { x: Math.SQRT1_2, y: -Math.SQRT1_2 * Math.sin(Math.atan(Math.SQRT1_2)) }
const FLOW = 1.1
const FLOW_SCROLL = 6

/** หน้าปก: ขอบขาวมน + ปกครอปเต็ม (แคนวาสขนาดตายตัว — texture เปลี่ยนขนาดหลังอัปโหลดไม่ได้) */
const CV_W = 768
const CV_H = Math.round(CV_W * (COVER.h / COVER.w))
function paintCover(img: HTMLImageElement | null) {
  const cv = document.createElement('canvas')
  cv.width = CV_W
  cv.height = CV_H
  const g = cv.getContext('2d')
  if (!g) return cv
  const r = 44
  const b = 16
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.roundRect(0, 0, CV_W, CV_H, r)
  g.fill()
  if (img) {
    g.save()
    g.beginPath()
    g.roundRect(b, b, CV_W - b * 2, CV_H - b * 2, r - b * 0.7)
    g.clip()
    const w = CV_W - b * 2
    const h = CV_H - b * 2
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    g.drawImage(img, b + (w - img.naturalWidth * k) / 2, b + (h - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k)
    g.restore()
  }
  return cv
}

/** การ์ดทั้งปึก: 0 = ไอคอนแอป · 1..M = การ์ดสี (ลายวนชุด ARTS) ผูกกับปกงาน WORKS[i − 1] */
const M = WORKS.length
const C = M + 1
/** คลี่ทีละใบ: ใบ i เริ่มช้ากว่ากัน STAG ของช่วงคลี่ */
const STAG = 0.06
/** สลับลายการ์ด → ปก ตอนยังหันสันอยู่ (ต้นทางคลี่) */
const SWAP = 0.12
const Q_ISO = new THREE.Quaternion().setFromEuler(new THREE.Euler(ISO_PITCH, 0, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 4, 0)))
const Q_LIE = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
const _q = new THREE.Quaternion()
const _v = new THREE.Vector3()
const _p1 = new THREE.Vector3()
const _p2 = new THREE.Vector3()
const _s1 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _q3 = new THREE.Quaternion()
const _mA = new THREE.Matrix4()
const _mB = new THREE.Matrix4()
const _mC = new THREE.Matrix4()
const _one = new THREE.Vector3(1, 1, 1)
const _e = new THREE.Euler()

/**
 * ปึก rolodex + แถว Selected Projects ในชุดเดียว — การ์ดแต่ละใบมีสองท่า: ในปึก (คีย์จากคลิป) กับในแถว isometric
 * ผสมกันตามความคืบหน้าคลี่ของใบนั้น (u) → ปกงานคลี่ออกมาจาก rolodex จริง ๆ ไม่ใช่งอกใหม่
 */
function Deck({ live }: { live: React.RefObject<Live> }) {
  const icon = useTexture('/favicon-512.png')
  const cards = useRef<(THREE.Group | null)[]>([])
  const arts = useRef<(THREE.Group | null)[]>([])
  const covers = useRef<(THREE.Group | null)[]>([])
  const wall = useRef<THREE.Mesh>(null)
  const scene = useThree((s) => s.scene)
  const flowAcc = useRef(0)

  const res = useMemo(() => {
    icon.colorSpace = THREE.SRGBColorSpace
    icon.anisotropy = 4
    /* ตัวการ์ดบาง (สันเห็นเป็นเส้นตอนหันข้าง) + หน้าลายทั้งสองด้าน */
    const body = new THREE.ExtrudeGeometry(rr(ICON_S * 0.985, ICON_S * 0.985, ICON_S * 0.22), { depth: ICON_S * 0.02, bevelEnabled: false, curveSegments: 12 })
    body.translate(0, 0, -ICON_S * 0.01)
    const face = new THREE.PlaneGeometry(ICON_S, ICON_S)
    const artTex = ARTS.map((a) => {
      const tx = new THREE.CanvasTexture(paintArt(a))
      tx.colorSpace = THREE.SRGBColorSpace
      tx.anisotropy = 4
      return tx
    })
    /* ปก: ตัวแผ่นหนาเทาอ่อน + หน้าปก (ขอบขาวมน) ทั้งสองด้าน */
    const coverBody = new THREE.ExtrudeGeometry(rr(COVER.w, COVER.h, 0.42), { depth: COVER.t, bevelEnabled: false, curveSegments: 10 })
    coverBody.translate(0, 0, -COVER.t / 2)
    const coverFace = new THREE.PlaneGeometry(COVER.w, COVER.h)
    const coverTex = WORKS.map((w) => {
      const t = new THREE.CanvasTexture(paintCover(null))
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        t.image = paintCover(img)
        t.needsUpdate = true
      }
      img.src = w.img
      return t
    })
    const wallTex = paintHome()
    /* หน้าโฮมข้างหลังไอคอน: ขนาด/ตำแหน่งตามจอเครื่อง (ไอคอนบนจอ = ไอคอนนี้) */
    const u = ICON_S / HOME_ICON.s
    return {
      body,
      face,
      artTex,
      artMats: artTex.map(flat),
      edgeMats: ARTS.map((a) => new THREE.MeshBasicMaterial({ color: a.edge, toneMapped: false })),
      iconMat: flat(icon),
      iconEdge: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      coverBody,
      coverFace,
      coverTex,
      coverMats: coverTex.map((t) => new THREE.MeshBasicMaterial({ map: t, toneMapped: false })),
      coverEdge: new THREE.MeshBasicMaterial({ color: '#c9d3e6', toneMapped: false }),
      wallTex,
      wallMat: new THREE.MeshBasicMaterial({ map: wallTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
      wallScale: [(DEVICE.hw * 2 * u) / ICON_S, (DEVICE.hh * 2 * u) / ICON_S, 1] as [number, number, number],
      wallPos: [-HOME_ICON.x * u, -HOME_ICON.y * u, -0.6] as [number, number, number],
      black: new THREE.Color('#000000'),
    }
  }, [icon])
  useEffect(
    () => () => {
      ;[res.body, res.face, res.coverBody, res.coverFace].forEach((g) => g.dispose())
      ;[...res.artMats, ...res.edgeMats, res.iconMat, res.iconEdge, ...res.coverMats, res.coverEdge, res.wallMat].forEach((m) => m.dispose())
      ;[...res.artTex, ...res.coverTex, res.wallTex].forEach((x) => x.dispose())
      scene.background = null
    },
    [res, scene],
  )

  const zs = useMemo(() => new Float32Array(C), [])
  useFrame((_, dt) => {
    const L = live.current
    if (!L) return
    const tt = L.t
    const started = tt >= CUT_T
    /* พื้น: ตัดเป็นดำเฟรมเดียว (แบบคลิป) · หน้าโฮมข้างหลังไอคอนอยู่จนถึงตอนนั้น และกลับมาตอนตัดกลับ */
    scene.background = L.black ? res.black : null
    if (wall.current) wall.current.visible = !L.black
    const s = started ? track(K_SCALE, tt) : 1
    const sp = track(K_SPREAD, tt)
    const vee = track(K_VEE, tt)
    const f = track(K_FLIP, tt)
    const roll = started ? track(K_ROLL, tt) : 0
    const yaw = started ? track(K_YAW, tt) : 0
    /* ── ท่าในปึก: ตำแหน่งตามแกนลึก (ระยะต่อใบ + ช่องกลาง) จัดกึ่งกลาง ── */
    let mean = 0
    for (let i = 0; i < C; i++) {
      const d = i - f
      zs[i] = sp * (d * DECK.pitch + DECK.gap * 0.5 * Math.tanh(2 * d)) * ICON_S + i * DECK.stack * ICON_S
      mean += zs[i]
    }
    /* ก่อนเริ่ม: ไอคอน (ใบแรก) ทาบไอคอนบนจอเครื่องพอดี — ไม่จัดกึ่งกลางปึก */
    mean = started ? mean / C : zs[0]
    _mA.compose(_v.set(0, 0, 0), _q.setFromEuler(_e.set(0, 0, roll)), _s1.set(s, s, s)).multiply(_mB.makeRotationY(yaw))
    /* ── ท่าในแถว: แถวทแยงลงขวาล่าง ต้นแถว (ไอคอน) ตรงกลางจอ ── */
    const hu = 2 * D0 * TAN
    const s0 = hu * SRC_K
    const srcX = -s0
    const origin = _p2.set(ROW_DIR.x * s0, ROW_DIR.y * s0, 0)
    const ox = origin.x
    const oy = origin.y
    /* ไหล: สะสมตามเวลาเฉพาะตอนคลี่ครบ (เลื่อนย้อนแล้วไม่กระโดด) + ตามการเลื่อนหลังคลี่ครบ */
    if (L.unf >= 0.999) flowAcc.current += Math.min(dt, 0.1) * FLOW
    const flow = flowAcc.current + Math.max(0, L.post - (UNF[0] + UNF[1])) * FLOW_SCROLL
    const x0 = srcX + ICON_S / 2 + COVER.gap + COVER.w / 2
    const wrap0 = x0 - PITCH
    /* วงยาวกว่าจำนวนปกหนึ่งช่อง — ช่องใต้ไอคอนว่าง (ใบสุดท้ายไม่วนกลับไปทับต้นแถวตอนคลี่เสร็จ) */
    const ring = (M + 1) * PITCH
    const k0x = ICON_S / COVER.w
    const k0y = ICON_S / COVER.h
    for (let i = 0; i < C; i++) {
      const c = cards.current[i]
      if (!c) continue
      c.visible = i === 0 || started
      if (!c.visible) continue
      const d = i - f
      /* V: กองขวา (ยังไม่พลิก) เอียง +δ · กองซ้าย −δ · ใบที่ช่องกลางพลิกจาก +δ ไป −δ ผ่าน 0 (= ก้อนหมุน −π/2 → เห็นแค่สัน) */
      const dv = DECK.vNear + (DECK.vFar - DECK.vNear) * Math.min(1, Math.max(0, (Math.abs(d) - 0.5) / 6))
      const side = Math.max(-1, Math.min(1, d * 2))
      _mC.compose(_v.set(0, 0, -(zs[i] - mean)), _q.setFromEuler(_e.set(0, dv * side * vee, 0)), _one)
      _mB.multiplyMatrices(_mA, _mC).decompose(_p1, _q1, _s1)
      /* ความคืบหน้าคลี่ของใบนี้ */
      const u = smooth(Math.min(1, Math.max(0, (L.unf - i * STAG) / (1 - (C - 1) * STAG))))
      const art = arts.current[i]
      const cov = covers.current[i]
      if (u <= 0.0005) {
        c.position.copy(_p1)
        c.quaternion.copy(_q1)
        c.scale.copy(_s1)
        if (art) art.visible = true
        if (cov) cov.visible = false
        continue
      }
      /* ตำแหน่งในแถว: ไอคอน = ต้นแถว · ปก = ช่องของมัน + ไหล (วนรอบ — ใบที่วนกลับโผล่จากใต้ไอคอน) */
      let x = srcX
      let y = 0
      let grow = 1
      if (i > 0) {
        const xf = x0 + (i - 1) * PITCH + flow
        x = wrap0 + ((((xf - wrap0) % ring) + ring) % ring)
        const aSrc = smooth((x - wrap0) / PITCH)
        grow = aSrc
        y = -0.35 * (1 - aSrc)
      }
      _p2.set(x, y, 0).applyQuaternion(Q_ISO).add(_v.set(ox, oy, 0))
      _q3.copy(Q_ISO).multiply(Q_LIE)
      /* ผสมท่า + โค้งเข้าหากล้องกลางทาง */
      c.position.lerpVectors(_p1, _p2, u)
      c.position.z += Math.sin(Math.PI * u) * 1.2
      c.quaternion.slerpQuaternions(_q1, _q3, u)
      const sc = _s1.x + (1 - _s1.x) * u
      c.scale.setScalar(sc)
      /* การ์ดสี → ปก: สลับตอนต้นทาง (ยังหันสัน) แล้วปกขยายจากขนาดการ์ดเป็นขนาดปก */
      if (i > 0 && art && cov) {
        const isCover = u >= SWAP
        art.visible = !isCover
        cov.visible = isCover
        if (isCover) {
          /* เริ่มเท่าการ์ด (สี่เหลี่ยมจัตุรัส) → ขนาดปก · ใบที่วนกลับใต้ไอคอนหดเท่าการ์ดอีกครั้ง */
          const mm = smooth((u - SWAP) / 0.6) * grow
          cov.scale.set(k0x + (1 - k0x) * mm, k0y + (1 - k0y) * mm, 1)
        }
      }
    }
  })

  return (
    <>
      <mesh ref={wall} geometry={res.face} material={res.wallMat} position={res.wallPos} scale={res.wallScale} renderOrder={-2} />
      {/* ใบแรก = ไอคอนแอป (ตัดมาจากไอคอนบนจอเครื่อง) — พลิกออกเป็นใบแรก แล้วลงไปนอนเป็นต้นแถวปก */}
      <group
        ref={(n) => {
          cards.current[0] = n
        }}
      >
        <mesh geometry={res.body} material={res.iconEdge} />
        <mesh geometry={res.face} material={res.iconMat} position={[0, 0, ICON_S * 0.011]} />
        <mesh geometry={res.face} material={res.iconMat} position={[0, 0, -ICON_S * 0.011]} rotation={[0, Math.PI, 0]} />
      </group>
      {WORKS.map((w, k) => {
        const i = k + 1
        const a = k % ARTS.length
        return (
          <group
            key={w.name}
            ref={(n) => {
              cards.current[i] = n
            }}
            visible={false}
          >
            <group
              ref={(n) => {
                arts.current[i] = n
              }}
            >
              <mesh geometry={res.body} material={res.edgeMats[a]} />
              <mesh geometry={res.face} material={res.artMats[a]} position={[0, 0, ICON_S * 0.011]} />
              <mesh geometry={res.face} material={res.artMats[a]} position={[0, 0, -ICON_S * 0.011]} rotation={[0, Math.PI, 0]} />
            </group>
            <group
              ref={(n) => {
                covers.current[i] = n
              }}
              visible={false}
            >
              <mesh geometry={res.coverBody} material={res.coverEdge} />
              <mesh geometry={res.coverFace} material={res.coverMats[k]} position={[0, 0, COVER.t / 2 + 0.004]} />
              <mesh geometry={res.coverFace} material={res.coverMats[k]} position={[0, 0, -COVER.t / 2 - 0.004]} rotation={[0, Math.PI, 0]} />
            </group>
          </group>
        )
      })}
    </>
  )
}

/** ปีของงานทั้งหมด (จากข้อความ sub ของ WORKS — ไม่ใช่ตัวเลขสมมติ) */
const YEARS = WORKS.flatMap((w) => (w.sub.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number))
const YEAR_SPAN = YEARS.length ? `${Math.min(...YEARS)}–${Math.max(...YEARS)}` : ''

/** วาดเฉพาะตอนแคนวาสนี้คุมภาพ · frameloop demand ต้องมีคนปลุกจากนอก useFrame */
function Pump({ on }: { on: React.RefObject<boolean> }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (on.current) invalidate()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [invalidate, on])
  return null
}

/**
 * วัดขนาดแคนวาสด้วย ResizeObserver อย่างเดียว ไม่ฟัง scroll และไม่ debounce
 * ค่าตั้งต้นของ r3f ใช้ handler ตัวเดียว (debounce 50ms) ทั้ง ResizeObserver และ scroll — แคนวาสนี้ mount กลางการเลื่อน
 * ถ้า scroll event มาต่อเนื่อง (Lenis / แทร็กแพดเหวี่ยง) การวัดถูกเลื่อนไปเรื่อย ๆ renderer ไม่ถูกสร้าง = จอขาว
 * แคนวาสเป็น fixed เต็มจอ การเลื่อนไม่เปลี่ยนขนาดอยู่แล้ว
 */
const MEASURE = { scroll: false, debounce: 0 }

export function RolodexStage({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLDivElement>(null)
  const live = useRef<Live>({ t: 0, black: false, unf: 0, post: 0 })
  const head = useRef<HTMLDivElement>(null)
  const words = useRef<(HTMLSpanElement | null)[]>([])
  const cutOn = useRef(false)
  /* mount แคนวาสเฉพาะช่วงเรื่องนี้ (ตั้งแต่จอเครื่องเป็นหน้าโฮม) — นอกช่วงคืน context */
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    let raf = 0
    let cur = false
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = wrap.current
      const f = frame.current
      if (!el || !f) return
      const ph = rolodexPhase(f.b)
      const vis = f.on && ph.home > 0.002
      if (vis !== cur) {
        cur = vis
        setMounted(vis)
      }
      el.style.visibility = vis ? 'visible' : 'hidden'
      el.style.opacity = Math.min(1, ph.home * 1.4).toFixed(3)
      live.current.t = ph.t
      live.current.black = ph.black
      live.current.unf = ph.unf
      live.current.post = ph.post
      /* หัวเรื่องซ้ายบน: คำไหลขึ้นจากใต้เส้นทีละคำ (หลังแถวปกเริ่มคลี่) · ออกพร้อมแถว */
      const h = head.current
      if (h) {
        const k = vis && ph.black ? Math.max(0, Math.min(1, (ph.unf - 0.35) / 0.65)) : 0
        h.style.visibility = k > 0.001 ? 'visible' : 'hidden'
        words.current.forEach((w, i) => {
          if (!w) return
          const e = smooth(Math.min(1, Math.max(0, k * 1.6 - i * 0.18)))
          w.style.transform = `translate3d(0, ${((1 - e) * 110).toFixed(1)}%, 0)`
        })
      }
      cutOn.current = vis && ph.cut
      if (cv.current) cv.current.style.visibility = cutOn.current ? 'visible' : 'hidden'
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame])
  return (
    <div ref={wrap} className="pointer-events-none absolute inset-0" style={{ visibility: 'hidden', opacity: 0, background: 'radial-gradient(120% 90% at 50% 40%, #ffffff 0%, #eef4fc 60%, #dbe7f8 100%)' }}>
      <div ref={cv} className="absolute inset-0" style={{ visibility: 'hidden' }}>
        {mounted && (
          <Canvas frameloop="demand" dpr={[1, 1.5]} resize={MEASURE} camera={{ fov: FOV, position: [0, 0, D0], near: 0.1, far: 200 }} gl={{ antialias: true, alpha: true }} style={{ position: 'absolute', inset: 0 }}>
            <Pump on={cutOn} />
            <Suspense fallback={null}>
              <Deck live={live} />
            </Suspense>
          </Canvas>
        )}
      </div>
      {/* Selected Projects — หัวเรื่องซ้ายบน (บนพื้นดำของฉากนี้) */}
      <div ref={head} className="absolute top-[13vh] left-[6vw] text-white" style={{ visibility: 'hidden', fontFamily: STORY_FONT }}>
        {['Selected', 'Projects'].map((w, i) => (
          <div key={w} className="overflow-hidden pb-[0.06em] text-[clamp(44px,7.2vw,124px)] leading-[0.95] font-bold tracking-[-0.02em]">
            <span
              ref={(n) => {
                words.current[i] = n
              }}
              className="inline-block will-change-transform"
              style={{ transform: 'translate3d(0, 110%, 0)' }}
            >
              {w}
            </span>
          </div>
        ))}
        <div className="mt-5 overflow-hidden text-[clamp(14px,1.1vw,18px)] text-white/60">
          <span
            ref={(n) => {
              words.current[2] = n
            }}
            className="inline-block will-change-transform"
            style={{ transform: 'translate3d(0, 110%, 0)' }}
          >
            {WORKS.length} projects{YEAR_SPAN ? ` · ${YEAR_SPAN}` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
