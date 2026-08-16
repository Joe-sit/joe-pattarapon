/**
 * ไทม์ไลน์ intro — เล่นครั้งเดียว เริ่มตอนสปแลชเปิดรูออก
 *
 * เล่าเป็น "บีต" ต่อกันแบบเดียวกับ scroll.js ต่างกันที่บีตของ intro ไม่ทับกัน (ดูตารางล่าง)
 *
 *   face   หน้าตรงระยะใกล้ เห็นลูกตาสองข้าง ขยิบตาข้างเดียว แล้วหันหัวสงสัย
 *   pull   ถอยกล้องออกพร้อมแพนหมุนไปหามุมสุดท้าย
 *   crop   กรอบ crop tool วิ่งจากที่ตั้งต้นเข้ากลางจอ (มือที่ชี้ตามกรอบไปด้วย)
 *   title  สโลแกนขึ้น กรอบหดลงมาครอบคำว่า vision
 *
 * ต่างจาก scroll.js ตรงที่ตัวขับคือ "เวลา" ไม่ใช่ตำแหน่ง scroll — แต่หน้าตาการใช้งาน
 * เหมือนกัน (introState.b.<ชื่อ>) ฝั่ง Canvas จึงอ่านเหมือนกันทั้งสองระบบ
 */

/**
 * [ชื่อ, เริ่มวินาทีที่, จบวินาทีที่]
 *
 * บีตทับกันโดยตั้งใจ — วงดนตรี ไม่ใช่คิวคนต่อแถว
 *
 * เคยเรียงแบบไม่ทับกันเลย (ทีละท่าให้จบก่อนค่อยขึ้นท่าใหม่) ผลคือทุกอย่าง "รอกัน":
 * หัวหันจบแล้วกล้องค่อยถอย ถอยจนสุดแล้ว crop tool ค่อยออกเดิน แต่ละท่าจึงอ่านเป็นคลิปสั้น ๆ
 * ต่อกันมากกว่าเป็นฉากเดียวที่มีชีวิต ตอนนี้ให้เหลื่อมกัน แต่ละท่าเริ่มตอนท่าก่อนหน้ายังไม่จบ
 *
 *   0.0 ──face──── 3.2
 *        2.9 ────pull──────── 7.0
 *              4.4 ───crop────── 7.6
 *                      6.9 ────title──── 10.2
 *
 * จุดที่จงใจให้ตรงกัน:
 *   - หัวเริ่มหัน (ท้ายบีต face) = กล้องเริ่มถอย
 *   - crop tool ออกเดินกลางบีต pull และวิ่งไปได้ ~90% ตอนกล้องถึงท่าสุดท้ายพอดี
 *   - สโลแกนเริ่มขึ้นตอน crop tool ยังไถลเข้าที่ กรอบจึงไล่ครอบคำที่กำลังโผล่ ไม่ใช่รอคำขึ้นครบ
 *
 * เวลาเริ่มนับตอน "รูของตัว O เริ่มเปิด" ไม่ใช่ตอนสปแลชหายไป — ฉากข้างหลังต้องกำลัง
 * เคลื่อนอยู่แล้วตอนรูบาน (พารัลแลกซ์) วินาทีแรก ๆ ของบีต face จึงยังถูกกระดาษบังอยู่บางส่วน
 * ท่าที่ต้องให้เห็นจริง ๆ (ขยิบตา หันหัว) เลยวางไว้หลังวินาทีที่ 1.4 ซึ่งสปแลชหมดแล้ว
 */
export const INTRO_BEATS = [
  ['face', 0.0, 3.2],
  ['pull', 2.9, 7.0],
  ['crop', 4.4, 7.6],
  ['title', 6.9, 10.2],
]

export const INTRO_SECONDS = 10.2

