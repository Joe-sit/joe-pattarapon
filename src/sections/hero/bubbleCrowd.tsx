import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import cursorSvg from '@/assets/v2/skills-cursor.svg?raw'
import pencilSvg from '@/assets/v2/skills-pencil.svg?raw'
import promptSvg from '@/assets/v2/prompt-mark.svg?raw'

/**
 * ฟองคำพูดของหัวเรื่อง แบบกรอบโครเมียม + ของเล่นอัดแน่นล้นกรอบ (ภาพอ้างอิงหน้าโปรโมโค้ด)
 *
 * กรอบ = ท่อโครเมียมเส้นเดียววิ่งตามขอบนอกของฟองในไฟล์ SVG เดิม (ตำแหน่ง/ขนาดยังตรงกับที่
 * HTML กันที่ไว้) · ของข้างในเป็นก้อนพลาสติกมันสีสด ซ้อนกันแน่นและล้นขอบกรอบด้านซ้ายบน
 * เหมือนในภาพอ้างอิง — เหรียญ/แผ่นกลมประทับไอคอนสกิลของเว็บเอง (เคอร์เซอร์ ดินสอ >_)
 * ที่เหลือเป็นของประดับ (สามเหลี่ยมหน้ายิ้ม ลูกบอลใส่หูฟัง โดนัทโครเมียม)
 *
 * พิกัดทั้งหมดเป็นพิกเซลของแคนวาสหัวเรื่อง (กล้อง orthographic) — ขนาดของอิงครึ่งความสูงฟอง
 * (`hy`) ฟองโตตามจอ ของก็โตตาม · โผล่ด้วยการเด้งทีละชิ้นตอน `live`
 */

export const CHROME = () => new THREE.MeshPhysicalMaterial({ color: '#f2f4f8', metalness: 1, roughness: 0.08, envMapIntensity: 1.6 })

/**
 * พลาสติกมันสีอิ่ม — toneMapped ปิดแบบเดียวกับ LIFE: ตัวแมปโทนของแคนวาสนี้ดึงสีสดให้ซีดเป็นพาสเทล
 * ภาพอ้างอิงเป็นสีจัด · env ลดลงนิดให้ไฮไลต์ไม่กลบสีทั้งก้อน
 */
const plastic = (p: THREE.MeshPhysicalMaterialParameters) =>
  new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.8, toneMapped: false, ...p })

/** สีไล่ในจุดยอดตามแกน y (สีเชิงเส้น) */
function gradient(geo: THREE.BufferGeometry, a: string, b: string, axis: 'x' | 'y' = 'y') {
  geo.computeBoundingBox()
  const bb = geo.boundingBox as THREE.Box3
  const ca = new THREE.Color(a)
  const cb = new THREE.Color(b)
  const pos = geo.attributes.position
  const out = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  const lo = axis === 'y' ? bb.min.y : bb.min.x
  const span = Math.max(1e-6, axis === 'y' ? bb.max.y - bb.min.y : bb.max.x - bb.min.x)
  for (let i = 0; i < pos.count; i += 1) {
    c.lerpColors(ca, cb, ((axis === 'y' ? pos.getY(i) : pos.getX(i)) - lo) / span)
    out.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(out, 3))
  return geo
}

/** ไอคอน SVG อัดนูน กว้าง `w` จัดกลาง ด้านหน้าหัน +z */
function iconGeo(svg: string, w: number, depth: number) {
  const data = new SVGLoader().parse(svg)
  const parts: THREE.BufferGeometry[] = []
  data.paths.forEach((path) => {
    const fill = path.userData?.style?.fill
    if (!fill || fill === 'none') return
    for (const s of SVGLoader.createShapes(path)) {
      const g = new THREE.ExtrudeGeometry(s, { depth: 10, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 0.5, bevelSegments: 2, curveSegments: 8 })
      g.deleteAttribute('uv')
      parts.push(g.index ? g.toNonIndexed() : g)
    }
  })
  const geo = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  geo.computeBoundingBox()
  const bb = geo.boundingBox as THREE.Box3
  const k = w / (bb.max.x - bb.min.x)
  geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -bb.max.z)
  /* SVG แกน y ชี้ลง — หมุนครึ่งรอบรอบแกน x (พลิก y กับ z พร้อมกัน) หน้ายังเป็นหน้า */
  geo.scale(k, -k, -depth / (bb.max.z - bb.min.z))
  geo.computeVertexNormals()
  return geo
}

