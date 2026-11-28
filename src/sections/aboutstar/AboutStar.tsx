import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { useCursorStop } from '@/cursorguide/useCursorStop'
import { cursorShow, cursorWake } from '@/cursorguide/morph'
import { stageIn } from '@/sections/whatidocard/stageTuner'
import { SkillTiles } from './SkillTiles'
import { portalScreenBox } from './portalShape'
import { getStarTuner } from './starTuner'
import { WhiteWrap } from '@/sections/whatidocard/WhiteWrap'

/**
 * จอ About — พอร์ทัลรูปดาวสี่แฉกที่ตัวละครโผล่ออกมา ข้อความอยู่ครึ่งซ้าย
 *
 * แทนจอ "สิ่งที่ทำ" ที่เคยอยู่ตรงนี้ (การ์ดโพสต์ + ป้ายสกิลสามใบ) ตามที่สั่งว่า *ซ่อน*
 * ของเก่าไปก่อน ไม่ใช่ลบ — ของเดิมยังครบทั้งชุดที่ sections/whatidocard สลับ import
 * กลับที่ pages/Portfolio2026FinalPage ได้ตรง ๆ (ท่าเดียวกับที่จอนั้นเองเคยแทน
 * sections/whatidopixel)
 *
 * ### ท่าเข้าฉาก
 *
 * จอแรกส่งมอบมาด้วยพื้นทึบ (ม่านเมฆตัดทิ้งเฟรมเดียว ไม่จาง — ดู WIPE_FULL ใน
 * components/CloudWipe) จอนี้จึงเริ่มจากพื้นเปล่า แล้ว *ดาวขยายจากเล็กมาใหญ่* ตามระยะเลื่อน
 * จากนั้นตัวละครลอยขึ้นมาจากในดาว — ฉากอยู่ที่ ./StarStage ซึ่งอ่านระยะเดียวกันนี้ (stageIn)
 *
 * ตัวหนังสืออยู่ใน DOM ไม่ใช่ใน canvas — ตัวอักษรใน texture คมสู้ตัวอักษรของเบราว์เซอร์
 * ไม่ได้ และเลือก/อ่านออกเสียงไม่ได้ด้วย
 *
 * ท่าปิดจอ (ขาวห่อฉากแล้วส่งต่อจอถัดไป พร้อมเคอร์เซอร์มือชี้) ยังเป็นตัวเดิมทั้งอัน —
 * มันเป็นท่า *ส่งต่อ* ระหว่างจอ ไม่ใช่ของในจอนี้ (ดู whatidocard/WhiteWrap)
 */

const StarStage = lazy(() => import('./StarStage').then((m) => ({ default: m.StarStage })))

/**
 * **ชั้นรอยสาดถอดออกชั่วคราวตามที่สั่ง** — ของยังพร้อมกลับมาทั้งชุด
 *
 * ตัวคอมโพเนนต์อยู่ที่ whatidocard/SplashReveal (จำลองของไหลบน WebGL ใช้ความเข้มสีย้อม
 * เป็นหน้ากากเปิดรูปจริง) และ *สะพาน* ที่ทำให้มันตัดตามรูปดาวก็ยังอยู่ครบ: ฉากเขียนกรอบ
 * ดาวเป็นสัดส่วนจอลงกล่องกลางทุกเฟรม (ดู starScreen/portalScreenBox ใน ./portalShape) และ
 * เชดเดอร์ของมันมีสาขาทดสอบ superellipse รออยู่แล้ว
 *
 * เอากลับมา: `lazy` ตัวเดิม แล้ววาง
 * `<SplashReveal photo="/photos/joe-portrait.jpg" live={live} place={...} star={portalScreenBox} />`
 * ไว้เหนือแคนวาสของฉาก (ต้องอยู่เหนือ — ถ้าอยู่ใต้ รูปจะโผล่ได้แค่ที่ว่างนอกดาว ซึ่งไม่มีใคร
 * เอาเมาส์ไปไถ) พร้อมคืนคีย์ phZoom/phX/phY ใน ./starTuner สำหรับเล็งรูปให้ทับหัว
 */

