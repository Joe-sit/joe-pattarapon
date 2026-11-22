import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { DEVICE, FOV, ICON_OUT, STORY_FONT, TAN, smooth, worksPost, type WorkBeats } from './workMotion'
import { WORKS } from './WorksGallery'
import { DOLLY, HOME_ICON, ICON_PX, roadCut, roadPhase } from './roadWorld'
import { paintHome } from './RoadHome'

/**
 * ทางผ่านเข้า Selected Work แบบ "ไอคอนแอประเบิดเป็น rolodex" — ต่อท้ายบท Code (POST_CODE = 'rolodex' ใน ./workMotion)
 *
 * ต้นเรื่องเดียวกับเรื่องถนน (GIF ref — ./roadWorld): เครื่องชนคำ Code → จอเป็นหน้าโฮม → ดันเข้าไอคอนแอป (favicon)
 * ตัดมาแคนวาสนี้ตอนไอคอนกว้าง ICON_PX ของจอ (ท่าเดียวกันพอดี) แล้วเล่นตามคลิป ref (Ecommpay sting 0–1.73 วิ) เป๊ะ ๆ:
 *
 *   0.367  ตัดเฟรมเดียว (คลิปตัดเป็นพื้นดำ — ของเราคงพื้นสว่างไว้) · ใบหน้ายังเป็นไอคอนแอป (favicon) — ไอคอนคือใบแรกของปึก พลิกออกเป็นใบแรก
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
 *   UNF     Selected Work: การ์ดหลุดจากปึกลงช่องสไลเดอร์ (ใบกลางก่อน) กลายเป็นปกงานระหว่างทาง · สไลเดอร์เลื่อนทีละใบวนเอง
 *           ไอคอนแอปกลับลงจอเครื่องแล้วหล่นไปกับเครื่อง · คำใหญ่ของบทย่อเป็นหัวเรื่องซ้ายบน
 *   REFOLD  ปกบินกลับเข้าปึก (ทรง V เดิม) · CLOSE rolodex ปิดย้อนทางเดิมจนเหลือไอคอนหน้าตรง
 *   BACK_HOME ตัดกลับหน้าโฮม → ถอยออกเป็นเครื่อง (./roadWorld) — ต้องเสร็จก่อนหนังสติ๊กของบท Ship โผล่ (~worksPost 2.5)
 */
const P0 = 0.4
/* กางไวขึ้น (เดิม 0.75) — เผื่อระยะให้กำแพงค้างให้มองรอบก่อนเปิด */
const OPEN = [P0, 0.55] as const
const HOLD_T = 1.3
const UNF = [0.95, 0.34] as const
/** "เปิด" กำแพง (แบบ ref scroll to open): รูปพุ่งกระจายออกจากกลางจอ — ก่อนการ์ดบินกลับเข้าปึก (REFOLD) */
/* ท้ายช่วงซ้อนกับการ์ดเริ่มบินกลับ (REFOLD) — การ์ด 12 ใบกลับตัวเข้าปึกระหว่างที่ช่องซ้ำยังพุ่งออก ไม่มีช่วงฟ้าว่าง */
const WALL_OPEN = [1.56, 0.3] as const
const REFOLD = [1.78, 0.24] as const
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
  /* ช่วงฉากนี้คุมภาพ: ตั้งแต่เฟรมตัดของขาเปิด จนตัดกลับหน้าโฮม (หน้าโฮมข้างหลังไอคอนซ่อนในช่วงนี้) */
  const staged = post >= P0 + ((CUT_T - REF0) / (HOLD_T - REF0)) * OPEN[1] && post < BACK_HOME
  const open = smooth(at01(post, WALL_OPEN))
  return { post, home: rp.home, dolly: rp.dolly, cut: roadCut(rp), t, unf, staged, open }
}

/**
 * คำ "Selected" / "Work" ประกบไอคอน (WorkStory วาด)
 *   in   ลอยขึ้น + เบลอหาย ระหว่างฉาก Code หดเป็นไอคอน
 *   head ความคืบหน้าคลี่ลงกำแพง — คำจางหายตามนี้ (ไม่มีหัวเรื่องค้างบนกำแพง) · กลับมาตอนปึกหุบ
 *   out  ขยายนิด + จาง หลังตัดกลับหน้าโฮม (ท่าออกเดียวกับคำบทอื่น)
 */
