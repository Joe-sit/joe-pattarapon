import { useEffect, useRef } from 'react'
import type { CSSProperties, MutableRefObject } from 'react'

/**
 * สนามอักขระของอินโทร — ทั้งภูมิประเทศพื้นหลังและตัวออบเจกต์อยู่ในแคนวาสใบเดียว
 *
 * ไล่เฟรมในโฟลเดอร์ intro-frame ทีละใบแล้วได้ความจริงสองข้อ
 *
 *   1. พื้นหลังเป็นภูมิประเทศ ASCII โทนฟ้า-น้ำเงินล้วน เป็นริ้วนอนยาว ๆ ซ้อนเป็นแนวเฉียง
 *      ไม่ใช่จุดกระจายทั้งจอ และไม่มีสีส้มปนเลย (f055-f100)
 *   2. ของสีส้มทั้งคลิปคือ "เส้นเดียว" — ริบบิ้นสามมิติที่หมุนอยู่ ท่าที่เห็นทั้งหมด
 *      (เลขแปด ห่วงไขว้ แท่งตั้งตอนมองด้านข้าง ห่วงกลมตอนจบ) คือปมเดียวกันคนละมุมมอง
 *
 * ริบบิ้นถูกวาดสามระยะต่อเนื่อง ใช้เรขาคณิตชุดเดียวกันหมด ต่างกันแค่วิธีลงสีในช่อง
 * จึงไม่มีรอยต่อให้เห็น: หัวปากกาไล่ลากไปตามเส้น (f073-f113) → ส่วนที่ลากแล้วเป็นอักขระ
 * สีส้ม → ถมทีละช่องจนกลายเป็นบล็อกทึบ (f114-f130) แล้วหมุนต่อไปจนจบ (f131-f189)
 */

/** ไล่ความเข้มของอักขระจากจางไปเข้ม */
const RAMP = ' .:-=+*#%@'
/** ขนาดช่องหนึ่งช่อง หน่วยพิกเซล — ฟอนต์ mono กว้างราว 0.6 ของความสูง */
const CELL_W = 11
const CELL_H = 16

/** จานสีของภูมิประเทศ ไล่จากน้ำเงินเข้มไปฟ้าสว่าง ตามคลิปที่พื้นหลังเป็นโทนเย็นล้วน */
const TINTS = ['#12202f', '#173047', '#1d4260', '#23557a', '#2a6a97', '#3480b4', '#57a3d4']
/** ค่าสูงสุดที่ใช้หารก่อนแปลงเป็นดัชนีจาน */
const V_MAX = 1.35

/** สีตัวริบบิ้น และไล่ขอบตอนยังเป็นอักขระ */
const INK = '#E5956F'
const INK_EDGE = ['#4a3128', '#7a4b38', '#b06a48', '#d2895f', INK]
/** ไฮไลต์ที่กวาดไปตามตัวริบบิ้น — ในคลิป (f154-f181) เป็นแถบขาวจ้าเลื่อนไปเรื่อย ๆ */
const SPEC = ['#efa583', '#f6bfa4', '#fbdac9', '#ffffff']

/**
 * จานสีของคลื่นนำสายตา — คราม/น้ำเงินสด เข้มกว่าภูมิประเทศชัดเจน
 * ในคลิป (f078-f100) ก้อนนำเป็นกลุ่มอักขระ $ 0 0 0 1 สีครามที่ทึบกว่าพื้นรอบ ๆ มาก
 */
const GUIDE_TINTS = ['#1b2a52', '#26379b', '#3b3bd0', '#5b5bf0']

/** จำนวนจุดที่สุ่มบนเส้นรอบรูป ยิ่งเยอะเส้นยิ่งเนียนแต่แสตมป์ต่อเฟรมก็เยอะตาม */
const SAMPLES = 340

/**
 * เวิร์ดมาร์ก JOE ในพิกัดของตัวเอง (กรอบ 239x84) ถอดจาก path ชุดเดียวกับสปแลชของเว็บ
 *
 * เก็บเส้นรอบรูปเป็นชุดจุด ไม่ใช่ path string เพราะต้องใช้สองอย่างพร้อมกัน — เดินไปตาม
 * เส้นเพื่อทำหัวปากกา และเติมข้างในตอนถมทึบ
 *
 * ลำดับใน SUBPATHS คือลำดับที่ปากกาลาก: E ก่อน แล้ว O ทีละกลีบ แล้วจบที่ J
 */
