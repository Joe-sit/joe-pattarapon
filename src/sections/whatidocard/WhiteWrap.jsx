import { useEffect, useMemo, useRef } from 'react'
import { cursorHand, cursorShow, cursorTip, cursorWake } from '@/cursorguide/morph'
import { cursorPress } from '@/cursorguide/press'
import { HandDepth } from './HandDepth'

/**
 * ท่าปิดจอ "สิ่งที่ทำ" — ขาวห่อฉากจนสนิท มืออีกข้างยื่นมาแตะเคอร์เซอร์ แล้วจอถัดไปแผ่ออกมา
 *
 * ตามแบบที่ส่งมา (ภาพ The Creation of Adam ที่มือข้างหนึ่งเป็นเคอร์เซอร์): พื้นที่ที่ยังเห็นฉาก
 * อยู่เป็น "ก้อนเมฆ" ขอบหยักเป็นบันไดพิกเซล ไม่ใช่วงกลมเรียบ — และเคอร์เซอร์นำสายตาของหน้า
 * (ตัวเดียวทั้งหน้า ดู cursorguide/) คือมือข้างหนึ่งของภาพนั้น
 *
 * ### เป็นไทม์ไลน์ ไม่ได้ผูกกับระยะเลื่อน
 *
 * ระยะเลื่อนเป็นแค่ *ตัวจุดชนวน* (ดู WRAP_AT) พอติดแล้วท่าทั้งชุดเดินด้วยนาฬิกาของตัวเองจนจบ
 * ไม่ว่าผู้ชมจะเลื่อนต่อ หยุด หรือเลื่อนช้า — จังหวะของแต่ละบีตจึงเป็นของที่ออกแบบไว้ (ดู
 * BEATS) ไม่ใช่ผลของความเร็วล้อเมาส์ของแต่ละคน ท่าที่ผูกกับระยะเลื่อนมีปัญหาสองข้อที่แก้ที่
 * ค่าไหนก็ไม่หาย: ช่วงค้างก่อนแตะยาวเท่าที่ผู้ชมหยุดมือ (ไม่ใช่เท่าที่ตั้งไว้) และคลื่นระเบิด
 * เดินทีละกระตุกตามก้อน scroll ที่เข้ามา
 *
 * ถอยขึ้นไปพ้นจุดจุดชนวน = รีเซ็ต เล่นใหม่ได้
 *
 * ### ห่อ ไม่ใช่ถม
 *
 * ม่านเมฆของจอแรก (components/CloudWipe) ถมขาวจากขอบล่างขึ้นมา = "ฉากถูกกลบ" ท่านี้กลับกัน
 * ขาวมาจากขอบทุกด้านพร้อมกันแล้วรัดเข้าหากลาง = "ฉากถูกห่อ" ซึ่งอ่านเป็นการปิดกล่องของเรื่อง
 * ที่เพิ่งเล่าจบ ไม่ใช่การเปลี่ยนฉากอีกครั้ง
 *
 * ### ทำไมเป็น canvas
 *
 * เหตุผลเดียวกับม่านเมฆ: ขอบต้องแตกเป็นบล็อกพิกเซลใหญ่ขึ้นเรื่อย ๆ ตามแบบ ซึ่ง SVG/CSS ทำ
 * ไม่ได้ (image-rendering ไม่มีผลกับ shape) วาดลงบัฟเฟอร์ที่เล็กกว่าจอเท่าขนาดบล็อกแล้วขยาย
 * กลับโดยปิดการกรอง พิกเซลที่เห็นจึงเป็นพิกเซลจริงของบัฟเฟอร์
 *
 * รูช่องเจาะด้วย destination-out ทับแผ่นขาว ไม่ได้วาดขาวเป็นสี่ชิ้นล้อมช่อง — ขอบหยักของรู
 * เป็นรูปทรงเดียว คิดครั้งเดียว
 */

/** ระยะเลื่อนที่จุดชนวนท่านี้ — "เลื่อนพ้นขอบบนของ section มากี่เท่าความสูงจอ" */
export const WRAP_AT = 0.72

