import { useEffect, useRef } from 'react'
import { lenisBox } from '@/lib/lenisBox'
import modride from '@/assets/portfolios/modride-new-card.jpg'
import ekyc from '@/assets/portfolios/ekyc-new-card.jpg'
import { STORY_FONT, sling, worksPost, type WorkBeats } from './workMotion'

/**
 * ด่านหนังสติ๊กท้าย Selected Work → section ถัดไป (About me)
 *
 *   ขึ้น    ผนังการ์ดจางออก การ์ดงานสองใบลอยขึ้นมาตั้งเป็นง่ามหนังสติ๊ก (เอียงออกเป็นตัว V) + หนังยางขึงถึงเปล ตัวละครนั่งในเปล (SlingRider)
 *   ง้าง    ถึงด่านแล้วหน้าหยุดเลื่อน (Lenis หยุด) — แรงเลื่อน/ลากนิ้วกลายเป็นแรงง้างยางลง · ยิ่งง้างยิ่งหนืด · ปล่อย = ยางดีดกลับ
 *   พุ่ง    ง้างถึงขีด = ยางดีด ตัวละครพุ่งขึ้นทะลุจอ แล้วหน้าเลื่อนต่อไป section ถัดไปเอง
 *   ย้อน    ยังไม่ง้าง + เลื่อนขึ้น = ปล่อยด่าน เลื่อนกลับขึ้นไปดูงานได้ปกติ
 */
const SHOW = [2.45, 0.28] as const
/** ถึงด่าน (worksPost) — หยุดเลื่อนตรงนี้ */
const GATE = 2.74
/** ระยะเลื่อนต่อหนึ่งการง้างเต็ม (px ของ deltaY รวม) — หนืดขึ้นใกล้ขีด */
const PULL_PX = 1100
/** เวลาพุ่ง (วินาที) ก่อนหน้าเริ่มเลื่อนต่อ */
const LAUNCH_S = 0.75
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}

