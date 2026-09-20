import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { heroPointer } from './heroPointer'
import * as THREE from 'three'
import { damp } from '@/joespresso/scene/utils'
import { OUTLINE_TAG, hideInBuffers } from './Switch'

/**
 * ลูกศรเมาส์กับมือชี้ — ก้อนสามมิติจากโมเดลที่ปั้นมาให้ (ไม่ใช่พหุเหลี่ยมพิกเซลในโค้ดแล้ว)
 *
 * ไฟล์เดียวมีสองรูปทรงอยู่ข้าง ๆ กัน: มือชี้อยู่ฝั่ง x ลบ ลูกศรอยู่ฝั่ง x บวก (พิกัดโลกของ
 * ไฟล์ หลังคูณเมทริกซ์ของโนดราก) แยกกันด้วย "จุดกลางสามเหลี่ยมอยู่ฝั่งไหน" ไม่ใช่ตามชื่อโนด
 * เพราะเมชในไฟล์ถูกรวมตามวัสดุ ไม่ใช่ตามรูปทรง — เมชเดียวกินทั้งสองรูป
 *
 * สีก็มาจากวัสดุของไฟล์เหมือนกัน: ขาวคือหน้า ดำคือขอบที่เขาปั้นมาแล้ว โค้ดจึงแยกสามเหลี่ยม
 * เป็นสองกลุ่มวัสดุในก้อนเดียว (กลุ่ม 0 = หน้า, กลุ่ม 1 = ขอบ) — ของเดิมก็สองกลุ่มเท่านี้
 * ตัวเรียกใช้จึงไม่ต้องรู้ว่ารูปทรงเปลี่ยนที่มา
 */

export const CURSOR_MODEL = '/models/cursor-3d.glb'

/** สีดำในไฟล์ = ขอบ (วัสดุที่ baseColorFactor เกือบดำ) ที่เหลือคือหน้า */
const isEdgeMaterial = (m) => {
  const c = m?.color
  return !!c && c.r + c.g + c.b < 0.3
}

/**
 * ทรงที่ปั้นเสร็จแล้ว แคชไว้ตลอดอายุแอป — คีย์คือ scene ที่ useGLTF แคชไว้
 *
 * ไม่ dispose: ก้อนนี้อยู่คู่กับ scene ในแคชของ useGLTF ซึ่งไม่ถูกปล่อยอยู่แล้ว และเคอร์เซอร์
 * มีอยู่ทั้งหน้า ปั้นใหม่ทุกครั้งที่ประกอบคอมโพเนนต์คือเสียเปล่า
 */
const CACHE = new WeakMap()

/**
 * ปลายที่ใช้ชี้ ในพิกัดท้องถิ่นของก้อน (หน่วยเดียวกับ geometry: ทรงสูง 1 หน่วย)
 *
 * เป็นกล่องที่ถูกเขียนทับตอนปั้นทรงเสร็จ ไม่ใช่ค่าคงที่: รูปทรงมาจากไฟล์ จะรู้ปลายก็ต้องรอ
 * ไฟล์โหลด คนอ่านอ่านทุกเฟรมอยู่แล้ว (ดู cursorguide/CursorGuideLayer) ค่าเริ่มต้นคือกลางบน
 */
export const CURSOR_TIP = { arrow: [0, 0.5], hand: [0, 0.5] }

/**
 * จุดที่ไกลจากจุดกลางมวลที่สุด — ใช้หา "แกนยาว" ของรูป ไม่ใช่หาปลายที่ใช้ชี้
 *
 * รูปทั้งสองยาวไปทางเดียว จุดไกลสุดจึงบอกแกนได้ แต่มันเป็นปลายไหนไม่แน่ (ของลูกศรคือปลาย
 * แหลม ของมือคือส้นฝ่ามือ) — ใครชี้ขึ้นดูที่ `HALF_TURN`
 */
function farthest(pos) {
  let cx = 0
  let cy = 0
  const n = pos.length / 3
  for (let i = 0; i < pos.length; i += 3) {
    cx += pos[i]
    cy += pos[i + 1]
  }
  cx /= n
  cy /= n
  let best = [0, 0]
  let far = -1
  for (let i = 0; i < pos.length; i += 3) {
    const d = (pos[i] - cx) ** 2 + (pos[i + 1] - cy) ** 2
    if (d > far) {
      far = d
      best = [pos[i], pos[i + 1]]
    }
  }
  return best
}

