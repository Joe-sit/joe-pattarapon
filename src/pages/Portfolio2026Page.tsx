import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import './portfolio2026.css'
import { Leva } from 'leva'
import { SITE } from '@/config/site'
import { useIntroDone } from '@/stores/intro'
// โลโก้ตัวที่รับ color ได้ (ตัวใน components/ ตายตัวเป็นสีอ่อนสำหรับ NavBar พื้นเข้ม)
import { Logo } from '@/joespresso/Logo'
import { AsciiText } from '@/components/AsciiText'
import { WarpText } from '@/components/WarpText'
import arrowOutward from '@/assets/v2/arrow-outward.svg'
import intoMark from '@/assets/v2/into.svg'
import promptMark from '@/assets/v2/prompt-mark.svg'
import quoteMark from '@/assets/v2/quote-mark.svg'
import buildingMosaic from '@/assets/v2/building-mosaic.png'
import mosaicBand from '@/assets/v2/mosaic-band.svg'
import githubIcon from '@/assets/github-142_svgrepo.com.svg'
import linkedinIcon from '@/assets/linkedin_svgrepo.com.svg'
import instagramIcon from '@/assets/instagram_svgrepo.com.svg'

// ฉาก 3D ของ /joespresso ทั้งใบ + การ์ด mascot ตัวเดียวกับฉาก — chunk หนัก แยกโหลด
const JoeScene = lazy(() => import('@/joespresso/App').then((m) => ({ default: m.Scene })))
const MascotCard = lazy(() =>
  import('@/joespresso/MascotCard').then((m) => ({ default: m.MascotCard })),
)

/**
 * เวอร์ชันที่สองของหน้าแรก — layout ตาราง editorial ตาม Figma (Wireframe - 6, node 1339:3655)
 *
 * คนละภาษากับ /joespresso: หน้านั้นคือฉาก 3D เต็มจอ หน้านี้เป็นกริดกระดาษ เส้นแบ่งบาง ๆ
 * แล้ว "ฝัง" ฉาก 3D จริงเป็นชิ้นงานในตาราง (box ซ้าย = ฉากทั้งใบ intro เล่นในกรอบ,
 * section 2 = mascot ตัวเดียวกับฉากในกล้อง close-up)
 *
 * เส้นตาราง: ทุก cell มีกรอบ #d2d9d5 ของตัวเองแล้ววางชนกัน (margin -1px กันเส้นซ้อนหนา)
 * ตามวิธีของ comp ที่ตีกรอบทีละกล่องบนพื้น #e8edec เดียวกันทั้งหน้า
 *
 * responsive: ไม่มีความกว้าง/ฟอนต์ค่าตายตัว — ระยะขอบและตัวหนังสือเป็น clamp ผูก vw
 * (สัดส่วนอิงคอมพ์ 1440: ขอบ 64px = 4.44vw, ช่องโลโก้ 221px = 15.35vw)
 * จอเล็ก (<lg) เลิกบีบความสูง ปล่อยไหลยาวตามเนื้อหา
 */

const BORDER = 'border border-[#d2d9d5]'
const CELL = `${BORDER} bg-[#e8edec]`

// ค่าที่ใช้ซ้ำหลายจุด — แก้ที่เดียว
const GUTTER = 'clamp(16px,4.44vw,96px)'
const HEADER_H = '74px'
const PAD = 'p-[clamp(1rem,1.4vw,2rem)]'
const BODY_TEXT = 'text-[clamp(0.9375rem,1.05vw,1.375rem)]'

// ไอคอนชุดนี้เป็นเวอร์ชันสำหรับพื้นเข้ม — ปรับลงพื้นอ่อนด้วย filter คนละแบบ:
// github เป็นวงกลมขาว+ตัวดำ ต้อง invert (ได้กลมดำ+ตัวขาวตาม design) ที่เหลือ glyph ขาวล้วน ทาดำพอ
const SOCIALS = [
  { name: 'GitHub', icon: githubIcon, href: 'https://github.com/Joe-sit', filter: 'invert' },
  { name: 'LinkedIn', icon: linkedinIcon, href: SITE.linkedIn, filter: 'darken' },
  { name: 'Instagram', icon: instagramIcon, href: SITE.instagram, filter: 'darken' },
]

