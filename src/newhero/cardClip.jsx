import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { heroView } from './heroView'

/**
 * ตัดของในกิ่งให้อยู่ในกรอบการ์ดของ hero แบบการ์ด (ดู ./heroView) — ด้วย scissor ต่อชิ้น
 *
 * ตาม ref creativecruise.nl: ของที่อยู่ *หลัง* การ์ด (หน้าต่าง ฉากในหน้าต่าง) ถูกขอบการ์ดตัด
 * เหลือแต่ของชั้นหน้าที่ยื่นออกมานอกการ์ด การ์ดจึงอ่านเป็นกล่องที่มีแผ่นโผล่ออกมาด้านหน้า
 * ไม่ใช่ภาพที่ล้นขอบไปทุกทิศ
 *
 * ขอบบนเปิด: ของยืนอยู่บนการ์ดแล้วโผล่ทะลุขอบบนได้ (ท่าเดียวกับซุ้ม เรือ ตึกใน ref) ส่วนซ้าย
 * ขวา ล่างตัดเรียบ
 *
 * open="bottom" = เปิดขอบล่างด้วย (ตัดแค่ซ้าย/ขวา) — แผ่นถนนชั้นหน้าไหลพ้นขอบล่างของการ์ด
 * ออกมาหาคนดูได้ เหมือนแผ่นที่ยื่นออกมาจากหน้าการ์ด
 *
 * scissor ต้องเขียนผ่าน renderer.state (ไม่ใช่ gl.scissor ตรง ๆ) แคชสถานะของ three จึงตรงกับ
 * GPU และตั้ง/ปลดรอบวาดของแต่ละชิ้นเอง (onBeforeRender/onAfterRender) ชิ้นอื่นจึงไม่โดนตัดตาม
 * ผ้าใบวาดลงบัฟเฟอร์ของ CameraFX ก่อน พิกัดจึงคิดจากขนาดบัฟเฟอร์ที่ผูกอยู่จริงตอนวาด
 */
const box = new THREE.Vector4()

function clipOn(renderer) {
  if (!heroView.on) return
  const target = renderer.getRenderTarget()
  const el = renderer.domElement
  const cssW = Math.max(1, el.clientWidth)
  const cssH = Math.max(1, el.clientHeight)
  const W = target ? target.width : el.width
  const H = target ? target.height : el.height
  const sx = W / cssW
  const sy = H / cssH
  const top = 0
  const bottom = this.userData.cardOpen === 'bottom' ? cssH : heroView.y + heroView.h
  /* แกน y ของ scissor นับจากล่างขึ้นบน */
  box.set(heroView.x * sx, (cssH - bottom) * sy, heroView.w * sx, (bottom - top) * sy)
  renderer.state.scissor(box)
  renderer.state.setScissorTest(true)
}

function clipOff(renderer) {
  renderer.state.setScissorTest(false)
}

export function CardClip({ on, open, children }) {
  const g = useRef()
  const left = useRef(0)
  useFrame(() => {
    const root = g.current
    if (!root) return
    /* ชิ้นใหม่งอกได้ตลอด (อินโทร, ถนนที่งอกตามการเลื่อน) — ไล่ติดตัวตัดทุกครึ่งวินาที ไม่ใช่ทุกเฟรม */
    if (left.current-- > 0) return
    left.current = 30
    root.traverse((o) => {
      if (!o.isMesh && !o.isLine && !o.isPoints) return
      const tagged = o.userData.cardClip
      if (on && !tagged) {
        const before = o.onBeforeRender
        const after = o.onAfterRender
        o.userData.cardClip = { before, after }
        o.userData.cardOpen = open
        o.onBeforeRender = function (...a) {
          before.apply(this, a)
          clipOn.call(this, a[0])
        }
        o.onAfterRender = function (...a) {
          clipOff(a[0])
          after.apply(this, a)
        }
      } else if (!on && tagged) {
        o.onBeforeRender = tagged.before
        o.onAfterRender = tagged.after
        delete o.userData.cardClip
      }
    })
  })
  return <group ref={g}>{children}</group>
}
