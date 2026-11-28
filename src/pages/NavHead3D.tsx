import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { FaviconScene, loadFaviconSettings } from './FaviconLab'
import { facePoseFromTuner } from '@/newhero/HeroRider'
import { getTuner } from '@/newhero/tuner'

/**
 * หัวตัวละคร 3D ในวงความคืบหน้าของแถบนำทาง (ProgressHead) — ฉากเดียวกับ favicon (FaviconScene + ค่าที่จูนใน /favicon-lab)
 *
 * หัวมองปลายวง (แบบภาพ ref toss): ลูกตาเลื่อนไปทางปลายวงเป็นหลัก หน้าเบนตามนิดเดียว
 *   ปลายวงอยู่มุม a (12 นาฬิกา ตามเข็ม) → ซ้าย/ขวาตาม sin a · บน/ล่างตาม cos a
 * หมุนที่ HeadGroup ของริกจริง (คอบิด ไม่ใช่หมุนทั้งตัว/หมุนกล้อง) — Mascot เขียนมุมหัวแบบค่าสัมบูรณ์ทุกเฟรมที่ priority 0
 * ที่นี่บวกมุมมองทับหลังจากนั้น (priority 0.5) ก่อน CameraFX วาดภาพ (priority 1)
 *
 * วาดเฉพาะตอนต้องวาด (frameloop demand): ระยะเลื่อนเปลี่ยน → invalidate → หัวหน่วงเข้าหามุมใหม่จนนิ่งแล้วหยุดวาด
 * วาดที่ 512 px แบบหน้า lab แล้วย่อด้วย CSS — เส้นแสง/echo เป็นหน่วยพิกเซลแคนวาส (ดู FastworkHead3D)
 */
const LAB = 512
const YAW = 0.12
const PITCH = 0.08
/** ริกตั้งหัวก้มอยู่แล้ว — เงยชดเชยให้ท่ากลางมองตรงกล้อง */
const BASE_PITCH = 0
const ROLL = 0.05
/** สีชิ้นตาดำของ GLB (HEX.eye ใน Mascot) */
const EYE_HEX = '262424'
/** สีผิว (HEX.skin) — ชิ้นผิวใหญ่สุดใต้ HeadGroup = กล่องหัว */
const SKIN_HEX = 'efb49b'
/** ตาดำเลื่อนได้แค่ไหน (สัดส่วนของระยะที่ยังอยู่ในตาขาว) */
const EYE_REACH = 0.9

type FacePose = ReturnType<typeof facePoseFromTuner>
/** หัวกินวงแค่ไหน (1 = ทรงกลมคลุมหัวชนขอบภาพ) */
const FIT = 0.62
/** เล็งสูงกว่ากลางกล่องหัว (สัดส่วนรัศมี) — หัวลงไปอยู่ค่อนล่างของวง */
const DROP = 0.08

export type HeadLook = { p: number; kick: (() => void) | null }

const BOX = new THREE.Box3()
const SPH = new THREE.Sphere()
const EA = new THREE.Vector3()
const EB = new THREE.Vector3()

