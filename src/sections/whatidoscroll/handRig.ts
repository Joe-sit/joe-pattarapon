/**
 * มือโบก — **ประกอบจากทรงพื้นฐาน ชิ้นละกระดูก**
 *
 * ไม่มีพาธเก็บไว้ที่ไหนเลย: มือคือ *กองสี่เหลี่ยมมน* สิบสองชิ้น แต่ละชิ้นเป็นกระดูกหนึ่งท่อน
 * ที่รู้จุดศูนย์ ขนาด มุม และรัศมีมุมของตัวเอง ทุกค่าคิดจากท่า (`HandPose`) — งอนิ้วแล้วชิ้น
 * ของนิ้วนั้นหมุนและเลื่อนตามข้อจริง ไม่ใช่รูปเดียวที่ถูกเมทริกซ์ครอบไว้
 *
 * ### ทำไมซ้อนกันได้ไม่เห็นรอย
 *
 * ทุกชิ้นสีเดียวกันและทึบ เงารวมจึงเป็นรูปเดียว — ไม่ต้องคิด union ของรูปทรง ไม่ต้องมีตัวกรอง
 * ส่วนที่ทับกันคือ *ข้อต่อ*: ปลายท่อนโคนกับต้นท่อนปลายทับกันไว้เสมอ ข้อจึงไม่แยกออกตอนงอ
 * (ถ้าต่อชนกันพอดี จะเห็นรอยผ่าที่ข้อทุกครั้งที่งอ)
 *
 * ### โครง
 *
 * ข้อมืออยู่จุดกำเนิด แกน y ชี้ขึ้น (พลิกเป็นพิกัดจอตอนจัดลงกล่อง) ฝ่ามือสองชิ้น (ฝ่ามือ +
 * สันมือที่แคบกว่า ได้ความสอบของข้อมือโดยไม่ต้องมีรูปคางหมู) สี่นิ้วชิ้นละสองท่อน และ
 * นิ้วโป้งสองท่อน
 *
 * สัดส่วนเลียนจากโหนด 12827:62 ของไฟล์แบบ วัดความใกล้ด้วย IoU ของเงาสองรูป ไม่ใช่กะด้วยตา:
 * นิ้วในแบบแทบไม่สอบ (กว้าง 82–104px เท่ากันตลอดนิ้ว) และนิ้วโป้งยื่นพ้นฝ่ามือไปทางซ้ายแค่
 * ~116px
 */

export type Finger = {
  /** โคนนิ้วบนแนวข้อนิ้ว (หน่วยของมือ) */
  base: [number, number]
  /** มุมกางตั้งต้นจากแนวตั้ง — ลบ = เอนไปทางซ้าย */
  splay: number
  /** ความยาวกระดูกสองท่อน */
  bones: [number, number]
  /** ความกว้างของท่อนโคนและท่อนปลาย */
  widths: [number, number]
}

const PALM = {
  /** ครึ่งความกว้างที่ข้อมือ และที่แนวข้อนิ้ว */
  wristHalf: 240,
  knuckleHalf: 300,
  /** ความสูงจากข้อมือถึงแนวข้อนิ้ว */
  height: 430,
  /** ฝ่ามือเอนไปทางขวาเท่าไร */
  lean: 18,
  /** รัศมีมุมของชิ้นฝ่ามือ — แบบวาดมุมเกือบเหลี่ยม ค่านี้จึงเล็ก */
  round: 24,
}

/**
 * นิ้วต้อง **แคบกว่าระยะห่างระหว่างโคนนิ้ว** ไม่งั้นชิ้นทับกันจนร่องหาย
 *
 * ในแบบนิ้วกว้าง 82–104px และห่างกันราว 98px — นิ้วเกือบชิดกัน ร่องระหว่างนิ้วเป็นรอยผ่า
 * บาง ๆ ไม่ใช่ช่องกว้าง ที่นี่โคนนิ้วห่างกัน ~148 หน่วย จึงให้นิ้วกว้าง 130 เหลือรอยผ่า ~18
 * (รอบก่อนให้ 152 ผลคือทั้งมือกลายเป็นก้อนสี่เหลี่ยมก้อนเดียว ไม่เห็นนิ้ว)
 */
const FINGERS: Finger[] = [
  { base: [-215, 424], splay: -22, bones: [206, 190], widths: [132, 124] },
  { base: [-70, 452], splay: -14, bones: [214, 198], widths: [130, 122] },
  { base: [80, 460], splay: -5, bones: [218, 202], widths: [128, 120] },
  { base: [235, 452], splay: 4, bones: [220, 204], widths: [132, 126] },
]

/** นิ้วโป้ง — สั้นและหนา ยื่นพ้นฝ่ามือไปทางซ้ายพอ ๆ กับที่แบบวาด */
const THUMB: Finger = {
  base: [-215, 170],
  splay: -100,
  bones: [100, 61],
  widths: [185, 150],
}

