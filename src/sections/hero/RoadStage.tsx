import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { WORKS } from './WorksGallery'
import { DEVICE, FOV, STORY_FONT, TAN, smooth, type WorkBeats } from './workMotion'
import { HOME_ICON, ICON_PX, roadCut, roadPhase } from './roadWorld'
import { paintHome } from './RoadHome'

/**
 * Selected Work แบบ "ไอคอนแอปเป็นหลังคา แล้วลงถนน" — ต่อท้ายบท Code (POST_CODE = 'road' ใน ./workMotion) ตาม GIF ref
 *
 *   ตัด    ไอคอนเต็มกลางจอ (เครื่องดันเข้ามาจน ICON_PX — ./BubbleTraveler) → แผ่นไอคอนหนาในแคนวาสนี้ ท่าเดียวกันพอดี
 *          หลังแผ่นยังเป็นหน้าโฮม (wallpaper + ช่องแอปใส) ชุดเดียวกับจอเครื่อง
 *   หงาย   แผ่นหงายราบเป็นหลังคา เผยใต้หลังคาน้ำเงิน ขอบคาดแดง · เสาขาวคาดแดงงอกลงสี่มุม · กล้องลดต่ำลงเห็นใต้หลังคา
 *   โฉบ    หน้าโฮมจางเป็นโลกจริง กล้องโฉบลอดข้างหลังคาลงระดับพื้น เอียงแล้วตั้งตรง มุมกว้างขึ้น
 *   ขับ    สกรอลล์ = เคลื่อนไปตามถนนฟ้า เสาขาวคาดแดงริมทาง ตึกกล่องน้ำเงิน ต้นสนเข้ม ฟ้าโค้งไล่ขาวที่ขอบฟ้า
 *          ป้ายผลงาน (ปกงานจริงจาก WORKS) ตั้งสลับซ้ายขวา · ผ่านป้ายไหน ชื่องานขึ้นมุมซ้ายล่าง (RoadInfo)
 *   ออก    ย้อนทางเดิมกลับขึ้นหลังคา แผ่นตั้งกลับเป็นไอคอน ตัดกลับเครื่อง (ต้นบท Ship)
 *
 * หน่วยโลก = เมตรคร่าว ๆ · y ขึ้น · ถนนวิ่งไปทาง -z · หลังคาอยู่เหนือจุดเริ่มถนน
 */

/** ไอคอน/หลังคา: ด้าน · หนา · ความสูงหลังคา */
const ICON_S = 4
const ICON_D = 0.42
const ROOF = 3.4
/** ระยะกล้องตอนตัด: ไอคอนด้าน ICON_S กว้าง ICON_PX ของความสูงจอ ที่มุมกล้องเดียวกับแคนวาสเครื่อง */
const D0 = ICON_S / (2 * TAN * ICON_PX)
/** มุมกล้องตอนลงถนนแล้ว (องศา — กว้างแบบ GIF) */
const FOV_ROAD = 58
/** ความคืบหน้าโฉบที่หน้าโฮมหลังหลังคาตัดเป็นโลกจริง */
const WALL_CUT = 0.12

const C = {
  bg: '#eef4fc',
  road: '#0a84d6',
  line: '#ffffff',
  shoulder: '#0b1d5e',
  walk: '#dbe8fa',
  ground: '#1262c2',
  under: '#1d5fbf',
  belly: '#0b1d5e',
  stripe: '#e5242c',
  post: '#ffffff',
  tree: '#0a1f5c',
  bush: '#0d2366',
  window: '#061238',
  fog: '#d9e7fb',
}
const TOWER = ['#1e4fb5', '#2a64cc', '#163f99', '#3a78d8', '#2557bd']

