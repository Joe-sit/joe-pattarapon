import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { BRAND_ICONS } from './brand-icons'

/**
 * สแตกที่ใช้จริง วางเป็นแป้นคีย์แคป 3D — คีย์ละหนึ่งเทคโนโลยี
 *
 * ชื่อบนคีย์มาจาก package.json ของ repo นี้ ไม่ใช่รายการที่แต่งให้ดูเยอะ
 * (Figma เป็นเครื่องมือออกแบบที่ใช้จริงกับงานนี้ จึงอยู่ในแป้นด้วย)
 *
 * ทำไมปั้นเองไม่โหลด GLB: คีย์แคปคือกล่องมุมมนที่สอบขึ้นด้านบน ปั้นจาก RoundedBoxGeometry
 * แล้วบีบ vertex ด้านบนเข้าหาแกนก็ได้ทรงตรงแล้ว — ไม่ต้องมีไฟล์โมเดลให้โหลด/ดูแลเพิ่ม
 * geometry ตัวเดียวใช้ซ้ำทุกคีย์ (แชร์ระดับโมดูล) เหลือแค่ material ที่ต่างสีกัน
 */
/**
 * ผังคีย์ตามภาพอ้างอิง: คีย์ยาวแนวลึกฝั่งซ้าย (Works) กับตรงกลาง (Resume)
 * คีย์ใหญ่ 2×2 ฝั่งขวา (Hire me) ที่เหลือเป็นคีย์ 1×1
 *
 * x/z นับเป็น "หน่วยคีย์" จากมุมซ้ายหลัง w/d = จำนวนหน่วยที่คีย์นั้นกิน
 * ไล่พิกัดตรง ๆ แบบนี้อ่านง่ายกว่าคิดเป็นแถว เพราะผังนี้คีย์คร่อมแถวกันหลายใบ
 */
type Key = {
  label: string
  x: number
  z: number
  w?: number
  d?: number
  color: string
  ink?: string
}

const KEYS: Key[] = [
  { label: 'Works', x: 0, z: 0, d: 2, color: '#292a2e', ink: '#ffffff' },
  { label: 'Figma', x: 1, z: 0, color: '#5a3bf7', ink: '#ffffff' },
  { label: 'Resume', x: 2, z: 0, d: 2, color: '#f5c33b', ink: '#292a2e' },
  { label: 'React', x: 3, z: 0, color: '#f3f5f3', ink: '#1868db' },
  { label: 'Hire me', x: 3, z: 1, w: 2, d: 2, color: '#5a3bf7', ink: '#ffffff' },
  { label: 'TypeScript', x: 1, z: 1, color: '#f3f5f3', ink: '#235f8c' },
  { label: 'three.js', x: 2, z: 2, color: '#f3f5f3', ink: '#292a2e' },
  { label: 'Vite', x: 0, z: 2, color: '#f3f5f3', ink: '#5a3bf7' },
  { label: 'GSAP', x: 1, z: 2, color: '#f3f5f3', ink: '#0d6731' },
  { label: 'r3f', x: 4, z: 0, color: '#c9302c', ink: '#ffffff' },
]

const UNIT = 1.06 // ระยะห่างจากกลางคีย์ถึงกลางคีย์
const CAP_H = 0.52

