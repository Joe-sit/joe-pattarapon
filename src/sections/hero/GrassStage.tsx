import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HeroRider, armPoseFromTuner } from '@/newhero/HeroRider'
import { GRASS_TUNE, TUNE_DEFAULTS, tuneBus } from './grassTune'
import { DEFAULTS, getTuner } from '@/newhero/tuner'
import { HeroLights } from '@/newhero/heroLights'
import { CameraFX } from '@/newhero/CameraFX'
import { DECK_WORKS } from './WorksGallery'
import { loadVoxelHand, makeGripHand, poseGripHand, type GripHand } from './voxelHand'
import { CUT, GRASS_OUT, GRASS_SCROLL, STORY_FONT, devScreen, grassPhone, smooth, worksPost, type WorkBeats } from './workMotion'

/**
 * Selected Work บนพื้นหญ้า — ปลายทางของเรื่องท้องฟ้า (ร่วงจากฟ้า → ลงจอดบนพื้น) · GRASS_STORY ใน ./workMotion
 *
 *   เปิด (GRASS_OPEN, บท Code)  ฉากโผล่ในกรอบจอมือถือที่มือถืออยู่ (./HoldHand) แล้วกรอบขยายเต็มจอ
 *                               กล้องหมุนออกจากมุมตรง (มองแถวการ์ดเหมือนดูในจอ) ลงไปเป็นมุมเสยช้อนจากพื้นหญ้า
 *   ไถ (GRASS_SCROLL)           แถวการ์ดงานไหลไปซ้ายตามสกรอลล์ — ตัวละครยืนมุมขวาล่างไถมือถือ (จอในมือไหลตามกัน)
 *   ออก (GRASS_OUT)             กล้องเงยขึ้นฟ้า หญ้าลงพ้นจอ ฉากจาง → ฟ้าของ FallSky → ด่านหนังสติ๊ก
 *
 * แคนวาสโปร่ง: ฟ้า/เมฆ/ภูเขาข้างหลังเป็นของ FallSky (ชั้นล่าง) — พื้นจางหายเข้าฟ้าที่ขอบฟ้า
 * หญ้าเป็นใบจริง (InstancedMesh ใบเดียว draw call เดียว) ไหวตามลมใน vertex shader
 */
const N_BLADES = 34000
/** เนื้อหา Selected Work (หัวข้อ การ์ด ป้ายเลื่อน) — ปิดไว้จนกว่าฉากจะตรง ref (Joe สั่ง: ทำฉากให้เป๊ะก่อน) */
const SHOW_CONTENT = false
/** ความสูงอ้างอิงของฉาก (เดิมเป็นระดับแถวการ์ด 3D — ตอนนี้การ์ดเป็นกระจก DOM) */
const CARD_Y = 4.05
/** ที่ยืนตัวละคร (ค่าตั้งต้นของแผง) — พื้นรอบ ๆ แบนราบ หญ้าเว้นรอบเท้า */
const RIDER_AT = [TUNE_DEFAULTS.riderX, 0, TUNE_DEFAULTS.riderZ] as const
/*
 * ภูมิประเทศ ต้นไม้ เมฆ — ฟิตจากภาพ ref ของ Joe ด้วยกล้องมุมสุดท้ายจริง (ค่าตั้งต้นใน ./grassTune · แคนวาสกลับซ้ายขวา)
 *   เนิน: ค้นค่าเกาส์เซียนสี่ลูกให้ "ขอบบนของพื้น" ทุกคอลัมน์ตรงกับ ref (เฉลี่ยคลาด ~8px ที่จอ 1672×941)
 *         พื้นใต้เท้าตัวละครสูง ~0.23 ม. · ใต้กล้อง ~0.09 ม. (กล้องอยู่เหนือพื้นเสมอ — เดิมกล้องจมใต้พื้น ภาพหน้ากล้องเพี้ยน)
 *   ต้นไม้/เมฆ: ยิงเส้นจากกล้องผ่านตำแหน่งบนจอของ ref ลงพื้น (หรือไกล 60 ม. สำหรับเมฆ) ขนาดจากความสูง/กว้างเป็น px
 * เปลี่ยนมุมกล้องตั้งต้นเมื่อไร ต้องฟิตใหม่ (สคริปต์ fit/place อยู่นอก repo)
 */
const HILLS: readonly { x: number; z: number; h: number; r: number }[] = [
  { x: 13.189, z: -6.447, h: 2.394, r: 3.707 },
  { x: -8.456, z: -3.646, h: 0.378, r: 1.919 },
  { x: -7.679, z: -6.793, h: 1.623, r: 5.003 },
  { x: -1.68, z: -4.494, h: 0.255, r: 2.918 },
]
function hillRaw(x: number, z: number) {
  let h = 0
  for (const g of HILLS) h += g.h * Math.exp(-((x - g.x) ** 2 + (z - g.z) ** 2) / (2 * g.r * g.r))
  return h
}
/**
 * พื้นใต้เท้าตัวละครแบนราบ (รัศมี ~0.9 ม. ค่อยกลืนเข้าเนินถึง 1.8 ม.) — เนินเอียงทำให้เท้าข้างหนึ่งลอย อีกข้างจม ขาดูไม่เท่ากัน
 */
const FLAT_H = hillRaw(RIDER_AT[0], RIDER_AT[2])
function hill(x: number, z: number) {
  const d = Math.hypot(x - RIDER_AT[0], z - RIDER_AT[2])
  const t = Math.min(1, Math.max(0, (d - 0.9) / 0.9))
  return FLAT_H + (hillRaw(x, z) - FLAT_H) * t * t * (3 - 2 * t)
}
/** เมฆปุย [x, y, z, ขนาด] */
const CLOUDS: readonly [number, number, number, number][] = [
  [49.4, 19.88, -22.84, 3.158],
  [39.13, 9.91, -40.34, 4.921],
  [-26.29, 35.37, -38.17, 2.973],
  [-26.3, 19.65, -47.47, 2.657],
  [20.84, 6.93, -52.22, 1.901],
]
/** ต้นไม้ [x, z, ขนาด] (สูง ~3.05 × ขนาด) */
const TREES: readonly [number, number, number][] = [
  [11.07, -4.48, 0.741],
  [10.93, -5.44, 0.464],
  [1.51, -12.49, 1.45],
  [5.26, -15.73, 0.634],
  [9.85, -18.16, 0.434],
  [-5.33, -6.65, 0.731],
  [9.68, -6.22, 0.171],
]
/** แผงจัดท่า — dev เท่านั้น แยก chunk (ไม่ใช่ของในฉาก) */
const GrassTuner = lazy(() => import('./GrassTuner'))
const Rider = HeroRider as unknown as React.ComponentType<Record<string, unknown>>
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** worksPost: หมุนกล้องออกจากจอมือถือในมือไปมุมเสย [เริ่ม, ยาว] — เริ่มพร้อมตัดเข้าฉาก (CUT) */
const GRASS_PULL = [-0.37, 0.9] as const
/** เฟรมแรก: กล้องห่างจอมือถือเท่านี้ (ม.) — อยู่หน้าหน้าตัวละคร ไม่ทะลุหัว/ตัว · เลนส์คำนวณให้มือถือทับกรอบเครื่องเดิมพอดี */
const D0_POV = 0.32
/** ขนาดจอของมือถือ (ม. ก่อนคูณ phoneS) */
const PHONE_SCR = [0.2, 0.41] as const
/**
 * e (ระยะหมุนออก): มือ 2D แบบ Frame 1 (HoldHand) จางเผยมือ 3D ชุดเดียวกันที่ติดมือถือ [เริ่ม, ยาว] — ก่อนมือถือเริ่มเอียง
 * ม่านดำรอบมือถือเปิด (ฉากสว่างขึ้นจากความมืดของบท Code) [เริ่ม, ยาว]
 */
