import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import './portfolio2026final.css'
import './portfolio2026.css'
import { WhatIDoCard } from '@/sections/whatidocard/WhatIDoCard'
import { Logo } from '@/joespresso/Logo'

import { CloudWipe, WIPE_FULL } from '@/components/CloudWipe'
import { ScrollTell } from '@/sections/hero/ScrollTell'
import { AnchorNav } from '@/components/AnchorNav'
import { CursorGuideLayer } from '@/cursorguide/CursorGuideLayer'
import { useCursorStop } from '@/cursorguide/useCursorStop'
import { SITE } from '@/config/site'
import { setCruise, setSceneOn } from '@/newhero/scrolly'
import { useIntroDone } from '@/stores/intro'
/** ฉาก 3D ของจอแรก — แยก chunk ไม่ให้ถ่วงจอที่เหลือ */
const NewHeroScene = lazy(() => import('@/newhero/NewHeroScene'))
import { ExperiencePortals } from '@/sections/portals/ExperiencePortals'
import { fadeToArt, Headline3D, Headline3DField, useHeadlineArt } from '@/sections/hero/Headline3D'

import heroLife from '@/assets/v2final/hero-life.svg'
import heroBubble from '@/assets/v2final/hero-ideas-bubble.svg'

/**
 * /2026-final — หน้าเวอร์ชันที่ตัดสินแล้ว ถอดจาก Figma (BMS Design System, 12716:2552)
 *
 * แบบมาเป็นหกจอเดสก์ท็อป 1440x1024 วางของด้วยพิกัดสัมบูรณ์ทุกชิ้น ที่นี่แปลงเป็นเลย์เอาต์
 * ที่ไหลได้จริง: กรอบกลางกว้างสุด 1440 ระยะขอบตามแบบ (64px) และตัวอักษรย่อตามจอด้วย
 * clamp — พิกัดสัมบูรณ์เก็บไว้เฉพาะของที่ "ลอย" อยู่จริงในแบบ (แผ่นเอียง, ราวจุด)
 *
 * ส่วนที่แบบยังว่าง (Experiences, Stacks) ปล่อยว่างตามนั้น ไม่ใส่ข้อความสมมติลงไป
 */

/** เมนูบนขวา — ชื่อและลำดับตามแบบ */

/** หกจอของแบบ เรียงตามลำดับที่เลื่อนเจอ ใช้ผูกกับราวจุดด้านซ้าย */
const SECTIONS = ['hero', 'what-i-do', 'experiences', 'works', 'health', 'stacks'] as const
type SectionId = (typeof SECTIONS)[number]

/** ชื่อที่โผล่เป็น tooltip ข้างจุดของราวนำสายตา */
const SECTION_LINKS: { id: SectionId; label: string }[] = [
  { id: 'hero', label: 'Intro' },
  { id: 'what-i-do', label: 'What I Do' },
  { id: 'experiences', label: 'Experiences' },
  { id: 'works', label: 'Works' },
  { id: 'health', label: 'Health' },
  { id: 'stacks', label: 'Stacks' },
]

/**
 * แถบบนของหน้า — มีตัวเดียวทั้งหน้า ไม่ใช่ตัวหนึ่งต่อจอ
 *
 * ในไฟล์ Figma ทุกเฟรมวาดแถบนี้ไว้ในตัวเอง (เพราะเฟรมออกแบบแยกกัน) ถ้าถอดตามตรงจะได้
 * header ซ้ำหกอันซ้อนกันเวลาเลื่อน — อันของจอถัดไปไถลขึ้นมาทับอันของจอปัจจุบัน
 * fixed ตัวเดียวจึงเป็นสิ่งที่แบบหมายถึงจริง ๆ
 */
function TopBar() {
  /**
   * เลื่อนลง = ซ่อน, เลื่อนขึ้น = โผล่กลับมา
   *
   * เทียบกับตำแหน่งครั้งก่อนไม่ใช่กับ "ทิศของ event" — สโครลนุ่มของ lenis ยิงหลายครั้งต่อ
   * เฟรมและกลับทิศเล็ก ๆ ตอนหน่วง ถ้าดูแค่ทิศแถบจะกะพริบ จึงเก็บเฉพาะการขยับที่เกินระยะหนึ่ง
   * ช่วงบนสุดของหน้าไม่ซ่อนเลย ไม่งั้นแค่ขยับนิดเดียวโลโก้ก็หาย
   */
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - lastY.current
      if (Math.abs(dy) < 6) return
      lastY.current = y
      setHidden(y > 120 && dy > 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    /**
     * แถบเมนูอยู่ในกรอบฉาก — ขยับเข้ามาจากขอบจอเท่าระยะเว้นขอบของกรอบ (--v3-frame-gap)
     * บวกระยะหายใจของตัวเอง ไม่ใช่ยึดขอบจอตรง ๆ ไม่งั้นโลโก้จะไปนั่งคาบขอบกรอบ
     *
     * ระยะเว้นขอบอ่านจากตัวแปรชุดเดียวกับกรอบ ไม่ได้พิมพ์ตัวเลขซ้ำ — แก้ที่เดียวแล้วทั้งคู่ตาม
     */
    <header
      className={`pointer-events-none fixed inset-x-0 top-0 z-30 flex h-[var(--v3-nav-h)] items-center justify-between transition-[transform,opacity] duration-300 ease-out ${
        hidden ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
      }`}
      style={{
        /* ระยะในต้องมากกว่ารัศมีมุมของกรอบ ไม่งั้นโลโก้ถูกเส้นโค้งที่มุมกินหาย (เจอมาแล้ว) */
        paddingLeft: 'calc(var(--v3-frame-gap) + clamp(24px, 3.2vw, 52px))',
        paddingRight: 'calc(var(--v3-frame-gap) + clamp(24px, 3.2vw, 52px))',
        paddingTop: 'calc(var(--v3-frame-gap) + clamp(4px, 0.6vw, 10px))',
      }}
    >
      <Logo
        width={93}
        height={32}
        color="var(--v3-orange)"
        className="v3-in shrink-0 [--v3-in-delay:60ms]"
      />
      {/* เหลือปุ่มเดียว — ลิงก์ในแถบซ้ำกับราวจุดด้านซ้ายที่พาไปทุกจออยู่แล้ว
          มุมขวาจึงเก็บไว้ให้สิ่งที่ราวนั้นทำแทนไม่ได้: เรซูเม่ที่ลิงก์ออกนอกหน้า */}
      <a
        href={SITE.resumeUrl}
        target="_blank"
        rel="noreferrer"
        className="v3-in pointer-events-auto flex cursor-pointer items-center [--v3-in-delay:140ms] justify-center rounded-full bg-[var(--v3-orange)] px-[clamp(16px,1.6vw,24px)] py-[clamp(8px,1vw,11px)] text-[clamp(12px,1vw,14px)] font-bold whitespace-nowrap text-white transition-colors duration-200 hover:brightness-110"
      >
        Resume
      </a>
    </header>
  )
}

