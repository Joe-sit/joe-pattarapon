/**
 * ฟองคำพูดของหัวเรื่อง "ออกเดินทาง" อยู่หรือเปล่า (ดู ./BubbleTraveler)
 *
 * ตอนเดินทาง ฟองในแคนวาสหัวเรื่องต้องหายไป ไม่งั้นเห็นสองใบ — แคนวาสนั้นวาดตามคำสั่ง
 * (frameloop demand) จึงต้องมีคนบอกให้วาดใหม่ตอนค่านี้เปลี่ยน: ผู้ฟังใน subs
 */
export const bubbleTravel = { away: false, live: false, subs: new Set<() => void>() }

export function setBubbleAway(v: boolean) {
  if (bubbleTravel.away === v) return
  bubbleTravel.away = v
  bubbleTravel.subs.forEach((f) => f())
}

export function subscribeBubbleAway(f: () => void) {
  bubbleTravel.subs.add(f)
  return () => {
    bubbleTravel.subs.delete(f)
  }
}

/**
 * ฟองในหัวเรื่องถึงคิวโชว์แล้วหรือยัง (ดู Headline3DField) — ฟองที่เดินทางเป็นฟองใบเดียวของหน้า
 * นั่งอยู่ในหัวเรื่องตั้งแต่ต้น จึงต้องรู้ว่าเมื่อไรหัวเรื่องโผล่ ไม่งั้นมันโผล่ก่อนตัวอักษร
 * โผล่แล้วค้างเป็นจริงจนฟองเดินทางถูกถอด (หัวเรื่องปิดตัวเองเมื่อพ้น hero แต่ฟองยังเดินทางต่อ)
 */
export function setHeadBubbleLive(v: boolean) {
  if (bubbleTravel.live === v) return
  bubbleTravel.live = v
  bubbleTravel.subs.forEach((f) => f())
}

/**
 * โหมดสำรับการ์ด (sections/skilldeck): ฟองที่เดินทาง (./BubbleTraveler) ไม่ไปพิมพ์ข้อความแล้ว แต่ลงไปนั่ง
 * ในช่อง "I [ฟอง] research" ของจอ What I do แล้วเป็นการ์ดที่พลิกเปลี่ยนสกิลต่อ — ใบเดียวกันตั้งแต่หัวเรื่อง
 *
 * SkillDeck เขียน (ช่องปลายทาง, สี, มุมพลิก, ขนาด) · BubbleTraveler อ่านทุกเฟรมแล้ววาดฟองแก้วตามนั้น
 * on = เปิดโหมดนี้ (SkillDeck ถูก mount) · wake = ปลุกให้ BubbleTraveler อ่านท่าใหม่ (ตอนพลิก/ย่อ ไม่มีการเลื่อน)
 */
export const deckBubble = {
  on: false,
  /** ช่องในประโยค — ฟองมานั่งทับกรอบนี้พอดี */
  slot: null as HTMLElement | null,
  /** ชั้นที่ตรึงจอของ section — ปลายทางคิดเทียบขอบบนของมัน (ตำแหน่ง "ตอนตรึงแล้ว") */
  stage: null as HTMLElement | null,
  /** ตัว section — ขอบบนของมันคือจุดที่ฟองเดินทางถึง */
  section: null as HTMLElement | null,
  /** สีของสกิลที่ฟองทาอยู่ */
  color: '#158ffc',
  /** มุมพลิกรอบแกนตั้ง (เรเดียน) */
  spinY: 0,
  /** ขนาดเทียบช่อง 0..1 — ยุบหายตอนการ์ดงานออกมาแทน ("Into [การ์ด] Products") */
  k: 1,
  /** ทาสีแก้วเป็น color ระหว่างเดินทาง 0..1 — 0 = แก้วใสตลอด (ใบเดียวกับหัวเรื่อง บนฟ้าเดียวกัน) */
  tint: 0,
  /** พิมพ์ "Hello, I'm Joe" ในฟองไปแล้วเท่าไร 0..1 (ตามการเลื่อน) */
  typeK: 0,
  /** ข้อความในฟองหายไปแล้วเท่าไร 0..1 (ตอนฟองจะกลายเป็นการ์ด) */
  textOut: 0,
  wake: null as (() => void) | null,
}
