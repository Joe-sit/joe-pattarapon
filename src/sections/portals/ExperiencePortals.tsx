import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { JOURNEY } from '@/data/journey'
import { roundedBoxGeo } from '@/newhero/geo'
import { layout } from './portalLayout'

/**
 * ตัวละคร **ตัวเดียวกับ hero ของ /2026-final** — ไม่ใช่ Mascot เปล่า ๆ
 *
 * HeroRider คือชุดเดียวกับที่ฉาก hero ใช้: แขน lumberjack, ลายเสื้อ, รองเท้า, rim light,
 * ท่าสเก็ตบนบอร์ด และค่าทุกตัวอ่านจากแผงจูนชุดเดียวกัน — จูนที่เดียวแล้วสองจอตรงกัน
 * (chunk หนัก โหลดแยก)
 */
const HeroRider = lazy(() => import('@/newhero/HeroRider').then((m) => ({ default: m.HeroRider })))

/** แผงจูนผัง (dev) — โหลดแยกเพื่อไม่ให้ไปอยู่ใน bundle ของหน้าจริง */
const PortalTuner = lazy(() =>
  import('./PortalTuner').then((m) => ({ default: m.PortalTuner })),
)

/**
 * จอ Experiences — พอร์ทัลเศษกระจกกระจายบนทุ่งฟ้า ตัวละครลอยออกมาทีละช่วงของไทม์ไลน์
 *
 * ช่องเป็น "ช่องทะลุจริง" ทำด้วย stencil buffer ไม่ใช่แผ่นขาวแปะรูป: วาดรูปเศษกระจกโดยไม่เขียนสี
 * แต่เขียนเลขประจำช่องลง stencil แล้วของในอีกมิติตั้งเงื่อนไขว่าจะวาดเฉพาะพิกเซลที่เลขตรงกัน
 * ผลคือข้างในมีความลึกจริง (ฟ้าไล่สี เมฆหลายชั้นขยับไม่เท่ากัน) ไม่ใช่ภาพแบนที่แปะไว้
 *
 * เลขประจำช่องต้อง **ไม่ซ้ำกัน** ทุกช่อง ถ้าใช้เลขเดียวทั้งจอ เมฆของช่องซ้ายจะโผล่ในช่องขวา
 * ด้วยเมื่อมันเลื่อนผ่านแนวนั้น (stencil ไม่รู้เรื่องตำแหน่ง รู้แค่ว่าเลขตรงหรือไม่ตรง)
 *
 * บานเป็น "กล่องมุมมนหนาจริง" ชุดเดียวกับหน้าต่างของ hero (roundedBoxGeo) ไม่ใช่ระนาบแบน
 * ปากช่องจึงเป็นขอบของกล่องที่มองเห็นด้านข้างตามมุมกล้อง — เอียงบานแล้วเห็นความหนา
 *
 * ค่าที่เปลี่ยนทุกเฟรม (ระยะ scroll) อยู่ในอ็อบเจกต์นอก React — setState ใน useFrame คือ
 * re-render หกสิบครั้งต่อวินาที ส่วน state ของ React มีตัวเดียว: "ตอนนี้เล่าถึงช่วงไหน"
 */

/** ระยะ scroll ของจอ = หนึ่งจอต่อหนึ่งช่วงไทม์ไลน์ + หนึ่งจอให้ช่วงท้ายได้ค้าง */
const SCREENS = JOURNEY.length + 1

/** ความคืบหน้าในจอ 0..1 — อ่านทุกเฟรม เขียนจาก scroll listener */
const flow = { p: 0 }

/** ฟ้าในช่อง: ซีดที่ขอบบน เข้มลงล่าง — ค่าเดียวกับที่ทำให้เศษกระจกอ่านเป็นสีขาวในภาพอ้างอิง */
const SKY_STOPS: [number, string][] = [
  [0, '#f7fcff'],
  [0.5, '#e4f3ff'],
  [1, '#c9e6fb'],
]

function skyTexture() {
  const cv = document.createElement('canvas')
  cv.width = 4
  cv.height = 128
  const ctx = cv.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  for (const [at, col] of SKY_STOPS) g.addColorStop(at, col)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 128)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * ฟ้าของอีกมิติเป็น *โดมครอบ* ไม่ใช่ระนาบแบนที่วางขนานกับบาน
 *
 * ระนาบแบนขนานบาน: พอบานตะแคง ระนาบก็ตะแคงตาม ภาพฉายของมันแคบลงเรื่อย ๆ จนไม่พอ
 * ปิดปากช่อง — เห็นเป็น "หน้า portal ขาด" (รูโหว่บางส่วนแล้วทะลุไปเจอสีพื้นของหน้า)
 * โดมครอบรอบปากช่องไม่มีทิศที่แคบ มองมุมไหนก็เต็มปากช่องเสมอ
 *
 * เรขาคณิตใบเดียวใช้ร่วมทุกบาน (วัสดุต้องแยก เพราะแต่ละบานติดเลข stencil ของตัวเอง)
 */
const DOME_R = 16

/** สีผนังข้างของบาน — ขาวอมฟ้าให้เข้ากับฟ้าในช่อง ไม่ใช่ขาวจัดที่อ่านเป็นกระดาษ */
const WALL = '#e8f3fd'

