import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { gradientTexture } from './utils'

/** พารามิเตอร์เนินหน้า — ใช้ร่วมกับ hillY() เพื่อวางของให้ติดผิวเนินพอดี */
export const FRONT_HILL = { R: 10, sx: 1.15, sy: 0.7, cy: -7.0, cz: 0 }

const smoothstep = (a, b, t) => {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

/** ความสูงผิวเนินหน้า ณ ตำแหน่ง (x, z) — ยอดเนินอยู่ที่ y = 0 พอดี */
export function hillY(x, z) {
  const { R, sx, sy, cy, cz } = FRONT_HILL
  const u = x / (sx * R)
  const v = (z - cz) / R
  const k = 1 - u * u - v * v
  return k <= 0 ? -Infinity : cy + sy * R * Math.sqrt(k)
}

export function Terrain() {
  // บีบ stop ไว้ช่วง 0.22-0.78 เพราะกล้องเห็นเฉพาะด้านหน้าของทรงกลม
  const rainbow = useMemo(
    () =>
      gradientTexture(
        [
          [0, '#7440CC'],
          [0.26, '#9A5BEA'],
          [0.36, '#EA4E97'],
          [0.46, '#F56A4C'],
          [0.55, '#F5AC30'],
          [0.64, '#9ED055'],
          [0.74, '#43B074'],
          [1, '#31915C'],
        ],
        { vertical: false, size: 512 },
      ),
    [],
  )

  return (
    <group>
      {/* เนินไกลสุด */}
      <Hill position={[-12, -5.2, -19]} radius={10} color="#F0C9A2" scale={[1.6, 0.62, 1]} />
      <Hill position={[11, -5.4, -18]} radius={10.5} color="#F3D3AE" scale={[1.5, 0.6, 1]} />

      {/* เนินกลาง */}
      <Hill position={[0.5, -5.6, -13.5]} radius={9} color="#EDC29B" scale={[1.9, 0.66, 1]} />

      {/* เนินหน้า — ยอดอยู่ y=0 ตัวละครยืนตรงนี้ */}
      <FrontDome map={rainbow} />
      <SandDent map={rainbow} />
    </group>
  )
}

/**
 * รอยเท้ายุบบนทราย
 *
 * ตำแหน่งเท้า (world) วัดจาก bbox ของพื้นรองเท้าในฉากจริง — mascot ยืนนิ่งอยู่กับที่
 * ถ้าขยับ mascot/แก้ความยาวขา ต้องวัดใหม่
 */
const FEET = [
  { x: 0.382, z: 1.021, yaw: 2.522 },
  { x: -0.379, z: 0.768, yaw: 3.122 },
]
// รัศมีรอย = "ครึ่งหนึ่ง" ของพื้นรองเท้าจริง (world 0.35 x 0.52) ไม่ใช่ขนาดเต็ม
// และบิดตามมุมที่ขากางออก — ยุบเฉพาะใต้ฝ่าเท้า ไม่เลยออกไปเป็นวงคลื่น
// depth = ระยะที่ฝ่าเท้าจมต่ำกว่าผิวเนินจริง ๆ (พื้นรองเท้าอยู่ y -0.076, ผิวเนินตรงนั้น -0.038)
// เผื่ออีกนิดให้ก้นหลุมต่ำกว่าฝ่าเท้าเล็กน้อย — ขุดลึกกว่านี้บูทจะลอยอยู่เหนือหลุมแทนที่จะจมลงไป
const DENT = { depth: 0.05, rx: 0.19, rz: 0.28, rim: 0.012 }

/**
 * แผ่นทรายความละเอียดสูงวางทับโดมเฉพาะรอบ ๆ เท้า
 *
 * ทำไมไม่ยุบโดมตรง ๆ: โดมเป็น sphere 128x72 ระยะห่าง vertex ตรงยอด ~0.49 หน่วย
 * กว้างกว่ารอยเท้าทั้งรอย กดยังไงก็ได้เหลี่ยมไม่ได้หลุม จะเพิ่มความละเอียดทั้งใบก็เปลืองเปล่า
 * เพราะใช้จริงแค่ตรงเท้า
 *
 * แผ่นนี้ใช้สูตรผิว hillY() กับ UV เดียวกับโดมเป๊ะ ๆ นอกวงรอยเท้าจึงทับสนิทเป็นเนื้อเดียวกัน
 */
function SandDent({ map }) {
  const geo = useMemo(() => {
    const SIZE = 3
    const SEG = 72
    const cx = 0.05
    const cz = 0.9
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG)
    g.rotateX(-Math.PI / 2)
    g.translate(cx, 0, cz)

    const { R, sx } = FRONT_HILL
    const pos = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      let y = hillY(x, z)
      for (const f of FEET) {
        // เข้าสเปซของเท้า: หมุนกลับด้วยมุมกางขา แล้ววัดเป็นวงรี
        const c = Math.cos(-f.yaw)
        const s = Math.sin(-f.yaw)
        const dx = x - f.x
        const dz = z - f.z
        const r = Math.hypot((dx * c - dz * s) / DENT.rx, (dx * s + dz * c) / DENT.rz)
        // ก้นหลุมแบนเต็มพื้นรองเท้า (r < 0.8) แล้วชันขึ้นจบที่ขอบ (r = 1.25)
        // ใช้ smoothstep ไม่ใช่ gaussian — gaussian มีหางยาว รอยเลยลามออกไปเป็นวงคลื่น
        y -= DENT.depth * (1 - smoothstep(0.8, 1.25, r))
        // สันทรายนูนแคบ ๆ รอบปากหลุม เหมือนทรายถูกกดแล้วดันออกข้าง
        y += DENT.rim * Math.exp(-((r - 1.25) * (r - 1.25)) / 0.07)
      }
      // ยกพ้นผิวโดมนิดเดียวกัน z-fighting (โดมยังอยู่ข้างใต้)
      pos.setY(i, y + 0.004)
      // UV สูตรเดียวกับโดม: planar projection ในสเปซของ geometry โดม (x หารด้วย sx)
      uv.setXY(i, x / sx / (2 * R) + 0.5, z / (2 * R) + 0.5)
    }
    pos.needsUpdate = true
    uv.needsUpdate = true
    g.computeVertexNormals()
    return g
  }, [])

  useEffect(() => () => geo.dispose(), [geo])

  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial map={map} roughness={0.95} metalness={0} />
    </mesh>
  )
}

/**
 * โดมเนินหน้า — เขียน UV ใหม่เป็น planar projection (มองจากบน)
 * ให้ gradient ไล่ตามแกน X ตรง ๆ ไม่บีบเข้าขั้วแบบ UV ปกติของ sphere
 */
function FrontDome({ map }) {
  const geo = useMemo(() => {
    const { R } = FRONT_HILL
    const g = new THREE.SphereGeometry(R, 128, 72)
    const pos = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / (2 * R) + 0.5, pos.getZ(i) / (2 * R) + 0.5)
    }
    uv.needsUpdate = true
    return g
  }, [])

  return (
    <mesh
      geometry={geo}
      position={[0, FRONT_HILL.cy, FRONT_HILL.cz]}
      scale={[FRONT_HILL.sx, FRONT_HILL.sy, 1]}
      receiveShadow
    >
      <meshStandardMaterial map={map} roughness={0.95} metalness={0} />
    </mesh>
  )
}

function Hill({ position, radius, color, scale }) {
  return (
    <mesh position={position} scale={scale} receiveShadow castShadow>
      <sphereGeometry args={[radius, 48, 32]} />
      <meshStandardMaterial color={color} roughness={1} metalness={0} />
    </mesh>
  )
}
