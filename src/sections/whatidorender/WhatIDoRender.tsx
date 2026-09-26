import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { BG, CAM_Z, FOV, RenderScene, flow } from './RenderScene'
import { SCREENS, TL, clamp01, skillStep, span } from './timeline'

/**
 * จอ "สิ่งที่ทำ" แบบเรนเดอร์ — ตามเว็บอ้างอิง guillaumecolombel.fr
 *
 * ตัวละครเป็นเส้นโครงจาง ๆ → หน้าต่าง mac โผล่ทีละบาน (แต่ละบานเป็นพอร์ทัลมองเข้าไปเห็น
 * ตัวละคร 3D ตัวเดียวกันผ่านคนละขั้นของการเรนเดอร์) → ไทล์เรนเดอร์จนเต็มจอเป็นโลกจริง →
 * วงแหวนชื่อสกิลรอบตัว หมุนทีละสกิล สีฉากเปลี่ยนตาม
 *
 * ### ทำไมทั้งหมดอยู่ในแคนวาสเดียว
 *
 * หน้าต่างทุกบานกับโลกจริงเป็นช่องมองไปที่ตัวละครชุดเดียวกันผ่าน stencil (ดู ./RenderScene)
 * และวงแหวนต้องลอดหลังตัวละครด้วยความลึกจริง — ทั้งหมดต้องอยู่ในบัฟเฟอร์เดียว แยกชั้น DOM
 * ไม่ได้ ข้อความยาว (คำบรรยายสกิล) เท่านั้นที่อยู่ใน DOM เพราะตัวอักษรของเบราว์เซอร์คมกว่า
 * และเลือก/อ่านออกเสียงได้
 *
 * ### ความคืบหน้า
 *
 * ลูปเลื่อนเขียน `flow.p` (0..1) ทุกเฟรม แบบมีความหนืด: ล้อเมาส์มาเป็นก้อน ถ้าวาดตามค่าดิบ
 * ท่าทั้งจอจะกระตุกตามคลิกล้อ ค่าเดียวกันนี้ถูกเขียนเป็น `--p` ให้ชั้น DOM ด้วย — ไม่ผ่าน
 * state ของ React (เปลี่ยนทุกเฟรม) มี state ตัวเดียวคือ "สกิลไหนอยู่หน้า" ซึ่งเปลี่ยนนาน ๆ ครั้ง
 */
/** ฟอนต์ของ /2026-final (`--v3-display` / `--v3-body`) — ตัวแปรพวกนั้นมีเฉพาะในขอบเขตของ
 * หน้านั้น จอนี้ถูกวางแยกหน้าได้ จึงระบุชุดฟอนต์ตรง ๆ */
const DISPLAY_FONT = "'Momo Trust Display', 'Mona Sans', system-ui, sans-serif"
const BODY_FONT = "'Momo Trust Sans', 'Mona Sans', system-ui, sans-serif"

