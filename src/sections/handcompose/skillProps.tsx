import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

/**
 * ของที่สื่อถึงสกิล — ฉากจบของ what-i-do (ฉากถูกห่อเข้ากรอบ portal) ของประดับเดิมหายไป
 * แล้วของชุดนี้พุ่งออกมาจากจอ CRT ไปวางรอบมือ บางชิ้นล้นขอบกรอบออกมา (แบบภาพอ้างอิง)
 *
 * Research = แว่นขยาย โพสต์อิท · Design = การ์ดสี ปากกาสไตลัส ไม้บรรทัด เทปกาว
 * Coding = ป้าย </> เฟือง · ทรงเรขาคณิตสองชิ้นเป็นของประดับ ไม่ได้แทนสกิลใด
 *
 * ปั้นในโค้ดทั้งหมด (ไม่มีโมเดลโหลด) — แต่ละชิ้นคืน group กับรายการที่ต้อง dispose
 */
type Built = { group: THREE.Group; list: { dispose: () => void }[] }

const RESEARCH = '#158ffc'
const DESIGN = '#fd5000'
const CODING = '#ad85fe'

const plastic = (color: string, p: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25, ...p })

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (g) draw(g)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function magnifier(): Built {
  const ring = new THREE.TorusGeometry(0.55, 0.13, 24, 64)
  const lens = new THREE.CircleGeometry(0.55, 64)
  const handle = new THREE.CapsuleGeometry(0.12, 0.85, 8, 20)
  const neck = new THREE.CylinderGeometry(0.1, 0.12, 0.25, 20)
  const blue = plastic(RESEARCH)
  const dark = plastic('#1f2a44', { roughness: 0.5 })
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#dff0ff',
    roughness: 0.05,
    transparent: true,
    opacity: 0.45,
    clearcoat: 1,
    depthWrite: false,
  })
  const g = new THREE.Group()
  const d = Math.SQRT1_2
  const h = new THREE.Mesh(handle, dark)
  h.position.set(d * 1.25, -d * 1.25, 0)
  h.rotation.z = Math.PI / 4
  const n = new THREE.Mesh(neck, blue)
  n.position.set(d * 0.72, -d * 0.72, 0)
  n.rotation.z = Math.PI / 4
  g.add(new THREE.Mesh(ring, blue), new THREE.Mesh(lens, glass), h, n)
  return { group: g, list: [ring, lens, handle, neck, blue, dark, glass] }
}

function stickyNotes(): Built {
  const note = new RoundedBoxGeometry(1.05, 1.05, 0.04, 2, 0.02)
  const line = new THREE.BoxGeometry(0.66, 0.05, 0.01)
  const cols = ['#ffd84a', '#ff9ec0', '#9fd4ff']
  const mats = cols.map((c) => plastic(c, { roughness: 0.7, clearcoat: 0 }))
  const ink = new THREE.MeshStandardMaterial({ color: '#2b2f3a', roughness: 0.8 })
  const g = new THREE.Group()
  mats.forEach((m, i) => {
    const s = new THREE.Mesh(note, m)
    s.position.set((2 - i) * 0.14, (2 - i) * -0.1, -i * 0.06)
    s.rotation.z = (i - 1) * 0.16
    g.add(s)
    /* บรรทัดจดบนใบหน้าสุด */
    if (i === 0)
      for (let k = 0; k < 3; k += 1) {
        const l = new THREE.Mesh(line, ink)
        l.position.set(k === 2 ? -0.13 : 0, 0.22 - k * 0.2, 0.03)
        l.scale.x = k === 2 ? 0.6 : 1
        s.add(l)
      }
  })
  return { group: g, list: [note, line, ink, ...mats] }
}

