import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Edges, Grid, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

/**
 * ห้องสี่เหลี่ยมเปล่า — โครงไว้หาไอเดียจัดห้อง (/room)
 *
 * หน่วยเป็นเมตร · พื้นอยู่ที่ y = 0 · กลางห้องอยู่ที่ x = z = 0
 * ผนังครบ 4 ด้าน ด้านที่กล้องอยู่นอกห้องจะซ่อนเอง (cutaway แบบ The Sims) — หมุนไปมุมไหนก็มองเข้าไปเห็นในห้อง
 * ปรับขนาดห้องที่ ROOM ข้างล่าง · มีคนสูง 1.7 ม. ยืนมุมห้องไว้เทียบสเกล
 * ผนังไม่ทิ้งเงา — แดดทะลุผนังไม่มีจริง แต่ถ้าให้ทิ้ง หมุนไปบางมุมแล้วพื้นครึ่งห้องมืด ดูของในห้องไม่ออก (ของที่วางในห้องทิ้งเงาตามปกติ)
 */
const ROOM = { w: 4, d: 4, h: 2.7, wall: 0.12, floor: 0.12 }
const COLOR = { bg: '#ebe8e2', wall: '#f4f2ed', floor: '#d8c4a2', base: '#cdc7bd', edge: '#9b958b', person: '#9aa6b8' }

type Side = { key: string; pos: [number, number, number]; size: [number, number, number]; out: (c: THREE.Vector3) => boolean }

const { w, d, h, wall: t } = ROOM
const SIDES: Side[] = [
  { key: 'back', pos: [0, h / 2, -d / 2 - t / 2], size: [w + t * 2, h, t], out: (c) => c.z < -d / 2 },
  { key: 'front', pos: [0, h / 2, d / 2 + t / 2], size: [w + t * 2, h, t], out: (c) => c.z > d / 2 },
  { key: 'left', pos: [-w / 2 - t / 2, h / 2, 0], size: [t, h, d], out: (c) => c.x < -w / 2 },
  { key: 'right', pos: [w / 2 + t / 2, h / 2, 0], size: [t, h, d], out: (c) => c.x > w / 2 },
]

function Walls() {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  /* กล้องอยู่นอกผนังด้านไหน ซ่อนด้านนั้น (มองทะลุเข้าห้อง) */
  useFrame(({ camera }) => {
    SIDES.forEach((s, i) => {
      const m = refs.current[i]
      if (m) m.visible = !s.out(camera.position)
    })
  })
  return (
    <>
      {SIDES.map((s, i) => (
        <mesh
          key={s.key}
          ref={(m) => {
            refs.current[i] = m
          }}
          position={s.pos}
          receiveShadow
        >
          <boxGeometry args={s.size} />
          <meshStandardMaterial color={COLOR.wall} roughness={0.92} />
          <Edges color={COLOR.edge} />
        </mesh>
      ))}
    </>
  )
}

function Room() {
  return (
    <group>
      {/* พื้นห้อง */}
      <mesh position={[0, -ROOM.floor / 2, 0]} receiveShadow>
        <boxGeometry args={[w + t * 2, ROOM.floor, d + t * 2]} />
        <meshStandardMaterial color={COLOR.floor} roughness={0.75} />
        <Edges color={COLOR.edge} />
      </mesh>
      {/* ฐานใต้พื้น (ตัดเป็นบล็อกแบบโมเดลห้อง) */}
      <mesh position={[0, -ROOM.floor - 0.12, 0]} receiveShadow>
        <boxGeometry args={[w + t * 2, 0.24, d + t * 2]} />
        <meshStandardMaterial color={COLOR.base} roughness={0.95} />
        <Edges color={COLOR.edge} />
      </mesh>
      {/* ตารางบนพื้น: ช่อง 0.5 ม. เส้นหนาทุก 1 ม. */}
      <Grid
        position={[0, 0.002, 0]}
        args={[w, d]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#b9a786"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#a08c68"
        fadeDistance={30}
      />
      <Walls />
      {/* คนเทียบสเกล 1.7 ม. */}
      <mesh position={[-w / 2 + 0.5, 0.85, -d / 2 + 0.5]} castShadow>
        <capsuleGeometry args={[0.2, 1.3, 6, 16]} />
        <meshStandardMaterial color={COLOR.person} roughness={0.8} />
      </mesh>
    </group>
  )
}

export default function RoomPage() {
  return (
    <div className="fixed inset-0" style={{ background: COLOR.bg }}>
      <Canvas shadows frameloop="demand" dpr={[1, 2]} camera={{ fov: 35, position: [7, 6, 7], near: 0.1, far: 100 }}>
        <color attach="background" args={[COLOR.bg]} />
        <hemisphereLight args={['#ffffff', '#d6cfc3', 1.1]} />
        <directionalLight
          position={[4, 8, 3]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />
        {/* ไฟเติมฝั่งตรงข้าม — ผนังที่หันหนีแดดไม่ทึม */}
        <directionalLight position={[-5, 6, -4]} intensity={0.55} />
        <Room />
        <OrbitControls target={[0, 1, 0]} enableDamping maxPolarAngle={Math.PI * 0.47} minDistance={3} maxDistance={20} makeDefault />
      </Canvas>
      <div className="pointer-events-none absolute top-5 left-5 text-[13px] leading-relaxed text-[#5b564e]">
        <div className="font-semibold text-[#2f2c27]">
          Room {ROOM.w} × {ROOM.d} × {ROOM.h} m
        </div>
        <div>ลากหมุน · scroll ซูม · คลิกขวาลากเลื่อน</div>
      </div>
    </div>
  )
}
