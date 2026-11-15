/**
 * ตารางจังหวะของฟ้าเหนือหมอกใน What I do — ใช้ร่วมกันระหว่างฟองคำพูด (hero/BubbleTraveler) เรื่องร่างเครื่อง →
 * พอร์ทัล → โปรดักต์ (hero/WorkStory) กับฉาก (./SkyScene) หน่วยเป็น "จอที่เลื่อนเข้ามาใน section แล้ว" (sv2) ไม่ใช่สัดส่วน
 * ทุกบทได้ระยะเลื่อนของตัวเองเต็ม ๆ อ่านทันแม้เลื่อนเร็ว
 *
 * แต่ละบท = [เริ่ม, ยาว]
 */
export const BEAT = {
  greet: [0.05, 0.75], // พิมพ์ "Hello, I'm Joe"
  erase: [1.2, 0.3], // ค้างให้อ่านแล้วลบทีละตัว
  search: [1.3, 0.3], // ฟองคำพูดกลายเป็นช่องค้นหาแบบ Spotlight (หางหด แคปซูล แว่นขยาย เคอร์เซอร์)
  line2: [1.55, 0.75], // พิมพ์ "Here is what I do"
  /*
   * ร่างเครื่อง → พอร์ทัล → โปรดักต์ (hero/WorkStory) — ฟองคำพูดค้าง "Here is what I do" ไว้แล้วคลี่เป็นเครื่อง
   */
  lift: [2.3, 1.25], // ฟองหงายลงเป็นแท่น ข้อความลอกออกจากผิวลอยขึ้นหาคนดู
  research: [3.55, 0.5], // ข้อความ "Here is what I do" หลุดลอยขึ้นพ้นจอไป (มีน้ำหนัก เร่งขึ้นเรื่อย ๆ) ฟองหงายค้างรอเครื่อง
  /* บท tell (ข้อความใหญ่ + ฟองเลื่อนซ้าย) ปิดไว้ — ช่วงเลยระยะเลื่อนทั้งหมด จึงไม่เกิด */
  tell: [99, 1],
  /* พื้นกระเบื้อง (./GroundStage) ปิดไว้ก่อน — ช่วงเลยระยะเลื่อนทั้งหมด จึงไม่โผล่ */
  ground: [99, 1],
  morph: [3.6, 1.05], // เริ่มตอน island งอกเสร็จ — แท่นกับแว่นขยายตีลังกาลงจอดบนจอเครื่อง (เครื่องซูมเข้ามาจนจอเต็มเฟรม) แล้วค่อยซูมออกเห็นทั้งเครื่อง
  bench: [4.65, 0.8], // ไม่ตั้งตรงแล้ว — เครื่องค้างมุมหงายหลังลงจอด เล่าทุกบทในมุมนี้ (BENCH.flat 0)
  /* Research จริง: island แท่นแบบ eddie.eco ประกอบขึ้นบนการ์ดล่างของจอเครื่อง (แว่นขยาย แท่งแก้ว ต้นไม้) — ./ResearchPlatform */
  /* Research: คำใหญ่ขึ้นตั้งแต่ island งอก จบตอนบล็อกเริ่มกระจาย (Design) */
  study: [3.5, 0.85],
  /* Design เริ่มพร้อมบล็อกกระจายออกจากแท่งเป็น widget (blockFlight — ฟองลงจอดบนหัวเครื่อง) */
  design: [4.3, 0.5], // วิดเจ็ตจริงลงทับกรอบ wireframe ของมัน — จบแล้ว Code ต่อทันที
  code: [4.8, 2.1], // โหมดมืด ต้นบทแสงสแกนเติมสี · เครื่องตั้งหน้าตรงเป็นแอปเสร็จ · ท้ายบทคำ Code สลายเป็น ASCII พุ่งใส่จอ (ยาว — ให้เวลาสลาย)
  /*
   * My Works: เล่มงานคลี่ (ต่อจากท้าย Code) → ระเบิดเป็นฉากภาพประกอบ (พื้นเหลือง ลำแสง ไทล์งาน) แล้วค้างให้เลือกดูงาน
   * จบที่แถวการ์ดผลงานทแยงขึ้นขวา (คลิกการ์ด = ขยายเต็มจอ) + คำ My Works เอียงตามแถว · ท้ายบทการ์ดออก แล้ว Ship ต่อ — hero/BenchScreen · hero/WorkStory
   */
  works: [6.9, 2.6],
  ship: [9.5, 1.0], // เครื่องควงหนึ่งรอบ ไฟสถานะเขียว คลื่นวงขยาย
} as const

