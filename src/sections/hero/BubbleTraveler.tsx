import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import bubbleSvg from '@/assets/v2final/hero-ideas-bubble.svg?raw'
import penNibSvg from '@/assets/icons/pen-nib.svg?raw'
import { useCursorStop } from '@/cursorguide/useCursorStop'
import { BEAT, SKY_LEAVE, at } from '@/sections/skystory/beats'
import { headOf, liquidGeo, skillBlobs, sproutShift } from './LiquidBento'
import { FW, panelBox, panelLayout } from './ServiceTrack'
import { IsoSkills } from './IsoSkills'
import { FallSky } from './FallSky'
import { ISO_Q, SIGN_H, magStart, signCenter } from './isoStage'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { makeLiquidGlass } from './liquidGlass'
import { useTuner } from '@/newhero/tuner'
import { StageLight } from './Headline3D'
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
 *                → ฟองพิมพ์ What I Do แล้วกลายเป็นหัวข้อมุมซ้ายบน วงกลมแยกไปจอดใต้หัวข้อ
 *                → รางเล่าบริการทีละหน้าเลื่อนแนวนอน (ดู ./ServiceTrack · แบบ Figma 1572:3831)
 *
 * ทุกท่าคิดจากตำแหน่งเลื่อนล้วน ๆ เลื่อนกลับแล้วถอยกลับจนฟองกลับเข้าที่ในหัวเรื่อง
 */

/** สองจังหวะของฟอง: ทักทาย (ระหว่างทางลงมา) แล้วบอกว่าจะพาไปดูอะไร (ในฟ้าของ What I do) */
/** จอถัดไปที่ปุ่มพาไป — กองหน้าต่าง Mac (sections/whatidocard) */
export const NEXT_ID = 'what-i-do-windows'

/**
 * จังหวะของฟอง: ทักทาย → บอกว่าจะพาไปดูอะไร → เป็นหัวพาเนล = ชื่อบริการของหน้าที่เปิดอยู่ (UX/UI, …)
 * เลื่อนข้ามหน้า หัวพาเนลลบชื่อเดิมแล้วพิมพ์ชื่อบริการถัดไป
 */
/** ชื่อสกิลบนป้าย ตามลำดับแผ่นในฉากไอโซ (ดู ./IsoSkills) */
const NAMES = ['Research', 'UX/UI', 'Coding'] as const
/** ชื่อใน WhatIDo ของแต่ละแผ่น — คำอธิบายจริงมาจากที่นั่น */
const SKILL_OF = ['Research', 'Design', 'Coding'] as const
/** คำอธิบายใต้ขวาของแต่ละแผ่น (Research ยังเป็น Lorem รอเขียน — ไม่แสดง) */
const DESCS = SKILL_OF.map((t) => (t === 'Research' ? '' : (SKILLS.find((k) => k.title === t)?.desc ?? '')))
const LINES = ["Hello, I'm Joe", 'Here is what I do', ...NAMES] as const
/**
 * ข้อความในฟองน้ำหนักปกติ — Momo Trust Sans Regular (ครอบครัวเดียวกับ Momo Trust Display ของหัวเรื่อง
 * ซึ่งมีน้ำหนักเดียวคือหนา) แปลงจากไฟล์ static ของ Google Fonts — ไม่ใช่ไฟล์ variable: ตัวนั้นเส้นขอบตัวอักษร
 * ซ้อนทับกัน (เช่น w) อัดขึ้นรูปแล้วเติมเนื้อผิดเป็นสามเหลี่ยมทึบ (OFL ดู public/fonts/momo-trust-sans-OFL.txt)
 * เก็บเฉพาะ ASCII ที่พิมพ์ได้
 */
