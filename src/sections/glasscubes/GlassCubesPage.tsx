import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { CubeScene, cubeStory } from './CubeScene'
import { CHAPTERS, chapterOf } from './chapters'

/**
 * /cubes — กล่องแก้วปริซึมบนลำแสงม่วง-ส้ม (ภาพอ้างอิงแบนเนอร์กล่องแก้วพื้นกรมท่า) เล่าสกิล
 *
 * เรื่อง: ชิ้นแก้วลอยกระจัด → ประกอบเป็นกล่องเดียว มีตรา J ข้างใน → บทของแต่ละสกิล ชิ้นหนึ่งยื่นออก
 * ลำแสงเปลี่ยนเป็นสีสกิล (ชื่อ/คำอธิบายจริงจาก WhatIDo) → "สร้างทีละชิ้น"
 * ระยะเลื่อนเขียนลง cubeStory.p ฉากหน่วงเองแล้วเขียน cubeStory.s กลับ — ข้อความอ่านค่าที่หน่วงแล้ว ขึ้นพร้อมภาพ
 */
export function GlassCubesPage() {
  const root = useRef<HTMLDivElement>(null)
  const blocks = useRef<(HTMLDivElement | null)[]>([])
  const hint = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = 'Built piece by piece'
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = root.current
      if (!el) return
      const max = Math.max(1, el.scrollHeight - window.innerHeight)
      cubeStory.p = Math.min(1, Math.max(0, window.scrollY / max))
      const s = cubeStory.s
      CHAPTERS.forEach((c, i) => {
        const d = blocks.current[i]
        if (!d) return
        const k = chapterOf(s, c)
        d.style.opacity = k.toFixed(3)
        d.style.transform = `translate3d(0, calc(-50% + ${((1 - k) * (s < c.at ? 36 : -36)).toFixed(1)}px), 0)`
      })
      if (hint.current) hint.current.style.opacity = String(Math.max(0, 1 - s / 0.04))
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={root} className="relative w-full" style={{ height: '640svh', background: '#05061a' }}>
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        {/* ลำแสงกับพื้นกรมท่าอยู่ในฉาก 3D (แก้วต้องหักเหมันได้) */}
        <Canvas
          className="!absolute inset-0"
          dpr={[1, 1.75]}
          camera={{ fov: 30, position: [0, 0.6, 11], near: 0.1, far: 80 }}
          gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.08 }}
        >
          <CubeScene />
        </Canvas>

        <div className="pointer-events-none absolute top-8 left-8 select-none font-mono text-[13px] tracking-[0.2em] text-white/70 md:left-14">
          {'</>'} JOE · WHAT I BUILD
        </div>

        {/* บท — ฝั่งซ้าย กลางแนวตั้ง (ฉากกองอยู่ขวา แบบภาพอ้างอิง) */}
        <div className="pointer-events-none absolute top-1/2 left-8 -translate-y-1/2 select-none md:left-14">
          {CHAPTERS.map((c, i) => (
            <div
              key={c.title}
              ref={(d) => {
                blocks.current[i] = d
              }}
              className="absolute top-0 left-0 w-[min(86vw,520px)]"
              style={{ opacity: 0 }}
            >
              <div className="mb-4 text-[12px] tracking-[0.24em] text-white/75 uppercase">{c.kicker}</div>
              <div className="text-[clamp(34px,4.6vw,68px)] leading-[0.98] font-extrabold tracking-[-0.01em] text-white uppercase drop-shadow-[0_8px_30px_rgba(10,10,60,0.6)]">
                {c.title}
              </div>
              {c.body && (
                <div className="mt-6 max-w-[34ch] rounded-[12px] border border-white/20 bg-white/10 px-4 py-3 text-[clamp(14px,1.2vw,18px)] leading-snug text-white/90 backdrop-blur-md">{c.body}</div>
              )}
            </div>
          ))}
        </div>

        <div ref={hint} className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 select-none text-[12px] tracking-[0.24em] text-white/80 uppercase">
          scroll
        </div>
      </div>
    </div>
  )
}
