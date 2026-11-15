import { useEffect, useRef } from 'react'
import modride from '@/assets/portfolios/modride-new-card.jpg'
import ekyc from '@/assets/portfolios/ekyc-new-card.jpg'
import hotel from '@/assets/portfolios/hotel-new-card.jpg'
import dashboard from '@/assets/portfolios/dashboard-new-card.jpg'
import modrideHifi from '@/assets/portfolios/modride-hifi-1.jpg'
import caseKeeper from '@/assets/portfolios/ck-um-1.jpg'
import { WORKS_BOOM, WORKS_HOLD, worksPost, type WorkBeats } from './workMotion'

/**
 * section Selected Work แบบปกโปรไฟล์ Fastwork (pages/FastworkProfile — ผนังการ์ดโค้ง): หลังเล่มงานระเบิด หน้ากระดาษกระจายพ้นไป
 * แล้วการ์ดงานจริงเรียงเป็นผนังทรงกระบอก — ซ้ายแบนไกล ขวาโค้งเข้าหาคนดูใหญ่ขึ้น · ลอยขึ้นจากหมอกฟ้าทีละใบ (ซ้าย → ขวา)
 *
 * ต่างจากปก Fastwork: ผนังหมุนตามระยะเลื่อน (ช่วงค้าง WORKS_HOLD = หนึ่งชุดงานพอดี) ไม่ใช่วนตามเวลา · ท้ายบทจมลงกลืนกับฟ้า
 * คณิตผนังชุดเดียวกับปก: มุมหัน θ(s) = TURN·(s/L)^P รวมทาง x, z ล่วงหน้า · การ์ดตัดเป็นแถบตั้ง SLICES แถบตามผิวโค้ง
 * อาร์ตบอร์ด 1260 × 720 ของปก ย่อ/ขยายให้กว้างเต็มจอ
 */