/** การ์ดสีสามใบกางเป็นพัด หมุดยึดที่มุมล่าง — หน้าการ์ดไล่สีแบบโฮโลแกรม */
function swatches(): Built {
  const card = new RoundedBoxGeometry(1.0, 1.4, 0.05, 3, 0.04)
  const face = new THREE.PlaneGeometry(0.86, 1.0)
  const pin = new THREE.CylinderGeometry(0.07, 0.07, 0.2, 20)
  pin.rotateX(Math.PI / 2)
  const white = plastic('#fbfaf6')
  const metal = plastic('#c9cdd3', { metalness: 0.9, roughness: 0.25 })
  const palettes = [
    ['#ff7a59', '#ffd166', '#fd5000'],
    ['#8ec5ff', '#c3a6ff', '#ff9ec0'],
    ['#7ef0c6', '#9fd4ff', '#fff2a8'],
  ]
  const texes = palettes.map((p) =>
    tex(256, 300, (g) => {
      const lg = g.createLinearGradient(0, 0, 256, 300)
      p.forEach((c, i) => lg.addColorStop(i / (p.length - 1), c))
      g.fillStyle = lg
      g.fillRect(0, 0, 256, 300)
      const rg = g.createRadialGradient(80, 70, 0, 80, 70, 200)
      rg.addColorStop(0, 'rgba(255,255,255,0.55)')
      rg.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = rg
      g.fillRect(0, 0, 256, 300)
    }),
  )
  const faces = texes.map((t) => new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.25, clearcoat: 0.8, iridescence: 0.6 }))
  const g = new THREE.Group()
  faces.forEach((m, i) => {
    const pivot = new THREE.Group()
    pivot.position.set(0.3, -0.55, -i * 0.07)
    pivot.rotation.z = (1 - i) * 0.32
    const c = new THREE.Mesh(card, white)
    c.position.set(-0.3, 0.55, 0)
    const f = new THREE.Mesh(face, m)
    f.position.set(-0.3, 0.64, 0.027)
    pivot.add(c, f)
    g.add(pivot)
  })
  const p = new THREE.Mesh(pin, metal)
  p.position.set(0.3, -0.55, 0)
  g.add(p)
  return { group: g, list: [card, face, pin, white, metal, ...texes, ...faces] }
}

/** ปากกาสไตลัสแบบในภาพอ้างอิง — ตัวด้ามดำเงา ช่วงจับยาง ปลายเรียว */
function stylus(): Built {
  const body = new THREE.CylinderGeometry(0.11, 0.11, 2.6, 32)
  const grip = new THREE.CylinderGeometry(0.125, 0.12, 0.8, 32)
  const cone = new THREE.CylinderGeometry(0.11, 0.02, 0.45, 32)
  const cap = new THREE.SphereGeometry(0.11, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)
  const band = new THREE.CylinderGeometry(0.115, 0.115, 0.08, 32)
  const black = plastic('#2b303b', { roughness: 0.3, clearcoat: 0.9 })
  const rubber = plastic('#1b1f28', { roughness: 0.8, clearcoat: 0 })
  const accent = plastic(DESIGN)
  const g = new THREE.Group()
  const b = new THREE.Mesh(body, black)
  const gr = new THREE.Mesh(grip, rubber)
  gr.position.y = -0.7
  const c = new THREE.Mesh(cone, black)
  c.position.y = -1.52
  const top = new THREE.Mesh(cap, black)
  top.position.y = 1.3
  const bd = new THREE.Mesh(band, accent)
  bd.position.y = 0.9
  g.add(b, gr, c, top, bd)
  return { group: g, list: [body, grip, cone, cap, band, black, rubber, accent] }
}

function ruler(): Built {
  const bar = new RoundedBoxGeometry(2.4, 0.5, 0.07, 2, 0.03)
  const face = new THREE.PlaneGeometry(2.3, 0.44)
  const t = tex(1024, 196, (g) => {
    g.fillStyle = '#ffd166'
    g.fillRect(0, 0, 1024, 196)
    g.fillStyle = '#5b3a00'
    for (let i = 0; i <= 46; i += 1) {
      const x = 22 + i * 21.3
      const h = i % 10 === 0 ? 80 : i % 5 === 0 ? 56 : 34
      g.fillRect(x, 0, 4, h)
    }
  })
  const body = plastic('#ffc233')
  const faceMat = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.4, clearcoat: 0.5 })
  const g = new THREE.Group()
  const f = new THREE.Mesh(face, faceMat)
  f.position.z = 0.037
  g.add(new THREE.Mesh(bar, body), f)
  return { group: g, list: [bar, face, t, body, faceMat] }
}

