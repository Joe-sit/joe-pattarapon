import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SKILLS } from '@/sections/whatido/WhatIDo'

/**
 * What I do — ลูกศรโตทะลุพื้นกระเบื้อง (ภาพอ้างอิง "We grow digital products")
 *
 * พื้นกระเบื้องไอโซเมตริกเส้นดำ ลูกศรหนาลายกราฟิกงอกจากพื้นตามการเลื่อน พุ่งขึ้น มุดลงพื้น แล้วโผล่ขึ้น
 * อีกทีเป็นหัวลูกศร — หนึ่งท่อนต่อสกิล (Design → Coding → Research) ข้อความซ้ายบอกท่อนที่กำลังโต
 * กระเบื้องรอบรูที่ลูกศรทะลุเด้งเป็นสีน้ำเงิน กล่องเส้นลอยขึ้นจากพื้นตามปลายลูกศร
 *
 * ทุกอย่างผูกกับระยะเลื่อน (ไม่มีแอนิเมชันตามเวลา) — แคนวาสวาดตามคำสั่ง ปลุกเฉพาะตอนเลื่อน
 */

const ORDER = ['Design', 'Coding', 'Research'] as const
const STEPS = ORDER.map((t) => SKILLS.find((s) => s.title === t)).filter((s): s is (typeof SKILLS)[number] => !!s)

const BLUE = '#3b55f6'
const PINK = '#e7a0f7'
const INK = '#101114'

