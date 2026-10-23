import { useEffect, useRef, useState } from 'react'
import { AsciiClouds, type CloudBlob } from '@/components/AsciiClouds'
import { EXTRUDE_LEN, FastworkLogo3D } from './FastworkLogo3D'
import { FastworkHead3D } from './FastworkHead3D'
import modride from '@/assets/portfolios/modride-new-card.jpg'
import ekyc from '@/assets/portfolios/ekyc-new-card.jpg'
import hotel from '@/assets/portfolios/hotel-new-card.jpg'
import dashboard from '@/assets/portfolios/dashboard-new-card.jpg'
import modrideHifi from '@/assets/portfolios/modride-hifi-1.jpg'
import caseKeeper from '@/assets/portfolios/ck-um-1.jpg'

/**
 * หน้าปกโปรไฟล์ Fastwork (dev) — ท่าแบนเนอร์ Figma Config: พื้นดำ โลโก้ซ้ายบน แถวการ์ดงานโค้งเป็นผนังทรงกระบอก
 * (ซ้ายแบนไกล ขวาโค้งเข้าหาคนดูใหญ่ขึ้น) หัวเรื่องสองบรรทัดซ้ายล่าง รายการบริการขวาล่าง
 *
 * ผนังค้างนิ่ง แล้วหมุนวาบไปทางซ้ายหนึ่งชุดงาน ผ่อนจนหยุด วนซ้ำ (ลูปไม่มีรอยต่อ)
 * อาร์ตบอร์ด 1260 × 720 คงที่ ย่อ/ขยายให้พอดีจอ — จับภาพหน้าจอไปใช้เป็นปกได้ตรงสัดส่วน
 * การ์ด = งานจริงในพอร์ต (src/assets/portfolios) ข้อความ = คำของ Joe บนเว็บเอง (What I do: Research · Design · Code · Ship)
 */

const W = 1260
const H = 720

/** การ์ดเรียงซ้าย → ขวา — สองชุดต่อกัน ให้สายพานยาวพอวนโดยไม่เห็นรอยต่อ */
const WORKS = [caseKeeper, modride, ekyc, modrideHifi, hotel, dashboard]
const CARDS = [...WORKS, ...WORKS]
const CARD_W = 258
const CARD_H = 322
/** ขอบบนของแถวการ์ดบนอาร์ตบอร์ด (px) */
const WALL_TOP = 200
/** ช่องดำบาง ๆ คั่นระหว่างงาน (แบบต้นฉบับ) */
const GAP = 8
/** แต่ละใบหั่นเป็นแถบแนวตั้ง วางตามเส้นโค้งทีละแถบ — ผิวโค้งเนียน ไม่เป็นแผ่นเรียบหักมุม */
const SLICES = 14
const SW = CARD_W / SLICES
/** มุมมนเท่ากันทุกใบ (ไม่เกินความกว้างแถบ) · ขยายรูปนิดแล้วเลื่อนเข้า ตัดมุมมนที่ติดมากับรูปปกบางใบ */
const RAD = 14
const ZOOM = 1.03
const CROP = 3

/**
 * ผนังโค้ง: มุมหันของผนังเพิ่มขึ้นต่อเนื่องตามระยะ θ(s) = TURN·(s/L)^P (โค้งน้อยทางซ้าย ค่อย ๆ โค้งมากขึ้นทางขวา ไม่มีจุดหัก)
 * แล้วรวมทาง x, z ทีละช่วงสั้น ๆ เป็นตารางล่วงหน้า
 */
