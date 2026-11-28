import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CUT, HAND_IN, clamp01, devScreen, grassPhone, smooth, type WorkBeats } from './workMotion'
import { SKIN } from './frameHand'
import { GRASS_TUNE } from './grassTune'
import { loadVoxelHand, makeGripHand, poseGripHand, type GripHand } from './voxelHand'

/**
 * มือตัวละครจับเครื่อง — ปลายบท Code (เรื่องลงพื้นหญ้า GRASS_STORY ใน ./workMotion)
 *
 * มือโวเซล (./voxelHand) ท่าจับชุดเดียวกับมือที่ติดมือถือในฉากหญ้า — ค่าจากแผงจัดท่า (GRASS_TUNE grip*, curl*, thumb*)
 * พิกัดของมือ = พิกัดมือถือ (เมตร) · ที่นี่ย่อเป็น px ตามกรอบจอเครื่องบนจอ (devScreen — BubbleTraveler เขียนทุกเฟรม): ครึ่งกว้างจอ 0.1 ม. = hw px
 * ตัวเครื่องเองอยู่แคนวาสอื่น — ใส่กล่องเครื่องล่องหน (เขียนแค่ความลึก) ให้ฝ่ามือที่อยู่หลังเครื่องถูกบังเหมือนในฉากหญ้า
 * ยื่นขึ้นจากล่าง แล้วนิ้วงอเข้ากำ · แขนท่อนล่างต่อจากข้อมือลงพ้นจอ
 * ต่อด้วยการตัดต่อเนื่องที่มือถือ (CUT): ตามมือถือในฉากหญ้า (grassPhone) แล้วจางเร็ว ๆ เผยมือ 3D ชุดเดียวกันข้างใต้
 */
/** ความหนาตัวเครื่องล่องหน (ม.) — กว้าง/สูงตามกรอบเครื่องบนจอจริง (กรอบแก้วใหญ่กว่าจอนิด) */
const PHONE_D = 0.03
/** แขนท่อนล่าง (ม. พิกัดมือถือ): หน้าตัด [กว้าง, หนา] · ยาว · ทิศจากข้อมือ (ลงขวาแบบ Frame 1 — ไม่ผูกทิศนิ้ว) */
const ARM = [0.085, 0.07, 0.9] as const
const ARM_DIR = new THREE.Vector2(0.42, -1).normalize()

