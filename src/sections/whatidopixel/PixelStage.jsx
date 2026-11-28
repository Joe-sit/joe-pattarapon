import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { HeroRider } from '@/newhero/HeroRider'
import { useTuner } from '@/newhero/tuner'
import { pixelDbg, pixelRead } from './pixelDbg'

/**
 * ฉากกลางจอ what-i-do — ตัวละครที่ถูกหั่นเป็นบล็อกพิกเซล + ของ 3D รอบขอบ = สกิล
 *
 * ตามภาพอ้างอิง: ก้อนสี่เหลี่ยมทึบกลางเฟรมเป็นรูปอิสระที่อ่านออกว่าเป็นตัวอะไรอยู่ข้างใน
 * มีของ 3D มัน ๆ (โดนัท หน้ายิ้ม ลูกศร เคอร์เซอร์ ดอกไม้) กระจายรอบขอบ
 *
 * ก้อนสีไม่ได้ปั้นเลียนขึ้นมา — มันคือ **เงาจริงของริก** ที่ถูกหั่นเป็นตาราง
 *
 * วิธี: เรนเดอร์เฉพาะกิ่งตัวละครลง render target ด้วยวัสดุแบนขาว (เทคนิคเดียวกับ EchoTrail
 * ในฉาก hero) แล้วแปะกลับเป็นแผ่นเดียวที่ *สุ่มตัวอย่างตรงกลางช่อง* ของตาราง ไม่ใช่ทุกพิกเซล
 * — ผลที่ได้คือบล็อกคมเป็นขั้น ๆ ตามรูปตัวจริง ขยับท่าก้อนก็เปลี่ยนตาม และไม่ต้องอ่านพิกเซล
 * กลับมาที่ CPU เลย (readRenderTargetPixels หยุดไปป์ไลน์ ใช้ได้แค่ในโหมดตรวจ)
 *
 * ตัวจริงถูกวาดทับข้างหน้าอีกชั้น จึงเห็นหัว/หน้าเป็น 3D จริงบนลำตัวที่เป็นบล็อก — แบบเดียวกับ
 * ลูกตามัน ๆ ที่วางอยู่บนก้อนพิกเซลในภาพอ้างอิง
 */

/**
 * รูปพอร์ทัลพิกเซล — วัดจาก Figma node 12799:2 ไม่ใช่กะตาม
 *
 * ถอดด้วยการดีโคด PNG ของเฟรมนั้นแล้วสุ่มสีที่กลางช่อง: กรอบรูป 467×785px ช่องละ 78px
 * = ตาราง 6×10 ช่องพอดี สีที่ใช้จริงคือ #0731e5 (ไม่ใช่ #1b33f5 ที่ผมกะไว้รอบก่อน)
 *
 * '#' = ช่องทึบ · '.' = ช่องว่าง แถวแรกคือแถวบนสุดของเฟรม
 */
const PORTAL = [
  '.#.#..',
  '..#...',
  '####..',
  '####..',
  '#####.',
  '####.#',
  '#####.',
  '.###..',
  '.###..',
  '..#...',
]
const COLS = PORTAL[0].length
const ROWS = PORTAL.length
/**
 * สีพอร์ทัล = สีส้มของโลโก้ JOE (--v3-orange ใน pages/portfolio2026final.css)
 *
 * แบบใน Figma เป็นฟ้า #0731e5 แต่จอนี้อยู่ในหน้า /2026-final ที่ยึดสีส้มของโลโก้เป็นสีหลัก
 * เขียนเป็นค่าคงที่ ไม่ได้อ่านจากตัวแปร CSS เพราะค่านี้เข้าไปเป็นยูนิฟอร์มของเชดเดอร์
 * (อ่าน CSS var ต้องผ่าน getComputedStyle ทุกครั้งที่ธีมเปลี่ยน ซึ่งจอนี้ไม่มี)
 */
const ORANGE = '#fd5000'

/** ขนาดพอร์ทัลในหน่วยฉาก — สูง 11 หน่วย (ริกรัศมี 3.63 จึงพอดีอยู่ข้างใน) ช่องเป็นจัตุรัส */
const PORTAL_H = 11
const PORTAL_W = (PORTAL_H * COLS) / ROWS

