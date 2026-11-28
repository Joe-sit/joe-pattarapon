import * as THREE from 'three'

/**
 * เวทีมุมไอโซของ What I do (ภาพอ้างอิง: แผ่นหนาชมพูขอบเขียว แว่นขยายเหนือกองเอกสาร ป้ายทรงฟองคำพูดยืนขอบแผ่น)
 * ฟองแชทเอียงลงไปเป็นป้ายบนแผ่น — ใช้ร่วมระหว่างฟอง (BubbleTraveler) กับฉาก (IsoSkills)
 *
 * พิกัดท้องถิ่นของพื้น: x ยาวไปทางขวาบนของจอ · z ชี้ออกมาหาคนดู (ขวาล่าง) · y ขึ้น · หน่วย = ความกว้างจอ
 * มุมมอง = หมุนรอบแกนตั้ง 45° แล้วก้ม 30° (ไอโซ 2:1 แบบภาพอ้างอิง) — กล้องออร์โธของแคนวาสฟองมองตรงตลอด
 */
export const ISO_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler((30 * Math.PI) / 180, (45 * Math.PI) / 180, 0, 'XYZ'))

/** แผ่นของแต่ละสกิล: ยาว (x) ลึก (z) หนา · ระยะกลางแผ่นถึงกลางแผ่นถัดไป (= L แผ่นต่อกันสนิท) */
export const SLAB = { L: 1.3, D: 0.56, T: 0.045, SP: 1.3 }
/** จุดที่ป้าย (ฟอง) ยืน บนแผ่นของสกิลที่เปิดอยู่ — ใกล้ขอบหน้า ฝั่งขวา */
export const SIGN_FOOT = new THREE.Vector3(0.2, 0, 0.17)
/** ป้ายสูงกี่ส่วนของความสูงจอ */
export const SIGN_H = 0.13
/** หน่วยของพื้น = ความกว้างจอ × ค่านี้ (แผ่นยาว 1.3 หน่วย ≈ 0.94 จอ) */
export const ISO_S = 0.72

const UP = new THREE.Vector3()
const V = new THREE.Vector3()

/** จุดกำเนิดของพื้นในโลกของแคนวาส (px กลางจอ = 0, y ขึ้น) — ค่อนซ้ายบนของกลางจอ แผ่นล้นออกซ้ายล่างแบบภาพอ้างอิง */
export function isoAnchor(W: number, H: number, out: THREE.Vector3) {
  return out.set(-W * 0.1, H * 0.04, -W * 0.45)
}

/** ตำแหน่งกลางป้ายในโลก (px) — ฐานป้ายแตะพื้นที่ SIGN_FOOT ยกขึ้นครึ่งความสูงป้าย */
export function signCenter(W: number, H: number, bh: number, out: THREE.Vector3) {
  isoAnchor(W, H, out)
  V.copy(SIGN_FOOT).multiplyScalar(W * ISO_S).applyQuaternion(ISO_Q)
  UP.set(0, 1, 0).applyQuaternion(ISO_Q)
  return out.add(V).addScaledVector(UP, bh * 0.56)
}

/** จุดตั้งต้นของแว่นขยายในฟอง (โลก px) — ฟองเขียนทุกเฟรม ฉากใช้เป็นท่าแรกของแว่นยักษ์ (ไม่มีรอยต่อ) */
export const magStart = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1 }
