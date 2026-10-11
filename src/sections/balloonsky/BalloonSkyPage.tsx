import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { BalloonScene, story } from './BalloonScene'
import { BEATS, beatOf } from './story'

/**
 * /balloons — "Pip กับบอลลูน" ฉากพาสเทลบนฟ้า (ภาพอ้างอิง: หุ่นหัวกล้องยืนบนหอก้อนอิฐ เมฆปุย บอลลูนลอยรอบ)
 *
 * เลื่อนลงเพื่อเล่า: Pip เฝ้ามองฟ้า → กล้องถอยเห็นบอลลูนทั้งฝูง → Pip ลั่นชัตเตอร์ → บอลลูนลูกหนึ่งลงมารับ
 * → Pip กระโดดขึ้นตะกร้า → ลอยทะลุเมฆขึ้นไปเหนือทะเลเมฆตอนแดดอุ่น
 *
 * ระยะเลื่อนเขียนลง story.p (ไม่ผ่าน React) ฉาก 3D อ่านทุกเฟรมแล้วหน่วงเอง · ข้อความแต่ละบทเลื่อนเข้า/ออกตามบท
 */
export function BalloonSkyPage() {
  const root = useRef<HTMLDivElement>(null)
  const lines = useRef<(HTMLDivElement | null)[]>([])
  const flash = useRef<HTMLDivElement>(null)
  const hint = useRef<HTMLDivElement>(null)
  const sky = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = 'Pip & the Balloons'
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = root.current
      if (!el) return
      const max = Math.max(1, el.scrollHeight - window.innerHeight)
      story.p = Math.min(1, Math.max(0, window.scrollY / max))
      /* ข้อความใช้ค่าที่หน่วงแล้วของฉาก — ขึ้นพร้อมภาพ ไม่นำหน้า */
      const s = story.smooth
      BEATS.forEach((b, i) => {
        const d = lines.current[i]
        if (!d) return
        const k = beatOf(s, b)
        d.style.opacity = k.toFixed(3)
        d.style.transform = `translate3d(0, ${((1 - k) * (s < b.at ? 40 : -40)).toFixed(1)}px, 0)`
      })
      if (flash.current) flash.current.style.opacity = story.flash.toFixed(3)
      if (hint.current) hint.current.style.opacity = String(Math.max(0, 1 - s / 0.04))
      /* เหนือทะเลเมฆตอนจบ ฟ้าอุ่นขึ้นเป็นแดดเย็น */
      if (sky.current) sky.current.style.opacity = Math.min(1, Math.max(0, (s - 0.8) / 0.18)).toFixed(3)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={root} className="relative w-full" style={{ height: '760svh', background: '#d9d4f6' }}>
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        {/* ฟ้าไล่สี — ส่วนหนึ่งของภาพ เมฆกับหมอกในฉากผสมเข้าหาสีนี้ */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, #b9b3ee 0%, #d5d0f6 38%, #ece4f8 72%, #f7e8f1 100%)',
          }}
        />
        <div
          ref={sky}
          className="absolute inset-0"
          style={{ opacity: 0, background: 'linear-gradient(180deg, #a99ee8 0%, #e2c6ef 45%, #ffd9cf 78%, #ffe9c9 100%)' }}
        />
        <Canvas
          className="!absolute inset-0"
          dpr={[1, 1.75]}
          shadows
          camera={{ fov: 32, position: [0, 3.2, 6], near: 0.1, far: 140 }}
          gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }}
        >
          <BalloonScene />
        </Canvas>

        {/* แฟลชตอนลั่นชัตเตอร์ */}
        <div ref={flash} className="pointer-events-none absolute inset-0 bg-white" style={{ opacity: 0 }} />

        <div className="pointer-events-none absolute top-8 left-8 select-none text-[13px] tracking-[0.2em] text-[#4b3f8f] uppercase md:left-12">
          Pip &amp; the Balloons
        </div>

        {/* บทเล่า — มุมซ้ายล่าง ทีละบท */}
        <div className="pointer-events-none absolute bottom-[12svh] left-8 select-none md:left-16">
          {BEATS.map((b, i) => (
            <div
              key={b.text}
              ref={(d) => {
                lines.current[i] = d
              }}
              className="absolute bottom-0 left-0 w-[min(84vw,640px)]"
              style={{ opacity: 0 }}
            >
              <div className="mb-3 text-[12px] tracking-[0.24em] text-[#6b5fc4] uppercase">{b.kicker}</div>
              <div className="text-[clamp(30px,4.4vw,64px)] leading-[1.05] font-medium tracking-[-0.02em] text-[#2d2468]">{b.text}</div>
            </div>
          ))}
        </div>

        <div
          ref={hint}
          className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 select-none text-[12px] tracking-[0.24em] text-[#4b3f8f] uppercase"
        >
          scroll
        </div>
      </div>
    </div>
  )
}