export function WhatIDoRender() {
  const sec = useRef<HTMLElement | null>(null)
  const pin = useRef<HTMLDivElement | null>(null)
  const [skill, setSkill] = useState(0)
  /* เรนเดอร์เฉพาะตอนจออยู่ในสายตา — ฉากนี้มีเชดเดอร์เต็มจอหลายชั้น ปล่อยเดินเปล่าไม่ได้ */
  const [live, setLive] = useState(false)

  useEffect(() => {
    const el = sec.current
    if (!el) return undefined
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const el = sec.current
    const box = pin.current
    if (!el || !box) return undefined
    let raf = 0
    let now = flow.p
    let last = -1
    let prev = performance.now()
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.1, (t - prev) / 1000)
      prev = t
      const r = el.getBoundingClientRect()
      const run = Math.max(1, r.height - window.innerHeight)
      const aim = clamp01(-r.top / run)
      /* หน่วงแบบอิงเวลา: จอ 120Hz ได้ท่าเดียวกับจอ 60Hz */
      now += (aim - now) * (1 - Math.exp(-dt * 7))
      if (Math.abs(aim - now) < 0.0002) now = aim
      flow.p = now
      box.style.setProperty('--p', now.toFixed(4))
      box.style.setProperty('--ring', span(now, TL.ring).toFixed(3))
      box.style.setProperty('--intro', (1 - span(now, [TL.win[0], TL.win[0] + 0.06])).toFixed(3))
      const s = Math.round(skillStep(now, SKILLS.length))
      if (s !== last) {
        last = s
        setSkill(s)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const cur = SKILLS[skill]
  return (
    <section
      ref={sec}
      className="relative w-full"
      style={{ height: `${SCREENS * 100}svh`, background: BG }}
      aria-label="What I do"
    >
      <div ref={pin} className="sticky top-0 h-svh w-full overflow-hidden">
        <Canvas
          className="!absolute inset-0"
          frameloop={live ? 'always' : 'never'}
          dpr={[1, 2]}
          /* stencil: หน้าต่างทุกบานเป็นพอร์ทัลที่ทำด้วย stencil buffer ซึ่ง r3f ไม่ได้ขอมาให้เอง */
          gl={{ antialias: true, alpha: false, stencil: true }}
          camera={{ position: [0, 0, CAM_Z], fov: FOV, near: 1, far: 60 }}
        >
          <Suspense fallback={null}>
            <RenderScene />
          </Suspense>
        </Canvas>

        {/**
         * ชั้นข้อความ — ภาษาเดียวกับ /2026-final: เม็ด pill ขาว/ส้ม การ์ดขาวมุมมน ฟอนต์ Momo
         *
         * ข้อความลอยบนทั้งฟ้าอ่อนและรูป (ซึ่งเปลี่ยนสีได้ทุกสี) จึงไม่ปล่อยเป็นตัวหนังสือเปล่า ๆ
         * ทุกชิ้นมีพื้นขาวของตัวเอง อ่านออกบนพื้นทุกแบบ — วิธีเดียวกับปุ่ม Resume ของหน้า
         */}
        <div
          className="pointer-events-none absolute left-6 top-5 rounded-full bg-white px-4 py-1.5 text-[13px] text-[#16181f] shadow-[0_6px_20px_-8px_rgba(22,24,31,0.35)]"
          style={{ fontFamily: BODY_FONT }}
        >
          What I do
        </div>

        {/* คำเปิดจอ: ใต้เส้นรอบตัว แล้วหายไปเมื่อหน้าต่างบานแรกโผล่ */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[8vh] flex justify-center"
          style={{ opacity: 'var(--intro, 1)' }}
        >
          <span
            className="rounded-full bg-[#fd5000] px-5 py-2 text-[14px] text-white shadow-[0_10px_24px_-10px_rgba(253,80,0,0.7)]"
            style={{ fontFamily: BODY_FONT }}
          >
            Scroll to render
          </span>
        </div>

        {/* การ์ดคำบรรยายของสกิลที่อยู่หน้าวงแหวน — ขึ้นพร้อมวงแหวน เปลี่ยนตามสกิล */}
        <div
          className="pointer-events-none absolute bottom-[6vh] left-6 max-w-[23rem] rounded-[22px] bg-white p-5 text-[#16181f] shadow-[0_18px_40px_-18px_rgba(22,24,31,0.45)] sm:left-10"
          style={{
            opacity: 'var(--ring, 0)',
            transform: 'translateY(calc((1 - var(--ring, 0)) * 24px))',
            fontFamily: BODY_FONT,
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-[12px] text-white"
              style={{ background: cur.color }}
            >
              {String(skill + 1).padStart(2, '0')} / {String(SKILLS.length).padStart(2, '0')}
            </span>
            <span className="text-[20px] leading-none" style={{ fontFamily: DISPLAY_FONT }}>
              {cur.title}
            </span>
          </div>
          <p key={cur.title} className="text-[15px] leading-relaxed text-[#3a3d46]">
            {cur.desc}
          </p>
        </div>
      </div>
    </section>
  )
}
