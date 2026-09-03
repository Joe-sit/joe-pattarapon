import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { damp, useDisposable } from '@/joespresso/scene/utils'
import { OUTLINE_TAG, hideInBuffers } from './Switch'

/**
 * ลูกศรเมาส์แบบพิกเซล ปั้นเป็นก้อนสามมิติ — หน้าขาวนวล สันหนาสีดำ ขอบดำรอบเงา
 *
 * รูปร่างเป็นพหุเหลี่ยมในหน่วย "พิกเซล" (y ชี้ลงแบบบิตแมป) ด้านทแยงทุกด้านเป็นขั้นบันได
 * ทีละพิกเซล ไม่ใช่เส้นเฉียง — นั่นคือสิ่งที่ทำให้อ่านว่าเป็นเคอร์เซอร์ ไม่ใช่ลูกศรทั่วไป
 * ใช้ ExtrudeGeometry ไม่ใส่ bevel: ขอบต้องคมเป็นเหลี่ยมพิกเซล
 */

/** เดินขั้นบันไดจาก p ไป q — ก้าวละ (sx, sy) พิกเซล ลงแนวตั้งก่อนแล้วค่อยขยับแนวนอน */
function stairs(pts, from, to, sx, sy) {
  let [x, y] = from
  const n = Math.round(Math.abs(to[0] - from[0]) / Math.abs(sx))
  for (let i = 0; i < n; i += 1) {
    y += sy
    pts.push([x, y])
    x += sx
    pts.push([x, y])
  }
}

/**
 * เส้นรอบรูปของลูกศร ทวนเข็มในพิกัดบิตแมป — หัวลูกศรสมมาตรซ้ายขวารอบแกนตั้ง
 *
 * ปลายแหลมอยู่กลางบน สันสองข้างเป็นขั้นบันได 1:2 เหมือนกันทั้งคู่ (ไม่ใช่ข้างหนึ่งตรง
 * ข้างหนึ่งบันไดแบบเคอร์เซอร์ Windows) ก้นหัวเว้าเข้าหาหางเท่ากันสองฝั่ง หางตรงลงกลาง
 */
function arrowOutline() {
  const p = [[6, 0]]
  stairs(p, [6, 0], [0, 12], -1, 2) // สันซ้ายของหัว
  stairs(p, [0, 12], [4, 10], 2, -1) // ก้นหัวฝั่งซ้าย เว้าขึ้นไปหาโคนหาง
  p.push([4, 17], [8, 17], [8, 10]) // หางลงตรง ๆ แล้วกลับขึ้นโคนหางฝั่งขวา
  stairs(p, [8, 10], [12, 12], 2, 1) // ก้นหัวฝั่งขวา
  stairs(p, [12, 12], [6, 0], -1, -2) // สันขวาของหัว — กลับถึงปลายแหลม
  p.pop() // จุดสุดท้ายซ้ำจุดแรก
  return p
}

const PX = arrowOutline()
/** ขนาดบิตแมป — ใช้ย่อให้สูง 1 หน่วยฉาก */
const W = 12
const H = 17

function arrowGeometry(depth) {
  const sh = new THREE.Shape()
  PX.forEach(([x, y], i) => {
    const X = (x - W / 2) / H
    const Y = (H / 2 - y) / H
    if (i === 0) sh.moveTo(X, Y)
    else sh.lineTo(X, Y)
  })
  sh.closePath()
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false })
  g.translate(0, 0, -depth / 2)
  return g
}

const FACE = '#f7f1e6'
const SIDE = '#101019'

