import { useMemo } from 'react'
import * as THREE from 'three'
import { useDisposable } from '@/joespresso/scene/utils'

/**
 * ถาดสีของฉาก hero — แยกออกมาเป็นโมดูลของตัวเอง
 *
 * จอ "สิ่งที่ทำ" ใช้ถาดใบเดียวกันเป็นของประดับหัวข้อ Design ถ้า import จาก NewHeroScene
 * ก้อนโค้ดทั้งฉาก hero จะถูกลากไปด้วยทั้งก้อน — จอนั้นโหลดฉากของตัวเองอยู่แล้ว
 */

/**
 * จานสีของจิตรกร — แผ่นรูปไข่เบี้ยว เว้าเข้าตรงที่มือจับ มีรูสอดนิ้วโป้ง และก้อนสีหกก้อน
 *
 * วงรีธรรมดาไม่ใช่ถาดสี: ถาดสีอ่านออกจาก "ความไม่สมมาตร" — ด้านที่กว้างกลม (ที่วางสี)
 * กับด้านที่สอบเข้าและเว้ารับอุ้งมือ ทั้งคู่หายไปทันทีถ้าใช้วงรี เหลือแค่แผ่นกลมมีจุด
 * เส้นรอบรูปจึงเขียนเป็นเบซิเยร์ทีละช่วง ไม่ใช่ absellipse ช่วงเดียวจบ
 *
 * รูเป็น hole ของ Shape ไม่ใช่ทรงกระบอกที่เอามาลบ: ExtrudeGeometry ลบมุมให้เองพร้อมกับ
 * ขอบนอกในครั้งเดียว ขอบรูจึงมนเท่ากับขอบจานโดยไม่ต้องทำ CSG ซึ่งฉากนี้ไม่มี
 *
 * ก้อนสีเป็นทรงกลมกดแบน วางจมลงไปครึ่งก้อน — สีที่บีบลงบนจานมันนูนไม่เท่ากันและไม่มีขอบคม
 * และเรียงตามส่วนโค้งด้านกว้าง ไม่ใช่กระจายทั่วแผ่น (ที่ว่างกลางถาดคือที่ผสมสี)
 */
const PALETTE_BLOBS = [
  { x: 0.04, y: 0.6, r: 0.15, c: '#3ec9a7' },
  { x: 0.5, y: 0.46, r: 0.14, c: '#8f6ef0' },
  { x: 0.78, y: 0.08, r: 0.15, c: '#f5c53d' },
  { x: 0.7, y: -0.36, r: 0.14, c: '#4f7df9' },
  { x: -0.42, y: 0.5, r: 0.14, c: '#ef5aa7' },
  { x: 0.24, y: -0.5, r: 0.15, c: '#4fbe6e' },
]

function paletteShape() {
  const s = new THREE.Shape()
  // ด้านกว้าง: ขวา -> อ้อมยอด -> ซ้ายบน
  s.moveTo(1.04, 0.02)
  s.bezierCurveTo(1.04, 0.62, 0.66, 0.95, 0.16, 0.95)
  s.bezierCurveTo(-0.3, 0.95, -0.62, 0.87, -0.82, 0.6)
  // ด้านสอบ: ซ้ายบน -> ซ้ายล่าง
  s.bezierCurveTo(-1.0, 0.36, -1.02, 0.02, -0.9, -0.2)
  // เว้ารับอุ้งมือ — จุดควบคุมอยู่ "ในเนื้อ" เส้นจึงแอ่นเข้า ไม่ใช่ป่องออกเหมือนช่วงอื่น
  s.bezierCurveTo(-0.72, -0.4, -0.66, -0.28, -0.42, -0.42)
  // ก้นถาด: กลับออกไปทางขวาแล้วปิดวง
  s.bezierCurveTo(-0.12, -0.6, 0.24, -0.78, 0.56, -0.74)
  s.bezierCurveTo(0.88, -0.7, 1.04, -0.44, 1.04, 0.02)
  // รูนิ้วโป้ง: อยู่ในช่วงที่ถาดสอบเข้า ใกล้รอยเว้า ไม่ใช่กลางแผ่น
  const hole = new THREE.Path()
  hole.absellipse(-0.5, 0.06, 0.21, 0.17, 0, Math.PI * 2, true, 0)
  s.holes.push(hole)
  return s
}

export function Palette({ tint = '#f7f5ef', ...props }) {
  const body = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(paletteShape(), {
      depth: 0.15,
      bevelEnabled: true,
      bevelThickness: 0.075,
      bevelSize: 0.075,
      bevelSegments: 4,
      curveSegments: 48,
    })
    g.center()
    return g
  }, [])
  useDisposable(body)
  return (
    <group {...props}>
      <mesh geometry={body}>
        <meshStandardMaterial color={tint} roughness={0.72} />
      </mesh>
      {PALETTE_BLOBS.map((b) => (
        <mesh key={b.c} position={[b.x, b.y, 0.14]} scale={[1, 1, 0.42]}>
          <sphereGeometry args={[b.r, 20, 14]} />
          <meshStandardMaterial color={b.c} roughness={0.45} />
        </mesh>
      ))}
    </group>
  )
}
