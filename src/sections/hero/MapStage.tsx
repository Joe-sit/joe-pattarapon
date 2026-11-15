import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { WORKS } from './WorksGallery'
import { FOV, STORY_FONT, camDist, smooth, type WorkBeats } from './workMotion'
import { ALT0, DECK_H, MAP_EL, MAP_AZ, MAP_SCROLL, PAN_MAX, PHONE_HH, PITCH, ROAD, SCREEN_F, SCREEN_R, mapGround, mapLive, mapPhase, mapReveal, mapScale, stepMap } from './mapWorld'

/**
 * Selected Work แบบ "เมืองบนพื้น" — ต่อท้ายบท Code (POST_CODE = 'map' ใน ./workMotion) ตามภาพ ref เมืองดินปั้นไอโซเมตริก
 *
 *   ลงจอด  เครื่องลอยค้าง หงายเป็นแนวราบ → พื้นเปล่าจางขึ้นข้างใต้ → เครื่องลอยลงช้า ๆ (กล้องตามลง) เงาเข้มขึ้น → แตะพื้น วงฝุ่น
 *          → เมืองงอกจากเครื่องเป็นคลื่นออกไป (จังหวะ: MAP_* ใน ./mapWorld · ท่าเครื่อง: ./BubbleTraveler)
 *   เดิน    ลากจอ / ปุ่มลูกศร / WASD = เดินไปทิศไหนก็ได้ · สกรอลล์ = ทัวร์ไปตามป้ายผลงานทีละชิ้น
 *           ป้ายผลงาน (ปกงานจริงจาก WORKS) ตั้งอยู่ตามบล็อกรอบเมือง · เข้าใกล้ป้ายไหน ป้ายนั้นยกขึ้น + ชื่องานขึ้นมุมซ้ายล่าง
 *           คลิกป้าย = เดินไปหาป้ายนั้น
 *   ออก    กล้องกลับลานกลาง เครื่องลุกขึ้น ต่อบท Ship
 *
 * แคนวาสเมืองอยู่ใต้ตัวเครื่อง (ชั้น z51 ของ WorkStory — ใต้แคนวาสของบนจอเครื่อง) · ชื่องาน/คำแนะนำ: MapInfo (z53)
 */
/** ขอบฟ้าของโลกน้ำเงิน — หมอกไกล ๆ จางเข้าสีนี้ (ฟ้าโค้งลงมาชนพื้น) */
const BG = '#d3e5fa'
/** ฟ้าเดียวกับเรื่องก่อนหน้า (บท Ship/ฟ้าเปิดเรื่อง) — บนเข้ม ล่างอ่อน · ชั้นเมฆ = ฟ้าใกล้ขอบ */
const SKY_TOP = '#2a6be0'
const SKY_LOW = '#74abf3'
/** โลกโทนเดียวน้ำเงิน low-poly (ตาม ref) — ถนนฟ้าอ่อน ตึกบล็อกน้ำเงิน ต้นสนน้ำเงินเข้ม เสาขาวคาดแดง */
const C = {
  road: '#cfe0f6',
  dash: '#ffffff',
  slab: '#9dbdec',
  plaza: '#b4cff2',
  lawn: '#86ace6',
  trunk: '#1a2a55',
  leafA: '#1f3570',
  leafB: '#2b4787',
  white: '#ffffff',
  stripe: '#e5484d',
  ring: '#e5484d',
}
const TOWER = ['#3f74d8', '#5a8be2', '#2f62c8', '#7ea6ea', '#4a7fdc']
const BLOCK = PITCH - ROAD
const GRID = 3

/** บล็อกที่ตั้งป้ายผลงาน (ช่อง i,j) — วงในรอบลานกลาง 8 ช่อง แล้ววงนอก · ลำดับ = ลำดับทัวร์ตอนสกรอลล์ */
const PROJ_CELLS: [number, number][] = [
  [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1],
  [2, 1], [1, 2], [-2, -1], [-1, -2],
]
const PROJ = WORKS.map((w, n) => ({ w, x: PROJ_CELLS[n][0] * PITCH, z: PROJ_CELLS[n][1] * PITCH }))
/** ทางทัวร์: จุดลงจอด → ป้ายทีละชิ้น */
const PATH = [{ x: 0, z: 0 }, ...PROJ]

/** สถานะร่วมระหว่างฉาก/แผงชื่อ (ไม่ใช่ React state — อ่านทุกเฟรม) */
const mapUI = { active: -1, hover: -1, on: false, focus: -1, ux: 0, uz: 0, at: 0 }

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Inst = { p: [number, number, number]; s: [number, number, number]; c?: string; ry?: number }
/** การงอกตอนลงจอด: rise = ยกตัวจากพื้น (บล็อก สนาม) · pop = ผลิขึ้นเด้งนิด (ต้นไม้ เสาไฟ ม้านั่ง) · none = มีตั้งแต่พื้นโผล่ (เส้นถนน) */
type Grow = 'rise' | 'pop' | 'none'

