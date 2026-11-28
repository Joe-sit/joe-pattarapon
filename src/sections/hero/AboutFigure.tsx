import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { AboutBody } from './AboutBody'
import { AboutWidgets, FOV } from './AboutWidgets'
import { AboutTags } from './AboutTags'
import { HeroLights } from '@/newhero/heroLights'
import { DEFAULTS } from '@/newhero/tuner'
import { SKILLS } from '@/sections/whatido/WhatIDo'

/**
 * เรื่องในพาเนล "About me" — ข้างในหัวของผมมีอะไร
 *
 *   1. ไอคอนคนบนหัวพาเนลขยายลงมาเป็นหัวตัวละคร (k) — ยืดหดแบบการ์ตูน
 *   2. หัวหมุนติ้วสองรอบ แบนลงแผ่ออก กลายเป็นกองชั้นสกิลตอนหมุนเร็วสุด (xray beat = หมุน/morph)
 *   3. ทั้งกองหมุนเป็นมุม isometric ชั้นแยกแบบเด้ง ขยายเต็มพร้อมของบนผิว (stack) แล้วไฮไลต์ทีละชั้น
 *      ด้วยสีประจำสกิล ของบนผิวเด้งเป็นคลื่น พร้อมเส้นโยงไปป้ายชื่อ + คำอธิบาย (page)
 *   5. จบ: เล่นย้อนกลับ ชั้นรวมกัน หมุนกลับเป็นหัวเดิม (back) — คนเดียวมีครบทุกชั้น
 *
 * แคนวาสของตัวเอง ไม่ใช่แคนวาสฟอง: ไฟในฉากเดียวส่องทุกชิ้น แคนวาสฟองตั้งไฟสว่างจัดให้แก้ว + ACES หัวในนั้น
 * จึงสีซีดคนละคนกับ hero ที่นี่ใช้ไฟชุดเดียวกับ hero (newhero/heroLights) ไม่ม้วนโทน หัวจึงสีเท่ากันจริง
 * หน่วยเป็นพิกเซล (กล้องออร์โธ zoom 1) ครอบกรอบเนื้อหาของพาเนล — ท่าทั้งหมดมาจาก aboutBox ที่ฟองตั้ง
 */

/** ชั้นตามสกิล บนลงล่าง (ลำดับเดียวกับ SERVICES ของพาเนล) */
export const LAYERS = ['UX/UI', 'Coding', 'Research'] as const
/**
 * เรื่องของ About me: true = ตัวละครยืนกลาง พาเนลสกิลลอยโผล่รอบตัวตามการเลื่อน (ดู ./AboutPanels)
 * false = เรื่องเดิม ตัวหมุนแตกเป็นบล็อกแล้วเรียงเป็นกองชั้นสกิล
 */
const PANELS = true
/**
 * คำอธิบายใต้ชื่อชั้น — ข้อความจริงจากส่วน What I do (sections/whatido) UX/UI ใช้ของ Design
 * Research ยังเป็นข้อความชั่วคราว (Lorem — Joe เขียนเอง) จึงไม่แสดง
 */
const DESC = [SKILLS.find((s) => s.title === 'Design')?.desc ?? '', SKILLS.find((s) => s.title === 'Coding')?.desc ?? '', '']

export { aboutBox } from './aboutBox'
import { ABOUT_STORY, CHAT_ITEM, DIAGRAM_MORPH, aboutBox, aboutClip, aboutCubeBox } from './aboutBox'
import { AboutCube } from './AboutCube'
import { AboutGlobe } from './AboutGlobe'

/**
 * สีประจำสกิล (สีเดียวกับส่วน What I do) — UX/UI ใช้สีของ Design · ตอนไม่ไฮไลต์เป็นพาสเทลของสีนั้น
 */
