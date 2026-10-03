/**
 * ตารางจังหวะของฟ้าเหนือหมอกใน What I do — ใช้ร่วมกันระหว่างฟองคำพูด (hero/BubbleTraveler) กับฉาก
 * (./SkyScene) หน่วยเป็น "จอที่เลื่อนเข้ามาใน section แล้ว" (sv2) ไม่ใช่สัดส่วน
 * ทุกบทได้ระยะเลื่อนของตัวเองเต็ม ๆ อ่านทันแม้เลื่อนเร็ว
 *
 * แต่ละบท = [เริ่ม, ยาว]
 */
export const BEAT = {
  greet: [0.05, 0.75], // พิมพ์ "Hello, I'm Joe"
  erase: [1.2, 0.3], // ค้างให้อ่านแล้วลบทีละตัว
  line2: [1.55, 0.75], // พิมพ์ "Here is what I do"
  sprout: [2.4, 0.45], // ปุ่มกลมหนึ่งปุ่มต่อสกิลงอกออกจากท้ายฟอง (hero/LiquidBento)
  morph: [3.05, 0.9], // ปุ่มไหลลงเป็นช่อง bento เต็มจอ ฟองลอยขึ้นเป็นแถบบนสุด
} as const

/**
 * เรื่องพวงกุญแจ (หัวตัวละคร → โลโก้ → พวงกุญแจ) ต่อท้ายฟ้าใน section เดียวกัน — ปิดไว้ตอนนี้
 * ฟ้าจบที่ bento แทน เปิดคืนได้ที่นี่ที่เดียว
 */
export const KEYCHAIN = false

/** ฟ้าเหนือหมอกยาวกี่จอ — bento แตกตัวเสร็จแล้วค้างให้ดูราวครึ่งจอ ก่อนจอถัดไปดันมันขึ้นไป */
export const SKY_VH = KEYCHAIN ? 4.2 : 4.4
/** เรื่องพวงกุญแจยาวกี่จอ */
export const STORY_VH = KEYCHAIN ? 9.12 : 0
/** จอที่เลื่อนได้ทั้งหมดของ section */
export const TOTAL_VH = SKY_VH + STORY_VH
/** ความสูง section = TOTAL_VH + 1 จอ (ดู SkyStory) */
export const SECTION_VH = TOTAL_VH + 1

/** แปลงจอที่เลื่อนเข้ามา → ระยะเลื่อนของ section (0..1) */
export const pOf = (sv2: number) => sv2 / TOTAL_VH
/** ความคืบหน้าในช่วง [เริ่ม, ยาว] */
export const at = (x: number, [a, d]: readonly [number, number]) => Math.min(1, Math.max(0, (x - a) / d))

/** ระยะเลื่อนของ section ที่กล้องออกจากฟ้าลงหมอก (ไม่มีเรื่องพวงกุญแจ = ไม่ออก) */
export const SKY_LEAVE = KEYCHAIN ? (SKY_VH - 0.3) / TOTAL_VH : 2
