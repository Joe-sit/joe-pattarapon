import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { editor, useEditorRev } from './HeroEditor'

/**
 * ระเบิดฉากด้วยฟิสิกส์จริง (rapier) แล้วให้ "ทีมงาน" เดินไปประกอบคืนเอง
 *
 * ทุกชิ้นบนสุดของ diorama ถูกห่อด้วย <Chunk> ซึ่งเป็น RigidBody ตัวหนึ่ง สามสถานะ:
 *
 *  idle    — type "fixed" ฉากนิ่งสนิท และ Physics ถูก pause ไว้ (ไม่กิน CPU)
 *  boom    — type "dynamic" + ยิง impulse ออกจากจุดระเบิดครั้งเดียว จากนั้นปล่อยให้ rapier
 *            คิดเอง: แรงโน้มถ่วง การหมุน การกระแทกพื้น การชนกันเอง
 *  rebuild — type "kinematicPosition" ทั้งหมด แล้ว <Crew> เป็นคนสั่งท่าทุกชิ้นต่อเฟรม
 *
 * ขากลับไม่ใช่การย้อนเทปของขาไป: mascot ลุกขึ้นยืน เดินไปหาของทีละชิ้น ยกขึ้นเหนือหัว
 * แบกไปวางที่เดิม แล้วค่อยไปเอาชิ้นถัดไป หมดคิวแล้วจึงเดินกลับไปยืนที่ของตัวเอง
 * (ดู Crew ท้ายไฟล์ — ตรรกะการเดินอยู่ที่นั่นทั้งหมด)
 */

export type ShatterPhase = 'idle' | 'panic' | 'boom' | 'rebuild'

const PhaseCtx = createContext<ShatterPhase>('idle')

/** สถานะฉากปัจจุบัน — ตัวละครใช้อ่านเพื่อทำท่าตกใจก่อนระเบิด */
export function usePhase() {
  return useContext(PhaseCtx)
}

/** ทะเบียนชิ้นส่วนทั้งฉาก — Crew สั่งงานผ่านตัวนี้ */
type Entry = {
  id: number
  mascot: boolean
  body: RapierRigidBody
  /** ท่าตั้งต้นในพิกัดโลก (อ่านตอนก่อนระเบิด) */
  base: () => { p: THREE.Vector3; q: THREE.Quaternion } | null
}
type Registry = Map<number, Entry>
const RegistryCtx = createContext<Registry | null>(null)

/** จุดศูนย์กลางแรงระเบิด — ใต้กลางฐานแล็ปท็อปนิดหน่อย ของจะได้กระเด็นขึ้น ไม่ใช่ปัดออกข้าง */
const BLAST = new THREE.Vector3(1.2, -0.6, 0.6)
const BLAST_FORCE = 15
const SPIN_FORCE = 2.6

