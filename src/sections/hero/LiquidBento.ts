import * as THREE from 'three'

/**
 * ฟองคำพูด + ปุ่มสกิล = ฟองแก้ว 3D ใบเดิมใบเดียว ที่ปุ่มงอกออกมาจากเนื้อของมันเอง
 * (ท่า liquid glass ของ iOS / Spotlight ของ macOS)
 *
 * ทำไมปั้นเรขาคณิตใหม่ทุกเฟรม แทนที่จะวางปุ่มเป็นชิ้นแยก: ชิ้นแยก (แผ่น DOM, เชดเดอร์อีกแผ่นวางทับ)
 * เป็นของคนละชิ้นกับฟองเสมอ เห็นรอยต่อ/เห็นสองชั้น ที่นี่ฟอง ปุ่ม ช่อง เป็นรูปทรงระยะ (signed distance)
 * ในสนามเดียวกัน หลอมกันด้วย smooth-min แล้วลากเส้นขอบ (marching squares) อัดขึ้นรูปเป็นเมชเดียว
 * ใส่วัสดุแก้วตัวเดิมของฟอง — ระหว่างแตกหน่อจึงมีคอของเหลวยืดแล้วขาด หยุดแล้วแต่ละชิ้นแยกขอบคม
 *
 * ทรงฟองในสนามคือเส้นขอบจากไฟล์ SVG ตรง ๆ และฟองที่เดินทางปั้นด้วยวิธีนี้ตลอดทาง (ดู BubbleTraveler)
 * ไม่มีจังหวะสลับทรง ยังไม่มีเนื้อหาในปุ่ม — ค่อยใส่ทีหลัง
 */

export const SKILLS = ['Research', 'Design', 'Coding'] as const

type Rect = { x: number; y: number; w: number; h: number }
/** กล่องมนในพิกัดท้องถิ่นของฟอง: กลาง x y, ครึ่งกว้าง ครึ่งสูง, รัศมีมุม */
export type Blob = { x: number; y: number; hw: number; hh: number; r: number; rs: readonly number[] }
/** กรอบฟองบนจอ (รวมหาง) + สเกลพิกเซลต่อหน่วย viewBox ของ SVG */
export type BubbleBox = Rect & { s: number }

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

/**
 * ปุ่มกลมสูงเท่าฟอง (bh = กรอบทั้งทรง ตัวฟองสูงเต็มกรอบ หางอยู่ในกรอบเดียวกัน)
 */
export const rowDims = (bh: number) => {
  const d = bh
  return { d, gap: Math.max(16, d * 0.22) }
}
/** ฟองกับแถวปุ่มลอยขึ้นเป็นแถบบนสุด (0..1 ของบท up) — ใช้ร่วมกับ BubbleTraveler */
export const headOf = (up: number) => inOut(clamp01(up))

/** ฟองหลบซ้ายเท่าไร (px) ให้แถว ฟอง + ปุ่ม อยู่กลางจอ */
export function sproutShift(bh: number, p: { sprout: number }) {
  const { d, gap } = rowDims(bh)
  return ((SKILLS.length * (d + gap)) / 2) * inOut(p.sprout)
}

/**
 * ปุ่มของเฟรมนี้ในพิกัดท้องถิ่นของฟอง (หน่วย viewBox แกน y ชี้ขึ้น กลางกรอบฟอง = จุดศูนย์)
 * b = กรอบฟองบนจอ (px) · k = ระยะหลอม (หน่วยเดียวกัน)
 */
/**
 * ปลายทางของแถว (px) นับจากกลางฟอง ณ ปลายทางของฟอง — อิงฟอง ไม่ใช่จอ: วงกลมถูกพาไปกับฟองแล้วไหลลงไปใต้มัน
 * ไม่วิ่งแซงขึ้นไปเหนือฟองระหว่างทาง
 * x = ขอบซ้ายของจุดแรก · y = กลางแนวตั้ง · d = เส้นผ่านศูนย์กลางจุด · gap = ช่องไฟ · page = หน้าที่เปิดอยู่ (ทศนิยมได้)
 */
export type RowDest = { x: number; y: number; d: number; gap: number; page: number; inset?: number; headOff?: number }
/** จุดของหน้าที่เปิดอยู่ยืดเป็นแคปซูลยาวกว่าจุดปกติกี่เท่า */
const PILL = 2.6

/**
 * head = แยกตัวจากฟองไปเป็นจุดบอกหน้าใต้หัวข้อ (0..1) — วงกลมไหลจากแถวข้างฟองไปที่ปลายทาง ย่อเป็นจุดเล็ก
 * ระหว่างนั้นระยะหลอมเปิด คอของเหลวระหว่างฟองกับวงกลมจึงยืดแล้วขาด
 * ปลายทางคือจุดบอกความคืบหน้าของการเลื่อน: จุดของหน้าที่เปิดอยู่ยืดเป็นแคปซูล (act = น้ำหนักความ "เปิดอยู่" ต่อจุด)
 */
