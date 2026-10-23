import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * โลโก้ JOE แบบ 3D จริง (ปกโปรไฟล์ Fastwork — ./FastworkProfile) ผิวโฮโลแกรม
 *
 * รูปทรงเดียวกับโลโก้ 2D (joespresso/Logo · ProgressLogo ของ /2026-final) ทุกเส้น อัดขึ้นรูปมีขอบมน
 * ท่าประกอบ = ท่าเดิมของโลโก้ (components/JoeLettersSplash) ทุกจังหวะ ทุก ease เวลาเดียวกัน (เร่ง ×1.2):
 *   E  เผยซ้ายไปขวา (ระนาบตัด = clip rect เดิม) · ช่องกลางงอกจากซ้าย · ปากไถลเข้าจากขวา · ขีดหน้ากางจากขอบ
 *   O  จุดกลมวิ่งจากขอบ E มากลางตัว O โตขึ้น แล้วแตกเป็นสี่กลีบหมุนเข้าที่
 *   J  ตัวถังหล่นลงมาจากบน แล้วเปิดมุมซ้ายบนกับตะขอ · ทั้งคำถอยหน่วงแล้วไถลเข้าที่
 * ใน 2D ช่องว่างเป็น mask ที่โตขึ้น — 3D ตัดรูปทรงสด ๆ ไม่ได้ จึงกลับด้าน: รูปทรงสุดท้ายมีช่องอยู่แล้ว
 * แล้ว "อุด" ด้วยชิ้นเติมเนื้อเดียวกันที่หดลง (หดจากฝั่งตรงข้ามกับที่ mask โต — ภาพเท่ากัน)
 *
 * เวลาอ่านนาฬิกาเดียวกับแบนเนอร์ (clock) · ปิดตัว = เล่นท่าเดิมย้อนกลับเร็ว ×3.4 · อยู่เฉย ๆ นิ่ง (เอียงค้างมุมเดียว)
 */

/** clock: เวลาเริ่มของแบนเนอร์ (performance.now) กับความยาวหนึ่งรอบ (วินาที) */
/**
 * times (วินาทีในรอบ): on = เริ่มนูนขึ้นจากแผ่นเวกเตอร์ (ความหนา 0 → เต็ม พร้อมเอียงรับมุม) · off = เริ่มแบนกลับเป็นแผ่น
 * ช่วงอื่นโลโก้เป็นเวกเตอร์ (FastworkProfile — VectorJoe) ซึ่งประกอบตัวใหญ่กลางจอแล้วย้ายมาที่มุมนี้
 */
type Props = { clock: { t0: number; len: number }; times: { on: number; off: number }; className?: string }

/** มุมซ้ายบน (px บนอาร์ตบอร์ด 1260 × 720 · กล้อง 1 หน่วย = 1 px · ศูนย์กลางจอ = 0): กลางโลโก้ที่ (135, 89) ตัวอักษรกว้าง 148 px */
export const LOGO_CORNER = { x: 135, y: 89, s: 0.595 }
const CORNER = { x: LOGO_CORNER.x - 630, y: 360 - LOGO_CORNER.y, s: LOGO_CORNER.s }
export const EXTRUDE_LEN = 0.7

/** หน่วย = หน่วย viewBox ของโลโก้ (สูง 84) · y ใน SVG ชี้ลง — กลับด้านตอนสร้าง shape · ศูนย์กลางที่กลางคำ */
const CX = 124.5
const CY = 42
/** จุดใน SVG → พิกัดท้องถิ่นเทียบจุดยึด (ax, ay) */
const rel = (ax: number, ay: number) => (x: number, y: number) => new THREE.Vector2(x - ax, ay - y)
/** จุดยึด (SVG) → ตำแหน่ง mesh ในกลุ่มโลโก้ */
const at = (x: number, y: number) => [x - CX, CY - y, 0] as const

function poly(f: (x: number, y: number) => THREE.Vector2, pts: [number, number][]) {
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => {
    const v = f(x, y)
    if (i === 0) s.moveTo(v.x, v.y)
    else s.lineTo(v.x, v.y)
  })
  s.closePath()
  return s
}