function hash(i: number, seed: number) {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

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
  name,
  children,
}: {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** true = เป็นคนงาน ไม่ใช่ของ — ตอนประกอบฉากคืน ตัวนี้จะเป็นคนไปยกของ */
  mascot?: boolean
  /** ชื่อที่โผล่ในแผงจัดฉากโหมด dev */
  name?: string
  children: ReactNode
}) {
  const phase = useContext(PhaseCtx)
  const registry = useContext(RegistryCtx)
  const body = useRef<RapierRigidBody>(null)
  // ลำดับคงที่ต่อชิ้น ใช้สุ่มแรงระเบิด — ไม่ใช่ Math.random ต่อเฟรม ไม่งั้นชิ้นจะสั่น
  const id = useMemo(() => CHUNK_SEQ++, [])

  /**
   * ท่าตั้งต้นในพิกัดโลก
   *
   * ห้ามใช้ค่า position/rotation ที่เขียนใน JSX ตรง ๆ — นั่นเป็นพิกัดใน group ของฉาก
   * ซึ่งถูกเลื่อนไปแล้ว ส่วน API ของ rapier คิดเป็นพิกัดโลกล้วน เอาค่า local ไปใส่ =
   * ฉากทั้งฉากเลื่อนหลุดตอนประกอบกลับ จึงอ่านจากตัว body เองตอน "ก่อนระเบิด" — ตอนนั้น
   * โลกฟิสิกส์ยัง pause และ rapier วางทุกชิ้นตามลำดับชั้นของ three เรียบร้อยแล้ว
   */
  const base = useRef<{ p: THREE.Vector3; q: THREE.Quaternion } | null>(null)

  /**
   * จุดอ้างอิงถาวรสำหรับโหมดจัดฉาก — ตำแหน่งโลกตอนฉากยังไม่ถูกแตะ
   *
   * ต่างจาก base ตรงที่ base คือ "บ้าน" ที่อัปเดตได้ (ลากแล้วบ้านย้ายตาม) ส่วนตัวนี้ตรึงไว้
   * เพื่อคำนวณย้อนกลับเป็นพิกัดแบบที่เขียนใน JSX ถ้าใช้ base ตัวเดียวกัน ค่าที่รายงานจะเป็น
   * ศูนย์เสมอ เพราะมันถูกอัปเดตไปพร้อมกันก่อนคำนวณ
   */
  const origin = useRef<THREE.Vector3 | null>(null)
  /**
   * quaternion ของ parent ในพิกัดโลก — ใช้แปลงการหมุนที่ลากได้กลับเป็นค่าแบบที่เขียนใน JSX
   *
   * API ของ rapier คิดเป็นพิกัดโลกล้วน ส่วน rotation ที่เขียนใน JSX เป็นของ local
   * world = parent * local จึงถอด parent ออกจากท่าเริ่มต้นเก็บไว้ครั้งเดียว
   */
  const parentQ = useRef<THREE.Quaternion | null>(null)

  const capture = () => {
    const b = body.current
    if (!b || base.current) return
    const t = b.translation()
    const r = b.rotation()
    base.current = {
      p: new THREE.Vector3(t.x, t.y, t.z),
      q: new THREE.Quaternion(r.x, r.y, r.z, r.w),
    }
    if (!origin.current) origin.current = new THREE.Vector3(t.x, t.y, t.z)
    if (!parentQ.current) {
      const local = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotation[0], rotation[1], rotation[2]),
      )
      parentQ.current = base.current.q.clone().multiply(local.invert())
    }
  }

  /** ค้างไว้ว่าต้อง "ยิงแรงระเบิด" — ยิงในเฟรมถัดไป ไม่ใช่ใน effect */
  const pending = useRef(false)

  useEffect(() => {
    const b = body.current
    if (!b || !registry) return
    registry.set(id, { id, mascot, body: b, base: () => base.current })
    return () => {
      registry.delete(id)
    }
  }, [id, mascot, registry])

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

    if (phase === 'idle' && base.current) {
      // จบท่าแล้ว วางกลับให้ตรงเป๊ะ ไม่ปล่อยให้ค้างคลาดจากการเดินไปวาง
      b.setTranslation(base.current.p, true)
      b.setRotation(base.current.q, true)
      b.setLinvel({ x: 0, y: 0, z: 0 }, true)
      b.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, id])

  useFrame(() => {
    const b = body.current
    if (!pending.current || !b || b.bodyType() !== 0) return
    pending.current = false
    b.wakeUp()
    const t = b.translation()
    const dir = new THREE.Vector3(t.x, t.y, t.z).sub(BLAST)
    const dist = Math.max(dir.length(), 0.8)
    dir.normalize()
    // ใกล้จุดระเบิดโดนแรงกว่า แต่ไม่ให้พุ่งเกินจริงเพราะหารด้วยระยะตรง ๆ
    const k = (b.mass() * BLAST_FORCE) / dist
    b.applyImpulse({ x: dir.x * k, y: (dir.y + 1.1) * k, z: dir.z * k }, true)
    b.applyTorqueImpulse(
      {
        x: (hash(id, 1) - 0.5) * b.mass() * SPIN_FORCE,
        y: (hash(id, 2) - 0.5) * b.mass() * SPIN_FORCE,
        z: (hash(id, 3) - 0.5) * b.mass() * SPIN_FORCE,
      },
      true,
    )
  })

  /* ── โหมดจัดฉาก (dev): ลากชิ้นนี้ไปวางที่อื่นได้ ───────────────────────── */
  // อ่านเวอร์ชันของสโตร์ไว้ เพื่อให้ชิ้นนี้วาดใหม่ตอนสลับเข้า/ออกโหมดจัดฉาก
  useEditorRev()
  // ซูมของกล้อง ortho = พิกเซลต่อหนึ่งหน่วยฉาก ใช้แปลงระยะเมาส์แนวตั้งเป็นความสูงจริง
  const zoom = useThree((st) => (st.camera as THREE.OrthographicCamera).zoom)
  const camera = useThree((st) => st.camera)
  const gl = useThree((st) => st.gl)

  /** แปลงตำแหน่งโลกปัจจุบันกลับเป็นพิกัดแบบที่เขียนใน JSX แล้วรายงานเข้าแผง */
  const reportLocal = () => {
    const b = body.current
    if (!b || !name) return
    const t = b.translation()
    const start = origin.current
    if (!start) return
    const r = b.rotation()
    const local = parentQ.current
      ? new THREE.Quaternion(r.x, r.y, r.z, r.w).premultiply(parentQ.current.clone().invert())
      : new THREE.Quaternion(r.x, r.y, r.z, r.w)
    const e = new THREE.Euler().setFromQuaternion(local)
    editor.report(id, {
      name,
      position: [
        position[0] + (t.x - start.x),
        position[1] + (t.y - start.y),
        position[2] + (t.z - start.z),
      ],
      rotation: [e.x, e.y, e.z],
    })
  }

  const editProps = editor.editing
    ? {
        onPointerDown: (e: import('@react-three/fiber').ThreeEvent<PointerEvent>) => {
          const b = body.current
          if (!b) return
          e.stopPropagation()
          capture()
          editor.select(id)

          const t0 = b.translation()
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -t0.y)
          const hit = new THREE.Vector3()
          e.ray.intersectPlane(plane, hit)
          const grab = hit.clone().sub(new THREE.Vector3(t0.x, t0.y, t0.z))
          const vertical = e.nativeEvent.shiftKey
          // Alt = หมุน/เอียงแทนการย้าย — ลากซ้ายขวาคือ yaw รอบแกนตั้งของโลก
          // ลากขึ้นลงคือเอียงรอบแกน "ขวามือของกล้อง" ซึ่งเป็นแกนที่ตรงกับสายตาในมุม iso
          const turning = e.nativeEvent.altKey
          const startY = t0.y
          const clientY = e.nativeEvent.clientY
          const clientX = e.nativeEvent.clientX
          const r0 = b.rotation()
          const startQ = new THREE.Quaternion(r0.x, r0.y, r0.z, r0.w)
          const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize()

          // ต้องฟังที่ window ไม่ใช่ onPointerMove ของวัตถุ — เหตุการณ์ของ r3f ยิงเฉพาะตอน
          // เคอร์เซอร์ยังอยู่บนตัววัตถุ พอลากเร็ว ๆ จนหลุดออกนอกทรง มันจะหยุดตามทันที
          // (อาการคือคลิกติดแต่ของไม่ขยับ)
          const canvas = gl.domElement
          const ndc = new THREE.Vector2()
          const ray = new THREE.Raycaster()

          const onMove = (ev: PointerEvent) => {
            const bb = body.current
            if (!bb) return
            const t = bb.translation()
            if (turning) {
              const yaw = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                (ev.clientX - clientX) * 0.01,
              )
              const tilt = new THREE.Quaternion().setFromAxisAngle(
                camRight,
                (ev.clientY - clientY) * 0.01,
              )
              bb.setRotation(startQ.clone().premultiply(tilt).premultiply(yaw), true)
              return
            }
            if (vertical) {
              // Shift = ยกขึ้น/กดลง แทนการไถลบนพื้น (ซูมของกล้อง ortho = พิกเซลต่อหน่วยฉาก)
              bb.setTranslation({ x: t.x, y: startY + (clientY - ev.clientY) / zoom, z: t.z }, true)
              return
            }
            const r = canvas.getBoundingClientRect()
            ndc.set(
              ((ev.clientX - r.left) / r.width) * 2 - 1,
              -((ev.clientY - r.top) / r.height) * 2 + 1,
            )
            ray.setFromCamera(ndc, camera)
            const p = new THREE.Vector3()
            if (!ray.ray.intersectPlane(plane, p)) return
            p.sub(grab)
            bb.setTranslation({ x: p.x, y: t.y, z: p.z }, true)
          }

          const onUp = () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            const bb = body.current
            if (!bb) return
            // ที่ใหม่กลายเป็น "ที่ของมัน" — ไม่งั้นพอระเบิดแล้วประกอบคืน ของจะกลับไปจุดเดิมก่อนลาก
            const t = bb.translation()
            const r = bb.rotation()
            base.current = {
              p: new THREE.Vector3(t.x, t.y, t.z),
              q: new THREE.Quaternion(r.x, r.y, r.z, r.w),
            }
            reportLocal()
          }

          window.addEventListener('pointermove', onMove)
          window.addEventListener('pointerup', onUp)
        },
      }
    : {}

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
      <group {...editProps}>{children}</group>
    </RigidBody>
  )
}

