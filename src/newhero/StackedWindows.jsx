import { useMemo } from 'react'
import * as THREE from 'three'
import { useDisposable } from '@/joespresso/scene/utils'
import { roundedBoxGeo } from './geo'

/**
 * หน้าต่างโปรแกรมซ้อนกันเป็นรอยลาก — แบบตอน Windows XP ค้างแล้วลากหน้าต่าง
 *
 * ของจริงเกิดจากหน้าต่างที่ไม่ตอบสนองถูกลากไป ระบบวาดทับไม่ทัน เฟรมเดิมจึงค้างเป็น
 * รอยเรียงกัน สองอย่างที่ทำให้มันอ่านออกว่าเป็น "รอยค้าง" ไม่ใช่ของสามชิ้นวางเรียง:
 *
 *   1. ระยะเลื่อนเท่ากันทุกชั้น — ไล่ระยะไม่เท่ากันเมื่อไรมันกลายเป็นของวางเรียงทันที
 *   2. ทุกชั้นเหมือนกันเป๊ะ ไม่ไล่จางและไม่ย่อขนาด — ไล่จางแล้วอ่านเป็นเงาตกกระทบ
 *
 * เป็นวัตถุอิสระ วางที่ไหนก็ได้ (ตั้งใจไว้ใช้ประกอบฉากในพอร์ทัล) ปั้นในกล่องหน่วยเดียว:
 * กว้าง 1 ตามแกน x จุดกำเนิดอยู่กลางหน้าต่างใบหน้าสุด
 */

const FRAME = '#f2f4f7'
const BAR = '#2f6dd0'
const BAR_DIM = '#7ba3e8'
const BODY = '#ffffff'
const BTN = ['#ff5f57', '#ffbd2e', '#28c840']

export function StackedWindows({
  count = 3,
  /** ระยะเลื่อนต่อชั้น — เท่ากันทุกชั้นเสมอ */
  step = [-0.09, 0.055, -0.05],
  w = 1,
  h = 0.72,
  /** สัดส่วนความสูงของแถบหัวเรื่องเทียบความสูงหน้าต่าง */
  barRatio = 0.16,
  /** ความหนาของตัวหน้าต่าง — หนาขึ้นแล้วเห็นสันข้างตอนหมุน */
  depth = 0.035,
  /** รัศมีมุมเทียบความสูง */
  radius = 0.07,
  /** ขนาดปุ่มสามเม็ดเทียบความสูงแถบหัวเรื่อง */
  btnRatio = 0.17,
  /** ระยะขอบระหว่างกรอบกับพื้นที่ข้างใน */
  inset = 0.04,
  ...props
}) {
  const barH = h * barRatio
  const bodyH = h - barH
  const iw = w * (1 - inset)

  const frame = useMemo(() => roundedBoxGeo(w, h, depth, h * radius), [w, h, depth, radius])
  const bar = useMemo(() => roundedBoxGeo(iw, barH, 0.012, barH * 0.28), [iw, barH])
  const body = useMemo(() => roundedBoxGeo(iw, bodyH * 0.9, 0.012, h * 0.03), [iw, bodyH, h])
  useDisposable([frame, bar, body])

  return (
    <group {...props}>
      {Array.from({ length: Math.max(1, Math.round(count)) }, (_, k) => (
        <group key={k} position={[k * step[0], k * step[1], k * step[2]]}>
          <mesh geometry={frame}>
            <meshStandardMaterial color={FRAME} roughness={0.75} />
          </mesh>
          {/* แถบหัวเรื่อง — ชั้นหน้าสุดคือหน้าต่างที่ "โฟกัสอยู่" สีจึงเข้มกว่าชั้นหลัง */}
          <mesh geometry={bar} position={[0, h / 2 - barH / 2 - h * 0.03, depth / 2 + 0.007]}>
            <meshStandardMaterial color={k === 0 ? BAR : BAR_DIM} roughness={0.6} />
          </mesh>
          {/* ปุ่มสามเม็ดบนแถบหัวเรื่อง — จุดเล็ก ๆ ที่ทำให้อ่านออกทันทีว่าเป็นหน้าต่าง */}
          {BTN.map((c, i) => (
            <mesh
              key={c}
              position={[
                -w / 2 + w * 0.06 + i * w * 0.05,
                h / 2 - barH / 2 - h * 0.03,
                depth / 2 + 0.015,
              ]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[barH * btnRatio, barH * btnRatio, 0.008, 12]} />
              <meshStandardMaterial color={c} roughness={0.5} />
            </mesh>
          ))}
          <mesh geometry={body} position={[0, -barH / 2 - h * 0.02, depth / 2 + 0.007]}>
            <meshStandardMaterial color={BODY} roughness={0.9} />
          </mesh>
        </group>
      )).reverse()}
    </group>
  )
}

/** เผื่อผู้เรียกอยากรู้ว่ากล่องรวมกว้างเท่าไรหลังซ้อนครบ */
export function stackedSpan(count, step, w) {
  return new THREE.Vector3(w + Math.abs(step[0]) * (count - 1), 0, 0)
}