/** ของซ้ำในเมือง: หนึ่งรูปทรง + หนึ่งวัสดุ = หนึ่ง draw call */
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, list: Inst[], grow: Grow, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, list.length)
  const col = new THREE.Color()
  list.forEach((it, i) => {
    if (it.c) m.setColorAt(i, col.set(it.c))
  })
  m.userData = { list, grow, g: -1 }
  setGrow(m, 1)
  m.castShadow = shadow
  m.receiveShadow = true
  m.computeBoundingSphere()
  return m
}

/** เด้งเกินนิดแล้วเข้าที่ */
const backOut = (t: number) => {
  const c = 1.7
  const u = t - 1
  return 1 + (c + 1) * u * u * u + c * u * u
}
/** คลื่นงอก: ของใกล้เครื่องงอกก่อน ไกลออกไปงอกทีหลัง — ความคืบหน้าของชิ้นที่ห่าง d (สัดส่วนรัศมีเมือง) */
const GROW_R = GRID * PITCH
const growAt = (g: number, x: number, z: number, late = 0) => {
  const d = Math.hypot(x, z) / GROW_R
  return Math.min(1, Math.max(0, (g * 1.75 - d * 0.85 - late) / 0.32))
}
const GO = new THREE.Object3D()
function setGrow(m: THREE.InstancedMesh, g: number) {
  const ud = m.userData as { list: Inst[]; grow: Grow; g: number }
  const gg = ud.grow === 'none' ? 1 : g
  if (ud.g === gg) return
  ud.g = gg
  ud.list.forEach((it, i) => {
    const t = growAt(gg, it.p[0], it.p[2], ud.grow === 'pop' ? 0.12 : 0)
    const k = ud.grow === 'pop' ? (t <= 0 ? 0 : backOut(t)) : smooth(t)
    const sy = Math.max(1e-3, k)
    GO.position.set(it.p[0], it.p[1] * k, it.p[2])
    if (ud.grow === 'pop') GO.scale.set(it.s[0] * sy, it.s[1] * sy, it.s[2] * sy)
    else GO.scale.set(it.s[0], it.s[1] * sy, it.s[2])
    GO.rotation.set(0, it.ry ?? 0, 0)
    GO.updateMatrix()
    m.setMatrixAt(i, GO.matrix)
  })
  m.instanceMatrix.needsUpdate = true
}

