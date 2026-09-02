import { useMemo } from 'react'
import * as THREE from 'three'
import { useDisposable } from '@/joespresso/scene/utils'

/**
 * สเก็ตบอร์ด — แผ่นเดียวจบ ไม่ใช่กล่องสามใบต่อกัน
 *
 * ของเดิมประกอบจากแผ่นกลาง + แผ่นหัว + แผ่นท้าย เอียงชนกัน จึงเห็นรอยต่อและมุมเหลี่ยม
 * ของจริง (และในภาพอ้างอิง) แผ่นเป็นชิ้นเดียว: ขอบข้างขนานกันตรงกลาง ปลายมนเป็นครึ่งวงกลม
 * และเชิดขึ้นทั้งสองปลายอย่างต่อเนื่อง ไม่มีสันหักที่ไหนเลย
 *
 * จึงปั้นเป็นพื้นผิวกวาด: เดินไปตามความยาว แล้ววาดหน้าตัดที่ตำแหน่งนั้น ๆ
 *   - ความกว้างของหน้าตัดมาจากเส้นขอบทรงสเตเดียม (กลางตรง ปลายโค้งจนกว้างเป็นศูนย์)
 *   - ความสูงของหน้าตัดคือความหนาแผ่น มุมมนด้วยซูเปอร์เอลลิปส์ ได้ขอบนุ่มแบบไม้อัดจริง
 *   - ยกปลายทั้งสองข้างด้วยเส้นโค้งนุ่ม (smoothstep) = คิกที่ไม่มีสันหัก
 *
 * ปั้นในกล่องหน่วยเดียว: ยาว 1 ตามแกน x, กว้างราว 0.3 ตามแกน z, **ล้อแตะ y = 0 พอดี**
 */

const DECK = '#2f4f4a'
const TRUCK = '#c6cbd1'
const WHEEL = '#f4f0e6'

export const BOARD_SPEC = {
  /** ความยาวทั้งแผ่น รวมปลายมนสองข้าง */
  deckLen: 0.82,
  deckWide: 0.3,
  deckThick: 0.05,
  /** ปลายเริ่มเชิดที่กี่ส่วนของครึ่งความยาว (0.5 = เชิดตั้งแต่กลางไปหาปลาย) */
  kickStart: 0.52,
  /** ปลายเชิดสูงเท่าไร เทียบความยาวทั้งแผ่น */
  kickH: 0.035,
  /** ท้องแผ่นแอ่นขึ้นตรงกลางเท่าไร เทียบความกว้าง */
  concave: 0.03,
  truckX: 0.235,
  wheelR: 0.038,
  wheelW: 0.042,
  /** ระยะจากพื้นถึงกึ่งกลางความหนาของแผ่นที่จุดกึ่งกลางบอร์ด */
  deckY: 0.105,
}

/**
 * ความสูงของ "หน้าแผ่นที่เหยียบ" จากพื้น
 *
 * ต้องคิดจาก spec ไม่ใช่ค่าคงที่ — พอเปลี่ยนความหนาแผ่นหรือความสูงจากพื้น ผู้เรียก
 * ต้องรู้ระดับใหม่ทันที ไม่งั้นเท้าจะจมหรือลอยทุกครั้งที่ปรับ
 */
export function deckTop(spec = BOARD_SPEC) {
  return spec.deckY + spec.deckThick / 2 + 0.004
}

/** ครึ่งความกว้างของแผ่นที่ตำแหน่ง x — กลางตรง ปลายเป็นครึ่งวงกลม (ทรงสเตเดียม) */
function halfWidthAt(x, len, wide) {
  const r = wide / 2
  const flat = len / 2 - r
  const a = Math.abs(x)
  if (a <= flat) return r
  const t = Math.min(1, (a - flat) / r)
  return r * Math.sqrt(Math.max(0, 1 - t * t))
}

/** ไล่ขึ้นแบบนุ่ม ไม่มีสันหัก — ใช้ทำปลายเชิด */
function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / Math.max(1e-6, b - a)))
  return t * t * (3 - 2 * t)
}

/** ระยะจากจุดถึงแกนกลางของทรงสเตเดียม — ใช้หาระยะถึงขอบแผ่นแบบแม่นยำ */
function distToSpine(x, z, len, wide) {
  const flat = len / 2 - wide / 2
  const dx = Math.max(0, Math.abs(x) - flat)
  return Math.hypot(dx, z)
}

/**
 * แผ่นบอร์ด — สร้างจาก "ระยะถึงขอบ" ไม่ใช่การกวาดหน้าตัด
 *
 * การกวาดหน้าตัดตามแกนยาวได้ปลายที่ผิด: ตรงหัวท้าย ขอบแผ่นโค้งไปทางอื่นแล้ว แต่หน้าตัด
 * ยังตั้งฉากกับแกน x อยู่ ปลายจึงออกมาเป็นลิ่มแบน ๆ ไม่ใช่จมูกมน
 *
 * ของจริงคือแผ่นหนาคงที่ที่ "ขอบถูกลบมุมด้วยรัศมีเท่าครึ่งความหนา" รอบทั้งใบ
 * เขียนตรง ๆ ได้เลยถ้าคิดจากระยะถึงขอบ: ห่างขอบเกินหนึ่งความหนา = หนาเต็ม
 * เข้าใกล้ขอบ = ม้วนลงเป็นวงกลมจนบรรจบกับผิวล่างพอดีที่ขอบ
 * ทรงสเตเดียมหาระยะถึงขอบได้แม่น (รัศมี ลบ ระยะถึงแกนกลาง) จึงไม่ต้องประมาณ
 */
