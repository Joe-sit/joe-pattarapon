import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { HeroRider } from '@/newhero/HeroRider'
import { HeroLights } from '@/newhero/heroLights'
import { InsideStencil, PortalMask } from '@/newhero/stencilPortal'
import { useDisposable } from '@/joespresso/scene/utils'
import { VIEW_H, stageIn } from '@/sections/whatidocard/stageTuner'
import { portalExtrudeGeo, portalGeo, portalNow, portalScreen } from './portalShape'
import { useStarTuner } from './starTuner'

/**
 * จอ About — พอร์ทัลรูปดาวสี่แฉก ตัวละครยืนคร่อมขอบ
 *
 * ท่าเข้าฉาก: หลังม่านเมฆหุบ ดาวขยายจากเล็กมาใหญ่ตามระยะเลื่อน (ดู stageIn) แล้วตัวละคร
 * ลอยขึ้นมาจากในดาว — ครึ่งล่างอยู่ *ใน* พอร์ทัล ครึ่งบน (หัว/ไหล่) อยู่ *นอก* พอร์ทัล
 *
 * ตัวละครเป็น `HeroRider` ตัวเดิมที่จอ what-i-do ใช้ ไม่ใช่โมเดลใหม่ — โหมดยืน ไม่มีบอร์ด
 * ใช้แขนของริกเอง ไม่มีลม หัวไม่ตามเมาส์ (เหตุผลของแต่ละสวิตช์อยู่ที่ whatidocard/CardStage
 * ซึ่งเลือกชุดเดียวกันมาก่อน)
 *
 * ### ครึ่งในครึ่งนอกทำด้วย stencil สองบิต ไม่ใช่การตัดโมเดล
 *
 * บัฟเฟอร์ stencil เก็บค่าเดียวต่อพิกเซล แต่ที่นี่มีสองคำถามซ้อนกัน: "นี่เนื้อในดาวไหม"
 * (พื้นในพอร์ทัลโผล่ได้) และ "นี่ที่ที่ตัวละครโผล่ได้ไหม" (= เนื้อในดาว **บวก** ช่องหัว)
 * จึงใช้บิตแยกกันแบบเดียวกับจอ what-i-do: ดาวเขียนสองบิต ช่องหัวเขียนบิตตัวละครตัวเดียว
 * แต่ละฝ่ายทดสอบด้วย `stencilFuncMask` ของบิตตัวเอง จึงไม่เห็นบิตของอีกฝ่าย
 *
 * ที่ต้องเป็นบิต ไม่ใช่ "ไม่เท่ากับ 0": เทียบแบบไม่เท่ากับศูนย์แล้วพื้นในพอร์ทัลจะรั่วออกไป
 * เต็มช่องหัวด้วย (บทเรียนเดียวกับ SCREEN_BIT/PORTAL_BIT ของ CardStage)
 *
 * ช่องหัวเป็นแผ่น stencil เปล่า มองไม่เห็นตัวมันเอง หน้าที่เดียวคือ "อนุญาต" ให้ตัวละครโผล่
 * เหนือเส้นแบ่ง ขอบซ้าย/ขวา/บนของมันจึงต้องกว้างเกินเงาของตัวละครเสมอ ไม่งั้นจะเห็นรอยตัด
 * เป็นเส้นตรงกลางอากาศ — ที่มองเห็นได้คือขอบล่างเท่านั้น ซึ่งคือเส้นที่ร่างกายเริ่มถูกดาวตัด
 */

/** บิตของ stencil — ดาวเขียนสองบิต ช่องหัวเขียนบิตตัวละคร (ดูคำอธิบายข้างบน) */
const STAR_BIT = 1
const BODY_BIT = 2
const STAR_MARK = STAR_BIT | BODY_BIT

const RAD = Math.PI / 180

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const outCubic = (v) => 1 - (1 - v) ** 3

