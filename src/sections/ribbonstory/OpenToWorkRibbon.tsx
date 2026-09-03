import { useEffect, useMemo, useRef } from 'react'

/**
 * "Open to work" เล่าด้วยการเลื่อน — ริบบิ้นเวกเตอร์ (SVG) ไม่ใช่ 3D
 *
 * ถอดจากคลิป ref (79f41f07…_frames, 74 เฟรม) ทีละเฟรม:
 *   001–018  แถบดำโค้งพาดเต็มเฟรม กินเกินครึ่งจอ "Welcome" ตัวขาวเลื่อนจากขวาไปซ้ายตามแนวโค้ง
 *            ตัวอักษรบิดตามเส้น แถบพลิ้วอยู่ตลอด ไม่เคยนิ่ง
 *   019–022  แถบเอียงขึ้นทางขวาแล้วเลื่อนลง คำขยายและหลุดขวา
 *   023–033  แถบแดง "To" (ตัวดำ) เข้ามา แอ่นเป็นโค้งหงาย เลื่อนลงเรื่อย ๆ คำโตขึ้น
 *   034–044  แถบชมพู "Our" โผล่ **ใต้** แถบแดง แถบแดงถูกดันขึ้นไปเป็นโค้งคว่ำด้านบน — เริ่มซ้อนชั้น
 *   045–060  แถบเขียว "New" ใหญ่กินสองในสามล่าง แดง/ชมพู **ซ้อนเป็นชั้นบาง ๆ ด้านบน** แถบใหม่ทับแถบเก่า
 *            ทุกแถบพลิ้วคนละจังหวะ มุมม่วงโผล่ล่างขวา
 *   061–062  ทุกแถบเอียงขึ้นขวา เห็นช่องขาวระหว่างชั้น
 *   063–070  พื้นเทาอ่อน ซูมออก ทุกแถบเป็นแผ่นแยกกันซ้อนเป็นพัดลู่ไปทางขวา (ม่วง "Identity" ใหญ่สุด
 *            อยู่ล่างซ้ายทับแถบอื่น) ค่อย ๆ หด เลื่อนเข้าหากันจนต่อเป็นเส้นเดียว
 *   071–074  ป้ายเต็ม 5 ท่อนต่อกัน โค้งเบา ๆ ยังไหวนิด ๆ กว้างราว 40% ของเฟรม
 *
 * ของเรา: สามบีต OPEN · TO · WORK — แต่ละบีตเป็นริบบิ้น "คนละแผ่น" แผ่นใหม่เข้ามาจากล่าง
 * ทับแผ่นเก่าที่ถูกดันขึ้นไปซ้อนเป็นชั้น ทุกแผ่นพลิ้วตามเวลา (ไม่ผูกกับ scroll) ช่วงท้ายทุกแผ่น
 * ย่อและเลื่อนมาต่อกันเป็นป้ายเดียว พื้นขาว→เทา
 *
 * ค่าที่เปลี่ยนทุกเฟรมเขียนลง DOM ตรง ๆ ผ่าน ref (setAttribute) ไม่ผ่าน setState
 */

const BEATS = [
  { word: 'OPEN', bg: '#000000', ink: '#ffffff', speed: 0.9, phase: 0.0 },
  { word: 'TO', bg: '#ff1a1a', ink: '#111111', speed: 1.15, phase: 2.1 },
  { word: 'WORK', bg: '#12ff7c', ink: '#111111', speed: 0.75, phase: 4.0 },
]

/** กรอบภาพของ SVG (คงสัดส่วน 16:9 แล้ว slice ให้เต็มจอ) */
const VW = 1600
const VH = 900
/** ความกว้างแถบ / ขนาดตัวอักษร ตอนซูมเข้า (หน่วย viewBox) */
const BAND = 300
const FONT = 180
/** แถบยาวเกินจอสองข้าง — ปลายไม่โผล่ตอนพลิ้ว/เอียง */
const X0 = -400
const X1 = VW + 400
/** จำนวนจุดต่อแผ่น */
const N = 64
/** ช่วงความคืบหน้าที่ยังเล่าทีละบีต — หลังจากนั้นย่อรวมเป็นป้าย */
const RIDE_END = 0.72
/**
 * ป้ายตอนจบ = แถบคั่น (divider): เต็มความกว้างจอ ชิดขอบล่างของจอ สามท่อนเท่ากัน
 * พอ section ปล่อยหมุด แถบนี้จะต่อเข้าจอถัดไปพอดี ทำหน้าที่เป็นเส้นแบ่งจริง ๆ
 * ความกว้างแถบ/ตัวอักษรตั้งแยก ไม่ได้ย่อตามสเกลเดียวกับตอนไถล
 */
