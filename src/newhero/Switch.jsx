import { useMemo } from 'react'
import * as THREE from 'three'
import { MeshTransmissionMaterial } from '@react-three/drei'

/**
 * แผ่นแคปซูล — หน้าตรงเป็นสเตเดียมมุมมนสุด และสันตามความหนาก็มนสุดเช่นกัน
 *
 * RoundedBoxGeometry ใช้รัศมีเดียวทุกทาง พอรางบางกว่าสูง รัศมีจะถูกจำกัดด้วยความหนา
 * ปลายรางเลยไม่เป็นครึ่งวงกลมอีกต่อไป — กลายเป็นกล่องมุมมนธรรมดา
 * วิธีนี้แยกสองเรื่อง: รูปร่างหน้าตัดคุมด้วย shape (มนสุด = ครึ่งความสูง)
 * ส่วนความมนตามความหนาคุมด้วย bevel ของ extrude — ได้ทั้งสองอย่างพร้อมกัน
 * ย่อ shape ลงเท่ากับ bevel ก่อน ขนาดรวมหลังปูดออกจึงเท่าที่สั่งพอดี
 */
function capsuleSlab(w, h, depth) {
  const b = Math.min(depth, h) * 0.499
  const iw = w - b * 2
  const ih = h - b * 2
  const r = ih / 2
  const sh = new THREE.Shape()
  const x = -iw / 2
  const y = -ih / 2
  sh.moveTo(x + r, y)
  sh.lineTo(x + iw - r, y)
  sh.absarc(x + iw - r, y + r, r, -Math.PI / 2, Math.PI / 2, false)
  sh.lineTo(x + r, y + ih)
  sh.absarc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2, false)
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: Math.max(1e-4, depth - b * 2),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 5,
    curveSegments: 24,
  })
  g.translate(0, 0, -depth / 2)
  return g
}
import { useDisposable } from '@/joespresso/scene/utils'

/**
 * อบสีไล่ระดับลงไปในเรขาคณิตเป็นสีต่อจุดยอด
 *
 * ทำครั้งเดียวตอนสร้างทรง ไม่ต้องมี texture ให้โหลดหรือ uv ให้กังวล และใช้ได้กับทุกทรง
 * ทิศไล่คิดจากกล่องขอบเขตของทรงเอง สัดส่วนจึงถูกเสมอไม่ว่าจะย่อขยายแค่ไหน
 */
