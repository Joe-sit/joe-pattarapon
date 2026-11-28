import { Suspense, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { HeroRider } from '@/newhero/HeroRider'
import { HeroLights } from '@/newhero/heroLights'
import { VIEW_H } from '@/sections/whatidocard/stageTuner'
import { getWhatIDoTuner } from './whatidoTuner'

/**
 * ตัวละครสามมิติในคอลลาจของจอ "สิ่งที่ทำ" — ยืนเต็มตัว แทนที่รูปถ่าย
 *
 * เป็น `HeroRider` **ตัวเดียวกัน**กับที่ยืนอยู่ในพอร์ทัลดาวของเวอร์ชันก่อน (และตัวเดียวกับ
 * จอแรก) ไม่ใช่โมเดลใหม่ — ต่างกันแค่สามข้อ: ไม่มีพอร์ทัลมาตัด จึงเห็นทั้งตัวไม่ใช่แค่หัว,
 * ไม่มี stencil (ของเดิมวาดผ่านช่องดาวด้วย `InsideStencil`) และ *มีท่าอยู่นิ่ง* คือหายใจ
 * กะพริบตา ไหวตัวเบา ๆ ตามที่ริกออกแบบไว้ ซึ่งของเดิมปิดไว้เพราะเหลือแต่หัวลอยในกรอบ
 *
 * ### ทำไมกล้องเป็นออร์โธ
 *
 * ตัวละครตัวนี้ต้องดู "ขนาดเท่ากัน" กับที่อยู่จออื่น: ออร์โธที่ zoom ผูกกับความสูงกรอบ
 * (`VIEW_H` ตัวเดียวกับจอ what-i-do เดิม) ให้หน่วยฉากต่อพิกเซลคงที่ทุกขนาดจอ ส่วนเพอร์-
 * สเปกทีฟจะทำให้ตัวที่วางเยื้องจากแกนกลางเห็นด้านข้างตัวเอง — เอียงคนละองศาทุกขนาดจอ
 *
 * ### ทำไมแยกไฟล์
 *
 * มันเป็นแคนวาสของตัวเอง (ฉาก 3D ในกล่องของคอลลาจ) และถูก `lazy` โหลดเฉพาะตอนจอนี้
 * เข้ามาในสายตา — โมเดลตัวละครเป็นไฟล์ใหญ่ ไม่ควรถูกดึงตอนคนดูยังอยู่จอแรก
 */

/**
 * ขนาด/ที่ยืน/มุมหัน อ่านจากสโตร์ของจอ (./whatidoTuner) ไม่ใช่ค่าคงที่ในไฟล์นี้
 *
 * ค่าพวกนี้ต้องลองบนจอจริง: ตัวละครต้องพอดีกับวงเล็บส้มกับโมเสกที่อยู่คนละชั้น (DOM) —
 * อ่านในลูปวาด ไม่ผ่าน prop เพราะส่ง prop เข้าฉาก 3D = reconcile ทั้งกิ่งทุกครั้งที่ลาก
 *
 * `figTurn` เป็นองศารอบแกนตั้ง: ริกหันหน้าเข้ากล้อง (+z) มุมลบจึงหันไปทาง −x คือซ้ายของจอ
 */

export function HeroFigure() {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 40], zoom: 1, near: 1, far: 400 }}
      dpr={[1, 2]}
      /* alpha: ตัวละครยืนบนคอลลาจ ซึ่งเป็น DOM ไม่ใช่ของในฉาก แคนวาสจึงต้องโปร่ง */
      gl={{ antialias: true, alpha: true }}
    >
      <Fit />
      {/* ไฟชุดเดียวกับฉากจอแรก — ตัวเดียวกันต้องรับแสงเหมือนกัน */}
      <HeroLights shadows={false} />
      <Suspense fallback={null}>
        <Figure />
      </Suspense>
    </Canvas>
  )
}

/**
 * ตั้ง zoom ของกล้องออร์โธตามความสูงกรอบ — หน่วยฉากต่อพิกเซลจึงคงที่ทุกขนาดจอ
 *
 * คิดในลูปวาด ไม่ใช่ตอนเรนเดอร์: `size` เปลี่ยนตอนย่อจอ ถ้าตั้งค่าตอนเรนเดอร์อย่างเดียว
 * กล้องจะตามขนาดกล่องช้าไปหนึ่งเฟรมทุกครั้งที่ผังหน้าขยับ
 */
