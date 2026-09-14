import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/**
 * ช่องมองทะลุด้วย stencil buffer — แยกเป็นโมดูลให้จอ "สิ่งที่ทำ" ใช้ร่วมกับ hero
 *
 * วิธีทำงาน: วาดตัวช่องโดยไม่เขียนสี (`colorWrite: false`) แต่เขียนเลข STENCIL_REF ลง
 * stencil แล้วของในฉากข้างในตั้งเงื่อนไขว่าจะวาดเฉพาะพิกเซลที่ stencil ตรงเลขนั้น —
 * ผลคือฉากข้างในโผล่เฉพาะในกรอบช่อง เหมือนมองผ่านหน้าต่าง
 *
 * ทำไมไม่ใช้ MeshPortalMaterial ของ drei: มันเรนเดอร์ลง render target แล้วสุ่มตัวอย่าง
 * กลับด้วยพิกัดจอ ซึ่งคลาดตำแหน่งเมื่อขนาด target กับขนาดจอไม่ตรงกัน (ในฉาก hero เคย
 * คลาดแนวตั้งราว 100 px) stencil ไม่มีปัญหานั้น เพราะทุกอย่างวาดด้วยกล้องตัวเดียวกัน
 * ในบัฟเฟอร์เดียวกัน ตำแหน่งจึงตรงเอง
 *
 * ต้องเปิด stencil ที่ตัว renderer ด้วย: `<Canvas gl={{ stencil: true }}>`
 *
 * หมายเหตุ: หน้าต่างสี่บานของ hero ยังมีสำเนาของตรรกะนี้อยู่ใน `Panel`/`InsidePortal`
 * ของ NewHeroScene เพราะมันพันกับเรื่องกระจก/แถบสีของบานนั้น — ที่นี่เอาแค่แกนกลาง
 */

export const STENCIL_REF = 1

/**
 * วัสดุของตัวช่อง — ไม่เขียนสีและไม่เขียนความลึก เขียนแต่ stencil
 *
 * `mark` = ค่าที่จะเขียนลง stencil เผื่อให้ฉากที่มีช่องหลายชนิดในจอเดียวแยกกลุ่มกันได้
 * (จอ what-i-do เขียน 2 ที่หน้าจอทุกบานเพื่อปล่อยตัวละครเข้าไป, 1 ที่ช่องพอร์ทัลของบานกลาง
 * และ 0 เพื่อล้างรอยของบานที่อยู่หลังกว่า) ค่าเริ่มต้นเท่าเดิม จอแรกไม่ต้องแก้อะไร
 *
 * ชื่อ prop ห้ามเป็น `ref`: React สงวนคำนั้นไว้ ค่าที่ส่งไปไม่ถึงคอมโพเนนต์ หน้ากากทุกใบจึง
 * เขียนค่าเริ่มต้นเหมือนกันหมด แล้วตัวละครทะลุออกไปนอกจอ (วัดมาแล้ว)
 */
export function PortalMask({ mark = STENCIL_REF }) {
  return (
    <meshBasicMaterial
      colorWrite={false}
      depthWrite={false}
      stencilWrite
      stencilRef={mark}
      stencilFunc={THREE.AlwaysStencilFunc}
      stencilZPass={THREE.ReplaceStencilOp}
    />
  )
}

/**
 * ห่อของที่ต้องโผล่เฉพาะในช่อง
 *
 * ตั้งค่าใน useFrame ไม่ใช่ตอน mount: ของข้างในบางชิ้นโหลดแบบ async (GLB) และบางชิ้น
 * สร้างวัสดุใหม่ตอนวิ่ง กวาดซ้ำอยู่ช่วงแรกจึงครอบของที่มาทีหลังด้วย แล้วหยุดเมื่อครบโควตา
 */
