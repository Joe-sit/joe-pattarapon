import { useImperativeHandle, useRef, type ReactNode, type Ref } from 'react'
import { CARDS, designPick } from './BenchScreen'
import { clamp01, isTall, outBack, screenRect, smooth, type WorkBeats } from './workMotion'

/**
 * ของลอยรอบเครื่อง (แบบวิดีโอของ eddie.eco: ของหลักชิ้นเดียว มี UI แบน 2–3 ชิ้นลอยรอบตัว — การ์ดขาวมุมมน ไอคอนเข้ม
 * วางบนวัตถุ 3D นุ่ม ๆ ตัดกันจึงอ่านง่าย · ของในการ์ดขยับตามบท ไม่ใช่ภาพนิ่ง)
 *
 * บทละสองชิ้น เด้งออกจากขอบเครื่องไปเกาะใกล้มุม (เลยนิดแล้วกลับ) ลอยขึ้นลงเบา ๆ แล้วหดกลับเข้าขอบตอนจบบท:
 *   research  แว่นขยาย · จุดโน้ตติดทีละจุดตามโน้ตที่โผล่บนจอ
 *   design    ปากกา · จานสีสามสีของวิดเจ็ต วงล้อมสีของใบที่กรอบเลือกกำลังจับ
 *   code      </> · แถบ build เติมตามโค้ดที่พิมพ์
 *   ship      เครื่องหมายถูก · ป้าย Live จุดเขียวเต้น
 * ไม่มีตัวเลข — ไม่มีตัวเลขจริงให้ใส่ (ขยับด้วยจุด/แถบแทน) · DOM คมกว่าข้อความในแคนวาส · ตำแหน่งตามกรอบจอเครื่อง (screenRect)
 */

/** lift = ทั้งเรื่องถูกจอถัดไปดันขึ้นไปกี่ px (ติดลบ) — ของลอยตามขึ้นไปด้วย */
export type TokensApi = { update: (b: WorkBeats, W: number, H: number, live: boolean, lift: number) => void }

const NOTES = 9
const SWATCH = CARDS.map((c) => c.tiles[0]?.color ?? c.color)

/** ไอคอนเส้นหนา 24×24 */
const Icon = ({ d }: { d: ReactNode }) => (
  <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
)
const ICONS = {
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  pen: (
    <>
      <path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" />
      <path d="M14 7l3 3" />
    </>
  ),
  code: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
}

/**
 * แต่ละชิ้น: บท · มุม (x y เป็นเท่าของครึ่งกว้าง/สูงของเครื่อง จากกลางเครื่อง) · เนื้อในการ์ด
 * จอตั้ง: เครื่องกินเกือบเต็มความกว้าง — ชิ้นจึงเกาะคร่อมขอบข้างเครื่องแทนอยู่นอกเครื่อง
 */
type Slot = { beat: 'design' | 'code' | 'ship'; x: number; y: number; kind: 'icon' | 'notes' | 'swatch' | 'build' | 'live'; icon?: keyof typeof ICONS }
const SLOTS: Slot[] = [
  { beat: 'design', x: 1.26, y: -0.62, kind: 'icon', icon: 'pen' },
  { beat: 'design', x: -1.34, y: 0.42, kind: 'swatch' },
  { beat: 'code', x: -1.28, y: -0.5, kind: 'icon', icon: 'code' },
  { beat: 'code', x: 1.3, y: 0.46, kind: 'build' },
  { beat: 'ship', x: 1.24, y: -0.56, kind: 'icon', icon: 'check' },
  { beat: 'ship', x: -1.3, y: 0.4, kind: 'live' },
]

