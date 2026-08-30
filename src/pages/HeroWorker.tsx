import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Mascot } from '@/joespresso/scene/Mascot'
import { usePhase } from './HeroShatter'
import { idle } from './heroIdle'

/**
 * mascot ในชุดคนงานก่อสร้าง — หมวกนิรภัย + เสื้อกั๊กสะท้อนแสง
 *
 * ไม่แตะไฟล์ Mascot เลย: ตัวนั้นใช้ร่วมกับหน้า /2026 และ /joespresso ซึ่งไม่ควรใส่หมวก
 * ชุดจึงถูก "สวม" จากข้างนอกโดยวัดตัวจริงหลังโมเดลโหลดเสร็จ แล้วเอาไปผูกกับชิ้นส่วนของ
 * โมเดลโดยตรง:
 *
 *  - หมวกผูกเข้ากับ 'HeadGroup' (กลุ่มหัวที่ Mascot ประกอบไว้เอง) หัวหันตามเมาส์เมื่อไร
 *    หมวกก็หันตาม ไม่ต้องคำนวณซ้ำต่อเฟรม
 *  - เสื้อกั๊กผูกกับ root ของโมเดล วัดช่วงลำตัวจากกล่องขอบเขต "ทั้งตัวลบส่วนหัว"
 *
 * ทุกค่าที่วัดได้เป็นพิกัดโลก ต้องแปลงเป็นพิกัดของ parent ที่จะผูกก่อนเสมอ
 */

const HELMET = '#f4c400'
const HELMET_DARK = '#d9a800'
const VEST = '#ff6b1a'
const ALERT = '#ff3b30'

/** องศาที่ไหล่ถูกยกขึ้นตอนตกใจ (สุด) */
const PANIC_LIFT = 2.05

/**
 * บทของคนงานในฉากที่เดินเอง (ดู heroIdle)
 *
 *  boss     ยืนชี้สั่งงาน — แขนชี้ยกขึ้นค้าง แล้วกระตุกเป็นจังหวะเหมือนกำลังบอกให้ยกต่อ
 *  watcher  ยืนบนแล็ปท็อป หันไปดูจอแล้วหันกลับมาหาคนสั่ง
 *  climber  อยู่บนบันได ตกใจตามจังหวะที่เครนออกแรงยก
 *  none     ยืนเฉย ๆ ตามเดิม
 */
export type WorkerRole = 'none' | 'boss' | 'watcher' | 'climber'

/** มุมกางของแขนชี้ตอนสั่งงาน (เรเดียน) */
const BOSS_POINT = 1.15
/** หนึ่งรอบของการหันไปดูจอแล้วหันกลับ (วินาที) */
const WATCH_CYCLE = 7
/** มุมที่หันไปทางจอแล็ปท็อป */
const WATCH_YAW = -1.0

const smoothstep = (x: number) => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

/**
 * ระยะจาก "จุดกำเนิดของ GLB" ลงไปถึงฝ่าเท้า วัดเป็นหน่วยของโมเดล (คูณ scale เอง)
 *
 * จุดกำเนิดของโมเดลอยู่แถวหัว ไม่ใช่ที่เท้า วางที่ y=0 ตรง ๆ ตัวจะจมทั้งตัว ก่อนหน้านี้แก้ด้วย
 * การวัดกล่องขอบเขตแล้วเลื่อนใน effect (OnPlatform) แต่พอตัวละครกลายเป็น RigidBody
 * วิธีนั้นใช้ไม่ได้แล้ว — collider ถูกคิดตอน mount การขยับทีหลังทำให้กล่องชนไม่ตรงตัว
 * ค่านี้จึงเป็นค่าที่วัดมาแล้วครั้งเดียว (ทุก instance ให้ค่าเท่ากันเป๊ะ) ใส่ไว้ตั้งแต่ประกอบ
 */
const FEET_BELOW_ORIGIN = 4.9700493

/**
 * ท่าทางที่เขียนทับ Mascot ทุกเฟรม — ท่าตกใจ กับบทประจำตัวในฉากที่เดินเอง
 *
 * แยกเป็นคอมโพเนนต์ที่ถูกวางไว้ "หลัง" <Mascot> ในต้นไม้ เพราะ r3f เรียก useFrame ตามลำดับ
 * ที่สมัครไว้ ซึ่งไล่ตามลำดับของต้นไม้ ถ้าเขียนท่าไว้ใน Worker (ตัวแม่) Mascot จะทับกลับหมด
 */
