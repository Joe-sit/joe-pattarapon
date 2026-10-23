import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HeroRider } from '@/newhero/HeroRider'
import { WORKS_BOOM, WORKS_HOLD, clamp01, slotRect, smooth, worksPostSm, worksUI } from './workMotion'

/**
 * ตัวละครใน section My Works — ตัวเดียวกับ hero (HeroRider) ห้อยดึงไทล์งานช่อง 0 แบบภาพประกอบ Essential coding apps
 *
 * ท่า: แขนข้างเล็งเหยียดตรงขึ้นจับไทล์ · อีกข้างกางลงเฉียง · ตัวเอียงทแยง · ขาหน้างอเตะ ขาหลังเหยียด
 * ห้อยแกว่งเบา ๆ ตามเวลา · hover ไทล์ช่อง 0 = ดึงแรงขึ้น (ตัวเหวี่ยงมากขึ้น)
 * เข้า: ลอยขึ้นจากล่างจอมาจับไทล์พร้อมไทล์ลงช่อง · ออก: ตกลงพ้นจอพร้อมท้ายบท · เปิดไทล์เต็มจอ = หลบลงล่าง
 *
 * วางในพิกัดโลกของแคนวาสของบนจอ (กล้องที่ z = 1700 หันเข้าจุดกำเนิด) — จอ → โลกด้วยเส้นจากกล้องตัดระนาบ z
 */

/** ความสูงตัวละครบนจอ (สัดส่วนความสูงจอ) · ระนาบโลกที่วาง (หน้าไทล์) */
const BODY_VH = 0.52
const PLANE_Z = 1440

const RAD = Math.PI / 180
/* HeroRider เป็น JSX — ค่าเริ่มต้น null ทำให้ TS อนุมานชนิด prop เป็น null · ท่ามีรูปร่างตาม SKATE_ARM / SKATE_LEG / SKATE_TORSO ใน joespresso Mascot */
const Rider = HeroRider as unknown as React.ComponentType<Record<string, unknown>>
const RO = new THREE.Vector3()
const RP = new THREE.Vector3()
const A = new THREE.Vector3()
const B = new THREE.Vector3()
const BOX = new THREE.Box3()
const INV = new THREE.Matrix4()