/** สลับจุดที่ 2 กับ 3 ของสามเหลี่ยม (พร้อมนอร์มัลของมัน) — ใช้กลับทิศการวน */
function swapWinding(tri) {
  const mid = tri.slice(6, 12)
  for (let i = 0; i < 6; i += 1) {
    tri[6 + i] = tri[12 + i]
    tri[12 + i] = mid[i]
  }
}

/**
 * ใส่นอร์มัลจากตัวเรขาคณิตเอง (แบนทั้งหน้า) — ไม่ใช้นอร์มัลที่มาในไฟล์
 *
 * นอร์มัลในไฟล์เชื่อไม่ได้: วัสดุทุกตัวตั้ง `doubleSided` คนปั้นจึงไม่เคยเห็นว่าบางหน้าหันกลับ
 * ผลคือหน้าครีมถูก cull หายไปทั้งแผ่น เหลือแต่ดำ รูปนี้เป็นทรงเหลี่ยมหมด นอร์มัลแบนต่อหน้า
 * ถูกอยู่แล้วและตรงกับทิศการวนเสมอ
 */
function flatNormal(tri) {
  const ux = tri[6] - tri[0]
  const uy = tri[7] - tri[1]
  const uz = tri[8] - tri[2]
  const vx = tri[12] - tri[0]
  const vy = tri[13] - tri[1]
  const vz = tri[14] - tri[2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const len = Math.hypot(nx, ny, nz) || 1
  for (let k = 0; k < 3; k += 1) {
    tri[k * 6 + 3] = nx / len
    tri[k * 6 + 4] = ny / len
    tri[k * 6 + 5] = nz / len
  }
}

/**
 * หันทุกหน้าของก้อนปิดออกด้านนอก — วัดจากปริมาตรมีเครื่องหมายของตัวก้อนเอง
 *
 * ผลรวมของ (v0 · v1 × v2)/6 ของก้อนปิดคือปริมาตร ถ้าติดลบแปลว่าวนกลับด้านทั้งก้อน
 * (หน้าที่หันเข้าหากล้องจะถูก cull) — สลับทิศวนทั้งก้อนทีเดียว แผ่นที่เลือกมาปิดสนิทอยู่แล้ว
 */
function faceOutward(tris) {
  let vol = 0
  for (const tri of tris) {
    const a = [tri[0], tri[1], tri[2]]
    const b = [tri[6], tri[7], tri[8]]
    const c = [tri[12], tri[13], tri[14]]
    vol +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0])
  }
  if (vol >= 0) return
  for (const tri of tris) {
    swapWinding(tri)
    flatNormal(tri)
  }
}

/**
 * "ความเป็นพิกเซล" ของแผ่น — สัดส่วนสันข้างที่ตั้งฉากกับแกน
 *
 * รูปพิกเซลมีแต่ขั้นบันได สันข้างจึงหันไปตามแกน x หรือ y เป๊ะเกือบทั้งหมด รูปเวกเตอร์เรียบ
 * มีเส้นโค้งกับเส้นเฉียง สันข้างจึงหันมั่ว — ใช้ค่านี้แยกว่าแผ่นไหนคือเวอร์ชัน 8 บิต
 *
 * นับแต่สันข้าง (นอร์มัลเกือบอยู่ในระนาบของแผ่น) ไม่นับหน้ากับหลัง ซึ่งหันไป z เหมือนกันหมด
 */
function pixelness(tris) {
  let walls = 0
  let square = 0
  for (const tri of tris) {
    for (let k = 0; k < 3; k += 1) {
      const nx = tri[k * 6 + 3]
      const ny = tri[k * 6 + 4]
      const nz = tri[k * 6 + 5]
      if (Math.abs(nz) > 0.5) continue
      walls += 1
      if (Math.max(Math.abs(nx), Math.abs(ny)) > 0.99) square += 1
    }
  }
  return walls === 0 ? 0 : square / walls
}

