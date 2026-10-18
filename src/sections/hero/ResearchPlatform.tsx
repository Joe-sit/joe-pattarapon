import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeTintGlass } from './liquidGlass'
import { rrect } from './shapes'
import { clamp01, inOut, outBack, type WorkBeats } from './workMotion'

/**
 * บท Research — island หนึ่งบนจอเครื่อง: แท่นแบบ eddie.eco ("Simplifions la mobilité électrique") ย่อส่วนยืนบนการ์ดล่าง
 * แผ่นขาวเตี้ยมุมมน ของดินปั้นนุ่ม ๆ ยืนบนแท่น กับไอคอนแบนเข้มบนการ์ดขาวลอยอยู่ข้างหน้า — ตัดกันจึงอ่านง่าย
 *
 *   แว่นขยาย   การ์ดไอคอนลอยหน้าแท่น (ค้นหา)
 *   แท่งแก้ว    แก้วฝ้า มีของเหลวม่วงเติมขึ้นช้า ๆ ตลอดบท (เก็บข้อมูล — ไม่มีตัวเลข)
 *   ต้นไม้      ทรงลูกแพร์ลำต้นไม้ กับพุ่มกลมข้างหลัง (โลกจริงที่ไปศึกษา)
 *
 * ลูกของกลุ่มการ์ด (./BenchScreen) — ไปกับการ์ดทุกท่า (ประกอบ เลือก ยกเป็นชั้น ควง) · แท่นโผล่จากผิวการ์ดต้นบท
 * ของบนแท่นเด้งขึ้นทีละชิ้น แล้วอยู่ต่อเป็นส่วนหนึ่งของเครื่อง · ทุกค่าคิดจากระยะเลื่อน เลื่อนกลับก็ถอยกลับ
 * หน่วยแบบ: แท่นกว้าง 470 ย่อด้วย K ลงในการ์ด (312 × 236 หน่วยผังจอ) · y ขึ้นตามจอเครื่อง z ออกจากจอ
 */

const WHITE = '#f4f5f8'
const LEAF = '#a9c23a'
const WOOD = '#c99a5b'
const PURPLE = '#6a4ff0'
const INK = '#14161c'

/** แผ่นมุมมนดันหนา ขอบลบมน — แนวนอน (หน้าแผ่นหันขึ้น) */
function roundSlab(w: number, d: number, r: number, h: number) {
  const bev = Math.min(h * 0.45, r * 0.5)
  const g = new THREE.ExtrudeGeometry(rrect(w - bev * 2, d - bev * 2, Math.max(1, r - bev)), {
    depth: Math.max(0.5, h - bev * 2),
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev,
    bevelSegments: 5,
    curveSegments: 20,
  })
  g.translate(0, 0, bev)
  g.rotateX(-Math.PI / 2)
  return g
}

/** กล่องตั้งมุมมน (แท่งแก้ว ของเหลว การ์ดไอคอน) — หน้าหันหากล้อง ฐานที่ y 0 */
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

/** ไอคอนแว่นขยายแบน (วง + ด้าม) ดันหนานิด */
function magnifierGeo() {
  const ring = new THREE.Shape()
  ring.absarc(0, 0, 26, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, 16, 0, Math.PI * 2, true)
  ring.holes.push(hole)
  const handle = rrect(12, 34, 6)
  const hg = new THREE.ExtrudeGeometry(handle, { depth: 4, bevelEnabled: false, curveSegments: 10 })
  hg.rotateZ(Math.PI / 4)
  hg.translate(29, -29, 0)
  const rg = new THREE.ExtrudeGeometry(ring, { depth: 4, bevelEnabled: false, curveSegments: 32 })
  return [rg, hg]
}

/** ย่อแบบลงการ์ด · ฐานแท่นห่างขอบล่างการ์ด */
const K = 0.5
const BASE_Y = -86

