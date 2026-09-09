import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { Text3D } from '@react-three/drei'
import * as THREE from 'three'
import { useNewHeroReady } from '@/newhero/ready'
import { introTime } from '@/newhero/intro'

/**
 * หัวเรื่องจอแรกเป็นตัวอักษรสามมิติจริง — เรขาคณิตอัดขึ้นรูปจากเส้นของฟอนต์เดียวกับหน้า
 *
 * ทำไมไม่ยัดเข้าฉาก hero: หัวเรื่องอยู่ในคอลัมน์ที่ HTML จัดวางให้ (ฟองคำพูดกับคำว่า LIFE
 * ยังไหลตามมันอยู่) ถ้าย้ายเข้าฉากต้องจำลองการจัดวางทั้งบล็อกจากกรอบภาพกล้องใหม่หมด
 *
 * ทั้งบล็อกใช้ "แคนวาสใบเดียว" ไม่ใช่ใบต่อบรรทัด — สามใบคือสามบริบท WebGL สามลูปวาด
 * (วัดตอนอินโทร: 58.4fps เหลือ 45.6fps) ใบเดียวคุมได้ทั้งสามบรรทัดเพราะแต่ละบรรทัดบอก
 * กรอบของตัวเองผ่าน context แล้วแคนวาสวางกลุ่มตัวอักษรตามกรอบนั้น
 *
 * วาดตามคำขอ (demand): ขอเฟรมเมื่อเมาส์ขยับหรือตัวอักษรยังไม่เข้าที่ นอกนั้นหยุดสนิท
 */

const FONT = '/fonts/momo-trust-display.json'

/**
 * ขอบเผื่อรอบบล็อก (พิกเซล) — แคนวาสกางเกินกล่องข้อความไปทุกด้าน
 *
 * ตัวอักษรมีความหนาและถูกผลักออกจากที่เดิมได้ ถ้าแคนวาสพอดีกล่อง ขอบจะตัดสันข้างและตัวที่
 * ถูกผลักจนหายไปครึ่งตัว
 */
const PAD = 46

/**
 * วินาทีของนาฬิกาอินโทรที่ถือว่า "อินโทรเล่นจบแล้ว" — ก่อนหน้านั้นห้ามประกอบตัวอักษร
 *
 * การสร้าง TextGeometry ทีละตัว (สิบกว่าตัว) และการเปิดบริบท WebGL ใหม่ ทำบนเธรดเดียวกับ
 * ที่อินโทรของฉากกำลังเล่นอยู่ ทำพร้อมกันแล้วอินโทรสะดุดตรงนั้นพอดี ผูกกับนาฬิกาของอินโทรเอง
 * ไม่ใช่ตัวจับเวลาที่เดาเอา — อินโทรช้าเร็วตามเครื่อง ตัวจับเวลาคงที่จึงไปทับได้อยู่ดี
 */
const INTRO_AFTER = 6.5

/** มิลลิวินาทีหลังฉากพร้อม ที่จะยอมขึ้นหัวเรื่องแม้อินโทรจะยังไม่รายงานว่าจบ */
const FALLBACK_AFTER = 9000

/** รัศมีที่เริ่มผลัก (em ของตัวอักษร) */
const RADIUS = 1.6
/** ระยะผลักสูงสุดตอนเคอร์เซอร์ทับใจกลางตัวอักษรพอดี */
const PUSH = 0.34
/** ระยะที่ตัวอักษรลอยเข้าหาคนดู */
const LIFT = 0.5
/** ความเร็วไล่เข้าหาเป้าที่ 60fps */
const EASE = 0.16
/** ต่ำกว่านี้ถือว่าเข้าที่แล้ว — ใช้ตัดสินว่าหยุดวาดได้ */
const REST = 0.0015
/** เวลาที่ตัวอักษรหนึ่งตัวใช้ไถลขึ้นเข้าที่ (วินาที) */
const ENTER_DUR = 0.9
/** ระยะที่มันเริ่มต่ำกว่าเส้นบรรทัด หน่วย em ของตัวอักษร */
const ENTER_RISE = 0.34
/** ระยะเหลื่อมระหว่างตัว (วินาที) */
const ENTER_STAGGER = 0.055

