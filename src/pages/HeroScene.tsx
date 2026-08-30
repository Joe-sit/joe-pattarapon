import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { Chunk } from './HeroShatter'

/**
 * ฉากไอโซเมตริกของจอแรก /2026-final — ไซต์ก่อสร้างรอบแล็ปท็อป
 * ถอดจากภาพอ้างอิงในไฟล์ Figma (node 12717:2875) แล้วเปลี่ยนคนงานเป็น mascot ของ Joe
 *
 * ทุกชิ้นปั้นด้วย primitive ในโค้ด ไม่ใช่โมเดลที่โหลดมา — ทรงพวกนี้เป็นกล่อง/กรวย/ทรงกระบอก
 * ล้วน การโหลดไฟล์มาวางแทนคือการแลกน้ำหนักหน้าเว็บกับสิ่งที่เขียนได้ในสิบบรรทัด
 *
 * geometry ที่ใช้ซ้ำสร้างครั้งเดียวแล้วส่งต่อ ปุ่มคีย์บอร์ด 70 ปุ่มเป็น InstancedMesh ก้อนเดียว
 * (70 mesh แยกกัน = 70 draw call เพื่อกล่องเล็ก ๆ ที่หน้าตาเหมือนกันหมด)
 */

/** สีถอดจากภาพอ้างอิงโดยตรง */
const C = {
  gold: '#f5a700',
  goldLight: '#ffc02d',
  goldDeep: '#d98b00',
  orange: '#ff6b1a',
  orangeDeep: '#e04f0a',
  purple: '#5b2ab8',
  purpleLight: '#a97ff0',
  /* เสาเครนเข้มกว่าตัวแขนเล็กน้อยในภาพอ้างอิง */
  purpleMid: '#8b5cf0',
  lavender: '#b49be8',
  screen: '#4a18b8',
  screenBand: '#6b3ae0',
  green: '#2f8a38',
  greenLight: '#3ea248',
  /* พุ่มเตี้ยในภาพอ้างอิงเป็นเขียวอมเหลือง อ่อนกว่าพุ่มบนต้นไม้ชัดเจน */
  bush: '#7fb43c',
  bushLight: '#93c94b',
  trunk: '#7a4a2a',
  white: '#ededf2',
  grey: '#c9cdd6',
  greyDark: '#8b90a0',
}

function mat(color: string, roughness = 0.85) {
  return <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
}

/* ── ขนาดหลักของฉาก ─────────────────────────────────────────────────────── */

export const BASE_W = 7
export const BASE_D = 4.4
/** ความหนาของฐานแล็ปท็อป — ของที่ยืนบนฐานอ้างค่านี้แทนตัวเลขดิบ */
export const BASE_H = 0.34
/** มุมเอนของฝาจอจากแนวตั้ง */
const LID_TILT = 0.2
const LID_H = 4.6
/** ความหนาของฝาจอ — บางเท่าที่ยังเห็นสันข้างตอนมองมุมไอโซ */
const LID_T = 0.16
/** ยอดฝาจอหลังเอน — ใช้วางของที่ยืนอยู่บนขอบบนของจอ (คนถือโทรโข่ง เสาเครน) */
const LID_TOP_Y = BASE_H + LID_H * Math.cos(LID_TILT)
const LID_TOP_Z = -BASE_D / 2 - LID_H * Math.sin(LID_TILT)

/* ── ของที่ใช้ซ้ำ ────────────────────────────────────────────────────────── */

type Shared = {
  cone: THREE.ConeGeometry
  coneBand: THREE.CylinderGeometry
  coneBase: THREE.BoxGeometry
  canopy: THREE.SphereGeometry
  trunk: THREE.CylinderGeometry
  roll: THREE.CylinderGeometry
  rollCap: THREE.CylinderGeometry
}