const END_W = VW
const END_SEG = END_W / BEATS.length
const END_X0 = 0
const END_BAND = 92

const smooth = (x: number) => x * x * (3 - 2 * x)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function OpenToWorkRibbon({ id = 'open-to-work' }: { id?: string }) {
  const section = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const paths = useRef<(SVGPathElement | null)[]>([])
  const texts = useRef<(SVGTextElement | null)[]>([])
  const textPaths = useRef<(SVGTextPathElement | null)[]>([])
  const uid = useMemo(() => `otw-${Math.random().toString(36).slice(2, 8)}`, [])

  useEffect(() => {
    const el = section.current
    if (!el) return
    let raf = 0
    let visible = false
    const t0 = performance.now()
    const pt: string[] = Array.from({ length: N + 1 }, () => '')

    const render = () => {
      raf = 0
      const time = (performance.now() - t0) / 1000
      const r = el.getBoundingClientRect()
      const span = Math.max(1, r.height - window.innerHeight)
      const p = clamp01(-r.top / span)
      const ride = clamp01(p / RIDE_END)
      /**
       * ช่วงท้ายสองจังหวะตามเฟรม 060–074:
       *   o1 (060→070) ทุกแผ่นแยกออกเป็นพัด ปลายขวาลู่ไปจุดเดียว แผ่นล่าสุดใหญ่สุด พื้นเป็นเทา
       *   o2 (070→074) พัดหุบ แผ่นย่อลงแล้วเลื่อนมาต่อกันเป็นป้ายเดียว
       */
      const o1 = smooth(clamp01((p - RIDE_END) / 0.15))
      const o2 = smooth(clamp01((p - RIDE_END - 0.15) / (1 - RIDE_END - 0.15)))
      // ปลายช่วงไถล (เฟรม 060–062) ทุกแผ่นเอียงขึ้นขวาแรงขึ้นก่อนแตกเป็นพัด
      const tilt = -0.1 - 0.12 * smooth(clamp01((ride - 0.85) / 0.15))

      const a = 0.6 + ride * 2.4
      /**
       * คลื่นหลักใช้ร่วมกันทุกแผ่น (เฟสเดียว เวลาเดียว) — แผ่นที่ซ้อนกันจึงขยับไปด้วยกัน
       * ไม่มีช่องขาวโผล่ระหว่างชั้น ส่วน "พลิ้วคนละจังหวะ" มาจากคลื่นรองเล็ก ๆ ต่อแผ่น
       * ซึ่งเล็กกว่าระยะที่แผ่นซ้อนกัน (0.28 แถบ) จึงไม่มีทางแยกออกจากกัน
       */
      const baseAmp = BAND * 0.3

      BEATS.forEach((b, i) => {
        const path = paths.current[i]
        const text = texts.current[i]
        const tp = textPaths.current[i]
        if (!path || !text || !tp) return
        const age = a - i
        const enter = smooth(clamp01(age / 0.6))
        const pushed = Math.max(0, age - 1)
        // ชั้น: แผ่นที่กำลังเล่าอยู่ล่าง แผ่นเก่าถูกดันขึ้นทีละ 0.72 แถบ — ซ้อนกัน 0.28 แถบเสมอ
        const slotY = VH * 0.66 - pushed * BAND * 0.72
        const rideY = lerp(VH + BAND, slotY, enter)
        const lam = VW * 1.9
        const devAmp = BAND * 0.06

        /**
         * พัด (เฟรม 063–070): ปลายขวาทุกแผ่นลู่ไปจุดเดียวบนขวา ปลายซ้ายกางออกลงมา
         * แผ่นหลังสุดกว้างสุดและอยู่ล่างซ้ายทับแผ่นอื่น
         */
        const vx = VW * 1.02
        const vy = VH * 0.4
        const lx = VW * 0.02 + i * VW * 0.05
        const ly = VH * 0.28 + i * VH * 0.2
        const fanBand = END_BAND * (1.4 + i * 0.9)

        for (let j = 0; j <= N; j += 1) {
          const u = j / N
          const xr = lerp(X0, X1, u)
          const wave =
            baseAmp * Math.sin((xr / lam) * Math.PI * 2 + time * 0.8) +
            devAmp * Math.sin((xr / (lam * 0.45)) * Math.PI * 2 - time * b.speed * 1.6 + b.phase)
          const yr = rideY + tilt * (xr - VW / 2) + wave
          // พัด: เส้นตรงจากซ้ายไปจุดลู่ + โค้งนิด ๆ + พลิ้วเบา ๆ
          const xf = lerp(lx, vx, u)
          const yf = lerp(ly, vy, u) - 40 * Math.sin(u * Math.PI) + wave * 0.12
          // ป้ายจบ: ท่อน i ต่อกันชิดสนิทเป็นเส้นตรงชิดขอบล่างจอ นิ่งสนิท ไม่มีคลื่น
          const xe = END_X0 + END_SEG * (i + u)
          const ye = VH - END_BAND / 2
          const x = lerp(lerp(xr, xf, o1), xe, o2)
          const y = lerp(lerp(yr, yf, o1), ye, o2)
          pt[j] = `${j === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
        }
        path.setAttribute('d', pt.join(' '))
        const band = lerp(lerp(BAND, fanBand, o1), END_BAND, o2)
        path.setAttribute('stroke-width', band.toFixed(1))
        text.setAttribute('font-size', (band * (FONT / BAND)).toFixed(1))
        // คำเลื่อนจากขวาไปซ้ายระหว่างบีตของตัวเอง (เฟรม 001–018) ตอนเป็นพัด/ป้ายอยู่ค่อนซ้าย→กลาง
        const slide = 0.64 - clamp01(age) * 0.2
        tp.setAttribute('startOffset', `${(lerp(lerp(slide, 0.3, o1), 0.5, o2) * 100).toFixed(2)}%`)
      })

      /**
       * พื้น: ขาว → เทาอ่อนตอนเป็นพัด (เฟรม 063) → น้ำเงินของหน้าตอนต่อเป็นแถบคั่น
       * แถบจึงนั่งบนพื้นเดียวกับจอถัดไป อ่านเป็นเส้นแบ่ง ไม่ใช่หน้าเทาอีกหน้า
       */
      const g1 = 255 - 25 * o1
      const rC = Math.round(lerp(g1, 0x26, o2))
      const gC = Math.round(lerp(g1, 0x5a, o2))
      const bC = Math.round(lerp(g1, 0xda, o2))
      if (stage.current) stage.current.style.background = `rgb(${rC} ${gC} ${bC})`
      // พลิ้วตลอดเวลาที่อยู่ในจอ — แต่พอต่อเป็นป้ายแล้วนิ่งสนิท หยุดลูป รอเฉพาะ scroll
      if (visible && o2 < 1) raf = requestAnimationFrame(render)
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(render)
    }
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting
      schedule()
    })
    io.observe(el)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    schedule()
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      visible = false
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section id={id} data-screen={id} ref={section} className="relative h-[420svh] w-full">
      <div ref={stage} className="sticky top-0 h-[100svh] w-full overflow-clip bg-white">
        <svg
          className="block h-full w-full"
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          {/* ลำดับวาด = ลำดับบีต แผ่นใหม่จึงทับแผ่นเก่าที่ถูกดันขึ้นไป (เฟรม 045–060) */}
          {BEATS.map((b, i) => (
            <g key={b.word}>
              <path
                id={`${uid}-${i}`}
                ref={(n) => {
                  paths.current[i] = n
                }}
                d={`M${X0} ${VH + BAND} L${X1} ${VH + BAND}`}
                fill="none"
                stroke={b.bg}
                strokeWidth={BAND}
                /* ปลายตัดตรงและมุมคม — ริบบิ้นในภาพ ref เป็นแผ่นตัดขอบเหลี่ยม ไม่มีมุมมน */
                strokeLinecap="butt"
                strokeLinejoin="miter"
              />
              <text
                ref={(n) => {
                  texts.current[i] = n
                }}
                fill={b.ink}
                fontSize={FONT}
                fontFamily="'Momo Trust Display', 'Mona Sans', system-ui, sans-serif"
                textAnchor="middle"
                dominantBaseline="central"
                letterSpacing="0.02em"
              >
                <textPath
                  ref={(n) => {
                    textPaths.current[i] = n
                  }}
                  href={`#${uid}-${i}`}
                  startOffset="60%"
                >
                  {b.word}
                </textPath>
              </text>
            </g>
          ))}
        </svg>
        <p className="sr-only">Open to work</p>
      </div>
    </section>
  )
}
