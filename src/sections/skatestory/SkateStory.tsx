import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { HeroRider, armPoseFromTuner, facePoseFromTuner } from '@/newhero/HeroRider'
import { HeroLights } from '@/newhero/heroLights'
import { DEFAULTS, getTuner, useTuner } from '@/newhero/tuner'
import { Gloss } from '@/newhero/NewHeroScene'
import { CameraFX } from '@/newhero/CameraFX'
import { deckTop } from '@/newhero/Skateboard'

/**
 * What I do แบบ "สเกตเข้าหากล้อง" — โครงตามหน้า about ของ stormlikes.com (ยังไม่ปั้นของใหม่ วางผังอย่างเดียว)
 *
 * องค์ประกอบของ ref:
 *   หัว       หัวเรื่องตัวใหญ่ขอบบน + ย่อหน้าแนะนำชิดขวาใต้หัวเรื่อง — อยู่ในโฟลว์ เลื่อนพ้นจอไปตามปกติ
 *   กลาง      ตัวละครขี่สเกตตรึงกลางจอตลอด section — เริ่มหันข้างลอยกลางอากาศ เลื่อนลงแล้วค่อย ๆ หมุนมา
 *             หันหน้าเข้ากล้องและใหญ่ขึ้น ท้ายสุดพุ่งเข้าหาคนดู (ref มีเส้นความเร็วข้างหลัง + เส้นพื้น perspective)
 *   การ์ด     การ์ดสี่ใบกระจายรอบตัวละคร สลับซ้ายขวา เลื่อนขึ้นไปตามหน้า (ไม่ตรึง) — ผ่านหน้า/ทับขอบตัวละคร
 *
 * ตัวละครคือ HeroRider ตัวเดียวกับ hero (ไม่ได้ปั้นใหม่) ในแคนวาสของตัวเอง หมุน/ลงพื้น/ขยายตามระยะเลื่อน (ดู Rider)
 * เส้นความเร็ว/เส้นพื้นเป็นเส้น SVG ขาวธรรมดา (ดู SpeedLines)
 *
 * ข้อความจริงเท่านั้น: การ์ดใช้คำอธิบายจาก SKILLS (sections/whatido) — Research ในข้อมูลยังเป็น Lorem รอ Joe เขียน
 * จึงไม่แสดง · Ship ยังไม่มีข้อความ · ย่อหน้าแนะนำยังไม่มี (INTRO ว่าง = ไม่วาด)
 */

/** ความสูงทั้ง section (หน่วยความสูงจอ) — ช่วงที่ตัวละครตรึงอยู่ = ความสูงนี้ลบหนึ่งจอ */
const SECTION_VH = 3.6
/** ม่านขาวรับช่วงจากม่านเมฆของ hero จางหมดเมื่อเลื่อนเข้ามาเท่านี้ (หน่วยจอ) */
const VEIL_VH = 0.35
const SKY = 'linear-gradient(180deg, #1f6fe0 0%, #3f8cf0 55%, #6aaaf5 100%)'
const INK = '#160f2a'

/** หัวเรื่อง — ประโยคเดียวกับที่ฟองคำพูดพิมพ์ก่อนเข้า What I do (sections/hero/BubbleTraveler: LINES[1]) */
const HEADLINE = ['Here is', 'what I do']
/** TODO(Joe): ย่อหน้าแนะนำใต้หัวเรื่อง (ref มีหนึ่งย่อหน้าชิดขวา) — ว่าง = ไม่วาด */
const INTRO = ''

const desc = (t: string) => SKILLS.find((k) => k.title === t)?.desc ?? ''
const isLorem = (s: string) => /lorem ipsum/i.test(s)
/**
 * การ์ดสี่ใบ — ตำแหน่งตาม ref: บนขวา · ขวา · ซ้าย · ล่างขวา
 * top = ระยะจากขอบบนของ section (หน่วยจอ) · x = ขอบซ้ายของการ์ด (สัดส่วนความกว้างกล่องเนื้อหา)
 */
const CARDS = [
  { title: 'Research', body: desc('Research'), top: 0.95, x: 0.55 },
  { title: 'Design', body: desc('Design'), top: 1.35, x: 0.75 },
  { title: 'Code', body: desc('Coding'), top: 1.6, x: 0.08 },
  { title: 'Ship', body: '', top: 2.15, x: 0.6 },
].map((c) => ({ ...c, body: isLorem(c.body) ? '' : c.body }))

