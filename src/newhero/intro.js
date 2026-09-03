/**
 * นาฬิกาอินโทรของ /new-hero — จุดศูนย์เวลาที่ทุกชิ้นใช้ร่วมกันตอน "ปรากฏ"
 *
 * ไม่ใช้ clock.elapsedTime ตรง ๆ: เฟรมแรกที่ของทั้งฉากถูกวาดคือเฟรมที่คอมไพล์ shader ทั้งชุด
 * (กินได้เป็นวินาที) ถ้านับเวลาจริง อินโทรจะกระโดดข้ามช่วงต้นไปทั้งท่อน — จึงสะสมเวลาเอง
 * ด้วย dt ที่ตัดเพดานไว้ (MAX_DT) เฟรมที่สะดุดจึงนับเป็นแค่เฟรมเดียว
 *
 * Entrance เป็นคนติดอาวุธ (arm) ตอนตัวละครขึ้นครบ เพราะมันคือชิ้นที่มาช้าสุด ถ้าไม่มี
 * Entrance ในฉาก (ปิดตัวละคร) IntroClock จะติดอาวุธเองหลัง FALLBACK_AFTER วินาที
 * รีเซ็ต = เล่นอินโทรใหม่ทั้งฉาก (ปุ่มเล่นใหม่ในแผงทำผ่าน enReplay ของ Entrance)
 */
import { useFrame } from '@react-three/fiber'

export const intro = { armed: false, time: 0, waited: 0 }

export const FALLBACK_AFTER = 2
const MAX_DT = 1 / 20

/** วินาทีนับจากอินโทรเริ่ม (ติดลบ = ยังไม่เริ่ม) */
export function introTime() {
  return intro.armed ? intro.time : -1
}

export function armIntro() {
  if (intro.armed) return
  intro.armed = true
  intro.time = 0
}

export function resetIntro() {
  intro.armed = false
  intro.time = 0
  intro.waited = 0
}

/** เดินนาฬิกา — วางไว้ตัวเดียวในฉาก รันก่อนทุก useFrame อื่น (priority ต่ำสุด) */
export function IntroClock() {
  useFrame((_, dt) => {
    const step = Math.min(dt, MAX_DT)
    if (intro.armed) intro.time += step
    else {
      intro.waited += step
      if (intro.waited > FALLBACK_AFTER) armIntro()
    }
  }, -1000)
  return null
}

/** เข้าเป้าแบบเลยไปนิดแล้วดีดกลับ — s = ความแรงของการเลย (0 = ease-out ธรรมดา) */
export function outBack(t, s = 1.4) {
  const x = Math.min(1, Math.max(0, t)) - 1
  return 1 + x * x * ((s + 1) * x + s)
}
