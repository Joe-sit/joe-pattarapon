import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { buildToonHand } from '@/joespresso/scene/toonHand'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { buildMedia, type MediaKind } from './media'
import { SkillProps } from './skillProps'
import cursorSvg from '@/assets/v2/skills-cursor.svg?raw'
import pencilSvg from '@/assets/v2/skills-pencil.svg?raw'
import promptSvg from '@/assets/v2/prompt-mark.svg?raw'

/**
 * ฉาก "มือชูจอ" — วางองค์ประกอบตามภาพอ้างอิง: มือการ์ตูนโผล่จากขอบล่าง หงายมือชูจอ CRT
 * ขึ้นกลางจอ รอบ ๆ มีสติกเกอร์ 3D ลอย ฐานเป็นเมฆ พื้นหลังรัศมีฟ้า (CSS ดู ./HandCompose)
 *
 * ข้อความบนสติกเกอร์ทุกใบมาจากเนื้อหาจริงของเว็บ (สกิลสามอย่างของ what-i-do บริษัทที่
 * ทำงาน ตำแหน่ง ชื่อ) — ไม่แต่งป้ายขึ้นมาเอง
 *
 * มือใช้ `buildToonHand` ตัวเดียวกับตัวละคร (ท่า 'hold') หน่วยของฉาก = หน่วยโลก ไม่อิง
 * ขนาดตัวละคร
 */

const CREAM = '#f3ece0'
const CREAM_D = '#e4d9c7'
const BLUE = '#2856d6'
const BLUE_L = '#c4d6f6'
const INK = '#1d3a9e'
const SKIN = '#f6bb9f'
const FONT = "'Momo Trust Display', 'Mona Sans', system-ui, sans-serif"

/** แคนวาสเป็นเท็กซ์เจอร์ — วาดซ้ำเมื่อฟอนต์โหลดเสร็จ (รอบแรกอาจยังเป็นฟอนต์สำรอง) */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  const paint = () => {
    const g = c.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, w, h)
    draw(g, w, h)
    t.needsUpdate = true
  }
  paint()
  document.fonts?.load(`64px ${FONT}`).then(paint, () => {})
  return t
}

/** ประกายสี่แฉก (ดาวเว้า) — ใช้ทั้งบนแคนวาสและเป็นรูปทรงของดาว 3D */
function sparklePath(p: { moveTo: (x: number, y: number) => void; quadraticCurveTo: (a: number, b: number, c: number, d: number) => void }, cx: number, cy: number, r: number) {
  p.moveTo(cx, cy + r)
  p.quadraticCurveTo(cx, cy, cx + r, cy)
  p.quadraticCurveTo(cx, cy, cx, cy - r)
  p.quadraticCurveTo(cx, cy, cx - r, cy)
  p.quadraticCurveTo(cx, cy, cx, cy + r)
}

/**
 * ระนาบตัดสี่ด้านตามขอบในของกรอบ portal (อัปเดตทุกเฟรมใน HandScene) — วัสดุที่ต้องอยู่ในกรอบ
 * (แขน เมฆ) อ้างอาร์เรย์นี้ ของที่ควรล้นกรอบ (SkillProps) ไม่อ้าง
 */
const FRAME_PLANES = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane()]

/** ทิ้ง geometry/texture ของคอมโพเนนต์เมื่อถอดออกจากจอ */
function useDispose(list: { dispose: () => void }[]) {
  useEffect(() => () => list.forEach((x) => x.dispose()), [list])
}

/* ---------------------------------------------------------------- จังหวะเปิดตัว */

/**
 * นาฬิกาของจังหวะเปิดตัว (วินาทีนับจากที่ section เข้าจอ) — ตัวฉากเดินนาฬิกานี้เอง ชิ้นส่วนแต่ละชิ้น
 * อ่านค่าไปคิดท่าของตัวเองในลูปเฟรม ไม่มี setState ต่อเฟรม
 *
 * `on` ถูกเปิด/ปิดจากข้างนอก (IntersectionObserver ของ section) — ออกจากจอแล้วนาฬิการีเซ็ต
 * กลับมาใหม่ก็เล่นใหม่
 */
export type Appear = {
  /** ถึงคิวซูมออกแล้ว (จังหวะเปิดตัวของฉากเริ่มเดิน) */
  on: boolean
  /** วินาทีนับจากเริ่มซูมออก — สติกเกอร์ เมฆ ป้าย ใช้คิวนี้ */
  t: number
  /** ความคืบหน้าการเลื่อนของ section 0..1 (เรื่องเล่าบนจอ + การซูม) */
  p: number
  /** วินาทีนับจากที่ section ถึงขอบบนจอ — จอ CRT เปิดเครื่องด้วยนาฬิกานี้ (-1 = ยังไม่ถึง) */
  boot: number
  /** p ที่หน่วงแล้ว (ตัวฉากเขียน) — ทุกชิ้นอ่านค่านี้ ล้อเลื่อนกระตุกเป็นขั้นแต่ภาพไหล */
  q: number
  /** วินาทีนับจากที่ขอบบน section ถึงขอบจอ — มือชูจอพุ่งขึ้นเข้าฉากด้วยนาฬิกานี้ (-1 = ยังไม่ถึง) */
  rise: number
}

/**
 * กางของรอบ ๆ ออกและย่อลงเมื่อบทสกิลเริ่ม ให้ที่ว่างกับสื่อที่ลอยโชว์และหัวข้อ — ไม่กลับมาอีก
 * ฉากจบมีของชุดใหม่ (SkillProps) มาแทน
 */
const spreadAt = (q: number) => span(q, ZOOM_END, CH_START - ZOOM_END)

/**
 * เรื่องเล่าบนจอ CRT — ช่วงแรกของ section กล้องจ่ออยู่ที่จอ แต่ละบรรทัดพิมพ์ขึ้นตามระยะเลื่อน
 * (ชื่อกับตำแหน่งจริงของเจ้าของเว็บ) สกิลไม่ได้เล่าบนจอตรงนี้ — แต่ละสกิลมีบทของตัวเองข้างล่าง
 */
const STORY: { title: string; sub?: string }[] = [{ title: "HELLO, I'M JOE" }, { title: 'UX/UI DESIGNER' }]

/**
 * บทของสกิล — สกิลละหนึ่งสื่อบันทึกข้อมูล ลอยเข้ามาโชว์ข้างจอ (สลับซ้าย/ขวา หัวข้อขึ้นอีกข้าง)
 * แล้วบินเข้าไปเสียบช่องบนคางจอ CRT จอจึงขึ้นสกิลนั้น
 *
 * หัวข้อ สี คำอธิบาย มาจาก SKILLS ของ what-i-do ชุดเดียวกับทั้งเว็บ (ลำดับเล่าเดียวกัน:
 * Research → Design → Coding) — Research ยังไม่มีคำอธิบายจริง จึงขึ้นแค่หัวข้อ
 */
const pick = (title: string) => SKILLS.find((k) => k.title === title)
/**
 * `side` = ฝั่งที่ทั้งฉาก 3D (มือชูจอ + สื่อ) เลื่อนไปอยู่ในบทนั้น — ข้อความอยู่อีกครึ่งจอ
 * `drive` = ชื่อสื่อบนจอตอนรอเสียบ (ชื่อชนิดสื่อ ไม่ใช่ข้อมูลของใคร)
 */
export const CHAPTERS: { title: string; color: string; sub?: string; media: MediaKind; drive: string; side: 1 | -1 }[] = [
  { title: 'Research', color: pick('Research')?.color ?? '#158ffc', media: 'cd', drive: 'CD-ROM', side: 1 },
  { title: 'Design', color: pick('Design')?.color ?? '#fd5000', sub: pick('Design')?.desc, media: 'floppy', drive: 'FLOPPY', side: -1 },
  { title: 'Coding', color: pick('Coding')?.color ?? '#ad85fe', sub: pick('Coding')?.desc, media: 'usb', drive: 'USB', side: 1 },
]

