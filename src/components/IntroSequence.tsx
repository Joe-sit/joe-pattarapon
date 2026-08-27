import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { gsap } from 'gsap'
import { AsciiField } from '@/components/AsciiField'
import { IntroDebug } from '@/components/IntroDebug'
import type { AsciiDrive } from '@/components/AsciiField'
import './introSequence.css'

/**
 * อินโทรของ /2026 — ถอดทีละเฟรมจากคลิปที่ Joe แตกไว้ (189 เฟรม @30fps ≈ 6.3 วินาที)
 *
 * ลำดับจริงที่อ่านได้จาก contact sheet:
 *   f001-f012  แผ่นโค้ดชิ้นใหญ่ + บล็อกฮาล์ฟโทนไถลผ่านหน้ากล้องออกไป เหลือเศษอักขระลอย
 *   f013-f048  เศษอักขระจัดตัวเป็นวงกลมกลางจอ หมุนช้า ๆ แล้วหุบเข้า (ขาว/เขียว/น้ำเงิน)
 *   f049-f054  วงยุบเหลืออักขระตัวเดียว — % บนบล็อกฟ้า
 *   f043-f072  ระหว่างนั้นภูมิประเทศ ASCII สีฟ้าก่อตัวขึ้นข้างหลัง แล้ว % หดหายไป
 *   f073-f113  หัวปากกาสีส้มไล่ลากเส้นไปตามตัวออบเจกต์ ทิ้งรอยเป็นอักขระสีส้มไว้ข้างหลัง
 *   f114-f130  รอยที่ลากแล้วถูกถมทีละช่องจนกลายเป็นบล็อกทึบ
 *   f131-f189  ตัวออบเจกต์หมุนต่อ มีแถบไฮไลต์ขาวกวาดไปตามตัว แล้วปิดท้ายด้วยการแตกเป็นขีด
 *
 * ตัวออบเจกต์คือริบบิ้นสามมิติเส้นเดียว (torus knot) หมุนอยู่ — ท่าที่เห็นทั้งคลิปคือปม
 * เดียวกันคนละมุม ทุกอย่างวาดในแคนวาสอักขระใบเดียว (ดู AsciiField.tsx) อินโทรตัวนี้
 * ทำหน้าที่แค่ป้อนค่าให้มันทีละองก์ผ่าน ref
 */

type IntroSequenceProps = {
  onDone: () => void
  /**
   * หน้าเบื้องหลังพร้อมให้ดูหรือยัง — อินโทรจะไม่ยอมจบจนกว่าจะ true
   * สัญญาเดียวกับ JoeLettersSplash เพื่อให้สลับตัวใน App.tsx ได้โดยไม่ต้องแก้ที่อื่น
   */
  ready?: boolean
  /** ยิงตอน "เริ่ม" เปิดออก ไม่ใช่ตอนจบ — ของข้างหลังต้องเริ่มขยับพร้อมกัน */
  onOpenStart?: () => void
}

/** กันค้างจอถ้าเบื้องหลังโหลดไม่สำเร็จ — เห็นเว็บดีกว่าค้างอยู่กับอินโทร */
const READY_TIMEOUT = 12000

/** บรรทัดโค้ดในองก์แรก — อ่านออกมาจากเฟรมจริง ไม่ได้แต่งเอง */
const LINES = [
  'increaseSpeed();',
  'motion.accelerate(',
  'animation.playbackRate =',
  'if (speed > threshold) {',
  'enableTurboMode();',
]

/**
 * อักขระบนวงแหวน — ชุดเดียวกับที่วนอยู่ในคลิป (a, (), 1, ¬, %, บล็อกทึบ)
 * สีก็ตามคลิป: ส่วนใหญ่ขาว แซมน้ำเงินกับเขียวเป็นจุด ๆ
 */
const RING = [
  { ch: 'a', color: '#ffffff' },
  { ch: '¬', color: '#ffffff' },
  { ch: '()', color: '#8fd6a4' },
  { ch: '1', color: '#ffffff' },
  { ch: '%', color: '#5b5bf0' },
  { ch: '■', color: '#39d353' },
  { ch: '¬', color: '#5b5bf0' },
  { ch: 'a', color: '#ffffff' },
  { ch: '()', color: '#8fd6a4' },
  { ch: '■', color: '#ffffff' },
  { ch: '1', color: '#5b5bf0' },
  { ch: '*', color: '#ffffff' },
  { ch: '¬', color: '#ffffff' },
  { ch: '%', color: '#5b5bf0' },
]

/** แผ่นโค้ดขององก์แรก: ตำแหน่ง/ทิศ/ขนาด สุ่มครั้งเดียวตอน mount */
type Plate = { text: string; x: number; y: number; dx: number; dy: number; size: number }

