import { useMemo } from 'react'
import * as THREE from 'three'
import { useDisposable } from '@/joespresso/scene/utils'

/**
 * แว่นขยาย — ของประดับหัวข้อ Research
 *
 * ฉากนี้ไม่มีแว่นอยู่ก่อน (ถาดสีกับสวิตช์ยืมจาก hero ได้ อันนี้ไม่มี) ปั้นจากทรงพื้นฐาน
 * สามชิ้น: วงขอบ (torus) แผ่นกระจกในวง และก้ามจับที่ต่อออกมาเป็นด้าม
 *
 * กระจกเป็นวัสดุโปร่งแสงธรรมดา ไม่ใช่ transmission จริง — ของชิ้นเท่าหัวแม่มือบนจอ
 * ค่าหักเหมองไม่เห็นอยู่ดี แต่ transmission บังคับให้ renderer วาดฉากซ้ำอีกรอบ
 */

/** สีขอบแว่น = สีส้มโลโก้ ให้ของประดับทั้งจอเป็นชุดเดียวกัน */
const RIM = '#fd5000'
const GRIP = '#2b2f3a'

export function Magnifier({ tint = RIM, ...props }) {
  const handle = useMemo(() => new THREE.CapsuleGeometry(0.13, 0.62, 6, 16), [])
  useDisposable(handle)
  return (
    <group {...props}>
      {/* วงขอบ */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.11, 18, 44]} />
        <meshStandardMaterial color={tint} roughness={0.35} metalness={0.05} />
      </mesh>
      {/* กระจก — บางและอยู่กลางวงพอดี ไม่ยื่นพ้นขอบ */}
      <mesh>
        <circleGeometry args={[0.6, 40]} />
        <meshStandardMaterial
          color="#dff0ff"
          roughness={0.12}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* ด้าม — เอียงลงล่างขวาเหมือนถือเอียง */}
      <group position={[0.5, -0.5, 0]} rotation={[0, 0, Math.PI / 4]}>
        <mesh geometry={handle} position={[0, -0.3, 0]}>
          <meshStandardMaterial color={GRIP} roughness={0.55} />
        </mesh>
        {/* ปลอกต่อระหว่างวงกับด้าม */}
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.18, 18]} />
          <meshStandardMaterial color={tint} roughness={0.35} />
        </mesh>
      </group>
    </group>
  )
}
