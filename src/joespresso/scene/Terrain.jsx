import { useMemo } from 'react'
import * as THREE from 'three'
import { gradientTexture } from './utils'

/** พารามิเตอร์เนินหน้า — ใช้ร่วมกับ hillY() เพื่อวางของให้ติดผิวเนินพอดี */
export const FRONT_HILL = { R: 10, sx: 1.18, sy: 0.62, cy: -6.2, cz: 0 }

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
    </group>
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
