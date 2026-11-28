import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * เห็นครั้งแรกเมื่อไร ค่อยปล่อยให้ลูก ๆ ไหลขึ้นมา (เล่นครั้งเดียว ไม่เล่นซ้ำตอน scroll กลับ)
 * คืนค่าเป็น class ที่เอาไปแปะบนกล่องแม่ — ลูกที่มี .v2-stagger จะเข้าฉากตามลำดับ --i ของตัวเอง
 */
export function useRevealed(ref: RefObject<HTMLElement | null>) {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        setSeen(true)
      },
      // threshold ต้องเป็น 0: section อย่าง works สูงกว่าจอหลายเท่า 25% ของมันไม่มีทางโผล่พร้อมกัน
      // ใช้ rootMargin หดขอบล่างแทน = เริ่มเล่นตอนหัว section ขึ้นมาพ้นครึ่งล่างของจอ
      { threshold: 0, rootMargin: '0px 0px -12% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, seen])
  return seen
}