/**
 * บีตของท่า (วินาที นับจากจุดชนวน)
 *
 * เรียงกันเป็นสามองก์ตามภาพอ้างอิง ไม่เหลื่อมกัน: **เมฆหุบก่อน** จนช่องเหลือเกือบเท่ากลางจอ
 * แล้ว *ค่อย* มีเคอร์เซอร์กับมือเข้ามาหากัน แล้วการแตะจึงเปิดจอถัดไป — ผู้ชมจึงอ่านได้ว่า
 * "ฉากปิด → สองมือมาเจอกัน → ฉากใหม่เกิด" ตอนที่เหลื่อมกัน (มือเข้ามาตอนขาวยังห่อไม่เสร็จ)
 * ตาไม่รู้จะดูอะไร และการแตะกลายเป็นของที่เกิดขึ้นระหว่างทาง ไม่ใช่จุดพลิกของเรื่อง
 *
 * `hold` คือช่วงที่มือค้างนิ่งเกือบสนิทแล้วคืบเข้าไปทีละพิกเซล — ช่วงหายใจก่อนแตะ ตัวที่ทำให้
 * การแตะเป็น "เหตุการณ์" ไม่ใช่ปลายทางของการเลื่อน
 */
const BEATS = {
  /** ขาวห่อฉาก — ช่องเมฆรัดเข้าหากลางจอจนหมด */
  close: [0, 1.45],
  /** เคอร์เซอร์โผล่มา (ย่อหายไปตอนขาวห่อ) พอดีตอนเศษเมฆก้อนสุดท้ายหาย */
  cursor: [1.0, 1.35],
  /** แขนเข้ามาจากขอบขวา หน่วงตัวลงยาว ๆ มาหยุดก่อนถึง GAP พิกเซล */
  hand: [1.2, 2.3],
  /** ค้าง แล้วคืบเข้าไปปิดระยะที่เหลือ */
  hold: [2.3, 2.9],
  /** แตะ */
  touch: 2.9,
  /** คลื่นที่แผ่จอถัดไปออกมาจากจุดสัมผัส */
  wave: [2.9, 3.75],
}
const TOTAL = 3.9
/** เคอร์เซอร์ย่อหายไปในช่วงต้นของการห่อ — องก์แรกมีแต่เมฆกับฉาก */
const CUR_OUT = [0, 0.32]

/** ช่วงที่ขอบเริ่มแตกเป็นบล็อก (สัดส่วนของบีต close) และบล็อกใหญ่สุด (พิกเซลจอ) */
const PIX_IN = 0.18
const PIX_MAX = 16
/**
 * สีปลายทางของแผ่น — ไม่ใช่ขาวสนิท แต่เป็นสีพื้นของจอถัดไป
 *
 * ชั้นนี้อยู่ในกล่องที่ถูกตรึงของ section นี้ พอ section เลื่อนพ้นไป มันหายไปพร้อมกันทั้งชั้น
 * ถ้าค้างเป็นขาวสนิท เฟรมที่หายคือขาวถูกสลับเป็นฟ้าอ่อนของจอถัดไปทั้งจอ (#cfe9fb — ดู
 * sections/portals/ExperiencePortals) คลื่นจึงแผ่ *สีนั้น* ออกมา ไม่ใช่แผ่แสงขาว
 */
const END_TINT = [207, 233, 251]

/**
 * มืออีกข้าง — ยกจาก Figma ของ BMS (โหนด 12811:6) ตัดพื้นมาแล้ว
 *
 * ตามภาพอ้างอิง: แขนเข้ามาจากขอบขวา ปลายนิ้วชี้กลับมาทางซ้ายไปหาเคอร์เซอร์
 */
