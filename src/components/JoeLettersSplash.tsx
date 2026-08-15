import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'

/**
 * สปแลชตัวอักษร JOE — port ตรงจาก `src/components/SplashScreen.vue` ของ branch 2026
 *
 * ตัวอักษรถูกประกอบขึ้นทีละชิ้นแทนที่จะ fade เข้ามาทั้งคำ:
 *   E  เผยจากซ้ายไปขวาด้วย clip rect แล้วค่อยงอกส่วนหน้า/ช่องกลาง/ปากตัว E
 *   O  ยิงจุดกลมจากขอบ E วิ่งมาหยุดกลางที่ของตัว O แล้วแตกเป็นกลีบสี่กลีบ หมุนเข้าที่
 *   J  ตัวถังหล่นลงมาจากบน แล้วเปิดมุมซ้ายบนกับตะขอด้านล่าง
 * ทั้งกลุ่มเลื่อนถอยหลังก่อน แล้วดีดกลับเข้าที่ — ให้จังหวะรวมมีน้ำหนัก
 *
 * ต่างจาก `JoeSplash.tsx` (ของ /mascot) ซึ่งเป็นคนละงาน: ตัวนั้น morph ตัวอักษร
 * เป็นทรงเรขาคณิตแล้วส่งต่อให้ mesh 3D อันนี้จบที่ตัวอักษรอย่างเดียว
 */

type JoeLettersSplashProps = {
  onDone: () => void
  /**
   * ฉากข้างหลังพร้อมให้ดูแล้วหรือยัง — สปแลชจะไม่เปิดออกจนกว่าจะเป็น true
   * ไม่ส่งมา = ไม่ต้องรอใคร เล่นจบแล้วเปิดเลย (ใช้กับหน้าที่ไม่มีของหนักให้โหลด)
   */
  ready?: boolean
  /**
   * ตัวอักษรประกอบเสร็จแล้ว — ยิงก่อน onDone
   *
   * ผู้เรียกใช้จังหวะนี้เริ่มโหลดของหนัก: ระหว่างที่ตัวอักษรยังเล่นอยู่ main thread
   * ต้องว่าง ไม่งั้นแอนิเมชันกระตุก (วัดแล้ว: mount ฉาก 3D พร้อมกันเหลือ 27 เฟรม
   * ใน 7 วินาที เฟรมแย่สุด 4.1 วินาที เทียบกับหน้าเปล่าที่ได้ 113 เฟรม)
   */
  onIntroDone?: () => void
}

/**
 * กันค้างจอ ถ้าฉากโหลดไม่สำเร็จ (เน็ตหลุด / GLB พัง / WebGL ใช้ไม่ได้)
 * ถึงเวลานี้แล้วยังไม่พร้อมก็เปิดออก ให้คนเห็นหน้าเว็บดีกว่าค้างอยู่กับโลโก้
 */
const READY_TIMEOUT = 12000

/** ตำแหน่ง/มุมปลายทางของกลีบตัว O — ทุกกลีบเริ่มซ้อนกันที่ (122, 42) แล้วแยกออกมา */
const PETALS = [
  { cx: 117.717, cy: 62.9484, rot: 59.365 },
  { cx: 126.342, cy: 20.4592, rot: 59.365 },
  { cx: 99.732, cy: 41.2846, rot: 28.5804 },
  { cx: 144.851, cy: 41.4516, rot: 28.5804 },
]

const INK = '#FD5000'
const PAPER = '#F1F0EE'

