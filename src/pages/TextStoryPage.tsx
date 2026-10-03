import { useEffect, useRef } from 'react'
import { JOURNEY } from '@/data/journey'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { SITE } from '@/config/site'

/**
 * /text-story — เรื่องของ /2026-final เล่าด้วยตัวหนังสือแบบภาพยนตร์ (ภาพอ้างอิง "Welcome to a vivid new world")
 *
 *   เปิด       กล้องจ่อใกล้หัวเรื่อง ตัวอักษร reveal ทีละตัว (เบลอ+จาง+ลอยขึ้นเข้าที่) แล้วถอยออกจนเห็นทั้งประโยค
 *   ดาว        ดาวสี่แฉกหมุนโผล่ท้ายประโยค
 *   ลำแสง      ยิงออกจากปลายดาวไปทางขวา ยาวขึ้นตามการเลื่อน กล้องแพนตาม (side scrolling) — แต่ละบทของเรื่อง
 *              วางเรียงบนลำแสง โผล่ (reveal) ตอนปลายแสงวิ่งผ่าน
 *
 * ข้อความทุกบทมาจากของจริงของเว็บ: หัวเรื่องกับคำแนะนำตัวของ hero, ฟองคำพูด, SKILLS, JOURNEY,
 * งาน Health Dashboards และอีเมลใน SITE — ไม่แต่งเนื้อหาใหม่ (คำอธิบาย Research ยังเป็นข้อความชั่วคราว จึงไม่ใช้)
 *
 * ค่าที่เปลี่ยนทุกเฟรมเขียนลง CSS var ตรง ๆ ใน rAF ไม่ผ่าน state ของ React
 */

/** หัวเรื่องเปิด — คำเดียวกับหัวเรื่องของ hero ("Bring your Ideas to LIFE") */
const LINE = [{ t: 'Bring' }, { t: 'your' }, { t: 'ideas', serif: true }, { t: 'to' }, { t: 'life' }]

const skill = (t: string) => SKILLS.find((k) => k.title === t)
type Chapter = { kicker: string; title: string; body?: string }
const CHAPTERS: Chapter[] = [
  {
    kicker: "Hello, I'm Joe",
    title: 'UX/UI Designer',
    body: 'I love crafting valuable things with passionate people to bringing design to a real-world impact solution.',
  },
  { kicker: 'Here is what I do', title: 'Research · Design · Coding' },
  { kicker: 'Design', title: 'Product flows & interfaces', body: skill('Design')?.desc },
  { kicker: 'Coding', title: 'From design to real apps', body: skill('Coding')?.desc },
  ...JOURNEY.map((j) => ({ kicker: j.at, title: j.role, body: j.org.replace(/ Co,\. Ltd\.$/, '') })),
  {
    kicker: 'My work · Health Dashboards',
    title: '200+ hospitals, 1M+ records',
    body: 'Designed national-scale health dashboards for 200+ hospitals in collaboration with the Ministry of Public Health, transforming 1M+ health records into actionable insights.',
  },
  { kicker: "Let's talk", title: SITE.email },
]