/** พาเนลที่ฟองพองออกไปเป็น (px นับจากกลางฟองตอนนี้) — k = พองไปแค่ไหน 0..1 */
export type PanelDest = { cx: number; cy: number; hw: number; hh: number; r: number; k: number }

export function skillBlobs(
  p: { sprout: number; head: number },
  b: BubbleBox,
  dest: RowDest,
  panel?: PanelDest,
): { blobs: Blob[]; k: number; act: number[]; panel: Blob | null } {
  const blobs: Blob[] = []
  const act: number[] = []
  /**
   * พาเนลแบบ Spotlight = ตัวฟองเอง: เริ่มเป็นก้อนขนาดตัวฟอง ณ กลางฟอง แล้วพองออกเป็นกล่องมนกลางจอ
   * ระหว่างนั้นทรงฟองยุบหายเข้าไปข้างใน (ดู shrink ใน liquidGeo) — อยู่ในสนามเดียวกัน จึงเป็นก้อนเดียวที่เปลี่ยนทรง
   */
  let pb: Blob | null = null
  if (panel && panel.k > 0) {
    const k = inOut(clamp01(panel.k))
    /* เริ่มเท่าตัวฟองพอดี (ไม่รวมหาง) — จังหวะแรกฟองไม่หดก่อนพอง */
    const hw = lerp((b.w / 2) * 0.97, panel.hw, k) / b.s
    const hh = lerp((b.h / 2) * 0.92, panel.hh, k) / b.s
    const r = Math.min(lerp((b.h / 2) * 0.92, panel.r, k) / b.s, hw, hh)
    pb = { x: (panel.cx * k) / b.s, y: (-panel.cy * k) / b.s, hw, hh, r, rs: [r, r, r, r] }
  }
  const { d, gap } = rowDims(b.h)
  /* ตัวฟองไม่รวมหาง: กลางแนวตั้ง = กลางกรอบ, ขอบขวา = ขอบกรอบ */
  const half = b.w / 2
  /** จุดแตกหน่อของปุ่มถัดไป = กลางปุ่มก่อนหน้า (ตอนนี้) — ปุ่มไหลต่อกันเป็นสาย */
  let from = half - d * 0.55
  /*
   * ปลายทาง: ความกว้างของแต่ละจุดตามหน้าที่เปิดอยู่ แล้วเรียงต่อกันจากขอบซ้าย
   * มีพาเนล = ยึดมุมขวาบนของพาเนลขนาดเฟรมนี้ (ไม่ใช่ขนาดตอนพองเต็ม) จุดจึงขยับไปพร้อมพาเนลที่กำลังพอง ไม่ลอยหลุดออกนอก
   */
  const rowW = dest.d * (SKILLS.length - 1 + PILL) + dest.gap * (SKILLS.length - 1)
  let edge = pb ? (pb.x + pb.hw) * b.s - (dest.inset ?? 0) - rowW : dest.x
  const destY = pb ? -(pb.y + pb.hh) * b.s + (dest.headOff ?? 0) : dest.y
  for (let i = 0; i < SKILLS.length; i += 1) {
    const a = Math.max(0, 1 - Math.abs(dest.page - i))
    act.push(a)
    const fw = dest.d * (1 + (PILL - 1) * a)
    const fx = edge + fw / 2
    edge += fw + dest.gap

    const ks = clamp01((p.sprout - i * 0.22) / 0.56)
    if (ks <= 0) continue
    const home = half + gap + d / 2 + i * (d + gap)
    const x = lerp(from, home, outBack(ks))
    from = x
    /* วงหลังออกตัวช้ากว่าเล็กน้อย — ไหลตามกันเป็นสาย */
    const h = inOut(clamp01((p.head - i * 0.08) / 0.84))
    const r0 = (d * lerp(0.55, 1, outQuint(ks))) / 2
    const rx = lerp(x, fx, h)
    const ry = lerp(0, destY, h)
    const hw = lerp(r0, fw / 2, h) / b.s
    const hh = lerp(r0, dest.d / 2, h) / b.s
    const r = Math.min(hw, hh)
    blobs.push({ x: rx / b.s, y: -ry / b.s, hw, hh, r, rs: [r, r, r, r] })
  }
  if (pb) blobs.push(pb)
  return { blobs, k: (MELT * Math.max(bump(p.sprout), bump(p.head), panel ? bump(panel.k) : 0)) / b.s, act, panel: pb }
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
 * outline = เส้นขอบฟองจากไฟล์ (viewBox แกน y ชี้ลง) · w = ความกว้างฟอง (viewBox) · blobs/k จาก skillBlobs
 * shrink = หดตัวฟอง (หน่วย viewBox)
 */
export function liquidGeo(outline: Float32Array, w: number, blobs: Blob[], k: number, thick: number, round: number, shrink = 0) {
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
    /* shrink = หดตัวฟองเข้าหาแกน (หน่วย viewBox) — ราว 50 ฟองหายหมด ตอนหลอมเข้าวงกลมแรก */
    let d = (box > far ? box : (sampleBubble(g, qx, qy, dx) ?? box)) + shrink
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
