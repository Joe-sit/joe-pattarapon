import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { useCursorStop } from '@/cursorguide/useCursorStop'
import { screenRects, stageIn, useStageTuner } from './stageTuner'
import { WRAP_AT, WhiteWrap } from './WhiteWrap'

/**
 * จอ "สิ่งที่ทำ" — การ์ดโพสต์ใบเดียว ตัวละครอยู่ข้างใน ของสกิลลอยรอบ
 *
 * แทนพอร์ทัลพิกเซลของเดิม (ยังอยู่ที่ sections/whatidopixel เปลี่ยน import กลับได้)
 * ฉาก 3D อยู่ที่ ./CardStage ส่วนตัวหนังสืออยู่ใน DOM ไม่ใช่ใน canvas — ตัวอักษรใน
 * texture คมสู้ตัวอักษรของเบราว์เซอร์ไม่ได้ และเลือก/อ่านออกเสียงไม่ได้ด้วย
 *
 * ป้ายสกิลวางด้วยเปอร์เซ็นต์ของกรอบจอ ไม่ได้ฉายจากพิกัดของวัตถุใน 3D — รอบนี้เอาผังก่อน
 * ถ้าจะให้ป้ายเกาะวัตถุจริงตอนจอแคบ ต้องฉายพิกัดผ่านกล้อง (ทำได้ทีหลัง)
 *
 * ### ท่าเข้าฉาก
 *
 * จอแรกส่งมอบมาด้วยพื้นขาวทึบ (ม่านเมฆตัดทิ้งเฟรมเดียว ไม่จาง — ดู WIPE_FULL ใน
 * components/CloudWipe) จอนี้จึงเริ่มจาก "หน้าขาวเปล่า" แล้วของลอยขึ้นมาเข้าที่ทีละชั้น
 * ตามระยะเลื่อน ไม่ใช่โผล่มาพร้อมกันทั้งจอ
 *
 * แต่ละชั้นขึ้นมาคนละอัตรา (ป้ายไกลมาก่อน การ์ดกลางจอมาช้าสุด) = พารัลแลกซ์จริง ไม่ใช่
 * ทุกอย่างเลื่อนขึ้นพร้อมกันเป็นแผ่นเดียว ค่าบวกคือ "ยังอยู่ต่ำกว่าที่ของมันกี่ส่วนของจอ"
 *
 * กล่องนอกสูงกว่าหนึ่งจอเพื่อให้มีระยะเลื่อนสำหรับท่านี้ ของจริงถูกตรึงไว้ด้วย sticky
 * จึงค้างเต็มจอตลอดระยะนั้น ไม่ใช่ไถลผ่านไป
 */

const CardStage = lazy(() => import('./CardStage').then((m) => ({ default: m.CardStage })))

/**
 * แผงจูนของจอนี้ — โหลดเฉพาะตอน dev
 *
 * แยกไฟล์เพราะมันลาก leva มาด้วย ค่าที่มันเขียนอยู่ในสโตร์เปล่า ๆ (./stageTuner) ซึ่งฉาก
 * อ่านโดยไม่ต้องรู้จักแผง
 */
const StagePanel = lazy(() => import('./StagePanel').then((m) => ({ default: m.StagePanel })))

/**
 * ชั้นรอยสาดของเคอร์เซอร์ที่เปิดเผยรูปจริง — โหลดแบบ lazy
 *
 * มันเป็นการจำลองของไหลบน WebGL (แคนวาสของตัวเอง) หนักและไม่จำเป็นต่อการอ่านเนื้อหา
 * จอที่ยังไม่ถูกเลื่อนมาถึงจึงไม่ต้องโหลดมันไปก่อน
 */
const SplashReveal = lazy(() => import('./SplashReveal').then((m) => ({ default: m.SplashReveal })))

/** รูปจริงที่รอยสาดเปิดเผย */
const REVEAL_PHOTO = '/photos/joe-portrait.jpg'

/**
 * ที่วางป้ายของแต่ละสกิล — ข้อความมาจาก SKILLS ของ section เดิม ไม่เขียนใหม่
 *
 * (ข้อความของ Research ในนั้นยังเป็น Lorem ตามที่สั่งไว้ว่าจะเขียนเอง จอนี้ไม่แต่งแทน)
 */
/** ระยะเลื่อน (เท่าของความสูงจอ) ที่ใช้พาของทั้งจอเข้าที่ */
const IN_SPAN = 0.55
/**
 * กองหน้าต่างไถลไปทางขวาหลังกางครบสี่บาน — ระยะเป็นสัดส่วนของ IN_SPAN (ท่ากางจบราว 0.91)
 * ต้องจบก่อนท่าปิดจอ (WRAP_AT 0.72 จอ) และระยะเลื่อนเป็น vw ของทั้งฉาก 3D กับชั้นรอยสาด (ต้องไปด้วยกัน ไม่งั้นรูปไม่ตรงช่อง)
 */