/**
 * แผงจูนของจอนี้ — โหลดเฉพาะตอน dev
 *
 * แยกไฟล์เพราะค่าที่มันเขียนอยู่ในสโตร์เปล่า ๆ (./starTuner) ซึ่งฉากอ่านโดยไม่ต้องรู้จักแผง
 */
const StarPanel = lazy(() => import('./StarPanel').then((m) => ({ default: m.StarPanel })))

/** ระยะเลื่อน (เท่าของความสูงจอ) ที่ใช้พาของทั้งจอเข้าที่ */
const IN_SPAN = 0.55

/**
 * ระยะเลื่อนของ **การเล่าเรื่องสกิล** — ยาวกว่าท่าเข้าฉากหลายเท่า
 *
 * ท่าเข้าฉาก (`--in`) จบเร็วเพราะมันแค่พาของขึ้นเวที ส่วนการเล่าต้องมีเวลาให้อ่าน: แผ่นกาง
 * ทีละอัน ค้างให้อ่านจบ แล้วหุบก่อนอันถัดไปกาง (ดู ORDER ใน ./SkillTiles) สามอันกินเวลา
 * ราวหนึ่งจอครึ่งของการเลื่อน — ถ้าใช้ `--in` ตัวเดียว ทั้งสามอันต้องเบียดกันใน 0.55 จอ
 */
const TELL_SPAN = 1.5

/**
 * ระยะที่ท่าปิดจอจุดชนวน — **หลังเรื่องเล่าจบ** ไม่ใช่ค่าปริยายของ WhiteWrap (0.72)
 *
 * แผ่นสกิลอันสุดท้ายหุบจบราว 1.05 เท่าของ TELL_SPAN เว้นอีกหน่อยให้จอนิ่งก่อนขาว
 * ถ้าใช้ค่าปริยาย เรื่องจะถูกปิดกลางอันที่สอง (เจอมาแล้ว: ที่ 1.1 จอเป็นขาวแล้ว)
 */
const WRAP = TELL_SPAN * 1.05 + 0.25

/** ยกข้อความขึ้นมาจากใต้จอกี่ส่วนของความสูงจอ — ตัวหนังสือมาก่อนดาว */
const LIFT = { head: 0.22, body: 0.34 }

/* ย่อหน้า Lorem ของจอนี้ถูกถอดออกพร้อมกับการเอาวงล้อสกิลมาไว้ด้านซ้าย — ดูใน JSX */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => v * v * (3 - 2 * v)

/**
 * พื้นของจอ — ม่วงอ่อนไล่สีตามภาพอ้างอิง
 *
 * สองชั้น: แสงกลม ๆ หลังดาวทางขวา แล้วพื้นไล่ทะแยงทั้งจอ ดาวจึงดูเรืองมาจากพื้นหลัง
 * ไม่ใช่รูปที่แปะอยู่บนพื้นเรียบ ไล่สีเป็นของ CSS ไม่ใช่ของในฉาก — แคนวาสของฉากโปร่ง
 * (`alpha: true`) พื้นนี้จึงเป็นตัวเดียวกันทั้งใต้ดาวและใต้ข้อความ
 */
/** ขาวของท่าปิดจอก่อนหน้า — พื้นตั้งต้นของจอนี้ต้องเป็นสีเดียวกันเป๊ะ ไม่งั้นรอยต่อเป็นขั้น */
const WHITE = '#ffffff'

const BG = [
  'radial-gradient(48% 54% at 66% 42%, rgba(219,208,252,0.92) 0%, rgba(219,208,252,0) 72%)',
  'linear-gradient(158deg, #f6f3fe 0%, #ece6fc 48%, #e2d9f8 100%)',
].join(',')

