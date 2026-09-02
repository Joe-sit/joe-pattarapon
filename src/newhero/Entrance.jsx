import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getTuner } from './tuner'

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
const RIDE_TAN = new THREE.Vector3()
/** เฟรมผิวริบบิ้น (ใช้ซ้ำ) */
const RIDE_F = { P: new THREE.Vector3(), T: new THREE.Vector3(), S: new THREE.Vector3(), N: new THREE.Vector3() }
/** เส้นทางวางเอง: waypoint สูงสุด 4 จุด + ปลายทาง (สร้างครั้งเดียว เขียนจุดทับทุกเฟรม) */
const WAY = new THREE.CatmullRomCurve3(
  Array.from({ length: 5 }, () => new THREE.Vector3()),
  false,
  'catmullrom',
  0.5,
)
const WAY_TAN = new THREE.Vector3()
const RIDE_MI = new THREE.Matrix4()

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

/** จำนวนเฟรมที่รอหลังโมเดลขึ้นครบ ก่อนเริ่มนับเวลา — ให้ shader คอมไพล์เสร็จก่อน */
const WARMUP_FRAMES = 4

export function Entrance({ replay = 0, ride = null, pathMode = false, children, ...props }) {
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

  // เปลี่ยน replay = เริ่มใหม่จากต้น (ปุ่มในแผง)
  useEffect(() => {
    t0.current = null
    seen.current = 0
  }, [replay])

  useFrame(({ clock }) => {
    const g = inner.current
    const o = outer.current
    if (!g || !o || !o.parent) return
    const t = getTuner()
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
     * ไม่เริ่มนับเวลาจนกว่าตัวละครจะขึ้นครบและถูกวาดไปแล้วสองสามเฟรม
     *
     * mascot โหลดแบบ async และเฟรมแรกที่มันขึ้นคือเฟรมที่ shader ทั้งชุดคอมไพล์
     * (วัดได้ราว 230ms) ถ้านับเวลาตั้งแต่ mount ตัวละครจะโผล่กลางทางพร้อมกระตุก
     * หนึ่งครั้ง — รอให้มันยืนนิ่งอยู่ที่จุดเริ่มในหน้าต่างก่อน แล้วค่อยออกตัว
     */
    if (t0.current === null) {
      let hasMesh = false
      g.traverseVisible((c) => {
        if (c.isMesh) hasMesh = true
      })
      if (hasMesh) seen.current += 1
      if (seen.current >= WARMUP_FRAMES) t0.current = clock.elapsedTime
    }
    /**
     * หยุดชั่วคราว (debug): แช่ความคืบหน้าไว้ที่ enScrub แล้วลากดูทีละจุดบนเส้นได้
     * ต้องรีเซ็ตนาฬิกาตอนเลิกหยุดด้วย ไม่งั้นเวลาที่เดินไประหว่างหยุดจะดันให้กระโดดไปท้ายเส้นทันที
     */
    const paused = t.enPause > 0.5
    if (paused) pausedAt.current = clock.elapsedTime
    else if (pausedAt.current !== null) {
      if (t0.current !== null) t0.current += clock.elapsedTime - pausedAt.current
      pausedAt.current = null
    }
    const raw = t0.current === null ? 0 : (clock.elapsedTime - t0.current - t.enDelay) / Math.max(0.05, t.enDur)
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
     * เส้นทางวางเอง (โหมด debug): Catmull-Rom ผ่าน waypoint ที่ตั้งในแผง (พิกัดกลุ่มแม่)
     * แล้วจบที่ตำแหน่งจริงพอดี — ไม่ต้องละลายทีหลัง เพราะเส้นผ่านปลายทางอยู่แล้ว
     * "อยู่ในพอร์ทัล" (วาดผ่าน stencil หน้าต่าง) จนถึงสัดส่วน enInside ของเส้น
     */
    if (pathMode) {
      const n = Math.min(4, Math.max(1, Math.round(t.enPts)))
      const pts = WAY.points
      pts.length = n + 1
      for (let i = 0; i < n; i += 1) {
        const v = pts[i] ?? (pts[i] = new THREE.Vector3())
        v.set(t[`enP${i}X`], t[`enP${i}Y`], t[`enP${i}Z`])
        o.parent.localToWorld(v)
        o.worldToLocal(v)
      }
      ;(pts[n] ?? (pts[n] = new THREE.Vector3())).set(0, 0, 0)
      WAY.updateArcLengths()
      const u = smooth(0, 1, p)
      WAY.getPointAt(u, RIDE_POS)
      WAY.getTangentAt(Math.min(0.999, u), WAY_TAN)
      // เลยเป้าแล้วดีดกลับ ตามแนวเข้าเป้า
      const over = outBack(p, t.enOver) - 1
      if (p > 0.6) RIDE_POS.addScaledVector(WAY_TAN, over * 0.6)
      g.position.copy(RIDE_POS)
      // หันตามเส้น (yaw ในพิกัดกลุ่มแม่ เทียบ yaw ปลายทาง) แล้วช่วงท้ายค่อยคืนท่าจริง
      RIDE_TAN.copy(WAY_TAN).transformDirection(o.matrixWorld)
      o.parent.updateWorldMatrix(true, false)
      RIDE_TAN.transformDirection(RIDE_MI.copy(o.parent.matrixWorld).invert())
      const yawT = Math.atan2(RIDE_TAN.x, RIDE_TAN.z) + t.enFace * RAD
      let dy = yawT - t.skaterRotY * RAD
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      const settle = smooth(1 - t.enBlend, 1, p)
      g.rotation.set(0, dy * (1 - settle), t.enBank * RAD * Math.sin(Math.PI * u) * (1 - settle))
      g.scale.setScalar(t.enScale + (1 - t.enScale) * u)
      const wantInside = u < t.enInside
      if (wantInside !== inside.current) {
        setInside(g, wantInside)
        inside.current = wantInside
      }
      return
    }

    if (ride) {
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
