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
  /** บทพื้นกระเบื้อง (./GroundStage) */
  ground: number
  /** island ค้างบนฟอง ข้อความใหญ่พื้นหลังเผยทีละคำ (./WorkStory) */
  tell: number
  design: number
  code: number
  works: number
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
    ground: at(sv2, BEAT.ground),
    tell: at(sv2, BEAT.tell),
    design: at(sv2, BEAT.design),
    code: at(sv2, BEAT.code),
    works: at(sv2, BEAT.works),
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
/**
 * ท่าของพื้นกระเบื้อง (บท ground) — เมทริกซ์ 4×4 พิกัดโลก px ก่อนเพอร์สเปกทีฟ แบบเดียวกับ deviceMat
 * = ท่าฟองหงายก่อนลงจอด เลื่อนลงใต้ผิวฟอง: ระนาบ xy ของพื้นคือระนาบหน้าฟอง หน่วยท้องถิ่น = viewBox ของฟอง
 * ฟองเขียนทุกเฟรม (./BubbleTraveler) · พื้นอ่านไปวาดในแคนวาสเพอร์สเปกทีฟ (./GroundStage)
 */
/** k = กว้างของฟองในหน่วยท้องถิ่น — ขนาดกระเบื้อง/หมุดคิดจากนี้ */
export const groundMat = { e: new Float32Array(16), ok: false, k: 300 }
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
  /* อยู่กลางจอเต็มตัว — คำใหญ่ของแต่ละบท (Research / Design / Code) เป็นพื้นหลังข้างหลัง (./WorkStory) */
  BENCH.x = 0
  BENCH.y = lerp(0, tall ? H * 0.04 : H * 0.03, e)
  /* Research กับ Design เล่าในมุมหงายหลังลงจอด */
  /* บทโค้ด: เครื่องค่อย ๆ ตั้งจากมุมหงายขึ้นเป็นหน้าตรง = แอปที่ขัดเกลาเสร็จแล้ว ค้างหน้าตรงไปจนจบ */
  BENCH.flat = inOut((b.code - 0.04) / 0.4)
  BENCH.spin = Math.PI * 2 * inOut((b.ship - 0.15) / 0.5)
  BENCH.rx = 0
  BENCH.ry = 0
  return BENCH
}

/** บท Code เป็นโหมดมืด 0..1 — พื้นหลัง (./WorkStory) แก้วเครื่อง (./BubbleTraveler) การ์ด (./BenchScreen) ใช้ค่าเดียวกัน */
export const codeDark = (b: WorkBeats) => smooth(b.code / 0.1) * (1 - smooth((b.code - 0.93) / 0.07))

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

/**
 * กรอบเครื่องบนจอเฟรมนี้ (px · y ลง · กลาง + ครึ่งกว้าง/สูง + รัศมีมุม) — ฟองเขียนทุกเฟรม (./BubbleTraveler)
 * คำใหญ่ของบท (./WorkStory) เจาะตัวทึบตรงกรอบนี้ ตรงที่เครื่องบังจึงเหลือแต่เส้นขอบ
 */
export const devScreen = { cx: 0, cy: 0, hw: 0, hh: 0, r: 0, ok: false }
/**
 * เรียกทันทีหลังเครื่องได้ท่าใหม่ในเฟรมนั้น (BubbleTraveler) — ผู้ที่ต้องตามกรอบเครื่องเป๊ะ (รูของคำใหญ่ใน WorkStory)
 * ไม่ต้องรอรอบ rAF ของตัวเอง ซึ่งอาจมาก่อน/หลังกันหนึ่งเฟรม (รูเลยเหลื่อมกับเครื่อง เห็นเป็นแถบดำกระพริบตอนเครื่องขยาย)
 */
export const devHook: { fn: null | (() => void) } = { fn: null }
/**
 * ปลายบท Code: เครื่องลอยเข้าหากล้องเบา ๆ แล้ว "ชน" คำ Code ตอน CODE_HIT — คำแตกเป็น ASCII เป็นคลื่นจากจุดชน (WorkStory)
 * วิดเจ็ตกระจายออกแรงตอนชน (BenchScreen) · เครื่องลอยเริ่มก่อนชน HIT_FLY
 */
export const CODE_HIT = 0.62
export const HIT_FLY = 0.14
/**
 * ช่วงเล่มงาน (My Works) หลังวิดเจ็ตฟ้าเต็มจอ — นับเป็นหน่วยสกรอลล์ (sv2) ข้ามท้าย Code เข้าต้น Ship
 * 0 ≈ ฟ้าเต็มจอ · คลี่ 0.04–0.38 · ซูม 0.24–0.54 · ระเบิด WORKS_BOOM (BenchScreen) · คำพื้นหลัง My Works (WorkStory)
 */
