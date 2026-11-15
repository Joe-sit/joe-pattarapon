import { useEffect, useRef } from 'react'
import { WORKS } from './WorksGallery'
import { STORY_FONT, devScreen, smooth, worksPost, type WorkBeats } from './workMotion'

/**
 * Selected Work แบบ "App switcher ของ iOS" — ต่อท้ายบท Code (POST_CODE = 'switcher' ใน ./workMotion)
 *
 *   ปัดขึ้น  จบ Code (ฉากมืดเปิดเป็นฟ้าแล้ว) เครื่องทำท่าเปิดตัวสลับแอป: ตัวเครื่องหดลงเป็นการ์ด ยกขึ้นนิด
 *            ฟ้าข้างหลังเบลอหม่นลง (เหมือนหน้าโฮมตอนเปิดตัวสลับแอป)
 *   สลับแอป  ทางซ้ายของเครื่องมีการ์ดแอปเรียงซ้อนแบบ iOS (ใบซ้ายลอดใต้ใบขวา ย่อนิดตามลำดับ) แต่ละใบ = หน้าจอของงานจริง
 *            เลื่อน = ปัดย้อนไปแอปก่อนหน้า ทีละใบ (ค้างให้อ่าน) · ไอคอน + ชื่อเหนือการ์ด แบบตัวสลับแอปจริง
 *   เปิดกลับ เลื่อนจบรายการ การ์ดไหลกลับมาที่เครื่อง แล้วเครื่องขยายกลับเต็มตัว (แตะเปิดแอป) ฟ้าหายเบลอ ต่อบท Ship
 *
 * ตัวเครื่องจริง (แก้ว 3D — ./BubbleTraveler) คือการ์ดใบขวาสุดของรายการ: ย่อ/เลื่อนตาม switchDev ชุดเดียวกับการ์ด DOM
 * การ์ด DOM อยู่ชั้นใต้ของบนจอเครื่อง (WorkStory) — ใบที่ลอดใต้เครื่องจึงอยู่หลังเครื่องจริง ๆ
 */
const PICKS = WORKS.slice(0, 8)
const N = PICKS.length
/** การ์ดสูงเท่านี้ของความสูงจอ */
export const CARD_H = 0.6
const STEP = 0.14
const D0 = 0.6

/** จังหวะ (worksPost) [เริ่ม, ยาว] */
const T = {
  swipe: [0.3, 0.26],
  back: [D0 + N * STEP + 0.06, 0.22],
  open: [D0 + N * STEP + 0.3, 0.24],
} as const
const at01 = (x: number, r: readonly [number, number]) => Math.min(1, Math.max(0, (x - r[0]) / r[1]))

/** ระยะการ์ดจากจุดโฟกัส (d = ลำดับ − โฟกัส) → เลื่อนกี่เท่าความกว้างการ์ด: ใบซ้ายซ้อนแน่น ใบขวาเรียงห่าง */
export const deckX = (d: number) => (d < 0 ? d * 0.6 : d * 1.08)

export function switcherPhase(b: { code: number; works: number }) {
  const post = worksPost(b)
  const swipe = smooth(at01(post, T.swipe)) * (1 - smooth(at01(post, T.open)))
  /* โฟกัส: เริ่มที่เครื่อง (N) แล้วปัดย้อนทีละใบ — ค้างที่แต่ละใบก่อนเลื่อนต่อ */
  const r = Math.min(N, Math.max(0, (post - D0) / STEP))
  const ri = Math.min(N, Math.floor(r))
  const step = ri + smooth(Math.min(1, Math.max(0, (r - ri - 0.42) / 0.58)))
  const f0 = N - Math.min(N, step)
  const back = smooth(at01(post, T.back))
  const focus = f0 + (N - f0) * back
  /* แตะเปิดแอป: การ์ดอื่นจางก่อนเครื่องขยายเสร็จ (ไม่ค้างเป็นเงาข้างหลัง) */
  const fade = 1 - smooth(at01(post, [T.open[0], T.open[1] * 0.5]))
  return { post, swipe, focus, fade }
}

