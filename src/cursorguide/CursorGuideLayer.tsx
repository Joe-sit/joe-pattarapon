import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Cursor } from '@/newhero/Cursor'
import { HeroLights } from '@/newhero/heroLights'
import { introTime } from '@/newhero/intro'
import { useTuner } from '@/newhero/tuner'
import { driveHeroPointer } from '@/sections/hero/Headline3D'
import { heroCursor } from './heroCursor'
import { cursorPress } from './press'
import { cursorPose } from './stops'

/**
 * ชั้นของเคอร์เซอร์นำสายตา — ลูกศร "ตัวจริง" ตัวเดียวทั้งหน้า ลอยเหนือทุก section
 *
 * นี่คือลูกศรที่เห็นมุมซ้ายล่างของจอแรกด้วย ไม่ใช่ตัวสำรองที่โผล่มาตอนเลื่อน: ฉาก hero
 * วาง group เปล่าไว้เป็นหมุด (ดู CursorAnchor ใน NewHeroScene) แล้วชั้นนี้เกาะหมุดนั้น
 * ตั้งแต่เฟรมแรก — ตำแหน่ง ขนาดที่เห็นบนจอ และทิศหันในสเปซกล้อง พอเลื่อนพ้นจุดจอดแรก
 * มันก็ออกเดินทางไปตามเส้นทางของ stops ผู้ชมเห็นของชิ้นเดิมเคลื่อนออกจากฉากไปทั้งหน้า
 *
 * ทำไมต้องเป็นแคนวาสของตัวเอง: ของในฉากของจอหนึ่งออกไปโผล่ในอีกจอไม่ได้เลย ต่อให้
 * ขยับไปตำแหน่งเดียวกันก็เป็นของสองชิ้นที่หน้าตาเหมือนกัน ไม่ใช่ตัวเดิมที่เดินทางต่อ
 *
 * กล้องเป็นออร์โธกราฟิกที่ r3f ตั้งกรอบให้เท่าขนาดแคนวาสพอดี = 1 หน่วยฉากเท่ากับ 1 พิกเซล
 * ตำแหน่งจึงเป็นพิกเซลบนจอตรง ๆ ไม่ต้องฉายกลับจากพิกัดโลก
 *
 * วาดแบบ "ตามสั่ง" (frameloop demand) แล้วสั่งวาดเมื่อเลื่อนจอ/ขยับเมาส์/เปลี่ยนขนาด —
 * หน้านี้มีแคนวาสอื่นที่วาดทุกเฟรมอยู่แล้วสองตัว ตัวนี้จึงต้องไม่กินลูปวาดเพิ่มเวลาอยู่นิ่ง
 *
 * ชั้นนี้ไม่รับเมาส์ (`pointer-events: none`) — มันเป็นตัวนำสายตา ไม่ใช่ของที่กดได้ และต้อง
 * ไม่บังปุ่มอะไรของหน้าเลย
 */

/** สูงกว่าเนื้อหาแต่ต่ำกว่าแผงจูนของ dev (ซึ่งใช้ z สูงกว่านี้) */
const Z = 55
const RAD = Math.PI / 180

export function CursorGuideLayer() {
  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z }} aria-hidden>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 100], zoom: 1, near: 0.1, far: 400 }}
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
      >
        <Rig />
      </Canvas>
    </div>
  )
}

