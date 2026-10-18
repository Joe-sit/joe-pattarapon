import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { WarmShaders } from '@/lib/WarmShaders'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { StageLight } from './Headline3D'
import { DeviceHalo } from './DeviceHalo'
import { BenchScreen } from './BenchScreen'
import { BenchTokens, type TokensApi } from './BenchTokens'
import { FallSky, type FallPose } from './FallSky'
import { BEAT, endOf } from '@/sections/skystory/beats'
import { FOV, camDist, clamp01, headPose, isTall, smooth, workBeats, type WorkBeats } from './workMotion'

/**
 * เครื่องแก้วเป็นโต๊ะทำงาน — เรื่องต่อจาก "Here is what I do"
 *
 *   morph · lift  ฟองคำพูดหงาย ข้อความลอยออก คลี่เป็นจอมือถือแก้ว (./BubbleTraveler) มีแสงเรืองรอบเครื่อง (./DeviceHalo)
 *   research      ยังเป็นฟองหงาย — การ์ด Research กับไอคอนลอยรอบแท่น (./BenchTokens) แล้วจึงคลี่เป็นเครื่อง
 *   bench         เครื่องตั้งหน้าตรง ขยายเลื่อนไปขวา หัวเรื่องไปซ้าย ป้ายขั้นตอนโผล่ใต้หัวเรื่อง
 *   design · code · ship  ของบนจอ (./BenchScreen) ทำทีละขั้น ป้ายของขั้นนั้นติดไฟ คำอธิบายจริงจากข้อมูลของเว็บ
 *
 * ของบนจอวาดในแคนวาสนี้ (เพอร์สเปกทีฟ) ซึ่งอยู่ *ใต้* ตัวเครื่องแก้ว (z 51 < 52) — เห็นผ่านแก้วเป็นของในจอ
 * ทุกค่าคิดจากระยะเลื่อน อ่านในลูปเลื่อน เขียนลง ref — React ไม่ re-render ระหว่างเลื่อน
 */

/** จอถัดไปที่ดันเรื่องนี้ขึ้นไป (กองหน้าต่าง — sections/whatidocard) */
const NEXT_ID = 'what-i-do-windows'

type Frame = { on: boolean; b: WorkBeats }

const desc = (t: string) => SKILLS.find((k) => k.title === t)?.desc ?? ''
/** ขั้นตอนใต้หัวเรื่อง — คำอธิบายจาก WhatIDo (Research ในข้อมูลยังเป็น Lorem รอเขียน — ไม่แสดง · Ship ยังไม่มี) */
const STEPS = [
  { key: 'research', label: 'Research', body: '' },
  { key: 'design', label: 'Design', body: desc('Design') },
  { key: 'code', label: 'Code', body: desc('Coding') },
  { key: 'ship', label: 'Ship', body: '' },
] as const


/** กล้องนิ่ง: ระนาบ z 0 = 1 px — แคนวาสของเครื่อง (ออร์โธ) ใส่เพอร์สเปกทีฟเองด้วยระยะเดียวกัน */
function Rig() {
  const { camera, size, invalidate } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = FOV
    cam.near = 10
    cam.far = size.height * 20
    cam.position.set(0, 0, camDist(size.height))
    cam.lookAt(0, 0, 0)
    cam.updateProjectionMatrix()
    invalidate()
  }, [camera, size, invalidate])
  return null
}

/** ระหว่างเรื่องเปิดอยู่ วาดต่อเนื่อง (ไฟสถานะ คลื่นวง แสงรอบเครื่องเคลื่อนตามเวลา) */
function Pump({ frame }: { frame: React.RefObject<Frame> }) {
  const { invalidate } = useThree()
  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (frame.current?.on) invalidate()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame, invalidate])
  return null
}

/** ฟ้าที่ร่วงผ่าน (เมฆจุด ทิวเขา — ./FallSky) เริ่มร่วงตอนฟองเริ่มหงาย จนส่งของเสร็จ */
const FALL_FROM = BEAT.lift[0]
const FALL_TO = endOf(BEAT.ship)

