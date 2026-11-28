import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeElements } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, RoundedBox } from '@react-three/drei'
import { T, span } from './story'

/**
 * ฉาก "Pip กับบอลลูน" — ทุกอย่างปั้นด้วยโค้ด (ไม่มีโมเดลซื้อ):
 * ทะเลเมฆปุย (ทรงกลมซ้อน instanced) · บอลลูนลมร้อน (lathe มีกลีบ + ลายวาดลงแคนวาส) · หอก้อนอิฐ (instanced)
 * · Pip หุ่นหัวกล้อง (หัวกล้องม่วง เลนส์ตาเดียว ชุดลายตารางส้มขาว ขาผอม) · ลูกแก้วลอย
 *
 * story.p = ระยะเลื่อนดิบ (หน้าเขียน) · story.smooth = ค่าที่หน่วงแล้ว (ฉากเขียน ทุกอย่างอ่านค่านี้) · story.flash = แฟลชชัตเตอร์
 */
export const story = { p: 0, smooth: 0, flash: 0 }

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
/** สุ่มแบบกำหนดผล — ฉากเหมือนเดิมทุกครั้ง */
const rnd = (i: number, k = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/* ---------------- กล้อง ---------------- */

/** จุดกล้องตามบท (p, ตำแหน่ง, จุดมอง) — ผ่านทีละช่วงแบบนุ่ม */
const SHOTS: { p: number; pos: [number, number, number]; look: [number, number, number] }[] = [
  { p: 0.0, pos: [0.6, 3.15, 4.6], look: [0, 2.75, 0] },
  { p: 0.12, pos: [0.6, 3.15, 4.6], look: [0, 2.75, 0] },
  { p: 0.32, pos: [-1.5, 3.6, 13.5], look: [0.6, 3.6, 0] },
  { p: 0.4, pos: [-3.2, 3.0, 6.5], look: [1.2, 4.3, -3] },
  { p: 0.5, pos: [-2.8, 3.1, 6.9], look: [1.2, 4.2, -2.5] },
  { p: 0.62, pos: [4.2, 3.4, 9.5], look: [1.4, 2.6, 0] },
  { p: 0.72, pos: [3.8, 3.2, 7.2], look: [1.6, 2.6, 0] },
  { p: 0.86, pos: [6.5, 10.5, 12], look: [2.4, 9, 0] },
  { p: 1.0, pos: [1.2, 18, 12.5], look: [2.8, 14.2, -2] },
]

function CameraRig() {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(0, 2.75, 0))
  const P = useMemo(() => new THREE.Vector3(), [])
  const L = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, dt) => {
    /* หน่วงการเลื่อน — ภาพไหลต่อแม้เลื่อนกระตุก */
    story.smooth += (story.p - story.smooth) * (1 - Math.exp(-dt * 3.2))
    const s = story.smooth
    let i = 0
    while (i < SHOTS.length - 2 && s > SHOTS[i + 1].p) i += 1
    const a = SHOTS[i]
    const b = SHOTS[i + 1]
    const k = smooth((s - a.p) / Math.max(1e-4, b.p - a.p))
    P.set(lerp(a.pos[0], b.pos[0], k), lerp(a.pos[1], b.pos[1], k), lerp(a.pos[2], b.pos[2], k))
    L.set(lerp(a.look[0], b.look[0], k), lerp(a.look[1], b.look[1], k), lerp(a.look[2], b.look[2], k))
    /* ลมหายใจของกล้อง — ลอยเบา ๆ เหมือนถือมือ */
    const t = state.clock.elapsedTime
    P.x += Math.sin(t * 0.31) * 0.06
    P.y += Math.sin(t * 0.43) * 0.05
    camera.position.copy(P)
    look.current.lerp(L, 1 - Math.exp(-dt * 6))
    camera.lookAt(look.current)
    /* แฟลชชัตเตอร์ — พุ่งขึ้นทันทีที่ผ่านจังหวะ แล้วจางเร็ว */
    const d = Math.abs(s - T.shutter)
    story.flash = d < 0.012 ? (1 - d / 0.012) * 0.85 : 0
  })
  return null
}

/* ---------------- เมฆ ---------------- */