function Rig() {
  const g = useRef<THREE.Group>(null)
  const lights = useRef<THREE.Group>(null)
  const { size, invalidate } = useThree()
  const t = useTuner()

  /**
   * ท่าคลิกตอนเข้าฉาก — ปั้นใหม่จากค่าแผงจูนชุดเดียวกับที่ฉาก hero ใช้
   *
   * `introTime()` เป็นนาฬิกาของ intro ทั้งหน้า ไม่ใช่ clock ของแคนวาสไหน จึงอ่านข้ามแคนวาส
   * ได้ตรง ๆ และท่านี้ตรงจังหวะกับของอื่นในฉากเหมือนตอนลูกศรยังอยู่ในฉาก
   */
  const clickAt = t.enDelay + t.enDur + t.inPropAt + t.inClickAt
  const pressAt = useMemo(
    () => () => {
      /* ค่ามากสุดของสองช่อง: ท่ากดตอนเข้าฉาก (นาฬิกา) กับท่ากดที่ section สั่ง (ระยะเลื่อน) */
      if (t.intro < 0.5) return cursorPress.v
      const u = (introTime() - clickAt + 0.14) / 0.28
      const intro = u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI)
      return Math.max(intro, cursorPress.v)
    },
    [t.intro, clickAt],
  )

  /** สั่งวาดเมื่อมีอะไรที่เปลี่ยนตำแหน่งเคอร์เซอร์ได้ */
  useEffect(() => {
    const kick = () => invalidate()
    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    window.addEventListener('pointermove', kick, { passive: true })
    kick()
    return () => {
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
      window.removeEventListener('pointermove', kick)
    }
  }, [invalidate])

  /**
   * ท่าเข้าฉากกับท่าคลิกวิ่งด้วยนาฬิกา ไม่ใช่การเลื่อนจอ — ช่วงนั้นต้องวาดทุกเฟรม
   *
   * frameloop เป็น demand ถ้าไม่สั่งวาด ท่าเข้าฉากจะค้างเป็นภาพนิ่งจนผู้ใช้ขยับเมาส์
   */
  useFrame(() => {
    if (t.intro > 0.5 && introTime() < clickAt + 0.6) invalidate()
    const root = g.current
    if (!root) return
    const p = cursorPose()
    root.visible = p.ok
    if (!p.ok) return
    // พิกัดจอ (0,0 = ซ้ายบน) -> พิกัดกล้องออร์โธที่กลางจอเป็นศูนย์
    root.position.set(p.x - size.width / 2, size.height / 2 - p.y, 0)
    root.quaternion.copy(p.q)
    root.scale.setScalar(p.size)
    /**
     * ชุดไฟหมุนกลับด้วยผกผันของทิศกล้องฉาก hero
     *
     * ทิศหันของลูกศรที่รับมาอยู่ในสเปซกล้อง ถ้าปล่อยไฟไว้ในสเปซโลกของชั้นนี้ แสงจะตกคนละ
     * ด้านกับในฉากเดิม (แผงไฟ Environment หมุนตามไม่ได้ แต่มันนุ่มและกระจาย เลยไม่เห็นต่าง)
     */
    if (lights.current) lights.current.quaternion.copy(heroCursor.camQ).invert()
    /**
     * ช่วงที่กวาดผ่านหัวเรื่อง — ยิงตำแหน่งตัวเองเข้าไปแทนเมาส์ ตัวอักษรจึงถูกดูดตาม
     *
     * ทำเฉพาะช่วงที่ธงเปิด ไม่ยิงตลอดเวลา ไม่งั้นแม่เหล็กของหัวเรื่องจะไม่ตอบสนองเมาส์จริง
     * ของผู้ใช้อีกเลย
     */
    if (p.drive) driveHeroPointer(p.x, p.y)
  })

  if (t.cu < 0.5) return null
  return (
    <>
      {/* ไฟชุดเดียวกับฉาก hero — ลูกศรออกมาอยู่นอกแคนวาสนั้นแล้ว แต่ต้องรับแสงเหมือนเดิม */}
      <group ref={lights}>
        <HeroLights shadows={false} />
      </group>
      <group ref={g} visible={false}>
        {/* ลูกศรตัวเดิมของฉากจอแรก — props ชุดเดียวกัน อ่านจากแผงจูนตัวเดียวกัน
            ขนาดคิดเป็นพิกเซลเพราะกล้องเป็นออร์โธ 1 หน่วย = 1 พิกเซล */}
        <Cursor
          kind={t.cuHand > 0.5 ? 'hand' : 'arrow'}
          pressAt={pressAt}
          aim={t.cuHand > 0.5 ? 0 : t.cuAim}
          aimMax={t.cuAimMax * RAD}
          aimEase={t.cuAimEase}
          depth={t.cuDepth}
          outline={t.cuOutline}
        />
      </group>
    </>
  )
}
