import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { WarmShaders } from '@/lib/WarmShaders'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { StageLight } from './Headline3D'
import { DeviceHalo } from './DeviceHalo'
import { BenchScreen } from './BenchScreen'
import { FallSky, type FallPose } from './FallSky'
import { BEAT, endOf, storySv2 } from '@/sections/skystory/beats'
import { AsciiClouds, type CloudBlob } from '@/components/AsciiClouds'
import { ISLAND } from './ResearchPlatform'
import { CODE_HIT, FOV, camDist, clamp01, devHook, devScreen, headPose, isTall, smooth, workBeats, worksPostSm, worksWordLayout, worksUI, slotRect, TILE_SLOTS, WORKS_BOOM, WORKS_HAND, WORKS_HOLD, WORKS_TEXT, type WorkBeats } from './workMotion'

/**
 * เครื่องแก้วเป็นโต๊ะทำงาน — เรื่องต่อจาก "Here is what I do"
 *
 *   morph · lift  ฟองคำพูดหงาย ข้อความลอยออก คลี่เป็นจอมือถือแก้ว (./BubbleTraveler) มีแสงเรืองรอบเครื่อง (./DeviceHalo)
 *   research      ยังเป็นฟองหงาย แล้วจึงคลี่เป็นเครื่อง (ไอคอนลอยประจำบท — ./BenchTokens — เอาออกแล้ว)
 *   bench         เครื่องตั้งหน้าตรง ขยายเลื่อนไปขวา หัวเรื่องไปซ้าย ป้ายขั้นตอนโผล่ใต้หัวเรื่อง
 *   design · code · ship  ของบนจอ (./BenchScreen) ทำทีละขั้น ป้ายของขั้นนั้นติดไฟ คำอธิบายจริงจากข้อมูลของเว็บ
 *
 * ของบนจอวาดในแคนวาสนี้ (เพอร์สเปกทีฟ) ซึ่งอยู่ *ใต้* ตัวเครื่องแก้ว (z 51 < 52) — เห็นผ่านแก้วเป็นของในจอ
 * ทุกค่าคิดจากระยะเลื่อน อ่านในลูปเลื่อน เขียนลง ref — React ไม่ re-render ระหว่างเลื่อน
 */

/** จอถัดไปที่ดันเรื่องนี้ขึ้นไป (กองหน้าต่าง — sections/whatidocard) */
const NEXT_ID = 'what-i-do-windows'

type Frame = { on: boolean; b: WorkBeats }

const desc = (t: string) => SKILLS.find((k) => k.title === t)?.desc ?? ''
/** ขั้นตอนใต้หัวเรื่อง — คำอธิบายจาก WhatIDo (Research ในข้อมูลยังเป็น Lorem รอเขียน — ไม่แสดง · Ship ยังไม่มี) */
const STEPS = [
  { key: 'research', label: 'Research', body: '' },
  { key: 'design', label: 'Design', body: desc('Design') },
  { key: 'code', label: 'Code', body: desc('Coding') },
  { key: 'ship', label: 'Ship', body: '' },
] as const


/** กล้องนิ่ง: ระนาบ z 0 = 1 px — แคนวาสของเครื่อง (ออร์โธ) ใส่เพอร์สเปกทีฟเองด้วยระยะเดียวกัน */
function Rig() {
  const { camera, size, invalidate } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = FOV
    cam.near = 10
    cam.far = size.height * 20
    cam.position.set(0, 0, camDist(size.height))
    cam.lookAt(0, 0, 0)
    cam.updateProjectionMatrix()
    invalidate()
  }, [camera, size, invalidate])
  return null
}

/**
 * วาดใน ticker ของ gsap — รอบเดียวกับที่ lenis เลื่อนสกรอลล์ (App ผูก lenis.raf ไว้กับ ticker ก่อน) จึงอ่านสกรอลล์ล่าสุดเสมอ
 * (invalidate ใน rAF ของตัวเอง = วาดเฟรมถัดไป บางเฟรมอ่านค่าก่อน lenis บางเฟรมหลัง → ตัวอักษร/เล่มงานกระตุกตอนสกรอลล์)
 * แคนวาสต้องเป็น frameloop="never" · ปิดเรื่องแล้ววาดต่ออีกสองสามเฟรมให้ภาพสุดท้ายเคลียร์
 */
function TickPump({ frame }: { frame: React.RefObject<Frame> }) {
  const advance = useThree((s) => s.advance)
  useEffect(() => {
    let tail = 0
    const tick = () => {
      if (frame.current?.on) tail = 3
      else if (tail > 0) tail--
      else return
      /* microtask = หลัง callback ทั้งรอบของ ticker (รวม lenis.raf) จบ — ไม่ขึ้นกับลำดับที่ลงทะเบียน */
      queueMicrotask(() => advance(performance.now()))
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [frame, advance])
  return null
}

/** ระหว่างเรื่องเปิดอยู่ วาดต่อเนื่อง (ไฟสถานะ คลื่นวง แสงรอบเครื่องเคลื่อนตามเวลา) */
function Pump({ frame }: { frame: React.RefObject<Frame> }) {
  const { invalidate } = useThree()
  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (frame.current?.on) invalidate()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame, invalidate])
  return null
}

/** ฟ้าที่ร่วงผ่าน (เมฆจุด ทิวเขา — ./FallSky) เริ่มร่วงตอนฟองเริ่มหงาย จนส่งของเสร็จ */
const FALL_FROM = BEAT.lift[0]
const FALL_TO = endOf(BEAT.ship)

/**
 * คำใหญ่พื้นหลังทีละบท — เครื่องอยู่กลางจอเต็มตัวข้างหน้า (แทนป้ายขั้นตอนซ้าย) · แบบหน้า Apple: ตัวหนาแน่น ระยะชิด
 * เข้า = ลอยขึ้นจากต่ำนิด เบลอ → ชัด · ออก = จางขยายออก ก่อนคำถัดไปเข้า
 */
/**
 * พื้นหลังบท Code: ดำด้านบน แสงม่วงไล่ขึ้นจากมุมล่าง (ซ้ายม่วงน้ำเงิน · ขวาชมพูลาเวนเดอร์สว่าง)
 * เมฆตัวอักษร ASCII ลอยไปมาบนแสง — ชุดเดียวกับปกโปรไฟล์ Fastwork (components/AsciiClouds) สีลาเวนเดอร์
 * ก้อนอยู่มุมล่างสองฝั่ง (ที่แสงอยู่) กับมุมบนบาง ๆ · กลางจอเว้นให้เครื่อง
 */
const CODE_CLOUDS: CloudBlob[] = [
  { x: 0.1, y: 0.9, rx: 0.3, ry: 0.28, k: 1.15, ax: 0.07, ay: 0.05, wx: 0.19, wy: 0.15, ph: 0.4 },
  { x: 0.9, y: 0.88, rx: 0.32, ry: 0.3, k: 1.2, ax: 0.07, ay: 0.05, wx: 0.16, wy: 0.21, ph: 2.2 },
  { x: 0.86, y: 0.12, rx: 0.22, ry: 0.16, k: 0.7, ax: 0.06, ay: 0.04, wx: 0.22, wy: 0.18, ph: 4.1 },
  { x: 0.12, y: 0.16, rx: 0.18, ry: 0.14, k: 0.55, ax: 0.05, ay: 0.03, wx: 0.24, wy: 0.2, ph: 5.6 },
]
const CODE_CLOUD_MASK = (x: number) => 0.2 + 0.8 * Math.min(1, Math.abs(x - 0.5) / 0.22)