/**
 * ต้นไม้ — ลำต้นสอบ + พุ่มที่เป็นก้อนกลมหลายก้อนเกยกัน
 *
 * ในภาพอ้างอิงพุ่มไม่ใช่ลูกกลมใบเดียวบนแท่ง (อ่านเป็นอมยิ้ม) แต่เป็นก้อนกลม 4-5 ก้อนเกยกัน
 * จนขอบเป็นหยัก ๆ แบบดอกกะหล่ำ — ก้อนหลักหนึ่งก้อน แล้วก้อนเล็กรอบ ๆ ยอด
 * ทุกก้อนใช้ geometry ตัวเดียวกันแล้วย่อ/ขยับเอา ไม่ได้สร้าง geometry เพิ่ม
 */
const CANOPY_BLOBS: { pos: [number, number, number]; scale: number }[] = [
  { pos: [0, 0.9, 0], scale: 1 },
  { pos: [-0.36, 1.06, 0.12], scale: 0.68 },
  { pos: [0.34, 1.02, -0.16], scale: 0.72 },
  { pos: [0.06, 1.32, 0.18], scale: 0.6 },
  { pos: [-0.1, 1.0, -0.38], scale: 0.58 },
]

function Tree({ g, scale = 1 }: { g: Shared; scale?: number }) {
  return (
    <group scale={scale}>
      <mesh geometry={g.trunk} position={[0, 0.28, 0]} castShadow receiveShadow>
        {mat(C.trunk)}
      </mesh>
      {CANOPY_BLOBS.map((b, i) => (
        <mesh
          key={i}
          geometry={g.canopy}
          position={b.pos}
          scale={b.scale}
          castShadow
          receiveShadow
        >
          {mat(i === 3 ? C.greenLight : C.green)}
        </mesh>
      ))}
    </group>
  )
}

/** ก้อนของพุ่มเตี้ย — สามก้อนเกยกัน ไม่มีลำต้น นั่งอยู่กับพื้นเลย */
const BUSH_BLOBS: { pos: [number, number, number]; scale: number }[] = [
  { pos: [0, 0.34, 0], scale: 0.62 },
  { pos: [-0.3, 0.26, 0.1], scale: 0.46 },
  { pos: [0.26, 0.3, -0.08], scale: 0.5 },
]

/** พุ่มเตี้ยที่ไม่มีลำต้น — ในภาพอ้างอิงมีแทรกอยู่ระหว่างต้นไม้ สีอ่อนกว่าพุ่มบนต้น */
function Bush({ g, scale = 1 }: { g: Shared; scale?: number }) {
  return (
    <group scale={scale}>
      {BUSH_BLOBS.map((b, i) => (
        <mesh
          key={i}
          geometry={g.canopy}
          position={b.pos}
          scale={b.scale}
          castShadow
          receiveShadow
        >
          {mat(i === 1 ? C.bushLight : C.bush)}
        </mesh>
      ))}
    </group>
  )
}

function Cone({ g }: { g: Shared }) {
  return (
    <group>
      <mesh geometry={g.coneBase} position={[0, 0.06, 0]} castShadow receiveShadow>
        {mat(C.orangeDeep)}
      </mesh>
      <mesh geometry={g.cone} position={[0, 0.55, 0]} castShadow receiveShadow>
        {mat(C.orange)}
      </mesh>
      <mesh geometry={g.coneBand} position={[0, 0.6, 0]} castShadow>
        {mat(C.white)}
      </mesh>
    </group>
  )
}

/* ── แล็ปท็อป ────────────────────────────────────────────────────────────── */

/**
 * แล็ปท็อปยักษ์ที่เป็นตัวฉาก — ฐานวางกับพื้น ฝาจอกางขึ้นจากขอบหลัง
 *
 * ฝาต้องหมุนรอบ "บานพับ" คือขอบหลังของฐาน ไม่ใช่รอบจุดกึ่งกลางตัวเอง จึงซ้อน group สองชั้น:
 * ชั้นนอกอยู่ที่บานพับและเป็นตัวหมุน ชั้นในยกฝาขึ้นครึ่งความสูงของมันเอง
 */
