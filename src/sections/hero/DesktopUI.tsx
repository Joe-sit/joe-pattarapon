import { useEffect, useMemo, useRef } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'

/**
 * จอเดสก์ท็อป (แผงม่วงในฉาก UX/UI) ที่ widget หล่นลงมาประกอบเป็นหน้า dashboard — แล้วตอนเลื่อนไปหน้า Coding
 * แยกชั้นออกเป็นภาพเชิงเทคนิค frontend (exploded view): ทุก widget ยกขึ้นตามชั้นของมันในต้นไม้คอมโพเนนต์
 * กรอบเส้นประรอบกล่องของคอมโพเนนต์ เส้นประตั้งบอกระยะชั้น และชื่อคอมโพเนนต์แบบ JSX ลอยกำกับ
 *
 * หน่วยเป็นพิกเซลบนระนาบ (ก่อนสเกลจอ) แกน y ขึ้น จุดศูนย์กลางจอ — ผู้เรียกวางกลุ่มบนระนาบเอียงเดียวกับฉาก
 * api.current(drop, explode) — ผู้เรียกสั่งขยับทุกเฟรมเอง (drop = widget หล่นลงประจำที่ 0..1 · explode = แยกชั้น 0..1)
 * สั่งตรงในลูปเฟรมของผู้เรียก ไม่อ่านค่าที่ฝากไว้ — ลำดับ useFrame สองตัวไม่แน่นอน เคยได้ค่าของเฟรมก่อนจน widget หายไปทั้งชุด
 */

export const DESK = { w: 760, h: 475, r: 28, depth: 22, color: '#c592f2' }
const FONT = '/fonts/momo-trust-sans.json'
/** TTFLoader ขยายพิกัดฟอนต์ 1.389 เท่า (ดู ServiceTrack) */
const FONT_K = 0.72
/** ระยะยกต่อชั้นตอนแยกชั้นเต็ม */
const LAYER_GAP = 95

type Widget = { name: string; x: number; y: number; w: number; h: number; r: number; c: string; d: number; layer: number; on?: number }
/**
 * หน้า dashboard บนจอ: แถบนำทาง แถบข้าง การ์ดตัวเลขสามใบ การ์ดกราฟ การ์ดรายการ ปุ่ม
 * layer = ความลึกในต้นไม้คอมโพเนนต์ (Layout → Section → Item) · on = วางบน widget ลำดับนี้ (ปุ่มอยู่บนการ์ดรายการ)
 */
const WIDGETS: Widget[] = [
  { name: 'NavBar', x: 0, y: 198, w: 720, h: 44, r: 14, c: '#ffffff', d: 10, layer: 1 },
  { name: 'Sidebar', x: -298, y: -34, w: 124, h: 372, r: 18, c: '#f3edfc', d: 10, layer: 1 },
  { name: 'StatCard', x: -146, y: 112, w: 160, h: 96, r: 16, c: '#ffffff', d: 12, layer: 2 },
  { name: 'StatCard', x: 28, y: 112, w: 160, h: 96, r: 16, c: '#ffffff', d: 12, layer: 2 },
  { name: 'StatCard', x: 202, y: 112, w: 160, h: 96, r: 16, c: '#ffffff', d: 12, layer: 2 },
  { name: 'Chart', x: -64, y: -88, w: 324, h: 236, r: 18, c: '#ffffff', d: 12, layer: 2 },
  { name: 'List', x: 202, y: -88, w: 160, h: 236, r: 18, c: '#ffffff', d: 12, layer: 2 },
  { name: 'Button', x: 202, y: -176, w: 128, h: 38, r: 19, c: '#f2663a', d: 10, layer: 3, on: 6 },
]
/** แท่งกราฟบนการ์ดกราฟ (สัดส่วนความสูง) และแถวรายการ — รายละเอียดที่แยกชั้นไปพร้อมการ์ด */
const BARS = [0.42, 0.66, 0.5, 0.82, 0.6, 0.9]
const ROWS = 4

const DIM = 0.6
const std = (hex: string, rough = 0.6) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(DIM), roughness: rough, metalness: 0, envMapIntensity: 0.2 })