const COLOR_OF = (t: string, fb: string) => new THREE.Color(SKILLS.find((s) => s.title === t)?.color ?? fb)
const SKILL_COLOR = [COLOR_OF('Design', '#fd5000'), COLOR_OF('Coding', '#ad85fe'), COLOR_OF('Research', '#158ffc')]
const PASTEL = SKILL_COLOR.map((c) => c.clone().lerp(new THREE.Color('#ffffff'), 0.72))
const SLAB = '#f4f5f7'
const FRONT = new THREE.Euler(0.05, -0.5, 0)
const ISO = new THREE.Euler(0.6, -Math.PI / 4, 0)
/** ระนาบตัดของแคนวาสนี้ (ตัวละครโผล่จากฟอง) — เก็บด้านบนของเส้น */
const CLIP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
/** ระนาบตัดของกล่องแก้ว (ตอนโผล่จากฟอง) — แยกจากของตัวละคร */
const CLIP_CUBE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
/** ท่าส่องกล้อง: หันหลังเฉียงไปทางขวาบน เงยนิด (เห็นไหล่กับหลังหัว แบบภาพอ้างอิง) */
const LOOK = new THREE.Euler(-0.15, 2.75, 0)

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const outBack = (x: number) => {
  const u = clamp01(x)
  return 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2
}
const inOut = (x: number) => {
  const u = clamp01(x)
  return u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2
}