function Laptop() {
  return (
    <group>
      <RoundedBox
        args={[BASE_W, BASE_H, BASE_D]}
        radius={0.08}
        smoothness={3}
        position={[0, BASE_H / 2, 0]}
        castShadow
        receiveShadow
      >
        {mat(C.gold)}
      </RoundedBox>
      {/* หน้าฐานสว่างกว่าด้านข้างเล็กน้อยตามภาพอ้างอิง — เยื้องขึ้นกัน z-fight */}
      <mesh position={[0, BASE_H + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BASE_W - 0.24, BASE_D - 0.24]} />
        {mat(C.goldLight)}
      </mesh>
      {/* แผ่นรองเมาส์สีส้มแดงบนฐาน */}
      <mesh position={[-1.7, BASE_H + 0.02, 0.75]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.1, 1.25]} />
        {mat(C.orangeDeep)}
      </mesh>

      <group position={[0, BASE_H, -BASE_D / 2]} rotation={[-LID_TILT, 0, 0]}>
        <group position={[0, LID_H / 2, 0]}>
          <RoundedBox args={[BASE_W, LID_H, LID_T]} radius={0.06} smoothness={3} castShadow receiveShadow>
            {mat(C.gold)}
          </RoundedBox>
          <mesh position={[0, 0.1, LID_T / 2 + 0.01]}>
            <planeGeometry args={[BASE_W - 0.55, LID_H - 0.7]} />
            <meshStandardMaterial color={C.screen} roughness={0.4} />
          </mesh>
          {/* แถบสว่างสองเส้นพาดจอ */}
          <mesh position={[-0.2, 0.7, LID_T / 2 + 0.02]}>
            <planeGeometry args={[5.2, 0.4]} />
            <meshBasicMaterial color={C.screenBand} />
          </mesh>
          <mesh position={[-0.6, 0.05, LID_T / 2 + 0.02]}>
            <planeGeometry args={[3.8, 0.3]} />
            <meshBasicMaterial color={C.purpleLight} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/* ── คีย์บอร์ด ───────────────────────────────────────────────────────────── */

const KB_COLS = 10
const KB_ROWS = 4
const KB_KEY = 0.28
const KB_GAP = 0.07

/**
 * คีย์บอร์ดส้มที่วางกับพื้นข้างแล็ปท็อป (ไม่ใช่บนฐาน — ในภาพอ้างอิงมันวางแยกอยู่บนพื้น)
 *
 * ปุ่มทั้ง 70 ปุ่มเป็น InstancedMesh ก้อนเดียว: หน้าตาเหมือนกันหมด ต่างแค่ตำแหน่ง
 * ถ้าแยกเป็น mesh ละปุ่มคือ 70 draw call เพื่อกล่องเล็ก ๆ ที่ซ้ำกัน
 */
function Keyboard() {
  const keys = useRef<THREE.InstancedMesh>(null)
  const pitch = KB_KEY + KB_GAP
  const w = KB_COLS * pitch + 0.5
  const d = KB_ROWS * pitch + 0.5

  useLayoutEffect(() => {
    const m = keys.current
    if (!m) return
    const t = new THREE.Object3D()
    let i = 0
    for (let r = 0; r < KB_ROWS; r++) {
      for (let c = 0; c < KB_COLS; c++) {
        t.position.set(
          (c - (KB_COLS - 1) / 2) * pitch,
          0,
          (r - (KB_ROWS - 1) / 2) * pitch,
        )
        t.updateMatrix()
        m.setMatrixAt(i++, t.matrix)
      }
    }
    m.instanceMatrix.needsUpdate = true
  }, [pitch])

  return (
    <group>
      <RoundedBox args={[w, 0.34, d]} radius={0.1} smoothness={3} position={[0, 0.17, 0]} castShadow receiveShadow>
        {mat(C.orange)}
      </RoundedBox>
      <instancedMesh
        ref={keys}
        args={[undefined, undefined, KB_COLS * KB_ROWS]}
        position={[0, 0.38, 0]}
        castShadow
      >
        <boxGeometry args={[KB_KEY, 0.12, KB_KEY]} />
        <meshStandardMaterial color={C.goldLight} roughness={0.8} />
      </instancedMesh>
    </group>
  )
}

/** ต้นไม้/พุ่ม: [x, z, scale] — เก็บเป็นตารางเพราะตอนนี้ทุกต้นถูกห่อด้วย Chunk เหมือนกันหมด */
const TREES: [number, number, number][] = [
[-4.2, -2.6, 1.1],
[-5.8, 0.9, 0.85],
[-4.4, 4.2, 0.95],
[7.4, 0.2, 1],
[6.4, 3.8, 0.8],
]
const BUSHES: [number, number, number][] = [
[-6.6, -0.9, 1.05],
[9.0, 1.2, 0.85],
]


/* ── ของประกอบฉาก ───────────────────────────────────────────────────────── */

/** เมาส์วางกับพื้น — ตัวเทา ปุ่มม่วงสองปุ่ม */
function Mouse() {
  return (
    <group>
      <RoundedBox args={[0.62, 0.26, 0.95]} radius={0.12} smoothness={3} position={[0, 0.13, 0]} castShadow receiveShadow>
        {mat(C.grey)}
      </RoundedBox>
      {[-0.14, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.27, -0.22]}>
          <cylinderGeometry args={[0.11, 0.11, 0.03, 12]} />
          {mat(C.purpleLight)}
        </mesh>
      ))}
    </group>
  )
}