/**
 * ภาพที่พอร์ทัลส่องเห็น = ภาพ *หน้าจอทั้งจอ* ไม่ใช่ภาพที่ถ่ายจากกล้องของตัวเอง
 *
 * เดิมถ่ายด้วยกล้องออร์โธที่มีกรอบของตัวเอง (พอร์ทัลหารด้วยซูม) ภาพในพอร์ทัลจึงเป็นภาพ
 * คนละมุมคนละขนาดกับตัวละครจริงในฉาก — พอต้องการให้ตัวจริง "ยื่นออกมา" พ้นขอบพอร์ทัล
 * รอยต่อจะไม่ตรงกันเลย (ขนาดต่าง มุมต่าง ออร์โธกับเปอร์สเปกทีฟต่าง)
 *
 * ตอนนี้ถ่ายด้วยกล้องจริงของฉากลงพื้นผิวขนาดเท่าจอ แล้วเชดเดอร์สุ่มสีด้วยพิกัดหน้าจอ
 * (gl_FragCoord / uRes) ไม่ใช่ uv ของแผ่น — ภาพในพอร์ทัลจึงทับตัวจริงพอดีเป๊ะโดยไม่ต้อง
 * คำนวณอะไร ส่วนรูปพอร์ทัล (ช่องไหนทึบ) ยังคิดจาก uv ของแผ่นเหมือนเดิม
 *
 * ผลพลอยได้: ไม่มี "ซูมในหน้าต่าง" อีกแล้ว อยากให้ตัวใหญ่ในพอร์ทัลก็ขยายตัวละครจริง
 * (pixelDbg.zoom = สเกลของริก) ซึ่งตรงกับที่ตาเห็นมากกว่า
 */
/** ความกว้าง/สูงสูงสุดของพื้นผิวที่ถ่าย — จอใหญ่ dpr สูงไม่ต้องถ่ายเต็มขนาดจริง */
const RT_MAX = 2048
/** ถ่ายใหม่ทุกกี่เฟรม */
const EVERY = 3

/**
 * จังหวะที่บล็อกยื่นออกจากกล่องหลัก
 *
 * STAGGER = เวลาทั้งหมดที่ใช้ไล่จากขั้นแรกถึงขั้นสุดท้าย · GROW = แต่ละใบใช้เวลายื่นเท่าไร
 * กล่องหลักอยู่ขั้น 0 จึงขึ้นก่อน แล้วช่องที่ไกลออกไปทยอยงอกตามลำดับ BFS
 */
const STAGGER = 0.85
const GROW = 0.3

const BOX = new THREE.Box3()
const BOX_ONE = new THREE.Box3()
const SPH = new THREE.Sphere()
const CEN = new THREE.Vector3()
const DIR = new THREE.Vector3()
/** แกนขวาของกล้อง — ใช้เลื่อนกรอบซ้าย/ขวาให้เดินตรงบนจอ ไม่เฉียงตามแกน X ของโลก */
const RIGHT = new THREE.Vector3()
/** แกนขึ้นของกล้อง — คู่กับ RIGHT ใช้ขยับพอร์ทัลบนระนาบจอ */
const UP = new THREE.Vector3()
/** ขนาดบัฟเฟอร์ที่กำลังวาด (พิกเซลจริง) */
const RES = new THREE.Vector2()

const DEG = Math.PI / 180

/**
 * หน้ากากบังตัวละคร 3D — ให้เห็นตัวจริงเฉพาะฝั่งซ้ายของขอบพอร์ทัล
 *
 * ไม่ได้ใช้ระนาบตัด (clipping plane): ลองแล้วไม่ได้ผล วัสดุของริกถูกแพตช์ด้วย onBeforeCompile
 * (rim light / flatBands / ลายเสื้อ) และแคชโปรแกรมด้วยกุญแจของตัวเอง ตั้ง gl.clippingPlanes
 * แล้ววัดได้ว่า renderer ถือระนาบอยู่จริง (clippingPlanes.length = 1) แต่ภาพไม่ถูกตัดเลย
 * ส่วนการติดระนาบที่ตัววัสดุก็ทำไม่ได้ เพราะวัสดุถูกแคชต่อ URL ร่วมกับฉาก hero ทั้งเว็บ
 *
 * ที่ใช้แทนคือหน้ากากเชิงลึก: แผ่นใหญ่ที่ไม่เขียนสี (colorWrite = false) แต่เขียนค่าความลึก
 * วางขวางอยู่ *หน้า* ริกทางฝั่งขวาของรอยตัด ชิ้นส่วนของริกที่อยู่หลังมันจึงตกที่ depth test
 * — ไม่ต้องพึ่งความสามารถของวัสดุเลย และแผ่นพอร์ทัลตั้ง depthTest = false จึงไม่โดนบัง
 */
const MASK_SIZE = 200

