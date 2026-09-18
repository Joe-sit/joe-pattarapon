import { useEffect, useRef, useState } from 'react'
import { startIntro } from '@/joespresso/intro'
import { holdIntro, introSkip, releaseIntro } from '@/newhero/intro'
import { panelScreen } from '@/newhero/panelScreen'
import { useNewHeroReady } from '@/newhero/ready'
import { setIntroDone } from '@/stores/intro'
import { headlineReady } from '@/sections/hero/headlineReady'
import { useSceneProgress } from '@/stores/ready'
import { preloadFinalAssets } from './final2026Assets'
import { gateMesh } from './gateMesh'

/**
 * ด่านโหลดของ /2026-final — จุดโหลดสามจุด *มอร์ฟ* เป็นบานพอร์ทัลของจอแรก
 *
 * ไม่ใช่ผ้าคลุมที่จางหายแล้วเจอหน้าเว็บ: ของที่คนดูจ้องอยู่ (จุดโหลด) คือของชิ้นเดียวกับที่
 * กลายเป็นบานหน้าต่าง — สามจุดคลี่ออกไปเป็นสามบาน พื้นเปิดออก *ใต้* ช่องที่กำลังคลี่
 * ตาจึงไม่มีเฟรมไหนที่เห็น "ของหายไปแล้วมีของใหม่มา" (วิธีเดียวกับสปแลชของ /new-hero ที่
 * ตัวหนังสือ JOE แข็งตัวเป็นแผ่นแล้วไถลไปลงบนบาน — ดู newhero/NewHeroSplash)
 *
 * เป้าของการมอร์ฟมาจากฉาก ไม่ได้เดา: `panelScreen` คือที่อยู่ของบานจริงบนจอเป็นพิกเซล
 * อ่านสดทุกเฟรม เพราะกล้องของอินโทรกำลังถอยออก บานจึงเลื่อน/ย่อระหว่างที่ช่องไล่ตาม
 *
 * ### ผืนเดียว เจาะเป็นช่อง ไม่ใช่สามแผ่นที่ถือลายคนละสำเนา
 *
 * ลายสีของฉาก (ดู MESH ข้างล่าง) เป็น **ผืนเดียวเต็มจอ** แล้วตัดให้เห็นเฉพาะสามช่องด้วย
 * `clipPath` ของ SVG — ทุกเฟรมเขียนแค่ x/y/width/height/rx ของ `<rect>` สามใบ
 *
 * ของเดิมเป็นสาม `<div>` ที่แต่ละใบถือลายเต็มจอของตัวเอง แล้วเลื่อนลายสวนกับตำแหน่งตัวเอง
 * เพื่อให้ลายดูตรึงกับจอ — ได้ภาพที่ถูก แต่เท่ากับแรสเตอร์ผืนเบลอเต็มจอสามใบ *ใหม่ทุกเฟรม*
 * ตอนที่ช่องเปลี่ยนขนาด วัดได้: กลางท่ามอร์ฟเฟรมละ 32.5ms (≈30fps) p90 50ms และมีค้าง
 * 167ms สองครั้ง — นั่นคือ "ไม่เนียน" ที่เห็น ไม่ใช่เรื่องท่า
 *
 * ผลพลอยได้: ช่องที่ถูกกล้องดันออกนอกจอไม่ต้องมีท่าจางทิ้งของตัวเองอีก มันหลุดกรอบก็คือ
 * ไม่มีอะไรให้เห็น (ของเดิมเป็นแผ่นทึบ ต้องจางมันทิ้งเองไม่ให้ค้างเป็นก้อนสีที่ขอบ)
 *
 * ### ลายไม่เบลอด้วย filter
 *
 * `filter: blur()` บนผืนเต็มจอคือ pass เพิ่มทุกเฟรม ไล่สีของ radial-gradient นุ่มพออยู่แล้ว
 * (สต็อปจบที่ transparent) — เอา blur ออกหมด เหลือเท่าที่ชั้นละเอียดต้องใช้จริง
 *
 * รอสองอย่างก่อนออกตัว: ไฟล์ของหน้าครบและใช้ได้จริง (ดู ./final2026Assets) และฉากรายงาน
 * ว่าวาดได้จริง (useNewHeroReady) — เนื้อหาของหน้า mount อยู่ข้างหลังตั้งแต่เฟรมแรก
 * ชั้นนี้แค่ทับไว้ ถ้ากั้น mount ฉากจะไม่เริ่มโหลดจนด่านเปิด ซึ่งด่านรอฉากอยู่ = ค้างกันเอง
 */