/** ถนน: ครึ่งกว้าง · ไหล่ทาง · ระยะเสาริมทาง · ระยะป้ายผลงาน */
const HALF = 3
const SHOULDER = 2.4
const POST_GAP = 9
const BOARD = { w: 3.6, h: 2.25, y: 2.5, x: 5.6, z0: -12, gap: 11 }
const PROJ = WORKS.map((w, n) => ({ w, side: n % 2 ? -1 : 1, z: BOARD.z0 - n * BOARD.gap }))
const Z_END = PROJ[PROJ.length - 1].z - 4
const FAR = Z_END - 120

/** สถานะร่วมต่อเฟรม (ไม่ใช่ React state) — ป้ายที่กำลังผ่าน · RoadInfo อ่าน */
const roadUI = { on: false, active: -1 }
const roadLive = { flip: 0, swoop: 0, drive: 0, cut: false }

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
const IO = new THREE.Object3D()
/** ของซ้ำ: หนึ่งรูปทรง + หนึ่งวัสดุ = หนึ่ง draw call */
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, list: Inst[]) {
  const m = new THREE.InstancedMesh(geo, mat, list.length)
  const col = new THREE.Color()
  list.forEach((it, i) => {
    IO.position.set(...it.p)
    IO.scale.set(...it.s)
    IO.rotation.set(0, it.ry ?? 0, 0)
    IO.updateMatrix()
    m.setMatrixAt(i, IO.matrix)
    if (it.c) m.setColorAt(i, col.set(it.c))
  })
  m.computeBoundingSphere()
  return m
}