/* ระยะเลื่อนของแต่ละท่า — หน่วย "จอ" (ความสูงวิวพอร์ต) */
const BEAM_AT = 2.4
/** ปลายแสงวิ่งกี่ vw ต่อการเลื่อนหนึ่งจอ */
const BEAM_SPEED = 100
/** บทแรกห่างดาวกี่ vw และบทถัดไปห่างกันเท่าไร */
const CH_FIRST = 70
const CH_GAP = 90
const LAST = CH_FIRST + (CHAPTERS.length - 1) * CH_GAP
/** ความยาวของ section (จอ) — เลื่อนจนบทสุดท้ายเข้าที่ แล้วค้างให้อ่านอีกราวครึ่งจอ */
const SECTION_VH = BEAM_AT + (LAST + 80) / BEAM_SPEED + 1.2

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")"

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export function TextStoryPage() {
  const root = useRef<HTMLElement>(null)
  const chapters = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const el = root.current
    if (!el) return undefined
    let raf = 0
    const read = () => {
      raf = 0
      const vh = window.innerHeight || 1
      const s = Math.max(0, -el.getBoundingClientRect().top / vh)
      /* เปิดหน้ามาต้องเห็นคำแรกกำลังก่อตัวแล้ว ไม่ใช่จอว่าง (เริ่มที่ 0.12) */
      el.style.setProperty('--reveal', clamp01(0.12 + s / 1.5).toFixed(4))
      el.style.setProperty('--zoom', clamp01((s - 1.2) / 1.4).toFixed(4))
      el.style.setProperty('--star', clamp01((s - 1.9) / 0.5).toFixed(4))
      /* ลำแสง: ยาวขึ้นตามการเลื่อน กล้องเริ่มแพนเมื่อปลายแสงออกไปเกิน 75vw (ถึงขอบขวาจอ) แล้วตามด้วยความเร็วเท่ากัน
         หัวแสงจึงค้างอยู่ที่ขอบขวาจอ ส่วนตัวแสงไหลผ่านจอไปทางซ้าย */
      const tip = Math.max(0, s - BEAM_AT) * BEAM_SPEED
      el.style.setProperty('--beam-len', `${(tip > 0 ? tip + 20 : 0).toFixed(2)}vw`)
      el.style.setProperty('--beam-on', clamp01(tip / 8).toFixed(3))
      el.style.setProperty('--pan', `${(-Math.max(0, tip - 75)).toFixed(2)}vw`)
      /* แต่ละบทโผล่เมื่อแสงคลุมถึงแล้ว — ไถลเข้ามาจากขอบขวาบนตัวแสง ไม่ใช่ขึ้นบนพื้นขาวหน้าหัวแสง */
      chapters.current.forEach((c, i) => {
        if (!c) return
        const x = CH_FIRST + i * CH_GAP
        c.style.setProperty('--k', clamp01((tip - (x + 5)) / 40).toFixed(3))
      })
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
    }
  }, [])

  let i = 0
  return (
    <main className="ts-page">
      <style>{CSS}</style>
      <section ref={root} className="ts-root" style={{ height: `${SECTION_VH * 100}svh` }}>
        <div className="ts-view">
          {/* โลกของฉาก: ซูม (ช่วงแรก) แล้วแพนไปขวา (ช่วงลำแสง) — จุดยึดการซูมคือต้นประโยค */}
          <div className="ts-world">
            <div className="ts-anchor">
              <h1 className="ts-line" aria-label={LINE.map((w) => w.t).join(' ')}>
                {LINE.map((w) => (
                  <span key={w.t} className={`ts-word${w.serif ? ' ts-serif' : ''}`} aria-hidden>
                    {[...w.t].map((ch) => {
                      const k = i++
                      return (
                        <span key={k} className="ts-ch" style={{ ['--i' as string]: k }}>
                          {ch}
                        </span>
                      )
                    })}
                  </span>
                ))}
              </h1>
              {/* ดาวสี่แฉก — ต้นทางของลำแสงและของทุกบทที่ตามมา */}
              <span className="ts-star">
                <svg viewBox="0 0 100 100" aria-hidden>
                  <defs>
                    <linearGradient id="ts-star-g" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stopColor="#49d6e8" />
                      <stop offset="0.45" stopColor="#8fe3ff" />
                      <stop offset="0.55" stopColor="#ff6fae" />
                      <stop offset="1" stopColor="#ff9a4a" />
                    </linearGradient>
                  </defs>
                  <path d="M50 0 C54 34 66 46 100 50 C66 54 54 66 50 100 C46 66 34 54 0 50 C34 46 46 34 50 0Z" fill="url(#ts-star-g)" />
                </svg>
                {/* เบลอที่ชั้นนอก ตัดทรงที่ชั้นใน — ตัดทรงหลังเบลอจะได้ขอบคมกลับมา */}
                <span className="ts-beam" aria-hidden>
                  <span className="ts-beam-fill">
                    <span className="ts-grain" />
                  </span>
                </span>
                {/* บทของเรื่อง เรียงบนลำแสง */}
                <span className="ts-chapters">
                  {CHAPTERS.map((c, k) => (
                    <div
                      key={c.kicker + c.title}
                      ref={(n) => {
                        chapters.current[k] = n
                      }}
                      className="ts-chapter"
                      style={{ left: `${CH_FIRST + k * CH_GAP}vw` }}
                    >
                      <p className="ts-kicker">{c.kicker}</p>
                      <h2 className="ts-title">{c.title}</h2>
                      {c.body && <p className="ts-body">{c.body}</p>}
                    </div>
                  ))}
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

const CSS = `
.ts-page {
  background: #f6f4f4;
  color: #10152b;
  min-height: 100svh;
}
.ts-root {
  position: relative;
  --reveal: 0.12;
  --zoom: 0;
  --star: 0;
  --beam-len: 0vw;
  --beam-on: 0;
  --pan: 0vw;
}
.ts-view {
  position: sticky;
  top: 0;
  height: 100svh;
  overflow: hidden;
}
/* กล้อง: ซูมจาก 2.6 เท่าลงมาหนึ่งเท่า (ease กำลังสอง) แล้วแพนตามลำแสง */
.ts-world {
  position: absolute;
  inset: 0;
  transform: translateX(var(--pan)) scale(calc(2.6 - 1.6 * (1 - (1 - var(--zoom)) * (1 - var(--zoom)))));
  /* ยึดการซูมไว้ที่ต้นประโยค — ภาพแรกคือคำแรก ๆ ตัวโตเต็มจอ แล้วถอยจนเห็นทั้งประโยค */
  transform-origin: 11vw 50%;
  will-change: transform;
}
.ts-anchor {
  position: absolute;
  left: 6vw;
  top: 50%;
  display: flex;
  align-items: center;
  gap: clamp(14px, 1.6vw, 26px);
  transform: translateY(-50%);
}
.ts-line {
  margin: 0;
  display: flex;
  gap: 0.28em;
  font-family: var(--v3-body, 'Momo Trust Sans', 'Mona Sans', system-ui, sans-serif);
  font-weight: 500;
  font-size: clamp(22px, 2.3vw, 40px);
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.ts-serif {
  font-family: 'Instrument Serif', 'Iowan Old Style', Georgia, serif;
  font-style: italic;
  font-weight: 400;
  font-size: 1.12em;
}
.ts-word {
  display: inline-flex;
}
/* reveal ทีละตัว: ตัวที่ i เริ่มช้ากว่ากัน — เบลอ จาง และต่ำกว่าที่ของมัน แล้วเข้าที่ */
.ts-ch {
  --k: clamp(0, calc(var(--reveal) * 2.4 - var(--i) * 0.07), 1);
  display: inline-block;
  opacity: var(--k);
  filter: blur(calc((1 - var(--k)) * 10px));
  transform: translateY(calc((1 - var(--k)) * 0.45em));
}
.ts-star {
  position: relative;
  width: clamp(40px, 4.4vw, 70px);
  aspect-ratio: 1;
  flex: none;
  transform: scale(var(--star)) rotate(calc((1 - var(--star)) * -120deg));
}
.ts-star svg {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: block;
  filter: drop-shadow(0 6px 14px rgba(255, 95, 158, 0.25));
}
/**
 * ลำแสง: บานเป็นกรวยจากปลายดาวในช่วง 60vw แรก แล้ววิ่งต่อเป็นแถบสูงเกือบเต็มจอ
 * (ถ้าบานเป็นกรวยไปตลอด บทแรก ๆ จะไปตกอยู่ในส่วนที่แคบจนตัวหนังสือล้นแสง)
 */
.ts-beam {
  position: absolute;
  left: 92%;
  top: 50%;
  width: var(--beam-len);
  height: 108svh;
  transform: translateY(-50%);
  filter: blur(14px);
  opacity: var(--beam-on);
  /* โคนจางเข้าหาดาว และปลายที่กำลังวิ่งจางออก — ไม่มีขอบตั้งตรงตัดที่หัวลำแสง */
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 9vw, #000 calc(100% - 16vw), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 9vw, #000 calc(100% - 16vw), transparent 100%);
}
.ts-beam-fill {
  position: absolute;
  inset: 0;
  clip-path: polygon(0 50%, 60vw 4%, 100% 4%, 100% 96%, 60vw 96%);
  background: linear-gradient(180deg, #fff4dc 0%, #ffd27a 14%, #ff9a3c 32%, #ff6f8f 50%, #ff5fae 60%, #7fd6f2 82%, #d8f4ff 100%);
}
.ts-grain {
  position: absolute;
  inset: 0;
  background: ${GRAIN};
  opacity: 0.4;
  mix-blend-mode: overlay;
}
/* บทของเรื่อง: ตัวขาวบนลำแสง จัดกลางแนวแสง โผล่ด้วยท่าเดียวกับหัวเรื่อง (เบลอ จาง เลื่อนเข้า) */
.ts-chapters {
  position: absolute;
  left: 100%;
  top: 50%;
}
.ts-chapter {
  --k: 0;
  position: absolute;
  top: 0;
  width: min(62vw, 760px);
  transform: translate(calc((1 - var(--k)) * 6vw), -50%);
  opacity: var(--k);
  filter: blur(calc((1 - var(--k)) * 12px));
  color: #fff;
  text-shadow: 0 2px 24px rgba(120, 30, 60, 0.28);
}
.ts-chapter p,
.ts-chapter h2 {
  margin: 0;
}
.ts-kicker {
  font-family: var(--v3-body, 'Momo Trust Sans', system-ui, sans-serif);
  font-weight: 700;
  font-size: clamp(13px, 1.1vw, 18px);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.9;
}
.ts-title {
  font-family: var(--v3-display, 'Momo Trust Display', system-ui, sans-serif);
  font-weight: 800;
  font-size: clamp(34px, 5.2vw, 88px);
  line-height: 1;
  letter-spacing: -0.02em;
  margin-top: 0.25em !important;
}
.ts-body {
  font-family: var(--v3-body, 'Momo Trust Sans', system-ui, sans-serif);
  font-size: clamp(15px, 1.35vw, 22px);
  line-height: 1.45;
  max-width: 36em;
  margin-top: 1em !important;
  opacity: 0.95;
}
@media (prefers-reduced-motion: reduce) {
  .ts-ch,
  .ts-chapter {
    filter: none;
  }
}
`
