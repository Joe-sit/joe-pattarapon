import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react'
import { useCursorStop } from '@/cursorguide/useCursorStop'
import { AsciiClouds, type CloudBlob } from '@/components/AsciiClouds'
import { deckBubble } from '@/sections/hero/bubbleTravel'
import modride from '@/assets/portfolios/modride-new-card.jpg'
import ekyc from '@/assets/portfolios/ekyc-new-card.jpg'
import hotel from '@/assets/portfolios/hotel-new-card.jpg'

/**
 * What I do — ฟองคำพูดของ hero เล่าต่อ แล้วกลายเป็นการ์ด (เรื่องตาม Figma Desktop 19–21, ท่าจาก ref โฆษณาแอป Spark)
 *
 *   ระหว่างเลื่อนจาก hero  ฟองแก้ว 3D หลุดจากช่องข้าง Ideas ลอยผ่านม่านเมฆ มีจุดกำลังพิมพ์ (แบบฟองเดินทางเดิม)
 *   0 ฟอง: "Hello, I'm Joe"      พิมพ์ทีละตัวตามการเลื่อน
 *   1 การ์ด: favicon               ข้อความหาย favicon เด้งขึ้นในฟอง → ฟองพลิกถึงสัน สลับเป็นการ์ด → การ์ดพลิกกลับหน้าตรง
 *   2 Turning [การ์ด] Ideas        คำซ้ายลอยเข้า คำขวาเป็นรีลแนวตั้ง (คำถัดไปตัวเล็กจางอยู่ข้างล่าง — แบบ Figma)
 *   3 Turning [การ์ด] Design       การ์ดพลิกเปลี่ยนหน้าทุกจังหวะ
 *   4 Turning [การ์ด] Code
 *   5 Into [งานจริงซ้อนสามใบ] Products   การ์ดยุบ ใบงานไถลออกมาจากหลังกันทีละใบ
 *
 * ฟองคือฟองแก้ว 3D ใบเดียวกับในหัวเรื่อง (sections/hero/BubbleTraveler โหมด deckBubble) — ที่นี่มีช่องให้มันมานั่ง
 * การ์ดเป็น DOM 3D (CSS preserve-3d) มีความหนาจริง: พลิกแล้วเห็นสันข้างเป็นผนังหมึก ภาพบนการ์ดลอยอยู่หน้าผิว
 * (translateZ) จึงเหลื่อมกับผิวตอนพลิก และพองเกินขอบการ์ดนิดก่อนคืน — สามอย่างที่ทำให้การ์ดใน ref "มีมิติ"
 *
 * เลื่อนทีละจังหวะ (section ตรึงจอ หนึ่งช่วงของการเลื่อน = หนึ่งจังหวะ) ท่าเล่นด้วยเวลาแบบสปริง ไม่ลากตามนิ้ว
 * ยกเว้นการพิมพ์ในฟองที่ตามนิ้วแบบเวอร์ชันเดิม · เลื่อนย้อนก็เล่นย้อน
 *
 * พื้น: ฟ้าไล่สีชุดเดียวกับ What I do เดิม (sections/skystory: .ss-sky) + เมฆตัวอักษร ASCII สีขาว
 * (components/AsciiClouds) · ม่านขาวรับช่วงจากม่านเมฆของ hero แล้วจางออก
 */

const BEATS = 6
/** ความยาวการเลื่อนต่อหนึ่งจังหวะ (หน่วยความสูงจอ) */
const BEAT_VH = 0.75
/** ม่านขาวจางหมดเมื่อเลื่อนเข้า section ไปเท่านี้ (หน่วยจอ) */
const VEIL_VH = 0.35
/** พิมพ์ครบประโยคที่สัดส่วนนี้ของจังหวะ 0 — เหลือช่วงท้ายให้อ่าน */
const TYPE_END = 0.75

const INK = '#161616'
const SKY = 'linear-gradient(180deg, #1f6fe0 0%, #3f8cf0 55%, #6aaaf5 100%)'
/** หน้าการ์ด 2–4 — คำในรีลกับภาพบนการ์ด */
const SKILLS = [
  { word: 'Ideas', icon: <Bulb /> },
  { word: 'Design', icon: <PenNib /> },
  { word: 'Code', icon: <Brackets /> },
] as const
/** งานจริงในพอร์ต (src/assets/portfolios) — ภาพประกอบล้วน alt จึงว่าง */
const WORKS = [modride, ekyc, hotel]

