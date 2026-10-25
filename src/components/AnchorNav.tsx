import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@/i18n/store'
import type { TranslationKey } from '@/i18n/dict'

/** จุดหมายหนึ่งจุดบนราว — id คือ element ที่จะเลื่อนไปหา */
export type AnchorSection = { id: string; label: string; color?: string }

const DEFAULT_SECTIONS: { id: string; key: TranslationKey }[] = [
  { id: 'hero', key: 'anchor.intro' },
  { id: 'works', key: 'anchor.works' },
  { id: 'impact', key: 'anchor.impact' },
  { id: 'about', key: 'anchor.about' },
  { id: 'contact', key: 'anchor.contact' },
]

/**
 * ราวแบบ atlassian.design: จุด 12 ห่าง 24 · แถบสีคืบแบบหนอน (ครึ่งแรกหัวยืดไปถึงจุดถัดไป ครึ่งหลังหางตามไป)
 * สีของแถบไล่จากสีของจอหนึ่งไปอีกจอตามระยะเลื่อน
 */
const DOT = 12
const STEP = DOT + 24
/** สีต่อจอ (วนซ้ำ) — ฟ้า · เขียวมะนาว · ม่วง · ส้ม ของหน้า */
const COLORS = ['#265ada', '#94c748', '#ad85fe', '#fd5000']

const smooth = (x: number) => {
  const u = Math.min(1, Math.max(0, x))
  return u * u * (3 - 2 * u)
}

function hexRgb(h: string) {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function getSectionTops(sections: AnchorSection[]) {
  return sections.map((s) => {
    const el = document.getElementById(s.id)
    return el ? el.getBoundingClientRect().top + window.scrollY : Infinity
  })
}

type RailState = { top: number; height: number; color: string; activeIndex: number }

function mixHex(a: string, b: string, t: number) {
  const [x, y] = [hexRgb(a), hexRgb(b)]
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}

function computeRailState(sections: AnchorSection[]): RailState {
  const col = (i: number) => sections[i]?.color ?? COLORS[i % COLORS.length]
  const at = (i: number): RailState => ({ top: i * STEP, height: DOT, color: col(i), activeIndex: i })
  if (window.scrollY <= 0 || sections.length === 0) return at(0)

  const tops = getSectionTops(sections)
  const trigger = window.scrollY + window.innerHeight * 0.4

  for (let j = 0; j < sections.length - 1; j++) {
    if (trigger >= tops[j] && trigger < tops[j + 1]) {
      const frac = (trigger - tops[j]) / (tops[j + 1] - tops[j])
      const head = smooth(frac * 2)
      const tail = smooth(frac * 2 - 1)
      return {
        top: (j + tail) * STEP,
        height: (head - tail) * STEP + DOT,
        color: mixHex(col(j), col(j + 1), smooth((frac - 0.25) * 2)),
        activeIndex: Math.round(j + frac),
      }
    }
  }

  return at(trigger < tops[0] ? 0 : sections.length - 1)
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * ราวจุดนำสายตาด้านซ้าย
 *
 * ไม่ระบุ `sections` = ใช้หัวข้อของหน้าแรก (ป้ายมาจาก i18n) หน้าอื่นส่งรายการของตัวเองเข้ามาได้
 */
export function AnchorNav({
  sections,
  className,
}: {
  sections?: AnchorSection[]
  className?: string
} = {}) {
  const t = useT()
  const [active, setActive] = useState(0)
  const pill = useRef<HTMLDivElement>(null)

  const list = useMemo<AnchorSection[]>(
    () => sections ?? DEFAULT_SECTIONS.map((s) => ({ id: s.id, label: t(s.key) })),
    [sections, t],
  )
  // listener ผูกครั้งเดียว แต่ต้องอ่านรายการล่าสุดเสมอ — ผ่าน ref ไม่ใช่ dependency
  const listRef = useRef(list)
  listRef.current = list

  /* เขียนแถบตรงลง DOM ครั้งละเฟรม (ไม่ setState ทุก scroll) — ตามสกรอลล์ 1:1 ไม่มี transition หน่วง */
  useEffect(() => {
    let raf = 0
    const draw = () => {
      raf = 0
      const r = computeRailState(listRef.current)
      const el = pill.current
      if (el) {
        el.style.transform = `translateY(${r.top.toFixed(2)}px)`
        el.style.height = `${r.height.toFixed(2)}px`
        el.style.backgroundColor = r.color
      }
      setActive(r.activeIndex)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div
      className={`anchor-nav fixed top-1/2 left-16 z-40 w-7 -translate-y-1/2 rounded-[100px] bg-panel p-2 shadow-rail transition-opacity duration-300 max-lg:hidden${
        className ? ` ${className}` : ''
      }`}
    >
      <div className="relative flex w-3 flex-col gap-6">
        {list.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollToSection(s.id)}
            aria-label={s.label}
            aria-current={active === i}
            className="group relative flex size-3 shrink-0 cursor-pointer items-center justify-center"
          >
            <span className="block size-3 rounded-full bg-[#dcdde2]" />
            <span
              className={`pointer-events-none absolute top-1/2 left-[calc(100%+10px)] -translate-y-1/2 text-xs font-medium whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${
                active === i ? 'text-brand-orange' : 'text-ink'
              }`}
            >
              {s.label}
            </span>
          </button>
        ))}

        {/* แถบสีคืบ — ตำแหน่ง/ความสูง/สีเขียนตรงจากลูปเลื่อน (ดู draw) */}
        <div ref={pill} className="pointer-events-none absolute top-0 left-0 w-3 rounded-[100px]" style={{ height: DOT, backgroundColor: COLORS[0] }} />
      </div>
    </div>
  )
}
