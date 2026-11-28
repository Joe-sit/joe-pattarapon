import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const MODEL = '/models/cartoon-keyboard.glb'

/**
 * คีย์บอร์ดการ์ตูนบนแท่นไอโซของจอแรก — โมเดลสำเร็จ (GLB) ไม่ใช่ของที่ปั้นในโค้ด
 *
 * ไฟล์มาจาก Sketchfab จึงเป็น "ฉากถ่ายแบบ" ทั้งฉาก ไม่ใช่คีย์บอร์ดเปล่า ๆ: มีฉากหลัง 19 หน่วย
 * (ใหญ่กว่าแท่นทั้งแท่น) พรม โคมไฟ ตัวหนังสือ กล้องและไฟของฉากต้นทางติดมาด้วย เอามาทั้งก้อน
 * แล้วได้ผนังสีน้ำตาลบังจอโดยที่คีย์บอร์ดจิ๋วอยู่กลาง — ตรงนี้จึงถอด "ฉาก" ออกทีละโหนด แล้ว
 * เก็บที่เหลือไว้ทั้งหมด (ตัวเครื่อง ปุ่ม ตัวอักษรบนปุ่ม และสายที่ขดอยู่ ซึ่งแยกกันคนละโหนด
 * — เลือกแบบ "เก็บเฉพาะตัวเครื่อง" แล้วสายกับตัวอักษรหายไปด้วย)
 *
 * ขนาดกับจุดกำเนิดในไฟล์เป็นของผู้ทำโมเดล ไม่ใช่หน่วยของฉากนี้ — normalize เองด้วยการวัด
 * กล่องขอบเขตจริงแล้วย่อให้กว้างเท่าที่สั่ง วางก้นให้แตะ y=0 พอดี ค่า scale ในแผงดีบักจึงเป็น
 * ตัวคูณจากขนาดที่ "พอดีแล้ว" ไม่ใช่ตัวเลขสุ่มของไฟล์
 */

export function HeroKeyboard({
  position,
  rotation = [0, 0, 0],
  /** ความกว้างที่ต้องการในหน่วยฉาก — โมเดลถูกย่อให้เท่านี้เสมอ ไม่ว่าไฟล์จะมาขนาดไหน */
  width = 3.4,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  width?: number
}) {
  const { scene } = useGLTF(MODEL)

  const model = useMemo(() => {
    const root = scene.clone(true)

    // ชื่อโหนดถูกทำให้ปลอดภัยตอนโหลด (Cube.002 -> Cube002) เทียบแบบ startsWith จึงพอ
    // Plane = ฉากหลัง 19 หน่วย, Circle = พรม, Light base = โคมไฟ — ของฉากถ่ายแบบทั้งนั้น
    const SCENERY = ['Plane', 'Circle', 'Light base', 'Lightbase', 'Camera']
    const junk: THREE.Object3D[] = []
    root.traverse((o) => {
      const scenery = SCENERY.some((n) => o.name.startsWith(n))
      if (scenery || (o as THREE.Light).isLight || (o as THREE.Camera).isCamera) junk.push(o)
    })
    for (const o of junk) o.removeFromParent()

    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })

    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const k = width / Math.max(size.x, size.z, 0.001)
    root.scale.setScalar(k)

    // วัดซ้ำหลังย่อ แล้วจัดให้กึ่งกลางอยู่ที่แกน และก้นแตะระนาบของแท่น
    const fitted = new THREE.Box3().setFromObject(root)
    const mid = fitted.getCenter(new THREE.Vector3())
    root.position.set(-mid.x, -fitted.min.y, -mid.z)

    return root
  }, [scene, width])

  // clone ถือ geometry/material ชุดเดียวกับต้นฉบับที่ useGLTF แคชไว้ — dispose ที่นี่จะไปพัง
  // ตัวที่แคช ปล่อยให้ drei จัดการ ที่ต้องคืนเองคือกลุ่มที่เราสร้าง (ไม่มี resource ของตัวเอง)
  useEffect(
    () => () => {
      model.clear()
    },
    [model],
  )

  return (
    <group position={position} rotation={rotation}>
      <primitive object={model} />
    </group>
  )
}

useGLTF.preload(MODEL)