function bakeGradient(geo, from, to, dir = [1, -1, 0]) {
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const min = new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z)
  const size = new THREE.Vector3().subVectors(bb.max, bb.min)
  const d = new THREE.Vector3(...dir).normalize()
  const pos = geo.attributes.position
  const a = new THREE.Color(from)
  const b = new THREE.Color(to)
  const c = new THREE.Color()
  const p = new THREE.Vector3()
  const arr = new Float32Array(pos.count * 3)
  // ช่วงของค่าที่ฉายลงบนทิศไล่ — ใช้ normalize ให้ t อยู่ใน 0..1 พอดีทั้งชิ้น
  const lo = -Math.abs(size.x * d.x) / 2 - Math.abs(size.y * d.y) / 2 - Math.abs(size.z * d.z) / 2
  const span = Math.max(1e-6, -lo * 2)
  for (let i = 0; i < pos.count; i += 1) {
    p.fromBufferAttribute(pos, i).sub(min).addScaledVector(size, -0.5)
    const t = Math.min(1, Math.max(0, (p.dot(d) - lo) / span))
    c.copy(a).lerp(b, t)
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

/**
 * สวิตช์เปิด/ปิด — แบบ UI toggle switch ที่ปั้นเป็นของสามมิติ
 *
 * ราง (track) เป็นแคปซูลแบนหันหน้าเข้าหาคนดู มุมมนเป็นครึ่งวงกลมพอดี (รัศมี = ครึ่ง
 * ความสูง) — นั่นคือสิ่งที่ทำให้อ่านออกว่าเป็นสวิตช์ ไม่ใช่กล่องมุมมน ปุ่ม (knob)
 * เป็นวงกลมทึบเลื่อน **ซ้าย-ขวา** ในราง ไม่ใช่โผล่ออกทางปลายแกนเข้าหาคนดู
 *
 * ทั้งรางและปุ่มมีความหนา ไม่ใช่แผ่นแบน — พอฉากหมุน/แสงเฉียงจะเห็นสันข้างทั้งคู่
 * และเห็นว่าปุ่มนูนพ้นหน้าราง เหมือนสวิตช์จริงที่ปุ่มจับได้
 *
 * ปั้นในกล่องหน่วยเดียว: หน้ารางหันไปทาง +z จุดกำเนิดกลางราง
 */

/**
 * ไล่สีของราง/ปุ่ม — คู่ละสองสี ไล่ตามแนวทแยงจากมุมบนซ้ายไปล่างขวา
 *
 * เก็บเป็นสีจริงสองตัว ไม่ใช่รูปไล่สี: อบเข้าไปเป็นสีต่อจุดยอด (vertex color) ได้เลย
 * ไม่ต้องพึ่ง uv ของ ExtrudeGeometry ซึ่งไม่ได้ไล่ตามที่ตาเห็นว่าเป็น "ยาวไปตามราง"
 */
const TRACK = ['#f2fab4', '#d2e78d']
/** ปุ่ม: หน้าสว่าง ผนังข้างเข้มลงเป็นเขียวอมน้ำเงิน — ไล่ตามความลึก ไม่ใช่ตามแนวทแยง */
const KNOB = ['#4ec95c', '#2b7f6a']
const ICON = '#ffffff'
/**
 * ซ่อนเส้นขอบเฉพาะตอนถูกวาดลงบัฟเฟอร์ของกระจก (transmission) ไม่ใช่ทุกบัฟเฟอร์
 *
 * สองข้อที่เคยพลาด:
 *   1. เช็คแค่ "ไม่ใช่จอ" — post pass ของกล้อง (CameraFX) ก็เป็นบัฟเฟอร์ เส้นขอบเลยหาย
 *      ทุกครั้งที่เปิดเอฟเฟกต์กล้อง/rim → บัฟเฟอร์หลักติดป้าย userData.mainPass ให้เว้นไว้
 *   2. แตะ material ที่ส่งมาโดยไม่ดูว่าเป็นของใคร — โหมด clay สลับทุกชิ้นให้ใช้วัสดุก้อนเดียว
 *      ปิด colorWrite ทีเดียวเลยดับทั้งฉาก → แตะเฉพาะวัสดุที่ติดป้าย OUTLINE_TAG ของตัวเอง
 */
const OUTLINE_TAG = { switchOutline: true }
function hideInBuffers(renderer, material) {
  if (!material.userData?.switchOutline) return
  const rt = renderer.getRenderTarget()
  material.colorWrite = rt === null || rt.userData?.mainPass === true
}

const OUTLINE = '#2b6b45'

export function Switch({
  /** ความยาวรางเทียบความสูง — 2 คือสัดส่วนของ toggle มาตรฐาน */
  len = 2,
  /** ครึ่งความสูงราง = รัศมีปลายมน */
  radius = 0.5,
  /** ตำแหน่งปุ่ม 0 = ปิด (ซ้าย) 1 = เปิด (ขวา) */
  pos = 1,
  /** ความทึบของราง 1 = ทึบ */
  opacity = 0.8,
  /** ขนาดไอคอนเทียบรัศมีปุ่ม */
  icon = 0.95,
  /** ความหนาเส้นขอบรอบนอก (หน่วยเดียวกับรัศมี) — 0 = ไม่มีขอบ */
  outline = 0,
  /** ความเข้มของเส้นขอบ */
  outlineAlpha = 0.9,
  /** วาดสันของ extrusion (วงหน้า/วงหลัง) ด้วยหรือไม่ */
  showEdges = true,
  /** เกณฑ์มุมที่นับว่าเป็น "สัน" (องศา) — ต่ำลงได้เส้นเยอะขึ้นรวมผิวโค้ง */
  edgeAngle = 25,
  /** ความเป็นกระจกของราง 0 = ทึบแบน 1 = ใสหักเหเต็มที่ */
  glass = 1,
  /** ความฝ้าของกระจก — ยิ่งมากของหลังยิ่งเบลอ (กระจกฝ้า) */
  blur = 0.45,
  /** ความหนาของก้อน (extrusion) เทียบรัศมี — ปุ่มหนาตามสัดส่วนไปด้วย */
  thickness = 1.3,
  /** ขนาดปุ่มเทียบครึ่งความสูงราง — 1 = ชนขอบบน-ล่างพอดี */
  knobSize = 1,
  /** ความหนาปุ่มเทียบความหนาราง */
  knobThick = 0.66,
  /** หน้าปุ่มล้ำพ้นผิวหน้าราง เทียบความหนาราง */
  knobProud = 0.01,
  ...props
}) {
  const h = radius * 2
  const w = len * h
  /** รางหนาเกือบเท่าความสูง — สันข้างที่หนาคือสิ่งที่ทำให้เห็นว่ามันเป็นก้อนมีปริมาตร */
  const depth = radius * thickness

  /**
   * ราง — มนสุดทุกทาง ไม่ใช่แค่มุมในระนาบหน้า
   *
   * ของเดิม extrude แผ่นมุมมนออกไปตรง ๆ สันตามความหนาจึงเป็นเหลี่ยมคม พอวางปุ่มกลม
   * ไว้ข้างในแล้วรูปทรงไม่รับกัน — ปุ่มโค้งทุกด้าน รางโค้งด้านเดียว
   * มนสุดทั้งสองแกน: ปลายรางเป็นครึ่งวงกลมเต็ม และสันตามความหนาก็โค้งจนไม่มีเหลี่ยม
   * รูปทรงจึงรับกับปุ่มกลมที่อยู่ข้างใน
   */
  const track = useMemo(
    () =>
      bakeGradient(
        capsuleSlab(w, h, depth),
        TRACK[0],
        TRACK[1],
      ),
    [w, h, depth],
  )

  /**
   * ปุ่มโตเท่าความสูงราง — ขอบวงกลมชนขอบบน-ล่างของรางพอดี
   *
   * เล็กกว่านั้นจะเห็นแถบรางเป็นกรอบล้อมวงกลม ซึ่งไม่ตรงกับภาพอ้างอิง
   * วงกลมที่เต็มความสูงคือสิ่งที่ทำให้ปลายรางกับปุ่มเป็นวงเดียวกันเมื่อเลื่อนสุด
   */
  const kr = radius * knobSize
  /**
   * ปุ่มเป็นแผ่นกลมหนา **อยู่ในเนื้อราง** ไม่ใช่นูนพ้นหน้าออกมา
   *
   * ในภาพอ้างอิงเห็นสันข้างของปุ่มเป็นเสี้ยวเข้ม แปลว่าปุ่มมีความหนาและจมอยู่ในบล็อกใส
   * แต่ "หน้า" ของปุ่มต้องเสมอผิวหน้าราง ไม่ใช่จมลึกเข้าไป — มีกระจกฝ้าคั่นหน้าปุ่ม
   * เมื่อไรสีเขียวจะซีดจนไอคอนแทบหาย จึงยกหน้าปุ่มล้ำผิวรางนิดเดียว (0.01 ของความหนา)
   * พอให้ผิวรางสอบ depth ไม่ผ่านแล้วไม่ถูกวาดทับ แต่ตายังอ่านว่าเสมอกัน
   * และไม่มีวงแหวนขอบ — ในภาพอ้างอิงวงกลมเป็นแผ่นเรียบ ไม่มีกรอบ
   */
  const kd = depth * knobThick
  const knob = useMemo(() => {
    const g = new THREE.CylinderGeometry(kr, kr, kd, 32)
    g.rotateX(Math.PI / 2)
    // ไล่จากหน้าปุ่ม (+z) ไปด้านหลัง สันข้างจึงเข้มกว่าหน้าเสมอ ไม่ว่ากล้องอยู่มุมไหน
    return bakeGradient(g, KNOB[0], KNOB[1], [0, 0, -1])
  }, [kr, kd])

  /**
   * ไอคอน `</>` จากดีไซน์ซิสเทม (Figma 12761:158848)
   *
   * ถอดเป็นเส้นตรงห้าเส้นจากพิกัดจริงในไฟล์ SVG ขนาด 24x24 ไม่ได้กะเอาจากภาพ —
   * ปลายเส้นใน SVG เป็นหัวมน จึงปั้นด้วยแคปซูล ปลายมนของมันคือ round cap พอดี
   * เก็บพิกัดไว้ในหน่วย SVG ตรง ๆ แล้วค่อยแปลงตอนใช้ ถ้าวันหนึ่งไอคอนเปลี่ยน
   * ก็เทียบกับไฟล์ต้นทางได้ทันทีโดยไม่ต้องถอดเลขกลับ
   */
  const iconSize = kr * 2 * icon
  const bars = useMemo(() => {
    /** [x1, y1, x2, y2] ในระบบพิกัดของ SVG: จุดกำเนิดมุมบนซ้าย แกน y ชี้ลง */
    const SEGS = [
      [6.72, 9.114, 3.257, 12], // < ท่อนบน
      [3.257, 12, 6.72, 14.886], // < ท่อนล่าง
      [17.28, 9.114, 20.743, 12], // > ท่อนบน
      [20.743, 12, 17.28, 14.886], // > ท่อนล่าง
      [16.058, 4.134, 7.943, 19.866], // ขีดทแยง
    ]
    const k = iconSize / 24
    const t = 0.75 * k
    return SEGS.map(([x1, y1, x2, y2]) => {
      const dx = (x2 - x1) * k
      // แกน y ของ SVG ชี้ลง ของฉากชี้ขึ้น — กลับทิศตอนแปลง ไม่ใช่ตอนกรอกพิกัด
      const dy = -(y2 - y1) * k
      const seg = Math.hypot(dx, dy)
      return {
        geo: new THREE.CapsuleGeometry(t, Math.max(0.0001, seg - t * 2), 4, 12),
        // แกนยาวของแคปซูลอยู่ตามแกน y หมุนรอบ z ให้ไปทับทิศของเส้น
        rot: Math.atan2(-dx, dy),
        pos: [((x1 + x2) / 2 - 12) * k, (12 - (y1 + y2) / 2) * k],
      }
    })
  }, [iconSize])

  useDisposable([track, knob, ...bars.map((b) => b.geo)])

  /**
   * สุดทางแล้วปุ่มยื่นพ้นปลายรางออกมาเล็กน้อย ตามภาพอ้างอิง
   *
   * หยุดที่ศูนย์กลางปลายมนพอดี ปุ่มจะจมอยู่ในรางสนิทจนอ่านเป็นวงกลมที่วาดอยู่บนราง
   * เลยออกมานิดหนึ่งแล้วเห็นว่าเป็นชิ้นแยกที่เลื่อนได้จริง
   */
  const travel = w / 2 - radius + radius * 0.3
  const knobX = (Math.min(1, Math.max(0, pos)) * 2 - 1) * travel

  /**
   * เส้นขอบแบบ inverted hull — ก็อปทรงเดิม ขยายออกนิดหนึ่ง แล้ววาดเฉพาะหลังชิ้น
   *
   * วิธีนี้ได้เส้นที่ล้อมรอบเงา silhouette จริงของวัตถุทุกมุมกล้อง ต่างจากการวาดเส้นทับขอบ
   * ซึ่งต้องรู้ว่าขอบอยู่ตรงไหนก่อน ขยายเป็น "ระยะคงที่" ไม่ใช่สเกลเท่ากันทุกแกน —
   * ไม่งั้นด้านที่บางจะได้เส้นบางกว่าด้านที่หนามาก
   */
  // ปุ่มไม่ใส่ขอบ — เปลือกที่ครอบอยู่โผล่พ้นขอบวงกลมออกมาเป็นวงแหวนซ้อนอีกชั้น
  const hull = (dims) =>
    outline > 0 ? dims.map((v) => 1 + (outline * 2) / v) : null
  /**
   * เส้นขอบของรางกระจก — วาด "หลัง" กระจก และให้กระจกเขียน depth
   *
   * ถ้าวาดเปลือกก่อน มันจะกลายเป็นฉากหลังที่ transmission มองทะลุไปเห็น เนื้อรางเลยทึบ
   * เป็นสีเส้นขอบทั้งก้อน วาดทีหลัง (renderOrder) แล้วผิวหน้ากระจกที่เขียน depth ไว้จะบัง
   * เปลือกไว้หมดทุกที่ที่อยู่ในเงาของราง — เหลือโผล่แค่ขอบนอก ซึ่งคือเส้นที่ต้องการพอดี
   */
  const trackHull = hull([w, h, depth])
  /**
   * เส้นขอบของ "ทุกสัน" ไม่ใช่แค่เงา silhouette
   *
   * เปลือก inverted hull ให้เส้นรอบนอกอย่างเดียว แต่ของจริงเป็นก้อนหนา สันหน้ากับสันหลัง
   * ของการ extrude ต้องเห็นทั้งคู่ (มองผ่านกระจกเห็นขอบด้านไกลด้วย) EdgesGeometry
   * ดึงเฉพาะสันที่หักมุมเกินเกณฑ์ จึงได้วงหน้า-วงหลังโดยไม่ได้เส้นตารางของผิวโค้ง
   */
  const edges = useMemo(() => new THREE.EdgesGeometry(track, edgeAngle), [track, edgeAngle])

  return (
    <group {...props}>
      <mesh geometry={track}>
        {/**
         * รางเป็นกระจกจริง — transmission ไม่ใช่แค่ opacity
         *
         * opacity อย่างเดียวได้แค่ "จาง" ของหลังไม่บิดและขอบไม่มีน้ำหนัก อ่านเป็นสติกเกอร์โปร่ง
         * transmission ทำให้แสงลอดผ่านแล้วหักเห ของที่อยู่หลังรางจึงเบี้ยวตามความหนา
         *
         * ใช้ MeshTransmissionMaterial ของ drei ไม่ใช่ meshPhysicalMaterial เพราะต้องการ
         * "เบลอของหลัง" แบบกระจก ไม่ใช่กระจกฝ้า: ของ three คุมความเบลอด้วย roughness
         * ซึ่งทำให้ผิวด้านไปด้วย เงาสะท้อนหายหมด ตัวนี้แยกสองเรื่องออกจากกัน —
         * roughness 0 ผิวยังเงาเหมือนแก้วขัดมัน ส่วน anisotropicBlur เบลอเฉพาะภาพที่ลอดผ่าน
         */}
        <MeshTransmissionMaterial
          vertexColors
          transmission={glass}
          thickness={depth * 0.9}
          ior={1.4}
          roughness={0}
          anisotropicBlur={blur * 6}
          chromaticAberration={0.03}
          distortion={0}
          samples={6}
          resolution={512}
          attenuationDistance={depth * 9}
          attenuationColor={TRACK[0]}
          transparent
          opacity={opacity}
          depthWrite
        />
      </mesh>

      {trackHull && (
        <mesh
          geometry={track}
          scale={trackHull}
          renderOrder={2}
          /**
           * ซ่อนเส้นขอบตอนกระจกถ่ายภาพฉากหลังของตัวเอง
           *
           * MeshTransmissionMaterial เรนเดอร์ฉากลงบัฟเฟอร์ของตัวเองเพื่อเอามาเป็นภาพที่
           * มองทะลุ — เปลือกเส้นขอบที่ครอบรางอยู่ก็ติดไปด้วย เนื้อรางเลยกลายเป็นสีเส้นขอบ
           * ทั้งก้อน ปิด colorWrite เฉพาะรอบที่วาดลง render target (ไม่ใช่ลงจอ) มันจึงหาย
           * จากภาพที่กระจกมองเห็น แต่ยังวาดตามปกติในรอบจริง
           */
          onBeforeRender={(renderer, _scene, _camera, _geo, material) => {
            hideInBuffers(renderer, material)
          }}
        >
          <meshBasicMaterial
            userData={OUTLINE_TAG}
            color={OUTLINE}
            side={THREE.BackSide}
            transparent
            opacity={outlineAlpha}
          />
        </mesh>
      )}
      {outline > 0 && showEdges && (
        /**
         * สันของก้อนวาดทับกระจก (depthTest ปิด) — ตั้งใจให้เห็นขอบด้านไกลด้วย
         * ของจริงเป็นแก้วใส ขอบที่อยู่หลังเนื้อแก้วก็ต้องมองเห็น ไม่ใช่ถูกบัง
         */
        <lineSegments
          geometry={edges}
          renderOrder={3}
          onBeforeRender={(renderer, _s, _c, _g, material) => {
            hideInBuffers(renderer, material)
          }}
        >
          <lineBasicMaterial
            userData={OUTLINE_TAG}
            color={OUTLINE}
            depthTest={false}
            transparent
            opacity={outlineAlpha}
          />
        </lineSegments>
      )}
      {/* ปุ่มจมอยู่ในเนื้อราง หน้าปุ่มเกือบชิดหน้าราง */}
      <group position={[knobX, 0, depth / 2 - kd / 2 + depth * knobProud]}>
        <mesh geometry={knob}>
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>

        {/* ไอคอนบนหน้าปุ่ม — ยกพ้นหน้าปุ่มเล็กน้อยไม่ให้ z-fighting */}
        <group position={[0, 0, kd / 2 + kr * 0.02]}>
          {bars.map((b, i) => (
            <mesh key={i} geometry={b.geo} position={[b.pos[0], b.pos[1], 0]} rotation={[0, 0, b.rot]}>
              <meshBasicMaterial color={ICON} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}
