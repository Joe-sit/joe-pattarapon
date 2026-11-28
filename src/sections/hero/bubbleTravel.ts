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
