import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { cursorRoot, cursorTip, cursorWake } from '@/cursorguide/morph'

/**
 * What I do บีตแรก — "I turn complex requirements into effortless experiences."
 * (ภาพอ้างอิง: เคอร์เซอร์แก้วชี้ wireframe ที่มีกรอบเลือกสีม่วง · โปสเตอร์ Quark การ์ดลอยเหนือ iPad จอน้ำเงิน)
 *
 * ตัวนำของเรื่องคือเคอร์เซอร์แก้ว — เกิดจากฟองแชตตรงที่เดิม แล้วทำทุกอย่างเองทีละอย่าง:
 *   ไปคว้าเอกสารรก ๆ ลากมาวาง → ลากกรอบเลือกคลุม ในกรอบกระดาษกลายเป็นลูกบาศก์ → คว้าก้อนทั้งกองหมุนวนตาม
 *   → ปล่อยลงเรียงเป็น wireframe บนแผ่นขาว → ก้อนละลายเป็นเส้นคม คลิกเลือกชิ้นงาน → ถอยกล้อง: ฟ้าคือจอ iPad
 * กล้องไม่เคยนิ่ง: โคจร ก้ม เอียง ดันเข้า ตามคีย์เฟรมบนเส้นเรื่อง และตามเคอร์เซอร์ไปบางส่วน
 *
 * พิกัดเวที (หน่วย = หน่วย viewBox ของฟอง ที่สเกล sc): x ขวา · y ขึ้น (ออกจากจอ) · z เข้าหาคนดู · iPad นอนบนระนาบ xz
 * กล้องออร์โธ = หมุน/สเกล/เลื่อนทั้งเวทีแทน (ดู stageFrame)
 */
export const SHRED = {
  /**
   * iPad: กว้าง ลึก หนา ขอบจอ รัศมีมุม — ใหญ่กว่าของบนจอมาก: ก่อนถอยกล้อง จอต้องคลุมจอภาพทุกมุมกล้อง
   * (โคจร/ก้ม/เอียง) จอเล็ก = ต้องซูมเข้าจนเอกสารกับการ์ดล้นจอ
   */
  w: 900,
  d: 640,
  t: 16,
  bezel: 26,
  r: 52,
  /** แท่งแก้ว (ฟอง): สูงจากพื้นเวที · ยาว (หน่วย viewBox ของฟอง) */
  barY: 175,
  barW: 380,
  /** กระดาษ: กว้าง ยาว จำนวนเส้นที่หั่น */
  pw: 300,
  pl: 420,
  strips: 12,
  tilt: (34 * Math.PI) / 180,
} as const

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => {
  const u = clamp01(v)
  return u * u * (3 - 2 * u)
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const AX = new THREE.Vector3(1, 0, 0)
const AY = new THREE.Vector3(0, 1, 0)
const AZ = new THREE.Vector3(0, 0, 1)
const inOut = (v: number) => {
  const u = clamp01(v)
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2
}

export type StageFrame = { pos: THREE.Vector3; q: THREE.Quaternion; sc: number; a: number }
export const newFrame = (): StageFrame => ({ pos: new THREE.Vector3(), q: new THREE.Quaternion(), sc: 1, a: Math.PI / 2 })

/** จุดเวที → px บนจอ (กล้องออร์โธ: แค่หมุน สเกล เลื่อน) */
export function project(f: StageFrame, W: number, H: number, v: THREE.Vector3, out: { x: number; y: number }) {
  TMP.copy(v).multiplyScalar(f.sc).applyQuaternion(f.q).add(f.pos)
  out.x = W / 2 + TMP.x
  out.y = H / 2 - TMP.y
  return out
}
const TMP = new THREE.Vector3()

/** เส้นขอบจอ (มุมมน) บนพื้นผิวบนของเครื่อง — ใช้เจาะรูสตูดิโอ */
const SCREEN_RING = (() => {
  const sw = SHRED.w / 2 - SHRED.bezel
  const sd = SHRED.d / 2 - SHRED.bezel
  const r = SHRED.r - SHRED.bezel * 0.7
  const pts: THREE.Vector3[] = []
  const corner = (cx: number, cz: number, a0: number) => {
    for (let i = 0; i <= 6; i += 1) {
      const a = a0 + (i / 6) * (Math.PI / 2)
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, SHRED.t, cz + Math.sin(a) * r))
    }
  }
  corner(sw - r, sd - r, 0)
  corner(-sw + r, sd - r, Math.PI / 2)
  corner(-sw + r, -sd + r, Math.PI)
  corner(sw - r, -sd + r, Math.PI * 1.5)
  return pts
})()

/* ------------------------------------------------------------------ textures */

