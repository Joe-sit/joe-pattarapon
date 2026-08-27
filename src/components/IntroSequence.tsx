import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { AsciiField } from '@/components/AsciiField'
import { IntroDebug } from '@/components/IntroDebug'
import type { AsciiDrive } from '@/components/AsciiField'
import './introSequence.css'

/**
 * อินโทรของ /2026 — ถอดทีละเฟรมจากคลิปที่ Joe แตกไว้ (189 เฟรม @30fps ≈ 6.3 วินาที)
 *
 * ลำดับจริงที่ได้จากการไล่ดูครบทั้ง 189 ใบ (ไม่ใช่จาก contact sheet):
 *   f001-f035  ชิ้นส่วนโค้ดจริง + เลข 20/24 ตัวโต ลอยอยู่ทั่วจอแล้ว "หดเข้าหากลางจอ"
 *              (ไม่ใช่ไถลออกนอกเฟรม) พร้อมกับเล็กลงและจางหาย
 *   f013-f046  ของที่เหลือไม่ได้หายตาม แต่ไปเกาะเป็น "วง" รอบกลางจอแล้วหมุนช้า ๆ พร้อม
 *              รัศมีที่หดลงเรื่อย ๆ ตัวอักษรในแต่ละช่องสลับไปมาระหว่างทาง
 *   f047-f053  วงยุบรวมเป็นไทล์เดียวกลางจอ: บล็อกไล่เฉดฟ้ากับอักขระข้าง ๆ ที่วิ่ง 1 → 2 → %
 *   f036-f070  เกาะ ASCII สีฟ้าโผล่จากขอบจอซ้ายแล้วลอยเข้ากลาง คอนทัวร์ซ้อนชั้นเหมือน
 *              แผนที่ภูมิประเทศ ซ้อนอยู่หลังวงแหวนตั้งแต่ก่อนวงจะยุบ
 *   f052-f084  เกาะโตเต็มจอ แกนกลางไต่ขึ้นถึงชั้นคราม ($ ! สีน้ำเงินสด) แล้ว f084 คือ
 *              เฟรมแรกที่มีบล็อกส้มทึบ — โผล่ตรงแกนเกาะพอดี นั่นคือเมล็ดของริบบิ้น
 *   f084-f132  บล็อกยืดยาวเป็นแถบจนครบวงและทึบ คอนทัวร์ที่ห่อรอบค่อย ๆ หดหายไป
 *   f132-f170  หมุนต่อ: ห่วงเลขแปด → ไขว้เป็น X → แบนเป็นแท่งตั้งตอนมองสันขอบ
 *              พร้อมปื้นขาวไล่เฉดกวาดไปตามตัว
 *   f170-f189  เหลือห่วงเรียบ ๆ แล้วปิดท้ายด้วยการหั่นเป็นขีดนอนเรียงเป็นวงกลม
 *
 * ทั้งคลิปคือ "สนามความสูงใบเดียว" เรนเดอร์ด้วยบันไดอักขระเดียว (ดู AsciiField.tsx) —
 * ภูมิประเทศกับริบบิ้นไม่ใช่คนละเลเยอร์ แต่เป็นค่าเดียวกันคนละระดับ อินโทรตัวนี้ทำหน้าที่
 * แค่เลื่อนระดับให้ทีละองก์ผ่าน ref
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

/** ชิ้นหนึ่งบนวงโคจร: มุมกับรัศมีตั้งต้น ทุกอย่างที่เหลือทำในไทม์ไลน์ */
type Orb = {
  t: string
  c: string
  bg?: string
  size: number
  /** รัศมีตั้งต้น หน่วยพิกเซล */
  r: number
  /** มุมตั้งต้น องศา 0 = ขึ้นบน เดินตามเข็ม */
  a: number
}

/**
 * ชิ้นใหญ่วงนอก (f001-f014) — บรรทัดโค้ดจริง, เลขปีตัวโต และปื้นฮาล์ฟโทน
 *
 * มุมกับรัศมีวัดจาก f001 โดยตรง: 20 อยู่บนซ้าย, 24 ล่างขวา, animation.playbackRate บนขวา,
 * if (speed > threshold) กับ enableTurboMode อยู่ล่างซ้าย รัศมีใหญ่พอที่พอวงหมุนไปแล้ว
 * มันจะกวาดออกนอกเฟรมเอง ไม่ต้องสั่งให้วิ่งออกไปต่างหาก
 */