/** โลกถนนทั้งหมด — สร้างครั้งเดียว สุ่มแบบมีเมล็ด */
function useWorld() {
  return useMemo(() => {
    const r = rng(11)
    const box = new THREE.BoxGeometry(1, 1, 1)
    const cone = new THREE.ConeGeometry(0.5, 1, 7)
    const bush = new THREE.IcosahedronGeometry(0.5, 0)
    const flat = (c: string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true })
    const mats = { white: flat('#ffffff'), road: flat(C.road), line: flat(C.line), shoulder: flat(C.shoulder), walk: flat(C.walk), ground: flat(C.ground), stripe: flat(C.stripe), tree: flat(C.tree), bush: flat(C.bush), window: flat(C.window) }
    const len = 20 - FAR
    const zc = (20 + FAR) / 2
    const strips: [THREE.Material, number, number][] = [
      [mats.ground, 0, 400],
      [mats.walk, -(HALF + SHOULDER + 2.5), 5],
      [mats.shoulder, HALF + SHOULDER / 2, SHOULDER],
      [mats.shoulder, -(HALF + SHOULDER / 2), SHOULDER],
      [mats.road, 0, HALF * 2],
      [mats.line, HALF - 0.1, 0.16],
      [mats.line, -(HALF - 0.1), 0.16],
    ]
    const ground = strips.map(([m, x, w], i) => {
      const mesh = new THREE.Mesh(box, m)
      mesh.scale.set(w, 0.02, i === 0 ? 900 : len)
      mesh.position.set(x, -0.01 + i * 0.002, zc)
      return mesh
    })
    /* เสาริมทาง: ขาวสูง คาดแดงหนึ่งแถบ (แบบเสาใน GIF) */
    const posts: Inst[] = []
    const bands: Inst[] = []
    /* เริ่มเลยหลังคาไป — ทางโฉบลอดใต้หลังคาต้องโล่ง */
    for (let z = -6; z > FAR + 20; z -= POST_GAP)
      for (const sx of [1, -1]) {
        const x = sx * (HALF + 0.6)
        posts.push({ p: [x, 1.4, z], s: [0.32, 2.8, 0.32] })
        bands.push({ p: [x, 2.0, z], s: [0.34, 0.3, 0.34] })
      }
    /* ตึกกล่องน้ำเงิน · แถบหน้าต่างเข้ม · ต้นสน · พุ่มกลม */
    const towers: Inst[] = []
    const windows: Inst[] = []
    const trees: Inst[] = []
    const bushes: Inst[] = []
    for (let z = 4; z > FAR; z -= 2.2 + r() * 3) {
      for (const sx of [1, -1]) {
        if (r() < 0.25) continue
        const x = sx * (HALF + SHOULDER + 3 + r() * 22)
        /* เว้นที่ให้ป้ายผลงาน */
        if (Math.abs(x) < 10 && PROJ.some((p) => p.side === sx && Math.abs(p.z - z) < 3.5)) continue
        const kind = r()
        if (kind < 0.55) {
          const w = 2 + r() * 4
          const d = 2 + r() * 4
          const h = 1 + r() * r() * 7
          towers.push({ p: [x, h / 2, z], s: [w, h, d], c: TOWER[Math.floor(r() * TOWER.length)] })
          if (h > 1.8 && r() < 0.7) windows.push({ p: [x, h * (0.45 + r() * 0.3), z], s: [w + 0.04, 0.35, d + 0.04] })
        } else if (kind < 0.82) {
          const k = 0.8 + r() * 0.9
          trees.push({ p: [x, 1.3 * k, z], s: [1.4 * k, 2.6 * k, 1.4 * k], ry: r() * Math.PI })
        } else {
          const k = 1 + r() * 1.2
          bushes.push({ p: [x, 0.8 * k, z], s: [1.8 * k, 1.6 * k, 1.8 * k], ry: r() * Math.PI })
        }
      }
    }
    /* ป้ายขาวคาดแดงไกล ๆ ปลายถนน (แบบปั๊มใน GIF) */
    const sign: Inst[] = [
      { p: [-HALF - 4, 2.2, Z_END - 40], s: [3.2, 2.6, 0.3] },
      { p: [HALF + 6, 1.8, Z_END - 55], s: [2.6, 2.2, 0.3] },
    ]
    const signBands: Inst[] = sign.map((s) => ({ p: [s.p[0], s.p[1] + 0.5, s.p[2] + 0.01], s: [s.s[0] + 0.02, 0.22, s.s[2] + 0.02] }))
    const meshes = [
      instanced(box, mats.white, posts),
      instanced(box, mats.stripe, bands),
      instanced(box, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), towers),
      instanced(box, mats.window, windows),
      instanced(cone, mats.tree, trees),
      instanced(bush, mats.bush, bushes),
      instanced(box, mats.white, sign),
      instanced(box, mats.stripe, signBands),
    ]
    /* ฟ้าโค้ง: โดมไล่สี บนน้ำเงินเข้ม → ขาวที่ขอบฟ้า */
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color('#0a2a7a') }, mid: { value: new THREE.Color('#3f7fd6') }, low: { value: new THREE.Color('#eaf2ff') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main(){ float h = max(vP.y, 0.0); vec3 c = mix(low, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.15, 0.6, h)); gl_FragColor = vec4(c, 1.0); }',
    })
    const dome = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), domeMat)
    dome.renderOrder = -1
    return {
      box,
      mats,
      ground,
      meshes,
      dome,
      dispose: () => {
        box.dispose()
        cone.dispose()
        bush.dispose()
        Object.values(mats).forEach((m) => m.dispose())
        meshes.forEach((m) => {
          ;(m.material as THREE.Material).dispose()
          m.dispose()
        })
        dome.geometry.dispose()
        domeMat.dispose()
      },
    }
  }, [])
}

