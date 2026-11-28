import { useCallback, useEffect, useRef, useState } from 'react'
import { IconCode, IconPalette, IconSearch, type IconProps } from '@tabler/icons-react'

/**
 * **ยังไม่ถูกใช้** — จอ About เปลี่ยนไปใช้โมเสกแผ่นสกิลแทน (ดู ./SkillTiles)
 *
 * เก็บไว้เพราะเป็นของที่ทำเสร็จและจูนแล้ว: ถ้าจะเอาวงล้อกลับมา สลับ import ใน ./AboutStar
 * กลับเป็น `SkillWheel` เท่านั้น ไม่มีอย่างอื่นผูกอยู่
 *
 * วงล้อสกิลของจอ About — ป้ายมนเรียงบนส่วนโค้ง หมุนเองช้า ๆ และลากได้
 *
 * กลไกเดียวกับ OptionWheel ของ reactbits (reactbits.dev/components/option-wheel) ตามที่
 * เจ้าของงานชี้ไว้: ตัวเลือกวางบนวงกลมที่ *ความยาวส่วนโค้งระหว่างสองใบเท่ากับความสูงแถว*
 * พอดี — `TILT` (องศาต่อหนึ่งแถว) เป็นตัวคุมว่าวงม้วนแน่นแค่ไหน แล้วรัศมีตกเป็น
 * `ROW / TILT` ไม่ใช่เลขที่ตั้งเอง ระยะห่างจากใบกลางคุมทั้งความทึบ ความเบลอ และความนูน
 *
 * ต่างจากต้นแบบสามข้อ เพราะบริบทของหน้านี้:
 *
 * 1. **หมุนเองตลอด** ไม่ใช่นิ่งรอให้เลือก — จอนี้ไม่มีอะไรให้ "เลือก" มันเป็นของประดับที่
 *    เล่าว่าทำอะไรได้ ท่าหมุนช้าจึงเป็นค่าตั้งต้น การลากคือการแทรกของผู้ใช้ (ปล่อยแล้วหมุน
 *    ต่อจากที่ลากไว้ ไม่ดีดกลับไปที่ใบใดใบหนึ่ง)
 * 2. **ไม่แย่งล้อเมาส์** ต้นแบบดัก `wheel` แล้ว preventDefault — บนหน้าที่เล่าเรื่องด้วย
 *    การเลื่อนทั้งหน้า นั่นคือหลุมที่เลื่อนหน้าไม่ไปทั้งย่าน จึงเหลือแค่การลาก
 * 3. **ป้ายเป็นก้อนนูน** ไม่ใช่ตัวหนังสือเปล่า — ตามภาพอ้างอิงที่เจ้าของงานส่งมา (แถบสี
 *    พาสเทลมุมมน มีไอคอนนำ)
 *
 * ตำแหน่งวงล้อเก็บใน ref แล้วเขียน `style.transform` ของแต่ละใบตรง ๆ ในลูป rAF ไม่ผ่าน
 * state: ท่านี้เดินทุกเฟรม การ re-render ทุกเฟรมเพื่อเลขชุดเดิมคือเผาเฟรมเปล่า (ท่าเดียวกับ
 * ชั้นอื่นของจอนี้ — ดู ./AboutStar)
 */

type Skill = {
  label: string
  icon: React.ComponentType<IconProps>
  /** สีพื้น / สีตัวอักษรกับไอคอน — พาสเทลอิ่มพอให้อ่านบนพื้นม่วงอ่อนของจอ */
  bg: string
  ink: string
}

/**
 * สกิลชุดเดียวกับที่จอ "สิ่งที่ทำ" ประกาศไว้ — ไม่ได้แต่งเพิ่มให้ครบวง
 *
 * ภาพอ้างอิงมีป้ายเป็นสิบใบ (interface · illustration · animation …) แต่นั่นเป็นของงานอื่น
 * ที่นี่ใส่เท่าที่เป็นของจริง อยากได้กี่ใบ ใบไหน เขียนมาแล้วเติมที่นี่ได้เลย (ท่าเดียวกับ
 * ข้อความ Lorem ของจอเดิมที่รอเจ้าของงานเขียน)
 */
const SKILLS: Skill[] = [
  { label: 'research', icon: IconSearch, bg: '#cdf2dd', ink: '#1c7f52' },
  { label: 'design', icon: IconPalette, bg: '#fde7b0', ink: '#c9741a' },
  { label: 'coding', icon: IconCode, bg: '#e0d2fb', ink: '#7a3fd8' },
]

/** ความสูงหนึ่งแถว (พิกเซล) — ระยะของสองใบที่ติดกันเมื่อวัดตามส่วนโค้ง */
const ROW = 96
/** องศาต่อหนึ่งแถว — มากคือวงม้วนแน่น ป้ายเอียงเร็วและหลบหายไวขึ้น */
const TILT = 14
/** ความแรงของการเบนเข้าหาแกน (0 = เรียงตรง, 1 = ตามวงกลมเต็ม) */
const CURVE = 1
/** ความทึบที่หายไปต่อหนึ่งแถวห่างจากใบกลาง */
const FADE = 0.44
/** เบลอกี่พิกเซลต่อหนึ่งแถวห่าง — ใบไกลถอยเป็นฉากหลังโดยไม่ต้องย่อ */
const BLUR = 1.5
/** หมุนเองกี่แถวต่อวินาที — ช้าพอที่จะเป็นฉากหลัง ไม่แย่งสายตากับดาว */
const SPIN = 0.16
/** ลากหนึ่งพิกเซลเท่ากับกี่แถว */
const DRAG = 1 / ROW

