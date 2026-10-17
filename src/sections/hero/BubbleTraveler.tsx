import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { WarmShaders } from '@/lib/WarmShaders'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import bubbleSvg from '@/assets/v2final/hero-ideas-bubble.svg?raw'
import penNibSvg from '@/assets/icons/pen-nib.svg?raw'
import { useCursorStop } from '@/cursorguide/useCursorStop'
import { BEAT, SKY_LEAVE, at, endOf } from '@/sections/skystory/beats'
import { headOf, liquidGeo, prepareBubbleGrid, skillBlobs, sproutShift } from './LiquidBento'
import { rrect } from './shapes'
import { FW, panelBox, panelLayout } from './ServiceTrack'
import { ISO_Q, SIGN_H, magStart, signCenter } from './isoStage'
import { makeLiquidGlass } from './liquidGlass'
import { useTuner } from '@/newhero/tuner'
import { StageLight } from './Headline3D'
import { bubbleTravel, setBubbleAway, setHeadBubbleLive, subscribeBubbleAway } from './bubbleTravel'
import { DEVICE, LAYOUT_H, WF, WF_HEAD, benchPose, camDist, caretSpot, deviceMat, deviceSpot, headPose, inOut as inOut3, researchPhase, wfK, workBeats } from './workMotion'
import { outlineMat } from './shapes'

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
 * จังหวะของฟอง: ทักทาย → บอกว่าจะพาไปดูอะไร แล้วค้างประโยคนั้นไว้ — งานที่เข้ามาไม่หยุดล้อมรอบมัน (./WorkStory)
 * ถูกกรอบเลือกกวาด แล้วหมุนยุบหายเข้ากลางจอพร้อมฟองอื่น
 */
const LINES = ["Hello, I'm Joe", 'Here is what I do'] as const
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
/** ถูกกรอบเลือกกวาด: เนื้อแก้วขาวขุ่น ตัวอักษรน้ำเงิน — แบบรายการที่ถูกไฮไลต์ */
const SEL_INK = new THREE.Color('#2052cd')
const CARET_P = new THREE.Vector3()
/**
 * เครื่องแก้ว (ชิ้นแยกจากฟอง — ดู devG) ปั้นครั้งเดียวด้วยกล่องมน · แท่น (ฟองแคปซูล) ลงจอดบนจอของมันในบท morph
 */
/** กล่องมนอัดขึ้นรูปแบบเดียวกับขั้นสุดท้ายของ liquidGeo (ขอบมนตามความหนา ร่นเส้นเข้าแล้วให้ bevel พองกลับ) */
function boxGeo(b: { hw: number; hh: number; r: number; cx: number }, thick: number, round: number) {
  const bev = thick * 0.499 * Math.min(1, Math.max(0, round))
  const inset = bev * 0.5
  const shape = rrect((b.hw - inset) * 2, (b.hh - inset) * 2, Math.max(0.5, b.r - inset))
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, thick - bev * 2),
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: inset,
    bevelSegments: 5,
    curveSegments: 14,
  })
  g.translate(b.cx, 0, bev - thick / 2)
  return g
}
/** สองคำของประโยคที่สอง — ตอนเป็นเครื่อง ข้อความไหลลงเป็นสองบรรทัดกลางจอ */
const WORDS = ['Here is', 'what I do'] as const
/** ระยะบรรทัดในเครื่อง · กลางก้อนข้อความต่ำกว่ากลางเครื่องนิด (ไอคอนอยู่บน) — หน่วย viewBox */
const DEV_LINE = 42
const DEV_TY = -14
/**
 * บท lift: ข้อความ (สองบรรทัด + ไอคอน + เคอร์เซอร์พิมพ์) ลอยออกจากเครื่องขึ้นไปข้างบน ตั้งหน้าหาคนดูตลอด
 * แล้วตัวเครื่องแก้วค่อย ๆ หงายลง (หน้าจอหันขึ้นฟ้า) — ข้อความอยู่กลุ่มของตัวเอง ไม่หงายตาม
 */
const FLOAT_Y = 84
/** ข้อความพุ่งเข้าหากล้องกี่หน่วย · ชั้นของแต่ละชิ้น (ไอคอน · บรรทัดหนึ่ง · บรรทัดสอง) ลึกไม่เท่ากัน = มีมิติ */
const FLOAT_Z = 150
const LAYER_Z = [70, 35, 0]
/**
 * แคนวาสนี้เป็นออร์โธ — เครื่องที่หงายจะเหลือแค่สี่เหลี่ยมเตี้ยลง ไม่อ่านว่าหงาย ใส่เทอมเพอร์สเปกทีฟลงในเมทริกซ์ของฟองเอง
 * (w ขึ้นกับความลึกในโลก: ขอบที่หงายห่างออกไปหดเล็ก ขอบใกล้ขยาย) — ระยะโฟกัสเท่ากล้องของแคนวาสของบนจอ (./WorkStory)
 * ภาพสองแคนวาสจึงทาบกันพอดี (ของบนจอวาดใต้แก้วเครื่อง)
 */