const E_OUTLINE = [
  [174, 2],
  [232, 2],
  [232, 81],
  [174, 81],
  [174, 65],
  [162, 65],
  [162, 18],
  [174, 18],
]
/** แถบหน้าของ E (บวกเข้าไป) กับช่องในตัวสองช่อง (เจาะออก) — ขาดสองช่องนี้มันไม่ใช่ E */
const E_TAB = [231, 10, 8, 29]
const E_COUNTER = [185, 18, 35, 16]
const E_MOUTH = [185, 49, 54, 16]

/** กลีบทั้งสี่ของ O — วงรีเอียง ไม่ใช่วงกลม */
const O_PETALS = [
  { cx: 117.717, cy: 62.9484, rx: 15.1684, ry: 18.4624, rot: 59.365 },
  { cx: 126.342, cy: 20.4592, rx: 15.1684, ry: 18.4624, rot: 59.365 },
  { cx: 99.732, cy: 41.2846, rx: 14.1752, ry: 19.4078, rot: 28.5804 },
  { cx: 144.851, cy: 41.4516, rx: 14.1752, ry: 19.4078, rot: 28.5804 },
]

/** ตัวถังของ J: สี่เหลี่ยมด้านบนต่อด้วยครึ่งวงกลมด้านล่าง */
const J_TOP = 0
const J_W = 81
const J_STRAIGHT = 43.5
const J_R = 40.5
/** ช่องเจาะกลางตัว J */
const J_NOTCH = [33, 30, 16, 25]

/**
 * จุดบนวงรีเอียงหนึ่งกลีบ ในท่าที่ประกอบไปแล้ว oP (0 = กองอยู่กลางตัว O, 1 = เข้าที่)
 *
 * ท่านี้ยกมาจากสปแลชเดิมของเว็บตรง ๆ: กลีบแตกออกจากจุดกลางพร้อมหมุนและโตขึ้น
 */
function petalPoints(p: (typeof O_PETALS)[number], oP: number, n = 26) {
  const a = ((p.rot * oP * Math.PI) / 180) + (p.rot * Math.PI) / 180
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const cx = 122 + (p.cx - 122) * oP
  const cy = 42 + (p.cy - 42) * oP
  const k = 0.35 + 0.65 * oP
  return Array.from({ length: n }, (_, i) => {
    const th = (i / n) * Math.PI * 2
    const ex = Math.cos(th) * p.rx * k
    const ey = Math.sin(th) * p.ry * k
    return [cx + ex * ca - ey * sa, cy + ex * sa + ey * ca]
  })
}

/** เส้นรอบรูปของ J: ตรงลงมาสองข้างแล้วโค้งครึ่งวงกลมที่ก้น */
function jPoints() {
  const pts: number[][] = [
    [0, J_TOP],
    [J_W, J_TOP],
    [J_W, J_STRAIGHT],
  ]
  for (let k = 0; k <= 20; k++) {
    const th = (k / 20) * Math.PI
    pts.push([J_R + Math.cos(th) * J_R, J_STRAIGHT + Math.sin(th) * J_R])
  }
  pts.push([0, J_STRAIGHT])
  return pts
}

/** ส่วนของช่วง ตัดหัวท้ายให้อยู่ใน 0-1 */
const span = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)))
/** ease-out ชุดเดียวกับที่สปแลชเดิมใช้กับท่าเข้าที่ */
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)

/**
 * เส้นที่ปากกาต้องลาก ในท่าประกอบร่าง build (0 = ยังไม่ประกอบ, 1 = ครบคำ)
 *
 * ท่าเดียวกับสปแลชเดิมของเว็บทุกจังหวะ — E เผยออกจากเสี้ยวซ้ายสุด, กลีบ O แตกจากจุด
 * กลางพร้อมหมุน, J หล่นลงมาจากบน แล้วทั้งคำไถลเข้าที่จากทางซ้าย
 */
