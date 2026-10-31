import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { SITE } from '@/config/site'
import { AsciiClouds, type CloudBlob } from '@/components/AsciiClouds'
import modride from '@/assets/portfolios/modride-new-card.jpg'
import ekyc from '@/assets/portfolios/ekyc-new-card.jpg'
import hotel from '@/assets/portfolios/hotel-new-card.jpg'
import caseKeeper from '@/assets/portfolios/ck-um-1.jpg'
import { STORY_FONT } from '@/sections/hero/workMotion'
import './portfolio2026final.css'

/**
 * หน้า About me (/about) — เข้าจากการคลิกตัวละครใน hero ของ /2026-final
 *
 * ท่าภาพแบบหน้าจอซื้อตั๋ว Figma Config — เป็นหน้าเต็มจอ (ไม่มีกรอบแท็บเล็ต): พื้นขาว บัตรห้อยลงจากขอบบนของหน้า
 *   ซ้าย  บัตรห้อยสายคล้อง (ตั๋วขอบหยัก + รูเจาะ) — แกว่งเบา ๆ ตามเวลา และเอียงตามเคอร์เซอร์
 *   ขวา   ป้ายยืนยัน · ทักทาย · ชื่อ · หน้าที่ · ปุ่ม Résumé · ลิงก์ LinkedIn
 * ข้อมูลทุกบรรทัดมาจากของจริง (config/site — ชื่อ อีเมล ลิงก์) และคำของ Joe บนเว็บ (หัวเรื่อง hero · Research/Design/Code/Ship)
 */
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
/** รูเจาะอยู่ลึกจากขอบบนบัตรเท่านี้ (px) — จุดที่เชือกผูก และจุดหมุนของบัตร */
const HOLE_Y = 15
/** เมฆ ASCII แบบปก Fastwork (ขอบมุม) — สีฟ้าเทาจาง ๆ บนพื้นสว่าง */
const BLOBS: CloudBlob[] = [
  { x: 0.92, y: 0.96, rx: 0.32, ry: 0.24, k: 1.1, ax: 0.08, ay: 0.04, wx: 0.21, wy: 0.17, ph: 0 },
  { x: 0.94, y: 0.06, rx: 0.24, ry: 0.17, k: 0.85, ax: 0.07, ay: 0.05, wx: 0.17, wy: 0.23, ph: 1.9 },
  { x: 0.04, y: 0.98, rx: 0.22, ry: 0.18, k: 0.9, ax: 0.06, ay: 0.03, wx: 0.25, wy: 0.19, ph: 3.4 },
]
/** การ์ดงานจริงชุดเดียวกับปก Fastwork */
const CARDS = [modride, ekyc, hotel, caseKeeper]

/** ขอบหยักซ้ายขวาของตั๋ว (ครึ่งวงกลมเว้า) — mask */
const NOTCH = 'radial-gradient(circle at 0 50%, transparent 7px, #000 7.5px) left / 51% 22px repeat-y, radial-gradient(circle at 100% 50%, transparent 7px, #000 7.5px) right / 51% 22px repeat-y'

function Barcode() {
  /* แถบบาร์โค้ดจากตัวอักษรของชื่อ (กำหนดผล ไม่สุ่มทุกครั้ง) — ของตกแต่ง ไม่ได้สแกนได้จริง */
  const bars: number[] = []
  for (const ch of SITE.name.replace(/\s/g, '')) {
    const c = ch.charCodeAt(0)
    bars.push(1 + (c % 3), 1 + ((c >> 2) % 2))
  }
  let x = 0
  return (
    <svg viewBox={`0 0 ${bars.reduce((a, b) => a + b + 1.4, 0)} 30`} className="h-[34px] w-full" preserveAspectRatio="none" aria-hidden>
      {bars.map((w, i) => {
        const r = <rect key={i} x={x} y={0} width={i % 2 ? w * 0.6 : w} height={30} fill="#111" />
        x += w + 1.4
        return r
      })}
    </svg>
  )
}

