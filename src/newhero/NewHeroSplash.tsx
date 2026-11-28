import { useEffect, useRef, useState } from 'react'
import { Logo } from '@/joespresso/Logo'
import { preloadSceneAssets } from '@/lib/preloadAssets'
import { useSceneProgress } from '@/stores/ready'
import { introSkip, releaseIntro } from './intro'
import { panelScreen } from './panelScreen'
import { useNewHeroReady } from './ready'

/**
 * สปแลชของ /new-hero — บังไว้จนของโหลดครบ แล้ว *มอร์ฟตัวเอง* เป็นบานหน้าต่างของฉาก
 *
 * รอสองอย่าง ไม่ใช่อย่างเดียว:
 *   1. ไบต์ของไฟล์ฉาก — วัดจริงจาก preloadSceneAssets (แถบที่เห็นคือสัดส่วนไบต์)
 *   2. ฉากรายงานว่าวาดได้จริง (useNewHeroReady) — ตัวละครขึ้นครบ, สั่งคอมไพล์ shader
 *      ทั้งฉากจบ, และเฟรมเดินเป็นปกติแล้ว ช่วงนี้วัดเป็นสัดส่วนไม่ได้ แถบจึงค้างเต็มรอ
 *
 * แล้วส่งไม้ต่อด้วยการมอร์ฟ ไม่ใช่จางออก: ตัวหนังสือ JOE แข็งตัวเป็นแผ่น → แผ่นไถลไปลงบน
 * ตำแหน่งของบานหน้าต่างจริง → พื้นน้ำเงินเปิดออกใต้แผ่น → แผ่นจางหายทิ้งบานจริงไว้ที่เดิม
 * ตาไม่เห็นรอยตัด เพราะเฟรมสุดท้ายของ HTML ทับกับพิกเซลของ 3D พอดี
 *
 * เป้าของแผ่นมาจากฉาก (panelScreen) ไม่ได้เดาเอง — ฉากรู้กล้อง มุมกลุ่ม และขนาดบานจริง
 * ลากสไลเดอร์ผังหน้าต่างแล้วปลายทางของการมอร์ฟก็เลื่อนตามเอง
 */

/** วินาทีที่ยอมรอ ก่อนจะเปิดให้ดูทั้งที่ยังไม่ได้สัญญาณ — กันหน้าค้างถ้ามีอะไรพัง */
const GIVE_UP_AFTER = 12000

/** ความยาวของการมอร์ฟทั้งท่อน (วินาที) */
const MORPH = 1.5
/** แผ่นถัดไปออกตัวช้ากว่ากันเท่าไร — ไล่ซ้ายไปขวาเหมือนที่บานเคยโผล่ทีละบาน */
const STAGGER = 0.07

/** กรอบ viewBox ของโลโก้ กับกรอบของตัวหนังสือจริงข้างใน (หน่วยเดียวกับ viewBox) */
const VIEW = { x: -10, y: -10, w: 259, h: 104 }
const GLYPH = { x: 0, y: 0, w: 239, h: 84 }

type Rect = { x: number; y: number; w: number; h: number }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** ไล่เข้า-ออกแบบเดียวกับที่ของในฉากใช้ ให้จังหวะการเคลื่อนเป็นภาษาเดียวกัน */
const inOut = (x: number) => {
  const u = clamp01(x)
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2
}

/**
 * กรอบของโลโก้บนจอ — preserveAspectRatio ปริยายคือ meet จึงมีขอบว่างด้านที่เหลือ
 * ต้องคิดสเกล/ออฟเซ็ตเอง ไม่ใช่เทียบสัดส่วนกับกรอบ DOM ตรง ๆ (คลาดทันทีที่อัตราส่วนไม่ตรง)
 */
function glyphRect(svg: SVGSVGElement): Rect {
  const box = svg.getBoundingClientRect()
  const scale = Math.min(box.width / VIEW.w, box.height / VIEW.h)
  const ox = box.left + (box.width - VIEW.w * scale) / 2
  const oy = box.top + (box.height - VIEW.h * scale) / 2
  return {
    x: ox + (GLYPH.x - VIEW.x) * scale,
    y: oy + (GLYPH.y - VIEW.y) * scale,
    w: GLYPH.w * scale,
    h: GLYPH.h * scale,
  }
}

