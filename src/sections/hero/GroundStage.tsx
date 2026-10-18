import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clamp01, groundMat, type WorkBeats } from './workMotion'

/**
 * บท ground (Research) — พื้นกระเบื้องแบบ eddie.eco: ผืนเทาอ่อนแบ่งเป็นช่องสี่เหลี่ยมมุมมน ร่องระหว่างช่องมืดนิด
 * ขอบร่องรับแสงฝั่งเดียว หมุดแผนที่สีเขียวมะนาวปักตามช่องรอบ ๆ ฟองที่นั่งอยู่กลางพื้น
 *
 * พื้นอยู่ระนาบเดียวกับหน้าฟองที่หงาย ใต้ผิวล่างของฟองพอดี (groundMat — ฟองเขียนทุกเฟรม) จึงเห็นเป็นฟองวางบนพื้น
 * วาดในแคนวาสเพอร์สเปกทีฟ *ใต้* แคนวาสของฟอง (./WorkStory) ฟองจึงบังพื้นเองโดยไม่ต้องคิดลำดับ
 *
 * จังหวะ (ระยะเลื่อนของบท): พื้นเลื่อนขึ้นมารับ → หมุดเด้งทีละอัน → ค้าง → หมุดหด พื้นลดลงหาย (เครื่องตามมาต่อ)
 * หน่วยท้องถิ่น = หน่วยของฟอง · กระเบื้องกว้างราวหนึ่งฟอง (ช่องใหญ่แบบภาพอ้างอิง)
 */