const PERSP = new THREE.Matrix4()
const WF_P = new THREE.Vector3()
/** แท่นลงจอดบนเครื่อง: ที่ลงบนจอ (หน่วยท้องถิ่นของเครื่อง = viewBox) · ขนาดแท่นเทียบเครื่อง (แคปซูลกว้างราว 330 → แถบหัว 84) */
const PAD_Y = 150
const PAD_S = 0.25
const PAD_A = new THREE.Matrix4()
const PAD_B = new THREE.Matrix4()
const DEV_M = new THREE.Matrix4()
const DEV_P = new THREE.Vector3()
const DEV_S = new THREE.Vector3()
const DEV_Q = new THREE.Quaternion()
const PA_P = new THREE.Vector3()
const PA_Q = new THREE.Quaternion()
const PA_S = new THREE.Vector3()
const PB_P = new THREE.Vector3()
const PB_Q = new THREE.Quaternion()
const PB_S = new THREE.Vector3()
const PERSP_INV = new THREE.Matrix4()
const WF_A = new THREE.Vector3()
const WF_B = new THREE.Vector3()
const WF_INV = new THREE.Matrix4()
const BENCH_E = new THREE.Euler()
const BENCH_Q = new THREE.Quaternion()
const TILT_MAX = 1.08
const AX_X = new THREE.Vector3(1, 0, 0)
const TILT_Q = new THREE.Quaternion()
const FLOAT_M = new THREE.Matrix4()

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
/** ช่วงข้อความลอกจนหลุดพ้นจอ (0..1): ฟองเริ่มหงายนิด → ก่อนเครื่องเลื่อนขึ้นมาเต็ม */
const textGo = (sv2: number) => at(sv2, [BEAT.lift[0] + 0.06, BEAT.research[0] + 0.6 - BEAT.lift[0] - 0.06])
/** สุ่มคงที่ต่อชิ้น (0..1) — ตัวอักษรแต่ละตัวได้น้ำหนัก/ทิศของตัวเอง ทุกเฟรมเท่าเดิม */
const rnd = (n: number, k: number) => {
  const v = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453
  return v - Math.floor(v)
}
const POSE0 = { on: false, x: 0, y: 0, h: 0, rot: 0, dots: 0, line: 0, chars: 0, clear: 0, sv: 0, turn: 0, spin: 0, search: 0, sprout: 0, head: 0, paint: 0, stage: 0, slide: 0, hand: 0, lift: 0, rise: 0, white: 0, iso: 0, grow: 0, page: 0, mag: 0, tuck: 0, fall: 0, prog: 0, act: [0, 0, 0], sel: 0, gone: 0, whirl: 0, caretOut: 0, zoom: 1, dev: 0, float: 0, tilt: 0, bx: 0, by: 0, bk: 1, bt: 1, flat: 0, wire: 0, land: 0, away: 0, brx: 0, bry: 0, bspin: 0, hx: 0, hy: 0 }
type Pose = { on: boolean; x: number; y: number; h: number; rot: number; dots: number; line: number; chars: number; clear: number; sv: number; turn: number; spin: number; search: number; sprout: number; head: number; paint: number; stage: number; slide: number; hand: number; lift: number; rise: number; white: number; iso: number; grow: number; page: number; mag: number; tuck: number; fall: number; prog: number; act: number[]; sel: number; gone: number; whirl: number; caretOut: number; zoom: number; dev: number; float: number; tilt: number; bx: number; by: number; bk: number; bt: number; flat: number; wire: number; land: number; away: number; brx: number; bry: number; bspin: number; hx: number; hy: number }

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
  /* เรื่องงานที่เข้ามา (./WorkStory): ถูกกรอบเลือก แล้วหมุนยุบเข้ากลางจอ — ยุบหมดแล้วชั้นนี้ปิด */
  const wb = workBeats(sv2)
  const bp = benchPose(wb, vw, vh)
  const hp = headPose(vw, vh)
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
      : { line: 1, chars: Math.round(at(sv2, BEAT.line2) * LINES[1].length) }),
    /* พิมพ์จบแล้ว ปุ่มกลมหนึ่งปุ่มต่อสกิลงอกออกมาจากท้ายฟอง (ท่า Spotlight) */
    /* ลบคำทักทายเสร็จ ฟองคำพูดกลายเป็นช่องค้นหาแบบ Spotlight (หางหด ทรงแคปซูล แว่นขยาย เคอร์เซอร์) */
    search: smooth(at(sv2, BEAT.search)),
    /* ปุ่มงอก / ป้ายบนเวทีไอโซ / รางบริการ ของเรื่องเดิม — ปิดไว้ (ค่าเป็นศูนย์ ทางเดิมในฟองจึงนิ่ง) */
    sprout: 0,
    head,
    paint: smooth((up - 0.6) / 0.4),
    stage: 0,
    slide: 0,
    iso: 0,
    grow: 0,
    page: 0,
    act: [0, 0, 0],
    mag: 0,
    tuck: 0,
    fall: 0,
    prog: 0,
    /* กรอบเลือกกวาดผ่านกลางฟอง (กลางจอ) */
    sel: 0,
    gone: 0,
    /* หมุนทวนเข็มไปกับเกลียวของฟองอื่น */
    whirl: 0,
    /* เคอร์เซอร์ของหน้าออกมาจากเคอร์เซอร์พิมพ์ — ตัวพิมพ์หลบให้ */
    caretOut: researchPhase(wb.research).emerge,
    /* กล้องของฉากพอร์ทัล (./WorkStory) — ใบนี้อยู่กลางโลกเดียวกัน (z = 0) จึงย่อขยายตามระยะกล้อง */
    zoom: 1,
    /* โต๊ะทำงาน (./workMotion benchPose — ของบนจอในอีกแคนวาสวางตามค่าชุดเดียวกัน) · หัวเรื่องไปที่ headPose */
    bx: bp.x,
    by: bp.y,
    bk: bp.k,
    wire: wb.wire,
    /**
     * ข้อความลอกแล้วหลุดลอยพ้นจอเป็นการเคลื่อนเดียวต่อเนื่อง (TEXT_GO): ลอกค่อย ๆ ออกตัว แล้วแรงดึงขึ้นรับช่วงก่อนลอกจะชะลอ
     * ความเร็วรวมจึงเพิ่มขึ้นตลอด ไม่มีช่วงหน่วงกลางทาง (เดิมสองช่วงเกลี่ยแยกกัน — ลอกชะลอจนเกือบหยุดก่อนเริ่มหลุด)
     */
    away: ((m) => (m <= 0 ? 0 : m ** 2.2))(clamp01((textGo(sv2) - 0.12) / 0.88)),
    land: wb.morph,
    /* บทค้นคว้า: ข้อความไปเป็นหัวเรื่องขวา แว่นขยายลงไปเป็นวัตถุหลักบนแท่น — กลับที่เดิมตอนท้ายบท (ก่อนคลี่เป็นเครื่อง) */
    bt: bp.target,
    flat: bp.flat,
    brx: bp.rx,
    bry: bp.ry,
    bspin: bp.spin,
    hx: hp.x,
    hy: hp.y,
    /* ช่องค้นหาคลี่เป็นทรงเครื่อง */
    dev: inOut3(at(sv2, BEAT.morph)),
    /* ข้อความลอยออกก่อน เครื่องหงายตาม */
    /* หงายตั้งแต่ยังเป็นฟอง (คลี่เป็นเครื่องระหว่างทาง) · ข้อความลอกออกจากผิวทีหลัง */
    /* ออกตัวทันที (เห็นฟองเริ่มหงายก่อนคลี่) แล้วชะลอเข้ามุมสุด */
    tilt: 1 - (1 - at(sv2, BEAT.lift)) ** 2.2,
    /* ข้อความลอกออกตั้งแต่ยังเป็นฟอง ก่อนคลี่เป็นเครื่อง — คลี่/จัดบรรทัดใหม่ระหว่างที่ลอยอยู่ */
    float: smooth(textGo(sv2) / 0.45),
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
  /* ตารางระยะของทรงฟอง — ปั้นตอนนี้ (ด่านโหลดยังบังอยู่) ไม่ใช่เฟรมแรกที่ฟองขึ้นจอปลายอินโทร */
  useEffect(() => prepareBubbleGrid(outline), [outline])

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
   * สองคำของ "Here is what I do" แยกชิ้น — ตอนยังเป็นบรรทัดเดียวสองชิ้นวางต่อกันตรงตำแหน่งเดิมเป๊ะ (ระยะ = ความกว้าง
   * ตัวอักษรรวมเว้นวรรคจากข้อมูลฟอนต์ แบบเดียวกับที่ three วางตัวอักษร) สลับมาใช้ชิ้นคู่นี้จึงไม่เห็นรอย แล้วค่อยไหลลงเป็นสองบรรทัด
   */
  const words = useMemo(() => {
    const opts = { font, size: FS, depth: 3, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.5, bevelSegments: 2 }
    const k = FS / font.data.resolution
    const adv = (str: string) => [...str].reduce((n, c) => n + (font.data.glyphs[c]?.ha ?? 0) * k, 0)
    return WORDS.map((wd, i) => {
      const geo = new TextGeometry(wd, opts)
      geo.computeBoundingBox()
      const b = geo.boundingBox as THREE.Box3
      return { geo, w: b.max.x - b.min.x, x0: i === 0 ? 0 : adv(`${WORDS[0]} `) }
    })
  }, [font])
  useEffect(() => () => words.forEach((x) => x.geo.dispose()), [words])
  /** ตัวอักษรรายตัวของสองคำ (ข้ามเว้นวรรค) — x = ระยะจากต้นคำตามข้อมูลฟอนต์ แบบเดียวกับที่ three วางตัวอักษร */
  const letters = useMemo(() => {
    const opts = { font, size: FS, depth: 3, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.5, bevelSegments: 2 }
    const k = FS / font.data.resolution
    const out: { geo: TextGeometry; x: number; w: number }[] = []
    WORDS.forEach((wd, wi) => {
      let x = 0
      for (const c of wd) {
        if (c !== ' ') out.push({ geo: new TextGeometry(c, opts), x, w: wi })
        x += (font.data.glyphs[c]?.ha ?? 0) * k
      }
    })
    return out
  }, [font])
  useEffect(() => () => letters.forEach((x) => x.geo.dispose()), [letters])
  const letterRefs = useRef<(THREE.Mesh | null)[]>([])
  /** กรอบ wireframe ที่ตัวอักษรกลายเป็น — ตัวละชิ้น วัสดุแยกชิ้น (ขนาดต่างกัน) */
  const outlineRefs = useRef<(THREE.Mesh | null)[]>([])
  const wfG = useRef<THREE.Group>(null)
  const wfMesh = useMemo(() => ({ geo: new THREE.PlaneGeometry(1, 1), mats: WF.map(() => outlineMat()) }), [])
  useEffect(
    () => () => {
      wfMesh.geo.dispose()
      wfMesh.mats.forEach((m) => m.dispose())
    },
    [wfMesh],
  )

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
  const wordRefs = useRef<(THREE.Mesh | null)[]>([])
  const textG = useRef<THREE.Group>(null)
  /** เครื่องแก้ว (ชิ้นแยกจากฟอง) — กล่องมนทรงจอมือถือ เนื้อแก้วชุดเดียวกับฟอง */
  const devG = useRef<THREE.Group>(null)
  const devGeo = useMemo(() => boxGeo({ hw: DEVICE.hw, hh: DEVICE.hh, r: DEVICE.r, cx: 0 }, t.bbThick, t.bbRound), [t.bbThick, t.bbRound])
  useEffect(() => () => devGeo.dispose(), [devGeo])
  /** เงานุ่มใต้ก้อนข้อความบนผิวเครื่อง — วงรีไล่จางจากแคนวาส (ไม่ใช่สำเนาตัวอักษร: สำเนาคมอ่านเป็นข้อความซ้อน) */
  const shadow = useRef<THREE.Mesh>(null)
  const shadowMat = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const x = c.getContext('2d')
    if (x) {
      const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64)
      gr.addColorStop(0, 'rgba(8,30,90,1)')
      gr.addColorStop(1, 'rgba(8,30,90,0)')
      x.fillStyle = gr
      x.fillRect(0, 0, 128, 128)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
  }, [])
  const shadowGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useEffect(
    () => () => {
      shadowMat.map?.dispose()
      shadowMat.dispose()
      shadowGeo.dispose()
    },
    [shadowMat, shadowGeo],
  )
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
      /* ฟองคงเป็นแคปซูล (แท่น) — เครื่องเป็นอีกชิ้น (devG) ที่แท่นลงจอดบนจอของมัน */
      const db = null as { hw: number; hh: number; r: number; cx: number } | null
      const fullKey = db
        ? `dev|${db.hw.toFixed(1)}|${db.hh.toFixed(1)}|${db.r.toFixed(1)}|${db.cx.toFixed(2)}|${t.bbThick}|${t.bbRound}`
        : `${wq.toFixed(1)}|${srch.toFixed(3)}|${shrinkU.toFixed(1)}|${liquid.k.toFixed(2)}|${liquid.blobs.map((o) => `${o.x.toFixed(1)},${o.y.toFixed(1)},${o.hw.toFixed(1)},${o.hh.toFixed(1)},${o.r.toFixed(1)}`).join('|')}|${t.bbThick}|${t.bbRound}`
      if (!geo.current || built.current !== fullKey) {
        geo.current?.dispose()
        geo.current = db ? boxGeo(db, t.bbThick, t.bbRound) : liquidGeo(outline, wq, liquid.blobs, liquid.k, t.bbThick, t.bbRound, shrinkU, srch)
        built.current = fullKey
        if (shell.current) shell.current.geometry = geo.current
      }
    }
    g.scale.setScalar(s * Math.max(1e-3, 1 - p.gone) * p.zoom)
    /**
     * หมุนแบบลอยตามลม ระหว่างม่านเมฆพาไปจอถัดไป — ควงหนึ่งรอบเต็มรอบแกนตั้งอย่างช้า ๆ
     * พร้อมเงยก้มกับเอียงเล็กน้อย มุมผูกกับระยะเลื่อน (หยุดเลื่อนหยุดหมุน) บวกการหายใจตามเวลา
     * (เคยแค่ส่าย ±0.4 rad — บนกล้องออร์โธแทบมองไม่เห็นว่าหมุน)
     */
    const tt = clock.elapsedTime
    g.rotation.set(
      (Math.sin(p.sv * 3.1 + 1) * 0.22 + Math.sin(tt * 0.7) * 0.04) * p.turn,
      p.spin * Math.PI * 2 + Math.sin(tt * 0.5) * 0.06 * p.turn,
      Math.sin(p.sv * 2.3) * 0.1 * p.turn + p.whirl,
    )
    /* เอียงลงเป็นป้ายในมุมไอโซ — หน้าป้ายหันไปทางขวาล่างแบบป้ายในภาพอ้างอิง */
    if (p.iso > 0) g.quaternion.slerp(ISO_Q, p.iso)
    /**
     * เฉือนแบบเดียวกับ skewY ของหัวเรื่อง (ขอบตั้งยังตั้งตรง ขอบนอนเอียง) — หมุนแทนไม่ได้ ขอบตั้งจะเอียงตาม
     * ทรงจึงไม่ทาบใบเดิมตอนรับไม้ ต่อเมทริกซ์เองเพราะ three ไม่มีช่องเฉือนในตำแหน่ง/หมุน/สเกล
     */
    g.updateMatrix()
    if (p.rot) g.matrix.multiply(SHEAR.makeShear(p.rot, 0, 0, 0, 0, 0))
    /**
     * ข้อความ: ตอนแรกติดผิวฟอง (หงายไปด้วย) แล้วลอกออก — มุมคลายกลับมาหันหาคนดู ลอยขึ้นและพุ่งเข้าหากล้อง
     * ผ่านเพอร์สเปกทีฟเดียวกับตัวฟอง (ใกล้ขึ้น = ใหญ่ขึ้น · แต่ละชั้นลึกไม่เท่ากัน — ดู LAYER_Z)
     */
    const f = camDist(size.height)
    PERSP.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1 / f, 1)
    PERSP_INV.copy(PERSP).invert()
    const persp = p.tilt > 0 || p.flat > 0
    /* ช่วงหงาย/ข้อความลอย ทั้งชุด (เครื่อง + ข้อความ) ลงมาจากกลางจอนิด · ตั้งเป็นโต๊ะทำงานแล้วไปตามท่าของมันเอง */
    const dropY = size.height * 0.1 * smooth(p.tilt / 0.6) * (1 - p.flat)
    const tg = textG.current
    if (tg) {
      tg.matrix.copy(g.matrix)
      /* คงมุมหงายตามฟองไว้ตลอด — ลอยขึ้นทั้งที่ยังหงาย ไม่พลิกกลับมาหน้าตรง */
      const ta = TILT_MAX * p.tilt
      if (ta > 0) tg.matrix.multiply(FLOAT_M.makeRotationX(-ta))
      if (p.float > 0) tg.matrix.multiply(FLOAT_M.makeTranslation(0, FLOAT_Y * p.float, FLOAT_Z * p.float))
      /* โต๊ะทำงาน: ก้อนข้อความเลื่อนไปเป็นหัวเรื่อง (กลางก้อนตอนลอยอยู่ ≈ เหนือกลางจอ (FLOAT_Y + 20) หน่วย) */
      /* โต๊ะทำงาน: ก้อนข้อความตามเครื่องไป ค้างลอยหน้าจอเครื่อง · ช่วงหงาย ทั้งชุดลดลงไม่ให้ไอคอนชนโลโก้บนสุด */
      if (p.flat > 0 || dropY) tg.matrix.premultiply(FLOAT_M.makeTranslation(p.bx, -p.by - dropY, 0))
      /**
       * ลอยหลุดไป: ออกตัวช้าแล้วเร่ง (ยกกำลัง — ของมีน้ำหนักค่อย ๆ ถูกดึงขึ้น ไม่ใช่พุ่งทันที) ลอยเข้าหากล้องนิด
       * เอียงตัวเล็กน้อยตามแรงดึง จนพ้นขอบบนของจอ
       */
      if (p.away > 0) {
        const a = p.away ** 2.4
        tg.matrix.premultiply(FLOAT_M.makeRotationZ(-0.12 * a))
        tg.matrix.premultiply(FLOAT_M.makeTranslation(size.width * 0.03 * a, size.height * 1.15 * a, size.height * 0.25 * a))
      }
      tg.visible = p.away < 1
      if (persp) tg.matrix.premultiply(PERSP)
      tg.matrixWorldNeedsUpdate = true
    }
    /* ตัวฟอง/เครื่องหงาย: หมุนรอบแกนนอนของมันเอง หน้าหันขึ้นฟ้า */
    const dg = devG.current
    if (persp) {
      /* แท่น (ฟองที่หงาย) ท่าของตัวเองก่อนลงจอด */
      g.position.y -= dropY
      g.quaternion.multiply(TILT_Q.setFromAxisAngle(AX_X, -TILT_MAX * p.tilt))
      g.updateMatrix()
      PAD_A.copy(g.matrix)
      /**
       * เครื่อง: ตอนแท่นเริ่มลงจอด เครื่องอยู่ใกล้จนจอเต็มเฟรม (ซูมเข้า) จุดลงจอด (แถบหัวของแอป) อยู่กลางภาพ
       * แล้วซูมออกจนเห็นทั้งเครื่อง → ตั้งหน้าตรงเป็นโต๊ะทำงาน เลื่อนไปขวา เอนตอนโค้ด ควงตอนส่งของ
       */
      const z0 = (size.height * 2.3) / (DEVICE.hh * 2 * s)
      /**
       * จังหวะลงจอด (ความคืบหน้าดิบของบท — ไม่เกลี่ยซ้อน):
       *   0–0.42    เครื่องเลื่อนขึ้นมาจากใต้ขอบจอ (ลึกเข้าไปด้านหลังนิด — ค่อย ๆ ลอยเข้าหากล้อง) ออกตัวนุ่ม ชะลอเข้าที่ใต้แท่น
       *   0.3–0.6   แท่นลอยลงจอดราบบนจอ (ไม่ตีลังกา) — ลงแล้วติดไปกับเครื่อง
       *   0.6–1     ลงแล้วค่อยซูมออก (ไม่ซูมระหว่างลง — จุดลงจอดต้องนิ่ง)
       */
      const L = p.land
      const zk = inOut01(clamp01((L - 0.6) / 0.4))
      const zoom = lerp(z0, 1, zk)
      const zf = (zoom - 1) / Math.max(1e-3, z0 - 1)
      DEV_Q.identity()
      if (p.brx || p.bry || p.bspin) DEV_Q.multiply(BENCH_Q.setFromEuler(BENCH_E.set(p.brx, p.bry + p.bspin, 0, 'YXZ')))
      DEV_Q.multiply(TILT_Q.setFromAxisAngle(AX_X, -TILT_MAX * p.tilt * (1 - p.flat)))
      const ds = s * zoom * lerp(1, p.bt / (DEVICE.hh * s), p.flat)
      /* โผล่: เลื่อนขึ้นมาจากใต้ขอบจอ (นอนเอียงรับมุมเดียวกับแท่น) มาอยู่ใต้แท่นพอดีก่อนแท่นลงจอด */
      const rise = inOut01(clamp01(L / 0.42))
      DEV_M.compose(DEV_P.set(gx - size.width / 2 + p.bx, size.height / 2 - p.y - p.by - dropY - (1 - rise) * size.height * 0.85, -(1 - rise) * size.height * 0.6), DEV_Q, DEV_S.setScalar(ds))
      DEV_M.multiply(FLOAT_M.makeTranslation(0, -PAD_Y * zf, 0))
      DEV_M.toArray(deviceMat.e)
      deviceMat.ok = L > 0
      if (dg) {
        dg.visible = L > 0
        dg.matrix.copy(DEV_M).premultiply(PERSP)
        dg.matrixWorldNeedsUpdate = true
      }
      if (L > 0) {
        /* จุดลงจอดบนจอเครื่อง: แถบหัวของแอป (แท่นกลายเป็นช่องค้นหา) */
        PAD_B.copy(DEV_M).multiply(FLOAT_M.makeTranslation(0, PAD_Y, t.bbThick / 2 + 2)).multiply(FLOAT_M.makeScale(PAD_S, PAD_S, PAD_S))
        PAD_A.decompose(PA_P, PA_Q, PA_S)
        PAD_B.decompose(PB_P, PB_Q, PB_S)
        const hop = clamp01((L - 0.3) / 0.3)
        const kl = inOut01(hop)
        const arc = Math.sin(Math.PI * hop)
        PA_P.lerp(PB_P, kl)
        /* ลงตรง ๆ โค้งเล็กน้อย ไม่ตีลังกา — ลงแล้วเป็นส่วนหนึ่งของเครื่อง (ตามเครื่องไปทุกท่า ไม่ขยับเอง) */
        PA_P.z += arc * size.height * 0.05
        PA_Q.slerp(PB_Q, kl)
        PA_S.lerp(PB_S, kl)
        g.matrix.compose(PA_P, PA_Q, PA_S)
      }
      g.matrix.premultiply(PERSP)
    }
    /* เงานุ่มบนผิวใต้ข้อความที่ลอกออก — ชัดตอนเพิ่งลอก กว้างและจางลงตามระยะที่ลอยห่าง */
    shadowMat.opacity = 0.32 * smooth(p.float / 0.25) * (1 - 0.5 * p.float) * (1 - p.flat) * (1 - smooth(p.away / 0.6))
    const sb = shadow.current
    if (sb) {
      sb.visible = shadowMat.opacity > 0.003
      const spread = 1 + 0.35 * p.float
      /* ใต้บรรทัดในฟอง → ใต้ก้อนข้อความในเครื่อง */
      sb.position.set(0, lerp(0, DEV_TY + 18, p.dev), t.bbThick / 2 + 0.6)
      sb.scale.set(lerp(w * 0.85, DEVICE.hw * 1.9, p.dev) * spread, lerp(70, DEVICE.hh * 0.75, p.dev) * spread, 1)
    }
    /* จบที่สีเทาแบนตามแบบ Figma — ทาผิวเมชเดิม (ดู ./liquidGlass) */
    glass.uniforms.uPaint.value = p.paint
    /* ร่างเครื่องขุ่นกว่าฟองนิด (แผ่นจอ) · ถูกเลือก = แก้วขาวขุ่น */
    glass.uniforms.uFill.value = Math.min(0.9, 0.1 + 0.07 * p.dev + 0.74 * p.sel)
    /* ทรงเครื่องบนจอ — แสงรอบเครื่อง (./DeviceHalo) กับกรอบเลือก (./workMotion) อ่านค่านี้ */
    deviceSpot.hw = DEVICE.hw * s
    deviceSpot.hh = DEVICE.hh * s
    deviceSpot.r = DEVICE.r * s
    deviceSpot.k = p.dev
    deviceSpot.tilt = p.tilt
    deviceSpot.bench = p.flat

    /* หมึกน้ำเงิน → ขาวบนฟ้า — หน้าบริการพื้นยังเป็นฟ้าเดิม หัวข้อจึงขาวต่อ */
    TMP_C.set(INK).lerp(WHITE, p.white).lerp(SIGN_INK, p.iso).lerp(SEL_INK, p.sel)
    inkMat.color.copy(TMP_C)
    inkMat.emissive.copy(TMP_C)
    iconMat.color.copy(TMP_C)
    /**
     * ร่างเครื่อง: ประโยคที่สองไหลจากบรรทัดเดียวลงเป็นสองบรรทัดกลางเครื่อง ย่อลงพอดีความกว้างจอ (คำหลังตามคำแรกนิด)
     * ช่วงนี้ใช้สองชิ้นแยกคำแทนชิ้นทั้งประโยค
     */
    /* ข้อความลอยหลุดไปทั้งบรรทัดเดียว — ไม่แตกเป็นสองบรรทัดระหว่างลอย (เคยแตกตอนเครื่องเริ่มมา = จังหวะกระตุก) */
    const asWords = p.dev > 0 && p.away >= 1 && p.line === 1 && p.chars === LINES[1].length
    const TS = Math.min(0.94, (DEVICE.hw * 2 - 36) / Math.max(words[0].w, words[1].w))
    /* แยกบรรทัดก่อน (คำแรกขึ้น คำหลังลง — ไม่ไถลทับกัน) แล้วค่อยเข้ากลาง */
    const kv = inOut01(clamp01(p.dev * 1.7))
    const kh = inOut01(clamp01((p.dev - 0.22) * 1.45))
    const k2 = kh
    const leftA = -w / 2 + PAD_L + lead
    const midY = tx.midY
    words.forEach((wd, i) => {
      const wm = wordRefs.current[i]
      if (!wm) return
      wm.visible = asWords
      if (!asWords) return
      const bx = (-wd.w * TS) / 2
      const by = (i === 0 ? DEV_LINE / 2 : -DEV_LINE / 2) + DEV_TY
      const sc = lerp(1, TS, kh)
      wm.position.set(lerp(leftA + wd.x0, bx, kh), lerp(2, by, kv) - midY * sc, t.bbThick / 2 + 1 + LAYER_Z[i + 1] * p.float)
      wm.scale.setScalar(sc)
      /* บินเป็นหัวเรื่อง: ชิ้นทั้งคำหลบ ตัวอักษรรายตัว (ตำแหน่งเดิมเป๊ะตอนเริ่ม) บินแทน */
      wm.visible = p.flat <= 0

    })
    /**
     * บท wire: ตัวอักษรแต่ละตัวหดหายกลางอากาศ กรอบ wireframe งอกจากที่เดียวกันแทน แล้วลอยโค้งลงไปประกอบเป็นหน้าแอป
     * ในจอเครื่อง (ผัง WF) ไล่จากตัวแรก · ลงถึงจอแล้วส่งไม้ให้กรอบชุดเดียวกันในแคนวาสของบนจอ (./BenchScreen — ใต้แก้ว
     * จึงอยู่ใต้โน้ตและวิดเจ็ต) · พิกัดกรอบเป็นโลกของแคนวาสนี้ (px กลางจอ) ผ่านเพอร์สเปกทีฟเดียวกัน
     */
    const hhNow = lerp(DEVICE.hh * s, p.bt, p.flat)
    const u = (hhNow * 2) / LAYOUT_H
    const wiring = asWords && p.flat > 0
    /**
     * ลอยหลุด: ประโยคแตกเป็นตัวอักษรรายตัว (ตำแหน่งเดิมเป๊ะของชิ้นทั้งประโยค) แต่ละตัวน้ำหนักไม่เท่ากัน —
     * ตัวเบานำขึ้นไปก่อน ตัวหนักรั้งท้าย ลอยห่างจากผิวไม่เท่ากัน โยกเบา ๆ คนละจังหวะ แล้วเอียงตัวคนละทางตอนถูกดึงขึ้น
     */
    const flying = !asWords && !!tx.geo && p.head <= 0 && p.float > 0 && p.line === 1 && p.chars === LINES[1].length
    const fk = smooth(p.float)
    const fLeft = -w / 2 + PAD_L + lead
    letters.forEach((lt, n) => {
      if (flying) {
        const lm = letterRefs.current[n]
        if (!lm) return
        const wgt = rnd(n, 1)
        const pull = p.away ** 1.6
        lm.visible = true
        lm.position.set(
          fLeft + words[lt.w].x0 + lt.x,
          -tx.midY + 2 + (wgt - 0.5) * 22 * fk + wgt * 300 * pull + Math.sin(tt * 1.6 + n * 0.9) * 3 * fk,
          t.bbThick / 2 + 1 + rnd(n, 2) * 34 * fk + wgt * 140 * pull,
        )
        lm.rotation.set((rnd(n, 3) - 0.5) * 0.6 * pull, (rnd(n, 4) - 0.5) * 0.4 * pull, (rnd(n, 5) - 0.5) * 0.5 * pull + (rnd(n, 6) - 0.5) * 0.08 * fk)
        lm.scale.setScalar(1)
        return
      }
      const lm = letterRefs.current[n]
      const om = outlineRefs.current[n]
      const k = wfK(p.wire, n)
      const wd = words[lt.w]
      const x0 = (-wd.w * TS) / 2 + lt.x * TS
      const y0 = (lt.w === 0 ? DEV_LINE / 2 : -DEV_LINE / 2) + DEV_TY - midY * TS
      const z0 = t.bbThick / 2 + 1 + LAYER_Z[lt.w + 1] * p.float
      const shrink = smooth(k / 0.3)
      if (lm) {
        lm.visible = wiring && shrink < 1
        lm.position.set(x0, y0, z0)
        lm.rotation.set(0, shrink * 1.2, 0)
        lm.scale.setScalar(Math.max(1e-3, TS * (1 - shrink)))
      }
      if (!om) return
      om.visible = wiring && k > 0.02 && k < 1
      if (!om.visible) return
      /* จุดเริ่ม = กลางตัวอักษรบนจอ (ผ่านท่าของกลุ่มข้อความ) */
      WF_P.set(x0 + FS * TS * 0.3, y0 + FS * TS * 0.35, z0).applyMatrix4(tg ? tg.matrix : g.matrix)
      const [X, Y, Wd, Ht, R] = WF[n]
      const arc = Math.sin(Math.PI * k)
      const mm = om.material as THREE.ShaderMaterial
      om.position.set(lerp(WF_P.x, p.bx + X * u, k), lerp(WF_P.y, -p.by + Y * u, k) + arc * 26, arc * 120)
      om.rotation.set(arc * 0.5, arc * (n % 2 ? 0.7 : -0.7), 0)
      const g0 = smooth(k / 0.3)
      mm.uniforms.uSize.value.set(lerp(FS * TS * 0.6 * s, Wd * u, k) * g0, lerp(FS * TS * 0.8 * s, Ht * u, k) * g0)
      mm.uniforms.uR.value = R * u * k
      mm.uniforms.uW.value = 2.2
    })
    if (wfG.current) {
      wfG.current.matrix.copy(PERSP)
      wfG.current.matrixWorldNeedsUpdate = true
    }
    /* ปลายทางของแว่นขยาย/caret ในพิกัดกลุ่มข้อความ: หัวแถบ wireframe (ซ้าย/ขวา) */
    const [HXw, HYw, HWw] = WF[WF_HEAD]
    WF_INV.copy(tg ? tg.matrix : g.matrix).invert()
    WF_A.set(p.bx + (HXw - HWw / 2 + 16) * u, -p.by + HYw * u, 0).applyMatrix4(WF_INV)
    WF_B.set(p.bx + (HXw + HWw / 2 + 12) * u, -p.by + HYw * u, 0).applyMatrix4(WF_INV)
    const m = ink.current
    if (m) {
      m.material = inkMat
      m.visible = !!tx.geo && !asWords && !flying
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
      /* ร่างเครื่อง: แว่นขยายขึ้นไปเป็นไอคอนแอปเหนือข้อความ */
      /* ขึ้นก่อนข้อความ (ไม่ชนคำแรกที่กำลังยกขึ้น) แล้วค่อยเข้ากลาง */
      const kdv = inOut01(clamp01(p.dev * 2.4))
      const kdh = inOut01(clamp01((p.dev - 0.2) * 1.5))
      /* บท wire: แว่นขยายบินนำลงไปเป็นไอคอนหัวแถบค้นหาของแอปในจอ */
      const km = asWords ? inOut01(clamp01(p.wire / 0.45)) : 0
      const am = Math.sin(Math.PI * km)
      const mx = lerp(-w / 2 + PAD_L + 14, 0, kdh)
      const my = lerp(0, DEVICE.hh * 0.42, kdv)
      const mz = t.bbThick / 2 + 1 + LAYER_Z[0] * p.float
      mg.position.set(lerp(mx, WF_A.x, km), lerp(my, WF_A.y, km) + am * 20, lerp(mz, WF_A.z, km) + am * 80)
      mg.rotation.set(0, am * 1.2, 0)
      mg.scale.setScalar(Math.max(1e-3, k * lerp(lerp(1, 1.9, kdh), 0.9, km)))
      magStart.p.set(-w / 2 + PAD_L + 14 - 2.5, 3, t.bbThick / 2 + 1).applyMatrix4(tg ? tg.matrix : g.matrix)
      magStart.q.copy(g.quaternion)
      magStart.s = 12.2 * s
    }
    const cr = caret.current
    const caretOn = srch > 0.6 && p.head < 0.05 && p.caretOut < 0.3
    /* ร่างเครื่อง: เคอร์เซอร์พิมพ์ตามไปท้ายบรรทัดที่สอง */
    /* บท wire: caret ตามลงไปกะพริบท้ายแถบค้นหาในจอ (เคอร์เซอร์ของหน้าโผล่จากตรงนั้นในบทค้นคว้า) */
    const kc = asWords ? wfK(p.wire, WF.length - 1) : 0
    const caretX = lerp(lerp(-w / 2 + PAD_L + lead + tx.w + CARET_GAP * 0.5, (words[1].w * TS) / 2 + 10, asWords ? k2 : 0), WF_B.x, kc)
    const caretY = lerp(asWords ? lerp(0, -DEV_LINE / 2 + DEV_TY + 2, kv) : 0, WF_B.y, kc)
    if (cr) {
      cr.visible = caretOn && clock.elapsedTime % 1.06 < 0.56
      cr.position.set(caretX, caretY, lerp(t.bbThick / 2 + 1 + LAYER_Z[2] * p.float, WF_B.z, kc))
      cr.scale.setScalar(asWords ? lerp(1, TS, k2) : 1)
    }
    /* ที่ของเคอร์เซอร์พิมพ์บนจอ — เคอร์เซอร์ของหน้าโผล่จากตรงนี้ (./workMotion) */
    CARET_P.set(caretX, caretY, lerp(t.bbThick / 2 + 1 + LAYER_Z[2] * p.float, WF_B.z, kc)).applyMatrix4(tg ? tg.matrix : g.matrix)
    caretSpot.x = size.width / 2 + CARET_P.x
    caretSpot.y = size.height / 2 - CARET_P.y
    caretSpot.ok = true
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
        <mesh ref={shell} material={glass} frustumCulled={false} />
        {/* ไอคอนของบริการแรก (UX/UI — ปากกาออกแบบ) บนหน้าวงกลมแรก */}
        <mesh ref={icon} geometry={iconGeo} material={iconMat} renderOrder={3} visible={false} />
        {/* เงานุ่มบนผิวเครื่อง (หงายตามเครื่อง) — ข้อความจริงลอยอยู่ในกลุ่มข้างล่าง */}
        <mesh ref={shadow} geometry={shadowGeo} material={shadowMat} renderOrder={1} visible={false} />
      </group>
      <group ref={devG} matrixAutoUpdate={false} visible={false}>
        <mesh geometry={devGeo} material={glass} frustumCulled={false} />
      </group>
      {/* กรอบ wireframe ระหว่างบินลงจอ — พิกัดโลก ผ่านเพอร์สเปกทีฟ (matrix ตั้งในลูปเฟรม) */}
      <group ref={wfG} matrixAutoUpdate={false}>
        {wfMesh.mats.map((m, n) => (
          <mesh
            key={n}
            geometry={wfMesh.geo}
            material={m}
            renderOrder={4}
            visible={false}
            frustumCulled={false}
            ref={(el) => {
              outlineRefs.current[n] = el
            }}
          />
        ))}
      </group>
      {/* ข้อความ ไอคอน เคอร์เซอร์พิมพ์ — กลุ่มแยก ตามท่าฟองแต่ไม่หงายตามเครื่อง (ดู FLOAT_Y) */}
      <group ref={textG} matrixAutoUpdate={false}>
        <mesh ref={ink} material={inkMat} renderOrder={2} />
        {letters.map((lt, n) => (
          <mesh
            key={n}
            geometry={lt.geo}
            material={inkMat}
            renderOrder={2}
            visible={false}
            ref={(el) => {
              letterRefs.current[n] = el
            }}
          />
        ))}
        {words.map((wd, i) => (
          <mesh
            key={i}
            geometry={wd.geo}
            material={inkMat}
            renderOrder={2}
            visible={false}
            ref={(el) => {
              wordRefs.current[i] = el
            }}
          />
        ))}
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
  useCursorStop(null, { id: 'bubble-park-after', at: park, keyVh: top === undefined ? undefined : top + endOf(BEAT.ship) + 0.5, size: 54, tilt: -14 })
  const pose = useRef<Pose>({ ...POSE0 })
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
      const sig = `${p.on}|${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.h.toFixed(1)}|${p.sv.toFixed(4)}|${p.sel.toFixed(3)}|${p.zoom.toFixed(4)}`
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
        <WarmShaders />
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
