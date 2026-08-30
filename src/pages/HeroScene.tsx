import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Chunk } from './HeroShatter'
import { idle, IdleDriver } from './heroIdle'

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
/** ความสูงยอดฝาจอหลังเอน — ใช้วางของที่ยืนอยู่บนขอบบนของจอ (คนถือโทรโข่ง เสาเครน) */
const LID_TOP_Y = BASE_H + LID_H * Math.cos(LID_TILT)
/** ที่ตั้งของแล็ปท็อปในฉาก — ฐานกับฝาจอเป็นคนละชิ้นแต่ต้องอ้างจุดเดียวกัน */
const LAPTOP: [number, number, number] = [1.2, 0, 0.8]

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
 * ต้นไม้ — ลำต้นตรง + พุ่มสามก้อนเกยกันเป็นโดมกว้าง
 *
 * ตามภาพที่โจส่งมา: พุ่มไม่ได้กองสูงเป็นเจดีย์ แต่เป็นก้อนกลมสามก้อนวางแผ่กว้าง
 * ก้อนหลังสูงและใหญ่สุด สองก้อนหน้าเตี้ยลงมาซ้าย-ขวา ขอบล่างของพุ่มกินลำต้นเข้าไป
 * เห็นลำต้นโผล่แค่ท่อนล่าง ทุกก้อนใช้ geometry ตัวเดียวกันแล้วย่อ/ขยับเอา
 */
const CANOPY_BLOBS: { pos: [number, number, number]; scale: number }[] = [
  { pos: [0, 1.02, -0.14], scale: 0.94 },
  { pos: [-0.42, 0.86, 0.2], scale: 0.76 },
  { pos: [0.42, 0.9, 0.16], scale: 0.72 },
]