/**
 * เมาส์ล่าสุดในพิกัดหน้าจอ และกรอบของแคนวาสบนหน้าจอ
 *
 * แคนวาสหัวเรื่องปิดรับเมาส์ (ฉาก 3D ข้างหลังต้องได้ hover ของมันเอง) r3f จึงไม่มีทางรู้
 * ตำแหน่งเมาส์ — state.pointer ค้างที่ศูนย์ตลอด ต้องอ่านจาก window เองแล้วแปลงพิกัดเอง
 */
const mouse = { x: -1e5, y: -1e5 }
const fieldRect = { left: 0, top: 0 }

type LineBox = {
  id: number
  /** ข้อความของบรรทัด — ว่างถ้าเป็นงานเวกเตอร์ */
  text: string
  /** ไฟล์ SVG ที่จะอัดขึ้นรูป (ฟองคำพูด / คำว่า LIFE) */
  src?: string
  left: number
  top: number
  width: number
  height: number
}

type Field = {
  /** บรรทัดที่ลงทะเบียนไว้ พร้อมกรอบของมันเทียบกับบล็อก */
  lines: Map<number, LineBox>
  /** บอกบล็อกว่ากรอบเปลี่ยน — ให้ React วาดรายการบรรทัดใหม่ */
  bump: () => void
  /** แคนวาสขึ้นแล้วหรือยัง — ของ HTML ที่เป็นตัวสำรองจะได้จางตัวเองออกตอนของ 3D มาแทน */
  live: boolean
}

const FieldCtx = createContext<Field | null>(null)

/** เลขประจำบรรทัด — เพิ่มทีละหนึ่งตอน mount ไม่ต้องพึ่งข้อความซ้ำกันได้ */
let nextId = 0

type GlyphSpec = {
  ch: string
  /** ตำแหน่งซ้ายของตัวอักษร (em) */
  x: number
  /** ความกว้างของตัวเอง (em) — ใช้หาใจกลางตอนคิดแรงแม่เหล็ก */
  ha: number
  /** ความกว้างรวมของบรรทัด (em) — เท่ากันทุกตัว ใช้ตอนบีบให้พอดีกล่อง */
  w: number
}

/**
 * ตัวอักษรหนึ่งตัว — ขยับเองทุกเฟรม ไม่ผ่าน state ของ React
 *
 * รับเมาส์มาเป็นพิกัด "ในกลุ่ม" (หน่วย em ของตัวอักษร) แล้วเทียบกับตำแหน่งตัวเองตรง ๆ
 * ทุกตัวอยู่บนระนาบ z เดียวกัน จึงไม่ต้องยิงเรย์
 */