function deckGeometry(
  { deckLen, deckWide, deckThick, kickStart, kickH, concave },
  nx = 140,
  nz = 26,
) {
  const pos = []
  const idx = []
  const th = deckThick / 2
  const r = deckWide / 2
  const rows = nx + 1
  const cols = nz + 1

  const surface = (sign) => {
    const base = pos.length / 3
    for (let i = 0; i <= nx; i += 1) {
      const x = (i / nx - 0.5) * deckLen
      const hw = halfWidthAt(x, deckLen, deckWide)
      const lift = kickH * deckLen * smoothstep(kickStart, 1, Math.abs(x) / (deckLen / 2))
      for (let j = 0; j <= nz; j += 1) {
        const z = (j / nz - 0.5) * 2 * hw
        // ระยะถึงขอบ แล้วแปลงเป็นความหนา ณ จุดนั้น (ม้วนลงเป็นวงกลมในช่วงสุดท้าย)
        const d = Math.max(0, r - distToSpine(x, z, deckLen, deckWide))
        const k = Math.min(1, d / Math.max(1e-6, th))
        const t = Math.sqrt(Math.max(0, 1 - (1 - k) ** 2))
        const dip = concave * deckWide * (1 - (Math.abs(z) / Math.max(1e-6, hw)) ** 2)
        pos.push(x, lift + sign * th * t - dip, z)
      }
    }
    for (let i = 0; i < nx; i += 1) {
      for (let j = 0; j < nz; j += 1) {
        const a = base + i * cols + j
        const b = a + 1
        const c = a + cols
        const dd = c + 1
        /**
         * ทิศเวียนของสามเหลี่ยม: i ไล่ตามแกน x, j ไล่ตามแกน z
         * cross(+x, +z) ชี้ลง (-y) — ผิวบนจึงต้องเวียน (a, b, c) ไม่ใช่ (a, c, b)
         * เวียนผิดทางแล้วนอร์มัลกลับด้านทั้งแผ่น แสงจะมาจากด้านหลังผิว ไล่เฉดเพี้ยนทั้งชิ้น
         */
        if (sign > 0) idx.push(a, b, c, b, dd, c)
        else idx.push(a, c, b, b, c, dd)
      }
    }
  }
  surface(1)
  surface(-1)

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  void rows
  return g
}

export function Skateboard({ spec = BOARD_SPEC, ...props }) {
  const S = { ...BOARD_SPEC, ...spec }
  const { deckWide, deckThick, truckX, wheelR, wheelW, deckY } = S

  const deck = useMemo(() => deckGeometry(S), [
    S.deckLen,
    S.deckWide,
    S.deckThick,
    S.kickStart,
    S.kickH,
    S.concave,
  ])
  useDisposable([deck])

  return (
    <group {...props}>
      <group position={[0, deckY, 0]}>
        <mesh geometry={deck} castShadow receiveShadow>
          <meshStandardMaterial color={DECK} roughness={0.7} />
        </mesh>
      </group>

      {/* ---------- ทรัค + ล้อ ---------- */}
      {/**
       * ทรัคต้องเลื่อนลงตามท้องแผ่นที่แอ่น
       *
       * ค่า concave กดผิวทั้งบนและล่างลงตรงกลางแผ่น ทรัคยึดกับท้องแผ่นที่แนวกลางพอดี
       * ถ้าไม่เลื่อนตาม ฐานทรัคจะทะลุขึ้นมาโผล่บนหน้าแผ่น (เห็นเป็นแถบขาวบนกริป)
       */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * truckX, -(S.concave ?? 0) * deckWide, 0]}>
          {/* ฐานทรัคแนบใต้ท้องแผ่นพอดี — ยกสูงกว่านี้จะโผล่ทะลุหน้าแผ่นขึ้นมา */}
          <mesh position={[0, deckY - deckThick / 2 - 0.014, 0]} castShadow>
            <boxGeometry args={[0.09, 0.022, deckWide * 0.53]} />
            <meshStandardMaterial color={TRUCK} roughness={0.35} metalness={0.5} />
          </mesh>
          {/* คอทรัค: เอียงเข้าหากลางบอร์ดเหมือนของจริง ไม่ใช่แท่งตั้งฉาก */}
          <mesh
            position={[s * -0.014, (deckY - deckThick / 2 - 0.022 + wheelR) / 2 + wheelR * 0.4, 0]}
            rotation={[0, 0, s * 0.5]}
            castShadow
          >
            <boxGeometry args={[0.05, Math.max(0.02, deckY - wheelR - 0.03), deckWide * 0.33]} />
            <meshStandardMaterial color={TRUCK} roughness={0.35} metalness={0.5} />
          </mesh>
          {/* เพลา: แท่งบางพาดขวางตัวบอร์ด ยาวพ้นล้อทั้งสองข้าง */}
          <mesh position={[0, wheelR, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.009, 0.009, deckWide, 12]} />
            <meshStandardMaterial color={TRUCK} roughness={0.3} metalness={0.6} />
          </mesh>
          {/* ล้อสี่ตัว: แกนหมุนอยู่ตามแนวขวางบอร์ด (แกน z) จึงต้องพลิกทรงกระบอก 90° */}
          {[-1, 1].map((w) => (
            <mesh
              key={w}
              position={[0, wheelR, w * (deckWide * 0.38)]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[wheelR, wheelR, wheelW, 20]} />
              <meshStandardMaterial color={WHEEL} roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