/** เมืองทั้งเมือง (หน่วยพื้น) — สร้างครั้งเดียว · สุ่มแบบมีเมล็ด (ทุกครั้งออกมาเหมือนเดิม) */
function useCity() {
  return useMemo(() => {
    const r = rng(7)
    const box = new THREE.BoxGeometry(1, 1, 1)
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10)
    /* ต้นสนหกเหลี่ยม · เสาเหลี่ยมแปด — เหลี่ยมให้เห็นชัดด้วย flatShading */
    const cone = new THREE.ConeGeometry(0.5, 1, 6)
    const post = new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
    const clay = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0, flatShading: true })
    const mats = { road: clay(C.road), dash: clay(C.dash), slab: clay(C.slab), plaza: clay(C.plaza), lawn: clay(C.lawn), trunk: clay(C.trunk), leaf: clay('#ffffff'), white: clay(C.white), tower: clay('#ffffff'), stripe: clay(C.stripe) }
    const proj = new Set(PROJ_CELLS.slice(0, PROJ.length).map(([i, j]) => `${i},${j}`))
    const slabs: Inst[] = []
    const plaza: Inst[] = []
    const lawns: Inst[] = []
    const trunks: Inst[] = []
    const leaves: Inst[] = []
    const poles: Inst[] = []
    const bands: Inst[] = []
    const towers: Inst[] = []
    const benches: Inst[] = []
    const dashes: Inst[] = []
    const tree = (x: number, z: number, k = 1) => {
      const h = (0.45 + r() * 0.3) * k
      const cr = (0.42 + r() * 0.28) * k
      trunks.push({ p: [x, 0.14 + h / 2, z], s: [0.14 * k, h, 0.14 * k] })
      leaves.push({ p: [x, 0.14 + h + cr * 1.2, z], s: [cr * 2, cr * 3, cr * 2], c: r() < 0.5 ? C.leafA : C.leafB, ry: r() * Math.PI })
    }
    /* เสาขาวคาดแดงสองแถบ (แบบหลักริมรันเวย์) */
    const lamp = (x: number, z: number) => {
      poles.push({ p: [x, 0.14 + 0.85, z], s: [0.2, 1.7, 0.2] })
      bands.push({ p: [x, 0.14 + 1.4, z], s: [0.22, 0.22, 0.22] })
      bands.push({ p: [x, 0.14 + 0.9, z], s: [0.22, 0.22, 0.22] })
    }
    /* ตึกบล็อก: กล่องสูงต่ำเรียงในบล็อก */
    const tower = (x: number, z: number, w: number, d: number, h: number) =>
      towers.push({ p: [x, 0.14 + h / 2, z], s: [w, h, d], c: TOWER[Math.floor(r() * TOWER.length)] })
    const bench = (x: number, z: number, ry: number) => {
      benches.push({ p: [x, 0.14 + 0.18, z], s: [0.95, 0.08, 0.32], ry })
      benches.push({ p: [x - Math.sin(ry) * 0.14, 0.14 + 0.36, z - Math.cos(ry) * 0.14], s: [0.95, 0.26, 0.06], ry })
    }
    const half = BLOCK / 2
    for (let i = -GRID; i <= GRID; i++)
      for (let j = -GRID; j <= GRID; j++) {
        const x = i * PITCH
        const z = j * PITCH
        const center = i === 0 && j === 0
        ;(center ? plaza : slabs).push({ p: [x, 0.07, z], s: [BLOCK, 0.14, BLOCK] })
        lamp(x + half - 0.4, z + half - 0.4)
        lamp(x - half + 0.4, z - half + 0.4)
        if (center) {
          /* ลานกลาง: ต้นไม้สี่มุม ม้านั่งหันเข้าหาเครื่อง */
          for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) tree(x + a * (half - 0.9), z + b * (half - 0.9), 1.15)
          bench(x - half + 0.9, z, Math.PI / 2)
          bench(x + half - 0.9, z, -Math.PI / 2)
          continue
        }
        if (proj.has(`${i},${j}`)) {
          for (const [a, b] of [[1, 1], [-1, -1]]) if (r() < 0.7) tree(x + a * (half - 0.7), z + b * (half - 0.7))
          continue
        }
        /* บล็อกตึก: กล่อง 2×2 สูงไม่เท่ากัน (บางช่องเว้นเป็นต้นสน) */
        if (r() < 0.6) {
          const q = (BLOCK - 1.4) / 2
          for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            if (r() < 0.22) {
              tree(x + (a * q) / 2, z + (b * q) / 2, 1)
              continue
            }
            tower(x + (a * (q + 0.3)) / 2, z + (b * (q + 0.3)) / 2, q - 0.2 - r() * 0.4, q - 0.2 - r() * 0.4, 0.8 + r() * r() * 4.2)
          }
          continue
        }
        /* สวนสน: สนามน้ำเงินอ่อน ต้นสนกระจาย ม้านั่ง */
        const park = r() < 0.55
        if (park) lawns.push({ p: [x, 0.16, z], s: [BLOCK - 0.9, 0.05, BLOCK - 0.9] })
        const n = park ? 3 + Math.floor(r() * 3) : 1 + Math.floor(r() * 2)
        for (let k = 0; k < n; k++) tree(x + (r() - 0.5) * (BLOCK - 1.6), z + (r() - 0.5) * (BLOCK - 1.6), 0.9 + r() * 0.45)
        if (park) bench(x + (r() - 0.5) * 2, z + half - 1.1, Math.PI)
      }
    /* เส้นประกลางถนนทั้งสองแนว */
    const span = (GRID + 0.5) * PITCH
    for (let l = -GRID - 1; l <= GRID; l++) {
      const c = (l + 0.5) * PITCH
      for (let d = -span; d < span; d += 1.3) {
        dashes.push({ p: [c, 0.006, d], s: [0.09, 0.01, 0.55] })
        dashes.push({ p: [d, 0.006, c], s: [0.55, 0.01, 0.09] })
      }
    }
    const meshes = [
      instanced(box, mats.slab, slabs, 'rise'),
      instanced(box, mats.plaza, plaza, 'rise'),
      instanced(box, mats.lawn, lawns, 'rise'),
      instanced(box, mats.tower, towers, 'rise'),
      instanced(cyl, mats.trunk, trunks, 'pop'),
      instanced(cone, mats.leaf, leaves, 'pop'),
      instanced(post, mats.white, poles, 'pop'),
      instanced(post, mats.stripe, bands, 'pop'),
      instanced(box, mats.white, benches, 'pop'),
      instanced(box, mats.dash, dashes, 'none', false),
    ]
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(span * 2.6, span * 2.6), mats.road)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    return {
      box,
      cyl,
      meshes,
      ground,
      white: mats.white,
      dispose: () => {
        box.dispose()
        cyl.dispose()
        cone.dispose()
        post.dispose()
        ground.geometry.dispose()
        Object.values(mats).forEach((m) => m.dispose())
        meshes.forEach((m) => m.dispose())
      },
    }
  }, [])
}