/**
 * ช่วงเลื่อน (สัดส่วนของ section สูง 10 จอ):
 * ปก What I do (ฉากอยู่ในกรอบ portal) → กรอบขยายเต็มจอ → กล้องพุ่งเข้าจอ CRT → เรื่องเล่าบนจอ
 * → ซูมออก → บทสกิลทีละบท
 */
/** ค้างปกไว้ช่วงหนึ่งก่อนเริ่มขยาย — เข้ามาแล้วได้อ่านหัวข้อ เห็นของสกิลเด้งออกมาก่อน */
export const COVER_HOLD = 0.05
export const PORTAL_LEN = 0.08
/** ความเป็นกรอบ 1 = ปก (ห่อในกรอบ) → 0 = เต็มจอ (เส้นตรง ผู้ใช้ easing เอง) */
export const portalAt = (p: number) => 1 - clamp01((p - COVER_HOLD) / PORTAL_LEN)
/** กล้องพุ่งจากมุมไกลเข้าจ่อจอ CRT — เริ่มก่อนกรอบขยายเสร็จนิดหนึ่ง ต่อกันเป็นท่าเดียว */
export const DIVE_START = 0.1
export const DIVE_LEN = 0.07
/** จบการพุ่งเข้า = จุดเริ่มพิมพ์เรื่องเล่า (จอเปิดเครื่องก่อนถึงนิดหนึ่ง) */
export const INTRO = DIVE_START + DIVE_LEN
export const STORY_END = INTRO + 0.08
export const ZOOM_END = STORY_END + 0.063
export const CH_START = ZOOM_END + 0.023
export const CH_LEN = 0.19
/**
 * ขอบกรอบ (สัดส่วนของจอ ตอนห่อเสร็จ) — CSS ใน HandCompose ใช้ชุดเดียวกัน ระนาบตัดของแขน/เมฆ
 * คิดจากค่านี้ จึงตัดตรงขอบในของกรอบพอดี · border = ความหนาขอบขาว (px)
 */