/** เมฆ ASCII: มุมทั้งสี่กับขอบบนกลาง · กลางจอเว้นให้ประโยค */
const CLOUDS: CloudBlob[] = [
  { x: 0.1, y: 0.92, rx: 0.3, ry: 0.24, k: 1.15, ax: 0.07, ay: 0.04, wx: 0.19, wy: 0.15, ph: 0.4 },
  { x: 0.9, y: 0.9, rx: 0.32, ry: 0.26, k: 1.2, ax: 0.07, ay: 0.05, wx: 0.16, wy: 0.21, ph: 2.2 },
  { x: 0.88, y: 0.1, rx: 0.24, ry: 0.16, k: 0.85, ax: 0.06, ay: 0.04, wx: 0.22, wy: 0.18, ph: 4.1 },
  { x: 0.1, y: 0.12, rx: 0.2, ry: 0.14, k: 0.7, ax: 0.05, ay: 0.03, wx: 0.24, wy: 0.2, ph: 5.6 },
  { x: 0.5, y: 0.02, rx: 0.2, ry: 0.1, k: 0.6, ax: 0.12, ay: 0.03, wx: 0.13, wy: 0.27, ph: 3.1 },
]
const CLOUD_MASK = (x: number, y: number) => (Math.abs(x - 0.5) < 0.32 && Math.abs(y - 0.5) < 0.16 ? 0.12 : 1)

/** สปริงหลักของ ref: ถึงเร็ว เลยเป้านิดแล้วคืนที่ */
const POP = { type: 'spring', stiffness: 420, damping: 22, mass: 0.8 } as const
const SETTLE = { type: 'spring', stiffness: 260, damping: 14 } as const
/** ครึ่งหลังของการพลิก — เด้งเลยหน้าตรงไปนิดแล้วคืน (ref: สันดำย้ายข้างแล้วนิ่ง ~0.25 วิ) */
const FLIP_BACK = { type: 'spring', stiffness: 300, damping: 13 } as const

/** สัดส่วนฟอง (assets/v2final/hero-ideas-bubble.svg 211×99 หางซ้ายล่าง) */
const BUBBLE_VW = 211
const BUBBLE_VH = 99
const bubbleW = (u: number) => 214 * u
/** การ์ด — เกือบจัตุรัสแบบ Figma · ความหนา = สันที่เห็นตอนพลิก */
const cardSize = (u: number) => ({ w: 150 * u, h: 164 * u, t: 12 * u, r: 20 * u })

/** หน่วยขนาดของทั้งฉาก — ผังออกแบบที่ 1440×900 */
function useUnit() {
  const [u, setU] = useState(1)
  useEffect(() => {
    const f = () => setU(Math.max(0.55, Math.min(1.35, Math.min(window.innerWidth / 1440, window.innerHeight / 900))))
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return u
}

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000))

