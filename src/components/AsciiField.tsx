import { useEffect, useRef } from 'react'
import type { CSSProperties, MutableRefObject } from 'react'

/**
 * สนามอักขระของอินโทร — ทั้งคลิปคือ "สนามความสูงใบเดียว" ที่เรนเดอร์ด้วย ramp เดียว
 *
 * ไล่เฟรมในโฟลเดอร์ intro-frame ครบทั้ง 189 ใบ (รอบสอง เจาะช่วง f036-f170) แล้วได้ว่า
 * สิ่งที่เคยเข้าใจผิดคือคิดว่าพื้นหลังกับริบบิ้นเป็นของคนละชิ้นวาดซ้อนกัน ในคลิปมันคือ
 * ค่าเดียวกัน ต่างกันแค่ "สูงแค่ไหน" แล้วถูกแปลงเป็นอักขระด้วยบันไดเดียวกันทั้งจอ:
 *
 *     _  •  =  +  <  :  ;  !  $  @  #  ▉
 *     └── ฟ้าเข้ม ──┘ └ ฟ้า ┘ └ คราม ┘ └ ส้ม ┘ └ บล็อกทึบ
 *
 * ลำดับที่เห็นจริงจึงอ่านได้ตรง ๆ ว่าเป็นการเลื่อนระดับของสนาม ไม่ใช่การสลับเลเยอร์:
 *
 *   f036-f044  ก้อน noise ("เกาะ") โผล่จากขอบจอซ้าย ลอยเข้ากลาง คอนทัวร์ซ้อนชั้นเหมือน
 *              แผนที่ภูมิประเทศ ทั้งหมดยังอยู่แค่ชั้นฟ้า
 *   f052-f076  เกาะโตขึ้นเต็มจอ แกนกลางไต่ขึ้นถึงชั้นคราม ($ @ สีน้ำเงินสด)
 *   f084       เฟรมแรกที่มี "บล็อกส้มทึบ" — โผล่ตรงแกนเกาะพอดี นี่คือเมล็ดของริบบิ้น
 *   f092-f124  บล็อกทึบยืดยาวออกเป็นแถบ คอนทัวร์ ASCII ยังห่อรอบเป็นขอบฟุ้ง ปลายแถบ
 *              สลายกลับเป็น # @ $ ! ; : < + = ตามลำดับ
 *   f132+      คอนทัวร์บนตัวแถบหายหมด เหลือส้มทึบล้วนขอบบันได ส่วนเกาะฟ้ายังลอยอยู่
 *              ที่ขอบจอตลอดจนจบ
 *   f156/f170  ปื้นขาวกว้างไล่เฉดพาดตัวแถบ และมีอักขระอ่อน ๆ (, ; + > $ @) เป็นลายเฉด
 *              อยู่บนเนื้อแถบ ไม่ใช่แถบขาวคม ๆ
 *
 * เพราะฉะนั้นค่าต่อช่องคือ  level = max(ภูมิประเทศ, ริบบิ้น)  แล้วส่งเข้า ramp เดียว
 * "การแปลงร่าง" จึงเกิดเองเมื่อริบบิ้นไต่ระดับขึ้นมาแซงภูมิประเทศ ไม่ต้องมีรอยต่อ
 *
 * เฟรมสุดท้าย (f189) วงไม่ได้จางหายเฉย ๆ แต่ถูกหั่นเป็นขีดนอนสั้น ๆ เรียงเป็นวงกลม
 */

/**
 * บันไดความสูง — ดัชนีสุดท้ายคือ "บล็อกทึบ" ไม่ใช่ตัวอักษร จึงเก็บเป็นช่องว่างไว้
 * แล้วให้ตัววาดเช็คดัชนีเอง
 */
const RAMP = '_•=+<:;!$@#'
/** สีของแต่ละขั้น ไล่ฟ้าเข้ม → ฟ้า → คราม → ส้ม ตรงตามที่เห็นในเฟรม */
const RAMP_TINT = [
  '#132433',
  '#1a3450',
  '#21486a',
  '#285f86',
  '#3076a3',
  '#3b85b3',
  '#4a7ec0',
  '#5b5bd8',
  '#6a5fdd',
  '#b8734e',
  '#e08a5c',
]
/** ขนาดช่องหนึ่งช่อง หน่วยพิกเซล — ฟอนต์ mono กว้างราว 0.6 ของความสูง */
const CELL_W = 11
const CELL_H = 16

/** สีบล็อกทึบของริบบิ้น */
const INK = '#F79C6A'
/**
 * ไฮไลต์ที่กวาดไปตามตัวริบบิ้น — ในคลิป (f154-f181) เป็นปื้นขาว "ไล่เฉด" กว้าง ๆ
 * ไม่ใช่แถบคม จึงต้องมีขั้นเยอะพอที่ตาจะอ่านเป็นเกรเดียนต์
 */
