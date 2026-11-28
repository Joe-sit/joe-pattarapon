import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Center,
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  RoundedBox,
  Text3D,
  useTexture,
} from '@react-three/drei'
import * as THREE from 'three'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { BLOB, blobPoints } from './blob'

/**
 * ของในฉาก — รูปในทรงเบี้ยว กับการ์ดกระจกที่เป็นแผ่นหนาจริงในพื้นที่สามมิติ
 *
 * ### ทำไมรูปต้องอยู่ *ในแคนวาส* ด้วย
 *
 * `MeshTransmissionMaterial` หักเหจากบัฟเฟอร์ที่มันถ่าย **ฉากของตัวเอง** ลงไป ไม่ใช่จากสิ่งที่
 * อยู่ข้างหลังหน้าเว็บ ถ้าวางรูปไว้ใน DOM แล้วเอาแคนวาสทับ กระจกจะหักเหความว่าง = เห็นเป็น
 * ก้อนขาวซีด ๆ (บทเรียนเดียวกับหัวเรื่อง hero ดู sections/hero/Headline3D) รูปจึงถูกย้ายเข้ามา
 * เป็นเรขาคณิตในฉากนี้ทั้งอัน การ์ดจึงบิดภาพที่อยู่ข้างหลังมันจริง
 *
 * ### หน่วย
 *
 * 1 หน่วยในฉาก = 100px ของกรอบแบบ (1200×900) กล้องถูกตั้งให้ความสูงที่เห็นตรงระนาบ z = 0
 * เท่ากรอบพอดี ตัวเลขทุกตัวข้างล่างจึงยังเป็น *พิกเซลของแบบ* อ่านเทียบกับภาพอ้างอิงได้ตรง ๆ
 */

const ART = { w: 1200, h: 900 }
/** พิกเซลของแบบต่อหนึ่งหน่วยในฉาก */
const U = 100

const wx = (px: number) => px / U - ART.w / (2 * U)
const wy = (py: number) => ART.h / (2 * U) - py / U

/** กรอบทรงรูป (พิกเซลของแบบ) — วัดจากภาพอ้างอิง */
const PHOTO = { x: 210, y: 153, w: 802, h: 612 }

/**
 * การวางหน้าในทรง — เท่าของกรอบทรง วัดจากไฟล์ภาพ
 *
 * หัวอยู่ y 96–520 ของภาพสูง 1986 (= 21.4%) และจุดกลางหัวอยู่ x 833 ซึ่งเท่าจุดกลางไฟล์
 * (832) พอดี → ไม่ต้องเลื่อนแกนนอน (จุดกลาง *ตัวคนทั้งตัว* อยู่ที่ 605 ถ้าจัดตามค่านั้น
 * หัวจะถูกดันไปขวาของทรง — พลาดมาแล้วรอบหนึ่ง) `zoom` 1.55 ให้หัวกินราวหนึ่งในสามของ
 * ความสูงทรงเหมือนแบบ `drop` 0.045 ดันยอดผมให้ต่ำกว่าขอบทรง
 */
const FACE = { zoom: 1.55, drop: 0.045 }
const IMG = { w: 1664, h: 1986 }

/**
 * การ์ด — จุดกลาง ขนาด (พิกเซลของแบบ) และการหมุนสามแกน
 *
 * `roll` คือการเอียงในระนาบจอเหมือนในแบบ ส่วน `tiltX/tiltY` คือการ *หันแผ่นออกจากจอ* ซึ่ง
 * เป็นสิ่งที่ทำไม่ได้ตอนเป็น CSS: มันทำให้เห็นสันข้างของแผ่น เงาเลื่อนไปคนละทาง และภาพที่
 * ลอดผ่านกระจกบิดไม่เท่ากันทั้งใบ — ใบละมุมไม่ซ้ำกัน ไม่ใช่ชุดเดียวหมุนตาม
 *
 * `depth` = ระยะที่ขยับตามเมาส์ (หน่วยฉาก) `per` = คาบการลอย (วินาที)
 */
