import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import { scrollState, seg } from '../scroll'

/**
 * มุมทำงานของฉาก 2 — โต๊ะไม้อ่อนเรียบ ๆ + แล็ปท็อปบาง ๆ + สตูล
 *
 * ปั้นเป็นกล่องล้วนตามภาษาเดียวกับ mascot (ทั้งตัวก็กล่อง) ไม่ใช้ GLB —
 * โมเดลซื้อที่ CLAUDE.md พูดถึงยังไม่ได้อยู่ใน repo และของจริงละเอียดเกินโทนฉากนี้
 *
 * โผล่ตอน scroll เข้าฉาก 2 (บีต focus): ทั้งชุดสเกลจาก 0 เด้งขึ้นเกินนิดแล้วเข้าที่
 * ตอนฉาก 1 มองไม่เห็น — hero เล่าเรื่องชี้กรอบอยู่ ไม่ควรมีโต๊ะตั้งค้างในทราย
 */

// วัสดุแชร์ทั้ง component — สร้างครั้งเดียวที่ module ไม่สร้างใหม่ทุก re-render ของ leva
const WOOD = new THREE.MeshStandardMaterial({ color: '#e3c9a0', roughness: 0.85 })
const WOOD_LEG = new THREE.MeshStandardMaterial({ color: '#d5b98d', roughness: 0.9 })
const ALU = new THREE.MeshStandardMaterial({ color: '#cdd1d6', roughness: 0.45, metalness: 0.35 })
const SCREEN = new THREE.MeshStandardMaterial({
  color: '#22242a',
  roughness: 0.3,
  emissive: '#3a3f4d',
  emissiveIntensity: 0.55,
})
const KEYS = new THREE.MeshStandardMaterial({ color: '#9ba0a8', roughness: 0.7 })
const STOOL = new THREE.MeshStandardMaterial({ color: '#c9a97b', roughness: 0.9 })

const smooth01 = (v) => {
  const t = v < 0 ? 0 : v > 1 ? 1 : v
  return t * t * (3 - 2 * t)
}

export function WorkDesk() {
  const group = useRef()

  const c = useControls('Work Desk (ฉาก 2)', {
    // บังคับให้โผล่ค้างไว้จูนตำแหน่ง โดยไม่ต้อง scroll — 0 = ปล่อยตามบีต
    deskPreview: { value: 0, min: 0, max: 1, step: 0.01, label: 'ดูโต๊ะ (บังคับโผล่)' },
    deskX: { value: 0.42, min: -4, max: 4, step: 0.01, label: 'ตำแหน่ง X' },
    deskZ: { value: -0.7, min: -5, max: 4, step: 0.01, label: 'ตำแหน่ง Z' },
    deskRotY: { value: -0.32, min: -3.2, max: 3.2, step: 0.01, label: 'หมุนทั้งชุด' },
    deskScale: { value: 1, min: 0.4, max: 2, step: 0.01, label: 'สเกลทั้งชุด' },
    deskTopY: { value: 1.08, min: 0.6, max: 2.4, step: 0.01, label: 'ความสูงโต๊ะ' },
    stoolY: { value: 0.66, min: 0.3, max: 1.6, step: 0.01, label: 'ความสูงสตูล' },
    stoolBack: { value: 1.35, min: 0.4, max: 2.6, step: 0.01, label: 'สตูล ถอยหลัง' },
    // มุมเอนจอจากแนวตั้ง (rad) — 0 = ตั้งฉากกับโต๊ะ
    lidTilt: { value: 0.22, min: 0, max: 0.9, step: 0.01, label: 'จอเอนหลัง (rad)' },
  }, { collapsed: true })

  useFrame(() => {
    if (!group.current) return
    // เด้งเข้า: สเกลเกินเป้า ~6% กลางทางแล้วคืน — อ่านเป็น pop ไม่ใช่ fade
    const t = Math.max(smooth01(seg(scrollState.b.focus, 0.1, 0.8)), c.deskPreview)
    const pop = t * (1 + 0.06 * Math.sin(t * Math.PI))
    group.current.scale.setScalar(c.deskScale * Math.max(pop, 0.0001))
    group.current.visible = t > 0.001
  })

  const topY = c.deskTopY
  // ฐานแล็ปท็อปวางบนหน้าโต๊ะ จอพับกางที่บานพับหลังฐาน
  return (
    <group position={[c.deskX, 0, c.deskZ]} rotation={[0, c.deskRotY, 0]}>
      <group ref={group} visible={false}>
        {/* หน้าโต๊ะ */}
        <mesh position={[0, topY, 0]} castShadow receiveShadow material={WOOD}>
          <boxGeometry args={[2.5, 0.09, 1.15]} />
        </mesh>
        {/* ขาโต๊ะ 4 ต้น */}
        {[
          [-1.13, 0.47],
          [1.13, 0.47],
          [-1.13, -0.47],
          [1.13, -0.47],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, topY / 2, z]} castShadow material={WOOD_LEG}>
            <boxGeometry args={[0.11, topY, 0.11]} />
          </mesh>
        ))}

        {/* แล็ปท็อป — ฐานบาง จอกางไปทางกล้อง focus หันหน้าจอเข้าหา mascot */}
        <group position={[0, topY + 0.045, 0.08]}>
          <mesh castShadow material={ALU}>
            <boxGeometry args={[0.78, 0.035, 0.52]} />
          </mesh>
          {/* แผงคีย์บอร์ดจมลงนิด */}
          <mesh position={[0, 0.019, 0.03]} material={KEYS}>
            <boxGeometry args={[0.66, 0.004, 0.3]} />
          </mesh>
          {/* จอ: บานพับที่ขอบหลังฐาน (z ลบ = ฝั่งกล้อง) */}
          <group position={[0, 0, -0.26]} rotation={[-c.lidTilt, 0, 0]}>
            <mesh position={[0, 0.26, 0]} castShadow material={ALU}>
              <boxGeometry args={[0.78, 0.52, 0.022]} />
            </mesh>
            <mesh position={[0, 0.26, 0.013]} material={SCREEN}>
              <planeGeometry args={[0.72, 0.46]} />
            </mesh>
          </group>
        </group>

        {/* สตูล — อยู่ฝั่งตรงข้ามโต๊ะ ใต้ก้น mascot ตอนนั่ง */}
        <group position={[0, 0, c.stoolBack]}>
          <mesh position={[0, c.stoolY, 0]} castShadow receiveShadow material={STOOL}>
            <boxGeometry args={[0.85, 0.09, 0.7]} />
          </mesh>
          {[
            [-0.34, 0.26],
            [0.34, 0.26],
            [-0.34, -0.26],
            [0.34, -0.26],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, c.stoolY / 2, z]} castShadow material={WOOD_LEG}>
              <boxGeometry args={[0.09, c.stoolY, 0.09]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}
