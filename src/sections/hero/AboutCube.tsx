import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { aboutBox, aboutCubeBox } from './aboutBox'

/**
 * คำตอบของ "Here is what I do" — กล่องแก้วที่หมุนลอยออกมาจากฟองแชท (ภาพอ้างอิงกล่องแก้วปริซึม มีตรา J ข้างใน)
 *
 * เรื่อง (ค่าจาก aboutBox — ดู BEAT ใน skystory/beats):
 *  emerge  กล่องเล็กดันผิวฟองขึ้นมา (ส่วนที่ยังอยู่ใต้ขอบฟองถูกตัด) หมุนติ้วขึ้นไปลอยเหนือฟอง
 *  quad    กล่องขยายใหญ่ ลอยสูงขึ้น ชิ้นแก้ว 2×2×2 แยกห่างออกนิด ๆ ให้เห็นว่าประกอบจากหลายชิ้น
 *  page    ทีละสกิล: ชิ้นของสกิลนั้นยื่นออกมาเรืองสีของสกิล กล่องหมุนหันชิ้นนั้นเข้าหาจอ (ป้ายอยู่ใน AboutTags)
 *  back    ชิ้นประกอบคืน กล่องหดแล้วจมกลับเข้าฟอง
 *
 * แก้วแบบโปร่ง (ไม่ใช่ transmission): แคนวาสนี้โปร่งใส ฟ้ากับฟองอยู่คนละชั้น — transmission จะหักเหแต่ความว่าง
 * ความเป็นแก้วมาจากเงาสะท้อนแผงไฟ (Environment ของ HeroLights) iridescence และขอบสว่าง
 */
const PIECES = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1))
/** ชิ้นของแต่ละสกิล (Design Coding Research) — ชิ้นหน้าบนขวา หน้าบนซ้าย หน้าล่างขวา */
export const SKILL_PIECE = [7, 6, 5]
const SKILL_C = ['Design', 'Coding', 'Research'].map((t) => new THREE.Color(SKILLS.find((s) => s.title === t)?.color ?? '#ffffff'))
/** มุมหมุนของกล่องที่หันชิ้นของสกิลนั้นเข้าหาจอ */
const FACE = [
  new THREE.Euler(0.42, -0.62, 0),
  new THREE.Euler(0.42, 0.62, 0),
  new THREE.Euler(-0.32, -0.62, 0),
]
const IDLE = new THREE.Euler(0.42, -0.78, 0)

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
const QA = new THREE.Quaternion()
const QB = new THREE.Quaternion()
const QS = new THREE.Quaternion()
const YAX = new THREE.Vector3(0, 1, 0)