const NAV = ['What I Do', 'Experiences', 'Works']

/**
 * ป้ายเล็กแบบ githubuniverse.com: ตัว mono ถูก "พิมพ์" ทีละตัวตอนเลื่อนมาเห็น
 * แล้วทิ้ง block cursor เขียวกะพริบค้างไว้ท้ายบรรทัด (Eyebrow_Cursor ของเว็บต้นทาง)
 */
function Eyebrow({ text }: { text: string }) {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const splashDone = useIntroDone()
  useEffect(() => {
    const el = ref.current
    if (!el || !splashDone) return
    let timer: ReturnType<typeof setInterval> | undefined
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || timer) return
        io.disconnect()
        timer = setInterval(() => {
          setN((v) => {
            if (v >= text.length) {
              clearInterval(timer)
              return v
            }
            return v + 1
          })
        }, 32)
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (timer) clearInterval(timer)
    }
  }, [text, splashDone])
  return (
    <span ref={ref} className="v2-eyebrow">
      {text.slice(0, n)}
      <span className="v2-caret" aria-hidden />
    </span>
  )
}

/**
 * decrypt text effect (แบบ reactbits DecryptedText): ตัวอักษรสุ่มมั่ววิ่งอยู่ แล้วค่อย ๆ
 * "ถอดรหัส" เฉลยทีละตัวจากซ้ายไปขวา — เริ่มตอนเลื่อนมาเห็น เล่นครั้งเดียว
 */
const SCRAMBLE = 'abcdefghijklmnopqrstuvwxyz!<>-_/[]{}=+*^?#'
function DecryptText({ text }: { text: string }) {
  const [out, setOut] = useState(text)
  const ref = useRef<HTMLSpanElement>(null)
  // สปแลชยังคาบังจออยู่ effect ห้ามแอบเล่นจบไปก่อน — รอประตูเปิดค่อยเริ่มสังเกต
  const splashDone = useIntroDone()
  useEffect(() => {
    const el = ref.current
    if (!el || !splashDone) return
    let timer: ReturnType<typeof setInterval> | undefined
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || timer) return
        io.disconnect()
        let revealed = 0
        timer = setInterval(() => {
          revealed += 1
          setOut(
            text
              .split('')
              .map((ch, i) => {
                if (i < revealed || ch === ' ' || ch === '/') return ch
                return SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]
              })
              .join(''),
          )
          if (revealed >= text.length) clearInterval(timer)
        }, 28)
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (timer) clearInterval(timer)
    }
  }, [text, splashDone])
  return <span ref={ref}>{out}</span>
}

/**
 * เมนู header: hover = พื้นจาง + ขีดเขียวโผล่ชิดขอบล่างของ cell (ตาม ref ที่ส่งมา)
 * เลิก hover = ตัวหนังสือเล่น decrypt scramble หนึ่งรอบ — ไม่เล่นตอนเข้า เล่นตอนออก
 */
function NavItem({ label, href }: { label: string; href: string }) {
  const [out, setOut] = useState(label)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const scramble = () => {
    if (timer.current) clearInterval(timer.current)
    let revealed = 0
    timer.current = setInterval(() => {
      revealed += 1
      setOut(
        label
          .split('')
          .map((ch, i) => {
            if (i < revealed || ch === ' ') return ch
            return SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]
          })
          .join(''),
      )
      if (revealed >= label.length && timer.current) clearInterval(timer.current)
    }, 28)
  }
  useEffect(() => () => clearInterval(timer.current), [])
  return (
    <a
      href={href}
      onMouseLeave={scramble}
      className={`${CELL} group relative -ml-px flex flex-1 items-center pl-[clamp(1.25rem,2.2vw,3rem)] text-[16px] font-normal text-[#292a2e] transition-colors duration-[400ms] hover:bg-[#f2f5f3] max-md:hidden`}
    >
      {out}
      <span
        className="absolute inset-x-px bottom-px h-[3px] bg-[#2e7d32] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden
      />
    </a>
  )
}

