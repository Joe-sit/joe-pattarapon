import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { DESK_GEO, DeskWorld } from '@/pages/joeDesk/DeskScene'
import { WORKS } from './WorksGallery'
import { STORY_FONT, smooth, worksPost, type WorkBeats } from './workMotion'

/**
 * Selected Work แบบ "ถอยกล้องเห็นโต๊ะ Joe" — ต่อท้ายบท Code (POST_CODE = 'desk' ใน ./workMotion)
 *
 *   ส่งไม้  ปลายบท Code ฉากมืดม่วงกลายเป็นภาพบนจอมอนิเตอร์บนโต๊ะ Joe (ฉาก /joe-desk — DeskWorld)
 *           กล้องเริ่มชิดจอจนจอเต็มเฟรม ภาพบนจอวาดให้หน้าตาเหมือนฉาก Code (มืด แสงม่วงมุมล่าง เครื่องกลางจอ)
 *   ถอย     ช็อตเดียวต่อเนื่อง: ถอยออกจากจอ ผ่านไหล่ Joe ที่นั่งเก้าอี้ แล้วยกขึ้นเป็นมุมไอโซเห็นทั้งโต๊ะ
 *           (มุมกล้องแคบลงตามระยะ — ปลายทางเหมือนภาพไอโซของ /joe-desk)
 *   บอร์ด   แพนไปบอร์ดหมุดบนผนังซ้ายของตู้ ปกงานจริงปักหมุดเรียงสองแถว · เลื่อนต่อ = ไล่ดูทีละใบ ชื่องานขึ้นมุมซ้ายล่าง
 *   ออก     กลับมุมไอโซ แล้วพุ่งเข้าจอ — ตอนนี้จอเป็นภาพฟ้า (เครื่องลอยกลางฟ้า) เต็มเฟรมแล้วส่งไม้ให้ฉากฟ้าจริงของบท Ship
 *
 * ทั้งหมดตามระยะเลื่อน (worksPost) — เลื่อนกลับก็ถอยกลับ
 */
const PICKS = WORKS.slice(0, 8)
const CARD_T = 0.14
const C0 = 0.86

/** จังหวะ (worksPost) [เริ่ม, ยาว] */
const T = {
  in: [0.12, 0.14],
  pull: [0.26, 0.32],
  board: [0.64, 0.2],
  back: [C0 + PICKS.length * CARD_T, 0.16],
  dive: [C0 + PICKS.length * CARD_T + 0.16, 0.2],
  out: [C0 + PICKS.length * CARD_T + 0.36, 0.1],
} as const
const at01 = (x: number, r: readonly [number, number]) => Math.min(1, Math.max(0, (x - r[0]) / r[1]))

export function deskPhase(b: { code: number; works: number }) {
  const post = worksPost(b)
  const inK = smooth(at01(post, T.in))
  const outK = smooth(at01(post, T.out))
  return {
    post,
    /** ฉากโต๊ะทับฉากสด (0 → 1 → 0) */
    show: inK * (1 - outK),
    /** ทึบเต็มแล้ว (ฉากสดข้างใต้ซ่อนได้) */
    opaque: inK > 0.999 && outK < 0.001,
    pull: at01(post, T.pull),
    board: smooth(at01(post, T.board)),
    /** ใบที่กำลังดู (0 → PICKS.length) */
    card: (post - C0) / CARD_T,
    back: smooth(at01(post, T.back)),
    dive: at01(post, T.dive),
    /** ฉากฟ้าจริงเปิดใต้ฉากโต๊ะ (ก่อนฉากโต๊ะจางออก) */
    sky: post >= T.out[0] - 0.02,
    end: T.out[0] + T.out[1],
  }
}

const V = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2])
/** ทิศกล้องไอโซของ /joe-desk (ก้ม 41.8° มุมราบ 45°) */
const ISO_DIR = new THREE.Vector3(Math.sqrt(1 - 4 / 9) / Math.SQRT2, 2 / 3, Math.sqrt(1 - 4 / 9) / Math.SQRT2)

