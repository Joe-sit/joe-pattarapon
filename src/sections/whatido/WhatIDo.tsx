import { lazy, Suspense, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { Eyebrow } from '@/components/Eyebrow'
import { useRevealed } from '@/hooks/useRevealed'
import { BODY_TEXT, CELL, PAD } from '@/pages/portfolio2026.tokens'
import promptMark from '@/assets/v2/prompt-mark.svg'
import skillsBracket from '@/assets/v2/skills-bracket.svg'
import skillsCursor from '@/assets/v2/skills-cursor.svg'
import skillsPencil from '@/assets/v2/skills-pencil.svg'
// ตัวเดียวกันแต่เอา "เนื้อไฟล์" มาฝังเป็น inline — ต้องเข้าถึง path ข้างในเพื่อไล่โผล่ทีละชิ้น
// (<img src> เข้าไปแตะลูกใน SVG ไม่ได้เลย)
import skillsCursorRaw from '@/assets/v2/skills-cursor.svg?raw'
import skillsPixelsRaw from '@/assets/v2/skills-pixels.svg?raw'
import skillsPencilRaw from '@/assets/v2/skills-pencil.svg?raw'

/**
 * section "What I Do" ของหน้า /2026 — ย้ายออกมาจากไฟล์หน้า เพื่อให้ /2026-final ใช้ตัวเดียวกัน
 *
 * ทั้งก้อนคือของเดิมทุกบรรทัด ไม่ได้เขียนใหม่: กระเบื้องตัวละคร + กระเบื้องสกิลสามใบที่กาง
 * ทีละใบตามระยะ scroll + การ์ดข้อความที่เป็น state ตั้งต้น สิ่งที่เปลี่ยนคือ "ใครถือ state"
 * — เดิมอยู่ในตัวหน้า ตอนนี้อยู่ในฮุก useSkillStory ที่หน้าไหนก็เรียกได้
 */

// การ์ด mascot — chunk หนัก แยกโหลด
const MascotCard = lazy(() =>
  import('@/joespresso/MascotCard').then((m) => ({ default: m.MascotCard })),
)


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
  /**
   * เลขรอบของภาพประกอบ — ขยับทุกครั้งที่กระเบื้องใบนี้ "เริ่มถูกเล่า"
   *
   * เอาไปเป็น key ของกรอบภาพ React จึงสร้างโหนดใหม่เฉพาะใบนี้ อนิเมชัน v2-layer-in
   * ของแต่ละเลเยอร์เลยตั้งต้นใหม่ = ไอคอนไล่เข้าฉากอีกรอบพร้อมกล่องที่กำลังกาง
   * (ต่างจากของเดิมที่ React ยัด innerHTML ใหม่ให้ "ทุกใบ" ทุกครั้งที่สเตจเปลี่ยน
   * ใบที่ไม่เกี่ยวก็กะพริบตาม — ดู SKILL_ART ที่ย้ายไปสร้างครั้งเดียวที่ระดับโมดูล)
   */
  /**
   * ใบส้ม (Design) สูงเต็มคอลัมน์ ไอคอนจึงเกาะมุมขวาล่าง = อยู่ในครึ่งล่างพอดี
   * ซึ่งเป็นแถบเดียวกับที่ใบม่วง (Coding) กางออกมาทับตอนถึงคิวมัน — ไอคอนเลยหายไปทั้งตัว
   * พอถึงคิวม่วง ยกไอคอนส้มขึ้นไปครึ่งบนที่ยังว่างอยู่ ให้ยังเห็นเหมือนตอนใบฟ้าเล่า
   */
  const dodge = i === 2 && active === 1

  const [run, setRun] = useState(0)
  useEffect(() => {
    if (on) setRun((r) => r + 1)
  }, [on])
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
          className={`pointer-events-none absolute bottom-0 right-0 flex h-full origin-bottom-right items-end justify-end transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${box.art} ${on ? `${box.lift} scale-[2.4]` : dodge ? '-translate-y-[52%] scale-100' : 'scale-100'}`}
        >
          {/* key อยู่ชั้นในสุด ไม่ใช่ที่กรอบที่มี transform — ถ้า key กรอบนั้น โหนดใหม่จะ mount
              มาพร้อมสภาพขยายแล้ว ไม่มีอะไรให้ transition ภาพจะเด้งโป๊ะแทนที่จะค่อย ๆ โต
              display:contents ทำให้ชั้นนี้ไม่มีผลกับ layout เลย เป็นแค่ที่แขวน key */}
          <span key={run} className="contents">
            {children}
          </span>
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
/**
 * ภาพประกอบของกระเบื้องแต่ละใบ — สร้าง "ครั้งเดียว" ที่ระดับโมดูล ไม่ใช่ใน render
 *
 * มันเป็น SVG นิ่ง ๆ ที่ไม่เคยเปลี่ยน แต่ถ้าประกาศไว้ใน JSX ของหน้า ทุกครั้งที่ scroll
 * เปลี่ยนกล่องที่กำลังเล่า React จะยัด innerHTML ใหม่ทั้งก้อน (วัดด้วย MutationObserver:
 * svg ถูก removed/added ทุกครั้ง) โหนดใหม่ = อนิเมชัน v2-layer-in ตั้งต้นใหม่ ไอคอนจึง
 * กะพริบเข้าฉากซ้ำทุกรอบที่เลื่อนขึ้น-ลง
 *
 * เอลิเมนต์ที่อ้างอิงตัวเดิม React จะข้ามการ reconcile ทั้งซับทรีไปเลย ไอคอนจึงนิ่ง
 */
const ART_BASE = 'v2-layers pointer-events-none absolute bottom-0 right-0 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full'

const SKILL_ART = [
  <span key="research" className={`${ART_BASE} w-[38%]`} aria-hidden dangerouslySetInnerHTML={{ __html: skillsCursorRaw }} />,
  <span key="coding" className={`${ART_BASE} w-[57%]`} aria-hidden dangerouslySetInnerHTML={{ __html: skillsPixelsRaw }} />,
  <span key="design" className={`${ART_BASE} w-[43%]`} aria-hidden dangerouslySetInnerHTML={{ __html: skillsPencilRaw }} />,
]

const STORY_ORDER = [0, 2, 1]

const SKILL_DEFAULT: Skill = {
  title: 'Lorem ipsum',
  desc: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.',
  color: 'var(--v2-ink)',
}

/**
 * ไทม์ไลน์ของการเล่า — คืนหมายเลขกระเบื้องที่กำลังถูกเล่า (null = state ตั้งต้น)
 *
 * `scrollyRef` คือกรอบสูง ๆ ที่ปักหมุด section ไว้ `sectionRef` คือตัว section เอง
 * (ฮุกเขียน --skill-p ลงไปให้เอง ใช้วาดแถบความคืบหน้าที่ก้นกล่อง)
 */
export function useSkillStory(
  scrollyRef: RefObject<HTMLDivElement | null>,
  skillsRef: RefObject<HTMLElement | null>,
) {
  const [skill, setSkill] = useState<number | null>(null)

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
    /** เวลาที่กล่องหนึ่งใบต้องได้อยู่บนจอเป็นอย่างน้อย ก่อนจะยอมเดินไปใบถัดไป */
    const MIN_DWELL = 620
    // -1 = state ตั้งต้น (ยังไม่เล่ากล่องไหน) ใช้เลขล้วนทั้งเส้นเพื่อให้เดินทีละขั้นได้
    let target = -2
    let shown = -2
    let frac = 0
    // จุดตั้งต้นของแถบ: ค่า frac ตอนกล่องกางเสร็จ (-1 = ยังกางไม่จบ แถบยังไม่เริ่มนับ)
    let settleFrac = -1
    let timer = 0
    let step = 0
    const paint = () => {
      // ยังไล่ตามเป้าอยู่ = frac ที่อ่านได้เป็นของกล่องอื่น ไม่ใช่ใบที่โชว์ แถบจึงต้องนิ่งที่ 0
      const fill =
        settleFrac < 0 || shown !== target
          ? 0
          : Math.min(Math.max((frac - settleFrac) / Math.max(1 - settleFrac, 0.001), 0), 1)
      skillsRef.current?.style.setProperty('--skill-p', fill.toFixed(3))
    }
    const show = (idx: number) => {
      shown = idx
      settleFrac = -1
      clearTimeout(timer)
      if (idx >= 0) {
        timer = window.setTimeout(() => {
          settleFrac = frac
          paint()
        }, EXPAND_MS)
      }
      paint()
      const next = idx < 0 ? null : STORY_ORDER[idx]
      setSkill((cur) => (cur === next ? cur : next))
    }
    /**
     * เดินเข้าหาเป้าทีละขั้น ไม่กระโดด
     *
     * รูดเร็ว ๆ ทีเดียวข้ามได้หลายช่วงในเฟรมเดียว ถ้าเอา state ตามตำแหน่ง scroll ตรง ๆ
     * กล่องกลาง ๆ จะไม่ได้ขึ้นเลย เห็นแค่ใบสุดท้าย — คิวนี้บังคับให้ทุกใบได้ขึ้นจออย่างน้อย
     * MIN_DWELL แล้วค่อยไปใบถัดไป ตำแหน่ง scroll ไม่ถูกแตะ (ไม่แย่งการเลื่อนจากคนดู)
     * ยกเว้นตอนที่ section หลุดจอไปแล้ว — ไล่ให้ทันทีไม่มีประโยชน์ กระโดดถึงเป้าเลย
     */
    const pump = () => {
      step = 0
      if (shown === target) return
      show(shown + Math.sign(target - shown))
      if (shown !== target) step = window.setTimeout(pump, MIN_DWELL)
    }
    const read = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const span = r.height - window.innerHeight
      if (span <= 0) return
      const p = Math.min(Math.max(-r.top / span, 0), 1)
      const raw = (p - 0.2) / 0.24
      const idx = p < 0.2 ? -1 : Math.min(2, Math.floor(raw))
      frac = idx < 0 ? 0 : Math.min(Math.max(raw > 3 ? 1 : raw - Math.floor(raw), 0), 1)
      target = idx
      const offscreen = r.bottom <= 0 || r.top >= window.innerHeight
      if (offscreen) {
        clearTimeout(step)
        step = 0
        if (shown !== target) show(target)
      } else if (shown !== target && !step) {
        pump()
      }
      paint()
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
      clearTimeout(step)
    }
  }, [])

  return skill
}

