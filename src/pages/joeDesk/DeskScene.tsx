import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HeroRider } from '@/newhero/HeroRider'
import { HeroLights } from '@/newhero/heroLights'

/**
 * โต๊ะทำงานของ /joe-desk เป็นฉาก 3D — ปั้นตามภาพประกอบไอโซเมตริกของ Figma "Joe-Space" (hero-section 751:2682 + mascot 751:4574)
 *
 * ### พิกัด
 * กล้องออร์โธไอโซเมตริกแท้ (มองตามทิศ -(1,1,1)) · ซูม = สเกลของเวทีหน้า → 1 หน่วยโลก = 1 px ของดีไซน์ (ที่ k = 1)
 * จุด (0,0,0) อยู่กลางเวที 1440×800 · ตำแหน่งทุกชิ้นวัดจากพิกัดพิกเซลใน Figma แล้วแปลงกลับเป็นโลกด้วย `iso()`
 * (รู้ความสูง y ของจุดนั้น → ได้ x z) — ของจึงทาบภาพดีไซน์
 *   +x = ลงขวาบนจอ · -z = ขึ้นขวา · y = ขึ้น · ท็อปโต๊ะ = y 0
 *
 * ### สี
 * สีแบนตามดีไซน์ต่อหน้า (บน · หน้า +z · ข้าง +x) ไม่ใช้ไฟ — ภาพประกอบใน Figma ไม่มีแสงเงาไล่ มีแต่สีต่อหน้า
 */
/**
 * มุมกล้องตามดีไซน์ — ไม่ใช่ไอโซเมตริกแท้ (30°)
 *
 * ชิ้นใน Figma วาดด้วย rotate(-33.69°) skewX(22.42°) scaleY(0.92) = แกนพื้นสองแกนเอียง 33.69° (ชัน 2:3) ยาวเท่ากัน
 * → กล้องออร์โธมุมราบ 45° ก้มลง φ โดย tan 33.69° = sin φ → φ ≈ 41.8° (ไอโซแท้คือ 35.26°)
 * ส่วนสูงบนจอหดเหลือ cos φ ≈ 0.745 ของความยาวจริง
 */
const S2 = Math.SQRT2
const SIN = 2 / 3
const COS = Math.sqrt(1 - SIN * SIN)
/** ทิศกล้อง (จากเป้าไปหากล้อง) */
const CAM_DIR: [number, number, number] = [COS / S2, SIN, COS / S2]
/** px ของดีไซน์ (เวที 1440×800) + ความสูง → จุดในโลก */
function iso(px: number, py: number, y: number): [number, number, number] {
  const sx = px - 720
  const sy = py - 400
  const sum = (S2 * (sy + COS * y)) / SIN
  return [(S2 * sx + sum) / 2, y, (sum - S2 * sx) / 2]
}
/** px ของดีไซน์ที่อยู่บนระนาบ x = X (ผิวหลังจอ) → จุดในโลก */
function isoOnX(px: number, py: number, X: number): [number, number, number] {
  const z = X - S2 * (px - 720)
  return [X, ((SIN * (X + z)) / S2 - (py - 400)) / COS, z]
}
/** ความสูงบนจอ (px) → ความสูงจริง */
const tall = (px: number) => px / COS

type Faces = { top: string; front: string; side: string; back?: string; bottom?: string; left?: string }
const matCache = new Map<string, THREE.MeshBasicMaterial>()
const mat = (c: string) => {
  let m = matCache.get(c)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: c })
    matCache.set(c, m)
  }
  return m
}
/** ลำดับหน้าของ BoxGeometry: +x −x +y −y +z −z */
const faceMats = (f: Faces) => [mat(f.side), mat(f.left ?? f.side), mat(f.top), mat(f.bottom ?? f.front), mat(f.front), mat(f.back ?? f.front)]
const BOX = new THREE.BoxGeometry(1, 1, 1)

/** กล่องจากมุมต่ำสุด (x0 y0 z0) + ขนาด — สีต่อหน้า */
function Box({ at, size, f }: { at: [number, number, number]; size: [number, number, number]; f: Faces }) {
  const m = useMemo(() => faceMats(f), [f])
  return <mesh geometry={BOX} material={m} position={[at[0] + size[0] / 2, at[1] + size[1] / 2, at[2] + size[2] / 2]} scale={size} />
}

