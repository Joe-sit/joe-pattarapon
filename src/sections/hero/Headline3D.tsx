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
import { Environment, Lightformer, MeshTransmissionMaterial, Text3D } from '@react-three/drei'
import * as THREE from 'three'
import { useNewHeroReady } from '@/newhero/ready'
import { getTuner } from '@/newhero/tuner'
import { introSince } from '@/newhero/intro'
import { useTuner } from '@/newhero/tuner'

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



/** มิลลิวินาทีหลังฉากพร้อม ที่จะยอมขึ้นหัวเรื่องแม้อินโทรจะยังไม่รายงานว่าจบ */
const FALLBACK_AFTER = 9000

/** ต่ำกว่านี้ถือว่าเข้าที่แล้ว — ใช้ตัดสินว่าหยุดวาดได้ */
const REST = 0.0015

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
  /** ทำเป็นกระจกใส (ฟองคำพูด) — เห็นฉากข้างหลังทะลุ ไม่ใช่แผ่นทึบสีเดียว */
  glass?: boolean
  left: number
  top: number
  width: number
  height: number
}

/**
 * ค่าที่ลากได้จากแผงจูน (DEV) — นอกโหมด dev แผงอ่านค่าตั้งต้นอย่างเดียว ค่าจึงนิ่งเท่าเดิม
 *
 * ส่งเป็น prop ลงไปในแคนวาส ไม่ใช่ผ่าน context: r3f สร้าง React root แยก คอนเท็กซ์ของ
 * ต้นไม้นอกแคนวาสไม่ไหลเข้าไปข้างใน
 */
type Cfg = {
  rad: number
  push: number
  lift: number
  ease: number
  depth: number
  bevT: number
  bevS: number
  seg: number
  rough: number
  emis: number
  /** ความสว่างของเนื้อวัสดุ (สีเทากลาง) — ต่ำกว่า 1 เพื่อให้แสงรวมยังไม่ตันขาว จึงเหลือไล่เงา */
  alb: number
  enter: number
  rise: number
  stag: number
  /** เอียงตัวอักษรทั้งชุด (เรเดียน) — ท่าตั้งต้น แรงแม่เหล็กบวกทับค่านี้ */
  rot: [number, number, number]
  /** ระยะห่างตัวอักษร (em) — ตัวเดียวกับ letter-spacing ของฝั่ง HTML */
  track: number
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
  cfg,
}: {
  spec: GlyphSpec
  local: { x: number; y: number }
  onMoving: (moving: boolean) => void
  /** เวลา (performance.now) ที่ตัวนี้ควรเริ่มไถลขึ้น */
  startAt: number
  cfg: Cfg
}) {
  const ref = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const albedo = useMemo(() => new THREE.Color().setScalar(cfg.alb), [cfg.alb])
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
    const t = (performance.now() - from.current) / (cfg.enter * 1000)
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
    if (dist < cfg.rad) {
      // แรงโตแบบกำลังสอง — ไกลแทบไม่ขยับ ใกล้ใจกลางถึงดีดออก เหมือนสนามแม่เหล็กจริง
      const f = (1 - dist / cfg.rad) ** 2
      const len = dist || 1
      tx = (dx / len) * cfg.push * f
      ty = (dy / len) * cfg.push * f
      tz = cfg.lift * f
    }
    const c = cur.current
    c.x += (tx - c.x) * cfg.ease
    c.y += (ty - c.y) * cfg.ease
    c.z += (tz - c.z) * cfg.ease
    g.position.set(spec.x + c.x, c.y - (1 - k) * cfg.rise, c.z)
    // เอียงตามทิศที่ถูกผลัก ตัวอักษรจึงหันสันข้างให้เห็นความหนา ไม่ใช่เลื่อนแบน ๆ
    // ท่าตั้งต้นจากแผงจูน + การเอียงตามทิศที่ถูกผลัก (สันข้างจะได้หันมารับแสง)
    g.rotation.set(
      cfg.rot[0] + (-c.y / cfg.push) * 0.16,
      cfg.rot[1] + (c.x / cfg.push) * 0.2,
      cfg.rot[2],
    )
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
        height={cfg.depth}
        bevelEnabled
        /**
         * bevelSize ดันขอบออกนอกเส้นเดิม = เส้นอ้วนขึ้นจริง ไม่ใช่ตัวหนาปลอม
         *
         * ฟอนต์ Display มีน้ำหนักเดียว (400) จะขอตัวหนากว่านี้จากไฟล์ไม่ได้ — ยืดขอบออกแทน
         * ได้เส้นที่หนาขึ้นโดยรูปทรงยังเป็นของฟอนต์เดิม และขอบที่ยืดออกกลายเป็นสันรับแสง
         */
        bevelThickness={cfg.bevT}
        bevelSize={cfg.bevS}
        bevelSegments={2}
        curveSegments={cfg.seg}
      >
        {spec.ch}
        {/**
         * ขาวจริง ไม่ใช่ขาวหม่น
         *
         * toneMapped ปิด: ตัวแมปโทนของเรนเดอเรอร์กดค่าสว่างลงมาให้อยู่ในช่วงที่ "ถ่ายรูปสวย"
         * ผลคือหน้าที่รับแสงเต็มที่ไม่เคยถึงขาวสุด อ่านเป็นเทาอ่อนบนพื้นฟ้า (ตัว LIFE ที่ปิดไป
         * ก่อนหน้าจึงสดกว่าทั้งที่เป็นวัสดุแบบเดียวกัน)
         *
         * เรืองในตัวเป็นสีขาวด้วย ไม่ใช่ฟ้าอ่อน — สีฟ้าที่บวกเข้าไปคือเหตุที่ทำให้ดูหม่น
         *
         * แต่เนื้อวัสดุต้องไม่ขาวสุด (alb < 1): toneMapped ปิดแล้วทุกค่าที่เกิน 1 ถูกตัดเป็นขาว
         * เท่ากันหมด แสงรวมที่นี่ ~2.7 เท่า ถ้า albedo = 1 ทุกด้านตันขาว = แบนไม่มีเงา
         * ตั้ง albedo ให้ด้านหน้าที่รับแสงเต็มพอดีถึงขาวสุด ด้านข้าง/ด้านล่างจึงเหลือไล่เงา
         */}
        <meshStandardMaterial
          ref={mat}
          color={albedo}
          roughness={cfg.rough}
          metalness={0}
          emissive="#ffffff"
          emissiveIntensity={cfg.emis}
          /* แผงไฟที่อบไว้ให้กระจกใช้ เป็นแสงรอบทิศ ถ้าเปิดจะกลบเงาของตัวอักษรจนเรียบ */
          envMapIntensity={0}
          toneMapped={false}
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
function useLayout(text: string, track: number) {
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
          // ระยะห่างตัวอักษรตัวเดียวกับ letter-spacing ของ .v3-h1 (มาจากแผงจูนทั้งคู่)
          // ไม่บวกด้วย บรรทัดจะกว้างไม่เท่ากล่อง HTML แล้วตัวท้ายพ้นคอลัมน์ออกไป
          x += ha * scale + track
        }
        for (const g of out) g.w = x
        setSpecs(out)
      })
    return () => {
      alive = false
    }
  }, [text, track])
  return specs
}

/**
 * บรรทัดหนึ่งบรรทัดในแคนวาสรวม — วางตามกรอบที่ฝั่ง HTML วัดมาให้
 *
 * พิกัดฉาก: กล้องออร์โธ zoom 1 = หนึ่งหน่วยต่อหนึ่งพิกเซล ศูนย์อยู่กลางแคนวาส แกน y ชี้ขึ้น
 */
function Line({ box, cfg }: { box: LineBox; cfg: Cfg }) {
  const specs = useLayout(box.text, cfg.track)
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
   * ยึดขอบซ้าย — ทุกบรรทัดเริ่มที่แนวเดียวกัน นั่นคือแนวที่ตาใช้อ่านว่าตรงหรือไม่ตรง
   *
   * ความกว้างของบรรทัดที่คิดจาก advance ของฟอนต์ไม่เท่ากับที่เบราว์เซอร์วัด (เรื่อง kerning)
   * ส่วนต่างจึงถูกปล่อยให้ไปโผล่ที่ปลายบรรทัด ซึ่งไม่มีแนวให้เทียบอยู่แล้ว
   */
  const originX = box.left - size.width / 2
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
          startAt={lineStart + i * cfg.stag * 1000}
          cfg={cfg}
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
function useBox(el: HTMLElement | null, text: string, src?: string, glass?: boolean) {
  const field = useContext(FieldCtx)
  const id = useMemo(() => nextId++, [])
  const pad = useTuner().hlPad
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
        glass,
        // เทียบกับมุมซ้ายบนของบล็อก แล้วบวกขอบเผื่อ — แคนวาสกางเกินบล็อกไปด้านละ PAD
        left: left + pad,
        top: top + pad,
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
  }, [el, field, id, text, src, pad])
}