/**
 * ในไฟล์ รูปหนึ่งเป็นสองแผ่นซ้อน — คืนแผ่น "8 บิต" อันเดียว หันหน้าเข้าหากล้อง
 *
 * ไฟล์ให้มาสองเวอร์ชันของรูปเดียวกัน วางซ้อนกันคนละระดับความลึก: เวอร์ชันพิกเซลกับเวอร์ชัน
 * เส้นเรียบ เอาแต่พิกเซล (Joe สั่ง) — แยกแผ่นด้วยกลางช่วงความลึก เพราะสองแผ่นแยกกันสนิท
 * แล้วเลือกแผ่นที่ขั้นบันไดชัดกว่าด้วย `pixelness` ไม่ใช่นับสามเหลี่ยม (เส้นโค้งกินสามเหลี่ยม
 * มากกว่าขั้นบันไดเสียอีก)
 *
 * ทิศ "หน้า" อ่านจากไฟล์: แผ่นที่เลือกต้องหันหน้าเข้าหากล้อง ถ้ามันอยู่หลังอีกแผ่น ก็หมุนกลับ
 * 180 องศารอบแกน y — หมุน ไม่ใช่สะท้อนกระจก รูปจึงไม่กลับซ้ายขวา
 */
function pixelPlate(tris) {
  if (tris.length === 0) return tris
  const z = tris.map((tri) => (tri[2] + tri[8] + tri[14]) / 3)
  const cut = (Math.min(...z) + Math.max(...z)) / 2
  const near = []
  const far = []
  tris.forEach((tri, i) => (z[i] < cut ? far : near).push(tri))
  if (!far.length || !near.length) return tris
  const plate = pixelness(near) >= pixelness(far) ? near : far
  if (plate === far) {
    for (const tri of plate) {
      for (let k = 0; k < 3; k += 1) {
        tri[k * 6] *= -1
        tri[k * 6 + 2] *= -1
        tri[k * 6 + 3] *= -1
        tri[k * 6 + 5] *= -1
      }
      /* กลับด้านแล้วลำดับจุดต้องสลับ ไม่งั้นหน้าที่หันเข้าหาเรากลายเป็นหลัง */
      swapWinding(tri)
      flatNormal(tri)
    }
  }
  return plate
}

/** ขนาดของกล่องครอบ (x, y, z) */
function extent(pos) {
  const mn = [Infinity, Infinity, Infinity]
  const mx = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.length; i += 3) {
    for (let a = 0; a < 3; a += 1) {
      mn[a] = Math.min(mn[a], pos[i + a])
      mx[a] = Math.max(mx[a], pos[i + a])
    }
  }
  return [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2], (mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2]
}

/** ย้ายจุดกลางกล่องครอบไปที่ศูนย์ */
function center(pos) {
  const e = extent(pos)
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] -= e[3]
    pos[i + 1] -= e[4]
    pos[i + 2] -= e[5]
  }
}

/**
 * รูปที่ต้องหมุนอีกครึ่งรอบหลังจัดแกน — วัดจากไฟล์นี้
 *
 * `farthest` จัดให้จุดที่ไกลสุดขึ้นไปบน ของลูกศรจุดนั้นคือปลายแหลมพอดี แต่ของมือชี้คือส้น
 * ฝ่ามือ นิ้วจึงชี้ลง — หมุนอีกครึ่งรอบให้นิ้วขึ้น (หมุน ไม่ใช่สะท้อน)
 */
const HALF_TURN = { hand: true, arrow: false }

/**
 * ปลายที่ใช้ชี้ = จุดสูงสุดของรูป (หลังจัดให้ชี้ขึ้นแล้ว)
 *
 * ทั้งปลายลูกศรและปลายนิ้วเป็นจุดสูงสุดของรูปตัวเองหลังหมุนเสร็จ เอาค่ากลางของ x ที่แถบ
 * บนสุด เผื่อปลายเป็นพิกเซลกว้างหนึ่งช่องไม่ใช่จุดเดียว
 */
function tipTop(pos) {
  let top = -Infinity
  for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i])
  let sum = 0
  let n = 0
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i + 1] < top - 0.01) continue
    sum += pos[i]
    n += 1
  }
  return [n ? sum / n : 0, top]
}

/**
 * หันปลายของรูปขึ้น +y — แก้ที่ตัว geometry ทีเดียว ไม่ใช่ใส่มุมไว้ที่คนเรียก
 *
 * โค้ดเล็งเมาส์ (ดู `aim` ล่างในไฟล์นี้) ถือว่าแกน +y ท้องถิ่นคือทิศที่ปลายชี้ และจุดจอด
 * ทุกจุดก็ตั้งมุมไว้บนสมมติฐานเดิมนั้น ไฟล์วางลูกศรกับมือเอียงไปทางไหนก็เรื่องของไฟล์ —
 * หมุนในระนาบให้ปลายขึ้นเสียก่อน ของที่เคยตั้งค่าไว้จึงยังตรง
 */
