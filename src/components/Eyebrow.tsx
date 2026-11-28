import { useEffect, useRef, useState } from 'react'
import { useIntroDone } from '@/stores/intro'


/**
 * ป้ายเล็กแบบ githubuniverse.com: ตัว mono ถูก "พิมพ์" ทีละตัวตอนเลื่อนมาเห็น
 * แล้วทิ้ง block cursor เขียวกะพริบค้างไว้ท้ายบรรทัด (Eyebrow_Cursor ของเว็บต้นทาง)
 */
export function Eyebrow({ text }: { text: string }) {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const splashDone = useIntroDone()
  useEffect(() => {
    const el = ref.current
    if (!el || !splashDone) return
    let timer: ReturnType<typeof setInterval> | undefined
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || timer) return
        io.disconnect()
        timer = setInterval(() => {
          setN((v) => {
            if (v >= text.length) {
              clearInterval(timer)
              return v
            }
            return v + 1
          })
        }, 32)
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (timer) clearInterval(timer)
    }
  }, [text, splashDone])
  return (
    <span ref={ref} className="v2-eyebrow">
      {text.slice(0, n)}
      <span className="v2-caret" aria-hidden />
    </span>
  )
}
