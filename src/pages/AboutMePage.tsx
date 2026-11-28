import { Suspense, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SITE } from '@/config/site'
import { CharacterHead } from '@/sections/skystory/head'
import { WORKS } from '@/sections/hero/WorksGallery'
import { STORY_FONT } from '@/sections/hero/workMotion'
import modride from '@/assets/portfolios/modride-new-card.jpg'
import ekyc from '@/assets/portfolios/ekyc-new-card.jpg'
import hotel from '@/assets/portfolios/hotel-new-card.jpg'
import caseKeeper from '@/assets/portfolios/ck-um-1.jpg'
import penNib from '@/assets/icons/pen-nib.svg?raw'
import './portfolio2026final.css'

/**
 * หน้า About me (/about) — เข้าจากการคลิกตัวละครใน hero ของ /2026-final
 *
 * ท่าภาพแบบ ref "Bluebird" (การ์ดฟ้าหม่นเต็มจอ): เมนูลอยในการ์ด · ชื่อตัวใหญ่ serif จาง ๆ พาดหลัง
 * ตัวหลักกลางจอ = หัวตัวละคร 3D ตัวเดียวกับ hero (หันตามเคอร์เซอร์ ท้ายจางลงพื้น) · หัวเรื่องสองบรรทัดซ้ายล่าง + ปุ่ม
 * ขวาล่าง: การ์ดแก้วสามใบ (ทำอะไร · งานที่เลือก · จำนวนงาน) + แคปซูลภาพงานจริง
 *
 * ข้อมูลทุกบรรทัดมาจากของจริง: config/site (ชื่อ ลิงก์ อีเมล) · WORKS (จำนวนงาน ช่วงปี) · คำของ Joe บนเว็บ
 */
const CARDS = [modride, ekyc, hotel, caseKeeper]
/** ช่วงปีของงาน — อ่านจากคำบรรยายงานจริง (ไม่ตั้งเอง) */
const YEARS = WORKS.flatMap((w) => (w.sub.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number))
const Y0 = Math.min(...YEARS)
const Y1 = Math.max(...YEARS)

/** ฟ้าชุดเดียวกับ hero: น้ำเงินอิ่มด้านบน → ฟ้าอ่อนใกล้ขอบฟ้า + แสงแดดฟุ้งขวาบน */
const SKY =
  'radial-gradient(38% 34% at 66% 22%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 100%), radial-gradient(70% 50% at 50% 100%, rgba(214,236,255,0.75) 0%, rgba(214,236,255,0) 100%), linear-gradient(180deg, #2c68d4 0%, #3f82e2 30%, #6aa6ee 62%, #a9d2f7 100%)'
/** ก้อนเมฆจุดครึ่งโทน — ฟุ้งเป็นแพในครึ่งบน (ล่างเป็นที่ของตัวหนังสือ) */
const HALFTONE_MASK =
  'radial-gradient(22% 12% at 18% 14%, #000 0%, transparent 100%), radial-gradient(26% 13% at 74% 20%, #000 0%, transparent 100%), radial-gradient(18% 10% at 46% 9%, #000 0%, transparent 100%), radial-gradient(20% 11% at 90% 46%, #000 0%, transparent 100%)'

/** เมฆขาวฟูมุมจอ (แบบเมฆของ hero) — วงกลมซ้อน ไล่เงาท้องเมฆ */
function Cloud({ className = '' }: { className?: string }) {
  const puff = 'absolute rounded-full bg-[radial-gradient(circle_at_40%_30%,#ffffff_0%,#f3f8ff_55%,#d6e6fa_100%)] shadow-[inset_-8px_-14px_24px_rgba(140,175,225,0.35)]'
  return (
    <div aria-hidden className={`pointer-events-none absolute aspect-[1.6] ${className}`}>
      <span className={`${puff} bottom-0 left-[4%] h-[62%] w-[46%]`} />
      <span className={`${puff} bottom-[10%] left-[26%] h-[88%] w-[54%]`} />
      <span className={`${puff} bottom-0 left-[56%] h-[58%] w-[42%]`} />
    </div>
  )
}

const NAV = [
  { label: 'home', to: '/2026-final' },
  { label: 'about', to: '/about' },
  { label: 'work', to: '/2026-final' },
] as const

