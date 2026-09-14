import { Suspense, lazy, useEffect, useRef } from 'react'
import { WIPE_FULL } from '@/components/CloudWipe'
import { cursorPress } from '@/cursorguide/press'
import { portalBox } from '@/sections/whatidocard/stageTuner'
import { useCursorStop } from '@/cursorguide/useCursorStop'

const TellProps = lazy(() => import('./TellProps').then((m) => ({ default: m.TellProps })))

/**
 * ช่วงเล่าเรื่องคั่นระหว่างจอแรกกับจอ "สิ่งที่ทำ" — พิมพ์ถาม AI
 *
 * เล่าด้วยช่องพิมพ์ของผู้ชมเอง: คำถามถูกพิมพ์ลงช่อง ส่ง แล้วคำตอบขึ้นไปอยู่ข้างบน
 * คำถามสุดท้ายไม่ถูกตอบด้วยตัวหนังสือ — เคอร์เซอร์นำสายตากดปุ่มส่ง แล้วปุ่มนั้นถูกดึงออก
 * เป็นหน้าต่างของจอถัดไป (ท่า genie) การเปลี่ยนจอจึงเป็นคำตอบของคำถามที่เพิ่งส่ง
 *
 * ### ข้อความมาจากไหน
 *
 * คำตอบยกจากข้อความจริงที่มีอยู่แล้วในหน้านี้ (ประโยคปิดของจอแรกใน i18n/dict) ไม่ได้แต่ง
 * ประวัติขึ้นใหม่ ส่วนคำถามเป็นคำถาม ไม่ใช่ข้อมูลเกี่ยวกับใคร
 *
 * ### พื้นหลัง
 *
 * เริ่มที่ขาวสนิทเท่ากับม่านเมฆที่ส่งมา (ดู WIPE_FULL ใน components/CloudWipe) แล้วค่อย
 * ไล่เป็นฟ้าอ่อนตามระยะเลื่อน — ถ้าตั้งเป็นฟ้าตั้งแต่ต้น รอยต่อกับม่านขาวจะเห็นเป็นเส้นคาด
 *
 * ### ของประดับ
 *
 * ของที่ลอยรอบช่องพิมพ์เป็นของชิ้นเดิมจากจอแรก (ลูกโลก ถาดสี สวิตช์ หน้าต่างซ้อน ต้นไม้)
 * ไม่ได้ปั้นใหม่ให้เหมือน — ดู ./TellProps ซึ่งเป็นแคนวาสแยกที่ประกอบของพวกนั้น
 *
 * ### ทำไมตรึงแบบ fixed ไม่ใช่ sticky
 *
 * sticky ต้องเหลือระยะให้แผ่นไถลออกเต็มหนึ่งจอเสมอ ระหว่างนั้นของเลื่อนหายไปแล้วแต่จอ
 * ถัดไปยังไม่มา เห็นเป็นจอเปล่า ๆ หนึ่งจอเต็ม (วัดมาแล้ว) แบบ fixed คือเล่าจบแล้วปิดทิ้ง
 * ตรงนั้น จอถัดไปมาถึงพอดี
 *
 * เขียน transform/opacity/ข้อความ ลง DOM ใน rAF ไม่ผ่าน state: ค่าพวกนี้เปลี่ยนทุกเฟรม
 * ที่เลื่อน ถ้าเป็น state หน้าทั้งหน้า (รวมแคนวาส 3D) จะ re-render ตามการเลื่อน
 */

/** ความสูงของช่วงนี้ (เท่าของความสูงจอ) = ความช้าของการเล่า */
const TELL_VH = 3.4

/**
 * บทสนทนา: พิมพ์คำถาม → ส่ง → คำตอบขึ้นไปอยู่ข้างบน
 *
 * ท่อนสุดท้ายเป็นคำสั่ง ไม่ใช่คำถาม คำตอบของมันเป็น "ไฟล์" ที่ถูกสร้างขึ้นแล้วส่งกลับมา
 * (ดู FILE_AT) ไฟล์ใบนั้นคือของที่ถูกกดแล้วยืดออกเป็นจอถัดไป
 */
const ASK: { q: string; a: string | null }[] = [
  { q: 'who is this?', a: 'Joe — I love crafting valuable things with passionate people.' },
  { q: 'generate a summary of what you do', a: null },
]

/** จังหวะของแต่ละท่อน (สัดส่วนของช่วงนี้): เริ่มพิมพ์ / พิมพ์จบ / กดส่ง */
const BEATS = [
  /* เริ่มพิมพ์หลังของข้างในโผล่ครบ (ดู BAR_FILL) — ช่องที่ยังประกอบตัวอยู่แล้วมีตัวอักษรวิ่ง
     อ่านเป็นสองเรื่องทับกัน ช่องว่างสั้น ๆ ก่อนพิมพ์คือช่วงที่เห็นข้อความชวนพิมพ์ */
  { type: 0.36, done: 0.48, send: 0.52 },
  { type: 0.57, done: 0.68, send: 0.72 },
]

/** ช่วงที่ฟ้าไล่เข้ามาแทนขาวของม่านเมฆ */
/* ฟ้าต้องมาก่อนกล้องเริ่มถอย: การ์ดที่หลุดโฟกัสเป็นสีขาว ถ้าพื้นยังขาวอยู่มันหายไปเลย
   มองไม่เห็นว่ามีอะไรอยู่ในเฟรม (วัดมาแล้ว — การ์ดกว้าง 1689px อยู่ตรงนั้น แต่ภาพว่างเปล่า) */
const SKY_TO = 0.05
/**
 * จังหวะของท่อนท้าย: กำลังสร้าง → ไฟล์ส่งกลับมา → เคอร์เซอร์กดไฟล์ → ไฟล์ยืดเป็นหน้าต่าง
 *
 * "กำลังสร้าง" ต้องกินระยะพอที่ตาอ่านออกว่ามันกำลังทำอะไรอยู่ ก่อนของจริงจะมาถึง ไม่ใช่
 * ขึ้นแล้วหายในเฟรมถัดไป — ช่วงพวกนี้จึงเว้นห่างกันเป็นก้อน ไม่ได้ต่อกันติด
 */
