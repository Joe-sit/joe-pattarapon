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
  /**
   * รูเริ่มเปิดแล้ว — ยิงตอน "เริ่ม" เปิด ไม่ใช่ตอนจบ
   *
   * ฉากข้างหลังต้องเริ่มขยับพร้อมกับที่รูบาน คนดูถึงจะรู้สึกว่าพุ่งเข้าไปในฉาก
   * ถ้ารอให้สปแลชหายก่อนค่อยเริ่ม ภาพที่ได้คือรูเปิดไปเจอ "ภาพนิ่ง" แล้วค่อยขยับ
   */
  onOpenStart?: () => void
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

/** กลางตัว O ในพิกัด viewBox — กลีบทั้งสี่วางล้อมจุดนี้ */
const O_CENTRE = { x: 122, y: 42 }
/** รัศมีกลีบแต่ละใบ — ต้องตรงกับ <ellipse> ในมาร์กอัป หน้ากากถึงจะทับกลีบส้มได้พอดี */
const PETAL_R = [
  { rx: 15.1684, ry: 18.4624 },
  { rx: 15.1684, ry: 18.4624 },
  { rx: 14.1752, ry: 19.4078 },
  { rx: 14.1752, ry: 19.4078 },
]

/**
 * รัศมีจานดำในหน้ากาก หน่วย viewBox
 *
 * ไม่ใช่ขนาดของรู — รูคือ "จานนี้ลบด้วยกลีบทั้งสี่" ซึ่งได้รูปสี่แฉกของช่องกลางตัว O
 * จานต้องใหญ่พอจะกินถึงขอบในของกลีบทุกใบ (กลีบไกลสุดขอบในอยู่ที่ ~23 จากจุดกลาง)
 * ใหญ่เกินไปก็ไม่เป็นไร ส่วนที่เกินถูกกลีบขาวทับกลับหมด
 */
const O_DISC = 24

