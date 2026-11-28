import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { AsciiDrive } from '@/components/AsciiField'

/**
 * แผงดีบักไทม์ไลน์ของอินโทร — เห็นเฉพาะตอน dev เท่านั้น (ดูที่ IntroSequence)
 *
 * มีไว้เพราะอินโทรยาวเกือบสิบวินาทีและจังหวะที่ต้องตัดสินอยู่กลางทาง การรอดูรอบละสิบ
 * วินาทีเพื่อดูเฟรมเดียวคือวิธีที่ช้าที่สุด แผงนี้ให้หยุด เลื่อนไปวินาทีที่ต้องการ และอ่านค่า
 * ที่ป้อนเข้าสนามอักขระ ณ วินาทีนั้นได้ตรง ๆ
 *
 * ค่าที่โชว์อ่านจาก ref ทุกเฟรมแล้วเขียนลง DOM ตรง ๆ ไม่ผ่าน state — ถ้าใช้ state จะเป็น
 * การรีเรนเดอร์ 24 ครั้งต่อวินาทีเพื่อโชว์ตัวเลข ซึ่งไปรบกวนสิ่งที่กำลังวัดอยู่พอดี
 */

type IntroDebugProps = {
  tl: MutableRefObject<gsap.core.Timeline | null>
  drive: MutableRefObject<AsciiDrive>
  /** กันไม่ให้อินโทรปิดตัวเองระหว่างที่กำลังส่องอยู่ */
  onHoldChange: (hold: boolean) => void
}

/** ป้ายบอกองก์ ตรงกับคอมเมนต์ในไทม์ไลน์ — กดแล้วกระโดดไปวินาทีนั้น */
const MARKS: [string, number][] = [
  ['chaos', 0],
  ['hold', 1.5],
  ['implode', 3.2],
  ['tile', 3.68],
  ['heat', 4.3],
  ['seed', 5.9],
  ['solid', 6.9],
  ['sweep', 8.5],
  ['done', 10.4],
]

const FIELDS: (keyof AsciiDrive)[] = [
  'gain',
  'guide',
  'lead',
  'build',
  'solid',
  'ink',
  'spin',
  'sweep',
]

export function IntroDebug({ tl, drive, onHoldChange }: IntroDebugProps) {
  const scrub = useRef<HTMLInputElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const vals = useRef<Record<string, HTMLSpanElement | null>>({})
  /** ผู้ใช้กำลังลากแถบอยู่หรือเปล่า — ระหว่างลากห้ามเขียนทับตำแหน่งแถบ */
  const dragging = useRef(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const t = tl.current
      if (!t) return
      if (clock.current) clock.current.textContent = `${t.time().toFixed(2)} / ${t.duration().toFixed(2)}s`
      if (scrub.current && !dragging.current) {
        scrub.current.max = String(t.duration())
        scrub.current.value = String(t.time())
      }
      for (const f of FIELDS) {
        const el = vals.current[f]
        if (el) el.textContent = drive.current[f].toFixed(2)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [tl, drive])

  const seek = (v: number) => {
    const t = tl.current
    if (!t) return
    t.pause()
    t.time(v)
  }

  return (
    <div
      className="intro-debug"
      // คลิกในแผงต้องไม่ถูกนับเป็น "ข้ามอินโทร" — ดูตัวดักใน IntroSequence
      data-intro-debug=""
    >
      <div className="intro-debug-row">
        <button type="button" onClick={() => tl.current?.play()}>
          ▶
        </button>
        <button type="button" onClick={() => tl.current?.pause()}>
          ❚❚
        </button>
        {[0.1, 0.25, 1].map((r) => (
          <button key={r} type="button" onClick={() => tl.current?.timeScale(r)}>
            {r}×
          </button>
        ))}
        <span ref={clock} className="intro-debug-clock" />
        <label className="intro-debug-hold">
          <input type="checkbox" onChange={(e) => onHoldChange(e.currentTarget.checked)} />
          hold
        </label>
      </div>

      <input
        ref={scrub}
        className="intro-debug-scrub"
        type="range"
        min={0}
        max={10}
        step={0.01}
        defaultValue={0}
        onPointerDown={() => (dragging.current = true)}
        onPointerUp={() => (dragging.current = false)}
        onChange={(e) => seek(Number(e.currentTarget.value))}
      />

      <div className="intro-debug-row">
        {MARKS.map(([name, at]) => (
          <button key={name} type="button" onClick={() => seek(at)}>
            {name}
          </button>
        ))}
      </div>

      <div className="intro-debug-vals">
        {FIELDS.map((f) => (
          <span key={f}>
            {f}
            <span
              ref={(el) => {
                vals.current[f] = el
              }}
            />
          </span>
        ))}
      </div>
    </div>
  )
}
