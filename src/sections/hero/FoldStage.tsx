import { useEffect, useRef } from 'react'
import { WORKS } from './WorksGallery'
import { DEVICE, STORY_FONT, camDist, devScreen, outBack, smooth, worksPost, type WorkBeats } from './workMotion'

/**
 * Selected Work แบบ "จอพับ (Fold) คลี่ไม่หยุด" — ต่อท้ายบท Code (POST_CODE = 'fold' ใน ./workMotion)
 *
 *   เข้า     จบ Code (ฟ้าเปิดแล้ว) เครื่องหดเป็นขนาดแผง ตั้งตรงกลางจอ
 *   คลี่     ด้านหลังเครื่องมีแผงจอพับซ้อนอยู่แบบหีบเพลง — เลื่อนทีละครั้ง แผงถัดไปหมุนออกจากบานพับ (เลยนิดแล้วล็อก "คลิก")
 *            แผงที่ยังพับติดหลังแผงที่กำลังคลี่ไปด้วยกัน · คลี่แล้วเป็นแถบซิกแซก (หีบเพลงกางไม่สุด — มีมิติ รับแสงคนละด้าน)
 *            กล้องตามแผงล่าสุดให้อยู่กลางจอ · แต่ละแผง = หน้าจอของงานหนึ่งชิ้น
 *   พับกลับ  ท้ายบทแผงพับกลับจากปลายแถบไล่มาหาเครื่องทีละบาน ต่อกันรัว ๆ แถบไหลกลับ จบเป็นเครื่องเดียว → ต่อบท Ship
 *
 * แผง 0 = ตัวเครื่องจริง (แก้ว 3D — ./BubbleTraveler หมุน/เลื่อนตาม foldDev ชุดเดียวกัน) · แผงอื่นเป็น DOM 3D
 * เพอร์สเปกทีฟของเครื่อง (w = 1 − z / camDist) = CSS perspective: camDist → แผง DOM ต่อบานพับกับขอบเครื่องได้ตรง
 * DOM อยู่ชั้นใต้ของบนจอเครื่อง (WorkStory) — วิดเจ็ตบนจอเครื่องทับพื้นจอแผง 0 พอดี
 */
const PICKS = WORKS.slice(0, 8)
const N = PICKS.length
/** แผงสูงเท่านี้ของความสูงจอ */
export const FOLD_H = 0.56
/** มุมซิกแซกของแผงที่คลี่แล้ว (เรเดียน) — แผงคู่/คี่หันคนละด้าน */
export const FOLD_R = 0.58
/** ก้มมองนิด (เรเดียน — แบบ CSS rotateX: บนเอนหนี) เห็นสันบนของแถบเป็นฟันปลา */
export const FOLD_TILT = 0.11
/** พับสนิท = เกือบครึ่งรอบ (ไม่เต็ม — แผงที่พับไม่ทับระนาบเดียวกันพอดี) */
const SHUT = Math.PI * 0.995

/** จังหวะ (worksPost) */
const IN = [0.25, 0.3] as const
const U0 = 0.6
const STEP = 0.18
const UL = 0.13
const FB0 = U0 + N * STEP + 0.08
const FB_STEP = 0.035
const FL = 0.12
const OUT = [FB0 + (N - 1) * FB_STEP + FL + 0.02, 0.25] as const
const at01 = (x: number, r: readonly [number, number]) => Math.min(1, Math.max(0, (x - r[0]) / r[1]))

export function foldPhase(b: { code: number; works: number }) {
  const post = worksPost(b)
  const k = smooth(at01(post, IN)) * (1 - smooth(at01(post, OUT)))
  /* u[i] = ความคืบหน้ามุมบานพับของแผง i (เลยเป้านิดตอนล็อก) · f = จำนวนแผงที่คลี่แล้ว (นุ่ม ไม่เลย) — กล้องตาม f */
  const u = [1]
  let f = 0
  let s1 = 0
  for (let i = 1; i <= N; i++) {
    const t = at01(post, [U0 + (i - 1) * STEP, UL])
    const back = smooth(at01(post, [FB0 + (N - i) * FB_STEP, FL]))
    u.push(outBack(t, 1.3) * (1 - back))
    const s = smooth(t) * (1 - back)
    if (i === 1) s1 = s
    f += s
  }
  /* เครื่องเอียงเข้าซิกแซกตอนแผงแรกคลี่ — เหลือเครื่องเดียวก็ตั้งตรง */
  return { post, k, u, f, yaw0: FOLD_R * s1 }
}

/** ท่าของตัวเครื่อง (BubbleTraveler อ่าน): k 0→1 = ท่าเดิม→แผง · t = เลื่อนซ้ายกี่เท่าความกว้างแผง · yaw */
export function foldDev(b: { code: number; works: number }) {
  const ph = foldPhase(b)
  return { k: ph.k, t: ph.f * Math.cos(FOLD_R), yaw: ph.yaw0 }
}