export function InsidePortal({ children, frames = 240, overlay = false }) {
  const g = useRef()
  const n = useRef(0)
  useFrame(() => {
    const root = g.current
    if (!root || n.current > frames) return
    n.current += 1
    root.traverse((o) => {
      if (!o.material) return
      if (!overlay) o.renderOrder = 1
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.stencilWrite && m.stencilRef === STENCIL_REF) continue
        m.stencilWrite = true
        m.stencilRef = STENCIL_REF
        m.stencilFunc = THREE.EqualStencilFunc
        /**
         * overlay: ฉากข้างในอยู่ "หลังของทึบ" (เช่นแผ่นการ์ดที่เจาะช่องไม่ได้) จึงถูก
         * ความลึกของแผ่นนั้นคัดทิ้งทั้งหมด — ปิดการทดสอบความลึกแล้ว stencil เป็นตัวคัด
         * เดียวที่เหลือ ของในช่องจึงทาทับแผ่นได้เฉพาะในกรอบช่อง
         *
         * แลกมาด้วยการที่ของข้างในไม่บังกันเองตามความลึก ต้องสั่งลำดับวาดเอง
         * (renderOrder ของแต่ละชิ้น: แผ่นรองก่อน ของลอยทีหลัง)
         */
        if (overlay) m.depthTest = false
        m.needsUpdate = true
      }
    })
  })
  return (
    <group ref={g} userData={{ insidePortal: true }}>
      {children}
    </group>
  )
}

/** เส้นรอบรูปสี่เหลี่ยมมุมมน — ใช้ทั้งทำแผ่นแบนและทำกรอบที่มีรู */
export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape()
  const x = w / 2
  const y = h / 2
  const k = Math.min(r, x, y)
  s.moveTo(-x + k, -y)
  s.lineTo(x - k, -y)
  s.quadraticCurveTo(x, -y, x, -y + k)
  s.lineTo(x, y - k)
  s.quadraticCurveTo(x, y, x - k, y)
  s.lineTo(-x + k, y)
  s.quadraticCurveTo(-x, y, -x, y - k)
  s.lineTo(-x, -y + k)
  s.quadraticCurveTo(-x, -y, -x + k, -y)
  return s
}

/** เรขาคณิตสี่เหลี่ยมมุมมนแบน — ใช้เป็นตัวช่องและเป็นแผ่นรองในฉากข้างใน */
export function roundedPlane(w, h, r, seg = 8) {
  return new THREE.ShapeGeometry(roundedRectShape(w, h, r), seg)
}

/**
 * กรอบสี่เหลี่ยมมุมมนหนา ๆ ที่กลางเป็นรูจริง
 *
 * รูเป็น hole ของ Shape ไม่ใช่ก้อนที่เอามาลบ: ExtrudeGeometry ลบมุมให้พร้อมขอบนอกใน
 * ครั้งเดียว ขอบรูจึงมนเท่ากับขอบนอกโดยไม่ต้องทำ CSG — และเป็น "รูจริง" หมายความว่า
 * ฉากที่อยู่หลังกรอบมองทะลุได้ตรง ๆ ไม่ต้องปิดการทดสอบความลึกเหมือนตอนเจาะแผ่นทึบ
 */
export function roundedFrameGeo(w, h, bar, depth, r, bevel = 0.1, barBottom = bar) {
  const s = roundedRectShape(w, h, r)
  /**
   * ขอบล่างหนากว่าขอบอื่นได้ — รูจึงไม่ได้อยู่กลางกรอบ แต่เยื้องขึ้นไป
   *
   * กรอบที่ขอบเท่ากันทุกด้านอ่านเป็น "เส้นขอบ" ส่วนกรอบที่ก้นหนากว่าอ่านเป็น "การ์ด"
   * (โพลารอยด์/การ์ดโพสต์มีที่ว่างใต้รูปไว้เขียนเสมอ) ซึ่งเป็นสิ่งที่แบบอ้างถึง
   */
  const ih = h - bar - barBottom
  const inner = roundedRectShape(w - bar * 2, ih, Math.max(0.02, r - bar * 0.55))
  const cy = (barBottom - bar) / 2
  const pts = inner.getPoints(24).map((p) => p.clone().setY(p.y + cy))
  s.holes.push(new THREE.Path(pts))
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 14,
  })
  /**
   * จัดกลางด้วยขนาด "นอก" ของกรอบ ไม่ใช่ด้วยกล่องขอบเขต
   *
   * bbox ของกรอบที่ก้นหนากว่ายังสมมาตรอยู่ (รูปนอกไม่เปลี่ยน) แต่ความลึกของ extrude
   * วิ่งจาก 0 ไป depth จึงต้องเลื่อนกลับมาครึ่งหนึ่งเอง ไม่งั้นหน้ากรอบไม่อยู่ที่ z = 0
   */
  g.translate(0, 0, -depth / 2)
  return g
}