const GEN_AT = 0.73
const FILE_AT = 0.81
const PRESS_AT = 0.89
/** ช่วงที่ไฟล์ถูกดึงออกเป็นหน้าต่าง (genie) */
const MORPH_AT = 0.91

/**
 * กรอบปลายทางของ genie = กรอบของหน้าต่างใบพอร์ทัลในจอถัดไป
 *
 * ไม่ได้พิมพ์ตัวเลขไว้ที่นี่: จอนั้นวางหน้าต่างด้วยค่าที่ลากได้จากแผงจูน (ย้าย/ย่อได้) กรอบ
 * จึงต้องคิดจากค่าชุดเดียวกันนั้น ไม่ใช่จากตัวเลขที่เคยวัดจากภาพแล้วพิมพ์ทับ — ดู portalBox
 * ใน sections/whatidocard/stageTuner ซึ่งเป็นโมดูลเปล่า (ไม่มี three ติดมา)
 *
 * ทุกค่าเป็นสัดส่วนของ *ความสูง* วิวพอร์ต เพราะจอนั้นใช้กล้องออร์โธที่ผูก zoom ไว้กับความสูง
 * ของกรอบ ความกว้างบนจอของหน้าต่างจึงมาจากความสูง ไม่ได้มาจากความกว้างของวิวพอร์ต
 */
/** ความสูงแถบหัว เทียบความสูงที่เห็นจริงของหน้าต่าง (BAR_T 0.95 / PORTAL_H 6.74) */
const CARD_BAR = 0.141

/**
 * ช่วงที่ของแต่ละชั้นเข้าฉาก (สัดส่วนของช่วงนี้) — ไล่กันเป็นชั้น ไม่ใช่มาพร้อมกันทั้งจอ
 *
 * ฟ้ามาก่อน แล้วของประดับ แล้วช่องพิมพ์ — ตาจึงได้เห็นฉากตั้งขึ้นทีละชั้นแทนที่จะเห็นทุกอย่าง
 * โผล่พร้อมกันในเฟรมเดียว (ซึ่งอ่านเป็น "ตัดภาพ" ไม่ใช่ "เข้าฉาก") ช่วงซ้อนกันโดยตั้งใจ
 */
const PROPS_IN: [number, number] = [0.0, 0.22]
/**
 * กล้องถอยออกจากช่องพิมพ์ — ท่าเข้าฉากของจอนี้
 *
 * เริ่มจากกล้องอยู่ *ใน* ช่องพิมพ์: ของใหญ่เต็มจอและหลุดโฟกัส แล้วกล้องถอยกลับมาจน
 * ทุกอย่างเข้าที่และคม ไม่ใช่กล่องที่โตขึ้นจากศูนย์ — ต่างกันที่ของไม่เคยเปลี่ยนรูป มันแค่
 * อยู่ใกล้เกินไป
 *
 * DOLLY = ช่วงที่กล้องถอย ของที่ "อยู่ใกล้กล้องกว่า" (แถวปุ่มกลมใต้การ์ด) เริ่มใหญ่กว่าและ
 * เข้าโฟกัสช้ากว่า — ระยะชัดลึกคนละระยะคือสิ่งที่ทำให้อ่านเป็นกล้อง ไม่ใช่การซูมรูปภาพ
 */
const DOLLY: [number, number] = [0.06, 0.3]
/** ขนาดตอนกล้องยังอยู่ใกล้สุด (เท่าของขนาดจริง) — การ์ด / แถวปุ่มกลม */
const NEAR_CARD = 2.45
const NEAR_DOCK = 3.1
/** เบลอสูงสุดตอนหลุดโฟกัส (พิกเซล) */
const BLUR_MAX = 16
/** ของข้างในเข้าโฟกัสห่างกันกี่ส่วนของช่วงนี้ต่อชิ้น */
const PART_STEP = 0.018

/** ปุ่มโหมดใต้ช่องพิมพ์ — ป้ายกับรูปที่วาดเอง (ดู Icon) */
const MODES = [
  { icon: 'clip', label: 'Attach' },
  { icon: 'globe', label: 'Web' },
  { icon: 'think', label: 'Think' },
] as const

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => v * v * (3 - 2 * v)
/**
 * ออกช้าแบบ quint — พุ่งตอนต้นแล้วคลานเข้าที่
 *
 * smoothstep เข้าช้าออกช้าเท่ากัน ของที่เข้าฉากด้วยมันจึงดู "ลอยขึ้นมา" ทั้งเส้น
 * ของที่เข้าฉากแล้วดูนุ่มคือของที่มาถึงเร็วแล้วใช้เวลาที่เหลือหยุด ไม่ใช่ของที่ช้าสม่ำเสมอ
 */
const outQuint = (v: number) => 1 - (1 - v) ** 5
const outCubic = (v: number) => 1 - (1 - v) ** 3
/** ความคืบหน้าในช่วงย่อยหนึ่ง */
const at = (p: number, [a, b]: [number, number]) => clamp01((p - a) / Math.max(0.01, b - a))

/**
 * รูปเส้นในช่องพิมพ์ — วาดเป็น SVG ในไฟล์นี้ ไม่ได้ลงชุดไอคอน
 *
 * มีสี่รูปและใช้ที่เดียว ชุดไอคอนหนึ่งชุดเพื่อสี่รูปคือน้ำหนักที่ผู้ชมต้องโหลด ขนาดผูกกับ
 * ตัวอักษร (1em) รูปจึงโตไปกับป้ายของมันเองโดยไม่ต้องตั้งขนาดสองที่
 */
