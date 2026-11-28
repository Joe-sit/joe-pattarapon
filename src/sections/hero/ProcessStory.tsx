import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { cursorRoot, cursorTip, cursorWake } from '@/cursorguide/morph'

/**
 * What I do — กระบวนการทำงานเล่าเป็นโลก 3D มินิมอล (ภาพอ้างอิง: แผงการ์ดขาวเรียงเป็นกริดบนพื้นฟ้าอ่อน
 * ร่องระหว่างแผง ไทล์น้ำเงินหนามีแผ่นโปร่งซ้อนใต้ เส้นจุดเป็นไกด์ เคอร์เซอร์ขาวกำลังทำงาน)
 *
 * เคอร์เซอร์แก้วที่โผล่ออกจากฟองแชตเป็นตัวนำ ทำทุกอย่างเอง เล่าทีละขั้นต่อเนื่อง กล้องไม่เคยนิ่ง:
 *   เปิด — คลิก แผ่นงาน (artboard) ขาวขยายจากจุดคลิกจนเต็มจอ · กล้องหน้าตรง (ภาพแบน เหมือนจอเครื่องมือออกแบบ)
 *   01 Research — การ์ดข้อมูลหลากสีกระจาย ลากกรอบครอบทั้งหมด การ์ดเรียงเข้ากลุ่มตามสี (affinity) แล้วหลอม
 *      รวมเป็นไทล์น้ำเงินลูกเดียว = โจทย์ที่ชัด
 *   02 UX/UI Design — ลากไทล์ลงผัง เส้นไกด์จุดยืดตามร่อง ลากวาดแผงหลัก แผงอื่นเติมตามกริด ใส่ wireframe
 *      วางคอมโพเนนต์ คลิกเลือกไทล์ · กล้องเอียงจากหน้าตรงลงเป็นไอโซเมตริก ไทล์ยกตัวมีแผ่นซ้อนใต้
 *   03 Build — แผงข้างกลายเป็นโค้ดพิมพ์ทีละบรรทัด เส้นจุดวิ่งออกไปประกอบคอมโพเนนต์ (ไทล์ซ้อนชั้น)
 *      กราฟขึ้น · ถอยกล้องเห็นทั้งผลิตภัณฑ์ เคอร์เซอร์จบบนไทล์ใหญ่มีไกด์จุดล้อม
 *
 * พิกัดเวที: พื้นคือระนาบ xz (y ขึ้น) · หน้าตรง = มองตั้งฉากลงพื้น จอขึ้น = −z · กล้องออร์โธ = หมุน/สเกล/เลื่อนเวทีแทน
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => {
  const u = clamp01(v)
  return u * u * (3 - 2 * u)
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const inOut = (v: number) => {
  const u = clamp01(v)
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2
}
const outQuint = (v: number) => 1 - (1 - clamp01(v)) ** 5
/** เลยเป้านิดแล้วกลับ — ของที่เด้งเกิด */
const backOut = (v: number) => {
  const u = clamp01(v) - 1
  return 1 + 2.4 * u * u * u + 1.4 * u * u
}
const seg = (v: number, a: number, b: number) => clamp01((v - a) / (b - a))
const AX = new THREE.Vector3(1, 0, 0)
const AY = new THREE.Vector3(0, 1, 0)
const AZ = new THREE.Vector3(0, 0, 1)
const D2R = Math.PI / 180

/* ------------------------------------------------------------------ สะพานฟอง ↔ เคอร์เซอร์ ↔ ลูกศรของหน้า */

/**
 * ฟองแชตเฟรมนี้ (พิกัดโลก px) — BubbleTraveler เขียนทุกเฟรม: กลาง · ครึ่งกว้าง/สูง · ปลายข้อความ
 * เคอร์เซอร์อาศัยอยู่ในฟอง แล้วมุดทะลุขอบขวาออกมาตอนพิมพ์ "Here is what I do" จบ
 */
export const BUBBLE = { ok: false, x: 0, y: 0, hw: 0, hh: 0, ex: 0, ey: 0 }
/** ปลายเคอร์เซอร์แก้วเฟรมล่าสุด (px บนจอ y ลง) — จุดที่ลูกศรของหน้ากลับมาเกิดตอนส่งไม้คืน */
export const GLASS = { ok: false, x: 0, y: 0 }
/**
 * จุดจอดล่องหนของลูกศรของหน้า (BubbleTraveler ผูก span ไว้) — วางทุกเฟรมที่วาด ไม่รอ event เลื่อน
 * ลบระยะ (ปลาย − กำเนิด) ของลูกศรออก ให้ *ปลาย* มันลงตรงจุด ไม่ใช่จุดกำเนิดของโมเดล
 */
export const CURSOR_SPOT: { glass: HTMLElement | null } = { glass: null }
export function placeSpot(el: HTMLElement | null, x: number, y: number) {
  if (!el) return
  const ox = cursorTip.ok ? cursorTip.x - cursorRoot.x : 0
  const oy = cursorTip.ok ? cursorTip.y - cursorRoot.y : 0
  const t = `translate(${(x - ox).toFixed(1)}px, ${(y - oy).toFixed(1)}px)`
  if (el.style.transform === t) return
  el.style.transform = t
  /* ชั้นลูกศรวาดตามสั่ง — จุดจอดย้ายแล้วต้องปลุกให้อ่านตำแหน่งใหม่ */
  cursorWake.fn()
}

/** ทุกช่วงวิ่ง 0..1 ต่อกัน · exit = เคอร์เซอร์แก้วกลับเป็นลูกศรของหน้า ตอนเลื่อนพ้นท่าจบ */
export type ProcessPose = {
  on: boolean
  bar: number
  frame: number
  research: number
  design: number
  build: number
  lift: number
  exit: number
}
const storyT = (p: ProcessPose) => p.bar + p.frame + p.research + p.design + p.build

/* ------------------------------------------------------------------ ผัง (หน่วยเวที) */

/** ผังหน้าจอปลายทาง: แถบบน · แผงหลัก · แผงข้างสูง · การ์ดสองใบ — ร่องกว้าง G (เห็นพื้นลอดเป็นทาง) */
const G = 18
const COLW = (760 - 2 * G) / 3
type Rect = { x0: number; z0: number; w: number; l: number }
const PANELS: Rect[] = [
  { x0: -380, z0: -232, w: 760, l: 56 },
  { x0: -380, z0: -158, w: 2 * COLW + G, l: 196 },
  { x0: -380 + 2 * (COLW + G), z0: -158, w: COLW, l: 196 + G + 176 },
  { x0: -380, z0: 56, w: COLW, l: 176 },
  { x0: -380 + COLW + G, z0: 56, w: COLW, l: 176 },
]
const [HEAD, HERO, SIDE, CARD_A, CARD_B] = PANELS
/** เส้นไกด์ตามร่อง (กลางร่อง): แนวตั้งสองเส้น · แนวนอนสองเส้น */
const GUIDES: [number, number, number, number][] = [
  [-380 + COLW + G / 2, -268, -380 + COLW + G / 2, 268],
  [-380 + 2 * COLW + 1.5 * G, -268, -380 + 2 * COLW + 1.5 * G, 268],
  [-420, -232 + 56 + G / 2, 420, -232 + 56 + G / 2],
  [-420, -158 + 196 + G / 2, 420, -158 + 196 + G / 2],
]

/** ไทล์น้ำเงิน (คอมโพเนนต์): กลาง x z · ขนาด — ใบแรกคือโจทย์จาก Research ลงแผงหลัก */
const TILES = [
  { x: HERO.x0 + 24 + 56, z: HERO.z0 + 98, s: 112 },
  { x: SIDE.x0 + SIDE.w / 2, z: SIDE.z0 + 52, s: 64 },
  { x: CARD_A.x0 + 48, z: CARD_A.z0 + 48, s: 56 },
  { x: CARD_B.x0 + 48, z: CARD_B.z0 + 48, s: 56 },
]
const T0_START = { x: 0, z: 0 }

const C_WHITE: Col = [1, 1, 1]
const C_BAR: Col = [0.9, 0.93, 0.975]
const C_BAR_D: Col = [0.83, 0.88, 0.95]
const C_SOFT: Col = [0.81, 0.89, 1]
const C_BLUE: Col = [0.24, 0.55, 0.96]
const C_LBLUE: Col = [0.6, 0.78, 1]
const C_GREY: Col = [0.74, 0.79, 0.87]
type Col = [number, number, number]