/** ท่าปิดจอ (ขาวห่อ + นิ้วจิ้มเคอร์เซอร์ ดู ./WhiteWrap) — ปิดไว้ก่อน จอเลื่อนพ้นไปเฉย ๆ */
const WRAP = false
const SIDE = { from: 0.92, span: 0.28, vw: 14 }

/** ยกของแต่ละชั้นขึ้นมาจากใต้จอกี่ส่วนของความสูงจอ — มากคือมาไกล มาก่อน */
const LIFT = {
  /**
   * การ์ดแทบไม่ต้องยกเลย — ฟองแชตของจอก่อนหน้าแปลงร่างมาเป็นการ์ดใบนี้แล้ว (ดู
   * sections/hero/ScrollTell) ถ้าการ์ดยังไถลขึ้นมาจากใต้จออีกรอบ ผู้ชมจะเห็นของหายไป
   * หนึ่งจังหวะแล้วค่อยโผล่ใหม่ ซึ่งกินการแปลงร่างทิ้งทั้งอัน
   */
  /**
   * ศูนย์: กรอบต้องอยู่ตรงที่ท่า genie วางไว้พอดีในเฟรมที่รับช่วง
   *
   * ยกขึ้นแม้แต่ 0.06 จอ (54px ที่จอสูง 900) ก็คือหน้าต่างที่กระโดดลงไป 54px ในเฟรมที่สลับ
   * จอ (วัดมาแล้ว) ความเคลื่อนไหวของกองมาจากท่ากางของมันเอง (ดู stageIn) ไม่ใช่จากการยก
   * ทั้งชั้นขึ้นมาอีกรอบ
   */
  stage: 0,
  head: 0.3,
  Research: 1.05,
  Design: 0.88,
  Coding: 0.96,
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => v * v * (3 - 2 * v)

const AT: Record<string, React.CSSProperties> = {
  /* ข้างแว่นขยาย (ซ้ายบน) */
  Research: { left: '6%', top: '24%' },
  /* ข้างถาดสี (ซ้ายล่าง) */
  Design: { left: '6%', bottom: '16%' },
  /* ข้างสวิตช์ (ขวาล่าง) */
  Coding: { right: '6%', bottom: '24%' },
}

export function WhatIDoCard({ id = 'what-i-do' }: { id?: string }) {
  const section = useRef<HTMLElement>(null)
  /** ป้ายสกิลสามใบ — เป็นทั้งข้อความและหมุดให้เคอร์เซอร์มาชี้ */
  const atResearch = useRef<HTMLDivElement>(null)
  const atDesign = useRef<HTMLDivElement>(null)
  const atCoding = useRef<HTMLDivElement>(null)
  /** จออยู่ในสายตาหรือยัง — สวิตช์ลูปวาดของฉาก ไม่ให้กินเฟรมตอนอยู่จออื่น */
  const [live, setLive] = useState(false)
  /** ชั้นที่ต้องเลื่อนเข้าที่ — เขียน transform ลง DOM ตรง ๆ ไม่ผ่าน state (ค่าเปลี่ยนทุกเฟรม) */
  const pin = useRef<HTMLDivElement>(null)
  /**
   * หมุดของเคอร์เซอร์ในท่าปิดจอ — ของเปล่าที่วางไว้ตามระยะเลื่อน ไม่ใช่ของที่มองเห็น
   *
   * จังหวะของจุดจอดคิดจากตำแหน่งของ element ในหน้า (ดู cursorguide/stops) ท่าปิดจอไม่มี
   * ของในจอให้เกาะ — มันคือช่วงที่ของทั้งจอกำลังถูกขาวห่อ จึงวางหมุดไว้ที่ระยะนั้นตรง ๆ
   */
  const wrapAim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = section.current
    if (!el) return
    const io = new IntersectionObserver((es) => setLive(es[0].isIntersecting), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /**
   * พาของเข้าที่ตามระยะเลื่อน — อ่านครั้งเดียวต่อเฟรมใน rAF ไม่ใช่ทุก event ของ scroll
   *
   * ค่าที่เขียนลงไปคือ `--in` ตัวเดียว (0 = ยังอยู่ใต้จอ, 1 = เข้าที่) แต่ละชั้นคูณด้วย
   * ระยะยกของตัวเองใน CSS — จะเพิ่มชั้นใหม่ก็ไม่ต้องแก้โค้ดตรงนี้
   */
  useEffect(() => {
    const sec = section.current
    const el = pin.current
    if (!sec || !el) return undefined
    let raf = 0
    const read = () => {
      raf = 0
      const vh = Math.max(1, window.innerHeight)
      const y = Math.max(0, -sec.getBoundingClientRect().top)
      const e = clamp01(y / (vh * IN_SPAN))
      el.style.setProperty('--in', smooth(e).toFixed(4))
      const side = clamp01((y / (vh * IN_SPAN) - SIDE.from) / SIDE.span)
      el.style.setProperty('--side', smooth(side).toFixed(4))
      /* ระยะเดียวกันไปคุมท่ากางกองหน้าต่างในฉาก 3D (ดู stageIn ใน ./stageTuner) — ส่งเป็น
         ค่าดิบ ฉากมี ease ของตัวเองต่อใบ */
      stageIn.v = e
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
    }
  }, [])

  /**
   * จุดจอดของเคอร์เซอร์นำสายตาในจอนี้ — ชี้ป้ายสกิลทีละอันตามลำดับที่เลื่อนเจอ
   *
   * เคอร์เซอร์เป็นของชิ้นเดียวของทั้งหน้า (ดู cursorguide/) จอนี้แค่บอกว่าให้มันมาอยู่ตรง
   * ไหน — ที่เหลือมันวิ่งต่อจากจุดจอดของจอก่อนหน้าเอง
   */
  useCursorStop(atResearch, { id: 'whatido-research', dx: 0.62, dy: -0.1, size: 58, tilt: -8, lift: 120 })
  useCursorStop(atDesign, { id: 'whatido-design', dx: 0.66, dy: -0.1, size: 54, tilt: 6, lift: 60 })
  useCursorStop(atCoding, { id: 'whatido-coding', dx: -0.58, dy: -0.12, size: 54, tilt: -4, lift: 40 })
  /**
   * จุดจอดสุดท้ายของจอ: มือ/เคอร์เซอร์ที่ยื่นเข้าไปในช่องที่ยังเหลือ (ตามภาพอ้างอิง)
   *
   * เอียงไปทางขวา = ชี้ไปที่มืออีกข้างซึ่ง *ยังไม่ใส่* ตามที่สั่งไว้ ที่ว่างทางขวาของเคอร์เซอร์
   * จึงเป็นที่ของมันในภายหลัง ไม่ใช่ที่ว่างเพราะจัดวางไม่ลง
   */
  useCursorStop(wrapAim, { id: 'whatido-wrap', size: 132, tilt: -128, lift: 90 })

  /** การวางรูปจริงให้ทับตัวละคร 3D — ลากได้จากแผงจูนของจอนี้ */
  const t = useStageTuner() as Record<string, number>
  const place = { zoom: t.phZoom, x: t.phX, y: t.phY }
  /**
   * กรอบหน้าจอของหน้าต่างทุกบาน — รูปจริงโผล่ได้แค่ในนั้น
   *
   * อัตราส่วนจออ่านจาก window ตรง ๆ ตอน render: ชั้นรอยสาดกินเต็มจอเท่ากับฉาก 3D
   * (ทั้งคู่อยู่ในกล่องที่ถูกตรึงใบเดียวกัน)
   */
  const aspect = typeof window === 'undefined' ? 16 / 9 : window.innerWidth / Math.max(1, window.innerHeight)
  const rects = screenRects(t, aspect)

  /** ยกขึ้นจากใต้จอตามค่า --in ของกลุ่ม (1 - in = ยังเหลือระยะอีกเท่าไร) */
  const rise = (k: number): React.CSSProperties => ({
    transform: `translate3d(0, calc((1 - var(--in, 0)) * ${k * 100}svh), 0)`,
  })

  return (
    <section
      id={id}
      data-screen={id}
      ref={section}
      /* สูงกว่าหนึ่งจอ — ระยะที่เกินคือระยะเลื่อนของท่าเข้าฉาก ของจริงถูกตรึงไว้ข้างใน */
      /* ท่อนท้ายที่เพิ่มมาคือระยะของท่าปิดจอ (ดู ./WhiteWrap) ไม่ใช่ที่ว่างเปล่า ๆ */
      className="relative h-[260svh] w-full text-[#0b0d12]"
      /* พื้นขาวล้วน — การ์ดกับตัวละครแยกออกจากพื้นด้วยเงาและแสงเงาของตัวเอง ไม่ใช่ด้วยสีพื้น */
      style={{ background: '#ffffff' }}
    >
      <div ref={pin} className="sticky top-0 h-[100svh] overflow-clip" style={{ ['--in' as string]: 0 }}>
        {/* ฉาก 3D กับรอยสาดเลื่อนไปขวาพร้อมกันหลังกางครบ (ดู SIDE) */}
        <div className="absolute inset-0" style={{ transform: `translate3d(calc(var(--side, 0) * ${SIDE.vw}vw), 0, 0)` }}>
        {/* ฉาก 3D — การ์ดโพสต์ ตัวละคร และของสกิล อยู่ในฉากเดียวกันทั้งหมด */}
        <div className="pointer-events-none absolute inset-0" style={rise(LIFT.stage)}>
          {live && (
            <Suspense fallback={null}>
              <CardStage />
            </Suspense>
          )}
        </div>

        {/**
         * รอยสาดของเคอร์เซอร์ — อยู่เหนือแคนวาสของฉาก
         *
         * ต้องอยู่เหนือ: ถ้าอยู่ใต้ฉาก รูปจะโผล่ได้เฉพาะที่ว่างนอกกองหน้าต่าง ซึ่งเป็นบริเวณที่
         * ไม่มีใครเอาเมาส์ไปไถ (วัดมาแล้วตอนทำด้วย CSS mask — วงหายไปใต้หน้าต่างทั้งวง)
         */}
        {live && (
          <Suspense fallback={null}>
            <SplashReveal photo={REVEAL_PHOTO} live={live} place={place} rects={rects} />
          </Suspense>
        )}
        </div>

        {/* แผงจูนฉาก — dev เท่านั้น อยู่นอกชั้นที่เลื่อน (rise) เพราะมันไม่ใช่ของในฉาก */}
        {import.meta.env.DEV && live && (
          <Suspense fallback={null}>
            <StagePanel />
          </Suspense>
        )}

        {/**
         * ท่าปิดจอ — ขาวห่อฉากจนสนิทแล้วส่งต่อจอถัดไป
         *
         * อยู่ในกล่องที่ถูกตรึง (จึงห่อ *ฉาก* ไม่ใช่ห่อหน้าเว็บ) และอยู่เหนือทุกชั้นของจอนี้
         * แต่ยังต่ำกว่าชั้นเคอร์เซอร์นำสายตาของหน้า (fixed z 55) — เคอร์เซอร์จึงยังอยู่บน
         * ความขาวให้เห็น เหมือนมือในภาพอ้างอิงที่อยู่บนพื้น ไม่ได้ถูกพื้นทับ
         */}
        {WRAP && <WhiteWrap sectionRef={section} />}

        {/* หัวจอ — เฉพาะชื่อจอ ไม่มีหัวเรื่อง เพราะยังไม่มีข้อความจริงของจอนี้ */}
        <div className="pointer-events-none absolute left-[6%] top-[9%]" style={rise(LIFT.head)}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#fd5000]">
            What I Do
          </div>
        </div>

        {/* ป้ายสกิล */}
        {SKILLS.map((s) => (
          <div
            key={s.title}
            ref={s.title === 'Research' ? atResearch : s.title === 'Design' ? atDesign : atCoding}
            className="pointer-events-none absolute max-w-[24ch]"
            style={{ ...AT[s.title], ...rise(LIFT[s.title as keyof typeof LIFT] ?? LIFT.head) }}
          >
            <div className="text-[clamp(16px,1.5vw,22px)] font-bold leading-tight" style={{ color: s.color }}>
              {s.title}
            </div>
            <div className="mt-1 text-[clamp(11px,1vw,14px)] leading-snug opacity-70">{s.desc}</div>
          </div>
        ))}
      </div>

      {/**
       * หมุดของเคอร์เซอร์ในท่าปิดจอ — อยู่นอกกล่องที่ถูกตรึง
       *
       * ต้องอยู่นอก: ของในกล่อง sticky ค้างอยู่ที่เดิมบนหน้าตลอดช่วงที่ตรึง จังหวะของจุดจอด
       * (ซึ่งคิดจากตำแหน่งในหน้า) จึงจะไม่เดินตามระยะเลื่อน ตัวนี้เป็นของในโฟลว์ปกติที่ระยะ
       * WRAP_AT + ครึ่งช่วง บวกครึ่งจอของหัวอ่าน
       */}
      {WRAP && (
      <div
        ref={wrapAim}
        className="pointer-events-none absolute left-[34%] h-0 w-0"
        /**
         * ถึงที่ *ก่อน* ท่าจะถูกจุดชนวนเล็กน้อย
         *
         * ท่าปิดจอเดินด้วยนาฬิกาของตัวเองแล้ว (ดู BEATS ใน ./WhiteWrap) ลูกศรจึงต้องเข้าที่
         * รออยู่ก่อนท่าเริ่ม ไม่ใช่ไถลเข้ามาระหว่างที่ท่ากำลังเล่น ส่วนปลายนิ้วของมืออีกข้าง
         * เล็งจากตำแหน่งจริงของลูกศรทุกเฟรม (ดู ARROW_TIP) ค่าคู่นี้จึงไม่ต้องตรงกันเป๊ะ
         * +0.5 คือครึ่งจอของหัวอ่าน (ดู cursorguide/stops)
         */
        style={{ top: `${(WRAP_AT - 0.06 + 0.5) * 100}svh` }}
        aria-hidden
      />
      )}
    </section>
  )
}