export function StarStage() {
  return (
    <Canvas
      /**
       * ออร์โธเหมือนจอ what-i-do — ดาวต้องแบนเข้ากล้องเท่ากันทุกจุดของจอ
       *
       * เพอร์สเปกทีฟทำให้ของที่อยู่นอกแกนกลางเห็นด้านข้างของตัวเอง ดาวที่เยื้องไปทางขวา
       * จะเบ้ทันที และหน้ากากของรอยสาด (ซึ่งคิดเป็นสัดส่วนจอตรง ๆ — ดู starScreen)
       * ก็จะไม่ตรงกับรูปบนจออีก
       */
      orthographic
      camera={{ position: [0, 0, 40], zoom: 1, near: 1, far: 400 }}
      dpr={[1, 2]}
      /* stencil: ช่องดาวทำด้วย stencil buffer ซึ่ง r3f ไม่ได้ขอมาให้เอง
         alpha: ดาวลอยบนพื้นไล่สีของ section ซึ่งเป็น CSS ไม่ใช่ของในฉาก */
      gl={{ antialias: true, alpha: true, stencil: true }}
    >
      <Fit />
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}

/**
 * ตั้ง zoom ของกล้องออร์โธตามความสูงกรอบ — หน่วยฉากต่อพิกเซลจึงคงที่ทุกขนาดจอ
 *
 * ค่าเดียวกับจอ what-i-do (VIEW_H) เพราะตัวละครตัวเดียวกันต้องดูขนาดเท่ากันทั้งสองจอ
 */
function Fit() {
  const { camera, size } = useThree()
  const zoom = size.height / VIEW_H
  if (camera.zoom !== zoom) {
    camera.zoom = zoom
    camera.updateProjectionMatrix()
  }
  return null
}

/**
 * ดาวขยายตามระยะเลื่อน — และเป็น **เจ้าของค่าขนาดปัจจุบัน** ที่คนอื่นอ่าน
 *
 * ทั้งช่องหัว (เส้นแบ่ง) และหน้ากากของรอยสาด (คนละแคนวาส) ต้องรู้ว่าดาวใหญ่เท่าไรใน
 * *เฟรมนี้* ถ้าแต่ละฝ่ายคิดเองจากสูตรเดียวกัน มันจะตรงกันจนวันที่ใครแก้สูตรข้างเดียว —
 * ให้ที่นี่เขียนลงกล่องกลางที่เดียว (ดู portalNow / portalScreen ใน ./portalShape)
 *
 * เขียนลงวัตถุและกล่องใน useFrame ตรง ๆ ไม่ผ่าน state: ค่าเปลี่ยนทุกเฟรมที่เลื่อนจอ
 */
function Growing({ t, children }) {
  const g = useRef()
  const size = useThree((s) => s.size)
  useFrame(() => {
    const o = g.current
    if (!o) return
    const e = outCubic(clamp01(stageIn.v / Math.max(0.01, t.bSpan)))
    const s = t.bFrom + (1 - t.bFrom) * e
    o.scale.setScalar(s)
    portalNow.s = s
    /* ฉายเป็นสัดส่วนจอให้หน้ากากรอยสาด — ออร์โธแปลงตรง ๆ ไม่ต้องผ่านเมทริกซ์ */
    portalScreen(t, s, size.width / Math.max(1, size.height))
  })
  return (
    <group
      ref={g}
      position={[t.sX, t.sY, 0]}
      /* เอียงเฉียงเล็กน้อยตามภาพอ้างอิง — ทั้งตัวดาวและหน้ากากอยู่ในกลุ่มนี้ เงาบนจอจึงตรงกัน */
      rotation={[t.sPitch * RAD, t.sYaw * RAD, t.sRoll * RAD]}
    >
      {children}
    </group>
  )
}

/**
 * ช่องหัว — แผ่น stencil เปล่าที่ขอบล่างคือเส้นแบ่งใน/นอกพอร์ทัล
 *
 * ไม่อยู่ในกลุ่มที่ขยาย เพราะขนาดของมันต้องคงที่ (ต้องกว้างเกินเงาตัวละครเสมอ) แต่ *ตำแหน่ง*
 * ของขอบล่างเลื่อนตามดาว — อ่านขนาดปัจจุบันจากกล่องกลางที่ Growing เขียนไว้
 */
function HeadGate({ t, geometry }) {
  const m = useRef()
  useFrame(() => {
    const o = m.current
    if (!o) return
    o.position.y = t.sY + t.cCut * t.sRy * portalNow.s + GATE / 2
  })
  return (
    <mesh ref={m} geometry={geometry} position={[t.cX, 0, 0]} renderOrder={-39}>
      <PortalMask mark={BODY_BIT} />
    </mesh>
  )
}

/** ตัวละครลอยขึ้นมาจากในดาว — ช้ากว่าดาวหนึ่งจังหวะ */
function Rising({ t, children }) {
  const g = useRef()
  useFrame(() => {
    const o = g.current
    if (!o) return
    const e = outCubic(clamp01((stageIn.v - t.cDelay) / Math.max(0.01, t.cSpan)))
    o.position.y = t.cY - (1 - e) * t.cLift
  })
  return <group ref={g}>{children}</group>
}

/**
 * ลายไล่สีในเนื้อดาว — ม่วงอ่อนเรืองแสงตามภาพอ้างอิง
 *
 * ไล่สีด้วย **สีที่จุดยอด** ไม่ใช่พื้นผิว: `ExtrudeGeometry` ของดาวมี uv เป็นพิกัดของรูป
 * ไม่ได้ไล่ 0..1 ตามกรอบ การแปะภาพจึงต้องคิด uv ใหม่เองทั้งชุด ขณะที่ไล่สีตามความสูง
 * ต้องการแค่ตำแหน่ง y ของจุดยอดซึ่งมีอยู่แล้ว — ไม่ต้องมีพื้นผิว ไม่ต้องมีเชดเดอร์
 *
 * วัสดุเป็นแบบรับแสง ไม่ใช่สีทึบ: ความเป็นของ 3D มาจากด้านข้างกับขอบลบมุมที่ไฟจับไม่เท่ากัน
 * (ดู HeroLights) สีทึบจะได้ดาวหนาที่แบนเท่าเดิม
 *
 * คืน attribute ตอนถอด: ทิ้ง attribute ค้างไว้คือฝากของให้เรขาคณิตที่คนอื่นถืออยู่
 */
function StarFill({ geometry, ry, rx, t }) {
  const colors = useMemo(() => {
    const pos = geometry.getAttribute('position')
    const out = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i += 1) {
      /* ไล่ตามความสูงในรูป (-ry..+ry) → 0..1 แล้วยกกำลังสองให้สว่างกระจุกที่แฉกบน */
      const k = clamp01((pos.getY(i) / ry + 1) / 2)
      const up = k * k
      /* -1..1 ตามแกนซ้าย-ขวา — เอียงวรรณะอีกชั้นให้ด้านหนึ่งเย็นกว่า */
      const side = clamp01((pos.getX(i) / Math.max(1e-6, rx) + 1) / 2) * 2 - 1
      const hue = (((t.sHue + t.sHueSpan * up + t.sHueSide * side) % 360) + 360) % 360
      /**
       * อิ่มสีลดลงตอนเข้าใกล้แฉกบน — แต่ลดแค่นิดเดียว
       *
       * ลดมาก (เคยลอง 0.45) ปลายแฉกกลายเป็น *เทา* เพราะความสว่างสูงบวกอิ่มสีต่ำคือสีเทา
       * ที่ตาอ่านว่าสีซีด ไม่ใช่สีอ่อน วรรณะที่หมุนไปอีกทาง (sHueSpan) เป็นตัวแยกปลายแฉก
       * จากโคนแฉกอยู่แล้ว ไม่ต้องพึ่งการลดอิ่มสี
       */
      const sat = t.sSat * (1 - 0.18 * up)
      c.setHSL(hue / 360, clamp01(sat), clamp01(t.sLightLow + (t.sLightTop - t.sLightLow) * up))
      out[i * 3] = c.r
      out[i * 3 + 1] = c.g
      out[i * 3 + 2] = c.b
    }
    return out
  }, [geometry, ry, rx, t.sHue, t.sHueSpan, t.sHueSide, t.sSat, t.sLightLow, t.sLightTop])

  useEffect(() => {
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return () => geometry.deleteAttribute('color')
  }, [geometry, colors])

  /**
   * เรืองในตัวเองเล็กน้อย — ด้านข้างของก้อนที่หันหนีไฟจะทึบเป็นเทาถ้าพึ่งไฟในฉากอย่างเดียว
   *
   * ใช้สีเรืองเป็นวรรณะหลักที่ความสว่างกลาง ไม่ใช่สีขาว: ขาวจะกลืนวรรณะที่ไล่ไว้ทั้งหมด
   */
  const emissive = useMemo(
    () => new THREE.Color().setHSL(t.sHue / 360, clamp01(t.sSat * 0.8), 0.5),
    [t.sHue, t.sSat],
  )

  return (
    <meshStandardMaterial
      vertexColors
      color="#ffffff"
      roughness={t.sGloss}
      metalness={0.12}
      emissive={emissive}
      emissiveIntensity={t.sGlow}
    />
  )
}

