import * as THREE from 'three'

/**
 * ฟองคำพูด + ปุ่มสกิล + ช่อง bento = ฟองแก้ว 3D ใบเดิมใบเดียว ที่ปุ่มกับช่องงอกออกมาจากเนื้อของมันเอง
 * (ท่า liquid glass ของ iOS / Spotlight ของ macOS)
 *
 * ทำไมปั้นเรขาคณิตใหม่ทุกเฟรม แทนที่จะวางปุ่มเป็นชิ้นแยก: ชิ้นแยก (แผ่น DOM, เชดเดอร์อีกแผ่นวางทับ)
 * เป็นของคนละชิ้นกับฟองเสมอ เห็นรอยต่อ/เห็นสองชั้น ที่นี่ฟอง ปุ่ม ช่อง เป็นรูปทรงระยะ (signed distance)
 * ในสนามเดียวกัน หลอมกันด้วย smooth-min แล้วลากเส้นขอบ (marching squares) อัดขึ้นรูปเป็นเมชเดียว
 * ใส่วัสดุแก้วตัวเดิมของฟอง — ระหว่างไหลจึงมีคอของเหลวยืดแล้วขาด หยุดไหลแล้วแต่ละชิ้นแยกขอบคม
 *
 * ทรงฟองในสนามคือเส้นขอบจากไฟล์ SVG ตรง ๆ และฟองที่เดินทางปั้นด้วยวิธีนี้ตลอดทาง (ดู BubbleTraveler)
 * ไม่มีจังหวะสลับทรง ยังไม่มีเนื้อหาในปุ่ม/ช่อง — ค่อยใส่ทีหลัง
 */

export const SKILLS = ['Research', 'Design', 'Coding'] as const

type Rect = { x: number; y: number; w: number; h: number }
/** กล่องมนในพิกัดท้องถิ่นของฟอง: กลาง x y, ครึ่งกว้าง ครึ่งสูง, รัศมีมุม */
export type Blob = { x: number; y: number; hw: number; hh: number; r: number; rs: readonly number[] }
/** sprout/morph 0..1 · lift = เลื่อนขึ้นไปพร้อมท้าย section (px, ติดลบ) */
type Pose = { sprout: number; morph: number; lift: number }
/** กรอบฟองบนจอ (รวมหาง) + สเกลพิกเซลต่อหน่วย viewBox ของ SVG */
export type BubbleBox = Rect & { s: number }

const RADIUS = 28
/** ระยะหลอมของ smooth-min ตอนกำลังไหล (px บนจอ) — หยุดไหลแล้วเป็น 0 ขอบแต่ละชิ้นคมแยกกัน */
const MELT = 34
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const outQuint = (x: number) => 1 - (1 - x) ** 5
const inOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)
/** เด้งเกินนิดแล้วคืน — ของเหลวมีแรงเฉื่อย */
const outBack = (x: number) => 1 + 1.9 * (x - 1) ** 3 + 0.9 * (x - 1) ** 2
/** 0 ที่ปลายทั้งสองข้าง ขึ้นเร็วลงเร็ว — ระยะหลอมเปิดเฉพาะตอนไหล */
const bump = (x: number) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 0.4)

/** ปุ่มกลมสูงเท่าฟอง (bh = กรอบทั้งทรง ตัวฟองสูงเต็มกรอบ หางอยู่ในกรอบเดียวกัน) */
const dims = (bh: number) => {
  const d = bh
  return { d, gap: Math.max(16, d * 0.22) }
}
/** ฟองลอยขึ้นเป็นแถบบนสุดในช่วงแรกของ morph — ตรงกับ head ใน BubbleTraveler */
export const headOf = (morph: number) => inOut(clamp01(morph / 0.45))

/** ฟองหลบซ้ายเท่าไร (px) ให้แถว ฟอง + ปุ่ม อยู่กลางจอ — กลับเข้ากลางตอนปุ่มไหลไปเป็นช่อง */
export function sproutShift(bh: number, p: { sprout: number; morph: number }) {
  const { d, gap } = dims(bh)
  return ((SKILLS.length * (d + gap)) / 2) * inOut(p.sprout) * (1 - headOf(p.morph))
}

