import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { introState } from '../intro'
import { scrollState } from '../scroll'
import { toggleDevMode, useDevMode } from '../mode'
import { addRim, useDisposable } from './utils'
// eslint-disable-next-line no-unused-vars -- ถูก comment ไว้ชั่วคราว (ดูจุด mount)
import { Slogan } from './Slogan'

/**
 * ดัด geometry ให้ห่อรอบแกนตั้งแบบผนังทรงกระบอก (เว้าเข้าหากล้อง)
 * แบบเดียวกับ panel ในภาพ ref — ขอบซ้ายขวาโค้งเข้าหาคนดู
 */
export function bendGeometry(geo, R) {
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const a = x / R
    pos.setX(i, R * Math.sin(a))
    pos.setZ(i, R * (1 - Math.cos(a)) + z * Math.cos(a))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/**
 * ดัด geometry ให้ไปวางบน "จอโค้งใบเดียว" ที่มีจุดศูนย์กลางอยู่ที่ตาคนดู
 *
 * ต่างจาก bendGeometry ตรง *สเปซที่ดัด* ไม่ใช่สูตร:
 * bendGeometry ดัดในสเปซของแผ่นเอง แกนโค้งอยู่กลางแผ่นนั้น ๆ ผลคือแต่ละแผ่นม้วนรอบตัวเอง
 * ต่างคนต่างม้วน ไม่มีความสัมพันธ์กัน
 *
 * ตัวนี้ยุบ transform ของแผ่นลง geometry ก่อน (ทุกแผ่นมาอยู่สเปซโลกร่วมกัน) แล้วค่อยม้วน
 * รอบแกนตั้งที่ลากผ่านตาคนดู ทุกแผ่นจึงโค้งตามส่วนโค้งเดียวกัน แผ่นที่อยู่ริมจะหันเข้าหา
 * คนดูเองโดยอัตโนมัติ — curvilinear perspective แบบ Fig.128 ที่ทุกเส้นวิ่งเข้า station point
 *
 * k = 0 แบนเท่าเดิม, 1 = โค้งเต็มตามระยะจริง (ทุก vertex ห่างจากตาเท่ากันหมด)
 */
export function curveOnScreen(geo, matrix, k, eyeZ) {
  geo.applyMatrix4(matrix)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i) - eyeZ // เทียบกับตา: ของที่อยู่ข้างหน้าเป็นลบ
    const d = -z
    if (d <= 1e-3) continue
    // มุมกวาด = ความยาวส่วนโค้ง / รัศมี -> รักษาความยาวแผ่นไว้ ไม่ยืดไม่หด
    const th = x / d
    pos.setX(i, x + (d * Math.sin(th) - x) * k)
    pos.setZ(i, z + (-d * Math.cos(th) - z) * k + eyeZ)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/** matrix ของแผ่นจาก position/rotation — ใช้ยุบเข้า geometry ก่อนม้วน */
function panelMatrix(position, rotation) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(1, 1, 1),
  )
}

/**
 * ฉาย uv 0..1 ลง geometry จากกล่องของมันเอง (มองจากด้านหน้า)
 *
 * roundedSlabGeometry ปั้น vertex เองล้วน ๆ ไม่มี uv ติดมาเลย ส่วน ShapeGeometry มี uv แต่เป็น
 * พิกัด x,y ดิบ ๆ ไม่ได้นอร์มอลไลซ์ ทั้งสองแบบเอาไปแปะ texture ตรง ๆ ไม่ได้ (แถบแสงบนการ์ด
 * ใช้ alphaMap) — สร้าง/เขียนทับ uv จากกล่องของทรงเสียเลย ด้านข้างจะถูกยืด ซึ่งไม่เป็นไร
 * เพราะสิ่งที่แปะเป็นแถบแสงนุ่ม ๆ ไม่ใช่ลายที่ต้องตรงตำแหน่ง
 */
function uvFromBounds(geo) {
  geo.computeBoundingBox()
  const { min, max } = geo.boundingBox
  const sx = max.x - min.x || 1
  const sy = max.y - min.y || 1
  const pos = geo.attributes.position
  if (!geo.attributes.uv) {
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2))
  }
  const uv = geo.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - min.x) / sx, (pos.getY(i) - min.y) / sy)
  }
  uv.needsUpdate = true
  return geo
}

/**
 * แผนที่ความขรุขระแบบเม็ดละเอียด — ทำให้ผิวอ่านเป็น "ฝ้า" ไม่ใช่พลาสติกใสเรียบ
 * ไฮไลต์จะแตกเป็นหย่อม ๆ แทนที่จะเป็นแผ่นมันเรียบทั้งใบ
 */
function frostTex(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    // ค่าเกาะกลุ่มแถว ๆ กลาง ๆ ไม่ใช่ noise เต็มสเกล ไม่งั้นผิวจะดูเหมือนทรายไม่ใช่ฝ้า
    const v = 150 + Math.random() * 70
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 3)
  return tex
}

/**
 * alphaMap แถบแสงพาดเฉียง — ไฮไลต์ที่ทำให้อ่านเป็นผิวมันเงา ไม่ใช่แผ่นขุ่น
 * ไล่จากใสไปขาวแล้วกลับมาใส สองแถบกว้างไม่เท่ากัน (แถบใหญ่ + แถบบางซ้อน) แบบแสงบนกระจกจริง
 */