export const FRAME = { top: 0.25, right: 0.05, bottom: 0.17, left: 0.05, border: 12, radius: 36 }
/** ความคืบหน้าในบทที่ i (0..1 ระหว่างบท, นอกช่วงเกินขอบได้) */
export const chapterAt = (p: number, i: number) => (p - CH_START - i * CH_LEN) / CH_LEN
/** จังหวะภายในบท: ลอยเข้า → โชว์ → บินไปหน้าช่อง → เสียบ */
export const CH = { enter: 0.2, show: 0.5, reach: 0.72, done: 0.8 }
/** ฝั่งที่ฉาก 3D ควรอยู่ ณ ความคืบหน้า q (0 = กลางจอ ก่อน/หลังบทสกิล) */
export const sideAt = (q: number) => {
  for (let i = 0; i < CHAPTERS.length; i += 1) {
    const c = chapterAt(q, i)
    if (c >= -0.08 && c < 1) return CHAPTERS[i].side
  }
  return 0
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
/** ช่วงของชิ้นหนึ่ง: 0 ก่อนถึงคิว → 1 เมื่อเล่นจบ */
const span = (t: number, delay: number, dur: number) => clamp01((t - delay) / dur)
const outCubic = (x: number) => 1 - (1 - x) ** 3
/** เด้งเกินเป้านิดแล้วกลับ — ของที่ "ป๊อป" ออกมา */
const outBack = (x: number, k = 1.9) => 1 + (k + 1) * (x - 1) ** 3 + k * (x - 1) ** 2

/** คิวของสติกเกอร์/ไอคอน: ไล่จากกลางจอออกไปขอบ ชิ้นใกล้จอ CRT โผล่ก่อน */
const popDelay = (pos: readonly number[]) => 0.35 + Math.hypot(pos[0], pos[1] - 0.4) * 0.12

/* ---------------------------------------------------------------- จอ CRT */

function Monitor({ ap }: { ap: React.RefObject<Appear> }) {
  const geos = useMemo(() => {
    const base = new RoundedBoxGeometry(1.85, 0.42, 1.6, 5, 0.16)
    const neck = new RoundedBoxGeometry(1.5, 0.24, 1.1, 4, 0.1)
    const front = new RoundedBoxGeometry(2.9, 2.45, 0.8, 6, 0.26)
    const back = new RoundedBoxGeometry(2.35, 2.0, 1.1, 6, 0.34)
    const tail = new RoundedBoxGeometry(1.6, 1.4, 0.8, 5, 0.3)
    const bezel = new RoundedBoxGeometry(2.36, 1.92, 0.1, 4, 0.05)
    const vent = new RoundedBoxGeometry(0.035, 0.05, 0.4, 2, 0.015)
    const button = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 24)
    const slot = new RoundedBoxGeometry(0.4, 0.04, 0.04, 2, 0.015)
    /* กระจกจอ CRT ป่องออกนิด ๆ — จอแบนเรียบอ่านเป็นแท็บเล็ต ไม่ใช่จอตู้ */
    const screen = new THREE.PlaneGeometry(2.14, 1.72, 24, 18)
    const sp = screen.attributes.position
    for (let i = 0; i < sp.count; i += 1) {
      const u = sp.getX(i) / 1.07
      const v = sp.getY(i) / 0.86
      sp.setZ(i, 0.07 * (1 - u * u) * (1 - v * v))
    }
    screen.computeVertexNormals()
    const glass = screen.clone()
    return { base, neck, front, back, tail, bezel, vent, button, slot, screen, glass }
  }, [])
  /**
   * ภาพบนจอวาดใหม่เฉพาะตอนเนื้อหาเปลี่ยน (ตัวอักษรเพิ่มทีละตัว / เคอร์เซอร์กะพริบ) ไม่ใช่ทุกเฟรม
   * — `frame.key` บอกว่าต้องวาดใหม่หรือยัง
   */
  const screen = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 824
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    const frame = { key: '' }
    const bg = (g: CanvasRenderingContext2D, w: number, h: number) => {
      g.clearRect(0, 0, w, h)
      g.beginPath()
      g.roundRect(0, 0, w, h, 110)
      g.fillStyle = '#2a58d8'
      g.fill()
      const glow = g.createRadialGradient(w * 0.5, h * 0.42, 40, w * 0.5, h * 0.5, w * 0.62)
      glow.addColorStop(0, 'rgba(120,160,255,0.55)')
      glow.addColorStop(1, 'rgba(20,50,170,0)')
      g.fillStyle = glow
      g.fill()
    }
    /** ภาพจบ (หลังซูมออก) — ป้ายชื่อบนจอแบบภาพอ้างอิง */
    const hello = (g: CanvasRenderingContext2D, w: number, h: number) => {
      g.fillStyle = '#ffffff'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `150px ${FONT}`
      g.fillText('HELLO,', w / 2, h * 0.34)
      g.fillText("I'M JOE", w / 2, h * 0.53)
      g.font = `64px ${FONT}`
      g.fillStyle = BLUE_L
      g.fillText('UX/UI DESIGNER', w / 2, h * 0.72)
      g.fillStyle = '#9ec0ff'
      for (const [x, y, r] of [
        [0.82, 0.2, 44],
        [0.17, 0.82, 34],
        [0.9, 0.34, 18],
      ]) {
        g.beginPath()
        sparklePath(g, w * x, h * y, r)
        g.fill()
      }
    }
    /** ตัดบรรทัดตามความกว้าง (คำอธิบายยาวกว่าจอ) */
    const wrap = (g: CanvasRenderingContext2D, text: string, max: number) => {
      const out: string[] = []
      let line = ''
      for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word
        if (g.measureText(next).width > max && line) {
          out.push(line)
          line = word
        } else line = next
      }
      if (line) out.push(line)
      return out
    }
    /** หนึ่งฉากของเรื่องเล่า: หัวข้อใหญ่พิมพ์ก่อน คำอธิบายพิมพ์ตาม เคอร์เซอร์บล็อกกะพริบท้ายข้อความ */
    const story = (g: CanvasRenderingContext2D, w: number, h: number, i: number, n: number, cursor: boolean) => {
      const { title, sub } = STORY[i]
      const tn = Math.min(n, title.length)
      const sn = Math.max(0, n - title.length)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      let fs = 150
      g.font = `${fs}px ${FONT}`
      while (g.measureText(title).width > w * 0.84 && fs > 60) {
        fs -= 6
        g.font = `${fs}px ${FONT}`
      }
      const ty = sub ? h * 0.36 : h * 0.5
      g.fillStyle = '#ffffff'
      const shown = title.slice(0, tn)
      g.fillText(shown, w / 2, ty)
      let cx = w / 2 + g.measureText(shown).width / 2 + 10
      let cy = ty
      let ch = fs * 0.8
      if (sub && sn > 0) {
        g.font = `52px ${FONT}`
        g.fillStyle = BLUE_L
        const lines = wrap(g, sub.slice(0, sn), w * 0.78)
        lines.forEach((l, k) => g.fillText(l, w / 2, h * 0.6 + k * 66))
        const last = lines[lines.length - 1] ?? ''
        cx = w / 2 + g.measureText(last).width / 2 + 8
        cy = h * 0.6 + (lines.length - 1) * 66
        ch = 50
      }
      if (cursor) {
        g.fillStyle = '#ffffff'
        g.fillRect(cx, cy - ch / 2, ch * 0.45, ch)
      }
      /* ลำดับฉาก — จุดเล็ก ๆ ใต้จอ บอกว่าเรื่องเล่ายังเหลืออีกกี่ฉาก */
      for (let k = 0; k < STORY.length; k += 1) {
        g.fillStyle = k === i ? '#ffffff' : 'rgba(255,255,255,0.3)'
        g.beginPath()
        g.arc(w / 2 + (k - (STORY.length - 1) / 2) * 34, h * 0.88, k === i ? 9 : 7, 0, Math.PI * 2)
        g.fill()
      }
    }
    const draw = (key: string, fn: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
      if (frame.key === key) return
      frame.key = key
      const g = c.getContext('2d')
      if (!g) return
      bg(g, c.width, c.height)
      fn(g, c.width, c.height)
      tex.needsUpdate = true
    }
    /** จอหลังเสียบสื่อ: พื้นสีสกิล ลำดับบท หัวข้อใหญ่ คำอธิบาย (ถ้ามี) */
    const skill = (g: CanvasRenderingContext2D, w: number, h: number, i: number) => {
      const ch = CHAPTERS[i]
      /* พื้นเป็นสีสกิลเต็มจอ (ทับพื้นน้ำเงินเดิม ไม่ผสม — ผสมแล้วส้มกลายเป็นแดงอิฐขุ่น) */
      g.beginPath()
      g.roundRect(0, 0, w, h, 110)
      g.fillStyle = ch.color
      g.fill()
      const glow = g.createRadialGradient(w * 0.5, h * 0.4, 30, w * 0.5, h * 0.5, w * 0.62)
      glow.addColorStop(0, 'rgba(255,255,255,0.32)')
      glow.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = glow
      g.fill()
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = 'rgba(255,255,255,0.8)'
      g.font = `600 44px ${FONT}`
      g.fillText(`${String(i + 1).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}`, w / 2, h * 0.2)
      g.fillStyle = '#ffffff'
      g.font = `150px ${FONT}`
      g.fillText(ch.title.toUpperCase(), w / 2, ch.sub ? h * 0.42 : h * 0.52)
      if (ch.sub) {
        g.font = `50px ${FONT}`
        wrap(g, ch.sub, w * 0.78).forEach((l, k) => g.fillText(l, w / 2, h * 0.64 + k * 64))
      }
    }
    /** จอรอรับสื่อ: ช่องเสียบวาดเป็นเส้นประ ลูกศรชี้ลง ชื่อชนิดสื่อ — แบบเครื่องเก่า "INSERT DISK" */
    const insert = (g: CanvasRenderingContext2D, w: number, h: number, i: number, blink: boolean) => {
      const ch = CHAPTERS[i]
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = 'rgba(255,255,255,0.75)'
      g.font = `600 44px ${FONT}`
      g.fillText(`${String(i + 1).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}`, w / 2, h * 0.2)
      g.fillStyle = '#ffffff'
      g.font = `120px ${FONT}`
      if (blink) g.fillText(`INSERT ${ch.drive}`, w / 2, h * 0.45)
      g.strokeStyle = 'rgba(255,255,255,0.8)'
      g.lineWidth = 8
      g.setLineDash([22, 16])
      g.strokeRect(w * 0.3, h * 0.66, w * 0.4, h * 0.08)
      g.setLineDash([])
      g.beginPath()
      g.moveTo(w / 2, h * 0.56)
      g.lineTo(w / 2 - 26, h * 0.6)
      g.lineTo(w / 2 + 26, h * 0.6)
      g.closePath()
      g.fill()
    }
    const set = (p: number, time: number) => {
      if (p >= STORY_END) {
        /* สื่อชิ้นล่าสุดที่เสียบเสร็จแล้ว = สิ่งที่จอกำลังเล่น */
        let k = -1
        let wait = -1
        for (let i = 0; i < CHAPTERS.length; i += 1) {
          const c = chapterAt(p, i)
          if (c >= CH.done) k = i
          else if (c > 0.02) wait = i
        }
        /* บทใหม่เริ่มแล้วแต่สื่อยังไม่เข้า: จอรอรับแผ่น (ข้อความกะพริบ) */
        if (wait >= 0) {
          const blink = Math.floor(time * 1.6) % 2 === 0
          draw(`wait${wait}:${blink}`, (g, w, h) => insert(g, w, h, wait, blink))
        } else if (k < 0) draw('hello', hello)
        else draw(`skill${k}`, (g, w, h) => skill(g, w, h, k))
        return
      }
      /* เว้นช่วงสั้น ๆ ให้จอเปิดเครื่องเสร็จก่อนตัวแรกขึ้น */
      const lead = INTRO + 0.01
      const seg = (STORY_END - lead) / STORY.length
      const s = Math.max(0, p - lead)
      const i = Math.min(STORY.length - 1, Math.floor(s / seg))
      const local = (s - i * seg) / seg
      const total = STORY[i].title.length + (STORY[i].sub?.length ?? 0)
      /* พิมพ์ในช่วง 70% แรกของฉาก ที่เหลือค้างให้อ่าน */
      const n = Math.round(clamp01(local / 0.7) * total)
      const cursor = n < total || Math.floor(time * 2.2) % 2 === 0
      draw(`${i}:${n}:${cursor}`, (g, w, h) => story(g, w, h, i, n, cursor))
    }
    set(0, 0)
    document.fonts?.load(`64px ${FONT}`).then(() => {
      frame.key = ''
    }, () => {})
    return { tex, set, frame }
  }, [])
  const screenTex = screen.tex
  const mats = useMemo(() => {
    const cream = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.55 })
    const creamD = new THREE.MeshStandardMaterial({ color: CREAM_D, roughness: 0.6 })
    const blueL = new THREE.MeshStandardMaterial({ color: BLUE_L, roughness: 0.45 })
    const blue = new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.4 })
    const dark = new THREE.MeshStandardMaterial({ color: '#8a8173', roughness: 0.8 })
    const screen = new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, alphaTest: 0.5, toneMapped: false })
    /* ผิวกระจกใส ๆ ทับจอ — มีไว้รับแสงสะท้อนจาก environment อย่างเดียว */
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.12,
      roughness: 0.08,
      clearcoat: 1,
      depthWrite: false,
    })
    return { cream, creamD, blueL, blue, dark, screen, glass }
  }, [screenTex])
  useDispose(useMemo(() => [...Object.values(geos), ...Object.values(mats), screenTex], [geos, mats, screenTex]))

  /**
   * จอ CRT เปิดเครื่อง: เส้นแสงแนวนอนบาง ๆ กางออกด้านข้างก่อน แล้วค่อยเปิดขึ้นลงเต็มจอ พร้อมแสง
   * วาบจ้าที่หรี่ลงเป็นภาพปกติ (สีวัสดุเกิน 1 ได้เพราะวัสดุจอไม่ผ่าน tone mapping)
   */
  const screenRef = useRef<THREE.Mesh>(null)
  const swap = useRef(-99)
  useFrame(({ clock }) => {
    const m = screenRef.current
    if (!m) return
    const a = ap.current
    const t = a && a.boot >= 0 ? a.boot : a ? -1 : 99
    const wide = outCubic(span(t, 0.1, 0.22))
    const tall = outCubic(span(t, 0.27, 0.32))
    m.visible = wide > 0.001
    m.scale.set(Math.max(0.001, wide), Math.max(0.012, tall), 1)
    const before = screen.frame.key
    screen.set(a?.q ?? 1, clock.elapsedTime)
    /* เสียบสื่อเสร็จ (ภาพบนจอเปลี่ยนเป็นสกิลใหม่) = วาบจ้าอีกทีแบบจอเพิ่งได้สัญญาณ */
    if (before !== screen.frame.key && screen.frame.key.startsWith('skill')) swap.current = clock.elapsedTime
    const flash =
      1 + 2.2 * (1 - span(t, 0.27, 0.55)) + 1.6 * (1 - span(clock.elapsedTime - swap.current, 0, 0.45))
    mats.screen.color.setScalar(flash)
  })

  /* จุดกำเนิด = ใต้ฐานตรงกลาง (จุดที่วางบนฝ่ามือ) */
  return (
    <group>
      <mesh geometry={geos.base} material={mats.cream} position={[0, 0.21, 0]} />
      {/* ช่องใส่แผ่นกับปุ่มเปิด อยู่ที่คางจอด้านขวา — พ้นนิ้วที่เกี่ยวขอบล่างไว้ */}
      <mesh geometry={geos.slot} material={mats.dark} position={[1.05, 0.8, 0.66]} />
      <mesh geometry={geos.button} material={mats.blue} position={[0.72, 0.8, 0.66]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={geos.neck} material={mats.creamD} position={[0, 0.5, -0.1]} />
      <mesh geometry={geos.front} material={mats.cream} position={[0, 1.83, 0.25]} />
      <mesh geometry={geos.back} material={mats.creamD} position={[0, 1.87, -0.55]} />
      <mesh geometry={geos.tail} material={mats.creamD} position={[0, 1.9, -1.1]} />
      <mesh geometry={geos.bezel} material={mats.blueL} position={[0, 1.88, 0.66]} />
      <mesh ref={screenRef} geometry={geos.screen} material={mats.screen} position={[0, 1.88, 0.715]} />
      <mesh geometry={geos.glass} material={mats.glass} position={[0, 1.88, 0.725]} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} geometry={geos.vent} material={mats.dark} position={[-1.45, 1.4 + i * 0.13, 0.05]} />
      ))}
    </group>
  )
}

