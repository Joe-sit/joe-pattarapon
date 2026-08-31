import { useMemo } from 'react'
import { useDisposable } from '@/joespresso/scene/utils'
import { roundedBoxGeo } from './geo'

/**
 * สเก็ตบอร์ด — ปั้นในโค้ด มีแผ่น กริป ทรัค เพลา ล้อ และน็อตครบ
 *
 * ปั้นในกล่องหน่วยเดียว: ยาว 1 ตามแกน x, กว้างราว 0.3 ตามแกน z, **ล้อแตะ y = 0 พอดี**
 * ผู้เรียกจึงคูณสเกลเดียวแล้ววางบนพื้นได้ตรง ๆ ไม่ต้องมาชดเชยความสูงเอง
 *
 * หัว-ท้ายไม่ได้ดัดโค้งจากแผ่นเดียว แต่เป็นแผ่นแยกที่เอียงขึ้น — ภาษาเดียวกับ mascot
 * ซึ่งเป็นทรงเหลี่ยมประกอบกัน การดัดโค้งจริงต้องขยับ vertex เอง ได้ผลที่ขัดกับสไตล์
 */

const DECK = '#2f4f4a'
const GRIP = '#161f1e'
const TRUCK = '#c6cbd1'
const WHEEL = '#f4f0e6'
const BOLT = '#7f858c'

/**
 * รูปทรงของบอร์ด — ทุกค่าอยู่ในสเกลของกล่องหน่วย (ยาวรวมราว 1 ตามแกน x)
 * ส่งทับได้จากแผง debug ผ่าน prop `spec`
 */
export const BOARD_SPEC = {
  deckLen: 0.56,
  deckWide: 0.3,
  deckThick: 0.022,
  tipLen: 0.26,
  /** มุมเชิดของหัว/ท้าย (เรเดียน) */
  kick: 0.38,
  truckX: 0.235,
  wheelR: 0.038,
  wheelW: 0.042,
  /** ระยะจากพื้นถึงกึ่งกลางความหนาของแผ่น */
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

export function Skateboard({ spec = BOARD_SPEC, ...props }) {
  const S = { ...BOARD_SPEC, ...spec }
  const { deckLen, deckWide, deckThick, tipLen, kick, truckX, wheelR, wheelW, deckY } = S
  const deckGeo = useMemo(
    () => roundedBoxGeo(deckLen, deckWide, deckThick, deckWide * 0.33),
    [deckLen, deckWide, deckThick],
  )
  const tipGeo = useMemo(
    () => roundedBoxGeo(tipLen, deckWide * 0.94, deckThick, deckWide * 0.37),
    [tipLen, deckWide, deckThick],
  )
  const gripGeo = useMemo(
    () => roundedBoxGeo(deckLen * 0.93, deckWide * 0.9, 0.004, deckWide * 0.3),
    [deckLen, deckWide],
  )
  const gripTipGeo = useMemo(
    () => roundedBoxGeo(tipLen * 0.88, deckWide * 0.84, 0.004, deckWide * 0.33),
    [tipLen, deckWide],
  )
  useDisposable([deckGeo, tipGeo, gripGeo, gripTipGeo])

  return (
    <group {...props}>
      {/* ---------- แผ่นกลาง ---------- */}
      <group position={[0, deckY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={deckGeo}>
          <meshStandardMaterial color={DECK} roughness={0.7} />
        </mesh>
        {/* กริปเทป: แผ่นบางสีเข้มบนหน้าแผ่น เล็กกว่านิดหนึ่งให้เห็นขอบไม้ */}
        <mesh geometry={gripGeo} position={[0, 0, -0.013]}>
          <meshStandardMaterial color={GRIP} roughness={0.95} />
        </mesh>
      </group>

      {/* ---------- หัว/ท้ายเชิดขึ้น ---------- */}
      {[-1, 1].map((s) => (
        <group
          key={s}
          position={[
            s * (deckLen / 2 + (tipLen / 2) * Math.cos(kick) - 0.01),
            deckY + (tipLen / 2) * Math.sin(kick),
            0,
          ]}
          rotation={[Math.PI / 2, 0, s * -kick]}
        >
          <mesh geometry={tipGeo}>
            <meshStandardMaterial color={DECK} roughness={0.7} />
          </mesh>
          <mesh geometry={gripTipGeo} position={[0, 0, -0.013]}>
            <meshStandardMaterial color={GRIP} roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* ---------- ทรัค + ล้อ ---------- */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * truckX, 0, 0]}>
          {/* ฐานทรัคที่ยึดกับท้องแผ่น */}
          <mesh position={[0, deckY - deckThick / 2 - 0.011, 0]}>
            <boxGeometry args={[0.09, 0.022, deckWide * 0.53]} />
            <meshStandardMaterial color={TRUCK} roughness={0.35} metalness={0.5} />
          </mesh>
          {/* คอทรัค: เอียงเข้าหากลางบอร์ดเหมือนของจริง ไม่ใช่แท่งตั้งฉาก */}
          <mesh
            position={[s * -0.014, (deckY - deckThick / 2 - 0.022 + wheelR) / 2 + wheelR * 0.4, 0]}
            rotation={[0, 0, s * 0.5]}
          >
            <boxGeometry args={[0.05, Math.max(0.02, deckY - wheelR - 0.03), deckWide * 0.33]} />
            <meshStandardMaterial color={TRUCK} roughness={0.35} metalness={0.5} />
          </mesh>
          {/* เพลา: แท่งบางพาดขวางตัวบอร์ด ยาวพ้นล้อทั้งสองข้าง */}
          <mesh position={[0, wheelR, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.009, 0.009, deckWide, 12]} />
            <meshStandardMaterial color={TRUCK} roughness={0.3} metalness={0.6} />
          </mesh>
          {/* ล้อสี่ตัว: แกนหมุนอยู่ตามแนวขวางบอร์ด (แกน z) จึงต้องพลิกทรงกระบอก 90° */}
          {[-1, 1].map((w) => (
            <mesh
              key={w}
              position={[0, wheelR, w * (deckWide * 0.38)]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[wheelR, wheelR, wheelW, 20]} />
              <meshStandardMaterial color={WHEEL} roughness={0.6} />
            </mesh>
          ))}
          {/* น็อตยึดทรัคบนหน้าแผ่น — สี่ตัวต่อทรัค */}
          {[-1, 1].map((a) =>
            [-1, 1].map((b) => (
              <mesh
                key={`${a}${b}`}
                position={[a * 0.028, deckY + deckThick / 2 + 0.003, b * (deckWide * 0.16)]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.008, 0.008, 0.012, 8]} />
                <meshStandardMaterial color={BOLT} roughness={0.4} metalness={0.6} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  )
}