type ScreenProps = {
  id: SectionId
  /** สีพื้นของจอนี้ — ค่าเริ่มต้นคือน้ำเงินหลัก มีจอ Health ที่เป็นเขียว */
  bg?: string
  children: ReactNode
}

/** หนึ่งจอ = สูงเต็มวิวพอร์ต ตามแบบที่ทุกเฟรมสูง 1024 เท่ากันหมด */
function Screen({ id, bg, children }: ScreenProps) {
  return (
    <section
      id={id}
      data-screen={id}
      className="relative min-h-[100svh] w-full overflow-clip"
      style={bg ? { background: bg } : undefined}
    >
      <div className="relative mx-auto h-full min-h-[100svh] w-full max-w-[1440px]">{children}</div>
    </section>
  )
}

/** หัวจอ: ป้ายกำกับหมวดที่ขอบซ้าย + หัวข้อใหญ่ */
function ScreenHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="absolute top-[161px] left-16 flex gap-[74px]">
      <p className="v3-eyebrow pt-[6px]">{eyebrow}</p>
      <h2 className="v3-h1 uppercase">{title}</h2>
    </div>
  )
}


/**
 * ลูกโป่งคำพูดในหัวเรื่อง — ตอนนี้เป็นปุ่มธรรมดา
 *
 * กดแล้วเข้าโหมดคอมเมนต์แบบ Figma: เคอร์เซอร์ทั้งจอแรกกลายเป็นหมุดคอมเมนต์ แล้วคลิกตรงไหน
 * ก็ได้เพื่อปักช่องพิมพ์ลงตรงนั้น (ตัวโหมดกับช่องพิมพ์อยู่ที่ตัวหน้า ไม่ใช่ในปุ่มนี้ เพราะมัน
 * กินพื้นที่ทั้งจอ ไม่ใช่แค่ตรงลูกโป่ง)
 */
