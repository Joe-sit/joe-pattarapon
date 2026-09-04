import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getTuner } from './tuner'
import { armIntro, introTime, resetIntro } from './intro'
import { portalRide } from './portalRide'
import { entranceLift } from './entranceLift'

/**
 * ทางเข้าของตัวละคร — ไหลออกมาจากในหน้าต่าง (พอร์ทัล) แล้วมาหยุดที่ท่าปัจจุบัน
 *
 * โครง: กลุ่มนอกถือ "ตำแหน่ง/มุม/สเกลปลายทาง" ตามปกติ (ค่าจากแผงจูน) ส่วนกลุ่มใน
 * เป็นตัววิ่ง — เริ่มจากออฟเซ็ตที่ห่างจากปลายทางแล้วไล่กลับมาที่ศูนย์ ผลคือค่าปลายทาง
 * ที่จูนไว้ไม่ต้องแตะเลย และเมื่อแอนิเมชันจบ กลุ่มในกลายเป็น identity พอดี
 *
 * จุดเริ่มระบุใน "พิกัดของกลุ่มแม่" (ระบบเดียวกับ skaterX/Y/Z) จะได้วางเทียบปาก
 * หน้าต่างได้ตรง ๆ แล้วค่อยแปลงเป็นพิกัดท้องถิ่นของกลุ่มนอกทุกเฟรม — ราคาถูก
 * และถูกต้องเสมอต่อให้ลากมุม/สเกลปลายทางระหว่างเล่นอยู่
 *
 * ทำไมไม่ใช้ setState/spring: ค่าเปลี่ยนทุกเฟรม เขียนลงออบเจกต์ตรง ๆ ไม่ผ่าน React
 */

const START_WORLD = new THREE.Vector3()
const START_LOCAL = new THREE.Vector3()
const MID_WORLD = new THREE.Vector3()
const MID_LOCAL = new THREE.Vector3()
const END_LOCAL = new THREE.Vector3()
const PATH_POS = new THREE.Vector3()
/** ทางวิ่ง 3 จุด (เริ่ม → กลาง → ปลาย) สร้างครั้งเดียว อัปเดตจุดทุกเฟรม */
const PATH = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, 'catmullrom', 0.5)
const RIDE_POS = new THREE.Vector3()
/** จุดปลายของช่วงที่ไถลบนริบบิ้น (enT1) — ใช้เป็นตัวชดเชยตอนเข้าที่หยุด */
const RIDE_END = new THREE.Vector3()
/** จำนวนช่วงที่ใช้ประมาณความยาวของแต่ละท่อน */
const LEN_SEGS = 6
const LEN_A = new THREE.Vector3()
const LEN_B = new THREE.Vector3()
const RIDE_NRM = new THREE.Vector3()
const RIDE_TAN_END = new THREE.Vector3()
/** แนวตั้งฉากผิวตรงจุดที่ยืน + ตรงปลายเส้น (พิกัดกลุ่มของตัวละคร) */
const SURF_N = new THREE.Vector3()
/** ครึ่งความกว้างของช่วงเกลี่ยรอยต่อสองริบบิ้น (หน่วยเดียวกับ u) */
const SEAM_W = 0.22
/** จำนวนจุดต่อรอบที่ไล่หาจุดส่งไม้ต่อ (สองรอบ: หยาบ แล้วละเอียดรอบตัวที่ดีที่สุด) */
const SEAM_SEGS = 12
/** ความนุ่มของเพดาน "ปลายที่วาดถึงแล้ว" — หน่วยเดียวกับพารามิเตอร์ของเส้น */
const DRAW_SOFT = 0.06
/** สถานะของการสุ่มครั้งล่าสุด — ผู้เรียกอ่านต่อว่าตอนนี้ยังอยู่หลังกรอบหน้าต่างไหม */
export const seamState = { inside: false }
const SEAM_P = new THREE.Vector3()
const SEAM_T = new THREE.Vector3()
const SEAM_N = new THREE.Vector3()
const BOX = new THREE.Box3()
const BOX_ONE = new THREE.Box3()
const BOX_INV = new THREE.Matrix4()
const BOX_M = new THREE.Matrix4()
const PAR_MI = new THREE.Matrix4()
/** ฐานพิกัดของผิวตรงจุดที่ยืน + ควอเทอร์เนียนที่ใช้แปลงเป็นท่าของตัวละคร */
const BASIS = new THREE.Matrix4()
const B_SIDE = new THREE.Vector3()
const B_UP = new THREE.Vector3()
const B_FWD = new THREE.Vector3()
const Q_SURF = new THREE.Quaternion()
const Q_REST = new THREE.Quaternion()
const Q_TMP = new THREE.Quaternion()
const E_TMP = new THREE.Euler()
const Q_ID = new THREE.Quaternion()
const RIDE_TAN = new THREE.Vector3()
/** เฟรมผิวริบบิ้น (ใช้ซ้ำ) */
const RIDE_F = { P: new THREE.Vector3(), T: new THREE.Vector3(), S: new THREE.Vector3(), N: new THREE.Vector3() }

/**
 * ตัวละคร "อยู่ในพอร์ทัล" = วาดเฉพาะพิกเซลที่หน้าต่างทำเครื่องหมาย stencil ไว้ (เหมือน InsideWindow)
 * สลับกลับเป็นปกติตอนทะลุออกมา — เป็น render state ไม่ต้อง recompile shader
 */
const STENCIL_REF = 1
function setInside(root, inside) {
  root.traverse((o) => {
    if (!o.material) return
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (inside) {
        m.stencilWrite = true
        m.stencilRef = STENCIL_REF
        m.stencilFunc = THREE.EqualStencilFunc
      } else if (m.stencilWrite && m.stencilRef === STENCIL_REF && m.stencilFunc === THREE.EqualStencilFunc) {
        m.stencilWrite = false
      }
    }
  })
}
const RAD = Math.PI / 180
/** ไล่ 0→1 แบบนุ่ม ไม่มีสันหัก */
const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / Math.max(1e-6, b - a)))
  return u * u * (3 - 2 * u)
}

/** เข้าเป้าแบบเลยไปนิดแล้วดีดกลับ — s คุมความแรงของการเลย (0 = ease-out ธรรมดา) */
function outBack(t, s) {
  const u = t - 1
  return 1 + (s + 1) * u * u * u + s * u * u
}

/** ออกแรงแล้วผ่อนช้า ๆ จนหยุด — ไม่มีการเลยเป้า ใช้กับสเกล/การหมุนที่ไม่ควรสั่น */
function outQuint(t) {
  return 1 - (1 - t) ** 5
}

/**
 * คลื่นของริบบิ้น "ณ ตอนนี้" — ระหว่างอินโทร ริบบิ้นถูกวาดจากแบนแล้วค่อยก่อตัวเป็นคลื่น
 * (ดู useRibbonDraw / wavePos ใน NewHeroScene) ถ้าตัวละครไถลบนคลื่นเต็มตั้งแต่แรก
 * มันจะลอยเหนือผิวที่ยังแบนอยู่ — สูตรตัวเดียวกับที่ผสมจุดยอด ต้องอ่านจากที่เดียวกัน
 */
