import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { FOLIAGE_MATS, FoliageProp } from '@/newhero/foliage'
import { Globe } from '@/newhero/Globe'
import { HeroLights } from '@/newhero/heroLights'
import { Palette } from '@/newhero/palette'
import { StackedWindows } from '@/newhero/StackedWindows'
import { Switch } from '@/newhero/Switch'

/**
 * ของประดับที่ลอยรอบช่องพิมพ์ในจอเล่าเรื่อง (ดู ./ScrollTell)
 *
 * ทุกชิ้นเป็นของ *ชิ้นเดิม* จากจอแรก ไม่ได้ปั้นใหม่ให้เหมือน: ลูกโลก ถาดสี สวิตช์
 * โหมดนักพัฒนา หน้าต่างซ้อน และต้นไม้จากทุ่ง — ของเดียวกันหมายถึงวันหนึ่งจูนที่จอแรกแล้ว
 * จอนี้เปลี่ยนตาม ไม่ใช่สองจอที่ค่อย ๆ เพี้ยนออกจากกัน ไฟก็ชุดเดียวกัน (HeroLights)
 * เพราะหน้าตาแบบดินน้ำมันมาจากแผงไฟนุ่ม ไม่ได้มาจากตัวโมเดล
 *
 * แคนวาสโปร่งและไม่รับเมาส์ — มันลอยอยู่หลังช่องพิมพ์ซึ่งเป็น DOM และพื้นฟ้าซึ่งเป็น CSS
 *
 * วาดตามสั่ง (frameloop demand) แล้วสั่งวาดเมื่อเลื่อนจอ: ของลอยด้วยระยะเลื่อน ไม่ใช่ด้วย
 * นาฬิกา หยุดเลื่อนคือหยุดวาด — หน้านี้มีแคนวาสอื่นที่วาดทุกเฟรมอยู่แล้ว ตัวนี้ต้องไม่กิน
 * ลูปวาดเพิ่มตอนอยู่นิ่ง
 */

/**
 * ผังของประดับ — พิกัดเป็นหน่วยฉาก (กล้อง ortho: 1 หน่วย = 1 ส่วนสิบของความสูงจอ)
 *
 * วางเป็นวงรอบที่ว่างกลางจอ ไม่มีชิ้นไหนอยู่ในแถบกลางที่ช่องพิมพ์กิน (y ราว -0.9..0.9)
 * `drift` = ลอยขึ้นกี่หน่วยตลอดช่วง ต่างกันต่อชิ้นเพื่อให้เป็นพารัลแลกซ์ ไม่ใช่แผ่นเดียว
 * `delay` = เข้าฉากช้ากว่าชิ้นแรกกี่ส่วนของความสูงจอ — ของมาไม่พร้อมกันคือสิ่งที่ทำให้
 * อ่านเป็น "ของลอยเข้ามา" ไม่ใช่ "ภาพหนึ่งภาพถูกเปิด"
 */
const LAYOUT = [
  { kind: 'globe', pos: [-5.6, 2.5, 0], scale: 0.78, rot: [0.2, 0.5, 0.1], drift: 0.9, spin: 0.5, delay: 0.0 },
  { kind: 'palette', pos: [-6.2, -2.1, 0], scale: 0.62, rot: [0.3, -0.4, -0.6], drift: 1.5, spin: -0.3, delay: 0.14 },
  { kind: 'stack', pos: [-6.6, -3.4, 0], scale: 1.35, rot: [0.25, 0.55, -0.12], drift: 1.1, spin: 0.25, delay: 0.22 },
  { kind: 'tree', pos: [-4.6, 3.0, 0], scale: 0.9, rot: [0, 0.4, 0.12], drift: 0.7, spin: 0.4, delay: 0.08 },
  { kind: 'switch', pos: [5.8, 2.2, 0], scale: 0.5, rot: [0.2, -0.5, 0.22], drift: 1.3, spin: -0.35, delay: 0.05 },
  { kind: 'stack', pos: [5.4, -2.6, 0], scale: 1.2, rot: [0.2, -0.6, 0.14], drift: 0.8, spin: -0.5, delay: 0.28 },
  { kind: 'globe', pos: [4.6, 3.7, 0], scale: 0.4, rot: [0.1, 0.2, 0], drift: 1.6, spin: 0.8, delay: 0.18 },
  { kind: 'palette', pos: [6.4, -0.4, 0], scale: 0.34, rot: [0.4, 0.3, 0.8], drift: 1.0, spin: 0.6, delay: 0.34 },
]

/**
 * ระยะเลื่อน (หน่วยจอ) ที่จอเล่าเรื่องเริ่ม และช่วงที่ของชิ้นหนึ่งใช้เข้าฉาก
 *
 * เขียนเป็นค่าคงที่ที่นี่ ไม่ได้ import จากจอเล่าเรื่อง เพราะแคนวาสนี้ไม่ควรรู้จักโมดูลนั้น
 * (มันเป็นของประดับ ไม่ใช่ส่วนของเรื่อง) ค่าต้องเท่าความสูงของจอแรก — จอแรกกิน 0.9 จอ
 */
const TELL_AT = 0.9
const IN_SPAN = 0.4

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
/** ออกช้าแบบ quint — ของพุ่งเข้ามาแล้วคลานเข้าที่ ไม่ใช่ไถลด้วยความเร็วคงที่ */
const outQuint = (v) => 1 - (1 - v) ** 5