function markPaths(build: number): { pts: number[][]; on: number }[] {
  const slide = -80 * (1 - easeOut(span(build, 0, 1)))
  const eP = easeOut(span(build, 0, 0.34))
  const jP = easeOut(span(build, 0.45, 0.82))
  const shift = (pts: number[][], dx: number, dy: number) => pts.map(([x, y]) => [x + dx, y + dy])
  return [
    // E เผยจากเสี้ยว x 174..178 ออกไปทางขวา
    {
      pts: shift(
        E_OUTLINE.map(([x, y]) => [174 + (x - 174) * eP, y]),
        slide,
        0,
      ),
      on: eP,
    },
    // กลีบ O แตกจากจุดกลางทีละกลีบ ไม่ใช่พร้อมกันทั้งสี่ — จะได้อ่านออกว่ากำลังประกอบ
    ...O_PETALS.map((p, i) => {
      const oP = easeOut(span(build, 0.3 + i * 0.055, 0.66 + i * 0.055))
      return { pts: shift(petalPoints(p, oP), slide, 0), on: oP }
    }),
    { pts: shift(jPoints(), slide, -100 * (1 - jP)), on: jP },
  ]
}

/** กลางกรอบเวิร์ดมาร์ก ใช้จัดให้อยู่กลางจอ */
const MARK_CX = 119.5
const MARK_CY = 42
const MARK_W = 239
const MARK_H = 84