/** กล่องครอบที่นับเฉพาะเมชที่เห็นอยู่จริง — ชิ้นที่ถูกซ่อนตามท่าทำให้กรอบบานเกินตัว */
function fitBox(root, out) {
  out.makeEmpty()
  root.updateWorldMatrix(true, true)
  root.traverseVisible((o) => {
    const g = o.geometry
    if (!g) return
    if (!g.boundingBox) g.computeBoundingBox()
    BOX_ONE.copy(g.boundingBox).applyMatrix4(o.matrixWorld)
    out.union(BOX_ONE)
  })
}

/**
 * กล่องหลัก = สี่เหลี่ยมทึบที่ใหญ่ที่สุดในผัง — หาโดยไล่ทุกช่วงแถว/คอลัมน์
 *
 * ตารางมีแค่ 6×10 การไล่ทุกช่วงจึงถูกกว่าการเขียนอัลกอริทึมแบบฉลาด และได้คำตอบที่ถูกต้อง
 * แน่นอน ไม่ใช่การชี้กล่องหลักด้วยมือซึ่งจะผิดทันทีที่แบบเปลี่ยน
 */
function mainRect() {
  let best = { area: 0, r0: 0, r1: 0, c0: 0, c1: 0 }
  for (let r0 = 0; r0 < ROWS; r0 += 1) {
    for (let r1 = r0; r1 < ROWS; r1 += 1) {
      for (let c0 = 0; c0 < COLS; c0 += 1) {
        for (let c1 = c0; c1 < COLS; c1 += 1) {
          let solid = true
          for (let r = r0; r <= r1 && solid; r += 1) {
            for (let c = c0; c <= c1; c += 1) {
              if (PORTAL[r][c] !== '#') {
                solid = false
                break
              }
            }
          }
          const area = (r1 - r0 + 1) * (c1 - c0 + 1)
          if (solid && area > best.area) best = { area, r0, r1, c0, c1 }
        }
      }
    }
  }
  return best
}

/**
 * ลำดับการยื่นออก + ทิศที่ยื่นมาจาก — BFS แปดทิศจากกล่องหลัก
 *
 * ทำไมแปดทิศ: สองช่องบนสุดของแบบแตะกล่องหลักแบบทแยงเท่านั้น (แถว 0 คอลัมน์ 1 กับ 3 ต่อกับ
 * แถว 1 คอลัมน์ 2) ถ้าใช้สี่ทิศมันจะไม่มีพ่อแม่ แล้วเหลือเป็นช่องที่โผล่มาลอย ๆ ไม่ได้ยื่นออก
 * จากอะไร
 *
 * ต่อช่องเก็บสองอย่าง: ขั้นที่ไปถึง (= ลำดับเวลา) และทิศจากพ่อแม่มาหาตัวเอง (= ด้านที่มันต้อง
 * งอกออกมา) ช่องของกล่องหลักมีทิศ 0,0 หมายถึงงอกจากกลางช่องออกทุกด้าน
 */
function growOrder() {
  const box = mainRect()
  const step = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => -1))
  const dir = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null))
  const q = []
  for (let r = box.r0; r <= box.r1; r += 1) {
    for (let c = box.c0; c <= box.c1; c += 1) {
      step[r][c] = 0
      dir[r][c] = [0, 0]
      q.push([r, c])
    }
  }
  const NB = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]
  for (let head = 0; head < q.length; head += 1) {
    const [r, c] = q[head]
    for (const [dr, dc] of NB) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue
      if (PORTAL[nr][nc] !== '#' || step[nr][nc] >= 0) continue
      step[nr][nc] = step[r][c] + 1
      dir[nr][nc] = [dc, dr]
      q.push([nr, nc])
    }
  }
  let max = 0
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) max = Math.max(max, step[r][c])
  return { step, dir, max: Math.max(1, max) }
}

/**
 * ผังช่องเป็น texture 6×10 อ่านแบบ nearest — ช่องหนึ่งค่าเดียว ไม่มีการไล่สีระหว่างช่อง
 *
 * R = ช่องทึบไหม · G = ลำดับเวลาที่ยื่นออก (0..1) · B/A = ทิศที่ยื่นมาจาก (เก็บ −1..1 เป็น 0..1)
 */
