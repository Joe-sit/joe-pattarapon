import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { CH, CHAPTERS, FRAME, HandScene, INTRO, chapterAt, portalAt, type Appear } from './HandScene'
import './handcompose.css'

/**
 * จอ What I do — ฉากมือชูจอ CRT (องค์ประกอบตามภาพอ้างอิง) เล่าด้วยการเลื่อนทั้งหมด:
 *
 * 1. ปก: ขอบบน section ถึงขอบจอ — ฟ้าเปิดวงกลมในกรอบ portal บนพื้นกระดาษจุด หัวข้อ What I do ลงมา
 *    มือชูจอพุ่งขึ้น ของที่สื่อถึงสกิลเด้งออกจากจอ ล้นขอบกรอบ
 * 2. เลื่อนต่อ: กรอบขยายเต็มจอ ของสกิลหดกลับเข้าจอ กล้องพุ่งเข้าจ่อจอ CRT จอเปิดเครื่อง พิมพ์ชื่อ/ตำแหน่ง
 *    แล้วกล้องถอยออกเป็นฉากเต็ม สติกเกอร์ ไอคอนโผล่
 * 3. บทสกิลทีละบท: สื่อบันทึกข้อมูลของสกิล (CD / Floppy / USB) ลอยเข้าข้างจอ สลับซ้าย/ขวา
 *    หัวข้อขึ้นอีกฝั่ง แล้วสื่อบินเข้าไปเสียบช่องบนคางจอ — จอขึ้นสกิลนั้น
 *
 *
 * section สูง 10 จอ เวทีตรึงเต็มจอ · ระยะเลื่อนเขียนลงวัตถุใบเดียว (ref) ฉาก 3D อ่านเองในลูปเฟรม
 * หัวข้อ DOM สลับด้วย data attribute จาก handler เลื่อน — ไม่มี setState ต่อเฟรม
 *
 * ออกห่างจากจอแล้ว Canvas หยุดวาด (frameloop never) · ย้อนขึ้นไปพ้นขอบบน = รีเซ็ตจอเปิดเครื่อง
 */
