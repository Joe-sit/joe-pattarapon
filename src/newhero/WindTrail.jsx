import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getTuner } from './tuner'
import { ridePose } from './ridePose'

/**
 * รอยลมท้ายตัวละคร — ริบบิ้นที่ปั้นจาก *เส้นทางที่วิ่งมาจริง* ไม่ใช่ภาพลมที่วาดแปะไว้
 *
 * เก็บตำแหน่งโลกของตัวละครเป็นบัฟเฟอร์วน (ring buffer) แล้วขึงแถบสองแถวตามจุดเหล่านั้น
 * กว้างสุดที่หัว เรียวหายที่หาง — โค้งของรอยจึงเป็นโค้งของทางที่ไถลมาเป๊ะ ๆ รวมทั้งคลื่นของ
 * ริบบิ้นใต้เท้า ทางที่ปลอมกว่า (แผ่นภาพลมติดท้าย) ไม่มีข้อมูลนี้ เลี้ยวทีเดียวก็หลุดทันที
 *
 * เก็บจุดใหม่เมื่อขยับพอ (ไม่ใช่ทุกเฟรม) — ยืนนิ่งแล้วรอยไม่ยุบเป็นกองอยู่ที่เท้า และความยาว
 * ของรอยเป็น "ระยะทาง" ไม่ใช่ "เวลา" เครื่องเร็วเครื่องช้าจึงเห็นรอยยาวเท่ากัน
 *
 * แถบหันเข้ากล้อง: แนวกว้างคิดจาก cross(ทิศวิ่ง, ทิศไปกล้อง) ทุกเฟรม ไม่ใช่แกนตายตัว
 * ไม่งั้นมองจากบางมุมจะเห็นแถบเป็นเส้นบางเฉียบ
 */

/** จำนวนจุดที่จำ = ความยาวรอย (จุดละ wtStep หน่วยฉาก) */
const POINTS = 26
/**
 * รอยเดียว ไม่ใช่สองแถบ
 *
 * กล้องมองเกือบตามทิศที่ตัวละครวิ่ง "ข้างหลัง" จึงเท่ากับ "หลังในความลึก" — รอยที่พาดกลาง
 * ลำตัวเลยถูกตัวเองบังหมดทั้งเส้น (วัดแล้ว: อยู่ในจอ แต่ไม่มีพิกเซลโผล่) จึงเลื่อนรอยออกข้าง
 * ลำตัวด้วย wtFan ให้พ้นเงาของตัว ส่วนที่ยังทับตัวถูกบังตามจริงเพราะยังเทียบ depth อยู่
 */
const STRIPS = 1
const HEAD = new THREE.Vector3()
const PREV = new THREE.Vector3()
const DIR = new THREE.Vector3()
const SIDE = new THREE.Vector3()
const TOCAM = new THREE.Vector3()
const TMP = new THREE.Vector3()
const CAM_L = new THREE.Vector3()

