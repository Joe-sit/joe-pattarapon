import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { HeroLights } from '@/newhero/heroLights'
import { roundedPlane, roundedRectShape } from '@/newhero/stencilPortal'
import { BRACKET_FRAG, BUCKET_FRAG, FULL_VERT, RING_FRAG, RING_VERT, SKY_FRAG } from './shaders'
import { PassRider, type PassKind } from './passes'
import { TL, clamp01, skillStep, span } from './timeline'

/**
 * ฉากของจอ "สิ่งที่ทำ" แบบเรนเดอร์ — ตัวละคร 3D ของ /2026-final ผ่านหน้าต่างพอร์ทัล
 *
 * ลำดับ (ดูช่วงใน ./timeline):
 * 1. ฟ้าอ่อนกับตัวละครเป็นเส้นโครงจาง ๆ
 * 2. หน้าต่าง mac โผล่ทีละบาน — แต่ละบานเป็นพอร์ทัล (stencil) มองเข้าไปเห็นตัวละคร
 *    ตัวเดียวกันผ่านคนละขั้นของการเรนเดอร์ (ดู ./passes)
 * 3. ไทล์เรนเดอร์ทีละช่องจนเต็มจอ — ช่องที่เสร็จคือ "โลกจริง": ตัวละครภาพจริงบนฟ้าสีสกิล
 * 4. วงแหวนชื่อสกิลรอบตัว หมุนทีละสกิล สีฉากเปลี่ยนตาม
 *
 * ### ลำดับวาด (renderOrder)
 *
 * −30 ฟ้าเปิดจอ → −20… หน้ากากหน้าต่าง (เขียน stencil 1–6 บานหลังก่อน) → −10 หน้ากากไทล์
 * (เขียน 7 ทับ) → −6 พื้นจอของแต่ละบาน → −4 ฟ้าของโลกจริง → 0 ตัวละครทุกชุด → 10… กรอบ
 * หน้าต่าง → (ของโปร่ง) เส้นโครงจาง, วงเล็บมุม, วงแหวน
 *
 * ทุกอย่างอ่านความคืบหน้าจาก `flow` (อ็อบเจกต์นอก React ที่ลูปเลื่อนเขียน) ในลูปเฟรม
 * ไม่มี state ของ React เปลี่ยนระหว่างเลื่อน (กฎ `perf-never-set-state-in-useframe`)
 */

/** ความคืบหน้าที่ลูปเลื่อนเขียน — ฉากอ่านทุกเฟรม */
export const flow = { p: 0 }

/** ความสูงที่กล้องเห็นตรงระนาบ z = 0 (หน่วยฉาก) — ทุกขนาดข้างล่างเทียบกับค่านี้ */
export const VIEW_H = 9
export const FOV = 30
export const CAM_Z = VIEW_H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180)

/**
 * พื้นของหน้า (`--v3-shell` ของ /2026-final) — สีรองก่อนฉากโหลดเสร็จ
 *
 * ทั้งหน้า /2026-final เป็นกลางวันสว่าง ฟ้าอ่อน เมฆขาว จอเดียวที่มืดจะหลุดออกจากเรื่อง
 */
export const BG = '#e8eaf0'

/** ฟ้าของช่วงเปิดจอ — ฟ้าอ่อนของหน้า */
const INTRO_SKY = { top: '#c7e3fc', bottom: '#edf5ff' }

/**
 * ฟ้าของโลกจริงต่อสกิล — จากสีประจำสกิลใน `SKILLS` ไม่ได้ตั้งสีใหม่
 *
 * บนเข้มกว่าล่าง (สีสกิลผสมขาว 8% → 50%) ฉากจึงเป็น "บล็อกสี" สด ๆ แบบปุ่มกับแผงของหน้า
 *
 * ต้องอิ่มพอให้ชื่อสีขาวบนวงแหวนเด่น: รอบแรกผสมขาว 30–78% ฟ้าซีดจนตัวหนังสือขาวจมหาย
 * (เว็บอ้างอิงได้คอนทราสต์จากฉากมืด ที่นี่ได้จากสีอิ่มแทน)
 */
const SKIES = SKILLS.map((s) => {
  const c = new THREE.Color(s.color)
  return {
    top: c.clone().lerp(new THREE.Color('#ffffff'), 0.08),
    bottom: c.clone().lerp(new THREE.Color('#ffffff'), 0.5),
    rim: c.clone(),
  }
})

/* ── หน้าต่าง ─────────────────────────────────────────────────────────────── */