/** ก้อนเมฆดินปั้น (ทรงกลมแบนซ้อนกัน) ลอยเหนือชั้นเมฆ ระหว่างทางที่เครื่องลอยลง — สุ่มมีเมล็ด */
function useClouds() {
  return useMemo(() => {
    const r = rng(21)
    const list: Inst[] = []
    for (let c = 0; c < 18; c++) {
      const a = r() * Math.PI * 2
      const d = 1.5 + r() * 10
      const cx = Math.cos(a) * d
      const cz = Math.sin(a) * d
      const cy = DECK_H + 0.8 + r() * 8.5
      const sz = 0.9 + r() * 1.2
      const n = 4 + Math.floor(r() * 3)
      for (let k = 0; k < n; k++) {
        const b = sz * (0.75 + r() * 0.55)
        list.push({ p: [cx + (k - n / 2) * 0.62 * sz + (r() - 0.5) * 0.4, cy + (r() - 0.2) * 0.45 * sz, cz + (r() - 0.5) * 1.1 * sz], s: [b * 1.5, b * 1.05, b * 1.3] })
      }
    }
    const geo = new THREE.SphereGeometry(0.5, 20, 14)
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e6efff', emissiveIntensity: 0.62, roughness: 1, transparent: true })
    const mesh = instanced(geo, mat, list, 'none', false)
    mesh.receiveShadow = false
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: SKY_LOW, transparent: true, depthWrite: false }))
    deck.rotation.x = -Math.PI / 2
    deck.position.y = DECK_H
    deck.renderOrder = 1
    mesh.renderOrder = 2
    return {
      mesh,
      mat,
      deck,
      dispose: () => {
        geo.dispose()
        mat.dispose()
        mesh.dispose()
        deck.geometry.dispose()
        ;(deck.material as THREE.Material).dispose()
      },
    }
  }, [])
}