/**
 * @param active กระเบื้องที่กำลังถูกเล่า — ค่าที่ได้จาก useSkillStory
 *
 * อนิเมชันเข้าฉากครั้งแรกคิดเองในนี้ ไม่รับมาเป็น prop — หน้าที่เรียกใช้เผลอส่งค่าจริงตายตัว
 * มาได้ (เคยส่ง seen={true}) ซึ่งแปลว่าคลาส v2-in ติดมาตั้งแต่เฟรมแรก keyframe จึงจบไปแล้ว
 * ก่อนใครจะเห็น = เหมือนไม่มีอนิเมชันเลย
 */
export function WhatIDo({
  skillsRef,
  active: skill,
}: {
  skillsRef: RefObject<HTMLElement | null>
  active: number | null
}) {
  const skillsSeen = useRevealed(skillsRef)
  return (
    <>
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
            {/* data-mascot-tile: จอ Experiences วัดกรอบใบนี้เพื่อซูมต่อจากมันพอดี (ดู sections/tunnel) */}
            <div
              data-mascot-tile
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
            {SKILL_ART[0]}
          </SkillTile>
          <SkillTile i={1} order={2} from="-100%" active={skill} className="z-20">
            {SKILL_ART[1]}
          </SkillTile>
          <SkillTile i={2} order={3} from="-200%" active={skill} className="z-10">
            {SKILL_ART[2]}
          </SkillTile>
          {/* การ์ดข้อความ = state ตั้งต้นเท่านั้น พอเริ่มเล่ากล่องไหน กล่องนั้นกางมาทับที่ตรงนี้เอง
              จึงจางออกไปก่อน ไม่ให้ Lorem ค้างอยู่ครึ่งล่างตอนกล่องบน (ฟ้า/ม่วง) กางอยู่

              เนื้อในเป็นของ state ตั้งต้นล้วน ไม่สลับตามกล่องที่กำลังเล่าแล้ว: ตอนสลับ การ์ด
              ยังจางอยู่ 700ms คนดูจึงเห็นชิปไอคอนสี่เหลี่ยม (108x108) กับหัวเรื่องของสกิลนั้น
              โผล่มาแวบหนึ่งใต้กล่องที่กำลังกาง — คำอธิบายอยู่ในกล่องเองอยู่แล้ว ไม่ต้องซ้ำ */}
          <div
            className={`${CELL} relative -ml-px flex min-h-[18rem] min-w-0 shrink-0 basis-[38.8%] flex-col ${PAD} transition-opacity duration-700 max-lg:ml-0 max-lg:-mt-px lg:min-h-0 ${skill === null ? 'opacity-100' : 'opacity-0'}`}
          >
            <p
              className={`v2-stagger ${BODY_TEXT} font-medium text-[var(--v2-muted)]`}
              style={{ '--i': 4 } as CSSProperties}
            >
              <Eyebrow text="What I Do" />
            </p>
            <p
              className="v2-stagger mt-1 text-[clamp(2.5rem,3.4vw,4rem)] font-semibold leading-none"
              style={{ color: SKILL_DEFAULT.color, '--i': 5 } as CSSProperties}
            >
              {SKILL_DEFAULT.title}
            </p>
            <p
              className={`v2-stagger mt-auto ${BODY_TEXT} font-medium text-[var(--v2-muted)]`}
              style={{ '--i': 6 } as CSSProperties}
            >
              {SKILL_DEFAULT.desc}
            </p>
          </div>
        </section>
    </>
  )
}
