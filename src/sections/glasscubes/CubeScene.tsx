import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox } from '@react-three/drei'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { CHAPTERS, liftOf } from './chapters'

/**
 * ฉากกล่องแก้วปริซึม (ภาพอ้างอิง: พื้นกรมท่า ลำแสงม่วงซ้าย-ส้มขวาบรรจบหลังกล่องแก้วใหญ่ ข้างในมีตราสัญลักษณ์
 * แผ่นแก้วรูปฟองแชทลอยข้าง สามเหลี่ยมเล่นแก้วด้านหน้า)
 *
 * กล่องใหญ่ = กล่องแก้วเล็ก 2×2×2 แยกชิ้นได้ — เรื่องเริ่มจากชิ้นลอยกระจัด แล้วประกอบเป็นกล่องเดียว
 * บทของแต่ละสกิล: ลำแสงเปลี่ยนเป็นสีของสกิลนั้น กล่องหมุนหันหน้าใหม่ ชิ้นหนึ่งยื่นออกมา
 * ลำแสงเป็นฉาก 3D (ไม่ใช่ CSS) เพราะแก้วต้องหักเหสิ่งที่อยู่หลังมันได้
 */
export const cubeStory = { p: 0, s: 0 }

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const rnd = (i: number, k = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

const COLOR_OF = (t: string, fb: string) => new THREE.Color(SKILLS.find((s) => s.title === t)?.color ?? fb)
/** สีลำแสงต่อบท: ปกติ ม่วง(ซ้าย)/ส้ม(ขวา) แบบภาพอ้างอิง · บทสกิล = สีของสกิลนั้นทั้งสองฝั่ง ไล่ไปขาวด้านใน */
const BASE_L = new THREE.Color('#6a3cff')
const BASE_R = new THREE.Color('#ff9a2e')
const SKILL_C = [COLOR_OF('Design', '#fd5000'), COLOR_OF('Coding', '#ad85fe'), COLOR_OF('Research', '#158ffc')]

/* ---------------- ลำแสงหลังฉาก ---------------- */

function Beams() {
  const { viewport } = useThree()
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uL: { value: BASE_L.clone() },
          uR: { value: BASE_R.clone() },
          uOpen: { value: 0 },
          uAsp: { value: 1 },
          uT: { value: 0 },
        },
        depthWrite: false,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          uniform vec3 uL; uniform vec3 uR; uniform float uOpen; uniform float uAsp; uniform float uT;
          varying vec2 vUv;
          /* ลำแสงรูปลิ่มจากจุดกลาง (หลังกล่อง) ออกไปทางซ้าย/ขวา — ขอบนุ่ม เข้มขึ้นใกล้แกนลำ */
          float wedge(vec2 p, float dir, float spread) {
            float x = p.x * dir;
            if (x < 0.0) return 0.0;
            float a = atan(abs(p.y), x);
            float edge = 1.0 - smoothstep(spread * 0.55, spread, a);
            return edge * smoothstep(0.0, 0.25, x);
          }
          void main(){
            vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0);
            p -= vec2(0.08, 0.02);
            vec3 navy = vec3(0.004, 0.005, 0.03);
            float sp = mix(0.04, 0.34, uOpen);
            float l = wedge(p, -1.0, sp);
            float r = wedge(p, 1.0, sp * 0.9);
            /* ลำทแยงอ่อน ๆ เพิ่มมิติ (ในภาพมีลำซ้อนสองชั้น) */
            float l2 = wedge(vec2(p.x, p.y - p.x * 0.35), -1.0, sp * 0.45) * 0.6;
            float r2 = wedge(vec2(p.x, p.y + p.x * 0.3), 1.0, sp * 0.4) * 0.6;
            vec3 c = navy;
            vec3 lc = mix(uL, vec3(0.55, 0.75, 1.0), smoothstep(0.6, 0.0, length(p)) * 0.6);
            vec3 rc = mix(uR, vec3(1.0, 0.92, 0.55), smoothstep(0.6, 0.0, length(p)) * 0.5);
            c += lc * (l + l2) * 1.1;
            c += rc * (r + r2) * 1.1;
            /* แกนสว่างตรงกลางหลังกล่อง */
            c += vec3(0.6, 0.65, 1.0) * smoothstep(0.25, 0.0, length(p)) * 0.18 * uOpen;
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ clock }, dt) => {
    const s = cubeStory.s
    const u = mat.uniforms
    u.uOpen.value = smooth((s - 0.05) / 0.25)
    u.uAsp.value = viewport.aspect
    u.uT.value = clock.elapsedTime
    /* สีตามบทสกิล — ไล่นุ่มด้วยการหน่วง */
    let tl = BASE_L
    let tr = BASE_R
    const ch = CHAPTERS.find((c) => c.skill >= 0 && liftOf(s, c.skill) > 0.5)
    if (ch) {
      tl = SKILL_C[ch.skill]
      tr = SKILL_C[ch.skill].clone().lerp(new THREE.Color('#ffffff'), 0.35)
    }
    ;(u.uL.value as THREE.Color).lerp(tl, 1 - Math.exp(-dt * 3))
    ;(u.uR.value as THREE.Color).lerp(tr, 1 - Math.exp(-dt * 3))
  })
  /* ระนาบใหญ่ไกลหลังฉาก เต็มจอเสมอ */
  return (
    <mesh position={[0, 0, -12]} scale={[60, 34, 1]} material={mat} renderOrder={-10}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}

