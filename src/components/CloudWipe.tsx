import { useEffect, useMemo, useRef } from 'react'

/**
 * ม่านเมฆ — จอแรกจบด้วยกลุ่มเมฆที่ลอยขึ้นมาถมจนขาวทั้งจอ
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
 * viewBox เป็นพิกเซลจริง (ไม่ใช่ 0..100 + preserveAspectRatio="none") ไม่งั้นวงกลมจะถูก
 * ยืดตามอัตราส่วนจอจนกลายเป็นวงรีแบน ๆ
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

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => v * v * (3 - 2 * v)

export function CloudWipe() {
  const svg = useRef<SVGSVGElement>(null)
  const groups = useRef<(SVGGElement | null)[]>([])
  const slabs = useRef<(SVGRectElement | null)[]>([])
  const shade = useRef<SVGGElement>(null)
  const shadeSlab = useRef<SVGRectElement>(null)
  const wisps = useRef<SVGGElement>(null)
  const veil = useRef<SVGRectElement>(null)

  const banks = useMemo(() => LAYERS.map((l) => bank(l.seed, l.scale)), [])

  useEffect(() => {
    let raf = 0
    let w = 0
    let h = 0

    /** วางก้อนของชั้นหนึ่ง — dy เลื่อนลงจากตำแหน่งจริง ใช้ตอนวาดเงา */
    const place = (
      g: SVGGElement | null,
      slab: SVGRectElement | null,
      puffs: Puff[],
      lift: number,
      q: number,
      dy = 0,
    ) => {
      if (!g) return
      const kids = g.children
      // เส้นฐานวิ่งจากใต้จอขึ้นไปพ้นขอบบน — เผื่อรัศมีก้อนใหญ่สุดไว้ ไม่งั้นยอดค้างกลางจอ
      const base = h * 1.52 - lift * (h * 1.53)
      // ก้อนพองขึ้นระหว่างลอย — เมฆที่ลอยขึ้นแล้วขนาดเท่าเดิมอ่านเป็นแผ่นสติกเกอร์
      const swell = 1 + q * 0.16
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i]
        const el = kids[i] as SVGEllipseElement
        const dx = Math.sin(q * Math.PI * p.sp) * w * 0.03
        el.setAttribute('cx', (p.x * w + dx).toFixed(1))
        el.setAttribute('cy', (base - p.y * h * swell + dy).toFixed(1))
        el.setAttribute('rx', (p.r * h * 1.22 * swell).toFixed(1))
        el.setAttribute('ry', (p.r * h * swell).toFixed(1))
      }
      // แผ่นใต้แนวก้อน — ไม่งั้นเห็นทะลุระหว่างก้อนลงไปถึงฉาก
      // อยู่นอกกลุ่มที่ใส่ฟิลเตอร์: ถ้าอยู่ใน กรอบฟิลเตอร์จะกินสูงสองเท่าจอ แล้วเบลอผืนนั้น
      // ใหม่ทุกเฟรมที่เลื่อน ทั้งที่ขอบบนของมันถูกก้อนเมฆบังอยู่แล้ว
      if (slab) {
        slab.setAttribute('y', (base + dy).toFixed(1))
        slab.setAttribute('height', (h * 2).toFixed(1))
      }
    }

    const draw = () => {
      raf = 0
      const el = svg.current
      if (!el) return
      const box = el.getBoundingClientRect()
      if (box.width !== w || box.height !== h) {
        w = box.width
        h = box.height
        el.setAttribute('viewBox', `0 0 ${w.toFixed(0)} ${h.toFixed(0)}`)
        const r = veil.current
        if (r) {
          r.setAttribute('width', w.toFixed(0))
          r.setAttribute('height', h.toFixed(0))
        }
        for (const slab of [...slabs.current, shadeSlab.current]) {
          if (!slab) continue
          slab.setAttribute('x', '0')
          slab.setAttribute('width', w.toFixed(0))
        }
      }
      const vh = window.innerHeight || 1
      // ท่วมจบพอดีตอนเลื่อนครบเกือบหนึ่งจอ — จอถัดไปเริ่มโผล่ตรงนั้น
      const q = clamp01(window.scrollY / (vh * 0.92))
      el.style.opacity = q > 0.001 ? '1' : '0'
      if (q <= 0.001) return
      // ออกตัวนุ่มแล้วนิ่งตอนจบ — ของที่โผล่พรวดหรือหยุดกึก อ่านเป็นแผ่นเลื่อน ไม่ใช่ของลอย
      const e = smooth(q)
      const near = banks[banks.length - 1]
      // เงาอยู่ต่ำกว่าก้อนจริง จึงโผล่แค่ในร่องระหว่างก้อน ไม่เป็นขอบเทารอบยอด
      place(shade.current, shadeSlab.current, near, Math.min(1, e * LAYERS[2].lead), q, h * 0.028)
      for (let i = 0; i < banks.length; i++) {
        place(groups.current[i], slabs.current[i], banks[i], Math.min(1, e * LAYERS[i].lead), q)
      }

      const sg = wisps.current
      if (sg) {
        for (let i = 0; i < WISPS.length; i++) {
          const [x, r, sp, start] = WISPS[i]
          const el2 = sg.children[i] as SVGEllipseElement
          const t = clamp01((q - start) / (1 - start))
          el2.setAttribute('cx', (x * w + Math.sin(t * Math.PI * sp) * w * 0.05).toFixed(1))
          el2.setAttribute('cy', (h + r * h - smooth(t) * sp * h * 1.5).toFixed(1))
          el2.setAttribute('rx', (r * h * 1.5).toFixed(1))
          el2.setAttribute('ry', (r * h).toFixed(1))
          // จางหายตอนกลุ่มใหญ่ตามมาทัน ไม่งั้นเห็นเป็นก้อนลอยค้างบนพื้นขาว
          el2.style.opacity = (clamp01(t * 5) * (1 - clamp01((q - 0.5) / 0.3)) * 0.8).toFixed(3)
        }
      }
      // ปิดท้ายด้วยขาวเต็มจอ — ช่องว่างระหว่างก้อนต้องไม่เหลือให้เห็นตอนท่วมเต็ม
      if (veil.current) veil.current.style.opacity = smooth(clamp01((q - 0.72) / 0.28)).toFixed(3)
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
  }, [banks])

  const ellipses = (puffs: Puff[], fill: string) =>
    puffs.map((_, i) => <ellipse key={i} cx={0} cy={0} rx={0} ry={0} fill={fill} />)

  return (
    <svg
      ref={svg}
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      aria-hidden
      style={{ opacity: 0 }}
    >
      <defs>
        {LAYERS.map((l, i) =>
          l.blur > 0 ? (
            <filter key={i} id={`cw-b${i}`} x="-10%" y="-25%" width="120%" height="150%">
              <feGaussianBlur stdDeviation={l.blur} />
            </filter>
          ) : null,
        )}
        <filter id="cw-wisp" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      {banks.map((puffs, i) => (
        <g key={i}>
          {/* เงาของชั้นหน้าวาดก่อนตัวชั้น จึงถูกก้อนขาวบังไว้หมด เหลือโผล่แค่ในร่อง */}
          {i === LAYERS.length - 1 && (
            <>
              <rect ref={shadeSlab} x={0} y={0} width={0} height={0} fill="#d9e4f5" />
              <g ref={shade}>{ellipses(puffs, '#d9e4f5')}</g>
            </>
          )}
          {i === LAYERS.length - 1 && (
            <g ref={wisps} filter="url(#cw-wisp)">
              {WISPS.map((_, j) => (
                <ellipse key={j} cx={0} cy={0} rx={0} ry={0} fill="#ffffff" />
              ))}
            </g>
          )}
          <g opacity={LAYERS[i].opacity}>
            <rect
              ref={(n) => {
                slabs.current[i] = n
              }}
              x={0}
              y={0}
              width={0}
              height={0}
              fill={LAYERS[i].fill}
            />
            <g
              ref={(n) => {
                groups.current[i] = n
              }}
              filter={LAYERS[i].blur > 0 ? `url(#cw-b${i})` : undefined}
            >
              {ellipses(puffs, LAYERS[i].fill)}
            </g>
          </g>
        </g>
      ))}
      <rect ref={veil} x={0} y={0} width={0} height={0} fill="#ffffff" style={{ opacity: 0 }} />
    </svg>
  )
}