/**
 * หน้าต่างแต่ละบาน — ที่วาง ขนาด (หน่วยฉาก) ขั้นการเรนเดอร์ และสีพื้นจอของขั้นนั้น
 *
 * ผังปะติดรอบตัวละครแบบเว็บอ้างอิง: บานซ้อนกันเยื้อง ๆ ไม่เรียงเป็นตาราง บานที่โผล่ทีหลังอยู่หน้า
 * ชื่อบานเป็นนามสกุลไฟล์ของขั้นนั้นจริง ๆ (ของที่คนทำงาน 3D เห็นแล้วรู้ทันที)
 *
 * **ทุกบานต้องทับตัวละคร** คนละส่วน (หัว หน้า ไหล่ซ้าย ไหล่ขวา อก) และขั้นต้องเข้ากับส่วนที่มัน
 * ทับ: หัวเป็นกล่องใหญ่ก้อนเดียว เส้นโครงมีแค่ขอบ บานที่ทับมันจึงดูว่าง — เส้นโครงไปอยู่ที่ไหล่
 * กับแขนซึ่งเส้นแน่น ส่วนตาราง UV ขึ้นบนหัวเพราะผิวใหญ่ ๆ แสดงช่องตารางชัดสุด — บานเป็นช่องมองไปที่ตัวละคร
 * บานที่วางเลยตัวออกไปเห็นแต่พื้นจอเปล่า (รอบแรกบาน albedo อยู่ที่ x −4.1 ขณะตัวละครกว้าง
 * แค่ราว ±1.7 เห็นเป็นหน้าต่างขาวว่าง ๆ บนจอ)
 *
 * สีพื้นจอ: normal ใช้ม่วงลาเวนเดอร์ (#8080ff) ซึ่งคือสีของ normal ที่หันตรงเข้ากล้อง —
 * พื้นหลังของแผนที่ normal ทุกอันเป็นสีนี้ ไม่ได้เลือกเพราะสวย
 */
const WINDOWS: {
  x: number
  y: number
  w: number
  h: number
  pass: PassKind
  label: string
  screen: string
}[] = [
  { x: -1.5, y: 1.9, w: 3.2, h: 2.4, pass: 'checker', label: 'uv_checker.png', screen: '#eef4ff' },
  { x: -3.4, y: -1.5, w: 3.4, h: 2.6, pass: 'normal', label: 'normal.exr', screen: '#8080ff' },
  { x: 3.3, y: -1.9, w: 3.2, h: 2.6, pass: 'wire', label: 'wireframe.obj', screen: '#f8f9fb' },
  { x: 1.7, y: 1.5, w: 3.0, h: 2.4, pass: 'clay', label: 'clay.png', screen: '#efe9e1' },
  { x: -0.2, y: -2.75, w: 3.4, h: 2.2, pass: 'albedo', label: 'albedo.png', screen: '#dfe6ef' },
  { x: 0.25, y: 0.35, w: 3.0, h: 2.6, pass: 'beauty', label: 'beauty.png', screen: '#d6ebff' },
]

/** stencil ของโลกจริง (ไทล์ที่เสร็จ) — ดู ./passes */
const WORLD = 7

/**
 * ค่า stencil ของแต่ละชุด — ประกาศเป็นค่าคงที่ระดับโมดูล ไม่ใช่สร้างใน JSX
 *
 * ชุดตัวละครใช้อ็อบเจกต์นี้เป็น dependency ของวัสดุ ถ้าสร้างใหม่ทุกครั้งที่เรนเดอร์ วัสดุ
 * จะถูกสร้างใหม่ตาม (กฎ `perf-avoid-inline-objects`)
 */
const STENCIL: Record<PassKind, { ref: number; mask: number }> = {
  ghost: { ref: 0, mask: 0xff },
  wire: { ref: 1, mask: 0xff },
  checker: { ref: 2, mask: 0xff },
  normal: { ref: 3, mask: 0xff },
  clay: { ref: 4, mask: 0xff },
  albedo: { ref: 5, mask: 0xff },
  /* 6 & 6 = 6 และ 7 & 6 = 6 → ชุดเดียวผ่านทั้งบาน beauty และโลกจริง */
  beauty: { ref: 6, mask: 6 },
}

/**
 * หน้าต่างขาว — ของใน /2026-final เป็นแผ่นขาว/กระจกใสมุมมนทั้งหมด (หน้าต่างของ hero, แผ่นของ
 * จอ experiences) แถบหัวหนา ขอบข้าง/ล่างบาง ตามทรงหน้าต่าง mac
 */