type Puff = { x: number; y: number; z: number; r: number; tint: number }
function cloudPuffs(): Puff[] {
  const out: Puff[] = []
  const cluster = (cx: number, cy: number, cz: number, size: number, seed: number) => {
    const n = 5 + Math.floor(rnd(seed, 1) * 5)
    for (let j = 0; j < n; j += 1) {
      const a = rnd(seed, j + 2) * Math.PI * 2
      const d = rnd(seed, j + 20) * size * 0.9
      out.push({
        x: cx + Math.cos(a) * d * 1.4,
        y: cy + rnd(seed, j + 40) * size * 0.45,
        z: cz + Math.sin(a) * d * 0.7,
        r: size * (0.45 + rnd(seed, j + 60) * 0.55),
        tint: rnd(seed, j + 80),
      })
    }
  }
  /* ทะเลเมฆล่าง รอบหอ (เว้นช่องหน้ากล้องตรงหน้า Pip) */
  for (let i = 0; i < 46; i += 1) {
    const a = rnd(i, 3) * Math.PI * 2
    /* ห่างหอพอ ไม่ให้ก้อนใหญ่บังฝาหอ (ก้อนชิดหอมีชุดเล็กของมันเองข้างล่าง) */
    const d = 5 + rnd(i, 4) * 24
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d - 6
    /* เว้นหน้ากล้องให้โล่ง — ก้อนใกล้กล้องบังหอกับ Pip */
    if (z > -1 && Math.abs(x) < 7) continue
    cluster(x, -0.9 + rnd(i, 5) * 1.4 - d * 0.02, z, 1.2 + rnd(i, 6) * 2.2, i + 100)
  }
  /* เมฆกอดโคนหอ — หอโผล่ขึ้นมาจากทะเลเมฆ ไม่ลอยเป็นก้อนหิน */
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 + rnd(i, 30) * 0.4
    const d = 1.9 + rnd(i, 31) * 0.8
    out.push({ x: Math.cos(a) * d, y: -0.4 + rnd(i, 32) * 0.5, z: Math.sin(a) * d, r: 0.6 + rnd(i, 33) * 0.45, tint: rnd(i, 34) })
  }
  /* เมฆลอยกลางฉาก (ระดับบอลลูน) ไกลหลัง */
  for (let i = 0; i < 14; i += 1) cluster(-18 + rnd(i, 7) * 36, 3 + rnd(i, 8) * 6, -14 - rnd(i, 9) * 14, 1.6 + rnd(i, 10) * 2, i + 300)
  /* ทะเลเมฆบน — ตอนจบลอยทะลุขึ้นไปเหนือมัน */
  for (let i = 0; i < 40; i += 1) {
    const x = -24 + rnd(i, 11) * 48
    const z = -28 + rnd(i, 12) * 34
    if (Math.abs(x - 2.6) < 2.2 && Math.abs(z) < 2.6) continue
    cluster(x, 10.6 + rnd(i, 13) * 0.8, z, 1.6 + rnd(i, 14) * 2.4, i + 500)
  }
  return out
}

function Clouds() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const puffs = useMemo(cloudPuffs, [])
  const geo = useMemo(() => new THREE.SphereGeometry(1, 28, 18), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, emissive: '#efe9ff', emissiveIntensity: 0.32 }), [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    const lav = new THREE.Color('#d9d0fb')
    const pink = new THREE.Color('#fbe1ef')
    puffs.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z)
      o.scale.set(p.r, p.r * 0.86, p.r)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      c.set('#ffffff').lerp(p.tint < 0.5 ? lav : pink, (p.tint < 0.5 ? p.tint : p.tint - 0.5) * 1.2)
      m.setColorAt(i, c)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    /* กรอบครอบต้องคิดใหม่หลังวางทุกชิ้น — ไม่งั้นถูกตัดทิ้งทั้งก้อนตอนจุดกำเนิดพ้นจอ */
    m.computeBoundingSphere()
  }, [puffs])
  return <instancedMesh ref={mesh} args={[geo, mat, puffs.length]} receiveShadow />
}

/* ---------------- บอลลูน ---------------- */