/**
 * ฉากหลังที่กระจก "มองเห็น"
 *
 * MeshTransmissionMaterial หักเหจากบัฟเฟอร์ที่มันถ่ายฉากของตัวเองลงไป แคนวาสนี้มีแต่หัวเรื่อง
 * ฉาก hero อยู่คนละแคนวาสข้างหลัง (คนละ WebGL context) ถ้าไม่บอกฉากหลัง กระจกจะหักเห
 * ความว่าง = ก้อนมืด — ป้อนสีฟ้าอ่อนของท้องฟ้าหลังหัวเรื่องให้มันแทน
 */
const GLASS_BG = new THREE.Color('#a6d4f4')
/** ความหนาของฟิล์มบาง (นาโนเมตร) — ช่วงนี้ให้รุ้งครบวงตามมุมมอง */
const IRID_RANGE: [number, number] = [180, 720]

/**
 * งานเวกเตอร์ที่ถูกอัดขึ้นรูป — ฟองคำพูดกับคำว่า LIFE ใช้ไฟล์ SVG ใบเดียวกับที่ HTML เคยวาง
 *
 * ไม่ได้ปั้นทรงขึ้นใหม่: สีกับรูปร่างมาจากไฟล์ต้นฉบับทั้งหมด สิ่งที่เพิ่มคือความหนาเท่านั้น
 * (ไฟล์เดิมยังถูกใช้เป็นตัววัดกรอบในผัง HTML อยู่ แค่ถูกซ่อนไม่ให้เห็น)
 */
function SvgArt({ box }: { box: LineBox }) {
  const data = useLoader(SVGLoader, box.src ?? '')
  const { size, invalidate } = useThree()
  /**
   * แผงจูนอ่านได้จากในแคนวาสด้วย เพราะสโตร์เป็น useSyncExternalStore ไม่ใช่ React context
   * (ค่าที่ส่งเข้าแคนวาสเป็น prop คือชุดของตัวอักษร ซึ่งถูกคิดไว้ก่อนหน้าอยู่แล้ว)
   */
  const t = useTuner()
  const thick = box.glass ? t.bbThick : 26

  /**
   * profile = ขอบล่างของรูปทีละช่วงความกว้าง (0 = ขอบบนของกรอบ, 1 = ขอบล่าง)
   * ทรายในฟองต้องเทลงไปตามรอยนี้ ไม่ใช่นอนบนระนาบเดียว — ฟองคำพูดมีแง่งลูกศรที่ลงลึกกว่าตัวฟอง
   */
  type Parts = {
    list: { geo: THREE.ExtrudeGeometry; color: string }[]
    bb: THREE.Box3
    profile: Float32Array | null
  }
  const [parts, setParts] = useState<Parts | null>(null)

  /**
   * อัดขึ้นรูปตอนเธรดหลักว่าง ไม่ใช่ตอน mount
   *
   * งานนี้เป็นงานซิงโครนัสบนเธรดหลัก (ทั้งฟองและ LIFE รวมกันวัดได้ ~150ms ในเฟรมเดียว)
   * ถ้าทำตอน mount มันไปตกกลางฉากที่กำลังเล่นอยู่ เห็นเป็นการกระตุกก้อนเดียวชัด ๆ
   */
  const build = useMemo(() => () => {
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
        /**
         * กระจกต้องมนตามความหนาด้วย ไม่ใช่แผ่นขอบคม
         *
         * แผ่นที่ bevel แค่ 2 หน่วยมีสันคมรอบตัว แสงเลยเข้าเป็นแถบเดียวกันทั้งขอบ อ่านไม่ออก
         * ว่าหนาแค่ไหน ทรงจึงดูแบน วิธีเดียวกับรางสวิตช์ (newhero/Switch capsuleSlab):
         * bevel = ครึ่งความหนา แล้วอัดเนื้อตรงเกือบศูนย์ — ทั้งชิ้นกลายเป็นผิวโค้งต่อกัน
         * ขอบจึงกวาดไฮไลต์เป็นแถบไล่ระดับ และความหนาอ่านได้จากภาพหักเหที่บีบตรงขอบ
         */
        const bev = box.glass ? thick * 0.499 * Math.max(0, Math.min(1, t.bbRound)) : 2
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: Math.max(1e-4, thick - bev * 2),
          bevelEnabled: true,
          bevelThickness: bev,
          bevelSize: bev,
          // หยาบพอ: รูปทรงพวกนี้เป็นมุมมนใหญ่ ๆ เพิ่มส่วนย่อยแล้วตาไม่เห็นต่าง แต่เวลาสร้างพุ่ง
          bevelSegments: box.glass ? 5 : 1,
          curveSegments: box.glass ? 12 : 4,
        })
        /** ให้ช่วง z เท่าเดิม (0..thick) — ฟิสิกส์ในฟองกับฉากหลังคิดจากช่วงนี้ */
        geo.translate(0, 0, bev)
        /**
         * bevelSize ดันขอบออกนอกเส้นเดิม ครึ่งความหนาจึงทำให้รูปบวมออกจริง — หดกลับให้เท่า
         * รอยของ path เดิม ไม่งั้นฟองล้นกรอบที่ HTML กันไว้ (กรอบวัดจาก viewBox ไม่ใช่จากทรง)
         */
        if (box.glass && bev > 0) {
          const flat = new THREE.Box3().setFromPoints(
            shape.getPoints(12).map((v) => new THREE.Vector3(v.x, v.y, 0)),
          )
          geo.computeBoundingBox()
          const gb = geo.boundingBox
          if (gb) {
            const fx = (flat.max.x - flat.min.x) / Math.max(1e-6, gb.max.x - gb.min.x)
            const fy = (flat.max.y - flat.min.y) / Math.max(1e-6, gb.max.y - gb.min.y)
            const cx = (gb.max.x + gb.min.x) / 2
            const cy = (gb.max.y + gb.min.y) / 2
            geo.translate(-cx, -cy, 0)
            geo.scale(fx, fy, 1)
            geo.translate((flat.max.x + flat.min.x) / 2, (flat.max.y + flat.min.y) / 2, 0)
          }
        }
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
    /**
     * รอยขอบล่างของรูป — ยิงเส้นตั้งฉากตัดเส้นขอบจริง ไม่ใช่แบ่งช่องแล้วเก็บจุดที่ตกลงไป
     *
     * ขอบล่างของฟองเป็นเส้นตรงยาว ซึ่งมีจุดอยู่แค่หัวกับท้าย (getPoints ย่อยเฉพาะส่วนโค้ง)
     * วิธีเก็บจุดลงช่องจึงได้ช่องกลางที่ "ไม่มีจุดขอบล่างเลย แต่มีจุดขอบบน" — ก้นของสนามทราย
     * เด้งขึ้นไปอยู่บนหลังฟอง ทรายเหลือกองอยู่สองปลาย (วัดจากไฟล์จริงแล้ว: จาก 22 ช่อง
     * มีแค่ 8 ช่องที่มีจุดขอบล่าง)
     *
     * ตัดกับด้านของรูปหลายเหลี่ยมทีละด้าน แล้วเอา y ที่มากสุด (แกน y ของ SVG ชี้ลง) จึงถูก
     * ทั้งกับส่วนโค้งและเส้นตรง
     */
    let profile: Float32Array | null = null
    if (box.glass) {
      const loops: THREE.Vector2[][] = []
      for (const path of data.paths) {
        const fill = path.userData?.style?.fill
        if (!fill || fill === 'none') continue
        for (const shape of SVGLoader.createShapes(path)) loops.push(shape.getPoints(16))
      }
      const spanX = Math.max(1e-6, bb.max.x - bb.min.x)
      const spanY = Math.max(1e-6, bb.max.y - bb.min.y)
      profile = new Float32Array(PROFILE_N)
      for (let k = 0; k < PROFILE_N; k += 1) {
        const x = bb.min.x + (k / (PROFILE_N - 1)) * spanX
        let low = -Infinity
        for (const loop of loops) {
          for (let n = 0; n < loop.length; n += 1) {
            const a = loop[n]
            const b = loop[(n + 1) % loop.length]
            if (a.x === b.x) continue
            const tt = (x - a.x) / (b.x - a.x)
            if (tt < 0 || tt > 1) continue
            const y = a.y + (b.y - a.y) * tt
            if (y > low) low = y
          }
        }
        profile[k] = low === -Infinity ? 1 : (low - bb.min.y) / spanY
      }
    }
    return { list: out, bb, profile }
  }, [data, thick, box.glass, t.bbRound])

  useEffect(() => {
    let made: Parts | null = null
    const run = () => {
      made = build()
      setParts(made)
      invalidate()
    }
    const hasIdle = 'requestIdleCallback' in window
    const id = hasIdle ? window.requestIdleCallback(run, { timeout: 1200 }) : window.setTimeout(run, 60)
    return () => {
      if (hasIdle) window.cancelIdleCallback(id)
      else window.clearTimeout(id)
      for (const p of made?.list ?? []) p.geo.dispose()
    }
  }, [build, invalidate])

  if (!parts) return null

  const w = Math.max(1e-3, parts.bb.max.x - parts.bb.min.x)
  const h = Math.max(1e-3, parts.bb.max.y - parts.bb.min.y)
  // พอดีกรอบที่ HTML กันที่ไว้ให้ ด้านที่คับกว่าเป็นตัวกำหนด สัดส่วนจึงไม่เพี้ยน
  const s = Math.min(box.width / w, box.height / h)
  const originX = box.left - size.width / 2
  const originY = size.height / 2 - box.top

  return (
    <>
    {/**
     * ของที่อยู่ในฟอง — อยู่นอกกลุ่มที่พลิกแกน y (สเกลติดลบ) เพราะฟิสิกส์อ่านสเกลของ
     * กลุ่มพ่อไม่ได้ ถ้าอยู่ในกลุ่มที่กลับด้าน โลกของ rapier จะกลับด้านตามและของจะ "ตกขึ้น"
     * จึงคิดใจกลาง/ครึ่งขนาดเป็นพิกเซลของแคนวาสให้เสร็จแล้วส่งเข้าไปเลย
     */}
    {box.glass && (
      <GlassBackdrop
        cx={originX + (w * s) / 2}
        cy={originY - (h * s) / 2}
        w={w * s * 2.4}
        h={h * s * 2.4}
        z={-t.bbThick * s * 0.6}
      />
    )}
    {box.glass && (
      <BubbleLife
        cx={originX + (w * s) / 2}
        cy={originY - (h * s) / 2}
        cz={(t.bbThick * s) / 2}
        hx={(w * s) / 2}
        hy={(h * s) / 2}
        hz={(t.bbThick * s) / 2}
        profile={parts.profile}
      />
    )}
    {/* แกน y ของ SVG ชี้ลง ของฉากชี้ขึ้น — พลิกด้วยสเกลติดลบ แล้วเลื่อนมุมซ้ายบนมาที่กรอบ */}
    <group position={[originX, originY, 0]} scale={[s, -s, s]}>
      <group position={[-parts.bb.min.x, -parts.bb.min.y, 0]}>
        {parts.list.map((p, i) => (
          <mesh key={i} geometry={p.geo}>
            {box.glass ? (
              /**
               * กระจก: โปร่งจริงด้วย alpha ของแคนวาส ไม่ใช่ transmission
               *
               * MeshTransmissionMaterial หักเหจาก "ของที่อยู่ในแคนวาสเดียวกัน" แคนวาสนี้มี
               * แต่หัวเรื่อง ฉาก hero อยู่คนละแคนวาสข้างหลัง (คนละ WebGL context) กระจกแบบนั้น
               * จึงหักเหความว่าง เห็นเป็นก้อนมืด — ใช้วัสดุโปร่งผสมกับสิ่งที่อยู่ข้างหลังหน้าเว็บ
               * ตรง ๆ แทน ได้ทะลุจริงพร้อมไฮไลต์ขอบ (แลกกับที่มันไม่ฝ้า/ไม่บิดภาพข้างหลัง)
               *
               * depthWrite ปิด + DoubleSide: เห็นผิวหลังผ่านผิวหน้า ความหนาจึงอ่านเป็นแก้ว
               */
              <MeshTransmissionMaterial
                transmission={1}
                thickness={t.bbThick}
                ior={t.bbIor}
                /**
                 * roughness 0 + anisotropicBlur: ผิวยังเงาเหมือนแก้วขัดมัน แต่ภาพที่ลอดผ่าน
                 * เบลอ — แยกสองเรื่องออกจากกันได้แบบเดียวกับรางสวิตช์ (ดู newhero/Switch)
                 */
                roughness={0}
                anisotropicBlur={t.bbBlur}
                chromaticAberration={t.bbChroma}
                envMapIntensity={3}
                distortion={0}
                /**
                 * จำนวนรอบที่วัสดุสุ่มภาพหลังกระจก = ความละเอียดของการแยกสี
                 *
                 * เชดเดอร์ของ drei ไล่ ior ทีละขั้นต่อรอบ (ior × (1 + chroma·i/samples)) แสงที่
                 * ลอดผ่านจึงถูกแยกเป็นสีตามมุมหักเหจริงแบบปริซึม ไม่ใช่ย้อมสีทับ — 6 รอบเห็นเป็น
                 * แถบ 3 สีหยาบ ๆ ยิ่งเพิ่มรอบยิ่งเป็นสเปกตรัมต่อเนื่อง (แลกกับการอ่านบัฟเฟอร์
                 * เพิ่มรอบละครั้งต่อพิกเซล)
                 */
                samples={Math.max(2, Math.round(t.bbSamples))}
                resolution={1024}
                /**
                 * ฟิล์มบางบนผิว (iridescence) — สีรุ้งที่เกิดจากการแทรกสอด ไม่ใช่การย้อมสี
                 *
                 * ตัวแยกสีตอนหักเห (chromaticAberration) เห็นชัดเฉพาะเมื่อของหลังกระจกมีขอบ
                 * ตัดกันแรง ฉากหลังของฟองเป็นไล่สีฟ้านุ่ม ๆ จึงแทบไม่เห็นสเปกตรัม ฟิล์มบางเป็น
                 * คุณสมบัติของ *ผิว* จึงให้รุ้งตามมุมมองแม้ฉากหลังจะเรียบ — สองตัวนี้ทำงานคู่กัน
                 */
                iridescence={t.bbIrid}
                iridescenceIOR={1.5}
                iridescenceThicknessRange={IRID_RANGE}
                attenuationDistance={t.bbThick * t.bbAtten}
                attenuationColor="#ffffff"
                background={GLASS_BG}
                transparent
                opacity={t.bbOpacity}
              />
            ) : (
              /**
               * toneMapped ปิด: ตัวแมปโทนของเรนเดอเรอร์ดึงสีอิ่ม ๆ ให้ซีดลง สีที่ออกมาจึงไม่ใช่
               * สีในไฟล์ต้นฉบับอีกต่อไป — งานชิ้นนี้ต้องเป็นสีเดียวกับแบบเป๊ะ ๆ
               * ยังรับแสงตามปกติ (standard material) จึงเห็นความหนาเป็นด้านสว่าง/ด้านเงา
               */
              <meshStandardMaterial
                color={p.color}
                roughness={0.38}
                metalness={0}
                /* แผงไฟที่อบไว้ให้กระจกใช้ ต้องไม่ไปย้อมงานสีทึบ (LIFE) ให้อิ่มขึ้นกว่าไฟล์ต้นฉบับ */
                envMapIntensity={0}
                toneMapped={false}
              />
            )}
          </mesh>
        ))}
      </group>
    </group>
    </>
  )
}