/** J สุดท้าย: ตัวถังก้นครึ่งวงกลม · บากมุมซ้ายบน (0..34 × 0..31) รวมกับตะขอ (ร่อง 33..49 ลงถึง 55 ก้นมนรัศมี 8) */
function jShape() {
  const f = rel(CX, CY)
  const s = new THREE.Shape()
  const mv = (x: number, y: number) => s.moveTo(f(x, y).x, f(x, y).y)
  const ln = (x: number, y: number) => s.lineTo(f(x, y).x, f(x, y).y)
  mv(34, 0)
  ln(81, 0)
  ln(81, 43.5)
  s.absarc(f(40.5, 43.5).x, f(40.5, 43.5).y, 40.5, 0, -Math.PI, true)
  ln(0, 31)
  ln(33, 31)
  ln(33, 47)
  s.absarc(f(41, 47).x, f(41, 47).y, 8, Math.PI, 0, false)
  ln(49, 30)
  ln(34, 30)
  s.closePath()
  return s
}

/** E สุดท้าย: ช่องกลางเป็นรู · ปากเป็นร่องจากขวา ปลายซ้ายมนรัศมี 8 */
function eShape() {
  const f = rel(CX, CY)
  const s = new THREE.Shape()
  s.moveTo(f(174, 2).x, f(174, 2).y)
  ;(
    [
      [232, 2],
      [232, 49],
      [193, 49],
    ] as [number, number][]
  ).forEach(([x, y]) => s.lineTo(f(x, y).x, f(x, y).y))
  s.absarc(f(193, 57).x, f(193, 57).y, 8, Math.PI / 2, (3 * Math.PI) / 2, false)
  ;(
    [
      [232, 65],
      [232, 81],
      [174, 81],
      [174, 65],
      [162, 65],
      [162, 18],
      [174, 18],
    ] as [number, number][]
  ).forEach(([x, y]) => s.lineTo(f(x, y).x, f(x, y).y))
  s.closePath()
  const h = new THREE.Path()
  h.moveTo(f(193, 18).x, f(193, 18).y)
  h.lineTo(f(212, 18).x, f(212, 18).y)
  h.absarc(f(212, 26).x, f(212, 26).y, 8, Math.PI / 2, -Math.PI / 2, true)
  h.lineTo(f(193, 34).x, f(193, 34).y)
  h.absarc(f(193, 26).x, f(193, 26).y, 8, -Math.PI / 2, Math.PI / 2, true)
  s.holes.push(h)
  return s
}

function ellipse(rx: number, ry: number) {
  const s = new THREE.Shape()
  s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0)
  return s
}

const PETALS = [
  { cx: 117.717, cy: 62.9484, rx: 15.1684, ry: 18.4624, rot: 59.365 },
  { cx: 126.342, cy: 20.4592, rx: 15.1684, ry: 18.4624, rot: 59.365 },
  { cx: 99.732, cy: 41.2846, rx: 14.1752, ry: 19.4078, rot: 28.5804 },
  { cx: 144.851, cy: 41.4516, rx: 14.1752, ry: 19.4078, rot: 28.5804 },
]

const DEPTH = 16
/* ขอบมนหดเข้าใน (bevelOffset = −bevelSize) — เส้นขอบนอกเท่ารูปทรงเดิมพอดี ตรงกับเวกเตอร์ตอนสลับ */
const EXTRUDE: THREE.ExtrudeGeometryOptions = { depth: DEPTH, bevelEnabled: true, bevelThickness: 3, bevelSize: 2.2, bevelOffset: -2.2, bevelSegments: 5, curveSegments: 40 }

/* ── ease แบบ gsap ── */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const p1in = (x: number) => x * x
const p1out = (x: number) => 1 - (1 - x) * (1 - x)
const p2out = (x: number) => 1 - Math.pow(1 - x, 3)
const p2io = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
/** ค่า 0..1 ของท่อนที่เริ่ม start ยาว dur ที่เวลา tl */
const seg = (tl: number, start: number, dur: number, ease: (x: number) => number) => ease(clamp01((tl - start) / dur))

