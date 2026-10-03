import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import bubbleSvg from '@/assets/v2final/hero-ideas-bubble.svg?raw'
import { useCursorStop } from '@/cursorguide/useCursorStop'
import { BEAT, SKY_LEAVE, at } from '@/sections/skystory/beats'
import { bentoBlobs, headOf, liquidGeo, sproutShift } from './LiquidBento'
import { useTuner } from '@/newhero/tuner'
import { FONT, GLASS_BG, StageLight } from './Headline3D'
import { bubbleTravel, setBubbleAway, setHeadBubbleLive, subscribeBubbleAway } from './bubbleTravel'

/**
 * ฟองคำพูดของหัวเรื่องออกเดินทางลงไปเล่าต่อใน What I do — ใบเดียวกัน ไหลต่อเนื่องตามการเลื่อน
 *
 * ฟองในหัวเรื่องอยู่ในแคนวาสของหัวเรื่อง ซึ่งอยู่ใต้ม่านเมฆ (CloudWipe) และจบแค่ที่จอแรก ใบที่เดินทาง
 * จึงเป็นชั้นของตัวเอง ตรึงเต็มจอ *เหนือ* ม่านเมฆ — วาดด้วยกล้องออร์โธหน่วยพิกเซลแบบเดียวกับแคนวาส
 * หัวเรื่อง วัสดุแก้วชุดเดียวกัน ทรงเดียวกัน (ไฟล์ SVG เดียวกัน) จึงรับไม้ต่อได้โดยไม่มีรอย
 *
 *   เลื่อนเริ่ม   ฟองหลุดจากที่ของมันในหัวเรื่อง (ใบในหัวเรื่องหลบ) ลอยเข้ากลางจอ ขยายขึ้น
 *   ระหว่างทาง   จุดกำลังพิมพ์ "..." → พิมพ์ "Hello, I'm Joe" ทีละตัว ฟองยืดตามความยาวข้อความ
 *   ม่านเมฆ      ฟองหมุนส่ายช้า ๆ ระหว่างม่านพาไปจอถัดไป
 *   What I do    ลบคำทักทาย → พิมพ์ "Here is what I do" → ปุ่มกลมหนึ่งปุ่มต่อสกิลงอกจากท้ายฟอง
 *                → ปุ่มไหลลงเป็นช่อง bento เต็มจอ ฟองลอยขึ้นเป็นแถบบนสุด (ดู ./LiquidBento)
 *
 * ทุกท่าคิดจากตำแหน่งเลื่อนล้วน ๆ เลื่อนกลับแล้วถอยกลับจนฟองกลับเข้าที่ในหัวเรื่อง
 */

/** สองจังหวะของฟอง: ทักทาย (ระหว่างทางลงมา) แล้วบอกว่าจะพาไปดูอะไร (ในฟ้าของ What I do) */
/** จอถัดไปที่ปุ่มพาไป — กองหน้าต่าง Mac (sections/whatidocard) */
export const NEXT_ID = 'what-i-do-windows'

const LINES = ["Hello, I'm Joe", 'Here is what I do'] as const
/** viewBox ของไฟล์ฟอง — ทรงถูกยืดตรงกลาง ส่วนโค้งหัวท้ายคงเดิม (ดู ./LiquidBento) */
const VB_W = 211
const VB_H = 99
/** ตัวอักษรในหน่วย viewBox — ระยะขอบซ้าย (พ้นหาง) / ขวา (พ้นโค้งหัว) */
const FS = 32
const PAD_L = 38
const PAD_R = 40
const INK = '#2052cd'

const WHITE = new THREE.Color('#ffffff')
const TMP_C = new THREE.Color()
const SHEAR = new THREE.Matrix4()
/** ความทึบของแก้ว — ในหัวเรื่อง / บนฟ้าของ What I do (ฉากหลังสำรองของแก้วอ่อนกว่าฟ้าจริง ทึบเท่ากันจะเป็นแผ่นซีด) */
const SW_OPACITY = 0.85
const SW_OPACITY_SKY = 0.6