/** ค่าที่อินโทรป้อนเข้ามาทุกเฟรม — อ่านผ่าน ref ไม่ให้ React รีเรนเดอร์ 24 ครั้งต่อวินาที */
export type AsciiDrive = {
  /** ความสว่างรวมของภูมิประเทศ 0-1 */
  gain: number
  /** ส่วนที่ลากแล้วกลายเป็นบล็อกทึบไปแล้วแค่ไหน 0-1 */
  solid: number
  /** ท่าประกอบร่างของเวิร์ดมาร์ก 0-1 (ท่าเดียวกับสปแลชเดิมของเว็บ) */
  build: number
  /** ตัวอักษรทึบแค่ไหนโดยรวม 0-1 ใช้ตอนเปิดตัวและตอนปิดฉาก */
  ink: number
  /**
   * คลื่นนำสายตา 0-1
   *
   * ริ้วอักขระบาง ๆ ที่ลอยเข้ามาจากมุมบนซ้าย ไหลไปทางขวา หนาขึ้นเรื่อย ๆ แล้วช่วงท้าย
   * ก็ค่อย ๆ ทาบตัวลงบนแนวของริบบิ้นพอดี — เป็นตัวบอกล่วงหน้าว่าเส้นจะไปโผล่ตรงไหน
   * ไม่ใช่ของอีกชิ้นที่ลอยมาแล้วหายไปเฉย ๆ
   */
  guide: number
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

    /** ไฮไลต์ในช่องนี้ 0-1 */
    let spc = new Float32Array(0)
    /** ข้างในตัวอักษร (ไม่ใช่เส้นรอบรูป) กินช่องนี้แค่ไหน 0-1 */
    let fil = new Float32Array(0)
    /** เส้นขอบของชิ้นส่วนที่กำลังประกอบ กินช่องนี้แค่ไหน 0-1 */
    let cov = new Float32Array(0)
    /** แกนสีส้มของคลื่นนำกินช่องนี้แค่ไหน 0-1 */
    let gco = new Float32Array(0)
    /** กลุ่มอักขระครามที่ห่อแกนไว้ กินช่องนี้แค่ไหน 0-1 */
    let gha = new Float32Array(0)

    /** จุดของริบบิ้นที่ฉายลงระนาบจอแล้ว คำนวณรอบเดียวต่อเฟรม ใช้ทั้งตัวริบบิ้นและคลื่นนำ */
    const kx = new Float32Array(SAMPLES + 1)
    const ky = new Float32Array(SAMPLES + 1)
    const kz = new Float32Array(SAMPLES + 1)

    /** แคนวาสนอกจอขนาดเท่าตาราง ใช้แรสเตอร์ข้างในตัวอักษร */
    const off = document.createElement('canvas')
    const octx = off.getContext('2d', { willReadFrequently: true })

    let raf = 0
    let last = 0
    let t = 0

    /** สัดส่วนของช่วง ตัดหัวท้ายให้อยู่ใน 0-1 */
    const at = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)))

    /**
     * แสตมป์ตัว E ลงตารางช่อง
     *
     * เดินไปตามเส้นรอบรูปแล้วปั๊มวงเล็ก ๆ ลงตาราง เก็บตำแหน่งบนเส้น (par) ไว้ด้วย หัวปากกา
     * จึงรู้ว่าลากถึงไหนแล้ว ส่วนข้างในตัวอักษรแรสเตอร์แยกลงแคนวาสนอกจอ เพราะมันโผล่
     * ตอนถมทึบเท่านั้น ไม่ได้โผล่ตอนลากเส้น
     */
    const stampMark = (build: number) => {
      spc.fill(0)
      fil.fill(0)
      cov.fill(0)

      const scale = Math.min((cols * 0.46) / MARK_W, (((rows * CELL_H) / CELL_W) * 0.5) / MARK_H)
      const cx = cols / 2
      const cy = rows / 2
      const paths = markPaths(build)
      const project = (mx: number, my: number): [number, number] => [
        cx + (mx - MARK_CX) * scale,
        cy + (my - MARK_CY) * scale * (CELL_W / CELL_H),
      ]

      // ── ข้างในตัวอักษร: แรสเตอร์ทั้งเวิร์ดมาร์กลงแคนวาสขนาดเท่าตาราง ──
      if (octx) {
        off.width = cols
        off.height = rows
        octx.setTransform(1, 0, 0, 1, 0, 0)
        octx.clearRect(0, 0, cols, rows)
        octx.fillStyle = '#fff'

        /** ปิดรูปหลายเหลี่ยมชุดหนึ่งแล้วถม */
        const fillPoly = (pts: number[][]) => {
          octx.beginPath()
          pts.forEach(([mx, my], n) => {
            const [px, py] = project(mx, my)
            if (n === 0) octx.moveTo(px, py)
            else octx.lineTo(px, py)
          })
          octx.closePath()
          octx.fill()
        }
        /** ช่วยวาดสี่เหลี่ยมในพิกัดเวิร์ดมาร์กให้ออกมาเป็นพิกัดตาราง */
        const markRect = (r: number[]) => {
          const [x0, y0] = project(r[0], r[1])
          const [x1, y1] = project(r[0] + r[2], r[1] + r[3])
          octx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
        }

        // ชิ้นที่ยังไม่ถึงคิวไม่ต้องถม ไม่งั้นมีก้อนโผล่กลางตัว O ตั้งแต่ยังไม่เริ่ม
        for (const sp of paths) if (sp.on > 0.001) fillPoly(sp.pts)
        // แถบหน้าของ E โผล่ช่วงกลางของท่าประกอบ
        const tabP = easeOut(span(build, 0.3, 0.5))
        if (tabP > 0) markRect([E_TAB[0], E_TAB[1], E_TAB[2] * tabP, E_TAB[3]])
        // เจาะช่องในตัวอักษร ไม่ใช่ทาสีพื้นทับ — ที่นี่ไม่มี "สีพื้น" ให้ทา
        octx.globalCompositeOperation = 'destination-out'
        // ช่องในตัวอักษรถูกเจาะทีหลัง เหมือนสปแลชเดิมที่ช่องเปิดตอนตัวเข้าที่แล้ว
        const eCut = easeOut(span(build, 0.4, 0.66))
        if (eCut > 0) {
          markRect([E_COUNTER[0], E_COUNTER[1], E_COUNTER[2] * eCut, E_COUNTER[3]])
          markRect([E_MOUTH[0], E_MOUTH[1], E_MOUTH[2] * eCut, E_MOUTH[3]])
        }
        const jCut = easeOut(span(build, 0.72, 1))
        if (jCut > 0) markRect([J_NOTCH[0], J_NOTCH[1], J_NOTCH[2], J_NOTCH[3] * jCut])
        octx.globalCompositeOperation = 'source-over'

        const data = octx.getImageData(0, 0, cols, rows).data
        for (let n = 0; n < cols * rows; n++) fil[n] = data[n * 4 + 3] / 255
      }

      /**
       * ── จุดปลายทางของคลื่นนำสายตา ──
       *
       * ไม่ได้ลากเส้นรอบรูปแล้ว แต่ยังต้องรู้ว่ารูปอยู่ตรงไหนเพื่อให้คลื่นนำเล็งถูก
       * เดินตามความยาวจริงของแต่ละเส้นย่อย จุดจึงกระจายสม่ำเสมอทั้งคำ
       */
      const lens: number[][] = []
      const totals: number[] = []
      let perim = 0
      for (const { pts: sp } of paths) {
        const seg: number[] = []
        let sum = 0
        for (let n = 0; n < sp.length; n++) {
          const a = sp[n]
          const b = sp[(n + 1) % sp.length]
          const d = Math.hypot(b[0] - a[0], b[1] - a[1])
          seg.push(d)
          sum += d
        }
        lens.push(seg)
        totals.push(sum)
        perim += sum
      }

      for (let i = 0; i <= SAMPLES; i++) {
        let want = (i / SAMPLES) * perim
        let k = 0
        while (k < paths.length - 1 && want > totals[k]) {
          want -= totals[k]
          k++
        }
        const sp = paths[k].pts
        const seg = lens[k]
        let n = 0
        while (n < seg.length - 1 && want > seg[n]) {
          want -= seg[n]
          n++
        }
        const a = sp[n]
        const b = sp[(n + 1) % sp.length]
        const f = seg[n] ? want / seg[n] : 0
        const [sx, sy] = project(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
        kx[i] = sx
        ky[i] = sy
        kz[i] = 0
      }

      /**
       * ── เส้นขอบของชิ้นส่วนที่กำลังประกอบ ──
       *
       * ไม่ใช่ปากกาลากรอบคำทีละนิ้ว — แต่ละชิ้น (ตัว E, กลีบ O ทีละกลีบ, ตัว J) โผล่มา
       * เป็นเส้นขอบของตัวเองทันทีที่ถึงคิวของมัน แล้วบินเข้าที่ ลำดับและท่าเดียวกับสปแลช
       * เดิมของเว็บทุกประการ ต่างกันแค่ที่นี่ชิ้นส่วนเป็นอักขระ ไม่ใช่รูปทึบ
       */
      const rx = Math.max(1.2, scale * 2.6)
      const ry = rx * (CELL_W / CELL_H)
      const rx2 = rx * rx
      for (const { pts, on } of paths) {
        if (on <= 0.001) continue
        for (let n = 0; n < pts.length; n++) {
          const a = pts[n]
          const b = pts[(n + 1) % pts.length]
          const d = Math.hypot(b[0] - a[0], b[1] - a[1])
          // ปั๊มถี่พอให้เส้นต่อกันติด ไม่ใช่เป็นจุด ๆ ห่างกัน
          const steps = Math.max(1, Math.ceil((d * scale) / 1.2))
          for (let k = 0; k < steps; k++) {
            const f = k / steps
            const [sx, sy] = project(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
            const gy0 = Math.max(0, Math.floor(sy - ry))
            const gy1 = Math.min(rows - 1, Math.ceil(sy + ry))
            const gx0 = Math.max(0, Math.floor(sx - rx))
            const gx1 = Math.min(cols - 1, Math.ceil(sx + rx))
            for (let gy = gy0; gy <= gy1; gy++) {
              const dy = ((gy - sy) * CELL_H) / CELL_W
              for (let gx = gx0; gx <= gx1; gx++) {
                const dx = gx - sx
                const d2 = dx * dx + dy * dy
                if (d2 > rx2) continue
                const idx = gy * cols + gx
                // ชิ้นที่เพิ่งโผล่สว่างกว่าชิ้นที่เข้าที่แล้ว
                const v = Math.min(1, (1.3 - Math.sqrt(d2) / rx) * (1.35 - 0.35 * on))
                if (v > cov[idx]) cov[idx] = v
              }
            }
          }
        }
      }

      /**
       * ไฮไลต์: แถบเฉียงกวาดผ่านตัวอักษร ไม่ได้คำนวณแสงจริง — ในคลิปมันคือแถบขาวนวล
       * ที่เลื่อนผ่าน ไม่ใช่เงาสมจริง
       */
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const idx = gy * cols + gx
          if (fil[idx] <= 0.4) continue
          const band = Math.max(0, Math.cos((gx + gy * 0.6) * 0.16 - t * 1.6))
          spc[idx] = Math.pow(band, 6)
        }
      }
    }

    /**
     * แสตมป์คลื่นนำสายตา — ต้องเรียกหลัง stampKnot ของเฟรมนั้นเพราะใช้จุดที่ฉายไว้แล้ว
     *
     * ไล่ f060-f113 ทีละเฟรมแล้วได้ลำดับนี้ ซึ่งไม่ใช่ริ้วเส้นเดียวลอยมาแล้วกลายเป็นเส้น
     *
     *   f072-f077  กลุ่มอักขระ "คราม" ทึบกว่าพื้นรอบ ๆ ก่อตัวบนแนวภูมิประเทศด้านบนซ้าย
     *              (อักขระ $ 0 0 0 1 ! สีน้ำเงินสด) ยังไม่มีสีส้มเลยสักจุด
     *   f078-f081  กลุ่มครามยืดออกและไถลไปทางขวา อีกกลุ่มก่อตัวที่แนวล่าง
     *   f082-f086  ขีดสีส้มสั้น ๆ โผล่ "กลาง" กลุ่มคราม ทั้งแนวบนและแนวล่าง
     *   f087-f100  ขีดส้มยืดยาวขึ้นและไถลไปทางขวา โดยกลุ่มครามยังห่อไว้ตลอด
     *   f101-f113  ปลายขีดเริ่มโค้งลง ทั้งสองแนวบิดตัวเข้าหาแนวของริบบิ้นจนครบรูป
     *
     * จึงทำเป็นสองแถบ แต่ละแถบมีแกนส้มกับกลุ่มครามห่ออยู่ เริ่มเป็นขีดนอนบนแนวภูมิประเทศ
     * แล้วค่อยถูกดึงเข้าหาช่วงของตัวเองบนริบบิ้น
     */
    const BANDS = [
      /** แถบบน: เริ่มก่อน อยู่ค่อนไปทางซ้ายบน กินช่วงต้นของเส้น */
      { from: 0.06, to: 0.34, y: 0.34, x: 0.1, delay: 0 },
      /** แถบล่าง: ตามมาทีหลังราวสี่เฟรม อยู่แนวล่าง กินช่วงกลางของเส้น */
      { from: 0.52, to: 0.82, y: 0.74, x: 0.2, delay: 0.12 },
    ]

    const stampGuide = (guide: number) => {
      gco.fill(0)
      gha.fill(0)
      if (guide <= 0.001) return

      const rCore = Math.max(1.0, (cols / 15) * 0.15)

      for (const b of BANDS) {
        const g = at(guide - b.delay, 0, 1 - b.delay)
        if (g <= 0.001) continue
        // กลุ่มครามมาก่อน แกนส้มโผล่ทีหลังราวหนึ่งในสี่ของช่วง (f072 vs f082)
        const coreOn = at(g, 0.22, 0.42)
        // ขีดยืดออกจากกลางแถบไปสองทาง
        const grow = at(g, 0.05, 0.62)
        const mid = (b.from + b.to) / 2
        const half = ((b.to - b.from) / 2) * grow
        const i0 = Math.floor(((mid - half) * SAMPLES) / 2) * 2
        const i1 = Math.ceil(((mid + half) * SAMPLES) / 2) * 2

        for (let i = i0; i <= i1; i += 2) {
          if (i < 0 || i > SAMPLES) continue
          const s = i / SAMPLES
          // ปลายขีดบางกว่าท้อง — ในคลิปหัวท้ายของขีดส้มจางเสมอ
          const along = Math.min(1, Math.min(s - (mid - half), mid + half - s) / 0.05)
          if (along <= 0) continue
          // บิดเข้าหาริบบิ้นทีละช่วง ต้นขีดเข้าที่ก่อนปลายขีด
          const form = at(g - (s - b.from) * 0.35, 0.55, 0.95)
          // ท่าตั้งต้น: ขีดนอนบนแนวภูมิประเทศ ไถลไปทางขวาเรื่อย ๆ
          const local = (s - b.from) / (b.to - b.from)
          const wx = cols * (b.x + g * 0.26) + local * cols * 0.34
          const wy = rows * b.y + Math.sin(local * 3.2 + t * 1.4) * rows * 0.015
          const px = wx + (kx[i] - wx) * form
          const py = wy + (ky[i] - wy) * form

          const rc = rCore * (0.55 + 0.75 * g) * along * coreOn
          // ชั้นครามกว้างกว่าแกนหลายเท่า และกว้างสุดตอนที่ยังไม่มีแกนส้ม
          const rh = rCore * (0.9 + 1.5 * g) * along * (2.2 - 0.8 * coreOn)
          if (rh <= 0.2) continue
          const ryh = rh * (CELL_W / CELL_H)
          const rh2 = rh * rh
          const rc2 = rc * rc

          const gy0 = Math.max(0, Math.floor(py - ryh))
          const gy1 = Math.min(rows - 1, Math.ceil(py + ryh))
          const gx0 = Math.max(0, Math.floor(px - rh))
          const gx1 = Math.min(cols - 1, Math.ceil(px + rh))
          for (let gy = gy0; gy <= gy1; gy++) {
            const dy = ((gy - py) * CELL_H) / CELL_W
            for (let gx = gx0; gx <= gx1; gx++) {
              const dx = gx - px
              const d2 = dx * dx + dy * dy
              if (d2 > rh2) continue
              const idx = gy * cols + gx
              const h = 1 - Math.sqrt(d2) / rh
              if (h > gha[idx]) gha[idx] = h
              if (d2 > rc2 || rc2 <= 0) continue
              const v = 1 - Math.sqrt(d2) / rc
              if (v > gco[idx]) gco[idx] = v
            }
          }
        }
      }
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
      spc = new Float32Array(n)
      fil = new Float32Array(n)
      cov = new Float32Array(n)
      gco = new Float32Array(n)
      gha = new Float32Array(n)
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
      const { gain, solid, build, ink, guide } = drive.current
      if (gain <= 0.01 && ink <= 0.01 && guide <= 0.01) return

      const showMark = ink > 0.01
      // ต้องคำนวณรูปเสมอเมื่อมีคลื่นนำ เพราะคลื่นใช้จุดบนรูปเป็นปลายทาง
      if (showMark || guide > 0.01) stampMark(build)
      // คลื่นนำจางลงตอนตัวอักษรติดขึ้นมา ส่งไม้ต่อพอดี
      const guideA = guide * (1 - Math.min(1, ink * 2.2))
      if (guideA > 0.01) stampGuide(guide)

      ctx.font = `${CELL_H - 3}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textBaseline = 'top'

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x

          /**
           * ── ตัวอักษร ──
           *
           * ช่องในตัวอักษรเป็นอักขระสีส้มก่อน แล้วค่อยถมเป็นบล็อกทึบทีละช่อง หย่อมใหญ่
           * (ช่อง 5x3) ทึบก่อน แล้วเม็ดเล็กรายช่องตามมาอุด เหมือน f114-f130 ของคลิป
           */
          const m = showMark ? fil[idx] : 0
          if (m > 0.4) {
            const patch = hash(Math.floor(x / 5) * 3.1, Math.floor(y / 3) * 7.7)
            const speck = hash(x * 1.7, y * 2.3)
            if (solid * 2.3 - 0.7 * patch - 0.55 * speck > 0.5) {
              ctx.globalAlpha = ink
              const sp = spc[idx]
              ctx.fillStyle =
                sp <= 0.3 ? INK : SPEC[Math.min(SPEC.length - 1, Math.floor((sp - 0.3) * 5.6))]
              ctx.fillRect(x * CELL_W, y * CELL_H, CELL_W + 0.5, CELL_H + 0.5)
              ctx.globalAlpha = 1
              continue
            }
            const lit = Math.min(1, m * ink * (0.55 + 0.45 * solid))
            const ch = RAMP[Math.min(RAMP.length - 1, Math.floor(lit * RAMP.length))]
            if (ch !== ' ') {
              ctx.fillStyle =
                INK_EDGE[Math.min(INK_EDGE.length - 1, Math.floor(lit * INK_EDGE.length))]
              ctx.fillText(ch, x * CELL_W, y * CELL_H)
            }
            continue
          }

          // ── เส้นขอบของชิ้นส่วน: อักขระสีส้ม อยู่เหนือภูมิประเทศ ──
          const c = showMark ? cov[idx] : 0
          if (c > 0.12) {
            const lit = Math.min(1, c * ink)
            const ch = RAMP[Math.min(RAMP.length - 1, Math.floor(lit * RAMP.length))]
            if (ch !== ' ') {
              ctx.fillStyle =
                lit > 0.88
                  ? '#ffd9c2'
                  : INK_EDGE[Math.min(INK_EDGE.length - 1, Math.floor(lit * INK_EDGE.length))]
              ctx.fillText(ch, x * CELL_W, y * CELL_H)
              continue
            }
          }

          // ── คลื่นนำสายตา: กลุ่มครามห่อแกนส้ม อยู่เหนือภูมิประเทศ ──
          if (guideA > 0.01) {
            const core = gco[idx]
            if (core > 0.1) {
              const lit = Math.min(1, core * guideA * 1.25)
              const ch = RAMP[Math.min(RAMP.length - 1, Math.floor(lit * RAMP.length))]
              if (ch !== ' ') {
                ctx.fillStyle =
                  INK_EDGE[Math.min(INK_EDGE.length - 1, Math.floor(lit * INK_EDGE.length))]
                ctx.fillText(ch, x * CELL_W, y * CELL_H)
                continue
              }
            }
            const halo = gha[idx]
            if (halo > 0.12) {
              // กลุ่มครามทึบกว่าพื้นรอบ ๆ จึงบวกทับความสว่างของภูมิประเทศ ไม่ใช่แทนที่
              const lit = Math.min(1, halo * guideA * 1.1)
              const ch = RAMP[Math.min(RAMP.length - 1, Math.floor((0.25 + 0.75 * lit) * RAMP.length))]
              if (ch !== ' ') {
                ctx.fillStyle =
                  GUIDE_TINTS[Math.min(GUIDE_TINTS.length - 1, Math.floor(lit * GUIDE_TINTS.length))]
                ctx.fillText(ch, x * CELL_W, y * CELL_H)
                continue
              }
            }
          }

          // ── ภูมิประเทศ ─────────────────────────────────────────────
          /**
           * ความถี่ตามแกนตั้งสูงกว่าแกนนอนมาก ค่าที่ได้จึงเป็นริ้วนอนยาว ๆ ซ้อนชั้นกัน
           * และการหักด้วย x ทำให้ริ้วเอียงเป็นแนวเฉียงอย่างในคลิป
           */
          let bg = noise(x * 0.018 + t * 0.06, y * 0.34 - x * 0.05) * 0.62
          bg += noise(x * 0.05 - t * 0.03, y * 0.62 - x * 0.08) * 0.27
          bg += noise(x * 0.16, y * 1.1) * 0.11

          const mdx = x - mouse.x
          const mdy = y - mouse.y
          const md2 = mdx * mdx + mdy * mdy
          if (md2 < 400) bg += 0.4 * Math.exp(-md2 / 90)
          bg = (bg - 0.34) * 2.4 * gain
          if (bg <= 0.02) continue

          const norm = Math.min(1, bg / V_MAX)
          const ch = RAMP[Math.min(RAMP.length - 1, Math.floor(norm * RAMP.length))]
          if (ch === ' ') continue
          ctx.fillStyle = TINTS[Math.min(TINTS.length - 1, Math.floor(norm * TINTS.length))]
          ctx.fillText(ch, x * CELL_W, y * CELL_H)
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