const FONT = '/fonts/momo-trust-sans.json'
/** viewBox ของไฟล์ฟอง — ทรงถูกยืดตรงกลาง ส่วนโค้งหัวท้ายคงเดิม (ดู ./LiquidBento) */
const VB_W = 211
const VB_H = 99
/** ตัวอักษรในหน่วย viewBox — ระยะขอบซ้าย (พ้นหาง) / ขวา (พ้นโค้งหัว) */
const FS = 32
const PAD_L = 38
const PAD_R = 40
/** ช่องค้นหา: ที่ของแว่นขยายหน้าข้อความ / ช่องของเคอร์เซอร์ท้ายข้อความ (หน่วย viewBox) */
const SEARCH_LEAD = 40
const CARET_GAP = 10
const INK = '#2052cd'
/** หมึกบนป้าย — เส้นดำของฉากไอโซ */
const SIGN_INK = new THREE.Color('#17171c')

const WHITE = new THREE.Color('#ffffff')
const TMP_C = new THREE.Color()
const SHEAR = new THREE.Matrix4()
const SIGN_P = new THREE.Vector3()


const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const inOut01 = (x: number) => {
  const u = clamp01(x)
  return u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2
}

/** ท่าของเฟรมนี้ — คิดจากการเลื่อน อ่านในลูปเฟรม ไม่ผ่าน React */
const POSE0 = { on: false, x: 0, y: 0, h: 0, rot: 0, dots: 0, line: 0, chars: 0, clear: 0, sv: 0, turn: 0, spin: 0, search: 0, sprout: 0, head: 0, paint: 0, stage: 0, slide: 0, hand: 0, lift: 0, rise: 0, white: 0, iso: 0, grow: 0, page: 0, mag: 0, tuck: 0, fall: 0, prog: 0, act: [0, 0, 0] }
type Pose = { on: boolean; x: number; y: number; h: number; rot: number; dots: number; line: number; chars: number; clear: number; sv: number; turn: number; spin: number; search: number; sprout: number; head: number; paint: number; stage: number; slide: number; hand: number; lift: number; rise: number; white: number; iso: number; grow: number; page: number; mag: number; tuck: number; fall: number; prog: number; act: number[] }

/**
 * ป้ายตอนนี้ = ชื่อสกิลของแผ่นที่ใกล้ป้ายที่สุด พิมพ์เต็มตอนแผ่นอยู่ใต้ป้าย ลบหมดตอนเลื่อนถึงครึ่งทางไปแผ่นถัดไป
 * แล้วพิมพ์ชื่อถัดไป · ครั้งแรกพิมพ์ตาม BEAT.name
 */
function skillTitle(name: number, page: number) {
  const n = Math.round(page)
  const near = clamp01((1 - 2 * Math.abs(page - n)) * 1.6)
  const line = 2 + n
  return { line, chars: Math.round(name * near * LINES[line].length) }
}

/**
 * ทัวร์สามแผ่น: แต่ละแผ่นจอดนิ่งใต้ป้ายให้เรื่องบนแผ่นเล่นจบ (act 0→1) แล้วค่อยไหลไปแผ่นถัดไป
 * t = ความคืบหน้าของ BEAT.tour · จอด 0.28 / ไหล 0.08 สลับกัน
 */
function tourAt(t: number) {
  const HOLD = 0.28
  const MOVE = 0.08
  const n = NAMES.length
  let page = 0
  const act: number[] = []
  for (let i = 0; i < n; i += 1) {
    const s = i * (HOLD + MOVE)
    act.push(clamp01((t - s - 0.01) / (HOLD - 0.03)))
    if (i < n - 1) page += smooth((t - s - HOLD) / MOVE)
  }
  return { page, act }
}