/* ---------------- กล่องแก้ว ---------------- */

const PIECES = Array.from({ length: 8 }, (_, i) => ({
  home: new THREE.Vector3((i & 1 ? 1 : -1) * 0.52, (i & 2 ? 1 : -1) * 0.52, (i & 4 ? 1 : -1) * 0.52),
  far: new THREE.Vector3((rnd(i, 1) - 0.5) * 9, (rnd(i, 2) - 0.5) * 5, (rnd(i, 3) - 0.5) * 4 - 1),
  spin: new THREE.Euler(rnd(i, 4) * 6, rnd(i, 5) * 6, rnd(i, 6) * 6),
}))
/** ชิ้นที่ยื่นออกมาในบทของแต่ละสกิล (ดัชนีใน PIECES) */
const SKILL_PIECE = [7, 3, 5]

function GlassCube() {
  const font = useLoader(FontLoader, '/fonts/momo-trust-sans.json')
  const group = useRef<THREE.Group>(null)
  const pieces = useRef<(THREE.Group | null)[]>([])
  const emblem = useRef<THREE.Mesh>(null)
  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        /* แก้วใส: เห็นลำแสงกับตราข้างในผ่านเนื้อแก้ว — ขอบรับสีจากแผงไฟ (ม่วง/ส้ม) */
        color: '#ffffff',
        transmission: 1,
        thickness: 0.7,
        roughness: 0.03,
        ior: 1.5,
        iridescence: 0.3,
        iridescenceIOR: 1.3,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        attenuationColor: new THREE.Color('#c9d2ff'),
        attenuationDistance: 9,
        envMapIntensity: 0.7,
      }),
    [],
  )
  /* ตราข้างใน: ตัว J (โจ) นูนหนา ผิวขาวเงา ขอบฟ้า — ลอยกลางกล่อง */
  const emblemGeo = useMemo(() => {
    const g = new TextGeometry('J', { font, size: 1, depth: 0.32, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.045, bevelSegments: 5 })
    g.computeBoundingBox()
    const b = g.boundingBox as THREE.Box3
    g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2)
    return g
  }, [font])
  const emblemMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.1, clearcoat: 1, iridescence: 0.5, emissive: '#9db6ff', emissiveIntensity: 0.6 }), [])
  useEffect(
    () => () => {
      glass.dispose()
      emblemGeo.dispose()
      emblemMat.dispose()
    },
    [glass, emblemGeo, emblemMat],
  )

  useFrame(({ clock }) => {
    const s = cubeStory.s
    const t = clock.elapsedTime
    /* ประกอบ: ชิ้นลอยกระจัด → บินเข้าที่ (ทีละชิ้น เหลื่อมกัน) */
    const asm = smooth((s - 0.12) / 0.22)
    pieces.current.forEach((g, i) => {
      if (!g) return
      const pc = PIECES[i]
      const k = smooth((asm - i * 0.06) / 0.58)
      g.position.lerpVectors(pc.far, pc.home, k)
      g.position.y += Math.sin(t * 0.8 + i) * 0.12 * (1 - k)
      g.rotation.set(pc.spin.x * (1 - k) + t * 0.2 * (1 - k), pc.spin.y * (1 - k), pc.spin.z * (1 - k))
      /* ชิ้นของสกิลที่กำลังเล่ายื่นออกมาตามทิศของมันจากกลางกล่อง */
      const si = SKILL_PIECE.indexOf(i)
      if (si >= 0) {
        const lift = smooth(liftOf(s, si))
        g.position.addScaledVector(pc.home, lift * 0.75)
      }
    })
    const gr = group.current
    if (gr) {
      /* หมุนหาหน้าใหม่ทีละบท + ลอยหายใจ */
      const spinY = lerp(-0.6, 0.4, smooth((s - 0.1) / 0.3)) + smooth((s - 0.36) / 0.5) * Math.PI * 1.5
      gr.rotation.set(0.38 + Math.sin(t * 0.5) * 0.04, spinY + Math.sin(t * 0.3) * 0.05, -0.12)
      gr.position.y = Math.sin(t * 0.7) * 0.06
      const sc = lerp(0.7, 0.88, asm)
      gr.scale.setScalar(sc)
    }
    const em = emblem.current
    if (em) {
      const k = smooth((s - 0.26) / 0.1)
      em.scale.setScalar(Math.max(1e-3, k * 1.35))
      em.rotation.y = -(gr?.rotation.y ?? 0) * 0.35
    }
  })

  return (
    <group ref={group} position={[1.7, 0.1, 0]}>
      {PIECES.map((_, i) => (
        <group
          key={i}
          ref={(g) => {
            pieces.current[i] = g
          }}
        >
          <RoundedBox args={[1, 1, 1]} radius={0.06} smoothness={4} material={glass} />
        </group>
      ))}
      <mesh ref={emblem} geometry={emblemGeo} material={emblemMat} />
    </group>
  )
}