const HAND = '/art/adam-hand.png'
/** ปลายนิ้วอยู่ตรงไหนของไฟล์รูป (สัดส่วน) — เล็งด้วยปลายนิ้ว ไม่ใช่ขอบรูป */
const TIP = { x: 0.012, y: 0.5 }
/** อัตราส่วนของไฟล์รูป (461 / 991) */
const HAND_AR = 461 / 991
/** ความกว้างของมือ เทียบความกว้างจอ */
const HAND_W = 0.46
/** ระยะที่ปลายนิ้วยังห่างจากปลายลูกศรตอนจบบีต hand (พิกเซล) */
const GAP = 26
/** ที่ยืนสำรองของปลายนิ้ว เผื่อกรณีที่ยังไม่มีเคอร์เซอร์ในหน้า (สัดส่วนวิวพอร์ต) */
const TIP_FALLBACK = { x: 0.386, y: 0.523 }
/** สีประกาย — สีเน้นของงานนี้ ต้องไม่ใช่ขาว เพราะพื้นตอนนั้นขาวอยู่แล้ว มองไม่เห็นอะไรเลย */
const SPARK = '253,80,0'

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v) => v * v * (3 - 2 * v)
const outQuint = (v) => 1 - (1 - v) ** 5
const outCubic = (v) => 1 - (1 - v) ** 3
/** ความคืบหน้าของบีตหนึ่ง ณ เวลา t */
const beat = (t, [a, b]) => clamp01((t - a) / Math.max(0.001, b - a))

/** ตัวสุ่มที่ให้ผลเดิมทุกครั้ง — รูปทรงของช่องต้องนิ่ง ไม่ใช่เปลี่ยนทุกครั้งที่โหลดหน้า */
function rand(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/**
 * ช่องที่ยังเห็นฉากอยู่: ก้อนแม่หนึ่งก้อน + ก้อนลูกเกาะอยู่รอบ ๆ
 *
 * ก้อนแม่เป็นวงที่รัศมีแกว่งด้วยคลื่นสามความถี่ (เส้นรอบรูปจึงป่องไม่เท่ากันทั้งวงเหมือนเมฆ
 * ในแบบ ไม่ใช่วงกลม) ก้อนลูกคือหย่อมเล็กที่แยกตัวออกไป — ในแบบมีเกาะเล็กสองสามเกาะลอยอยู่
 * นอกก้อนใหญ่ ซึ่งเป็นสิ่งที่ทำให้มันอ่านเป็นรอยเปรอะ ไม่ใช่รูที่เจาะด้วยวงเวียน
 */
function makeIslands(seed) {
  const rnd = rand(seed)
  const out = []
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2
    out.push({
      /** ทิศ/ระยะจากกลางช่อง (หน่วย: เท่าของรัศมีก้อนแม่) */
      a,
      d: 0.72 + rnd() * 0.5,
      r: 0.12 + rnd() * 0.16,
      /** หายไปก่อนก้อนแม่แค่ไหน — เกาะเล็กควรถูกขาวกลืนก่อน */
      out: 0.45 + rnd() * 0.3,
    })
  }
  return out
}