/** เงาฟุ้งใต้เครื่อง (ไล่สีวงรี) — ชัดขึ้นตอนเครื่องแตะพื้น */
function useBlob() {
  return useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 128
    const g = cv.getContext('2d')!
    const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64)
    grd.addColorStop(0, 'rgba(40,44,60,0.55)')
    grd.addColorStop(0.55, 'rgba(40,44,60,0.22)')
    grd.addColorStop(1, 'rgba(40,44,60,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

const BOARD = { w: 3.2, h: 1.8, y: 1.75, d: 0.14 }
const BOARD_Q = new THREE.Euler(0, -MAP_AZ, 0)

/** ป้ายผลงาน: เสาคู่ + กรอบขาว + ปกงาน · ยกขึ้นตอนชี้/ตอนเดินมาถึง */
function Boards({ box, cyl, white }: { box: THREE.BoxGeometry; cyl: THREE.CylinderGeometry; white: THREE.Material }) {
  const tex = useTexture(PROJ.map((p) => p.w.img))
  const roots = useRef<(THREE.Group | null)[]>([])
  const groups = useRef<(THREE.Group | null)[]>([])
  const rings = useRef<(THREE.Mesh | null)[]>([])
  const lift = useRef(PROJ.map(() => 0))
  const res = useMemo(() => {
    const mats = tex.map((t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      return new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
    })
    const plane = new THREE.PlaneGeometry(1, 1)
    const ring = new THREE.RingGeometry(0.93, 1, 64)
    const ringMat = new THREE.MeshBasicMaterial({ color: C.ring, transparent: true, depthWrite: false, toneMapped: false })
    return { mats, plane, ring, ringMat }
  }, [tex])
  useEffect(
    () => () => {
      res.mats.forEach((m) => m.dispose())
      res.plane.dispose()
      res.ring.dispose()
      res.ringMat.dispose()
    },
    [res],
  )
  useFrame((_, dt) => {
    const t = performance.now() / 1000
    PROJ.forEach((p, n) => {
      /* ป้ายตั้งขึ้นจากพื้นตามคลื่นงอก (ช้ากว่าต้นไม้นิด) */
      const rt = roots.current[n]
      if (rt) {
        const gt = growAt(mapLive.grow, p.x, p.z, 0.2)
        rt.visible = gt > 0
        rt.scale.set(1, Math.max(1e-3, gt <= 0 ? 0 : backOut(gt)), 1)
      }
      const g = groups.current[n]
      if (!g) return
      const want = mapUI.hover === n || mapUI.active === n ? 1 : 0
      lift.current[n] += (want - lift.current[n]) * (1 - Math.exp(-dt * 10))
      const l = lift.current[n]
      g.position.y = l * 0.35
      g.scale.setScalar(1 + l * 0.06)
      const rg = rings.current[n]
      if (rg) {
        rg.visible = l > 0.01
        rg.scale.setScalar(2.2 + Math.sin(t * 3) * 0.06)
        res.ringMat.opacity = 0.85
      }
    })
  })
  return (
    <>
      {PROJ.map((p, n) => (
        <group
          key={p.w.name}
          position={[p.x, 0.14, p.z]}
          ref={(el) => {
            roots.current[n] = el
          }}
        >
          {/* ฐานขาว */}
          <mesh geometry={box} material={white} position={[0, 0.06, 0]} scale={[BOARD.w + 0.6, 0.12, 1.4]} rotation={BOARD_Q} castShadow receiveShadow />
          <mesh
            ref={(el) => {
              rings.current[n] = el
            }}
            geometry={res.ring}
            material={res.ringMat}
            position={[0, 0.14, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            visible={false}
          />
          <group
            ref={(el) => {
              groups.current[n] = el
            }}
          >
            <group rotation={BOARD_Q}>
              {[-1, 1].map((s) => (
                <mesh key={s} geometry={cyl} material={white} position={[s * (BOARD.w / 2 - 0.35), BOARD.y / 2, -0.02]} scale={[0.1, BOARD.y, 0.1]} castShadow />
              ))}
              <group
                position={[0, BOARD.y + BOARD.h / 2 - 0.3, 0]}
                onPointerOver={(e) => {
                  e.stopPropagation()
                  mapUI.hover = n
                }}
                onPointerOut={() => {
                  if (mapUI.hover === n) mapUI.hover = -1
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  mapUI.focus = n
                }}
              >
                <mesh geometry={box} material={white} scale={[BOARD.w + 0.2, BOARD.h + 0.2, BOARD.d]} castShadow receiveShadow />
                <mesh geometry={res.plane} material={res.mats[n]} position={[0, 0, BOARD.d / 2 + 0.005]} scale={[BOARD.w, BOARD.h, 1]} />
              </group>
            </group>
          </group>
        </group>
      ))}
    </>
  )
}

/** ไอคอนแอปยักษ์ (favicon ของเว็บ) ตั้งตระหง่านหลังลานลงจอด — หันหาคนดู ลอยขึ้นลงช้า ๆ งอกขึ้นตามคลื่นเมือง */
const ICON = { s: 3.4, d: 0.42, y: 2.6, at: 4.2 }
function AppIcon() {
  const tex = useTexture('/favicon-512.png')
  const root = useRef<THREE.Group>(null)
  const res = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const r = ICON.s * 0.225
    const h = ICON.s / 2 - r
    const shape = new THREE.Shape()
    shape.absarc(h, h, r, 0, Math.PI / 2, false)
    shape.absarc(-h, h, r, Math.PI / 2, Math.PI, false)
    shape.absarc(-h, -h, r, Math.PI, Math.PI * 1.5, false)
    shape.absarc(h, -h, r, Math.PI * 1.5, Math.PI * 2, false)
    const slab = new THREE.ExtrudeGeometry(shape, { depth: ICON.d, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 10 })
    slab.translate(0, 0, -ICON.d)
    return {
      slab,
      plane: new THREE.PlaneGeometry(ICON.s, ICON.s),
      body: new THREE.MeshStandardMaterial({ color: '#2f62c8', roughness: 0.7, flatShading: true }),
      face: new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, toneMapped: false }),
    }
  }, [tex])
  useEffect(
    () => () => {
      res.slab.dispose()
      res.plane.dispose()
      res.body.dispose()
      res.face.dispose()
    },
    [res],
  )
  const pos = useMemo(() => SCREEN_F.clone().multiplyScalar(ICON.at), [])
  useFrame(() => {
    const g = root.current
    if (!g) return
    const gt = growAt(mapLive.grow, pos.x, pos.z, 0.1)
    g.visible = gt > 0
    const k = gt <= 0 ? 1e-3 : backOut(gt)
    g.scale.setScalar(Math.max(1e-3, k))
    g.position.set(pos.x, ICON.y * k + Math.sin(performance.now() / 900) * 0.12, pos.z)
  })
  return (
    <group ref={root} rotation={BOARD_Q} visible={false}>
      <mesh geometry={res.slab} material={res.body} castShadow />
      <mesh geometry={res.plane} material={res.face} position={[0, 0, 0.07]} />
    </group>
  )
}