/** ท่อนสุดท้ายของท่าประกอบเดิม (หน่วยเวลา timeline) — 3D ค้างท่านี้ (ประกอบเสร็จ) */
const TL_END = 3.23

/** ผิวโฮโล — ดูคำอธิบายใน fragment · รองรับระนาบตัด (E เผยซ้ายไปขวา) และความโปร่งทั้งคำ */
function holoMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    clipping: true,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } },
    vertexShader: /* glsl */ `
      #include <clipping_planes_pars_vertex>
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vP;
      varying float vSide;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mvPosition.xyz);
        vP = (modelMatrix * vec4(position, 1.0)).xyz;
        vSide = 1.0 - abs(normal.z);
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <clipping_planes_pars_fragment>
      uniform float uTime;
      uniform float uAlpha;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vP;
      varying float vSide;
      vec3 pal(float t) {
        return 0.72 + 0.28 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
      }
      void main() {
        #include <clipping_planes_fragment>
        /*
         * สติกเกอร์ฟอยล์โฮโล: สีรุ้งพาสเทลเปลี่ยนตามมุมผิวที่หันหากล้อง + ตำแหน่ง + เวลา
         * ทับแถบรุ้งสลับ (ลายฟอยล์) แสงสะท้อนขาวคม ขอบเรือง · ด้านข้างเข้มลงนิด อ่านความหนา
         */
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        float ndv = clamp(dot(n, v), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 2.5);
        float t = dot(n, vec3(0.9, 0.6, 0.3)) * 1.4 + (vP.x + vP.y * 0.6) * 0.006 + uTime * 0.12 + fres * 0.8;
        vec3 col = pal(t);
        col = mix(col, pal(t + 0.5) * 0.92, 0.25 * (0.5 + 0.5 * sin(t * 18.0)));
        vec3 L = normalize(vec3(-0.4, 0.7, 0.6));
        float spec = pow(max(dot(reflect(-L, n), v), 0.0), 40.0);
        col += vec3(1.0) * spec * 0.9 + vec3(0.9, 0.85, 1.0) * fres * 0.45;
        col *= 1.0 - vSide * 0.28;
        gl_FragColor = vec4(col, uAlpha);
      }`,
  })
}

/** ระนาบตัดของ E ในพิกัดโลโก้ (ก่อนส่าย) — ซ้าย: x ≥ L · ขวา: x ≤ R */
const E_LEFT = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)
const E_RIGHT = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)