function Glyph({
  spec,
  local,
  onMoving,
  startAt,
}: {
  spec: GlyphSpec
  local: { x: number; y: number }
  onMoving: (moving: boolean) => void
  /** เวลา (performance.now) ที่ตัวนี้ควรเริ่มไถลขึ้น */
  startAt: number
}) {
  const ref = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const cur = useRef({ x: 0, y: 0, z: 0 })
  /**
   * เวลาที่เริ่มไถลจริง — ช้ากว่าตารางได้ถ้ารูปทรงยังสร้างไม่เสร็จ แต่เร็วกว่าไม่ได้
   *
   * ตารางเดียวกันทั้งบรรทัด ระยะเหลื่อมจึงเท่ากันทุกตัว ไม่ใช่ตามจังหวะที่เธรดหลักว่าง
   * ซึ่งไม่สม่ำเสมอ — ตาจับได้ว่าบางตัวมาติดกันแล้วบางตัวทิ้งช่วง
   */
  const from = useRef(Math.max(startAt, performance.now()))
  const { invalidate } = useThree()
  useEffect(() => invalidate(), [invalidate])

  useFrame(() => {
    const g = ref.current
    if (!g) return
    const t = (performance.now() - from.current) / (ENTER_DUR * 1000)
    const rising = t < 1
    const e = t < 0 ? 0 : t > 1 ? 1 : t
    // เข้าที่แบบชะลอยาว (quint.out) ไม่ใช่ cubic — ท้ายทางช้าลงมากพอที่ตาจะอ่านว่า "หยุดเอง"
    const k = 1 - (1 - e) ** 5
    if (mat.current) mat.current.opacity = k
    // ใจกลางตัวอักษรอยู่สูงจากเส้นฐานราวหนึ่งในสามของขนาด และเยื้องไปครึ่งตัวทางขวา
    const dx = spec.x + spec.ha * 0.5 - local.x
    const dy = 0.36 - local.y
    const dist = Math.hypot(dx, dy)
    let tx = 0
    let ty = 0
    let tz = 0
    if (dist < RADIUS) {
      // แรงโตแบบกำลังสอง — ไกลแทบไม่ขยับ ใกล้ใจกลางถึงดีดออก เหมือนสนามแม่เหล็กจริง
      const f = (1 - dist / RADIUS) ** 2
      const len = dist || 1
      tx = (dx / len) * PUSH * f
      ty = (dy / len) * PUSH * f
      tz = LIFT * f
    }
    const c = cur.current
    c.x += (tx - c.x) * EASE
    c.y += (ty - c.y) * EASE
    c.z += (tz - c.z) * EASE
    g.position.set(spec.x + c.x, c.y - (1 - k) * ENTER_RISE, c.z)
    // เอียงตามทิศที่ถูกผลัก ตัวอักษรจึงหันสันข้างให้เห็นความหนา ไม่ใช่เลื่อนแบน ๆ
    g.rotation.set((-c.y / PUSH) * 0.16, (c.x / PUSH) * 0.2, 0)
    onMoving(
      rising || Math.abs(c.x - tx) + Math.abs(c.y - ty) + Math.abs(c.z - tz) > REST || tz > 0,
    )
  })

  return (
    <group ref={ref}>
      <Text3D
        font={FONT}
        size={1}
        /** ความลึกของการอัดขึ้นรูป — สัดส่วนของขนาด ตัวจึงหนาเท่ากันทุกขนาดจอ */
        height={0.42}
        bevelEnabled
        /**
         * bevelSize ดันขอบออกนอกเส้นเดิม = เส้นอ้วนขึ้นจริง ไม่ใช่ตัวหนาปลอม
         *
         * ฟอนต์ Display มีน้ำหนักเดียว (400) จะขอตัวหนากว่านี้จากไฟล์ไม่ได้ — ยืดขอบออกแทน
         * ได้เส้นที่หนาขึ้นโดยรูปทรงยังเป็นของฟอนต์เดิม และขอบที่ยืดออกกลายเป็นสันรับแสง
         */
        bevelThickness={0.035}
        bevelSize={0.05}
        bevelSegments={2}
        curveSegments={4}
      >
        {spec.ch}
        {/* ขาวสว่าง ไม่ใช่ขาวหม่น: ผิวลื่นขึ้นให้สันรับแสงเป็นเส้นคม + เรืองในตัวนิดหน่อย
            ตัวอักษรจึงไม่จมไปกับฟ้าของฉากตอนอยู่ในเงา */}
        <meshStandardMaterial
          ref={mat}
          color="#ffffff"
          roughness={0.32}
          metalness={0}
          emissive="#cfe2ff"
          emissiveIntensity={0.24}
          transparent
          opacity={0}
        />
      </Text3D>
    </group>
  )
}

/**
 * วัดความกว้างของแต่ละตัวจากฟอนต์จริง แล้ววางเรียงเอง
 *
 * ปล่อยให้ Text3D วาดทั้งบรรทัดทีเดียวไม่ได้ เพราะต้องขยับ "รายตัว" — จึงต้องรู้ระยะก้าว
 * ของแต่ละตัว (advance width) ซึ่งอยู่ในไฟล์ฟอนต์อยู่แล้ว
 */
