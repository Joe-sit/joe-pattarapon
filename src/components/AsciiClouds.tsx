import { useEffect, useRef } from 'react'

/**
 * เมฆตัวอักษร ASCII — ก้อนเมฆ (blob) ลอยไปมาเป็นวงลิสซาจูช้า ๆ คนละจังหวะ เนื้อเมฆเป็น noise ไหลช้า
 * ความหนาแน่นต่อช่อง → อักขระตามบันได (จาง ' .·:' → ทึบ '#%@')
 *
 * ใช้ที่ปกโปรไฟล์ Fastwork (pages/FastworkProfile — พื้นฟ้า อักขระขาว) และบท Code ของ What I do (sections/hero/WorkStory —
 * พื้นดำแสงม่วง อักขระลาเวนเดอร์) · แคนวาสวาด ~30 fps พอ (เมฆเคลื่อนช้า) · หยุดวาดเองตอนมองไม่เห็น (visibility ของบรรพบุรุษ)
 */

export type CloudBlob = {
  /** ศูนย์กลาง (สัดส่วนของพื้นที่ 0..1) */
  x: number
  y: number
  /** รัศมี (สัดส่วน) */
  rx: number
  ry: number
  /** ความหนา */
  k: number
  /** ระยะที่ลอยไปมา (สัดส่วน) · ความเร็ว (rad/วินาที) · เฟสเริ่ม */
  ax: number
  ay: number
  wx: number
  wy: number
  ph: number
}

type Props = {
  blobs: CloudBlob[]
  /** สีอักขระ "r,g,b" */
  rgb?: string
  /** ความทึบ = alpha[0] + ความหนาแน่น × alpha[1] */
  alpha?: [number, number]
  /** ตัวคูณน้ำหนักตามตำแหน่ง (0..1) — เว้นที่ให้ข้อความ/ของสำคัญ */
  mask?: (x: number, y: number) => number
  /** ขนาดคงที่ (px) — ไม่ส่ง = เต็มพื้นที่แม่ ตามขนาดจริง */
  width?: number
  height?: number
  className?: string
}

const RAMP = ' .·:-=+*#%@'
const CELL = 13

function vnoise(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const h = (a: number, b: number) => {
    const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
    return v - Math.floor(v)
  }
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = h(xi, yi)
  const b = h(xi + 1, yi)
  const c = h(xi, yi + 1)
  const d = h(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x: number, y: number) => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 5.2, y * 2.1 + 1.3) * 0.3 + vnoise(x * 4.3 + 9.1, y * 4.3 + 3.7) * 0.15

export function AsciiClouds({ blobs, rgb = '255,255,255', alpha = [0.12, 0.36], mask, width, height, className = 'pointer-events-none absolute inset-0' }: Props) {
  const cv = useRef<HTMLCanvasElement>(null)
  /* ค่าที่เปลี่ยนได้ระหว่างรัน อ่านผ่าน ref — ไม่เริ่มลูปใหม่ */
  const opts = useRef({ blobs, rgb, alpha, mask })
  opts.current = { blobs, rgb, alpha, mask }

  useEffect(() => {
    const c = cv.current
    if (!c) return
    const g = c.getContext('2d')
    if (!g) return
    let W = 0
    let H = 0
    let cols = 0
    let rows = 0
    const fit = () => {
      const w = width ?? c.parentElement?.clientWidth ?? 0
      const h = height ?? c.parentElement?.clientHeight ?? 0
      if (w === W && h === H) return
      W = w
      H = h
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.width = Math.max(1, Math.round(W * dpr))
      c.height = Math.max(1, Math.round(H * dpr))
      c.style.width = `${W}px`
      c.style.height = `${H}px`
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.font = `500 ${CELL - 1}px ui-monospace, SFMono-Regular, Menlo, monospace`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      cols = Math.ceil(W / CELL)
      rows = Math.ceil(H / CELL)
    }
    fit()
    const ro = width == null ? new ResizeObserver(fit) : null
    if (ro && c.parentElement) ro.observe(c.parentElement)

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = 0
    const t0 = performance.now()
    const draw = (now: number) => {
      raf = still ? 0 : requestAnimationFrame(draw)
      if (now - last < 33 && last) return
      /* มองไม่เห็น (ชั้นแม่ซ่อนอยู่) = ไม่ต้องวาด */
      if (!c.checkVisibility({ visibilityProperty: true })) return
      last = now
      const t = (now - t0) / 1000
      const o = opts.current
      g.clearRect(0, 0, W, H)
      const pos = o.blobs.map((b) => ({ ...b, x: b.x + Math.sin(t * b.wx + b.ph) * b.ax, y: b.y + Math.cos(t * b.wy + b.ph * 1.7) * b.ay }))
      for (let r = 0; r < rows; r++) {
        const y = r / rows
        for (let q = 0; q < cols; q++) {
          const x = q / cols
          let wgt = 0
          for (const b of pos) wgt += Math.max(0, 1 - Math.hypot((x - b.x) / b.rx, (y - b.y) / b.ry)) * b.k
          wgt = Math.min(1, wgt) * (o.mask ? o.mask(x, y) : 1)
          if (wgt <= 0.02) continue
          const n = fbm(q * 0.045 - t * 0.08, r * 0.08 + t * 0.015)
          const d = Math.min(1, Math.max(0, (n * 0.8 + wgt * 0.6 - 0.66) / 0.34))
          if (d <= 0.05) continue
          const ch = RAMP[Math.min(RAMP.length - 1, Math.floor(d * RAMP.length))]
          if (ch === ' ') continue
          g.fillStyle = `rgba(${o.rgb},${(o.alpha[0] + d * o.alpha[1]).toFixed(3)})`
          g.fillText(ch, q * CELL + CELL / 2, r * CELL + CELL / 2)
        }
      }
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [width, height])

  return <canvas ref={cv} className={className} aria-hidden />
}
