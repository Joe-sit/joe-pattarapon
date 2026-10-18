import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeTintGlass } from './liquidGlass'
import { rrect } from './shapes'
import { BEAT } from '@/sections/skystory/beats'
import { clamp01, inOut, type WorkBeats } from './workMotion'

/**
 * บท Research — island แบบ eddie.eco ("Simplifions la mobilité électrique"): ของดินปั้นนุ่ม ๆ
 * กับไอคอนแบนเข้มบนการ์ดขาวลอยอยู่ข้างหน้า — ตัดกันจึงอ่านง่าย
 *
 *   แว่นขยาย   การ์ดไอคอนแบนลอยหน้า (ค้นหา)
 *   แท่งแก้ว    แก้วฝ้า มีของเหลวม่วงเติมขึ้นช้า ๆ ตลอดบท (เก็บข้อมูล — ไม่มีตัวเลข)
 *   ต้นไม้      ทรงลูกแพร์ลำต้นไม้ กับพุ่มกลมข้างหลัง (โลกจริงที่ไปศึกษา)
 *
 * ไม่มีแท่นของตัวเอง — ของยืนบนผิวฟอง/การ์ดตรง ๆ · งอกบนฟองหงายตอนพลิก (PadIsland — ./BubbleTraveler)
 * ติดฟองลงจอดเป็นหัวเครื่อง แล้วเลื่อนลงการ์ดล่าง ถึงแล้วตัวใต้แก้วเครื่องรับไม้ต่อ (ResearchIsland — ./BenchScreen)
 * หน่วยแบบ: กว้าง 470 ย่อด้วย K ลงในการ์ด (312 × 236 หน่วยผังจอ) · y ขึ้นตามจอเครื่อง z ออกจากจอ
 */

const LEAF = '#a9c23a'
const WOOD = '#c99a5b'
/**
 * บล็อกในแท่งแก้ว (ล่าง → บน) — สีเดียวกับกระเบื้องของ widget ที่มันจะบินไปเป็น (./BenchScreen BLOCK_TO)
 * ช่วงค้นคว้าเก็บเป็นชิ้น ๆ → บทออกแบบกระจายออกไปประกอบเป็น widget
 */
export const BLOCK_COLORS = ['#44c4de', '#a696f1', '#b3a5f4', '#b3a5f4'] as const
const BLOCK_H = 46
/** ฐานของบล็อกที่ j (หน่วยแบบ island จากฐานแท่ง) */
export const blockY = (j: number) => 8 + j * (BLOCK_H + 6)
/** ตำแหน่งแท่งแก้วบน island (หน่วยแบบ) — BenchScreen ใช้หาจุดออกตัวของบล็อก */
export const BAR_AT = [18, 0, 4] as const
const INK = '#14161c'

/** กล่องตั้งมุมมน (แท่งแก้ว ของเหลว) — หน้าหันหากล้อง ฐานที่ y 0 */
function roundBox(w: number, h: number, d: number, r: number) {
  const bev = Math.min(d * 0.4, r * 0.6)
  const g = new THREE.ExtrudeGeometry(rrect(w - bev * 2, h - bev * 2, Math.max(1, r - bev)), {
    depth: Math.max(0.5, d - bev * 2),
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev,
    bevelSegments: 5,
    curveSegments: 20,
  })
  g.translate(0, h / 2, -d / 2 + bev)
  return g
}

/** ต้นไม้ทรงลูกแพร์: กระเปาะล่างใหญ่ คอคอด กระเปาะบนเล็ก (หมุนรอบแกนตั้ง) */
function pearGeo() {
  const pts: THREE.Vector2[] = []
  const N = 40
  for (let i = 0; i <= N; i += 1) {
    const t = i / N
    const y = t * 190
    /* สองก้อนซ้อน: ก้อนล่างรัศมี 56 กลางที่ 62 · ก้อนบน 38 กลางที่ 148 — เอารัศมีที่ใหญ่กว่าในแต่ละระดับ */
    const lo = Math.sqrt(Math.max(0, 1 - ((y - 62) / 64) ** 2)) * 56
    const hi = Math.sqrt(Math.max(0, 1 - ((y - 148) / 42) ** 2)) * 38
    pts.push(new THREE.Vector2(Math.max(0.01, lo, hi), y))
  }
  const g = new THREE.LatheGeometry(pts, 48)
  g.computeVertexNormals()
  return g
}