/* ICON_OUT: คำเข้ามาประกบไอคอนระหว่างฉาก Code หดเป็นไอคอน (ช่วงกลางของ iconOut) */
const WORD_IN = ICON_OUT ? ([-0.14, 0.28] as const) : ([0.05, 0.32] as const)
const WORD_OUT = [2.2, 0.2] as const
/** ขนาดตัวคำใหญ่ — สองคำยาวกว่าคำบทอื่น ตัวเล็กลงให้กว้างเต็มจอเท่ากัน (k = ย่อ เช่นขนาดหัวเรื่อง) */
export const wordFont = (k = 1) => `clamp(${64 * k}px, ${13.5 * k}vw, ${250 * k}px)`
export function rolodexWord(b: { code: number; works: number }) {
  const post = worksPost(b)
  const unf = smooth(at01(post, UNF)) * (1 - smooth(at01(post, REFOLD)))
  return { in: smooth(at01(post, WORD_IN)), out: smooth(at01(post, WORD_OUT)), head: smooth(unf / 0.6) }
}

/**
 * ทางออกบท Code แบบ ethena (ICON_OUT) 0 → 1: ฉาก Code ทั้งจอหดเป็นไอคอนแอปกลางจอ — ช่วงเดียวกับการดันเข้าไอคอนของเดิม
 * (roadWorld DOLLY) จบ 1 ตรงเฟรมตัดเข้าแคนวาสนี้พอดี (ไอคอนกว้าง ICON_PX = การ์ดใบแรกของปึก)
 * ค้าง 1 ตลอดช่วงสำรับ · ตัดกลับหน้าโฮม (BACK_HOME) = 0 — เครื่องกลับมาพร้อมหน้าโฮม
 */
export function iconOut(b: { code: number; works: number }) {
  const post = worksPost(b)
  return !ICON_OUT || post >= BACK_HOME ? 0 : at01(post, DOLLY)
}
/**
 * พื้นขาวของบท Selected Work (แบบ ref ethena + baked — ไม่ใช่ฟ้าเมฆลายจุด) 0 → 1:
 * ขึ้นระหว่างฉาก Code หดเป็นไอคอน (นอกการ์ด) · ค้างทั้งปึก/กำแพง · ตัดกลับหน้าโฮม (BACK_HOME) แล้วจางคืนเป็นฟ้า (บท Ship)
 */
export function worksPaper(b: { code: number; works: number }) {
  if (!ICON_OUT) return 0
  const post = worksPost(b)
  if (post >= BACK_HOME) return 1 - smooth((post - BACK_HOME) / 0.1)
  /* ขึ้นตั้งแต่ต้นการหด — นอกการ์ดเป็นขาวเลย ไม่ค้างเป็นฟ้าระหว่างทาง (ref: มืด → ขาว) */
  return smooth(at01(post, DOLLY) / 0.16)
}
/** ความกว้างบนจอของปึก (× ความสูงจอ) — คำ "Selected" / "Work" ถ่างออกให้พ้นปึกตอนกาง */
export function rolodexSpan(b: { code: number; works: number }) {
  const t = rolodexPhase(b).t
  const s = t >= CUT_T ? track(K_SCALE, t) : 1
  return ICON_PX * (0.35 + 1.4 * s)
}

/** เครื่องหล่นลงพ้นจอตอนการ์ดคลี่เป็นสไลเดอร์ (สไลเดอร์กับหัวเรื่องได้ทั้งจอ) · กลับขึ้นมาตอนปกบินกลับเข้าปึก */
const dropOf = (unf: number) => smooth(unf / 0.45)
export const rolodexDrop = (b: { code: number; works: number }) => dropOf(rolodexPhase(b).unf)
/** ระยะหล่น (เท่าความสูงจอ) — เครื่อง (BubbleTraveler) กับไอคอนแอปบนจอเครื่อง (แคนวาสนี้) หล่นเท่ากัน */
export const DROP_K = 1.15

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

type Live = { t: number; staged: boolean; unf: number; post: number; open: number; paused: boolean; hover: number }

/*
 * ── Selected Work: กำแพงผลงานทรงกระบอก (ref: baked.design หน้าแรก) ──
 * มองจากในกระบอก (กล้องอยู่กลางแกน): คอลัมน์ริมจอเข้าหากล้อง ใหญ่ขึ้น ขอบด้านในของรูปเล็กกว่าด้านนอก
 * คอลัมน์แคบ (~15% ของจอ) เห็นราว 6 คอลัมน์ · สูงไม่เท่ากันตามสัดส่วน (WORKS ratio) · วนต่อกันไม่รู้จบตามแนวนอน
 * ลอยไปทางขวาเอง (กดหยุดได้) · ขยับเมาส์ = มองรอบ · เลื่อนต่อ = "เปิด": รูปพุ่งกระจายออกจากกลางจอเข้าหากล้อง
 * การ์ด rolodex 12 ใบคลี่ลงช่องกลาง · ช่องที่เหลือป๊อปขึ้นไล่จากกลางออกไป · รูปตอนนี้เป็นช่องว่าง (placeholder) รอรูปจริง
 */
