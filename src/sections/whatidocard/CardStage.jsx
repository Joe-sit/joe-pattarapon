import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { HeroRider } from '@/newhero/HeroRider'
import { HeroLights } from '@/newhero/heroLights'
import { Palette } from '@/newhero/palette'
import { Switch } from '@/newhero/Switch'
import { InsidePortal, PortalMask, roundedFrameGeo, roundedPlane, roundedRectShape } from '@/newhero/stencilPortal'
import { useDisposable } from '@/joespresso/scene/utils'
import { Magnifier } from './Magnifier'

/**
 * จอ "สิ่งที่ทำ" — หน้าต่างโปรแกรมเป็นของสามมิติ เนื้อหน้าต่างเป็นพอร์ทัลทะลุไปอีกฉาก
 *
 * เป็นหน้าต่างแบบ mac ตามแบบที่สั่ง: แถบหัวมีจุดสามจุด ขอบรอบบาง มุมมนไม่มาก — ไม่ใช่
 * การ์ดโพสต์ IG แบบเดิม (กรอบหนา ก้นหนาเป็นที่ว่างใต้รูป) รูปทรงนี้ยังต่อกับท่า genie
 * ที่จอก่อนหน้าใช้ส่งมา (ดู sections/hero/ScrollTell) เพราะ genie ของ mac คือท่าที่
 * "หน้าต่าง" ถูกดึงออกมาจากจุดเดียว
 *
 * หน้าต่างคือของหนาจริง (ไม่ใช่ div) วางเอียงเล็กน้อย
 *
 * เนื้อหน้าต่างไม่ได้เป็นรูปนิ่ง: มันเป็นช่องมองทะลุที่ทำด้วย stencil (ดู newhero/stencilPortal)
 * ข้างในเป็นอีกฉากที่อยู่หลังการ์ด และตัวละครยืน "คร่อม" ขอบช่อง — ครึ่งตัวอยู่หน้าการ์ด
 * ครึ่งตัวทับช่อง จึงอ่านว่าโผล่ออกมาจากพอร์ทัล ไม่ใช่รูปที่แปะอยู่ในกรอบ
 *
 * ตัวละคร = `HeroRider` เปล่า ๆ ไม่ปิดอะไรเลย: ท่าสเก็ต บอร์ด แขน lumberjack ลายเสื้อ
 * ไฟขอบ ทุกอย่างมาจากแผงจูนชุดเดียวกับ /2026-final — เป็น "ตัวเดียวกันเป๊ะ ๆ" รวมถึง
 * ชุดไฟ (HeroLights) เพราะผิวแบบดินน้ำมันมาจากแผงไฟนุ่ม ไม่ได้มาจากตัวโมเดล
 */

/* ── ผังหน้าต่าง (หน่วยโลกของฉากนี้) ───────────────────────────────────────── */
/** ขนาดนอก — แนวนอนเหมือนหน้าต่างโปรแกรมจริง ไม่ใช่แนวตั้งแบบโพสต์ */
const CARD_W = 8.6
const CARD_H = 6.4
/** แถบหัวหน้าต่าง (ที่อยู่ของจุดสามจุด) */
const BAR_T = 0.95
/** ขอบรอบเนื้อหน้าต่าง — บางเท่ากันสามด้าน */
const BAR = 0.14
const CARD_D = 0.4
const CARD_R = 0.34

/** เนื้อหน้าต่าง = ส่วนที่เหลือใต้แถบหัว */
const BODY_H = CARD_H - BAR_T
/** กลางเนื้อหน้าต่างเยื้องลงครึ่งแถบหัว */
const HOLE_Y = -BAR_T / 2
/** ช่องทะลุ = รูของกรอบเนื้อ เผื่อซ้อนขอบไม่ให้เห็นรอยต่อ */
const HOLE_W = CARD_W - BAR * 2 + 0.04
const HOLE_H = BODY_H - BAR * 2 + 0.04

/** จุดสามจุดบนแถบหัว — สีชุดเดียวกับปุ่มหน้าต่างของ mac */
const DOTS = ['#ff5f57', '#febc2e', '#28c840']
const DOT_R = 0.15
const DOT_GAP = 0.46

