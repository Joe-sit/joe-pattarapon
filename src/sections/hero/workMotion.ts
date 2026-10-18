import { BEAT, at } from '@/sections/skystory/beats'

/**
 * เครื่องแก้วเป็นโต๊ะทำงาน — ต่อจาก "Here is what I do" (ดู ./WorkStory ./BubbleTraveler ./BenchScreen)
 *
 * ไฟล์นี้คือคณิตล้วนที่สองแคนวาสต้องเห็นตรงกัน: ตัวเครื่องแก้ว (ออร์โธ ใน BubbleTraveler) กับของบนจอเครื่อง
 * (เพอร์สเปกทีฟ ใน WorkStory — วาดอยู่ *ใต้* แก้ว จึงเห็นเป็นของในจอ) วางตามท่าเดียวกัน (benchPose)
 * ทางเดินของเคอร์เซอร์ และกรอบเลือก · ทุกค่าคิดจากระยะเลื่อน เลื่อนกลับก็ถอยกลับ
 */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const smooth = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}
export const inOut = (x: number) => {
  const u = clamp01(x)
  return u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2
}
export const outCubic = (x: number) => 1 - (1 - clamp01(x)) ** 3
/** เลยเป้านิดแล้วกลับ — ของที่เด้งเกิด */
export const outBack = (x: number, k = 1.9) => {
  const u = clamp01(x) - 1
  return 1 + (k + 1) * u ** 3 + k * u ** 2
}
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** มุมกล้องของสองแคนวาส (องศา) — แคนวาสออร์โธใส่เพอร์สเปกทีฟเองด้วยระยะโฟกัสเดียวกัน ภาพจึงทาบกันพอดี */
export const FOV = 30
export const TAN = Math.tan(((FOV / 2) * Math.PI) / 180)
/** ระยะกล้อง (px) ที่ทำให้ระนาบ z 0 เป็น 1 หน่วย = 1 px */
export const camDist = (H: number) => H / 2 / TAN

/** ความคืบหน้าของแต่ละบท (0..1 ยังไม่ผ่านการเกลี่ย) */
export type WorkBeats = {
  sv2: number
  morph: number
  lift: number
  bench: number
  wire: number
  research: number
  /** บท Research จริง (island แท่นบนจอเครื่อง — ./ResearchPlatform) — คนละอันกับ research ที่เป็นช่วงข้อความหลุดลอย */
  study: number
  design: number
  code: number
  ship: number
}

export function workBeats(sv2: number): WorkBeats {
  return {
    sv2,
    morph: at(sv2, BEAT.morph),
    lift: at(sv2, BEAT.lift),
    bench: at(sv2, BEAT.bench),
    /* บท wire (ตัวอักษรกลายเป็นกรอบลงจอ) ปิดแล้ว — ข้อความลอยพ้นจอไปก่อนเครื่องมา ไม่ได้เล่าต่อ */
    wire: 0,
    research: at(sv2, BEAT.research),
    study: at(sv2, BEAT.study),
    design: at(sv2, BEAT.design),
    code: at(sv2, BEAT.code),
    ship: at(sv2, BEAT.ship),
  }
}

/**
 * ตำแหน่งเคอร์เซอร์พิมพ์ในฟองคำพูดบนจอ (px y ลง) — ฟองเขียนทุกเฟรมที่มันวาด
 * เคอร์เซอร์ของหน้าโผล่ออกมาจากจุดนี้ (มันอาศัยอยู่ในฟอง แล้วออกมาจากตรงนั้น)
 */
export const caretSpot = { x: 0, y: 0, ok: false }

/**
 * ฟองหัวเรื่องในร่างเครื่อง — hw hh r = ครึ่งกว้าง/สูง/รัศมีมุม px บนจอ ณ ขนาดตั้งต้น (ยังไม่ขยายเป็นโต๊ะทำงาน)
 * k = คลี่เป็นเครื่องแค่ไหน · tilt = หงายแค่ไหน (0..1) · bench = ตั้งหน้าตรงเป็นโต๊ะทำงานแค่ไหน — ฟองเขียนทุกเฟรมที่มันวาด
 */
export const deviceSpot = { hw: 0, hh: 0, r: 0, k: 0, tilt: 0, bench: 0 }
/**
 * ท่าจริงของเครื่องเฟรมนี้ (เมทริกซ์ 4×4 ก่อนใส่เพอร์สเปกทีฟ — พิกัดโลก px กลางจอ แกน y ขึ้น หน่วยท้องถิ่น = viewBox ของฟอง)
 * ของบนจอในแคนวาสเพอร์สเปกทีฟ (./BenchScreen) วางด้วยเมทริกซ์นี้ตรง ๆ จึงติดเครื่องทุกท่า (ซูม เอียง เลื่อน เอน ควง)
 */
export const deviceMat = { e: new Float32Array(16), ok: false }
/** ทรงเครื่องในหน่วย viewBox ของฟอง (ครึ่งกว้าง · ครึ่งสูง · รัศมีมุม) — สัดส่วนจอมือถือ */
export const DEVICE = { hw: 88, hh: 172, r: 36 }

/** จอตั้ง (มือถือ) — เครื่องอยู่กลางล่าง หัวเรื่องอยู่บน */
export const isTall = (W: number, H: number) => W / Math.max(1, H) < 0.85

/**
 * ท่าของเครื่องเป็นโต๊ะทำงาน (ใช้ร่วมกันสองแคนวาส): x y = กลางเครื่องห่างกลางจอ (px · y ลง) · k = ขยายจากขนาดตั้งต้น
 * flat = ตั้งหน้าตรงแล้วแค่ไหน (มุมหงายคูณ 1 − flat) · spin = ควงรอบแกนตั้ง (บทส่งของ)
 */