const ORBIT_BIG: Orb[] = [
  { t: 'increaseSpeed();', c: '#0e1116', bg: '#f2f4f7', size: 38, r: 560, a: 340 },
  { t: 'motion.accelerate();', c: '#0e1116', bg: '#f2f4f7', size: 40, r: 520, a: 350 },
  { t: 'animation.playbackRate =', c: '#0e1116', bg: '#c9ced6', size: 40, r: 620, a: 45 },
  { t: 'if (speed > threshold) {', c: '#0e1116', bg: '#c9ced6', size: 38, r: 680, a: 212 },
  { t: 'enableTurboMode();', c: '#0e1116', bg: '#c9ced6', size: 38, r: 640, a: 203 },
  { t: '20', c: '#0e1116', bg: '#c9ced6', size: 130, r: 560, a: 302 },
  { t: '24', c: '#0e1116', bg: '#eef1f5', size: 130, r: 700, a: 138 },
  // ปื้นฮาล์ฟโทนเทา — ในคลิปเป็นสี่เหลี่ยมจุดหยาบ ไม่มีตัวอักษร
  { t: '■', c: '#5f666f', size: 96, r: 430, a: 356 },
  { t: '■', c: '#5f666f', size: 74, r: 520, a: 152 },
]

/**
 * อักขระวงใน — พวกนี้คือชิ้นที่รอดจากการกวาด แล้วรัศมีหดมาเท่ากันจนอ่านเป็น "วงแหวน"
 *
 * มีทั้งตัวอักษรล้วน, ตัวที่อยู่บนชิปสีอ่อน (# กับ if) และบล็อกสีทึบเล็ก ๆ (เขียว/ฟ้า)
 * รัศมีตั้งต้นไม่เท่ากัน ชิ้นที่อยู่ใกล้อยู่แล้วจึงเข้าที่ก่อน เหมือน f011-f018 ในคลิป
 */
const ORBIT_RING: Orb[] = [
  { t: '()', c: '#39d353', size: 30, r: 605, a: 175 },
  { t: 'if', c: '#0e1116', bg: '#9aa4b0', size: 24, r: 170, a: 169 },
  { t: '#', c: '#0e1116', bg: '#f2f4f7', size: 26, r: 352, a: 317 },
  { t: '■', c: '#39d353', size: 22, r: 368, a: 296 },
  { t: '*', c: '#0e1116', bg: '#9aa4b0', size: 26, r: 387, a: 338 },
  { t: 'a', c: '#e9edf2', size: 40, r: 300, a: 120 },
  { t: '¬', c: '#e9edf2', size: 30, r: 250, a: 20 },
  { t: '¬', c: '#e9edf2', size: 30, r: 430, a: 250 },
  { t: '¬', c: '#e9edf2', size: 26, r: 520, a: 60 },
  { t: '()', c: '#39d353', size: 30, r: 470, a: 205 },
  { t: '¬', c: '#3b3bd0', size: 26, r: 330, a: 95 },
  { t: '%', c: '#5b5bf0', size: 28, r: 560, a: 285 },
  { t: '■', c: '#2f7fc4', size: 18, r: 210, a: 230 },
]

/** ตัวที่ใช้สลับไปมาในช่องของวงระหว่างที่หมุน — ในคลิปแต่ละช่องไม่ได้ตรึงตัวเดิมตลอด */
const SWAPS: { t: string; c: string; bg?: string }[] = [
  { t: 'a', c: '#e9edf2' },
  { t: '1', c: '#e9edf2' },
  { t: '()', c: '#39d353' },
  { t: '*', c: '#39d353' },
  { t: '¬', c: '#e9edf2' },
  { t: '%', c: '#5b5bf0' },
  { t: '¬', c: '#3b3bd0' },
  { t: '#', c: '#0e1116', bg: '#f2f4f7' },
  { t: '■', c: '#39d353' },
  { t: 'if', c: '#0e1116', bg: '#9aa4b0' },
  { t: '¬', c: '#2f7fc4' },
  { t: '■', c: '#2f7fc4' },
]