const soft = (x: number) => {
  const t = clamp01(x)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function floorMat() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSize: { value: 4000 },
      uTile: { value: 130 },
      uPad: { value: new THREE.Vector2(150, 40) },
      uA: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uSize;
      varying vec2 vP;
      void main() {
        vP = position.xy * uSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(vP, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uSize;
      uniform float uTile;
      uniform vec2 uPad;
      uniform float uA;
      varying vec2 vP;
      float box(vec2 p, vec2 h, float r) {
        vec2 q = abs(p) - (h - r);
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }
      void main() {
        /* ช่องกระเบื้อง: สี่เหลี่ยมมุมมนในแต่ละเซลล์ ร่อง = นอกช่อง */
        vec2 c = (fract(vP / uTile + 0.5) - 0.5) * uTile;
        float gap = uTile * 0.012;
        float d = box(c, vec2(uTile * 0.5 - gap), uTile * 0.09);
        float aa = fwidth(d) * 1.2;
        float groove = smoothstep(-aa, aa, d);
        /* ขอบร่องฝั่งรับแสง (บนซ้าย) สว่าง ฝั่งตรงข้ามเงา — ร่องอ่านเป็นร่องลึก ไม่ใช่เส้นวาด */
        float rim = smoothstep(-gap * 3.0, -aa, d) * (1.0 - groove);
        vec2 dir = normalize(c + 1e-4);
        float lit = dot(dir, normalize(vec2(-0.6, 0.8)));
        vec3 base = vec3(0.89, 0.885, 0.905);
        vec3 col = base;
        col = mix(col, base * (lit > 0.0 ? 1.04 : 0.93), rim * abs(lit) * 0.8);
        col = mix(col, vec3(0.76, 0.75, 0.8), groove);
        /* เงานุ่มใต้ฟองที่นั่งกลางพื้น */
        vec2 sp = vP / uPad;
        col *= 1.0 - 0.16 * exp(-dot(sp, sp) * 1.6);
        /* จางเข้าฟ้าตามระยะจากกลาง */
        float r = length(vP) / (uSize * 0.5);
        float a = (1.0 - smoothstep(0.3, 0.9, r)) * uA;
        if (a < 0.003) discard;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  })
}

/** หมุดแผนที่: หยดน้ำตาคว่ำ (หัวกลม ปลายแหลมลง) ดันหนามน ตั้งบนพื้น หน้าหันหาคนดู · ฐาน (ปลายแหลม) ที่ 0 */
function pinGeo(r: number) {
  const s = new THREE.Shape()
  const a = 0.62
  const cy = r * 1.55
  s.moveTo(0, 0)
  s.lineTo(Math.cos(-Math.PI / 2 + a) * r, cy + Math.sin(-Math.PI / 2 + a) * r)
  s.absarc(0, cy, r, -Math.PI / 2 + a, (3 * Math.PI) / 2 - a, false)
  s.lineTo(0, 0)
  const depth = r * 0.5
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: r * 0.18, bevelSize: r * 0.16, bevelSegments: 5, curveSegments: 28 })
  g.translate(0, 0, -depth / 2)
  /* รูปอยู่ในระนาบ xy → ตั้งขึ้นจากพื้น (y ของรูป = แกนตั้งของพื้น z) หน้ารูปหัน −y ของพื้น = หาคนดู */
  g.rotateX(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/** ช่องที่ปักหมุด (หน่วยกระเบื้อง จากกลางพื้น) — รอบฟอง ไม่ทับฟอง */
const PINS: [number, number][] = [
  [-1.0, 0.5],
  [1.0, 0.7],
  [1.5, -0.5],
  [-1.5, -0.4],
  [0.5, -1.0],
  [-0.5, 1.3],
]

export function GroundStage({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const { size } = useThree()
  const kit = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1)
    const mat = floorMat()
    const pin = pinGeo(1)
    const pinMat = new THREE.MeshStandardMaterial({ color: '#a9b935', roughness: 0.6, metalness: 0 })
    return { geo, mat, pin, pinMat }
  }, [])
  useEffect(
    () => () => {
      kit.geo.dispose()
      kit.mat.dispose()
      kit.pin.dispose()
      kit.pinMat.dispose()
    },
    [kit],
  )
  const root = useRef<THREE.Group>(null)
  const pins = useRef<(THREE.Mesh | null)[]>([])
  const M = useMemo(() => new THREE.Matrix4(), [])
  const T = useMemo(() => new THREE.Matrix4(), [])

  useFrame(() => {
    const g = root.current
    const f = frame.current
    if (!g) return
    const G = f?.on ? f.b.ground : 0
    g.visible = G > 0 && G < 1 && groundMat.ok
    if (!g.visible) return
    const H = size.height
    const rise = soft(G / 0.2)
    const leave = soft((G - 0.84) / 0.16)
    /* ขึ้นจากล่างมารับใต้ฟอง · ลงกลับตอนจบบท (เครื่องเลื่อนขึ้นมาแทน) */
    const off = (1 - rise) + leave
    M.fromArray(groundMat.e)
    T.makeTranslation(0, -off * H * 0.85, -off * H * 0.3)
    g.matrix.copy(M).premultiply(T)
    g.matrixWorldNeedsUpdate = true
    const k = groundMat.k
    const tile = k * 1.05
    const u = kit.mat.uniforms
    u.uTile.value = tile
    u.uSize.value = tile * 7
    u.uPad.value.set(k * 0.55, k * 0.16)
    u.uA.value = soft(G / 0.12) * (1 - leave)
    pins.current.forEach((pm, i) => {
      if (!pm) return
      const pop = soft((G - 0.2 - i * 0.045) / 0.14) * (1 - soft((G - 0.78 - i * 0.01) / 0.08))
      pm.visible = pop > 0.01
      if (!pm.visible) return
      const [px, py] = PINS[i]
      pm.position.set(px * tile, py * tile, 0)
      pm.scale.setScalar(Math.max(1e-3, tile * 0.1 * pop))
    })
  })

  return (
    <group ref={root} matrixAutoUpdate={false} visible={false}>
      <mesh geometry={kit.geo} material={kit.mat} frustumCulled={false} renderOrder={0} />
      {PINS.map((_, i) => (
        <mesh
          key={i}
          geometry={kit.pin}
          material={kit.pinMat}
          renderOrder={1}
          visible={false}
          ref={(el) => {
            pins.current[i] = el
          }}
        />
      ))}
    </group>
  )
}