/** เอกสารความต้องการที่ยุ่งเหยิง — หัวกระดาษ ย่อหน้าแน่น ขีดฆ่า โน้ตแปะ วงแดง ลูกศร */
function paperTexture() {
  const c = document.createElement('canvas')
  c.width = 600
  c.height = 840
  const g = c.getContext('2d') as CanvasRenderingContext2D
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 600, 840)
  g.fillStyle = '#1d2433'
  g.font = '800 46px system-ui, -apple-system, sans-serif'
  g.fillText('REQUIREMENTS', 40, 78)
  g.fillStyle = '#8a93a8'
  g.font = '500 20px ui-monospace, Menlo, monospace'
  g.fillText('v7_final_FINAL(2).docx', 40, 112)
  let y = 160
  const rnd = (() => {
    let s = 7
    return () => ((s = (s * 16807) % 2147483647) / 2147483647)
  })()
  for (let i = 0; i < 22; i += 1) {
    const w = 360 + rnd() * 160
    g.fillStyle = i % 6 === 0 ? '#3c4559' : '#c5cbd8'
    g.fillRect(40, y, i % 6 === 0 ? w * 0.5 : w, i % 6 === 0 ? 14 : 10)
    if (i % 5 === 3) {
      g.strokeStyle = '#ef4444'
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(34, y + 5)
      g.lineTo(46 + w * 0.8, y + 4)
      g.stroke()
    }
    y += i % 6 === 5 ? 44 : 26
  }
  /* โน้ตแปะเหลืองเอียง */
  g.save()
  g.translate(420, 300)
  g.rotate(0.12)
  g.fillStyle = '#ffd84a'
  g.fillRect(0, 0, 150, 120)
  g.fillStyle = '#5a4a00'
  g.font = '800 44px system-ui, sans-serif'
  g.fillText('???', 30, 76)
  g.restore()
  /* วงแดง TBD + ลูกศร */
  g.strokeStyle = '#ef4444'
  g.lineWidth = 5
  g.beginPath()
  g.ellipse(170, 560, 90, 38, -0.08, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = '#ef4444'
  g.font = '800 34px system-ui, sans-serif'
  g.fillText('TBD', 140, 572)
  g.beginPath()
  g.moveTo(270, 560)
  g.quadraticCurveTo(380, 500, 430, 430)
  g.stroke()
  g.fillStyle = '#7c3aed'
  g.font = '700 26px system-ui, sans-serif'
  g.fillText('edge case?!', 360, 700)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/**
 * wireframe หน้าเว็บ (ภาพอ้างอิง): เส้นกรมท่าหนาบนแผ่นขาว — แถบเมนู · ภาพหลัก · การ์ดเล็ก + หัวข้อ + บรรทัด
 * · กล่องภาพ (ภูเขา + ดวงอาทิตย์) · กล่องขวาล่าง (ชิ้นที่ถูกเลือกตอนจบ) — ลูกบาศก์ลงตามเส้นพวกนี้
 */
function wireTexture() {
  const c = document.createElement('canvas')
  c.width = WIRE.w
  c.height = WIRE.h
  const g = c.getContext('2d') as CanvasRenderingContext2D
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath()
    g.roundRect(x, y, w, h, r)
  }
  const box = (x: number, y: number, w: number, h: number, r: number, fill = true) => {
    rr(x, y, w, h, r)
    if (fill) {
      g.fillStyle = 'rgba(120, 150, 255, 0.1)'
      g.fill()
    }
    g.stroke()
  }
  const bar = (x0: number, x1: number, y: number) => {
    g.beginPath()
    g.moveTo(x0, y)
    g.lineTo(x1, y)
    g.stroke()
  }
  g.clearRect(0, 0, WIRE.w, WIRE.h)
  g.strokeStyle = '#1d2433'
  g.lineWidth = 5
  g.lineJoin = 'round'
  g.lineCap = 'round'
  /* แถบเมนู */
  box(34, 24, 76, 26, 13, false)
  box(456, 28, 36, 18, 9, false)
  box(504, 28, 36, 18, 9, false)
  box(552, 28, 36, 18, 9, false)
  /* ภาพหลัก */
  box(34, 70, 572, 92, 18)
  /* การ์ดเล็ก + หัวข้อ + บรรทัด */
  box(34, 184, 106, 112, 16)
  box(164, 190, 110, 26, 13, false)
  bar(164, 440, 240)
  bar(164, 420, 262)
  bar(164, 340, 284)
  /* กล่องภาพ: ภูเขาสองยอด + ดวงอาทิตย์ */
  box(34, 318, 252, 98, 16)
  g.save()
  rr(34, 318, 252, 98, 16)
  g.clip()
  g.beginPath()
  g.moveTo(34, 410)
  g.lineTo(110, 352)
  g.lineTo(160, 392)
  g.lineTo(200, 362)
  g.lineTo(290, 420)
  g.stroke()
  g.restore()
  g.beginPath()
  g.arc(236, 346, 12, 0, Math.PI * 2)
  g.stroke()
  /* กล่องขวาล่าง — ที่ของกรอบเลือกตอนจบ */
  box(SEL_PX.x + 8, SEL_PX.y + 8, SEL_PX.w - 16, SEL_PX.h - 16, 16)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/* ------------------------------------------------------------------ story */

/** ขนาดบนเวที: กระดาษ · ช่องลูกบาศก์ · การ์ด wireframe (หน่วยเวที) — กระดาษกับการ์ดอยู่บนผิวจอ (ระนาบ xz) */
/* ก้อนใหญ่ 11×14 — ก้อนเล็กเป็นพันดูเป็นกระดาษกราฟ อ่านไม่ออกว่าเป็นลูกบาศก์ */
const PAPER = { w: 108, l: 138, cols: 11, rows: 14, y: SHRED.t + 26 }
const CELL = PAPER.w / PAPER.cols
/** ขนาดก้อนตอนลงเป็น wireframe (= ระยะตารางเป้าหมาย) */
const TILE = 9
const CARD = { w: 196, l: 135, z: 0 }
/** ภาพ wireframe (px ของแคนวาส) — กรอบเลือกตอนจบครอบชิ้นขวาล่าง */
const WIRE = { w: 640, h: 440 }
const SEL_PX = { x: 314, y: 310, w: 300, h: 114 }

/** exit = เคอร์เซอร์แก้วกลับเป็นลูกศรของหน้า (0..1) ตอนเลื่อนพ้นท่าจบ */
export type ShredPose = { on: boolean; bar: number; paper: number; scan: number; sort: number; zoom: number; lift: number; exit: number }

/** เส้นเรื่องเดียวทั้งบีต: แต่ละช่วงวิ่ง 0..1 ต่อกัน จึงบวกกันได้ 0..5 */
const storyT = (p: ShredPose) => p.bar + p.paper + p.scan + p.sort + p.zoom

/* ------------------------------------------------------------------ card (ตั้งขึ้นตอนถอยกล้อง) */

/**
 * การ์ดหมุนรอบขอบล่างของมัน (pivot) จากนอนบนจอ → ตั้งเอนหลังนิด ลอยเหนือจอ ขยายเป็นพระเอก
 * tilt 60° = เกือบหันเข้ากล้องตรง ๆ (กล้องจบที่ 34° → ตั้งฉากแนวมองที่ 56°)
 * พิกัดท้องถิ่นของการ์ด: จุดหมุนอยู่กลางขอบล่าง · z ติดลบ = ขึ้นไปทางขอบบนของการ์ด
 */
const STAND = { tilt: (60 * Math.PI) / 180, y: SHRED.t + 30, z: 10, grow: 2.25 }
const standK = (zoom: number) => smooth((zoom - 0.42) / 0.58)
const PIV = new THREE.Vector3()
function cardPivot(st: number, out: THREE.Vector3) {
  return out.set(0, lerp(SHRED.t + 2, STAND.y, st), lerp(CARD.z + CARD.l / 2, STAND.z, st))
}
/** จุดบนการ์ด (ท้องถิ่น) → เวที ตามท่าตั้งของการ์ดเฟรมนี้ */
function cardPoint(x: number, y: number, z: number, st: number, out: THREE.Vector3) {
  const gk = lerp(1, STAND.grow, st)
  cardPivot(st, PIV)
  return out.set(x * gk, y * gk, z * gk).applyAxisAngle(AX, STAND.tilt * st).add(PIV)
}
/** px ของภาพ wireframe → ท้องถิ่นของการ์ด */
const wireX = (px: number) => (px / WIRE.w - 0.5) * CARD.w
const wireZ = (py: number) => (py / WIRE.h - 1) * CARD.l

/* ------------------------------------------------------------------ cursor (ตัวนำ) */

/**
 * ทางเดินของเคอร์เซอร์ทั้งบีต (ปลายลูกศร บนเวที) + ความแรงที่กด (0 ลอย · 1 กดค้าง/ลาก) + ขนาดตอนเกิด
 * ทุกช่วงจบตรงจุดที่ช่วงถัดไปเริ่ม — ไม่มีรอยกระโดดเมื่อเลื่อนข้ามรอยต่อ
 */
export type CursorState = { pos: THREE.Vector3; press: number; show: number }
/**
 * ฟองแชตเฟรมนี้ (พิกัดโลก px) — BubbleTraveler เขียนทุกเฟรม: กลาง · ครึ่งกว้าง/สูง · ปลายข้อความ
 * เคอร์เซอร์โผล่ออกมาจากปลายข้อความ "Here is what I do" แล้วกระโดดออกทางขวาล่างของฟอง
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
  /* ชั้นลูกศรวาดตามสั่ง — จุดจอดย้ายแล้วต้องปลุกให้อ่านตำแหน่งใหม่ ไม่งั้นมันเล็งที่เดิมจนกว่าจะเลื่อนอีกที */
  cursorWake.fn()
}
export const newCursor = (): CursorState => ({ pos: new THREE.Vector3(), press: 0, show: 0 })
/** ที่เกิด — กล้องวางจุดนี้กลางจอ (ตรงที่ฟองเพิ่งพิมพ์จบ) */
const C0 = new THREE.Vector3(-30, PAPER.y, -40)
/** เอกสารไถลเข้ามาทางขวา เอียงอยู่ รอให้เคอร์เซอร์มาคว้ามุมซ้ายบน */
const PAPER_IN = { x0: 300, x: 190, z: -10, yaw: 0.5, lift: 14 }
/** กรอบเลือก: มุมซ้ายบน → ขวาล่างของเอกสาร (เผื่อขอบนิด) */
const SEL_A = new THREE.Vector3(-PAPER.w / 2 - 3, PAPER.y, -PAPER.l / 2 - 3)
const SEL_B = new THREE.Vector3(PAPER.w / 2 + 3, PAPER.y, PAPER.l / 2 + 3)
/** คว้ากองลูกบาศก์ตรงกลาง · ยกขึ้นไปค้างกลางอากาศ · จอดข้างขวาล่างการ์ด */
const GRAB_M = new THREE.Vector3(0, PAPER.y + 12, 8)
const HOLD = new THREE.Vector3(0, PAPER.y + 100, -14)
const PARK = new THREE.Vector3(CARD.w / 2 + 6, SHRED.t + 4, CARD.l / 2 + 10)

type PaperPose = { pos: THREE.Vector3; yaw: number }
const newPaperPose = (): PaperPose => ({ pos: new THREE.Vector3(), yaw: 0 })
/** ท่าของเอกสารในช่วง paper (u 0..1): ไถลเข้า → รอ → ถูกลาก (ห้อยจากมุม แกว่งนิด) → วางลงกลางจอ */
function paperPose(u: number, out: PaperPose) {
  if (u < 0.4) {
    const k = 1 - (1 - smooth(u / 0.3)) ** 2
    out.pos.set(lerp(PAPER_IN.x0, PAPER_IN.x, k), PAPER.y + PAPER_IN.lift, PAPER_IN.z)
    out.yaw = PAPER_IN.yaw + 0.35 * (1 - k)
  } else if (u < 0.86) {
    const k = inOut((u - 0.4) / 0.46)
    out.pos.set(lerp(PAPER_IN.x, 0, k), PAPER.y + PAPER_IN.lift, lerp(PAPER_IN.z, 0, k))
    out.yaw = PAPER_IN.yaw * (1 - k) + 0.16 * Math.sin(Math.PI * k)
  } else {
    const k = smooth((u - 0.86) / 0.14)
    out.pos.set(0, PAPER.y + PAPER_IN.lift * (1 - k) - 2.5 * Math.sin(Math.PI * k), 0)
    out.yaw = 0
  }
  return out
}
/** มุมซ้ายบนของเอกสาร (ที่เคอร์เซอร์จับ) */
function grabOf(pp: PaperPose, out: THREE.Vector3) {
  return out.set(-PAPER.w / 2, 0, -PAPER.l / 2).applyAxisAngle(AY, pp.yaw).add(pp.pos)
}
const PP = newPaperPose()
const GV = new THREE.Vector3()
const GV2 = new THREE.Vector3()

