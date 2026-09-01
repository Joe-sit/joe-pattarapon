import { useSyncExternalStore } from 'react'

/**
 * ค่าปรับฉาก /new-hero — สโตร์เล็ก ๆ นอก React
 *
 * ค่ากล้องถูกอ่านทุกเฟรมใน useFrame (ห้ามผ่าน state ไม่งั้น re-render 60 ครั้ง/วินาที)
 * ส่วนค่าที่เปลี่ยนรูปทรง (ขนาดแผง ระยะห่าง) อ่านผ่าน useTuner() เพราะต้องสร้าง geometry ใหม่
 *
 * ค่าเริ่มต้นคือค่าที่แก้ได้จากชีท perspective 12739:158714 — ดู docs/new-hero-handoff.md
 */
export const DEFAULTS = {
  clay: 0,
  props: 0,
  grid: 0,
  skater: 1,
  propScale: 0.55,
  propX: 0,
  propY: 2.4,
  propZ: 0,
  fov: 56.26,
  pitch: 1.57,
  camX: 16.6,
  camY: 1,
  camZ: 15,
  fitMax: 1,
  groundYaw: 45.23,
  bandYaw: 26.02,
  panelCount: 4,
  panelW: 11.4,
  panelH: 11.5,
  panelD: 0.1,
  panelGap: 12.54,
  panelX: 6.36,
  panelZ: -11,
  panelBase: -1.6,
  gridY: 0,
  gridCell: 0.2,
  ribbonScale: 1.57,
  ribbonW: 6.5,
  ribbonThick: 0.12,
  ribbonWave: 0.97,
  ribbonWaves: 1.9,
  ribbonX: 6.1,
  ribbonY: -2.6,
  ribbonZ: -4,
  ribbonRotX: -8,
  ribbonRotY: 37.5,
  ribbonRotZ: 1.5,
  skaterScale: 1.41,
  skaterX: 5.9,
  skaterY: 2.15,
  skaterZ: 12.85,
  skaterRotX: -6,
  skaterRotY: -31.5,
  skaterRotZ: 0,
  mascotScale: 1.01,
  mascotLift: 1.84,
  boardScale: 1,
  bdLen: 0.56,
  bdWide: 0.3,
  bdThick: 0.022,
  bdTip: 0.26,
  bdKick: 21.8,
  bdTruckX: 0.235,
  bdWheelR: 0.038,
  bdWheelW: 0.058,
  bdRideY: 0.135,
  boardRotX: 2.5,
  boardRotY: -36,
  boardRotZ: -0.5,
  /**
   * ลำตัว (องศา) — lean = เอียงทั้งตัวรวมขา / fold = พับเฉพาะช่วงบน เท้าอยู่กับที่
   */
  leanX: 14.9,
  leanZ: -9.2,
  foldX: 0,
  foldY: 0,
  foldZ: 0,
  headX: -11.5,
  /**
   * ขา (องศา)
   *
   * มุมในระนาบข้าง (hipX + knee + ankle) ต้องเท่ากันทั้งสองข้าง ไม่งั้นเท้าอยู่คนละ
   * ระดับ บอร์ดไปเกาะเท้าที่ต่ำกว่า อีกข้างลอย — ความต่างของท่ายืนไปอยู่ที่ hipY/hipZ
   * (กางออกข้าง/บิด) ซึ่งไม่กระทบความสูงของฝ่าเท้า
   *
   * ผลรวม hipX + knee + ankle ≈ 0 คือฝ่าเท้าขนานกับหน้าแผ่น
   */
  hipLX: -120,
  hipLY: 17.2,
  hipLZ: 9.2,
  kneeL: 98,
  ankleL: -4,
  hipRX: -114,
  hipRY: -12.6,
  hipRZ: -6.9,
  kneeR: 98,
  ankleR: -2,
  armScale: 1,
  foreScale: 1.18,
  aimX: 1,
  aimY: 0.16,
  aimZ: -0.08,
  elbowX: -20.5,
  elbowY: 19,
  elbowZ: 20.5,
  wristX: 0,
  wristY: -1,
  wristZ: 0,
  mugShX: -15,
  mugShY: 29,
  mugShZ: -39,
  mugElX: -56.5,
  mugElY: 2,
  mugElZ: 8.5,
}

