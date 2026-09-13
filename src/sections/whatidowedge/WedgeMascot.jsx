import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Mascot } from '@/joespresso/scene/Mascot'

/**
 * ตัวละครกลางจอ what-i-do — ตัวเดียวกับทั้งเว็บ คนละ instance
 *
 * Mascot โคลน GLB ต่อ instance อยู่แล้ว (ดู scene.clone ใน Mascot.jsx) จึง mount พร้อมกับ
 * ตัวในฉากอื่นได้โดยไม่แย่ง scene graph กัน
 *
 * ต่างจาก MascotCard ของ /2026 ที่จัดกล้องให้ *หัว* เป็นพระเอกในกรอบเล็ก: ที่นี่ต้องเห็น
 * เต็มตัวเพราะมันยืนอยู่กลางจอโดยมีลิ่มล้อมอยู่ กล้องจึงถอยออกและเล็งต่ำลงมาที่ลำตัว
 *
 * screenFollow: หัวคิดทิศจากกล้องของแคนวาสใบนี้ ไม่ใช่จากมุมของฉาก hero — ชี้ลิ่มไหนมันจึง
 * มองตามมือ ซึ่งเป็นการตอบสนองที่ได้มาฟรีก่อนที่ระบบเปลี่ยนชุดจะมา
 *
 * ไฟล์นี้เป็น .jsx ไม่ใช่ .tsx เพราะ Mascot เขียนเป็น JSX + JSDoc ซึ่งประกาศ followRef
 * ไว้เป็น null ส่งของจริงเข้าไปจาก TS แล้ว tsc ปฏิเสธ (MascotCard ของ /2026 ก็เป็น .jsx
 * ด้วยเหตุเดียวกัน) — ตัวจอที่ห่ออยู่ยังเป็น .tsx ตามปกติ
 *
 * ไม่ปิด idle (ต่างจากกรอบเล็ก): ตัวใหญ่ขนาดนี้ถ้านิ่งสนิทจะอ่านเป็นรูปนิ่ง ไม่ใช่ตัวละคร
 */
/**
 * @param {{ followRef?: import('react').RefObject<HTMLElement | null> | null }} props
 */
export function WedgeMascot({ followRef = null }) {
  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, 1.5]}
      /* ทิศเดียวกับ MascotCard (สามส่วนจากหลัง) แต่ถอยออกไป 11 หน่วยแทน 2.5 — ใบเล็ก
         จัดให้หัวเต็มกรอบ ใบนี้ต้องเห็นเต็มตัวเพราะมีลิ่มล้อมอยู่ทั้งสามด้าน */
      camera={{ position: [-0.84, 2.75, -7], fov: 30, near: 0.1, far: 40 }}
      onCreated={({ camera }) => camera.lookAt(-1.94, 2.2, 0.9)}
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
          armsDown
          screenFollow
          followRef={followRef}
        />
      </Suspense>
    </Canvas>
  )
}