function portalMap() {
  const { step, dir, max } = growOrder()
  const data = new Uint8Array(COLS * ROWS * 4)
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      /* กลับแถว: uv.y ของ three นับจากล่างขึ้นบน แต่ PORTAL เขียนจากบนลงล่าง */
      const i = ((ROWS - 1 - r) * COLS + c) * 4
      const on = PORTAL[r][c] === '#'
      const d = dir[r][c] ?? [0, 0]
      data[i] = on ? 255 : 0
      data[i + 1] = on ? Math.round((step[r][c] / max) * 255) : 0
      data[i + 2] = Math.round((d[0] + 1) * 127.5)
      /* ทิศในแนวตั้งกลับเครื่องหมายด้วย เพราะแถวถูกกลับไปแล้ว */
      data[i + 3] = Math.round((-d[1] + 1) * 127.5)
    }
  }
  const tex = new THREE.DataTexture(data, COLS, ROWS, THREE.RGBAFormat)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.needsUpdate = true
  return tex
}

/**
 * พอร์ทัลพิกเซล — รูปที่ออกแบบไว้ ส่องเห็นตัวละครอยู่ข้างใน
 *
 * ต่างจากรอบก่อนที่ก้อนสีคือ *เงา* ของริกเอง: คราวนี้รูปมาจากแบบ (PORTAL) และตัวละครเป็น
 * สิ่งที่มองเห็นผ่านช่องนั้น ช่องไหนที่ตัวไม่บังก็เป็นสีส้มทึบ — เหมือนมองผ่านหน้าต่างที่ถูก
 * หั่นเป็นบล็อก
 *
 * ทำด้วย render target ไม่ใช่ stencil: วัสดุของริกถูกแคชต่อ URL ทั้งเว็บ (ทุก instance ใช้
 * ก้อนเดียวกัน) ถ้าไปติดธง stencil ที่วัสดุตรงนี้ ฉาก hero กับจอ Experiences จะโดนด้วย
 * — เคยเจอแล้วตอนทำพอร์ทัลของจอ Experiences ต้องโคลนวัสดุรายตัวมาแก้ ถ่ายเป็นภาพแล้ว
 * แปะผ่านผังช่องจึงถูกกว่าและไม่แตะของกลาง
 *
 * กิ่งตัวละครถูกตั้ง visible = false ในฉากหลัก (ไม่งั้นตัวจะไปวาดทับพอร์ทัลแบบไม่ถูกหั่น)
 * แล้วเปิดชั่วคราวเฉพาะตอนถ่าย — ไฟจึงต้องมีสองชุด: ชุดในกิ่ง (ติดตัว ใช้ตอนถ่าย เพราะ
 * three เก็บไฟจากรากที่ส่งไปเรนเดอร์เท่านั้น) และชุดนอกกิ่งสำหรับของสกิลรอบขอบ
 */