function Poser({
  root,
  bang,
  markY,
  role,
}: {
  root: React.RefObject<THREE.Group | null>
  bang: React.RefObject<THREE.Object3D | null>
  markY: React.RefObject<number>
  role: WorkerRole
}) {
  const phase = usePhase()
  /** น้ำหนักท่าตกใจ 0..1 ไล่ขึ้น/ลงแบบนุ่ม ไม่ใช่สลับทันที */
  const panic = useRef(0)
  /** rig ของ Mascot (ไหล่/ศอก/ข้อมือ) — หาให้เจอครั้งเดียวแล้วจำไว้ */
  const rig = useRef<Record<string, THREE.Object3D | undefined> | null>(null)
  /** กลุ่มหัวของ Mascot — บทที่ต้องหันหน้าเองต้องเขียนทับทุกเฟรม */
  const head = useRef<THREE.Object3D | null>(null)

  useFrame(({ clock }, dt) => {
    // ตกใจตอนฉากกำลังจะพัง + (เฉพาะคนบนบันได) ตอนเครนออกแรงยกในฉากที่เดินเอง
    const target = Math.max(phase === 'panic' ? 1 : 0, role === 'climber' ? idle.alarm : 0)
    const k = 1 - Math.exp(-(target > panic.current ? 16 : 9) * dt)
    panic.current += (target - panic.current) * k

    const mark = bang.current
    if (mark) {
      mark.visible = panic.current > 0.01
      // เด้งเกินตัวนิดหนึ่งตอนโผล่ แล้วสั่นค้างไว้
      const t = performance.now() / 1000
      mark.scale.setScalar(panic.current * (1 + Math.sin(t * 22) * 0.08 * panic.current))
      mark.position.y = markY.current + Math.sin(t * 9) * 0.02 * panic.current
    }

    const acts = panic.current > 0.001 || (role !== 'none' && role !== 'climber' && idle.active > 0.01)
    if (!acts) return

    if (!rig.current && root.current) {
      // Mascot ฝาก rig ไว้ที่ userData ของโมเดล — หาโดยดูจาก userData ไม่ใช่เดาลำดับชั้น
      root.current.traverse((o) => {
        if (!rig.current && o.userData?.rig) rig.current = o.userData.rig
        if (!head.current && o.userData?.headGroup) head.current = o.userData.headGroup
      })
    }
    if (!rig.current) return

    if (panic.current > 0.001) {
      for (const key of ['pointShoulder', 'mugShoulder'] as const) {
        const sh = rig.current[key]
        if (!sh) continue
        const out = (sh.userData.outward as number | undefined) ?? 1
        // หมุนรอบแกน z ของลำตัว = กางแขนขึ้นด้านข้าง ทิศขึ้นกลับด้านตามข้างซ้าย/ขวา
        sh.quaternion.premultiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1),
            out * PANIC_LIFT * panic.current,
          ),
        )
      }
    }

    // ท่าตกใจกินสิทธิ์ก่อนบทประจำตัว — ฉากกำลังพัง ไม่มีใครยืนสั่งงานต่อ
    const w = idle.active * (1 - panic.current)
    if (w < 0.01) return
    const t = clock.elapsedTime

    if (role === 'boss') {
      // ใช้ไหล่ของ "แขนถือแก้ว" ไม่ใช่แขนชี้ — Mascot เขียน quaternion ของแขนชี้ใหม่ทุกเฟรม
      // จากท่าชี้ของมันเอง (slerp เข้าท่า tucked) ท่าที่เราใส่จึงถูกกลืนหายไปทั้งดุ้น
      const sh = rig.current.mugShoulder
      if (sh) {
        const out = (sh.userData.outward as number | undefined) ?? 1
        // ยกแขนขึ้นเฉียงหน้า แล้วกระตุกเป็นจังหวะ — สูงขึ้นอีกนิดตอนเครนกำลังยกของ
        const swing = BOSS_POINT + Math.sin(t * 2.2) * 0.14 + idle.lift * 0.3
        sh.quaternion
          .premultiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), out * swing * w),
          )
          .premultiply(
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0),
              (-0.45 + Math.sin(t * 2.2 + 0.6) * 0.1) * w,
            ),
          )
      }
    }

    if (role === 'watcher' && head.current) {
      // หันไปดูจอค้างไว้ครู่หนึ่ง แล้วหันกลับมาหาคนสั่ง — ไม่ใช่ส่ายไปมาเรื่อย ๆ
      const u = (t % WATCH_CYCLE) / WATCH_CYCLE
      const look = smoothstep((u - 0.08) / 0.14) - smoothstep((u - 0.52) / 0.16)
      head.current.rotation.y = head.current.rotation.y * (1 - w) + WATCH_YAW * look * w
    }
  })

  return null
}