/**
 * ปลายบท Code: คำใหญ่ "Code" สลายเป็นตัวอักษร ASCII ตามระยะเลื่อน (บันไดเดียวกับเมฆ ASCII — components/AsciiClouds)
 *   ตัวทึบจางลง พร้อมกับเนื้อตัวอักษรกลายเป็นอักขระบนตาราง (ทึบ '@' ตรงเนื้อเต็ม · '.' ตรงขอบ)
 *   แล้วแต่ละช่องทยอยไล่บันไดลง (@ → # → + → : → .) ลอยขึ้นเฉียงนิดแล้วหาย — ช่องไหนก่อนหลังสุ่มแบบกำหนดผล
 * วาดลงแคนวาสเต็มจอในชั้นตัวทึบ (เจาะรูตามเครื่องเหมือนกัน — อักขระอยู่หลังเครื่อง)
 */
/** ช่วงสลายในบท Code (สัดส่วนของบท) — ยาว ให้เลื่อนดูอักขระพุ่งใส่จอได้เต็มที่ ก่อนฉากมืดจางออก (codeDark 0.93) */
/* เริ่มตอนเครื่องลอยมาชนคำ (workMotion CODE_HIT) */
const DIS_FROM = CODE_HIT
/** ฉากมืดเริ่มเปิดรูกลับเป็นฟ้าตอนไหนของบท Code */
const DARK_OUT = 0.9
const DIS_LEN = 0.32
const DIS_RAMP = ' .·:-=+*#%@'
const DIS_CELL = 9
const dhash = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return x - Math.floor(x)
}
/**
 * เส้นฐานของตัวอักษรตรงกับที่เบราว์เซอร์วาดใน DOM (line-height = ขนาดตัว): ครึ่งช่องว่างบรรทัด + ascent ของฟอนต์
 * — ตัวทึบในแคนวาสทับตัว DOM เป๊ะ ตอนสลับจึงไม่กระโดด
 */
function cssBaseline(g: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, text: string, lineH: number) {
  const mt = g.measureText(text)
  const a = mt.fontBoundingBoxAscent
  const d = mt.fontBoundingBoxDescent
  return (lineH - (a + d)) / 2 + a
}
type DisMask = { w: number; h: number; font: string; cov: Float32Array; cols: number; rows: number }
/** ความหนาแน่นของเนื้อตัวอักษรต่อช่อง — ถ่ายตัวอักษรจริง (ฟอนต์/ขนาดเดียวกับคำบนจอ) ลงแคนวาสแล้วเฉลี่ยต่อช่อง */
function disMask(el: HTMLElement, text: string, prev: DisMask | null): DisMask | null {
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const w = Math.ceil(el.offsetWidth)
  const h = Math.ceil(el.offsetHeight)
  if (!w || !h || !r.width) return null
  if (prev && prev.w === w && prev.h === h && prev.font === font) return prev
  const c = new OffscreenCanvas(w, h)
  const g = c.getContext('2d')
  if (!g) return null
  g.font = font
  g.letterSpacing = cs.letterSpacing
  g.textBaseline = 'alphabetic'
  g.fillStyle = '#fff'
  g.fillText(text, 0, cssBaseline(g, text, h))
  const d = g.getImageData(0, 0, w, h).data
  const cols = Math.ceil(w / DIS_CELL)
  const rows = Math.ceil(h / DIS_CELL)
  const cov = new Float32Array(cols * rows)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) cov[Math.floor(y / DIS_CELL) * cols + Math.floor(x / DIS_CELL)] += d[(y * w + x) * 4 + 3] / 255
  for (let i = 0; i < cov.length; i++) cov[i] /= DIS_CELL * DIS_CELL
  return { w, h, font, cov, cols, rows }
}

/**
 * beat ระเบิดของเล่มงาน (แบบภาพประกอบ Essential coding apps): พื้นเหลืองสด · แสงขาวจ้ากลางเล่ม · ลำแสงเรียวขาวขอบดำพุ่งออก
 * · วงกลมกากบาทลอยออก · เกรนพ่นทั้งจอ — มุมลำแสง (องศา) · ยาว (เท่าของเส้นทแยงจอ) · กว้างปลาย (px)
 */
const BURST_RAYS: readonly (readonly [number, number, number])[] = [
  [-158, 1.0, 16],
  [-118, 0.9, 10],
  [-64, 1.1, 22],
  [-30, 0.85, 9],
  [6, 1.05, 18],
  [40, 0.95, 12],
  [84, 1.1, 20],
  [126, 0.9, 11],
  [168, 1.0, 15],
]
/** วงกลมกากบาท: มุม (องศา) · ระยะ (เท่าของด้านสั้นจอ) · รัศมี (px) */
const BURST_X: readonly (readonly [number, number, number])[] = [
  [-140, 0.42, 34],
  [-20, 0.5, 26],
  [70, 0.38, 30],
  [150, 0.46, 24],
]
/** เกรนพ่น (แคนวาสสุ่มครั้งเดียว ปูซ้ำ) */
function grainUrl() {
  const c = document.createElement('canvas')
  c.width = c.height = 160
  const g = c.getContext('2d')!
  const im = g.createImageData(160, 160)
  for (let n = 0; n < im.data.length; n += 4) {
    const v = Math.random() * 255
    im.data[n] = im.data[n + 1] = im.data[n + 2] = v
    im.data[n + 3] = 255
  }
  g.putImageData(im, 0, 0)
  return c.toDataURL()
}

const SKILL_WORDS: { key: 'study' | 'design' | 'code'; w: string }[] = [
  { key: 'study', w: 'Research' },
  { key: 'design', w: 'Design' },
  { key: 'code', w: 'Code' },
]

