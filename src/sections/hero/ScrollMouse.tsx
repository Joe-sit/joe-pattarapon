import { useEffect, useRef } from 'react'

/**
 * ตัวชวนเลื่อนท้ายจอแรก — เมาส์เส้นบางกับลูกล้อที่ไหลลงแล้วหาย วนเรื่อย ๆ (แบบ artpill.studio: เส้น 1px
 * มุมมนครึ่งความกว้าง ลูกล้อเป็นขีดสั้นวิ่งลงพร้อมจางเข้า-ออก 1.2 วินาที)
 *
 * เลื่อนจอแล้วหลบทันที — คำชวนที่ยังค้างหลังผู้ชมทำตามแล้วอ่านเป็นของประดับ เลื่อนกลับขึ้นบนสุดก็กลับมา
 */
export function ScrollMouse({ className = '' }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const on = () => el.toggleAttribute('data-gone', window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    /* ชั้นนอกรับท่าเปิดตัวของหน้า (className) ชั้นในหลบตอนเลื่อน — แยกกัน: แอนิเมชันเปิดตัวค้างค่า opacity ไว้ทับคลาสหลบ */
    <div className={`pointer-events-none flex justify-center ${className}`}>
      <div ref={root} className="transition-opacity duration-500 data-[gone]:opacity-0">
        <span className="sr-only">Scroll down to explore</span>
        <span aria-hidden className="flex h-[34px] w-[24px] justify-center rounded-full border-[1.5px] border-current pt-[7px]">
          <span className="block h-[8px] w-[1.5px] rounded-full bg-current motion-safe:animate-[v3-mouse-wheel_1.2s_ease-in-out_infinite]" />
        </span>
      </div>
    </div>
  )
}
