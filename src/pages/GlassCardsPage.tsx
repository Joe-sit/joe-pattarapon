import { GlassCards } from '@/sections/glasscards/GlassCards'

/**
 * หน้าโล่งสำหรับปั้น section การ์ดกระจก — แยกจาก /2026-final ไว้ก่อนตามที่สั่ง
 *
 * ไม่มี nav ไม่มีสปแลช ไม่มี lenis: จอนี้ยังไม่ผูกกับจังหวะเลื่อนของหน้าไหน จะได้ดูของ
 * ชิ้นเดียวโดยไม่ต้องรออย่างอื่นโหลด เมื่อไรที่ท่าลงตัวแล้วค่อยย้าย `<GlassCards />`
 * ไปเสียบในหน้าจริง (ตัว section ไม่รู้จักหน้า ไม่มีอะไรต้องแก้ตอนย้าย)
 *
 * ต่อท้ายจอด้วยที่ว่างหนึ่งจอ เพื่อให้เลื่อนลง-ขึ้นแล้วเห็นท่าเข้าฉากซ้ำได้
 */
export function GlassCardsPage() {
  return (
    <main className="min-h-svh w-full bg-white">
      <div className="flex min-h-svh items-center px-[4vw] py-[6vh]">
        <GlassCards />
      </div>
    </main>
  )
}