export function SkateStory({ id }: { id?: string }) {
  const sec = useRef<HTMLElement>(null)
  const lines = useRef<SVGSVGElement>(null)
  const veil = useRef<HTMLDivElement>(null)
  /** ความคืบหน้าของช่วงตรึง 0..1 — ตัวละคร (ในแคนวาส) อ่านทุกเฟรม */
  const prog = useRef(0)
  /** section อยู่ในจอ — แคนวาสวาดเฉพาะตอนนี้ */
  const [live, setLive] = useState(false)

  useEffect(() => {
    const el = sec.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { rootMargin: '20% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /* ความคืบหน้าของช่วงตรึง 0..1 → ตัวละคร (ref) + เส้นความเร็ว/เส้นพื้น (CSS var) · เขียน DOM ตรง ไม่ผ่าน state */
  useEffect(() => {
    const el = sec.current
    if (!el) return
    let raf = 0
    const read = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)))
      prog.current = p
      const svg = lines.current
      if (svg) {
        /* เส้นความเร็วข้างหลังตอนยังหันข้าง · เส้นพื้น perspective ใต้บอร์ดตอนหันหน้าพุ่งเข้าหา (แบบ ref) */
        svg.style.setProperty('--speed', (1 - smooth((p - 0.35) / 0.3)).toFixed(3))
        svg.style.setProperty('--ground', smooth((p - 0.55) / 0.3).toFixed(3))
      }
      const v = veil.current
      if (v) v.style.opacity = String(1 - smooth(-r.top / (vh * VEIL_VH)))
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section ref={sec} id={id} className="relative w-full" style={{ height: `${SECTION_VH * 100}svh`, background: SKY }} aria-label="What I do">
      {/* ── กลาง: ช่องตัวละครตรึงจอ ── */}
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        <div ref={veil} className="pointer-events-none absolute inset-0 z-10 bg-white" aria-hidden />
        <SpeedLines svgRef={lines} />
        {/* ตัวละครสเกต — HeroRider ตัวเดียวกับ hero (ลายเสื้อ ผม หน้า บอร์ด ค่าจูนชุดเดียวกัน) ไม่ได้ปั้นใหม่ */}
        <div className="absolute inset-0" aria-hidden>
          {/**
           * แสง/เงาชุดเดียวกับ hero (NewHeroScene) ทุกชั้น — ขาดชั้นไหนตัวละครก็หน้าตาคนละตัว:
           *   flat        ไม่ tone map (hero ปิด ACES เป็นค่าตั้งต้น · ACES ทำสีซีด) + exposure เท่ากัน
           *   shadows     เงาจริงจากไฟ key ของ HeroLights (เงาใต้คาง ใต้แขน บนขา)
           *   Gloss       cel shading 3 ชั้น + ผิวด้าน (โหมด flat ของ hero)
           *   CameraFX    ขอบ rim สว่างจากขอบภาพ (rimFx ของ hero) · บัฟเฟอร์ของมันลบรอยหยักเอง ผ้าใบจึงปิด antialias
           * ไม่เติมไฟหน้า/ambient เพิ่ม — เคยเติมแล้วทุกหน้าสว่างเท่ากัน เงาหาย ทรงแบน
           */}
          <Canvas
            frameloop={live ? 'always' : 'never'}
            dpr={[1, 1.5]}
            shadows="soft"
            flat
            camera={{ fov: 30, position: [0, 0.9, CAM_Z], near: 0.1, far: 100 }}
            onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
            gl={{ antialias: false, stencil: true, alpha: true, toneMappingExposure: DEFAULTS.exposure }}
            style={{ pointerEvents: 'none' }}
          >
            <HeroLook>
              <Rider prog={prog} />
            </HeroLook>
          </Canvas>
        </div>
      </div>

      {/* ── หัว + การ์ด: อยู่ในโฟลว์ของ section เลื่อนผ่านช่องตัวละครที่ตรึงอยู่ ── */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="relative mx-auto h-full w-full max-w-[1440px] px-[clamp(20px,6vw,120px)]">
          <header className="pt-[clamp(80px,14svh,160px)]">
            <h2
              className="m-0 text-center leading-[0.86] font-bold tracking-[-0.03em] text-white uppercase"
              style={{ fontFamily: 'var(--v3-display)', fontSize: 'clamp(56px, 10vw, 168px)', filter: 'drop-shadow(0 8px 28px rgba(10,30,120,0.3))' }}
            >
              {HEADLINE.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </h2>
            {INTRO && <p className="mt-6 ml-auto max-w-[400px] text-[17px] leading-snug text-white/90">{INTRO}</p>}
          </header>

          {CARDS.map((c) => (
            <article
              key={c.title}
              className="absolute w-[min(320px,80vw)] rounded-[26px] bg-[#f3efff] p-6 shadow-[0_12px_40px_rgba(10,30,120,0.18)]"
              style={{ top: `${c.top * 100}svh`, left: `${c.x * 100}%`, color: INK }}
            >
              <h3 className="m-0 text-[clamp(36px,3.6vw,56px)] leading-none font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--v3-display)' }}>
                {c.title}
              </h3>
              {c.body && <p className="mt-8 mb-0 text-[16px] leading-snug text-[#5b5470]">{c.body}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- แสงชุดเดียวกับ hero ---------- */

/** สีฟ้าของ hemisphereLight ใน hero (BG_MID ของ NewHeroScene) — ให้ด้านบนของตัวรับฟ้าสีเดียวกัน */
const HERO_SKY = '#5cb8ee'

/** ไฟ + cel shading + rim ของ hero อ่านจาก tuner ตัวเดียวกับ NewHeroScene (เงื่อนไขเปิด/ปิดเหมือนกันทุกตัว) */
function HeroLook({ children }: { children: React.ReactNode }) {
  const t = useTuner()
  const flat = t.flat > 0.5
  const cel = flat
    ? { edge: t.flatEdge, hiEdge: t.flatHiEdge, soft: t.flatSoft, shadow: t.flatShadow, lit: t.flatLit, hi: t.flatHi, tint: t.flatTint }
    : null
  return (
    <>
      <HeroLights skyTint={HERO_SKY} />
      <Gloss on={flat || t.gloss > 0.5} rough={flat ? 1 : t.glossRough} env={flat ? t.flatEnv : t.glossEnv} cel={cel}>
        {children}
      </Gloss>
      {t.rimFx > 0.5 && (
        <CameraFX
          rim={t.rimFxInt}
          rimW={t.rimFxW}
          rimSoft={t.rimFxSoft}
          rimThresh={t.rimFxThresh}
          rimMix={t.rimFxMix}
          rimAngle={t.rimFxAngle}
          rimFall={t.rimFxFall}
          rimShade={t.rimFxShade}
          rimBack={t.rimFxBack}
          tone={t.flatTone > 0.5 ? 1 : 0}
        />
      )}
    </>
  )
}

/* ---------- ตัวละคร ---------- */

const CAM_Z = 7
/** ความสูงของตัวละคร (รวมบอร์ด) ที่ grow = 1 — หน่วยโลก · จอเห็นสูง 2·7·tan15° ≈ 3.75 */
const RIDER_H = 2.5
/**
 * ทิศตาม ref (stormlikes):
 *   ต้นเรื่อง  ลอยอยู่ฝั่งซ้ายของจอ หันขวาแบบ 3/4 (เห็นหน้า) พุ่งจากซ้าย — เส้นความเร็วอยู่ฝั่งซ้าย
 *   ท้ายเรื่อง ไถลพุ่งเข้าหากล้อง: หน้า/อกหันตรงกล้อง หัวบอร์ดชี้เข้าหาคนดู (เห็นล้อหน้าสองล้อสมมาตร)
 *             ขาวางหน้า-หลังตามแนวบอร์ด (เท้าหนึ่งที่หัวบอร์ด อีกเท้าท้ายบอร์ด) ย่อตัว แขนกางทรงตัว
 *             — ไม่ใช่ยืนขาคู่กันบนบอร์ด (เคยทำ = ท่าที่ไม่มีใครเล่นสเกต) และไม่ใช่หันข้างให้กล้อง (เห็นแต่ท้ายทอย)
 *
 * องศารอบแกนตั้งของทั้งตัว วัดจากท่าตั้งต้นของ HeroRider
 */
const YAW_SIDE = 40
/** ต้นเรื่องอยู่ฝั่งซ้ายของจอ แล้วเลื่อนเข้ากลาง — หน่วยโลก (จอกว้าง ≈ 6.7) */
const START_X = -1.7
/** ท้ายเรื่องหันตรงกล้อง — ต้องคลายท่าเอน/บิดของ hero ออกด้วย (ดู Rider) ไม่งั้นลำตัวยังเฉียง */
const YAW_FRONT = 0
/** บอร์ดหมุนแยกจากตัว: ต้นเรื่องมุมเดียวกับ hero (tuner boardRot) → ท้ายวางราบ หัวบอร์ดตามแนวกล้อง */
const BOARD_FRONT: [number, number, number] = [0, 90 - YAW_FRONT, 0]
/** ท่าลำตัวใน Rider (Rider.jsx: body rotation) — เอนตามบอร์ด + บิดเข้ากล้อง · คลายเป็นศูนย์ตอนหน้าตรง */
const BODY_LEAN: [number, number, number] = [0.06, -0.35, -0.12]
/**
 * ท่าขาท้ายเรื่องคิดด้วย IK สองท่อน: บอกตำแหน่งข้อเท้าเทียบสะโพก แล้วแก้หามุมสะโพก/เข่า
 * (เคยบวกองศาเพิ่มเอา — เท้าหน้าลอยพ้นบอร์ด เพราะยกต้นขาแล้วเท้ายกตาม)
 *
 * ระยะท่อนขาตาม Mascot.jsx: สะโพก→เข่า = THIGH_LEN − THIGH_TOP · เข่า→ข้อเท้า = SHIN_LEN + 0.4 (LEG_LEN 1.92)
 * ตรวจกับท่า hero แล้ว: ข้อเท้า (1.264, −0.817) แก้กลับได้ hipX −117.5° knee 98° ตรงค่า tuner
 */
const THIGH_A = 1.92 * 0.52 - 0.07
const SHIN_B = 1.92 * 0.48 + 0.4
/**
 * ข้อเท้าท้ายเรื่อง (หน่วย mascot · z = ไปหน้าเข้าหากล้อง, y = ขึ้น) — ref: เท้าหน้าวางหัวบอร์ด เข่ายกสูง
 * เท้าหลังวางท้ายบอร์ด ระดับเดียวกันสองเท้า บอร์ดจึงราบ · ขาไหนเป็นขาหน้า (ของตัวละคร)
 */
const FOOT_FRONT = { z: 1.1, y: -1.0 }
const FOOT_BACK = { z: -0.7, y: -1.0 }
const FRONT_LEG: 'L' | 'R' = 'R'
/** เท้าสองข้างชิดแนวกลางบอร์ด (LEG.spread ใน Mascot: เลื่อนจุดสะโพก ลบ = ชิดเข้า) */
const SPREAD_END = -0.1
/** พับลำตัวไปหน้าเข้าหากล้อง (องศา) — ย่อตัวพุ่งแบบ ref */
const FOLD_FRONT = 45
/** กล้องท้ายเรื่อง: เข้าใกล้ กว้างขึ้น ต่ำลง — perspective แรงแบบ ref (หัวบอร์ด/ล้อหน้าใหญ่ใกล้คนดู) */
const CAM_FAR = { fov: 30, z: CAM_Z, y: 0.9, look: 0 }
const CAM_NEAR = { fov: 50, z: 2.9, y: -0.5, look: 0 }
/** ช่องมุมของท่าแขน (armPoseFromTuner) — ที่เหลือเป็นระยะเลื่อน/ขนาด ไม่คลาย (คลายแล้วแขนหลุดข้อต่อ) */
const ARM_ANGLES = [
  'aimRotX', 'aimRotY', 'aimRotZ', 'mugRotX', 'mugRotY', 'mugRotZ',
  'elbowX', 'elbowY', 'elbowZ', 'wristX', 'wristY', 'wristZ',
  'mugShX', 'mugShY', 'mugShZ', 'mugWristX', 'mugWristY', 'mugWristZ', 'mugElX', 'mugElY', 'mugElZ',
] as const
/**
 * แขนท้ายเรื่อง — ค่าปลายทาง (มุมเป็นเรเดียน, aimX/Y/Z เป็นทิศ) ไล่จากท่า hero · ref: ไม่สมมาตร
 * แขนข้างหนึ่งยกขึ้นข้างหัว อีกข้างเหวี่ยงไปหลังต่ำ
 * ทดลองแล้ว: aimRotZ ลบ = แขนขวาของจอกดลง · mugShZ ลบ = แขนซ้ายของจอยกออก · ทิศ "หน้า" ของแขน aim คือ −z
 */
const ARM_END: Record<string, number> = { aimX: 0.4, aimY: -1, aimZ: 0, aimRotX: 0.9, aimRotZ: 0, mugShZ: -2.3, mugElX: -1.1 }
/** Rider จัดบอร์ดให้แนบเท้าเองช่วงแรก (วัดจากท่าบอร์ด) — รอให้จัดเสร็จก่อนค่อยแตะบอร์ด */
const SETTLE_FRAMES = 60
/** ต้นเรื่องลอยกลางอากาศ เอียงตัว (ref: กระโดดข้างลอยพร้อมบอร์ดเอียง) แล้วค่อยลงพื้น */
const AIR_LIFT = 0.35
const AIR_ROLL = 16
const AIR_PITCH = -10
/** ความสูงของตัวท้ายเรื่อง (หน่วยโลก หลังจัดกลาง) */
const END_Y = -0.05
/** ขนาดตัวท้ายเรื่อง (ต้นเรื่อง 0.78) */
const GROW_END = 1.1
const RAD = Math.PI / 180
/** หัวเงยชดเชยการพับลำตัวท้ายเรื่อง (สัดส่วนของ FOLD_FRONT) */
const HEAD_UP = 0.7
/** ทิศหัวต้นเรื่องเทียบลำตัว (เรเดียน) — ลำตัวหันขวา 3/4 อยู่แล้ว หัวตามลำตัว = มองไปทางที่พุ่ง */
const GAZE_START = { yaw: 0.2, roll: 0, pitch: -0.1 }

const FIT_BOX = new THREE.Box3()
const FIT_SIZE = new THREE.Vector3()
const FIT_C = new THREE.Vector3()
const FIT_A = new THREE.Vector3()

/**
 * ตัวละครอ่านความคืบหน้า (prog) ทุกเฟรม — ไม่ผ่าน React
 *   turn 1 → 0 ช่วงแรกสามในสี่: ท่าสเกตของ hero (ลอยเฉียง 3/4) → ไถลหน้าตรงเข้าหากล้อง
 *   grow 0.78 → 1.16 ทั้งช่วง: ใหญ่ขึ้น (พุ่งเข้าหาคนดู)
 * ขนาดจัดครั้งเดียวตอนโมเดลโหลดเสร็จ (Box3 ของตัวทั้งตัว ไม่หมุน) แล้วตั้งให้กลางตัวอยู่ที่จุดกำเนิด
 */
function Rider({ prog }: { prog: React.RefObject<number> }) {
  const g = useRef<THREE.Group>(null)
  const fit = useRef<THREE.Group>(null)
  const done = useRef(false)
  const frames = useRef(0)
  /** กลุ่มบอร์ด / ลำตัวใน Rider (ลูกที่หนึ่ง/สองของกลุ่ม sway ใต้กิ่ง userData.rider) — หาครั้งเดียว */
  const board = useRef<THREE.Object3D | null>(null)
  const body = useRef<THREE.Object3D | null>(null)
  /** ตำแหน่งบอร์ดที่ Rider จัดให้แนบเท้าในท่า hero (จำไว้หลังจัดเสร็จ) */
  const boardHome = useRef<THREE.Vector3 | null>(null)
  /** ข้อเท้าสองข้าง (Mascot ตั้งชื่อ ankleL/ankleR) — หาครั้งเดียว */
  const ankles = useRef<[THREE.Object3D, THREE.Object3D] | null>(null)

  /**
   * ท่าชุดเดียวกับ hero (ค่าจาก tuner — ตัวเดียวกับที่ HeroRider อ่านเองเมื่อไม่ได้รับท่า) แล้วไล่ไปท่าไถลหน้าตรง:
   * ลำตัวตั้งตรง หัวมองตรง (ไม่ตามเมาส์) แขนกางทรงตัว ขาวางหน้า-หลัง · เขียนวัตถุใบเดิมทุกเฟรม ลำดับ −900 = ก่อนริกอ่าน
   */
  const leg = useRef({
    spread: 0,
    stagger: 0,
    L: { hipX: 0, hipY: 0, hipZ: 0, knee: 0, ankle: 0 },
    R: { hipX: 0, hipY: 0, hipZ: 0, knee: 0, ankle: 0 },
  }).current
  const torso = useRef({ leanX: 0, leanZ: 0, foldX: 0, foldY: 0, foldZ: 0, headX: 0 }).current
  const follow = useRef<Record<string, number>>({}).current
  const arm = useRef<Record<string, number>>({}).current
  const face = useRef<Record<string, number>>({}).current
  useFrame(() => {
    const tt = getTuner()
    /* k = ท่า hero ที่เหลืออยู่ (1 ต้นเรื่อง → 0 ท้ายเรื่อง) */
    const k = 1 - smooth((prog.current ?? 0) / 0.75)
    torso.leanX = tt.leanX * RAD * k
    torso.leanZ = tt.leanZ * RAD * k
    torso.foldY = tt.foldY * RAD * k
    torso.foldZ = tt.foldZ * RAD * k
    const P = devPose()
    const f = 1 - k
    /* หัวเงยชดเชยลำตัวที่พับไปหน้า — ไม่งั้นพับ 45° แล้วหน้าก้มมองพื้น (ref: ตัวพุ่งแต่ตามองไปข้างหน้า) */
    torso.headX = (tt.headX * k + (P.headUp ?? -(P.fold ?? FOLD_FRONT) * HEAD_UP) * f) * RAD
    /* ref: ย่อพุ่งเข้าหากล้อง — พับลำตัวไปหน้าที่สะโพก (foldX: ขาไม่หมุนตาม) */
    torso.foldX = (tt.foldX * k + (P.fold ?? FOLD_FRONT) * f) * RAD
    leg.spread = tt.legSpread + ((P.spread ?? SPREAD_END) - tt.legSpread) * f
    leg.stagger = tt.legStagger * k
    /**
     * ไล่มุมสะโพก/เข่าจากท่า hero → คำตอบ IK ของข้อเท้าท้ายเรื่อง แล้วให้ข้อเท้ารับส่วนที่เหลือ
     * ผลรวม hipX + knee + ankle คงที่ตลอด (tuner: ผลรวมคงที่ = ฝ่าเท้าขนานแผ่น)
     */
    const front = P.front ?? FRONT_LEG
    const legSide = (side: 'L' | 'R') => {
      const hipX = side === 'L' ? tt.hipLX : tt.hipRX
      const knee = side === 'L' ? tt.kneeL : tt.kneeR
      const ankle = side === 'L' ? tt.ankleL : tt.ankleR
      const foot = side === front ? { ...FOOT_FRONT, ...P.ff } : { ...FOOT_BACK, ...P.fb }
      const [hEnd, kEnd] = legIK(foot.z, foot.y)
      const o = leg[side]
      o.hipX = hipX * RAD * k + hEnd * f
      o.knee = knee * RAD * k + kEnd * f
      o.ankle = (hipX + knee + ankle) * RAD - o.hipX - o.knee
      o.hipY = (side === 'L' ? tt.hipLY : tt.hipRY) * RAD * k
      o.hipZ = (side === 'L' ? tt.hipLZ : tt.hipRZ) * RAD * k
    }
    legSide('L')
    legSide('R')
    /**
     * หัว: ไม่ตามเมาส์ในฉากนี้ — เมาส์อยู่ตรงไหนของจอก็ได้ตอนเลื่อน หัวเลยสะบัดไปมาไม่มีเหตุผลในเรื่อง
     * ต้นเรื่องมองไปทางที่พุ่งไป (GAZE_START เทียบลำตัว) → ท้ายเรื่องมองตรงกล้อง
     */
    const gaze = { ...GAZE_START, ...P.gaze }
    follow.headYaw = 0
    follow.headPitch = 0
    follow.headRoll = 0
    follow.headEase = tt.hfEase
    follow.headBaseYaw = gaze.yaw * k
    follow.headBaseRoll = gaze.roll * k
    follow.headBasePitch = gaze.pitch * k
    follow.headFollow = tt.hfFollow
    follow.headCurve = tt.hfCurve
    follow.headDead = tt.hfDead
    follow.headBounce = tt.hfBounce
    follow.headIdleBack = tt.hfIdleBack
    /* แขน: ท่าสเกตของ hero → ท่าปลายทาง ARM_END (ช่องมุมที่ไม่ได้ระบุคลายเป็นท่าตั้งต้นของริก) */
    Object.assign(arm, armPoseFromTuner(tt))
    for (const key of ARM_ANGLES) arm[key] *= k
    const end = { ...ARM_END, ...P.arm }
    for (const key in end) arm[key] = (ARM_ANGLES as readonly string[]).includes(key) ? arm[key] + end[key] * f : arm[key] * k + end[key] * f
    /* ตาดำ: เหลือบข้างแบบ hero ตอนต้น (มองทางที่พุ่ง) → กลางตาตอนจบ = มองคนดูตรง ๆ */
    Object.assign(face, facePoseFromTuner(tt))
    face.pupilX = tt.fcPupilX * k
    face.pupilY = tt.fcPupilY * k
  }, -900)

  useFrame(({ camera }) => {
    const o = g.current
    const f = fit.current
    if (!o || !f) return
    /* กล้อง: ไกล/แคบตอนต้น → ใกล้/กว้าง/ต่ำตอนท้าย (ตัวละครพุ่งเข้าหาคนดู) */
    {
      const q = smooth((prog.current ?? 0) / 0.75)
      const cam = camera as THREE.PerspectiveCamera
      const near = { ...CAM_NEAR, ...devPose().cam }
      cam.fov = CAM_FAR.fov + (near.fov - CAM_FAR.fov) * q
      cam.position.set(0, CAM_FAR.y + (near.y - CAM_FAR.y) * q, CAM_FAR.z + (near.z - CAM_FAR.z) * q)
      cam.lookAt(0, CAM_FAR.look + (near.look - CAM_FAR.look) * q, 0)
      cam.updateProjectionMatrix()
    }
    if (!done.current) {
      o.rotation.set(0, 0, 0)
      o.scale.setScalar(1)
      o.position.set(0, 0, 0)
      o.updateMatrixWorld(true)
      FIT_BOX.setFromObject(f)
      if (FIT_BOX.isEmpty()) return
      FIT_BOX.getSize(FIT_SIZE)
      if (FIT_SIZE.y < 1e-3) return
      const k = RIDER_H / FIT_SIZE.y
      FIT_BOX.getCenter(FIT_C)
      f.scale.setScalar(k)
      f.position.set(-FIT_C.x * k, -FIT_C.y * k, -FIT_C.z * k)
      done.current = true
    }
    const tt = getTuner()
    const p = prog.current ?? 0
    const turn = 1 - smooth(p / 0.75)
    frames.current += 1
    if (!board.current) {
      f.traverse((c) => {
        if (!board.current && c.userData.rider) {
          board.current = c.children[0]?.children[0] ?? null
          body.current = c.children[0]?.children[1] ?? null
        }
      })
    }
    if (board.current && frames.current > SETTLE_FRAMES) {
      const k = 1 - turn
      /* บอร์ด: มุม hero (ลอยเฉียง) → ราบ หัวบอร์ดชี้กล้อง · เขียนทุกเฟรม (r3f ไม่ตั้ง rotation ซ้ำถ้าไม่ re-render) */
      board.current.rotation.set(
        (tt.boardRotX + (BOARD_FRONT[0] - tt.boardRotX) * k) * RAD,
        (tt.boardRotY + (BOARD_FRONT[1] - tt.boardRotY) * k) * RAD,
        (tt.boardRotZ + (BOARD_FRONT[2] - tt.boardRotZ) * k) * RAD,
      )
      body.current?.rotation.set(BODY_LEAN[0] * turn, BODY_LEAN[1] * turn, BODY_LEAN[2] * turn)
      /**
       * บอร์ดตามเท้า: Rider จัดบอร์ดไว้ครั้งเดียวใต้เท้าท่า hero แต่ท้ายเรื่องเท้าย้าย (IK หน้า-หลัง) —
       * แนวนอนไปกลางระหว่างข้อเท้าสองข้าง · แนวตั้งให้หน้าแผ่นแตะฝ่าเท้าที่ต่ำสุด (สูตรเดียวกับ Rider:
       * deckTop × สเกลบอร์ด + boardY ของ tuner — ท้ายเรื่องบอร์ดหมุนรอบแกนตั้งอย่างเดียว ระยะนี้จึงตั้งฉากพอดี)
       * ไล่ตาม k · ต้นเรื่อง = ที่เดิมของ hero
       */
      const sway = board.current.parent
      const b = body.current
      if (!boardHome.current) boardHome.current = board.current.position.clone()
      if (b && sway) {
        if (!ankles.current) {
          const l = b.getObjectByName('ankleL')
          const r = b.getObjectByName('ankleR')
          if (l && r) ankles.current = [l, r]
        }
        FIT_BOX.setFromObject(b)
        const a = ankles.current
        if (a && !FIT_BOX.isEmpty()) {
          a[0].getWorldPosition(FIT_C)
          a[1].getWorldPosition(FIT_A)
          FIT_C.add(FIT_A).multiplyScalar(0.5)
          FIT_C.y = FIT_BOX.min.y
          sway.worldToLocal(FIT_C)
          const deck = deckTop({ deckY: tt.bdRideY, deckThick: tt.bdThick } as Parameters<typeof deckTop>[0]) /* อ่านแค่สองช่องนี้ */ * board.current.scale.y
          const h = boardHome.current
          board.current.position.set(
            h.x + (FIT_C.x - h.x) * k,
            h.y + (FIT_C.y - deck + tt.boardY - h.y) * k,
            h.z + (FIT_C.z - h.z) * k,
          )
        }
      }
    }
    /* สุดที่ 1.16 ไม่ใช่ใหญ่กว่านั้น — เกินนี้ล้อบอร์ดตกขอบล่างจอ (ลองที่ 1.28 แล้ว) */
    const grow = 0.78 + ((devPose().grow ?? GROW_END) - 0.78) * smooth(p)
    o.rotation.set(AIR_PITCH * RAD * turn, (YAW_FRONT + (YAW_SIDE - YAW_FRONT) * turn) * RAD, AIR_ROLL * RAD * turn)
    o.position.set(0, AIR_LIFT * turn + (devPose().endY ?? END_Y) * (1 - turn), 0)
    o.scale.setScalar(grow)
    /**
     * ท้ายเรื่อง = บอร์ดอยู่กลางจอ ตรงจุดรวมของเส้นพื้น (ref: ทุกอย่างสมมาตรรอบบอร์ด) ไล่ตาม 1 − turn
     * ไม่ใช้กลางกรอบทั้งตัว — แขนดึงกลางกรอบเพี้ยน · ทำหลังตั้งท่า/ขนาดเฟรมนี้แล้ว
     */
    if (board.current && frames.current > SETTLE_FRAMES) {
      o.updateMatrixWorld(true)
      board.current.getWorldPosition(FIT_C)
      o.position.x = -FIT_C.x * (1 - turn)
    }
    o.position.x += START_X * turn
  })
  return (
    <group ref={g}>
      <group ref={fit}>
        {/* ไม่ส่ง noLumber/noWind — แขนเหลี่ยม (lumberArms) กับลมที่เสื้อคือหน้าตาของตัวใน hero ปิดแล้วกลายเป็นแขนกลมของ GLB = คนละตัว */}
        <Suspense fallback={null}>
          <HeroRider torsoPose={torso as never} legPose={leg as never} followOverride={follow as never} armPose={arm as never} facePose={face as never} />
        </Suspense>
      </group>
    </group>
  )
}

/**
 * IK ขาสองท่อนในระนาบขา: ข้อเท้าเทียบสะโพก (z ไปหน้า, y ขึ้น · หน่วย mascot) → [hipX, knee] เรเดียน
 * ท่อนขาชี้ทิศ (−sin θ, −cos θ) ในแกน (z, y) — แบบเดียวกับ rotation.x ของริก · เข่างอไปหน้าเสมอ (knee บวก)
 */
function legIK(z: number, y: number): [number, number] {
  const c = (z * z + y * y - THIGH_A ** 2 - SHIN_B ** 2) / (2 * THIGH_A * SHIN_B)
  const knee = Math.acos(Math.min(1, Math.max(-1, c)))
  const phi = Math.atan2(-z, -y)
  return [phi - Math.atan2(SHIN_B * Math.sin(knee), THIGH_A + SHIN_B * Math.cos(knee)), knee]
}

type Foot = { z?: number; y?: number }
/** ทดลองท่า/กล้องท้ายเรื่องจากคอนโซล (dev เท่านั้น): window.__pose = { fold, front, spread, ff, fb, arm, cam } */
function devPose(): { fold?: number; front?: 'L' | 'R'; spread?: number; ff?: Foot; fb?: Foot; arm?: Record<string, number>; cam?: Partial<typeof CAM_NEAR>; endY?: number; grow?: number; headUp?: number; gaze?: Partial<typeof GAZE_START> } {
  return (import.meta.env.DEV && (window as unknown as { __pose?: object }).__pose) || {}
}

/* ---------- เส้นความเร็ว / เส้นพื้น ---------- */

/**
 * เส้นสองชุดแบบ ref — เส้นตรงขาว ปลายมน วาดใน SVG เต็มจอ (viewBox 1600×900, ไม่รักษาสัดส่วนไม่ได้: ใช้ slice)
 *   speed  เส้นเฉียงข้างหลังตัวละครตอนยังหันข้าง (ฝั่งซ้าย = ทิศที่มา) — จางเมื่อหันหน้า (--speed)
 *   ground เส้นพื้น perspective แผ่ออกจากใต้บอร์ด + เส้นขอบฟ้าใต้ตัว — โผล่เมื่อหันหน้าพุ่งเข้าหา (--ground)
 */
function SpeedLines({ svgRef }: { svgRef: React.RefObject<SVGSVGElement | null> }) {
  /* ตัวละครต้นเรื่องอยู่ราวหนึ่งในสี่จากซ้าย (START_X) — เส้นอยู่ซ้ายสุด ข้างหลังตัว (ทิศที่พุ่งมา) */
  const speed: [number, number, number, number][] = [
    [90, 230, 190, 350],
    [40, 330, 170, 480],
    [80, 540, 190, 640],
    [250, 150, 330, 210],
  ]
  /* จุดหายใต้บอร์ด (800, 640) แผ่ออกไปขอบล่าง */
  const ground: [number, number, number, number][] = [
    [720, 680, 420, 900],
    [760, 690, 640, 900],
    [800, 700, 800, 900],
    [840, 690, 960, 900],
    [880, 680, 1180, 900],
    [600, 660, 300, 760],
    [1000, 660, 1300, 760],
  ]
  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      fill="none"
      stroke="#fff"
      strokeWidth={6}
      strokeLinecap="round"
    >
      <g style={{ opacity: 'var(--speed, 1)' }}>
        {speed.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <g style={{ opacity: 'var(--ground, 0)' }}>
        <line x1={460} y1={645} x2={1140} y2={645} />
        {ground.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
    </svg>
  )
}

function smooth(x: number) {
  const u = Math.min(1, Math.max(0, x))
  return u * u * (3 - 2 * u)
}