export function WorksHanger() {
  const { size, camera } = useThree()
  const g = useRef<THREE.Group>(null)
  const swing = useRef<THREE.Group>(null)
  const pull = useRef(0)
  const away = useRef(0)
  const inner = useRef<THREE.Group>(null)
  /*
   * วัดตัวละครครั้งเดียวหลังโหลด+ตั้งท่าแล้ว (ไม่เดาขนาด GLB): จุดบนสุด = มือที่เหยียดขึ้น → ย้ายมาไว้ที่จุดหมุน
   * ความสูงตัว (หน่วยของมัน) ใช้แปลงเป็น px บนจอ
   */
  const fit = useRef({ n: 0, h: 0 })

  /* ท่าคงที่ (วัตถุใบเดิม — ไม่สร้างใหม่ต่อเฟรม) */
  const armPose = useMemo(
    () => ({
      aimOut: 0.02,
      aimUp: 0.04,
      aimFwd: 0,
      aimRotX: 0,
      aimRotY: 0,
      aimRotZ: 0,
      aimX: 0.12,
      aimY: 1,
      aimZ: 0.05,
      elbowX: 0,
      elbowY: 0,
      elbowZ: 0.35,
      wristX: 0,
      wristY: 0,
      wristZ: 0,
      handScale: 1,
      handX: 0,
      handY: 0,
      handZ: 0,
      mugOut: 0,
      mugUp: 0,
      mugFwd: 0,
      mugRotX: 0,
      mugRotY: 0,
      mugRotZ: 0,
      mugWristX: 0,
      mugWristY: 0,
      mugWristZ: 0,
      mugHandScale: 1,
      mugHandX: 0,
      mugHandY: 0,
      mugHandZ: 0,
      mugShX: 0.25,
      mugShY: 0,
      mugShZ: -0.35,
      mugElX: 0,
      mugElY: 0,
      mugElZ: 0.15,
    }),
    [],
  )
  const legPose = useMemo(
    () => ({
      L: { hipX: -1.55, hipY: 0.25, hipZ: 0.3, knee: 1.9, ankle: 0.45 },
      R: { hipX: 0.75, hipY: -0.15, hipZ: -0.25, knee: 0.95, ankle: 0.3 },
      spread: 0.04,
      stagger: 0,
    }),
    [],
  )
  const torsoPose = useMemo(() => ({ leanX: 0.12, leanZ: 0, foldX: 0, foldY: 0, foldZ: 0, headX: -0.25 }), [])

  useFrame(({ clock }, delta) => {
    const gg = g.current
    if (!gg) return
    const post = worksPostSm.v
    const land = smooth(clamp01((post - WORKS_BOOM[0] - WORKS_BOOM[1] * 0.25) / (WORKS_BOOM[1] * 0.65)))
    const ex = smooth(clamp01((post - WORKS_HOLD[1]) / (WORKS_HOLD[2] - WORKS_HOLD[1])))
    const dt = Math.min(0.1, delta)
    pull.current += ((worksUI.hover === 0 ? 1 : 0) - pull.current) * (1 - Math.exp(-dt * 6))
    away.current += ((worksUI.open >= 0 ? 1 : 0) - away.current) * (1 - Math.exp(-dt * 6))
    const show = land * (1 - ex)
    const inn = inner.current
    const sw0 = swing.current
    if (!fit.current.h && inn && sw0) {
      /* ต้องวัดในท่าตรง (ไม่แกว่ง) — รอสองสามเฟรมให้ริกตั้งท่าเสร็จก่อน */
      gg.visible = true
      gg.scale.setScalar(1)
      sw0.rotation.set(0, 0, 0)
      inn.position.set(0, 0, 0)
      gg.updateWorldMatrix(true, true)
      if (++fit.current.n > 8) {
        BOX.setFromObject(inn).applyMatrix4(INV.copy(gg.matrixWorld).invert())
        if (!BOX.isEmpty()) {
          fit.current.h = BOX.max.y - BOX.min.y
          inn.position.set(-(BOX.min.x + BOX.max.x) / 2 - (BOX.max.x - BOX.min.x) * 0.12, -BOX.max.y, -(BOX.min.z + BOX.max.z) / 2)
        }
      }
      gg.scale.setScalar(1e-4)
      return
    }
    gg.visible = show > 0.001 && fit.current.h > 0
    if (!gg.visible) return
    const W = size.width
    const H = size.height
    const rc = slotRect(0, W, H)
    /* จอ → โลก: เส้นจากกล้องผ่านจุดบนจอ ตัดระนาบ z = PLANE_Z (ตามความสูงจอเหมือนท่าล็อกของเล่มงาน) */
    const pz = PLANE_Z * (H / 900)
    const toWorld = (sx: number, sy: number, out: THREE.Vector3) => {
      RO.copy(camera.position)
      RP.set((sx / W) * 2 - 1, -((sy / H) * 2 - 1), 0.5).unproject(camera)
      return out.copy(RO).lerp(RP, (pz - RO.z) / (RP.z - RO.z))
    }
    toWorld(W / 2, H / 2, A)
    toWorld(W / 2 + 100, H / 2, B)
    const upp = A.distanceTo(B) / 100
    const bodyPx = H * BODY_VH
    /* มือจับขอบล่างไทล์ · เข้า = ลอยขึ้นจากล่างจอ · ออก/เปิดไทล์ = ตกลง */
    const drop = (1 - land) * H * 0.9 + (ex + away.current) * H * 0.9
    const hx = rc.cx
    const hy = rc.cy + rc.h * 0.42 + drop
    toWorld(hx, hy, A)
    gg.position.copy(A)
    /* ขนาด: ความสูงตัวที่วัดได้ → bodyPx บนจอ */
    gg.scale.setScalar((bodyPx * upp) / fit.current.h)
    /* ห้อยแกว่ง (หมุนรอบมือ) · ดึงแรง = เหวี่ยงมากขึ้น */
    const t = clock.elapsedTime
    const sw = swing.current
    if (sw) {
      sw.rotation.z = (-24 + Math.sin(t * 1.3) * 4 + pull.current * 10) * RAD
      sw.rotation.y = (-18 + Math.sin(t * 0.9) * 6) * RAD
    }
  })

  return (
    <group ref={g} visible={false}>
      {/* หมุนรอบจุดมือ: ยกตัวขึ้นให้มืออยู่ที่จุดกำเนิดของกลุ่มนี้ */}
      <group ref={swing}>
        <group ref={inner}>
          <Rider noBoard noIdle armPose={armPose} legPose={legPose} torsoPose={torsoPose} />
        </group>
      </group>
    </group>
  )
}