/* ── ตำแหน่งกล้อง ── */
const S = V(DESK_GEO.screen.c)
/** ชิดจอ: จอเต็มเฟรมที่ fov 40 */
const K0 = S.clone().add(new THREE.Vector3(-330, 0, 0))
/** ถอยออกเฉียงขึ้นด้านข้างตัว Joe (ไม่ลอยข้ามหัว — หัวไม่บังกลางเฟรม) เห็น Joe นั่งหน้าจอทั้งตัว */
const K1 = S.clone().add(new THREE.Vector3(-760, 400, 620))
/** บอร์ดผลงาน: บนผนังหลังซ้ายของตู้ */
const BOARD = { w: 960, h: 560, c: new THREE.Vector3(DESK_GEO.cabX0 - 520, 380, DESK_GEO.wallZ + 2) }
/** มุมไอโซกว้าง (เห็นทั้งโต๊ะกับบอร์ด) */
const ISO_T = new THREE.Vector3((BOARD.c.x + 640) / 2, 190, (BOARD.c.z + 40) / 2)
const ISO_FOV = 16
const K2 = ISO_T.clone().addScaledVector(ISO_DIR, 760 / Math.tan(((ISO_FOV / 2) * Math.PI) / 180))

const COLS = 4
const CARD = { w: 196, h: 140, gx: 228, gy: 210 }
const cardPos = (i: number) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  return new THREE.Vector3(BOARD.c.x + (col - (COLS - 1) / 2) * CARD.gx, BOARD.c.y + 50 - (row - 0.5) * CARD.gy - 30, BOARD.c.z + 4)
}
const tilt = (i: number) => (((i * 37) % 7) - 3) * 0.025

/** ภาพบนจอมอนิเตอร์: ฉาก Code (มืด แสงม่วงมุมล่าง เครื่องกลางจอ) ↔ ฉากฟ้า (เครื่องลอยกลางฟ้า) */
function useScreen() {
  return useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 832
    cv.height = 606
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    let last = -1
    const draw = (sky: number) => {
      const q = Math.round(sky * 40) / 40
      if (q === last) return
      last = q
      const g = cv.getContext('2d')!
      const W = cv.width
      const H = cv.height
      g.globalAlpha = 1
      g.fillStyle = '#000'
      g.fillRect(0, 0, W, H)
      const glow = (x: number, y: number, r: number, c0: string, c1: string) => {
        const gr = g.createRadialGradient(x, y, 0, x, y, r)
        gr.addColorStop(0, c0)
        gr.addColorStop(0.45, c1)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = gr
        g.fillRect(0, 0, W, H)
      }
      glow(W * 0.06, H * 1.0, H * 0.75, 'rgba(200,160,255,0.85)', 'rgba(110,60,240,0.55)')
      glow(W * 0.96, H * 1.04, H * 0.8, 'rgba(255,236,255,0.9)', 'rgba(226,150,240,0.6)')
      g.fillStyle = 'rgba(214,190,255,0.35)'
      for (let y = 8; y < H; y += 14) for (let x = 8; x < W; x += 14) if (Math.sin(x * 0.07 + y * 0.11) * Math.cos(y * 0.05 - x * 0.03) > 0.55 && (y > H * 0.7 || y < H * 0.18)) g.fillRect(x, y, 2, 2)
      /* ฟ้า: จางทับ */
      if (q > 0) {
        g.globalAlpha = q
        const sk = g.createLinearGradient(0, 0, 0, H)
        sk.addColorStop(0, '#2c68d4')
        sk.addColorStop(0.6, '#6aa6ee')
        sk.addColorStop(1, '#bfe0fa')
        g.fillStyle = sk
        g.fillRect(0, 0, W, H)
        g.fillStyle = '#ffffff'
        for (const [cx, cy, r] of [
          [0.1, 0.9, 0.16],
          [0.22, 0.96, 0.12],
          [0.86, 0.92, 0.18],
          [0.74, 0.98, 0.11],
        ])
          {
            g.beginPath()
            g.arc(W * cx, H * cy, H * r, 0, Math.PI * 2)
            g.fill()
          }
        g.globalAlpha = 1
      }
      /* เครื่องกลางจอ: กระจกมนกับการ์ดสามใบ (ฟ้า เขียวมะนาว ส้มแซลมอน) */
      /* ขนาดเท่าเครื่องจริงบนจอตอนส่งไม้ (ราว 0.73 ของความสูงที่เห็น — จอล้นเฟรมนิด) */
      const dw = H * 0.27
      const dh = H * 0.56
      const dx = W / 2 - dw / 2
      const dy = H * 0.5 - dh / 2
      g.fillStyle = 'rgba(255,255,255,0.08)'
      g.strokeStyle = 'rgba(255,255,255,0.35)'
      g.lineWidth = 3
      g.beginPath()
      g.roundRect(dx, dy, dw, dh, dw * 0.18)
      g.fill()
      g.stroke()
      const card = (y: number, h: number, c: string) => {
        g.fillStyle = c
        g.beginPath()
        g.roundRect(dx + dw * 0.12, dy + dh * y, dw * 0.76, dh * h, dw * 0.08)
        g.fill()
      }
      card(0.08, 0.16, '#4f86f7')
      card(0.3, 0.27, '#d9f28b')
      card(0.62, 0.3, '#ff9a7a')
      tex.needsUpdate = true
    }
    return { tex, draw }
  }, [])
}

