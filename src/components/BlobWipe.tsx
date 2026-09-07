import { useEffect, useRef } from 'react'

/**
 * ม่านของเหลว — จอถัดไปไหลขึ้นมากลบจอแรกด้วยขอบหยักโค้ง ไม่ใช่ขอบตรง
 *
 * ขอบตรงที่กวาดผ่านฉาก 3D อ่านเป็น "แผ่นทึบเลื่อนมาทับ" (เห็นเป็นเส้นคาดขวางจอ) ส่วนขอบ
 * โค้งที่ยอดคลื่นสูงต่ำไม่เท่ากันอ่านเป็นของไหลที่ท่วมขึ้นมา — เป็นการเปลี่ยนฉากในตัวมันเอง
 * ไม่ใช่แค่การบัง
 *
 * แอมพลิจูดของคลื่นสูงสุดตอนกลางทางแล้วแบนราบตอนจบ: ถ้าคลื่นยังหยักอยู่ตอนท่วมเต็ม
 * ขอบบนจะโผล่เป็นหยักค้างอยู่ที่ขอบจอ ซึ่งอ่านเป็นข้อผิดพลาดมากกว่าการออกแบบ
 *
 * เขียน d ลง path ตรง ๆ ใน rAF ไม่ผ่าน state — ค่านี้เปลี่ยนทุกเฟรมที่เลื่อนจอ
 */

/** ยอดคลื่น: [ตำแหน่ง x (0..100), ความสูงสัมพัทธ์, ความเร็วการไหลตามแนวนอน] */
const HUMPS = [
  [0, 0.55, 0.9],
  [26, 1, -1.4],
  [54, 0.42, 1.2],
  [78, 0.85, -0.8],
  [100, 0.5, 1.0],
]

/** ส่วนสูงของคลื่นเทียบความสูงจอ (หน่วย viewBox) */
const AMP = 22

export function BlobWipe({ color = 'var(--v3-blue)' }: { color?: string }) {
  const path = useRef<SVGPathElement>(null)

  useEffect(() => {
    let raf = 0
    const draw = () => {
      raf = 0
      const el = path.current
      if (!el) return
      const vh = window.innerHeight || 1
      // ท่วมจบพอดีตอนเลื่อนครบเกือบหนึ่งจอ — จอถัดไปเริ่มโผล่ตรงนั้น
      const q = Math.min(1, Math.max(0, window.scrollY / (vh * 0.92)))
      const ease = q * q * (3 - 2 * q)
      // คลื่นแรงสุดกลางทาง แบนสนิทตอนจบ
      const amp = Math.sin(Math.PI * q) * AMP
      const base = 100 - ease * (100 + AMP)
      const pts = HUMPS.map(([x, h, sp]) => {
        const dx = Math.sin(q * Math.PI * (sp as number)) * 6
        return [(x as number) + (x === 0 || x === 100 ? 0 : dx), base - (h as number) * amp]
      })
      let d = `M0,${pts[0][1].toFixed(2)}`
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i]
        const [x1, y1] = pts[i + 1]
        // เส้นโค้งลูกบาศก์ที่จุดควบคุมอยู่กึ่งกลางแนวนอน — ยอดคลื่นจึงมนและต่อกันเรียบ
        const mx = (x0 + x1) / 2
        d += ` C${mx.toFixed(2)},${y0.toFixed(2)} ${mx.toFixed(2)},${y1.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`
      }
      d += ' L100,110 L0,110 Z'
      el.setAttribute('d', d)
      el.style.opacity = q > 0.001 ? '1' : '0'
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    draw()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path ref={path} d="M0,110 L100,110 Z" fill={color} />
    </svg>
  )
}
