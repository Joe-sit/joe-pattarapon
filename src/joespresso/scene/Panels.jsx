import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'
import { introState } from '../intro'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { useDisposable } from './utils'
import { Slogan } from './Slogan'

/**
 * ดัด geometry ให้ห่อรอบแกนตั้งแบบผนังทรงกระบอก (เว้าเข้าหากล้อง)
 * แบบเดียวกับ panel ในภาพ ref — ขอบซ้ายขวาโค้งเข้าหาคนดู
 */
export function bendGeometry(geo, R) {
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const a = x / R
    pos.setX(i, R * Math.sin(a))
    pos.setZ(i, R * (1 - Math.cos(a)) + z * Math.cos(a))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/**
 * ดัด geometry ให้ไปวางบน "จอโค้งใบเดียว" ที่มีจุดศูนย์กลางอยู่ที่ตาคนดู
 *
 * ต่างจาก bendGeometry ตรง *สเปซที่ดัด* ไม่ใช่สูตร:
 * bendGeometry ดัดในสเปซของแผ่นเอง แกนโค้งอยู่กลางแผ่นนั้น ๆ ผลคือแต่ละแผ่นม้วนรอบตัวเอง
 * ต่างคนต่างม้วน ไม่มีความสัมพันธ์กัน
 *
 * ตัวนี้ยุบ transform ของแผ่นลง geometry ก่อน (ทุกแผ่นมาอยู่สเปซโลกร่วมกัน) แล้วค่อยม้วน
 * รอบแกนตั้งที่ลากผ่านตาคนดู ทุกแผ่นจึงโค้งตามส่วนโค้งเดียวกัน แผ่นที่อยู่ริมจะหันเข้าหา
 * คนดูเองโดยอัตโนมัติ — curvilinear perspective แบบ Fig.128 ที่ทุกเส้นวิ่งเข้า station point
 *
 * k = 0 แบนเท่าเดิม, 1 = โค้งเต็มตามระยะจริง (ทุก vertex ห่างจากตาเท่ากันหมด)
 */
export function curveOnScreen(geo, matrix, k, eyeZ) {
  geo.applyMatrix4(matrix)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i) - eyeZ // เทียบกับตา: ของที่อยู่ข้างหน้าเป็นลบ
    const d = -z
    if (d <= 1e-3) continue
    // มุมกวาด = ความยาวส่วนโค้ง / รัศมี -> รักษาความยาวแผ่นไว้ ไม่ยืดไม่หด
    const th = x / d
    pos.setX(i, x + (d * Math.sin(th) - x) * k)
    pos.setZ(i, z + (-d * Math.cos(th) - z) * k + eyeZ)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/** matrix ของแผ่นจาก position/rotation — ใช้ยุบเข้า geometry ก่อนม้วน */
function panelMatrix(position, rotation) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(1, 1, 1),
  )
}