export type Bench = { x: number; y: number; k: number; flat: number; spin: number; rx: number; ry: number; target: number }
const BENCH: Bench = { x: 0, y: 0, k: 1, flat: 0, spin: 0, rx: 0, ry: 0, target: 1 }
export function benchPose(b: WorkBeats, W: number, H: number): Bench {
  const e = inOut(b.bench)
  const tall = isTall(W, H)
  const base = deviceSpot.hh > 0 ? deviceSpot.hh : H * 0.3
  /* จอนอน: สูง 74% ของจอ ชิดขวา · จอตั้ง: สูง 56% ต่ำกว่ากลางนิด */
  const target = tall ? H * 0.28 : H * 0.37
  BENCH.target = target
  BENCH.k = lerp(1, target / base, e)
  BENCH.x = lerp(0, tall ? 0 : W * 0.2, e)
  BENCH.y = lerp(0, tall ? H * 0.13 : H * 0.01, e)
  BENCH.flat = e
  BENCH.spin = Math.PI * 2 * inOut((b.ship - 0.15) / 0.5)
  /* บทโค้ด: เครื่องเอนหงายเฉียงให้เห็นวิดเจ็ตที่ยกลอยเป็นชั้น แล้วกลับหน้าตรง (สองแคนวาสเอนพร้อมกัน) */
  const lean = inOut(b.code / 0.2) - inOut((b.code - 0.8) / 0.2)
  BENCH.rx = -0.62 * lean
  BENCH.ry = 0.32 * lean
  return BENCH
}

/** กรอบจอของเครื่องบนจอ (px) ณ ท่าโต๊ะทำงาน — ใช้ซ้ำ */
const SCREEN = { cx: 0, cy: 0, hw: 0, hh: 0 }
export function screenRect(b: WorkBeats, W: number, H: number) {
  const p = benchPose(b, W, H)
  SCREEN.cx = W / 2 + p.x
  SCREEN.cy = H / 2 + p.y
  SCREEN.hw = (deviceSpot.hw > 0 ? deviceSpot.hw : W * 0.12) * p.k
  SCREEN.hh = (deviceSpot.hh > 0 ? deviceSpot.hh : H * 0.3) * p.k
  return SCREEN
}

/** บทค้นคว้าแบ่งช่วง (รอบแท่นฟอง — ./BenchTokens): การ์ดเข้า · จุดข้อมูลติดทีละจุด · ออก */
export function researchPhase(r: number) {
  return {
    notes: clamp01(r / 0.24),
    emerge: clamp01((r - 0.14) / 0.16),
    select: clamp01((r - 0.3) / 0.28),
    gather: clamp01((r - 0.6) / 0.26),
    merge: clamp01((r - 0.84) / 0.16),
  }
}

/**
 * หัวเรื่อง "Here is what I do" ตอนเครื่องเป็นโต๊ะทำงาน: กลางก้อนข้อความห่างกลางจอ (px · y ลง)
 * จอนอนอยู่ซ้าย (เครื่องอยู่ขวา) · จอตั้งอยู่บนสุด — ป้ายขั้นตอน (DOM ใน ./WorkStory) วางใต้จุดนี้
 */
const HEAD = { x: 0, y: 0 }
export function headPose(W: number, H: number) {
  const tall = isTall(W, H)
  HEAD.x = tall ? 0 : -W * 0.24
  HEAD.y = tall ? -H * 0.29 : -H * 0.12
  return HEAD
}

/** ผังจอเครื่องในหน่วยผัง (สูง 820) — ของบนจอทุกชิ้นวางด้วยหน่วยนี้ คูณเข้าขนาดจอบนจอเฟรมนั้น */
export const LAYOUT_H = 820
/**
 * wireframe ของหน้าแอป: ตัวอักษรของ "Here is what I do" กลายเป็นกรอบเหล่านี้ทีละตัว แล้วลอยเข้าไปประกอบในจอเครื่อง
 * ลำดับ = ลำดับตัวอักษร · [กลาง x, กลาง y, กว้าง, สูง, รัศมี] — การ์ดสามใบกับของในการ์ดตรงกับวิดเจ็ตจริง (./BenchScreen)
 * บทออกแบบวิดเจ็ตจริงลงทับกรอบของมัน กรอบที่เหลือ (แถบหัว เส้นข้อความ) หดหาย
 */
export const WF: readonly (readonly [number, number, number, number, number])[] = [
  [-81, 236, 150, 150, 34],
  [-93, 244, 66, 76, 17],
  [0, 16, 312, 232, 38],
  [86, 64, 76, 88, 18],
  [-86, -16, 94, 22, 11],
  [-50, -56, 152, 22, 11],
  [0, -246, 312, 236, 38],
  [-38, -280, 28, 28, 8],
  [6, -238, 28, 28, 8],
  [-40, 362, 200, 20, 10],
  [96, 290, 104, 16, 8],
  [86, 258, 84, 16, 8],
  [96, 196, 104, 44, 14],
]
/** ช่วงที่ตัวอักษรตัวที่ n กลายเป็นกรอบแล้วบินลงจอ (0..1) ในบท wire — ไล่จากตัวแรก */
export const wfK = (wire: number, n: number) => inOut(clamp01((wire - (n / WF.length) * 0.45) / 0.55))
/** หัวแถบ wireframe (ช่องค้นหาของแอป) — แว่นขยายไปลงหัวแถบ caret กะพริบท้ายแถบ (เคอร์เซอร์ของหน้าโผล่จากตรงนี้) */
export const WF_HEAD = 9