/* ---------------------------------------------------------------- แขน + มือ */

const R = 0.72

function Arm() {
  const hand = useMemo(() => buildToonHand(R, 'hold'), [])
  const { mats, geos, fore } = useMemo(() => {
    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.55, emissive: '#ff8a6a', emissiveIntensity: 0.06, clippingPlanes: FRAME_PLANES })
    const nail = new THREE.MeshStandardMaterial({ color: '#fde6db', roughness: 0.3 })
    const W = new THREE.Vector3(0, -0.3, -0.62)
    const B = W.clone().add(new THREE.Vector3(0.1, -4.6, 0.7))
    const axis = W.clone().sub(B)
    const len = axis.length()
    axis.normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis)
    const foreGeo = new THREE.CylinderGeometry(R * 0.86, R * 1.12, 1, 32, 1, true)
    return {
      mats: { skin, nail },
      geos: { foreGeo, skinGeo: hand.skin, nailGeo: hand.nail },
      fore: { pos: W.clone().add(B).multiplyScalar(0.5), q, len },
    }
  }, [hand])
  useDispose(useMemo(() => [...Object.values(geos), ...Object.values(mats)], [geos, mats]))

  /**
   * กรอบของมือ: นิ้วชี้ไปหากล้อง (เชิดขึ้นนิดหน่อย) ฝ่ามือหงายขึ้น — ข้อมือพับไปข้างหลัง 90°
   * แบบมือชูของในภาพอ้างอิง นิ้วโป้ง = F × P จึงอยู่ด้านซ้ายของจอ (มือขวา)
   */
  const handQ = useMemo(() => {
    const F = new THREE.Vector3(0, 0.3, 1).normalize()
    const P = new THREE.Vector3(0, 1, 0).addScaledVector(F, -F.y).normalize()
    const T = new THREE.Vector3().crossVectors(F, P)
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, F, P))
  }, [])

  return (
    <group>
      <group position={[0, -0.3, -0.62]} quaternion={handQ}>
        <mesh name="hand" geometry={geos.skinGeo} material={mats.skin} />
        <mesh name="hand" geometry={geos.nailGeo} material={mats.nail} />
      </group>
      <mesh geometry={geos.foreGeo} material={mats.skin} position={fore.pos} quaternion={fore.q} scale={[1, fore.len, 1]} />
    </group>
  )
}

/* ---------------------------------------------------------------- สติกเกอร์ */

type Kind = 'tag' | 'ticket' | 'badge' | 'star'

type StickerSpec = {
  kind: Kind
  text?: string
  w?: number
  h?: number
  fill?: string
  color?: string
  pos: [number, number, number]
  rot: number
  phase: number
  size?: number
}

/** เส้นรอบรูปของสติกเกอร์ — ป้ายมุมมน หรือตั๋วที่มีรอยบากครึ่งวงกลมสองข้าง */
function outline(kind: Kind, w: number, h: number) {
  const s = new THREE.Shape()
  const r = Math.min(w, h) * 0.28
  const x0 = -w / 2
  const y0 = -h / 2
  if (kind === 'ticket') {
    const n = h * 0.17
    s.moveTo(x0 + r, y0)
    s.lineTo(-x0 - r, y0)
    s.quadraticCurveTo(-x0, y0, -x0, y0 + r)
    s.lineTo(-x0, -n)
    s.absarc(-x0, 0, n, -Math.PI / 2, Math.PI / 2, true)
    s.lineTo(-x0, -y0 - r)
    s.quadraticCurveTo(-x0, -y0, -x0 - r, -y0)
    s.lineTo(x0 + r, -y0)
    s.quadraticCurveTo(x0, -y0, x0, -y0 - r)
    s.lineTo(x0, n)
    s.absarc(x0, 0, n, Math.PI / 2, -Math.PI / 2, true)
    s.lineTo(x0, y0 + r)
    s.quadraticCurveTo(x0, y0, x0 + r, y0)
  } else {
    s.moveTo(x0 + r, y0)
    s.lineTo(-x0 - r, y0)
    s.quadraticCurveTo(-x0, y0, -x0, y0 + r)
    s.lineTo(-x0, -y0 - r)
    s.quadraticCurveTo(-x0, -y0, -x0 - r, -y0)
    s.lineTo(x0 + r, -y0)
    s.quadraticCurveTo(x0, -y0, x0, -y0 - r)
    s.lineTo(x0, y0 + r)
    s.quadraticCurveTo(x0, y0, x0 + r, y0)
  }
  return s
}

/**
 * เงาตกของสติกเกอร์บนพื้นหลัง — พื้นหลังเป็น CSS รับเงาจริงไม่ได้ จึงวาดเป็นแผ่นเงาเบลอ
 * หลังสติกเกอร์ เยื้องลงขวาตามทิศไฟหลัก (ใบเดียวใช้ร่วมทุกสติกเกอร์ ไม่ทิ้งตลอดอายุหน้า)
 */
let SHADOW_TEX: THREE.CanvasTexture | null = null
function shadowTex() {
  if (SHADOW_TEX) return SHADOW_TEX
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  if (g) {
    const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64)
    grd.addColorStop(0, 'rgba(8,24,100,0.75)')
    grd.addColorStop(0.5, 'rgba(8,24,100,0.4)')
    grd.addColorStop(1, 'rgba(10,30,110,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
  }
  SHADOW_TEX = new THREE.CanvasTexture(c)
  return SHADOW_TEX
}