const TAU = (TILT * Math.PI) / 180
/** รัศมีตกมาจาก ROW กับ TILT ไม่ใช่ค่าที่ตั้งเอง — ดูคำอธิบายหัวไฟล์ */
const R = TAU > 0.0005 ? ROW / TAU : 0

export function SkillWheel() {
  const root = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLDivElement | null)[]>([])
  /** ตำแหน่งวงล้อเป็น "แถว" — เลขจริง ไม่ใช่ดัชนี ระหว่างสองใบก็มีค่า */
  const pos = useRef(0)
  const drag = useRef<{ y: number; from: number; id: number } | null>(null)
  const [grabbing, setGrabbing] = useState(false)

  /**
   * เขียนท่าของทุกใบจากตำแหน่งวงล้อค่าเดียว — ระยะห่างคิดแบบ *วน* เสมอ
   *
   * ต้องพับเข้าช่วง −n/2..n/2 ไม่ใช่ระยะตรง: ป้ายสามใบที่วนอยู่ ใบที่อยู่ก่อนใบกลางหนึ่ง
   * แถวคือใบเดียวกับที่อยู่ถัดไปสองแถว ถ้าไม่พับ มันจะจางหายทั้งที่ควรกำลังโผล่เข้ามา
   */
  const layout = useCallback(() => {
    const n = SKILLS.length
    for (let i = 0; i < n; i += 1) {
      const el = items.current[i]
      if (!el) continue
      let d = ((((i - pos.current) % n) + n) % n) as number
      if (d > n / 2) d -= n
      const dist = Math.abs(d)
      const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * TAU))
      const y = R > 0 ? R * Math.sin(ang) : d * ROW
      const x = R > 0 ? -R * (1 - Math.cos(ang)) * CURVE : 0
      const rot = R > 0 ? (ang * 180) / Math.PI : 0
      el.style.transform = `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(2)}deg)`
      el.style.opacity = String(Math.max(0, 1 - dist * FADE))
      el.style.filter = BLUR > 0 ? `blur(${(dist * BLUR).toFixed(2)}px)` : 'none'
      /* 1 ตอนอยู่กลางวง → 0 ตอนห่างหนึ่งแถว: ใบกลางลอยขึ้นมาจากพวกที่เบลอ */
      el.style.setProperty('--sw-p', Math.max(0, 1 - Math.min(dist, 1)).toFixed(4))
    }
  }, [])

  /**
   * ลูปเดียวทั้งวงล้อ — หมุนเองเมื่อไม่มีใครลาก
   *
   * ผู้ใช้ที่ขอลดการเคลื่อนไหว (prefers-reduced-motion) ได้ภาพนิ่งที่ยัง layout ครบทุกใบ
   * ไม่ใช่ป้ายกองทับกันที่กลางวง — จึงต้องเรียกวางท่าหนึ่งครั้งก่อนตัดสินใจไม่เดินลูป
   */
  useEffect(() => {
    layout()
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return undefined
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (!drag.current) pos.current += SPIN * dt
      layout()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [layout])

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { y: e.clientY, from: pos.current, id: e.pointerId }
    setGrabbing(true)
    root.current?.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    /* ลากขึ้น = ใบถัดไปไหลเข้ามา (ทิศเดียวกับการเลื่อนหน้า) */
    pos.current = d.from - (e.clientY - d.y) * DRAG
    layout()
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    setGrabbing(false)
  }

  return (
    <div
      ref={root}
      /* ลากได้ = ต้องรับเมาส์เอง (กลุ่มข้อความของจอตั้ง pointer-events: none ไว้ทั้งก้อน) */
      className="pointer-events-auto relative h-[44svh] w-[min(42vw,520px)] touch-none select-none overflow-hidden"
      style={{ cursor: grabbing ? 'grabbing' : 'grab' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-hidden
    >
      {SKILLS.map((s, i) => (
        <div
          key={s.label}
          ref={(el) => {
            items.current[i] = el
          }}
          className="absolute left-0 top-1/2 origin-left will-change-transform"
        >
          <Pill skill={s} />
        </div>
      ))}
    </div>
  )
}

/**
 * ป้ายหนึ่งใบ — ก้อนนูนสีพาสเทลตามภาพอ้างอิง
 *
 * ความนูนมาจากไล่สีในตัวก้อน ไฮไลต์บางที่ขอบบน และเงาอุ่นใต้ก้อน ไม่ใช่กรอบเส้น — และ
 * ความลึกของเงาผูกกับ `--sw-p` (ใกล้กลางวงแค่ไหน) ใบกลางจึงลอยเหนือใบที่กำลังเบลอออกไป
 */
function Pill({ skill }: { skill: Skill }) {
  const Icon = skill.icon
  return (
    <div
      className="flex items-center gap-[0.5em] rounded-[0.7em] px-[0.8em] py-[0.42em] text-[clamp(20px,2.6vw,40px)] font-semibold lowercase leading-none"
      style={{
        background: `linear-gradient(168deg, color-mix(in srgb, ${skill.bg} 74%, #fff) 0%, ${skill.bg} 56%, color-mix(in srgb, ${skill.bg} 80%, #6b46e8) 100%)`,
        color: skill.ink,
        boxShadow: `inset 0 0.06em 0 rgba(255,255,255,0.88), inset 0 -0.08em 0.12em rgba(107,70,232,0.14), 0 calc(0.18em + var(--sw-p, 0) * 0.42em) calc(0.4em + var(--sw-p, 0) * 0.9em) -0.3em rgba(76,44,150,0.3)`,
      }}
    >
      <Icon size="0.92em" stroke={2.4} style={{ flex: 'none' }} />
      {skill.label}
    </div>
  )
}

export default SkillWheel
