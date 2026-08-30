import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'

/**
 * ระเบิดฉากด้วยฟิสิกส์จริง (rapier) แล้วให้ทีมงานประกอบกลับ
 *
 * ทุกชิ้นบนสุดของ diorama ถูกห่อด้วย <Chunk> ซึ่งเป็น RigidBody ตัวหนึ่ง สามสถานะ:
 *
 *  idle    — type "fixed" ฉากนิ่งสนิท ไม่มีอะไรตกหล่นเอง และ Physics ถูก pause ไว้ (ไม่กิน CPU)
 *  boom    — type "dynamic" + ยิง impulse ออกจากจุดระเบิดครั้งเดียว จากนั้นปล่อยให้ rapier
 *            คิดเอง: แรงโน้มถ่วง การหมุน การกระแทกพื้น การชนกันเอง
 *  rebuild — type "kinematicPosition" แล้วลากกลับที่เดิมด้วย setNextKinematic* ตามคิว
 *            (mascot กลับก่อน ของค่อยตามทีหลัง จึงอ่านเป็น "คนกำลังประกอบฉาก")
 *
 * ต้องเป็น kinematic ตอนประกอบกลับ ไม่ใช่ dynamic — ไม่งั้นมันจะตกกลับลงพื้นระหว่างทาง
 * และตำแหน่งปลายทางจะไม่ตรงเป๊ะ
 */

export type ShatterPhase = 'idle' | 'boom' | 'rebuild'

const PhaseCtx = createContext<ShatterPhase>('idle')

/** จุดศูนย์กลางแรงระเบิด — ใต้กลางฐานแล็ปท็อปนิดหน่อย ของจะได้กระเด็นขึ้น ไม่ใช่ปัดออกข้าง */
const BLAST = new THREE.Vector3(1.2, -0.6, 0.6)
const BLAST_FORCE = 15
const SPIN_FORCE = 2.6

/** ประกอบกลับใช้เวลาเท่านี้ (วินาที) รวมคิวของชิ้นที่ออกทีหลังแล้ว */
const REBUILD_TIME = 2.8