export function SlingGate({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const root = useRef<HTMLDivElement>(null)
  const postL = useRef<HTMLDivElement>(null)
  const postR = useRef<HTMLDivElement>(null)
  const band = useRef<SVGPathElement>(null)
  const bandBack = useRef<SVGPathElement>(null)
  const ring = useRef<SVGCircleElement>(null)
  const hint = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const st = { locked: false, armed: true, pull: 0, lastIn: 0, launchAt: -1, scrolled: false, touchY: 0 }
    const target = () => {
      const el = document.getElementById('what-i-do-windows') ?? document.getElementById('what-i-do')?.nextElementSibling
      return el ? el.getBoundingClientRect().top + window.scrollY : window.scrollY + window.innerHeight
    }
    const lock = () => {
      st.locked = true
      st.pull = 0
      lenisBox.l?.stop()
    }
    const unlock = () => {
      st.locked = false
      lenisBox.l?.start()
    }
    const feed = (dy: number) => {
      if (!st.locked || st.launchAt >= 0) return
      /* เลื่อนขึ้นตอนยังไม่ง้าง = ปล่อยด่าน กลับไปดูงาน */
      if (dy < 0 && st.pull < 0.02) {
        st.armed = false
        unlock()
        return
      }
      /* หนืดขึ้นใกล้ขีด (แบบ overscroll ของ iOS) */
      st.pull = clamp01(st.pull + (dy / PULL_PX) * (1 - st.pull * 0.65))
      st.lastIn = performance.now()
      if (st.pull >= 0.999) st.launchAt = performance.now()
    }
    const onWheel = (e: WheelEvent) => {
      if (!st.locked) return
      e.preventDefault()
      feed(e.deltaY)
    }
    const onTouchStart = (e: TouchEvent) => {
      st.touchY = e.touches[0]?.clientY ?? 0
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!st.locked) return
      e.preventDefault()
      const y = e.touches[0]?.clientY ?? st.touchY
      feed((st.touchY - y) * 2.2)
      st.touchY = y
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const f = frame.current
      const el = root.current
      if (!f || !el) return
      const post = f.on ? worksPost(f.b) : -9
      /* เลื่อนกลับขึ้นไปพ้นด่าน = ติดอาวุธใหม่ */
      if (post < GATE - 0.12) st.armed = true
      if (!st.locked && st.armed && st.launchAt < 0 && post >= GATE && f.on) lock()
      /* ไม่มีแรงเข้า = ยางดีดกลับ (สปริง) */
      if (st.locked && st.launchAt < 0 && now - st.lastIn > 140) st.pull = Math.max(0, st.pull - dt * (0.9 + st.pull * 1.6))
      /* พุ่ง */
      let launch = 0
      if (st.launchAt >= 0) {
        launch = clamp01((now - st.launchAt) / 1000 / LAUNCH_S)
        if (launch >= 1 && !st.scrolled) {
          st.scrolled = true
          st.armed = false
          unlock()
          lenisBox.l?.scrollTo(target(), { duration: 1.4 })
        }
      }
      if (st.scrolled && !st.locked && post > GATE + 0.3) {
        st.launchAt = -1
        st.scrolled = false
      }
      const vis = f.on ? smooth((post - SHOW[0]) / SHOW[1]) * (st.scrolled ? 1 - smooth((post - GATE) / 0.3) : 1) : 0
      el.style.visibility = vis > 0.002 ? 'visible' : 'hidden'
      el.style.opacity = vis.toFixed(3)
      const W = window.innerWidth
      const H = window.innerHeight
      /* ง่าม: เปลอยู่กลางจอค่อนล่าง · ปลายง่ามสองข้าง */
      const cx = W / 2
      const tipY = H * 0.36
      const tipDX = Math.min(W * 0.17, 250)
      const rise = (1 - vis) * H * 0.35
      const pull = st.launchAt >= 0 ? 0 : st.pull
      /* เปล: ง้างลงตามแรง · พุ่ง = ดีดขึ้นผ่านปลายง่ามแล้วสั่นกลับ */
      const snap = launch > 0 ? Math.exp(-launch * 6) * Math.cos(launch * 18) : 1
      const pouchY = tipY + 70 + (launch > 0 ? st.pull * H * 0.34 * snap : pull * H * 0.34) + rise
      sling.vis = vis
      sling.px = cx
      sling.py = pouchY
      sling.pull = pull
      sling.launch = launch
      const tilt = 12
      if (postL.current) postL.current.style.transform = `translate(${(cx - tipDX).toFixed(1)}px, ${(tipY + rise).toFixed(1)}px) translate(-50%, 0) rotate(${-tilt}deg)`
      if (postR.current) postR.current.style.transform = `translate(${(cx + tipDX).toFixed(1)}px, ${(tipY + rise).toFixed(1)}px) translate(-50%, 0) rotate(${tilt}deg)`
      /* ยาง: จากปลายง่ามทั้งสองถึงเปล (โค้งนิดตามแรงตึง) */
      const lx = cx - tipDX
      const rx = cx + tipDX
      const ty = tipY + rise + 8
      const sag = 18 * (1 - pull)
      const d = `M${lx.toFixed(1)} ${ty.toFixed(1)} Q${(cx - tipDX * 0.45).toFixed(1)} ${(pouchY - 10 + sag).toFixed(1)} ${(cx - 34).toFixed(1)} ${pouchY.toFixed(1)} L${(cx + 34).toFixed(1)} ${pouchY.toFixed(1)} Q${(cx + tipDX * 0.45).toFixed(1)} ${(pouchY - 10 + sag).toFixed(1)} ${rx.toFixed(1)} ${ty.toFixed(1)}`
      band.current?.setAttribute('d', d)
      bandBack.current?.setAttribute('d', d)
      band.current?.setAttribute('stroke-width', (9 - pull * 4).toFixed(2))
      /* วงบอกแรง + ข้อความ */
      if (ring.current) ring.current.style.strokeDashoffset = (125.6 * (1 - pull)).toFixed(1)
      if (hint.current) {
        hint.current.style.opacity = (st.locked && launch === 0 ? 1 : 0).toString()
        hint.current.style.transform = `translate(-50%, 0) translateY(${(pouchY + H * 0.16).toFixed(0)}px)`
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      if (st.locked) unlock()
    }
  }, [frame])

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[52] overflow-hidden" style={{ visibility: 'hidden', opacity: 0, fontFamily: STORY_FONT }} aria-hidden>
      {/* ยางเส้นหลัง (เงา) ใต้ง่าม · เส้นหน้าเหนือ */}
      <svg className="absolute inset-0 size-full">
        <path ref={bandBack} fill="none" stroke="rgba(20,40,90,0.25)" strokeWidth="12" strokeLinecap="round" transform="translate(0 6)" />
      </svg>
      {/* ง่ามสองข้าง = การ์ดงานจริงสองใบตั้งเอียงออก */}
      <div ref={postL} className="absolute top-0 left-0 h-[min(46vh,420px)] w-[min(15vw,200px)] origin-top overflow-hidden rounded-[16px] shadow-[0_20px_50px_rgba(10,30,90,0.35)]">
        <img src={modride} alt="" className="size-full object-cover" />
      </div>
      <div ref={postR} className="absolute top-0 left-0 h-[min(46vh,420px)] w-[min(15vw,200px)] origin-top overflow-hidden rounded-[16px] shadow-[0_20px_50px_rgba(10,30,90,0.35)]">
        <img src={ekyc} alt="" className="size-full object-cover" />
      </div>
      <svg className="absolute inset-0 size-full">
        <path ref={band} fill="none" stroke="#1d2433" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div ref={hint} className="absolute top-0 left-1/2 flex items-center gap-3 text-white transition-opacity duration-300" style={{ opacity: 0 }}>
        <svg width="46" height="46" viewBox="0 0 46 46" className="-rotate-90">
          <circle cx="23" cy="23" r="20" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <circle ref={ring} cx="23" cy="23" r="20" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset="125.6" />
        </svg>
        <span className="text-[clamp(16px,1.3vw,22px)] font-medium tracking-[-0.01em] [text-shadow:0_2px_12px_rgba(10,30,90,0.35)]">Pull to launch</span>
      </div>
    </div>
  )
}
