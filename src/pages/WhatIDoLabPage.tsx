import { WhatIDoRender } from '@/sections/whatidorender/WhatIDoRender'

/**
 * หน้าโล่งสำหรับปั้นจอ "สิ่งที่ทำ" แบบเรนเดอร์ — แยกจาก /2026-final ไว้ก่อน จะได้ดูจอเดียว
 *
 * ต่อหัวท้ายด้วยที่ว่างสีเดียวกับพื้นจอ: เลื่อนเข้า-ออกแล้วเห็นว่าจอเริ่ม/จบตรงไหน
 */
export function WhatIDoLabPage() {
  return (
    <main className="w-full" style={{ background: '#e8eaf0' }}>
      <div className="h-[40svh]" />
      <WhatIDoRender />
      <div className="h-[60svh]" />
    </main>
  )
}