function hash(i: number, seed: number) {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

let CHUNK_SEQ = 0

/**
 * หนึ่งชิ้นที่ระเบิดได้
 *
 * ตำแหน่ง/การหมุนตั้งต้นอยู่ที่ตัว RigidBody เอง ไม่ใช่ที่ลูกข้างใน — ของที่หมุนต้องหมุน
 * รอบตัวมันเอง ถ้าปล่อยให้ body อยู่ที่จุดกำเนิดฉากแล้วเลื่อนลูกออกไป มันจะเหวี่ยงรอบกลางฉาก
 */
export function Chunk({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  mascot = false,
  children,
}: {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** mascot กลับเข้าที่เป็นกลุ่มแรกตอนประกอบฉาก */
  mascot?: boolean
  children: ReactNode
}) {
  const phase = useContext(PhaseCtx)
  const body = useRef<RapierRigidBody>(null)
  // ลำดับคงที่ต่อชิ้น ใช้สุ่มแรงและคิวการกลับ — ไม่ใช่ Math.random ต่อเฟรม
  const id = useMemo(() => CHUNK_SEQ++, [])

  /**
   * ท่าตั้งต้นในพิกัดโลก
   *
   * ห้ามใช้ค่า position/rotation ที่เขียนใน JSX ตรง ๆ — นั่นเป็นพิกัดใน group ของฉาก
   * ซึ่งถูกเลื่อนไปแล้ว ส่วน API ของ rapier (setTranslation/setNextKinematic*) คิดเป็น
   * พิกัดโลกล้วน เอาค่า local ไปใส่ = ฉากทั้งฉากเลื่อนหลุดตอนประกอบกลับ
   * จึงอ่านจากตัว body เองตอน "ก่อนระเบิด" — ตอนนั้นโลกฟิสิกส์ยัง pause อยู่และ rapier
   * วางทุกชิ้นตามลำดับชั้นของ three เรียบร้อยแล้ว (ถ้าอ่านตั้งแต่ mount บางชิ้นยังไม่ถูก
   * วางจริง จะได้ค่าเป็นพิกัด local ปนมา)
   */
  const base = useRef<{ p: THREE.Vector3; q: THREE.Quaternion } | null>(null)

  const capture = () => {
    const b = body.current
    if (!b || base.current) return
    const t = b.translation()
    const r = b.rotation()
    base.current = {
      p: new THREE.Vector3(t.x, t.y, t.z),
      q: new THREE.Quaternion(r.x, r.y, r.z, r.w),
    }
  }

  /** เก็บท่าตอนเริ่มประกอบกลับ ไว้ใช้เป็นจุดตั้งต้นของการลาก */
  const from = useRef<{ p: THREE.Vector3; q: THREE.Quaternion } | null>(null)
  /** ค้างไว้ว่าต้อง "ยิงแรงระเบิด" — ยิงในเฟรมถัดไป ไม่ใช่ใน effect */
  const pending = useRef(false)
  const clock = useRef(0)
  const delay = mascot ? 0 : 0.25 + hash(id, 7) * 0.75

  useEffect(() => {
    const b = body.current
    if (!b) return

    capture()

    if (phase === 'boom') {
      // ยิงแรงในเฟรมถัดไป: ตอน effect นี้ทำงาน RigidBody อาจยัง type "fixed" อยู่ (prop
      // เพิ่งเปลี่ยนรอบเดียวกัน) แรงที่ใส่ให้ body ที่ยังตรึงอยู่จะหายไปเฉย ๆ — อาการคือมี
      // แค่บางชิ้นกระเด็น ที่เหลือยืนนิ่ง
      pending.current = true
    }

    if (phase === 'rebuild') {
      const t = b.translation()
      const r = b.rotation()
      from.current = {
        p: new THREE.Vector3(t.x, t.y, t.z),
        q: new THREE.Quaternion(r.x, r.y, r.z, r.w),
      }
      clock.current = 0
    }

    if (phase === 'idle' && base.current) {
      // จบท่าแล้ว วางกลับให้ตรงเป๊ะ ไม่ปล่อยให้ค้างคลาดจากการ lerp
      b.setTranslation(base.current.p, true)
      b.setRotation(base.current.q, true)
      b.setLinvel({ x: 0, y: 0, z: 0 }, true)
      b.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, id])

  useFrame((_, dt) => {
    const bodyNow = body.current
    if (pending.current && bodyNow && bodyNow.bodyType() === 0) {
      pending.current = false
      bodyNow.wakeUp()
      const t = bodyNow.translation()
      const dir = new THREE.Vector3(t.x, t.y, t.z).sub(BLAST)
      const dist = Math.max(dir.length(), 0.8)
      dir.normalize()
      // ใกล้จุดระเบิดโดนแรงกว่า แต่ไม่ให้พุ่งเกินจริงเพราะหารด้วยระยะตรง ๆ
      const k = (bodyNow.mass() * BLAST_FORCE) / dist
      bodyNow.applyImpulse({ x: dir.x * k, y: (dir.y + 1.1) * k, z: dir.z * k }, true)
      bodyNow.applyTorqueImpulse(
        {
          x: (hash(id, 1) - 0.5) * bodyNow.mass() * SPIN_FORCE,
          y: (hash(id, 2) - 0.5) * bodyNow.mass() * SPIN_FORCE,
          z: (hash(id, 3) - 0.5) * bodyNow.mass() * SPIN_FORCE,
        },
        true,
      )
    }

    if (phase !== 'rebuild') return
    const b = body.current
    const start = from.current
    const home = base.current
    if (!b || !start || !home) return

    clock.current += dt
    const span = REBUILD_TIME * (1 - delay)
    const local = easeInOut(
      THREE.MathUtils.clamp((clock.current - delay * REBUILD_TIME) / span, 0, 1),
    )

    const p = start.p.clone().lerp(home.p, local)
    // โค้งขึ้นระหว่างทาง — ของถูก "ยกกลับไปวาง" ไม่ใช่ไถไปกับพื้น
    p.y += Math.sin(local * Math.PI) * 1.1
    const q = start.q.clone().slerp(home.q, local)

    b.setNextKinematicTranslation(p)
    b.setNextKinematicRotation(q)
  })

  return (
    <RigidBody
      ref={body}
      type={phase === 'boom' ? 'dynamic' : phase === 'rebuild' ? 'kinematicPosition' : 'fixed'}
      colliders="hull"
      position={position}
      rotation={rotation}
      restitution={0.25}
      friction={0.9}
    >
      {children}
    </RigidBody>
  )
}

/**
 * โลกฟิสิกส์ที่ครอบฉากไว้
 *
 * pause ตอนฉากยังไม่ระเบิด — โลกที่ไม่ได้เดินไม่กิน CPU และของก็ไม่ไหลออกจากที่เอง
 */
export function HeroShatter({
  exploded,
  onRestored,
  children,
}: {
  exploded: boolean
  /** ยิงตอนประกอบฉากกลับครบแล้ว */
  onRestored?: () => void
  children: ReactNode
}) {
  const [phase, setPhase] = useState<ShatterPhase>('idle')

  useEffect(() => {
    if (exploded) {
      setPhase('boom')
      return
    }
    if (phase === 'idle') return

    setPhase('rebuild')
    const done = setTimeout(() => {
      setPhase('idle')
      onRestored?.()
    }, REBUILD_TIME * 1000)
    return () => clearTimeout(done)
    // phase ตั้งใจไม่อยู่ใน deps: ต้องการให้เอฟเฟกต์นี้วิ่งตามการกด explode/restore เท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploded])

  return (
    <PhaseCtx.Provider value={phase}>
      <Physics gravity={[0, -26, 0]} paused={phase === 'idle'}>
        {/* พื้นให้ของตกลงมากอง — บางและกว้างกว่าฉากเผื่อชิ้นที่กระเด็นไกล */}
        <CuboidCollider args={[40, 0.5, 40]} position={[0, -0.5, 0]} friction={0.9} />
        {children}
      </Physics>
    </PhaseCtx.Provider>
  )
}