/**
 * ยืดระยะเลื่อนช่วง Research → Design (ข้อความลอย ฟองพลิก island งอก ลงจอด บล็อกกระจาย สแกน) ให้ช้าลง SLOW_K เท่า
 * ตารางจังหวะข้างบนยังเป็นหน่วยเดิม (sv2 ของเรื่อง) — แปลงจาก "จอที่เลื่อนจริง" ด้วย storySv2 ก่อนใช้
 */
const SLOW: readonly [number, number] = [BEAT.lift[0], BEAT.code[0]]
const SLOW_K = 1.7
/**
 * ยืดช่วง Selected Work (บท works) — งาน compile ทีละชิ้น (hero/AsciiWorks) ต้องมีระยะเลื่อนพอให้อ่านทีละงาน
 * ไม่ยืด = งานละราว 0.15 จอ เลื่อนนิดเดียวผ่านไปแล้ว
 */
const WORKS_K = 2.4
/** ช่วงที่ยืด [เริ่ม, จบ, เท่า] (หน่วย sv2 · เรียงตามลำดับ ไม่ทับกัน) */
const STRETCH: readonly (readonly [number, number, number])[] = [
  [SLOW[0], SLOW[1], SLOW_K],
  [BEAT.works[0], BEAT.works[0] + BEAT.works[1], WORKS_K],
]
/** จอที่เลื่อนจริงเพิ่มขึ้นจากการยืดทั้งหมด */
const SLOW_EXTRA = STRETCH.reduce((s, [a, b, k]) => s + (b - a) * (k - 1), 0)
/** จอที่เลื่อนจริง → sv2 ของเรื่อง (ช่วงยืดเดินช้าลง นอกช่วงเท่าเดิม) */
export function storySv2(raw: number) {
  let extra = 0
  for (const [a, b, k] of STRETCH) {
    const ra = a + extra
    if (raw <= ra) return raw - extra
    const len = (b - a) * k
    if (raw <= ra + len) return a + (raw - ra) / k
    extra += (b - a) * (k - 1)
  }
  return raw - extra
}

/**
 * เรื่องพวงกุญแจ (หัวตัวละคร → โลโก้ → พวงกุญแจ) ต่อท้ายฟ้าใน section เดียวกัน — ปิดไว้ตอนนี้
 * ฟ้าจบที่เรื่องงานล้นมือแทน เปิดคืนได้ที่นี่ที่เดียว
 */
export const KEYCHAIN = false

/** ฟ้าเหนือหมอกยาวกี่จอ — เล่าจนส่งของเสร็จแล้วค้างหน้าสุดท้ายราวครึ่งจอ ก่อนจอถัดไปดันขึ้นไป */
export const SKY_VH = KEYCHAIN ? 4.2 : 11.95 + SLOW_EXTRA
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
/** จบบทไหน (ระยะเลื่อน) */
export const endOf = ([a, d]: readonly [number, number]) => a + d

/** ระยะเลื่อนของ section ที่กล้องออกจากฟ้าลงหมอก (ไม่มีเรื่องพวงกุญแจ = ไม่ออก) */
export const SKY_LEAVE = KEYCHAIN ? (SKY_VH - 0.3) / TOTAL_VH : 2
