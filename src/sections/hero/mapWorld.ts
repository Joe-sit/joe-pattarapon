import * as THREE from 'three'
import { DEVICE, smooth, worksPost } from './workMotion'

/**
 * เรื่องแผนที่ (POST_CODE = 'map' ใน ./workMotion) — ใช้ร่วมกันสองแคนวาส:
 *   ./BubbleTraveler  ตัวเครื่องแก้วล้มลงนอนราบบนพื้นเมือง แล้วติดไปกับพื้นตอนเลื่อนแผนที่
 *   ./MapStage        เมืองดินปั้น (ถนนขาว บล็อกเทา ต้นไม้กลม เสาไฟ ม้านั่ง) + ป้ายผลงานกระจายรอบเมือง
 *
 * พิกัดฉากของทั้งสองแคนวาส = px (กลางจอ = 0 · y ขึ้น) กล้องเพอร์สเปกทีฟเดียวกัน (FOV · camDist) — ของจึงทาบกันพอดี
 * พื้นเมือง: ระนาบ xz (y ขึ้น) หน่วย "ช่อง" · เอียงหงายเข้ากล้อง MAP_EL แล้วหมุนแนวถนน MAP_AZ แบบภาพไอโซเมตริก
 */

/** worksPost: ทัวร์ไปตามป้ายผลงานทีละชิ้น [เริ่ม, จบ] · ออก [เริ่ม, ยาว]: กลับจุดลงจอด เครื่องลุกขึ้น ต่อบท Ship */
export const MAP_SCROLL = [1.2, 2.05] as const
export const MAP_OUT = [2.12, 0.34] as const
/** มุมกล้อง: เงยจากพื้น · หมุนแนวถนน (เรเดียน) */
export const MAP_EL = (36 * Math.PI) / 180
export const MAP_AZ = (-38 * Math.PI) / 180
/** px ต่อหน่วยพื้น (× ความสูงจอ) */
export const MAP_K = 0.088
/** ความสูงที่เครื่องลอยก่อนลง (หน่วยพื้น) · กล้องตามเครื่องลงกี่ส่วน (ที่เหลือ = เครื่องเลื่อนลงบนจอ) · เครื่องใกล้กล้องตอนอยู่สูง ขยายนิด */
export const ALT0 = 13
const FOLLOW = 0.72
const ALT_GROW = 0.28
/** จุดลงจอดบนจอ (× ความสูงจอ · y ขึ้น) — ต่ำกว่ากลางนิด เห็นเมืองด้านหลังมากกว่า */
export const MAP_Y = -0.05
/** ครึ่งความยาวเครื่องตอนนอนบนพื้น (หน่วยพื้น) · หมุนบนพื้น (ตามแนวถนน) */
export const PHONE_HH = 2.35
const PHONE_YAW = 0
/** ระยะห่างช่องเมือง (บล็อก + ถนน) · กว้างถนน · ขอบที่ให้เดินได้ (หน่วยพื้น) */
export const PITCH = 7
export const ROAD = 1.5
export const PAN_MAX = 2.6 * PITCH

/**
 * จังหวะลงจอด (worksPost — ติดลบ = ยังอยู่ในบท Code) [เริ่ม, ยาว]:
 *   TURN    เครื่องลอยค้าง ค่อย ๆ หงายลงเป็นแนวราบ
 *   GROUND  ฉาก Code (มืด) จางเป็นท้องฟ้าชุดเดียวกับเรื่องก่อนหน้า — เครื่องลอยอยู่เหนือทะเลเมฆ (ยังไม่เห็นพื้น)
 *   DESCEND เครื่องลอยลงช้า ๆ ผ่านก้อนเมฆ (เมฆไหลขึ้นผ่านเครื่อง) · ชั้นเมฆบางลงจนเห็นเมืองข้างใต้ (mapReveal) · เงาใต้เครื่องเข้มขึ้น
 *   DUST    แตะพื้น: วงฝุ่น
 *   GROW    เมืองงอกออกจากเครื่องเป็นคลื่นวงกว้างออกไป (บล็อกยกตัว ต้นไม้ผลิ ป้ายผลงานตั้งขึ้น)
 */
export const MAP_TURN = [-0.68, 0.42] as const
export const MAP_GROUND = [-0.56, 0.3] as const
export const MAP_DESCEND = [-0.46, 0.82] as const
export const MAP_DUST = [0.34, 0.3] as const
export const MAP_GROW = [0.34, 0.8] as const

/** ชั้นเมฆ (ระนาบสีฟ้าเหนือเมือง) ที่ความสูงนี้ · เมืองโผล่ (0 = ยังเป็นฟ้า → 1 = เห็นเมืองเต็ม) ตามความสูงเครื่อง */
export const DECK_H = 3.2
export const mapReveal = (alt: number) => 1 - smooth((alt - 1.4) / 4.2)

const at01 = (x: number, r: readonly [number, number]) => Math.min(1, Math.max(0, (x - r[0]) / r[1]))