/** สุ่มแบบคงที่ต่อ (ต้น, ก้อน) — ต้องได้ค่าเดิมทุกเฟรม ไม่งั้นพุ่มจะสั่นตอนวาดใหม่ */
function jitter(seed: number, i: number, k: number) {
  const x = Math.sin(seed * 91.7 + i * 41.3 + k * 13.9) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

/**
 * ต้นไม้หนึ่งต้น — seed ทำให้แต่ละต้นทรงไม่เหมือนกัน
 *
 * scale อย่างเดียวได้ต้นไม้ตัวเดียวกันย่อ/ขยาย มองออกทันทีว่าเป็นของก๊อบ ๆ กัน
 * seed จึงขยับตำแหน่ง/ขนาดของก้อนพุ่มทีละนิด และยืด-หดลำต้น ให้ทรงต่างกันจริง
 */
function Tree({ g, scale = 1, seed = 0 }: { g: Shared; scale?: number; seed?: number }) {
  const trunkH = 1 + jitter(seed, 0, 0) * 0.22
  return (
    <group scale={scale}>
      <mesh
        geometry={g.trunk}
        position={[0, 0.45 * trunkH, 0]}
        scale={[1, trunkH, 1]}
        castShadow
        receiveShadow
      >
        {mat(C.trunk)}
      </mesh>
      {CANOPY_BLOBS.map((b, i) => (
        <mesh
          key={i}
          geometry={g.canopy}
          position={[
            b.pos[0] + jitter(seed, i, 1) * 0.1,
            b.pos[1] * trunkH + jitter(seed, i, 2) * 0.07,
            b.pos[2] + jitter(seed, i, 3) * 0.1,
          ]}
          scale={b.scale * (1 + jitter(seed, i, 4) * 0.14)}
          castShadow
          receiveShadow
        >
          {mat(i === 0 ? C.greenLight : C.green)}
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
function Bush({ g, scale = 1, seed = 0 }: { g: Shared; scale?: number; seed?: number }) {
  return (
    <group scale={scale}>
      {BUSH_BLOBS.map((b, i) => (
        <mesh
          key={i}
          geometry={g.canopy}
          position={[
            b.pos[0] + jitter(seed, i, 5) * 0.08,
            b.pos[1] + jitter(seed, i, 6) * 0.04,
            b.pos[2] + jitter(seed, i, 7) * 0.08,
          ]}
          scale={b.scale * (1 + jitter(seed, i, 8) * 0.16)}
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
 * ฐานแล็ปท็อป — ตัวเครื่องที่วางกับพื้น พร้อมหน้าฐานและแผ่นรองเมาส์
 *
 * แยกจากฝาจอเป็นคนละ <Chunk> ฝาจอจึงขยับ/หมุน/ระเบิดเป็นอิสระจากตัวเครื่องได้
 * (ดู LAPTOP กับ LaptopScreen ข้างล่าง)
 */
function LaptopBase() {
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
    </group>
  )
}

/**
 * โหมดของจอแล็ปท็อป — เลือกจาก toolbar ของหน้า
 *
 * design = ฝั่งซิมมือถือสว่าง โค้ดหรี่ · dev = กลับกัน ทั้งสองฝั่งอยู่บนจอเสมอ
 * ไม่มีการ mount/unmount ตอนสลับ (สลับ = หรี่ทับ ไม่ใช่สร้างใหม่)
 */
export type ScreenMode = 'design' | 'dev'

/** พื้นที่แสดงผลจริงบนฝาจอ — ขอบจอกินรอบละ ~0.28 */
const SCREEN_W = BASE_W - 0.55
const SCREEN_H = LID_H - 0.7
/** ระยะยกแต่ละชั้นจากหน้าจอ กันชั้นซ้อนกันแล้ว z-fight */
const Z = LID_T / 2 + 0.01

/** บรรทัดโค้ดฝั่งซ้าย: [ย่อหน้า, ความยาว, สี] — คงที่ ไม่สุ่มทุกเฟรม */
const CODE_LINES: [number, number, string][] = [
  [0, 1.55, C.orange],
  [0.26, 2.15, C.lavender],
  [0.52, 1.2, C.white],
  [0.52, 1.85, C.screenBand],
  [0.26, 2.4, C.lavender],
  [0, 1.05, C.orange],
  [0.26, 1.95, C.white],
  [0.52, 1.35, C.screenBand],
  [0, 1.7, C.lavender],
]

/** สี่เหลี่ยมแบนหนึ่งชิ้นบนจอ — ใช้ระนาบหน่วยตัวเดียวกันหมด ต่างกันแค่ scale กับ material */
function Bar({
  geo,
  mat: material,
  x,
  y,
  w,
  h,
  z = 0,
}: {
  geo: THREE.PlaneGeometry
  mat: THREE.Material
  x: number
  y: number
  w: number
  h: number
  z?: number
}) {
  return <mesh geometry={geo} material={material} position={[x, y, z]} scale={[w, h, 1]} />
}

/**
 * ฝาจอ — ชิ้นอิสระที่ตั้งอยู่ที่บานพับ (ขอบหลังของฐาน)
 *
 * จุดกำเนิดของชิ้นนี้อยู่ที่บานพับ ไม่ใช่กลางจอ: มุมเอนเป็น rotation ของ Chunk ที่ห่อมัน
 * ฝาจึงหมุนรอบบานพับเหมือนของจริง และตอนระเบิดก็หมุนรอบจุดเดียวกัน ไม่เหวี่ยงรอบกลางฉาก
 *
 * บนจอแบ่งครึ่ง: ซ้ายเป็นหน้าต่างโค้ด ขวาเป็นซิมมือถือ — เหมือนจอจริงของคนทำงานสายนี้
 * ทุกชิ้นเป็นระนาบหน่วยตัวเดียวกันที่ถูก scale (ไม่ใช่ geometry ต่อชิ้น) และใช้ material
 * ร่วมกันตามสี ชิ้นส่วนบนจอราวสามสิบชิ้นจึงกินแค่ material ห้าหกตัว
 */
function LaptopScreen({ mode }: { mode: ScreenMode }) {
  const { geo, mats, dim } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1)
    const make = (color: string) => new THREE.MeshBasicMaterial({ color, toneMapped: false })
    const mats = {
      screen: new THREE.MeshStandardMaterial({ color: C.screen, roughness: 0.4 }),
      pane: make('#3a10a0'),
      chrome: make('#2b0a7d'),
      code: Object.fromEntries(
        [C.orange, C.lavender, C.white, C.screenBand].map((c) => [c, make(c)]),
      ) as Record<string, THREE.MeshBasicMaterial>,
      phone: make(C.white),
      phoneScreen: make('#e3e6ee'),
      accent: make(C.orange),
      soft: make(C.lavender),
      grey: make(C.grey),
    }
    // แผ่นหรี่ของสองฝั่ง — คนละตัวกัน เพราะค่า opacity วิ่งสวนทางกัน
    const dim = {
      code: new THREE.MeshBasicMaterial({ color: '#150348', transparent: true, opacity: 0 }),
      app: new THREE.MeshBasicMaterial({ color: '#150348', transparent: true, opacity: 0 }),
    }
    return { geo, mats, dim }
  }, [])

  useEffect(
    () => () => {
      geo.dispose()
      mats.screen.dispose()
      mats.pane.dispose()
      mats.chrome.dispose()
      for (const m of Object.values(mats.code)) m.dispose()
      mats.phone.dispose()
      mats.phoneScreen.dispose()
      mats.accent.dispose()
      mats.soft.dispose()
      mats.grey.dispose()
      dim.code.dispose()
      dim.app.dispose()
    },
    [geo, mats, dim],
  )

  // สลับโหมดแล้วให้ค่อย ๆ หรี่ ไม่ใช่กระพริบทันที — แก้ opacity ที่ material ตรง ๆ
  // ไม่ผ่าน state ของ React (useFrame + setState = re-render หกสิบครั้งต่อวินาที)
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-9 * dt)
    const want = mode === 'dev' ? { code: 0, app: 0.55 } : { code: 0.55, app: 0 }
    dim.code.opacity += (want.code - dim.code.opacity) * k
    dim.app.opacity += (want.app - dim.app.opacity) * k
  })

  /**
   * ผังสองฝั่งวัดจากขอบจอเข้ามา ไม่ใช่จากกึ่งกลางออกไป
   *
   * ของเดิมตั้งจุดกึ่งกลางของหน้าต่างโค้ดที่ -SCREEN_W/4 แล้วให้ความกว้างเกินครึ่งจอ
   * ขอบซ้ายของหน้าต่างจึงเลยขอบจอออกไปราว 0.33 หน่วย ที่นี่จึงหาขอบซ้าย/ขวาที่ใช้ได้ก่อน
   * แล้วแบ่งช่องจากขอบนั้น — ทั้งสองฝั่งอยู่ในจอเสมอ ต่อให้ขนาดจอเปลี่ยน
   */
  const PANE_PAD = 0.22
  const PANE_GAP = 0.18
  const PHONE_W = 1.72
  const left = -SCREEN_W / 2 + PANE_PAD
  const right = SCREEN_W / 2 - PANE_PAD
  const codeW = right - left - PANE_GAP - PHONE_W
  const codeX = left + codeW / 2
  const appX = right - PHONE_W / 2
  const paneH = SCREEN_H - 2 * PANE_PAD

  return (
    <group position={[0, LID_H / 2, 0]}>
      <RoundedBox args={[BASE_W, LID_H, LID_T]} radius={0.06} smoothness={3} castShadow receiveShadow>
        {mat(C.gold)}
      </RoundedBox>
      <mesh position={[0, 0.1, Z]} geometry={geo} material={mats.screen} scale={[SCREEN_W, SCREEN_H, 1]} />

      {/* ── ฝั่งซ้าย: หน้าต่างโค้ด ─────────────────────────────────────── */}
      <group position={[codeX, 0.1, 0]}>
        <Bar geo={geo} mat={mats.pane} x={0} y={0} w={codeW} h={paneH} z={Z + 0.01} />
        {/* แถบหัวหน้าต่าง + จุดสามจุดมุมซ้าย เหมือนหน้าต่างโปรแกรม */}
        <Bar geo={geo} mat={mats.chrome} x={0} y={paneH / 2 - 0.16} w={codeW} h={0.32} z={Z + 0.02} />
        {[0, 1, 2].map((i) => (
          <Bar
            key={i}
            geo={geo}
            mat={i === 0 ? mats.accent : mats.soft}
            x={-codeW / 2 + 0.2 + i * 0.18}
            y={paneH / 2 - 0.16}
            w={0.1}
            h={0.1}
            z={Z + 0.03}
          />
        ))}
        {CODE_LINES.map(([indent, w, color], i) => (
          <Bar
            key={i}
            geo={geo}
            mat={mats.code[color]}
            x={-codeW / 2 + 0.24 + indent + w / 2}
            y={paneH / 2 - 0.62 - i * 0.3}
            w={w}
            h={0.11}
            z={Z + 0.03}
          />
        ))}
        <Bar geo={geo} mat={dim.code} x={0} y={0} w={codeW} h={paneH} z={Z + 0.05} />
      </group>

      {/* ── ฝั่งขวา: ซิมมือถือ ────────────────────────────────────────── */}
      <group position={[appX, 0.1, 0]}>
        <RoundedBox
          args={[PHONE_W, paneH, 0.06]}
          radius={0.14}
          smoothness={3}
          position={[0, 0, Z + 0.03]}
        >
          <primitive object={mats.phone} attach="material" />
        </RoundedBox>
        <Bar geo={geo} mat={mats.phoneScreen} x={0} y={0} w={PHONE_W - 0.22} h={paneH - 0.3} z={Z + 0.07} />
        {/* รอยบากบนสุด แล้วไล่ลงมา: หัวแอป การ์ดใหญ่ สองการ์ดเล็ก แถบเมนูล่าง */}
        <Bar geo={geo} mat={mats.grey} x={0} y={paneH / 2 - 0.26} w={0.42} h={0.08} z={Z + 0.08} />
        <Bar geo={geo} mat={mats.accent} x={0} y={paneH / 2 - 0.62} w={PHONE_W - 0.22} h={0.42} z={Z + 0.08} />
        <Bar geo={geo} mat={mats.soft} x={0} y={paneH / 2 - 1.28} w={1.3} h={0.7} z={Z + 0.08} />
        {[-0.34, 0.34].map((x) => (
          <Bar key={x} geo={geo} mat={mats.grey} x={x} y={paneH / 2 - 2.0} w={0.62} h={0.46} z={Z + 0.08} />
        ))}
        <Bar geo={geo} mat={mats.chrome} x={0} y={-paneH / 2 + 0.34} w={PHONE_W - 0.22} h={0.34} z={Z + 0.08} />
        {[-0.42, 0, 0.42].map((x) => (
          <Bar key={x} geo={geo} mat={mats.phone} x={x} y={-paneH / 2 + 0.34} w={0.16} h={0.16} z={Z + 0.09} />
        ))}
        <Bar geo={geo} mat={dim.app} x={0} y={0} w={PHONE_W + 0.08} h={paneH + 0.06} z={Z + 0.11} />
      </group>
    </group>
  )
}

/* ── คีย์บอร์ด ───────────────────────────────────────────────────────────── */

const KB_COLS = 10
const KB_ROWS = 4
const KB_KEY = 0.33
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
  [-4.0, -1.9, 1.3],
  [-3.1, 3.4, 0.72],
  [2.7, 8.2, 1.05],
  [4.8, -2.3, 0.9],
  [6.8, 5.2, 0.55],
]
const BUSHES: [number, number, number][] = [
  [-2.3, 5.7, 1.15],
  [7.9, 2.5, 0.7],
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
 * ระยะที่ฝาจอถูกยกขึ้น วัดในสเปซของฝาจอเอง (ซึ่งเอนอยู่ -LID_TILT)
 * ตัวเครนที่ยืนคร่อมขอบฝาจออยู่ใช้ค่าเดียวกันนี้แปลงเป็นพิกัดฉาก — ขึ้นพร้อมกันเป๊ะ
 */
export const LIFT_TRAVEL = 0.72
/** ระยะยกในพิกัดฉาก (แกน y กับ z) — ฝาจอเอน ทางขึ้นจึงไม่ใช่แกน y ล้วน */
const LIFT_UP = LIFT_TRAVEL * Math.cos(LID_TILT)
const LIFT_BACK = -LIFT_TRAVEL * Math.sin(LID_TILT)

/**
 * มุมพักของคาน (เรเดียน)
 *
 * วัดจากภาพอ้างอิงเป็น "มุมบนจอ" ไม่ใช่มุมในฉาก: ในภาพคานพุ่งขึ้นทางขวาราว 35°
 * ตอนนี้ Chunk ของเครนหมุนรอบ y 90° แล้ว คานจึงกางไปทาง -z ของฉาก ซึ่งฉายลงจอเป็น
 * ขวา-บน 30° อยู่แล้ว มุมเชิดในฉากที่ให้ผล 35° บนจอจึงเหลือแค่ ~0.11
 * (ก่อนหมุน Chunk ค่าเดียวกันนี้คือ 0.79 — มุมบนจอไม่ได้ขึ้นกับตัวเลขนี้ตัวเดียว)
 */
const CRANE_REST = 0.11
/**
 * คานงัดขึ้นอีกเท่าไรตอนยกสุด
 *
 * ตัวเครนยืนคร่อมขอบฝาจอ มันจึงขึ้นไปกับฝาจอเต็มระยะอยู่แล้ว (ดู CranePull) ค่านี้คือ
 * "แรงที่ออกเพิ่ม" ไม่ใช่ระยะยกอีกชุด — ปลายคานขยับขึ้นราว 0.14 หน่วยฉาก หรือ 20% ของ
 * ระยะที่ฝาจอขึ้น ถ้าตั้งมากกว่านี้ปลายคานจะแซงฝาจอ อ่านเป็นสองชิ้นที่ขยับกันคนละจังหวะ
 */
const CRANE_PULL = 0.085
/** ตำแหน่งสลักที่คานหมุนรอบ */
const ELBOW_Y = 2.05

/**
 * เครนที่ยื่นเข้ามาจากมุมขวาบน — ถอดจากภาพอ้างอิงทีละชิ้น
 *
 * โครงในภาพคือ: ลูกบาศก์ม่วงอ่อนวางคร่อมขอบบนของฝาจอ → เสา "กลม" ตั้งขึ้นจากลูกบาศก์
 * → ปลายเสาเป็นหูยึดเทาสองแผ่นประกบกัน แต่ละแผ่นเป็นแผ่นแบนปลายมนเจาะรูสลักม่วงสองรู
 * → คานหนาปลายมนพุ่งเฉียงขึ้นทางขวาออกนอกเฟรม โดยมีข้อหมุนกลมอยู่ในหูยึด
 *
 * rig มีจุดเดียว: สลักที่ปลายเสา คานงัดขึ้น–ลงรอบสลักนั้น เสากับหัวจับเป็นชิ้นแข็งไม่ยืดหด
 * (เคยมีกระบอกไฮดรอลิกกับเสาที่หดได้ — ถอดออกแล้ว ไม่ใช่กลไกที่แบบต้องการ)
 */
function Crane() {
  const beam = useRef<THREE.Group>(null)

  const g = useMemo(
    () => ({
      pin: new THREE.CylinderGeometry(0.09, 0.09, 0.46, 12),
    }),
    [],
  )
  useEffect(
    () => () => {
      for (const geo of Object.values(g)) geo.dispose()
    },
    [g],
  )

  useFrame(() => {
    const b = beam.current
    if (!b) return
    b.rotation.z = CRANE_REST + idle.lift * CRANE_PULL
  })

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

      {/* หูยึด: แผ่นเทาแบนปลายมนสองแผ่นประกบคาน แต่ละแผ่นเจาะรูสลักม่วงสองรู */}
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

      {/* จุด rig เดียวของเครน: คานทั้งอันหมุนรอบสลักนี้ */}
      <group ref={beam} position={[0, ELBOW_Y, 0]} rotation={[0, 0, CRANE_REST]}>
        <mesh castShadow>
          <sphereGeometry args={[0.28, 18, 12]} />
          {mat(C.purpleLight)}
        </mesh>
        {/* สลักทะลุหูยึดทั้งสองแผ่น — หัวสลักโผล่ออกมาสองข้าง */}
        <mesh geometry={g.pin} rotation={[Math.PI / 2, 0, 0]} castShadow>
          {mat(C.grey)}
        </mesh>
        {/* แคปซูล = แท่งปลายมนจริง ไม่ต้องเอาทรงกลมไปแปะหัวเอง
            ยาวเท่าที่แบบให้มา: ปลายคานจบในเฟรม ไม่ได้พุ่งออกนอกจอ */}
        <mesh position={[1.55, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.26, 2.7, 6, 16]} />
          {mat(C.purpleLight)}
        </mesh>
        {/* รูที่ปลายคาน (จุดคล้องของ) — เจาะจริงไม่ได้ ใช้แผ่นสีเข้มฝังลงไปทั้งสองหน้าแทน */}
        {[0.255, -0.255].map((z) => (
          <mesh key={z} position={[2.72, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
            {mat(C.purpleMid)}
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ── ท่าเดินเองของฉาก ────────────────────────────────────────────────────
   ทุกตัวข้างล่างขยับ "ลูก" ของ RigidBody ไม่ใช่ตัว RigidBody เอง — collider ถูกคิดตอน
   mount การขยับ body ตรง ๆ จะทำให้กล่องชนไม่ตรงตัวตอนฉากระเบิด ท่าพวกนี้จึงเป็นภาพล้วน
   และคลายกลับเป็นศูนย์เองเมื่อ idle.active ลง (ดู heroIdle) */

/** ฝาจอถูกเครนยกขึ้น–ลง */
function ScreenLift({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    g.position.y = idle.lift * LIFT_TRAVEL
    // เอนตามนิดหน่อยเหมือนถูกดึงที่ขอบบน ไม่ใช่ยกขึ้นตรง ๆ ทั้งแผ่น
    g.rotation.x = idle.lift * -0.05
  })
  return <group ref={ref}>{children}</group>
}

/**
 * บันไดเอนไปข้างหลังเท่าไรตอนเครนออกแรง (เรเดียน)
 * บวก = เอนออกจากจอมาทางหน้าฉาก (บันไดเอนอยู่แล้วที่ ladderTilt ติดลบ ค่าบวกจึงคือ "ถอยหลัง")
 */
const LADDER_LEAN = 0.13

/**
 * บันไดเอนไปทางด้านหลัง (พิงเข้าหาจอ) ตอนเครนออกแรง แล้วคืนตัวเอง — ไม่ใช่การสั่น
 * คนที่ปีนอยู่ใช้ตัวเดียวกันนี้ครอบ จึงเอนไปพร้อมกันทั้งบันไดและคน
 */
function LadderLean({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    g.rotation.x = idle.alarm * LADDER_LEAN
  })
  return <group ref={ref}>{children}</group>
}

/**
 * เครนทั้งตัวยืนคร่อมขอบฝาจอ จึงขึ้น–ถอยไปกับฝาจอทุกหน่วย แล้วไหวเบา ๆ ตอนออกแรง
 * ส่วนการงัดขึ้นอยู่ที่คาน (ดู Crane) ไม่ใช่ตรงนี้
 *
 * ระยะยกคิดในพิกัด "ฉาก" แต่กลุ่มนี้อยู่ใต้ Chunk ที่ถูกหมุนไว้ (ท่าวางมาจากโหมดจัดฉาก)
 * จึงต้องแปลงกลับเป็นพิกัดของ Chunk ก่อนเสมอ ไม่งั้นเครนจะเลื่อนไปคนละแกนกับฝาจอ
 */
function CranePull({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const off = useMemo(() => new THREE.Vector3(), [])
  const inv = useMemo(() => new THREE.Quaternion(), [])

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    const sway = Math.sin(t * 1.7) * 0.02 * idle.active + Math.sin(t * 11) * 0.012 * idle.lift
    off.set(0, idle.lift * LIFT_UP + sway, idle.lift * LIFT_BACK)
    if (g.parent) g.position.copy(off.applyQuaternion(inv.copy(g.parent.quaternion).invert()))
    else g.position.copy(off)
  })

  return <group ref={ref}>{children}</group>
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
  screenMode = 'design',
}: {
  children?: ReactNode
  onCrane?: ReactNode
  onLadder?: ReactNode
  /** โหมดของจอแล็ปท็อป — มาจาก toolbar ของหน้า */
  screenMode?: ScreenMode
}) {
  const shared = useMemo<Shared>(
    () => ({
      cone: new THREE.ConeGeometry(0.34, 1, 14),
      coneBand: new THREE.CylinderGeometry(0.22, 0.26, 0.18, 14),
      coneBase: new THREE.BoxGeometry(0.7, 0.12, 0.7),
      canopy: new THREE.SphereGeometry(0.66, 14, 10),
      trunk: new THREE.CylinderGeometry(0.15, 0.16, 0.9, 10),
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
      <IdleDriver />
      {/* ทุกชิ้นห่อด้วย <Chunk> = RigidBody หนึ่งก้อน ตำแหน่งตั้งต้นย้ายมาไว้ที่ Chunk
          ไม่ใช่ที่ตัวชิ้น เพราะเวลาระเบิดของต้องหมุนรอบตัวเอง ไม่ใช่เหวี่ยงรอบกลางฉาก */}
      <Chunk name="laptop-base" position={LAPTOP}>
        <LaptopBase />
      </Chunk>
      {/* ฝาจอวางที่บานพับ = ขอบหลังของฐาน แล้วเอนด้วย rotation ของ Chunk เอง */}
      <Chunk
        name="laptop-screen"
        position={[LAPTOP[0], LAPTOP[1] + BASE_H, LAPTOP[2] - BASE_D / 2]}
        rotation={[-LID_TILT, 0, 0]}
      >
        <ScreenLift>
          <LaptopScreen mode={screenMode} />
        </ScreenLift>
      </Chunk>

      <Chunk name="ladder" position={[1.6, BASE_H, 0.2]} rotation={[ladderTilt, 0.06, 0]}>
        <LadderLean>
          <Ladder />
        </LadderLean>
      </Chunk>
      {/* คนปีนบันไดสั่นไปกับบันไดด้วยแรงเท่ากัน — คนละ Chunk กัน แต่ท่าเดียวกัน */}
      <Chunk name="climber" position={[1.5, -1.4, 0.4]} rotation={[ladderTilt, 0.06, 0]} mascot>
        <LadderLean>
          <group position={[0, 4.2, 0.45]}>{onLadder}</group>
        </LadderLean>
      </Chunk>

      {/* ท่าวางมาจากโหมดจัดฉาก — LID_TOP_Y - 0.25 คือ 4.6 ที่ผูกกับความสูงฝาจอจริง
          มุมที่ลากมาเอง [-1.56, 1.55, 1.58] เพี้ยนจากแกนไอโซอยู่ 1.65° จับให้ตรงแกนพอดี:
          ค่านั้นเทียบเท่าการหมุนรอบแกน y 90° ล้วน ๆ (x ของเครนไปทาง -z ของฉาก) */}
      <Chunk name="crane" position={[-1.0, LID_TOP_Y - 0.25, -2.4]} rotation={[0, Math.PI / 2, 0]}>
        <CranePull>
          <Crane />
        </CranePull>
      </Chunk>
      {/* คนถือโทรโข่งยืนอยู่บนขอบบนของฝาจอทางขวา ตามภาพอ้างอิง ไม่ได้ห้อยอยู่กับเครน */}
      <Chunk name="megaphone" position={[4.3, LID_TOP_Y, -2.2]} mascot>
        {onCrane}
      </Chunk>

      {/* คีย์บอร์ดวางทับอยู่บนฐานแล็ปท็อป เลยขอบหน้าขวาออกไปครึ่งตัวตามภาพอ้างอิง
          ไม่ใช่วางแยกอยู่บนพื้น */}
      {/* คีย์บอร์ดในภาพอ้างอิงวางเฉียงอยู่หน้าฐาน ปลายบนซุกใต้ขอบฐาน ไม่ได้อยู่บนฐานทั้งตัว */}
      <Chunk name="keyboard" position={[4.5, BASE_H, 1.5]} rotation={[0, -0.5, 0]}>
        <Keyboard />
      </Chunk>
      <Chunk name="mouse" position={[2.4, BASE_H, 2.3]} rotation={[0, -0.3, 0]}>
        <Mouse />
      </Chunk>

      <Chunk name="cone-desk" position={[-1.3, BASE_H, -0.2]}>
        <Cone g={shared} />
      </Chunk>
      <Chunk name="cone-left" position={[3.8, 0, 4.5]}>
        <Cone g={shared} />
      </Chunk>
      {/* กรวยล้มนอนกับพื้น — จัดท่าจากโหมด debug */}
      <Chunk name="cone-front" position={[1.5, 0.3, 4.1]} rotation={[-2.93, -0.97, 1.61]}>
        <Cone g={shared} />
      </Chunk>

      <Chunk name="rolls" position={[-0.2, 0, 5.7]} rotation={[0, -0.35, 0]}>
        <Rolls g={shared} />
      </Chunk>
      <Chunk name="ruler" position={[6.9, 0, -1.5]} rotation={[0, -0.35, 0]}>
        <Ruler />
      </Chunk>

      <Chunk name="puzzle-left" position={[4.8, 0, 6.6]} rotation={[0, 0.35, 0]}>
        <Puzzle />
      </Chunk>
      <Chunk name="puzzle-right" position={[6.5, 0, 0]} rotation={[0, -0.5, 0]}>
        <Puzzle />
      </Chunk>

      {/* ต้นไม้ในภาพอ้างอิงมีไม่กี่ต้นและอยู่ห่างกัน — กระจุกซ้ายสามต้น ขวาสองต้น
          กับพุ่มเตี้ยอีกสองก้อน มากกว่านี้ฉากจะแน่นจนของหลักจม */}
      {TREES.map(([x, z, sc], i) => (
        <Chunk key={i} name={`tree-${i}`} position={[x, 0, z]}>
          <Tree g={shared} scale={sc} seed={i + 1} />
        </Chunk>
      ))}
      {BUSHES.map(([x, z, sc], i) => (
        <Chunk key={i} name={`bush-${i}`} position={[x, 0, z]}>
          <Bush g={shared} scale={sc} seed={i + 7} />
        </Chunk>
      ))}

      {children}
    </group>
  )
}