/** ขนาดของช่องหัว — กว้างเกินเงาตัวละครทุกด้าน ยกเว้นขอบล่างที่เป็นเส้นแบ่ง (ดูหัวไฟล์) */
const GATE = 26

/** กี่เฟรมที่ยังกวาดหาชิ้นส่วนอยู่ — ริกเป็น GLB ที่มาทีหลัง ไม่ได้อยู่ตั้งแต่เฟรมแรก */
const SWEEP = 240

/** ชิ้นนี้อยู่ใต้กลุ่มนั้นไหม */
function under(o, root) {
  for (let p = o; p; p = p.parent) if (p === root) return true
  return false
}

/**
 * เหลือแต่หัว — ซ่อนทุกชิ้นที่ไม่ได้อยู่ใต้ `HeadGroup` ของริก
 *
 * ริกรวมชิ้นส่วนหัวทั้งหมด (กล่องหัว ผม จอน ตา) ไว้ในกลุ่มชื่อ `HeadGroup` ตอนแตก GLB อยู่
 * แล้ว — มันถูกทำไว้เพื่อให้หัวหมุนแยกจากลำตัว (ดู joespresso/scene/Mascot) ที่นี่ยืมกลุ่ม
 * นั้นมาเป็นเส้นแบ่ง "หัว/ไม่ใช่หัว" จึงไม่ต้องไล่เดาชื่อชิ้นหรือแยกตามสีเอง
 *
 * ปิดด้วย `visible` ไม่ใช่ถอดออกจากฉาก: ถอดแล้วต้องปั้นใหม่ตอนเปิดกลับ (เรขาคณิต วัสดุ
 * คอมไพล์เชดเดอร์ใหม่ทั้งชุด) ขณะที่ `visible = false` คือของยังอยู่ในหน่วยความจำเฉย ๆ
 * — และริกตัวนี้เป็นตัวเดียวกับที่จอแรกใช้ ห้ามแตะโครงของมัน
 *
 * กวาดใน useFrame ไม่ใช่ตอน mount: GLB มาทีหลัง เฟรมแรก ๆ ยังไม่มีชิ้นให้ซ่อน แล้วหยุด
 * เมื่อครบโควตา (นับใหม่ทุกครั้งที่สวิตช์เปลี่ยน เพื่อให้เปิดกลับได้)
 */