export const introState = {
  /** เวลาที่เดินไปแล้ว (วินาที) */
  t: 0,
  /** กำลังเล่นอยู่ไหม — จบแล้วเป็น false และค่าบีตค้างที่ปลายทาง */
  playing: false,
  /** เคยเล่นจบหรือยัง — กันไม่ให้ scroll ย้อนกลับมาเล่นซ้ำ */
  done: false,
  b: Object.fromEntries(INTRO_BEATS.map(([name]) => [name, 0])),
  /**
   * ตำแหน่งโลกของสองอย่างที่ชิ้นอื่นต้องเล็ง — เขียนโดยเจ้าของ อ่านโดยคนอื่น
   * eyes: กลางระหว่างลูกตา (กล้อง close-up เล็งจุดนี้)
   * crop: กลางกรอบ crop tool (แขนที่ชี้เล็งจุดนี้)
   */
  eyes: null,
  crop: null,
  /**
   * ท่ากล้องช่วง close-up ที่ "ล็อกไว้" ตั้งแต่เฟรมแรกของ intro
   *
   * ถ้าปล่อยให้กล้องคิดจากตำแหน่งตาสด ๆ ทุกเฟรม พอหัวหันกล้องจะหันตามไปด้วย —
   * หัวเลยดูนิ่งและโลกทั้งใบแกว่งแทน ซึ่งอ่านเป็น "โยกตัว" ไม่ใช่ "หันหัวมองโน่นนี่"
   * ล็อกจุดตากับทิศหน้าไว้ครั้งเดียว เฟรมนิ่ง หัวขยับอยู่ในเฟรม = มองไปรอบ ๆ จริง ๆ
   */
  close: null,
  /**
   * ปลายทางของ crop tool ตอนหดไปครอบคำว่า vision — { scale, at:[x,y], w }
   * คิดจากกล่องข้อความจริงใน DOM (ดู CropRig) w = ความกว้าง viewport ตอนคิด ไว้รู้ว่าต้องคิดใหม่
   */
  title: null,
  /** กล่องของสโลแกนในสเปซของกลุ่ม panel — Slogan เป็นคนเขียน CropRig เป็นคนอ่าน */
  slogan: null,
}

/**
 * เปิดช่องให้จับเวลาไทม์ไลน์ได้จากภายนอกตอน dev
 *
 * ไทม์ไลน์ยาวสิบวินาที ส่วน screenshot หนึ่งใบใช้เวลาเกือบวินาที — ถ้าไม่มีทางตั้งเวลาเอง
 * จะเก็บภาพได้แค่ช่วงต้น แล้วเข้าใจผิดว่าบีตหลัง ๆ ทำงาน ทั้งที่ยังไม่เคยเห็น
 * (เกิดขึ้นมาแล้วรอบหนึ่ง) ตั้ง window.__intro.t = 2.5 แล้วถ่ายได้ตรงจังหวะที่ต้องการ
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__intro = introState
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** ตัดช่วงเวลา [a,b] ออกมาเป็น 0..1 ของตัวเอง */
export const at = (t, a, b) => clamp01((t - a) / (b - a))

export function startIntro() {
  introState.close = null
  introState.title = null
  if (introState.done) return
  introState.t = 0
  introState.playing = true
  for (const [name] of INTRO_BEATS) introState.b[name] = 0
}

/** เดินเวลาไปหนึ่งเฟรม — เรียกจาก useFrame ที่เดียว (ดู IntroClock ใน App.jsx) */
export function tickIntro(dt) {
  if (!introState.playing) return
  introState.t = Math.min(introState.t + dt, INTRO_SECONDS)
  for (const [name, a, b] of INTRO_BEATS) introState.b[name] = at(introState.t, a, b)
  if (introState.t >= INTRO_SECONDS) {
    introState.playing = false
    introState.done = true
  }
}

/** ออกจากหน้าแล้วเริ่มใหม่ได้ — ใช้ตอน unmount */
export function resetIntro() {
  introState.close = null
  introState.title = null
  introState.t = 0
  introState.playing = false
  introState.done = false
  for (const [name] of INTRO_BEATS) introState.b[name] = 0
}

/** true ระหว่างที่ intro ยังคุมกล้องอยู่ — scroll ต้องไม่แย่งคุมในช่วงนี้ */
export function introHoldsCamera() {
  return introState.playing
}