/**
 * ไฟสตูดิโอของฟองแก้ว — ชุดคงที่ จัดให้สวย ไม่ได้อ่านของที่อยู่ข้าง ๆ
 *
 * ก่อนหน้านี้แผงไฟถูกวางตามทิศจากฟองไปหาตัวอักษร/LIFE เพื่อให้ "รับแสงจริงจากเพื่อนบ้าน"
 * ผลคือหน้าตาของแก้วขึ้นอยู่กับผังบรรทัด: ขนาดจอเปลี่ยน ทิศเปลี่ยน ไฮไลต์ย้ายที่
 * และสีของ LIFE ก็ไปย้อมแก้วจนเลอะ ชุดนี้เป็นเวทีนิ่ง — ผิวแก้วสะท้อนอะไรก็รู้ล่วงหน้า
 *
 * env map เก็บแค่ทิศ ระยะไม่มีความหมาย — ตัวเลข position คือทิศจากใจกลางฟองล้วน ๆ
 * และเพราะไม่ผูกกับผังอีกแล้ว จึงอบครั้งเดียวตลอดอายุแคนวาส (key คงที่ + frames={1})
 */
function StageLight({ gain }: { gain: number }) {
  return (
    <>
      <Environment resolution={128} frames={1}>
        {/* คีย์: แผงใหญ่บนซ้ายหน้า อุ่น — ตัวที่ให้ไฮไลต์ก้อนโตบนหลังโดม */}
        <Lightformer
          form="rect"
          intensity={3.4 * gain}
          color="#fff3e2"
          position={[-5, 9, 9]}
          scale={[16, 12, 1]}
        />
        {/* ฟิล: กว้าง เย็น อยู่ล่างขวาหน้า กันด้านมืดตัน โดยไม่ไปแย่งคีย์ */}
        <Lightformer
          form="rect"
          intensity={1.5 * gain}
          color="#dbeeff"
          position={[7, -4, 8]}
          scale={[14, 10, 1]}
        />
        {/**
         * ริม: แถบแคบสองข้าง สว่างกว่าคีย์
         *
         * นี่คือเส้นที่ทำให้ขอบโค้งอ่านออก — แผงกว้างให้แสงเรียบทั้งผิว แถบแคบ ๆ ที่สว่างจัด
         * ถูกขอบมนบีบเป็นเส้นวิ่งตามสัน ตาจึงเห็นรูปทรงของความหนา
         */}
        <Lightformer
          form="rect"
          intensity={7 * gain}
          color="#ffffff"
          position={[11, 2, 2]}
          scale={[1.2, 9, 1]}
        />
        <Lightformer
          form="rect"
          intensity={5 * gain}
          color="#ffffff"
          position={[-9, 4, -3]}
          scale={[1, 8, 1]}
        />
        {/* accent สองสีจาง ๆ ให้ขอบแก้วมีสีเหลื่อมแบบกระจกจริง ไม่ใช่ขาว-เทาล้วน */}
        <Lightformer
          form="ring"
          intensity={2.2 * gain}
          color="#7fd8ff"
          position={[3, -8, -6]}
          scale={[7, 7, 1]}
        />
        <Lightformer
          form="ring"
          intensity={1.6 * gain}
          color="#ffd3a8"
          position={[-6, -6, 6]}
          scale={[6, 6, 1]}
        />
      </Environment>
      {/**
       * ไฟจริงสำหรับของที่กองอยู่ในฟอง (วัสดุ standard ไม่กิน env ของฟอง)
       *
       * ใช้ directional ไม่ใช่ point: ฉากนี้เป็นหน่วยพิกเซล ระยะเป็นหลักร้อย จุดไฟต้องปิด decay
       * แล้วเดาความสว่างกันใหม่ทุกครั้งที่ผังขยับ — แสงมีทิศเดียวไม่มีระยะจึงตรงกับคำว่า "เวที"
       */}
      <directionalLight color="#ffffff" intensity={1.1 * gain} position={[-160, 240, 320]} />
      <directionalLight color="#bfe4ff" intensity={0.5 * gain} position={[220, -80, 180]} />
    </>
  )
}