/** แผ่นไอคอน → หลังคา: หน้า favicon · ตัวน้ำเงิน · ขอบคาดแดง · ท้องน้ำเงินเข้ม + เสาสี่มุม · หน้าโฮมข้างหลัง (ตอนยังเป็นไอคอน) */
function Canopy({ box }: { box: THREE.BoxGeometry }) {
  const tex = useTexture('/favicon-512.png')
  const slab = useRef<THREE.Group>(null)
  const legs = useRef<(THREE.Group | null)[]>([])
  const wall = useRef<THREE.Mesh>(null)
  const res = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    const rr = (s: number, r: number) => {
      const h = s / 2 - r
      const sh = new THREE.Shape()
      sh.absarc(h, h, r, 0, Math.PI / 2, false)
      sh.absarc(-h, h, r, Math.PI / 2, Math.PI, false)
      sh.absarc(-h, -h, r, Math.PI, Math.PI * 1.5, false)
      sh.absarc(h, -h, r, Math.PI * 1.5, Math.PI * 2, false)
      return sh
    }
    const R = ICON_S * 0.225
    const body = new THREE.ExtrudeGeometry(rr(ICON_S, R), { depth: ICON_D, bevelEnabled: false, curveSegments: 12 })
    body.translate(0, 0, -ICON_D)
    const band = new THREE.ExtrudeGeometry(rr(ICON_S + 0.05, R + 0.025), { depth: 0.07, bevelEnabled: false, curveSegments: 12 })
    band.translate(0, 0, -0.16)
    const belly = new THREE.ExtrudeGeometry(rr(ICON_S - 0.5, R - 0.25), { depth: 0.22, bevelEnabled: false, curveSegments: 12 })
    belly.translate(0, 0, -ICON_D - 0.2)
    const wallTex = paintHome()
    /* หน้าโฮมข้างหลังไอคอน: ขนาด/ตำแหน่งตามจอเครื่อง (ไอคอนบนจอ = แผ่นนี้) */
    const u = ICON_S / HOME_ICON.s
    return {
      body,
      band,
      belly,
      face: new THREE.PlaneGeometry(ICON_S, ICON_S),
      faceMat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, toneMapped: false }),
      bodyMat: new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }),
      underMat: new THREE.MeshLambertMaterial({ color: C.under, flatShading: true }),
      bellyMat: new THREE.MeshLambertMaterial({ color: C.belly, flatShading: true }),
      stripeMat: new THREE.MeshLambertMaterial({ color: C.stripe, flatShading: true }),
      postMat: new THREE.MeshLambertMaterial({ color: C.post, flatShading: true }),
      wallTex,
      /* ทึบ วาดก่อนสุด (ไม่เทสต์ความลึก) = ฉากหลังของแผ่นไอคอน · โลกจริงซ่อนอยู่จนตัด (WALL_CUT) */
      wallMat: new THREE.MeshBasicMaterial({ map: wallTex, depthTest: false, depthWrite: false, toneMapped: false, fog: false }),
      wallScale: [DEVICE.hw * 2 * u, DEVICE.hh * 2 * u, 1] as [number, number, number],
      wallPos: [-HOME_ICON.x * u, ROOF - HOME_ICON.y * u, -0.6] as [number, number, number],
    }
  }, [tex])
  useEffect(
    () => () => {
      ;[res.body, res.band, res.belly, res.face].forEach((g) => g.dispose())
      ;[res.faceMat, res.bodyMat, res.underMat, res.bellyMat, res.stripeMat, res.postMat, res.wallMat].forEach((m) => m.dispose())
      res.wallTex.dispose()
    },
    [res],
  )
  useFrame(() => {
    const f = roadLive.flip
    const s = slab.current
    if (s) s.rotation.x = (-Math.PI / 2) * f
    /* เสางอกลงจากใต้หลังคาตอนหงายเกือบราบ */
    const gk = smooth((f - 0.45) / 0.55)
    legs.current.forEach((l) => {
      if (!l) return
      l.visible = gk > 0.001
      l.scale.y = Math.max(1e-3, gk)
    })
    /* หน้าโฮมหายตอนกล้องเริ่มโฉบเร็ว — ตัดเป็นโลกจริงกลางการเคลื่อนที่ (แบบ GIF: ไม่จาง จางแล้วทับหลังคา) */
    const w = wall.current
    if (w) w.visible = roadLive.swoop < WALL_CUT
  })
  const leg = ICON_S / 2 - 0.55
  return (
    <>
      <mesh ref={wall} geometry={res.face} material={res.wallMat} position={res.wallPos} scale={[res.wallScale[0] / ICON_S, res.wallScale[1] / ICON_S, 1]} renderOrder={-2} />
      <group ref={slab} position={[0, ROOF, 0]}>
        <mesh geometry={res.body} material={[res.bodyMat, res.underMat]} />
        <mesh geometry={res.band} material={res.stripeMat} />
        <mesh geometry={res.belly} material={res.bellyMat} />
        <mesh geometry={res.face} material={res.faceMat} position={[0, 0, 0.012]} />
      </group>
      {[
        [leg, leg],
        [-leg, leg],
        [leg, -leg],
        [-leg, -leg],
      ].map(([x, z], i) => (
        <group
          key={i}
          ref={(n) => {
            legs.current[i] = n
          }}
          position={[x, ROOF - ICON_D, z]}
          visible={false}
        >
          <mesh geometry={box} material={res.postMat} position={[0, -(ROOF - ICON_D) / 2, 0]} scale={[0.34, ROOF - ICON_D, 0.34]} />
          <mesh geometry={box} material={res.stripeMat} position={[0, -(ROOF - ICON_D) * 0.38, 0]} scale={[0.36, 0.3, 0.36]} />
        </group>
      ))}
    </>
  )
}

