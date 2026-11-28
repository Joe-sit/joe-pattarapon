import type Lenis from '@studio-freight/lenis'

/**
 * ตัว Lenis ของหน้า (สร้างใน App) — ให้ของที่ต้องหยุด/สั่งเลื่อนเองเข้าถึงได้ (เช่นด่านหนังสติ๊กท้าย Selected Work)
 * window.scrollTo อย่างเดียวไม่พอ: Lenis คุมตำแหน่งจริงและดึงกลับในเฟรมถัดไป
 */
export const lenisBox: { l: Lenis | null } = { l: null }