/** ตัวช่วยคิดเมทริกซ์ของตัวละคร (บาน × ท่า) — ใช้ซ้ำ ไม่สร้างใหม่ต่อเฟรม */
const WIN_OBJ = new THREE.Object3D()
const GUY_OBJ = new THREE.Object3D()
const MAT_A = new THREE.Matrix4()
const MAT_B = new THREE.Matrix4()
const P_A = new THREE.Vector3()
const P_B = new THREE.Vector3()
const Q_A = new THREE.Quaternion()
const Q_B = new THREE.Quaternion()
const S_A = new THREE.Vector3()

/** ไล่ขึ้นแบบนุ่ม — ใช้กับทุกช่วงของการลอย ไม่ให้มีหัวมีท้ายกระตุก */
function ease(x: number) {
  const k = Math.min(1, Math.max(0, x))
  return k * k * (3 - 2 * k)
}

/**
 * เมทริกซ์ของ "ตัวละครที่บานใบ k ระยะลึก z" — บานหมุนเท่าไรตัวก็หมุนตาม
 *
 * คิดเป็นเมทริกซ์แล้วค่อยยัดลง object เดียว ไม่ได้ผูกตัวละครเป็นลูกของบาน เพราะการย้าย
 * ไปบานอื่นต้องให้ React ถอด-ใส่ใหม่ ซึ่ง scroll ทำให้เกิดทุกเฟรมไม่ได้ (และแผงจูนก็ไม่ได้
 * ทำให้ฉาก re-render)
 */
function guyMatrix(k: number, z: number, out: THREE.Matrix4) {
  const win = layout.wins[Math.max(0, Math.min(layout.wins.length - 1, k))]
  const guy = layout.guy
  WIN_OBJ.position.set(win.pos[0], win.pos[1], win.pos[2])
  WIN_OBJ.rotation.set(win.rot[0], win.rot[1], win.rot[2])
  WIN_OBJ.updateMatrix()
  GUY_OBJ.position.set(guy.pos[0], guy.pos[1], z)
  GUY_OBJ.rotation.set(guy.rot[0], guy.rot[1], guy.rot[2])
  GUY_OBJ.scale.setScalar(guy.scale)
  GUY_OBJ.updateMatrix()
  return out.multiplyMatrices(WIN_OBJ.matrix, GUY_OBJ.matrix)
}

/** จำนวนบาน — ผังจริงอยู่ที่ portalLayout (แผงจูน dev เขียนทับได้ระหว่างรัน) */
const WINS = layout.wins.length

/**
 * ของในช่อง — ตั้งเงื่อนไข stencil ให้ทุกวัสดุในกิ่งด้วย traverse
 *
 * ไล่ทั้งกิ่งแทนการส่ง prop ทีละชิ้น เพราะของในนี้เป็นเมชหลายชิ้นและชิ้นที่ลืมตั้งจะโผล่
 * นอกกรอบช่องทันที (เห็นเป็นเมฆลอยอยู่บนพื้นฟ้าเปล่า ๆ) ตั้งเฉพาะชิ้นที่ยังไม่ถูกตั้ง
 * เพื่อไม่ต้อง needsUpdate ทุกเฟรม และตั้งซ้ำช่วงแรกเผื่อชิ้นที่ mount ตามมาทีหลัง
 *
 * **ห้ามเขียนความลึก** (depthWrite=false) — ฟ้าของแต่ละช่องเป็นระนาบที่กว้างกว่าปากช่อง
 * สามเท่า ถ้ามันเขียน depth ช่องที่อยู่ใกล้กล้องกว่าจะเขียนทับพื้นที่จอเป็นบริเวณกว้าง
 * แล้วของในช่องที่อยู่ไกลกว่าจะสอบ depth ไม่ผ่านทั้งช่อง — เห็นเป็น "ช่องว่างเปล่า"
 * ตอนหมุน/ขยับบานให้สองช่องซ้อนกันในจอ (อาการที่เจอตอนลากองศาในแผงจูน)
 *
 * ลำดับในช่องจึงคุมด้วย renderOrder ของชิ้นเอง: ฟ้า 1, เมฆไกล 2, เมฆกลาง 3, เมฆใกล้ 4
 */
function InsideShard({ ref: sref, children }: { ref: number; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const frames = useRef(0)
  useFrame(() => {
    const root = g.current
    if (!root || frames.current > 120) return
    frames.current += 1
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.material) return
      // ชิ้นที่ไม่ได้กำหนดลำดับมาเอง ให้ไปอยู่หลังหน้ากากเป็นอย่างน้อย
      if (mesh.renderOrder === 0) mesh.renderOrder = 1
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (m.stencilWrite && m.stencilRef === sref) continue
        m.stencilWrite = true
        m.stencilRef = sref
        m.stencilFunc = THREE.EqualStencilFunc
        m.depthWrite = false
        m.needsUpdate = true
      }
    })
  })
  return <group ref={g}>{children}</group>
}

/**
 * ก้อนเมฆ — ทรงกลมสามใบเกยกัน ไม่รับแสง ขาวเท่ากันทั้งก้อนเหมือนในภาพอ้างอิง
 *
 * `order` มาจากผู้เรียก เพราะของในช่องไม่เขียนความลึก (ดู InsideShard) ลำดับหน้า-หลัง
 * จึงมาจาก renderOrder ล้วน ๆ — ก้อนที่อยู่ใกล้กล้องต้องได้เลขสูงกว่า
 */