/** หน้าการ์ตูน (ตาปิดยิ้ม >< กับปากเล็ก) เป็นแคนวาสโปร่ง แปะหน้าก้อน */
function faceTexture(kind: 'wink' | 'smile') {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  if (g) {
    g.strokeStyle = '#1a1030'
    g.lineWidth = 12
    g.lineCap = 'round'
    g.lineJoin = 'round'
    if (kind === 'wink') {
      g.beginPath()
      g.moveTo(70, 100)
      g.lineTo(98, 116)
      g.lineTo(70, 132)
      g.moveTo(186, 100)
      g.lineTo(158, 116)
      g.lineTo(186, 132)
      g.stroke()
    } else {
      g.beginPath()
      g.arc(90, 118, 16, Math.PI * 1.1, Math.PI * 1.9)
      g.moveTo(182, 112)
      g.arc(166, 118, 16, Math.PI * 1.1, Math.PI * 1.9)
      g.stroke()
    }
    g.beginPath()
    g.arc(128, 160, 18, Math.PI * 0.15, Math.PI * 0.85)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

type Piece = {
  obj: THREE.Object3D
  /** ตำแหน่ง/ขนาดเป็นสัดส่วนของครึ่งความสูงฟอง */
  x: number
  y: number
  z: number
  s: number
  rot: [number, number, number]
  /** ลำดับเด้งโผล่ */
  delay: number
}

function build() {
  const list: { dispose: () => void }[] = []
  const keep = <T extends { dispose: () => void }>(x: T) => (list.push(x), x)
  const chrome = keep(CHROME())
  const white = keep(plastic({ color: '#ffffff' }))
  const pieces: Piece[] = []

  /* เหรียญไล่ชมพู-ม่วง บวกขาวนูน (ซ้ายบน ล้นกรอบ) */
  {
    const g = new THREE.Group()
    const coin = keep(gradient(new THREE.CylinderGeometry(1, 1, 0.34, 64).rotateX(Math.PI / 2), '#ff4fa3', '#9b5cff', 'x'))
    g.add(new THREE.Mesh(coin, keep(plastic({ vertexColors: true }))))
    const bar = keep(new THREE.CapsuleGeometry(0.16, 0.9, 8, 16))
    const a = new THREE.Mesh(bar, white)
    a.position.z = 0.2
    const b = new THREE.Mesh(bar, white)
    b.rotation.z = Math.PI / 2
    b.position.z = 0.2
    g.add(a, b)
    pieces.push({ obj: g, x: -1.62, y: 0.62, z: 0.3, s: 0.66, rot: [0.15, 0.35, 0.1], delay: 0 })
  }
  /* แผ่นดำ ดินสอส้ม (สกิล Design) */
  {
    const g = new THREE.Group()
    const disc = keep(new THREE.CylinderGeometry(1, 1, 0.28, 64).rotateX(Math.PI / 2))
    g.add(new THREE.Mesh(disc, keep(plastic({ color: '#1c1c22', roughness: 0.35 }))))
    const icon = new THREE.Mesh(keep(iconGeo(pencilSvg, 1.15, 0.14)), keep(plastic({ color: '#fd5000' })))
    icon.position.z = 0.14
    g.add(icon)
    pieces.push({ obj: g, x: -0.62, y: 0.66, z: 0.1, s: 0.56, rot: [0.1, -0.2, 0], delay: 0.08 })
  }
  /* เหรียญเหลืองขอบหนา เคอร์เซอร์น้ำเงิน (สกิล Research) — ล้นขอบบน */
  {
    const g = new THREE.Group()
    const coin = keep(new THREE.TorusGeometry(0.78, 0.26, 24, 64))
    g.add(new THREE.Mesh(coin, keep(plastic({ color: '#ffd02b' }))))
    const face = keep(new THREE.CircleGeometry(0.8, 48))
    const f = new THREE.Mesh(face, keep(plastic({ color: '#fff7d6' })))
    f.position.z = -0.02
    g.add(f)
    const icon = new THREE.Mesh(keep(iconGeo(cursorSvg, 0.9, 0.12)), keep(plastic({ color: '#158ffc' })))
    icon.position.z = 0.06
    g.add(icon)
    pieces.push({ obj: g, x: 0.55, y: 0.82, z: -0.2, s: 0.58, rot: [0.2, -0.3, 0.15], delay: 0.16 })
  }
  /* สามเหลี่ยมมนสีชมพูหน้ายิ้มตาปิด */
  {
    const g = new THREE.Group()
    const tri = keep(gradient(new THREE.ConeGeometry(1, 0.55, 3, 1).rotateX(Math.PI / 2), '#ff5fc8', '#b04bff'))
    const m = new THREE.Mesh(tri, keep(plastic({ vertexColors: true })))
    m.rotation.z = Math.PI
    g.add(m)
    const face = new THREE.Mesh(
      keep(new THREE.PlaneGeometry(0.9, 0.9)),
      keep(new THREE.MeshBasicMaterial({ map: keep(faceTexture('wink')), transparent: true, depthWrite: false })),
    )
    face.position.set(0, 0.05, 0.3)
    g.add(face)
    pieces.push({ obj: g, x: -0.72, y: -0.3, z: 0.45, s: 0.72, rot: [0.25, 0.25, -0.2], delay: 0.24 })
  }
  /* ลูกบอลม่วงใส่หูฟังโครเมียม ตาปิดยิ้ม */
  {
    const g = new THREE.Group()
    const ball = keep(gradient(new THREE.SphereGeometry(1, 48, 32), '#8a3dff', '#e07bff'))
    g.add(new THREE.Mesh(ball, keep(plastic({ vertexColors: true }))))
    const band = new THREE.Mesh(keep(new THREE.TorusGeometry(1.12, 0.09, 12, 48, Math.PI)), chrome)
    g.add(band)
    const cup = keep(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 32).rotateZ(Math.PI / 2))
    const l = new THREE.Mesh(cup, chrome)
    l.position.x = -1.08
    const r = new THREE.Mesh(cup, chrome)
    r.position.x = 1.08
    g.add(l, r)
    const face = new THREE.Mesh(
      keep(new THREE.PlaneGeometry(1.1, 1.1)),
      keep(new THREE.MeshBasicMaterial({ map: keep(faceTexture('smile')), transparent: true, depthWrite: false })),
    )
    face.position.z = 1.01
    g.add(face)
    pieces.push({ obj: g, x: 0.3, y: 0.05, z: 0.35, s: 0.46, rot: [0.1, -0.15, 0.08], delay: 0.32 })
  }
  /* โดนัทโครเมียม */
  {
    const d = new THREE.Mesh(keep(new THREE.TorusGeometry(0.8, 0.42, 32, 64)), chrome)
    pieces.push({ obj: d, x: 0.3, y: -0.6, z: 0.55, s: 0.46, rot: [0.5, 0.4, 0], delay: 0.4 })
  }
  /* เหรียญเหลือง >_ แดง (สกิล Coding) มุมขวา */
  {
    const g = new THREE.Group()
    const coin = keep(gradient(new THREE.CylinderGeometry(1, 1, 0.3, 64).rotateX(Math.PI / 2), '#ffb400', '#ffe066'))
    g.add(new THREE.Mesh(coin, keep(plastic({ vertexColors: true }))))
    const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.62, 0.1, 16, 48)), keep(plastic({ color: '#ffffff' })))
    ring.position.z = 0.16
    g.add(ring)
    const icon = new THREE.Mesh(keep(iconGeo(promptSvg, 0.7, 0.12)), keep(plastic({ color: '#ff3b3b' })))
    icon.position.z = 0.16
    g.add(icon)
    pieces.push({ obj: g, x: 1.2, y: -0.4, z: 0.2, s: 0.46, rot: [0.1, -0.45, 0], delay: 0.48 })
  }
  /* ครึ่งทรงกลมเหลือง-ขาว (ซ้ายล่าง) */
  {
    const g = new THREE.Group()
    const top = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2)), keep(plastic({ color: '#ffd02b' })))
    const bot = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), white)
    g.add(top, bot)
    pieces.push({ obj: g, x: -1.55, y: -0.42, z: 0.05, s: 0.46, rot: [0.5, 0.3, -0.5], delay: 0.2 })
  }
  return { pieces, dispose: () => list.forEach((x) => x.dispose()) }
}