function HeadOnly({ on, children }) {
  const g = useRef()
  const n = useRef(0)
  useEffect(() => {
    n.current = 0
  }, [on])
  useFrame(() => {
    const root = g.current
    if (!root || n.current > SWEEP) return
    n.current += 1
    let head = null
    root.traverse((o) => {
      if (o.name === 'HeadGroup') head = o
    })
    /* ยังไม่เจอหัว = GLB ยังไม่มา ซ่อนตอนนี้คือซ่อนหัวไปด้วยแล้วไม่มีใครคืนให้ */
    if (on && !head) return
    root.traverse((o) => {
      if (!o.isMesh) return
      /**
       * แตะเฉพาะชิ้นที่ *ไม่ใช่* หัว — ของในหัวเป็นของริก ห้ามเขียนทับ
       *
       * เดิมกวาดแล้วเขียน `visible = true` ให้ทุกชิ้นใต้ HeadGroup ซึ่งเป็นการ *ฟื้น* ของที่
       * ริกซ่อนไว้เองด้วยเหตุของมัน — ตาดำของ GLB ถูกซ่อนเพราะหน้าการ์ตูนวาดตาลงแผ่นหน้า
       * แทน (ดู wantFace ใน joespresso/scene/Mascot) พอถูกเปิดกลับก็ได้ **ตาสองชุด** ทับกัน
       * ประกายในตาก็เป็นของที่ริกเปิด/ปิดทุกเฟรมตามบีต ใครมาเขียนทับก็ชนกันเปล่า ๆ
       *
       * ซ่อนแล้วจำค่าเดิมไว้ (ท่าเดียวกับ userData.lumberHid ของริก) ปิดสวิตช์จึงคืนได้ตรง
       * ค่าที่ริกเคยตั้ง ไม่ใช่คืนเป็น "เห็น" เสมอ
       */
      if (head && under(o, head)) return
      if (on) {
        if (o.userData.headOnlyHid === undefined) o.userData.headOnlyHid = o.visible
        if (o.visible) o.visible = false
      } else if (o.userData.headOnlyHid !== undefined) {
        o.visible = o.userData.headOnlyHid
        o.userData.headOnlyHid = undefined
      }
    })
  })
  return <group ref={g}>{children}</group>
}