function Cloud({
  scale = 1,
  order = 2,
  ...props
}: { scale?: number; order?: number } & React.ComponentProps<'group'>) {
  return (
    <group {...props} scale={scale}>
      {([
        [0, 0, 0, 1],
        [-0.85, -0.18, 0.1, 0.72],
        [0.9, -0.12, -0.1, 0.78],
      ] as const).map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} renderOrder={order}>
          <sphereGeometry args={[r, 18, 14]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * บานหนึ่งบาน: หน้ากากกล่องหนา + อีกมิติข้างใน
 *
 * หน้ากากไม่เขียนความลึก (depthWrite=false) ถ้าเขียน ของข้างในที่อยู่ลึกกว่าระนาบช่องจะถูก
 * ตัดออกด้วย depth test ทั้งหมด — ช่องจะกลายเป็นรูดำ
 */
function Portal({
  index,
  sref,
  children,
}: {
  index: number
  sref: number
  children?: React.ReactNode
}) {
  const L = layout.wins[index]
  const sky = useMemo(() => skyTexture(), [])
  useEffect(() => () => sky.dispose(), [sky])

  const box = useRef<THREE.Group>(null)
  const mask = useRef<THREE.Mesh>(null)
  const clouds = useRef<THREE.Group>(null)
  /**
   * ขนาดที่ปั้นไว้ล่าสุด — เทียบทุกเฟรม ไม่ได้พึ่ง useMemo
   *
   * แผงจูนไม่ได้ทำให้ฉาก re-render (มันยก state ของตัวเอง) ถ้าผูกการปั้นไว้กับ useMemo
   * สไลเดอร์ "กว้าง/สูง/หนาบาน" จะไม่มีผลจนกว่าอย่างอื่นจะบังคับให้ฉากวาดใหม่ — ซึ่งคือ
   * อาการ "ขนาดยังไม่เรียลไทม์" เทียบขนาดในลูปเฟรมแล้วปั้นเมื่อเปลี่ยนจริงจึงตรงกว่า
   * และไม่แพง: เปรียบเทียบเลขสามตัวต่อเฟรม ปั้นเฉพาะเฟรมที่ค่าขยับ
   */
  const built = useRef({ w: 0, h: 0, d: 0 })
  useFrame((_, dt) => {
    // อ่านผังจากค่ากลางทุกเฟรม — ลากสไลเดอร์แล้วบานขยับทันทีโดยไม่ต้อง re-render
    const o = box.current
    if (o) {
      o.position.set(L.pos[0], L.pos[1], L.pos[2])
      o.rotation.set(L.rot[0], L.rot[1], L.rot[2])
    }
    const b = built.current
    if (mask.current && (b.w !== L.w || b.h !== L.h || b.d !== layout.depth)) {
      const next = roundedBoxGeo(L.w, L.h, layout.depth, Math.min(L.w, L.h) * 0.1)
      const old = mask.current.geometry
      mask.current.geometry = next
      // ปล่อยของเก่าทันที ไม่งั้นลากสไลเดอร์ทีเดียวทิ้งบัฟเฟอร์ GPU ไว้เป็นร้อยใบ
      old?.dispose()
      b.w = L.w
      b.h = L.h
      b.d = layout.depth
      // ส่องได้ตอน dev ว่าเรขาคณิตถูกปั้นใหม่จริงตอนลากสไลเดอร์ (ไม่ใช่แค่ค่าในแผงเปลี่ยน)
      if (import.meta.env.DEV) {
        const w = window as typeof window & {
          __portals?: Record<number, { w: number; h: number; d: number; at: number }>
        }
        w.__portals = w.__portals ?? {}
        w.__portals[index] = { w: b.w, h: b.h, d: b.d, at: Math.round(performance.now()) }
      }
    }
    const g = clouds.current
    if (!g) return
    // เมฆลอยข้ามช่องแล้ววนกลับ — ความลึกต่างกันจึงเลื่อนไม่เท่ากัน เห็นเป็นพารัลแลกซ์จริง
    for (const c of g.children) {
      c.position.x += dt * (0.25 + c.position.z * 0.04)
      // ขอบวนคิดจากขนาดบานปัจจุบัน ย่อบานแล้วเมฆจึงไม่ค้างอยู่นอกช่อง
      if (c.position.x > L.w * 0.8) c.position.x = -L.w * 0.8
      if (c.position.x < -L.w * 0.8) c.position.x = -L.w * 0.8
      c.position.y = Math.max(-L.h * 0.42, Math.min(L.h * 0.42, c.position.y))
    }
  })

  return (
    <group ref={box} position={[L.pos[0], L.pos[1], L.pos[2]]} rotation={[L.rot[0], L.rot[1], L.rot[2]]}>
      {/**
       * บานใบหนึ่ง = เมชเดียวสองวัสดุ (เรขาคณิตปั้นในลูปเฟรม)
       *
       * ExtrudeGeometry ของ roundedBoxGeo แบ่งกลุ่มเป็น 0 = ฝาหน้า/หลัง, 1 = ผนังข้าง
       *   กลุ่ม 0 → หน้ากาก: ไม่เขียนสี เขียนแค่เลขประจำช่องลง stencil (คือ "รู" ของช่อง)
       *   กลุ่ม 1 → ผนังข้าง: เนื้อทึบจริง รับแสง เห็นเป็นความหนาของบาน
       *
       * ต้องมีผนัง ไม่ใช่มีแต่รู: ก้มบานถึงราว 90° (ก้ม −1.62) รูจะบางเหลือเท่าความหนา
       * (0.3) บานทั้งใบจึงหายไปจากจอ — มีผนังแล้วตะแคงเท่าไรก็ยังเห็นเป็นแผ่นหนา
       * และผนังไม่เขียน stencil ของในช่องจึงไม่ทะลุผนังออกมา
       */}
      <mesh ref={mask} renderOrder={-2}>
        <meshBasicMaterial
          attach="material-0"
          colorWrite={false}
          depthWrite={false}
          stencilWrite
          stencilRef={sref}
          stencilFunc={THREE.AlwaysStencilFunc}
          stencilZPass={THREE.ReplaceStencilOp}
        />
        <meshStandardMaterial attach="material-1" color={WALL} roughness={0.55} />
      </mesh>

      <InsideShard ref={sref}>
        {/* ฟ้าของอีกมิติ — โดมครอบปากช่อง (ดูหมายเหตุที่ DOME_R) */}
        <mesh renderOrder={1}>
          <sphereGeometry args={[DOME_R, 24, 16]} />
          <meshBasicMaterial map={sky} side={THREE.BackSide} toneMapped={false} />
        </mesh>
        {/**
         * เมฆต้องอยู่ใกล้ปากช่อง ไม่ใช่ลึกเข้าไปหลายหน่วย
         *
         * กรวยที่มองผ่านปากช่องแคบลงเรื่อย ๆ เมื่อบานเอียง พอเอียงจัด (ก้มเกินราว 60°)
         * กรวยไปไม่ถึงระยะเมฆเดิม (z −2.2 ถึง −5.5) ในช่องจึงเหลือแต่ฟ้าเรียบ ๆ
         * อ่านเป็นการ์ดทึบ ไม่ใช่ช่องที่มองทะลุไปอีกมิติ — ขยับมาที่ −1 ถึง −3.4 และเพิ่ม
         * เป็นสี่ก้อนกระจายทั้งกรอบ มุมไหนก็ยังมีอะไรให้เห็นในช่อง
         */}
        <group ref={clouds}>
          {/* ไกล → ใกล้ ตามลำดับวาด (ไม่มี depth ให้พึ่ง) */}
          <Cloud position={[L.w * 0.4, L.h * 0.26, -3.4]} scale={0.52} order={2} />
          <Cloud position={[L.w * 0.05, -L.h * 0.22, -2.4]} scale={0.6} order={3} />
          <Cloud position={[-L.w * 0.34, L.h * 0.08, -1.7]} scale={0.44} order={4} />
          <Cloud position={[L.w * 0.26, -L.h * 0.02, -1] } scale={0.34} order={5} />
        </group>
      </InsideShard>

      {children}
    </group>
  )
}


/**
 * ตัวละครที่ลอยเข้า-ออกพอร์ทัลจริง ๆ — วาดสองรอบ คนละกฎการมองเห็น
 *
 * รอบเดียวทำไม่ได้: ถ้าไม่ติดหน้ากากเลย ตอนตัวอยู่ "ในอีกมิติ" มันจะลอยอยู่กลางทุ่งฟ้าให้เห็น
 * ทั้งตัว (ไม่ได้อยู่ในช่องเลย) ถ้าติดหน้ากากทั้งตัว ตอนโผล่ออกมามันจะถูกตัดที่ขอบบานพอดี
 * กลายเป็นรูปในกรอบ ไม่ใช่ของที่ทะลุออกมา
 *
 *   สำเนา "ใน"  — ทดสอบ stencil ของบานใบนั้น เห็นเฉพาะพิกเซลในปากช่อง
 *   สำเนา "นอก" — ไม่ติด stencil แต่ถูกตัดด้วย clipping plane ที่ระนาบหน้าบาน เหลือเฉพาะ
 *                 ส่วนที่โผล่พ้นระนาบออกมาแล้ว
 *
 * สองอันต่อกันพอดีที่ระนาบบาน: ส่วนที่ยังอยู่ข้างในเห็นผ่านช่อง ส่วนที่พ้นออกมาเห็นตรง ๆ
 * ราคาที่จ่ายคือวาดริกสองรอบ — ตัวละครตัวเดียวในจอนี้ รับได้
 */
/**
 * จุดตั้งต้นของตัวละคร — นอกจอจริง ไม่ใช่ริมจอ
 *
 * กรวยกล้องของฉากนี้ที่ z 0 กว้าง ±15.4 สูง ±9.6 จุดนี้จึงอยู่พ้นขอบซ้ายและขอบบนไปแล้ว
 * ทั้งสองแกน คนดูจะเห็นตัวละคร "ลอยเข้ามาในเฟรม" ไม่ใช่โผล่ที่ขอบจอ
 */
const OFF_SCREEN = new THREE.Vector3(-23, 11, 4)

const CLIP_N = new THREE.Vector3()
const CLIP_P = new THREE.Vector3()

/**
 * ไล่วัสดุในกิ่งให้เป็นของสำเนานี้ (โคลนครั้งเดียว) แล้วตั้งกฎการมองเห็นให้
 *
 * `role` ต้องแยกต่อสำเนา ไม่ใช่ธง "โคลนแล้ว" ใบเดียว: วัสดุของ GLB ถูกแคชต่อ URL สองสำเนา
 * จึงเริ่มจากวัสดุใบเดียวกัน ถ้าใช้ธงรวม สำเนาที่สองจะเห็นว่า "โคลนแล้ว" แล้วข้ามไป —
 * กลายเป็นสองสำเนาใช้วัสดุชุดเดียวกัน แล้วกฎของสำเนาหลังทับของสำเนาแรกทั้งชุด
 * (อาการ: ตัวถูก clipping ของสำเนานอกทั้งคู่ หัวที่ยังอยู่ในมิติจึงหายไปเลย)
 */
function ownMaterials(
  root: THREE.Object3D,
  role: string,
  owned: THREE.Material[],
  apply: (m: THREE.Material) => void,
) {
  root.traverse((n) => {
    const mesh = n as THREE.Mesh
    if (!mesh.material) return
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const next = list.map((m) => {
      if (m.userData.portalRole === role) return m
      const c = m.clone()
      c.userData.portalRole = role
      owned.push(c)
      apply(c)
      return c
    })
    if (next.some((m, k) => m !== list[k])) {
      mesh.material = Array.isArray(mesh.material) ? next : next[0]
    }
  })
}

function PortalGuy() {
  const gl = useThree((st) => st.gl)
  const inside = useRef<THREE.Group>(null)
  const outside = useRef<THREE.Group>(null)
  const ownedIn = useRef<THREE.Material[]>([])
  const ownedOut = useRef<THREE.Material[]>([])
  const frames = useRef(0)
  /**
   * ระนาบตัดของสำเนา "นอก" — วัตถุใบเดิมตลอด
   *
   * ต้องเป็นใบเดิมเพราะจำนวนระนาบตัดเข้าไปอยู่ใน define ของ shader (NUM_CLIPPING_PLANES)
   * สลับ array ใหม่ทุกเฟรมคือสั่งคอมไพล์ shader ใหม่ทุกเฟรม
   */
  const clip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 1e4), [])

  useEffect(() => {
    // ต้องเปิดที่ตัว renderer ไม่งั้น clippingPlanes ของวัสดุไม่มีผลเลย
    gl.localClippingEnabled = true
  }, [gl])

  useEffect(
    () => () => {
      for (const m of ownedIn.current) m.dispose()
      for (const m of ownedOut.current) m.dispose()
      ownedIn.current = []
      ownedOut.current = []
    },
    [],
  )

  useFrame(() => {
    const a = inside.current
    const b = outside.current
    if (!a || !b) return

    /**
     * ลอยเข้า / ลอยออก สลับบานไปตามระยะ scroll
     *
     * บานแรกคือ "ลอยเข้า" — เรื่องเริ่มจากตัวละครอยู่ข้างนอกแล้วมุดเข้าไปในอีกมิติ
     * ไม่ใช่โผล่ออกมาจากที่ไม่มีที่มา จากนั้นสลับ: เข้า บาน 1 → ออก บาน 2 → เข้า บาน 3 → ออก บาน 4
     * ช่วงว่างหลังจาก "เข้า" คือช่วงที่มันเดินทางอยู่ในอีกมิติ (ไม่เห็นตัว) ส่วนช่วงว่างหลัง
     * "ออก" คือลอยข้ามเฟรมไปหาบานถัดไป
     *
     * เลื่อนขึ้นก็ย้อนกลับตามจริง เพราะทุกค่าคิดจาก flow.p ล้วน ๆ ไม่มีสถานะสะสม
     */
    const guy = layout.guy
    const span = 1 / SCREENS
    const u = Math.max(0, Math.min(WINS - 1e-4, flow.p / span))
    const i = Math.min(WINS - 1, Math.floor(u))
    const f = u - i
    const j = Math.min(WINS - 1, i + 1)
    const zOut = guy.pos[2]
    /** เสี้ยวของช่วงที่ใช้ทำท่า (มุดเข้า/โผล่ออก) ที่เหลือคือช่วงว่างหลังจากนั้น */
    const act = Math.max(0.1, Math.min(0.9, guy.outAt))
    /** บานคู่คือ "เข้า" บานคี่คือ "ออก" */
    const goingIn = i % 2 === 0

    /** บานที่ตัวกำลังออกจาก/มุดเข้า — ระหว่างลอยข้างนอกล้วน ๆ ไม่มีบานที่เกี่ยวข้อง */
    let win = -1
    let hidden = false
    if (i === 0) {
      /**
       * ช่วงแรกสุดของจอ: ลอยเข้ามาจากนอกเฟรม แล้วค่อยมุดเข้าบานแรก
       *
       * แบ่งครึ่งช่วง: ครึ่งแรกเดินทางจากนอกจอมาถึงปากบาน ครึ่งหลังมุดเข้าไป — ไม่ได้เริ่ม
       * เรื่องด้วยตัวละครที่ยืนรออยู่หน้าบานตั้งแต่พิกเซลแรกของ scroll
       */
      const half = 0.5
      if (f <= half) {
        const t = ease(f / half)
        guyMatrix(0, zOut, MAT_A).decompose(P_B, Q_B, S_A)
        P_A.copy(OFF_SCREEN).lerp(P_B, t)
        // โก่งวิถีเล็กน้อย ให้เป็นการลอยเข้ามา ไม่ใช่ไถลตรงเข้าหาบาน
        P_A.y += Math.sin(t * Math.PI) * 1.2
        MAT_A.compose(P_A, Q_B, S_A)
      } else {
        win = 0
        guyMatrix(0, THREE.MathUtils.lerp(zOut, guy.deep, ease((f - half) / (1 - half))), MAT_A)
      }
    } else if (f <= act) {
      win = i
      const t = ease(f / act)
      guyMatrix(i, goingIn ? THREE.MathUtils.lerp(zOut, guy.deep, t) : THREE.MathUtils.lerp(guy.deep, zOut, t), MAT_A)
    } else if (goingIn) {
      // เดินทางอยู่ในอีกมิติ — ไม่เห็นตัวจนกว่าจะโผล่ออกที่บานถัดไป
      hidden = true
      guyMatrix(i, guy.deep, MAT_A)
    } else {
      /**
       * ลอยข้ามเฟรม: ไล่จาก "ปากบาน i" ไป "ปากบาน j" ในพิกัดโลก
       *
       * slerp ที่มุม ไม่ใช่ lerp เมทริกซ์ตรง ๆ — สองบานหมุนต่างกันมาก lerp เมทริกซ์
       * ทำให้สเกลบิดเบี้ยวกลางทาง (ตัวแบนลงแล้วพองกลับ)
       */
      const t = ease((f - act) / (1 - act))
      guyMatrix(i, zOut, MAT_A).decompose(P_A, Q_A, S_A)
      guyMatrix(j, zOut, MAT_B).decompose(P_B, Q_B, S_A)
      P_A.lerp(P_B, t)
      Q_A.slerp(Q_B, t)
      // โก่งวิถีขึ้นกลางทาง ให้เป็นการ "ลอย" ไม่ใช่ไถลเป็นเส้นตรง
      P_A.y += Math.sin(t * Math.PI) * 1.6
      MAT_A.compose(P_A, Q_A, S_A)
    }

    for (const o of [a, b]) {
      o.matrixAutoUpdate = false
      o.matrix.copy(MAT_A)
      o.matrixWorldNeedsUpdate = true
    }

    b.visible = !hidden
    if (win >= 0) {
      const W = layout.wins[win]
      WIN_OBJ.position.set(W.pos[0], W.pos[1], W.pos[2])
      WIN_OBJ.rotation.set(W.rot[0], W.rot[1], W.rot[2])
      WIN_OBJ.updateMatrix()
      // แนวตั้งฉากหน้าบาน = แกน z ของบานหลังหมุน · จุดบนระนาบ = หน้าบาน (กลางบาน + ครึ่งความหนา)
      CLIP_N.set(0, 0, 1).applyQuaternion(WIN_OBJ.quaternion)
      CLIP_P.copy(WIN_OBJ.position).addScaledVector(CLIP_N, layout.depth / 2)
      clip.setFromNormalAndCoplanarPoint(CLIP_N, CLIP_P)
      a.visible = true
      // สำเนา "ใน" ต้องทดสอบกับเลขของบานใบที่กำลังเกี่ยวข้อง ไม่ใช่เลขตายตัว
      for (const m of ownedIn.current) m.stencilRef = win + 1
    } else {
      // ลอยข้างนอกล้วน ๆ: ไม่มีอะไรให้เห็นผ่านช่อง และไม่ต้องตัดอะไรทิ้ง
      a.visible = false
      clip.constant = 1e4
    }
    if (hidden) a.visible = false

    frames.current += 1
    /**
     * เริ่มโคลนวัสดุ *หลัง* ริกตั้งตัวเสร็จ ไม่ใช่ตั้งแต่เฟรมแรก
     *
     * ริกสร้างชิ้นส่วนและสลับวัสดุของตัวเองใน effect หลายรอบหลัง mount (ผมท้ายทอยเป็นเมช
     * ที่ปั้นทีหลังและยืมวัสดุของผมมาใช้) โคลนเร็วเกินไปจะได้วัสดุตอนกลางทาง — อาการคือ
     * ผมกลายเป็นสีขาวเพราะได้วัสดุเริ่มต้นมาแทนของจริง
     * ไล่ต่อไปจนเฟรม 260 เพื่อเก็บชิ้นที่โผล่มาทีหลังด้วย
     */
    if (frames.current < 90 || frames.current > 260) return
    ownMaterials(a, 'in', ownedIn.current, (m) => {
      m.stencilWrite = true
      m.stencilFunc = THREE.EqualStencilFunc
      m.stencilRef = 1
      /**
       * ต้องเขียนความลึก ไม่เหมือนของอื่นในช่อง
       *
       * กฎ "ของในช่องไม่เขียน depth" มีไว้กันช่องหนึ่งบังของอีกช่อง (ฟ้าเป็นระนาบใหญ่)
       * แต่ตัวละครเป็นของทึบที่มีชิ้นส่วนซ้อนกันเอง ปิด depth แล้วผม/หัว/ผิวบังกันไม่ได้
       * เห็นเป็นหัวขาวไม่มีผม (อาการที่เจอ) — ความลึกของมันกินแค่เงาตัวเองในช่องเดียว
       */
      m.depthWrite = true
      m.needsUpdate = true
    })
    ownMaterials(b, 'out', ownedOut.current, (m) => {
      m.stencilWrite = false
      m.stencilFunc = THREE.AlwaysStencilFunc
      m.clippingPlanes = [clip]
      m.needsUpdate = true
    })
  })

  return (
    <>
      {/**
       * สำเนา "ใน" — เห็นเฉพาะในปากช่อง
       *
       * ลำดับต้องอยู่ *หลัง* ของในช่องทุกชิ้น (ฟ้า 1, เมฆ 2-4) เพราะของในช่องไม่เขียนความลึก
       * (ดู InsideShard) ลำดับวาดจึงเป็นตัวตัดสินหน้า-หลังทั้งหมด — ให้เลขต่ำกว่าเมฆแล้ว
       * เมฆจะทับตัวละครหายไปทั้งตัว (อาการที่เจอ: หัวขาดตอนโผล่ออกมา)
       */}
      <group ref={inside} renderOrder={6}>
        <Suspense fallback={null}>
          <HeroRider noBoard />
        </Suspense>
      </group>
      {/* สำเนา "นอก" — เหลือเฉพาะส่วนที่พ้นระนาบหน้าบานออกมาแล้ว */}
      <group ref={outside} renderOrder={7}>
        <Suspense fallback={null}>
          <HeroRider noBoard />
        </Suspense>
      </group>
    </>
  )
}

/**
 * ของชิ้นเล็กที่โปรยระหว่างบาน — ในผังของ duolingo ของพวกนี้กินพื้นที่ว่างเกือบทั้งผืน
 * และบางชิ้นถูกขอบจอกิน ทำให้ทั้งภาพอ่านว่า "ยังมีต่อออกไป" ไม่ใช่การ์ดสี่ใบลอยในที่ว่าง
 *
 * ใช้เรขาคณิตสี่แบบร่วมกันทุกชิ้น (กล่อง, แปดหน้า, แคปซูล, โดนัท) ต่างกันที่ตำแหน่ง/หมุน/
 * สเกล/สี — ไม่ปั้นใหม่ทีละชิ้น และตำแหน่งมาจากเลขประจำชิ้น ไม่ได้สุ่มใหม่ทุกครั้งที่เข้าหน้า
 */
const PROP_MAX = 24
const PROP_COLORS = ['#4f7df9', '#e8492e', '#f5c53d', '#7fe0a0', '#b39ddb', '#5ec8e8']

function Props() {
  const geos = useMemo(
    () => [
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.OctahedronGeometry(0.62),
      new THREE.CapsuleGeometry(0.3, 0.6, 6, 12),
      new THREE.TorusGeometry(0.42, 0.17, 10, 18),
    ],
    [],
  )
  const mats = useMemo(
    () => PROP_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 })),
    [],
  )
  useEffect(
    () => () => {
      for (const g of geos) g.dispose()
      for (const m of mats) m.dispose()
    },
    [geos, mats],
  )

  /** ผังของชิ้นเล็ก — คิดจากกรวยกล้อง (กว้าง ±15.4 สูง ±9.6) แล้วดันบางชิ้นเลยขอบออกไป */
  const seeds = useMemo(
    () =>
      Array.from({ length: PROP_MAX }, (_, i) => {
        const a = (i * 2.399) % (Math.PI * 2)
        const r = 0.42 + (((i * 7) % 11) / 11) * 0.72
        return {
          x: Math.cos(a) * r * 16.4,
          y: Math.sin(a) * r * 10.4,
          z: 1 + (((i * 13) % 9) / 9) * 3.2,
          s: 0.5 + (((i * 5) % 7) / 7) * 0.85,
          spin: 0.1 + (((i * 3) % 6) / 6) * 0.35,
          geo: i % 4,
          mat: i % PROP_COLORS.length,
          tilt: ((i * 17) % 31) / 31 * Math.PI,
        }
      }),
    [],
  )

  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const root = g.current
    if (!root) return
    const n = Math.max(0, Math.min(PROP_MAX, Math.round(layout.props)))
    const t = clock.elapsedTime
    root.children.forEach((c, i) => {
      const on = i < n
      c.visible = on
      if (!on) return
      const s = seeds[i]
      // ลอยขึ้นลงช้า ๆ + หมุนรอบตัว ไม่เคลื่อนที่ไปไหน (ของในแบบก็ลอยอยู่กับที่)
      c.position.y = s.y + Math.sin(t * s.spin * 2 + i) * 0.35
      c.rotation.y = t * s.spin + s.tilt
      c.rotation.x = s.tilt + Math.sin(t * s.spin) * 0.2
    })
  })

  return (
    <group ref={g}>
      {seeds.map((s, i) => (
        <mesh
          key={i}
          geometry={geos[s.geo]}
          material={mats[s.mat]}
          position={[s.x, s.y, s.z]}
          scale={s.s}
        />
      ))}
    </group>
  )
}