export function JoeLettersSplash({
  onDone,
  ready = true,
  onIntroDone,
  onOpenStart,
}: JoeLettersSplashProps) {
  const scene = useRef<HTMLDivElement>(null)
  // ชั้นกระดาษ แยกจากตัวอักษร เพราะชั้นนี้ตัวเดียวที่โดนเจาะรู
  const holeGroup = useRef<SVGGElement>(null)
  const maskDisc = useRef<SVGCircleElement>(null)
  const maskPetals = useRef<(SVGEllipseElement | null)[]>([])
  // onDone อาจเป็นฟังก์ชันใหม่ทุก render ของพ่อ — ถ้าใส่ใน deps ไทม์ไลน์จะถูกสร้างใหม่กลางทาง
  const done = useRef(onDone)
  done.current = onDone
  const introDone = useRef(onIntroDone)
  introDone.current = onIntroDone
  const openStart = useRef(onOpenStart)
  openStart.current = onOpenStart
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
   *
   * ท่าเปิด: มุดเข้าไปใน "ช่องกลางตัว O"
   *
   * พื้นกระดาษไม่ได้จางออก — มันถูกเจาะรูตรงกลางตัว O แล้วรูนั้นบานออกจนกินทั้งจอ
   * ฉาก 3D ที่ mount รออยู่ข้างหลังจึงโผล่มาทางรูนั้นตั้งแต่วินาทีแรก ไม่ใช่โผล่ทีเดียว
   * ตอนสปแลชหาย พร้อมกันนั้นตัวอักษรถูกซูมเข้าโดยยึดจุดเดียวกับรู — ตาจึงอ่านว่า
   * "กล้องพุ่งเข้าไปในตัว O" ไม่ใช่ "โลโก้ขยายแล้วหายไป"
   *
   * เจาะด้วย mask ที่เป็น radial-gradient หยุดคมสองสต็อป ไม่ใช่ clip-path เพราะ
   * ตัวเลขที่ต้องขยับมีตัวเดียว (รัศมี) และเป็น CSS variable ที่ gsap ทวีนได้ตรง ๆ
   * ทั้งชั้นวิ่งบน compositor ไม่ต้อง reflow ทุกเฟรม
   */
  useEffect(() => {
    const root = scene.current
    const hole = holeGroup.current
    const svg = root?.querySelector<SVGSVGElement>('#sp-letters-scene')
    if (!root || !hole || !svg || !built || !(ready || waited)) return

    // จุดกลางตัว O ในพิกัดจอ — คิดจาก matrix จริงของ SVG ไม่ใช่จากขนาดที่เดาเอา
    // (ตัว svg กว้างตาม clamp() ของ viewport ย่อ/ขยายจอแล้วเลขเปลี่ยนทุกครั้ง)
    const ctm = svg.getScreenCTM()
    const p = svg.createSVGPoint()
    p.x = O_CENTRE.x
    p.y = O_CENTRE.y
    const at = ctm ? p.matrixTransform(ctm) : { x: innerWidth / 2, y: innerHeight / 2 }
    const unit = ctm ? Math.abs(ctm.a) : 1
    // รัศมีที่ต้องบานถึงเพื่อกลืนทั้งจอ = ระยะจากจุดนั้นไปมุมที่ไกลที่สุด
    const far = Math.hypot(
      Math.max(at.x, innerWidth - at.x),
      Math.max(at.y, innerHeight - at.y),
    )

    // วางกลีบใน mask ให้ทับกลีบส้มบนจอพอดี — ตำแหน่ง/มุมสุดท้ายอ่านจาก PETALS ชุดเดียวกับที่
    // ไทม์ไลน์ประกอบตัวอักษรใช้ ตอนถึงจังหวะนี้กลีบเข้าที่หมดแล้ว
    PETALS.forEach((petal, i) => {
      const el = maskPetals.current[i]
      if (!el) return
      el.setAttribute('cx', `${at.x + (petal.cx - O_CENTRE.x) * unit}`)
      el.setAttribute('cy', `${at.y + (petal.cy - O_CENTRE.y) * unit}`)
      // เผื่อกลีบในหน้ากากอ้วนกว่ากลีบจริง 3% — ขอบสองชั้นไม่มีทางตรงกันเป๊ะระดับพิกเซล
      // ไม่เผื่อแล้วจะเห็นเส้นเทาบาง ๆ เล็ดออกมาตามขอบกลีบ
      el.setAttribute('rx', `${PETAL_R[i].rx * unit * 1.03}`)
      el.setAttribute('ry', `${PETAL_R[i].ry * unit * 1.03}`)
      el.setAttribute(
        'transform',
        `rotate(${petal.rot} ${at.x + (petal.cx - O_CENTRE.x) * unit} ${at.y + (petal.cy - O_CENTRE.y) * unit})`,
      )
    })
    const disc = maskDisc.current
    disc?.setAttribute('cx', `${at.x}`)
    disc?.setAttribute('cy', `${at.y}`)
    disc?.setAttribute('r', `${O_DISC * unit}`)

    /**
     * รูกับตัวอักษรถูกขับด้วยตัวเลขตัวเดียวกัน (zoom)
     *
     * ในหน้ากากมีวงกลมดำหนึ่งใบกับกลีบขาวสี่กลีบทับอยู่ — ส่วนที่เหลือเป็นดำ
     * จึงเป็น "ช่องว่างกลางตัว O" เป๊ะ ๆ ทั้งสี่แฉก ไม่ใช่วงกลม แล้วทั้งกลุ่มถูกซูมด้วย
     * สเกลเดียวกับตัวอักษร รูจึงบานออกโดยคงรูปช่องของตัว O ไว้ตลอดทาง
     *
     * ถ้าแยกกันทวีน รูจะโตเร็วกว่าที่ตัว O ขยาย เห็นเป็นวงกลมเทากินทับกลีบส้ม
     */
    const box = svg.getBoundingClientRect()
    const zoom = { z: 1 }
    openStart.current?.()
    /**
     * รูต้องบานจนคลุมจอ "ก่อน" ไทม์ไลน์จบ แล้วค้างไว้อีกครู่
     *
     * ของเดิมรูถึงขอบจอพอดีวินาทีที่ splash ถูกถอดออก ภาพเลยตัดห้วน — กำลังพุ่งอยู่ดี ๆ
     * ก็เปลี่ยนเป็นฉากเต็มจอทันที ให้เวลาส่วนสุดท้ายเป็นฉากล้วน ๆ ตาจะได้ตามทัน
     */
    const tl = gsap.timeline({ onComplete: () => done.current() })
    tl.to(
      zoom,
      {
        z: (far * 1.25) / (O_DISC * unit),
        duration: 1.05,
        ease: 'power2.in',
        onUpdate: () => {
          hole.setAttribute(
            'transform',
            `translate(${at.x} ${at.y}) scale(${zoom.z}) translate(${-at.x} ${-at.y})`,
          )
          gsap.set(svg, {
            scale: zoom.z,
            transformOrigin: `${at.x - box.left}px ${at.y - box.top}px`,
          })
        },
      },
      0,
    )
    // ตัวอักษรจางท้าย ๆ เท่านั้น — จางเร็วกว่านี้แล้วจะเห็นเป็นโลโก้หายไปเฉย ๆ
    tl.to(svg, { opacity: 0, duration: 0.3, ease: 'power1.in' }, 0.68)
    // ช่วงท้ายไม่มีอะไรให้ดูนอกจากฉาก — ทวีนหลอกไว้กันไทม์ไลน์จบก่อนเวลา
    tl.to({ hold: 0 }, { hold: 1, duration: 0.35 }, 1.05)
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/*
        พื้นกระดาษ + หน้ากากรูปช่องตัว O

        รู = "จานดำ ลบด้วยกลีบขาวสี่กลีบ" จึงได้รูปสี่แฉกของช่องกลางตัว O ไม่ใช่วงกลม
        ตอนยังไม่เปิดฉาก จานมีรัศมี 0 = ไม่มีรู กระดาษบังทั้งจอตามปกติ
        พิกัดทุกตัวเป็นพิกเซล (svg ไม่มี viewBox) ตัวเลขจริงถูกเซ็ตตอนเริ่มเปิดฉาก
        เพราะต้องอ่านจากขนาดจริงของตัวอักษรบนจอ
      */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        aria-hidden
      >
        <defs>
          <mask id="sp-hole-mask" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            <g ref={holeGroup}>
              <circle ref={maskDisc} cx="0" cy="0" r="0" fill="#000" />
              {PETALS.map((_, i) => (
                <ellipse
                  key={i}
                  ref={(el) => {
                    maskPetals.current[i] = el
                  }}
                  cx="0"
                  cy="0"
                  rx="0"
                  ry="0"
                  fill="#fff"
                />
              ))}
            </g>
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill={PAPER} mask="url(#sp-hole-mask)" />
      </svg>
      <svg
        id="sp-letters-scene"
        viewBox="-10 -10 259 104"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Joe"
        // position: relative — ชั้นกระดาษเป็น absolute ซึ่งวาดทีหลังเนื้อหาในโฟลว์เสมอ
        // ไม่ตั้งอันนี้ ตัวอักษรจะถูกกระดาษทับจนมองไม่เห็นทั้งแอนิเมชัน
        style={{
          position: 'relative',
          width: 'clamp(200px, 40vw, 480px)',
          height: 'auto',
          overflow: 'hidden',
        }}
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