/** alphaMap มุมมน — plane ธรรมดาจะได้มุมโค้งแบบการ์ด UI */
function roundedAlphaTex(w, h, r) {
  const W = 512
  const H = Math.max(64, Math.round((W * h) / w))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const rp = Math.min((r / w) * W, W / 2, H / 2)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.roundRect(0, 0, W, H, rp)
  ctx.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

function CurvedPanel({
  position,
  rotation = [0, 0, 0],
  size = [3, 2],
  color = '#FFFFFF',
  opacity = 0.42,
  rows = [],
  curve = 1,
  eyeZ = 14.5,
  corner = 0.18,
}) {
  const ref = useRef()
  const hovered = useRef(false)
  const [w, h] = size

  const alpha = useMemo(() => roundedAlphaTex(w, h, corner), [w, h, corner])
  const rowKey = JSON.stringify(rows)

  // ยุบ transform ลง geometry แล้วม้วนรอบแกนที่ตาคนดู จากนั้นค่อยดึงกลับมาให้จุดหมุน
  // อยู่กลางแผ่น — hover จะได้ขยาย/ขยับรอบตัวเองเหมือนเดิม ไม่ใช่รอบตาคนดู
  const built = useMemo(() => {
    const m = panelMatrix(position, rotation)
    // ซอย x ถี่ขึ้นกว่าเดิม: ตอนนี้แผ่นเดียวกวาดส่วนโค้งกว้างกว่ามาก
    const body = curveOnScreen(new THREE.PlaneGeometry(w, h, 96, 1), m, curve, eyeZ)
    const rowGeos = rows.map((r) => {
      const g = new THREE.PlaneGeometry(r.w, r.h ?? 0.16, 48, 1)
      g.translate(r.x ?? 0, r.y, 0.03)
      return curveOnScreen(g, m, curve, eyeZ)
    })
    body.computeBoundingBox()
    const center = body.boundingBox.getCenter(new THREE.Vector3())
    body.translate(-center.x, -center.y, -center.z)
    for (const g of rowGeos) g.translate(-center.x, -center.y, -center.z)
    // ทิศเข้าหาตา — hover ให้แผ่นลอยเข้าหาคนดูตามแนวรัศมี ไม่ใช่ตามแกน z ของฉาก
    const toEye = new THREE.Vector3(0, center.y, eyeZ).sub(center).normalize()
    return { body, rowGeos, center, toEye }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, rowKey, curve, eyeZ, position[0], position[1], position[2], rotation[1]])

  useDisposable(alpha)
  useDisposable(built.body)
  useDisposable(built.rowGeos)

  useFrame((_, delta) => {
    if (!ref.current) return
    const dt = Math.min(delta, 0.05)
    const lift = hovered.current ? 0.55 : 0
    const o = ref.current
    const c = built.center
    const e = built.toEye
    o.position.x = THREE.MathUtils.damp(o.position.x, c.x + e.x * lift, 7.7, dt)
    o.position.y = THREE.MathUtils.damp(o.position.y, c.y + e.y * lift, 7.7, dt)
    o.position.z = THREE.MathUtils.damp(o.position.z, c.z + e.z * lift, 7.7, dt)
    const s = hovered.current ? 1.04 : 1
    o.scale.x = THREE.MathUtils.damp(o.scale.x, s, 7.7, dt)
    o.scale.y = THREE.MathUtils.damp(o.scale.y, s, 7.7, dt)
  })

  return (
    <group
      ref={ref}
      position={built.center}
      onPointerOver={(e) => {
        e.stopPropagation()
        hovered.current = true
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        hovered.current = false
        document.body.style.cursor = ''
      }}
    >
      <mesh geometry={built.body}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          alphaMap={alpha}
          roughness={0.35}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      {rows.map((r, i) => (
        <mesh key={i} geometry={built.rowGeos[i]}>
          <meshBasicMaterial
            color={r.color}
            transparent
            opacity={r.opacity ?? 0.95}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- toolbar สไตล์ Figma: extrusion 3D จริง ไอคอนคลิกเลือก active ได้ ---------- */

/**
 * seg = จำนวนช่วงที่ซอยด้านตรง ใส่ >1 เมื่อจะเอา geometry ไปดัดโค้งต่อ
 * (bendGeometry ขยับได้แค่ vertex ที่มีอยู่ ด้านตรงที่มีแค่หัวกับท้ายจะดัดไม่ขึ้น)
 */
function roundedRectShape(w, h, r, seg = 1) {
  const s = new THREE.Shape()
  const hw = w / 2
  const hh = h / 2
  const line = (x0, y0, x1, y1) => {
    for (let i = 1; i <= seg; i++) {
      s.lineTo(x0 + (x1 - x0) * (i / seg), y0 + (y1 - y0) * (i / seg))
    }
  }
  s.moveTo(-hw + r, -hh)
  line(-hw + r, -hh, hw - r, -hh)
  s.quadraticCurveTo(hw, -hh, hw, -hh + r)
  line(hw, -hh + r, hw, hh - r)
  s.quadraticCurveTo(hw, hh, hw - r, hh)
  line(hw - r, hh, -hw + r, hh)
  s.quadraticCurveTo(-hw, hh, -hw, hh - r)
  line(-hw, hh - r, -hw, -hh + r)
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
  return s
}

/**
 * แท่งสี่เหลี่ยมมุมมน สร้างเป็น "กริด" เอง แทน ExtrudeGeometry
 *
 * ทำไมต้องเขียนเอง: ExtrudeGeometry ใช้ earcut triangulate หน้าตัด ซึ่งลากสามเหลี่ยมยาว
 * พาดกลางรูป ไม่ใช่ตาราง พอเอาไปดัดด้วย bendGeometry (ที่ขยับเฉพาะ vertex) ผิวจริงเลย
 * กลายเป็นแผ่นแบนหลายแผ่นที่เบี่ยงออกจากเส้นโค้งอุดมคติ — ส่วนปุ่มถูกวางด้วยสูตรวงกลม
 * ตรงเป๊ะ ผลคือปุ่มลอย/จมเทียบกับผิวที่มองเห็น ยิ่งดัดโค้งมากยิ่งเพี้ยน
 *
 * กริดนี้ทุก vertex แชร์กับเพื่อนบ้าน (ไม่มี T-junction) และหนาแน่นทั้งผืน ดัดแล้วผิวจึง
 * ตรงกับสูตรเดียวกับที่ใช้วางปุ่ม
 */
function roundedSlabGeometry({ w, h, r, depth, bevel, segX = 64, segY = 10, segBevel = 3 }) {
  const hw = w / 2
  const hh = h / 2
  const hd = depth / 2
  const b = Math.max(1e-4, Math.min(bevel, hd * 0.9, hw * 0.4, hh * 0.4))

  const dims = (inset) => {
    const iw = Math.max(1e-3, hw - inset)
    const ih = Math.max(1e-3, hh - inset)
    return { hw: iw, hh: ih, rr: Math.max(0, Math.min(r - inset, iw, ih)) }
  }
  // ครึ่งความสูงของรูป ณ ตำแหน่ง x
  const halfH = (x, D) => {
    const t = Math.abs(x) - (D.hw - D.rr)
    return t <= 0 ? D.hh : D.hh - D.rr + Math.sqrt(Math.max(0, D.rr * D.rr - t * t))
  }

  const pos = []
  const idx = []
  const push = (x, y, z) => {
    pos.push(x, y, z)
    return pos.length / 3 - 1
  }
  const row = segY + 1

  /** หน้าตัด: กริดเต็มผืน + คืน index ของขอบตามลำดับเดียวกับ ring() */
  const cap = (inset, z, front) => {
    const D = dims(inset)
    const start = pos.length / 3
    for (let i = 0; i <= segX; i++) {
      const x = -D.hw + (2 * D.hw * i) / segX
      const fy = halfH(x, D)
      for (let j = 0; j <= segY; j++) push(x, -fy + (2 * fy * j) / segY, z)
    }
    for (let i = 0; i < segX; i++) {
      for (let j = 0; j < segY; j++) {
        const a = start + i * row + j
        const c = a + row
        if (front) idx.push(a, c, a + 1, c, c + 1, a + 1)
        else idx.push(a, a + 1, c, c, a + 1, c + 1)
      }
    }
    const per = []
    for (let i = 0; i <= segX; i++) per.push(start + i * row + segY)
    for (let j = segY - 1; j >= 0; j--) per.push(start + segX * row + j)
    for (let i = segX - 1; i >= 0; i--) per.push(start + i * row)
    for (let j = 1; j <= segY - 1; j++) per.push(start + j)
    return per
  }

  /** เส้นรอบรูปวงเดียว ลำดับตรงกับ per ของ cap เป๊ะ ๆ เพื่อเย็บต่อกันได้ */
  const ring = (inset, z) => {
    const D = dims(inset)
    const side = halfH(D.hw, D)
    const X = (i) => -D.hw + (2 * D.hw * i) / segX
    const out = []
    for (let i = 0; i <= segX; i++) out.push(push(X(i), halfH(X(i), D), z))
    for (let j = segY - 1; j >= 0; j--) out.push(push(D.hw, -side + (2 * side * j) / segY, z))
    for (let i = segX - 1; i >= 0; i--) out.push(push(X(i), -halfH(X(i), D), z))
    for (let j = 1; j <= segY - 1; j++) out.push(push(-D.hw, -side + (2 * side * j) / segY, z))
    return out
  }

  // ลบเหลี่ยมเป็นเสี้ยววงกลม: s=0 อยู่ที่ผิวหน้า (จม inset=b), s=segBevel อยู่ที่ขอบตรง
  const zAt = (s) => hd - b + b * Math.sin((Math.PI / 2) * (1 - s / segBevel))
  const insetAt = (s) => b * (1 - Math.cos((Math.PI / 2) * (1 - s / segBevel)))

  const rings = [cap(b, hd, true)]
  for (let s = 1; s <= segBevel; s++) rings.push(ring(insetAt(s), zAt(s)))
  for (let s = segBevel; s >= 1; s--) rings.push(ring(insetAt(s), -zAt(s)))
  rings.push(cap(b, -hd, false))

  const P = rings[0].length
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k]
    const B = rings[k + 1]
    for (let i = 0; i < P; i++) {
      const a0 = A[i]
      const a1 = A[(i + 1) % P]
      const b0 = B[i]
      const b1 = B[(i + 1) % P]
      idx.push(a0, a1, b0, a1, b1, b0)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/**
 * ไอคอนเครื่องมือเป็น SVG path (viewBox 24×24) — วาดด้วย Path2D ลง canvas แล้วใช้เป็น texture
 * แบน ๆ ไม่ extrude; Path2D อ่านไวยากรณ์ path ของ SVG ได้ตรง ๆ เลยไม่ต้องแปลงเป็น geometry
 */
const TOOL_SVG = {
  cursor: { fill: ['M5 2 L5 18 L9 14.5 L11.6 20.6 L14.2 19.4 L11.6 13.5 L16.3 13.5 Z'] },
  frame: { stroke: ['M7 4v16', 'M17 4v16', 'M4 7h16', 'M4 17h16'] },
  rect: {
    stroke: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2z'],
  },
  spline: {
    stroke: ['M6 18a12 12 0 0 1 12 -12', 'M3.6 15.6h4.8v4.8h-4.8z', 'M15.6 3.6h4.8v4.8h-4.8z'],
  },
  text: { stroke: ['M4 6h9', 'M8.5 6v13', 'M14 11h6', 'M17 11v8'] },
  comment: { stroke: ['M8 19l-4 2v-4a7 6 0 1 1 4 2z'] },
}

const iconTexCache = new Map()

function iconTexture(type) {
  if (iconTexCache.has(type)) return iconTexCache.get(type)
  const spec = TOOL_SVG[type] ?? TOOL_SVG.comment
  const SIZE = 256
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  const ctx = c.getContext('2d', { willReadFrequently: true })

  const draw = (dx = 0, dy = 0) => {
    ctx.save()
    ctx.scale(SIZE / 24, SIZE / 24)
    ctx.translate(dx, dy)
    ctx.strokeStyle = '#FFFFFF'
    ctx.fillStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const d of spec.fill ?? []) ctx.fill(new Path2D(d))
    for (const d of spec.stroke ?? []) ctx.stroke(new Path2D(d))
    ctx.restore()
  }

  // จัดกึ่งกลางจากพิกเซลจริง ไม่ใช่จาก viewBox — path ที่วาดไม่เต็มกรอบ 24×24
  // (เช่นลูกศร cursor) จะได้ไม่เยื้องไปมุมใดมุมหนึ่ง และ path ใหม่ก็ไม่ต้องมานั่งเล็งเอง
  draw()
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE)
  let x0 = SIZE
  let y0 = SIZE
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (data[(y * SIZE + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 >= x0) {
    const k = 24 / SIZE
    ctx.clearRect(0, 0, SIZE, SIZE)
    draw(((SIZE - 1 - x1 - x0) / 2) * k, ((SIZE - 1 - y1 - y0) / 2) * k)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  iconTexCache.set(type, tex)
  return tex
}

/** ไอคอนเครื่องมือ — แผ่นแบนติด texture จาก SVG path (ไม่ extrude) */
function ToolIcon({ type, size = 0.46 }) {
  const tex = useMemo(() => iconTexture(type), [type])
  return (
    // ปิด raycast — ไม่งั้นเมาส์ข้ามจากตัวปุ่มมาโดนไอคอนจะยิง pointerout/over สลับกันรัว hover กระตุก
    <mesh raycast={() => null}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        map={tex}
        transparent
        depthWrite={false}
        roughness={0.6}
        metalness={0}
      />
    </mesh>
  )
}

/**
 * ค่าทรงของ toolbar ทั้งหมดรวมไว้ที่เดียว — หน้า /joespresso/toolbar เอาไปขับด้วย leva
 * เพื่อปั้นทรงสด ๆ แล้ว copy ค่ากลับมาแปะทับตรงนี้
 */
export const TOOLBAR_DEFAULTS = {
  bodyW: 3.4,
  bodyH: 1.0,
  bodyRadius: 0.3,
  bodyDepth: 0.2,
  bodyBevel: 0.03,
  tileSize: 0.46,
  tileRadius: 0.11,
  tileDepth: 0.09,
  tileBevel: 0.015,
  tileLift: 0, // 0 = ปุ่มแนบผิวแท่ง (นับต่อจากผิวหน้า ไม่ใช่จากแกนกลาง)
  tileGap: 0.64,
  tileStart: -1.28,
  hoverScale: 1.14,
  pressDepth: 0.4, // สัดส่วนของความนูนปุ่มที่จมลงตอนกด — 1 = จมมิดหายเข้าไปในแท่ง
  bendR: 80,
  bodyColor: '#2c2c2c',
  tileColor: '#2c2c2c', // ปุ่มปกติกลืนกับแท่ง เห็นเฉพาะตัวที่เลือก แบบ toolbar ของ Figma จริง
  activeColor: '#0c8ce9',
}

/** ปุ่มเครื่องมือ — แท่นนูน extrude บนผิวโค้ง hover เด้ง คลิกเลือก */
function ToolTile({ x, type, active, onClick, R = 6, p = TOOLBAR_DEFAULTS }) {
  const ref = useRef()
  const press = useRef()
  const hovered = useRef(false)
  const pressed = useRef(false)
  const tileGeo = useMemo(
    () =>
      new THREE.ExtrudeGeometry(roundedRectShape(p.tileSize, p.tileSize, p.tileRadius), {
        depth: p.tileDepth,
        bevelEnabled: true,
        bevelSize: p.tileBevel,
        bevelThickness: p.tileBevel,
        bevelSegments: 2,
        curveSegments: 10,
      }),
    [p.tileSize, p.tileRadius, p.tileDepth, p.tileBevel],
  )
  useDisposable(tileGeo)
  const a = x / R
  // วางบนผิวหน้าของแท่ง toolbar ตาม normal ของทรงกระบอก
  // ผิวหน้าแท่งอยู่ที่ bodyDepth/2 (ExtrudeGeometry ถูก translate ให้กึ่งกลางอยู่ที่ z=0)
  // tileLift จึงนับต่อจากผิวนั้น — 0 = แนบสนิท และแนบอยู่เองแม้เปลี่ยนความหนาแท่ง
  const lift = p.bodyDepth / 2 + p.tileLift

  useFrame((_, delta) => {
    if (!ref.current) return
    // damp() คิดตามเวลาจริง — ของเดิมบวกเป็นสัดส่วนต่อเฟรม ทำให้ความเร็วคืนตัวแกว่งตาม framerate
    // และกระโดดวูบเดียวเวลาสลับ tab กลับมา (delta ก้อนใหญ่); clamp delta กันเคสนั้นอีกชั้น
    const dt = Math.min(delta, 0.05)

    // ขยายเฉพาะตอน hover — ถ้ารวม active ด้วย ปุ่มที่เลือกอยู่จะใหญ่กว่าเพื่อนค้างตลอด
    const s = hovered.current ? p.hoverScale : 1
    ref.current.scale.x = THREE.MathUtils.damp(ref.current.scale.x, s, 12, dt)
    ref.current.scale.y = THREE.MathUtils.damp(ref.current.scale.y, s, 12, dt)

    if (press.current) {
      // จมลงตามแนว normal (local z) แค่สัดส่วนหนึ่งของความนูน — ตอนนี้ปุ่มแนบผิวแท่งแล้ว
      // ถ้าจมเต็ม tileDepth ตัวปุ่มจะมุดหายเข้าไปในแท่งทั้งอัน
      const sink = p.tileDepth * p.pressDepth
      const target = pressed.current ? -sink : active ? -sink * 0.45 : 0
      press.current.position.z = THREE.MathUtils.damp(
        press.current.position.z,
        target,
        pressed.current ? 26 : 15,
        dt,
      )
    }
  })

  return (
    <group
      ref={ref}
      position={[R * Math.sin(a) - lift * Math.sin(a), 0, R * (1 - Math.cos(a)) + lift * Math.cos(a)]}
      rotation={[0, -a, 0]}
      onPointerOver={(e) => {
        e.stopPropagation()
        hovered.current = true
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        hovered.current = false
        pressed.current = false
        document.body.style.cursor = ''
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        pressed.current = true
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        pressed.current = false
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <group ref={press}>
        <mesh geometry={tileGeo}>
          <meshStandardMaterial
            color={active ? p.activeColor : p.tileColor}
            roughness={0.5}
            metalness={0}
          />
        </mesh>
        {/* ไอคอนแบน วางแนบผิวบนของปุ่ม (ผิวบน = ความนูน + ลบเหลี่ยม) เผื่อ 0.004 กัน z-fighting */}
        <group position={[0, 0, p.tileDepth + p.tileBevel + 0.004]}>
          <ToolIcon type={type} size={p.tileSize} />
        </group>
      </group>
    </group>
  )
}

const TOOLS = ['cursor', 'frame', 'rect', 'spline', 'text']

/** toolbar ลอยแบบ Figma — แท่งเข้ม extrude โค้ง + ปุ่มเครื่องมือกดได้ */
export function FigmaToolbar({ position, rotation = [0, 0, 0], R, params }) {
  const ref = useRef()
  const [active, setActive] = useState(0)
  const p = useMemo(() => ({ ...TOOLBAR_DEFAULTS, ...params }), [params])
  const bend = R ?? p.bendR

  const bodyGeo = useMemo(() => {
    const g = roundedSlabGeometry({
      w: p.bodyW,
      h: p.bodyH,
      r: p.bodyRadius,
      depth: p.bodyDepth,
      bevel: p.bodyBevel,
      segX: Math.max(16, Math.round(p.bodyW * 20)),
    })
    return bendGeometry(g, bend)
  }, [p.bodyW, p.bodyH, p.bodyRadius, p.bodyDepth, p.bodyBevel, bend])
  useDisposable(bodyGeo)

  return (
    <group ref={ref} position={position} rotation={rotation}>
      <mesh geometry={bodyGeo} castShadow>
        <meshStandardMaterial color={p.bodyColor} roughness={0.45} metalness={0} />
      </mesh>
      {TOOLS.map((t, i) => (
        <ToolTile
          key={t}
          x={p.tileStart + i * p.tileGap}
          type={t}
          active={active === i}
          onClick={() => setActive(i)}
          R={bend}
          p={p}
        />
      ))}
    </group>
  )
}

/**
 * ขับ crop tool ตามไทม์ไลน์ intro + รายงานพิกัดโลกให้คนอื่นเล็ง
 *
 * กรอบถูกวางไว้ในกลุ่มที่ถูกสเกลรอบจุดกล้อง (depth) พิกัดที่เขียนใน JSX จึงไม่ใช่พิกัดโลก
 * ใครจะเล็งกรอบนี้ (หัว mascot, แขนที่ชี้) ต้องได้ค่าที่ผ่านการแปลงแล้วเท่านั้น จึงอ่านจาก
 * matrix จริงของกลุ่มทุกเฟรม ไม่ใช่คำนวณซ้ำจากตัวเลขใน JSX
 *
 * ตัวกรอบ bake ตำแหน่งลง vertex ไปแล้ว (curveOnScreen) — ขยับด้วย position ของกลุ่มที่ครอบ
 * และย่อด้วย scale รอบ "จุดกึ่งกลางกรอบ" ไม่ใช่รอบจุดกำเนิด ไม่งั้นย่อแล้วกรอบจะไหลออกนอกจอ
 */
function CropRig({ from, children }) {
  const g = useRef()
  const centre = useMemo(() => new THREE.Vector3(...from), [from])

  /**
   * ปลายทางตอนหด = กล่องจริงของสโลแกนในฉาก
   *
   * ทั้งกรอบและสโลแกนอยู่ในสเปซเดียวกันแล้ว (ลูกของกลุ่ม panel เหมือนกัน) เลยคิดตรง ๆ ได้
   * ไม่ต้องยิงรังสีจากกล้องผ่านกล่องข้อความ DOM กลับเข้าฉากแบบเดิม ซึ่งพังทุกครั้งที่
   * ระนาบอ้างอิงหรือความโค้งของกรอบเปลี่ยน
   */
  const solveTitle = () => {
    const node = g.current
    const sl = introState.slogan
    if (!node || !sl || sl.size.x < 1e-4) return null
    let box = null
    node.traverse((o) => {
      if (!o.isMesh || box) return
      o.geometry.computeBoundingBox()
      box = o.geometry.boundingBox.getSize(new THREE.Vector3())
    })
    if (!box) return null
    // เผื่อขอบรอบบล็อก — แนวนอนมากกว่าแนวตั้งเล็กน้อยตามแบบ
    return {
      sx: (sl.size.x * 1.14) / box.x,
      sy: (sl.size.y * 1.3) / box.y,
      at: [sl.centre.x, sl.centre.y],
    }
  }

  useFrame((_, delta) => {
    const node = g.current
    if (!node) return
    const dt = Math.min(delta, 0.05)
    const move = introState.playing || introState.done ? introState.b.crop : 0
    const k = move * move * (3 - 2 * move)
    // ปลายทาง = กลางจอเมื่อมองจากกล้องท่าสุดท้าย (คิดไว้ที่ CROP_TO ในสเปซเดียวกับ from)
    TMP_A.set(
      lerp(from[0], CROP_TO[0], k),
      lerp(from[1], CROP_TO[1], k),
      lerp(from[2], CROP_TO[2], k),
    ).sub(centre)
    // บีต title: หดลงมาครอบคำว่า vision — ขนาดปลายทางคิดจากกล่องข้อความจริงบนจอ
    if (introState.b.title > 0) {
      const t = solveTitle()
      if (t) introState.title = t
    }
    const shrink = introState.title ?? null
    const kt = shrink ? easeIO(introState.b.title) : 0
    const sx = shrink ? lerp(1, shrink.sx, kt) : 1
    const sy = shrink ? lerp(1, shrink.sy, kt) : 1
    if (shrink) {
      TMP_A.x = lerp(TMP_A.x, shrink.at[0] - centre.x, kt)
      TMP_A.y = lerp(TMP_A.y, shrink.at[1] - centre.y, kt)
    }
    // ตำแหน่งของกลุ่ม = จุดที่อยากให้ "กลางกรอบ" ไปอยู่ ลบด้วยจุดกึ่งกลางที่ถูกสเกลแล้ว
    // (geometry bake จุดกึ่งกลางไว้ที่ centre ไม่ใช่ที่จุดกำเนิดของกลุ่ม)
    TMP_A.x += centre.x * (1 - sx)
    TMP_A.y += centre.y * (1 - sy)
    // หน่วงอีกชั้นให้ลื่น — ค่าบีตเป็นเส้นตรง ถ้าเอาไปใช้ตรง ๆ จะเห็นหัวท้ายแข็ง
    const a = 1 - Math.exp(-dt / 0.12)
    node.position.lerp(TMP_A, a)
    node.scale.set(
      node.scale.x + (sx - node.scale.x) * a,
      node.scale.y + (sy - node.scale.y) * a,
      1,
    )

    /**
     * ตอนกรอบหดไปครอบสโลแกน การ์ดที่ลากมาด้วยต้องจางหายไป
     *
     * ปลายทางตามแบบคือเหลือแค่กรอบรอบข้อความ ถ้าปล่อยการ์ดไว้มันจะกลายเป็นแผ่นสีทับตัวหนังสือ
     * เว้นตัวกรอบเอง (renderOrder 10) ไว้ ไม่งั้นเครื่องมือหายไปทั้งชุด
     */
    const fade = 1 - easeIO(introState.b.title)
    node.traverse((o) => {
      if (!o.isMesh || o.renderOrder === 10) return
      /**
       * ต้องโคลน material ก่อนแตะ opacity เสมอ
       *
       * โหมดปั้นสลับทุก mesh ไปใช้ material ดินเทา "ก้อนเดียวกันทั้งฉาก" — ลด opacity ตรง ๆ
       * แล้วทั้งฉากจางหายพร้อมกัน (เจอมาแล้ว: เหลือแต่หัวกับตัวหนังสือลอยอยู่บนจอเปล่า)
       * ติด keepColor ไว้ด้วย ClayMode จะได้ไม่วนกลับมาทับ material ที่โคลนไว้ทุกครึ่งวินาที
       */
      if (!o.userData.fadeOwn) {
        o.material = o.material.clone()
        o.userData.fadeOwn = true
        o.userData.keepColor = true
        o.userData.baseOpacity = o.material.opacity ?? 1
      }
      const m = o.material
      m.opacity = o.userData.baseOpacity * fade
      m.transparent = true
      o.visible = m.opacity > 0.002
    })

    if (!introState.crop) introState.crop = new THREE.Vector3()
    node.getWorldPosition(introState.crop)
    // จุดที่แขนต้องเล็งคือ "กลางกรอบ" ไม่ใช่จุดกำเนิดของกลุ่ม — บวกกลับด้วยจุดกึ่งกลางที่สเกลแล้ว
    introState.crop.add(
      TMP_B.set(centre.x * node.scale.x, centre.y * node.scale.y, centre.z)
        .applyQuaternion(node.getWorldQuaternion(TMP_Q))
        .multiplyScalar(node.parent.getWorldScale(TMP_C).x || 1),
    )
  })

  return <group ref={g}>{children}</group>
}

/** กรอบเลือก + จุดจับ 4 มุม — วางบนจอโค้งใบเดียวกับ panel */
function SelectionBox({ position, size = [4.6, 1.9], color = '#7C5CFC', curve = 1, eyeZ = 14.5, overlay = false }) {
  const [w, h] = size
  const hw = w / 2
  const hh = h / 2

  // ขอบ 4 ด้าน + จุดจับ 4 มุม ใช้ material เดียวกันหมด → หลอมเป็น geometry เดียว
  // 8 mesh = 8 draw call ทั้งที่วาดของหน้าตาเหมือนกัน
  const frame = useMemo(() => {
    const m = panelMatrix(position, [0, 0, 0])
    const mk = (pw, ph, tx, ty) => {
      const g = new THREE.PlaneGeometry(pw, ph, 64, 1)
      g.translate(tx, ty, 0)
      return curveOnScreen(g, m, curve, eyeZ)
    }
    const parts = [
      mk(w, 0.035, 0, hh),
      mk(w, 0.035, 0, -hh),
      mk(0.035, h, -hw, 0),
      mk(0.035, h, hw, 0),
      mk(0.22, 0.22, -hw, hh),
      mk(0.22, 0.22, hw, hh),
      mk(0.22, 0.22, -hw, -hh),
      mk(0.22, 0.22, hw, -hh),
    ]
    const merged = mergeGeometries(parts)
    for (const g of parts) g.dispose()
    return merged
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, hw, hh, curve, eyeZ, position[0], position[1], position[2]])
  useDisposable(frame)

  // ไม่ใส่ position ที่ group: curveOnScreen ยุบ position ลง vertex ไปแล้ว
  // (ใส่ซ้ำ = เลื่อนสองเท่า กรอบเลยหลุดออกไปจากการ์ดที่ควรครอบ)
  /**
   * overlay = วาดทับทุกอย่างเสมอ (ปิด depth test) ใช้กับกรอบที่ทำหน้าที่เป็น "เครื่องมือ"
   * ไม่ใช่วัตถุในฉาก — กรอบ crop วิ่งไปครอบคำที่อยู่หน้าสุด แต่ตัวมันลอยอยู่ลึกกว่าตัว mascot
   * ถ้าเปิด depth test ตามปกติ ครึ่งขวาของกรอบจะหายเข้าไปหลังตัวละคร
   */
  return (
    <mesh geometry={frame} renderOrder={overlay ? 10 : 0}>
      <meshBasicMaterial
        color={color}
        toneMapped={false}
        side={THREE.DoubleSide}
        depthTest={!overlay}
        depthWrite={!overlay}
      />
    </mesh>
  )
}

/** ตำแหน่งกล้องตั้งต้น — ใช้เป็นจุดศูนย์กลางในการดันชั้น panel ให้ลึกขึ้น */
const CAM0 = [0, 4.1, 14.5]

const TOOLBAR_POS = [-5.5, 0.2, -2.2]

/** ที่อยู่ตั้งต้นของ crop tool (สเปซในกลุ่ม panel) */
const CROP_FROM = [-5.0, 2.3, -3.45]
/**
 * ปลายทางกลางจอ — คิดจากรังสีกล้องท่าสุดท้าย ไม่ได้กะ
 *
 * กล้องอยู่ที่ CAM0 มองไปที่ (0, 1.9, 0) จุดบนรังสีนั้นที่ระดับความลึกเดิมของกรอบ
 * (z = -3.45 ในสเปซนี้) คือ y = 1.38 — วางตรงนี้แล้วกรอบอยู่กลางเฟรมพอดี
 */
const CROP_TO = [0, 1.38, -3.45]

/**
 * ที่อยู่ของสโลแกน — กลางบนของฉาก ช่วงฟ้าเหนือหัว mascot ที่ว่างอยู่
 * ระดับความลึกเดียวกับกรอบ crop กรอบจะได้ครอบได้พอดีโดยไม่ต้องคิดเปอร์สเปคทีฟ
 */
const SLOGAN_AT = [0, 3.15, -3.45]

const TMP_A = new THREE.Vector3()
const TMP_B = new THREE.Vector3()
const TMP_C = new THREE.Vector3()
const TMP_Q = new THREE.Quaternion()
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const lerp = (a, b, t) => a + (b - a) * t

/**
 * วาง toolbar ให้แนบ "จอโค้ง" ใบเดียวกับ panel
 *
 * toolbar เป็นวัตถุ 3D มีความหนา ใช้ curveOnScreen (ที่ยุบ transform ลง vertex) ไม่ได้ตรง ๆ
 * เพราะปุ่มถูกวางด้วยสูตรวงกลมรัศมี R แยกจาก geometry ของแท่ง
 *
 * แต่ bendGeometry ม้วนรอบแกนที่อยู่ห่างจากแผ่นไป R อยู่แล้ว — ถ้าตั้ง R = ระยะจากตาถึง toolbar
 * แล้วหันหน้าแท่งเข้าหาตา แกนม้วนจะไปตกที่ตาพอดี ผิวแท่งกับปุ่มจึงนอนอยู่บนทรงกระบอกใบเดียว
 * กับ panel โดยไม่ต้องแก้โครงข้างในเลย
 *
 * k = ความโค้งจอ (0 = แบน -> R อนันต์)
 */
function toolbarOnScreen([x, y, z], k, [ex, , ez]) {
  const dx = x - ex
  const dz = z - ez
  const dist = Math.hypot(dx, dz)
  return {
    position: [x, y, z],
    // หันหน้า (+z ของแท่ง) เข้าหาตา
    rotation: [0, Math.atan2(-dx, -dz), 0],
    R: k > 0.001 ? dist / k : 1e6,
  }
}

export function Panels() {
  // debugger: ความโค้งของ "จอ" ที่ panel ทุกใบวางอยู่ — 0 แบน, 1 โค้งเต็มตามระยะจริง
  // แกนโค้งอยู่ที่ตาคนดู ทุกใบจึงโค้งตามส่วนโค้งเดียวกัน ไม่ใช่ต่างคนต่างม้วน
  const { screenCurve } = useControls('Curve Perspective', {
    screenCurve: { value: 1.6, min: 0, max: 2.5, step: 0.05, label: 'ความโค้งจอ' },
  })
  // debugger: ดันชั้น panel ให้ลึกเข้าไปในฉาก
  // ขยายทั้งกลุ่มรอบ "จุดกล้อง" — ระยะกับขนาดโตพร้อมกัน ภาพบนจอจึงเท่าเดิมเป๊ะ
  // แต่ตัว panel ถอยไปอยู่หลังพุ่มไม้จริง ๆ พุ่มกับสันเนินเลยบังฐาน panel ให้เอง
  // 1.25 = panel ตัวหน้าสุด z -3.2 ไปอยู่ -7.5 พอดีหลังแนวพุ่ม (พุ่มอยู่ -6.2 ถึง -3.2)
  // มากกว่านี้จะเลยไปโซนหมอก (เริ่มที่ระยะ 30) สีจะซีดลงด้วย
  const { depth } = useControls('Curve Perspective', {
    depth: { value: 1.25, min: 1, max: 3.5, step: 0.05, label: 'ความลึก panel' },
  })
  return (
    <>
      <group position={CAM0} scale={depth}>
        <group position={[-CAM0[0], -CAM0[1], -CAM0[2]]}>
          {/* layer 02 — toolbar สไตล์ Figma: เครื่องมือกดเลือกได้
              R/rotation คำนวณให้แนบจอโค้งใบเดียวกับ panel (ดู toolbarOnScreen)
              bendR ใน TOOLBAR_DEFAULTS ใช้เฉพาะตอนปั้นที่ /joespresso/toolbar */}
          <FigmaToolbar {...toolbarOnScreen(TOOLBAR_POS, screenCurve, CAM0)} />
      {/* ซ้าย */}
      <CurvedPanel
        curve={screenCurve}
        eyeZ={CAM0[2]}
        position={[-5.9, 4.2, -6]}
        rotation={[0, 0.32, 0]}
        size={[2.4, 1.5]}
        color="#F2604A"
        opacity={0.92}
        rows={[{ y: 0, w: 1.2, h: 0.22, color: '#FFFFFF', opacity: 0.55 }]}
      />

      {/* ขวา */}
      <CurvedPanel
        curve={screenCurve}
        eyeZ={CAM0[2]}
        position={[5.6, 4.4, -5.4]}
        rotation={[0, -0.3, 0]}
        size={[3.6, 2.2]}
        color="#6C4BE8"
        opacity={0.88}
        rows={[
          { y: 0.6, x: -0.6, w: 1.7, h: 0.2, color: '#FFFFFF', opacity: 0.8 },
          { y: 0.2, x: -0.6, w: 1.3, h: 0.2, color: '#FFFFFF', opacity: 0.6 },
          { y: 0.6, x: 1.1, w: 0.7, h: 0.2, color: '#FFFFFF', opacity: 0.8 },
          { y: 0.2, x: 1.1, w: 0.7, h: 0.2, color: '#FFFFFF', opacity: 0.6 },
        ]}
      />
      <CurvedPanel
        curve={screenCurve}
        eyeZ={CAM0[2]}
        position={[5.4, 2.0, -3.2]}
        rotation={[0, -0.34, 0]}
        size={[3.6, 2.6]}
        color="#FFFFFF"
        opacity={0.46}
        rows={[
          { y: 0.7, x: -1.1, w: 0.3, h: 0.3, color: '#FBBF3C' },
          { y: 0.2, x: -1.1, w: 0.3, h: 0.3, color: '#EC4899' },
          { y: -0.3, x: -1.1, w: 0.3, h: 0.3, color: '#22C7B0' },
          { y: 0.7, x: 0.6, w: 2.0, h: 0.18, color: '#FFFFFF' },
          { y: 0.2, x: 0.6, w: 2.0, h: 0.18, color: '#FFFFFF' },
          { y: -0.3, x: 0.6, w: 2.0, h: 0.18, color: '#FFFFFF' },
        ]}
      />
          {/*
            กรอบ crop ไม่โค้งตามจอเหมือน panel ใบอื่น (curve = 0)
            เพราะมันต้อง "ย้ายที่" ได้ตามไทม์ไลน์ intro — curveOnScreen ดัด vertex รอบตาโดยอิง
            ตำแหน่งตอนสร้าง พอย้ายไปที่อื่นความโค้งที่ bake ไว้จะผิดที่ กรอบบิดเป็นสี่เหลี่ยมคางหมู
            (เห็นชัดตอนมันไปครอบคำว่า vision) แบนแล้วย้าย/ย่อได้ตรงตามที่คำนวณทุกกรณี
          */}
          {/* สโลแกนอยู่ในสเปซเดียวกับกรอบ crop — กรอบจึงคิดขนาด/ตำแหน่งจากกล่องของมันได้ตรง ๆ
              โดยไม่ต้องแปลงข้ามระบบพิกัด (เมื่อก่อนอ่านกล่องจาก DOM แล้วยิงรังสีกลับเข้าฉาก) */}
          <Slogan position={SLOGAN_AT} />
          <CropRig from={CROP_FROM}>
            {/* การ์ดที่ถูกกรอบเลือกอยู่ = ของชิ้นเดียวกับเครื่องมือ ต้องถูกลากไปด้วยกัน
                curve 0 เหมือนกรอบ: ทั้งคู่ย้ายที่ ความโค้งที่ bake ไว้ตอนสร้างจะผิดที่ทันที */}
            <CurvedPanel
              curve={0}
              eyeZ={CAM0[2]}
              position={[-5.0, 2.3, -3.6]}
              rotation={[0, 0.22, 0]}
              size={[3.4, 2.1]}
              color="#FFFFFF"
              opacity={0.5}
              rows={[
                { y: 0.24, w: 2.5, h: 0.5, color: '#5B4BE8', opacity: 0.9 },
                { y: -0.3, w: 2.1, h: 0.1, color: '#5B4BE8', opacity: 0.5 },
              ]}
            />
            <SelectionBox position={CROP_FROM} size={[3.7, 2.3]} curve={0} eyeZ={CAM0[2]} overlay />
          </CropRig>
        </group>
      </group>
    </>
  )
}