/** กรอบของแต่ละช่องใต้ฟอง — จอกว้าง: Research สูงเต็มทางซ้าย, Design/Coding ซ้อนกันทางขวา · จอแคบ: เรียงลง */
function cells(W: number, H: number, top: number): Rect[] {
  const pad = Math.max(16, Math.min(W, H) * 0.035)
  const gap = Math.max(14, pad * 0.75)
  const full = { x: pad, y: top + gap, w: W - pad * 2, h: H - pad - top - gap }
  if (W < 720) {
    const h = (full.h - gap * 2) / 3
    return SKILLS.map((_, i) => ({ x: full.x, y: full.y + i * (h + gap), w: full.w, h }))
  }
  const lw = (full.w - gap) * 0.46
  const rw = full.w - gap - lw
  const rh = (full.h - gap) / 2
  return [
    { x: full.x, y: full.y, w: lw, h: full.h },
    { x: full.x + lw + gap, y: full.y, w: rw, h: rh },
    { x: full.x + lw + gap, y: full.y + rh + gap, w: rw, h: rh },
  ]
}

/**
 * ปุ่ม/ช่องของเฟรมนี้ในพิกัดท้องถิ่นของฟอง (หน่วย viewBox แกน y ชี้ขึ้น กลางกรอบฟอง = จุดศูนย์)
 * b = กรอบฟองบนจอ (px รวมการเลื่อนขึ้นแล้ว) · k = ระยะหลอม (หน่วยเดียวกัน)
 */
export function bentoBlobs(p: Pose, b: BubbleBox, W: number, H: number): { blobs: Blob[]; k: number } {
  const blobs: Blob[] = []
  const ox = b.x + b.w / 2
  const oy = b.y + b.h / 2
  const { d, gap } = dims(b.h)
  /* ตัวฟองไม่รวมหาง: กลางแนวตั้ง = กลางกรอบ, ขอบขวา = ขอบกรอบ */
  const cy = b.y + b.h / 2
  const right = b.x + b.w
  /* ช่องคิดจากฟองก่อนเลื่อน แล้วเลื่อนทั้งชุด — ไม่งั้นช่องยืดตามตอนจอถัดไปดันขึ้น */
  const cell = cells(W, H, b.y - p.lift + b.h)
  /** จุดแตกหน่อของปุ่มถัดไป = กลางปุ่มก่อนหน้า (ตอนนี้) — ปุ่มไหลต่อกันเป็นสาย */
  let from = right - d * 0.55
  for (let i = 0; i < SKILLS.length; i += 1) {
    const ks = clamp01((p.sprout - i * 0.22) / 0.56)
    if (ks <= 0) continue
    const home = right + gap + d / 2 + i * (d + gap)
    const x = lerp(from, home, outBack(ks))
    const size = d * lerp(0.55, 1, outQuint(ks))
    from = x

    /* ปุ่ม → ช่อง: หยดลงก่อน แล้วแผ่ข้าง ไล่ทีละช่อง */
    const k = clamp01((p.morph - 0.15 - i * 0.12) / 0.6)
    const c = { ...cell[i], y: cell[i].y + p.lift }
    const top = lerp(cy - size / 2, c.y, outBack(clamp01(k / 0.9)))
    const bot = lerp(cy + size / 2, c.y + c.h, inOut(k))
    const kx = inOut(clamp01((k - 0.08) / 0.92))
    const left = lerp(x - size / 2, c.x, kx)
    const rr = lerp(x + size / 2, c.x + c.w, kx)
    const hw = Math.max(0, (rr - left) / 2)
    const hh = Math.max(0, (bot - top) / 2)
    const r = Math.min(lerp(size / 2, RADIUS, k), hw, hh)
    blobs.push({ x: ((left + rr) / 2 - ox) / b.s, y: (oy - (top + bot) / 2) / b.s, hw: hw / b.s, hh: hh / b.s, r: r / b.s, rs: [r / b.s, r / b.s, r / b.s, r / b.s] })
  }
  return { blobs, k: (MELT * Math.max(bump(p.sprout), bump(p.morph))) / b.s }
}