const WALL = {
  /** คอลัมน์ในแถบที่วน (กว้างกว่ามุมกล้องมาก — รอยวนอยู่นอกจอ) · แถวต่อคอลัมน์ */
  cols: 14,
  rows: 6,
  /** ช่องว่างแนวนอน / แนวตั้ง (เท่าความกว้างคอลัมน์) */
  gap: 0.2,
  vgap: 0.08,
  /** ลอยเอง (เรเดียน/วินาที — บวก = ไปทางขวา) · มองรอบตามเมาส์ (เรเดียนสุดขอบจอ) · เลื่อนขึ้นลงตามเมาส์ (เท่าความสูงจอ) */
  drift: 0.022,
  look: 0.18,
  pan: 0.12,
}
/** ความกว้างคอลัมน์บนจอ (px) ที่แนวกลาง — จอนอน 15% ของความกว้างแบบ ref · จอตั้งกว้างขึ้น */
const colPx = (W: number, H: number) => (W < H ? W * 0.4 : W * 0.13)
type Tile = { col: number; y: number; h: number; work: number; hero: number; rank: number }
/**
 * ผังกำแพง (หน่วยความกว้างคอลัมน์ · คอลัมน์ c = −7..6 · 0 = กลางจอตอนคลี่): สูง = 1/ratio · คอลัมน์เหลื่อมขึ้นลงไม่เท่ากัน
 * ช่องกลาง 4 × 3 (คอลัมน์ −2..1 · แถว 1..3) = ปลายทางของการ์ด rolodex (hero = ดัชนีงาน) · ที่เหลือวนงานสลับไม่ให้ซ้ำชิดกัน
 */