const outBack = (x: number, k = 2.2) => 1 + (k + 1) * (x - 1) ** 3 + k * (x - 1) ** 2
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/**
 * ของเล่นในฟอง — `cx cy` ใจกลางฟอง (พิกเซลแคนวาส) `hy` ครึ่งความสูง `live` = ถึงคิวโชว์
 */
export function BubbleCrowd({ cx, cy, hy, live }: { cx: number; cy: number; hy: number; live: boolean }) {
  const made = useMemo(() => build(), [])
  useEffect(() => () => made.dispose(), [made])
  const refs = useRef<(THREE.Group | null)[]>([])
  const since = useRef(-1)
  useFrame(({ clock, invalidate }) => {
    const t = clock.elapsedTime
    if (live && since.current < 0) since.current = t
    if (!live) since.current = -1
    const k = since.current < 0 ? 0 : t - since.current
    /* ตำแหน่ง x คิดเป็นหน่วย hy เหมือนแกน y (ฟองกว้างราวสองเท่าของสูง ขอบซ้าย/ขวาอยู่ที่ ±hx) */
    made.pieces.forEach((pc, i) => {
      const g = refs.current[i]
      if (!g) return
      const e = clamp01((k - pc.delay) / 0.55)
      g.visible = e > 0
      const sc = Math.max(1e-4, outBack(e)) * pc.s * hy
      g.scale.setScalar(sc)
      g.position.set(cx + pc.x * hy, cy + pc.y * hy + Math.sin(t * 1.1 + i) * hy * 0.025, pc.z * hy)
      g.rotation.set(pc.rot[0] + Math.sin(t * 0.7 + i) * 0.08, pc.rot[1] + Math.sin(t * 0.5 + i * 1.7) * 0.12 + (1 - e) * 2, pc.rot[2])
    })
    if (live) invalidate()
  })
  return (
    <>
      {made.pieces.map((pc, i) => (
        <group
          key={i}
          ref={(g) => {
            refs.current[i] = g
          }}
          visible={false}
        >
          <primitive object={pc.obj} />
        </group>
      ))}
    </>
  )
}

/** กรอบฟองเป็นท่อโครเมียมตามขอบนอกของรูป (จุดในพิกัด SVG) */
export function chromeOutline(points: THREE.Vector2[], radius: number) {
  const pts = points.map((p) => new THREE.Vector3(p.x, p.y, 0))
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5)
  return new THREE.TubeGeometry(curve, Math.max(200, pts.length * 3), radius, 16, true)
}