const CARDS = [
  {
    cx: 240, cy: 320, w: 276, h: 130, roll: 11, tiltX: -4, tiltY: 9, depth: 0.18, per: 5.2,
    /** ออกจากประตูช้าเร็วต่างกัน ไม่ใช่พุ่งออกมาพร้อมกันสามใบ */
    delay: 0.05,
    /** จำนวนรอบที่หมุนระหว่างทาง — ทวนเข็มหรือตามเข็มสลับกันไป */
    spin: 1.9,
    /** ความโก่งของทางออก (หน่วยฉาก) เครื่องหมายคือข้างที่เหวี่ยงไป */
    bow: 0.9,
  },
  {
    cx: 920, cy: 417, w: 348, h: 160, roll: -18, tiltX: -6, tiltY: -11, depth: 0.3, per: 6.7,
    delay: 0.22,
    spin: -2.4,
    bow: -1.1,
  },
  {
    cx: 443, cy: 719, w: 348, h: 158, roll: -9, tiltX: 5, tiltY: 7, depth: 0.24, per: 5.9,
    delay: 0.4,
    spin: 1.5,
    bow: 0.8,
  },
]

/**
 * ประตู = ปากของทรงรูป การ์ดโผล่ออกมาจากตรงนั้น
 *
 * ไม่ได้ทำเป็นเอฟเฟกต์ประตูแยกชิ้น: การ์ดเริ่มต้นอยู่ **ข้างหลังระนาบของทรง** (z ติดลบกว่า)
 * และเล็กมาก ทรงรูปทึบจึงบังมันไว้จริง ๆ ด้วยความลึกของฉากเอง — ที่คนดูเห็นคือของโผล่ *ออก
 * จาก* รูป ไม่ใช่ของที่ fade เข้ามาทับรูป การบังจึงถูกทุกมุมกล้องโดยไม่ต้องเขียนอะไรเพิ่ม
 *
 * ทางออกเป็นเส้นโก่ง ไม่ใช่เส้นตรง และเลย z ของที่จอดไปข้างหน้าก่อนถอยกลับมา — ของที่พุ่ง
 * ออกจากรูเปิดมีโมเมนตัม ไม่ใช่ของที่ไถลบนราง
 */
const PORTAL = [wx(PHOTO.x + PHOTO.w / 2), wy(PHOTO.y + PHOTO.h / 2)] as const
/** ระนาบที่รูป (และเงาของการ์ด) วางอยู่ */
const PHOTO_Z = -0.35
/** ขอบซ้ายล่างและขนาดของวง (หน่วยฉาก) — ใช้แปลง UV ของเงา */
const BLOB_W = PHOTO.w / U
const BLOB_H = PHOTO.h / U
const BLOB_X0 = PORTAL[0] - BLOB_W / 2
const BLOB_Y0 = PORTAL[1] - BLOB_H / 2
const PORTAL_Z = -1.15
/** เวลาที่ใช้ออกจากประตูถึงที่จอด (วินาที) */
const FLY = 1.45

/** ความหนาแผ่น (พิกเซลของแบบ) — หนาพอให้เห็นสันตอนแผ่นหันออกจากจอ */
const THICK = 16
/** ระยะขอบในการ์ด */
const PAD = 22

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

const FONT = '/fonts/momo-trust-display.json'

/**
 * สีที่กระจก "เห็น" เวลาไม่มีอะไรอยู่ข้างหลัง — หน้านี้พื้นขาว
 *
 * ไม่ใส่แล้วส่วนที่ล้นออกนอกทรงรูปจะหักเหความว่างเป็นก้อนเทาเข้ม
 */
const GLASS_BG = new THREE.Color('#ffffff')