/** ป้ายผลงานริมทาง: เสาขาวคาดแดงคู่ + กรอบขาว + ปกงาน (ครอปเต็มกรอบ) · หันเข้าหาถนน */
function Boards({ box }: { box: THREE.BoxGeometry }) {
  const tex = useTexture(PROJ.map((p) => p.w.img))
  const res = useMemo(() => {
    const aspect = BOARD.w / BOARD.h
    const mats = tex.map((t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      const img = t.image as { width: number; height: number } | undefined
      const a = img ? img.width / img.height : aspect
      /* ครอปให้เต็มกรอบ (cover) */
      if (a > aspect) {
        t.repeat.set(aspect / a, 1)
        t.offset.set((1 - aspect / a) / 2, 0)
      } else {
        t.repeat.set(1, a / aspect)
        t.offset.set(0, (1 - a / aspect) / 2)
      }
      return new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
    })
    return { mats, plane: new THREE.PlaneGeometry(1, 1), white: new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), red: new THREE.MeshLambertMaterial({ color: C.stripe, flatShading: true }) }
  }, [tex])
  useEffect(
    () => () => {
      res.mats.forEach((m) => m.dispose())
      res.plane.dispose()
      res.white.dispose()
      res.red.dispose()
    },
    [res],
  )
  return (
    <>
      {PROJ.map((p, n) => (
        <group key={n} position={[p.side * BOARD.x, 0, p.z]} rotation={[0, -p.side * 0.5, 0]}>
          {[-1, 1].map((k) => (
            <group key={k} position={[k * (BOARD.w / 2 - 0.35), 0, -0.12]}>
              <mesh geometry={box} material={res.white} position={[0, BOARD.y / 2, 0]} scale={[0.22, BOARD.y, 0.22]} />
              <mesh geometry={box} material={res.red} position={[0, BOARD.y * 0.5, 0]} scale={[0.24, 0.24, 0.24]} />
            </group>
          ))}
          <mesh geometry={box} material={res.white} position={[0, BOARD.y + BOARD.h / 2 - 0.2, 0]} scale={[BOARD.w + 0.24, BOARD.h + 0.24, 0.16]} />
          <mesh geometry={res.plane} material={res.mats[n]} position={[0, BOARD.y + BOARD.h / 2 - 0.2, 0.085]} scale={[BOARD.w, BOARD.h, 1]} />
        </group>
      ))}
    </>
  )
}

