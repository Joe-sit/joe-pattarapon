import * as THREE from 'three'

/**
 * กล่องสังกะสีโครเมียมฝาพับ (ภาพอ้างอิง Visual Pharm) — ตัวกล่องขอบมน ผนังบาง พื้นหนา
 * ฝาเป็นแผ่นบนกับขอบสั้นรอบ ๆ บานพับอยู่ขอบหลังด้านบน ดาวสี่แฉกดำประทับที่มุมหน้า
 *
 * จุดกำเนิด = กลางพื้นกล่อง · `lid` = กลุ่มหมุนรอบบานพับ (rotation.x ลบ = เปิด)
 * `inside` = จุดกลางในกล่อง (ของที่ใส่ไว้วางอ้างจุดนี้)
 */
export type Tin = { group: THREE.Group; lid: THREE.Group; inside: THREE.Vector3; dispose: () => void }

function roundRect(w: number, d: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -d / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + d - r)
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d)
  s.lineTo(x + r, y + d)
  s.quadraticCurveTo(x, y + d, x, y + d - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

/** ผนังรอบ = รูปมนเจาะรูปมนที่เล็กกว่า อัดขึ้นเป็นแนวตั้ง */
function wall(w: number, d: number, r: number, t: number, h: number) {
  const outer = roundRect(w, d, r)
  const inner = roundRect(w - t * 2, d - t * 2, Math.max(0.01, r - t))
  outer.holes.push(new THREE.Path(inner.getPoints(24).reverse()))
  const g = new THREE.ExtrudeGeometry(outer, { depth: h, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24 })
  g.rotateX(-Math.PI / 2)
  return g
}

function sparkle(r: number) {
  const s = new THREE.Shape()
  s.moveTo(0, r)
  s.quadraticCurveTo(0, 0, r, 0)
  s.quadraticCurveTo(0, 0, 0, -r)
  s.quadraticCurveTo(0, 0, -r, 0)
  s.quadraticCurveTo(0, 0, 0, r)
  return s
}

export function buildTin(): Tin {
  const W = 2.6
  const D = 1.9
  const H = 0.8
  const R = 0.28
  const T = 0.05
  const list: { dispose: () => void }[] = []
  const keep = <T extends { dispose: () => void }>(x: T) => (list.push(x), x)
  const steel = keep(new THREE.MeshPhysicalMaterial({ color: '#e3e6ea', metalness: 1, roughness: 0.2, clearcoat: 0.4 }))
  const inner = keep(new THREE.MeshPhysicalMaterial({ color: '#cfd3d9', metalness: 1, roughness: 0.32 }))
  const ink = keep(new THREE.MeshStandardMaterial({ color: '#16181d', roughness: 0.4 }))

  const group = new THREE.Group()
  const walls = new THREE.Mesh(keep(wall(W, D, R, T, H)), steel)
  const floor = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(roundRect(W, D, R), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 24 })), inner)
  floor.rotation.x = -Math.PI / 2
  /* ขอบบนม้วนเป็นวง (ขอบกล่องสังกะสีจริง) */
  const lipG = keep(wall(W + 0.03, D + 0.03, R + 0.015, 0.06, 0.05))
  const lip = new THREE.Mesh(lipG, steel)
  lip.position.y = H - 0.05
  const star = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(sparkle(0.14), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.006, bevelSegments: 2 })), ink)
  star.position.set(W / 2 - 0.36, H * 0.38, D / 2 + 0.005)
  group.add(walls, floor, lip, star)

  /* ฝา: บานพับที่ขอบหลังด้านบน — ตัวฝาเยื้องไปข้างหน้าจากจุดหมุน */
  const lid = new THREE.Group()
  lid.position.set(0, H + 0.01, -D / 2)
  const top = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(roundRect(W + 0.06, D + 0.06, R + 0.03), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 24 })), steel)
  top.rotation.x = -Math.PI / 2
  top.position.set(0, 0.16, D / 2)
  const rim = new THREE.Mesh(keep(wall(W + 0.06, D + 0.06, R + 0.03, 0.04, 0.16)), steel)
  rim.position.set(0, 0, D / 2)
  lid.add(top, rim)
  group.add(lid)

  return { group, lid, inside: new THREE.Vector3(0, H * 0.45, 0), dispose: () => list.forEach((x) => x.dispose()) }
}