/**
 * ความคืบหน้าของการ "วาด" ริบบิ้นแต่ละท่อนตอนอินโทร (0..1 ของท่อนนั้น)
 *
 * สูตรเดียวกับ useRibbonDraw ใน NewHeroScene ซึ่งตัด draw range ของ geometry ทิ้ง
 * ตามความคืบหน้า — ถ้าตัวละครวิ่งล้ำหน้าปลายที่ยังวาดไม่ถึง มันจะไถลอยู่บนที่ว่าง
 * (ทางเข้าเริ่มที่ enDelay = 1.9 วิ ซึ่งริบบิ้นยังวาดไม่จบ) จึงต้องหนีบไว้ที่ปลายเส้น
 */
function ribbonDrawn(t, part) {
  if (t.intro <= 0.5) return 1
  const u = Math.min(1, Math.max(0, (introTime() - t.inRibAt) / Math.max(0.01, t.inRibDur)))
  const e = 1 - (1 - u) ** 3
  const f = Math.min(0.95, Math.max(0.05, t.inRibSplit))
  return part === 'portal' ? Math.min(1, e / f) : Math.min(1, Math.max(0, (e - f) / (1 - f)))
}

function ribbonWaveNow(t) {
  return ribbonDrawn(t, 'outer')
}

/**
 * จุดบนเส้นทางเข้า ที่พารามิเตอร์ tt ของริบบิ้น — วัดจากผิวจริง ไม่ใช่เส้นที่วาดเลียนแบบ
 *
 * ก่อนหน้านี้เส้นเป็น waypoint ลอย ๆ ที่ตั้งเลขเอง จูนยากเพราะไม่มีอะไรยึด: ขยับริบบิ้น
 * ทีเดียวเส้นก็หลุดออกจากผิวและต้องไล่ตั้งใหม่ทั้งสิบสองค่า ที่นี่อ่านจากกึ่งกลางความกว้าง
 * ของริบบิ้นตรง ๆ ด้วย ride.frame ตัวเดียวกับที่ใช้ปั้น geometry — คลื่นของริบบิ้นจึงเป็น
 * คลื่นของเส้นทางเป๊ะ ๆ ไม่ใช่เส้นเรียบที่ตัดมุมคลื่นทิ้ง (ซึ่งเกิดขึ้นถ้าเอาไม่กี่จุดมาต่อเป็นสไปลน์)
 *
 * ผลลัพธ์อยู่ในพิกัดของกลุ่มที่ห่อริบบิ้น (= พิกัดเดียวกับ skaterX/Y/Z) ส่วน f คือเฟรมผิว
 * ที่คำนวณไว้แล้ว (P/T/S/N) เผื่อผู้เรียกเอาทิศสัมผัสไปใช้ต่อ
 */
export function ribbonPoint(ride, t, tt, out, f, nrm) {
  ride.frame(ride.curve, Math.min(1, Math.max(0, tt)), ride.wave * ribbonWaveNow(t), ride.waves, f)
  out.copy(f.P)
  // ก่อนต้นเส้น (tt < 0) ต่อเส้นตรงถอยหลังตามทิศสัมผัส — เริ่มลึกเข้าไปในบานที่ 1 ได้
  if (tt < 0) out.addScaledVector(f.T, tt * ride.curve.getLength())
  out.applyMatrix4(ride.matrix)
  // ช่วงที่ยังอยู่หลังกรอบ: ดึงให้ตื้นขึ้นมาใกล้ระนาบบาน ไม่งั้นจมหลังฉากหลัง
  if (tt < ride.mouthT && out.z < -t.enBackZ) out.z = -t.enBackZ
  if (nrm) nrm.copy(f.N).transformDirection(ride.matrix).normalize()
  return out
}

/**
 * จุดบนริบบิ้นของฉากในหน้าต่าง (คนละชิ้นกับเส้นหลัก) — คืน false ถ้ายังไม่มีชิ้นนั้นในฉาก
 *
 * เส้นหลักเริ่มที่ "ปากบานที่ 2" ส่วนที่เห็นอยู่ในหน้าต่างเป็นริบบิ้นคนละชิ้นคนละเส้น
 * (PORTAL_PATH) ถ้าให้ตัวละครไถลบนเส้นหลักตลอด ช่วงที่ยังอยู่หลังกรอบมันจะวิ่งบนเส้นที่
 * ไม่มีผิวอยู่จริง แล้วโผล่ทะลุผิวใบที่เห็นตรงยอดคลื่น
 *
 * เมทริกซ์อ่านจาก mesh จริง เพราะริบบิ้นใบนี้อยู่คนละกิ่งของต้นไม้ (ในกลุ่มพอร์ทัลซึ่งเลื่อน
 * ไป z = portalZ) ไล่คูณกลุ่มแม่เองจะพังทันทีที่ผังกลุ่มเปลี่ยน
 */
function portalPoint(ride, t, tp, out, f, parent, tan, nrm) {
  const m = portalRide.mesh
  if (!m || !portalRide.curve) return false
  ride.frame(portalRide.curve, Math.min(1, Math.max(0, tp)), portalRide.wave, portalRide.waves, f)
  out.copy(f.P)
  // เลยปลายเส้น (tp > 1) ต่อเส้นตรงตามทิศสัมผัส — ใช้ตอนเกลี่ยรอยต่อกับริบบิ้นเส้นหลัก
  if (tp > 1) out.addScaledVector(f.T, (tp - 1) * portalRide.curve.getLength())
  m.updateWorldMatrix(true, false)
  parent.updateWorldMatrix(true, false)
  PAR_MI.copy(parent.matrixWorld).invert()
  out.applyMatrix4(m.matrixWorld).applyMatrix4(PAR_MI)
  // ทิศต้องข้ามสองระบบพิกัด (mesh -> โลก -> กลุ่มของตัวละคร) เหมือนตำแหน่ง ไม่งั้นท่าเอียงผิดแกน
  if (tan) tan.copy(f.T).transformDirection(m.matrixWorld).transformDirection(PAR_MI).normalize()
  if (nrm) nrm.copy(f.N).transformDirection(m.matrixWorld).transformDirection(PAR_MI).normalize()
  return true
}


/**
 * จุด + ทิศบนเส้นทางเข้า ที่ความคืบหน้าตามระยะทาง u — คืนสัดส่วนของท่อนใน (รอยต่อ)
 *
 * เส้นทางเป็นสองท่อนต่อกัน ไม่ใช่เส้นเดียว:
 *   ท่อนใน  : ริบบิ้นของฉากในหน้าต่าง (PORTAL_PATH) — ผิวที่มองเห็นผ่านกรอบจริง ๆ
 *   ท่อนนอก : ริบบิ้นเส้นหลัก ตั้งแต่ปากบานที่ 2 (mouthT) ออกมา
 * ถ้าไถลบนเส้นหลักตลอด ช่วงที่ยังอยู่หลังกรอบจะวิ่งบนเส้นที่ไม่มีผิวอยู่จริง แล้วโผล่ทะลุ
 * ผิวใบที่เห็นตรงยอดคลื่น
 *
 * แบ่งเวลาให้สองท่อนตาม "ความยาวจริง" ที่วัดสด ๆ ไม่ใช่ครึ่ง-ครึ่ง — ความเร็วจึงไม่กระโดด
 * ตรงรอยต่อ ต่อให้ลากสไลเดอร์ย้ายริบบิ้นใบไหนอยู่ก็ตาม
 *
 * out/tan อยู่ในพิกัดของกลุ่มที่ห่อริบบิ้นเส้นหลัก (= พิกัดเดียวกับ skaterX/Y/Z)
 */
