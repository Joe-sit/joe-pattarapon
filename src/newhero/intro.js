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
import { getTuner } from './tuner'

export const intro = { armed: false, time: 0, waited: 0, held: false, wants: false }

/**
 * ชิ้นที่ "ไม่ต้องเล่นท่าโผล่" เพราะมีอย่างอื่นพามันขึ้นเวทีแล้ว
 *
 * บานหน้าต่างเป็นกรณีนี้: ตัวอักษร J O E ของสปแลชมอร์ฟมาลงเป็นบานพอดี ถ้าบานยังเล่นท่า
 * ขยายจากศูนย์ของตัวเองอีก คนดูจะเห็นของที่เพิ่งลงที่ "ป๊อกขึ้นมาใหม่" — รอยต่อที่ตั้งใจ
 * ซ่อนก็โผล่ตรงนั้นพอดี เป็นออบเจกต์เปล่าเพราะค่าเปลี่ยนกลางทางโดยไม่ต้อง re-render ฉาก
 */
export const introSkip = { windows: false, camera: false }

export const FALLBACK_AFTER = 2
const MAX_DT = 1 / 20

/**
 * วินาทีที่ "อินโทรเล่นจบ" — คิดจากตารางเวลาของอินโทรเอง ไม่ใช่ตัวเลขที่เดาไว้อีกที่หนึ่ง
 *
 * ทุกชิ้นในฉากโผล่ด้วย <Appear at dur> ที่อ่านค่าจากแผงจูน ใครอยากรู้ว่า "อินโทรจบเมื่อไร"
 * ต้องได้คำตอบจากตารางชุดเดียวกัน ไม่งั้นพอมีใครลากสไลเดอร์ของอินโทร ของที่รออยู่ก็หลุดคิว
 * (หัวเรื่องของ /2026-final เคยรอด้วยค่าคงที่ 6.5 วิ ขณะที่อินโทรจริงจบที่ ~3.0 วิ — ห่างกัน
 * ครึ่งเท่าของตัวอินโทรทั้งท่อน)
 *
 * ตัวที่มาช้าสุดคือกล้อง (inCamDur) กับพวก prop ที่ห้อยท้ายตัวละคร (enDelay + enDur + …)
 */
export function introEnd() {
  const t = getTuner()
  if (t.intro < 0.5) return 0
  const windows = t.inWinAt + Math.max(0, Math.round(t.panelCount) - 1) * t.inWinStep + t.inWinDur
  const ribbon = t.inRibAt + t.inRibDur
  const rider = t.enDelay + t.enDur
  // prop โผล่ไล่กันสามชิ้น (จานสี → สวิตช์ → เคอร์เซอร์) ชิ้นท้ายห่างจากชิ้นแรกสองช่วง
  const props = rider + t.inPropAt + t.inPropGap * 2 + t.inPropDur
  return Math.max(windows, ribbon, rider, props, t.inCamDur)
}

/** อินโทรเล่นจบไปแล้วกี่วินาที (ติดลบ = ยังไม่จบ / ยังไม่เริ่ม) */
export function introSince() {
  const now = introTime()
  return now < 0 ? -Infinity : now - introEnd()
}

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
  // เล่นใหม่โดยไม่มีสปแลชมามอร์ฟให้ = บานกับกล้องต้องกลับไปเล่นท่าของตัวเอง
  introSkip.windows = false
  introSkip.camera = false
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
    // ส่องนาฬิกาจากข้างนอกได้ตอนพัฒนา (ใช้จับจังหวะว่าของชิ้นไหนลงคิวตรงไหม)
    if (import.meta.env.DEV) {
      window.__intro = { armed: intro.armed, time: intro.time, end: introEnd() }
    }
  }, -1000)
  return null
}

/** เข้าเป้าแบบเลยไปนิดแล้วดีดกลับ — s = ความแรงของการเลย (0 = ease-out ธรรมดา) */
export function outBack(t, s = 1.4) {
  const x = Math.min(1, Math.max(0, t)) - 1
  return 1 + x * x * ((s + 1) * x + s)
}

/**
 * เล่นอินโทรใหม่ทันที (ปุ่มในแผง debug)
 *
 * ปกติ Entrance เป็นคนติดอาวุธให้หลังตัวละครขึ้นครบ — แต่ปิดตัวละครแล้วจะไม่มีใครเรียก
 * ทางนี้จึงออกตัวเองเลย ไม่ต้องรอ fallback สองวินาที
 */
export function replayIntro() {
  introSkip.windows = false
  introSkip.camera = false
  intro.held = false
  intro.wants = false
  intro.armed = true
  intro.time = 0
  intro.waited = 0
}