export function AboutStar({ id = 'what-i-do' }: { id?: string }) {
  const section = useRef<HTMLElement>(null)
  /** จออยู่ในสายตาหรือยัง — สวิตช์ลูปวาดของฉาก ไม่ให้กินเฟรมตอนอยู่จออื่น */
  const [live, setLive] = useState(false)
  /** ชั้นที่ต้องเลื่อนเข้าที่ — เขียน transform ลง DOM ตรง ๆ ไม่ผ่าน state */
  const pin = useRef<HTMLDivElement>(null)
  /** หมุดของเคอร์เซอร์ในท่าปิดจอ — ของเปล่าที่วางไว้ตามระยะเลื่อน (ดู cursorguide/stops) */
  const wrapAim = useRef<HTMLDivElement>(null)
  /**
   * หมุดสองอันของเคอร์เซอร์ในจอนี้ — **วางตามกล่องจริงของดาวบนจอ ไม่ใช่กะเป็น %**
   *
   * ดาวย้ายที่/เปลี่ยนขนาดได้จากแผงจูน (sX/sY/sRx/sRy/มุมเอียง) และยังโตขึ้นตามระยะเลื่อน
   * หมุดที่กะเป็นสัดส่วนจอไว้ตายตัวจะหลุดออกจากดาวทันทีที่ใครลากสไลเดอร์ — `portalScreenBox`
   * เป็นเจ้าของกล่องนั้นอยู่แล้ว (ฉากเขียนทุกเฟรม ดู ./portalShape) ที่นี่แค่อ่านไปวางหมุด
   */
  const starAim = useRef<HTMLDivElement>(null)
  const decoAim = useRef<HTMLDivElement>(null)
  /** จังหวะของจุดจอด = หัวอ่านที่กี่เท่าความสูงจอ — คิดจากที่ยืนของ section ในหน้า */
  const [headVh, setHeadVh] = useState(0)
  /** แถบภาพของการ์ด — หมุดเคอร์เซอร์ต้องแปลงพิกัดดาวผ่านกล่องนี้ ไม่ใช่เทียบทั้งจอ */
  const band = useRef<HTMLDivElement>(null)

  /**
   * ปุ่มกากบาทของการ์ด = ข้ามไปจอถัดไป
   *
   * เลื่อนไปที่ *ท้าย* section นี้ ไม่ใช่หา element ของจอถัดไป: จอนี้สูงกว่าหนึ่งจอเพราะ
   * ระยะที่เกินคือท่าเข้าฉากกับท่าปิดจอ ปลายทางที่ถูกจึงเป็นจุดที่ท่าปิดจอเล่นจบแล้ว
   * (ดู WRAP ข้างบน) — ใช้ระยะเดียวกับที่ท่านั้นคิด ไม่ใช่เลขที่เดา
   */
  const skip = () => {
    const sec = section.current
    if (!sec) return
    const vh = window.innerHeight || 1
    window.scrollTo({
      top: sec.offsetTop + (WRAP + 1) * vh,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    const el = section.current
    if (!el) return
    const io = new IntersectionObserver((es) => setLive(es[0].isIntersecting), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /**
   * พาของเข้าที่ตามระยะเลื่อน — อ่านครั้งเดียวต่อเฟรมใน rAF ไม่ใช่ทุก event ของ scroll
   *
   * ค่าที่เขียนคือ `--in` ตัวเดียว (0 = ยังอยู่ใต้จอ, 1 = เข้าที่) แต่ละชั้นคูณด้วยระยะยก
   * ของตัวเองใน CSS และระยะเดียวกันไปคุมท่าขยายของดาวในฉาก 3D (ดู stageIn) — ส่งเป็นค่าดิบ
   * ฉากมี easing ของตัวเองต่อชิ้น
   */
  useEffect(() => {
    const sec = section.current
    const el = pin.current
    if (!sec || !el) return undefined
    let raf = 0
    const read = () => {
      raf = 0
      const vh = Math.max(1, window.innerHeight)
      const r = sec.getBoundingClientRect()
      const y = Math.max(0, -r.top)
      const e = clamp01(y / (vh * IN_SPAN))
      /**
       * หัวอ่าน (กลางจอ) ตอน section เริ่ม — จังหวะของจุดจอดคิดต่อจากค่านี้
       *
       * ค่านี้เปลี่ยนเฉพาะตอนผังหน้าเปลี่ยน (โหลดฟอนต์ ย่อจอ) ไม่ใช่ตอนเลื่อน — ตั้ง state
       * เฉพาะเมื่อขยับจริงเกินหนึ่งในร้อยของจอ ไม่งั้น reconcile ทั้งกิ่งทุกเฟรมที่เลื่อน
       */
      const hv = (r.top + window.scrollY) / vh + 0.5
      setHeadVh((prev) => (Math.abs(prev - hv) > 0.01 ? hv : prev))
      el.style.setProperty('--in', smooth(e).toFixed(4))
      /* ความคืบหน้าของการเล่าเรื่อง — ดิบ ไม่ผ่าน easing เพราะแต่ละแผ่นมีเส้นโค้งของตัวเอง */
      el.style.setProperty('--tell', clamp01(y / (vh * TELL_SPAN)).toFixed(4))
      /**
       * หมุดเคอร์เซอร์เกาะกล่องของดาว — กลางดาว และเยื้องไปข้างบนซ้ายของแฉกซ้าย
       *
       * `portalScreenBox` เป็นสัดส่วนของจอ (0..1) และแคนวาสของฉากกางเต็มกลุ่มที่ตรึงไว้
       * จึงแปลงเป็น % ของกลุ่มนี้ได้ตรง ๆ ไม่ต้องวัด rect ของแคนวาสอีกชั้น
       */
      /**
       * หมุดเคอร์เซอร์: กล่องของดาวเป็นสัดส่วนของ *แคนวาส* ต้องแปลงผ่านกรอบของแคนวาสก่อน
       *
       * แคนวาสไม่ได้กางเต็มจออีกแล้ว มันอยู่ในแถบภาพของการ์ด (ชิดขวา กว้าง 62% ของแถบ)
       * ถ้าเอาสัดส่วนไปคูณกับขนาดกลุ่มที่ตรึงไว้ตรง ๆ หมุดจะไปอยู่กลางจอทั้งที่ดาวอยู่ในการ์ด
       */
      const bd = band.current
      if (portalScreenBox.ready && bd) {
        const br = bd.getBoundingClientRect()
        const pr = el.getBoundingClientRect()
        /* แคนวาสกินขอบขวาของแถบ 58% — ค่าเดียวกับคลาสในกล่องที่ครอบมัน */
        const cw = br.width * 0.58
        const cx0 = br.left - pr.left + (br.width - cw)
        const cy0 = br.top - pr.top
        const px = (fx: number) => `${(cx0 + fx * cw).toFixed(1)}px`
        const py = (fy: number) => `${(cy0 + fy * br.height).toFixed(1)}px`
        /**
         * บอกโมเสกว่าขอบซ้ายของวงเล็บอยู่ตรงไหน — **ชิดกันด้วยการวัด ไม่ใช่ด้วยการกะ**
         *
         * ref ให้แผ่นโมเสกไปจบตรงด้านแบนของวงเล็บพอดี ตำแหน่งนั้นขึ้นกับทั้งค่าในแผงจูน
         * (sX/sRx/มุมเอียง) และขนาดของกรอบรูป จะกะเป็น % ไว้ตายตัวไม่ได้ — ฉากเขียนกล่อง
         * ของรูปเป็นสัดส่วนของแคนวาสอยู่แล้ว (portalScreenBox) ที่นี่แปลงเป็นสัดส่วนของ
         * แถบภาพแล้วส่งต่อเป็นตัวแปร CSS ให้โมเสกยึดขอบขวาของตัวเองกับมัน
         */
        const leftFrac = (br.width - cw) / br.width + (portalScreenBox.x - portalScreenBox.hw) * (cw / br.width)
        bd.style.setProperty('--tile-right', `${((1 - Math.min(1, Math.max(0, leftFrac))) * 100).toFixed(2)}%`)
        const sa = starAim.current
        if (sa) {
          /* ปากพอร์ทัล: เยื้องลงซ้ายจากใจกลาง — ใจกลางมีหัวตัวละครอยู่ ลูกศรจะไปทับหน้าเขา */
          sa.style.left = px(portalScreenBox.x - portalScreenBox.hw * 0.28)
          sa.style.top = py(portalScreenBox.y + portalScreenBox.hh * 0.3)
        }
        const da = decoAim.current
        if (da) {
          /* ที่ประดับ: เหนือแฉกซ้ายของดาว พ้นตัวรูปออกมา ไม่ใช่ทับบนเนื้อดาว */
          da.style.left = px(portalScreenBox.x - portalScreenBox.hw * 1.02)
          da.style.top = py(portalScreenBox.y - portalScreenBox.hh * 0.62)
        }
      }
      /**
       * เคอร์เซอร์ "มี/ไม่มี" บนจอ — โผล่ออกมาจากพอร์ทัลดาวตอนดาวกางพอให้มีช่อง
       *
       * เขียนเฉพาะตอนจอนี้ใกล้เข้ามาแล้ว: ลูปนี้เดินทุกครั้งที่เลื่อนหน้า ถ้าเขียนตลอด ค่าจะ
       * เป็นศูนย์ตั้งแต่อยู่จอแรก (e = 0) แล้วไปลบเคอร์เซอร์ของจอแรกทิ้ง — จอแรกเป็นคนคุม
       * ช่วงของตัวเอง (ดู pages/Portfolio2026FinalPage)
       */
      if (r.top < vh * 0.9) {
        cursorShow.v = smooth(clamp01((e - 0.3) / 0.26))
        cursorWake.fn()
      }
      /* ไล่สีพื้นเดินตามท่าขยายของดาว (bSpan) ไม่ใช่ระยะของจอทั้งจอ — ดูชั้น --bg ใน JSX */
      el.style.setProperty('--bg', smooth(clamp01(e / Math.max(0.05, getStarTuner().bSpan))).toFixed(4))
      stageIn.v = e
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    read()
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  /**
   * จุดจอดสุดท้ายของจอ: มือ/เคอร์เซอร์ที่ยื่นเข้าไปในช่องที่ยังเหลือ
   *
   * จอนี้ไม่มีป้ายสกิลให้ชี้แล้ว (ของเก่าถูกซ่อน) เหลือจุดจอดของท่าปิดจออันเดียว
   */
  /**
   * ลำดับในจอนี้: โผล่จากในดาว (เมล็ดขนาดศูนย์) → กางออกที่ปากพอร์ทัล → ไปประดับข้างดาว
   *
   * จุด "เมล็ด" มีขนาดศูนย์เพราะทางที่มันบินมาจากจอแรกพาดผ่านม่านเมฆ ถ้าจุดนี้มีขนาด
   * ลูกศรจะค่อย ๆ ย่อลงให้เห็นตลอดทางระหว่างสองจอ แทนที่จะ *โผล่* ออกมาจากพอร์ทัล
   * (ตัวย่อหายของชั้นเคอร์เซอร์ก็ช่วยอีกชั้น — ดู cursorShow ในลูปข้างบน)
   *
   * จังหวะผูกกับ `headVh` ของ section ไม่ใช่กับตำแหน่งของหมุด: หมุดอยู่ในกลุ่มที่ถูกตรึง
   * (sticky) พิกัดหน้าของมันเลื่อนตามจอไปด้วย ใช้เป็นจังหวะแล้วจะได้ค่าที่ไม่เดินหน้า
   */
  useCursorStop(starAim, { id: 'about-star-seed', keyVh: headVh + 0.24, size: 0, tilt: -18 })
  useCursorStop(starAim, { id: 'about-star-out', keyVh: headVh + 0.46, size: 52, tilt: -14, lift: 0 })
  useCursorStop(decoAim, { id: 'about-star-deco', keyVh: headVh + 0.74, size: 64, tilt: -34, lift: 30 })
  /**
   * ท่าปิดจอ — ต้องมี `keyVh` ของตัวเอง ไม่ใช่ปล่อยให้จังหวะมาจากที่ยืนของหมุด
   *
   * หมุดอยู่ในกลุ่มที่ถูกตรึง (sticky) พิกัดหน้าของมันเลื่อนตามจอ จังหวะที่คิดจากพิกัดนั้น
   * จึงวิ่งหนีหัวอ่านไปเรื่อย ๆ — ผลคือจุดจอด "ประดับข้างดาว" ไม่เคยเป็นจุดสุดท้ายจริง
   * ลูกศรเลยไถลเลยมันไปทางซ้ายเรื่อย ๆ ทั้งที่ควรจอดนิ่ง (วัดจากภาพ: จอดที่ x 645 ทั้งที่
   * หมุดอยู่ราว 960)
   */
  useCursorStop(wrapAim, { id: 'about-wrap', keyVh: headVh + WRAP + 0.5, size: 132, tilt: -128, lift: 90 })

  /** ยกขึ้นจากใต้จอตามค่า --in ของกลุ่ม (1 - in = ยังเหลือระยะอีกเท่าไร) */
  const rise = (k: number): React.CSSProperties => ({
    transform: `translate3d(0, calc((1 - var(--in, 0)) * ${k * 100}svh), 0)`,
  })

  return (
    <section
      id={id}
      data-screen={id}
      ref={section}
      /* สูงกว่าหนึ่งจอ — ระยะที่เกินคือระยะเลื่อนของท่าเข้าฉาก ของจริงถูกตรึงไว้ข้างใน
         ท่อนท้ายคือระยะของท่าปิดจอ (ดู whatidocard/WhiteWrap) ไม่ใช่ที่ว่างเปล่า ๆ */
      className="relative h-[260svh] w-full text-[#241154]"
      /* พื้นของ *ตัวจอ* เป็นขาว = สีเดียวกับท่าปิดของจอก่อนหน้า รอยต่อจึงไม่มีขั้น
         พื้นเข้มเป็นชั้นแยกที่จางเข้ามาพร้อมของในจอ (ดู --bg ข้างล่าง) */
      style={{ background: WHITE }}
    >
      <div ref={pin} className="sticky top-0 h-[100svh] overflow-clip" style={{ ['--in' as string]: 0 }}>
        {/**
         * พื้นเข้มของจอ — จางเข้ามา *พร้อมกับของในจอ* ไม่ใช่ติดมากับตัวจอตั้งแต่ต้น
         *
         * เดิมพื้นเป็น background ของ section: จอก่อนหน้าปิดด้วยขาวเต็มจอ พอเลื่อนพ้นขอบ
         * section สีทั้งจอก็เปลี่ยนในเฟรมเดียว — ขั้นที่ตาจับได้ทันทีเพราะทุกพิกเซลเปลี่ยน
         * พร้อมกันโดยไม่มีอะไรในฉากเปลี่ยนตาม
         */}
        <div className="pointer-events-none absolute inset-0" style={{ background: BG, opacity: 'var(--bg, 0)' }} />

        {/**
         * หมุดของเคอร์เซอร์ — ของเปล่าขนาดศูนย์ ตำแหน่งเขียนจากกล่องของดาวในลูปเลื่อน
         *
         * ต้องเป็น element จริง เพราะ cursorguide/stops เกาะ `getBoundingClientRect` ของ
         * หมุด (จุดจอดต้องตามของในจอ ไม่ใช่ตัวเลขที่กะไว้) — ดู starAim/decoAim ข้างบน
         */}
        <div ref={starAim} className="pointer-events-none absolute h-0 w-0" aria-hidden />
        <div ref={decoAim} className="pointer-events-none absolute h-0 w-0" aria-hidden />

        {/**
         * ผังตามภาพอ้างอิงแต่ **เต็มจอ** ไม่ใช่การ์ด
         *
         * ต้นแบบเป็นการ์ดลอยบนพื้น (ขอบมน เส้นขอบจาง เงาใต้แผ่น) — เจ้าของงานดูของจริง
         * แล้วสั่งให้เต็มจอ จึงเหลือเฉพาะ *โครงสามแถบ* ของมัน: หัวเรื่องตัวโต แถบภาพ
         * และแถบข้อมูลโมโนสเปซ คั่นด้วยเส้นบางเต็มความกว้างจอ ไม่มีกรอบ ไม่มีมุมมน
         *
         * ของเก่าของจอนี้ (หัวเรื่อง About me + ย่อหน้า Lorem + โมเสกใต้ข้อความ) ถูกยกทิ้ง
         * ทั้งชุดตามที่สั่ง
         */}
        <div
          className="absolute inset-0 flex flex-col"
          style={{ ['--band' as string]: 'clamp(300px, 62svh, 720px)' }}
        >
          {/* แถบหัว: ชื่อจอตัวโต + ปุ่มไปจอถัดไป */}
          <div
            className="flex flex-none items-center justify-between gap-6 px-[clamp(18px,4vw,72px)] py-[clamp(14px,2.6vw,34px)]"
            style={rise(LIFT.head)}
          >
            <h2 className="text-[clamp(38px,8.4vw,132px)] font-extrabold leading-[0.92] tracking-[-0.03em] text-[#1c1040]">
              WHAT I DO
            </h2>
            {/**
             * ปุ่มปิดของต้นแบบ — ที่นี่เป็น *ปุ่มจริง* ที่เลื่อนไปจอถัดไป
             *
             * กากบาทที่กดแล้วไม่มีอะไรเกิดขึ้นคือปุ่มหลอก หน้านี้เล่าเรื่องด้วยการเลื่อนจอ
             * การกดจึงหมายถึง "ข้ามจอนี้ไป" ซึ่งเป็นสิ่งเดียวที่ปิดจอนี้ได้จริง
             */}
            <button
              type="button"
              onClick={skip}
              aria-label="ข้ามไปจอถัดไป"
              className="pointer-events-auto grid h-12 w-12 flex-none cursor-pointer place-items-center text-[#6b46e8] transition-colors hover:text-[#1c1040]"
            >
              <IconX size={30} stroke={2} />
            </button>
          </div>

          {/* แถบภาพ: โมเสกซ้าย บรรจบกับงานภาพสามมิติที่กินขอบขวา — เต็มความกว้างจอ */}
          <div
            ref={band}
            className="relative w-full flex-none overflow-hidden border-y border-[#d6ccf6]"
            style={{ height: 'var(--band)' }}
          >
            {/**
             * ฉาก 3D อยู่ *ในแถบภาพ* ไม่ใช่กางเต็มจอ
             *
             * แคนวาสวัดขนาดจากกล่องที่ครอบมัน กล้องออร์โธของฉากจึงจัดกรอบใหม่ให้เอง
             * (ดู Fit ใน ./StarStage) ตำแหน่งและขนาดดาวยังมาจากแผงจูนเหมือนเดิม
             */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[58%]">
              {live && (
                <Suspense fallback={null}>
                  <StarStage />
                </Suspense>
              )}
            </div>

            {/* โมเสกแผ่นสกิล — ไล่ขั้นบันไดจากมุมซ้ายล่างไปบรรจบกับรูป */}
            <SkillTiles />
          </div>

          {/* แถบล่าง: ข้อมูลโมโนสเปซ คั่นด้วยสี่เหลี่ยมทึบเหมือนต้นแบบ (ไม่ใช้สี) */}
          <div
            className="flex flex-wrap items-center gap-[clamp(10px,1.8vw,26px)] px-[clamp(18px,4vw,72px)] py-[clamp(12px,2vw,26px)] font-mono text-[clamp(12px,1.5vw,22px)] uppercase tracking-[0.14em] text-[#4a3a7d]"
            style={rise(LIFT.body)}
          >
            <span>research</span>
            <span className="h-[0.62em] w-[0.62em] flex-none bg-[#7c5cf0]" aria-hidden />
            <span>design</span>
            <span className="h-[0.62em] w-[0.62em] flex-none bg-[#7c5cf0]" aria-hidden />
            <span>coding</span>
          </div>
        </div>

        {/* แผงจูนฉาก — dev เท่านั้น อยู่นอกชั้นที่เลื่อน เพราะมันไม่ใช่ของในจอ */}
        {import.meta.env.DEV && live && (
          <Suspense fallback={null}>
            <StarPanel />
          </Suspense>
        )}

        {/* ท่าปิดจอ — ขาวห่อฉากจนสนิทแล้วส่งต่อจอถัดไป (ดู whatidocard/WhiteWrap) */}
        <WhiteWrap sectionRef={section} at={WRAP} />
      </div>

      {/**
       * หมุดของเคอร์เซอร์ในท่าปิดจอ — อยู่นอกกล่องที่ถูกตรึง
       *
       * ต้องอยู่นอก: ของในกล่อง sticky ค้างอยู่ที่เดิมบนหน้าตลอดช่วงที่ตรึง จังหวะของจุดจอด
       * (ซึ่งคิดจากตำแหน่งในหน้า) จึงจะไม่เดินตามระยะเลื่อน +0.5 คือครึ่งจอของหัวอ่าน
       */}
      <div
        ref={wrapAim}
        className="pointer-events-none absolute left-[34%] h-0 w-0"
        style={{ top: `${(WRAP - 0.06 + 0.5) * 100}svh` }}
        aria-hidden
      />
    </section>
  )
}