const SPEC = ['#f8ac80', '#fabb95', '#fccbab', '#fdd9c2', '#fee7d9', '#fff3ee', '#ffffff']
/** ลายเฉดบนเนื้อแถบ (f156-f175) — อักขระอ่อน ๆ โปรยบนพื้นส้ม */
const GRAIN = ',;:+>$@'

/* ---------- โลโก้ J O E ---------- */

/**
 * รูปทรงที่แถบกวาดแล้วกลายเป็น — ยกพาธมาจาก JoeLettersSplash ตรง ๆ
 * พิกัดเป็นระบบเดียวกับ viewBox ของสปแลช ("-10 -10 259 104") หมึกกินช่วง x 0..239, y 0..84
 */
const LOGO_INK = [
  // J — ตัวถังก้นมน
  'M0 0H81V43.5C81 65.8675 62.8675 84 40.5 84V84C18.1325 84 0 65.8675 0 43.5V0Z',
  // E — ตัวถังหลัก
  'M174 2H232V81H174V65H162V18H174Z',
  // E — เดือยหน้า
  'M231 10H239V39H231Z',
]
/**
 * O ประกอบจากกลีบวงรีสี่กลีบ — ค่า cx/cy/rot ตรงกับ PETALS ในสปแลชเป๊ะ
 * กลีบเริ่มซ้อนกันที่กลางตัว O แล้วแยกออกไปพร้อมหมุน
 */
const LOGO_PETALS: { cx: number; cy: number; rx: number; ry: number; rot: number }[] = [
  { cx: 117.717, cy: 62.9484, rx: 15.1684, ry: 18.4624, rot: 59.365 },
  { cx: 126.342, cy: 20.4592, rx: 15.1684, ry: 18.4624, rot: 59.365 },
  { cx: 99.732, cy: 41.2846, rx: 14.1752, ry: 19.4078, rot: 28.5804 },
  { cx: 144.851, cy: 41.4516, rx: 14.1752, ry: 19.4078, rot: 28.5804 },
]
/** กลางตัว O — จุดที่กลีบทุกใบเริ่มต้นซ้อนกันอยู่ */
const O_CENTRE = { x: 122, y: 42 }
/**
 * ตารางจังหวะของแต่ละชิ้น ยกสัดส่วนมาจากไทม์ไลน์ประกอบร่างของสปแลช (ยาว 3 วินาที)
 * แปลงเป็นช่วงบน build 0-1 ลำดับที่โผล่จึงเป็น E → O → J เหมือนกัน
 */
const PART = {
  eClipW: [0.0, 0.44],
  eOpening: [0.15, 0.42],
  eCounter: [0.13, 0.35],
  eFront: [0.22, 0.35],
  eClipX: [0.31, 0.44],
  oBullet: [0.37, 0.54],
  oSpread: [0.44, 0.68],
  oRotate: [0.47, 0.94],
  jBody: [0.29, 0.87],
  jCorner: [0.48, 0.96],
  jMask: [0.53, 1.0],
} as const

/** ส่วนที่ต้องเจาะออก (สีกระดาษในสปแลช) */
const LOGO_PAPER = [
  // J — ลิ้นตรงกลาง
  'M41 55C36.5817 55 33 51.4183 33 47L33 30L49 30L49 47C49 51.4183 45.4183 55 41 55V55Z',
  // J — บากมุมซ้ายบน
  'M-1 -1H34V31H-1Z',
  // E — ช่องเปิดล่าง
  'M185 57C185 52.5817 188.582 49 193 49H239V65H193C188.582 65 185 61.4183 185 57Z',
]
/** ช่องกลางตัว E เป็นสี่เหลี่ยมมุมมน */
const LOGO_COUNTER = { x: 185, y: 18, w: 35, h: 16, r: 8 }
const LOGO_X0 = 0
const LOGO_X1 = 239
const LOGO_CX = 119.5
const LOGO_CY = 42
const LOGO_H = 84

/** ส่วนของช่วง ตัดหัวท้ายให้อยู่ใน 0-1 */
const span = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)))

