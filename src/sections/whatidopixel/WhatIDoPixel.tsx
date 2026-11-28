import { Suspense, lazy, useEffect, useRef, useState } from 'react'

/**
 * จอ "สิ่งที่ทำ" — พอร์ทัลพิกเซลกลางเฟรม มองเห็นตัวละครอยู่ข้างใน
 *
 * รูปพอร์ทัลถอดจากแบบ (Figma node 12799:2) ไม่ได้กะเอง: ตาราง 6×10 ช่อง (แบบเป็นสีฟ้า
 * #0731e5 จอนี้ใช้สีส้มของโลโก้ #fd5000 แทน ดู ORANGE ใน PixelStage)
 * — ดู PORTAL ใน PixelStage ตัวละครคือของ hero (HeroRider) ยืนท่าปกติ ไม่มีสเก็ตบอร์ด
 *
 * พื้นขาวของจอนี้ประกาศเอง ไม่ได้ใช้ .v2-theme (ธีมนั้นมืด #0e1116 ซึ่งกลืนรูปทั้งหมด
 * ของแบบที่เป็นพื้นขาวจัด)
 *
 * ตอนนี้ยังไม่มีตัวหนังสือและของตกแต่งในจอ (ถอดออกชั่วคราวตามที่สั่ง) ข้อความสกิลอยู่ที่
 * sections/whatido และที่วางของสกิลอยู่ที่ ./pixelStory พร้อมเอากลับมา
 */

const PixelStage = lazy(() => import('./PixelStage').then((m) => ({ default: m.PixelStage })))
/** แผงจูน (dev) — โหลดแยกก้อน หน้าที่ deploy ไม่ได้ลากโค้ดนี้ไปด้วย */
const PixelTuner = lazy(() => import('./PixelTuner').then((m) => ({ default: m.PixelTuner })))

export function WhatIDoPixel({ id = 'what-i-do' }: { id?: string }) {
  const stage = useRef<HTMLDivElement>(null)
  const section = useRef<HTMLElement>(null)
  /**
   * จออยู่ในสายตาหรือยัง — เป็นทั้งสวิตช์ลูปวาดและตัวสั่งเริ่มจังหวะที่บล็อกยื่นออก
   *
   * พ้นจอแล้วเวลารีเซ็ต เลื่อนกลับมาจึงได้ดูการก่อตัวใหม่ ไม่ใช่เจอพอร์ทัลที่ประกอบเสร็จแล้ว
   */
  const [live, setLive] = useState(false)

  useEffect(() => {
    const el = section.current
    if (!el) return
    const io = new IntersectionObserver((es) => setLive(es[0].isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section
      id={id}
      data-screen={id}
      ref={section}
      className="relative h-[100svh] w-full overflow-clip bg-[#ffffff] text-[#0b0d12]"
    >
      <div ref={stage} className="pointer-events-none absolute inset-0">
        <Suspense fallback={null}>
          <PixelStage live={live} />
        </Suspense>
      </div>

      {import.meta.env.DEV && live && (
        <Suspense fallback={null}>
          <PixelTuner />
        </Suspense>
      )}
    </section>
  )
}