function Icon({ kind }: { kind: string }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-[1.15em] shrink-0">
      {kind === 'clip' && <path {...p} d="M8.5 12.5l5.2-5.2a2.6 2.6 0 013.7 3.7l-6.6 6.6a4 4 0 01-5.7-5.7l6.3-6.3" />}
      {kind === 'globe' && (
        <>
          <circle {...p} cx="12" cy="12" r="8.2" />
          <path {...p} d="M3.8 12h16.4M12 3.8c2.4 2.3 2.4 13.9 0 16.4-2.4-2.5-2.4-14.1 0-16.4z" />
        </>
      )}
      {/* สมองในวงกลม — เส้นกลางกับสองปีก อ่านออกที่ขนาดเท่าตัวอักษร ต่างจากรูปหัวคนด้านข้าง
          ที่เส้นเยอะจนกลายเป็นขยุกขยิกเมื่อย่อ (วัดมาแล้ว) */}
      {kind === 'think' && (
        <>
          <circle {...p} cx="12" cy="12" r="7.6" />
          <path {...p} d="M12 7.4v9.2" />
          <path {...p} d="M12 7.4c-1.7 0-2.8 1-2.8 2.2 0 .8.5 1.2.5 1.9 0 .8-.7 1.2-.7 2.1 0 1.2 1.2 2.1 2.6 2.1" />
          <path {...p} d="M12 7.4c1.7 0 2.8 1 2.8 2.2 0 .8-.5 1.2-.5 1.9 0 .8.7 1.2.7 2.1 0 1.2-1.2 2.1-2.6 2.1" />
        </>
      )}
      {kind === 'clock' && (
        <>
          <circle {...p} cx="12" cy="12" r="8.2" />
          <path {...p} d="M12 7.6V12l3.2 1.9" />
        </>
      )}
      {kind === 'plus' && <path {...p} d="M12 5.4v13.2M5.4 12h13.2" />}
      {kind === 'doc' && (
        <>
          <path {...p} d="M13.4 3.6H7.2a1.6 1.6 0 00-1.6 1.6v13.6a1.6 1.6 0 001.6 1.6h9.6a1.6 1.6 0 001.6-1.6V8.4z" />
          <path {...p} d="M13.4 3.6v4.8h5M8.6 13h6.8M8.6 16.4h4.6" />
        </>
      )}
      {kind === 'expand' && <path {...p} d="M14.4 5.6h4v4M9.6 18.4h-4v-4M18.4 5.6L13 11M5.6 18.4L11 13" />}
      {/* หัวลูกศรกับประกาย — รูปของปุ่มส่งตามแบบ */}
      {kind === 'spark' && (
        <>
          <path {...p} d="M7.4 4.8l8.4 7.6-4.4.5-1.9 4.1z" />
          <path {...p} d="M17.6 5.2v2.6M18.9 6.5h-2.6" />
        </>
      )}
    </svg>
  )
}

/** ปุ่มกลมใต้การ์ด — พื้นขาวจาง ขอบบาง รูปเส้นข้างใน */
function Circle({ kind }: { kind: string }) {
  return (
    <span className="grid size-[clamp(40px,3.9vw,64px)] place-items-center rounded-full border border-white/80 bg-white/70 text-[clamp(15px,1.5vw,24px)] text-[#0d1b2a]">
      <Icon kind={kind} />
    </span>
  )
}

