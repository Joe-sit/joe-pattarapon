import { useFrame } from '@react-three/fiber'
import { usePhase } from './HeroShatter'

/**
 * จังหวะ "ฉากเดินเอง" ของจอแรก — ค่ากลางชุดเดียวที่ทุกชิ้นในฉากอ่านร่วมกัน
 *
 * ไม่ใช้ state ของ React เพราะค่าพวกนี้เปลี่ยนทุกเฟรม (setState ใน useFrame = re-render
 * หกสิบครั้งต่อวินาที) และไม่ใช้ context เพราะ <Canvas> เป็น React root คนละต้นกับหน้า
 * ตัวขับเดียว (IdleDriver) เขียนค่า ที่เหลืออ่านอย่างเดียวใน useFrame ของตัวเอง
 *
 * ไทม์ไลน์หนึ่งรอบ: เครนยกฝาจอขึ้น → ค้างไว้ → หย่อนลง → พัก
 * ระหว่างที่ยก บันไดสั่นและคนบนบันไดทำท่าตกใจ (alarm)
 */
export const idle = {
  /** เวลาในไทม์ไลน์ เดินเฉพาะตอนฉากอยู่ในสภาพปกติ */
  t: 0,
  /** 0..1 ฝาจอถูกยกสูงแค่ไหน */
  lift: 0,
  /** 0..1 ความตกใจของคนบนบันได (และแรงสั่นของบันได) */
  alarm: 0,
  /** 0..1 ฉากอยู่ในโหมดปกติแค่ไหน — ตอนระเบิด/ประกอบคืนต้องคลายท่าทั้งหมดทิ้ง */
  active: 0,
}

/** หนึ่งรอบของไทม์ไลน์ (วินาที) */
const CYCLE = 9

const smooth = (x: number) => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

/** ตัวขับไทม์ไลน์ — วางไว้ในฉากหนึ่งตัวเท่านั้น */
export function IdleDriver() {
  const phase = usePhase()

  useFrame((_, dt) => {
    const want = phase === 'idle' ? 1 : 0
    idle.active += (want - idle.active) * (1 - Math.exp(-6 * dt))
    // เวลาหยุดเดินตอนฉากพัง ไทม์ไลน์จึงกลับมาต่อจากเดิม ไม่ใช่โผล่กลางท่า
    idle.t += dt * idle.active

    const u = (idle.t % CYCLE) / CYCLE
    const raise = smooth((u - 0.1) / 0.22)
    const drop = smooth((u - 0.56) / 0.24)
    idle.lift = (raise - drop) * idle.active
    // ตกใจตั้งแต่เครนเริ่มออกแรง ไปจนฝาจอเริ่มลง — ไม่ใช่ตอนที่ทุกอย่างนิ่งแล้ว
    idle.alarm = (smooth((u - 0.08) / 0.1) - smooth((u - 0.6) / 0.16)) * idle.active
  })

  return null
}