/** เอียงหน้าต่างเล็กน้อย ให้อ่านเป็นแผ่นวางในอวกาศ ไม่ใช่กรอบที่วาดทับจอ */
const CARD_ROT = [0.05, -0.13, 0.04]

/** ของสกิล: ตำแหน่ง + ขนาด + การหมุน — เกาะขอบหน้าต่างทั้งสามมุม */
const PROPS = {
  /* Research — แว่นขยาย มุมซ้ายบน */
  glass: { pos: [-4.9, 2.7, 2.2], scale: 1.15, rot: [0.1, 0.35, 0.3] },
  /* Design — ถาดสีใบเดียวกับที่ลอยอยู่ใน hero */
  palette: { pos: [-4.6, -2.6, 2.4], scale: 1.35, rot: [0.22, -0.38, -0.55] },
  /* Coding — สวิตช์โหมดนักพัฒนาตัวเดียวกับใน hero */
  toggle: { pos: [4.9, -1.5, 2.2], scale: 0.62, rot: [0.12, -0.5, 0.2] },
}

/** ห่วงที่พาดรอบตัวละคร — สีส้มโลโก้ */
const HOOP = { r: 2.6, tube: 0.15, rot: [1.3, 0.12, 0.2], pos: [0, 0.5, 0.4] }