export function HandCompose({ id, className = 'h-[1000svh]' }: { id?: string; className?: string }) {
  const root = useRef<HTMLElement>(null)
  const appear = useRef<Appear>({ on: false, t: 0, p: 0, boot: -1, q: 0, rise: -1 })
  const heads = useRef<(HTMLDivElement | null)[]>([])
  const [zoomed, setZoomed] = useState(false)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let wasZoomed = false
    let wasNear = false
    const read = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const isNear = r.top < vh * 1.5 && r.bottom > -vh * 0.5
      if (isNear !== wasNear) setNear((wasNear = isNear))
      const a = appear.current
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)))
      a.p = p
      if (reduce) a.q = p
      /* มือชูจอเข้าฉากเมื่อขอบบนถึงขอบจอ (= ม่านเมฆของจอแรกเพิ่งหาย) · ย้อนขึ้นไปพ้น = รีเซ็ต */
      if (a.rise < 0 && r.top <= vh * 0.05 && r.bottom > vh * 0.5) a.rise = reduce ? 99 : 0
      else if (a.rise >= 0 && r.top > vh * 0.5) a.rise = -1
      /* จอเปิดเครื่องเมื่อกล้องดอลลี่ใกล้ถึงจอ (ขอบบนถึงขอบจอ = ม่านเมฆของจอแรกเพิ่งหาย) */
      if (a.boot < 0 && p >= INTRO - 0.012 && r.bottom > vh * 0.5) a.boot = reduce ? 99 : 0
      else if (a.boot >= 0 && r.top > vh * 0.5) a.boot = -1
      /* ฟ้าเปิดวงกลมพร้อมปก (มือพุ่งขึ้น) */
      const z = a.rise >= 0
      if (z !== wasZoomed) setZoomed((wasZoomed = z))
      /**
       * หัวข้อของบท: โผล่ตอนสื่อลอยเข้าถึงจุดโชว์ หายตอนสื่อเริ่มบินไปเสียบ เลื่อนเข้าจากขอบฝั่ง
       * ตรงข้ามกับสื่อ — ใช้ p ดิบ (ไม่หน่วง) เพราะ DOM ทรานซิชันเองอยู่แล้ว
       */
      let cur = -1
      CHAPTERS.forEach((_, i) => {
        const node = heads.current[i]
        if (!node) return
        const c = chapterAt(p, i)
        const on = c > 0.06 && c < 0.97
        if (on) cur = i
        node.dataset.on = String(on)
        /* สองท่อนของบท: ก่อนเสียบ = ชื่อสกิล + "รอแผ่น" · หลังเสียบ = คำอธิบายไล่ขึ้นมา + กำลังเล่น */
        node.dataset.phase = c >= CH.done ? 'play' : 'intro'
        const bar = node.querySelector<HTMLElement>('.hc-bar')
        if (bar) bar.style.transform = `scaleX(${Math.min(1, Math.max(0, c))})`
      })
      /* ปก: ขอบกรอบขยายออกเต็มจอตามระยะเลื่อน (--hc-w ขับ clip-path กับกรอบขาว) · หัวข้อลงเมื่อขยายเกินครึ่ง */
      const w = portalAt(p)
      const we = w < 0.5 ? 4 * w * w * w : 1 - (-2 * w + 2) ** 3 / 2
      el.style.setProperty('--hc-w', String(we))
      el.dataset.portal = String(a.rise >= 0 && w > 0.55)
      /* สีพื้นย้อมตามสกิลของบทที่กำลังเล่า */
      el.dataset.ch = String(cur)
      if (cur >= 0) {
        el.style.setProperty('--hc-tint', CHAPTERS[cur].color)
        el.style.setProperty('--hc-tx', CHAPTERS[cur].side > 0 ? '22%' : '78%')
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <section
      ref={root}
      id={id}
      className={`hc-root relative w-full ${className}`}
      data-in={zoomed}
      style={
        {
          '--f-t': FRAME.top,
          '--f-r': FRAME.right,
          '--f-b': FRAME.bottom,
          '--f-l': FRAME.left,
          '--f-bd': `${FRAME.border}px`,
          '--f-rad': `${FRAME.radius}px`,
        } as React.CSSProperties
      }
    >
      {/* เวทีตรึงหนึ่งจอ ตลอดความสูงของ section */}
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        {/* พื้นกระดาษจุดนอกกรอบ — โผล่ตามกรอบที่หดเข้า */}
        <div className="hc-paper" aria-hidden />
        <div className="hc-portal" aria-hidden>
          <div className="hc-sky">
            <div className="hc-rays" />
            <div className="hc-glow" />
          </div>
        </div>
        <div className="hc-frame" aria-hidden />
        <Canvas
          className="!absolute inset-0"
          shadows="soft"
          frameloop={near ? 'always' : 'never'}
          /* ตำแหน่งกล้องจริงคิดในฉากทุกเฟรม (จ่อจอ → ถอยออก) ค่านี้เป็นแค่ค่าเริ่ม */
          camera={{ position: [0, 0.35, 8], fov: 40 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => {
            /* Neutral: สีฟ้า/ครีมไม่ซีดแบบ ACES — ภาพอ้างอิงเป็นสีสดแบบของเล่นพลาสติก */
            gl.toneMapping = THREE.NeutralToneMapping
          }}
        >
          <HandScene appear={appear} />
        </Canvas>

        <div className="hc-tint" aria-hidden />

        {/* หัวข้อฉากจบ — ตัว o ของ do เป็นแคปซูลยืดแบบภาพอ้างอิง */}
        <h2 className="hc-ptitle pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center">
          <span className="hc-pline">
            <span>
              What I d<i className="hc-pill" aria-hidden />
              <span className="sr-only">o</span>
            </span>
          </span>
        </h2>
        <div className="hc-pfoot pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-end">
          <span className="hc-badge">
            <b>Joe Pattarapon</b>
            <small>UX/UI Designer</small>
          </span>
        </div>

        {/**
         * ข้อความของบท — อยู่อีกครึ่งจอจากฉาก 3D (สลับซ้าย/ขวาตามบท) ตัวใหญ่แบบหน้าหนังสือ
         * เลขบทใหญ่โปร่งอยู่ข้างหลัง · บรรทัดเลื่อนขึ้นจากหน้ากากทีละบรรทัด (ดู handcompose.css)
         * ข้อความจริงจาก SKILLS ของ what-i-do — Research ยังไม่มีคำอธิบาย จึงไม่มีบรรทัดนั้น
         */}
        {CHAPTERS.map((ch, i) => {
          const n = String(i + 1).padStart(2, '0')
          return (
            <div
              key={ch.title}
              ref={(node) => {
                heads.current[i] = node
              }}
              className="hc-head pointer-events-none absolute inset-y-0 flex w-1/2 flex-col justify-center"
              data-side={ch.side > 0 ? 'left' : 'right'}
              data-on="false"
              data-phase="intro"
              style={{ [ch.side > 0 ? 'left' : 'right']: 0, ['--hc-c' as string]: ch.color }}
            >
              <span className="hc-num" aria-hidden>
                {n}
              </span>
              <span className="hc-line hc-kicker">
                <span>{`Disk ${n} of ${String(CHAPTERS.length).padStart(2, '0')} · ${ch.drive}`}</span>
              </span>
              <h3 className="hc-line hc-title">
                <span>{ch.title}</span>
              </h3>
              <span className="hc-line hc-status">
                <span>
                  <i className="hc-dot" />
                  <b className="hc-wait">Insert disk to load</b>
                  <b className="hc-play">Now loaded</b>
                </span>
              </span>
              {ch.sub && (
                <p className="hc-line hc-sub">
                  <span>{ch.sub}</span>
                </p>
              )}
              <span className="hc-track">
                <span className="hc-bar" />
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