export function IntroSequence({ onDone, ready = true, onOpenStart }: IntroSequenceProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  /**
   * ค่าที่ป้อนให้สนามอักขระทุกเฟรม — เป็น ref ไม่ใช่ state
   * gsap เขียนลงตรงนี้ 24-60 ครั้งต่อวินาที ถ้าเป็น state คือรีเรนเดอร์เท่านั้นครั้ง
   */
  const drive = useRef<AsciiDrive>({
    gain: 0,
    solid: 0,
    build: 0,
    ink: 0,
    guide: 0,
    // ตรงกับ SPIN0 ใน AsciiField — เลือกให้ท่าเลขแปดตกที่ f132 และห่วงมองตรงที่ f189
    spin: 3.39,
    sweep: -0.2,
    shatter: 0,
  })

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

    /** สลับตัวอักษรของช่องหนึ่งในวง — เลือกช่องและตัวแบบกำหนดตายตัวจาก k ไม่สุ่ม
     *  เพราะไทม์ไลน์ต้องเลื่อนกลับไปมาแล้วได้ภาพเดิม (แผงดีบักมีแถบ scrub) */
    const swapRingGlyph = (k: number) => {
      const els = root.querySelectorAll<HTMLElement>('.intro-orbit-ring .intro-orbit-ch')
      const el = els[(k * 7) % (els.length || 1)]
      if (!el) return
      const g = SWAPS[(k * 5 + 3) % SWAPS.length]
      el.textContent = g.t
      el.style.color = g.c
      el.style.background = g.bg ?? 'transparent'
    }

    const setPctGlyph = (t: string) => {
      const el = root.querySelector<HTMLElement>('.intro-pct-ch')
      if (el) el.textContent = t
    }

    const ctx = gsap.context(() => {
      // ไม่มี onComplete เรียก onDone: คนปิดฉากคือสปแลชตัวเดิมที่รับไม้ต่อไป
      const tl = gsap.timeline()
      tlRef.current = tl

      if (reduce) {
        // ลดการเคลื่อนไหว: ข้ามองก์เศษโค้ด/วงแหวน ไปหยุดที่ห่วงเลย
        tl.set('.intro-orbit, .intro-pct', { opacity: 0 })
          .set('.intro-terminal', { opacity: 1 })
          .set(drive.current, {
            gain: 0.32,
            solid: 1,
            build: 1,
            ink: 1,
            guide: 1,
            spin: Math.PI * 2,
          })
          .call(() => setBuilt(true))
        return
      }

      /* ทุกจังหวะข้างล่างอ้างเลขเฟรมของคลิปตรง ๆ ผ่าน at() ไม่มีจังหวะที่แต่งขึ้นเอง
         คลิปเดินที่ 30fps (มีเฟรมซ้ำคู่ ภาพจริง 15fps) ยาว 189 เฟรม = 6.3 วินาที
         SLOW เป็นตัวคูณเดียวของทั้งไทม์ไลน์ ปรับตัวนี้ตัวเดียวถ้าอยากเร็ว/ช้ากว่านี้ */
      const SLOW = 1.5
      /** วินาทีบนไทม์ไลน์ของเฟรมที่ f ในคลิป */
      const at = (f: number) => (f / 30) * SLOW
      /** ความยาวเป็นวินาทีของช่วง f0 ถึง f1 */
      const dur = (f0: number, f1: number) => at(f1) - at(f0)

      /* f001-f046: ทุกชิ้นกวาดตามเข็มรอบกลางจอพร้อมกันตั้งแต่เฟรมแรก
         ชิ้นใหญ่อยู่วงนอกจนล้นเฟรม ที่เหลือรัศมีหดมาเท่ากันจนอ่านเป็นวงแหวน
         ความเร็วเชิงมุมวัดได้ 11°/เฟรมช่วงต้น เหลือ 4.4°/เฟรมที่ f021-f031 = ชะลอ */
      tl.fromTo('.intro-orbit', { rotation: 0 }, { rotation: 466, duration: dur(1, 46), ease: 'power2.out' }, at(1))
      // ตัวอักษรหมุนสวนด้วยค่าและ ease เดียวกันเป๊ะ จึงตั้งตรงตลอดเหมือนในคลิป
      tl.fromTo('.intro-orbit-ch', { rotation: 0 }, { rotation: -466, duration: dur(1, 46), ease: 'power2.out' }, at(1))

      // f005-f014: ชิ้นใหญ่จางและหด (การหมุนพาออกนอกเฟรมเอง)
      // หดที่ตัวอักษรไม่ใช่ที่ช่อง — ช่องถือ transform ที่วางตำแหน่งไว้แล้ว ถ้าทวีนทับจะหลุดวง
      tl.to(
        '.intro-orbit-big',
        { opacity: 0, duration: dur(5, 14), ease: 'power2.in', stagger: { each: 0.06, from: 'random' } },
        at(5),
      )
      tl.to(
        '.intro-orbit-big .intro-orbit-ch',
        { scale: 0.45, duration: dur(5, 14), ease: 'power2.in', stagger: { each: 0.06, from: 'random' } },
        at(5),
      )

      // f001-f017: รัศมีเข้าที่ 168px (วัดจาก f017 เป็นต้นไปที่ค่านิ่ง)
      tl.to('.intro-orbit-ring', { '--r': '168px', duration: dur(1, 17), ease: 'power2.out', stagger: 0.03 }, at(1))
      // f033-f051: หดต่อจนยุบ (f033 ≈ 150px, f042 ≈ 130px, f049 ≈ 60px)
      tl.to('.intro-orbit-ring', { '--r': '0px', duration: dur(33, 51), ease: 'power1.in' }, at(33))
      tl.to('.intro-orbit-ring', { opacity: 0, duration: dur(47, 51), stagger: { each: 0.02, from: 'random' } }, at(47))

      // f008-f044: ตัวอักษรในช่องสลับไปมาทุกราวสามเฟรม
      for (let k = 0; k < 13; k++) tl.call(() => swapRingGlyph(k), undefined, at(8 + k * 3))

      // f035-f070: เกาะ ASCII โผล่จากขอบจอ — ก่อน f035 พื้นหลังยังดำสนิท
      tl.set('.intro-terminal', { opacity: 1 }, 0)
      tl.to(drive.current, { gain: 0.92, duration: dur(35, 70), ease: 'power1.out' }, at(35))

      // f047-f085: ไทล์กลางจอ อักขระข้างบล็อกวิ่ง 1 → 2 → % (f047/f050/f053) แล้วค้าง
      tl.fromTo(
        '.intro-pct',
        { opacity: 0, scale: 1.6 },
        { opacity: 1, scale: 1, duration: dur(47, 50), ease: 'power2.out' },
        at(47),
      )
      tl.call(() => setPctGlyph('2'), undefined, at(50))
      tl.call(() => setPctGlyph('%'), undefined, at(53))
      tl.to('.intro-pct', { opacity: 0, scale: 0.35, duration: dur(85, 92), ease: 'power2.in' }, at(85))

      // f052-f070: แกนเกาะไต่ขึ้นถึงชั้นคราม รอให้หัวออกเดินตรงมุมบนซ้าย
      tl.to(drive.current, { guide: 1, duration: dur(52, 70), ease: 'power1.inOut' }, at(52))

      /* f070-f132: หัวเกิดที่มุมบนซ้าย (f070) วิ่งไปตามความยาววงทิ้งรอยไว้ข้างหลัง
         จนบรรจบครบที่ f112 แล้วถมทึบทั้งวงที่ f132
         build = ตำแหน่งหัวบนความยาววง, ink = ดันขึ้นบันได (สีส้มโผล่ f082),
         solid = บีบคอนทัวร์รอบให้หดจนเหลือแถบทึบล้วน */
      // เริ่มที่ค่าพื้นไม่ใช่ศูนย์ — f070-f078 ก้อนที่หัวเห็นเป็นครามอยู่แล้ว ยังไม่มีสีส้ม
      tl.fromTo(
        drive.current,
        { ink: 0.18 },
        { ink: 1, duration: dur(70, 120), ease: 'power2.out' },
        at(70),
      )
      tl.to(drive.current, { build: 1, duration: dur(70, 112), ease: 'none' }, at(70))
      tl.to(drive.current, { solid: 1, duration: dur(112, 132), ease: 'power1.inOut' }, at(112))
      // f084-f189: หมุนต่อเนื่องจนจบ ปลายทาง 2π = หันหน้าเข้ากล้อง จึงอ่านเป็นห่วงเรียบ
      tl.to(drive.current, { spin: Math.PI * 2, duration: dur(84, 189), ease: 'none' }, at(84))

      // f150-f183: ไฮไลต์กวาด และพื้นหลังหรี่จนดับสนิท (f183 เป็นดำล้วน)
      tl.to(drive.current, { sweep: 1.5, duration: dur(150, 183), ease: 'none' }, at(150))
      tl.to(drive.current, { gain: 0, duration: dur(150, 183), ease: 'power1.in' }, at(150))
      tl.call(() => setBuilt(true), undefined, at(189))
    }, root)

    return () => {
      ctx.revert()
      tlRef.current = null
    }
  }, [])

  /**
   * วงประกอบเสร็จ → ปิดฉาก
   *
   * ท่าปิดคือเฟรมสุดท้ายของคลิป (f189): ห่วงส้มถูกหั่นเป็นขีดนอนสั้น ๆ เรียงเป็นวงกลม
   * แล้วสลายไป ไม่ใช่ท่าซูมเข้าตัว O ของสปแลชเต็มจอ
   */
  const closeRef = useRef<gsap.core.Timeline | null>(null)
  const [built, setBuilt] = useState(false)
  /** แผงดีบักกดค้างไว้ไม่ให้อินโทรปิดตัวเอง — dev เท่านั้น */
  const [hold, setHold] = useState(false)
  useEffect(() => {
    if (hold || !built || !readyEnough || closeRef.current) return
    const tl = gsap.timeline({ onComplete: onDone })
    closeRef.current = tl
    // ค้างให้เห็นห่วงเต็ม ๆ ก่อน แล้วค่อยแตกเป็นขีดตามเฟรมสุดท้ายของคลิป
    // ที่ว่างตรงนี้จำเป็น — ถ้าแตกทันทีที่วงประกอบเสร็จ คนดูจะไม่ทันเห็นว่ามันเป็นห่วงอะไร
    tl.to({}, { duration: 0.9 })
    tl.to(drive.current, {
      shatter: 0.58,
      duration: 0.55,
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

      {/* วงโคจรขององก์แรก — ชิ้นใหญ่กับชิ้นเล็กอยู่ในวงเดียวกัน ต่างแค่รัศมีตั้งต้น
          มุมของแต่ละชิ้นตรึงไว้ในสไตล์ ส่วนการหมุนกับการหดรัศมีทำในไทม์ไลน์ */}
      <div className="intro-orbit" aria-hidden>
        {[...ORBIT_BIG, ...ORBIT_RING].map((o, i) => (
          <span
            key={i}
            className={`intro-orbit-slot ${i < ORBIT_BIG.length ? 'intro-orbit-big' : 'intro-orbit-ring'}`}
            style={{
              // @ts-expect-error ตัวแปร CSS — gsap ทวีนค่านี้ต่อชิ้น
              '--r': `${o.r}px`,
              transform: `translate(-50%, -50%) rotate(${o.a}deg) translateY(calc(var(--r) * -1)) rotate(${-o.a}deg)`,
              fontSize: `${o.size}px`,
            }}
          >
            <span
              className="intro-orbit-ch"
              style={{ color: o.c, background: o.bg ?? 'transparent' }}
            >
              {o.t}
            </span>
          </span>
        ))}
      </div>

      {/* ไทล์ที่วงยุบรวมเป็น แล้วอยู่ยาวจนภูมิประเทศก่อตัว (f047-f090)
          บล็อกไล่เฉดฟ้า + อักขระข้าง ๆ ที่เปลี่ยน 1 → 2 → % */}
      <span className="intro-pct" aria-hidden>
        <i />
        <span className="intro-pct-ch">1</span>
      </span>

      {import.meta.env.DEV && <IntroDebug tl={tlRef} drive={drive} onHoldChange={setHold} />}
    </div>
  )
}