export default function AboutMePage() {
  const navigate = useNavigate()
  const tag = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const shine = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const ropeA = useRef<SVGPathElement>(null)
  const ropeB = useRef<SVGPathElement>(null)

  /* แกว่งเบา ๆ ตามเวลา + เอียงตามเคอร์เซอร์ (กรองนุ่ม) */
  /*
   * ฟิสิกส์ป้ายห้อยคอ (Verlet — ทุกจุดเก็บตำแหน่งปัจจุบัน/ก่อนหน้า ความเร็วแฝงในส่วนต่าง)
   *   เชือก  ROPE_N ข้อจากจุดยึด (ขอบบนของหน้า · ข้อแรกตรึง) ระยะต่อข้อคงที่ — โค้ง ตวัด พลิ้วเอง
   *   บัตร   วัตถุแข็งสองจุด: รูเจาะ (ปลายเชือก) + จุดถ่วงล่าง (ระยะคงที่ = ทรงบัตร) → แกว่งเป็นลูกตุ้มมีแรงเฉื่อยของตัวเอง
   *   จับ    จุดที่จับบนบัตรถูกดึงตามเคอร์เซอร์ (ไม่วาร์ป — สปริงแข็ง) บัตรหมุนรอบจุดนั้นตามแรงโน้มถ่วงเอง
   *   บิด    ความเร็วแนวนอนของบัตร → หมุนรอบแกนตั้ง (เห็นหลังบัตร) แล้วสปริงกลับหันหน้า · นิ่ง = เอียงตามเคอร์เซอร์นิด ๆ
   * คิดหลายรอบย่อยต่อเฟรม (SUB) + บังคับระยะซ้ำ (ITER) ให้เชือกไม่ยืดย้วย
   */
  useEffect(() => {
    const ROPE_N = 14
    const SUB = 3
    const ITER = 10
    const G = 2600
    const L0 = Math.min(190, Math.max(100, window.innerHeight * 0.19))
    const SEG = L0 / ROPE_N
    const m = { x: 0, y: 0, sx: 0, sy: 0 }
    /* จุดทั้งหมด: 0..ROPE_N = เชือก (ข้อสุดท้าย = รูเจาะ) · ROPE_N+1 = จุดถ่วงล่างของบัตร */
    const n = ROPE_N + 2
    const X = new Float32Array(n)
    const Y = new Float32Array(n)
    const PX = new Float32Array(n)
    const PY = new Float32Array(n)
    let cardLen = 280
    for (let i = 0; i <= ROPE_N; i++) {
      X[i] = PX[i] = 0
      Y[i] = PY[i] = i * SEG
    }
    X[n - 1] = PX[n - 1] = 0
    Y[n - 1] = PY[n - 1] = L0 + cardLen
    const st = { drag: false, gx: 0, gy: 0, f: 0.5, ry: 0, vry: 0 }
    const origin = () => {
      const r = stage.current?.getBoundingClientRect()
      return r ? { x: r.left + r.width / 2, y: r.top } : { x: 0, y: 0 }
    }
    const move = (e: PointerEvent) => {
      m.x = (e.clientX / window.innerWidth) * 2 - 1
      m.y = (e.clientY / window.innerHeight) * 2 - 1
      if (st.drag) {
        const o = origin()
        st.gx = e.clientX - o.x
        st.gy = e.clientY - o.y
      }
    }
    const down = (e: PointerEvent) => {
      if (!card.current?.contains(e.target as Node)) return
      const o = origin()
      const h = ROPE_N
      const b = n - 1
      /* จุดที่จับ = สัดส่วนตามแกนบัตร (รูเจาะ → จุดถ่วงล่าง) ที่ใกล้เคอร์เซอร์ที่สุด */
      const ax = X[b] - X[h]
      const ay = Y[b] - Y[h]
      const px = e.clientX - o.x - X[h]
      const py = e.clientY - o.y - Y[h]
      st.f = Math.min(1, Math.max(0, (px * ax + py * ay) / Math.max(1, ax * ax + ay * ay)))
      st.gx = e.clientX - o.x
      st.gy = e.clientY - o.y
      st.drag = true
      document.body.style.cursor = 'grabbing'
      e.preventDefault()
    }
    const up = () => {
      if (!st.drag) return
      st.drag = false
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      /* เวลา rAF เฟรมแรกอาจน้อยกว่า performance.now() ตอนตั้งต้น — ติดลบแล้วฟิสิกส์พัง (NaN) */
      const fdt = Math.min(1 / 30, Math.max(0, (now - last) / 1000))
      last = now
      m.sx += (m.x - m.sx) * 0.07
      m.sy += (m.y - m.sy) * 0.07
      const el = card.current
      if (el && el.offsetHeight) cardLen = el.offsetHeight * 0.62
      const dt = fdt / SUB
      const h = ROPE_N
      const b = n - 1
      const hx0 = X[h]
      for (let k = 0; k < SUB; k++) {
        /* เคลื่อนที่: ความเร็วแฝง (หน่วงอากาศ) + แรงโน้มถ่วง */
        for (let i = 1; i < n; i++) {
          /* หน่วงอากาศ (ต่อรอบย่อย) · เพดานความเร็วต่อจุด — ปล่อยแล้วไม่ดีดดึ๋ง */
          let vx = (X[i] - PX[i]) * 0.984
          let vy = (Y[i] - PY[i]) * 0.984
          const vm = Math.hypot(vx, vy)
          const cap = 1300 * dt
          if (vm > cap && vm > 0) {
            vx *= cap / vm
            vy *= cap / vm
          }
          PX[i] = X[i]
          PY[i] = Y[i]
          X[i] += vx
          Y[i] += vy + G * dt * dt
        }
        for (let it = 0; it < ITER; it++) {
          /* จับ: ดึงจุดที่จับบนบัตรเข้าหาเคอร์เซอร์ (แบ่งให้รูเจาะ/จุดถ่วงตามสัดส่วน) */
          if (st.drag) {
            const cx = X[h] + (X[b] - X[h]) * st.f
            const cy = Y[h] + (Y[b] - Y[h]) * st.f
            const dx = (st.gx - cx) * 0.5
            const dy = (st.gy - cy) * 0.5
            X[h] += dx * (1 - st.f)
            Y[h] += dy * (1 - st.f)
            X[b] += dx * st.f
            Y[b] += dy * st.f
          }
          /* ระยะต่อข้อของเชือก (ข้อแรกตรึงที่จุดยึด) */
          X[0] = 0
          Y[0] = 0
          for (let i = 0; i < ROPE_N; i++) {
            const dx = X[i + 1] - X[i]
            const dy = Y[i + 1] - Y[i]
            const d = Math.hypot(dx, dy) || 1e-6
            const diff = (d - SEG) / d
            if (i === 0) {
              X[1] -= dx * diff
              Y[1] -= dy * diff
            } else {
              X[i] += dx * diff * 0.5
              Y[i] += dy * diff * 0.5
              X[i + 1] -= dx * diff * 0.5
              Y[i + 1] -= dy * diff * 0.5
            }
          }
          /* บัตรแข็ง: รูเจาะ ↔ จุดถ่วง ระยะคงที่ (จุดถ่วงหนักกว่า = แกว่งช้า มีน้ำหนัก) */
          const dx = X[b] - X[h]
          const dy = Y[b] - Y[h]
          const d = Math.hypot(dx, dy) || 1e-6
          const diff = (d - cardLen) / d
          X[h] += dx * diff * 0.6
          Y[h] += dy * diff * 0.6
          X[b] -= dx * diff * 0.4
          Y[b] -= dy * diff * 0.4
        }
      }
      /* วาด: เชือกโค้งผ่านทุกข้อ (สองเส้นเหลื่อมนิด = สายคล้องแบน) · บัตรวางที่รูเจาะ หมุนตามแกนบัตร */
      let dA = `M${X[0].toFixed(1)} ${Y[0].toFixed(1)}`
      let dB = `M${(X[0] + 7).toFixed(1)} ${Y[0].toFixed(1)}`
      for (let i = 1; i <= ROPE_N; i++) {
        const mx = (X[i - 1] + X[i]) / 2
        const my = (Y[i - 1] + Y[i]) / 2
        dA += ` Q${X[i - 1].toFixed(1)} ${Y[i - 1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`
        const t = 1 - i / ROPE_N
        dB += ` Q${(X[i - 1] + 7 * (t + 1 / ROPE_N)).toFixed(1)} ${Y[i - 1].toFixed(1)} ${(mx + 7 * t).toFixed(1)} ${my.toFixed(1)}`
      }
      dA += ` L${X[h].toFixed(1)} ${Y[h].toFixed(1)}`
      dB += ` L${X[h].toFixed(1)} ${Y[h].toFixed(1)}`
      const sw = stage.current?.offsetWidth ?? 0
      ropeA.current?.setAttribute('d', dA)
      ropeB.current?.setAttribute('d', dB)
      ropeA.current?.setAttribute('transform', `translate(${(sw / 2).toFixed(1)} 0)`)
      ropeB.current?.setAttribute('transform', `translate(${(sw / 2).toFixed(1)} 0)`)
      const ang = (Math.atan2(-(X[b] - X[h]), Y[b] - Y[h]) * 180) / Math.PI
      const cw = el?.offsetWidth ?? 0
      if (tag.current) tag.current.style.transform = `translate(${(sw / 2 + X[h] - cw / 2).toFixed(1)}px, ${(Y[h] - HOLE_Y).toFixed(1)}px) rotate(${ang.toFixed(2)}deg)`
      /* บิดรอบแกนตั้งจากความเร็วแนวนอนของรูเจาะ */
      /* หน่วย: ry องศา · vry องศา/วินาที · vx px/วินาที — เหวี่ยงแรงราว 2000 px/s ได้หมุนราวครึ่งรอบ แล้วสปริงกลับ */
      const vx = (X[h] - hx0) / Math.max(1e-3, fdt)
      st.vry += vx * 0.6 * fdt
      const home = Math.round(st.ry / 360) * 360 + m.sx * 18
      st.vry += (home - st.ry) * 40 * fdt
      /* หน่วงหนักเกือบวิกฤต — กลับหันหน้านุ่ม ๆ ไม่เด้งไปมา */
      st.vry *= Math.pow(0.0015, fdt)
      st.ry += st.vry * fdt
      if (card.current) card.current.style.transform = `rotateX(${(-m.sy * 6).toFixed(2)}deg) rotateY(${st.ry.toFixed(2)}deg)`
      if (shine.current) {
        const a = ((st.ry % 360) + 360) % 360
        const k = a > 180 ? a - 360 : a
        shine.current.style.backgroundPosition = `${(50 - k * 2.2).toFixed(1)}% 0`
        shine.current.style.opacity = (0.35 + Math.min(0.5, Math.abs(k) / 60)).toFixed(3)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  return (
    <div className="v3 relative flex min-h-[100svh] w-full overflow-hidden bg-white" style={{ fontFamily: STORY_FONT }}>
      {/* เมฆ ASCII ตามขอบ (แบบปก Fastwork) */}
      <AsciiClouds blobs={BLOBS} rgb="70,110,200" alpha={[0.08, 0.26]} className="pointer-events-none fixed inset-0" />
      <div className="relative flex min-h-[100svh] w-full max-md:flex-col">
          {/* กลับ */}
          <button
            type="button"
            onClick={() => navigate('/2026-final')}
            aria-label="Back"
            className="fixed top-[clamp(16px,3vh,32px)] left-[clamp(16px,3vw,40px)] z-10 grid size-[clamp(40px,3.8vw,52px)] cursor-pointer place-items-center rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.12)] transition-transform hover:scale-105"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>

          {/* ซ้าย: บัตรห้อยสายคล้อง */}
          <div ref={stage} className="relative min-h-[70svh] w-[46%] max-md:w-full">
            {/* สายคล้อง (เชือกหลายข้อ — วาดจากจุดของฟิสิกส์ทุกเฟรม) · จุดยึด = ขอบบนกลางคอลัมน์ */}
            <svg className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible" aria-hidden>
              <path ref={ropeA} fill="none" stroke="#111" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              <path ref={ropeB} fill="none" stroke="#3a3a40" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div ref={tag} className="absolute top-0 left-0 z-20 [perspective:1400px]" style={{ transformOrigin: `50% ${HOLE_Y}px` }}>
              {/* ตัวบัตร 3D: หลังบัตร + ความหนา (ชั้นซ้อนเข้มขึ้นทีละนิด) + หน้า + แสงสะท้อน — จับลากได้ (ฟิสิกส์สายคล้อง) */}
              <div ref={card} className="relative cursor-grab touch-none select-none [transform-style:preserve-3d] [&_img]:pointer-events-none" style={{ transformOrigin: `50% ${HOLE_Y}px` }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="absolute inset-0" style={{ mask: NOTCH, WebkitMask: NOTCH, background: `rgb(${226 - i * 7},${222 - i * 7},${213 - i * 7})`, transform: `translateZ(${-i * 1.3}px)` }} />
              ))}
              {/* หลังบัตร */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#e9e6de] [backface-visibility:hidden]" style={{ mask: NOTCH, WebkitMask: NOTCH, transform: 'rotateY(180deg) translateZ(7.5px)' }}>
                <img src="/favicon-192.png" alt="" className="size-[34%] rounded-[22%]" />
                <div className="text-[clamp(18px,1.9vw,24px)] font-bold tracking-[-0.03em]">Joe</div>
                <div className="text-[10px] tracking-[0.14em] uppercase" style={{ fontFamily: MONO }}>
                  Portfolio {SITE.copyrightYear}
                </div>
              </div>
              <div className="relative w-[clamp(220px,24vw,330px)] bg-[#f1efe9] text-[#111] [backface-visibility:hidden]" style={{ mask: NOTCH, WebkitMask: NOTCH }}>
                {/* แสงสะท้อนวิ่งตามมุมหมุน */}
                <div ref={shine} className="pointer-events-none absolute inset-0 z-20 mix-blend-soft-light" style={{ background: 'linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.9) 50%, transparent 62%)', backgroundSize: '260% 100%' }} />
                <span className="absolute top-[6px] left-1/2 z-10 size-[18px] -translate-x-1/2 rounded-full border-[3px] border-[#111] bg-[#f4f4f5]" />
                {/* หัวตั๋ว */}
                <div className="flex items-start justify-between px-[8%] pt-[30px] pb-3">
                  <div>
                    <div className="text-[clamp(18px,1.9vw,24px)] leading-none font-bold tracking-[-0.03em]">Joe</div>
                    <div className="mt-2 inline-block rounded-full border border-[#111] px-2 py-[2px] text-[10px]">Portfolio {SITE.copyrightYear}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-[3px]" aria-hidden>
                    <span className="size-[14px] rounded-full rounded-tr-none bg-[#fd5000]" />
                    <span className="size-[14px] rounded-full bg-[#ad85fe]" />
                    <span className="size-[14px] rounded-full rounded-bl-none bg-[#158ffc]" />
                    <span className="size-[14px] rounded-full bg-[#008254]" />
                  </div>
                </div>
                <div className="mx-[6%] border-t border-dashed border-[#111]/40" />
                <div className="flex justify-between px-[8%] py-3 text-[8.5px] leading-[1.4] uppercase" style={{ fontFamily: MONO }}>
                  <div>
                    Research
                    <br />
                    Design
                    <br />
                    Code
                    <br />
                    Ship
                  </div>
                  <div className="border-l border-[#111]/30 pl-3 text-right">
                    UX/UI Designer
                    <br />—<br />
                    {SITE.name}
                  </div>
                </div>
                <div className="mx-[6%] border-t border-dashed border-[#111]/40" />
                {/* ภาพปก: หัวเรื่อง hero + รูปทรงสีของแบรนด์ · วงกลม = รูป Joe */}
                <div className="relative mx-[6%] my-3 aspect-[1.08] overflow-hidden bg-[#111] text-white">
                  <div className="absolute top-[7%] left-[7%] z-10 text-[clamp(16px,1.8vw,23px)] leading-[1.02] font-semibold tracking-[-0.03em]">
                    Bring your
                    <br />
                    ideas
                    <br />
                    to life.
                  </div>
                  <span className="absolute top-0 right-0 h-[42%] w-[38%] rounded-bl-[60%] rounded-tl-[60%] bg-[#fd5000]" />
                  <span className="absolute right-[28%] bottom-0 h-[50%] w-[24%] rounded-t-[60%] bg-[#ad85fe]" />
                  <span className="absolute right-0 bottom-0 h-[56%] w-[26%] rounded-tl-[100%] bg-[#008254]" />
                  <img src="/photos/joe-portrait.jpg" alt={SITE.name} className="absolute bottom-[5%] left-[14%] size-[36%] rounded-full object-cover object-[50%_18%]" />
                </div>
                <div className="mx-[6%] border-t border-dashed border-[#111]/40" />
                <div className="grid grid-cols-[1fr_auto] gap-2 px-[8%] py-3 text-[8px] uppercase" style={{ fontFamily: MONO }}>
                  <div>
                    <div className="text-[#111]/60">Role</div>
                    <div className="mt-1 text-[9px] font-semibold">UX/UI Designer</div>
                  </div>
                  <div className="border-l border-[#111]/30 pl-3">
                    <div className="text-[#111]/60">Name</div>
                    <div className="mt-1 text-[9px] font-semibold">{SITE.name}</div>
                  </div>
                </div>
                <div className="mx-[6%] border-t border-dashed border-[#111]/40" />
                <a href={SITE.linkedIn} target="_blank" rel="noreferrer" className="flex cursor-pointer items-end gap-3 px-[8%] pt-3 pb-5">
                  <div className="flex-1">
                    <Barcode />
                    <div className="mt-1 text-[9px] tracking-[0.1em]" style={{ fontFamily: MONO }}>
                      JOE · {SITE.copyrightYear}
                    </div>
                  </div>
                  <div className="text-[7px] leading-[1.3] uppercase" style={{ fontFamily: MONO }}>
                    Scan
                    <br />
                    to
                    <br />
                    connect
                  </div>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#111" strokeWidth="1.5" aria-hidden>
                    <path d="M3 3l12 12M15 6v9H6" />
                  </svg>
                </a>
              </div>
              </div>
            </div>
          </div>

          {/* ขวา: ข้อมูล */}
          <div className="flex flex-1 flex-col items-center justify-center px-[5%] py-[8vh] text-center">
            {/* ไอคอนหัวตัวละคร (favicon ของเว็บ — เงาซ้อนสีแบบปก Fastwork) */}
            <img src="/favicon-192.png" alt="" className="size-[clamp(56px,5vw,72px)] rounded-[22%] shadow-[0_10px_30px_rgba(30,60,140,0.22)]" />
            <h1 className="mt-5 text-[clamp(18px,1.8vw,24px)] font-medium text-[#2f8cff]">Hello, I'm Joe.</h1>
            <p className="mt-1 text-[clamp(15px,1.5vw,19px)] text-[#888]">
              You're meeting <span className="text-[#111]">{SITE.name}</span>
            </p>
            {/* หัวเรื่องจากปก Fastwork (คำของ Joe) */}
            <p className="mt-6 text-[clamp(24px,2.6vw,38px)] leading-[1.12] font-medium tracking-[-0.025em] text-[#111]">
              I turn complicated things
              <br />
              into digital products.
            </p>
            <div className="my-6 h-px w-[min(100%,330px)] bg-[#e6e6e6]" />
            <p className="text-[clamp(14px,1.25vw,17px)] leading-[1.45] text-[#555]">
              What I do:
              <br />
              <span className="text-[#111]">Research, Design, Code, and Ship</span>
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1d2433] px-4 py-[6px] font-mono text-[11px] tracking-[0.04em] text-white uppercase">UX/UI Designer</span>
            <a
              href={SITE.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 flex h-[clamp(44px,4.4vw,52px)] w-[min(100%,330px)] cursor-pointer items-center justify-center rounded-full bg-[#1d2433] text-[clamp(15px,1.3vw,17px)] font-medium text-white transition-transform hover:scale-[1.02]"
            >
              See résumé
            </a>
            <a href={SITE.linkedIn} target="_blank" rel="noreferrer" className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] text-[#888] hover:text-[#111]">
              <span className="grid size-[14px] place-items-center rounded-full bg-[#888] text-[9px] font-bold text-white">i</span>
              Say hi on LinkedIn — or {SITE.email}
            </a>
            {/* การ์ดงานจริง (ชุดเดียวกับผนังโค้งของปก Fastwork) — เรียงเอียงลึกเล็ก ๆ กดกลับไปดูงาน */}
            <button type="button" onClick={() => navigate('/2026-final')} className="group mt-10 flex cursor-pointer items-end [perspective:900px]" aria-label="See selected work">
              {CARDS.map((src, i) => (
                <span
                  key={i}
                  className="-ml-6 block h-[clamp(84px,8vw,112px)] w-[clamp(68px,6.4vw,90px)] overflow-hidden rounded-[10px] bg-cover bg-left shadow-[0_10px_24px_rgba(20,30,60,0.18)] ring-2 ring-white transition-transform duration-300 first:ml-0 group-hover:translate-y-[-6px]"
                  style={{ backgroundImage: `url(${src})`, transform: `rotateY(${-24 + i * 6}deg) translateZ(${i * 10}px)`, transitionDelay: `${i * 40}ms` }}
                />
              ))}
              <span className="ml-4 pb-2 text-left text-[13px] leading-[1.3] text-[#555] group-hover:text-[#111]">
                Selected
                <br />
                work →
              </span>
            </button>
          </div>
      </div>
    </div>
  )
}