export function WorkStory() {
  const frame = useRef<Frame>({ on: false, b: workBeats(0) })
  const fall = useRef<FallPose>({ on: false, iso: 0, fall: 0, prog: 0, lift: 0 })
  const [on, setOn] = useState(false)
  const layer = useRef<HTMLDivElement>(null)
  const steps = useRef<HTMLDivElement>(null)
  const bigWords = useRef<(HTMLDivElement | null)[]>([])
  /** ชั้นเส้นขอบหน้าวัตถุ — ตรงที่เครื่อง/island บังตัวทึบ คำยังอ่านได้เป็นเส้นขอบ */
  const bigLines = useRef<(HTMLDivElement | null)[]>([])
  /* คำพื้นหลัง My Works — ขึ้นตอนเล่มงานกำลังคลี่ (BenchScreen) */
  const worksWord = useRef<HTMLDivElement>(null)
  const wwSize = useRef('')
  /* beat ระเบิด: ชั้นพื้นเหลือง/แสง/ลำแสง/กากบาท */
  const burst = useRef<HTMLDivElement>(null)
  /* ไทล์งานที่เปิดเต็มจออยู่ (−1 = ไม่มี) — ซิงก์เข้า worksUI ให้ฝั่ง 3D */
  const [openTile, setOpenTile] = useState(-1)
  const tilesBox = useRef<HTMLDivElement>(null)
  const tileBtns = useRef<(HTMLButtonElement | null)[]>([])
  const burstGlow = useRef<HTMLDivElement>(null)
  const burstG = useRef<SVGGElement>(null)
  const rayRefs = useRef<(SVGPolygonElement | null)[]>([])
  const xRefs = useRef<(SVGGElement | null)[]>([])
  useEffect(() => {
    worksUI.open = openTile
    if (openTile < 0) return
    const close = () => setOpenTile(-1)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const y0 = window.scrollY
    const scroll = () => {
      if (Math.abs(window.scrollY - y0) > 40) close()
    }
    window.addEventListener('keydown', key)
    window.addEventListener('scroll', scroll, { passive: true })
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('scroll', scroll)
    }
  }, [openTile])
  const [grain] = useState(() => (typeof document === 'undefined' ? '' : grainUrl()))
  const bigFront = useRef<HTMLDivElement>(null)
  /* ปลายบท Code: คำสลายเป็น ASCII (แคนวาสในชั้นตัวทึบ) */
  const disCanvas = useRef<HTMLCanvasElement>(null)
  const disMaskRef = useRef<DisMask | null>(null)
  /** ตัวทึบทั้งชุด — เจาะรูตามกรอบเครื่อง (clip-path) ตรงที่เครื่องบังเหลือแต่เส้นขอบ */
  const bigSolid = useRef<HTMLDivElement>(null)
  /* ชั้นตัวคำ DOM (ไม่รวมแคนวาสสลาย) — เจาะรูด้วย clip-path ที่นี่ */
  const wordsClip = useRef<HTMLDivElement>(null)
  const dark = useRef<HTMLDivElement>(null)
  const liftNow = useRef(0)
  /**
   * คำ Code สลายเป็น ASCII แบบพุ่งหาคนดู (ทุกเฟรม — อักขระสลับตัววิบวับตามเวลาแม้หยุดเลื่อน)
   *   ช่วงแรก: เนื้อคำกลายเป็นตารางอักขระ (ทึบตรงเนื้อเต็ม) แล้วอักขระสลับตัวไปมาบนบันไดเดียวกันเหมือนกำลังถอดรหัส
   *   แต่ละช่องทยอยหลุด (ขอบก่อนเนื้อ) พุ่งออกจากกลางคำเข้าหากล้อง — ใหญ่ขึ้น กระจายออกพ้นจอ ไล่บันไดลงแล้วจาง
   */
  const drawDissolve = useCallback((time: number) => {
    const cv = disCanvas.current
    const b = frame.current.b
    const live = frame.current.on
    if (!cv) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const dis = live ? (b.code - DIS_FROM) / DIS_LEN : 0
    const g = cv.getContext('2d')
    if (!g) return
    const ci = SKILL_WORDS.findIndex((w) => w.key === 'code')
    const el = bigWords.current[ci]
    if (dis <= 0.001 || dis >= 0.999) {
      if (cv.dataset.on === '1') {
        g.clearRect(0, 0, cv.width, cv.height)
        cv.dataset.on = '0'
        if (el) el.style.clipPath = ''
      }
      return
    }
    cv.dataset.on = '1'
    if (!el) return
    /* ตัว DOM หลบ (ตัดทิ้งทั้งกล่อง) ในเฟรมเดียวกับที่แคนวาสวาดตัวทึบแทน — ไม่มีเฟรมว่าง */
    el.style.clipPath = 'inset(50% 50% 50% 50%)'
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (cv.width !== Math.round(vw * dpr) || cv.height !== Math.round(vh * dpr)) {
      cv.width = Math.round(vw * dpr)
      cv.height = Math.round(vh * dpr)
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, vw, vh)
    const m = disMask(el, SKILL_WORDS[ci].w, disMaskRef.current)
    disMaskRef.current = m
    if (!m) return
    const r = el.getBoundingClientRect()
    const sx = r.width / m.w
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    /*
     * จุดชน = ตรงที่เครื่อง (ลอยเข้าหากล้องเบา ๆ) แตะคำ: แนวกลางเครื่อง ระดับกลางคำ · ระยะของช่องจากจุดชน 0..1 ตามความกว้างคำ
     */
    const hx = devScreen.ok ? devScreen.cx : cx
    const hy = cy
    const hitD = (row: number, col: number) =>
      Math.min(1, Math.hypot(r.left + (col + 0.5) * DIS_CELL * sx - hx, r.top + (row + 0.5) * DIS_CELL * sx - hy) / (r.width * 0.6))
    /* สลับเนื้อทึบ → อักขระ เป็นวงขยายจากจุดชน (ขอบวงสุ่มนิด) */
    const swapAt = (row: number, col: number) => (hitD(row, col) * 0.85 + dhash(row * 131 + col, 9) * 0.15) * SWAP
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    /*
     * ช่วงแรก (0 → SWAP): ตัวทึบ (วาดซ้ำในแคนวาส ตรงตำแหน่งเดิม) สลับเป็นอักขระทีละช่อง สุ่มทั่วทั้งคำ ไม่ไล่เป็นแนว
     * ช่องที่ยังไม่สลับยังเป็นเนื้อทึบ — ลบช่องที่สลับแล้วออกจากเนื้อทึบ แล้ววาดอักขระแทน
     */
    const appear = 1
    const SWAP = 0.26
    if (dis < SWAP) {
      const cs = getComputedStyle(el)
      g.save()
      g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      g.letterSpacing = cs.letterSpacing
      g.textAlign = 'left'
      g.textBaseline = 'alphabetic'
      g.fillStyle = '#fff'
      g.translate(r.left, r.top)
      g.scale(sx, sx)
      g.fillText(SKILL_WORDS[ci].w, 0, cssBaseline(g, SKILL_WORDS[ci].w, m.h))
      g.restore()
      g.save()
      g.globalCompositeOperation = 'destination-out'
      for (let row = 0; row < m.rows; row++)
        for (let col = 0; col < m.cols; col++) {
          if (swapAt(row, col) < dis) g.fillRect(r.left + col * DIS_CELL * sx - 0.5, r.top + row * DIS_CELL * sx - 0.5, DIS_CELL * sx + 1, DIS_CELL * sx + 1)
        }
      g.restore()
    }
    const fstep = Math.floor(time * 14)
    let lastFs = -1
    for (let row = 0; row < m.rows; row++)
      for (let col = 0; col < m.cols; col++) {
        const c = m.cov[row * m.cols + col]
        if (c < 0.12) continue
        /* ช่องนี้สลับจากเนื้อทึบเป็นอักขระแล้วหรือยัง (สุ่มกำหนดผล — ตรงกับที่ลบเนื้อทึบด้านบน) */
        const wipe = swapAt(row, col) < dis ? 1 : 0
        if (!wipe) continue
        const id = row * 131 + col
        /* หลุดเมื่อไหร่: ขอบ (เนื้อบาง) ก่อน เนื้อเต็มทีหลัง */
        /* หลุดเป็นคลื่นจากจุดชน (ใกล้หลุดก่อน) + สุ่มนิด ขอบก่อนเนื้อ */
        const start = SWAP * 0.6 + hitD(row, col) * 0.32 + dhash(id, 1) * 0.16 * (0.5 + 0.5 * c)
        const p = Math.min(1, Math.max(0, (dis - start) / 0.44))
        if (p >= 1) continue
        /*
         * มิติจริงแบบเพอร์สเปกทีฟ: แต่ละช่องมีความลึก z พุ่งเข้าหากล้อง (ระยะโฟกัส F) แต่ละตัวลึกสุดไม่เท่ากัน
         * ฉายภาพ = กลางคำ + ตำแหน่ง × F/(F − z) — ใกล้กล้องยิ่งขยายและเหวี่ยงออกไวขึ้นเรื่อย ๆ (ไม่ใช่เชิงเส้น) เหมือนทะลุจอออกมา
         * มีหางความเร็ว (เส้นจากตำแหน่งเมื่อครู่) และตัวใกล้ ๆ เรืองนุ่ม (ระยะชัดตื้น)
         */
        const F = 1000
        /*
         * ทุกตัวพุ่งตรงเข้าหากล้อง (ทะลุจอออกมา) เร็วไม่เท่ากัน — ใกล้ไกลเหลื่อมกันเห็นมิติ · ความหนาเริ่มต้นของคำ ±40
         */
        const zEnd = F * (0.6 + 0.38 * dhash(id, 5))
        const z0 = (dhash(id, 7) - 0.5) * 80
        /* แรงชนดันออกจากจุดชน (ใกล้แรงกว่า) + เบี่ยงสุ่ม */
        const ex0 = r.left + (col + 0.5) * DIS_CELL * sx
        const ey0 = r.top + (row + 0.5) * DIS_CELL * sx
        const hd = Math.max(1, Math.hypot(ex0 - hx, ey0 - hy))
        const kick = (1 - hitD(row, col)) * 170 * p
        const bx = ex0 - cx + ((ex0 - hx) / hd) * kick + (dhash(id, 2) - 0.5) * 60 * p
        const by = ey0 - cy + ((ey0 - hy) / hd) * kick + (dhash(id, 3) - 0.5) * 40 * p
        /* ตำแหน่ง 3D ณ ความคืบหน้า q → ฉายลงจอ */
        const at3 = (q: number) => {
          const z = z0 + zEnd * Math.pow(q, 1.7)
          const kk = F / Math.max(60, F - z)
          return { x: cx + bx * kk, y: cy + by * kk, k: kk }
        }
        const P1 = at3(p)
        const P0 = at3(Math.max(0, p - 0.05))
        const k1 = P1.k
        const x = P1.x
        const y = P1.y
        if (x < -200 || x > vw + 200 || y < -200 || y > vh + 200) continue
        /* อักขระใหญ่เต็มช่อง (เนื้อคำแน่นเหมือนตัวทึบ) · ยิ่งเข้าใกล้กล้องยิ่งใหญ่ตามระยะจริง */
        const size = DIS_CELL * sx * 1.35 * k1
        /* ถอดรหัส: สลับตัววิบวับรอบระดับความทึบของช่อง · พุ่งออกแล้วไล่บันไดลง */
        const base = c * (DIS_RAMP.length - 1) * (1 - p * 0.7)
        const jit = (dhash(id, fstep) - 0.5) * 3 * (0.3 + p)
        const lvl = Math.max(1, Math.min(DIS_RAMP.length - 1, Math.round(base + jit)))
        /* ใกล้มากจนเกือบชนกล้อง = จางหาย (ไม่ให้ตัวยักษ์บังจอ) · ไกลเข้าไปในจอ = หรี่ตามระยะ (หมอกลึก) */
        /* ไม่จางเร็ว: ใหญ่ขึ้นเรื่อย ๆ จนเกือบชนกล้องค่อยจาง (ระยะใกล้มาก ๆ) — ช่วงท้ายสุดของการพุ่งเท่านั้น */
        const a = appear * wipe * (1 - smooth((k1 - 9) / 6)) * (1 - smooth((p - 0.9) / 0.1)) * (0.6 + 0.4 * c)
        if (a < 0.01) continue
        const near = Math.max(0, Math.min(1, (k1 - 1) / 4))
        const rgb = `${Math.round(255 - 45 * near)},${Math.round(255 - 75 * near)},255`
        /* หางความเร็ว: จากตำแหน่งเมื่อครู่มาถึงตอนนี้ — ยาวขึ้นตามความเร็วเข้าหากล้อง */
        if (Math.abs(k1 - P0.k) > 0.05) {
          g.strokeStyle = `rgba(${rgb},${(a * 0.35).toFixed(3)})`
          g.lineWidth = Math.max(1, size * 0.08)
          g.beginPath()
          g.moveTo(P0.x, P0.y)
          g.lineTo(x, y)
          g.stroke()
        }
        /*
         * ประสิทธิภาพ: ไม่ใช้ shadowBlur (เบลอต่อตัว ตัวยิ่งใหญ่ยิ่งแพง — ช่วงพุ่งเข้ากล้องเฟรมละหลายร้อย ms)
         * ขนาดปัดเป็นขั้น (ใหญ่ = ขั้นห่างขึ้น) แล้วตั้ง font เฉพาะตอนเปลี่ยน — แคชตัวอักษรของเบราว์เซอร์ใช้ซ้ำได้
         */
        const fs = size < 24 ? Math.round(size) : size < 80 ? Math.round(size / 4) * 4 : Math.round(size / 16) * 16
        if (fs !== lastFs) {
          g.font = `700 ${fs}px ui-monospace, SFMono-Regular, Menlo, monospace`
          lastFs = fs
        }
        g.fillStyle = `rgba(${rgb},${a.toFixed(3)})`
        g.fillText(DIS_RAMP[lvl], x, y)
      }
    /* รูตามกรอบเครื่อง เจาะในแคนวาสเอง — ไม่ใช้ clip-path บนชั้นแคนวาสเต็มจอ (เปลี่ยนทุกเฟรม = repaint ทั้งจอ หน่วงหนัก) */
    if (devScreen.ok && devScreen.hw > 1) {
      const { cx, cy, hw, hh } = devScreen
      g.globalCompositeOperation = 'destination-out'
      g.beginPath()
      g.roundRect(cx - hw, cy - hh - liftNow.current, hw * 2, hh * 2, Math.min(devScreen.r, hw, hh))
      g.fill()
      g.globalCompositeOperation = 'source-over'
    }
  }, [])

  /* รูของคำใหญ่ตามกรอบเครื่องทุกเฟรม (เครื่องขยับเองตามเวลาด้วย — อ่านตอนเลื่อนอย่างเดียวไม่พอ) */
  /* รูของคำใหญ่ตามกรอบเครื่อง — คำนวณในเฟรมเดียวกับที่เครื่องได้ท่าใหม่ (devHook) */
  useEffect(() => {
    devHook.fn = () => {
      if (!frame.current.on) return
      /* เจาะรูคำใหญ่ตามกรอบเครื่องทุกเฟรม (เครื่องขยับเองตามเวลา ไม่ใช่แค่ตอนเลื่อน) */
      const bs = wordsClip.current
      if (bs) {
        if (devScreen.ok && devScreen.hw > 1) {
          const { cx, cy, hw, hh } = devScreen
          const r = Math.min(devScreen.r, hw, hh)
          const x0 = cx - hw
          const y0 = cy - hh - liftNow.current
          const w = hw * 2
          const h = hh * 2
          const hole = `M${(x0 + r).toFixed(1)} ${y0.toFixed(1)}h${(w - 2 * r).toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${r.toFixed(1)} ${r.toFixed(1)}v${(h - 2 * r).toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 -${r.toFixed(1)} ${r.toFixed(1)}h-${(w - 2 * r).toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 -${r.toFixed(1)} -${r.toFixed(1)}v-${(h - 2 * r).toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${r.toFixed(1)} -${r.toFixed(1)}z`
          bs.style.clipPath = `path(evenodd, "M0 0H${innerWidth}V${innerHeight}H0Z ${hole}")`
        } else bs.style.clipPath = ''
      }
    }
    return () => {
      devHook.fn = null
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      drawDissolve(now / 1000)
      const vw = window.innerWidth
      const vh = window.innerHeight || 1
    const ww = worksWord.current
    if (ww) {
      /* ผังตัวอักษรบนจอ (px) — ตัวอักษร 3D จากป้ายในวิดเจ็ตลงจอดตรงนี้ · วัดใหม่เมื่อขนาดจอเปลี่ยน */
      const ly = worksWordLayout
      if (!ly.ok || wwSize.current !== `${vw}x${vh}`) {
        const spans = [...ww.querySelectorAll<HTMLSpanElement>('[data-l]')]
        const font = parseFloat(getComputedStyle(ww).fontSize)
        if (font > 0 && ww.offsetWidth > 0) {
          ly.font = font
          ly.ox = spans.map((sp) => sp.offsetLeft)
          ly.left = vw / 2 - ww.offsetWidth / 2
          ly.cy = vh / 2
          ly.ok = true
          wwSize.current = `${vw}x${vh}`
        }
      }
      /* รับช่วงต่อจากตัวอักษร 3D ตอนวิดเจ็ตฟ้าจางหมด (ตำแหน่ง/ขนาดเดียวกัน) · ออกตอนเล่มระเบิด (ขยายนิด + จาง) */
      /* ค่าหน่วงเดียวกับฝั่ง 3D (BenchScreen) — ส่งต่อตรงจังหวะ · ทำทุกเฟรม (ค่าหน่วงยังไหลหลังหยุดสกรอลล์) */
      const wp = worksPostSm.v
      /* ขึ้นเต็มทันทีข้างใต้ตัวอักษร 3D (ซึ่งค่อยจางทับ) — จางสวนกันจะซีดกลางทาง */
      const inW = wp >= WORKS_HAND[0] ? 1 : 0
      const outW = smooth((wp - 0.5) / 0.16)
      const vw2 = frame.current.on ? inW * (1 - outW) : 0
      ww.style.visibility = vw2 > 0.002 ? 'visible' : 'hidden'
      ww.style.opacity = vw2.toFixed(3)
      ww.style.transform = `translate(-50%, -50%) scale(${(1 + outW * 0.08).toFixed(4)})`
    }
    /* ── ปุ่มไทล์งาน (DOM ทับตำแหน่งไทล์ 3D) — กดได้เฉพาะช่วงค้าง ── */
    const tb = tilesBox.current
    if (tb) {
      const hold = frame.current.on && worksUI.hold === 1
      tb.style.visibility = hold ? 'visible' : 'hidden'
      if (hold) {
        tileBtns.current.forEach((el, n) => {
          if (!el) return
          const r = slotRect(n, vw, vh)
          el.style.width = `${r.w.toFixed(1)}px`
          el.style.height = `${r.h.toFixed(1)}px`
          el.style.transform = `translate(${(r.cx - r.w / 2).toFixed(1)}px, ${(r.cy - r.h / 2).toFixed(1)}px) rotate(${r.rot}deg)`
        })
      }
      if (!hold && openTile !== -1) setOpenTile(-1)
    }
    /* ── beat ระเบิดของเล่มงาน: ค่าหน่วงเดียวกับเล่ม (worksPostSm) ── */
    const bu = burst.current
    if (bu) {
      const wpB = worksPostSm.v
      const bk = clamp01((wpB - WORKS_BOOM[0]) / WORKS_BOOM[1])
      /* ค้างตลอด section (ช่วงค้าง) · ออกท้ายบท พร้อมไทล์ */
      const exB = smooth((wpB - WORKS_HOLD[1]) / (WORKS_HOLD[2] - WORKS_HOLD[1]))
      const onB = frame.current.on && bk > 0 && exB < 1
      bu.style.visibility = onB ? 'visible' : 'hidden'
      if (onB) {
        const oc = (x: number) => 1 - Math.pow(1 - clamp01(x), 3)
        /* พื้นเหลืองวาบขึ้นเร็ว ค้าง แล้วจางกลับเป็นฟ้าช่วงท้าย */
        const bgA = smooth(bk / 0.1) * (1 - exB)
        bu.style.opacity = bgA.toFixed(3)
        const gl = burstGlow.current
        if (gl) gl.style.transform = `translate(-50%, -50%) scale(${(0.2 + 0.9 * oc(bk / 0.35)).toFixed(3)})`
        burstG.current?.setAttribute('transform', `translate(${(vw / 2).toFixed(1)} ${(vh / 2).toFixed(1)}) rotate(${(bk * 10).toFixed(2)})`)
        const diag = Math.hypot(vw, vh)
        const grow = oc((bk - 0.03) / 0.4)
        BURST_RAYS.forEach(([a, l, w], n) => {
          const el = rayRefs.current[n]
          if (!el) return
          const L = Math.max(1, grow * l * diag * 0.62)
          const r0 = L * 0.06
          el.setAttribute('points', `${r0.toFixed(1)},-1 ${L.toFixed(1)},${(-w * 2.2).toFixed(1)} ${L.toFixed(1)},${(w * 2.2).toFixed(1)} ${r0.toFixed(1)},1`)
          el.setAttribute('transform', `rotate(${a})`)
        })
        const vmin = Math.min(vw, vh)
        BURST_X.forEach(([a, d, r], n) => {
          const el = xRefs.current[n]
          if (!el) return
          const k = oc((bk - 0.05 - n * 0.03) / 0.6)
          const rr = (d * vmin + 40) * k
          const ar = (a * Math.PI) / 180
          el.setAttribute('transform', `translate(${(Math.cos(ar) * rr).toFixed(1)} ${(Math.sin(ar) * rr).toFixed(1)}) rotate(${(-bk * 40).toFixed(1)}) scale(${(r * (0.4 + 0.6 * k)).toFixed(2)})`)
        })
      }
    }
      if (!frame.current.on) return
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const chips = useRef<(HTMLSpanElement | null)[]>([])
  const bodies = useRef<(HTMLParagraphElement | null)[]>([])

  useEffect(() => {
    let raf = 0
    let was = false
    const read = () => {
      raf = 0
      const story = document.getElementById('what-i-do')
      if (!story) return
      const vw = window.innerWidth
      const vh = window.innerHeight || 1
      const sr = story.getBoundingClientRect()
      const b = workBeats(storySv2(Math.max(0, -sr.top / vh)))
      const next = document.getElementById(NEXT_ID)
      const glue = next ? next.getBoundingClientRect().top : vh
      const hand = clamp01(-glue / (vh * 0.12))
      const lift = Math.min(0, glue - vh)
      /* เปิดตั้งแต่ฟองเริ่มหงาย (ฟ้าร่วง · การ์ดค้นคว้ารอบแท่น) */
      const live = b.lift > 0 && hand < 1 && sr.bottom > 0
      frame.current.b = b
      frame.current.on = live
      /* ทั้งชั้นเลื่อนขึ้นด้วย CSS ตอนจอถัดไปดันขึ้นมาแล้ว — ฟ้าไม่ต้องยกเอง (lift 0) */
      const fp = fall.current
      fp.on = live
      fp.iso = smooth((b.sv2 - FALL_FROM) / 0.4)
      fp.fall = Math.max(0, b.sv2 - FALL_FROM)
      fp.prog = clamp01((b.sv2 - FALL_FROM) / (FALL_TO - FALL_FROM))
      if (live !== was) {
        was = live
        setOn(live)
      }
      if (layer.current) layer.current.style.transform = lift ? `translate3d(0, ${lift.toFixed(1)}px, 0)` : ''

      /* ── บท Code: ฉากมืดลง (ทับฟ้ากับเมฆ) แสงออร่าม่วงที่ขอบบนกับขอบล่างของเครื่อง · กลับสว่างตอนจบบท ── */
      const dk = dark.current
      if (dk) {
        /*
         * เข้า: มืดลงนุ่ม ๆ · ออก (กลับเป็นฟ้า): ไม่จางทั้งแผ่น — เจาะรูทรงอินทรีย์ขอบนุ่มบานออกจากกลางเครื่อง
         * ท่าเดียวกับด่านโหลด 3 จุดที่เผยฟ้า (components/BlobReveal ขั้นที่ 1) · รู = วงกลมขอบนุ่มหลายวงรอบจุดกลาง
         * รัศมี/ตำแหน่งแกว่งไม่เท่ากัน รวมกันด้วย mask-composite (ด้านนอกทุกวงเท่านั้นที่ยังมืด) จึงได้ขอบหยักเคลื่อนไหว
         */
        const kin = live ? smooth(b.code / 0.1) : 0
        const q = smooth((b.code - DARK_OUT) / (1 - DARK_OUT))
        const show = kin > 0.002 && q < 0.999 && b.code < 1
        dk.style.visibility = show ? 'visible' : 'hidden'
        if (show) {
          dk.style.opacity = kin.toFixed(3)
          if (q > 0.001) {
            const ox = devScreen.ok ? devScreen.cx : vw / 2
            const oy = devScreen.ok ? devScreen.cy - lift : vh / 2
            const diag = Math.hypot(vw, vh)
            const R = q * q * diag * 1.35
            const soft = 50 + R * 0.18
            const layers: string[] = []
            for (let i = 0; i < 7; i++) {
              const a = (i / 7) * Math.PI * 2 + q * 1.3
              const off = R * (0.22 + 0.08 * Math.sin(i * 1.7 + q * 4))
              const ri = R * (0.72 + 0.2 * Math.sin(i * 2.3 + q * 5.2))
              layers.push(`radial-gradient(circle at ${(ox + Math.cos(a) * off).toFixed(1)}px ${(oy + Math.sin(a) * off).toFixed(1)}px, transparent ${ri.toFixed(1)}px, #000 ${(ri + soft).toFixed(1)}px)`)
            }
            const m = layers.join(',')
            dk.style.maskImage = m
            dk.style.webkitMaskImage = m
            dk.style.maskComposite = 'intersect'
            ;(dk.style as CSSStyleDeclaration & { webkitMaskComposite: string }).webkitMaskComposite = 'source-in'
          } else if (dk.style.maskImage) {
            dk.style.maskImage = ''
            dk.style.webkitMaskImage = ''
          }
        }
      }

      /* ── คำใหญ่พื้นหลังของบท (Research / Design / Code) ── */
      liftNow.current = lift
      SKILL_WORDS.forEach((sw, i) => {
        const el = bigWords.current[i]
        const ln = bigLines.current[i]
        if (!el || !ln) return
        const k = b[sw.key]
        /* Research ขึ้นตั้งแต่ island งอกเสร็จบนฟอง (ก่อนเครื่องมา) ค้างยาวจนจบบท study */
        const inK = sw.key === 'study' ? smooth((b.sv2 - (ISLAND.grow[0] + ISLAND.grow[1] - 0.05)) / 0.3) : smooth(k / 0.16)
        const outK = smooth((k - 0.86) / 0.14)
        /* Code ออกแบบสลายเป็น ASCII: ตัวทึบ/เส้นขอบจางเร็วตอนเริ่มสลาย อักขระรับช่วงต่อ (ดู dissolve ด้านล่าง) */
        const dis = sw.key === 'code' ? clamp01((k - DIS_FROM) / DIS_LEN) : 0
        /*
         * Code: ตัวทึบส่งต่อให้แคนวาสสลาย — การซ่อนตัว DOM ทำในเฟรมเดียวกับที่แคนวาสวาดตัวทึบแทน (drawDissolve)
         * ถ้าซ่อนตรงนี้ (ตอนเลื่อน) จะมีเฟรมที่ตัว DOM หายแล้วแคนวาสยังไม่วาด = คำกระพริบดำ
         */
        const fade = sw.key === 'code' ? (dis >= 0.999 ? 1 : 0) : outK
        /* เส้นขอบ (ตรงที่เครื่องบัง) จางตามช่วงสลาย ไม่หายวาบ */
        const lineFade = sw.key === 'code' ? smooth(dis / 0.16) : fade
        const on = live && (sw.key === 'study' ? inK > 0 && k < 1 : k > 0 && k < 1)
        const v = on ? inK * (1 - fade) : 0
        const vl = on ? inK * (1 - lineFade) : 0
        el.style.visibility = v > 0.002 ? 'visible' : 'hidden'
        ln.style.visibility = vl > 0.002 ? 'visible' : 'hidden'
        /* ตั้งตำแหน่งเสมอแม้ซ่อน — แคนวาสสลายของ Code วัดกล่องคำนี้ (ถ้าข้าม ตอนเปิดหน้ากลางบทกล่องค้างผิดที่) */
        const tf = `translate(-50%, -50%) translate3d(0, ${((1 - inK) * 6).toFixed(2)}vh, 0) scale(${(1 + (sw.key === 'code' ? 0 : outK) * 0.06).toFixed(4)})`
        el.style.transform = tf
        ln.style.transform = tf
        const bl = inK < 0.999 ? `blur(${((1 - inK) * 14).toFixed(1)}px)` : ''
        el.style.opacity = v.toFixed(3)
        ln.style.opacity = vl.toFixed(3)
        el.style.filter = bl
        ln.style.filter = bl
      })
      /*
       * ── คำพื้นหลัง My Works: ขึ้นตอนเล่มงานเริ่มคลี่ (ลอยขึ้น + เบลอหาย แบบคำบทอื่น) ค้างระหว่างคลี่/ซูม
       *    ออกตอนเล่มระเบิด (ขยายนิด + จาง) — ช่วงเดียวกับ worksPost ใน BenchScreen
       */
      /* ── ป้ายขั้นตอนใต้หัวเรื่อง: เผยจากล่างขึ้นบนพร้อมเครื่องตั้งตรง · ขั้นที่กำลังทำติดไฟ ── */
      const st = steps.current
      if (st) {
        const hp = headPose(vw, vh)
        const tall = isTall(vw, vh)
        /* ป้ายขั้นตอนซ่อนไว้ — คำใหญ่พื้นหลังทีละบทเล่าแทนแล้ว (เครื่องอยู่กลางจอ) */
        const k: number = 0
        st.style.visibility = k > 0.001 ? 'visible' : 'hidden'
        st.style.left = `${(vw / 2 + hp.x).toFixed(1)}px`
        /* ใต้ก้อนหัวเรื่อง (สองบรรทัด + ไอคอน — สูงราว 18% ของจอ) */
        /* หัวเรื่องลงไปเป็น wireframe ในจอแล้ว — ป้ายขึ้นมาอยู่ที่ของหัวเรื่องแทน */
        st.style.top = `${(vh / 2 + hp.y + vh * (tall ? 0.02 : 0.04)).toFixed(1)}px`
        st.style.clipPath = `inset(${((1 - k) * 100).toFixed(1)}% 0 0 0)`
        const ks = [b.study, b.design, b.code, b.ship]
        /* ขั้นปัจจุบัน = ขั้นท้ายสุดที่เริ่มแล้ว */
        let cur = -1
        ks.forEach((x, i) => {
          if (x > 0) cur = i
        })
        chips.current.forEach((c, i) => {
          if (!c) return
          c.dataset.on = String(i === cur)
          c.dataset.done = String(i < cur)
        })
        bodies.current.forEach((p, i) => {
          if (!p) return
          const v = i === cur ? smooth((ks[i] - 0.05) / 0.15) : 0
          p.style.visibility = v > 0.001 ? 'visible' : 'hidden'
          p.style.clipPath = `inset(${((1 - v) * 100).toFixed(1)}% 0 0 0)`
        })
      }
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
    }
  }, [])

  return (
    <>
      <div ref={layer} className="pointer-events-none fixed inset-0 z-[51]" style={{ visibility: on ? 'visible' : 'hidden' }} aria-hidden>
        {/* ฉากหลัง: ร่วงลงจากฟ้า — แคนวาสออร์โธของตัวเอง ใต้ของบนจอ (ฉากเดิมของเวทีไอโซ เอากลับมาใช้) */}
        <Canvas
          className="!absolute inset-0"
          frameloop="demand"
          dpr={[1, 1.5]}
          orthographic
          camera={{ position: [0, 0, 2400], zoom: 1, near: 1, far: 8000 }}
          gl={{ antialias: false, alpha: true }}
          style={{ pointerEvents: 'none' }}
        >
          <WarmShaders />
          {/* frameloop demand: ต้องปลุกเอง — ไม่งั้นรอบแรกที่เปิด useFrame ของฟ้าไม่ได้วิ่ง เมฆไม่ขึ้น */}
          <Pump frame={frame} />
          <FallSky pose={fall} />
        </Canvas>
        {/* บท Code: ดำ + แสงม่วงจากมุมล่าง + สัญลักษณ์ ASCII — เหนือฟ้า ใต้คำใหญ่กับเครื่อง */}
        <div
          ref={dark}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            visibility: 'hidden',
            background:
              'radial-gradient(70% 62% at 96% 104%, rgba(255,236,255,0.95), rgba(226,150,240,0.75) 28%, rgba(170,90,220,0.35) 55%, rgba(0,0,0,0) 78%), radial-gradient(62% 58% at 6% 100%, rgba(200,160,255,0.85), rgba(110,60,240,0.7) 30%, rgba(60,30,170,0.3) 58%, rgba(0,0,0,0) 80%), #000',
          }}
          aria-hidden
        >
          {/* หยุดวาดเองตอนชั้นนี้ซ่อน (นอกบท Code) */}
          <AsciiClouds blobs={CODE_CLOUDS} mask={CODE_CLOUD_MASK} rgb="214,190,255" alpha={[0.14, 0.5]} />
        </div>
        {/* คำใหญ่ของแต่ละบท (ตัวทึบ) — เหนือฟ้า ใต้ของบนจอ · เจาะรูตามกรอบเครื่อง: ในกรอบเครื่องเหลือแต่เส้นขอบ */}
        {/* beat ระเบิดของเล่มงาน — เหนือฟ้า ใต้เล่มกระดาษ (แคนวาสของบนจอ) */}
        <div ref={burst} className="pointer-events-none absolute inset-0 overflow-hidden" style={{ visibility: 'hidden', background: '#f9e000' }} aria-hidden>
          <div
            ref={burstGlow}
            className="absolute top-1/2 left-1/2 size-[110vmax] rounded-full"
            style={{ background: 'radial-gradient(circle, #fffef6 0%, #fffbd6 9%, rgba(255,248,170,0.7) 20%, rgba(253,232,40,0) 46%)' }}
          />
          <svg className="absolute inset-0 size-full overflow-visible">
            <g ref={burstG}>
              {BURST_RAYS.map((_, n) => (
                <polygon
                  key={n}
                  ref={(el) => {
                    rayRefs.current[n] = el
                  }}
                  fill="#f7f2e3"
                  stroke="#1c1820"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              ))}
              {BURST_X.map((_, n) => (
                <g
                  key={`x${n}`}
                  ref={(el) => {
                    xRefs.current[n] = el
                  }}
                >
                  <circle r={1} fill="#f7f2e3" stroke="#1c1820" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  <path d="M-0.42 -0.42L0.42 0.42M0.42 -0.42L-0.42 0.42" stroke="#1c1820" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </g>
          </svg>
          <div className="absolute inset-0 mix-blend-multiply" style={{ backgroundImage: grain ? `url(${grain})` : undefined, opacity: 0.16 }} />
        </div>
        <div ref={bigSolid} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <canvas ref={disCanvas} className="absolute inset-0 size-full" />
        <div ref={wordsClip} className="absolute inset-0">
        {SKILL_WORDS.map((sw, i) => (
          <div
            key={sw.key}
            ref={(el) => {
              bigWords.current[i] = el
            }}
            className="absolute top-[28%] left-1/2 text-[clamp(110px,23vw,420px)] leading-none font-bold tracking-[-0.055em] whitespace-nowrap text-white will-change-[transform,opacity,filter]"
            style={{ visibility: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Helvetica Neue", sans-serif' }}
            aria-hidden
          >
            {sw.w}
          </div>
        ))}
        </div>
        <div
          ref={worksWord}
          className="absolute top-1/2 left-1/2 text-[clamp(90px,17vw,320px)] leading-none font-bold tracking-[-0.055em] whitespace-nowrap text-white will-change-[transform,opacity]"
          style={{ visibility: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Helvetica Neue", sans-serif' }}
        >
          {[...WORKS_TEXT].map((ch, n) => (ch === ' ' ? ' ' : <span key={n} data-l>{ch}</span>))}
        </div>
        </div>
        <Canvas className="!absolute inset-0" frameloop="never" dpr={[1, 1.75]} camera={{ fov: FOV, position: [0, 0, 1700] }} gl={{ antialias: true, alpha: true }} style={{ pointerEvents: 'none' }}
          /* ขาวต้องเป็นขาว: ตัวแมปโทนตั้งต้น (ACES) กดขาวลงเป็นเทาหม่น */
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping
          }}
        >
          <Rig />
          <TickPump frame={frame} />
          <Suspense fallback={null}>
            <WarmShaders />
            <StageLight gain={1} />
            {/* หน่วยไฟของ three เป็นแบบกายภาพ — ค่าราว 1 ได้ขาวหม่นเทา วิดเจ็ตพาสเทลต้องสว่างกว่านั้น */}
            <hemisphereLight args={['#ffffff', '#dfe4ee', 2.2]} />
            <directionalLight position={[-500, 700, 1000]} intensity={2.6} />
            <DeviceHalo />
            <BenchScreen frame={frame} />
          </Suspense>
        </Canvas>
        {/* คำใหญ่ชั้นเส้นขอบ — เหนือ widget/island บนจอเครื่อง แต่ใต้ตัวเครื่องแก้ว (แคนวาสของฟอง) — คำจึงอยู่หลังเครื่องเสมอ
            ตรงที่ของบนจอบังตัวทึบ ยังเห็นรูปตัวอักษรเป็นเส้นขอบ */}
        {/*
         * เส้นขอบจากรูปทรงจริงของตัวอักษร: ตัวทึบ → ขยายออก 2 px → ลบตัวเดิมออก = เหลือขอบนอก
         * ไม่ใช้ -webkit-text-stroke — ฟอนต์ระบบมีเส้นโครงซ้อนกันข้างในตัวอักษร (เช่นขีดกลางตัว e) stroke จะวาดเส้นโครงในพวกนั้นด้วย
         */}
        <svg className="absolute size-0" aria-hidden>
          <filter id="ws-word-outline" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="grow" />
            <feComposite in="grow" in2="SourceAlpha" operator="out" result="ring" />
            <feFlood floodColor="#ffffff" floodOpacity="0.9" />
            <feComposite in2="ring" operator="in" />
          </filter>
        </svg>
        <div ref={bigFront} className="pointer-events-none absolute inset-0 overflow-hidden" style={{ filter: 'url(#ws-word-outline)' }} aria-hidden>
          {SKILL_WORDS.map((sw, i) => (
            <div
              key={sw.key}
              ref={(el) => {
                bigLines.current[i] = el
              }}
              className="absolute top-[28%] left-1/2 text-[clamp(110px,23vw,420px)] leading-none font-bold tracking-[-0.055em] whitespace-nowrap text-white will-change-[transform,opacity,filter]"
              style={{ visibility: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Helvetica Neue", sans-serif' }}
            >
              {sw.w}
            </div>
          ))}
        </div>
      </div>
      {/*
       * section My Works: ปุ่มไทล์งานทับตำแหน่งไทล์ 3D (ช่อง TILE_SLOTS) — hover ยกไทล์ · คลิกเปิดเต็มจอ
       * เปิดแล้ว: แผงรายละเอียด (ยังไม่มีเนื้อหางาน — บล็อกเทาว่างตามที่ตั้งไว้) + ปุ่มปิด · Esc / เลื่อนจอ = ปิด
       */}
      <div ref={tilesBox} className="pointer-events-none fixed inset-0 z-[52]" style={{ visibility: 'hidden' }}>
        {openTile < 0 &&
          TILE_SLOTS.map((_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`เปิดผลงานที่ ${n + 1}`}
              ref={(el) => {
                tileBtns.current[n] = el
              }}
              className="pointer-events-auto absolute top-0 left-0 cursor-pointer rounded-[14px] outline-none focus-visible:ring-4 focus-visible:ring-black/40"
              onPointerEnter={() => {
                worksUI.hover = n
              }}
              onPointerLeave={() => {
                if (worksUI.hover === n) worksUI.hover = -1
              }}
              onClick={() => {
                worksUI.hover = -1
                setOpenTile(n)
              }}
            />
          ))}
        {openTile >= 0 && (
          <div className="pointer-events-auto absolute top-[6vh] left-[4vw] h-[88vh] w-[92vw] animate-[ws-detail-in_0.35s_ease-out_0.3s_both] p-[min(5vw,56px)]">
            <button
              type="button"
              aria-label="ปิด"
              className="absolute top-5 right-5 grid size-12 cursor-pointer place-items-center rounded-full border-2 border-[#1c1820] bg-[#f7f2e3] text-[#1c1820]"
              onClick={() => setOpenTile(-1)}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <div className="flex h-full flex-col gap-[3vh]">
              <div className="h-[6vh] w-[38%] rounded-full bg-white/35" />
              <div className="h-[2.4vh] w-[24%] rounded-full bg-white/25" />
              <div className="min-h-0 flex-1 rounded-[22px] bg-white/20" />
            </div>
          </div>
        )}
      </div>
      {/* ป้ายขั้นตอนใต้หัวเรื่อง — เหนือเครื่อง ใต้เคอร์เซอร์ */}
      <div
        ref={steps}
        className="pointer-events-none fixed z-[53] w-[min(86vw,420px)] -translate-x-1/2 text-center text-white"
        style={{ visibility: 'hidden' }}
        aria-hidden
      >
        <div className="flex flex-wrap justify-center gap-2">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              ref={(el) => {
                chips.current[i] = el
              }}
              className="rounded-full border border-white/40 px-3.5 py-1.5 font-mono text-[11px] tracking-[0.18em] text-white/70 uppercase transition-colors duration-300 data-[done=true]:text-white/90 data-[on=true]:border-white data-[on=true]:bg-white data-[on=true]:text-[#2052cd]"
            >
              {s.label}
            </span>
          ))}
        </div>
        {/* คำอธิบายซ้อนกันที่เดียว (absolute) — กล่องต้องสูงพอ ไม่งั้นถูกตัดด้วยกรอบเผยของกล่องนอก */}
        <div className="relative mt-5 min-h-[7rem]">
          {STEPS.map((s, i) =>
            s.body ? (
              <p
                key={s.key}
                ref={(el) => {
                  bodies.current[i] = el
                }}
                className="absolute inset-x-0 top-0 mx-auto max-w-[32ch] text-[clamp(15px,1.2vw,18px)] leading-[1.5] text-white/90 [text-shadow:0_1px_12px_rgba(20,60,160,0.45)]"
                style={{ visibility: 'hidden' }}
              >
                {s.body}
              </p>
            ) : null,
          )}
        </div>
      </div>
    </>
  )
}
