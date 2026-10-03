import type { RefObject } from 'react'
import { PORTAL_SKIN, SKIN, portalBox } from '@/sections/whatidocard/stageTuner'

/**
 * ปุ่มค้นหากลายเป็นหน้าต่างพอร์ทัลของจอถัดไป (WhatIDoCard — กองหน้าต่าง Mac ดำ จอเขียว + รอยสาดเผยรูปจริง)
 *
 * ท่าเดียวกับที่ ScrollTell เคยส่งไม้ให้จอนั้น (ท่า genie): แผ่น DOM ที่เป็นเงาของหน้าต่างใบพอร์ทัล
 * ยืดจากปุ่ม (เม็ดยาน้ำเงิน) ไปลงกรอบของใบจริงพอดี — กรอบปลายทางมาจาก portalBox ส่วนแถบหัว จุดสามจุด
 * ขอบรอบจอ มาจาก PORTAL_SKIN ชุดเดียวกับที่ฉากปั้นเรขาคณิต ไม่ได้กะเอาเอง
 *
 * พื้นหลังค่อย ๆ กลายเป็นขาวแบบพื้นของจอนั้น จอนั้นเลื่อนขึ้นมาใต้พื้นขาว พอตรึงถึงขอบบน แผ่นกับพื้น
 * จางทิ้ง เหลือหน้าต่างใบจริงที่กรอบเดียวกัน
 */

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const INK = [32, 82, 205]
const SHELL = hex(SKIN.frame)
const DOTS = ['#ff5f57', '#febc2e', '#28c840']

export type MacEls = {
  win: RefObject<HTMLDivElement | null>
  bar: RefObject<HTMLDivElement | null>
  screen: RefObject<HTMLDivElement | null>
  veil: RefObject<HTMLDivElement | null>
}
type Rect = { x: number; y: number; w: number; h: number }
/** morph/bar 0..1 · hand = ส่งไม้ให้ใบจริง 0..1 */
type Pose = { morph: number; bar: number; hand: number }

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const mix = (a: number[], b: number[], k: number, alpha = 1) =>
  `rgba(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')},${alpha.toFixed(3)})`
/** ขอบสี่ด้าน ease คนละจังหวะ (บนถึงก่อน ล่างช้าสุด) — แผ่นถูกดึงยืด ไม่ใช่สี่เหลี่ยมขยายพร้อมกัน */
const outQuint = (x: number) => 1 - (1 - x) ** 5

/** วางแผ่นกับพื้นของเฟรมนี้ — เรียกจากลูปเฟรมของฟอง (ไม่ผ่าน React) */
export function driveMac(els: MacEls, p: Pose, btn: Rect, W: number, H: number) {
  const win = els.win.current
  const veil = els.veil.current
  if (!win || !veil) return
  if (p.morph <= 0 || p.hand >= 1) {
    win.style.visibility = 'hidden'
    veil.style.visibility = 'hidden'
    return
  }
  win.style.visibility = 'visible'
  veil.style.visibility = 'visible'
  const card = portalBox()
  const th = H * card.vh
  const tw = th * card.ar
  /**
   * ปลายทาง = กรอบของใบจริงตอนจอถัดไปตรึงอยู่ที่ขอบบน — ไม่เกาะไปกับจอนั้นตอนมันเลื่อนขึ้นมา
   * (มันเลื่อนอยู่ใต้พื้นขาวทึบ มองไม่เห็นอยู่แล้ว ถ้าเกาะ แผ่นจะถูกลากลงไปใต้จอตอนกำลังยืด)
   */
  const to: Rect = { x: (W - tw) / 2 + H * card.dx, y: (H - th) / 2 + H * card.dy, w: tw, h: th }
  const m = p.morph
  const top = lerp(btn.y, to.y, outQuint(clamp01(m / 0.7)))
  const bot = lerp(btn.y + btn.h, to.y + to.h, clamp01(m) ** 1.6)
  const side = outQuint(clamp01(m / 0.85)) ** 1.1
  const left = lerp(btn.x, to.x, side)
  const right = lerp(btn.x + btn.w, to.x + to.w, side)
  win.style.transform = `translate3d(${left}px, ${top}px, 0)`
  win.style.width = `${Math.max(1, right - left)}px`
  win.style.height = `${Math.max(1, bot - top)}px`
  win.style.borderRadius = `${lerp(btn.h / 2, th * PORTAL_SKIN.radius, m)}px`
  /* ผิว: น้ำเงินของปุ่ม → เปลือกดำของหน้าต่างจริง ไล่เสร็จระหว่างยังเคลื่อนอยู่ ไม่ใช่สลับตอนถึง */
  const g = clamp01((m - 0.15) / 0.5)
  win.style.background = mix(INK, SHELL, g)
  win.style.opacity = (1 - p.hand).toFixed(3)
  const bar = els.bar.current
  if (bar) bar.style.opacity = p.bar.toFixed(3)
  const screen = els.screen.current
  if (screen) {
    screen.style.opacity = p.bar.toFixed(3)
    screen.style.borderRadius = `${th * PORTAL_SKIN.screenRadius}px`
  }
  /* พื้นกลายเป็นขาว (พื้นของจอถัดไป) ใต้แผ่น — จอนั้นจึงเลื่อนขึ้นมาใต้พื้นขาวโดยไม่เห็นรอยต่อ */
  veil.style.opacity = (clamp01((m - 0.05) / 0.35) * (1 - p.hand)).toFixed(3)
}

export function MacWindow({ els }: { els: MacEls }) {
  return (
    <>
      <div ref={els.veil} className="absolute inset-0" style={{ visibility: 'hidden', background: '#ffffff' }} />
      <div
        ref={els.win}
        className="absolute top-0 left-0"
        style={{ visibility: 'hidden', boxShadow: '0 30px 80px rgba(22,24,31,0.18)', willChange: 'transform, width, height' }}
      >
        {/* แถบหัว จุดสามจุด ขอบรอบหน้าจอ — สัดส่วนเดียวกับหน้าต่างจริง (PORTAL_SKIN) */}
        <div
          ref={els.bar}
          className="absolute inset-x-0"
          style={{ top: `${PORTAL_SKIN.padY * 100}%`, height: `${PORTAL_SKIN.bar * 100}%`, background: SKIN.bar, opacity: 0 }}
        >
          {DOTS.map((c, i) => (
            <i
              key={c}
              className="absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${(PORTAL_SKIN.dotX + i * PORTAL_SKIN.dotGap) * 100}%`, top: '50%', width: `${PORTAL_SKIN.dotR * 200}%`, background: c }}
            />
          ))}
        </div>
        <div
          ref={els.screen}
          className="absolute"
          style={{
            left: `${PORTAL_SKIN.screenX * 100}%`,
            right: `${PORTAL_SKIN.screenX * 100}%`,
            top: `${PORTAL_SKIN.screenTop * 100}%`,
            bottom: `${PORTAL_SKIN.screenBottom * 100}%`,
            background: SKIN.screen,
            opacity: 0,
          }}
        />
      </div>
    </>
  )
}