/* ── ทีมงานที่เดินไปประกอบฉากคืน ─────────────────────────────────────────── */

const WALK_SPEED = 9
/** ระยะที่ถือว่า "ถึงแล้ว" */
const REACH = 1.1
/** สูงจากหัวคนงานที่ของถูกยกไว้ตอนแบก */
const CARRY_Y = 2.2
const RISE_TIME = 0.45
const LIFT_TIME = 0.22
const PLACE_TIME = 0.26
/** ระดับพื้นที่คนงานเดิน */
const GROUND_Y = 0
/**
 * ชดเชยทิศหน้าของโมเดล
 *
 * yaw ที่คำนวณจากทิศเดินคือ atan2(dx, dz) ซึ่งถือว่า "หน้า" ของโมเดลคือ +Z แต่ GLB ตัวนี้
 * ไม่ใช่ ค่านี้คือส่วนต่างที่วัดจากภาพจริง
 */
const FACE_OFFSET = Math.PI

type Job = {
  entry: Entry
  home: { p: THREE.Vector3; q: THREE.Quaternion }
}

type Stage = 'rise' | 'toPiece' | 'lift' | 'carry' | 'place' | 'goHome' | 'land' | 'done'

type Hand = {
  entry: Entry
  home: { p: THREE.Vector3; q: THREE.Quaternion }
  jobs: Job[]
  at: number
  stage: Stage
  /** นาฬิกาของท่าที่กำลังทำ (ท่าที่กินเวลาคงที่) */
  t: number
  pos: THREE.Vector3
  yaw: number
  /** ท่าตั้งต้นของช่วงที่ต้อง lerp (ลุกขึ้น / ก้มยก / วางลง / กลับเข้าที่) */
  from: THREE.Quaternion
  fromP: THREE.Vector3
  /** ท่าของของที่กำลังแบก ตอนเริ่มยก */
  cargoFrom: { p: THREE.Vector3; q: THREE.Quaternion } | null
  /** เดินมาแล้วกี่วินาที ใช้ทำจังหวะย่ำเท้า */
  step: number
}