const EXTRUDE = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.045, bevelSegments: 4, curveSegments: 18 }
const FACE_Z = 0.05 + 0.045 + 0.004

function Sticker({ spec, ap }: { spec: StickerSpec; ap: React.RefObject<Appear> }) {
  const ref = useRef<THREE.Group>(null)
  const { kind, w = 1.2, h = 0.5, fill = CREAM, color = INK, text = '', size = 0.35 } = spec
  const made = useMemo(() => {
    const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45 })
    if (kind === 'star') {
      const shape = new THREE.Shape()
      sparklePath(shape, 0, 0, size)
      const geo = new THREE.ExtrudeGeometry(shape, { ...EXTRUDE, depth: 0.04, bevelThickness: 0.05, bevelSize: 0.03 })
      geo.center()
      const mat = new THREE.MeshStandardMaterial({ color: fill, roughness: 0.4 })
      white.dispose()
      const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false })
      return { body: geo, bodyMat: mat, shadowMat, list: [geo, mat, shadowMat] as { dispose: () => void }[] }
    }
    let body: THREE.BufferGeometry
    let face: THREE.BufferGeometry
    const px = 256
    let tex: THREE.CanvasTexture
    if (kind === 'badge') {
      const rad = w / 2
      body = new THREE.CylinderGeometry(rad, rad, 0.1, 64)
      body.rotateX(Math.PI / 2)
      body = mergeGeometries([body.toNonIndexed(), new THREE.TorusGeometry(rad - 0.02, 0.05, 12, 64).toNonIndexed()].map((g) => {
        g.deleteAttribute('uv')
        return g
      }))
      face = new THREE.CircleGeometry(rad - 0.07, 64)
      tex = canvasTex(px * 2, px * 2, (g, cw) => {
        const c = cw / 2
        g.beginPath()
        g.arc(c, c, c, 0, Math.PI * 2)
        g.fillStyle = fill
        g.fill()
        g.fillStyle = color
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.font = `120px ${FONT}`
        g.fillText(text, c, c + 6)
        g.font = `44px ${FONT}`
        const ring = 'UX/UI DESIGNER • UX/UI DESIGNER • '
        const step = (Math.PI * 2) / ring.length
        for (let i = 0; i < ring.length; i += 1) {
          g.save()
          g.translate(c, c)
          g.rotate(i * step)
          g.fillText(ring[i], 0, -c * 0.8)
          g.restore()
        }
      })
    } else {
      body = new THREE.ExtrudeGeometry(outline(kind, w, h), EXTRUDE)
      const inset = 0.09
      face = new THREE.ShapeGeometry(outline(kind, w - inset * 2, h - inset * 2), 18)
      /* ShapeGeometry ให้ uv เป็นพิกัดจริงของรูป — แปลงเป็น 0..1 ให้แคนวาสทั้งใบลงพอดี */
      const uv = face.attributes.uv
      const fw = w - inset * 2
      const fh = h - inset * 2
      for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) / fw + 0.5, uv.getY(i) / fh + 0.5)
      const cw = Math.round(px * 2 * (fw / fh))
      tex = canvasTex(cw, px * 2, (g, W, H) => {
        g.fillStyle = fill
        g.fillRect(0, 0, W, H)
        g.fillStyle = color
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        let fs = H * 0.46
        g.font = `${fs}px ${FONT}`
        while (g.measureText(text).width > W * 0.8 && fs > 20) {
          fs -= 4
          g.font = `${fs}px ${FONT}`
        }
        g.fillText(text, W / 2, H / 2 + fs * 0.05)
      })
    }
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 })
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false })
    return {
      body,
      bodyMat: white,
      face,
      faceMat,
      shadowMat,
      list: [body, face, white, faceMat, tex, shadowMat] as { dispose: () => void }[],
    }
  }, [kind, w, h, fill, color, text, size])
  useDispose(made.list)

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime + spec.phase
    /* ป๊อปจากศูนย์: เด้งเกินขนาดนิดแล้วเข้าที่ พร้อมหมุนคลายเกลียวครึ่งรอบ */
    const e = span(ap.current?.t ?? 99, popDelay(spec.pos), 0.7)
    const sc = Math.max(0.0001, outBack(e))
    const f = spreadAt(ap.current?.q ?? 0)
    /* ระหว่างบทสกิล ของประดับกระเด็นออกขอบแล้วหายไป เหลือพื้นที่ให้เรื่องเล่า — จบบทก็กลับมา */
    g.scale.setScalar(sc * (1 - f))
    g.visible = e > 0 && f < 0.999
    g.position.x = spec.pos[0] * (1 + 0.6 * f)
    g.position.y = (spec.pos[1] - 0.4) * (1 + 0.35 * f) + 0.4 + Math.sin(t * 0.9) * 0.07 - (1 - outCubic(e)) * 0.6
    g.rotation.z = spec.rot + Math.sin(t * 0.6) * 0.05 + (1 - outCubic(e)) * 1.4
    g.rotation.y = Math.sin(t * 0.5) * 0.18
  })

  return (
    <group ref={ref} position={spec.pos} rotation={[0, 0, spec.rot]}>
      <mesh position={[0.14, -0.2, -0.35]} scale={kind === 'star' ? [size * 2.6, size * 2.6, 1] : [w * 1.25, (kind === 'badge' ? w : h) * 1.6, 1]} material={made.shadowMat}>
        <planeGeometry />
      </mesh>
      <mesh geometry={made.body} material={made.bodyMat} />
      {made.face && (
        <mesh
          geometry={made.face}
          material={made.faceMat}
          position={[0, 0, kind === 'badge' ? 0.056 : FACE_Z]}
        />
      )}
    </group>
  )
}

const STICKERS: StickerSpec[] = [
  { kind: 'tag', text: 'RESEARCH', w: 1.5, h: 0.52, fill: BLUE_L, pos: [-2.2, 2.55, -0.4], rot: 0.1, phase: 0 },
  { kind: 'tag', text: 'DESIGN', w: 1.25, h: 0.52, fill: CREAM, pos: [0.3, 2.95, -1.2], rot: -0.05, phase: 1.3 },
  { kind: 'ticket', text: 'CODING', w: 1.45, h: 0.62, fill: CREAM, pos: [3.2, 1.45, 0], rot: -0.12, phase: 2.1 },
  { kind: 'ticket', text: 'APPMAN', w: 1.5, h: 0.62, fill: BLUE_L, pos: [-3.35, 0.55, 0.1], rot: 0.18, phase: 0.7 },
  { kind: 'tag', text: 'BMS', w: 1.0, h: 0.52, fill: CREAM, pos: [3.45, 0.05, 0.3], rot: 0.14, phase: 3.2 },
  { kind: 'tag', text: 'UX/UI', w: 1.15, h: 0.52, fill: CREAM, pos: [-3.1, -0.85, 0.4], rot: -0.35, phase: 1.9 },
  { kind: 'badge', text: 'JOE', w: 1.05, fill: CREAM, pos: [2.8, -1.05, 0.6], rot: 0.2, phase: 2.6 },
  { kind: 'star', fill: BLUE, size: 0.22, pos: [-3.9, 1.9, -0.8], rot: 0.3, phase: 2.2 },
  { kind: 'star', fill: '#ffffff', size: 0.2, pos: [3.95, 2.3, -0.6], rot: 0, phase: 0.9 },
  { kind: 'star', fill: '#ffffff', size: 0.18, pos: [1.7, -0.7, 1.2], rot: 0.4, phase: 1.6 },
]

/* ---------------------------------------------------------------- เมฆ */

