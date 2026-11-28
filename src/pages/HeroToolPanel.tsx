import { useEffect, useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'


/**
 * แถบเครื่องมือของฉาก — แผงตั้งสามมิติที่ยืนอยู่ข้างจอแล็ปท็อป ไม่ใช่พิลล์ HTML ลอยหน้าจอ
 *
 * มันเป็นของในไซต์ก่อสร้างเหมือนบันไดหรือเครน แค่บังเอิญกดได้ — จึงปั้นด้วย primitive
 * ชุดเดียวกับฉาก แล้วหันหน้าเข้าหากล้อง (yaw 45°) ให้อ่านออกในมุมไอโซ
 *
 * แผงนี้ "ไม่" เป็น Chunk: ตอนฉากระเบิด ของทุกชิ้นปลิว แต่แผงควบคุมต้องอยู่ให้กด Restore ได้
 *
 * ปุ่มจริงที่ screen reader ใช้ได้อยู่ในหน้า (sr-only) — แคนวาสถูก aria-hidden ทั้งก้อน
 */

/** เครื่องมือที่เลือกอยู่ (โหมดคอมเมนต์ = comment) */
export type HeroTool = 'cursor' | 'comment'
/** โหมดของจอแล็ปท็อปในฉาก */
export type HeroMode = 'design' | 'dev'

const TILE = 0.78
const GAP = 0.14
const SECTION = 0.26
const PANEL_W = TILE + 0.28
const DEPTH = 0.18
/** ความสูงของเสาจากพื้นถึงขอบล่างของแผง */
const POLE = 1.35

const INK = '#292a2e'
const INK_SOFT = '#3c3e45'
const ORANGE = '#fd5000'
const WHITE = '#ededf2'
const DIM = '#8b90a0'

/** ลูกศรเคอร์เซอร์ — วาดเป็นรูปทึบชิ้นเดียว ไม่ใช่หลายกล่องต่อกัน */
function cursorShape() {
  const s = new THREE.Shape()
  s.moveTo(-0.13, 0.2)
  s.lineTo(0.14, -0.05)
  s.lineTo(0.01, -0.06)
  s.lineTo(0.08, -0.21)
  s.lineTo(-0.02, -0.25)
  s.lineTo(-0.08, -0.09)
  s.lineTo(-0.17, -0.17)
  s.closePath()
  return s
}

/** หางลูกโป่งคำพูด */
function tailShape() {
  const s = new THREE.Shape()
  s.moveTo(-0.09, 0)
  s.lineTo(0.05, 0)
  s.lineTo(-0.09, -0.13)
  s.closePath()
  return s
}

type Slot =
  | { kind: 'tool'; id: HeroTool }
  | { kind: 'mode'; id: HeroMode }
  | { kind: 'restore' }
  | { kind: 'gap' }

export type HeroToolPanelProps = {
  tool: HeroTool
  mode: HeroMode
  exploded: boolean
  onTool: (t: HeroTool) => void
  onMode: (m: HeroMode) => void
  onRestore: () => void
  position?: [number, number, number]
  rotation?: [number, number, number]
}

export function HeroToolPanel({
  tool,
  mode,
  exploded,
  onTool,
  onMode,
  onRestore,
  position = [-3.5, 0, 3.4],
  rotation = [0, Math.PI / 4, 0],
}: HeroToolPanelProps) {
  const g = useMemo(
    () => ({
      plate: new THREE.PlaneGeometry(1, 1),
      pole: new THREE.CylinderGeometry(0.09, 0.11, 1, 12),
      foot: new THREE.CylinderGeometry(0.34, 0.4, 0.12, 16),
      cursor: new THREE.ShapeGeometry(cursorShape()),
      tail: new THREE.ShapeGeometry(tailShape()),
      ring: new THREE.TorusGeometry(0.13, 0.032, 8, 22, Math.PI * 1.45),
      head: new THREE.ConeGeometry(0.07, 0.12, 3),
    }),
    [],
  )
  useEffect(
    () => () => {
      for (const geo of Object.values(g)) geo.dispose()
    },
    [g],
  )

  // ช่องเรียงบนลงล่าง — ปุ่ม Restore มีเฉพาะตอนฉากพัง จึงต่อท้ายเป็นเงื่อนไข
  const slots: Slot[] = [
    { kind: 'tool', id: 'cursor' },
    { kind: 'tool', id: 'comment' },
    { kind: 'gap' },
    { kind: 'mode', id: 'design' },
    { kind: 'mode', id: 'dev' },
    ...(exploded ? ([{ kind: 'gap' }, { kind: 'restore' }] as Slot[]) : []),
  ]

  const heights = slots.map((s) => (s.kind === 'gap' ? SECTION : TILE))
  const total = heights.reduce((a, h) => a + h, 0) + (slots.length - 1) * GAP
  const panelH = total + 0.28
  const boardY = POLE + panelH / 2

  // ไล่หาจุดกึ่งกลางของแต่ละช่องจากบนลงล่าง
  let cursorY = total / 2
  const centers = heights.map((h) => {
    const y = cursorY - h / 2
    cursorY -= h + GAP
    return y
  })

  const hovered = useRef(0)
  useEffect(
    () => () => {
      // ออกจากหน้าไปทั้งที่เคอร์เซอร์ยังค้างอยู่บนปุ่ม — คืนเคอร์เซอร์ให้หน้าเว็บ
      if (hovered.current) document.body.style.cursor = ''
    },
    [],
  )
  const enter = () => {
    hovered.current++
    document.body.style.cursor = 'pointer'
  }
  const leave = () => {
    hovered.current = Math.max(0, hovered.current - 1)
    if (!hovered.current) document.body.style.cursor = ''
  }

  return (
    <group position={position} rotation={rotation}>
      {/* ขาตั้ง: จานรองกับเสา — แผงเป็นป้ายที่ "ปัก" อยู่ในไซต์ ไม่ใช่แผ่นลอยกลางอากาศ
          ทุกชิ้นติด noBounds เพราะแผ่นพื้นวัดจากรอยเท้าของฉาก ป้ายควบคุมไม่ใช่ส่วนของฉาก */}
      <mesh geometry={g.foot} position={[0, 0.06, 0]} castShadow userData={{ noBounds: true }}>
        <meshStandardMaterial color={INK} roughness={0.7} metalness={0} />
      </mesh>
      <mesh
        geometry={g.pole}
        position={[0, POLE / 2, 0]}
        scale={[1, POLE, 1]}
        castShadow
        userData={{ noBounds: true }}
      >
        <meshStandardMaterial color={INK_SOFT} roughness={0.7} metalness={0} />
      </mesh>

      {/* ตัวแผง — กล่องมุมมนบาง ๆ อยู่ระดับสายตาของฉาก เงาตกลงพื้นเหมือนของชิ้นอื่น */}
      <group position={[0, boardY, 0]}>
      <RoundedBox
        args={[PANEL_W, panelH, DEPTH]}
        radius={0.09}
        smoothness={3}
        castShadow
        userData={{ noBounds: true }}
      >
        <meshStandardMaterial color={INK} roughness={0.6} metalness={0} />
      </RoundedBox>

      {slots.map((slot, i) => {
        if (slot.kind === 'gap') {
          return (
            <mesh
              key={i}
              geometry={g.plate}
              position={[0, centers[i], DEPTH / 2 + 0.005]}
              scale={[TILE * 0.62, 0.03, 1]}
              userData={{ noBounds: true }}
            >
              <meshBasicMaterial color={DIM} transparent opacity={0.35} />
            </mesh>
          )
        }

        const active =
          slot.kind === 'tool' ? tool === slot.id : slot.kind === 'mode' ? mode === slot.id : true
        const bg = slot.kind === 'restore' ? ORANGE : active ? ORANGE : INK_SOFT
        const ink = active || slot.kind === 'restore' ? WHITE : DIM
        const onClick = () => {
          if (slot.kind === 'tool') onTool(slot.id)
          else if (slot.kind === 'mode') onMode(slot.id)
          else onRestore()
        }

        return (
          <group key={i} position={[0, centers[i], DEPTH / 2 + 0.005]}>
            {/* แผ่นปุ่มเป็นตัวรับคลิกของทั้งช่อง — ไอคอนข้างในไม่ต้องรับเอง */}
            <mesh
              geometry={g.plate}
              scale={[TILE, TILE, 1]}
              userData={{ noBounds: true }}
              onClick={(e) => {
                e.stopPropagation()
                onClick()
              }}
              onPointerOver={(e) => {
                e.stopPropagation()
                enter()
              }}
              onPointerOut={leave}
            >
              <meshBasicMaterial color={bg} toneMapped={false} />
            </mesh>

            <group position={[0, 0, 0.012]}>
              {slot.kind === 'tool' && slot.id === 'cursor' && (
                <mesh geometry={g.cursor} scale={1.35} raycast={() => null}>
                  <meshBasicMaterial color={ink} toneMapped={false} />
                </mesh>
              )}
              {slot.kind === 'tool' && slot.id === 'comment' && (
                <group raycast={() => null}>
                  <mesh geometry={g.plate} position={[0, 0.05, 0]} scale={[0.42, 0.3, 1]}>
                    <meshBasicMaterial color={ink} toneMapped={false} />
                  </mesh>
                  <mesh geometry={g.tail} position={[-0.06, -0.1, 0]}>
                    <meshBasicMaterial color={ink} toneMapped={false} />
                  </mesh>
                </group>
              )}
              {/* design = กรอบสี่เหลี่ยม (อาร์ตบอร์ด) · dev = วงเล็บปีกกาสองอัน */}
              {slot.kind === 'mode' && slot.id === 'design' && (
                <group raycast={() => null}>
                  <mesh geometry={g.plate} scale={[0.38, 0.38, 1]}>
                    <meshBasicMaterial color={ink} toneMapped={false} />
                  </mesh>
                  <mesh geometry={g.plate} position={[0, 0, 0.006]} scale={[0.22, 0.22, 1]}>
                    <meshBasicMaterial color={bg} toneMapped={false} />
                  </mesh>
                </group>
              )}
              {slot.kind === 'mode' && slot.id === 'dev' && (
                <group raycast={() => null}>
                  {[-1, 1].map((side) =>
                    [-1, 1].map((half) => (
                      <mesh
                        key={`${side}${half}`}
                        geometry={g.plate}
                        position={[side * 0.13, half * 0.07, 0]}
                        rotation={[0, 0, side * half * 0.85]}
                        scale={[0.22, 0.055, 1]}
                      >
                        <meshBasicMaterial color={ink} toneMapped={false} />
                      </mesh>
                    )),
                  )}
                </group>
              )}
              {slot.kind === 'restore' && (
                <group raycast={() => null}>
                  <mesh geometry={g.ring} rotation={[0, 0, Math.PI * 0.15]}>
                    <meshBasicMaterial color={ink} toneMapped={false} />
                  </mesh>
                  <mesh geometry={g.head} position={[0.115, 0.1, 0]} rotation={[0, 0, -1.1]}>
                    <meshBasicMaterial color={ink} toneMapped={false} />
                  </mesh>
                </group>
              )}
            </group>
          </group>
        )
      })}
      </group>
    </group>
  )
}