/** ไอคอนแว่นขยายแบน (วง + ด้าม) — แผ่นเรียบ ไม่มีความหนา */
function magnifierGeo() {
  const ring = new THREE.Shape()
  ring.absarc(0, 0, 26, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, 16, 0, Math.PI * 2, true)
  ring.holes.push(hole)
  const handle = rrect(12, 34, 6)
  const hg = new THREE.ShapeGeometry(handle, 10)
  hg.rotateZ(Math.PI / 4)
  hg.translate(29, -29, 0)
  const rg = new THREE.ShapeGeometry(ring, 32)
  return [rg, hg]
}

/** ย่อแบบลงการ์ด · ฐานแท่นห่างขอบล่างการ์ด */
export const K = 0.5
export const BASE_Y = -86
/**
 * การ์ดล่างของจอเครื่อง (CARDS[2] ใน ./BenchScreen — x y และความหนาผิวบน slab(312×236, ลึก 3) = 3 + 2·bevel 8)
 * เขียนเลขซ้ำที่นี่เพราะ BenchScreen import ไฟล์นี้ (กันวนกัน) — เปลี่ยนการ์ดใบนั้นต้องแก้ตรงนี้ด้วย
 */
export const ISLAND_CARD = { x: 0, y: -246, top: 3 + 2 * 8 }
/**
 * จังหวะของ island: ฟองหงายจบก่อน (tilt ใน BubbleTraveler จบที่ flip[0]) → flip = พลิกครั้งเดียว แล้วของจึงงอก
 * → ติดฟองลงจอดเป็นหัวเครื่อง → เลื่อนจากหัวเครื่องลงไปอยู่การ์ดล่าง ระหว่าง morph handFrom..handTo
 * ถึงการ์ดแล้วสลับไปตัวที่วาดใต้แก้วเครื่อง (ResearchIsland)
 */
export const ISLAND = { flip: [2.9, 0.75] as const, grow: [3.2, 0.3] as const, handFrom: 0.66, handTo: 1 }

/** สถานะต่อเฟรม — grow 0..1 (ของงอกทีละชิ้น) · fill (ไม่ใช้แล้ว) · sway ส่ายโชว์ทรง · lean เอนหน้าหากล้อง · gone = บล็อกที่บินออกไปเป็น widget แล้ว */
export type IslandState = { show: boolean; grow: number; fill: number; sway: number; lean: number; gone: number[] }

/** บล็อกที่ j บินออกจากแท่งไปเป็นกระเบื้อง widget (0..1) — ตั้งแต่ฟองลงจอดบนเครื่อง ระหว่างที่ widget ประกอบ */
export function blockFlight(sv2: number, j: number) {
  /* เริ่มตอนฟองลงจอดบนหัวเครื่องแล้วระลอกน้ำแผ่ (บทลงจอดราว 0.68) ไล่ทีละก้อน ไหลต่อเข้าบท bench */
  const t0 = BEAT.morph[0] + BEAT.morph[1] * 0.68
  return clamp01((sv2 - t0 - j * 0.08) / 0.3)
}

