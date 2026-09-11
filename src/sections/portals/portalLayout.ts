/**
 * ผังบานของจอ Experiences — ค่ากลางที่ทั้งฉากและแผงจูน (dev) อ่านจากที่เดียว
 *
 * แยกออกมาจากคอมโพเนนต์เพราะแผงจูนต้องเขียนทับได้ระหว่างรัน ถ้าปล่อยเป็น const ในไฟล์ฉาก
 * การจูนจะทำได้แค่แก้โค้ดแล้วรอ reload ซึ่งเทียบมุมเอียงกับภาพอ้างอิงไม่ได้เลย
 *
 * ค่าเริ่มต้นถอดจากของจริงของ duolingo section "เรียนรู้ได้ทุกที่ทุกเวลา" (วัดจาก DOM):
 * section 1280×1317 · หัวเรื่องกลางแนวนอนที่ y 140 (10.6% ของความสูง) · แถวปุ่มที่ y 388 (29%)
 * ภาพประกอบเป็นผืนเดียว 2000×1122 วางที่ x −220 — กว้างกว่า section คือ *ล้นออกทั้งสองข้าง*
 * ตำแหน่งเครื่องทั้งสามวัดจาก *พิกเซล* ของภาพนั้น (จับกลุ่มพิกเซลเข้มของกรอบเครื่อง) ไม่ได้
 * กะจากการมอง — รอบก่อนกะเอาแล้วเครื่องซ้ายพลาดไป 150px ในแนวนอนและ 200px ในแนวตั้ง
 *   ซ้าย   กลางจอฝั่งซ้าย  center (302, 458) ขนาด 164×308
 *   กลาง   ล่างกลาง        center (554, 704) ขนาด 220×248
 *   ขวา    ล่างขวา         center (1072, 802) ขนาด 96×212 (หันข้างจัด ภาพฉายจึงแคบ)
 *
 * พิกัดข้างล่างแปลงจากตำแหน่งบนจอนั้นด้วยกรวยกล้องของฉากนี้: ที่ z 0 (camZ 25, fov 42)
 * เห็นกว้าง ±15.4 สูง ±9.6 — x = (px/1280 − 0.5)·2·15.4, y = (0.5 − py/1000)·2·9.6
 * แผงจูนเก็บของที่ลากไว้ใน localStorage — ของจริงที่ deploy ใช้ DEFAULT เสมอ
 */

export type Win = {
  /** ตำแหน่งกลางบาน (หน่วยฉาก) */
  pos: [number, number, number]
  /** มุมเอียง [ก้ม/เงย, ส่าย, หมุนหน้าบาน] เรเดียน */
  rot: [number, number, number]
  w: number
  h: number
}

/** ตัวละครที่หงายหลังเข้าไปในบาน — ตัวเดียวกับที่ใช้ทั้งเว็บ (joespresso/scene/Mascot) */
export type Guy = {
  /** บานที่ตัวละครเกาะอยู่ (ดัชนีใน wins) */
  at: number
  /** ตำแหน่งเทียบกับกลางบาน (พิกัดของบาน ไม่ใช่ของโลก — หมุนบานแล้วตัวหมุนตาม) */
  pos: [number, number, number]
  rot: [number, number, number]
  scale: number
  /** ลึกเข้าไปในบานแค่ไหนตอน "อยู่ในอีกมิติ" (ติดลบ = หลังระนาบบาน) */
  deep: number
  /** เสี้ยวของหนึ่งช่วงที่ใช้ลอยออก / ลอยข้าม / ลอยเข้า (รวมกันต้องไม่เกิน 1) */
  outAt: number
  inAt: number
}

export type PortalLayout = {
  wins: Win[]
  guy: Guy
  /** จำนวนของชิ้นเล็กที่โปรยระหว่างบาน (0 = ไม่มี) */
  props: number
  /** ความหนาของบาน — หนาพอให้เห็นหน้าข้างตอนเอียง ไม่หนาจนอ่านเป็นกล่องลอย */
  depth: number
  /** ระยะกล้อง (z) — ต้องเห็นทั้งผังในเฟรมเดียวเหมือนภาพอ้างอิง */
  camZ: number
  /** กล้องไหลไปทางบานที่ถึงคิวแค่ไหน (0 = นิ่งกลางเฟรม) */
  drift: number
}

export const DEFAULT_LAYOUT: PortalLayout = {
  wins: [
    /* ค่าที่จูนจากแผง dev แล้วยกมาเป็นค่าจริงในโค้ด (วิธีเดียวกับฉาก hero) */
    { pos: [-12.5, 2.7, 1.1], rot: [0.57, -0.61, 0.16], w: 5.8, h: 7 },
    { pos: [-6.7, -1.1, -1], rot: [0.8, 1.2, -1.18], w: 5.2, h: 6.6 },
    { pos: [-0.1, -7.2, -4.3], rot: [-0.8, 0.17, -1.2], w: 5.6, h: 7 },
    { pos: [10.8, -6.6, 0.4], rot: [0.08, -0.46, -0.2], w: 5.8, h: 7.2 },
  ],
  guy: {
    at: 0,
    pos: [-0.3, -0.9, 1.3],
    rot: [-1.15, 0.35, 0.18],
    scale: 1.1,
    deep: -4.5,
    outAt: 0.34,
    inAt: 0.66,
  },
  props: 12,
  depth: 0.3,
  camZ: 25,
  drift: 0.28,
}