type Seg = { x: number; z: number; yaw: number }
/** มุมบานพับของแผง i เทียบแผงก่อนหน้า: คี่พับไปหลังทางหนึ่ง คู่พับกลับอีกทาง (หีบเพลง) */
const rel = (i: number, u: number) => (i % 2 ? 1 : -1) * (SHUT + (-2 * FOLD_R - SHUT) * u)
/** โซ่บานพับ: กลางแผง (x, z) เทียบกลางเครื่อง + มุม — บานพับของแผง i อยู่ที่ปลายแผง i−1 */
function chain(ph: ReturnType<typeof foldPhase>, w: number, out: Seg[]) {
  let yaw = ph.yaw0
  let hx = (w / 2) * Math.cos(yaw)
  let hz = -(w / 2) * Math.sin(yaw)
  for (let i = 1; i <= N; i++) {
    yaw += rel(i, ph.u[i])
    const dx = Math.cos(yaw)
    const dz = -Math.sin(yaw)
    const s = out[i - 1]
    s.x = hx + (dx * w) / 2
    s.z = hz + (dz * w) / 2
    s.yaw = yaw
    hx += dx * w
    hz += dz * w
  }
}

/** แสงมาจากซ้ายหน้า — แผงที่หันหนีแสงมืดลงนิด */
const LX = -0.41
const LZ = 0.91
const shadeOf = (yaw: number, back: boolean) => {
  const d = (back ? -1 : 1) * (Math.sin(yaw) * LX + Math.cos(yaw) * LZ)
  return Math.min(0.5, Math.max(0, (1 - d) * 0.38))
}