const upright = (yaw: number) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'))

const yawOf = (q: THREE.Quaternion) => {
  const e = new THREE.Euler().setFromQuaternion(q, 'YXZ')
  return e.y
}

/**
 * ตัวคุมท่าทั้งฉากระหว่างประกอบคืน
 *
 * แบ่งของให้คนงานคนละกอง (คนที่อยู่ใกล้ของชิ้นนั้นที่สุดและยังถือคิวน้อยกว่าเพื่อน) แล้วเดิน
 * state machine ให้ทีละคน ทุกคนทำงานขนานกัน — ฉากจึงประกอบเสร็จเร็วกว่าไล่ทีละชิ้นมาก
 */
function Crew({ phase, onDone }: { phase: ShatterPhase; onDone: () => void }) {
  const registry = useContext(RegistryCtx)
  const hands = useRef<Hand[]>([])
  const leftovers = useRef<Job[]>([])
  const finished = useRef(false)
  /**
   * แผนงานถูกวางแล้วหรือยัง
   *
   * เฟรมของ r3f วิ่งบน rAF ส่วน useEffect ถูกเลื่อนไปหลัง commit — มีเฟรมที่ phase เป็น
   * 'rebuild' แล้วแต่ยังไม่มีใครแบ่งงาน ถ้าไม่กันไว้ ลูปจะเห็นทีมงานเป็นศูนย์คน แล้วสรุปว่า
   * "ประกอบเสร็จแล้ว" ตั้งแต่เฟรมแรก (อาการคือกด Restore แล้วฉากสแนปกลับทันที)
   */
  const planned = useRef(false)

  useEffect(() => {
    if (phase !== 'rebuild' || !registry) {
      hands.current = []
      leftovers.current = []
      finished.current = false
      planned.current = false
      return
    }

    const all = [...registry.values()].filter((e) => e.base())
    const workers = all.filter((e) => e.mascot)
    const items = all.filter((e) => !e.mascot)

    const posOf = (e: Entry) => {
      const t = e.body.translation()
      return new THREE.Vector3(t.x, t.y, t.z)
    }
    const rotOf = (e: Entry) => {
      const r = e.body.rotation()
      return new THREE.Quaternion(r.x, r.y, r.z, r.w)
    }

    hands.current = workers.map((e) => {
      const p = posOf(e)
      return {
        entry: e,
        home: e.base()!,
        jobs: [],
        at: 0,
        stage: 'rise' as Stage,
        t: 0,
        pos: new THREE.Vector3(p.x, GROUND_Y, p.z),
        yaw: yawOf(rotOf(e)),
        from: rotOf(e),
        fromP: p,
        cargoFrom: null,
        step: 0,
      }
    })

    // แบ่งงาน: ไล่ของจากชิ้นที่ไกลจากกลางฉากที่สุดก่อน (ชิ้นที่ปลิวไกลจะได้ไม่ค้างท้ายแถว)
    // ให้คนที่ใกล้ที่สุดในบรรดาคนที่คิวสั้นสุด — คิวจึงยาวใกล้เคียงกัน ไม่มีใครนั่งว่าง
    const sorted = items
      .map((e) => ({ e, d: posOf(e).lengthSq() }))
      .sort((a, b) => b.d - a.d)
      .map((x) => x.e)

    if (hands.current.length === 0) {
      leftovers.current = sorted.map((e) => ({ entry: e, home: e.base()! }))
    } else {
      for (const item of sorted) {
        const p = posOf(item)
        const shortest = Math.min(...hands.current.map((h) => h.jobs.length))
        const pool = hands.current.filter((h) => h.jobs.length === shortest)
        let best = pool[0]
        let bestD = Infinity
        for (const h of pool) {
          const last = h.jobs.length ? h.jobs[h.jobs.length - 1].home.p : h.pos
          const d = last.distanceToSquared(p)
          if (d < bestD) {
            bestD = d
            best = h
          }
        }
        best.jobs.push({ entry: item, home: item.base()! })
      }
    }

    finished.current = false
    planned.current = true
  }, [phase, registry])

  useFrame((_, rawDt) => {
    if (phase !== 'rebuild' || !planned.current || finished.current) return
    const dt = Math.min(rawDt, 0.05)
    const crew = hands.current

    // ไม่มีคนงานเหลือ (ทุกคนถูกถอดออกจากฉาก) — วางของกลับเองแบบเรียบ ๆ ดีกว่าค้างกลางอากาศ
    if (!crew.length) {
      let moving = false
      for (const job of leftovers.current) {
        const t = job.entry.body.translation()
        const p = new THREE.Vector3(t.x, t.y, t.z)
        if (p.distanceTo(job.home.p) > 0.02) moving = true
        job.entry.body.setNextKinematicTranslation(p.lerp(job.home.p, 1 - Math.pow(0.001, dt)))
        job.entry.body.setNextKinematicRotation(job.home.q)
      }
      if (!moving) {
        finished.current = true
        onDone()
      }
      return
    }

    let allDone = true

    for (const h of crew) {
      if (h.stage !== 'done') allDone = false
      const body = h.entry.body

      /** เดินเข้าหาเป้าบนระนาบพื้น คืน true เมื่อถึงแล้ว */
      const walkTo = (target: THREE.Vector3) => {
        const to = new THREE.Vector3(target.x - h.pos.x, 0, target.z - h.pos.z)
        const dist = to.length()
        // เผื่อ epsilon: ก้าวสุดท้ายถูกคลampไว้ที่ (dist - REACH) พอดี ความคลาดของ float
        // ทำให้ระยะค้างที่ REACH + 1e-7 ตลอด แล้วคนงานจะย่ำอยู่กับที่ไม่ถึงเป้าสักที
        if (dist > REACH + 0.02) {
          to.divideScalar(dist)
          h.pos.addScaledVector(to, Math.min(WALK_SPEED * dt, dist - REACH))
          h.step += dt
          // หันหน้าไปทางที่เดิน — หมุนแบบไล่ตาม ไม่ใช่สแนป จะได้ไม่กระตุกตอนเลี้ยว
          const want = Math.atan2(to.x, to.z) + FACE_OFFSET
          let diff = ((want - h.yaw + Math.PI) % (Math.PI * 2)) - Math.PI
          if (diff < -Math.PI) diff += Math.PI * 2
          h.yaw += diff * Math.min(1, dt * 9)
          return false
        }
        return true
      }

      /** ย่ำเท้า: เด้งขึ้นลงเบา ๆ + โคลงตัวซ้ายขวา (โมเดลไม่มีกระดูกขา ใช้จังหวะแทน) */
      const stride = () => {
        const bob = Math.abs(Math.sin(h.step * 11)) * 0.14
        const tilt = Math.sin(h.step * 11) * 0.07
        body.setNextKinematicTranslation({ x: h.pos.x, y: GROUND_Y + bob, z: h.pos.z })
        body.setNextKinematicRotation(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, h.yaw, tilt, 'YXZ')),
        )
      }

      const job = h.jobs[h.at]

      switch (h.stage) {
        case 'rise': {
          // ลุกจากท่าที่ล้มอยู่ขึ้นมายืน
          h.t += dt
          const k = Math.min(h.t / RISE_TIME, 1)
          const e = k * k * (3 - 2 * k)
          body.setNextKinematicTranslation({
            x: THREE.MathUtils.lerp(h.fromP.x, h.pos.x, e),
            y: THREE.MathUtils.lerp(h.fromP.y, GROUND_Y, e),
            z: THREE.MathUtils.lerp(h.fromP.z, h.pos.z, e),
          })
          body.setNextKinematicRotation(h.from.clone().slerp(upright(h.yaw), e))
          if (k === 1) {
            h.t = 0
            h.stage = h.jobs.length ? 'toPiece' : 'goHome'
          }
          break
        }

        case 'toPiece': {
          if (!job) {
            h.stage = 'goHome'
            break
          }
          const t = job.entry.body.translation()
          if (walkTo(new THREE.Vector3(t.x, 0, t.z))) {
            h.t = 0
            const r = job.entry.body.rotation()
            h.cargoFrom = {
              p: new THREE.Vector3(t.x, t.y, t.z),
              q: new THREE.Quaternion(r.x, r.y, r.z, r.w),
            }
            h.stage = 'lift'
          } else stride()
          break
        }

        case 'lift': {
          // ก้มยกของขึ้นเหนือหัว — ของลอยจากที่มันนอนอยู่ขึ้นมาอยู่บนมือ
          h.t += dt
          const k = Math.min(h.t / LIFT_TIME, 1)
          const e = k * k * (3 - 2 * k)
          const target = new THREE.Vector3(h.pos.x, GROUND_Y + CARRY_Y, h.pos.z)
          job!.entry.body.setNextKinematicTranslation(h.cargoFrom!.p.clone().lerp(target, e))
          job!.entry.body.setNextKinematicRotation(h.cargoFrom!.q.clone().slerp(job!.home.q, e))
          body.setNextKinematicTranslation({ x: h.pos.x, y: GROUND_Y, z: h.pos.z })
          // ย่อตัวลงนิดหนึ่งตอนยก แล้วยืดกลับ
          body.setNextKinematicRotation(
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(Math.sin(k * Math.PI) * 0.22, h.yaw, 0, 'YXZ'),
            ),
          )
          if (k === 1) {
            h.t = 0
            h.stage = 'carry'
          }
          break
        }

        case 'carry': {
          const arrived = walkTo(job!.home.p)
          stride()
          // ของลอยตามอยู่เหนือหัวตลอดทาง
          job!.entry.body.setNextKinematicTranslation({
            x: h.pos.x,
            y: GROUND_Y + CARRY_Y,
            z: h.pos.z,
          })
          job!.entry.body.setNextKinematicRotation(job!.home.q)
          if (arrived) {
            h.t = 0
            h.cargoFrom = {
              p: new THREE.Vector3(h.pos.x, GROUND_Y + CARRY_Y, h.pos.z),
              q: job!.home.q.clone(),
            }
            h.stage = 'place'
          }
          break
        }

        case 'place': {
          h.t += dt
          const k = Math.min(h.t / PLACE_TIME, 1)
          const e = k * k * (3 - 2 * k)
          job!.entry.body.setNextKinematicTranslation(h.cargoFrom!.p.clone().lerp(job!.home.p, e))
          job!.entry.body.setNextKinematicRotation(job!.home.q)
          body.setNextKinematicTranslation({ x: h.pos.x, y: GROUND_Y, z: h.pos.z })
          body.setNextKinematicRotation(upright(h.yaw))
          if (k === 1) {
            h.t = 0
            h.at += 1
            h.stage = h.at < h.jobs.length ? 'toPiece' : 'goHome'
          }
          break
        }

        case 'goHome': {
          if (walkTo(h.home.p)) {
            h.t = 0
            h.fromP = new THREE.Vector3(h.pos.x, GROUND_Y, h.pos.z)
            h.from = upright(h.yaw)
            h.stage = 'land'
          } else stride()
          break
        }

        case 'land': {
          // ขึ้นไปยืนที่ของตัวเอง — บางคนยืนบนฐานแล็ปท็อปหรือขอบฝาจอ จึงต้องยกขึ้นเป็นเส้นโค้ง
          h.t += dt
          const k = Math.min(h.t / 0.55, 1)
          const e = k * k * (3 - 2 * k)
          const p = h.fromP.clone().lerp(h.home.p, e)
          p.y += Math.sin(e * Math.PI) * 0.5
          body.setNextKinematicTranslation(p)
          body.setNextKinematicRotation(h.from.clone().slerp(h.home.q, e))
          if (k === 1) h.stage = 'done'
          break
        }

        case 'done':
          body.setNextKinematicTranslation(h.home.p)
          body.setNextKinematicRotation(h.home.q)
          break
      }
    }

    if (allDone) {
      finished.current = true
      onDone()
    }
  })

  return null
}