const HAND_SWAP = [0, 0.05] as const
const CURTAIN = [0.02, 0.22] as const
/**
 * ตอนต้นมือถือยื่นห่างตัวกว่าท่าสุดท้าย (ม. ตามหน้าตัว) แล้วค่อยดึงเข้าหาตัวระหว่างกล้องหมุนออก [ระยะ, e เริ่ม, ยาว]
 * มุมมองจอมือถือ (กล้องอยู่ระหว่างจอกับหน้า) ต้องมีที่ว่าง — มือถือชิดตัวแบบภาพ ref กล้องจะทับไหล่/อก
 */
const PHONE_REACH = [0.22, 0.15, 0.6] as const
const GP_A = new THREE.Vector3()
const HAND_C = new THREE.Vector3()
const HEAD_P = new THREE.Vector3()
const PH_P = new THREE.Vector3()
const PH_N = new THREE.Vector3()
const PH_Q = new THREE.Quaternion()
const PH_UP = new THREE.Vector3()
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const ARC_B = new THREE.Vector3()
const PALM_W = new THREE.Vector3()
const SH_P = new THREE.Vector3()
const ARM_AX = new THREE.Vector3()
const ARM_W = new THREE.Vector3()
const SH_Q = new THREE.Quaternion()
const PAR_Q = new THREE.Quaternion()
const DQ = new THREE.Quaternion()
const ARC_S = new THREE.Vector3()
const DIR = new THREE.Vector3()
const END_P = new THREE.Vector3()
const END_T = new THREE.Vector3()

/* ── ใบหญ้า ── */
const bladeVert = /* glsl */ `
  uniform float uTime;
  varying float vH;
  varying float vTone;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec4 base = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 p = position;
    float h = uv.y;
    /* เรียวปลาย */
    p.x *= 1.0 - h * 0.85;
    /* ใกล้กล้องเกิน (กล้องมุมสุดท้ายเกือบติดพื้น) ใบหญ้าจะเป็นแผ่นยักษ์บังจอ — หดใบตามระยะจากกล้องจริง (ไม่ผูกตำแหน่งกล้องตายตัว) */
    float dc = distance(base.xz, cameraPosition.xz);
    p.y *= smoothstep(0.9, 2.2, dc);
    /* ลม: คลื่นยาวพัดผ่านทุ่ง + สั่นเฉพาะใบ — โค้งที่ปลาย (h^2) โคนอยู่กับที่ */
    float gust = sin(uTime * 1.3 + base.x * 0.45 + base.z * 0.3) * 0.5 + 0.5;
    float flick = sin(uTime * 3.1 + hash(base.xz) * 6.28) * 0.25;
    float bend = (0.18 + gust * 0.32 + flick * 0.12) * h * h;
    vec4 w = instanceMatrix * vec4(p, 1.0);
    w.x += bend * 0.9;
    w.z -= bend * 0.35;
    w.y -= bend * bend * 0.35;
    vH = h;
    vTone = hash(base.xz * 1.7);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * w;
  }`
const bladeFrag = /* glsl */ `
  varying float vH;
  varying float vTone;
  void main() {
    /* เขียวอิ่ม (ACES ใน CameraFX ดันสีสว่างไปทางขาว — ปลายใบสว่างจัดจะซีดเป็นเส้นขาว) */
    vec3 root = vec3(0.17, 0.46, 0.13);
    vec3 tip = mix(vec3(0.42, 0.74, 0.22), vec3(0.52, 0.80, 0.28), vTone);
    vec3 col = mix(root, tip, smoothstep(0.0, 1.0, vH));
    gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
    #include <colorspace_fragment>
  }`

/**
 * จอมือถือในมือตัวละคร = UI ชุดเดียวกับจอเครื่องในบท Code (BenchScreen: พื้นดำ · เกาะบน · วิดเจ็ตฟ้า · การ์ดเขียว · การ์ดพีช)
 * ตอนตัดเข้าฉาก (CUT) มือถือนี้ทับจอเครื่องเดิมพอดี — ภาพในจอต้องเป็นชุดเดียวกัน คนดูถึงอ่านว่าเป็นเครื่องเดิม
 */
