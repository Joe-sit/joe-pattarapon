import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import penNibSvg from '@/assets/icons/pen-nib.svg?raw'
import { aboutBox, aboutCubeBox, globeTarget } from './aboutBox'

/**
 * What I do = โลกของ Joe (ภาพอ้างอิง: ลูกโลกผิวกระเบื้องนูนไล่ฟ้าเขียว-น้ำเงิน ร่องขาว ลูกแก้วลอยรอบ)
 *
 * ฟองแชท "Here is what I do" ค่อย ๆ แบนลงเป็นกระเบื้องแผ่นหนึ่งบนลูกโลก (กระเบื้องบ้าน — BubbleTraveler
 * หลอมทรงฟองไปที่มุมของแผ่นนี้บนจอ) · เลื่อนต่อ ลูกโลกหมุนพาเที่ยวสามย่านของสามสกิล:
 *   Design   ปากกาออกแบบยักษ์ปักกลางลาน มีวงคลื่นแผ่จากโคน (ท่า "แตะ" ในภาพอ้างอิง)
 *   Coding   ตึกบล็อกงอกเป็นเมือง ยอดบนลอยเครื่องหมาย </>
 *   Research แว่นขยายลอยส่องโดมเรืองแสงที่ผุดจากพื้น
 * ย่านโผล่พ้นขอบฟ้าทีละย่านเมื่อถึงคิว ป้ายสกิล (AboutTags) ขึ้นคำอธิบายจริง · ตอนจบหมุนกลับบ้าน ฟองลอยออกจากพื้น
 *
 * หน่วย = พิกเซล (กล้องเพอร์สเปกทีฟของแคนวาสนี้เห็นระนาบ z 0 หนึ่งหน่วยต่อพิกเซล — ดู AboutWidgets)
 * ลูกโลกหมุนรอบแกน x: พิกัดบนผิว (α, β) — α = มุมจากยอดไปข้างหลัง (บวก = หลังยอด ยังไม่เห็น) β = มุมออกข้าง
 */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}
const outBack = (x: number) => {
  const u = clamp01(x) - 1
  return 1 + 2.4 * u * u * u + 1.4 * u * u
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const rnd = (i: number, k = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** ทิศบนผิว (หน่วย) จากพิกัด (α, β) */
function dirAB(a: number, b: number, out = new THREE.Vector3()) {
  return out.set(Math.sin(b), Math.cos(b) * Math.cos(a), -Math.cos(b) * Math.sin(a))
}

/** มุม α ของจุดที่อยู่หน้าสุดบนยอด (มุมมองตั้งต้น) — กระเบื้องบ้านอยู่ตรงนี้ */
const HOME_A = -0.55
/** ย่านของสามสกิล (α, β) — หมุนลูกโลกไป α - HOME_A ย่านนั้นมาอยู่ตำแหน่งบ้าน */
const LAND = [
  { a: 0.42, b: -0.06 },
  { a: 1.12, b: 0.06 },
  { a: 1.82, b: -0.04 },
] as const

const TEAL = new THREE.Color('#38e3c4')
const BLUE = new THREE.Color('#3d6bff')
const DEEP = new THREE.Color('#2a4fe8')

type Arr = { pos: number[]; col: number[]; idx: number[] }
/**
 * กระเบื้องหนึ่งแผ่น: ผิวบนโค้งตามลูกโลก มุมมน (บิดตารางสี่เหลี่ยมเข้าหาวงกลมบางส่วน) + ผนังรอบขอบลงไปถึงผิวลูกโลก
 * สีผิวบนไล่ฟ้าเขียวกลาง → น้ำเงินขอบ (ตามภาพอ้างอิง) ผนังน้ำเงินเข้ม
 */
function pushTile(o: Arr, R: number, h: number, a0: number, a1: number, b0: number, b1: number, hue: number) {
  const N = 9
  const base = o.pos.length / 3
  const ac = (a0 + a1) / 2
  const bc = (b0 + b1) / 2
  const ha = (a1 - a0) / 2
  const hb = (b1 - b0) / 2
  const P = new THREE.Vector3()
  const C = new THREE.Color()
  /* ผิวบน N×N */
  for (let j = 0; j <= N; j += 1)
    for (let i = 0; i <= N; i += 1) {
      const u = (i / N) * 2 - 1
      const v = (j / N) * 2 - 1
      const k = 0.38
      const uu = lerp(u, u * Math.sqrt(1 - (v * v) / 2), k)
      const vv = lerp(v, v * Math.sqrt(1 - (u * u) / 2), k)
      dirAB(ac + vv * ha, bc + uu * hb, P).multiplyScalar(R + h)
      o.pos.push(P.x, P.y, P.z)
      const edge = Math.min(1, Math.max(Math.abs(uu), Math.abs(vv)))
      C.copy(TEAL).lerp(BLUE, clamp01(hue * 0.6 + edge * edge * 0.75))
      o.col.push(C.r, C.g, C.b)
    }
  for (let j = 0; j < N; j += 1)
    for (let i = 0; i < N; i += 1) {
      const a = base + j * (N + 1) + i
      const b = a + 1
      const c = a + N + 1
      const d = c + 1
      /* ลำดับจุดให้หน้าหันออกนอกลูกโลก */
      o.idx.push(a, b, c, b, d, c)
    }
  /* ผนัง: ไล่รอบขอบผิวบน แล้วต่อลงไปที่ผิวลูกโลก */
  const ring: number[] = []
  for (let i = 0; i <= N; i += 1) ring.push(i)
  for (let j = 1; j <= N; j += 1) ring.push(j * (N + 1) + N)
  for (let i = N - 1; i >= 0; i -= 1) ring.push(N * (N + 1) + i)
  for (let j = N - 1; j >= 1; j -= 1) ring.push(j * (N + 1))
  const wb = o.pos.length / 3
  for (const r of ring) {
    const x = o.pos[(base + r) * 3]
    const y = o.pos[(base + r) * 3 + 1]
    const z = o.pos[(base + r) * 3 + 2]
    const l = Math.hypot(x, y, z)
    o.pos.push(x, y, z, (x / l) * R, (y / l) * R, (z / l) * R)
    o.col.push(DEEP.r, DEEP.g, DEEP.b, DEEP.r * 0.85, DEEP.g * 0.85, DEEP.b * 0.85)
  }
  const n = ring.length
  for (let q = 0; q < n; q += 1) {
    const a = wb + q * 2
    const b = wb + ((q + 1) % n) * 2
    o.idx.push(a, b, a + 1, b, b + 1, a + 1)
  }
}

function geoFrom(o: Arr) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3))
  g.setIndex(o.idx)
  g.computeVertexNormals()
  return g
}

