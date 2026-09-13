import { useEffect, useMemo, useRef } from 'react'

/**
 * ม่านเมฆ — จอแรกจบด้วยกลุ่มเมฆที่ลอยขึ้นมาถมจนขาวทั้งจอ และแตกเป็นพิกเซลไปพร้อมกัน
 *
 * ขอบตรงที่กวาดผ่านฉาก 3D อ่านเป็น "แผ่นทึบเลื่อนมาทับ" (เห็นเป็นเส้นคาดขวางจอ) กลุ่ม
 * ก้อนที่ยอดสูงต่ำไม่เท่ากันอ่านเป็นเมฆที่ลอยขึ้นมากลบ — เป็นการเปลี่ยนฉากในตัวมันเอง
 *
 * สามอย่างที่ทำให้มันเป็นเมฆ ไม่ใช่แถววงกลม:
 *
 * 1. ยอดมีหลายขนาดซ้อนกัน — ก้อนใหญ่หนึ่งก้อนมีก้อนเล็กเกาะไหล่อีกสองสามก้อน เส้นรอบรูป
 *    จึงหยักละเอียดไม่เท่ากันทั้งเส้น ไม่ใช่โดมขนาดเดียวเรียงกันเป็นแถว
 * 2. สามชั้นที่ไกลออกไปจางลงและฟุ้งขึ้น (ชั้นไกลเบลอ ชั้นหน้าคม) — ได้ระยะลึกแบบหมอก
 *    ไม่ใช่แผ่นเดียวแบน ๆ ชั้นไกลลอยนำ ชั้นหน้าตามมาทีหลัง
 * 3. ชั้นหน้ามีเงาฟ้าอมเทาซ้อนต่ำกว่าตัวก้อนนิดหน่อย — โผล่เฉพาะร่องระหว่างก้อน ให้ปริมาตร
 *    ส่วนขอบบนยังขาวสะอาด เพราะเงาถูกดันลงไปแล้ว
 *
 * ก้อนเมฆคือวงรีสีเดียวกันที่ซ้อนทับกัน ไม่ใช่ path ที่คำนวณเส้นรอบรูปของยูเนียน — ทับกัน
 * ด้วยสีทึบสีเดียวก็ได้เส้นรอบรูปเดียวกัน แต่ไม่ต้องคำนวณอะไรต่อเฟรมเลย
 *
 * ### ทำไมเป็น canvas ไม่ใช่ SVG
 *
 * ช่วงท้ายเมฆต้องแตกเป็นบล็อกพิกเซลใหญ่ขึ้นเรื่อย ๆ ก่อนกลืนเป็นพื้นขาว ซึ่งไม่ใช่เอฟเฟกต์ที่
 * ทำกับรูปทรงเวกเตอร์ได้ — `image-rendering: pixelated` ไม่มีผลกับ shape ของ SVG และฟิลเตอร์
 * ของ SVG ก็ไม่มีตัวลดความละเอียด ที่นี่จึงวาดของทั้งหมดลงบัฟเฟอร์ที่ "เล็กกว่าจอจริงกี่เท่า
 * ก็เท่าขนาดบล็อก" แล้วขยายกลับขึ้นเต็มจอโดยปิดการกรอง — พิกเซลที่เห็นคือพิกเซลของบัฟเฟอร์
 * จริง ๆ ไม่ใช่ลายตารางที่วาดทับ ตอนต้นทางบล็อกเท่ากับหนึ่งพิกเซลจอ = เมฆปกติคมทุกขอบ
 *
 * วาดรอบเดียวต่อเฟรม (ลงบัฟเฟอร์เล็กตรง ๆ ไม่ได้วาดเต็มจอแล้วค่อยย่อ) ยิ่ง pixelate หนัก
 * ยิ่งวาดน้อยลง เพราะบัฟเฟอร์เล็กลงตามขนาดบล็อก
 *
 * ทุกอย่างผูกกับระยะ scroll อย่างเดียว ไม่มีนาฬิกาเดินเอง — หยุดเลื่อนคือหยุดวาด ไม่กิน
 * เฟรมของฉาก 3D ที่อยู่ข้างหลัง
 */