function Logo({ clock, times }: Omit<Props, 'className'>) {
  const kit = useMemo(() => {
    const geo = (s: THREE.Shape) => {
      const g = new THREE.ExtrudeGeometry(s, EXTRUDE)
      g.translate(0, 0, -DEPTH / 2)
      return g
    }
    /* ชิ้นเติม (อุดช่อง) — รูปทรงยึดที่จุดยึดของมัน หดด้วย scale รอบจุดนั้น */
    const jCornerA = geo(poly(rel(35, 0), [[0, 0], [35, 0], [35, 32], [0, 32]]))
    const jCornerB = geo(poly(rel(0, 32), [[0, 0], [35, 0], [35, 32], [0, 32]]))
    const hook = new THREE.Shape()
    {
      const f = rel(49, 55)
      hook.moveTo(f(33, 30).x, f(33, 30).y)
      hook.lineTo(f(49, 30).x, f(49, 30).y)
      hook.lineTo(f(49, 47).x, f(49, 47).y)
      hook.absarc(f(41, 47).x, f(41, 47).y, 8, 0, -Math.PI, true)
      hook.closePath()
    }
    const counter = new THREE.Shape()
    {
      const f = rel(220, 26)
      counter.moveTo(f(193, 18).x, f(193, 18).y)
      counter.lineTo(f(212, 18).x, f(212, 18).y)
      counter.absarc(f(212, 26).x, f(212, 26).y, 8, Math.PI / 2, -Math.PI / 2, true)
      counter.lineTo(f(193, 34).x, f(193, 34).y)
      counter.absarc(f(193, 26).x, f(193, 26).y, 8, -Math.PI / 2, Math.PI / 2, true)
    }
    const opening = new THREE.Shape()
    {
      const f = rel(185, 57)
      opening.moveTo(f(193, 49).x, f(193, 49).y)
      opening.lineTo(f(232, 49).x, f(232, 49).y)
      opening.lineTo(f(232, 65).x, f(232, 65).y)
      opening.lineTo(f(193, 65).x, f(193, 65).y)
      opening.absarc(f(193, 57).x, f(193, 57).y, 8, -Math.PI / 2, Math.PI / 2, true)
    }
    const eMat = holoMaterial()
    eMat.clippingPlanes = [new THREE.Plane(), new THREE.Plane()]
    return {
      j: geo(jShape()),
      jCornerA,
      jCornerB,
      hook: geo(hook),
      e: geo(eShape()),
      counter: geo(counter),
      opening: geo(opening),
      front: geo(poly(rel(232, 24.5), [[231, 10], [239, 10], [239, 39], [231, 39]])),
      /* จุดกลม: สร้างที่รัศมี 20 (ขอบมนพอดี) แล้วย่อด้วย scale */
      bullet: geo(ellipse(20, 20)),
      petals: PETALS.map((p) => geo(ellipse(p.rx, p.ry))),
      mat: holoMaterial(),
      eMat,
    }
  }, [])
  useEffect(
    () => () => {
      ;[kit.j, kit.jCornerA, kit.jCornerB, kit.hook, kit.e, kit.counter, kit.opening, kit.front, kit.bullet, ...kit.petals].forEach((g) => g.dispose())
      kit.mat.dispose()
      kit.eMat.dispose()
    },
    [kit],
  )

  const root = useRef<THREE.Group>(null)
  const word = useRef<THREE.Group>(null)
  const j = useRef<THREE.Group>(null)
  const cornerA = useRef<THREE.Mesh>(null)
  const cornerB = useRef<THREE.Mesh>(null)
  const hook = useRef<THREE.Mesh>(null)
  const counter = useRef<THREE.Mesh>(null)
  const opening = useRef<THREE.Mesh>(null)
  const front = useRef<THREE.Mesh>(null)
  const bullet = useRef<THREE.Mesh>(null)
  const petals = useRef<(THREE.Mesh | null)[]>([])
  const eg = useRef<THREE.Group>(null)

  useFrame(({ clock: c, camera, size }) => {
    const g = root.current
    const w = word.current
    if (!g || !w) return
    /* อาร์ตบอร์ดถูกย่อด้วย CSS (พอดีจอ) — แคนวาสวัดขนาดหลังย่อ ตั้ง zoom ให้ 1 หน่วยยังเท่ากับ 1 px ของอาร์ตบอร์ด */
    const z = size.width / 1260
    if (Math.abs(camera.zoom - z) > 1e-4) {
      camera.zoom = z
      camera.updateProjectionMatrix()
    }
    const tc = ((performance.now() - clock.t0) / 1000) % clock.len
    /* 3D ใช้เฉพาะตอนอยู่มุม — ประกอบเสร็จแล้วเสมอ (ท่าประกอบเล่นที่เวกเตอร์) · นูนขึ้น/แบนลงด้วยความหนา (scale z) */
    const tl = TL_END
    const ez = seg(tc, times.on, EXTRUDE_LEN, p2io) * (1 - seg(tc, times.off, EXTRUDE_LEN, p2io))
    g.position.set(CORNER.x, CORNER.y, 0)
    g.scale.set(CORNER.s, CORNER.s, Math.max(0.001, CORNER.s * ez))
    const time = c.elapsedTime
    kit.mat.uniforms.uTime.value = time
    kit.eMat.uniforms.uTime.value = time
    /* ตอนอยู่เฉย ๆ นิ่ง — ไม่ส่าย · เอียงค้างมุมเดียวพอเห็นความหนา (หน้าตรงตอนยังแบน = ตรงกับเวกเตอร์) */
    g.rotation.set(-0.12 * ez, 0.32 * ez, 0)

    /* ทั้งคำ: โปร่ง → ทึบ 0.3 · ถอย −80 → −60 แล้วไถลเข้าที่ */
    /* ค่อย ๆ ชัดขึ้นพร้อมนูน (เวกเตอร์จางออกในจังหวะเดียวกัน — ดู VectorJoe) */
    const alpha = seg(tl, 0, 0.3, p1out) * ez
    kit.mat.uniforms.uAlpha.value = alpha
    kit.eMat.uniforms.uAlpha.value = alpha
    g.visible = alpha > 0.001 && ez > 0.001
    const slide = -80 + 20 * seg(tl, 0, 1.18, p1in) + 60 * seg(tl, 1.17, 2.06, p1out)
    w.position.x = slide

    /* E: ระนาบตัดตาม clip rect เดิม (x 174 → 162, กว้าง 4 → 77) — ย้ายเข้าพิกัดโลก (กลุ่มส่าย) ทุกเฟรม */
    const rx = 174 - 12 * seg(tl, 0.93, 0.39, p2io)
    const rw = 4 + 73 * seg(tl, 0, 1.32, p2out)
    w.updateWorldMatrix(true, false)
    const [pl, pr] = kit.eMat.clippingPlanes as THREE.Plane[]
    pl.copy(E_LEFT).set(pl.normal, -(rx - CX)).applyMatrix4(w.matrixWorld)
    pr.copy(E_RIGHT).set(pr.normal, rx + rw - CX).applyMatrix4(w.matrixWorld)
    /* ช่องกลางงอกจากซ้าย (ชิ้นอุดหดเข้าขวา) · ปากไถลเข้าจากขวา 60 (ชิ้นอุดกว้างตามระยะที่ยังไม่เข้า) · ขีดหน้ากางจากขอบ E */
    const kc = seg(tl, 0.4, 0.66, p2io)
    if (counter.current) {
      counter.current.visible = kc < 0.999
      counter.current.scale.set(Math.max(0.001, 1 - kc), 1, 1)
    }
    const off = 60 * (1 - seg(tl, 0.46, 0.8, p2io))
    if (opening.current) {
      opening.current.visible = off > 0.05
      opening.current.scale.set(Math.max(0.001, Math.min(1, off / 47)), 1, 1)
    }
    const kf = seg(tl, 0.66, 0.4, p2io)
    if (front.current) {
      front.current.visible = kf > 0.001
      front.current.scale.set(Math.max(0.001, kf), 1, 1)
    }

    /* O: จุดกลมวิ่งจากขอบ E (x 173 r 1) มากลาง (x 122 r 20) แล้วหายเมื่อกลีบออก · กลีบจากกลางแยกไปมุม หมุนเข้าที่ */
    const kb = seg(tl, 1.12, 0.51, p2out)
    const bOff = 1 - seg(tl, 1.57, 0.2, p2io)
    if (bullet.current) {
      const r = (1 + 19 * kb) * bOff
      bullet.current.visible = tl >= 1.12 && r > 0.05
      bullet.current.position.set(173 - 51 * kb - CX, CY - 42, 1)
      bullet.current.scale.set(Math.max(0.001, r / 20), Math.max(0.001, r / 20), 1)
    }
    const kp = seg(tl, 1.32, 0.72, p2io)
    const kr = seg(tl, 1.42, 1.4, p2io)
    /* อยู่เฉย ๆ: นิ่งทั้งก้อน เหลือแค่ดอกตัว O หมุนช้ามาก ๆ ตลอด (ชัดขึ้นพร้อมความนูน) */
    const ti = tc - times.on - EXTRUDE_LEN
    const spin = -Math.max(0, ti) * 0.22 * ez
    const fx = 122 - CX
    const fy = CY - 42
    const cs = Math.cos(spin)
    const sn = Math.sin(spin)
    PETALS.forEach((p, i) => {
      const m = petals.current[i]
      if (!m) return
      m.visible = tl >= 1.42
      const px = 122 + (p.cx - 122) * kp - CX - fx
      const py = CY - (42 + (p.cy - 42) * kp) - fy
      m.position.set(fx + px * cs - py * sn, fy + px * sn + py * cs, 0)
      m.rotation.set(0, 0, (-p.rot * Math.PI * kr) / 180 + spin)
    })

    /* J: ตัวถังหล่นจากบน 100 · มุมซ้ายบนเปิด (ชิ้นอุดรูปตัว L หด) · ตะขอเปิด (ชิ้นอุดหดเข้ามุมล่างขวา) */
    if (j.current) {
      const kj = seg(tl, 0.87, 1.74, p2io)
      j.current.visible = kj > 0.001
      j.current.position.y = 100 * (1 - kj)
    }
    const kn = seg(tl, 1.43, 1.45, p2io)
    if (cornerA.current && cornerB.current) {
      cornerA.current.visible = kn < 0.999
      cornerA.current.scale.set(Math.max(0.001, 1 - kn), 1, 1)
      cornerB.current.visible = kn < 0.999 && kn > 0.001
      cornerB.current.scale.set(Math.max(0.001, kn), Math.max(0.001, 1 - kn), 1)
    }
    const kh = seg(tl, 1.6, 1.4, p2io)
    if (hook.current) {
      hook.current.visible = kh < 0.999
      hook.current.scale.set(Math.max(0.001, 1 - kh), Math.max(0.001, 1 - kh), 1)
    }
  })

  return (
    <group ref={root}>
      <group ref={word}>
        <group ref={j} visible={false}>
          <mesh geometry={kit.j} material={kit.mat} />
          <mesh ref={cornerA} geometry={kit.jCornerA} material={kit.mat} position={at(35, 0)} />
          <mesh ref={cornerB} geometry={kit.jCornerB} material={kit.mat} position={at(0, 32)} />
          <mesh ref={hook} geometry={kit.hook} material={kit.mat} position={at(49, 55)} />
        </group>
        <mesh ref={bullet} geometry={kit.bullet} material={kit.mat} visible={false} />
        {kit.petals.map((g, i) => (
          <mesh
            key={i}
            ref={(el) => {
              petals.current[i] = el
            }}
            geometry={g}
            material={kit.mat}
            visible={false}
          />
        ))}
        <group ref={eg}>
          <mesh geometry={kit.e} material={kit.eMat} />
          <mesh ref={counter} geometry={kit.counter} material={kit.eMat} position={at(220, 26)} />
          <mesh ref={opening} geometry={kit.opening} material={kit.eMat} position={at(185, 57)} />
          <mesh ref={front} geometry={kit.front} material={kit.eMat} position={at(232, 24.5)} visible={false} />
        </group>
      </group>
    </group>
  )
}

/** แคนวาสโปร่งเต็มอาร์ตบอร์ด — กล้องออร์โธ 1 หน่วย = 1 px (อาร์ตบอร์ดขนาดคงที่ ย่อทั้งก้อนด้วย CSS) */
export function FastworkLogo3D({ clock, times, className }: Props) {
  return (
    <div className={className} aria-label="Joe" role="img">
      <Canvas
        orthographic
        /* วัดขนาดก่อนย่อ (offsetSize) — อาร์ตบอร์ดถูก scale ด้วย CSS ถ้าวัดหลังย่อ แคนวาสจะถูกย่อซ้ำสองชั้น โลโก้เล็กและเลื่อนผิดที่ */
        resize={{ offsetSize: true }}
        camera={{ position: [0, 0, 1000], zoom: 1, near: 1, far: 4000 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true
        }}
      >
        <Logo clock={clock} times={times} />
      </Canvas>
    </div>
  )
}