/** quintic smootherstep — ออกตัวและเข้าที่นุ่มทั้งสองปลาย ไม่เลยเป้า */
const soft = (x: number) => {
  const t = clamp01(x)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** อัปเดตท่าจากภายนอก (ตัวบนฟอง — ฟองเรียกหลังเขียน padIsland ในเฟรมเดียวกัน กันค่าช้าไปหนึ่งเฟรม) */
export type IslandApi = { update: (t: number) => void }

function IslandBody({ read, api }: { read: () => IslandState; api?: Ref<IslandApi> }) {
  const kit = useMemo(() => {
    const clay = (c: string, rough = 0.62) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0 })
    const [ringG, handleG] = magnifierGeo()
    return {
      geos: {
        bar: roundBox(78, 240, 78, 22),
        block: roundBox(62, BLOCK_H, 62, 14),
        pear: pearGeo(),
        trunk: new THREE.CylinderGeometry(9, 10, 64, 20),
        bush: new THREE.SphereGeometry(62, 40, 28, 0, Math.PI * 2, 0, Math.PI / 2),
        /* การ์ดไอคอนแบบ eddie.eco: แผ่นขาวเรียบมุมมน ไอคอนดำแบน — UI แบน ไม่ใช่ของ 3D (ตัดกับของดินปั้นรอบ ๆ) */
        card: new THREE.ShapeGeometry(rrect(124, 124, 30), 12),
        ring: ringG,
        handle: handleG,
      },
      mats: {
        glass: makeTintGlass('#ffffff', 0.2),
        blocks: BLOCK_COLORS.map((c) => clay(c, 0.45)),
        leaf: clay(LEAF, 0.58),
        wood: clay(WOOD, 0.7),
        card: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
        ink: new THREE.MeshBasicMaterial({ color: INK, toneMapped: false }),
        /* เงานุ่มใต้การ์ดไอคอน — การ์ดขาวไม่จมหายไปกับตัวอักษรขาวข้างหลัง */
        cardShadow: new THREE.MeshBasicMaterial({ color: '#1a2a5a', transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false }),
      },
    }
  }, [])
  useEffect(
    () => () => {
      Object.values(kit.geos).forEach((g) => g.dispose())
      Object.values(kit.mats).forEach((m) => (Array.isArray(m) ? m.forEach((x) => x.dispose()) : m.dispose()))
    },
    [kit],
  )

  const root = useRef<THREE.Group>(null)
  const stage = useRef<THREE.Group>(null)
  const bar = useRef<THREE.Group>(null)
  const blocks = useRef<(THREE.Mesh | null)[]>([])
  const pear = useRef<THREE.Group>(null)
  const bush = useRef<THREE.Mesh>(null)
  const card = useRef<THREE.Group>(null)

  const apply = (tt: number) => {
    const g = root.current
    if (!g) return
    const st0 = read()
    g.visible = st0.show && st0.grow > 0
    if (!g.visible) return
    const gr = st0.grow
    /* งอกนุ่ม ไม่เด้งเลยเป้า: ฐานโผล่ก่อน ชิ้นถัดไปเหลื่อมกันยาว ๆ จึงไหลต่อกันเป็นผืนเดียว */
    const rise = Math.max(1e-3, soft(gr / 0.4))
    g.scale.setScalar(rise)
    const st = stage.current
    if (st) st.rotation.set(st0.lean, -0.22 * Math.sin(Math.PI * inOut(st0.sway)), 0)
    const pop = (at: number) => soft((gr - at) / 0.45)
    const b1 = pop(0.08)
    if (bar.current) {
      bar.current.visible = b1 > 0.01
      bar.current.scale.setScalar(Math.max(1e-3, b1))
    }
    /* บล็อกในแท่งแก้ว: ซ้อนขึ้นทีละก้อนตามการงอก (เก็บข้อมูลเป็นชิ้น ๆ) · ก้อนที่บินออกไปเป็น widget แล้ว (gone) ซ่อน */
    blocks.current.forEach((bm, j) => {
      if (!bm) return
      const k = soft((gr - 0.12 - j * 0.07) / 0.3) * (1 - (st0.gone[j] ?? 0))
      bm.visible = k > 0.01
      bm.scale.setScalar(Math.max(1e-3, k))
    })
    const b2 = pop(0.2)
    if (pear.current) {
      pear.current.visible = b2 > 0.01
      pear.current.scale.setScalar(Math.max(1e-3, b2))
    }
    const b3 = pop(0.32)
    if (bush.current) {
      bush.current.visible = b3 > 0.01
      bush.current.scale.set(Math.max(1e-3, b3), Math.max(1e-3, b3 * 0.85), Math.max(1e-3, b3))
    }
    const b4 = pop(0.44)
    if (card.current) {
      card.current.visible = b4 > 0.01
      card.current.scale.setScalar(Math.max(1e-3, b4))
      card.current.position.y = 230 + Math.sin(tt * 1.4) * 7
      card.current.rotation.set(0, 0, 0)
    }
  }
  useImperativeHandle(api, () => ({ update: apply }))
  /* ตัวที่ไม่มีคนสั่ง (บนการ์ด) อัปเดตเองทุกเฟรม */
  useFrame(({ clock }) => {
    if (!api) apply(clock.elapsedTime)
  })

  const { geos, mats } = kit
  return (
    <group ref={root} visible={false}>
      <group ref={stage}>
        {/* ไม่มีแท่นของตัวเอง — ของยืนบนผิวฟอง/การ์ดตรง ๆ (ฐานของทุกชิ้นที่ y 0) */}
        {/* พุ่มกลมหลังแท่งแก้ว */}
        <mesh ref={bush} geometry={geos.bush} material={mats.leaf} position={[-70, 0, -38]} visible={false} />
        {/* แท่งแก้วฝ้า + ของเหลวม่วงข้างใน (ของเหลววาดก่อน แก้ววาดทับ — โปร่งจึงเห็นข้างใน) */}
        <group ref={bar} position={BAR_AT as unknown as [number, number, number]} visible={false}>
          {BLOCK_COLORS.map((_, j) => (
            <mesh
              key={j}
              ref={(el) => {
                blocks.current[j] = el
              }}
              geometry={geos.block}
              material={mats.blocks[j]}
              position={[0, blockY(j), 0]}
              renderOrder={1}
            />
          ))}
          <mesh geometry={geos.bar} material={mats.glass} renderOrder={2} />
        </group>
        {/* ต้นไม้ลูกแพร์ */}
        <group ref={pear} position={[132, 0, 10]} visible={false}>
          <mesh geometry={geos.trunk} material={mats.wood} position={[0, 32, 0]} />
          <mesh geometry={geos.pear} material={mats.leaf} position={[0, 58, 0]} />
        </group>
        {/* การ์ดไอคอนแว่นขยายลอยหน้า */}
        <group ref={card} position={[-150, 230, 60]} visible={false}>
          <mesh geometry={geos.card} material={mats.cardShadow} position={[0, -8, -2]} scale={1.06} renderOrder={0} />
          <mesh geometry={geos.card} material={mats.card} />
          <group position={[-4, 4, 0.5]}>
            <mesh geometry={geos.ring} material={mats.ink} />
            <mesh geometry={geos.handle} material={mats.ink} />
          </group>
        </group>
      </group>
    </group>
  )
}