/**
 * ทรงรูป — `THREE.Shape` จากจุดชุดเดียวกับที่ฝั่ง DOM ใช้ (ดู ./blob)
 *
 * UV คิดเอง ไม่ใช้ของที่ `ShapeGeometry` ใส่มา: ของมันคือพิกัดจุดดิบ ๆ ซึ่งใช้แมปภาพไม่ได้
 * ที่นี่แมปให้ *กรอบภาพที่จัดเฟรมไว้* (ดู `FACE`) ลงบนทรง ผลคือภาพถูกครอปด้วยทรงจริง ๆ
 * โดยไม่ต้องใช้ stencil mask — ซึ่งจะหายไปตอนวัสดุกระจกถ่ายฉากลงบัฟเฟอร์ของมัน
 */
let blobCache: { photo: THREE.ShapeGeometry; plain: THREE.ShapeGeometry } | null = null

/**
 * ทรงเดียวใช้ร่วมกันทั้งฉาก (รูป พื้นในประตู และเงาของการ์ดสามใบ)
 *
 * เก็บไว้ระดับโมดูลไม่ใช่ใน hook ของคอมโพเนนต์ เพราะการ์ดแต่ละใบต้องใช้ทรงนี้เป็นพื้นรับเงา
 * ด้วย — สร้างใบละชุดคือสร้างเรขาคณิตเดียวกันสี่รอบ เมชที่ใช้ของร่วมกันต้อง `dispose={null}`
 * ไม่งั้นใบที่ถูกถอดออกจะทิ้งบัฟเฟอร์ที่ใบอื่นยังใช้อยู่ (กฎ `component-dispose-null`)
 */
function blobGeometry() {
  if (!blobCache) blobCache = buildBlob()
  return blobCache
}