/* z 3.6: ตัวละครขยายใหญ่แล้วหน้า/จมูกยื่นมาถึงราว z 2 บานต้องอยู่หน้ากว่านั้นเสมอ */
const WIN = { top: 0.3, side: 0.06, r: 0.16, depth: 0.1, shell: '#ffffff', z: 3.6 }
const DOTS = ['#ff5f57', '#febc2e', '#28c840']

/** กรอบที่กลางเป็นรูจริง — รูเยื้องลงเพราะแถบหัวหนากว่าขอบอื่น */
function macFrameGeo(w: number, h: number) {
  const s = roundedRectShape(w, h, WIN.r)
  const iw = w - WIN.side * 2
  const ih = h - WIN.top - WIN.side
  const cy = -(WIN.top - WIN.side) / 2
  const inner = roundedRectShape(iw, ih, Math.max(0.02, WIN.r - WIN.side))
  s.holes.push(new THREE.Path(inner.getPoints(18).map((p) => p.clone().setY(p.y + cy))))
  const g = new THREE.ExtrudeGeometry(s, {
    depth: WIN.depth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 10,
  })
  g.translate(0, 0, -WIN.depth / 2)
  return g
}

/** ป้ายชื่อบนแถบหัว — แคนวาสเล็ก ๆ ใบละบาน */
function labelTexture(text: string) {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 64
  const g = cv.getContext('2d')
  if (g) {
    g.font = '500 30px ui-monospace, "SF Mono", Menlo, monospace'
    g.fillStyle = '#8d919b'
    g.textBaseline = 'middle'
    g.fillText(text, 4, 34)
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** ตั้งการทดสอบ stencil "เท่ากับ" ให้วัสดุ */
function equalStencil<M extends THREE.Material>(m: M, ref: number): M {
  m.stencilWrite = true
  m.stencilRef = ref
  m.stencilFunc = THREE.EqualStencilFunc
  m.stencilFail = THREE.KeepStencilOp
  m.stencilZFail = THREE.KeepStencilOp
  m.stencilZPass = THREE.KeepStencilOp
  return m
}

/** วัสดุที่เขียนค่า stencil ทับโดยไม่วาดสีและไม่แตะความลึก */
function stencilWriter<M extends THREE.Material>(m: M, ref: number): M {
  m.colorWrite = false
  m.depthWrite = false
  m.depthTest = false
  m.stencilWrite = true
  m.stencilRef = ref
  m.stencilFunc = THREE.AlwaysStencilFunc
  m.stencilZPass = THREE.ReplaceStencilOp
  return m
}

/**
 * ท่าโผล่ของบาน — ขยายเร็วแล้วเลยนิดเดียวก่อนเข้าที่ (back-out)
 *
 * ในเว็บอ้างอิงบานเด้งขึ้นมาทันที ไม่ได้ค่อย ๆ จางเข้า — ท่าจางอ่านเป็น "ภาพซ้อน" แต่ท่าเด้ง
 * อ่านเป็น "หน้าต่างถูกเปิด" ซึ่งคือสิ่งที่กำลังเล่า
 */
const backOut = (t: number) => {
  const c = 1.9
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}

/**
 * หน้าต่างหนึ่งบาน: หน้ากาก (เขียน stencil ทั้งบาน) + พื้นจอ + กรอบ
 *
 * หน้ากากครอบ *ทั้งบาน* ไม่ใช่แค่รู: บานหน้าที่โผล่ทีหลังเขียนค่าของตัวเองทับบานหลังทั้งบาน
 * กรอบของบานหลังจึงทดสอบแล้วไม่ผ่านตรงที่บานหน้าบัง — ไม่ต้องพึ่งความลึกเลย (ความลึกใช้ไม่ได้
 * เพราะตัวละครอยู่ *หลัง* บานทุกบานในแกน z)
 */
function MacWindow({ i }: { i: number }) {
  const spec = WINDOWS[i]
  /* ค่า stencil มาจาก *ขั้น* ของบาน ไม่ใช่ลำดับบาน — ผูกกับลำดับแล้วสลับบานเมื่อไร บานจะไปเปิด
     ตัวละครของขั้นอื่น (บาน normal โชว์ตาราง UV) */
  const ref = STENCIL[spec.pass].ref
  const g = useRef<THREE.Group | null>(null)

  const parts = useMemo(() => {
    const label = labelTexture(spec.label)
    return {
      frame: macFrameGeo(spec.w, spec.h),
      outer: roundedPlane(spec.w, spec.h, WIN.r),
      body: roundedPlane(spec.w - WIN.side * 2 + 0.02, spec.h - WIN.top - WIN.side + 0.02, WIN.r * 0.6),
      dot: new THREE.CircleGeometry(0.045, 16),
      bar: new THREE.PlaneGeometry(1.8, 0.225),
      label,
      mask: stencilWriter(new THREE.MeshBasicMaterial(), ref),
      screen: equalStencil(
        new THREE.MeshBasicMaterial({
          color: spec.screen,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }),
        ref,
      ),
      /* toneMapped ปิด: ตัวแมปโทน (ACES) บีบขาวให้เป็นเทาอ่อน กรอบขาวจึงไม่ขาว */
      shell: equalStencil(
        new THREE.MeshStandardMaterial({ color: WIN.shell, roughness: 0.45, toneMapped: false }),
        ref,
      ),
      dots: DOTS.map((c) =>
        equalStencil(new THREE.MeshBasicMaterial({ color: c, toneMapped: false }), ref),
      ),
      labelMat: equalStencil(
        new THREE.MeshBasicMaterial({ map: label, alphaTest: 0.4, toneMapped: false }),
        ref,
      ),
    }
  }, [spec, ref])
  /* ของที่สร้างเองด้วย new ต้องคืน GPU เอง — r3f ถอดให้เฉพาะของที่ประกาศเป็น JSX */
  useEffect(
    () => () => {
      parts.frame.dispose()
      parts.outer.dispose()
      parts.body.dispose()
      parts.dot.dispose()
      parts.bar.dispose()
      parts.label.dispose()
      parts.mask.dispose()
      parts.screen.dispose()
      parts.shell.dispose()
      parts.dots.forEach((m) => m.dispose())
      parts.labelMat.dispose()
    },
    [parts],
  )

  useFrame(() => {
    const el = g.current
    if (!el) return
    const [a, b] = TL.win
    const at = a + ((b - a) * i) / WINDOWS.length
    const k = clamp01((flow.p - at) / 0.035)
    /* หลังไทล์เต็มจอแล้วไม่ต้องวาดบานอีก — stencil ของโลกจริงทับหมดแล้ว */
    el.visible = k > 0 && span(flow.p, TL.bucket) < 1
    if (!el.visible) return
    el.scale.setScalar(0.82 + 0.18 * backOut(k))
    el.position.set(spec.x, spec.y - (1 - k) * 0.3, WIN.z + i * 0.02)
  })

  const barY = spec.h / 2 - WIN.top / 2
  const dotX0 = -spec.w / 2 + 0.2
  const bodyY = -(WIN.top - WIN.side) / 2
  const face = WIN.depth / 2 + 0.025
  return (
    <group ref={g} visible={false}>
      <mesh geometry={parts.outer} material={parts.mask} renderOrder={-20 + i} />
      <mesh geometry={parts.body} material={parts.screen} position-y={bodyY} renderOrder={-6} />
      <mesh geometry={parts.frame} material={parts.shell} renderOrder={10 + i} />
      {parts.dots.map((m, d) => (
        <mesh
          key={DOTS[d]}
          geometry={parts.dot}
          material={m}
          position={[dotX0 + d * 0.15, barY, face]}
          renderOrder={10 + i}
        />
      ))}
      <mesh
        geometry={parts.bar}
        material={parts.labelMat}
        position={[dotX0 + 1.45, barY, face]}
        renderOrder={10 + i}
      />
    </group>
  )
}

/* ── วงแหวนสกิล ───────────────────────────────────────────────────────────── */

/**
 * รัศมี/ความสูง/ที่วางของวงแหวน (หน่วยฉาก)
 *
 * ครึ่งหน้าของวงอยู่ใกล้กล้อง ถูกขยาย `CAM_Z / (CAM_Z − r)` (r 6.2 → 1.59 เท่า) และตกลงอีก
 * r·sin(tilt) ตามการเอียง — ค่าชุดนี้วางชื่อหน้าสุดไว้ราวหนึ่งในแปดจากขอบล่าง ส่วนครึ่งหลัง
 * ลอดหลังคอ (ถูกตัวละครบังด้วยความลึกจริง) · รัศมีต้องกว้างกว่าไหล่ ตัวละครครอปครึ่งตัวบน
 * ไหล่กว้างราวครึ่งจอ วงที่แคบกว่านั้นจะเจาะทะลุไหล่
 */
/**
 * วงเฉียง — ท่าวงแหวนดาวเสาร์ตามวิดีโอ (หน้าปัดนาฬิกาที่เอียงทแยง ขอบบนขวา ขอบล่างซ้าย)
 *
 * `tilt` (รอบแกน x) เปิดวงให้เห็นเป็นวงรีกว้าง = มองจากเหนือวงลงไป · `roll` (รอบแกนจอ)
 * ยกขวาขึ้นกดซ้ายลง วงจึงพาดทแยงลงไปทางล่างซ้าย · `y` คิดย้อนจากที่ต้องการบนจอ: ครึ่งหน้า
 * ตกลงอีก r·sin(tilt) ≈ 2.1 และถูกขยาย 1.59 เท่า ศูนย์วงจึงต้องยกขึ้นเหนืออก ให้ชื่อหน้าสุด
 * ลงมาพาดอก ส่วนครึ่งหลังขึ้นไปลอดหลังหัวแถวผม
 */
const RING = { r: 6.2, h: 1.5, tilt: 0.34, roll: 0.3, y: 0.85 }
/**
 * ชื่อสกิลรอบวงรอบเดียว — ไม่ใช่สองรอบ
 *
 * วัดแล้ว: ตัวหนังสือหนักขนาดนี้ "RESEARCH" กว้างราว 2200px บนเท็กซ์เจอร์ แต่วนสองรอบ
 * ได้ช่องละแค่ 1365px ชื่อจึงชนกันเป็นคำเดียว (เห็นเป็น "DESIGNESEARCH" บนจอ) รอบเดียว
 * ได้ช่องละ 2730px มีช่องไฟระหว่างชื่อ
 */
const REPEAT = 1
const SLOTS = SKILLS.length * REPEAT

/**
 * ฟอนต์ของวงแหวน — Mona Sans หนักสุด (900) แบบตัวกว้างสุด (width 125%) ตามเว็บอ้างอิง
 *
 * ชื่อบนวงของแบบอ้างอิงเป็น grotesk ดำหนาที่ *ตัวกว้าง* (extended) ไม่ใช่ตัวหนาธรรมดา —
 * DM Sans 1000 หนาพอแต่ตัวแคบ อ่านเป็นคนละฟอนต์ทันทีเมื่อวางเทียบ Mona Sans มีแกนความกว้าง
 * 75–125 จึงได้ทรงเดียวกันจากฟอนต์ที่หน้าโหลดอยู่แล้ว (เพิ่มแกน wdth ใน index.html)
 */
const RING_FONT = '"Mona Sans", "DM Sans", system-ui, sans-serif'
const RING_FACE = `900 expanded`

/**
 * ชื่อบนวงแหวน สองบรรทัดต่อสกิล — ตามเว็บอ้างอิงที่ทุกชื่อซ้อนสองบรรทัดชิดกัน
 *
 * สกิลใน `SKILLS` เป็นคำเดียว ("Research" / "Coding" / "Design") จึงต้องมีคำที่สอง: คำเหล่านี้
 * **ผมตั้งเอง** จากสิ่งที่หน้าบอกอยู่แล้ว (บทบาท UX/UI designer, คำบรรยายของ Design ที่พูดถึง
 * product flows) — เป็นข้อความที่เจ้าของงานควรตรวจ เปลี่ยนได้ที่นี่ที่เดียว ลำดับตาม `SKILLS`
 */
const RING_LABELS: [string, string][] = [
  ['UX', 'RESEARCH'],
  ['FRONTEND', 'CODING'],
  ['PRODUCT', 'DESIGN'],
]

function ringTexture(stroke: boolean) {
  const W = 8192
  const H = Math.round((W * RING.h) / (2 * Math.PI * RING.r))
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')
  if (g) {
    /**
     * ขนาดตัวอักษร: เอาค่าที่เล็กกว่าระหว่าง "สองบรรทัดพอดีความสูงแถบ" กับ "บรรทัดยาวสุดกว้าง
     * ไม่เกิน 86% ของช่อง" — วัดจริงด้วย measureText ไม่ใช่ประมาณจากจำนวนตัวอักษร เพราะตัว
     * กว้างแต่ละตัวกว้างไม่เท่ากัน (M กับ I ต่างกันเกือบสามเท่า)
     */
    const slotW = W / SLOTS
    let size = Math.round(H / 1.62)
    g.font = `${RING_FACE} ${size}px ${RING_FONT}`
    const widest = Math.max(...RING_LABELS.flat().map((t) => g.measureText(t).width))
    size = Math.floor(size * Math.min(1, (slotW * 0.86) / widest))
    g.font = `${RING_FACE} ${size}px ${RING_FONT}`
    ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${-size * 0.03}px`
    g.textAlign = 'center'
    g.textBaseline = 'alphabetic'
    g.lineJoin = 'round'
    /* ระยะบรรทัดชิดกว่าความสูงตัวพิมพ์ใหญ่นิดหนึ่ง — สองบรรทัดเกือบชนกันแบบแบบอ้างอิง */
    const cap = size * 0.72
    const lead = cap * 1.08
    const base1 = H / 2 - lead / 2 + cap / 2
    const base2 = base1 + lead
    for (let k = 0; k < SLOTS; k += 1) {
      const [a, b] = RING_LABELS[k % RING_LABELS.length]
      const x = (k + 0.5) * slotW
      if (stroke) {
        g.strokeStyle = '#fff'
        g.lineWidth = Math.max(3, size * 0.024)
        g.strokeText(a, x, base1)
        g.strokeText(b, x, base2)
      } else {
        /* ขาวบนลงเทาอ่อนล่าง — ตัวหน้าสุดในแบบอ้างอิงมีเงานุ่มที่ครึ่งล่าง ไม่ใช่ขาวแบน */
        const shade = g.createLinearGradient(0, base1 - cap, 0, base2)
        shade.addColorStop(0, '#ffffff')
        shade.addColorStop(1, '#dfe4ea')
        g.fillStyle = shade
        g.fillText(a, x, base1)
        g.fillText(b, x, base2)
      }
    }
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function Ring() {
  const g = useRef<THREE.Group | null>(null)
  const geo = useMemo(() => new THREE.CylinderGeometry(RING.r, RING.r, RING.h, 180, 1, true), [])
  const tex = useMemo(() => ({ fill: ringTexture(false), line: ringTexture(true) }), [])
  /* ฟอนต์ต้องโหลดเสร็จก่อนวาดลงแคนวาส ไม่งั้นได้ฟอนต์สำรองติดเท็กซ์เจอร์ไปตลอด */
  useEffect(() => {
    let live = true
    document.fonts.load(`${RING_FACE} 100px ${RING_FONT}`).then(() => {
      if (!live) return
      const f = ringTexture(false)
      const l = ringTexture(true)
      tex.fill.image = f.image
      tex.line.image = l.image
      tex.fill.needsUpdate = true
      tex.line.needsUpdate = true
      f.dispose()
      l.dispose()
    })
    return () => {
      live = false
    }
  }, [tex])

  const mats = useMemo(() => {
    const mk = (back: boolean) =>
      new THREE.ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        uniforms: {
          uFill: { value: tex.fill },
          uLine: { value: tex.line },
          uShow: { value: 0 },
          uBack: { value: back ? 1 : 0 },
        },
        side: back ? THREE.BackSide : THREE.FrontSide,
        transparent: true,
        /* ทดสอบความลึกกับตัวละคร: ครึ่งหลังของวงถูกตัวละครบังจริง ไม่ต้องใช้ภาพตัดพื้น */
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      })
    return { front: mk(false), back: mk(true) }
  }, [tex])
  useEffect(
    () => () => {
      geo.dispose()
      tex.fill.dispose()
      tex.line.dispose()
      mats.front.dispose()
      mats.back.dispose()
    },
    [geo, tex, mats],
  )

  const spin = useRef(0)
  useFrame(({ clock }, delta) => {
    const el = g.current
    if (!el) return
    const show = span(flow.p, TL.ring)
    mats.front.uniforms.uShow.value = show
    mats.back.uniforms.uShow.value = show
    el.visible = show > 0
    if (!el.visible) return
    /**
     * มุมที่พาชื่อของสกิลปัจจุบันมาอยู่หน้าสุด
     *
     * ช่องที่ k อยู่ที่มุม (k + ½)·(2π/SLOTS) บนทรงกระบอก (u = 0 หันเข้ากล้อง) หมุนกลับด้วย
     * มุมนั้นก็ได้ชื่อนั้นตรงกลาง — บวกการหมุนช้า ๆ อีกนิดให้วงไม่ตายนิ่งตอนค้าง ตอนคลี่เข้ามา
     * วงหมุนมาจากอีกด้าน = เข้าฉากด้วยการ "หมุนเข้าที่" ไม่ใช่จางเฉย ๆ
     */
    const s = skillStep(flow.p, SKILLS.length)
    const aim = -((s + 0.5) / SLOTS) * Math.PI * 2
    const drift = Math.sin(clock.elapsedTime * 0.35) * 0.03
    const target = aim + drift + (1 - show) * 1.4
    spin.current += (target - spin.current) * (1 - Math.exp(-delta * 7))
    /**
     * ลำดับ ZXY: หมุนรอบแกนของวงเอง (y) ก่อน แล้วค่อยเอียง (x) แล้วค่อยเฉียง (z) — ลำดับ
     * ค่าเริ่มต้น XYZ ใช้ z ก่อน แกนเฉียงเลยหมุนตามวงไปด้วย วงส่ายแทนที่จะหมุนอยู่ในระนาบเดิม
     */
    el.rotation.order = 'ZXY'
    el.rotation.set(RING.tilt, spin.current, RING.roll)
    el.scale.setScalar(0.9 + 0.1 * show)
  })

  return (
    <group ref={g} position={[0, RING.y, 0]} visible={false}>
      <mesh geometry={geo} material={mats.back} renderOrder={30} />
      <mesh geometry={geo} material={mats.front} renderOrder={31} />
    </group>
  )
}

/* ── ตัวละคร ──────────────────────────────────────────────────────────────── */

/**
 * ขนาดและที่วางของตัวละคร — ครอปครึ่งตัวบน เห็นแค่หัวถึงไหล่
 *
 * `fill` = ความสูงทั้งตัวเป็นกี่เท่าของความสูงจอ (ใหญ่กว่าจอมาก ตัวส่วนใหญ่จมพ้นขอบล่าง)
 * `top` = ยอดหัวอยู่ที่ y เท่าไร (หน่วยฉาก ขอบบนจอคือ 4.5) — ยึดจากยอดหัวไม่ใช่จากจุดกลางตัว
 * เพราะสิ่งที่ต้องคงที่คือ "หัวอยู่ใต้ขอบบนนิดเดียว" ไม่ว่าจะขยายตัวละครเท่าไร
 */
/* top 3.4 ไม่ใช่ 4.05: หัวยื่นเข้าหากล้อง (z บวก) เพอร์สเปกทีฟจึงขยายให้ยอดผมขึ้นไปสูงกว่า
   ค่าที่ตั้ง — ตั้ง 4.05 แล้วผมชนขอบบนจอ (เห็นบนจอ) */
const FIG = { fill: 2.4, top: 3.4 }

/**
 * dev เท่านั้น: `?fig=full` ดูตัวละครเต็มตัว — ไว้ส่องแขนกับมือซึ่งกรอบครึ่งตัวบนตัดทิ้ง
 * build จริงไม่มีทางเข้า (กั้นด้วย import.meta.env.DEV)
 */
const FIG_FULL = { fill: 0.84, top: 3.9 }
const figFrame = () =>
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('fig') === 'full'
    ? FIG_FULL
    : FIG
/** ชุดของตัวละครที่ต้องมี — เส้นโครงจางตอนเปิดจอ + หกขั้นของหกบาน (beauty = บาน 6 + โลกจริง) */
const KINDS: PassKind[] = ['ghost', 'wire', 'checker', 'normal', 'clay', 'albedo', 'beauty']

/**
 * ตัวละครทุกชุดอยู่ในกลุ่มเดียว จัดขนาดด้วยการ *วัดตัวมันเอง* (แบบ HeroFigure ของจอ what-i-do)
 * — ทุกชุดซ้อนกันพอดีเพราะอยู่ใต้กลุ่มเดียวกันและเป็นท่านิ่งท่าเดียวกัน
 */
function Figures() {
  const fit = useRef<THREE.Group | null>(null)
  const probe = useRef<THREE.Group | null>(null)
  const kinds = useRef<Record<string, THREE.Group | null>>({})
  const box = useMemo(() => new THREE.Box3(), [])
  const mid = useMemo(() => new THREE.Vector3(), [])
  /** ริกจัดท่าตัวเองสองสามเฟรมแรก — วัดซ้ำช่วงหนึ่งแล้วหยุด */
  const settle = useRef(30)

  useFrame(() => {
    const f = fit.current
    const b = probe.current
    if (f && b && settle.current > 0) {
      settle.current -= 1
      f.scale.setScalar(1)
      f.position.set(0, 0, 0)
      f.updateWorldMatrix(true, true)
      box.setFromObject(b)
      const h = box.max.y - box.min.y
      if (h > 0) {
        const fr = figFrame()
        const s = (VIEW_H * fr.fill) / h
        box.getCenter(mid)
        f.scale.setScalar(s)
        f.position.set(-mid.x * s, fr.top - box.max.y * s, -mid.z * s)
      }
    }
    /* ซ่อนชุดที่ไม่มีทางเห็นในช่วงนี้ — ตัวละครเจ็ดชุดคือของหนัก ไม่วาดเปล่า ๆ */
    const bucket = span(flow.p, TL.bucket)
    const before = flow.p < TL.win[0]
    const refs = kinds.current
    for (const k of KINDS) {
      const el = refs[k]
      if (!el) continue
      if (k === 'beauty') el.visible = true
      else if (k === 'ghost') el.visible = bucket < 1
      else el.visible = !before && bucket < 1
    }
  })

  return (
    <group ref={fit}>
      {KINDS.map((k) => (
        <group
          key={k}
          ref={(el) => {
            kinds.current[k] = el
          }}
        >
          <PassRider
            kind={k}
            stencil={STENCIL[k]}
            innerRef={k === 'beauty' ? probe : undefined}
          />
        </group>
      ))}
    </group>
  )
}

/* ── ฉาก ──────────────────────────────────────────────────────────────────── */

/** ขนาดไทล์ของท่าเรนเดอร์ = หนึ่งในสิบสี่ของความสูงจอ */
const TILES_PER_H = 14

export function RenderScene() {
  const { gl, size } = useThree()
  const res = useMemo(() => new THREE.Vector2(1, 1), [])
  useEffect(() => {
    gl.getDrawingBufferSize(res)
  }, [gl, size, res])

  const mats = useMemo(() => {
    const sky = (top: string, bottom: string, dots: number) =>
      new THREE.ShaderMaterial({
        vertexShader: FULL_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: {
          uRes: { value: res },
          uTime: { value: 0 },
          uTop: { value: new THREE.Color(top) },
          uBottom: { value: new THREE.Color(bottom) },
          uDots: { value: dots },
        },
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      })
    const tile = { uRes: { value: res }, uBucket: { value: 0 }, uTile: { value: 60 } }
    return {
      intro: sky(INTRO_SKY.top, INTRO_SKY.bottom, 0.9),
      /* ฟ้าของโลกจริง — วาดเฉพาะช่องที่ไทล์เขียน stencil ของโลกจริงแล้ว */
      world: equalStencil(sky('#ffffff', '#ffffff', 0.55), WORLD),
      bucket: stencilWriter(
        new THREE.ShaderMaterial({ vertexShader: FULL_VERT, fragmentShader: BUCKET_FRAG, uniforms: tile }),
        WORLD,
      ),
      bracket: new THREE.ShaderMaterial({
        vertexShader: FULL_VERT,
        fragmentShader: BRACKET_FRAG,
        uniforms: tile,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    }
  }, [res])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
    },
    [mats],
  )

  /* แผ่นเต็มจอ — ใหญ่เกินจอไว้ก่อน ทุกชั้นอ่านพิกัดจาก gl_FragCoord ไม่ใช่จาก UV ของแผ่น */
  const quad = useMemo(() => new THREE.PlaneGeometry(80, 40), [])
  useEffect(() => () => quad.dispose(), [quad])

  const rim = useRef<THREE.DirectionalLight | null>(null)
  useFrame(({ clock }) => {
    const p = flow.p
    const t = clock.elapsedTime
    mats.intro.uniforms.uTime.value = t
    mats.world.uniforms.uTime.value = t
    mats.bucket.uniforms.uBucket.value = span(p, TL.bucket)
    mats.bucket.uniforms.uTile.value = res.y / TILES_PER_H

    /* สีฉากของโลกจริง: ไล่ระหว่างสองสกิลที่อยู่ติดกันตามการหมุนของวงแหวน */
    const s = skillStep(p, SKILLS.length)
    const i = Math.min(SKILLS.length - 2, Math.floor(s))
    const f = s - i
    ;(mats.world.uniforms.uTop.value as THREE.Color).copy(SKIES[i].top).lerp(SKIES[i + 1].top, f)
    ;(mats.world.uniforms.uBottom.value as THREE.Color).copy(SKIES[i].bottom).lerp(SKIES[i + 1].bottom, f)
    /* ไฟขอบหลังตัวละครสีเดียวกับฉาก — ฉากเปลี่ยนสีแล้วตัวละครต้องรับแสงของฉากนั้นด้วย */
    if (rim.current) {
      rim.current.color.copy(SKIES[i].rim).lerp(SKIES[i + 1].rim, f)
      rim.current.intensity = 2.2 * span(p, TL.ring)
    }
  })

  return (
    <>
      <color attach="background" args={[BG]} />
      {/* ไฟชุดเดียวกับฉาก hero — ตัวเดียวกันต้องรับแสงเหมือนกัน (ดู newhero/heroLights) */}
      <HeroLights shadows={false} />
      <directionalLight ref={rim} position={[0, 3, -6]} intensity={0} />

      <mesh geometry={quad} material={mats.intro} renderOrder={-30} position-z={-8} />
      {WINDOWS.map((w, i) => (
        <MacWindow key={w.label} i={i} />
      ))}
      <mesh geometry={quad} material={mats.bucket} renderOrder={-10} />
      <mesh geometry={quad} material={mats.world} renderOrder={-4} position-z={-8} />
      <Figures />
      <mesh geometry={quad} material={mats.bracket} renderOrder={20} position-z={3} />
      <Ring />
    </>
  )
}
