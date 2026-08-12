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

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape()
  const hw = w / 2
  const hh = h / 2
  s.moveTo(-hw + r, -hh)
  s.lineTo(hw - r, -hh)
  s.quadraticCurveTo(hw, -hh, hw, -hh + r)
  s.lineTo(hw, hh - r)
  s.quadraticCurveTo(hw, hh, hw - r, hh)
  s.lineTo(-hw + r, hh)
  s.quadraticCurveTo(-hw, hh, -hw, hh - r)
  s.lineTo(-hw, -hh + r)
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
  return s
}

const ICON_MAT = { color: '#FFFFFF', roughness: 0.6, metalness: 0 }

/** ไอคอนเครื่องมือ — extrude หนามีมิติจริง */
function ToolIcon({ type }) {
  const D = { depth: 0.05, bevelEnabled: false, curveSegments: 16 }
  if (type === 'cursor') {
    // tabler-icon-pointer: ลูกศร outline (เจาะรูตามทรงด้านใน)
    const geo = useMemo(() => {
      const s = 0.021
      const pts = [
        [4, 4], [7.9, 17.6], [10.1, 17.9], [12.2, 14.8], [17.1, 19.7],
        [19.7, 17.1], [14.8, 12.2], [17.9, 10.1], [17.6, 7.9],
      ].map(([px, py]) => [(px - 12) * s, (12 - py) * s])
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length
      const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length
      const sh = new THREE.Shape()
      pts.forEach(([px, py], i) => (i ? sh.lineTo(px, py) : sh.moveTo(px, py)))
      sh.closePath()
      const hole = new THREE.Path()
      const inner = pts.map(([px, py]) => [cx + (px - cx) * 0.55, cy + (py - cy) * 0.55]).reverse()
      inner.forEach(([px, py], i) => (i ? hole.lineTo(px, py) : hole.moveTo(px, py)))
      hole.closePath()
      sh.holes.push(hole)
      return new THREE.ExtrudeGeometry(sh, D)
    }, [])
    return (
      <mesh geometry={geo}>
        <meshStandardMaterial {...ICON_MAT} />
      </mesh>
    )
  }
  if (type === 'frame') {
    return (
      <group>
        {[
          [-0.08, 0, 0.05, 0.38],
          [0.08, 0, 0.05, 0.38],
          [0, 0.08, 0.38, 0.05],
          [0, -0.08, 0.38, 0.05],
        ].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0.018]}>
            <boxGeometry args={[w, h, 0.035]} />
            <meshStandardMaterial {...ICON_MAT} />
          </mesh>
        ))}
      </group>
    )
  }
  if (type === 'rect') {
    // สี่เหลี่ยม outline (เจาะรูตรงกลาง)
    const geo = useMemo(() => {
      const outer = roundedRectShape(0.34, 0.34, 0.05)
      outer.holes.push(roundedRectShape(0.24, 0.24, 0.03))
      return new THREE.ExtrudeGeometry(outer, D)
    }, [])
    return (
      <mesh geometry={geo}>
        <meshStandardMaterial {...ICON_MAT} />
      </mesh>
    )
  }
  if (type === 'spline') {
    // tabler-icon-vector-spline: โค้ง 1/4 วง + จุดจับจตุรัสมนหัวท้าย
    const sq = useMemo(() => {
      const outer = roundedRectShape(0.084, 0.084, 0.02)
      return new THREE.ExtrudeGeometry(outer, D)
    }, [])
    return (
      <group>
        {/* arc รัศมี 12 หน่วย svg ศูนย์กลางที่ (5,5) */}
        <mesh position={[-0.147, 0.147, 0.02]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, 0.55]}>
          <torusGeometry args={[0.252, 0.023, 8, 28, Math.PI / 2]} />
          <meshStandardMaterial {...ICON_MAT} />
        </mesh>
        <mesh geometry={sq} position={[0.147, 0.147, 0]}>
          <meshStandardMaterial {...ICON_MAT} />
        </mesh>
        <mesh geometry={sq} position={[-0.147, -0.147, 0]}>
          <meshStandardMaterial {...ICON_MAT} />
        </mesh>
      </group>
    )
  }
  if (type === 'text') {
    // tabler-icon-text-size: Tt
    const bar = (w, h) => <boxGeometry args={[w, h, 0.045]} />
    return (
      <group position={[0, 0, 0.022]}>
        {/* T ใหญ่ */}
        <mesh position={[-0.053, 0.126, 0]}>{bar(0.273, 0.042)}<meshStandardMaterial {...ICON_MAT} /></mesh>
        <mesh position={[-0.042, 0, 0]}>{bar(0.042, 0.294)}<meshStandardMaterial {...ICON_MAT} /></mesh>
        <mesh position={[-0.042, -0.147, 0]}>{bar(0.084, 0.042)}<meshStandardMaterial {...ICON_MAT} /></mesh>
        {/* t เล็ก */}
        <mesh position={[0.126, -0.011, 0]}>{bar(0.126, 0.038)}<meshStandardMaterial {...ICON_MAT} /></mesh>
        <mesh position={[0.126, -0.074, 0]}>{bar(0.038, 0.147)}<meshStandardMaterial {...ICON_MAT} /></mesh>
        <mesh position={[0.126, -0.147, 0]}>{bar(0.076, 0.038)}<meshStandardMaterial {...ICON_MAT} /></mesh>
      </group>
    )
  }
  // comment — วงคำพูด + หางแหลม
  const geo = useMemo(() => {
    const sh = new THREE.Shape()
    sh.absarc(0, 0.02, 0.17, 0, Math.PI * 2)
    const tail = new THREE.Shape()
    tail.moveTo(-0.1, -0.08)
    tail.lineTo(-0.05, -0.2)
    tail.lineTo(0.02, -0.09)
    tail.closePath()
    const g1 = new THREE.ExtrudeGeometry(sh, D)
    const g2 = new THREE.ExtrudeGeometry(tail, D)
    return [g1, g2]
  }, [])
  return (
    <group>
      <mesh geometry={geo[0]}><meshStandardMaterial {...ICON_MAT} /></mesh>
      <mesh geometry={geo[1]}><meshStandardMaterial {...ICON_MAT} /></mesh>
    </group>
  )
}

