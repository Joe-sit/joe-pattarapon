import { useMemo } from 'react'
import * as THREE from 'three'
import { gradientTexture, makeRandom } from './utils'
import { blobGeometry } from './Blob'

/** ผนังไล่สีด้านหลังทั้งฉาก + ดวงอาทิตย์ + เมฆ */
export function Sky() {
  const bg = useMemo(
    () =>
      gradientTexture([
        [0, '#FBE3C8'],
        [0.45, '#F8D3B4'],
        [1, '#F6C9A8'],
      ]),
    [],
  )

  return (
    <group>
      {/* ผนังหลัง — ไม่รับแสง จะได้สีเรียบเนียน */}
      <mesh position={[0, 4, -26]} renderOrder={-1}>
        <planeGeometry args={[90, 46]} />
        <meshBasicMaterial map={bg} toneMapped={false} />
      </mesh>

      <Sun position={[1.2, 6.2, -22]} radius={4.2} />

      <Cloud position={[-4.6, 4.4, -14]} scale={1} />
      <Cloud position={[5.2, 3.4, -12]} scale={0.78} />
      <Cloud position={[-9, 6.2, -18]} scale={0.6} />
      {/* เมฆคั่นหน้าดวงอาทิตย์ล่างแบบ ref */}
      <Cloud position={[-2.6, 3.3, -20.5]} scale={0.85} />
    </group>
  )
}

/** glow วงกลมขอบฟุ้ง — radial gradient จางออกจนใส */
function radialGlow(color) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(128, 128, 30, 128, 128, 128)
  g.addColorStop(0, `${color}CC`)
  g.addColorStop(0.55, `${color}55`)
  g.addColorStop(1, `${color}00`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Sun({ position, radius }) {
  // layer 04 — ส้มไล่เฉด สว่างบนเข้มล่าง + glow ฟุ้งละลายเข้ากับฟ้าแบบ ref
  const grad = useMemo(
    () => gradientTexture([[0, '#FFB23E'], [1, '#F07A22']]),
    [],
  )
  const glow = useMemo(() => radialGlow('#FFC97E'), [])
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.15]}>
        <planeGeometry args={[radius * 3.4, radius * 3.4]} />
        <meshBasicMaterial map={glow} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial map={grad} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** เมฆ = metaball หลอมเป็นก้อนเดียว ไม่เห็นรอยต่อ sphere */
let cloudGeoCache = null
function cloudGeo() {
  if (!cloudGeoCache) {
    const rnd = makeRandom(7)
    const blobs = [
      [0, 0, 0, 1],
      [-1.05, -0.18, 0, 0.7],
      [1.0, -0.2, 0, 0.72],
      [0.42, 0.34, 0.1, 0.66],
      [-0.5, 0.28, -0.1, 0.6],
    ].map((b) => b.map((v, i) => (i === 3 ? v * (0.92 + rnd() * 0.16) : v)))
    cloudGeoCache = blobGeometry(blobs)
  }
  return cloudGeoCache
}

function Cloud({ position, scale = 1 }) {
  const geo = useMemo(() => cloudGeo(), [])
  return (
    <mesh geometry={geo} position={position} scale={scale * 2}>
      <meshStandardMaterial color="#FFFFFF" roughness={1} metalness={0} />
    </mesh>
  )
}
