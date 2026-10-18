import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { RoundedBox, SoftShadows } from '@react-three/drei'
import * as THREE from 'three'
import { makeTintGlass } from '@/sections/hero/liquidGlass'
import { rrect } from '@/sections/hero/shapes'

/**
 * หน้าทดลอง (dev) — ฉากแท่นเรียงแบบ eddie.eco (รถดินปั้นบนแท่นขาวมุมมนสูงต่ำไม่เท่ากัน บางคันขาว บางคันแก้วม่วง)
 * เปลี่ยนรถเป็นฟองเดิมของเว็บ (แคปซูลแก้ว "Here is what I do") ตั้งบนแท่น
 *
 * กล้องเพอร์สเปกทีฟมุมแคบมองเฉียงลงแบบไอโซ · แท่นขาวด้าน เงานุ่ม · ฟองลอยขึ้นลงช้า ๆ คนละจังหวะ กล้องส่ายเบา ๆ
 * route กั้นด้วย import.meta.env.DEV ใน App — ดูหน้าตาให้ผ่านก่อน ค่อยเอาเข้าเรื่อง
 */

const BG = '#e9e8ee'
const TILE = 2.3
const GAP = 0.18
/** ความสูงแท่นต่อช่อง (แถว × คอลัมน์) และฟองสีไหน — 1 = แก้วม่วง · กำหนดตายตัว ไม่สุ่มทุกครั้งที่โหลด */
const GRID: [number, number][][] = [
  [[1.4, 0], [2.2, 1], [1.0, 0], [1.8, 1], [1.2, 0]],
  [[2.0, 1], [1.1, 0], [2.6, 1], [1.3, 0], [2.1, 0]],
  [[1.2, 0], [1.9, 0], [1.5, 1], [2.4, 0], [1.0, 1]],
  [[2.3, 0], [1.3, 1], [2.0, 0], [1.1, 1], [1.7, 0]],
]

/**
 * ฟองเดิมของเว็บ — แคปซูลแก้ว (ช่องค้นหา "Here is what I do" ใน ./BubbleTraveler) กล่องมนอัดขึ้นรูปสูตรเดียวกับ boxGeo
 * ตั้งบนแท่น ด้านยาวตามแนวตาราง · หน่วยฉาก: กว้าง ~2.1 สูง 0.66 หนา 0.42
 */
function bubbleGeo() {
  const hw = 1.05
  const hh = 0.33
  const thick = 0.42
  const bev = thick * 0.499
  const inset = bev * 0.5
  const g = new THREE.ExtrudeGeometry(rrect((hw - inset) * 2, (hh - inset) * 2, Math.max(0.01, hh - inset)), {
    depth: Math.max(1e-4, thick - bev * 2),
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: inset,
    bevelSegments: 8,
    curveSegments: 24,
  })
  g.translate(0, 0, bev - thick / 2)
  g.computeVertexNormals()
  return g
}

function Scene() {
  const kit = useMemo(() => {
    const bubble = bubbleGeo()
    /* แก้วชุดเดียวกับฟองเดิม (ขอบสะท้อนฝั่งไฟ เส้นขอบบาง แถบเลนส์) — ขาวขุ่นกับย้อมม่วง แทนรถขาวกับรถม่วงในภาพอ้างอิง */
    const clay = makeTintGlass('#ffffff', 0.62)
    const block = new THREE.MeshStandardMaterial({ color: '#ecebf0', roughness: 0.7, metalness: 0 })
    const glass = makeTintGlass('#8b70f6', 0.7)
    return { bubble, clay, block, glass }
  }, [])
  useEffect(
    () => () => {
      kit.bubble.dispose()
      kit.clay.dispose()
      kit.block.dispose()
      kit.glass.dispose()
    },
    [kit],
  )
  const bubbles = useRef<(THREE.Mesh | null)[]>([])
  const cells = useMemo(() => {
    const out: { x: number; z: number; h: number; purple: boolean; i: number }[] = []
    const rows = GRID.length
    const cols = GRID[0].length
    GRID.forEach((row, r) =>
      row.forEach(([h, p], c) => {
        out.push({ x: (c - (cols - 1) / 2) * (TILE + GAP), z: (r - (rows - 1) / 2) * (TILE + GAP), h, purple: p === 1, i: out.length })
      }),
    )
    return out
  }, [])

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime
    /* ฟองลอยขึ้นลงช้า ๆ คนละเฟส */
    cells.forEach((c, i) => {
      const m = bubbles.current[i]
      if (!m) return
      m.position.y = c.h + 0.36 + Math.sin(t * 0.9 + i * 1.7) * 0.05
    })
    /* กล้องส่ายเบา ๆ รอบกลางฉาก */
    /* มุมแบบภาพอ้างอิง: หันเฉียงจากหน้าตรงราว 24° (ตารางเอียงขึ้นขวา เห็นด้านหน้าแท่นกว้าง ด้านข้างแคบ) ก้มลงราว 48° เห็นผิวบนชัด */
    const yaw = 0.42 + Math.sin(t * 0.12) * 0.05
    const pitch = 0.84
    const d = 19
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d)
    camera.lookAt(0, 1.6, 0)
  })

  return (
    <>
      <SoftShadows size={28} samples={14} focus={0.6} />
      <hemisphereLight args={['#ffffff', '#d8d4e8', 2.1]} />
      {/* ไฟเติมฝั่งกล้อง — ผิวที่หันหากล้องไม่หม่นเทา */}
      <directionalLight position={[14, 8, 14]} intensity={0.9} />
      <directionalLight
        position={[-8, 16, 10]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0004}
      />
      {cells.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          <RoundedBox args={[TILE, c.h * 2, TILE]} radius={0.32} smoothness={6} position={[0, 0, 0]} material={kit.block} castShadow receiveShadow />
          {/* ฟองตั้งบนแท่นตามแนวตาราง (ไม่หันหากล้อง) — กล้องเฉียงจึงเห็นทรงเอียงแบบรถในภาพอ้างอิง */}
          <mesh
            ref={(el) => {
              bubbles.current[i] = el
            }}
            geometry={kit.bubble}
            material={c.purple ? kit.glass : kit.clay}
            rotation={[0, 0, 0]}
            castShadow
            receiveShadow
          />
        </group>
      ))}
    </>
  )
}

export default function BubbleBlocks() {
  return (
    <div className="h-screen w-full" style={{ background: BG }}>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 18, near: 1, far: 120, position: [15, 17, 15] }} gl={{ antialias: true }}>
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 30, 52]} />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}
