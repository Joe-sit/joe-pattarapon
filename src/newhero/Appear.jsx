import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { getTuner } from './tuner'
import { introTime, outBack } from './intro'

/**
 * ห่อของหนึ่งชิ้นให้ "ปรากฏ" ตามนาฬิกาอินโทร — ขยายจากศูนย์ (เลยเป้านิดแล้วดีดกลับ)
 * และไถลเข้ามาจากออฟเซ็ต `from` (พิกัดท้องถิ่นของกลุ่มแม่) จนถึงตำแหน่งจริง
 *
 * at   = วินาทีที่เริ่มโผล่ นับจากอินโทรเริ่ม
 * rise = ระยะที่ลอยขึ้นมาจากข้างล่าง, tilt = มุมคว่ำเริ่มต้น (เรเดียน) ค่อย ๆ เงยจนตรง
 * dur  = ความยาว
 * over = ความแรงของการเลยเป้า
 * ปิดอินโทร (tuner intro = 0) = โผล่ทันทีที่ตำแหน่งจริง
 */
export function Appear({ at = 0, dur = 0.5, from = null, rise = 0, tilt = 0, over = 1.4, children, ...props }) {
  const g = useRef()
  useFrame(() => {
    const o = g.current
    if (!o) return
    const t = getTuner()
    if (t.intro < 0.5) {
      o.visible = true
      o.scale.setScalar(1)
      o.position.set(0, 0, 0)
      o.rotation.set(0, 0, 0)
      return
    }
    const u = (introTime() - at) / Math.max(0.01, dur)
    if (u <= 0) {
      /**
       * ยังไม่ถึงคิว: ย่อจนมองไม่เห็นแทนการซ่อน — ของยังถูกวาด shader จึงถูกคอมไพล์ตั้งแต่
       * เฟรมแรก ๆ ไม่ใช่มาสะดุดตอนโผล่จริง (ดูคำอธิบายใน intro.js)
       */
      o.visible = true
      o.scale.setScalar(1e-4)
      return
    }
    // ผ่อนนุ่ม: ease-out กำลังสามผสมกับการเลยเป้า (over 0 = ไม่เลย) ไม่ใช่สปริงแข็ง ๆ
    const e = u >= 1 ? 1 : over > 0 ? outBack(u, over) * 0.6 + (1 - Math.pow(1 - u, 3)) * 0.4 : 1 - Math.pow(1 - u, 3)
    o.visible = true
    o.scale.setScalar(Math.max(1e-4, e))
    // ลอยขึ้นจากข้างล่าง (rise) พร้อมเงยจากท่าคว่ำ (tilt) — ให้เห็นความหนา/มิติตอนโผล่ ไม่ใช่ป๊อปแบน ๆ
    const k = 1 - e
    o.position.set((from ? from[0] : 0) * k, (from ? from[1] : 0) * k - rise * k, (from ? from[2] : 0) * k)
    o.rotation.set(tilt * k, 0, 0)
  })
  return (
    <group {...props}>
      <group ref={g}>{children}</group>
    </group>
  )
}