export function WorkStory() {
  const frame = useRef<Frame>({ on: false, b: workBeats(0) })
  const fall = useRef<FallPose>({ on: false, iso: 0, fall: 0, prog: 0, lift: 0 })
  const [on, setOn] = useState(false)
  const layer = useRef<HTMLDivElement>(null)
  const steps = useRef<HTMLDivElement>(null)
  const chips = useRef<(HTMLSpanElement | null)[]>([])
  const bodies = useRef<(HTMLParagraphElement | null)[]>([])
  const tokens = useRef<TokensApi>(null)

  useEffect(() => {
    let raf = 0
    let was = false
    const read = () => {
      raf = 0
      const story = document.getElementById('what-i-do')
      if (!story) return
      const vw = window.innerWidth
      const vh = window.innerHeight || 1
      const sr = story.getBoundingClientRect()
      const b = workBeats(Math.max(0, -sr.top / vh))
      const next = document.getElementById(NEXT_ID)
      const glue = next ? next.getBoundingClientRect().top : vh
      const hand = clamp01(-glue / (vh * 0.12))
      const lift = Math.min(0, glue - vh)
      /* เปิดตั้งแต่ฟองเริ่มหงาย (ฟ้าร่วง · การ์ดค้นคว้ารอบแท่น) */
      const live = b.lift > 0 && hand < 1 && sr.bottom > 0
      frame.current.b = b
      frame.current.on = live
      /* ทั้งชั้นเลื่อนขึ้นด้วย CSS ตอนจอถัดไปดันขึ้นมาแล้ว — ฟ้าไม่ต้องยกเอง (lift 0) */
      const fp = fall.current
      fp.on = live
      fp.iso = smooth((b.sv2 - FALL_FROM) / 0.35)
      fp.fall = Math.max(0, b.sv2 - FALL_FROM)
      fp.prog = clamp01((b.sv2 - FALL_FROM) / (FALL_TO - FALL_FROM))
      if (live !== was) {
        was = live
        setOn(live)
      }
      if (layer.current) layer.current.style.transform = lift ? `translate3d(0, ${lift.toFixed(1)}px, 0)` : ''

      /* ── ของลอยรอบเครื่อง ── */
      tokens.current?.update(b, vw, vh, live, lift)

      /* ── ป้ายขั้นตอนใต้หัวเรื่อง: เผยจากล่างขึ้นบนพร้อมเครื่องตั้งตรง · ขั้นที่กำลังทำติดไฟ ── */
      const st = steps.current
      if (st) {
        const hp = headPose(vw, vh)
        const tall = isTall(vw, vh)
        const k = live ? smooth((b.bench - 0.5) / 0.5) : 0
        st.style.visibility = k > 0.001 ? 'visible' : 'hidden'
        st.style.left = `${(vw / 2 + hp.x).toFixed(1)}px`
        /* ใต้ก้อนหัวเรื่อง (สองบรรทัด + ไอคอน — สูงราว 18% ของจอ) */
        /* หัวเรื่องลงไปเป็น wireframe ในจอแล้ว — ป้ายขึ้นมาอยู่ที่ของหัวเรื่องแทน */
        st.style.top = `${(vh / 2 + hp.y + vh * (tall ? 0.02 : 0.04)).toFixed(1)}px`
        st.style.clipPath = `inset(${((1 - k) * 100).toFixed(1)}% 0 0 0)`
        const ks = [b.study, b.design, b.code, b.ship]
        /* ขั้นปัจจุบัน = ขั้นท้ายสุดที่เริ่มแล้ว */
        let cur = -1
        ks.forEach((x, i) => {
          if (x > 0) cur = i
        })
        chips.current.forEach((c, i) => {
          if (!c) return
          c.dataset.on = String(i === cur)
          c.dataset.done = String(i < cur)
        })
        bodies.current.forEach((p, i) => {
          if (!p) return
          const v = i === cur ? smooth((ks[i] - 0.05) / 0.15) : 0
          p.style.visibility = v > 0.001 ? 'visible' : 'hidden'
          p.style.clipPath = `inset(${((1 - v) * 100).toFixed(1)}% 0 0 0)`
        })
      }
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

  return (
    <>
      <div ref={layer} className="pointer-events-none fixed inset-0 z-[51]" style={{ visibility: on ? 'visible' : 'hidden' }} aria-hidden>
        {/* ฉากหลัง: ร่วงลงจากฟ้า — แคนวาสออร์โธของตัวเอง ใต้ของบนจอ (ฉากเดิมของเวทีไอโซ เอากลับมาใช้) */}
        <Canvas
          className="!absolute inset-0"
          frameloop="demand"
          dpr={[1, 1.5]}
          orthographic
          camera={{ position: [0, 0, 2400], zoom: 1, near: 1, far: 8000 }}
          gl={{ antialias: false, alpha: true }}
          style={{ pointerEvents: 'none' }}
        >
          <WarmShaders />
          <FallSky pose={fall} />
        </Canvas>
        <Canvas className="!absolute inset-0" frameloop="demand" dpr={[1, 1.75]} camera={{ fov: FOV, position: [0, 0, 1700] }} gl={{ antialias: true, alpha: true }} style={{ pointerEvents: 'none' }}
          /* ขาวต้องเป็นขาว: ตัวแมปโทนตั้งต้น (ACES) กดขาวลงเป็นเทาหม่น */
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping
          }}
        >
          <Rig />
          <Pump frame={frame} />
          <Suspense fallback={null}>
            <WarmShaders />
            <StageLight gain={1} />
            {/* หน่วยไฟของ three เป็นแบบกายภาพ — ค่าราว 1 ได้ขาวหม่นเทา วิดเจ็ตพาสเทลต้องสว่างกว่านั้น */}
            <hemisphereLight args={['#ffffff', '#dfe4ee', 2.2]} />
            <directionalLight position={[-500, 700, 1000]} intensity={2.6} />
            <DeviceHalo />
            <BenchScreen frame={frame} />
          </Suspense>
        </Canvas>
      </div>
      <BenchTokens api={tokens} />
      {/* ป้ายขั้นตอนใต้หัวเรื่อง — เหนือเครื่อง ใต้เคอร์เซอร์ */}
      <div
        ref={steps}
        className="pointer-events-none fixed z-[53] w-[min(86vw,420px)] -translate-x-1/2 text-center text-white"
        style={{ visibility: 'hidden' }}
        aria-hidden
      >
        <div className="flex flex-wrap justify-center gap-2">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              ref={(el) => {
                chips.current[i] = el
              }}
              className="rounded-full border border-white/40 px-3.5 py-1.5 font-mono text-[11px] tracking-[0.18em] text-white/70 uppercase transition-colors duration-300 data-[done=true]:text-white/90 data-[on=true]:border-white data-[on=true]:bg-white data-[on=true]:text-[#2052cd]"
            >
              {s.label}
            </span>
          ))}
        </div>
        {/* คำอธิบายซ้อนกันที่เดียว (absolute) — กล่องต้องสูงพอ ไม่งั้นถูกตัดด้วยกรอบเผยของกล่องนอก */}
        <div className="relative mt-5 min-h-[7rem]">
          {STEPS.map((s, i) =>
            s.body ? (
              <p
                key={s.key}
                ref={(el) => {
                  bodies.current[i] = el
                }}
                className="absolute inset-x-0 top-0 mx-auto max-w-[32ch] text-[clamp(15px,1.2vw,18px)] leading-[1.5] text-white/90 [text-shadow:0_1px_12px_rgba(20,60,160,0.45)]"
                style={{ visibility: 'hidden' }}
              >
                {s.body}
              </p>
            ) : null,
          )}
        </div>
      </div>
    </>
  )
}