function readPose(): Pose {
  const off: Pose = { ...POSE0 }
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
  /* พิมพ์จบ ปุ่มงอก แล้วฟองกับแถวปุ่มลอยขึ้นไปเป็นแถบบนสุด — ใต้แถบคือรางบริการ (ดู ./ServiceTrack) */
  const up = 0
  const { page, act } = tourAt(at(sv2, BEAT.tour))
  const lift = Math.min(0, glue - vh)
  /**
   * ฟองขยายเป็นพาเนลแบบหน้าต่าง Spotlight กลางจอ (ดู panelLayout) — ตัวพาเนลคือฟองเอง:
   * ฟองยุบหายเข้าไปในก้อนแก้วที่พองจากตัวมันออกไปเป็นพาเนล ข้อความลอยไปเป็นหัวพาเนล
   * ไอคอนไปอยู่หน้าข้อความ วงกลมไหลเข้าไปเป็นจุดบอกหน้าที่มุมขวาของหัวพาเนล (ดู skillBlobs)
   * กลางกลุ่ม = กลางพาเนล · สเกลให้ตัวอักษรสูง 26 ต่อกรอบแบบ 1280 (FS 32 หน่วย)
   */
  const head = headOf(up)
  const sh = vw / FW
  const pl = panelLayout(vw, vh)
  const barY = pl.cy
  const barH = VB_H * ((26 * sh) / FS)
  return {
    on: true,
    x: lerp(r.left + r.width / 2, vw / 2, d),
    y: lerp(lerp(r.top + r.height / 2, vh * 0.5, d), barY, head) + lift,
    h: lerp(lerp(h0, h1, d), barH, head),
    /* หัวเรื่องถูกบิด skewY(-5deg) — ตอนยังอยู่ที่เดิมฟองบิดตาม (เฉือน ไม่ใช่หมุน) แล้วค่อยตั้งตรง */
    rot: (1 - d) * Math.tan((5 * Math.PI) / 180),
    /* ระหว่างทางลงมา (ช่วงจอแรก + ม่านเมฆ) มีแต่จุดกำลังพิมพ์ ข้อความรอพิมพ์ในฟ้าของ What I do */
    dots: smooth((sv - 0.14) / 0.08) * (1 - smooth((sv2 - BEAT.greet[0]) / 0.05)),
    /* ใน What I do: พิมพ์คำทักทาย → ค้างให้อ่าน → ลบทีละตัว → พิมพ์ประโยคที่สอง */
    ...(sv2 < BEAT.erase[0] + BEAT.erase[1]
      ? { line: 0, chars: Math.round(at(sv2, BEAT.greet) * (1 - at(sv2, BEAT.erase)) * LINES[0].length) }
      : sv2 < BEAT.unsay[0] + BEAT.unsay[1]
        ? { line: 1, chars: Math.round(at(sv2, BEAT.line2) * (1 - at(sv2, BEAT.unsay)) * LINES[1].length) }
        : skillTitle(at(sv2, BEAT.name), page)),
    /* พิมพ์จบแล้ว ปุ่มกลมหนึ่งปุ่มต่อสกิลงอกออกมาจากท้ายฟอง (ท่า Spotlight) */
    /* ลบคำทักทายเสร็จ ฟองคำพูดกลายเป็นช่องค้นหาแบบ Spotlight (หางหด ทรงแคปซูล แว่นขยาย เคอร์เซอร์) */
    search: smooth(at(sv2, BEAT.search)),
    sprout: smooth(at(sv2, BEAT.sprout)),
    head,
    paint: smooth((up - 0.6) / 0.4),
    stage: 0,
    slide: 0,
    iso: smooth(at(sv2, BEAT.iso)),
    grow: smooth(at(sv2, BEAT.grow)),
    page,
    act,
    mag: at(sv2, [BEAT.iso[0] + 0.1, BEAT.iso[1] + 0.25]),
    /* ปุ่มกลมหดกลับเข้าฟองตอนลบประโยคที่สอง — ป้ายเหลือฟองเดียว */
    tuck: smooth(at(sv2, [BEAT.unsay[0], 0.55])),
    /* ฉากหลังร่วงจากฟ้า (ดู ./FallSky): ระยะร่วงนับจากฟองเริ่มเอียง · ความคืบหน้าทั้งเรื่องของเวที */
    fall: Math.max(0, sv2 - BEAT.iso[0]),
    prog: smooth(at(sv2, [BEAT.iso[0], BEAT.tour[0] + BEAT.tour[1] - BEAT.iso[0]])),
    hand,
    /* แถบกับรางติดท้าย section — จอถัดไปเลื่อนขึ้นมา ทั้งชุดก็เลื่อนขึ้นไปด้วย */
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
  const glass = useMemo(makeLiquidGlass, [])
  useEffect(() => () => glass.dispose(), [glass])
  const shell = useRef<THREE.Mesh>(null)
  const ink = useRef<THREE.Mesh>(null)
  /**
   * ไอคอนบริการบนวงกลมแรก — SVG ปากกาออกแบบ (svgrepo, ชุด lines and angles) แบนเป็นรูปทรง
   * จุดศูนย์กลาง viewBox 32×32 ไว้ที่ 0 แกน y กลับขึ้น · สูงราวครึ่งเส้นผ่านศูนย์กลางวงกลม
   */
  const icon = useRef<THREE.Mesh>(null)
  const magnifier = useRef<THREE.Group>(null)
  const caret = useRef<THREE.Mesh>(null)
  /** แว่นขยายเส้นบาง (วง + ด้าม) กับเคอร์เซอร์ — หน่วย viewBox ของฟอง สูงราวตัวอักษร */
  const searchGeo = useMemo(() => {
    const ring = new THREE.RingGeometry(9.6, 12.2, 48)
    ring.translate(-2.5, 3, 0)
    const handle = new THREE.PlaneGeometry(3, 11)
    handle.rotateZ(Math.PI / 4)
    handle.translate(8.6, -8.1, 0)
    const caretG = new THREE.PlaneGeometry(2.2, 34)
    return { ring, handle, caret: caretG }
  }, [])
  useEffect(() => () => Object.values(searchGeo).forEach((g) => g.dispose()), [searchGeo])
  const iconGeo = useMemo(() => {
    const data = new SVGLoader().parse(penNibSvg)
    const g = new THREE.ShapeGeometry(data.paths.flatMap((p) => SVGLoader.createShapes(p)), 8)
    g.translate(-16, -16, 0)
    g.scale(1 / 32, -1 / 32, 1)
    return g
  }, [])
  const iconMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, toneMapped: false }), [])
  useEffect(
    () => () => {
      iconGeo.dispose()
      iconMat.dispose()
    },
    [iconGeo, iconMat],
  )
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
    /* ช่องค้นหา: เว้นที่ให้แว่นขยายหน้าข้อความ + เคอร์เซอร์ท้ายข้อความ */
    /* เป็นป้ายแล้ว = เลิกเป็นช่องค้นหา: หางกลับมา แว่นขยายออกไปเป็นแว่นยักษ์ (ดู ./IsoSkills) */
    const srch = p.search * (1 - p.iso)
    const lead = SEARCH_LEAD * srch
    const want = Math.max(VB_W, PAD_L + lead + tx.w + PAD_R + CARET_GAP * srch)
    width.current += (want - width.current) * (1 - Math.exp(-dt * 14))
    const w = width.current
    /* จอแคบ: ข้อความเต็มประโยคต้องไม่ล้นจอ — ย่อฟองให้ความกว้างสุดท้ายอยู่ในจอ 88% */
    const full = PAD_L + Math.max(texts[0][LINES[0].length].w, texts[1][LINES[1].length].w) + PAD_R
    const s0 = p.h / VB_H
    /* ป้าย: สูง SIGN_H ของจอ */
    const s = lerp(lerp(s0, Math.min(s0, (size.width * 0.88) / full), p.clear), (size.height * SIGN_H) / VB_H, p.iso)
    const sp = { sprout: p.sprout * (1 - p.tuck), head: p.head }
    /* ปุ่มงอกทางขวา — ฟองหลบไปทางซ้ายให้ทั้งแถว (ฟอง + ปุ่ม) อยู่กลางจอ */
    const shift = sproutShift(VB_H * s, sp)
    /* ลอยไปมุมซ้ายบน: ขอบซ้ายของตัวอักษรลงที่ x = 64 ในแบบ */
    const shw = size.width / FW
    const pl = panelLayout(size.width, size.height)
    /* กลางกลุ่มไปที่กลางพาเนล (แนวตั้งมาจาก pose.y แล้ว) */
    const gx = lerp(p.x - shift, pl.cx, p.head)
    /** พาเนลเฟรมนี้ (หน่วยท้องถิ่นของกลุ่ม) — ไอคอนกับข้อความยึดมุมซ้ายบนของมัน ขยับไปพร้อมพาเนลที่กำลังพอง */
    let panelNow: { x: number; y: number; hw: number; hh: number } | null = null
    g.position.set(gx - size.width / 2, size.height / 2 - p.y, 0)
    /* ลงไปยืนเป็นป้ายบนแผ่น (ดู ./isoStage) — ตามแผ่นขึ้นไปตอนจบ section */
    if (p.iso > 0) {
      signCenter(size.width, size.height, VB_H * s, SIGN_P)
      SIGN_P.y -= p.lift
      g.position.lerp(SIGN_P, p.iso)
    }
    /**
     * ทรงของฟองเฟรมนี้ — ปั้นจากสนามระยะที่ตั้งต้นจากเส้นขอบในไฟล์ SVG ตลอดทาง พอปุ่มงอก (sprout)
     * ปุ่มหลอมเข้ามาในสนามเดียวกัน (ดู ./LiquidBento) — เมชเดียว วัสดุแก้วตัวเดิม ไม่มีจังหวะสลับทรง
     * ปั้นใหม่เฉพาะตอนทรงเปลี่ยน (ความกว้างตามข้อความ / ปุ่มกำลังไหล) ช่วงค้างไม่ปั้น
     */
    {
      const bw = w * s
      const bh = VB_H * s
      /**
       * จุดบอกความคืบหน้าของการเลื่อนใต้หัวข้อ (แทนวงกลม 64 ในแบบ): จุด 12 ห่าง 8 ขอบซ้ายที่ x 64 กลางแนวตั้งที่ y 104
       * จุดของบริการที่เปิดอยู่ยืดเป็นแคปซูล ไล่ตามการเลื่อนข้ามหน้า — นับจากกลางฟองตอนเป็นหัวข้อ (x ที่ gxEnd, y ที่ 72.4)
       */
      /* จุดบอกหน้า 12 ห่าง 8 ชิดขวาของหัวพาเนล — จุดของบริการที่เปิดอยู่ยืดเป็นแคปซูล (กว้างรวม = 12·(2+2.6) + 8·2) */
      const dd = 12 * shw
      const dg = 8 * shw
      const rowW = dd * (2 + 2.6) + dg * 2
      /* มีพาเนล = จุดยึดมุมขวาบนของพาเนลขนาดเฟรมนี้ (inset/headOff) ไม่ใช่ตำแหน่งตอนพองเต็ม */
      const dest = { x: pl.dotsR - rowW - pl.cx, y: pl.headY - pl.cy, d: dd, gap: dg, page: 0, inset: 40 * shw, headOff: 46 * shw }
      /* พาเนล = ก้อนแก้วที่พองออกจากตัวฟอง ไปเป็นกล่องมนกลางจอ */
      const panel = { cx: 0, cy: 0, hw: pl.w / 2, hh: pl.h / 2, r: pl.r, k: p.head }
      const liquid = skillBlobs(sp, { x: gx - bw / 2, y: p.y - bh / 2, w: bw, h: bh, s }, dest, panel)
      const pb = liquid.panel
      panelNow = pb
      if (pb) glass.uniforms.uPanel.value.set(pb.x, pb.y, pb.hw, pb.hh)
      else glass.uniforms.uPanel.value.set(1e5, 0, 0, 0)
      glass.uniforms.uPanelR.value = pb ? pb.r : 0
      glass.uniforms.uPanelTint.value = smooth((p.head - 0.2) / 0.6)
      /* กรอบเนื้อหาให้ฉากบริการ — เปิดเมื่อพาเนลขยายเต็มแล้ว ตามการเลื่อนขึ้นตอนจบ section */
      panelBox.on = p.head > 0.98
      panelBox.x = pl.content.x
      panelBox.y = pl.content.y + p.lift
      panelBox.w = pl.content.w
      panelBox.h = pl.content.h
      const wq = Math.round(w / 0.6) * 0.6
      const cu = [glass.uniforms.uC0, glass.uniforms.uC1, glass.uniforms.uC2]
      cu.forEach((u, i) => {
        const c = liquid.blobs[i]
        if (c) u.value.set(c.x, c.y, c.hw, c.hh)
        else u.value.set(1e5, 0, 0, 0)
      })
      glass.uniforms.uAct.value.set(liquid.act[0], liquid.act[1], liquid.act[2])
      /* ไอคอนตามวงกลมแรก — สีเดียวกับตัวอักษรในฟอง (ตั้งตรงที่ตั้งสีหมึก ข้างล่าง) */
      const ic = icon.current
      const c0 = liquid.blobs[0]
      if (ic) {
        /* ไอคอนออกจากวงกลมแรก ไปอยู่หน้าข้อความบนหัวพาเนล (ตำแหน่งไอคอนแอปในหน้าต่าง Spotlight) สูง 26 */
        ic.visible = !!c0
        if (c0) {
          const h = inOut01(p.head)
          const pn = panelNow
          const hx = pn ? pn.x - pn.hw + (pl.iconX - pl.left) / s : c0.x
          const hy = pn ? pn.y + pn.hh - (pl.headY - pl.top) / s : c0.y
          ic.position.set(lerp(c0.x, hx, h), lerp(c0.y, hy, h), t.bbThick / 2 + 1.5)
          ic.scale.setScalar(Math.max(1e-3, lerp(c0.hh * 1.05, (26 * shw) / s, h)))
        }
      }
      /* ฟองยุบหายเข้าไปในพาเนลที่พองจากมัน (หน่วย viewBox — 55 หายหมด) — เริ่มยุบหลังพาเนลพองพ้นตัวฟองแล้ว */
      const shrinkU = smooth((p.head - 0.15) / 0.6) * 55
      const fullKey = `${wq.toFixed(1)}|${srch.toFixed(3)}|${shrinkU.toFixed(1)}|${liquid.k.toFixed(2)}|${liquid.blobs.map((o) => `${o.x.toFixed(1)},${o.y.toFixed(1)},${o.hw.toFixed(1)},${o.hh.toFixed(1)},${o.r.toFixed(1)}`).join('|')}|${t.bbThick}|${t.bbRound}`
      if (!geo.current || built.current !== fullKey) {
        geo.current?.dispose()
        geo.current = liquidGeo(outline, wq, liquid.blobs, liquid.k, t.bbThick, t.bbRound, shrinkU, srch)
        built.current = fullKey
        if (shell.current) shell.current.geometry = geo.current
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
    /* เอียงลงเป็นป้ายในมุมไอโซ — หน้าป้ายหันไปทางขวาล่างแบบป้ายในภาพอ้างอิง */
    if (p.iso > 0) g.quaternion.slerp(ISO_Q, p.iso)
    /**
     * เฉือนแบบเดียวกับ skewY ของหัวเรื่อง (ขอบตั้งยังตั้งตรง ขอบนอนเอียง) — หมุนแทนไม่ได้ ขอบตั้งจะเอียงตาม
     * ทรงจึงไม่ทาบใบเดิมตอนรับไม้ ต่อเมทริกซ์เองเพราะ three ไม่มีช่องเฉือนในตำแหน่ง/หมุน/สเกล
     */
    g.updateMatrix()
    if (p.rot) g.matrix.multiply(SHEAR.makeShear(p.rot, 0, 0, 0, 0, 0))
    /* จบที่สีเทาแบนตามแบบ Figma — ทาผิวเมชเดิม (ดู ./liquidGlass) */
    glass.uniforms.uPaint.value = p.paint

    /* หมึกน้ำเงิน → ขาวบนฟ้า — หน้าบริการพื้นยังเป็นฟ้าเดิม หัวข้อจึงขาวต่อ */
    TMP_C.set(INK).lerp(WHITE, p.white).lerp(SIGN_INK, p.iso)
    inkMat.color.copy(TMP_C)
    inkMat.emissive.copy(TMP_C)
    iconMat.color.copy(TMP_C)
    const m = ink.current
    if (m) {
      m.material = inkMat
      m.visible = !!tx.geo
      if (tx.geo) {
        m.geometry = tx.geo
        /* ข้อความลอยไปเป็นหัวพาเนล: เริ่มที่ x textX กลางแนวตั้งที่ headY (ตำแหน่ง "Applications" ใน Spotlight) */
        const h = inOut01(p.head)
        const pn = panelNow
        const left = -w / 2 + PAD_L + lead
        const tx0 = pn ? pn.x - pn.hw + (pl.textX - pl.left) / s : left
        const ty0 = pn ? pn.y + pn.hh - (pl.headY - pl.top) / s : 0
        m.position.set(lerp(left, tx0, h), lerp(-tx.midY + 2, ty0 - tx.midY + 2, h), t.bbThick / 2 + 1)
      }
    }
    /**
     * แว่นขยายของช่องค้นหา — หน้าข้อความ หดหายตอนช่องพองเป็นพาเนล (ไอคอนบริการมาแทนที่ แบบ Spotlight ที่ไอคอนหมวด
     * มาแทนแว่นขยาย) · เคอร์เซอร์กะพริบท้ายข้อความ ระหว่างเป็นช่องค้นหา
     */
    const mg = magnifier.current
    if (mg) {
      const k = p.search * (1 - clamp01(p.head * 3))
      /* แว่นยักษ์ของฉากรับไม้ต่อ ณ ท่านี้ (ตำแหน่ง/หมุน/ขนาดเดียวกัน) แล้วใบในฟองซ่อน */
      mg.visible = k > 0.01 && p.mag <= 0
      mg.position.set(-w / 2 + PAD_L + 14, 0, t.bbThick / 2 + 1)
      mg.scale.setScalar(Math.max(1e-3, k))
      magStart.p.set(-w / 2 + PAD_L + 14 - 2.5, 3, t.bbThick / 2 + 1).applyMatrix4(g.matrix)
      magStart.q.copy(g.quaternion)
      magStart.s = 12.2 * s
    }
    const cr = caret.current
    const caretOn = srch > 0.6 && p.head < 0.05
    if (cr) {
      cr.visible = caretOn && clock.elapsedTime % 1.06 < 0.56
      cr.position.set(-w / 2 + PAD_L + lead + tx.w + CARET_GAP * 0.5, 0, t.bbThick / 2 + 1)
    }
    const inner = (PAD_L - PAD_R) / 2
    dots.current.forEach((d, i) => {
      if (!d) return
      d.visible = p.dots > 0.01
      d.scale.setScalar(p.dots)
      d.position.set(inner + (i - 1) * 17, Math.max(0, Math.sin(clock.elapsedTime * 7 - i * 0.9)) * 6, t.bbThick / 2 + 4)
    })

    /* ยังขยับเองอยู่ (จุดกำลังพิมพ์ ลอยตามลม ฟองยืดตามข้อความ) = ขอเฟรมต่อ นอกนั้นรอการเลื่อนปลุก */
    if (p.dots > 0.01 || p.turn > 0 || caretOn || Math.abs(want - width.current) > 0.3) invalidate(3)
  })

  return (
    <>
      <group ref={root} matrixAutoUpdate={false}>
        {/* แก้วแบบ Liquid Glass (ดู ./liquidGlass) — ตัวอักษรวาดหลังแก้ว (renderOrder) จึงคมทับผิวแก้ว */}
        <mesh ref={shell} material={glass} />
        <mesh ref={ink} material={inkMat} renderOrder={2} />
        {/* ไอคอนของบริการแรก (UX/UI — ปากกาออกแบบ) บนหน้าวงกลมแรก */}
        <mesh ref={icon} geometry={iconGeo} material={iconMat} renderOrder={3} visible={false} />
        <group ref={magnifier} visible={false}>
          <mesh geometry={searchGeo.ring} material={iconMat} renderOrder={3} />
          <mesh geometry={searchGeo.handle} material={iconMat} renderOrder={3} />
        </group>
        <mesh ref={caret} geometry={searchGeo.caret} material={iconMat} renderOrder={3} visible={false} />
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
  useCursorStop(null, { id: 'bubble-park-after', at: park, keyVh: top === undefined ? undefined : top + BEAT.tour[0] + BEAT.tour[1] + 0.5, size: 54, tilt: -14 })
  const pose = useRef<Pose>({ ...POSE0 })
  const [on, setOn] = useState(false)
  const wake = useRef<() => void>(() => {})
  const notes = useRef<(HTMLDivElement | null)[]>([])

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
      /* คำอธิบายของแผ่นที่อยู่ใต้ป้าย — เผยจากล่างขึ้นบน (ตัดกรอบ) ตามระยะของแผ่น ไม่จางเข้า */
      notes.current.forEach((d, i) => {
        if (!d) return
        const k = p.on ? clamp01(1.4 - Math.abs(p.page - i) * 2.6) * clamp01((p.grow - 0.6) / 0.4) : 0
        d.style.clipPath = `inset(${((1 - k) * 100).toFixed(1)}% 0 0 0)`
        d.style.transform = `translateY(${((1 - k) * 18).toFixed(1)}px)`
        d.style.visibility = k > 0.001 ? 'visible' : 'hidden'
      })
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
        camera={{ position: [0, 0, 2400], zoom: 1, near: 1, far: 8000 }}
        gl={{ antialias: true, alpha: true }}
        style={{ pointerEvents: 'none' }}
      >
        <ambientLight intensity={1.35} />
        <directionalLight position={[220, 320, 420]} intensity={1.75} />
        <directionalLight position={[-260, -140, 260]} intensity={0.6} />
        <StageLight gain={t.bbGlow} />
        <Suspense fallback={null}>
          <Bubble pose={pose} wake={wake} />
          {/* เวทีสกิลมุมไอโซ — ฟองลงไปยืนเป็นป้ายบนแผ่น */}
          <FallSky pose={pose} />
          <IsoSkills pose={pose} />
        </Suspense>
      </Canvas>
      {/* คำอธิบายสกิล มุมขวาล่างแบบภาพอ้างอิง */}
      {DESCS.map((d, i) => (
        <div
          key={SKILL_OF[i]}
          ref={(el) => {
            notes.current[i] = el
          }}
          className="absolute right-[clamp(20px,5vw,80px)] bottom-[clamp(28px,8svh,90px)] w-[min(78vw,330px)] text-[clamp(14px,1.15vw,17px)] leading-snug text-white [text-shadow:0_1px_12px_rgba(20,60,160,0.55)]"
          style={{ visibility: 'hidden' }}
        >
          <div className="mb-2 font-mono text-[11px] tracking-[0.22em] text-white/70 uppercase">
            0{i + 1} / 0{DESCS.length} · {NAMES[i]}
          </div>
          {d}
        </div>
      ))}
    </div>
  )
}
