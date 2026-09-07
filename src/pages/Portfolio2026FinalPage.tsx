import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import './portfolio2026final.css'
import './portfolio2026.css'
import { useSkillStory, WhatIDo } from '@/sections/whatido/WhatIDo'
import { Logo } from '@/joespresso/Logo'
import { ExperienceTunnel } from '@/sections/tunnel/ExperienceTunnel'
import { BlobWipe } from '@/components/BlobWipe'
import { AnchorNav } from '@/components/AnchorNav'
import { SITE } from '@/config/site'
import { OpenToWorkRibbon } from '@/sections/ribbonstory/OpenToWorkRibbon'
import { setCruise, setSceneOn } from '@/newhero/scrolly'
/** ฉาก 3D ของจอแรก — แยก chunk ไม่ให้ถ่วงจอที่เหลือ */
const NewHeroScene = lazy(() => import('@/newhero/NewHeroScene'))
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
    <header
      className={`pointer-events-none fixed inset-x-0 top-0 z-30 flex h-[var(--v3-nav-h)] items-center justify-between px-[clamp(18px,3vw,44px)] transition-[transform,opacity] duration-300 ease-out ${
        hidden ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <Logo width={93} height={32} color="var(--v3-shell-ink)" className="shrink-0" />
      {/* เหลือปุ่มเดียว — ลิงก์ในแถบซ้ำกับราวจุดด้านซ้ายที่พาไปทุกจออยู่แล้ว
          มุมขวาจึงเก็บไว้ให้สิ่งที่ราวนั้นทำแทนไม่ได้: เรซูเม่ที่ลิงก์ออกนอกหน้า */}
      <a
        href={SITE.resumeUrl}
        target="_blank"
        rel="noreferrer"
        className="pointer-events-auto flex cursor-pointer items-center justify-center rounded-full bg-[var(--v3-orange)] px-[clamp(16px,1.6vw,24px)] py-[clamp(8px,1vw,11px)] text-[clamp(12px,1vw,14px)] font-bold whitespace-nowrap text-white transition-colors duration-200 hover:brightness-110"
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
  return (
    <div
      className={`relative h-[clamp(46px,9.7svh,99px)] w-[clamp(98px,20.7svh,211px)] ${className}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        aria-label="Leave a comment"
        className="absolute inset-0 cursor-pointer transition-transform hover:scale-[1.03] active:scale-100"
      >
        <img src={heroBubble} alt="" className="absolute inset-0 h-full w-full" />
        {/* ในลูกโป่งมีแค่ไอคอน ไม่มีข้อความ — ตัวลูกโป่งบอกอยู่แล้วว่ามันคือคอมเมนต์ */}
        <span className="absolute inset-0 flex items-center justify-center pr-[8%]">
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="h-[clamp(18px,3.6svh,30px)] w-auto text-[#fd5000]"
          >
            <path
              d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
              fill="currentColor"
            />
          </svg>
        </span>
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

/** แผ่นเอียงที่ลอยหลังฉาก — ตำแหน่งเป็นสัดส่วนของจอ ไม่ใช่พิกเซลตายตัว */
function Iso({ left, top }: { left: string; top: string }) {
  return <span className="v3-iso" style={{ left, top }} aria-hidden />
}

export function Portfolio2026FinalPage() {
  const [onHero, setOnHero] = useState(true)
  /** ฉากสามมิติพังอยู่หรือเปล่า — คุมจากช่องแชทในหัวเรื่อง */
  /** โหมดคอมเมนต์ (เคอร์เซอร์เป็นหมุดทั้งจอแรก) + ตำแหน่งที่ปักช่องพิมพ์ไว้ */
  const [commenting, setCommenting] = useState(false)
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  /** โหมดของจอแล็ปท็อปในฉาก — สลับจาก toolbar (design = ซิมมือถือ, dev = โค้ด) */
  const rootRef = useRef<HTMLDivElement>(null)
  // จอ What I Do ยกมาทั้งก้อนจาก /2026 — สองอันนี้คือของที่ section นั้นต้องการ
  const scrollyRef = useRef<HTMLDivElement>(null)
  const skillsRef = useRef<HTMLElement | null>(null)
  /** บล็อกตัวหนังสือของจอแรก — จางออกตอนฉากเริ่มไหล (เขียน style ตรง ๆ ไม่ผ่าน state) */
  const copyRef = useRef<HTMLDivElement>(null)
  const skill = useSkillStory(scrollyRef, skillsRef)

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

  useEffect(() => {
    // เฝ้าแผ่นที่ถูกตรึง ไม่ใช่ตัว section — section สูงสามวิวพอร์ต จึงไม่มีทางเห็นถึงครึ่งตัวเอง
    const hero = document.getElementById('hero-pin')
    if (!hero) return
    const io = new IntersectionObserver((entries) => setOnHero(entries[0].isIntersecting), {
      threshold: 0.5,
    })
    io.observe(hero)
    return () => io.disconnect()
  }, [])

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
      const p = Math.min(1, y / vh)
      setCruise(p)
      // พ้นสองวิวพอร์ตแล้วจอถัดไปทึบเต็มที่ ฉากข้างหลังไม่มีใครเห็น — สั่งหยุดวาด
      setSceneOn(y < vh * 2)
      const copy = copyRef.current
      if (copy) {
        copy.style.transform = `translate3d(0, ${(-y * 0.16).toFixed(1)}px, 0)`
        // จางออกตอนจอแรกกำลังพ้นไป ไม่ใช่ค้างทับเรื่องถัดไป
        const f = Math.min(1, Math.max(0, (p - 0.25) / 0.45))
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
    <div ref={rootRef} className="v3 relative w-full">
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
       * ขอบบนของการ์ดเริ่มใต้แถบเมนูพอดี (--v3-nav-h) แถบจึงอยู่ "นอกฉาก" บนพื้นเทาของหน้า
       * ไม่ใช่ลอยทับฉากเหมือนเดิม — โลโก้จึงต้องเป็นหมึกเข้ม ไม่ใช่ขาว
       *
       * ตัวห่อไม่รับเมาส์ แต่แคนวาสรับ ([&_canvas]) — ช่องคอมมิตบนถนนสว่างตามเมาส์
       * ซึ่งต้องได้ pointermove จริง ๆ ถึงจะรู้ว่าโดนช่องไหน ส่วนที่ว่างรอบการ์ดยังคลิกทะลุได้
       */}
      <div className="pointer-events-none fixed top-[var(--v3-nav-h)] right-[clamp(10px,1.5vw,22px)] bottom-[clamp(10px,1.5vw,22px)] left-[clamp(10px,1.5vw,22px)] overflow-hidden rounded-[clamp(18px,2.2vw,34px)] [&_canvas]:pointer-events-auto">
        <Suspense fallback={null}>
          <NewHeroScene />
        </Suspense>
        {/* ม่านของเหลวที่ท่วมขึ้นมาตอนเลื่อนพ้นจอแรก — อยู่ในการ์ด มุมมนจึงตัดให้เอง */}
        <BlobWipe />
      </div>
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
      <section id="hero" data-screen="hero" className="pointer-events-none relative h-[100svh] w-full">
        <div id="hero-pin" className="absolute inset-0">
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
          className="pointer-events-none relative z-10 ml-auto flex h-[100svh] w-[min(46%,560px)] flex-col pt-[clamp(72px,16svh,164px)] pr-[clamp(24px,4.7vw,68px)] pb-[clamp(24px,14svh,143px)] text-[var(--v3-hero-ink)] will-change-transform">
          {/* my-auto ไม่ใช่ justify-center — ประโยคปิดถูกตรึงไว้ล่างสุด ที่ว่างที่เหลือ
              จึงต้องถูกแบ่งรอบหัวเรื่องเอง ไม่งั้นมันจะถูกดันไปชนแถบเมนูด้านบน */}
          <div className="my-auto flex flex-col gap-[clamp(12px,3.5svh,36px)]">
            <p className="v3-h1">Bring your</p>
            <div className="flex items-start gap-[clamp(10px,1.7vw,24px)]">
              <p className="v3-h1">Ideas</p>
              {/* ปุ่มต้องอยู่เหนือชั้นรับคลิกของโหมดคอมเมนต์ ไม่งั้นกดปิดโหมดไม่ได้ */}
              <HeroBubble
                className="pointer-events-auto z-50"
                active={commenting}
                onToggle={() => {
                  setPin(null)
                  setCommenting((v) => !v)
                }}
              />
            </div>
            <div className="flex items-end gap-[clamp(10px,1.7vw,24px)]">
              <p className="v3-h1">to</p>
              {/* คำว่า LIFE เป็นตัวอักษรที่ถูกวาดเป็นรูป ไม่ใช่ข้อความ — ยกไฟล์มาจากแบบตรง ๆ */}
              <img src={heroLife} alt="LIFE" className="h-[clamp(44px,9.2svh,94px)] w-auto" />
            </div>
          </div>

          <p className="text-[16px] leading-normal">
            I love crafting valuable things with passionate people
            <br />
            to bringing design to a real-world impact solution.
          </p>
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

      {/* Open to work — เล่าด้วยการเลื่อน: ริบบิ้นเวกเตอร์สามบีต OPEN · TO · WORK ซ้อนชั้นและพลิ้ว
          จบเป็นแถบคั่นเต็มความกว้างชิดขอบล่างของจอ ต่อเข้าจอ What I Do (ดู sections/ribbonstory) */}
      <OpenToWorkRibbon />

      {/* ── จอ 2: สิ่งที่ทำ ───────────────────────────────────────────────
          ใช้ section ตัวเดียวกับหน้า /2026 (กระเบื้องสกิลที่กางทีละใบตามระยะ scroll
          + กระเบื้องตัวละคร 3D) ไม่ใช่ผังนิ่งของ Figma — โค้ดอยู่ที่ sections/whatido

          ห่อด้วย .v2-theme เพราะ section นั้นแต่งตัวด้วยตัวแปร --v2-* ซึ่งประกาศไว้ที่คลาสนี้
          (ไม่ใช่ :root) และเป็นจอเดียวในหน้าที่สูงกว่าหนึ่งวิวพอร์ต — ระยะ scroll ในกรอบ
          คือไทม์ไลน์ของการเล่า จึงอยู่นอก <Screen> ที่ล็อกความสูงไว้จอเดียว */}
      <section id="what-i-do" data-screen="what-i-do" className="v2-theme v3-whatido relative w-full bg-[var(--v2-bg)]">
        {/* data-whatido-scrolly: จอ Experiences อ่านความคืบหน้าของกรอบนี้เพื่อเริ่มซูมเข้า
            อุโมงค์ตั้งแต่ยังอยู่ในจอนี้ (ช่วง 8% ท้าย) — ดู sections/tunnel */}
        <div ref={scrollyRef} data-whatido-scrolly className="relative lg:h-[520vh]">
          <div className="flex flex-col lg:sticky lg:top-0 lg:h-screen lg:justify-center">
            {/* กรอบเดียวกับจออื่นของหน้านี้ — ของเดิมกินเต็มความกว้างจอเพราะหน้า /2026
                มีขอบของตัวเองอยู่แล้ว ที่นี่ไม่มี ต้องใส่ให้ */}
            {/* ระยะขอบซ้าย/ขวาเท่ากับหัวเรื่องในจอแรก — สองจออยู่ในกรอบเดียวกัน
                ถ้าไม่เท่ากันจะเห็นเป็นบล็อกที่เยื้องกันตอนเลื่อนผ่าน */}
            <div className="mx-auto w-full max-w-[1440px] px-[clamp(24px,9.5vw,137px)]">
              <WhatIDo skillsRef={skillsRef} active={skill} />
            </div>
          </div>
        </div>
      </section>

      {/* ── จอ 3: ประสบการณ์ ───────────────────────────────────────────
          จบ What I Do แล้วการ์ด mascot ขยายเต็มจอ ก่อนจางออกเผยอุโมงค์กระเบื้องสามมิติ
          ที่เล่าเส้นทางการทำงานตามไทม์ไลน์จริง (ดู sections/tunnel) */}
      <ExperienceTunnel id="experiences" />

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