/** แผ่นแบนมุมมน (แผ่นรองเมาส์) — ผิวบนสีหนึ่ง ขอบอีกสี */
function RoundSlab({ at, size, r, color, edge }: { at: [number, number, number]; size: [number, number, number]; r: number; color: string; edge: string }) {
  const geo = useMemo(() => {
    const [w, , d] = size
    const sh = new THREE.Shape()
    sh.moveTo(r, 0)
    sh.lineTo(w - r, 0)
    sh.quadraticCurveTo(w, 0, w, r)
    sh.lineTo(w, d - r)
    sh.quadraticCurveTo(w, d, w - r, d)
    sh.lineTo(r, d)
    sh.quadraticCurveTo(0, d, 0, d - r)
    sh.lineTo(0, r)
    sh.quadraticCurveTo(0, 0, r, 0)
    const g = new THREE.ExtrudeGeometry(sh, { depth: size[1], bevelEnabled: false, curveSegments: 8 })
    /* รูปวาดบนระนาบ xy → วางราบ (y ของรูป = z ของโลก) */
    g.rotateX(Math.PI / 2)
    g.translate(0, size[1], 0)
    return g
  }, [size, r])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={[mat(color), mat(edge)]} position={at} />
}

const C = {
  deskTop: { top: '#ffdba7', front: '#ffb140', side: '#ffb140' },
  leg: { top: '#ffffff', front: '#ffffff', side: '#dadada' },
  mat: { top: '#2d313d', front: '#454545', side: '#454545' },
  keyboard: { top: '#353535', front: '#111111', side: '#111111' },
  mouse: { top: '#ffffff', front: '#e6e6e6', side: '#d4d4d4' },
  counter: { top: '#ffcb80', front: '#ffb140', side: '#ffb140' },
  drawer: { top: '#ffd396', front: '#ffcb80', side: '#ffb140' },
  /* หน้าตู้ส้มเข้ม = เส้นร่องระหว่างลิ้นชัก */
  carcass: { top: '#ffcb80', front: '#ffa31f', side: '#f5a93a' },
  /* มือจับรูปตัว C: แท่งบนขาว หน้าส้ม · ขาสองข้างเทา */
  handleBar: { top: '#f7f7f7', front: '#ff9d0a', side: '#e6e6e6' },
  handleLeg: { top: '#eeeeee', front: '#c9c9c9', side: '#dadada' },
  white: { top: '#ffffff', front: '#ffffff', side: '#ffffff' },
  monitor: { top: '#f2f2f2', front: '#d9d9d9', side: '#e8e8e8' },
  monitorInset: { top: '#d0d0d0', front: '#d0d0d0', side: '#d6d6d6' },
  dark: { top: '#3a3a3a', front: '#2a2a2a', side: '#333333' },
  tray: { top: '#2a2b2f', front: '#1b1b1d', side: '#1b1b1d' },
  machine: { top: '#f0f0f1', front: '#bdbec0', side: '#e4e5e6' },
  spout: { top: '#4a4a4a', front: '#2b2b2b', side: '#363636' },
  stand: { top: '#f2f2f2', front: '#d0d0d0', side: '#e6e6e6' },
  standBase: { top: '#e3e3e3', front: '#bdbdbd', side: '#cfcfcf' },
  holder: { top: '#5b67c9', front: '#3c47a3', side: '#4752b5' },
  eye: { top: '#262424', front: '#262424', side: '#262424' },
  skin: { top: '#ecb097', front: '#ecb097', side: '#d2947a', left: '#d2947a' },
  hair: { top: '#2b2b2e', front: '#1c1c1e', side: '#232325', left: '#232325' },
  sleeve: { top: '#ede2cf', front: '#d8c9b0', side: '#d8c9b0' },
}

/**
 * ท็อปโต๊ะ: มุมหน้าซ้ายในดีไซน์ (805, 652) · ขอบซ้ายวิ่งขึ้นขวาถึง (1130, 460) = ลึก 460 ชนผนัง · กว้างเลยขอบเฟรมลงขวา
 * ตู้ลิ้นชักเป็นตู้แขวนผนังเหนือโต๊ะ (หน้าตู้อยู่ระนาบผนังเดียวกับขอบหลังโต๊ะ) — ใต้ตู้ฝั่งซ้ายของโต๊ะจึงโล่ง
 */
const DESK_F = iso(805, 652, 0)
const DESK = { x0: DESK_F[0], z0: DESK_F[2] - 460, z1: DESK_F[2], w: 900, t: 14 }
const CAB_Z = DESK.z0

function Desk() {
  const leg = iso(941, 715, -DESK.t)
  return (
    <group>
      <Box at={[DESK.x0, -DESK.t, DESK.z0]} size={[DESK.w, DESK.t, DESK.z1 - DESK.z0]} f={C.deskTop} />
      {/* ขาโต๊ะหน้า: แผ่นขาว + ด้านเงาเทา (ลงพ้นขอบเฟรม) */}
      <Box at={[leg[0], -620, leg[2] - 46]} size={[40, 620 - DESK.t, 46]} f={C.leg} />
    </group>
  )
}