/** ก้อนเมฆ = ทรงกลมหลายลูกรวมเป็นเมชเดียว (ลูกกลางใหญ่ ไล่เล็กลงไปทางปลาย) */
function cloudGeo(seed: number, n: number, spread: number) {
  let s = seed
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5
    const r = 0.55 + (1 - Math.abs(t) * 1.6) * 0.55 + rnd() * 0.2
    const g = new THREE.SphereGeometry(r, 28, 20)
    g.translate(t * spread + (rnd() - 0.5) * 0.3, (rnd() - 0.3) * 0.3 + r * 0.35, (rnd() - 0.5) * 0.6)
    g.deleteAttribute('uv')
    parts.push(g)
  }
  const out = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  return out
}

function Clouds({ ap }: { ap: React.RefObject<Appear> }) {
  const made = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#dce8ff', emissiveIntensity: 0.35, clippingPlanes: FRAME_PLANES })
    const list = [
      { geo: cloudGeo(7, 6, 4.2), pos: [-3.0, -2.75, 1.6] as const },
      { geo: cloudGeo(19, 5, 3.4), pos: [3.3, -2.7, 1.4] as const },
      { geo: cloudGeo(41, 6, 4.4), pos: [0.5, -3.05, 3.0] as const },
      { geo: cloudGeo(55, 4, 2.6), pos: [-1.9, -2.8, 2.2] as const },
      { geo: cloudGeo(77, 5, 3.6), pos: [-4.6, -2.3, -1.2] as const },
      { geo: cloudGeo(93, 5, 3.6), pos: [4.8, -2.2, -1.4] as const },
    ]
    return { mat, list }
  }, [])
  useDispose(useMemo(() => [made.mat, ...made.list.map((c) => c.geo)], [made]))
  /* เมฆลอยขึ้นจากใต้ขอบจอทีละก้อน (ก้อนหน้าก่อน ก้อนหลังตาม) รองรับมือที่กำลังพุ่งขึ้นมา */
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const a = ap.current
    /* ขึ้นตั้งแต่มือพุ่งเข้าปก (นาฬิกา rise) — ไม่รอซูมออก */
    const t = a ? Math.max(a.t, a.rise - 0.2) : 99
    made.list.forEach((c, i) => {
      const m = refs.current[i]
      if (!m) return
      const e = outCubic(span(t, 0.15 + i * 0.07, 1.1))
      m.position.y = c.pos[1] - (1 - e) * 4.5
      m.scale.setScalar(0.7 + 0.3 * e)
    })
  })
  return (
    <group>
      {made.list.map((c, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m
          }}
          geometry={c.geo}
          material={made.mat}
          position={c.pos as unknown as [number, number, number]}
        />
      ))}
    </group>
  )
}

/* ---------------------------------------------------------------- ฉาก */

/**
 * แสงสตูดิโอ — environment จาก RoomEnvironment (สร้างในเครื่อง ไม่โหลด HDR จากเน็ต) ให้พลาสติก
 * มีแสงสะท้อนนุ่ม ๆ แบบภาพอ้างอิง ส่วนเงาใช้ไฟหลักดวงเดียว กรอบเงาครอบแค่มือกับจอ
 */
function Studio() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pm.fromScene(room, 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.3
    return () => {
      scene.environment = null
      env.dispose()
      room.clear()
      pm.dispose()
    }
  }, [gl, scene])
  return (
    <>
      <hemisphereLight args={['#dfe9ff', '#f6d7c6', 0.75]} />
      <directionalLight
        position={[-4, 6, 7]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-camera-left={-3.5}
        shadow-camera-right={3.5}
        shadow-camera-top={3.5}
        shadow-camera-bottom={-3.5}
        shadow-camera-near={1}
        shadow-camera-far={25}
      />
      <directionalLight position={[5, 2, -4]} intensity={1.1} color="#bcd4ff" />
    </>
  )
}

/* ---------------------------------------------------------------- ไอคอนสกิล 3D */

/**
 * ไอคอนสกิลของเว็บเอง (เคอร์เซอร์ = Research, ดินสอ = Design, >_ = Coding) ขึ้นรูปจาก SVG
 * เดียวกับที่การ์ด what-i-do ใช้ — แทนของประกอบฉากในภาพอ้างอิง (จอยเกม ม้วนฟิล์ม) ที่ไม่ใช่เรื่องของเรา
 */
function iconGeo(svg: string, width: number) {
  const data = new SVGLoader().parse(svg)
  const parts: THREE.BufferGeometry[] = []
  const colors: string[] = []
  data.paths.forEach((path, i) => {
    const fill = path.userData?.style?.fill
    if (!fill || fill === 'none') return
    for (const shape of SVGLoader.createShapes(path)) {
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: 10,
        bevelEnabled: true,
        bevelThickness: 3,
        bevelSize: 1.6,
        bevelSegments: 4,
        curveSegments: 10,
      })
      g.deleteAttribute('uv')
      /* ชั้นที่มาทีหลังใน SVG วาดทับชั้นก่อน — ยกขึ้นมาทีละนิด ไม่งั้นหน้าซ้อนระนาบเดียวกันกะพริบ */
      g.translate(0, 0, -i * 2.5)
      parts.push(g.index ? g.toNonIndexed() : g)
      colors.push(fill)
    }
  })
  /* กลุ่มต่อชิ้น = วัสดุต่อสีของชิ้นนั้น (สีเดียวกับไอคอนบนเว็บ) */
  const geo = mergeGeometries(parts, true)
  parts.forEach((g) => g.dispose())
  geo.computeBoundingBox()
  const size = geo.boundingBox!.getSize(new THREE.Vector3())
  const k = width / size.x
  /* SVG แกน y ชี้ลง — กลับ y กับ z คู่กัน (= หมุน 180° รอบแกน x) ลำดับจุดของหน้าจึงไม่กลับด้าน */
  geo.scale(k, -k, -k)
  geo.center()
  geo.computeVertexNormals()
  return { geo, colors }
}

function Icon({ svg, width, tint, pos, rot, phase, ap }: { svg: string; width: number; tint?: string; pos: [number, number, number]; rot: number; phase: number; ap: React.RefObject<Appear> }) {
  const ref = useRef<THREE.Group>(null)
  const made = useMemo(() => {
    const { geo, colors } = iconGeo(svg, width)
    const mats = colors.map((c) => new THREE.MeshStandardMaterial({ color: tint ?? c, roughness: 0.35 }))
    return { geo, mats }
  }, [svg, width, tint])
  useDispose(useMemo(() => [made.geo, ...made.mats], [made]))
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime + phase
    const e = span(ap.current?.t ?? 99, popDelay(pos) + 0.1, 0.75)
    const f = spreadAt(ap.current?.q ?? 0)
    g.scale.setScalar(Math.max(0.0001, outBack(e, 2.4)) * (1 - f))
    g.visible = e > 0 && f < 0.999
    g.position.x = pos[0] * (1 + 0.6 * f)
    g.position.y = (pos[1] - 0.4) * (1 + 0.35 * f) + 0.4 + Math.sin(t * 0.85) * 0.08 - (1 - outCubic(e)) * 0.5
    g.rotation.z = rot + Math.sin(t * 0.6) * 0.06
    /* ไอคอนหมุนควงรอบตัวหนึ่งรอบก่อนหยุด — อ่านเป็นเหรียญที่ดีดออกมา */
    g.rotation.y = Math.sin(t * 0.45) * 0.35 + (1 - outCubic(e)) * Math.PI * 2
  })
  return (
    <group ref={ref} position={pos} rotation={[0, 0, rot]}>
      <mesh geometry={made.geo} material={made.mats} />
    </group>
  )
}

/* ---------------------------------------------------------------- สื่อของบทสกิล */

