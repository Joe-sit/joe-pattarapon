import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import './portfolio2026final.css'
import './compact.css'
import { SITE } from '@/config/site'
import { heroView } from '@/newhero/heroView'
import { releaseIntro } from '@/newhero/intro'
import { resetNewHeroReady } from '@/newhero/ready'
import { useIntroDone } from '@/stores/intro'
import { fadeToArt, Headline3D, Headline3DField, useHeadlineArt } from '@/sections/hero/Headline3D'
import heroLife from '@/assets/v2final/hero-life.svg'

/**
 * /compact — hero แบบการ์ด ตาม ref creativecruise.nl
 *
 * ฉาก hero ตัวเดียวกับ /2026-final แต่วาดแบบ bare: ผ้าใบเต็มจอและโปร่ง ฟ้าถูกตัดให้อยู่ในการ์ด
 * ภาพเต็มเฟรมเดิมถูกย่อลงการ์ดแล้วยืดขึ้นเกินขอบบน (HERO_RISE) หน้าต่าง/ตัวละครจึงยืนบนการ์ด
 * แล้วโผล่ทะลุขอบบน แผ่นลอน S (newhero/WaveSlab) ยื่นพ้นขอบล่าง ของหลังการ์ดถูกตัดข้าง/ล่าง
 * (newhero/cardClip)
 *
 * shell ของตัวเอง (ไม่ผ่าน NavBar/Footer ของเว็บ) เหตุผลเดียวกับ NewHeroPage — ตัวห่อของเลย์เอาต์
 * หลักมี transform ทำให้ fixed ในหน้าลูกอ้างอิงตัวห่อแทนวิวพอร์ต
 */
const NewHeroScene = lazy(() => import('@/newhero/NewHeroScene'))

/** ของในฉากยืนบนการ์ดแล้วโผล่ทะลุขอบบนเท่านี้ (สัดส่วนความสูงการ์ด) */
const HERO_RISE = 0.38

/** เมนูมีปลายทางจริงทุกอัน — ยังไม่มีหน้าย่อยของชุดนี้ จึงชี้ไปเว็บเต็ม เรซูเม่ และอีเมลจริง */
const MENU: { label: string; href: string; external?: boolean }[] = [
  { label: 'Home', href: '/compact' },
  { label: 'Full site', href: '/2026-final' },
  { label: 'Resume', href: SITE.resumeUrl, external: true },
  { label: 'Contact', href: `mailto:${SITE.email}` },
]

function LifeArt() {
  const [el, setEl] = useState<HTMLImageElement | null>(null)
  const live = useHeadlineArt(el, heroLife)
  return <img ref={setEl} src={heroLife} alt="LIFE" className="v3-hero-life" style={fadeToArt(live)} />
}

export function CompactPage() {
  const entered = useIntroDone()
  const frame = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)

  /* ฉากต้องรู้กรอบการ์ดเป็นพิกเซล (ดู newhero/heroView) — วัดจากกล่องจริงตอนเปิดและย่อ/ขยายจอ */
  useEffect(() => {
    const read = () => {
      const f = frame.current?.getBoundingClientRect()
      const c = card.current
      if (!f || !c) return
      const r = c.getBoundingClientRect()
      heroView.x = r.left - f.left
      heroView.y = r.top - f.top
      heroView.w = Math.max(1, r.width)
      heroView.h = Math.max(1, r.height)
      heroView.r = parseFloat(getComputedStyle(c).borderTopLeftRadius) || 0
      const rise = HERO_RISE * heroView.h
      heroView.fx = heroView.x
      heroView.fy = heroView.y - rise
      heroView.fw = heroView.w
      heroView.fh = heroView.h + rise
      heroView.on = true
    }
    read()
    window.addEventListener('resize', read)
    return () => {
      window.removeEventListener('resize', read)
      heroView.on = false
      releaseIntro()
      resetNewHeroReady()
    }
  }, [])

  return (
    <main className={`v3 cp relative h-svh w-full overflow-hidden${entered ? ' v3-entered' : ''}`}>
      <div ref={frame} className="pointer-events-none fixed inset-0 [&_canvas]:pointer-events-auto">
        <div ref={card} className="cp-card" aria-hidden />
        <Suspense fallback={null}>
          <NewHeroScene bare />
        </Suspense>
      </div>

      {/* หัวเรื่องมุมขวาบนของการ์ด (ตำแหน่งเวิร์ดมาร์กใน ref) */}
      <div
        className="pointer-events-none absolute z-10 flex flex-col items-end text-[var(--v3-hero-ink)]"
        style={{
          top: 'calc(var(--cp-card-y) + var(--cp-card-h) * 0.07)',
          right: 'calc(var(--cp-card-x) + var(--cp-card-w) * 0.045)',
        }}
      >
        <h1 className="sr-only">Joe Pattarapon — Bring your ideas to life</h1>
        <Headline3DField active scale={0.62} className="flex flex-col items-start gap-[clamp(4px,1.2svh,12px)]">
          <Headline3D text="Bring your" className="v3-h1" />
          <Headline3D text="Ideas" className="v3-h1" />
          <div className="flex items-end gap-[clamp(10px,1.7vw,24px)]">
            <Headline3D text="to" className="v3-h1" />
            <LifeArt />
          </div>
        </Headline3DField>
      </div>

      <nav
        aria-label="Main"
        className="cp-nav fixed bottom-[clamp(14px,3svh,28px)] left-1/2 z-30 -translate-x-1/2 rounded-full p-[5px]"
      >
        <ul className="flex items-center gap-1 text-[15px] text-[#2052cd]">
          {MENU.map((m) => (
            <li key={m.label}>
              <a
                href={m.href}
                {...(m.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                aria-current={m.href === '/compact' ? 'page' : undefined}
                className="cp-link block cursor-pointer rounded-full px-[clamp(14px,1.4vw,20px)] py-[9px] whitespace-nowrap"
              >
                {m.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  )
}
