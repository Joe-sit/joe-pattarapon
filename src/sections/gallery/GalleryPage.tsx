import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { GalleryScene } from './GalleryScene'

/**
 * หน้า gallery — ฉาก 3D เต็มจอบนพื้นเทาอ่อน (ตามภาพอ้างอิงตัวละครนั่งหน้าผนังไอคอนแอป)
 * พื้นหลังเป็น CSS ไล่เทาจากบนลงล่าง ฉากโปร่งใสทับ
 */
export function GalleryPage() {
  return (
    <main className="relative h-svh w-full overflow-hidden" style={{ background: 'linear-gradient(#d9dade, #c9cace)' }}>
      <Canvas
        className="!absolute inset-0"
        shadows="soft"
        dpr={[1, 2]}
        camera={{ position: [0.9, 3.4, 11], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl, camera }) => {
          gl.toneMapping = THREE.NeutralToneMapping
          camera.lookAt(0.9, 3.0, 0)
        }}
      >
        <GalleryScene />
      </Canvas>
    </main>
  )
}