const TURN = 1.75
const L = 1250
const P = 3.2
const SMIN = -700
const SMAX = 2900
const DS = 2
const PATH = (() => {
  const n = Math.ceil((SMAX - SMIN) / DS) + 1
  const x = new Float32Array(n)
  const z = new Float32Array(n)
  const th = new Float32Array(n)
  let px = SMIN
  let pz = 0
  for (let k = 0; k < n; k++) {
    const sv = SMIN + k * DS
    const t = sv <= 0 ? 0 : TURN * Math.pow(sv / L, P)
    x[k] = px
    z[k] = pz
    th[k] = t
    px += Math.cos(t) * DS
    pz += Math.sin(t) * DS
  }
  return { x, z, th, n }
})()
function at(sv: number) {
  const f = Math.min(PATH.n - 1.001, Math.max(0, (sv - SMIN) / DS))
  const k = Math.floor(f)
  const u = f - k
  return {
    x: PATH.x[k] + (PATH.x[k + 1] - PATH.x[k]) * u,
    z: PATH.z[k] + (PATH.z[k + 1] - PATH.z[k]) * u,
    th: PATH.th[k] + (PATH.th[k + 1] - PATH.th[k]) * u,
  }
}

/**
 * จังหวะแบบปกต้นฉบับ (GIF 4.3 วิ): ค้างนิ่ง → ผนังหมุนวาบไปทางซ้ายหนึ่งชุด (6 ใบ) → ผ่อนยาวจนหยุดที่เดิม (ภาพเดิมพอดี) วนซ้ำ
 */
const HOLD = 1.8
const SPIN = 3.6
const STEP = CARD_W + GAP
const LOOP = CARDS.length * STEP
/** จุดเริ่มของสายพาน (ซ้ายพ้นจอ) */
const S0 = -CARD_W * 2
/** หันเกินนี้ = แถบหันสันเข้าหากล้อง — ซ่อน (ช่วงวนกลับไปเริ่มใหม่อยู่ในช่วงนี้) */
const TH_HIDE = 1.72
/**
 * หนึ่งรอบของแบนเนอร์ — วนต่อเนื่องไร้รอยต่อ (อัดเป็นวิดีโอ/GIF ลูปได้) · จังหวะเรียบหรู ไม่เด้ง ไม่วาบ:
 *   เข้า   JOE 3D นูนขึ้นที่มุม · ผนังไหลเข้าระยะสั้นแล้วผ่อน การ์ดลอยขึ้นช้า ๆ จากหมอกฟ้าทีละใบ · ข้อความเข้าตาม (FW_CSS)
 *   กลาง   หมุนสองรอบ (ค้าง → หมุน → ผ่อนยาว) จบที่ภาพเดิมพอดี
 *   ออก    ผนังไหลซ้ายช้า ๆ การ์ดจมลงนิดแล้วกลืนไปกับฟ้า ข้อความถอยทางเดิม JOE แบนลงแล้วจาง
 *   รอยต่อ: ทุกอย่างกลืนหายแล้ว เหลือฟ้ากับเมฆ (เมฆอยู่นอกรอบ ลอยต่อเนื่อง) → รอบใหม่
 */
const SPINS = 2
const OUT_LEN = 1.4
const INTRO = 2.6
/* เปิดตัวแบบนุ่ม: ผนังไหลเข้ามาระยะสั้น ๆ แล้วผ่อนเข้าที่ (ไม่พุ่งวาบ) */
const INTRO_RUN = 0.7 * CARD_W * 6
/**
 * ลำดับ: JOE 3D นูนขึ้นที่มุมซ้ายบน · การ์ดเปิดจอ CRT พร้อมผนังพุ่งเข้าจากขวา (เริ่ม WALL0) · ข้อความเข้า
 * ปิดตัว: ผนังเร่งออก การ์ดปิดจอ ข้อความถอย JOE แบนลงแล้วจาง → รอบใหม่
 */
const WALL0 = 0.25
const TEXT0 = 0
const LOGO_3D_ON = 0.1
const OUT_AT = WALL0 + INTRO + SPINS * (HOLD + SPIN)
const LOGO_3D_OFF = OUT_AT + 0.5
const CYCLE = Math.max(OUT_AT + OUT_LEN, LOGO_3D_OFF + EXTRUDE_LEN) + 0.25
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
/**
 * พื้นฟ้าแบบ /2026-final: น้ำเงินเข้มด้านบนไล่ฟ้าสว่างลงล่าง + ก้อนเมฆนุ่มที่ขอบ
 * FOG_* = สีพื้นตรงความสูงของแถวการ์ด (ราว 31% และ 69% ของความสูง) — หมอกตอนเปิดตัว
 */
