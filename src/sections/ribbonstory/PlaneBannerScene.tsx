import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/**
 * จอ 2 — "Hello and Welcome" ลากด้วยเครื่องบิน
 *
 * เครื่องบินการ์ตูน (public/models/cartoon-plane.glb) บินจากซ้ายไปออกขวาจอ ท้ายเครื่องผูก
 * เชือกลากป้ายผ้าสามผืนต่อกัน — HELLO · AND · WELCOME — ป้ายลู่ตามเส้นทางที่เครื่องบินเพิ่ง
 * ผ่านไป (ไม่ใช่ผ้าติดแข็งอยู่ท้ายเครื่อง) จึงสะบัดตามที่เครื่องไต่ขึ้น/กดลงจริง
 *
 * พื้นจอเป็นขาว ต่อจากเมฆที่ถมจอ hero (ดู components/CloudWipe) — ม่านขาวทึบขึ้นเรื่อย ๆ
 * ตอนเข้าจอ ไม่ใช่แผ่นทึบเลื่อนมาทับ ไม่งั้นขอบบนของมันจะกวาดผ่านฉาก 3D ที่ตรึงอยู่ข้างหลัง
 *
 * ตอนจบ เครื่องพาป้ายหลุดขวาจอ แล้วป้ายสามผืนกลับมาเป็น "แถบคั่น" เต็มความกว้างชิดขอบล่าง
 * (HTML ไม่ใช่ 3D — ตัวหนังสือคมและต่อเข้าจอ What I Do พอดีเหมือนเวอร์ชันริบบิ้น SVG เดิม)
 *
 * ── ทำไมเส้นทางเป็นสูตร ไม่ใช่ประวัติตำแหน่ง ──
 * ป้ายลู่ตามอดีตของเครื่องบิน วิธีปกติคือเก็บ history ต่อเฟรมแล้วอ่านย้อน แต่ history ต้อง
 * "อุ่นเครื่อง" (เฟรมแรก ๆ ยังไม่มีอดีต ป้ายจะกองอยู่จุดเดียว) และมันขึ้นกับ frame rate
 * ที่นี่เส้นทางเป็นฟังก์ชันของระยะ (pathAt) ป้ายที่อยู่ห่างท้ายเครื่อง d หน่วยจึงอ่านค่า
 * pathAt(head - d) ได้ตรง ๆ — ถูกตั้งแต่เฟรมแรก และเท่ากันทุกเครื่อง
 */

const MODEL = '/models/cartoon-plane.glb'

/** สีป้าย = ชุดเดิมที่เลือกไว้ให้อ่านออกบนพื้นขาว (ส้ม / ดำหมึก / เขียวเข้ม) */
const BANNERS = [
  { word: 'HELLO', bg: '#fd5000', ink: '#f0f0f0' },
  { word: 'AND', bg: '#16181f', ink: '#f0f0f0' },
  { word: 'WELCOME', bg: '#01754f', ink: '#f0f0f0' },
]

/** ── เส้นทางบิน (หน่วยโลก) ─────────────────────────────────────────────
 * กล้องอยู่ z=17 fov 30 → สูงที่เห็น ≈ 9.1 หน่วย กว้าง ≈ 14.6 ที่จอ 16:10
 */
const CAM_Z = 17
const FOV = 30
/** ป้ายผืนละ 4.2 ยาว 1.4 สูง เว้นช่องระหว่างผืน 0.4 เชือกจากท้ายเครื่อง 1.2 */
const BAN_LEN = 4.2
const BAN_H = 1.4
const BAN_GAP = 0.4
const ROPE = 1.2
/** ระยะจากหัวเครื่องถึงปลายป้ายผืนสุดท้าย — ใช้คิดว่าต้องบินไกลเท่าไรของจึงพ้นจอ */
const TRAIL = ROPE + BANNERS.length * BAN_LEN + (BANNERS.length - 1) * BAN_GAP
/** ต้นทาง/ปลายทางของหัวเครื่องบนแกน x: เริ่มพ้นซ้ายจอ จบเมื่อป้ายผืนท้ายพ้นขวาจอ */
const HEAD_FROM = -9.5
const HEAD_TO = 9.5 + TRAIL
/** จำนวนช่วงต่อป้าย — ป้ายยาว 4.2 หน่วย 44 ช่วงพอให้โค้งเนียนโดยไม่เปลืองอะไร */
const SEG = 44