/** แผ่นรองกรมดำ + คีย์บอร์ด + เมาส์ */
function DeskTop() {
  const m = iso(905, 642, 1)
  const kb = iso(1268, 496, 3)
  const ms = iso(1062, 578, 3)
  return (
    <group>
      <RoundSlab at={[m[0], 0, m[2] - 520]} size={[640, 3, 520]} r={26} color={C.mat.top} edge={C.mat.front} />
      <Box at={[kb[0] - 70, 3, kb[2] - 150]} size={[140, 10, 300]} f={C.keyboard} />
      <Box at={[ms[0] - 40, 3, ms[2] - 22]} size={[80, 16, 44]} f={C.mouse} />
      <Box at={[ms[0] - 6, 19, ms[2] - 2]} size={[22, 2, 4]} f={C.keyboard} />
    </group>
  )
}

/** วงไฟ RGB หลังจอ — ไล่สีวน (ฟ้า → เขียว → ชมพู → ม่วง) */
function useRingTexture() {
  return useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 256
    const g = cv.getContext('2d')!
    const grd = g.createConicGradient(-Math.PI / 2, 128, 128)
    ;(
      [
        [0, '#3fc1ff'],
        [0.22, '#38e08c'],
        [0.45, '#b8f24a'],
        [0.55, '#ff4fd8'],
        [0.78, '#8b5cff'],
        [1, '#3fc1ff'],
      ] as const
    ).forEach(([o, c]) => grd.addColorStop(o, c))
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 256)
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

/**
 * จอ (ในกลุ่ม mascot ของ Figma): หลังจอหันหาคนดู (+x) แผงยาวตามแนว -z · ขอบซ้ายหนา ~13px บนจอ
 * วงไฟ RGB กลาง (1368, 445) · ขาตั้งเทาอ่อนตั้งขึ้นหน้าแผง (1380–1440, 415–715) บังขวาของวงไฟ · ฐานแผ่นบนโต๊ะ
 */
const MON_B = iso(1142, 697, 110)
const MON_H = tall(244)
const MON_L = 440
function Monitor({ screen = null }: { screen?: THREE.Texture | null }) {
  const ring = useRingTexture()
  useEffect(() => () => ring.dispose(), [ring])
  const b = MON_B
  const H = MON_H
  const L = MON_L
  const T = 18
  const backX = b[0] + T
  const rc = isoOnX(1368, 445, backX)
  /* ขาตั้ง: ขอบซ้ายที่ x จอ 1380 ห่างหลังจอ 24 · กว้าง 70 ตามแนว -z · สูงถึงพิกเซล 415 */
  const nx = backX + 24
  const nz = nx - S2 * (1380 - 720)
  const nTop = ((SIN * (nx + nz)) / S2 - (415 - 400)) / COS
  const base = iso(1350, 690, 0)
  return (
    <group>
      <Box at={[b[0], b[1], b[2] - L]} size={[T, H, L]} f={C.monitor} />
      {/* หน้าจอ (ฝั่ง -x หาคนนั่ง) — ปกติมืด · เรื่องหลังบท Code ฉายภาพลงที่นี่ (screen) */}
      <mesh position={[b[0] - 0.6, b[1] + H / 2, b[2] - L / 2]} rotation={[0, -Math.PI / 2, 0]} scale={[L - 24, H - 24, 1]}>
        <planeGeometry />
        {screen ? <meshBasicMaterial map={screen} toneMapped={false} /> : <meshBasicMaterial color="#15161b" />}
      </mesh>
      {/* แผงเว้าล่างหลังจอ */}
      <Box at={[backX, b[1] + 8, b[2] - 300]} size={[1, 120, 300]} f={C.monitorInset} />
      {/* ร่องดำพาดบน */}
      <Box at={[backX, b[1] + H - 34, b[2] - L + 60]} size={[2, 5, L - 120]} f={C.dark} />
      <group position={[backX + 2, rc[1], rc[2]]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <circleGeometry args={[84, 48]} />
          <meshBasicMaterial color="#26272b" />
        </mesh>
        <mesh position={[0, 0, 0.5]}>
          <ringGeometry args={[58, 74, 64]} />
          <meshBasicMaterial map={ring} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 1]}>
          <circleGeometry args={[50, 40]} />
          <meshBasicMaterial color="#38393e" />
        </mesh>
        <mesh position={[8, 0, 1.5]}>
          <ringGeometry args={[18, 30, 32, 1, -Math.PI / 2, Math.PI]} />
          <meshBasicMaterial color="#7a7b80" />
        </mesh>
      </group>
      {/* ขาตั้ง + ฐาน */}
      <Box at={[nx, 0, nz - 70]} size={[30, nTop, 70]} f={C.stand} />
      <Box at={[base[0] - 50, 0, base[2] - 40]} size={[100, 5, 80]} f={C.standBase} />
    </group>
  )
}

