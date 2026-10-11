import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { HeroRider } from '@/newhero/HeroRider'
import { aboutClip, aboutLens } from './aboutBox'


/**
 * ตัวละครทั้งตัวของ hero ในหน้า About me — ตัวเดียวกับ hero (แขน lumberjack ลมพัดเสื้อ ท่าหายใจ) แต่ยืนท่าปกติ ไม่มีบอร์ด จัดกึ่งกลาง สูง 1 หน่วย
 * โบกมือด้วยแขนข้างชี้ของริก: ท่าของริกถูกเขียนใหม่ทุกเฟรม (Mascot) ตัวโบกจึงต้องทับ *หลัง* มัน —
 * ไม่ mount ตัวโบกจนกว่าจะหาแขนเจอ การสมัครลูปวาดของมันจึงมาทีหลังของริกแน่ ๆ
 *
 * wave = น้ำหนักโบก (0 = แขนห้อย, 1 = ยกโบกเต็ม) · look = น้ำหนักท่าส่องกล้องสองตา (ยกสองมือถือกล้องไว้หน้าตา)
 * อ่านจาก ref ทุกเฟรม
 *
 * ครึ่งตัว: หน่วยความสูง 1 = จากเอวถึงเหนือหัว (เผื่อแขนที่ยกโบก) ขาห้อยเลยลงไปข้างล่าง ให้ขอบกรอบตัดทิ้ง
 */
/** ช่วงที่นับเป็น "ครึ่งตัว" — สัดส่วนความสูงทั้งตัววัดจากหัวลงมา และส่วนเผื่อเหนือหัว */
const HALF = 0.55
const ABOVE = 0.14
type Rig = { pointS: THREE.Object3D; pointE: THREE.Object3D; mugS: THREE.Object3D; mugE: THREE.Object3D; head: THREE.Object3D }

export function AboutBody({ wave, look }: { wave: React.RefObject<number>; look: React.RefObject<number> }) {
  const fit = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const box = useRef(new THREE.Box3())
  const mid = useRef(new THREE.Vector3())
  const settle = useRef(30)
  const [rig, setRig] = useState<Rig | null>(null)
  const sweep = useRef(0)
  const face = useRef<THREE.Object3D | null>(null)
  useFrame(() => {
    const f = fit.current
    const b = body.current
    if (!f || !b) return
    /*
     * วัสดุของตัวละครใช้ร่วมกับตัวใน hero (GLB โคลนแล้วแชร์วัสดุ) — hero ตั้ง stencil ให้ตัวมันตอนอยู่ในพอร์ทัล
     * (ดู Entrance) ตัวนี้เลยติด stencil ไปด้วยแล้วหายทั้งตัว · ปิด stencil เฉพาะตอนวาดตัวนี้ แล้วคืนค่าเดิมหลังวาด
     * ไม่โคลนวัสดุ (ริกยังเขียนค่าวัสดุชุดเดิมทุกเฟรม) · กวาดหาชิ้นใหม่เป็นระยะ (แขน lumberjack แขวนทีหลัง)
     */
    /* สีหน้าจากแบบ Figma (Joe Space 1576:3863) — ริกวาดชิ้นหน้าตามตำแหน่งหน้าใน hero (ดู drawFigmaFace ใน Mascot) */
    if (!face.current?.parent) {
      face.current = b.getObjectByName('FacePlane') ?? null
      if (face.current) face.current.userData.faceStyle = 'figma'
    }
    if (sweep.current-- <= 0) {
      sweep.current = 30
      b.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || m.userData.aboutNoStencil) return
        m.userData.aboutNoStencil = true
        const saved: { st: boolean; cl: THREE.Plane[] | null }[] = []
        m.onBeforeRender = (...args) => {
          const mat = args[4] as THREE.Material
          saved.push({ st: mat.stencilWrite, cl: mat.clippingPlanes })
          mat.stencilWrite = false
          /* ระนาบตัดของเรื่องโผล่จากฟอง (ดู AboutFigure) — เฉพาะตัวละคร */
          mat.clippingPlanes = aboutClip.planes.length ? aboutClip.planes : null
        }
        m.onAfterRender = (...args) => {
          const mat = args[4] as THREE.Material
          const v = saved.pop()
          if (v) {
            mat.stencilWrite = v.st
            mat.clippingPlanes = v.cl
          }
        }
      })
    }
    if (!rig) {
      const pointS = b.getObjectByName('PointShoulder')
      const pointE = b.getObjectByName('PointElbow')
      const mugS = b.getObjectByName('MugShoulder')
      const mugE = b.getObjectByName('MugElbow')
      const head = b.getObjectByName('HeadGroup')
      if (pointS && pointE && mugS && mugE && head) setRig({ pointS, pointE, mugS, mugE, head })
    }
    /* วัดตัวเองหลังโหลดสองสามเฟรม (ริกจัดท่าเสร็จ) แล้วย่อให้สูง 1 กลางที่ 0 */
    if (settle.current <= 0) return
    settle.current -= 1
    f.scale.setScalar(1)
    f.position.set(0, 0, 0)
    f.updateWorldMatrix(true, true)
    const parent = f.parent
    const inv = parent ? new THREE.Matrix4().copy(parent.matrixWorld).invert() : new THREE.Matrix4()
    const bb = box.current.setFromObject(b).applyMatrix4(inv)
    const h = bb.max.y - bb.min.y
    if (h <= 0) return
    bb.getCenter(mid.current)
    const lo = bb.max.y - HALF * h
    const hi = bb.max.y + ABOVE * h
    const s = 1 / (hi - lo)
    f.scale.setScalar(s)
    f.position.set(-mid.current.x * s, -((lo + hi) / 2) * s, -mid.current.z * s)
  })
  return (
    <group ref={fit}>
      <group ref={body}>
        <HeroRider stand noBoard />
      </group>
      {rig && <Pose rig={rig} wave={wave} look={look} />}
    </group>
  )
}

