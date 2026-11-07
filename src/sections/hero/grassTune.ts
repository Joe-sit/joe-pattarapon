import { useSyncExternalStore } from 'react'

/**
 * ค่าจัดท่าตัวละคร + กล้องของฉากหญ้า (GrassStage) — สโตร์เปล่าที่ฉากอ่านทุกเฟรม (แผงจูน dev: ./GrassTuner)
 *
 * ไม่ส่งผ่าน prop: ทุกการลากจะ reconcile ต้นไม้ r3f ทั้งก้อน · เก็บใน localStorage (dev)
 * มุมเป็นองศา (ฉากแปลงเอง) · ทิศแขนขวา (aimX/Y/Z) เป็นเวกเตอร์ · ระยะเป็นหน่วยฉาก (เมตร)
 */
export type GrassTune = Record<string, number>

/**
 * ค่าตั้งต้น = วัดเทียบภาพ ref ของ Joe (ซ้อนภาพที่ขนาด 1672×941): กล้องต่ำติดหญ้า เลนส์ 56° ระยะ ~2.4 ม.
 * ยืนกางขา หันตัว 40° · มือขวา (มือ 3D แบบ Frame 1) ยกมือถือข้างหน้าซ้ายของหน้า หลังเครื่องหันออก เอียงตามเข็มนิด · ศอกแนบตัว
 * หน้า 3/4 ก้มมองจอ · มือซ้ายห้อยข้างตัวล้วงกระเป๋า (ซ่อนมือ)
 */
export const TUNE_DEFAULTS: GrassTune = {
  riderX: -1.35,
  riderZ: 1.3,
  riderYaw: 28,
  riderH: 1.82,
  mirror: 1,
  camX: -0.9,
  camY: 0.22,
  camZ: 3.3,
  lookX: -0.3,
  lookY: 1.2,
  lookZ: 1.3,
  fov: 56,
  arcBulge: 0.6,
  headYaw: -50,
  headPitch: 4,
  headRoll: 0,
  headS: 0.85,
  neckX: 0,
  leanX: 0,
  leanZ: 0,
  foldX: 0,
  foldY: 0,
  foldZ: 0,
  spread: 0,
  stagger: 0,
  lHipX: 0,
  lHipY: 0,
  lHipZ: 8,
  lKnee: 0,
  lAnkle: 0,
  rHipX: 0,
  rHipY: 0,
  rHipZ: -8,
  rKnee: 0,
  rAnkle: 0,
  aimX: 0,
  aimY: -0.7,
  aimZ: 0.7,
  elbowX: -75,
  elbowY: -55,
  elbowZ: 0,
  wristX: 0,
  wristY: 0,
  wristZ: 0,
  aimOut: 0.365,
  aimUp: -0.19,
  aimFwd: 0,
  mugShX: 15,
  mugShY: 0,
  mugShZ: 12,
  mugElX: -5,
  mugElY: 20,
  mugElZ: 0,
  mugWristX: 0,
  mugWristY: 0,
  mugWristZ: 0,
  mugOut: 0,
  mugUp: 0,
  mugFwd: 0,
  pocket: 1,
  phoneShow: 1,
  phoneHand: 0,
  headPhoneX: 0.3,
  headPhoneY: -0.2,
  headPhoneZ: 0.2,
  phoneRX: 0,
  phoneRY: -40,
  phoneRZ: -62,
  phoneS: 0.8,
  gripX: 0.13,
  gripY: -0.06,
  gripZ: -0.04,
  gripRX: 0,
  gripRY: 0,
  gripRZ: 90,
  gripS: 0.38,
  curlB: 75,
  curlM: 55,
  curlT: 30,
  thumbB: -50,
  thumbT: 20,
  thumbH: 10,
}

/**
 * เก็บเฉพาะค่าที่ต่างจากค่าตั้งต้น — ค่าตั้งต้นที่ปรับในโค้ดทีหลังจึงถึงหน้าจอ (เดิมเก็บทั้งก้อน ค่าตั้งต้นเก่าค้างทับของใหม่ทุกครั้ง)
 * v5: เริ่มใหม่ (คีย์เก่า v1–v4 เก็บค่าตั้งต้นเก่าไว้ทั้งก้อน แยกไม่ออกว่าค่าไหนจูนเอง)
 */
const KEY = 'grassTune.v5'
function load(): GrassTune {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const got = JSON.parse(raw) as GrassTune
      for (const k of Object.keys(got)) if (!(k in TUNE_DEFAULTS)) delete got[k]
      return { ...TUNE_DEFAULTS, ...got }
    }
  } catch {
    /* ไม่มีที่เก็บ */
  }
  return { ...TUNE_DEFAULTS }
}
export const GRASS_TUNE: GrassTune = import.meta.env.DEV ? load() : { ...TUNE_DEFAULTS }

/** ผู้ฟังการเปลี่ยนค่า (ค่าที่ต้อง re-render — หัว/กระจก — กับตัวแผง) */
export const tuneBus = { subs: new Set<() => void>() }
let snap: GrassTune = { ...GRASS_TUNE }
function emit() {
  snap = { ...GRASS_TUNE }
  tuneBus.subs.forEach((f) => f())
  try {
    const diff: GrassTune = {}
    for (const k of Object.keys(GRASS_TUNE)) if (GRASS_TUNE[k] !== TUNE_DEFAULTS[k]) diff[k] = GRASS_TUNE[k]
    localStorage.setItem(KEY, JSON.stringify(diff))
  } catch {
    /* ไม่มีที่เก็บ */
  }
}
export function setGrassTune(patch: GrassTune) {
  Object.assign(GRASS_TUNE, patch)
  emit()
}
export function resetGrassTune() {
  Object.assign(GRASS_TUNE, TUNE_DEFAULTS)
  emit()
}
const subscribe = (f: () => void) => {
  tuneBus.subs.add(f)
  return () => {
    tuneBus.subs.delete(f)
  }
}
export const useGrassTune = () => useSyncExternalStore(subscribe, () => snap)


/* dev: ตั้งค่าจากคอนโซล/สคริปต์ทดสอบได้ตรง ๆ (window.__grass.set({...})) — ใช้เทียบภาพกับ ref */
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __grass?: object }).__grass = { set: setGrassTune, get: () => ({ ...GRASS_TUNE }), reset: resetGrassTune }
