import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * เพดานเฟรมของฉากที่วาดต่อเนื่อง (ค่าตั้งต้น 60 fps)
 *
 * frameloop "always" วาดตามรอบรีเฟรชของจอ — จอ 144/165/240 Hz วาดเต็มความละเอียด 144+ ครั้งต่อวินาที
 * ภาพไม่ต่างจาก 60 แต่ GPU ทำงานเกินสองเท่า (วัดบน RTX 5070: เว็บกินมากกว่าเกมที่ล็อก fps ไว้)
 * PerformanceMonitor ลด dpr เฉพาะตอนเฟรมตก — เครื่องแรงไม่ตก จึงไม่ช่วยตรงนี้
 *
 * ใช้คู่กับ <Canvas frameloop="never"> — ตัวนี้เดิน rAF เองแล้วสั่ง advance (หน่วยวินาที) เมื่อถึงรอบ
 * (คลาดได้ครึ่งเฟรมของจอ: ถึงรอบเมื่อเลยมา ≥ 1000/fps − 2 ms ไม่งั้นจอ 60 Hz จะหลุดไปวาดทุกสองเฟรม)
 */
export function FrameCap({ on = true, fps = 60 }: { on?: boolean; fps?: number }) {
  const advance = useThree((s) => s.advance)
  useEffect(() => {
    if (!on) return
    let raf = 0
    let last = 0
    const step = 1000 / fps - 2
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (now - last < step) return
      last = now
      /* วินาที — frameloop never: r3f ตั้ง clock.elapsedTime = ค่าที่ส่งมาตรง ๆ (ส่ง ms = เวลาฉากเร็ว 1000 เท่า) */
      advance(now / 1000)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on, fps, advance])
  return null
}

/** ถึงรอบวาดหรือยัง (สำหรับปั๊มที่เดินเอง เช่น ticker ของ gsap) — คืน true แล้วจำเวลาไว้ */
export function frameDue(state: { last: number }, now: number, fps = 60) {
  if (now - state.last < 1000 / fps - 2) return false
  state.last = now
  return true
}