export function SkillDeck({ id }: { id?: string }) {
  const sec = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const veil = useRef<HTMLDivElement>(null)
  const [beat, setBeat] = useState(0)
  const u = useUnit()

  /* จังหวะ = ช่วงของการเลื่อนที่ section ตรึงอยู่ · setState เฉพาะตอนข้ามจังหวะ ไม่ใช่ทุกเฟรม */
  useEffect(() => {
    const el = sec.current
    if (!el) return
    let raf = 0
    const read = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const span = Math.max(1, r.height - vh)
      const p = Math.min(0.9999, Math.max(0, -r.top / span))
      const b = p * BEATS
      setBeat(Math.floor(b))
      /* พิมพ์ในฟองตามนิ้ว — แบบฟองเดินทางเดิม (ไม่ใช่สปริง) */
      const tk = Math.min(1, Math.max(0, b / TYPE_END))
      if (Math.abs(tk - deckBubble.typeK) > 1e-4) {
        deckBubble.typeK = tk
        deckBubble.wake?.()
      }
      /* ม่านขาวรับช่วงจากม่านเมฆของ hero (ขาวทับขาว ไม่มีรอย) แล้วจางเผยฟ้า */
      const v = veil.current
      if (v) {
        const q = Math.min(1, Math.max(0, -r.top / (vh * VEIL_VH)))
        v.style.opacity = String(1 - q * q * (3 - 2 * q))
      }
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      if (raf) cancelAnimationFrame(raf)
      deckBubble.typeK = 0
    }
  }, [])

  /* เคอร์เซอร์นำสายตาพักนอกจอมุมขวาล่างตลอด section — ไม่มีอะไรให้ชี้ ถ้าไม่พักไว้มันลอยข้ามฉาก */
  const [top, setTop] = useState<number | undefined>(undefined)
  useEffect(() => {
    const f = () => {
      const el = sec.current
      if (el) setTop((el.getBoundingClientRect().top + window.scrollY) / (window.innerHeight || 1))
    }
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  const park = { x: 0.9, y: 1.12 }
  useCursorStop(null, { id: 'skilldeck-in', at: park, keyVh: top === undefined ? undefined : top + 0.5, size: 54, tilt: -14 })
  useCursorStop(null, { id: 'skilldeck-out', at: park, keyVh: top === undefined ? undefined : top + BEATS * BEAT_VH + 0.5, size: 54, tilt: -14 })

  /** ฟองถึงที่แล้ว — เปลี่ยนแค่ตอนข้ามเส้น */
  const [arrived, setArrived] = useState(false)
  const bubbleAt = useRef<HTMLDivElement>(null)
  const slot = useRef<HTMLDivElement>(null)
  useDeckBubble(sec, stage, bubbleAt, setArrived)

  const products = beat >= 5
  const turning = beat >= 2 && beat <= 4
  const card = cardSize(u)
  const bw = bubbleW(u)
  const bh = (bw * BUBBLE_VH) / BUBBLE_VW
  return (
    <section
      ref={sec}
      id={id}
      className="relative w-full"
      style={{ height: `${(BEATS * BEAT_VH + 1) * 100}svh`, background: '#3f8cf0' }}
      aria-label="What I do"
    >
      {/* การ์ด + ประดับ — ชั้นลอยเหนือแคนวาสฟอง ตามช่องในประโยคทุกเฟรม (ดู CardLayer) */}
      <CardLayer beat={beat} u={u} arrived={arrived} slot={slot} />
      {/* ชั้นที่ตรึงจอ (ฟ้า เมฆ คำ) — อยู่ใต้แคนวาสฟอง (z 52) ตลอด ฟองแก้วจึงลอยอยู่บนฟ้า */}
      <div ref={stage} className="sticky top-0 flex h-[100svh] w-full items-center justify-center overflow-hidden">
        <div className="absolute inset-0" style={{ background: SKY }} aria-hidden />
        <AsciiClouds blobs={CLOUDS} mask={CLOUD_MASK} alpha={[0.14, 0.42]} />
        <div ref={veil} className="pointer-events-none absolute inset-0 bg-white" aria-hidden />

        {/* ข้อความทั้งเรื่องสำหรับ screen reader — ท่าข้างล่างแยกคำเป็นชิ้น ๆ อ่านต่อกันไม่ได้ */}
        <p className="sr-only">Hello, I&apos;m Joe. Turning ideas, design and code into products.</p>
        <div
          aria-hidden
          className="relative flex items-center"
          style={{ gap: 26 * u, fontFamily: 'var(--v3-display)', color: '#fff', filter: 'drop-shadow(0 6px 22px rgba(10,30,120,0.28))' }}
        >
          {/* คำซ้าย — มีตั้งแต่จังหวะ 2 · ก่อนนั้นฟอง/การ์ดอยู่กลางจอเดี่ยว ๆ */}
          <motion.div layout="position" className="flex justify-end">
            <AnimatePresence mode="popLayout" initial={false}>
              {turning && (
                <Word key="turning" u={u}>
                  Turning
                </Word>
              )}
              {products && (
                <Word key="into" u={u}>
                  Into
                </Word>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ช่องของการ์ด — ฟองนั่งกลางช่อง (bubbleAt: BubbleTraveler อ่านกรอบนี้แล้ววาดฟองทับพอดี) */}
          <motion.div ref={slot} layout="position" className="relative shrink-0" style={{ width: card.w, height: card.h }}>
            <div ref={bubbleAt} className="absolute top-1/2 left-1/2" style={{ width: bw, height: bh, marginLeft: -bw / 2, marginTop: -bh / 2 }} />
            <WorkStack on={products} u={u} />
          </motion.div>

          {/* คำขวา: รีล Ideas/Design/Code → Products */}
          <motion.div layout="position">
            <AnimatePresence mode="popLayout" initial={false}>
              {turning && <Reel key="reel" idx={beat - 2} u={u} />}
              {products && (
                <Word key="products" u={u} i={1}>
                  Products
                </Word>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ---------- คำ ---------- */

const wordStyle = (u: number): CSSProperties => ({
  fontSize: 84 * u,
  lineHeight: 1,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  whiteSpace: 'nowrap',
})

/** คำลอยขึ้นจากข้างล่างแล้วเด้งเข้าที่ · ออกด้วยการลอยขึ้นต่อแล้วจาง (ทิศเดียวกับตอนเข้า) */
function Word({ children, i = 0, u }: { children: ReactNode; i?: number; u: number }) {
  return (
    <motion.span
      layout="position"
      initial={{ y: 60 * u, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { ...SETTLE, delay: 0.08 + i * 0.07 } }}
      exit={{ y: -44 * u, opacity: 0, transition: { duration: 0.16, ease: 'easeIn' } }}
      style={{ display: 'inline-block', ...wordStyle(u) }}
    >
      {children}
    </motion.span>
  )
}

/**
 * รีลคำแนวตั้ง (Figma Desktop 20): คำปัจจุบันตัวเต็ม คำถัดไปเรียงลงข้างล่าง เล็กลงและจางลงทีละขั้น
 * เลื่อนจังหวะ = ทั้งรีลไหลขึ้นหนึ่งช่องด้วยสปริง คำที่ผ่านไปแล้วลอยขึ้นจางหาย
 * กล่องกว้างเท่าคำที่ยาวที่สุด — ประโยคไม่ขยับซ้ายขวาตอนคำเปลี่ยน
 */
function Reel({ idx, u }: { idx: number; u: number }) {
  const fs = 84 * u
  return (
    <motion.div
      className="relative"
      initial={{ y: 60 * u, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { ...SETTLE, delay: 0.15 } }}
      exit={{ y: -44 * u, opacity: 0, transition: { duration: 0.16, ease: 'easeIn' } }}
      style={{ ...wordStyle(u), height: fs }}
    >
      {/* กันความกว้าง — มองไม่เห็น */}
      <span style={{ visibility: 'hidden' }}>Design</span>
      {SKILLS.map((s, i) => {
        const d = i - idx
        /* ขั้นของรีล: ปัจจุบัน 1 · ถัดไป 0.5 · ถัดไปอีก 0.36 */
        const sc = d <= 0 ? 1 : d === 1 ? 0.5 : 0.36
        const y = d < 0 ? -fs * 0.9 : d === 0 ? 0 : d === 1 ? fs * 0.98 : fs * (0.98 + 0.5 * 1.02)
        const op = d < 0 ? 0 : d === 0 ? 1 : d === 1 ? 0.62 : 0.38
        return (
          <motion.span
            key={s.word}
            className="absolute top-0 left-0"
            initial={false}
            animate={{ y, scale: sc, opacity: op, transition: { ...POP, delay: Math.max(0, d) * 0.04 } }}
            style={{ transformOrigin: '0% 0%', display: 'inline-block' }}
          >
            {s.word}
          </motion.span>
        )
      })}
    </motion.div>
  )
}

/* ---------- ฟอง → การ์ด ---------- */

/**
 * หน้า: 0 = ฟอง (พิมพ์ข้อความ — วาดโดย BubbleTraveler) · 1 = การ์ด favicon · 2..4 = การ์ด Ideas / Design / Code
 *
 * ทุกการเปลี่ยนหน้าคือการพลิกรอบแกนตั้ง: ครึ่งแรกเร่งเข้าจนหันสัน (90°) → สลับของตรงนั้น (มองไม่เห็น) →
 * ครึ่งหลังเด้งกลับหน้าตรงด้วยสปริง · ทิศพลิกตามทิศของการเลื่อน · ข้ามหลายจังหวะรวดเดียว พลิกทีละหน้า
 *
 * 0 → 1 (ฟองกลายเป็นการ์ด): ข้อความในฟองหาย → favicon เด้งขึ้นกลางฟอง → ฟอง 3D กับ favicon พลิกไปด้วยกัน
 * ถึงสันแล้วฟองหาย การ์ดโผล่ที่มุมเดียวกัน (สลับตอนบางเป็นเส้น ตาไม่ทันเห็น) แล้วการ์ดพลิกกลับหน้าตรง
 * 1 → 0 คือท่าเดียวกันย้อนกลับ
 */
function CardLayer({ beat, u, arrived, slot }: { beat: number; u: number; arrived: boolean; slot: React.RefObject<HTMLDivElement | null> }) {
  const want = useRef(0)
  want.current = beat >= 5 ? 4 : Math.min(4, beat)
  const [shown, setShown] = useState(0)
  /** การ์ดอยู่บนจอแทนฟองแล้ว */
  const [isCard, setIsCard] = useState(false)
  /** ฟอง → การ์ด (ดู BubbleToCard): bubble = ยังเป็นฟอง · rise = favicon ลอยขึ้นจากในฟอง · morph = ทรงฟองยืดเป็นการ์ด */
  const [phase, setPhase] = useState<'bubble' | 'rise' | 'morph'>('bubble')
  const spin = useMotionValue(0)
  const cardMode = useRef(false)
  const busy = useRef(false)

  /* มุมพลิก → ฟอง 3D (เฉพาะตอนยังเป็นฟอง — เป็นการ์ดแล้วฟองซ่อนอยู่) */
  useEffect(() => {
    const off = spin.on('change', (v) => {
      deckBubble.spinY = cardMode.current ? 0 : (v * Math.PI) / 180
      deckBubble.wake?.()
    })
    return () => {
      off()
      deckBubble.spinY = 0
    }
  }, [spin])

  const setBubble = (k: number) => {
    deckBubble.k = k
    deckBubble.wake?.()
  }
  const textOut = (to: number) =>
    animate(deckBubble.textOut, to, {
      duration: to > deckBubble.textOut ? 0.12 : 0.18,
      ease: 'easeIn',
      onUpdate: (v) => {
        deckBubble.textOut = v
        deckBubble.wake?.()
      },
    })

  useEffect(() => {
    if (busy.current || !arrived) return
    let cur = shown
    if (want.current === cur) return
    busy.current = true
    const run = async () => {
      while (want.current !== cur) {
        const next = cur + (want.current > cur ? 1 : -1)
        const dir = next > cur ? 1 : -1
        if (cur === 0 && next === 1) {
          /* ฟองกลายเป็นการ์ด — ไม่พลิก: ทรงยืดต่อเนื่องจากฟองไปเป็นการ์ด (ขนาดไม่กระโดด) */
          await textOut(1)
          /* รอฟองหดกลับกว้างเท่าเดิม (ฟองยืดตามความยาวข้อความ แล้วผ่อนคืนเอง) */
          await sleep(0.16)
          setPhase('rise')
          await sleep(0.42)
          cardMode.current = true
          setBubble(0)
          setPhase('morph')
          await sleep(0.5)
          setIsCard(true)
          cur = next
          setShown(next)
          continue
        }
        if (cur === 1 && next === 0) {
          /* ย้อน: การ์ดหดกลับเป็นทรงฟอง → ฟองแก้วกลับมา → favicon จมลงในฟอง → ข้อความกลับมา */
          setIsCard(false)
          setPhase('rise')
          await sleep(0.36)
          cardMode.current = false
          setBubble(1)
          setPhase('bubble')
          await sleep(0.2)
          await textOut(0)
          cur = next
          setShown(next)
          continue
        }
        await animate(spin, 90 * dir, { duration: 0.15, ease: 'easeIn' })
        cur = next
        setShown(next)
        spin.jump(-90 * dir)
        await animate(spin, 0, FLIP_BACK)
      }
      busy.current = false
    }
    void run()
    // run ถูกปลุกด้วยจังหวะ/การลงจอด — ค่าอื่นอ่านผ่าน ref
  }, [beat, arrived, shown, spin])

  /* ออกจาก section / กลับขึ้นไป hero: คืนฟองสภาพเดิม */
  useEffect(() => {
    if (arrived) return
    cardMode.current = false
    setIsCard(false)
    setPhase('bubble')
    setShown(0)
    spin.jump(0)
    deckBubble.k = 1
    deckBubble.textOut = 0
    deckBubble.wake?.()
  }, [arrived, spin])

  /* ตามกรอบของช่องทุกเฟรม (ช่องขยับตามผังคำได้โดยไม่มีการเลื่อน) */
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const el = box.current
      const s = slot.current
      if (!el || !s) return
      const r = s.getBoundingClientRect()
      el.style.transform = `translate3d(${r.left.toFixed(1)}px, ${r.top.toFixed(1)}px, 0)`
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [slot])

  const c = cardSize(u)
  const bw = bubbleW(u)
  const bh = (bw * BUBBLE_VH) / BUBBLE_VW
  const products = beat >= 5
  return (
    /**
     * ชั้นนี้ลอยตรึงจอเหนือแคนวาสฟอง (z 53 > 52) — อยู่ในชั้นที่ตรึงของ section ไม่ได้ เพราะชั้นนั้นมีพื้นฟ้า
     * ซ่อนจนฟองลงจอด: ก่อนนั้นม่านเมฆ (z 50) ยังบังอยู่ ชั้นนี้อยู่เหนือมันจึงต้องไม่โผล่ก่อนเวลา
     */
    <div
      ref={box}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[53]"
      style={{ width: c.w, height: c.h, perspective: 1100 * u, visibility: arrived ? 'visible' : 'hidden' }}
    >
      {/* ฟอง → การ์ด: favicon ลอยขึ้นจากในฟอง แล้วทรงฟองยืดเป็นการ์ด (การ์ดหนารับไม้ต่อเมื่อหน้าตาเท่ากันแล้ว) */}
      {!isCard && <BubbleToCard phase={phase} u={u} bw={bw} bh={bh} />}
      {/* ประดับพุ่งออกจากหลังการ์ด ทุกครั้งที่การ์ดเปลี่ยนหน้า (ref: ยุบเข้าตอนหันสัน แล้วพุ่งออกไปที่ใหม่) */}
      {isCard && !products && <Sparks seed={shown} w={c.w} h={c.h} u={u} />}
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ scale: isCard && !products ? 1 : 0, opacity: isCard && !products ? 1 : 0, transition: isCard && !products ? { duration: 0 } : { duration: 0.2, ease: 'easeIn' } }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <SlabCard spin={spin} u={u} face={shown} />
      </motion.div>
    </div>
  )
}

/** favicon เต็มหน้าการ์ด ขยายเท่านี้เพื่อตัดขอบมน/ขอบขาวที่อยู่ในไฟล์ภาพเอง */
const FAV_ZOOM = 1.08

/**
 * ฟองกลายเป็นการ์ด — ไม่ใช่การสลับชิ้น แต่เป็นทรงเดียวที่เปลี่ยนรูปต่อเนื่อง
 *
 *   rise  ช่องในตัวฟอง (แคปซูลขนาดเท่าฟอง ตัดขอบ) — favicon ลอยขึ้นจากใต้ขอบล่างของฟองมากลางตัวฟอง
 *         เด้งเลยนิดแล้วคืน เอียงแล้วตั้งตรง (หัวโผล่ออกจากฟอง) · ฟองแก้ว 3D ยังอยู่ข้างหลัง เห็นเป็นตัวฟองจริง
 *   morph ฟองแก้วหายเข้าไปในทรงนี้ แล้วทรงยืดจากแคปซูลแก้วใส → การ์ดขาวขอบหมึกเงาแข็ง (ขนาด มุมมน สี
 *         ขอบ เงา ไหลไปพร้อมกันด้วยสปริงเดียว) favicon ขยายตามจนเต็มหน้าการ์ด
 *   ถึงขนาดการ์ดแล้ว SlabCard (การ์ดหนา) รับไม้ต่อ — หน้าตาเท่ากันทุกอย่าง จึงไม่เห็นรอยสลับ
 */
function BubbleToCard({ phase, u, bw, bh }: { phase: 'bubble' | 'rise' | 'morph'; u: number; bw: number; bh: number }) {
  const c = cardSize(u)
  const card = phase === 'morph'
  const on = phase !== 'bubble'
  const fav = bh * 0.78
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="relative flex items-center justify-center overflow-hidden"
        initial={false}
        animate={
          card
            ? {
                width: c.w,
                height: c.h,
                borderRadius: c.r,
                backgroundColor: 'rgba(255,255,255,1)',
                borderColor: 'rgba(22,22,22,1)',
                borderWidth: 3 * u,
                boxShadow: `${5 * u}px ${6 * u}px 0px rgba(22,22,22,1)`,
                transition: { ...SETTLE, stiffness: 300 },
              }
            : {
                width: bw * 0.9,
                height: bh,
                borderRadius: bh / 2,
                backgroundColor: 'rgba(255,255,255,0)',
                borderColor: 'rgba(255,255,255,0)',
                borderWidth: 0,
                boxShadow: '0px 0px 0px rgba(22,22,22,0)',
                transition: { duration: 0.25, ease: 'easeOut' },
              }
        }
        style={{ borderStyle: 'solid', visibility: on ? 'visible' : 'hidden', marginLeft: card ? 0 : bw * 0.06 }}
      >
        <motion.img
          src="/favicon-512.png"
          alt=""
          draggable={false}
          className="block shrink-0 object-cover"
          initial={false}
          animate={
            phase === 'bubble'
              ? { width: fav, height: fav, y: bh * 0.95, rotate: -14, scale: 0.8, borderRadius: fav * 0.22, transition: { duration: 0.18, ease: 'easeIn' } }
              : phase === 'rise'
                ? { width: fav, height: fav, y: 0, rotate: 0, scale: 1, borderRadius: fav * 0.22, transition: { y: { ...POP, stiffness: 340, damping: 15 }, rotate: SETTLE, scale: POP } }
                : { width: c.w * FAV_ZOOM, height: c.h * FAV_ZOOM, y: 0, rotate: 0, scale: 1, borderRadius: 0, transition: { ...SETTLE, stiffness: 300 } }
          }
          style={{ filter: card ? 'none' : 'drop-shadow(0 8px 14px rgba(10,30,120,0.35))' }}
        />
      </motion.div>
    </div>
  )
}

/**
 * การ์ดหนา (CSS 3D) — หน้า + สันซ้าย/ขวา/บน/ล่าง + หลัง ประกอบกันเป็นแผ่นมีความหนา
 *
 * ref: การ์ดพลิกแล้วเห็นสันเป็นผนังดำหนา ภาพถูกบีบแบบ perspective (ขอบใกล้สูงกว่าขอบไกล) ไม่ใช่ scaleX แบน
 * ตอนนิ่งยังเห็นสันขวา/ล่างเป็นแถบหมึก — เงาแข็งเหลื่อมใต้หน้า (box-shadow) แทนมุมมองเฉียงนิด ๆ
 * ภาพบนการ์ดอยู่อีกชั้นลอยหน้าผิว (translateZ) — พลิกแล้วเหลื่อมกับผิว (parallax) และพองเกินขอบนิดก่อนหดคืน
 */
function SlabCard({ spin, u, face }: { spin: ReturnType<typeof useMotionValue<number>>; u: number; face: number }) {
  const { w, h, t, r } = cardSize(u)
  const side: CSSProperties = { position: 'absolute', background: INK, backfaceVisibility: 'hidden' }
  const skill = face >= 2 ? SKILLS[face - 2] : null
  return (
    <motion.div className="absolute inset-0" style={{ rotateY: spin, transformStyle: 'preserve-3d' }}>
      {/* หลัง */}
      <div className="absolute inset-0" style={{ background: INK, borderRadius: r, transform: `rotateY(180deg) translateZ(${t / 2}px)` }} />
      {/* สันซ้าย/ขวา (เห็นตอนพลิกรอบแกนตั้ง) */}
      <div style={{ ...side, width: t, height: h - r, left: w / 2 - t / 2, top: r / 2, transform: `rotateY(90deg) translateZ(${w / 2}px)` }} />
      <div style={{ ...side, width: t, height: h - r, left: w / 2 - t / 2, top: r / 2, transform: `rotateY(-90deg) translateZ(${w / 2}px)` }} />
      {/* สันบน/ล่าง */}
      <div style={{ ...side, width: w - r, height: t, left: r / 2, top: h / 2 - t / 2, transform: `rotateX(90deg) translateZ(${h / 2}px)` }} />
      <div style={{ ...side, width: w - r, height: t, left: r / 2, top: h / 2 - t / 2, transform: `rotateX(-90deg) translateZ(${h / 2}px)` }} />
      {/* หน้า */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: r,
          background: '#fff',
          border: `${3 * u}px solid ${INK}`,
          boxShadow: `${5 * u}px ${6 * u}px 0 ${INK}`,
          transform: `translateZ(${t / 2}px)`,
          backfaceVisibility: 'hidden',
        }}
      >
        {/* ขยาย 1.08 ตัดขอบมน/ขอบขาวของไฟล์ favicon เอง — ไม่งั้นเห็นกรอบซ้อนกรอบในการ์ด (ค่าเดียวกับ BubbleToCard) */}
        {face === 1 && <img src="/favicon-512.png" alt="" draggable={false} className="h-full w-full object-cover" style={{ transform: `scale(${FAV_ZOOM})` }} />}
      </div>
      {/* ภาพลอยหน้าผิว — หน้าใหม่โผล่เปล่าก่อน แล้วภาพพองตามมา เลยขนาดนิดแล้วคืน (ref: DNA ยื่นพ้นขอบการ์ด) */}
      <AnimatePresence initial={false}>
        {skill && (
          <motion.div
            key={skill.word}
            className="absolute"
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: [0, 1.22, 1], rotate: [-12, 4, 0], transition: { duration: 0.42, times: [0, 0.55, 1], ease: 'easeOut', delay: 0.07 } }}
            exit={{ scale: 0, transition: { duration: 0.08 } }}
            /* ลอยหน้าผิวด้วย z ของ motion ไม่ใช่ transform สตริง — motion เขียน transform ทับ (scale/rotate) แล้ว translateZ หาย ภาพจมหลังหน้าการ์ด */
            style={{
              left: w * 0.2,
              top: h * 0.2,
              width: w * 0.6,
              height: h * 0.6,
              color: INK,
              z: t / 2 + 22 * u,
            }}
          >
            {skill.icon}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * จุดกับดาวประดับรอบการ์ด — ref: ตอนการ์ดหันสันยุบหาย แล้วพุ่งออกจากหลังการ์ดไปยังที่ใหม่ (ดาวหมุนระหว่างทาง)
 * ตำแหน่งสุ่มแบบคงที่ต่อหน้า (หน้าเดิมได้ที่เดิมทุกครั้ง)
 */
function Sparks({ seed, w, h, u }: { seed: number; w: number; h: number; u: number }) {
  const bits = Array.from({ length: 6 }, (_, i) => {
    const a = rnd(seed * 7 + i, 1) * Math.PI * 2
    const r = 0.72 + rnd(seed * 7 + i, 2) * 0.22
    return {
      x: w / 2 + Math.cos(a) * w * r,
      y: h / 2 + Math.sin(a) * h * r * 0.85,
      star: i % 2 === 0,
      size: (i % 2 === 0 ? 22 : 12) * u,
      color: ['#ffcc33', '#ad85fe', '#fd5000', '#00d68f', '#ffffff'][i % 5],
    }
  })
  return (
    <AnimatePresence initial={false}>
      {bits.map((b, i) => (
        <motion.div
          key={`${seed}-${i}`}
          className="pointer-events-none absolute"
          initial={{ x: w / 2 - b.x, y: h / 2 - b.y, scale: 0, rotate: b.star ? -120 : 0 }}
          animate={{ x: 0, y: 0, scale: 1, rotate: 0, transition: { ...POP, delay: 0.14 + i * 0.04 } }}
          exit={{ x: w / 2 - b.x, y: h / 2 - b.y, scale: 0, transition: { duration: 0.12, ease: 'easeIn' } }}
          style={{ left: b.x - b.size / 2, top: b.y - b.size / 2, width: b.size, height: b.size }}
        >
          {b.star ? (
            <svg viewBox="0 0 24 24" width="100%" height="100%">
              <path d="M12 1.5c.9 5.6 4.9 9.6 10.5 10.5-5.6.9-9.6 4.9-10.5 10.5C11.1 16.9 7.1 12.9 1.5 12 7.1 11.1 11.1 7.1 12 1.5Z" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            </svg>
          ) : (
            <div className="h-full w-full rounded-full" style={{ background: b.color, border: `${2 * u}px solid ${INK}` }} />
          )}
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

/* ---------- จังหวะ 5: การ์ดงานซ้อนสามใบ ---------- */

/**
 * การ์ดงานจริงสามใบซ้อนกัน (Figma Desktop 21): ใบหน้าตรง ใบหลังเยื้องขวาและเอียงเพิ่มทีละขั้น
 * ref (แจกพัด): ใบแรกพองจากจุดเล็กกลางช่องพร้อมเอียง ใบถัดไปไถลออกจากหลังใบก่อน ~0.035 วิต่อใบ
 * ทุกใบมีสันหนา (เงาแข็งเหลื่อม) ซ้อนกันจึงเห็นเป็นชั้นลึก · เอียงด้วย perspective จริงเล็กน้อย
 */
function WorkStack({ on, u }: { on: boolean; u: number }) {
  const cw = 132 * u
  const chh = 156 * u
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2" style={{ width: 0, height: 0, perspective: 900 * u }}>
      {WORKS.map((src, i) => {
        const back = i
        return (
          <motion.div
            key={src}
            className="absolute overflow-hidden"
            initial={false}
            animate={
              on
                ? {
                    /* พัดกระจายออกสองข้างของช่อง (กลางพัดอยู่กลางช่อง) — ไม่งั้นใบหลังยื่นทับคำ Products */
                    x: (back - 1) * 22 * u,
                    y: back * 4 * u,
                    rotate: back * 8,
                    rotateY: -8 - back * 4,
                    scale: 1,
                    opacity: 1,
                    transition: back === 0 ? { ...POP, delay: 0.1 } : { ...POP, delay: 0.24 + back * 0.05 },
                  }
                : { x: 0, y: 0, rotate: back === 0 ? -14 : 0, rotateY: 0, scale: back === 0 ? 0.2 : 0.9, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }
            }
            style={{
              left: -cw / 2,
              top: -chh / 2,
              width: cw,
              height: chh,
              borderRadius: 16 * u,
              border: `${3 * u}px solid ${INK}`,
              background: '#fff',
              boxShadow: `${5 * u}px ${6 * u}px 0 ${INK}`,
              zIndex: WORKS.length - back,
            }}
          >
            <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
          </motion.div>
        )
      })}
    </div>
  )
}

/* ---------- ต่อสายกับฟองแก้ว 3D ของหัวเรื่อง ---------- */

/**
 * เปิดโหมด deckBubble ของ sections/hero/BubbleTraveler ตอน mount — ฟองที่นั่งในหัวเรื่องจะเดินทางลงมาที่
 * กลางช่องการ์ด (bubbleAt) แทนเรื่อง What I do เดิม แล้วคอยดูว่าฟองถึงที่หรือยัง (ขอบบนของ section ถึงขอบบนจอ =
 * ม่านเมฆขาวทึบพอดี = ฟองลงจอด)
 */
function useDeckBubble(
  sec: React.RefObject<HTMLElement | null>,
  stage: React.RefObject<HTMLDivElement | null>,
  bubbleAt: React.RefObject<HTMLDivElement | null>,
  onArrive: (v: boolean) => void,
) {
  useEffect(() => {
    deckBubble.on = true
    deckBubble.section = sec.current
    deckBubble.stage = stage.current
    deckBubble.slot = bubbleAt.current
    deckBubble.k = 1
    deckBubble.tint = 0
    deckBubble.textOut = 0
    let raf = 0
    let was: boolean | null = null
    const read = () => {
      raf = 0
      const s = sec.current
      if (!s) return
      const now = s.getBoundingClientRect().top <= 0.5
      if (now === was) return
      was = now
      onArrive(now)
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    deckBubble.wake?.()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      if (raf) cancelAnimationFrame(raf)
      deckBubble.on = false
      deckBubble.section = null
      deckBubble.stage = null
      deckBubble.slot = null
      deckBubble.wake?.()
    }
  }, [sec, stage, bubbleAt, onArrive])
}

/* ---------- ภาพบนการ์ด (เส้นหนา หมึก) ---------- */

function Bulb() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 6c-7.2 0-13 5.6-13 12.6 0 4.6 2.5 7.9 5.2 10.4 1.6 1.5 2.3 3.2 2.3 5V36h11v-2c0-1.8.7-3.5 2.3-5 2.7-2.5 5.2-5.8 5.2-10.4C37 11.6 31.2 6 24 6Z" fill="#ffcc33" />
      <path d="M19 42h10" />
    </svg>
  )
}

/** ปากกาหัวแร้ง — ทรงเดียวกับ assets/icons/pen-nib.svg (ไอคอน Design เดิมของเว็บ) */
function PenNib() {
  return (
    <svg viewBox="0 0 32 32" width="100%" height="100%">
      <path d="M17 3h-2L8 17l2.342 1.171C11.358 18.679 12 19.718 12 20.854V21h-2v8h12v-8h-2v-.146c0-1.136.642-2.175 1.658-2.683L24 17Z" fill="#fd5000" />
      <path
        fill="currentColor"
        d="M20,20.854c0-1.136,0.642-2.175,1.658-2.683L24,17L17,3h-2L8,17l2.342,1.171 C11.358,18.679,12,19.718,12,20.854V21h-2v8h12v-8h-2V20.854z M11.236,16.382l-0.553-0.276L15,7.472V15h2V7.472l4.317,8.633 l-0.553,0.276C19.059,17.234,18,18.948,18,20.854V21h-4v-0.146C14,18.948,12.941,17.234,11.236,16.382z M20,27h-8v-4h8V27z"
      />
    </svg>
  )
}

function Brackets() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="42" height="34" rx="7" fill="#ad85fe" strokeWidth="4" />
      <path d="M18 17l-7 7 7 7M30 17l7 7-7 7M26 14l-4 20" />
    </svg>
  )
}

/** สุ่มคงที่ (0..1) ต่อคู่ตัวเลข — ตำแหน่งประดับได้ค่าเดิมทุกครั้ง */
function rnd(n: number, k: number) {
  const v = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453
  return v - Math.floor(v)
}