export function ScrollTell() {
  const section = useRef<HTMLElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const sky = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  /** กล่องช่องพิมพ์ — ตัวที่ยืดออกมาจากเส้น */
  const cardBox = useRef<HTMLDivElement>(null)
  /** แสงเรืองหลังกล่อง — ตัวที่ทำให้กล่องไม่ใช่แผ่นขาวบนพื้นฟ้า */
  const aura = useRef<HTMLDivElement>(null)
  /** แถวปุ่มกลมใต้การ์ด — ชั้นที่อยู่ใกล้กล้องกว่าการ์ด */
  const dock = useRef<HTMLDivElement>(null)
  /** บรรทัด "กำลังสร้าง" ของฝั่งที่ตอบ */
  const gen = useRef<HTMLDivElement>(null)
  /** ไฟล์ที่ถูกส่งกลับมา — จุดจอดของเคอร์เซอร์ และจุดเริ่มของ genie */
  const file = useRef<HTMLButtonElement>(null)
  /** กองแสงฟ้าที่มุมล่างขวา — จางเข้ามาพร้อมพื้นฟ้า */
  const glow = useRef<HTMLDivElement>(null)
  /** ชั้นของประดับ 3D — เข้าฉากและออกเป็นก้อนเดียว (ตัวมันเองเป็นแคนวาสแยก) */
  const props = useRef<HTMLDivElement>(null)
  /** ปุ่มส่ง — จุดจอดของเคอร์เซอร์ และจุดเริ่มของ genie */
  const send = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)

  /**
   * จุดจอดของเคอร์เซอร์นำสายตาที่ปุ่มส่ง — จังหวะตั้งเองเพราะของอยู่ในชั้นที่ตรึงไว้
   *
   * ชั้นนี้เป็น fixed ตำแหน่งบนหน้าของมันจึงเลื่อนไปตามการเลื่อนจอ ถ้าปล่อยให้จังหวะมาจาก
   * ตำแหน่ง เคอร์เซอร์จะวิ่งตามไม่ทัน จังหวะคิดจากผังจริง: จอแรกกินระยะ WIPE_FULL แล้ว
   * จอนี้กิน TELL_VH ต่อจากนั้น หัวอ่านอยู่กลางจอจึงบวกครึ่งจอ
   */
  useCursorStop(send, {
    id: 'tell-send',
    keyVh: WIPE_FULL + TELL_VH * BEATS[1].send + 0.5,
    dy: -0.1,
    size: 60,
    tilt: -6,
    lift: 80,
  })
  useCursorStop(file, {
    id: 'tell-file',
    keyVh: WIPE_FULL + TELL_VH * PRESS_AT + 0.5,
    dy: -0.1,
    size: 60,
    tilt: -6,
    lift: 80,
  })

  useEffect(() => {
    const sec = section.current
    const el = wrap.current
    if (!sec || !el) return undefined
    const rows = [...el.querySelectorAll<HTMLElement>('[data-answer]')]
    const type = el.querySelector<HTMLElement>('[data-typed]')
    const caret = el.querySelector<HTMLElement>('[data-caret]')
    const hint = el.querySelector<HTMLElement>('[data-hint]')
    /** ของข้างในช่องพิมพ์ + แถวปุ่มกลม — โผล่ไล่กันตามลำดับใน DOM */
    const parts = [...el.querySelectorAll<HTMLElement>('[data-part]')]
    let raf = 0
    const read = () => {
      raf = 0
      const vh = Math.max(1, window.innerHeight)
      const top = sec.getBoundingClientRect().top
      /** ความคืบหน้าในช่วงนี้ — 0 ตอนขอบบนแตะขอบบนจอ, 1 ตอนขอบล่างถึงขอบบนจอ */
      const p = clamp01(-top / Math.max(1, vh * TELL_VH))
      /* พ้นช่วงแล้วปิดทิ้ง — ของที่ตรึงแบบ fixed ไม่หายไปเองเหมือนของในโฟลว์ */
      el.style.visibility = p >= 1 || top > vh ? 'hidden' : ''
      const skyU = outCubic(clamp01(p / SKY_TO))
      if (sky.current) sky.current.style.opacity = skyU.toFixed(3)
      if (glow.current) glow.current.style.opacity = skyU.toFixed(3)

      /**
       * ท่อนที่กำลังเล่นคือท่อนล่าสุดที่ถึงคิวพิมพ์แล้ว — ข้อความในช่องเป็นของท่อนนั้น
       *
       * เขียน textContent ตรง ๆ ไม่ผ่าน state: หนึ่งโหนดข้อความต่อเฟรมถูกกว่า re-render
       * ของหน้าที่มีแคนวาส 3D อยู่หลายตัว
       */
      let i = 0
      while (i < BEATS.length - 1 && p >= BEATS[i + 1].type) i += 1
      const b = BEATS[i]
      const q = ASK[i].q
      const tu = clamp01((p - b.type) / Math.max(0.01, b.done - b.type))
      /* ท่อนที่ส่งแล้วและมีท่อนต่อไป = ช่องถูกล้าง รอพิมพ์อันใหม่ */
      const sent = p >= b.send && i < BEATS.length - 1
      const shown = sent ? '' : q.slice(0, Math.round(tu * q.length))
      if (type) type.textContent = shown
      /* ข้อความชวนพิมพ์หายทันทีที่มีตัวอักษรแรก — เหมือน placeholder ของช่องกรอกจริง */
      if (hint) hint.style.display = shown ? 'none' : ''
      /* เคอร์เซอร์พิมพ์โผล่เฉพาะตอนที่ยังมีอะไรให้พิมพ์ — ช่องที่พิมพ์จบแล้วไม่กระพริบรอ */
      if (caret) caret.style.opacity = sent || tu >= 1 ? '0' : '1'

      /** คำตอบขึ้นหลังท่อนของมันถูกส่งไปแล้ว */
      for (let k = 0; k < rows.length; k++) {
        const u = outQuint(clamp01((p - BEATS[k].send) / 0.16))
        rows[k].style.opacity = clamp01(u * 1.4).toFixed(3)
        /* ขึ้นมาพร้อมขยายจากเล็กนิดเดียว — จุดหมุนที่ขอบซ้ายเพราะบรรทัดชิดซ้าย ถ้าหมุนที่
           กลางบรรทัด ตัวอักษรฝั่งซ้ายจะไถลเข้ามาด้วยทั้งที่มันควรอยู่ที่เดิม */
        rows[k].style.transform = `translate3d(0, ${((1 - u) * 30).toFixed(1)}px, 0) scale(${(0.97 + 0.03 * u).toFixed(4)})`
      }

      /**
       * ของประดับเข้าฉาก — ก้อนเดียวทั้งชั้น ขยายจาก 0.9 พร้อมจาง
       *
       * เป็น transform/opacity ของ <div> ที่ครอบแคนวาส ไม่ใช่การขยับกล้องหรือสเกลกลุ่มใน
       * ฉาก: ค่าสองตัวนี้คอมโพสิเตอร์ทำให้ฟรี ส่วนการแตะฉากคือการวาดใหม่ทุกเฟรมที่เลื่อน
       */
      const pu2 = outQuint(at(p, PROPS_IN))

      /**
       * กล้องถอยออก — ระยะเดียวคุมทั้งขนาดและโฟกัสของทุกชั้น
       *
       * ทำที่ transform/filter ไม่ได้ทำที่ width/height: สองตัวหลังบังคับเบราว์เซอร์คิดผัง
       * ใหม่ทุกเฟรมที่เลื่อน และการ์ดที่ถูกยืดกรอบจะบีบตัวหนังสือข้างใน ซึ่งไม่ใช่สิ่งที่กล้อง
       * ทำกับภาพ
       */
      const cam = outQuint(at(p, DOLLY))

      /**
       * เคอร์เซอร์กดปุ่มส่งของท่อนสุดท้าย — ขึ้นแล้วลงเป็นครึ่งคลื่น ไม่ใช่กดแล้วค้าง
       *
       * ค่านี้ไปที่ตัวลูกศรของหน้า (cursorguide/press) ไม่ได้วาดอะไรเองที่นี่ ลูกศรจึงเป็น
       * ตัวเดิมที่กดของในจอนี้จริง ๆ
       */
      /* กดสองครั้ง: ปุ่มส่ง แล้วไฟล์ที่ถูกส่งกลับมา — คลื่นละครึ่งลูก เอาค่ามากสุดของสองคลื่น
         เพราะมันเป็นแรงกดของลูกศรตัวเดียวกัน ไม่ใช่สองตัว */
      const hit = (a: number) => {
        const u = clamp01((p - a) / 0.05)
        return u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI)
      }
      cursorPress.v = Math.max(hit(BEATS[BEATS.length - 1].send), hit(PRESS_AT))

      /**
       * บรรทัด "กำลังสร้าง" แล้วไฟล์ที่ถูกส่งกลับมา
       *
       * บรรทัดกำลังสร้างไม่หายตอนไฟล์มา — มันเป็นประวัติของการคุย ของที่หายไปตอนของใหม่มา
       * อ่านเป็น "ภาพถูกสลับ" ไม่ใช่ "บทสนทนาที่งอกต่อ"
       */
      if (gen.current) {
        const u = outQuint(clamp01((p - GEN_AT) / 0.08))
        gen.current.style.opacity = u.toFixed(3)
        gen.current.style.transform = `translate3d(0, ${((1 - u) * 22).toFixed(1)}px, 0)`
      }
      const fileEl = file.current
      if (fileEl) {
        const u = outQuint(clamp01((p - FILE_AT) / 0.1))
        fileEl.style.opacity = u.toFixed(3)
        fileEl.style.transform = `translate3d(0, ${((1 - u) * 26).toFixed(1)}px, 0) scale(${(0.92 + 0.08 * u).toFixed(4)})`
      }

      /**
       * genie: ปุ่มส่งถูกดึงออกมาเป็นหน้าต่าง
       *
       * สามอย่างที่ทำให้อ่านเป็น genie ไม่ใช่กล่องที่ค่อย ๆ โต: ขอบสี่ด้าน ease คนละจังหวะ
       * (บนถึงก่อน ล่างช้าสุด แผ่นจึงถูกยืด) / ก้นคอดเข้าหาจุดที่ถูกกดแล้วคลี่ออกด้วย
       * clip-path หลายจุดที่ไล่ด้วยเส้นโค้ง / เอียงแล้วคลายเป็นศูนย์
       *
       * ทำที่กรอบจริง (left/top/width/height) ไม่ใช่ scale เพราะสเกลไม่เท่ากันสองแกนจะ
       * บิดมุมโค้งกับเงาให้เห็นว่าเป็นของที่ถูกยืด ส่วน clip-path ไม่บิดอะไร มันแค่ตัด
       */
      const m = smooth(clamp01((p - MORPH_AT) / Math.max(0.01, 1 - MORPH_AT)))
      const cardEl = card.current
      const fromEl = file.current
      if (cardEl && fromEl) {
        const r = fromEl.getBoundingClientRect()
        const sx = r.left + r.width / 2
        const sy = r.top + r.height / 2
        const card = portalBox()
        const th = vh * card.vh
        const tw = th * card.ar
        const tl = (window.innerWidth - tw) / 2 + vh * card.dx
        const tt = (vh - th) / 2 + vh * card.dy
        const eTop = 1 - (1 - m) ** 3
        const eSide = 1 - (1 - m) ** 2
        const eBot = m ** 1.6
        const cTop = sy + (tt - sy) * eTop
        const cBot = sy + (tt + th - sy) * eBot
        const cLeft = sx + (tl - sx) * eSide
        const cRight = sx + (tl + tw - sx) * eSide
        cardEl.style.opacity = clamp01(m * 5).toFixed(3)
        cardEl.style.left = `${cLeft.toFixed(1)}px`
        cardEl.style.top = `${cTop.toFixed(1)}px`
        cardEl.style.width = `${Math.max(1, cRight - cLeft).toFixed(1)}px`
        cardEl.style.height = `${Math.max(1, cBot - cTop).toFixed(1)}px`
        cardEl.style.borderRadius = `${(10 + 34 * m).toFixed(1)}px`
        cardEl.style.transform = `skewX(${(-7 * (1 - m) * m * 4).toFixed(2)}deg)`

        /**
         * จุดคอดไม่ถูกหนีบให้อยู่ในกรอบ — ตอนต้นทางจุดที่ถูกกดอยู่นอกกรอบของแผ่นก็ได้
         * คิดจากปลายทางแทน: ที่ m = 1 ต้องเป็น 0% กับ 100% พอดีเสมอ ไม่ว่าจุดคอดอยู่ที่ไหน
         */
        const w2 = Math.max(1, cRight - cLeft)
        const cx = ((sx - cLeft) / w2) * 100
        const l2 = cx - 1.5 + (0 - (cx - 1.5)) * m
        const r2 = cx + 1.5 + (100 - (cx + 1.5)) * m
        const N = 8
        const lhs: string[] = []
        const rhs: string[] = []
        for (let k = 0; k <= N; k++) {
          const t = k / N
          const c = t * t
          const y = (t * 100).toFixed(2)
          lhs.push(`${(0 + (l2 - 0) * c).toFixed(2)}% ${y}%`)
          rhs.push(`${(100 + (r2 - 100) * c).toFixed(2)}% ${y}%`)
        }
        cardEl.style.clipPath = `polygon(${[...lhs, ...rhs.reverse()].join(',')})`
      }
      /* ช่องพิมพ์กับคำตอบจางหายตอนแผ่นเริ่มถูกดึงออกมา เหลือของชิ้นเดียวบนจอ */
      const out = smooth(clamp01(m * 2.2))
      if (bar.current) {
        bar.current.style.opacity = (1 - out).toFixed(3)
        bar.current.style.transform = `scale(${(1 - 0.03 * out).toFixed(4)})`
      }
      if (cardBox.current) {
        const c = cardBox.current
        /* จางเข้ามาเร็วกว่าที่กล้องถอย — ภาพหลุดโฟกัสต้อง *มีอยู่* ให้เห็นตั้งแต่ต้นทาง
           ไม่ใช่โผล่มาตอนเกือบคมแล้ว */
        c.style.opacity = clamp01(cam * 6).toFixed(3)
        c.style.transform = `scale(${(NEAR_CARD - (NEAR_CARD - 1) * cam).toFixed(4)})`
        c.style.filter = cam >= 1 ? 'none' : `blur(${((1 - cam) * BLUR_MAX).toFixed(2)}px)`
        /**
         * ผิวนอกของการ์ดไล่จากฟ้าอ่อนมาเป็นขาว
         *
         * การ์ดขาวที่หลุดโฟกัสบนพื้นฟ้าอ่อนคือก้อนหมอกที่แยกจากพื้นไม่ออก ตอนอยู่ใกล้กล้อง
         * มันจึงต้องมีสีของแสงรอบตัวติดอยู่ แล้วค่อยจางมาเป็นขาวเมื่อเข้าที่ (สีขอบเลนส์)
         */
        const k = 1 - cam
        c.style.background = `rgba(${(255 - 44 * k).toFixed(0)},${(255 - 22 * k).toFixed(0)},255,${(0.55 + 0.35 * k).toFixed(3)})`
      }
      /**
       * แถวปุ่มกลมอยู่ "ใกล้กล้อง" กว่าการ์ด — เริ่มใหญ่กว่าและเข้าโฟกัสช้ากว่า
       *
       * นี่คือระยะชัดลึก: ถ้าทุกชั้นถอยด้วยอัตราเดียวกันและคมพร้อมกัน มันคือการซูมรูปภาพ
       * ไม่ใช่กล้องที่ถอยออกจากฉากที่มีความลึก
       */
      if (dock.current) {
        const u = outQuint(at(p, [DOLLY[0] + 0.02, DOLLY[1] + 0.05]))
        dock.current.style.opacity = clamp01(u * 5).toFixed(3)
        dock.current.style.transform = `scale(${(NEAR_DOCK - (NEAR_DOCK - 1) * u).toFixed(4)})`
        dock.current.style.filter = u >= 1 ? 'none' : `blur(${((1 - u) * (BLUR_MAX + 6)).toFixed(2)}px)`
      }
      /**
       * แสงเรืองหลังกล่อง — สองก้อนสีของงานนี้ (ฟ้า/ส้ม) เบลอกว้าง
       *
       * เบลอถูกตั้งใน CSS ครั้งเดียว ต่อเฟรมขยับแค่ opacity/scale: เบลอ 60px ที่เปลี่ยนค่า
       * ทุกเฟรมคือการเบลอใหม่ทุกเฟรม ซึ่งแพงกว่าทุกอย่างในจอนี้รวมกัน
       */
      if (aura.current) {
        /**
         * บลูมของเลนส์ — แรงและกว้างกว่าการ์ดตอนกล้องยังอยู่ใกล้
         *
         * ต้องโตกว่าการ์ดตลอดทาง ไม่ใช่แค่โตกว่าตอนจบ: ตอนกล้องใกล้สุดการ์ดถูกขยาย 2.45
         * เท่า บลูมที่ขยายน้อยกว่านั้นจะหลบอยู่ใต้การ์ดทั้งก้อน ไม่เห็นสีอะไรเลย
         */
        const near = NEAR_CARD * 1.25
        const bloom = 0.4 + 0.6 * (1 - cam)
        aura.current.style.opacity = (clamp01(cam * 8) * (1 - out) * bloom).toFixed(3)
        aura.current.style.transform = `scale(${(near - (near - 1) * cam).toFixed(4)})`
      }
      /**
       * ของข้างในเข้าโฟกัสไล่กัน — ลูกแก้ว+ข้อความ แล้วปุ่มโหมด
       *
       * ไม่ขยับตำแหน่งและไม่เปลี่ยนขนาด: มันอยู่ในการ์ดซึ่งถูกกล้องพาถอยอยู่แล้ว ถ้าขยับเอง
       * อีกชั้นจะกลายเป็นของที่ไถลอยู่ในภาพที่กล้องกำลังถอย — สองการเคลื่อนที่ที่ไม่เกี่ยวกัน
       * ที่เพิ่มคือ *ความคม* ของแต่ละชิ้นซึ่งมาถึงไม่พร้อมกัน
       */
      for (let i = 0; i < parts.length; i++) {
        const raw = at(p, [DOLLY[0] + 0.03 + i * PART_STEP, DOLLY[1] + i * PART_STEP])
        parts[i].style.opacity = clamp01(raw * 2.6).toFixed(3)
        parts[i].style.filter = raw >= 1 ? 'none' : `blur(${((1 - outCubic(raw)) * 7).toFixed(2)}px)`
      }
      /* ของประดับออกตามช่องพิมพ์ ไม่งั้นจอถัดไป (ซึ่งไม่มีของพวกนี้) จะตัดเข้ามาแบบของหาย
         ทั้งกองในเฟรมเดียว */
      if (props.current) {
        props.current.style.opacity = (pu2 * (1 - smooth(clamp01(m * 1.5)))).toFixed(3)
        /* ออกด้วยการขยายเล็กน้อยตอนถูกดึงทิ้ง — ตอนเข้าไม่สเกลชั้นนี้ ของแต่ละชิ้นเข้าฉาก
           เองในฉาก (ดู ./TellProps) การขยายแคนวาสทั้งใบคือการขยายภาพที่เรนเดอร์แล้ว */
        props.current.style.transform = `scale(${(1 + 0.06 * m).toFixed(4)})`
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
    }
  }, [])

  return (
    <section
      ref={section}
      className="relative w-full"
      /* ขาวสนิทเท่าม่านเมฆที่ส่งมา — ฟ้าเป็นชั้นที่ไล่ทับข้างบน ไม่ใช่สีพื้นของ section */
      style={{ background: '#ffffff', height: `${TELL_VH * 100}svh` }}
    >
      {/**
       * ตรึงเต็มจอ z-10 — ต้องสูงกว่าจอถัดไป (ระดับ auto) ระหว่างที่ยังเล่าอยู่
       *
       * จอถัดไปพื้นทึบและเลื่อนเข้ามาจากขอบล่างตั้งแต่ยังเล่าไม่จบ ถ้าไม่ตั้ง z มันจะกิน
       * จอนี้จากด้านล่างขึ้นมา (วัดมาแล้ว) ชั้นนี้ปิดตัวเองตอนเล่าจบพอดีกับที่ขอบบนของจอ
       * ถัดไปมาถึงขอบบนจอ จึงไม่ไปค้างทับใคร
       */}
      <div
        ref={wrap}
        className="pointer-events-none fixed inset-0 z-10 overflow-clip"
        style={{ visibility: 'hidden', background: '#ffffff' }}
      >
        {/* ฟ้าไล่เข้ามาแทนขาว — ชั้นของตัวเองเพื่อให้ไล่ได้ ไม่ใช่สลับสีพื้นทีเดียว */}
        <div
          ref={sky}
          className="absolute inset-0"
          style={{
            opacity: 0,
            background: 'linear-gradient(180deg,#b9dcfb 0%,#d9ecfd 46%,#eef7ff 100%)',
          }}
        />

        {/**
         * แสงฟ้าจัดที่มุมล่างขวา — กองแสงหนึ่งกองตามแบบ
         *
         * เป็นชั้นแยกจากพื้นไล่สี เพราะมันต้องเป็นวงนุ่มที่ทับอยู่บนพื้น ไม่ใช่จุดสีในเส้นไล่สี
         * แนวตั้งเส้นเดียวกัน จางเข้ามาพร้อมฟ้า
         */}
        <div
          ref={glow}
          className="absolute inset-0"
          style={{
            opacity: 0,
            background:
              'radial-gradient(58vw 58vw at 88% 104%,#3fdcff 0%,rgba(90,226,255,0.55) 38%,rgba(190,240,255,0) 72%)',
          }}
        />

        {/* ของประดับ 3D ชิ้นเดิมจากจอแรก — ลอยรอบช่องพิมพ์ */}
        <div ref={props} className="absolute inset-0" style={{ opacity: 0, willChange: 'transform, opacity' }}>
          <Suspense fallback={null}>
            <TellProps />
          </Suspense>
        </div>

        <div className="absolute inset-0 grid place-items-center px-[6vw]">
          <div ref={bar} className="w-[min(100%,880px)]" style={{ opacity: 0, willChange: 'transform, opacity' }}>
            {/* คำตอบที่ถูกส่งแล้ว — อยู่เหนือช่องพิมพ์เหมือนประวัติการคุย */}
            {ASK.map((x) =>
              x.a ? (
                <p
                  key={x.q}
                  data-answer
                  className="mb-[clamp(14px,2.4svh,30px)] flex items-start gap-[12px] text-[clamp(17px,1.7vw,27px)] leading-snug font-medium text-[#16324d]"
                  style={{ opacity: 0 }}
                >
                  {/* เครื่องหมายประกายของฝั่งที่ตอบ — ตัวเดียวกับที่ใช้เป็นรูปตัวแทนของ Joe */}
                  <span className="mt-[0.25em] grid size-[1.15em] shrink-0 place-items-center rounded-full bg-[var(--v3-orange)] text-[0.62em] text-white">
                    ✦
                  </span>
                  {x.a}
                </p>
              ) : (
                /* ท่อนสุดท้ายไม่มีคำตอบเป็นตัวหนังสือ — คำตอบของมันคือจอถัดไป แต่ยังต้องมี
                   โหนดไว้ให้ลำดับของ [data-answer] ตรงกับ BEATS */
                <span key={x.q} data-answer style={{ display: 'none' }} />
              ),
            )}

            {/**
             * บรรทัด "กำลังสร้าง" — จุดสามจุดขยับด้วยนาฬิกาของตัวเอง ไม่ใช่ตามระยะเลื่อน
             *
             * ระยะเลื่อนคุมว่ามันโผล่ตอนไหน แต่การกระเพื่อมของจุดต้องเดินต่อแม้ผู้ชมหยุดนิ่ง
             * ไม่งั้น "กำลังทำงาน" กลายเป็นภาพนิ่งของจุดสามจุด
             */}
            <div
              ref={gen}
              className="mb-[clamp(14px,2.4svh,30px)] flex items-center gap-[12px] text-[clamp(17px,1.7vw,27px)] leading-snug font-medium text-[#16324d]"
              style={{ opacity: 0 }}
            >
              <span className="grid size-[1.15em] shrink-0 place-items-center rounded-full bg-[var(--v3-orange)] text-[0.62em] text-white">
                ✦
              </span>
              Generating
              <span className="flex items-center gap-[0.28em]">
                <i className="v3-typing-dot size-[0.22em] rounded-full bg-current" />
                <i className="v3-typing-dot size-[0.22em] rounded-full bg-current" />
                <i className="v3-typing-dot size-[0.22em] rounded-full bg-current" />
              </span>
            </div>

            {/**
             * ไฟล์ที่ถูกส่งกลับมา — ของที่เคอร์เซอร์กด แล้วถูกยืดเป็นหน้าต่างของจอถัดไป
             *
             * หน้าตาเป็นการ์ดไฟล์แนบ (รูปเอกสาร + ชื่อ) เพราะสิ่งที่เพิ่งถูกสั่งคือ "สร้างสรุป"
             * ของที่ตอบกลับจึงต้องดูเป็นของที่เปิดได้ ไม่ใช่ข้อความอีกก้อน
             */}
            <button
              ref={file}
              type="button"
              tabIndex={-1}
              aria-hidden
              className="mb-[clamp(16px,2.6svh,34px)] flex cursor-pointer items-center gap-[clamp(10px,1.2vw,18px)] rounded-[clamp(14px,1.5vw,24px)] border border-white/80 bg-white px-[clamp(14px,1.5vw,24px)] py-[clamp(11px,1.2vw,19px)] text-left shadow-[0_18px_40px_rgba(22,50,77,0.12)]"
              style={{ opacity: 0 }}
            >
              <span className="grid size-[clamp(34px,3.2vw,52px)] shrink-0 place-items-center rounded-[26%] bg-[#eef4ff] text-[clamp(17px,1.7vw,27px)] text-[#3a63b8]">
                <Icon kind="doc" />
              </span>
              <span className="leading-tight">
                <span className="block text-[clamp(15px,1.5vw,24px)] font-semibold text-[#0d1b2a]">what-i-do</span>
                <span className="block text-[clamp(12px,1.1vw,17px)] text-[#7b8798]">summary · tap to open</span>
              </span>
            </button>

            {/**
             * ช่องพิมพ์ — การ์ดขาวซ้อนสองชั้นตามแบบ
             *
             * ชั้นนอกขาวจาง ชั้นในขาวทึบ: ขอบบาง ๆ ที่เห็นระหว่างสองชั้นคือสิ่งที่ทำให้การ์ด
             * ลอยอยู่เหนือพื้น ถ้าเป็นแผ่นเดียวต้องพึ่งเงาเข้ม ๆ แทน ซึ่งอ่านเป็นกล่องหนัก
             *
             * เป็น DOM ไม่ใช่ของในแคนวาส: ตัวอักษรในเท็กซ์เจอร์คมสู้ตัวอักษรของเบราว์เซอร์
             * ไม่ได้ และช่องนี้ต้องอ่านออกเสียงได้ด้วย
             */}
            <div className="relative">
              {/**
               * แสงเรืองหลังกล่อง — เบลอกว้างสองก้อน ฟ้ากับส้มของงานนี้
               *
               * นี่คือของที่ทำให้กล่องขาวไม่ใช่สี่เหลี่ยมแปะบนพื้นฟ้า: มันมีที่มาของแสง
               * เบลอตั้งไว้ใน style ครั้งเดียว ต่อเฟรมขยับแค่ opacity/scale
               */}
              <div
                ref={aura}
                className="pointer-events-none absolute -inset-[18%]"
                style={{
                  opacity: 0,
                  filter: 'blur(64px)',
                  background:
                    'radial-gradient(42% 58% at 24% 40%,rgba(111,158,232,0.85) 0%,rgba(111,158,232,0) 70%),radial-gradient(38% 52% at 78% 66%,rgba(253,80,0,0.5) 0%,rgba(253,80,0,0) 72%),radial-gradient(46% 60% at 60% 22%,rgba(63,220,255,0.55) 0%,rgba(63,220,255,0) 70%)',
                }}
              />

              <div
                ref={cardBox}
                className="rounded-[clamp(24px,2.6vw,40px)] bg-white/55 p-[clamp(7px,0.8vw,14px)] shadow-[0_34px_80px_rgba(22,50,77,0.14)]"
                style={{ opacity: 0, willChange: 'transform, opacity, filter' }}
              >
              <div className="rounded-[clamp(19px,2.1vw,32px)] bg-white px-[clamp(18px,2vw,32px)] py-[clamp(16px,1.9vw,28px)] shadow-[0_10px_26px_rgba(22,50,77,0.06)]">
                <div data-part className="flex items-center gap-[clamp(12px,1.4vw,22px)]" style={{ opacity: 0 }}>
                  {/**
                   * ลูกแก้วของผู้ช่วย — ไล่สีเป็นวงกลมใน CSS ไม่ใช่ของใน 3D
                   *
                   * มันเป็นรูปตัวแทนขนาดเท่าตัวอักษร ไม่ใช่ของในฉาก จ่ายแคนวาสอีกใบเพื่อลูกกลม
                   * หนึ่งลูกไม่คุ้ม จุดไฮไลต์เยื้องซ้ายบนทิศเดียวกับไฟ key ของฉาก
                   */}
                  <span
                    className="size-[clamp(30px,2.9vw,50px)] shrink-0 rounded-full"
                    style={{
                      background:
                        'radial-gradient(circle at 32% 26%,#ffffff 0%,#bfe9f2 22%,#5aa8cf 58%,#4c6fc4 88%,#3f57a8 100%)',
                      boxShadow: '0 8px 18px rgba(45,85,155,0.22), inset 0 -4px 10px rgba(30,50,110,0.25)',
                    }}
                  />
                  <p className="flex min-h-[1.35em] grow items-center text-[clamp(18px,2.1vw,34px)] leading-snug font-medium text-[#0d1b2a]">
                    <span data-typed />
                    {/* ข้อความชวนพิมพ์ — โผล่เฉพาะตอนช่องว่าง เหมือน placeholder จริง */}
                    <span data-hint className="text-[#9aa4b2]">
                      Ask Joe anything
                    </span>
                    {/* เคอร์เซอร์พิมพ์ — กระพริบด้วยนาฬิกาของตัวเอง ไม่ใช่ตามระยะเลื่อน */}
                    <i data-caret className="v3-caret ml-[2px] inline-block h-[1.05em] w-[2px] bg-[#0d1b2a]" />
                  </p>
                </div>

                {/* ปุ่มโหมด — ขอบบางพื้นขาว ตัวหนังสือดำ ไม่ใช่ป้ายสีทึบ */}
                <div
                  data-part
                  className="mt-[clamp(14px,1.8vw,26px)] flex flex-wrap gap-[clamp(7px,0.8vw,13px)]"
                  style={{ opacity: 0 }}
                >
                  {MODES.map((mo) => (
                    <span
                      key={mo.label}
                      className="flex items-center gap-[0.5em] rounded-full border border-[#e6e9ee] px-[clamp(12px,1.3vw,22px)] py-[clamp(7px,0.8vw,13px)] text-[clamp(13px,1.3vw,21px)] font-medium whitespace-nowrap text-[#0d1b2a]"
                    >
                      <Icon kind={mo.icon} />
                      {mo.label}
                    </span>
                  ))}
                </div>
              </div>
              </div>
            </div>

            {/**
             * แถวปุ่มกลมใต้การ์ด — ประวัติ / เริ่มใหม่ ทางซ้าย, ขยาย / ส่ง ทางขวา
             *
             * ปุ่มส่งเป็นวงกลมดำตามแบบ และเป็นจุดที่ถูกดึงออกเป็นหน้าต่างของจอถัดไป: ของที่
             * ทึบและเล็กที่สุดบนจอคือของที่ยืดออกแล้วตายังตามได้
             */}
            <div
              ref={dock}
              className="mt-[clamp(14px,1.8vw,26px)] flex items-center justify-between"
              style={{ opacity: 0, willChange: 'transform, opacity, filter' }}
            >
              <span className="flex gap-[clamp(8px,1vw,16px)]">
                <Circle kind="clock" />
                <Circle kind="plus" />
              </span>
              <span className="flex items-center gap-[clamp(8px,1vw,16px)]">
                <Circle kind="expand" />
                <button
                  ref={send}
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  className="grid size-[clamp(40px,3.9vw,64px)] cursor-pointer place-items-center rounded-full bg-[#0b0d10] text-[clamp(19px,1.9vw,30px)] text-white shadow-[0_14px_30px_rgba(11,13,16,0.28)]"
                >
                  <Icon kind="spark" />
                </button>
              </span>
            </div>
          </div>
        </div>

        {/**
         * กล่องที่ถูกดึงออกมาเป็นหน้าต่างของจอถัดไป
         *
         * เป็นเงาของหน้าต่าง ไม่ใช่ใบจริง (ใบจริงเป็นของใน 3D ของจอถัดไป) — แถบหัวกับจุด
         * สามจุดคือสองอย่างที่ตาใช้จำมัน เมื่อถึงปลายทางชั้นนี้ปิดตัวเองแล้วใบจริงรับช่วง
         * ที่กรอบเดียวกัน
         */}
        <div
          ref={card}
          className="pointer-events-none fixed"
          style={{ opacity: 0, background: '#f4f4f5', boxShadow: '0 30px 80px rgba(22,24,31,0.12)' }}
        >
          <div
            className="absolute inset-x-0 top-0 flex items-center gap-[0.9%] pl-[2.4%]"
            style={{ height: `${CARD_BAR * 100}%`, background: '#eceef2' }}
          >
            <i className="aspect-square w-[1.7%] rounded-full bg-[#ff5f57]" />
            <i className="aspect-square w-[1.7%] rounded-full bg-[#febc2e]" />
            <i className="aspect-square w-[1.7%] rounded-full bg-[#28c840]" />
          </div>
          <div
            className="absolute inset-x-[1.6%] bottom-[2.2%] rounded-[2%]"
            style={{
              top: `${CARD_BAR * 100 + 1.6}%`,
              background: 'linear-gradient(180deg,#ffe9d2 0%,#ff7a3c 100%)',
            }}
          />
        </div>
      </div>
    </section>
  )
}