function sheenTex(w, h) {
  const W = 512
  const H = Math.max(64, Math.round((W * h) / w))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  const g = ctx.createLinearGradient(0, H, W, 0)
  g.addColorStop(0, '#00000000')
  g.addColorStop(0.28, '#00000000')
  g.addColorStop(0.42, '#ffffffcc')
  g.addColorStop(0.5, '#ffffff66')
  g.addColorStop(0.58, '#ffffffee')
  g.addColorStop(0.72, '#00000000')
  g.addColorStop(1, '#00000000')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/** alphaMap มุมมน — plane ธรรมดาจะได้มุมโค้งแบบการ์ด UI */
function roundedAlphaTex(w, h, r) {
  const W = 512
  const H = Math.max(64, Math.round((W * h) / w))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const rp = Math.min((r / w) * W, W / 2, H / 2)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.roundRect(0, 0, W, H, rp)
  ctx.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/**
 * หน้าจอ wireframe ที่กำลังถูกออกแบบอยู่ — วาดครั้งเดียวลง canvas แล้วแปะเป็น map
 *
 * ทำไมเป็นเท็กซ์เจอร์ ไม่ใช่ mesh ต่อชิ้น: wireframe หนึ่งใบมีกล่อง/เส้น/หมุดเป็นสิบชิ้น
 * ถ้าแยก mesh ก็คือ draw call เป็นสิบต่อการ์ดหนึ่งใบ ทั้งที่มันแบนและไม่ขยับ วาดใส่ canvas
 * ใบเดียวจบในหนึ่ง draw call และคมกว่าเพราะเส้นถูกวาดที่ความละเอียดของเท็กซ์เจอร์
 *
 * องค์ประกอบเลือกให้อ่านออกว่า "งานที่ทำค้างอยู่": โครงยังเป็นกล่องเปล่ากับเส้นแทนข้อความ
 * มีกล่องรูปกากบาทแบบ placeholder และมีชิ้นหนึ่งถูกเลือกอยู่ (กรอบฟ้า + หมุดสี่มุม)
 */
function wireframeTex(w, h) {
  const W = 1024
  const H = Math.max(256, Math.round((W * h) / w))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const u = W / 100 // หน่วยสัมพัทธ์ ไม่ผูกกับพิกเซลจริง

  ctx.fillStyle = '#F4F5F7'
  ctx.fillRect(0, 0, W, H)

  const line = (x, y, ww, hh, color = '#C7CBD4') => {
    ctx.fillStyle = color
    ctx.fillRect(x * u, y * u, ww * u, hh * u)
  }
  const box = (x, y, ww, hh, color = '#B9BFCC') => {
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1.5, u * 0.22)
    ctx.strokeRect(x * u, y * u, ww * u, hh * u)
  }

  // แถบหัวหน้าต่าง + จุดสามจุด
  line(0, 0, 100, 7, '#E4E7EC')
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = '#C7CBD4'
    ctx.beginPath()
    ctx.arc((4 + i * 4) * u, 3.5 * u, 1.1 * u, 0, Math.PI * 2)
    ctx.fill()
  }

  // แถบข้าง = รายการเลเยอร์ที่ยังไม่ตั้งชื่อ
  line(0, 7, 22, 100, '#ECEEF2')
  for (let i = 0; i < 6; i++) line(3, 12 + i * 6, 14 - (i % 3) * 3, 1.6)

  // กล่องรูปแบบ placeholder — กากบาททแยงมุมตามธรรมเนียม wireframe
  const bx = 27
  const by = 12
  const bw = 44
  const bh = 26
  box(bx, by, bw, bh)
  ctx.strokeStyle = '#C7CBD4'
  ctx.lineWidth = Math.max(1, u * 0.16)
  ctx.beginPath()
  ctx.moveTo(bx * u, by * u)
  ctx.lineTo((bx + bw) * u, (by + bh) * u)
  ctx.moveTo((bx + bw) * u, by * u)
  ctx.lineTo(bx * u, (by + bh) * u)
  ctx.stroke()

  // บรรทัดข้อความจำลอง + ปุ่ม
  line(bx, by + bh + 5, 30, 2.4)
  line(bx, by + bh + 10, 40, 1.8)
  line(bx, by + bh + 14, 24, 1.8)
  ctx.fillStyle = '#C7CBD4'
  ctx.beginPath()
  ctx.roundRect(bx * u, (by + bh + 20) * u, 16 * u, 6 * u, 1.4 * u)
  ctx.fill()

  // การ์ดฝั่งขวาที่ "กำลังถูกเลือก" — กรอบฟ้า + หมุดสี่มุม สีเดียวกับ activeColor ของ toolbar
  const sx = 76
  const sy = 12
  const sw = 20
  const sh = 34
  box(sx, sy, sw, sh, '#D3D7DE')
  ctx.strokeStyle = '#0C8CE9'
  ctx.lineWidth = Math.max(1.5, u * 0.26)
  ctx.strokeRect(sx * u, sy * u, sw * u, sh * u)
  const hs = 1.5
  for (const [hx, hy] of [
    [sx, sy],
    [sx + sw, sy],
    [sx, sy + sh],
    [sx + sw, sy + sh],
  ]) {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect((hx - hs / 2) * u, (hy - hs / 2) * u, hs * u, hs * u)
    ctx.strokeRect((hx - hs / 2) * u, (hy - hs / 2) * u, hs * u, hs * u)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.anisotropy = 4
  return tex
}

/**
 * เครื่องมือที่เลือกอยู่บน toolbar — แชร์เป็น mutable state แบบ introState
 * (อ่านใน event handler ทุกครั้งที่กด ไม่ต้อง re-render อะไรตอนสลับเครื่องมือ)
 * 'cursor' = โหมดเลือก/ลาก panel ได้เหมือน canvas ของ Figma
 */
export const toolState = { tool: 'cursor' }

const DRAG_P = new THREE.Vector3()
const DRAG_D = new THREE.Vector3()
const DRAG_N = new THREE.Vector3()
const DRAG_M = new THREE.Matrix4()

function CurvedPanel({
  position,
  rotation = [0, 0, 0],
  size = [3, 2],
  color = '#FFFFFF',
  opacity = 0.42,
  rows = [],
  curve = 1,
  eyeZ = 14.5,
  corner = 0.18,
  /**
   * แผ่นกระจก — หักเหฉากที่อยู่ข้างหลังจริง ๆ ไม่ใช่แผ่นขาวจาง ๆ
   *
   * ใช้ MeshTransmissionMaterial ของ drei: มันเรนเดอร์ฉากลง buffer อีกใบต่อเฟรมแล้วเอามา
   * สุ่มอ่านตอนวาดผิวกระจก ของที่อยู่หลังแผ่นจึงบิดและเบลอตามความหนา/ความขรุขระจริง
   * แพงกว่า material ปกติมาก (เรนเดอร์เพิ่มหนึ่งรอบต่อ material) — ใช้กับใบเดียวเท่านั้น
   * และกด samples/resolution ให้ต่ำ เพราะภาพที่หักเหแล้วมันเบลออยู่แล้ว ไม่มีใครดูออก
   */
  glass = false,
  /** ภาพที่แปะบนหน้าการ์ด (ใช้กับ wireframe ที่กำลังออกแบบอยู่) */
  map = null,
}) {
  const ref = useRef()
  const hovered = useRef(false)
  // ลากด้วยเครื่องมือ cursor: ระนาบลากตั้งฉากกล้องผ่านจุดที่จับ + offset สะสม (local)
  const drag = useRef(null)
  const off = useRef(new THREE.Vector3())
  const [w, h] = size

  const alpha = useMemo(() => roundedAlphaTex(w, h, corner), [w, h, corner])
  const sheen = useMemo(() => (glass ? sheenTex(w, h) : null), [glass, w, h])
  const frost = useMemo(() => (glass ? frostTex() : null), [glass])
  /**
   * material ของการ์ดฝ้า — สร้างเป็นก้อนแทนที่จะประกาศใน JSX เพราะต้องเอาไปผ่าน addRim
   * (rim เป็น fresnel ที่แทรกเข้า shader ตอน compile ต้องมีตัว material จริงให้จับ)
   *
   * FrontSide ไม่ใช่ DoubleSide: ทรงนี้เป็นก้อนนูนปิด ถ้าวาดสองด้าน ทุกพิกเซลจะมีทั้งหน้าหน้า
   * และหน้าหลังซ้อนกัน แล้วสีโปร่งถูกผสมสองรอบ ผลคือหน้าแผ่นกับสันข้างเข้มไม่เท่ากันจนอ่านเป็น
   * "กล่องสองใบวางทับกัน" ไม่ใช่แผ่นเดียวที่มีความหนา — วาดด้านเดียวก็เหลือพิกเซลละหนึ่งชั้น
   */
  const glassMat = useMemo(() => {
    if (!glass) return null
    /**
     * transmission ของ three แทน opacity จาง ๆ: renderer เรนเดอร์ฉากหลังลง RT (mipmapped)
     * แล้วผิวกระจกสุ่มอ่าน mip ตาม roughness — ของหลังแผ่นจึง "เบลอจริง" ไม่ใช่แค่ซีดลง
     * RT ใบเดียวแชร์กันทุกวัตถุ transmissive ต่อเฟรม ถูกกว่า MeshTransmissionMaterial
     * ของ drei (ที่เปิด FBO แยกต่อ material) มาก
     */
    const m = new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: 1,
      transmission: 0.88,
      thickness: 0.35,
      ior: 1.15,
      roughness: 0.62,
      roughnessMap: frost,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.28,
      side: THREE.FrontSide,
    })
    // ขอบสว่างรับแสงรอบทรง — ตัวเดียวกับที่ฉากใช้กับ mascot/พุ่มไม้ ความสว่างจะได้เป็นภาษาเดียวกัน
    return addRim(m, { color: '#FFF6E6', power: 2.2, intensity: 0.55 })
  }, [glass, color, frost])
  useDisposable(glassMat)
  const rowKey = JSON.stringify(rows)
  // แถวปลายมนต้องมี alphaMap ของตัวเอง เพราะสัดส่วนแต่ละแถวไม่เท่ากัน
  const rowEdges = useMemo(
    () => rows.map((r) => (r.pill ? roundedAlphaTex(r.w, r.h ?? 0.16, (r.h ?? 0.16) / 2) : null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowKey],
  )
  useDisposable(rowEdges)

  // ยุบ transform ลง geometry แล้วม้วนรอบแกนที่ตาคนดู จากนั้นค่อยดึงกลับมาให้จุดหมุน
  // อยู่กลางแผ่น — hover จะได้ขยาย/ขยับรอบตัวเองเหมือนเดิม ไม่ใช่รอบตาคนดู
  const built = useMemo(() => {
    /**
     * แผ่นหนาม้วนตามจอโค้งใบเดียวกับ panel อื่น — ทางเดียวกับที่ toolbar ใช้
     *
     * curveOnScreen ใช้กับทรงหนาไม่ได้: มันยุบ transform ลง vertex แล้วดัดในสเปซโลก สันข้าง
     * กับส่วนลบเหลี่ยมจะบิดคนละทางกับหน้าแผ่น (ก่อนหน้านี้ผมจึงส่ง curve = 0 ให้มันแบนไปเลย)
     *
     * bendGeometry ม้วนรอบแกนตั้งที่อยู่ห่างจากแผ่นไป R — ถ้าตั้ง R = ระยะจากตาถึงการ์ด แล้วหัน
     * หน้าการ์ดเข้าหาตา แกนม้วนจะไปตกที่ตาพอดี ผิวการ์ดจึงนอนอยู่บนทรงกระบอกใบเดียวกับ panel
     * อื่นทั้งฉาก โดยที่ความหนายังอยู่ครบ (ดูคอมเมนต์ที่ toolbarOnScreen — หลักการเดียวกันเป๊ะ)
     *
     * rotation ที่ส่งเข้ามาจึงกลายเป็น "เอียงเพิ่มจากท่าหันหน้าเข้าหาตา" ไม่ใช่มุมสัมบูรณ์
     * (ต้องเอียงเกินนิดหน่อยถึงจะเห็นสันด้านข้าง ถ้าหันตรงเป๊ะจะเห็นแต่หน้าแบน ๆ)
     */
    if (glass) {
      const dx = position[0]
      const dz = position[2] - eyeZ
      const dist = Math.hypot(dx, dz)
      const R = curve > 0.001 ? dist / curve : 1e6
      const depth = 0.46
      const body = bendGeometry(
        uvFromBounds(
          roundedSlabGeometry({ w, h, r: corner, depth, bevel: 0.05, segX: 64, segY: 8 }),
        ),
        R,
      )
      const rowGeos = rows.map((r) => {
        const g = r.dot
          ? new THREE.CircleGeometry(r.w / 2, 40)
          : new THREE.PlaneGeometry(r.w, r.h ?? 0.16, 48, 1)
        // วางบนผิวหน้าของแผ่น (นับจากกึ่งกลางความหนา) แล้วม้วนด้วยรัศมีเดียวกับตัวแผ่น
        g.translate(r.x ?? 0, r.y, depth / 2 + 0.012)
        return bendGeometry(g, R)
      })
      return {
        body,
        rowGeos,
        center: new THREE.Vector3(...position),
        // หันหน้าเข้าหาตา แล้วเอียงเพิ่มตามค่าที่ส่งมา
        rot: [0, Math.atan2(-dx, -dz) + (rotation[1] ?? 0), 0],
        // hover ลอยเข้าหาตา (สเปซแม่) ส่วนแถบแสงวางเยื้องตามแกน z ของตัวเอง (สเปซของกลุ่ม)
        toEye: new THREE.Vector3(-dx, 0, -dz).normalize(),
        front: new THREE.Vector3(0, 0, 1),
      }
    }

    const m = panelMatrix(position, rotation)
    // ซอย x ถี่ขึ้นกว่าเดิม: ตอนนี้แผ่นเดียวกวาดส่วนโค้งกว้างกว่ามาก
    const body = curveOnScreen(new THREE.PlaneGeometry(w, h, 96, 1), m, curve, eyeZ)
    /**
     * แถวในการ์ดมีสามแบบ: แท่งทึบ (เดิม), จุดกลม, และแท่งปลายมน
     * จุดใช้ CircleGeometry จริง ไม่ใช่สี่เหลี่ยมจัตุรัสที่ตัดมุมด้วย alpha — ขอบจะได้คมทุกระยะ
     */
    const rowGeos = rows.map((r) => {
      const g = r.dot
        ? new THREE.CircleGeometry(r.w / 2, 40)
        : new THREE.PlaneGeometry(r.w, r.h ?? 0.16, 48, 1)
      g.translate(r.x ?? 0, r.y, 0.03)
      return curveOnScreen(g, m, curve, eyeZ)
    })
    body.computeBoundingBox()
    const center = body.boundingBox.getCenter(new THREE.Vector3())
    body.translate(-center.x, -center.y, -center.z)
    for (const g of rowGeos) g.translate(-center.x, -center.y, -center.z)
    // ทิศเข้าหาตา — hover ให้แผ่นลอยเข้าหาคนดูตามแนวรัศมี ไม่ใช่ตามแกน z ของฉาก
    const toEye = new THREE.Vector3(0, center.y, eyeZ).sub(center).normalize()
    return { body, rowGeos, center, toEye, rot: [0, 0, 0], front: toEye }
  }, [w, h, rowKey, curve, eyeZ, glass, corner, position[0], position[1], position[2], rotation[1]])

  useDisposable(alpha)
  useDisposable(sheen)
  useDisposable(frost)
  useDisposable(built.body)
  useDisposable(built.rowGeos)

  useFrame((_, delta) => {
    if (!ref.current) return
    const dt = Math.min(delta, 0.05)
    const lift = hovered.current ? 0.55 : 0
    const o = ref.current
    const c = built.center
    const e = built.toEye
    const g = off.current
    o.position.x = THREE.MathUtils.damp(o.position.x, c.x + e.x * lift + g.x, 7.7, dt)
    o.position.y = THREE.MathUtils.damp(o.position.y, c.y + e.y * lift + g.y, 7.7, dt)
    o.position.z = THREE.MathUtils.damp(o.position.z, c.z + e.z * lift + g.z, 7.7, dt)
    const s = hovered.current ? 1.04 : 1
    o.scale.x = THREE.MathUtils.damp(o.scale.x, s, 7.7, dt)
    o.scale.y = THREE.MathUtils.damp(o.scale.y, s, 7.7, dt)
  })

  return (
    <group
      ref={ref}
      position={built.center}
      rotation={built.rot}
      onPointerOver={(e) => {
        e.stopPropagation()
        hovered.current = true
        document.body.style.cursor = toolState.tool === 'cursor' ? 'grab' : 'pointer'
      }}
      onPointerOut={() => {
        hovered.current = false
        if (!drag.current) document.body.style.cursor = ''
      }}
      onPointerDown={(e) => {
        // ลากได้เฉพาะเครื่องมือ cursor — เครื่องมืออื่นปล่อยเหตุการณ์ผ่านไปตามปกติ
        if (toolState.tool !== 'cursor') return
        e.stopPropagation()
        e.target.setPointerCapture?.(e.pointerId)
        // ระนาบลากตั้งฉากทิศกล้อง ผ่านจุดที่จับ — panel เลื่อนขนานจอ ระยะลึกคงเดิม
        e.camera.getWorldDirection(DRAG_N)
        drag.current = {
          plane: new THREE.Plane().setFromNormalAndCoplanarPoint(DRAG_N.clone(), e.point),
          start: e.point.clone(),
          base: off.current.clone(),
        }
        document.body.style.cursor = 'grabbing'
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        e.stopPropagation()
        if (!e.ray.intersectPlane(d.plane, DRAG_P)) return
        // delta โลก -> local ของ parent (กลุ่ม panel ถูกสเกล depth 1.25 รอบกล้อง)
        DRAG_D.copy(DRAG_P).sub(d.start)
        const parent = ref.current?.parent
        if (parent) {
          parent.updateWorldMatrix(true, false)
          DRAG_M.copy(parent.matrixWorld).invert().setPosition(0, 0, 0)
          DRAG_D.applyMatrix4(DRAG_M)
        }
        off.current.copy(d.base).add(DRAG_D)
      }}
      onPointerUp={(e) => {
        if (!drag.current) return
        drag.current = null
        e.target.releasePointerCapture?.(e.pointerId)
        document.body.style.cursor = hovered.current ? 'grab' : ''
      }}
    >
      <mesh geometry={built.body}>
        {glass ? (
          <primitive object={glassMat} attach="material" />
        ) : (
          /**
           * การ์ดเกือบทึบ (opacity ≥ 0.8) ตัดขอบมนด้วย alphaTest แทน alpha blending —
           * วัตถุ transparent ถูกกันออกจาก buffer หักเหของกระจก (transmission ของ three
           * เรนเดอร์เฉพาะ pass ทึบ) ลากการ์ดไปหลังการ์ดกระจกแล้วจะหายวับทั้งใบ
           * เข้า pass ทึบแล้วมองทะลุกระจกเห็นตามจริง ขอบมนยังคมเหมือนเดิม (alpha แทบไบนารี)
           */
          <meshStandardMaterial
            color={color}
            map={map ?? undefined}
            transparent={opacity < 0.8}
            opacity={opacity}
            alphaMap={alpha}
            alphaTest={opacity < 0.8 ? 0 : 0.45}
            roughness={0.35}
            metalness={0}
            side={THREE.DoubleSide}
          />
        )}
      </mesh>
      {glass && (
        /**
         * เหลือเฉพาะแถบแสงพาดเฉียง — ไม่มีเส้นขอบ
         * เคยตีเส้นขาวรอบแผ่นเพื่อให้เห็นความหนา แต่ผลคืออ่านเป็น "การ์ดที่มี border"
         * ไม่ใช่แผ่นกระจก ความเป็นกระจกมาจากผิวมันกับแสงที่พาด ไม่ใช่จากเส้นรอบรูป
         */
        <mesh geometry={built.body} position={built.front.clone().multiplyScalar(0.02)}>
          <meshBasicMaterial
            color="#FFFFFF"
            transparent
            opacity={0.3}
            alphaMap={sheen}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {rows.map((r, i) => (
        <mesh key={i} geometry={built.rowGeos[i]}>
          <meshBasicMaterial
            color={r.color}
            transparent
            opacity={r.opacity ?? 0.95}
            alphaMap={rowEdges[i] ?? undefined}
            depthWrite={!r.pill}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- toolbar สไตล์ Figma: extrusion 3D จริง ไอคอนคลิกเลือก active ได้ ---------- */

/**
 * seg = จำนวนช่วงที่ซอยด้านตรง ใส่ >1 เมื่อจะเอา geometry ไปดัดโค้งต่อ
 * (bendGeometry ขยับได้แค่ vertex ที่มีอยู่ ด้านตรงที่มีแค่หัวกับท้ายจะดัดไม่ขึ้น)
 */
function roundedRectShape(w, h, r, seg = 1) {
  const s = new THREE.Shape()
  const hw = w / 2
  const hh = h / 2
  const line = (x0, y0, x1, y1) => {
    for (let i = 1; i <= seg; i++) {
      s.lineTo(x0 + (x1 - x0) * (i / seg), y0 + (y1 - y0) * (i / seg))
    }
  }
  s.moveTo(-hw + r, -hh)
  line(-hw + r, -hh, hw - r, -hh)
  s.quadraticCurveTo(hw, -hh, hw, -hh + r)
  line(hw, -hh + r, hw, hh - r)
  s.quadraticCurveTo(hw, hh, hw - r, hh)
  line(hw - r, hh, -hw + r, hh)
  s.quadraticCurveTo(-hw, hh, -hw, hh - r)
  line(-hw, hh - r, -hw, -hh + r)
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
  return s
}

/**
 * แท่งสี่เหลี่ยมมุมมน สร้างเป็น "กริด" เอง แทน ExtrudeGeometry
 *
 * ทำไมต้องเขียนเอง: ExtrudeGeometry ใช้ earcut triangulate หน้าตัด ซึ่งลากสามเหลี่ยมยาว
 * พาดกลางรูป ไม่ใช่ตาราง พอเอาไปดัดด้วย bendGeometry (ที่ขยับเฉพาะ vertex) ผิวจริงเลย
 * กลายเป็นแผ่นแบนหลายแผ่นที่เบี่ยงออกจากเส้นโค้งอุดมคติ — ส่วนปุ่มถูกวางด้วยสูตรวงกลม
 * ตรงเป๊ะ ผลคือปุ่มลอย/จมเทียบกับผิวที่มองเห็น ยิ่งดัดโค้งมากยิ่งเพี้ยน
 *
 * กริดนี้ทุก vertex แชร์กับเพื่อนบ้าน (ไม่มี T-junction) และหนาแน่นทั้งผืน ดัดแล้วผิวจึง
 * ตรงกับสูตรเดียวกับที่ใช้วางปุ่ม
 */
function roundedSlabGeometry({ w, h, r, depth, bevel, segX = 64, segY = 10, segBevel = 3 }) {
  const hw = w / 2
  const hh = h / 2
  const hd = depth / 2
  const b = Math.max(1e-4, Math.min(bevel, hd * 0.9, hw * 0.4, hh * 0.4))

  const dims = (inset) => {
    const iw = Math.max(1e-3, hw - inset)
    const ih = Math.max(1e-3, hh - inset)
    return { hw: iw, hh: ih, rr: Math.max(0, Math.min(r - inset, iw, ih)) }
  }
  // ครึ่งความสูงของรูป ณ ตำแหน่ง x
  const halfH = (x, D) => {
    const t = Math.abs(x) - (D.hw - D.rr)
    return t <= 0 ? D.hh : D.hh - D.rr + Math.sqrt(Math.max(0, D.rr * D.rr - t * t))
  }

  const pos = []
  const idx = []
  const push = (x, y, z) => {
    pos.push(x, y, z)
    return pos.length / 3 - 1
  }
  const row = segY + 1

  /** หน้าตัด: กริดเต็มผืน + คืน index ของขอบตามลำดับเดียวกับ ring() */
  const cap = (inset, z, front) => {
    const D = dims(inset)
    const start = pos.length / 3
    for (let i = 0; i <= segX; i++) {
      const x = -D.hw + (2 * D.hw * i) / segX
      const fy = halfH(x, D)
      for (let j = 0; j <= segY; j++) push(x, -fy + (2 * fy * j) / segY, z)
    }
    for (let i = 0; i < segX; i++) {
      for (let j = 0; j < segY; j++) {
        const a = start + i * row + j
        const c = a + row
        if (front) idx.push(a, c, a + 1, c, c + 1, a + 1)
        else idx.push(a, a + 1, c, c, a + 1, c + 1)
      }
    }
    const per = []
    for (let i = 0; i <= segX; i++) per.push(start + i * row + segY)
    for (let j = segY - 1; j >= 0; j--) per.push(start + segX * row + j)
    for (let i = segX - 1; i >= 0; i--) per.push(start + i * row)
    for (let j = 1; j <= segY - 1; j++) per.push(start + j)
    return per
  }

  /** เส้นรอบรูปวงเดียว ลำดับตรงกับ per ของ cap เป๊ะ ๆ เพื่อเย็บต่อกันได้ */
  const ring = (inset, z) => {
    const D = dims(inset)
    const side = halfH(D.hw, D)
    const X = (i) => -D.hw + (2 * D.hw * i) / segX
    const out = []
    for (let i = 0; i <= segX; i++) out.push(push(X(i), halfH(X(i), D), z))
    for (let j = segY - 1; j >= 0; j--) out.push(push(D.hw, -side + (2 * side * j) / segY, z))
    for (let i = segX - 1; i >= 0; i--) out.push(push(X(i), -halfH(X(i), D), z))
    for (let j = 1; j <= segY - 1; j++) out.push(push(-D.hw, -side + (2 * side * j) / segY, z))
    return out
  }

  // ลบเหลี่ยมเป็นเสี้ยววงกลม: s=0 อยู่ที่ผิวหน้า (จม inset=b), s=segBevel อยู่ที่ขอบตรง
  const zAt = (s) => hd - b + b * Math.sin((Math.PI / 2) * (1 - s / segBevel))
  const insetAt = (s) => b * (1 - Math.cos((Math.PI / 2) * (1 - s / segBevel)))

  const rings = [cap(b, hd, true)]
  for (let s = 1; s <= segBevel; s++) rings.push(ring(insetAt(s), zAt(s)))
  for (let s = segBevel; s >= 1; s--) rings.push(ring(insetAt(s), -zAt(s)))
  rings.push(cap(b, -hd, false))

  const P = rings[0].length
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k]
    const B = rings[k + 1]
    for (let i = 0; i < P; i++) {
      const a0 = A[i]
      const a1 = A[(i + 1) % P]
      const b0 = B[i]
      const b1 = B[(i + 1) % P]
      idx.push(a0, a1, b0, a1, b1, b0)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/**
 * ไอคอนเครื่องมือเป็น SVG path (viewBox 24×24) — วาดด้วย Path2D ลง canvas แล้วใช้เป็น texture
 * แบน ๆ ไม่ extrude; Path2D อ่านไวยากรณ์ path ของ SVG ได้ตรง ๆ เลยไม่ต้องแปลงเป็น geometry
 */
const TOOL_SVG = {
  cursor: { fill: ['M5 2 L5 18 L9 14.5 L11.6 20.6 L14.2 19.4 L11.6 13.5 L16.3 13.5 Z'] },
  frame: { stroke: ['M7 4v16', 'M17 4v16', 'M4 7h16', 'M4 17h16'] },
  rect: {
    stroke: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2z'],
  },
  spline: {
    stroke: ['M6 18a12 12 0 0 1 12 -12', 'M3.6 15.6h4.8v4.8h-4.8z', 'M15.6 3.6h4.8v4.8h-4.8z'],
  },
  text: { stroke: ['M4 6h9', 'M8.5 6v13', 'M14 11h6', 'M17 11v8'] },
  comment: { stroke: ['M8 19l-4 2v-4a7 6 0 1 1 4 2z'] },
  // สลับ design/dev — ไอคอนวงเล็บโค้ดแบบเดียวกับปุ่ม "dev mode" ของ Figma
  code: { stroke: ['M9 7l-5 5l5 5', 'M15 7l5 5l-5 5'] },
}

const iconTexCache = new Map()

function iconTexture(type) {
  if (iconTexCache.has(type)) return iconTexCache.get(type)
  const spec = TOOL_SVG[type] ?? TOOL_SVG.comment
  const SIZE = 256
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  const ctx = c.getContext('2d', { willReadFrequently: true })

  const draw = (dx = 0, dy = 0) => {
    ctx.save()
    ctx.scale(SIZE / 24, SIZE / 24)
    ctx.translate(dx, dy)
    ctx.strokeStyle = '#FFFFFF'
    ctx.fillStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const d of spec.fill ?? []) ctx.fill(new Path2D(d))
    for (const d of spec.stroke ?? []) ctx.stroke(new Path2D(d))
    ctx.restore()
  }

  // จัดกึ่งกลางจากพิกเซลจริง ไม่ใช่จาก viewBox — path ที่วาดไม่เต็มกรอบ 24×24
  // (เช่นลูกศร cursor) จะได้ไม่เยื้องไปมุมใดมุมหนึ่ง และ path ใหม่ก็ไม่ต้องมานั่งเล็งเอง
  draw()
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE)
  let x0 = SIZE
  let y0 = SIZE
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (data[(y * SIZE + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 >= x0) {
    const k = 24 / SIZE
    ctx.clearRect(0, 0, SIZE, SIZE)
    draw(((SIZE - 1 - x1 - x0) / 2) * k, ((SIZE - 1 - y1 - y0) / 2) * k)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  iconTexCache.set(type, tex)
  return tex
}

/** ไอคอนเครื่องมือ — แผ่นแบนติด texture จาก SVG path (ไม่ extrude) */
function ToolIcon({ type, size = 0.46 }) {
  const tex = useMemo(() => iconTexture(type), [type])
  return (
    // ปิด raycast — ไม่งั้นเมาส์ข้ามจากตัวปุ่มมาโดนไอคอนจะยิง pointerout/over สลับกันรัว hover กระตุก
    <mesh raycast={() => null}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        map={tex}
        transparent
        depthWrite={false}
        roughness={0.6}
        metalness={0}
      />
    </mesh>
  )
}

/**
 * ค่าทรงของ toolbar ทั้งหมดรวมไว้ที่เดียว — หน้า /joespresso/toolbar เอาไปขับด้วย leva
 * เพื่อปั้นทรงสด ๆ แล้ว copy ค่ากลับมาแปะทับตรงนี้
 */
export const TOOLBAR_DEFAULTS = {
  // กว้างพอสำหรับปุ่ม 6 ช่อง (เครื่องมือ 5 + สลับโหมด 1) เว้นขอบข้างละ 0.42 เท่าเดิม
  bodyW: 4.04,
  bodyH: 1.0,
  bodyRadius: 0.3,
  bodyDepth: 0.2,
  bodyBevel: 0.03,
  tileSize: 0.46,
  tileRadius: 0.11,
  tileDepth: 0.09,
  tileBevel: 0.015,
  tileLift: 0, // 0 = ปุ่มแนบผิวแท่ง (นับต่อจากผิวหน้า ไม่ใช่จากแกนกลาง)
  tileGap: 0.64,
  tileStart: -1.6,
  hoverScale: 1.14,
  pressDepth: 0.4, // สัดส่วนของความนูนปุ่มที่จมลงตอนกด — 1 = จมมิดหายเข้าไปในแท่ง
  bendR: 80,
  bodyColor: '#2c2c2c',
  tileColor: '#2c2c2c', // ปุ่มปกติกลืนกับแท่ง เห็นเฉพาะตัวที่เลือก แบบ toolbar ของ Figma จริง
  activeColor: '#0c8ce9',
}

/** ปุ่มเครื่องมือ — แท่นนูน extrude บนผิวโค้ง hover เด้ง คลิกเลือก */
function ToolTile({ x, type, active, onClick, R = 6, p = TOOLBAR_DEFAULTS }) {
  const ref = useRef()
  const press = useRef()
  const hovered = useRef(false)
  const pressed = useRef(false)
  const tileGeo = useMemo(
    () =>
      new THREE.ExtrudeGeometry(roundedRectShape(p.tileSize, p.tileSize, p.tileRadius), {
        depth: p.tileDepth,
        bevelEnabled: true,
        bevelSize: p.tileBevel,
        bevelThickness: p.tileBevel,
        bevelSegments: 2,
        curveSegments: 10,
      }),
    [p.tileSize, p.tileRadius, p.tileDepth, p.tileBevel],
  )
  useDisposable(tileGeo)
  const a = x / R
  // วางบนผิวหน้าของแท่ง toolbar ตาม normal ของทรงกระบอก
  // ผิวหน้าแท่งอยู่ที่ bodyDepth/2 (ExtrudeGeometry ถูก translate ให้กึ่งกลางอยู่ที่ z=0)
  // tileLift จึงนับต่อจากผิวนั้น — 0 = แนบสนิท และแนบอยู่เองแม้เปลี่ยนความหนาแท่ง
  const lift = p.bodyDepth / 2 + p.tileLift

  useFrame((_, delta) => {
    if (!ref.current) return
    // damp() คิดตามเวลาจริง — ของเดิมบวกเป็นสัดส่วนต่อเฟรม ทำให้ความเร็วคืนตัวแกว่งตาม framerate
    // และกระโดดวูบเดียวเวลาสลับ tab กลับมา (delta ก้อนใหญ่); clamp delta กันเคสนั้นอีกชั้น
    const dt = Math.min(delta, 0.05)

    // ขยายเฉพาะตอน hover — ถ้ารวม active ด้วย ปุ่มที่เลือกอยู่จะใหญ่กว่าเพื่อนค้างตลอด
    const s = hovered.current ? p.hoverScale : 1
    ref.current.scale.x = THREE.MathUtils.damp(ref.current.scale.x, s, 12, dt)
    ref.current.scale.y = THREE.MathUtils.damp(ref.current.scale.y, s, 12, dt)

    if (press.current) {
      // จมลงตามแนว normal (local z) แค่สัดส่วนหนึ่งของความนูน — ตอนนี้ปุ่มแนบผิวแท่งแล้ว
      // ถ้าจมเต็ม tileDepth ตัวปุ่มจะมุดหายเข้าไปในแท่งทั้งอัน
      const sink = p.tileDepth * p.pressDepth
      const target = pressed.current ? -sink : active ? -sink * 0.45 : 0
      press.current.position.z = THREE.MathUtils.damp(
        press.current.position.z,
        target,
        pressed.current ? 26 : 15,
        dt,
      )
    }
  })

  return (
    <group
      ref={ref}
      position={[R * Math.sin(a) - lift * Math.sin(a), 0, R * (1 - Math.cos(a)) + lift * Math.cos(a)]}
      rotation={[0, -a, 0]}
      onPointerOver={(e) => {
        e.stopPropagation()
        hovered.current = true
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        hovered.current = false
        pressed.current = false
        document.body.style.cursor = ''
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        pressed.current = true
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        pressed.current = false
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <group ref={press}>
        <mesh geometry={tileGeo}>
          {/* ปุ่มที่เลือกอยู่เรืองแสงในตัว ไม่ได้อาศัยไฟฉาก — พอสลับเป็นโหมด dev ไฟหรี่ลงเหลือ
              หนึ่งในสาม สีน้ำเงิน/เขียวของปุ่ม active จะจมมืดจนดูไม่ออกว่าอันไหนถูกเลือก */}
          <meshStandardMaterial
            color={active ? p.activeColor : p.tileColor}
            emissive={active ? p.activeColor : '#000000'}
            emissiveIntensity={active ? 0.6 : 0}
            roughness={0.5}
            metalness={0}
          />
        </mesh>
        {/* ไอคอนแบน วางแนบผิวบนของปุ่ม (ผิวบน = ความนูน + ลบเหลี่ยม) เผื่อ 0.004 กัน z-fighting */}
        <group position={[0, 0, p.tileDepth + p.tileBevel + 0.004]}>
          <ToolIcon type={type} size={p.tileSize} />
        </group>
      </group>
    </group>
  )
}

const TOOLS = ['cursor', 'frame', 'rect', 'spline', 'text']

/** สีปุ่มโหมด dev ตอนเปิด — เขียวของ Figma dev mode ไม่ใช่ฟ้าของเครื่องมือ คนละหน้าที่กัน */
const DEV_COLOR = '#14AE5C'

/** toolbar ลอยแบบ Figma — แท่งเข้ม extrude โค้ง + ปุ่มเครื่องมือกดได้ */
export function FigmaToolbar({ position, rotation = [0, 0, 0], R, params }) {
  const ref = useRef()
  const [active, setActive] = useState(0)
  const dev = useDevMode()
  const p = useMemo(() => ({ ...TOOLBAR_DEFAULTS, ...params }), [params])
  const bend = R ?? p.bendR

  const bodyGeo = useMemo(() => {
    const g = roundedSlabGeometry({
      w: p.bodyW,
      h: p.bodyH,
      r: p.bodyRadius,
      depth: p.bodyDepth,
      bevel: p.bodyBevel,
      segX: Math.max(16, Math.round(p.bodyW * 20)),
    })
    return bendGeometry(g, bend)
  }, [p.bodyW, p.bodyH, p.bodyRadius, p.bodyDepth, p.bodyBevel, bend])
  useDisposable(bodyGeo)

  return (
    <group ref={ref} position={position} rotation={rotation}>
      <mesh geometry={bodyGeo} castShadow>
        <meshStandardMaterial color={p.bodyColor} roughness={0.45} metalness={0} />
      </mesh>
      {TOOLS.map((t, i) => (
        <ToolTile
          key={t}
          x={p.tileStart + i * p.tileGap}
          type={t}
          active={active === i}
          onClick={() => {
            setActive(i)
            // แชร์ให้ CurvedPanel รู้ว่าโหมดลากเปิดอยู่ไหม (cursor เท่านั้นที่ลากได้)
            toolState.tool = TOOLS[i]
          }}
          R={bend}
          p={p}
        />
      ))}
      {/*
        ปุ่มสลับ design/dev — ไม่ได้อยู่ในกลุ่มเดียวกับเครื่องมือ
        เครื่องมือเป็น radio (เลือกได้ทีละอัน) ส่วนอันนี้เป็นสวิตช์ค้าง สถานะมาจาก modeState
        ไม่ใช่จาก active ของ toolbar — โหมดเป็นของทั้งฉาก ไม่ใช่ของ toolbar
      */}
      <ToolTile
        x={p.tileStart + TOOLS.length * p.tileGap}
        type="code"
        active={dev}
        onClick={toggleDevMode}
        R={bend}
        p={{ ...p, activeColor: DEV_COLOR }}
      />
    </group>
  )
}

/**
 * พา UI ชิ้นหนึ่งเลื่อนเข้ามาในฉากระหว่างกล้องแพนถอย (บีต pull)
 *
 * ตอน close-up ฉากมีแต่ตัวละคร พอกล้องถอยออกมาแล้วเจอ panel วางรออยู่ครบทุกใบ มันอ่านเป็น
 * "ฉากนิ่ง ๆ ที่กล้องบังไว้" ให้ของไหลเข้ามาระหว่างกล้องกำลังเคลื่อน โลกจะดูกำลังประกอบตัวเอง
 *
 * เลื่อนอย่างเดียว ไม่ fade — การจางต้องแตะ opacity ของ material ซึ่งโหมดปั้นใช้ก้อนเดียว
 * ทั้งฉาก (แตะแล้วฉากหายทั้งใบ เคยเจอมาแล้ว ดูคอมเมนต์ใน CropRig) การเคลื่อนที่อ่านออกอยู่แล้ว
 *
 * offset = ระยะที่ "เริ่มต้น" ห่างจากที่ของมัน (พิกัดในกลุ่ม panel) ให้พ้นเฟรมไปเลย
 * delay/span = ช่วงของบีต pull ที่ชิ้นนี้ใช้ ทยอยกันไม่ให้เข้าพร้อมกันทั้งแผง
 */
/**
 * ทรงเรขาลอย ๆ + ปุ่มลอย แทนแผงสีส้มใบเดิมที่ฝั่งซ้าย
 *
 * แผงเดิมเป็นสี่เหลี่ยมทึบใบใหญ่ อ่านเป็น "กล่อง" มากกว่าเป็นชิ้นส่วนของงานออกแบบ
 * ชุดนี้เล่าเรื่องเดียวกับ toolbar/crop frame ที่มีอยู่แล้ว — ของในโปรแกรมออกแบบที่ลอยอยู่รอบตัว
 *
 * ทุกชิ้นลอยด้วยนาฬิกาเดียวกัน ต่างกันแค่ phase — ไม่มี state ไม่มี timer
 * แอมพลิจูดคิดเป็นหน่วยฉาก และคาบเป็นวินาที จังหวะจึงเท่ากันทุก framerate
 */
const FLOATIES = [
  // [x, y, z] รอบจุดยึด, ชนิดทรง, สี, ขนาด, phase, คาบลอย (วินาที)
  // กระจายทั่วครึ่งซ้ายของเฟรม ไม่ใช่กองรวมเป็นกระจุก — ตั้งใจให้ระยะห่าง/ความลึกไม่เท่ากัน
  // ชิ้นใหญ่อยู่หน้า ชิ้นเล็กถอยหลัง สายตาจึงอ่านเป็นของลอยในอากาศจริง ไม่ใช่สติกเกอร์แปะระนาบเดียว
  // สี่ชิ้นพอ — เยอะกว่านี้แย่งสายตากับ toolbar/แผงข้อมูลที่เป็นเนื้อเรื่องจริงของฉาก
  // ม่วงกับกล่องเหลืองสลับที่กัน (ตำแหน่งเท่านั้น ขนาด/จังหวะลอยยังติดไปกับทรงเดิม)
  [[-3.6, -2.4, 0.4], 'ico', '#7C5CFC', 1.15, 0.0, 5.2],
  [[2.6, 1.6, -1.2], 'torus', '#14AE5C', 1.0, 1.7, 6.4],
  [[-2.4, 0.4, 1.2], 'box', '#F5C33B', 1.1, 3.1, 4.6],
  [[3.4, -1.2, 0.6], 'sphere', '#F2A0C0', 0.95, 2.3, 5.9],
]

/** ทรงโครงลวด — เส้นขอบล้วน ไม่มีผิว ตัดกับชิ้นทึบให้ภาพไม่ตันไปทั้งกลุ่ม */
const WIRES = [
  // สีเข้มพอจะเห็นบนพื้นฟ้า/ทรายอ่อน — ขาวล้วนจมหายไปกับพื้นหลัง
  // เหลือใบเดียว: กรอบเส้นสองใบซ้อนกันอ่านเป็นเส้นยุ่ง ไม่ใช่ทรง
  [[-0.6, -0.9, 2.2], 'box', '#5A5B7A', 1.7, 1.2, 7.4],
]

function FloatShape({ position, geometry, color, size, phase, period, spin, wire = false }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const node = ref.current
    if (!node) return
    const t = clock.elapsedTime
    // ลอยขึ้นลงรอบตำแหน่งตั้งต้น — amp คงที่ในหน่วยฉาก ไม่ผูกกับ framerate
    node.position.y = position[1] + Math.sin((t / period) * Math.PI * 2 + phase) * 0.16
    node.rotation.x = phase + t * spin * 0.6
    node.rotation.y = phase * 1.7 + t * spin
  })
  if (wire) {
    return (
      <lineSegments ref={ref} position={position} geometry={geometry} scale={size}>
        <lineBasicMaterial color={color} transparent opacity={0.75} toneMapped={false} />
      </lineSegments>
    )
  }
  return (
    <mesh ref={ref} position={position} geometry={geometry} scale={size}>
      <meshStandardMaterial color={color} roughness={0.42} metalness={0.05} />
    </mesh>
  )
}

/**
 * ปุ่มลอย: แผ่นมนหนา ๆ กับแถบสองเส้นบนหน้าปุ่ม
 *
 * เป็นของประกอบฉาก ไม่ใช่ปุ่มจริง — จึงไม่รับเมาส์และไม่เปลี่ยน cursor
 * (กติกาในโปรเจกต์: อะไรที่กดได้ต้องเป็น pointer ของที่กดไม่ได้ก็ต้องไม่หลอกว่ากดได้)
 */
function FloatButton({ position, rotation, color, phase }) {
  const ref = useRef()
  const slab = useMemo(
    () => roundedSlabGeometry({ w: 2.9, h: 1.0, r: 0.5, depth: 0.3, bevel: 0.06 }),
    [],
  )
  useDisposable(slab)
  useFrame(({ clock }) => {
    const node = ref.current
    if (!node) return
    const t = clock.elapsedTime
    node.position.y = position[1] + Math.sin((t / 5.8) * Math.PI * 2 + phase) * 0.13
    // เอียงสลับซ้ายขวาช้า ๆ ให้รู้ว่ามันลอย ไม่ใช่แปะติดกับจอ
    node.rotation.z = rotation[2] + Math.sin((t / 9) * Math.PI * 2 + phase) * 0.06
  })
  return (
    <group ref={ref} position={position} rotation={rotation}>
      <mesh geometry={slab}>
        <meshStandardMaterial color={color} roughness={0.38} metalness={0.04} />
      </mesh>
      {/* แถบบนหน้าปุ่ม — ภาษาเดียวกับ rows ของ CurvedPanel ใบอื่น ไม่ใส่ข้อความปลอม */}
      <mesh position={[-0.3, 0, 0.17]}>
        <planeGeometry args={[1.2, 0.19]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={[0.88, 0, 0.17]}>
        <circleGeometry args={[0.145, 24]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.7} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** กลุ่มของลอยทั้งชุด — geometry ปั้นครั้งเดียวแล้วใช้ร่วมกันทุกชิ้นที่ทรงเดียวกัน */
function Floaties({ position, rotation = [0, 0, 0] }) {
  const geos = useMemo(
    () => ({
      ico: new THREE.IcosahedronGeometry(1, 0),
      torus: new THREE.TorusGeometry(0.8, 0.3, 16, 40),
      box: new RoundedBoxGeometry(1.3, 1.3, 1.3, 3, 0.22),
      capsule: new THREE.CapsuleGeometry(0.42, 0.9, 6, 16),
      sphere: new THREE.SphereGeometry(0.8, 32, 24),
      knot: new THREE.TorusKnotGeometry(0.62, 0.22, 96, 16),
    }),
    [],
  )
  // โครงลวด: EdgesGeometry ให้เฉพาะสันจริง ไม่ใช่ wireframe ที่โชว์เส้นแบ่งสามเหลี่ยมทุกเส้น
  const wires = useMemo(
    () => ({
      box: new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      ico: new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 0)),
    }),
    [],
  )
  for (const g of Object.values(geos)) useDisposable(g)
  for (const g of Object.values(wires)) useDisposable(g)
  return (
    <group position={position} rotation={rotation}>
      {FLOATIES.map(([p, kind, color, size, phase, period], i) => (
        <FloatShape
          key={`s${i}`}
          position={p}
          geometry={geos[kind]}
          color={color}
          size={size}
          phase={phase}
          period={period}
          spin={0.18}
        />
      ))}
      {WIRES.map(([p, kind, color, size, phase, period], i) => (
        <FloatShape
          key={`w${i}`}
          position={p}
          geometry={wires[kind]}
          color={color}
          size={size}
          phase={phase}
          period={period}
          spin={0.12}
          wire
        />
      ))}
      <FloatButton position={[0.6, -0.4, 2.6]} rotation={[0, 0, -0.05]} color="#14AE5C" phase={2.2} />
    </group>
  )
}

function UiEnter({ offset, delay = 0, span = 0.55, children }) {
  const g = useRef()
  useFrame(() => {
    const node = g.current
    if (!node) return
    /**
     * ยังไม่เคยเล่น intro / เล่นจบแล้ว = อยู่ที่ของมันเลย (1) ไม่ใช่ 0
     * เข้าหน้านี้ตรง ๆ โดยไม่ผ่านสปแลช intro ไม่เดิน ถ้าใช้ 0 แผง UI จะค้างอยู่นอกจอถาวร
     *
     * ไทม์ไลน์อิงวินาทีของ intro ตรง ๆ ไม่อิงบีต pull เหมือนเดิม:
     * เริ่มตอนกล้องหันมาได้ครึ่งทาง (กลางบีต pull = 4.95s) แล้วลากยาวถึง 9.4s
     * (เข้าไปในบีต title) — ช้ากว่าเดิมและจบทีหลัง แผงยังทยอยลอยเข้าตอนสโลแกนเริ่มขึ้น
     */
    const p = introState.playing
      ? Math.min(1, Math.max(0, (introState.t - 4.95) / (9.4 - 4.95)))
      : 1
    // กันชิ้นท้าย ๆ วิ่งไม่จบ: delay + span ต้องไม่เกินความยาวบีต
    const sp = Math.min(span, 1 - delay)
    const k = Math.min(1, Math.max(0, (p - delay) / sp))
    // ออกตัวเร็วแล้วค่อย ๆ เข้าจอด — ของที่ "ไถลมาหยุด" อ่านเป็นของมีน้ำหนัก
    const e = 1 - Math.pow(1 - k, 3)
    /**
     * บินเข้าตามแกน x ของ "จอโค้ง" ใบเดียวกับที่ panel วางอยู่ — ไม่ใช่สไลด์เส้นตรง
     *
     * ทางเดินคือการกวาดรอบแกนตั้งที่ผ่านตา (CAM0 — จุดเดียวกับที่ curveOnScreen ใช้ม้วนจอ):
     * หมุนทั้งกลุ่มรอบ pivot นั้น panel จึงไถลมาตามผิวทรงกระบอกของจอพอดีเป๊ะ
     * และหน้าแผ่นหันตาม tangent ของ curve เองตลอดทาง ไม่ต้องสั่งหมุนแยก
     *
     * ระยะ x เดิมของ offset ถูกตีความเป็นความยาวส่วนโค้ง (หาร ~รัศมีจอ) — เครื่องหมาย
     * กลับด้านเพราะหมุนกลุ่มไปทางบวกพาของใน "หน้าจอ" ไปทางลบ
     */
    const a = (-offset[0] / 10) * (1 - e)
    const ex = CAM0[0]
    const ez = CAM0[2]
    node.rotation.y = a
    const c = Math.cos(a)
    const sn = Math.sin(a)
    // หมุนรอบจุดที่ไม่ใช่ origin: pos = pivot - R_y(a) * pivot
    node.position.set(ex - (c * ex + sn * ez), 0, ez - (-sn * ex + c * ez))
  })
  return <group ref={g}>{children}</group>
}

/**
 * พาการ์ดออกจากทางตอน scroll เข้าฉากที่สอง
 *
 * การ์ดฝ้าใบนี้อยู่หน้าสุด (หน้าพุ่มไม้) ซึ่งดีตอนอยู่นิ่ง ๆ ในฉากแรก แต่พอบีต focus พากล้อง
 * วนเข้าไปหาตัวละคร มันกลายเป็นแผ่นบังหน้าเต็ม ๆ — ของที่อยู่ใกล้กล้องที่สุดย่อมบังก่อนเพื่อน
 *
 * ไล่ออกสองทางพร้อมกัน: เลื่อนออกนอกเฟรมทางขวา และจางหายไป อย่างใดอย่างเดียวไม่พอ —
 * เลื่อนอย่างเดียวยังโผล่ที่มุมภาพตอนกล้องหันไปทางอื่น จางอย่างเดียวยังทิ้งเงา/ไฮไลต์ค้างไว้
 */
function ScrollExit({ children }) {
  const g = useRef()
  useFrame(() => {
    const node = g.current
    if (!node) return
    const t = scrollState.b.focus
    const k = t * t * (3 - 2 * t)
    node.position.set(6 * k, -0.6 * k, 0)
    node.traverse((o) => {
      if (!o.isMesh || !o.material) return
      /**
       * โคลน material ก่อนแตะ opacity เสมอ — โหมดปั้นสลับทุก mesh ไปใช้ก้อนเทาก้อนเดียวทั้งฉาก
       * ลด opacity ตรง ๆ แล้วฉากหายทั้งใบ (เคยเจอมาแล้วกับการ์ดของ crop tool)
       */
      if (!o.userData.exitOwn) {
        o.material = o.material.clone()
        o.userData.exitOwn = true
        o.userData.keepColor = true
        o.userData.baseOpacity = o.material.opacity ?? 1
      }
      const m = o.material
      m.transparent = true
      m.opacity = o.userData.baseOpacity * (1 - k)
      o.visible = m.opacity > 0.003
    })
  })
  return <group ref={g}>{children}</group>
}

/**
 * ขับ crop tool ตามไทม์ไลน์ intro + รายงานพิกัดโลกให้คนอื่นเล็ง
 *
 * กรอบถูกวางไว้ในกลุ่มที่ถูกสเกลรอบจุดกล้อง (depth) พิกัดที่เขียนใน JSX จึงไม่ใช่พิกัดโลก
 * ใครจะเล็งกรอบนี้ (หัว mascot, แขนที่ชี้) ต้องได้ค่าที่ผ่านการแปลงแล้วเท่านั้น จึงอ่านจาก
 * matrix จริงของกลุ่มทุกเฟรม ไม่ใช่คำนวณซ้ำจากตัวเลขใน JSX
 *
 * ตัวกรอบ bake ตำแหน่งลง vertex ไปแล้ว (curveOnScreen) — ขยับด้วย position ของกลุ่มที่ครอบ
 * และย่อด้วย scale รอบ "จุดกึ่งกลางกรอบ" ไม่ใช่รอบจุดกำเนิด ไม่งั้นย่อแล้วกรอบจะไหลออกนอกจอ
 */
function CropRig({ from, box, children }) {
  const g = useRef()
  const centre = useMemo(() => new THREE.Vector3(...from), [from])

  /**
   * ปลายทางตอนหด = กล่องจริงของสโลแกนในฉาก
   *
   * ทั้งกรอบและสโลแกนอยู่ในสเปซเดียวกันแล้ว (ลูกของกลุ่ม panel เหมือนกัน) เลยคิดตรง ๆ ได้
   * ไม่ต้องยิงรังสีจากกล้องผ่านกล่องข้อความ DOM กลับเข้าฉากแบบเดิม ซึ่งพังทุกครั้งที่
   * ระนาบอ้างอิงหรือความโค้งของกรอบเปลี่ยน
   */
  const solveTitle = () => {
    const sl = introState.slogan
    if (!sl || sl.size.x < 1e-4) return null
    // เผื่อขอบรอบคำเป็นระยะคงที่ ไม่ใช่สัดส่วน — คำสั้นคำยาวจะได้ขอบเท่ากัน อ่านเป็นกรอบเดียวกัน
    return {
      w: sl.size.x + CROP_PAD[0] * 2,
      h: sl.size.y + CROP_PAD[1] * 2,
      at: [sl.centre.x, sl.centre.y],
    }
  }

  useFrame((_, delta) => {
    const node = g.current
    if (!node) return
    const dt = Math.min(delta, 0.05)
    const move = introState.playing || introState.done ? introState.b.crop : 0
    const k = move * move * (3 - 2 * move)
    // ปลายทาง = กลางจอเมื่อมองจากกล้องท่าสุดท้าย (คิดไว้ที่ CROP_TO ในสเปซเดียวกับ from)
    TMP_A.set(
      lerp(from[0], CROP_TO[0], k),
      lerp(from[1], CROP_TO[1], k),
      lerp(from[2], CROP_TO[2], k),
    ).sub(centre)
    // บีต title: หดลงมาครอบคำว่า vision — ขนาดปลายทางคิดจากกล่องคำจริงในฉาก
    if (introState.b.title > 0) {
      const t = solveTitle()
      if (t) introState.title = t
    }
    const shrink = introState.title ?? null
    const kt = shrink ? easeIO(introState.b.title) : 0
    if (shrink) {
      TMP_A.x = lerp(TMP_A.x, shrink.at[0] - centre.x, kt)
      TMP_A.y = lerp(TMP_A.y, shrink.at[1] - centre.y, kt)
    }
    // หน่วงอีกชั้นให้ลื่น — ค่าบีตเป็นเส้นตรง ถ้าเอาไปใช้ตรง ๆ จะเห็นหัวท้ายแข็ง
    const a = 1 - Math.exp(-dt / 0.12)
    node.position.lerp(TMP_A, a)

    /**
     * ขนาดกรอบเป็น "ค่าที่ส่งให้ CropFrame ไปสร้างใหม่" ไม่ใช่ scale ของกลุ่ม
     *
     * เคยย่อด้วย node.scale.set(sx, sy, 1) ซึ่งย่อไม่เท่ากันสองแกน ผลคือเส้นขอบบน/ล่างบางกว่า
     * เส้นซ้าย/ขวา และจุดจับ 4 มุมจากสี่เหลี่ยมจัตุรัสกลายเป็นแท่งแบน ยิ่งกรอบเล็กยิ่งเพี้ยน
     * (เห็นชัดมากตอนกรอบหดลงไปครอบแค่คำเดียว) ส่งขนาดไปให้วาดใหม่ เส้นหนาเท่าเดิมทุกขนาด
     */
    const b = box.current
    b.w += (lerp(CROP_W, shrink ? shrink.w : CROP_W, kt) - b.w) * a
    b.h += (lerp(CROP_H, shrink ? shrink.h : CROP_H, kt) - b.h) * a
    b.cx = node.position.x + centre.x
    b.cy = node.position.y + centre.y
    b.cz = node.position.z + centre.z
    // เอียงระนาบกรอบเข้าหาท่าส่ายของสโลแกนตามจังหวะที่หดเข้าไปครอบ — ปลายทางคือนอนระนาบเดียวกับคำ
    b.q.identity()
    if (introState.slogan?.quat) b.q.slerp(introState.slogan.quat, kt)

    /**
     * ตอนกรอบหดไปครอบสโลแกน การ์ดที่ลากมาด้วยต้องจางหายไป
     *
     * ปลายทางตามแบบคือเหลือแค่กรอบรอบข้อความ ถ้าปล่อยการ์ดไว้มันจะกลายเป็นแผ่นสีทับตัวหนังสือ
     * เว้นตัวกรอบเอง (userData.cropFrame) ไว้ ไม่งั้นเครื่องมือหายไปทั้งชุด
     */
    const fade = 1 - easeIO(introState.b.title)
    node.traverse((o) => {
      if (!o.isMesh || o.userData.cropFrame) return
      /**
       * ต้องโคลน material ก่อนแตะ opacity เสมอ
       *
       * โหมดปั้นสลับทุก mesh ไปใช้ material ดินเทา "ก้อนเดียวกันทั้งฉาก" — ลด opacity ตรง ๆ
       * แล้วทั้งฉากจางหายพร้อมกัน (เจอมาแล้ว: เหลือแต่หัวกับตัวหนังสือลอยอยู่บนจอเปล่า)
       * ติด keepColor ไว้ด้วย ClayMode จะได้ไม่วนกลับมาทับ material ที่โคลนไว้ทุกครึ่งวินาที
       */
      if (!o.userData.fadeOwn) {
        o.material = o.material.clone()
        o.userData.fadeOwn = true
        o.userData.keepColor = true
        o.userData.baseOpacity = o.material.opacity ?? 1
        /**
         * การ์ดใบนี้ต้องไม่เขียน depth
         *
         * มันหมุนรอบแกน Y อยู่ 0.22 rad ครึ่งซ้ายจึงอยู่ "ใกล้กล้องกว่า" ระนาบสโลแกน ทั้งที่
         * จุดกึ่งกลางลึกกว่า พอเขียน depth ตัวหนังสือครึ่งซ้ายหายไปเป็นรอยตัดตรงแนวที่ระนาบ
         * สองใบตัดกัน เห็นชัดสุดในโหมดปั้น ซึ่งสลับการ์ดไปใช้ material ทึบที่เขียน depth เต็ม ๆ
         * ตั้งตรงนี้เพราะเป็นที่เดียวที่ถือ material ของการ์ดจริง ๆ ไม่ว่าโหมดไหนก็ผ่านทางนี้
         */
        o.material.depthWrite = false
      }
      const m = o.material
      m.opacity = o.userData.baseOpacity * fade
      m.transparent = true
      o.visible = m.opacity > 0.002
    })

    if (!introState.crop) introState.crop = new THREE.Vector3()
    // จุดที่แขนต้องเล็งคือ "กลางกรอบ" ไม่ใช่จุดกำเนิดของกลุ่ม (geometry ของการ์ด bake ไว้ที่ centre)
    introState.crop.set(b.cx, b.cy, b.cz)
    node.parent.localToWorld(introState.crop)
  })

  return <group ref={g}>{children}</group>
}

/** เส้นกรอบหนาเท่านี้ และจุดจับมุมเป็นจัตุรัสด้านละเท่านี้ — คงที่ทุกขนาดกรอบ */
const CROP_LINE = 0.035
const CROP_HANDLE = 0.22
/** ขนาดกรอบตอนยังไม่หด (เท่าการ์ดที่มันเลือกอยู่) */
const CROP_W = 3.7
const CROP_H = 2.3
/** เผื่อขอบรอบคำตอนหดไปครอบ — ระยะคงที่ ไม่ใช่สัดส่วน */
const CROP_PAD = [0.16, 0.13]

/**
 * กรอบ crop tool — สร้างใหม่ตามขนาดที่ส่งมาทุกเฟรม ไม่ใช่ geometry ก้อนเดียวที่ถูกสเกล
 *
 * เส้น 4 ด้านเป็นระนาบ 1x1 ที่ยืดด้วย scale ทีละแกน: ด้านยาวยืดตามกรอบ ด้านหนาคงที่เสมอ
 * จุดจับ 4 มุมไม่ถูกยืดเลย แค่ย้ายไปมุมใหม่ ผลคือกรอบหน้าตาเหมือนเดิมไม่ว่าจะใหญ่เท่าการ์ด
 * หรือเล็กเท่าคำเดียว — ต่างจากการสเกลทั้งก้อนซึ่งบีบเส้นและจุดจับไปด้วย
 *
 * material ก้อนเดียวใช้ร่วมกันทั้ง 8 ชิ้น (เปลี่ยนสีทีเดียวติดทั้งกรอบ)
 */
function CropFrame({ box, color = '#7C5CFC' }) {
  const g = useRef()
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide }),
    [color],
  )
  useDisposable(mat)

  useFrame(() => {
    const node = g.current
    const b = box.current
    if (!node || !b || b.w < 1e-4) return
    node.position.set(b.cx, b.cy, b.cz)
    if (b.q) node.quaternion.copy(b.q)
    const hw = b.w / 2
    const hh = b.h / 2
    const [top, bottom, left, right, ...handles] = node.children
    top.position.set(0, hh, 0)
    top.scale.set(b.w, CROP_LINE, 1)
    bottom.position.set(0, -hh, 0)
    bottom.scale.set(b.w, CROP_LINE, 1)
    left.position.set(-hw, 0, 0)
    left.scale.set(CROP_LINE, b.h, 1)
    right.position.set(hw, 0, 0)
    right.scale.set(CROP_LINE, b.h, 1)
    handles.forEach((m, i) => {
      m.position.set(i % 2 ? hw : -hw, i < 2 ? hh : -hh, 0)
      m.scale.setScalar(CROP_HANDLE)
    })
  })

  /**
   * เคยวาดกรอบทับทุกอย่าง (ปิด depth test) เพราะกลัวขาดตอนวิ่งผ่านตัวละคร แต่ผลคือเส้นม่วง
   * ลอยพาดหน้า mascot เหมือน UI แปะจอ ปล่อยให้ depth test ตามปกติ กรอบอยู่ลึกกว่าก็ถูกบังจริง
   *
   * cropFrame: บอก CropRig ว่าอย่าจางตัวนี้ตอนบีต title
   * keepColor: เครื่องมือไม่ใช่ "ทรง" ที่ต้องปั้น โหมดปั้นทาเทาแล้วกรอบจมหายไปกับฉาก
   */
  return (
    <group ref={g}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} material={mat} userData={{ cropFrame: true, keepColor: true }}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </group>
  )
}

/** ตำแหน่งกล้องตั้งต้น — ใช้เป็นจุดศูนย์กลางในการดันชั้น panel ให้ลึกขึ้น */
const CAM0 = [0, 4.1, 14.5]

// เลื่อนเข้ามาจาก -5.5 หลังจาก toolbar กว้างขึ้นเพราะปุ่มที่หก — ของเดิมปลายซ้ายหลุดขอบจอ
const TOOLBAR_POS = [-4.55, 1.4, -2.2]

/** ที่อยู่ตั้งต้นของ crop tool (สเปซในกลุ่ม panel) */
const CROP_FROM = [-5.0, 2.3, -3.45]
/**
 * ปลายทางกลางจอ — คิดจากรังสีกล้องท่าสุดท้าย ไม่ได้กะ
 *
 * กล้องอยู่ที่ CAM0 มองไปที่ (0, lookY, 0) จุดบนรังสีนั้นที่ระดับความลึกเดิมของกรอบ
 * (z = -3.45 ในสเปซนี้) คือ y = 1.38 — วางตรงนี้แล้วกรอบอยู่กลางเฟรมพอดี
 *
 * ผูกกับท่ากล้อง: ขยับ camY/camZ/lookY ใน leva แล้วต้องกลับมาแก้ค่านี้ด้วย
 * t = (CAM0.z + 3.45) / CAM0.z ; y = CAM0.y + t * (lookY - CAM0.y)
 *
 * ระวังกล้องที่มองลงมาก (เคยลอง camY 7.7): กลางจอที่ระดับความลึกนี้จะตกไปอยู่ใต้สันเนิน
 * กรอบครึ่งล่างจมดินหายไปเลย ท่าแบบนั้นต้องยกค่านี้ขึ้นเหนือเส้นขอบฟ้าแทนกลางจอจริง
 */
const CROP_TO = [0, 1.38, -3.45]

/**
 * ที่อยู่ของสโลแกน — กลางบนของฉาก ช่วงฟ้าเหนือหัว mascot ที่ว่างอยู่
 * ระดับความลึกเดียวกับกรอบ crop กรอบจะได้ครอบได้พอดีโดยไม่ต้องคิดเปอร์สเปคทีฟ
 */
// eslint-disable-next-line no-unused-vars -- สโลแกนถูก comment ไว้ชั่วคราว ตำแหน่งเก็บไว้เผื่อเปิดคืน
const SLOGAN_AT = [0, 3.15, -3.45]

const TMP_A = new THREE.Vector3()
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const lerp = (a, b, t) => a + (b - a) * t

/**
 * วาง toolbar ให้แนบ "จอโค้ง" ใบเดียวกับ panel
 *
 * toolbar เป็นวัตถุ 3D มีความหนา ใช้ curveOnScreen (ที่ยุบ transform ลง vertex) ไม่ได้ตรง ๆ
 * เพราะปุ่มถูกวางด้วยสูตรวงกลมรัศมี R แยกจาก geometry ของแท่ง
 *
 * แต่ bendGeometry ม้วนรอบแกนที่อยู่ห่างจากแผ่นไป R อยู่แล้ว — ถ้าตั้ง R = ระยะจากตาถึง toolbar
 * แล้วหันหน้าแท่งเข้าหาตา แกนม้วนจะไปตกที่ตาพอดี ผิวแท่งกับปุ่มจึงนอนอยู่บนทรงกระบอกใบเดียว
 * กับ panel โดยไม่ต้องแก้โครงข้างในเลย
 *
 * k = ความโค้งจอ (0 = แบน -> R อนันต์)
 */
function toolbarOnScreen([x, y, z], k, [ex, , ez]) {
  const dx = x - ex
  const dz = z - ez
  const dist = Math.hypot(dx, dz)
  return {
    position: [x, y, z],
    // หันหน้า (+z ของแท่ง) เข้าหาตา
    rotation: [0, Math.atan2(-dx, -dz), 0],
    R: k > 0.001 ? dist / k : 1e6,
  }
}

/**
 * shiftX เลื่อนทั้งกลุ่ม panel ไปด้านข้าง "ตามส่วนโค้งของจอ" — หน้า /2026 ใช้ดันกลุ่ม
 * ไปฝั่งขวาให้ล้อกับ mascot ที่หันขวา
 * ไม่ใช่เลื่อนแนวตรง: หมุนทั้งกลุ่มรอบแกนตั้งที่ผ่านตากล้อง (สเปซเดียวกับ UiEnter)
 * ทุกใบจึงไถลไปตามผิวจอโค้งเดิม ความโค้งที่ bake ไว้ยังหันเข้าหาตาถูกทิศ
 * มุม = ระยะโค้ง / ~รัศมีจอ (10) เครื่องหมายลบ = เนื้อหาหน้ากล้องไถลไปทางขวา
 */
export function Panels({ shiftX = 0 }) {
  const arc = -shiftX / 10
  // กระจกด้าน: มี shift = องค์ประกอบหันขวา — เส้นทางเข้าของ crop ต้องกลับด้านด้วย
  const flip = shiftX > 0
  const cropFrom = useMemo(
    () => (flip ? [-CROP_FROM[0], CROP_FROM[1], CROP_FROM[2]] : CROP_FROM),
    [flip],
  )
  /**
   * พิกัด "หลังไถลตามจอโค้ง" — หมุนรอบแกนตั้งที่ตากล้อง
   *
   * ใช้เป็นตำแหน่งจริงของ panel แทนการหมุนทั้งกลุ่มทีหลัง: ความโค้ง/มุมหันถูก bake
   * จากตำแหน่งปลายทางเลย (เดิมหมุนกลุ่มหลัง bake — ผิวโค้งเลยตื้นกว่าที่ตำแหน่งใหม่ควรเป็น
   * เพราะสูตร bake คิดจาก x ก่อนหมุน) มุมหันของใบก็ต้องบวก arc ตามด้วย
   */
  const onArc = ([x, y, z]) => {
    if (!flip) return [x, y, z]
    const c = Math.cos(arc)
    const s = Math.sin(arc)
    const dx = x - CAM0[0]
    const dz = z - CAM0[2]
    return [CAM0[0] + c * dx + s * dz, y, CAM0[2] - s * dx + c * dz]
  }
  const yawArc = flip ? arc : 0
  // debugger: ความโค้งของ "จอ" ที่ panel ทุกใบวางอยู่ — 0 แบน, 1 โค้งเต็มตามระยะจริง
  // แกนโค้งอยู่ที่ตาคนดู ทุกใบจึงโค้งตามส่วนโค้งเดียวกัน ไม่ใช่ต่างคนต่างม้วน
  const { screenCurve: baseCurve } = useControls('Curve Perspective', {
    screenCurve: { value: 2.35, min: 0, max: 4, step: 0.05, label: 'ความโค้งจอ' },
  })
  // view หันขวา (/2026): มองจอโค้งจากมุมเฉียง ความโค้งเท่าเดิมอ่านตื้นกว่าตอน front view —
  // อัดเพิ่มให้ดีกรีที่ "เห็น" ใกล้เคียงกัน
  const screenCurve = flip ? baseCurve * 1.3 : baseCurve

  // เท็กซ์เจอร์ wireframe ทำครั้งเดียวต่อสัดส่วนการ์ด — อย่าให้เกิดใหม่ทุกเฟรม
  const wireframeMap = useMemo(() => wireframeTex(3.6, 2.2), [])
  useDisposable(wireframeMap)
  // debugger: ดันชั้น panel ให้ลึกเข้าไปในฉาก
  // ขยายทั้งกลุ่มรอบ "จุดกล้อง" — ระยะกับขนาดโตพร้อมกัน ภาพบนจอจึงเท่าเดิมเป๊ะ
  // แต่ตัว panel ถอยไปอยู่หลังพุ่มไม้จริง ๆ พุ่มกับสันเนินเลยบังฐาน panel ให้เอง
  // 1.25 = panel ตัวหน้าสุด z -3.2 ไปอยู่ -7.5 พอดีหลังแนวพุ่ม (พุ่มอยู่ -6.2 ถึง -3.2)
  // มากกว่านี้จะเลยไปโซนหมอก (เริ่มที่ระยะ 30) สีจะซีดลงด้วย
  const { depth } = useControls('Curve Perspective', {
    depth: { value: 1.25, min: 1, max: 3.5, step: 0.05, label: 'ความลึก panel' },
  })
  /** ขนาด + จุดกึ่งกลางของกรอบ crop ในเฟรมนี้ — CropRig เขียน CropFrame อ่าน */
  const cropBox = useRef({ w: CROP_W, h: CROP_H, cx: 0, cy: 0, cz: 0, q: new THREE.Quaternion() })
  return (
    <>
      <group position={CAM0} scale={depth}>
        <group position={[-CAM0[0], -CAM0[1], -CAM0[2]]}>
          {/* layer 02 — toolbar สไตล์ Figma: เครื่องมือกดเลือกได้
              R/rotation คำนวณให้แนบจอโค้งใบเดียวกับ panel (ดู toolbarOnScreen)
              bendR ใน TOOLBAR_DEFAULTS ใช้เฉพาะตอนปั้นที่ /joespresso/toolbar */}
          {/*
            ลำดับเข้าฉาก: crop tool เข้าก่อนใครเพราะบีต crop เริ่มตั้งแต่ pull ยังไม่ถึงครึ่ง
            (มันต้องนั่งอยู่ที่ CROP_FROM แล้วก่อนถึงคิวออกเดิน) ที่เหลือทยอยตามระหว่างกล้องถอย
            offset ผลักออกด้านที่ใกล้ขอบเฟรมที่สุดของชิ้นนั้น ทางที่สั้นที่สุดที่จะพ้นจอ
          */}
          <UiEnter offset={[-7, 0, 0]} delay={0.08}>
            <FigmaToolbar {...toolbarOnScreen(onArc(TOOLBAR_POS), screenCurve, CAM0)} />
          </UiEnter>
      {/* ซ้าย — เดิมเป็นแผงทึบสีส้มใบเดียว เปลี่ยนเป็นทรงลอย + ปุ่มลอย
          เข้าฉากด้วย UiEnter ตัวเดิม จังหวะจึงยังอยู่ในคิวเดียวกับ panel ใบอื่น */}
      <UiEnter offset={[-6, 2.2, 0]} delay={0.2}>
        <Floaties position={onArc([-5.2, 4.6, -5.6])} rotation={[0, 0.32 + yawArc, 0]} />
      </UiEnter>

      {/* ขวา */}
      <UiEnter offset={[7, 2.2, 0]} delay={0.32}>
      {/* ใบนี้คือ "งานที่กำลังทำอยู่" — จอ wireframe ที่ยังเป็นโครง มีชิ้นหนึ่งถูกเลือกค้างไว้
          โหมด flip (/2026) กรอบเป็น close-up ตัวละคร ใบนี้ที่ตำแหน่งเดิมจะโผล่แค่เสี้ยวริมซ้าย
          จนอ่านไม่ออกว่าเป็น UI — ย้ายเข้ามาในกรอบและขยับเข้าหากล้องเฉพาะโหมดนั้น
          ฉากเต็ม (/joespresso) ยังใช้ตำแหน่งเดิมทุกอย่าง */}
      <CurvedPanel
        curve={screenCurve}
        eyeZ={CAM0[2]}
        position={flip ? onArc([6.9, 3.7, -5.0]) : onArc([5.6, 4.4, -5.4])}
        rotation={[0, (flip ? -0.16 : -0.3) + yawArc, 0]}
        size={flip ? [3.2, 2.0] : [3.6, 2.2]}
        color="#FFFFFF"
        opacity={1}
        map={wireframeMap}
      />
      </UiEnter>
          {/*
            กรอบ crop ไม่โค้งตามจอเหมือน panel ใบอื่น (curve = 0)
            เพราะมันต้อง "ย้ายที่" ได้ตามไทม์ไลน์ intro — curveOnScreen ดัด vertex รอบตาโดยอิง
            ตำแหน่งตอนสร้าง พอย้ายไปที่อื่นความโค้งที่ bake ไว้จะผิดที่ กรอบบิดเป็นสี่เหลี่ยมคางหมู
            (เห็นชัดตอนมันไปครอบคำว่า vision) แบนแล้วย้าย/ย่อได้ตรงตามที่คำนวณทุกกรณี
          */}
          {/* สโลแกนอยู่ในสเปซเดียวกับกรอบ crop — กรอบจึงคิดขนาด/ตำแหน่งจากกล่องของมันได้ตรง ๆ
              โดยไม่ต้องแปลงข้ามระบบพิกัด (เมื่อก่อนอ่านกล่องจาก DOM แล้วยิงรังสีกลับเข้าฉาก) */}
          {/* ปิดสโลแกนไว้ก่อน (หน้า /2026 มีพาดหัวเดียวกันใน DOM แล้ว ซ้ำกัน)
              กรอบ crop รับมือ null ได้: introState.title ไม่ถูกเซ็ต กรอบแค่ไม่หดไปครอบคำ */}
          {/* <Slogan position={SLOGAN_AT} /> */}
          {/* crop tool ต้องเข้าที่ก่อนบีต crop เริ่ม (= 37% ของบีต pull) ไม่งั้นมันจะไถลเข้าฉาก
              พร้อมกับที่กำลังออกเดินไปกลางจอ สองการเคลื่อนที่ทับกันจนอ่านไม่ออกว่าอะไรพาไป
              (CropRig อ่านพิกัดโลกจริงทุกเฟรม การมี UiEnter คั่นจึงไม่ทำให้แขนเล็งผิด) */}
          {/* โหมด shiftX (หน้า /2026 ตัวหันขวา): crop เข้าจากขอบขวาแทนซ้าย — หัวกับแขน
              ของ mascot เล็งจากตำแหน่งจริงของกรอบ (introState.crop) จึงหัน/ชี้ขวาตาม
              ทั้ง intro ไม่ติดท่าหันซ้ายของฉากเดิม */}
          {/* ชุด crop เป็นแผ่นแบน (curve 0) — หมุนรอบตาได้ตรง ๆ ไม่มีผิวโค้งให้ผิด
              ใช้แทนการแปลงพิกัดรายจุด เพราะ CROP_TO/เส้นทางเดินอยู่ใน CropRig */}
          <group position={CAM0} rotation={[0, yawArc, 0]}>
          <group position={[-CAM0[0], -CAM0[1], -CAM0[2]]}>
          <UiEnter offset={[flip ? 7 : -7, 0, 0]} delay={0} span={0.3}>
          <CropRig from={cropFrom} box={cropBox}>
            {/* การ์ดที่ถูกกรอบเลือกอยู่ = ของชิ้นเดียวกับเครื่องมือ ต้องถูกลากไปด้วยกัน
                curve 0 เหมือนกรอบ: ทั้งคู่ย้ายที่ ความโค้งที่ bake ไว้ตอนสร้างจะผิดที่ทันที */}
            <CurvedPanel
              curve={0}
              eyeZ={CAM0[2]}
              position={[flip ? 5.0 : -5.0, 2.3, -3.6]}
              rotation={[0, flip ? -0.22 : 0.22, 0]}
              size={[3.4, 2.1]}
              color="#FFFFFF"
              opacity={0.5}
              rows={[
                { y: 0.24, w: 2.5, h: 0.5, color: '#5B4BE8', opacity: 0.9 },
                { y: -0.3, w: 2.1, h: 0.1, color: '#5B4BE8', opacity: 0.5 },
              ]}
            />
          </CropRig>
          {/* กรอบไม่ได้อยู่ในกลุ่มที่ลากการ์ด — มันวางตัวเองจากขนาด/จุดกึ่งกลางที่ CropRig คิดให้
              (อยู่ในกลุ่มนั้นเมื่อไร ก็จะโดน transform ของการ์ดยืดตามไปด้วย ซึ่งคือปัญหาเดิม) */}
          <CropFrame box={cropBox} />
          </UiEnter>
          </group>
          </group>
        </group>
      </group>
      {/*
        การ์ดกระจก — ใบเดียวที่อยู่ "หน้าพุ่มไม้" ไม่ใช่ในชั้น panel ที่ถูกดันลึก
        จึงต้องอยู่นอกกลุ่ม depth (กลุ่มนั้นสเกลรอบจุดกล้อง ดันทุกอย่างไปหลังพุ่ม)

        ตำแหน่ง/ขนาดคิดจากที่เดิมโดยรักษาภาพบนจอให้เท่าเดิม: ของเดิมอยู่ที่ระยะ 22 หน่วยจากกล้อง
        ที่ใหม่ 17 หน่วย จึงย่อพิกัดกับขนาดลงด้วยสัดส่วน 17/22 ทั้งชุด ไม่งั้นย้ายมาข้างหน้าแล้ว
        มันจะใหญ่ขึ้นเองจนบังตัวละคร
      */}
      {/* การ์ดกระจกอยู่นอกกลุ่ม depth — หมุนรอบตาเองด้วยมุมเดียวกัน
          โหมด flip: ไม่หมุนตาม arc แต่ย้ายไปชิดขอบซ้ายของ view ที่แพนขวาแทน (ตำแหน่ง mirror
          ด้านล่าง) — เข้าฉากจากซ้ายด้วย */}
      <group position={CAM0} rotation={[0, flip ? 0 : arc, 0]}>
      <group position={[-CAM0[0], -CAM0[1], -CAM0[2]]}>
      <UiEnter offset={[flip ? -7 : 7, 0, 0]} delay={0.44}>
        <ScrollExit>
        <CurvedPanel
          glass
          curve={screenCurve}
          eyeZ={CAM0[2]}
          /**
           * ชิดขอบขวาของจอ — โผล่เข้ามาแค่บางส่วนแบบ panel ที่ลอยอยู่นอกพื้นที่ทำงาน
           * ที่ระยะนี้ (ห่างกล้อง 17 หน่วย, fov 24) ขอบขวาของเฟรมอยู่ราว x = 5.7 บนจอ 16:10
           * วางกลางการ์ดไว้เลยขอบไปนิดเดียว ส่วนที่เกินจึงถูกตัด แต่ยังเหลือเนื้อให้อ่านออก
           */
          position={flip ? [-2.0, 1.9, -2.5] : [6.0, 1.9, -2.5]}
          // เอียงเพิ่มจากท่าหันหน้าเข้าหาตา (ดู built ของ glass) ไม่ใช่มุมสัมบูรณ์ —
          // เอียงนิดเดียวพอให้เห็นสันด้านข้าง ถ้าหันตรงเป๊ะจะเห็นแต่หน้าแบน ๆ
          rotation={[0, flip ? 0.34 : -0.34, 0]}
          size={[4.3, 3.3]}
          corner={0.34}
          color="#FFFFFF"
          rows={[
            { y: 0.82, x: -1.5, w: 0.34, h: 0.34, color: '#F5C33B', dot: true },
            { y: 0.2, x: -1.5, w: 0.34, h: 0.34, color: '#EC4A6E', dot: true },
            { y: -0.42, x: -1.5, w: 0.34, h: 0.34, color: '#3FC3B4', dot: true },
            { y: 0.82, x: 0.55, w: 2.7, h: 0.3, color: '#FFFFFF', pill: true, opacity: 0.72 },
            { y: 0.2, x: 0.55, w: 2.7, h: 0.3, color: '#FFFFFF', pill: true, opacity: 0.72 },
            { y: -0.42, x: 0.55, w: 2.7, h: 0.3, color: '#FFFFFF', pill: true, opacity: 0.72 },
          ]}
        />
        </ScrollExit>
      </UiEnter>
      </group>
      </group>
    </>
  )
}