/** บันไดพาดฝาจอ */
function Ladder() {
  const rungs = [0, 1, 2, 3, 4, 5, 6, 7]
  return (
    <group>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 2.5, 0]} castShadow>
          <boxGeometry args={[0.12, 5.2, 0.12]} />
          {mat(C.orange)}
        </mesh>
      ))}
      {rungs.map((i) => (
        <mesh key={i} position={[0, 0.5 + i * 0.6, 0]} castShadow>
          <boxGeometry args={[0.64, 0.09, 0.09]} />
          {mat(C.orangeDeep)}
        </mesh>
      ))}
    </group>
  )
}

/**
 * เครนที่ยื่นเข้ามาจากมุมขวาบน — ถอดจากภาพอ้างอิงทีละชิ้น
 *
 * โครงในภาพคือ: ลูกบาศก์ม่วงอ่อนวางคร่อมขอบบนของฝาจอ → เสา "กลม" ตั้งขึ้นจากลูกบาศก์
 * → ปลายเสาเป็นหูยึดเทาสองแผ่นประกบกัน แต่ละแผ่นเป็นแผ่นแบนปลายมนเจาะรูสลักม่วงสองรู
 * → แขนหนาปลายมนพุ่งเฉียงขึ้นทางขวาออกนอกเฟรม โดยมีข้อศอกกลมอยู่ในหูยึด
 *
 * ของเดิมเป็นเสาสี่เหลี่ยม หูยึดกล่องเดียว และไม่มีข้อศอก — อ่านเป็นเสาไฟมากกว่าเครน
 */
function Crane() {
  return (
    // ตำแหน่งอยู่ที่ <Chunk> ข้างนอก — วัดจากภาพอ้างอิงแล้ว ระยะจากลูกบาศก์ถึงหูยึดกินราว
    // 0.2 เท่าของความสูงฝาจอ ไม่ใช่เสาสูงลิ่วอย่างที่ทำไว้เดิม
    <group>
      {/* ลูกบาศก์ที่โคน คร่อมอยู่บนขอบฝาจอ */}
      <RoundedBox args={[1.0, 1.0, 1.0]} radius={0.05} smoothness={2} position={[0, 0.2, 0]} castShadow>
        {mat(C.purpleLight)}
      </RoundedBox>
      {/* เสากลม ไม่ใช่เสาเหลี่ยม */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.95, 20]} />
        {mat(C.purpleMid)}
      </mesh>

      {/* หูยึด: แผ่นเทาแบนปลายมนสองแผ่นประกบข้อศอก แต่ละแผ่นเจาะรูสลักม่วงสองรู */}
      {[0.34, -0.34].map((z) => (
        <group key={z} position={[0, 1.75, z]}>
          <RoundedBox args={[0.6, 1.15, 0.2]} radius={0.1} smoothness={4} castShadow>
            {mat(C.grey)}
          </RoundedBox>
          {[0.28, -0.26].map((y) => (
            <mesh key={y} position={[0.02, y, Math.sign(z) * 0.1]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.02, 16]} />
              {mat(C.purple)}
            </mesh>
          ))}
        </group>
      ))}

      {/* ข้อศอกกลมที่นั่งอยู่ระหว่างแผ่นหูยึด แล้วแขนงอกออกจากมัน */}
      <group position={[0, 2.05, 0]} rotation={[0, 0, 0.86]}>
        <mesh castShadow>
          <sphereGeometry args={[0.28, 18, 12]} />
          {mat(C.purpleLight)}
        </mesh>
        {/* แคปซูล = แท่งปลายมนจริง ไม่ต้องเอาทรงกลมไปแปะหัวเอง */}
        <mesh position={[2.4, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.26, 4.4, 6, 16]} />
          {mat(C.purpleLight)}
        </mesh>
      </group>
    </group>
  )
}