const KEY = 'portals.layout.v1'

function clone(l: PortalLayout): PortalLayout {
  return {
    ...l,
    wins: l.wins.map((w) => ({ ...w, pos: [...w.pos] as Win['pos'], rot: [...w.rot] as Win['rot'] })),
    guy: { ...l.guy, pos: [...l.guy.pos] as Guy['pos'], rot: [...l.guy.rot] as Guy['rot'] },
  }
}

/**
 * ของที่ลากไว้มีผลเฉพาะตอน dev
 *
 * หน้าที่ deploy ต้องได้ผังชุดเดียวกับที่อยู่ในโค้ดเสมอ ไม่ใช่ผังที่ค้างอยู่ใน localStorage
 * ของเครื่องคนดู (ซึ่งอาจเป็นค่าที่ใครลากเล่นไว้ตอนเปิด dev บนเครื่องเดียวกัน)
 */
function load(): PortalLayout {
  if (!import.meta.env.DEV || typeof localStorage === 'undefined') return clone(DEFAULT_LAYOUT)
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return clone(DEFAULT_LAYOUT)
    const saved = JSON.parse(raw) as Partial<PortalLayout>
    const out = clone(DEFAULT_LAYOUT)
    if (typeof saved.depth === 'number') out.depth = saved.depth
    if (typeof saved.camZ === 'number') out.camZ = saved.camZ
    if (typeof saved.drift === 'number') out.drift = saved.drift
    if (typeof saved.props === 'number') out.props = saved.props
    const g = saved.guy
    if (g) {
      if (typeof g.at === 'number') out.guy.at = g.at
      if (Array.isArray(g.pos)) out.guy.pos = [...g.pos] as Guy['pos']
      if (Array.isArray(g.rot)) out.guy.rot = [...g.rot] as Guy['rot']
      if (typeof g.scale === 'number') out.guy.scale = g.scale
      if (typeof g.deep === 'number') out.guy.deep = g.deep
      if (typeof g.outAt === 'number') out.guy.outAt = g.outAt
      if (typeof g.inAt === 'number') out.guy.inAt = g.inAt
    }
    if (Array.isArray(saved.wins)) {
      saved.wins.forEach((w, i) => {
        if (!out.wins[i] || !w) return
        if (Array.isArray(w.pos)) out.wins[i].pos = [...w.pos] as Win['pos']
        if (Array.isArray(w.rot)) out.wins[i].rot = [...w.rot] as Win['rot']
        if (typeof w.w === 'number') out.wins[i].w = w.w
        if (typeof w.h === 'number') out.wins[i].h = w.h
      })
    }
    return out
  } catch {
    return clone(DEFAULT_LAYOUT)
  }
}

/**
 * ค่าที่ฉากอ่านทุกเฟรม — อ็อบเจกต์นิ่งใบเดียว ไม่ใช่ state
 *
 * ตำแหน่ง/มุมถูกอ่านใน useFrame บานจึงขยับตามสไลเดอร์ทันทีโดยไม่ต้อง re-render
 * ส่วนขนาด (w/h/depth) ต้องปั้นเรขาคณิตใหม่ — ตัวนับ `ver` เป็นตัวบอกให้ React ปั้นรอบใหม่
 */
export const layout = { ...load(), ver: 0, sel: 0 }

export function saveLayout() {
  if (!import.meta.env.DEV || typeof localStorage === 'undefined') return
  const { wins, guy, props, depth, camZ, drift } = layout
  localStorage.setItem(KEY, JSON.stringify({ wins, guy, props, depth, camZ, drift }))
}

export function resetLayout() {
  const d = clone(DEFAULT_LAYOUT)
  layout.wins = d.wins
  layout.guy = d.guy
  layout.props = d.props
  layout.depth = d.depth
  layout.camZ = d.camZ
  layout.drift = d.drift
  layout.ver += 1
  if (import.meta.env.DEV && typeof localStorage !== 'undefined') localStorage.removeItem(KEY)
}

/** ผังปัจจุบันในรูปโค้ดที่วางกลับลง DEFAULT_LAYOUT ได้ตรง ๆ */
export function layoutSource() {
  const n = (v: number) => Number(v.toFixed(2))
  const rows = layout.wins
    .map(
      (w) =>
        `    { pos: [${w.pos.map(n).join(', ')}], rot: [${w.rot
          .map((v) => Number(v.toFixed(3)))
          .join(', ')}], w: ${n(w.w)}, h: ${n(w.h)} },`,
    )
    .join('\n')
  const g = layout.guy
  const guy =
    `  guy: { at: ${g.at}, pos: [${g.pos.map(n).join(', ')}], ` +
    `rot: [${g.rot.map((v) => Number(v.toFixed(3))).join(', ')}], scale: ${n(g.scale)}, ` +
    `deep: ${n(g.deep)}, outAt: ${n(g.outAt)}, inAt: ${n(g.inAt)} },`
  return `export const DEFAULT_LAYOUT: PortalLayout = {\n  wins: [\n${rows}\n  ],\n${guy}\n  props: ${Math.round(
    layout.props,
  )},\n  depth: ${n(layout.depth)},\n  camZ: ${n(layout.camZ)},\n  drift: ${n(layout.drift)},\n}`
}