export function entranceSample(ride, t, u, out, tan, f, parent, nrm, lift = 0) {
  /**
   * ใช้สองท่อนหรือไม่ (enTwo)
   *
   * สองท่อน = ตัวละครไถลบนผิวที่มองเห็นจริงตอนอยู่ในหน้าต่างด้วย แต่สองริบบิ้นนี้ไม่ได้ต่อกัน
   * จริงในสามมิติ (จุดที่ใกล้กันที่สุดยังห่าง 2 หน่วย ทิศต่างกัน 39°) ต่อให้เกลี่ยรอยต่อยังไง
   * ก็ยังมีจังหวะสะดุดตรงนั้น — ค่าเริ่มต้นจึงเป็นเส้นเดียวต่อเนื่อง ไม่มีรอยต่อให้สะดุด
   * ช่วงที่อยู่หลังกรอบมองไม่เห็นผิวอยู่แล้ว (ถูก stencil ของหน้าต่างตัด)
   */
  const hasPortal = t.enTwo > 0.5 && !!(portalRide.mesh && portalRide.curve)
  let lenIn = 0
  let lenOut = 0
  const handoff = hasPortal ? portalHandoff(ride, t, f, parent) : 1
  if (hasPortal) {
    portalPoint(ride, t, t.enPT0, LEN_A, f, parent)
    for (let i = 1; i <= LEN_SEGS; i += 1) {
      portalPoint(ride, t, t.enPT0 + ((handoff - t.enPT0) * i) / LEN_SEGS, LEN_B, f, parent)
      lenIn += LEN_A.distanceTo(LEN_B)
      LEN_A.copy(LEN_B)
    }
    ribbonPoint(ride, t, ride.mouthT, LEN_A, f)
    for (let i = 1; i <= LEN_SEGS; i += 1) {
      ribbonPoint(ride, t, ride.mouthT + ((t.enT1 - ride.mouthT) * i) / LEN_SEGS, LEN_B, f)
      lenOut += LEN_A.distanceTo(LEN_B)
      LEN_A.copy(LEN_B)
    }
  }
  const split = hasPortal && lenIn + lenOut > 1e-6 ? lenIn / (lenIn + lenOut) : 0
  /**
   * เกลี่ยรอยต่อสองริบบิ้น ไม่ใช่สลับดื้อ ๆ
   *
   * ปลายเส้นในหน้าต่างกับต้นเส้นหลักไม่ได้อยู่จุดเดียวกัน (วัดได้ห่างกัน 4.8 หน่วย และทิศ
   * ต่างกันราว 37°) สลับที่ u = split ทันทีจึงกระชากหนึ่งครั้งตรงนั้น — ตรงกับ "เนินที่สอง"
   * ที่เห็น เพราะรอยต่ออยู่ช่วงกำลังลงเนินพอดี
   *
   * ช่วงกว้าง SEAM_W รอบรอยต่อจึงคิดทั้งสองเส้นแล้วไล่ผสมกัน: ท่อนในเลยปลายไปตามทิศ
   * สัมผัส ท่อนนอกถอยก่อนปากช่องบนเส้นจริงของมัน ทั้งตำแหน่ง ทิศ และแนวตั้งฉากผิว
   */
  const mixRaw = split <= 0 ? 1 : Math.min(1, Math.max(0, (u - (split - SEAM_W)) / (2 * SEAM_W)))
  // smootherstep (6t^5-15t^4+10t^3): อนุพันธ์สองชั้นเป็นศูนย์ที่ปลายทั้งสอง ความเร่งจึงไม่กระตุก
  const mix = mixRaw * mixRaw * mixRaw * (mixRaw * (mixRaw * 6 - 15) + 10)

  if (mix < 1) {
    // ท่อนใน = อยู่หลังกรอบเสมอ
    seamState.inside = true
    // ไม่ล้ำหน้าปลายที่ริบบิ้นยังวาดไม่ถึง — ตอนอินโทรจะได้ไถลอยู่บนปลายเส้น ไม่ใช่บนที่ว่าง
    const tp = softMin(t.enPT0 + (handoff - t.enPT0) * (u / split), ribbonDrawn(t, 'portal'), DRAW_SOFT)
    portalPoint(ride, t, tp, SEAM_P, f, parent, SEAM_T, SEAM_N)
  }
  if (mix > 0) {
    const q = split >= 1 ? 1 : (u - split) / (1 - split)
    const from = hasPortal ? ride.mouthT : t.enT0
    const tt = softMin(
      from + (t.enT1 - from) * q,
      from + (1 - from) * ribbonDrawn(t, 'outer'),
      DRAW_SOFT,
    )
    /**
     * ก่อนปากช่อง (ช่วงเกลี่ยรอยต่อ) ต่อเส้นตรงถอยหลังตามทิศสัมผัส ไม่ใช่เดินตามเส้นจริง
     *
     * เส้นหลักช่วงก่อนปากช่องมุดลึกไปหลังแผง (z ติดลบมาก) และไม่ถูกวาดออกมาเลย
     * เดินตามมันตอนเกลี่ยรอยต่อ เส้นทางจะถูกดึงย้อนกลับไปข้างหลังเป็นหักศอก
     */
    const back = Math.min(0, tt - from)
    // ยังไม่พ้นปากช่อง = ยังอยู่หลังกรอบ (เผื่อความหนากรอบด้วย enMouthPad)
    seamState.inside = tt < ride.mouthT + t.enMouthPad
    ribbonPoint(ride, t, Math.max(tt, from), out, f, SURF_N)
    tan.copy(f.T).transformDirection(ride.matrix).normalize()
    if (back < 0 && t.enT1 > from) out.addScaledVector(tan, (back * lenOut) / (t.enT1 - from))
  }
  if (mix <= 0) {
    out.copy(SEAM_P)
    tan.copy(SEAM_T)
    SURF_N.copy(SEAM_N)
  } else if (mix < 1) {
    out.lerpVectors(SEAM_P, out, mix)
    tan.lerpVectors(SEAM_T, tan, mix).normalize()
    SURF_N.lerpVectors(SEAM_N, SURF_N, mix).normalize()
  }

  /**
   * ยกพ้นผิวเท่ากับที่ "ท่าหยุด" สูงจากผิว — วัดจากฉากจริง ไม่ใช่เลขที่ตั้งเอง
   *
   * จุดกำเนิดของตัวละครอยู่แถวหัว ไม่ใช่ฝ่าเท้า วางจุดกำเนิดลงบนผิวตรง ๆ ตัวจึงจมมิด
   * และค่าที่เคยตั้งไว้ (enUp) ยังถูกบวกใน "พิกัดของริบบิ้น" ระยะยกจริงเลยถูกคูณสเกลของ
   * ริบบิ้นใบนั้น — ใบในหน้าต่างย่อไว้ 0.36 ส่วนเส้นหลัก 1.57 ตั้งค่าเดียวกันแต่ยกจริงต่างกัน
   * สี่เท่า จมตอนอยู่ในกรอบแล้วลอยตอนออกมา
   *
   * ท่าหยุดคือท่าที่จูนจนตัวละครยืนบนริบบิ้นได้พอดีอยู่แล้ว จึงวัดจากมัน: ระยะตั้งฉากจาก
   * ผิว ณ จุดที่ใกล้ท่าหยุดที่สุด ไปถึงจุดกำเนิดของท่าหยุด แล้วใช้ระยะนั้น (ในพิกัดของตัวละคร)
   * ตลอดเส้น ความสูงเหนือผิวจึงเท่ากับตอนจบเป๊ะ ไม่ว่าจะอยู่บนริบบิ้นใบไหน
   */
  out.addScaledVector(SURF_N, lift + t.enUp)
  if (nrm) nrm.copy(SURF_N)
  return split
}