/* ---------------- แผ่นแก้วรอบกล่อง ---------------- */

function Panels() {
  const g1 = useRef<THREE.Group>(null)
  const g2 = useRef<THREE.Group>(null)
  const tri = useRef<THREE.Mesh>(null)
  const glass = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, thickness: 0.4, roughness: 0.18, ior: 1.4, clearcoat: 1, iridescence: 0.3 }),
    [],
  )
  const white = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), [])
  /* สามเหลี่ยม "เล่น" มุมมน หนา */
  const triGeo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.5, -0.6)
    s.lineTo(0.62, 0)
    s.lineTo(-0.5, 0.6)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 6, curveSegments: 4 })
    g.translate(0, 0, -0.09)
    return g
  }, [])
  const arrow = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.lineTo(0.09, -0.035)
    s.lineTo(0.03, -0.045)
    s.lineTo(0.01, -0.1)
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [])
  useEffect(
    () => () => {
      glass.dispose()
      white.dispose()
      triGeo.dispose()
      arrow.dispose()
    },
    [glass, white, triGeo, arrow],
  )
  useFrame(({ clock }) => {
    const s = cubeStory.s
    const t = clock.elapsedTime
    const k = smooth((s - 0.28) / 0.12)
    if (g1.current) {
      g1.current.position.set(2.75 + (1 - k) * 1.5, 1.05 + Math.sin(t * 0.9) * 0.05, 0.9)
      g1.current.scale.setScalar(Math.max(1e-3, k))
    }
    if (g2.current) {
      g2.current.position.set(2.95 + (1 - k) * 1.8, 0.45 + Math.sin(t * 0.8 + 1) * 0.05, 0.7)
      g2.current.scale.setScalar(Math.max(1e-3, smooth((s - 0.32) / 0.12)))
    }
    if (tri.current) {
      const kt = smooth((s - 0.2) / 0.15)
      tri.current.position.set(1.0, -1.75 + (1 - kt) * -1.2 + Math.sin(t * 0.6) * 0.04, 2.2)
      tri.current.rotation.set(-0.1, 0.25 + Math.sin(t * 0.4) * 0.05, 0)
      tri.current.scale.setScalar(Math.max(1e-3, kt * 0.7))
    }
  })
  return (
    <>
      {/* ฟองแชทแก้วสองแผ่น (ภาพอ้างอิง) — มีลูกศรเมาส์ขาวที่มุม */}
      <group ref={g1} rotation={[0.05, -0.35, 0]}>
        <RoundedBox args={[0.95, 0.36, 0.06]} radius={0.03} smoothness={3} material={glass} />
        <mesh geometry={arrow} material={white} position={[0.28, 0.02, 0.04]} />
      </group>
      <group ref={g2} rotation={[0.05, -0.35, 0]}>
        <RoundedBox args={[0.75, 0.3, 0.06]} radius={0.03} smoothness={3} material={glass} />
      </group>
      <mesh ref={tri} geometry={triGeo} material={glass} />
    </>
  )
}