export function TellProps() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <Canvas
        orthographic
        /**
         * กล้องอยู่ไกลมาก เพราะกลุ่มของถูกสเกลด้วย "หนึ่งในสิบของความสูงจอ" (เป็นพิกเซล)
         * ของชิ้นหนึ่งจึงกินหลายสิบหน่วยโลก ตั้งกล้องไว้ที่ z 40 แบบเดิมกล้องจะไปอยู่ *ใน*
         * ตัวลูกโลก เห็นแค่แถบถนนของมันเป็นวงแหวน (วัดมาแล้ว) ออร์โธไม่มีเพอร์สเปกทีฟ
         * ระยะจึงไม่เปลี่ยนขนาดของที่เห็น
         */
        camera={{ position: [0, 0, 2000], zoom: 1, near: 1, far: 6000 }}
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
      >
        <HeroLights shadows={false} />
        <Rig />
      </Canvas>
    </div>
  )
}

function Rig() {
  const g = useRef()
  const { size, invalidate } = useThree()

  /**
   * กล้อง ortho ของ r3f ตั้งกรอบเท่าขนาดแคนวาสเป็นพิกเซล ของขนาดหน่วยเดียวจึงเล็กจนมองไม่
   * เห็น — สเกลกลุ่มทั้งก้อนด้วยหนึ่งในสิบของความสูงจอ ผังจึงเขียนเป็นหน่วยที่อ่านง่ายและ
   * ของโตตามจอโดยไม่ต้องแก้ตัวเลข
   */
  const unit = size.height / 10

  /** ตัวของประดับสร้างครั้งเดียว — ผังคงที่ ไม่ได้เปลี่ยนตามเฟรม */
  const items = useMemo(() => LAYOUT, [])

  useFrame(() => {
    const root = g.current
    if (!root) return
    const vh = Math.max(1, window.innerHeight)
    /** ลอยตามระยะเลื่อนของหน้า ไม่ใช่ตามนาฬิกา — ของจะนิ่งเมื่อผู้ชมหยุด */
    const s = window.scrollY / vh
    for (let i = 0; i < root.children.length; i++) {
      const it = items[i]
      const o = root.children[i]
      if (!it || !o) continue
      /**
       * เข้าฉาก: ลอยขึ้นจากใต้ที่ของตัวเองพร้อมโตจากเล็ก และหมุนเกินไปหน่อยแล้วคลายเข้าที่
       *
       * ทำที่ตัวของแต่ละชิ้น ไม่ได้ทำที่ชั้น DOM ที่ครอบแคนวาส เพราะสเกลแคนวาสทั้งใบคือ
       * การขยายภาพที่เรนเดอร์แล้ว (เห็นเป็นภาพเบลอ) และทั้งกองจะมาพร้อมกันเป็นแผ่นเดียว
       */
      const e = outQuint(clamp01((s - TELL_AT - it.delay) / IN_SPAN))
      /* กลุ่มแม่สเกลด้วย unit อยู่แล้ว ตำแหน่งลูกจึงอยู่ในหน่วยผัง ไม่ต้องคูณ unit อีก */
      o.position.y = it.pos[1] + s * it.drift - (1 - e) * 1.6
      o.rotation.y = it.rot[1] + s * it.spin + (1 - e) * 0.9
      o.scale.setScalar(it.scale * (0.55 + 0.45 * e))
    }
  })

  /** สั่งวาดเมื่อมีอะไรที่ทำให้ของขยับได้ */
  useFrameKick(invalidate)

  return (
    <group ref={g} scale={unit}>
      {items.map((it, i) => (
        <group key={i} position={[it.pos[0], it.pos[1], it.pos[2]]} rotation={it.rot} scale={it.scale}>
          <Item kind={it.kind} />
        </group>
      ))}
    </group>
  )
}

/** ของประดับหนึ่งชิ้น — ชี้ไปที่คอมโพเนนต์เดิมของจอแรก ไม่มีเรขาคณิตใหม่ที่นี่ */
function Item({ kind }) {
  if (kind === 'globe') {
    /* ของประดับบนลูกโลกน้อยกว่าในจอแรก: ที่นี่มันเป็นของลอยขนาดเล็ก ไม่ใช่ฉากที่ต้องอ่าน
       รายละเอียด — ของเยอะเท่าเดิมคือ draw call ที่จ่ายไปกับสิ่งที่มองไม่เห็น */
    return <Globe bushes={8} cones={2} rounds={2} mushrooms={1} flowers={4} berries={2} pebbles={6} speed={0} />
  }
  if (kind === 'palette') return <Palette />
  if (kind === 'switch') return <Switch glass={0} pos={1} />
  if (kind === 'stack') return <StackedWindows count={3} />
  /* ต้นไม้ของทุ่งในจอแรก — LUMPS ไม่มีคีย์ 'tree' ทรงต้นคือ 'cone' และ mat รับวัสดุชิ้นเดียว
     ไม่ใช่ตารางวัสดุทั้งชุด (ดู lumpMaterial ใน newhero/foliage) */
  return <FoliageProp kind="cone" mat={FOLIAGE_MATS.leaves[0]} />
}

/** สั่งวาดตอนเลื่อนจอ/เปลี่ยนขนาด — แยกเป็นฮุกเพื่อไม่ให้ลูปของ Rig รู้เรื่อง DOM */
function useFrameKick(invalidate) {
  useEffect(() => {
    const kick = () => invalidate()
    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    kick()
    return () => {
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
    }
  }, [invalidate])
}

export default TellProps
