import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@/i18n/store'
import type { TranslationKey } from '@/i18n/dict'

/** จุดหมายหนึ่งจุดบนราว — id คือ element ที่จะเลื่อนไปหา */
export type AnchorSection = { id: string; label: string }

const DEFAULT_SECTIONS: { id: string; key: TranslationKey }[] = [
  { id: 'hero', key: 'anchor.intro' },
  { id: 'works', key: 'anchor.works' },
  { id: 'impact', key: 'anchor.impact' },
  { id: 'about', key: 'anchor.about' },
  { id: 'contact', key: 'anchor.contact' },
]

const DOT = 16
const STEP = DOT + 24 // 40px per slot

function getSectionTops(sections: AnchorSection[]) {
  return sections.map((s) => {
    const el = document.getElementById(s.id)
    return el ? el.getBoundingClientRect().top + window.scrollY : Infinity
  })
}

type RailState = { pillTop: number; pillHeight: number; activeIndex: number }

const AT_TOP: RailState = { pillTop: 0, pillHeight: DOT, activeIndex: 0 }

function computeRailState(sections: AnchorSection[]): RailState {
  if (window.scrollY <= 0 || sections.length === 0) return AT_TOP

  const tops = getSectionTops(sections)
  const trigger = window.scrollY + window.innerHeight * 0.4

  for (let j = 0; j < sections.length - 1; j++) {
    if (trigger >= tops[j] && trigger < tops[j + 1]) {
      const frac = (trigger - tops[j]) / (tops[j + 1] - tops[j])
      const easedFrac = frac * frac * (3 - 2 * frac) // smoothstep
      return {
        pillTop: j * STEP,
        pillHeight: DOT + easedFrac * STEP,
        activeIndex: Math.round(j + frac),
      }
    }
  }

  // Past last known section
  const last = sections.length - 1
  return { pillTop: last * STEP, pillHeight: DOT, activeIndex: last }
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
  const [rail, setRail] = useState<RailState>(AT_TOP)

  const list = useMemo<AnchorSection[]>(
    () => sections ?? DEFAULT_SECTIONS.map((s) => ({ id: s.id, label: t(s.key) })),
    [sections, t],
  )
  // listener ผูกครั้งเดียว แต่ต้องอ่านรายการล่าสุดเสมอ — ผ่าน ref ไม่ใช่ dependency
  const listRef = useRef(list)
  listRef.current = list

  useEffect(() => {
    const onScroll = () => setRail(computeRailState(listRef.current))
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div
      className={`anchor-nav fixed top-1/2 left-16 z-40 hidden w-8 -translate-y-1/2 rounded-[100px] bg-panel p-2 shadow-rail transition-opacity duration-300 lg:block${
        className ? ` ${className}` : ''
      }`}
    >
      <div className="relative flex w-4 flex-col gap-6">
        {list.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollToSection(s.id)}
            aria-label={s.label}
            aria-current={rail.activeIndex === i}
            className="group relative flex size-4 shrink-0 cursor-pointer items-center justify-center"
          >
            <span className="block size-4 rounded-full bg-[#D9D9D9]" />
            <span
              className={`pointer-events-none absolute top-1/2 left-[calc(100%+10px)] -translate-y-1/2 text-xs font-medium whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${
                rail.activeIndex === i ? 'text-brand-orange' : 'text-ink'
              }`}
            >
              {s.label}
            </span>
          </button>
        ))}

        {/* Floating pill — inline style so it tracks scroll without class churn */}
        <div
          className="pointer-events-none absolute w-4 rounded-[100px] bg-brand-orange"
          style={{
            top: `${rail.pillTop}px`,
            height: `${rail.pillHeight}px`,
            transition: 'height 0.15s ease-out, top 0.15s ease-out',
          }}
        />
      </div>
    </div>
  )
}