/** ลูกแก้วไล่สี (ภาพอ้างอิง): ไล่สองสีตามทิศผิว + ขอบสว่าง + จุดสะท้อนนุ่ม */
function orbMaterial(a: string, b: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uA; uniform vec3 uB; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN);
        float g = clamp(0.5 + n.y * 0.55 - n.x * 0.25, 0.0, 1.0);
        vec3 c = mix(uB, uA, g);
        float rim = pow(1.0 - max(dot(n, vV), 0.0), 2.2);
        c = mix(c, vec3(1.0), rim * 0.55);
        float sp = pow(max(dot(reflect(-normalize(vec3(-0.4, 0.7, 0.6)), n), vV), 0.0), 18.0);
        c += sp * 0.35;
        gl_FragColor = vec4(c, 0.92 - rim * 0.2);
        #include <colorspace_fragment>
      }`,
  })
}

const ORBS = [
  { x: -0.06, y: 0.27, z: -0.15, r: 0.155, a: '#9ff5e4', b: '#2fc7c0', ph: 0 },
  { x: -0.34, y: 0.06, z: 0.05, r: 0.075, a: '#9dd4ff', b: '#5b6dff', ph: 1.7 },
  { x: -0.37, y: -0.01, z: 0.1, r: 0.04, a: '#f0a6ff', b: '#7e6bff', ph: 2.2 },
  { x: 0.2, y: 0.33, z: -0.2, r: 0.04, a: '#a8d8ff', b: '#3d6bff', ph: 3.1 },
  { x: 0.42, y: 0.22, z: -0.25, r: 0.014, a: '#b6fff0', b: '#38e3c4', ph: 4 },
  { x: 0.33, y: -0.02, z: -0.4, r: 0.06, a: '#7fb2ff', b: '#3d55f0', ph: 5 },
]

export function AboutGlobe() {
  const { size, camera } = useThree()
  const font = useLoader(FontLoader, '/fonts/momo-trust-sans.json')
  const W = size.width
  const H = size.height
  /* รัศมีตามความกว้างจอ — ขอบฟ้าโค้งกว้างแบบภาพอ้างอิง */
  const R = Math.max(W, H * 1.4) * 1.05
  const TH = R * 0.016

  const world = useRef<THREE.Group>(null)
  const sky = useRef<THREE.Group>(null)
  const globe = useRef<THREE.Group>(null)
  const home = useRef<THREE.Mesh>(null)
  const lands = useRef<(THREE.Group | null)[]>([])
  const orbs = useRef<(THREE.Mesh | null)[]>([])
  const ripples = useRef<(THREE.Mesh | null)[]>([])

  const geos = useMemo(() => {
    const field: Arr = { pos: [], col: [], idx: [] }
    /* ตารางกระเบื้อง: แถวตาม α ช่องตาม β — บางช่องรวมกันเป็นแผ่นยาว เว้นร่องขาว ไม่ปูทับบ้าน/ย่าน */
    const da = 0.085
    const db = 0.1
    let id = 0
    for (let a = -1.25; a < 2.45; a += da) {
      let b = -1.0 + rnd(Math.round(a * 100), 3) * db
      while (b < 1.0) {
        const span = 1 + Math.floor(rnd(id, 1) * 3)
        const b1 = b + db * span
        id += 1
        const ac = a + da / 2
        const bc = (b + b1) / 2
        const nearHome = Math.abs(ac - HOME_A) < da * 1.3 && Math.abs(bc) < 0.26
        const nearLand = LAND.some((l) => Math.abs(ac - l.a) < 0.12 && Math.abs(bc - l.b) < 0.17)
        if (!nearHome && !nearLand && rnd(id, 2) > 0.12) pushTile(field, R, TH * (0.7 + rnd(id, 4) * 0.6), a + da * 0.09, a + da * 0.91, b + db * 0.09, b1 - db * 0.09, rnd(id, 5))
        b = b1
      }
    }
    /* กระเบื้องบ้าน — ฟองแชทลงมาเป็นแผ่นนี้ (ขนาดราวฟอง: กว้าง ~0.3 rad) */
    const homeArr: Arr = { pos: [], col: [], idx: [] }
    pushTile(homeArr, R, TH, HOME_A - da * 0.8, HOME_A + da * 0.8, -0.16, 0.16, 0.35)
    /* ลานของแต่ละย่าน — แผ่นใหญ่ใต้สัญลักษณ์ */
    const plaza: Arr = { pos: [], col: [], idx: [] }
    LAND.forEach((l, i) => pushTile(plaza, R, TH * 1.4, l.a - 0.1, l.a + 0.1, l.b - 0.15, l.b + 0.15, 0.2 + i * 0.1))
    const pen = new THREE.ExtrudeGeometry(
      new SVGLoader().parse(penNibSvg).paths.flatMap((p) => SVGLoader.createShapes(p)),
      { depth: 6, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 0.8, bevelSegments: 4, curveSegments: 10 },
    )
    /* กลับแกน y ด้วยการหมุน 180° (สเกลลบแกนเดียวกลับด้านหน้า แสงมืด) แล้วกลับซ้ายขวาคืน */
    pen.translate(-16, -16, -3)
    pen.scale(-1 / 32, -1 / 32, 1 / 32)
    pen.rotateY(Math.PI)
    const code = new TextGeometry('</>', { font, size: 1, depth: 0.28, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 4 })
    code.computeBoundingBox()
    const cb = code.boundingBox as THREE.Box3
    code.translate(-(cb.min.x + cb.max.x) / 2, -(cb.min.y + cb.max.y) / 2, -(cb.min.z + cb.max.z) / 2)
    return { field: geoFrom(field), home: geoFrom(homeArr), plaza: geoFrom(plaza), pen, code, sphere: new THREE.SphereGeometry(1, 48, 32), ring: new THREE.TorusGeometry(1, 0.035, 10, 72), dome: new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2) }
  }, [R, TH, font])

  const mats = useMemo(
    () => ({
      tile: new THREE.MeshPhysicalMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.2, emissive: '#1a3a8a', emissiveIntensity: 0.12 }),
      ground: new THREE.MeshStandardMaterial({ color: '#e4f2ff', roughness: 0.6, emissive: '#cfe8ff', emissiveIntensity: 0.35 }),
      glossTeal: new THREE.MeshPhysicalMaterial({ color: '#7ff0dc', roughness: 0.15, clearcoat: 1, iridescence: 0.4, emissive: '#2fc7c0', emissiveIntensity: 0.25 }),
      glossBlue: new THREE.MeshPhysicalMaterial({ color: '#5b7dff', roughness: 0.18, clearcoat: 1, iridescence: 0.3, emissive: '#2a4fe8', emissiveIntensity: 0.25 }),
      white: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.2, clearcoat: 1, emissive: '#cfe6ff', emissiveIntensity: 0.35 }),
      ripple: [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: '#7ff0dc', transparent: true, opacity: 0.6, depthWrite: false })),
      dome: orbMaterial('#9fd0ff', '#3d55f0'),
      orbs: ORBS.map((o) => orbMaterial(o.a, o.b)),
    }),
    [],
  )
  useEffect(
    () => () => {
      Object.values(geos).forEach((g) => g.dispose())
      Object.values(mats)
        .flat()
        .forEach((m) => m.dispose())
    },
    [geos, mats],
  )

  const P = useMemo(() => new THREE.Vector3(), [])
  const Q = useMemo(() => new THREE.Quaternion(), [])
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame(({ clock }) => {
    const b = aboutBox
    const w = world.current
    const g = globe.current
    if (!w || !g) return
    const t = clock.elapsedTime
    const on = b.chat
    w.visible = on
    if (sky.current) sky.current.visible = on
    aboutCubeBox.on = on && b.quad > 0.5 ? 1 : 0
    /* ป้ายสกิล (AboutTags) วางมุมขวาบน — เหนือขอบฟ้า ไม่บังย่าน */
    aboutCubeBox.x = W * 0.6
    aboutCubeBox.y = H * 0.2
    aboutCubeBox.size = 0
    if (!on) return

    /* ลูกโลกลอยขึ้นจากใต้จอ (emerge) · จุดบ้านอยู่ที่ z 0 สูงราว 63% ของจอ */
    const rise = smooth(b.emerge)
    const homeY = H / 2 - H * 0.72
    const cy = homeY - R * Math.cos(HOME_A) - (1 - rise) * H * 0.75
    const cz = R * Math.sin(HOME_A)
    w.position.set(0, cy, cz)

    /*
     * หมุนพาเที่ยว: tour (page + 1) 0 = บ้าน · 1 2 3 = ย่านของสามสกิล — ระหว่างย่านไล่แบบนุ่ม ค้างที่ย่าน
     * ตอนจบ (back) หมุนกลับบ้าน · ลอยหายใจเบา ๆ ตลอด
     */
    const tourF = clamp01((b.page + 1) / 3) * 3
    const stops = [0, ...LAND.map((l) => l.a - HOME_A)]
    const seg = Math.min(2, Math.floor(tourF))
    const kk = smooth(tourF - seg)
    const rot = lerp(stops[seg], stops[seg + 1], kk) * (1 - smooth(b.back))
    g.rotation.set(rot + Math.sin(t * 0.25) * 0.004, Math.sin(t * 0.18) * 0.012 + (LAND[Math.max(0, Math.min(2, Math.round(tourF) - 1))]?.b ?? 0) * -0.35 * clamp01(tourF), 0)

    /* กระเบื้องบ้านจริงโผล่เมื่อฟองลงจอดสนิท (ฟองซ่อนตัวพร้อมกัน — ดู BubbleTraveler) */
    const hm = home.current
    if (hm) hm.visible = b.quad > 0.995

    /* ย่าน: โผล่เด้งเมื่อถึงคิว */
    LAND.forEach((l, i) => {
      const lg = lands.current[i]
      if (!lg) return
      const k = clamp01(1 - Math.abs(tourF - 1 - i) * 1.25)
      const pop = outBack(clamp01(k * 1.6))
      dirAB(l.a, l.b, P)
      lg.position.copy(P).multiplyScalar(R + TH * 1.4)
      lg.quaternion.copy(Q.setFromUnitVectors(UP, P))
      lg.scale.setScalar(Math.max(1e-3, (0.25 + 0.75 * pop) * H * 0.0015))
      lg.visible = k > 0.001 || tourF > 0
    })
    /* ชิ้นในย่านขยับเอง */
    const l0 = lands.current[0]
    if (l0) {
      const pen = l0.children[0]
      if (pen) {
        pen.rotation.y = t * 0.6
        pen.position.y = 230 + Math.sin(t * 1.4) * 14
      }
    }
    ripples.current.forEach((r, i) => {
      if (!r) return
      const ph = (t * 0.45 + i / 3) % 1
      r.scale.setScalar(60 + ph * 200)
      ;(r.material as THREE.MeshBasicMaterial).opacity = (1 - ph) * 0.55
    })
    const l1 = lands.current[1]
    if (l1) {
      const k = clamp01(1 - Math.abs(tourF - 2) * 1.25)
      l1.children.forEach((c, j) => {
        if (c.userData.bar) {
          const hgt = c.userData.bar as number
          c.scale.y = Math.max(0.01, outBack(clamp01(k * 1.8 - j * 0.12)))
          c.position.y = (hgt / 2) * c.scale.y
        }
        if (c.userData.glyph) {
          c.position.y = 300 + Math.sin(t * 1.2) * 12
          c.rotation.y = Math.sin(t * 0.7) * 0.4
        }
      })
    }
    const l2 = lands.current[2]
    if (l2) {
      const lens = l2.children.find((c) => c.userData.lens)
      if (lens) {
        lens.position.set(Math.sin(t * 0.8) * 60, 260 + Math.sin(t * 1.3) * 10, Math.cos(t * 0.8) * 40)
        lens.rotation.z = Math.sin(t * 0.8) * 0.25
      }
    }

    /* ลูกแก้วลอย — อยู่กับโลก (ไม่หมุนตามลูกโลก) ขยับตามมุมหมุนนิดหน่อยให้รู้สึกลึก */
    ORBS.forEach((o, i) => {
      const m = orbs.current[i]
      if (!m) return
      const par = rot * (0.08 + o.z * 0.2)
      m.position.set(o.x * W, H / 2 - H * (0.5 - o.y) + Math.sin(t * 0.6 + o.ph) * H * 0.012 + par * H * -0.2 - (1 - rise) * H * 0.4, o.z * H)
      m.scale.setScalar(o.r * H * lerp(0.4, 1, rise))
    })

    /* มุมของกระเบื้องบ้านบนจอ → ปลายทางของฟองที่หลอมลงมา */
    const pos = geos.home.attributes.position
    const N = 9
    const corners = [0, N, (N + 1) * (N + 1) - 1, N * (N + 1)]
    g.updateWorldMatrix(true, false)
    corners.forEach((vi, ci) => {
      P.fromBufferAttribute(pos, vi).applyMatrix4(g.matrixWorld).project(camera)
      globeTarget.c[ci * 2] = (P.x * 0.5 + 0.5) * W
      globeTarget.c[ci * 2 + 1] = (0.5 - P.y * 0.5) * H
    })
    globeTarget.ok = true
  })

  /* สัญลักษณ์ของแต่ละย่าน (หน่วยท้องถิ่น ×H/1000 — ดู scale ใน useFrame) */
  return (
    <>
    <group ref={world} visible={false}>
      <group ref={globe}>
        <mesh geometry={geos.sphere} material={mats.ground} scale={R} />
        <mesh geometry={geos.field} material={mats.tile} />
        <mesh geometry={geos.plaza} material={mats.tile} />
        <mesh ref={home} geometry={geos.home} material={mats.tile} visible={false} />
        {/* Design — ปากกายักษ์ + วงคลื่น */}
        <group
          ref={(gr) => {
            lands.current[0] = gr
          }}
        >
          <mesh geometry={geos.pen} material={mats.glossTeal} scale={220} position={[0, 230, 0]} />
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              geometry={geos.ring}
              material={mats.ripple[i]}
              rotation={[Math.PI / 2, 0, 0]}
              position={[0, 6, 0]}
              ref={(m) => {
                ripples.current[i] = m
              }}
            />
          ))}
        </group>
        {/* Coding — เมืองบล็อก + </> ลอย */}
        <group
          ref={(gr) => {
            lands.current[1] = gr
          }}
        >
          {[
            [-90, -40, 180],
            [-20, -60, 260],
            [50, -30, 150],
            [-60, 40, 120],
            [20, 30, 210],
            [90, 50, 100],
          ].map(([x, z, hgt], j) => (
            <group key={j} position={[x, 0, z]} userData={{ bar: hgt }}>
              <RoundedBox args={[56, hgt, 56]} radius={10} smoothness={3} material={j % 2 ? mats.glossBlue : mats.glossTeal} />
            </group>
          ))}
          <mesh geometry={geos.code} material={mats.white} scale={110} position={[0, 300, 0]} userData={{ glyph: true }} />
        </group>
        {/* Research — โดมเรืองแสง + แว่นขยายส่อง */}
        <group
          ref={(gr) => {
            lands.current[2] = gr
          }}
        >
          <mesh geometry={geos.dome} material={mats.dome} scale={130} />
          <group userData={{ lens: true }}>
            <mesh geometry={geos.ring} material={mats.white} scale={70} />
            <mesh material={mats.white} position={[62, -62, 0]} rotation={[0, 0, Math.PI / 4]}>
              <cylinderGeometry args={[9, 9, 80, 16]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
    {/* ลูกแก้วลอย — พิกัดจอ ไม่ผูกกับลูกโลก */}
    <group ref={sky} visible={false}>
      {ORBS.map((_, i) => (
        <mesh
          key={i}
          geometry={geos.sphere}
          material={mats.orbs[i]}
          ref={(m) => {
            orbs.current[i] = m
          }}
        />
      ))}
    </group>
    </>
  )
}