/**
 * ฉากหลังที่ "เห็นได้เฉพาะในกระจก"
 *
 * รางสวิตช์ (newhero/Switch) ดูเป็นแก้วจริงเพราะมันหักเห *พิกเซลของฉากที่อยู่ข้างหลังมันจริง ๆ*
 * ฟองอยู่คนละแคนวาส (คนละ WebGL context) ข้างหลังมันในแคนวาสนี้ว่างเปล่า ป้อนสีแบน ๆ ให้
 * MeshTransmissionMaterial แล้วก็ได้แค่แผ่นสีเดียว — ไม่มีอะไรให้บิด ไม่มีอะไรให้เบลอ
 *
 * แผ่นนี้คือ "ของข้างหลัง" ที่ทำขึ้นเอง: ไล่สีฟ้าของหน้า + ก้อนสีชุด accent เบลอ ๆ วางไว้หลังฟอง
 * แล้ว *ปิดการเขียนสีตอนวาดลงจอ* เปิดเฉพาะตอนกระจกถ่ายฉากหลังของตัวเองลง render target
 * (กลับด้านกับ hideInBuffers ที่ Switch ใช้ซ่อนเส้นขอบจากบัฟเฟอร์) — บนจอจึงไม่มีแผ่นนี้
 * เห็นมันได้ทางเดียวคือมองผ่านแก้ว
 */
function backdropTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const ctx = c.getContext('2d')
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, c.height)
    g.addColorStop(0, '#b6dcf7')
    g.addColorStop(1, '#7cbaee')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, c.width, c.height)
    // ก้อนสีของหน้า — กระจกฝ้าจะกวนให้เป็นรอยสีเลือน ๆ เหมือนของหลังรางสวิตช์
    /**
     * ก้อนสีเบา ๆ ใหญ่ ๆ ไม่ใช่จุดสีเข้ม
     *
     * ตอนแก้วเป็นฝ้า ก้อนเข้มถูกกวนจนเป็นคราบสีสวย แต่ตอนแก้ว "ใสแจ๋ว" มันจะถูกฉายออกมา
     * คมชัด กลายเป็นก้อนสีลอยอยู่หลังฟองที่ไม่มีอยู่จริงในฉาก — เหลือไว้แค่ให้ผิวแก้ว
     * มีอะไรเปลี่ยนสีบ้างตอนบิด ไม่ให้เป็นฟ้าเรียบก้อนเดียว
     */
    ctx.globalAlpha = 0.22
    const blobs: [number, number, number, string][] = [
      [110, 140, 210, '#fd5000'],
      [390, 130, 180, '#008254'],
      [300, 390, 230, '#ad85fe'],
      [80, 410, 190, '#158ffc'],
    ]
    for (const [x, y, r, color] of blobs) {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
      rg.addColorStop(0, color)
      rg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = rg
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    ctx.globalAlpha = 1
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function GlassBackdrop({ cx, cy, w, h, z }: { cx: number; cy: number; w: number; h: number; z: number }) {
  const tex = useMemo(() => backdropTexture(), [])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh
      position={[cx, cy, z]}
      onBeforeRender={(renderer, _scene, _camera, _geo, material) => {
        // เขียนสีเฉพาะตอนวาดลง render target ของกระจก ไม่ใช่ตอนวาดลงจอ
        ;(material as THREE.Material).colorWrite = renderer.getRenderTarget() !== null
      }}
    >
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  )
}

/** สีของก้อนที่อยู่ในฟอง — น้ำเงินชุดของหน้า ต่างเฉดกันพอให้แยกก้อนออกจากกันหลังกระจกฝ้า */
const LIFE_COLORS = ['#2052cd', '#265ada', '#158ffc', '#6aa9ee']

/** สุ่มแบบกำหนดผลได้ — ผังของก้อนต้องเหมือนกันทุกครั้งที่โหลด ไม่ใช่สลับที่ทุกรีเฟรช */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296
    return a / 4294967296
  }
}

/** ทรงเรขาคณิตพื้นฐานของกล่องทราย — ลูกบาศก์ ลูกกลม กรวย ห่วง */
type Kind = 'box' | 'sphere' | 'cone' | 'torus'

type Bit = {
  kind: Kind
  color: string
  /** รัศมีที่ใช้ชน (ทุกก้อนชนกันเป็นทรงกลม) และขนาดของรูปที่วาด */
  r: number
  /**
   * ระยะจากใจกลางถึงท้องของ *รูปที่วาด* — ใช้ตอนวางบนทราย
   *
   * รัศมีชนครอบมุมที่ไกลสุดของทรง ถ้าเอาค่านั้นมาวางของจะลอยเหนือทราย (ลูกบาศก์ลอยชัดสุด)
   * ของกลิ้งพลิกไปเรื่อย จึงใช้ระยะที่สั้นที่สุดของทรง — จมทรายนิดหน่อยดีกว่าลอย
   */
  rest: number
  size: number
  long: number
  pos: THREE.Vector3
  vel: THREE.Vector3
  /** แกนหมุนของก้อน — หมุนเร็วตามความเร็วที่มันเคลื่อนที่ */
  axis: THREE.Vector3
  quat: THREE.Quaternion
}

/**
 * ── ทำไมไม่ใช้ @react-three/rapier ──
 *
 * ลองแล้วมันพังทั้งแคนวาส: `R3F: Hooks can only be used within the Canvas component!`
 * ตอน <Physics> ขึ้น (rapier 2.2.0 ประกาศ peer เป็น fiber ^9.0.4 แต่โปรเจกต์อยู่ 9.6.1)
 * หัวเรื่องทั้งบล็อกหายไปทั้งก้อนเพราะแคนวาสถูกถอด
 *
 * ของในฟองมีไม่กี่ก้อนและอยู่ในกล่องปิด ไม่ต้องใช้เอนจินเต็มตัว: อินทิเกรตเอง (ความเร่ง →
 * ความเร็ว → ตำแหน่ง) ชนผนังหกด้าน และชนกันเองแบบทรงกลม-ทรงกลม (9 ก้อน = 36 คู่ต่อเฟรม)
 * เป็นพลศาสตร์จริง มีแรงโน้มถ่วง การคืนตัว แรงเสียดทาน และโมเมนตัมส่งต่อกันเป็นทอด ๆ
 * แค่ทรงที่ใช้ชนถูกลดเป็นทรงกลม — หลังกระจกฝ้าตาไม่จับความต่างนั้น
 */
/** เสียดทานตามแนวสัมผัสตอนกระทบพื้น — ค่าที่เหลือ (แรงโน้มถ่วง/คืนตัว/หนืด) อยู่ในแผงจูน */
const TANG = 0.82

/**
 * ทรายในฟอง — สนามทรายจริง ไม่ใช่พื้นลายทราย
 *
 * เก็บเป็น "ความสูงต่อคอลัมน์" (height field) ไม่ใช่เม็ดทรายเป็นล้านเม็ด: พฤติกรรมที่ตาอ่านว่า
 * ทรายคือ *มุมกอง* (angle of repose) — กองสูงชันเกินค่าหนึ่งแล้วไหลลงเอง ของหนักกดลงไปเป็น
 * หลุมและดันสันขึ้นข้าง ๆ ทั้งสองอย่างนี้อยู่ในกริดความสูงได้ครบ ด้วยราคาไม่กี่พันเซลล์ต่อเฟรม
 * (เม็ดจริงต้องแก้การชนแบบคู่ ๆ หลายแสนคู่ต่อเฟรม — ไม่มีทางอยู่ในงบของแคนวาสนี้)
 *
 * ปริมาตรคงที่: การไหลย้ายทรายจากคอลัมน์หนึ่งไปอีกคอลัมน์ ไม่ได้ลบทิ้ง และการขุดของก้อนก็เอา
 * ส่วนที่ถูกกดไปโปะขอบหลุม ทรายจึงไม่หายและไม่งอกออกมาจากไหน
 */