function Scene() {
  /* ประตูให้สคริปต์ตรวจงานอ่านฉากได้ — dev เท่านั้น (ท่าเดียวกับ window.__cardScene) */
  const { scene } = useThree()
  useEffect(() => {
    if (import.meta.env.DEV) window.__starScene = scene
  }, [scene])

  /* ค่าที่ลากจากแผง (dev) — ผู้ชมได้ค่าเริ่มต้นซึ่งเขียนไว้ใน ./starTuner */
  const t = useStarTuner()

  /**
   * ตัวดาว — ของหนาจริง ปั้นใหม่เมื่อ *รูปร่าง* เปลี่ยน ไม่ใช่ทุกครั้งที่ค่าใดค่าหนึ่งขยับ
   *
   * ที่วาง/การเอียง/จังหวะ เป็น transform ของกลุ่ม ไม่แตะเรขาคณิต — แยก dependency ไว้
   * เฉพาะสี่ตัวที่เปลี่ยนรูปจริง ลากสไลเดอร์ตำแหน่งจึงไม่สร้าง buffer ใหม่ทุกเฟรมที่ลาก
   */
  const body = useMemo(() => portalExtrudeGeo(t.sRx, t.sRy, t.sDepth), [t.sRx, t.sRy, t.sDepth])
  useDisposable(body)
  /**
   * หน้ากาก stencil = **หน้าดาว** ไม่ใช่ตัวดาวทั้งก้อน
   *
   * เอาก้อนหนาเขียน stencil ก็ได้เงาเดียวกัน แต่แผ่นแบนที่นั่งทับหน้าดาวพอดีถูกกว่า
   * (สามเหลี่ยมน้อยกว่าหลายเท่า และไม่มีด้านข้างมาเขียนซ้ำที่พิกเซลเดิม)
   *
   * ยกมาหน้าสุดครึ่งความลึกให้ทับหน้าดาว ไม่ใช่วางที่ระนาบศูนย์ซึ่งเป็นกลางความหนา —
   * ตอนดาวเอียง กลางความหนากับหน้าดาวฉายลงจอไม่ตรงกัน เงาจะเหลื่อมกันเท่าความหนาครึ่งหนึ่ง
   */
  const face = useMemo(() => portalGeo(t.sRx, t.sRy), [t.sRx, t.sRy])
  useDisposable(face)
  const gate = useMemo(() => new THREE.PlaneGeometry(GATE, GATE), [])
  useDisposable(gate)

  return (
    <>
      <HeroLights />

      {/**
       * หน้ากากกับเนื้อในดาวอยู่ในกลุ่มที่ขยายกลุ่มเดียวกัน — ไม่ใช่สองกลุ่มที่ขยายเท่ากัน
       *
       * สองกลุ่มที่อ่าน stageIn คนละที่คือสองแหล่งความจริงของการเคลื่อนไหวชิ้นเดียว
       * วันที่ใครแก้ easing ข้างเดียว หน้ากากกับลายจะเหลื่อมกันหนึ่งเฟรมโดยไม่มีใครรู้
       *
       * หน้ากากเขียนก่อน (renderOrder ติดลบมาก) เนื้อในตามมา แล้วตัวละครทับทีหลังสุด
       */}
      <Growing t={t}>
        <mesh geometry={face} position={[0, 0, t.sDepth / 2]} renderOrder={-40}>
          <PortalMask mark={STAR_MARK} />
        </mesh>
        <mesh geometry={body} renderOrder={-10} visible={t.swStar > 0.5}>
          <StarFill geometry={body} ry={t.sRy} rx={t.sRx} t={t} />
        </mesh>
      </Growing>

      <HeadGate t={t} geometry={gate} />

      {/**
       * เส้นแบ่งใน/นอกพอร์ทัลแบบมองเห็น — dev เท่านั้น
       *
       * หาที่ของ cCut ได้เร็วกว่าไล่ลากทีละนิดแล้วเดาว่าเส้นอยู่ไหน: ใต้เส้นนี้ร่างกายถูก
       * รูปดาวตัด เหนือเส้นเห็นทั้งตัว
       */}
      {import.meta.env.DEV && t.swCut > 0.5 && <CutLine t={t} />}

      {/**
       * ตัวละคร — เห็นเฉพาะที่บิตตัวละครติดอยู่ (เนื้อในดาว + ช่องหัว)
       *
       * วาดทีหลังเนื้อในดาว (renderOrder สูงกว่า) จึงทาทับได้ — เขายืนอยู่ *หน้า* พื้นใน
       * พอร์ทัล ไม่ใช่จมอยู่ในนั้น
       */}
      <Rising t={t}>
        <group position={[t.cX, 0, t.cZ]} scale={t.cScale} visible={t.swChar > 0.5}>
          <InsideStencil bit={BODY_BIT} order={5}>
            <HeadOnly on={t.swHeadOnly > 0.5}>
            <HeroRider
              stand
              noBoard
              noLumber
              noWind
              /**
               * ไม่มีท่าอยู่นิ่ง — หัวในดาวต้องนิ่งสนิท
               *
               * `noIdle` ปิดทุกอย่างที่ขยับเองตอนตัวนิ่ง: ไหวทั้งตัว ไหวข้อต่อ กระพริบ/กวาดตา
               * และหัวตามเมาส์ (ดู HeroRider) ที่นี่เหลือแต่หัวโผล่พ้นพอร์ทัล การไหวเบา ๆ ของ
               * ริกที่ออกแบบไว้สำหรับตัวเต็มยืนบนบอร์ด กลายเป็นหัวลอยสั่นในกรอบดาว
               */
              noIdle
              followOverride={{
                headYaw: 0,
                headPitch: 0,
                headRoll: 0,
                headEase: 1,
                headBaseYaw: t.cHeadYaw * RAD,
                headBasePitch: t.cHeadPitch * RAD,
                headBaseRoll: t.cHeadRoll * RAD,
                headFollow: 0,
                headCurve: 1,
                headDead: 0,
                headBounce: 0,
                headIdleBack: 0,
              }}
            />
            </HeadOnly>
          </InsideStencil>
        </group>
      </Rising>
    </>
  )
}

/** เส้นแบ่งที่มองเห็น (dev) — ตามดาวที่กำลังขยายเหมือนช่องหัว */
function CutLine({ t }) {
  const m = useRef()
  useFrame(() => {
    const o = m.current
    if (!o) return
    o.position.y = t.sY + t.cCut * t.sRy * portalNow.s
  })
  return (
    <mesh ref={m} position={[t.cX, 0, 9]} renderOrder={900}>
      <planeGeometry args={[t.sRx * 2.4, 0.04]} />
      <meshBasicMaterial color="#ff2d55" depthTest={false} toneMapped={false} />
    </mesh>
  )
}