// ขึ้นเวอร์ชันเมื่อชุดคีย์/ค่าเริ่มต้นเปลี่ยนแนว — ค่าที่ค้างในเบราว์เซอร์จะได้ไม่ทับของใหม่
const KEY = 'newhero.tuner.v20'

function load() {
  /**
   * นอกโหมด dev อ่านจาก DEFAULTS อย่างเดียว
   *
   * หน้า /2026-final ใช้ฉากเดียวกันนี้ ถ้าปล่อยให้อ่าน localStorage ค่าที่ใครสักคน
   * เผลอลากทิ้งไว้ตอนจูนจะติดไปกับหน้าจริงของเขาเอง โดยที่ไม่มีแผงให้แก้กลับ
   */
  if (!import.meta.env.DEV) return { ...DEFAULTS }
  if (typeof localStorage === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    // เก็บเฉพาะคีย์ที่รู้จัก — ค่าเก่าจากเวอร์ชันก่อนจะได้ไม่ค้างมาเป็นคีย์ผี
    const saved = JSON.parse(raw)
    const out = { ...DEFAULTS }
    for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === 'number') out[k] = saved[k]
    return out
  } catch {
    return { ...DEFAULTS }
  }
}

let state = load()
const subs = new Set()

export function getTuner() {
  return state
}

export function setTuner(patch) {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* โหมดส่วนตัว/บล็อกสตอเรจ — ปรับได้อยู่ แค่ไม่จำข้ามรีเฟรช */
  }
  subs.forEach((f) => f())
}

export function resetTuner() {
  setTuner({ ...DEFAULTS })
}

function subscribe(f) {
  subs.add(f)
  return () => subs.delete(f)
}

export function useTuner() {
  return useSyncExternalStore(subscribe, getTuner, getTuner)
}

/**
 * ตำแหน่งจริงในโลกของ mascot — ฉากเขียนทุกเฟรม แผงอ่านไปแสดง
 *
 * เป็นออบเจกต์นิ่งที่ mutate ทับ ไม่ใช่ state: ค่าเปลี่ยนทุกเฟรม ถ้าเป็น state
 * จะ re-render 60 ครั้งต่อวินาที แผงอ่านด้วยการ tick เองทุก 200ms ก็พอ
 */
export const READOUT = { x: 0, y: 0, z: 0, sole: 0, deck: 0, gap: 0, low: '' }

const RAD = Math.PI / 180

/**
 * ค่าที่ ref บอกไว้ — ใช้เทียบว่ามุมที่ปรับอยู่ตรงกับชีทหรือยัง
 * (วัดจากชีท 1199x735: horizon แถว 185, VP ที่ x=25 กับ x=1165)
 */
export const REF = { w: 1440, h: 1024, horizonY: 478.2, bandVP: 3253.2 }

/**
 * ฉายค่ากล้องปัจจุบันกลับเป็นตัวเลขที่วัดได้บนเฟรม — horizon กับ VP สองข้าง
 * คิดที่สัดส่วนเฟรมของ ref เสมอ จะได้เทียบกับเลขที่วัดจากชีทได้ตรง ๆ
 */
export function projectGuides(t, w = REF.w, h = REF.h) {
  const f = h / 2 / Math.tan((t.fov * RAD) / 2)
  const th = t.pitch * RAD
  const horizonY = h / 2 - f * Math.tan(th)
  const k = f / Math.cos(th)
  // จุดลู่ของแกนแถบหน้าต่าง — เส้นบน/ล่างที่ผู้ใช้วาดไว้ตัดกันตรงนี้
  const bandVP = w / 2 + k / Math.tan(t.bandYaw * RAD)
  return { f, horizonY, bandVP, w, h }
}