export function cursorAt(p: ShredPose, out: CursorState) {
  out.press = 0
  out.show = 1
  if (p.zoom > 0) {
    const z = p.zoom
    const bx = wireX(SEL_PX.x + SEL_PX.w)
    const bz = wireZ(SEL_PX.y + SEL_PX.h)
    if (z < 0.12) out.pos.copy(PARK)
    else if (z < 0.24) {
      const k = inOut((z - 0.12) / 0.12)
      cardPoint(bx, 3, bz, 0, GV)
      out.pos.lerpVectors(PARK, GV, k)
      out.pos.y += 16 * Math.sin(Math.PI * k)
    } else cardPoint(bx, 3, bz, standK(z), out.pos)
    /* คลิกเดียว — เลือกชิ้นงาน */
    out.press = smooth((z - 0.24) / 0.03) * (1 - smooth((z - 0.28) / 0.04))
  } else if (p.sort > 0) {
    const t = p.sort
    if (t < 0.14) {
      const k = inOut(t / 0.14)
      out.pos.lerpVectors(SEL_B, GRAB_M, k)
      out.pos.y += 26 * Math.sin(Math.PI * k)
    } else if (t < 0.5) {
      /* หิ้วกองขึ้นเป็นวงโค้ง ออกขวาแล้ววนกลับมาค้างเหนือกลางการ์ด */
      const k = inOut((t - 0.14) / 0.36)
      out.pos.set(80 * Math.sin(Math.PI * k), lerp(GRAB_M.y, HOLD.y, smooth(k)), lerp(GRAB_M.z, HOLD.z, k) - 30 * Math.sin(Math.PI * k))
    } else if (t < 0.62) {
      out.pos.copy(HOLD)
      out.pos.y += 10 * Math.sin((Math.PI * (t - 0.5)) / 0.12)
    } else {
      const k = inOut((t - 0.62) / 0.38)
      out.pos.lerpVectors(HOLD, PARK, k)
      out.pos.y += 20 * Math.sin(Math.PI * k)
    }
    out.press = smooth((t - 0.1) / 0.04) * (1 - smooth((t - 0.5) / 0.04))
  } else if (p.scan > 0) {
    const s = p.scan
    out.pos.lerpVectors(SEL_A, SEL_B, inOut((s - 0.12) / 0.76))
    out.press = smooth((s - 0.05) / 0.06) * (1 - smooth((s - 0.88) / 0.06))
  } else if (p.paper > 0) {
    const u = p.paper
    if (u < 0.33) {
      const k = inOut(u / 0.33)
      grabOf(paperPose(0.3, PP), GV)
      out.pos.lerpVectors(C0, GV, k)
      out.pos.y += 50 * Math.sin(Math.PI * k)
    } else if (u < 0.86) grabOf(paperPose(u, PP), out.pos)
    else {
      grabOf(paperPose(0.86, PP), GV2)
      out.pos.lerpVectors(GV2, SEL_A, smooth((u - 0.86) / 0.14))
    }
    out.press = smooth((u - 0.32) / 0.05) * (1 - smooth((u - 0.85) / 0.05))
  } else {
    out.pos.copy(C0)
    /* อยู่ในฟองตั้งแต่พิมพ์จบ แล้วมุดออกมา (ดูทางออกจากฟองใน ShredScene) */
    out.show = p.bar > 0 ? 1 : 0
  }
  return out
}

/* ------------------------------------------------------------------ camera */

/**
 * คีย์เฟรมกล้องบนเส้นเรื่อง T (0..5) — ต่อกันด้วย Catmull-Rom (ความเร็วต่อเนื่อง ผ่านคีย์ไม่หยุด ไม่สะดุด)
 * yaw = โคจรรอบแกนตั้งของเวที · elev = มุมก้ม (90 = มองตั้งฉากลงจอ) · roll = เอียงกล้อง
 * push = ดันเข้า (คูณสเกลฐาน) · follow = เล็งเคอร์เซอร์แค่ไหน (0 = จุดโฟกัสของฉาก) · fx/fy = จุดเล็งบนจอ (สัดส่วนจอ)
 * ty = ความสูงจุดโฟกัส · จบที่ท่าเดิมของโปสเตอร์ (มอง 34° จุดกำเนิดที่ 0.19W, −0.15H)
 */