function City() {
  const g = useRef<THREE.Group>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const sunTarget = useRef<THREE.Object3D>(null)
  const blob = useRef<THREE.Mesh>(null)
  const dust = useRef<THREE.Mesh>(null)
  const fog = useRef<THREE.Fog>(null)
  const city = useCity()
  const sky = useClouds()
  const skyC = useMemo(() => ({ low: new THREE.Color(SKY_LOW), bg: new THREE.Color(BG) }), [])
  const blobTex = useBlob()
  const dustRes = useMemo(() => ({ geo: new THREE.RingGeometry(0.8, 1, 64), mat: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, toneMapped: false }) }), [])
  const blobMat = useMemo(() => new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false }), [blobTex])
  useEffect(
    () => () => {
      city.dispose()
      sky.dispose()
      blobTex.dispose()
      blobMat.dispose()
      dustRes.geo.dispose()
      dustRes.mat.dispose()
    },
    [city, sky, blobTex, blobMat, dustRes],
  )
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  useEffect(() => {
    if (sun.current && sunTarget.current) sun.current.target = sunTarget.current
  }, [])

  useFrame(() => {
    stepMap()
    const H = size.height
    const f = camDist(H)
    if (camera.position.z !== f) {
      camera.position.set(0, 0, f)
      camera.near = f * 0.1
      camera.far = f * 5
      camera.updateProjectionMatrix()
    }
    const gg = g.current
    if (!gg) return
    mapGround(gg.matrix, H, mapLive.alt)
    city.meshes.forEach((m) => setGrow(m, mapLive.grow))
    gg.matrixWorldNeedsUpdate = true
    /* หมอกสีพื้นหลังที่ขอบเมือง — เมืองดูไม่มีที่สิ้นสุด */
    /* ลงผ่านเมฆ: ชั้นเมฆบางลงตามความสูง เห็นเมืองข้างใต้ · หมอกจากฟ้าเป็นสีดินปั้น · ก้อนเมฆจางเมื่อเครื่องลงพ้นแล้ว */
    const rv = mapReveal(mapLive.alt)
    ;(sky.deck.material as THREE.MeshBasicMaterial).opacity = 1 - rv
    sky.deck.visible = rv < 0.999
    sky.mat.opacity = 1 - smooth((rv - 0.55) / 0.45)
    sky.mesh.visible = sky.mat.opacity > 0.002
    if (fog.current) {
      fog.current.near = f * 1.02
      fog.current.far = f * 1.75
      fog.current.color.copy(skyC.low).lerp(skyC.bg, rv)
    }
    /* แดดเฉียงจากซ้ายบน ตามจุดที่กล้องมอง (เงาคมทั่วจอ ไม่เปลืองแผนที่เงา) */
    const s = sun.current
    if (s && sunTarget.current) {
      s.position.set(mapLive.px - 7, 14, mapLive.pz - 3)
      sunTarget.current.position.set(mapLive.px, 0, mapLive.pz)
      const k = mapScale(H)
      const ext = Math.max(size.width, H) * 0.95
      const sc = s.shadow.camera
      if (sc.right !== ext) {
        sc.left = -ext
        sc.right = ext
        sc.top = ext
        sc.bottom = -ext
        sc.near = 1
        sc.far = 40 * k
        sc.updateProjectionMatrix()
      }
    }
    /* เงาใต้เครื่อง: เครื่องยิ่งต่ำ เงายิ่งเล็กยิ่งเข้ม + ฝุ่นวงแหวนตอนแตะพื้น */
    const near = 1 - mapLive.alt / ALT0
    if (blob.current) {
      blob.current.visible = mapLive.map > 0.01
      blobMat.opacity = mapLive.map * (0.12 + 0.88 * near ** 1.6)
      const bs = 1 + 0.6 * (1 - near)
      blob.current.scale.set(PHONE_HH * 1.35 * bs, 0.001, PHONE_HH * 2.5 * bs)
    }
    if (dust.current) {
      const t = mapLive.dust
      dust.current.visible = t > 0.001 && t < 0.999
      dust.current.scale.setScalar(PHONE_HH * (1.1 + t * 1.6))
      dustRes.mat.opacity = Math.sin(Math.PI * t) * 0.75
    }
  })

  return (
    <>
      <fog ref={fog} attach="fog" args={[BG, 1000, 3000]} />
      <hemisphereLight args={['#ffffff', '#9fb9e6', 1.7]} />
      <group ref={g} matrixAutoUpdate={false}>
        <directionalLight ref={sun} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
        <object3D ref={sunTarget} />
        <primitive object={city.ground} />
        <primitive object={sky.deck} />
        <primitive object={sky.mesh} />
        {city.meshes.map((m, i) => (
          <primitive key={i} object={m} />
        ))}
        <mesh ref={blob} geometry={city.box} material={blobMat} position={[0.25, 0.145, 0.35]} scale={[PHONE_HH * 1.35, 0.001, PHONE_HH * 2.5]} visible={false} />
        <mesh ref={dust} geometry={dustRes.geo} material={dustRes.mat} position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} />
        <Suspense fallback={null}>
          <Boards box={city.box} cyl={city.cyl} white={city.white} />
          <AppIcon />
        </Suspense>
      </group>
    </>
  )
}

/** ปลุกวาดทุกเฟรมตอนเมืองโผล่ (แคนวาส demand — ตอนซ่อนไม่วาดเลย) */
function Pump({ live }: { live: React.RefObject<boolean> }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (live.current) invalidate()
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [live, invalidate])
  return null
}

const KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  ArrowUp: [0, 1], w: [0, 1], W: [0, 1],
  ArrowDown: [0, -1], s: [0, -1], S: [0, -1],
}

/** แคนวาสเมือง — วางใน z51 ของ WorkStory ใต้แคนวาสของบนจอเครื่อง */
export function MapStage({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const wrap = useRef<HTMLDivElement>(null)
  const clay = useRef<HTMLDivElement>(null)
  const live = useRef(false)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const held = new Set<string>()
    let drag: null | { x: number; y: number; ux: number; uz: number; moved: boolean } = null
    const N = PROJ.length
    const pathAt = (at: number) => {
      const a = Math.max(0, Math.min(N, at))
      const i = Math.min(N - 1, Math.floor(a))
      const t = smooth(a - i)
      return { x: PATH[i].x + (PATH[i + 1].x - PATH[i].x) * t, z: PATH[i].z + (PATH[i + 1].z - PATH[i].z) * t }
    }
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const el = wrap.current
      const f = frame.current
      if (!el || !f) return
      const ph = mapPhase(f.b)
      mapLive.land = ph.land
      mapLive.map = ph.map
      mapLive.alt = ph.alt
      mapLive.dust = ph.dust
      mapLive.grow = ph.grow
      const vis = f.on && ph.map > 0.002
      live.current = vis
      el.style.visibility = vis ? 'visible' : 'hidden'
      el.style.opacity = ph.map.toFixed(3)
      /* ฟ้าหลังเมือง (ช่องที่แคนวาสโปร่ง — ขอบเมืองไกล ๆ) เปลี่ยนเป็นสีดินปั้นตามที่เมืองโผล่ */
      if (clay.current) clay.current.style.opacity = mapReveal(ph.alt).toFixed(3)
      /* เดินได้เมื่อเมืองงอกครบแล้ว */
      const on = vis && ph.map > 0.96 && ph.grow > 0.98
      mapUI.on = on
      el.style.pointerEvents = on ? 'auto' : 'none'
      el.style.cursor = !on ? '' : drag?.moved ? 'grabbing' : mapUI.hover >= 0 ? 'pointer' : 'grab'
      if (!vis) {
        mapUI.ux = mapUI.uz = 0
        mapUI.active = mapUI.hover = mapUI.focus = -1
        mapLive.tx = mapLive.tz = 0
        return
      }
      const at = (Math.min(1, Math.max(0, (ph.post - MAP_SCROLL[0]) / (MAP_SCROLL[1] - MAP_SCROLL[0])))) * N
      mapUI.at = at
      const base = pathAt(at)
      /* ปุ่ม: ทิศบนจอ → ทิศบนพื้น */
      if (on && held.size) {
        let kx = 0
        let ky = 0
        held.forEach((k) => {
          kx += KEYS[k][0]
          ky += KEYS[k][1]
        })
        const v = 9 * dt
        mapUI.ux += (SCREEN_R.x * kx + SCREEN_F.x * ky) * v
        mapUI.uz += (SCREEN_R.z * kx + SCREEN_F.z * ky) * v
      }
      /* คลิกป้าย: เดินไปหาป้าย (ชดเชยจุดทัวร์ของสกรอลล์ตอนนี้) */
      if (mapUI.focus >= 0) {
        const p = PROJ[mapUI.focus]
        mapUI.ux = p.x - base.x
        mapUI.uz = p.z - base.z
        mapUI.focus = -1
      }
      let tx = base.x + mapUI.ux
      let tz = base.z + mapUI.uz
      tx = Math.max(-PAN_MAX, Math.min(PAN_MAX, tx))
      tz = Math.max(-PAN_MAX, Math.min(PAN_MAX, tz))
      mapUI.ux = tx - base.x
      mapUI.uz = tz - base.z
      /* ออก: กลับลานกลาง */
      const back = 1 - ph.out
      mapLive.tx = tx * back
      mapLive.tz = tz * back
      /* ป้ายที่อยู่ตรงจุดมอง */
      let best = -1
      let bd = 2.4 * 2.4
      PROJ.forEach((p, n) => {
        const d = (p.x - mapLive.px) ** 2 + (p.z - mapLive.pz) ** 2
        if (d < bd) {
          bd = d
          best = n
        }
      })
      mapUI.active = on ? best : -1
    }
    raf = requestAnimationFrame(tick)

    const down = (e: PointerEvent) => {
      if (!mapUI.on || e.button !== 0) return
      drag = { x: e.clientX, y: e.clientY, ux: mapUI.ux, uz: mapUI.uz, moved: false }
    }
    const move = (e: PointerEvent) => {
      if (!drag) return
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (!drag.moved && Math.hypot(dx, dy) < 5) return
      drag.moved = true
      /* ลากตามนิ้ว: พื้นเลื่อนตาม → จุดมองเลื่อนสวน (แนวลึกหดตามมุมเงย) */
      const k = mapScale(window.innerHeight)
      const rx = -dx / k
      const fy = dy / (k * Math.sin(MAP_EL))
      mapUI.ux = drag.ux + SCREEN_R.x * rx + SCREEN_F.x * fy
      mapUI.uz = drag.uz + SCREEN_R.z * rx + SCREEN_F.z * fy
    }
    const up = () => {
      /* ลากแล้วปล่อยบนป้าย ไม่นับเป็นคลิก */
      if (drag?.moved) mapUI.focus = -1
      drag = null
    }
    const kd = (e: KeyboardEvent) => {
      if (!mapUI.on || !(e.key in KEYS)) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return
      e.preventDefault()
      held.add(e.key)
    }
    const ku = (e: KeyboardEvent) => held.delete(e.key)
    const blur = () => held.clear()
    const el = wrap.current
    el?.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('blur', blur)
    return () => {
      cancelAnimationFrame(raf)
      el?.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('blur', blur)
      mapLive.tx = mapLive.tz = 0
    }
  }, [frame])

  return (
    <div ref={wrap} className="absolute inset-0" style={{ visibility: 'hidden', opacity: 0, pointerEvents: 'none', touchAction: 'pan-y', background: `linear-gradient(180deg, ${SKY_TOP} 0%, ${SKY_LOW} 100%)` }}>
      <div ref={clay} className="absolute inset-0" style={{ background: `radial-gradient(150% 95% at 50% 118%, #eef5fe 0%, ${BG} 42%, #8fbdf2 74%, #4f8be6 100%)`, opacity: 0 }} />
      <Canvas frameloop="demand" shadows="soft" dpr={[1, 1.5]} camera={{ fov: FOV, position: [0, 0, 1700], near: 100, far: 9000 }} gl={{ antialias: true, alpha: true }} style={{ position: 'absolute', inset: 0, pointerEvents: 'inherit' }}>
        <Pump live={live} />
        <City />
      </Canvas>
    </div>
  )
}