/**
 * ตู้ลิ้นชักหลังโต๊ะ: สามคอลัมน์ สี่แถว (หน้าตู้หันหาคนดู) · ท็อปเคาน์เตอร์ส้มอ่อน ขอบหน้ามีเส้นขาว
 *
 * ตู้ใน Figma วาดเอียง 27° (ชัน 0.51) ไม่ใช่ 33.7° แบบโต๊ะ — นักวาดใช้มุมต่อชิ้นไม่เท่ากัน
 * หมุนตู้รอบมุมล่างซ้ายไป CAB_ROT ให้เส้นแนวนอนของตู้บนจอเอียงเท่าดีไซน์ (เส้นตั้งยังตั้งตรง)
 *   ชัน = sinφ · (cosθ + sinθ)/(cosθ − sinθ) → 0.51 ที่ θ ≈ 7.6°
 */
const CAB_ROT = 0.1326
const CAB_X0 = CAB_Z + S2 * (870 - 720)
/** ความสูงจริงของจุดบนหน้าตู้ (ระยะ u ตามแนวตู้จากมุมซ้าย) ที่ไปตกพิกเซล py */
const cabY = (u: number, py: number) => {
  const wx = CAB_X0 + u * Math.cos(CAB_ROT)
  const wz = CAB_Z - u * Math.sin(CAB_ROT)
  return ((SIN * (wx + wz)) / S2 - (py - 400)) / COS
}
/* คอลัมน์กว้าง 173 px บนจอ (หักผลการหมุนตู้) */
const CAB_COLW = (173 * S2) / (Math.cos(CAB_ROT) + Math.sin(CAB_ROT))
/* ใต้ตู้ที่มุมซ้าย (870, 232) · ขอบบนตู้ผ่าน (1041, 37) ที่เส้นแบ่งคอลัมน์แรก */
const CAB = { colW: CAB_COLW, rows: 4, y0: cabY(0, 232), top: cabY(CAB_COLW, 37), depth: 260 }
const CAB_ROWH = (CAB.top - CAB.y0) / CAB.rows
const CAB_TOP = CAB.top
function Cabinet() {
  const w = CAB.colW * 3
  return (
    <group position={[CAB_X0, 0, CAB_Z]} rotation={[0, CAB_ROT, 0]}>
      <Box at={[0, CAB.y0, -CAB.depth]} size={[w, CAB.top - CAB.y0, CAB.depth]} f={C.carcass} />
      {Array.from({ length: 3 * CAB.rows }, (_, i) => {
        const c = i % 3
        const r = Math.floor(i / 3)
        const x = c * CAB.colW
        const y = CAB.y0 + r * CAB_ROWH
        const hx = x + CAB.colW * 0.5 - 40
        const hy = y + CAB_ROWH * 0.5 - 4
        return (
          <group key={i}>
            <Box at={[x + 1.6, y + 1.6, 0]} size={[CAB.colW - 3.2, CAB_ROWH - 3.2, 3]} f={C.drawer} />
            <Box at={[hx, hy, 15]} size={[80, 7, 6]} f={C.handleBar} />
            <Box at={[hx, hy, 3]} size={[7, 7, 12]} f={C.handleLeg} />
            <Box at={[hx + 73, hy, 3]} size={[7, 7, 12]} f={C.handleLeg} />
          </group>
        )
      })}
      {/* ท็อปเคาน์เตอร์ + เส้นขาวขอบหน้า */}
      <Box at={[-6, CAB.top, -CAB.depth - 420]} size={[w + 420, 12, CAB.depth + 424]} f={C.counter} />
      <Box at={[-6, CAB.top + 12, 2]} size={[w + 420, 2, 3]} f={C.white} />
    </group>
  )
}

