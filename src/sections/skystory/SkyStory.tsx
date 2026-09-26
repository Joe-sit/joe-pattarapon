import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { STEPS, SkyScene, stepAt, type SkyState } from './SkyScene'
import './sky.css'

/**
 * What I do — เรื่องเล่าบนฟ้าต่อจาก hero (ดู SkyScene) ข้อความมุมซ้ายล่างสลับตามบทที่กล้องจ่อ
 *
 * ขาเข้า: section เริ่มด้วยม่านขาว (ต่อจากม่านเมฆขาวของ hero) จางออกพร้อมหมอกที่พุ่งขึ้นผ่านกล้อง
 * ระยะเลื่อนเขียนลง ref ใบเดียว · ข้อความสลับด้วย data attribute · ห่างจอแล้ว Canvas หยุดวาด
 */
export function SkyStory({ id, className = 'h-[1000svh]' }: { id?: string; className?: string }) {
  const root = useRef<HTMLElement>(null)
  const state = useRef<SkyState>({ p: 0 })
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = root.current
    if (!el) return
    let raf = 0
    let wasNear = false
    const read = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const isNear = r.top < vh * 1.5 && r.bottom > -vh * 0.5
      if (isNear !== wasNear) setNear((wasNear = isNear))
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)))
      state.current.p = p
      el.style.setProperty('--ss-veil', String(Math.max(0, 1 - p / 0.05)))
      /* ข้อความขึ้นเมื่อ section ถึงขอบบนแล้วเท่านั้น (ก่อนนั้นยังเป็นม่านขาวของ hero) */
      const step = r.top <= vh * 0.05 ? stepAt(p) : -1
      el.dataset.step = String(step)
      el.querySelectorAll<HTMLElement>('.ss-head').forEach((h, i) => {
        h.dataset.pos = i === step ? 'on' : i < step ? 'past' : 'next'
      })
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <section ref={root} id={id} className={`ss-root relative w-full ${className}`} data-step="-1">
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        <div className="ss-sky" aria-hidden />
        <Canvas
          className="!absolute inset-0"
          frameloop={near ? 'always' : 'never'}
          camera={{ position: [0, 0.8, 8], fov: 38 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping
          }}
        >
          <SkyScene state={state} />
        </Canvas>
        <div className="ss-veil" aria-hidden />

        {STEPS.map((s, i) => (
          <div
            key={s.title + i}
            className="ss-head pointer-events-none absolute bottom-0 left-0 flex w-full md:w-[min(62rem,64vw)] flex-col justify-end"
            data-pos="next"
            style={{ ['--ss-c' as string]: s.color }}
          >
            <span className="ss-line ss-kicker">
              <span>
                <i className="ss-dot" />
                {s.kicker}
              </span>
            </span>
            {i === 0 ? (
              <h2 className="ss-line ss-title">
                <span>{s.title}</span>
              </h2>
            ) : (
              <h3 className="ss-line ss-title">
                <span>{s.title}</span>
              </h3>
            )}
            {s.body && (
              <p className="ss-line ss-body">
                <span>{s.body}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
