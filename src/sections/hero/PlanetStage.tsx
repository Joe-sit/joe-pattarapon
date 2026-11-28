import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Globe } from '@/newhero/Globe'
import { WORKS } from './WorksGallery'
import { PLANET_OUT, PLANET_SCROLL, STORY_FONT, devScreen, planetLive, smooth, worksPost, type WorkBeats } from './workMotion'

/**
 * Selected Work แบบ "โลกในมือถือ" — ต่อท้ายบท Code (POST_CODE = 'planet' ใน ./workMotion) ตาม wireframe ของ Joe
 *
 *   ผุด     ลูกโลกจิ๋ว (ชุดเดียวกับในพอร์ทัล hero — newhero/Globe) ดันออกจากจอเครื่อง (planetPhase.bulge)
 *   ลอย     โลกลอยไปมุมขวาล่าง ใหญ่ล้นขอบ รถวิ่งบนถนนรอบโลก (fly) — PlanetCar ในฉากของ ./BubbleTraveler
 *   การ์ด   เครื่องเลื่อนไปซ้าย ตั้งตรง ขยายเป็นการ์ดหน้าสุด (move — BubbleTraveler ขยับเครื่อง) จอเครื่อง = ปกผลงาน
 *           งานถัดไปสองชิ้นซ้อนอยู่หลังทางขวา เล็กลง จางลง (PlanetStage — DOM ตามกรอบจอเครื่อง devScreen)
 *   ไล่งาน  สกรอลล์แล้วกองเลื่อนเข้าหน้าทีละใบ ใบหน้าสุดเลื่อนออกซ้าย
 *   ออก     ย้อนกลับเข้าเครื่อง เครื่องกลับกลางจอ ต่อบท Ship
 * ผลงานจริงจาก WORKS (ไม่ใช่ภาพ mock)
 */
const CAR_ORANGE = '#f26a0a'
const CAR_WHITE = '#ffffff'
const INK = '#14141a'

/** ทิศจากศูนย์กลางโลกถึงจุดที่รถอยู่ (พิกัดฉาก · +z = ทางคนดู) — ซ้ายบนของโลกค่อนมาหน้า แบบ wireframe */
const CAR_DIR = new THREE.Vector3(-0.7, 0.56, 0.44).normalize()
/** แกนหมุนของโลก = ตั้งฉากกับทิศรถ → ถนน (เส้นศูนย์สูตร) ผ่านใต้รถพอดี */
const AXIS = new THREE.Vector3().crossVectors(CAR_DIR, new THREE.Vector3(0, 0, 1)).normalize()
/** ทิศวิ่งของรถ (แนวสัมผัสถนน) */
const AHEAD = new THREE.Vector3().crossVectors(AXIS, CAR_DIR).normalize()
const GLOBE_Q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), AXIS)
const CAR_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(AHEAD, CAR_DIR, new THREE.Vector3().crossVectors(AHEAD, CAR_DIR)))

/** กล่องสีแบน + เปลือกขอบดำ (ลายเส้นแบบภาพ ref ของรถ) */
function InkBox({ size, pos, color, rot = [0, 0, 0], geo, fill, line }: { size: [number, number, number]; pos: [number, number, number]; color: string; rot?: [number, number, number]; geo: THREE.BoxGeometry; fill: Record<string, THREE.MeshBasicMaterial>; line: THREE.MeshBasicMaterial }) {
  return (
    <group position={pos} rotation={rot}>
      <mesh geometry={geo} material={fill[color]} scale={size} />
      <mesh geometry={geo} material={line} scale={[size[0] + 0.07, size[1] + 0.07, size[2] + 0.07]} />
    </group>
  )
}

/**
 * ลูกโลก + รถ ในฉากของ ./BubbleTraveler (พิกัดฉาก px) — ที่วาง/รัศมีจาก planetLive (BubbleTraveler เขียนก่อนวาดทุกเฟรม)
 * โลกหมุนรอบแกนถนนเอง (Globe) + ตามสกรอลล์ — ถนนไหลใต้รถ รถจึงเหมือนวิ่ง
 */
