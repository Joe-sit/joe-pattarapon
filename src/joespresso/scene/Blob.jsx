import * as THREE from 'three'
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js'

/**
 * หลอมก้อนกลมหลายลูกเป็นผิวเดียวด้วย metaball field + marching cubes
 * -> ได้ mesh ก้อนเดียวเนียน ไม่เห็นรอยต่อ sphere ประกอบกัน
 *
 * balls: [[x, y, z, r], ...] พิกัด local ช่วงประมาณ -2..2 (แบบ cluster เดิม)
 * คืน BufferGeometry ใน local space -1..1 — ผู้ใช้ scale ×2 เพื่อได้ขนาดเท่า cluster เดิม
 */
export function blobGeometry(balls, { resolution = 64, subtract = 12, isolation = 80 } = {}) {
  const mc = new MarchingCubes(resolution, new THREE.MeshBasicMaterial(), false, false, 80000)
  mc.isolation = isolation
  mc.reset()
  for (const [x, y, z, r] of balls) {
    // map local -2..2 -> field 0..1
    // ผิวอยู่ที่ field = isolation: strength/d² - subtract = isolation -> d = sqrt(strength/(subtract+isolation))
    const fr = r / 4
    mc.addBall(x / 4 + 0.5, y / 4 + 0.5, z / 4 + 0.5, (subtract + isolation) * fr * fr, subtract)
  }
  mc.update()

  const src = mc.geometry
  let count = src.drawRange.count
  if (!Number.isFinite(count)) count = src.getAttribute('position').count
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(src.getAttribute('position').array.slice(0, count * 3), 3))
  g.setAttribute('normal', new THREE.BufferAttribute(src.getAttribute('normal').array.slice(0, count * 3), 3))

  // planar UV จากด้านหน้า — ใช้กับ texture ไล่เฉด/เส้น doodle
  const pos = g.getAttribute('position')
  const uv = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    uv[i * 2] = pos.getX(i) / 2 + 0.5
    uv[i * 2 + 1] = pos.getY(i) / 2 + 0.5
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))

  src.dispose()
  return g
}