/**
 * กล้องเห็นทั้งผังตลอด แล้วไหลไปทางบานที่ถึงคิวเล็กน้อย
 *
 * ไม่กวาดไปจ่อทีละบาน (ทำแล้วเห็นครั้งละใบครึ่ง ผังที่จัดไว้หายไปหมด) — ภาพอ้างอิงคือ
 * องค์ประกอบทั้งชุดในเฟรมเดียว การเล่าไทม์ไลน์จึงมาจากป้ายข้อความกับการไหลของกล้อง
 * ไม่ใช่การซูมเข้าหาบาน
 */
function CameraRig() {
  useFrame(({ camera }) => {
    const span = 1 / SCREENS
    const at = Math.min(WINS - 1, flow.p / span)
    const i = Math.min(WINS - 1, Math.floor(at))
    const j = Math.min(WINS - 1, i + 1)
    const f = at - i
    const k = f * f * (3 - 2 * f)
    const x = THREE.MathUtils.lerp(layout.wins[i].pos[0], layout.wins[j].pos[0], k)
    const y = THREE.MathUtils.lerp(layout.wins[i].pos[1], layout.wins[j].pos[1], k)
    const d = layout.drift
    camera.position.x += (x * d - camera.position.x) * 0.06
    camera.position.y += (y * d * 0.75 - camera.position.y) * 0.06
    camera.position.z += (layout.camZ - camera.position.z) * 0.1
    camera.lookAt(x * d * 0.4, y * d * 0.3, 0)
  })
  return null
}