export function BenchTokens({ api }: { api: Ref<TokensApi> }) {
  const boxes = useRef<(HTMLDivElement | null)[]>([])
  const dots = useRef<(HTMLSpanElement | null)[]>([])
  const swatches = useRef<(HTMLSpanElement | null)[]>([])
  const bar = useRef<HTMLSpanElement>(null)

  useImperativeHandle(
    api,
    () => ({
      update(b, W, H, live, lift) {
        const sr = screenRect(b, W, H)
        const tall = isTall(W, H)
        SLOTS.forEach((sl, i) => {
          const el = boxes.current[i]
          if (!el) return
          const k = live && b.bench >= 0.98 ? b[sl.beat] : 0
          /* เด้งออกต้นบท (ชิ้นที่สองตามนิด) หดกลับตอนท้าย — บทส่งของค้างจนจบ */
          const lag = i % 2 ? 0.05 : 0
          const inK = clamp01((k - 0.04 - lag) / 0.14)
          const outK = sl.beat === 'ship' ? 0 : smooth((k - 0.88) / 0.1)
          const g = outBack(inK, 1.7) * (1 - outK)
          el.style.visibility = g > 0.01 ? 'visible' : 'hidden'
          if (g <= 0.01) return
          /* ออกจากขอบเครื่อง → มุมของมัน (จอตั้งเข้ามาเกาะขอบเครื่อง ไม่หลุดจอ) */
          /* จอตั้ง: ป้ายขั้นตอนอยู่เหนือเครื่อง — เกาะคร่อมขอบข้างเครื่องแทนมุมบน/ล่าง */
          const fx = tall ? Math.sign(sl.x) * 0.97 : sl.x
          const fy = tall ? sl.y * 1.3 : sl.y
          const e = smooth(inK) * (1 - outK)
          const x = sr.cx + sr.hw * (Math.sign(fx) * 0.9 + (fx - Math.sign(fx) * 0.9) * e)
          const y = sr.cy + sr.hh * fy + lift
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${Math.max(0.001, g).toFixed(3)})`
        })
        /* ของในการ์ด */
        /* จุดข้อมูลติดทีละจุดตลอดบทค้นคว้า (เก็บข้อมูลเพิ่มเรื่อย ๆ) */
        const lit = Math.round(clamp01((b.research - 0.12) / 0.66) * NOTES)
        dots.current.forEach((d, i) => {
          if (d) d.dataset.on = String(i < lit)
        })
        const pick = designPick(b.design)
        swatches.current.forEach((sw, i) => {
          if (sw) sw.dataset.on = String(pick.on > 0.3 && i === pick.to)
        })
        if (bar.current) bar.current.style.transform = `scaleX(${clamp01((b.code - 0.26) / 0.46).toFixed(3)})`
      },
    }),
    [],
  )

  const card = 'flex items-center gap-2.5 rounded-[18px] bg-white px-3.5 py-3 text-[#16213e] shadow-[0_10px_30px_rgba(16,40,110,0.18)]'
  return (
    <div className="pointer-events-none fixed inset-0 z-[53] overflow-hidden" aria-hidden>
      {SLOTS.map((sl, i) => (
        <div
          key={i}
          ref={(el) => {
            boxes.current[i] = el
          }}
          className="absolute top-0 left-0"
          style={{ visibility: 'hidden' }}
        >
          {/* ลอยขึ้นลงเบา ๆ ตามเวลา (CSS — ไม่ต้องวาดใหม่ทุกเฟรม) เฟสต่างกันต่อชิ้น */}
          <div className="animate-[v3-token-float_3.2s_ease-in-out_infinite]" style={{ animationDelay: `${-i * 0.7}s` }}>
            {sl.kind === 'icon' && sl.icon && (
              <div className="grid size-[54px] place-items-center rounded-[18px] bg-white text-[#16213e] shadow-[0_10px_30px_rgba(16,40,110,0.18)]">
                <Icon d={ICONS[sl.icon]} />
              </div>
            )}
            {sl.kind === 'notes' && (
              <div className={card}>
                <span className="grid grid-cols-3 gap-1">
                  {Array.from({ length: NOTES }, (_, j) => (
                    <span
                      key={j}
                      ref={(el) => {
                        dots.current[j] = el
                      }}
                      className="size-2 rounded-full bg-[#d5dbe8] transition-colors duration-200 data-[on=true]:bg-[#2f6bff]"
                    />
                  ))}
                </span>
                <span className="h-2 w-12 rounded-full bg-[#e3e8f2]" />
              </div>
            )}
            {sl.kind === 'swatch' && (
              <div className={card}>
                {SWATCH.map((c, j) => (
                  <span
                    key={j}
                    ref={(el) => {
                      swatches.current[j] = el
                    }}
                    className="size-6 rounded-full ring-offset-2 transition-shadow duration-200 data-[on=true]:ring-2 data-[on=true]:ring-[#2f6bff]"
                    style={{ background: c }}
                  />
                ))}
              </div>
            )}
            {sl.kind === 'build' && (
              <div className={card}>
                <span className="h-2.5 w-28 overflow-hidden rounded-full bg-[#e3e8f2]">
                  <span ref={bar} className="block h-full origin-left rounded-full bg-[#2f6bff]" style={{ transform: 'scaleX(0)' }} />
                </span>
              </div>
            )}
            {sl.kind === 'live' && (
              <div className={`${card} font-mono text-[12px] tracking-[0.18em] uppercase`}>
                <span className="relative grid size-2.5 place-items-center">
                  <span className="absolute size-2.5 animate-ping rounded-full bg-[#22c55e]/60" />
                  <span className="size-2.5 rounded-full bg-[#22c55e]" />
                </span>
                Live
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
