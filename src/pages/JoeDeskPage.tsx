import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { SITE } from '@/config/site'
import { DeskScene } from './joeDesk/DeskScene'

/**
 * หน้า /joe-desk — ส่วน landing จาก Figma "Joe-Space" (Landing Page 751:2681 · hero-section 751:2682)
 *
 * ภาพประกอบโต๊ะทำงานไอโซเมตริกเป็นชิ้น export จาก Figma (public/joe-desk) — แต่ละชิ้นถูกตัดตามขอบเฟรม 1440×800
 * จึงวางตามพิกัดในดีไซน์ตรง ๆ: ทั้งฉากเป็นเวที 1440×800 แล้วย่อขยายตามความกว้างจอ (ภาพกับตัวหนังสือสัดส่วนเดิมเป๊ะ)
 * แถบเบราว์เซอร์จำลองบนสุดของเฟรม (Example 751:3994) เป็นกรอบนำเสนอของดีไซน์ ไม่ใช่เนื้อหาหน้า — ไม่ได้ทำ
 */
const W = 1440
const H = 800
const A = '/joe-desk'
const FONT = "'Google Sans', 'DM Sans', ui-sans-serif, system-ui, sans-serif"

const NAV = [
  { label: 'Home', to: '/joe-desk' },
  { label: 'About', to: '/about' },
  { label: 'Works', to: '/2026-final' },
  { label: 'Sandbox', to: '/joespresso' },
] as const


function Tag({ label, bg, x, y }: { label: string; bg: string; x: number; y: number }) {
  return (
    <span className="absolute rounded-full px-4 py-2 text-[14px] leading-none font-medium whitespace-nowrap text-white" style={{ left: x, top: y, background: bg }}>
      {label}
    </span>
  )
}

export default function JoeDeskPage() {
  const navigate = useNavigate()
  const box = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return undefined
    const fit = () => setK(el.clientWidth / W)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={box} className="min-h-[100svh] w-full overflow-hidden bg-[#f5e6fd]" style={{ fontFamily: FONT }}>
      <section className="relative w-full overflow-hidden bg-gradient-to-t from-[#f5e6fd] via-white to-[#fff4df]" style={{ height: H * k }} aria-label="Joe — landing">
        {/* โต๊ะทำงานไอโซเมตริกเป็นฉาก 3D (นอกเวทีที่ย่อขยายด้วย transform — แคนวาสวัดขนาดจริงของตัวเอง) */}
        {/* พื้นจาง ๆ ใต้ฉาก (Rectangle 161124270) — อยู่หลังภาพประกอบแบบในดีไซน์ */}
        <img src={`${A}/floor.png`} alt="" className="absolute bottom-0 left-1/2 -translate-x-1/2 object-cover" style={{ width: 1143 * k, height: 97 * k }} />
        <div className="absolute inset-0">
          <DeskScene zoom={k} />
        </div>
        <div className="absolute top-0 left-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${k})` }}>

          {/* หัวเรื่อง + เคอร์เซอร์ร่วมแก้ (Joe · Windy) */}
          <Tag label="Joe" bg="#fd5000" x={221} y={204} />
          <img src={`${A}/cursor-joe.svg`} alt="" className="absolute rotate-180" style={{ left: 278, top: 238, width: 27.41, height: 28.43 }} />
          <h1 className="absolute text-[72px] leading-[normal] font-normal whitespace-nowrap text-[#292a2e]" style={{ left: 221, top: 288 }}>
            <span className="flex items-center gap-4">
              Turning
              <span className="flex items-center justify-center rounded-[24px] border border-dashed border-[#1868db] bg-[rgba(24,104,219,0.05)] p-6 leading-[0.72] font-bold text-[#1868db]">Vision</span>
            </span>
            <span className="absolute left-0 flex h-[80px] items-center gap-4" style={{ top: 412 - 288 }}>
              into <span className="font-bold text-[#ef4343]">{'{Experiences}'}</span>
            </span>
          </h1>
          <p className="absolute text-[16px] leading-[normal] whitespace-pre text-[#666]" style={{ left: 221, top: 516 }}>
            {'I love crafting valuable things with passionate people to bringing design \nto a real-world impact solution.'}
          </p>
          <img src={`${A}/cursor-windy.svg`} alt="" className="absolute" style={{ left: 812, top: 508, width: 27.41, height: 28.43 }} />
          <Tag label="Windy" bg="#1868db" x={838} y={534} />

          {/* เมนู (Group 1321317021) */}
          <nav className="absolute top-0 left-0 h-[80px] w-full">
            <img src={`${A}/nav-bg.png`} alt="" className="absolute inset-0 size-full object-cover" />
            <button type="button" onClick={() => navigate('/joe-desk')} className="absolute cursor-pointer" style={{ left: 64, top: 24 }} aria-label="Joe — home">
              <img src={`${A}/logo.svg`} alt="Joe" style={{ width: 93.71, height: 32 }} />
            </button>
            <div className="absolute flex items-center gap-[5px]" style={{ left: 553, top: 23 }}>
              {NAV.map((n) => (
                <button
                  key={n.label}
                  type="button"
                  onClick={() => navigate(n.to)}
                  className={`flex w-[80px] cursor-pointer items-center justify-center rounded-full px-4 py-2 text-[14px] leading-[normal] font-medium whitespace-nowrap transition-colors ${n.label === 'Home' ? 'bg-[#fd5000] text-white' : 'text-[#292a2e] hover:bg-black/5'}`}
                >
                  {n.label}
                </button>
              ))}
            </div>
            <a href={SITE.resumeUrl} target="_blank" rel="noreferrer" className="absolute flex cursor-pointer items-center justify-center rounded-full bg-[#fd5000] px-4 py-2 text-[14px] leading-[normal] font-medium text-white transition-transform hover:scale-[1.04]" style={{ left: 1291, top: 23 }}>
              Resume
            </a>
          </nav>

          {/* รางจุดบอกส่วนของหน้า (achor 751:3993) — จุดแรก = landing */}
          <div className="absolute flex rounded-full bg-white p-2 drop-shadow-[0px_4px_12px_rgba(219,219,219,0.12)]" style={{ left: 64, top: 251 }}>
            <img src={`${A}/anchor.svg`} alt="" style={{ width: 16, height: 296 }} />
          </div>
        </div>
      </section>
    </div>
  )
}