/**
 * ระยะจากจุดกำเนิดของตัวละครลงไปถึงฝ่าเท้า (หน่วยของกลุ่มที่ห่อริบบิ้น)
 *
 * จุดกำเนิดของโมเดลอยู่แถวหัว ไม่ใช่ฝ่าเท้า วางจุดกำเนิดลงบนผิวตรง ๆ ตัวจึงจมมิด
 * ยกเท่าระยะนี้พอดี = ฝ่าเท้าแตะผิว ไม่จมไม่ลอย — วัดจากกล่องขอบเขตของโมเดลจริง
 * ไม่ใช่จากท่าหยุด (ท่าหยุดวางเยื้องจากกึ่งกลางความกว้าง ระยะที่วัดได้จึงรวมความสูง
 * ของขอบริบบิ้นที่บิดขึ้นมาด้วย เอามาใช้ตรง ๆ แล้วตัวลอย)
 *
 * วัดในสเปซของตัวละครเอง จึงไม่ขึ้นกับว่าตอนนั้นมันหมุนไปทางไหน และวัดใหม่ทุกเฟรม
 * เพราะท่ายืนเปลี่ยนตลอด (ย่อเข่าตอนไถล ระยะถึงฝ่าเท้าสั้นกว่าท่ายืนตรงในไฟล์โมเดล
 * — วัดครั้งเดียวตอนโหลดเสร็จจะได้ค่าของท่าดิบ ซึ่งยาวเกินจริงแล้วตัวลอย)
 */
function soleOffset(g, cache) {
  g.updateWorldMatrix(true, true)
  BOX_INV.copy(g.matrixWorld).invert()
  BOX.makeEmpty()
  let seen = 0
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry) return
    seen += 1
    // คิดกล่องของ geometry ครั้งเดียวพอ — มันไล่อ่านทุกจุดยอด เรียกทุกเฟรมคูณ 40 ชิ้น
    // คือไล่อ่านหลักแสนจุดต่อเฟรม เฟรมตกจนเห็นเป็นกระตุก (ท่าเปลี่ยนไม่กระทบกล่องนี้
    // เพราะ skinning เกิดบน GPU กล่องของ geometry เป็นท่าดิบเสมอ ส่วนท่าจริงมาจาก matrixWorld)
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
    BOX_ONE.copy(o.geometry.boundingBox).applyMatrix4(BOX_M.multiplyMatrices(BOX_INV, o.matrixWorld))
    BOX.union(BOX_ONE)
  })
  // ยังโหลดไม่ครบ = ใช้ค่าที่วัดได้ล่าสุด ไม่งั้นตัวกระโดดตอนชิ้นส่วนทยอยมา
  if (seen < 30) return cache.current
  cache.current = Math.max(0, -BOX.min.y)
  return cache.current
}

/**
 * ต่ำสุดแบบนุ่ม — เข้าใกล้เพดานแล้วโค้งเข้าหามันแทนที่จะหักมุม
 *
 * ใช้กับเพดาน "ปลายที่ริบบิ้นวาดถึงแล้ว": หนีบด้วย Math.min ตรง ๆ ตัวละครจะวิ่งเต็มฝีเท้า
 * แล้วหยุดกึกที่ปลายเส้น พอวาดจบก็ออกตัวใหม่ทันที — เห็นเป็นสะดุดหนึ่งครั้ง
 */
function softMin(a, b, k) {
  const h = Math.min(1, Math.max(0, 0.5 + (b - a) / (2 * k)))
  // h = 1 คือ a ต่ำกว่า b ชัดเจน ผลลัพธ์ต้องเป็น a (สลับสองตัวนี้ = ค่าถูกตรึงไว้ที่เพดานตลอด)
  return a * h + b * (1 - h) - k * h * (1 - h)
}

/**
 * พารามิเตอร์บนริบบิ้นในหน้าต่างที่ "ใกล้ปากช่องของเส้นหลักที่สุด" — จุดส่งไม้ต่อ
 *
 * สองเส้นนี้ไม่ได้ต่อกันจริงในสามมิติ (วัดได้: ปลายเส้นในห่างจากปากช่อง 4.8 หน่วย แต่จุดที่
 * ใกล้ที่สุดห่างแค่ 2.0) มันแค่ดูต่อกันเมื่อมองผ่านกรอบหน้าต่างจากมุมกล้องนี้ — ส่งไม้ต่อ
 * ที่จุดใกล้สุดจึงเหลือรอยให้เกลี่ยน้อยกว่าครึ่ง
 */
function portalHandoff(ride, t, f, parent) {
  ribbonPoint(ride, t, ride.mouthT, LEN_A, f)
  let lo = 0
  let hi = 1
  let best = 1
  for (let pass = 0; pass < 2; pass += 1) {
    let bestD = Infinity
    for (let i = 0; i <= SEAM_SEGS; i += 1) {
      const tp = lo + ((hi - lo) * i) / SEAM_SEGS
      portalPoint(ride, t, tp, LEN_B, f, parent)
      const d = LEN_B.distanceToSquared(LEN_A)
      if (d < bestD) {
        bestD = d
        best = tp
      }
    }
    const step = (hi - lo) / SEAM_SEGS
    lo = Math.max(0, best - step)
    hi = Math.min(1, best + step)
  }
  return best
}

/**
 * จังหวะตามฟิสิกส์: เร็วตอนลงเนิน ช้าตอนขึ้นเนิน — ไม่ใช่ ease ที่ตั้งเอง
 *
 * สเก็ตไม่ได้วิ่งด้วยความเร็วคงที่บนพื้นที่ขึ้น ๆ ลง ๆ พลังงานคงตัวบอกว่า v² แปรตามความสูง
 * ที่เสียไป — ตกจากยอดคลื่นแล้วเร็วขึ้น ไต่ขึ้นอีกลูกแล้วช้าลง ตารางนี้จึงวัดความสูงจริงของ
 * เส้นทาง (พิกัดกลุ่มแม่ y = ขึ้น) แล้วแปลง "เวลา" เป็น "ระยะทาง" ให้ตรงกับความเร็วนั้น
 *
 * ที่เก็บคู่กันคือมุมเอียงเข้าโค้ง: รถ/ตัวคนเอียงเท่ากับ atan(v²κ/g) ตามแรงเข้าสู่ศูนย์กลาง
 * ความโค้ง κ วัดจากทิศสัมผัสจริงของเส้น เครื่องหมายจากด้านที่โค้งเทียบแนวตั้งฉากผิว
 */
const PACE_N = 32
const pace = {
  u: new Float32Array(PACE_N + 1),
  lean: new Float32Array(PACE_N + 1),
  key: '',
  ready: false,
}
const PACE_S = new Float32Array(PACE_N + 1)
const PACE_Y = new Float32Array(PACE_N + 1)
const PACE_K = new Float32Array(PACE_N + 1)
const PACE_TIME = new Float32Array(PACE_N + 1)
const PACE_F = { P: new THREE.Vector3(), T: new THREE.Vector3(), S: new THREE.Vector3(), N: new THREE.Vector3() }
const PACE_P = new THREE.Vector3()
const PACE_PREV = new THREE.Vector3()
const PACE_T = new THREE.Vector3()
const PACE_T0 = new THREE.Vector3()
const PACE_N0 = new THREE.Vector3()
const PACE_C = new THREE.Vector3()