function buildPlates(): Plate[] {
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)
  return Array.from({ length: 14 }, (_, i) => {
    // ไถลออกตามทางที่ตัวเองอยู่ (เทียบจุดกลางจอ) = ผ่านหน้ากล้องออกไป
    const x = rnd(8, 92)
    const y = rnd(8, 92)
    return {
      text: LINES[i % LINES.length],
      x,
      y,
      dx: (x - 50) * 26,
      dy: (y - 50) * 26,
      size: rnd(30, 62),
    }
  })
}

export function IntroSequence({ onDone, ready = true, onOpenStart }: IntroSequenceProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const plates = useRef<Plate[]>(buildPlates()).current

  /**
   * ค่าที่ป้อนให้สนามอักขระทุกเฟรม — เป็น ref ไม่ใช่ state
   * gsap เขียนลงตรงนี้ 24-60 ครั้งต่อวินาที ถ้าเป็น state คือรีเรนเดอร์เท่านั้นครั้ง
   */
  const drive = useRef<AsciiDrive>({ gain: 0, solid: 0, build: 0, ink: 0, guide: 0 })

  /** ฉากข้างหลังพร้อมแล้วหรือยัง (หรือหมดเวลารอ) — ใช้กั้นไม่ให้ปิดฉากเร็วเกินไป */
  const [readyEnough, setReadyEnough] = useState(ready)
  useEffect(() => {
    if (ready) setReadyEnough(true)
  }, [ready])
  useEffect(() => {
    const t = setTimeout(() => setReadyEnough(true), READY_TIMEOUT)
    return () => clearTimeout(t)
  }, [])

  /** ไทม์ไลน์สร้างครั้งเดียว — ไม่ผูกพรอปไว้ใน deps ไม่งั้นมันถูกสร้างใหม่กลางทาง */
  const tlRef = useRef<gsap.core.Timeline | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const ctx = gsap.context(() => {
      // ไม่มี onComplete เรียก onDone: คนปิดฉากคือสปแลชตัวเดิมที่รับไม้ต่อไป
      const tl = gsap.timeline()
      tlRef.current = tl

      if (reduce) {
        // ลดการเคลื่อนไหว: ข้ามองก์เศษโค้ด/วงอักขระ ไปหยุดที่ตัวอักษรเลย
        tl.set('.intro-plate, .intro-ring', { opacity: 0 })
          .set('.intro-terminal', { opacity: 1 })
          .set(drive.current, { gain: 0.7, solid: 1, build: 1, ink: 1, guide: 0 })
          .call(() => setBuilt(true))
        return
      }

      // ── f001-f008: แผ่นโค้ดไถลออกนอกเฟรม ──────────────────────────────
      tl.to(
        '.intro-plate',
        {
          x: (_i: number, el: HTMLElement) => Number(el.dataset.dx),
          y: (_i: number, el: HTMLElement) => Number(el.dataset.dy),
          scale: 2.6,
          opacity: 0,
          ease: 'power2.in',
          duration: 0.55,
          stagger: { each: 0.012, from: 'random' },
        },
        0,
      )

      // ── f009-f048: วงแหวนอักขระหมุนแล้วหุบ ────────────────────────────
      // --ring-r คือรัศมี, --ring-a คือมุมที่ทั้งวงถูกหมุน (อักขระแต่ละตัวอ่านสองค่านี้)
      tl.fromTo('.intro-ring', { opacity: 0 }, { opacity: 1, duration: 0.35 }, 0.15)
      tl.fromTo(
        '.intro-ring',
        { '--ring-r': '9rem', '--ring-a': '0deg' },
        { '--ring-r': '5.2rem', '--ring-a': '150deg', duration: 1.85, ease: 'none' },
        0.15,
      )

      // ── f040-f054: วงยุบรวมเหลือ % ตัวเดียว + สนาม ASCII ติดขึ้นข้างหลัง ─
      tl.set('.intro-terminal', { opacity: 1 }, 0)
      tl.to(drive.current, { gain: 0.75, duration: 1.3, ease: 'power1.out' }, 1.35)
      tl.to(
        '.intro-ring',
        { '--ring-r': '0rem', '--ring-a': '260deg', opacity: 0, duration: 0.55, ease: 'power2.in' },
        1.9,
      )
      // ทุกตัวหุบเข้าจุดเดียวแล้วเหลือ % โผล่แทน — ไม่ใช่วงหายไปเฉย ๆ แล้วมีอะไรใหม่มา
      tl.fromTo(
        '.intro-pct',
        { opacity: 0, scale: 2.4 },
        { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' },
        2.25,
      )
      tl.to('.intro-pct', { opacity: 0, scale: 0.4, duration: 0.35, ease: 'power2.in' }, 2.9)

      // ── คลื่นนำสายตา: ริ้วบาง ๆ ลอยเข้ามาจากบนซ้ายแล้วทาบลงเป็นแนวของริบบิ้น ──
      tl.to(drive.current, { guide: 1, duration: 2.6, ease: 'none' }, 1.1)

      // ── f073-f130: ตัวอักษรประกอบร่างแล้วถมทึบ ─────────────────────────
      // ภูมิประเทศหรี่ลงตอนตัวออบเจกต์ขึ้น ให้ของสีส้มเป็นสิ่งที่สายตาเกาะ
      tl.to(drive.current, { gain: 0.45, duration: 0.9, ease: 'power1.inOut' }, 2.9)
      tl.to(drive.current, { ink: 1, duration: 0.4 }, 2.95)
      // ท่าประกอบร่างเดิมของเว็บ — E เผยจากเสี้ยว, กลีบ O แตก, J หล่นลงมา
      tl.to(drive.current, { build: 1, duration: 2.1, ease: 'none' }, 2.95)
      // ── f114-f130: รอยที่ลากแล้วถูกถมจนทึบ ───────────────────────────
      tl.to(drive.current, { solid: 1, duration: 1.6, ease: 'none' }, 4.5)
      tl.call(() => setBuilt(true), undefined, 7.4)
    }, root)

    return () => {
      ctx.revert()
      tlRef.current = null
    }
  }, [])

  /**
   * ตัวอักษรประกอบเสร็จ → ปิดฉาก
   *
   * ท่าปิดคือเฟรมสุดท้ายของคลิป: ทรงส้มถูกหั่นเป็นขีดแล้วสลายไป (--dash ในหน้ากาก)
   * ไม่ใช่ท่าซูมเข้าตัว O ของสปแลชเต็มจอ — โหมด embedded ปิดท่านั้นไว้แล้ว
   */
  const closeRef = useRef<gsap.core.Timeline | null>(null)
  const [built, setBuilt] = useState(false)
  /** แผงดีบักกดค้างไว้ไม่ให้อินโทรปิดตัวเอง — dev เท่านั้น */
  const [hold, setHold] = useState(false)
  useEffect(() => {
    if (hold || !built || !readyEnough || closeRef.current) return
    const tl = gsap.timeline({ onComplete: onDone })
    closeRef.current = tl
    // ค้างให้อ่านออกว่าเป็น JOE ก่อน แล้วค่อยแตกเป็นขีดตามเฟรมสุดท้ายของคลิป
    tl.to({}, { duration: 0.7 })
    tl.to('.intro-terminal', {
      '--dash': '2px',
      duration: 0.45,
      ease: 'power2.in',
      onStart: () => onOpenStart?.(),
    })
    tl.to('.intro-terminal', { opacity: 0, duration: 0.4, ease: 'power2.in' })
    tl.to('.intro-root', { opacity: 0, duration: 0.35 }, '-=0.15')
    return () => {
      tl.kill()
      closeRef.current = null
    }
  }, [hold, built, readyEnough, onDone, onOpenStart])

  /** ข้ามได้ทุกเมื่อ — คนที่เคยดูแล้วไม่ควรถูกบังคับดูซ้ำทุกครั้งที่รีเฟรช */
  useEffect(() => {
    const skip = (e: Event) => {
      // คลิกในแผงดีบักไม่ใช่การขอข้ามอินโทร
      if (e.target instanceof Element && e.target.closest('[data-intro-debug]')) return
      tlRef.current?.timeScale(4)
      closeRef.current?.timeScale(4)
      setReadyEnough(true)
    }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className="intro-root fixed inset-0 z-9999 overflow-hidden bg-[#0e1116]"
      role="presentation"
    >
      <AsciiField drive={drive} className="intro-terminal absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {plates.map((p, i) => (
          <span
            key={i}
            className="intro-plate"
            data-dx={p.dx}
            data-dy={p.dy}
            style={{ left: `${p.x}%`, top: `${p.y}%`, fontSize: `${p.size}px` }}
          >
            {p.text}
          </span>
        ))}
      </div>

      {/* วงแหวนอักขระ: แต่ละตัววางด้วยมุมของตัวเอง + มุมรวมของวง (--ring-a)
          แล้วถูกดันออกไปตามรัศมี (--ring-r) — ไล่สองค่านี้ได้ทั้งหมุนและหุบพร้อมกัน */}
      <div className="intro-ring pointer-events-none absolute inset-0" aria-hidden>
        {RING.map((r, i) => (
          <span
            key={i}
            className="intro-ring-ch"
            style={{ '--n': i, '--total': RING.length, color: r.color } as CSSProperties}
          >
            {r.ch}
          </span>
        ))}
      </div>

      {/* อักขระตัวสุดท้ายที่เหลือจากวง — % สีน้ำเงินตามเฟรม f051-f055 ของคลิป */}
      <span className="intro-pct" aria-hidden>
        %
      </span>

      {import.meta.env.DEV && <IntroDebug tl={tlRef} drive={drive} onHoldChange={setHold} />}

    </div>
  )
}
