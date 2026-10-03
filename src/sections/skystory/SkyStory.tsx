import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { SkyScene, type SkyState } from './SkyScene'
import { BEAT, KEYCHAIN, SECTION_VH, TOTAL_VH, at } from './beats'
import { cursorShow, cursorWake } from '@/cursorguide/morph'
import './sky.css'

/**
 * What I do — เรื่องเล่าบนฟ้าต่อจาก hero (ดู SkyScene) ไม่มีข้อความบนจอ ของ 3D เล่าเอง
 *
 * ขาเข้า: section เริ่มด้วยม่านขาว (ต่อจากม่านเมฆขาวของ hero) จางออกพร้อมหมอกที่พุ่งขึ้นผ่านกล้อง
 * ระยะเลื่อนเขียนลง ref ใบเดียว · ห่างจอแล้ว Canvas หยุดวาด
 */
export function SkyStory({ id, className = '' }: { id?: string; className?: string }) {
  const root = useRef<HTMLElement>(null)
  const state = useRef<SkyState>({ p: 0 })
  const [near, setNear] = useState(false)
  /** ค่า cursorShow ล่าสุดที่ section นี้เขียน — เขียนคืนเป็น 1 ครั้งเดียวตอนพ้นช่วง */
  const shown = useRef(1)

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
      const sv2 = p * TOTAL_VH
      /**
       * ปุ่มเริ่มงอก = เคอร์เซอร์นำสายตาย่อหายไปตลอดที่เหลือของ section (หน้าต่างพอร์ทัลกับเรื่องข้างล่าง
       * ไม่มีอะไรให้มันชี้) — จุดจอดถัดไปอยู่ไกลใน section อื่น ระหว่างทางมันจะลอยผ่านกลางฉาก
       * พ้น section แล้วคืนค่าให้ section ถัดไปคุมเอง
       */
      const gone = r.top <= 0 && r.bottom > vh ? at(sv2, [BEAT.sprout[0], 0.25]) : 0
      if (gone > 0 || shown.current < 1) {
        cursorShow.v = 1 - gone
        shown.current = cursorShow.v
        cursorWake.fn()
      }
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
    /* ความสูงมาจากตารางจังหวะ (ดู ./beats) — ยืดบทไหน section ยาวตามเอง */
    <section ref={root} id={id} className={`ss-root relative w-full ${className}`} style={{ height: `${SECTION_VH * 100}svh` }}>
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        <div className="ss-sky" aria-hidden />
        {/**
         * ผ้าใบมีเฉพาะตอนมีของให้วาด (KEYCHAIN) — ปิดพวงกุญแจแล้วฉากนี้ว่างเปล่า (0 draw call)
         * แต่ผ้าใบเปล่ายังเคลียร์และผสมภาพเต็มจออยู่ใต้ hero ทุกเฟรม (วัดแล้ว: ถอดออก hero ลื่นขึ้น
         * ~35%) ฟ้าของจอนี้เป็น DOM (.ss-sky) อยู่แล้ว ไม่ได้มาจากผ้าใบ
         */}
        {KEYCHAIN && (
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
        )}
        <div className="ss-veil" aria-hidden />

        {/* ไม่มีหัวข้อบนจอ — ให้ของ 3D เล่าเรื่องเอง ชื่อ section ไว้ให้โปรแกรมอ่านหน้าจอ */}
        <h2 className="sr-only">What I do</h2>
      </div>
    </section>
  )
}
