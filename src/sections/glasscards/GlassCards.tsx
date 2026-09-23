import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { GlassScene } from './GlassScene'

/**
 * จอ "การ์ดกระจก" — รูปในทรงเบี้ยวกับการ์ดสามใบ ทั้งหมดเป็นของสามมิติจริงในแคนวาสเดียว
 *
 * ของเดิมเป็น div ที่ `rotate()` กับ `backdrop-filter` ซึ่งเอียงได้แค่ในระนาบจอและเบลอของ
 * ข้างหลังแบบไม่หักเห — แผ่นจึงไม่มีความหนา ไม่มีสัน ไม่มีเงาที่เลื่อนไปคนละทาง ตอนนี้การ์ด
 * เป็นแผ่นหนา 16px ที่ *หันออกจากจอ* ได้ และวัสดุเป็น transmission จริง (บิดภาพที่ลอดผ่าน
 * พร้อมแยกสีแบบปริซึม) รูปจึงต้องย้ายเข้าไปอยู่ในแคนวาสด้วย ไม่งั้นกระจกจะไม่มีอะไรให้หักเห
 * (ดูเหตุผลเต็มใน ./GlassScene)
 *
 * กรอบยังเป็นสัดส่วน 1200×900 ของแบบ และกล้องถูกตั้งให้ความสูงที่เห็นตรงระนาบ z = 0 เท่ากรอบ
 * พอดี — ตัวเลขในฉากจึงยังเทียบกับภาพอ้างอิงได้ตรง ๆ
 */

/** มุมกล้อง — กว้างพอให้เห็นมุมมองชัดว่าแผ่นหันอยู่ แต่ไม่บิดจนผังเพี้ยนจากแบบ */
const FOV = 34
/** ระยะกล้องที่ทำให้ความสูงที่เห็นตรง z = 0 เท่ากรอบแบบ (9 หน่วย) พอดี */
const CAM_Z = 4.5 / Math.tan(((FOV / 2) * Math.PI) / 180)

export function GlassCards() {
  const host = useRef<HTMLDivElement | null>(null)
  /**
   * เรนเดอร์เฉพาะตอนอยู่ในสายตา
   *
   * วัสดุกระจกถ่ายฉากลงบัฟเฟอร์ของตัวเองใบละครั้งต่อเฟรม สามใบ = สามรอบ ปล่อยให้เดินตอน
   * จอนี้เลื่อนพ้นไปแล้วคือเผาเฟรมเปล่า — `frameloop="never"` หยุดลูปทั้งแคนวาสโดยไม่ต้อง
   * ถอดของในฉากออก (ของยังอยู่ใน GPU กลับมาเห็นทันที ไม่ต้องคอมไพล์เชดเดอร์ใหม่)
   */
  const [live, setLive] = useState(false)
  /**
   * นับครั้งที่จอเข้าสายตา — ฉากใช้ค่านี้เป็นสัญญาณ "เริ่มท่าใหม่"
   *
   * เลื่อนลงไปแล้วเลื่อนกลับขึ้นมา ท่าออกจากประตูต้องเล่นซ้ำ ไม่ใช่เห็นการ์ดจอดอยู่แล้ว
   */
  const [seq, setSeq] = useState(0)

  useEffect(() => {
    const el = host.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      ([e]) => {
        setLive(e.isIntersecting)
        if (e.isIntersecting) setSeq((n) => n + 1)
      },
      { threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={host}
      className="relative mx-auto w-full max-w-[1200px]"
      style={{ aspectRatio: '1200 / 900' }}
    >
      <Canvas
        className="!absolute inset-0"
        frameloop={live ? 'always' : 'never'}
        dpr={[1, 2]}
        /* alpha: แคนวาสโปร่ง พื้นขาวของหน้าจึงเป็นพื้นของจอนี้ ไม่ต้องวาดซ้ำ */
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0, CAM_Z], fov: FOV, near: 1, far: 40 }}
      >
        <Suspense fallback={null}>
          <GlassScene seq={seq} />
        </Suspense>
      </Canvas>
    </div>
  )
}