/** ป้าย </> — วงเล็บแหลมสองข้างกับขีดทับ อัดเป็นก้อนขอบมน */
function codeTag(): Built {
  const chevron = (dir: number) => {
    const s = new THREE.Shape()
    const w = 0.16
    s.moveTo(0, 0)
    s.lineTo(dir * 0.42, 0.42)
    s.lineTo(dir * (0.42 + w), 0.42 - w)
    s.lineTo(dir * w * 1.4, 0)
    s.lineTo(dir * (0.42 + w), -0.42 + w)
    s.lineTo(dir * 0.42, -0.42)
    s.closePath()
    return s
  }
  const slash = new THREE.Shape()
  slash.moveTo(-0.22, -0.5)
  slash.lineTo(-0.06, -0.5)
  slash.lineTo(0.22, 0.5)
  slash.lineTo(0.06, 0.5)
  slash.closePath()
  const opt = { depth: 0.18, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 4 }
  /* ปลายแหลมอยู่ที่จุดเริ่ม แขนกางไปทาง dir — "<" จึงกางไปขวา วางซ้าย */
  const l = new THREE.ExtrudeGeometry(chevron(1), opt)
  l.translate(-0.85, 0, 0)
  const r = new THREE.ExtrudeGeometry(chevron(-1), opt)
  r.translate(0.85, 0, 0)
  const sl = new THREE.ExtrudeGeometry(slash, opt)
  const m = plastic(CODING)
  const g = new THREE.Group()
  g.add(new THREE.Mesh(l, m), new THREE.Mesh(r, m), new THREE.Mesh(sl, m))
  g.children.forEach((c) => (c.position.z = -0.09))
  return { group: g, list: [l, r, sl, m] }
}

function gear(): Built {
  const s = new THREE.Shape()
  const teeth = 10
  for (let i = 0; i < teeth * 2; i += 1) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2
    const r = i % 2 === 0 ? 0.78 : 0.62
    const pa = [Math.cos(a0) * r, Math.sin(a0) * r]
    if (i === 0) s.moveTo(pa[0], pa[1])
    else s.lineTo(pa[0], pa[1])
    s.lineTo(Math.cos(a1) * r, Math.sin(a1) * r)
  }
  s.closePath()
  s.holes.push(new THREE.Path().absarc(0, 0, 0.24, 0, Math.PI * 2, true))
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3, curveSegments: 32 })
  geo.center()
  const m = plastic('#6f7cff')
  const g = new THREE.Group()
  g.add(new THREE.Mesh(geo, m))
  return { group: g, list: [geo, m] }
}

function tape(): Built {
  const pts = [
    new THREE.Vector2(0.36, -0.26),
    new THREE.Vector2(0.72, -0.26),
    new THREE.Vector2(0.72, 0.26),
    new THREE.Vector2(0.36, 0.26),
    new THREE.Vector2(0.36, -0.26),
  ]
  const geo = new THREE.LatheGeometry(pts, 64)
  geo.rotateX(Math.PI / 2)
  const core = new THREE.CylinderGeometry(0.36, 0.36, 0.53, 48, 1, true)
  core.rotateX(Math.PI / 2)
  const m = plastic('#ffe066', { roughness: 0.6, clearcoat: 0.2 })
  const card = new THREE.MeshStandardMaterial({ color: '#d9b98a', roughness: 0.9, side: THREE.DoubleSide })
  const g = new THREE.Group()
  g.add(new THREE.Mesh(geo, m), new THREE.Mesh(core, card))
  return { group: g, list: [geo, core, m, card] }
}

function gem(kind: 'oct' | 'tet', color: string): Built {
  const geo = kind === 'oct' ? new THREE.OctahedronGeometry(0.5) : new THREE.TetrahedronGeometry(0.55)
  const m = plastic(color, { flatShading: true, roughness: 0.5 })
  const g = new THREE.Group()
  g.add(new THREE.Mesh(geo, m))
  return { group: g, list: [geo, m] }
}