function turnTipUp(pos, nor, half) {
  const [tx, ty] = farthest(pos)
  const a = Math.PI / 2 - Math.atan2(ty, tx) + (half ? Math.PI : 0)
  const c = Math.cos(a)
  const s = Math.sin(a)
  for (const arr of [pos, nor]) {
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i]
      const y = arr[i + 1]
      arr[i] = x * c - y * s
      arr[i + 1] = x * s + y * c
    }
  }
}

/**
 * ไฟล์ → ทรงของสองรูป: แยกฝั่ง แยกหน้า/ขอบ แล้วย่อให้สูง 1 หน่วย หน้าหันไป +z
 *
 * ปั้นเป็น geometry ไม่มี index ทีเดียว เรียงสามเหลี่ยมหน้าก่อนขอบทีหลัง แล้วประกาศสองกลุ่ม
 * — จะได้ยังเป็นเมชเดียวต่อรูปทรงเหมือนก่อน (draw call เท่าเดิม) และเปลือกขอบใช้ก้อนเดียวกัน
 */
function buildParts(scene) {
  const hit = CACHE.get(scene)
  if (hit) return hit
  scene.updateWorldMatrix(true, true)
  /** ถังเก็บสามเหลี่ยม: [รูปทรง][หน้า=0/ขอบ=1] */
  const bins = { hand: [[], []], arrow: [[], []] }
  const v = new THREE.Vector3()
  const nrm = new THREE.Vector3()
  const nMat = new THREE.Matrix3()
  scene.traverse((o) => {
    if (!o.isMesh) return
    const g = o.geometry
    const pos = g.getAttribute('position')
    const nor = g.getAttribute('normal')
    const idx = g.index
    const count = idx ? idx.count : pos.count
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    const edge = isEdgeMaterial(mats[0]) ? 1 : 0
    nMat.getNormalMatrix(o.matrixWorld)
    for (let t = 0; t < count; t += 3) {
      const tri = []
      let cx = 0
      for (let k = 0; k < 3; k += 1) {
        const i = idx ? idx.getX(t + k) : t + k
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld)
        nrm.fromBufferAttribute(nor, i).applyMatrix3(nMat).normalize()
        tri.push(v.x, v.y, v.z, nrm.x, nrm.y, nrm.z)
        cx += v.x
      }
      flatNormal(tri)
      bins[cx / 3 < 0 ? 'hand' : 'arrow'][edge].push(tri)
    }
  })
  const out = {}
  for (const kind of ['hand', 'arrow']) {
    /* เอาแต่แผ่นพิกเซล แล้วแยกหน้า/ขอบจากแผ่นนั้น — ลำดับต้องหน้าก่อนขอบ ตามกลุ่มวัสดุ */
    const chosen = pixelPlate([...bins[kind][0], ...bins[kind][1]])
    faceOutward(chosen)
    const plate = new Set(chosen)
    const face = bins[kind][0].filter((tri) => plate.has(tri))
    const edge = bins[kind][1].filter((tri) => plate.has(tri))
    const tris = [...face, ...edge]
    const pos = new Float32Array(tris.length * 9)
    const nor = new Float32Array(tris.length * 9)
    tris.forEach((tri, ti) => {
      for (let k = 0; k < 3; k += 1) {
        const o = ti * 9 + k * 3
        pos[o] = tri[k * 6]
        pos[o + 1] = tri[k * 6 + 1]
        pos[o + 2] = tri[k * 6 + 2]
        nor[o] = tri[k * 6 + 3]
        nor[o + 1] = tri[k * 6 + 4]
        nor[o + 2] = tri[k * 6 + 5]
      }
    })
    /* จุดกลางไปที่ศูนย์ก่อน แล้วหันปลายขึ้น แล้วค่อยย่อให้สูง 1 (หมุนแล้วความสูงเปลี่ยน) */
    center(pos)
    turnTipUp(pos, nor, HALF_TURN[kind])
    center(pos)
    const size = extent(pos)
    const s = 1 / Math.max(size[1], 1e-6)
    for (let i = 0; i < pos.length; i += 1) pos[i] *= s
    /**
     * ยกหน้าครีมออกมาหน้าแผ่นดำเล็กน้อย — ในไฟล์สองอันนี้อยู่ระนาบเดียวกันเป๊ะ
     *
     * ไฟล์วางรูปขาว (เนื้อใน) ทับบนแผ่นดำ (ซึ่งเป็นแผ่นเต็มรูป ไม่ใช่แค่วงขอบ) ที่ค่า z
     * เท่ากันทุกหลัก สองผิวจึงแย่งกันว่าใครอยู่หน้า (z-fighting) — มุมกล้องหนึ่งเห็นครีม
     * อีกมุมเห็นดำทั้งตัว ซึ่งคือที่เห็นในจอแรก ขยับออกมาหน่อยเดียวก็จบ ทั้งด้านหน้าและหลัง
     * (ขอบดำที่โผล่รอบนอกยังอยู่ เพราะแผ่นดำกว้างกว่ารูปขาว)
     */
    const LIFT = 0.004
    for (let i = 0; i < face.length * 9; i += 3) {
      const nz = nor[i + 2]
      if (Math.abs(nz) > 0.9) pos[i + 2] += nz > 0 ? LIFT : -LIFT
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    g.addGroup(0, face.length * 3, 0)
    g.addGroup(face.length * 3, edge.length * 3, 1)
    out[kind] = {
      geometry: g,
      /** สัดส่วนของก้อนเทียบความสูง 1 — เปลือกขอบต้องรู้ เพื่อขยายเป็นระยะเท่ากันทุกแกน */
      w: size[0] * s,
      depth: Math.max(size[2] * s, 1e-4),
      tip: tipTop(pos),
    }
    CURSOR_TIP[kind] = out[kind].tip
  }
  CACHE.set(scene, out)
  return out
}