export function AboutFigure({ on }: { on: boolean }) {
  const wrap = useRef<HTMLDivElement>(null)
  const call = useRef<HTMLDivElement>(null)
  const line = useRef<SVGPathElement>(null)
  const labels = useRef<(HTMLDivElement | null)[]>([])
  return (
    <div ref={wrap} className="absolute top-0 left-0" style={{ visibility: on ? 'visible' : 'hidden' }}>
      <Canvas
        /* แคนวาสซ้อนทับทั้งจอ — r3f ตั้ง pointer-events: auto ให้กล่องของมันเอง จะกินเมาส์ของฉากข้างใต้ (หัวตัวละคร hero เลยไม่หันตามเคอร์เซอร์) */
        style={{ pointerEvents: 'none' }}
        frameloop={on ? 'always' : 'never'}
        /* กล้องออร์โธถอยไกล — ของขนาดหลายร้อยพิกเซล ลึกหลายร้อย ระยะใกล้/ไกลแคบจะตัด */
        /* กล้องเพอร์สเปกทีฟ — AboutWidgets ตั้งระยะให้ระนาบ z 0 เป็นหนึ่งหน่วยต่อพิกเซล แล้วถอยออกตอนวิดเจ็ตโผล่ */
        camera={{ fov: FOV, position: [0, 0, 2000], near: 10, far: 12000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, stencil: true, toneMappingExposure: DEFAULTS.exposure }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping
        }}
      >
        <HeroLights shadows={false} />
        <Suspense fallback={null}>
          <Story wrap={wrap} call={call} line={line} labels={labels} />
          {PANELS && <AboutWidgets />}
          {CHAT_ITEM === 'cube' && <AboutCube clip={CLIP_CUBE} />}
          {CHAT_ITEM === 'globe' && <AboutGlobe />}
        </Suspense>
      </Canvas>
      {/* ป้ายด้านขวา: เส้นโยงจากมุมขวาของชั้นที่ไฮไลต์ → วงเล็บ + ชื่อชั้น + คำอธิบาย · ชั้นอื่นเป็นชื่อจาง */}
      {PANELS && <AboutTags on={on} />}
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <path ref={line} fill="none" stroke="#ffffff" strokeWidth={1.5} strokeOpacity={0} />
      </svg>
      <div ref={call} className="pointer-events-none absolute top-0 left-0" style={{ opacity: 0, width: 300 }}>
        {LAYERS.map((name, i) => (
          <div
            key={name}
            ref={(el) => {
              labels.current[i] = el
            }}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              color: '#ffffff',
              padding: '10px 0 10px 18px',
              borderLeft: '1.5px solid transparent',
              borderRadius: '10px 0 0 10px',
              transition: 'opacity 200ms, border-color 200ms',
            }}
          >
            <div data-name style={{ letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* จุดสีประจำสกิล */}
              <span style={{ width: 10, height: 10, borderRadius: 99, background: `#${SKILL_COLOR[i].getHexString()}`, flex: 'none' }} />
              {name}
            </div>
            {DESC[i] && (
              <div data-desc style={{ fontSize: 17, lineHeight: 1.35, marginTop: 8, maxWidth: 280, overflow: 'hidden', maxHeight: 0, opacity: 0 }}>
                {DESC[i]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const P = new THREE.Vector3()
const Q = new THREE.Quaternion()
const QA = new THREE.Quaternion()
const QB = new THREE.Quaternion()
const SPIN = new THREE.Quaternion()
const YAXIS = new THREE.Vector3(0, 1, 0)

/* ---------- หัว ↔ กองชั้น ด้วยบล็อก ---------- */

/** ขนาดบล็อก (หน่วยหัว — หัวกว้างราว 1) และจำนวนสูงสุด */
const VOX = 1 / 14
const MAX_VOX = 2600
/** แผ่นชั้นตอนชิดกันในทรงหัว (ตรงกับ Layer ที่สเกล 0.85/300): กลางแนวตั้ง กว้าง 12 บล็อก หนา 0.1 */
const SLAB_Y = (i: number) => (1 - i) * 0.16
const SLAB_CELLS = 12

type Voxels = { n: number; src: Float32Array; dst: Float32Array; srcC: Float32Array; dstC: Float32Array; delay: Float32Array; sy: Float32Array }

/**
 * ปั้นบล็อกจากหัวจริง: ช่องตารางในกรอบหัวที่อยู่ในชิ้นส่วนไหน (ตา > ผม > ผิว — ชิ้นส่วนของหัวเป็นกล่อง) ได้สีนั้น
 * เก็บเฉพาะเปลือก (มีเพื่อนบ้านว่าง) — ปลายทาง = บล็อกของแผ่นสามชั้น + ของบนผิว เรียงจับคู่จากบนลงล่าง
 */
function buildVoxels(head: THREE.Object3D, root: THREE.Object3D): Voxels | null {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(head.matrixWorld).invert()
  const parts: { box: THREE.Box3; color: THREE.Color; pri: number }[] = []
  head.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.computeBoundingBox()
    const bb = (m.geometry.boundingBox as THREE.Box3).clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
    const c = (m.material as THREE.MeshStandardMaterial).color.clone()
    const hex = c.getHexString()
    const pri = hex === '262424' ? 3 : hex === '232224' ? 2 : 1
    /* ตาเป็นกล่องบาง ตารางบล็อกสุ่มไม่โดน (ตาหายตอนสลับ) — ขยายกล่องตาครึ่งบล็อกให้ติดผิวหน้าแน่ ๆ */
    if (pri === 3) bb.expandByScalar(VOX * 0.6)
    parts.push({ box: bb, color: c, pri })
  })
  if (!parts.length) return null
  parts.sort((a, b) => b.pri - a.pri)
  const half = 0.5
  const N = Math.round((half * 2) / VOX)
  const at = (x: number, y: number, z: number) => parts.find((p) => p.box.containsPoint(P.set(x, y, z)))
  const cells: { x: number; y: number; z: number; c: THREE.Color }[] = []
  const inside = (i: number, j: number, k: number) => !!at(-half + (i + 0.5) * VOX, -half + (j + 0.5) * VOX, -half + (k + 0.5) * VOX)
  for (let i = 0; i < N; i += 1)
    for (let j = 0; j < N; j += 1)
      for (let k = 0; k < N; k += 1) {
        const x = -half + (i + 0.5) * VOX
        const y = -half + (j + 0.5) * VOX
        const z = -half + (k + 0.5) * VOX
        const p = at(x, y, z)
        if (!p) continue
        const shell = !inside(i + 1, j, k) || !inside(i - 1, j, k) || !inside(i, j + 1, k) || !inside(i, j - 1, k) || !inside(i, j, k + 1) || !inside(i, j, k - 1)
        if (shell) cells.push({ x, y, z, c: p.color })
      }
  if (!cells.length) return null
  /*
   * ปลายทาง: แผ่นละ 12×12 บล็อก (บาง) เท่านั้น — ของบนผิวแผ่นเป็นชิ้นจริงที่เด้งออกมาหลังสลับ (ดู Story)
   * เคยปั้นของบนผิวจากบล็อกด้วย แต่ทรงไม่ตรงกับชิ้นจริง ตอนสลับเลยกระตุก
   */
  const slabC = new THREE.Color(SLAB)
  const dsts: { x: number; y: number; z: number; c: THREE.Color; sy: number }[] = []
  const thick = 0.1
  LAYERS.forEach((_, li) => {
    const y = SLAB_Y(li)
    for (let a = 0; a < SLAB_CELLS; a += 1)
      for (let b = 0; b < SLAB_CELLS; b += 1)
        dsts.push({ x: (a - (SLAB_CELLS - 1) / 2) * VOX, y, z: (b - (SLAB_CELLS - 1) / 2) * VOX, c: slabC, sy: thick / VOX })
  })
  /* จับคู่จากบนลงล่าง (ผมไปชั้นบน คางไปชั้นล่าง) ภายในระดับเดียวกันเรียงตาม x,z ให้บินใกล้ ๆ */
  const byY = <T extends { x: number; y: number; z: number }>(a: T, b: T) => b.y - a.y || a.x - b.x || a.z - b.z
  cells.sort(byY)
  dsts.sort(byY)
  const n = Math.min(cells.length, MAX_VOX)
  const v: Voxels = {
    n,
    src: new Float32Array(n * 3),
    dst: new Float32Array(n * 3),
    srcC: new Float32Array(n * 3),
    dstC: new Float32Array(n * 3),
    delay: new Float32Array(n),
    sy: new Float32Array(n),
  }
  for (let i = 0; i < n; i += 1) {
    const s = cells[i]
    const d = dsts[Math.min(dsts.length - 1, Math.floor((i * dsts.length) / n))]
    v.src.set([s.x, s.y, s.z], i * 3)
    v.dst.set([d.x, d.y, d.z], i * 3)
    v.srcC.set([s.c.r, s.c.g, s.c.b], i * 3)
    v.dstC.set([d.c.r, d.c.g, d.c.b], i * 3)
    /* ออกตัวจากบนลงล่างเป็นระลอก + สุ่มนิดหน่อย */
    v.delay[i] = (i / n) * 0.45 + ((i * 7919) % 97) / 97 * 0.08
    v.sy[i] = d.sy
  }
  return v
}

const M4 = new THREE.Matrix4()
const VQ = new THREE.Quaternion()
const VS = new THREE.Vector3()
const VP = new THREE.Vector3()
const VC = new THREE.Color()
const VE = new THREE.Euler()
/** วางบล็อกที่ morph = m (0 = หัว, 1 = กองชั้น) — บินโค้งขึ้น หมุนตัวกลางทาง สีไล่ไปสีของชั้น */
function driveVoxels(mesh: THREE.InstancedMesh, v: Voxels, m: number) {
  for (let i = 0; i < v.n; i += 1) {
    const k = inOut(clamp01((m - v.delay[i]) / 0.47))
    const arc = Math.sin(Math.PI * k)
    VP.set(
      lerp(v.src[i * 3], v.dst[i * 3], k),
      lerp(v.src[i * 3 + 1], v.dst[i * 3 + 1], k) + arc * 0.18,
      lerp(v.src[i * 3 + 2], v.dst[i * 3 + 2], k),
    )
    VQ.setFromEuler(VE.set(arc * 1.6, arc * 2.2, 0))
    /* ต้นทาง/ปลายทางบล็อกชิดกันพอดี (เรขาคณิต 0.94 บล็อก × 1/0.94) ไม่มีร่องเส้นตารางแวบตอนสลับ — ระหว่างบินพองแยกกัน */
    const pop = 1 / 0.94 + arc * 0.3
    VS.set(pop, lerp(1, v.sy[i], k) * pop, pop)
    mesh.setMatrixAt(i, M4.compose(VP, VQ, VS))
    VC.setRGB(lerp(v.srcC[i * 3], v.dstC[i * 3], k), lerp(v.srcC[i * 3 + 1], v.dstC[i * 3 + 1], k), lerp(v.srcC[i * 3 + 2], v.dstC[i * 3 + 2], k))
    mesh.setColorAt(i, VC)
  }
  mesh.count = v.n
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

function Story({
  wrap,
  call,
  line,
  labels,
}: {
  wrap: React.RefObject<HTMLDivElement | null>
  call: React.RefObject<HTMLDivElement | null>
  line: React.RefObject<SVGPathElement | null>
  labels: React.RefObject<(HTMLDivElement | null)[]>
}) {
  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const stack = useRef<THREE.Group>(null)
  const layers = useRef<(THREE.Group | null)[]>([])
  const corner = useRef<(THREE.Object3D | null)[]>([])
  const vox = useRef<Voxels | null>(null)
  /** น้ำหนักโบกมือ — ตัวโผล่เต็มแล้วโบก หยุดก่อนเริ่มหมุน */
  const wave = useRef(0)
  /** น้ำหนักท่าส่องกล้องสองตา (ดู AboutBody) */
  const look = useRef(0)
  const voxMesh = useRef<THREE.InstancedMesh>(null)
  const voxGeo = useMemo(() => new THREE.BoxGeometry(VOX * 0.94, VOX * 0.94, VOX * 0.94), [])
  const voxMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.55 }), [])
  useEffect(
    () => () => {
      voxGeo.dispose()
      voxMat.dispose()
    },
    [voxGeo, voxMat],
  )

  useFrame(({ size, clock, gl }) => {
    const t = clock.elapsedTime
    const b = aboutBox
    const el = wrap.current
    if (el) {
      el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`
      el.style.width = `${b.w}px`
      el.style.height = `${b.h}px`
      el.style.opacity = b.show ? '1' : '0'
    }
    const W = size.width
    const H = size.height
    const rt = root.current
    const hd = head.current
    const st = stack.current
    if (!rt || !hd || !st) return

    const k = inOut(b.k)
    const back = inOut(b.back)
    /* หมุน (xray beat): หัวหมุนติ้วสองรอบ แบนลงแผ่ออก แล้วกลายเป็นกองชั้น — ตอนจบเล่นย้อนกลับ */
    const spin = PANELS ? 0 : inOut(b.xray) * (1 - back)
    /* morph = หัว → กองชั้น (สลับตอนหมุนเร็วสุด กลางรอบ) */
    const m = clamp01((spin - 0.12) / 0.7)
    /* ของบนผิวแผ่น (ชิ้นจริง) เด้งออกทีละชิ้นหลังบล็อกเรียงเป็นแผ่นแล้ว */
    const grow = clamp01((spin - 0.82) / 0.18)
    /* e = ความเป็นแผนผัง (ชั้นแยก หมุน isometric) */
    const e = PANELS ? 0 : inOut(b.stack) * (1 - back)

    /* ทั้งกลุ่ม: จากไอคอนบนหัวพาเนล → กลางเรื่อง (38% ของความกว้าง) */
    /* ครึ่งตัว (ดู AboutBody) สูงเกือบเต็มกรอบ ขอบล่างของช่วงครึ่งตัว (เอว) ชนขอบล่างพอดี ขาถูกตัดทิ้ง */
    const full = H * 0.92
    /*
     * PANELS: โบกทักกลางจอแล้วหันหลังเดินไปมุมซ้ายล่าง ยกกล้องสองตาส่องขึ้นขวา — แสงที่ส่องไปเปิดให้เห็น
     * ของที่ลอยอยู่ (ดู AboutWidgets) · ตอนจบหันกลับมากลางจอ
     */
    const turn = PANELS && ABOUT_STORY === 'binoc' ? inOut(clamp01(b.xray / 0.3)) * (1 - back) : 0
    const sz = lerp(b.iconH, full, k) * lerp(1, 0.62, e) * lerp(1, 0.8, turn)
    const cx = lerp(b.iconX, W * lerp(PANELS ? 0.5 : 0.38, 0.16, turn), k)
    const cy = lerp(b.iconY, H * (0.54 + 0.03 * e + 0.2 * turn), k)
    rt.position.set(cx - W / 2, H / 2 - cy, 0)
    /* ยืดหดแบบการ์ตูนตอนเด้งออกจากไอคอน */
    const squash = Math.sin(Math.PI * clamp01(b.k)) * 0.22
    rt.scale.set(sz * (1 - squash * 0.5), sz * (1 + squash), sz * (1 - squash * 0.5))
    rt.visible = b.k > 0
    /* หันหน้า → (หมุนรอบแกนตั้ง 2 รอบ ตามการเลื่อน) → มุม isometric ของแผนผัง */
    QA.setFromEuler(FRONT)
    QB.setFromEuler(ISO)
    SPIN.setFromAxisAngle(YAXIS, spin * Math.PI * 4)
    rt.quaternion.copy(Q.copy(QA).slerp(QB, e)).multiply(SPIN)
    if (turn > 0) rt.quaternion.slerp(QB.setFromEuler(LOOK), turn)
    rt.rotateZ(Math.sin(t * 0.7) * 0.03 * e)
    /*
     * เรื่องโผล่จากฟองแชท: ครึ่งตัวลอยขึ้นจากขอบบนของฟอง (ส่วนที่ยังอยู่ต่ำกว่าขอบถูกตัดด้วยระนาบ — เหมือนออกมาจากในฟอง)
     * ฟองหลอมเป็นแผนผังแล้ว ระนาบตัดเลื่อนลงไปขอบล่างของหน้าต่าง ตัวละครยืนอยู่ในหน้าต่าง หัวทะลุขอบบน
     */
    if (b.chat) {
      /* พุ่งขึ้นเลยนิดแล้วดีดกลับ ยืดตัวตอนพุ่ง (ท่าการ์ตูน — ออกจากของเหลว) */
      const em = outBack(b.emerge)
      const stretch = Math.sin(Math.PI * clamp01(b.emerge)) * 0.14
      /*
       * โผล่แค่หัว: ขึ้นมาจนคอพ้นขอบ (NECK = ระดับคอ นับจากขอบบนของช่วงครึ่งตัว ดู AboutBody) ลำตัวยังอยู่ในฟอง
       * พอฟองเป็นแผนผัง เส้นขอบเลื่อนไปขอบบนของหน้าต่าง — หัวโผล่พ้นขอบบนหน้าต่าง ตัวอยู่หลังหน้าต่าง
       */
      const szc = H * 0.6
      const NECK = 0.6
      const top = b.by - b.bh * 0.32
      /*
       * ไม่หลอมแผนผัง: หัวขึ้นมาจากขอบล่างของฟอง (ระนาบตัดที่ขอบล่าง — ใต้ฟองไม่เห็นอะไร) ผ่านเนื้อแก้ว
       * แล้วพ้นขอบบนจนคอถึงขอบบน · แคนวาสนี้อยู่ใต้แคนวาสฟอง ช่วงที่อยู่ในฟองจึงเห็นผ่านแก้ว
       */
      const bottom = b.by + b.bh * 0.42
      const qTop = (b.qc[1] + b.qc[3]) / 2
      const line = DIAGRAM_MORPH ? lerp(top, qTop, inOut(b.quad)) : bottom
      const cyc = DIAGRAM_MORPH ? lerp(line + szc * 0.55, line + szc * (0.5 - NECK), em) : lerp(bottom + szc * 0.5, top + szc * (0.5 - NECK), em)
      if (CHAT_ITEM === 'head') {
        aboutCubeBox.x = b.bx
        aboutCubeBox.y = top - szc * 0.18
        aboutCubeBox.size = szc * 0.32
        aboutCubeBox.on = b.emerge > 0.05 ? 1 : 0
      }
      rt.position.set(b.bx - W / 2, H / 2 - cyc, 0)
      rt.scale.set(szc * (1 - stretch * 0.5), szc * (1 + stretch), szc * (1 - stretch * 0.5))
      rt.quaternion.setFromEuler(FRONT)
      rt.visible = b.emerge > 0.001 && CHAT_ITEM === 'head'
      CLIP.constant = -(H / 2 - line)
      gl.localClippingEnabled = true
      aboutClip.planes = CHAT_ITEM === 'head' ? [CLIP] : []
    } else aboutClip.planes = []

    /*
     * หัว → กองชั้นแบบเรียงบล็อกใหม่ (ดู buildVoxels): ตอนเริ่ม morph หัวจริงหาย บล็อกที่สีตรงกับส่วนของหัว
     * มาแทนที่ตรงที่เดิม แล้วบินโค้งไปเรียงเป็นแผ่นสามชั้น (ส่วนบนของหัวไปชั้นบน) สีค่อย ๆ เป็นสีของชั้น
     * เรียงครบ (m = 1) สลับเป็นแผ่นชั้นจริงที่ขนาดตรงกัน · ตอนจบเล่นย้อนกลับ
     */
    const vx = vox.current
    /* ปั้นบล็อกตอนเริ่ม morph — ตัวละครวัดขนาดตัวเองเสร็จแล้ว (ดู AboutBody) */
    if (!vx && m > 0 && hd.children.length) vox.current = buildVoxels(hd, rt)
    /* โบกทักตอนโผล่ — พาเนลเริ่มลอยมาแล้วค่อยลดมือ */
    look.current = PANELS && ABOUT_STORY === 'binoc' ? inOut(clamp01((b.xray - 0.12) / 0.22)) * (1 - back) : 0
    /* โผล่แค่หัว — ไม่โบก (มือที่ยกจะโผล่พ้นขอบ) */
    wave.current = b.chat
      ? 0
      : inOut(clamp01((b.k - 0.7) / 0.3)) * (1 - inOut(clamp01((b.xray - 0.1) / 0.15))) * (1 - back)
    hd.visible = m <= 0
    st.visible = m >= 1
    const vm = voxMesh.current
    if (vm && vx) {
      vm.visible = m > 0 && m < 1
      if (vm.visible) driveVoxels(vm, vx, m)
    }
    LAYERS.forEach((_, i) => {
      const g = layers.current[i]
      if (!g) return
      const a = Math.max(0, 1 - Math.abs(b.page - i)) * e
      /* ชิดกันในทรงหัว → แยกแบบเด้งเกินแล้วดีดกลับ + ลอยขึ้นลงคนละจังหวะ */
      const off = (1 - i) * (0.16 + 0.34 * outBack(e)) + Math.sin(t * 1.4 + i * 1.9) * 0.022 * e
      g.position.set(0, off + a * 0.06, 0)
      g.rotation.y = Math.sin(t * 0.9 + i * 1.3) * 0.06 * e
      g.scale.setScalar(lerp(0.85, 1.18, e) / 300)
      g.traverse((o) => {
        const mm = o as THREE.Mesh
        if (mm.isMesh && mm.userData.tile) (mm.material as THREE.MeshStandardMaterial).color.copy(PASTEL[i]).lerp(SKILL_COLOR[i], a)
        const ud = o.userData as { bump?: number; baseY?: number }
        if (ud.bump !== undefined && ud.baseY !== undefined) {
          o.position.y = ud.baseY + a * 16 * Math.max(0, Math.sin(t * 4.2 - ud.bump * 0.7))
          o.scale.setScalar(Math.max(1e-3, outBack(grow * 1.8 - ud.bump * 0.09 - i * 0.12)))
        }
      })
    })

    /* ป้ายด้านขวา + เส้นโยงจากมุมขวาของชั้นที่ไฮไลต์ */
    const show = clamp01((e - 0.6) / 0.4)
    const cl = call.current
    const ln = line.current
    const lb = labels.current
    const lx = W * 0.7
    const ly = H * 0.3
    if (cl) {
      cl.style.opacity = show.toFixed(3)
      cl.style.transform = `translate3d(${lx}px, ${ly}px, 0)`
    }
    const n = Math.round(b.page)
    lb?.forEach((l, i) => {
      if (!l) return
      const act = i === n
      l.style.opacity = act ? '1' : '0.45'
      l.style.borderLeftColor = act ? 'rgba(255,255,255,0.9)' : 'transparent'
      const nm = l.querySelector<HTMLElement>('[data-name]')
      if (nm) nm.style.fontSize = act ? '22px' : '15px'
      const d = l.querySelector<HTMLElement>('[data-desc]')
      if (d) {
        d.style.maxHeight = act ? '120px' : '0px'
        d.style.opacity = act ? '0.9' : '0'
      }
    })
    const anchor = corner.current[n]
    if (ln && anchor && lb?.[n] && show > 0) {
      anchor.getWorldPosition(P)
      const ax = P.x + W / 2
      const ay = H / 2 - P.y
      const lr = lb[n] as HTMLDivElement
      const tx = lx - 6
      const ty = ly + lr.offsetTop + 22
      ln.setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)} L${(tx - 24).toFixed(1)} ${ty.toFixed(1)} L${tx.toFixed(1)} ${ty.toFixed(1)}`)
      ln.setAttribute('stroke-opacity', (show * 0.9).toFixed(3))
    } else if (ln) ln.setAttribute('stroke-opacity', '0')
  })

  return (
    <group ref={root} visible={false}>
      <group ref={head}>
        <AboutBody wave={wave} look={look} />
      </group>
      {/* บล็อกของการเรียงใหม่ (หัว ↔ กองชั้น) — จำนวนพอสำหรับเปลือกหัว */}
      <instancedMesh ref={voxMesh} args={[voxGeo, voxMat, MAX_VOX]} visible={false} frustumCulled={false} />
      <group ref={stack}>
        {LAYERS.map((name, i) => (
          <group
            key={name}
            ref={(g) => {
              layers.current[i] = g
            }}
          >
            <Layer kind={i} />
            {/* มุมขวาของแผ่น (ในมุมมอง isometric) — จุดเริ่มเส้นโยงไปป้าย */}
            <object3D
              position={[150, 0, 150]}
              ref={(o) => {
                corner.current[i] = o
              }}
            />
          </group>
        ))}
      </group>
    </group>
  )
}

/** แผ่นหนึ่งชั้น 300×300 หนา 36 + ของบนผิวตามสกิล — ไทล์ (UX/UI) · บรรทัดโค้ด (Coding) · กราฟแท่ง (Research) */
function Layer({ kind }: { kind: number }) {
  const slabMat = useMemo(() => new THREE.MeshStandardMaterial({ color: SLAB, roughness: 0.6 }), [])
  const topMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), [])
  const tile = useMemo(() => new THREE.MeshStandardMaterial({ color: PASTEL[kind].clone(), roughness: 0.5 }), [kind])
  const items = useMemo(
    () =>
      kind === 0
        ? [
            { x: -50, z: -100, w: 180, d: 80, h: 30 },
            { x: 100, z: -100, w: 80, d: 80, h: 30 },
            { x: -100, z: 0, w: 80, d: 80, h: 30 },
            { x: 0, z: 0, w: 80, d: 80, h: 30 },
            { x: 100, z: 0, w: 80, d: 80, h: 30 },
            { x: -100, z: 100, w: 80, d: 80, h: 30 },
            { x: 0, z: 100, w: 80, d: 80, h: 30 },
            { x: 100, z: 100, w: 80, d: 80, h: 30 },
          ]
        : kind === 1
          ? [180, 120, 220, 80, 160].map((w, r) => ({ x: -130 + (r % 2) * 20 + w / 2, z: -100 + r * 50, w, d: 22, h: 14 }))
          : [40, 70, 55, 95, 120].map((h, r) => ({ x: -100 + r * 50, z: 40, w: 30, d: 30, h })),
    [kind],
  )
  const caps = useMemo(() => (kind === 0 ? items.map((it) => topCap(it.w - 10, it.d - 10)) : []), [kind, items])
  useEffect(
    () => () => {
      ;[slabMat, topMat, tile].forEach((m) => m.dispose())
      caps.forEach((g) => g.dispose())
    },
    [slabMat, topMat, tile, caps],
  )
  return (
    <group>
      <RoundedBox args={[300, 36, 300]} radius={5} smoothness={3} material={slabMat} />
      {items.map((it, j) => (
        <group key={j} position={[it.x, 18 + it.h / 2, it.z]} userData={{ bump: j, baseY: 18 + it.h / 2 }}>
          <RoundedBox
            args={[it.w, it.h, it.d]}
            radius={Math.min(8, it.h / 2 - 0.5, it.w / 2 - 0.5, it.d / 2 - 0.5)}
            smoothness={3}
            material={tile}
            userData={{ tile: true }}
          />
          {caps[j] && <mesh material={topMat} position={[0, it.h / 2 + 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={caps[j]} />}
        </group>
      ))}
    </group>
  )
}

/** ฝาบนขาวของไทล์ — สี่เหลี่ยมมน */
function topCap(w: number, d: number) {
  const s = new THREE.Shape()
  const r = 6
  s.moveTo(-w / 2 + r, -d / 2)
  s.lineTo(w / 2 - r, -d / 2)
  s.absarc(w / 2 - r, -d / 2 + r, r, -Math.PI / 2, 0, false)
  s.lineTo(w / 2, d / 2 - r)
  s.absarc(w / 2 - r, d / 2 - r, r, 0, Math.PI / 2, false)
  s.lineTo(-w / 2 + r, d / 2)
  s.absarc(-w / 2 + r, d / 2 - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-w / 2, -d / 2 + r)
  s.absarc(-w / 2 + r, -d / 2 + r, r, Math.PI, Math.PI * 1.5, false)
  return new THREE.ShapeGeometry(s, 6)
}