/** วินาทีที่ยอมรอ ก่อนออกตัวทั้งที่ยังไม่ได้สัญญาณ — กันหน้าค้างถ้ามีอะไรพัง */
const GIVE_UP_AFTER = 12000
/** ความยาวของการมอร์ฟทั้งท่อน (วินาที) */
const MORPH = 1.6
/** ช่องถัดไปออกตัวช้ากว่ากันเท่าไร — ไล่ซ้ายไปขวา */
const STAGGER = 0.09
/** ค้างอยู่ในท่าจุดก่อนออกตัวเท่าไร (สัดส่วนของ MORPH) — จังหวะ "รวมตัวแล้วค่อยคลี่" */
const HOLD = 0.08
/** จำนวนจุด — "..." ของการโหลด แล้วกลายเป็นบาน */
const DOTS = 3
/** ขนาดจุดและระยะห่าง (พิกเซล) */
const DOT = 28
const DOT_GAP = 18
/**
 * จำนวนบล็อกพิกเซลต่อช่อง เป็น log2 — 3 = แปดบล็อกตามด้านกว้าง (ดู ./gateMesh)
 *
 * **คงที่เป็นจำนวนบล็อกต่อช่อง ไม่ใช่คงที่เป็นพิกเซลจอ** ฉากถูกแมปเข้ากับแต่ละช่อง ช่องจึงเป็น
 * จอพิกเซลแปดคูณสิบกว่าบล็อกที่มีฉากครบทั้งฉากตั้งแต่ยังเป็นจุดกว้าง 28px แล้วบล็อกโตตามช่อง
 * ที่คลี่ออก = ภาพเดิมที่ใหญ่ขึ้น ก่อนจะเพิ่มจำนวนบล็อกตอนท้าย = ภาพเดิมที่ละเอียดขึ้น
 *
 * เคยผูกขนาดบล็อกกับพิกเซลจอแล้วแมปฉากกับจอ ซึ่งวัดได้ว่าพัง: ช่องซ้ายสุดถูกกล้องดันให้โต
 * ล้นจอ ด้านสั้นวัดได้ 889px = บล็อก 148px ทั้งผืน (เห็นเป็นแถบสี) และเมื่อลดบล็อกเหลือ 4px
 * คงที่ ช่องกว้าง 119px บนฉากที่กางเต็ม 2285px ก็เห็นแค่เสี้ยวที่สีข้างกันเท่ากันหมด
 */
const WAIT_LEV = 3
/**
 * จำนวนบล็อกตอนจบท่า — 2^7 = ร้อยยี่สิบแปดบล็อกต่อช่อง ราวสองพิกเซลจอ
 *
 * เกินกว่านี้ไม่มีใครเห็นความต่าง (วัดมาแล้ว: ที่ 64 บล็อกภาพเรียบสนิทแล้ว) เพดานสูงเกินไป
 * ทำให้ขั้นที่ *อ่านออก* คือ 8→16→32 ไปกระจุกอยู่ต้นหน้าต่างการคลี่ แล้วที่เหลือนิ่งเฉย
 */
const DONE_LEV = 7
/**
 * พื้นของด่าน = **ขาว** แล้วค่อยกลายเป็นท้องฟ้าของ hero
 *
 * ฟ้าของฉากคิดต่อพิกเซลในเชดเดอร์ (ดู Backdrop ใน NewHeroScene) เอามาทำซ้ำใน CSS ตรง ๆ
 * ไม่ได้ — ค่าที่นี่จึง *วัดจากภาพจริง* ของเฟรมหลังส่งไม้ต่อ: มุมซ้ายบน 29,98,169 ·
 * กลางบน 62,116,186 · รอบดวงอาทิตย์ (uv 0.62, 0.72) 100,152,214 · ล่างขวา 151,207,240 ·
 * ล่างสุด 184,220,243 — ประกอบกลับเป็นไล่สีทะแยงบวกแสงดวงอาทิตย์หนึ่งก้อน
 *
 * ขอบนอกการ์ดของหน้าเป็นสีขาวอยู่แล้ว (วัดได้ 255,255,255) พื้นขาวของด่านจึงตรงกับมันพอดี
 * ฟ้าถูกตัดด้วยกรอบมุมมนชุดเดียวกับ .v3-scene-frame ตอนยังไม่กาง
 */
const SKY = [
  'radial-gradient(54% 46% at 57% 20%, rgba(255,212,188,0.115) 0%, rgba(255,212,188,0.082) 46%, rgba(255,212,188,0) 100%)',
  'linear-gradient(176deg, #1d62a9 0%, #3c7ec4 38%, #7fb6e4 72%, #bcdff5 100%)',
].join(',')