export function AboutCube({ clip }: { clip: THREE.Plane }) {
  const { size, gl } = useThree()
  const font = useLoader(FontLoader, '/fonts/momo-trust-sans.json')
  const root = useRef<THREE.Group>(null)
  const pieces = useRef<(THREE.Group | null)[]>([])
  const emblem = useRef<THREE.Mesh>(null)
  const glass = useMemo(
    () =>
      PIECES.map(
        () =>
          new THREE.MeshPhysicalMaterial({
            color: '#dce9ff',
            transparent: true,
            opacity: 0.36,
            roughness: 0.04,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.03,
            iridescence: 0.7,
            iridescenceIOR: 1.35,
            envMapIntensity: 2.2,
            emissive: '#ffffff',
            emissiveIntensity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
            clippingPlanes: [clip],
          }),
      ),
    [clip],
  )
  const emblemGeo = useMemo(() => {
    const g = new TextGeometry('J', { font, size: 1, depth: 0.34, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.045, bevelSegments: 5 })
    g.computeBoundingBox()
    const bb = g.boundingBox as THREE.Box3
    g.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2)
    return g
  }, [font])
  const emblemMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.1, clearcoat: 1, iridescence: 0.5, emissive: '#c9d6ff', emissiveIntensity: 0.45, clippingPlanes: [clip] }),
    [clip],
  )
  useEffect(
    () => () => {
      glass.forEach((m) => m.dispose())
      emblemGeo.dispose()
      emblemMat.dispose()
    },
    [glass, emblemGeo, emblemMat],
  )

  useFrame(({ clock }) => {
    const b = aboutBox
    const g = root.current
    if (!g) return
    gl.localClippingEnabled = true
    const W = size.width
    const H = size.height
    const t = clock.elapsedTime
    const em = b.emerge
    const grow = smooth(b.quad)
    const on = b.chat && em > 0.001
    g.visible = on
    aboutCubeBox.on = on ? 1 : 0
    if (!on) return

    /* ขนาด (px ของด้านกล่อง) และตำแหน่ง: ใต้ขอบฟอง → ลอยเหนือฟอง → ขยายลอยสูงกลางจอ */
    const top = b.by - b.bh * 0.32
    const side = lerp(H * 0.16, H * 0.3, grow)
    const rise = outBack(em)
    const cy = lerp(lerp(top + side * 0.7, top - side * 0.85, rise), H * 0.36, grow)
    const cx = b.bx
    g.position.set(cx - W / 2, H / 2 - cy, 0)
    /* ระนาบตัด = ขอบบนของฟอง — ยกเลิกเมื่อพ้นแล้ว (ย้ายลงไปไกล) */
    clip.constant = -(H / 2 - (em < 0.98 && grow < 0.01 ? top : H * 2))
    const sc = (side / 2) * lerp(0.6, 1, smooth(em / 0.7))
    g.scale.setScalar(sc)
    aboutCubeBox.x = cx
    aboutCubeBox.y = cy
    aboutCubeBox.size = side

    /* หมุน: ติ้วสองรอบตอนลอยออก → เอียงโชว์มุม → หันชิ้นของสกิลที่เล่า */
    const page = b.page
    const story = smooth((grow - 0.85) / 0.15)
    const wp = [0, 1, 2].map((i) => clamp01(1 - Math.abs(page - i) * 1.6) * story)
    QA.setFromEuler(IDLE)
    for (let i = 0; i < 3; i += 1) if (wp[i] > 0) QA.slerp(QB.setFromEuler(FACE[i]), wp[i])
    QS.setFromAxisAngle(YAX, (1 - smooth(em)) * Math.PI * 4 + Math.sin(t * 0.5) * 0.08 * (1 - story * 0.6))
    g.quaternion.copy(QS).multiply(QA)

    /* ชิ้นแก้ว: ประกอบแน่น → แยกห่างนิดตอนขยาย → ชิ้นของสกิลยื่นออก + เรืองสี */
    const gap = 0.52 + 0.12 * grow
    pieces.current.forEach((p, i) => {
      if (!p) return
      const d = PIECES[i]
      const si = SKILL_PIECE.indexOf(i)
      const out = si >= 0 ? wp[si] : 0
      p.position.copy(d).multiplyScalar(gap + 0.45 * outBack(out))
      p.rotation.set(0, 0, Math.sin(t * 1.3 + i) * 0.04 * out)
      const m = glass[i]
      if (si >= 0) {
        m.emissive.copy(SKILL_C[si])
        m.emissiveIntensity = out * 0.55
        m.opacity = 0.36 + out * 0.32
      }
    })
    const e = emblem.current
    if (e) {
      e.rotation.y = Math.sin(t * 0.7) * 0.2
      e.scale.setScalar(0.95 * (1 - story * 0.15))
    }
  })

  return (
    <group ref={root} visible={false}>
      {PIECES.map((_, i) => (
        <group
          key={i}
          ref={(p) => {
            pieces.current[i] = p
          }}
        >
          <RoundedBox args={[1, 1, 1]} radius={0.08} smoothness={4} material={glass[i]} renderOrder={2} />
        </group>
      ))}
      <mesh ref={emblem} geometry={emblemGeo} material={emblemMat} renderOrder={1} />
    </group>
  )
}