function paintPhone() {
  const W = 256
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath()
    g.roundRect(x * W, y * H, w * W, h * H, r)
  }
  const grad = (y0: number, y1: number, a: string, b: string) => {
    const k = g.createLinearGradient(0, y0 * H, 0, y1 * H)
    k.addColorStop(0, a)
    k.addColorStop(1, b)
    return k
  }
  g.fillStyle = '#060608'
  g.fillRect(0, 0, W, H)
  /* เกาะบน */
  rr(0.17, 0.035, 0.66, 0.055, 14)
  g.fillStyle = '#141418'
  g.fill()
  /* วิดเจ็ตฟ้า (มุมซ้ายบน) */
  rr(0.12, 0.12, 0.36, 0.18, 18)
  g.fillStyle = grad(0.12, 0.3, '#7cb0ff', '#3c74ee')
  g.fill()
  /* การ์ดเขียว: ฟองส้ม + แถบส้มสองแถบ + ป้ายบวกแดง */
  rr(0.12, 0.34, 0.76, 0.28, 18)
  g.fillStyle = grad(0.34, 0.62, '#eef7c9', '#c6e57c')
  g.fill()
  g.fillStyle = '#f2864e'
  g.beginPath()
  g.ellipse(0.24 * W, 0.4 * H, 0.08 * W, 0.03 * H, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#d98a4a'
  rr(0.17, 0.5, 0.58, 0.022, 6)
  g.fill()
  rr(0.17, 0.545, 0.36, 0.022, 6)
  g.fill()
  g.fillStyle = '#e8423c'
  g.beginPath()
  g.arc(0.84 * W, 0.345 * H, 0.045 * W, 0, Math.PI * 2)
  g.fill()
  /* การ์ดพีช: ช่องค้นหาขาว + ต้นไม้เขียวเล็ก */
  rr(0.12, 0.66, 0.76, 0.29, 18)
  g.fillStyle = grad(0.66, 0.95, '#ffc6aa', '#ef6f7b')
  g.fill()
  g.fillStyle = '#ffffff'
  rr(0.2, 0.73, 0.16, 0.08, 8)
  g.fill()
  g.fillStyle = '#c4e84c'
  g.beginPath()
  g.arc(0.66 * W, 0.78 * H, 0.06 * W, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  g.ellipse(0.42 * W, 0.9 * H, 0.07 * W, 0.02 * H, 0, Math.PI, 0)
  g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

type Shared = { post: number; pull: number; out: number; scroll: number; start: { cx: number; cy: number; hh: number; ok: boolean } }

function Scene({ st }: { st: React.RefObject<Shared> }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const rider = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const phone = useRef<THREE.Mesh | null>(null)
  const phoneRoot = useRef<THREE.Group>(null)
  const pocketHand = useRef<THREE.Object3D | null>(null)
  const curtain = useRef<THREE.Mesh>(null)
  /* มือโวเซล — โหลดครั้งเดียว (ใช้ glTF ร่วมกับ HoldHand) clone ของแคนวาสนี้ */
  const grip = useRef<GripHand | null>(null)
  useEffect(() => {
    let dead = false
    loadVoxelHand().then((g) => {
      if (!dead) grip.current = makeGripHand(g, 1)
    })
    return () => {
      dead = true
      grip.current?.root.removeFromParent()
      grip.current?.dispose()
      grip.current = null
    }
  }, [])
  const elbow = useRef<THREE.Object3D | null>(null)
  const shoulder = useRef<THREE.Object3D | null>(null)
  const forearm = useRef<THREE.Mesh | null>(null)
  const rimK = useRef(1)
  const fit = useRef({ n: 0, h: 0 })
  const T = useMemo(() => new THREE.Vector3(), [])

  const res = useMemo(() => {
    /* เนินหญ้า: ราบรอบตัวละคร แล้วเป็นลูกคลื่นนุ่ม ๆ ออกไป (แบบภาพ ref) */
    const groundGeo = new THREE.PlaneGeometry(160, 160, 300, 300)
    groundGeo.rotateX(-Math.PI / 2)
    const gp = groundGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < gp.count; i++) gp.setY(i, hill(gp.getX(i), gp.getZ(i)))
    groundGeo.computeVertexNormals()
    /* หญ้าเนินนุ่ม: แสงจากผิวเนินจริง (ยอดสว่าง ร่องเข้ม) · ไกล ๆ กลืนหมอกฟ้า (fog ของฉาก) แบบภาพ ref */
    const ground = new THREE.MeshStandardMaterial({
      color: '#7fd15e',
      roughness: 1,
      metalness: 0,
    })
    const bladeGeo = new THREE.PlaneGeometry(0.05, 1, 1, 4)
    bladeGeo.translate(0, 0.5, 0)
    const blade = new THREE.ShaderMaterial({
      vertexShader: bladeVert,
      fragmentShader: bladeFrag,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
    })
    const blades = new THREE.InstancedMesh(bladeGeo, blade, N_BLADES)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    let seed = 7
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < N_BLADES; i++) {
      /* หนาแน่นใกล้กล้อง (z สูง) — ไกลออกไปพื้น shader รับช่วง */
      /* หญ้าอยู่หน้ากล้อง (กล้องมุมสุดท้ายอยู่ z ~3.7) — ใกล้กล้องเกินจะเป็นใบยักษ์เต็มจอ */
      const z = lerp(-7, 2.7, Math.sqrt(rnd()))
      const x = (rnd() - 0.5) * lerp(28, 12, (z + 7) / 9.7)
      /* เว้นรอบเท้าตัวละคร (เห็นรองเท้าบนหญ้า) */
      if (Math.hypot(x - RIDER_AT[0], z - RIDER_AT[2]) < 0.75) {
        i--
        continue
      }
      p.set(x, hill(x, z), z)
      q.setFromEuler(e.set((rnd() - 0.5) * 0.25, rnd() * Math.PI, (rnd() - 0.5) * 0.25))
      const hgt = lerp(0.07, 0.17, rnd())
      s.set(lerp(0.7, 1.3, rnd()), hgt, 1)
      m.compose(p, q, s)
      blades.setMatrixAt(i, m)
    }
    blades.instanceMatrix.needsUpdate = true
    blades.frustumCulled = false
    /* ต้นไม้ทรงพุ่มกลม (ลำต้น + พุ่มสามก้อน) บนเนินไกล ๆ — InstancedMesh สองชุด */
    const trunkGeo = new THREE.CylinderGeometry(0.13, 0.18, 1, 8)
    trunkGeo.translate(0, 0.5, 0)
    const leafGeo = new THREE.IcosahedronGeometry(1, 3)
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 1 }), TREES.length)
    const leaves = new THREE.InstancedMesh(
      leafGeo,
      new THREE.MeshStandardMaterial({
        color: '#6fcb58',
        roughness: 0.9,
        emissive: '#2f7a28',
        emissiveIntensity: 0.18,
      }),
      TREES.length * 3,
    )
    TREES.forEach(([tx, tz, ts], i) => {
      const ty = hill(tx, tz)
      m.compose(p.set(tx, ty, tz), q.identity(), s.set(ts, ts * 1.5, ts))
      trunks.setMatrixAt(i, m)
      const blobs = [
        [0, 2.05, 0, 1.0],
        [-0.55, 1.65, 0.2, 0.72],
        [0.6, 1.7, -0.1, 0.78],
      ]
      blobs.forEach(([bx, by, bz, br], j) => {
        m.compose(p.set(tx + bx * ts, ty + by * ts, tz + bz * ts), q.identity(), s.setScalar(br * ts))
        leaves.setMatrixAt(i * 3 + j, m)
      })
    })
    trunks.instanceMatrix.needsUpdate = true
    /* เมฆปุยนุ่ม (ก้อนกลมซ้อนกัน) ไกล ๆ หลังเนิน — แบบภาพ ref */
    const puffs: [number, number, number, number][] = []
    CLOUDS.forEach(([cx, cy, cz, cs]) => {
      ;[
        [0, 0, 0, 1],
        [1.2, -0.25, 0.2, 0.78],
        [-1.15, -0.3, 0.1, 0.72],
        [0.45, 0.45, -0.2, 0.7],
        [2.1, -0.45, 0, 0.5],
        [-2.0, -0.5, 0, 0.45],
      ].forEach(([px, py, pz, pr]) => puffs.push([cx + px * cs, cy + py * cs, cz + pz * cs, pr * cs]))
    })
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 1,
      emissive: '#eaf3ff',
      emissiveIntensity: 0.55,
      fog: false,
    })
    const clouds = new THREE.InstancedMesh(leafGeo, cloudMat, puffs.length)
    puffs.forEach(([px, py, pz, pr], i) => {
      m.compose(p.set(px, py, pz), q.identity(), s.set(pr, pr * 0.82, pr))
      clouds.setMatrixAt(i, m)
    })
    clouds.instanceMatrix.needsUpdate = true
    leaves.instanceMatrix.needsUpdate = true
    /*
     * ม่านดำเต็มจอ (วาดหลังทุกอย่าง ยกเว้นมือถือ) — เฟรมแรกหลังตัดเหลือแค่มือถือบนความมืด = เฟรมสุดท้ายของบท Code
     * แล้วค่อยเปิดตอนกล้องหมุนออก ฉากหญ้าสว่างขึ้นรอบมือถือ (ไม่มีภาพสองฉากซ้อนกัน)
     */
    const curtainGeo = new THREE.PlaneGeometry(2, 2)
    const curtainMat = new THREE.ShaderMaterial({
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform float uA; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, uA); }',
      uniforms: { uA: { value: 1 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const phoneTex = paintPhone()
    /* มือถือวาดในรอบโปร่ง (transparent ทึบเต็ม) หลังม่าน — ม่านไม่ทับ · ยังเทียบความลึกปกติ (นิ้วตัวละครบังได้) */
    const phoneBody = new THREE.MeshStandardMaterial({
      color: '#e6e9f0',
      roughness: 0.35,
      metalness: 0.2,
      transparent: true,
    })
    const phoneScreen = new THREE.MeshBasicMaterial({
      map: phoneTex,
      toneMapped: false,
      transparent: true,
    })
    const phoneFront = new THREE.MeshStandardMaterial({ color: '#0b0c10', roughness: 0.25, metalness: 0.1, transparent: true })
    const phoneBump = new THREE.MeshStandardMaterial({
      color: '#c9ced8',
      roughness: 0.3,
      metalness: 0.3,
      transparent: true,
    })
    const phoneLens = new THREE.MeshStandardMaterial({
      color: '#1b1f2a',
      roughness: 0.2,
      metalness: 0.4,
      transparent: true,
    })
    return {
      groundGeo,
      ground,
      bladeGeo,
      blade,
      blades,
      curtainGeo,
      curtainMat,
      phoneTex,
      phoneBody,
      phoneScreen,
      phoneFront,
      phoneBump,
      phoneLens,
      trunkGeo,
      leafGeo,
      trunks,
      leaves,
      clouds,
    }
  }, [])
  useEffect(
    () => () => {
      res.groundGeo.dispose()
      res.ground.dispose()
      res.bladeGeo.dispose()
      res.blade.dispose()
      res.blades.dispose()
      res.curtainGeo.dispose()
      res.curtainMat.dispose()
      res.phoneTex.dispose()
      res.phoneBody.dispose()
      res.phoneScreen.dispose()
      res.phoneFront.dispose()
      res.phoneBump.dispose()
      res.phoneLens.dispose()
      res.trunkGeo.dispose()
      res.leafGeo.dispose()
      ;(res.trunks.material as THREE.Material).dispose()
      ;(res.leaves.material as THREE.Material).dispose()
      res.trunks.dispose()
      ;(res.clouds.material as THREE.Material).dispose()
      res.clouds.dispose()
      res.leaves.dispose()
    },
    [res],
  )

  /*
   * ตัวละครชุดเดียวกับ hero เป๊ะ (แบบจอ What I do — whatidocard/CardStage): ไม่ทับท่าแขน/ขา/ลำตัวเอง
   * ท่าทั้งหมดมาจากค่าที่จูนไว้ของ hero (แขนชี้ + แขนถือแก้ว) · ไม่มีท่าไหว (noIdle) · หัวนิ่ง ไม่ตามเมาส์
   * มือถือถือในมือข้างที่ hero ถือแก้ว (ท่าที่จูนไว้แล้ว ไม่ต้องบิดแขนใหม่ = ไม่ผิดรูป)
   */
  /* ท่าทั้งตัวมาจากแผงจัดท่า (GRASS_TUNE — ./GrassTuner) อ่านทุกเฟรม · หัวต้องสร้างออบเจกต์ใหม่ (Mascot คัดลอก followOverride ครั้งเดียว) */
  const [tv, setTv] = useState(0)
  useEffect(() => {
    const f = () => setTv((v) => v + 1)
    tuneBus.subs.add(f)
    return () => {
      tuneBus.subs.delete(f)
    }
  }, [])
  const follow = useMemo(() => {
    void tv
    const T = GRASS_TUNE
    return {
      headYaw: 0,
      headPitch: 0,
      headRoll: 0,
      headEase: 1,
      headBaseYaw: T.headYaw * D2R,
      headBasePitch: T.headPitch * D2R,
      headBaseRoll: T.headRoll * D2R,
      headFollow: 0,
      headCurve: 1,
      headDead: 0,
      headBounce: 0,
      headIdleBack: 0,
    }
  }, [tv])
  const armPose = useMemo(() => ({ ...armPoseFromTuner(getTuner()) }) as Record<string, number>, [])
  const legPose = useMemo(
    () => ({
      L: { hipX: 0, hipY: 0, hipZ: 0, knee: 0, ankle: 0 },
      R: { hipX: 0, hipY: 0, hipZ: 0, knee: 0, ankle: 0 },
      spread: 0,
      stagger: 0,
    }),
    [],
  )
  const torsoPose = useMemo(() => ({ leanX: 0, leanZ: 0, foldX: 0, foldY: 0, foldZ: 0, headX: 0 }), [])

  useFrame(({ clock }) => {
    const s = st.current
    if (!s) return
    res.blade.uniforms.uTime.value = clock.elapsedTime
    /* แผงจัดท่า → ริก (ทุกเฟรม — ริกอ่านออบเจกต์ท่าเดิมทุกเฟรม) */
    const TU = GRASS_TUNE
    for (const k of ['aimX', 'aimY', 'aimZ', 'aimOut', 'aimUp', 'aimFwd', 'mugOut', 'mugUp', 'mugFwd']) armPose[k] = TU[k]
    for (const k of ['elbowX', 'elbowY', 'elbowZ', 'wristX', 'wristY', 'wristZ', 'mugShX', 'mugShY', 'mugShZ', 'mugElX', 'mugElY', 'mugElZ', 'mugWristX', 'mugWristY', 'mugWristZ'])
      armPose[k] = TU[k] * D2R
    legPose.L.hipX = TU.lHipX * D2R
    legPose.L.hipY = TU.lHipY * D2R
    legPose.L.hipZ = TU.lHipZ * D2R
    legPose.L.knee = TU.lKnee * D2R
    legPose.L.ankle = TU.lAnkle * D2R
    legPose.R.hipX = TU.rHipX * D2R
    legPose.R.hipY = TU.rHipY * D2R
    legPose.R.hipZ = TU.rHipZ * D2R
    legPose.R.knee = TU.rKnee * D2R
    legPose.R.ankle = TU.rAnkle * D2R
    legPose.spread = TU.spread
    legPose.stagger = TU.stagger
    torsoPose.leanX = TU.leanX * D2R
    torsoPose.leanZ = TU.leanZ * D2R
    torsoPose.foldX = TU.foldX * D2R
    torsoPose.foldY = TU.foldY * D2R
    torsoPose.foldZ = TU.foldZ * D2R
    torsoPose.headX = TU.neckX * D2R
    /*
     * ช่วงวัดขนาดตัว (เฟรมแรก ๆ): ยืนตรงท่ากลาง — ขนาด/จุดกลางที่วัดจาก bbox ต้องไม่ขึ้นกับท่าขา/เอน
     * (เดิมวัดในท่าที่จูน: เปลี่ยนท่ากางขาแล้วตัวละครทั้งตัวย่อ/ขยาย/เลื่อนตาม)
     */
    if (!fit.current.h) {
      for (const L of [legPose.L, legPose.R]) L.hipX = L.hipY = L.hipZ = L.knee = L.ankle = 0
      legPose.spread = legPose.stagger = 0
      torsoPose.leanX = torsoPose.leanZ = torsoPose.foldX = torsoPose.foldY = torsoPose.foldZ = 0
    }
    /*
     * กล้อง: มือจับมือถือ (HoldHand) → ตัดหมุนเข้าฉากนี้ที่มุมมองตัวละคร (กล้องอยู่ฝั่งจอมือถือในมือ มองจอตรง ๆ)
     *   → หมุนออกเป็นส่วนโค้งรอบตัวละคร (พิกัดเชิงขั้วรอบแกนตั้งกลางตัว ไม่ lerp เส้นตรงทะลุตัว) ลงต่ำเกือบติดหญ้า เงยขึ้น
     *   = มุมเสยช้อนจากพื้น ตัวละครยืนขวาล่าง (แบบภาพ ref) · ออก: เงยต่อขึ้นฟ้า
     */
    const q = s.out
    /* หมุนออก (smoothstep ของสกรอลล์): เริ่มช้า ต่อจากเครื่องที่นิ่งในบท Code → เร็วกลางทาง → เบรกลงมุมเสย */
    const e = s.pull
    const phn = phone.current
    END_P.set(TU.camX, TU.camY, TU.camZ)
    END_T.set(TU.lookX, TU.lookY, TU.lookZ)
    let fovS = TU.fov
    if (phn) {
      phn.updateWorldMatrix(true, false)
      phn.getWorldPosition(PH_P)
      PH_N.set(0, 0, 1).applyQuaternion(phn.getWorldQuaternion(PH_Q)).normalize()
      PH_UP.set(0, 1, 0).applyQuaternion(PH_Q)
      /*
       * เฟรมแรก (ตอนตัด CUT) = มือถือทับจอเครื่องเดิมพอดี: กล้องอยู่ฝั่งจอ ห่าง D0_POV มองจอตรง ๆ
       * เลนส์คำนวณจากขนาดจอเครื่องบนจอ (px) ให้ขนาดเท่ากัน · ตำแหน่งบนจอใช้เลนส์เลื่อน (setViewOffset) ไม่เบนกล้อง
       */
      const sd = s.start
      const phHalfH = PHONE_SCR[1] * 0.5 * TU.phoneS
      const pxK = sd.ok && sd.hh > 1 ? size.height / 2 / sd.hh : 1.7
      fovS = THREE.MathUtils.clamp((2 * Math.atan((phHalfH * pxK) / D0_POV)) / D2R, 40, 100)
      const d0 = (phHalfH * pxK) / Math.tan((fovS * D2R) / 2)
      /*
       * หมุนออกเป็นส่วนโค้งรอบมือถือ (ไม่ใช่รอบแกนตัวละคร — แบบนั้นกล้องกวาดผ่านไหล่/อก เห็นก้อนตัวบังจอ)
       * ฝั่งจอ → อ้อมด้านข้างฝั่งตรงข้ามหัว (ไม่ทะลุหัว) → ทิศกล้องมุมสุดท้าย (หลังเครื่อง) · เบซิเยร์บนทรงกลมรอบมือถือ
       * ระยะถอยแบบ S: ต้นช้า (ยังอยู่ฝั่งจอ ถอยเร็ว = ถอยทะลุอก) · กลางเร็ว (ตอนอ้อมข้าง ชิดไปแขนเต็มจอ)
       */
      /*
       * ทิศอ้อม = แนวนอน ตั้งฉากกับแกนจอ ฝั่งตรงข้ามหัว (ด้านที่โล่ง) — ไม่ทะลุหัว ไม่ข้ามหัวลงมามองเท้า
       * ศอกอยู่หลัง/ใต้มือถือ อ้อมข้างจึงไม่เฉียดแขน · ลงต่ำทีหลังตามทิศมุมสุดท้าย (เบซิเยร์)
       */
      ARC_S.crossVectors(PH_N, WORLD_UP)
      if (ARC_S.lengthSq() < 1e-6) ARC_S.set(1, 0, 0)
      ARC_S.normalize()
      const hd = phn.userData.head as THREE.Object3D | null
      if (hd && ARC_S.dot(hd.getWorldPosition(HEAD_P).sub(PH_P)) > 0) ARC_S.negate()
      const r1 = ARC_B.subVectors(END_P, PH_P).length()
      ARC_B.divideScalar(r1)
      const ta = smooth(e / 0.7)
      DIR.copy(PH_N)
        .multiplyScalar((1 - ta) ** 2)
        .addScaledVector(ARC_S, 2 * ta * (1 - ta))
        .addScaledVector(ARC_B, ta * ta)
        .normalize()
      camera.position.copy(PH_P).addScaledVector(DIR, lerp(d0, r1, smooth(e)))
      /*
       * เบี่ยงออกข้าง (ฝั่งตรงข้ามหัว · TU.arcBulge ม.) ช่วงต้น-กลาง — ไม่เฉียดหัว/ไหล่จนเต็มจอ
       * ดันตามรัศมีไม่ได้: ช่วงต้นทิศรัศมีชี้เข้าหน้า = ดันเข้าหัว · ยอดราว e 0.3 แล้วคืน 0 ตอนจบ
       */
      camera.position.addScaledVector(ARC_S, TU.arcBulge * Math.sin(Math.PI * Math.pow(e, 0.6)))
      T.lerpVectors(PH_P, END_T, e)
    } else {
      camera.position.copy(END_P)
      T.copy(END_T)
    }
    camera.position.y = Math.max(camera.position.y, hill(camera.position.x, camera.position.z) + 0.1)
    camera.position.y += q * 0.6
    T.y += q * q * 16
    /* ต้นทาง: แกนขึ้นของกล้อง = แกนขึ้นของมือถือ (มือถือตั้งตรงแบบเครื่องในบท Code) → ค่อย ๆ คืนแกนโลก (ม้วนกล้องตอนหมุนออก) */
    if (phn)
      camera.up
        .copy(PH_UP)
        .lerp(WORLD_UP, smooth(e / 0.6))
        .normalize()
    else camera.up.copy(WORLD_UP)
    camera.lookAt(T)
    camera.fov = lerp(fovS, TU.fov, e)
    const sdv = s.start
    const off = 1 - e
    if (sdv.ok && off > 1e-4) {
      const vw = size.width
      const vh = size.height
      const cxCanvas = TU.mirror > 0.5 ? vw - sdv.cx : sdv.cx
      camera.setViewOffset(vw, vh, (vw / 2 - cxCanvas) * off, (vh / 2 - sdv.cy) * off, vw, vh)
    } else camera.clearViewOffset()
    /* ม่านดำเปิดตามการหมุน · rim (CameraFX) หรี่ตาม — ไม่งั้นขอบขาวของตัวละครลอยบนความมืด */
    const cur = 1 - smooth((e - CURTAIN[0]) / CURTAIN[1])
    res.curtainMat.uniforms.uA.value = cur
    if (curtain.current) curtain.current.visible = cur > 0.002
    rimK.current = 1 - cur
    camera.updateProjectionMatrix()
    /*
     * กรอบจอมือถือบนจอ (px ของหน้าเว็บ — กลับซ้ายขวาตามแคนวาส) ให้มือแบบ Frame 1 (HoldHand) จับต่อ
     * สลับเป็นมือจริงของตัวละครตอนกล้องถอยออกไปแล้ว (มือในภาพเล็กลง + ภาพกำลังเคลื่อน — การสลับกลืนไปกับการเคลื่อน)
     */
    if (phn) {
      phn.updateWorldMatrix(true, false)
      const vw = size.width
      const vh = size.height
      const toPx = (v: THREE.Vector3) => {
        v.project(camera)
        const x = ((v.x + 1) / 2) * vw
        return [TU.mirror > 0.5 ? vw - x : x, ((1 - v.y) / 2) * vh] as const
      }
      const c0 = toPx(GP_A.set(0, 0, 0.016).applyMatrix4(phn.matrixWorld))
      const cu = toPx(GP_A.set(0, PHONE_SCR[1] / 2, 0.016).applyMatrix4(phn.matrixWorld))
      const cr = toPx(GP_A.set(PHONE_SCR[0] / 2, 0, 0.016).applyMatrix4(phn.matrixWorld))
      grassPhone.cx = c0[0]
      grassPhone.cy = c0[1]
      grassPhone.hh = Math.hypot(cu[0] - c0[0], cu[1] - c0[1])
      grassPhone.hw = Math.hypot(cr[0] - c0[0], cr[1] - c0[1])
      grassPhone.tx = cu[0]
      grassPhone.ty = cu[1]
      grassPhone.roll = Math.atan2(cu[0] - c0[0], -(cu[1] - c0[1]))
      grassPhone.hand = 1 - smooth((e - HAND_SWAP[0]) / HAND_SWAP[1])
      grassPhone.ok = true
    }
    /* ตัวละคร: วัดขนาดครั้งแรก แล้ววาง/ย่อ/หันตามแผงจัดท่าทุกเฟรม */
    const rg = rider.current
    const inn = inner.current
    if (rg && inn && !fit.current.h) {
      if (++fit.current.n > 6) {
        const box = new THREE.Box3().setFromObject(inn)
        if (!box.isEmpty()) {
          fit.current.h = box.max.y - box.min.y
          inn.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
        }
      }
    }
    if (rg && fit.current.h) {
      rg.scale.setScalar(TU.riderH / fit.current.h)
      rg.position.set(TU.riderX, hill(TU.riderX, TU.riderZ), TU.riderZ)
      rg.rotation.set(0, TU.riderYaw * D2R, 0)
    }
    /* มือถือ: มือขวา (PointElbow) / มือซ้าย (MugElbow) ตามแผง — เปลี่ยนมือ = ย้ายไปติดข้อมืออีกข้าง */
    const handName = TU.phoneHand > 0.5 ? 'MugElbow' : 'PointElbow'
    if (phone.current && phone.current.userData.hand !== handName) {
      if (grip.current) phone.current.remove(grip.current.root)
      phone.current.removeFromParent()
      phone.current.geometry.dispose()
      phone.current.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose())
      phone.current = null
    }
    if (inn && !phone.current) {
      let el: THREE.Object3D | null = null
      inn.traverse((ob) => {
        if (ob.name === handName) el = ob
      })
      const elbow = el as THREE.Object3D | null
      const wrist = elbow?.children.find((ch) => (ch as THREE.Group).isGroup || ch.type === 'Object3D') ?? elbow
      if (wrist) {
        /* ด้านจอ = กระจกดำแบบเครื่องในบท Code · ด้านอื่นสีเงิน (หลังเครื่องหันหาคนดูในมุมสุดท้าย) */
        const ph = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.44, 0.03), [res.phoneBody, res.phoneBody, res.phoneBody, res.phoneBody, res.phoneFront, res.phoneBody])
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(PHONE_SCR[0], PHONE_SCR[1]), res.phoneScreen)
        scr.position.z = 0.016
        ph.add(scr)
        /* กล้องหลังเครื่อง (ด้านที่หันหาคนดู): ฐานมนเข้ม + เลนส์สองตา — อ่านออกว่าเป็นมือถือจากด้านหลัง แบบภาพ ref */
        const bump = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.008), res.phoneBump)
        bump.position.set(-0.05, 0.135, -0.019)
        ph.add(bump)
        for (const ly of [0.16, 0.112]) {
          const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 20), res.phoneLens)
          lens.rotation.x = Math.PI / 2
          lens.position.set(-0.05, ly, -0.024)
          ph.add(lens)
        }
        ph.traverse((o) => (o.renderOrder = 11))
        ph.userData.dispose = true
        ph.userData.hand = handName
        let hg: THREE.Object3D | null = null
        inn.traverse((ob) => {
          if (ob.name === 'HeadGroup') hg = ob
        })
        ph.userData.head = hg
        /* อยู่ในพิกัดโลก (ไม่ติดลูกข้อมือ) — ตำแหน่งตามกลางมือ ทิศตั้งเอง (หันจอเข้าหน้า) ดูข้างล่าง */
        phoneRoot.current?.add(ph)
        phone.current = ph
      }
    }
    /* มือซ้ายล้วงกระเป๋า: ซ่อนมือ (ข้อมือทั้งกิ่งของแขนซ้าย) ให้ปลายแขนจมเข้ากระเป๋ากางเกง แบบภาพ ref */
    if (inn && !pocketHand.current) {
      inn.traverse((ob) => {
        if (ob.name === 'MugElbow') pocketHand.current = ob.children.find((ch) => (ch as THREE.Group).isGroup) ?? null
        if (ob.name === 'PointElbow') elbow.current = ob
        if (ob.name === 'PointShoulder') {
          shoulder.current = ob
          forearm.current = (ob.children.find((c) => (c as THREE.Mesh).isMesh && c.userData.noMerge && c.userData.base) as THREE.Mesh | undefined) ?? null
        }
      })
    }
    if (pocketHand.current) pocketHand.current.visible = TU.pocket < 0.5
    /* หัวใหญ่ขึ้นแบบภาพ ref (สัดส่วนริกหัวเล็กกว่า) — ย่อ/ขยายกลุ่มหัวรอบจุดหมุนคอ */
    const hg = phone.current?.userData.head as THREE.Object3D | undefined
    if (hg) hg.scale.setScalar(TU.headS)
    const ph = phone.current
    if (ph) {
      /*
       * มือถือในพิกัดโลก: ตำแหน่ง = หัว + ระยะจากแผง (เมตร ตามทิศตัวละคร) — ไม่ผูกมือของริก (ซ่อนอยู่ มือ 3D แบบ Frame 1 ถือแทน)
       * จัดแขนได้อิสระโดยมือถือไม่ขยับ แขนท่อนล่างต่อจากฝ่ามือถึงศอกเอง (ดูข้างล่าง)
       * ทิศ = จอ (+z ของเครื่อง) หันเข้าหาหัวตัวละคร ตั้งตรงตามแกนโลก → หลังเครื่องสีเงิน + กล้องหลังหันออกหาคนดู (แบบภาพ ref)
       * มุมจากแผง (phoneRX/RY/RZ) = เอียงเพิ่มจากท่านั้น — ไม่ต้องเดาแกนของข้อมือ
       */
      ph.visible = TU.phoneShow > 0.5
      const hd = ph.userData.head as THREE.Object3D | null
      if (hd) hd.getWorldPosition(HEAD_P)
      else HEAD_P.set(TU.riderX, TU.riderH, TU.riderZ)
      const reach = PHONE_REACH[0] * (1 - smooth((e - PHONE_REACH[1]) / PHONE_REACH[2]))
      ph.position.copy(HEAD_P).add(HAND_C.set(TU.headPhoneX, TU.headPhoneY, TU.headPhoneZ + reach).applyAxisAngle(WORLD_UP, TU.riderYaw * D2R))
      ph.lookAt(HEAD_P)
      ph.rotateX(TU.phoneRX * D2R)
      ph.rotateY(TU.phoneRY * D2R)
      ph.rotateZ(TU.phoneRZ * D2R)
      ph.scale.setScalar(TU.phoneS)
      /*
       * แคนวาสกลับซ้าย-ขวาด้วย CSS — มือ 3D กับภาพบนจอต้องกลับในพิกัดมือถือด้วย ไม่งั้นบนจอนิ้วไปอยู่ขวา โป้งอยู่ซ้าย
       * และ UI กลับด้าน (ต่างจากเครื่องในบท Code ที่มือ 2D จับอยู่) · สเกลลบ: three สลับด้านหน้าของผิวให้เอง
       */
      const sx = TU.mirror > 0.5 ? -1 : 1
      /* มือโวเซล (./voxelHand) ติดมือถือ — ท่า/ตำแหน่งชุดเดียวกับมือ 2D ใน HoldHand (กำเต็ม) */
      const gh = grip.current
      if (gh) {
        if (gh.root.parent !== ph) ph.add(gh.root)
        poseGripHand(gh, TU, 1, sx)
      }
      if (res.phoneTex.repeat.x !== sx) {
        res.phoneTex.repeat.x = sx
        res.phoneTex.offset.x = sx < 0 ? 1 : 0
      }
      /*
       * มือถือถือด้วยมือ 3D แบบ Frame 1 (ติดมือถือ) — ซ่อนมือของริก (กิ่ง PointElbow = กำปั้น)
       * แขนริกเป็นท่อนตรงท่อนเดียว (ไหล่ → แขนเสื้อ → กล่องท่อนแขน เป็นลูกของ PointShoulder): หมุนไหล่ให้แกนแขนชี้เข้ากลางฝ่ามือ
       * แล้วยืด/หดเฉพาะกล่องท่อนแขนตามแกนให้ปลายจมในฝ่ามือพอดี — แขนชุดเดียวกับ hero (หน้าตัด สี แขนเสื้อ) ไม่มีแท่งต่อเพิ่ม
       * ทำหลัง Mascot จัดท่า (useFrame ของลูกวิ่งก่อน) — ทับเฉพาะเฟรมนี้ เฟรมหน้า Mascot ตั้งใหม่ก่อนเสมอ
       */
      const el = elbow.current
      const sh = shoulder.current
      const fa = forearm.current
      const own = !!el && !!sh && !!fa && !!gh && TU.phoneHand < 0.5 && ph.visible
      /* ตอนม่านยังมืด (มุมมองจอมือถือ) แขนริกพาดผ่านหน้าจอเป็นเงาดำ — ซ่อนไว้ โผล่เมื่อฉากสว่างพอและกล้องอ้อมออกแล้ว */
      if (sh) sh.visible = cur < 0.35
      if (el) el.visible = !own
      if (fa && !own) fa.scale.y = 1
      if (own && sh && fa && gh && sh.parent) {
        gh.root.updateWorldMatrix(true, true)
        gh.wrist.getWorldPosition(PALM_W)
        sh.updateWorldMatrix(true, false)
        sh.getWorldPosition(SH_P)
        sh.getWorldQuaternion(SH_Q)
        ARM_AX.set(0, 1, 0).applyQuaternion(fa.quaternion)
        ARM_W.copy(ARM_AX).applyQuaternion(SH_Q)
        const dist = PALM_W.distanceTo(SH_P)
        DQ.setFromUnitVectors(ARM_W, PALM_W.sub(SH_P).divideScalar(Math.max(dist, 1e-4)))
        sh.parent.getWorldQuaternion(PAR_Q)
        sh.quaternion.copy(PAR_Q.invert()).multiply(DQ.multiply(SH_Q))
        /* ยาวกล่องเดิม = ปลายแขนเสื้อ → ปลายแขน + เผื่อ 0.1 (สเปซไหล่) · ยืดให้ถึงกลางฝ่ามือ */
        const h = (fa.geometry as THREE.BoxGeometry).parameters.height
        const base = fa.userData.base as THREE.Vector3
        const cuff = base.dot(ARM_AX) - (h - 0.1) / 2 - 0.05
        const reachL = dist / sh.getWorldScale(SH_P).x
        const len = Math.max(0.05, reachL - cuff)
        fa.scale.y = len / h
        fa.position.copy(ARM_AX).multiplyScalar(cuff + len / 2)
      }
    }
  })
  useEffect(
    () => () => {
      const ph = phone.current
      if (ph) {
        if (grip.current) ph.remove(grip.current.root)
        ph.geometry.dispose()
        ph.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose())
        ph.removeFromParent()
      }
    },
    [],
  )

  return (
    <>
      <fog attach="fog" args={['#cfe6ff', 16, 75]} />
      {/* ไฟชุดเดียวกับ hero (แผงไฟนุ่ม + ฟ้า/พื้น + key/fill/rim + เงา) และ rim ตามเงาตัวจาก CameraFX — ตัวละครคุณภาพเดียวกับ hero */}
      <HeroLights skyTint="#5cb8ee" />
      <CameraFX
        rim={DEFAULTS.rimFx > 0.5 ? DEFAULTS.rimFxInt : 0}
        rimW={DEFAULTS.rimFxW}
        rimSoft={DEFAULTS.rimFxSoft}
        rimThresh={DEFAULTS.rimFxThresh}
        rimMix={DEFAULTS.rimFxMix}
        rimAngle={DEFAULTS.rimFxAngle}
        rimFall={DEFAULTS.rimFxFall}
        rimShade={DEFAULTS.rimFxShade}
        rimBack={DEFAULTS.rimFxBack}
        tone={1}
        rimK={rimK}
      />
      <mesh geometry={res.groundGeo} material={res.ground} renderOrder={-2} receiveShadow />
      <primitive object={res.blades} />
      <primitive object={res.trunks} />
      <primitive object={res.leaves} />
      <primitive object={res.clouds} />
      <mesh ref={curtain} geometry={res.curtainGeo} material={res.curtainMat} renderOrder={10} frustumCulled={false} />
      <group ref={phoneRoot} />
      <group ref={rider}>
        <group ref={inner}>
          <Suspense fallback={null}>
            <Rider noLean noBoard noWind noIdle armPose={armPose} legPose={legPose} torsoPose={torsoPose} followOverride={follow} />
          </Suspense>
        </group>
      </group>
    </>
  )
}
const D2R = Math.PI / 180

