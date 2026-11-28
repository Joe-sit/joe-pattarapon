import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Mascot } from './scene/Mascot'

/**
 * mascot "ตัวเดียวกับฉากหลัก" ในกรอบเล็ก — ใช้กับ cell ของหน้า /2026
 *
 * เป็นคนละ instance กับตัวในฉาก (Mascot clone GLB ต่อ instance อยู่แล้ว — ดู scene.clone
 * ใน Mascot.jsx) จึง mount พร้อมกันสองที่ได้โดยไม่แย่ง scene graph กัน
 * rig/slider ชุดเดียวกันคุมทั้งคู่ หัวหันตามเมาส์เหมือนกัน
 *
 * ลำตัวหันข้างไปทางขวาของเฟรม (ภาษาเดียวกับ Mona ที่ CTA ของ githubuniverse) ส่วนหัวหันกลับ
 * มามองคนดู — เห็นหน้าแบบ 3/4 ไม่ใช่ profile ตัน ๆ และไม่ใช่หน้าตรง
 *
 * กล้องจัดใกล้ให้หัวเป็นพระเอกของกรอบ ไม่มี idle (กรอบเล็ก ลมหายใจ/เหลียวมองอ่านเป็นสั่น)
 * และใช้ screenFollow — หัวคิดทิศจากกล้องของแคนวาสใบนี้ ไม่ใช่จากมุมของฉาก hero
 * ไม่มี ClayMode ในใบนี้ — โหมดปั้นของฉากหลักไม่ทำให้การ์ดนี้เป็นสีเทา
 */
/**
 * @param {{ followRef?: import('react').RefObject<HTMLElement | null> | null }} props
 */
export function MascotCard({ followRef = null }) {
  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, 1.5]}
      camera={{ position: [0.35, 2.775, -1.62], fov: 30, near: 0.1, far: 40 }}
      onCreated={({ camera }) => camera.lookAt(0, 2.6, 0.9)}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, -4]} intensity={1.1} />
      <directionalLight position={[-4, 3, 2]} intensity={0.4} color="#FFDFC8" />
      <Suspense fallback={null}>
        <Mascot
          position={[0, 2.61, 0.9]}
          scale={0.55}
          rotation={[0, 1.05, 0]}
          facingAway
          isolated
          noIdle
          armsDown
          screenFollow
          followRef={followRef}
        />
      </Suspense>
    </Canvas>
  )
}