/** ความเร็วสัมพัทธ์ที่ความสูงปกติ h (0 = ยอด, 1 = ก้น) — v² = พลังงานที่ยอด + ที่ตกลงมา */
function paceSpeed(h, grav) {
  const top = Math.max(0.04, 1 - Math.min(0.98, grav))
  return Math.sqrt(top + (1 - top) * h)
}

/**
 * สร้างตาราง (สร้างใหม่เมื่อรูปเส้นเปลี่ยนเท่านั้น — ระหว่างอินโทรริบบิ้นยังก่อตัวอยู่)
 * เก็บ seamState ไว้ก่อนแล้วคืนค่า เพราะ entranceSample เขียนทับมันทุกครั้งที่เรียก
 */
function buildPace(ride, t, parent) {
  const key = [
    ribbonWaveNow(t),
    t.enTwo > 0.5 ? 1 : 0,
    t.enT0, t.enT1, t.enPT0, t.enGrav, ride.mouthT, ride.wave, ride.waves,
  ].join(',')
  if (pace.key === key) return
  pace.key = key
  const wasInside = seamState.inside
  let total = 0
  for (let i = 0; i <= PACE_N; i += 1) {
    entranceSample(ride, t, i / PACE_N, PACE_P, PACE_T, PACE_F, parent, PACE_N0)
    PACE_Y[i] = PACE_P.y
    if (i > 0) {
      total += PACE_P.distanceTo(PACE_PREV)
      // ความโค้ง = มุมที่ทิศสัมผัสหมุนไป ต่อระยะทาง เครื่องหมายจากด้านที่โค้งเทียบแนวตั้งฉากผิว
      const ds = Math.max(1e-4, PACE_P.distanceTo(PACE_PREV))
      const ang = Math.acos(Math.min(1, Math.max(-1, PACE_T0.dot(PACE_T))))
      const sign = Math.sign(PACE_C.crossVectors(PACE_T0, PACE_T).dot(PACE_N0)) || 1
      PACE_K[i] = (sign * ang) / ds
    }
    PACE_S[i] = total
    PACE_PREV.copy(PACE_P)
    PACE_T0.copy(PACE_T)
  }
  PACE_K[0] = PACE_K[1]
  seamState.inside = wasInside

  let yMin = Infinity
  let yMax = -Infinity
  for (let i = 0; i <= PACE_N; i += 1) {
    if (PACE_Y[i] < yMin) yMin = PACE_Y[i]
    if (PACE_Y[i] > yMax) yMax = PACE_Y[i]
  }
  const span = Math.max(1e-4, yMax - yMin)

  // เวลาสะสม: dt = ds / ความเร็วเฉลี่ยของช่วง
  PACE_TIME[0] = 0
  let vPrev = paceSpeed((yMax - PACE_Y[0]) / span, t.enGrav)
  for (let i = 1; i <= PACE_N; i += 1) {
    const v = paceSpeed((yMax - PACE_Y[i]) / span, t.enGrav)
    PACE_TIME[i] = PACE_TIME[i - 1] + (PACE_S[i] - PACE_S[i - 1]) / (0.5 * (v + vPrev))
    vPrev = v
  }
  const span2 = Math.max(1e-6, PACE_TIME[PACE_N])

  // กลับด้าน: เวลาปกติ -> u (ตารางนี้คือของที่ entranceU อ่าน)
  let j = 0
  for (let k = 0; k <= PACE_N; k += 1) {
    const want = (k / PACE_N) * span2
    while (j < PACE_N && PACE_TIME[j + 1] < want) j += 1
    const seg = Math.max(1e-6, PACE_TIME[j + 1] - PACE_TIME[j])
    const f = Math.min(1, Math.max(0, (want - PACE_TIME[j]) / seg))
    pace.u[k] = (j + f) / PACE_N
    // มุมเอียง ณ u นั้น: atan(v²κ) — v เป็นความเร็วสัมพัทธ์ κ เป็นความโค้งจริงของเส้น
    const u = pace.u[k]
    const gi = Math.min(PACE_N, Math.max(0, Math.round(u * PACE_N)))
    const v = paceSpeed((yMax - PACE_Y[gi]) / span, t.enGrav)
    pace.lean[k] = Math.atan(v * v * PACE_K[gi] * span)
  }
  pace.u[0] = 0
  pace.u[PACE_N] = 1
  // เกลี่ยมุมเอียงสองรอบ — ความโค้งที่วัดจาก 32 จุดมีหนามเล็ก ๆ เอามาเป็นมุมตรง ๆ แล้วตัวสั่น
  for (let pass = 0; pass < 2; pass += 1) {
    let prev = pace.lean[0]
    for (let i = 1; i < PACE_N; i += 1) {
      const cur = pace.lean[i]
      pace.lean[i] = 0.25 * prev + 0.5 * cur + 0.25 * pace.lean[i + 1]
      prev = cur
    }
  }
  pace.ready = true
}

/**
 * อ่านค่าจากตาราง (x = 0..1) แบบ Catmull-Rom ไม่ใช่เชิงเส้น
 *
 * เชิงเส้นบนตาราง 32 ช่อง = ความชันคงที่ในแต่ละช่องแล้วหักมุมที่รอยต่อ ซึ่งความชันของ
 * ตารางนี้คือ "ความเร็ว" — ตัวละครจึงวิ่งเป็นขั้นบันได 32 ขั้น เห็นเป็นสั่นตลอดเส้น
 */
function paceAt(arr, x) {
  const f = Math.min(1, Math.max(0, x)) * PACE_N
  const i = Math.min(PACE_N - 1, Math.floor(f))
  const a = f - i
  const p0 = arr[Math.max(0, i - 1)]
  const p1 = arr[i]
  const p2 = arr[i + 1]
  const p3 = arr[Math.min(PACE_N, i + 2)]
  const v =
    0.5 *
    (2 * p1 +
      (p2 - p0) * a +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * a * a +
      (3 * p1 - 3 * p2 + p3 - p0) * a * a * a)
  // กันแกว่งเกินช่วง (ข้อมูลเรียบพออยู่แล้ว แทบไม่เคยติดขอบ)
  return Math.min(Math.max(v, Math.min(p1, p2)), Math.max(p1, p2))
}

/**
 * ความคืบหน้าตามระยะทาง (0..1) จากความคืบหน้าตามเวลา — จังหวะ "ค่อย ๆ ไถลแล้วพุ่ง"
 * แยกออกมาเพราะ gizmo ต้องวาดเส้นเดียวกับที่ตัวละครวิ่ง ไม่ใช่เส้นที่เดาเอาเอง
 */
function entranceEase(t, p) {
  const bAt = Math.min(0.95, Math.max(0.05, t.enBurstAt))
  const bAmt = Math.min(0.95, Math.max(0, t.enBurstAmt))
  return smooth(0, bAt, p) * (1 - bAmt) + outQuint(smooth(bAt, 1, p)) * bAmt
}

export function entranceU(t, p) {
  const e = entranceEase(t, p)
  // ตารางยังไม่ถูกสร้าง (gizmo เรียกก่อนเฟรมแรก) หรือปิดฟิสิกส์ = ใช้จังหวะที่ตั้งเองล้วน ๆ
  if (!pace.ready || t.enGrav <= 0) return e
  return paceAt(pace.u, e)
}