export function GrassStage({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const root = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLDivElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const hint = useRef<HTMLDivElement>(null)
  const cardEls = useRef<(HTMLElement | null)[]>([])
  const sky = useRef<HTMLDivElement>(null)
  const deco = useRef<SVGSVGElement>(null)
  const marks = useRef<SVGSVGElement>(null)
  const st = useRef<Shared>({ post: -9, pull: 0, out: 0, scroll: 0, start: { cx: 0, cy: 0, hh: 0, ok: false } })
  const kick = useRef<(() => void) | null>(null)
  const [mirror, setMirror] = useState(GRASS_TUNE.mirror > 0.5)
  /* แผงจูนโผล่เฉพาะตอนฉากเปิด (สลับ state เฉพาะตอนเปิด/ปิด ไม่ใช่ทุกเฟรม) */
  const [live, setLive] = useState(false)
  useEffect(() => {
    const f = () => setMirror(GRASS_TUNE.mirror > 0.5)
    tuneBus.subs.add(f)
    return () => {
      tuneBus.subs.delete(f)
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let shown = false
    let sm = -9
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = root.current
      const f = frame.current
      if (!el || !f) return
      const raw = worksPost(f.b)
      sm = Math.abs(raw - sm) > 0.4 ? raw : sm + (raw - sm) * 0.12
      const q = smooth((sm - GRASS_OUT[0]) / GRASS_OUT[1])
      /* กรอบจอเครื่อง (devScreen) จดไว้ทุกเฟรมจนถึงจังหวะตัด แล้วค้างค่าสุดท้าย — เฟรมแรกของฉากนี้วางมือถือทับกรอบนี้ */
      const sd = st.current.start
      if (f.on && f.b.code <= CUT[0] && devScreen.ok) {
        sd.cx = devScreen.cx
        sd.cy = devScreen.cy
        sd.hh = devScreen.hh
        sd.ok = true
      }
      const on = f.on && f.b.code > CUT[0] && q < 1
      if (!on) {
        if (shown) {
          el.style.visibility = 'hidden'
          shown = false
          setLive(false)
          grassPhone.ok = false
        }
        return
      }
      if (!shown) {
        el.style.visibility = 'visible'
        shown = true
        setLive(true)
      }
      /*
       * ตัดตรง (ไม่จางซ้อน): บท Code หรี่ดำรอบเครื่องจนเหลือแค่เครื่อง + มือแล้ว (WorkStory) — เฟรมแรกของฉากนี้คือม่านดำ + มือถือทับกรอบเดิม
       * ภาพก่อน/หลังตัดเหมือนกัน คนดูไม่เห็นรอยตัด
       */
      el.style.opacity = (1 - smooth((q - 0.45) / 0.55)).toFixed(3)
      const s = st.current
      s.post = sm
      /* หน้าประชิด = ช่วงจอขยาย · ถอยกวาดรอบตัว = ต้น Selected Work (GRASS_PULL) */
      s.pull = smooth((sm - GRASS_PULL[0]) / GRASS_PULL[1])
      s.out = q
      s.scroll = smooth((sm - GRASS_SCROLL[0]) / (GRASS_SCROLL[1] - GRASS_SCROLL[0]))
      const tt = title.current
      const ti = smooth((s.pull - 0.7) / 0.3) * (1 - smooth(q / 0.4))
      if (tt) {
        tt.style.opacity = ti.toFixed(3)
        tt.style.transform = `translateY(${((1 - ti) * 24).toFixed(1)}px)`
      }
      /* การ์ดขึ้นทีละใบ · ไหลซ้ายตามการไถ (ระยะเลื่อนสุด = แถวเลยกรอบ) */
      cardEls.current.forEach((c, i) => {
        if (!c) return
        const ci = smooth((s.pull - 0.78 - i * 0.04) / 0.2) * (1 - smooth(q / 0.4))
        c.style.opacity = ci.toFixed(3)
        c.style.transform = `translateY(${((1 - ci) * 30).toFixed(1)}px)`
      })
      const rw = row.current
      if (rw && rw.parentElement) {
        const over = Math.max(0, rw.scrollWidth - rw.parentElement.clientWidth * 0.82)
        rw.style.transform = `translate3d(${(-s.scroll * over).toFixed(1)}px, 0, 0)`
      }
      /* เส้นโค้งลมบนฟ้า + ขีดตกใจข้างหัว — โผล่ตอนกล้องลงถึงมุมเสย (ภาพนิ่งตรง ref) */
      const dk = smooth((s.pull - 0.86) / 0.14) * (1 - smooth(q / 0.3))
      if (deco.current) deco.current.style.opacity = dk.toFixed(3)
      const mk = marks.current
      if (mk) {
        mk.style.opacity = grassPhone.ok ? dk.toFixed(3) : '0'
        if (grassPhone.ok && dk > 0) {
          /* กลางกล่องขีด อยู่ซ้ายบนของปลายมือถือ (ref: −0.28, −0.74 × ครึ่งสูงจอ) · เด้งขยายตอนท้าย */
          const k = (grassPhone.hh / 65) * (0.6 + 0.4 * smooth((s.pull - 0.92) / 0.08))
          const x = grassPhone.tx - 0.28 * grassPhone.hh - 30
          const y = grassPhone.ty - 0.74 * grassPhone.hh - 35
          mk.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${k.toFixed(3)})`
        }
      }
      if (hint.current) hint.current.style.opacity = (ti * (1 - smooth(s.scroll / 0.15))).toFixed(3)
      kick.current?.()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame])

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[53]" style={{ visibility: 'hidden' }} aria-label="Selected Work">
      {/* ฟ้าพาสเทลของฉากเอง (แบบภาพ ref) — คลุมตลอดฉาก (ข้างหลังเป็นฉากมืดของบท Code ตอนเปิด และ FallSky ตอนค้าง) · ทั้งชั้นจางตอนออก */}
      <div ref={sky} className="absolute inset-0 bg-[linear-gradient(180deg,#3d8cef_0%,#78b4f7_42%,#cfe6ff_100%)]" />
      {/*
        แคนวาสกลับซ้าย-ขวาด้วย CSS (กระจกทั้งภาพ ไม่บิดตัวละคร): ท่า hero ชี้ไปทางขวา — พลิกแล้วชี้ซ้ายไปหาแถวงาน ยืนฝั่งขวาแบบภาพ ref
      */}
      <Canvas
        className={mirror ? '-scale-x-100' : undefined}
        frameloop="demand"
        dpr={[1, 1.5]}
        shadows
        camera={{ fov: 38, near: 0.05, far: 200, position: [0, CARD_Y, 7.2] }}
        gl={{
          antialias: false,
          alpha: true,
          stencil: true,
          toneMappingExposure: DEFAULTS.exposure,
        }}
        onCreated={({ gl }) => {
          /* ACES ทำใน CameraFX (แบบ hero) */
          gl.toneMapping = THREE.NoToneMapping
        }}
        style={{ pointerEvents: 'none' }}
      >
        <Kick kick={kick} />
        <Scene st={st} />
      </Canvas>
      {/*
        ลายเส้นบนจอแบบภาพ ref: เส้นโค้งลมสีขาว (ซ้ายบน · ขวากลาง · กลางล่างจาง) + ขีดตกใจสามเส้นข้างหัว
        พิกัดเดียวกับภาพ ref 1672×941 — กรอบสูงเต็มจอ กว้างตามสัดส่วน ตรงกลาง = ครอบภาพแบบเดียวกับกล้อง (FOV แนวตั้งคงที่)
      */}
      <svg
        ref={deco}
        className="absolute top-0 left-1/2 h-full -translate-x-1/2"
        style={{ aspectRatio: '1672 / 941', opacity: 0 }}
        viewBox="0 0 1672 941"
        fill="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="gs-sw1" gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="450" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gs-sw2" gradientUnits="userSpaceOnUse" x1="1435" y1="0" x2="1668" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0.8" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="gs-sw3" gradientUnits="userSpaceOnUse" x1="690" y1="0" x2="815" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M30 155 Q200 -105 450 115" stroke="url(#gs-sw1)" strokeWidth="5" strokeLinecap="round" />
        <path d="M1435 470 Q1520 350 1668 298" stroke="url(#gs-sw2)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M690 775 Q740 735 815 722" stroke="url(#gs-sw3)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {/*
        ขีดตกใจสามเส้น — ตามปลายบนของมือถือบนจอ (grassPhone.tx/ty) ไม่ตรึงพิกัดจอ: ย้ายตัวละคร/กล้องในแผงแล้วยังอยู่ข้างหัว
        พิกัดในกล่องเป็นหน่วย px ของภาพ ref (ครึ่งสูงจอมือถือใน ref ≈ 65) · ย่อ/ขยายตามขนาดมือถือบนจอ
      */}
      <svg ref={marks} className="absolute top-0 left-0 h-[70px] w-[60px] origin-center" viewBox="1070 150 60 70" fill="none" style={{ opacity: 0 }} aria-hidden>
        <g strokeLinecap="round">
          {(['M1105 160 L1117 186', 'M1080 184 L1103 196', 'M1083 211 L1103 209'] as const).map((d) => (
            <g key={d}>
              <path d={d} stroke="#1d2a4d" strokeWidth="10" />
              <path d={d} stroke="#fff" strokeWidth="5.5" />
            </g>
          ))}
        </g>
      </svg>
      {/* หัวข้อ + การ์ดกระจก (แบบภาพ ref) — การ์ดไหลซ้ายตามการไถจอของตัวละคร */}
      {SHOW_CONTENT && (
        <div ref={title} className="absolute top-[clamp(84px,13vh,140px)] left-[clamp(20px,9vw,160px)] w-[min(56vw,880px)] max-md:w-[calc(100vw-40px)]" style={{ fontFamily: STORY_FONT, opacity: 0 }}>
          <span className="mb-5 block h-[5px] w-[54px] rounded-full bg-[#7b5cff]" />
          <h2 className="text-[clamp(40px,5vw,88px)] leading-[1] font-bold tracking-[-0.03em] text-[#18203d]">
            Selected <span className="text-[#7a3ff0]">work</span>
          </h2>
          <p className="mt-5 max-w-[28ch] text-[clamp(15px,1.25vw,21px)] leading-[1.5] text-[#2f3a5c]/80">Explore some of my recent projects, where design meets real impact.</p>
          <div className="mt-[clamp(28px,5vh,60px)] overflow-hidden [mask-image:linear-gradient(90deg,#000_82%,transparent)]">
            <div ref={row} className="flex w-max gap-[clamp(10px,1vw,18px)] will-change-transform">
              {DECK_WORKS.map((w, i) => (
                <figure
                  key={w.name}
                  ref={(el) => {
                    cardEls.current[i] = el
                  }}
                  className="w-[clamp(170px,15.5vw,290px)] shrink-0 rounded-[22px] border border-white/60 bg-white/25 p-[9px] shadow-[0_18px_40px_rgba(30,70,160,0.18)] backdrop-blur-md"
                  style={{ opacity: 0 }}
                >
                  <div className="aspect-[1.08] overflow-hidden rounded-[15px] bg-white/30">
                    <img src={w.img} alt={w.name} className="size-full object-cover" loading="lazy" />
                  </div>
                  <figcaption className="truncate px-1 pt-2 pb-0.5 text-[clamp(12px,0.85vw,15px)] font-medium text-[#18203d]/85">{w.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* แผงจัดท่าตัวละคร/กล้อง — dev เท่านั้น (เห็นเฉพาะตอนฉากนี้เปิด) */}
      {import.meta.env.DEV && live && (
        <Suspense fallback={null}>
          <GrassTuner />
        </Suspense>
      )}
      {/* บอกให้เลื่อน (ซ้ายล่าง) */}
      {SHOW_CONTENT && (
        <div ref={hint} className="absolute bottom-[clamp(28px,6vh,64px)] left-[clamp(20px,9vw,160px)] flex items-center gap-3 text-[15px] text-white" style={{ fontFamily: STORY_FONT, opacity: 0 }}>
          <svg width="20" height="30" viewBox="0 0 20 30" fill="none" aria-hidden>
            <rect x="1" y="1" width="18" height="28" rx="9" stroke="currentColor" strokeWidth="1.6" />
            <rect x="9" y="7" width="2" height="6" rx="1" fill="currentColor" />
          </svg>
          Scroll to explore
        </div>
      )}
    </div>
  )
}

/** แคนวาส demand: ปลุกวาดทุกเฟรมที่ฉากเปิดอยู่ (หญ้าไหวตามลมตลอด) — rAF ของ GrassStage เรียก */
function Kick({ kick }: { kick: React.RefObject<(() => void) | null> }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    kick.current = invalidate
    return () => {
      kick.current = null
    }
  }, [kick, invalidate])
  return null
}
