import type { RefObject } from 'react'

/**
 * ไม้บรรทัดโค้งได้ (flexible curve ruler) — แผ่นขาวโปร่ง ขีดมิลลิเมตรตามขอบบน เลขทุกเซนติเมตร (ภาพอ้างอิง)
 *
 * ตอนแรกตรง พอเลื่อนเข้าช่วงเปลี่ยนหน้า ช่วงปลายค่อย ๆ งอลงเป็นโค้ง — เป็นท่าส่งไปบริการถัดไป
 * วาดใหม่จากเส้นแกนทุกครั้งที่ความโค้งเปลี่ยน (ไม่ใช่ภาพนิ่งยืด) ขีดกับเลขจึงเลี้ยวตามแผ่นจริง
 *
 * พิกัดท้องถิ่นของแผ่น: x ตามความยาว (ศูนย์กลางที่ 0) y ชี้ลง — วางบนระนาบเอียงเดียวกับฉาก (ดู ServiceTrack)
 */

export const RULER = {
  /** ความยาว / ความกว้างแผ่น (พิกเซลในกรอบแบบ) */
  len: 980,
  wide: 78,
  /** หนึ่งเซนติเมตรกี่พิกเซล — ขีดมิลลิเมตรทุก cm/10 */
  cm: 46,
  /** เลขตัวแรก (ภาพอ้างอิงเริ่มกลางไม้ ไม่ใช่ 0) */
  from: 11,
  /** มุมเลี้ยวรวมตอนงอสุด (เรเดียน) และช่วงที่งอ (สัดส่วนความยาว) */
  turn: 1.25,
  bendFrom: 0.42,
  bendTo: 0.86,
}
const N_NUM = Math.floor(RULER.len / RULER.cm)
const STEP = 4

export type RulerEls = {
  body: RefObject<SVGPathElement | null>
  ticks: RefObject<SVGPathElement | null>
  nums: RefObject<SVGTextElement | null>[]
}
export const rulerEls = (): RulerEls => ({ body: { current: null }, ticks: { current: null }, nums: Array.from({ length: N_NUM }, () => ({ current: null })) })

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

let lastBend = -1
/** วาดแผ่นที่ความงอ bend (0 = ตรง, 1 = งอสุด) — เรียกจากลูปอ่านการเลื่อน */
export function driveRuler(els: RulerEls, bend: number) {
  if (Math.abs(bend - lastBend) < 0.002 && els.body.current?.getAttribute('d')) return
  lastBend = bend
  const { len, wide, cm, turn, bendFrom, bendTo } = RULER
  /*
   * ความโค้งต่อหน่วยยาวเป็นรูประฆังในช่วง bendFrom..bendTo — ช่วงต้นตรงสนิท ปลายเลี้ยวลง
   * มุมรวม = ปริพันธ์ของความโค้ง (หาผลรวมทีละก้าว) ความยาวแผ่นจึงคงที่ตอนงอ ไม่ยืด
   */
  const n = Math.ceil(len / STEP)
  const xs = new Float32Array(n + 1)
  const ys = new Float32Array(n + 1)
  const as = new Float32Array(n + 1)
  let wsum = 0
  for (let i = 0; i <= n; i += 1) {
    const s = (i / n) * len
    wsum += smooth(bendFrom * len, bendTo * len, s) * (1 - smooth(bendTo * len, len, s) * 0.6)
  }
  let x = -len / 2
  let y = 0
  let a = 0
  for (let i = 0; i <= n; i += 1) {
    const s = (i / n) * len
    xs[i] = x
    ys[i] = y
    as[i] = a
    const k = smooth(bendFrom * len, bendTo * len, s) * (1 - smooth(bendTo * len, len, s) * 0.6)
    a += (bend * turn * k) / Math.max(1e-6, wsum)
    x += Math.cos(a) * (len / n)
    y += Math.sin(a) * (len / n)
  }
  /* เส้นตั้งฉาก (ชี้ขึ้นจากแกน) */
  const nx = (i: number) => Math.sin(as[i])
  const ny = (i: number) => -Math.cos(as[i])
  const h = wide / 2
  let top = ''
  let bot = ''
  for (let i = 0; i <= n; i += 1) {
    top += `${i ? 'L' : 'M'}${(xs[i] + nx(i) * h).toFixed(1)} ${(ys[i] + ny(i) * h).toFixed(1)}`
  }
  for (let i = n; i >= 0; i -= 1) bot += `L${(xs[i] - nx(i) * h).toFixed(1)} ${(ys[i] - ny(i) * h).toFixed(1)}`
  els.body.current?.setAttribute('d', `${top}${bot}Z`)

  /* ขีดตามขอบบน: มิลลิเมตรสั้น ครึ่งเซนติเมตรกลาง เซนติเมตรยาว */
  let tk = ''
  const mm = cm / 10
  for (let s = mm; s < len - 2; s += mm) {
    const i = Math.min(n, Math.round((s / len) * n))
    const m = Math.round(s / mm)
    const l = m % 10 === 0 ? 20 : m % 5 === 0 ? 14 : 8
    const ex = xs[i] + nx(i) * h
    const ey = ys[i] + ny(i) * h
    tk += `M${ex.toFixed(1)} ${ey.toFixed(1)}L${(ex - nx(i) * l).toFixed(1)} ${(ey - ny(i) * l).toFixed(1)}`
  }
  els.ticks.current?.setAttribute('d', tk)

  /* เลขใต้ขีดเซนติเมตร หมุนตามแนวแผ่น */
  els.nums.forEach((ref, j) => {
    const el = ref.current
    if (!el) return
    const s = (j + 1) * cm
    const i = Math.min(n, Math.round((s / len) * n))
    const px = xs[i] + nx(i) * (h - 34)
    const py = ys[i] + ny(i) * (h - 34)
    el.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${((as[i] * 180) / Math.PI).toFixed(2)})`)
  })
}

export function FlexRuler({ els }: { els: RulerEls }) {
  const { len, wide, from } = RULER
  /* กรอบ SVG กว้างพอให้ปลายที่งอลงไม่โดนตัด */
  const W = len + 80
  const H = len
  return (
    /* จุด (0, 0) ของแผ่น = มุมซ้ายบนของกล่องพ่อ (ซึ่งวางอยู่ที่กลางไม้) — เลื่อน SVG ให้ตรง */
    <svg width={W} height={H} viewBox={`${-W / 2} ${-wide} ${W} ${H}`} style={{ overflow: 'visible', display: 'block', position: 'absolute', left: -W / 2, top: -wide }} aria-hidden>
      <path ref={els.body} fill="rgba(255,255,255,0.62)" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} strokeLinejoin="round" />
      <path ref={els.ticks} stroke="rgba(60,72,98,0.55)" strokeWidth={1.4} fill="none" />
      {els.nums.map((ref, j) => (
        <text
          key={j}
          ref={ref}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="'DM Sans', sans-serif"
          fontWeight={400}
          fontSize={15}
          fill="rgba(60,72,98,0.7)"
        >
          {from + j}
        </text>
      ))}
    </svg>
  )
}