export function Portfolio2026Page() {
  /**
   * ลำดับการเปิดหน้า: สปแลชออก -> ฉาก 3D ในกรอบเล่น intro ไปพักหนึ่ง -> headline ค่อยลอยขึ้น
   * คนดูจะได้มีจังหวะไล่ดูทีละอย่าง ไม่ใช่ทุกอย่างโชว์พร้อมกันตั้งแต่เฟรมแรก
   */
  const splashDone = useIntroDone()
  const [headlineIn, setHeadlineIn] = useState(false)
  useEffect(() => {
    if (!splashDone) return
    const t = setTimeout(() => setHeadlineIn(true), 1600)
    return () => clearTimeout(t)
  }, [splashDone])

  /**
   * header หลบตอนเลื่อนลง โผล่ตอนเลื่อนขึ้น — sticky ไว้ (ที่ว่างในเลย์เอาต์คงเดิม
   * ความสูงจอแรกคิดจาก header 74px อยู่) แล้วเลื่อนพ้นจอด้วย transform แทน
   * ขยับเกิน 6px ค่อยตัดสินทิศ — กัน jitter จาก trackpad แกว่งทีละพิกเซล
   */
  const [headerHidden, setHeaderHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const d = y - last
      if (Math.abs(d) < 6) return
      setHeaderHidden(d > 0 && y > 74)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className="min-h-screen bg-[#e8edec] text-[#292a2e]"
      style={{ fontFamily: "'Mona Sans', 'DM Sans', system-ui, sans-serif" }}
    >
      <Leva hidden />
      {/* แถบบน (rev 12542:76): แถวเซลล์วิ่งเต็มจอ แต่ช่องเนื้อหาอยู่ระหว่างเส้น guide —
          ริมสองข้างเป็นเซลล์เปล่ากว้างเท่า gutter ช่องโลโก้หดตามเนื้อหา (ไม่ fix กว้าง)
          เมนู SemiBold จัดกลางแนวตั้ง ช่องสุดท้ายสีเขียวเป็น Resume */}
      {/* fixed ไม่ใช่ sticky — html/body มี overflow-x: hidden (กติกา global) ซึ่งทำให้
          sticky ไม่เกาะ viewport; กันที่ว่างด้วย spacer ข้างล่างแทน */}
      <header
        className={`fixed inset-x-0 top-0 z-50 flex w-full items-stretch transition-transform duration-300 ease-out ${headerHidden ? '-translate-y-full' : ''}`}
        style={{ height: HEADER_H }}
      >
        <div className={`${CELL} shrink-0`} style={{ width: GUTTER }} />
        <div className={`${CELL} -ml-px flex shrink-0 items-center px-[clamp(1.25rem,2.2vw,3rem)]`}>
          <Logo width={93} height={32} className="" />
        </div>
        <nav className="-ml-px flex flex-1 items-stretch">
          {NAV.map((label) => (
            <NavItem key={label} label={label} href="#what-i-do" />
          ))}
          <a
            href={SITE.resumeUrl}
            target="_blank"
            rel="noreferrer"
            className={`${BORDER} -ml-px flex flex-1 items-center gap-2 bg-[#008a15] pl-[clamp(1.25rem,2.2vw,3rem)] text-[16px] font-medium text-white transition-colors duration-[400ms] hover:bg-[#0d6731]`}
          >
            Resume
            <img src={arrowOutward} alt="" className="size-5" />
          </a>
        </nav>
        <div className={`${CELL} -ml-px shrink-0`} style={{ width: GUTTER }} />
      </header>
      {/* จองที่ของ header ในโฟลว์ — ความสูงจอแรกยังคิดจาก 100svh - 74px ได้เหมือนเดิม */}
      <div style={{ height: HEADER_H }} />

      {/* คอนเทนต์อยู่ระหว่างเส้นตั้งสองเส้น (ตาม comp: เส้น guide ที่ 4.44vw จากขอบ)
          จอแรก (หัวเรื่อง + แถว hero) ถูกบีบให้จบใน viewport พอดี: header อยู่นอกก้อนนี้
          แถว hero เป็น flex-1 กินที่ที่เหลือ — จอเล็กเลิกบีบ ปล่อยไหลยาวตามเนื้อหา */}
      <main
        className="flex flex-col border-x border-[#d2d9d5] lg:h-[calc(100svh-74px)] lg:min-h-[38rem]"
        style={{ marginInline: GUTTER }}
      >
        {/* headline rev ใหม่ (12542:76): VISION ตัว outline | INTO เล็ก + EXPERIENCES แดงซ้อนกันฝั่งขวา
            ตัวอักษรทั้งสามเป็น vector จาก Figma (ฟอนต์ custom) — สัดส่วนกว้างอิงคอมพ์ 1312:
            VISION 580 = 44%, คอลัมน์ขวา 643 = 49% ที่เหลือเป็นช่องไฟ */}
        <section className="shrink-0 px-[clamp(1rem,1.85vw,2.5rem)] py-[clamp(0.75rem,1.7vw,2.25rem)]">
          {/* ความสูงแถวมาจากคอลัมน์ขวา (INTO + EXPERIENCES) — VISION ยืดตาม (items-stretch)
              ก้น ascii จึงบรรจบเท่าก้น EXPERIENCES พอดีทุกขนาดจอ ไม่ต้อง fix อัตราส่วน */}
          <h1 className="flex w-full items-stretch gap-[1.85%]">
            {/* VISION เป็น ascii text effect (reactbits) — คลื่นไหว ไม่ตามเมาส์ */}
            <span
              className={`v2-rise relative block w-[44.2%] ${headlineIn ? 'is-in' : ''}`}
              aria-label="Vision"
            >
              <AsciiText text="VISION" asciiFontSize={10} planeBaseHeight={24} color="#1868db" />
            </span>
            {/* คำละจังหวะ: VISION ขึ้นก่อน แล้ว INTO ตาม แล้ว EXPERIENCES ปิดท้าย */}
            <span className="flex w-[49%] flex-col gap-[clamp(0.5rem,1.7vw,2rem)] pt-[0.3%]">
              <img
                src={intoMark}
                alt="into"
                className={`v2-rise w-[14%] ${headlineIn ? 'is-in' : ''}`}
                style={{ transitionDelay: '0.22s' }}
              />
              {/* EXPERIENCES เป็น warp text (reactbits) — ผิวตัวอักษรบิดตาม fbm ตลอดเวลา
                  และโป่งตามเมาส์ กล่องคงสัดส่วน asset เดิม (645x69) ก้นจึงยังบรรจบกับ VISION */}
              <span
                className={`v2-rise relative block w-full ${headlineIn ? 'is-in' : ''}`}
                style={{ transitionDelay: '0.44s', aspectRatio: '645 / 69' }}
                aria-label="Experiences"
              >
                {headlineIn && (
                  <WarpText
                    text="EXPERIENCES"
                    color="#EF4343"
                    fontSize="400px"
                    fontWeight={800}
                    letterSpacing="-0.02em"
                    // ปิดการแยกช่องสี: ตัวอักษรแดงล้วน พอ R ถูกเลื่อนคนละทางกับ B
                    // ขอบจะเหลือแค่ G/B = คราบเขียวอมดำ ไม่ใช่เงาบิดอย่างที่ตั้งใจ
                    refraction={0}
                    // speed 0 = ไม่มี drift พื้นหลัง — ผิวนิ่ง ขยับเฉพาะตอนเมาส์เข้าใกล้
                    speed={0}
                    // กล่อง headline เตี้ยกว่า demo มาก (66px vs 430px) — ระยะบิดคิดเป็นสัดส่วน
                    // ความสูงกล่อง ต้องอัดชดเชยให้คลื่นเทียบขนาดตัวอักษรเท่า demo (~1.5% ของ glyph)
                    warpStrength={0.45}
                    // กล่องเตี้ยเท่าความสูงตัวอักษรพอดี — lineHeight ต้องใกล้ cap height
                    // ไม่งั้นความสูงบรรทัดไปกินโควตาแล้วคำย่อจนไม่เต็มความกว้าง
                    lineHeight={0.74}
                    align="left"
                  />
                )}
              </span>
            </span>
          </h1>
        </section>

        {/* แถวแรก: ฉาก 3D จริงของ /joespresso | คอลัมน์ข้อมูล */}
        <section id="hero" className="flex min-h-0 flex-1 items-stretch max-lg:flex-col">
          {/* intro เล่นในกรอบนี้ (สปแลชตัวเดียวกันกั้นให้แล้ว)
              beat scroll ของฉากอยู่ที่ 0 ตลอดเพราะหน้านี้ไม่มีราง .jp-scroll — ค้างท่า hero พอดี */}
          <div className={`${CELL} relative flex-[1.26] overflow-hidden max-lg:min-h-[30rem]`}>
            <Suspense fallback={null}>
              <JoeScene faceRight />
            </Suspense>
          </div>
          <div className="-ml-px flex flex-1 flex-col max-lg:ml-0 max-lg:-mt-px">
            {/* บรรทัดบทบาท (decrypt effect) + สถานะ — comp 12542:184 */}
            <div className={`${CELL} flex items-center justify-between gap-4 ${PAD} ${BODY_TEXT} font-medium text-black/50`}>
              <p className="whitespace-nowrap">
                <DecryptText text="ux/ui designer / vibe coder / coffee lover" />
              </p>
              {/* comp 12546:158819 — มุมขวาเป็นโลเคชัน (open to work ย้ายไปแถบสีคั่นหน้า) */}
              <p className="flex shrink-0 items-center gap-2">
                Bangkok, TH
                <span className="inline-block size-[0.85em] bg-[#008a15]" aria-hidden />
              </p>
            </div>
            {/* การ์ด quote + บันไดพิกเซล (comp 12542:153) */}
            <div className={`${CELL} relative -mt-px min-h-0 flex-1 overflow-hidden ${PAD}`}>
              <div>
                <img src={quoteMark} alt="" className="h-[clamp(1.4rem,1.9vw,2rem)]" />
                <p className="mt-2 max-w-[92%] text-[clamp(1.35rem,1.95vw,2.25rem)] font-medium leading-normal text-black">
                  Valuable products aren’t about how it’s look, it’s what served their need.
                </p>
              </div>
              {/* บันไดพิกเซล: ตาราง 4x4 ไล่ขั้นขึ้นทางขวา สีตาม comp — ชิดมุมขวาล่างของการ์ดพอดี
                  (absolute หลบ padding ของการ์ด) */}
              <div
                className="absolute bottom-0 right-0 grid"
                style={{
                  gridTemplateColumns: 'repeat(4, clamp(1.6rem,2.8vw,2.5rem))',
                  gridAutoRows: 'clamp(1.6rem,2.8vw,2.5rem)',
                }}
                aria-hidden
              >
                {[
                  [null, null, null, '#0e7516'],
                  [null, null, '#0e7516', '#c15200'],
                  [null, '#0e7516', '#c15200', '#fe7ded'],
                  ['#0e7516', '#c15200', '#fe7ded', '#ad85fe'],
                ].flat().map((c, i) => (
                  <span key={i} style={c ? { background: c } : undefined} />
                ))}
              </div>
            </div>
            {/* Get in Touch — ปุ่มเขียวชั้นสีซ้อนแบบ githubuniverse (comp 12542:172) + social */}
            <div className={`${CELL} -mt-px flex items-center justify-between gap-4 ${PAD}`}>
              <a
                href={`mailto:${SITE.email}`}
                className="v2-cta flex h-[clamp(3.25rem,5vw,4.5rem)] w-[54%] items-center gap-2 pl-[clamp(1.25rem,2.2vw,2rem)] text-[clamp(1.05rem,1.4vw,1.25rem)] font-semibold text-white"
              >
                Get in Touch
                <img src={arrowOutward} alt="" className="size-6" />
              </a>
              <div className="flex gap-[clamp(1rem,1.5vw,2rem)]">
                {SOCIALS.map((s) => (
                  <a key={s.name} href={s.href} target="_blank" rel="noreferrer" aria-label={s.name}>
                    <img
                      src={s.icon}
                      alt=""
                      className={`size-[clamp(2.25rem,2.4vw,3.25rem)] transition-opacity hover:opacity-70 ${s.filter === 'invert' ? 'invert' : 'brightness-0'}`}
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* แถบ Open to work คั่นหน้า — marquee เลื่อนไม่รู้จบ เต็มความกว้างจอ (comp 12546:158910)
          เนื้อในซ้ำสองชุด แล้วเลื่อน -50% วนลูป: รอยต่อจึงเนียนทุกขนาดจอ */}
      <div className="my-[clamp(1.5rem,2.8vw,2.5rem)] overflow-hidden" aria-hidden>
        <div className="v2-marquee">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex">
              {([
                ['#c25200', 'text-white'],
                ['#5a3bf7', 'text-white'],
                ['#62ed83', 'text-black'],
                ['#bba00f', 'text-black'],
              ] as const).map(([bg, tone]) => (
                <p
                  key={bg}
                  className={`flex h-[clamp(2.75rem,3.75vw,3.4rem)] w-[clamp(15rem,26vw,23.5rem)] items-center justify-center gap-2 ${BODY_TEXT} font-medium ${tone}`}
                  style={{ background: bg }}
                >
                  Open to work
                  <span className="inline-block size-[0.85em] rounded-full bg-[#008a15]" />
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      <main className="border-x border-[#d2d9d5]" style={{ marginInline: GUTTER }}>
        {/* แถวหัว section: Pixels & Logic | ป้าย joe.skills() (comp 12546:158862) */}
        <section id="pixels-logic" className="flex items-stretch max-lg:flex-col">
          <div className={`${CELL} min-h-[clamp(7rem,13.75vw,12.5rem)] flex-[0.82] ${PAD}`}>
            <p className="text-[clamp(1.35rem,1.95vw,2.25rem)] font-medium text-black">
              Pixels &amp; Logic
            </p>
          </div>
          <div className={`${CELL} -ml-px flex flex-1 items-end justify-end ${PAD} max-lg:ml-0 max-lg:-mt-px`}>
            <p className={`${BODY_TEXT} font-medium text-black/50`}>joe.skills()</p>
          </div>
        </section>

        {/* แถวการ์ด: Coding | mascot 3D ตัวเดียวกับฉากหลัก + โมเสกพิกเซล (comp 12546:158827) */}
        <section id="what-i-do" className="-mt-px flex items-stretch max-lg:flex-col">
          <div className={`${CELL} relative flex min-h-[clamp(18rem,25vw,22.5rem)] flex-[0.82] flex-col ${PAD}`}>
            <p className={`${BODY_TEXT} font-medium text-[#666]`}>
              <Eyebrow text="What I Do" />
            </p>
            <p className="mt-1 text-[clamp(2.5rem,3.4vw,4rem)] font-semibold leading-none text-[#0dc03e]">
              Coding
            </p>
            <p className={`mt-auto ${BODY_TEXT} font-medium text-[#666]`}>
              Bringing a design into real functional application.
            </p>
            {/* ลายน้ำ prompt >_ กลางการ์ด */}
            <img
              src={promptMark}
              alt=""
              className="pointer-events-none absolute left-1/2 top-1/2 w-[clamp(7rem,10vw,11rem)] -translate-x-1/2 -translate-y-1/2"
            />
          </div>
          {/* mascot ต้องเป็น 3D ตัวจริง (GLB clone ต่อ instance) — ใช้รูปเฉพาะครึ่ง tiles ขวา */}
          <div className={`${CELL} relative -ml-px flex flex-1 overflow-hidden max-lg:ml-0 max-lg:-mt-px max-lg:min-h-[18rem]`}>
            <div className="relative w-1/2">
              <Suspense fallback={null}>
                <MascotCard />
              </Suspense>
            </div>
            <img src={buildingMosaic} alt="" className="w-1/2 object-cover object-right" />
          </div>
        </section>

        {/* กันคอนเทนต์จบชนขอบ — ช่องว่างโปร่ง ๆ ก่อนแถบโมเสกท้ายหน้า ตาม comp */}
        <div className="h-[12vh]" />
      </main>

      {/* แถบโมเสกพิกเซลปิดท้ายหน้า — เต็มความกว้างจอ (comp 12546:158878) */}
      <img src={mosaicBand} alt="" aria-hidden className="block w-full" />
    </div>
  )
}
