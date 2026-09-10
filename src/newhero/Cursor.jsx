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
/** ขนาดบิตแมปของลูกศร — ใช้ย่อให้สูง 1 หน่วยฉาก */
const W = 12
const H = 17

/**
 * ── มือชี้ ──
 *
 * รูปนี้ไล่ขั้นบันไดมือไม่ไหว (นิ้วสี่นิ้วยอดไม่เท่ากัน ง่ามนิ้วกว้างพิกเซลเดียว หัวแม่มือ
 * ยื่นออกข้าง) เขียนเป็น "ตารางพิกเซล" ตรง ๆ แล้วให้โค้ดไล่เส้นรอบรูปเอง — แก้รูปมือ
 * ทีหลังคือแก้ตัวอักษรในตาราง ไม่ต้องคิดพิกัดใหม่
 *
 * ง่ามระหว่างนิ้วเป็นช่องพิกเซลเดียวที่เปิดออกด้านนอก จึงไม่มีรูปิดในรูป (ExtrudeGeometry
 * ต้องรู้ว่าอะไรคือรู ถ้ามีรูต้องส่ง holes แยก) — ดำที่เห็นในง่ามคือ "สันข้าง" ของก้อนเอง
 */
const HAND_BITS = [
  '....##..........',
  '....##..........',
  '....##..........',
  '....##..........',
  '....##..........',
  '....##.##.......',
  '....##.##.##....',
  '....##.##.##.##.',
  '....########.##.',
  '....############',
  '.###############',
  '.###############',
  '..##############',
  '...#############',
  '...#############',
  '...#############',
  '...#############',
  '....###########.',
  '.....#########..',
  '......#######...',
]

/**
 * ไล่เส้นรอบรูปของบิตแมป: เก็บ "ขอบพิกเซลที่ไม่มีเพื่อนบ้าน" เป็นส่วนเส้นมีทิศ แล้วต่อกันเป็นวง
 *
 * ทิศของทุกส่วนเส้นวางให้เนื้อรูปอยู่ข้างเดียวกันตลอด (บน→ขวา→ล่าง→ซ้ายรอบพิกเซล) วงจึงต่อ
 * ได้ด้วยการหยิบส่วนเส้นที่ออกจากจุดปลายเดิมไปเรื่อย ๆ รูปเป็นก้อนเดียวไม่มีรู ทุกส่วนเส้น
 * จึงอยู่ในวงเดียวกันหมด
 */
function traceMask(rows) {
  const h = rows.length
  const w = rows[0].length
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] === '#'
  const out = new Map()
  const key = (x, y) => `${x},${y}`
  const add = (ax, ay, bx, by) => {
    const k = key(ax, ay)
    const list = out.get(k)
    if (list) list.push([bx, by])
    else out.set(k, [[bx, by]])
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!on(x, y)) continue
      if (!on(x, y - 1)) add(x, y, x + 1, y)
      if (!on(x + 1, y)) add(x + 1, y, x + 1, y + 1)
      if (!on(x, y + 1)) add(x + 1, y + 1, x, y + 1)
      if (!on(x - 1, y)) add(x, y + 1, x, y)
    }
  }
  // เริ่มที่พิกเซลเนื้อตัวแรกในลำดับอ่าน — มุมซ้ายบนของมันเป็นจุดบนวงรอบนอกแน่นอน
  let start = null
  for (let y = 0; y < h && !start; y += 1) {
    for (let x = 0; x < w && !start; x += 1) if (on(x, y)) start = [x, y]
  }
  if (!start) return []
  const pts = []
  let [cx, cy] = start
  const first = key(cx, cy)
  for (let guard = 0; guard < w * h * 4; guard += 1) {
    const list = out.get(key(cx, cy))
    if (!list || list.length === 0) break
    const [nx, ny] = list.shift()
    pts.push([cx, cy])
    cx = nx
    cy = ny
    if (key(cx, cy) === first) break
  }
  // ทิ้งจุดที่อยู่กลางเส้นตรง — ExtrudeGeometry ไม่ต้องรู้ ยิ่งน้อยยิ่งเบา
  const slim = []
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[(i - 1 + pts.length) % pts.length]
    const b = pts[i]
    const c = pts[(i + 1) % pts.length]
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
    if (cross !== 0) slim.push(b)
  }
  return slim
}

const HAND = traceMask(HAND_BITS)
const HAND_W = HAND_BITS[0].length
const HAND_H = HAND_BITS.length

/** รูปทรงที่ปั้นได้ — ทั้งสองอันเป็นพหุเหลี่ยมพิกเซล (y ชี้ลง) ปั้นด้วยตัวสร้างเดียวกัน */
const SHAPES = {
  arrow: { pts: PX, w: W, h: H },
  hand: { pts: HAND, w: HAND_W, h: HAND_H },
}

/** พหุเหลี่ยมพิกเซล → ก้อนสามมิติ สูง 1 หน่วยฉาก ไม่ใส่ bevel (ขอบต้องคมเป็นเหลี่ยม) */
function pixelGeometry(kind, depth) {
  const { pts, w, h } = SHAPES[kind] ?? SHAPES.arrow
  const sh = new THREE.Shape()
  pts.forEach(([x, y], i) => {
    const X = (x - w / 2) / h
    const Y = (h / 2 - y) / h
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
  /** รูปทรง: 'arrow' = ลูกศร, 'hand' = มือชี้ */
  kind = 'arrow',
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
  const geo = useMemo(() => pixelGeometry(kind, depth), [kind, depth])
  useDisposable(geo)
  const box = SHAPES[kind] ?? SHAPES.arrow
  /** เปลือกขอบขยายเป็นระยะคงที่ต่อแกน (ทรงสูง 1 กว้าง w/h หนา depth) */
  const hull =
    outline > 0
      ? [1 + outline / (box.w / box.h), 1 + outline, 1 + outline / Math.max(depth, 1e-3)]
      : null
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