function buildBlob() {
  {
    const pts = blobPoints(BLOB)
    const shape = new THREE.Shape(
      pts.map(([x, y]) => new THREE.Vector2((x - 0.5) * PHOTO.w, (0.5 - y) * PHOTO.h)),
    )
    /* ขนาดภาพเทียบกรอบทรง — สูง = zoom, กว้างตามสัดส่วนไฟล์ */
    const ih = FACE.zoom
    const iw = (ih * PHOTO.h * (IMG.w / IMG.h)) / PHOTO.w

    /**
     * สอง UV บนทรงเดียวกัน: ใบหนึ่งแมป *ภาพที่จัดเฟรมแล้ว* อีกใบแมป *กรอบทรงพอดี*
     *
     * ใบหลังมีไว้ให้พื้นในประตู ถ้าใช้ UV ของภาพร่วมกัน พื้นจะถูกยืดตามการซูมหน้า (1.55 เท่า)
     * ไล่สีกับเงารับก็เลื่อนหลุดกรอบไปด้วย
     */
    const make = (framed: boolean) => {
      const geo = new THREE.ShapeGeometry(shape, 1)
      const pos = geo.getAttribute('position')
      const uv = new Float32Array(pos.count * 2)
      for (let i = 0; i < pos.count; i += 1) {
        const bx = pos.getX(i) / PHOTO.w + 0.5
        const byTop = 0.5 - pos.getY(i) / PHOTO.h
        uv[i * 2] = framed ? (bx - (1 - iw) / 2) / iw : bx
        uv[i * 2 + 1] = 1 - (framed ? (byTop - FACE.drop) / ih : byTop)
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
      geo.scale(1 / U, 1 / U, 1 / U)
      return geo
    }
    return { photo: make(true), plain: make(false) }
  }
}

/**
 * พื้นในประตู — อบเป็นเท็กซ์เจอร์ใบเดียวจากแคนวาส 2D ไม่ใช่สีทึบ
 *
 * สีทึบใบเดียวทำให้ในประตูเป็นเทาแบนทั้งผืน (เห็นบนจอ) ในแบบอ้างอิงข้างหลังเป็นห้องจริงที่มี
 * แสงตกด้านเดียวและมุมภาพมืดลง ที่นี่วาดสามชั้นลงผืนเดียว: ไล่สีจากแหล่งแสงมุมซ้ายบน →
 * ขอบมืด (vignette) → **เงารับใต้ตัวคน** ซึ่งเป็นตัวที่ทำให้คนไม่ดูเหมือนภาพแปะ เพราะไฟล์
 * ต้นทางเป็นภาพตัดพื้นออก มันไม่มีเงาของตัวเองมาด้วย
 *
 * อบเป็นเท็กซ์เจอร์ไม่ใช่ทำเป็นเมชสามชั้น: ชั้นโปร่งซ้อนกันสามใบต้องเรียงลำดับวาดและกิน
 * fill rate ซ้ำสามรอบ ทั้งที่ภาพนี้นิ่งอยู่แล้ว วาดครั้งเดียวจบ
 */
function useInteriorTexture() {
  return useMemo(() => {
    const S = 512
    const cv = document.createElement('canvas')
    cv.width = S
    cv.height = S
    const g = cv.getContext('2d')
    if (!g) return null
    /* แสงหลักจากมุมซ้ายบน ทางเดียวกับแสงบนตัวคนในไฟล์ภาพ */
    const lit = g.createRadialGradient(S * 0.3, S * 0.2, 0, S * 0.3, S * 0.2, S * 1.05)
    lit.addColorStop(0, '#a8adb8')
    lit.addColorStop(0.55, '#7e828c')
    lit.addColorStop(1, '#4a4d55')
    g.fillStyle = lit
    g.fillRect(0, 0, S, S)
    /* ขอบมืด — ดันสายตาเข้ากลางภาพ */
    const vig = g.createRadialGradient(S * 0.5, S * 0.5, S * 0.25, S * 0.5, S * 0.5, S * 0.72)
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vig.addColorStop(1, 'rgba(14, 15, 18, 0.55)')
    g.fillStyle = vig
    g.fillRect(0, 0, S, S)
    /* เงารับใต้ตัวคน — วงรีนุ่มตรงที่ลำตัวจดขอบล่างของทรง */
    const sh = g.createRadialGradient(S * 0.46, S * 0.9, 0, S * 0.46, S * 0.9, S * 0.42)
    sh.addColorStop(0, 'rgba(10, 11, 14, 0.62)')
    sh.addColorStop(1, 'rgba(10, 11, 14, 0)')
    g.fillStyle = sh
    g.fillRect(0, 0, S, S)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

/**
 * เงาที่การ์ดทอดลงพื้น — แผ่นบางวางบนระนาบของรูป ไม่ใช่เงาจากไฟจริง
 *
 * เงาจาก shadow map ต้องเปิด shadow ทั้งแคนวาสและเรนเดอร์ฉากซ้ำอีกรอบต่อไฟหนึ่งดวง
 * ในขณะที่ของที่ทอดเงาเป็นแผ่นสี่เหลี่ยมมนสามใบบนพื้นเรียบใบเดียว — วาดเป็นแผ่นนุ่มตามใบ
 * ถูกกว่ามากและคุมความนุ่มได้ตรง ๆ เงาเลื่อนไปตรงข้ามแหล่งแสง (ซ้ายบน) และจางลงตามระยะ
 */
function useShadowTexture() {
  return useMemo(() => {
    const S = 128
    const cv = document.createElement('canvas')
    cv.width = S
    cv.height = S
    const g = cv.getContext('2d')
    if (!g) return null
    const rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    rg.addColorStop(0, 'rgba(12, 13, 17, 0.55)')
    rg.addColorStop(0.55, 'rgba(12, 13, 17, 0.3)')
    rg.addColorStop(1, 'rgba(12, 13, 17, 0)')
    g.fillStyle = rg
    g.fillRect(0, 0, S, S)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

function Photo() {
  const geo = blobGeometry()
  const inside = useInteriorTexture()
  const tex = useTexture('/art/whatido/portrait.png')
  const at: [number, number, number] = [PORTAL[0], PORTAL[1], PHOTO_Z]
  return (
    <group position={at}>
      {/**
       * พื้นหลังในทรง — ภาพเป็นไฟล์ *ตัดพื้นออกแล้ว* (วัดแล้ว: อัลฟาเหลือแค่ตัวคน x 44–1228
       * ของ 1664) ถ้าไม่มีพื้นรอง ทรงจะมองไม่เห็นเลย เหลือแต่คนลอย ๆ ในอากาศ
       */}
      <mesh geometry={geo.plain} dispose={null} position-z={-0.02}>
        <meshBasicMaterial map={inside ?? undefined} color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh geometry={geo.photo} dispose={null}>
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  )
}

/**
 * การ์ดหนึ่งใบ — แผ่นกระจกหนาจริง ตัวหนังสือเป็นตัวอักษรอัดขึ้นรูปวางบนผิวหน้า
 *
 * ทุกอย่างที่ขยับอยู่บน `group` ด้านนอกและถูกเขียนใน `useFrame` ผ่าน ref ไม่มี state:
 * setState ใน useFrame = re-render ทุกเฟรม (กฎ `perf-never-set-state-in-useframe`)
 */
function Card({ i, run }: { i: number; run: React.MutableRefObject<number> }) {
  /* โคลนต่อใบ: ทั้งสามใบใช้ภาพเดียวกันแต่ต้องเลื่อน UV คนละที่ — แชร์ instance เดียวไม่ได้ */
  const src = useShadowTexture()
  const shadowTex = useMemo(() => {
    if (!src) return null
    const t = src.clone()
    t.needsUpdate = true
    return t
  }, [src])
  const c = CARDS[i]
  const g = useRef<THREE.Group | null>(null)
  const sh = useRef<THREE.Mesh | null>(null)
  const base = useMemo<[number, number, number]>(
    () => [wx(c.cx), wy(c.cy), 0],
    [c.cx, c.cy],
  )
  const w = c.w / U
  const h = c.h / U
  const d = THICK / U
  const pad = PAD / U
  const aim = useRef({ x: 0, y: 0 })

  useFrame(({ clock, pointer }, delta) => {
    const el = g.current
    if (!el) return
    /**
     * ความคืบหน้าของการออกจากประตู — คิดจาก *เวลาจริง* ไม่ใช่การหน่วงเข้าหาเป้า
     *
     * ท่านี้มีลำดับ (หมุนเยอะตอนออก → คลายตอนเข้าที่) การหน่วงแบบวิ่งเข้าหาเป้าให้เส้นเดียว
     * ที่ไม่มีจังหวะ ส่วนนาฬิกาให้กำหนดได้ว่าใบไหนออกวินาทีที่เท่าไร และเล่นซ้ำได้ตรงกัน
     */
    const t0 = run.current
    const p = t0 ? clamp01((clock.elapsedTime - t0 - c.delay) / FLY) : 0
    /* เร่งแรงตอนออกแล้วค่อยหน่วงยาว — โมเมนตัมของของที่ถูกดันออกมาจากรูเปิด */
    const e = 1 - (1 - p) ** 4
    const back = 1 - e

    /* หน่วงตามเมาส์แบบอิงเวลา จอ 120Hz จะได้ท่าเดียวกับจอ 60Hz (กฎ frame-delta-time) */
    const kp = 1 - Math.exp(-delta * 3.2)
    aim.current.x += (pointer.x - aim.current.x) * kp
    aim.current.y += (pointer.y - aim.current.y) * kp

    const t = clock.elapsedTime
    /* การลอยขึ้นเต็มที่เมื่อเข้าที่แล้ว ระหว่างบินยังไม่ต้องมี */
    const fy = Math.sin((t / c.per) * Math.PI * 2 + i * 1.7) * 0.055 * e
    const fx = Math.cos((t / (c.per * 1.6)) * Math.PI * 2 + i) * 0.03 * e

    /* ทางออกโก่งไปด้านข้าง สูงสุดกลางทาง ศูนย์ที่ปลายทั้งสอง */
    const dx = base[0] - PORTAL[0]
    const dy = base[1] - PORTAL[1]
    const len = Math.hypot(dx, dy) || 1
    const bow = Math.sin(Math.PI * e) * c.bow
    /* เลยที่จอดไปข้างหน้าเล็กน้อยก่อนถอยกลับ */
    const pop = Math.sin(Math.PI * e) * 0.5

    el.position.set(
      PORTAL[0] + dx * e + (-dy / len) * bow + fx + aim.current.x * c.depth * e,
      PORTAL[1] + dy * e + (dx / len) * bow + fy + aim.current.y * c.depth * 0.55 * e,
      PORTAL_Z + (base[2] - PORTAL_Z) * e + pop,
    )
    /**
     * หมุนหลายรอบตอนออกแล้วคลายลงจนเหลือมุมที่จอด — บวกด้วยการหันตามเมาส์ตอนลงหลักแล้ว
     *
     * หมุนสามแกนไม่เท่ากัน (z เยอะสุด y รองลงมา x น้อย) แผ่นจึงกลิ้งออกมาแบบของที่ถูก
     * เหวี่ยง ไม่ใช่กังหันที่หมุนอยู่ในระนาบเดียว
     */
    el.rotation.set(
      THREE.MathUtils.degToRad(c.tiltX) - aim.current.y * 0.12 * e + back * c.spin * 0.9,
      THREE.MathUtils.degToRad(c.tiltY) + aim.current.x * 0.14 * e + back * c.spin * 2.1,
      THREE.MathUtils.degToRad(-c.roll) + back * c.spin * Math.PI * 2,
    )
    /* โตจากเกือบไม่มีตัว — ของที่ออกมาจากที่ลึกกว่าย่อมเล็กกว่าตอนแรก */
    el.scale.setScalar(0.18 + 0.82 * e)

    /**
     * เงาตามการ์ดแต่เลื่อนไปตรงข้ามแสง (ซ้ายบน) และจางตอนแผ่นยังไม่ออกจากประตู
     *
     * ขนาดเงาโตขึ้นเล็กน้อยตามการ์ด แต่ไม่หมุน — ดูเหตุผลที่ตัวเมช
     */
    const shm = sh.current
    if (shm) {
      const mat = shm.material as THREE.MeshBasicMaterial
      mat.opacity = 0.8 * e
      /**
       * เงาไม่ได้เลื่อน *ตัวเมช* — เลื่อน **UV ของเท็กซ์เจอร์** บนทรงที่เป็นพื้นรับเงา
       *
       * ก่อนหน้านี้ใช้แผ่นสี่เหลี่ยมเลื่อนตามการ์ด ผลคือเงาล้นออกไปเป็นรอยเปื้อนเทาบนพื้นขาว
       * นอกวง (เห็นบนจอ) เพราะแผ่นไม่รู้จักขอบของวง เมื่อพื้นรับเงา *เป็นทรงนั้นเอง* เงาจึงไม่มี
       * ทางไปอยู่นอกวงได้เลย และขอบวงก็ตัดเงาให้พอดีฟรี ๆ
       *
       * การแปลง UV: repeat = ขนาดวง / ขนาดเงา, offset เลื่อนให้จุดกลางเงาไปตรงใต้การ์ด
       * (เยื้องไปทางตรงข้ามแสงซึ่งอยู่ซ้ายบน) เท็กซ์เจอร์ขอบโปร่ง + ClampToEdge จึงไม่ซ้ำลาย
       */
      const m = mat.map
      if (m) {
        const sw = w * 1.7 * (0.75 + 0.25 * e)
        const sy = h * 2.3 * (0.75 + 0.25 * e)
        const px = el.position.x + 0.16
        const py = el.position.y - 0.2
        m.repeat.set(BLOB_W / sw, BLOB_H / sy)
        m.offset.set((BLOB_X0 - px + sw / 2) / sw, (BLOB_Y0 - py + sy / 2) / sy)
      }
    }
  })

  return (
    <>
      {/**
       * เงาของใบนี้ — แผ่นนุ่มบนระนาบของรูป ไม่ได้อยู่ในกลุ่มเดียวกับการ์ด
       *
       * แยกกลุ่มเพราะเงาต้อง *ไม่* หมุนตามการ์ด: แผ่นหมุนสองรอบระหว่างออกจากประตูแต่เงา
       * บนพื้นต้องนิ่งตามแสง ถ้าใส่ไว้ในกลุ่มเดียวกันเงาจะหมุนควงตามไปด้วย
       */}
      <mesh
        ref={sh}
        geometry={blobGeometry().plain}
        dispose={null}
        position={[PORTAL[0], PORTAL[1], PHOTO_Z + 0.015]}
        renderOrder={1}
      >
        <meshBasicMaterial
          map={shadowTex ?? undefined}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <group ref={g} position={base}>
      <RoundedBox args={[w, h, d]} radius={Math.min(0.17, h / 2.6)} smoothness={4} steps={1}>
        {/**
         * กระจกจริง: หักเหภาพข้างหลังแผ่น ไม่ใช่สีเทาโปร่ง
         *
         * `samples` คือจำนวนรอบที่วัสดุสุ่มบัฟเฟอร์ต่อพิกเซล (แยกสีแบบปริซึม) `resolution`
         * คือความละเอียดของบัฟเฟอร์ที่มันถ่ายฉากลงไป — สามใบในฉากนี้ = สามบัฟเฟอร์ต่อเฟรม
         * เลยตั้งไว้พอดีตา ไม่ใช่สูงสุด
         *
         * `roughness` สูงหน่อยพร้อม `anisotropicBlur`: ภาพที่ลอดผ่านฝ้าเหมือนกระจกพ่นทราย
         * ตรงกับแบบอ้างอิงที่เห็นตัวคนเบลอ ๆ ผ่านการ์ด
         */}
        <MeshTransmissionMaterial
          transmission={1}
          thickness={0.55}
          ior={1.28}
          roughness={0.26}
          anisotropicBlur={0.85}
          chromaticAberration={0.035}
          distortion={0.1}
          distortionScale={0.4}
          temporalDistortion={0}
          /**
           * บัฟเฟอร์ 256 ไม่พอ: ขอบทรงรูปที่ลอดผ่านการ์ดออกมาเป็นรอยหยักบันไดชัด ๆ
           * (เห็นบนจอ) เพราะภาพที่ลอดผ่านถูกอ่านจากบัฟเฟอร์ความละเอียดนั้นตรง ๆ
           */
          samples={6}
          resolution={768}
          background={GLASS_BG}
          color="#dcdee8"
          attenuationColor="#b9bcd0"
          attenuationDistance={2.4}
          envMapIntensity={1.9}
        />
      </RoundedBox>

      {/* เม็ดเลข — ทึบ ตัวเดียวในการ์ดที่ไม่โปร่ง ตาจึงจับตรงนี้ก่อน */}
      <group position={[-w / 2 + pad + 0.22, h / 2 - pad - 0.15, d / 2]}>
        <RoundedBox args={[0.44, 0.3, 0.06]} radius={0.14} smoothness={4} steps={1}>
          <meshStandardMaterial color="#ffffff" roughness={0.35} metalness={0} />
        </RoundedBox>
        <Center position-z={0.035}>
          <Text3D font={FONT} size={0.13} height={0.012} bevelEnabled={false}>
            {`0${i + 1}`}
            <meshStandardMaterial color="#16161c" roughness={0.5} />
          </Text3D>
        </Center>
      </group>

      {/* ชื่อสกิล — ตัวอักษรอัดหนา วางบนผิวหน้า จึงมีสันรับแสงเหมือนของนูนจริง */}
      <Text3D
        font={FONT}
        size={0.36}
        height={0.035}
        bevelEnabled
        bevelSize={0.003}
        bevelThickness={0.004}
        bevelSegments={1}
        position={[-w / 2 + pad, -h / 2 + pad + 0.06, d / 2]}
      >
        {SKILLS[i].title.toLowerCase()}
        {/* เรืองอ่อน ๆ ในตัว: ตัวหนังสือขาวบนกระจกที่หักเหของมืดอยู่ข้างหลังจะจมหายถ้าพึ่งแสงตกเท่านั้น */}
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.28}
          metalness={0.05}
          emissive="#ffffff"
          emissiveIntensity={0.18}
        />
      </Text3D>
      </group>
    </>
  )
}

/**
 * ตัวกดปุ่มเล่นท่า — จดเวลาที่ฉากเริ่มออกจากประตู ไว้ในนาฬิกาของฉากเอง
 *
 * ต้องจดจากใน `useFrame` ไม่ใช่จาก `performance.now()` ตอน effect วิ่ง เพราะลูปของแคนวาสนี้
 * ถูกหยุด (`frameloop="never"`) ตอนจอเลื่อนพ้นสายตา นาฬิกาของฉากจึงไม่เดินตามเวลาจริง
 * ถ้าจดเวลาจริงไว้ ตอนกลับมาดูซ้ำท่าจะเล่นจบไปแล้วก่อนเฟรมแรก
 *
 * `seq` เพิ่มขึ้นทุกครั้งที่จอเข้าสายตา — เท่ากับเล่นท่าซ้ำได้ทุกครั้งที่เลื่อนกลับมา
 */
function Starter({ seq, run }: { seq: number; run: React.MutableRefObject<number> }) {
  const done = useRef(-1)
  useFrame(({ clock }) => {
    if (done.current === seq) return
    done.current = seq
    run.current = clock.elapsedTime
  })
  return null
}

export function GlassScene({ seq }: { seq: number }) {
  const run = useRef(0)
  return (
    <>
      {/**
       * แสงเป็นแผงไฟที่ปั้นเอง ไม่ใช่ preset ของ drei
       *
       * preset ดึงไฟล์ HDR จาก CDN ข้างนอก — หน้าเว็บนี้ต้องขึ้นได้โดยไม่ต้องรอเน็ตคนอื่น
       * และกระจกต้องการ envmap เป็นตัวให้ไฮไลต์ ไม่ใช่ไฟดวง ๆ (ไฟจุดให้จุดสว่างจุดเดียว
       * แผ่นกระจกจะดูเหมือนพลาสติก)
       */}
      <Environment resolution={256}>
        {/**
         * คู่สีอุ่น-เย็น ไม่ใช่ขาวล้วน
         *
         * ไฟขาวทั้งฉากทำให้ผิวกระจกมีไฮไลต์สีเดียว แผ่นจึงอ่านเป็นพลาสติกเทา ของจริงรับสีจาก
         * สองฝั่งคนละอุณหภูมิ — เย็นจากฟ้าด้านซ้ายบน อุ่นจากพื้นด้านขวาล่าง (สีอุ่นหยิบจาก
         * ส้มของแบรนด์) ไฮไลต์เลยมีสองโทนไล่กันบนสันเดียว
         */}
        <Lightformer form="rect" intensity={2.4} color="#dceaff" position={[-4, 3, 4]} scale={[9, 5, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffc79a" position={[4.5, -2.5, 3]} scale={[7, 5, 1]} />
        {/* แถบบางสองเส้น: ไฟที่เลียบไปตามสันของแผ่น เป็นตัวที่ทำให้เห็นว่ามันหนา */}
        <Lightformer form="rect" intensity={5} color="#ffffff" position={[-1.2, 3.4, 1.5]} scale={[0.35, 6, 1]} rotation={[0, 0, Math.PI / 2.6]} />
        <Lightformer form="rect" intensity={3.2} color="#ffffff" position={[2.2, -3, 1.5]} scale={[0.3, 6, 1]} rotation={[0, 0, Math.PI / 3.4]} />
        <Lightformer form="circle" intensity={1.4} color="#ffffff" position={[1, 4, -3]} scale={[5, 5, 1]} />
        <color attach="background" args={['#eef0f4']} />
      </Environment>
      <ambientLight intensity={0.45} />
      <directionalLight position={[-2.5, 3, 4]} intensity={1.3} color="#eaf2ff" />
      <directionalLight position={[3, -2, 2]} intensity={0.6} color="#ffd0a8" />

      <Starter seq={seq} run={run} />
      <Photo />
      {CARDS.map((c, i) => (
        <Card key={c.cx} i={i} run={run} />
      ))}
    </>
  )
}