export function Cursor({
  /** ความหนา (เทียบความสูง 1) */
  depth = 0.3,
  /** ความหนาเส้นขอบดำรอบเงา — 0 = ไม่มี */
  outline = 0.03,
  faceColor = FACE,
  sideColor = SIDE,
  /** แรงกด 0..1 อ่านทุกเฟรม (clock) — ท่า "คลิก": ย่อลงแล้วดีดกลับ */
  pressAt = null,
  /** เล็งเมาส์: หมุนตัวลูกศรในระนาบของมันให้ปลายชี้ไปทางเมาส์ (0 = ปิด, 1 = เต็ม) มุมสูงสุด (เรเดียน) และหน่วง */
  aim = 0,
  aimMax = 1,
  aimEase = 0.08,
  ...props
}) {
  const geo = useMemo(() => arrowGeometry(depth), [depth])
  useDisposable(geo)
  /** เปลือกขอบขยายเป็นระยะคงที่ต่อแกน (ทรงสูง 1 กว้าง W/H หนา depth) */
  const hull = outline > 0 ? [1 + outline / (W / H), 1 + outline, 1 + outline / Math.max(depth, 1e-3)] : null
  const inner = useRef()
  const spin = useRef()
  const ang = useRef(0)
  const A = useMemo(() => ({ p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3() }), [])
  useFrame((state, dt) => {
    if (pressAt && inner.current) {
      const k = 1 - 0.22 * Math.min(1, Math.max(0, pressAt(state.clock)))
      inner.current.scale.set(k, k, 1)
    }
    const g = spin.current
    if (!g) return
    if (aim <= 0) {
      g.rotation.z = 0
      return
    }
    /**
     * เล็งด้วย feedback บนจอ ไม่ใช่คิดมุมในสามมิติ: ฉายจุดกำเนิดกับปลายลูกศร (แกน +y ท้องถิ่น)
     * ลงจอ ดูว่าปลายชี้ไปทางไหนอยู่ เทียบกับทิศไปหาเมาส์ แล้วหมุนรอบแกน z ท้องถิ่น (ตั้งฉากกับ
     * แผ่นลูกศร) ทีละนิดจนตรง — ลูกศรเอียงอยู่ในสามมิติ มุมบนจอกับมุมท้องถิ่นไม่เท่ากัน
     * วิธีนี้ลู่เข้าเองโดยไม่ต้องแก้สมการ ทิศการหมุนดูจากว่าแกน x/y ท้องถิ่นฉายลงจอแล้วขวามือหรือไม่
     */
    const cam = state.camera
    const asp = state.size.width / Math.max(1, state.size.height)
    A.p0.set(0, 0, 0)
    A.p1.set(0, 1, 0)
    A.p2.set(1, 0, 0)
    g.localToWorld(A.p0).project(cam)
    g.localToWorld(A.p1).project(cam)
    g.localToWorld(A.p2).project(cam)
    const ux = (A.p1.x - A.p0.x) * asp
    const uy = A.p1.y - A.p0.y
    const vx = (A.p2.x - A.p0.x) * asp
    const vy = A.p2.y - A.p0.y
    const handed = vx * uy - vy * ux > 0 ? 1 : -1
    const cur = Math.atan2(uy, ux)
    const want = Math.atan2(state.pointer.y - A.p0.y, (state.pointer.x - A.p0.x) * asp)
    let d = want - cur
    d = Math.atan2(Math.sin(d), Math.cos(d))
    const target = Math.max(-aimMax, Math.min(aimMax, ang.current + handed * d * aim))
    ang.current = damp(ang.current, target, aimEase, Math.min(dt, 0.05))
    g.rotation.z = ang.current
  })
  return (
    <group {...props}>
    <group ref={spin}>
    <group ref={inner}>
      <mesh geometry={geo}>
        {/* กลุ่ม 0 = หน้า/หลัง, กลุ่ม 1 = สันข้าง */}
        <meshStandardMaterial attach="material-0" color={faceColor} roughness={0.9} />
        <meshStandardMaterial attach="material-1" color={sideColor} roughness={0.9} />
      </mesh>
      {hull && (
        <mesh
          geometry={geo}
          scale={hull}
          renderOrder={2}
          onBeforeRender={(renderer, _s, _c, _g, material) => hideInBuffers(renderer, material)}
        >
          <meshBasicMaterial userData={OUTLINE_TAG} color={sideColor} side={THREE.BackSide} />
        </mesh>
      )}
    </group>
    </group>
    </group>
  )
}