const FACE = '#f7f1e6'
const SIDE = '#101019'

export function Cursor({
  /** รูปทรง: 'arrow' = ลูกศร, 'hand' = มือชี้ */
  kind = 'arrow',
  /** ความหนา (เทียบความสูง 1) — ยืดแกน z ของก้อนจากความหนาจริงในไฟล์ */
  depth = 0.3,
  /** ความหนาเส้นขอบดำรอบเงา — 0 = ไม่มี */
  outline = 0.03,
  faceColor = FACE,
  sideColor = SIDE,
  /** แรงกด 0..1 อ่านทุกเฟรม (clock) — ท่า "คลิก": ย่อลงแล้วดีดกลับ */
  pressAt = /** @type {null | ((clock: unknown) => number)} */ (null),
  /** เล็งเมาส์: หมุนตัวลูกศรในระนาบของมันให้ปลายชี้ไปทางเมาส์ (0 = ปิด, 1 = เต็ม) มุมสูงสุด (เรเดียน) และหน่วง */
  aim = 0,
  aimMax = 1,
  aimEase = 0.08,
  ...props
}) {
  const { scene } = useGLTF(CURSOR_MODEL)
  const part = buildParts(scene)[kind] ?? buildParts(scene).arrow
  /** ยืดความหนาที่กลุ่ม ไม่ใช่ปั้น geometry ใหม่ — ค่านี้มาจากแผงจูน เปลี่ยนได้ทุกเฟรม */
  const fat = depth / part.depth
  /** เปลือกขอบขยายเป็นระยะคงที่ต่อแกน (ทรงสูง 1 กว้าง w หนา depth) */
  const hull =
    outline > 0 ? [1 + outline / part.w, 1 + outline, 1 + outline / Math.max(depth, 1e-3)] : null
  const inner = useRef()
  const spin = useRef()
  const ang = useRef(0)
  const A = useMemo(
    () => ({ p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3() }),
    [],
  )
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
    /* เมาส์จากหน้าต่าง ไม่ใช่จาก state.pointer ของแคนวาส — เหตุผลอยู่ที่ ./heroPointer */
    const want = Math.atan2(heroPointer.y - A.p0.y, (heroPointer.x - A.p0.x) * asp)
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
      <group scale={[1, 1, fat]}>
      <mesh geometry={part.geometry}>
        {/* กลุ่ม 0 = หน้า/สันข้าง, กลุ่ม 1 = ขอบดำที่ปั้นมาในไฟล์ */}
        <meshStandardMaterial attach="material-0" color={faceColor} roughness={0.9} />
        <meshStandardMaterial attach="material-1" color={sideColor} roughness={0.9} />
      </mesh>
      {hull && (
        <mesh
          geometry={part.geometry}
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
    </group>
  )
}

useGLTF.preload(CURSOR_MODEL)