function PixelBody({ subject, live }) {
  const { gl, camera, scene } = useThree()
  const plane = useRef(null)
  /** หน้ากากเชิงลึก — ดู MASK_SIZE */
  const mask = useRef(null)
  const frames = useRef(0)

  const rt = useMemo(
    () => new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true, stencilBuffer: false, samples: 4 }),
    [],
  )
  const map = useMemo(portalMap, [])
  const uniforms = useMemo(
    () => ({
      uRt: { value: rt.texture },
      uMap: { value: map },
      uGrid: { value: new THREE.Vector2(COLS, ROWS) },
      /** ขนาดบัฟเฟอร์ที่กำลังวาด — ตัวหารของ gl_FragCoord */
      uRes: { value: new THREE.Vector2(1, 1) },
      uFill: { value: new THREE.Color(ORANGE) },
      uT: { value: 0 },
      uStagger: { value: STAGGER },
      uGrow: { value: GROW },
    }),
    [rt, map],
  )
  useEffect(
    () => () => {
      rt.dispose()
      map.dispose()
    },
    [rt, map],
  )

  useFrame((_, dt) => {
    const root = subject.current
    const m = plane.current
    const k = mask.current
    if (!root || !m) return

    /* เวลาเดินเฉพาะตอนจออยู่ในสายตา และรีเซ็ตเมื่อพ้นจอ — เลื่อนกลับมาได้ดูใหม่ */
    const u = m.material.uniforms
    u.uT.value = live ? u.uT.value + dt : 0
    u.uStagger.value = pixelDbg.stagger
    u.uGrow.value = pixelDbg.grow
    m.scale.setScalar(pixelDbg.scale)
    /* ค่าในแผงเป็นองศา — ริกรับเรเดียน */
    root.rotation.set(pixelDbg.rotX * DEG, pixelDbg.rotY * DEG, pixelDbg.rotZ * DEG)

    frames.current += 1
    if (frames.current % EVERY !== 1) return

    /* แกนของกล้องจากเฟรมก่อน — ใช้ทั้งวางตัวละคร วางแผ่น และวางหน้ากาก */
    RIGHT.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
    UP.setFromMatrixColumn(camera.matrixWorld, 1).normalize()
    camera.getWorldDirection(DIR)

    /**
     * ขยับ/ขยายตัวละครจริง ไม่ใช่ขยับกรอบของกล้องถ่าย
     *
     * ภาพในพอร์ทัลคือภาพหน้าจอ (ดูหัวไฟล์) การ "ซูมในหน้าต่าง" จึงไม่มีความหมายแล้ว
     * — อยากให้ตัวใหญ่ขึ้นก็ขยายริก อยากเลื่อนก็เลื่อนริกไปตามแกนของกล้อง
     */
    root.scale.setScalar(pixelDbg.zoom)
    root.position.set(0, 0, 0).addScaledVector(RIGHT, pixelDbg.shiftX).addScaledVector(UP, pixelDbg.lift)

    fitBox(root, BOX)
    if (BOX.isEmpty()) return
    BOX.getBoundingSphere(SPH)
    CEN.copy(SPH.center)
    /**
     * ถอดค่าที่เพิ่งเลื่อนตัวละครออกจากจุดที่พอร์ทัลกับกล้องเล็ง
     *
     * ไม่ถอดแล้วพอร์ทัลจะวิ่งตามตัวละครไปด้วย (มันเล็งที่กลางกรอบของริก) เลื่อนเท่าไรก็เห็น
     * ตัวอยู่กลางหน้าต่างเหมือนเดิม — ที่ต้องการคือหน้าต่างอยู่นิ่งแล้วตัวละครเลื่อนเข้า/ออก
     * จากมัน (เลื่อนซ้ายมาก ๆ = ตัวยื่นพ้นขอบซ้ายออกมาเป็น 3D จริง)
     */
    CEN.addScaledVector(RIGHT, -pixelDbg.shiftX).addScaledVector(UP, -pixelDbg.lift)

    /**
     * ตั้งกล้องให้เสร็จ *ก่อน* ถ่าย — ภาพที่ถ่ายกับภาพบนจอต้องเป็นเฟรมเดียวกัน
     *
     * ของเดิมย้ายกล้องหลังถ่าย ภาพในพอร์ทัลจึงช้ากว่าจอจริงหนึ่งเฟรมถ่าย (สามเฟรมวาด)
     * ตอนที่ภาพยังเป็นกรอบของตัวเองไม่เห็นผล แต่พอทับกับตัวจริงจะเห็นเป็นภาพเหลื่อม
     */
    camera.position.copy(CEN).addScaledVector(DIR, -pixelDbg.cam)
    camera.lookAt(CEN)
    camera.updateMatrixWorld()

    /* พอร์ทัลวางที่กลางตัวและหันเข้ากล้อง แล้วขยับบนระนาบจอตาม posX/posY */
    m.scale.setScalar(pixelDbg.scale)
    m.position.copy(CEN)
    m.quaternion.copy(camera.quaternion)
    m.position.addScaledVector(RIGHT, pixelDbg.posX).addScaledVector(UP, pixelDbg.posY)

    /**
     * วางหน้ากาก: ขอบซ้ายของมันคือรอยตัด = ขอบซ้ายของพอร์ทัล + spill
     *
     * เลื่อนหน้ากากไปทางขวาครึ่งใบ ขอบซ้ายจะมาอยู่ที่รอยตัดพอดี แล้วดึงเข้าหากล้องให้พ้น
     * หน้าริกทั้งตัว (รัศมีกรอบ + เผื่อ) ไม่งั้นมันบังแค่ครึ่งหลังของตัว
     */
    if (k) {
      const edge = -(PORTAL_W / 2) * pixelDbg.scale + pixelDbg.spill
      k.quaternion.copy(camera.quaternion)
      k.position
        .copy(m.position)
        .addScaledVector(RIGHT, edge + MASK_SIZE / 2)
        .addScaledVector(DIR, -(SPH.radius + 2))
    }

    /* พื้นผิวเท่าขนาดบัฟเฟอร์ที่วาดจริง (หนีบไม่ให้ใหญ่เกิน) — ภาพจึงคมเท่าที่จอเห็น */
    gl.getDrawingBufferSize(RES)
    const fit = Math.min(1, RT_MAX / Math.max(RES.x, RES.y))
    const rw = Math.max(2, Math.round(RES.x * fit))
    const rh = Math.max(2, Math.round(RES.y * fit))
    if (rt.width !== rw || rt.height !== rh) rt.setSize(rw, rh)
    u.uRes.value.copy(RES)

    const prevRt = gl.getRenderTarget()
    const prevA = gl.getClearAlpha()
    gl.setRenderTarget(rt)
    gl.setClearAlpha(0)
    gl.clear(true, true, false)
    /**
     * เรนเดอร์ *ทั้งฉาก* ด้วยกล้องจริง (ซ่อนแผ่นพอร์ทัลกับหน้ากากไว้ก่อน)
     *
     * ซ่อนแผ่น: ไม่ให้ถ่ายตัวเอง · ซ่อนหน้ากาก: ภาพในพอร์ทัลต้องเป็นตัวทั้งตัว ส่วนที่ถูกบัง
     * คือตัวจริงในฉากหลักเท่านั้น
     *
     * หน้าตาของตัวละครใน /2026-final ไม่ได้มาจากไฟทิศทางอย่างเดียว หัวใจคือ environment
     * map จากแผงไฟนุ่ม (Environment + Lightformer) ซึ่ง three อ่านจาก `scene.environment`
     * — ส่งกิ่งเป็นรากไปเรนเดอร์ กิ่งไม่ใช่ Scene ค่านั้นจึงหายไปทั้งก้อน
     */
    m.visible = false
    if (k) k.visible = false
    gl.render(scene, camera)
    m.visible = true
    if (k) k.visible = true
    gl.setRenderTarget(prevRt)
    gl.setClearAlpha(prevA)

    if (import.meta.env.DEV) {
      window.__pixfit = { r: SPH.radius, x: CEN.x, y: CEN.y, z: CEN.z }
      /* ค่าจูนชุดเดียวกับที่แผงเขียน — เปิดไว้ให้แก้จากคอนโซล/สคริปต์ตรวจได้ */
      window.__pixdbg = pixelDbg
      /* ความคมของภาพ = พื้นผิวที่ถ่ายเทียบกับบัฟเฟอร์ที่วาด (1 = เท่ากันพอดี) */
      pixelRead.t = u.uT.value
      pixelRead.onScreen = RES.y
      pixelRead.rt = rh
    }
  })

  return (
    <>
      {/**
       * หน้ากากเชิงลึก — ไม่เขียนสี เขียนแต่ความลึก และวาดก่อนใครในคิวทึบ (renderOrder −10)
       * เพื่อให้ค่าความลึกของมันอยู่ในบัฟเฟอร์ก่อนที่ริกจะถูกวาด
       */}
      <mesh ref={mask} renderOrder={-10}>
        <planeGeometry args={[MASK_SIZE, MASK_SIZE]} />
        <meshBasicMaterial colorWrite={false} />
      </mesh>

    <mesh ref={plane} renderOrder={10}>
      <planeGeometry args={[PORTAL_W, PORTAL_H]} />
      <shaderMaterial
        uniforms={uniforms}
        transparent
        /* พอร์ทัลอยู่หน้าสุดเสมอ: หน้ากากเชิงลึกวางอยู่หน้าทุกอย่าง ถ้าแผ่นนี้ทดสอบความลึก
           มันจะถูกหน้ากากบังไปด้วยทั้งใบ */
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          precision mediump float;
          uniform sampler2D uRt;
          uniform sampler2D uMap;
          uniform vec2 uGrid;
          uniform vec2 uRes;
          uniform vec3 uFill;
          uniform float uT;
          uniform float uStagger;
          uniform float uGrow;
          varying vec2 vUv;

          void main() {
            /* ช่องนี้อยู่ในรูปหรือเปล่า — ผังอ่านที่กลางช่อง ขอบช่องจึงคมเป็นสี่เหลี่ยมจริง */
            vec2 cell = floor(vUv * uGrid);
            vec4 info = texture2D(uMap, (cell + 0.5) / uGrid);
            if (info.r < 0.5) discard;

            /**
             * ยื่นออกจากกล่องหลักทีละใบ
             *
             * info.g = ลำดับตาม BFS (0 = กล่องหลัก) · info.ba = ทิศที่ยื่นมาจาก
             * ช่องหนึ่ง ๆ ไม่ได้ "จางเข้ามา" — มันโตออกจากด้านที่ติดกับช่องแม่ จึงอ่านเป็น
             * บล็อกที่ถูกดันออกมาจากก้อนหลัก ส่วนช่องของกล่องหลักเองโตออกจากกลางช่อง
             */
            float p = clamp((uT - info.g * uStagger) / uGrow, 0.0, 1.0);
            if (p <= 0.0) discard;
            vec2 dir = info.ba * 2.0 - 1.0;
            vec2 f = fract(vUv * uGrid);
            if (dir.x > 0.5) { if (f.x > p) discard; }
            else if (dir.x < -0.5) { if (f.x < 1.0 - p) discard; }
            if (dir.y > 0.5) { if (f.y > p) discard; }
            else if (dir.y < -0.5) { if (f.y < 1.0 - p) discard; }
            if (abs(dir.x) < 0.5 && abs(dir.y) < 0.5) {
              if (abs(f.x - 0.5) > p * 0.5 || abs(f.y - 0.5) > p * 0.5) discard;
            }

            /**
             * ในช่องทึบ: เห็นตัวละครถ้ามันบังอยู่ ไม่งั้นเป็นสีของพอร์ทัล
             *
             * สุ่มด้วยพิกเซลบนจอ ไม่ใช่ uv ของแผ่น — ภาพที่ถ่ายคือภาพหน้าจอทั้งจอ ตัวใน
             * พอร์ทัลจึงทับตัวจริงที่อยู่หลังพอดี รอยต่อตรงขอบซ้ายเลยต่อกันเป็นตัวเดียว
             */
            vec4 c = texture2D(uRt, gl_FragCoord.xy / uRes);
            vec3 col = c.a > 0.55 ? c.rgb : uFill;

            /**
             * แปลงเป็น sRGB เอง — ทั้งภาพใน render target และสีจากยูนิฟอร์มเป็นค่าเชิงเส้น
             *
             * วัสดุนี้ตั้ง toneMapped = false และเขียน gl_FragColor ตรง ๆ three จึงไม่แปลง
             * พื้นที่สีให้ ค่าเชิงเส้นที่ถูกอ่านเป็น sRGB ทำให้ทุกอย่างเข้มกว่าจริง (สีพื้นที่ออกมา
             * ทึบกว่า #0731e5 ที่วัดจากแบบ และตัวละครดูมืดกว่าในฉาก hero)
             *
             * ใช้เส้นโค้ง sRGB จริง ไม่ใช่ pow(1/2.2) แบบประมาณ — ค่าที่ประมาณให้ฟ้าออกมา
             * #1034e4 (วัดจากภาพที่ถ่ายจากจอจริง) เพี้ยนจากแบบไป 9 ขั้นในช่องแดง ส่วนเส้นโค้ง
             * จริงมีท่อนเชิงเส้นช่วงค่าต่ำ ซึ่งเป็นช่วงที่สีนี้อยู่พอดี
             */
            vec3 lo = col * 12.92;
            vec3 hi = 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055;
            gl_FragColor = vec4(mix(lo, hi, step(vec3(0.0031308), col)), 1.0);
          }
        `}
      />
    </mesh>
    </>
  )
}


/**
 * ไฟชุดเดียวกับฉาก hero ของ /2026-final — ค่าจากแผงจูนชุดเดียวกัน ไม่ได้ตั้งเลขใหม่
 *
 * ตัวละครต้องเป็น "ตัวใน 2026 final" ซึ่งไม่ได้หมายถึงรูปทรงอย่างเดียว หน้าตาของมันคือผลของ
 * ไฟด้วย: ambient ต่ำ + hemisphere ที่ด้านบนรับสีฟ้าของหน้าและด้านล่างรับสีอุ่น + key อุ่น
 * เฉียงบนซ้าย + fill เย็นฝั่งตรงข้าม + rim จากหลัง และแผงไฟนุ่มที่อบเป็น environment map
 * (หัวใจของหน้าตาแบบดินน้ำมัน) — ชุดที่ผมตั้งเองรอบก่อน (ambient 0.9 + สองดวง) ให้ตัวที่
 * แบนและซีดกว่าของจริงคนละตัว
 *
 * frames={1} อบครั้งเดียวตอนขึ้นฉาก ไม่มีอะไรในแผงไฟขยับ
 */
function HeroLights() {
  const t = useTuner()
  return (
    <>
      <ambientLight intensity={t.ambIntensity} color="#ffffff" />
      <hemisphereLight intensity={t.hemiIntensity} color="#5cb8ee" groundColor="#ffd9a8" />
      <directionalLight position={[-15, 24, 21]} intensity={t.keyIntensity} color="#fff4e2" />
      <directionalLight position={[7, 1, 5]} intensity={t.fillIntensity} color="#cfe0ff" />
      <directionalLight position={[2, 6, -9]} intensity={t.rimIntensity} color="#ffffff" />
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={t.envIntensity * 2.2}
          position={[-6, 8, 8]}
          scale={[14, 14, 1]}
          color="#fff1dc"
        />
        <Lightformer
          form="rect"
          intensity={t.envIntensity}
          position={[8, 2, 5]}
          scale={[10, 10, 1]}
          color="#d5e6ff"
        />
        <Lightformer
          form="ring"
          intensity={t.envIntensity * 0.7}
          position={[0, -8, 4]}
          scale={16}
          color="#ffdcae"
        />
      </Environment>
    </>
  )
}

/**
 * ตอนนี้ในฉากเหลือแค่พอร์ทัล + ตัวละคร — ของ 3D ประจำสกิลถูกถอดออกชั่วคราวตามที่สั่ง
 * (ที่วางของยังอยู่ใน pixelStory.ts พร้อมเอากลับมา)
 */
export function PixelStage({ live = true }) {
  const subject = useRef(null)
  return (
    <Canvas
      className="absolute inset-0"
      /* วาดเฉพาะตอนจออยู่ในสายตา — จอนี้อยู่กลางหน้า ปล่อยวาดทิ้งไว้คือเผา GPU เปล่า */
      frameloop={live ? 'always' : 'never'}
      dpr={[1, 1.75]}
      /* คิดจากขนาดจริงของริก (วัดได้รัศมี 3.63 จุดกลาง −0.56/−0.40/−0.42 ดู __pixfit):
         ระยะ 21.6 หน่วยในทิศสามส่วนจากหน้า → เห็นสูงราว 11.6 หน่วย = ตัวกินครึ่งเฟรม
         เหลือขอบให้ของสกิล เล็งสูงกว่าจุดกลางเล็กน้อยให้ตัวไม่ลอยกลางเป๊ะ */
      camera={{ position: [15.8, 5.3, 11.9], fov: 30, near: 0.5, far: 80 }}
      onCreated={({ camera }) => camera.lookAt(-0.56, 0.2, -0.42)}
      gl={{ antialias: true, alpha: true }}
    >
      <HeroLights />

      <Suspense fallback={null}>
        {/**
         * ตัวเดียวกับ hero ของ /2026-final ทั้งดุ้น — ไม่มีโหมดพิเศษของจอนี้อีกแล้ว
         * (ท่าสเก็ต + บอร์ด + แขน lumberjack + ลายเสื้อ + รองเท้า + rim light + flatBands
         * มาจากแผงจูนชุดเดียวกันหมด)
         *
         * เคยลองโหมด `stand` (ยืนปกติ ไม่มีบอร์ด) แล้วเลิก เพราะแขน lumberjack ถูกปั้นจาก
         * ข้อต่อของท่าสเก็ต พอเปลี่ยนเป็นท่ายืนชิ้นแขนหลุดออกมาลอยข้างลำตัว — โหมดนั้นยังอยู่
         * ใน Rider สำหรับจอที่ไม่ใช้แขนชุดนี้
         *
         * ที่ต่างจาก hero มีสองอย่าง ตามที่สั่งทั้งคู่:
         *   noWind — ผ้าไม่ปริว
         *   noIdle — ตัวไม่ไหวตอนอยู่นิ่ง (ปิดทั้ง bob ทั้งตัวและ breathe ที่ข้อต่อ) ในพอร์ทัล
         *     การไหวนิด ๆ ทำให้บล็อกที่ขอบกระพริบสลับช่อง เพราะภาพถูกสุ่มที่กลางช่องของตาราง
         *
         * กิ่งนี้ visible = false ในฉากหลัก เปิดชั่วคราวเฉพาะตอนถ่ายลง render target
         * องศาการหมุนเขียนใน useFrame จากแผงจูน (pixelDbg.rotX/Y/Z) ไม่ตั้งที่นี่
         */}
        <group ref={subject}>
          {/**
           * ยืนตรง แขนห้อยข้างลำตัว ไม่มีบอร์ด
           *
           * `stand` = โหมดยืนของริก · `noBoard` เอาสเก็ตบอร์ดออก · `noLumber` ใช้แขนของ
           * ริกเองแทนแขนจากโมเดล lumberjack ที่ถูกแขวนบนข้อต่อด้วยระยะของท่าสเก็ต
           * (พอมายืนแล้วชิ้นแขนเหลื่อมกันที่ศอก)
           */}
          <HeroRider noWind noIdle noLumber stand noBoard />
        </group>
        <PixelBody subject={subject} live={live} />
      </Suspense>

    </Canvas>
  )
}