function useLayout(text: string) {
  const [specs, setSpecs] = useState<GlyphSpec[] | null>(null)
  useEffect(() => {
    let alive = true
    void fetch(FONT)
      .then((r) => r.json())
      .then((data: { glyphs: Record<string, { ha: number }>; resolution: number }) => {
        if (!alive) return
        const scale = 1 / data.resolution
        let x = 0
        const out: GlyphSpec[] = []
        for (const ch of text) {
          const ha = data.glyphs[ch]?.ha ?? data.resolution * 0.5
          if (ch !== ' ') out.push({ ch, x, ha: ha * scale, w: 0 })
          // ระยะห่างตัวอักษรของหน้านี้ติดลบเล็กน้อย (letter-spacing -0.01em ใน .v3-h1)
          // ไม่หักออกด้วย บรรทัดจะยาวกว่ากล่อง HTML แล้วตัวท้ายพ้นคอลัมน์ออกไป
          x += ha * scale - 0.01
        }
        for (const g of out) g.w = x
        setSpecs(out)
      })
    return () => {
      alive = false
    }
  }, [text])
  return specs
}

/**
 * บรรทัดหนึ่งบรรทัดในแคนวาสรวม — วางตามกรอบที่ฝั่ง HTML วัดมาให้
 *
 * พิกัดฉาก: กล้องออร์โธ zoom 1 = หนึ่งหน่วยต่อหนึ่งพิกเซล ศูนย์อยู่กลางแคนวาส แกน y ชี้ขึ้น
 */
function Line({ box }: { box: LineBox }) {
  const specs = useLayout(box.text)
  /** เวลาอ้างอิงของบรรทัด — ตารางเริ่มไถลของทุกตัวนับจากจุดนี้ */
  const lineStart = useMemo(() => performance.now(), [])
  const { invalidate, size } = useThree()
  const moving = useRef(new Set<number>())
  /** เมาส์ในพิกัดของกลุ่มตัวอักษร — ออบเจกต์เดียวที่ทุกตัวในบรรทัดอ่านร่วมกัน */
  const local = useMemo(() => ({ x: -1e5, y: -1e5 }), [])

  /** ตัวไหนยังขยับอยู่ก็ขอเฟรมถัดไป — ไม่มีใครขยับแล้วปล่อยให้แคนวาสหยุด */
  const report = useMemo(
    () => (i: number) => (m: boolean) => {
      if (m) moving.current.add(i)
      else moving.current.delete(i)
      if (moving.current.size) invalidate()
    },
    [invalidate],
  )

  useEffect(() => {
    if (specs) invalidate()
  }, [specs, invalidate])

  /**
   * ทยอยประกอบตัวอักษรทีละตัวต่อเฟรม ไม่ใช่ทั้งบรรทัดในเฟรมเดียว
   *
   * TextGeometry ถูกสร้างตอน mount และเป็นงานบนเธรดหลัก สิบกว่าตัวพร้อมกันคือเฟรมเดียว
   * ยาวเกือบครึ่งวินาที (วัดได้ 484ms) ซึ่งเห็นเป็นการกระตุกของฉากที่กำลังเล่นอยู่ —
   * แบ่งเป็นตัวละเฟรมแล้วงานก้อนเดียวกันกลายเป็นงานเล็ก ๆ ที่แทรกระหว่างเฟรมได้
   */
  const [ready, setReady] = useState(0)
  useEffect(() => {
    if (!specs) return undefined
    let id = 0
    let n = 0
    /**
     * ต่อคิวตอนเธรดหลักว่าง (requestIdleCallback) ไม่ใช่ทุกเฟรม — ถ้าเบียดเข้าไปทุกเฟรม
     * งานสร้างรูปทรงจะไปแย่งเวลากับฉากที่กำลังเล่นอยู่พอดี เบราว์เซอร์ที่ไม่มี API นี้
     * (Safari รุ่นเก่า) ถอยไปใช้ timeout สั้น ๆ ซึ่งให้ผลใกล้กัน
     */
    const idle: (cb: () => void) => number =
      'requestIdleCallback' in window
        ? (cb) => (window as unknown as { requestIdleCallback: (c: () => void) => number }).requestIdleCallback(cb)
        : (cb) => window.setTimeout(cb, 32)
    const step = () => {
      n += 1
      setReady(n)
      invalidate()
      if (n < specs.length) id = idle(step)
    }
    id = idle(step)
    return () => {
      if ('cancelIdleCallback' in window) {
        ;(window as unknown as { cancelIdleCallback: (h: number) => void }).cancelIdleCallback(id)
      } else {
        clearTimeout(id)
      }
    }
  }, [specs, invalidate])

  /**
   * ขนาด: กล่อง HTML สูงเท่า font-size (line-height เป็น 1) สเกลจึงเท่าขนาดฟอนต์ตรง ๆ
   * แล้วบีบอีกชั้นถ้าบรรทัดยาวเกินกล่อง — ความกว้างจาก advance ของฟอนต์ไม่รวม kerning
   * ที่เบราว์เซอร์ใช้ บรรทัดจึงกว้างกว่าของ HTML ราวหนึ่งในห้า
   */
  const wide = specs?.at(-1)?.w ?? 1
  const fit = box.width > 0 ? Math.min(1, box.width / (wide * box.height)) : 1
  const s = box.height * fit
  // กรอบจาก HTML นับจากมุมซ้ายบนของแคนวาส แปลงเป็นพิกัดฉาก (ศูนย์กลางจอ, y ชี้ขึ้น)
  /**
   * ยึดขอบขวา ไม่ใช่ขอบซ้าย — บล็อกหัวเรื่องจัดชิดขวา
   *
   * ความกว้างของบรรทัดที่คิดจาก advance ของฟอนต์ไม่เท่ากับที่เบราว์เซอร์วัด (เรื่อง kerning)
   * ถ้ายึดซ้าย ส่วนต่างจะไปโผล่ที่ขอบขวาซึ่งเป็นแนวที่ตาใช้อ่านว่าตรงหรือไม่ตรง
   */
  const originX = box.left + box.width - wide * s - size.width / 2
  const originY = size.height / 2 - box.top - box.height + s * 0.2

  useFrame(() => {
    local.x = (mouse.x - fieldRect.left - box.left) / s
    local.y = (fieldRect.top + box.top + box.height - mouse.y - s * 0.2) / s
  })

  if (!specs) return null
  return (
    <group position={[originX, originY, 0]} scale={s}>
      {specs.slice(0, ready).map((spec, i) => (
        <Glyph
          key={`${spec.ch}-${i}`}
          spec={spec}
          local={local}
          onMoving={report(i)}
          startAt={lineStart + i * ENTER_STAGGER * 1000}
        />
      ))}
    </group>
  )
}