/** wireframe ในแผง (พิกัดจากมุมซ้ายบนของแผง): dx dz w l รัศมี สี */
type Bar = { p: Rect; dx: number; dz: number; w: number; l: number; r: number; c: Col }
const BARS: Bar[] = [
  { p: HEAD, dx: 20, dz: 19, w: 70, l: 18, r: 9, c: C_SOFT },
  { p: HEAD, dx: 590, dz: 22, w: 40, l: 12, r: 6, c: C_BAR_D },
  { p: HEAD, dx: 640, dz: 22, w: 40, l: 12, r: 6, c: C_BAR_D },
  { p: HEAD, dx: 690, dz: 22, w: 40, l: 12, r: 6, c: C_BAR_D },
  { p: HERO, dx: 160, dz: 40, w: 220, l: 18, r: 9, c: C_BAR_D },
  { p: HERO, dx: 160, dz: 74, w: 280, l: 10, r: 5, c: C_BAR },
  { p: HERO, dx: 160, dz: 94, w: 230, l: 10, r: 5, c: C_BAR },
  { p: HERO, dx: 160, dz: 130, w: 110, l: 30, r: 15, c: C_SOFT },
  { p: CARD_A, dx: 96, dz: 30, w: 110, l: 12, r: 6, c: C_BAR_D },
  { p: CARD_A, dx: 96, dz: 52, w: 80, l: 10, r: 5, c: C_BAR },
  { p: CARD_A, dx: 20, dz: 100, w: 200, l: 56, r: 12, c: C_BAR },
  { p: CARD_B, dx: 96, dz: 30, w: 100, l: 12, r: 6, c: C_BAR_D },
  { p: CARD_B, dx: 96, dz: 52, w: 70, l: 10, r: 5, c: C_BAR },
]
/** รายการในแผงข้าง (Design) → กลายเป็นโค้ดตอน Build — บรรทัดเดียวกัน ตำแหน่งเดียวกัน */
const LIST_N = 7
const listZ = (i: number) => SIDE.z0 + 110 + i * 28
/** โค้ด: ย่อหน้า · ท่อนแรก (สี) · ท่อนหลัง (สี) */
const CODE: [number, number, Col, number, Col][] = [
  [0, 44, C_BLUE, 76, C_GREY],
  [1, 30, C_LBLUE, 104, C_GREY],
  [2, 56, C_BLUE, 60, C_LBLUE],
  [2, 40, C_GREY, 70, C_GREY],
  [1, 64, C_LBLUE, 40, C_BLUE],
  [1, 24, C_GREY, 96, C_GREY],
  [0, 36, C_BLUE, 0, C_GREY],
]
const codeAt = (i: number, b: number) => seg(b, 0.06 + i * 0.05, 0.1 + i * 0.05)
/** บรรทัดที่พิมพ์จบแล้วส่งเส้นจุดไปประกอบคอมโพเนนต์: บรรทัด → ไทล์ */
const LINKS: [number, number][] = [
  [1, 0],
  [3, 2],
  [5, 3],
]
const linkAt = (k: number) => 0.1 + LINKS[k][0] * 0.05
/** กราฟแท่งในการ์ดขวา (Build) */
const CHART = [40, 66, 52, 84, 60]

/** การ์ดข้อมูล Research: 15 ใบ สามกลุ่มตามสี กระจายปนกัน → เรียงเป็นสามคอลัมน์ */
const CARD = { w: 64, l: 42 }
const GROUP_COL: Col[] = [C_BLUE, C_LBLUE, C_GREY]
const COLUMN_X = [-220, 0, 220]
/**
 * เคอร์เซอร์: แก้วฝ้าขาวนวลแบบภาพอ้างอิง — ปลายขาว ไล่เป็นม่วงอ่อนทางหาง ขอบฝั่งไฟสว่างจัด ขอบฝั่งเงาน้ำเงินเทา
 * (แก้วใสแบบฟองจมหายบนกระดาษขาว — ต้องมีเนื้อกับขอบเงาให้อ่านทรงออกทุกพื้น)
 */
const CURSOR_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec2 vP;
  void main() {
    vN = normalize(normalMatrix * normal);
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const CURSOR_FRAG = /* glsl */ `
  uniform float uAlpha;
  /* ฟองแชต (px จริงของจอ ล่างขึ้น): กลาง · ครึ่งกว้าง/สูง — ส่วนที่ยังอยู่ในฟองเห็นจาง ๆ ผ่านแก้ว */
  uniform vec4 uBub;
  uniform float uIn;
  uniform float uPx;
  varying vec3 vN;
  varying vec2 vP;
  void main() {
    vec3 n = normalize(vN);
    float rim = clamp(1.0 - abs(n.z), 0.0, 1.0);
    vec2 L = normalize(vec2(-0.55, 0.83));
    vec2 side = length(n.xy) > 1e-4 ? normalize(n.xy) : vec2(0.0);
    float toward = max(dot(side, L), 0.0) * rim;
    float away = max(dot(side, -L), 0.0) * rim;
    float g = clamp((vP.x - vP.y) * 0.62, 0.0, 1.0);
    vec3 col = mix(vec3(1.0), vec3(0.83, 0.85, 1.0), g);
    col = mix(col, vec3(0.5, 0.56, 0.86), smoothstep(0.15, 0.9, away) * 0.7);
    col += vec3(0.4) * pow(toward, 1.6);
    float a = (0.84 + 0.16 * rim) * uAlpha;
    vec2 q = abs(gl_FragCoord.xy - uBub.xy) - vec2(max(uBub.z - uBub.w, 0.0), 0.0);
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uBub.w;
    float inside = (1.0 - smoothstep(-1.5 * uPx, 1.5 * uPx, sd)) * uIn;
    col = mix(col, vec3(0.86, 0.9, 1.0), inside * 0.5);
    a *= mix(1.0, 0.4, inside);
    gl_FragColor = vec4(min(col, vec3(1.0)), a);
  }
`
/** เงาเคอร์เซอร์: รูปลูกศรเบลอ (เงาจาก shadowBlur — Safari เก่าไม่มี ctx.filter) */
function cursorShadowTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d') as CanvasRenderingContext2D
  const mx = (x: number) => ((x + 0.3) / 1.6) * 256 - 2000
  const my = (y: number) => ((0.3 - y) / 1.6) * 256
  g.shadowColor = 'rgba(24, 32, 90, 0.5)'
  g.shadowBlur = 22
  g.shadowOffsetX = 2000
  g.beginPath()
  CURSOR_PTS.forEach(([x, y], i) => (i ? g.lineTo(mx(x), my(y)) : g.moveTo(mx(x), my(y))))
  g.closePath()
  g.fillStyle = '#000'
  g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
/** ลูกศรแบบลูกดอก (ภาพอ้างอิง): ปลายซ้ายบน ปีกขวา · รอยเว้าด้านหลัง · ปีกล่าง — หน่วย 1 = ยาวทั้งตัว */
const CURSOR_PTS: [number, number, number][] = [
  [0, 0, 0.05],
  [1, -0.42, 0.09],
  [0.57, -0.57, 0.14],
  [0.42, -1, 0.09],
]
/** ตัวลูกศร: มุมมนทุกมุม รีดหนา ขอบลบมนนุ่ม ๆ แบบแก้วหล่อ */
function cursorGeometry() {
  const s = new THREE.Shape()
  const n = CURSOR_PTS.length
  const A = new THREE.Vector2()
  const B = new THREE.Vector2()
  CURSOR_PTS.forEach(([x, y, r], i) => {
    const [px, py] = CURSOR_PTS[(i + n - 1) % n]
    const [nx, ny] = CURSOR_PTS[(i + 1) % n]
    A.set(px - x, py - y).normalize().multiplyScalar(r).add(new THREE.Vector2(x, y))
    B.set(nx - x, ny - y).normalize().multiplyScalar(r).add(new THREE.Vector2(x, y))
    if (i === 0) s.moveTo(A.x, A.y)
    else s.lineTo(A.x, A.y)
    s.quadraticCurveTo(x, y, B.x, B.y)
  })
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.055, bevelSegments: 6, curveSegments: 10 })
  g.translate(0, 0, -0.05)
  return g
}

function roundRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + h - r)
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + h)
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

/** สุ่มแบบมีเมล็ด — ผังกระจายของการ์ดเหมือนเดิมทุกครั้ง (เลื่อนกลับแล้วเห็นท่าเดิม) */
function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

const SCATTER = (() => {
  const rnd = seeded(7)
  return Array.from({ length: 15 }, (_, i) => {
    const g = i % 3
    const k = Math.floor(i / 3)
    return {
      g,
      k,
      x: (rnd() - 0.5) * 640,
      z: (rnd() - 0.5) * 360,
      yaw: (rnd() - 0.5) * 0.9,
      ph: rnd() * Math.PI * 2,
      dir: rnd() * Math.PI * 2,
    }
  })
})()
const columnZ = (k: number) => -96 + k * 48
/** กรอบเลือกที่ลากครอบการ์ดทั้งหมด */
const MQ_A = { x: -372, z: -232 }
const MQ_B = { x: 372, z: 232 }

/** เวลาของ Research */
const R = { fly: 0.15, drag0: 0.22, drag1: 0.42, sort0: 0.42, sort1: 0.62, merge0: 0.72, merge1: 0.88, pop0: 0.84, pop1: 0.96 }
/** เวลาของ Design */
const D = { move0: 0.04, move1: 0.28, guide0: 0.26, guide1: 0.42, draw0: 0.34, draw1: 0.5, fill0: 0.48, bars0: 0.56, tiles0: 0.62, pick: 0.84, lift0: 0.62 }

/* ------------------------------------------------------------------ ตำแหน่งของชิ้นต่าง ๆ ณ ท่าของเฟรมนี้ */

/** ไทล์ใบแรก (โจทย์) — เกิดกลางจอตอนการ์ดหลอมรวม แล้วถูกลากลงแผงหลัก */
function tile0(p: ProcessPose, out: { x: number; z: number }) {
  const k = inOut(seg(p.design, D.move0, D.move1))
  out.x = lerp(T0_START.x, TILES[0].x, k)
  out.z = lerp(T0_START.z, TILES[0].z, k)
  return out
}
/** ขนาดแผงหลักที่กำลังถูกลากวาด (ยึดมุมซ้ายบน) */
const heroDraw = (d: number) => inOut(seg(d, D.draw0, D.draw1))
/** ความสูงที่ไทล์ลอยจากพื้น (หน้าตรง = แนบพื้น · ไอโซ = ยกตัว แผ่นซ้อนแยกออก) */
const liftOf = (p: ProcessPose) => (p.build > 0 ? 1 : smooth(seg(p.design, D.lift0, 1)))

/* ------------------------------------------------------------------ เคอร์เซอร์ (ตัวนำ) */

export type CursorState = { pos: THREE.Vector3; press: number; show: number }
export const newCursor = (): CursorState => ({ pos: new THREE.Vector3(), press: 0, show: 0 })
const T0P = { x: 0, z: 0 }
const pulse = (v: number, a: number, w = 0.04) => smooth((v - a) / (w * 0.4)) * (1 - smooth((v - a - w) / (w * 0.6)))

export function cursorAt(p: ProcessPose, out: CursorState) {
  out.press = 0
  out.show = 1
  const Y = 3
  if (p.build > 0) {
    const b = p.build
    tile0(p, T0P)
    if (b < 0.08) {
      const k = inOut(b / 0.08)
      const t1 = TILES[1]
      out.pos.set(lerp(t1.x + t1.s / 2 + 4, SIDE.x0 + 26, k), Y, lerp(t1.z, listZ(0), k))
    } else if (b < 0.46) {
      /* พิมพ์: ปลายเคอร์เซอร์ตามท้ายบรรทัดที่กำลังพิมพ์ */
      const i = Math.min(LIST_N - 1, Math.floor((b - 0.06) / 0.05))
      const [ind, w1, , w2] = CODE[i]
      out.pos.set(SIDE.x0 + 26 + ind * 18 + (w1 + 6 + w2) * codeAt(i, b), Y, listZ(i) + 4)
      out.press = 0.25 * Math.abs(Math.sin(b * 140))
    } else if (b < 0.7) {
      const k = inOut((b - 0.46) / 0.24)
      out.pos.set(lerp(SIDE.x0 + 140, CARD_B.x0 + 200, k), Y, lerp(listZ(LIST_N - 1), CARD_B.z0 + 120, k))
      out.pos.y += 10 * Math.sin(Math.PI * k)
    } else {
      const k = inOut((b - 0.7) / 0.16)
      const t0 = TILES[0]
      out.pos.set(lerp(CARD_B.x0 + 200, t0.x + t0.s * 0.18, k), Y + 16 * liftOf(p), lerp(CARD_B.z0 + 120, t0.z + t0.s * 0.12, k))
      out.press = pulse(b, 0.88, 0.05)
    }
  } else if (p.design > 0) {
    const d = p.design
    tile0(p, T0P)
    const t0 = TILES[0]
    if (d < D.move1 + 0.02) {
      /* ลากไทล์ (โจทย์) ลงที่ของมันบนแผงหลัก */
      out.pos.set(T0P.x + t0.s * 0.18, Y, T0P.z + t0.s * 0.12)
      out.press = smooth(d / 0.03) * (1 - smooth((d - D.move1) / 0.03))
    } else if (d < D.draw0) {
      const k = inOut((d - D.move1 - 0.02) / (D.draw0 - D.move1 - 0.02))
      out.pos.set(lerp(t0.x + t0.s * 0.18, HERO.x0, k), Y, lerp(t0.z + t0.s * 0.12, HERO.z0, k))
      out.pos.y += 14 * Math.sin(Math.PI * k)
    } else if (d < D.draw1 + 0.02) {
      /* ลากวาดแผงหลักจากมุมซ้ายบนถึงขวาล่าง */
      const k = heroDraw(d)
      out.pos.set(HERO.x0 + HERO.w * k, Y, HERO.z0 + HERO.l * k)
      out.press = smooth((d - D.draw0) / 0.02) * (1 - smooth((d - D.draw1) / 0.02))
    } else {
      const k = inOut((d - D.draw1 - 0.02) / 0.12)
      const t1 = TILES[1]
      const ly = 16 * liftOf(p)
      out.pos.set(lerp(HERO.x0 + HERO.w, t1.x + t1.s / 2 + 4, k), Y + ly, lerp(HERO.z0 + HERO.l, t1.z, k))
      out.pos.y += 16 * Math.sin(Math.PI * k)
      out.press = pulse(d, D.pick, 0.05)
    }
  } else if (p.research > 0) {
    const r = p.research
    if (r < R.drag0) {
      const k = inOut(r / R.drag0)
      out.pos.set(lerp(0, MQ_A.x, k), Y, lerp(0, MQ_A.z, k))
      out.pos.y += 20 * Math.sin(Math.PI * k)
    } else if (r < R.drag1 + 0.06) {
      const k = inOut((r - R.drag0) / (R.drag1 - R.drag0))
      out.pos.set(lerp(MQ_A.x, MQ_B.x, k), Y, lerp(MQ_A.z, MQ_B.z, k))
      out.press = smooth((r - R.drag0) / 0.02) * (1 - smooth((r - R.drag1) / 0.02))
    } else if (r < R.pop0) {
      const k = inOut((r - R.drag1 - 0.06) / (R.pop0 - R.drag1 - 0.06))
      out.pos.set(lerp(MQ_B.x, 90, k), Y, lerp(MQ_B.z, 70, k))
    } else {
      const k = inOut((r - R.pop0) / 0.06)
      const t0 = TILES[0]
      out.pos.set(lerp(90, T0_START.x + t0.s * 0.18, k), Y, lerp(70, T0_START.z + t0.s * 0.12, k))
      out.press = pulse(r, 0.93, 0.05)
    }
  } else {
    /* คลิกเปิดแผ่นงาน ตรงจุดกำเนิดของเวที */
    out.pos.set(0, Y, 0)
    out.press = pulse(p.frame, 0.34, 0.08)
    out.show = p.bar > 0 ? 1 : 0
  }
  return out
}

/* ------------------------------------------------------------------ กล้อง */

export type StageFrame = { pos: THREE.Vector3; q: THREE.Quaternion; sc: number }
export const newFrame = (): StageFrame => ({ pos: new THREE.Vector3(), q: new THREE.Quaternion(), sc: 1 })