/**
 * ผังคำพื้นหลัง "My Works" บนจอ (WorkStory วัดจาก DOM — px) · ตัวอักษร 3D ที่บินจากป้ายในวิดเจ็ต (BenchScreen)
 * ลงจอดตรงตำแหน่ง/ขนาดนี้แล้วส่งต่อให้คำ DOM · left = ขอบซ้ายคำ · cy = กลางบรรทัด · ox = ระยะจากซ้ายของตัวอักษร (ไม่นับช่องว่าง)
 */
export const worksWordLayout = { ok: false, left: 0, cy: 0, font: 0, ox: [] as number[] }
/** ช่วงตัวอักษรบิน (worksPost): เริ่ม · ยาว · ส่งต่อให้คำ DOM (เริ่ม · ยาว) — หลังวิดเจ็ตฟ้าจางหมด */
export const WORKS_FLY = [-0.2, 0.3] as const
export const WORKS_HAND = [0.24, 0.08] as const
export const WORKS_TEXT = 'My Works'
/** ระเบิดของเล่มงาน (worksPost): เริ่ม · ยาว — เล่มกระเด็น (BenchScreen) + แสงพุ่ง/พื้นเหลือง (WorkStory) */
export const WORKS_BOOM = [0.52, 0.36] as const
/** worksPost แบบหน่วงแล้ว (BenchScreen ตั้งทุกเฟรม) — คำ DOM ใช้ค่าเดียวกัน ส่งต่อตรงจังหวะตัวอักษร 3D */
export const worksPostSm = { v: -9 }
/**
 * section My Works ค้าง: ช่องวางไทล์งานบนจอ (แบบภาพประกอบ Essential coding apps — ไทล์ใหญ่ล้นขอบจอ กระจายรอบ ๆ
 * เว้นกลางให้ตัวละคร) — กลางไทล์ x, y (สัดส่วนจอ) · กว้าง (สัดส่วนด้านสั้นจอ) · เอียง (องศา) · ช่อง 0 = ไทล์ที่ตัวละครห้อยดึง
 */
export const TILE_SLOTS: readonly (readonly [number, number, number, number])[] = [
  /* ไทล์ที่ตัวละครห้อย — กลางจอ เหนือคำ My Works */
  [0.5, 0.14, 0.14, -6],
  /* ใหญ่ ล้นมุมทแยงกัน (ซ้ายบน · ขวาล่าง) */
  [0.05, 0.1, 0.36, 8],
  [0.95, 0.92, 0.38, -8],
  /* กลาง มุมที่เหลือ (ขวาบน · ซ้ายล่าง) */
  [0.88, 0.2, 0.22, 10],
  [0.11, 0.86, 0.24, -10],
  /* เล็ก ลอยรอบ ๆ เว้นตัวคำ */
  [0.07, 0.5, 0.12, -14],
  [0.93, 0.55, 0.13, 12],
  [0.36, 0.9, 0.11, 6],
  [0.68, 0.07, 0.1, -10],
  [0.65, 0.88, 0.12, -4],
]
/** สัดส่วนไทล์งาน (กว้าง : สูง) — ตามปก showcase หน้า Fastwork (258 × 322) */
export const TILE_ASPECT = 322 / 258
/** กล่องไทล์ช่อง i บนจอ (px) — ใช้ทั้งวางไทล์ 3D และปุ่มกด DOM */
export function slotRect(i: number, vw: number, vh: number) {
  const [x, y, w, r] = TILE_SLOTS[i]
  const ww = w * Math.min(vw, vh)
  return { cx: x * vw, cy: y * vh, w: ww, h: ww * TILE_ASPECT, rot: r }
}
/** สถานะโต้ตอบของ section My Works — DOM (WorkStory) ตั้ง hover/open · 3D (BenchScreen) วาดตาม */
export const worksUI = { hover: -1, open: -1, hold: 0 }
export const worksPost = (b: { code: number; works: number }) => (b.code - 0.86) * BEAT.code[1] + b.works * BEAT.works[1]
/** ช่วงค้างของ section My Works (worksPost): เริ่มค้าง (ไทล์ลงที่ครบ) · เริ่มออก · จบ (= ต้น Ship) */
export const WORKS_HOLD = [0.9, 2.45, (1 - 0.86) * BEAT.code[1] + BEAT.works[1]] as const

/**
 * ตำแหน่งบล็อกในแท่งแก้วของ island ในพิกัดผังจอเครื่อง (หน่วยผัง · 4 ก้อน × xyz) — ฟองเขียนทุกเฟรม (./BubbleTraveler)
 * บล็อกบินจากจุดนี้ไปเป็นกระเบื้องของ widget (./BenchScreen) ตั้งแต่ฟองลงจอดบนหัวเครื่อง
 */
export const barLayout = { e: new Float32Array(12), ok: false }