/** กล่องมุมมนที่สอบขึ้นข้างบน = ทรงคีย์แคป (ปั้นครั้งเดียวต่อขนาด แล้วใช้ร่วม) */
function capGeometry(w: number, d: number) {
  const g = new RoundedBoxGeometry(w, CAP_H, d, 4, 0.09)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    // บีบเฉพาะครึ่งบน: ยิ่งสูงยิ่งแคบ ได้ผนังสอบเหมือนคีย์จริง
    const t = Math.max(0, y / (CAP_H / 2))
    const k = 1 - 0.14 * t
    pos.setX(i, pos.getX(i) * k)
    pos.setZ(i, pos.getZ(i) * k)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

/**
 * โลโก้ที่ตัวมันเองเป็นคำอยู่แล้ว — พิมพ์ชื่อซ้ำใต้มันจะอ่านเป็นคำเดียวกันสองรอบ
 * (GSAP ของ GreenSock เป็นเวิร์ดมาร์ก ต่างจาก TypeScript ที่เป็นกล่อง TS)
 */
const WORDMARKS = new Set(['GSAP'])

/** สว่างพอจะรับหมึกสีแบรนด์ไหม — คิดจาก luminance ของสีคีย์ ไม่ใช่ไล่เช็คทีละสี */
function isLight(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62
}

/**
 * ป้ายบนหน้าคีย์ — วาดครั้งเดียวต่อคีย์ ไม่ใช่ทุกเฟรม
 * คีย์ที่ลึกกว่ากว้าง (Works/Resume) หมุนตัวอักษรให้อ่านตามแนวคีย์เหมือนคีย์บอร์ดจริง
 */
function labelTexture(label: string, color: string, ink: string, w: number, d: number) {
  const unit = 256
  const W = Math.round(unit * w)
  const H = Math.round(unit * d)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, W, H)
  const pad = unit * 0.16
  const icon = BRAND_ICONS[label]

  if (icon) {
    // โลโก้จริงจาก simple-icons — เส้นทางเดียวใน viewBox 24 หน่วย ย่อ/ขยายได้ไม่แตก
    // สีแบรนด์ใช้ได้เฉพาะบนคีย์สีอ่อน คีย์สีเข้มใช้สีตัวอักษรของคีย์นั้นแทน ไม่งั้นจมหาย
    const size = unit * (WORDMARKS.has(label) ? 0.62 : 0.42)
    ctx.save()
    ctx.translate(pad, pad)
    ctx.scale(size / 24, size / 24)
    ctx.fillStyle = isLight(color) ? icon.hex : ink
    ctx.fill(new Path2D(icon.path))
    ctx.restore()
  }

  if (icon && WORDMARKS.has(label)) {
    const tex0 = new THREE.CanvasTexture(c)
    tex0.colorSpace = THREE.SRGBColorSpace
    tex0.anisotropy = 4
    return tex0
  }

  ctx.fillStyle = ink
  ctx.font = `600 ${Math.round(unit * 0.17)}px ui-monospace, "SF Mono", Menlo, monospace`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  if (d > w) {
    // หมุน 90°: จุดเริ่มไปอยู่มุมซ้ายล่าง แล้วเขียนขึ้นตามแนวยาวของคีย์
    ctx.translate(pad, H - pad)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(label, 0, 0, H - pad * 2)
  } else {
    // ตัวหนังสือชิดมุมซ้ายบนของหน้าคีย์ แบบ legend บนคีย์แคปจริง ไม่ใช่กลางคีย์
    // มีโลโก้เมื่อไร ชื่อลงไปอยู่ใต้โลโก้ อ่านเป็นคู่เดียวกันไม่ใช่สองชิ้นชนกัน
    ctx.fillText(label, pad, icon ? pad + unit * 0.5 : pad, W - pad * 2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

type CapProps = {
  x: number
  z: number
  w: number
  d: number
  geometry: THREE.BufferGeometry
  material: THREE.Material
  faceMaterial: THREE.Material
}

/** คีย์หนึ่งอัน — ชี้เมาส์แล้วกดลง ปล่อยแล้วเด้งกลับ (damp จึงเท่ากันทุก framerate) */
function Cap({ x, z, w, d, geometry, material, faceMaterial }: CapProps) {
  const ref = useRef<THREE.Group>(null)
  const hovered = useRef(false)

  useFrame((_s, delta) => {
    const g = ref.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    g.position.y = THREE.MathUtils.damp(g.position.y, hovered.current ? -0.14 : 0, 9, dt)
  })

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    hovered.current = true
  }
  const out = () => {
    hovered.current = false
  }

  return (
    <group position={[x, 0, z]}>
      <group ref={ref} onPointerOver={over} onPointerOut={out}>
        <mesh geometry={geometry} material={material} castShadow receiveShadow />
        {/* หน้าคีย์เป็นแผ่นบางวางทับด้านบน — คมกว่าการ map ป้ายลงกล่องทั้งใบ
            (UV ของกล่องมุมมนบิดตรงมุม ตัวอักษรจะยืด) */}
        <mesh position={[0, CAP_H / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w * 0.86, d * 0.86]} />
          <primitive object={faceMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  )
}

export function StackKeys() {
  const built = useMemo(() => {
    const geos = new Map<string, THREE.BufferGeometry>()
    const mats: THREE.Material[] = []
    const faces: THREE.Material[] = []
    const caps: (CapProps & { key: string })[] = []

    // ขนาดผังทั้งหมด — ใช้จัดกลางและตัดฐานให้พอดีคีย์ ไม่ต้องมาแก้เลขตอนเพิ่มคีย์
    const cols = Math.max(...KEYS.map((k) => k.x + (k.w ?? 1)))
    const rows = Math.max(...KEYS.map((k) => k.z + (k.d ?? 1)))

    for (const k of KEYS) {
      const w = k.w ?? 1
      const d = k.d ?? 1
      const id = `${w}x${d}`
      if (!geos.has(id)) geos.set(id, capGeometry(w * UNIT - 0.1, d * UNIT - 0.1))
      const mat = new THREE.MeshPhysicalMaterial({
        color: k.color,
        roughness: 0.42,
        metalness: 0.05,
        clearcoat: 0.5,
        clearcoatRoughness: 0.35,
      })
      const faceMat = new THREE.MeshBasicMaterial({
        map: labelTexture(k.label, k.color, k.ink ?? '#292a2e', w, d),
        toneMapped: false,
      })
      mats.push(mat)
      faces.push(faceMat)
      caps.push({
        key: k.label,
        x: (k.x + w / 2 - cols / 2) * UNIT,
        z: (k.z + d / 2 - rows / 2) * UNIT,
        w: w * UNIT - 0.1,
        d: d * UNIT - 0.1,
        geometry: geos.get(id)!,
        material: mat,
        faceMaterial: faceMat,
      })
    }

    const plate = new RoundedBoxGeometry(cols * UNIT + 0.4, 0.34, rows * UNIT + 0.4, 4, 0.12)
    return { caps, geos, mats, faces, plate }
  }, [])

  // ปล่อยของบน GPU ตอนถอด component — three ไม่เก็บให้เอง
  useEffect(
    () => () => {
      built.plate.dispose()
      for (const g of built.geos.values()) g.dispose()
      for (const m of built.mats) m.dispose()
      for (const m of built.faces) {
        ;(m as THREE.MeshBasicMaterial).map?.dispose()
        m.dispose()
      }
    },
    [built],
  )

  return (
    <Canvas
      dpr={[1, 1.75]}
      shadows
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [4.6, 5.6, 6.6], fov: 30, near: 0.1, far: 60 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.35, 0.2)}
    >
      <ambientLight intensity={0.9} />
      <directionalLight
        position={[4, 8, 5]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <directionalLight position={[-5, 3, -4]} intensity={0.5} color="#ffe6cf" />
      {/* ฐานแป้น — คีย์ทั้งหมดจมอยู่ในนี้ครึ่งหนึ่ง เหมือน macropad จริง */}
      <mesh position={[0, -0.3, 0]} geometry={built.plate} receiveShadow castShadow>
        <meshPhysicalMaterial color="#d2d9d5" roughness={0.55} metalness={0.15} clearcoat={0.3} />
      </mesh>
      {built.caps.map((c) => (
        <Cap
          key={c.key}
          x={c.x}
          z={c.z}
          w={c.w}
          d={c.d}
          geometry={c.geometry}
          material={c.material}
          faceMaterial={c.faceMaterial}
        />
      ))}
    </Canvas>
  )
}
