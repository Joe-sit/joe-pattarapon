import {
  Fragment,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import './portfolio2026.css'
import { Leva } from 'leva'
import { Card, CardSwap } from '@/components/CardSwap'
import { SITE } from '@/config/site'
import { useIntroDone } from '@/stores/intro'
// โลโก้ตัวที่รับ color ได้ (ตัวใน components/ ตายตัวเป็นสีอ่อนสำหรับ NavBar พื้นเข้ม)
import { Logo } from '@/joespresso/Logo'
import { AsciiText } from '@/components/AsciiText'
import { WarpText } from '@/components/WarpText'
import arrowOutward from '@/assets/v2/arrow-outward.svg'
import intoMark from '@/assets/v2/into.svg'
import promptMark from '@/assets/v2/prompt-mark.svg'
import skillsBracket from '@/assets/v2/skills-bracket.svg'
import skillsCursor from '@/assets/v2/skills-cursor.svg'
import skillsPencil from '@/assets/v2/skills-pencil.svg'
// ตัวเดียวกันแต่เอา "เนื้อไฟล์" มาฝังเป็น inline — ต้องเข้าถึง path ข้างในเพื่อไล่โผล่ทีละชิ้น
// (<img src> เข้าไปแตะลูกใน SVG ไม่ได้เลย)
import skillsCursorRaw from '@/assets/v2/skills-cursor.svg?raw'
import skillsPixelsRaw from '@/assets/v2/skills-pixels.svg?raw'
import skillsPencilRaw from '@/assets/v2/skills-pencil.svg?raw'
import quoteMark from '@/assets/v2/quote-mark.svg'
import mosaicBand from '@/assets/v2/mosaic-band.svg'
import chartBarIcon from '@/assets/v2/icon-chart-bar.svg'
import homeHealthIcon from '@/assets/v2/icon-home-health.svg'
import logoSit from '@/assets/v2/logo-sit.png'
import logoKmutt from '@/assets/v2/logo-kmutt.png'
import bmsOffice from '@/assets/v2/bms-office.png'
import githubIcon from '@/assets/github-142_svgrepo.com.svg'
import linkedinIcon from '@/assets/linkedin_svgrepo.com.svg'

// ฉาก 3D ของ /joespresso ทั้งใบ + การ์ด mascot ตัวเดียวกับฉาก — chunk หนัก แยกโหลด
const JoeScene = lazy(() => import('@/joespresso/App').then((m) => ({ default: m.Scene })))
const MascotCard = lazy(() =>
  import('@/joespresso/MascotCard').then((m) => ({ default: m.MascotCard })),
)
const StackKeys = lazy(() =>
  import('@/sections/stack/StackKeys').then((m) => ({ default: m.StackKeys })),
)
const MascotPeek = lazy(() =>
  import('@/joespresso/MascotPeek').then((m) => ({ default: m.MascotPeek })),
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
// เส้นตั้งของ header อยู่ "ใน" เซลล์ริม (border-box) = ช่วง [GUTTER-1, GUTTER]
// ส่วน border-left ของ <main> เริ่มที่ขอบ margin พอดี = [GUTTER, GUTTER+1] — เหลื่อมกัน 1px
// ดึงเข้ามาหนึ่งพิกเซล ทั้งสองเส้นจึงทับกันสนิท (วิธีเดียวกับ -ml-px ที่ใช้ต่อเซลล์ใน header)
const GUTTER_LINE = `calc(${GUTTER} - 1px)`
const HEADER_H = '74px'
const PAD = 'p-[clamp(1rem,1.67vw,2rem)]'
// หนึ่งจอเต็ม = ความสูง viewport ลบแถบบน — ทุก section ใช้ค่าเดียวกันนี้ ไม่ต่างคนต่างเดา
// svh (ไม่ใช่ vh) เพราะบนมือถือแถบ URL ยุบ/ยืด แล้ว vh จะกระโดด
// min-h = อย่างน้อยหนึ่งจอ แต่โตตามเนื้อหาได้ ไม่ตัดทิ้ง
// (เคยมี SCREEN_H บังคับ "พอดีจอเป๊ะ" ด้วย — เอาออกแล้ว บล็อก what-i-do สูงตามเนื้อหาแบบ GU)
// จอเล็ก (<lg) ไม่บีบเลย ปล่อยไหลยาว — เนื้อหาสูงกว่าจอเตี้ย ๆ อยู่แล้ว
const SCREEN_MIN = 'lg:min-h-[calc(100svh-74px)]'
// ช่องว่างระหว่าง "เรื่อง" คนละเรื่อง — ในเรื่องเดียวกันแถวยังชนกันเส้นเดียวเหมือนเดิม (-mt-px)
const GAP_Y = 'mt-[clamp(1.5rem,3vw,3rem)]'
const BODY_TEXT = 'text-[clamp(0.9375rem,1.05vw,1.375rem)]'

// ไอคอนชุดนี้เป็นเวอร์ชันสำหรับพื้นเข้ม — ปรับลงพื้นอ่อนด้วย filter คนละแบบ:
// github เป็นวงกลมขาว+ตัวดำ ต้อง invert (ได้กลมดำ+ตัวขาวตาม design) ที่เหลือ glyph ขาวล้วน ทาดำพอ
const GITHUB_URL = 'https://github.com/Joe-sit'

const SOCIALS = [
  { name: 'GitHub', icon: githubIcon, href: GITHUB_URL, filter: 'invert' },
  { name: 'LinkedIn', icon: linkedinIcon, href: SITE.linkedIn, filter: 'darken' },
]

// เมนู header -> id ของ section จริงในหน้า (เลื่อนไปเองแบบ smooth ตอนกด)
const NAV = [
  { label: 'What I Do', id: 'what-i-do' },
  { label: 'Experiences', id: 'experiences' },
  { label: 'Works', id: 'works' },
]

/** เลื่อนไปหัว section โดยเว้นที่ให้แถบบนที่ลอยทับอยู่ */
function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const y = el.getBoundingClientRect().top + window.scrollY - Number.parseInt(HEADER_H, 10)
  window.scrollTo({ top: y, behavior: 'smooth' })
}

/**
 * ไทม์ไลน์เส้นทางงาน (comp 12563:216-244)
 *
 * `at` = ป้ายแท็บข้างล่าง ส่วน `role`/`org` คือหมุดบนเส้น — หมุดสุดท้ายเป็นปัจจุบัน
 * จึงยังไม่มีข้อความกำกับในคอมพ์ เส้นหลังหมุดนั้นเป็นสีเทา (ยังไม่ถึง)
 */
type Stop = {
  at: string
  role: string
  org: string
  /** เนื้อการ์ดของช่วงนั้น — มีเฉพาะช่วงที่มีของจริง ไม่มีก็ปล่อยว่าง ไม่แต่งขึ้นมา */
  credential?: string
  logos?: { src: string; alt: string }[]
  quote?: string
  photo?: { src: string; alt: string }
}

const JOURNEY: Stop[] = [
  {
    at: '@SIT',
    role: 'B.Sc. Information Technology',
    org: 'Second Class Honors',
    credential: 'B.Sc. Information Technology',
    logos: [
      { src: logoSit, alt: 'School of Information Technology' },
      { src: logoKmutt, alt: 'KMUTT' },
    ],
    quote: 'This valuable 4 years gave me a solid foundation of software development.',
    photo: { src: bmsOffice, alt: 'บรรยากาศห้องประชุมของทีม' },
  },
  { at: '@APPMAN', role: 'Internship UX/UI Designer', org: 'AppMan Co,. Ltd.' },
  { at: '@BMS', role: 'Full-time UX/UI Designer', org: 'Bangkok Medical Software Co,. Ltd.' },
]

/**
 * เห็นครั้งแรกเมื่อไร ค่อยปล่อยให้ลูก ๆ ไหลขึ้นมา (เล่นครั้งเดียว ไม่เล่นซ้ำตอน scroll กลับ)
 * คืนค่าเป็น class ที่เอาไปแปะบนกล่องแม่ — ลูกที่มี .v2-stagger จะเข้าฉากตามลำดับ --i ของตัวเอง
 */
function useRevealed(ref: RefObject<HTMLElement | null>) {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        setSeen(true)
      },
      // threshold ต้องเป็น 0: section อย่าง works สูงกว่าจอหลายเท่า 25% ของมันไม่มีทางโผล่พร้อมกัน
      // ใช้ rootMargin หดขอบล่างแทน = เริ่มเล่นตอนหัว section ขึ้นมาพ้นครึ่งล่างของจอ
      { threshold: 0, rootMargin: '0px 0px -12% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, seen])
  return seen
}

/**
 * เรขาคณิตของกระเบื้องสามใบ คิดเป็น % ของ "ทั้ง section" ไม่ใช่ของบล็อกกระเบื้อง
 *
 * ใบพวกนี้ต้องขยายข้ามการ์ดข้อความไปชนขอบขวาของ section ได้ จึงวางเป็น absolute เทียบ
 * section ตรง ๆ แทนที่จะอยู่ในโฟลว์ของบล็อกกระเบื้อง (ในโฟลว์ขยายได้แค่ในบล็อกตัวเอง)
 * บล็อกกระเบื้องกว้าง 61.2% ของ section → ตัวละคร 30.6% | ฟ้า/ม่วง 15.3% | ส้ม 15.3%
 */
const TILE_BOX = [
  // lift = ระยะยกภาพประกอบตอนกาง คิดเป็น % ของกรอบภาพเอง (ใบส้มสูงเป็นสองเท่า ต้องยกมากกว่า)
  { left: 30.6, right: 54.1, top: '0%', height: '50%', art: 'aspect-square', lift: '-translate-y-[48%]' },
  { left: 30.6, right: 54.1, top: '50%', height: '50%', art: 'aspect-square', lift: '-translate-y-[48%]' },
  { left: 45.9, right: 38.8, top: '0%', height: '100%', art: 'aspect-[1/2]', lift: '-translate-y-[62%]' },
]

/**
 * กระเบื้องสกิลหนึ่งใบ — ขยายเต็มด้านขวาเมื่อ scroll มาถึงคิวของมัน
 *
 * ไม่ใช่ปุ่มและไม่ผูก hover แล้ว: ลำดับการเล่าคุมด้วย scroll (scrollytelling) อย่างเดียว
 * ตอนขยาย คำอธิบายของใบนั้นโผล่มาอยู่ในกล่องเอง ทับที่ที่เป็นการ์ดข้อความตอน default
 */
function SkillTile({
  i,
  order,
  from,
  active,
  className,
  children,
}: {
  i: number
  /** ลำดับเข้าฉาก — ห่างกันชิ้นละ 110ms ตาม --i */
  order: number
  /** ระยะตั้งต้น: ต้องถอยไปให้ซ่อนอยู่หลังกระเบื้องตัวละครพอดี (คิดเป็น % ของความกว้างตัวเอง) */
  from: string
  active: number | null
  className: string
  children: ReactNode
}) {
  const on = i === active
  const box = TILE_BOX[i]
  const skill = SKILLS[i]
  return (
    <div
      className={`v2-slide lg:absolute lg:transition-[right] lg:duration-[1100ms] lg:ease-[cubic-bezier(0.16,1,0.3,1)] max-lg:min-h-[12rem] ${on ? 'z-40 overflow-visible' : 'overflow-hidden'} ${className}`}
      style={{
        background: skill.color,
        '--i': order,
        '--from': from,
        left: `${box.left}%`,
        right: `${on ? 0 : box.right}%`,
        top: box.top,
        height: box.height,
      } as CSSProperties}
    >
      {/* ต้องกินพื้นที่เต็มกล่อง: span นี้มี transform ค้างจาก keyframe (fill both) มันจึงกลาย
          เป็น containing block ของลูกที่ absolute — ถ้าปล่อยเป็น block สูงศูนย์ ไอคอนที่สั่ง
          bottom-0 จะไปเกาะก้นของ span ไม่ใช่ก้นกระเบื้อง (วัดได้เยื้องขึ้นมา 100-200px) */}
      {/* เส้นบาง ๆ ที่ก้นกล่อง ยาวขึ้นตามระยะ scroll ในช่วงของกล่องนี้ (--skill-p ตั้งที่ section)
          เต็มเส้น = กำลังจะเปลี่ยนใบ ไม่ใส่ transition: ต้องเกาะนิ้วที่เลื่อนอยู่ ไม่ใช่ตามมาทีหลัง */}
      {on ? (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[8px] origin-left bg-white/60"
          style={{ transform: 'scaleX(var(--skill-p, 0))' }}
          aria-hidden
        />
      ) : null}
      <span className="v2-pop-in absolute inset-0" style={{ '--i': order } as CSSProperties}>
        {/* กรอบของภาพประกอบล็อกสัดส่วนไว้เท่ากระเบื้องตอนยังไม่กาง (ผูกกับ "ความสูง" ไม่ใช่ความกว้าง)
            ถ้าปล่อยให้ % อ้างความกว้างของกล่อง พอกล่องกางออกไปสามเท่า ไอคอนจะโตตามจนล้นทั้งจอ */}
        {/* ใบที่กำลังเล่า: ภาพประกอบโตขึ้นจนล้นออกนอกกล่อง (กล่องเปลี่ยนเป็น overflow-visible
            และยกขึ้น z-40 ไม่งั้นส่วนที่ล้นจะโดนใบอื่นทับ) ล้นขึ้น "ด้านบน" อย่างเดียว: จุดหมุน
            อยู่มุมขวาล่าง ภาพจึงเกาะขอบขวาไว้ แล้วยกตัวขึ้นด้วย translate จนโผล่พ้นขอบบนของกล่อง */}
        <span
          className={`pointer-events-none absolute bottom-0 right-0 flex h-full origin-bottom-right items-end justify-end transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${box.art} ${on ? `${box.lift} scale-[2.4]` : 'scale-100'}`}
        >
          {children}
        </span>
        {/* คำอธิบายอยู่ครึ่งซ้ายของกล่องที่ขยายแล้ว ไอคอนอยู่มุมขวาล่าง จึงไม่ทับกัน
            รอให้กล่องกางเกือบสุดก่อนค่อยจาง ๆ ขึ้นมา (delay) ไม่งั้นตัวอักษรวิ่งตามขอบกล่อง */}
        <span
          className={`absolute inset-y-0 left-0 flex w-[46%] flex-col justify-center px-[6%] text-white transition-opacity duration-700 ${on ? 'opacity-100 delay-500' : 'opacity-0'}`}
        >
          <span className="text-[clamp(1.5rem,2.4vw,3rem)] font-semibold leading-none">
            {skill.title}
          </span>
          <span className={`mt-3 ${BODY_TEXT} font-medium text-white/85`}>{skill.desc}</span>
        </span>
      </span>
    </div>
  )
}

/**
 * สามกระเบื้องสีใน what-i-do — ชี้เมาส์ใบไหน การ์ดขวาอธิบายสกิลนั้น
 *
 * สีหัวเรื่องใช้สีของกระเบื้องเอง คนอ่านจึงรู้ทันทีว่ากำลังอ่านใบไหนอยู่โดยไม่ต้องมีเส้นโยง
 * ค่าตั้งต้นคือ Coding (ตรงกับคอมพ์ 12574:1076 ที่หัวเรื่องเป็นสีม่วงใบเดียวกัน)
 */
type Skill = {
  title: string
  desc: string
  color: string
  /** ลายน้ำมุมขวาของการ์ด — ใช้ไฟล์เดียวกับไอคอนบนกระเบื้องใบนั้น ยกเว้น Coding ที่เป็น >_
      state ตั้งต้นไม่มีลายน้ำ (ยังไม่ได้พูดถึงสกิลไหน) จึงเป็น optional */
  mark?: string
  markClass?: string
  /**
   * true = วางไอคอนบนแผ่นสีของกระเบื้องใบนั้น
   * ไอคอนบนกระเบื้องเป็นสีขาว วางลอยบนพื้นการ์ดสีอ่อนแล้วแทบมองไม่เห็น ต้องมีพื้นรอง
   * (>_ ของ Coding เป็นเวกเตอร์สีเขียวจาง ๆ อยู่แล้ว ไม่ต้องมี)
   */
  chip?: boolean
}

const SKILLS: Skill[] = [
  {
    title: 'Research',
    // TODO: ยังไม่มีข้อความจริงของหัวข้อนี้ — ใส่ Lorem ไว้ก่อนตามที่สั่ง
    desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod.',
    color: '#158ffc',
    mark: skillsCursor,
    markClass: 'w-[38%]',
    chip: true,
  },
  {
    title: 'Coding',
    desc: 'Bringing a design into real functional application.',
    color: '#ad85fe',
    mark: promptMark,
    markClass: 'w-[clamp(7rem,10vw,11rem)]',
  },
  {
    title: 'Design',
    desc: 'Designing product flows and interfaces at AppMan and BMS.',
    color: '#fd5000',
    mark: skillsPencil,
    markClass: 'w-[44%]',
    chip: true,
  },
]

/**
 * state ตั้งต้นของ section — ยังไม่มีกล่องไหนถูก trigger การ์ดขวาจึงพูดแทนทั้งสามใบ
 * TODO: ข้อความจริงยังไม่มี ใส่ Lorem ไว้ก่อนตามที่สั่ง
 */
/**
 * ลำดับที่ scroll เล่าถึงแต่ละใบ — ไม่ใช่ลำดับใน SKILLS (นั่นผูกกับตำแหน่ง/สีของกระเบื้อง)
 * ตอนนี้: Research (ฟ้า) -> Design (ส้ม) -> Coding (ม่วง)
 */
const STORY_ORDER = [0, 2, 1]

const SKILL_DEFAULT: Skill = {
  title: 'Lorem ipsum',
  desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.',
  color: '#111111',
}

/**
 * โมเสกมุมขวาล่างของการ์ดคำพูด — บันไดไต่ขึ้นทางขวา
 *
 * แถวล่างสุดยาวสุด (สี่ช่อง) ไล่สั้นลงเรื่อย ๆ จนเหลือช่องเดียวบนสุดชิดขวา
 * เรียงจากบนลงล่างตามลำดับที่วาด ไม่ใช่จากล่างขึ้นบน
 */
const MOSAIC_ROWS = [
  ['#235f8c'],
  ['#235f8c', '#0091be'],
  ['#235f8c', '#0091be', '#898986'],
  ['#235f8c', '#0091be', '#898986', '#c9c9c9'],
]

/**
 * งานเด่น — เลื่อนลงแล้วใบใหม่ทับใบเดิมไปเรื่อย ๆ จนหมดรายการ (sticky ซ้อนชั้น)
 *
 * ตอนนี้มีของจริงใบเดียว เติมใบใหม่ในอาร์เรย์นี้แล้วการซ้อนทำงานเองทันที
 * ไม่ใส่งานสมมติมาถ่วงจำนวนให้เห็นเอฟเฟกต์ — จำนวนใบต้องเท่างานที่ทำจริง
 *
 * blurb แยกเป็นสามท่อนเพราะชื่อหน่วยงานต้องเป็นสีเขียวตามคอมพ์ (12563:307-363)
 */
const WORKS: Work[] = [
  {
    eyebrow: 'What I Do',
    title: 'Health Dashboards',
    tags: ['Data Visualization', 'UX/UI Design'],
    blurb: {
      before: 'Collaborated with the ',
      org: 'Ministry of Public Health',
      after: ' to design and develop interactive dashboards.',
    },
    stats: [
      { icon: chartBarIcon, value: '+1M', note: 'Transforming 1M+ health records into actionable insights.' },
      { icon: homeHealthIcon, value: '200+', note: 'Hospital accessible health dashboard' },
    ],
    href: SITE.resumeUrl,
    // แดชบอร์ดตัวจริงที่ deploy อยู่ — ใบบนสุดของกองการ์ดเปิดของจริงนี้ ไม่ใช่ภาพนิ่ง
    demo: 'https://n-c-ds-registry-dashboard-sri7q1.flutterflow.app/',
    // อีกสองใบยังไม่มีภาพหน้าจอจริง ใส่โทนไว้ก่อน
    shots: ['#ffffff', '#e3e3e3', '#9a9a9a'],
  },
  // ---- ตั้งแต่ตรงนี้ลงไปเป็น "ของปลอมชั่วคราว" ที่ขอมาให้ดูโครงสาระบัญ+การซ้อนการ์ด ----
  // ยังไม่ใช่งานจริง: ไม่มีตัวเลข ไม่มีลิงก์ ไม่มีชื่อหน่วยงาน เพราะไม่รู้ของจริง
  // ได้ข้อมูลจริงเมื่อไรแทนที่ทั้งก้อน แล้วลบ mock: true ออก
  { mock: true, eyebrow: 'What I Do', title: 'Hospital Queue App', tags: ['Mobile', 'UX/UI Design'], shots: ['#ffffff', '#e3e3e3', '#9a9a9a'] },
  { mock: true, eyebrow: 'What I Do', title: 'Claim Automation', tags: ['Design System', 'Frontend'], shots: ['#ffffff', '#e3e3e3', '#9a9a9a'] },
  { mock: true, eyebrow: 'What I Do', title: 'Telemedicine Portal', tags: ['Web App', 'Research'], shots: ['#ffffff', '#e3e3e3', '#9a9a9a'] },
] satisfies Work[]

type Work = {
  eyebrow: string
  title: string
  tags: string[]
  shots: string[]
  /** true = ตัวอย่างชั่วคราว ยังไม่ใช่งานจริง */
  mock?: true
  blurb?: { before: string; org: string; after: string }
  stats?: { icon: string; value: string; note: string }[]
  href?: string
  /** ลิงก์ของงานตัวจริงที่ใช้ได้ — ฝังเป็นใบแรกของกองการ์ด และมีปุ่มเปิดแท็บใหม่ */
  demo?: string
}


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
      onClick={(e) => {
        // กันการกระโดดของ anchor: Lenis คุมตำแหน่ง scroll จริงอยู่ ต้องสั่งเลื่อนเอง
        e.preventDefault()
        scrollToSection(href.slice(1))
      }}
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
   * headline ขึ้นทันทีที่สปแลชจบ — ไม่หน่วงรอ intro ของฉากอีกต่อ
   * (ทรานซิชัน v2-rise ยังอยู่ จึงยังลอยขึ้นให้เห็นจังหวะ แค่เริ่มนับตั้งแต่วินาทีที่สปแลชปิด)
   */
  const splashDone = useIntroDone()
  const headlineIn = splashDone

  /**
   * header หลบตอนเลื่อนลง โผล่ตอนเลื่อนขึ้น — sticky ไว้ (ที่ว่างในเลย์เอาต์คงเดิม
   * ความสูงจอแรกคิดจาก header 74px อยู่) แล้วเลื่อนพ้นจอด้วย transform แทน
   * ขยับเกิน 6px ค่อยตัดสินทิศ — กัน jitter จาก trackpad แกว่งทีละพิกเซล
   */
  const [headerHidden, setHeaderHidden] = useState(false)
  // ช่วงงานที่เลือกอยู่ (แท็บใต้ไทม์ไลน์) — การ์ดข้างล่างเป็นเนื้อของช่วงนี้
  const [stop, setStop] = useState(0)
  // mascot ที่แอบมองปลายไทม์ไลน์: mount ครั้งเดียวตอนเลื่อนมาถึง (canvas ใบที่สามของหน้า
  // ไม่ควรเกิดตั้งแต่โหลด) แล้วหยุด frameloop เมื่อออกนอกจอ
  const peekRef = useRef<HTMLSpanElement | null>(null)
  const [peekIn, setPeekIn] = useState(false)
  const [peekMounted, setPeekMounted] = useState(false)
  const current = JOURNEY[stop]
  // ใบงานที่กำลังอยู่บนสุดของกอง — สาระบัญในแผงส้ม (ที่ปักหมุดอยู่ใบเดียว) อ่านค่านี้
  // แป้นสแตกท้ายหน้า: canvas ใบที่สี่ของหน้า — เกิดตอนเลื่อนมาถึงเท่านั้น ไม่ใช่ตั้งแต่โหลด
  const stackRef = useRef<HTMLElement | null>(null)
  // กรอบที่ mascot ใน what-i-do ใช้คิดทิศเมาส์ — ทั้ง section ไม่ใช่แค่กรอบภาพของมันเอง
  const skillsRef = useRef<HTMLElement | null>(null)
  // กระเบื้องที่กำลังถูกเล่าถึง — null = state ตั้งต้น ตัวเลขมาจากตำแหน่ง scroll ไม่ใช่เมาส์
  const [skill, setSkill] = useState<number | null>(null)
  // กรอบสูง ๆ ที่ปักหมุด what-i-do ไว้ — ระยะ scroll ในกรอบนี้คือไทม์ไลน์ของการเล่า
  const scrollyRef = useRef<HTMLDivElement | null>(null)
  const skillsSeen = useRevealed(skillsRef)
  // เข้าฉากครั้งแรกของแต่ละ section (hero ไม่มี — มันเล่น intro ของตัวเองอยู่แล้ว)
  const headRef = useRef<HTMLElement | null>(null)
  const expRef = useRef<HTMLElement | null>(null)
  const expCardRef = useRef<HTMLElement | null>(null)
  const worksRef = useRef<HTMLElement | null>(null)
  const footRef = useRef<HTMLElement | null>(null)
  const headSeen = useRevealed(headRef)
  const expSeen = useRevealed(expRef)
  const expCardSeen = useRevealed(expCardRef)
  const worksSeen = useRevealed(worksRef)
  const stackSeen = useRevealed(stackRef)
  const footSeen = useRevealed(footRef)
  // null = state ตั้งต้น (ยังเลื่อนไม่ถึงคิวของกล่องไหน) — ไม่ได้เดาเป็นใบใดใบหนึ่งแล้ว
  const skillNow = skill === null ? SKILL_DEFAULT : SKILLS[skill]
  const [stackMounted, setStackMounted] = useState(false)
  const workRefs = useRef<(HTMLDivElement | null)[]>([])
  const [activeWork, setActiveWork] = useState(0)

  /**
   * scrollytelling ของ what-i-do — เลื่อนลงแล้วกล่องกางทีละใบตามคิว
   *
   * กรอบ scrollyRef สูงกว่าจอหลายเท่า ส่วน section ถูก sticky ค้างกลางจอไว้ ระยะที่เลื่อนได้
   * ในกรอบ (height - vh) จึงกลายเป็นไทม์ไลน์ 0..1 แล้วหั่นเป็นสี่ช่วง: ตั้งต้น -> ฟ้า -> ม่วง -> ส้ม
   * อ่านค่าใน rAF ไม่ใช่ในตัว handler เอง (scroll ยิงถี่กว่าเฟรม) และ setState เฉพาะตอนช่วงเปลี่ยน
   * บนจอเล็กไม่ปักหมุด (span <= 0) กล่องอยู่ในโฟลว์เรียงลงมา — state คงเป็นตั้งต้นทั้ง section
   */
  useEffect(() => {
    const el = scrollyRef.current
    if (!el) return
    let raf = 0
    /** ช่วงที่กล่องกำลังกางอยู่ ต้องตรงกับ duration ของ lg:transition-[right] ใน SkillTile */
    const EXPAND_MS = 1100
    let stage: number | null = -2
    let frac = 0
    // จุดตั้งต้นของแถบ: ค่า frac ตอนกล่องกางเสร็จ (-1 = ยังกางไม่จบ แถบยังไม่เริ่มนับ)
    let settleFrac = -1
    let timer = 0
    const paint = () => {
      const fill =
        settleFrac < 0
          ? 0
          : Math.min(Math.max((frac - settleFrac) / Math.max(1 - settleFrac, 0.001), 0), 1)
      skillsRef.current?.style.setProperty('--skill-p', fill.toFixed(3))
    }
    const read = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const span = r.height - window.innerHeight
      if (span <= 0) return
      const p = Math.min(Math.max(-r.top / span, 0), 1)
      const raw = (p - 0.2) / 0.24
      const idx = p < 0.2 ? null : Math.min(2, Math.floor(raw))
      const next = idx === null ? null : STORY_ORDER[idx]
      frac = idx === null ? 0 : Math.min(Math.max(raw > 3 ? 1 : raw - Math.floor(raw), 0), 1)
      /**
       * แถบความคืบหน้าเริ่มนับ "หลังกล่องกางเสร็จ" ไม่ใช่ตั้งแต่วินาทีที่เปลี่ยนใบ — ระหว่างกาง
       * แถบค้างที่ 0 พอครบ EXPAND_MS ค่อยจำ frac ตรงนั้นเป็นจุดศูนย์ แล้วยืดช่วงที่เหลือเป็น 0..1
       * เขียนลง CSS var บน section ตรง ๆ ไม่ผ่าน state — ค่านี้ขยับทุกเฟรมที่เลื่อน
       * ถ้าให้ React รีเรนเดอร์ตามจะลาก canvas ของ mascot ไปด้วยทั้งหน้า
       */
      if (idx !== stage) {
        stage = idx
        settleFrac = -1
        clearTimeout(timer)
        if (idx !== null) {
          timer = window.setTimeout(() => {
            settleFrac = frac
            paint()
          }, EXPAND_MS)
        }
      }
      paint()
      setSkill((cur) => (cur === next ? cur : next))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const els = workRefs.current.filter(Boolean) as HTMLDivElement[]
    if (els.length === 0) return
    // ใบที่ "โผล่มากที่สุด" คือใบที่กำลังดู — ใบล่างที่ยังไม่ขึ้นมาจะโดนใบบนทับอยู่
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.55) {
            setActiveWork(Number((e.target as HTMLElement).dataset.work))
          }
        }
      },
      { threshold: [0.55, 0.9] },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const el = stackRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setStackMounted(true)
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const el = peekRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        setPeekIn(e.isIntersecting)
        if (e.isIntersecting) setPeekMounted(true)
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
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
          {NAV.map((item) => (
            <NavItem key={item.id} label={item.label} href={`#${item.id}`} />
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
        style={{ marginInline: GUTTER_LINE }}
      >
        {/* headline rev ใหม่ (12542:76): VISION ตัว outline | INTO เล็ก + EXPERIENCES แดงซ้อนกันฝั่งขวา
            ตัวอักษรทั้งสามเป็น vector จาก Figma (ฟอนต์ custom) — สัดส่วนกว้างอิงคอมพ์ 1312:
            VISION 580 = 44.2% ช่องไฟ 1.85% คอลัมน์ขวากินที่เหลือทั้งหมด (53.95%)
            รวมสามค่าต้องได้ 100% พอดี ไม่งั้นคอลัมน์ขวาจะไม่ชนเส้นกริดฝั่งขวา */}
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
            <span className="flex w-[53.95%] flex-col gap-[clamp(0.5rem,1.7vw,2rem)] pt-[0.3%]">
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
                    letterSpacing="-0.01em"
                    // ตัวหนังสือถูกย่อให้พอดีกล่องด้วย min(กว้าง, สูง) — ถ้า lineHeight สูงไป
                    // แกนสูงจะเป็นตัวบีบก่อน คำเลยไม่เต็มความกว้าง ลดลงจน "กว้าง" เป็นตัวบีบแทน
                    lineHeight={0.72}
                    warpStrength={0.08}
                    warpScale={1.7}
                    speed={0.55}
                    // เลนส์ตอนเมาส์เข้าใกล้: shader คิดระยะบิดเป็นสัดส่วนของกล่อง (คูณคงที่ 0.045)
                    // กล่องนี้สูงแค่ ~66px ค่า demo (0.38) จึงขยับได้ราว 1px เดียว = มองไม่เห็น
                    // ของ demo กล่องสูง 430px เลยพอ — ที่นี่ต้องดันเกิน 1 ให้ได้ระยะเท่ากันในพิกเซลจริง
                    pointerInfluence={1}
                    pointerStrength={5.5}
                    refraction={0.018}
                    ripple
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
            {/* Send me an email — ปุ่มเขียวชั้นสีซ้อนแบบ githubuniverse (comp 12542:172) + social */}
            <div className={`${CELL} -mt-px flex items-center justify-between gap-4 ${PAD}`}>
              <a
                href={`mailto:${SITE.email}`}
                className="v2-cta flex h-[clamp(3.25rem,5vw,4.5rem)] w-[54%] items-center gap-2 pl-[clamp(1.25rem,2.2vw,2rem)] text-[clamp(1.05rem,1.4vw,1.25rem)] font-semibold text-white"
              >
                Send me an email
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

      <main className="border-x border-[#d2d9d5]" style={{ marginInline: GUTTER_LINE }}>
        {/* แถวหัว section: Pixels & Logic | ป้าย joe.skills() (comp 12546:158862) */}
        {/* บล็อกนี้ "ไม่" สูงเท่าจอ — ที่ githubuniverse CTA ก่อน footer สูงแค่ 476px บนจอ 900
            (กระเบื้อง 424 + ระยะขอบ) ถ้าบังคับให้เต็มจอ ส่วนเกินจะไปพองอยู่ที่แถวหัวจนโล่ง
            ความสูงจึงมาจากเนื้อหา: หัวเรื่องสูงตาม min-h ของมัน + กระเบื้องที่ล็อก 2:1 */}
        {/* กรอบ scrollytelling: สูง 520vh บนจอใหญ่ ส่วนบล็อกข้างในถูกหมุดค้างกลางจอ
            ระยะที่เลื่อนในกรอบนี้ = ไทม์ไลน์ที่กล่องกางทีละใบ (ดู effect ของ scrollyRef)
            แถวหัว Pixels & Logic ต้องอยู่ในบล็อกที่หมุดด้วย ไม่งั้นมันเลื่อนหนีขึ้นไปจนเปิดช่องว่าง
            คั่นกับกระเบื้อง ห้ามมี transform ที่ตัวไหนในสายนี้ — sticky จะตายทันที (เคยเจอกับ #works) */}
        <div ref={scrollyRef} className="relative lg:h-[520vh]">
        <div className="flex flex-col lg:sticky lg:top-0 lg:h-screen lg:justify-center">
        <section
          id="pixels-logic"
          ref={headRef}
          className={`v2-reveal flex shrink-0 items-stretch max-lg:flex-col ${headSeen ? 'v2-in' : ''}`}
        >
          <div className={`${CELL} min-h-[clamp(7rem,13.75vw,12.5rem)] min-w-0 shrink-0 basis-[45.05%] ${PAD}`}>
            <p className="text-[clamp(1.35rem,1.95vw,2.25rem)] font-medium text-black">
              Pixels &amp; Logic
            </p>
          </div>
          <div className={`${CELL} -ml-px flex min-w-0 flex-1 items-start justify-end ${PAD} max-lg:ml-0 max-lg:-mt-px`}>
            {/* ป้ายนี้อยู่ตรงที่ภาพประกอบของกล่องล้นขึ้นมาพอดี — ยก z ให้ตัวอักษรอยู่หน้าภาพ
                ภาพจึงผ่านหลังคำว่า joe.skills() แทนที่จะบังจนอ่านไม่ออก */}
            <p className={`relative z-50 ${BODY_TEXT} font-medium text-black/50`}>joe.skills()</p>
          </div>
        </section>

        {/* แถวการ์ด: บล็อกกระเบื้อง | Coding (comp 12574:1076)
            คอมพ์กว้าง 1312 = กระเบื้อง 720 + การ์ดข้อความ 591 — การ์ดข้อความจึงเป็นใบที่ตรึง
            สัดส่วน 45.05% เท่าแถวหัว ส่วนกระเบื้องกินที่ที่เหลือ เส้นแบ่งของสองแถวจึงไม่ตรงกัน
            ตามคอมพ์ (แถวหัวแบ่ง 45.05% จากซ้าย แถวนี้แบ่งจากขวา) */}
        {/* สัดส่วนตาม CTA ก่อน footer ของ githubuniverse.com: กระเบื้อง 850 x 424 (2:1)
            คู่กับการ์ดข้อความ 540 → 61.2% / 38.8% และกระเบื้องย่อยเป็นสี่เหลี่ยมจัตุรัสจริง
            แถวนี้จึงสูงตามความกว้างของตัวเอง ไม่ใช่ยืดกินที่ที่เหลือของจอ (แถวหัวรับส่วนต่างไป) */}
        <section
          id="what-i-do"
          ref={skillsRef}
          className={`relative -mt-px flex w-full shrink-0 items-stretch max-lg:flex-col ${skillsSeen ? 'v2-in' : ''}`}
        >
          {/* กระเบื้อง 720x360 ของคอมพ์ = 360 | 180 | 180 → 50% | 25% | 25% ของบล็อก
              ไอคอนทุกใบเกาะมุมขวาล่างของกระเบื้องตัวเอง (ดินสอเลยขอบออกไปครึ่งตัวตามคอมพ์) */}
          <div className={`${CELL} flex min-w-0 flex-1 overflow-hidden lg:aspect-[2/1] max-lg:min-h-[18rem]`}>
            {/* กระเบื้องใหญ่: พื้นเบจ + mascot 3D ตัวจริง + วงเล็บเวกเตอร์ชิดขวา
                (ที่ githubuniverse กระเบื้องใบใหญ่ก็เป็นตัวละครของงานเขา ไม่ใช่พื้นสีเปล่า)
                mascot กินแค่ 78% ทางซ้าย วงเล็บจึงไม่ถูกบัง และ canvas ไม่ต้องเรนเดอร์เต็มช่อง */}
            <div
              className="v2-pop relative z-30 w-1/2 overflow-hidden bg-[#e2d7cb]"
              style={{ '--i': 0 } as CSSProperties}
            >
              {/* วงเล็บมาก่อน mascot ในลำดับ DOM: ไฟล์ SVG ใบนี้มีพื้นเบจเต็มสี่เหลี่ยมอยู่ในตัว
                  ถ้าวาดทีหลังมันจะทับ canvas ทั้งใบจนไม่เห็นตัวละคร (เห็นเป็นช่องเบจว่าง ๆ) */}
              <img
                src={skillsBracket}
                alt=""
                className="v2-bracket pointer-events-none absolute inset-y-0 right-0 h-full w-auto max-w-none"
              />
              <div className="absolute inset-y-0 left-0 w-[78%]">
                <Suspense fallback={null}>
                  <MascotCard followRef={skillsRef} />
                </Suspense>
              </div>
            </div>
          </div>
          {/* ชั้นซ้อน: ตัวละคร z-30 > ฟ้า/ม่วง z-20 > ส้ม z-10 — ส้มวิ่งไกลสุด (-200%) ถ้าไม่กด
              ให้อยู่ล่างสุด มันจะพาดข้ามใบอื่นตลอดทาง แทนที่จะมุดออกมาจากข้างหลัง
              ลำดับเข้าฉาก: กระเบื้องตัวละคร (ซ้าย) -> ฟ้า (บนกลาง) -> ม่วง (ล่างกลาง) -> ส้ม (ขวา)
              ทุกใบไถลเข้ามาจากทางซ้ายของตัวเอง คือมุดออกมาจากหลังกระเบื้องตัวละคร */}
          {/* กระเบื้องสามใบ absolute เทียบ section (ไม่ได้อยู่ในบล็อกกระเบื้องแล้ว) — ตอนกาง
              มันต้องกินที่ของการ์ดข้อความไปจนชนขอบขวา ซึ่งทำในโฟลว์ของบล็อกไม่ได้ */}
          <SkillTile i={0} order={1} from="-100%" active={skill} className="z-20">
            <span
              className="v2-layers pointer-events-none absolute bottom-0 right-0 w-[38%] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
              aria-hidden
              dangerouslySetInnerHTML={{ __html: skillsCursorRaw }}
            />
          </SkillTile>
          <SkillTile i={1} order={2} from="-100%" active={skill} className="z-20">
            <span
              className="v2-layers pointer-events-none absolute bottom-0 right-0 w-[57%] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
              aria-hidden
              dangerouslySetInnerHTML={{ __html: skillsPixelsRaw }}
            />
          </SkillTile>
          <SkillTile i={2} order={3} from="-200%" active={skill} className="z-10">
            <span
              className="v2-layers pointer-events-none absolute bottom-0 right-0 w-[43%] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
              aria-hidden
              dangerouslySetInnerHTML={{ __html: skillsPencilRaw }}
            />
          </SkillTile>
          {/* การ์ดข้อความ = state ตั้งต้นเท่านั้น พอเริ่มเล่ากล่องไหน กล่องนั้นกางมาทับที่ตรงนี้เอง
              จึงจางออกไปก่อน ไม่ให้ Lorem ค้างอยู่ครึ่งล่างตอนกล่องบน (ฟ้า/ม่วง) กางอยู่ */}
          <div
            className={`${CELL} relative -ml-px flex min-h-[18rem] min-w-0 shrink-0 basis-[38.8%] flex-col ${PAD} transition-opacity duration-700 max-lg:ml-0 max-lg:-mt-px lg:min-h-0 ${skill === null ? 'opacity-100' : 'opacity-0'}`}
          >
            <p
              className={`v2-stagger ${BODY_TEXT} font-medium text-[#666]`}
              style={{ '--i': 4 } as CSSProperties}
            >
              <Eyebrow text="What I Do" />
            </p>
            <p
              className="v2-stagger mt-1 text-[clamp(2.5rem,3.4vw,4rem)] font-semibold leading-none transition-colors duration-200"
              style={{ color: skillNow.color, '--i': 5 } as CSSProperties}
            >
              {skillNow.title}
            </p>
            <p
              className={`v2-stagger mt-auto ${BODY_TEXT} font-medium text-[#666]`}
              style={{ '--i': 6 } as CSSProperties}
            >
              {skillNow.desc}
            </p>
            {/* ลายน้ำมุมขวาระดับกลางการ์ด (คอมพ์วางชิดขวา ไม่ใช่กลางใบ) — เปลี่ยนตามสกิลที่โฟกัส
                key ผูกกับ title เพื่อให้ React เปลี่ยนโหนดจริง อนิเมชัน fade จึงเล่นซ้ำทุกครั้ง */}
            {!skillNow.mark ? null : skillNow.chip ? (
              <span
                key={skillNow.title}
                className="v2-skill-mark pointer-events-none absolute bottom-[22%] right-[4%] flex size-[clamp(5rem,7.5vw,8.5rem)] items-end justify-end"
                style={{ background: skillNow.color }}
              >
                <img src={skillNow.mark} alt="" className={skillNow.markClass} />
              </span>
            ) : (
              <img
                key={skillNow.title}
                src={skillNow.mark}
                alt=""
                className={`v2-skill-mark pointer-events-none absolute bottom-[22%] right-[4%] ${skillNow.markClass}`}
              />
            )}
          </div>
        </section>
        </div>
        </div>

        {/* เส้นทางงาน — ไทม์ไลน์ + แท็บ + การ์ดสรุป นับเป็นจอเดียว (comp 12567:642 สูง 775
            โดยการ์ดกิน 374) ระยะห่างในนี้ล็อกตามคอมพ์ ไม่ใช่ยืดหาร — ส่วนที่เหลือไปอยู่ที่การ์ด */}
        <div className={`${GAP_Y} flex flex-col ${SCREEN_MIN}`}>
        <section
          id="experiences"
          ref={expRef}
          className={`v2-reveal ${CELL} flex shrink-0 flex-col ${PAD} ${expSeen ? 'v2-in' : ''}`}
        >
          <div className={`flex flex-wrap items-center gap-2 ${BODY_TEXT} font-medium text-black/50`}>
            <span>experiences</span>
            <span>/</span>
            <span>internship</span>
            <span>/</span>
            <span>full-time</span>
            <span>/</span>
            <span className="inline-flex items-center gap-2">
              +2yrs exp
              <span className="inline-block size-[0.85em] bg-[#008a15]" />
            </span>
          </div>

          <p className="mt-[clamp(2rem,5.56vw,5rem)] text-[clamp(1.35rem,1.95vw,2.25rem)] font-medium text-black">
            my-design-journey/
          </p>

          {/*
            เส้นเวลา: หมุดสี่จุดวางบนเส้นเดียว ระยะเท่ากันด้วย grid ไม่ใช่พิกัดตายตัว
            ช่วงสุดท้าย (หลังหมุดที่สี่) เป็นสีเทา — ยังไม่ถึง จึงไม่ทาเขียว
          */}
          <div className="mt-[clamp(1.5rem,3.96vw,3.6rem)]">
            {/* เส้นวิ่งเต็มความกว้างการ์ด ไม่อยู่ในกรอบ padding (คอมพ์เริ่มที่ x=65 = ขอบเซลล์)
                หัวเส้นมีตอเขียว 32px ก่อนหมุดแรก ท้ายเส้นเป็นเทายาว 446 = 1.69 เท่าของช่วง 264 */}
            <div className="relative -mx-[calc(clamp(1rem,1.67vw,2rem)+1px)] flex items-center">
              <span className="h-0.5 w-[clamp(1rem,2.22vw,2rem)] bg-[#008a15]" />
              {JOURNEY.map((j) => (
                <Fragment key={j.at}>
                  {/* ป้ายห้อยใต้หมุดแบบ absolute — ขอบซ้ายป้ายตรงกับขอบซ้ายหมุดเสมอ
                      ไม่ว่าเส้นจะยืดเท่าไร (กริดแยกจะเลื่อนไม่ตรงเพราะหัวเส้นมีตอ 32px) */}
                  <span className="relative size-3 shrink-0 rounded-full bg-[#008a15]">
                    <span className="absolute left-0 top-[calc(100%_+_clamp(0.5rem,0.83vw,0.75rem))] flex w-[clamp(10rem,15.35vw,14rem)] flex-col gap-4">
                      <span className={`${BODY_TEXT} font-medium text-black`}>{j.role}</span>
                      <span className="whitespace-nowrap text-[clamp(0.8125rem,0.95vw,1.125rem)] font-medium text-black/50">
                        {j.org}
                      </span>
                    </span>
                  </span>
                  <span className="h-0.5 flex-1 bg-[#008a15]" />
                </Fragment>
              ))}
              {/* หมุดสุดท้าย = อนาคต ยังไม่ถึง จึงเป็นวงกลมกลวง */}
              <span className="size-3 shrink-0 rounded-full border-2 border-[#008a15] bg-[#e8edec]" />
              <span className="h-0.5 flex-[1.69] bg-[#d2d9d5]" />
              {/* ปลายทางฝั่งขวา = ช่วงต่อไปที่ยังไม่เกิด — mascot ชะโงกออกมาจากหลังขอบการ์ด
                  พร้อมป้าย open-to-work/ ตัวจริงเป็น 3D ตัวเดียวกับฉากหลัก ไม่ใช่รูปนิ่ง
                  ลอยอยู่เหนือเส้น วางแบบ absolute แถวเส้นเวลาจึงยังสูงเท่าหมุด (12px) */}
              <span className="v2-peek" ref={peekRef}>
                <span className="v2-peek-stage">
                  {peekMounted ? (
                    <Suspense fallback={null}>
                      <MascotPeek active={peekIn} />
                    </Suspense>
                  ) : null}
                </span>
                <span className="v2-peek-badge">
                  open-to-work/
                  <span className="v2-peek-dot" />
                </span>
              </span>
            </div>
            {/* เผื่อที่ให้ป้ายที่ห้อยอยู่ (absolute จึงไม่ดันความสูงเอง) */}
            <div className="h-[clamp(3.75rem,5.4vw,4.5rem)]" />
          </div>

          {/* แท็บที่ทำงาน — ใบแรกเป็นใบที่เลือกอยู่: พื้นขาว ขีดเขียวบนหัว
              ก้นแท็บต้องชนการ์ดข้างล่างพอดี (เป็นแท็บของการ์ดนั้น ไม่ใช่ปุ่มลอย) —
              ลบ padding ล่าง+ซ้ายของ section ทิ้งด้วย margin ติดลบเท่า PAD
              (ขอบซ้ายแท็บใบแรกต้องตรงกับขอบซ้ายการ์ดข้างล่าง) */}
          <div className="mt-[clamp(1.25rem,2.15vw,1.95rem)] -mb-[clamp(1rem,1.67vw,2rem)] -ml-[calc(clamp(1rem,1.67vw,2rem)+1px)] flex flex-wrap">
            {JOURNEY.map((j, i) => (
              <button
                key={j.at}
                type="button"
                aria-pressed={i === stop}
                onClick={() => setStop(i)}
                className={`-ml-px flex h-[clamp(3.5rem,5vw,4.5rem)] w-[clamp(9rem,13.9vw,12.5rem)] cursor-pointer items-center justify-between px-[clamp(1rem,1.7vw,1.5rem)] transition-colors first:ml-0 ${
                  i === stop
                    ? 'border-t-2 border-[#008a15] bg-white'
                    : `${BORDER} bg-[#f3f5f3] hover:bg-white`
                }`}
              >
                <span className={`${BODY_TEXT} font-semibold text-[#292a2e]`}>{j.at}</span>
                <span
                  className={`size-3 rounded-full ${i === stop ? 'bg-[#008a15]' : 'border border-[#d2d9d5] bg-[#e8edec]'}`}
                />
              </button>
            ))}
          </div>
        </section>

        {/* การ์ดสรุปของช่วงที่เลือกจากแท็บ: คำพูด + โมเสก | ภาพจริงจากที่ทำงาน (comp 12568:813)
            ช่วงที่ยังไม่มีคำพูด/โลโก้/รูปจริง เว้นว่างไว้ตรง ๆ ไม่ใส่ของสมมติมาแทน */}
        <section
          ref={expCardRef}
          className={`v2-reveal -mt-px flex flex-1 items-stretch max-lg:flex-col ${expCardSeen ? 'v2-in' : ''}`}
        >
          <div className={`${CELL} flex flex-[0.49] flex-col bg-white`}>
            <div className={`${BORDER} flex min-h-[clamp(4rem,5.5vw,5rem)] items-center justify-between gap-4 border-x-0 border-t-0 ${PAD}`}>
              <p className={`${BODY_TEXT} font-medium text-black/50`}>{current.credential ?? current.role}</p>
              <span className="flex shrink-0 items-center gap-4">
                {current.logos?.map((l) => (
                  <img key={l.src} src={l.src} alt={l.alt} className="h-8 w-auto" />
                ))}
              </span>
            </div>
            {/* คอมพ์ 12567:691 ให้ padding แค่บนกับซ้าย — โมเสกจึงชนมุมขวาล่างของการ์ดพอดี
                ส่วนตัวคำพูดกันขวาด้วย padding ของตัวเองเท่า PAD */}
            <div className="relative flex flex-1 flex-col justify-between overflow-hidden pl-[clamp(1rem,1.67vw,2rem)] pt-[clamp(1rem,1.67vw,2rem)]">
              <div className="pr-[clamp(1rem,1.67vw,2rem)]">
                {current.quote ? (
                  <>
                    <img src={quoteMark} alt="" className="h-[clamp(1.2rem,1.86vw,1.7rem)] w-auto" />
                    <p className="mt-2 text-[clamp(1.35rem,1.95vw,1.75rem)] font-medium leading-[normal] text-black">
                      {current.quote}
                    </p>
                  </>
                ) : (
                  <p className={`${BODY_TEXT} font-medium text-black/50`}>{current.org}</p>
                )}
              </div>
              {/* โมเสกชิดมุมขวาล่าง — สี่เหลี่ยมด้านเท่า ไล่เป็นขั้นบันได */}
              <div className="mt-8 flex flex-col items-end self-end">
                {MOSAIC_ROWS.map((row, r) => (
                  <div className="flex" key={r}>
                    {row.map((c, i) => (
                      <span
                        key={`${r}-${i}`}
                        className="block size-[clamp(1.1rem,2.15vw,2rem)]"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className={`${CELL} -ml-px flex-[0.51] overflow-hidden max-lg:ml-0 max-lg:-mt-px max-lg:min-h-[16rem]`}>
            {current.photo ? (
              <img
                src={current.photo.src}
                alt={current.photo.alt}
                className="size-full min-h-[16rem] object-cover"
              />
            ) : null}
          </div>
        </section>

        </div>

        {/* งานเด่น (comp 12563:307-363)
            แผงส้มซ้าย = สาระบัญ ปักหมุดอยู่กับที่ตลอดช่วง section
            ฝั่งขวาเท่านั้นที่ซ้อน: เลื่อนลงแล้วใบถัดไปขึ้นมาทับใบก่อนหน้าที่ปักไว้ จนหมดรายการ */}
        <section
          id="works"
          ref={worksRef}
          className={`v2-reveal-fade ${GAP_Y} flex items-start max-lg:flex-col ${worksSeen ? 'v2-in' : ''}`}
        >
          <div
            className={`${BORDER} flex flex-[0.32] flex-col justify-between self-stretch bg-[#fd5000] ${PAD} lg:sticky lg:h-[calc(100svh-74px)] max-lg:w-full`}
            style={{ top: HEADER_H }}
          >
            <p className="whitespace-nowrap text-[clamp(1.4rem,2.9vw,3rem)] font-medium text-white">
              highlights-work/
            </p>

            {/* สาระบัญ + ตัวชี้ว่ากำลังดูใบไหน (activeWork มาจาก IntersectionObserver ข้างล่าง) */}
            <ol className="my-[clamp(1.5rem,3vw,2.5rem)] flex flex-col">
              {WORKS.map((item, j) => (
                <li
                  key={item.title}
                  aria-current={j === activeWork ? 'true' : undefined}
                  className={`relative border-t border-white/25 last:border-b ${
                    j === activeWork ? 'text-white' : 'text-white/55'
                  }`}
                >
                  <span className="relative flex items-center gap-3 py-[clamp(0.6rem,1.1vw,0.9rem)] transition-colors duration-300">
                    <span
                      className={`size-2.5 shrink-0 transition-colors duration-300 ${j === activeWork ? 'bg-white' : 'border border-white/55'}`}
                    />
                    <span className="v2-eyebrow text-[clamp(0.7rem,0.8vw,0.85rem)]">
                      {String(j + 1).padStart(2, '0')}
                    </span>
                    <span className={`${BODY_TEXT} ${j === activeWork ? 'font-semibold' : 'font-medium'}`}>
                      {item.title}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="flex h-[clamp(2.75rem,3.6vw,3.25rem)] w-fit cursor-pointer items-center gap-2 rounded-lg bg-white px-[clamp(1rem,1.5vw,1.5rem)] text-[clamp(0.85rem,1vw,1.05rem)] font-semibold text-[#fd5000] transition-transform duration-200 hover:-translate-y-0.5"
            >
              Explore more work
              <img
                src={arrowOutward}
                alt=""
                className="size-5 [filter:invert(38%)_sepia(85%)_saturate(4000%)_hue-rotate(6deg)]"
              />
            </a>
          </div>

          <div className="-ml-px flex flex-1 flex-col self-stretch max-lg:ml-0 max-lg:w-full">
            {WORKS.map((w, i) => (
              <div
                key={w.title}
                ref={(el) => {
                  workRefs.current[i] = el
                }}
                data-work={i}
                className={`${BORDER} flex gap-[clamp(1rem,2vw,2.5rem)] overflow-hidden bg-white p-[clamp(1.25rem,2.8vw,2.5rem)] lg:sticky lg:h-[calc(100svh-74px)] max-lg:-mt-px max-lg:flex-col`}
                style={{ top: HEADER_H, zIndex: i + 1 }}
              >
                <div className="flex w-[clamp(16rem,23.3vw,21rem)] shrink-0 flex-col lg:my-auto max-lg:w-full">
                  <p className={`${BODY_TEXT} font-medium text-[#666]`}>{w.eyebrow}</p>
                  <p className="mt-3 text-[clamp(1.6rem,2.5vw,2.25rem)] font-medium text-black">
                    {w.title}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4">
                    {w.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-lg bg-[#d2d9d4] px-3 py-2 text-[clamp(0.8125rem,0.95vw,1rem)] font-medium text-black"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {w.blurb ? (
                    <p className="mt-[clamp(1.5rem,2.6vw,2.3rem)] text-[clamp(0.8125rem,0.95vw,1rem)] font-medium text-[#666]">
                      {w.blurb.before}
                      <span className="font-semibold text-[#1b7f37]">{w.blurb.org}</span>
                      {w.blurb.after}
                    </p>
                  ) : null}
                  {/* ตัวเลขผลงาน — สองแถวชนกัน ขอบร่วมกันเส้นเดียว (mb -1px) */}
                  <div className="mt-[clamp(1rem,1.7vw,1.5rem)] flex flex-col">
                    {(w.stats ?? []).map((st) => (
                      <div
                        key={st.value}
                        className={`${BORDER} -mb-px flex items-center gap-6 bg-white p-4 last:mb-0`}
                      >
                        <span className="flex w-[6rem] shrink-0 items-center gap-2">
                          <img src={st.icon} alt="" className="size-7" />
                          <span className="text-[clamp(1.15rem,1.65vw,1.5rem)] font-semibold text-[#1b7f37]">
                            {st.value}
                          </span>
                        </span>
                        <p className="flex-1 text-[clamp(0.7rem,0.85vw,0.85rem)] font-medium text-[#666]">
                          {st.note}
                        </p>
                      </div>
                    ))}
                  </div>
                  {w.href ? (
                    <a
                      href={w.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-[clamp(1.25rem,2.2vw,2rem)] flex h-14 w-full max-w-[18rem] cursor-pointer items-center gap-2 rounded-lg bg-[#008a15] pl-8 text-[clamp(0.9rem,1.05vw,1.25rem)] font-semibold text-white transition-colors duration-[400ms] hover:bg-[#0d6731]"
                    >
                      Read story
                      <img src={arrowOutward} alt="" className="size-6" />
                    </a>
                  ) : null}
                  {w.demo ? (
                    <a
                      href={w.demo}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 flex h-14 w-full max-w-[18rem] cursor-pointer items-center gap-2 border border-[#008a15] pl-8 text-[clamp(0.9rem,1.05vw,1.25rem)] font-semibold text-[#008a15] transition-colors duration-[400ms] hover:bg-[#008a15]/10"
                    >
                      {/* ไม่มีไอคอนลูกศรที่ปุ่มนี้ — ไฟล์ arrowOutward เป็นเวกเตอร์สีขาว วางบนพื้นขาวแล้วหาย */}
                      Open dashboard
                    </a>
                  ) : null}
                </div>
                {/* กองการ์ดโชว์งาน (CardSwap ของ reactbits) — ยังไม่มีภาพหน้าจอจริง */}
                <div className="relative min-h-[18rem] flex-1 self-center lg:aspect-[1.35] lg:min-h-0 max-lg:min-h-[14rem]">
                  <CardSwap
                    width="86%"
                    height="78%"
                    cardDistance={34}
                    verticalDistance={38}
                    skewAmount={5}
                    delay={4200}
                    pauseOnHover
                    easing="power"
                  >
                    {/* ใบแรกเป็นของจริงถ้ามีลิงก์: iframe ของแดชบอร์ดที่ deploy อยู่
                        ปิดการคลิกในกรอบ (pointer-events-none) — การ์ดกองนี้หมุนอยู่ กดในนั้นไม่ได้เรื่อง
                        คนที่อยากลองของจริงกดปุ่ม "Open dashboard" ข้าง ๆ แทน */}
                    {w.demo ? (
                      <Card key="demo" style={{ background: '#ffffff' }}>
                        <iframe
                          src={w.demo}
                          title={`${w.title} live dashboard`}
                          loading="lazy"
                          className="pointer-events-none size-full border-0"
                        />
                      </Card>
                    ) : null}
                    {w.shots.slice(w.demo ? 1 : 0).map((bg) => (
                      <Card key={bg} style={{ background: bg }} />
                    ))}
                  </CardSwap>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* สแตกที่ใช้จริง — บ่อลูกบอลฟิสิกส์ ชื่อเทคโนโลยีอยู่บนผิวลูก ลากเมาส์เขี่ยได้
            (ref: moncy.dev) mount ตอนเลื่อนมาถึงเท่านั้น แล้วหยุดฟิสิกส์เมื่อออกนอกจอ */}
        <section
          id="stack"
          ref={stackRef}
          className={`v2-reveal ${CELL} ${GAP_Y} relative overflow-hidden ${SCREEN_MIN} ${stackSeen ? 'v2-in' : ''}`}
        >
          <p className={`absolute inset-x-0 top-[clamp(2rem,5vw,4.5rem)] z-10 text-center text-[clamp(2rem,5.5vw,5rem)] font-medium uppercase text-black/80`}>
            my-stack/
          </p>
          {/* กรอบของ canvas ต้องมีความสูงจริง — r3f ใส่ inline style ทับ (position:relative,
              height:100%) ถ้าให้ Canvas เป็นตัว absolute เอง เปอร์เซ็นต์จะอ้างกับความสูง auto
              ของ section แล้วยุบเหลือ ~150px (เคยเจอมาแล้วรอบหนึ่ง) */}
          <div className="absolute inset-0">
            {stackMounted ? (
              <Suspense fallback={null}>
                <StackKeys />
              </Suspense>
            ) : null}
          </div>
        </section>

        {/* กันคอนเทนต์จบชนขอบ — ช่องว่างโปร่ง ๆ ก่อนแถบโมเสกท้ายหน้า ตาม comp */}
        <div className="h-[12vh]" />
      </main>

      {/* แถบโมเสกพิกเซลปิดท้ายหน้า — เต็มความกว้างจอ (comp 12546:158878) */}
      <img src={mosaicBand} alt="" aria-hidden className="block w-full" />

      {/*
        footer ภาษาเดียวกับ githubuniverse: โลโก้ตัวเบ้อเริ่มกินความกว้างทั้งแถบ แล้วใต้ลงมา
        เป็นแถวข้อมูลตัวเล็กคั่นด้วยเส้นกริดชุดเดียวกับทั้งหน้า ปิดท้ายด้วยบรรทัด mono
        แบบพิมพ์คำสั่ง (ของเขาเป็น `echo "bug-bash-game/" >> .gitignore`)
        ที่นี่ใช้คำที่หน้าอื่นใช้อยู่แล้ว (joe.skills() / my-design-journey/) จะได้เป็นเสียงเดียวกัน
      */}
      <footer
        ref={footRef}
        className={`v2-reveal border-x border-t border-[#d2d9d5] bg-[#e8edec] text-[#292a2e] ${footSeen ? 'v2-in' : ''}`}
        style={{ marginInline: GUTTER_LINE }}
      >
        {/* แถวพาดหัวยักษ์ — ที่ของ githubuniverse เป็นเวิร์ดมาร์ก ที่นี่เป็นประโยคปิดท้าย
            ขนาดผูก vw ให้กินความกว้างแถบพอดีทุกจอ ไม่ตัดคำ (คำถามหนึ่งประโยคต้องอยู่บรรทัดเดียว) */}
        <div className={`${BORDER} flex items-end justify-between gap-6 overflow-hidden ${PAD}`}>
          <p className="whitespace-nowrap text-[clamp(1.5rem,7.4vw,7rem)] font-semibold leading-none tracking-[-0.02em] text-[#292a2e]">
            WHAT&rsquo;S YOUR VISION
          </p>
          <p className="v2-eyebrow shrink-0 text-[clamp(0.75rem,0.95vw,1rem)] text-black/50">
            joe.contact()
          </p>
        </div>

        {/* แถวลิงก์: อีเมลจริง + เรซูเม่ + โซเชียล ไม่มีลิงก์หลอก */}
        <div className="-mt-px flex items-stretch max-lg:flex-col">
          <a
            href={`mailto:${SITE.email}`}
            className={`${CELL} flex flex-1 items-center gap-3 ${PAD} ${BODY_TEXT} font-medium transition-colors duration-200 hover:bg-[#f2f5f3]`}
          >
            {SITE.email}
            <img src={arrowOutward} alt="" className="size-5" />
          </a>
          <a
            href={SITE.resumeUrl}
            target="_blank"
            rel="noreferrer"
            className={`${CELL} -ml-px flex items-center gap-3 ${PAD} ${BODY_TEXT} font-medium transition-colors duration-200 hover:bg-[#f2f5f3] max-lg:ml-0 max-lg:-mt-px`}
          >
            Resume
            <img src={arrowOutward} alt="" className="size-5" />
          </a>
          <div className={`${CELL} -ml-px flex items-center gap-[clamp(1rem,1.5vw,2rem)] ${PAD} max-lg:ml-0 max-lg:-mt-px`}>
            {SOCIALS.map((so) => (
              <a
                key={so.name}
                href={so.href}
                target="_blank"
                rel="noreferrer"
                aria-label={so.name}
                className="transition-opacity duration-200 hover:opacity-60"
              >
                <img
                  src={so.icon}
                  alt=""
                  className={`size-7 ${so.filter === 'invert' ? 'invert' : '[filter:brightness(0)]'}`}
                />
              </a>
            ))}
          </div>
        </div>

        {/* แถวล่างสุด: ลิขสิทธิ์ + ที่อยู่ + บรรทัด mono ปิดท้าย */}
        <div className="-mt-px flex items-stretch max-lg:flex-col">
          <p className={`${CELL} flex flex-1 items-center ${PAD} text-[clamp(0.75rem,0.95vw,1rem)] font-medium text-black/50`}>
            © {SITE.copyrightYear} {SITE.name}
          </p>
          <p className={`${CELL} -ml-px flex items-center gap-2 ${PAD} text-[clamp(0.75rem,0.95vw,1rem)] font-medium text-black/50 max-lg:ml-0 max-lg:-mt-px`}>
            Bangkok, TH
            <span className="inline-block size-[0.7em] bg-[#008a15]" />
          </p>
          <p className={`${CELL} v2-eyebrow -ml-px flex items-center whitespace-nowrap ${PAD} text-[clamp(0.75rem,0.95vw,1rem)] text-black/50 max-lg:ml-0 max-lg:-mt-px`}>
            echo "my-design-journey/" &gt;&gt; README.md
            <span className="v2-caret" aria-hidden />
          </p>
        </div>
      </footer>
    </div>
  )
}