/** ท่าของตัวเครื่องในตัวสลับแอป (BubbleTraveler อ่าน): swipe 0→1 = เต็มตัว→การ์ด · dx = เลื่อนกี่เท่าความกว้างการ์ด */
export function switchDev(b: { code: number; works: number }) {
  const ph = switcherPhase(b)
  return { swipe: ph.swipe, dx: deckX(N - ph.focus) }
}

export function SwitcherStage({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const root = useRef<HTMLDivElement>(null)
  const blur = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLDivElement | null)[]>([])
  const devLabel = useRef<HTMLDivElement>(null)
  const devBack = useRef<HTMLDivElement>(null)
  const caption = useRef<HTMLDivElement>(null)
  const capName = useRef<HTMLDivElement>(null)
  const capSub = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let shown = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const rt = root.current
      const f = frame.current
      if (!rt || !f) return
      const ph = switcherPhase(f.b)
      const vis = f.on && ph.swipe > 0.001 && devScreen.ok
      /* display ไม่ใช่ visibility — การ์ดตั้ง visibility ของตัวเอง (ลูกที่ visible ชนะ hidden ของแม่) */
      rt.style.display = vis ? '' : 'none'
      if (!vis) return
      if (blur.current) blur.current.style.opacity = ph.swipe.toFixed(3)
      /* การ์ดขนาดเท่าเครื่องตอนนี้ (เครื่องย่อเป็นการ์ดแล้ว) · จุดกึ่งกลางสำรับคำนวณย้อนจากตำแหน่งเครื่อง */
      const hw = devScreen.hw
      const hh = devScreen.hh
      const cw = hw * 2
      const r = Math.max(8, devScreen.r)
      const x0 = devScreen.cx - deckX(N - ph.focus) * cw
      const cy = devScreen.cy
      cards.current.forEach((el, i) => {
        if (!el) return
        const d = i - ph.focus
        const s = d < 0 ? Math.max(0.82, 1 + d * 0.035) : 1
        /* ปัดขึ้น: ใบซ้ายเลื่อนเข้ามาจากซ้าย · แตะเปิด: เลื่อนหลบออกซ้าย */
        const x = x0 + deckX(d) * cw - (1 - ph.swipe) * cw * 0.5 - (1 - ph.fade) * cw * 0.9
        /* ทึบเร็ว — เลื่อนเข้ามาเป็นการ์ด ไม่ใช่ผีจาง ๆ */
        const a = smooth(ph.swipe * 2.2) * ph.fade * (d < -3.5 ? Math.max(0, 1 - (-3.5 - d)) : 1)
        el.style.width = `${(cw * s).toFixed(1)}px`
        el.style.height = `${(hh * 2 * s).toFixed(1)}px`
        el.style.borderRadius = `${(r * s).toFixed(1)}px`
        el.style.transform = `translate3d(${(x - cw * s * 0.5).toFixed(1)}px, ${(cy - hh * s).toFixed(1)}px, 0)`
        el.style.opacity = a.toFixed(3)
        el.style.visibility = a > 0.01 ? 'visible' : 'hidden'
      })
      const db = devBack.current
      if (db) {
        db.style.width = `${(hw * 2).toFixed(1)}px`
        db.style.height = `${(hh * 2).toFixed(1)}px`
        db.style.borderRadius = `${r.toFixed(1)}px`
        db.style.transform = `translate3d(${(devScreen.cx - hw).toFixed(1)}px, ${(cy - hh).toFixed(1)}px, 0)`
        db.style.opacity = (smooth(ph.swipe * 2.2) * ph.fade).toFixed(3)
      }
      /* ป้ายของเครื่อง (แอปของเรา) เหนือการ์ดเครื่อง */
      if (devLabel.current) {
        devLabel.current.style.transform = `translate3d(${(devScreen.cx - hw).toFixed(1)}px, ${(cy - hh - 38).toFixed(1)}px, 0)`
        devLabel.current.style.opacity = (ph.swipe * ph.fade).toFixed(3)
      }
      /* คำบรรยายใต้การ์ดที่โฟกัส */
      const fi = Math.round(ph.focus)
      const near = fi < N ? Math.max(0, 1 - Math.abs(ph.focus - fi) * 2.4) * ph.swipe * ph.fade : 0
      if (caption.current) {
        caption.current.style.opacity = near.toFixed(3)
        caption.current.style.transform = `translate3d(-50%, ${(cy + hh + 18 + (1 - near) * 10).toFixed(1)}px, 0)`
      }
      if (near > 0 && fi !== shown) {
        shown = fi
        if (capName.current) capName.current.textContent = PICKS[fi].name
        if (capSub.current) capSub.current.textContent = `${PICKS[fi].category} · ${PICKS[fi].sub}`
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame])

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 isolate" style={{ display: 'none', fontFamily: STORY_FONT }} aria-label="Selected Work">
      {/* ฟ้าข้างหลังเบลอหม่นลง เหมือนหน้าโฮมตอนเปิดตัวสลับแอป */}
      <div ref={blur} className="absolute inset-0 bg-[rgba(18,30,60,0.22)] backdrop-blur-[18px] backdrop-saturate-150" style={{ opacity: 0 }} />
      {PICKS.map((w, i) => (
        <div
          key={w.name}
          ref={(n) => {
            cards.current[i] = n
          }}
          className="@container absolute top-0 left-0 overflow-visible will-change-transform"
          style={{ zIndex: i, visibility: 'hidden' }}
        >
          {/* ไอคอน + ชื่อแอป เหนือการ์ด */}
          <div className="absolute -top-[34px] left-0 flex items-center gap-2 whitespace-nowrap">
            <span className="block size-[24px] rounded-[7px] bg-cover bg-center ring-1 ring-white/40" style={{ backgroundImage: `url(${w.img})` }} />
            <span className="max-w-[180px] truncate text-[13px] font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]">{w.name.split(' - ')[0]}</span>
          </div>
          {/* หน้าจอของแอป = หน้า case study ย่อ: หมวด · ชื่องาน · ปก (ขนาดตัวอักษรตามความกว้างการ์ด — cqw) */}
          <div className="relative flex size-full flex-col overflow-hidden bg-gradient-to-b from-white to-[#eef3ff] p-[6cqw] shadow-[0_24px_60px_rgba(10,20,50,0.35)]" style={{ borderRadius: 'inherit' }}>
            <span className="self-start rounded-full bg-[#e3ecff] px-[3.5cqw] py-[1.2cqw] text-[4.2cqw] font-semibold text-[#2a6be0]">{w.category}</span>
            <div className="mt-[3cqw] line-clamp-3 text-[8.4cqw] leading-[1.12] font-bold text-[#0f1b3d]">{w.name}</div>
            {/* ปกแนวนอนในช่องแนวตั้ง: วางเต็มกว้างไม่ตัด บนพื้นเบลอจากภาพเดียวกัน */}
            <div className="relative mt-[5cqw] min-h-0 w-full flex-1 overflow-hidden rounded-[5cqw] shadow-[0_6px_20px_rgba(15,27,61,0.14)]">
              <img src={w.img} alt="" className="absolute inset-0 size-full scale-150 object-cover blur-[14px] saturate-150" draggable={false} />
              <img src={w.img} alt={w.name} className="absolute inset-0 size-full object-contain" draggable={false} />
            </div>
          </div>
        </div>
      ))}
      {/* พื้นจอของการ์ดเครื่อง (แอปเรา) — เครื่องเป็นแก้วใส การ์ดที่ลอดใต้ต้องไม่ทะลุ · วิดเจ็ตบนจออยู่ชั้นบนกว่า */}
      <div ref={devBack} className="absolute top-0 left-0 bg-gradient-to-b from-[#3d7bf0] to-[#9cc0ff]" style={{ zIndex: N, opacity: 0 }} />
      <div ref={devLabel} className="absolute top-0 left-0 flex items-center gap-2 whitespace-nowrap" style={{ zIndex: N + 1, opacity: 0 }}>
        <img src="/favicon-192.png" alt="" className="size-[24px] rounded-[7px]" />
        <span className="text-[13px] font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]">Joe</span>
      </div>
      <div ref={caption} className="absolute top-0 left-1/2 text-center" style={{ zIndex: N + 1, opacity: 0 }}>
        <div ref={capName} className="text-[clamp(16px,1.4vw,22px)] leading-tight font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]" />
        <div ref={capSub} className="mt-1 text-[12px] text-white/80" />
      </div>
    </div>
  )
}