/** เส้นทางบิน: ไต่ขึ้นช้า ๆ พร้อมคลื่นสองความถี่ที่ไม่เป็นเท่าตัวกัน (ผลรวมไม่วนซ้ำให้ตาจับ) */
function pathAt(x: number, out: THREE.Vector3) {
  const y = 0.55 + Math.sin(x * 0.34) * 1.15 + Math.sin(x * 0.73 + 1.3) * 0.42
  const z = Math.sin(x * 0.21 + 0.6) * 0.8
  return out.set(x, y, z)
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

/** ความคืบหน้า scroll ของจอนี้ — เขียนจาก DOM, อ่านใน useFrame (context ไม่ข้ามเข้า Canvas) */
const flight = { p: 0 }

/**
 * สัดส่วนของ scroll ที่ใช้บิน — ที่เหลือคือจังหวะที่จอว่างแล้วแถบคั่นโผล่
 * ถ้าให้บินเต็มช่วง ขบวนจะพ้นจอตั้งแต่ราว 60% แล้วเหลือจอขาวเปล่าอีก 40%
 */
const EXIT_AT = 0.82

/** ตำแหน่งหัวเครื่องบนแกน x ตามความคืบหน้า — ทุกชิ้นในขบวนต้องอ่านค่าจากที่นี่ที่เดียว */
function headAt() {
  return THREE.MathUtils.lerp(HEAD_FROM, HEAD_TO, smooth(clamp01(flight.p / EXIT_AT)))
}

/**
 * ป้ายผ้า = canvas texture ต่อผืน ไม่ใช่ตัวอักษร 3D
 * ตัวหนังสือต้องบิดไปกับผ้า ถ้าเป็น geometry ของตัวอักษรมันจะแข็งอยู่หน้าป้าย
 */
function bannerTexture(word: string, bg: string, ink: string) {
  const c = document.createElement('canvas')
  // 4.2 : 1.4 = 3:1 — สัดส่วนเดียวกับป้าย ตัวหนังสือจึงไม่ยืด
  c.width = 1536
  c.height = 512
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 300px 'Momo Trust Sans', 'Mona Sans', system-ui, sans-serif`
    // คำยาว (WELCOME) ต้องหดให้พอในผืน ไม่ใช่ล้นขอบ
    const room = c.width * 0.88
    const w = ctx.measureText(word).width
    if (w > room) ctx.setTransform(room / w, 0, 0, 1, c.width / 2 - (room / w) * (c.width / 2), 0)
    ctx.fillText(word, c.width / 2, c.height / 2 + 12)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { tex, canvas: c }
}

/** ผ้าผืนเดียว: อัปเดตตำแหน่ง vertex ทุกเฟรมจาก pathAt + คลื่นสะบัดที่แรงขึ้นตามระยะห่างเครื่อง */
function Banner({
  word,
  bg,
  ink,
  front,
}: {
  word: string
  bg: string
  ink: string
  /** ระยะจากหัวเครื่องถึงขอบหน้าของป้ายผืนนี้ */
  front: number
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const art = useMemo(() => bannerTexture(word, bg, ink), [word, bg, ink])
  const geo = useMemo(() => new THREE.PlaneGeometry(BAN_LEN, BAN_H, SEG, 1), [])

  // ฟอนต์ของหน้าโหลดจาก Google Fonts — ถ้าวาดก่อนมันมา จะได้ system font แล้วค้างอยู่แบบนั้น
  useEffect(() => {
    let dead = false
    document.fonts.ready.then(() => {
      if (dead) return
      const redraw = bannerTexture(word, bg, ink)
      art.tex.image = redraw.canvas
      art.tex.needsUpdate = true
    })
    return () => {
      dead = true
    }
  }, [art, word, bg, ink])

  useEffect(() => () => {
    geo.dispose()
    art.tex.dispose()
  }, [geo, art])

  const tmp = useMemo(
    () => ({
      c: new THREE.Vector3(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      t: new THREE.Vector3(),
      side: new THREE.Vector3(),
      up: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      worldUp: new THREE.Vector3(0, 1, 0),
    }),
    [],
  )

  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const head = headAt()
    const time = state.clock.elapsedTime
    const pos = geo.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const row = SEG + 1

    for (let i = 0; i <= SEG; i += 1) {
      const u = i / SEG
      // i = SEG อยู่ติดเครื่อง (ขวาสุดของจอ), i = 0 คือปลายผ้า — ตรงกับ uv.x ที่ 0 อยู่ซ้าย
      const d = front + (1 - u) * BAN_LEN
      const x = head - d
      pathAt(x, tmp.c)
      pathAt(x - 0.12, tmp.a)
      pathAt(x + 0.12, tmp.b)
      tmp.t.subVectors(tmp.b, tmp.a).normalize()
      tmp.side.crossVectors(tmp.t, tmp.worldUp).normalize()
      tmp.up.crossVectors(tmp.side, tmp.t).normalize()

      /**
       * สะบัด: แรงขึ้นตามระยะห่างจากท้ายเครื่อง (จุดผูกแทบไม่ขยับ ปลายผ้าสะบัดสุด)
       * บิดรอบแกนยาว + ยกตัวผ้าเป็นคลื่น — สองอย่างคนละความถี่ ผ้าจึงไม่ขยับเป็นแผ่นแข็ง
       */
      const ramp = clamp01((d - ROPE * 0.5) / (TRAIL * 0.8))
      const phase = d * 1.15 - time * 2.6
      const twist = Math.sin(phase) * 0.5 * ramp
      const heave = Math.sin(phase * 0.62 + 0.8) * 0.32 * ramp
      tmp.c.addScaledVector(tmp.side, heave)
      tmp.dir.copy(tmp.up).multiplyScalar(Math.cos(twist)).addScaledVector(tmp.side, Math.sin(twist))

      const top = i
      const bot = row + i
      const hx = tmp.dir.x * (BAN_H / 2)
      const hy = tmp.dir.y * (BAN_H / 2)
      const hz = tmp.dir.z * (BAN_H / 2)
      arr[top * 3] = tmp.c.x + hx
      arr[top * 3 + 1] = tmp.c.y + hy
      arr[top * 3 + 2] = tmp.c.z + hz
      arr[bot * 3] = tmp.c.x - hx
      arr[bot * 3 + 1] = tmp.c.y - hy
      arr[bot * 3 + 2] = tmp.c.z - hz
    }
    pos.needsUpdate = true
    geo.computeBoundingSphere()
  })

  return (
    <mesh ref={mesh} geometry={geo} frustumCulled={false}>
      {/* แบนไม่รับแสง — ภาษาเดียวกับริบบิ้นแบนของหน้านี้ และ toneMapped=false ให้ได้สีตรงชุด */}
      <meshBasicMaterial map={art.tex} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  )
}

/** เชือกลาก — ผ้าผืนบางสีหมึก ใช้ตัวสร้างเดียวกับป้ายเพื่อให้ลู่ไปด้วยกัน */
function Rope() {
  const mesh = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => new THREE.PlaneGeometry(ROPE, 0.05, 10, 1), [])
  const tmp = useMemo(
    () => ({ c: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3() }),
    [],
  )
  useEffect(() => () => geo.dispose(), [geo])

  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const head = headAt()
    const time = state.clock.elapsedTime
    const pos = geo.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const row = 11
    for (let i = 0; i < row; i += 1) {
      const d = (1 - i / (row - 1)) * ROPE
      pathAt(head - d, tmp.c)
      const sag = Math.sin((d / ROPE) * Math.PI) * 0.08 + Math.sin(time * 2.4) * 0.01
      for (const idx of [i, row + i]) {
        arr[idx * 3] = tmp.c.x
        arr[idx * 3 + 1] = tmp.c.y - sag + (idx === i ? 0.025 : -0.025)
        arr[idx * 3 + 2] = tmp.c.z
      }
    }
    pos.needsUpdate = true
    geo.computeBoundingSphere()
  })

  return (
    <mesh ref={mesh} geometry={geo} frustumCulled={false}>
      <meshBasicMaterial color="#16181f" side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  )
}

/** เครื่องบิน — GLB ตัวเดียว 2167 tris ไม่มี texture ใบพัดหมุนด้วย clip 'Main' ในไฟล์ */
function Plane() {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(MODEL)
  const { actions } = useAnimations(animations, group)
  const tmp = useMemo(
    () => ({ c: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), t: new THREE.Vector3() }),
    [],
  )

  useEffect(() => {
    const clip = actions.Main
    if (!clip) return
    clip.reset().play()
    // ใบพัดในไฟล์หมุนรอบละ 3 วิ — เร็วขึ้นให้อ่านเป็นใบพัดกำลังทำงาน
    clip.timeScale = 6
    return () => {
      clip.stop()
    }
  }, [actions])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const head = headAt()
    pathAt(head, tmp.c)
    pathAt(head - 0.2, tmp.a)
    pathAt(head + 0.2, tmp.b)
    tmp.t.subVectors(tmp.b, tmp.a).normalize()
    g.position.copy(tmp.c)
    // หัวเครื่องชี้ตามทิศที่บิน + เอียงปีกเข้าโค้งตามความชัน (ไม่ใช่บินตรงแข็ง)
    g.rotation.set(0, 0, Math.atan2(tmp.t.y, tmp.t.x))
  })

  return (
    <group ref={group}>
      {/* โมเดลหันหัวไป +z ตอนนำเข้า — หมุนให้หัวไปทางขวาจอ (+x) แล้วเอียงหน่อยให้เห็นด้านข้าง */}
      <primitive object={scene} rotation={[0, Math.PI / 2, 0]} scale={1.15} />
    </group>
  )
}

useGLTF.preload(MODEL)

/** ทั้งขบวน: เครื่อง + เชือก + ป้ายสามผืนต่อกันไปทางท้าย */
function Convoy() {
  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 6, 8]} intensity={1.9} />
      <directionalLight position={[-5, -2, 4]} intensity={0.5} />
      <Suspense fallback={null}>
        <Plane />
      </Suspense>
      <Rope />
      {BANNERS.map((b, i) => (
        <Banner
          key={b.word}
          word={b.word}
          bg={b.bg}
          ink={b.ink}
          /**
           * ผืนที่ "ไกลท้ายเครื่องที่สุด" คือผืนซ้ายสุดบนจอ (เครื่องบินไปทางขวา)
           * เรียงกลับด้านจึงได้อ่านซ้าย→ขวาเป็น HELLO · AND · WELCOME
           */
          front={ROPE + (BANNERS.length - 1 - i) * (BAN_LEN + BAN_GAP)}
        />
      ))}
    </>
  )
}

export function PlaneBannerScene({ id = 'open-to-work' }: { id?: string }) {
  const section = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  /** mount แคนวาสเฉพาะตอนใกล้จอนี้ — ไม่ให้ WebGL context ที่สองมีชีวิตพร้อมฉาก hero */
  const [near, setNear] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = section.current
    if (!el) return
    const write = () => {
      const r = el.getBoundingClientRect()
      const span = el.offsetHeight - window.innerHeight
      const p = span > 0 ? clamp01(-r.top / span) : 0
      flight.p = p
      // ม่านขาวทึบขึ้นตอนเข้าจอ (ต่อจากเมฆ) — ไม่ใช่แผ่นทึบที่เลื่อนมาทับ
      if (stage.current) {
        const veil = smooth(clamp01(p / 0.14))
        stage.current.style.background = `rgba(255, 255, 255, ${veil.toFixed(3)})`
      }
      // แถบคั่นตอนจบ: โผล่ตอนเครื่องพาป้ายพ้นจอไปแล้ว
      if (bar.current) {
        const o = smooth(clamp01((p - 0.84) / 0.12))
        bar.current.style.opacity = o.toFixed(3)
        bar.current.style.transform = `translateY(${((1 - o) * 100).toFixed(1)}%)`
      }
    }
    let raf = 0
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0
        write()
      })
    }
    const io = new IntersectionObserver(
      (entries) => {
        setNear(entries[0].isIntersecting)
        schedule()
      },
      { rootMargin: '60%' },
    )
    const ioTight = new IntersectionObserver((entries) => setActive(entries[0].isIntersecting))
    io.observe(el)
    ioTight.observe(el)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    write()
    return () => {
      io.disconnect()
      ioTight.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section id={id} data-screen={id} ref={section} className="relative h-[420svh] w-full">
      <div ref={stage} className="sticky top-0 h-[100svh] w-full overflow-clip">
        {near && (
          <Canvas
            className="block h-full w-full"
            /* ผ้าสะบัด/ใบพัดหมุนตลอดเวลาที่อยู่ในจอ — พ้นจอแล้วหยุดวาดสนิท */
            frameloop={active ? 'always' : 'never'}
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true }}
            camera={{ position: [0, 0, CAM_Z], fov: FOV, near: 1, far: 60 }}
          >
            <Convoy />
          </Canvas>
        )}
        {/* แถบคั่นตอนจบ — HTML ไม่ใช่ 3D: ตัวหนังสือคมและต่อเข้าจอถัดไปพอดี */}
        <div
          ref={bar}
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[clamp(52px,9svh,92px)] w-full opacity-0"
        >
          {BANNERS.map((b) => (
            <div
              key={b.word}
              className="flex flex-1 items-center justify-center"
              style={{ background: b.bg, color: b.ink }}
            >
              <span className="font-[var(--v3-body)] text-[clamp(18px,2.4vw,34px)] font-bold tracking-[0.02em]">
                {b.word}
              </span>
            </div>
          ))}
        </div>
        <p className="sr-only">Hello and Welcome</p>
      </div>
    </section>
  )
}