const AW = 1260
const AH = 720
const WORKS = [caseKeeper, modride, ekyc, modrideHifi, hotel, dashboard]
const CARDS = [...WORKS, ...WORKS]
const CARD_W = 258
const CARD_H = 322
const WALL_TOP = 200
const GAP = 8
const SLICES = 14
const SW = CARD_W / SLICES
const RAD = 14
const ZOOM = 1.03
const CROP = 3
const TURN = 1.75
const L = 1250
const P = 3.2
const SMIN = -700
const SMAX = 2900
const DS = 2
const STEP = CARD_W + GAP
const LOOP = CARDS.length * STEP
const S0 = -CARD_W * 2
const TH_HIDE = 1.72
const FOG_TOP = '62,120,225'
const FOG_BOT = '90,147,235'
/** worksPost: ผนังโผล่ (หลังหน้ากระดาษกระจาย) [เริ่ม, ยาว] */
const WALL_IN = [WORKS_BOOM[0] + WORKS_BOOM[1] * 0.45, 0.42] as const

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
/** ตำแหน่งตามผนังของการ์ดใบที่ i เมื่อผนังเลื่อนไป off (วนซ้ำต่อเนื่อง) */
function posOf(i: number, off: number) {
  return S0 + ((((i * STEP + off) % LOOP) + LOOP) % LOOP)
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export function WorksWall({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const root = useRef<HTMLDivElement>(null)
  const art = useRef<HTMLDivElement>(null)
  const slices = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let raf = 0
    let shown = false
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = root.current
      const f = frame.current
      if (!el || !f) return
      const post = f.on ? worksPost(f.b) : -9
      const tin = (post - WALL_IN[0]) / WALL_IN[1]
      /* ออกให้หมดก่อนถึงด่านหนังสติ๊ก (SlingGate GATE 2.74) */
      const ex = clamp01((post - WORKS_HOLD[1]) / (2.7 - WORKS_HOLD[1]))
      const on = f.on && tin > -0.05 && ex < 1
      if (!on) {
        if (shown) {
          el.style.visibility = 'hidden'
          shown = false
        }
        return
      }
      if (!shown) {
        el.style.visibility = 'visible'
        shown = true
      }
      /* อาร์ตบอร์ดของปก ย่อ/ขยายให้กว้างเต็มจอ ชิดกลางแนวตั้ง */
      const W = window.innerWidth
      const H = window.innerHeight
      const sc = W / AW
      if (art.current) art.current.style.transform = `translate(0, ${((H - AH * sc) / 2).toFixed(1)}px) scale(${sc.toFixed(4)})`
      /* เข้า: ไหลเข้าจากขวาแล้วผ่อน (แบบปก) · ช่วงค้าง: หมุนไปซ้ายหนึ่งชุดงานตามระยะเลื่อน · ออก: ไหลต่อช้า ๆ */
      const ein = 1 - Math.pow(2, -10 * clamp01(tin))
      const hk = clamp01((post - WORKS_HOLD[0]) / (WORKS_HOLD[1] - WORKS_HOLD[0]))
      const hs = hk * hk * (3 - 2 * hk)
      const off = 0.7 * CARD_W * 6 * (1 - ein) - hs * WORKS.length * STEP - ex * ex * 360
      for (let i = 0; i < CARDS.length; i++) {
        const s0 = posOf(i, off)
        const ord = ((((i * STEP) % LOOP) + LOOP) % LOOP) / STEP
        const onK = clamp01((tin - ord * 0.05) / 0.55)
        const offK = clamp01((ex - (CARDS.length - 1 - ord) * 0.03) / 0.6)
        const ei = 1 - Math.pow(1 - onK, 5)
        const eo = offK * offK * (3 - 2 * offK)
        const rv = ei * (1 - eo)
        const lift = (1 - ei) * 46 + eo * 22
        for (let j = 0; j < SLICES; j++) {
          const sl = slices.current[i * SLICES + j]
          if (!sl) continue
          const p = at(s0 + (j + 0.5) * SW)
          const show = p.th < TH_HIDE && p.z < 820 && onK > 0 && offK < 1
          sl.style.visibility = show ? 'visible' : 'hidden'
          if (!show) continue
          sl.style.transform = `translate3d(${p.x.toFixed(2)}px, ${lift.toFixed(1)}px, ${p.z.toFixed(2)}px) rotateY(${(-p.th).toFixed(4)}rad)`
          const sh = sl.firstElementChild as HTMLElement | null
          if (sh) {
            const sa = (th: number) => Math.min(0.55, Math.pow(Math.max(0, th) / TH_HIDE, 1.6) * 0.55).toFixed(3)
            const sm = s0 + (j + 0.5) * SW
            const fog = (1 - rv).toFixed(3)
            sh.style.background = `linear-gradient(to bottom, rgba(${FOG_TOP},${fog}), rgba(${FOG_BOT},${fog})), linear-gradient(to right, rgba(0,0,0,${sa(at(sm - SW / 2).th)}), rgba(0,0,0,${sa(at(sm + SW / 2).th)}))`
          }
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame])

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[52] overflow-hidden" style={{ visibility: 'hidden' }} aria-hidden>
      <div ref={art} className="absolute top-0 left-0 origin-top-left" style={{ width: AW, height: AH }}>
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
                    width: SW + 0.8,
                    height: CARD_H,
                    left: -(SW + 0.8) / 2,
                    visibility: 'hidden',
                    backgroundImage: `url(${src})`,
                    backgroundSize: `auto ${CARD_H * ZOOM}px`,
                    backgroundPosition: `${(-j * SW - CROP).toFixed(2)}px ${(-CARD_H * (ZOOM - 1)) / 2}px`,
                    backgroundRepeat: 'no-repeat',
                    borderRadius: j === 0 ? `${RAD}px 0 0 ${RAD}px` : j === SLICES - 1 ? `0 ${RAD}px ${RAD}px 0` : undefined,
                    overflow: 'hidden',
                  }}
                >
                  <div className="absolute inset-0" />
                </div>
              )),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