export function WindTrail() {
  const { camera, invalidate } = useThree()
  const grp = useRef(null)
  const mesh = useRef(null)
  const dots = useRef(null)
  const mat = useRef(null)

  /** จุดที่จำไว้ (พิกัดโลก) + ความเร็วตอนเก็บจุดนั้น ใช้คุมความกว้างของรอยตรงนั้น */
  const path = useMemo(
    () => ({
      pts: Array.from({ length: POINTS }, () => new THREE.Vector3()),
      speed: new Float32Array(POINTS),
      /** จำนวนจุดที่ใช้จริง — เริ่มจาก 0 แล้วโตขึ้นตอนออกตัว ไม่ใช่โผล่มาเป็นรอยยาวทั้งเส้น */
      count: 0,
      last: new THREE.Vector3(1e9, 1e9, 1e9),
    }),
    [],
  )

  /**
   * เรขาคณิตสร้างครั้งเดียว: สองแถว POINTS จุด อินเดกซ์คงที่ ต่อเฟรมเขียนแต่ตำแหน่ง/สี
   * (สร้างใหม่ทุกเฟรมคือคืน-ขอบัฟเฟอร์ GPU ใหม่ทุกเฟรม ซึ่งแพงกว่างานที่มันทำ)
   */
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const verts = POINTS * 2 * STRIPS
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(verts * 3), 3))
    const idx = []
    for (let sIdx = 0; sIdx < STRIPS; sIdx += 1) {
      const base = sIdx * POINTS * 2
      for (let i = 0; i < POINTS - 1; i += 1) {
        const a = base + i * 2
        idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
      }
    }
    g.setIndex(idx)
    g.frustumCulled = false
    return g
  }, [])

  /**
   * บัฟเฟอร์ของจุดตัวอย่าง — ใช้ตอนเปิดโหมดตรวจเท่านั้น (ดู wtDbg)
   * แยกใบจากริบบิ้นเพราะมันคือ "ข้อมูลดิบ" ที่อยากเห็นว่าจุดไปตกที่ไหนจริง ๆ
   */
  const dbgGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POINTS * 3), 3))
    g.frustumCulled = false
    return g
  }, [])

  useFrame(() => {
    const g = grp.current
    const m = mesh.current
    if (!g || !m) return
    const t = getTuner()
    const amt = t.wtAmt
    if (!ridePose.live || amt <= 0) {
      m.visible = false
      if (dots.current) dots.current.visible = false
      path.count = 0
      path.last.set(1e9, 1e9, 1e9)
      return
    }

    /**
     * ยกรอยขึ้นพ้นผิวถนนเล็กน้อย ไม่ใช่ปิด depth ทิ้ง
     *
     * จุดที่เก็บคือจุดกำเนิดของตัวละคร ซึ่งอยู่ระดับเดียวกับผิวริบบิ้นพอดี รอยจึงจมอยู่ในถนน
     * (วัดแล้ว: รอยอยู่ในจอ หัวที่ ndc -0.25 แต่มองไม่เห็นเลย) ตอนแรกแก้ด้วยการปิด depthTest
     * ซึ่งพาปัญหาใหม่มา — รอยไปทับตัวละครด้วย ยกขึ้นตามแกน y แล้วเปิด depth ไว้ตามเดิม
     * ตัวละครจึงบังรอยตรงที่มันควรบัง และถนนก็ไม่กินรอยทั้งเส้น
     */
    HEAD.set(ridePose.wx, ridePose.wy + t.wtY, ridePose.wz)
    const step = Math.max(0.02, t.wtStep)
    /**
     * เก็บจุดทุก ๆ ระยะ step *จริง* ไม่ใช่เฟรมละจุด
     *
     * เดิมเก็บจุดใหม่เมื่อขยับเกิน step ซึ่งกลายเป็น "เฟรมละจุด" ทันทีที่ตัวละครวิ่งเร็วกว่า
     * step ต่อเฟรม — ความยาวรอยจึงขึ้นกับ fps ของเครื่อง (วัดได้ 16.5 หน่วยทั้งที่สั่งไว้
     * 26 × 0.12 = 3.1) เดินเติมจุดกลางทางให้ครบทุกช่วง ระยะห่างจึงเท่ากับ step เสมอ
     * และความยาวรอย = POINTS × step คงที่ทุกเครื่อง
     */
    if (path.count === 0) {
      path.pts[0].copy(HEAD)
      path.speed[0] = 0
      path.count = 1
      path.last.copy(HEAD)
    }
    let guard = POINTS
    let moved = HEAD.distanceTo(path.last)
    const rate = Math.min(1, moved / (step * 3))
    while (moved > step && guard > 0) {
      guard -= 1
      TMP.subVectors(HEAD, path.last).normalize().multiplyScalar(step)
      path.last.add(TMP)
      // เลื่อนบัฟเฟอร์ลงหนึ่งช่อง หัวคือช่องแรกเสมอ (จุดเก่าไหลไปทางหาง)
      for (let i = Math.min(path.count, POINTS - 1); i > 0; i -= 1) {
        path.pts[i].copy(path.pts[i - 1])
        path.speed[i] = path.speed[i - 1]
      }
      path.pts[0].copy(path.last)
      path.speed[0] = rate
      path.count = Math.min(POINTS, path.count + 1)
      moved = HEAD.distanceTo(path.last)
    }
    // สะดุดยาว (แท็บกลับมา) แล้วเติมไม่ทัน = กระโดดไปที่หัวเลย ดีกว่าลากรอยยาวผิดรูป
    if (moved > step * POINTS) path.last.copy(HEAD)
    if (path.count < 3) {
      m.visible = false
      return
    }
    m.visible = true

    const pos = geo.attributes.position
    const col = geo.attributes.color
    const parent = g.parent
    const head = new THREE.Color(t.wtWarm > 0.5 ? '#fff3d0' : '#eaf4ff')
    const tail = new THREE.Color('#8fb6ff')
    const c = new THREE.Color()
    const used = path.count
    for (let i = 0; i < POINTS; i += 1) {
      const k = Math.min(i, used - 1)
      TMP.copy(path.pts[k])
      /**
       * จุดที่เก็บมาเป็นพิกัดโลก แต่เมชอยู่ใต้กลุ่มที่ถูกหมุน/เลื่อน/ย่อ — แปลงรายจุดตรงนี้
       * (เคยลองยัดเมทริกซ์ผกผันของกลุ่มให้เมช แล้ว decompose ทิ้งส่วนที่ไม่ใช่หมุน/เลื่อน/สเกล
       * สม่ำเสมอ พอกลุ่มมีสเกลไม่เท่ากันทุกแกน รอยก็ไปโผล่คนละที่ 26 จุดต่อเฟรมถูกกว่าการ
       * ตามแก้เคสนั้นเยอะ)
       */
      if (parent) parent.worldToLocal(TMP)
      // ทิศวิ่งตรงจุดนั้น: ใช้จุดข้างเคียง ไม่ใช่ทิศรวมของทั้งเส้น (รอยจะได้โค้งตามจริง)
      PREV.copy(path.pts[Math.min(used - 1, k + 1)])
      if (parent) parent.worldToLocal(PREV)
      DIR.subVectors(TMP, PREV)
      if (DIR.lengthSq() < 1e-8) DIR.set(1, 0, 0)
      DIR.normalize()
      CAM_L.copy(camera.position)
      if (parent) parent.worldToLocal(CAM_L)
      TOCAM.copy(CAM_L).sub(TMP).normalize()
      SIDE.crossVectors(DIR, TOCAM)
      if (SIDE.lengthSq() < 1e-8) SIDE.set(0, 1, 0)
      SIDE.normalize()

      /** เรียวจากหัวไปหาง แล้วคูณด้วยความเร็วตอนเก็บจุด — ช่วงที่พุ่งแรงรอยหนากว่า */
      const u = i / (POINTS - 1)
      /**
       * กว้างสุดไม่ได้อยู่ที่หัว แต่ถอยมาข้างหลังนิดหนึ่ง แล้วเรียวหายไปทางหาง
       *
       * ถ้ากว้างสุดอยู่ที่หัว รอยจะโผล่ทับตัวละครที่จุดที่มันบังแทนที่จะ "ออกมาจากท้าย"
       * ตัวคูณช่วงหัวจึงไล่จากศูนย์ในระยะสั้น ๆ ก่อน (ทรงเดียวกับหางดาวหาง)
       */
      const lead = Math.min(1, u / 0.14)
      const taper = (1 - u) ** t.wtTaper * (lead * lead * (3 - 2 * lead))
      const half = t.wtWide * taper * (0.45 + 0.55 * path.speed[k]) * 0.5

      // จางไปทางหาง เก็บเป็นสีต่อจุดยอด (วัสดุบวกแสง ความสว่างคือความทึบไปในตัว)
      c.copy(head).lerp(tail, u)
      c.multiplyScalar(taper * amt)

      for (let sIdx = 0; sIdx < STRIPS; sIdx += 1) {
        /** ยิ่งไปทางหางยิ่งเบนออกข้าง — ลมที่พุ่งผ่านตัวแล้วคลี่ออก ไม่ใช่รางตรงเป๊ะ */
        const spread = t.wtFan * (0.55 + u * 0.8)
        const o = (sIdx * POINTS + i) * 2 * 3
        const cxp = TMP.x + SIDE.x * spread
        const cyp = TMP.y + SIDE.y * spread
        const czp = TMP.z + SIDE.z * spread
        pos.array[o] = cxp + SIDE.x * half
        pos.array[o + 1] = cyp + SIDE.y * half
        pos.array[o + 2] = czp + SIDE.z * half
        pos.array[o + 3] = cxp - SIDE.x * half
        pos.array[o + 4] = cyp - SIDE.y * half
        pos.array[o + 5] = czp - SIDE.z * half
        for (let v = 0; v < 2; v += 1) {
          const q = o + v * 3
          col.array[q] = c.r
          col.array[q + 1] = c.g
          col.array[q + 2] = c.b
        }
      }
    }
    pos.needsUpdate = true
    col.needsUpdate = true

    /**
     * โหมดตรวจ: เห็น "ข้อมูลดิบ" ของรอย ไม่ใช่ผลลัพธ์ที่สวยแล้ว
     *
     * รอยนี้หายไปหน้าจอมาสามรอบด้วยเหตุต่างกันทุกครั้ง (ถนนบัง / ตัวละครบัง / แถบบางเฉียบ
     * จากมุมนั้น) สามอย่างนี้แยกออกจากกันด้วยตาไม่ได้ถ้าเห็นแต่ "ไม่มีอะไรโผล่" — เปิดโหมดนี้
     * แล้วจุดตัวอย่างกับโครงลวดจะวาดทับทุกอย่าง (ปิด depthTest) จึงบอกได้ทันทีว่ารอยอยู่ไหน
     * และถูกอะไรบัง
     */
    const dbg = import.meta.env.DEV && t.wtDbg > 0.5
    if (mat.current) {
      mat.current.wireframe = dbg
      mat.current.depthTest = !dbg
    }
    if (dots.current) {
      dots.current.visible = dbg
      if (dbg) {
        const dp = dbgGeo.attributes.position
        for (let i = 0; i < POINTS; i += 1) {
          TMP.copy(path.pts[Math.min(i, used - 1)])
          if (parent) parent.worldToLocal(TMP)
          dp.array[i * 3] = TMP.x
          dp.array[i * 3 + 1] = TMP.y
          dp.array[i * 3 + 2] = TMP.z
        }
        dp.needsUpdate = true
      }
    }
    if (import.meta.env.DEV) {
      const a = new THREE.Vector3(pos.array[0], pos.array[1], pos.array[2])
      const bIdx = (POINTS - 1) * 2 * 3
      const bb = new THREE.Vector3(pos.array[bIdx], pos.array[bIdx + 1], pos.array[bIdx + 2])
      if (parent) {
        parent.localToWorld(a)
        parent.localToWorld(bb)
      }
      const pa = a.clone().project(camera)
      const pb = bb.clone().project(camera)
      window.__wt = {
        n: used,
        vis: m.visible,
        head: [+pa.x.toFixed(2), +pa.y.toFixed(2)],
        tail: [+pb.x.toFixed(2), +pb.y.toFixed(2)],
        span: +path.pts[0].distanceTo(path.pts[Math.max(0, used - 1)]).toFixed(2),
        amt,
      }
    }
    invalidate()
  })

  return (
    <group ref={grp}>
      <mesh ref={mesh} geometry={geo} renderOrder={25} visible={false}>
        {/**
         * บวกแสง ไม่เขียน depth แต่ *ยังเทียบ depth*
         *
         * เทียบ depth ไว้คือเหตุผลที่รอยอยู่ "หลัง" ตัวละครจริง ๆ ไม่ใช่พาดทับ (ของทึบถูกวาด
         * ก่อนและเขียน depth ไว้แล้ว แถบโปร่งที่มาทีหลังจึงถูกตัดตรงที่ตัวละครบังพอดี)
         * ส่วนที่ไม่เขียน depth เอง เพราะรอยไม่ควรไปบังอะไรต่อ
         * DoubleSide เพราะแถบพลิกด้านได้เองตอนทางวิ่งหักโค้ง
         */}
        <meshBasicMaterial
          ref={mat}
          vertexColors
          transparent
          opacity={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* จุดตัวอย่างของทาง — วาดทับทุกอย่างเพื่อบอกว่ารอยอยู่ไหนจริง ๆ (โหมดตรวจ) */}
      <points ref={dots} geometry={dbgGeo} renderOrder={40} visible={false}>
        <pointsMaterial
          size={0.16}
          color="#ff2fd6"
          sizeAttenuation
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  )
}