/** ตัวบนการ์ดล่างของเครื่อง (ใต้แก้ว — ./BenchScreen) · โผล่เมื่อตัวบนฟองเลื่อนมาถึงการ์ดแล้ว (morph ครบ) */
export function ResearchIsland({ frame, top }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }>; top: number }) {
  const st = useRef<IslandState>({ show: false, grow: 1, fill: 0.15, sway: 0, lean: 0.32, gone: [0, 0, 0, 0] })
  const read = () => {
    const f = frame.current
    const o = st.current
    o.show = !!f?.on && f.b.morph >= ISLAND.handTo
    o.fill = f ? 0.15 + 0.85 * inOut((f.b.study - 0.1) / 0.7) : 0.15
    o.sway = f ? f.b.study : 0
    for (let j = 0; j < 4; j += 1) o.gone[j] = f && blockFlight(f.b.sv2, j) > 0 ? 1 : 0
    return o
  }
  return (
    <group position={[0, BASE_Y, top + 1]} scale={K}>
      <IslandBody read={read} />
    </group>
  )
}

/** สถานะของตัวบนฟอง — ./BubbleTraveler เขียนทุกเฟรม (พร้อมเมทริกซ์ของกลุ่มที่ห่อ) */
export const padIsland: IslandState = { show: false, grow: 0, fill: 0.15, sway: 0, lean: 0, gone: [0, 0, 0, 0] }
/** ตัวบนฟองหงาย (แคนวาสของฟอง) — กลุ่มที่ห่อตั้งเมทริกซ์เองจากท่าฟอง → การ์ดล่าง */
export function PadIsland({ api }: { api: Ref<IslandApi> }) {
  return <IslandBody read={() => padIsland} api={api} />
}
