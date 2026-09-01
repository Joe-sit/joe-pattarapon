import { useMemo } from 'react'
import { useDisposable } from '@/joespresso/scene/utils'
import { roundedBoxGeo } from './geo'

/**
 * บล็อกเตตริส — ของประกอบฉากในพอร์ทัล
 *
 * ปั้นเป็น "ช่องสี่เหลี่ยมหลายช่องต่อกัน" ไม่ใช่ก้อนเดียวที่เจียรให้เป็นรูปตัว S เพราะ
 * เส้นแบ่งระหว่างช่องคือสิ่งที่ทำให้มันอ่านออกว่าเป็นเตตริส ไม่ใช่ก้อนสีเขียวรูปแปลก ๆ
 * ช่องจึงเว้นร่องบาง ๆ ระหว่างกัน (`gap`) แล้วปล่อยให้เงาในร่องวาดเส้นแบ่งให้เอง
 *
 * เรขาคณิตชิ้นเดียวใช้ซ้ำทุกช่อง — ทุกช่องหน้าตาเหมือนกันเป๊ะอยู่แล้ว สร้างแยกชิ้นก็แค่
 * กิน GPU buffer เพิ่มโดยไม่ได้อะไรกลับมา
 *
 * ปั้นในกล่องหน่วยเดียว: ช่องกว้าง 1 จุดกำเนิดอยู่กลางรูปทรง (คิดจากกล่องขอบเขตของช่อง)
 */

/**
 * รูปทรงมาตรฐานของเกม — พิกัดเป็น [คอลัมน์, แถว] แถวมากคือสูงขึ้น
 * ค่าเริ่มต้นคือตัว S ตามภาพ ref: สองช่องบนซ้าย สองช่องล่างเยื้องไปทางขวาหนึ่งช่อง
 */
export const TETRIS_SHAPES = [
  /* S */ [[0, 1], [1, 1], [1, 0], [2, 0]],
  /* Z */ [[0, 0], [1, 0], [1, 1], [2, 1]],
  /* T */ [[0, 0], [1, 0], [2, 0], [1, 1]],
  /* L */ [[0, 0], [0, 1], [0, 2], [1, 0]],
  /* O */ [[0, 0], [1, 0], [0, 1], [1, 1]],
  /* I */ [[0, 0], [1, 0], [2, 0], [3, 0]],
]

const GREEN = '#5fbb4c'

export function Tetris({
  /** ดัชนีใน TETRIS_SHAPES — เกินขอบวนกลับ ไม่ให้ปุ่มลากแล้วหายทั้งชิ้น */
  shape = 0,
  /** ความหนาของก้อน เทียบความกว้างช่อง — บางไปแล้วอ่านเป็นแผ่นสติกเกอร์ */
  depth = 0.9,
  /** รัศมีมุมเทียบความกว้างช่อง */
  radius = 0.16,
  /** ร่องระหว่างช่อง — คือเส้นแบ่งที่ทำให้อ่านออกว่าเป็นสี่ช่องต่อกัน */
  gap = 0.05,
  color = GREEN,
  ...props
}) {
  const cells = TETRIS_SHAPES[((Math.round(shape) % TETRIS_SHAPES.length) + TETRIS_SHAPES.length) % TETRIS_SHAPES.length]

  const size = 1 - gap
  const geo = useMemo(() => roundedBoxGeo(size, size, depth, size * radius), [size, depth, radius])
  useDisposable(geo)

  /**
   * จัดจุดกำเนิดไว้กลางกล่องขอบเขต ไม่ใช่ที่ช่องแรก
   *
   * ไม่งั้นพอหมุนด้วย prop `rotation` มันจะเหวี่ยงรอบมุมชิ้น แทนที่จะหมุนอยู่กับที่
   */
  const [cx, cy] = useMemo(() => {
    const xs = cells.map((c) => c[0])
    const ys = cells.map((c) => c[1])
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  }, [cells])

  return (
    <group {...props}>
      {cells.map(([x, y]) => (
        <mesh key={`${x},${y}`} geometry={geo} position={[x - cx, y - cy, 0]}>
          <meshStandardMaterial color={color} roughness={0.62} />
        </mesh>
      ))}
    </group>
  )
}