/**
 * ไฟขอบฝั่งซ้ายแบบเดียวกับราง switch ใน hero (rim ของ CameraFX: ไฟจากซ้าย 180° สี #fff3dc) — แสงเกาะ
 * ขอบมนที่หันไปทางไฟ ไม่ใช่เส้นขอบรอบตัว หน้าที่หันหากล้องตรง ๆ ไม่ติด
 *
 * ฉากนี้ไม่มีพาสหลังภาพ (CameraFX) จึงคิดจากทิศผิวของเมชเอง: ขอบมนครึ่งความหนาของฟองหมุนทิศผิว
 * จากหน้า (z) ไปข้าง ฝั่งที่หันซ้ายจึงได้แถบแสงกว้างเท่าขอบมนพอดี วาดซ้อนบนเมชเดียวกันเป็นสีขาวนวล
 */
const RIM_COLOR = new THREE.Color('#fff3dc')
function makeRimMat() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    uniforms: { uColor: { value: RIM_COLOR }, uInt: { value: 0.85 } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      void main() {
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uInt;
      varying vec3 vN;
      void main() {
        vec3 n = normalize(vN);
        // แสงนวลแผ่ทั้งขอบมนฝั่งซ้าย (ผสมทับแบบสีขาว ไม่ใช่บวกแสง) — บวกแสงได้เส้นจ้าบางที่อ่านเป็นโลหะ
        float side = clamp(-n.x * 1.4, 0.0, 1.0);
        float edge = smoothstep(0.0, 0.35, 1.0 - n.z);
        // ขอบมนด้านอื่นจางขาวนิด ๆ กลบขอบมืดของแก้ว (ตรงที่แสงลอดเนื้อแก้วหนาสุด) ขอบจึงไม่ขึ้นเงาเป็นโลหะ
        float r = max(pow(side, 0.7) * uInt, 0.28) * edge;
        gl_FragColor = vec4(uColor, r);
      }`,
  })
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** ท่าของเฟรมนี้ — คิดจากการเลื่อน อ่านในลูปเฟรม ไม่ผ่าน React */
type Pose = { on: boolean; x: number; y: number; h: number; rot: number; dots: number; line: number; chars: number; clear: number; sv: number; turn: number; spin: number; sprout: number; morph: number; hand: number; lift: number; rise: number; white: number }

function readPose(): Pose {
  const off: Pose = { on: false, x: 0, y: 0, h: 0, rot: 0, dots: 0, line: 0, chars: 0, clear: 0, sv: 0, turn: 0, spin: 0, sprout: 0, morph: 0, hand: 0, lift: 0, rise: 0, white: 0 }
  const vw = window.innerWidth
  const vh = window.innerHeight || 1
  const el = document.querySelector<HTMLElement>('.v3-hero-bubble')
  const story = document.getElementById('what-i-do')
  if (!el || !story) return off
  const sv = window.scrollY / vh
  const r = el.getBoundingClientRect()
  const sr = story.getBoundingClientRect()
  /** ระยะที่เลื่อนเข้ามาใน What I do แล้ว (หน่วยความสูงจอ) — จังหวะที่สองของฟองนับจากตรงนี้ */
  const sv2 = Math.max(0, -sr.top / vh)
  /* กล้องร่วงลงหมอก (เมื่อเปิดเรื่องพวงกุญแจ) หรือส่งไม้ให้หน้าต่างใบจริงเสร็จ = ชั้นนี้ปิด */
  const p2 = Math.min(1, Math.max(0, -sr.top / Math.max(1, sr.height - vh)))
  const rise = smooth((p2 - SKY_LEAVE) / 0.06)
  /**
   * จอถัดไป (กองหน้าต่าง Mac — WhatIDoCard) เลื่อนขึ้นมาแล้วตรึงที่ขอบบน = ส่งไม้ให้หน้าต่างใบจริง
   */
  const next = document.getElementById(NEXT_ID)
  const glue = next ? next.getBoundingClientRect().top : vh
  const hand = clamp01(-glue / (vh * 0.12))
  /* ใบนี้คือฟองใบเดียวของหน้า — นั่งในหัวเรื่องตั้งแต่หัวเรื่องโผล่ (ใบในหัวเรื่องไม่วาด ดู Headline3D) */
  if (!bubbleTravel.live || rise >= 1 || hand >= 1 || r.height < 1) return off
  const d = smooth((sv - 0.03) / 0.42)
  const h1 = Math.min(vh * 0.17, 150)
  /**
   * ความสูงจริงของฟองในหัวเรื่อง — ไม่ใช่ r.height: หัวเรื่องถูกบิด skewY(-5deg) กรอบที่วัดได้จึงสูงกว่าตัวฟอง
   * (บวกความกว้าง × tan 5°) เคยทำให้ใบที่เดินทางพองใหญ่กว่าใบเดิมตอนรับไม้ skew ไม่เปลี่ยนความกว้าง
   * r.width / offsetWidth จึงเป็นสเกลจริงของทรานส์ฟอร์มอื่นที่ครอบอยู่
   */
  const h0 = el.offsetHeight * (r.width / Math.max(1, el.offsetWidth))
  /* ปุ่มกลายเป็น bento: ฟองลอยขึ้นไปเป็นแถบบนสุด ช่องไหลลงมาเต็มจอใต้ฟอง */
  const morph = smooth(at(sv2, BEAT.morph))
  const lift = Math.min(0, glue - vh)
  const head = headOf(morph)
  return {
    on: true,
    x: lerp(r.left + r.width / 2, vw / 2, d),
    y: lerp(lerp(r.top + r.height / 2, vh * 0.5, d), Math.max(16, vh * 0.035) + h1 * 0.62, head) + lift,
    h: lerp(lerp(h0, h1, d), h1 * 0.8, head),
    /* หัวเรื่องถูกบิด skewY(-5deg) — ตอนยังอยู่ที่เดิมฟองบิดตาม (เฉือน ไม่ใช่หมุน) แล้วค่อยตั้งตรง */
    rot: (1 - d) * Math.tan((5 * Math.PI) / 180),
    /* ระหว่างทางลงมา (ช่วงจอแรก + ม่านเมฆ) มีแต่จุดกำลังพิมพ์ ข้อความรอพิมพ์ในฟ้าของ What I do */
    dots: smooth((sv - 0.14) / 0.08) * (1 - smooth((sv2 - BEAT.greet[0]) / 0.05)),
    /* ใน What I do: พิมพ์คำทักทาย → ค้างให้อ่าน → ลบทีละตัว → พิมพ์ประโยคที่สอง */
    ...(sv2 < BEAT.erase[0] + BEAT.erase[1]
      ? { line: 0, chars: Math.round(at(sv2, BEAT.greet) * (1 - at(sv2, BEAT.erase)) * LINES[0].length) }
      : { line: 1, chars: Math.round(at(sv2, BEAT.line2) * LINES[1].length) }),
    /* พิมพ์จบแล้ว ปุ่มกลมหนึ่งปุ่มต่อสกิลงอกออกมาจากท้ายฟอง (ท่า Spotlight) */
    sprout: smooth(at(sv2, BEAT.sprout)),
    morph,
    hand,
    /* bento ติดท้าย section — จอถัดไปเลื่อนขึ้นมา bento ก็เลื่อนขึ้นไปด้วย */
    lift,
    rise,
    /* หมึกน้ำเงินอ่านออกบนม่านเมฆขาว แต่จมหายบนฟ้าของ What I do — เข้าฟ้าแล้วเปลี่ยนเป็นขาว */
    white: smooth((sv2 - 0.05) / 0.25),
    /* ออกจากหัวเรื่องแล้ว = แก้วใสขึ้น (ดู Bubble) */
    clear: d,
    sv,
    /* ช่วงม่านเมฆพาไปจอถัดไป (ราว sv 0.4–1.2) ฟองหมุนช้า ๆ — ขึ้นเป็นระฆัง ไม่กระชาก */
    turn: smooth((sv - 0.36) / 0.2) * (1 - smooth((sv - 1.05) / 0.35)),
    /* หนึ่งรอบเต็มรอบแกนตั้ง ตลอดช่วงม่านเมฆ — ออกตัวช้า จบช้า */
    spin: smooth((sv - 0.4) / 0.8),
  }
}

function Bubble({ pose, wake }: { pose: React.RefObject<Pose>; wake: React.RefObject<() => void> }) {
  const t = useTuner()
  const font = useLoader(FontLoader, FONT)
  const { invalidate } = useThree()
  /* วาดตามคำสั่ง — การเลื่อน/ปรับขนาดปลุกผ่านช่องนี้ (ดู BubbleTraveler) ตอนนิ่งในหัวเรื่องไม่วาดซ้ำทุกเฟรม */
  /*
   * ขอสามเฟรม ไม่ใช่เฟรมเดียว: แก้วหักเหวาดภาพข้างหลังลงบัฟเฟอร์ก่อนที่ฉากของเฟรมนี้จะอัปเดต
   * วาดเฟรมเดียวแล้วหยุด แก้วจะค้างภาพของเฟรมก่อน (ข้อความเก่าซ้อนจาง ๆ ในฟอง)
   */
  useEffect(() => {
    wake.current = () => invalidate(3)
  }, [wake, invalidate])
  const shapes = useMemo(() => {
    const data = new SVGLoader().parse(bubbleSvg)
    return data.paths.flatMap((p) => SVGLoader.createShapes(p))
  }, [])
  /** เส้นขอบฟองจากไฟล์ (พิกัด viewBox แกน y ชี้ลง) — ทรงตั้งต้นของสนามระยะ (ดู ./LiquidBento) */
  const outline = useMemo(() => new Float32Array(shapes[0].getPoints(48).flatMap((v) => [v.x, v.y])), [shapes])

  /** ข้อความทุกความยาวของทั้งสองประโยค ปั้นไว้ครั้งเดียว — พิมพ์/ลบทีละตัวแค่สลับชิ้น */
  const texts = useMemo(() => {
    const opts = { font, size: FS, depth: 3, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.5, bevelSegments: 2 }
    /* เส้นกลางแนวตั้งคิดจากประโยคแรกเต็ม ๆ ทั้งสองประโยค — ตัวอักษรไม่กระโดดขึ้นลงตอนสลับ */
    const full = new TextGeometry(LINES[0], opts)
    full.computeBoundingBox()
    const fb = full.boundingBox as THREE.Box3
    const midY = (fb.min.y + fb.max.y) / 2
    full.dispose()
    return LINES.map((line) =>
      Array.from({ length: line.length + 1 }, (_, n) => {
        if (n === 0) return { geo: null, w: 0, midY }
        const geo = new TextGeometry(line.slice(0, n), opts)
        geo.computeBoundingBox()
        const b = geo.boundingBox as THREE.Box3
        return { geo, w: b.max.x - b.min.x, midY }
      }),
    )
  }, [font])
  useEffect(() => () => texts.flat().forEach((x) => x.geo?.dispose()), [texts])

  /**
   * หมึกไม่ผ่านตัวแมปโทน + เรืองในตัวครึ่งหนึ่ง — ไฟเวทีของแก้ว (Environment สว่างจัด) ล้างสีน้ำเงิน
   * ให้ซีดเป็นฟ้าหม่นจนตัวอักษรจมหายในฟอง ยังรับแสงอยู่ ความหนาของตัวจึงยังอ่านออก
   */
  const inkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: INK, emissive: INK, emissiveIntensity: 0.45, roughness: 0.5, envMapIntensity: 0.25, toneMapped: false }),
    [],
  )
  const dotGeo = useMemo(() => new THREE.SphereGeometry(5.5, 20, 14), [])
  useEffect(
    () => () => {
      inkMat.dispose()
      dotGeo.dispose()
    },
    [inkMat, dotGeo],
  )

  const root = useRef<THREE.Group>(null)
  const rim = useRef<THREE.Mesh>(null)
  const rimMat = useMemo(makeRimMat, [])
  useEffect(() => () => rimMat.dispose(), [rimMat])
  const shell = useRef<THREE.Mesh>(null)
  const ink = useRef<THREE.Mesh>(null)
  const dots = useRef<(THREE.Mesh | null)[]>([])
  /** ความกว้างฟองตอนนี้ (หน่วย viewBox) — ไล่ตามความยาวข้อความ ไม่กระโดดทีละตัว */
  const width = useRef(VB_W)
  const built = useRef('')
  const geo = useRef<THREE.BufferGeometry | null>(null)
  useEffect(() => () => geo.current?.dispose(), [])

  useFrame(({ clock, size }, dt) => {
    const p = pose.current
    const g = root.current
    if (!p || !g || !p.on) return
    const tx = texts[p.line][p.chars]
    const want = Math.max(VB_W, PAD_L + tx.w + PAD_R)
    width.current += (want - width.current) * (1 - Math.exp(-dt * 14))
    const w = width.current
    /* จอแคบ: ข้อความเต็มประโยคต้องไม่ล้นจอ — ย่อฟองให้ความกว้างสุดท้ายอยู่ในจอ 88% */
    const full = PAD_L + Math.max(texts[0][LINES[0].length].w, texts[1][LINES[1].length].w) + PAD_R
    const s0 = p.h / VB_H
    const s = lerp(s0, Math.min(s0, (size.width * 0.88) / full), p.clear)
    /* ปุ่มงอกทางขวา — ฟองหลบไปทางซ้ายให้ทั้งแถว (ฟอง + ปุ่ม) อยู่กลางจอ */
    const shift = sproutShift(VB_H * s, p)
    g.position.set(p.x - shift - size.width / 2, size.height / 2 - p.y, 0)
    /**
     * ทรงของฟองเฟรมนี้ — ปั้นจากสนามระยะที่ตั้งต้นจากเส้นขอบในไฟล์ SVG ตลอดทาง พอปุ่มงอก (sprout → morph)
     * ปุ่มกับช่องหลอมเข้ามาในสนามเดียวกัน (ดู ./LiquidBento) — เมชเดียว วัสดุแก้วตัวเดิม ไม่มีจังหวะสลับทรง
     * ปั้นใหม่เฉพาะตอนทรงเปลี่ยน (ความกว้างตามข้อความ / ปุ่มกำลังไหล) ช่วงค้างไม่ปั้น
     */
    {
      const bw = w * s
      const bh = VB_H * s
      const liquid = bentoBlobs(p, { x: p.x - shift - bw / 2, y: p.y - bh / 2, w: bw, h: bh, s }, size.width, size.height)
      const wq = Math.round(w / 0.6) * 0.6
      const fullKey = `${wq.toFixed(1)}|${liquid.k.toFixed(2)}|${liquid.blobs.map((o) => `${o.x.toFixed(1)},${o.y.toFixed(1)},${o.hw.toFixed(1)},${o.hh.toFixed(1)},${o.r.toFixed(1)}`).join('|')}|${t.bbThick}|${t.bbRound}`
      if (!geo.current || built.current !== fullKey) {
        geo.current?.dispose()
        geo.current = liquidGeo(outline, wq, liquid.blobs, liquid.k, t.bbThick, t.bbRound)
        built.current = fullKey
        if (shell.current) shell.current.geometry = geo.current
        if (rim.current) rim.current.geometry = geo.current
      }
    }
    g.scale.setScalar(s)
    /**
     * หมุนแบบลอยตามลม ระหว่างม่านเมฆพาไปจอถัดไป — ควงหนึ่งรอบเต็มรอบแกนตั้งอย่างช้า ๆ
     * พร้อมเงยก้มกับเอียงเล็กน้อย มุมผูกกับระยะเลื่อน (หยุดเลื่อนหยุดหมุน) บวกการหายใจตามเวลา
     * (เคยแค่ส่าย ±0.4 rad — บนกล้องออร์โธแทบมองไม่เห็นว่าหมุน)
     */
    const tt = clock.elapsedTime
    g.rotation.set(
      (Math.sin(p.sv * 3.1 + 1) * 0.22 + Math.sin(tt * 0.7) * 0.04) * p.turn,
      p.spin * Math.PI * 2 + Math.sin(tt * 0.5) * 0.06 * p.turn,
      Math.sin(p.sv * 2.3) * 0.1 * p.turn,
    )
    /**
     * เฉือนแบบเดียวกับ skewY ของหัวเรื่อง (ขอบตั้งยังตั้งตรง ขอบนอนเอียง) — หมุนแทนไม่ได้ ขอบตั้งจะเอียงตาม
     * ทรงจึงไม่ทาบใบเดิมตอนรับไม้ ต่อเมทริกซ์เองเพราะ three ไม่มีช่องเฉือนในตำแหน่ง/หมุน/สเกล
     */
    g.updateMatrix()
    if (p.rot) g.matrix.multiply(SHEAR.makeShear(p.rot, 0, 0, 0, 0, 0))
    /**
     * แก้วใสขึ้นเมื่อออกจากหัวเรื่อง
     *
     * วัสดุหักเหได้แค่ของในแคนวาสตัวเอง (ว่าง) จึงเห็น "ฉากหลังสำรอง" สีฟ้าอ่อนคงที่ (GLASS_BG)
     * ตรงกับฟ้าหลังหัวเรื่องพอดี แต่บนฟ้าของ What I do ที่เข้มกว่า มันกลายเป็นแผ่นฟ้าหม่นทึบ ๆ
     * ลดความทึบลง = ฟ้าจริงของหน้าทะลุขึ้นมาผ่านอัลฟาของแคนวาส ขอบกับไฮไลต์ยังอยู่เหมือนเดิม
     */
    const gm = shell.current?.material as THREE.Material | undefined
    if (gm) gm.opacity = lerp(SW_OPACITY, SW_OPACITY_SKY, p.clear)

    TMP_C.set(INK).lerp(WHITE, p.white)
    inkMat.color.copy(TMP_C)
    inkMat.emissive.copy(TMP_C)
    const m = ink.current
    if (m) {
      m.material = inkMat
      m.visible = !!tx.geo
      if (tx.geo) {
        m.geometry = tx.geo
        m.position.set(-w / 2 + PAD_L, -tx.midY + 2, t.bbThick / 2 + 1)
      }
    }
    const inner = (PAD_L - PAD_R) / 2
    dots.current.forEach((d, i) => {
      if (!d) return
      d.visible = p.dots > 0.01
      d.scale.setScalar(p.dots)
      d.position.set(inner + (i - 1) * 17, Math.max(0, Math.sin(clock.elapsedTime * 7 - i * 0.9)) * 6, t.bbThick / 2 + 4)
    })

    /* ยังขยับเองอยู่ (จุดกำลังพิมพ์ ลอยตามลม ฟองยืดตามข้อความ) = ขอเฟรมต่อ นอกนั้นรอการเลื่อนปลุก */
    if (p.dots > 0.01 || p.turn > 0 || Math.abs(want - width.current) > 0.3) invalidate(3)
  })

  return (
    <>
      <group ref={root} matrixAutoUpdate={false}>
        <mesh ref={shell}>
          {/**
           * แก้วชุดเดียวกับราง switch ใน hero (ดู newhero/Switch, ค่า bc* ในแผงจูน) — แบนและทึบกว่าแก้วฟองเดิม
           * ior 1 (ไม่หักเหบิด), ไม่แยกสี ไม่มีรุ้ง, สะท้อนแผงไฟเบา ๆ, เนื้อขาวอมม่วงอ่อน (#dfe3ff)
           * แก้วฟองเดิม (ior 2 + แยกสี + รุ้ง + แผงไฟแรง) ขอบมนจับแสงมืด-สว่างสลับเป็นวง อ่านเป็นโลหะ
           */}
          <MeshTransmissionMaterial
            transmission={1}
            thickness={t.bbThick * 0.9}
            ior={1}
            roughness={0}
            anisotropicBlur={1.9}
            chromaticAberration={0}
            envMapIntensity={0.3}
            distortion={0}
            samples={6}
            resolution={1024}
            attenuationDistance={t.bbThick * 9}
            attenuationColor="#dfe3ff"
            background={GLASS_BG}
            transparent
            opacity={SW_OPACITY}
          />
        </mesh>
        {/* ไฟขอบซ้าย — เมชเดียวกับแก้ว วาดทับแบบบวกแสง · ซ่อนตอนแก้วถ่ายภาพข้างหลัง ไม่งั้นแก้วหักเหแสงขอบซ้ำ */}
        <mesh
          ref={rim}
          material={rimMat}
          renderOrder={2}
          onBeforeRender={(renderer) => {
            rimMat.colorWrite = renderer.getRenderTarget() === null
          }}
        />
        <mesh ref={ink} material={inkMat} />
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            geometry={dotGeo}
            material={inkMat}
            ref={(d) => {
              dots.current[i] = d
            }}
          />
        ))}
      </group>
    </>
  )
}

export function BubbleTraveler() {
  const t = useTuner()

  /** ตำแหน่งจริงของ section (หน่วยจอ) — จุดพักของเคอร์เซอร์อิงจากตรงนี้ วัดใหม่เมื่อจอเปลี่ยนขนาด */
  const [top, setTop] = useState<number | undefined>(undefined)
  useEffect(() => {
    const measure = () => {
      const el = document.getElementById('what-i-do')
      const vh = window.innerHeight || 1
      if (el) setTop((el.getBoundingClientRect().top + window.scrollY) / vh)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  /**
   * เคอร์เซอร์นำสายตาพักใต้มุมขวาล่างตลอด section — ไม่มีอะไรให้กดแล้ว (ปุ่มงอกเอง) ถ้าไม่พักไว้
   * มันจะลอยข้ามกลางฉากไปหาจุดจอดของ section ถัดไป
   */
  const park = { x: 0.9, y: 1.12 }
  useCursorStop(null, { id: 'bubble-park-in', at: park, keyVh: top === undefined ? undefined : top + 0.5, size: 54, tilt: -14 })
  useCursorStop(null, { id: 'bubble-park-after', at: park, keyVh: top === undefined ? undefined : top + BEAT.morph[0] + BEAT.morph[1] + 0.5, size: 54, tilt: -14 })
  const pose = useRef<Pose>({ on: false, x: 0, y: 0, h: 0, rot: 0, dots: 0, line: 0, chars: 0, clear: 0, sv: 0, turn: 0, spin: 0, sprout: 0, morph: 0, hand: 0, lift: 0, rise: 0, white: 0 })
  const [on, setOn] = useState(false)
  const wake = useRef<() => void>(() => {})

  /* อ่านท่าทุกเฟรมที่มีการเลื่อน/ปรับขนาด — setState เฉพาะตอนเปิด/ปิดชั้น ไม่ใช่ทุกเฟรม */
  useEffect(() => {
    let raf = 0
    let was = false
    let last = ''
    const read = () => {
      raf = 0
      const p = readPose()
      pose.current = p
      if (p.on !== was) {
        was = p.on
        setOn(was)
      }
      /* เปลี่ยนจริงค่อยวาด — ตอนนิ่งในหัวเรื่องไม่วาดซ้ำ */
      const sig = `${p.on}|${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.h.toFixed(1)}|${p.sv.toFixed(4)}`
      if (sig !== last) {
        last = sig
        wake.current()
      }
      /* อยู่ในหัวเรื่อง: หัวเรื่องขยับเองได้ (ท่าเปิดตัว) โดยไม่มีการเลื่อน — ตามกรอบมันทุกเฟรม (อ่านกรอบถูกมาก) */
      if (p.on && p.sv < 0.05) kick()
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    /* ใบในหัวเรื่องไม่วาดเลยบนหน้านี้ — ใบนี้แทนตลอด */
    setBubbleAway(true)
    const unsub = subscribeBubbleAway(kick)
    read()
    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    return () => {
      cancelAnimationFrame(raf)
      unsub()
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
      setBubbleAway(false)
      setHeadBubbleLive(false)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-[52]" style={{ visibility: on ? 'visible' : 'hidden' }} aria-hidden>
      <Canvas
        frameloop={on ? 'demand' : 'never'}
        dpr={[1, 1.75]}
        orthographic
        camera={{ position: [0, 0, 400], zoom: 1, near: 1, far: 1200 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.35} />
        <directionalLight position={[220, 320, 420]} intensity={1.75} />
        <directionalLight position={[-260, -140, 260]} intensity={0.6} />
        <StageLight gain={t.bbGlow} />
        <Suspense fallback={null}>
          <Bubble pose={pose} wake={wake} />
        </Suspense>
      </Canvas>
    </div>
  )
}