/** ลายรูถาดหยด (จุดเรียงแถว) */
function useDots() {
  return useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 256
    cv.height = 128
    const g = cv.getContext('2d')!
    g.fillStyle = '#2f3034'
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = '#1c1d20'
    for (let y = 10; y < 128; y += 16) for (let x = 10 + ((y / 16) % 2) * 8; x < 256; x += 16) {
      g.beginPath()
      g.ellipse(x, y, 4.6, 4.6, 0, 0, Math.PI * 2)
      g.fill()
    }
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

/**
 * มุมกาแฟบนเคาน์เตอร์ — ตำแหน่งวัดจากพิกเซลใน Figma (ซูม):
 *   ถาด   มุมซ้าย (1167, 70) · มุมหน้า (1340, 191) · ลึก ~105 · ขอบหนา · ผิวบนเป็นรูจุด
 *   แก้ว  ก้นกลาง (1254, 98) สูง 107 รัศมี 33 หูซ้าย สีเทาอ่อน กาแฟเทาเข้ม
 *   เครื่อง หน้าล่างซ้าย (1290, 77) → หน้าล่างขวา (1413, 141) หน้าเทากลาง ข้างเทาอ่อน · หัวจ่ายดำทรงกระบอก (1331, 0–41)
 */
function Coffee() {
  const dots = useDots()
  useEffect(() => () => dots.dispose(), [dots])
  const top = CAB_TOP + 12
  const tt = top + 12
  const L = iso(1167, 70, tt)
  const F = iso(1340, 191, tt)
  const tw = F[0] - L[0]
  const td = 112
  /* ขอบล่างแก้วในดีไซน์อยู่ที่ y 98 → กลางก้นสูงขึ้นครึ่งวงรี */
  const mg = iso(1254, 98 - 33 * SIN, tt)
  const m0 = iso(1290, 77, tt)
  const m1 = iso(1413, 141, tt)
  const mw = Math.hypot(m1[0] - m0[0], m1[2] - m0[2])
  const mRot = Math.atan2(-(m1[2] - m0[2]), m1[0] - m0[0])
  /* หัวจ่าย: อยู่หน้าเครื่อง 80 หน่วย · ก้นที่พิกเซล (1331, 41) */
  const sz = m0[2] + 80
  const sx = sz + S2 * (1331 - 720)
  const sy = ((SIN * (sx + sz)) / S2 - (41 - 400)) / COS
  /* ที่วางแก้ว: อยู่หลังขอบซ้ายของตู้ (ตู้บังปลายขวาแบบในดีไซน์) — ถอยไปตามแนวสายตา จอยังเห็นที่เดิม */
  const h = iso(834, 156, top - 520)
  const HD = new THREE.Vector3(-1, 0, 1).normalize()
  return (
    <group>
      {/* ถาดหยด */}
      <Box at={[L[0], top, L[2] - td]} size={[tw, 12, td]} f={C.tray} />
      <mesh position={[L[0] + tw / 2, tt + 0.3, L[2] - td / 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[tw - 10, td - 10, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={dots} />
      </mesh>
      {/* แก้ว */}
      <mesh position={[mg[0], tt + 53, mg[2]]}>
        <cylinderGeometry args={[33, 31, 106, 36, 1, true]} />
        <meshBasicMaterial color="#d6d6d6" />
      </mesh>
      <mesh position={[mg[0], tt + 106.2, mg[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[27, 33, 36]} />
        <meshBasicMaterial color="#ececec" />
      </mesh>
      <mesh position={[mg[0], tt + 92, mg[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[31, 36]} />
        <meshBasicMaterial color="#707070" />
      </mesh>
      <mesh position={[mg[0] + HD.x * 32, tt + 58, mg[2] + HD.z * 32]} rotation={[0, -Math.PI / 4, 0]}>
        <torusGeometry args={[24, 8, 10, 24, Math.PI]} />
        <meshBasicMaterial color="#d0d0d0" />
      </mesh>
      {/* เครื่องชง (หมุนตามแนวตู้) */}
      <group position={[m0[0], tt, m0[2]]} rotation={[0, mRot, 0]}>
        <Box at={[0, 0, -260]} size={[mw, 460, 260]} f={C.machine} />
      </group>
      <mesh position={[sx, sy + 32, sz]}>
        <cylinderGeometry args={[17, 17, 64, 24]} />
        <meshBasicMaterial color="#232323" />
      </mesh>
      <Box at={[sx - 34, sy + 64, sz - 34]} size={[68, 16, 68]} f={C.spout} />
      {/* ที่วางแก้วสองช่อง (ลอยซ้ายของตู้) */}
      <group position={[h[0], h[1] - 40, h[2]]} scale={0.9}>
        <Box at={[-30, 0, -35]} size={[60, 26, 70]} f={C.holder} />
        {[-30, 30].map((d) => (
          <mesh key={`e${d}`} position={[d, 13, 0]}>
            <cylinderGeometry args={[35, 35, 26, 28]} />
            <meshBasicMaterial color={C.holder.side} />
          </mesh>
        ))}
        {[-30, 30].map((d) => (
          <mesh key={`t${d}`} position={[d, 26.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[35, 28]} />
            <meshBasicMaterial color={C.holder.top} />
          </mesh>
        ))}
        {[-26, 26].map((d) => (
          <mesh key={d} position={[d * 1.15, 27, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[22, 24]} />
            <meshBasicMaterial color="#323c8c" />
          </mesh>
        ))}
        {/* ป้ายขาวด้านหน้า */}
        <Box at={[-38, 8, 35]} size={[46, 6, 1.5]} f={C.white} />
      </group>
    </group>
  )
}

/** ต้นเฟิร์นริมหน้าโต๊ะ — ก้านโค้งขึ้นแล้วตกปลาย ใบย่อยรียาวเรียงคู่ตั้งฉากกับก้าน (แบบในดีไซน์) */
function Plant() {
  const p = iso(1122, 865, 0)
  const geo = useMemo(() => ({ leaf: new THREE.SphereGeometry(1, 10, 6), stem: new THREE.CylinderGeometry(1, 1, 1, 5) }), [])
  useEffect(
    () => () => {
      geo.leaf.dispose()
      geo.stem.dispose()
    },
    [geo],
  )
  const parts = useMemo(() => {
    const leaves: { p: THREE.Vector3; q: THREE.Quaternion; s: [number, number, number]; c: string }[] = []
    const stems: { p: THREE.Vector3; q: THREE.Quaternion; l: number }[] = []
    const N = 11
    const UPV = new THREE.Vector3(0, 1, 0)
    const at = (a: number, len: number, rise: number, t: number) =>
      new THREE.Vector3(Math.cos(a) * len * t, 60 + Math.sin(t * Math.PI * 0.8) * rise - t * t * 25, Math.sin(a) * len * t)
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + (i % 3) * 0.15
      const len = 70 + ((i * 37) % 5) * 8
      const rise = 80 + ((i * 13) % 4) * 14
      const M = 10
      for (let j = 0; j < M; j++) {
        const A = at(a, len, rise, j / M)
        const B = at(a, len, rise, (j + 1) / M)
        const d = B.clone().sub(A)
        stems.push({ p: A.clone().add(B).multiplyScalar(0.5), q: new THREE.Quaternion().setFromUnitVectors(UPV, d.clone().normalize()), l: d.length() })
        if (j < 1) continue
        const t = (j + 0.5) / M
        const dir = d.clone().normalize()
        const side = new THREE.Vector3().crossVectors(dir, UPV).normalize()
        const sz = 11 * (1 - t * 0.5)
        for (const sg of [-1, 1]) {
          const out = side.clone().multiplyScalar(sg)
          const lp = A.clone().add(B).multiplyScalar(0.5).addScaledVector(out, sz * 0.9)
          /* ใบรี: แกนยาว (x) ชี้ออกข้างก้าน เอียงขึ้นนิด */
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), out.clone().add(new THREE.Vector3(0, 0.35, 0)).normalize())
          leaves.push({ p: lp, q, s: [sz, 3, sz * 0.42], c: (i + j) % 3 ? '#a3cc3a' : '#74ad2c' })
        }
      }
    }
    return { leaves, stems }
  }, [])
  return (
    <group position={[p[0], 0, p[2]]}>
      <mesh position={[0, 35, 0]}>
        <cylinderGeometry args={[34, 28, 70, 24]} />
        <meshBasicMaterial color="#6b4a2c" />
      </mesh>
      {parts.stems.map((s, i) => (
        <mesh key={`s${i}`} geometry={geo.stem} material={mat('#6fa82b')} position={s.p} quaternion={s.q} scale={[1.6, s.l, 1.6]} />
      ))}
      {parts.leaves.map((l, i) => (
        <mesh key={i} geometry={geo.leaf} material={mat(l.c)} position={l.p} quaternion={l.q} scale={l.s} />
      ))}
    </group>
  )
}

/**
 * ตัวละครตัวเดียวกับ hero ของ /2026-final (HeroRider — ลายเสื้อ ผม หน้า ค่าจูนชุดเดียวกัน) ท่ายืน ไม่มีบอร์ด
 *
 * หน่วยของริกเป็นหน่วยฉาก hero (ตัวสูงราวหนึ่งหน่วย) — วัดกรอบจริงหลังโหลดแล้วย่อขยายให้สูง CHAR_H (หน่วยโลกของที่นี่
 * = px ของดีไซน์) ยืนหลังขอบโต๊ะ หันหน้าหาคนดูแบบในดีไซน์ · ช่วงใต้ท็อปโต๊ะตัดทิ้ง (ในดีไซน์เห็นแค่ครึ่งบน)
 */
const CHAR_H = tall(650)
/** ลำตัวตั้งตรง (ระบบท่าสเก็ตของริกเอนตัว/พับเอว/ก้มหัว — ที่โต๊ะต้องนั่งตรง) */
const UPRIGHT = { leanX: 0, leanZ: 0, foldX: 0, foldY: 0, foldZ: 0, headX: 0 }
const HEAD_TOP = 340
/**
 * ท่าตัวตาม Figma: หันเฉียงเข้าหาจอ (เห็นข้างแก้มซ้ายบนจอ) + โน้มตัวไปหน้าเหนือโต๊ะ
 * หมุนรอบระดับท็อปโต๊ะ (โคนตัว) — หัวยื่นมาหน้า ไหล่ค่อม
 */
const CHAR_YAW = 0.38
const CHAR_LEAN = -0.18
/*
 * ตัดใต้ท็อปโต๊ะลงไป 60 — ไม่ใช่ที่ระดับท็อปพอดี: ตัวยืนหลังขอบโต๊ะ เส้นตัดที่ระดับท็อปจึงลอยเห็นเหนือขอบ
 * ต่ำลง 60 = แนวสายตาจากเส้นตัดผ่านท็อปโต๊ะ (ขอบโต๊ะบังรอยตัดพอดี)
 */
const CLIP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 60)
const FIT_BOX = new THREE.Box3()
const FIT_V = new THREE.Vector3()
function Character() {
  const fit = useRef<THREE.Group>(null)
  const done = useRef(false)
  const gl = useThree((st) => st.gl)
  useEffect(() => {
    gl.localClippingEnabled = true
  }, [gl])
  useFrame(() => {
    const g = fit.current
    if (!g) return
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (!m) return
      ;(Array.isArray(m) ? m : [m]).forEach((mm) => {
        if (mm.clippingPlanes?.[0] !== CLIP) mm.clippingPlanes = [CLIP]
      })
    })
    /* ซ่อนแขนเดิมของริก (ห้อยข้างตัว) — ใช้แขนท่านั่งโต๊ะของ DeskArms แทน */
    for (const n of ['PointShoulder', 'MugShoulder']) {
      const o = g.getObjectByName(n)
      if (o) o.visible = false
    }
    if (done.current) return
    g.scale.setScalar(1)
    g.position.set(0, 0, 0)
    g.updateMatrixWorld(true)
    FIT_BOX.setFromObject(g)
    if (FIT_BOX.isEmpty()) return
    const size = FIT_BOX.getSize(FIT_V).y
    if (size < 1e-3) return
    const k = CHAR_H / size
    g.scale.setScalar(k)
    /* หัวบนสุดสูงจากท็อปโต๊ะ HEAD_TOP — เหนือขอบโต๊ะเห็นแค่หัวกับอก แบบในดีไซน์ */
    g.position.y = HEAD_TOP - FIT_BOX.max.y * k
    done.current = true
  })
  /*
   * กลางหัวในดีไซน์ (1048, 290) ที่ความสูง HEAD_TOP − 110 → ตำแหน่งยืน หลังขอบโต๊ะฝั่งซ้าย (x < ขอบโต๊ะ — ไม่ยืนบนโต๊ะ)
   * หันหน้าตรงกล้อง (45°)
   */
  const c = iso(1048, 250, HEAD_TOP - 110)
  return (
    <group position={[c[0], 0, c[2]]} rotation={[0, Math.PI / 4 + CHAR_YAW, 0]}>
      {/* เอนหลังรอบระดับท็อปโต๊ะ — กล้องก้ม 41.8° ส่วนในดีไซน์หน้าหันตรงคนดู */}
      <group rotation={[CHAR_LEAN, 0, 0]}>
      <group ref={fit}>
        <Suspense fallback={null}>
          <HeroRider noBoard noLean noLumber noWind noIdle face={false} torsoPose={UPRIGHT as never} />
        </Suspense>
      </group>
      </group>
      <DeskArms />
    </group>
  )
}

const UPV = new THREE.Vector3(0, 1, 0)
/** ท่อนแขนเหลี่ยมจากจุด a ไป b (หน่วยท้องถิ่นของตัวละคร — +z หาคนดู · +x ขวาบนจอ) */
function Limb({ a, b, w, f }: { a: [number, number, number]; b: [number, number, number]; w: number; f: Faces }) {
  const m = useMemo(() => faceMats(f), [f])
  const t = useMemo(() => {
    const A = new THREE.Vector3(...a)
    const B = new THREE.Vector3(...b)
    const d = B.clone().sub(A)
    return { p: A.add(B).multiplyScalar(0.5), q: new THREE.Quaternion().setFromUnitVectors(UPV, d.clone().normalize()), l: d.length() }
  }, [a, b])
  return <mesh geometry={BOX} material={m} position={t.p} quaternion={t.q} scale={[w, t.l, w]} />
}

/**
 * แขนท่านั่งโต๊ะตาม Figma (ริกของ hero จัดท่านี้ไม่ได้โดยไม่ให้ชิ้นแขนแยก — ย่อแขนเดิมทิ้งแล้วปั้นแขนบล็อกแทน
 * สีผิว/เสื้อชุดเดียวกับตัว hero): ต้นแขนเสื้อลงหาศอกบนโต๊ะทั้งสองข้าง
 *   ขวาบนจอ  ปลายแขนวางพาดโต๊ะไปทางจอ
 *   ซ้ายบนจอ  ปลายแขนตั้งเฉียงขึ้น มือถือแก้วขาวใต้คาง จิบเป็นจังหวะ
 */
const ARM = {
  skin: { top: '#f3c0a6', front: '#efb49b', side: '#d99a80', left: '#d99a80' },
  sleeve: { top: '#f2ead9', front: '#e6dcc6', side: '#cfc2a6', left: '#cfc2a6' },
}
function DeskArms() {
  const sip = useRef<THREE.Group>(null)
  useFrame((st) => {
    const k = Math.max(0, Math.sin(st.clock.elapsedTime * 0.7)) ** 6
    if (sip.current) sip.current.rotation.x = -0.18 * k
  })
  return (
    <group>
      {/* ขวาบนจอ */}
      <Limb a={[112, 120, -20]} b={[116, 16, 40]} w={58} f={ARM.sleeve} />
      <Limb a={[116, 16, 40]} b={[-14, 13, 160]} w={46} f={ARM.skin} />
      <Limb a={[-14, 13, 160]} b={[-34, 13, 190]} w={56} f={ARM.skin} />
      {/* ซ้ายบนจอ: ยกแก้ว */}
      <Limb a={[-112, 120, -20]} b={[-108, 16, 30]} w={58} f={ARM.sleeve} />
      <group ref={sip} position={[-108, 16, 30]}>
        <Limb a={[0, 0, 0]} b={[66, 100, 70]} w={46} f={ARM.skin} />
        <Limb a={[66, 100, 70]} b={[80, 128, 84]} w={56} f={ARM.skin} />
        <group position={[94, 150, 108]}>
          <mesh>
            <cylinderGeometry args={[27, 25, 62, 24]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 31.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[24, 24]} />
            <meshBasicMaterial color="#e6e6e6" />
          </mesh>
          <mesh position={[27, 2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[14, 5, 8, 18]} />
            <meshBasicMaterial color="#f0f0f0" />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/** เก้าอี้ทำงานใต้ตัวละคร — เบาะปิดรอยตัดช่วงล่าง · พนักหลังบังรอยตัดเมื่อมองจากด้านหลัง (เรื่องถอยกล้องผ่านไหล่) */
function Chair() {
  const c = iso(1048, 250, HEAD_TOP - 110)
  const seat = { top: '#3a3d47', front: '#2b2d35', side: '#32343d' }
  return (
    <group position={[c[0], 0, c[2]]} rotation={[0, Math.PI / 4 + CHAR_YAW, 0]}>
      <Box at={[-105, -96, -95]} size={[210, 34, 180]} f={seat} />
      <Box at={[-95, -62, -128]} size={[190, 150, 28]} f={seat} />
      <Box at={[-12, -400, -12]} size={[24, 304, 24]} f={C.dark} />
    </group>
  )
}

/**
 * ตำแหน่งสำคัญของฉากโต๊ะ (หน่วยโลก) — ให้ฉากอื่นที่ยืมโต๊ะนี้ไปใช้ (hero/DeskStage) วางกล้อง/ของได้ตรง
 *   screen  กลางหน้าจอมอนิเตอร์ (หันไปทาง -x) + ขนาด · joe ตำแหน่งตัวละคร · wall ระนาบผนังหลัง (z) และขอบซ้ายของตู้
 */
export const DESK_GEO = {
  screen: { c: [MON_B[0] - 0.6, MON_B[1] + MON_H / 2, MON_B[2] - MON_L / 2] as [number, number, number], w: MON_L - 24, h: MON_H - 24 },
  joe: iso(1048, 250, HEAD_TOP - 110),
  headTop: HEAD_TOP,
  wallZ: DESK.z0,
  cabX0: CAB_X0,
  deskTop: 0,
}

/** ฉากโต๊ะทั้งชุด (ไม่รวมกล้อง) — /joe-desk ใช้ผ่าน DeskScene · เรื่องหลังบท Code ยืมไปใช้ใน hero/DeskStage */
export function DeskWorld({ screen = null, chair = false }: { screen?: THREE.Texture | null; chair?: boolean }) {
  return (
    <>
      <HeroLights shadows={false} />
      {/* ไฟเติมจากทิศกล้อง — มุมไอโซหน้าตัวละครหันหาคนดู ไฟของ hero ส่องจากข้างจึงหน้ามืดไป */}
      <directionalLight position={[1000, 1200, 1000]} intensity={1.4} />
      <ambientLight intensity={0.7} />
      <Cabinet />
      <Coffee />
      <Desk />
      <DeskTop />
      <Character />
      {chair && <Chair />}
      <Monitor screen={screen} />
      <Plant />
    </>
  )
}

/** ซูม = สเกลของเวทีหน้า (1 หน่วยโลก = 1 px ของดีไซน์ที่ k = 1) */
function Zoom({ zoom }: { zoom: number }) {
  const cam = useThree((st) => st.camera)
  useEffect(() => {
    cam.zoom = zoom
    cam.updateProjectionMatrix()
  }, [cam, zoom])
  return null
}

export function DeskScene({ zoom = 1 }: { zoom?: number }) {
  return (
    <Canvas
      orthographic
      flat
      dpr={[1, 2]}
      camera={{ position: [CAM_DIR[0] * 5000, CAM_DIR[1] * 5000, CAM_DIR[2] * 5000], zoom, near: 10, far: 15000 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      gl={{ antialias: true, alpha: true }}
      style={{ pointerEvents: 'none' }}
    >
      <Zoom zoom={zoom} />
      <DeskWorld />
    </Canvas>
  )
}