function HeroBubble({
  active,
  onToggle,
  className = '',
}: {
  className?: string
  /** อยู่ในโหมดคอมเมนต์อยู่หรือเปล่า */
  active: boolean
  onToggle: () => void
}) {
  const [bubbleEl, setBubbleEl] = useState<HTMLImageElement | null>(null)
  // ฟองเป็นกระจกใส — เห็นฉากข้างหลังทะลุ (ดู box.glass ใน sections/hero/Headline3D)
  const bubbleLive = useHeadlineArt(bubbleEl, heroBubble, true)
  return (
    <div
      className={`v3-hero-bubble relative ${className}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        aria-label="Leave a comment"
        className="absolute inset-0 cursor-pointer transition-transform hover:scale-[1.03] active:scale-100"
      >
        {/* ตัวฟองถูกยกไปเป็นทรงสามมิติในแคนวาสของหัวเรื่อง ภาพนี้เหลือไว้กันที่ในผังอย่างเดียว */}
        <img
          ref={setBubbleEl}
          src={heroBubble}
          alt=""
          className="absolute inset-0 h-full w-full"
          style={fadeToArt(bubbleLive)}
        />
      </button>

    </div>
  )
}

/**
 * ช่องพิมพ์คอมเมนต์ที่ถูกปักลงบนจอ — โผล่ตรงที่คลิก เหมือน pin คอมเมนต์ของ Figma
 *
 * ปิดด้วย Esc หรือคลิกที่อื่น ส่งด้วย Enter
 */
function CommentPin({
  x,
  y,
  onSubmit,
  onClose,
}: {
  x: number
  y: number
  onSubmit: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div
      className="absolute z-20 flex items-center gap-2 rounded-[18px] rounded-tl-[4px] bg-white px-3 py-2 shadow-[0_8px_28px_rgb(0_0_0/0.18)]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="size-2 shrink-0 rounded-full bg-[var(--v3-orange)]" />
      <input
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(text)
          if (e.key === 'Escape') onClose()
        }}
        placeholder="change"
        aria-label="Comment"
        className="w-[180px] bg-transparent text-[14px] text-[#292a2e] outline-none placeholder:text-[#292a2e]/40"
      />
    </div>
  )
}

/** คำว่า LIFE — ภาพเวกเตอร์เดิมกันที่ไว้ในผัง ส่วนที่เห็นจริงคือทรงสามมิติในแคนวาสหัวเรื่อง */
function LifeArt() {
  const [el, setEl] = useState<HTMLImageElement | null>(null)
  const live = useHeadlineArt(el, heroLife)
  return (
    <img
      ref={setEl}
      src={heroLife}
      alt="LIFE"
      className="v3-hero-life"
      style={fadeToArt(live)}
    />
  )
}

/** แผ่นเอียงที่ลอยหลังฉาก — ตำแหน่งเป็นสัดส่วนของจอ ไม่ใช่พิกเซลตายตัว */
function Iso({ left, top }: { left: string; top: string }) {
  return <span className="v3-iso" style={{ left, top }} aria-hidden />
}

/**
 * แผงจูนของฉาก newhero — หน้านี้ใช้ฉากเดียวกับ /new-hero จึงใช้แผงตัวเดียวกันได้เลย
 *
 * lazy: แผงลาก leva กับไอคอนมาทั้งชุด ไม่ควรอยู่ในบันเดิลของหน้าจริง
 * (นอกโหมด dev tuner อ่านแต่ค่าตั้งต้น แผงจึงไม่มีผลกับของที่คนอื่นเห็นอยู่แล้ว)
 */
const CameraTuner = lazy(() =>
  import('@/newhero/CameraTuner').then((m) => ({ default: m.CameraTuner })),
)

export function Portfolio2026FinalPage() {
  const [onHero, setOnHero] = useState(true)
  /** สปแลชส่งไม้ต่อแล้ว — ชิ้นส่วนของจอแรกไถลขึ้นมาเข้าที่ */
  const entered = useIntroDone()
  /** ฉากสามมิติพังอยู่หรือเปล่า — คุมจากช่องแชทในหัวเรื่อง */
  /** โหมดคอมเมนต์ (เคอร์เซอร์เป็นหมุดทั้งจอแรก) + ตำแหน่งที่ปักช่องพิมพ์ไว้ */
  const [commenting, setCommenting] = useState(false)
  /**
   * จุดเริ่มของการเดินทางไม่ต้องลงทะเบียนที่นี่ — มันคือเคอร์เซอร์ตัวจริงในฉากจอแรก
   * (ฉากวางหมุดไว้เอง ดู CursorAnchor ใน NewHeroScene) หมุดในหน้าจะเป็นการวางซ้ำ
   * ที่ดึงลูกศรออกจากที่ของมัน
   */
  /**
   * จังหวะของจอแรก: ไปมุมขวาสุดของจอ แล้วกวาดเฉียงลงซ้ายผ่านหัวเรื่อง
   *
   * สองจุดนี้อิงขอบจอ ไม่ได้อิงของในหน้า (ไม่มี element ไหนอยู่มุมขวาสุดให้เกาะ) และ
   * กำหนดจังหวะเอง (keyVh) เพราะทั้งคู่ต้องเกิดในระยะเลื่อนของจอแรกจอเดียว
   * จุดที่สองเปิดธง drive = ระหว่างวิ่งมาหามัน เคอร์เซอร์จะขับแม่เหล็กของหัวเรื่องด้วย
   */
  useCursorStop(null, { id: 'hero-corner', at: { x: 0.97, y: 0.12 }, keyVh: 0.68, size: 58, tilt: 14, lift: 90 })
  useCursorStop(null, {
    id: 'hero-sweep',
    at: { x: 0.26, y: 0.62 },
    keyVh: 0.92,
    size: 62,
    tilt: -16,
    lift: 40,
    drive: true,
  })
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  /** โหมดของจอแล็ปท็อปในฉาก — สลับจาก toolbar (design = ซิมมือถือ, dev = โค้ด) */
  const rootRef = useRef<HTMLDivElement>(null)
  /** แผ่นจอแรกที่ตรึงไว้ — ซ่อนทีเดียวตอนม่านเมฆขาวทึบ ไม่งั้นมันค้างอยู่ใต้จอถัดไปตลอดหน้า */
  const pinRef = useRef<HTMLDivElement>(null)
  /** กรอบการ์ดที่ครอบฉาก 3D — กางออกเต็มจอตอนเลื่อนพ้นจอแรก */
  const frameRef = useRef<HTMLDivElement>(null)
  /** บล็อกตัวหนังสือของจอแรก — จางออกตอนฉากเริ่มไหล (เขียน style ตรง ๆ ไม่ผ่าน state) */
  const copyRef = useRef<HTMLDivElement>(null)


  /**
   * ราวซ้ายไม่มีในจอแรกตามแบบ จึงต้องรู้แค่ว่า "ยังอยู่จอแรกอยู่ไหม"
   *
   * เฝ้าเฉพาะ #hero ด้วย IntersectionObserver — เฝ้าทุกจอไม่ได้ผล เพราะจอ What I Do
   * สูง 520vh จึงไม่มีทางเห็นถึงครึ่งหนึ่งของตัวเอง ราวเลยไม่เคยโผล่
   */
  // Esc = เลิกโหมดคอมเมนต์ (เหมือนเครื่องมือใน Figma) ผูกไว้เฉพาะตอนอยู่ในโหมด
  useEffect(() => {
    if (!commenting) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPin(null)
        setCommenting(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commenting])

  /**
   * จอแรกเลื่อนออกแบบพารัลแลกซ์ — แต่ทำ "ในฉาก" ไม่ใช่เลื่อนตัวแคนวาส
   *
   * เคยเลื่อนตัวแคนวาสขึ้นช้ากว่าหน้า ผลคือขอบล่างของแคนวาสลอยขึ้นมากลางจอ เห็นเป็นเส้น
   * ตัดขวางที่ริบบิ้นถูกตัดจบดื้อ ๆ แล้วสีก็ไม่ต่อกัน (พื้นฉากไล่จบเข้มกว่าพื้นจอถัดไป)
   * — แคนวาสจึงอยู่นิ่งเต็มจอเหมือนเดิม แล้วส่งความคืบหน้าเข้าไปให้กล้องขยับแทน
   * ของในฉากอยู่คนละระยะลึกอยู่แล้ว กล้องขยับนิดเดียวก็ได้พารัลแลกซ์จริงมาฟรี ๆ
   * (ดู CameraRig ใน newhero/NewHeroScene.jsx และ newhero/scrolly.js)
   *
   * เหลือชั้นตัวหนังสือที่ยังเลื่อนใน DOM — มันคือชั้นที่อยู่ใกล้สุด จึงต้องไปเร็วกว่าเพื่อน
   *
   * เขียน transform ลง DOM ตรง ๆ ไม่ผ่าน state: ค่านี้เปลี่ยนทุกเฟรมที่เลื่อน ถ้าเป็น state
   * หน้าทั้งหน้า (รวมแคนวาส 3D) จะ re-render ตามการเลื่อน อ่านค่าใน rAF ครั้งเดียวต่อเฟรม
   * ไม่ใช่ทุก event ของ scroll ซึ่งยิงถี่กว่าเฟรม
   */
  useEffect(() => {
    const sec = document.getElementById('hero')
    if (!sec) return
    let raf = 0
    const read = () => {
      raf = 0
      const r = sec.getBoundingClientRect()
      const vh = Math.max(1, window.innerHeight)
      const y = Math.max(0, -r.top)
      const sv = y / vh
      const p = Math.min(1, sv)
      setCruise(p)
      setOnHero(sv < WIPE_FULL)
      /**
       * ม่านขาวทึบแล้วก็ปิดจอแรกทิ้งทั้งแผ่น — มันถูกตรึงแบบ fixed จะค้างอยู่ใต้จอถัด ๆ ไป
       * ตลอดหน้าถ้าไม่ปิด และการสลับเกิดใต้ม่าน ผู้ชมจึงไม่เห็นจังหวะที่มันหาย
       */
      const gone = sv >= WIPE_FULL ? 'hidden' : ''
      const pinEl = pinRef.current
      if (pinEl) pinEl.style.visibility = gone
      // ถูกบังมิดแล้ว ไม่มีใครเห็นฉากข้างหลัง — สั่งหยุดวาด
      setSceneOn(sv < WIPE_FULL + 0.05)
      const frame = frameRef.current
      if (frame) {
        frame.style.visibility = gone
        // กางเสร็จก่อนเมฆถมเต็ม ฉากจึงเต็มจอตอนที่ยังเห็นมันอยู่ ไม่ใช่กางตอนถูกบังไปแล้ว
        const o = Math.min(1, y / (vh * 0.55))
        frame.style.setProperty('--v3-frame-open', (o * o * (3 - 2 * o)).toFixed(4))
      }
      const copy = copyRef.current
      if (copy) {
        copy.style.transform = `translate3d(0, ${(-y * 0.16).toFixed(1)}px, 0)`
        /**
         * จางออกหลังจังหวะเคอร์เซอร์จบ ไม่ใช่ตอนเริ่มเลื่อน
         *
         * เคอร์เซอร์นำสายตากวาดผ่านหัวเรื่องแล้วดูดตัวอักษรให้ไหวตาม (ดู cursorguide/) —
         * ถ้าหัวเรื่องจางไปก่อน มันก็กวาดผ่านที่ว่าง เลยต้องค้างไว้จนพ้นจังหวะนั้น
         * แล้วจึงจางให้ทันก่อนม่านเมฆเริ่มถมที่ 0.46 (CloudWipe: WIPE_AT)
         */
        const f = Math.min(1, Math.max(0, (p - 0.42) / 0.16))
        copy.style.opacity = String(1 - f * f * (3 - 2 * f))
      }
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    read()
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      if (raf) cancelAnimationFrame(raf)
      setCruise(0)
    }
  }, [])

  return (
    <div ref={rootRef} className={`v3 relative w-full${entered ? ' v3-entered' : ''}`}>
      {/**
       * ฉาก 3D เป็นชั้นตรึงเต็มวิวพอร์ต ไม่ได้อยู่ในกล่องของจอแรก
       *
       * ถ้าอยู่ในจอแรก (สูงวิวพอร์ตเดียว) พอเลื่อนพ้น ทุกอย่างในฉากถูกตัดจบที่ขอบกล่อง —
       * เห็นเป็นเส้นคาดขวางจอที่ริบบิ้นถูกหั่นครึ่ง แล้วสีสองฝั่งก็ไม่ต่อกัน ตรึงไว้เต็มจอ
       * แทน ฉากจึงไม่มีขอบให้เห็นเลย จอถัดไปเลื่อนมาทับมันเองตามลำดับการวาด
       * (section ถัดไปเป็น positioned และอยู่หลังในเอกสาร จึงวาดทับชั้นนี้)
       *
       * รับเมาส์ไม่ได้ (pointer-events) ไม่งั้นมันจะกินคลิกของทั้งหน้าไปหมด
       *
       * ครอบด้วยการ์ดมุมมนแบบเดียวกับ .jp-hero-card ของ /joespresso: เว้นขอบแล้วตัดมุม
       * ฉากจึงอ่านเป็น "จอในหน้า" ไม่ใช่พื้นหลังเต็มจอ
       *
       * แถบเมนูอยู่ *ใน* การ์ด (ตาม ref chuvakam.ru): การ์ดเว้นขอบเท่ากันสี่ด้านแล้วแถบ
       * ลอยทับอยู่ข้างในที่ขอบบน — ของเดิมขอบบนการ์ดเริ่มใต้แถบ แถบจึงนั่งบนพื้นเทาของหน้า
       *
       * ตัวห่อไม่รับเมาส์ แต่แคนวาสรับ ([&_canvas]) — ช่องคอมมิตบนถนนสว่างตามเมาส์
       * ซึ่งต้องได้ pointermove จริง ๆ ถึงจะรู้ว่าโดนช่องไหน ส่วนที่ว่างรอบการ์ดยังคลิกทะลุได้
       */}
      <div
        ref={frameRef}
        className="v3-scene-frame pointer-events-none [&_canvas]:pointer-events-auto"
      >
        <Suspense fallback={null}>
          <NewHeroScene />
        </Suspense>
      </div>
      {/* แผงจูนของฉาก — dev เท่านั้น เหมือน /new-hero (ดู newhero/CameraTuner) */}
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <CameraTuner />
        </Suspense>
      )}

      {/* ม่านเมฆ — ชั้นของตัวเองที่ตรึงเต็มจอและอยู่เหนือทุก section
          เดิมอยู่ในชั้นฉากของจอแรก ซึ่งจอถัดไปเลื่อนขึ้นมาวาดทับ ม่านจึงถูกแซงหน้า
          ตัวมันจางทิ้งเองเมื่อถมเต็ม (ดู WIPE_OUT ใน CloudWipe) จึงไม่บังจอถัดไป */}
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: 50 }} aria-hidden>
        <CloudWipe />
      </div>

      {/* เคอร์เซอร์นำสายตา — ชั้นเดียวทั้งหน้า ต้องอยู่นอก section ทุกอัน ไม่งั้นข้ามจอไม่ได้ */}
      <CursorGuideLayer />

      <TopBar />
      {/* ราวจุดนำสายตา — ตัวเดียวกับที่ใช้ในเวอร์ชัน Vue (branch `2026`)
          ในแบบมีทุกจอยกเว้นจอแรก จึงจางหายตอนอยู่ที่ hero */}
      <AnchorNav
        sections={SECTION_LINKS}
        className={onHero ? 'pointer-events-none opacity-0' : undefined}
      />

      {/* ── จอ 1: หัวเรื่อง ──────────────────────────────────────────────
          โปร่งใส ไม่มีพื้นของตัวเอง — ฉากที่ตรึงไว้ข้างบนคือพื้นของจอนี้ จอแรกจึงไม่มีขอบ
          ให้ตัดกับจอถัดไป เหลือแค่ตัวหนังสือที่เลื่อนออกเร็วกว่าฉาก (พารัลแลกซ์) */}
      {/* จอแรกไม่กินเมาส์ทั้งจอ — ฉาก 3D อยู่ในชั้นตรึงที่อยู่ "หลัง" จอนี้ ถ้าจอนี้รับเมาส์
          ทั้งกล่อง ถนนในฉากจะไม่มีวันรู้ว่าเมาส์ผ่าน (ช่องคอมมิตสว่างตามเมาส์)
          ชิ้นที่ต้องกดได้ในจอนี้เปิด pointer-events ของตัวเองไว้แล้ว (ฟองคำพูด/ชั้นคอมเมนต์) */}
      {/**
       * จอแรกเป็น "ที่ว่างสำหรับเลื่อน" ล้วน ๆ ของจริงถูกตรึงแบบ fixed อยู่ข้างบน
       *
       *   0 → 0.18    เคอร์เซอร์ไถลไปมุมขวาสุด
       *   0.18 → 0.42 กวาดเฉียงลงซ้ายผ่านหัวเรื่อง (ดูดตัวอักษรไปด้วย)
       *   0.46 → 0.90 ม่านเมฆถมจนขาวทึบ แล้วจางส่งมอบที่ 0.90 → 0.98 (ดู CloudWipe)
       *
       * ความสูง = 90svh เท่ากับจังหวะพอดี ไม่ใช่ 100svh ขึ้นไป เพราะจอนี้ไม่ต้อง "ไถลออก"
       * ขอบบนของจอถัดไปจึงมาถึงขอบบนจอที่ 0.90 = วินาทีที่ม่านขาวทึบพอดี การสลับฉาก
       * เกิดใต้ม่าน ไม่มีใครเห็น
       *
       * เคยตรึงด้วย sticky ในกล่องที่สูงกว่าหนึ่งจอ: จอแรกต้องไถลขึ้นไปเต็มหนึ่งจอก่อนจอ
       * ถัดไปจะเต็มจอ ระหว่างนั้นขอบขาวของจอถัดไปโผล่ขึ้นมาจากล่างตั้งแต่ยังไม่มีเมฆ และ
       * ตอนม่านจาง จอแรกที่ยังไถลไม่พ้นก็โผล่กลับมาให้เห็นแถบหนึ่งด้านบน — เนียนไม่ได้
       * ด้วยการขยับจังหวะ เพราะระยะไถลออกเท่ากับหนึ่งจอเสมอ
       */}
      <section id="hero" data-screen="hero" className="pointer-events-none relative h-[90svh] w-full">
        {/* หมุดของเคอร์เซอร์นำสายตาในจอแรก — กล่องเปล่าไม่มีขนาดของตัวเอง มีไว้บอกตำแหน่ง
            เท่านั้น (ดู cursorguide/) วางไว้แถวที่เคอร์เซอร์ในฉากเคยลอยอยู่ ข้างหัวเรื่อง */}
        {/* แผ่นที่ถูกตรึง — fixed เต็มจอ และ z สูงกว่าจอถัด ๆ ไป (ซึ่งอยู่ระดับ auto)
            จอถัดไปจึงเลื่อนเข้ามาอยู่ "ใต้" จอแรกโดยไม่โผล่ที่ขอบล่าง แล้วจอแรกถูกซ่อน
            ทีเดียวตอนม่านเมฆขาวทึบ (ดู read() ด้านบน) — ต่ำกว่าแถบเมนู (z 30) ม่าน (z 50) และเคอร์เซอร์ (55) */}
        <div ref={pinRef} id="hero-pin" className="fixed inset-x-0 top-0 z-20 h-[100svh]">
        <div className="relative mx-auto h-full w-full max-w-[1440px]">
        {/* ชั้นรับคลิกของโหมดคอมเมนต์ — คลุมทั้งจอแรก ปักหมุดตรงที่คลิก
            อยู่ต่ำกว่าเนื้อหา (z-0 ของ Screen) แต่สูงกว่าแคนวาส 3D ซึ่งไม่รับคลิกอยู่แล้ว */}
        {commenting && (
          <div
            className="v3-comment-cursor absolute inset-0 z-40 h-[100svh]"
            onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect()
              setPin({ x: e.clientX - box.left, y: e.clientY - box.top })
            }}
          >
            {pin && (
              <CommentPin
                x={pin.x}
                y={pin.y}
                onSubmit={() => {
                  setPin(null)
                  setCommenting(false)
                }}
                onClose={() => setPin(null)}
              />
            )}
          </div>
        )}

        {/* จอแรกไหลตามความสูงจริงของวิวพอร์ต ไม่ใช่พิกัดตายตัวจากแบบ 1024
            หัวเรื่องอยู่กลาง ประโยคปิดถูกดันลงไปติดล่างด้วย mt-auto */}
        <div
          ref={copyRef}
          className="pointer-events-none relative z-10 ml-auto flex h-[100svh] w-[min(46%,560px)] flex-col pt-[clamp(72px,16svh,164px)] pr-[clamp(34px,3.4vw,54px)] pb-[clamp(24px,14svh,143px)] text-[var(--v3-hero-ink)] will-change-transform">
          {/* my-auto ไม่ใช่ justify-center — ประโยคปิดถูกตรึงไว้ล่างสุด ที่ว่างที่เหลือ
              จึงต้องถูกแบ่งรอบหัวเรื่องเอง ไม่งั้นมันจะถูกดันไปชนแถบเมนูด้านบน */}
          <Headline3DField
            active={onHero}
            className="v3-hero-skew my-auto flex flex-col items-start gap-[clamp(12px,3.5svh,36px)]"
          >
            <Headline3D text="Bring your" className="v3-h1" />
            {/* ฟองคำพูดอยู่ข้าง Ideas ตามแบบ และอยู่ในโฟลว์จริง — ขอบขวาของบรรทัดนี้จึงเป็น
                ตัวฟอง ไม่ใช่ตัวอักษร คำว่า Ideas เลยเยื้องเข้ามาจากแนวขวาเท่าความกว้างฟอง
                ซึ่งเป็นการจัดวางแบบเดียวกับในแบบ */}
            <div className="flex items-center gap-[clamp(10px,1.7vw,24px)]">
              <Headline3D text="Ideas" className="v3-h1" />
              {/* ปุ่มต้องอยู่เหนือชั้นรับคลิกของโหมดคอมเมนต์ ไม่งั้นกดปิดโหมดไม่ได้ */}
              <HeroBubble
                /* ถ่วงลงนิดหนึ่งให้กึ่งกลางฟองตรงกับกึ่งกลาง "ตัวอักษรที่เห็น" ไม่ใช่กึ่งกลาง
                   กล่องบรรทัด — กล่องมี line-height 1 ตัวอักษรจึงกินพื้นที่ค่อนไปทางล่างของกล่อง
                   ใช้ margin ไม่ใช่ translate: ทรงสามมิติของฟองอ่านตำแหน่งจากผัง */
                className="v3-in pointer-events-auto z-50 mt-[clamp(5px,1.1svh,13px)] [--v3-in-delay:640ms]"
                active={commenting}
                onToggle={() => {
                  setPin(null)
                  setCommenting((v) => !v)
                }}
              />
            </div>
            <div className="flex items-end gap-[clamp(10px,1.7vw,24px)]">
              <Headline3D text="to" className="v3-h1" />
              {/* คำว่า LIFE เป็นตัวอักษรที่ถูกวาดเป็นรูป ไม่ใช่ข้อความ — ยกไฟล์มาจากแบบตรง ๆ */}
              <LifeArt />
            </div>
          </Headline3DField>

          {/* ประโยคปิดย้ายออกไปเป็นชั้นเล่าเรื่องตามการเลื่อน (ดู sections/hero/ScrollTell)
              มันต้องค้างอยู่บนจอข้ามช่วงที่ม่านเมฆถม ซึ่งอยู่ในโฟลว์ของจอแรกไม่ได้ */}
        </div>

        {/* โหมดคอมเมนต์เปิด/ปิดด้วยฟองคำพูดในฉาก ซึ่ง screen reader อ่านไม่ได้ —
            ปุ่มคู่นี้คือทางเดียวกันในแบบที่คีย์บอร์ดกับ AT ใช้ได้จริง */}
        <div className="sr-only">
          <button type="button" onClick={() => setCommenting(false)}>
            Move tool
          </button>
          <button type="button" onClick={() => setCommenting(true)}>
            Comment tool
          </button>
        </div>
        </div>
        </div>
      </section>

      {/* ริบบิ้น HELLO · AND · WELCOME ถอดออกชั่วคราวตามที่สั่ง — ตัวคอมโพเนนต์ยังอยู่ที่
          sections/ribbonstory/OpenToWorkRibbon (และเวอร์ชันเครื่องบินลากป้ายที่
          PlaneBannerScene.tsx) เอากลับมาโดย import แล้วใส่ <OpenToWorkRibbon /> ตรงนี้ */}

      {/* ── จอ 2: สิ่งที่ทำ ───────────────────────────────────────────────
          ตัวละครเป็นก้อนพิกเซลฟ้ากลางเฟรม (เงาจริงของริกที่ถูกหั่นเป็นตาราง) สกิลเป็นของ 3D
          รอบขอบ ชี้อันไหนของชิ้นนั้นโตขึ้นและขึ้นคำอธิบาย — ดู sections/whatidopixel

          เวอร์ชันก่อน ๆ ยังอยู่ทั้งหมด สลับกลับได้ที่ import บรรทัดเดียว (ทุกอันรับ prop id
          ตัวเดียวกัน): sections/whatido ผังกระเบื้อง Figma (หน้า /2026 ยังใช้อยู่) ·
          sections/whatidofog จอเล่าด้วยการเลื่อนผ่าหมอก · sections/whatidowedge ลิ่มสามลิ่ม */}
      {/* ── ช่วงคั่นบนพื้นขาว: ประโยคปิดของจอแรก เล่าทีละท่อน ─────────────────
          ต่อจากม่านเมฆที่ถมขาวแล้วตัดตัวเองทิ้ง (WIPE_FULL) พื้นขาวของจอนี้คือของที่อยู่
          ใต้ม่านตรงนั้นพอดี ผู้ชมจึงเห็นฟ้าถูกกลบจนขาวแล้วมีตัวหนังสือขึ้นมาบนความขาวนั้น */}
      <ScrollTell />

      <WhatIDoCard id="what-i-do" />

      {/* ── จอ 3: ประสบการณ์ ───────────────────────────────────────────
          พอร์ทัลเศษกระจกกระจายบนทุ่งฟ้า ตัวละครลอยออกมาทีละช่วงของไทม์ไลน์จริง
          (ดู sections/portals) — อุโมงค์กระเบื้องตัวเดิมยังอยู่ที่ sections/tunnel
          เปลี่ยน import กลับได้ถ้าจะสลับไปใช้ของเดิม */}
      <ExperiencePortals id="experiences" />

      {/* ── จอ 4: ผลงาน ──────────────────────────────────────────────────
          เป็น section ที่ไหลจริง ไม่ใช่การ์ดสามใบที่ปักพิกัดสัมบูรณ์ไว้: ในแบบการ์ดใบที่สาม
          เริ่มที่ x=1096 กว้าง 407 คือล้นขอบเฟรม 1440 ออกไป 63px ซึ่งจงใจให้เห็นว่ายังมีต่อ
          ที่นี่จึงเป็นแถวที่เลื่อนได้ กว้างตามเนื้อหา แล้วปล่อยให้ใบท้ายเลยขอบเหมือนกัน
          — พอจอแคบกว่า 1440 มันก็ยังอ่านได้ ไม่ใช่การ์ดหลุดออกไปเฉย ๆ */}
      <Screen id="works">
        <div className="flex h-[100svh] flex-col pt-[clamp(72px,16svh,161px)] pb-[clamp(16px,8svh,80px)]">
          <div className="flex shrink-0 gap-[clamp(24px,5vw,74px)] px-[clamp(24px,4.4vw,64px)]">
            <p className="v3-eyebrow pt-[6px]">WORKS</p>
            <h2 className="v3-h1 uppercase">My Work</h2>
          </div>

          {/* items-center: ใบกลางสูงกว่าเพื่อนตามแบบ สองใบข้างจึงเยื้องลงเองโดยไม่ต้องตั้ง
              margin-top ตายตัว (ค่า 62px ในแบบคือผลของการจัดกึ่งกลาง ไม่ใช่ระยะที่ตั้งใจ) */}
          {/* ขนาดทุกอย่างในแถวนี้ผูกกับ "ความสูงจอ" ไม่ใช่ค่าตายตัวจากแบบ 1024: ระยะขอบ
              ตัวอักษร และช่องว่างในการ์ดหดตามจอเตี้ย ไม่งั้นช่องภาพ (ตัวที่ยืดได้ตัวเดียว)
              จะโดนบีบจนเหลือเป็นแถบบาง ๆ ก่อนอย่างอื่นเสมอ */}
          <div className="mt-[clamp(16px,5svh,52px)] flex min-h-0 flex-1 items-center gap-[clamp(16px,2.8vw,40px)] overflow-x-auto px-[clamp(24px,14vw,202px)] pb-2">
            <article className="flex h-[83%] w-[clamp(260px,28vw,407px)] shrink-0 flex-col rounded-[clamp(20px,4svh,40px)] bg-[var(--v3-blue-deep)] p-[clamp(20px,3.6svh,40px)]">
              <h3
                className="text-[clamp(15px,2.2svh,20px)] leading-normal"
                style={{ fontFamily: 'var(--v3-display)' }}
              >
                HEALTH DASHBOARDS
              </h3>
              <div className="mt-[clamp(8px,1.6svh,16px)] flex flex-wrap gap-[clamp(8px,1.6svh,16px)]">
                {['Data Visualization', 'UX/UI Design'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-xl bg-white/10 px-[clamp(8px,1.2vw,12px)] py-[clamp(5px,1svh,8px)] text-[clamp(12px,1.8svh,16px)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {/* ที่วางภาพงานจริง — ยังไม่มีในแบบ จึงเป็นช่องว่างที่ถูกกันไว้ ไม่ใช่ภาพหลอก
                  min-h กันไม่ให้มันถูกบีบจนหายไปตอนจอเตี้ย */}
              <div className="mt-[clamp(12px,3svh,32px)] min-h-[72px] flex-1 rounded-3xl bg-[var(--v3-grey)]" />
              <p className="mt-[clamp(12px,3svh,32px)] text-[clamp(12px,1.8svh,16px)] leading-normal">
                Transform over million data into actionable
                <br />
                insight for 200+ hospital in Thailand
              </p>
            </article>

            {/* สองใบที่เหลือในแบบยังเป็นแผ่นเปล่า เนื้อหายังไม่ถูกออกแบบ — ปล่อยว่างตามนั้น */}
            <div className="h-full w-[clamp(260px,28vw,407px)] shrink-0 rounded-[clamp(20px,4svh,40px)] bg-[var(--v3-grey)]" />
            <div className="h-[83%] w-[clamp(260px,28vw,407px)] shrink-0 rounded-[clamp(20px,4svh,40px)] bg-[var(--v3-blue-deep)]" />
          </div>
        </div>
      </Screen>

      {/* ── จอ 5: งาน Health Dashboards ────────────────────────────────── */}
      <Screen id="health" bg="var(--v3-green)">
        <div className="absolute top-[161px] left-16 flex gap-[74px]">
          <p className="v3-eyebrow pt-[6px]">WORKS</p>
          <h2
            className="text-[48px] leading-[1.1] uppercase"
            style={{ fontFamily: 'var(--v3-display)' }}
          >
            Health
            <br />
            Dashboards
          </h2>
        </div>
        <Iso left="819px" top="0px" />

        <div className="absolute top-[299px] left-[202px] flex gap-[57px]">
          <p className="v3-eyebrow shrink-0">OVERVIEW</p>
          <p className="w-[462px] text-[16px] font-medium">
            Designed national-scale health dashboards for 200+ hospitals in collaboration with the
            Ministry of Public Health, transforming 1M+ health records into actionable insights.
          </p>
        </div>

        <div className="absolute top-[487px] left-[202px] flex items-center gap-10">
          {['Hospital Users', 'Hospital Users', 'Hospital Users'].map((label, i) => (
            <div key={i} className="relative size-[124px]">
              {/* วงกลมจาง ๆ ที่เป็นฉากหลังของตัวเลข ในแบบเป็นวงเดียวกันทั้งสามช่อง */}
              <span className="absolute inset-0 rounded-full border border-white/40 bg-white/10" />
              <div className="absolute top-20 left-[61px] rounded-xl bg-[var(--v3-green)] p-2 whitespace-nowrap">
                <p
                  className="text-[40px] leading-none uppercase"
                  style={{ fontFamily: 'var(--v3-display)' }}
                >
                  200+
                </p>
                <p className="mt-4 text-[16px] font-medium">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </Screen>

      {/* ── จอ 6: เครื่องมือ ────────────────────────────────────────────
          แผงขาวในแบบยังว่าง เนื้อหาข้างในยังไม่ถูกออกแบบ */}
      <Screen id="stacks">
        <ScreenHead eyebrow="TOOLS" title="Stacks I used" />
        <div className="absolute top-[301px] left-[202px] h-[638px] w-[1174px] rounded-3xl border border-[var(--v3-line)] bg-white" />
      </Screen>
    </div>
  )
}

/** เผื่อไว้ให้ TS รู้จัก custom property ที่ส่งผ่าน style ในไฟล์นี้ */
export type V3Style = CSSProperties & Record<`--v3-${string}`, string>