export function NewHeroSplash({ onDone }: { onDone: () => void }) {
  const progress = useSceneProgress()
  const ready = useNewHeroReady()
  const [morphing, setMorphing] = useState(false)
  const veil = useRef<HTMLDivElement>(null)
  const mark = useRef<HTMLDivElement>(null)
  const svgBox = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const tiles = useRef<(HTMLDivElement | null)[]>([])
  const [tileCount, setTileCount] = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // ดึงไฟล์ฉากเองตั้งแต่เฟรมแรก — ไม่ต้องรอ chunk ของฉากโหลดเสร็จก่อนถึงจะเริ่มวัด
  useEffect(() => {
    void preloadSceneAssets()
  }, [])

  /**
   * ขอให้ฉากเริ่มฉายพิกัดบานตั้งแต่ยังโหลด — พอถึงจังหวะส่งไม้ต่อจะได้มีเป้าพร้อมอยู่แล้ว
   * ไม่ต้องรออีกเฟรม (และบานต้องข้ามท่าโผล่ของตัวเอง เพราะแผ่นของสปแลชเป็นคนพามันขึ้น)
   */
  useEffect(() => {
    panelScreen.want = true
    /**
     * ธงนี้ค้างไว้ ไม่คืนตอน unmount
     *
     * ถอนตอนสปแลชหายไป = บานกลับไปอยู่ในท่าโผล่ของตัวเองกลางทาง (นาฬิกาอินโทรเพิ่งเดินไป
     * ครึ่งวินาที ท่าโผล่ยาว 1.3 วิ) สิ่งที่เห็นคือบานที่เพิ่งลงที่ "ยุบกลับ" แล้วขยายใหม่
     * คนล้างธงคือ resetIntro/replayIntro — เล่นอินโทรใหม่โดยไม่มีสปแลช บานต้องโผล่เองตามเดิม
     */
    introSkip.windows = true
    introSkip.camera = true
    return () => {
      panelScreen.want = false
    }
  }, [])

  useEffect(() => {
    if (ready) setMorphing(true)
  }, [ready])

  // ยอมเปิดให้ดูทั้งที่ยังไม่ได้สัญญาณ ถ้ารอนานเกินไป — กันหน้าค้างถ้ามีอะไรพัง
  useEffect(() => {
    const id = setTimeout(() => setMorphing(true), GIVE_UP_AFTER)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!morphing) return undefined
    const svg = svgBox.current?.querySelector('svg')
    /**
     * ไม่มีเป้า (ฉากยังไม่ฉายพิกัด / ไม่มีบาน) = จางออกเฉย ๆ
     *
     * ทางถอยต้องมี ไม่ใช่ค้างรอเป้าที่อาจไม่มา: บานอาจถูกปิดจากแผงจูน หรือหน้าถูกเปิด
     * ตอนแท็บซ่อนอยู่ (ไม่มีเฟรมให้ฉายพิกัด)
     */
    /**
     * เอาเฉพาะบานที่ *อยู่ในจอจริง* มาเป็นเป้า
     *
     * แถบหน้าต่างวางเฉียง บานซ้ายสุดจึงใหญ่และล้นออกนอกจอไปเกือบทั้งใบ (วัดได้ x -740
     * กว้าง 647 บนจอ 1280) แผ่นที่วิ่งไปหามันคือก้อนขาวยักษ์ที่กวาดผ่านจอแล้วหายไปเฉย ๆ
     * ตัวหนังสือจึงถูกแบ่งเท่าจำนวนบานที่มีที่ยืนบนจอ ไม่ใช่จำนวนบานทั้งหมดในฉาก
     */
    const all: Rect[] = panelScreen.ready ? panelScreen.rects : []
    const onScreen = (r: Rect) => {
      const w = Math.min(r.x + r.w, window.innerWidth) - Math.max(r.x, 0)
      const h = Math.min(r.y + r.h, window.innerHeight) - Math.max(r.y, 0)
      return w > 0 && h > 0 ? (w * h) / (r.w * r.h) : 0
    }
    const picked = all.map((r, i) => ({ r, i })).filter((q) => onScreen(q.r) > 0.55)
    const rects: Rect[] = picked.map((q) => q.r)
    const from = svg ? glyphRect(svg as SVGSVGElement) : null
    if (!rects.length || !from) {
      if (veil.current) {
        veil.current.style.transition = 'opacity 420ms ease'
        veil.current.style.opacity = '0'
      }
      const id = setTimeout(() => onDoneRef.current(), 440)
      return () => clearTimeout(id)
    }

    setTileCount(rects.length)
    /**
     * ปล่อยอินโทรทันทีที่เริ่มมอร์ฟ ไม่ใช่รอให้มอร์ฟจบ
     *
     * กล้องของอินโทรเริ่มจากท่าที่ dolly เข้ามาใกล้ (inCamDolly) แล้วถอยออกใน 3 วิ — วัดแล้ว
     * ตอนนั้นบานที่หนึ่งกว้าง 968px และอยู่ที่ x -1263 คือพ้นจอไปทั้งใบ ถ้ารอมอร์ฟจบก่อนค่อย
     * ปล่อย คนดูจะเห็นแค่ตอนกล้องนิ่งแล้ว การถอยกล้องซึ่งเป็นครึ่งหนึ่งของอินโทรก็หายไปกับพื้น
     * ทึบ ปล่อยก่อนแล้วให้แผ่น "ไล่ตาม" บานที่กำลังเลื่อนแทน
     */
    releaseIntro()
    /** แบ่งตัวหนังสือเป็นแผ่นเท่าจำนวนบาน — แผ่นที่ i เริ่มจากช่วงที่ i ของคำ */
    const gap = from.w * 0.005
    const slice = (i: number): Rect => ({
      x: from.x + (from.w / rects.length) * i + gap / 2,
      y: from.y,
      w: from.w / rects.length - gap,
      h: from.h,
    })

    let raf = 0
    const t0 = performance.now()
    const step = () => {
      const now = (performance.now() - t0) / 1000
      const all = clamp01(now / MORPH)

      // ตัวหนังสือแข็งตัวเป็นแผ่น: กลืนเข้าหากันในที่เดิม ไม่ได้กระพริบสลับ
      if (mark.current) mark.current.style.opacity = `${1 - clamp01((now / MORPH - 0.06) / 0.26)}`
      if (bar.current) bar.current.style.opacity = `${1 - clamp01(now / (MORPH * 0.14))}`

      // พื้นน้ำเงินเปิดออก *ใต้* แผ่น จึงไม่เห็นรอยตัด — เริ่มตอนแผ่นไปได้เกือบครึ่งทาง
      if (veil.current) {
        veil.current.style.opacity = `${1 - inOut((now / MORPH - 0.16) / 0.5)}`
      }

      for (let i = 0; i < rects.length; i += 1) {
        const el = tiles.current[i]
        if (!el) continue
        const src = slice(i)
        /**
         * เป้าเป็นค่า *สด* ของเฟรมนี้ ไม่ใช่ค่าที่จับไว้ตอนเริ่ม
         *
         * บานกำลังเลื่อน/ย่อตามกล้องที่ถอยออก ถ้าเล็งไปที่ค่าเก่า แผ่นจะไปจอดที่ตำแหน่งที่
         * บานเคยอยู่ แล้วเฟรมสุดท้ายก็ไม่ทับกัน — รอยตัดที่ตั้งใจซ่อนโผล่ตรงนั้นพอดี
         */
        const dst = panelScreen.rects[picked[i].i] ?? rects[i]
        // ค้างอยู่บนตัวหนังสือก่อนออกตัว — ช่วงนั้นคือที่ที่ตัวหนังสือกลืนเป็นแผ่นพอดี
        const u = inOut((now - MORPH * 0.1 - i * STAGGER) / (MORPH * 0.66))
        const w = src.w + (dst.w - src.w) * u
        const h = src.h + (dst.h - src.h) * u
        const x = src.x + (dst.x - src.x) * u
        const y = src.y + (dst.y - src.y) * u
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`
        el.style.width = `${w}px`
        el.style.height = `${h}px`
        // มุมมนของบานเป็นสัดส่วนของด้านสั้น (ดู Panel) คิดจากขนาดที่แผ่นเป็นอยู่จริงตอนนี้
        el.style.borderRadius = `${4 + (Math.min(w, h) * 0.17 - 4) * u}px`
        /**
         * จางทิ้งบานจริงไว้ตอนท้าย และจางเร็วขึ้นถ้าบานใบนั้นหลุดออกนอกจอไปแล้ว
         * (กล้องช่วงต้นดันบานซ้ายสุดออกไปพ้นขอบ แผ่นที่ไล่ตามมันก็ต้องไม่ค้างเป็นก้อนขาวที่ขอบ)
         */
        const off = clamp01((-(x + w) + 40) / 240) + clamp01((x - window.innerWidth + 40) / 240)
        el.style.opacity = `${
          clamp01(now / (MORPH * 0.08)) *
          (1 - clamp01((now / MORPH - 0.78) / 0.22)) *
          (1 - clamp01(off))
        }`
      }

      if (import.meta.env.DEV) {
        ;(window as unknown as { __morph?: unknown }).__morph = { u: +all.toFixed(3) }
      }
      if (all < 1) raf = requestAnimationFrame(step)
      else onDoneRef.current()
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [morphing])

  const pct = Math.round(progress * 100)

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {/* พื้นทึบ — ชั้นล่างสุด เปิดออกใต้แผ่นที่กำลังไถล */}
      <div
        ref={veil}
        className="absolute inset-0 bg-[#265ada]"
        style={{ pointerEvents: morphing ? 'none' : 'auto' }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <div ref={mark} className="flex flex-col items-center gap-6">
          <div ref={svgBox}>
            <Logo width={104} height={36} className="" />
          </div>
          {/* แถบคือสัดส่วนไบต์จริง — เต็มแล้วค้างรอ shader คอมไพล์ ไม่มีตัวเลขปลอมวิ่งต่อ */}
          <div ref={bar} className="h-[3px] w-[180px] overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${pct}%`, transition: 'width 200ms linear' }}
            />
          </div>
        </div>
      </div>
      {/* แผ่นที่ไถลไปลงบนบาน — วางที่ 0,0 แล้วเลื่อนด้วย transform (ไม่แตะ layout ทุกเฟรม) */}
      {Array.from({ length: tileCount }, (_, i) => (
        <div
          key={i}
          ref={(n) => {
            tiles.current[i] = n
          }}
          className="absolute top-0 left-0 bg-[#f2f3f5]"
          style={{ opacity: 0, willChange: 'transform, width, height' }}
        />
      ))}
    </div>
  )
}