/**
 * ตำแหน่งโลก (มือชูจออยู่กลาง ~x ±1.8) · บางชิ้นยื่นเลยขอบกรอบ z หน้าใกล้กล้อง จึงทับขอบกรอบขาว
 * rot = มุมพักของชิ้น (xyz) · spin = แกนที่ส่ายช้า ๆ ตอนลอย
 */
const PROPS: { make: () => Built; pos: [number, number, number]; rot: [number, number, number]; scale: number }[] = [
  { make: swatches, pos: [3.3, 1.45, 0.8], rot: [0.1, -0.35, -0.25], scale: 1.1 },
  { make: stylus, pos: [0.4, -0.3, 2.6], rot: [0.2, 0.3, 1.25], scale: 0.95 },
  { make: magnifier, pos: [-3.4, 1.3, 0.6], rot: [0.1, 0.4, 0.2], scale: 1.0 },
  { make: stickyNotes, pos: [-4.5, -1.0, 1.4], rot: [0.05, 0.45, 0.18], scale: 1.0 },
  { make: codeTag, pos: [4.5, -0.9, 1.6], rot: [0.1, -0.5, -0.12], scale: 0.95 },
  { make: gear, pos: [-2.5, -1.25, 2.2], rot: [0.5, 0.4, 0], scale: 0.7 },
  { make: ruler, pos: [2.6, -1.35, 2.3], rot: [0.3, -0.35, 0.3], scale: 0.8 },
  { make: tape, pos: [-4.7, -1.35, 1.8], rot: [0.5, 0.6, 0], scale: 0.75 },
  { make: () => gem('oct', '#7ed957'), pos: [-1.4, 2.55, -0.4], rot: [0.3, 0.2, 0.2], scale: 0.9 },
  { make: () => gem('tet', '#5ad0a0'), pos: [4.7, 2.3, -0.2], rot: [0.4, 0.3, 0.1], scale: 0.8 },
]

const FROM = new THREE.Vector3()
const TO = new THREE.Vector3()

/**
 * `w` = ความคืบหน้าของฉากห่อเข้ากรอบ 0..1 (ผูกระยะเลื่อน ย้อนได้) · `from` = จุดกลางจอ CRT (โลก)
 * แต่ละชิ้นพุ่งออกจากจอทีละชิ้น ตามคิวในช่วงครึ่งหลังของการห่อ — เด้งเกินขนาดนิดแล้วเข้าที่
 */
export function SkillProps({ w, from }: { w: () => number; from: () => THREE.Vector3 }) {
  const built = useMemo(() => PROPS.map((p) => p.make()), [])
  useEffect(() => () => built.forEach((b) => b.list.forEach((x) => x.dispose())), [built])
  const refs = useRef<(THREE.Group | null)[]>([])

  useFrame(({ clock }) => {
    const k = w()
    const src = from()
    const t = clock.elapsedTime
    PROPS.forEach((p, i) => {
      const g = refs.current[i]
      if (!g) return
      const e = Math.min(1, Math.max(0, (k - 0.35 - i * 0.045) / 0.32))
      g.visible = e > 0
      if (!g.visible) return
      const fly = 1 - (1 - e) ** 3
      const pop = 1 + 2.4 * (e - 1) ** 3 + 1.4 * (e - 1) ** 2
      FROM.copy(src)
      TO.set(p.pos[0], p.pos[1] + Math.sin(t * 0.9 + i) * 0.08, p.pos[2])
      g.position.lerpVectors(FROM, TO, fly)
      g.scale.setScalar(Math.max(0.0001, pop * p.scale))
      g.rotation.set(
        p.rot[0] + Math.sin(t * 0.5 + i) * 0.08,
        p.rot[1] + Math.sin(t * 0.4 + i * 1.7) * 0.18 + (1 - fly) * Math.PI * 2,
        p.rot[2] + Math.sin(t * 0.6 + i) * 0.05,
      )
    })
  })

  return (
    <group>
      {built.map((b, i) => (
        <group
          key={i}
          visible={false}
          ref={(g) => {
            refs.current[i] = g
          }}
        >
          <primitive object={b.group} />
        </group>
      ))}
    </group>
  )
}