/** ชิ้นจิ๊กซอว์ — ตัวสี่เหลี่ยมกับปุ่มกลมสองด้าน */
function Puzzle() {
  return (
    <group>
      <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 0.22, 1]} />
        {mat(C.goldLight)}
      </mesh>
      <mesh position={[0.58, 0.11, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.22, 14]} />
        {mat(C.goldLight)}
      </mesh>
      <mesh position={[0, 0.11, 0.58]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.22, 14]} />
        {mat(C.goldLight)}
      </mesh>
      {/* รอยเว้าอีกสองด้าน — ทำด้วยก้อนสีพื้นเดียวกับพื้นไม่ได้ (พื้นโปร่ง) จึงเว้าด้วยการ
          ไม่ใส่ปุ่ม แล้วอาศัยปุ่มสองด้านบอกว่าเป็นจิ๊กซอว์ */}
    </group>
  )
}

/** ม้วนพิมพ์เขียวกองเป็นพีระมิด ปลายม้วนเป็นสีม่วง */
function Rolls({ g }: { g: Shared }) {
  const one = (p: [number, number, number]) => (
    <group position={p} rotation={[0, 0, Math.PI / 2]}>
      <mesh geometry={g.roll} castShadow receiveShadow>
        {mat(C.white)}
      </mesh>
      {[-0.78, 0.78].map((y) => (
        <mesh key={y} geometry={g.rollCap} position={[0, y, 0]} castShadow>
          {mat(C.purpleLight)}
        </mesh>
      ))}
    </group>
  )

  return (
    <group>
      {one([0, 0.34, -0.36])}
      {one([0, 0.34, 0.36])}
      {one([0, 0.94, 0])}
    </group>
  )
}

