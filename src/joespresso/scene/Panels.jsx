import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'

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
  R = 6,
  corner = 0.18,
}) {
  const ref = useRef()
  const hovered = useRef(false)
  const [w, h] = size

  const alpha = useMemo(() => roundedAlphaTex(w, h, corner), [w, h, corner])
  const bodyGeo = useMemo(() => bendGeometry(new THREE.PlaneGeometry(w, h, 48, 1), R), [w, h, R])
  const rowKey = JSON.stringify(rows)
  const rowGeos = useMemo(
    () =>
      rows.map((r) => {
        const g = new THREE.PlaneGeometry(r.w, r.h ?? 0.16, 24, 1)
        g.translate(r.x ?? 0, r.y, 0.03)
        return bendGeometry(g, R)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowKey, R],
  )

  useFrame(() => {
    if (!ref.current) return
    const target = hovered.current ? 0.55 : 0
    ref.current.position.z += (position[2] + target - ref.current.position.z) * 0.12
    const s = hovered.current ? 1.04 : 1
    ref.current.scale.x += (s - ref.current.scale.x) * 0.12
    ref.current.scale.y += (s - ref.current.scale.y) * 0.12
  })

  return (
    <group
      ref={ref}
      position={position}
      rotation={rotation}
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
      <mesh geometry={bodyGeo}>
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
        <mesh key={i} geometry={rowGeos[i]}>
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
  bendR: 3,
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

/** กรอบเลือก + จุดจับ 4 มุม — โค้งตามทรงกระบอกเดียวกับ panel */
function SelectionBox({ position, size = [4.6, 1.9], color = '#7C5CFC', R = 6 }) {
  const [w, h] = size
  const hw = w / 2
  const hh = h / 2

  const parts = useMemo(() => {
    const mk = (pw, ph, tx, ty) => {
      const g = new THREE.PlaneGeometry(pw, ph, 48, 1)
      g.translate(tx, ty, 0)
      return bendGeometry(g, R)
    }
    return [
      mk(w, 0.035, 0, hh),
      mk(w, 0.035, 0, -hh),
      mk(0.035, h, -hw, 0),
      mk(0.035, h, hw, 0),
      mk(0.22, 0.22, -hw, hh),
      mk(0.22, 0.22, hw, hh),
      mk(0.22, 0.22, -hw, -hh),
      mk(0.22, 0.22, hw, -hh),
    ]
  }, [w, h, hw, hh, R])

  return (
    <group position={position}>
      {parts.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial color={color} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

export function Panels() {
  // debugger: จูนรัศมีทรงกระบอกที่ใช้ดัด panel/toolbar สด ๆ (R น้อย = โค้งจัด)
  const { panelR } = useControls('Curve Perspective', {
    panelR: { value: 6, min: 2, max: 20, step: 0.5, label: 'panel bend R' },
  })
  return (
    <group>
      {/* ซ้าย */}
      <CurvedPanel
        R={panelR}
        position={[-5.9, 4.2, -6]}
        rotation={[0, 0.32, 0]}
        size={[2.4, 1.5]}
        color="#F2604A"
        opacity={0.92}
        rows={[{ y: 0, w: 1.2, h: 0.22, color: '#FFFFFF', opacity: 0.55 }]}
      />
      <CurvedPanel
        R={panelR}
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
      {/* layer 02 — toolbar สไตล์ Figma: เครื่องมือกดเลือกได้
          ไม่ส่ง R = ใช้ bendR ของตัวเองใน TOOLBAR_DEFAULTS (ปั้นที่ /joespresso/toolbar)
          ไม่งั้น panelR จะทับ แล้วค่าที่ปั้นมาไม่มีผลในฉากจริง */}
      <FigmaToolbar position={[-5.5, 0.2, -2.2]} rotation={[0, 0.36, 0]} />

      {/* ขวา */}
      <CurvedPanel
        R={panelR}
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
        R={panelR}
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
      <SelectionBox position={[-5.0, 2.3, -3.45]} size={[3.7, 2.3]} R={panelR} />
    </group>
  )
}