function Fit() {
  const { camera, size } = useThree()
  useFrame(() => {
    const zoom = size.height / VIEW_H
    if (camera.zoom !== zoom) {
      camera.zoom = zoom
      camera.updateProjectionMatrix()
    }
  })
  return null
}

/**
 * ตัวละคร — ยืนนิ่งสนิท ไม่มีบอร์ด ไม่มีขวาน ไม่มีลมตี **ไม่มีท่าอยู่นิ่ง**
 *
 * `noIdle` ปิดทุกอย่างที่ขยับเองตอนตัวนิ่ง: ไหวทั้งตัว ไหวข้อต่อ กะพริบ/กวาดตา และหัวตาม
 * เมาส์ (ดู HeroRider) — ตามที่สั่ง ในคอลลาจนี้ตัวละครทำหน้าที่เหมือน *รูปในผัง* ที่ถูก
 * วงเล็บกับโมเสกจัดกรอบไว้ การไหวเบา ๆ ของริกทำให้ของที่ควรนิ่งดูสั่น
 *
 * ชุดพรอปที่เหลือเหมือนเวอร์ชันพอร์ทัลเดิม (`stand`/`noBoard`/`noLumber`/`noWind`)
 */
function Figure() {
  /** กลุ่มนอก = ตัวที่ถูกย่อ/เลื่อนให้พอดีกรอบ, กลุ่มใน = ตัวละครขนาดจริงของมันเอง */
  const fit = useRef()
  const body = useRef()
  const box = useRef(new THREE.Box3())
  const mid = useRef(new THREE.Vector3())
  /** เฟรมที่เหลือให้วัดซ้ำ — ริกจัดท่าตัวเองอยู่สองสามเฟรมแรก ค่าจึงยังนิ่งไม่ได้ทันที */
  const settle = useRef(24)
  /** ค่าที่ใช้จัดครั้งล่าสุด — ถ้าแผงจูนขยับค่าใดค่าหนึ่ง ต้องวัดใหม่ ไม่ใช่ค้างท่าเดิม */
  const applied = useRef('')
  /**
   * จัดตัวละครให้พอดีกรอบด้วยการ *วัดตัวมันเอง* ไม่ใช่เลขสเกลที่จดไว้
   *
   * ค่าที่จดไว้ (cScale ของเวอร์ชันพอร์ทัล) ถูกจูนกับกรอบคนละใบ: ที่นั่นกล้องเห็นแค่ช่องดาว
   * ที่นี่กรอบเป็นกล่องในคอลลาจซึ่งสูงกว่าเกือบสองเท่า ผลคือได้ตัวละครขนาดหัวโตเต็มกรอบ
   * (เห็นมาแล้ว) — วัดกล่องครอบจริงแล้วหารกับความสูงที่เห็นของกล้อง จึงพอดีทุกขนาดจอ
   *
   * วัดซ้ำสองสามสิบเฟรมแรกแล้วหยุด: `setFromObject` เดินทุกเมชในตัวละคร ไม่ใช่งานที่ควร
   * ทำทุกเฟรมตลอดชีวิตของจอ
   */
  useFrame(({ camera, size }) => {
    if (!fit.current || !body.current) return
    const t = getWhatIDoTuner()
    /* หันตัวก่อนวัด: กล่องครอบของท่าที่หันแล้วกว้างไม่เท่าเดิม */
    body.current.rotation.y = (t.figTurn * Math.PI) / 180
    const key = `${t.figFill}|${t.figAnchor}|${t.figTurn}|${size.height}`
    if (applied.current !== key) {
      applied.current = key
      settle.current = 24
    }
    if (settle.current <= 0) return
    settle.current -= 1
    fit.current.scale.setScalar(1)
    fit.current.position.set(0, 0, 0)
    fit.current.updateWorldMatrix(true, true)
    const b = box.current.setFromObject(body.current)
    const h = b.max.y - b.min.y
    if (h <= 0) return
    /* ความสูงที่กล้องออร์โธเห็นเป็นหน่วยฉาก = ความสูงกรอบ ÷ zoom */
    const view = size.height / camera.zoom
    const s = (view * t.figFill) / h
    b.getCenter(mid.current)
    fit.current.scale.setScalar(s)
    fit.current.position.set(
      -mid.current.x * s,
      view * (0.5 - t.figAnchor) - mid.current.y * s,
      0,
    )
  })
  return (
    <group ref={fit}>
      {/* มุมหันเขียนในลูปวาด ไม่ใช่ prop — ดูหัวไฟล์ */}
      <group ref={body}>
        <HeroRider stand noBoard noLumber noWind noIdle />
      </group>
    </group>
  )
}