// prettier-ignore
const CAM: number[][] = [
  //  T     yaw  elev  roll  push  follow   fx     fy     ty
  [0.0,    0,   90,    0,   1.0,  1.0,   0.0,   0.0,   PAPER.y],
  [0.8,   -4,   82,   -2,   1.0,  1.0,   0.0,   0.0,   PAPER.y],
  [1.3,   16,   62,    3,   0.95, 0.8,   0.05,  0.02,  PAPER.y],
  [1.75,   8,   54,   -3,   1.0,  0.5,   0.17,  0.0,   PAPER.y],
  [2.05,  -6,   52,    0,   1.08, 0.3,   0.17,  0.0,   PAPER.y],
  [2.5,  -20,   42,    3,   1.2,  0.3,   0.17,  0.03,  PAPER.y],
  [2.95, -28,   38,   -2,   1.15, 0.25,  0.17,  0.0,   PAPER.y],
  [3.35,   2,   46,    5,   1.0,  0.5,   0.17, -0.02,  PAPER.y],
  [3.7,   18,   56,   -3,   1.05, 0.3,   0.17,  0.0,   PAPER.y],
  [4.0,   12,   62,   -5,   1.1,  0.15,  0.17,  0.0,   PAPER.y],
  [4.3,    6,   56,   -2,   1.12, 0.1,   0.18, -0.03,  SHRED.t],
  [5.0,    0,   34,    0,   1.0,  0.0,   0.19, -0.15,  0],
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

/**
 * สเกลต่ำสุดที่จอ iPad (ขอบในของจอ ฉายลงจอภาพ) ยังคลุมทุกมุมของจอภาพ — ก่อนถอยกล้อง สตูดิโอห้ามโผล่
 * รูปจอที่ฉายเป็นรูปนูนรอบจุดเล็ง: มุมจอภาพ X อยู่ในรูป sc·U ⇔ sc ≥ max ของ (n·X)/(n·u) ทุกขอบ
 */
const UV = SCREEN_RING.map(() => ({ x: 0, y: 0 }))
const CV = new THREE.Vector3()
function coverScale(q: THREE.Quaternion, tgt: THREE.Vector3, W: number, H: number, ox: number, oy: number) {
  const n = SCREEN_RING.length
  for (let i = 0; i < n; i += 1) {
    CV.copy(SCREEN_RING[i]).sub(tgt).applyQuaternion(q)
    UV[i].x = CV.x
    UV[i].y = CV.y
  }
  let need = 0
  for (let i = 0; i < n; i += 1) {
    const a = UV[i]
    const b = UV[(i + 1) % n]
    let nx = b.y - a.y
    let ny = a.x - b.x
    let d = nx * a.x + ny * a.y
    if (d < 0) {
      nx = -nx
      ny = -ny
      d = -d
    }
    if (d < 1e-6) continue
    for (let c = 0; c < 4; c += 1) {
      const X = (c & 1 ? W / 2 : -W / 2) - ox
      const Y = (c & 2 ? H / 2 : -H / 2) - oy
      need = Math.max(need, (nx * X + ny * Y) / d)
    }
  }
  return need
}

const QA = new THREE.Quaternion()
const QB = new THREE.Quaternion()
const QC = new THREE.Quaternion()
const TGT = new THREE.Vector3()
const CUR = newCursor()
const D2R = Math.PI / 180

/**
 * กรอบเวทีของเฟรมนี้ (โลกของแคนวาส = px กลางจอ y ขึ้น) — ใช้ร่วมระหว่างฉาก 3D กับชั้น DOM (รูสตูดิโอ)
 * drift = ลมหายใจของกล้องตามเวลา (เฉพาะฉาก 3D ก่อนถอยกล้อง — ชั้น DOM ไม่ใช้ รูจอจึงไม่ต้องตาม)
 */
export function stageFrame(W: number, H: number, p: ShredPose, out: StageFrame, drift = 0, drift2 = 0) {
  sampleCam(storyT(p), CAM_V)
  out.a = (CAM_V[1] + drift2 * 1.2) * D2R
  QA.setFromAxisAngle(AY, (CAM_V[0] + drift * 1.6) * D2R)
  QB.setFromAxisAngle(AX, out.a)
  QC.setFromAxisAngle(AZ, (CAM_V[2] + drift2 * 0.7) * D2R)
  out.q.copy(QC).multiply(QB).multiply(QA)
  cursorAt(p, CUR)
  TGT.set(0, CAM_V[7], 0).lerp(CUR.pos, clamp01(CAM_V[4]))
  const ox = CAM_V[5] * W
  const oy = CAM_V[6] * H
  const sw = SHRED.w - SHRED.bezel * 2
  const sd = SHRED.d - SHRED.bezel * 2
  const sc0 = Math.max(W / sw, H / sd) * 1.4
  const sc1 = Math.min((W * 0.54) / SHRED.w, (H * 0.9) / (SHRED.d + SHRED.barY))
  /* ถอยกล้องหลังคลิกเลือกชิ้นงานเสร็จ — ย่อแบบเรขาคณิต อ่านเป็นกล้องถอยด้วยความเร็วคงที่ */
  const e = smooth((p.zoom - 0.25) / 0.75)
  const pre = sc0 * CAM_V[3]
  let sc = pre * Math.pow(sc1 / pre, e)
  sc = Math.max(sc, coverScale(out.q, TGT, W, H, ox, oy) * 1.03 * (1 - smooth(e / 0.5)))
  out.sc = sc
  CV.copy(TGT).applyQuaternion(out.q).multiplyScalar(sc)
  out.pos.set(ox - CV.x, oy - CV.y, -CV.z)
  return out
}

/**
 * กระดาษ: ระนาบบนผิวจอ — ส่วนที่อยู่ในกรอบเลือก (มุมซ้ายบนถึงมุมที่เคอร์เซอร์ลากอยู่) หายไป กลายเป็นลูกบาศก์แทน
 * ขอบหน้าของกรอบที่กำลังกินกระดาษเรืองม่วง (สีเดียวกับกรอบเลือก)
 */
const PAPER_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vXZ;
  void main() {
    vUv = uv;
    vXZ = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const PAPER_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uSel;
  uniform float uAlpha;
  varying vec2 vUv;
  varying vec2 vXZ;
  void main() {
    if (vXZ.x < uSel.x && vXZ.y < uSel.y) discard;
    vec3 c = texture2D(uMap, vUv).rgb;
    vec2 o = max(vXZ - uSel, 0.0);
    float glow = smoothstep(7.0, 0.0, length(o)) * step(-1e3, uSel.x);
    c = mix(c, vec3(0.62, 0.5, 1.0), glow * 0.75);
    gl_FragColor = vec4(c, uAlpha);
  }
`
const PLAIN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FADE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    if (t.a * uAlpha < 0.01) discard;
    gl_FragColor = vec4(t.rgb, t.a * uAlpha);
  }
`
/** แสงสแกน: แถบเรืองใต้แท่งแก้ว พาดกว้างกว่ากระดาษ — ไล่จางสองข้างตามความลึก */
/**
 * ลูกบาศก์: แสงทิศเดียวจากบนเยื้องซ้าย + แสงรอบตัวน้อย — หน้าบนสว่าง ด้านข้างเข้มลง ขอบก้อนอ่านชัด
 * (ไฟของแคนวาสฟองสว่างรอบตัวจัด ใช้วัสดุมาตรฐานแล้วทุกหน้าสว่างเท่ากัน = ก้อนแบน)
 */
const CUBE_VERT = /* glsl */ `
  varying vec3 vCol;
  varying vec3 vN;
  void main() {
    /* three ประกาศ instanceMatrix / instanceColor ให้เองเมื่อเป็น InstancedMesh (ประกาศซ้ำ = คอมไพล์พัง) */
    #ifdef USE_INSTANCING_COLOR
      vCol = instanceColor;
    #else
      vCol = vec3(1.0);
    #endif
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`
const CUBE_FRAG = /* glsl */ `
  uniform vec3 uLight;
  varying vec3 vCol;
  varying vec3 vN;
  void main() {
    float d = max(dot(normalize(vN), uLight), 0.0);
    vec3 c = vCol * (0.52 + 0.55 * d);
    gl_FragColor = vec4(c, 1.0);
    /* instanceColor มาเป็นค่าเชิงเส้น (THREE.Color แปลงให้) — แปลงกลับเป็น sRGB ก่อนออกจอ ไม่งั้นสีมืดหม่น */
    #include <colorspace_fragment>
  }
`
/**
 * กรอบเลือกแบบเครื่องมือออกแบบ (ภาพอ้างอิง): เส้นม่วงบาง พื้นม่วงจาง หมุดสี่เหลี่ยมทึบสี่มุม (+ เครื่องหมายบวกกลางกรอบ)
 * ระนาบเดียวขนาดกรอบ + ขอบเผื่อหมุด — ความหนาเส้น/หมุดคิดเป็นหน่วยเวที คมเท่ากันทุกขนาดกรอบ
 */
const MARQUEE_FRAG = /* glsl */ `
  uniform vec2 uSize;
  uniform float uM;
  uniform float uAlpha;
  uniform float uPlus;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv * (uSize + 2.0 * uM) - uM - uSize * 0.5;
    vec2 q = abs(c) - uSize * 0.5;
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    float line = 1.0 - smoothstep(0.45, 0.9, abs(sd));
    float fill = step(sd, 0.0) * 0.12;
    vec2 hc = abs(abs(c) - uSize * 0.5);
    float handle = 1.0 - smoothstep(2.4, 2.8, max(hc.x, hc.y));
    vec2 a = abs(c);
    float plus = uPlus * (1.0 - smoothstep(0.5, 0.9, min(a.x, a.y))) * step(max(a.x, a.y), min(uSize.x, uSize.y) * 0.17);
    float k = max(max(line, handle), plus);
    float alpha = max(k, fill) * uAlpha;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(mix(vec3(0.66, 0.58, 1.0), vec3(0.54, 0.42, 1.0), k), alpha);
  }
`
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

/** สุ่มแบบมีเมล็ด — ท่าของลูกบาศก์เหมือนเดิมทุกครั้ง (เลื่อนกลับแล้วเห็นท่าเดิม) */
function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/**
 * ลูกบาศก์: หนึ่งช่องของกระดาษ = หนึ่งก้อน (สีจากเนื้อกระดาษช่องนั้น) · เป้าหมาย = จุดที่มีเส้นใน wireframe
 * ทั้งสองชุดเรียงตาม z แล้ว x ก่อนจับคู่ ก้อนบนไปบน ก้อนล่างไปล่าง — ทางบินไม่ไขว้กันจนเละ
 */
function buildCubes(paperCanvas: HTMLCanvasElement, wireCanvas: HTMLCanvasElement) {
  const N = PAPER.cols * PAPER.rows
  const pg = paperCanvas.getContext('2d') as CanvasRenderingContext2D
  const pd = pg.getImageData(0, 0, paperCanvas.width, paperCanvas.height).data
  const from: { x: number; z: number; col: THREE.Color; h: number }[] = []
  for (let r = 0; r < PAPER.rows; r += 1) {
    for (let c = 0; c < PAPER.cols; c += 1) {
      /*
       * สีของก้อน = เนื้อที่เด่นในช่อง (นับพิกเซล 8×8 จุด) ไม่ใช่สีเฉลี่ย — เฉลี่ยแล้วได้เทาหม่นทุกก้อน
       * ความสูงตามเนื้อ: หมึก/ขีดแดง/โน้ตนูนขึ้น พื้นกระดาษเตี้ย — อ่านเป็นภาพนูนของเอกสาร
       */
      let dark = 0
      let red = 0
      let yel = 0
      let grey = 0
      const S = 8
      for (let dy = 0; dy < S; dy += 1) {
        for (let dx = 0; dx < S; dx += 1) {
          const px = Math.floor(((c + (dx + 0.5) / S) / PAPER.cols) * paperCanvas.width)
          const py = Math.floor(((r + (dy + 0.5) / S) / PAPER.rows) * paperCanvas.height)
          const i = (py * paperCanvas.width + px) * 4
          const R = pd[i] / 255
          const G = pd[i + 1] / 255
          const B = pd[i + 2] / 255
          const L = 0.3 * R + 0.59 * G + 0.11 * B
          if (R > 0.8 && G > 0.6 && B < 0.45) yel += 1
          else if (R > 0.65 && G < 0.45 && B < 0.5) red += 1
          else if (L < 0.4) dark += 1
          else if (L < 0.9) grey += 1
        }
      }
      const n = S * S
      let hex = '#f4f7ff'
      let h = 0.4
      if (yel / n > 0.35) {
        hex = '#ffc23d'
        h = 1.0
      } else if (red / n > 0.1) {
        hex = '#ff5a5f'
        h = 1.1
      } else if (dark / n > 0.16) {
        hex = '#1d2433'
        h = 1.3
      } else if (grey / n > 0.2) {
        hex = '#a9bbdc'
        h = 0.7
      }
      const col = new THREE.Color(hex)
      from.push({ x: -PAPER.w / 2 + (c + 0.5) * CELL, z: -PAPER.l / 2 + (r + 0.5) * CELL, col, h })
    }
  }
  /* เป้าหมาย: สุ่มอ่านพิกเซลของ wireframe บนตารางละเอียด เก็บจุดที่มีเส้น/ก้อน แล้วเลือกให้ได้ N จุดเท่า ๆ กัน */
  const wg = wireCanvas.getContext('2d') as CanvasRenderingContext2D
  const wd = wg.getImageData(0, 0, wireCanvas.width, wireCanvas.height).data
  /*
   * ตารางหยาบขนาดเท่าก้อนปลายทาง: ช่องที่มีเส้น/ก้อนของ wireframe (พิกเซลใดในช่องทึบพอ) = ที่ลงของหนึ่งก้อน
   * แล้วเลือกให้ได้ N ช่องกระจายเท่า ๆ กัน (ช่องเกิน = ข้าม · ขาด = ก้อนซ้อนที่เดิม)
   */
  const filled: { x: number; z: number }[] = []
  const step = TILE
  for (let z = -CARD.l / 2 + step / 2; z < CARD.l / 2; z += step) {
    for (let x = -CARD.w / 2 + step / 2; x < CARD.w / 2; x += step) {
      let hit = false
      /* อ่าน 5×5 จุดต่อช่อง — เส้น 5px แคบกว่าระยะจุด 3×3 เดิม ตกหล่นทั้งเส้นได้ */
      for (let k = 0; k < 25 && !hit; k += 1) {
        const ox = ((k % 5) - 2) * step * 0.2
        const oz = (Math.floor(k / 5) - 2) * step * 0.2
        const px = Math.floor(((x + ox + CARD.w / 2) / CARD.w) * wireCanvas.width)
        const py = Math.floor(((z + oz + CARD.l / 2) / CARD.l) * wireCanvas.height)
        if (wd[(py * wireCanvas.width + px) * 4 + 3] > 150) hit = true
      }
      if (hit) filled.push({ x, z: z + CARD.z })
    }
  }
  const to: { x: number; z: number }[] = []
  for (let i = 0; i < N; i += 1) to.push(filled[Math.floor((i / N) * filled.length)] ?? { x: 0, z: 0 })
  const order = (a: { x: number; z: number }, b: { x: number; z: number }) => a.z - b.z || a.x - b.x
  to.sort(order)
  const fromSorted = from.map((f, i) => ({ ...f, i })).sort(order)
  const rnd = seeded(5)
  /*
   * gd = ลำดับถูกดูดเข้ากอง (ใกล้จุดคว้าก่อน) · ld = ลำดับลงจอด (ซ้ายไปขวา — wireframe พิมพ์ออกมาทีละคอลัมน์)
   * ph/cr/cy = ที่ของก้อนในกองที่หมุนวนรอบเคอร์เซอร์ (มุม รัศมี ความสูง)
   */
  const span = Math.hypot(PAPER.w, PAPER.l) / 2
  const cubes = fromSorted.map((f, k) => ({
    fx: f.x,
    fz: f.z,
    tx: to[k].x,
    tz: to[k].z,
    col: f.col,
    h: f.h,
    arc: 40 + rnd() * 70,
    gd: Math.min(1, Math.hypot(f.x - GRAB_M.x, f.z - GRAB_M.z) / span),
    ld: clamp01((to[k].x + CARD.w / 2) / CARD.w * 0.85 + rnd() * 0.15),
    spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
    turns: (rnd() > 0.5 ? 1 : -1) * (1 + Math.floor(rnd() * 2)),
    ph: rnd() * Math.PI * 2,
    cr: 10 + Math.sqrt(rnd()) * 26,
    cy: (rnd() - 0.5) * 34,
  }))
  return cubes
}

/* ------------------------------------------------------------------ canvas scene */

/** ขอบเผื่อหมุดของกรอบเลือก (หน่วยเวที) */
const MQ_M = 3.5

export function ShredScene({ pose }: { pose: React.RefObject<ShredPose> }) {
  const { size, gl } = useThree()
  const invalidate = useThree((s) => s.invalidate)
  const root = useRef<THREE.Group>(null)
  const ipad = useRef<THREE.Group>(null)
  const paperMesh = useRef<THREE.Mesh>(null)
  const marquee = useRef<THREE.Mesh>(null)
  const pick = useRef<THREE.Mesh>(null)
  const cubesRef = useRef<THREE.InstancedMesh>(null)
  const card = useRef<THREE.Group>(null)
  const screen = useRef<THREE.Mesh>(null)
  const cursor = useRef<THREE.Mesh>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const frame = useMemo(newFrame, [])

  const built = useMemo(() => {
    const geos: THREE.BufferGeometry[] = []
    const mats: THREE.Material[] = []
    const texs: THREE.Texture[] = []

    /* iPad: ตัวเครื่องขาว (ขอบจอ + ข้าง) เจาะรูตรงจอ — ในรูคือฟ้าจริง (ชั้นสตูดิโอเจาะรูตรงกัน) */
    const outer = roundRectShape(SHRED.w, SHRED.d, SHRED.r)
    outer.holes.push(roundRectShape(SHRED.w - SHRED.bezel * 2, SHRED.d - SHRED.bezel * 2, SHRED.r - SHRED.bezel * 0.7))
    const body = new THREE.ExtrudeGeometry(outer, { depth: SHRED.t, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 3, curveSegments: 16 })
    body.rotateX(-Math.PI / 2)
    geos.push(body)
    const bodyM = new THREE.MeshStandardMaterial({ color: '#f7f8fb', roughness: 0.35, metalness: 0.05 })
    mats.push(bodyM)
    const sc = document.createElement('canvas')
    sc.width = 128
    sc.height = 128
    const sg = sc.getContext('2d') as CanvasRenderingContext2D
    const grd = sg.createRadialGradient(64, 64, 10, 64, 64, 64)
    grd.addColorStop(0, 'rgba(30,40,80,0.35)')
    grd.addColorStop(1, 'rgba(30,40,80,0)')
    sg.fillStyle = grd
    sg.fillRect(0, 0, 128, 128)
    const shTex = new THREE.CanvasTexture(sc)
    texs.push(shTex)
    const shadowG = new THREE.PlaneGeometry(SHRED.w * 1.35, SHRED.d * 1.5)
    shadowG.rotateX(-Math.PI / 2)
    geos.push(shadowG)
    const shadowM = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, toneMapped: false })
    mats.push(shadowM)

    /* เอกสาร */
    const paperTex = paperTexture()
    texs.push(paperTex)
    const paperG = new THREE.PlaneGeometry(PAPER.w, PAPER.l)
    paperG.rotateX(-Math.PI / 2)
    geos.push(paperG)
    const paperM = new THREE.ShaderMaterial({
      vertexShader: PAPER_VERT,
      fragmentShader: PAPER_FRAG,
      uniforms: { uMap: { value: paperTex }, uSel: { value: new THREE.Vector2(-1e4, -1e4) }, uAlpha: { value: 1 } },
      transparent: true,
      toneMapped: false,
    })
    mats.push(paperM)

    /* wireframe คม ๆ บนแผ่นขาว — ขึ้นตอนลูกบาศก์ละลายลง */
    const wireTex = wireTexture()
    texs.push(wireTex)
    const wireG = new THREE.PlaneGeometry(CARD.w, CARD.l)
    wireG.rotateX(-Math.PI / 2)
    geos.push(wireG)
    const wireM = new THREE.ShaderMaterial({
      vertexShader: PLAIN_VERT,
      fragmentShader: FADE_FRAG,
      uniforms: { uMap: { value: wireTex }, uAlpha: { value: 0 } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    mats.push(wireM)

    /* ลูกบาศก์ */
    const cubes = buildCubes(paperTex.image as HTMLCanvasElement, wireTex.image as HTMLCanvasElement)
    const cubeG = new THREE.BoxGeometry(1, 1, 1)
    geos.push(cubeG)
    const cubeM = new THREE.ShaderMaterial({
      vertexShader: CUBE_VERT,
      fragmentShader: CUBE_FRAG,
      uniforms: { uLight: { value: new THREE.Vector3(-0.35, 0.8, 0.5).normalize() } },
      toneMapped: false,
    })
    mats.push(cubeM)

    /* จอฟ้าจัดตอนจบ (ท่าโปสเตอร์) — แผ่นเท่ารูจอ ทับฟ้าของสตูดิโอ */
    const screenG = new THREE.ShapeGeometry(roundRectShape(SHRED.w - SHRED.bezel * 2, SHRED.d - SHRED.bezel * 2, SHRED.r - SHRED.bezel * 0.7), 12)
    screenG.rotateX(-Math.PI / 2)
    geos.push(screenG)
    const screenM = new THREE.MeshBasicMaterial({ color: '#3c3cf2', transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
    mats.push(screenM)
    /* แผ่นขาวหนา (หน้ากระดาษใหม่ที่ก้อนลงเรียง) + การ์ดเงาซ้อนหลังตอนตั้ง */
    const slabG = new THREE.ExtrudeGeometry(roundRectShape(CARD.w + 14, CARD.l + 14, 12), { depth: 6, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2, curveSegments: 8 })
    slabG.rotateX(-Math.PI / 2)
    slabG.translate(0, -8, 0)
    geos.push(slabG)
    const slabM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, transparent: true, opacity: 0 })
    const ghostM = new THREE.MeshStandardMaterial({ color: '#eef1f8', roughness: 0.4, transparent: true, opacity: 0, depthWrite: false })
    mats.push(slabM, ghostM)

    /* กรอบเลือก: ตัวลากคลุมเอกสาร + ตัวเลือกชิ้นงานบนการ์ด (มีเครื่องหมายบวก) — ระนาบเดียวกัน วัสดุคนละชุด */
    const mqG = new THREE.PlaneGeometry(1, 1)
    mqG.rotateX(-Math.PI / 2)
    geos.push(mqG)
    const mqOpts = (plus: number) => ({
      vertexShader: PLAIN_VERT,
      fragmentShader: MARQUEE_FRAG,
      uniforms: { uSize: { value: new THREE.Vector2(1, 1) }, uM: { value: MQ_M }, uAlpha: { value: 0 }, uPlus: { value: plus } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })
    const mqM = new THREE.ShaderMaterial(mqOpts(0))
    const pickM = new THREE.ShaderMaterial(mqOpts(1))
    pickM.uniforms.uSize.value.set((SEL_PX.w / WIRE.w) * CARD.w, (SEL_PX.h / WIRE.h) * CARD.l)
    mats.push(mqM, pickM)

    /* เคอร์เซอร์แก้วฝ้า — อยู่หน้าสุดเสมอ เขียนความลึกได้ (หน้ากับขอบลบมนของตัวเองบังกันถูก) */
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
    return { body, bodyM, shadowG, shadowM, paperG, paperM, wireG, wireM, cubes, cubeG, cubeM, screenG, screenM, slabG, slabM, ghostM, mqG, mqM, pickM, curG, curM, cshG, cshM, geos, mats, texs }
  }, [])

  useEffect(() => {
    const im = cubesRef.current
    if (!im) return
    built.cubes.forEach((c, i) => im.setColorAt(i, c.col))
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  }, [built])

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
      M0: new THREE.Matrix4().makeScale(0, 0, 0),
      Q: new THREE.Quaternion(),
      Q1: new THREE.Quaternion(),
      Q2: new THREE.Quaternion(),
      CQ: new THREE.Quaternion(),
      P: new THREE.Vector3(),
      S: new THREE.Vector3(),
      V0: new THREE.Vector3(),
      V1: new THREE.Vector3(),
      V2: new THREE.Vector3(),
      cs: newCursor(),
      pp: newPaperPose(),
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
    r.visible = on
    if (cursor.current) cursor.current.visible = on
    if (shadow.current) shadow.current.visible = on
    if (!on) {
      tmp.has = false
      return
    }
    const { M, M0, Q, Q1, Q2, CQ, P, S, V0, V1, V2, cs, pp, vel, prev } = tmp
    const time = clock.elapsedTime
    /* กล้องหายใจตามเวลา (ไม่ต้องเลื่อนก็ยังลอย) — หยุดก่อนถอยกล้อง เพราะรูจอของชั้น DOM ไม่หายใจตาม */
    const breathe = 1 - smooth(p.zoom / 0.2)
    stageFrame(size.width, size.height, p, frame, Math.sin(time * 0.37) * breathe, Math.sin(time * 0.29 + 1.3) * breathe)
    r.position.set(frame.pos.x, frame.pos.y - p.lift, frame.pos.z)
    r.quaternion.copy(frame.q)
    r.scale.setScalar(frame.sc)
    if (ipad.current) ipad.current.visible = p.zoom > 0
    cursorAt(p, cs)

    /* เอกสาร: ไถลเข้า ถูกลาก วางลง — ส่วนในกรอบเลือกหายไปเป็นลูกบาศก์ */
    const s = p.scan
    const t = p.sort
    const selK = inOut((s - 0.12) / 0.76)
    const sel = s > 0.12 || t > 0 || p.zoom > 0
    const selX = sel ? lerp(SEL_A.x, SEL_B.x, selK) : -1e4
    const selZ = sel ? lerp(SEL_A.z, SEL_B.z, selK) : -1e4
    const pm = paperMesh.current
    if (pm) {
      pm.visible = p.paper > 0 && s < 0.88 && t <= 0
      paperPose(p.paper, pp)
      pm.position.copy(pp.pos)
      pm.rotation.y = pp.yaw
      built.paperM.uniforms.uSel.value.set(selX, selZ)
    }
    /* กรอบเลือกที่ลากอยู่ — จางหายตอนคว้ากองขึ้น */
    const mq = marquee.current
    if (mq) {
      const a = smooth((s - 0.1) / 0.04) * (1 - smooth(t / 0.12))
      mq.visible = a > 0.001 && p.zoom <= 0
      const w = Math.max(0.5, selX - SEL_A.x)
      const l = Math.max(0.5, selZ - SEL_A.z)
      mq.position.set(SEL_A.x + w / 2, PAPER.y + 1, SEL_A.z + l / 2)
      mq.scale.set(w + 2 * MQ_M, 1, l + 2 * MQ_M)
      built.mqM.uniforms.uSize.value.set(w, l)
      built.mqM.uniforms.uAlpha.value = a
    }

    /* การ์ด: แผ่นขาวขึ้นใต้กองก่อนก้อนแรกลง · ตั้งขึ้นตอนถอยกล้อง */
    const st = standK(p.zoom)
    const th = STAND.tilt * st
    const gk = lerp(1, STAND.grow, st)
    const cg = card.current
    if (cg) {
      cardPivot(st, cg.position)
      cg.rotation.x = th
      cg.scale.setScalar(gk)
    }
    built.slabM.opacity = p.zoom > 0 ? 1 : smooth((t - 0.42) / 0.12)
    built.slabM.visible = built.slabM.opacity > 0.001
    built.ghostM.opacity = 0.6 * smooth((st - 0.4) / 0.6)
    built.ghostM.visible = st > 0.4
    built.wireM.uniforms.uAlpha.value = smooth(p.zoom / 0.2)
    if (screen.current) screen.current.visible = p.zoom > 0.5
    built.screenM.opacity = 0.92 * smooth((p.zoom - 0.5) / 0.5)
    /* คลิกเลือกชิ้นงาน: กรอบม่วงเด้งขึ้นรอบกล่องขวาล่าง */
    const pk = pick.current
    if (pk) {
      const a = smooth((p.zoom - 0.25) / 0.05)
      pk.visible = a > 0.001
      const pop = 1 + 0.14 * (1 - smooth((p.zoom - 0.25) / 0.1))
      const u = built.pickM.uniforms.uSize.value as THREE.Vector2
      pk.position.set(wireX(SEL_PX.x + SEL_PX.w / 2), 1.2, wireZ(SEL_PX.y + SEL_PX.h / 2))
      pk.scale.set((u.x + 2 * MQ_M) * pop, 1, (u.y + 2 * MQ_M) * pop)
      built.pickM.uniforms.uAlpha.value = a
    }

    /* ลูกบาศก์ */
    const im = cubesRef.current
    if (im) {
      im.visible = sel
      if (im.visible) {
        const swirl = t * Math.PI * 4 + time * 0.9
        built.cubes.forEach((c, i) => {
          const born = s >= 0.88 || t > 0 || p.zoom > 0 ? 1 : smooth(Math.min(selX - c.fx, selZ - c.fz) / 9)
          const melt = p.zoom > 0 ? smooth((p.zoom - 0.02 - c.ld * 0.1) / 0.1) : 0
          if (born <= 0.001 || melt >= 0.999) {
            im.setMatrixAt(i, M0)
            return
          }
          const eg = inOut((t - 0.12 - c.gd * 0.14) / 0.16)
          const el = t > 0.5 ? inOut((t - 0.5 - c.ld * 0.3) / 0.16) : 0
          /* เกิด: เด้งนูนขึ้นจากผิวกระดาษตามความสูงของเนื้อ (เลยไปนิดแล้วผ่อนกลับ) */
          const rise = born < 1 ? born * (1 + 0.35 * Math.sin(Math.PI * born)) : 1
          const hgt = CELL * 0.9 * c.h * rise
          V0.set(c.fx, PAPER.y + hgt / 2, c.fz)
          /* ในกอง: หมุนวนรอบปลายเคอร์เซอร์ (ปล่อยแล้วกองค้างกลางอากาศ ทยอยออกไปลงทีละก้อน) */
          V1.copy(t <= 0.5 ? cs.pos : HOLD)
          const ang = c.ph + swirl
          V1.x += Math.cos(ang) * c.cr + 6
          V1.y += c.cy - 6
          V1.z += Math.sin(ang) * c.cr + 8
          cardPoint(c.tx, 2.6, c.tz - CARD.l / 2, st, V2)
          P.lerpVectors(V0, V1, eg).lerp(V2, el)
          P.y += Math.sin(Math.PI * eg) * c.arc * 0.25 * (1 - el) + Math.sin(Math.PI * el) * c.arc * 0.45
          const s0 = CELL * 0.9 * Math.min(1, born * 1.4)
          const sC = CELL * 0.72
          const sT = TILE * 0.9 * gk
          const k = 1 - melt
          const sx = lerp(lerp(s0, sC, eg), sT, el) * k
          const sy = lerp(lerp(Math.max(1e-3, hgt), sC, eg), sT * 0.35, el) * k
          Q1.setFromAxisAngle(c.spin, (t * 5 + time * 1.1 + c.ph) * eg)
          Q2.setFromAxisAngle(c.spin, Math.sin(Math.PI * el) * c.turns * Math.PI)
          Q.slerpQuaternions(Q1, Q2, el).premultiply(CQ.setFromAxisAngle(AX, th * el))
          S.set(Math.max(1e-3, sx), Math.max(1e-3, sy), Math.max(1e-3, sx))
          M.compose(P, Q, S)
          im.setMatrixAt(i, M)
        })
        im.instanceMatrix.needsUpdate = true
      }
    }

    /* เคอร์เซอร์ (พิกัดโลก ไม่หมุนตามเวที — หันเข้ากล้องเสมอ) + เงาบนพื้นใต้มัน */
    const cur = cursor.current
    const sh = shadow.current
    if (cur && sh) {
      V0.copy(cs.pos).multiplyScalar(frame.sc).applyQuaternion(frame.q).add(frame.pos)
      V0.y -= p.lift
      /* ความเร็ว (px/วินาที) แบบหน่วง — เคอร์เซอร์เอนตามทางที่วิ่ง หยุดเลื่อนแล้วค่อยตั้งตรง */
      if (tmp.has && dt > 0) {
        const k = 1 - Math.exp(-dt * 6)
        vel.x += ((V0.x - prev.x) / dt - vel.x) * k
        vel.y += ((V0.y - prev.y) / dt - vel.y) * k
      }
      prev.copy(V0)
      tmp.has = true
      const lean = (v: number, k: number) => Math.max(-0.32, Math.min(0.32, v * k))
      /* ส่งไม้คืน: หดหายตรงที่ตัวเองอยู่ ลูกศรของหน้าโตขึ้นแทนที่จุดเดียวกัน (ดู BubbleTraveler) */
      const size0 = lerp(150, 112, smooth((p.zoom - 0.3) / 0.7)) * cs.show * (1 - smooth(p.exit))
      const sz = Math.max(1e-3, size0 * (1 - 0.07 * cs.press))
      /*
       * ตอนเกิด: โผล่จากปลายข้อความในฟอง กระโดดออกมาทางขวาล่างของฟอง แล้วออกเดินจากตรงนั้นไปคว้าเอกสาร
       * (เยื้องจากที่ของมันบนเวที — ระยะเยื้องจางหายระหว่างทางไปหาเอกสาร ไม่ต้องย้อนกลับกลางจอก่อน)
       */
      let cx = V0.x
      let cy = V0.y
      let szNow = sz
      /** ออกจากฟองแล้วแค่ไหน (0 = ยังอยู่ข้างใน) — ลอย/เงาตามมาเมื่อพ้นผิวฟอง */
      let outK = 1
      const away = inOut(p.paper / 0.33)
      const um = built.curM.uniforms
      if (BUBBLE.ok && away < 1) {
        /*
         * อาศัยอยู่ในฟอง: พิมพ์จบ มันอยู่ข้างในแล้ว (ตัวเล็กพอดีฟอง เห็นจาง ๆ ผ่านแก้ว — ดู uBub ในเชดเดอร์)
         * แล้วมุดทะลุขอบขวาของฟองออกมา โตเต็มตัวตอนพ้นผิว ฟองป่องรับจังหวะนั้น (ดู BubbleTraveler)
         */
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
      const hover = (lerp(30, 7, cs.press) + Math.sin(time * 2.1) * 3 * (1 - cs.press)) * outK
      cur.position.set(cx, cy + hover, 1000)
      cur.scale.setScalar(szNow)
      cur.rotation.set(-0.3 + lean(vel.y, 0.0004), 0.42 + lean(vel.x, 0.0003), lean(-vel.x, 0.00025) + Math.sin(time * 1.3) * 0.03)
      sh.position.set(cx + hover * 0.55, cy - hover * 0.35, 999)
      GLASS.ok = true
      GLASS.x = cx + size.width / 2
      GLASS.y = size.height / 2 - (cy + hover)
      placeSpot(CURSOR_SPOT.glass, GLASS.x, GLASS.y)
      sh.scale.setScalar(szNow)
      sh.rotation.z = cur.rotation.z
      built.cshM.opacity = lerp(0.75, 0.4, (hover - 7) / 26) * cs.show * outK
    }
    /* ลอย หมุนวน หายใจ — ขอเฟรมต่อจนถอยกล้องจบ */
    if (p.zoom < 1) invalidate()
  })

  return (
    <>
      <group ref={root} visible={false}>
        <group ref={ipad} visible={false}>
          <mesh geometry={built.shadowG} material={built.shadowM} position={[0, -2, 14]} renderOrder={-1} />
          <mesh geometry={built.body} material={built.bodyM} />
        </group>
        <mesh ref={screen} geometry={built.screenG} material={built.screenM} position={[0, SHRED.t - 1, 0]} renderOrder={0} visible={false} />
        <group ref={card}>
          <mesh geometry={built.slabG} material={built.ghostM} position={[-24, -18, -22 - CARD.l / 2]} renderOrder={1} />
          <mesh geometry={built.slabG} material={built.ghostM} position={[-12, -9, -11 - CARD.l / 2]} renderOrder={1} />
          <mesh geometry={built.slabG} material={built.slabM} position={[0, 0, -CARD.l / 2]} renderOrder={1} />
          <mesh geometry={built.wireG} material={built.wireM} position={[0, 0.4, -CARD.l / 2]} renderOrder={2} />
          <mesh ref={pick} geometry={built.mqG} material={built.pickM} renderOrder={6} visible={false} />
        </group>
        <mesh ref={paperMesh} geometry={built.paperG} material={built.paperM} renderOrder={2} />
        <instancedMesh ref={cubesRef} args={[built.cubeG, built.cubeM, built.cubes.length]} frustumCulled={false} />
        <mesh ref={marquee} geometry={built.mqG} material={built.mqM} renderOrder={6} visible={false} />
      </group>
      <mesh ref={shadow} geometry={built.cshG} material={built.cshM} renderOrder={20} visible={false} />
      <mesh ref={cursor} geometry={built.curG} material={built.curM} renderOrder={21} visible={false} />
    </>
  )
}

/* ------------------------------------------------------------------ DOM overlay */

/**
 * สตูดิโอขาวรอบ iPad + หัวเรื่องของบีต — ชั้น DOM ใต้แคนวาสของฟอง
 * สตูดิโอเจาะรูตามขอบจอที่ฉายลงจอภาพทุกเฟรม (clip-path evenodd) ตอนเริ่มถอยกล้องรูใหญ่กว่าจอภาพ = มองไม่เห็นสตูดิโอเลย
 *
 * หัวเรื่องเล่าเรื่องเดียวกับฉาก ไม่ใช่ป้ายแปะ:
 *   "complex requirements" มาแบบรก — ตัวอักษรเอียงคนละทาง ปนฟอนต์ ขีดฆ่าแดง (หน้าตาเดียวกับเอกสารที่ลงมา)
 *   สแกนไปพร้อมกระดาษ บนลงล่าง: เหนือแนวสแกนกลายเป็นคำเรียบร้อยสีจาง มีเส้นฟ้าวิ่งตรงแนว
 *   "into effortless experiences." ลงทีละตัวตอนลูกบาศก์บินไปเรียง · เส้นใต้วาดตอนถอยกล้องจบ
 */
const MESS = 'complex requirements'
const CLEAN = 'effortless experiences.'
const SLICES = 1
/** ท่ารก ๆ ของแต่ละตัว (คงที่ — สุ่มจากเมล็ดเดียวกันทุกครั้ง) */
const MESS_CHARS = (() => {
  let seed = 11
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  const fonts = ['inherit', 'Georgia, serif', 'ui-monospace, Menlo, monospace', '"Comic Sans MS", "Chalkboard SE", cursive']
  return MESS.split('').map((ch, i) => ({
    ch,
    style: {
      display: 'inline-block',
      transform: `translateY(${(r() * 0.09).toFixed(3)}em) rotate(${(r() * 9).toFixed(1)}deg)`,
      fontFamily: fonts[Math.abs(Math.round(r() * 10 + i)) % fonts.length],
      fontWeight: r() > 0.2 ? 700 : 400,
      fontStyle: r() > 0.5 ? 'italic' : 'normal',
      whiteSpace: 'pre',
    } as React.CSSProperties,
  }))
})()

export function ShredOverlay({ bind }: { bind: React.RefObject<((p: ShredPose) => void) | null> }) {
  const studio = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const line1 = useRef<HTMLSpanElement>(null)
  const line2 = useRef<HTMLSpanElement>(null)
  const slices = useRef<(HTMLSpanElement | null)[]>([])
  const scribble = useRef<HTMLSpanElement>(null)
  const neat = useRef<HTMLSpanElement>(null)
  const clean = useRef<(HTMLSpanElement | null)[]>([])
  const swoosh = useRef<HTMLSpanElement>(null)
  const scanline = useRef<HTMLSpanElement>(null)
  const frame = useMemo(newFrame, [])
  /** ขอบซ้ายหัวเรื่อง (px) — ขอบเครื่อง/สตูดิโอขาวแตะตัวหนังสือเมื่อไร เปลี่ยนเป็นหมึกกรมท่าทันที (ขาวบนขาว = หาย) */
  const headLeft = useRef(0)
  useEffect(() => {
    const hd = head.current
    if (!hd) return
    const ro = new ResizeObserver(() => {
      const r = hd.getBoundingClientRect()
      headLeft.current = r.left
    })
    ro.observe(hd)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const pt = { x: 0, y: 0 }
    bind.current = (p) => {
      const st = studio.current
      const hd = head.current
      if (!st || !hd) return
      /* สตูดิโอมีเฉพาะตอนถอยกล้อง · หัวเรื่องมีตั้งแต่กระดาษลงมา (ตอนนั้นยังอยู่บนฟ้า = จอ iPad) */
      const studioOn = p.on && p.zoom > 0
      st.style.visibility = studioOn ? 'visible' : 'hidden'
      hd.style.visibility = p.on && p.paper > 0 ? 'visible' : 'hidden'
      hd.style.transform = `translateY(${p.lift.toFixed(1)}px)`
      let holeLeft = Infinity
      if (studioOn) {
        const W = window.innerWidth
        const H = window.innerHeight
        stageFrame(W, H, p, frame)
        frame.pos.y -= p.lift
        let d = `M0 0H${W}V${H}H0Z M`
        SCREEN_RING.forEach((v, i) => {
          project(frame, W, H, v, pt)
          d += `${i ? 'L' : ''}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
          holeLeft = Math.min(holeLeft, pt.x)
        })
        st.style.clipPath = `path(evenodd, "${d}Z")`
      }
      /* บนฟ้า (จอ) ตัวหนังสือขาว · ขอบเครื่องสีขาวเริ่มเข้ามาใต้หัวเรื่องเมื่อไร เป็นหมึกกรมท่า (ดู .sh-head[data-studio]) */
      hd.dataset.studio = studioOn && holeLeft > headLeft.current + 8 ? '1' : '0'

      /* บรรทัดแรกขึ้นพร้อมกระดาษ — คำรกหน้าตาเดียวกับเอกสาร มีขีดฆ่าแดง */
      /* บรรทัดแรกขึ้นตอนเคอร์เซอร์ลากเอกสารเข้ามา */
      const k1 = smooth((p.paper - 0.3) / 0.45)
      if (line1.current) {
        line1.current.style.transform = `translateY(${((1 - k1) * 105).toFixed(1)}%)`
        line1.current.style.opacity = String(k1)
      }
      const box = line1.current?.parentElement
      if (box) box.style.overflow = k1 > 0.999 ? 'visible' : 'hidden'
      if (scribble.current) {
        scribble.current.style.transform = `rotate(-2deg) scaleX(${smooth((p.paper - 0.6) / 0.4).toFixed(3)})`
        scribble.current.style.opacity = String(1 - smooth((p.scan - 0.12) / 0.3))
      }
      /*
       * คำรกถูกเลือกไปพร้อมกรอบเลือกบนเอกสาร: แถบเลือกม่วงลากจากซ้ายไปขวา (ท่าเลือกข้อความ)
       * ส่วนที่ถูกเลือกแล้วกลายเป็นคำเรียบร้อย ที่เหลือยังรก — จังหวะเดียวกับมุมกรอบที่เคอร์เซอร์ลาก
       */
      const k = inOut((p.scan - 0.12) / 0.76)
      const pct = (k * 100).toFixed(2)
      slices.current.forEach((el) => {
        if (el) el.style.clipPath = `inset(-30% -6% -30% ${pct}%)`
      })
      if (neat.current) {
        neat.current.style.opacity = '1'
        neat.current.style.clipPath = `inset(-30% ${(100 - k * 100).toFixed(2)}% -30% -6%)`
      }
      if (scanline.current) {
        scanline.current.style.width = `${pct}%`
        scanline.current.style.opacity = String(smooth((p.scan - 0.1) / 0.05) * (1 - smooth(p.sort / 0.12)))
      }

      /* บรรทัดสอง: มาพร้อมลูกบาศก์ที่บินไปเรียง — ทีละตัวตามจังหวะการเรียง */
      if (line2.current) line2.current.style.opacity = String(smooth((p.sort - 0.45) / 0.12))
      const n = clean.current.length
      clean.current.forEach((el, i) => {
        if (!el) return
        const kc = smooth((p.sort - 0.5 - (i / n) * 0.4) / 0.12)
        el.style.opacity = String(kc)
        el.style.transform = `translateY(${((1 - kc) * 0.45).toFixed(3)}em)`
        el.style.filter = `blur(${((1 - kc) * 8).toFixed(1)}px)`
      })
      if (swoosh.current) swoosh.current.style.transform = `scaleX(${smooth((p.zoom - 0.75) / 0.25).toFixed(3)})`
    }
    return () => {
      bind.current = null
    }
  }, [bind, frame])

  const messRow = (
    <span className="sh-mess-text" aria-hidden>
      {MESS_CHARS.map((c, i) => (
        <span key={i} style={c.style}>
          {c.ch}
        </span>
      ))}
    </span>
  )

  return (
    <>
      <div ref={studio} className="sh-studio" style={{ visibility: 'hidden' }} aria-hidden />
      <div ref={head} className="sh-head" style={{ visibility: 'hidden' }}>
        <h2 className="sh-title" aria-label="I turn complex requirements into effortless experiences.">
          <span className="sh-line">
            <span ref={line1}>
              I turn{' '}
              <span className="sh-mess">
                {/* คำรกที่ถูกหั่น: สำเนาเดียวกัน SLICES ชุด แต่ละชุดเห็นแค่แถบตั้งของตัวเอง */}
                {Array.from({ length: SLICES }, (_, i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      slices.current[i] = el
                    }}
                    className="sh-slice"
                  >
                    {messRow}
                  </span>
                ))}
                {/* ขนาดจริงของช่อง = คำรกหนึ่งชุด (มองไม่เห็น) */}
                <span className="sh-mess-size">{messRow}</span>
                <span ref={scribble} className="sh-scribble" aria-hidden />
                <span ref={neat} className="sh-neat">
                  {MESS}
                </span>
                <span ref={scanline} className="sh-scanline" aria-hidden />
              </span>
            </span>
          </span>
          {/* บรรทัดสองจางเข้าเฉย ๆ ไม่ไถลขึ้น — ไม่ต้องตัดขอบ (เส้นใต้ที่วาดตอนจบล้นบรรทัดลงมานิดหนึ่ง) */}
          <span className="sh-line" style={{ overflow: 'visible' }}>
            <span ref={line2}>
              into{' '}
              <span className="sh-clean">
                {CLEAN.split('').map((ch, i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      clean.current[i] = el
                    }}
                  >
                    {ch}
                  </span>
                ))}
                <span ref={swoosh} className="sh-swoosh" aria-hidden />
              </span>
            </span>
          </span>
        </h2>
      </div>
    </>
  )
}