const SKY = 'linear-gradient(180deg, #2f66d8 0%, #4a86e8 55%, #7fb0f2 100%)'
const FOG_TOP = '62,120,225'
const FOG_BOT = '90,147,235'
/** เข้า: หน่วงด้วย --d · ออก (.fw-out บนราก): หน่วงด้วย --od */
const FW_CSS = `
@keyframes fw-rise { from { opacity: 0; transform: translateY(12px); filter: blur(6px) } to { opacity: 1; transform: none; filter: none } }
@keyframes fw-rise-r { from { opacity: 0; transform: translateY(18px); filter: blur(10px) } to { opacity: 1; transform: none; filter: none } }
@keyframes fw-line { from { transform: translateY(110%) rotate(3deg) } to { transform: none } }
@keyframes fw-line-r { from { transform: translateY(110%) rotate(3deg) } to { transform: none } }
@keyframes fw-pop { 0% { opacity: 0; transform: scale(.4) rotate(-14deg); filter: blur(6px) } 100% { opacity: 1; transform: none; filter: none } }
@keyframes fw-pop-r { 0% { opacity: 0; transform: scale(.4) rotate(-14deg); filter: blur(6px) } 100% { opacity: 1; transform: none; filter: none } }
.fw-rise { animation: fw-rise 1.2s cubic-bezier(.22,1,.36,1) var(--d, 0s) both }
.fw-line { display: block; transform-origin: 0 100%; animation: fw-line 1.05s cubic-bezier(.2,.9,.1,1) var(--d, 0s) both }
.fw-pop { animation: fw-pop .9s cubic-bezier(.34,1.56,.64,1) var(--d, 0s) both }
/* ออก = ท่าเข้าเล่นย้อน (คีย์เฟรมชื่อใหม่ ไม่งั้นเบราว์เซอร์ไม่เริ่มเล่นใหม่) — จบที่ท่าเริ่มพอดี รอยต่อเนียน */
.fw-out .fw-rise { animation: fw-rise-r .7s cubic-bezier(.8,0,.8,.2) var(--od, 0s) reverse both }
.fw-out .fw-line { animation: fw-line-r .7s cubic-bezier(.9,0,.8,.1) var(--od, 0s) reverse both }
.fw-out .fw-pop { animation: fw-pop-r .6s cubic-bezier(.6,-.5,.7,.2) var(--od, 0s) reverse both }
/* ตัวอักษรหัวเรื่อง: ลอยขึ้น 0.45em จากเบลอ ทีละตัว */
@keyframes fw-char { from { opacity: 0; transform: translateY(.3em); filter: blur(4px) } to { opacity: 1; transform: none; filter: none } }
@keyframes fw-char-r { from { opacity: 0; transform: translateY(.45em); filter: blur(8px) } to { opacity: 1; transform: none; filter: none } }
.fw-char { display: inline-block; animation: fw-char 1s cubic-bezier(.22,1,.36,1) var(--d, 0s) both }
.fw-out .fw-char { animation: fw-char-r .45s cubic-bezier(.6,0,.8,.3) var(--od, 0s) reverse both }
/* ไอคอน: หล่นลงจากบนนิด หมุนตั้งตรง ชัดจากเบลอ */
@keyframes fw-icon { from { opacity: 0; transform: translateY(-26px) rotate(-12deg) scale(.85); filter: blur(10px) } to { opacity: 1; transform: none; filter: none } }
@keyframes fw-icon-r { from { opacity: 0; transform: translateY(-26px) rotate(-12deg) scale(.85); filter: blur(10px) } to { opacity: 1; transform: none; filter: none } }
.fw-icon { animation: fw-icon .9s cubic-bezier(.25,1.4,.4,1) var(--d, 0s) both }
.fw-out .fw-icon { animation: fw-icon-r .55s cubic-bezier(.6,0,.8,.3) var(--od, 0s) reverse both }
@media (prefers-reduced-motion: reduce) { .fw-rise, .fw-line, .fw-pop, .fw-char, .fw-icon, .fw-out .fw-rise, .fw-out .fw-line, .fw-out .fw-pop, .fw-out .fw-char, .fw-out .fw-icon { animation: none } }
`
/** ปิดตัว: ผนังไหลซ้ายช้า ๆ ระยะนี้ (px) ระหว่างการ์ดกลืนหายไปกับฟ้า */
const OUT_DRIFT = 360
/** นาฬิกาของแบนเนอร์ — ผนัง (Banner) ตั้ง t0 ตอนเริ่ม โลโก้ 3D อ่านค่าเดียวกัน */
const CLOCK = { t0: performance.now(), len: 1 }
const posOf = (i: number, off: number) => S0 + ((((i * STEP + off) % LOOP) + LOOP) % LOOP)

