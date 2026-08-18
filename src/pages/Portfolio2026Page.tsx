import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import './portfolio2026.css'
import { Leva } from 'leva'
import { SITE } from '@/config/site'
// โลโก้ตัวที่รับ color ได้ (ตัวใน components/ ตายตัวเป็นสีอ่อนสำหรับ NavBar พื้นเข้ม)
import { Logo } from '@/joespresso/Logo'
import arrowOutward from '@/assets/v2/arrow-outward.svg'
import portfolioMark from '@/assets/v2/portfolio-2026.svg'
import selBox from '@/assets/v2/sel-box.svg'
import selHandle from '@/assets/v2/sel-handle.svg'
import promptMark from '@/assets/v2/prompt-mark.svg'
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
const HEADER_H = 'clamp(3.5rem,4.44vw,6rem)'
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
  useEffect(() => {
    const el = ref.current
    if (!el) return
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
  }, [text])
  return (
    <span ref={ref} className="v2-eyebrow">
      {text.slice(0, n)}
      <span className="v2-caret" aria-hidden />
    </span>
  )
}

export function Portfolio2026Page() {
  return (
    <div
      className="min-h-screen bg-[#e8edec] text-[#292a2e]"
      style={{ fontFamily: "'Mona Sans', 'DM Sans', system-ui, sans-serif" }}
    >
      <Leva hidden />
      {/* แถบบน: โลโก้ในช่องซ้าย เมนูเป็นช่องตาราง ช่องสุดท้ายสีเขียวเป็น Resume */}
      <header className="flex w-full items-stretch">
        <div
          className={`${CELL} flex shrink-0 items-center`}
          style={{ height: HEADER_H, width: 'clamp(120px,15.35vw,340px)', paddingLeft: GUTTER }}
        >
          <Logo width={93} height={32} className="" />
        </div>
        <nav className="flex flex-1 items-stretch">
          {NAV.map((label) => (
            <a
              key={label}
              href="#what-i-do"
              className={`${CELL} -ml-px flex flex-1 items-center px-[clamp(1.25rem,2.2vw,3rem)] text-[clamp(1rem,1.25vw,1.5rem)] font-medium text-[#292a2e] transition-colors hover:bg-[#dfe5e2] max-md:hidden`}
              style={{ height: HEADER_H }}
            >
              {label}
            </a>
          ))}
          <a
            href={SITE.resumeUrl}
            target="_blank"
            rel="noreferrer"
            className={`${BORDER} -ml-px flex flex-1 items-center gap-2 bg-[#008a15] px-[clamp(1.25rem,2.2vw,3rem)] text-[clamp(1rem,1.25vw,1.5rem)] font-medium text-white transition-colors hover:bg-[#007512]`}
            style={{ height: HEADER_H }}
          >
            Resume
            <img src={arrowOutward} alt="" className="size-[clamp(1.25rem,1.5vw,1.75rem)]" />
          </a>
        </nav>
      </header>

      {/* คอนเทนต์อยู่ระหว่างเส้นตั้งสองเส้น (ตาม comp: เส้น guide ที่ 4.44vw จากขอบ)
          จอแรก (หัวเรื่อง + แถว hero) ถูกบีบให้จบใน viewport พอดี: header อยู่นอกก้อนนี้
          แถว hero เป็น flex-1 กินที่ที่เหลือ — จอเล็กเลิกบีบ ปล่อยไหลยาวตามเนื้อหา */}
      <main
        className="flex flex-col border-x border-[#d2d9d5] lg:h-[calc(100svh-clamp(3.5rem,4.44vw,6rem))] lg:min-h-[38rem]"
        style={{ marginInline: GUTTER }}
      >
        {/* PORTFOLIO ' 2026 */}
        <section className="shrink-0 px-[clamp(1.25rem,2.8vw,4rem)] py-[clamp(0.75rem,1.4vw,2rem)]">
          {/* ตัวอักษร vector จาก Figma (node 1350:4171) — ฟอนต์ custom ของ comp ไม่ใช่ Mona Sans
              กว้างตามคอลัมน์ สูงตามสัดส่วนไฟล์เอง */}
          <h1>
            <img src={portfolioMark} alt="PORTFOLIO ’2026" className="w-full" />
          </h1>
        </section>

        {/* แถวแรก: ฉาก 3D จริงของ /joespresso | คอลัมน์ข้อมูล */}
        <section id="hero" className="flex min-h-0 flex-1 items-stretch max-lg:flex-col">
          {/* intro เล่นในกรอบนี้ (สปแลชตัวเดียวกันกั้นให้แล้ว)
              beat scroll ของฉากอยู่ที่ 0 ตลอดเพราะหน้านี้ไม่มีราง .jp-scroll — ค้างท่า hero พอดี */}
          <div className={`${CELL} relative flex-[1.26] overflow-hidden max-lg:min-h-[30rem]`}>
            <Suspense fallback={null}>
              <JoeScene />
            </Suspense>
          </div>
          <div className="-ml-px flex flex-1 flex-col max-lg:ml-0 max-lg:-mt-px">
            {/* บรรทัดบทบาท + สถานะ */}
            <div className={`${CELL} flex flex-col gap-1.5 ${PAD} ${BODY_TEXT} font-medium text-[#666]`}>
              <p>
                <Eyebrow text="UX/UI Designer / Vibe Coder / Coffee Lover" />
              </p>
              <p className="v2-eyebrow flex items-center gap-2">
                Open to Work
                <span className="inline-block size-[0.8em] bg-[#008a15]" aria-hidden />
              </p>
            </div>
            {/* พาดหัว Turn Vision into {Experience} */}
            <div className={`${CELL} -mt-px flex min-h-0 flex-1 flex-col justify-between ${PAD}`}>
              <div className="text-[clamp(2.25rem,3.4vw,5.25rem)] font-semibold leading-[1.15]">
                <p className="flex flex-wrap items-center gap-x-[0.375em]">
                  Turn
                  {/* คำว่า Vision อยู่ในกรอบ selection ของ design tool (ตาม comp) */}
                  <span className="relative inline-block px-[0.25em]">
                    <img src={selBox} alt="" className="absolute inset-y-[0.06em] left-1 right-1 h-[0.92em] w-[calc(100%-8px)]" />
                    <img src={selHandle} alt="" className="absolute left-0 top-[0.04em] h-[0.98em] w-[6px]" />
                    <img src={selHandle} alt="" className="absolute right-0 top-[0.04em] h-[0.98em] w-[6px]" />
                    <span
                      className="relative text-[#1868db]"
                      style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700 }}
                    >
                      Vision
                    </span>
                  </span>
                </p>
                <p className="flex flex-wrap items-center gap-x-[0.375em]">
                  into <span className="text-[#ef4343]">{'{Experience}'}</span>
                </p>
              </div>
              <div className={`mt-4 ${BODY_TEXT} font-medium leading-normal text-[#666]`}>
                <p>Designing is not just about pretty it’s more about solving problems.</p>
                <p>I love crafting valuable things, bringing design to a real-world solution.</p>
              </div>
            </div>
            {/* Get in Touch */}
            <div className={`${CELL} -mt-px flex flex-col gap-0.5 ${PAD}`}>
              <p className={`${BODY_TEXT} font-medium text-[#666]`}>
                <Eyebrow text="Get in Touch" />
              </p>
              <a
                href={`mailto:${SITE.email}`}
                className="text-[clamp(1.25rem,1.5vw,2rem)] font-semibold hover:underline"
              >
                {SITE.email}
              </a>
              <div className="mt-3 flex justify-end gap-[clamp(1rem,1.5vw,2rem)]">
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

      <main className="border-x border-[#d2d9d5]" style={{ marginInline: GUTTER }}>
        {/* แถวสอง: mascot ตัวเดียวกับฉากหลัก (คนละ instance — GLB ถูก clone ต่อ instance) */}
        <section id="what-i-do" className="-mt-px flex items-stretch max-lg:flex-col">
          <div className={`${CELL} relative min-h-[clamp(20rem,45vh,34rem)] flex-[1.22] overflow-hidden`}>
            <Suspense fallback={null}>
              <MascotCard />
            </Suspense>
          </div>
          <div className={`${CELL} relative -ml-px flex flex-1 flex-col ${PAD} max-lg:ml-0 max-lg:-mt-px`}>
            <p className={`${BODY_TEXT} font-medium text-[#666]`}>
              <Eyebrow text="What I Do" />
            </p>
            <p className="mt-1 text-[clamp(2.5rem,3.4vw,5.25rem)] font-semibold leading-none text-[#0dc03e]">
              Building
            </p>
            <p className={`mt-auto ${BODY_TEXT} font-medium text-[#666]`}>
              Bringing a design into real functional application
            </p>
            <img
              src={promptMark}
              alt=""
              className="pointer-events-none absolute right-[clamp(1.5rem,4vw,5rem)] top-1/2 w-[clamp(8rem,11vw,16rem)] -translate-y-1/2 opacity-80"
            />
          </div>
        </section>

        {/* กันคอนเทนต์จบชนขอบ — ช่องว่างโปร่ง ๆ ท้ายหน้าแบบเดียวกับ comp */}
        <div className="h-[20vh]" />
      </main>
    </div>
  )
}