/* ---------- สนามระยะ (หน่วย viewBox แกน y ชี้ลงแบบ SVG) ---------- */

/** กล่องมนสี่มุมไม่เท่ากัน r = [ขวาล่าง, ขวาบน, ซ้ายล่าง, ซ้ายบน] แกน y ชี้ลง */
function sdRB(px: number, py: number, bx: number, by: number, r: readonly number[]) {
  let rr = px > 0 ? (py > 0 ? r[0] : r[1]) : py > 0 ? r[2] : r[3]
  rr = Math.min(rr, bx, by)
  const qx = Math.abs(px) - bx + rr
  const qy = Math.abs(py) - by + rr
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - rr
}
function sdBox(px: number, py: number, bx: number, by: number) {
  const qx = Math.abs(px) - bx
  const qy = Math.abs(py) - by
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0)
}
function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
/** ระยะถึงรูปหลายเหลี่ยม (มีเครื่องหมาย ติดลบ = ข้างใน) */
function sdPoly(px: number, py: number, v: Float32Array) {
  const n = v.length / 2
  let d = (px - v[0]) ** 2 + (py - v[1]) ** 2
  let sg = 1
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const ix = v[i * 2]
    const iy = v[i * 2 + 1]
    const ex = v[j * 2] - ix
    const ey = v[j * 2 + 1] - iy
    const wx = px - ix
    const wy = py - iy
    const t = Math.min(1, Math.max(0, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)))
    const bx = wx - ex * t
    const by = wy - ey * t
    d = Math.min(d, bx * bx + by * by)
    const c1 = py >= iy
    const c2 = py < v[j * 2 + 1]
    const c3 = ex * wy > ey * wx
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) sg = -sg
  }
  return sg * Math.sqrt(d)
}


/**
 * สนามระยะของตัวฟองล้วน ๆ (เส้นขอบจากไฟล์ SVG ตรง ๆ ไม่ใช่ทรงจำลอง) เก็บเป็นตารางหน่วยละช่อง (หน่วย viewBox)
 *
 * ไล่ทุกขอบของรูปทุกจุดทุกเฟรมแพงเกิน จึงปั้นตารางครั้งเดียวจากทรงตั้งต้น (กว้าง 211) แล้วอ่านแบบไล่ค่า
 * ระหว่างจุด — ฟองที่ยืดตามข้อความยืดแบบเดียวกับที่ฟองเคยยืด (จุดที่ x > SPLIT เลื่อนขวา) ช่วงกลางที่ยืด
 * เป็นแผ่นตรงบน-ล่าง ระยะจึงเท่ากับระยะที่เส้น SPLIT · ฝั่งขวาคือทรงเดิมเลื่อนไป dx
 */
const VB_W = 211
const SPLIT = 100
const PADG = 48
let grid: { nx: number; ny: number; v: Float32Array } | null = null
function bubbleGrid(outline: Float32Array) {
  if (grid) return grid
  const nx = VB_W + PADG * 2 + 1
  const ny = 99 + PADG * 2 + 1
  const v = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) v[j * nx + i] = sdPoly(i - PADG, j - PADG, outline)
  grid = { nx, ny, v }
  return grid
}
function sampleBubble(g: NonNullable<typeof grid>, qx: number, qy: number, dx: number) {
  const mx = qx <= SPLIT ? qx : qx < SPLIT + dx ? SPLIT : qx - dx
  const fx = mx + PADG
  const fy = qy + PADG
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  if (i < 0 || j < 0 || i >= g.nx - 1 || j >= g.ny - 1) return null
  const tx = fx - i
  const ty = fy - j
  const a = g.v[j * g.nx + i]
  const b = g.v[j * g.nx + i + 1]
  const c = g.v[(j + 1) * g.nx + i]
  const d = g.v[(j + 1) * g.nx + i + 1]
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty
}