export function ResearchIsland({ frame, top }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }>; top: number }) {
  const kit = useMemo(() => {
    const clay = (c: string, rough = 0.62) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0 })
    const [ringG, handleG] = magnifierGeo()
    return {
      geos: {
        base: roundSlab(470, 150, 40, 30),
        bar: roundBox(78, 240, 78, 22),
        /* สูงเต็มแท่ง สเกล y เป็นสัดส่วน (ฐานที่ y 0) — ไม่ยืดขอบมน */
        fill: roundBox(62, 214, 62, 16),
        pear: pearGeo(),
        trunk: new THREE.CylinderGeometry(9, 10, 64, 20),
        bush: new THREE.SphereGeometry(62, 40, 28, 0, Math.PI * 2, 0, Math.PI / 2),
        card: roundBox(124, 124, 18, 30),
        ring: ringG,
        handle: handleG,
      },
      mats: {
        base: clay(WHITE, 0.5),
        glass: makeTintGlass('#ffffff', 0.2),
        fill: clay(PURPLE, 0.45),
        leaf: clay(LEAF, 0.58),
        wood: clay(WOOD, 0.7),
        card: clay('#ffffff', 0.4),
        ink: new THREE.MeshBasicMaterial({ color: INK }),
      },
    }
  }, [])
  useEffect(
    () => () => {
      Object.values(kit.geos).forEach((g) => g.dispose())
      Object.values(kit.mats).forEach((m) => m.dispose())
    },
    [kit],
  )

  const root = useRef<THREE.Group>(null)
  const stage = useRef<THREE.Group>(null)
  const bar = useRef<THREE.Group>(null)
  const fill = useRef<THREE.Mesh>(null)
  const pear = useRef<THREE.Group>(null)
  const bush = useRef<THREE.Mesh>(null)
  const card = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const g = root.current
    const f = frame.current
    if (!g) return
    const s = f?.on ? f.b.study : 0
    g.visible = s > 0
    if (!g.visible) return
    /* แท่นงอกขึ้นจากผิวการ์ด (สเกลจากศูนย์ เด้งนิด) */
    const rise = outBack(clamp01(s / 0.14), 1.4)
    g.scale.set(K * Math.max(1e-3, rise), K * Math.max(1e-3, rise), K * Math.max(1e-3, rise))
    const st = stage.current
    if (st) {
      /* เอนหน้าแท่นหากล้องนิดให้เห็นพื้นแท่น · ส่ายช้า ๆ โชว์ทรงระหว่างบท แล้วนิ่งหน้าตรงเมื่อจบ */
      st.rotation.set(0.32, -0.22 * Math.sin(Math.PI * inOut(s)), 0)
    }
    /* ของบนแท่นเด้งขึ้นทีละชิ้นหลังแท่นถึงที่ หดลงก่อนแท่นจม */
    const pop = (at: number) => outBack(clamp01((s - at) / 0.1), 1.6)
    const tt = clock.elapsedTime
    const b1 = pop(0.2)
    if (bar.current) {
      bar.current.visible = b1 > 0.01
      bar.current.scale.set(Math.max(1e-3, b1), Math.max(1e-3, b1), Math.max(1e-3, b1))
    }
    if (fill.current) {
      /* ของเหลวเติมขึ้นช้า ๆ ตลอดช่วงกลางบท — ไม่ใช่ค่าจริง แค่ "เก็บเพิ่มเรื่อย ๆ" */
      const h = 0.1 + 0.9 * inOut((s - 0.28) / 0.46)
      fill.current.scale.set(1, Math.max(1e-3, h), 1)
    }
    const b2 = pop(0.25)
    if (pear.current) {
      pear.current.visible = b2 > 0.01
      pear.current.scale.setScalar(Math.max(1e-3, b2))
    }
    const b3 = pop(0.29)
    if (bush.current) {
      bush.current.visible = b3 > 0.01
      bush.current.scale.set(Math.max(1e-3, b3), Math.max(1e-3, b3 * 0.85), Math.max(1e-3, b3))
    }
    const b4 = pop(0.34)
    if (card.current) {
      card.current.visible = b4 > 0.01
      card.current.scale.setScalar(Math.max(1e-3, b4))
      /* ลอยขึ้นลงเบา ๆ เอียงตามนิด */
      card.current.position.y = 230 + Math.sin(tt * 1.4) * 7
      card.current.rotation.set(0, 0.2 * Math.sin(Math.PI * inOut(s)) + Math.sin(tt * 0.9) * 0.05, 0)
    }
  })

  const { geos, mats } = kit
  return (
    <group ref={root} visible={false} position={[0, BASE_Y, top + 1]}>
      <group ref={stage}>
        <mesh geometry={geos.base} material={mats.base} />
        {/* พุ่มกลมหลังแท่งแก้ว */}
        <mesh ref={bush} geometry={geos.bush} material={mats.leaf} position={[-70, 30, -38]} visible={false} />
        {/* แท่งแก้วฝ้า + ของเหลวม่วงข้างใน (ของเหลววาดก่อน แก้ววาดทับ — โปร่งจึงเห็นข้างใน) */}
        <group ref={bar} position={[18, 30, 4]} visible={false}>
          <mesh ref={fill} geometry={geos.fill} material={mats.fill} position={[0, 8, 0]} renderOrder={1} />
          <mesh geometry={geos.bar} material={mats.glass} renderOrder={2} />
        </group>
        {/* ต้นไม้ลูกแพร์ */}
        <group ref={pear} position={[132, 30, 10]} visible={false}>
          <mesh geometry={geos.trunk} material={mats.wood} position={[0, 32, 0]} />
          <mesh geometry={geos.pear} material={mats.leaf} position={[0, 58, 0]} />
        </group>
        {/* การ์ดไอคอนแว่นขยายลอยหน้าแท่น */}
        <group ref={card} position={[-150, 230, 60]} visible={false}>
          <mesh geometry={geos.card} material={mats.card} position={[0, -62, 0]} />
          <group position={[-4, 4, 10]}>
            <mesh geometry={geos.ring} material={mats.ink} />
            <mesh geometry={geos.handle} material={mats.ink} />
          </group>
        </group>
      </group>
    </group>
  )
}
