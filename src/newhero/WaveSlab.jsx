import { useMemo } from 'react'
import * as THREE from 'three'
import { useDisposable } from '@/joespresso/scene/utils'

/**
 * แผ่นหนาลอน S วางขวางการ์ด — ตัวเอกของ hero แบบการ์ด (ตาม ref creativecruise.nl)
 *
 * ต่างจากถนนเดิม (CheckerRibbon) ที่พุ่งเข้าหากล้อง: แผ่นนี้ลากจากซ้ายไปขวาในระนาบของการ์ด
 * ขาซ้ายตั้งสูงจนโผล่พ้นขอบบนการ์ด ลงเป็นท้องคลื่น ขึ้นสันกลาง ลงอีกท้อง แล้วราบเป็นแผ่นหน้า
 * ทางขวาล่าง ความกว้างของแผ่นวิ่งเข้าไปในความลึก (แกน z) ความหนาคือขอบขาวที่เห็นรอบแผ่น
 *
 * เส้นโปรไฟล์อยู่ในระนาบ xy ทิศข้างของแผ่นจึงคงที่เป็นแกน z ทั้งเส้น ไม่ต้องคิดเฟรมหมุน
 * (ไม่มีการบิดแบบถนนเดิม — แผ่นใน ref ไม่บิด)
 */
const PROFILE = [
  /* ขาซ้ายสูงพอจะโผล่พ้นขอบบนการ์ด — ท่าเดียวกับซุ้มใน ref */
  [-11, 12.5],
  [-11.4, 5.5],
  [-10.6, -2.4],
  [-8.4, -5],
  [-5.8, -3.6],
  [-4, 0.6],
  [-2.1, 2.2],
  [-0.2, 0.6],
  [1.3, -3.2],
  [3.2, -5.1],
  [6.4, -5.5],
  [10.5, -5.3],
]
const SEGS = 260

/** เส้นโปรไฟล์ของแผ่น (พิกัดท้องถิ่น) — ใช้ร่วมกับทางไถลของตัวละคร (ดู slabFrame) */
export const SLAB_CURVE = new THREE.CatmullRomCurve3(
  PROFILE.map(([x, y]) => new THREE.Vector3(x, y, 0)),
  false,
  'catmullrom',
  0.5,
)
const Z = new THREE.Vector3(0, 0, 1)

/**
 * เฟรมบนผิวบนของแผ่นที่พารามิเตอร์ t — ลายเซ็นเดียวกับ ribbonFrame ของถนนเดิม (ride.frame)
 * ตัวละครจึงไถลบนแผ่นนี้ได้ด้วยโค้ดท่าเข้าฉากชุดเดิม wave/waves ไม่ใช้ (แผ่นไม่มีคลื่นซ้อน)
 */
export function slabFrame(curve, t, _wave, _waves, out) {
  const { P, T, S, N } = out
  curve.getPointAt(t, P)
  curve.getTangentAt(t, T)
  S.copy(Z)
  N.crossVectors(Z, T).normalize()
  return out
}

function slabGeometry(width, thick) {
  const curve = SLAB_CURVE
  const len = curve.getLength()
  const P = new THREE.Vector3()
  const T = new THREE.Vector3()
  const N = new THREE.Vector3()
  const hw = width / 2
  const pos = []
  const uv = []
  const top = []
  const rest = []
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS
    curve.getPointAt(t, P)
    curve.getTangentAt(t, T)
    /* ผิวบน = ด้านที่หันขึ้น/ออกจากท้องคลื่น (N = Z × T หมุนแทนเจนต์ไป 90° ทวนเข็ม) */
    N.crossVectors(Z, T).normalize()
    /* สี่จุดต่อหน้าตัด: บนหน้า, บนหลัง, ล่างหน้า, ล่างหลัง */
    pos.push(P.x, P.y, hw, P.x, P.y, -hw)
    pos.push(P.x - N.x * thick, P.y - N.y * thick, hw, P.x - N.x * thick, P.y - N.y * thick, -hw)
    const u = (t * len) / width
    uv.push(u, 0, u, 1, u, 0, u, 1)
    if (i < SEGS) {
      const a = i * 4
      const b = a + 4
      top.push(a, b, a + 1, a + 1, b, b + 1)
      rest.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2)
      rest.push(a, a + 2, b, a + 2, b + 2, b)
      rest.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3)
    }
  }
  /* ฝาปิดสองปลาย — ไม่งั้นมองเข้าไปเห็นแผ่นกลวง */
  const last = SEGS * 4
  rest.push(0, 1, 2, 1, 3, 2)
  rest.push(last, last + 2, last + 1, last + 1, last + 2, last + 3)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex([...top, ...rest])
  g.addGroup(0, top.length, 0)
  g.addGroup(top.length, rest.length, 1)
  g.computeVertexNormals()
  return g
}

/** topMaterial = ผิวบน (ส่งมาจากฉาก — ลายตารางคอมมิตชุดเดียวกับถนนเดิม) */
export function WaveSlab({ width = 6, thick = 0.9, position, rotation, scale = 1, children }) {
  const geo = useMemo(() => slabGeometry(width, thick), [width, thick])
  useDisposable(geo)
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={geo} castShadow receiveShadow>
        {children}
        {/* ขอบ/ใต้แผ่นขาวนวล — ขอบขาวหนารอบแผ่นแบบ ref */}
        <meshStandardMaterial attach="material-1" color="#eef1f5" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