/** สีทราย — อ่อนพอให้อยู่ในฟองใสได้โดยไม่กลายเป็นก้อนโคลนทึบ */
const SAND_COLOR = '#e2c79a'
/** ความละเอียดของรอยขอบล่าง — ตรงกับจำนวนคอลัมน์ทรายตามแกน x */
const PROFILE_N = 88
const SAND_NX = 44
const SAND_NZ = 22

type Sand = {
  nx: number
  nz: number
  /**
   * ความสูงของ *ผิวทราย* ต่อคอลัมน์ เป็นค่าสัมบูรณ์ในพิกัดกลุ่ม ไม่ใช่ความหนาเหนือพื้น
   *
   * ต้องเป็นค่าสัมบูรณ์เพราะพื้นไม่ได้ราบ: ฟองคำพูดมีแง่งลูกศรที่ก้นลงลึกกว่าตัวฟอง
   * ทรายไหลไปหา "ระดับเดียวกัน" ซึ่งเทียบกันได้เฉพาะเมื่อวัดจากจุดอ้างอิงเดียวกันทั้งสนาม
   */
  top: Float32Array
  /** ก้นของรูปตรงคอลัมน์นั้น (ตามแกน x เท่านั้น — ความหนาของฟองเท่ากันทุกที่) */
  floor: Float32Array
  /** ขนาดเซลล์ตามแกน x และ z */
  dx: number
  dz: number
  /** มุมของสนามในพิกัดกลุ่ม — สนามไม่ได้กลางห้อง มันกินแค่ช่วงที่รูปมีแอ่งให้ทรายอยู่ */
  x0: number
  z0: number
  /** ผิวเป็นเม็ด ๆ — คลื่นความถี่สูงคงที่ที่บวกทับความสูงตอนวาด ไม่ใช่ส่วนที่ไหลได้ */
  grain: Float32Array
  dirty: boolean
}

/**
 * @param floorAt ก้นของรูปที่พิกัด x (พิกัดกลุ่ม) — พื้นตามรอย silhouette ไม่ใช่ระนาบเดียว
 * @param level ระดับผิวทรายตั้งต้น (พิกัดกลุ่ม) ทรายเทลงไปเต็มทุกซอกที่ต่ำกว่านี้
 */
/**
 * @param x0 ขอบซ้ายของสนาม, @param x1 ขอบขวา (พิกัดกลุ่ม) — เท่ากับช่วงที่รูปมีแอ่ง
 * @param floorAt ก้นของรูปที่พิกัด x — พื้นตามรอย silhouette ไม่ใช่ระนาบเดียว
 * @param level ระดับผิวทรายตั้งต้น ทรายเทลงเต็มทุกซอกที่ต่ำกว่านี้
 */
function makeSand(
  x0: number,
  x1: number,
  iz: number,
  floorAt: (x: number) => number,
  level: number,
): Sand {
  const nx = SAND_NX
  const nz = SAND_NZ
  const dx = (x1 - x0) / (nx - 1)
  const dz = (iz * 2) / (nz - 1)
  const top = new Float32Array(nx * nz)
  const floor = new Float32Array(nx)
  const grain = new Float32Array(nx * nz)
  const rnd = seeded(20260911)
  for (let i = 0; i < nx; i += 1) floor[i] = floorAt(x0 + i * dx)
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const k = j * nx + i
      const u = i / (nx - 1)
      const v = j / (nz - 1)
      // เนินอ่อน ๆ ตั้งต้น ไม่ใช่ผิวเรียบกริบ — ทรายที่ไม่มีใครแตะก็ไม่ได้ราบเป็นกระจก
      const dune =
        Math.sin(u * 6.1 + 0.7) * 0.05 + Math.sin(v * 4.3 - 1.1) * 0.03 + Math.sin((u + v) * 8.2) * 0.02
      const span = Math.max(1e-3, level - floor[i])
      top[k] = Math.max(floor[i], level + span * dune)
      grain[k] = (rnd() * 2 - 1) * Math.min(span, dz) * 0.06
    }
  }
  return { nx, nz, top, floor, dx, dz, x0, z0: -iz, grain, dirty: true }
}

/** ก้นของรูปที่พิกัด x — คอลัมน์ที่ใกล้สุด (พื้นเปลี่ยนตามแกน x เท่านั้น) */
function sandFloorAt(s: Sand, x: number) {
  const i = Math.max(0, Math.min(s.nx - 1, Math.round((x - s.x0) / s.dx)))
  return s.floor[i]
}

/** ระดับผิวทรายที่พิกัดใด ๆ (ค่าสัมบูรณ์) — ประมาณเชิงเส้นสองแกนจากสี่คอลัมน์ที่ล้อมอยู่ */
function sandHeight(s: Sand, x: number, z: number) {
  const fx = Math.max(0, Math.min(s.nx - 1, (x - s.x0) / s.dx))
  const fz = Math.max(0, Math.min(s.nz - 1, (z - s.z0) / s.dz))
  const i0 = Math.floor(fx)
  const j0 = Math.floor(fz)
  const i1 = Math.min(s.nx - 1, i0 + 1)
  const j1 = Math.min(s.nz - 1, j0 + 1)
  const tx = fx - i0
  const tz = fz - j0
  const a = s.top[j0 * s.nx + i0] * (1 - tx) + s.top[j0 * s.nx + i1] * tx
  const b = s.top[j1 * s.nx + i0] * (1 - tx) + s.top[j1 * s.nx + i1] * tx
  return a * (1 - tz) + b * tz
}

/**
 * ก้อนกดทราย — คอลัมน์ที่อยู่ใต้ก้อนถูกกดลงถึงท้องก้อน ทรายที่ถูกกดไปโปะเป็นสันรอบหลุม
 *
 * ไม่ได้ "ลบ" ทราย: รวมส่วนที่กดได้เท่าไรก็หารแจกลงวงรอบนอกเท่านั้น ปริมาตรจึงคงที่
 * (เคยลองลบทิ้งเฉย ๆ — ทรายค่อย ๆ หายไปทั้งสนามหลังคนเล่นไปสักพัก)
 */
function sandPress(s: Sand, x: number, z: number, r: number, top: number, gain: number) {
  if (gain <= 0 || r <= 0) return
  const rim: number[] = []
  let moved = 0
  const ri = Math.ceil((r * 1.9) / s.dx) + 1
  const rj = Math.ceil((r * 1.9) / s.dz) + 1
  const ci = Math.round((x - s.x0) / s.dx)
  const cj = Math.round((z - s.z0) / s.dz)
  for (let j = cj - rj; j <= cj + rj; j += 1) {
    if (j < 0 || j >= s.nz) continue
    for (let i = ci - ri; i <= ci + ri; i += 1) {
      if (i < 0 || i >= s.nx) continue
      const px = s.x0 + i * s.dx - x
      const pz = s.z0 + j * s.dz - z
      const d = Math.hypot(px, pz)
      const k = j * s.nx + i
      if (d <= r) {
        // กดได้ไม่เกินก้นของรูป ทรายในซอกลึกจึงไม่ถูกดันจนกลายเป็นค่าติดลบใต้พื้น
        const cut = Math.min((s.top[k] - top) * gain, s.top[k] - s.floor[i])
        if (cut > 0) {
          s.top[k] -= cut
          moved += cut
        }
      } else if (d <= r * 1.9) rim.push(k)
    }
  }
  if (moved > 0 && rim.length) {
    const share = moved / rim.length
    for (const k of rim) s.top[k] += share
    s.dirty = true
  }
}

/**
 * มุมกอง — ผลต่างความสูงของคอลัมน์ข้างกันเกินเกณฑ์เท่าไร ส่วนเกินไหลลงไปหาคอลัมน์ที่ต่ำกว่า
 * เกณฑ์คิดเป็น "ความชัน × ขนาดเซลล์" ความละเอียดกริดจึงไม่เปลี่ยนหน้าตาของกอง
 */
function sandRelax(s: Sand, slope: number) {
  const limX = slope * s.dx
  const limZ = slope * s.dz
  let flow = 0
  /** ย้ายทรายจาก a ไป b ได้ไม่เกินที่ a มีอยู่จริงเหนือก้นของมัน */
  const move = (a: number, b: number, want: number) => {
    const ai = a % s.nx
    const give = Math.min(want, s.top[a] - s.floor[ai])
    if (give <= 0) return 0
    s.top[a] -= give
    s.top[b] += give
    return give
  }
  for (let j = 0; j < s.nz; j += 1) {
    for (let i = 0; i < s.nx; i += 1) {
      const k = j * s.nx + i
      if (i + 1 < s.nx) {
        const d = s.top[k] - s.top[k + 1]
        if (Math.abs(d) > limX) {
          const want = (Math.abs(d) - limX) * 0.25
          flow += d > 0 ? move(k, k + 1, want) : move(k + 1, k, want)
        }
      }
      if (j + 1 < s.nz) {
        const d = s.top[k] - s.top[k + s.nx]
        if (Math.abs(d) > limZ) {
          const want = (Math.abs(d) - limZ) * 0.25
          flow += d > 0 ? move(k, k + s.nx, want) : move(k + s.nx, k, want)
        }
      }
    }
  }
  if (flow > 0) s.dirty = true
  return flow
}