/**
 * ลงทะเบียนกรอบของชิ้นหนึ่งเข้าบล็อก แล้วเฝ้าไว้ว่ากรอบเปลี่ยนเมื่อไร
 *
 * วัดด้วยพิกัดผัง (offset*) ไม่ใช่ getBoundingClientRect — บล็อกหัวเรื่องถูก skew อยู่
 * (.v3-hero-skew) rect ที่ได้จะเป็น "กล่องครอบของรูปที่เอียงแล้ว" ซึ่งบวมตามความกว้าง
 * (บรรทัดกว้าง 378 วัดได้สูง 108 ทั้งที่ตัวอักษรสูง 75) ของ 3D จะถูกวางผิดขนาดผิดที่ทันที
 * ส่วน offset* เป็นค่าจากผังก่อนแปลงร่าง และแคนวาสอยู่ในกล่องที่ถูก skew ใบเดียวกัน
 * ภาพที่วาดออกมาจึงเอียงตามไปเองพร้อมของ HTML
 */
function useBox(el: HTMLElement | null, text: string, src?: string) {
  const field = useContext(FieldCtx)
  const id = useMemo(() => nextId++, [])
  useEffect(() => {
    if (!el || !field) return undefined
    const read = () => {
      const host = el.closest('[data-headline-field]')
      if (!(host instanceof HTMLElement)) return
      let left = 0
      let top = 0
      let node: HTMLElement | null = el
      while (node && node !== host) {
        left += node.offsetLeft
        top += node.offsetTop
        node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null
      }
      if (node !== host) return
      const next: LineBox = {
        id,
        text,
        src,
        // เทียบกับมุมซ้ายบนของบล็อก แล้วบวกขอบเผื่อ — แคนวาสกางเกินบล็อกไปด้านละ PAD
        left: left + PAD,
        top: top + PAD,
        width: el.offsetWidth,
        height: el.offsetHeight,
      }
      const prev = field.lines.get(id)
      if (
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.height === next.height
      ) {
        return
      }
      field.lines.set(id, next)
      field.bump()
    }
    read()
    void document.fonts?.ready.then(read)
    const ro = new ResizeObserver(read)
    ro.observe(el)
    window.addEventListener('resize', read)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', read)
      field.lines.delete(id)
      field.bump()
    }
  }, [el, field, id, text, src])
}