/** เส้นทางลูกศร (u ตามพื้น, y สูง) หน่วยกระเบื้อง — ขึ้น · มุดลงพื้น · โผล่พุ่งขึ้นเป็นหัว */
const PATH: [number, number][] = [
  [0, -0.5],
  [2.3, 1.7],
  [3.5, -0.7],
  [6.6, 4.3],
]
const THICK = 0.72
const WIDE = 0.9
const HEAD_W = 0.62
const HEAD_L = 1.15
/** u ที่จบแต่ละท่อน (ท่อนต่อสกิล) — ท่อนสุดท้ายจบที่ปลายหัวลูกศร */
const tipU = (() => {
  const [a, b] = [PATH[PATH.length - 2], PATH[PATH.length - 1]]
  const l = Math.hypot(b[0] - a[0], b[1] - a[1])
  return b[0] + ((b[0] - a[0]) / l) * HEAD_L
})()
const STEP_END = [2.3, 4.9, tipU + 0.05]
/** จุดที่ลูกศรทะลุพื้น (y = 0) — กระเบื้องตรงนั้นเป็นรู */
const CROSS = (() => {
  const out: number[] = []
  for (let i = 0; i < PATH.length - 1; i += 1) {
    const [a, b] = [PATH[i], PATH[i + 1]]
    if (a[1] * b[1] < 0) out.push(a[0] + ((b[0] - a[0]) * -a[1]) / (b[1] - a[1]))
  }
  return out
})()

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}
const outBack = (x: number) => {
  const u = clamp01(x) - 1
  return 1 + 2.4 * u * u * u + 1.4 * u * u
}
/** สุ่มแบบกำหนดผล — ลายพื้นเหมือนเดิมทุกครั้งที่โหลด */
const rand = (i: number, j: number, k = 0) => {
  const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** ลายบนผิวลูกศร — วาดลงแคนวาสครั้งเดียว */
function patternTex(kind: 'stripes' | 'grid' | 'dots' | 'border', color = '#ffffff') {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d') as CanvasRenderingContext2D
  if (kind === 'stripes') {
    /* พื้นดำ เส้นขาวคลื่น — หน้าข้างใหญ่ของลูกศร */
    g.fillStyle = INK
    g.fillRect(0, 0, 256, 256)
    g.strokeStyle = '#ffffff'
    g.lineWidth = 5
    for (let y = -16; y < 272; y += 16) {
      g.beginPath()
      for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin((x / 256) * Math.PI * 2) * 10)
      g.stroke()
    }
  } else if (kind === 'grid') {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 256, 256)
    g.strokeStyle = INK
    g.lineWidth = 3
    for (let i = 0; i <= 256; i += 32) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i, 256)
      g.moveTo(0, i)
      g.lineTo(256, i)
      g.stroke()
    }
  } else if (kind === 'dots') {
    g.fillStyle = PINK
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = INK
    for (let y = 8; y < 256; y += 16) for (let x = 8 + ((y / 16) % 2) * 8; x < 256; x += 16) g.fillRect(x - 2, y - 2, 4, 4)
  } else {
    /* ขาว ขอบดำ — กระเบื้องกับกล่อง (สีย้อมจาก instanceColor ขอบยังดำ) */
    g.fillStyle = color
    g.fillRect(0, 0, 256, 256)
    g.strokeStyle = INK
    g.lineWidth = 14
    g.strokeRect(0, 0, 256, 256)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

/** ตัดผิวที่ยังไม่ถึงคิวโต (x > uGrow) กับส่วนใต้พื้น — ลูกศรงอกจากพื้นตามการเลื่อน */
function growable<M extends THREE.Material>(mat: M, grow: { value: number }, tint = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrow = grow
    sh.uniforms.uTint = { value: STEPS.map((s) => new THREE.Color(s.color)) }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc;\nuniform float uGrow;')
      .replace('void main() {', 'void main() {\n  if (vLoc.x > uGrow || vLoc.y < 0.0) discard;')
    /* ผิวบนล่างของลูกศรย้อมสีสกิลของท่อนนั้น (ลายตารางขาวเส้นดำ × สี) */
    if (tint)
      sh.fragmentShader = sh.fragmentShader
        .replace('uniform float uGrow;', `uniform float uGrow;\nuniform vec3 uTint[3];`)
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>\ndiffuseColor.rgb *= vLoc.x < ${STEP_END[0].toFixed(2)} ? uTint[0] : vLoc.x < ${STEP_END[1].toFixed(2)} ? uTint[1] : uTint[2];`,
        )
  }
  /* ซอร์สของ onBeforeCompile เหมือนกันทุกตัว — ไม่แยกคีย์ three จะใช้โปรแกรมของตัวแรกซ้ำ (สีย้อมหาย) */
  mat.customProgramCacheKey = () => `grow-${mat.type}-${tint}`
  return mat
}

/** โครงลูกศร: เส้นหนาต่อมุมแบบ miter + หัวลูกศรที่ปลาย แล้วรีดออกตามความกว้าง */
function arrowShape() {
  const n = PATH.length
  const dir = (i: number) => {
    const [a, b] = [PATH[i], PATH[i + 1]]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l] as const
  }
  /* เส้นตั้งฉากที่จุดยอด — ปลายใช้ของท่อนเดียว จุดกลางใช้เส้นแบ่งครึ่งมุม ยืดให้ความหนาคงที่ */
  const off = (i: number) => {
    const d0 = dir(Math.max(0, i - 1))
    const d1 = dir(Math.min(n - 2, i))
    const n0 = [-d0[1], d0[0]]
    const n1 = [-d1[1], d1[0]]
    if (i === 0) return n1
    if (i === n - 1) return n0
    const m = [n0[0] + n1[0], n0[1] + n1[1]]
    const ml = Math.hypot(m[0], m[1])
    const k = 1 / Math.max(0.35, (m[0] / ml) * n1[0] + (m[1] / ml) * n1[1])
    return [(m[0] / ml) * k, (m[1] / ml) * k]
  }
  const h = THICK / 2
  const s = new THREE.Shape()
  PATH.forEach((p, i) => {
    const o = off(i)
    if (i === 0) s.moveTo(p[0] + o[0] * h, p[1] + o[1] * h)
    else s.lineTo(p[0] + o[0] * h, p[1] + o[1] * h)
  })
  const end = PATH[n - 1]
  const de = dir(n - 2)
  const ne = [-de[1], de[0]]
  s.lineTo(end[0] + ne[0] * (h + HEAD_W), end[1] + ne[1] * (h + HEAD_W))
  s.lineTo(end[0] + de[0] * HEAD_L, end[1] + de[1] * HEAD_L)
  s.lineTo(end[0] - ne[0] * (h + HEAD_W), end[1] - ne[1] * (h + HEAD_W))
  for (let i = n - 1; i >= 0; i -= 1) {
    const o = off(i)
    s.lineTo(PATH[i][0] - o[0] * h, PATH[i][1] - o[1] * h)
  }
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: WIDE, bevelEnabled: false })
  geo.translate(0, 0, -WIDE / 2)
  return geo
}

type Tile = { i: number; j: number; d: number; blue: boolean; hole: boolean; wake: number }
type Cube = { x: number; z: number; y: number; s: number; wake: number; spin: number }

/** พื้นกระเบื้อง: แถบตามแนวลูกศร หนาแน่นใกล้เส้น บางลงห่างออกไป · รูตรงจุดทะลุ · น้ำเงินรอบรู */
function buildTiles(): Tile[] {
  const out: Tile[] = []
  for (let j = -1; j <= 9; j += 1) {
    for (let i = -4; i <= 4; i += 1) {
      const u = j
      const nearCross = CROSS.some((c) => Math.abs(u - c) < 0.75)
      const hole = i === 0 && nearCross
      const keep = Math.abs(i) <= 1 || rand(i, j) > (Math.abs(i) - 1) * 0.24
      if (!keep || u > tipU + 1.5) continue
      const ring = CROSS.some((c) => Math.abs(u - c) < 1.6) && Math.abs(i) <= 2
      out.push({ i, j, d: Math.abs(i) * 0.6 + j * 0.35, blue: !hole && ring && rand(i, j, 3) > 0.35, hole, wake: u - 0.4 })
    }
  }
  return out
}
function buildCubes(): Cube[] {
  const out: Cube[] = []
  for (let k = 0; k < 13; k += 1) {
    const z = 0.4 + rand(k, 1) * (tipU + 0.5)
    const side = rand(k, 2) > 0.5 ? 1 : -1
    const x = side * (1.2 + rand(k, 3) * 2.4)
    out.push({ x, z, y: 0.5 + rand(k, 4) * 1.8, s: 0.45 + rand(k, 5) * 0.35, wake: z - 0.6, spin: rand(k, 6) * Math.PI })
  }
  return out
}

const TMP = new THREE.Object3D()
const C_WHITE = new THREE.Color('#ffffff')
const C_BLUE = new THREE.Color(BLUE)
const C_TMP = new THREE.Color()

function Scene({ prog }: { prog: React.RefObject<number> }) {
  const { invalidate, size, camera } = useThree()
  const grow = useMemo(() => ({ value: -1 }), [])
  const tiles = useMemo(buildTiles, [])
  const cubes = useMemo(buildCubes, [])

  const assets = useMemo(() => {
    const geo = arrowShape()
    const edges = new THREE.EdgesGeometry(geo, 20)
    const stripes = patternTex('stripes')
    stripes.repeat.set(0.9, 0.9)
    const grid = patternTex('grid')
    grid.repeat.set(0.7, 0.7)
    const border = patternTex('border')
    const cap = growable(new THREE.MeshBasicMaterial({ map: stripes, side: THREE.DoubleSide }), grow)
    const sideM = growable(new THREE.MeshBasicMaterial({ map: grid, side: THREE.DoubleSide }), grow, true)
    const lineM = growable(new THREE.LineBasicMaterial({ color: INK }), grow)
    const tileGeo = new THREE.BoxGeometry(1, 0.1, 1)
    const cubeGeo = new THREE.BoxGeometry(1, 1, 1)
    const boxM = new THREE.MeshBasicMaterial({ map: border })
    return { geo, edges, stripes, grid, border, cap, sideM, lineM, tileGeo, cubeGeo, boxM }
  }, [grow])
  useEffect(
    () => () => {
      const a = assets
      ;[a.geo, a.edges, a.tileGeo, a.cubeGeo].forEach((g) => g.dispose())
      ;[a.stripes, a.grid, a.border].forEach((t) => t.dispose())
      ;[a.cap, a.sideM, a.lineM, a.boxM].forEach((m) => m.dispose())
    },
    [assets],
  )

  const tileMesh = useRef<THREE.InstancedMesh>(null)
  const cubeMesh = useRef<THREE.InstancedMesh>(null)
  const world = useRef<THREE.Group>(null)

  /* กล้องไอโซเมตริก — ซูมให้ทั้งพวง (ยาวราว 9 กระเบื้อง) พอดีกรอบ */
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    cam.zoom = Math.min(size.width / 11.5, size.height / 8.6)
    cam.updateProjectionMatrix()
    invalidate()
  }, [camera, size, invalidate])

  useFrame(() => {
    const p = prog.current ?? 0
    /* 0–0.12 พื้นปูตัว · 0.12–0.9 ลูกศรโต · ที่เหลือค้างให้อ่าน */
    const floor = smooth(p / 0.12)
    const u = PATH[0][0] - 0.2 + smooth((p - 0.12) / 0.78) * (tipU + 0.4)
    grow.value = u

    const tm = tileMesh.current
    if (tm) {
      tiles.forEach((t, k) => {
        const kin = outBack((floor * 6 - t.d * 0.8) / 1.2)
        /* ปลายลูกศรผ่าน = กระเบื้องแถวนั้นสะดุ้งเด้ง กระเบื้องรอบรูเปลี่ยนเป็นน้ำเงิน */
        const hit = clamp01((u - t.wake) / 0.6)
        const bump = Math.sin(hit * Math.PI) * (t.blue ? 0.35 : 0.12)
        const sc = t.hole ? 0 : Math.max(1e-3, kin)
        TMP.position.set(t.i, -0.05 + bump, -t.j)
        TMP.rotation.set(0, 0, 0)
        TMP.scale.set(sc * 0.98, sc, sc * 0.98)
        TMP.updateMatrix()
        tm.setMatrixAt(k, TMP.matrix)
        C_TMP.copy(C_WHITE).lerp(C_BLUE, t.blue ? smooth(hit * 2) : 0)
        tm.setColorAt(k, C_TMP)
      })
      tm.instanceMatrix.needsUpdate = true
      if (tm.instanceColor) tm.instanceColor.needsUpdate = true
    }
    const cm = cubeMesh.current
    if (cm) {
      cubes.forEach((c, k) => {
        const k0 = clamp01((u - c.wake) / 0.9)
        const ki = outBack(k0)
        TMP.position.set(c.x, -0.3 + (c.y + 0.3) * ki, -c.z)
        TMP.rotation.set(0, c.spin * k0, 0)
        TMP.scale.setScalar(Math.max(1e-3, c.s * smooth(k0 * 2)))
        TMP.updateMatrix()
        cm.setMatrixAt(k, TMP.matrix)
      })
      cm.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={world} position={[-0.9, -1.6, 4.4]}>
      {/* ลูกศร: แกนท้องถิ่น x = ตามพื้น → หมุนให้ชี้ -z (ขึ้นขวาบนจอไอโซ) */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={assets.geo} material={[assets.cap, assets.sideM]} />
        <lineSegments geometry={assets.edges} material={assets.lineM} />
      </group>
      <instancedMesh ref={tileMesh} args={[assets.tileGeo, assets.boxM, tiles.length]} />
      <instancedMesh ref={cubeMesh} args={[assets.cubeGeo, assets.boxM, cubes.length]} />
    </group>
  )
}

/** ปลุกแคนวาสเมื่อระยะเลื่อนเปลี่ยน (frameloop demand) */
function Waker({ wake }: { wake: React.RefObject<() => void> }) {
  const { invalidate } = useThree()
  useEffect(() => {
    wake.current = () => invalidate()
  }, [wake, invalidate])
  return null
}

export function GrowStory({ id }: { id?: string }) {
  const root = useRef<HTMLElement>(null)
  const prog = useRef(0)
  const wake = useRef<() => void>(() => {})
  const [near, setNear] = useState(false)
  const [step, setStep] = useState(-1)

  useEffect(() => {
    const el = root.current
    if (!el) return
    let raf = 0
    let wasNear = false
    let wasStep = -2
    const read = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const isNear = r.top < vh * 1.2 && r.bottom > -vh * 0.2
      if (isNear !== wasNear) setNear((wasNear = isNear))
      const p = clamp01(-r.top / Math.max(1, r.height - vh))
      prog.current = p
      /* ท่อนที่ปลายลูกศรอยู่ตอนนี้ — ข้อความซ้ายตาม */
      const u = PATH[0][0] - 0.2 + smooth((p - 0.12) / 0.78) * (tipU + 0.4)
      const s = p < 0.12 ? -1 : STEP_END.findIndex((e) => u <= e)
      const st = s === -1 && p >= 0.12 ? STEPS.length - 1 : s
      if (st !== wasStep) setStep((wasStep = st))
      wake.current()
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
    }
  }, [])

  return (
    <section ref={root} id={id} className="relative w-full bg-white" style={{ height: '520svh' }}>
      <div className="sticky top-0 flex h-svh w-full flex-col overflow-hidden md:flex-row">
        <div className="relative z-10 flex flex-col justify-center gap-8 px-6 pt-24 md:w-[44%] md:pl-[clamp(24px,7vw,120px)] md:pt-0">
          <h2 className="text-[clamp(44px,6.4vw,104px)] font-normal leading-[1.02] tracking-[-0.02em] text-[#101114]">What I do</h2>
          <ol className="flex flex-col gap-5">
            {STEPS.map((s, i) => {
              const on = i === step
              return (
                <li key={s.title} className="transition-opacity duration-500" style={{ opacity: on ? 1 : i < step ? 0.45 : 0.2 }}>
                  <div className="flex items-center gap-3 text-[clamp(20px,2vw,30px)] text-[#101114]">
                    <span className="inline-block size-3 rounded-[3px] border border-[#101114]" style={{ background: on || i < step ? s.color : 'transparent' }} />
                    {s.title}
                  </div>
                  {/* Research ยังไม่มีคำอธิบายจริง — ไม่แสดงข้อความแทนที่ */}
                  {s.title !== 'Research' && (
                    <p
                      className="ml-6 max-w-[34ch] overflow-hidden text-[clamp(14px,1.1vw,17px)] leading-snug text-[#3a3d45] transition-[max-height,opacity] duration-500"
                      style={{ maxHeight: on ? 80 : 0, opacity: on ? 1 : 0 }}
                    >
                      {s.desc}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
          <a
            href="#works"
            className="w-fit cursor-pointer px-12 py-5 text-[clamp(15px,1.2vw,18px)] text-white transition-opacity hover:opacity-90"
            style={{ background: BLUE }}
          >
            See my works
          </a>
        </div>
        <div className="relative min-h-0 flex-1">
          <Canvas
            className="!absolute inset-0"
            orthographic
            flat
            frameloop={near ? 'demand' : 'never'}
            dpr={[1, 2]}
            camera={{ position: [20, 16.3, 20], zoom: 80, near: 0.1, far: 200 }}
            gl={{ antialias: true, alpha: true }}
            onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
          >
            <Waker wake={wake} />
            <Scene prog={prog} />
          </Canvas>
        </div>
      </div>
    </section>
  )
}