/**
 * ท่าของเรื่องแผนที่ ณ ความคืบหน้าตอนนี้
 *   land  0→1  เครื่องจากท่าตั้งหงายเป็นแนวราบ (ลอยอยู่)
 *   map   0→1  พื้นจางเข้า
 *   alt        ความสูงเครื่องจากพื้น (หน่วยพื้น) ALT0 → 0
 *   dust  0→1  วงฝุ่นตอนแตะพื้น
 *   grow  0→1  เมืองงอก (คลื่นจากเครื่องออกไป)
 *   out   0→1  ช่วงออก: กล้องกลับจุดลงจอด ทุกอย่างย้อน
 */
export function mapPhase(b: { code: number; works: number }) {
  const post = worksPost(b)
  const out = smooth((post - MAP_OUT[0]) / MAP_OUT[1])
  const keep = 1 - out
  return {
    post,
    out,
    land: smooth(at01(post, MAP_TURN)) * keep,
    map: smooth(at01(post, MAP_GROUND)) * keep,
    alt: ALT0 * (1 - smooth(at01(post, MAP_DESCEND))),
    dust: at01(post, MAP_DUST),
    grow: at01(post, MAP_GROW),
  }
}

/**
 * สถานะร่วมต่อเฟรม — MapStage ตั้งเป้า (tx tz) · stepMap ไล่ตำแหน่งจริง (px pz) นุ่ม ๆ
 * land/map เขียนโดย BubbleTraveler (ตัวคำนวณท่าเครื่อง) · wake = ปลุกแคนวาสเครื่องให้วาดใหม่ตอนพื้นเลื่อนโดยไม่มีการสกรอลล์
 */
export const mapLive = { land: 0, map: 0, alt: ALT0, dust: 0, grow: 0, px: 0, pz: 0, tx: 0, tz: 0, t: 0, wake: null as null | (() => void) }

/** ไล่ตำแหน่งกล้องเข้าหาเป้า — เรียกได้หลายที่ต่อเฟรม (นับครั้งเดียวต่อเฟรม) */
export function stepMap() {
  const now = performance.now()
  const dt = Math.min(0.05, (now - mapLive.t) / 1000)
  if (dt < 0.004) return
  mapLive.t = now
  const a = 1 - Math.exp(-dt * 6)
  const dx = mapLive.tx - mapLive.px
  const dz = mapLive.tz - mapLive.pz
  if (Math.abs(dx) + Math.abs(dz) < 1e-4) return
  mapLive.px += dx * a
  mapLive.pz += dz * a
  mapLive.wake?.()
}

/** ทิศบนจอเป็นทิศบนพื้น: ขวาของจอ · ขึ้นของจอ (ลึกเข้าไป) */
export const SCREEN_R = new THREE.Vector3(Math.cos(MAP_AZ), 0, Math.sin(MAP_AZ))
export const SCREEN_F = new THREE.Vector3(Math.sin(MAP_AZ), 0, -Math.cos(MAP_AZ))

const G_P = new THREE.Vector3()
const G_Q = new THREE.Quaternion()
const G_E = new THREE.Euler()
const G_S = new THREE.Vector3()
const G_T = new THREE.Matrix4()

/** px ต่อหน่วยพื้น */
export const mapScale = (H: number) => H * MAP_K

/**
 * เมทริกซ์ พื้นเมือง → ฉาก (px) — รวมการเลื่อนแผนที่แล้ว (จุดลงจอดของเครื่อง = 0 ของพื้น)
 * alt = ความสูงเครื่องตอนนี้: กล้องตามเครื่องลง (พื้นเลื่อนต่ำลงบนจอตามความสูง) — เครื่องลงแค่ส่วนที่เหลือบนจอ
 */
export function mapGround(m: THREE.Matrix4, H: number, alt: number) {
  const k = mapScale(H)
  G_Q.setFromEuler(G_E.set(MAP_EL, MAP_AZ, 0, 'XYZ'))
  m.compose(G_P.set(0, H * MAP_Y - alt * k * Math.cos(MAP_EL) * FOLLOW, 0), G_Q, G_S.setScalar(k))
  return m.multiply(G_T.makeTranslation(-mapLive.px, 0, -mapLive.pz))
}

const P_Q = new THREE.Quaternion()
const P_E = new THREE.Euler()
/** หน่วยพื้นต่อ px ของเครื่อง (ขนาดตั้งต้น) ตอนนอนบนพื้น */
export const PHONE_S = PHONE_HH / DEVICE.hh

/** เมทริกซ์ เครื่อง (px ขนาดตั้งต้น · จอหัน +z) → พื้น: นอนหงายจอขึ้น ลอยสูง alt (แตะพื้น = ยกขึ้นครึ่งความหนา) */
export function phoneOnGround(m: THREE.Matrix4, thick: number, alt: number) {
  P_Q.setFromEuler(P_E.set(-Math.PI / 2, PHONE_YAW, 0, 'YXZ'))
  const s = PHONE_S * (1 + (ALT_GROW * alt) / ALT0)
  return m.compose(G_P.set(0, alt + (thick / 2) * s, 0), P_Q, G_S.setScalar(s))
}
