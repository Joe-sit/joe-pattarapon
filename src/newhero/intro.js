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

export const intro = { armed: false, time: 0, waited: 0, held: false, wants: false }

export const FALLBACK_AFTER = 2
const MAX_DT = 1 / 20

/** วินาทีนับจากอินโทรเริ่ม (ติดลบ = ยังไม่เริ่ม) */
export function introTime() {
  return intro.armed ? intro.time : -1
}

export function armIntro() {
  if (intro.armed) return
  /**
   * ถูกกั้นอยู่ (สปแลชยังไม่ปิด) — จำไว้ว่า "พร้อมแล้ว" แทนการออกตัว
   *
   * สัญญาณนี้คือของที่ไม่กำกวมที่สุดที่ฉากนี้มี: Entrance จะเรียกก็ต่อเมื่อโมเดลขึ้นครบ
   * และเฟรมเดินเป็นปกติแล้ว (shader คอมไพล์เสร็จ) สปแลชจึงรออันนี้ ไม่ใช่รอแค่ไฟล์โหลดจบ
   */
  if (intro.held) {
    intro.wants = true
    return
  }
  intro.armed = true
  intro.time = 0
}

/** กั้นอินโทรไว้ก่อน — ระหว่างนี้ armIntro จะแค่ยกธง wants */
export function holdIntro() {
  // ฉากบอกว่าพร้อมไปแล้วก่อนถูกกั้น (หรือออกตัวไปแล้ว) = จำไว้ ไม่ใช่ลืม — ไม่งั้นจะไม่มีใคร
  // มาบอกซ้ำอีก สปแลชก็จะรอจนหมดเวลา
  intro.wants = intro.wants || intro.armed
  intro.held = true
  intro.armed = false
  intro.time = 0
  intro.waited = 0
}

/** ปล่อยให้เล่นได้ — ถ้าฉากพร้อมไปแล้วระหว่างถูกกั้น ก็ออกตัวทันที */
export function releaseIntro() {
  if (!intro.held) return
  intro.held = false
  if (intro.wants) {
    intro.wants = false
    armIntro()
  }
}

/** ฉากรายงานว่าพร้อมแล้วหรือยัง (ใช้ตอนถูกกั้น) */
export function introWants() {
  return intro.wants
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