/** ชิ้นส่วนหนึ่งชิ้น — สี่เหลี่ยมมนที่รู้จุดศูนย์ ขนาด มุม และรัศมีมุมของตัวเอง */
export type Part = {
  cx: number
  cy: number
  w: number
  h: number
  /** รัศมีมุม */
  r: number
  /** องศา หมุนรอบจุดศูนย์ของชิ้นเอง */
  rot: number
}

export type HandPose = {
  /** ข้อมือหมุนทั้งมือ (องศา) */
  wrist: number
  /** งอกระดูกท่อนปลายของนิ้วที่ i */
  bend: number[]
  /** กางนิ้วที่ i เพิ่มจากมุมตั้งต้น */
  spread: number[]
  /** งอนิ้วโป้ง (โคน, ปลาย) */
  thumb: [number, number]
}

export const REST_POSE: HandPose = {
  wrist: 0,
  bend: [0, 0, 0, 0],
  spread: [0, 0, 0, 0],
  thumb: [0, 0],
}

const RAD = Math.PI / 180

/**
 * ชิ้นของข้อต่อทับกันเท่านี้ — ข้อจึงไม่มีรอยผ่าตอนงอ
 *
 * โคนนิ้วทับลงไปในฝ่ามือมากกว่าข้อกลาง (`ROOT_SINK`) เพราะมุมมนของสี่เหลี่ยมสองอันที่มา
 * ชนกันพอดีจะเหลือรอยบากเล็ก ๆ ที่แนวข้อนิ้ว เห็นเป็นเส้นจาง ๆ บนจอ (เจอมาแล้ว)
 */
const OVERLAP = 30
const ROOT_SINK = 40

/**
 * สองชิ้นของหนึ่งนิ้ว — ท่อนโคนจากโคนนิ้ว และท่อนปลายที่งอต่อจากท่อนโคน
 *
 * มุมของท่อนปลายสะสมจากท่อนโคน (`a0 + bend`) เหมือนข้อนิ้วจริง ไม่ใช่ทั้งนิ้วหมุนเป็นแท่งเดียว
 */
function fingerParts(f: Finger, spread: number, bend: number): Part[] {
  const a0 = f.splay + spread
  const a1 = a0 + bend
  const dir = (deg: number): [number, number] => [Math.sin(deg * RAD), Math.cos(deg * RAD)]
  const d0 = dir(a0)
  const d1 = dir(a1)
  const j1: [number, number] = [f.base[0] + d0[0] * f.bones[0], f.base[1] + d0[1] * f.bones[0]]
  const h0 = f.bones[0] + OVERLAP + ROOT_SINK
  const h1 = f.bones[1] + OVERLAP
  return [
    {
      cx: f.base[0] + d0[0] * (h0 / 2 - ROOT_SINK),
      cy: f.base[1] + d0[1] * (h0 / 2 - ROOT_SINK),
      w: f.widths[0],
      h: h0,
      r: f.widths[0] * 0.1,
      rot: a0,
    },
    {
      cx: j1[0] + (d1[0] * (h1 - OVERLAP * 2)) / 2,
      cy: j1[1] + (d1[1] * (h1 - OVERLAP * 2)) / 2,
      w: f.widths[1],
      h: h1,
      r: f.widths[1] * 0.12,
      rot: a1,
    },
  ]
}

/**
 * มือทั้งอันเป็นรายการชิ้นส่วน — ฝ่ามือ สันมือ สี่นิ้วละสองท่อน นิ้วโป้งสองท่อน
 *
 * ลำดับคงที่เสมอ (12 ชิ้น) เพราะฝั่งที่วาดผูก `<rect>` ไว้ชิ้นละอันแล้วเขียนทับทุกเฟรม —
 * ถ้าลำดับสลับ ชิ้นจะสลับร่างกันกลางอากาศ
 */
export function handParts(pose: HandPose): Part[] {
  /**
   * ฝ่ามือชิ้นเดียว กว้างเท่าช่วงนิ้วพอดี
   *
   * เคยมีชิ้น "สันมือ" ที่แคบกว่าซ้อนอยู่ด้านล่างเพื่อให้ข้อมือสอบเข้า แต่ในแบบขอบล่างของ
   * ฝ่ามือกว้างและตรง (วัดได้ 314px ที่ y 630) ชิ้นนั้นจึงไม่ได้ทำอะไรนอกจากทำให้ขอบล่างเป็น
   * ขั้นบันได — ตัดออก เหลือ 11 ชิ้น
   *
   * ความกว้างตั้งให้ขอบซ้าย/ขวาของฝ่ามือตรงกับขอบนอกของนิ้วริมสองข้าง (±281 หน่วย) ไม่งั้น
   * นิ้วยื่นพ้นฝ่ามือเป็นเงี่ยงเล็ก ๆ ที่มุม
   */
  const palm: Part = {
    cx: PALM.lean * 0.5,
    cy: PALM.height * 0.5,
    w: 580,
    h: PALM.height,
    r: PALM.round,
    rot: 0,
  }
  const parts: Part[] = [palm]
  FINGERS.forEach((f, i) => {
    parts.push(...fingerParts(f, pose.spread[i] ?? 0, pose.bend[i] ?? 0))
  })
  parts.push(...fingerParts(THUMB, pose.thumb[0], pose.thumb[1]))
  return parts
}