export function Worker({
  scale = 1,
  rotation = [0, 0, 0],
  role = 'none',
}: {
  scale?: number
  rotation?: [number, number, number]
  role?: WorkerRole
}) {
  const root = useRef<THREE.Group>(null)
  const gear = useRef<THREE.Object3D[]>([])
  /** เครื่องหมายตกใจเหนือหัว — ซ่อนไว้จนกว่าฉากจะเข้าโหมด panic */
  const bang = useRef<THREE.Object3D | null>(null)
  /** ความสูงตั้งต้นของเครื่องหมาย ใช้เป็นฐานของการลอยขึ้นลง */
  const markY = useRef(0)

  /**
   * วัดตัวแล้วสวมชุด — ทำในเฟรมแรกที่ทุกอย่างเข้าที่แล้ว ไม่ใช่ใน useEffect
   *
   * effect ของลูกทำงานก่อน effect ของ parent เสมอ ตัวที่ถูกห่อด้วย OnPlatform (ซึ่งยกตัว
   * ให้เท้าแตะพื้นใน effect ของมันเอง) จึงยังไม่ถูกยกตอนที่ effect นี้ทำงาน ชุดเลยไปเกาะ
   * ท่าเก่าค้างอยู่ที่พื้น — วัดในเฟรมถัดไปได้ท่าจริงเสมอ
   */
  const fit = () => {
    const g = root.current
    if (!g || gear.current.length) return

    const head = g.getObjectByName('HeadGroup')
    if (!head) return

    g.updateMatrixWorld(true)
    const headBox = new THREE.Box3().setFromObject(head)
    const whole = new THREE.Box3().setFromObject(g)
    if (headBox.isEmpty() || whole.isEmpty()) return

    // ทำงานในพิกัดโลกทั้งหมด (ขนาดชิ้นงานก็เป็นหน่วยโลก) แล้วค่อยฝากเข้า parent ด้วย
    // placeWorld ข้างล่าง — แปลงเองทีละแกนแล้วพลาด เพราะโมเดลมีทั้ง scale ของ prop
    // การหมุนของ Chunk และจุดกำเนิดของ GLB ที่ไม่ได้อยู่ที่เท้า
    const hs = headBox.getSize(new THREE.Vector3())
    const hc = headBox.getCenter(new THREE.Vector3())

    /** วางวัตถุให้อยู่ที่ท่า "ในพิกัดโลก" ที่ต้องการ แล้วผูกเป็นลูกของ parent */
    const placeWorld = (o: THREE.Object3D, parent: THREE.Object3D, p: THREE.Vector3, q: THREE.Quaternion) => {
      parent.add(o)
      parent.updateMatrixWorld(true)
      const target = new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1))
      o.matrix.copy(new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(target))
      o.matrix.decompose(o.position, o.quaternion, o.scale)
    }

    const made: THREE.Object3D[] = []
    const mat = (color: string) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0 })

    /* ── หมวกนิรภัย ─────────────────────────────────────────────────────
     *
     * หมวกจริงมีสี่ส่วน: เปลือกโดม, สันเสริมความแข็งแรงที่พาดจากหน้าไปหลัง,
     * ปีกรอบหมวกที่ยื่นด้านหน้ามากกว่าด้านหลัง และขอบล่างที่หนากว่าเปลือก
     *
     * สันทำจาก "โดมที่ถูกบีบให้แบนในแกน x" ไม่ใช่กล่องยาว — กล่องเป็นแท่งตรงจึงลอยพ้น
     * ผิวโค้งของหมวกกลายเป็นเขา ส่วนโดมที่บีบแล้วยังโค้งตามเปลือกทุกจุด
     */
    const helmet = new THREE.Group()
    const r = hs.x * 0.46
    const shell = (radius: number) =>
      new THREE.SphereGeometry(radius, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2)

    const dome = new THREE.Mesh(shell(r), mat(HELMET))
    dome.scale.set(0.99, 1.1, 1)

    // ขอบล่างหนากว่าเปลือกนิดหนึ่ง เป็นเส้นแบ่งระหว่างเปลือกกับปีก
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.02, r * 1.02, r * 0.22, 24),
      mat(HELMET),
    )
    band.position.y = r * 0.1

    /**
     * ปีก: จานบางที่ยาวไปด้านหน้ามากกว่าด้านหลัง
     *
     * ด้านหน้าของโมเดลคือ -z (ทิศเดียวกับที่ Crew ใช้ชดเชย FACE_OFFSET) ปีกจึงเลื่อนไป
     * ทาง -z แล้วยืดในแกน z ให้เป็นวงรี ไม่ใช่จานกลมเท่ากันรอบตัว
     */
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.08, r * 1.15, r * 0.08, 28),
      mat(HELMET),
    )
    brim.scale.z = 1.12
    brim.position.set(0, r * 0.04, -r * 0.12)
    // ปีกลาดลงทางด้านหน้าเล็กน้อย หมวกจริงไม่ได้แบนขนานพื้น
    brim.rotation.x = -0.09

    helmet.add(dome, band, brim)

    // สันสามเส้น: กลางหนึ่ง ข้างสองข้างเอียงออกจากกลางหมวก
    for (const yaw of [-0.5, 0, 0.5]) {
      const rib = new THREE.Mesh(shell(r * 1.03), mat(HELMET_DARK))
      rib.scale.set(0.11, 1.02, 1)
      rib.rotation.y = yaw
      helmet.add(rib)
    }

    for (const o of helmet.children) {
      o.castShadow = true
      o.receiveShadow = true
    }

    // นั่งคร่อมกลางหัว ยุบลงให้ขอบหมวกกินขอบผม ไม่ลอยเป็นจานบิน
    placeWorld(
      helmet,
      head,
      new THREE.Vector3(hc.x, headBox.max.y - hs.y * 0.18, hc.z),
      head.getWorldQuaternion(new THREE.Quaternion()),
    )
    made.push(helmet)

    /* ── เครื่องหมายตกใจเหนือหัว ────────────────────────────────────────── */
    // ผูกกับ HeadGroup เหมือนหมวก จะได้ลอยตามหัวเสมอ ไม่ต้องคำนวณต่อเฟรม
    const mark = new THREE.Group()
    const bar = new THREE.Mesh(new THREE.BoxGeometry(r * 0.42, r * 1.1, r * 0.42), mat(ALERT))
    bar.position.y = r * 1.05
    const dot = new THREE.Mesh(new THREE.BoxGeometry(r * 0.42, r * 0.42, r * 0.42), mat(ALERT))
    dot.position.y = r * 0.04
    mark.add(bar, dot)
    for (const o of mark.children) o.castShadow = true
    mark.visible = false
    mark.scale.setScalar(0.001)
    // ผูกกับลำตัว ไม่ใช่ HeadGroup — หัวหันตามเมาส์ จุดที่ลอยสูงเหนือแกนหมุนจะถูกเหวี่ยง
    // ออกไปไกลจนเครื่องหมายไปโผล่ข้างตัว
    placeWorld(
      mark,
      g,
      new THREE.Vector3(hc.x, headBox.max.y + hs.y * 0.75, hc.z),
      g.getWorldQuaternion(new THREE.Quaternion()),
    )
    bang.current = mark
    markY.current = mark.position.y
    made.push(mark)

    /* ── เสื้อกั๊ก: ปลอกครอบลำตัวจริง ───────────────────────────────────── */
    /**
     * ต้องวัด "ลำตัว" ของจริง ไม่ใช่เดาจากกล่องครอบทั้งตัว
     *
     * กล่องทั้งตัวรวมแขนที่กางออกและขาที่แยกกัน ความกว้าง/ลึกที่ได้จึงไม่ใช่ของลำตัว
     * พอเอาไปคูณสัดส่วนมั่ว ๆ เสื้อเลยออกมาเป็นกล่องหนาผิดส่วน — ตัวลำตัวใน GLB เป็น mesh
     * สีเสื้อ (ครีม) ชิ้นที่ใหญ่ที่สุด หาเจอได้จากสีเหมือนที่ Mascot ใช้จำแนกชิ้นส่วน
     */
    const SHIRT = 'ede2cf'
    let torsoMesh: THREE.Mesh | undefined
    let torsoVol = 0
    g.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = (m.userData.clayFrom ?? m.material) as THREE.MeshStandardMaterial
      if (!src?.color || src.color.getHexString() !== SHIRT) return
      m.geometry.computeBoundingBox()
      const size = m.geometry.boundingBox!.getSize(new THREE.Vector3())
      const vol = size.x * size.y * size.z
      if (vol > torsoVol) {
        torsoVol = vol
        torsoMesh = m
      }
    })

    if (torsoMesh) {
      const shirt: THREE.Mesh = torsoMesh
      const torso = new THREE.Box3().setFromObject(shirt)
      const ts = torso.getSize(new THREE.Vector3())
      const tc = torso.getCenter(new THREE.Vector3())

      /**
       * เสื้อกั๊กเป็น "แผ่น" ไม่ใช่กล่องทึบ
       *
       * ในภาพอ้างอิงมันคือแผ่นหน้ากับแผ่นหลังที่คล้องบ่าไว้ ด้านข้างเปิดโล่งเห็นเสื้อข้างใน
       * และด้านหน้าผ่ากลางเป็นสองแผ่น กล่องทึบใบเดียวจึงผิดตั้งแต่รูปทรง ไม่ใช่แค่ขนาด
       */
      const vw = ts.x * 1.04
      const vh = ts.y * 1.02
      const vd = ts.z * 1.1
      /** ความหนาของแผ่นผ้า */
      const skin = ts.z * 0.1
      /** ช่องผ่าหน้าอก */
      const gap = vw * 0.1

      const vest = new THREE.Group()
      const panel = (w: number, h: number, x: number, y: number, z: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, skin), mat(VEST))
        m.position.set(x, y, z)
        m.castShadow = m.receiveShadow = true
        vest.add(m)
        return m
      }

      // แผ่นหลังเต็มผืน / แผ่นหน้าสองชิ้นเว้นร่องกลาง
      panel(vw, vh, 0, 0, -(vd - skin) / 2)
      const half = (vw - gap) / 2
      panel(half, vh, -(half + gap) / 2, 0, (vd - skin) / 2)
      panel(half, vh, (half + gap) / 2, 0, (vd - skin) / 2)

      // สายบ่าสองเส้นที่คล้องข้ามไหล่ เชื่อมแผ่นหน้ากับแผ่นหลัง
      for (const x of [-vw * 0.32, vw * 0.32]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(vw * 0.22, skin, vd), mat(VEST))
        strap.position.set(x, vh / 2 - skin / 2, 0)
        strap.castShadow = true
        vest.add(strap)
      }

      placeWorld(
        vest,
        g,
        // คล้องอยู่ช่วงบนของลำตัว ชายเสื้อจบเหนือเอว
        new THREE.Vector3(tc.x, tc.y - ts.y * 0.06, tc.z),
        // เสื้อหันไปทางเดียวกับลำตัว ไม่ใช่ตามหัวที่หันตามเมาส์
        shirt.getWorldQuaternion(new THREE.Quaternion()),
      )
      made.push(vest)
    }

    gear.current = made
  }

  // เฟรมแรกที่ทุกอย่างเข้าที่แล้วค่อยวัดตัวและสวมชุด
  useFrame(() => {
    if (!gear.current.length) fit()
  })

  // three ไม่เก็บกวาดให้เอง — ชุดถูกปั้นเองกับมือ ก็ต้องคืนเอง
  useEffect(
    () => () => {
      for (const o of gear.current) {
        o.traverse((c) => {
          const m = c as THREE.Mesh
          if (!m.isMesh) return
          m.geometry.dispose()
          const mm = m.material as THREE.Material | THREE.Material[]
          if (Array.isArray(mm)) for (const x of mm) x.dispose()
          else mm.dispose()
        })
        o.removeFromParent()
      }
      gear.current = []
    },
    [],
  )

  return (
    <group ref={root}>
      <group position={[0, FEET_BELOW_ORIGIN * scale, 0]}>
        <Mascot scale={scale} rotation={rotation} isolated armsDown />
      </group>
      {/* ต้องเป็น "พี่น้องที่อยู่หลัง" Mascot ไม่ใช่ใน Worker เอง — r3f เรียก useFrame ตามลำดับ
          ที่สมัคร ซึ่งไล่ตามลำดับของต้นไม้ ท่าที่เขียนก่อน Mascot จะถูก Mascot ทับทุกเฟรม */}
      <Poser root={root} bang={bang} markY={markY} role={role} />
    </group>
  )
}
