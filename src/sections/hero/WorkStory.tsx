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
import { BEAT, endOf, storySv2 } from '@/sections/skystory/beats'
import { ISLAND } from './ResearchPlatform'
import { FOV, camDist, clamp01, codeDark, devScreen, headPose, isTall, smooth, workBeats, type WorkBeats } from './workMotion'

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

/**
 * คำใหญ่พื้นหลังทีละบท — เครื่องอยู่กลางจอเต็มตัวข้างหน้า (แทนป้ายขั้นตอนซ้าย) · แบบหน้า Apple: ตัวหนาแน่น ระยะชิด
 * เข้า = ลอยขึ้นจากต่ำนิด เบลอ → ชัด · ออก = จางขยายออก ก่อนคำถัดไปเข้า
 */
/**
 * พื้นหลังบท Code: ดำด้านบน แสงม่วงไล่ขึ้นจากมุมล่าง (ซ้ายม่วงน้ำเงิน · ขวาชมพูลาเวนเดอร์สว่าง)
 * สัญลักษณ์ ASCII ห่าง ๆ (* + # : .) ลอยบนแสง สลับตัวตามระยะเลื่อน — ตำแหน่งตายตัว (สุ่มแบบกำหนดผล) ไม่เปลี่ยนทุกครั้งที่โหลด
 */
const GLYPHS = '*+#:.'
const hash1 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const ASCII_DOTS = (() => {
  const out: { x: number; y: number; seed: number }[] = []
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 16; c++) {
      const n = r * 16 + c
      const x = 3 + c * 6.2 + (hash1(n) - 0.5) * 2.4
      const y = 52 + r * 8 + (hash1(n + 99) - 0.5) * 3
      /* กลางจอเป็นที่ของเครื่อง · ห่าง ๆ ไม่เต็มตาราง */
      if (Math.abs(x - 50) < 16 || hash1(n + 7) < 0.45) continue
      out.push({ x, y, seed: n })
    }
  return out
})()

const SKILL_WORDS: { key: 'study' | 'design' | 'code'; w: string }[] = [
  { key: 'study', w: 'Research' },
  { key: 'design', w: 'Design' },
  { key: 'code', w: 'Code' },
]