/** ก้อนย่อยหนึ่งก้อน — พิกัดเป็นสัดส่วน: x ของความกว้าง, y กับรัศมีของความสูง */
type Puff = {
  /** ตำแหน่งแนวนอน 0..1 */
  x: number
  /** ยกสูงจากเส้นฐานของชั้น (หน่วยความสูงจอ) */
  y: number
  /** รัศมี (หน่วยความสูงจอ) */
  r: number
  /** ทิศ/ความเร็วการไหลตามแนวนอนระหว่างลอยขึ้น */
  sp: number
}

/** ตัวสุ่มที่ให้ผลเดิมทุกครั้ง — รูปทรงเมฆต้องนิ่ง ไม่ใช่เปลี่ยนทุกครั้งที่โหลดหน้า */
function rand(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/**
 * แถวก้อนเมฆหนึ่งชั้น: ก้อนแม่เรียงตามแนวนอน แต่ละก้อนมีก้อนลูกเกาะไหล่ซ้ายขวา
 *
 * ก้อนแม่ห่างกันน้อยกว่ารัศมีเสมอ แถวจึงต่อกันเป็นก้อนเดียว ไม่ใช่โดมแยกลูก
 */
function bank(seed: number, scale: number): Puff[] {
  const rnd = rand(seed)
  const out: Puff[] = []
  let x = -0.12
  while (x < 1.16) {
    const r = scale * (0.72 + rnd() * 0.62)
    const sp = (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.9)
    out.push({ x, y: r * 0.62, r, sp })
    // ก้อนลูกบนไหล่ — ยกต่ำกว่าก้อนแม่เล็กน้อย ยอดจึงเป็นหยักซ้อนหยัก
    const kids = 2 + Math.floor(rnd() * 2)
    for (let i = 0; i < kids; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const kr = r * (0.34 + rnd() * 0.3)
      out.push({
        x: x + side * r * (0.5 + rnd() * 0.5) * 0.62,
        y: r * (0.34 + rnd() * 0.34),
        r: kr,
        sp,
      })
    }
    x += r * (0.62 + rnd() * 0.2)
  }
  return out
}

/** ชั้นเมฆ ไกล → ใกล้: สีจางลงเมื่อไกล ฟุ้งขึ้นเมื่อไกล และลอยนำหน้าชั้นที่อยู่ใกล้กว่า */
const LAYERS = [
  { seed: 20260909, scale: 0.3, fill: '#e6eefb', opacity: 0.85, blur: 9, lead: 1.26 },
  { seed: 771, scale: 0.26, fill: '#f4f8ff', opacity: 0.95, blur: 4, lead: 1.12 },
  { seed: 4903, scale: 0.24, fill: '#ffffff', opacity: 1, blur: 0, lead: 1 },
]

/** ปุยที่หลุดออกมาลอยนำกลุ่ม: [x (0..1), รัศมี, เร็วกว่ากลุ่มกี่เท่า, เริ่มโผล่ที่ q เท่าไร] */
const WISPS = [
  [0.14, 0.05, 1.5, 0.02],
  [0.63, 0.036, 1.9, 0.1],
  [0.86, 0.062, 1.35, 0.16],
  [0.36, 0.03, 2.2, 0.26],
  [0.5, 0.044, 1.65, 0.34],
  [0.75, 0.028, 2.4, 0.42],
]

/** เงาในร่องระหว่างก้อนของชั้นหน้า */
const SHADE = '#d9e4f5'

/**
 * ม่านเมฆเริ่มถมหลังจอแรกเลื่อนไปแล้วกี่เท่าของความสูงจอ และใช้ระยะเลื่อนอีกเท่าไร
 *
 * ไม่เริ่มที่ศูนย์: จอแรกมีจังหวะของเคอร์เซอร์นำสายตาเล่นอยู่ก่อน (ไปมุมขวาแล้วกวาด
 * เฉียงลงผ่านหัวเรื่อง ดู cursorguide/) ถ้าเมฆเริ่มพร้อมกันมันจะถมทับจังหวะนั้นทั้งอัน
 *
 * ม่านนี้เป็นชั้นของตัวเองที่ตรึงเต็มจอและอยู่ "เหนือ" ทุก section (ดูที่ mount ในหน้า)
 * เดิมมันอยู่ในชั้นที่ถูกตรึงของจอแรก ซึ่งจอถัดไปวาดทับได้ — พอจอขาวของ what-i-do
 * เลื่อนขึ้นมา ม่านเมฆถูกแซงหน้า เห็นเมฆค้างอยู่แค่ครึ่งจอ (วัดมาแล้ว)
 *
 * ถมเต็มแล้วต้องจางทิ้ง ไม่ใช่ค้างขาวไว้ — มันอยู่เหนือทุก section ถ้าไม่จางก็บังจอถัดไป
 */
const WIPE_AT = 0.46
const WIPE_SPAN = 0.44
/**
 * ระยะเลื่อนที่ม่านขาวทึบพอดี — วินาทีที่ฉากถูกสลับใต้ม่าน แล้วม่านหายไปทันที
 *
 * ไม่มีการจางออก: ตอนนั้นม่านเป็นขาวเต็มจอ และของที่อยู่ใต้ม่านคือจอถัดไปที่พื้นขาว
 * เหมือนกัน ขาวทับขาวจะตัดทิ้งเฟรมเดียวก็ไม่มีใครเห็นรอย — การจางต่างหากที่ทำให้เห็นรอย
 * เพราะระหว่างจางมันเผยของที่อยู่ข้างล่างทีละนิดในจังหวะที่ของนั้นยังไถลอยู่
 *
 * หน้าที่ใช้ม่านนี้ต้องตั้งความสูงของจอแรกให้ขอบบนของจอถัดไปมาถึงขอบบนจอตรงค่านี้ และ
 * ปิดแผ่นจอแรกทิ้งตรงนี้ด้วย (ดู Portfolio2026FinalPage) ส่วนจอถัดไปเป็นคนเล่นท่าเข้าฉาก
 * ของตัวเองต่อจากพื้นขาวนี้ (ดู WhatIDoCard — ของลอยขึ้นมาแบบพารัลแลกซ์)
 */
export const WIPE_FULL = WIPE_AT + WIPE_SPAN

/** ช่วง q ที่เริ่มแตกพิกเซล และช่วงที่บล็อกโตเต็มที่ */
const PIX_IN = 0.08
const PIX_FULL = 0.54
/** ขนาดบล็อกใหญ่สุด หน่วย CSS px — ใหญ่กว่านี้อ่านเป็นแถบสี่เหลี่ยม ไม่ใช่เมฆที่แตกตัว */
const PIX_MAX = 20

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => v * v * (3 - 2 * v)

export function CloudWipe() {
  const cvs = useRef<HTMLCanvasElement>(null)

  const banks = useMemo(() => LAYERS.map((l) => bank(l.seed, l.scale)), [])

  useEffect(() => {
    const el = cvs.current
    if (!el) return
    const view = el.getContext('2d')
    // บัฟเฟอร์ที่วาดจริง เล็กกว่าจอเท่าขนาดบล็อก — พิกเซลที่เห็นคือพิกเซลของมัน
    const buf = document.createElement('canvas')
    const ctx = buf.getContext('2d')
    if (!view || !ctx) return

    let raf = 0
    let w = 0
    let h = 0
    let dpr = 1

    /** วาดก้อนของชั้นหนึ่ง — dy เลื่อนลงจากตำแหน่งจริง ใช้ตอนวาดเงา */
    const drawBank = (puffs: Puff[], lift: number, q: number, fill: string, dy = 0) => {
      // เส้นฐานวิ่งจากใต้จอขึ้นไปพ้นขอบบน — เผื่อรัศมีก้อนใหญ่สุดไว้ ไม่งั้นยอดค้างกลางจอ
      const base = h * 1.52 - lift * (h * 1.53)
      // ก้อนพองขึ้นระหว่างลอย — เมฆที่ลอยขึ้นแล้วขนาดเท่าเดิมอ่านเป็นแผ่นสติกเกอร์
      const swell = 1 + q * 0.16
      ctx.fillStyle = fill
      ctx.beginPath()
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i]
        const dx = Math.sin(q * Math.PI * p.sp) * w * 0.03
        ctx.moveTo(p.x * w + dx, base - p.y * h * swell + dy)
        ctx.ellipse(
          p.x * w + dx,
          base - p.y * h * swell + dy,
          p.r * h * 1.22 * swell,
          p.r * h * swell,
          0,
          0,
          Math.PI * 2,
        )
      }
      // แผ่นใต้แนวก้อน — ไม่งั้นเห็นทะลุระหว่างก้อนลงไปถึงฉาก
      // อยู่ใน path เดียวกับก้อน เพราะสีเดียวกันและ fill รอบเดียวถูกกว่าสองรอบ
      ctx.rect(0, base + dy, w, h * 2)
      ctx.fill()
    }

    const draw = () => {
      raf = 0
      const box = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // ท่วมจบพอดีตอนเลื่อนครบเกือบหนึ่งจอ — จอถัดไปเริ่มโผล่ตรงนั้น
      /** ระยะเลื่อนเป็นเท่าของความสูงจอ (ชื่อไม่ใช่ s — ข้างล่างมี s ที่เป็นอัตราย่อบัฟเฟอร์) */
      const sv = window.scrollY / vh
      const q = clamp01((sv - WIPE_AT) / WIPE_SPAN)
      /* ส่งมอบให้จอถัดไป: ถมเต็มแล้วหายทันที ไม่จาง (ขาวทับขาว ตัดทิ้งไม่มีรอย) */
      const done = sv >= WIPE_FULL
      el.style.opacity = q > 0.001 && !done ? '1' : '0'
      if (q <= 0.001 || done) return

      w = box.width
      h = box.height
      dpr = Math.min(2, window.devicePixelRatio || 1)

      // ขนาดบล็อกโตแบบทวีคูณ ไม่ใช่เชิงเส้น — ช่วงเล็กต่างกันทีละพิกเซลตาก็เห็นแล้ว
      // ช่วงใหญ่ต้องเพิ่มเป็นเท่าตัวจึงจะรู้สึกว่ายังแตกต่อ
      const pq = smooth(clamp01((q - PIX_IN) / (PIX_FULL - PIX_IN)))
      // ปัดเป็นจำนวนเต็มพิกเซลจอ ไม่งั้นขอบบล็อกขยับครึ่ง ๆ ระหว่างเลื่อน = ขอบสั่น
      const step = Math.max(1, Math.round(Math.exp(pq * Math.log(PIX_MAX * dpr))))
      const bw = Math.max(1, Math.ceil((w * dpr) / step))
      const bh = Math.max(1, Math.ceil((h * dpr) / step))

      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr)
        el.height = Math.round(h * dpr)
      }
      if (buf.width !== bw || buf.height !== bh) {
        buf.width = bw
        buf.height = bh
      }

      // วาดด้วยพิกัด CSS px เสมอ รูปทรงจึงไม่ต้องรู้ว่าบล็อกใหญ่แค่ไหน
      const s = bw / w
      ctx.setTransform(s, 0, 0, bh / h, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // ออกตัวนุ่มแล้วนิ่งตอนจบ — ของที่โผล่พรวดหรือหยุดกึก อ่านเป็นแผ่นเลื่อน ไม่ใช่ของลอย
      const e = smooth(q)
      const near = banks[banks.length - 1]

      for (let i = 0; i < banks.length; i++) {
        if (i === banks.length - 1) {
          // เงาอยู่ต่ำกว่าก้อนจริง จึงโผล่แค่ในร่องระหว่างก้อน ไม่เป็นขอบเทารอบยอด
          // วาดก่อนชั้นหน้า จึงถูกก้อนขาวบังไว้หมด เหลือโผล่แค่ในร่อง
          ctx.globalAlpha = 1
          ctx.filter = 'none'
          drawBank(near, Math.min(1, e * LAYERS[2].lead), q, SHADE, h * 0.028)

          // ปุยที่ลอยนำกลุ่ม — จางหายตอนกลุ่มใหญ่ตามมาทัน ไม่งั้นเห็นเป็นก้อนลอยค้างบนพื้นขาว
          const fade = 1 - clamp01((q - 0.5) / 0.3)
          if (fade > 0.003) {
            ctx.filter = blurOf(10, s)
            ctx.fillStyle = '#ffffff'
            for (let j = 0; j < WISPS.length; j++) {
              const [x, r, sp, start] = WISPS[j]
              const t = clamp01((q - start) / (1 - start))
              ctx.globalAlpha = clamp01(t * 5) * fade * 0.8
              ctx.beginPath()
              ctx.ellipse(
                x * w + Math.sin(t * Math.PI * sp) * w * 0.05,
                h + r * h - smooth(t) * sp * h * 1.5,
                r * h * 1.5,
                r * h,
                0,
                0,
                Math.PI * 2,
              )
              ctx.fill()
            }
          }
        }
        const l = LAYERS[i]
        ctx.globalAlpha = l.opacity
        ctx.filter = l.blur > 0 ? blurOf(l.blur, s) : 'none'
        drawBank(banks[i], Math.min(1, e * l.lead), q, l.fill)
      }

      // ปิดท้ายด้วยขาวเต็มจอ — ช่องว่างระหว่างก้อนต้องไม่เหลือให้เห็นตอนท่วมเต็ม
      ctx.filter = 'none'
      ctx.globalAlpha = smooth(clamp01((q - 0.72) / 0.28))
      if (ctx.globalAlpha > 0.003) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
      }
      ctx.globalAlpha = 1

      // ขยายบัฟเฟอร์ขึ้นเต็มจอโดยไม่กรอง = บล็อกพิกเซลขอบคม
      view.setTransform(1, 0, 0, 1, 0, 0)
      view.imageSmoothingEnabled = false
      view.clearRect(0, 0, el.width, el.height)
      view.drawImage(buf, 0, 0, bw, bh, 0, 0, el.width, el.height)
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
      // ปล่อยหน่วยความจำของบัฟเฟอร์ — canvas ที่ไม่ได้อยู่ใน DOM ก็ยังถือ backing store ไว้
      buf.width = 0
      buf.height = 0
    }
  }, [banks])

  return (
    <canvas
      ref={cvs}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
      style={{ opacity: 0, imageRendering: 'pixelated' }}
    />
  )
}

/**
 * เบลอที่ต้องหารด้วยอัตราย่อของบัฟเฟอร์
 *
 * `ctx.filter` คิดรัศมีเป็นพิกเซลของบัฟเฟอร์ ไม่ใช่หน่วยของ transform ที่ตั้งไว้ ถ้าใส่ค่าดิบ
 * ตอนบัฟเฟอร์เล็ก ชั้นไกลจะเบลอจนละลายหมดทั้งชั้น
 */
function blurOf(px: number, scale: number) {
  const r = px * scale
  return r < 0.4 ? 'none' : `blur(${r.toFixed(2)}px)`
}