const V0 = new THREE.Vector3()
const V1 = new THREE.Vector3()
const LOOK = new THREE.Vector3()
const LK1 = new THREE.Vector3()
const LK2 = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)
const Q_ROLL = new THREE.Quaternion()
const AX_Z = new THREE.Vector3(0, 0, 1)
const M_LOOK = new THREE.Matrix4()
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const bez = (out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number) => {
  const u = 1 - t
  return out.set(u * u * a.x + 2 * u * t * b.x + t * t * c.x, u * u * a.y + 2 * u * t * b.y + t * t * c.y, u * u * a.z + 2 * u * t * b.z + t * t * c.z)
}
/**
 * ท่ากล้องหลังหงาย (สูงกว่าหลังคา มองกดลง — เห็นหน้าไอคอนเอียงไป + โครงใต้หลังคากับเสาแบบ GIF) · กลางทางโฉบ (ลอดใต้หลังคา
 * ระหว่างเสาสี่ต้น) · ลงถนน
 */
const CAM_FLIP = new THREE.Vector3(0, ROOF + 2.6, D0 * 0.5)
const CAM_MID = new THREE.Vector3(0.9, 2.2, 3.6)
const CAM_ROAD = new THREE.Vector3(0.7, 1.15, -4.5)

function World() {
  const world = useWorld()
  const env = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  useEffect(() => () => world.dispose(), [world])
  useFrame(() => {
    const { flip: f, swoop: sw, drive: dr } = roadLive
    /* โลกโผล่ตอนเริ่มโฉบ (ก่อนนั้นหลังไอคอนคือหน้าโฮม — พื้นใกล้ ๆ ห้ามโผล่ทะลุ) */
    if (env.current) env.current.visible = sw >= WALL_CUT
    /* หงาย: จากหน้าตรงระดับไอคอน → ต่ำกว่าหลังคานิด ใกล้ขึ้น */
    V0.set(0, ROOF, D0).lerp(CAM_FLIP, smooth(f))
    LOOK.set(0, ROOF - 0.6 * smooth(f), 0)
    /* โฉบ: โค้งออกข้างแล้วลงถนน · สายตาจากหลังคา → ปลายถนน · เอียงวูบแล้วตั้งตรง */
    if (sw > 0) {
      bez(V1, CAM_FLIP, CAM_MID, CAM_ROAD, sw)
      V0.copy(V1)
      LK1.set(0, ROOF - 0.6, 0)
      LK2.set(0, 1.2, -60)
      LOOK.copy(LK1).lerp(LK2, smooth(sw * 1.25))
    }
    /* ขับ: ไปตามถนน โยกเบา ๆ */
    if (dr > 0) {
      const z = lerp(CAM_ROAD.z, Z_END, dr)
      const t = performance.now() / 1000
      V0.set(lerp(CAM_ROAD.x, 0, smooth(dr * 6)), CAM_ROAD.y + Math.sin(t * 1.3) * 0.03, z)
      LOOK.set(0, 1.2, z - 60)
    }
    camera.position.copy(V0)
    M_LOOK.lookAt(V0, LOOK, UP)
    camera.quaternion.setFromRotationMatrix(M_LOOK)
    const roll = -0.42 * Math.sin(Math.PI * Math.min(1, sw * 1.1))
    camera.quaternion.multiply(Q_ROLL.setFromAxisAngle(AX_Z, roll))
    const fov = lerp(FOV, FOV_ROAD, smooth(sw))
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    /* ป้ายที่กำลังผ่าน: ข้างหน้ากล้องไม่เกินราว 12 หน่วย */
    let best = -1
    let bd = 1e9
    if (dr > 0.002) {
      PROJ.forEach((p, n) => {
        const d = camera.position.z - p.z
        if (d > -2 && d < 13 && d < bd) {
          bd = d
          best = n
        }
      })
    }
    roadUI.active = best
  })
  return (
    <>
      <group ref={env} visible={false}>
        <primitive object={world.dome} />
        {world.ground.map((m, i) => (
          <primitive key={i} object={m} />
        ))}
        {world.meshes.map((m, i) => (
          <primitive key={`m${i}`} object={m} />
        ))}
        <Suspense fallback={null}>
          <Boards box={world.box} />
        </Suspense>
      </group>
      <Suspense fallback={null}>
        <Canopy box={world.box} />
      </Suspense>
    </>
  )
}