export function PlanetCar() {
  const g = useRef<THREE.Group>(null)
  const roll = useRef<THREE.Group>(null)
  const car = useRef<THREE.Group>(null)
  const wheels = useRef<(THREE.Group | null)[]>([])
  const res = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
    const fill: Record<string, THREE.MeshBasicMaterial> = {
      [CAR_ORANGE]: new THREE.MeshBasicMaterial({ color: CAR_ORANGE, toneMapped: false }),
      [CAR_WHITE]: new THREE.MeshBasicMaterial({ color: CAR_WHITE, toneMapped: false }),
      [INK]: new THREE.MeshBasicMaterial({ color: INK, toneMapped: false }),
    }
    const line = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, toneMapped: false })
    return { box, cyl, fill, line }
  }, [])
  useEffect(
    () => () => {
      res.box.dispose()
      res.cyl.dispose()
      Object.values(res.fill).forEach((m) => m.dispose())
      res.line.dispose()
    },
    [res],
  )

  useFrame(() => {
    const gg = g.current
    if (!gg) return
    const L = planetLive
    gg.visible = L.bulge > 0.002 && L.r > 1
    if (!gg.visible) return
    gg.position.set(L.x, L.y, L.z)
    gg.scale.setScalar(L.r)
    /* หมุนตามสกรอลล์เพิ่มจากที่ Globe หมุนเอง — เลื่อนแล้วถนนไหลเร็วขึ้น */
    if (roll.current) roll.current.rotation.y = L.post * 2.2
    const cg = car.current
    if (cg) {
      const ck = smooth((L.fly - 0.7) / 0.3)
      cg.visible = ck > 0.01
      cg.scale.setScalar(0.3 * ck)
      wheels.current.forEach((w) => {
        if (w) w.rotation.y = L.post * 20
      })
    }
  })

  const fp = { geo: res.box, fill: res.fill, line: res.line }
  return (
    <group ref={g} visible={false}>
      {/* แกนโลก = แกนถนน ตั้งให้ถนนผ่านใต้รถ */}
      <group quaternion={GLOBE_Q}>
        <group ref={roll}>
          <Globe speed={0.25} />
        </group>
      </group>
      {/* รถบนถนน: ตั้งตามแนวตั้งฉากผิว หันตามทิศถนน (หน่วย = ความยาวรถ · +x = หน้ารถ · +y = ขึ้นจากผิว) */}
      <group position={CAR_DIR.clone().multiplyScalar(1.01)} quaternion={CAR_Q}>
        <group ref={car}>
          <InkBox {...fp} size={[1, 0.3, 0.48]} pos={[0, 0.2, 0]} color={CAR_ORANGE} />
          <InkBox {...fp} size={[0.56, 0.26, 0.44]} pos={[-0.06, 0.48, 0]} color={CAR_WHITE} />
          <InkBox {...fp} size={[0.12, 0.18, 0.4]} pos={[0.24, 0.48, 0]} color={INK} rot={[0, 0, -0.5]} />
          {[
            [0.3, 0.06, 0.25],
            [-0.3, 0.06, 0.25],
            [0.3, 0.06, -0.25],
            [-0.3, 0.06, -0.25],
          ].map((p, i) => (
            <group
              key={i}
              position={p as [number, number, number]}
              ref={(el) => {
                wheels.current[i] = el
              }}
            >
              <mesh geometry={res.cyl} material={res.fill[INK]} rotation={[Math.PI / 2, 0, 0]} scale={[0.2, 0.08, 0.2]} />
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

/**
 * ช่องของกอง (wireframe): 0 = การ์ดหน้า (= จอเครื่อง) · 1, 2 = ใบหลังทางขวา เล็กลง จางลง · −1 = ออกไปซ้าย · 3 = ยังไม่โผล่
 * dx = ขอบขวาเลยการ์ดหน้า (× กว้างการ์ดหน้า) · dy = ขอบบนต่ำลง (× สูง) · s = ขนาด · o = ความทึบ
 */
const SLOTS: Record<number, { dx: number; dy: number; s: number; o: number }> = {
  [-1]: { dx: -0.85, dy: 0.04, s: 0.92, o: 0 },
  0: { dx: 0, dy: 0, s: 1, o: 1 },
  1: { dx: 0.52, dy: 0.05, s: 0.81, o: 0.92 },
  2: { dx: 0.94, dy: 0.12, s: 0.61, o: 0.55 },
  3: { dx: 1.2, dy: 0.18, s: 0.45, o: 0 },
}

export function PlanetStage({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const root = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLElement | null)[]>([])
  const info = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLSpanElement>(null)
  const sub = useRef<HTMLSpanElement>(null)
  const count = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    let shown = false
    let sm = -9
    const N = WORKS.length
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = root.current
      const f = frame.current
      if (!el || !f) return
      const raw = worksPost(f.b)
      sm = Math.abs(raw - sm) > 0.4 ? raw : sm + (raw - sm) * 0.14
      const out = smooth((sm - PLANET_OUT[0]) / PLANET_OUT[1])
      /* การ์ดโผล่ตอนเครื่องเข้าที่เป็นการ์ดหน้าแล้ว (move ≈ 1) — ปกจางเข้าในจอเครื่อง */
      const kin = smooth((planetLive.move - 0.75) / 0.25)
      const on = f.on && kin > 0.002 && devScreen.ok
      if (!on) {
        if (shown) {
          el.style.visibility = 'hidden'
          shown = false
        }
        return
      }
      if (!shown) {
        el.style.visibility = 'visible'
        shown = true
      }
      /* ใบหลังจางออกก่อนตอนออก (เครื่องกำลังกลับกลางจอ) */
      const backK = kin * (1 - smooth(out / 0.4))
      const scroll = Math.min(1, Math.max(0, (sm - PLANET_SCROLL[0]) / (PLANET_SCROLL[1] - PLANET_SCROLL[0])))
      const at = scroll * (N - 1)
      /* การ์ดหน้า = กรอบจอเครื่อง (ตามเครื่องทุกเฟรม) */
      const W0 = devScreen.hw * 2
      const H0 = devScreen.hh * 2
      const L0 = devScreen.cx - devScreen.hw
      const T0 = devScreen.cy - devScreen.hh
      cards.current.forEach((c, j) => {
        if (!c) return
        const p = Math.max(-1, Math.min(3, j - at))
        const a = Math.floor(p)
        const b = Math.min(3, a + 1)
        const t = p - a
        const A = SLOTS[a]
        const B = SLOTS[b]
        const s = A.s + (B.s - A.s) * t
        const dx = A.dx + (B.dx - A.dx) * t
        const dy = A.dy + (B.dy - A.dy) * t
        let o = A.o + (B.o - A.o) * t
        /* ใบหน้า (อยู่ในจอเครื่อง) ตามจังหวะปกเข้า · ใบหลังตาม backK */
        o *= p < 0.5 ? kin : backK
        const w = W0 * s
        const h = H0 * s
        const left = L0 + W0 * (1 + dx) - w
        const top = T0 + H0 * dy
        c.style.visibility = o > 0.003 ? 'visible' : 'hidden'
        c.style.opacity = o.toFixed(3)
        c.style.width = `${w.toFixed(1)}px`
        c.style.height = `${h.toFixed(1)}px`
        c.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`
        c.style.zIndex = String(10 - Math.round(p))
        c.style.borderRadius = `${(devScreen.r * s).toFixed(1)}px`
      })
      /* ชื่องานใต้การ์ดหน้า */
      const cur = WORKS[Math.min(N - 1, Math.round(at))]
      if (info.current) {
        info.current.style.opacity = (kin * (1 - smooth(out / 0.3))).toFixed(3)
        info.current.style.transform = `translate3d(${L0.toFixed(1)}px, ${(T0 + H0 + 14).toFixed(1)}px, 0)`
      }
      if (title.current && title.current.textContent !== cur.name) title.current.textContent = cur.name
      const subTxt = `${cur.category} · ${cur.sub}`
      if (sub.current && sub.current.textContent !== subTxt) sub.current.textContent = subTxt
      if (count.current) count.current.textContent = `${String(Math.min(N, Math.round(at) + 1)).padStart(2, '0')} / ${String(N).padStart(2, '0')}`
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame])

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[53]" style={{ visibility: 'hidden' }} aria-label="Selected Work">
      {WORKS.map((w, i) => (
        <figure
          key={w.name}
          ref={(el) => {
            cards.current[i] = el
          }}
          className="absolute top-0 left-0 overflow-hidden border border-white/60 bg-white shadow-[0_18px_40px_rgba(10,20,60,0.25)]"
          style={{ visibility: 'hidden' }}
        >
          <img src={w.img} alt={w.name} className="size-full object-cover" loading="lazy" />
        </figure>
      ))}
      <div ref={info} className="absolute top-0 left-0 flex flex-col gap-1 text-white" style={{ opacity: 0, fontFamily: STORY_FONT }}>
        <span ref={count} className="text-[clamp(11px,0.85vw,13px)] font-semibold tracking-[0.12em] text-white/80" />
        <span ref={title} className="text-[clamp(16px,1.5vw,24px)] font-bold tracking-[-0.01em]" />
        <span ref={sub} className="text-[clamp(11px,0.9vw,14px)] opacity-80" />
      </div>
    </div>
  )
}