/** ค่าที่อินโทรป้อนเข้ามาทุกเฟรม — อ่านผ่าน ref ไม่ให้ React รีเรนเดอร์ 24 ครั้งต่อวินาที */
export type AsciiDrive = {
  /** ความสว่างรวมของภูมิประเทศ 0-1 */
  gain: number
  /**
   * ริบบิ้นถูกดันขึ้นบันไดสูงแค่ไหน 0-1
   *
   * 0 = ไม่มีอะไร, ~0.5 = แกนเริ่มเป็นส้ม/บล็อกเล็ก ๆ ขอบยังเป็นคอนทัวร์ ASCII หนา,
   * 1 = แกนทึบเต็ม ขอบเหลือคอนทัวร์บาง ๆ
   */
  ink: number
  /** บีบคอนทัวร์รอบแถบให้แคบลงจนหายไป 0-1 — คือช่วง f124→f132 ที่ขอบฟุ้งหดหมด */
  solid: number
  /** วางแถบไปตามวงแล้วกี่ส่วน 0-1 (0 = ยังไม่มีอะไร, 1 = ครบวง) */
  build: number
  /**
   * ความร้อนของแกนเกาะ 0-1
   *
   * ไม่ใช่เลเยอร์แยก — เป็นตัวคูณที่ดันแกนของก้อน noise ให้ไต่จากชั้นฟ้าขึ้นไปถึงชั้นคราม
   * ($ ! สีน้ำเงินสด) ตามที่เห็นใน f070-f100 ก่อนที่ริบบิ้นจะโผล่ตรงนั้นพอดี
   */
  guide: number
  /** มุมหมุนของวงรอบแกนตั้ง หน่วยเรเดียน — ตัวเดียวที่ทำให้เห็นท่าต่าง ๆ ครบ */
  spin: number
  /** ตำแหน่งของปื้นไฮไลต์ขาวบนความยาววง 0-1 (วนรอบได้) */
  sweep: number
  /** หั่นเป็นขีด 0-1 — ท่าปิดของคลิป (f189) วงถูกตัดเป็นขีดนอนเรียงเป็นวงกลม */
  shatter: number
}

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/** value noise สองมิติ: สุ่มค่าที่มุมช่องแล้วเกลี่ยด้วย smoothstep */
function noise(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi)
  const b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1)
  const d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

type AsciiFieldProps = {
  className?: string
  style?: CSSProperties
  drive: MutableRefObject<AsciiDrive>
}