/** หัวตัวละคร: หันตามเคอร์เซอร์นุ่ม ๆ + ลอยหายใจ */
function Head({ aim }: { aim: React.RefObject<{ x: number; y: number }> }) {
  const g = useRef<THREE.Group>(null)
  useFrame((st, dt) => {
    const gg = g.current
    if (!gg) return
    const a = 1 - Math.exp(-dt * 4)
    const t = st.clock.elapsedTime
    gg.rotation.y += (aim.current.x * 0.55 - 0.18 - gg.rotation.y) * a
    gg.rotation.x += (aim.current.y * 0.22 + 0.04 - gg.rotation.x) * a
    gg.position.y = Math.sin(t * 1.1) * 0.025
  })
  return (
    <group ref={g}>
      <CharacterHead />
    </group>
  )
}

/** ปุ่มลูกศรมุมการ์ด */
function Arrow() {
  return (
    <span className="grid size-[30px] place-items-center rounded-full bg-white/35 text-white backdrop-blur-sm">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        <path d="M3 9l6-6M4.5 3H9v4.5" />
      </svg>
    </span>
  )
}

export default function AboutMePage() {
  const navigate = useNavigate()
  const aim = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const move = (e: PointerEvent) => {
      aim.current.x = (e.clientX / window.innerWidth) * 2 - 1
      aim.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  const glass = 'rounded-[22px] border border-white/45 bg-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-md'

  return (
    <div className="v3 flex min-h-[100svh] w-full items-stretch" style={{ fontFamily: STORY_FONT, background: SKY }}>
      {/* เต็มจอ — ไม่มีขอบพื้นรอบการ์ด */}
      <div
        className="relative flex min-h-[100svh] w-full flex-col overflow-hidden text-white"
        style={{
          background: SKY,
        }}
      >
        {/* เมฆจุดครึ่งโทน (แบบฟ้าของ hero) — ลายจุดขาวบาง ๆ เฉพาะในก้อนเมฆฟุ้ง */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.55) 1.1px, transparent 1.6px)',
            backgroundSize: '6px 6px',
            maskImage: HALFTONE_MASK,
            WebkitMaskImage: HALFTONE_MASK,
            opacity: 0.55,
          }}
        />
        {/* เมฆฟูโผล่จากขอบซ้ายขวากลางจอ (ไม่ทับตัวหนังสือ/การ์ดข้างล่าง) */}
        <Cloud className="top-[34%] -left-[7%] w-[clamp(140px,15vw,260px)] max-md:hidden" />
        <Cloud className="top-[22%] -right-[6%] w-[clamp(150px,17vw,290px)] -scale-x-100 max-md:hidden" />
        {/* เมนู */}
        <nav className="relative z-20 flex items-center justify-between px-[clamp(16px,3vw,44px)] pt-[clamp(14px,2vw,26px)]">
          <button type="button" onClick={() => navigate('/2026-final')} className="cursor-pointer" aria-label="Home">
            <img src="/favicon-192.png" alt="" className="size-[34px] rounded-[10px] shadow-[0_6px_16px_rgba(40,80,130,0.25)]" />
          </button>
          <div className="flex items-center gap-[clamp(4px,1.6vw,30px)] text-[12px] font-bold tracking-[0.04em] text-white uppercase max-sm:hidden">
            {NAV.map((n) => (
              <button
                key={n.label}
                type="button"
                onClick={() => navigate(n.to)}
                className={`cursor-pointer rounded-full px-3 py-[6px] uppercase transition-colors hover:bg-white/15 ${n.label === 'about' ? 'bg-white/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)]' : ''}`}
              >
                {n.label}
              </button>
            ))}
            <a href={`mailto:${SITE.email}`} className="cursor-pointer rounded-full px-3 py-[6px] hover:bg-white/15">
              contact
            </a>
          </div>
          {/* ปุ่ม Resume แบบเมนูหน้าหลัก: แผ่นข้อความ + แผ่นลูกศร สีกรมเข้ม */}
          <a href={SITE.resumeUrl} target="_blank" rel="noreferrer" className="flex cursor-pointer items-center gap-[3px] transition-transform hover:scale-[1.03]">
            <span className="rounded-[10px] bg-[#1d2433] px-4 py-[9px] text-[13px] font-bold text-white">Resume</span>
            <span className="grid size-[38px] place-items-center rounded-[10px] bg-[#1d2433] text-white">
              <svg viewBox="0 0 14 12" className="size-[14px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M1 6h11M7.5 1.5 12 6l-4.5 4.5" />
              </svg>
            </span>
          </a>
        </nav>

        {/* ชื่อตัวใหญ่ (ฟอนต์กลมเดียวกับเรื่องหน้าหลัก) ขาวจาง ๆ พาดหลังตัวหลัก */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[17%] text-center max-md:top-[96px] leading-none tracking-[-0.02em] whitespace-nowrap select-none"
          style={{
            fontWeight: 800,
            letterSpacing: '-0.045em',
            fontSize: 'clamp(46px, 12vw, 236px)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.22) 55%, rgba(255,255,255,0) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          PATTARAPON
        </div>

        {/* ตัวหลัก: หัวตัวละคร 3D — ท้ายจางลงพื้นการ์ด */}
        <div
          className="pointer-events-none absolute top-[10%] left-1/2 aspect-square h-[84%] -translate-x-1/2 max-md:top-[64px] max-md:h-[46svh]"
          style={{ maskImage: 'linear-gradient(180deg, #000 62%, transparent 94%)', WebkitMaskImage: 'linear-gradient(180deg, #000 62%, transparent 94%)' }}
        >
          <Canvas dpr={[1, 2]} camera={{ fov: 28, position: [0, -0.05, 4.3] }} gl={{ antialias: true, alpha: true }}>
            <hemisphereLight args={['#ffffff', '#5f95e0', 1.7]} />
            <directionalLight position={[-2, 3, 4]} intensity={2.3} color="#fff4e6" />
            <directionalLight position={[3, 1, -2]} intensity={1.1} color="#bcd8ff" />
            <Suspense fallback={null}>
              <Head aim={aim} />
            </Suspense>
          </Canvas>
        </div>

        {/* ล่าง: หัวเรื่องซ้าย · การ์ดขวา */}
        <div className="relative z-10 mt-auto flex items-end max-md:mt-[calc(30px+38svh)] justify-between gap-6 px-[clamp(16px,3vw,44px)] pb-[clamp(16px,3vw,40px)] max-lg:flex-col max-lg:items-stretch">
          <div className="max-w-[360px]">
            {/* หัวเรื่องแบบหัวเรื่อง hero: ตัวกลมหนาขาว มีสันหนาด้านล่าง · คำท้ายสีพาสเทลไล่แบบ "LIFE" */}
            <h1 className="text-[clamp(38px,3.8vw,62px)] leading-[1.02] font-extrabold tracking-[-0.035em] [text-shadow:0_3px_0_#c9d9f3,0_5px_0_#a9c1ea,0_12px_22px_rgba(20,50,120,0.28)]">
              Design
              <br />
              <span className="pl-[1.1em]">
                <span className="text-white/70">&amp;</span>{' '}
                <span className="bg-[linear-gradient(90deg,#b8f5c8_0%,#e3c8ff_38%,#a8f0ff_66%,#ffd9a8_100%)] bg-clip-text text-transparent [text-shadow:none] [filter:drop-shadow(0_3px_0_#c9d9f3)_drop-shadow(0_10px_16px_rgba(20,50,120,0.25))]">code</span>
              </span>
            </h1>
            <p className="mt-4 pl-[1.1em] text-[13px] leading-[1.45] text-white/80">
              Hello, I'm Joe — {SITE.name}.
              <br />I turn complicated things into digital products.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a href={SITE.resumeUrl} target="_blank" rel="noreferrer" className="flex cursor-pointer items-center gap-4 rounded-full bg-[#1d2433] py-[6px] pr-[6px] pl-5 text-[14px] font-bold shadow-[0_10px_24px_rgba(20,30,60,0.3)] transition-transform hover:scale-[1.03]">
                See résumé
                <span className="grid size-[32px] place-items-center rounded-full bg-white text-[#1d2433]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <path d="M4.5 2.5L8 6l-3.5 3.5" />
                  </svg>
                </span>
              </a>
              <a href={`mailto:${SITE.email}`} className="cursor-pointer rounded-full bg-white px-5 py-[12px] text-[14px] font-bold text-[#1d2433] transition-transform hover:scale-[1.03]">
                Contact me
              </a>
            </div>
          </div>

          <div className="flex flex-col items-end gap-4 max-lg:items-stretch">
            {/* แคปซูล: ภาพงานจริง + ทักทาง LinkedIn */}
            <a href={SITE.linkedIn} target="_blank" rel="noreferrer" className={`flex cursor-pointer items-center gap-3 self-end rounded-full py-1 pr-4 pl-1 ${glass}`}>
              <span className="flex">
                {CARDS.map((src, i) => (
                  <span key={i} className="-ml-2 block size-[34px] rounded-full bg-cover bg-left ring-2 ring-white/80 first:ml-0" style={{ backgroundImage: `url(${src})` }} />
                ))}
              </span>
              <span className="text-[12.5px] text-white/85">Say hi on LinkedIn</span>
              <span className="text-[15px] font-medium">↗</span>
            </a>

            <div className="grid grid-cols-3 items-end gap-3 max-md:grid-cols-1">
              {/* ทำอะไร */}
              <a href={SITE.resumeUrl} target="_blank" rel="noreferrer" className={`relative flex h-[clamp(130px,11vw,150px)] w-[clamp(230px,19vw,280px)] cursor-pointer items-center gap-4 p-4 max-md:w-full ${glass}`}>
                <span className="absolute top-3 right-3">
                  <Arrow />
                </span>
                <span className="grid size-[64px] shrink-0 place-items-center rounded-[18px] border border-white/60 bg-white/25 shadow-[0_8px_20px_rgba(40,80,130,0.2)] [&_path]:fill-white [&_svg]:size-[34px]" dangerouslySetInnerHTML={{ __html: penNib }} />
                <span>
                  <span className="inline-block rounded-full border border-white/50 px-2 py-[2px] text-[9.5px] text-white/85">UX/UI Designer</span>
                  <span className="mt-2 block pr-6 text-[clamp(14px,1.15vw,17px)] leading-[1.2] [text-shadow:0_1px_8px_rgba(40,80,130,0.25)]">Research, design, code &amp; ship</span>
                </span>
              </a>

              {/* งานที่เลือก — การ์ดขาวมีแถบหัว (แบบใบกลางของ ref) */}
              <button type="button" onClick={() => navigate('/2026-final')} className="relative flex h-[clamp(160px,13.5vw,182px)] w-[clamp(170px,14vw,200px)] cursor-pointer flex-col justify-end rounded-[22px] rounded-tl-none bg-white/90 max-md:mt-12 p-4 text-left text-[#1f3d58] shadow-[0_14px_30px_rgba(40,80,130,0.18)] max-md:w-full">
                <span className="absolute -top-[42px] left-0 h-[44px] w-[96px] rounded-t-[22px] bg-white/90" />
                <img src="/favicon-192.png" alt="" className="absolute -top-[34px] left-[14px] size-[60px] rounded-[18px] shadow-[0_10px_22px_rgba(29,116,255,0.3)]" />
                <span className="absolute top-3 right-3 grid size-[30px] place-items-center rounded-full bg-[#1f3d58]/8 text-[#1f3d58]">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                    <path d="M3 9l6-6M4.5 3H9v4.5" />
                  </svg>
                </span>
                <span className="text-[clamp(16px,1.3vw,19px)] leading-[1.15]">Selected work</span>
                <span className="mt-2 text-[11px] leading-[1.35] text-[#1f3d58]/65">Capstone, internship and class projects.</span>
              </button>

              {/* จำนวนงานจริง */}
              <button type="button" onClick={() => navigate('/2026-final')} className={`relative flex h-[clamp(130px,11vw,150px)] w-[clamp(200px,17vw,250px)] cursor-pointer flex-col justify-between p-4 text-left max-md:w-full ${glass}`}>
                <span className="absolute top-3 right-3">
                  <Arrow />
                </span>
                <span className="text-[clamp(48px,4.4vw,66px)] leading-none font-extralight tracking-[-0.04em]">
                  {WORKS.length}
                  <span className="ml-1 text-[0.4em] font-light tracking-normal">projects</span>
                </span>
                <span className="text-right text-[11px] leading-[1.35] text-white/80">
                  UX/UI, web dev and more,
                  <br />
                  {Y0} – {Y1}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
