/**
 * ที่อยู่ของบานหน้าต่าง "บนจอ" (พิกเซล CSS) — สปแลชอ่านค่านี้ไปเป็นเป้าของการมอร์ฟ
 *
 * ตัวอักษร J O E ของสปแลชเป็น HTML/SVG ส่วนบานเป็นเมชใน 3D คนละบัฟเฟอร์กัน จะมอร์ฟ
 * รูปข้ามกันได้ต้องรู้ว่าบานไปตกที่พิกเซลไหน — ฉากเป็นคนตอบ เพราะมันรู้กล้อง มุมกลุ่ม
 * และขนาดบานจริง (สปแลชเดาเองเมื่อไรก็คลาดทันทีที่ใครลากสไลเดอร์ผัง)
 *
 * want = มีคนรออยู่ไหม (ไม่มีคนรอ ฉากไม่ต้องเสียเวลาฉายพิกัดทุกเฟรม)
 */
/** @type {{ want: boolean, ready: boolean, rects: { x: number, y: number, w: number, h: number }[], radius: number, ticks?: number }} */
export const panelScreen = { want: false, ready: false, rects: [], radius: 0 }

if (import.meta.env.DEV) window.__panels = panelScreen