export function AsciiField({ className, style, drive }: AsciiFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const mouse = { x: -999, y: -999 }
    let cols = 0
    let rows = 0

    /** ริบบิ้นกินช่องนี้เต็มแค่ไหน 0-1 (แกนทึบ) */
    let cov = new Float32Array(0)
    /** คอนทัวร์รอบแถบ 0-1 — ได้จากการเบลอ cov ทำให้ค่าลดหลั่นออกไปเป็นวงรอบ */
    let hal = new Float32Array(0)
    /** ช่วงที่ "ร้อนแล้ว" 0-1 — ส่วนของวงที่ถูกดันขึ้นถึงชั้นบล็อกทึบ */
    let hotm = new Float32Array(0)
    /** ปื้นไฮไลต์ในช่องนี้ 0-1 */
    let spc = new Float32Array(0)

    /** ขอบทั้งสองข้างของแถบ ฉายลงจอแล้ว */
    /** ความลึกของแต่ละจุด ใช้หั่นวงเป็นช่วงแล้วเรียงวาดจากไกลไปใกล้ */
    /** คู่ [เริ่ม, จบ] ของแต่ละช่วง เก็บเรียงกันในอาร์เรย์เดียว */

    /**
     * แคนวาสนอกจอ ทั้งสามใบมีขนาดเท่า "ตาราง" ไม่ใช่เท่าจอ — หนึ่งพิกเซลคือหนึ่งช่อง
     * จึงเบลอด้วยรัศมีหน่วยช่องได้ตรง ๆ และอ่านกลับมาเป็นค่าต่อช่องได้โดยไม่ต้องสุ่ม
     */
    const off = document.createElement('canvas')
    const octx = off.getContext('2d', { willReadFrequently: true })
    const blur = document.createElement('canvas')
    const bctx = blur.getContext('2d', { willReadFrequently: true })
    const hot = document.createElement('canvas')
    const tctx = hot.getContext('2d', { willReadFrequently: true })
    const hi = document.createElement('canvas')
    const hctx = hi.getContext('2d', { willReadFrequently: true })

    let raf = 0
    let last = 0
    let t = 0


    /**
     * แสตมป์ริบบิ้นลงตารางช่อง แล้วอ่านกลับมาเป็นสามสนาม: แกนทึบ / คอนทัวร์ / ไฮไลต์
     *
     * ที่ต้องเรียงตามความลึกเพราะตอนวงไขว้ตัวเอง (f134-141) ในคลิปมีเส้นดำคั่นชัดเจน
     * ระหว่างแถบหน้ากับแถบหลัง — ไม่ใช่สองแถบกลืนเป็นก้อนเดียว
     */
    const inkPaths = LOGO_INK.map((d) => new Path2D(d))
    const paperPaths = LOGO_PAPER.map((d) => new Path2D(d))
    /** ช่องกลางตัว E เก็บเป็นพาธด้วย เพราะต้องลากเส้นขอบมันเหมือนชิ้นอื่น */
    const counterPath = (() => {
      const q = new Path2D()
      q.roundRect(LOGO_COUNTER.x, LOGO_COUNTER.y, LOGO_COUNTER.w, LOGO_COUNTER.h, LOGO_COUNTER.r)
      return q
    })()

    /**
     * แสตมป์โลโก้ลงตารางช่อง แล้วอ่านกลับมาเป็นสี่สนาม
     *
     * แถบไม่ได้เป็นวงลากเส้นอีกแล้ว — มันคือ "การกวาด" ที่ค่อย ๆ เผยตัวโลโก้ J O E จาก
     * ซ้ายไปขวา หัวกวาดอยู่ตรงขอบขวาของส่วนที่เผยแล้ว (J ก่อน แล้ว O แล้ว E ตามลำดับ
     * ที่ตัวอักษรวางอยู่ในโลโก้พอดี)
     */
    const stampLogo = (
      build: number,
      spin: number,
      sweep: number,
      solid: number,
      shatter: number,
    ) => {
      if (!octx || !bctx || !hctx || !tctx) return

      off.width = cols
      off.height = rows
      blur.width = cols
      blur.height = rows
      hi.width = cols
      hi.height = rows
      hot.width = cols
      hot.height = rows

      // ให้โลโก้กว้างราว 58% ของจอ และไม่สูงเกิน 42% ของความสูง
      const sc =
        Math.min(
          (cols * 0.58) / (LOGO_X1 - LOGO_X0),
          ((rows * 0.42) * (CELL_H / CELL_W)) / LOGO_H,
        ) * (1 - shatter * 0.62)
      /** ส่ายเบา ๆ แล้วกลับมาแบนราบพอดีตอน spin = 2π */
      const wob = Math.sin(spin) * 0.30

      /** วางระบบพิกัด viewBox ของโลโก้ลงบนตารางช่อง */
      const setT = (c: CanvasRenderingContext2D) => {
        c.setTransform(1, 0, 0, 1, 0, 0)
        c.clearRect(0, 0, cols, rows)
        c.translate(cols / 2, rows / 2)
        c.rotate(wob * 0.26)
        c.scale(sc * Math.cos(wob), sc * (CELL_W / CELL_H))
        c.translate(-LOGO_CX, -LOGO_CY)
        c.globalCompositeOperation = 'source-over'
        c.globalAlpha = 1
        c.fillStyle = '#fff'
      }

      /**
       * วาดโลโก้
       *
       * ตอน solid ยังต่ำ วาดแค่ "เส้นขอบ" ของทุกชิ้น — ได้แถบลากตามรูปตัวอักษรซึ่งเป็น
       * หน้าตาแบบเดียวกับริบบิ้นในคลิป (แถบแคบ ๆ มีพื้นดำอยู่ข้างใน) พอ solid ขึ้นถึงค่อย
       * ถมเนื้อในจนกลายเป็นโลโก้ทึบ
       *
       * ถ้าถมเนื้อในตั้งแต่ต้นจะได้ตัวอักษรตันทั้งตัวตั้งแต่วินาทีแรก ซึ่งไม่มีจังหวะ
       * "กำลังลากเส้น" ให้เห็นเลย
       */
      const b = Math.max(0, Math.min(1, build))
      /** ความคืบหน้าของชิ้นหนึ่ง จากตารางจังหวะ */
      const at = ([t0, t1]: readonly [number, number]) =>
        Math.min(1, Math.max(0, (b - t0) / (t1 - t0)))
      /** ease แบบเดียวกับที่สปแลชใช้เป็นส่วนใหญ่ */
      const io = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2)
      const out2 = (u: number) => 1 - (1 - u) * (1 - u)
      const mix = (from: number, to: number, u: number) => from + (to - from) * u

      /**
       * ชิ้นส่วนของโลโก้ พร้อมท่าเข้าของแต่ละชิ้น — ยกมาจากไทม์ไลน์ประกอบร่างของสปแลช
       *
       * เดิมใช้ "แถบกวาดผ่าน" ตัวเดียวเผยทั้งโลโก้ ซึ่งไม่มีการประกอบชิ้นส่วนให้เห็นเลย
       * ตอนนี้แต่ละชิ้นมีท่าของตัวเอง: E เปิดออกด้วย clip ที่กว้างขึ้น, ช่องกลางกับเดือย
       * หน้ายืดจากศูนย์, O เป็นจุดกลมวิ่งเข้ามาแล้วแตกเป็นสี่กลีบพร้อมหมุน, J ตัวถัง
       * ไหลลงมาจากบน แล้วบากมุมกับลิ้นค่อยขยายตาม
       *
       * ทุกชิ้นคืน "ความคืบหน้า" ของตัวเองด้วย เพื่อให้รู้ว่าชิ้นไหนกำลังเคลื่อนอยู่
       * (ชิ้นที่กำลังเคลื่อนคือชิ้นที่ร้อน — ดูมาสก์ hot)
       */
      type Part = {
        /** ความคืบหน้าของท่าเข้าของชิ้นนี้ 0-1 */
        p: number
        /** เนื้อในของชิ้นนี้ถมไปแล้วแค่ไหน 0-1 */
        fill: number
        draw: (c: CanvasRenderingContext2D, st: boolean) => void
      }
      const parts: Part[] = []
      /**
       * เนื้อในของแต่ละชิ้นถมตามท่าเข้าของชิ้นนั้นเอง ไม่ใช่รอ solid ตัวเดียวถมพร้อมกันหมด
       *
       * เริ่มถมตอนชิ้นนั้นเดินทางไปได้ราวครึ่งทาง แล้วเต็มพอดีตอนเข้าที่ — ชิ้นที่ออกตัวก่อน
       * จึงติดสีก่อน ได้จังหวะ "ประกอบไปติดสีไป" แบบเหลื่อมกัน ไม่ใช่พร้อมกันเป๊ะ
       * ส่วน solid เป็นตัวเก็บกวาดตอนท้าย (และเป็นตัวหรี่เส้นขอบกับคอนทัวร์)
       */
      const fillOf = (u: number) => {
        const v = Math.min(1, Math.max(0, (u - 0.45) / 0.55))
        return Math.max(io(v), Math.min(1, solid))
      }
      /** เติมหรือลากเส้น ตามโหมดที่ส่งเข้ามา */
      const F = (c: CanvasRenderingContext2D, st: boolean, path?: Path2D) => {
        if (st) {
          if (path) c.stroke(path)
          else c.stroke()
        } else if (path) {
          c.fill(path)
        } else {
          c.fill()
        }
      }

      // ── E ─────────────────────────────────────────────
      {
        const wU = out2(at(PART.eClipW))
        const xU = io(at(PART.eClipX))
        const clipX = mix(174, 162, xU)
        const clipW = mix(4, 77, wU) + (174 - clipX)
        const front = io(at(PART.eFront))
        parts.push({
          p: at(PART.eClipW),
          fill: fillOf(at(PART.eClipW)),
          draw: (c, st) => {
            c.save()
            c.beginPath()
            c.rect(clipX, 0, clipW, 84)
            c.clip()
            F(c, st, inkPaths[1])
            // เดือยหน้า: ยืดจากขอบขวา
            c.save()
            c.translate(232, 24.5)
            c.scale(Math.max(0.001, front), 1)
            c.translate(-232, -24.5)
            F(c, st, inkPaths[2])
            c.restore()
            c.restore()
          },
        })
      }

      // ── O ─────────────────────────────────────────────
      {
        const bu = out2(at(PART.oBullet))
        const sp = io(at(PART.oSpread))
        const rt = io(at(PART.oRotate))
        if (at(PART.oBullet) > 0 && at(PART.oSpread) < 1) {
          // จุดกลมนำ — โตขึ้นแล้วจางไปตอนกลีบแยกออก
          const r = mix(1, 20, bu) * (1 - sp)
          if (r > 0.4) {
            parts.push({
              p: at(PART.oBullet),
              fill: fillOf(at(PART.oBullet)),
              draw: (c, st) => {
                c.beginPath()
                c.ellipse(O_CENTRE.x, O_CENTRE.y, r, r, 0, 0, Math.PI * 2)
                F(c, st)
              },
            })
          }
        }
        if (at(PART.oSpread) > 0) {
          for (const pe of LOGO_PETALS) {
            const cxp = mix(O_CENTRE.x, pe.cx, sp)
            const cyp = mix(O_CENTRE.y, pe.cy, sp)
            const rot = (pe.rot * rt * Math.PI) / 180
            parts.push({
              p: at(PART.oSpread),
              fill: fillOf(at(PART.oSpread)),
              draw: (c, st) => {
                c.beginPath()
                c.ellipse(cxp, cyp, pe.rx, pe.ry, rot, 0, Math.PI * 2)
                F(c, st)
              },
            })
          }
        }
      }

      // ── J ─────────────────────────────────────────────
      {
        const bodyU = io(at(PART.jBody))
        const dy = mix(-100, 0, bodyU)
        if (at(PART.jBody) > 0) {
          parts.push({
            p: at(PART.jBody),
            fill: fillOf(at(PART.jBody)),
            draw: (c, st) => {
              c.save()
              c.translate(0, dy)
              F(c, st, inkPaths[0])
              c.restore()
            },
          })
        }
      }

      /** เจาะช่องว่าง — ชิ้นที่เป็น "กระดาษ" ก็มีท่าเข้าของตัวเองเหมือนกัน */
      const punch = (c: CanvasRenderingContext2D) => {
        c.globalAlpha = 1
        c.globalCompositeOperation = 'destination-out'
        // E: ช่องกลางยืดจากซ้าย, ช่องเปิดล่างไถลเข้ามาจากขวา
        const cu = io(at(PART.eCounter))
        if (cu > 0) {
          c.save()
          c.translate(185, 26)
          c.scale(Math.max(0.001, cu), 1)
          c.translate(-185, -26)
          c.fill(counterPath)
          c.restore()
        }
        c.save()
        c.translate(mix(60, 0, io(at(PART.eOpening))), 0)
        c.fill(paperPaths[2])
        c.restore()
        // J: ลิ้นกับบากมุมขยายจากศูนย์ ตามตัวถังที่ไหลลงมา
        const dyJ = mix(-100, 0, io(at(PART.jBody)))
        const co = io(at(PART.jCorner))
        const mk = io(at(PART.jMask))
        c.save()
        c.translate(0, dyJ)
        if (co > 0) {
          c.save()
          c.scale(co, co)
          c.fill(paperPaths[1])
          c.restore()
        }
        if (mk > 0) {
          c.save()
          c.translate(34, 31)
          c.scale(mk, mk)
          c.translate(-34, -31)
          c.fill(paperPaths[0])
          c.restore()
        }
        c.restore()
        c.globalCompositeOperation = 'source-over'
      }

      /**
       * วาดโลโก้
       *
       * ตอน solid ยังต่ำ วาดแค่ "เส้นขอบ" ของทุกชิ้น — ได้แถบลากตามรูปตัวอักษรซึ่งเป็น
       * หน้าตาแบบเดียวกับริบบิ้นในคลิป พอ solid ขึ้นถึงค่อยถมเนื้อในจนกลายเป็นโลโก้ทึบ
       */
      /**
       * วาดโลโก้
       *
       * mode 'full'  = เส้นขอบ (มีตลอด) + เนื้อในที่ถมตามจังหวะของแต่ละชิ้น แล้วเจาะช่องว่าง
       * mode 'hot'   = เฉพาะ "เนื้อในที่ถมแล้ว" ของแต่ละชิ้น ใช้เป็นมาสก์ที่ดันช่องนั้นข้าม
       *                ไปเป็นบล็อกทึบ ชิ้นที่ถมก่อนจึงติดสีก่อน ที่เหลือยังเป็นตัวอักษรอยู่
       *
       * เคยผูกมาสก์นี้กับ "ชิ้นที่กำลังเคลื่อน" ซึ่งผิด: พอทุกชิ้นเข้าที่แล้วมาสก์กลับว่าง
       * ทั้งโลโก้เลยค้างเป็นตัวอักษรจนกว่า solid จะมา ไม่มีการติดสีระหว่างประกอบร่างเลย
       */
      const paintLogo = (c: CanvasRenderingContext2D, mode: 'full' | 'hot') => {
        for (const q of parts) {
          if (q.fill <= 0.001) continue
          c.globalAlpha = q.fill
          q.draw(c, false)
        }
        if (mode === 'hot') {
          c.globalAlpha = 1
          return
        }
        // เส้นขอบมีตลอด — เป็นตัวที่ทำให้เห็นรูปตั้งแต่ชิ้นยังไม่ติดสี
        c.globalAlpha = 1
        c.lineWidth = 10
        c.lineJoin = 'round'
        c.strokeStyle = '#fff'
        for (const q of parts) q.draw(c, true)
        punch(c)
      }

      setT(octx)
      paintLogo(octx, 'full')

      /**
       * คอนทัวร์รอบตัวโลโก้ = สำเนาที่เบลอของตัวทึบ
       *
       * ค่าที่ฟุ้งออกไปตกกลางบันได จึงถูกเรนเดอร์เป็น # @ $ ! ; : < + = ไล่ออกไปเป็นวง ๆ
       * รัศมีใหญ่ตอนต้น (หัวยังเป็นก้อนนุ่ม) แล้วหดลงเมื่อกวาดไปเรื่อย ๆ และเมื่อ solid ขึ้น
       */
      const radius =
        (1.1 + 2.9 * (1 - solid)) * (1 + 0.5 * (1 - Math.min(1, b * 1.4)))
      bctx.setTransform(1, 0, 0, 1, 0, 0)
      bctx.clearRect(0, 0, cols, rows)
      bctx.filter = radius > 0.05 ? `blur(${radius.toFixed(2)}px)` : 'none'
      bctx.drawImage(off, 0, 0)
      bctx.filter = 'none'

      /**
       * หย่อมทึบเกาะอยู่กับหัวกวาดเท่านั้น
       *
       * ห้ามเติมเต็มจอตอนกวาดครบ — ถ้าทำแบบนั้นทั้งโลโก้จะกลายเป็นบล็อกทึบทันทีที่หัว
       * ถึงขอบ แล้วช่วงที่รูปยังเป็น "ตัวอักษร ASCII" (ซึ่งเป็นหน้าตาหลักของเอฟเฟกต์นี้)
       * จะหายไปทั้งช่วง หน้าที่เปลี่ยนเป็นทึบเป็นของ solid ไม่ใช่ของ build
       */
      // ชิ้นที่ถมเนื้อในแล้วคือชิ้นที่ร้อน — ติดสีทีละชิ้นตามจังหวะของตัวเอง
      setT(tctx)
      paintLogo(tctx, 'hot')

      /** อ่านทั้งสี่แคนวาสกลับมาเป็นค่าต่อช่อง */
      const readBack = () => {
        const fd = octx.getImageData(0, 0, cols, rows).data
        const bd = bctx.getImageData(0, 0, cols, rows).data
        const hd = hctx.getImageData(0, 0, cols, rows).data
        const td = tctx.getImageData(0, 0, cols, rows).data
        for (let n = 0; n < cols * rows; n++) {
          cov[n] = fd[n * 4 + 3] / 255
          hal[n] = bd[n * 4 + 3] / 255
          spc[n] = hd[n * 4 + 3] / 255
          hotm[n] = td[n * 4 + 3] / 255
        }
      }

      hctx.setTransform(1, 0, 0, 1, 0, 0)
      hctx.clearRect(0, 0, cols, rows)
      // ปื้นขาวเพิ่งโผล่ที่ f150 — ก่อนหน้านั้น sweep ยังติดลบ แปลว่ายังไม่ถึงคิวของมัน
      if (sweep < 0) return readBack()

      /**
       * ไฮไลต์: ปื้นขาวไล่เฉดกว้าง ๆ พาดจากซ้ายไปขวา แล้วตัดให้เหลือเฉพาะที่ทับตัวโลโก้
       * ไม่ใช่แถบคม จึงใช้เกรเดียนต์สามสต็อป
       */
      setT(hctx)
      const bandX = LOGO_X1 + 90 - sweep * (LOGO_X1 - LOGO_X0 + 180)
      const grad = hctx.createLinearGradient(bandX - 78, 0, bandX + 78, 0)
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(0.5, '#ffffff')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      hctx.fillStyle = grad
      hctx.fillRect(-400, -400, 1200, 900)
      hctx.setTransform(1, 0, 0, 1, 0, 0)
      hctx.globalCompositeOperation = 'destination-in'
      hctx.drawImage(off, 0, 0)
      hctx.globalCompositeOperation = 'source-over'

      readBack()
    }

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      // ไม่คูณ devicePixelRatio: อักขระเล็กและจาง จอ retina ไม่ได้ทำให้ดูดีขึ้น
      // แต่จำนวนพิกเซลที่ต้องวาดเพิ่มสี่เท่า
      canvas.width = Math.max(1, Math.floor(r.width))
      canvas.height = Math.max(1, Math.floor(r.height))
      cols = Math.ceil(canvas.width / CELL_W)
      rows = Math.ceil(canvas.height / CELL_H)
      const n = cols * rows
      cov = new Float32Array(n)
      hal = new Float32Array(n)
      spc = new Float32Array(n)
      hotm = new Float32Array(n)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      mouse.x = (e.clientX - r.left) / CELL_W
      mouse.y = (e.clientY - r.top) / CELL_H
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      // จอเทอร์มินัลจริงไม่ได้รีเฟรช 60 ครั้งต่อวินาที — 24 พอ และถูกกว่าครึ่ง
      if (now - last < 42) return
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0
      last = now
      t += dt

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const { gain, solid, build, ink, guide, spin, sweep, shatter } = drive.current
      if (gain <= 0.01 && ink <= 0.01) return

      const showRib = ink > 0.01 && build > 0.001
      if (showRib) stampLogo(build, spin, sweep, solid, shatter)

      ctx.font = `${CELL_H - 3}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textBaseline = 'top'

      const top = RAMP.length
      /** แกนเกาะร้อนขึ้นตาม guide — ไต่จากชั้นฟ้าขึ้นไปแตะชั้นคราม แต่ไม่ถึงชั้นส้ม */
      const terrTop = 0.56 + guide * 0.26
      /**
       * ริบบิ้นไต่บันไดเร็วกว่าเชิงเส้น — ในคลิปพอบล็อกส้มโผล่ (f084) มันกลายเป็นแถบทึบ
       * ภายในไม่กี่เฟรม ถ้าใช้ ink ตรง ๆ ครึ่งทางของช่วงจะยังค้างอยู่แถวชั้นฟ้าซึ่งผิด
       */
      const heat = Math.pow(Math.max(0, ink), 0.35)

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x

          /* ── ริบบิ้น: แกนทึบ + คอนทัวร์รอบ ๆ รวมเป็นค่าเดียว ── */
          let level = 0
          if (showRib) {
            const r = Math.min(1.25, cov[idx] + hal[idx] * 0.8)
            /**
             * ส่วนที่กวาดผ่านแล้วอยู่ที่ชั้น @ / # (เป็น "ตัวอักษรสีส้ม") ยังไม่ใช่บล็อกทึบ
             * มีสองอย่างเท่านั้นที่ดันให้ข้ามไปเป็นบล็อก: หย่อมที่เกาะหัวกวาด กับ solid
             */
            level = r * heat * (0.70 + 0.24 * hotm[idx] + 0.28 * solid)
            // ท่าปิด (f189): หั่นเป็นขีดนอนยาวราวเจ็ดช่อง เว้นช่องเป็นจังหวะ
            if (shatter > 0.001 && hash(Math.floor(x / 7) * 3.3, y * 1.9) < shatter * 1.12) {
              level = 0
            }
          }

          /* ── ภูมิประเทศ: ก้อน noise ลอยเข้ามาจากขอบจอ คอนทัวร์ซ้อนชั้น ──
             ความถี่แกนตั้งสูงกว่าแกนนอนราวห้าเท่า ก้อนที่ได้จึงกว้างกว่าสูง และคอนทัวร์
             อ่านเป็นริ้วนอน เหมือนเกาะในเฟรม f052-f108 */
          let bg = noise(x * 0.042 + t * 0.05, y * 0.19 - x * 0.05) * 0.60
          bg += noise(x * 0.09 - t * 0.028, y * 0.40 - x * 0.07) * 0.28
          bg += noise(x * 0.24, y * 0.95) * 0.12

          const mdx = x - mouse.x
          const mdy = y - mouse.y
          const md2 = mdx * mdx + mdy * mdy
          if (md2 < 400) bg += 0.28 * Math.exp(-md2 / 90)
          /**
           * ตัดให้เหลือแต่ยอด — ในคลิปพื้นจอเป็นดำโล่งเกือบทั้งจอ เกาะเป็นหย่อมบาง ๆ
           * และ guide ต้องดันเฉพาะ "แกน" ของเกาะ ไม่ใช่ยกทั้งผืน ไม่งั้นจะได้จุดครามเต็มจอ
           * ซึ่งเป็นสิ่งที่ทำให้ภาพรวมดูไม่เหมือนคลิปมากที่สุด
           */
          bg = (bg - 0.62) * 2.6 * gain
          if (bg > 0) bg *= terrTop
          if (bg > level) level = bg

          if (level <= 0.03) continue

          /* ── ลงสีตามบันไดเดียว ── */
          if (level >= 1) {
            // บล็อกทึบ — ปื้นไฮไลต์ทำได้แค่เปลี่ยนสีของบล็อก ไม่ได้วาดทับเป็นชิ้นใหม่
            const sp = spc[idx]
            ctx.fillStyle =
              sp <= 0.12 ? INK : SPEC[Math.min(SPEC.length - 1, Math.floor((sp - 0.12) * 8))]
            ctx.fillRect(x * CELL_W, y * CELL_H, CELL_W + 0.5, CELL_H + 0.5)
            // ลายเฉดบนเนื้อแถบ (f156-f175) — โปรยบาง ๆ เฉพาะฝั่งที่ยังไม่ขาวจัด
            const g = hash(x * 3.1, y * 5.7)
            if (g < 0.10 && sp < 0.7) {
              ctx.fillStyle = `rgba(255,238,226,${(0.22 + sp * 0.3).toFixed(2)})`
              ctx.fillText(GRAIN[Math.floor(g * 100) % GRAIN.length], x * CELL_W, y * CELL_H)
            }
            continue
          }

          const step = Math.min(top - 1, Math.floor(level * top))
          ctx.fillStyle = RAMP_TINT[step]
          ctx.fillText(RAMP[step], x * CELL_W, y * CELL_H)
        }
      }
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
    }
  }, [drive])

  return <canvas ref={ref} className={className} style={style} />
}

/** ให้ไทม์ไลน์ข้างนอกใช้ค่าเดียวกับที่โมดูลนี้ใช้ตัดสินจังหวะ */
export { span as introSpan }
