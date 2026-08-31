import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useControls, useCreateStore } from 'leva'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { addRim, clamp, damp, lerp } from './utils'
import { scrollState } from '../scroll'
import { introState } from '../intro'

/** 0..1 พร้อม ease-in-out — ใช้ทำ sub-timeline ในช่วง scroll ของฉาก 2 */
const seg = (v, a, b) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

const MODEL = '/mascot.glb'


// GLB ที่ได้มาไม่มีชื่อ node เลย — จำแนกชิ้นส่วนจาก "สี material" แทน
// (ตรวจแล้วว่าแต่ละบทบาทใช้สีไม่ซ้ำกัน)
const HEX = {
  hair: '232224',
  eye: '262424',
  skin: 'efb49b',
  neck: 'd2947a',
  /** สีเสื้อ — ตัวเสื้อกับแขนเสื้อใช้สีเดียวกัน แยกกันด้วยขนาด/ตำแหน่งเท่านั้น */
  shirt: 'ede2cf',
}


function hexOf(mat) {
  return mat?.color ? mat.color.getHexString() : ''
}

/**
 * สีของชิ้นส่วน "ตัวจริง"
 *
 * โหมดปั้น (ClayMode ใน App.jsx) สลับ material ทั้งฉากเป็นดินเทา แล้วเก็บของเดิมไว้ที่ userData
 * ถ้าอ่านจาก o.material ตรง ๆ ทุกชิ้นจะกลายเป็นสีเดียวกันหมด — โค้ดข้างล่างนี้ใช้สีจำแนกชิ้นส่วน
 * (GLB ไม่มีชื่อ node) แขนเลยหาชิ้นไม่เจอและไม่ถูกปั้นใหม่ ต้องมองข้ามสีดินเทาไปที่ของเดิมเสมอ
 */
function hexOfMesh(o) {
  return hexOf(o?.userData?.clayFrom ?? o?.material)
}

/**
 * แก้วกาแฟ to-go ทรงร้านกาแฟ — แก้วกระดาษเรียว ปลอกกันร้อน ฝาดำ โลโก้วงกลมเขียว
 *
 * ตั้งใจทำเป็นแก้วทั่วไป ไม่ใช่ของแบรนด์ใดแบรนด์หนึ่ง — โลโก้จริงเป็นเครื่องหมายการค้า
 * เอามาแปะไม่ได้ วงกลมเขียวเปล่า ๆ ก็อ่านออกว่าแก้วกาแฟแล้วที่ขนาดเท่านี้บนจอ
 */
const CUP = {
  paper: '#F7F4EF',
  sleeve: '#3F7C63',
  lid: '#2A2A2C',
  logo: '#0B6E4F',
}

function makeCoffeeCup() {
  const mat = (color, roughness = 0.75) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 })
  const cup = new THREE.Group()

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.108, 0.36, 20, 1, true), mat(CUP.paper))
  body.material.side = THREE.DoubleSide
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.108, 20), mat(CUP.paper))
  bottom.rotation.x = Math.PI / 2
  bottom.position.y = -0.18

  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.147, 0.126, 0.15, 20), mat(CUP.sleeve, 0.9))
  sleeve.position.y = -0.02

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.158, 0.152, 0.045, 20), mat(CUP.lid, 0.55))
  lid.position.y = 0.2
  const sip = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.145, 0.03, 20), mat(CUP.lid, 0.55))
  sip.position.y = 0.235

  // โลโก้: จานกลมแบนแปะหน้าปลอก เผื่อพ้นผิวนิดหนึ่งกัน z-fight
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.052, 20), mat(CUP.logo, 0.85))
  logo.position.set(0, -0.02, 0.138)
  logo.rotation.y = 0

  for (const m of [body, bottom, sleeve, lid, sip, logo]) {
    m.castShadow = true
    m.receiveShadow = true
    cup.add(m)
  }
  return cup
}

/**
 * ขา — GLB มีแค่ครึ่งบน สร้างต่อเองเป็นกล่องสไตล์เดียวกัน
 * พิกัด local ของโมเดล: เอวอยู่ y ≈ -2.24
 */
const JEANS = '#3E5C8F'
const CUFF = '#5A7BAD'
const BOOT = '#7A4E2E'
const SOLE = '#5E3B22'

/**
 * ความยาวขา วัดจาก comp: ขา = 46% ของความสูงทั้งตัว (หัว 23% ลำตัว 31%)
 * ของเดิมได้ 38% — ตัวเลยดูเตี้ยล่ำกว่าแบบ
 */
const LEG_LEN = 1.92

/**
 * มุมกางขาจากแนวดิ่ง — วัดจาก comp: ขาซ้าย 10.9° ขาขวา 8.7° (เฉลี่ย ~9.8°)
 * ของเดิม 0.09 rad = 5.2° แคบไปครึ่งหนึ่ง
 */
const LEG_SPLAY = 0.17

/**
 * ท่าตั้งต้นของข้อศอก/ข้อมือ — ใช้ทั้งเป็นค่าเริ่มของ slider และตอนปั้นท่อนแขน
 * (rebuildForearm ต้องวัดที่ท่าจริง ถ้าวัดที่ท่าพักจะได้ท่อนแขนยาวผิด)
 */
const POSE0 = { elbowX: 0, elbowZ: 0.35, wristX: 0 }

/**
 * ค่าเริ่มต้นของข้อต่อขาในท่า skate — อ่านคู่กับ prop legPose
 * ข้อเท้าคือตัวที่ทำให้ฝ่าเท้าแนบหน้าแผ่นบอร์ดหรือไม่ ต้องปรับคู่กับเข่าเสมอ
 */
const SKATE_LEG = {
  L: { hipX: -1.34, hipY: 0.3, hipZ: 0.16, knee: 1.95, ankle: 0.5 },
  R: { hipX: -0.98, hipY: -0.22, hipZ: -0.12, knee: 1.48, ankle: 0.36 },
}

/** ค่าเริ่มต้นของข้อต่อแขนในท่า skate — อ่านคู่กับ prop armPose */
const SKATE_ARM = {
  aimX: 1,
  aimY: 0.1,
  aimZ: -0.08,
  elbowX: 0,
  elbowY: 0,
  elbowZ: POSE0.elbowZ,
  wristX: 0,
  wristY: 0,
  wristZ: 0,
  mugShX: 0,
  mugShY: 0,
  mugShZ: -1.05,
  mugElX: 0,
  mugElY: 0,
  mugElZ: 0,
}

/**
 * จานสีสำหรับโหมด debug แยกชิ้นส่วนแขน — สร้างครั้งเดียวแล้วใช้ซ้ำ
 * เลือกสีที่ต่างกันชัดในภาพเดียว ไม่ใช่ไล่เฉด (ต้องแยกออกแม้ชิ้นเล็กและโดนแสงต่างกัน)
 */
const DEBUG_ARM_COLORS = [
  '#E5322D', '#1F7A1F', '#1E5AE0', '#F2B705', '#C81FC8',
  '#00A8A8', '#FF6A00', '#6A00CC', '#0F0F0F', '#FFFFFF',
]
const debugMatCache = []
function debugMat(i) {
  const k = i % DEBUG_ARM_COLORS.length
  debugMatCache[k] =
    debugMatCache[k] ??
    new THREE.MeshStandardMaterial({ color: DEBUG_ARM_COLORS[k], roughness: 1, metalness: 0 })
  return debugMatCache[k]
}

/** ย่อหัวให้สัดส่วนตรง comp — 1 = ขนาดที่มากับ GLB */
const HEAD_SCALE = 0.92

// ตัวช่วยชั่วคราวใน useFrame — ปั้นใหม่ทุกเฟรมคือขยะให้ GC เก็บ 60 ครั้ง/วินาที
const TMP_Q = new THREE.Quaternion()
const TMP_E = new THREE.Euler()
const INTRO_EYE = new THREE.Vector3()
const INTRO_FACE = new THREE.Vector3()
/** หันหัวซ้าย-ขวากี่เรเดียนตอนทำท่าสงสัย — 0.3 ≈ 17° พอให้เห็นว่าหันโดยที่ตายังอยู่ในเฟรม */
/** หันหัวได้ไกลสุดกี่เรเดียน — 0.6 ≈ 34° เกินกว่านี้คอบิดจนดูไม่ใช่คน */
const INTRO_LOOK_MAX = 0.6
/**
 * สปริงของคอ — คนหันหัวแล้ว "เลยนิดแล้วตกลงที่" ไม่ใช่ไหลเข้าหาเป้าแล้วหยุดสนิท
 * damp เข้าเป้าตรง ๆ (แบบเดิม) ได้ความนุ่มแต่ไม่มีน้ำหนัก อ่านเป็นหัวหุ่นที่ถูกหมุนด้วยมอเตอร์
 *
 * K = ความแข็ง (เร็วแค่ไหนถึงเป้า) ZETA < 1 = ยอมให้เลยเป้า 1 ครั้งเล็ก ๆ ก่อนตกลงที่
 */
const NECK_K = 26
const NECK_ZETA = 0.62
/** คอตามหัวช้ากว่านิดหน่อย — ใช้ค่าที่ตามหลังนี้ปั่นการก้ม/เอียง ให้ท่าไม่ขยับพร้อมกันทั้งก้อน */
const NECK_LAG = 0.14
/** หนีบ 0..1 แล้วลบหัวท้ายให้เรียบ — ใช้เป็น "เกต" ที่ไม่กระตุกตอนเปิด/ปิด */
const smooth01 = (t) => {
  const k = t < 0 ? 0 : t > 1 ? 1 : t
  return k * k * (3 - 2 * k)
}
/**
 * เพดานมุมก้ม/เงยของหัว (rad) — กันคางจมลงไปในคอเสื้อ
 *
 * หัวเป็นกล่องหมุนรอบจุดต่อคอ ไม่มีคอจริงยืดตาม พอหลายระบบก้มพร้อมกัน
 * (ก้มดูแก้วตอน sip 0.3 + เหลียวมองก้ม 0.14 + ตามเมาส์ 0.28) มุมรวมทะลุ 0.4+
 * ครึ่งหน้าก็มุดหายเข้าไปในเสื้อ — หนีบผลรวมสุดท้ายไว้ที่นี่ที่เดียว แหล่งไหนจะบวกมาเท่าไรก็ตาม
 */
const HEAD_PITCH_LIM = 0.3

const TMP_V = new THREE.Vector3()
const TMP_V2 = new THREE.Vector3()
const TMP_Q2 = new THREE.Quaternion()
// IK ท่ายกแก้วดื่ม (ฉาก 2)
// เล็งแขนชี้: ท่าตั้งต้นกับแกนแขนของท่านั้น
const AIM_DEF = new THREE.Quaternion()
const AIM_DIR = new THREE.Vector3()
// ท่าห้อยแขนหลังชี้ (tuck): ทิศห้อยจาก slider + แกนแขน normalize แล้ว
const TUCK_V = new THREE.Vector3()
const TUCK_AXIS = new THREE.Vector3()
// ท่าว่ายอากาศ: ทิศที่อยากให้แขนชี้ไป + แกนแขนของท่านั้น
const AIR_V = new THREE.Vector3()
const AIR_AXIS = new THREE.Vector3()
const IK_T = new THREE.Vector3()
const IK_D = new THREE.Vector3()
const IK_U = new THREE.Vector3()
const IK_P = new THREE.Vector3()
const IK_UP = new THREE.Vector3()
const IK_FW = new THREE.Vector3()
const IK_QS = new THREE.Quaternion()
const IK_QE = new THREE.Quaternion()
// ระนาบ/จุดตัด สำหรับโหมดลากวางแขน
const DRAG_PLANE = new THREE.Plane()
const DRAG_HIT = new THREE.Vector3()

/**
 * ประกายในตา (บีต eyes) — จุดขาวสองจุดแบบตาการ์ตูน จุดใหญ่บนซ้าย จุดเล็กล่างขวา
 *
 * แขวนไว้กับ "พ่อของลูกตา" ไม่ใช่ตัวลูกตา เพราะลูกตาถูกย่อ/ขยายตอนกระพริบและตอนบีต
 * ถ้าเป็นลูกของตา ประกายจะยืดหดตามจนบิดเบี้ยว
 *
 * geometry/material แชร์กันทุกจุด — ไม่ dispose เพราะเป็นแคชระดับโมดูลเหมือน bushGeo/shadowTex
 * material เป็น basic จึงไม่โดน addRim (มันข้ามตัวที่ไม่ใช่ standard) และติดธง keepColor
 * กัน ClayMode ทาเทาทับ
 */
const FORWARD = new THREE.Vector3(0, 0, 1)
const SPARK_GEO = new THREE.CircleGeometry(1, 16)
const SPARK_MAT = new THREE.MeshBasicMaterial({
  color: '#FFFFFF',
  transparent: true,
  depthWrite: false,
  toneMapped: false,
})
const SPARK_LAYOUT = [
  // [สัดส่วนกว้างของตา, เยื้องขวา, เยื้องขึ้น]
  [0.3, -0.26, 0.24],
  [0.15, 0.24, -0.2],
]
function addCatchlights(eye, worldNormal) {
  eye.geometry.computeBoundingBox()
  const size = eye.geometry.boundingBox.getSize(new THREE.Vector3())
  // ทิศ "ออกจากหน้า" ในสเปซของพ่อ — ใช้วางประกายให้ลอยพ้นผิวลูกตา และหันหน้าเข้าหาคนดู
  const n = worldNormal.clone()
  eye.parent.getWorldQuaternion(TMP_Q).invert()
  n.applyQuaternion(TMP_Q).normalize()

  const w = size.x * eye.scale.x
  const h = size.y * eye.scale.y
  const sparks = []
  for (const [r, dx, dy] of SPARK_LAYOUT) {
    const m = new THREE.Mesh(SPARK_GEO, SPARK_MAT)
    m.name = 'Catchlight'
    m.userData.keepColor = true
    m.userData.baseRadius = w * r
    m.position.copy(eye.position).addScaledVector(n, size.z * eye.scale.z * 0.5 + 0.012)
    // เยื้องในระนาบหน้า: ขวา = n × up, ขึ้น = แกน y ของสเปซพ่อ
    TMP_V.set(0, 1, 0)
    TMP_V2.crossVectors(TMP_V, n).normalize()
    m.position.addScaledVector(TMP_V2, w * dx).addScaledVector(TMP_V, h * dy)
    m.quaternion.setFromUnitVectors(FORWARD, n)
    m.scale.setScalar(0) // เริ่มมองไม่เห็น รอบีต eyes ดันขึ้นมา
    m.renderOrder = 2
    eye.parent.add(m)
    sparks.push(m)
  }
  eye.userData.sparks = sparks
}

/** สัดส่วนแบ่งท่อนขา — ต้นขา 52% ที่เหลือเป็นหน้าแข้ง (จุดหมุนเข่าอยู่รอยต่อ) */
const THIGH_LEN = LEG_LEN * 0.52
const SHIN_LEN = LEG_LEN - THIGH_LEN

function Legs({ rig }) {
  /**
   * ขาข้างละ 3 ข้อ: สะโพก -> เข่า -> ข้อเท้า
   *
   * เดิมขาเป็นท่อนตันท่อนเดียว หมุนได้แค่ทั้งขาจากสะโพก (แกน X แกนเดียว) งอเข่าไม่ได้เลย
   * แยกกล่องยีนส์เป็นต้นขา/หน้าแข้งที่ตำแหน่งเดิมเป๊ะ — ท่ายืนตรงจึงหน้าตาเหมือนเดิมทุกพิกเซล
   * แต่ตอนนี้มีจุดหมุนคั่นกลางให้งอได้
   */
  const leg = (side, key) => (
    <group
      key={side}
      position={[0.29 * side, -2.36, 0]}
      rotation={[0, 0.3 * side, LEG_SPLAY * side]}
      ref={(g) => {
        if (!rig || !g) return
        rig.current[`hip${key}`] = g
        // ท่าตั้งต้น — slider ทุกตัวบวกเพิ่มจากค่าพวกนี้ ไม่ได้เขียนทับ
        //
        // ??= สำคัญ: ref callback เป็นฟังก์ชันตัวใหม่ทุก render (leg() สร้างใหม่)
        // React จึงถอด/ใส่ ref ใหม่ทุกครั้งที่ re-render (ขยับ slider ตัวไหนก็ได้ในไฟล์นี้)
        // ถ้าจับค่าใหม่ทุกรอบ มันจะจับ "ตำแหน่งที่ useFrame ขยับไปแล้ว" มาเป็นค่าตั้งต้น
        // ค่า offset เลยทบไปเรื่อย ๆ ขาไหลออกจากตัวทีละนิดทุกครั้งที่แตะ slider
        g.userData.base = g.userData.base ?? g.position.clone()
        g.userData.baseRot = g.userData.baseRot ?? g.rotation.clone()
        g.userData.side = side
      }}
    >
      {/* ต้นขา — ขอบบนคาไว้ที่ +0.07 ใต้ชายเสื้อ ยืดลงล่างอย่างเดียว */}
      <mesh position={[0, 0.07 - THIGH_LEN / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, THIGH_LEN, 0.56]} />
        <meshStandardMaterial color={JEANS} roughness={1} metalness={0} />
      </mesh>

      <group
        position={[0, 0.07 - THIGH_LEN, 0]}
        ref={(g) => {
          if (rig && g) rig.current[`knee${key}`] = g
        }}
      >
        {/* หน้าแข้ง */}
        <mesh position={[0, -SHIN_LEN / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, SHIN_LEN, 0.56]} />
          <meshStandardMaterial color={JEANS} roughness={1} metalness={0} />
        </mesh>
        {/* ขอบพับ — แถบฟ้าคาดปลายขา กว้างกว่าขาเล็กน้อย */}
        <mesh position={[0, -SHIN_LEN - 0.07, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.6, 0.28, 0.66]} />
          <meshStandardMaterial color={CUFF} roughness={1} metalness={0} />
        </mesh>
        {/* บูท — หัวยื่นหน้า ส้นใต้ขอบพับ
            ไม่หมุนสวนขาแล้ว: เท้าเอียงไปตามท่อนขาจริง ๆ ขอบนอกจะจมพื้นบ้างก็ปล่อย
            (พื้นทรายมีรอยยุบรับอยู่ ดูเป็นน้ำหนักกดลงไปมากกว่าเท้าลอยราบ) */}
        <group
          position={[0, -SHIN_LEN - 0.4, 0]}
          ref={(g) => {
            if (rig && g) rig.current[`ankle${key}`] = g
          }}
        >
          <mesh position={[0, 0, 0.14]} castShadow receiveShadow>
            <boxGeometry args={[0.6, 0.34, 0.9]} />
            {/* หนังรองเท้ากึ่งเงา — ภาษาเดียวกับ roughness ตามวัสดุของตัว GLB */}
            <meshStandardMaterial color={BOOT} roughness={0.5} metalness={0} />
          </mesh>
          <mesh position={[0, -0.21, 0.14]} castShadow receiveShadow>
            <boxGeometry args={[0.64, 0.09, 0.94]} />
            <meshStandardMaterial color={SOLE} roughness={1} metalness={0} />
          </mesh>
        </group>
      </group>
    </group>
  )
  return (
    <group>
      {/* สะโพก — เชื่อมรอยต่อเอวกับขา */}
      <mesh position={[0, -2.36, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.24, 0.34, 0.6]} />
        <meshStandardMaterial color={JEANS} roughness={1} metalness={0} />
      </mesh>
      {leg(-1, 'L')}
      {leg(1, 'R')}
    </group>
  )
}