/** ก้อนเมฆ ASCII ของปก: มุมขวาล่าง มุมขวาบน มุมซ้ายล่าง ขอบบนกลาง (ดู components/AsciiClouds) */
const BLOBS: CloudBlob[] = [
  { x: 0.88, y: 0.95, rx: 0.36, ry: 0.26, k: 1.15, ax: 0.08, ay: 0.04, wx: 0.21, wy: 0.17, ph: 0 },
  { x: 0.9, y: 0.06, rx: 0.28, ry: 0.19, k: 0.9, ax: 0.07, ay: 0.05, wx: 0.17, wy: 0.23, ph: 1.9 },
  { x: 0.06, y: 0.98, rx: 0.26, ry: 0.2, k: 1, ax: 0.06, ay: 0.03, wx: 0.25, wy: 0.19, ph: 3.4 },
  { x: 0.45, y: 0.02, rx: 0.2, ry: 0.14, k: 0.7, ax: 0.14, ay: 0.03, wx: 0.13, wy: 0.27, ph: 5.1 },
]
/** เว้นแนวหัวเรื่อง/บริการให้อ่านชัด */
const CLOUD_MASK = (x: number, y: number) => (x < 0.74 && y > 0.79 && y < 0.94 ? 0.15 : 1)

export default function FastworkProfile() {
  const [k, setK] = useState(1)
  useEffect(() => {
    const fit = () => setK(Math.min(window.innerWidth / W, window.innerHeight / H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#1f4fb8]">
      {/* กลางจอแบบตรึงตำแหน่ง — จอแคบกว่าอาร์ตบอร์ด grid จะดันอาร์ตบอร์ดเลยขอบขวา (ซ้ายล่างหลุดจอ) */}
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden text-white"
        style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${k})`, background: SKY }}
      >
        {/* เมฆตัวอักษร ASCII อยู่นอกรอบ — ลอยต่อเนื่องข้ามรอบ ไม่เริ่มใหม่ */}
        <AsciiClouds blobs={BLOBS} mask={CLOUD_MASK} width={W} height={H} />
        {/* โลโก้ 3D แคนวาสเดียวตลอด (ไม่ remount ข้ามรอบ) — ท่าเข้า/ออกอ่านนาฬิกาเดียวกับผนัง (CLOCK) */}
        <Banner />
        {/* ไอคอนซ้ายล่าง = favicon สด: การ์ดขึ้นก่อน → หัว 3D หมุนโผล่ในการ์ด → echo งอกทีละชั้น */}
        <FastworkHead3D clock={CLOCK} at={TEXT0 + 0.45} outAt={OUT_AT} className="pointer-events-none absolute left-[60px] top-[586px] size-[78px]" />
        {/* JOE 3D แคนวาสเต็มอาร์ตบอร์ด (บนสุด) — นูนขึ้นจากแผ่นแบนที่มุมซ้ายบน · ปิดตัวแบนลงแล้วจาง */}
        <FastworkLogo3D
          clock={CLOCK}
          times={{ on: LOGO_3D_ON, off: LOGO_3D_OFF }}
          className="pointer-events-none absolute inset-0"
        />
      </div>
    </div>
  )
}

/**
 * ผนังการ์ดใช้นาฬิกาเดียวต่อเนื่องตลอด (ไม่ remount) — ตำแหน่ง/ความเร็วข้ามรอบต่อกันเป๊ะ
 * ชั้นข้อความ remount ทุกรอบ (key = เลขรอบ) ให้ท่าเข้า CSS เริ่มใหม่ — นับรอบจากนาฬิกาเดียวกันในเฟรมเดียวกัน (โลโก้ 3D อ่าน CLOCK เอง)
 * เปิดจอ CRT เฉพาะรอบแรกที่เปิดหน้า · รอบต่อ ๆ ไปการ์ดอยู่ตลอด ผนังแค่เร่งหมุนผ่านรอยต่อแล้วผ่อนเข้าที่
 */
function Banner() {
  const [cycle, setCycle] = useState(0)
  const [out, setOut] = useState(false)

  const slices = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const t0 = performance.now()
    CLOCK.t0 = t0
    CLOCK.len = CYCLE
    let shown = 0
    let wasOut = false
    const tick = (now: number) => {
      const T = (now - t0) / 1000
      const n = still ? 0 : Math.floor(T / CYCLE)
      const t = still ? INTRO : T - n * CYCLE
      if (n !== shown) {
        shown = n
        setCycle(n)
      }
      const isOut = t >= OUT_AT
      if (isOut !== wasOut) {
        wasOut = isOut
        setOut(isOut)
      }
      let off: number
      /* เวลาของผนัง — เริ่มหลัง JOE ย้ายไปมุม */
      const tw = t - WALL0
      /* ออก: ผนังไหลซ้ายช้า ๆ ระหว่างการ์ดกลืนหาย (ไม่เร่งวาบ) */
      if (t >= OUT_AT) off = -OUT_DRIFT * Math.pow(Math.min(1, (t - OUT_AT) / OUT_LEN), 2)
      else if (tw < INTRO) {
        /* เปิดตัว: พุ่งเข้าจากขวา ผ่อนแบบ expo จนหยุดที่ตำแหน่งตั้งต้นของลูปพอดี */
        off = INTRO_RUN * (1 - easeOutExpo(Math.max(0, tw) / INTRO))
      } else {
        /* เร่งออกนุ่ม ๆ แล้วผ่อนยาว (ease-out หนัก) — ระยะหนึ่งชุดงาน = ภาพจบตรงกับภาพเริ่ม ลูปไม่มีรอยต่อ */
        const c = (tw - INTRO) % (HOLD + SPIN)
        const u = Math.max(0, (c - HOLD) / SPIN)
        const e = 1 - Math.pow(1 - Math.pow(u, 1.5), 4)
        off = -e * WORKS.length * STEP
      }
      for (let i = 0; i < CARDS.length; i++) {
        const s0 = posOf(i, off)
        /* ลำดับใบตามตำแหน่งตอนหยุด (ซ้าย → ขวา) — เปิดจอไล่ซ้ายไปขวา ปิดจอไล่ขวาไปซ้าย */
        const ord = ((((i * STEP) % LOOP) + LOOP) % LOOP) / STEP
        /* เข้า: ลอยขึ้นช้า ๆ จากหมอกฟ้า ไล่ซ้ายไปขวา (ease-out quint ไม่เด้ง) · ออก: จมลงนิดแล้วกลืนหายไปกับฟ้า ไล่ขวาไปซ้าย */
        const on = Math.min(1, Math.max(0, (tw - 0.15 - ord * 0.12) / 1.25))
        const offK = Math.min(1, Math.max(0, (t - OUT_AT - (CARDS.length - 1 - ord) * 0.06) / 0.9))
        const ei = 1 - Math.pow(1 - on, 5)
        const eo = offK * offK * (3 - 2 * offK)
        const sy = 1
        const rv = ei * (1 - eo)
        const flash = 0
        const lift = (1 - ei) * 46 + eo * 22
        for (let j = 0; j < SLICES; j++) {
          const el = slices.current[i * SLICES + j]
          if (!el) continue
          const p = at(s0 + (j + 0.5) * SW)
          /* เข้าใกล้กล้องเกิน (perspective 1100) แถบจะขยายล้นจอจนหน่วง — ซ่อนก่อน */
          const show = p.th < TH_HIDE && p.z < 820 && on > 0 && offK < 1
          el.style.visibility = show ? 'visible' : 'hidden'
          if (!show) continue
          el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${lift.toFixed(1)}px, ${p.z.toFixed(2)}px) rotateY(${(-p.th).toFixed(4)}rad) scaleY(${sy.toFixed(4)})`
          /* แสงบนผิวจอโค้ง: ส่วนที่หันออกจากคนดูมืดลงนุ่ม ๆ + แถบสะท้อนจางตรงช่วงโค้ง — อ่านเป็นจอแผ่นเดียวโค้งจริง */
          const sh = el.firstElementChild as HTMLElement | null
          if (sh) {
            /*
             * เปิดตัว: การ์ดโผล่ออกมาจากฟ้า — ทาสีฟ้า (ตรงกับพื้นที่ความสูงของแถวการ์ด) ทับแล้วจางออก
             * ไม่ใช้ opacity ของแถบ (แถบซ้อนกันนิดเห็นเส้นรอยต่อ) · หมอกสีเดียวกับพื้น เส้นขอบมุมมนจึงกลืนหาย
             * เงาไล่ต่อเนื่องข้ามแถบ: คิดที่ขอบซ้าย/ขวาของแต่ละแถบแล้วไล่สีระหว่างกัน (สีเดียวทั้งแถบจะเห็นเป็นขั้นบันได)
             */
            const sa = (th: number) => Math.min(0.55, Math.pow(Math.max(0, th) / TH_HIDE, 1.6) * 0.55).toFixed(3)
            const sm = s0 + (j + 0.5) * SW
            const fog = (1 - rv).toFixed(3)
            sh.style.background = `linear-gradient(rgba(255,255,255,${flash.toFixed(3)}), rgba(255,255,255,${flash.toFixed(3)})), linear-gradient(to bottom, rgba(${FOG_TOP},${fog}), rgba(${FOG_BOT},${fog})), linear-gradient(to right, rgba(0,0,0,${sa(at(sm - SW / 2).th)}), rgba(0,0,0,${sa(at(sm + SW / 2).th)}))`
          }
        }
      }
      if (!still) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className={`absolute inset-0 ${out ? 'fw-out' : ''}`}>
        <style>{FW_CSS}</style>
        {/* โลโก้ + ชื่อ */}
        {/* viewBox มีขอบเผื่อ 10 หน่วยรอบตัวอักษร (สูง 84) — ตัวอักษรสูง 50 px ตรงที่เดิม */}
        {/* ชั้นข้อความ/โลโก้ — remount ทุกรอบ ท่าเข้าเริ่มใหม่ */}
        <div key={`top-${cycle}`} className="contents">
        <p className="fw-rise absolute left-[64px] top-[124px] text-[19px] tracking-[-0.01em]" style={vars(TEXT0 + 0.35, 0.55)}>
          UX/UI Designer
        </p>
        </div>

        {/* ผนังการ์ดโค้ง */}
        <div className="absolute inset-0" style={{ perspective: '1100px', perspectiveOrigin: '46% 50%' }}>
          <div className="absolute left-0" style={{ top: WALL_TOP, transformStyle: 'preserve-3d' }}>
            {CARDS.map((src, i) =>
              Array.from({ length: SLICES }, (_, j) => (
                <div
                  key={`${i}-${j}`}
                  ref={(el) => {
                    slices.current[i * SLICES + j] = el
                  }}
                  className="absolute will-change-transform"
                  style={{
                    /* กว้างเกินนิด ทับรอยต่อระหว่างแถบ (ไม่เห็นเส้นดำบาง ๆ) */
                    width: SW + 0.8,
                    height: CARD_H,
                    left: -(SW + 0.8) / 2,
                    visibility: 'hidden',
                    backgroundImage: `url(${src})`,
                    /*
                     * สูงเกินการ์ดนิด ชิดซ้าย (รูปทุกใบกว้างกว่าสัดส่วนการ์ด) — ตัดมุมมนที่ติดมากับรูปปกบางใบทิ้ง
                     * แล้วใส่มุมมนเท่ากันทุกใบเอง (แถบแรก = มุมซ้าย · แถบท้าย = มุมขวา)
                     */
                    backgroundSize: `auto ${CARD_H * ZOOM}px`,
                    backgroundPosition: `${(-j * SW - CROP).toFixed(2)}px ${(-CARD_H * (ZOOM - 1)) / 2}px`,
                    backgroundRepeat: 'no-repeat',
                    borderRadius: j === 0 ? `${RAD}px 0 0 ${RAD}px` : j === SLICES - 1 ? `0 ${RAD}px ${RAD}px 0` : undefined,
                    overflow: 'hidden',
                  }}
                >
                  {/*
                   * เงาเต็มความกว้างแถบ (รวมส่วนที่ทับรอยต่อ) — แถบบนสุดทึบทั้งรูปทั้งเงา จึงไม่ซ้อนเข้ม
                   * ถ้าทาเฉพาะแกน ส่วนที่ทับรอยต่อจะสว่างกว่า เห็นเป็นเส้นขาวทุกแถบตอนเปิดตัว (ช่วงที่ยังมืด)
                   */}
                  <div className="absolute inset-0" />
                </div>
              )),
            )}
          </div>
        </div>

        {/* หัวเรื่อง + บริการ */}
        <div key={`bottom-${cycle}`} className="contents">
        {/* favicon ใหม่ของเว็บ (หัวตัวละคร + echo สีแบบ GitHub Universe) สูงเท่าหัวเรื่องสองบรรทัด */}
        {/* หัวเรื่องเข้าทีละตัวอักษร: ลอยขึ้นจากเบลอ ไล่ซ้ายไปขวา (ออก = ย้อนจากขวามาซ้าย) */}
        <h1 className="absolute left-[170px] top-[584px] text-[34px] font-medium leading-[1.15] tracking-[-0.02em]" aria-label={HEAD.join(' ')}>
          {HEAD.map((line, li) => (
            <span key={li} className="block whitespace-pre" aria-hidden>
              {[...line].map((ch, ci) => {
                const n = HEAD.slice(0, li).reduce((a, l) => a + l.length, 0) + ci
                return (
                  <span key={ci} className="fw-char" style={vars(TEXT0 + 0.75 + n * 0.022, (HEAD_LEN - n) * 0.01)}>
                    {ch}
                  </span>
                )
              })}
            </span>
          ))}
        </h1>
        <p className="fw-rise absolute left-[640px] top-[596px] text-[17px] leading-[1.45]" style={vars(TEXT0 + 1.1, 0)}>
          What I do:
          <br />
          Research, Design, Code, and Ship
        </p>
        </div>
    </div>
  )
}

/** หน่วงเข้า/ออกของชิ้นข้อความ (ดู FW_CSS) */
const HEAD = ['I turn complicated things', 'into digital products.']
const HEAD_LEN = HEAD.join('').length
const vars = (d: number, od: number) => ({ '--d': `${d}s`, '--od': `${od}s` }) as React.CSSProperties