type Palette = { bot: string; top: string; swirl: string; gore: string }
const PALETTES: Record<string, Palette> = {
  violet: { bot: '#8f7bf2', top: '#c9b8ff', swirl: '#efe6ff', gore: '#7a63e6' },
  sunrise: { bot: '#ffb59a', top: '#fff0a8', swirl: '#ffffff', gore: '#f59a8a' },
  candy: { bot: '#ff9fd0', top: '#9fd0ff', swirl: '#ffffff', gore: '#e48cc0' },
  peach: { bot: '#f9c3d3', top: '#fff6ea', swirl: '#ffffff', gore: '#eeb0c4' },
  lilac: { bot: '#a98bff', top: '#e6dcff', swirl: '#ffffff', gore: '#9277ef' },
}

/** ผิวบอลลูน: ไล่สีล่าง→บน + เส้นกลีบ + ลายคลื่นอ่อน ๆ (แบบภาพอ้างอิง) — u รอบวง v สูง */
function balloonTexture(p: Palette, gores: number) {
  const W = 1024
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d') as CanvasRenderingContext2D
  const grad = g.createLinearGradient(0, H, 0, 0)
  grad.addColorStop(0, p.bot)
  grad.addColorStop(1, p.top)
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  /* ลายคลื่นใหญ่ ๆ อ่อน ๆ ทุกสามกลีบ */
  g.strokeStyle = p.swirl
  g.globalAlpha = 0.38
  g.lineWidth = 26
  g.lineCap = 'round'
  for (let k = 0; k < gores / 3; k += 1) {
    const x0 = (k * 3 + 0.5) * (W / gores)
    g.beginPath()
    for (let y = H * 0.12; y < H * 0.86; y += 6) {
      const x = x0 + Math.sin((y / H) * Math.PI * 3 + k) * (W / gores) * 0.9
      if (y === H * 0.12) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  /* เส้นกลีบ */
  g.globalAlpha = 0.5
  g.strokeStyle = p.gore
  g.lineWidth = 3
  for (let k = 0; k <= gores; k += 1) {
    const x = (k * W) / gores
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, H)
    g.stroke()
  }
  /* แถบคาดล่าง */
  g.globalAlpha = 0.55
  g.fillStyle = p.gore
  g.fillRect(0, H * 0.88, W, H * 0.03)
  g.globalAlpha = 1
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

/** ทรงบอลลูน: ปากล่างแคบ พองกว้างสุดราว 65% ความสูง โดมบน — กลีบนูนตามรอบ (สูง 1 หน่วย) */
function balloonGeometry(gores: number) {
  const pts: THREE.Vector2[] = []
  const N = 48
  for (let i = 0; i <= N; i += 1) {
    const a = i / N
    const r = Math.max(0.5 * Math.pow(Math.sin(Math.PI * Math.pow(a, 1.6)), 0.66), 0.11 * (1 - a) * (a < 0.2 ? 1 : 0))
    pts.push(new THREE.Vector2(i === N ? 0 : Math.max(r, 0.001), a))
  }
  const g = new THREE.LatheGeometry(pts, gores * 6)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const th = Math.atan2(x, z)
    /* กลีบ: นูนกลางกลีบ ยุบที่ตะเข็บ */
    const k = 1 + 0.035 * Math.pow(Math.abs(Math.sin((th * gores) / 2)), 0.6) - 0.017
    pos.setX(i, x * k)
    pos.setZ(i, z * k)
  }
  g.computeVertexNormals()
  return g
}

function Balloon({ palette, gores = 12, scale = 1, basket = true, ...rest }: { palette: keyof typeof PALETTES; gores?: number; scale?: number; basket?: boolean } & ThreeElements['group']) {
  const geo = useMemo(() => balloonGeometry(gores), [gores])
  const tex = useMemo(() => balloonTexture(PALETTES[palette], gores), [palette, gores])
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.42, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), clearcoat: 0.25, clearcoatRoughness: 0.5 }), [tex])
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8b7cf0', roughness: 0.6 }), [])
  useEffect(
    () => () => {
      geo.dispose()
      tex.dispose()
      mat.dispose()
      wood.dispose()
    },
    [geo, tex, mat, wood],
  )
  /* กลุ่ม: จุดกำเนิด = พื้นตะกร้า · ตัวบอลลูนเหนือตะกร้า */
  return (
    <group {...rest} scale={scale}>
      <mesh geometry={geo} material={mat} position={[0, 0.42, 0]} castShadow />
      {basket && (
        <>
          {/* เชือกสี่เส้นจากปากบอลลูนลงขอบตะกร้า */}
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4
            return (
              <mesh key={i} position={[Math.cos(a) * 0.1, 0.27, Math.sin(a) * 0.1]} material={wood}>
                <cylinderGeometry args={[0.004, 0.004, 0.32, 5]} />
              </mesh>
            )
          })}
          <mesh position={[0, 0.115, 0]} rotation={[Math.PI / 2, 0, 0]} material={wood}>
            <torusGeometry args={[0.105, 0.012, 8, 24]} />
          </mesh>
          <RoundedBox args={[0.2, 0.12, 0.2]} radius={0.025} smoothness={3} position={[0, 0.06, 0]} material={wood} castShadow />
        </>
      )}
    </group>
  )
}

