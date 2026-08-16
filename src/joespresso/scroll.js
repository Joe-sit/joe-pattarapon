// scroll progress ที่แชร์ระหว่าง DOM (Page) กับ Canvas (CameraRig, Mascot, SceneFill)
//
// เรื่องบนหน้านี้เล่าเป็น "บีต" ต่อกันไปตามราง ไม่ใช่สองครึ่งเท่า ๆ กันแบบเดิม
// แต่ละบีตกินช่วงหนึ่งของราง แล้วถูก map เป็น 0..1 ของตัวเอง — ทับกันได้ตั้งใจ
// (กล้องเริ่มดันเข้าไปตั้งแต่ยังดื่มไม่จบ ตาเริ่มโตก่อนสีจะคลุม) การเล่าเรื่องจะได้ไม่เป็นขั้นบันได
//
// แก้ลำดับ/ความยาวของเรื่องที่ตารางนี้ที่เดียว — CSS อ่านผ่านตัวแปร --b-<ชื่อ>
// ส่วนโค้ดใน Canvas อ่านผ่าน scrollState.b.<ชื่อ>
// ถ้าเพิ่มบีต ต้องขยาย height ของ .jp-scroll ใน page.css ด้วย ไม่งั้นทุกบีตสั้นลงเท่า ๆ กัน
export const BEATS = [
  // การ์ด hero ขยายเต็มจอ + กล้องวนไป focus mascot
  ['focus', 0.0, 0.22],
  // ยกแก้วขึ้นดื่ม
  ['sip', 0.22, 0.52],
  // กล้องดันเข้าใกล้ บีบ fov + เพิ่มความโค้งเลนส์ — ภาพอึดอัดขึ้นเรื่อย ๆ
  ['zoom', 0.4, 0.72],
  // ตาโตขึ้นแบบการ์ตูน + แสงสะท้อนในตา
  ['eyes', 0.5, 0.74],
  // หมอกหุบเข้าหากล้อง พร้อมไล่พื้นหลังเป็นสีเอสเปรสโซ — ทั้งฉากละลายเป็นสีเดียว
  ['fill', 0.68, 0.9],
  // บรรทัดส่งต่อ
  ['line', 0.86, 1.0],
  // เนื้อหา About me โผล่ทีละคำในครึ่งขวาที่ว่างอยู่ระหว่างยกแก้วดื่ม
  // จบก่อนบีต fill เพราะพอหมอกคลุมเป็นสีเอสเปรสโซแล้ว ตัวหนังสือสีเข้มบนพื้นเข้มก็อ่านไม่ออก
  ['about', 0.3, 0.62],
]

/** ค่าปัจจุบันของทุกบีต — mutate ทุกครั้งที่ scroll ไม่ใช่ React state (ไม่งั้น re-render ทุกเฟรม) */
export const scrollState = {
  raw: 0,
  b: Object.fromEntries(BEATS.map(([name]) => [name, 0])),
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** ตัดช่วง [a,b] ของรางออกมาเป็น 0..1 ของตัวเอง */
export const seg = (raw, a, b) => clamp01((raw - a) / (b - a))

/**
 * อัปเดต scrollState จากตำแหน่ง scroll ดิบ แล้วคืนรายการตัวแปร CSS ที่ต้องเขียน
 * แยกจาก DOM เพื่อให้เทสได้ และเพื่อให้ฝั่ง Canvas เรียกเองได้โดยไม่ต้องพึ่ง Page
 */
export function updateBeats(raw) {
  scrollState.raw = clamp01(raw)
  const vars = []
  for (const [name, a, b] of BEATS) {
    const v = seg(scrollState.raw, a, b)
    scrollState.b[name] = v
    vars.push([`--b-${name}`, v.toFixed(4)])
  }
  return vars
}

/** คืนค่าทุกบีตเป็นศูนย์ตอนออกจากหน้า */
export function resetBeats() {
  scrollState.raw = 0
  for (const [name] of BEATS) scrollState.b[name] = 0
}