function roundRect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x0 = -w / 2
  const y0 = -h / 2
  const rr = Math.min(r, w / 2, h / 2)
  s.moveTo(x0 + rr, y0)
  s.lineTo(x0 + w - rr, y0)
  s.absarc(x0 + w - rr, y0 + rr, rr, -Math.PI / 2, 0, false)
  s.lineTo(x0 + w, y0 + h - rr)
  s.absarc(x0 + w - rr, y0 + h - rr, rr, 0, Math.PI / 2, false)
  s.lineTo(x0 + rr, y0 + h)
  s.absarc(x0 + rr, y0 + h - rr, rr, Math.PI / 2, Math.PI, false)
  s.lineTo(x0, y0 + rr)
  s.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false)
  return s
}
const slab = (w: number, h: number, r: number, d: number) => {
  const bev = Math.min(2.5, d / 3)
  const g = new THREE.ExtrudeGeometry(roundRect(w - bev * 2, h - bev * 2, Math.max(1, r - bev)), {
    depth: d - bev * 2,
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev,
    bevelSegments: 2,
    curveSegments: 16,
  })
  g.translate(0, 0, bev)
  return g
}
/** กรอบเส้นประรอบกล่องของคอมโพเนนต์ (เผื่อขอบ 8) */
const dashBox = (w: number, h: number) => {
  const x = w / 2 + 8
  const y = h / 2 + 8
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-x, -y, 0), new THREE.Vector3(x, -y, 0), new THREE.Vector3(x, y, 0), new THREE.Vector3(-x, y, 0)])
  return g
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const outBack = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2
const inOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)

/**
 * drop(i) = widget ลำดับ i มาถึงแค่ไหน 0..1 · built(i) = ชิ้นนี้เกิดจากบล็อกออกแบบที่บินเข้าจอ (ขยายขึ้นตรงที่
 * ไม่หล่นจากฟ้า) · explode = แยกชั้น 0..1
 */
export type DesktopApi = { current: ((drop: (i: number) => number, explode: number, built: (i: number) => boolean) => void) | null }
/** ชื่อ widget ตามลำดับ — ผู้เรียกใช้จับคู่บล็อกออกแบบกับ widget ที่มันกลายเป็น */
export const WIDGET_NAMES = ['NavBar', 'Sidebar', 'StatCard', 'StatCard', 'StatCard', 'Chart', 'List', 'Button'] as const
/** ตำแหน่ง widget บนผิวจอ (หน่วยท้องถิ่นของจอ) — ให้บล็อกออกแบบบินไปลงตรงนั้น */
export const widgetAt = (i: number) => ({ x: WIDGETS[i].x, y: WIDGETS[i].y, z: DESK.depth + WIDGETS[i].d })