/** มุมเอียงเข้าโค้ง (เรเดียน) ที่ความคืบหน้าตามเวลา p — 0 ถ้ายังไม่มีตาราง */
export function entranceLean(t, p) {
  if (!pace.ready || t.enLean <= 0) return 0
  return paceAt(pace.lean, entranceEase(t, p)) * t.enLean
}

/** น้ำหนักการเลื่อนเข้าที่หยุด (0 = ยังอยู่บนริบบิ้นเต็มตัว, 1 = ถึงที่หยุด) */
export function entranceBlend(t, p) {
  // smootherstep: ความเร่งเป็นศูนย์ที่ปลายทั้งสอง — ช่วงเข้าที่หยุดจึงไม่มีจังหวะเบรกกึก
  const x = Math.min(1, Math.max(0, (p - (1 - t.enBlend)) / Math.max(1e-6, t.enBlend)))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/** จำนวนเฟรมที่รอหลังโมเดลขึ้นครบ ก่อนเริ่มนับเวลา — ให้ shader คอมไพล์เสร็จก่อน */
const WARMUP_FRAMES = 4

export function Entrance({ replay = 0, ride = null, rideMode = false, pathMode = false, children, ...props }) {
  const inner = useRef()
  const outer = useRef()
  /** เวลาที่เริ่มนับ (วินาทีของ clock) — null = ยังไม่เริ่ม */
  const t0 = useRef(null)
  /** นับเฟรมที่เห็นโมเดลแล้ว — เริ่มวิ่งเมื่อครบ WARMUP_FRAMES */
  const seen = useRef(0)
  /** ตอนนี้ตัวละครถูกตั้ง stencil เป็น "อยู่ในพอร์ทัล" อยู่ไหม — สลับเฉพาะตอนเปลี่ยน */
  const inside = useRef(false)
  /** เวลาที่กดหยุดไว้ — ใช้ชดเชยนาฬิกาตอนเล่นต่อ */
  const pausedAt = useRef(null)
  /** ระยะจากจุดกำเนิดถึงฝ่าเท้า — วัดครั้งเดียวตอนโมเดลขึ้นครบ */
  const sole = useRef(0)

  // เปลี่ยน replay = เริ่มใหม่จากต้น (ปุ่มในแผง)
  useEffect(() => {
    t0.current = null
    seen.current = 0
    // เล่นทางเข้าใหม่ = เล่นอินโทรทั้งฉากใหม่ (หน้าต่าง/ริบบิ้น/ของลอย ฟังนาฬิกาเดียวกัน)
    resetIntro()
  }, [replay])

  useFrame((_, dt) => {
    const g = inner.current
    const o = outer.current
    if (!g || !o || !o.parent) return
    const t = getTuner()
    /**
     * ไม่เริ่มนับเวลาจนกว่าตัวละครจะขึ้นครบและถูกวาดไปแล้วสองสามเฟรม
     *
     * mascot โหลดแบบ async และเฟรมแรกที่มันขึ้นคือเฟรมที่ shader ทั้งชุดคอมไพล์
     * (วัดได้ราว 230ms) ถ้านับเวลาตั้งแต่ mount ตัวละครจะโผล่กลางทางพร้อมกระตุก
     * หนึ่งครั้ง — รอให้มันยืนนิ่งอยู่ที่จุดเริ่มในหน้าต่างก่อน แล้วค่อยออกตัว
     *
     * จุดนี้คือ "ศูนย์เวลาของอินโทรทั้งฉาก" ด้วย (ดู intro.js) จึงทำก่อนเช็คว่าเปิดทางเข้าไหม
     */
    if (t0.current === null) {
      /**
       * "ขึ้นครบ" = มี mesh มากพอที่จะเป็นตัวละคร ไม่ใช่แค่สเก็ตบอร์ด (บอร์ดมาก่อนตั้งแต่ mount
       * ราว 10 ชิ้น ตัวละครมาทีหลังอีก 40+) และเฟรมต้องเดินปกติแล้ว — เฟรมที่คอมไพล์ shader
       * กิน dt ครึ่งวินาที ถ้านับเฟรมนั้นด้วย นาฬิกาอินโทรจะกระโดดข้ามช่วงต้นไปทั้งท่อน
       */
      let meshes = 0
      g.traverseVisible((c) => {
        if (c.isMesh) meshes += 1
      })
      if (meshes >= 30 && dt < 0.06) seen.current += 1
      else seen.current = 0
      if (seen.current >= WARMUP_FRAMES) {
        armIntro()
        t0.current = 0
      }
    }
    if (t.en < 0.5) {
      g.position.set(0, 0, 0)
      g.rotation.set(0, 0, 0)
      g.scale.setScalar(1)
      if (inside.current) {
        setInside(g, false)
        inside.current = false
      }
      return
    }
    /**
     * หยุดชั่วคราว (debug): แช่ความคืบหน้าไว้ที่ enScrub แล้วลากดูทีละจุดบนเส้นได้
     * ต้องรีเซ็ตนาฬิกาตอนเลิกหยุดด้วย ไม่งั้นเวลาที่เดินไประหว่างหยุดจะดันให้กระโดดไปท้ายเส้นทันที
     */
    const paused = t.enPause > 0.5
    // เวลาของทางเข้า = นาฬิกาอินโทร (ตัดเพดาน dt แล้ว) จึงไม่กระโดดตอน shader คอมไพล์
    const now = introTime()
    if (paused) pausedAt.current = now
    else if (pausedAt.current !== null) {
      if (t0.current !== null) t0.current += now - pausedAt.current
      pausedAt.current = null
    }
    const raw = t0.current === null ? 0 : (now - t0.current - t.enDelay) / Math.max(0.05, t.enDur)
    /**
     * เล่นเฉพาะช่วงที่เลือก: enFrom → enTo (0 = ต้นเส้น, 1 = ตำแหน่งจบ)
     *
     * เต็มช่วง (0→1) = เล่นครั้งเดียวแล้วค้างที่ปลาย — พฤติกรรมของหน้าจริง
     * ตัดช่วงให้แคบลง = วนซ้ำเฉพาะช่วงนั้น ดูจังหวะเดิมซ้ำ ๆ ตอนจูนได้โดยไม่ต้องกดเล่นใหม่
     */
    const from = Math.min(0.999, Math.max(0, t.enFrom))
    const to = Math.min(1, Math.max(from + 0.001, t.enTo))
    const span = to - from
    const partial = from > 0.001 || to < 0.999
    let p
    if (paused) p = from + span * Math.min(1, Math.max(0, t.enScrub))
    else if (partial) p = from + span * (raw <= 0 ? 0 : raw % 1)
    else p = Math.min(1, Math.max(0, raw))

    // จุดเริ่ม (พิกัดกลุ่มแม่) -> พิกัดท้องถิ่นของกลุ่มนอก
    o.parent.updateWorldMatrix(true, false)
    o.updateWorldMatrix(false, false)
    START_WORLD.set(t.enX, t.enY, t.enZ)
    o.parent.localToWorld(START_WORLD)
    START_LOCAL.copy(START_WORLD)
    o.worldToLocal(START_LOCAL)

    /**
     * สามเส้นโค้งคนละหน้าที่ — ใช้เส้นเดียวกันหมดแล้วทุกอย่างสั่นพร้อมกันตอนถึงเป้า
     *   e  : ตำแหน่ง เลยเป้าได้นิด (ความรู้สึก "ไถมาแล้วเบรก")
     *   q  : สเกลกับการหมุน ผ่อนจนนิ่ง ไม่เลยเป้า (ตัวไม่บวม/ไม่ส่ายตอนหยุด)
     *   hop: โค้งยก ยึดกับ q ไม่ใช่เวลาตรง ๆ จะได้ยกเร็วช่วงออกตัวแล้วค่อย ๆ ลง
     */
    const e = outBack(p, t.enOver)
    const q = outQuint(p)

    /**
     * ไถลบนริบบิ้นจริง: ตำแหน่งมาจากผิวริบบิ้นที่พารามิเตอร์ t ของเส้น (enT0 → enT1)
     * หันหน้าตามทิศสัมผัสของเส้น แล้วช่วงท้าย (enBlend) ค่อยละลายเข้าท่า/ตำแหน่งที่จูนไว้
     * — จุดหยุดจึงยังเป็นค่าที่ตั้งเองเป๊ะ ไม่ถูกเส้นบังคับ
     */
    /**
     * โหมดเส้นจากริบบิ้น (enPath): เหมือนโหมด ride แต่มีจังหวะพุ่ง/ยุบเด้งของทางเข้า
     * ทั้งสองโหมดอ่านตำแหน่งจากผิวริบบิ้นเส้นเดียวกัน จึงเกาะคลื่นของมันเป๊ะทั้งคู่
     */
    if (pathMode && ride) {
      /**
       * จังหวะ: ช่วงแรก (ในพอร์ทัล) ค่อย ๆ ไถล แล้วช่วงท้าย "พุ่ง" ออกมาเร็ว ๆ แบบสเก็ตลงเนิน
       * enBurstAt = สัดส่วนเวลาที่เริ่มพุ่ง, enBurstAmt = สัดส่วนระยะทางที่ใช้พุ่ง (0 = ไม่พุ่ง)
       */
      // ตารางจังหวะ/มุมเอียงตามฟิสิกส์ของเส้น — สร้างใหม่เฉพาะตอนรูปเส้นเปลี่ยน
      buildPace(ride, t, o.parent)
      const u = entranceU(t, p)

      // ตำแหน่ง/ทิศ อ่านจากผิวริบบิ้นที่มองเห็นจริงทุกเฟรม (สองท่อนต่อกัน ดู entranceSample)
      /**
       * ยกให้ฝ่าเท้าแตะผิวพอดี — ระยะในหน่วยของกลุ่มแม่
       *
       * ต้องคูณสเกลทั้งสองชั้น: ตัวละครค่อย ๆ โตจาก enScale (0.45) ไปเป็นเต็มตัวระหว่างทาง
       * ถ้ายกด้วยระยะของตัวเต็มตั้งแต่ต้น ช่วงที่ยังตัวเล็กจะลอยเหนือผิวเกินครึ่งตัว
       */
      const grow = t.enScale + (1 - t.enScale) * u
      const lift = soleOffset(g, sole) * grow * t.skaterScale
      // gizmo วาดเส้นด้วยค่าเดียวกัน มันไม่มีทางวัดเองได้ (ไม่ได้ถือตัวละครอยู่)
      entranceLift.value = lift
      entranceSample(ride, t, u, RIDE_POS, RIDE_TAN, RIDE_F, o.parent, RIDE_NRM, lift)
      // เลยเป้าแล้วดีดกลับ ตามแนวเข้าเป้า
      // เปิดใช้แบบไล่ระดับ ไม่ใช่สวิตช์ที่ p = 0.6 (สวิตช์ = ตำแหน่งกระตุกหนึ่งครั้งตรงนั้น)
      const over = (outBack(p, t.enOver) - 1) * smooth(0.5, 0.72, p)
      RIDE_POS.addScaledVector(RIDE_TAN, over * 0.6)
      // พิกัดกลุ่มแม่ -> โลก -> พิกัดท้องถิ่นของกลุ่มนอก
      o.parent.localToWorld(RIDE_POS)
      o.worldToLocal(RIDE_POS)
      /**
       * เข้าที่หยุดด้วยการ "เลื่อนทั้งเส้น" ไม่ใช่ลากตำแหน่งเข้าหาศูนย์
       *
       * ถ้าคูณตำแหน่งด้วย (1-bl) ตรง ๆ ช่วงท้ายจะกลายเป็นเส้นตรงพุ่งเข้าที่หยุด คลื่นของ
       * ริบบิ้นถูกรีดทิ้งไปเกือบครึ่งทาง (enBlend = 0.45) — ที่ต้องการคือยังไถลตามคลื่นอยู่
       * แล้วค่อย ๆ ยกทั้งเส้นไปทับที่หยุด จึงบวก "ส่วนต่างระหว่างปลายเส้นกับที่หยุด" แทน
       * ที่ p = 1 จุดปัจจุบันคือปลายเส้นพอดี ผลลัพธ์จึงเป็นศูนย์ = อยู่ที่หยุดเป๊ะ
       */
      entranceSample(ride, t, 1, RIDE_END, RIDE_TAN_END, RIDE_F, o.parent, null, lift)
      o.parent.localToWorld(RIDE_END)
      o.worldToLocal(RIDE_END)
      const bl = entranceBlend(t, p)
      g.position.copy(RIDE_POS).addScaledVector(RIDE_END, -bl)
      /**
       * ท่าทางเกาะ "ฐานพิกัดของผิว" ทั้งชุด ไม่ใช่หมุนแค่ซ้าย-ขวา
       *
       * ก่อนหน้านี้ตั้งแค่ yaw จากทิศสัมผัสในระนาบพื้น (atan2 ของ x กับ z) ตัวละครจึงยืนตรง
       * เป๊ะตลอดทาง ทั้งที่ผิวใต้เท้ากระดกขึ้นลงตามคลื่นและบิดรอบแกนตัวเอง (ดู tw ใน
       * ribbonFrame) — ตำแหน่งเกาะผิวแล้วแต่ตัวยังไม่เอียงตาม อ่านเป็น "ลอยผ่านคลื่น"
       *
       * สร้างฐาน (ข้าง, ขึ้น, หน้า) จากทิศสัมผัสกับแนวตั้งฉากผิวโดยตรง แล้วหาส่วนต่างจาก
       * ท่าปลายทางที่กลุ่มนอกถืออยู่ — กลุ่มในหมุนเท่าส่วนต่างนั้น พอถึงปลายทาง (bl = 1)
       * ส่วนต่างละลายเป็นศูนย์ ท่าที่จูนไว้จึงยังเป๊ะเหมือนเดิม
       */
      B_FWD.copy(RIDE_TAN).normalize()
      B_UP.copy(RIDE_NRM).normalize()
      B_SIDE.crossVectors(B_UP, B_FWD).normalize()
      // ตั้งฉากซ้ำอีกที: ทิศสัมผัสกับแนวตั้งฉากผิวไม่ได้ตั้งฉากกันเป๊ะหลังผ่านสเกลไม่เท่ากันทุกแกน
      B_UP.crossVectors(B_FWD, B_SIDE).normalize()
      BASIS.makeBasis(B_SIDE, B_UP, B_FWD)
      Q_SURF.setFromRotationMatrix(BASIS)
      // หันหน้าเพิ่ม (enFace) และเอียงเข้าโค้ง (enBank) ในสเปซของตัวเอง = เอียงรอบแกนที่วิ่งอยู่
      Q_SURF.multiply(
        Q_TMP.setFromEuler(
          E_TMP.set(
            0,
            t.enFace * RAD,
            // เอียงตามแรงเข้าสู่ศูนย์กลางจริงของโค้ง + ค่าที่ตั้งเองเป็นตัวแต่ง
            entranceLean(t, p) + t.enBank * RAD * Math.sin(Math.PI * u),
          ),
        ),
      )
      Q_REST.setFromEuler(
        E_TMP.set(t.skaterRotX * RAD, t.skaterRotY * RAD, t.skaterRotZ * RAD),
      )
      /**
       * enTurn = หมุนตัวตามเส้นแค่ไหน (0 = หันทิศเดียวกับท่าจบตลอดทาง ไม่หมุนเลย)
       * ที่ 0 ผลลัพธ์เป็นควอเทอร์เนียนหน่วยพอดี ท่าที่เห็นจึงเป็นท่าจบล้วน ๆ เหลือแค่การเลื่อนที่
       */
      const turn = Math.min(1, Math.max(0, t.enTurn))
      g.quaternion
        .copy(Q_REST)
        .invert()
        .multiply(Q_SURF)
        .slerp(Q_ID, 1 - (1 - bl) * turn)
      g.scale.setScalar(grow)
      /**
       * ลงพื้น: ยุบแล้วเด้ง (squash & stretch) หลังถึงเป้า — น้ำหนักของการลงจากการเหิน
       * สปริงหน่วง 2 รอบใน 0.6 วิ แกน y ยุบ แกน x/z ป่องชดเชย ปริมาตรเท่าเดิม
       */
      if (!partial && raw > 1 && t.enSquash > 0) {
        const l = Math.min(1, ((raw - 1) * Math.max(0.05, t.enDur)) / 0.6)
        const sq = t.enSquash * Math.exp(-4 * l) * Math.sin(l * Math.PI * 3)
        g.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5)
      }
      // อยู่หลังกรอบถึงเมื่อไร — entranceSample เป็นคนตอบ เพราะมันรู้ว่าตอนนี้อยู่ท่อนไหน
      const wantInside = seamState.inside
      if (wantInside !== inside.current) {
        setInside(g, wantInside)
        inside.current = wantInside
      }
      return
    }

    if (rideMode && ride) {
      /**
       * ไถลบนเส้นหลักต่อเนื่องเส้นเดียว: t จาก enT0 (ในโพรงบานที่ 1) ผ่านหลังกรอบ
       * ถึงปากบานที่ 2 (ride.mouthT) แล้วไถลต่อบนริบบิ้นหน้าถึง enT1 จากนั้น (enBlend)
       * ค่อยละลายเข้าท่า/ตำแหน่งที่จูนไว้
       *
       * ช่วงก่อนถึงปากช่อง ตัวละครถูกวาดผ่าน stencil ของหน้าต่างเท่านั้น (เหมือนของในพอร์ทัล)
       * จึง "เห็นในบาน 1 → หายไปหลังกรอบ → โผล่ที่บาน 2" ไม่ใช่ลอยพาดหน้ากรอบ
       */
      // ไถลสม่ำเสมอทั้งเส้น (ease-in-out) — outQuint จะวิ่งถึงปากช่องใน 0.5 วิแรกแล้วค้างรอ
      const u = smooth(0, 1, p)
      const tt = t.enT0 + (t.enT1 - t.enT0) * u
      ride.frame(ride.curve, Math.min(1, Math.max(0, tt)), ride.wave, ride.waves, RIDE_F)
      // ก่อนต้นเส้น (t < 0): ต่อเส้นตรงถอยหลังตามทิศสัมผัส — ให้เริ่มลึกเข้าไปในบานที่ 1 ได้
      if (tt < 0) RIDE_F.P.addScaledVector(RIDE_F.T, tt * ride.curve.getLength())
      RIDE_POS.copy(RIDE_F.P).addScaledVector(RIDE_F.N, t.enUp).applyMatrix4(ride.matrix)
      // ช่วงในพอร์ทัล: ดึงให้ตื้นขึ้นมาใกล้ระนาบบาน (z ในพิกัดกลุ่มแม่) ไม่งั้นจมหลังฉากหลัง
      if (tt < ride.mouthT && RIDE_POS.z < -t.enBackZ) RIDE_POS.z = -t.enBackZ
      RIDE_TAN.copy(RIDE_F.T).transformDirection(ride.matrix)
      // พิกัดกลุ่มแม่ -> โลก -> พิกัดท้องถิ่นของกลุ่มนอก
      o.parent.localToWorld(RIDE_POS)
      o.worldToLocal(RIDE_POS)
      const bl = smooth(1 - t.enBlend, 1, p)
      g.position.copy(RIDE_POS).multiplyScalar(1 - bl)
      const yawT = Math.atan2(RIDE_TAN.x, RIDE_TAN.z) + t.enFace * RAD
      let dy = yawT - t.skaterRotY * RAD
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      g.rotation.set(0, dy * (1 - bl), t.enBank * RAD * Math.sin(Math.PI * u) * (1 - u))
      g.scale.setScalar(1)
      // ยังไม่พ้นปากช่อง = อยู่ในพอร์ทัล (เผื่อระยะ enMouthPad ให้พ้นกรอบก่อนค่อยสลับ)
      const wantInside = tt < ride.mouthT + t.enMouthPad
      if (wantInside !== inside.current) {
        setInside(g, wantInside)
        inside.current = wantInside
      }
      return
    }

    /**
     * ทางวิ่งผ่านจุดกลาง: บานที่ 1 (จุดเริ่ม) → ปากบานที่ 2 (enMid) → ตำแหน่งหยุด
     * เส้นโค้งผ่านสามจุด แทนเส้นตรงจุดเดียว — ยังใช้ easing/โค้งยก/หมุน/เอียงชุดเดิม
     */
    MID_WORLD.set(t.enMidX, t.enMidY, t.enMidZ)
    o.parent.localToWorld(MID_WORLD)
    MID_LOCAL.copy(MID_WORLD)
    o.worldToLocal(MID_LOCAL)
    PATH.points[0].copy(START_LOCAL)
    PATH.points[1].copy(MID_LOCAL)
    PATH.points[2].copy(END_LOCAL.set(0, 0, 0))
    PATH.updateArcLengths()
    PATH.getPointAt(Math.min(1, Math.max(0, e)), PATH_POS)
    // เลยเป้า (e > 1) — ต่อเส้นตรงจากปลายไปในทิศเดิม
    if (e > 1) PATH_POS.copy(END_LOCAL).sub(MID_LOCAL).multiplyScalar((e - 1) * 0.5)
    const hop = Math.sin(Math.PI * q) * t.enArc
    g.position.set(PATH_POS.x, PATH_POS.y + hop, PATH_POS.z)
    // เอียงข้างตามแรงเหวี่ยง — แรงสุดช่วงกลางทาง หายไปพอดีตอนหยุด
    g.rotation.set(0, t.enSpin * RAD * (1 - q), t.enBank * RAD * Math.sin(Math.PI * q) * (1 - q))
    g.scale.setScalar(t.enScale + (1 - t.enScale) * q)
  })

  return (
    <group ref={outer} {...props}>
      <group ref={inner}>{children}</group>
    </group>
  )
}