/** เศษแก้วลอยเล็ก ๆ — เพิ่มความลึก */
function Shards() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const N = 14
  const data = useMemo(
    () => Array.from({ length: N }, (_, i) => ({ x: -6 + rnd(i, 7) * 12, y: -3 + rnd(i, 8) * 6, z: -4 + rnd(i, 9) * 4, s: 0.08 + rnd(i, 10) * 0.18, ph: rnd(i, 11) * 6 })),
    [],
  )
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#c9d4ff', roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.55, iridescence: 0.6 }), [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m) return
    const t = clock.elapsedTime
    data.forEach((d, i) => {
      o.position.set(d.x, d.y + Math.sin(t * 0.5 + d.ph) * 0.2, d.z)
      o.rotation.set(t * 0.2 + d.ph, t * 0.3 + d.ph, 0)
      o.scale.setScalar(d.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
}

function Rig() {
  const { camera } = useThree()
  useFrame((state, dt) => {
    cubeStory.s += (cubeStory.p - cubeStory.s) * (1 - Math.exp(-dt * 3.4))
    const s = cubeStory.s
    const t = state.clock.elapsedTime
    /* ถอยออกนิดตอนเริ่ม (เห็นชิ้นกระจัด) แล้วเข้าใกล้กล่องตอนเล่าสกิล · เมาส์เอียงกล้องนิดหนึ่ง */
    const z = lerp(13, 10.6, smooth((s - 0.1) / 0.3))
    camera.position.set(state.pointer.x * 0.35 + Math.sin(t * 0.2) * 0.1, 0.4 + state.pointer.y * 0.25, z)
    camera.lookAt(0.9, 0, 0)
  })
  return null
}

export function CubeScene() {
  return (
    <>
      <Rig />
      <Beams />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-5, 3, 4]} intensity={1.6} color="#a98bff" />
      <directionalLight position={[6, 2, 3]} intensity={1.6} color="#ffb067" />
      {/* แผงไฟสีให้แก้วสะท้อน — ม่วงซ้าย ส้มขวา ขาวบน (เข้าชุดกับลำแสง) */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={3} color="#7b5cff" position={[-6, 0, 2]} rotation-y={Math.PI / 2} scale={[10, 8, 1]} />
        <Lightformer intensity={3} color="#ffa040" position={[6, 0, 2]} rotation-y={-Math.PI / 2} scale={[10, 8, 1]} />
        <Lightformer intensity={2} color="#ffffff" position={[0, 6, 3]} rotation-x={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer intensity={1.2} color="#4fa0ff" position={[0, -3, 5]} scale={[10, 2, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <GlassCube />
      </Suspense>
      <Panels />
      <Shards />
    </>
  )
}