function Hand({ frame, wrap }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }>; wrap: React.RefObject<HTMLDivElement | null> }) {
  const g = useRef<THREE.Group>(null)
  const occ = useRef<THREE.Mesh>(null)
  const arm = useRef<THREE.Mesh>(null)
  const grip = useRef<GripHand | null>(null)
  const invalidate = useThree((s) => s.invalidate)
  const size = useThree((s) => s.size)
  const last = useRef('')
  const res = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 1, metalness: 0 })
    const occ = new THREE.MeshBasicMaterial({ colorWrite: false })
    return { box, skin, occ }
  }, [])
  useEffect(
    () => () => {
      res.box.dispose()
      res.skin.dispose()
      res.occ.dispose()
    },
    [res],
  )

  useEffect(() => {
    let dead = false
    loadVoxelHand().then((gl) => {
      if (dead || !g.current) return
      const h = makeGripHand(gl, 1)
      g.current.add(h.root)
      grip.current = h
      invalidate()
    })
    return () => {
      dead = true
      grip.current?.root.removeFromParent()
      grip.current?.dispose()
      grip.current = null
    }
  }, [res, invalidate])

  /* ปลุกวาดเฉพาะตอนสถานะเปลี่ยน (แคนวาส demand) */
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const f = frame.current
      const c = f?.on ? f.b.code : 0
      const key = `${c.toFixed(4)}|${devScreen.cx.toFixed(1)}|${devScreen.cy.toFixed(1)}|${devScreen.hw.toFixed(1)}|${grassPhone.cx.toFixed(1)}|${grassPhone.cy.toFixed(1)}|${grassPhone.hw.toFixed(2)}|${grassPhone.roll.toFixed(3)}|${grassPhone.hand.toFixed(3)}|${grip.current ? 1 : 0}`
      if (key !== last.current) {
        last.current = key
        invalidate()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [frame, invalidate])

  useFrame(() => {
    const gg = g.current
    const f = frame.current
    const h = grip.current
    if (!gg || !f) return
    const c = f.on ? f.b.code : 0
    const inK = clamp01((c - HAND_IN[0]) / HAND_IN[1])
    const cut = c >= CUT[0] && grassPhone.ok
    const src = cut ? grassPhone : devScreen
    const fade = cut ? grassPhone.hand : 1
    gg.visible = !!h && inK > 0 && src.ok && fade > 0.01
    if (wrap.current) wrap.current.style.opacity = fade.toFixed(3)
    if (!gg.visible || !h) return
    const W = size.width
    const H = size.height
    /* px ต่อเมตร (พิกัดมือถือ): ครึ่งกว้างจอมือถือ 0.1 ม. = ครึ่งกว้างจอเครื่องบนจอ */
    const k = src.hw / 0.1
    /* ยื่นขึ้นจากล่าง (ease-out นุ่ม) · กำ = นิ้วงอเข้าช่วงท้าย */
    const rise = cut ? 1 : 1 - Math.pow(1 - smooth(inK / 0.75), 3)
    const gripK = cut ? 1 : smooth((inK - 0.55) / 0.45)
    gg.position.set(src.cx - W / 2, H / 2 - src.cy - (1 - rise) * H * 0.95, 0)
    gg.scale.setScalar(k)
    occ.current?.scale.set((src.hw * 2.02) / k, (src.hh * 1.98) / k, PHONE_D)
    /* มือถือในฉากหญ้าเอียงตามกล้องที่หมุนออก — มือเอียงตาม (ทวนเข็มบนจอ = บวกในพิกัดกล้องตั้งฉาก y ขึ้น) */
    gg.rotation.z = cut ? -grassPhone.roll : 0
    poseGripHand(h, GRASS_TUNE, 0.25 + 0.75 * gripK, 1)
    /* แขน: จากข้อมือ (ตำแหน่งมือในแผง) ลงขวาพ้นจอ */
    const a = arm.current
    if (a) {
      const T = GRASS_TUNE
      a.position.set(T.gripX + (ARM_DIR.x * ARM[2]) / 2, T.gripY + (ARM_DIR.y * ARM[2]) / 2, T.gripZ)
      a.rotation.z = Math.atan2(-ARM_DIR.x, ARM_DIR.y) + Math.PI
      a.scale.set(ARM[0], ARM[2], ARM[1])
    }
  })

  return (
    <group ref={g} visible={false}>
      <hemisphereLight args={['#fff4ea', '#b98a78', 1.5]} />
      <directionalLight position={[-400, 700, 900]} intensity={2.0} />
      <directionalLight position={[600, -300, 500]} intensity={0.45} color="#ffd9c8" />
      {/* ตัวเครื่องล่องหน: เขียนแค่ความลึก บังส่วนของมือที่อยู่หลังเครื่อง (วาดก่อนมือ) */}
      <mesh ref={occ} geometry={res.box} material={res.occ} renderOrder={-1} />
      <mesh ref={arm} geometry={res.box} material={res.skin} />
    </group>
  )
}

export function HoldHand({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const wrap = useRef<HTMLDivElement>(null)
  return (
    <div ref={wrap} className="pointer-events-none fixed inset-0 z-[54]" aria-hidden>
      <Canvas orthographic frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 0, 3000], zoom: 1, near: 1, far: 8000 }} gl={{ antialias: true, alpha: true }} style={{ pointerEvents: 'none' }}>
        <Hand frame={frame} wrap={wrap} />
      </Canvas>
    </div>
  )
}