export function CardStage() {
  return (
    <Canvas
      camera={{ position: [0, 0, 18], fov: 32 }}
      dpr={[1, 2]}
      /* stencil: ช่องรูปเป็นพอร์ทัลที่ทำด้วย stencil buffer ซึ่ง r3f ไม่ได้ขอมาให้เอง
         alpha: การ์ดลอยบนพื้นไล่สีของ section ซึ่งเป็น CSS ไม่ใช่ของในฉาก */
      gl={{ antialias: true, alpha: true, stencil: true }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}

function Scene() {
  return (
    <>
      <HeroLights />
      <group rotation={CARD_ROT}>
        <Card />
        <Order n={10}>
          {/* ห่วง — วางหน้าการ์ดแต่หลังตัวละคร ครึ่งหน้าจึงถูกตัวบังเอง */}
          <mesh position={HOOP.pos} rotation={HOOP.rot}>
            <torusGeometry args={[HOOP.r, HOOP.tube, 14, 60]} />
            <meshStandardMaterial color="#fd5000" roughness={0.4} />
          </mesh>

          {/*
            ตัวละคร — อยู่หน้าการ์ด ทับขอบล่างของช่องรูป = โผล่ออกมาจากพอร์ทัล

            สเกลกับตำแหน่งคิดจากกล่องขอบเขตจริงของริก: ในสเปซของตัวเอง ฝ่าเท้าอยู่ที่
            y -4.86 ยอดหัว +0.72 (วัดจากไฟล์ที่หน้า /rig-export อบออกมา) และ Rider
            ยกตัวขึ้นอีก mascotLift ก่อนถึงกลุ่มนี้
          */}
          <group position={[0, -1.5, 1.5]} scale={0.78}>
            <HeroRider />
          </group>

          {/* ของสกิล */}
          <group position={PROPS.glass.pos} rotation={PROPS.glass.rot} scale={PROPS.glass.scale}>
            <Magnifier />
          </group>
          <group position={PROPS.palette.pos} rotation={PROPS.palette.rot} scale={PROPS.palette.scale}>
            <Palette />
          </group>
          <group position={PROPS.toggle.pos} rotation={PROPS.toggle.rot} scale={PROPS.toggle.scale}>
            {/* glass = 0: สวิตช์ของ hero เป็นแก้วหักเห ซึ่งบังคับให้วาดฉากซ้ำอีกรอบ
                ของชิ้นเท่านี้บนพื้นเรียบ มองไม่เห็นการหักเหอยู่แล้ว */}
            <Switch glass={0} pos={1} />
          </group>
        </Order>
      </group>
    </>
  )
}


/**
 * สั่งลำดับวาดให้ทุกชิ้นในกิ่ง
 *
 * จำเป็นเพราะฉากในพอร์ทัลวาดโดยปิดการทดสอบความลึก (ดู InsidePortal overlay) ถ้าไม่กำหนด
 * ลำดับ ของในช่องจะทาทับของที่อยู่หน้าการ์ดด้วย — ตัวละครหายเข้าไปในช่องทั้งตัว
 *
 * ลำดับที่ใช้: แผ่นการ์ด (-1) -> ฉากในช่อง (2..) -> ของหน้าการ์ด (10)
 * ของหน้าการ์ดยังทดสอบความลึกตามปกติ จึงบังกันเองถูกต้องอยู่
 */
function Order({ n, children }) {
  const g = useRef()
  const left = useRef(120)
  useFrame(() => {
    const root = g.current
    if (!root || left.current <= 0) return
    left.current -= 1
    root.traverse((o) => {
      if (o.material || o.isMesh) o.renderOrder = n
    })
  })
  return <group ref={g}>{children}</group>
}

/** ตัวหน้าต่าง: แถบหัว + กรอบเนื้อที่กลางเป็นรูจริง + ฉากข้างในที่มองทะลุรูไปเห็น */
function Card() {
  /**
   * แถบหัวกับกรอบเนื้อเป็นสองชิ้น ไม่ใช่กรอบเดียวที่ขอบบนหนา
   *
   * roundedFrameGeo ผูกความหนาขอบข้างไว้กับความหนาขอบบน (รูของมันคือ w - bar*2) ทำ
   * หน้าต่างที่ "หัวหนา ข้างบาง" ด้วยชิ้นเดียวไม่ได้ จึงวางแถบหัวเป็นแผ่นของตัวเองแล้วให้
   * กรอบเนื้อซ้อนใต้มันเล็กน้อย รอยต่ออยู่ใต้แถบซึ่งไม่มีใครเห็น
   */
  const frame = useMemo(
    () => roundedFrameGeo(CARD_W, BODY_H + CARD_R, BAR, CARD_D, CARD_R, 0.06, BAR),
    [],
  )
  useDisposable(frame)
  const bar = useMemo(() => {
    /* มุมมนรัศมีเดียวกับตัวหน้าต่าง — ขอบบนของหน้าต่างคือขอบบนของแถบนี้ */
    const g = new THREE.ExtrudeGeometry(roundedRectShape(CARD_W, BAR_T + CARD_R, CARD_R), {
      depth: CARD_D,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 3,
      curveSegments: 12,
    })
    g.translate(0, 0, -CARD_D / 2)
    return g
  }, [])
  useDisposable(bar)
  const hole = useMemo(() => roundedPlane(HOLE_W, HOLE_H, CARD_R * 0.5), [])
  useDisposable(hole)
  /** แผ่นรองฉากข้างใน — ใหญ่กว่าช่องมาก เผื่อตอนกล้องเอียงจะไม่เห็นขอบแผ่น */
  const back = useMemo(() => roundedPlane(HOLE_W * 2.2, HOLE_H * 2.2, 1), [])
  useDisposable(back)
  const inner = useMemo(() => innerSkyTexture(), [])
  useDisposable(inner)

  return (
    <group>
      {/**
       * แถบหัว — สูงกว่าที่เห็นอยู่ CARD_R เพราะครึ่งล่างของมันมุดไปอยู่ใต้กรอบเนื้อ
       * ขอบบนของมันคือขอบบนของหน้าต่างพอดี (ไม่ใช่ล้นขึ้นไป) มุมล่างที่มนอยู่ถูกกรอบเนื้อ
       * ซึ่งทึบตรงนั้นบังไว้หมด
       */}
      <mesh geometry={bar} position={[0, CARD_H / 2 - (BAR_T + CARD_R) / 2, 0]}>
        <meshStandardMaterial color="#eceef2" roughness={0.5} emissive="#ffffff" emissiveIntensity={0.16} />
      </mesh>

      {/* กรอบเนื้อหน้าต่าง — ขอบบางเท่ากันสามด้าน ส่วนที่เกินขึ้นไปซ่อนอยู่ใต้แถบหัว */}
      <mesh geometry={frame} position={[0, HOLE_Y - CARD_R / 2, 0]}>
        {/* emissive จาง ๆ: แผ่นตั้งฉากกล้องจึงรับ key light เฉียง ๆ น้อย ใส่ขาวล้วนแล้ว
            ออกมาเทา — ยกพื้นที่วัสดุ ไม่ใช่เพิ่มไฟทั้งฉาก (ซึ่งจะไปโดนตัวละครด้วย) */}
        <meshStandardMaterial color="#ffffff" roughness={0.42} emissive="#ffffff" emissiveIntensity={0.22} />
      </mesh>

      {/* จุดสามจุด — ลอยหน้าแถบหัวเล็กน้อย ไม่ใช่สีที่ทาอยู่บนระนาบเดียวกัน */}
      {DOTS.map((c, i) => (
        <mesh
          key={c}
          position={[
            -CARD_W / 2 + 0.62 + i * DOT_GAP,
            /* กลางแถบที่ *มองเห็น* (CARD_H/2 ลงมาครึ่งแถบ) ไม่ใช่กลางแผ่นแถบซึ่งจมลงไปใต้กรอบ */
            CARD_H / 2 - BAR_T / 2,
            /* พ้นทั้งความหนาและ bevel ของแถบ — bevel ยื่นออกไปอีก bevelThickness จากหน้าแผ่น
               ตั้งไว้แค่ +0.02 จุดจะจมอยู่ในแถบ มองไม่เห็นเลย (วัดมาแล้ว) */
            CARD_D / 2 + 0.12,
          ]}
        >
          <circleGeometry args={[DOT_R, 24]} />
          <meshStandardMaterial color={c} roughness={0.45} emissive={c} emissiveIntensity={0.25} />
        </mesh>
      ))}

      {/* เนื้อหน้าต่าง = พอร์ทัล — วางจมหลังกรอบเล็กน้อย ขอบกรอบจึงมีความหนาให้เห็น */}
      <mesh geometry={hole} position={[0, HOLE_Y, -CARD_D / 2]} renderOrder={-2}>
        <PortalMask />
      </mesh>

      {/* ฉากข้างใน — โผล่เฉพาะในกรอบช่อง และถูกตัวละครที่ยืนหน้ากรอบบังตามความลึกจริง */}
      <InsidePortal>
        <mesh geometry={back} position={[0, HOLE_Y, -4]}>
          <meshBasicMaterial map={inner} toneMapped={false} />
        </mesh>
        {/* ของลอยในพอร์ทัล — ให้ช่องมีความลึกจริง ไม่ใช่พื้นไล่สีแบน */}
        {INNER_BLOBS.map((b, i) => (
          <mesh key={i} position={b.p}>
            <sphereGeometry args={[b.r, 20, 14]} />
            <meshStandardMaterial color={b.c} roughness={0.5} />
          </mesh>
        ))}
      </InsidePortal>
    </group>
  )
}

/** ก้อนลอยในพอร์ทัล — วางกระจายความลึก ไม่ใช่ระนาบเดียว */
const INNER_BLOBS = [
  { p: [-1.7, 2.4, -1.2], r: 0.42, c: '#ffd9a8' },
  { p: [1.9, 1.1, -2.2], r: 0.62, c: '#ffb489' },
  { p: [0.6, -2.2, -1.6], r: 0.34, c: '#fff2e2' },
  { p: [-1.2, -1.1, -2.6], r: 0.5, c: '#ff8c5a' },
]

/** พื้นไล่สีของฉากในพอร์ทัล — อุ่นขึ้นที่ก้นช่อง เหมือนมองลงไปในอีกโลกที่มีแดด */
function innerSkyTexture() {
  const cv = document.createElement('canvas')
  cv.width = 8
  cv.height = 256
  const ctx = cv.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, '#ffe7cf')
  g.addColorStop(0.45, '#ffb98c')
  g.addColorStop(1, '#fd5000')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 8, 256)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default CardStage