export function JoeLettersSplash({ onDone, ready = true, onIntroDone }: JoeLettersSplashProps) {
  const scene = useRef<HTMLDivElement>(null)
  // onDone อาจเป็นฟังก์ชันใหม่ทุก render ของพ่อ — ถ้าใส่ใน deps ไทม์ไลน์จะถูกสร้างใหม่กลางทาง
  const done = useRef(onDone)
  done.current = onDone
  const introDone = useRef(onIntroDone)
  introDone.current = onIntroDone
  // ไทม์ไลน์ประกอบตัวอักษรเล่นจบแล้วหรือยัง — แยกจาก "ฉากพร้อม" คนละเรื่องกัน
  const [built, setBuilt] = useState(false)
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), READY_TIMEOUT)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const root = scene.current
    if (!root) return

    const ctx = gsap.context(() => {
      const petals = gsap.utils.toArray<SVGEllipseElement>('.sp-o-petal')

      // ท่าตั้งต้น
      gsap.set('#sp-e-clip-rect', { attr: { x: 174, width: 4 } })
      gsap.set('#sp-e-counter', { scaleX: 0, svgOrigin: '185 26' })
      gsap.set('#sp-e-opening', { x: 60 })
      gsap.set('#sp-e-front', { scaleX: 0, svgOrigin: '232 24.5' })
      gsap.set('#sp-o-bullet', { opacity: 0, attr: { cx: 173, r: 1 } })
      petals.forEach((el) => gsap.set(el, { attr: { cx: 122, cy: 42 }, rotation: 0, opacity: 0 }))
      gsap.set('#sp-j-body', { y: -100 })
      gsap.set('#sp-j-mask', { scale: 0, svgOrigin: '34 31' })
      gsap.set('#sp-j-corner', { scale: 0, svgOrigin: '0 0' })
      gsap.set('#sp-slide-group', { x: -80 })

      // จบแค่ "ประกอบตัวอักษรเสร็จ" — ส่วนจางออกย้ายไปอยู่ใน effect ที่รอฉากพร้อม
      const tl = gsap.timeline({
        onComplete: () => {
          setBuilt(true)
          introDone.current?.()
        },
      })

      // ทั้งกลุ่มถอยแล้วดีดกลับ
      tl.to('#sp-slide-group', { x: -60, duration: 1.18, ease: 'power1.in' }, 0)
      tl.to('#sp-slide-group', { x: 0, duration: 2.06, ease: 'power1.out' }, 1.17)

      // E
      tl.to('#sp-e-clip-rect', { attr: { width: 77 }, duration: 1.32, ease: 'power2.inOut' }, 0)
      tl.to('#sp-e-counter', { scaleX: 1, duration: 0.66, ease: 'power2.inOut' }, 0.4)
      tl.to('#sp-e-front', { scaleX: 1, duration: 0.4, ease: 'power2.inOut' }, 0.66)
      tl.to('#sp-e-opening', { x: 0, duration: 0.8, ease: 'power2.inOut' }, 0.46)
      tl.to('#sp-e-clip-rect', { attr: { x: 162 }, duration: 0.39, ease: 'power2.inOut' }, 0.93)

      // O — จุดกลมวิ่งเข้ามาแล้วแตกเป็นกลีบ
      tl.set('#sp-o-bullet', { opacity: 1 }, 1.12)
      tl.to('#sp-o-bullet', { attr: { cx: 122, r: 20 }, duration: 0.51, ease: 'power2.out' }, 1.12)
      tl.to('.sp-o-petal', { opacity: 1, duration: 0.15, ease: 'power2.inOut' }, 1.42)
      petals.forEach((el, i) => {
        const p = PETALS[i]
        tl.to(el, { attr: { cx: p.cx, cy: p.cy }, duration: 0.72, ease: 'power2.inOut' }, 1.32)
      })
      tl.to('#sp-o-bullet', { opacity: 0, duration: 0.2, ease: 'power2.inOut' }, 1.57)
      petals.forEach((el, i) => {
        const p = PETALS[i]
        tl.to(
          el,
          {
            rotation: p.rot,
            svgOrigin: `${p.cx} ${p.cy}`,
            duration: 1.4,
            ease: 'power2.inOut',
          },
          1.42,
        )
      })

      // J
      tl.to('#sp-j-body', { y: 0, duration: 1.74, ease: 'power2.inOut' }, 0.87)
      tl.to('#sp-j-corner', { scale: 1, duration: 1.45, ease: 'power2.inOut' }, 1.43)
      tl.to('#sp-j-mask', { scale: 1, duration: 1.4, ease: 'power2.inOut' }, 1.6)

      // ค้างไว้ให้อ่านออก — ตัวอักษรอยู่ครบตรงนี้ รอสัญญาณว่าฉากพร้อมค่อยเปิดออก
      // ทวีนหลอกต้องมี property จริงให้ขยับ ไม่งั้น gsap ไม่นับเป็นทวีนแล้วไทม์ไลน์ไม่ยอมจบ
      tl.to({ hold: 0 }, { hold: 1, duration: 0.6 }, 3)
    }, root)

    return () => ctx.revert()
  }, [])

  /**
   * เปิดออกเมื่อครบสองอย่าง: ตัวอักษรประกอบเสร็จ และฉากข้างหลังพร้อม
   * อันไหนเสร็จทีหลังเป็นตัวกำหนดจังหวะ — โหลดเร็วก็ไม่ตัดแอนิเมชันทิ้ง
   * โหลดช้าก็ค้างโลโก้ไว้แทนที่จะเปิดไปเจอจอเปล่า
   */
  useEffect(() => {
    const root = scene.current
    if (!root || !built || !(ready || waited)) return
    const tl = gsap.timeline({ onComplete: () => done.current() })
    tl.to(root.querySelector('#sp-letters-scene'), {
      opacity: 0,
      duration: 0.4,
      ease: 'power1.in',
    })
    tl.to(root, { opacity: 0, duration: 0.5, ease: 'power1.inOut' }, 0.2)
    return () => {
      tl.kill()
    }
  }, [built, ready, waited])

  return (
    <div
      ref={scene}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: PAPER,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        id="sp-letters-scene"
        viewBox="-10 -10 259 104"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Joe"
        style={{ width: 'clamp(200px, 40vw, 480px)', height: 'auto', overflow: 'hidden' }}
      >
        <defs>
          <clipPath id="sp-e-reveal">
            <rect id="sp-e-clip-rect" x="174" y="0" width="4" height="84" />
          </clipPath>
        </defs>

        <g id="sp-slide-group">
          {/* J */}
          <g>
            <path
              id="sp-j-body"
              d="M0 0H81V43.5C81 65.8675 62.8675 84 40.5 84V84C18.1325 84 0 65.8675 0 43.5V0Z"
              fill={INK}
            />
            <path
              id="sp-j-mask"
              d="M41 55C36.5817 55 33 51.4183 33 47L33 30L49 30L49 47C49 51.4183 45.4183 55 41 55V55Z"
              fill={PAPER}
            />
            <rect id="sp-j-corner" x="-1" y="-1" width="35" height="32" fill={PAPER} />
          </g>

          {/* O */}
          <g id="sp-o-petals">
            <ellipse className="sp-o-petal" cx="117.717" cy="62.9484" rx="15.1684" ry="18.4624" fill={INK} />
            <ellipse className="sp-o-petal" cx="126.342" cy="20.4592" rx="15.1684" ry="18.4624" fill={INK} />
            <ellipse className="sp-o-petal" cx="99.732" cy="41.2846" rx="14.1752" ry="19.4078" fill={INK} />
            <ellipse className="sp-o-petal" cx="144.851" cy="41.4516" rx="14.1752" ry="19.4078" fill={INK} />
          </g>
          <circle id="sp-o-bullet" cx="173" cy="42" r="1" fill={INK} />

          {/* E */}
          <g clipPath="url(#sp-e-reveal)">
            <path d="M174 2H232V81H174V65H162V18H174Z" fill={INK} />
            <rect id="sp-e-front" x="231" y="10" width="8" height="29" fill={INK} />
            <rect id="sp-e-counter" x="185" y="18" width="35" height="16" rx="8" fill={PAPER} />
            <path
              id="sp-e-opening"
              d="M185 57C185 52.5817 188.582 49 193 49H239V65H193C188.582 65 185 61.4183 185 57Z"
              fill={PAPER}
            />
          </g>
        </g>
      </svg>
    </div>
  )
}