/**
 * งานเวกเตอร์ที่ถูกอัดขึ้นรูป — ฟองคำพูดกับคำว่า LIFE ใช้ไฟล์ SVG ใบเดียวกับที่ HTML เคยวาง
 *
 * ไม่ได้ปั้นทรงขึ้นใหม่: สีกับรูปร่างมาจากไฟล์ต้นฉบับทั้งหมด สิ่งที่เพิ่มคือความหนาเท่านั้น
 * (ไฟล์เดิมยังถูกใช้เป็นตัววัดกรอบในผัง HTML อยู่ แค่ถูกซ่อนไม่ให้เห็น)
 */
function SvgArt({ box }: { box: LineBox }) {
  const data = useLoader(SVGLoader, box.src ?? '')
  const { size, invalidate } = useThree()

  const parts = useMemo(() => {
    const out: { geo: THREE.ExtrudeGeometry; color: string }[] = []
    /**
     * กรอบอ้างอิงคือ viewBox ของไฟล์ ไม่ใช่ขอบเขตของเส้นที่วาดจริง
     *
     * ฝั่ง HTML ย่อ/ขยายไฟล์ตาม viewBox เสมอ ถ้าเราวัดจากขอบเขตของเส้น (ซึ่งไม่เท่ากัน
     * เมื่อไฟล์มีที่ว่างรอบรูปหรือเส้นล้นกรอบ) ของ 3D จะเลื่อนและมีขนาดไม่ตรงกับที่ผังกันไว้
     */
    const vb = (data.xml as unknown as XMLDocument)?.documentElement
      ?.getAttribute('viewBox')
      ?.split(/[\s,]+/)
      .map((n: string) => Number(n))
    const box3 = new THREE.Box3()
    for (const path of data.paths) {
      const fill = path.userData?.style?.fill
      if (!fill || fill === 'none') continue
      for (const shape of SVGLoader.createShapes(path)) {
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: 26,
          bevelEnabled: true,
          bevelThickness: 2,
          bevelSize: 2,
          bevelSegments: 2,
          curveSegments: 8,
        })
        geo.computeBoundingBox()
        box3.union(geo.boundingBox ?? new THREE.Box3())
        out.push({ geo, color: fill })
      }
    }
    const bb =
      vb && vb.length === 4 && vb.every((n) => Number.isFinite(n))
        ? new THREE.Box3(
            new THREE.Vector3(vb[0], vb[1], 0),
            new THREE.Vector3(vb[0] + vb[2], vb[1] + vb[3], 0),
          )
        : box3
    return { list: out, bb }
  }, [data])

  useEffect(() => {
    invalidate()
    return () => {
      for (const p of parts.list) p.geo.dispose()
    }
  }, [parts, invalidate])

  const w = Math.max(1e-3, parts.bb.max.x - parts.bb.min.x)
  const h = Math.max(1e-3, parts.bb.max.y - parts.bb.min.y)
  // พอดีกรอบที่ HTML กันที่ไว้ให้ ด้านที่คับกว่าเป็นตัวกำหนด สัดส่วนจึงไม่เพี้ยน
  const s = Math.min(box.width / w, box.height / h)
  const originX = box.left - size.width / 2
  const originY = size.height / 2 - box.top

  return (
    // แกน y ของ SVG ชี้ลง ของฉากชี้ขึ้น — พลิกด้วยสเกลติดลบ แล้วเลื่อนมุมซ้ายบนมาที่กรอบ
    <group position={[originX, originY, 0]} scale={[s, -s, s]}>
      <group position={[-parts.bb.min.x, -parts.bb.min.y, 0]}>
        {parts.list.map((p, i) => (
          <mesh key={i} geometry={p.geo}>
            {/**
             * toneMapped ปิด: ตัวแมปโทนของเรนเดอเรอร์ดึงสีอิ่ม ๆ ให้ซีดลง สีที่ออกมาจึงไม่ใช่
             * สีในไฟล์ต้นฉบับอีกต่อไป — งานชิ้นนี้ต้องเป็นสีเดียวกับแบบเป๊ะ ๆ
             * ยังรับแสงตามปกติ (standard material) จึงเห็นความหนาเป็นด้านสว่าง/ด้านเงา
             */}
            <meshStandardMaterial
              color={p.color}
              roughness={0.38}
              metalness={0}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/**
 * บล็อกหัวเรื่องทั้งก้อน — แคนวาสใบเดียวคุมทุกบรรทัดที่ลงทะเบียนเข้ามา
 *
 * แคนวาสไม่ mount จนกว่าอินโทรของฉากจะผ่านไปแล้ว (introTime) — งานสร้าง TextGeometry
 * เป็นงานบนเธรดหลัก ถ้าลงมือระหว่างอินโทรกำลังเล่น เฟรมจะตกให้เห็น (วัดแล้ว 40 → 55fps)
 * ผูกกับนาฬิกาของฉากจริง ไม่ใช่ตัวจับเวลาที่เดาเอา เพราะเครื่องช้าเร็วไม่เท่ากัน
 * มีทางออกสำรองสองทาง: หมดเวลาสำรอง หรือคนขยับเมาส์ (= เลิกดูอินโทรแล้ว)
 */
export function Headline3DField({
  active,
  className = '',
  children,
}: {
  /** ยังอยู่ที่จอแรกอยู่ไหม — พ้นไปแล้วถอดแคนวาสทิ้ง ไม่ต้องแบกบริบท WebGL ไว้ */
  active: boolean
  className?: string
  children: ReactNode
}) {
  const [, setTick] = useState(0)
  const store = useMemo(
    () => ({ lines: new Map<number, LineBox>(), bump: () => setTick((v) => v + 1) }),
    [],
  )
  const heroReady = useNewHeroReady()
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!heroReady || settled) return undefined
    let done = false
    const go = () => {
      if (done) return
      done = true
      setSettled(true)
    }
    const id = setInterval(() => {
      if (introTime() > INTRO_AFTER) go()
    }, 250)
    const bail = setTimeout(go, FALLBACK_AFTER)
    window.addEventListener('pointermove', go, { once: true, passive: true })
    return () => {
      clearInterval(id)
      clearTimeout(bail)
      window.removeEventListener('pointermove', go)
    }
  }, [heroReady, settled])

  const lines = [...store.lines.values()]
  const live = active && settled && lines.length > 0
  const field = useMemo<Field>(() => ({ ...store, live }), [store, live])
  return (
    <FieldCtx.Provider value={field}>
      <div className={className} data-headline-field style={{ position: 'relative' }}>
        {children}
        {live && (
          <div className="absolute" style={{ inset: `${-PAD}px`, pointerEvents: 'none' }}>
            <Canvas
              aria-hidden
              style={{ width: '100%', height: '100%' }}
              frameloop="demand"
              dpr={[1, 1.75]}
              orthographic
              /**
               * กล้องต้องถอยไกลกว่าความหนาของตัวอักษร ไม่งั้นระนาบใกล้จะหั่นทะลุเนื้อจนไม่เหลือ
               * อะไรให้วาด (เจอมาแล้ว: จอว่างทั้งที่ mesh อยู่ครบ)
               *
               * zoom 1 บนกล้องออร์โธ = หนึ่งหน่วยฉากต่อหนึ่งพิกเซล พิกัดจาก HTML จึงใช้ได้ตรง ๆ
               */
              camera={{ position: [0, 0, 400], zoom: 1, near: 1, far: 1200 }}
              gl={{ antialias: true, alpha: true }}
            >
              <ambientLight intensity={1.35} />
              {/* คีย์จากบนขวาหน้า ให้สันที่ยืดออกมารับแสง อีกดวงจากล่างซ้ายกันด้านมืดตัน */}
              <directionalLight position={[220, 320, 420]} intensity={1.75} />
              <directionalLight position={[-260, -140, 260]} intensity={0.6} />
              <PointerWake />
              <Suspense fallback={null}>
                {lines.map((b) =>
                  b.src ? <SvgArt key={b.id} box={b} /> : <Line key={b.id} box={b} />,
                )}
              </Suspense>
            </Canvas>
          </div>
        )}
      </div>
    </FieldCtx.Provider>
  )
}

/**
 * ให้ชิ้นงาน HTML (ฟองคำพูด / LIFE) ยกรูปของตัวเองขึ้นไปเป็น 3D ในแคนวาสรวม
 *
 * ตัวชิ้นเดิมยังอยู่ในผังเพื่อกันที่และเป็นตัววัดกรอบ แค่ถูกซ่อนด้วย visibility
 * — เอาออกจากผังไม่ได้ ไม่งั้นบรรทัดจะหุบและไม่มีอะไรบอกขนาดให้ของ 3D
 */
export function useHeadlineArt(el: HTMLElement | null, src: string) {
  useBox(el, '', src)
  return useContext(FieldCtx)?.live ?? false
}

/**
 * สไตล์ของ "ตัวสำรอง HTML": เห็นตั้งแต่เฟรมแรก แล้วจางออกตอนของ 3D ขึ้นมาแทน
 *
 * แคนวาสรออินโทรของฉากจบก่อนถึงจะ mount (ราว 4 วินาทีหลังสปแลชหาย บนเครื่องที่วัด) ถ้าซ่อน
 * ของ HTML ไว้ตลอด ช่วงนั้นหัวเรื่องทั้งบล็อกจะว่างเปล่า — ให้ของแบนยืนแทนไปก่อนแล้วค่อยสลับ
 * ยังกันที่ในผังเหมือนเดิมทั้งสองสถานะ (จางด้วย opacity ไม่ใช่ถอดออก) กรอบที่วัดไว้จึงไม่ขยับ
 */
export function fadeToArt(live: boolean) {
  return {
    opacity: live ? 0 : 1,
    transition: 'opacity 380ms ease',
    pointerEvents: 'none' as const,
  }
}

/** เก็บตำแหน่งเมาส์ ขอเฟรมใหม่ และวัดกรอบแคนวาสไว้ให้ทุกบรรทัดใช้ร่วมกัน */
function PointerWake() {
  const { gl, invalidate } = useThree()
  useEffect(() => {
    const el = gl.domElement
    /**
     * กรอบของแคนวาสบนจอ — ทุกบรรทัดใช้ค่านี้แปลงเมาส์เข้าพิกัดของกลุ่มตัวอักษร
     *
     * แคนวาสไม่รับเมาส์ (pointer-events: none) state.pointer ของ r3f จึงไม่มีวันขยับ
     * ต้องฟังที่ window เอง แล้วแปลงเองด้วยกรอบที่วัดไว้
     */
    const read = () => {
      const r = el.getBoundingClientRect()
      fieldRect.left = r.left
      fieldRect.top = r.top
    }
    const move = (e: PointerEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      invalidate()
    }
    read()
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [gl, invalidate])
  return null
}

/**
 * หนึ่งบรรทัดของหัวเรื่อง — ตัวหนังสือ HTML ที่ซ่อนไว้ (ยังอ่านด้วย screen reader ได้)
 * ทำหน้าที่เป็น "กล่องวัด" ให้แคนวาสรวมรู้ว่าจะวางตัวอักษร 3D ตรงไหน ขนาดเท่าไร
 */
export function Headline3D({ text, className = '' }: { text: string; className?: string }) {
  const [el, setEl] = useState<HTMLSpanElement | null>(null)
  useBox(el, text)
  const live = useContext(FieldCtx)?.live ?? false

  return (
    <p className={className} aria-label={text}>
      <span ref={setEl} style={fadeToArt(live)}>
        {text}
      </span>
    </p>
  )
}
