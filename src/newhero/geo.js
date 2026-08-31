import * as THREE from 'three'

/**
 * กล่องมุมมนแบบ extrude — ใช้ร่วมกันระหว่างหน้าต่างกับสเก็ตบอร์ด
 *
 * แยกออกมาเป็นโมดูลของตัวเองเพราะสองที่นั้นอ้างอิงกันไม่ได้ (Rider ถูก NewHeroScene
 * เรียกใช้ ถ้า Rider ไปดึงจาก NewHeroScene จะกลายเป็น import วน)
 */
export function roundedBoxGeo(w, h, d, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  const rr = Math.min(r, Math.min(w, h) / 2)
  s.moveTo(x + rr, y)
  s.lineTo(x + w - rr, y)
  s.quadraticCurveTo(x + w, y, x + w, y + rr)
  s.lineTo(x + w, y + h - rr)
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  s.lineTo(x + rr, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - rr)
  s.lineTo(x, y + rr)
  s.quadraticCurveTo(x, y, x + rr, y)
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
  g.translate(0, 0, -d / 2)
  return g
}
