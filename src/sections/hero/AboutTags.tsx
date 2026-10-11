import { useEffect, useRef } from 'react'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { ABOUT_STORY, CHAT_ITEM, DIAGRAM_MORPH, aboutBox, aboutCubeBox, aboutQuad } from './aboutBox'

/**
 * ป้ายเม็ดยาขาวลอยรอบตัวละครตอนโบกทัก (ภาพอ้างอิงนักบินอวกาศ) — ชื่อสกิลจริง ไม่มีคำแต่ง
 *
 * เด้งออกทีละป้ายหลังตัวละครโผล่ ลอยขึ้นลงเบา ๆ
 * เรื่อง 'window': การ์ดถูกดึงเป็นหน้าต่างบิด ป้ายบินไปเกาะมุมเป็นชื่อสกิลข้างจุดจับแดง (ป้ายเม็ดยาค่อย ๆ เหลือแต่ตัวหนังสือ)
 * มุมของสกิลที่กำลังเล่าป้ายเด่น · เรื่อง 'binoc': ตัวละครหันไปส่องกล้อง ป้ายหดกลับเข้าตัว
 * ชั้น DOM ทับแคนวาส (กรอบเดียวกับเนื้อหาของพาเนล) เขียนสไตล์ตรงในลูปของตัวเอง
 */
/** ตำแหน่งตอนตัวละครโผล่จากฟอง (เต็มจอ — ตัวละครกลางจอ) */
const CHAT_AT = [
  { cx: 0.36, cy: 0.5, cat: 0.55 },
  { cx: 0.65, cy: 0.54, cat: 0.68 },
  { cx: 0.38, cy: 0.64, cat: 0.8 },
]
const TAGS = [
  { title: 'Design', x: 0.17, y: 0.44, at: 0.55 },
  { title: 'Coding', x: 0.74, y: 0.56, at: 0.68 },
  { title: 'Research', x: 0.25, y: 0.76, at: 0.8 },
].map((t, i) => {
  const sk = SKILLS.find((s) => s.title === t.title)
  /* Research ยังเป็น Lorem รอเขียน — ไม่แสดงคำอธิบาย */
  return { ...t, ...CHAT_AT[i], label: sk?.title ?? t.title, color: sk?.color ?? '#ffffff', desc: sk && t.title !== 'Research' ? sk.desc : '' }
})

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth01 = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}
const outBack = (x: number) => {
  const u = clamp01(x) - 1
  return 1 + 2.6 * u * u * u + 1.6 * u * u
}