/* ---------------- หอก้อนอิฐ ---------------- */

function Tower() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const ROWS = 14
  const PER = 16
  const R = 1.3
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 }), [])
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8c1f7', roughness: 0.4 }), [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
      capMat.dispose()
    },
    [geo, mat, capMat],
  )
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    const cols = ['#8e88e8', '#a9a3f2', '#c5c0f8', '#7a72df', '#b7b1f5']
    let n = 0
    for (let r = 0; r < ROWS; r += 1) {
      const y = 1.78 - r * 0.42
      for (let k = 0; k < PER; k += 1) {
        const a = ((k + (r % 2) * 0.5) / PER) * Math.PI * 2
        o.position.set(Math.sin(a) * R, y, Math.cos(a) * R)
        o.rotation.set(0, a, 0)
        /* ก้อนอิฐโค้งตามหอ — กว้างตามเส้นรอบวงหารจำนวน เว้นร่องนิดหนึ่ง */
        o.scale.set(((Math.PI * 2 * R) / PER) * 0.94, 0.38, 0.32)
        o.updateMatrix()
        m.setMatrixAt(n, o.matrix)
        c.set(cols[Math.floor(rnd(r * PER + k, 7) * cols.length)])
        m.setColorAt(n, c)
        n += 1
      }
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [])
  return (
    <group>
      <instancedMesh ref={mesh} args={[geo, mat, ROWS * PER]} castShadow receiveShadow />
      {/* แกนในทึบ (ร่องระหว่างอิฐไม่โปร่ง) + ฝาบนเป็นจานแบน */}
      <mesh position={[0, -1, 0]} material={capMat}>
        <cylinderGeometry args={[R - 0.12, R - 0.12, 6, 32]} />
      </mesh>
      <mesh position={[0, 2.0, 0]} material={capMat} receiveShadow>
        <cylinderGeometry args={[R + 0.06, R + 0.06, 0.06, 48]} />
      </mesh>
    </group>
  )
}

/* ---------------- Pip หุ่นหัวกล้อง ---------------- */

function checkerTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d') as CanvasRenderingContext2D
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#ff9a5c')
  grad.addColorStop(1, '#ff6f91')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#fff6ee'
  const n = 4
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n * 2; x += 1) if ((x + y) % 2 === 0) g.fillRect((x * 256) / (n * 2), (y * 256) / n, 256 / (n * 2), 256 / n)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const PURPLE = '#7a4ff0'
type PipApi = { root: THREE.Group | null; head: THREE.Group | null; pupil: THREE.Mesh | null; lensMat: THREE.MeshStandardMaterial | null; legs: (THREE.Group | null)[] }