/** ปุ่มเครื่องมือ — แท่นนูน extrude บนผิวโค้ง hover เด้ง คลิกเลือก */
function ToolTile({ x, type, active, onClick, R = 6 }) {
  const ref = useRef()
  const press = useRef()
  const hovered = useRef(false)
  const pressed = useRef(false)
  const tileGeo = useMemo(
    () =>
      new THREE.ExtrudeGeometry(roundedRectShape(0.46, 0.46, 0.11), {
        depth: 0.09,
        bevelEnabled: true,
        bevelSize: 0.015,
        bevelThickness: 0.015,
        bevelSegments: 2,
        curveSegments: 10,
      }),
    [],
  )
  const a = x / R
  // วางบนผิวหน้าของแท่ง toolbar ตาม normal ของทรงกระบอก
  const lift = 0.41

  useFrame(() => {
    if (!ref.current) return
    const s = hovered.current || active ? 1.14 : 1
    ref.current.scale.x += (s - ref.current.scale.x) * 0.18
    ref.current.scale.y += (s - ref.current.scale.y) * 0.18
    if (press.current) {
      // กดจมลงตามแนว normal (local z): กดค้างจมสุด, active ค้างจมตื้น
      const target = pressed.current ? -0.09 : active ? -0.04 : 0
      const k = pressed.current ? 0.5 : 0.16
      press.current.position.z += (target - press.current.position.z) * k
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
            color={active ? '#4A8DF7' : '#8D74F7'}
            roughness={0.5}
            metalness={0}
          />
        </mesh>
        <group position={[0, 0, 0.115]}>
          <ToolIcon type={type} />
        </group>
      </group>
    </group>
  )
}

/** ตัว ˅ เล็กข้างปุ่ม — วางบนผิวแท่งด้วยสูตรทรงกระบอกเดียวกัน */
function Chevron({ x, R = 6 }) {
  const a = x / R
  const lift = 0.38
  return (
    <group
      position={[R * Math.sin(a) - lift * Math.sin(a), 0, R * (1 - Math.cos(a)) + lift * Math.cos(a)]}
      rotation={[0, -a, 0]}
    >
      <mesh position={[-0.024, 0, 0]} rotation={[0, 0, -0.75]}>
        <boxGeometry args={[0.075, 0.024, 0.024]} />
        <meshStandardMaterial color="#C9BDF7" roughness={0.6} metalness={0} />
      </mesh>
      <mesh position={[0.024, 0, 0]} rotation={[0, 0, 0.75]}>
        <boxGeometry args={[0.075, 0.024, 0.024]} />
        <meshStandardMaterial color="#C9BDF7" roughness={0.6} metalness={0} />
      </mesh>
    </group>
  )
}

const TOOLS = ['cursor', 'frame', 'rect', 'spline', 'text']

/** toolbar ลอยแบบ Figma — แท่งม่วง extrude โค้ง + ปุ่มเครื่องมือกดได้ */
function FigmaToolbar({ position, rotation = [0, 0, 0], R = 6 }) {
  const ref = useRef()
  const [active, setActive] = useState(0)
  const bodyGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedRectShape(3.4, 1.0, 0.3), {
      depth: 0.2,
      bevelEnabled: true,
      bevelSize: 0.03,
      bevelThickness: 0.03,
      bevelSegments: 3,
      curveSegments: 20,
    })
    g.translate(0, 0, -0.13)
    return bendGeometry(g, R)
  }, [R])

  return (
    <group ref={ref} position={position} rotation={rotation}>
      <mesh geometry={bodyGeo} castShadow>
        <meshStandardMaterial color="#6C4BE8" roughness={0.45} metalness={0} />
      </mesh>
      {TOOLS.map((t, i) => (
        <ToolTile
          key={t}
          x={-1.28 + i * 0.64}
          type={t}
          active={active === i}
          onClick={() => setActive(i)}
          R={R}
        />
      ))}
      {TOOLS.map((t, i) => (
        <Chevron key={`c${t}`} x={-1.28 + i * 0.64 + 0.285} R={R} />
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
      {/* layer 02 — toolbar สไตล์ Figma: เครื่องมือกดเลือกได้ */}
      <FigmaToolbar position={[-5.5, 0.2, -2.2]} rotation={[0, 0.36, 0]} R={panelR} />

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