export function AboutTags({ on }: { on: boolean }) {
  const els = useRef<(HTMLDivElement | null)[]>([])
  const handles = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    if (!on) return undefined
    let raf = 0
    const t0 = performance.now()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const b = aboutBox
      const t = (performance.now() - t0) / 1000
      const binoc = ABOUT_STORY === 'binoc'
      const gone = binoc ? clamp01(b.xray / 0.18) : 0
      /* เรื่องแชท: มุมใน aboutQuad คือมุมจริงของทรงเฟรมนี้ (ไหลจากกรอบฟองไปมุมเป้า) — จุดจับเกาะมุมตั้งแต่เริ่มดึง */
      const m = binoc ? 0 : b.chat ? smooth01((aboutQuad.m - 0.1) / 0.45) : aboutQuad.m
      const q = aboutQuad.c
      const qx = (q[0] + q[2] + q[4] + q[6]) / 4
      const qy = (q[1] + q[3] + q[5] + q[7]) / 4
      /*
       * เรื่องกล่องแก้ว: ป้ายเรียงซ้อนข้างขวากล่อง โผล่ทีละป้ายตอนกล่องขยาย · สกิลที่กำลังเล่า (ชิ้นที่ยื่นออก)
       * ป้ายเด่น ขึ้นคำอธิบายจริง · อื่น ๆ จาง
       */
      if ((CHAT_ITEM === 'cube' || !DIAGRAM_MORPH) && b.chat) {
        handles.current.forEach((h) => h && (h.style.visibility = 'hidden'))
        const c = aboutCubeBox
        const grow = b.quad
        const story = smooth01((grow - 0.85) / 0.15)
        let y = c.y - c.size * 0.55
        TAGS.forEach((g, i) => {
          const el = els.current[i]
          if (!el) return
          const raw = clamp01((grow - 0.45 - i * 0.12) / 0.25) * (c.on ? 1 : 0)
          const a = outBack(raw)
          const act = clamp01(1 - Math.abs(b.page - i) * 1.6) * story
          const x = c.x + c.size * 0.95 + (1 - a) * -c.size * 0.6
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${(y + Math.sin(t * 1.1 + i * 2) * 3).toFixed(1)}px, 0) scale(${(Math.max(0.001, a) * (1 + 0.06 * act)).toFixed(3)})`
          el.style.transformOrigin = 'left center'
          el.style.visibility = raw > 0 ? 'visible' : 'hidden'
          el.style.background = `rgba(255,255,255,${(0.5 + 0.45 * act).toFixed(3)})`
          el.style.boxShadow = act > 0.5 ? `0 14px 40px ${g.color}55` : '0 10px 30px rgba(30,60,140,0.16)'
          el.style.color = act > 0.5 ? '#151a33' : '#3a4766'
          el.style.whiteSpace = 'normal'
          el.style.width = 'clamp(200px, 20vw, 300px)'
          const d = el.querySelector<HTMLElement>('[data-desc]')
          if (d) {
            d.style.maxHeight = act > 0.5 ? '80px' : '0px'
            d.style.opacity = act > 0.5 ? '0.85' : '0'
          }
          const dot = el.querySelector<HTMLElement>('[data-dot]')
          if (dot) dot.style.display = 'inline-block'
          y += el.offsetHeight + 12
        })
        return
      }
      TAGS.forEach((g, i) => {
        const el = els.current[i]
        if (!el) return
        const raw = b.chat ? clamp01((b.emerge - g.cat) / 0.25) : clamp01((b.k - g.at) / 0.3) * (1 - gone)
        const a = outBack(raw)
        const w = el.offsetWidth
        const h = el.offsetHeight
        let x = (b.chat ? g.cx : g.x) * b.w - w / 2
        let y = (b.chat ? g.cy : g.y) * b.h - h / 2 + Math.sin(t * 1.2 + i * 2.1) * 5 * (1 - m)
        if (m > 0) {
          /* ป้ายเกาะมุม i ด้านนอก (ทิศจากกลางหน้าต่างไปมุม) */
          const cx = q[i * 2]
          const cy = q[i * 2 + 1]
          const sx = Math.sign(cx - qx) || 1
          const sy = Math.sign(cy - qy) || 1
          const lx = cx + sx * (w / 2 + 6) - w / 2
          const ly = cy + sy * (h / 2 + 10) - h / 2
          x = x + (lx - x) * m
          y = y + (ly - y) * m
        }
        const act = aboutQuad.pull[i]
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(Math.max(0.001, a) * (1 + 0.35 * m + 0.15 * act)).toFixed(3)})`
        el.style.visibility = raw > 0 ? 'visible' : 'hidden'
        /* เม็ดยาขาว → ตัวหนังสือล้วนบนพื้นพาเนล */
        el.style.background = `rgba(255,255,255,${(0.86 * (1 - m)).toFixed(3)})`
        el.style.boxShadow = `0 10px 30px rgba(30,60,140,${(0.16 * (1 - m)).toFixed(3)})`
        el.style.color = m > 0.5 ? `rgba(255,255,255,${(0.6 + 0.4 * act).toFixed(3)})` : '#3a4766'
      })
      handles.current.forEach((el, i) => {
        if (!el) return
        const k = outBack(clamp01((m - 0.3) / 0.5)) * (1 + 0.5 * (aboutQuad.pull[i] ?? 0))
        el.style.transform = `translate3d(${(q[i * 2] - 7).toFixed(1)}px, ${(q[i * 2 + 1] - 7).toFixed(1)}px, 0) scale(${Math.max(0.001, k).toFixed(3)})`
        el.style.visibility = k > 0.01 ? 'visible' : 'hidden'
      })
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [on])
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* จุดจับแดงที่มุมหน้าต่าง (เรื่อง 'window') */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          ref={(el) => {
            handles.current[i] = el
          }}
          className="absolute top-0 left-0 size-[14px] origin-center"
          style={{ visibility: 'hidden', background: '#ef4b5c', borderRadius: 2, boxShadow: '0 2px 8px rgba(120,20,40,0.3)' }}
        />
      ))}
      {TAGS.map((g, i) => (
        <div
          key={g.title}
          ref={(el) => {
            els.current[i] = el
          }}
          className="absolute top-0 left-0 origin-center whitespace-nowrap"
          style={{
            visibility: 'hidden',
            padding: '10px 18px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.86)',
            boxShadow: '0 10px 30px rgba(30,60,140,0.16)',
            backdropFilter: 'blur(8px)',
            color: '#3a4766',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 'clamp(14px, 1.2vw, 18px)',
            letterSpacing: '-0.01em',
          }}
        >
          <span data-dot className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ display: 'none', background: g.color }} />
          {g.label}
          {g.desc && (
            <div data-desc className="overflow-hidden text-[0.82em] leading-snug" style={{ maxHeight: 0, opacity: 0, transition: 'max-height 300ms, opacity 300ms' }}>
              <div className="pt-1.5">{g.desc}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