const TILES: Tile[] = (() => {
  const out: Tile[] = []
  const M0 = WORKS.length
  for (let c = -WALL.cols / 2; c < WALL.cols / 2; c++) {
    const j = c + WALL.cols / 2
    const col: Tile[] = []
    for (let r = 0; r < WALL.rows; r++) {
      const hi = c >= -2 && c <= 1 && r >= 1 && r <= 3 ? (c + 2) * 3 + (r - 1) : -1
      const hero = hi >= 0 && hi < M0 ? hi : -1
      const work = hero >= 0 ? hero : (j * 5 + r * 7 + 3) % M0
      col.push({ col: c, y: 0, h: 1 / WORKS[work].ratio, work, hero, rank: 0 })
    }
    const total = col.reduce((a, t) => a + t.h, 0) + WALL.vgap * (WALL.rows - 1)
    const off = (((j * 0.618) % 1) - 0.5) * 0.8
    let cum = 0
    for (const t of col) {
      t.y = total / 2 - (cum + t.h / 2) + off
      cum += t.h + WALL.vgap
      t.rank = Math.abs(c + 0.5) + Math.abs(t.y) / 1.4
      out.push(t)
    }
  }
  return out
})()
const HERO_TILE = WORKS.map((_, k) => TILES.find((t) => t.hero === k) as Tile)
const HERO_IDX = WORKS.map((_, k) => TILES.findIndex((t) => t.hero === k))
/** ช่องรูปมุมมน (แคนวาสขนาดตายตัวตามสัดส่วน) — ตอนนี้ไม่มีรูป = ช่องว่างสีอ่อน (placeholder) · ส่งรูปมา = วาดครอปเต็มช่อง */
const TILE_W = 512
function paintTile(cv: HTMLCanvasElement, img: HTMLImageElement | null) {
  const g = cv.getContext('2d')
  if (!g) return
  const w = cv.width
  const h = cv.height
  g.clearRect(0, 0, w, h)
  g.save()
  g.beginPath()
  g.roundRect(0, 0, w, h, w * 0.022)
  g.clip()
  g.fillStyle = '#ededed'
  g.fillRect(0, 0, w, h)
  if (img && img.naturalWidth) {
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    g.drawImage(img, (w - img.naturalWidth * k) / 2, (h - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k)
  }
  g.restore()
}

/** การ์ดทั้งปึก: 0 = ไอคอนแอป · 1..M = การ์ดสี (ลายวนชุด ARTS) ผูกกับการ์ดงาน WORKS[i − 1] */
const M = WORKS.length
const C = M + 1
/** สลับลายการ์ด → การ์ดงาน ตอนยังหันสันอยู่ (ต้นทางคลี่) — ทั้งคู่จัตุรัสเท่ากัน ไม่ต้องยืดขนาด */
const SWAP = 0.12
const AX_Y = new THREE.Vector3(0, 1, 0)
const _qT = new THREE.Quaternion()
const _mT = new THREE.Matrix4()
const _sT = new THREE.Vector3()
/** ช่องที่ชี้อยู่ขยายกี่เท่า (บวกจาก 1) */
const HOVER_K = 0.08
/** มุมช่องที่ฉายลงจอ (hover) */
const _hp = [new THREE.Vector3(), new THREE.Vector3()]
const _q = new THREE.Quaternion()
const _v = new THREE.Vector3()
const _p1 = new THREE.Vector3()
const _p2 = new THREE.Vector3()
const _s1 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _mA = new THREE.Matrix4()
const _mB = new THREE.Matrix4()
const _mC = new THREE.Matrix4()
const _one = new THREE.Vector3(1, 1, 1)
const _e = new THREE.Euler()

/**
 * ปึก rolodex + สไลเดอร์ Selected Work ในชุดเดียว — การ์ดแต่ละใบมีสองท่า: ในปึก (คีย์จากคลิป) กับในช่องสไลเดอร์
 * ผสมกันตามความคืบหน้าคลี่ของใบนั้น (u) → ปกงานคลี่ออกมาจาก rolodex จริง ๆ ไม่ใช่งอกใหม่
 */
function Deck({ live }: { live: React.RefObject<Live> }) {
  const icon = useTexture('/favicon-512.png')
  const cards = useRef<(THREE.Group | null)[]>([])
  const arts = useRef<(THREE.Group | null)[]>([])
  const covers = useRef<(THREE.Group | null)[]>([])
  const coverFace = useRef<(THREE.Group | null)[]>([])
  const fills = useRef<(THREE.InstancedMesh | null)[]>([])
  const wall = useRef<THREE.Mesh>(null)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  /* มุมหมุนเองของกำแพง (เดินเฉพาะตอนคลี่ครบ) · ตำแหน่งเมาส์ −1..1 (ดิบ / หน่วงแล้ว) */
  const rot = useRef(0)
  /* hover: ช่องที่ชี้อยู่ (ดัชนีใน TILES) · ความขยายของแต่ละช่อง 0..1 (หน่วงเข้า/ออก) */
  const hoverTile = useRef(-1)
  const hovK = useMemo(() => new Float32Array(TILES.length), [])
  const look = useRef({ x: 0, y: 0 })
  const lookS = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const mv = (e: PointerEvent) => {
      look.current.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1
      look.current.y = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1
    }
    window.addEventListener('pointermove', mv, { passive: true })
    return () => window.removeEventListener('pointermove', mv)
  }, [])

  const res = useMemo(() => {
    icon.colorSpace = THREE.SRGBColorSpace
    icon.anisotropy = 4
    /* ตัวการ์ดบาง (สันเห็นเป็นเส้นตอนหันข้าง) + หน้าลายทั้งสองด้าน */
    const body = new THREE.ExtrudeGeometry(rr(ICON_S * 0.985, ICON_S * 0.985, ICON_S * 0.22), { depth: ICON_S * 0.02, bevelEnabled: false, curveSegments: 12 })
    body.translate(0, 0, -ICON_S * 0.01)
    const face = new THREE.PlaneGeometry(ICON_S, ICON_S)
    const unit = new THREE.PlaneGeometry(1, 1)
    const artTex = ARTS.map((a) => {
      const tx = new THREE.CanvasTexture(paintArt(a))
      tx.colorSpace = THREE.SRGBColorSpace
      tx.anisotropy = 4
      return tx
    })
    /* ช่องรูป: ใบละหนึ่ง texture ตามสัดส่วนของงาน ใช้ร่วมทั้งการ์ดที่คลี่ลงกำแพงและช่องซ้ำ — ตอนนี้ว่าง (placeholder) */
    const tileTex = WORKS.map((w) => {
      const cv = document.createElement('canvas')
      cv.width = TILE_W
      cv.height = Math.round(TILE_W / w.ratio)
      paintTile(cv, null)
      const t = new THREE.CanvasTexture(cv)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      return t
    })
    /* ช่องซ้ำของแต่ละงาน (ดัชนีใน TILES) — วาดเป็น instance ชุดละงาน */
    const fillOf = WORKS.map((_, k) => TILES.flatMap((t, n) => (t.hero < 0 && t.work === k ? [n] : [])))
    const fillAlpha = fillOf.map((list) => new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, list.length)), 1))
    const wallTex = paintHome()
    /* หน้าโฮมข้างหลังไอคอน: ขนาด/ตำแหน่งตามจอเครื่อง (ไอคอนบนจอ = ไอคอนนี้) */
    const u = ICON_S / HOME_ICON.s
    return {
      body,
      face,
      unit,
      artTex,
      artMats: artTex.map(flat),
      edgeMats: ARTS.map((a) => new THREE.MeshBasicMaterial({ color: a.edge, toneMapped: false })),
      iconMat: flat(icon),
      iconEdge: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      tileTex,
      /* มุมมนโปร่ง — ตัดทิ้ง (alphaTest) ไม่งั้นวาดเป็นมุมดำ */
      tileMats: tileTex.map((t) => new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, toneMapped: false })),
      /*
       * ช่องซ้ำจางเข้า (แบบ ref — ความทึบรายช่อง): instance attribute aAlpha คูณ alpha ของรูป · โปร่งใสจริง (ไม่ใช้ alphaTest ตัดทิ้ง)
       */
      fillMats: tileTex.map((t) => {
        const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false })
        m.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;')
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlpha;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vAlpha;')
        }
        return m
      }),
      fillAlpha,
      /* geometry ของแต่ละชุด instance (แผ่นเดียวกัน + aAlpha ของชุดนั้น) */
      fillGeo: fillAlpha.map((a) => {
        const g = unit.clone()
        g.setAttribute('aAlpha', a)
        return g
      }),
      fillOf,
      wallTex,
      wallMat: new THREE.MeshBasicMaterial({ map: wallTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
      wallScale: [(DEVICE.hw * 2 * u) / ICON_S, (DEVICE.hh * 2 * u) / ICON_S, 1] as [number, number, number],
      wallPos: [-HOME_ICON.x * u, -HOME_ICON.y * u, -0.6] as [number, number, number],
    }
  }, [icon])
  useEffect(
    () => () => {
      ;[res.body, res.face, res.unit, ...res.fillGeo].forEach((g) => g.dispose())
      ;[...res.artMats, ...res.edgeMats, res.iconMat, res.iconEdge, ...res.tileMats, ...res.fillMats, res.wallMat].forEach((m) => m.dispose())
      ;[...res.artTex, ...res.tileTex, res.wallTex].forEach((x) => x.dispose())
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
    /*
     * พื้น: ไม่ตัดเป็นดำ (ต่างจากคลิป) — ฟ้าของบทอื่นต่อมาเลย (แคนวาสโปร่ง)
     * ICON_OUT: ขาเข้าไม่มีหน้าโฮม (ฉาก Code หดเป็นไอคอนเอง) — หน้าโฮมมีแค่ขาออก (ตัดกลับ BACK_HOME)
     */
    scene.background = null
    const wallK = ICON_OUT && L.post < BACK_HOME ? 0 : L.staged ? 1 - smooth((tt - CUT_T) / 0.1) : 1
    res.wallMat.opacity = wallK
    if (wall.current) wall.current.visible = wallK > 0.001
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

    /* ── กำแพง (หน่วยโลกที่ระนาบ z = 0 ห่างกล้อง D0 — คอลัมน์หน้าสุดแตะระนาบนี้พอดี px ↔ หน่วยเป๊ะ) ── */
    const hu = 2 * D0 * TAN
    const u2w = hu / size.height
    const cw = colPx(size.width, size.height) * u2w
    /*
     * แกนกระบอกอยู่หน้ากล้อง (รัศมี 0.45 ของระยะกล้อง — คอลัมน์ริมจอใหญ่ราว 1.3 เท่าแบบ ref — มองจากในกระบอกแต่ถอยหลังแกนนิด): คอลัมน์ริมจอโค้งเข้าหากล้อง
     * ใหญ่ขึ้นและเอียงเป็นคางหมูชัดแบบ ref · คอลัมน์กลางแตะระนาบ z = 0 พอดี
     */
    const R = D0 * 0.45
    const dA = (cw * (1 + WALL.gap)) / R
    const band = dA * WALL.cols
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 3)
    lookS.current.x += (look.current.x - lookS.current.x) * k
    lookS.current.y += (look.current.y - lookS.current.y) * k
    if (L.unf >= 0.999 && L.open <= 0 && !L.paused) rot.current += Math.min(dt, 0.1) * WALL.drift
    /* เมาส์ไปขวา = มองไปทางขวา → กำแพงเลื่อนไปซ้าย (แบบ ref) · เมาส์ลง = มองลง → กำแพงเลื่อนขึ้น */
    const phi = rot.current - lookS.current.x * WALL.look * L.unf
    const panY = lookS.current.y * WALL.pan * hu * L.unf
    /*
     * ท่าของช่อง: บนผิวในของกระบอก หันเข้าหากล้อง · วนในแถบ ±band/2 (รอยวนอยู่นอกมุมกล้อง)
     * เปิด (o 0 → 1): มุม/ความสูงถ่างออกจากกลางจอ + เข้าใกล้กล้อง (ใหญ่ขึ้น) — ใบใกล้กลางออกก่อน · คืนค่า cos มุม (≤ 0 = พ้นด้านข้าง)
     */
    const tilePose = (t: Tile, out: THREE.Vector3, q: THREE.Quaternion, pushK = 1) => {
      const th0 = t.col * dA + phi
      const th = th0 - band * Math.floor((th0 + band / 2) / band)
      const yc = t.y + panY / cw
      /* เปิด: ดันออกตามทิศจากกลางจอ (หน่วยคอลัมน์ — ใบกลางพอดีก็มีทิศ: เอียงตามคอลัมน์/ขึ้น) แรงขึ้นเรื่อย ๆ + เข้าหาแกน (ใหญ่ขึ้น) */
      const nd = Math.min(1, t.rank / 4)
      /* ใบกลางออกก่อน ใบริมตามมา · ทุกใบถึงสุดทางพร้อมกันที่ท้ายช่วง (พ้นจอพอดี — ไม่มีช่วงฟ้าว่าง) */
      const o = smooth(Math.min(1, Math.max(0, (L.open - 0.25 * nd) / 0.75)))
      const dx = th / dA + (t.col + 0.5 >= 0 ? 0.3 : -0.3)
      const dy = yc + 0.25
      const len = Math.hypot(dx, dy)
      const push = Math.pow(o, 1.6) * 5 * pushK
      const thO = th + (dx / len) * push * dA
      const r = R * (1 - 0.4 * o)
      out.set(r * Math.sin(thO), (yc + (dy / len) * push) * cw, R - r * Math.cos(thO))
      q.setFromAxisAngle(AX_Y, -thO)
      return Math.cos(thO)
    }
    const span = 3.4 * 0.06
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
      /* คลี่ลงกำแพง: ช่องใกล้กลางก่อน · ไอคอนแอปหดหายกลางกำแพง (กลับมาตอนปึกหุบ) */
      const tile = i > 0 ? HERO_TILE[i - 1] : null
      const delay = tile ? Math.min(tile.rank, 3.4) * 0.06 : 0
      const u = smooth(Math.min(1, Math.max(0, (L.unf - delay) / (1 - span))))
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
      if (!tile) {
        c.position.lerpVectors(_p1, _v.set(0, 0, 0), u)
        c.quaternion.copy(_q1)
        c.scale.setScalar(_s1.x * (1 - u))
        c.visible = u < 0.999
        continue
      }
      /* การ์ดหลักพุ่งออกน้อยกว่าช่องซ้ำ (แค่พ้นจอ) — ตอนพับกลับโผล่กลับเข้าจอเร็ว ไม่มีช่วงฟ้าว่าง */
      const front = tilePose(tile, _p2, _qT, 0.62)
      /* ช่องที่ชี้: ขยาย + ขยับเข้าหากล้องนิด (ไม่ซ้อนทับช่องข้าง ๆ) */
      const hv = hovK[HERO_IDX[i - 1]] * u
      _p2.add(_v.set(0, 0, 1).applyQuaternion(_qT).multiplyScalar(hv * cw * 0.12))
      /* ผสมท่า + โค้งเข้าหากล้องกลางทาง */
      /* ไม่โค้งเข้าหากล้อง — การ์ดจากปึก (ใหญ่) ลงช่องเล็กบนกำแพง ถ้าโค้งเข้ามาจะเป็นแผ่นใหญ่บังจอกลางทาง */
      c.position.lerpVectors(_p1, _p2, u)
      c.quaternion.slerpQuaternions(_q1, _qT, u)
      c.scale.setScalar((_s1.x + (cw / ICON_S - _s1.x) * u) * (1 + HOVER_K * hv))
      /* พ้นด้านข้างกล้องแล้ว (ตอนเปิด) = ซ่อน (หลังคลี่ครบเท่านั้น — ระหว่างบินต้องเห็นทั้งทาง) */
      c.visible = !(u >= 0.999 && front < 0.05)
      /* การ์ดสี → รูปปก: สลับตอนต้นทาง (ยังหันสัน) แล้วยืดจากจัตุรัสเป็นสัดส่วนภาพ */
      if (art && cov) {
        const isTile = u >= SWAP
        art.visible = !isTile
        cov.visible = isTile
        const fc = coverFace.current[i]
        if (isTile && fc) fc.scale.y = 1 + (tile.h - 1) * smooth((u - SWAP) / 0.6)
      }
    }
    /*
     * ── hover (แบบ ref): ช่องใต้เมาส์ = งานของช่องนั้น → ป้ายชื่อตามเคอร์เซอร์ (DOM ใน RolodexStage)
     *    หาเองจากผังกำแพง: ฉายมุมสี่มุมของช่องลงจอแล้วเช็กจุดอยู่ในสี่เหลี่ยม — แคนวาสนี้ไม่รับเมาส์ (ทั้งชั้นไม่บังคลิกของหน้า)
     */
    L.hover = -1
    if (L.unf >= 0.98 && L.open <= 0.001) {
      const mx = look.current.x
      const my = -look.current.y
      const pt = _hp
      for (let n = 0; n < TILES.length && L.hover < 0; n++) {
        const t = TILES[n]
        if (tilePose(t, _p2, _qT) <= 0.05) continue
        const hw = cw / 2
        const hh = (cw * t.h) / 2
        let inside = true
        let sign = 0
        for (let c = 0; c < 4 && inside; c++) {
          const ax = c === 0 || c === 3 ? -hw : hw
          const ay = c < 2 ? hh : -hh
          const bx = c === 0 || c === 1 ? hw : -hw
          const by = c === 0 ? hh : c === 3 ? hh : -hh
          pt[0].set(ax, ay, 0).applyQuaternion(_qT).add(_p2).project(camera)
          pt[1].set(bx, by, 0).applyQuaternion(_qT).add(_p2).project(camera)
          const cr = (pt[1].x - pt[0].x) * (my - pt[0].y) - (pt[1].y - pt[0].y) * (mx - pt[0].x)
          if (sign === 0) sign = Math.sign(cr)
          else if (Math.sign(cr) !== sign) inside = false
        }
        if (inside && sign !== 0) {
          L.hover = t.work
          hoverTile.current = n
        }
      }
    }
    if (L.hover < 0) hoverTile.current = -1
    /* ช่องที่ชี้ขยายขึ้นนุ่ม ๆ (หดกลับเมื่อเลื่อนออก) */
    const hk = 1 - Math.exp(-Math.min(dt, 0.1) * 12)
    for (let n = 0; n < TILES.length; n++) hovK[n] += ((n === hoverTile.current ? 1 : 0) - hovK[n]) * hk
    /*
     * ── ช่องซ้ำ: จางเข้า (แบบท่าโผล่ของ ref) ไล่จากกลางจอออกไปขอบ ขยายนิดตอนเข้า หลังการ์ดเริ่มลงกำแพง ──
     * ตั้งแต่เริ่มเปิด ค้างเต็มแล้วพุ่งออกไปกับท่าเปิด (ไม่จางหายตอนการ์ดเริ่มพับกลับ)
     */
    res.fillOf.forEach((list, w) => {
      const im = fills.current[w]
      if (!im) return
      const al = res.fillAlpha[w]
      list.forEach((n, slot) => {
        const t = TILES[n]
        const a = L.open > 0.001 ? 1 : smooth(Math.min(1, Math.max(0, (L.unf - 0.22 - Math.min(t.rank, 6) * 0.075) / 0.3)))
        const front = tilePose(t, _p2, _qT)
        if (hovK[n] > 0.001) _p2.add(_v.set(0, 0, 1).applyQuaternion(_qT).multiplyScalar(hovK[n] * cw * 0.12))
        const sc = front > 0.05 && a > 0.001 ? (0.93 + 0.07 * a) * (1 + HOVER_K * hovK[n]) : 0
        _mT.compose(_p2, _qT, _sT.set(cw * sc + 1e-5, cw * t.h * sc + 1e-5, 1))
        im.setMatrixAt(slot, _mT)
        al.setX(slot, a)
      })
      im.instanceMatrix.needsUpdate = true
      al.needsUpdate = true
      im.visible = L.unf > 0.22 || (L.open > 0.001 && L.open < 0.999)
    })
  })

  return (
    <>
      <mesh ref={wall} geometry={res.face} material={res.wallMat} position={res.wallPos} scale={res.wallScale} renderOrder={-2} />
      {/* ใบแรก = ไอคอนแอป (ฉาก Code หดลงมาเป็นใบนี้) — พลิกออกเป็นใบแรก แล้วหดหายกลางกำแพง */}
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
              {/* รูปปก (กว้างเท่าการ์ด · สูงยืดตามสัดส่วนภาพ) สองด้าน — ด้านหลังเห็นตอนพลิกกลางทาง */}
              <group
                ref={(n) => {
                  coverFace.current[i] = n
                }}
              >
                <mesh geometry={res.face} material={res.tileMats[k]} />
                <mesh geometry={res.face} material={res.tileMats[k]} rotation={[0, Math.PI, 0]} />
              </group>
            </group>
          </group>
        )
      })}
      {res.fillOf.map((list, k) =>
        list.length ? (
          <instancedMesh
            key={k}
            ref={(n) => {
              fills.current[k] = n
            }}
            args={[res.fillGeo[k], res.fillMats[k], list.length]}
            frustumCulled={false}
            visible={false}
          />
        ) : null,
      )}
    </>
  )
}


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
  const live = useRef<Live>({ t: 0, staged: false, unf: 0, post: 0, open: 0, paused: false, hover: -1 })
  /* ปุ่มหยุดการลอยของกำแพง (แบบ ref "Pause motion") */
  const [paused, setPaused] = useState(false)
  const pauseBtn = useRef<HTMLButtonElement>(null)
  /* ป้ายบอกวิธีใช้กำแพง (แบบ ref "Move to look around") — เฉพาะอุปกรณ์ที่มีเมาส์ */
  const hint = useRef<HTMLDivElement>(null)
  /* ป้ายชื่องานตามเคอร์เซอร์ตอนชี้ช่องบนกำแพง (แบบ ref) */
  const tip = useRef<HTMLDivElement>(null)
  const tipText = useRef<HTMLSpanElement>(null)
  const tipAt = useRef({ x: 0, y: 0, cur: -1, w: 0 })


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
      live.current.staged = ph.staged
      live.current.unf = ph.unf
      live.current.post = ph.post
      live.current.open = ph.open
      /* ป้ายวิธีใช้ + ปุ่มหยุด: ขึ้นหลังกำแพงคลี่เกือบครบ · หายตอนเริ่มเปิดกำแพง */
      const kUi = vis && ph.staged ? Math.max(0, Math.min(1, (ph.unf - 0.7) / 0.3)) * (1 - smooth(ph.open / 0.25)) : 0
      const hn = hint.current
      if (hn) {
        const k = window.matchMedia('(pointer: fine)').matches ? kUi : 0
        hn.style.visibility = k > 0.001 ? 'visible' : 'hidden'
        hn.style.opacity = k.toFixed(3)
        hn.style.transform = `translate(-50%, ${((1 - k) * 12).toFixed(1)}px)`
      }
      const tp = tip.current
      if (tp) {
        const hv = vis && ph.staged ? live.current.hover : -1
        if (hv !== tipAt.current.cur) {
          tipAt.current.cur = hv
          if (hv >= 0 && tipText.current) {
            tipText.current.textContent = WORKS[hv].name
            tipAt.current.w = tp.offsetWidth
          }
        }
        /* ขวาของเคอร์เซอร์ · ที่ไม่พอ (ริมจอขวา) พลิกไปซ้าย */
        const ta = tipAt.current
        const tx = ta.x + 14 + ta.w > window.innerWidth - 8 ? ta.x - 14 - ta.w : ta.x + 14
        tp.style.opacity = hv >= 0 ? '1' : '0'
        tp.style.transform = `translate3d(${tx.toFixed(1)}px, ${(ta.y + 18).toFixed(1)}px, 0) scale(${hv >= 0 ? 1 : 0.9})`
      }
      const pb = pauseBtn.current
      if (pb) {
        pb.style.visibility = kUi > 0.001 ? 'visible' : 'hidden'
        pb.style.opacity = kUi.toFixed(3)
      }
      cutOn.current = vis && ph.cut
      if (cv.current) cv.current.style.visibility = cutOn.current ? 'visible' : 'hidden'
    }
    const mv = (e: PointerEvent) => {
      tipAt.current.x = e.clientX
      tipAt.current.y = e.clientY
    }
    window.addEventListener('pointermove', mv, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', mv)
    }
  }, [frame])
  return (
    /* โปร่ง — ฟ้า/คำใหญ่ของบทอยู่ข้างใต้ (WorkStory) เหมือนบท Research / Design / Code */
    <div ref={wrap} className="pointer-events-none absolute inset-0" style={{ visibility: 'hidden', opacity: 0 }}>
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
      <div
        ref={hint}
        className="absolute bottom-[clamp(20px,4vh,40px)] left-1/2 rounded-full bg-white/85 px-4 py-2 text-[13px] font-medium text-[#1d2433] shadow-[0_8px_24px_rgba(10,30,80,0.18)] backdrop-blur"
        style={{ visibility: 'hidden', fontFamily: STORY_FONT }}
      >
        Move to look around, scroll to open
      </div>
      {/* ชั้นนี้ยกตามชั้นหลัก (translate) — ป้ายใช้ fixed ตามพิกัดเคอร์เซอร์บนจอ */}
      <div
        ref={tip}
        className="fixed top-0 left-0 z-10 rounded-full bg-[#111] px-3 py-1.5 text-[13px] leading-none font-medium whitespace-nowrap text-white transition-[opacity,scale] duration-150"
        style={{ opacity: 0, fontFamily: STORY_FONT }}
        aria-hidden
      >
        <span ref={tipText} />
      </div>
      <button
        ref={pauseBtn}
        type="button"
        onClick={() => {
          live.current.paused = !live.current.paused
          setPaused(live.current.paused)
        }}
        className="pointer-events-auto absolute bottom-[clamp(20px,4vh,40px)] left-[clamp(16px,2vw,32px)] flex cursor-pointer items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-[13px] font-medium text-[#1d2433] shadow-[0_8px_24px_rgba(10,30,80,0.18)] backdrop-blur"
        style={{ visibility: 'hidden', fontFamily: STORY_FONT }}
      >
        {paused ? (
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
            <path d="M1 1.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L1.9.7a.6.6 0 0 0-.9.5Z" fill="currentColor" />
          </svg>
        ) : (
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
            <rect x="1" y="1" width="2.6" height="10" rx="0.8" fill="currentColor" />
            <rect x="6.4" y="1" width="2.6" height="10" rx="0.8" fill="currentColor" />
          </svg>
        )}
        {paused ? 'Play motion' : 'Pause motion'}
      </button>
    </div>
  )
}