export function DesktopUI({ api }: { api: DesktopApi }) {
  const font = useLoader(FontLoader, FONT)
  const parts = useMemo(() => {
    const widgets = WIDGETS.map((w) => {
      const label = new TextGeometry(`<${w.name} />`, { font, size: 17 * FONT_K, depth: 0.5, curveSegments: 6, bevelEnabled: false })
      const box = dashBox(w.w, w.h)
      const line = new THREE.LineLoop(box, new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 7, gapSize: 5, transparent: true, opacity: 0 }))
      line.computeLineDistances()
      /* เส้นประตั้งจากมุมซ้ายบนของกล่องลงไปถึงพื้นจอ — บอกว่าชิ้นนี้ยกขึ้นมากี่ชั้น (ความยาวตั้งทีหลังทุกเฟรม) */
      const stemGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)])
      const stem = new THREE.Line(stemGeo, new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 5, gapSize: 5, transparent: true, opacity: 0 }))
      return { w, geo: slab(w.w, w.h, w.r, w.d), mat: std(w.c, 0.55), label, line, stem }
    })
    const barGeo = slab(30, 100, 6, 8)
    const barMat = [std('#3b6fe3', 0.5), std('#5fdf45', 0.5)]
    const rowGeo = slab(120, 24, 8, 4)
    const rowMat = std('#ede7f8', 0.6)
    const dotGeo = new THREE.CircleGeometry(9, 20)
    const dotMat = new THREE.MeshBasicMaterial({ color: '#3b6fe3', toneMapped: false })
    const ink = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, toneMapped: false })
    const desk = slab(DESK.w, DESK.h, DESK.r, DESK.depth)
    const deskMat = std(DESK.color, 0.55)
    return { widgets, barGeo, barMat, rowGeo, rowMat, dotGeo, dotMat, ink, desk, deskMat }
  }, [font])
  useEffect(
    () => () => {
      parts.widgets.forEach((p) => {
        p.geo.dispose()
        p.mat.dispose()
        p.label.dispose()
        p.line.geometry.dispose()
        ;(p.line.material as THREE.Material).dispose()
        p.stem.geometry.dispose()
        ;(p.stem.material as THREE.Material).dispose()
      })
      ;[parts.barGeo, parts.rowGeo, parts.dotGeo, parts.desk].forEach((g) => g.dispose())
      ;[...parts.barMat, parts.rowMat, parts.dotMat, parts.ink, parts.deskMat].forEach((m) => m.dispose())
    },
    [parts],
  )

  const bodies = useRef<(THREE.Group | null)[]>([])
  api.current = (drop: (i: number) => number, explode: number, built: (i: number) => boolean) => {
    const e = inOut(clamp01(explode))
    parts.ink.opacity = clamp01((explode - 0.25) / 0.5)
    const zOf: number[] = []
    WIDGETS.forEach((w, i) => {
      const b = bodies.current[i]
      if (!b) return
      /* หล่นลงทีละชิ้น ตามแกนตั้งฉากของจอ */
      const k = clamp01(drop(i))
      const made = built(i)
      b.visible = k > 0
      const base = w.on !== undefined ? (zOf[w.on] ?? DESK.depth) + WIDGETS[w.on].d : DESK.depth
      /* หล่นจากฟ้า หรือ (ชิ้นที่บล็อกออกแบบบินมาเป็น) ขยายขึ้นตรงที่ */
      const z = base + (made ? 0 : (1 - outBack(k)) * 240) + e * LAYER_GAP * (w.on !== undefined ? 1 : w.layer)
      b.scale.setScalar(made ? Math.max(1e-3, outBack(k)) : 1)
      zOf[i] = z
      b.position.set(w.x, w.y, z)
      const p = parts.widgets[i]
      ;(p.line.material as THREE.LineDashedMaterial).opacity = parts.ink.opacity
      ;(p.stem.material as THREE.LineDashedMaterial).opacity = parts.ink.opacity * 0.7
      /* เส้นประตั้ง: จากกล่องลงไปถึงผิวจอ (ความยาว = ระยะที่ยกขึ้น) */
      const pos = p.stem.geometry.getAttribute('position') as THREE.BufferAttribute
      pos.setXYZ(1, 0, 0, -(z - DESK.depth))
      pos.needsUpdate = true
      p.stem.computeLineDistances()
    })
  }

  return (
    <group>
      <mesh geometry={parts.desk} material={parts.deskMat} />
      {parts.widgets.map((p, i) => (
        <group
          key={i}
          ref={(g) => {
            bodies.current[i] = g
          }}
          visible={false}
        >
          <mesh geometry={p.geo} material={p.mat} />
          {/* รายละเอียดในการ์ด */}
          {p.w.name === 'Chart' &&
            BARS.map((v, j) => (
              <mesh
                key={j}
                geometry={parts.barGeo}
                material={parts.barMat[j % 2]}
                position={[-125 + j * 50, -p.w.h / 2 + 30 + v * 50, p.w.d]}
                scale={[1, v * 1.4, 1]}
              />
            ))}
          {p.w.name === 'List' &&
            Array.from({ length: ROWS }, (_, j) => <mesh key={j} geometry={parts.rowGeo} material={parts.rowMat} position={[0, 86 - j * 34, p.w.d]} />)}
          {p.w.name === 'StatCard' && <mesh geometry={parts.dotGeo} material={parts.dotMat} position={[-p.w.w / 2 + 26, p.w.h / 2 - 26, p.w.d + 0.4]} />}
          {/* ส่วนเชิงเทคนิค: กรอบเส้นประ ชื่อคอมโพเนนต์ เส้นประตั้งบอกชั้น — โผล่ตอนแยกชั้น */}
          <primitive object={p.line} position={[0, 0, p.w.d + 1]} />
          <primitive object={p.stem} position={[-p.w.w / 2 - 8, p.w.h / 2 + 8, 0]} />
          <mesh geometry={p.label} material={parts.ink} position={[-p.w.w / 2 - 6, p.w.h / 2 + 16, p.w.d + 1]} />
        </group>
      ))}
    </group>
  )
}
