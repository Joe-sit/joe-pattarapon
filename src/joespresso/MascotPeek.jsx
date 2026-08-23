import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Mascot } from './scene/Mascot'

/**
 * mascot โผล่มาแอบมองจากขอบขวาของไทม์ไลน์ — "ช่วงต่อไป" ที่ยังไม่เกิด
 *
 * เป็นคนละ instance กับตัวในฉากหลักและใน MascotCard (Mascot clone GLB ต่อ instance อยู่แล้ว)
 * จึง mount พร้อมกันได้โดยไม่แย่ง scene graph กัน rig ชุดเดียวกันคุมทั้งหมด หัวหันตามเมาส์
 *
 * กล้องเยื้องไปทางขวาและหันเข้าหาตัว — ได้มุมสามส่วนสี่แบบชะโงกหน้าออกมาจากหลังขอบการ์ด
 *
 * `active` มาจาก IntersectionObserver ของหน้า: อยู่นอกจอเมื่อไร frameloop หยุดทันที
 * (ไม่ unmount — คงคอนเท็กซ์กับโมเดลที่โหลดแล้วไว้ แค่เลิกวาดเฟรม)
 */
/**
 * ท่า "แอบมอง": แขนชี้ยกขึ้นมาเกาะขอบระดับหัว ศอกงอ ส่วนหัวเอียงและหันออกมาทางคนดู
 * ค่าพวกนี้ทับ slider เฉพาะตัวนี้ (ดู poseOverride ใน Mascot) — ตัวในฉากหลักไม่กระทบ
 * เป็น object ระดับโมดูล ไม่ใช่ literal ใน JSX จะได้ไม่สร้างใหม่ทุกเฟรมจน memo ใน Mascot พัง
 */
const PEEK_POSE = {
  // แขนที่เกาะขอบ: ยกขึ้นเฉียง ๆ แล้วศอกงอพับกลับ มือจึงมาค้างระดับหัวตรงแนวขอบพอดี
  pointShoulderZ: 2.05,
  pointShoulderX: 0.1,
  pointShoulderY: 0.55,
  pointShoulderDrop: 0.02,
  pointShoulderOut: 0.06,
  pointElbowX: -0.15,
  pointElbowY: 0.45,
  pointElbowZ: -1.15,
  pointWristX: 0.35,
  pointWristY: 0.15,
  pointWristZ: -0.85,
  // อีกข้างก็ยกขึ้นเกาะขอบเหมือนกัน แต่ต่ำกว่า (คอมพ์ 12568:836 มีสองมือคว้าขอบ บน-ล่าง)
  mugShoulderX: 0.15,
  mugShoulderY: 0.3,
  mugShoulderZ: 1.75,
  mugElbowX: -0.2,
  mugElbowY: 0.3,
  mugElbowZ: -1.0,
  mugArmUp: 0.12,
  mugArmOut: 0.06,
}

const PEEK_FOLLOW = {
  // เอียงหัวชัด ๆ แล้วชะโงกออกมาทางคนดู — เมาส์ยังขยับต่อจากท่านี้ได้อีกนิดหน่อย
  headBaseYaw: 0.62,
  headBaseRoll: 0.5,
  headBasePitch: 0.14,
  headYaw: 0.26,
  headPitch: 0.14,
}

export function MascotPeek({ active = true }) {
  return (
    <Canvas
      className="absolute inset-y-0 left-0 w-[330px]"
      dpr={[1, 1.5]}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [1.85, 2.72, -1.55], fov: 34, near: 0.1, far: 40 }}
      onCreated={({ camera }) => camera.lookAt(0, 2.42, 0.75)}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, -4]} intensity={1.1} />
      <directionalLight position={[-4, 3, 2]} intensity={0.4} color="#FFDFC8" />
      <Suspense fallback={null}>
        <Mascot
          isolated
          position={[-0.36, 2.46, 0.9]}
          scale={0.72}
          rotation={[0, -0.78, 0.13]}
          facingAway
          poseOverride={PEEK_POSE}
          followOverride={PEEK_FOLLOW}
        />
      </Suspense>
    </Canvas>
  )
}