/**
 * คีย์เฟรมกล้องบนเส้นเรื่อง T (0..5) ต่อด้วย Catmull-Rom — ผ่านคีย์ไม่หยุด ความเร็วต่อเนื่อง
 * หน้าตรงตลอดเปิด + Research (ภาพแบนเหมือนจอออกแบบ ดันเข้าช้า ๆ) → Design เอียงลงไอโซ → Build โคจร ถอยออก
 * yaw โคจรรอบแกนตั้ง · elev มุมก้ม (90 = ตั้งฉากลงพื้น) · scale คูณสเกลพอดีผัง · fx/fy จุดเล็งบนจอ · tx/tz จุดเล็งบนพื้น
 */
// prettier-ignore
const CAM: number[][] = [
  //  T     yaw  elev  roll  scale  fx     fy     tx    tz
  [0.0,    0,   90,   0,   0.92,  0.0,   0.0,   0,    0],
  [2.0,    0,   90,   0,   0.96,  0.03,  0.03,  0,    0],
  [2.5,    0,   90,   0,   1.0,   0.03,  0.03,  0,    0],
  [3.0,    0,   90,   0,   1.08,  0.03,  0.03,  0,    0],
  [3.35,   0,   90,   0,   0.98,  0.04,  0.04,  0,    0],
  [3.7,   14,   72,   0,   0.98,  0.04,  0.03,  0,    0],
  [4.0,   38,   42,   0,   1.0,   0.04,  0.0,   0,    0],
  [4.35,  44,   38,   0,   1.1,   0.03,  0.0,   90,  -10],
  [4.75,  36,   36,   0,   1.04,  0.04,  0.0,   20,   10],
  [5.0,   30,   34,   0,   0.94,  0.05, -0.02,  0,    10],
]
const CAM_V: number[] = Array.from({ length: 8 }, () => 0)
function sampleCam(T: number, out: number[]) {
  const n = CAM.length
  if (T <= CAM[0][0] || T >= CAM[n - 1][0]) {
    const k = T <= CAM[0][0] ? CAM[0] : CAM[n - 1]
    for (let j = 1; j < 9; j += 1) out[j - 1] = k[j]
    return out
  }
  let i = 0
  while (i < n - 2 && T > CAM[i + 1][0]) i += 1
  const t0 = CAM[i][0]
  const t1 = CAM[i + 1][0]
  const h = t1 - t0
  const u = (T - t0) / h
  const u2 = u * u
  const u3 = u2 * u
  for (let j = 1; j < 9; j += 1) {
    const v0 = CAM[i][j]
    const v1 = CAM[i + 1][j]
    const m0 = i > 0 ? (v1 - CAM[i - 1][j]) / (t1 - CAM[i - 1][0]) : 0
    const m1 = i + 2 < n ? (CAM[i + 2][j] - v0) / (CAM[i + 2][0] - t0) : 0
    out[j - 1] = (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * h * m1
  }
  return out
}
const QA = new THREE.Quaternion()
const QB = new THREE.Quaternion()
const QC = new THREE.Quaternion()
const TV = new THREE.Vector3()

/** กรอบเวทีเฟรมนี้ (โลกของแคนวาส = px กลางจอ y ขึ้น) · drift = ลมหายใจของกล้องตามเวลา (เฉพาะฉาก 3D) */
export function stageFrame(W: number, H: number, p: ProcessPose, out: StageFrame, drift = 0, drift2 = 0) {
  sampleCam(storyT(p), CAM_V)
  QA.setFromAxisAngle(AY, (CAM_V[0] + drift * 1.4) * D2R)
  QB.setFromAxisAngle(AX, (CAM_V[1] - Math.abs(drift2) * 1.2) * D2R)
  QC.setFromAxisAngle(AZ, (CAM_V[2] + drift2 * 0.5) * D2R)
  out.q.copy(QC).multiply(QB).multiply(QA)
  /* ผังพอดีจอ ~60% กว้าง เหลือที่ให้ป้ายขั้นทางซ้ายบน */
  out.sc = Math.min((W * 0.6) / 760, (H * 0.6) / 470) * CAM_V[3]
  TV.set(CAM_V[6], 0, CAM_V[7]).applyQuaternion(out.q).multiplyScalar(out.sc)
  out.pos.set(CAM_V[4] * W - TV.x, CAM_V[5] * H - TV.y, -TV.z)
  return out
}
const PV = new THREE.Vector3()
/** จุดเวที → px บนจอ (y ลง) */
export function project(f: StageFrame, W: number, H: number, v: THREE.Vector3, out: { x: number; y: number }) {
  PV.copy(v).multiplyScalar(f.sc).applyQuaternion(f.q).add(f.pos)
  out.x = W / 2 + PV.x
  out.y = H / 2 - PV.y
  return out
}

/* ------------------------------------------------------------------ เชดเดอร์ */

/**
 * กล่องมนแบน (แผง การ์ด แถบ wireframe บรรทัดโค้ด) — อินสแตนซ์เดียววาดทุกชิ้น ขนาดจริงอยู่ใน aRect
 * มุมมนคิดจาก SDF ในหน่วยเวที (ย่อขยายแล้วมุมไม่เบี้ยว) · เงานุ่มสีฟ้าเลื่อนลงล่างนิด (แสงจากบน) · ขอบบาง
 */
const RECT_VERT = /* glsl */ `
  attribute vec4 aRect;
  attribute vec4 aCol;
  attribute float aEdge;
  uniform float uM;
  varying vec2 vP;
  varying vec4 vRect;
  varying vec4 vCol;
  varying float vEdge;
  void main() {
    vec2 full = aRect.xy + 2.0 * uM;
    vP = position.xz * full;
    vRect = aRect;
    vCol = aCol;
    vEdge = aEdge;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(vP.x, 0.0, vP.y, 1.0);
  }
`
const RECT_FRAG = /* glsl */ `
  uniform float uM;
  varying vec2 vP;
  varying vec4 vRect;
  varying vec4 vCol;
  varying float vEdge;
  float sdBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 hb = vRect.xy * 0.5;
    float r = min(vRect.z, min(hb.x, hb.y));
    float sd = sdBox(vP, hb, r);
    float aa = max(fwidth(sd), 1e-3);
    float fill = 1.0 - smoothstep(-aa, aa, sd);
    float sds = sdBox(vP - vec2(0.0, uM * 0.3), hb, r);
    float sh = (1.0 - smoothstep(-uM * 0.25, uM * 0.8, sds)) * vRect.w;
    float edge = (1.0 - smoothstep(0.0, 1.6, -sd)) * vEdge;
    vec3 col = mix(vCol.rgb, vec3(0.84, 0.9, 0.97), edge);
    float a = fill * vCol.a;
    float sa = sh * 0.3 * vCol.a * (1.0 - fill);
    float oa = a + sa * (1.0 - a);
    if (oa < 0.003) discard;
    vec3 sc = vec3(0.32, 0.5, 0.86);
    gl_FragColor = vec4((col * a + sc * sa * (1.0 - a)) / max(oa, 1e-4), oa);
  }
`
/** เส้นจุดไกด์ — เรขาคณิตยาว 0..1 ตามแกน x · วาดถึง aLine.y · จุดวิ่งตาม aLine.z (เส้นที่มีข้อมูลไหล) */
const DOT_VERT = /* glsl */ `
  attribute vec4 aLine;
  uniform float uW;
  varying vec2 vUv;
  varying vec4 vLine;
  void main() {
    vUv = vec2(position.x, position.z + 0.5);
    vLine = aLine;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position.x * aLine.x, 0.0, position.z * uW, 1.0);
  }
`
const DOT_FRAG = /* glsl */ `
  uniform float uW;
  uniform float uSp;
  uniform float uR;
  varying vec2 vUv;
  varying vec4 vLine;
  void main() {
    if (vUv.x > vLine.y) discard;
    float s = vUv.x * vLine.x;
    float c = mod(s - vLine.z, uSp) - uSp * 0.5;
    float d = length(vec2(c, (vUv.y - 0.5) * uW));
    float a = (1.0 - smoothstep(uR - 0.6, uR + 0.6, d)) * vLine.w;
    float ends = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
    a *= mix(0.45, 1.0, ends);
    if (a < 0.01) discard;
    gl_FragColor = vec4(0.24, 0.55, 0.96, a);
  }
`
/** ไทล์น้ำเงิน: หน้าบนไล่ฟ้าอ่อน (ซ้ายบน) → น้ำเงินเข้ม (ขวาล่าง) ขอบในสว่าง · ด้านข้างน้ำเงินจัด */
const TILE_VERT = /* glsl */ `
  attribute vec2 aTile;
  varying vec3 vN;
  varying vec3 vP;
  varying vec2 vT;
  void main() {
    vN = normal;
    vP = position;
    vT = aTile;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`
const TILE_FRAG = /* glsl */ `
  varying vec3 vN;
  varying vec3 vP;
  varying vec2 vT;
  void main() {
    vec3 n = normalize(vN);
    float top = smoothstep(0.55, 0.95, n.y);
    float t = clamp(0.5 + (vP.x + vP.z) * 0.6, 0.0, 1.0);
    vec3 topC = mix(vec3(0.5, 0.76, 1.0), vec3(0.17, 0.52, 0.96), t);
    float rim = smoothstep(0.34, 0.5, max(abs(vP.x), abs(vP.z)));
    topC = mix(topC, vec3(0.66, 0.84, 1.0), rim * 0.4);
    vec3 sideC = mix(vec3(0.08, 0.42, 0.9), vec3(0.2, 0.55, 0.98), clamp(-n.z * 0.5 + 0.5, 0.0, 1.0));
    vec3 col = mix(sideC, topC, top) + vT.y * vec3(0.22, 0.26, 0.3);
    gl_FragColor = vec4(min(col, vec3(1.0)), vT.x);
  }
`
/** แผ่นโปร่งใต้ไทล์ (เงา/ชั้นซ้อน) */
const PLATE_FRAG = /* glsl */ `
  varying vec3 vN;
  varying vec3 vP;
  varying vec2 vT;
  void main() {
    float top = smoothstep(0.55, 0.95, normalize(vN).y);
    vec3 col = mix(vec3(0.42, 0.66, 1.0), vec3(0.62, 0.8, 1.0), top);
    gl_FragColor = vec4(col, vT.x * mix(0.62, 0.52, top));
  }
`
/** พื้นแผ่นงาน: จุดกริดจาง ๆ แบบเครื่องมือออกแบบ จางออกห่างกลาง */
const GRID_VERT = /* glsl */ `
  varying vec2 vW;
  void main() {
    vW = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const GRID_FRAG = /* glsl */ `
  uniform float uAlpha;
  varying vec2 vW;
  void main() {
    vec2 g = mod(vW + 12.0, 24.0) - 12.0;
    float d = length(g);
    float a = (1.0 - smoothstep(1.0, 1.9, d)) * (1.0 - smoothstep(360.0, 820.0, length(vW))) * uAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(0.6, 0.71, 0.86, a * 0.55);
  }
`

/* ------------------------------------------------------------------ ฉาก */

/** ช่องอินสแตนซ์: การ์ด Research (+ป้ายสี +แถบข้อความ) · แผง · wireframe · แถบรายการ/โค้ด (2 ท่อน) · กราฟ */
const N_CARD = SCATTER.length
const RECT_N = N_CARD * 3 + PANELS.length + BARS.length + LIST_N * 2 + CHART.length
/** เส้นจุด: ไกด์ร่อง · กรอบเลือก/กลุ่ม (3 กลุ่ม × 4 เส้น) · กรอบเลือกไทล์ (2 × 4) · ทางข้อมูล */
const DOT_N = GUIDES.length + 12 + 8 + LINKS.length
const UM = 26

export function ProcessScene({ pose }: { pose: React.RefObject<ProcessPose> }) {
  const { size, gl } = useThree()
  const invalidate = useThree((s) => s.invalidate)
  const root = useRef<THREE.Group>(null)
  const rects = useRef<THREE.InstancedMesh>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const tiles = useRef<THREE.InstancedMesh>(null)
  const plates = useRef<THREE.InstancedMesh>(null)
  const grid = useRef<THREE.Mesh>(null)
  const cursor = useRef<THREE.Mesh>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const frame = useMemo(newFrame, [])

  const built = useMemo(() => {
    const geos: THREE.BufferGeometry[] = []
    const mats: THREE.Material[] = []
    const texs: THREE.Texture[] = []
    const rectG = new THREE.PlaneGeometry(1, 1)
    rectG.rotateX(-Math.PI / 2)
    const aRect = new THREE.InstancedBufferAttribute(new Float32Array(RECT_N * 4), 4)
    const aCol = new THREE.InstancedBufferAttribute(new Float32Array(RECT_N * 4), 4)
    const aEdge = new THREE.InstancedBufferAttribute(new Float32Array(RECT_N), 1)
    rectG.setAttribute('aRect', aRect)
    rectG.setAttribute('aCol', aCol)
    rectG.setAttribute('aEdge', aEdge)
    geos.push(rectG)
    const rectM = new THREE.ShaderMaterial({
      vertexShader: RECT_VERT,
      fragmentShader: RECT_FRAG,
      uniforms: { uM: { value: UM } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    mats.push(rectM)

    const dotG = new THREE.PlaneGeometry(1, 1)
    dotG.translate(0.5, 0, 0)
    dotG.rotateX(-Math.PI / 2)
    const aLine = new THREE.InstancedBufferAttribute(new Float32Array(DOT_N * 4), 4)
    dotG.setAttribute('aLine', aLine)
    geos.push(dotG)
    const dotM = new THREE.ShaderMaterial({
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      uniforms: { uW: { value: 6 }, uSp: { value: 10 }, uR: { value: 1.9 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })
    mats.push(dotM)

    const tileG = new THREE.ExtrudeGeometry(roundRectShape(1, 1, 0.22), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 10 })
    tileG.rotateX(-Math.PI / 2)
    const aTile = new THREE.InstancedBufferAttribute(new Float32Array(TILES.length * 2), 2)
    tileG.setAttribute('aTile', aTile)
    geos.push(tileG)
    const tileM = new THREE.ShaderMaterial({ vertexShader: TILE_VERT, fragmentShader: TILE_FRAG, transparent: true, toneMapped: false })
    mats.push(tileM)
    const plateG = tileG.clone()
    const aPlate = new THREE.InstancedBufferAttribute(new Float32Array(TILES.length * 2 * 2), 2)
    plateG.setAttribute('aTile', aPlate)
    geos.push(plateG)
    const plateM = new THREE.ShaderMaterial({ vertexShader: TILE_VERT, fragmentShader: PLATE_FRAG, transparent: true, depthWrite: false, toneMapped: false })
    mats.push(plateM)

    const gridG = new THREE.PlaneGeometry(2400, 2400)
    gridG.rotateX(-Math.PI / 2)
    geos.push(gridG)
    const gridM = new THREE.ShaderMaterial({
      vertexShader: GRID_VERT,
      fragmentShader: GRID_FRAG,
      uniforms: { uAlpha: { value: 0 } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    mats.push(gridM)

    const curG = cursorGeometry()
    geos.push(curG)
    const curM = new THREE.ShaderMaterial({
      vertexShader: CURSOR_VERT,
      fragmentShader: CURSOR_FRAG,
      uniforms: { uAlpha: { value: 1 }, uBub: { value: new THREE.Vector4() }, uIn: { value: 0 }, uPx: { value: 1 } },
      transparent: true,
      toneMapped: false,
    })
    mats.push(curM)
    const cshTex = cursorShadowTexture()
    texs.push(cshTex)
    const cshG = new THREE.PlaneGeometry(1.6, 1.6)
    cshG.translate(0.5, -0.5, 0)
    geos.push(cshG)
    const cshM = new THREE.MeshBasicMaterial({ map: cshTex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false })
    mats.push(cshM)
    return { rectG, rectM, aRect, aCol, aEdge, dotG, dotM, aLine, tileG, tileM, aTile, plateG, plateM, aPlate, gridG, gridM, curG, curM, cshG, cshM, geos, mats, texs }
  }, [])

  useEffect(
    () => () => {
      built.geos.forEach((g) => g.dispose())
      built.mats.forEach((m) => m.dispose())
      built.texs.forEach((t) => t.dispose())
    },
    [built],
  )

  const tmp = useMemo(
    () => ({
      M: new THREE.Matrix4(),
      Q: new THREE.Quaternion(),
      P: new THREE.Vector3(),
      S: new THREE.Vector3(),
      V0: new THREE.Vector3(),
      cs: newCursor(),
      vel: new THREE.Vector2(),
      prev: new THREE.Vector3(),
      has: false,
    }),
    [],
  )

  useFrame(({ clock }, dt) => {
    const p = pose.current
    const r = root.current
    if (!p || !r) return
    const on = p.on && p.bar > 0.05
    r.visible = on && p.frame > 0
    if (cursor.current) cursor.current.visible = on
    if (shadow.current) shadow.current.visible = on
    if (!on) {
      tmp.has = false
      return
    }
    const { M, Q, P, S, V0, cs, vel, prev } = tmp
    const time = clock.elapsedTime
    /* กล้องหายใจตามเวลา — ไม่ต้องเลื่อนก็ยังลอย (หน้าตรงหายใจน้อยกว่า ไม่ให้ภาพแบนดูเอียงมั่ว) */
    const iso = smooth(seg(storyT(p), 3.4, 4.0))
    stageFrame(size.width, size.height, p, frame, Math.sin(time * 0.37) * lerp(0.25, 1, iso), Math.sin(time * 0.29 + 1.3) * lerp(0.2, 1, iso))
    r.position.set(frame.pos.x, frame.pos.y - p.lift, frame.pos.z)
    r.quaternion.copy(frame.q)
    r.scale.setScalar(frame.sc)
    cursorAt(p, cs)

    const res = p.research
    const des = p.design
    const bld = p.build
    const lift = liftOf(p)
    tile0(p, T0P)

    /* พื้นจุดกริด: ขึ้นพร้อมแผ่นงาน จางลงตอน Build (ผลิตภัณฑ์จริงไม่มีกริด) */
    built.gridM.uniforms.uAlpha.value = smooth(seg(p.frame, 0.6, 1)) * (1 - 0.6 * smooth(seg(bld, 0.2, 0.7)))
    if (grid.current) grid.current.visible = p.frame > 0.6

    /* ---------------- กล่องมนทั้งหมด */
    const rm = rects.current
    if (rm) {
      const aR = built.aRect.array as Float32Array
      const aC = built.aCol.array as Float32Array
      const aE = built.aEdge.array as Float32Array
      let n = 0
      const put = (x: number, y: number, z: number, yaw: number, w: number, l: number, rad: number, sh: number, c: Col, a: number, edge: number) => {
        if (a <= 0.002 || w <= 0.01 || l <= 0.01) return
        P.set(x, y, z)
        Q.setFromAxisAngle(AY, yaw)
        S.set(1, 1, 1)
        M.compose(P, Q, S)
        rm.setMatrixAt(n, M)
        aR.set([w, l, rad, sh], n * 4)
        aC.set([c[0], c[1], c[2], a], n * 4)
        aE[n] = edge
        n += 1
      }
      /* แผง (ล่างสุด) */
      const showPanels = des > 0 || bld > 0
      if (showPanels) {
        PANELS.forEach((pn, k) => {
          let g = 1
          if (bld <= 0) {
            g = k === 1 ? heroDraw(des) : outQuint(seg(des, D.fill0 + (k === 0 ? 0 : k - 1) * 0.04, D.fill0 + 0.1 + (k === 0 ? 0 : k - 1) * 0.04))
          }
          const w = pn.w * g
          const l = pn.l * (k === 1 ? g : Math.min(1, g * 1.2))
          put(pn.x0 + w / 2, 0.4, pn.z0 + l / 2, 0, w, l, 14, 1, C_WHITE, Math.min(1, g * 4), 1)
        })
        /* wireframe ในแผง — งอกจากซ้ายไปขวา */
        BARS.forEach((b, k) => {
          const g = bld > 0 ? 1 : outQuint(seg(des, D.bars0 + k * 0.012, D.bars0 + 0.1 + k * 0.012))
          const w = b.w * g
          const c: Col = bld > 0 ? (b.c === C_BAR ? lerp3(C_BAR, C_BAR_D, smooth(seg(bld, 0.5, 0.8)), b.c) : b.c) : b.c
          put(b.p.x0 + b.dx + w / 2, 0.9, b.p.z0 + b.dz + b.l / 2, 0, w, b.l, b.r, 0, c, g, 0)
        })
        /* แผงข้าง: รายการ (Design) → โค้ดพิมพ์ทีละบรรทัด (Build) */
        for (let i = 0; i < LIST_N; i += 1) {
          const z = listZ(i) + 6
          if (bld <= 0) {
            const g = outQuint(seg(des, D.bars0 + 0.1 + i * 0.012, D.bars0 + 0.2 + i * 0.012))
            put(SIDE.x0 + 26 + (190 * g) / 2, 0.9, z, 0, 190 * g, 12, 6, 0, C_BAR, g, 0)
          } else {
            const [ind, w1, c1, w2, c2] = CODE[i]
            const k = codeAt(i, bld)
            const tot = (w1 + 6 + w2) * k
            const a1 = Math.min(w1, tot)
            const a2 = Math.max(0, tot - w1 - 6)
            const x0 = SIDE.x0 + 26 + ind * 18
            /* รายการเดิมหดหายก่อนโค้ดบรรทัดนั้นเริ่มพิมพ์ */
            const old = 1 - smooth(seg(bld, 0.02 + i * 0.01, 0.06 + i * 0.01))
            put(SIDE.x0 + 26 + (190 * old) / 2, 0.9, z, 0, 190 * old, 12, 6, 0, C_BAR, old, 0)
            put(x0 + a1 / 2, 1, z, 0, a1, 12, 6, 0, c1, k > 0 ? 1 : 0, 0)
            put(x0 + w1 + 6 + a2 / 2, 1, z, 0, a2, 12, 6, 0, c2, a2 > 0 ? 1 : 0, 0)
          }
        }
        /* กราฟในการ์ดขวา (Build) — แท่งงอกจากฐาน */
        CHART.forEach((h, i) => {
          const g = outQuint(seg(bld, 0.42 + i * 0.04, 0.56 + i * 0.04))
          const hh = h * g
          const base = CARD_B.z0 + CARD_B.l - 22
          put(CARD_B.x0 + 30 + i * 38 + 12, 1, base - hh / 2, 0, 24, hh, 6, 0, i % 2 ? C_LBLUE : C_BLUE, g, 0)
        })
      }
      /* การ์ด Research (บนสุด) */
      if (res > 0 && des <= 0) {
        const merge = inOut(seg(res, R.merge0, R.merge1))
        SCATTER.forEach((c, i) => {
          const app = outQuint(seg(res, i * 0.006, R.fly + i * 0.006))
          const sort = inOut(seg(res, R.sort0 + c.k * 0.025 + c.g * 0.012, R.sort0 + 0.12 + c.k * 0.025 + c.g * 0.012))
          /* ลอยนิ่ง ๆ ตอนยังกระจาย (มีชีวิต) — เรียงแล้วนิ่ง */
          const drift = (1 - sort) * 4
          let x = c.x + Math.cos(time * 0.6 + c.ph) * drift - Math.cos(c.dir) * 320 * (1 - app)
          let z = c.z + Math.sin(time * 0.5 + c.ph) * drift - Math.sin(c.dir) * 320 * (1 - app)
          let yaw = c.yaw * (1 - sort) + Math.sin(time * 0.4 + c.ph) * 0.02 * (1 - sort)
          x = lerp(x, COLUMN_X[c.g], sort)
          z = lerp(z, columnZ(c.k), sort)
          const mk = smooth(seg(merge, c.k * 0.05, 0.75 + c.k * 0.05))
          x = lerp(x, T0_START.x, mk)
          z = lerp(z, T0_START.z, mk)
          const sc = lerp(1, 0.25, mk)
          const a = app * (1 - smooth(seg(mk, 0.55, 1)))
          yaw *= 1 - mk
          const cw = CARD.w * sc
          const cl = CARD.l * sc
          put(x, 3, z, yaw, cw, cl, 8 * sc, 1, C_WHITE, a, 1)
          /* ป้ายสีบอกหมวด + แถบข้อความ (หมุนตามการ์ด) */
          const cy = Math.cos(yaw)
          const sy = Math.sin(yaw)
          const off = (dx: number, dz: number): [number, number] => [x + (dx * cy + dz * sy) * sc, z + (-dx * sy + dz * cy) * sc]
          const [px, pz] = off(-17, -9)
          put(px, 3.4, pz, yaw, 18 * sc, 7 * sc, 3.5 * sc, 0, GROUP_COL[c.g], a, 0)
          const [bx, bz] = off(-4, 6)
          put(bx, 3.4, bz, yaw, 44 * sc, 6 * sc, 3 * sc, 0, C_BAR_D, a, 0)
        })
      }
      for (let i = n; i < RECT_N; i += 1) aC[i * 4 + 3] = 0
      rm.count = n
      rm.instanceMatrix.needsUpdate = true
      built.aRect.needsUpdate = true
      built.aCol.needsUpdate = true
      built.aEdge.needsUpdate = true
    }

    /* ---------------- เส้นจุด */
    const dm = dots.current
    if (dm) {
      const aL = built.aLine.array as Float32Array
      let n = 0
      const line = (x0: number, z0: number, x1: number, z1: number, y: number, prog: number, flow: number, a: number) => {
        if (a <= 0.01 || prog <= 0.001) return
        const dx = x1 - x0
        const dz = z1 - z0
        const len = Math.hypot(dx, dz)
        if (len < 0.5) return
        P.set(x0, y, z0)
        Q.setFromAxisAngle(AY, Math.atan2(-dz, dx))
        S.set(1, 1, 1)
        M.compose(P, Q, S)
        dm.setMatrixAt(n, M)
        aL.set([len, prog, flow, a], n * 4)
        n += 1
      }
      const box = (x0: number, z0: number, x1: number, z1: number, y: number, a: number, prog = 1) => {
        line(x0, z0, x1, z0, y, prog, 0, a)
        line(x1, z0, x1, z1, y, prog, 0, a)
        line(x1, z1, x0, z1, y, prog, 0, a)
        line(x0, z1, x0, z0, y, prog, 0, a)
      }
      if (res > 0 && des <= 0) {
        /* กรอบเลือกตามเคอร์เซอร์ → แยกเป็นกรอบกลุ่มสามกลุ่มรอบคอลัมน์ → หดเข้าหาไทล์ตอนหลอมรวม */
        const dragK = inOut(seg(res, R.drag0, R.drag1))
        const split = inOut(seg(res, R.sort0 + 0.08, R.sort1))
        const merge = inOut(seg(res, R.merge0, R.merge1))
        const aMq = smooth(seg(res, R.drag0, R.drag0 + 0.03)) * (1 - smooth(seg(merge, 0.4, 0.9)))
        const bx = lerp(MQ_A.x, MQ_B.x, dragK)
        const bz = lerp(MQ_A.z, MQ_B.z, dragK)
        for (let g = 0; g < 3; g += 1) {
          /* ตอนลาก: ทั้งสามกรอบซ้อนกันเป็นกรอบเดียว · หลังปล่อย: แยกไปครอบคอลัมน์ของตัวเอง */
          const cx0 = lerp(lerp(MQ_A.x, COLUMN_X[g] - 46, split), T0_START.x - 66, merge)
          const cx1 = lerp(lerp(bx, COLUMN_X[g] + 46, split), T0_START.x + 66, merge)
          const cz0 = lerp(lerp(MQ_A.z, columnZ(0) - 36, split), T0_START.z - 66, merge)
          const cz1 = lerp(lerp(bz, columnZ(4) + 36, split), T0_START.z + 66, merge)
          box(cx0, cz0, cx1, cz1, 4, aMq * (g === 0 ? 1 : split))
        }
      }
      if (des > 0 || bld > 0) {
        /* ไกด์ตามร่อง ยืดออกจากไทล์ตอนวางลงผัง */
        const gk = bld > 0 ? 1 : inOut(seg(des, D.guide0, D.guide1))
        const ga = bld > 0 ? 0.5 * (1 - smooth(seg(bld, 0.6, 0.9))) : lerp(1, 0.6, smooth(seg(des, 0.7, 1)))
        GUIDES.forEach(([x0, z0, x1, z1]) => line(x0, z0, x1, z1, 1.4, gk, 0, ga))
        /* เลือกไทล์ (ref: ไทล์น้ำเงินถูกเลือก เส้นจุดล้อม) */
        const t1 = TILES[1]
        const sa = smooth(seg(des, D.pick, D.pick + 0.04)) * (1 - smooth(seg(bld, 0.0, 0.08)))
        const pad = t1.s / 2 + 10
        box(t1.x - pad, t1.z - pad, t1.x + pad, t1.z + pad, 1.6, sa, smooth(seg(des, D.pick, D.pick + 0.08)))
        /* ทางข้อมูลจากบรรทัดโค้ดไปประกอบคอมโพเนนต์ — จุดไหลไปทางปลายทาง */
        LINKS.forEach(([li, ti], k) => {
          const t = linkAt(k)
          const pr = inOut(seg(bld, t, t + 0.1))
          const tt = TILES[ti]
          const tx = ti === 0 ? T0P.x : tt.x
          const tz = ti === 0 ? T0P.z : tt.z
          line(SIDE.x0 + 10, listZ(li) + 6, tx + tt.s / 2 + 6, tz, 2, pr, time * 26, pr > 0 ? 0.9 : 0)
        })
        /* ท่าจบ: ไกด์จุดล้อมไทล์ใหญ่ (ref) */
        const t0 = TILES[0]
        const fa = smooth(seg(bld, 0.86, 0.96))
        const pd = t0.s / 2 + 14
        box(t0.x - pd, t0.z - pd, t0.x + pd, t0.z + pd, 1.6, fa, fa)
      }
      dm.count = n
      dm.instanceMatrix.needsUpdate = true
      built.aLine.needsUpdate = true
    }

    /* ---------------- ไทล์ + แผ่นซ้อน */
    const tm = tiles.current
    const pm = plates.current
    if (tm && pm) {
      const aT = built.aTile.array as Float32Array
      const aP = built.aPlate.array as Float32Array
      let pn = 0
      TILES.forEach((t, i) => {
        let pop = 0
        let x = t.x
        let z = t.z
        if (i === 0) {
          pop = des > 0 || bld > 0 ? 1 : backOut(seg(res, R.pop0, R.pop1))
          x = T0P.x
          z = T0P.z
        } else pop = bld > 0 ? 1 : backOut(seg(des, D.tiles0 + (i - 1) * 0.05, D.tiles0 + 0.1 + (i - 1) * 0.05))
        /* ประกอบ (Build): คอมโพเนนต์ที่ทางข้อมูลวิ่งไปถึงยกตัวขึ้นอีกชั้น แผ่นที่สองโผล่ใต้มัน + วาบสว่าง */
        const li = LINKS.findIndex(([, ti]) => ti === i)
        const bk = li >= 0 ? backOut(seg(bld, linkAt(li) + 0.08, linkAt(li) + 0.18)) : 0
        const flash = li >= 0 ? Math.sin(Math.PI * seg(bld, linkAt(li) + 0.08, linkAt(li) + 0.22)) : 0
        const s = t.s * Math.max(1e-3, pop)
        const gap = 9 * lift
        const y = 2 + 14 * lift + 10 * bk
        P.set(x, y, z)
        Q.identity()
        S.set(s, s, s)
        M.compose(P, Q, S)
        tm.setMatrixAt(i, M)
        aT.set([Math.min(1, pop * 3), flash], i * 2)
        /* แผ่นใต้ (ref: ไทล์ลอย แผ่นโปร่งซ้อนอยู่ใต้) */
        for (let k = 0; k < 2; k += 1) {
          const ka = k === 0 ? lift : bk
          if (ka <= 0.01 || pop <= 0.01) continue
          P.set(x, y - gap * (k + 1) - 2, z)
          S.set(s, s * 0.6, s)
          M.compose(P, Q, S)
          pm.setMatrixAt(pn, M)
          aP.set([Math.min(1, ka) * Math.min(1, pop), 0], pn * 2)
          pn += 1
        }
      })
      tm.visible = res > R.pop0 || des > 0 || bld > 0
      tm.count = TILES.length
      tm.instanceMatrix.needsUpdate = true
      built.aTile.needsUpdate = true
      pm.count = pn
      pm.visible = pn > 0
      pm.instanceMatrix.needsUpdate = true
      built.aPlate.needsUpdate = true
    }

    /* ---------------- เคอร์เซอร์ (พิกัดโลก หันเข้ากล้องเสมอ) + เงา */
    const cur = cursor.current
    const sh = shadow.current
    if (cur && sh) {
      V0.copy(cs.pos).multiplyScalar(frame.sc).applyQuaternion(frame.q).add(frame.pos)
      V0.y -= p.lift
      if (tmp.has && dt > 0) {
        const k = 1 - Math.exp(-dt * 6)
        vel.x += ((V0.x - prev.x) / dt - vel.x) * k
        vel.y += ((V0.y - prev.y) / dt - vel.y) * k
      }
      prev.copy(V0)
      tmp.has = true
      const lean = (v: number, k: number) => Math.max(-0.32, Math.min(0.32, v * k))
      const size0 = 120 * cs.show * (1 - smooth(p.exit))
      const sz = Math.max(1e-3, size0 * (1 - 0.08 * cs.press))
      let cx = V0.x
      let cy = V0.y
      let szNow = sz
      let outK = 1
      /* ตอนเกิด: อยู่ในฟองแชต แล้วมุดทะลุขอบขวาออกมา — ระยะเยื้องจางหายระหว่างทางไปคลิกเปิดแผ่นงาน */
      const away = inOut(p.frame / 0.3)
      const um = built.curM.uniforms
      if (BUBBLE.ok && away < 1) {
        const k = inOut((p.bar - 0.1) / 0.3)
        outK = smooth((p.bar - 0.2) / 0.2)
        const ox = lerp(BUBBLE.x + BUBBLE.hw * 0.25, BUBBLE.x + BUBBLE.hw + 0.12 * size0, k)
        const oy = lerp(BUBBLE.y + BUBBLE.hh * 0.5, BUBBLE.y - BUBBLE.hh * 0.55, k) + 24 * Math.sin(Math.PI * k)
        cx = lerp(ox, V0.x, away)
        cy = lerp(oy, V0.y, away)
        szNow = Math.max(1e-3, lerp(lerp(BUBBLE.hh * 0.95, sz, smooth((p.bar - 0.14) / 0.26)), sz, away))
      }
      const dpr = gl.getPixelRatio()
      um.uBub.value.set((size.width / 2 + BUBBLE.x) * dpr, (size.height / 2 + BUBBLE.y) * dpr, BUBBLE.hw * dpr, BUBBLE.hh * dpr)
      um.uPx.value = dpr
      um.uIn.value = BUBBLE.ok ? 1 - smooth((p.bar - 0.45) / 0.2) : 0
      um.uAlpha.value = smooth(p.bar / 0.06)
      const hover = (lerp(26, 6, cs.press) + Math.sin(time * 2.1) * 3 * (1 - cs.press)) * outK
      cur.position.set(cx, cy + hover, 1000)
      cur.scale.setScalar(szNow)
      cur.rotation.set(-0.3 + lean(vel.y, 0.0004), 0.42 + lean(vel.x, 0.0003), lean(-vel.x, 0.00025) + Math.sin(time * 1.3) * 0.03)
      sh.position.set(cx + hover * 0.55, cy - hover * 0.35, 999)
      sh.scale.setScalar(szNow)
      sh.rotation.z = cur.rotation.z
      built.cshM.opacity = lerp(0.7, 0.35, (hover - 6) / 24) * cs.show * outK
      GLASS.ok = true
      GLASS.x = cx + size.width / 2
      GLASS.y = size.height / 2 - (cy + hover)
      placeSpot(CURSOR_SPOT.glass, GLASS.x, GLASS.y)
    }
    /* ลอย หายใจ จุดไหล — ขอเฟรมต่อจนจบเรื่อง */
    if (p.exit < 1) invalidate()
  })

  return (
    <>
      <group ref={root} visible={false}>
        <mesh ref={grid} geometry={built.gridG} material={built.gridM} position={[0, -0.5, 0]} renderOrder={0} visible={false} />
        <instancedMesh ref={rects} args={[built.rectG, built.rectM, RECT_N]} frustumCulled={false} renderOrder={1} />
        <instancedMesh ref={plates} args={[built.plateG, built.plateM, TILES.length * 2]} frustumCulled={false} renderOrder={2} />
        <instancedMesh ref={tiles} args={[built.tileG, built.tileM, TILES.length]} frustumCulled={false} renderOrder={3} />
        <instancedMesh ref={dots} args={[built.dotG, built.dotM, DOT_N]} frustumCulled={false} renderOrder={5} />
      </group>
      <mesh ref={shadow} geometry={built.cshG} material={built.cshM} renderOrder={20} visible={false} />
      <mesh ref={cursor} geometry={built.curG} material={built.curM} renderOrder={21} visible={false} />
    </>
  )
}
function lerp3(a: Col, b: Col, k: number, fallback: Col): Col {
  if (k <= 0) return fallback
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]
}

/* ------------------------------------------------------------------ ชั้น DOM */

/**
 * แผ่นงาน (artboard) + ป้ายขั้น — ชั้น DOM ใต้แคนวาส
 * แผ่นงานขาวขยายเป็นวงจากจุดที่เคอร์เซอร์คลิก (ฟ้าของ section อยู่ข้างใต้) แล้วคลุมทั้งจอ — ของ 3D วาดทับ
 * ป้ายขั้นเปลี่ยนตามเรื่อง: 01 Research · 02 UX/UI Design · 03 Build
 */
const STEPS = [
  { n: '01', t: 'Research', d: 'Understand the problem' },
  { n: '02', t: 'UX/UI Design', d: 'Shape the experience' },
  { n: '03', t: 'Build', d: 'Ship it as real code' },
]
export function ProcessOverlay({ bind }: { bind: React.RefObject<((p: ProcessPose) => void) | null> }) {
  const board = useRef<HTMLDivElement>(null)
  const steps = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLDivElement | null)[]>([])
  const frame = useMemo(newFrame, [])

  useEffect(() => {
    const pt = { x: 0, y: 0 }
    const o = new THREE.Vector3(0, 3, 0)
    bind.current = (p) => {
      const bd = board.current
      const st = steps.current
      if (!bd || !st) return
      const W = window.innerWidth
      const H = window.innerHeight
      /* แผ่นงานบานจากจุดคลิก (กำเนิดของเวทีบนจอ) */
      const open = inOut(seg(p.frame, 0.36, 0.9))
      bd.style.visibility = p.on && p.frame > 0.36 ? 'visible' : 'hidden'
      if (p.frame > 0.36) {
        stageFrame(W, H, p, frame)
        project(frame, W, H, o, pt)
        const R = open * Math.hypot(W, H) * 1.05 + 2
        bd.style.clipPath = open >= 1 ? 'none' : `circle(${R.toFixed(1)}px at ${pt.x.toFixed(1)}px ${pt.y.toFixed(1)}px)`
      }
      bd.style.transform = `translateY(${p.lift.toFixed(1)}px)`
      st.style.transform = `translateY(${p.lift.toFixed(1)}px)`
      /* ป้ายขั้น: ขึ้นทีละอัน ตามช่วงของเรื่อง */
      const win = [p.research > 0 && p.design <= 0 ? smooth(seg(p.research, 0.0, 0.12)) : 0, p.design > 0 && p.build <= 0 ? smooth(seg(p.design, 0.0, 0.1)) : 0, p.build > 0 ? smooth(seg(p.build, 0.0, 0.1)) * (1 - smooth(p.exit)) : 0]
      st.style.visibility = p.on && win.some((v) => v > 0) ? 'visible' : 'hidden'
      items.current.forEach((el, i) => {
        if (!el) return
        const v = win[i]
        el.style.opacity = v.toFixed(3)
        el.style.transform = `translateY(${((1 - v) * 14).toFixed(1)}px)`
      })
    }
    return () => {
      bind.current = null
    }
  }, [bind, frame])

  return (
    <>
      <div ref={board} className="ps2-board" style={{ visibility: 'hidden' }} aria-hidden />
      <div ref={steps} className="ps2-steps" style={{ visibility: 'hidden' }}>
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            ref={(el) => {
              items.current[i] = el
            }}
            className="ps2-step"
          >
            <span className="ps2-n">{s.n}</span>
            <span className="ps2-t">{s.t}</span>
            <span className="ps2-d">{s.d}</span>
          </div>
        ))}
      </div>
    </>
  )
}
