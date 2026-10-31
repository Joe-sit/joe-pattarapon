import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HeroRider } from '@/newhero/HeroRider'
import { sling } from './workMotion'

/**
 * ตัวละครในเปลหนังสติ๊ก (ด่านท้าย Selected Work — SlingGate) — ตัวเดียวกับ hero (HeroRider)
 *
 * ท่านั่งยอง ๆ ในเปล: เข่าชันขึ้น แขนสองข้างจับยางเหนือหัว · ง้าง = ตัวยุบลงตามเปล เอนหลัง เกร็ง
 * พุ่ง = ดีดขึ้นพ้นจอ หมุนตีลังกา · วางบนจอด้วยเส้นจากกล้องตัดระนาบ z (วิธีเดียวกับ WorksHanger)
 */
const BODY_VH = 0.3
const PLANE_Z = 1200
const RAD = Math.PI / 180
const Rider = HeroRider as unknown as React.ComponentType<Record<string, unknown>>
const RO = new THREE.Vector3()
const RP = new THREE.Vector3()
const A = new THREE.Vector3()
const B = new THREE.Vector3()
const BOX = new THREE.Box3()
const INV = new THREE.Matrix4()

export function SlingRider() {
  const { size, camera } = useThree()
  const g = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const fit = useRef({ n: 0, h: 0 })
  const armPose = useMemo(
    () => ({
      aimOut: 0.18,
      aimUp: 0.9,
      aimFwd: 0.1,
      aimRotX: 0,
      aimRotY: 0,
      aimRotZ: 0,
      aimX: 0.2,
      aimY: 1,
      aimZ: 0.1,
      elbowX: 0,
      elbowY: 0,
      elbowZ: 0.5,
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
      mugShX: -2.4,
      mugShY: 0,
      mugShZ: -0.35,
      mugElX: -0.6,
      mugElY: 0,
      mugElZ: 0.2,
    }),
    [],
  )
  /* นั่งยอง: สะโพกพับไปหน้า เข่างอมาก */
  const legPose = useMemo(
    () => ({
      L: { hipX: -1.35, hipY: 0.1, hipZ: 0.18, knee: 2.0, ankle: -0.4 },
      R: { hipX: -1.35, hipY: -0.1, hipZ: -0.18, knee: 2.0, ankle: -0.4 },
      spread: 0.18,
      stagger: 0,
    }),
    [],
  )
  const torsoPose = useMemo(() => ({ leanX: 0.25, leanZ: 0, foldX: 0.2, foldY: 0, foldZ: 0, headX: -0.2 }), [])

  useFrame(({ clock }) => {
    const gg = g.current
    if (!gg) return
    const inn = inner.current
    const sp0 = spin.current
    if (!fit.current.h && inn && sp0) {
      gg.visible = true
      gg.scale.setScalar(1)
      sp0.rotation.set(0, 0, 0)
      inn.position.set(0, 0, 0)
      gg.updateWorldMatrix(true, true)
      if (++fit.current.n > 8) {
        BOX.setFromObject(inn).applyMatrix4(INV.copy(gg.matrixWorld).invert())
        if (!BOX.isEmpty()) {
          fit.current.h = BOX.max.y - BOX.min.y
          /* จุดหมุน = ก้น (ล่างกลาง) นั่งบนเปล */
          inn.position.set(-(BOX.min.x + BOX.max.x) / 2, -BOX.min.y - (BOX.max.y - BOX.min.y) * 0.12, -(BOX.min.z + BOX.max.z) / 2)
        }
      }
      gg.scale.setScalar(1e-4)
      return
    }
    gg.visible = sling.vis > 0.01 && fit.current.h > 0 && sling.launch < 1
    if (!gg.visible) return
    const W = size.width
    const H = size.height
    const pz = PLANE_Z * (H / 900)
    const toWorld = (sx: number, sy: number, out: THREE.Vector3) => {
      RO.copy(camera.position)
      RP.set((sx / W) * 2 - 1, -((sy / H) * 2 - 1), 0.5).unproject(camera)
      return out.copy(RO).lerp(RP, (pz - RO.z) / (RP.z - RO.z))
    }
    toWorld(W / 2, H / 2, A)
    toWorld(W / 2 + 100, H / 2, B)
    const upp = A.distanceTo(B) / 100
    /* พุ่ง: ดีดขึ้นพ้นจอ (เร่งขึ้น) */
    const L = sling.launch
    const fly = L > 0 ? Math.pow(L, 1.6) * H * 1.5 : 0
    toWorld(sling.px, sling.py - fly, A)
    gg.position.copy(A)
    gg.scale.setScalar(((H * BODY_VH * upp) / fit.current.h) * (1 - sling.pull * 0.08))
    const t = clock.elapsedTime
    const sp = spin.current
    if (sp) {
      /* นั่งแกว่งเบา ๆ · ง้าง = เอนหลังเกร็ง · พุ่ง = ตีลังกา */
      sp.rotation.x = (-10 - sling.pull * 22) * RAD - L * Math.PI * 2.2
      sp.rotation.y = (Math.sin(t * 0.8) * 8) * RAD
      sp.rotation.z = (Math.sin(t * 1.2) * 3) * RAD
    }
  })

  return (
    <group ref={g} visible={false}>
      <group ref={spin}>
        <group ref={inner}>
          <Rider noBoard noIdle armPose={armPose} legPose={legPose} torsoPose={torsoPose} />
        </group>
      </group>
    </group>
  )
}