export function FoldStage({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const root = useRef<HTMLDivElement>(null)
  const dev = useRef<HTMLDivElement>(null)
  const panels = useRef<(HTMLDivElement | null)[]>([])
  const fronts = useRef<(HTMLDivElement | null)[]>([])
  const backs = useRef<(HTMLDivElement | null)[]>([])
  const glints = useRef<(HTMLDivElement | null)[]>([])
  const caption = useRef<HTMLDivElement>(null)
  const capName = useRef<HTMLDivElement>(null)
  const capSub = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let shown = -1
    const segs: Seg[] = PICKS.map(() => ({ x: 0, z: 0, yaw: 0 }))
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const rt = root.current
      const f = frame.current
      if (!rt || !f) return
      const ph = foldPhase(f.b)
      const vis = f.on && ph.k > 0.001 && devScreen.ok
      rt.style.display = vis ? '' : 'none'
      if (!vis) return
      const W = window.innerWidth
      const H = window.innerHeight
      rt.style.perspective = `${camDist(H).toFixed(1)}px`
      const h = H * FOLD_H
      const w = (h * DEVICE.hw) / DEVICE.hh
      const r = (DEVICE.r * h) / (DEVICE.hh * 2)
      /* ยึดกับเครื่องจริง: กลางเครื่องบนจอ (z = 0 ตอนเป็นแผงแล้ว) */
      const ox = devScreen.cx - W / 2
      const oy = devScreen.cy - H / 2
      /* แผง 0 = พื้นจอของเครื่อง (เครื่องเป็นแก้วใส — แผงที่พับอยู่ข้างหลังต้องไม่ทะลุ) · ช่วงเข้า/ออกขนาดตามเครื่อง */
      const d0 = dev.current
      if (d0) {
        d0.style.width = `${w.toFixed(1)}px`
        d0.style.height = `${h.toFixed(1)}px`
        d0.style.borderRadius = `${r.toFixed(1)}px`
        d0.style.transform = `translate3d(${ox.toFixed(1)}px, ${oy.toFixed(1)}px, 0) rotateX(${(FOLD_TILT * ph.k).toFixed(4)}rad) rotateY(${ph.yaw0.toFixed(4)}rad) scale(${(devScreen.hh / (h / 2)).toFixed(4)})`
        d0.style.opacity = smooth(ph.k * 2.2).toFixed(3)
      }
      chain(ph, w, segs)
      segs.forEach((s, n) => {
        const el = panels.current[n]
        if (!el) return
        const on = ph.u[n + 1] > 0.002 && ph.k > 0.98
        el.style.visibility = on ? 'visible' : 'hidden'
        if (!on) return
        el.style.width = `${w.toFixed(1)}px`
        el.style.height = `${h.toFixed(1)}px`
        el.style.borderRadius = `${r.toFixed(1)}px`
        el.style.transform = `translate3d(${ox.toFixed(1)}px, ${oy.toFixed(1)}px, 0) rotateX(${FOLD_TILT}rad) translate3d(${s.x.toFixed(1)}px, 0, ${s.z.toFixed(1)}px) rotateY(${s.yaw.toFixed(4)}rad)`
        /* แสงวาบบนจอไหลตามมุมแผง — หมุนออกจากบานพับแล้วเห็นแสงพาดผ่าน */
        const gl = glints.current[n]
        if (gl) gl.style.backgroundPosition = `${(50 - s.yaw * 70).toFixed(1)}% 0`
        const fs = fronts.current[n]
        if (fs) fs.style.opacity = shadeOf(s.yaw, false).toFixed(3)
        const bs = backs.current[n]
        if (bs) bs.style.opacity = shadeOf(s.yaw, true).toFixed(3)
      })
      /* คำบรรยายใต้แผงที่อยู่กลางจอ */
      const fi = Math.round(ph.f)
      const near = fi >= 1 ? Math.max(0, 1 - Math.abs(ph.f - fi) * 2.4) * ph.k : 0
      if (caption.current) {
        caption.current.style.opacity = near.toFixed(3)
        caption.current.style.transform = `translate3d(-50%, ${(H / 2 + oy + h / 2 + 30 + (1 - near) * 10).toFixed(1)}px, 0)`
      }
      if (near > 0 && fi !== shown) {
        shown = fi
        if (capName.current) capName.current.textContent = PICKS[fi - 1].name
        if (capSub.current) capSub.current.textContent = `${PICKS[fi - 1].category} · ${PICKS[fi - 1].sub}`
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame])

  const face = 'absolute inset-0 overflow-hidden [backface-visibility:hidden]'
  return (
    <div ref={root} className="pointer-events-none absolute inset-0 isolate" style={{ display: 'none', fontFamily: STORY_FONT, perspectiveOrigin: '50% 50%' }} aria-label="Selected Work">
      <div className="absolute inset-0 [transform-style:preserve-3d]">
        <div ref={dev} className="absolute top-1/2 left-1/2 bg-gradient-to-b from-[#3d7bf0] to-[#9cc0ff]" style={{ translate: '-50% -50%', opacity: 0 }} />
        {PICKS.map((w, i) => (
          <div
            key={w.name}
            ref={(n) => {
              panels.current[i] = n
            }}
            className="@container absolute top-1/2 left-1/2 [transform-style:preserve-3d] will-change-transform"
            style={{ translate: '-50% -50%', visibility: 'hidden' }}
          >
            {/* หน้าจอของแผง = หน้า case study ย่อ: หมวด · ชื่องาน · ปก (ขนาดตัวอักษรตามความกว้างแผง — cqw) */}
            <div className={`${face} flex flex-col bg-gradient-to-b from-white to-[#eef3ff] p-[6cqw] ring-1 ring-white/80`} style={{ borderRadius: 'inherit' }}>
              <span className="self-start rounded-full bg-[#e3ecff] px-[3.5cqw] py-[1.2cqw] text-[4.2cqw] font-semibold text-[#2a6be0]">{w.category}</span>
              <div className="mt-[3cqw] line-clamp-3 text-[8.4cqw] leading-[1.12] font-bold text-[#0f1b3d]">{w.name}</div>
              {/* ปกแนวนอนในช่องแนวตั้ง: วางเต็มกว้างไม่ตัด บนพื้นเบลอจากภาพเดียวกัน */}
              <div className="relative mt-[5cqw] min-h-0 w-full flex-1 overflow-hidden rounded-[5cqw] shadow-[0_6px_20px_rgba(15,27,61,0.14)]">
                <img src={w.img} alt="" className="absolute inset-0 size-full scale-150 object-cover blur-[14px] saturate-150" draggable={false} />
                <img src={w.img} alt={w.name} className="absolute inset-0 size-full object-contain" draggable={false} />
              </div>
              <div
                ref={(n) => {
                  fronts.current[i] = n
                }}
                className="absolute inset-0 bg-[#0b1430]"
                style={{ opacity: 0 }}
              />
              <div
                ref={(n) => {
                  glints.current[i] = n
                }}
                className="absolute inset-0 bg-[linear-gradient(105deg,transparent_38%,rgba(255,255,255,0.5)_48%,transparent_58%)] bg-[length:300%_100%] mix-blend-screen"
              />
            </div>
            {/* หลังแผง (เห็นตอนหมุนออกจากบานพับ) */}
            <div className={`${face} bg-gradient-to-br from-[#e9eefc] to-[#b9c8ef] ring-1 ring-white/70`} style={{ borderRadius: 'inherit', transform: 'rotateY(180deg)' }}>
              <div
                ref={(n) => {
                  backs.current[i] = n
                }}
                className="absolute inset-0 bg-[#0b1430]"
                style={{ opacity: 0 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div ref={caption} className="absolute top-0 left-1/2 text-center" style={{ opacity: 0 }}>
        <div ref={capName} className="text-[clamp(18px,1.6vw,26px)] leading-tight font-bold text-white drop-shadow-[0_2px_10px_rgba(10,20,60,0.45)]" />
        <div ref={capSub} className="mt-1 text-[13px] text-white/90 drop-shadow-[0_1px_6px_rgba(10,20,60,0.45)]" />
      </div>
    </div>
  )
}