/** ช่องใส่แผ่นบนคางจอ ในพิกัดของกลุ่มมือชูจอ (ตรงกับ slot ใน Monitor) */
const SLOT_LOCAL = new THREE.Vector3(1.05, 0.8, 0.66)
const UP = new THREE.Vector3(0, 1, 0)
const CAM_FAR = new THREE.Vector3(0, 0.35, 8)
const M_S = new THREE.Vector3()
const M_N = new THREE.Vector3()
const M_P = new THREE.Vector3()
const M_F = new THREE.Vector3()
const M_X = new THREE.Vector3()
const M_Y = new THREE.Vector3()
const M_Z = new THREE.Vector3()
const M_M = new THREE.Matrix4()
const M_Q1 = new THREE.Quaternion()
const M_Q2 = new THREE.Quaternion()
const M_QS = new THREE.Quaternion()
const inCubic = (x: number) => x * x * x
/** ขนาดตอนลอยโชว์ข้างจอ — ใหญ่พอให้อ่านป้าย แต่ไม่ล้นขอบจอ */
const SHOW_SCALE = 0.58

/** กรอบหมุนจากแกน y (ขอบที่เสียบ) กับแกน z (ด้านหน้า) — ตั้งฉากกันเองก่อนประกอบ */
function frameQuat(out: THREE.Quaternion, y: THREE.Vector3, zHint: THREE.Vector3) {
  M_Y.copy(y).normalize()
  M_Z.copy(zHint).addScaledVector(M_Y, -zHint.dot(M_Y)).normalize()
  M_X.crossVectors(M_Y, M_Z)
  return out.setFromRotationMatrix(M_M.makeBasis(M_X, M_Y, M_Z))
}

/**
 * สื่อหนึ่งชิ้นของบทที่ i — ลอยเข้าจากขอบจอฝั่งของบท หมุนโชว์ข้างจอ CRT แล้วย่อตัวบินไปจ่อหน้า
 * ช่องบนคางจอ หันขอบเสียบเข้าช่อง แล้วดันเข้าไปจนหายเข้าตัวจอ (ตัวจอบังเองด้วยความลึก)
 *
 * ทุกตำแหน่งคิดจากตำแหน่งจริงของช่องทุกเฟรม — มือที่ไหวอยู่พาช่องขยับ สื่อก็ตามเข้าช่องพอดี
 */
function Media({ i, hero, ap }: { i: number; hero: React.RefObject<THREE.Group | null>; ap: React.RefObject<Appear> }) {
  const ch = CHAPTERS[i]
  const made = useMemo(() => {
    const m = buildMedia(ch.media, ch.title, ch.color)
    m.group.traverse((o) => {
      o.castShadow = true
    })
    return m
  }, [ch])
  useEffect(() => () => made.dispose(), [made])
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = ref.current
    const h = hero.current
    const a = ap.current
    if (!g || !h || !a) return
    const c = chapterAt(a.q, i)
    g.visible = c > 0 && c < CH.done + 0.02
    if (!g.visible) return
    const t = clock.elapsedTime
    h.updateMatrixWorld()
    const slot = M_S.copy(SLOT_LOCAL).applyMatrix4(h.matrixWorld)
    const n = M_N.set(0, 0, 1).applyQuaternion(h.getWorldQuaternion(M_Q1)).normalize()

    /* ลอยเข้า: จากนอกขอบจอ ฝั่งของบท เหนือขึ้นไปนิด → จุดโชว์ข้างจอ */
    const e1 = outCubic(span(c, 0, CH.enter))
    /* จุดโชว์ = ลอยหน้าจอ CRT เยื้องเข้ากลางจอนิด ใกล้กล้องกว่าจอ (ตัวใหญ่ บังจอบางส่วน) */
    const hx = h.position.x
    const spot = M_P.set(hx - ch.side * 0.9, 0.9 + Math.sin(t * 1.1) * 0.08, 3.0)
    const pos = M_F.set(hx + ch.side * 6.5, 3.2, 1.0).lerp(spot, e1)

    /* ท่าโชว์: หน้าหันเข้ากล้อง ส่ายซ้ายขวาช้า ๆ (ขณะลอยเข้าหมุนควงมาหนึ่งรอบ) */
    const toCam = M_X.copy(CAM_FAR).sub(pos)
    frameQuat(M_Q2, UP, toCam)
    const sway = Math.sin(t * 0.9 + i) * 0.35 + (1 - e1) * Math.PI * 2 * -ch.side
    M_Q2.multiply(M_QS.setFromAxisAngle(UP, sway))
    if (ch.media === 'cd') M_Q2.multiply(M_QS.setFromAxisAngle(M_Z.set(0, 0, 1), t * 1.4))

    /* ท่าเสียบ: ขอบเสียบ (+y ของสื่อ) ชี้เข้าจอ ด้านหน้าหงายขึ้น — วางแนวเดียวกับช่องแนวนอน */
    const e2 = easeInOut(span(c, CH.show, CH.reach - CH.show))
    const front = M_Y.copy(slot).addScaledVector(n, 1.0)
    pos.lerp(front, e2)
    const insertQ = frameQuat(M_Q1, M_Z.copy(n).negate(), UP)
    g.quaternion.slerpQuaternions(M_Q2, insertQ, e2)

    /* ดันเข้าช่อง: เร่งเข้าท้าย ๆ (inCubic) เหมือนถูกเครื่องดูดเข้าไป */
    const e3 = inCubic(span(c, CH.reach, CH.done - CH.reach))
    const depth = 1.0 + 1.0 * made.fit
    pos.addScaledVector(n, -depth * e3)
    g.position.copy(pos)
    g.scale.setScalar(THREE.MathUtils.lerp(SHOW_SCALE, made.fit, e2))
  })
  return (
    <group ref={ref} visible={false}>
      <primitive object={made.group} />
    </group>
  )
}

/** จุดกลางจอ CRT ในพิกัดของกลุ่มมือชูจอ (ดู Monitor) */
const SCREEN_LOCAL = new THREE.Vector3(0, 1.88, 0.715)
const TMP_A = new THREE.Vector3()
const TMP_B = new THREE.Vector3()
const TMP_N = new THREE.Vector3()
const TMP_Q = new THREE.Quaternion()
const FAR_LOOK = new THREE.Vector3(0, 0.35, 0)
/** ระยะที่ฉากเลื่อนออกข้างในบทสกิล (หน่วยโลก ที่ระยะมือ) — ราวหนึ่งในสี่ของความกว้างภาพ */
const SIDE_X = 1.9
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
const NDC = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
const PL_IN = new THREE.Vector3()