/* ---------- marching squares ---------- */

/** เส้นที่ลากในแต่ละกรณีของช่อง (ขอบ 0 ล่าง 1 ขวา 2 บน 3 ซ้าย · มุม a=ซ้ายล่าง b=ขวาล่าง c=ขวาบน d=ซ้ายบน) */
const CASES: number[][] = [[], [3, 0], [0, 1], [3, 1], [1, 2], [], [0, 2], [3, 2], [2, 3], [0, 2], [], [1, 2], [1, 3], [0, 1], [3, 0], []]

/**
 * เมชแก้วของฟอง + ปุ่ม/ช่อง — หน่วยและจุดศูนย์เดียวกับ bubbleGeo ใน BubbleTraveler (กลางกรอบฟอง แกน y ชี้ขึ้น)
 * outline = เส้นขอบฟองจากไฟล์ (viewBox แกน y ชี้ลง) · w = ความกว้างฟอง (viewBox) · blobs/k จาก bentoBlobs
 */
export function liquidGeo(outline: Float32Array, w: number, blobs: Blob[], k: number, thick: number, round: number) {
  /*
   * ขอบมนตามความหนา — bevel ดันขอบออก จึงลากเส้นที่ระยะ -inset แล้วให้ bevel พองกลับเท่าทรงจริง
   * ดันออกแค่ครึ่งของความมนด้านหนา: หางฟองบาง ถ้าหดเข้าเต็มครึ่งความหนา ปลายหางจะทู่หาย
   */
  const bev = thick * 0.499 * Math.min(1, Math.max(0, round))
  const inset = bev * 0.5
  /* นอกกรอบฟองไกลเกินระยะหลอม = ใช้ระยะถึงกรอบแทน (ไม่ต้องไล่ทุกขอบของรูป — ช่วงช่องเต็มจอเกือบทุกจุดอยู่ไกลฟอง) */
  const far = k + inset + 4
  const g = bubbleGrid(outline)
  const dx = w - VB_W
  /* พิกัดท้องถิ่น (y ขึ้น กลางกรอบ) → พิกัด SVG ของฟอง (y ลง มุมซ้ายบน) */
  const field = (x: number, y: number) => {
    const qx = x + w / 2
    const qy = 49.5 - y
    const box = sdBox(qx - w / 2, qy - 49.5, w / 2, 49.5)
    let d = box > far ? box : (sampleBubble(g, qx, qy, dx) ?? box)
    for (const b of blobs) d = smin(d, sdRB(x - b.x, b.y - y, b.hw, b.hh, b.rs), k)
    return d + inset
  }
  let x0 = -w / 2
  let x1 = w / 2
  let y0 = -49.5
  let y1 = 49.5
  for (const b of blobs) {
    x0 = Math.min(x0, b.x - b.hw)
    x1 = Math.max(x1, b.x + b.hw)
    y0 = Math.min(y0, b.y - b.hh)
    y1 = Math.max(y1, b.y + b.hh)
  }
  const m = 6
  x0 -= m
  y0 -= m
  x1 += m
  y1 += m
  /* ความละเอียดตามขนาด — ช่วงปุ่มงอก (ก้อนเล็ก) ละเอียด ~1.5 หน่วย ช่วงช่องเต็มจอหยาบลง เมชไม่บวมเกินไป */
  const st = Math.max(1.5, (x1 - x0) / 300, (y1 - y0) / 200)
  const nx = Math.ceil((x1 - x0) / st) + 1
  const ny = Math.ceil((y1 - y0) / st) + 1
  const v = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) v[j * nx + i] = field(x0 + i * st, y0 + j * st)

  /* จุดตัดบนขอบ (หาตามเลขขอบ) */
  const HN = (nx - 1) * ny
  const pts = new Map<number, [number, number]>()
  const edgePt = (id: number): [number, number] => {
    let pt = pts.get(id)
    if (pt) return pt
    if (id < HN) {
      const j = Math.floor(id / (nx - 1))
      const i = id - j * (nx - 1)
      const a = v[j * nx + i]
      const b = v[j * nx + i + 1]
      pt = [x0 + (i + a / (a - b)) * st, y0 + j * st]
    } else {
      const e = id - HN
      const j = Math.floor(e / nx)
      const i = e - j * nx
      const a = v[j * nx + i]
      const b = v[(j + 1) * nx + i]
      pt = [x0 + i * st, y0 + (j + a / (a - b)) * st]
    }
    pts.set(id, pt)
    return pt
  }
  const link = new Map<number, number[]>()
  const add = (a: number, b: number) => {
    const la = link.get(a)
    if (la) la.push(b)
    else link.set(a, [b])
    const lb = link.get(b)
    if (lb) lb.push(a)
    else link.set(b, [a])
  }
  for (let j = 0; j < ny - 1; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      const a = v[j * nx + i]
      const b = v[j * nx + i + 1]
      const c = v[(j + 1) * nx + i + 1]
      const d = v[(j + 1) * nx + i]
      const cs = (a < 0 ? 1 : 0) | (b < 0 ? 2 : 0) | (c < 0 ? 4 : 0) | (d < 0 ? 8 : 0)
      if (cs === 0 || cs === 15) continue
      const E = [j * (nx - 1) + i, HN + j * nx + i + 1, (j + 1) * (nx - 1) + i, HN + j * nx + i]
      if (cs === 5 || cs === 10) {
        /* จุดอานม้า: ดูค่ากลางช่องว่าสองมุมในเชื่อมกันไหม */
        const inC = (a + b + c + d) / 4 < 0
        const pairs = (cs === 5) === inC ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]]
        for (const [e0, e1] of pairs) add(E[e0], E[e1])
        continue
      }
      const sg = CASES[cs]
      add(E[sg[0]], E[sg[1]])
    }
  }
  /* ไล่ต่อเส้นเป็นวง */
  const shapes: THREE.Shape[] = []
  const seen = new Set<number>()
  for (const startId of link.keys()) {
    if (seen.has(startId)) continue
    const loop: THREE.Vector2[] = []
    let prev = -1
    let cur = startId
    let last: [number, number] | null = null
    while (!seen.has(cur)) {
      seen.add(cur)
      const pt = edgePt(cur)
      /* ทิ้งจุดที่ชิดกันเกิน — เส้นขอบเบาลง ไม่เสียทรง */
      if (!last || Math.hypot(pt[0] - last[0], pt[1] - last[1]) > st * 0.6) {
        loop.push(new THREE.Vector2(pt[0], pt[1]))
        last = pt
      }
      const nb = link.get(cur) as number[]
      const next = nb[0] !== prev ? nb[0] : nb[1]
      prev = cur
      if (next === undefined) break
      cur = next
    }
    /* ขอบตรงของช่อง/ฟองมีจุดเรียงเป็นเส้นตรงหลายร้อยจุด — ทิ้งจุดที่แทบอยู่บนเส้นเดียวกับเพื่อนสองข้าง
       เมชเบาลงหลายเท่า (อัดขึ้นรูปทุกเฟรมตอนไหล) โค้งยังอยู่ครบ */
    const lean: THREE.Vector2[] = []
    for (let n = 0; n < loop.length; n += 1) {
      const a = lean.length ? lean[lean.length - 1] : loop[loop.length - 1]
      const b = loop[n]
      const c = loop[(n + 1) % loop.length]
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
      if (Math.abs(cross) > st * st * 0.08 || Math.hypot(b.x - a.x, b.y - a.y) > st * 12) lean.push(b)
    }
    if (lean.length < 3) continue
    loop.length = 0
    loop.push(...lean)
    if (THREE.ShapeUtils.isClockWise(loop)) loop.reverse()
    shapes.push(new THREE.Shape(loop))
  }
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: Math.max(1e-4, thick - bev * 2),
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: inset,
    bevelSegments: 5,
    curveSegments: 1,
  })
  geo.translate(0, 0, bev - thick / 2)
  return geo
}