/** ไม้บรรทัดม่วง — ขีดสเกลเป็นแถบขาวเล็ก ๆ บนหน้า */
function Ruler() {
  const ticks = [0, 1, 2, 3, 4]
  return (
    <group>
      <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.14, 0.62]} />
        {mat(C.purpleLight)}
      </mesh>
      {ticks.map((i) => (
        <mesh key={i} position={[-0.9 + i * 0.45, 0.145, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.07, 0.34]} />
          <meshBasicMaterial color={C.white} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * @param children  ตัวละครที่ยืนกับพื้น/บนฐาน — ส่งมาจาก HeroPlatform เพราะการยกให้เท้าแตะพื้น
 *                  เป็นเรื่องของที่นั่น
 * @param onCrane   ตัวละครที่ยืนบนแท่นห้อยของเครน
 * @param onLadder  ตัวละครที่ปีนบันได — เอียงไปกับบันไดทั้งตัว
 */
export function HeroScene({
  children,
  onCrane,
  onLadder,
}: {
  children?: ReactNode
  onCrane?: ReactNode
  onLadder?: ReactNode
}) {
  const shared = useMemo<Shared>(
    () => ({
      cone: new THREE.ConeGeometry(0.34, 1, 14),
      coneBand: new THREE.CylinderGeometry(0.22, 0.26, 0.18, 14),
      coneBase: new THREE.BoxGeometry(0.7, 0.12, 0.7),
      canopy: new THREE.SphereGeometry(0.66, 14, 10),
      trunk: new THREE.CylinderGeometry(0.13, 0.16, 0.56, 8),
      roll: new THREE.CylinderGeometry(0.3, 0.3, 1.7, 16),
      rollCap: new THREE.CylinderGeometry(0.32, 0.32, 0.16, 16),
    }),
    [],
  )

  // three ไม่เก็บกวาด geometry ให้เอง — คืนทุกตัวที่สร้างเองตอนออกจากหน้า
  useEffect(
    () => () => {
      for (const g of Object.values(shared)) g.dispose()
    },
    [shared],
  )

/** มุมเอียงของบันได ใช้ทั้งกับตัวบันไดและตัวที่ปีนอยู่ */
  const ladderTilt = -0.26

  return (
    <group>
      {/* ทุกชิ้นห่อด้วย <Chunk> = RigidBody หนึ่งก้อน ตำแหน่งตั้งต้นย้ายมาไว้ที่ Chunk
          ไม่ใช่ที่ตัวชิ้น เพราะเวลาระเบิดของต้องหมุนรอบตัวเอง ไม่ใช่เหวี่ยงรอบกลางฉาก */}
      <Chunk>
        <Laptop />
      </Chunk>

      <Chunk position={[0.8, BASE_H, 1.3]} rotation={[ladderTilt, 0.06, 0]}>
        <Ladder />
      </Chunk>
      <Chunk position={[0.8, BASE_H, 1.3]} rotation={[ladderTilt, 0.06, 0]} mascot>
        <group position={[0, 4.2, 0.45]}>{onLadder}</group>
      </Chunk>

      <Chunk position={[1.9, LID_TOP_Y - 0.35, LID_TOP_Z]}>
        <Crane />
      </Chunk>
      {/* คนถือโทรโข่งยืนอยู่บนขอบบนของฝาจอทางขวา ตามภาพอ้างอิง ไม่ได้ห้อยอยู่กับเครน */}
      <Chunk position={[3.4, LID_TOP_Y, LID_TOP_Z]} mascot>
        {onCrane}
      </Chunk>

      {/* คีย์บอร์ดวางทับอยู่บนฐานแล็ปท็อป เลยขอบหน้าขวาออกไปครึ่งตัวตามภาพอ้างอิง
          ไม่ใช่วางแยกอยู่บนพื้น */}
      <Chunk position={[2.5, BASE_H, 0.5]} rotation={[0, -0.45, 0]}>
        <Keyboard />
      </Chunk>
      <Chunk position={[-0.6, BASE_H, 1.5]} rotation={[0, -0.3, 0]}>
        <Mouse />
      </Chunk>

      <Chunk position={[-0.2, BASE_H, -1.2]}>
        <Cone g={shared} />
      </Chunk>
      <Chunk position={[-1.3, 0, 3.3]}>
        <Cone g={shared} />
      </Chunk>
      <Chunk position={[1.6, 0, 4.2]}>
        <Cone g={shared} />
      </Chunk>

      <Chunk position={[-4.6, 0, 1.9]} rotation={[0, -0.35, 0]}>
        <Rolls g={shared} />
      </Chunk>
      <Chunk position={[7.6, 0, 2.2]} rotation={[0, -0.35, 0]}>
        <Ruler />
      </Chunk>

      <Chunk position={[-0.9, 0, 5]} rotation={[0, 0.35, 0]}>
        <Puzzle />
      </Chunk>
      <Chunk position={[3.2, 0, 6]} rotation={[0, -0.5, 0]}>
        <Puzzle />
      </Chunk>

      {/* ต้นไม้ในภาพอ้างอิงมีไม่กี่ต้นและอยู่ห่างกัน — กระจุกซ้ายสามต้น ขวาสองต้น
          กับพุ่มเตี้ยอีกสองก้อน มากกว่านี้ฉากจะแน่นจนของหลักจม */}
      {TREES.map(([x, z, sc], i) => (
        <Chunk key={i} position={[x, 0, z]}>
          <Tree g={shared} scale={sc} />
        </Chunk>
      ))}
      {BUSHES.map(([x, z, sc], i) => (
        <Chunk key={i} position={[x, 0, z]}>
          <Bush g={shared} scale={sc} />
        </Chunk>
      ))}

      {children}
    </group>
  )
}