/**
 * เรขาคณิตของสนามทราย — ผิวด้านบนเป็นกริด บวก "ผ้ากันเปื้อน" สี่ด้านที่ห้อยลงถึงพื้นห้อง
 *
 * ถ้ามีแค่ผิวด้านบน มองผ่านกระจกด้านหน้าจะเห็นใต้แผ่นเป็นช่องว่างลอยอยู่เหนือพื้น (ลองแล้ว)
 * ผ้าสี่ด้านทำให้ทรายอ่านเป็นชั้นที่มีความหนาจริง ก้นไม่ต้องปิดเพราะพื้นห้องบังอยู่
 */
function sandGeometry(s: Sand) {
  const { nx, nz } = s
  const top = nx * nz
  // ขอบรอบสนาม เดินตามเข็ม: บน → ขวา → ล่าง → ซ้าย (ใช้คู่กับจุดล่างที่พื้น)
  const ring: number[] = []
  for (let i = 0; i < nx; i += 1) ring.push(i)
  for (let j = 1; j < nz; j += 1) ring.push(j * nx + nx - 1)
  for (let i = nx - 2; i >= 0; i -= 1) ring.push((nz - 1) * nx + i)
  for (let j = nz - 2; j >= 1; j -= 1) ring.push(j * nx)
  const count = top + ring.length
  const pos = new Float32Array(count * 3)
  const idx: number[] = []
  for (let j = 0; j < nz - 1; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      const a = j * nx + i
      idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1)
    }
  }
  for (let k = 0; k < ring.length; k += 1) {
    const a = ring[k]
    const b = ring[(k + 1) % ring.length]
    const la = top + k
    const lb = top + ((k + 1) % ring.length)
    idx.push(a, la, b, b, la, lb)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(idx)
  return { geo, ring }
}

/** เขียนความสูงล่าสุดลงในเรขาคณิต — เรียกเฉพาะเฟรมที่ทรายขยับจริง */
function sandSync(s: Sand, geo: THREE.BufferGeometry, ring: number[]) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const arr = pos.array as Float32Array
  for (let j = 0; j < s.nz; j += 1) {
    for (let i = 0; i < s.nx; i += 1) {
      const k = j * s.nx + i
      const o = k * 3
      arr[o] = s.x0 + i * s.dx
      arr[o + 1] = Math.max(s.floor[i], s.top[k] + s.grain[k])
      arr[o + 2] = s.z0 + j * s.dz
    }
  }
  const base = s.nx * s.nz
  for (let k = 0; k < ring.length; k += 1) {
    const src = ring[k] * 3
    const o = (base + k) * 3
    arr[o] = arr[src]
    // ผ้ากันเปื้อนห้อยลงถึงก้นของรูปตรงคอลัมน์นั้น ไม่ใช่ระดับเดียวกันทั้งแถบ
    arr[o + 1] = s.floor[ring[k] % s.nx]
    arr[o + 2] = arr[src + 2]
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
}