/** ชื่องานของป้ายที่เดินมาถึง (มุมซ้ายล่าง) + คำแนะนำการเดิน — z53 เหนือเครื่อง */
export function MapInfo() {
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const hint = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLSpanElement>(null)
  const sub = useRef<HTMLSpanElement>(null)
  const count = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let raf = 0
    let shown = -2
    let k = 0
    let h = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const r = root.current
      if (!r) return
      r.style.visibility = mapUI.on ? 'visible' : 'hidden'
      if (!mapUI.on) {
        k = h = 0
        shown = -2
        return
      }
      const a = mapUI.active
      k += ((a >= 0 ? 1 : 0) - k) * 0.15
      h += ((mapUI.ux ** 2 + mapUI.uz ** 2 < 1 && mapUI.at < 0.4 ? 1 : 0.55) - h) * 0.1
      if (card.current) {
        card.current.style.opacity = k.toFixed(3)
        card.current.style.transform = `translate3d(0, ${((1 - k) * 14).toFixed(1)}px, 0)`
      }
      if (hint.current) hint.current.style.opacity = h.toFixed(3)
      if (a >= 0 && a !== shown) {
        shown = a
        const w = WORKS[a]
        if (title.current) title.current.textContent = w.name
        if (sub.current) sub.current.textContent = `${w.category} · ${w.sub}`
        if (count.current) count.current.textContent = `${String(a + 1).padStart(2, '0')} / ${String(WORKS.length).padStart(2, '0')}`
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[53] text-[#1b1d24]" style={{ visibility: 'hidden', fontFamily: STORY_FONT }} aria-live="polite">
      <div ref={card} className="absolute bottom-[clamp(20px,5vh,56px)] left-[clamp(16px,4vw,64px)] flex max-w-[min(420px,80vw)] flex-col gap-1 rounded-2xl bg-white/85 px-5 py-4 shadow-[0_12px_30px_rgba(30,35,60,0.14)] backdrop-blur" style={{ opacity: 0 }}>
        <span ref={count} className="text-[12px] font-semibold tracking-[0.12em] text-[#1b1d24]/55" />
        <span ref={title} className="text-[clamp(17px,1.5vw,24px)] leading-tight font-bold tracking-[-0.01em]" />
        <span ref={sub} className="text-[clamp(12px,0.95vw,14px)] text-[#1b1d24]/70" />
      </div>
      <div ref={hint} className="absolute bottom-[clamp(20px,5vh,56px)] left-1/2 -translate-x-1/2 rounded-full bg-[#1b1d24]/80 px-4 py-2 text-[13px] font-semibold whitespace-nowrap text-white">
        Drag or use arrow keys to explore
      </div>
    </div>
  )
}