export function WhiteWrap({ sectionRef }) {
  const cvs = useRef(null)
  const hand = useRef(null)
  const islands = useMemo(() => makeIslands(0x5eed), [])

  useEffect(() => {
    const el = cvs.current
    const sec = sectionRef.current
    if (!el || !sec) return undefined
    const view = el.getContext('2d')
    /* บัฟเฟอร์ที่วาดจริง เล็กกว่าจอเท่าขนาดบล็อก — พิกเซลที่เห็นคือพิกเซลของมัน */
    const buf = document.createElement('canvas')
    const ctx = buf.getContext('2d')
    if (!view || !ctx) return undefined

    let raf = 0
    /** เวลาที่ท่าเริ่ม (-1 = ยังไม่จุดชนวน) กับเวลาในท่าของเฟรมล่าสุด */
    let t0 = -1
    let tNow = 0
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    /** เส้นรอบรูปของก้อนหนึ่งก้อน — วงที่รัศมีแกว่งด้วยคลื่นสามความถี่ */
    const puff = (cx, cy, r, phase, wob) => {
      const N = 44
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2
        const k =
          1 +
          wob * (0.2 * Math.sin(a * 3 + phase) + 0.13 * Math.sin(a * 5 - phase * 1.7) + 0.07 * Math.sin(a * 8 + 2.1))
        const x = cx + Math.cos(a) * r * k * 1.14
        const y = cy + Math.sin(a) * r * k
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
    }

    const draw = (t) => {
      const box = el.getBoundingClientRect()
      const w = box.width
      const h = box.height
      const dpr = Math.min(2, window.devicePixelRatio || 1)

      const close = beat(t, BEATS.close)
      const e = smooth(close)

      /* บล็อกโตแบบทวีคูณ ไม่ใช่เชิงเส้น — ช่วงเล็กต่างกันทีละพิกเซลตาก็เห็น ช่วงใหญ่ต้องเพิ่ม
         เป็นเท่าตัวจึงจะรู้สึกว่ายังแตกต่อ (เหตุผลเดียวกับ components/CloudWipe) */
      const pq = smooth(clamp01((close - PIX_IN) / (1 - PIX_IN)))
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

      /* วาดด้วยพิกัด CSS px เสมอ รูปทรงจึงไม่ต้องรู้ว่าบล็อกใหญ่แค่ไหน */
      ctx.setTransform(bw / w, 0, 0, bh / h, 0, 0)
      ctx.clearRect(0, 0, w, h)

      /**
       * ตลอดท่านี้เคอร์เซอร์เป็น *มือชี้* ไม่ใช่ลูกศร — ภาพอ้างอิงคือนิ้วแตะนิ้ว
       *
       * แล้วปลุกชั้นเคอร์เซอร์ทุกเฟรมด้วย: มันวาดตามสั่ง (ดู CursorGuideLayer) ท่านี้เดินด้วย
       * นาฬิกาไม่ได้เลื่อนจอ ถ้าไม่ปลุก ทั้งการสลับรูปทรงและท่ากดจะค้างเป็นภาพนิ่ง และ
       * `cursorTip` ที่เราเล็งปลายนิ้วไปหาก็ไม่อัปเดตตาม
       */
      cursorHand.v = 1
      /**
       * เคอร์เซอร์หายไปตอนเมฆหุบ แล้วโผล่กลับมาเปิดองก์ที่สอง
       *
       * มันยืนอยู่ตรงนั้นมาตั้งแต่ก่อนท่าเริ่ม ถ้าปล่อยไว้ องก์แรกจะมีสองเรื่องพร้อมกัน
       * (เมฆหุบ + เคอร์เซอร์รอ) และตอนมือยื่นมาก็ไม่มีอะไร "เกิดขึ้น" ฝั่งเคอร์เซอร์เลย
       */
      cursorShow.v = t < BEATS.cursor[0] ? 1 - beat(t, CUR_OUT) : outQuint(beat(t, BEATS.cursor))
      cursorWake.fn()

      /* พื้นขาวสะอาดตลอดท่า — สีของจอถัดไปไม่ได้มาจากการไล่สีทั้งแผ่น มันแผ่ออกมาจากจุดที่
         นิ้วแตะ (ดูวงคลื่นข้างล่าง) */
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)

      /**
       * จุดสัมผัส = *ปลายลูกศรจริง* ณ เฟรมนั้น ไม่ใช่พิกัดที่ตั้งไว้
       *
       * เคอร์เซอร์เป็นของที่เดินทางตามระยะเลื่อนทั้งหน้า (ดู cursorguide/stops) ส่วนท่านี้เดิน
       * ด้วยนาฬิกา สองอย่างจึงไม่ตรงกันเองเสมอ — ถ้าเล็งปลายนิ้วไปที่พิกัดตายตัว วันที่ผู้ชม
       * เลื่อนเร็ว/ช้ากว่าที่เดาไว้ จะเห็นนิ้วแตะอากาศข้างลูกศร ให้ปลายนิ้วเกาะปลายลูกศรไปเลย
       * มันจึงแตะถูกที่ทุกครั้ง
       */
      const cpx = cursorTip.ok ? cursorTip.x : w * TIP_FALLBACK.x
      const cpy = cursorTip.ok ? cursorTip.y : h * TIP_FALLBACK.y

      /**
       * ช่องที่ยังเห็นฉาก — เจาะออกจากแผ่นขาว
       *
       * เริ่มใหญ่กว่าเฟรม (ขาวยังไม่กินฉากเลยในเฟรมแรกของท่า) แล้วรัดเข้าหากลางฉากซึ่งเป็น
       * ที่ของตัวละครในหน้าต่าง — ของชิ้นสุดท้ายที่หายไปจึงเป็นตัวละคร ไม่ใช่มุมจอว่าง ๆ
       *
       * กลางช่องไถลไปทางซ้ายบนตอนรัด: ถ้าหดลงไปจบตรงกลางพอดี เศษสุดท้ายของฉากจะไปค้างอยู่
       * ติดปลายนิ้วเป็นจุดเปรอะ (วัดมาแล้ว)
       */
      const cx = w * (0.5 - 0.09 * e)
      const cy = h * (0.5 - 0.05 * e)
      /* 0.53 = พ้นมุมจอมานิดเดียว (ครึ่งเส้นทแยง = 0.5) ขาวจึงเริ่มกินขอบทันทีที่ท่าเริ่ม
         ไม่ใช่รอให้รัศมีหดลงมาถึงมุมก่อนค่อยเห็นอะไร */
      const r0 = Math.hypot(w, h) * 0.53
      /* ปิดสนิทก่อนบีต hold — ฉากต้องหายไปแล้วตอนภาพนิ่งเป็นสองมือบนความขาว */
      const r = r0 * clamp01(1 - e / 0.9) ** 1.2
      const wob = 0.35 + 0.65 * e
      if (r > 0.5) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.beginPath()
        puff(cx, cy, r, 0.6, wob)
        for (let i = 0; i < islands.length; i++) {
          const s = islands[i]
          /* เกาะเล็กหายก่อนก้อนแม่ — ตัวคูณของมันถึงศูนย์ก่อน */
          const k = clamp01((s.out - e) / s.out)
          if (k <= 0.001) continue
          puff(cx + Math.cos(s.a) * r * s.d, cy + Math.sin(s.a) * r * s.d, r * s.r * k, s.a * 2, wob)
        }
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
      }

      /**
       * ประกายก่อนแตะ แล้วระเบิดตอนแตะ
       *
       * วาดลงบัฟเฟอร์เดียวกับแผ่นขาว จึงถูกแบ่งเป็นบล็อกพิกเซลด้วยขนาดเดียวกับขอบเมฆ — แสง
       * ที่แตกเป็นบล็อกคือภาษาเดียวกับที่หน้านี้ใช้มาตลอด (ม่านเมฆ/เคอร์เซอร์พิกเซล) ไม่ใช่
       * เงาฟุ้งแบบที่มาจากที่อื่น
       */
      const pre = smooth(beat(t, [BEATS.touch - 0.5, BEATS.touch]))
      if (pre > 0.001 && t < BEATS.touch) {
        const rr = 3 + pre * 26
        const g = ctx.createRadialGradient(cpx, cpy, 0, cpx, cpy, rr)
        g.addColorStop(0, `rgba(255,255,255,${(0.75 * pre).toFixed(3)})`)
        g.addColorStop(0.35, `rgba(${SPARK},${(0.85 * pre).toFixed(3)})`)
        g.addColorStop(1, `rgba(${SPARK},0)`)
        ctx.fillStyle = g
        ctx.fillRect(cpx - rr, cpy - rr, rr * 2, rr * 2)
      }
      /**
       * ตอนแตะ: จอถัดไป *แผ่ออกมาจากจุดสัมผัส* ไม่ใช่แสงที่สาดทั้งจอแล้วจางไป
       *
       * วงที่ขยายออกมีสีพื้นของจอถัดไปอยู่ข้างใน ขอบวงร้อน (ขาว/ส้ม) และบางลงเรื่อย ๆ —
       * ตาจึงอ่านว่าการแตะ *สร้าง* จอใหม่ขึ้นมา ซึ่งเป็นเรื่องของภาพอ้างอิงทั้งภาพ
       * (ก่อนหน้านี้ใช้ไล่สีทั้งแผ่น ผลคือจอกลายเป็นสีพีชทั้งจอ ไม่เห็นว่ามีคลื่นอะไรแผ่ออก
       * — วัดมาแล้ว)
       */
      const tq = beat(t, BEATS.wave)
      if (tq > 0.001) {
        const R = Math.hypot(w, h) * (0.012 + 0.98 * tq ** 0.72)
        ctx.fillStyle = `rgb(${END_TINT[0]},${END_TINT[1]},${END_TINT[2]})`
        ctx.beginPath()
        ctx.arc(cpx, cpy, R, 0, Math.PI * 2)
        ctx.fill()
        /* ขอบคลื่น: ขาวร้อนชั้นใน ส้มชั้นนอกบางกว่า — สองเส้นคือสิ่งที่ทำให้ขอบมี "อุณหภูมิ" */
        const rim = Math.max(1.5, 40 * (1 - tq) ** 1.4)
        ctx.strokeStyle = `rgba(255,255,255,${(0.95 * (1 - tq * 0.75)).toFixed(3)})`
        ctx.lineWidth = rim
        ctx.beginPath()
        ctx.arc(cpx, cpy, R, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = `rgba(${SPARK},${(0.8 * (1 - tq)).toFixed(3)})`
        ctx.lineWidth = rim * 0.55
        ctx.beginPath()
        ctx.arc(cpx, cpy, R + rim * 0.6, 0, Math.PI * 2)
        ctx.stroke()
        /* ไส้ที่จุดสัมผัส — สว่างจ้าแล้วดับเร็ว ไม่ใช่ค้างอยู่ตรงกลางทั้งท่า */
        const core = clamp01(1 - tq * 3.4)
        if (core > 0.001) {
          const cr = 10 + 90 * core
          const g = ctx.createRadialGradient(cpx, cpy, 0, cpx, cpy, cr)
          g.addColorStop(0, `rgba(255,255,255,${core.toFixed(3)})`)
          g.addColorStop(0.5, `rgba(${SPARK},${(0.7 * core).toFixed(3)})`)
          g.addColorStop(1, `rgba(${SPARK},0)`)
          ctx.fillStyle = g
          ctx.fillRect(cpx - cr, cpy - cr, cr * 2, cr * 2)
        }
      }

      view.imageSmoothingEnabled = false
      view.clearRect(0, 0, el.width, el.height)
      view.drawImage(buf, 0, 0, bw, bh, 0, 0, el.width, el.height)

      /**
       * มืออีกข้าง — <img> ไม่ใช่ของที่วาดลงบัฟเฟอร์เดียวกับแผ่นขาว
       *
       * ถ้าวาดลงบัฟเฟอร์ มันจะถูก pixelate ไปกับขอบเมฆด้วย ซึ่งมือในภาพอ้างอิงไม่ได้แตกเป็น
       * บล็อก — มันเป็นของอีกชิ้นที่วางทับอยู่ (เคอร์เซอร์ก็เช่นกัน อยู่บนชั้นของมันเองทั้งหน้า)
       *
       * วางด้วย transform ล้วน ไม่ใช่ left/top: ที่หมายของมันคือปลายลูกศรซึ่งขยับได้ทุกเฟรม
       * เปลี่ยน left/top ทุกเฟรมคือบังคับให้เบราว์เซอร์คิดผังใหม่ทุกเฟรม
       */
      const img = hand.current
      if (img) {
        const hw = w * HAND_W
        const hh = hw * HAND_AR
        /* เข้ามาแล้วหน่วงตัวลงยาว ๆ มาหยุดห่างปลายลูกศร GAP พิกเซล */
        const u = outQuint(beat(t, BEATS.hand))
        /* ช่วงค้าง: คืบเข้าไปปิดระยะที่เหลือ ช้าตอนต้นแล้วเร็วตอนจบ = ของที่ "ยื่นไปแตะ" */
        const c = beat(t, BEATS.hold) ** 2.6
        /* หลังแตะ: สะบัดกลับแล้วจางไปในคลื่น — ของที่ค้างนิ่งในแสงจ้าอ่านเป็นสติกเกอร์ */
        const back = outCubic(clamp01((t - BEATS.touch) / 0.16)) * 22
        const x = cpx - TIP.x * hw + (1 - u) * w * 0.42 + (1 - c) * GAP + back
        const y = cpy - TIP.y * hh
        img.style.opacity = (
          clamp01((t - BEATS.hand[0]) / 0.45) * (1 - clamp01((t - BEATS.touch) / 0.12))
        ).toFixed(3)
        img.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      }

      /**
       * เคอร์เซอร์กดลงตอนแตะ — ท่ากดของมันเองทั้งหน้า ไม่ได้วาดอะไรใหม่ที่นี่
       *
       * ครึ่งคลื่นไซน์สั้น ๆ เหมือนจุดกดอื่นของหน้า (ดู sections/hero/ScrollTell) ปลายลูกศร
       * จึงจิ้มลงพอดีเฟรมที่ประกายเกิด ไม่ใช่ลอยนิ่งอยู่ข้าง ๆ แสง
       */
      const pu = clamp01((t - (BEATS.touch - 0.1)) / 0.36)
      cursorPress.v = pu <= 0 || pu >= 1 ? 0 : Math.sin(pu * Math.PI)
    }

    const tick = (now) => {
      raf = 0
      if (t0 < 0) return
      tNow = (now - t0) / 1000
      draw(Math.min(tNow, TOTAL))
      /* เดินต่อจนจบท่าแล้วหยุด — เฟรมสุดท้ายค้างไว้ (สีของจอถัดไปเต็มจอ) ไม่ต้องวาดซ้ำ */
      if (tNow < TOTAL) kick()
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }

    /** เริ่ม/รีเซ็ตท่าตามระยะเลื่อน — ระยะเลื่อนมีหน้าที่แค่นี้ ที่เหลือเป็นนาฬิกา */
    const gate = () => {
      const vh = window.innerHeight || 1
      const sv = Math.max(0, -sec.getBoundingClientRect().top) / vh
      if (t0 < 0 && sv >= WRAP_AT) {
        /* คนที่ตั้งเครื่องว่าไม่เอาการเคลื่อนไหว ได้ผลลัพธ์ปลายทางทันที ไม่ได้ดูท่า */
        t0 = performance.now() - (still ? TOTAL * 1000 : 0)
        el.style.opacity = '1'
        kick()
      } else if (t0 >= 0 && sv < WRAP_AT - 0.05) {
        /* ถอยขึ้นไปพ้นจุดจุดชนวน = พร้อมเล่นใหม่ */
        t0 = -1
        tNow = 0
        el.style.opacity = '0'
        if (hand.current) hand.current.style.opacity = '0'
        cursorPress.v = 0
        cursorHand.v = 0
        cursorShow.v = 1
        cursorWake.fn()
        if (raf) cancelAnimationFrame(raf)
        raf = 0
      }
    }

    const onResize = () => {
      /* จอเปลี่ยนขนาดตอนท่าจบแล้ว ต้องวาดเฟรมสุดท้ายใหม่ ไม่งั้นแผ่นค้างขนาดเดิม */
      if (t0 >= 0) draw(Math.min(tNow, TOTAL))
    }

    window.addEventListener('scroll', gate, { passive: true })
    window.addEventListener('resize', onResize)
    gate()
    return () => {
      window.removeEventListener('scroll', gate)
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
      cursorPress.v = 0
      cursorHand.v = 0
      cursorShow.v = 1
      /* ปล่อยหน่วยความจำของบัฟเฟอร์ — canvas ที่ไม่ได้อยู่ใน DOM ก็ยังถือ backing store ไว้ */
      buf.width = 0
      buf.height = 0
    }
  }, [sectionRef, islands])

  return (
    <>
      <canvas
        ref={cvs}
        className="pointer-events-none absolute inset-0 z-40 h-full w-full"
        style={{ opacity: 0, imageRendering: 'pixelated' }}
        aria-hidden
      />
      {/**
       * มืออีกข้าง — อยู่บนแผ่นขาว (z สูงกว่า) เหมือนมือในภาพอ้างอิงที่อยู่บนพื้น ไม่ถูกพื้นทับ
       *
       * เป็นแคนวาสไม่ใช่ <img>: เนื้อในรูปขยับตามเมาส์แบบมีความลึก (ดู ./HandDepth) ส่วน
       * ตำแหน่ง/ความทึบมาจากไทม์ไลน์ข้างบนทั้งหมด จึงไม่ตั้ง left/top เป็นเปอร์เซ็นต์ที่นี่
       */}
      <HandDepth
        src={HAND}
        elRef={hand}
        className="pointer-events-none absolute left-0 top-0 z-40 max-w-none select-none"
        style={{
          opacity: 0,
          width: `${HAND_W * 100}vw`,
          /* แคนวาสไม่มีอัตราส่วนของตัวเองอย่าง <img> — ตั้งให้เท่าไฟล์รูป (991 × 461) ไม่งั้น
             มันสูงเท่าค่าเริ่มต้นของ canvas (150px) แล้วรูปถูกบีบ */
          aspectRatio: '991 / 461',
          display: 'block',
        }}
      />
    </>
  )
}