/** ปลุกวาดทุกเฟรมตอนฉากถนนคุมภาพ (แคนวาส demand — ตอนซ่อนไม่วาดเลย) */
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

/** แคนวาสถนน — วางใน z51 ของ WorkStory ใต้แคนวาสของบนจอเครื่อง · พื้นสว่างกลบฉาก Code ตั้งแต่จอเป็นหน้าโฮม */
export function RoadStage({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLDivElement>(null)
  const live = useRef(false)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = wrap.current
      const f = frame.current
      if (!el || !f) return
      const ph = roadPhase(f.b)
      const cut = roadCut(ph)
      roadLive.flip = ph.flip
      roadLive.swoop = ph.swoop
      roadLive.drive = ph.drive
      roadLive.cut = cut
      const vis = f.on && ph.home > 0.002
      el.style.visibility = vis ? 'visible' : 'hidden'
      el.style.opacity = Math.min(1, ph.home * 1.4).toFixed(3)
      live.current = vis && cut
      if (cv.current) cv.current.style.visibility = live.current ? 'visible' : 'hidden'
      roadUI.on = live.current && ph.drive > 0.002
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame])
  return (
    <div ref={wrap} className="pointer-events-none absolute inset-0" style={{ visibility: 'hidden', opacity: 0, background: `radial-gradient(120% 90% at 50% 40%, #ffffff 0%, ${C.bg} 60%, #dbe7f8 100%)` }}>
      <div ref={cv} className="absolute inset-0" style={{ visibility: 'hidden' }}>
        <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ fov: FOV, position: [0, ROOF, D0], near: 0.1, far: 1500 }} gl={{ antialias: true }} style={{ position: 'absolute', inset: 0 }}>
          <fog attach="fog" args={[C.fog, 40, 240]} />
          <hemisphereLight args={['#ffffff', '#1b3d8f', 1.5]} />
          <directionalLight position={[-30, 40, 20]} intensity={2.3} />
          <Pump live={live} />
          <World />
        </Canvas>
      </div>
    </div>
  )
}

/** ชื่องานของป้ายที่กำลังผ่าน (มุมซ้ายล่าง) — z53 เหนือเครื่อง */
export function RoadInfo() {
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLSpanElement>(null)
  const sub = useRef<HTMLSpanElement>(null)
  const count = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let raf = 0
    let shown = -2
    let k = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const r = root.current
      if (!r) return
      r.style.visibility = roadUI.on ? 'visible' : 'hidden'
      if (!roadUI.on) {
        k = 0
        shown = -2
        return
      }
      const a = roadUI.active
      k += ((a >= 0 ? 1 : 0) - k) * 0.15
      if (card.current) {
        card.current.style.opacity = k.toFixed(3)
        card.current.style.transform = `translate3d(0, ${((1 - k) * 14).toFixed(1)}px, 0)`
      }
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
    <div ref={root} className="pointer-events-none fixed inset-0 z-[53] text-[#0b1d5e]" style={{ visibility: 'hidden', fontFamily: STORY_FONT }} aria-live="polite">
      <div ref={card} className="absolute bottom-[clamp(20px,5vh,56px)] left-[clamp(16px,4vw,64px)] flex max-w-[min(420px,80vw)] flex-col gap-1 rounded-2xl bg-white/90 px-5 py-4 shadow-[0_12px_30px_rgba(11,29,94,0.18)] backdrop-blur" style={{ opacity: 0 }}>
        <span ref={count} className="text-[12px] font-semibold tracking-[0.12em] text-[#0b1d5e]/55" />
        <span ref={title} className="text-[clamp(17px,1.5vw,24px)] leading-tight font-bold tracking-[-0.01em]" />
        <span ref={sub} className="text-[clamp(12px,0.95vw,14px)] text-[#0b1d5e]/70" />
      </div>
    </div>
  )
}