/**
 * ลายรบกวนจิ๋วทับฟ้า — กัน **แถบสี** ของไล่สี CSS
 *
 * ไล่สีของเบราว์เซอร์ปัดเป็นสีละ 8 บิตโดยไม่มี dither: วัดจากคอลัมน์ฟ้าสูง 410px ได้ 33 สี
 * ขณะที่ฟ้าของฉาก (เชดเดอร์ มี dither อยู่ในตัว) ได้ 108 สี — ต่างกันสามเท่า เห็นเป็นแถบ
 * กว้างสิบกว่าพิกเซลพาดทั้งจอ ซึ่งเป็นเหตุที่ฟ้าตอนโหลด "ไม่เนียน" เทียบกับฟ้าหลังส่งไม้ต่อ
 *
 * ใช้ feTurbulence ของ SVG เป็นภาพพื้น ไม่ใช่บริบท WebGL ใบที่สอง: เบราว์เซอร์แรสเตอร์
 * ครั้งเดียวแล้วปูซ้ำ ต้นทุนต่อเฟรมเป็นศูนย์ และไม่ต้องแย่งโควตาบริบท GL กับฉาก
 */
const SKY_GRAIN =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E")`

type Rect = { x: number; y: number; w: number; h: number }
type Pt = { x: number; y: number }

/**
 * เส้นรอบรูปของสี่เหลี่ยม *ด้านไม่ขนาน* มุมมน — ช่องของด่านนี้ใช้ทรงนี้ทั้งตอนเป็นจุดและตอนเป็นบาน
 *
 * ใช้ `<rect>` ไม่ได้: บานในฉากวางเฉียงในเพอร์สเปกทีฟ รูปบนจอจึงเป็นควอดที่สี่มุมไม่ตั้งฉาก
 * เฟรมสุดท้ายของการมอร์ฟต้องทับบานสนิท ไม่ใช่สี่เหลี่ยมตรงวางบนบานที่เอียง
 *
 * มุมเป็นส่วนโค้งวงกลมจริง (A) ไม่ใช่เส้นโค้งกำลังสอง — จุดตั้งต้นคือ *วงกลม* (สี่เหลี่ยมจัตุรัส
 * ที่รัศมีเท่าครึ่งด้าน) ถ้าใช้ Q วงจะออกมาเป็นสี่เหลี่ยมป้าน ๆ ไม่กลม
 */
function roundPath(p: Pt[], radius: number) {
  const n = p.length
  let d = ''
  for (let i = 0; i < n; i += 1) {
    const cur = p[i]
    const prev = p[(i - 1 + n) % n]
    const next = p[(i + 1) % n]
    const d1 = Math.hypot(prev.x - cur.x, prev.y - cur.y) || 1
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y) || 1
    const r = Math.min(radius, d1 / 2, d2 / 2)
    const a = { x: cur.x + ((prev.x - cur.x) / d1) * r, y: cur.y + ((prev.y - cur.y) / d1) * r }
    const b = { x: cur.x + ((next.x - cur.x) / d2) * r, y: cur.y + ((next.y - cur.y) / d2) * r }
    d += `${i === 0 ? 'M' : 'L'}${a.x.toFixed(1)},${a.y.toFixed(1)}`
    d += `A${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${b.x.toFixed(1)},${b.y.toFixed(1)}`
  }
  return `${d}Z`
}

/** สี่มุมของจุด (จัตุรัส) เรียงลำดับเดียวกับสี่มุมของบาน: ซ้ายบน → ขวาบน → ขวาล่าง → ซ้ายล่าง */
function dotCorners(r: Rect): Pt[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ]
}

