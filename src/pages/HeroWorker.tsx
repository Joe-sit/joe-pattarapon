import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Mascot } from '@/joespresso/scene/Mascot'

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
const VEST_BAND = '#ededf2'

export function Worker({
  scale = 1,
  rotation = [0, 0, 0],
}: {
  scale?: number
  rotation?: [number, number, number]
}) {
  const root = useRef<THREE.Group>(null)
  const gear = useRef<THREE.Object3D[]>([])

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
    const ws = whole.getSize(new THREE.Vector3())
    const wc = whole.getCenter(new THREE.Vector3())

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

    /* ── หมวกนิรภัย: โดม + ปีก + สันกลาง ───────────────────────────────── */
    const helmet = new THREE.Group()
    const r = hs.x * 0.56

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(HELMET),
    )
    dome.scale.y = 0.82
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.28, r * 1.28, r * 0.16, 22),
      mat(HELMET),
    )
    // ปีกยื่นไปข้างหน้ามากกว่าข้างหลัง เหมือนหมวกจริง
    brim.scale.z = 0.78
    brim.position.set(0, r * 0.06, -r * 0.16)
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(r * 0.26, r * 0.5, r * 1.7), mat(HELMET_DARK))
    ridge.position.y = r * 0.62
    helmet.add(dome, brim, ridge)
    for (const o of helmet.children) {
      o.castShadow = true
      o.receiveShadow = true
    }

    // นั่งคร่อมกลางหัว ยุบลงนิดหนึ่งให้ขอบหมวกกินขอบผม ไม่ลอยเป็นจานบิน
    placeWorld(
      helmet,
      head,
      new THREE.Vector3(hc.x, headBox.max.y - hs.y * 0.24, hc.z),
      head.getWorldQuaternion(new THREE.Quaternion()),
    )
    made.push(helmet)

    /* ── เสื้อกั๊ก: ปลอกครอบลำตัว + แถบสะท้อนแสงสองเส้น ─────────────────── */
    // ลำตัว = ใต้คางลงมาถึงราวสะโพก (ต่ำกว่านั้นเป็นขา)
    const torsoTop = headBox.min.y + hs.y * 0.04
    const torsoBottom = whole.min.y + ws.y * 0.46
    const torsoH = Math.max(torsoTop - torsoBottom, ws.y * 0.12)

    const vest = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(ws.x * 0.6, torsoH, ws.z * 0.82), mat(VEST))
    body.castShadow = body.receiveShadow = true
    vest.add(body)

    // แถบสะท้อนแสงพาดรอบตัว — สองเส้น เหลื่อมออกมาจากผิวเสื้อเล็กน้อยกัน z-fight
    for (const y of [torsoH * 0.16, -torsoH * 0.16]) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(ws.x * 0.615, torsoH * 0.12, ws.z * 0.84),
        mat(VEST_BAND),
      )
      band.position.y = y
      band.castShadow = true
      vest.add(band)
    }

    placeWorld(
      vest,
      g,
      new THREE.Vector3(wc.x, (torsoTop + torsoBottom) / 2, wc.z),
      // เสื้อหันไปทางเดียวกับลำตัว ไม่ใช่ตามหัวที่หันตามเมาส์
      (g.children[0] ?? g).getWorldQuaternion(new THREE.Quaternion()),
    )
    made.push(vest)

    gear.current = made
  }

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
      <Mascot scale={scale} rotation={rotation} isolated armsDown />
    </group>
  )
}