export function WorkStory() {
  const frame = useRef<Frame>({ on: false, b: workBeats(0) })
  const fall = useRef<FallPose>({ on: false, iso: 0, fall: 0, prog: 0, lift: 0 })
  const [on, setOn] = useState(false)
  const layer = useRef<HTMLDivElement>(null)
  const steps = useRef<HTMLDivElement>(null)
  const bigWords = useRef<(HTMLDivElement | null)[]>([])
  /** ชั้นเส้นขอบหน้าวัตถุ — ตรงที่เครื่อง/island บังตัวทึบ คำยังอ่านได้เป็นเส้นขอบ */
  const bigLines = useRef<(HTMLDivElement | null)[]>([])
  const bigFront = useRef<HTMLDivElement>(null)
  /** ตัวทึบทั้งชุด — เจาะรูตามกรอบเครื่อง (clip-path) ตรงที่เครื่องบังเหลือแต่เส้นขอบ */
  const bigSolid = useRef<HTMLDivElement>(null)
  const dark = useRef<HTMLDivElement>(null)
  const liftNow = useRef(0)
  const glyphs = useRef<(HTMLSpanElement | null)[]>([])
  /* รูของคำใหญ่ตามกรอบเครื่องทุกเฟรม (เครื่องขยับเองตามเวลาด้วย — อ่านตอนเลื่อนอย่างเดียวไม่พอ) */
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!frame.current.on) return
      /* เจาะรูคำใหญ่ตามกรอบเครื่องทุกเฟรม (เครื่องขยับเองตามเวลา ไม่ใช่แค่ตอนเลื่อน) */
      const bs = bigSolid.current
      if (bs) {
        if (devScreen.ok && devScreen.hw > 1) {
          const { cx, cy, hw, hh } = devScreen
          const r = Math.min(devScreen.r, hw, hh)
          const x0 = cx - hw
          const y0 = cy - hh - liftNow.current
          const w = hw * 2
          const h = hh * 2
          const hole = `M${(x0 + r).toFixed(1)} ${y0.toFixed(1)}h${(w - 2 * r).toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${r.toFixed(1)} ${r.toFixed(1)}v${(h - 2 * r).toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 -${r.toFixed(1)} ${r.toFixed(1)}h-${(w - 2 * r).toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 -${r.toFixed(1)} -${r.toFixed(1)}v-${(h - 2 * r).toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${r.toFixed(1)} -${r.toFixed(1)}z`
          bs.style.clipPath = `path(evenodd, "M0 0H${innerWidth}V${innerHeight}H0Z ${hole}")`
        } else bs.style.clipPath = ''
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
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
      const b = workBeats(storySv2(Math.max(0, -sr.top / vh)))
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
      fp.iso = smooth((b.sv2 - FALL_FROM) / 0.4)
      fp.fall = Math.max(0, b.sv2 - FALL_FROM)
      fp.prog = clamp01((b.sv2 - FALL_FROM) / (FALL_TO - FALL_FROM))
      if (live !== was) {
        was = live
        setOn(live)
      }
      if (layer.current) layer.current.style.transform = lift ? `translate3d(0, ${lift.toFixed(1)}px, 0)` : ''

      /* ── บท Code: ฉากมืดลง (ทับฟ้ากับเมฆ) แสงออร่าม่วงที่ขอบบนกับขอบล่างของเครื่อง · กลับสว่างตอนจบบท ── */
      const dk = dark.current
      if (dk) {
        const k = live ? codeDark(b) : 0
        dk.style.visibility = k > 0.002 ? 'visible' : 'hidden'
        if (k > 0.002) {
          dk.style.opacity = k.toFixed(3)
          /* สัญลักษณ์สลับตัวตามระยะเลื่อน (คนละจังหวะ) */
          const step = Math.floor(b.code * 40)
          ASCII_DOTS.forEach((d, n) => {
            const el = glyphs.current[n]
            if (el) el.textContent = GLYPHS[Math.floor(hash1(d.seed * 3.1 + Math.floor((step + d.seed) / 3)) * GLYPHS.length)]
          })
        }
      }

      /* ── คำใหญ่พื้นหลังของบท (Research / Design / Code) ── */
      liftNow.current = lift
      SKILL_WORDS.forEach((sw, i) => {
        const el = bigWords.current[i]
        const ln = bigLines.current[i]
        if (!el || !ln) return
        const k = b[sw.key]
        /* Research ขึ้นตั้งแต่ island งอกเสร็จบนฟอง (ก่อนเครื่องมา) ค้างยาวจนจบบท study */
        const inK = sw.key === 'study' ? smooth((b.sv2 - (ISLAND.grow[0] + ISLAND.grow[1] - 0.05)) / 0.3) : smooth(k / 0.16)
        const outK = smooth((k - 0.86) / 0.14)
        const v = live && (sw.key === 'study' ? inK > 0 && k < 1 : k > 0 && k < 1) ? inK * (1 - outK) : 0
        const vis = v > 0.002 ? 'visible' : 'hidden'
        el.style.visibility = vis
        ln.style.visibility = vis
        if (v <= 0.002) return
        const tf = `translate(-50%, -50%) translate3d(0, ${((1 - inK) * 6).toFixed(2)}vh, 0) scale(${(1 + outK * 0.06).toFixed(4)})`
        const bl = inK < 0.999 ? `blur(${((1 - inK) * 14).toFixed(1)}px)` : ''
        for (const d of [el, ln]) {
          d.style.opacity = v.toFixed(3)
          d.style.transform = tf
          d.style.filter = bl
        }
      })

      /* ── ของลอยรอบเครื่อง ── */
      tokens.current?.update(b, vw, vh, live, lift)

      /* ── ป้ายขั้นตอนใต้หัวเรื่อง: เผยจากล่างขึ้นบนพร้อมเครื่องตั้งตรง · ขั้นที่กำลังทำติดไฟ ── */
      const st = steps.current
      if (st) {
        const hp = headPose(vw, vh)
        const tall = isTall(vw, vh)
        /* ป้ายขั้นตอนซ่อนไว้ — คำใหญ่พื้นหลังทีละบทเล่าแทนแล้ว (เครื่องอยู่กลางจอ) */
        const k: number = 0
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
          {/* frameloop demand: ต้องปลุกเอง — ไม่งั้นรอบแรกที่เปิด useFrame ของฟ้าไม่ได้วิ่ง เมฆไม่ขึ้น */}
          <Pump frame={frame} />
          <FallSky pose={fall} />
        </Canvas>
        {/* บท Code: ดำ + แสงม่วงจากมุมล่าง + สัญลักษณ์ ASCII — เหนือฟ้า ใต้คำใหญ่กับเครื่อง */}
        <div
          ref={dark}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            visibility: 'hidden',
            background:
              'radial-gradient(70% 62% at 96% 104%, rgba(255,236,255,0.95), rgba(226,150,240,0.75) 28%, rgba(170,90,220,0.35) 55%, rgba(0,0,0,0) 78%), radial-gradient(62% 58% at 6% 100%, rgba(200,160,255,0.85), rgba(110,60,240,0.7) 30%, rgba(60,30,170,0.3) 58%, rgba(0,0,0,0) 80%), #000',
          }}
          aria-hidden
        >
          {ASCII_DOTS.map((d, n) => (
            <span
              key={n}
              ref={(el) => {
                glyphs.current[n] = el
              }}
              className="absolute font-mono text-[17px] leading-none"
              style={{
                left: `${d.x}vw`,
                top: `${d.y}vh`,
                /* สีตามแสงที่อยู่ใต้: ซ้ายม่วงน้ำเงิน ขวาชมพู · จางไม่เท่ากัน */
                color: d.x < 50 ? '#7b4dff' : '#d77cf0',
                opacity: (0.35 + hash1(n + 41) * 0.55).toFixed(2),
              }}
            >
              {GLYPHS[n % GLYPHS.length]}
            </span>
          ))}
        </div>
        {/* คำใหญ่ของแต่ละบท (ตัวทึบ) — เหนือฟ้า ใต้ของบนจอ · เจาะรูตามกรอบเครื่อง: ในกรอบเครื่องเหลือแต่เส้นขอบ */}
        <div ref={bigSolid} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {SKILL_WORDS.map((sw, i) => (
          <div
            key={sw.key}
            ref={(el) => {
              bigWords.current[i] = el
            }}
            className="absolute top-[28%] left-1/2 text-[clamp(110px,23vw,420px)] leading-none font-bold tracking-[-0.055em] whitespace-nowrap text-white will-change-[transform,opacity,filter]"
            style={{ visibility: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Helvetica Neue", sans-serif' }}
            aria-hidden
          >
            {sw.w}
          </div>
        ))}
        </div>
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
        {/* คำใหญ่ชั้นเส้นขอบ — เหนือ widget/island บนจอเครื่อง แต่ใต้ตัวเครื่องแก้ว (แคนวาสของฟอง) — คำจึงอยู่หลังเครื่องเสมอ
            ตรงที่ของบนจอบังตัวทึบ ยังเห็นรูปตัวอักษรเป็นเส้นขอบ */}
        <div ref={bigFront} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {SKILL_WORDS.map((sw, i) => (
            <div
              key={sw.key}
              ref={(el) => {
                bigLines.current[i] = el
              }}
              className="absolute top-[28%] left-1/2 text-[clamp(110px,23vw,420px)] leading-none font-bold tracking-[-0.055em] whitespace-nowrap text-transparent [-webkit-text-stroke:2px_rgba(255,255,255,0.9)] will-change-[transform,opacity,filter]"
              style={{ visibility: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Helvetica Neue", sans-serif' }}
            >
              {sw.w}
            </div>
          ))}
        </div>
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