/**
 * โลกฟิสิกส์ที่ครอบฉากไว้
 *
 * pause ตอนฉากยังไม่ระเบิด — โลกที่ไม่ได้เดินไม่กิน CPU และของก็ไม่ไหลออกจากที่เอง
 */
/** ระยะเวลาท่าตกใจก่อนฉากระเบิด */
const PANIC_MS = 900

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
  const registry = useMemo<Registry>(() => new Map(), [])
  // โหมดจัดฉากต้องให้โลกฟิสิกส์เดิน ไม่งั้น setTranslation ไม่ถูกซิงก์กลับมาที่วัตถุของ three
  // (ทุกชิ้นเป็น fixed อยู่แล้ว โลกที่เดินอยู่จึงไม่มีอะไรตกหล่นเอง)
  useEditorRev()

  /**
   * กดปุ่มแล้วยังไม่ระเบิดทันที — ตัวละครต้องทันตกใจก่อน
   *
   * ช่วง 'panic' ทุกชิ้นยังเป็น fixed เหมือน idle ฉากจึงนิ่งสนิท มีแต่ตัวละครที่ยกมือขึ้น
   * และเครื่องหมายตกใจเด้งเหนือหัว (ดู Worker) ครบเวลาแล้วค่อยสลับเป็น boom
   */
  useEffect(() => {
    if (!exploded) {
      setPhase((p) => (p === 'idle' ? 'idle' : 'rebuild'))
      return
    }
    setPhase('panic')
    const t = setTimeout(() => setPhase('boom'), PANIC_MS)
    return () => clearTimeout(t)
  }, [exploded])


  return (
    <PhaseCtx.Provider value={phase}>
      <RegistryCtx.Provider value={registry}>
        <Physics gravity={[0, -26, 0]} paused={phase === 'idle' && !editor.editing}>
          {/* พื้นให้ของตกลงมากอง — บางและกว้างกว่าฉากเผื่อชิ้นที่กระเด็นไกล */}
          <CuboidCollider args={[40, 0.5, 40]} position={[0, -0.5, 0]} friction={0.9} />
          <Crew
            phase={phase}
            onDone={() => {
              setPhase('idle')
              onRestored?.()
            }}
          />
          {children}
        </Physics>
      </RegistryCtx.Provider>
    </PhaseCtx.Provider>
  )
}