export function HandScene({ appear }: { appear?: React.RefObject<Appear> }) {
  const hero = useRef<THREE.Group>(null)
  /* ไม่มีคนคุม (หน้า /hand เดี่ยว ๆ) = เล่นเองตามเวลา: เรื่องเล่าบนจอ ~7 วินาที แล้วซูมออก */
  const own = useRef<Appear>({ on: false, t: 0, p: 0, boot: 0, q: 0, rise: 0 })
  const ap = appear ?? own
  const side = useRef(0)
  const portal = useRef(0)
  const arrive = useRef(0)
  const screenAt = useRef(new THREE.Vector3(0, 1, 0))
  const gl = useThree((st) => st.gl)
  useEffect(() => {
    gl.localClippingEnabled = true
  }, [gl])
  /* ทุกชิ้นของมือกับจอให้ทั้งทอดเงาและรับเงา — จอบังนิ้ว นิ้วบังฐาน อ่านออกว่าซ้อนกันจริง */
  useEffect(() => {
    hero.current?.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && !(m.material as THREE.Material).transparent) {
        o.castShadow = true
        /* มือไม่รับเงาตัวเอง: แคปซูลนิ้วซ้อนกันเป็นรอยต่อ เงาตกทับรอยต่อแล้วเป็นขอบหยักฟันเลื่อย */
        o.receiveShadow = o.name !== 'hand'
      }
    })
  }, [])
  useFrame(({ clock, camera, pointer, size }, dt) => {
    const t = clock.elapsedTime
    const step = Math.min(dt, 0.05)
    const a = ap.current
    if (!a) return
    if (!appear) a.p = Math.min(1, a.p + step / 24)
    if (a.boot >= 0) a.boot += step
    if (a.rise >= 0) a.rise += step
    a.q += (a.p - a.q) * (1 - Math.exp(-dt * 7))
    portal.current = easeInOut(portalAt(a.q))
    /* ของสกิลเด้งออกจากจอหลังมือพุ่งขึ้นเข้าฉาก (ตามเวลา) และหดกลับเข้าจอตามกรอบที่ขยาย (ตามระยะเลื่อน) */
    arrive.current = a.rise < 0 ? 0 : clamp01((a.rise - 0.7) / 1.3)
    const p = a.q
    a.on = p >= STORY_END
    a.t = a.on ? a.t + step : 0

    const h = hero.current
    if (h) {
      /**
       * ทั้งฉากเลื่อนไปอีกฝั่งของข้อความในแต่ละบท (สลับซ้าย/ขวา) — หน่วงเป็นสปริงนุ่ม ๆ ไม่ใช่
       * กระโดดตามระยะเลื่อน หันจอเข้าหากลางจอนิดหนึ่งตามฝั่ง จอจึงยังมองเห็นหน้าเต็ม
       */
      const target = sideAt(p) * SIDE_X
      side.current += (target - side.current) * (1 - Math.exp(-dt * 2.6))
      h.position.x = side.current
      h.position.y = -0.85 + Math.sin(t * 0.8) * 0.06
      h.rotation.y = 0.55 - (side.current / SIDE_X) * 0.3
      h.rotation.z = Math.sin(t * 0.55) * 0.02
    }

    /**
     * กล้อง: ช่วงเรื่องเล่า จ่อตั้งฉากกับกระจกจอ CRT ใกล้จนจอเต็มความสูงภาพ (แนวตั้งเต็มความกว้าง)
     * แล้วถอยออกไปที่มุมของฉากเต็ม (ease in-out) — จุดที่มองก็ไหลจากกลางจอไปกลางฉากพร้อมกัน
     * เพราะคิดจากตำแหน่งจริงของจอทุกเฟรม มือที่ไหวอยู่จึงไม่ทำให้ภาพบนจอสั่น
     */
    const cam = camera as THREE.PerspectiveCamera
    /* 1 = มุมไกล (ปก / ฉากเต็ม) · 0 = จ่อจอ — พุ่งเข้าหลังปก แล้วถอยออกหลังเรื่องเล่า */
    const e = Math.max(1 - easeInOut(span(p, DIVE_START, DIVE_LEN)), easeInOut(span(p, STORY_END, ZOOM_END - STORY_END)))
    if (h) {
      h.updateMatrixWorld()
      const center = TMP_A.copy(SCREEN_LOCAL).applyMatrix4(h.matrixWorld)
      const normal = TMP_N.set(0, 0, 1).applyQuaternion(h.getWorldQuaternion(TMP_Q))
      const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
      const aspect = size.width / Math.max(1, size.height)
      const scale = h.scale.x
      const fitH = (0.8 * scale) / tan
      const fitW = (1.02 * scale) / (tan * aspect)
      const d = aspect > 1.25 ? fitH : fitW
      const close = TMP_B.copy(center).addScaledVector(normal, d)
      /* ปก: ถอยกล้องให้มือกับจออยู่ในกรอบ portal (กลางกรอบต่ำกว่ากลางจอนิดหนึ่ง) */
      const w = portal.current
      const farX = pointer.x * 0.5 * (1 - w * 0.6)
      const farY = 0.35 + pointer.y * 0.3 + w * 0.6
      cam.position.set(
        THREE.MathUtils.lerp(close.x, farX, e),
        THREE.MathUtils.lerp(close.y, farY, e),
        THREE.MathUtils.lerp(close.z, 8 + w * 2.8, e),
      )
      screenAt.current.copy(center)
      cam.lookAt(center.lerp(TMP_B.copy(FAR_LOOK).setY(FAR_LOOK.y + w * 0.6), e))
      cam.updateMatrixWorld()
      /**
       * ระนาบตัดตามขอบในของกรอบ — ใช้ p ดิบ (ไม่หน่วง) เหมือน CSS ขอบตัดจึงตรงกับขอบกรอบที่เห็น
       * ระนาบแต่ละด้านผ่านตัวกล้องกับเส้นขอบนั้นบนจอ หันด้านบวกเข้าหากลางภาพ
       */
      const wr = easeInOut(portalAt(a.p))
      /* ตัดเลยขอบในเข้าไปใต้ขอบขาว 2px — ไม่งั้นฟ้าแลบเป็นเส้นบาง ๆ ระหว่างรอยตัดกับขอบขาว */
      const inner = Math.max(0, FRAME.border * wr - 2)
      const bx = (inner * 2) / Math.max(1, size.width)
      const by = (inner * 2) / Math.max(1, size.height)
      const L = -1 + 2 * FRAME.left * wr + bx
      const Rr = 1 - 2 * FRAME.right * wr - bx
      const T = 1 - 2 * FRAME.top * wr - by
      const B = -1 + 2 * FRAME.bottom * wr + by
      const edges: [number, number, number, number][] = [
        [L, B, L, T],
        [Rr, T, Rr, B],
        [L, T, Rr, T],
        [Rr, B, L, B],
      ]
      PL_IN.set((L + Rr) / 2, (T + B) / 2, 0.5).unproject(cam)
      edges.forEach(([x0, y0, x1, y1], k) => {
        NDC[0].set(x0, y0, 0.5).unproject(cam)
        NDC[1].set(x1, y1, 0.5).unproject(cam)
        const pl = FRAME_PLANES[k].setFromCoplanarPoints(cam.position, NDC[0], NDC[1])
        if (pl.distanceToPoint(PL_IN) < 0) pl.negate()
      })
      /**
       * มือเข้าฉาก (เล่นตามเวลา ไม่ผูกระยะเลื่อน): พอ section ถึงขอบบน มือชูจอพุ่งขึ้นจากใต้ขอบภาพ
       * เอียงอยู่ แล้วเด้งเกินนิดก่อนเข้าที่ (back-ease) — จากนั้นเลื่อนต่อ กล้องจึงดอลลี่เข้าจอ
       * ใส่หลังคิดกล้อง กล้องจึงยึดตำแหน่งพักของจอ ไม่วิ่งตามมือ
       */
      const r = a.rise < 0 ? 0 : clamp01((a.rise - 0.1) / 1.1)
      const pop = r >= 1 ? 1 : 1 + 2.4 * (r - 1) ** 3 + 1.4 * (r - 1) ** 2
      const tilt = 1 - outCubic(clamp01((a.rise - 0.1) / 1.4))
      h.position.y -= (1 - pop) * 5.5
      h.rotation.z += tilt * 0.3
      h.rotation.x = 0.12 - tilt * 0.25
    }
  })

  return (
    <>
      <Studio />
      {/* หันจอไปทางขวาให้เห็นข้างซ้าย (ช่องระบายอากาศ) และเงยหน้าจอนิด ๆ ให้เห็นหลังคา — แบบภาพอ้างอิง */}
      <group ref={hero} position={[0, -0.85, 0]} rotation={[0.12, 0.55, 0]} scale={0.95}>
        <Monitor ap={ap} />
        <Arm />
      </group>
      {STICKERS.map((s, i) => (
        <Sticker key={i} spec={s} ap={ap} />
      ))}
      <Icon svg={cursorSvg} width={0.8} pos={[-1.85, 1.3, 0.3]} rot={0} phase={0.5} ap={ap} />
      <Icon svg={pencilSvg} width={0.75} pos={[2.05, 2.25, -0.4]} rot={-0.1} phase={1.7} ap={ap} />
      {/* >_ บนเว็บเป็นลายน้ำสีเขียวจาง — ในฉากนี้ย้อมน้ำเงินให้เข้าชุดสีภาพอ้างอิง */}
      <Icon svg={promptSvg} width={0.8} tint={BLUE} pos={[-2.35, -1.1, 0.8]} rot={0.15} phase={2.4} ap={ap} />
      <Clouds ap={ap} />
      <SkillProps w={() => Math.min(portal.current, arrive.current)} from={() => screenAt.current} />
      {CHAPTERS.map((_, i) => (
        <Media key={i} i={i} hero={hero} ap={ap} />
      ))}
    </>
  )
}