function Scene() {
  return (
    <>
      <hemisphereLight intensity={0.85} color="#ffffff" groundColor="#cfe6f7" />
      <directionalLight position={[-6, 8, 9]} intensity={1.25} color="#fff4e6" />
      <CameraRig />
      {layout.wins.map((_, i) => (
        <Portal key={i} index={i} sref={i + 1} />
      ))}
      <PortalGuy />
      <Props />
    </>
  )
}

export function ExperiencePortals({ id = 'experiences' }: { id?: string }) {
  const frame = useRef<HTMLDivElement>(null)
  /** ช่วงที่กำลังเล่า — state ตัวเดียวของจอนี้ เปลี่ยนตอนข้ามช่วงเท่านั้น ไม่ใช่ทุกเฟรม */
  const [stop, setStop] = useState(0)
  /** วาดเฉพาะตอนจออยู่ในสายตา — ฉากอยู่นิ่งไม่ได้ เมฆกับใบไม้ขยับตลอด */
  const [live, setLive] = useState(false)

  useEffect(() => {
    const el = frame.current
    if (!el) return undefined
    const onScroll = () => {
      const box = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, -box.top / Math.max(1, box.height - vh)))
      flow.p = p
      const span = 1 / SCREENS
      const next = Math.min(JOURNEY.length - 1, Math.floor(p / span))
      setStop((v) => (v === next ? v : next))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const io = new IntersectionObserver((es) => setLive(es[0].isIntersecting), { rootMargin: '10%' })
    io.observe(el)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      io.disconnect()
    }
  }, [])

  const at = JOURNEY[stop]

  return (
    <section id={id} data-screen={id} className="relative w-full bg-[#cfe9fb]">
      <div ref={frame} style={{ height: `${SCREENS * 100}svh` }} className="relative">
        <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
          <Canvas
            aria-hidden
            className="absolute inset-0"
            /* ชั้นนี้เป็นภาพประกอบล้วน ห้ามกินเมาส์ — r3f ใส่ pointerEvents ที่ style ของตัวห่อเอง */
            style={{ pointerEvents: 'none' }}
            frameloop={live ? 'always' : 'never'}
            dpr={[1, 1.75]}
            /* stencil: ช่องทะลุทั้งจอทำด้วย stencil buffer ถ้าไม่ขอไว้ บริบทจะไม่มีบัฟเฟอร์นั้นให้ใช้
               alpha: พื้นฟ้าเป็นสีของ section ข้างหลัง ไม่ได้วาดในฉาก — ของที่ลอยนอกช่องจึงลอยบนสีนั้น */
            gl={{ antialias: true, alpha: true, stencil: true }}
            camera={{ position: [0, 0, layout.camZ], fov: 42, near: 0.1, far: 140 }}
          >
            <Scene />
          </Canvas>

          {/* ป้ายของช่วงที่กำลังเล่า — ข้อความจริงจาก src/data/journey ไม่ได้แต่งขึ้น
              บนกลางเฟรม: ผังบานล้อมรอบขอบและเว้นกลางไว้ ข้อความจึงเกาะขอบบนได้โดยไม่ทับบาน
              ระยะห่างบนเลี่ยงแถบเมนูของหน้า (clamp ตามความสูงจอ ไม่ใช่ค่าตายตัว) */}
          <div className="pointer-events-none absolute inset-x-0 top-[clamp(72px,14svh,150px)] flex justify-center px-6">
            <div key={stop} className="text-center text-[#16222c]">
              <p className="text-[clamp(12px,1.1vw,15px)] font-medium tracking-[0.18em] uppercase opacity-70">
                {at.at}
              </p>
              <p className="mt-1 text-[clamp(20px,2.4vw,34px)] font-semibold leading-tight">
                {at.role}
              </p>
              <p className="text-[clamp(13px,1.2vw,17px)] opacity-70">{at.org}</p>
            </div>
          </div>

          {/* แผงลอยแบบ fixed — ผูกกับ live ไม่ใช่แค่ DEV ไม่งั้นมันค้างทับจออื่นทั้งหน้า */}
          {import.meta.env.DEV && live && (
            <Suspense fallback={null}>
              <PortalTuner />
            </Suspense>
          )}
        </div>
      </div>
    </section>
  )
}