/** บอร์ดหมุด: กรอบไม้ พื้นไม้ก๊อก · ปกงานจริงในกรอบขาว หมุดสี · ป้ายหัว "Selected Work" */
function Board() {
  const tex = useTexture(PICKS.map((w) => w.img))
  const res = useMemo(() => {
    const mats = tex.map((t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      const img = t.image as { width: number; height: number }
      const a = img.width / img.height
      const b = CARD.w / CARD.h
      if (a > b) {
        t.repeat.set(b / a, 1)
        t.offset.set((1 - b / a) / 2, 0)
      } else {
        t.repeat.set(1, a / b)
        t.offset.set(0, 1 - a / b)
      }
      return new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
    })
    const lab = document.createElement('canvas')
    lab.width = 512
    lab.height = 128
    const g = lab.getContext('2d')!
    g.fillStyle = '#fffaf0'
    g.fillRect(0, 0, 512, 128)
    g.fillStyle = '#292a2e'
    g.font = `700 64px ${STORY_FONT}`
    g.textBaseline = 'middle'
    g.fillText('Selected Work', 28, 66)
    const labTex = new THREE.CanvasTexture(lab)
    labTex.colorSpace = THREE.SRGBColorSpace
    return { mats, labTex, plane: new THREE.PlaneGeometry(1, 1), pin: new THREE.SphereGeometry(1, 16, 12) }
  }, [tex])
  useEffect(
    () => () => {
      res.mats.forEach((m) => m.dispose())
      res.labTex.dispose()
      res.plane.dispose()
      res.pin.dispose()
    },
    [res],
  )
  const pins = ['#e5484d', '#1868db', '#ffb140', '#38b26b']
  return (
    <group>
      {/* กรอบไม้ + พื้นไม้ก๊อก */}
      <mesh position={[BOARD.c.x, BOARD.c.y, BOARD.c.z - 8]} scale={[BOARD.w + 36, BOARD.h + 36, 12]}>
        <boxGeometry />
        <meshLambertMaterial color="#c98f4e" />
      </mesh>
      <mesh geometry={res.plane} position={[BOARD.c.x, BOARD.c.y, BOARD.c.z - 1.5]} scale={[BOARD.w, BOARD.h, 1]}>
        <meshLambertMaterial color="#e2b783" />
      </mesh>
      {/* ป้ายหัว */}
      <group position={[BOARD.c.x - BOARD.w / 2 + 170, BOARD.c.y + BOARD.h / 2 - 50, BOARD.c.z + 2]} rotation={[0, 0, 0.03]}>
        <mesh geometry={res.plane} scale={[260, 65, 1]}>
          <meshBasicMaterial map={res.labTex} toneMapped={false} />
        </mesh>
        <mesh geometry={res.pin} position={[0, 26, 6]} scale={7}>
          <meshLambertMaterial color="#e5484d" />
        </mesh>
      </group>
      {PICKS.map((w, i) => {
        const p = cardPos(i)
        return (
          <group key={w.name} position={p} rotation={[0, 0, tilt(i)]}>
            <mesh geometry={res.plane} position={[2, -3, -0.5]} scale={[CARD.w + 18, CARD.h + 18, 1]}>
              <meshBasicMaterial color="#000" transparent opacity={0.12} />
            </mesh>
            <mesh geometry={res.plane} scale={[CARD.w + 14, CARD.h + 14, 1]}>
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh geometry={res.plane} material={res.mats[i]} position={[0, 0, 0.5]} scale={[CARD.w, CARD.h, 1]} />
            <mesh geometry={res.pin} position={[0, CARD.h / 2 - 2, 7]} scale={7}>
              <meshLambertMaterial color={pins[i % pins.length]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

const CR = new THREE.CatmullRomCurve3([K0, K0.clone().lerp(K1, 0.55).add(new THREE.Vector3(0, 30, 60)), K1, K1.clone().lerp(K2, 0.25), K2], false, 'catmullrom', 0.5)
const TMP_P = new THREE.Vector3()
const TMP_T = new THREE.Vector3()
const TMP_Q = new THREE.Vector3()
const CAM_IN = new THREE.Vector3()

/** กล้องตามระยะเลื่อน: ชิดจอ → ถอยผ่านไหล่ → ไอโซ → บอร์ด → ทีละใบ → ไอโซ → พุ่งเข้าจอ */
function Rig({ state, screen }: { state: React.RefObject<ReturnType<typeof deskPhase> | null>; screen: ReturnType<typeof useScreen> }) {
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera
  useFrame(() => {
    const ph = state.current
    if (!ph) return
    let fov = 40
    /* ถอย: ตามเส้นโค้งผ่านไหล่ · สายตาจากกลางจอ → กลางฉากไอโซ · มุมกล้องแคบลงตามระยะ */
    const u = ph.pull * ph.pull * (3 - 2 * ph.pull)
    CR.getPoint(u, TMP_P)
    TMP_T.copy(S).lerp(ISO_T, smooth((u - 0.35) / 0.65))
    fov = 40 + (ISO_FOV - 40) * smooth((u - 0.45) / 0.55)
    /* ไปบอร์ด → ทีละใบ */
    if (ph.board > 0) {
      const cf = Math.max(0, Math.min(PICKS.length - 1, ph.card))
      const i0 = Math.floor(cf)
      const i1 = Math.min(PICKS.length - 1, i0 + 1)
      const f = smooth(Math.min(1, Math.max(0, (cf - i0 - 0.55) / 0.45)))
      const focus = ph.card < 0 ? 0 : 1
      const cc = cardPos(i0).lerp(cardPos(i1), f)
      /* ภาพรวมบอร์ด (ก่อนใบแรก) ↔ ใบที่ดู */
      const over = BOARD.c.clone()
      const k = smooth(Math.min(1, Math.max(0, ph.card + 0.6) / 0.6)) * focus
      TMP_Q.copy(over).lerp(cc, k)
      const dist = 1250 + (800 - 1250) * k
      CAM_IN.copy(TMP_Q).add(new THREE.Vector3(70, 50, dist))
      TMP_P.lerp(CAM_IN, ph.board)
      TMP_T.lerp(TMP_Q, ph.board)
      fov = fov + (30 - fov) * ph.board
    }
    /* กลับไอโซ แล้วพุ่งเข้าจอ (ภาพบนจอเป็นฟ้าแล้ว) */
    if (ph.back > 0) {
      TMP_P.lerp(K2, ph.back)
      TMP_T.lerp(ISO_T, ph.back)
      fov = fov + (ISO_FOV - fov) * ph.back
    }
    if (ph.dive > 0) {
      const d = ph.dive * ph.dive * (3 - 2 * ph.dive)
      CR.getPoint(1 - d, CAM_IN)
      TMP_P.copy(CAM_IN)
      TMP_T.copy(ISO_T).lerp(S, smooth(d / 0.6))
      fov = ISO_FOV + (40 - ISO_FOV) * smooth(d / 0.5)
    }
    screen.draw(smooth((ph.post - (T.back[0] + 0.05)) / 0.2))
    camera.position.copy(TMP_P)
    camera.lookAt(TMP_T)
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })
  return null
}

/** วาดทุกเฟรมตอนฉากโต๊ะโผล่ (แคนวาส demand) */
function Pump({ live }: { live: React.RefObject<boolean> }) {
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (live.current) invalidate()
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [live, invalidate])
  return null
}

function Scene({ state, live }: { state: React.RefObject<ReturnType<typeof deskPhase> | null>; live: React.RefObject<boolean> }) {
  const screen = useScreen()
  useEffect(() => () => screen.tex.dispose(), [screen])
  return (
    <>
      <Pump live={live} />
      <Rig state={state} screen={screen} />
      <DeskWorld screen={screen.tex} chair />
      <Suspense fallback={null}>
        <Board />
      </Suspense>
    </>
  )
}

/** แคนวาสฉากโต๊ะ (ชั้นบนสุดของเรื่อง — ทับเครื่องกับฉาก Code) + ชื่องานของใบที่ดู */
export function DeskStage({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const wrap = useRef<HTMLDivElement>(null)
  const info = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLDivElement>(null)
  const sub = useRef<HTMLDivElement>(null)
  const count = useRef<HTMLDivElement>(null)
  const state = useRef<ReturnType<typeof deskPhase> | null>(null)
  const live = useRef(false)
  useEffect(() => {
    let raf = 0
    let shown = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = wrap.current
      const f = frame.current
      if (!el || !f) return
      const ph = deskPhase(f.b)
      state.current = ph
      const vis = f.on && ph.show > 0.002
      live.current = vis
      el.style.visibility = vis ? 'visible' : 'hidden'
      el.style.opacity = ph.show.toFixed(3)
      /* ชื่องาน: ขึ้นเมื่อกล้องจ่อใบนั้นแล้ว */
      const i = Math.round(ph.card)
      const near = ph.board > 0.99 && ph.back < 0.01 && i >= 0 && i < PICKS.length ? 1 - Math.min(1, Math.abs(ph.card - i) * 2.2) : 0
      if (info.current) {
        info.current.style.opacity = near.toFixed(3)
        info.current.style.transform = `translate3d(0, ${((1 - near) * 12).toFixed(1)}px, 0)`
      }
      if (near > 0 && i !== shown) {
        shown = i
        const w = PICKS[i]
        if (title.current) title.current.textContent = w.name
        if (sub.current) sub.current.textContent = `${w.category} · ${w.sub}`
        if (count.current) count.current.textContent = `${String(i + 1).padStart(2, '0')} / ${String(PICKS.length).padStart(2, '0')}`
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame])
  return (
    <div ref={wrap} className="pointer-events-none absolute inset-0" style={{ visibility: 'hidden', opacity: 0, background: 'linear-gradient(to top, #f5e6fd, #ffffff 50%, #fff4df)' }}>
      <Canvas frameloop="demand" flat dpr={[1, 1.75]} camera={{ fov: 40, position: K0.toArray(), near: 5, far: 20000 }} gl={{ antialias: true }} style={{ position: 'absolute', inset: 0 }}>
        <Scene state={state} live={live} />
      </Canvas>
      <div ref={info} className="absolute bottom-[clamp(20px,6vh,64px)] left-[clamp(16px,5vw,80px)] max-w-[min(460px,80vw)] rounded-2xl bg-white/90 px-5 py-4 shadow-[0_14px_34px_rgba(41,42,46,0.16)]" style={{ opacity: 0, fontFamily: STORY_FONT }}>
        <div ref={count} className="text-[12px] font-semibold tracking-[0.12em] text-[#292a2e]/50" />
        <div ref={title} className="mt-1 text-[clamp(18px,1.6vw,26px)] leading-tight font-bold tracking-[-0.01em] text-[#292a2e]" />
        <div ref={sub} className="mt-1 text-[13px] text-[#292a2e]/65" />
      </div>
    </div>
  )
}