function BubbleLife({
  cx,
  cy,
  cz,
  hx,
  hy,
  hz,
  profile,
}: {
  /** ใจกลางฟองในพิกัดแคนวาส (พิกเซล) */
  cx: number
  cy: number
  cz: number
  /** ครึ่งขนาดของฟองทั้งใบ — ห้องข้างในยุบเข้ามาจากค่านี้ */
  hx: number
  hy: number
  hz: number
  /** ขอบล่างของรูปทีละช่วงความกว้าง (0 = ขอบบนกรอบ, 1 = ขอบล่าง) — พื้นของสนามทราย */
  profile: Float32Array | null
}) {
  const { invalidate, size } = useThree()
  const t = useTuner()
  /** ผนังยุบเข้ามาจากผิวฟอง — ฟองเป็นสี่เหลี่ยมมุมมนมีหางล่างซ้าย ของจึงต้องไม่ชิดขอบ */
  const ix = Math.max(8, hx * t.bbRoomX)
  const iz = Math.max(6, hz * t.bbRoomZ)
  /**
   * พื้นห้องอยู่ที่ก้นฟองเสมอ ไม่ใช่กลางฟอง
   *
   * ถ้าคิดห้องเป็นกล่องสมมาตรรอบใจกลางฟอง ห้องที่เตี้ยกว่าฟอง (bbRoomY < 1) จะมีพื้นลอย
   * อยู่กลางใบ ของกองค้างกลางอากาศ — ยึดพื้นไว้ที่ขอบล่างในของฟองแล้วให้ bbRoomY คุม
   * "ความสูงของห้อง" ขึ้นไปจากพื้นนั้น เพดานเตี้ยลงแทน
   */
  const wallY = hy * 0.86
  const iy = Math.max(8, wallY * t.bbRoomY)
  /** ระยะที่ต้องเลื่อนห้องลง เพื่อให้พื้น (−iy ในพิกัดห้อง) ไปอยู่ที่ขอบล่างในของฟอง */
  const oy = -(wallY - iy)
  /** ขนาดก้อนอ้างอิงความสูงห้อง — ฟองโตขึ้นของโตตาม สัดส่วนภาพคงเดิมทุกขนาดจอ */
  const unit = iy * t.bbSize
  const count = Math.max(0, Math.round(t.bbCount))

  const bits = useMemo<Bit[]>(() => {
    const rnd = seeded(20260910)
    const cycle: Kind[] = ['box', 'sphere', 'cone', 'torus']
    const kinds: Kind[] = Array.from({ length: count }, (_, i) => cycle[i % cycle.length])
    return kinds.map((kind, i) => {
      const size = unit * (0.72 + rnd() * 0.5)
      const long = unit * (1.1 + rnd() * 1.4)
      return {
        kind,
        color: LIFE_COLORS[i % LIFE_COLORS.length],
        size,
        long,
        /**
         * ทรงกลมที่ใช้ชนต้องครอบรูปที่วาดทั้งชิ้น ไม่ใช่แค่ครึ่งความกว้าง
         * ไม่งั้นมุมของลูกบาศก์หรือขอบห่วงจะโผล่ออกนอกผนัง (เห็นเป็นของทะลุขอบฟองออกมา)
         */
        r:
          kind === 'sphere'
            ? size * 0.62
            : kind === 'box'
              ? size * 0.87
              : kind === 'cone'
                ? size * 0.75
                : size * 0.85,
        rest:
          kind === 'sphere'
            ? size * 0.62
            : kind === 'box'
              ? size * 0.5
              : kind === 'cone'
                ? size * 0.6
                : size * 0.24,
        // เริ่มลอยกระจายในห้องแล้วปล่อยให้ตกลงไปกองเอง ไม่ได้จัดกองไว้ให้ตั้งแต่แรก
        pos: new THREE.Vector3(
          (rnd() * 2 - 1) * ix * 0.55,
          iy * (0.1 + rnd() * 0.8),
          (rnd() * 2 - 1) * iz * 0.4,
        ),
        vel: new THREE.Vector3((rnd() * 2 - 1) * 60, 0, (rnd() * 2 - 1) * 30),
        axis: new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize(),
        quat: new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(rnd(), rnd(), rnd()).normalize(),
          rnd() * Math.PI,
        ),
      }
    })
  }, [ix, iy, iz, unit, count])

  /**
   * สนามทราย — สร้างใหม่เมื่อขนาดห้องหรือระดับทรายเปลี่ยน (สลับหน้าจอ/ลากสไลเดอร์)
   * ปั้นกองให้เข้าที่ก่อนเฟรมแรกด้วยการไหลซ้ำ ๆ ไม่ปล่อยให้คนเห็นกองยุบตัวตอนเปิดหน้า
   */
  const sand = useMemo(() => {
    /**
     * ก้นของสนามทรายคือขอบล่างของรูปจริง ยกขึ้นมาเท่าความหนาผนัง — ไม่ใช่ย่อเข้าหาใจกลาง
     *
     * เคยคูณพิกัด y ด้วย 0.86 (อัตราเดียวกับผนัง) ซึ่งไม่ใช่การยุบขอบเข้ามา: มันทำให้ส่วนที่
     * *โค้ง* แบนลง ปลายขวาของฟองที่ก้นไต่ขึ้นจาก y 99 → 48 (วัดจากไฟล์แล้ว) จึงเพี้ยนไปครึ่งหนึ่ง
     * การยกขึ้นเท่ากันทุกจุดคือ offset ที่รักษารูปโค้งไว้
     */
    const inset = hy - wallY
    const floorAt = (x: number) => {
      const flat = -iy
      if (!profile || profile.length === 0) return flat
      const u = (x + hx) / Math.max(1e-6, hx * 2)
      const f = Math.max(0, Math.min(1, u)) * (profile.length - 1)
      const k0 = Math.floor(f)
      const k1 = Math.min(profile.length - 1, k0 + 1)
      const p = profile[k0] + (profile[k1] - profile[k0]) * (f - k0)
      /** p = สัดส่วนจากขอบบนกรอบ (0) ถึงขอบล่าง (1) → พิกัดกลางฟอง → พิกัดกลุ่มนี้ */
      const bottom = hy - p * hy * 2
      return Math.min(iy, bottom + inset - oy)
    }
    /**
     * ระดับทรายวัดจากก้นของ *ตัวฟอง* ไม่ใช่จากปลายที่ต่ำสุด และสนามกินความกว้างของฟองทั้งใบ
     * ไม่ใช่แค่ช่วงที่ก้อนวิ่งได้ (ix) — ไม่งั้นทรายจบเป็นกำแพงตัดตรงก่อนถึงส่วนโค้งปลายฟอง
     */
    const probe = Array.from({ length: SAND_NX * 3 }, (_, i) => {
      const x = -hx + (i / (SAND_NX * 3 - 1)) * hx * 2
      return { x, y: floorAt(x) }
    })
    const base = probe.map((q) => q.y).sort((a, b) => a - b)[Math.floor(probe.length / 2)]
    const level = base + (iy - base) * Math.max(0, Math.min(0.6, t.bbSand))
    /**
     * สนามจบตรงที่ก้นของรูปไต่ขึ้นมาถึงระดับทราย — ขอบทรายจึงค่อย ๆ บางลงตามส่วนโค้งของฟอง
     * แทนที่จะถูกตัดเป็นหน้าตัดตรง (มุมมนซ้าย-ขวาไม่มีแอ่งให้ทรายอยู่ ปูกริดไปก็ได้แผ่นหนาศูนย์)
     */
    const wet = probe.filter((q) => q.y < level)
    const x0 = wet.length ? wet[0].x : -ix
    const x1 = wet.length ? wet[wet.length - 1].x : ix
    const made = makeSand(x0, x1, iz, floorAt, level)
    for (let n = 0; n < 24; n += 1) sandRelax(made, t.bbRepose)
    return made
  }, [ix, iy, iz, hx, hy, oy, wallY, profile, t.bbSand, t.bbRepose])
  const sandMesh = useMemo(() => sandGeometry(sand), [sand])
  useEffect(() => () => sandMesh.geo.dispose(), [sandMesh])

  const meshes = useRef<(THREE.Mesh | null)[]>([])
  /** ลูกกวน = เมาส์ในพิกัดห้อง เก็บตำแหน่งเฟรมก่อนไว้คิดความเร็วของมันเอง */
  const stir = useMemo(
    () => ({ p: new THREE.Vector3(1e5, 1e5, 0), v: new THREE.Vector3(), on: false }),
    [],
  )
  const tmp = useMemo(() => ({ d: new THREE.Vector3(), n: new THREE.Vector3(), q: new THREE.Quaternion() }), [])

  useFrame((_state, raw) => {
    // เฟรมยาว ๆ (แท็บกลับมา/โหลดสะดุด) ต้องไม่กลายเป็นก้าวเดียวยาวจนของทะลุผนัง
    const dt = Math.min(raw, 1 / 30)
    const stirR = unit * 1.1

    /** เมาส์เข้าห้องไหม — พิกัดเมาส์เป็นพิกเซลหน้าต่าง แปลงเข้าพิกัดแคนวาสแล้วลบใจกลางห้อง */
    const mx = mouse.x - fieldRect.left - size.width / 2 - cx
    const my = size.height / 2 - (mouse.y - fieldRect.top) - (cy + oy)
    const on = Math.abs(mx) < ix + stirR && Math.abs(my) < iy + stirR
    if (on) {
      tmp.d.set(mx, my, 0)
      stir.v.subVectors(tmp.d, stir.p).divideScalar(Math.max(dt, 1e-4))
      if (!stir.on) stir.v.set(0, 0, 0)
      stir.p.copy(tmp.d)
    }
    stir.on = on

    let moving = false
    for (const b of bits) {
      b.vel.y -= t.bbG * dt
      b.vel.multiplyScalar(Math.max(0, 1 - t.bbDrag * dt))
      b.pos.addScaledVector(b.vel, dt)

      // ผนังหกด้าน: ดันกลับเข้าห้อง สะท้อนตามแนวตั้งฉาก หน่วงตามแนวสัมผัส
      const lim: [ 'x' | 'y' | 'z', number ][] = [
        ['x', ix],
        ['y', iy],
        ['z', iz],
      ]
      /** ก้นห้องตรงคอลัมน์นี้ — ของตกลงในซอกแง่งได้ ไม่ใช่ค้างบนระนาบสมมติ */
      const deck = sandFloorAt(sand, b.pos.x)
      for (const [axis, half] of lim) {
        /**
         * ห้องแคบกว่าก้อน (ฟองบางมาก / ก้อนใหญ่มาก) ต้องได้ 0 ไม่ใช่ค่าติดลบ
         * ค่าติดลบทำให้การหนีบตำแหน่งกลับด้าน ก้อนจะถูกดีดไปค้างนอกห้องแทน
         */
        const room = Math.max(0, half - b.r)
        const low = axis === 'y' ? deck + b.rest : -room
        if (b.pos[axis] > room) {
          b.pos[axis] = room
          if (b.vel[axis] > 0) b.vel[axis] = -b.vel[axis] * t.bbBounce
        } else if (b.pos[axis] < low) {
          b.pos[axis] = low
          if (b.vel[axis] < 0) b.vel[axis] = -b.vel[axis] * t.bbBounce
        } else {
          continue
        }
        if (axis === 'y') {
          b.vel.x *= TANG
          b.vel.z *= TANG
        }
      }

      /**
       * ท้องก้อนชนผิวทราย — ผิวไม่ใช่ระนาบ ความสูงอ่านจากกริดตรงใต้ก้อน
       *
       * ทรายดูดแรงกว่าผนังแก้ว: เด้งน้อยกว่าและเสียดทานมากกว่า ของจึงหยุดจมอยู่ในหลุมของตัวเอง
       * ไม่กระเด้งกลิ้งต่อเหมือนตกบนพื้นแข็ง
       */
      const ground = sandHeight(sand, b.pos.x, b.pos.z)
      if (b.pos.y - b.rest < ground) {
        b.pos.y = ground + b.rest
        if (b.vel.y < 0) b.vel.y = -b.vel.y * t.bbBounce * 0.35
        b.vel.x *= 0.86
        b.vel.z *= 0.86
        // กดทรายเป็นหลุมตามน้ำหนัก แรงกดคิดจากความเร็วที่ลงมา (ตกแรง = หลุมลึก)
        sandPress(
          sand,
          b.pos.x,
          b.pos.z,
          b.r * 0.9,
          b.pos.y - b.rest,
          Math.min(0.5, 0.06 + Math.abs(b.vel.y) * 0.0015) * t.bbDig,
        )
      }

      // ลูกกวนของเมาส์ — ดันก้อนออกแล้วส่งความเร็วของตัวเองให้ ของจึงกลิ้งตามมือ
      if (stir.on) {
        tmp.d.subVectors(b.pos, stir.p)
        const reach = b.r + stirR
        const len = tmp.d.length()
        if (len < reach && len > 1e-4) {
          tmp.n.copy(tmp.d).divideScalar(len)
          b.pos.addScaledVector(tmp.n, reach - len)
          b.vel.addScaledVector(tmp.n, (reach - len) * 12 * t.bbStir)
          b.vel.addScaledVector(stir.v, 0.28 * t.bbStir)
        }
      }
    }

    // ชนกันเอง: แยกออกครึ่งทางคนละครึ่ง แล้วแลกโมเมนตัมตามแนวเชื่อมศูนย์ (มวลเท่ากัน)
    for (let i = 0; i < bits.length; i += 1) {
      for (let j = i + 1; j < bits.length; j += 1) {
        const a = bits[i]
        const c = bits[j]
        tmp.d.subVectors(c.pos, a.pos)
        const reach = a.r + c.r
        const len = tmp.d.length()
        if (len >= reach || len < 1e-4) continue
        tmp.n.copy(tmp.d).divideScalar(len)
        const push = (reach - len) * 0.5
        a.pos.addScaledVector(tmp.n, -push)
        c.pos.addScaledVector(tmp.n, push)
        const rel = tmp.n.dot(tmp.d.subVectors(c.vel, a.vel))
        if (rel >= 0) continue
        const imp = -rel * (1 + t.bbBounce) * 0.5
        a.vel.addScaledVector(tmp.n, -imp)
        c.vel.addScaledVector(tmp.n, imp)
      }
    }

    /**
     * ปิดท้ายด้วยการยัดทุกก้อนกลับเข้าห้อง
     *
     * ทั้งลูกกวนของเมาส์และการแยกก้อนที่ซ้อนกันดัน "ตำแหน่ง" ตรง ๆ หลังจากเช็คผนังไปแล้ว
     * ถ้าไม่เช็คอีกรอบ ก้อนที่ถูกดันจะค้างอยู่นอกผนังตลอดเวลาที่เมาส์ยังกดอยู่ที่เดิม
     * (เห็นเป็นแท่งโผล่ออกนอกฟอง)
     */
    for (const b of bits) {
      const room: [ 'x' | 'y' | 'z', number ][] = [
        ['x', Math.max(0, ix - b.r)],
        ['z', Math.max(0, iz - b.r)],
      ]
      for (const [axis, half] of room) {
        b.pos[axis] = Math.max(-half, Math.min(half, b.pos[axis]))
      }
      b.pos.y = Math.max(sandFloorAt(sand, b.pos.x) + b.rest, Math.min(iy - b.r, b.pos.y))
    }

    for (let i = 0; i < bits.length; i += 1) {
      const b = bits[i]
      const m = meshes.current[i]
      const speed = b.vel.length()
      if (speed > 6) moving = true
      // หมุนตามที่วิ่ง — ไม่ได้แก้สมการโมเมนต์ ของกลิ้งเร็วตามความเร็วของตัวเองก็พอ
      tmp.q.setFromAxisAngle(b.axis, (speed / Math.max(unit, 1)) * dt * 0.9)
      b.quat.multiply(tmp.q)
      if (m) {
        m.position.copy(b.pos)
        m.quaternion.copy(b.quat)
      }
    }

    /**
     * นิ้วไถทราย — ลูกกวนตัวเดียวกับที่ดันก้อน กดคอลัมน์ที่มันผ่านลงเป็นร่อง
     * มีผลเฉพาะตอนที่มันอยู่ต่ำกว่าผิวทราย ไม่ใช่ลอยอยู่เหนือกองแล้วทรายยุบตาม
     */
    if (stir.on) {
      const dip = stir.p.y - stirR
      if (dip < sandHeight(sand, stir.p.x, 0)) {
        sandPress(sand, stir.p.x, 0, stirR, dip, 0.45 * t.bbDig)
      }
    }

    // ทรายไหลหามุมกองของตัวเองต่อ ถึงจะไม่มีใครแตะในเฟรมนี้ (กองที่ยังชันอยู่ต้องยุบต่อ)
    const flow = sandRelax(sand, t.bbRepose)
    if (sand.dirty) {
      sandSync(sand, sandMesh.geo, sandMesh.ring)
      sand.dirty = false
    }

    // ยังมีของขยับ (ทราย/ก้อน/มือ) ก็ขอเฟรมใหม่ — นิ่งหมดแล้วแคนวาสหยุดวาดสนิท
    if (moving || stir.on || flow > unit * 0.002) invalidate()
  })

  return (
    <group position={[cx, cy + oy, cz]}>
      {/**
       * ทราย — ด้าน ไม่มัน และไม่รับ env ของฟอง (แผงไฟเวทีจะทำให้ทรายเงาเหมือนพลาสติก)
       * สีมาจากวัสดุเดียว ความลึกของกองอ่านได้จากเงาที่เกิดจาก normal ของกริดเอง
       */}
      <mesh geometry={sandMesh.geo}>
        <meshStandardMaterial color={SAND_COLOR} roughness={0.98} metalness={0} envMapIntensity={0.15} />
      </mesh>
      {bits.map((b, i) => (
        <mesh
          key={i}
          ref={(n) => {
            meshes.current[i] = n
          }}
          position={b.pos}
          quaternion={b.quat}
        >
          {b.kind === 'box' && <boxGeometry args={[b.size, b.size, b.size]} />}
          {b.kind === 'sphere' && <sphereGeometry args={[b.size * 0.62, 20, 14]} />}
          {b.kind === 'cone' && <coneGeometry args={[b.size * 0.6, b.size * 1.25, 20]} />}
          {b.kind === 'torus' && (
            <torusGeometry args={[b.size * 0.55, b.size * 0.24, 12, 24]} />
          )}
          <meshStandardMaterial
            color={b.color}
            roughness={0.45}
            metalness={0}
            envMapIntensity={0.5}
          />
        </mesh>
      ))}
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
  const t = useTuner()
  const pad = t.hlPad
  /** ตัวคูณขนาดของทั้งบล็อก — ส่งลง CSS ให้ทั้งตัวหนังสือ, LIFE และฟองใช้ค่าเดียวกัน */
  const size = t.hlSize
  const cfg = useMemo<Cfg>(
    () => ({
      rad: t.hlRad,
      push: t.hlPush,
      lift: t.hlLift,
      ease: t.hlEase,
      depth: t.hlDepth,
      bevT: t.hlBevT,
      bevS: t.hlBevS,
      seg: Math.max(1, Math.round(t.hlSeg)),
      rough: t.hlRough,
      emis: t.hlEmis,
      alb: t.hlAlb,
      enter: t.hlEnter,
      rise: t.hlRise,
      stag: t.hlStag,
      track: t.hlTrack,
      rot: [
        (t.hlRotX * Math.PI) / 180,
        (t.hlRotY * Math.PI) / 180,
        (t.hlRotZ * Math.PI) / 180,
      ],
    }),
    [t],
  )
  const [, setTick] = useState(0)
  const store = useMemo(
    () => ({ lines: new Map<number, LineBox>(), bump: () => setTick((v) => v + 1) }),
    [],
  )
  const heroReady = useNewHeroReady()
  const [settled, setSettled] = useState(false)

  /**
   * ขึ้นเมื่ออินโทรของฉากเล่นจบ ไม่ใช่เมื่อครบกี่วินาทีที่ตั้งไว้เอง
   *
   * hlAfter คือ *ระยะห่างจากจุดจบของอินโทร* (ติดลบได้ = ขึ้นซ้อนท้ายอินโทร) จุดจบมาจาก
   * introEnd() ซึ่งคิดจากตารางเวลาชุดเดียวกับที่ของทุกชิ้นในฉากใช้โผล่ — ลากสไลเดอร์อินโทร
   * แล้วหัวเรื่องเลื่อนตามเอง
   *
   * เช็คทุกเฟรมด้วย rAF ไม่ใช่ตั้งเวลาทุก 250ms: นาฬิกาอินโทรเดินตามเฟรม การถามด้วยนาฬิกา
   * ผนังจึงคลาดได้ถึงหนึ่งช่วงถาม ซึ่งมองเห็นเมื่อของทั้งฉากลงจังหวะเดียวกัน
   */
  useEffect(() => {
    if (!heroReady || settled) return undefined
    let raf = 0
    let done = false
    const go = () => {
      if (done) return
      done = true
      setSettled(true)
    }
    /**
     * ขยับเมาส์ = เลิกดูอินโทรแล้ว แต่ต้องไม่ใช่ทางลัดที่ทำให้หัวเรื่องโผล่กลางอินโทร
     * (นี่คือเหตุที่จังหวะเคยหลุดแบบสุ่ม: ใครขยับเมาส์ตอนวินาทีที่หนึ่ง หัวเรื่องก็ขึ้นเลย)
     */
    const skip = () => {
      if (introSince() >= 0) go()
    }
    const tick = () => {
      if (done) return
      if (getTuner().intro < 0.5 || introSince() >= getTuner().hlAfter) {
        go()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // ทางออกสำรอง: ไม่มีใครติดอาวุธนาฬิกาอินโทรเลย (ปิดฉาก/โหลดพลาด) ก็ต้องได้ขึ้น
    const bail = setTimeout(go, FALLBACK_AFTER)
    window.addEventListener('pointermove', skip, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(bail)
      window.removeEventListener('pointermove', skip)
    }
  }, [heroReady, settled])

  const lines = [...store.lines.values()]
  // ปิดจากแผงจูน = ตัวหนังสือ HTML แบน ๆ ยืนแทน (ตัวเดียวกับที่ใช้ตอนรออินโทร)
  const live = t.hl > 0.5 && active && settled && lines.length > 0
  const field = useMemo<Field>(() => ({ ...store, live }), [store, live])
  return (
    <FieldCtx.Provider value={field}>
      <div
        className={className}
        data-headline-field
        style={{
          position: 'relative',
          ['--v3-track' as string]: `${cfg.track}em`,
          ['--v3-hl-size' as string]: String(size),
        }}
      >
        {children}
        {live && (
          <div className="absolute" style={{ inset: `${-pad}px`, pointerEvents: 'none' }}>
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
              {/* เวทีไฟของฟองแก้ว — ชุดคงที่ ไม่ขึ้นกับผังบรรทัดหรือสีของ LIFE */}
              <StageLight gain={t.bbGlow} />
              <PointerWake />
              <Suspense fallback={null}>
                {lines.map((b) =>
                  b.src ? <SvgArt key={b.id} box={b} /> : <Line key={b.id} box={b} cfg={cfg} />,
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
export function useHeadlineArt(el: HTMLElement | null, src: string, glass?: boolean) {
  useBox(el, '', src, glass)
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
