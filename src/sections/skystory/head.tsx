import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/**
 * หัวตัวละครตัวเดียวกับ hero — ดึงเฉพาะชิ้นหัวจาก /mascot.glb (ไฟล์เดียวกับที่ Mascot ใช้)
 *
 * GLB ไม่มีชื่อ node จึงแยกชิ้นด้วยสีแบบเดียวกับ Mascot.jsx: ผิว (ชิ้นใหญ่สุด = หัว) ผม จอน ตา
 * ตาใน GLB ฝังลึกกว่าผิวหน้า — ดันออกตามแนวหน้าเหมือนที่ Mascot ทำ ไม่งั้นมองไม่เห็นตา
 * ผลลัพธ์จัดกึ่งกลาง สูงราว 1 หน่วยโลก
 */
const HEX = { hair: '232224', eye: '262424', skin: 'efb49b' }

const hexOf = (m: THREE.Mesh) => {
  const mat = m.material as THREE.MeshStandardMaterial
  return mat?.color ? mat.color.getHexString() : ''
}

export function CharacterHead() {
  const { scene } = useGLTF('/mascot.glb')
  const head = useMemo(() => {
    const src = scene.clone(true)
    src.updateMatrixWorld(true)
    let skin: THREE.Mesh | null = null
    let vol = 0
    const hair: THREE.Mesh[] = []
    const eyes: THREE.Mesh[] = []
    const size = new THREE.Vector3()
    src.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.geometry.computeBoundingBox()
      m.geometry.boundingBox?.getSize(size)
      const hex = hexOf(m)
      if (hex === HEX.eye) eyes.push(m)
      else if (hex === HEX.hair) hair.push(m)
      else if (hex === HEX.skin) {
        const v = size.x * size.y * size.z
        if (v > vol) {
          vol = v
          skin = m
        }
      }
    })
    const g = new THREE.Group()
    const parts = [skin, ...hair, ...eyes].filter(Boolean) as THREE.Mesh[]
    /* ย้ายชิ้นหัวออกมาเป็นกลุ่มใหม่ คงตำแหน่งโลก — ส่วนที่เหลือของตัวทิ้งไป */
    parts.forEach((p) => {
      const c = p.clone()
      c.material = (p.material as THREE.Material).clone()
      p.matrixWorld.decompose(c.position, c.quaternion, c.scale)
      g.add(c)
    })
    const box = new THREE.Box3().setFromObject(g)
    const center = box.getCenter(new THREE.Vector3())
    const headSize = box.getSize(new THREE.Vector3())
    /* ดันตาออกมาพ้นผิวหน้า (แนวราบจากกลางหัว) */
    g.children.forEach((c) => {
      const m = c as THREE.Mesh
      if (hexOf(m) !== HEX.eye) return
      const n = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).sub(center).setY(0).normalize()
      m.position.addScaledVector(n, 0.05)
    })
    const k = 1 / Math.max(headSize.x, headSize.y, headSize.z)
    g.children.forEach((c) => {
      c.position.sub(center).multiplyScalar(k)
      c.scale.multiplyScalar(k)
    })
    return g
  }, [scene])
  return <primitive object={head} />
}

useGLTF.preload('/mascot.glb')
