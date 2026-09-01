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
  /* สวิตช์ (0/1) — เก็บเป็นตัวเลขเพราะสโตร์นี้รับเฉพาะตัวเลข */
  clay: 1,
  props: 0,
  grid: 0,
  skater: 1,
  /* หน้าต่างเป็นพอร์ทัลมองทะลุไปอีกฉาก (ใช้ stencil buffer) */
  portal: 1,
  /**
   * ริบบิ้นในพอร์ทัล — คนละชิ้นกับเส้นหลัก จงใจไม่ผูกกัน
   * ระยะไกลกว่ามาก ค่ากว้าง/หนา/คลื่นจึงต้องแรงกว่าเส้นหน้า ไม่งั้นเหลือเป็นเส้นบาง
   */
  portalZ: -22.5,
  /* ฉาก joespresso ในพอร์ทัล (ฟ้า/เนิน/ต้นไม้) */
  joe: 1,
  joeSky: 1,
  joeTerrain: 1,
  joeFoliage: 1,
  /**
   * y/z ชุดนี้ได้จากการกวาดค่าแล้วดูภาพจริง ไม่ใช่กะ — ค่าเดิม (y -6, z -6) มาจาก
   * ตอนที่ matrix ของฉากยังไม่อัปเดตตามกลุ่มแม่ พอแก้ให้อัปเดตจริง ฉากเลยหลุดกรอบไป
   */
  joeScale: 1.3,
  joeX: 14,
  joeY: 1.5,
  joeZ: 5.5,
  joeRotX: 12,
  joeRotY: -16.5,
  joeRotZ: 0,
  /* ผนัง/ไฟของฉากในพอร์ทัล */
  /**
   * หน้าต่างโปรแกรมซ้อนกันเป็นรอยลาก (แบบ XP ค้าง) — ของประกอบฉากในพอร์ทัล
   * ระยะเลื่อนต้องเท่ากันทุกชั้น ไล่ไม่เท่ากันแล้วอ่านเป็นของสามชิ้นวางเรียง
   */
  sw: 1,
  swCount: 3,
  swW: 9,
  swH: 6.5,
  swBar: 0.16,
  swDepth: 0.035,
  swRadius: 0.07,
  swBtn: 0.17,
  swInset: 0.04,
  swDX: 1.34,
  swDY: -1.01,
  swDZ: -0.45,
  swScale: 0.7,
  swX: -1.5,
  swY: 8.5,
  swZ: 7,
  swRotX: 7,
  swRotY: 31.5,
  swRotZ: -3,
  /**
   * บล็อกเตตริส — ของประกอบฉากในพอร์ทัลอีกชิ้น
   * teShape เป็นดัชนีของรูปทรง (0=S 1=Z 2=T 3=L 4=O 5=I) ค่าเริ่มต้นคือตัว S ตาม ref
   */
  te: 1,
  teShape: 0,
  teDepth: 0.9,
  teRadius: 0.16,
  teGap: 0.05,
  teScale: 2.2,
  teX: 0,
  teY: 1,
  teZ: 7,
  teRotX: -8,
  teRotY: 24,
  teRotZ: -12,
  /** สวิตช์เปิด/ปิด — ลอยหน้าแถบหน้าต่าง (พิกัดชุดเดียวกับริบบิ้น/ตัวละคร) */
  bc: 1,
  bcLen: 2.3,
  bcRadius: 0.6,
  /** ตำแหน่งปุ่ม 0 = ปิด (ซ้าย) 1 = เปิด (ขวา) */
  bcPos: 1,
  bcOpacity: 0.8,
  bcIcon: 0.76,
  bcScale: 1.7,
  bcX: 13.5,
  bcY: 2.5,
  bcZ: 16,
  bcRotX: -12,
  bcRotY: -65.5,
  bcRotZ: -8,
  portalWall: 1,
  portalHemi: 0.7,
  portalKey: 1.1,
  prW: 13.1,
  prThick: 0.53,
  prWave: 2.35,
  prWaves: 1.9,
  prScale: 0.36,
  prX: -18,
  prY: 6,
  prZ: 0,
  prRotX: -0.5,
  prRotY: -15,
  prRotZ: -4,
  /**
   * ไหวเบา ๆ
   *
   * `idle` ขยับทั้งตัวละครและบอร์ดเป็นก้อนเดียว เท้ายังแนบแผ่นตลอด
   * `breathe` คือไหวระดับข้อต่อของ rig ซึ่งบอร์ดตามไม่ได้ — เท้าจะไถหลุดจากแผ่น
   */
  idle: 1,
  breathe: 0,
  idleAmp: 1,
  idleSpeed: 1,
  /**
   * แสง — ambient ต่ำ แล้วไปเพิ่มที่ key/fill/rim
   * ดัน ambient สูงจะสว่างแบบแบน เพราะทุกหน้าได้แสงเท่ากันหมด
   */
  ambIntensity: 1.28,
  hemiIntensity: 0.86,
  keyIntensity: 4,
  fillIntensity: 0.6,
  rimIntensity: 3,
  exposure: 1,
  /* ของลอย: ปรับสเกล/ตำแหน่งรวมทีเดียว */
  propScale: 0.55,
  propX: 0,
  propY: 2.4,
  propZ: 0,
  /* กล้อง — แก้จากเส้น perspective ที่ผู้ใช้วาดเอง (12739:158699) แล้วจูนต่อด้วยมือ */
  fov: 56.26,
  pitch: 1.57,
  camX: 16.6,
  camY: 1,
  camZ: 15,
  /* ถอยกล้องเมื่อจอแคบ — 1 = ไม่ถอยเลย ค่ามุมกล้องที่แก้จากเส้นจึงตรงเป๊ะ */
  fitMax: 1,
  /* แกนพื้น/แถบแผง (องศา) */
  groundYaw: 45.23,
  bandYaw: 26.02,
  /* แถบหน้าต่าง */
  panelCount: 4,
  panelW: 11.4,
  panelH: 11.5,
  panelD: 0.1,
  panelGap: 12.54,
  panelX: 6.36,
  panelZ: -11,
  panelBase: -1.6,
  /* พื้น */
  gridY: 0,
  gridCell: 0.2,
  /* ริบบิ้น — อยู่ในพิกัดของกลุ่มแถบหน้าต่าง ออฟเซ็ต/การหมุนจึงเป็นพิกัดท้องถิ่น */
  ribbonScale: 1.57,
  ribbonW: 6.5,
  ribbonThick: 0.12,
  ribbonWave: 0.84,
  ribbonWaves: 1.9,
  ribbonX: 6.7,
  ribbonY: -2.4,
  ribbonZ: -4,
  /* หมุนรอบปากช่องบานที่ 2 (องศา) */
  ribbonRotX: -8,
  ribbonRotY: 37.5,
  ribbonRotZ: 1.5,
  /* ตัวละคร — พิกัดในกลุ่มแถบหน้าต่าง (เดียวกับริบบิ้น) */
  skaterScale: 1.87,
  skaterX: 8,
  skaterY: 2.65,
  skaterZ: 13.85,
  skaterRotX: -17,
  skaterRotY: -40,
  skaterRotZ: 0,
  /* ขนาด mascot เทียบกับบอร์ด และระยะยกพ้นแผ่น */
  mascotScale: 1.01,
  mascotLift: 1.84,
  boardScale: 1.47,
  /* รูปทรงสเก็ตบอร์ด — ทุกค่าอยู่ในสเกลของกล่องหน่วย (ยาวรวมราว 1) */
  bdLen: 0.56,
  bdWide: 0.3,
  bdThick: 0.022,
  bdTip: 0.26,
  bdKick: 21.8,
  bdTruckX: 0.235,
  bdWheelR: 0.038,
  bdWheelW: 0.058,
  bdRideY: 0.135,
  /* ขยับบอร์ดจากตำแหน่งที่จัดให้อัตโนมัติ (y = ระยะจากฝ่าเท้า) */
  boardX: -1.14,
  boardY: 0.09,
  boardZ: -0.275,
  boardRotX: 19,
  boardRotY: -22,
  boardRotZ: -13.5,
  /* ลำตัว (องศา) — lean = เอียงทั้งตัวรวมขา / fold = พับเฉพาะช่วงบน เท้าอยู่กับที่ */
  leanX: 14.9,
  leanZ: -9.2,
  foldX: 0,
  foldY: 0,
  foldZ: 0,
  headX: -11.5,
  /* ระยะห่างขาสองข้าง — เลื่อนจุดสะโพก ไม่ใช่หมุนให้กางออก ระดับเท้าจึงไม่เปลี่ยน */
  legSpread: 0.02,
  legStagger: 0,
  /* ขา (องศา) — ผลรวม hipX + knee + ankle ต้องเท่ากันสองข้างและใกล้ 0 ฝ่าเท้าจึงแนบแผ่น */
  hipLX: -117.5,
  hipLY: 17.2,
  hipLZ: 9.2,
  kneeL: 98,
  ankleL: 22,
  hipRX: -114,
  hipRY: -12.6,
  hipRZ: -6.9,
  kneeR: 98,
  ankleR: 16,
  /* สัดส่วนแขน: ทั้งแขน / เฉพาะท่อนล่าง+มือ */
  armScale: 1,
  foreScale: 1.22,
  /* ข้อต่อแขน — แขน A เล็งด้วยทิศทาง (เวกเตอร์) / แขน B คิดจากท่าพัก (องศา) */
  /* เลื่อนโคนแขนออกจากลำตัว (หน่วยของ mascot) — out = ออกนอกตัว / up = ขึ้น / fwd = ไปหน้า */
  aimOut: 0.365,
  aimUp: -0.19,
  aimFwd: -0.005,
  mugOut: 0.52,
  mugUp: -0.285,
  mugFwd: 0,
  /* หมุนทั้งแขนรอบข้อไหล่ (องศา) — ทั้งเส้นไปด้วยกัน คนละเรื่องกับมุมศอก/ข้อมือ */
  aimRotX: 0,
  aimRotY: 0,
  aimRotZ: 0,
  mugRotX: 0,
  mugRotY: 0,
  mugRotZ: 0,
  aimX: 1,
  aimY: 0.16,
  aimZ: -0.08,
  elbowX: -20,
  elbowY: 20,
  elbowZ: 14.5,
  /* ขนาดมือ (เฉพาะกำปั้น+นิ้ว) — ริกปั้นมือใหญ่กว่าปลายแขนมาก ย่อลงแล้วข้อมืออ่านเป็นข้อมือ */
  handScale: 1,
  wristX: 4,
  wristY: 0,
  wristZ: 2.5,
  mugShX: -5,
  mugShY: 26,
  mugShZ: -39,
  mugElX: -31.5,
  mugElY: 84.5,
  mugElZ: -29.5,
}

// ขึ้นเวอร์ชันเมื่อชุดคีย์/ค่าเริ่มต้นเปลี่ยนแนว — ค่าที่ค้างในเบราว์เซอร์จะได้ไม่ทับของใหม่
const KEY = 'newhero.tuner.v60'

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