const Q = new THREE.Quaternion()
const XAXIS = new THREE.Vector3(1, 0, 0)
const ZAXIS = new THREE.Vector3(0, 0, 1)

/**
 * ทับท่าของริกหลังมันเขียนเสร็จทุกเฟรม (mount ทีหลังริก ลูปจึงรันทีหลัง):
 * โบก = แขนข้างชี้ยกออกข้างเหนือไหล่ ศอกแกว่ง · ส่องกล้อง = สองแขนยกไปข้างหน้าระดับตา ศอกพับเข้าหาหน้า
 * กล้องสองตาแขวนไว้ที่หน้า (ลูกของกลุ่มหัว) หันตามหัว
 */
function Pose({ rig, wave, look }: { rig: Rig; wave: React.RefObject<number>; look: React.RefObject<number> }) {
  const binoc = useRef<THREE.Group | null>(null)
  useEffect(() => {
    /* วัดหัวในพิกัดของมันเอง: กว้าง และทิศหน้า (จากกลางหัวไปหาตาเดิมของ GLB) */
    const head = rig.head
    head.updateWorldMatrix(true, true)
    const inv = new THREE.Matrix4().copy(head.matrixWorld).invert()
    const hb = new THREE.Box3().setFromObject(head).applyMatrix4(inv)
    const hc = hb.getCenter(new THREE.Vector3())
    const hs = hb.getSize(new THREE.Vector3())
    const eye = new THREE.Vector3()
    let n = 0
    head.traverse((o) => {
      const m = o as THREE.Mesh
      const mat = m.material as THREE.MeshStandardMaterial | undefined
      if (!m.isMesh || mat?.color?.getHexString() !== '262424') return
      eye.add(new THREE.Box3().setFromObject(m).applyMatrix4(inv).getCenter(new THREE.Vector3()))
      n += 1
    })
    const fwd = n ? eye.multiplyScalar(1 / n).sub(hc).setY(0).normalize() : new THREE.Vector3(0, 0, 1)
    if (Math.abs(fwd.x) > Math.abs(fwd.z)) fwd.set(Math.sign(fwd.x), 0, 0)
    else fwd.set(0, 0, Math.sign(fwd.z))
    const w = Math.max(hs.x, hs.z)
    const depth = fwd.x !== 0 ? hs.x : hs.z
    /* กล้องสองตา: กระบอกดำคู่ ปลายเลนส์ฟ้า สะพานกลาง — ยาวตามทิศหน้า */
    const g = new THREE.Group()
    const barrel = new THREE.MeshStandardMaterial({ color: '#1d1f2b', roughness: 0.45, metalness: 0.2 })
    const lens = new THREE.MeshStandardMaterial({ color: '#7fb6ff', roughness: 0.15, metalness: 0.3, emissive: '#3d7cff', emissiveIntensity: 0.4 })
    const r = w * 0.15
    const len = w * 0.55
    const tube = new THREE.CylinderGeometry(r, r * 0.86, len, 24)
    tube.rotateX(Math.PI / 2)
    const cap = new THREE.CylinderGeometry(r * 0.78, r * 0.78, len * 0.04, 24)
    cap.rotateX(Math.PI / 2)
    const bridge = new THREE.BoxGeometry(w * 0.2, r * 0.7, len * 0.3)
    for (const side of [-1, 1]) {
      const t = new THREE.Mesh(tube, barrel)
      t.position.set(side * w * 0.2, 0, len / 2)
      g.add(t)
      const c = new THREE.Mesh(cap, lens)
      c.position.set(side * w * 0.2, 0, len + len * 0.02)
      g.add(c)
    }
    g.add(new THREE.Mesh(bridge, barrel))
    /* จุดกึ่งกลางระหว่างเลนส์หน้าสองข้าง — ปลายลำแสง */
    const tip = new THREE.Object3D()
    tip.position.set(0, 0, len * 1.05)
    g.add(tip)
    aboutLens.obj = tip
    /* ตั้งให้แกน +z ของกล้องชี้ไปทางหน้า วางที่ผิวหน้าระดับตา */
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd)
    g.position.copy(hc).addScaledVector(fwd, depth / 2 + w * 0.02).add(new THREE.Vector3(0, hs.y * 0.02, 0))
    g.visible = false
    head.add(g)
    binoc.current = g
    return () => {
      g.removeFromParent()
      if (aboutLens.obj === tip) aboutLens.obj = null
      ;[tube, cap, bridge].forEach((x) => x.dispose())
      ;[barrel, lens].forEach((x) => x.dispose())
    }
  }, [rig])

  useFrame(({ clock }) => {
    const wv = wave.current ?? 0
    const lk = look.current ?? 0
    const bn = binoc.current
    if (bn) {
      bn.visible = lk > 0.01
      bn.scale.setScalar(Math.max(1e-3, Math.min(1, lk * 1.4)))
    }
    if (wv > 0.001) {
      const out = (rig.pointS.userData.outward as number | undefined) ?? 1
      rig.pointS.quaternion.premultiply(Q.setFromAxisAngle(ZAXIS, out * 2.5 * wv))
      const swing = Math.sin(clock.elapsedTime * 9) * 0.45
      rig.pointE.rotation.z += out * (0.5 + swing) * wv
    }
    if (lk > 0.001) {
      for (const [s, e] of [
        [rig.pointS, rig.pointE],
        [rig.mugS, rig.mugE],
      ] as const) {
        const out = (s.userData.outward as number | undefined) ?? 1
        /* ยกไปข้างหน้า (รอบแกน x ของตัว) แล้วหุบเข้าหากลาง */
        s.quaternion.premultiply(Q.setFromAxisAngle(XAXIS, -1.55 * lk)).premultiply(Q.setFromAxisAngle(ZAXIS, -out * 0.35 * lk))
        e.rotation.x -= 1.1 * lk
      }
    }
  })
  return null
}