function Looker({ look, face }: { look: HeadLook; face: FacePose }) {
  const base = useRef({ x: face.pupilX, y: face.pupilY })
  const invalidate = useThree((t) => t.invalidate)
  const head = useRef<THREE.Object3D | null>(null)
  const st = useRef({ yaw: 0, pitch: 0, ex: 0, ey: 0, warm: 0 })
  useLayoutEffect(() => {
    look.kick = invalidate
    invalidate()
    return () => {
      look.kick = null
    }
  }, [look, invalidate])
  const aim = useRef<{ c: THREE.Vector3; r: number; dir: THREE.Vector3; up: THREE.Vector3 } | null>(null)
  useFrame(({ scene, camera }, dt) => {
    const s = st.current
    if (!head.current) {
      scene.traverse((o) => {
        if (o.name === 'HeadGroup') head.current = o
      })
      /* เอาแค่หัว: ซ่อนทุกชิ้นของตัวละครที่ไม่อยู่ใต้ HeadGroup (แบบ FastworkHead3D) */
      const hg = head.current as THREE.Object3D | null
      if (hg) {
        const keep = new Set<THREE.Object3D>()
        hg.traverse((o) => keep.add(o))
        let root: THREE.Object3D = hg
        while (root.parent && root.parent.type !== 'Scene') root = root.parent
        root.traverse((o) => {
          if ((o as THREE.Mesh).isMesh && !keep.has(o)) o.visible = false
        })
      }
    }
    const a = look.p * Math.PI * 2
    const ty = Math.sin(a) * YAW
    const tp = BASE_PITCH - Math.cos(a) * PITCH
    const k = 1 - Math.exp(-dt * 9)
    s.yaw += (ty - s.yaw) * k
    s.pitch += (tp - s.pitch) * k
    const h = head.current
    /*
     * กรอบกล้อง: ตั้งฉากกับหน้ากล่องหัวเป๊ะ (วัดครั้งเดียวตอนหัวยังอยู่ท่าตั้งต้น)
     *   กล่องหัว = ชิ้นผิวที่ใหญ่สุดใต้ HeadGroup (วิธีเดียวกับ Mascot) — แกนของมันคือแกนหน้าจริง
     *   (HeadGroup / ชิ้นตา / ทิศกลางหัว→ตา มีมุมเพี้ยนจากกล่องหัวทั้งหมด หน้าจึงเฉียง)
     *   ด้านหน้า = แกนกล่องที่ชี้ไปทางตา · ขึ้น = แกน Y ของกล่อง (ไม่ให้หน้าเอียง) · เล็งกลางกล่องหัว
     */
    if (h && !aim.current && s.warm > 8) {
      let box: THREE.Mesh | null = null
      let vol = 0
      const mid = new THREE.Vector3()
      let n = 0
      h.traverse((o) => {
        const mesh = o as THREE.Mesh
        const m = mesh.material as THREE.MeshStandardMaterial | undefined
        if (!mesh.isMesh || !m || Array.isArray(m)) return
        const hex = m.color?.getHexString()
        if (hex === EYE_HEX) {
          mid.add(o.getWorldPosition(EA))
          n++
        } else if (hex === SKIN_HEX) {
          mesh.geometry.computeBoundingBox()
          const sz = mesh.geometry.boundingBox!.getSize(EB)
          if (sz.x * sz.y * sz.z > vol) {
            vol = sz.x * sz.y * sz.z
            box = mesh
          }
        }
      })
      const hm = box as THREE.Mesh | null
      if (hm && n) {
        hm.updateWorldMatrix(true, false)
        const c = hm.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(hm.matrixWorld)
        const q = hm.getWorldQuaternion(new THREE.Quaternion())
        const fd = mid.multiplyScalar(1 / n).sub(c).applyQuaternion(q.clone().invert())
        const ax = Math.abs(fd.x)
        const ay = Math.abs(fd.y)
        const az = Math.abs(fd.z)
        if (ax >= ay && ax >= az) fd.set(Math.sign(fd.x), 0, 0)
        else if (az >= ay) fd.set(0, 0, Math.sign(fd.z))
        else fd.set(0, Math.sign(fd.y), 0)
        BOX.setFromObject(h)
        aim.current = {
          c,
          r: BOX.getBoundingSphere(SPH).radius,
          dir: fd.applyQuaternion(q).normalize(),
          up: new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize(),
        }
      }
    }
    const f = aim.current
    if (f) {
      const pc = camera as THREE.PerspectiveCamera
      const d = (f.r * FIT) / Math.sin(((pc.fov * Math.PI) / 180) / 2)
      EA.copy(f.c).addScaledVector(f.up, f.r * DROP)
      camera.position.copy(EA).addScaledVector(f.dir, d)
      camera.up.copy(f.up)
      camera.lookAt(EA)
    }
    if (h) {
      h.rotation.y += s.yaw
      h.rotation.x += s.pitch
      h.rotation.z -= (s.yaw / YAW) * ROLL
    }
    /*
     * ลูกตา: ตัวหลักของการมอง — หน้าการ์ตูนแบบ hero (Mascot วาดหน้าลง canvas ทุกเฟรมจาก facePose)
     * เลื่อนตาดำ (pupilX/Y) ไปทางปลายวง เต็มระยะที่ตาดำยังอยู่ในตาขาว (Mascot หนีบไว้อีกชั้น)
     */
    s.ex += (Math.sin(a) - s.ex) * k
    s.ey += (Math.cos(a) - s.ey) * k
    const room = face.eye * (1 - Math.min(0.95, face.pupil)) * EYE_REACH
    face.pupilX = base.current.x + s.ex * room
    face.pupilY = base.current.y + s.ey * room
    /* ยังไม่นิ่ง (หรือโมเดลเพิ่งโหลด) = วาดต่อ */
    if (!f || s.warm < 40 || Math.abs(ty - s.yaw) + Math.abs(tp - s.pitch) + Math.abs(Math.sin(a) - s.ex) + Math.abs(Math.cos(a) - s.ey) > 1e-3) invalidate()
    s.warm++
  }, 0.5)
  return null
}

export function NavHead3D({ look, className }: { look: HeadLook; className?: string }) {
  const s = useMemo(() => {
    const v = loadFaviconSettings()
    /*
     * ไม่เอาเงาซ้อน (echo) — หัวเปล่า ๆ บนพื้นขาวเรียบ (สีเดียวกับวงใน .v3-nav-head)
     * หัวตั้งตรงหน้ากล้องเป๊ะ (ไม่เอามุมเฉียงของ favicon) — หันไปทางไหนอ่านออกทันทีว่ามองปลายวง (แบบภาพ ref)
     */
    return { ...v, colors: [...v.colors], echoN: 0, bgMode: 0, bg: '#ffffff', yaw: 0, pitch: 0, roll: 0, bodyYaw: 0, headYaw: 0, headPitch: 0, headRoll: 0 }
  }, [])
  /* หน้าเดียวกับ hero (ค่าจูนเดียวกัน) · ไม่กวาดตา/ไม่กระพริบ — Looker เขียนตำแหน่งตาดำเอง */
  const face = useMemo(() => facePoseFromTuner(getTuner(), true), [])
  const inner = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = inner.current
    const box = el?.parentElement
    if (!el || !box) return
    const fit = () => el.style.setProperty('--k', String(box.offsetWidth / LAB))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])
  return (
    <div className={className} aria-hidden>
      <div ref={inner} style={{ width: LAB, height: LAB, transform: 'scale(var(--k))', transformOrigin: '0 0' }}>
        <Canvas frameloop="demand" resize={{ offsetSize: true }} dpr={1} gl={{ antialias: true }} camera={{ fov: s.fov, near: 0.05, far: 60 }}>
          <FaviconScene s={s} face={face} />
          <Looker look={look} face={face} />
        </Canvas>
      </div>
    </div>
  )
}