/** สี่เหลี่ยมครอบของสี่มุม — เชดเดอร์ใช้กรอบนี้แมปฉากเข้ากับช่อง (ดู ./gateMesh) */
function bboxOf(p: Pt[]): Rect {
  let x0 = p[0].x
  let y0 = p[0].y
  let x1 = x0
  let y1 = y0
  for (let i = 1; i < p.length; i += 1) {
    if (p[i].x < x0) x0 = p[i].x
    if (p[i].x > x1) x1 = p[i].x
    if (p[i].y < y0) y0 = p[i].y
    if (p[i].y > y1) y1 = p[i].y
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
/** ไล่เข้า-ออกชุดเดียวกับที่ของในฉากใช้ — จังหวะการเคลื่อนเป็นภาษาเดียวกัน */
const inOut = (x: number) => {
  const u = clamp01(x)
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2
}

/** ที่ยืนของจุดที่ i ตอนยังโหลด — แถวเดียวกลางจอ */
function dotRect(i: number, d = DOT): Rect {
  const span = DOTS * DOT + (DOTS - 1) * DOT_GAP
  return {
    x: window.innerWidth / 2 - span / 2 + i * (DOT + DOT_GAP) + (DOT - d) / 2,
    y: window.innerHeight / 2 - d / 2,
    w: d,
    h: d,
  }
}

/**
 * บานที่จะเป็นเป้า — **เอาใบขวาสุดเท่าจำนวนจุด** แล้วเรียงซ้ายไปขวา
 *
 * เคยคัดจาก "เห็นบนจอกี่เปอร์เซ็นต์" ซึ่งใช้ไม่ได้: ตอนเริ่มมอร์ฟกล้องยัง dolly อยู่ใกล้ ใบ
 * ซ้าย ๆ จึงใหญ่มหึมาและล้นจอ ค่าที่วัดได้จะเปลี่ยนไปทุกรอบที่โหลด — บางรอบผ่านเกณฑ์สามใบ
 * บางรอบสองใบ แล้วจุดที่สามก็ไม่มีบานให้ลง (ยุบหายไปเฉย ๆ แล้วบานจริงโผล่มาตอนส่งไม้ต่อ)
 *
 * แถบหน้าต่างเรียงจากซ้าย (ไกล/ใหญ่) ไปขวา (ใกล้/เล็ก) ใบขวาสุดคือใบที่อยู่ในจอตอนกล้อง
 * เข้าที่แล้ว — เกณฑ์นี้ให้ผลเดิมทุกรอบ ไม่ขึ้นกับว่ากล้องอยู่ตรงไหนตอนมอร์ฟเริ่ม
 */
function pickPanels() {
  const all = panelScreen.ready ? panelScreen.rects : []
  return all
    .map((r, i) => ({ i, x: r.x }))
    .sort((a, b) => b.x - a.x)
    .slice(0, DOTS)
    .sort((a, b) => a.x - b.x)
    .map((q) => q.i)
}

export function Final2026Gate() {
  const progress = useSceneProgress()
  const sceneReady = useNewHeroReady()
  const [assetsReady, setAssetsReady] = useState(false)
  const [morphing, setMorphing] = useState(false)
  const [gone, setGone] = useState(false)
  const veil = useRef<HTMLDivElement>(null)
  /** ชั้นท้องฟ้าที่ค่อย ๆ ขึ้นมาทับพื้นขาว */
  const sky = useRef<HTMLDivElement>(null)
  /** ช่องทั้งสาม — `<path>` ใน clipPath เดียวกัน */
  const holes = useRef<(SVGPathElement | null)[]>([])
  /** แคนวาสของลายไล่สี (เชดเดอร์ — ดู ./gateMesh) และผืนที่ครอบมันไว้ */
  const canvas = useRef<HTMLCanvasElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const mesh = useRef<ReturnType<typeof gateMesh>>(null)
  /**
   * ที่ยืนของช่องในเฟรมล่าสุดของท่ารอ — จุดตั้งต้นของการมอร์ฟ
   *
   * ไม่ใช่ `dotRect(i)` เฉย ๆ: ตอนรอ จุดเต้นอยู่ (ขนาดแกว่งถึง 1.3 เท่า) ถ้ามอร์ฟเริ่มจาก
   * ขนาดฐาน เฟรมแรกของท่าจะกระตุกกลับมาที่ขนาดฐานก่อนแล้วค่อยออกตัว
   */
  const at = useRef<Pt[][]>(
    Array.from({ length: DOTS }, (_, i) => dotCorners(typeof window === 'undefined' ? { x: 0, y: 0, w: DOT, h: DOT } : dotRect(i))),
  )

  /* กดอินโทรไว้ตั้งแต่เฟรมแรก — ต้องเกิดก่อนที่ฉากจะได้เฟรมแรกของตัวเอง */
  useEffect(() => {
    holdIntro()
    return () => releaseIntro()
  }, [])

  /**
   * ขอให้ฉากเริ่มฉายพิกัดบานตั้งแต่ยังโหลด — ถึงจังหวะมอร์ฟจะได้มีเป้าพร้อมอยู่แล้ว
   * และบานต้องข้ามท่าโผล่ของตัวเอง เพราะช่องของด่านนี้เป็นคนพามันขึ้น
   */
  useEffect(() => {
    panelScreen.want = true
    introSkip.windows = true
    introSkip.camera = true
    return () => {
      panelScreen.want = false
    }
  }, [])

  /* ผูกเชดเดอร์ครั้งเดียว — ลูปของด่าน (ทั้งตอนรอและตอนมอร์ฟ) เป็นคนสั่งวาด */
  useEffect(() => {
    const el = canvas.current
    if (!el) return undefined
    mesh.current = gateMesh(el)
    return () => {
      mesh.current?.dispose()
      mesh.current = null
    }
  }, [])

  useEffect(() => {
    let alive = true
    void preloadFinalAssets().then(() => {
      if (alive) setAssetsReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  /**
   * ออกตัวเมื่อ *ทุกอย่าง* พร้อมจริง ไม่ใช่แค่ไบต์ครบ
   *
   * สี่ด่าน: ไฟล์ของหน้าครบ+ถอดรหัสแล้ว+ฟอนต์พร้อม (assetsReady) · ฉาก 3D วาดได้จริง
   * (sceneReady — แตก GLB และคอมไพล์ shader จบ) · หัวเรื่อง 3D ปั้น TextGeometry ครบทุก
   * บรรทัด (headlineReady) · และฉากฉายพิกัดบานออกมาแล้ว (panelScreen.ready — ไม่มีค่านี้
   * มอร์ฟก็ไม่มีเป้า ต้องตกไปทางถอยที่เป็นการจางออกเฉย ๆ)
   *
   * สามตัวแรกเป็น state/ธง ตัวหลังเป็นสโตร์ที่เขียนจากลูปวาดของฉาก — เช็คด้วย rAF ไม่ใช่
   * setInterval เพื่อให้เห็นค่าในเฟรมเดียวกับที่ฉากเขียน
   */
  useEffect(() => {
    if (!assetsReady || !sceneReady || morphing) return undefined
    let raf = 0
    const look = () => {
      if (panelScreen.ready && headlineReady.armed && headlineReady.pending === 0) {
        setMorphing(true)
        return
      }
      raf = requestAnimationFrame(look)
    }
    raf = requestAnimationFrame(look)
    return () => cancelAnimationFrame(raf)
  }, [assetsReady, sceneReady, morphing])

  /* ทางถอย: รอนานเกินไปก็เปิด ดีกว่าค้างอยู่อย่างนั้น */
  useEffect(() => {
    const id = setTimeout(() => setMorphing(true), GIVE_UP_AFTER)
    return () => clearTimeout(id)
  }, [])

  /** เขียนช่องที่ i ลง clipPath */
  const put = (i: number, pts: Pt[], radius: number) => {
    const el = holes.current[i]
    if (!el) return
    at.current[i] = pts
    el.setAttribute('d', roundPath(pts, Math.max(0, radius)))
  }

  /** ท่ามอร์ฟ — เขียนลง DOM ตรง ๆ ทุกเฟรม ไม่ผ่าน state */
  useEffect(() => {
    if (!morphing) return undefined
    /**
     * ปล่อยอินโทรของฉากตอนเริ่มมอร์ฟ แล้วให้ช่อง *ไล่ตาม* บานที่กำลังเลื่อน
     *
     * เคยลองกั้นอินโทรไว้จนจบมอร์ฟเพื่อให้เป้านิ่ง — ใช้ไม่ได้: ท่าที่ฉากค้างอยู่ตอนถูกกั้น
     * ไม่ใช่ท่าตั้งต้นของอินโทร (วัดได้ บานใบกลางกว้าง 731px ตอนถูกกั้น แล้วกระโดดไป 200px
     * ทันทีที่ปล่อย เพราะกล้องเริ่มเดินจากท่าของตัวเอง) = รอยกระโดดตรงจุดส่งไม้ต่อพอดี
     *
     * ปล่อยก่อนแล้วไล่ตามจึงเป็นทางเดียวที่ไม่มีรอยกระโดด — เป้าอ่านสดทุกเฟรมและหน่วงตาม
     * (ดูข้างล่าง) ส่วนสิ่งที่ทำให้ "เห็นการ fade จาก loading เป็น portal" ไม่ใช่เรื่องนี้
     * มันคือพื้นที่จางระหว่างทาง + ผืนลายที่จางสลับกับบานจริง ซึ่งถอดออกแล้วทั้งคู่
     */
    releaseIntro()
    startIntro()
    setIntroDone()

    const picked = pickPanels()
    /* ไม่มีบานให้เล็ง (ปิดฉาก/โหลดพลาด) = จางออกเฉย ๆ ต้องมีทางถอย ไม่ใช่ค้างรอเป้า */
    if (!picked.length) {
      const el = veil.current
      if (el) {
        el.style.transition = 'opacity 420ms ease'
        el.style.opacity = '0'
      }
      const id = setTimeout(() => setGone(true), 460)
      return () => clearTimeout(id)
    }

    /* ออกตัวจากสี่มุมที่จุดอยู่จริงในเฟรมสุดท้ายของท่ารอ ไม่ใช่ขนาดฐาน */
    const src = at.current.map((pts) => pts.map((q) => ({ ...q })))
    /** สี่มุมที่ *เขียนลงจอจริง* ในเฟรมล่าสุด — เป้าของเชดเดอร์และตัวส่องค่าตอนพัฒนา */
    const lastOut = at.current.map((pts) => pts.map((q) => ({ ...q })))
    /** ตัวส่องทางเดินตอนพัฒนา — ว่างเปล่าในโปรดักชัน */
    const trace: number[][] = []
    let raf = 0
    const t0 = performance.now()
    const step = () => {
      const nowMs = performance.now()
      const now = (nowMs - t0) / 1000
      const all = clamp01(now / MORPH)

      /**
       * พื้นขาวกลายเป็นท้องฟ้า *ให้จบก่อนกลางท่า* แล้วจึงเปิดออกตอนท้ายสั้น ๆ
       *
       * พื้นยังทึบตลอดทาง แต่เปลี่ยนสีเป็นฟ้าของฉากระหว่างนั้น สิ่งที่เปลี่ยนตอนจางจึงเหลือแค่
       * ของในฉาก (พื้นหญ้า ถนน ตัวละคร) ไม่ใช่ทั้งพื้นหลังทั้งแผ่น
       *
       * หน้าต่างของการเปลี่ยนสีต้องจบ *ก่อน* ที่ผ้าคลุมจะเริ่มจาง ไม่ใช่ชนกัน: เคยตั้งไว้
       * 0.12–0.82 ขณะที่ผ้าคลุมเริ่มจางที่ 0.84 — ฟ้าเต็มที่อยู่ได้ 30ms แล้วละลายทันที
       * คนดูจึงไม่ได้เห็น "ขาวกลายเป็นฟ้า" เลย เห็นแค่ขาวแล้วเป็นฉาก ตอนนี้จบที่ 0.55
       * เหลือเวลาให้ฟ้าเต็มจออยู่จริงราวครึ่งวินาทีก่อนบานจะมาถึง
       */
      if (sky.current) sky.current.style.opacity = inOut((all - 0.05) / 0.5).toFixed(3)
      if (veil.current) veil.current.style.opacity = `${1 - inOut((all - 0.84) / 0.16)}`

      for (let i = 0; i < DOTS; i += 1) {
        const a = src[i]
        const idx = picked[i]
        const u = inOut((now / MORPH - HOLD - i * STAGGER) / 0.74)
        if (idx === undefined) {
          /* จุดที่ไม่มีบานรองรับ (บานบนจอน้อยกว่าจำนวนจุด) — ยุบหายเข้าหาใจกลางตัวเอง */
          const k = 1 - clamp01(now / (MORPH * 0.28))
          const cx = (a[0].x + a[2].x) / 2
          const cy = (a[0].y + a[2].y) / 2
          put(
            i,
            a.map((q) => ({ x: cx + (q.x - cx) * k, y: cy + (q.y - cy) * k })),
            (Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y) * k) / 2,
          )
          continue
        }
        /**
         * เป้าเป็นค่า *สด* ของเฟรมนี้ ไม่ใช่ค่าที่จับไว้ตอนเริ่ม — บานกำลังเลื่อนตามกล้องที่
         * ถอยออก เล็งค่าเก่าแล้วช่องจะไปจอดที่ที่บานเคยอยู่ เฟรมสุดท้ายก็ไม่ทับกัน
         */
        /**
         * เป้าคือ **สี่มุมจริงของบาน** ไม่ใช่กรอบสี่เหลี่ยมที่ครอบมัน
         *
         * บานวางเฉียงในเพอร์สเปกทีฟ รูปบนจอเป็นสี่เหลี่ยมด้านไม่ขนาน ของเดิมมอร์ฟไปเป็น
         * กรอบครอบ (สี่เหลี่ยมมุมฉาก) เฟรมสุดท้ายจึงเป็นสี่เหลี่ยมตรงวางทับบานที่เอียง —
         * ขอบเหลื่อมกันทุกด้าน นั่นคือรอยต่อ 2D→3D ที่เห็น
         */
        /**
         * เป้าคือค่า *สดของเฟรมนี้* วางทับตรง ๆ ไม่หน่วง ไม่เดาล่วงหน้า
         *
         * ได้เพราะฉากรายงานท่าของเฟรมนี้จริงแล้ว (ดู PanelProbe — มันอัปเดตเมทริกซ์เองก่อน
         * ฉาย) เฟรมที่ฉากไม่ได้วาดใหม่ บานบนจอก็ยังเป็นภาพเดิม ช่องที่ค้างตามจึงตรงกับที่
         * ตาเห็นพอดี
         *
         * เคยหน่วงด้วย `1 - exp(-k·dt)` แล้วผสมกลับเข้าหาค่าดิบด้วย u³ ตอนท้าย เพราะ
         * ค่าที่อ่านได้เป็นขั้นบันได — แต่ขั้นบันไดนั้นมาจากการรายงานที่คลาดหนึ่งเฟรม ไม่ใช่
         * จากการเคลื่อนของฉาก แก้ที่ต้นทางแล้วตัวหน่วงก็ไม่ต้องมี (มันยังเพิ่มพจน์
         * 3u²u̇·ค่าที่ตามหลัง เข้าไปในความเร็วอีกชั้น = กระตุกที่มันควรจะกลบ)
         */
        const q = panelScreen.quads[idx]
        const b = panelScreen.rects[idx]
        if (!q || !b) continue
        const out = a.map((p0, m) => ({
          x: p0.x + (q[m].x - p0.x) * u,
          y: p0.y + (q[m].y - p0.y) * u,
        }))
        /* รัศมีปลายทางมาจากฉาก (พิกเซลจริง) ไม่ใช่ 0.17 ของด้านสั้นของกรอบบนจอ — ดู panelScreen */
        const wantR = DOT / 2 + ((panelScreen.radii[idx] ?? Math.min(b.w, b.h) * 0.17) - DOT / 2) * u
        lastOut[i] = out
        /* วงกลม → มุมมนของบาน (สัดส่วนของด้านสั้น เหมือน Panel ในฉาก) */
        put(i, out, wantR)
      }

      /**
       * ช่วงท้าย: ลายเดินเข้าหาหน้าตาของเนื้อในบานจริง (ฟ้าบน หญ้าล่าง) แทนการจางสลับ
       *
       * รูปทรงตรงกันอยู่แล้ว (สี่มุมจริงของบาน) เหลือแค่สี — พอสีตรงกันด้วย เฟรมที่สลับจาก
       * ลายเป็นบานจริงจึงไม่มีอะไรให้ตาจับ ไม่ต้องมีการจางเข้า-ออกเลย
       */
      /**
       * บล็อกพิกเซลคมขึ้นตลอดท่า แล้วชั้นสุดท้ายกลืนเป็นเนื้อในบานจริง
       *
       * `uPix` เดินตามท่า (ไม่ใช่ตามเวลาจริง) ความคมจึงผูกกับการคลี่ของช่อง — ตาอ่านว่า
       * "ฉากในพอร์ทัลกำลังชัดขึ้นพร้อมกับที่ช่องเปิดออก" ไม่ใช่สองเรื่องที่เดินคนละนาฬิกา
       */
      /**
       * บล็อกใหญ่ตามช่อง แล้วยุบลงเป็นหนึ่งพิกเซลช่วงท้าย
       *
       * ระหว่างบิน ขนาดบล็อกผูกกับขนาดช่อง (ราวหกบล็อกต่อด้านสั้น) ฉากในช่องจึงเป็นพิกเซล
       * โต ๆ อ่านออกว่าเป็นฉากเดียวกันตั้งแต่ยังเล็ก แล้วช่วงท้ายบล็อกยุบลงเหลือหนึ่งพิกเซล
       * พร้อมกับที่สีเพิ่มขั้น = ภาพคมขึ้นจนกลืนกับฉาก 3D จริงในเฟรมที่สลับ
       */
      /**
       * จำนวนบล็อกต่อช่องไล่ขึ้นเป็นเท่าตัวช่วงท้าย: 8 → 16 → … → 512 (เรียบ)
       *
       * ทุกขั้นเป็นกำลังสอง กริดของขั้นละเอียดจึงซ้อนในกริดของขั้นหยาบพอดี และเชดเดอร์ไล่สี
       * ข้ามสองขั้นที่ประกบค่าอยู่ — ตาเห็น "สี่บล็อกแยกตัวออกจากบล็อกเดียว" ไม่ใช่ลายสองผืน
       * ที่เส้นแบ่งไม่ตรงกันจางทับกัน และไม่มีเฟรมไหนที่กริดเลื่อน
       */
      /* หน้าต่างการคลี่ยืดถึงเฟรมส่งไม้ต่อ — ขั้น 8→16→32→64→128 จึงกระจายเท่า ๆ กันทั้งท่า */
      const resolve = inOut((all - 0.4) / 0.6)
      mesh.current?.draw(
        performance.now(),
        lastOut.map(bboxOf),
        inOut((all - 0.68) / 0.3),
        WAIT_LEV + (DONE_LEV - WAIT_LEV) * resolve,
      )

      if (import.meta.env.DEV) {
        /* ทางเดินที่ *เขียนลงจอจริง* ของช่องขวาสุด — วัดความเรียบข้ามลูปอื่นไม่ได้ ต้องเก็บที่นี่ */
        trace.push([+nowMs.toFixed(2), +all.toFixed(4), +lastOut[2][0].x.toFixed(2), +lastOut[2][0].y.toFixed(2)])
        /* ส่องได้จากข้างนอกว่าช่อง (cur) ตามเป้า (want) ห่างกันกี่พิกเซลในแต่ละเฟรม */
        ;(window as unknown as { __gate?: unknown }).__gate = {
          trace,
          u: +all.toFixed(3),
          cur: lastOut.map((q) => q.map((c) => [Math.round(c.x), Math.round(c.y)])),
          want: picked.map((idx) => panelScreen.quads[idx]?.map((c) => [Math.round(c.x), Math.round(c.y)])),
        }
      }
      if (all < 1) {
        raf = requestAnimationFrame(step)
        return
      }
      /**
       * ส่งไม้ต่อ: ถอดผ้าคลุมกับผืนลายในเฟรมเดียว แล้วอินโทรของฉากเริ่มเดินจากตรงนั้น
       *
       * บานจริงอยู่ตรงสี่มุมที่ช่องเพิ่งลงพอดี และสีก็ถูกไล่เข้าหากันไว้แล้ว เฟรมนี้จึงเป็น
       * "ของชิ้นเดิมกลายเป็นของจริง" ไม่ใช่ของใหม่จางขึ้นมาแทน
       *
       * ถอดทั้งผ้าคลุมและผืนลายพร้อมกันในเฟรมเดียว ไม่มีการจางใด ๆ
       */
      setGone(true)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [morphing])

  /** ท่ารอ: จุดเต้นเป็นระลอก และโตทีละจุดตามไบต์ที่โหลดมาได้ */
  useEffect(() => {
    if (morphing || gone) return undefined
    let raf = 0
    const tick = (now: number) => {
      for (let i = 0; i < DOTS; i += 1) {
        /**
         * เต้นด้วยขนาดของช่อง และ "โต" ตามไบต์จริงของไฟล์ฉาก (แบ่งเป็นสามขั้น)
         *
         * ความคืบหน้าอยู่ในขนาด ไม่ใช่ความทึบ เพราะลายเป็นผืนเดียวใบเดียว — จะทำให้จุดแต่ละ
         * จุดทึบไม่เท่ากันต้องแยกเป็นสามผืน ซึ่งเป็นต้นเหตุของเฟรมตกที่เพิ่งแก้ไป
         */
        const fill = clamp01(progress * DOTS - i)
        const d = DOT * (0.52 + 0.48 * fill) * (1 + 0.16 * Math.sin(now / 320 - i * 0.7))
        put(i, dotCorners(dotRect(i, d)), d / 2)
      }
      /* ตอนรอ: แปดบล็อกต่อด้านของจุด จุดจึงเป็นฉากพิกเซลจิ๋วที่ยังมีเมฆลอยกับใบพัดหมุน */
      mesh.current?.draw(now, at.current.map(bboxOf), 0, WAIT_LEV)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [morphing, gone, progress])

  if (gone) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-9998">
      {/* พื้นทึบ — ชั้นล่างสุด เปิดออกใต้ช่องที่กำลังคลี่ */}
      <div
        ref={veil}
        className="absolute inset-0 bg-white"
        style={{ pointerEvents: morphing ? 'none' : 'auto' }}
        aria-busy={!morphing}
        aria-live="polite"
      >
        {/* ฟ้าของ hero — ตัดด้วยกรอบมุมมนชุดเดียวกับการ์ดของฉาก ขอบนอกจึงยังเป็นขาวของหน้า */}
        <div
          ref={sky}
          className="absolute inset-0"
          style={{
            background: SKY,
            opacity: 0,
            clipPath:
              'inset(var(--v3-frame-gap) var(--v3-frame-gap) 0 round clamp(30px, 3.4vw, 56px))',
          }}
        >
          {/* ลายรบกวนกันแถบสีของไล่สี CSS (ดู SKY_GRAIN) — จางมาก แค่พอทำลายขั้นของสี */}
          <div
            className="absolute inset-0"
            style={{ background: SKY_GRAIN, opacity: 0.055, mixBlendMode: 'overlay' }}
          />
        </div>
      </div>
      {/* ช่องของ clipPath — พิกัดเป็นพิกเซลของวิวพอร์ตตรง ๆ (userSpaceOnUse ปริยาย) */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <clipPath id="v3-gate-holes">
            {Array.from({ length: DOTS }, (_, i) => (
              <path
                key={i}
                ref={(n) => {
                  holes.current[i] = n
                }}
                d=""
              />
            ))}
          </clipPath>
        </defs>
      </svg>
      {/**
       * ผืนลาย — ไล่สีของฉากในพอร์ทัลทั้งชุด วาดด้วยเชดเดอร์ (ดู ./gateMesh)
       *
       * ผืนนี้ตรึงกับจอ ไม่ได้ติดไปกับช่อง ช่องที่คลี่ออกจึงเป็นการ "เปิดให้เห็นผืนเดิมกว้างขึ้น"
       * ไม่ใช่ลายที่ยืดตามช่อง — และเพราะลายมาจากเชดเดอร์ ทุกจุดของผืนเปลี่ยนสีคนละจังหวะ
       * ไม่มีลายซ้ำให้เห็นเป็นตารางเวลาช่องโตเป็นบาน (ปัญหาของลาย CSS ชุดก่อน)
       *
       * แคนวาสเล็ก (320×200) ถูก CSS ขยายเต็มจอ — การกรอง bilinear ของเบราว์เซอร์ให้ไล่สี
       * ที่เนียนกว่าวาดเต็มความละเอียด และงานต่อเฟรมเหลือหกหมื่นพิกเซล
       */}
      <div
        ref={sheet}
        className="absolute inset-0"
        style={{ clipPath: 'url(#v3-gate-holes)', willChange: 'opacity' }}
      >
        <canvas ref={canvas} className="block h-full w-full" />
      </div>
      <span className="sr-only">{`Loading ${Math.round(Math.min(1, progress) * 100)}%`}</span>
    </div>
  )
}