/** จำนวนชิ้นของมือ — ฝั่งที่วาดใช้ผูก element ไว้ล่วงหน้า */
export const HAND_PARTS = handParts(REST_POSE).length

/**
 * ท่าโบก ณ เวลาหนึ่ง — คลื่นเดียววิ่งจากข้อมือออกไปปลายนิ้ว
 *
 * ข้อมือแกว่งด้วยไซน์ ส่วนนิ้วใช้ไซน์ตัวเดียวกันแต่ *หน่วงเฟส* ไล่จากนิ้วซ้ายไปขวา (`lag`)
 * และแอมพลิจูดเป็นสัดส่วนของข้อมือ (`curl`) นิ้วจึงตามข้อมือมาเป็นระลอก ไม่ใช่แข็งเป็นแผ่น
 * เดียว — การกางใช้เฟสเหลื่อมอีกครึ่งจังหวะ มือเปิดตอนกวาดออก หุบตอนกวาดกลับ
 */
export function wavePose(
  t: number,
  amp: number,
  freq: number,
  lag: number,
  curl: number,
): HandPose {
  const om = t * freq * Math.PI * 2
  const bend: number[] = []
  const spread: number[] = []
  for (let i = 0; i < FINGERS.length; i += 1) {
    const ph = om - lag * (i + 1) * 0.45
    bend.push(amp * curl * Math.sin(ph))
    spread.push(amp * curl * 0.45 * Math.sin(ph - 0.5) * (i - 1.5) * 0.5)
  }
  return {
    wrist: amp * Math.sin(om),
    bend,
    spread,
    thumb: [
      amp * curl * 0.5 * Math.sin(om - lag * 1.6),
      amp * curl * 0.3 * Math.sin(om - lag * 2),
    ],
  }
}

/** มุมทั้งสี่ของชิ้นหนึ่ง (หมุนแล้ว) — ใช้หากรอบครอบของมือ */
function corners(p: Part): [number, number][] {
  const a = p.rot * RAD
  const s = Math.sin(a)
  const c = Math.cos(a)
  const hw = p.w / 2
  const hh = p.h / 2
  return (
    [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ] as [number, number][]
  ).map(([x, y]) => [p.cx + x * c - y * s, p.cy + x * s + y * c] as [number, number])
}

function boundsOf(parts: Part[]) {
  const pts = parts.flatMap(corners)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

const REST_BOUNDS = boundsOf(handParts(REST_POSE))

/**
 * ชิ้นส่วนในพิกัดกรอบแบบ — หมุนทั้งมือรอบข้อมือ แล้วจัดลงกล่องที่ให้มา
 *
 * **กรอบที่ใช้จัดคือกรอบของท่าพัก ไม่ใช่กรอบของท่าปัจจุบัน** ไม่งั้นมือจะถูกย่อ/ขยายทุกเฟรม
 * ให้พอดีกล่องขณะโบก ซึ่งอ่านเป็นการซูมเข้าออก ไม่ใช่การโบก
 *
 * แกน y พลิกที่นี่ทีเดียว (โครงคิดแบบ y ขึ้น จอคิดแบบ y ลง) การพลิกทำให้ทิศหมุนกลับด้านด้วย
 * จึงคืน `rot` เป็นลบของมุมในโครง
 */
export function placedParts(
  pose: HandPose,
  box: { x: number; y: number; w: number; h: number },
): Part[] {
  const a = pose.wrist * RAD
  const s = Math.sin(a)
  const c = Math.cos(a)
  const b = REST_BOUNDS
  const k = Math.min(box.w / (b.x1 - b.x0), box.h / (b.y1 - b.y0))
  const ox = box.x + (box.w - (b.x1 - b.x0) * k) / 2
  const oy = box.y + (box.h - (b.y1 - b.y0) * k) / 2
  return handParts(pose).map((p) => {
    /* หมุนจุดศูนย์ของชิ้นรอบข้อมือ (จุดกำเนิด) แล้วบวกมุมข้อมือเข้าไปในมุมของชิ้นเอง */
    const rx = p.cx * c - p.cy * s
    const ry = p.cx * s + p.cy * c
    return {
      cx: ox + (rx - b.x0) * k,
      cy: oy + (b.y1 - ry) * k,
      w: p.w * k,
      h: p.h * k,
      r: p.r * k,
      rot: -(p.rot + pose.wrist),
    }
  })
}