export function Mascot({
  position = [0, 0, 0],
  scale = 1,
  rotation = [0, 0, 0],
  /** true = หันหลังให้กล้อง (หัวยังหันตามเมาส์) */
  facingAway = false,
  /**
   * ทับค่าจาก slider เฉพาะ instance นี้ — ใช้กับตัวที่ต้องอยู่คนละท่ากับฉากหลัก
   * (เช่น mascot ที่แอบมองปลายไทม์ไลน์ ต้องเกาะขอบ+เอียงหัว ส่วนตัวในฉากยังชี้เหมือนเดิม)
   * slider ยังคุมตัวอื่นได้ตามปกติ ค่าที่ไม่ได้ override ก็ยังไหลตาม slider
   */
  poseOverride = null,
  followOverride = null,
  /**
   * true = ตัวนี้มีชุด slider ของตัวเอง ไม่ใช่ชุดเดียวกับฉากหลัก
   *
   * leva เก็บค่าตาม "ชื่อโฟลเดอร์" ในสโตร์กลาง — mascot สามตัวที่เรียก useControls('Rig')
   * เหมือนกันจึงอ่าน/เขียนค่าชุดเดียวกัน ขยับตัวหนึ่งแล้วอีกสองตัวขยับตาม
   * ตัวที่อยู่คนละ section สร้างสโตร์ของตัวเอง ค่าจึงแยกขาดจากกันจริง
   */
  isolated = false,
  /** ปิดลมหายใจ/เหลียวมอง — ใช้กับตัวที่อยู่ในกรอบเล็กและต้องนิ่ง เหลือแค่หัวตามเมาส์ */
  noIdle = false,
  /**
   * หัวหันตามเมาส์ "บนจอ" ไม่ใช่ตามแกนของฉากหลัก
   *
   * สูตรเดิมบวก x เข้ากับ yaw ตั้งต้นตรง ๆ ซึ่งถูกเฉพาะตอนตัวละครหันหน้าเข้ากล้องแบบฉาก hero
   * พอลำตัวถูกหมุนไปทางอื่น (การ์ด what-i-do หันข้าง) ทิศเลยเพี้ยนไปตามมุมของ hero
   * โหมดนี้คิดจากทิศ "หันเข้าหากล้องของแคนวาสตัวเอง" แล้วค่อยเบี่ยงตามเมาส์
   */
  screenFollow = false,
  /**
   * พื้นที่ที่ใช้คิดตำแหน่งเมาส์ — ref ของ DOM element (เช่นทั้ง section) ไม่ใช่แค่ canvas
   * ไม่ส่งมา = ใช้ pointer ของ canvas ตัวเอง (ตัวละครจะขยับเฉพาะตอนเมาส์อยู่บนภาพ)
   */
  followRef = null,
  /** true = แขนห้อยแนบตัวตั้งแต่เฟรมแรก ไม่ต้องชี้ (ท่าชี้ผูกกับไทม์ไลน์ของฉากหลัก) */
  armsDown = false,
  /**
   * ท่าว่ายอากาศแบบนักโดดร่ม — แขนกางเป็นตัว W ขาถ่างงอเข่า ทั้งตัวไหวตามลม
   *
   * เขียนทับท่าอื่นทั้งหมดที่จัดมาก่อนหน้าในเฟรมเดียวกัน ไม่ใช่บวกทับ: ท่าอื่นทุกท่าคิดบน
   * สมมติฐานว่ามีพื้นให้ยืน (แขนห้อยตามน้ำหนัก เท้าปักที่) ซึ่งไม่มีเลยตอนลอยอยู่กลางอากาศ
   */
  skydive = false,
  /** ท่ายืนเล่นสเก็ต — ย่อเข่าลึก บิดลำตัว กางแขนเป็น T (ดูภาพ ref 12739:335) */
  skate = false,
  /** สเกลทั้งแขน (ทั้งสองข้าง) — ใช้ตอนจูนสัดส่วนแขนกับลำตัว */
  armScale = 1,
  /** สเกลเฉพาะท่อนล่าง+มือ — แยกจาก armScale เพราะมือของ mascot ใหญ่กว่าสัดส่วนแขน */
  foreScale = 1,
  /**
   * มุมของข้อต่อแขนทั้งชุด (ใช้กับท่า skate) — ส่ง null เพื่อใช้ค่าเริ่มต้นของท่า
   *
   * สองแขนคุมคนละวิธีโดยธรรมชาติของริก: แขนที่มี armAxis ใช้ "เล็งทิศ" (aim เป็นเวกเตอร์
   * ทิศทาง ไม่ใช่องศา) ส่วนแขนถือแก้วไม่มี armAxis ที่ใช้ได้ จึงคิดต่อจาก quaternion
   * ท่าพักด้วยมุมออยเลอร์ ตัวเลขสองชุดนี้จึงเทียบกันตรง ๆ ไม่ได้
   */
  armPose = null,
  /** มุมข้อต่อขาในท่า skate (เรเดียน) — ส่ง null เพื่อใช้ค่าเริ่มต้นของท่า */
  legPose = null,
  /** ซ่อนแก้วกาแฟ — ฉากที่ตัวละครไม่ได้อยู่โหมดทำงาน (เช่นกำลังโต้คลื่น) ถือแก้วแล้วประหลาด */
  noMug = false,
}) {
  const { scene } = useGLTF(MODEL)
  const root = useRef()
  const headGroup = useRef()
  const eyes = useRef([])
  const rig = useRef({})
  const { gl } = useThree()
  // สโตร์ส่วนตัวของ instance นี้ (hook ต้องถูกเรียกทุกครั้ง จะใช้หรือไม่ค่อยว่ากัน)
  const ownStore = useCreateStore()
  const store = isolated ? ownStore : undefined

  /**
   * ตัวที่แยกอิสระต้องไม่กินไทม์ไลน์ของหน้า — intro/scroll เป็น singleton ระดับโมดูล
   * ตัวใน section อื่นจึงเล่นท่า intro (ชี้ crop tool) และท่าฉาก 2 (ยกแก้ว/นั่ง) ตามฉากหลักไปด้วย
   * โหมด isolated อ่านจากออบเจกต์นิ่ง ๆ ของตัวเอง: ไม่มี intro ไม่มีบีต scroll เหลือแค่ท่ายืน + หัวตามเมาส์
   */
  const still = useMemo(
    () => ({
      // b เป็น Proxy คืน 0 ทุกชื่อบีต — ไม่ต้องไล่ก๊อบรายชื่อบีตมาไว้สองที่ และไม่มีทางหลุดเป็น
      // undefined จนคำนวณต่อกลายเป็น NaN (ท่าจะพังทั้งตัวถ้าเผลอ)
      intro: {
        t: 0,
        playing: false,
        done: true,
        b: new Proxy({}, { get: () => 0 }),
        eyes: null,
        crop: null,
        close: null,
        title: null,
      },
      scroll: { raw: 0, b: new Proxy({}, { get: () => 0 }) },
    }),
    [],
  )
  const intro = isolated ? still.intro : introState
  const scroll = isolated ? still.scroll : scrollState

  // debugger: จูนท่าทางทุกข้อต่อสด ๆ
  // debugger: หัวหันตามเมาส์ — อยู่กลุ่มเดียวกับของกล้องใน App.jsx (leva รวม folder ชื่อเดียวกันให้)
  // idle: ลมหายใจ + โยกตัวเบา ๆ ให้ตัวละครดู "ยังมีชีวิต" ตอนไม่มีอะไรขยับ (ref: chaingpt.org)
  const idle = useControls('Idle', {
    idleAmp: { value: 2, min: 0, max: 3, step: 0.05, label: 'แรงขยับ' },
    idleBreath: { value: 0.8, min: 0.1, max: 1.6, step: 0.01, label: 'จังหวะหายใจ (Hz)' },
    idleGlance: { value: 2, min: 0, max: 3, step: 0.05, label: 'เหลียวมอง' },
  }, { collapsed: true, store })

  // เหลียวมองรอบ ๆ: จุดตั้งต้น (fx/fy) -> เป้า (tx/ty) เล่นเป็นรอบ ๆ ด้วย ease in-out
  // (damp ใช้ไม่ได้กับงานนี้ — มันออกตัวพรวดแล้วค่อยเบา ได้ครึ่งเดียวของ ease in-out)
  const glance = useRef({ fx: 0, fy: 0, tx: 0, ty: 0, x: 0, y: 0, start: 0, dur: 1, next: 2 })

  const folSliders = useControls('Follow Cursor', {
    headYaw: { value: 0.55, min: 0, max: 1.5, step: 0.01, label: 'หัว ซ้ายขวา' },
    headPitch: { value: 0.28, min: 0, max: 1.2, step: 0.01, label: 'หัว ก้มเงย' },
    headRoll: { value: 0.09, min: 0, max: 0.6, step: 0.01, label: 'หัว เอียง' },
    headEase: { value: 0.08, min: 0.005, max: 0.4, step: 0.005, label: 'หัว หน่วง' },
    // ท่าตั้งต้นของหัว — เอียงเฉียงไปทางเดียวกับที่แขนชี้ (เมาส์ขยับต่อจากท่านี้ ไม่ได้แทนที่)
    headBaseYaw: { value: -0.22, min: -1, max: 1, step: 0.01, label: 'หัว หันตั้งต้น' },
    headBaseRoll: { value: -0.14, min: -0.8, max: 0.8, step: 0.01, label: 'หัว เอียงตั้งต้น' },
    headBasePitch: { value: 0, min: -0.6, max: 0.6, step: 0.01, label: 'หัว ก้มตั้งต้น' },
  }, { store })

  const fol = useMemo(
    () => (followOverride ? { ...folSliders, ...followOverride } : folSliders),
    [folSliders, followOverride],
  )

  const [poseSliders, setPose] = useControls('Rig', () => ({
    // 1.55 rad = แขนทำมุม ~38° กับแนวนอน ตรงตาม comp (ของเดิม 2.35 = 81° เกือบตั้งฉาก)
    pointShoulderZ: { value: 1.55, min: 0, max: 3.1, step: 0.05 },
    pointShoulderX: { value: 0.4, min: -2.5, max: 1.5, step: 0.05 },
    // กวาดแขนไปข้างหน้า/ข้างหลัง — แกน X ใช้ไม่ได้กับท่านี้ (แขนชี้ไปตามแกน x พอดี
    // หมุนรอบแกนตัวเองก็แค่บิด ไม่ได้พาแขนไปไหน) ต้องหมุนรอบแกน Y ถึงจะกวาดไปหน้าจริง
    pointShoulderY: { value: 0.45, min: -1.2, max: 1.2, step: 0.05 },
    // ลดหัวไหล่ข้างที่ชี้ลงมา — ยกแขนแล้วไหล่มันดันขึ้นไปชิดคอ
    pointShoulderDrop: { value: 0.32, min: -0.3, max: 0.6, step: 0.01 },
    // ย้ายจุดหมุนไหล่ = ขยับ "ทั้งแขน" (บ่า/แขนเสื้อ/ท่อนแขน/มือ/นิ้ว) ไปทั้งก้อน ไม่ใช่หมุน
    // ต่างจาก pointArmFwd ที่เลื่อนเฉพาะท่อนล่าง — อันนี้ยกโคนไหล่ออกจากลำตัวด้วย
    pointShoulderOut: { value: 0, min: -0.3, max: 1, step: 0.01 },
    pointShoulderFwd: { value: 0, min: -0.6, max: 0.6, step: 0.01 },
    // ท่อนแขนที่ปั้นใหม่อิงมุมชุดนี้ — ขยับ slider แล้วมือจะเลื่อนออกจากปลายท่อนแขน
    pointElbowX: { value: POSE0.elbowX, min: -2.2, max: 2.2, step: 0.05 },
    pointElbowY: { value: 0, min: -2.2, max: 2.2, step: 0.05 },
    pointElbowZ: { value: POSE0.elbowZ, min: -2.2, max: 2.2, step: 0.05 },
    pointWristX: { value: POSE0.wristX, min: -2.2, max: 2.2, step: 0.05 },
    pointWristY: { value: 0.1, min: -2.2, max: 2.2, step: 0.05 },
    pointWristZ: { value: -0.5, min: -2.2, max: 2.2, step: 0.05 },
    // เลื่อน "ท่อนล่างทั้งก้อน" (ท่อนแขน + มือ + นิ้ว) ไปทางด้านหน้าของ mascot
    // ไม่ใช่การหมุน — ใช้จัดให้หน้าตัดโคนท่อนแขนบรรจบกับปลายแขนเสื้อพอดีทั้ง block
    pointArmFwd: { value: 0, min: -1, max: 1, step: 0.01 },
    // 0 = ท่าพักที่ cloneMirroredArm จัดให้ (แขนห้อยดิ่งแนบตัว)
    mugShoulderX: { value: 0, min: -2, max: 1, step: 0.05 },
    // บิดทั้งแขนรอบแกนตัวเอง — หมุนหน้ากำปั้น/แก้วให้หันเข้า-ออกจากตัว
    // อยู่กลางลำดับ Euler XYZ ของ three: X กดหน้า-หลังก่อน แล้ว Y ค่อยบิด แล้ว Z กางออกข้าง
    mugShoulderY: { value: 0, min: -3.1, max: 3.1, step: 0.05 },
    // ท่าพักใน GLB แขนกางออกข้าง — comp ปล่อยแขนแนบตัว ต้องกดลงด้วยแกน Z เหมือนแขนชี้
    mugShoulderZ: { value: 0, min: -3.1, max: 3.1, step: 0.05 },
    // ครบสามแกนเท่าแขนชี้ — ช่วงเท่ากันด้วย (เดิม X ถูกหนีบไว้ที่ 0.6 ตอนที่แขนนี้ยังเป็น
    // ของ GLB คนละชิ้น ตอนนี้เป็นแขนเดียวกันแล้ว ข้อจำกัดนั้นไม่มีเหตุผลเหลืออยู่)
    mugElbowX: { value: -0.35, min: -2.2, max: 2.2, step: 0.05 },
    mugElbowY: { value: 0.1, min: -2.2, max: 2.2, step: 0.05 },
    mugElbowZ: { value: -0.15, min: -2.2, max: 2.2, step: 0.05 },
    // เลื่อน "ทั้งแขน" ออกจากลำตัว โดยไม่หมุน — ย้ายจุดหมุนไหล่ ชิ้นที่เหลือ (บ่า/แขนเสื้อ/
    // ท่อนแขน/มือ/แก้ว) เป็นลูกของมันจึงตามไปทั้งก้อน คู่กับ pointShoulderOut ของแขนชี้
    // คูณด้วย outward ของแขนข้างนี้ — บวก = ออกห่างลำตัวเสมอ ไม่ต้องจำว่าซ้ายหรือขวา
    mugArmOut: { value: 0.09, min: -0.3, max: 1.2, step: 0.01, label: 'แขนแก้ว ออกห่างตัว' },
    // เลื่อนทั้งแขนขึ้น-ลง คู่กับ mugArmOut (บวก = ขึ้น) — คนละเรื่องกับ pointShoulderDrop
    // ของแขนชี้ที่นับเป็น "ลง" เพราะแขนนั้นจูนจากท่ายกลงมา ส่วนแขนนี้อ้างจากท่าห้อย
    mugArmUp: { value: -0.26, min: -0.6, max: 0.6, step: 0.01, label: 'แขนแก้ว ขึ้น/ลง' },
    // debug: ทาสีชิ้นส่วนแขนแยกกันคนละสี ดูว่าชิ้นไหนคือชิ้นไหน / ทับกันตรงไหน
    armDebug: { value: false, label: 'แยกสีชิ้นแขน' },
    // debug: ลากลูกบอลที่ปลายนิ้วเพื่อเล็งแขน — ปล่อยแล้วค่ามุมไหล่ถูกเขียนกลับลง slider ด้านบน
    armDrag: { value: false, label: 'ลากวางแขน' },
  }), { store })

  // อ่านทุกเฟรมใน useFrame — ผสมครั้งเดียวต่อการเปลี่ยนค่า ไม่ใช่ทุกเฟรม
  const pose = useMemo(
    () => (poseOverride ? { ...poseSliders, ...poseOverride } : poseSliders),
    [poseSliders, poseOverride],
  )

  /**
   * ท่า "หลังชี้เสร็จ" — แขนชี้ลดลงมาห้อยแนบตัว ใช้ทั้งตอนจบ intro และตอน scroll เข้าฉาก 2
   * (เป็น userData.tucked ตัวเดียวกันทั้งสองทาง ปั้นใหม่จาก slider ทุกเฟรม จูนได้สด ๆ)
   * ศอก/ข้อมือเป็น "ส่วนเพิ่ม" จากท่าชี้ ไล่ตามน้ำหนักการหุบแขน — น้ำหนัก 0 คือท่าชี้เดิมเป๊ะ
   */
  const tuk = useControls('Tuck (ท่าหลังชี้)', {
    // บังคับน้ำหนักหุบแขนตรง ๆ ไว้จูนโดยไม่ต้อง scroll/รอ intro — 0 = ปล่อยตามฉาก
    tuckPreview: { value: 0, min: 0, max: 1, step: 0.01, label: 'ดูท่า (บังคับหุบ)' },
    // ทิศห้อยของทั้งแขน: กางออกนอกตัว (บวก = ออก ไม่ต้องจำซ้ายขวา) / เหวี่ยงไปหน้า-หลัง
    tuckOut: { value: 0.24, min: -0.5, max: 1, step: 0.01, label: 'กางออกข้าง' },
    tuckFwd: { value: 0, min: -0.8, max: 0.8, step: 0.01, label: 'แขนไปหน้า/หลัง' },
    // บิดทั้งแขนรอบแกนห้อยของตัวเอง — หมุนหน้ากำปั้นเข้า-ออกจากตัว
    tuckTwist: { value: 0.95, min: -3.1, max: 3.1, step: 0.05, label: 'บิดรอบแกนแขน' },
    tuckElbowX: { value: 0, min: -2.2, max: 2.2, step: 0.05, label: 'ศอกเพิ่ม X' },
    tuckElbowY: { value: 0, min: -2.2, max: 2.2, step: 0.05, label: 'ศอกเพิ่ม Y' },
    tuckElbowZ: { value: 0, min: -2.2, max: 2.2, step: 0.05, label: 'ศอกเพิ่ม Z' },
    // เลื่อน "ทั้งแขน" (ย้ายจุดหมุนไหล่ ทุกชิ้นตามไปทั้งก้อน) — ไม่ใช่การหมุน
    // คู่กับ mugArmOut/mugArmUp ของแขนถือแก้ว บวก = ออกนอกตัว / ขึ้น
    tuckArmOut: { value: 0.22, min: -0.3, max: 1.2, step: 0.01, label: 'ทั้งแขน ออกห่างตัว' },
    tuckArmUp: { value: 0, min: -0.6, max: 0.6, step: 0.01, label: 'ทั้งแขน ขึ้น/ลง' },
    tuckArmFwd: { value: 0, min: -0.6, max: 0.6, step: 0.01, label: 'ทั้งแขน หน้า/หลัง' },
    tuckWristX: { value: 0, min: -2.2, max: 2.2, step: 0.05, label: 'ข้อมือเพิ่ม X' },
    tuckWristY: { value: 0, min: -2.2, max: 2.2, step: 0.05, label: 'ข้อมือเพิ่ม Y' },
    tuckWristZ: { value: 0, min: -2.2, max: 2.2, step: 0.05, label: 'ข้อมือเพิ่ม Z' },
  }, { collapsed: true, store })

  /**
   * ท่านั่งทำงานของฉาก 2 — นั่งสตูล พิมพ์ MacBook บนโต๊ะ (WorkDesk.jsx คือฉากรอบตัว)
   * ไล่ตามบีต focus ตัวเดียวกับหุบแขน: กล้องถึงที่ = นั่งเข้าที่พอดี
   * ทุกค่าเป็น "ส่วนเพิ่ม" จากท่ายืน คูณน้ำหนักนั่ง — น้ำหนัก 0 คือยืนเป๊ะ ฉาก 1 ไม่กระทบ
   */
  const sitBase = useControls('Sit (ฉาก 2)', {
    sitOn: { value: true, label: 'เปิดท่านั่ง' },
    sitPreview: { value: 0, min: 0, max: 1, step: 0.01, label: 'ดูท่า (บังคับนั่ง)' },
    sitDown: { value: 0.78, min: 0, max: 2, step: 0.01, label: 'ตัวลง (หน่วยโลก)' },
    sitBack: { value: 0.3, min: -1, max: 1.5, step: 0.01, label: 'ตัวถอยหลัง' },
    sitHip: { value: -1.35, min: -2, max: 2, step: 0.05, label: 'สะโพก งอ' },
    sitKnee: { value: 1.5, min: -2.2, max: 2.2, step: 0.05, label: 'เข่า งอ' },
    sitAnkle: { value: 0.1, min: -1.2, max: 1.2, step: 0.05, label: 'ข้อเท้า' },
    // แขนชี้กลายเป็นแขนพิมพ์งาน — ต่อจากท่าห้อย (tuck) อีกชั้น
    sitArmX: { value: -0.55, min: -2, max: 2, step: 0.05, label: 'แขน เหวี่ยงไปหน้า' },
    sitElbowX: { value: 0.7, min: -2.2, max: 2.2, step: 0.05, label: 'ศอก งอรับคีย์บอร์ด' },
  }, { collapsed: true, store })
  // poseOverride ทับชุดนั่งได้ด้วย (คีย์ sit* ไม่ชนกับ Rig) — instance ที่ต้องนั่งท่าอื่น
  // เช่นนั่งห้อยขาบนกำแพงในฉาก checker ส่งค่ามาเองโดยไม่แตะ slider ของฉากหลัก
  const sit = useMemo(
    () => (poseOverride ? { ...sitBase, ...poseOverride } : sitBase),
    [sitBase, poseOverride],
  )

  /**
   * ขา — ข้อละ 3 แกนเหมือนแขน + เลื่อนทั้งขาออกจากลำตัว
   * ค่าทุกตัว "บวกเพิ่ม" จากท่ายืนตั้งต้น (กางขา 0.17 rad, บิดปลายเท้าออก 0.3 rad) ไม่ใช่เขียนทับ
   * L = ข้างเดียวกับที่ถือแก้ว, R = ข้างที่ชี้
   */
  const legc = useControls('Legs', {
    hipLX: { value: 0, min: -1.4, max: 1.4, step: 0.05, label: 'ซ้าย สะโพก หน้า/หลัง' },
    hipLY: { value: 0, min: -1, max: 1, step: 0.05, label: 'ซ้าย สะโพก บิด' },
    hipLZ: { value: 0, min: -0.8, max: 0.8, step: 0.05, label: 'ซ้าย สะโพก กางออก' },
    kneeLX: { value: 0, min: -0.2, max: 2.2, step: 0.05, label: 'ซ้าย เข่า งอ' },
    ankleLX: { value: 0.1, min: -1, max: 1, step: 0.05, label: 'ซ้าย ข้อเท้า' },
    legLOut: { value: 0.09, min: -0.4, max: 0.8, step: 0.01, label: 'ซ้าย ทั้งขา ออกข้าง' },
    legLFwd: { value: 0, min: -0.8, max: 0.8, step: 0.01, label: 'ซ้าย ทั้งขา หน้า/หลัง' },
    hipRX: { value: 0, min: -1.4, max: 1.4, step: 0.05, label: 'ขวา สะโพก หน้า/หลัง' },
    hipRY: { value: 0.2, min: -1, max: 1, step: 0.05, label: 'ขวา สะโพก บิด' },
    hipRZ: { value: 0, min: -0.8, max: 0.8, step: 0.05, label: 'ขวา สะโพก กางออก' },
    kneeRX: { value: 0, min: -0.2, max: 2.2, step: 0.05, label: 'ขวา เข่า งอ' },
    ankleRX: { value: 0.15, min: -1, max: 1, step: 0.05, label: 'ขวา ข้อเท้า' },
    legROut: { value: 0.14, min: -0.4, max: 0.8, step: 0.01, label: 'ขวา ทั้งขา ออกข้าง' },
    legRFwd: { value: 0, min: -0.8, max: 0.8, step: 0.01, label: 'ขวา ทั้งขา หน้า/หลัง' },
  }, { collapsed: true, store })

  // ฉาก 2: ยกแก้วขึ้นดื่ม — ค่าปลายทางของแขนถือแก้ว (ค่าตั้งต้นคือ slider ชุด mug* ด้านบน)
  // แยก folder เพราะจูนคนละจังหวะกัน: ชุดบนคือท่ายืนนิ่ง ชุดนี้คือท่าปลายทางตอน scroll สุด
  const sipc = useControls('Sip (ฉาก 2)', {
    // เลื่อน "จุดที่แก้วต้องไปถึง" เทียบกับปาก (หน่วยโมเดล) — IK แก้มุมข้อต่อให้เอง
    sipAimFwd: { value: 0, min: -0.6, max: 0.6, step: 0.01, label: 'เป้า หน้า/หลัง' },
    sipAimUp: { value: 0, min: -0.6, max: 0.6, step: 0.01, label: 'เป้า ขึ้น/ลง' },
    sipAimSide: { value: 0, min: -0.6, max: 0.6, step: 0.01, label: 'เป้า ซ้าย/ขวา' },
    sipMugTilt: { value: 0.35, min: -1.6, max: 1.6, step: 0.05, label: 'แก้ว เอียง' },
    sipHeadPitch: { value: 0.3, min: -0.8, max: 0.8, step: 0.01, label: 'หัว ก้ม/เงย' },
    sipEase: { value: 0.12, min: 0.02, max: 0.5, step: 0.01, label: 'หน่วง' },
    // แขนชี้ค่อย ๆ หุบลงแนบตัวระหว่าง scroll เข้าฉาก 2 — 0 = ไม่หุบ (ชี้ค้างไว้เหมือนเดิม)
    sipTuck: { value: 1, min: 0, max: 1, step: 0.01, label: 'หุบแขนชี้ (0=ไม่หุบ)' },
    // 1 = แนบสนิทพอดีตอนบีต focus จบ (= กล้องถึงฉาก 2) ลดค่าลง = แนบเสร็จก่อนถึง
    sipTuckEnd: { value: 1, min: 0.1, max: 1, step: 0.01, label: 'หุบครบที่ (สัดส่วนบีต focus)' },
    sipPreview: { value: 0, min: 0, max: 1, step: 0.01, label: 'พรีวิว (ไม่ต้อง scroll)' },
  }, { collapsed: true, store })

  // clone เพื่อไม่ไปแก้ cache ของ useGLTF
  const model = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    // rig ได้ครั้งเดียวต่อโมเดล — ทุกอย่างข้างล่างนี้แก้ตัว model ถาวร (ย้าย parent, mirror geometry,
    // ต่อนิ้ว, อุดข้อต่อ) รันซ้ำแล้วพัง: นิ้วซ้อน ก้อนอุดโผล่สองลูก มือหลุดจากแขน
    // รันซ้ำเกิดได้จริงทั้ง StrictMode (dev mount 2 รอบ) และ Suspense ที่ remount ตอน GLB โหลดเสร็จ
    // — เก็บ rig ที่ปั้นแล้วไว้บน model แล้วคืนค่ากลับให้ ref แทนการปั้นใหม่
    if (model.userData.rig) {
      rig.current = model.userData.rig
      headGroup.current = model.userData.headGroup
      eyes.current = model.userData.eyes
      return
    }
    const parts = { hair: [], eye: [], head: null, sideburn: [] }
    // GLB export แยก material ให้ทุก mesh ถึงจะสีเดียวกัน (ผมดำ 6 ชิ้น = 6 material)
    // ยุบตามหน้าตาจริง — ลด state change ต่อเฟรม และ addRim ก็คอมไพล์ shader ครั้งเดียวต่อสี
    const matCache = new Map()
    const shared = (src) => {
      const key = `${src.type}|${src.color?.getHexString()}|${src.opacity}|${src.transparent}|${src.map?.uuid ?? ''}`
      let m = matCache.get(key)
      if (!m) {
        m = src.clone()
        // ความด้านตามวัสดุจริง ไม่ใช่ 1 เหมาเข่ง: ผมมันเงา ผิวคนกึ่งด้าน ผ้าเสื้อด้านสุด
        // — แสง key เดียวกันจะอ่านต่างกันตามเนื้อวัสดุ ตัวละครมีมิติขึ้นทั้งตัว
        const hex = hexOf(src)
        m.roughness =
          hex === HEX.hair ? 0.42 : hex === HEX.skin || hex === HEX.neck ? 0.6 : 0.88
        m.metalness = 0
        // rim เฉพาะ standard material: shader ใช้ normal/vViewPosition ซึ่ง MeshBasicMaterial ไม่มี
        // ถ้าฉีดใส่ shader จะ compile ไม่ผ่าน แล้ว mesh นั้นจะไม่ถูกวาดเลย (แต่ยังทอดเงาได้)
        // — ลูกตาเป็น MeshBasicMaterial ชิ้นเดียวในโมเดล จึงหายไปทั้งคู่
        if (m.isMeshStandardMaterial) {
          addRim(m, { color: '#FFF3DC', intensity: 0.5, power: 4.2 })
        }
        matCache.set(key, m)
      }
      return m
    }

    model.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      // GLB โหลด async หลัง RimLight traverse ฉากไปแล้ว — rim ถูกฉีดใน shared() ตอนปั้น material
      o.material = shared(o.material)

      // วัดใน local space ของโมเดล — world bbox โดน scale/position ของ root ปน ทำให้เกณฑ์ขนาดเพี้ยน
      o.geometry.computeBoundingBox()
      const s = o.geometry.boundingBox.getSize(new THREE.Vector3())

      const hex = hexOfMesh(o)
      if (hex === HEX.eye) parts.eye.push(o)
      else if (hex === HEX.hair) {
        // ชิ้นเล็กที่อยู่ข้างหัว = จอน, ก้อนใหญ่ด้านบน = ผม
        if (s.x < 0.4) parts.sideburn.push(o)
        else parts.hair.push(o)
      } else if (hex === HEX.skin) {
        // หัว = ชิ้นผิวที่ปริมาตรใหญ่สุด (ชิ้นอื่นคือแขน/มือ เล็กกว่ามาก)
        const vol = s.x * s.y * s.z
        if (!parts.head || vol > parts.head.userData.vol) {
          o.userData.vol = vol
          parts.head = o
        }
      }
    })

    // ย้ายชิ้นส่วนหัวทั้งหมดเข้ากลุ่มเดียว โดยคงตำแหน่งโลกไว้ (attach ไม่ใช่ add)
    const g = new THREE.Group()
    g.name = 'HeadGroup'
    model.add(g)
    const headParts = [parts.head, ...parts.hair, ...parts.sideburn, ...parts.eye].filter(Boolean)
    for (const p of headParts) g.attach(p)

    // หัวใน GLB ใหญ่กว่า comp อยู่ ~9% (วัดจากยอดผมถึงคอ เทียบความสูงทั้งตัว: 25.6% vs 23.4%)
    // ย่อทั้งกลุ่มโดยตรึงจุดต่อคอไว้ที่เดิม ไม่งั้นหัวจะลอยหลุดจากบ่า
    const NECK_Y = -0.63
    g.scale.setScalar(HEAD_SCALE)
    g.position.y = NECK_Y * (1 - HEAD_SCALE)

    // ประกายในตา — ทำครั้งเดียวตอนตั้งฉาก ค่อยขยายเข้ามาตอนบีต eyes (ดู useFrame ท้ายไฟล์)
    // GLB ฝังลูกตาไว้ "ใน" กล่องหัว (ลึกกว่าผิวหน้า ~0.03) เลยไม่โผล่จากมุมไหนเลย —
    // เดิมไม่เคยเห็นเพราะ mascot หันหลังให้ตลอด ดันออกมาตามแนวตั้งฉากของหน้า
    if (parts.head && parts.eye.length) {
      model.updateMatrixWorld(true) // attach ด้านบนเพิ่งย้าย parent — matrixWorld ยังเป็นค่าเก่า
      parts.head.geometry.computeBoundingBox()
      const headC = parts.head.localToWorld(
        parts.head.geometry.boundingBox.getCenter(new THREE.Vector3()),
      )
      for (const e of parts.eye) {
        const w = e.getWorldPosition(new THREE.Vector3())
        const n = w.clone().sub(headC).setY(0).normalize()
        e.position.copy(e.parent.worldToLocal(w.addScaledVector(n, 0.05)))
        e.castShadow = false // ตายื่นพ้นผิวหน้านิดเดียว ถ้าทอดเงาจะกลายเป็นรอยด่างข้างตา
        addCatchlights(e, n)
      }
    }

    // GLB มีผมแค่บล็อกบน — เติมแผ่นผมคลุมท้ายทอยลงถึงต้นคอ
    // คำนวณใน local space ของหัว แล้วใส่เป็นลูกของหัวเอง จะได้ติดตำแหน่ง/หมุนตามหัวเสมอ
    if (parts.head) {
      const bb = parts.head.geometry.boundingBox
      const hs = bb.getSize(new THREE.Vector3())
      const hc = bb.getCenter(new THREE.Vector3())
      // material ตัวจริง ไม่ใช่ดินเทาของโหมดปั้น ไม่งั้นแผ่นนี้จะค้างเป็นสีเทาถาวร
      const hairMat = parts.hair[0]
        ? (parts.hair[0].userData.clayFrom ?? parts.hair[0].material)
        : new THREE.MeshStandardMaterial({ color: '#282729', roughness: 1, metalness: 0 })
      // ก้อนเดียวจบ — ลึกพอให้ท้ายทอยทุย แต่ไม่แยกชั้น block ให้อ่านเป็นขั้นบันได
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(hs.x * 1.04, hs.y * 1.02, hs.z * 0.62),
        hairMat,
      )
      back.position.set(hc.x, hc.y + hs.y * 0.02, hc.z - hs.z * 0.56)
      back.castShadow = back.receiveShadow = true
      back.name = 'BackHair'
      parts.head.add(back)
    }

    // ---- จัดท่าตาม ref: แขนขวาชี้ขึ้น แขนซ้ายงอถือแก้ว ----
    model.updateMatrixWorld(true)
    const arms = { L: [], R: [] }
    const wv = new THREE.Vector3()
    model.traverse((o) => {
      if (!o.isMesh) return
      // ข้ามชิ้นที่อยู่ในหัว (ถูกย้ายเข้า HeadGroup แล้ว)
      let p = o.parent
      let inHead = false
      while (p) {
        if (p === g) inHead = true
        p = p.parent
      }
      if (inHead) return
      o.getWorldPosition(wv)
      const lp = model.worldToLocal(wv.clone())
      // แขน = ชิ้นที่อยู่พ้นข้างลำตัว (ลำตัวกว้าง ~1.42 ครึ่ง 0.71)
      if (Math.abs(lp.x) > 0.55) (lp.x > 0 ? arms.R : arms.L).push({ o, lp })
    })

    // rig แขน: ไหล่ (ทั้งแขน) -> ศอก (ท่อนล่าง: ปลายแขน+มือ) แบ่งที่ก้นแขนเสื้อ
    const toLocal = model.matrixWorld.clone().invert()
    const localBox = (meshes) => {
      const bb = new THREE.Box3()
      for (const o of meshes) {
        o.geometry.computeBoundingBox()
        bb.union(o.geometry.boundingBox.clone().applyMatrix4(toLocal.clone().multiply(o.matrixWorld)))
      }
      return bb
    }

    /**
     * สลับซ้าย-ขวาของ "มือ" อย่างเดียว
     *
     * ท่าพักของ GLB นิ้วโป้งอยู่ด้านในถูกแล้ว แต่ท่ายกแขนหมุนไหล่ 135° ในระนาบ XY
     * ซึ่งพาฝั่งในไปอยู่ฝั่งนอก นิ้วโป้งเลยหันออกนอกตัว สะท้อนมือกลับตั้งแต่ท่าพัก
     * พอยกแขนแล้วนิ้วโป้งจึงมาอยู่ด้านใน
     *
     * ใช้สะท้อน (mirror) ไม่ใช่หมุนรอบแกนแขน เพราะการหมุนจะพลิกฝ่ามือไปด้วย
     * ทำที่ geometry ตั้งแต่ตอนสร้าง rig จึงไม่กวนค่ามุมท่าทางใด ๆ ทีหลัง
     */
    const mirrorHandGeometry = (list) => {
      // มือเป็นก้อน mesh ที่อยู่ต่ำสุดและเกาะกลุ่มกัน — ตัดที่ "ช่องว่าง" แรกของความสูง
      // (แบ่งด้วยเกณฑ์ความสูงคงที่ไม่ได้ เดี๋ยวจะกินท่อนแขนช่วงข้อมือติดมาด้วย)
      const ys = list.map(({ lp }) => lp.y).sort((a, b) => a - b)
      let split = ys[0] + 0.06
      for (let i = 1; i < ys.length; i++) {
        if (ys[i] - ys[i - 1] > 0.05) {
          split = (ys[i] + ys[i - 1]) / 2
          break
        }
      }
      const hands = list.filter(({ lp }) => lp.y <= split).map(({ o }) => o)
      if (!hands.length) return

      const bb = localBox(hands)
      const cx = (bb.min.x + bb.max.x) / 2
      const mirror = new THREE.Matrix4()
        .makeTranslation(cx, 0, 0)
        .multiply(new THREE.Matrix4().makeScale(-1, 1, 1))
        .multiply(new THREE.Matrix4().makeTranslation(-cx, 0, 0))

      for (const o of hands) {
        model.attach(o) // ให้ local space ตรงกับ model ก่อน แล้ว bake ลง geometry
        o.updateMatrix()
        const geo = o.geometry.clone() // clone: scene.clone() แชร์ geometry กับ cache ของ useGLTF
        geo.applyMatrix4(o.matrix)
        geo.applyMatrix4(mirror)
        // สะท้อนแล้วหน้าสามเหลี่ยมกลับด้าน ต้องกลับลำดับ index ไม่งั้นโดน backface culling หายทั้งชิ้น
        const ix = geo.index
        if (ix) {
          const a = ix.array
          for (let i = 0; i < a.length; i += 3) {
            const t = a[i]
            a[i] = a[i + 2]
            a[i + 2] = t
          }
          ix.needsUpdate = true
        }
        geo.computeVertexNormals()
        o.geometry = geo
        o.position.set(0, 0, 0)
        o.quaternion.identity()
        o.scale.set(1, 1, 1)
        o.updateMatrix()
      }
      model.updateMatrixWorld(true)
    }

    /**
     * ย้ายจุดหมุนของข้อไปไว้ "กลางท่อนแขน" (แกน x/z) โดยท่าพักไม่ขยับ
     *
     * mkArm วางจุดหมุนไว้ที่ x = z = 0 ของสเปซแขน ซึ่งไม่ใช่แกนกลางของเนื้อแขนเลย
     * (ปลายแขนจริงอยู่ที่ x 0.21, z 0.22) พอพับข้อ ท่อนล่างเลยกวาดเป็นวงรอบจุดที่อยู่นอกตัวมัน
     * หน้าตัดสองท่อนถ่างออกจากกันเป็นรอยผ่าเห็นทะลุฉากหลัง — ยิ่งพับมาก ยิ่งถ่าง
     *
     * ย้ายจุดหมุนมาที่แกนกลางแล้วชดเชยตำแหน่งลูกกลับเท่าเดิม รูปทรงท่าพักคงเดิมเป๊ะ
     * แต่การพับกลายเป็น "บิดรอบแกนตัวเอง" รอยต่อจึงตันโดยไม่ต้องเอาอะไรไปอุด
     */
    const centerPivot = (joint) => {
      const inv = joint.parent.matrixWorld.clone().invert()
      const bb = new THREE.Box3()
      joint.traverse((o) => {
        if (!o.isMesh) return
        o.geometry.computeBoundingBox()
        bb.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)))
      })
      if (bb.isEmpty()) return
      const delta = new THREE.Vector3(
        joint.position.x - (bb.min.x + bb.max.x) / 2,
        0,
        joint.position.z - (bb.min.z + bb.max.z) / 2,
      )
      joint.position.sub(delta)
      // ลูกยังไม่ถูกหมุน (rotation ของข้อเป็น identity ตอนตั้งริก) บวกกลับตรง ๆ ได้เลย
      joint.children.forEach((c) => c.position.add(delta))
      joint.updateMatrixWorld(true)
    }

    const mkArm = (list) => {
      if (!list.length) return null
      const top = Math.max(...list.map(({ lp }) => lp.y))
      const bottom = Math.min(...list.map(({ lp }) => lp.y))
      const sleeve = list.find(({ o }) => hexOfMesh(o) === 'ede2cf')
      const elbowY = sleeve ? sleeve.lp.y - 0.3 : top - 0.75

      // ขอบเขตจริงของแขน (bbox) — ใช้ origin ของ mesh ไม่ได้ มันไม่ได้อยู่กลางชิ้น
      const bb = new THREE.Box3()
      for (const { o } of list) {
        o.geometry.computeBoundingBox()
        bb.union(o.geometry.boundingBox.clone().applyMatrix4(toLocal.clone().multiply(o.matrixWorld)))
      }
      // จุดหมุนไหล่ต้องอยู่ที่ "หัวไหล่" คือขอบในบนสุดของแขน ซึ่งซ้อนอยู่ในลำตัว
      // ถ้าหมุนรอบกึ่งกลางแขน (ของเดิม) ทั้งแขนจะเหวี่ยงออกจากตัวจนหลุดเป็นช่องว่าง
      const outward = bb.max.x > 0 ? 1 : -1
      const innerX = outward > 0 ? bb.min.x : bb.max.x

      const shoulder = new THREE.Group()
      shoulder.position.set(innerX + outward * 0.06, bb.max.y - 0.14, 0)
      model.add(shoulder)
      const elbow = new THREE.Group()
      elbow.position.set(0, elbowY - shoulder.position.y, 0)
      shoulder.add(elbow)
      model.updateMatrixWorld(true)

      // ข้อมือ: แยกกลุ่มมือ (ช่วงล่างของปลายแขน) ไว้หมุนแก้มุมงอที่ bake มาใน GLB
      const wristY = bottom + 0.42 * (elbowY - bottom)

      const wrist = new THREE.Group()
      wrist.position.set(0, wristY - elbowY, 0)
      elbow.add(wrist)
      model.updateMatrixWorld(true)

      list.forEach(({ o, lp }) => {
        if (lp.y < wristY) wrist.attach(o)
        else if (lp.y < elbowY) elbow.attach(o)
        else shoulder.attach(o)
      })
      shoulder.userData.len = top + 0.12 - bottom
      // เก็บความสูงตั้งต้นไว้ ให้ slider เลื่อนไหล่ขึ้นลงทีหลังได้ (mesh เป็นลูก จะขยับตามทั้งแขน)
      shoulder.userData.baseY = shoulder.position.y
      // ตำแหน่งตั้งต้นอีกสองแกน — slider ขยับ "ทั้งแขนรวมไหล่" ออกจากลำตัว/ไปด้านหน้า
      shoulder.userData.baseX = shoulder.position.x
      shoulder.userData.baseZ = shoulder.position.z
      elbow.userData.len = elbowY - bottom
      shoulder.userData.outward = outward
      return { shoulder, elbow, wrist, outward }
    }




    /**
     * ปั้นหัวไหล่ใหม่สำหรับแขนที่ยกชี้
     *
     * GLB มีชิ้นแขนเสื้อก้อนเดียวยาว 0.78 หน่วย ทำหน้าที่ทั้ง "บ่า" และ "แขนเสื้อ" รวมกัน
     * ท่าพักห้อยลงข้างตัวก็ดูปกติ แต่พอยกแขนชี้ (ไหล่หมุน ~89°) ทั้งก้อนพลิกไปนอนแนวนอน
     * กลายเป็นแผ่นครีมยื่นออกข้างยาวเท่าต้นแขน — ไหล่บวมผิดสัดส่วน แถมบ่าเปิดเป็นช่องโหว่
     *
     * แยกเป็นสองชิ้นตามหน้าที่จริง:
     *   บ่า (yoke)  — ครึ่งบนของแขนเสื้อ เกาะกับลำตัว อยู่นิ่งทุกท่า ปิดข้อต่อไว้
     *   แขนเสื้อ    — ท่อนสั้นกว่า เกาะกับต้นแขน หมุนตามแขนไป
     * สัดส่วนถอดจากชิ้นเดิมทั้งหมด (กว้าง/ลึกเท่าเดิม แบ่งความยาว) จึงเข้ากับลำตัวเป๊ะเหมือนอีกข้าง
     */
    /**
     * bevel = ลบเหลี่ยมบ่ากับแขนเสื้อให้โค้งเข้าหากัน (0 = กล่องเหลี่ยมแบบเดิม)
     * ใช้กับแขนถือแก้วอย่างเดียว — แขนชี้ถูกจูนสัดส่วนไว้แล้ว ไปเปลี่ยนทรงจะรื้อของที่เข้าที่
     */
    /** กลับด้านสามเหลี่ยมของ geometry (คนละใบกับของเดิมเสมอ — ของเดิมถูกใช้อยู่อีกแขนหนึ่ง) */
    const flippedGeometry = (geo) => {
      // clone เฉย ๆ — เรียก toNonIndexed() กับชิ้นที่ไม่มี index อยู่แล้ว three จะเตือนเปล่า ๆ
      const g = geo.clone()
      if (g.index) {
        const a = g.index.array
        for (let i = 0; i < a.length; i += 3) {
          const t = a[i]
          a[i] = a[i + 2]
          a[i + 2] = t
        }
        g.index.needsUpdate = true
      } else {
        for (const at of Object.values(g.attributes)) {
          const n = at.itemSize
          const arr = at.array
          for (let i = 0; i < arr.length; i += n * 3) {
            for (let k = 0; k < n; k++) {
              const t = arr[i + k]
              arr[i + k] = arr[i + 2 * n + k]
              arr[i + 2 * n + k] = t
            }
          }
          at.needsUpdate = true
        }
      }
      return g
    }

    /**
     * แขนอีกข้าง = แขนเดิมที่ถูกสะท้อนกระจก ไม่ได้ปั้นขึ้นใหม่
     *
     * นี่คือวิธีเดียวที่ทำให้สองแขน "เป็นแขนคู่เดียวกัน" ได้จริง. ก่อนหน้านี้แต่ละข้างถูกปั้น
     * จาก mesh ของตัวเองใน GLB ซึ่งไม่ได้ mirror กันเป๊ะ — F ต่างกัน 1.6% และจุดแบ่งกลุ่ม
     * ไหล่/ศอก/ข้อมือ (เกณฑ์ความสูงใน mkArm) ตกคนละที่ ก้อนที่ข้างหนึ่งนับเป็นแขน อีกข้าง
     * นับเป็นมือ จำนวนชิ้นกับสัดส่วนจึงไม่มีทางตรงกัน แก้ทีละจุดเท่าไรก็ยังต่าง
     *
     * สะท้อนแบบ "อบลงในทุก node" ไม่ใช่ scale.x = -1 ที่ราก:
     *   ทุกกิ่ง  local ใหม่ = M · local เดิม · M   (M = สะท้อนแกน x)  → ยังเป็นการหมุนล้วน
     *   ทุก mesh geometry สะท้อนด้วย M แล้วกลับลำดับสามเหลี่ยม (ไม่งั้นโดน backface culling)
     *
     * ที่ไม่ใช้ scale ลบเพราะ determinant ติดลบทำให้ทุกอย่างที่เป็น "การหมุน" เพี้ยนหมด —
     * setFromUnitVectors, getWorldQuaternion, การเล็งแขนให้ห้อยลง คิดผิดทั้งชุด (ลองมาแล้ว
     * ได้แขนกางออกข้างพร้อมแก้วลอย) เมื่ออบลง node ทุกอันเป็น quaternion ปกติ
     * เครื่องมือเดิมทั้งหมดจึงใช้ได้เหมือนแขนอีกข้างเป๊ะ
     */
    const cloneMirroredArm = (src) => {
      if (!src) return null
      const shoulder = src.shoulder.clone(true)
      // clone(true) รักษาลำดับลูกไว้ จับคู่ node เดิม -> node ใหม่ด้วยลำดับ traverse ได้เลย
      const from = []
      src.shoulder.traverse((o) => from.push(o))
      const to = []
      shoulder.traverse((o) => to.push(o))
      const map = new Map(from.map((o, i) => [o, to[i]]))
      const M = new THREE.Matrix4().makeScale(-1, 1, 1)
      to.forEach((o, i) => {
        if (o.isMesh) {
          const g = flippedGeometry(o.geometry)
          g.applyMatrix4(M)
          o.geometry = g
          /**
           * เอา material "ตัวจริง" ของต้นฉบับมา ไม่ใช่ตัวที่มันถืออยู่ตอนนี้
           *
           * ถ้าโหมดปั้นทาเทาไปก่อนแล้ว ตัวที่ถืออยู่คือดินเทา และสำเนาจะถือดินเทาไปด้วย
           * โดยไม่มี clayFrom ของตัวเอง — ClayMode เห็นว่า "เป็นดินอยู่แล้ว" เลยข้าม
           * ไม่เคยจดของเดิมไว้ พอปิดโหมดปั้น แขนข้างนี้จึงค้างเป็นสีเทาอยู่ข้างเดียว
           */
          o.material = from[i].userData?.clayFrom ?? from[i].material
        }
        /**
         * ล้าง userData ของสำเนาทิ้งก่อนเสมอ
         *
         * Object3D.copy ก็อป userData ด้วย JSON.parse(JSON.stringify(...)) — ของที่ไม่ใช่
         * ข้อมูลล้วนจึงกลายเป็น object เปล่า: Vector3/Quaternion เสียชนิด และที่ร้ายกว่านั้นคือ
         * `clayFrom` ซึ่งเป็น "material ตัวจริง" กลายเป็น object ธรรมดา พอโหมดปั้นเอาไปคืนค่า
         * ทั้งฉากก็ล้มทันที (material.customProgramCacheKey is not a function)
         * สิ่งที่สำเนาต้องใช้จริง ๆ ตั้งเองด้านล่างทีละตัว
         */
        o.userData = {}
        // local ใหม่ = M · local เดิม · M — เท่ากับกลับเครื่องหมาย x ของตำแหน่ง
        // และกลับเครื่องหมาย y,z ของ quaternion
        o.position.x = -o.position.x
        o.quaternion.set(o.quaternion.x, -o.quaternion.y, -o.quaternion.z, o.quaternion.w)
      })

      const outward = -(src.outward ?? 1)
      const ud = src.shoulder.userData
      shoulder.userData = {
        outward,
        yoke: ud.yoke ? map.get(ud.yoke) : undefined,
        cuff: ud.cuff ? { mesh: map.get(ud.cuff.mesh), len: ud.cuff.len } : undefined,
        armAxis: ud.armAxis ? new THREE.Vector3(-ud.armAxis.x, ud.armAxis.y, ud.armAxis.z) : undefined,
        len: ud.len,
      }
      shoulder.userData.baseX = shoulder.position.x
      shoulder.userData.baseY = shoulder.position.y
      shoulder.userData.baseZ = shoulder.position.z
      model.add(shoulder)

      const elbow = map.get(src.elbow)
      const wrist = map.get(src.wrist)
      /**
       * เหยียดศอกให้ท่อนล่างต่อจากต้นแขนเป็นเส้นเดียว
       *
       * identity ใช้ไม่ได้: มุมศอกของ GLB ที่ท่าพักไม่ใช่ "ตรง" มันคือมุมของท่ากางแขนออกข้าง
       * ตั้ง identity แล้วท่อนล่างเลยพุ่งไปคนละทางกับต้นแขน (แขนพับเข้าลำตัว)
       *
       * หมุนจากของจริงแทน: วัดทิศ "จุดหมุนศอก -> กลางเนื้อของท่อนล่าง" แล้วหมุนให้ทิศนั้น
       * ไปทับแกนต้นแขน (armAxis ซึ่งอยู่ในสเปซของไหล่ = สเปซแม่ของศอกพอดี)
       */
      elbow.quaternion.identity()
      elbow.updateMatrixWorld(true)
      const lower = new THREE.Box3()
      elbow.traverse((o) => {
        if (!o.isMesh || !o.visible) return
        o.geometry.computeBoundingBox()
        lower.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))
      })
      const axisLocal = shoulder.userData.armAxis
      if (!lower.isEmpty() && axisLocal) {
        const c = elbow.parent.worldToLocal(lower.getCenter(new THREE.Vector3()))
        const dir = c.sub(elbow.position)
        if (dir.lengthSq() > 1e-8) {
          elbow.quaternion.setFromUnitVectors(
            dir.normalize(),
            axisLocal.clone().normalize(),
          )
        }
      }
      elbow.userData.rest = elbow.quaternion.clone()
      wrist.userData.rest = wrist.quaternion.clone()
      model.updateMatrixWorld(true)
      return { shoulder, elbow, wrist, outward }
    }

    /**
     * ชิ้นส่วนที่มองเห็นของแขนหนึ่งข้าง เรียง "จากบ่าออกไปหาปลายมือ"
     *
     * เรียงตามระยะบนแกนแขนจริง ไม่ใช่ตามลำดับใน scene graph — ลำดับใน graph เป็นของ GLB
     * (ชิ้นที่ปั้นใหม่ไปต่อท้าย กลุ่มมือมาก่อนแขนเสื้อ) สองแขนจึงเรียงไม่เหมือนกัน
     * พอเอาไปทาสีทีละ index สีของสองข้างเลื่อนกันคนละชุด เทียบกันไม่ได้เลย ซึ่งเป็น
     * เหตุผลเดียวที่โหมดแยกสีมีอยู่
     *
     * `skip` = กิ่งที่ไม่นับ (แก้วที่ถืออยู่ ไม่ใช่ชิ้นของแขน)
     */
    const armParts = (arm, skip) => {
      if (!arm) return []
      const axis = arm.shoulder.userData.armAxis
      const inv = arm.shoulder.matrixWorld.clone().invert()
      const under = (o, root) => {
        for (let p = o; p; p = p.parent) if (p === root) return true
        return false
      }
      const list = []
      arm.shoulder.traverse((o) => {
        if (!o.isMesh || !o.visible) return
        if (skip && under(o, skip)) return
        o.geometry.computeBoundingBox()
        const c = o.geometry.boundingBox
          .getCenter(new THREE.Vector3())
          .applyMatrix4(inv.clone().multiply(o.matrixWorld))
        list.push({ o, at: axis ? c.dot(axis) : c.length() })
      })
      return list.sort((a, b) => a.at - b.at).map((m) => m.o)
    }

    /**
     * รวมชิ้นที่อยู่ในกระดูกท่อนเดียวกันและใช้ material เดียวกัน ให้เป็น mesh เดียว
     *
     * แก้อาการ "ขอบซ้อนขอบ" ที่ต้นทาง: กล่องหลายใบแทงทะลุกันจะมีผิวด้านในซ้อนกันเสมอ
     * เห็นเป็นเส้นรอยต่อและมีโอกาส z-fighting ตรงที่หน้าเกือบขนานกัน พอรวมเป็นก้อนเดียว
     * รอยต่อภายในหายไปจริง ๆ ไม่ใช่แค่ซ่อน — และได้ draw call ลดลงเป็นของแถม
     *
     * รวมได้เฉพาะภายใน "ท่อนกระดูกเดียวกัน" (ไหล่ / ศอก / ข้อมือ) เพราะข้อต่อยังต้องหมุนได้
     * ชิ้นที่ข้าม bone ไปรวมกันจะขยับตามข้อไม่ได้อีก
     *
     * ของเดิมไม่ทิ้ง แค่ซ่อนไว้ — โหมดแยกสีชิ้นแขนยังต้องใช้ (ดู useEffect ของ armDebug)
     */
    const mergeArm = (arm) => {
      if (!arm) return []
      const merged = []
      const segments = [
        [arm.shoulder, [arm.elbow]],
        [arm.elbow, [arm.wrist]],
        [arm.wrist, []],
      ]
      for (const [node, stops] of segments) {
        node.updateWorldMatrix(true, false)
        const inv = node.matrixWorld.clone().invert()
        /** @type {Map<string, {material: THREE.Material, cast: boolean, receive: boolean, geos: THREE.BufferGeometry[], parts: THREE.Mesh[]}>} */
        const buckets = new Map()
        node.traverse((o) => {
          if (!o.isMesh || !o.visible || o.userData.noMerge || o.userData.mergedFrom) return
          for (let p = o; p; p = p.parent) if (stops.includes(p)) return
          const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`
          const b = buckets.get(key) ?? {
            material: o.material,
            cast: o.castShadow,
            receive: o.receiveShadow,
            geos: [],
            parts: [],
          }
          o.updateWorldMatrix(true, false)
          const g = o.geometry.clone()
          g.applyMatrix4(inv.clone().multiply(o.matrixWorld))
          b.geos.push(g)
          b.parts.push(o)
          buckets.set(key, b)
        })
        for (const b of buckets.values()) {
          // ชิ้นเดียวไม่ต้องรวม — เปลืองหน่วยความจำเปล่า ๆ และไม่มีรอยต่อให้แก้อยู่แล้ว
          if (b.parts.length < 2) {
            b.geos.forEach((g) => g.dispose())
            continue
          }
          /**
           * ตัด attribute ที่ไม่ครบทุกชิ้นออกก่อนรวม
           *
           * mergeGeometries คืน null ทันทีถ้าชุด attribute ไม่ตรงกันเป๊ะ — และมันไม่ตรงจริง ๆ:
           * ชิ้นจาก GLB มีแค่ position,normal ส่วนกล่องที่เราปั้นเองมี uv ติดมาด้วย
           * ตัว material ของแขนไม่มี texture สักใบ (เช็คแล้ว: map/normalMap/... ว่างหมด)
           * uv จึงไม่มีใครใช้ ตัดทิ้งได้ ไม่ต้องยัด uv ศูนย์เข้าไปให้เปลืองหน่วยความจำ
           */
          const common = b.geos.reduce(
            (keep, g) => keep.filter((k) => g.attributes[k]),
            Object.keys(b.geos[0].attributes),
          )
          b.geos.forEach((g) => {
            Object.keys(g.attributes).forEach((k) => {
              if (!common.includes(k)) g.deleteAttribute(k)
            })
          })
          /**
           * index ต้อง "มีทุกชิ้น หรือไม่มีเลย" — mergeGeometries ปฏิเสธถ้าปนกัน
           * ชิ้นจาก GLB มี index ส่วนบางชิ้นที่ปั้นเองไม่มี พอปนกันมันเลยล้มที่ index 2
           * คลี่ให้ไม่มี index ทั้งหมดง่ายและปลอดภัยที่สุด (จำนวน vertex เพิ่ม แต่ชิ้นพวกนี้
           * หลักร้อย ไม่ใช่หลักแสน) — ทำเฉพาะตอนปนกันจริง ไม่งั้นเก็บ index เดิมไว้
           */
          const mixedIndex = b.geos.some((g) => !g.index)
          const ready = mixedIndex
            ? b.geos.map((g) => (g.index ? g.toNonIndexed() : g))
            : b.geos
          const geo = mergeGeometries(ready, false)
          ready.forEach((g, i) => {
            if (g !== b.geos[i]) g.dispose()
          })
          b.geos.forEach((g) => g.dispose())
          if (!geo) continue
          const mesh = new THREE.Mesh(geo, b.material)
          mesh.castShadow = b.cast
          mesh.receiveShadow = b.receive
          mesh.userData.mergedFrom = b.parts
          node.add(mesh)
          b.parts.forEach((o) => {
            o.visible = false
            o.userData.mergedAway = true
          })
          merged.push(mesh)
        }
      }
      return merged
    }

    /** กล่องที่ลบเหลี่ยมได้ — bevel = 0 คืนกล่องเหลี่ยมปกติ (รัศมีคิดจากด้านสั้นสุดของชิ้นนั้น) */
    const rounded = (w, h, d, bevel) => {
      const r = Math.min(w, h, d) * Math.min(bevel, 0.49)
      return r > 1e-4
        ? new RoundedBoxGeometry(w, h, d, 3, r)
        : new THREE.BoxGeometry(w, h, d)
    }


    const rebuildShoulder = (arm, { bevel = 0 } = {}) => {
      if (!arm) return
      const inv = arm.shoulder.matrixWorld.clone().invert()
      let sleeve = null
      arm.shoulder.traverse((o) => {
        if (o.isMesh && hexOfMesh(o) === 'ede2cf') sleeve = o
      })
      if (!sleeve) return
      sleeve.geometry.computeBoundingBox()
      const bb = sleeve.geometry.boundingBox
        .clone()
        .applyMatrix4(inv.clone().multiply(sleeve.matrixWorld))
      // ต้นแขนจริง (เนื้อสีผิว) — ใช้เป็นหน้าตัดอ้างอิงของแขนเสื้อ
      const arm3 = new THREE.Box3()
      arm.shoulder.traverse((o) => {
        if (!o.isMesh || hexOfMesh(o) !== 'efb49b') return
        for (let p = o.parent; p; p = p.parent) if (p === arm.elbow) return
        o.geometry.computeBoundingBox()
        arm3.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)))
      })
      if (arm3.isEmpty()) return

      const w = bb.max.x - bb.min.x
      const len = bb.max.y - bb.min.y
      // บ่าลึกเท่าลำตัว ไม่ใช่เท่าชิ้นเดิม — ชิ้นเดิมลึก 0.74 กว่าลำตัว (0.66) และกว่าต้นแขน (0.44) มาก
      // ท่าห้อยมองจากหน้ายังดูเป็นเสื้อหลวม แต่พอยกแขนเรามองมันจากด้านข้าง ความลึกกลายเป็นความกว้าง
      // ไหล่เลยพองเป็นแผ่น — ตัดให้พอดีตัวทั้งบ่าและแขนเสื้อ
      const torso = new THREE.Box3()
      model.traverse((o) => {
        if (!o.isMesh || hexOfMesh(o) !== 'ede2cf') return
        for (let p = o.parent; p; p = p.parent) if (p.userData?.baseY !== undefined) return
        o.geometry.computeBoundingBox()
        torso.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)))
      })
      const d = torso.isEmpty() ? bb.max.z - bb.min.z : torso.max.z - torso.min.z
      sleeve.visible = false

      const srcMat = sleeve.userData.clayFrom ?? sleeve.material
      const piece = (sw, sh, sd) => {
        const m = new THREE.Mesh(rounded(sw, sh, sd, bevel), srcMat)
        m.castShadow = true
        m.receiveShadow = true
        return m
      }

      // บ่า: อยู่ในกลุ่มไหล่ (หมุนไปกับแขนทั้งก้อน) — รูปทรง/ตำแหน่งจริงถูกจัดอีกทีใน rebuildForearm
      // ตอนที่รู้แกนแขนแล้ว
      //
      // เดิมแขวนไว้กับลำตัวแล้วให้หมุนตามแขนแค่ 45% ผลคือแกนของบ่าไปคนละทางกับแกนแขน
      // ปลายล่างของบ่าเลยยื่นเป็นแผ่นออกมาจากใต้แขน ไม่มีอะไรมาต่อ ("ไหล่ไม่สอดคล้องกับแขน")
      // ท่านี้เป็นท่านิ่ง ไม่มี animation ที่ข้อไหล่ จึงให้บ่าเป็นชิ้นหนึ่งของแขนไปเลย
      // ปลายด้านในของมันจมอยู่ในลำตัวอยู่แล้ว ข้อต่อจึงยังตัน
      const yoke = piece(w, len * 0.5, d)
      arm.shoulder.add(yoke)
      arm.shoulder.userData.yoke = yoke

      // แขนเสื้อ: หุ้มต้นแขนพอดี (หนากว่าเนื้อแขน 14%) วางบนแกนของต้นแขน ไม่ใช่แกนของชิ้นเดิม
      // ยาวแค่ 45% ของต้นแขน — เสื้อแขนสั้นตาม comp ไม่ใช่คลุมทั้งท่อนแบบชิ้นเดิม
      const cuffH = (arm3.max.y - arm3.min.y) * 0.45
      const cuff = piece(
        (arm3.max.x - arm3.min.x) * 1.14,
        cuffH,
        (arm3.max.z - arm3.min.z) * 1.14,
      )
      cuff.position.set(
        (arm3.min.x + arm3.max.x) / 2,
        bb.max.y - len * 0.35 - cuffH / 2,
        (arm3.min.z + arm3.max.z) / 2,
      )
      arm.shoulder.add(cuff)
      // rebuildForearm ต้องรู้ว่าแขนเสื้อยาวแค่ไหน เพื่อหาว่าท่อนแขนต้องเริ่มตรงไหน
      arm.shoulder.userData.cuff = { mesh: cuff, len: cuffH }
    }

    /**
     * หันกำปั้นให้ชี้ไปตามแกนแขน
     *
     * GLB bake มุมข้อมือบิดไว้ ~40° กำปั้นเลยชี้คนละทางกับท่อนแขน มองแล้วเหมือนมือหักข้อ
     * จัดด้วย centroid ของกำปั้นไม่ได้ (นิ้วโป้ง/สันมือถ่วงไปคนละทาง เคยลองแล้วมือบิดทั้งก้อน)
     * ใช้ "แกนที่นิ้วยื่นออก" ที่ได้จากตอนต่อนิ้ว (ฝ่ามือ -> แถวข้อนิ้ว) ซึ่งเป็นแกนจริงของมือ
     */
    /**
     * แกนที่มือชี้ (ในสเปซข้อมือ) — จากศูนย์กลางฝ่ามือไปหาแถวข้อนิ้ว
     * แยกออกมาเป็นฟังก์ชันเพราะเดิมคำนวณอยู่ในโค้ดต่อนิ้วชี้ ซึ่งรันเฉพาะแขนขวา
     * แขนถือแก้วเลยไม่เคยมีค่านี้ มือจึงไม่เคยถูกหันให้ตรงแกนแขน
     */
    const handDir = (wrist) => {
      wrist.updateMatrixWorld(true)
      const toWrist = wrist.matrixWorld.clone().invert()
      const list = []
      wrist.traverse((o) => {
        if (!o.isMesh) return
        o.geometry.computeBoundingBox()
        const bb = o.geometry.boundingBox.clone().applyMatrix4(toWrist.clone().multiply(o.matrixWorld))
        const size = bb.getSize(new THREE.Vector3())
        list.push({ o, bb, size, c: bb.getCenter(new THREE.Vector3()), vol: size.x * size.y * size.z })
      })
      if (!list.length) return null
      const maxVol = Math.max(...list.map((p) => p.vol))
      const small = list.filter((p) => p.vol < maxVol * 0.15)
      // ข้อนิ้ว 4 ท่อนขนาดเท่ากันเป๊ะ นิ้วโป้งขนาดต่างออกไป — จับกลุ่มจากปริมาตรที่ซ้ำกันมากสุด
      const knuckles = small.filter(
        (p) => small.filter((q) => Math.abs(q.vol - p.vol) < p.vol * 0.15).length >= 3,
      )
      const thumb = small.find((p) => !knuckles.includes(p))
      if (!knuckles.length || !thumb) return null
      const palm = list.filter((p) => !small.includes(p)).sort((a, b) => a.vol - b.vol)[0]
      if (!palm) return null
      const row = knuckles
        .reduce((v, p) => v.add(p.c), new THREE.Vector3())
        .divideScalar(knuckles.length)
      return { list, small, knuckles, thumb, palm, dir: row.clone().sub(palm.c).normalize() }
    }

    // pose0 เหมือน rebuildForearm — แขนถือแก้วต้องคิดที่ท่าพักของมันเอง ไม่ใช่มุมศอกของแขนชี้
    const alignHandToArm = (arm, { pose0 = true } = {}) => {
      const dirLocal = arm.wrist.userData.pointDir
      if (!dirLocal) return
      if (pose0) arm.elbow.rotation.set(POSE0.elbowX, 0, POSE0.elbowZ)
      else arm.elbow.quaternion.copy(arm.elbow.userData.rest ?? new THREE.Quaternion())
      arm.wrist.quaternion.identity()
      model.updateMatrixWorld(true)

      // แกนแขน = จุดหมุนไหล่ (origin ของสเปซไหล่) -> จุดหมุนข้อมือ
      const wristInShoulder = arm.wrist.position
        .clone()
        .applyQuaternion(arm.elbow.quaternion)
        .add(arm.elbow.position)
      if (wristInShoulder.lengthSq() < 1e-8) return
      // ย้ายมาคิดในสเปซของศอก เพราะ quaternion ของข้อมือทำงานในสเปซนั้น
      const axisElbow = wristInShoulder
        .normalize()
        .applyQuaternion(arm.elbow.quaternion.clone().invert())

      arm.wrist.userData.rest = new THREE.Quaternion().setFromUnitVectors(
        dirLocal.clone().normalize(),
        axisElbow,
      )
      arm.wrist.quaternion.copy(arm.wrist.userData.rest)
      model.updateMatrixWorld(true)
    }

    /**
     * จัดวางท่อนล่างของแขนใหม่ทั้งช่วง — แขนเสื้อ / ท่อนแขน / มือ ให้เรียงต่อกันบนแกนเดียว
     *
     * วัดตำแหน่งจริงตามแกนแขน (t = ระยะจากจุดหมุนไหล่) ของทุกชิ้นแล้วได้แบบนี้:
     *   แขนเสื้อ  t -0.02 .. 0.68
     *   กำปั้น    t  0.43 .. 1.49
     * สองก้อนนี้ "ซ้อนทับกัน" ตั้งแต่ 0.43 ถึง 0.68 — กำปั้นงอกออกจากไหล่โดยไม่มีท่อนแขนคั่น
     * นี่คือทั้งอาการ "ไหล่กับแขนทับซ้อน" และ "มือไม่ต่อแขน" มันคือเรื่องเดียวกัน
     *
     * เลยเลิกยัดท่อนแขนลงในช่องว่างที่ไม่มีอยู่จริง เปลี่ยนเป็นวางผังใหม่ทั้งแถบ:
     * ย่นแขนเสื้อ ผลักกลุ่มมือออกไปให้พ้น แล้วปั้นท่อนแขนคั่นตรงกลาง
     * สัดส่วนอิงขนาดกำปั้น (F) ทั้งหมด — โมเดลเปลี่ยนขนาดเมื่อไรก็ยังได้สัดส่วนเดิม
     */
    // pose0: แขนชี้วางผังที่มุมศอกชุด POSE0 / แขนถือแก้ววางผังที่ท่าพักของมันเอง (ห้อยดิ่ง)
    // keepLower: เก็บ 'ท่อนล่าง' ไว้ให้ slider pointArmFwd เลื่อน — ใช้กับแขนชี้เท่านั้น
    // yokeIn: บ่าจมย้อนแกนแขนเข้าลำตัวกี่เท่าของ F
    //   แขนยก -> ทิศย้อนแกนพุ่งเข้าตัว จมได้เยอะ / แขนห้อย -> พุ่งขึ้นฟ้า จมเยอะแล้วโผล่เป็นก้อนข้างคอ
    // สัดส่วนตามแกนแขน (หน่วย = F) รับเข้ามาได้ทีละข้าง แต่ค่าตั้งต้นคือ ARM ตัวเดียวกันทั้งคู่
    // — ที่แยกเป็นพารามิเตอร์ไว้เพราะเคยต้องจูนทีละข้างตอนหาค่า ไม่ใช่เพราะสองข้างควรต่างกัน
    const rebuildForearm = (
      arm,
      {
        pose0 = true,
        keepLower = true,
        yokeIn = 0.5,
        bevel = 0,
        cuffLenF = 0.45,
        armLenF = 0.58,
        thickF = 0.78,
        cuffThickF = 0.95,
        yokeCrossF = 1.05,
      } = {},
    ) => {
      if (!arm) return
      // ต้องคิดที่ท่าจริง — มุมศอก/ข้อมือมีผลกับตำแหน่งมือ
      if (pose0) arm.elbow.rotation.set(POSE0.elbowX, 0, POSE0.elbowZ)
      else arm.elbow.quaternion.copy(arm.elbow.userData.rest ?? new THREE.Quaternion())
      arm.wrist.quaternion.copy(arm.wrist.userData.rest ?? new THREE.Quaternion())
      model.updateMatrixWorld(true)

      const cuff = arm.shoulder.userData.cuff
      let stub = null
      arm.shoulder.children.forEach((o) => {
        if (o.isMesh && o.visible && hexOfMesh(o) === 'efb49b') stub = o
      })
      if (!cuff || !stub) return

      const inv = arm.shoulder.matrixWorld.clone().invert()
      // แกนแขน = ไหล่ (origin ของสเปซนี้) -> "ศูนย์กลางฝ่ามือ"
      //
      // เคยใช้จุดหมุนข้อมือเป็นปลายแกน แล้ววนเป็นงูกินหาง: เราจะเลื่อนกลุ่มมือให้เข้าแกน
      // แต่พอเลื่อน จุดหมุนก็ขยับ แกนก็ขยับตาม ไม่มีวันบรรจบ
      // ฝ่ามือคือ "เนื้อที่ตาเห็น" และเป็นสิ่งที่ต้องอยู่กลางแขน จึงยึดมันเป็นปลายแกนแทน
      // (จุดหมุนข้อมือใน GLB ไม่ได้อยู่กลางเนื้อมือ เยื้องออกไป 0.28 หน่วย — ต้นเหตุที่กำปั้นเหลื่อม)
      let palm = null
      arm.wrist.traverse((o) => {
        if (!o.isMesh || !o.visible) return
        o.geometry.computeBoundingBox()
        const bb = o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld))
        const sz = bb.getSize(new THREE.Vector3())
        const vol = sz.x * sz.y * sz.z
        if (!palm || vol > palm.vol) palm = { o, vol, c: bb.getCenter(new THREE.Vector3()) }
      })
      if (!palm || palm.c.lengthSq() < 1e-8) return
      const axis = palm.c.clone().normalize()
      // เก็บไว้ให้โหมดลากวางแขนใช้ — แกนนี้อยู่ในสเปซของไหล่ ไม่ขึ้นกับมุมที่ไหล่หมุนอยู่
      arm.shoulder.userData.armAxis = axis.clone()

      /** ช่วงที่ mesh กินตามแกนแขน — กาง 8 มุมของ "กล่อง geometry เอง" แล้วค่อยแปลงตาม matrix
       *  (กาง bbox ที่แปลงแล้วจะได้กล่องพองตามแนวทแยง วัดผิดไปเยอะ) */
      const spanOf = (o) => {
        o.geometry.computeBoundingBox()
        const bb = o.geometry.boundingBox
        const m = inv.clone().multiply(o.matrixWorld)
        let lo = Infinity
        let hi = -Infinity
        for (const x of [bb.min.x, bb.max.x])
          for (const y of [bb.min.y, bb.max.y])
            for (const z of [bb.min.z, bb.max.z]) {
              const t = TMP_V.set(x, y, z).applyMatrix4(m).dot(axis)
              lo = Math.min(lo, t)
              hi = Math.max(hi, t)
            }
        return [lo, hi]
      }

      // แกนตั้งฉากสองแกน ไว้วัดความอ้วนของชิ้นส่วนเทียบกับแกนแขน
      const u = new THREE.Vector3(0, 1, 0).cross(axis)
      if (u.lengthSq() < 1e-6) u.set(1, 0, 0)
      u.normalize()
      const v = axis.clone().cross(u).normalize()
      /** ความกว้างเฉลี่ยของ mesh ในระนาบตั้งฉากกับแกนแขน */
      const girthOf = (o) => {
        o.geometry.computeBoundingBox()
        const bb = o.geometry.boundingBox
        const m = inv.clone().multiply(o.matrixWorld)
        const c = bb.getCenter(new THREE.Vector3()).applyMatrix4(m)
        let uw = 0
        let vw = 0
        for (const x of [bb.min.x, bb.max.x])
          for (const y of [bb.min.y, bb.max.y])
            for (const z of [bb.min.z, bb.max.z]) {
              const d = TMP_V.set(x, y, z).applyMatrix4(m).sub(c)
              uw = Math.max(uw, Math.abs(d.dot(u)))
              vw = Math.max(vw, Math.abs(d.dot(v)))
            }
        return uw + vw
      }

      // ขนาดกำปั้น F = ความกว้างของชิ้นใหญ่สุดในกลุ่มมือ (ฝ่ามือ)
      // ต้องวัดในสเปซไหล่ ไม่ใช่จาก geometry ตรง ๆ — mesh ใน GLB มี scale ของตัวเองติดมาด้วย
      // (วัดจาก geometry ได้ 0.37 ทั้งที่ของจริงกว้าง 0.68 ผังทั้งแถบเลยหดครึ่งหนึ่ง)
      let handLo = Infinity
      arm.wrist.traverse((o) => {
        if (o.isMesh && o.visible) handLo = Math.min(handLo, spanOf(o)[0])
      })
      if (!isFinite(handLo)) return
      const F = girthOf(palm.o)

      // ผังใหม่บนแกนแขน (หน่วยเป็นเท่าของ F) — ต่อกันโดยเผื่อซ้อน 0.05 ทุกรอยต่อ
      const cuffLen = F * cuffLenF
      const armLen = F * armLenF
      // เริ่มแขนเสื้อให้พ้นก้อนบ่าออกมา — ของเดิม 0.24F ยังจมอยู่ในบ่า มุมกล่องโผล่ทะลุออกมาข้างคอ
      const cuffStart = F * 0.36
      const cuffEnd = cuffStart + cuffLen
      const armEnd = cuffEnd + armLen
      // ไล่เรียวจากบ่าลงไปหามือ — บ่าต้องเป็นส่วนที่หนาที่สุดของแขน
      // ของเดิมบ่ากว้าง 0.52 แต่ท่อนแขน 0.59 ไหล่เลยดูเล็กกว่าแขนที่งอกออกมา
      const thick = F * thickF
      const cuffThick = F * cuffThickF

      // 1) ย่อ+หันแขนเสื้อให้วางตามแกน (เดิมเป็นกล่องตั้งฉากกับสเปซไหล่ เอียงคร่อมแกนอยู่)
      cuff.mesh.geometry.dispose()
      cuff.mesh.geometry = rounded(cuffThick, cuffLen, cuffThick, bevel)
      // ปิดรับเงาเฉพาะแขนเสื้อ — ท่อนแขนวางแนบมันจนเงาตัวเองตกลงบนหน้าสัมผัส กลายเป็นลายฟันปลา
      // (shadow map ที่ระยะนี้หยาบเกินกว่าจะแยกสองผิวที่ห่างกันไม่ถึงหนึ่ง texel) ตัวบ่าข้างหลังยังรับเงาปกติ
      cuff.mesh.receiveShadow = false
      cuff.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis)
      cuff.mesh.position.copy(axis).multiplyScalar(cuffStart + cuffLen / 2)
      cuff.len = cuffLen

      /**
       * 1b) บ่า = "ตัวอุดข้างใน" ไม่ใช่ผิวที่เห็น
       *
       * หน้าที่มันมีอย่างเดียว: อุดช่องรักแร้ตอนแขนยก ไม่ให้มองทะลุเข้าไปในลำตัว
       * ดังนั้นทุกด้านของมันต้องจมอยู่ใต้ชิ้นอื่นเสมอ — ปลายในจมในลำตัว ปลายนอกจมใต้แขนเสื้อ
       * และ "หน้าตัดต้องเล็กกว่าแขนเสื้อ" ด้วย
       *
       * ของเดิมหน้าตัด 1.05F ขณะที่แขนเสื้อ 0.95F บ่าจึงอ้วนกว่าตัวที่ควรคลุมมัน 10%
       * แล้วโผล่ออกมาเป็นแผ่นข้างไหล่ กลายเป็นขอบที่สองในเงา silhouette (เห็นชัดในโหมดแยกสี:
       * ชิ้นสีแดงยื่นออกมาจากใต้แขนเสื้อทั้งสองข้าง)
       *
       * ตอนนี้หนีบด้วยหน้าตัดแขนเสื้อ แล้วหดอีก 4% เป็นระยะเผื่อ — ไม่ใช่ให้เท่ากันพอดี
       * เพราะสองผิวขนานกันสนิทคือสูตร z-fighting
       */
      const yoke = arm.shoulder.userData.yoke
      if (yoke) {
        const p = yoke.geometry.parameters
        const yokeLo = -F * yokeIn // จมเข้าไปในลำตัว ปิดข้อต่อ
        const yokeHi = cuffStart + cuffLen * 0.45
        yoke.geometry.dispose()
        const cross = Math.min(F * yokeCrossF, cuffThick * 0.96)
        // ความลึกบ่ามาจาก bbox ลำตัวที่แปลงเข้าสเปซไหล่ซึ่งหมุนอยู่ — กล่องพองตามแนวทแยง
        // (แขนห้อยวัดได้ 1.47 ทั้งที่ลำตัวลึกจริง 0.66) หนีบด้วยหน้าตัดแขนเสื้อเช่นกัน
        const depth = Math.min(p.depth ?? cross, cross)
        yoke.geometry = rounded(cross, yokeHi - yokeLo, depth, bevel)
        yoke.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis)
        yoke.position.copy(axis).multiplyScalar((yokeLo + yokeHi) / 2)
      }

      // 2) ขยับกลุ่มมือทั้งก้อน — สองทิศพร้อมกัน
      //
      //   ตามแกน: ผลักออกไปจนโคนกำปั้นซ้อนเข้าไปในปลายท่อนแขน
      //   ตั้งฉากกับแกน: ดึงเข้ามาให้ศูนย์กลางกำปั้นอยู่บนแกนแขนพอดี
      //
      // ข้อสองสำคัญ: วัดแล้วบ่า/แขนเสื้อ/ท่อนแขน อยู่บนแกนเป๊ะ (perp = 0) แต่ชิ้นในกลุ่มมือ
      // เยื้องออกจากแกน 0.22-0.33 หน่วยทุกชิ้น เพราะ mkArm วางจุดหมุนข้อมือไว้ไม่ตรงกลางเนื้อมือ
      // หน้าตัดโคนกำปั้นจึงไม่บรรจบกับปลายท่อนแขน เห็นเป็นก้อนเหลื่อมกันอยู่
      // แกนพาดผ่านศูนย์กลางฝ่ามืออยู่แล้ว จึงเหลือแค่เลื่อนตามแกน ไม่ต้องดึงเข้าด้านข้างอีก
      const along = armEnd - F * 0.2 - handLo
      const move = axis.clone().multiplyScalar(along)
      arm.wrist.position.add(move.applyQuaternion(arm.elbow.quaternion.clone().invert()))
      model.updateMatrixWorld(true)

      // 2b) ย้ายจุดหมุนศอก/ข้อมือมาไว้ "บนแกนแขน" โดยของไม่ขยับ
      //
      // วัดแล้วจุดหมุนศอกเยื้องออกจากแกน 0.356 ข้อมือ 0.241 — หมุน slider ที่ข้อพวกนี้
      // ท่อนล่างจะเหวี่ยงเป็นวงรอบจุดที่อยู่นอกตัวแขน (แขนแยกออกจากกัน) แทนที่จะงอตรงข้อ
      // เลื่อนจุดหมุนเข้าแกนแล้วชดเชยตำแหน่งลูกกลับเท่าเดิม ท่าปัจจุบันไม่เปลี่ยน แต่หมุนแล้วงอถูกที่
      const centerOnAxis = (joint, axisInParent) => {
        const want = axisInParent.clone().multiplyScalar(joint.position.dot(axisInParent))
        const delta = joint.position.clone().sub(want)
        joint.position.copy(want)
        const inLocal = delta.applyQuaternion(joint.quaternion.clone().invert())
        joint.children.forEach((c) => c.position.add(inLocal))
        joint.updateMatrixWorld(true)
      }
      centerOnAxis(arm.elbow, axis)
      centerOnAxis(arm.wrist, axis.clone().applyQuaternion(arm.elbow.quaternion.clone().invert()))
      model.updateMatrixWorld(true)

      // 3) ท่อนแขนคั่นกลาง
      const forearm = new THREE.Mesh(
        new THREE.BoxGeometry(thick, armEnd - cuffEnd + 0.1, thick),
        stub.userData.clayFrom ?? stub.material,
      )
      forearm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis)
      forearm.position.copy(axis).multiplyScalar((cuffEnd + armEnd) / 2)
      forearm.castShadow = true
      forearm.receiveShadow = true
      stub.visible = false
      arm.shoulder.add(forearm)

      // ท่อนล่างทั้งก้อน = กล่องท่อนแขน + กลุ่มศอก (ซึ่งพามือกับนิ้วไปด้วย)
      // เก็บตำแหน่งตั้งต้นไว้ ให้ slider pointArmFwd เลื่อนทั้งสองชิ้นพร้อมกันเป็นก้อนเดียว
      // ห้ามรวมกับใคร — slider pointArmFwd เลื่อนชิ้นนี้ทีละชิ้น ถ้าถูกรวมไปแล้วมันจะขยับไม่ได้
      forearm.userData.noMerge = true
      forearm.userData.base = forearm.position.clone()
      arm.elbow.userData.base = arm.elbow.position.clone()
      if (keepLower) rig.current.pointLower = [forearm, arm.elbow]

    }

    // local +x = ฝั่งซ้ายจอหลังหันหลัง (แขนชี้), local -x = ฝั่งถือแก้ว
    // เฉพาะแขนที่ยกชี้ — แขนถือแก้วหมุนไหล่นิดเดียว นิ้วโป้งยังอยู่ด้านในถูกอยู่แล้ว
    mirrorHandGeometry(arms.R)
    const armPoint = mkArm(arms.R)
    // แขนซ้ายของ GLB ไม่ถูกใช้แล้ว — แขนถือแก้วเป็นสำเนากระจกของแขนชี้ (ดู cloneMirroredArm)
    // ซ่อนไว้เฉย ๆ ไม่ลบ: มันยังเป็นตัวอ้างอิงเวลาต้องวัดอะไรจากโมเดลต้นฉบับ
    arms.L.forEach(({ o }) => {
      o.visible = false
    })
    rig.current.pointShoulder = armPoint?.shoulder
    rig.current.pointElbow = armPoint?.elbow
    rig.current.pointWrist = armPoint?.wrist
    // เฉพาะแขนที่ยกชี้ — แขนถือแก้วห้อยลงตามท่าพัก ข้อยังไม่พับ รอยต่อเลยยังตันอยู่เอง
    rebuildShoulder(armPoint)
    if (armPoint) {
      centerPivot(armPoint.wrist)
      centerPivot(armPoint.elbow)
    }

    // นิ้วชี้ — comp ชี้ด้วยนิ้วเดียว แต่ GLB ปั้นมาเป็นกำปั้นล้วน
    // ต่อนิ้วเป็นกล่องออกจากปลายมือตามแนวแขน (ข้อนิ้วที่กำอยู่เดิมยังอยู่ ได้ท่ากำ+ชี้แบบ comp)
    if (armPoint) {
      const wrist = armPoint.wrist
      model.updateMatrixWorld(true)

      // แจกแจงชิ้นในมือ (พิกัดของ wrist): ท่อนแขน > ฝ่ามือ > ข้อนิ้ว 4 ท่อน > นิ้วโป้ง
      const hp = handDir(wrist)
      const knuckles = hp?.knuckles ?? []
      const thumb = hp?.thumb
      if (hp) {
        const { dir } = hp
        // เก็บไว้ให้ alignHandToArm ใช้ — นี่คือ "แกนที่มือชี้" ตัวจริง ไม่ใช่ centroid ของกำปั้น
        wrist.userData.pointDir = dir.clone()
        // นิ้วชี้ = ข้อนิ้วที่อยู่ชิดนิ้วโป้งที่สุด
        const index = knuckles.reduce((best, p) =>
          p.c.distanceTo(thumb.c) < best.c.distanceTo(thumb.c) ? p : best,
        )
        const along = (s) => Math.abs(s.x * dir.x) + Math.abs(s.y * dir.y) + Math.abs(s.z * dir.z)
        const knuckleLen = along(index.size)

        /**
         * สเกลอ้างอิง = "ความกว้างกำปั้น" (ระยะแถวข้อนิ้ว) ไม่ใช่ความยาวมือทั้งท่อน
         * ของเดิมอ้างความยาวมือ (ซึ่งรวมท่อนแขนเข้ามาด้วย 0.89 เทียบกับกำปั้น 0.35)
         * นิ้วเลยยาวเป็นสองเท่าที่ควร
         *
         * สัดส่วนจาก comp (วัดเทียบข้อนิ้วที่กำอยู่ซึ่งเป็นจุดอ้างอิงที่ชัดที่สุด):
         * นิ้วที่ยื่นออกมาหนา ~1.4 เท่าของข้อนิ้วหนึ่งท่อน และยาว ~2.6 เท่าของความหนาตัวเอง
         */
        // ความกว้างกำปั้น = ระยะแถวข้อนิ้ว (ข้อนอกสุดถึงข้อนิ้วชี้) + ความหนาข้อนิ้วอีกหนึ่งท่อน
        const rowSpan = Math.max(...knuckles.map((k) => k.c.distanceTo(index.c)))
        const rowW = rowSpan + Math.min(index.size.x, index.size.y, index.size.z)
        const len = knuckleLen + rowW * 0.5
        // หน้าตัดเกือบจัตุรัส — ของเดิมยกหน้าตัดของ "ข้อนิ้วที่กำอยู่" มาใช้ (0.09 x 0.24)
        // ซึ่งเป็นทรงแบนสูง พอยืดออกไปเลยได้ไม้บรรทัดแทนที่จะเป็นนิ้ว
        const thick = rowW * 0.36

        const finger = new THREE.Mesh(
          new THREE.BoxGeometry(thick, len, thick),
          index.o.userData.clayFrom ?? index.o.material,
        )
        finger.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
        // โคนนิ้วทาบที่เดิมของข้อนิ้ว แล้วยืดออกไปข้างหน้าอย่างเดียว
        finger.position.copy(index.c).addScaledVector(dir, (len - knuckleLen) / 2)
        finger.castShadow = finger.receiveShadow = true
        // ซ่อนข้อนิ้วเดิม กล่องใหม่คลุมตำแหน่งเดียวกัน จะได้ไม่ z-fight
        index.o.visible = false
        wrist.add(finger)
        rig.current.pointFinger = finger
      }

      alignHandToArm(armPoint)
      rebuildForearm(armPoint)

      // ท่า "เก็บแขนแนบตัว" ของแขนชี้ — ใช้ตอน scroll เข้าฉาก 2 (ยกแก้วดื่ม ไม่ควรชี้ค้างไว้)
      // ไม่ได้ตั้งมุมเอา แต่คำนวณจากแกนแขนจริง (ต้นแขน -> ปลายแขน ที่ rebuildForearm วัดไว้)
      // ให้หมุนไปทับทิศเดียวกับที่แขนถือแก้วใช้ตอนห้อยแนบตัว — เอียงออกนอกตัว 0.05 พอให้พ้นสะโพก
      const pAxis = armPoint.shoulder.userData.armAxis
      if (pAxis) {
        armPoint.shoulder.userData.tucked = new THREE.Quaternion().setFromUnitVectors(
          pAxis.clone().normalize(),
          new THREE.Vector3(0.05 * (armPoint.outward ?? 1), -1, 0).normalize(),
        )
      }

      // รายชื่อชิ้นส่วนแขน เรียงจากบ่าออกไปหาปลายนิ้ว — ใช้กับโหมดทาสีแยกชิ้น (slider 'แยกสีชิ้นแขน')
      rig.current.pointParts = armParts(armPoint)
      rig.current.pointMerged = mergeArm(armPoint)
    }

    /**
     * แขนถือแก้ว = สำเนากระจกของแขนชี้ ปั้นทีหลังเพราะต้องรอให้แขนชี้เสร็จก่อน
     * ชิ้นส่วน สัดส่วน จุดหมุน เหมือนกันทุกอย่างโดยอัตโนมัติ เหลือแค่ตั้ง "ท่า"
     */
    const armMug = cloneMirroredArm(armPoint)
    rig.current.mugShoulder = armMug?.shoulder
    rig.current.mugElbow = armMug?.elbow

    if (armMug) {
      /**
       * ท่าพัก: ห้อยลงแนบลำตัว กางออกนิดเดียวพอให้แก้วไม่จมสะโพก (ตาม comp)
       *
       * เล็งจาก "ของจริงที่ตาเห็น" ไม่ใช่จากเลขในสเปซไหน: วัดทิศ ไหล่ -> กลางเนื้อแขนทั้งท่อน
       * ในพิกัดโลก แล้วหมุนให้ทิศนั้นไปทับทิศที่ต้องการ วิธีนี้ไม่ต้องรู้เลยว่าแขนถูกสะท้อน
       * มาหรือไม่ และไม่พังถ้าโครงเปลี่ยน — ที่ผ่านมาพลาดเพราะไปคิดเองว่าเวกเตอร์ในสเปซไหน
       * ต้องกลับเครื่องหมายบ้าง
       */
      const aimAt = (node, tip, want) => {
        model.updateMatrixWorld(true)
        const origin = node.getWorldPosition(new THREE.Vector3())
        // เล็งด้วย "กลางเนื้อมือ" เป็นปลายแขนเสมอ ไม่ใช่ centroid ของทั้งกิ่ง —
        // ทั้งกิ่งมีบ่าซึ่งจมอยู่ในลำตัวถ่วงอยู่ เล็ง centroid แล้วแขนเลยเอียงเข้าหาตัว
        const box = new THREE.Box3()
        tip.traverse((o) => {
          if (!o.isMesh || !o.visible) return
          o.geometry.computeBoundingBox()
          box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))
        })
        if (box.isEmpty()) return
        const cur = box.getCenter(new THREE.Vector3()).sub(origin)
        if (cur.lengthSq() < 1e-8) return
        const parentQ = node.parent.getWorldQuaternion(new THREE.Quaternion())
        const inv = parentQ.clone().invert()
        // want ให้มาในสเปซของ model (ที่ outward ±x นิยามไว้) — ต้องแปลงเป็นสเปซโลกก่อน
        // ตัว mascot ถูกหมุน 180° เวลายืนหันหลัง +x ของ model จึงเป็น -x ของโลก
        // ข้ามขั้นนี้แล้วแขนไปโผล่อีกข้างของลำตัว (วัดได้ x กลับเครื่องหมายเป๊ะ ๆ)
        const wantWorld = want.clone().applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion()))
        // แปลงทั้งสองทิศเข้าสเปซแม่ก่อนค่อยหาการหมุน — quaternion ที่ได้จึงเอาไปคูณ
        // กับ quaternion ของ node ได้ตรง ๆ
        const a = cur.applyQuaternion(inv).normalize()
        const b = wantWorld.applyQuaternion(inv).normalize()
        node.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(a, b))
        model.updateMatrixWorld(true)
      }

      // เอียงออกนอกตัว 0.22 — ดิ่ง 100% แล้วแขนจมอยู่ในเงาลำตัว (ลำตัวกว้างครึ่งหนึ่ง 0.43
      // ส่วนหัวไหล่อยู่ที่ 0.31 มือจึงต้องออกไปอย่างน้อย ~0.45 ถึงจะพ้นขอบเสื้อ)
      const down = new THREE.Vector3(0.22 * armMug.outward, -1, 0).normalize()
      /**
       * เล็งสองข้อสลับกันสองรอบ — รอบเดียวไม่พอ
       *
       * จัดไหล่ให้มือดิ่งแล้ว พอไปจัดศอกต่อ มือจะเหวี่ยงออกจากแนวเดิม (จุดหมุนศอกไม่ได้อยู่
       * บนเส้นไหล่-มือพอดี) วัดจริงแล้วเพี้ยนกลับไป 14° ทำสลับกันอีกรอบก็เข้าที่
       */
      for (let i = 0; i < 2; i++) {
        aimAt(armMug.elbow, armMug.wrist, down)
        aimAt(armMug.shoulder, armMug.wrist, down)
      }
      armMug.shoulder.userData.rest = armMug.shoulder.quaternion.clone()
      armMug.elbow.userData.rest = armMug.elbow.quaternion.clone()

      const mug = makeCoffeeCup()
      // แขวนกับข้อมือ แก้วจะได้ติดไปกับมือทุกท่า (ของเดิมผูกกับข้อศอก พอขยับแขนแล้วหลุดมือ)
      armMug.wrist.updateMatrixWorld(true)
      const inv = armMug.wrist.matrixWorld.clone().invert()
      const hand = new THREE.Box3()
      armMug.wrist.traverse((o) => {
        // เฉพาะชิ้นที่มองเห็น — ตอข้อมือที่เพิ่งซ่อนไปยื่นย้อนขึ้นไปตามแขน
        // ถ้านับด้วย จุดจับจะเลื่อนขึ้นไปกลางปลายแขน แก้วก็ลอยสูงกว่ากำปั้น
        if (!o.isMesh || !o.visible) return
        o.geometry.computeBoundingBox()
        hand.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)))
      })
      // จุดจับ = กลางกำปั้น; ตัวแก้วห้อยต่ำลงมาจากตรงนั้นอีกทีตอน useFrame
      // (ต้องคิดตอนนั้นเพราะ "ทิศลงในโลกจริง" ขึ้นกับมุมข้อต่อที่ยังไม่ถูก apply ตอนนี้)
      mug.userData.grip = hand.isEmpty() ? new THREE.Vector3() : hand.getCenter(new THREE.Vector3())
      mug.position.copy(mug.userData.grip)
      // ค่านิ่งต่อ instance — effect นี้รันครั้งเดียวตอนสร้างโมเดล ไม่ต้องใส่ deps
      mug.visible = !noMug
      armMug.wrist.add(mug)
      // แก้วเอียงได้เองตอนยกดื่ม ห้ามถูกรวมเข้ากับมือ
      mug.traverse((o) => {
        o.userData.noMerge = true
      })
      rig.current.mug = mug

      /**
       * ฉาก 2 — ข้อมูลสำหรับ IK ท่ายกแก้วดื่ม
       *
       * ทำไมไม่ใช้ slider มุมเหมือนท่าอื่น: ข้อต่อของ GLB ไม่ได้อยู่บนแกนเนื้อแขน
       * (ปัญหาเดียวกับแขนชี้) หมุน Euler ทีละแกนแล้วแก้วเหวี่ยงไปหลังหัวแทนที่จะถึงปาก
       * ที่นี่จึงเก็บ "ความยาวท่อน + ทิศตั้งต้นในสเปซของแต่ละข้อ" ไว้ แล้วแก้มุมจริงตอน useFrame
       * จากโจทย์เดียว: เอา 'จุดจับแก้ว' ไปให้ถึงจุดที่กำหนด
       *
       * ทุกค่าเป็นค่าคงที่ของโครง (ไม่ขึ้นกับมุมข้อต่อ) จึงคิดครั้งเดียวตรงนี้
       */
      model.updateMatrixWorld(true)
      const gripW = armMug.wrist.localToWorld(mug.userData.grip.clone())
      // ทิศ/ระยะจากจุดหมุนศอก -> จุดจับแก้ว ในสเปซของศอก (ไม่ขึ้นกับ quaternion ของศอกเอง)
      const vElbow = armMug.elbow.worldToLocal(gripW.clone())
      const ik = {
        u: armMug.elbow.position.clone().normalize(), // ทิศต้นแขนในสเปซไหล่
        L1: armMug.elbow.position.length(),
        v: vElbow.clone().normalize(),
        L2: vElbow.length(),
        // ระนาบที่ศอกจะงอออกไป — ชี้ลงและออกนอกตัว (ท่ายกแก้วจริงศอกไม่กางขึ้นข้าง)
        hint: new THREE.Vector3(0.35 * armMug.outward, -1, 0.15).normalize(),
        target: new THREE.Vector3(),
      }
      if (parts.head) {
        const toModel = model.matrixWorld.clone().invert()
        parts.head.geometry.computeBoundingBox()
        const hb = parts.head.geometry.boundingBox
          .clone()
          .applyMatrix4(toModel.multiply(parts.head.matrixWorld))
        const hs = hb.getSize(new THREE.Vector3())
        // ปาก = กลางกล่องหัว เลื่อนลงหนึ่งในสี่ แล้วออกมาที่ผิวหน้า (หน้าอยู่ทาง +z ในสเปซ model)
        // เป้าของ "จุดจับ" ต่ำกว่าปากลงมาเท่าครึ่งความสูงแก้ว — แก้วอยู่เหนือกำปั้นตอนเอียงเข้าปาก
        ik.target.copy(hb.getCenter(new THREE.Vector3()))
        // ต่ำกว่าหัวลงมาเกือบทั้งใบ — ข้อไหล่/ข้อศอกของแขนข้างนี้ยังเป็นของ GLB (ไม่ได้ปั้นใหม่
        // แบบแขนชี้) งอมากแล้วรอยต่อจะอ้าเป็นช่อง จึงยกแก้วแค่ระดับอก แล้วให้ 'หัวก้มลงหาแก้ว' แทน
        ik.target.y -= hs.y * 0.95
        // พ้นผิวหน้าออกมา ไม่ใช่แค่แตะ — แก้วมีความหนาของมันเอง
        ik.target.z += hs.z * 0.7
        // เยื้างมาฝั่งแขนที่ถือแก้ว ท่อนแขนจะได้เข้าจากด้านข้าง ไม่ตัดผ่านกลางหน้า
        ik.target.x += hs.x * 0.16 * armMug.outward
      }
      rig.current.sipIK = ik

      // แก้วไม่นับ มันเป็นของที่ถืออยู่ ไม่ใช่ชิ้นของแขน
      rig.current.mugParts = armParts(armMug, mug)
      rig.current.mugMerged = mergeArm(armMug)
    }

    headGroup.current = g
    eyes.current = parts.eye
    eyes.current.forEach((e) => {
      e.userData.baseScale = e.scale.clone()
      // โหมดปั้น (ClayMode ใน App.jsx) ทาเทาทั้งฉาก — เว้นตาไว้ ไม่งั้นดูไม่ออกว่าหัวหันทางไหน
      e.userData.keepColor = true
    })

    model.userData.rig = rig.current
    model.userData.headGroup = g
    model.userData.eyes = parts.eye

  }, [model])


  /**
   * ทาสีแยกชิ้นส่วนแขน — เก็บ material เดิมไว้บน mesh แล้วสลับกลับตอนปิด
   *
   * ทาทั้งสองแขน และ "นับสีใหม่ทีละข้าง" ไม่ใช่ไล่ยาวต่อกัน — ชิ้นลำดับเดียวกันของสองแขน
   * จึงได้สีเดียวกัน (บ่าแดงทั้งคู่ แขนเสื้อเขียวทั้งคู่) ซึ่งเป็นสิ่งที่ต้องการเวลาเทียบว่า
   * ข้างไหนมีชิ้นเกิน/ขาด ถ้าไล่สีต่อกันข้ามแขน สีจะเลื่อนกันทั้งชุดและเทียบไม่ได้เลย
   */
  useEffect(() => {
    const lists = [rig.current.pointParts, rig.current.mugParts].filter(Boolean)
    if (!lists.length) return
    lists.forEach((parts) => {
      parts.forEach((m, i) => {
        // ถ้าโหมดปั้นทาเทาไปแล้ว material ที่เห็นตอนนี้คือดินเทา ไม่ใช่ของจริง — เอาของจริงจาก clayFrom
        m.userData.armMat = m.userData.armMat ?? m.userData.clayFrom ?? m.material
        // กัน ClayMode (App.jsx) ทาเทาทับสี debug ทุกครึ่งวินาที
        m.userData.keepColor = pose.armDebug
        m.material = pose.armDebug ? debugMat(i) : m.userData.armMat
        // ชิ้นที่ถูกรวมไปแล้วเท่านั้นที่ต้องซ่อน — ชิ้นที่ไม่มีคู่ให้รวม (เช่นแขนเสื้อกับบ่า
        // ที่ตั้ง receiveShadow ต่างกันเลยรวมกันไม่ได้) ยังเป็นตัวจริงที่ต้องแสดงตลอด
        m.visible = pose.armDebug || !m.userData.mergedAway
      })
    })
    const merged = [rig.current.pointMerged, rig.current.mugMerged].filter(Boolean)
    merged.forEach((list) =>
      list.forEach((m) => {
        m.visible = !pose.armDebug
      }),
    )
  }, [pose.armDebug, model])

  // ลากวางแขน (debug) — drag.current = มุมไหล่ที่กำลังลากอยู่, handle = ลูกบอลจับที่ปลายนิ้ว
  const drag = useRef(null)
  const dragging = useRef(false)
  // ความคืบหน้าท่าดื่ม (หน่วงจาก scroll.b.sip) — เก็บใน ref ไม่ใช่ state, useFrame อ่านทุกเฟรม
  const sip = useRef(0)
  // ความคืบหน้าการหุบแขนชี้ — ผูกกับบีต focus แยกจากท่าดื่ม
  const tuck = useRef(0)
  const handle = useRef()

  const pointer = useRef({ x: 0, y: 0 })
  // true = ค่า pointer มาจาก followRef แล้ว useFrame จะไม่เขียนทับด้วย pointer ของ canvas
  const fromRect = useRef(false)
  // มุมที่ลำตัวหันตามหัวในโหมด screenFollow — คิดที่บล็อกหัว เอาไปใช้ที่บล็อกลำตัว
  const bodyTurn = useRef(0)
  const cur = useRef({ x: 0, y: 0 })
  const blink = useRef({ next: 2, closing: 0 })
  // บีต eyes — ตาโต + ประกาย
  const eyeGrow = useRef(0)
  // มุมหันหัวช่วง intro — เป็นสปริง จึงต้องเก็บทั้งมุม ความเร็ว และมุมที่คอตามหลัง
  const introLook = useRef(0)
  const introLookV = useRef(0)
  const introLookLag = useRef(0)
  const eyec = useControls('Eyes (ฉาก 2)', {
    eyesScale: { value: 0.85, min: 0, max: 2.5, step: 0.05, label: 'ตาโตขึ้น (เท่า)' },
    eyesEase: { value: 0.16, min: 0.02, max: 0.5, step: 0.01, label: 'หน่วง' },
    eyesPreview: { value: 0, min: 0, max: 1, step: 0.01, label: 'พรีวิว (ไม่ต้อง scroll)' },
  }, { collapsed: true, store })


  useEffect(() => {
    if (!followRef) return
    // เมาส์ที่ไหนก็ได้ในกรอบที่กำหนด — แปลงเป็น -1..1 เทียบกล่องของ element นั้น
    const onMove = (e) => {
      const el = followRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      pointer.current.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1)
      pointer.current.y = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1)
      fromRect.current = true
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [followRef])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    /**
     * เมาส์ที่ตัวนี้มองตาม = ตำแหน่งบน canvas ของตัวเอง ไม่ใช่ตำแหน่งบนหน้าต่างทั้งบาน
     * (state.pointer เป็น NDC ของ canvas ใบนั้น แกน y ชี้ขึ้น จึงกลับเครื่องหมาย)
     * ก่อนหน้านี้ทุกตัวฟัง pointermove ที่ window ตัวที่อยู่คนละ section เลยหันพร้อมกันหมด
     */
    if (!fromRect.current) {
      pointer.current.x = clamp(state.pointer.x, -1, 1)
      pointer.current.y = clamp(-state.pointer.y, -1, 1)
    }
    cur.current.x = damp(cur.current.x, pointer.current.x, fol.headEase, dt)
    cur.current.y = damp(cur.current.y, pointer.current.y, fol.headEase, dt)
    const { x, y } = cur.current

    // หันหลัง: แกน local กลับด้าน ต้องสลับทิศให้หัวยังหันตามเมาส์บนจอถูกฝั่ง
    const dir = facingAway ? -1 : 1
    const baseYaw = rotation[1] + (facingAway ? Math.PI : 0)

    // ฉาก 2: p2 ขับท่าดื่ม — หน่วงไว้ให้แขนตามช้ากว่านิ้ว scroll เล็กน้อย ไม่กระตุกตามล้อ
    // sipPreview คือค่าบังคับจาก slider ไว้จูนท่าโดยไม่ต้องเลื่อนหน้าไปมา
    sip.current = damp(
      sip.current,
      Math.max(scroll.b.sip, sipc.sipPreview),
      sipc.sipEase,
      dt,
    )
    // ยกแก้วให้จบภายใน 55% แรกของช่วง ที่เหลือปล่อยให้สีคลุมเฟรม (ฝั่ง DOM)
    const raise = seg(sip.current, 0, 0.55)

    if (headGroup.current) {
      if (screenFollow) {
        /**
         * มุมที่ "หันเข้าหากล้อง" ในสเปซโลก แล้วเบี่ยงตามเมาส์ = มุมรวมที่สายตาต้องไปถึง
         */
        const camYaw = Math.atan2(
          state.camera.position.x - position[0],
          state.camera.position.z - position[2],
        )
        // เทียบกับ rotation[1] ที่เขียนไว้ ไม่ใช่ baseYaw — baseYaw บวก π ของ facingAway ไปแล้ว
        // ใช้มันเป็นฐานหัวจะหันกลับหลังพอดี 180° (เห็นแต่ท้ายทอยไม่ว่าเมาส์อยู่ตรงไหน)
        // +π เพราะหน้าโมเดลชี้ไปทาง -z ตอน yaw = 0 (คิดจาก camYaw เฉย ๆ จะได้ท้ายทอย)
        const want = camYaw + Math.PI + x * fol.headYaw
        let total = want - rotation[1]
        total = Math.atan2(Math.sin(total), Math.cos(total))
        /**
         * แบ่งมุมรวมให้ "คอ" กับ "ลำตัว" แทนที่จะบีบมุมรวมทิ้ง
         *
         * ท่านี้ลำตัวหันข้าง (yaw 1.05) กล้องอยู่เกือบตรงข้าม มุมที่ต้องใช้แค่จะมองมาทางกล้อง
         * เฉย ๆ ก็ -1.19 rad แล้ว ของเดิม clamp มุมรวมไว้ ±1.1 หัวจึงติดเพดานตลอดทั้ง section
         * (วัดได้ yaw -0.715 คงที่ไม่ว่าเมาส์อยู่ตรงไหน = ไม่ได้ follow อะไรเลย)
         *
         * แก้เป็น: คอบิดได้ถึง NECK_MAX ส่วนที่เกินให้ลำตัวรับไป บวกไหล่หันตามคออีก 18%
         * — คนมองอะไรไกล ๆ ลำตัวก็เอี้ยวตามเสมอ แล้วหัก bodyTurn ออกจากมุมคอ สายตาจึงตรงเป้าพอดี
         * ลำตัวหน่วงช้ากว่าหัว (0.45 เท่า) หัวจึงนำ ลำตัวตามมาทีหลัง อ่านเป็นน้ำหนักของตัว
         */
        const NECK_MAX = 0.95
        const neckOnly = clamp(total, -NECK_MAX, NECK_MAX)
        const bodyWant = total - neckOnly + neckOnly * 0.18
        bodyTurn.current = damp(bodyTurn.current, bodyWant, fol.headEase * 0.45, dt)
        const neck = total - bodyTurn.current
        headGroup.current.rotation.y = neck
        /**
         * ก้มได้น้อยกว่าเงย และยิ่งคอบิดมาก ยิ่งก้มได้น้อย — ก้มพร้อมบิดคือท่าที่คางมุดทะลุ
         * ปกเสื้อ/ไหล่ (โมเดลไม่มี collision) เพดานก้มจึงหดตามสัดส่วนการบิดคอ
         */
        const twist = Math.min(Math.abs(neck) / NECK_MAX, 1)
        const pitch = fol.headBasePitch + y * fol.headPitch
        headGroup.current.rotation.x = clamp(pitch, -0.26, 0.13 * (1 - 0.55 * twist))
        headGroup.current.rotation.z = clamp(fol.headBaseRoll + x * fol.headRoll, -0.16, 0.16)
      } else {
        headGroup.current.rotation.y = fol.headBaseYaw + x * fol.headYaw * dir
        // เงยหน้ารับแก้ว — บวกทับการก้มตามเมาส์ ไม่ได้แทนที่ (ยังมองตามเมาส์อยู่)
        headGroup.current.rotation.x =
          fol.headBasePitch + y * fol.headPitch * dir + raise * sipc.sipHeadPitch
        headGroup.current.rotation.z = fol.headBaseRoll - x * fol.headRoll * dir
      }

      /**
       * intro บีตแรก: หัวต้องตรงเป๊ะ แล้วค่อยหันซ้าย-ขวาแบบสงสัย
       *
       * เขียนทับค่าที่เพิ่งคำนวณไป ไม่ใช่บวกเพิ่ม — ท่าตั้งต้นของหัวมี yaw -0.22 กับ roll -0.14
       * ติดมาด้วย (ท่าเท่ ๆ ของฉากปกติ) บวกทับแล้วยังไงก็ไม่มีทางได้หน้าตรงสนิทตามที่ต้องการ
       *
       * ครึ่งแรกของบีตนิ่งสนิทให้กระพริบตา ครึ่งหลังกวาดหัว ซ้าย -> ขวา -> กลับกลาง
       * แล้วคลายกลับไปหาท่าปกติตอนบีต pull เริ่ม กล้องจะได้ไม่รับช่วงต่อจากหัวที่ค้างเอียง
       */
      if (intro.playing && intro.b.pull < 1) {
        const f = intro.b.face
        /**
         * หันหัวไปมอง "ทางที่ crop tool อยู่" — ทางเดียว ช้า ๆ ไม่ใช่กวาดซ้ายขวา
         *
         * มุมไม่ได้ตั้งเอง คิดจากตำแหน่งจริงของกรอบในโลก (intro.crop) เทียบกับทิศหน้า
         * ที่ล็อกไว้ตอนเริ่ม intro — ย้ายกรอบไปไว้ตรงไหน หัวก็ยังหันตามถูกทางเสมอ
         * หนีบมุมไว้ที่ INTRO_LOOK_MAX กันคอบิดเกินจริงถ้ากรอบอยู่หลังตัว
         *
         * ใช้ damp เข้าหาเป้าแทนคีย์เฟรม — ได้ทั้งความช้าและความนุ่มโดยไม่มีจุดกระตุก
         * และถ้าเฟรมตกก็ยังไปถึงเป้าเท่ากัน (damp คิดจาก dt ไม่ใช่ต่อเฟรม)
         */
        const look = intro.close && intro.crop
        let want = 0
        if (look) {
          headGroup.current.getWorldPosition(TMP_V)
          TMP_V2.copy(intro.crop).sub(TMP_V).setY(0).normalize()
          const f0 = intro.close.face
          // มุมเซ็นจาก "ทิศหน้าที่ล็อกไว้" ไปหา "ทิศของกรอบ" รอบแกน Y
          want = Math.atan2(
            f0.z * TMP_V2.x - f0.x * TMP_V2.z,
            f0.x * TMP_V2.x + f0.z * TMP_V2.z,
          )
          want = clamp(want, -INTRO_LOOK_MAX, INTRO_LOOK_MAX)
        }
        /**
         * เริ่มหันตอน "กล้องกำลังจะถอย" — ท้ายบีต face ไม่ใช่กลางบีต
         *
         * เดิมเริ่มที่ f > 0.6 (ราววินาทีที่ 2) หัวหันจบไปแล้วตั้งนานกว่ากล้องจะขยับ
         * สองท่าเลยเป็นคนละเรื่องกัน ขยับให้ทับกัน: หัวเริ่มหันตอนบีต face เหลืออีกนิดเดียว
         * แล้วยังหันค้างต่อไปในช่วงต้นของ pull — กล้องถอยออกมาเจอหัวที่กำลังหันอยู่
         *
         * ใช้เกตแบบไต่ (smoothstep) ไม่ใช่สวิตช์ ปลายทางของสปริงจึงไม่กระตุกตอนถึงจังหวะ
         */
        const gate = smooth01((f - 0.78) / 0.22)
        const turn = want * gate

        /**
         * คอเป็นสปริง ไม่ใช่ตัวไล่เข้าหาเป้า
         *
         * ของเดิม damp เข้าเป้าแล้วจอดสนิท = ไม่มีน้ำหนัก ของจริงหัวจะเลยเป้านิดหนึ่งแล้วตกลงที่
         * (ZETA 0.62 เลยราว 8%) ท่าเริ่มก็ออกช้ากว่าเพราะต้องเร่งความเร็วขึ้นมาก่อน
         */
        const w = NECK_K
        introLookV.current += (turn - introLook.current) * w * dt
        introLookV.current -= introLookV.current * 2 * Math.sqrt(w) * NECK_ZETA * dt
        introLook.current += introLookV.current * dt
        // ค่าที่ตามหลังอยู่ครึ่งจังหวะ — ใช้ปั่นการเอียง/ก้ม ท่าจะได้ไม่มาพร้อมกันทั้งก้อน
        introLookLag.current = damp(introLookLag.current, introLook.current, NECK_LAG, dt)

        /**
         * ปล่อยหัวคืนท่าปกติช้ากว่าเดิม — เดิม blend = 1 - b.pull คือคืนตั้งแต่กล้องเริ่มขยับ
         * ท่าหันเลยถูกลบทิ้งกลางคัน คราวนี้ค้างไว้ต้น pull แล้วค่อยคลายช่วง 35%-85%
         */
        const blend = 1 - smooth01((intro.b.pull - 0.35) / 0.5)
        headGroup.current.rotation.y = lerp(headGroup.current.rotation.y, introLook.current, blend)
        /**
         * ก้ม/เงย: คางตกนิดตอนกำลังหมุน (คนหันหัวเร็ว ๆ คางจะทิ้งลงก่อนแล้วค่อยยกกลับ)
         * แล้วค้างเงยขึ้นเล็กน้อยตอนหันค้างอยู่ ใช้ความเร็วของสปริงเป็นตัวบอกว่า "กำลังหมุนอยู่"
         */
        const spin = Math.min(1, Math.abs(introLookV.current) / 1.6)
        headGroup.current.rotation.x = lerp(
          headGroup.current.rotation.x,
          Math.abs(introLookLag.current) * 0.22 - spin * 0.1,
          blend,
        )
        // เอียงคอตามทางที่หัน ใช้ค่าที่ตามหลัง — เอียงมาทีหลังการหมุนเล็กน้อย
        headGroup.current.rotation.z = lerp(
          headGroup.current.rotation.z,
          introLookLag.current * 0.2,
          blend,
        )
      }
    }
    if (root.current) {
      // ฉากหลัก: ลำตัวนิ่ง หันตามเมาส์เฉพาะหัว — screenFollow: ไหล่หันตามหัวไปด้วยส่วนหนึ่ง
      root.current.rotation.y = baseYaw + (screenFollow ? bodyTurn.current : 0)
      if (screenFollow) root.current.rotation.z = rotation[2] + cur.current.x * 0.045
    }

    // apply ท่าจาก rig controls
    const r = rig.current
    // น้ำหนักหุบแขนรวม (scroll ฉาก 2 / จบ intro / slider preview) — ใช้ไล่ศอก+ข้อมือส่วนเพิ่มท้ายเฟรม
    let tuckW = 0
    if (r.pointShoulder) {
      // ระหว่างลาก ใช้มุมจาก drag แทน slider — เขียนลง slever ทุกเฟรมจะ re-render React 60 ครั้ง/วิ
      const d = drag.current
      r.pointShoulder.rotation.z = d ? d.z : pose.pointShoulderZ
      r.pointShoulder.rotation.x = d ? d.x : pose.pointShoulderX
      r.pointShoulder.rotation.y = d ? d.y : pose.pointShoulderY
      const ud = r.pointShoulder.userData
      // ค่อย ๆ หุบแขนชี้ลงแนบลำตัวระหว่าง scroll เข้าฉาก 2
      //
      // ผูกกับบีต focus ไม่ใช่บีต sip — focus คือช่วงที่กล้องวิ่งเข้าไปหา mascot
      // แขนจึงแนบสนิทพอดีตอนกล้องถึงที่ ถ้าผูกกับ sip แขนจะยังกางอยู่ตอนฉาก 2 เริ่มแล้ว
      // แล้วค่อยหุบทีหลังพร้อมยกแก้ว ซึ่งอ่านเป็นสองท่าซ้อนกัน
      //
      // ลากวางแขนอยู่ (drag) ไม่หุบ — กำลังจูนท่าชี้อยู่
      tuck.current = damp(tuck.current, scroll.b.focus, sipc.sipEase, dt)
      // ปั้นทิศห้อยใหม่จาก slider ทุกเฟรม (แทนค่าคงที่ตอน build) — จูนท่าหลังชี้ได้สด ๆ
      if (ud.armAxis && ud.tucked) {
        TUCK_V.set(tuk.tuckOut * (ud.outward ?? 1), -1, -tuk.tuckFwd).normalize()
        ud.tucked.setFromUnitVectors(TUCK_AXIS.copy(ud.armAxis).normalize(), TUCK_V)
        if (tuk.tuckTwist)
          ud.tucked.premultiply(TMP_Q2.setFromAxisAngle(TUCK_V, tuk.tuckTwist))
      }
      if (ud.tucked && !d) {
        /**
         * armsDown บังคับเฉพาะ "น้ำหนักห้อยแขน" ไม่ใช่ tuck.current
         * tuck.current ยังเป็นบีต focus ที่ท่านั่ง (sitW) อ่านต่อ — เซ็ตมันเป็น 1 เมื่อไร
         * ตัวละครจะนั่งลงไปด้วย (หลุดออกนอกกรอบการ์ดไปเลย)
         */
        const t = armsDown
          ? 1
          : Math.max(seg(tuck.current, 0, sipc.sipTuckEnd) * sipc.sipTuck, tuk.tuckPreview)
        if (t > 0.0001) r.pointShoulder.quaternion.slerp(ud.tucked, t)
        tuckW = t
      }
      // out = ทิศออกนอกตัวของแขนข้างนี้ (+x หรือ -x), หน้า = -z ในสเปซ model
      r.pointShoulder.position.set(
        ud.baseX + (ud.outward ?? 1) * pose.pointShoulderOut,
        ud.baseY - pose.pointShoulderDrop,
        ud.baseZ - pose.pointShoulderFwd,
      )
    }
    // เลื่อนท่อนล่างไปตามแกน "หน้า" ของ mascot (-z ในสเปซ model) แปลงเข้าสเปซไหล่ก่อน
    // เพราะชิ้นพวกนี้เป็นลูกของไหล่ ไหล่หมุนอยู่ ทิศหน้าในสเปซของมันจึงไม่ใช่ -z ตรง ๆ
    if (r.pointLower && r.pointShoulder) {
      TMP_V.set(0, 0, -1).applyQuaternion(TMP_Q.copy(r.pointShoulder.quaternion).invert())
      for (const o of r.pointLower) {
        o.position.copy(o.userData.base).addScaledVector(TMP_V, pose.pointArmFwd)
      }
    }
    if (r.pointElbow) {
      r.pointElbow.rotation.set(pose.pointElbowX, pose.pointElbowY, pose.pointElbowZ)
    }
    // ข้อมือ: ตั้งต้นจาก quaternion ที่หันกำปั้นให้ตรงแกนแขนแล้ว slider เป็นมุมงอเพิ่ม
    if (r.pointWrist?.userData.rest) {
      r.pointWrist.quaternion
        .copy(r.pointWrist.userData.rest)
        .multiply(
          TMP_Q.setFromEuler(TMP_E.set(pose.pointWristX, pose.pointWristY, pose.pointWristZ)),
        )
    }
    // แขนถือแก้ว: ตั้งต้นจาก quaternion ที่กดแขนให้ห้อยแนบตัวแล้ว slider เป็นส่วนเพิ่มจากตรงนั้น
    if (r.mugShoulder?.userData.rest) {
      r.mugShoulder.quaternion
        .copy(r.mugShoulder.userData.rest)
        .multiply(
          TMP_Q.setFromEuler(
            TMP_E.set(pose.mugShoulderX, pose.mugShoulderY, pose.mugShoulderZ),
          ),
        )
      // เลื่อนทั้งแขนออกจากลำตัว — เขียนจาก base ทุกเฟรม ไม่ใช่บวกสะสม
      const ud = r.mugShoulder.userData
      r.mugShoulder.position.set(
        ud.baseX + (ud.outward ?? 1) * pose.mugArmOut,
        ud.baseY + pose.mugArmUp,
        ud.baseZ,
      )
    }
    if (r.mugElbow?.userData.rest) {
      r.mugElbow.quaternion
        .copy(r.mugElbow.userData.rest)
        .multiply(
          TMP_Q.setFromEuler(TMP_E.set(pose.mugElbowX, pose.mugElbowY, pose.mugElbowZ)),
        )
    }

    // ฉาก 2: IK สองท่อน — พา "จุดจับแก้ว" ไปที่ปาก แล้ว slerp จากท่ายืนไปหาท่านั้นตาม raise
    if (r.sipIK && raise > 0.001 && r.mugShoulder && r.mugElbow) {
      const ik = r.sipIK
      // เป้าในสเปซ model: ปาก + ระยะที่ปรับจาก slider (+z = หน้า, +x = ฝั่งแขนถือแก้วออกนอกตัว)
      IK_T.copy(ik.target)
      IK_T.z += sipc.sipAimFwd
      IK_T.y += sipc.sipAimUp
      IK_T.x += sipc.sipAimSide * (r.mugShoulder.userData.outward ?? 1)
      IK_D.copy(IK_T).sub(r.mugShoulder.position)
      // เกินเอื้อม/ใกล้เกินพับ = สูตร cos ให้ค่านอกช่วง acos — หนีบระยะไว้ก่อน
      const D = clamp(IK_D.length(), Math.abs(ik.L1 - ik.L2) + 1e-3, ik.L1 + ik.L2 - 1e-3)
      IK_U.copy(IK_D).normalize()
      // ทิศที่ศอกจะกางออก = ส่วนของ hint ที่ตั้งฉากกับแนวไหล่->เป้า
      IK_P.copy(ik.hint).addScaledVector(IK_U, -ik.hint.dot(IK_U))
      if (IK_P.lengthSq() < 1e-6) IK_P.set(0, -1, 0).addScaledVector(IK_U, -IK_U.y)
      IK_P.normalize()
      const a = Math.acos(clamp((ik.L1 * ik.L1 + D * D - ik.L2 * ik.L2) / (2 * ik.L1 * D), -1, 1))
      // ทิศต้นแขน = เอียงออกจากแนวเป้าไปทาง IK_P เป็นมุม a
      IK_UP.copy(IK_U).multiplyScalar(Math.cos(a)).addScaledVector(IK_P, Math.sin(a))
      // ทิศท่อนล่าง = จากปลายต้นแขนไปยังเป้า
      IK_FW.copy(IK_T)
        .sub(r.mugShoulder.position)
        .addScaledVector(IK_UP, -ik.L1)
        .normalize()

      IK_QS.setFromUnitVectors(ik.u, IK_UP)
      IK_QE.setFromUnitVectors(ik.v, IK_FW.applyQuaternion(TMP_Q2.copy(IK_QS).invert()))
      r.mugShoulder.quaternion.slerp(IK_QS, raise)
      r.mugElbow.quaternion.slerp(IK_QE, raise)
    }
    if (r.mug) {
      // แก้วตั้งตรงเสมอ — หักล้าง rotation ที่สะสมมาตามข้อต่อทั้งเส้น
      r.mug.parent.updateWorldMatrix(true, false)
      r.mug.quaternion.copy(r.mug.parent.getWorldQuaternion(TMP_Q).invert())
      // ตอนดื่ม เอียงแก้วเข้าหาปาก — หมุนรอบ "แกนขวาของตัว mascot ในโลกจริง"
      // (right-multiply เพราะ quaternion ที่เพิ่ง copy คือ world->local ค่าที่คูณต่อจึงอยู่ในกรอบโลก)
      if (raise > 0.001 && root.current) {
        TMP_V2.set(1, 0, 0).applyQuaternion(root.current.getWorldQuaternion(TMP_Q2))
        r.mug.quaternion.multiply(
          TMP_Q2.setFromAxisAngle(TMP_V2, sipc.sipMugTilt * seg(sip.current, 0.35, 0.55)),
        )
      }
      // หย่อนแก้วลงจากกำปั้น แล้วดันไป "ด้านหน้าตัว" ไม่ใช่ด้านข้าง
      // ดันออกข้างแล้วท่อนแขนจะบังแก้วมิดตอนมองจากหน้า ซึ่งเป็นมุมที่ scroll ไปหยุด
      // (comp ก็ถือแก้วเยื้องมาหน้าต้นขา ไม่ได้แนบสะโพก)
      // ทิศออกนอกตัวในแนวระนาบ = จากแกนกลางลำตัวไปหากำปั้น
      const outW = r.mug.parent
        .localToWorld(TMP_V2.copy(r.mug.userData.grip))
        .sub(root.current.getWorldPosition(TMP_V))
        .setY(0)
        .normalize()
      // ท่ายืน: แก้วห้อยต่ำกว่ากำปั้นและเยื้องมาหน้าต้นขา
      // ท่าดื่ม: ดึงกลับมาอยู่ที่กำปั้นพอดี — IK พา "จุดจับ" ไปที่ปากแล้ว ถ้ายังห้อยอยู่แก้วจะต่ำกว่าปาก
      r.mug.position
        .copy(r.mug.userData.grip)
        .addScaledVector(TMP_V.set(0, -1, 0).applyQuaternion(r.mug.quaternion), 0.24 - 0.2 * raise)
        .addScaledVector(outW.applyQuaternion(r.mug.quaternion), 0.13 * (1 - raise))
    }
    // ขา: สะโพก(3 แกน + เลื่อนทั้งขา) -> เข่า -> ข้อเท้า
    for (const k of ['L', 'R']) {
      const hip = r[`hip${k}`]
      if (hip?.userData.base) {
        const b = hip.userData.base
        const br = hip.userData.baseRot
        const side = hip.userData.side
        // ออกข้าง = ตามข้างของขาเอง, หน้า = -z ในสเปซ model (เหมือน slider ของไหล่)
        hip.position.set(
          b.x + side * legc[`leg${k}Out`],
          b.y,
          b.z - legc[`leg${k}Fwd`],
        )
        hip.rotation.set(
          br.x + legc[`hip${k}X`],
          br.y + legc[`hip${k}Y`],
          br.z + side * legc[`hip${k}Z`],
        )
      }
      const knee = r[`knee${k}`]
      if (knee) knee.rotation.x = legc[`knee${k}X`]
      const ankle = r[`ankle${k}`]
      if (ankle) ankle.rotation.x = legc[`ankle${k}X`]
    }

    // ลากวางแขน: เล็งแกนแขนไปยังจุดที่เมาส์ชี้
    if (handle.current) {
      const tip = r.pointFinger ?? r.pointWrist
      if (tip && pose.armDrag) {
        tip.getWorldPosition(TMP_V)
        handle.current.position.copy(TMP_V)
      }
      handle.current.visible = pose.armDrag
    }
    /**
     * บีต crop: แขนที่ชี้ตามกรอบไปตลอดทาง
     *
     * ใช้สูตรเดียวกับโหมดลากแขน (แปลงจุดโลก -> สเปซ model -> quaternion ที่หมุนแกนแขนไปทางนั้น)
     * ต่างกันแค่จุดเป้าไม่ได้มาจากเมาส์ แต่มาจากตำแหน่งจริงของ crop tool ที่ CropRig รายงานไว้
     *
     * blend เข้า/ออกด้วยบีตเอง ไม่ตัดเข้าทันที — แขนกระตุกเข้าท่าใหม่อ่านเป็นบั๊ก
     * ตัวคูณ 0.85 ปลายทาง: ชี้ให้ "ไปทางนั้น" ไม่ใช่เหยียดตรงเป๊ะไปที่กรอบ ซึ่งดูแข็ง
     */
    if (
      (intro.playing || intro.done) &&
      intro.crop &&
      r.pointShoulder?.userData.armAxis &&
      root.current
    ) {
      /**
       * ชี้จนสโลแกนขึ้นเกินครึ่ง แล้วค่อยลดแขนลงแนบลำตัว
       *
       * งานของแขนคือ "พากรอบมาครอบคำ" พอคำขึ้นครบและกรอบเข้าที่แล้ว มือที่ยังค้างชี้อยู่กลาง
       * อากาศไม่ได้เล่าอะไรต่อ แถมชี้ไปทางเดียวกับที่คนดูกำลังอ่าน = แย่งสายตาจากตัวหนังสือ
       *
       * ท่าแนบลำตัวใช้ตัวเดียวกับตอน scroll เข้าฉากสอง (userData.tucked) ไม่ได้ปั้นท่าใหม่ —
       * ปลายทางของ intro จะได้ต่อกับท่าตั้งต้นของฉากถัดไปพอดี ไม่มีสะดุดตอนเริ่ม scroll
       */
      const release = smooth01((intro.b.title - 0.5) / 0.45)
      // smooth01 ให้แขนออกตัวนุ่มและเข้าจอดนุ่ม — กรอบ crop ใช้ smoothstep อยู่แล้ว (Panels)
      // ถ้าแขนเชิงเส้นแต่กรอบ ease สองอย่างจะถึงปลายทางคนละจังหวะ อ่านเป็นแขนแข็งทื่อ
      const w = smooth01(intro.b.crop) * (1 - release)
      if (w > 0.001) {
        const sh = r.pointShoulder.getWorldPosition(TMP_V)
        TMP_V2.copy(intro.crop).sub(sh).normalize()
        root.current.getWorldQuaternion(TMP_Q).invert()
        TMP_V2.applyQuaternion(TMP_Q)

        /**
         * เหวี่ยง "ต่อจากท่าตั้งต้น" ไม่ใช่เขียนทับท่าทั้งดุ้น
         *
         * ของเดิมเอา setFromUnitVectors(armAxis, want) มาใส่เป็นมุมของไหล่ตรง ๆ ซึ่งได้ทิศถูก
         * แต่ทิ้งการบิดรอบแกนแขนของท่าตั้งต้นไปทั้งหมด (pointShoulderZ 1.55 หายไป) แขนจึงพลิก
         * หงายท้องแขนขึ้นฟ้าทุกครั้งที่ขยับ ทั้งที่ควรแค่ "ชี้ไปอีกทาง" ด้วยท่าเดิม
         *
         * คิดใหม่เป็นสองชั้น: q_def = ท่าตั้งต้น, แล้วหาส่วนเหวี่ยงที่พาแกนแขน "ของท่าตั้งต้น"
         * ไปยังเป้า ส่วนเหวี่ยงแบบ shortest-arc ไม่ใส่การบิดรอบแกนที่มันหมุนไปเลย
         * คูณกลับเป็น q_swing * q_def จึงได้ทิศใหม่โดยที่การบิดของแขนยังเท่าท่าตั้งต้นเป๊ะ
         */
        AIM_DEF.setFromEuler(
          TMP_E.set(pose.pointShoulderX, pose.pointShoulderY, pose.pointShoulderZ, 'XYZ'),
        )
        AIM_DIR.copy(r.pointShoulder.userData.armAxis).applyQuaternion(AIM_DEF)
        TMP_Q.setFromUnitVectors(AIM_DIR, TMP_V2).multiply(AIM_DEF)
        // slerp ไม่ใช่ lerp ทีละแกนออยเลอร์ — ออยเลอร์สามแกนวิ่งแยกกันจะบิดผ่านท่าที่ไม่มีอยู่จริง
        r.pointShoulder.quaternion.slerp(TMP_Q, w * 0.85)
      }
      /**
       * ชี้จบแล้วลดแขนลงแนบลำตัวเฉย ๆ — ไม่เท้าเอวแล้ว
       *
       * ใช้ userData.tucked ตัวเดียวกับตอน scroll เข้าฉากสอง ไม่ปั้นท่าใหม่:
       * ปลายทางของ intro กับท่าตั้งต้นของฉากถัดไปเป็นท่าเดียวกันเป๊ะ scroll ต่อแล้วไม่มีสะดุด
       * ศอกไม่ต้องสั่ง — มุมชี้ (Z 0.35) คืองอนิด ๆ ตามธรรมชาติของแขนห้อยอยู่แล้ว
       *
       * ไล่ด้วย release ตัวเดียวกับที่หรี่น้ำหนักการชี้ลง สองท่าจึงคาบเกี่ยวกันพอดี ไม่ตัดวูบ
       */
      if (release > 0.001 && r.pointShoulder.userData.tucked) {
        r.pointShoulder.quaternion.slerp(r.pointShoulder.userData.tucked, release)
        tuckW = Math.max(tuckW, release)
      }
    }

    /**
     * ท่านั่งทำงาน (ฉาก 2) — น้ำหนักแยกจาก tuckW: tuck เกิดตอนจบ intro ด้วย (ยังยืนอยู่)
     * ส่วนนั่งเกิดจาก scroll เท่านั้น (tuck.current คือบีต focus ที่หน่วงแล้ว) + slider preview
     */
    const sitW = sit.sitOn
      ? Math.max(smooth01(tuck.current), sit.sitPreview)
      : 0
    if (sitW > 0.001 && root.current) {
      // เขียนจาก prop ทุกเฟรม ไม่บวกสะสม — ถอยหลัง = +z โลก (mascot หันหน้า -z)
      root.current.position.y = position[1] - sit.sitDown * sitW
      root.current.position.z = position[2] + sit.sitBack * sitW
      for (const k of ['L', 'R']) {
        const hip = r[`hip${k}`]
        if (hip) hip.rotation.x += sit.sitHip * sitW
        const knee = r[`knee${k}`]
        if (knee) knee.rotation.x += sit.sitKnee * sitW
        const ankle = r[`ankle${k}`]
        if (ankle) ankle.rotation.x += sit.sitAnkle * sitW
      }
      // แขนพิมพ์งาน: หมุนเพิ่มต่อจากท่าห้อย (ไหล่เป็น quaternion — คูณต่อท้าย)
      if (r.pointShoulder) {
        r.pointShoulder.quaternion.multiply(
          TMP_Q.setFromEuler(TMP_E.set(sit.sitArmX * sitW, 0, 0)),
        )
      }
      if (r.pointElbow) r.pointElbow.rotation.x += sit.sitElbowX * sitW
    }

    // ศอก/ข้อมือส่วนเพิ่มของท่าห้อยแขน — additive จากท่าชี้ ไล่ตามน้ำหนักหุบแขน
    // ต้องอยู่หลังบล็อก intro เพราะ tuckW เพิ่งรู้ค่าสุดท้ายตรงนั้น
    if (tuckW > 0.001) {
      if (r.pointShoulder) {
        // เลื่อนทั้งแขน — บวกทับตำแหน่งที่ set จาก base ไว้แล้วต้นเฟรม จึงไม่สะสมข้ามเฟรม
        // หน้า = -z ในสเปซ model เหมือน pointShoulderFwd
        const ud = r.pointShoulder.userData
        r.pointShoulder.position.x += (ud.outward ?? 1) * tuk.tuckArmOut * tuckW
        r.pointShoulder.position.y += tuk.tuckArmUp * tuckW
        r.pointShoulder.position.z -= tuk.tuckArmFwd * tuckW
      }
      if (r.pointElbow) {
        r.pointElbow.rotation.x += tuk.tuckElbowX * tuckW
        r.pointElbow.rotation.y += tuk.tuckElbowY * tuckW
        r.pointElbow.rotation.z += tuk.tuckElbowZ * tuckW
      }
      if (r.pointWrist) {
        r.pointWrist.quaternion.multiply(
          TMP_Q.setFromEuler(
            TMP_E.set(
              tuk.tuckWristX * tuckW,
              tuk.tuckWristY * tuckW,
              tuk.tuckWristZ * tuckW,
            ),
          ),
        )
      }
    }

    if (dragging.current && r.pointShoulder?.userData.armAxis && root.current) {
      // ระนาบที่ลากคือระนาบผ่านหัวไหล่ที่หันเข้าหากล้อง — ลากในระนาบจอตรง ๆ ไม่ต้องเดาความลึก
      const sh = r.pointShoulder.getWorldPosition(TMP_V)
      DRAG_PLANE.setFromNormalAndCoplanarPoint(
        state.camera.getWorldDirection(TMP_V2).negate(),
        sh,
      )
      state.raycaster.setFromCamera(state.pointer, state.camera)
      const hit = state.raycaster.ray.intersectPlane(DRAG_PLANE, DRAG_HIT)
      if (hit) {
        // ทิศที่ต้องการ (world) -> สเปซของ model แล้วหาควอเทอร์เนียนที่หมุนแกนแขนไปทางนั้น
        const want = hit.clone().sub(sh).normalize()
        root.current.getWorldQuaternion(TMP_Q).invert()
        want.applyQuaternion(TMP_Q)
        TMP_Q.setFromUnitVectors(r.pointShoulder.userData.armAxis, want)
        TMP_E.setFromQuaternion(TMP_Q, 'XYZ')
        drag.current = { x: TMP_E.x, y: TMP_E.y, z: TMP_E.z }
      }
    }

    /**
     * intro ต้องรู้ว่า "ตา" กับ "ทิศหน้า" อยู่ตรงไหนในโลก กล้องช่วงประชิดเล็งจากสองค่านี้
     * เขียนเฉพาะตอน intro ยังเล่นอยู่ — เลิกเล่นแล้วไม่ต้องจ่ายค่าคำนวณทุกเฟรม
     */
    if (intro.playing && headGroup.current) {
      const eyeMeshes = eyes.current
      if (eyeMeshes?.length) {
        INTRO_EYE.set(0, 0, 0)
        eyeMeshes.forEach((o) => INTRO_EYE.add(o.getWorldPosition(TMP_V)))
        INTRO_EYE.multiplyScalar(1 / eyeMeshes.length)
        intro.eyes = INTRO_EYE
      }
      /**
       * ทิศหน้าคิดจาก "ตาอยู่หน้าหัว" ไม่ใช่จากแกนของ object
       *
       * getWorldDirection คืนแกน +z ของกลุ่มหัว ซึ่งไม่ได้ผูกกับใบหน้าเลย (กลุ่มนี้ถูกสร้าง
       * ขึ้นมาใหม่แล้ว attach ชิ้นส่วนเข้าไป แกนจึงเป็นของ world ตอนสร้าง) ลองแล้วกล้อง
       * ไปจ่ออยู่ข้างหัว — วัดจากตาเทียบจุดกลางหัวแทน ได้ทิศที่ตรงกับที่ตามองเสมอ
       */
      headGroup.current.getWorldPosition(TMP_V)
      intro.face = INTRO_FACE.copy(INTRO_EYE).sub(TMP_V).setY(0).normalize()
    }

    /**
     * idle — ชั้นบนสุดของการจัดท่า บวกทับหลังทุกระบบ (ชี้/ดื่ม/แนบตัว) จัดเสร็จแล้ว
     *
     * สูตร: คลื่น sine หลายลูกที่ความถี่ไม่เป็นเท่าตัวกัน (0.55 / 0.83 / ลมหายใจ) เฟสต่างกัน
     * ผลรวมเลยไม่วนซ้ำเป็นแพตเทิร์นให้ตาจับได้ — ดูเป็นการทรงตัวของคนยืน ไม่ใช่ metronome
     *
     * ทุกอย่างเป็นการหมุนจุดหมุนที่มีอยู่แล้ว ไม่มีการเลื่อนตำแหน่ง — เท้ายังปักอยู่ใน
     * รอยเท้าบนทราย (ยกตัวขึ้นลงแบบหุ่นลอยของ chaingpt ไม่ได้ เท้าจะหลุดจากหลุม)
     */
    if (idle.idleAmp > 0 && !noIdle && !dragging.current) {
      const t = state.clock.elapsedTime
      const amp = idle.idleAmp
      const breath = Math.sin(t * idle.idleBreath * Math.PI * 2)
      const s1 = Math.sin(t * 0.55 + 1.3)
      const s2 = Math.sin(t * 0.83 + 4.1)

      /**
       * เหลียวมองนู่นนี่ — ส่วนที่ทำให้ "ดูมีชีวิต" จริง (ลมหายใจอย่างเดียวจางเกินกว่าตาจะจับ)
       *
       * ทุก 2-5 วิ จับสลากจุดมองใหม่: ส่วนใหญ่เหลียวไปด้านข้าง (สูงสุด ~26°) บางครั้งกลับมามองตรง
       * แล้วค่อย ๆ damp หัวไปหาเป้า — ได้จังหวะ "เหลือบ -> จ้องค้าง -> เหลือบต่อ" แบบคนจริง
       * ไม่ใช่แกว่งไปมาต่อเนื่อง ตอนกำลังยกแก้วดื่ม (raise) พักการเหลียว — ก้มดูแก้วสิของจริง
       */
      const g = glance.current
      if (t > g.next) {
        g.fx = g.x
        g.fy = g.y
        if (Math.random() < 0.3) {
          g.tx = 0
          g.ty = 0
        } else {
          g.tx = (Math.random() * 2 - 1) * 0.45
          g.ty = (Math.random() * 2 - 1) * 0.14
        }
        g.start = t
        g.dur = 0.9 + Math.random() * 0.6 // ความเร็วหันไม่เท่ากันทุกรอบ
        g.next = t + 2 + Math.random() * 3
      }
      // ease in-out ต่อรอบ: ออกตัวช้า เร่งกลางทาง เข้าจอดช้า — จังหวะหันหัวของคนจริง
      const gp = smooth01((t - g.start) / g.dur)
      g.x = g.fx + (g.tx - g.fx) * gp
      g.y = g.fy + (g.ty - g.fy) * gp
      const gw = idle.idleGlance * (1 - raise)

      // ลำตัวโยกรอบแกนตั้งช้า ๆ + หันตามทิศที่เหลียวนิดหน่อย (คนหันหน้าแรง ๆ ไหล่หันตามเสมอ)
      if (root.current)
        root.current.rotation.y += (s1 * 0.014 + s2 * 0.006) * amp + g.x * 0.16 * gw * dir
      // หัว: เหลียวตามเป้า + เชิดตามลมหายใจ + เอียงคอช้า ๆ (บวกทับการหันตามเมาส์ ไม่ได้แทนที่)
      if (headGroup.current) {
        headGroup.current.rotation.y += g.x * gw * dir
        headGroup.current.rotation.x += breath * 0.011 * amp + g.y * gw
        headGroup.current.rotation.z += s2 * 0.007 * amp - g.x * 0.14 * gw * dir
      }
      // ไหล่สองข้างขยับตามลมหายใจ คนละเฟสกันนิดหน่อย — พร้อมกันเป๊ะจะดูเป็นหุ่นกลไก
      if (r.pointShoulder) {
        TMP_Q.setFromEuler(TMP_E.set(breath * 0.010 * amp, 0, s1 * 0.008 * amp))
        r.pointShoulder.quaternion.multiply(TMP_Q)
      }
      if (r.mugShoulder) {
        TMP_Q.setFromEuler(
          TMP_E.set(Math.sin(t * idle.idleBreath * Math.PI * 2 + 0.7) * 0.010 * amp, 0, s2 * 0.008 * amp),
        )
        r.mugShoulder.quaternion.multiply(TMP_Q)
      }
    }

    /**
     * ท่าว่ายอากาศ (โดดร่ม) — ชั้นสุดท้าย เขียนทับทุกท่าที่จัดมาก่อนหน้า
     *
     * ต้องอยู่ท้ายสุดเพราะทุกระบบข้างบนคิดบนสมมติฐาน "มีพื้นให้ยืน": แขนห้อยตามน้ำหนัก
     * (tuck) เท้าปักที่ ไหล่ขยับตามลมหายใจ ถ้าไปบวกทับ ท่าจะกลายเป็นคนยืนที่กางแขนนิดหน่อย
     * ไม่ใช่คนที่กำลังตกอยู่กลางอากาศ
     *
     * แขนใช้วิธี "เล็งแกนแขนไปยังทิศที่ต้องการ" ตัวเดียวกับท่าห้อย (userData.armAxis) แทน
     * การใส่มุมออยเลอร์ — แขนซ้าย/ขวาเป็นชิ้นที่ถูกสะท้อนมา มุมออยเลอร์ชุดเดียวกันจึงให้ผล
     * คนละท่า ส่วนแขนถือแก้วไม่มี armAxis ที่ใช้ได้ (userData ถูกก๊อบผ่าน JSON ตอนโคลน
     * Vector3 เลยกลายเป็นออบเจกต์เปล่า) จึงคิดต่อจาก quaternion ท่าพักของมันเอง
     */
    if (skydive) {
      const t = state.clock.elapsedTime
      /** ไหวช้า ๆ คนละความถี่ ไม่เป็นเท่าตัวกัน — ผลรวมจึงไม่วนซ้ำให้ตาจับได้ */
      const w1 = Math.sin(t * 1.15)
      const w2 = Math.sin(t * 0.87 + 2.2)
      const w3 = Math.sin(t * 0.63 + 4.7)

      if (r.pointShoulder?.userData.armAxis?.isVector3) {
        const ud = r.pointShoulder.userData
        // กางออกข้างเกือบสุด ยกขึ้นเหนือไหล่ และเปิดไปข้างหน้าเล็กน้อย (หน้า = -z)
        AIR_V.set(1 * (ud.outward ?? 1), 0.52 + w1 * 0.12, -0.34 + w2 * 0.1).normalize()
        r.pointShoulder.quaternion.setFromUnitVectors(
          AIR_AXIS.copy(ud.armAxis).normalize(),
          AIR_V,
        )
        r.pointShoulder.position.set(ud.baseX, ud.baseY, ud.baseZ)
      }
      // ศอกงอขึ้น = ท่า W ของนักโดดร่ม ไม่ใช่แขนเหยียดตรงเป็นไม้กางเขน
      if (r.pointElbow) r.pointElbow.rotation.set(-0.85 + w2 * 0.1, 0, 0.45)
      if (r.mugShoulder?.userData.rest) {
        const ud = r.mugShoulder.userData
        r.mugShoulder.quaternion
          .copy(ud.rest)
          .multiply(TMP_Q.setFromEuler(TMP_E.set(-0.5, 0, -0.72 - w2 * 0.1)))
        r.mugShoulder.position.set(ud.baseX, ud.baseY, ud.baseZ)
      }
      if (r.mugElbow?.userData.rest) {
        r.mugElbow.quaternion
          .copy(r.mugElbow.userData.rest)
          .multiply(TMP_Q.setFromEuler(TMP_E.set(-0.9 + w1 * 0.1, 0, 0)))
      }

      // ขา: ถ่างออก งอเข่า ปลายเท้าตกตามแรงลม
      for (const k of ['L', 'R']) {
        const s = k === 'L' ? -1 : 1
        const hip = r[`hip${k}`]
        if (hip?.userData.baseRot) {
          const br = hip.userData.baseRot
          hip.rotation.set(br.x - 0.62 + w3 * 0.1, br.y, br.z + s * 0.62)
        }
        const knee = r[`knee${k}`]
        if (knee) knee.rotation.x = 1.35 + (k === 'L' ? w1 : w2) * 0.16
        const ankle = r[`ankle${k}`]
        if (ankle) ankle.rotation.x = -0.35
      }

      // ทั้งตัวแอ่นหลังนิด ๆ แล้วส่ายตามกระแสลม — ไม่ใช่แผ่นแข็งที่ลอยนิ่ง
      if (root.current) {
        root.current.rotation.x = rotation[0] + 0.12 + w2 * 0.05
        root.current.rotation.z = rotation[2] + w3 * 0.07
      }
      if (headGroup.current) headGroup.current.rotation.x += 0.18
    }

    /**
     * ท่าเล่นสเก็ต — ชั้นสุดท้ายเหมือน skydive เขียนทับท่าที่จัดมาก่อนหน้า
     *
     * ต่างจาก skydive ตรงที่ "มีพื้นให้ยืน" จริง แต่ยังต้องทับ เพราะระบบท่ายืนปกติ
     * ตั้งขาให้ตรงและปล่อยแขนห้อยตามน้ำหนัก ซึ่งขัดกับท่าย่อลึกบิดตัวใน ref
     *
     * แขนใช้วิธีเล็งแกนแขน (armAxis) เหมือน skydive — แขนซ้าย/ขวาถูกสะท้อนมา
     * มุมออยเลอร์ชุดเดียวกันจึงให้คนละท่า ส่วนแขนถือแก้วไม่มี armAxis ที่ใช้ได้
     * (userData ถูกก๊อบผ่าน JSON ตอนโคลน) จึงคิดต่อจาก quaternion ท่าพักของมันเอง
     */
    if (skate) {
      const t = state.clock.elapsedTime
      /** ไหวคนละความถี่ ไม่เป็นเท่าตัวกัน — ผลรวมไม่วนซ้ำให้ตาจับ */
      const w1 = Math.sin(t * 1.25)
      const w2 = Math.sin(t * 0.91 + 1.7)
      const w3 = Math.sin(t * 0.67 + 3.9)

      /**
       * แขนกางเป็น T — เหยียดออกข้างทั้งสองข้าง เกือบขนานพื้น
       *
       * แขนข้างนี้เล็งด้วยแกนแขน (armAxis) ทิศ (ออกข้าง, ~0, ~0) คือกางตรงออกไปเลย
       * ศอกต้องเหยียดสุด (0) ด้วย ไม่งั้นปลายแขนตกลงมาแล้วอ่านเป็นท่ากางแขนครึ่งใจ
       */
      const ap = armPose ?? SKATE_ARM
      if (r.pointShoulder?.userData.armAxis?.isVector3) {
        const ud = r.pointShoulder.userData
        // aim เป็นทิศทาง ไม่ใช่องศา — x ต้องคูณ outward เพราะแขนสองข้างถูกสะท้อนกัน
        AIR_V.set(
          ap.aimX * (ud.outward ?? 1),
          ap.aimY + w1 * 0.05,
          ap.aimZ + w2 * 0.05,
        ).normalize()
        r.pointShoulder.quaternion.setFromUnitVectors(
          AIR_AXIS.copy(ud.armAxis).normalize(),
          AIR_V,
        )
        r.pointShoulder.position.set(ud.baseX, ud.baseY, ud.baseZ)
      }
      /**
       * ศอกเหยียด = POSE0.elbowZ (0.35) ไม่ใช่ 0
       *
       * ค่าศูนย์ของข้อต่อนี้ไม่ใช่ท่าเหยียดตรง ใส่ 0 แล้วปลายแขนบิดตกลงมาเป็นแขนหัก
       * — เป็นสาเหตุที่แขนข้างนี้ตกอยู่ข้างเดียวทั้งที่เล็งแกนไหล่ออกข้างถูกแล้ว
       */
      if (r.pointElbow) r.pointElbow.rotation.set(ap.elbowX + w1 * 0.05, ap.elbowY, ap.elbowZ)
      /**
       * คืนท่อนแขนล่างกับข้อมือกลับค่าตั้งต้น
       *
       * ระบบท่ายืนเลื่อนท่อนล่างไปข้างหน้า (pointArmFwd) และบิดข้อมือด้วยสไลเดอร์ของมันเอง
       * ถ้าไม่เขียนทับ ปลายแขนจะค้างเยื้องจากท่อนบนเป็นข้อต่อหลุด และกำปั้นบิดคนละทาง
       * — เห็นชัดมากตอนกางแขนเป็น T เพราะแขนอยู่ในระนาบที่มองเห็นข้อต่อเต็ม ๆ
       */
      if (r.pointLower) for (const o of r.pointLower) o.position.copy(o.userData.base)
      if (r.pointWrist?.userData.rest) {
        r.pointWrist.quaternion
          .copy(r.pointWrist.userData.rest)
          .multiply(TMP_Q.setFromEuler(TMP_E.set(ap.wristX, ap.wristY, ap.wristZ)))
      }

      /**
       * แขนอีกข้างกางออกเป็นคู่กัน
       *
       * แขนถือแก้วไม่มี armAxis ที่ใช้ได้ (userData ถูกก๊อบผ่าน JSON ตอนโคลน Vector3
       * เลยกลายเป็นออบเจกต์เปล่า) จึงคิดต่อจาก quaternion ท่าพัก — และเครื่องหมาย z
       * ต้องเป็นลบถึงจะกางออก ใส่บวกแล้วแขนพับเข้าหาตัวจนหายไปหลังลำตัว
       */
      if (r.mugShoulder?.userData.rest) {
        const ud = r.mugShoulder.userData
        /**
         * premultiply ไม่ใช่ multiply — หมุนในสเปซของลำตัว ไม่ใช่สเปซของแขนเอง
         *
         * ท่าพักของแขนนี้กดแขนห้อยแนบตัวไว้แล้ว การคูณต่อท้าย (multiply) จึงกลายเป็น
         * "บิดรอบแกนแขนตัวเอง" แขนเลยแทบไม่ยกขึ้น ปรับค่าเท่าไรก็ยังห้อยอยู่
         * คูณนำหน้าคือหมุนรอบแกนของลำตัว = ยกกางออกได้จริง
         */
        r.mugShoulder.quaternion
          .copy(ud.rest)
          .premultiply(TMP_Q.setFromEuler(TMP_E.set(ap.mugShX, ap.mugShY, ap.mugShZ - w3 * 0.04)))
        r.mugShoulder.position.set(ud.baseX, ud.baseY, ud.baseZ)
      }
      // ศอกฝั่งแก้วอยู่ที่ท่าพักพอดี — บิดเพิ่มเมื่อไรปลายแขนจะหักออกจากแนวท่อนบนทันที
      if (r.mugElbow?.userData.rest) {
        r.mugElbow.quaternion
          .copy(r.mugElbow.userData.rest)
          .multiply(TMP_Q.setFromEuler(TMP_E.set(ap.mugElX + w2 * 0.04, ap.mugElY, ap.mugElZ)))
      }

      /**
       * ขาไม่สมมาตร — เท้าหน้ากับเท้าหลังบนบอร์ดไม่ได้ทำงานเหมือนกัน
       *
       * ref ย่อลึกจนต้นขาเกือบขนานพื้น และเข่าข้างหน้ายกสูงกว่าอีกข้างชัดเจน
       * ถ้าใส่ค่าเดียวกันทั้งสองข้างจะได้ท่านั่งยอง ซึ่งอ่านเป็นคนหมอบ ไม่ใช่คนเล่นสเก็ต
       * บิดสะโพกรอบแกน y ด้วย เพราะบนบอร์ดเท้าเรียงตามความยาวแผ่น ไม่ใช่เรียงข้างกัน
       */
      const LEG = legPose ?? SKATE_LEG
      for (const k of ['L', 'R']) {
        const L = LEG[k]
        const hip = r[`hip${k}`]
        if (hip?.userData.baseRot) {
          const br = hip.userData.baseRot
          hip.rotation.set(br.x + L.hipX + w1 * 0.06, br.y + L.hipY, br.z + L.hipZ)
        }
        const knee = r[`knee${k}`]
        if (knee) knee.rotation.x = L.knee + (k === 'L' ? w1 : w2) * 0.08
        const ankle = r[`ankle${k}`]
        if (ankle) ankle.rotation.x = L.ankle
      }

      // ตัวโน้มไปหน้าเยอะ (หลังค่อม ทิ้งน้ำหนักลงเข่า) + เอียงตามการเลี้ยว
      if (root.current) {
        root.current.rotation.x = rotation[0] + 0.26 + w2 * 0.04
        root.current.rotation.z = rotation[2] - 0.1 + w3 * 0.05
      }
      /**
       * สเกลแขน — เขียนทุกเฟรมเพราะ prop เปลี่ยนได้ระหว่างจูน
       *
       * สเกลที่ไหล่คูณลงไปทั้งสาย (ท่อนบน ท่อนล่าง มือ) ส่วนสเกลที่ศอกคูณเฉพาะ
       * ท่อนล่างกับมือ — แยกสองตัวเพราะมือของ mascot ใหญ่กว่าสัดส่วนแขนอยู่แล้ว
       * ย่อทั้งแขนอย่างเดียวจะได้แขนกุดที่มือยังใหญ่เท่าเดิมเมื่อเทียบกับท่อนแขน
       */
      if (r.pointShoulder) r.pointShoulder.scale.setScalar(armScale)
      if (r.mugShoulder) r.mugShoulder.scale.setScalar(armScale)
      if (r.pointElbow) r.pointElbow.scale.setScalar(foreScale)
      if (r.mugElbow) r.mugElbow.scale.setScalar(foreScale)

      // ตัวก้มแล้วหัวต้องเงยสวนขึ้นมามองทางไป ไม่ใช่ก้มตามลำตัวจนมองพื้น
      if (headGroup.current) headGroup.current.rotation.x -= 0.2
    }

    // หนีบมุมก้ม/เงยรวมของหัว "หลังทุกระบบเขียนเสร็จ" — ห้ามหัวจมคอเสื้อไม่ว่าจะบวกกันมากี่ทาง
    if (headGroup.current) {
      headGroup.current.rotation.x = clamp(
        headGroup.current.rotation.x,
        -HEAD_PITCH_LIM,
        HEAD_PITCH_LIM,
      )
    }

    // กระพริบตา: ย่อแกน Y ของ mesh ตา
    const b = blink.current
    b.next -= delta
    if (b.next <= 0) {
      b.closing = 0.13
      b.next = 2.4 + Math.random() * 3.6
    }
    // ระหว่าง close-up ของ intro ห้ามกระพริบตามจังหวะสุ่ม — บีตนี้มีกระพริบของมันเอง
    // (จังหวะเดียว calm ดูท้ายฟังก์ชัน) กระพริบสุ่มจะไปซ้อนจังหวะนั้นพอดี
    if (intro.playing && intro.b.face < 1) {
      b.closing = 0
      b.next = Math.max(b.next, 0.8)
    }
    let k = 1
    if (b.closing > 0) {
      b.closing -= delta
      k = 0.12
    }

    // บีต eyes — ตาโตขึ้นแบบการ์ตูน + ประกายในตาโผล่
    // ระหว่างบีตนี้หยุดกระพริบ ไม่งั้นตาที่กำลังเบิกโตจะวูบปิดกลางจังหวะ
    eyeGrow.current = damp(
      eyeGrow.current,
      Math.max(scroll.b.eyes, eyec.eyesPreview),
      eyec.eyesEase,
      dt,
    )
    const grow = eyeGrow.current
    if (grow > 0.35) k = 1
    const scaleUp = 1 + grow * eyec.eyesScale

    /**
     * intro: กระพริบสองตาช้า ๆ ครั้งเดียวตอน close-up — calm ไม่ขยิบข้างเดียว ไม่มีประกาย
     * (ของเดิมขยิบตาข้างเดียว + ประกายเด้ง อ่านเป็นเล่นใหญ่เกินโทนที่ต้องการ)
     *
     * envelope เป็น sin เต็มลูกช่วง 0.4-0.62 ของบีต face — หลับแล้วลืมนุ่ม ๆ จังหวะเดียว
     * ปิดไม่สนิท (เหลือ 0.12 เท่ากระพริบสุ่ม) ให้อ่านเป็นกระพริบ ไม่ใช่หลับ
     */
    const iFace = intro.playing ? intro.b.face : 0
    const iBlink = iFace > 0 ? Math.sin(clamp(seg(iFace, 0.4, 0.62), 0, 1) * Math.PI) : 0

    eyes.current.forEach((e) => {
      const base = e.userData.baseScale
      if (!base) return
      const ky = k * lerp(1, 0.12, iBlink)
      e.scale.x = damp(e.scale.x, base.x * scaleUp, 0.35, dt)
      e.scale.y = damp(e.scale.y, base.y * scaleUp * ky, 0.45, dt)
      for (const s of e.userData.sparks ?? []) {
        // โผล่ช้ากว่าตาเล็กน้อยแล้วค่อยเด้งเกินนิดหนึ่ง — ไม่ให้ดูเหมือนแค่ fade in
        const pop = seg(grow, 0.25, 1) * (1 + 0.12 * Math.sin(seg(grow, 0.25, 1) * Math.PI))
        s.scale.setScalar(s.userData.baseRadius * pop * scaleUp)
        s.visible = pop > 0.001
      }
    })
  })

  const endDrag = () => {
    if (!dragging.current) return
    dragging.current = false
    gl.domElement.style.cursor = ''
    // ปล่อยแล้วค่อยเขียนค่าลง slider ทีเดียว (ระหว่างลากใช้ ref เพื่อไม่ให้ React re-render ทุกเฟรม)
    if (drag.current) {
      setPose({
        pointShoulderX: drag.current.x,
        pointShoulderY: drag.current.y,
        pointShoulderZ: drag.current.z,
      })
      drag.current = null
    }
  }

  return (
    <>
      <group ref={root} position={position} scale={scale} rotation={rotation}>
        <primitive object={model} />
        <Legs rig={rig} />
      </group>
      {/* จับลาก — อยู่นอก group ของ mascot เพราะตำแหน่งถูกเซ็ตเป็นพิกัด world ทุกเฟรม */}
      <mesh
        ref={handle}
        visible={false}
        onPointerDown={(e) => {
          e.stopPropagation()
          dragging.current = true
          gl.domElement.style.cursor = 'grabbing'
          e.target?.setPointerCapture?.(e.pointerId)
        }}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerOver={() => {
          if (!dragging.current) gl.domElement.style.cursor = 'grab'
        }}
        onPointerOut={() => {
          if (!dragging.current) gl.domElement.style.cursor = ''
        }}
      >
        <sphereGeometry args={[0.16, 20, 14]} />
        <meshBasicMaterial color="#6C4CF5" transparent opacity={0.75} depthTest={false} />
      </mesh>
    </>
  )
}

useGLTF.preload(MODEL)
