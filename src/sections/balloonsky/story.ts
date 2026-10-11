/**
 * บทของเรื่อง (สัดส่วนระยะเลื่อน 0..1) — ใช้ร่วมกันระหว่างข้อความบนจอกับท่าในฉาก
 */
export const BEATS = [
  { at: 0.0, len: 0.14, kicker: '01 — Morning', text: 'Pip watches the sky every morning.' },
  { at: 0.18, len: 0.16, kicker: '02 — The parade', text: 'Every balloon carries somebody’s story.' },
  { at: 0.38, len: 0.12, kicker: '03 — Click', text: 'Pip keeps the ones worth keeping.' },
  { at: 0.55, len: 0.16, kicker: '04 — An invitation', text: 'Today, one of them came down for Pip.' },
  { at: 0.82, len: 0.18, kicker: '05 — Above the clouds', text: 'Some stories you have to go and see.' },
] as const

/** ช่วงเวลาสำคัญในฉาก */
export const T = {
  /** กล้องถอยออกเห็นฝูงบอลลูน */
  reveal: [0.12, 0.2],
  /** Pip หันตาม ยกหัวเล็ง แล้วลั่นชัตเตอร์ */
  aim: [0.34, 0.08],
  shutter: 0.445,
  /** บอลลูนลูกหลักลงมาจอดข้างหอ */
  dock: [0.5, 0.17],
  /** Pip กระโดดลงตะกร้า */
  hop: [0.7, 0.07],
  /** ลอยขึ้นทะลุเมฆ */
  rise: [0.76, 0.22],
} as const

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const span = (p: number, [a, d]: readonly [number, number]) => clamp01((p - a) / d)

/** ความเด่นของบท (0..1): ขึ้นช่วงแรกของบท ค้าง แล้วออกช่วงท้าย — บทสุดท้ายค้างถึงจบ */
export function beatOf(p: number, b: (typeof BEATS)[number]) {
  const last = b === BEATS[BEATS.length - 1]
  const fadeIn = clamp01((p - b.at) / 0.035)
  const fadeOut = last ? 1 : clamp01((b.at + b.len - p) / 0.035)
  return Math.min(fadeIn, fadeOut)
}