function Pip({ api }: { api: React.RefObject<PipApi> }) {
  const tex = useMemo(checkerTexture, [])
  const mats = useMemo(
    () => ({
      purple: new THREE.MeshPhysicalMaterial({ color: PURPLE, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
      lilac: new THREE.MeshPhysicalMaterial({ color: '#b9a4ff', roughness: 0.3, clearcoat: 0.6 }),
      dress: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }),
      orange: new THREE.MeshStandardMaterial({ color: '#ff7a3d', roughness: 0.45 }),
      pink: new THREE.MeshPhysicalMaterial({ color: '#ff5fa2', roughness: 0.25, clearcoat: 1 }),
      white: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }),
      black: new THREE.MeshStandardMaterial({ color: '#16121f', roughness: 0.2 }),
      lens: new THREE.MeshStandardMaterial({ color: '#4a36b8', roughness: 0.15, metalness: 0.3, emissive: '#ffffff', emissiveIntensity: 0 }),
      glow: new THREE.MeshStandardMaterial({ color: '#fff3b0', emissive: '#ffe680', emissiveIntensity: 0.9, roughness: 0.4 }),
    }),
    [tex],
  )
  useEffect(
    () => () => {
      tex.dispose()
      Object.values(mats).forEach((m) => m.dispose())
    },
    [tex, mats],
  )
  const set = <K extends keyof PipApi>(k: K) => (v: PipApi[K]) => {
    if (api.current) api.current[k] = v
  }
  return (
    <group ref={set('root')}>
      {/* ขา + เท้า */}
      {[-1, 1].map((s, i) => (
        <group
          key={s}
          position={[s * 0.16, 0, 0]}
          ref={(g) => {
            if (api.current) api.current.legs[i] = g
          }}
        >
          <mesh position={[0, 0.3, 0]} material={mats.purple} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.5, 12]} />
          </mesh>
          <mesh position={[0, 0.05, 0.03]} scale={[1, 0.7, 1.25]} material={mats.orange} castShadow>
            <sphereGeometry args={[0.08, 20, 14]} />
          </mesh>
        </group>
      ))}
      {/* ลูกไฟเหลืองข้างหลังขา (แบบภาพอ้างอิง) */}
      <mesh position={[0, 0.22, -0.18]} material={mats.glow}>
        <sphereGeometry args={[0.2, 28, 18]} />
      </mesh>
      {/* ชุดกระโปรงลายตาราง */}
      <mesh position={[0, 0.88, 0]} material={mats.dress} castShadow>
        <cylinderGeometry args={[0.2, 0.46, 0.72, 40, 1]} />
      </mesh>
      <mesh position={[0, 0.53, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.orange}>
        <torusGeometry args={[0.455, 0.025, 10, 40]} />
      </mesh>
      {/* คอ */}
      <mesh position={[0, 1.33, 0]} material={mats.purple}>
        <cylinderGeometry args={[0.04, 0.04, 0.22, 12]} />
      </mesh>
      {/* หัวกล้อง */}
      <group position={[0, 1.62, 0]} ref={set('head')}>
        <RoundedBox args={[0.66, 0.46, 0.4]} radius={0.09} smoothness={4} material={mats.purple} castShadow />
        {/* แถบจับด้านข้าง + ปุ่มชัตเตอร์ + ช่องมองภาพ */}
        <RoundedBox args={[0.12, 0.4, 0.42]} radius={0.04} position={[-0.29, 0, 0]} material={mats.lilac} />
        <RoundedBox args={[0.16, 0.08, 0.16]} radius={0.03} position={[0.16, 0.26, 0]} material={mats.lilac} />
        <mesh position={[0, 0.27, 0]} material={mats.orange}>
          <cylinderGeometry args={[0.07, 0.08, 0.06, 20]} />
        </mesh>
        <mesh position={[0, 0.35, 0]} material={mats.pink}>
          <sphereGeometry args={[0.07, 20, 14]} />
        </mesh>
        {/* เลนส์ = ตา: วงแหวน → เลนส์เข้ม → ตาขาว → ลูกตาดำแนวตั้ง */}
        <group position={[0.02, -0.01, 0.2]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.lilac}>
            <cylinderGeometry args={[0.17, 0.18, 0.08, 36]} />
          </mesh>
          <mesh position={[0, 0, 0.045]} rotation={[Math.PI / 2, 0, 0]} material={mats.lens} ref={(m) => m && api.current && (api.current.lensMat = m.material as THREE.MeshStandardMaterial)}>
            <cylinderGeometry args={[0.13, 0.13, 0.02, 36]} />
          </mesh>
          <mesh position={[0, 0, 0.058]} scale={[0.82, 1.05, 0.3]} material={mats.white}>
            <sphereGeometry args={[0.1, 24, 16]} />
          </mesh>
          <mesh position={[0, 0, 0.085]} scale={[0.42, 0.8, 0.3]} material={mats.black} ref={set('pupil')}>
            <sphereGeometry args={[0.1, 20, 14]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/* ---------------- ลูกแก้วลอย ---------------- */

function Orbs() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const N = 34
  const data = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        x: -14 + rnd(i, 21) * 28,
        y: 1 + rnd(i, 22) * 13,
        z: -16 + rnd(i, 23) * 18,
        r: 0.06 + rnd(i, 24) * 0.22,
        ph: rnd(i, 25) * 6.28,
        c: rnd(i, 26),
      })),
    [],
  )
  const geo = useMemo(() => new THREE.SphereGeometry(1, 24, 16), [])
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.2, clearcoat: 1 }), [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const c = new THREE.Color()
    data.forEach((d, i) => m.setColorAt(i, c.set(d.c < 0.5 ? '#6f5ee8' : '#9db4ff')))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [data])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m) return
    const t = clock.elapsedTime
    data.forEach((d, i) => {
      o.position.set(d.x, d.y + Math.sin(t * 0.6 + d.ph) * 0.25, d.z)
      o.scale.setScalar(d.r)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
}

/* ---------------- ฉาก ---------------- */

/** บอลลูนประดับ — ลอยขึ้นลงคนละจังหวะ บางลูกลอยขึ้นช้า ๆ ตลอดเรื่อง */
const FLOCK: { palette: keyof typeof PALETTES; p: [number, number, number]; s: number; drift: number }[] = [
  { palette: 'sunrise', p: [-6.4, 0.2, -2.5], s: 5.2, drift: 1.2 },
  { palette: 'violet', p: [6.6, -0.6, -1.2], s: 5.6, drift: 0.8 },
  { palette: 'lilac', p: [-2.8, 3.2, -7], s: 3.6, drift: 2.2 },
  { palette: 'peach', p: [2.4, 6.4, -9], s: 2.2, drift: 3 },
  { palette: 'peach', p: [-5.2, 7.6, -15], s: 1.8, drift: 3.4 },
  { palette: 'candy', p: [-4.6, -3.2, 1.2], s: 4, drift: 1.6 },
  { palette: 'lilac', p: [9.5, 5.5, -16], s: 2.4, drift: 2.6 },
  { palette: 'sunrise', p: [-11, 4.2, -12], s: 2.8, drift: 2.4 },
]

export function BalloonScene() {
  const pip = useRef<PipApi>({ root: null, head: null, pupil: null, lensMat: null, legs: [null, null] })
  const hero = useRef<THREE.Group>(null)
  const flock = useRef<(THREE.Group | null)[]>([])
  const HP = useMemo(() => new THREE.Vector3(), [])
  const TMP = useMemo(() => new THREE.Vector3(), [])
  const Q = useMemo(() => new THREE.Quaternion(), [])
  const M = useMemo(() => new THREE.Matrix4(), [])

  useFrame(({ clock }) => {
    const s = story.smooth
    const t = clock.elapsedTime

    /* ฝูงบอลลูน: ลอยขึ้นลงเบา ๆ + ค่อย ๆ ลอยสูงขึ้นตามเรื่อง */
    FLOCK.forEach((f, i) => {
      const g = flock.current[i]
      if (!g) return
      g.position.set(f.p[0], f.p[1] + Math.sin(t * 0.4 + i * 1.7) * 0.18 + s * f.drift, f.p[2])
      g.rotation.y = t * 0.04 * (i % 2 ? 1 : -1) + i
    })

    /* บอลลูนลูกหลัก: ลอยสูงหลังเมฆ → ลงมาจอดข้างหอ → พา Pip ลอยขึ้นทะลุเมฆ */
    const dock = smooth(span(s, T.dock))
    const rise = smooth(span(s, T.rise))
    HP.set(lerp(4.2, 2.45, dock), lerp(9.8, 1.48, dock) + Math.sin(t * 0.7) * 0.06 * (1 - dock * 0.7), lerp(-4.5, 0.3, dock))
    HP.y += rise * 12.6
    HP.x += rise * 0.4
    const hb = hero.current
    if (hb) {
      hb.position.copy(HP)
      hb.rotation.y = 0.4 - dock * 0.4 + Math.sin(t * 0.3) * 0.05
      hb.rotation.z = Math.sin(t * 0.5) * 0.02
    }

    /* Pip */
    const api = pip.current
    const root = api.root
    if (root) {
      const hop = span(s, T.hop)
      /* พื้นตะกร้าในพิกัดโลก (ตะกร้าสเกล 4.6 — พื้นตะกร้าอยู่ที่จุดกำเนิดของกลุ่ม) */
      TMP.set(HP.x, HP.y + 0.08, HP.z)
      const base = new THREE.Vector3(0, 2.03, 0)
      const k = smooth(hop)
      root.position.lerpVectors(base, TMP, k)
      root.position.y += Math.sin(Math.PI * hop) * 1.3
      /* ท่าย่อเด้งตอนออกตัว/ลงพื้น */
      const squash = Math.sin(Math.PI * clamp01(hop * 3)) * 0.18 - Math.sin(Math.PI * clamp01((hop - 0.7) * 3.3)) * 0.12
      root.scale.set(0.9 * (1 + squash * 0.4), 0.9 * (1 - squash), 0.9 * (1 + squash * 0.4))
      /* ตอนบินลง: หมุนตัวหนึ่งรอบ (ท่าเล่น) */
      root.rotation.y = lerp(0, -0.35, smooth(span(s, T.aim))) + hop * Math.PI * 2 * (hop < 1 ? 1 : 0)
      if (hop >= 1) root.rotation.y = -0.6
      /* ตัวโยกตามลมหายใจ */
      root.position.y += Math.sin(t * 2.2) * 0.008
      for (const [i, leg] of api.legs.entries()) if (leg) leg.rotation.x = Math.sin(Math.PI * hop) * (i ? -0.5 : 0.5)
    }
    const head = api.head
    if (head) {
      /* หัวกล้องมองตาม: กวาดฟ้าช่วงแรก → เล็งบอลลูนลูกหลักตอนลั่นชัตเตอร์ → มองตะกร้าตอนจอด */
      const aim = smooth(span(s, T.aim))
      const scan = Math.sin(t * 0.5) * 0.35 * (1 - aim)
      head.updateMatrixWorld()
      TMP.copy(HP).add(new THREE.Vector3(0, 2.3, 0))
      const wantYaw = Math.atan2(TMP.x - (root?.position.x ?? 0), TMP.z - (root?.position.z ?? 0)) - (root?.rotation.y ?? 0)
      const wantPitch = Math.atan2(TMP.y - 3.6, 4)
      const after = smooth(span(s, T.hop))
      head.rotation.y = lerp(scan, wantYaw, aim) * (1 - after)
      head.rotation.x = lerp(0, -Math.min(0.5, wantPitch), aim) * (1 - after) + Math.sin(t * 1.3) * 0.02
      head.rotation.z = Math.sin(t * 0.9) * 0.03
    }
    /* กะพริบตา + แฟลชที่เลนส์ */
    if (api.pupil) {
      const blink = (t % 3.7) < 0.12 ? 0.15 : 1
      api.pupil.scale.y = 0.8 * blink
    }
    if (api.lensMat) api.lensMat.emissiveIntensity = story.flash * 3
    void Q
    void M
  })

  return (
    <>
      <CameraRig />
      <fog attach="fog" args={['#ddd5f6', 16, 62]} />
      <hemisphereLight args={['#f6f2ff', '#cbb6f2', 1.15]} />
      <directionalLight
        position={[5, 9, 7]}
        intensity={1.7}
        color="#fff3ea"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-6, 3, -4]} intensity={0.6} color="#c9b8ff" />
      {/* แผงไฟนุ่มให้ผิวมันของบอลลูน/หัวกล้องมีไฮไลต์แบบดินน้ำมัน */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={2.2} color="#ffffff" position={[0, 6, 6]} scale={[10, 4, 1]} />
        <Lightformer intensity={1.2} color="#e6dcff" position={[-8, 2, 2]} rotation-y={Math.PI / 2} scale={[8, 6, 1]} />
        <Lightformer intensity={1} color="#ffe2ef" position={[8, 1, -2]} rotation-y={-Math.PI / 2} scale={[8, 6, 1]} />
      </Environment>

      <Clouds />
      <Tower />
      <ContactShadows position={[0, 2.035, 0]} scale={3} blur={2.4} opacity={0.35} far={1.6} color="#4b3a9a" />
      <Pip api={pip} />
      <group ref={hero}>
        <Balloon palette="candy" scale={4.6} gores={14} />
      </group>
      {FLOCK.map((f, i) => (
        <group
          key={i}
          ref={(g) => {
            flock.current[i] = g
          }}
        >
          <Balloon palette={f.palette} scale={f.s} gores={12} />
        </group>
      ))}
      <Orbs />
    </>
  )
}
