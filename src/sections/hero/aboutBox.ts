/**
 * กรอบเนื้อหาของพาเนลบนจอ (px) + จุดไอคอนบนหัวพาเนล (นับจากกรอบ) + ท่าของเรื่อง:
 * k = ไอคอนขยายเป็นหัว · xray = หมุนแล้ว morph เป็นกองชั้น · stack = ชั้นแยกเป็นแผนผัง · page = ชั้นที่ไฮไลต์ · back = กลับเป็นหัว
 */
export const aboutBox = {
  show: false,
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  iconX: 0,
  iconY: 0,
  iconH: 26,
  k: 0,
  xray: 0,
  stack: 0,
  page: 0,
  back: 0,
  /** เรื่องตัวละครโผล่จากฟองแชท (ดู BEAT.emerge/diagram) — กรอบ = ทั้งจอ */
  chat: false,
  emerge: 0,
  quad: 0,
  /** กลางฟองบนจอ (px) และความสูงฟอง */
  bx: 0,
  by: 0,
  bh: 0,
  /** มุมแผนผังบนจอ (px, TL TR BR BL) */
  qc: new Float32Array(8),
}

/** ปลายเลนส์กล้องสองตาของตัวละคร (ดู AboutBody) — ลำแสงของ AboutWidgets ตั้งต้นจากจุดนี้บนจอ */
export const aboutLens: { obj: import('three').Object3D | null } = { obj: null }

/**
 * เรื่องของ About me หลังโบกทัก: 'window' = การ์ดฟ้าถูกดึงมุมเป็นหน้าต่างบิด มุมเป็นชื่อสกิล ข้างในเล่าทีละสกิล
 * · 'binoc' = หันไปส่องกล้องสองตา ลำแสงเปิดให้เห็นของลอย (เรื่องก่อนหน้า เก็บไว้สลับกลับ)
 */
export const ABOUT_STORY: 'window' | 'binoc' = 'window'

/**
 * มุมหน้าต่างเฟรมนี้ (พิกเซลในกรอบเนื้อหา จุดเริ่มซ้ายบน แกน y ชี้ลง — TL, TR, BR, BL) + ความเป็นหน้าต่าง m (0 = การ์ด, 1 = หน้าต่างบิด)
 * AboutWidgets เขียน · ป้ายกับจุดจับ (AboutTags) อ่าน
 */
export const aboutQuad = { c: new Float32Array(8), m: 0, pull: new Float32Array(4) }

/**
 * ระนาบตัดเฉพาะตัวละคร (เรื่องโผล่จากฟอง) — ตัวละครเท่านั้นที่ถูกตัด ของในหน้าต่างไม่โดน
 * AboutFigure ตั้ง · AboutBody ใส่ให้วัสดุของตัวละครเฉพาะตอนวาด (วัสดุแชร์กับ hero — คืนค่าหลังวาด)
 */
export const aboutClip: { planes: import('three').Plane[] } = { planes: [] }

/**
 * ของที่โผล่จากฟองแชทหลัง "Here is what I do": 'cube' = กล่องแก้วหมุนลอยออกมา แตกชิ้นเล่าทีละสกิล (ดู AboutCube)
 * · 'head' = หัวตัวละครโผล่ แล้วฟองหลอมเป็นแผนผังสกิล (เรื่องก่อนหน้า)
 */
export const CHAT_ITEM: 'cube' | 'head' | 'globe' = 'globe'

/** ตำแหน่งกล่องบนจอเฟรมนี้ (px) + ขนาด — ป้ายสกิล (AboutTags) วางข้างกล่องตามนี้ */
export const aboutCubeBox = { x: 0, y: 0, size: 0, on: 0 }

/**
 * ฟองหลอมเป็นแผนผังสกิล (หน้าต่างบิด) หลังของโผล่ — ปิด: ฟองคงเป็นฟอง ไม่หลอม ไม่ปูดตามของที่โผล่
 * ป้ายสกิลเรียงข้างของที่โผล่แทน (AboutTags)
 */
export const DIAGRAM_MORPH = false

/**
 * เรื่องโลก (CHAT_ITEM 'globe'): มุมของกระเบื้อง "บ้าน" บนลูกโลกบนจอ (px, y ลง TL TR BR BL) — AboutGlobe เขียนทุกเฟรม
 * ฟองแชทหลอมเป็นกระเบื้องแผ่นนี้ (BubbleTraveler ใช้เป็นมุมปลายทาง) · ok = เขียนแล้วอย่างน้อยหนึ่งครั้ง
 */
export const globeTarget = { c: new Float32Array(8), ok: false }
