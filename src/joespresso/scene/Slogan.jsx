import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { introState } from '../intro'

/**
 * สโลแกนของ intro — เป็นวัตถุ 3D ในฉาก ไม่ใช่ตัวหนังสือ DOM ที่ลอยทับ canvas
 *
 * ทำไมไม่ใช้ drei <Text>: troika ต้องการไฟล์ฟอนต์ (ttf/woff) ส่วนหน้านี้โหลด Satoshi
 * มาเป็น CSS จาก fontshare การชี้ troika ไปที่ไฟล์ของ CDN โดยตรงเสี่ยงพัง (รูปแบบ/CORS)
 * และตัวหนังสือจะเพี้ยนจากที่เห็นในหน้าเว็บ
 *
 * วาดลง canvas 2D ด้วยฟอนต์ตัวเดียวกับที่หน้าเว็บใช้ แล้วเอาเป็น texture แปะบนระนาบแทน
 * ได้ตัวอักษรตรงกับแบบเป๊ะ คุมสีทีละคำได้ และเป็นวัตถุในฉากจริง ๆ
 *
 * ท่าเข้า: depth text (อ้างจาก reactbits/DepthText)
 * ตัวหนังสือถูกซ้อนหลายชั้นถอยลึกไปข้างหลังทีละนิด ไล่สีจากสีจริงไปหาสีม่วงของเครื่องมือ
 * ได้ตัวอักษรที่มี "เนื้อ" แล้วทั้งก้อนส่ายช้า ๆ ให้ตาเห็นความลึกนั้น
 *
 * ต่างจากต้นฉบับตรงที่ของเขาซ้อน DOM ด้วย translateZ ส่วนอันนี้เป็นระนาบซ้อนกันในฉากจริง —
 * ความลึกจึงเป็นความลึกของฉาก โดนบัง โดนหมอก และเข้ากับเปอร์สเปคทีฟของกล้องเอง
 */

/** บรรทัด: ลิสต์ของ [ข้อความ, สี] เรียงต่อกันในบรรทัดเดียว */
const LINES = [
  [
    ['Turning ', '#1C1C1E'],
    ['Vision', '#2F6BFF'],
  ],
  [
    ['into ', '#1C1C1E'],
    ['{Experiences}', '#F2604A'],
  ],
]

const FONT = '600 128px Satoshi, system-ui, sans-serif'
/** ความสูงตัวอักษรในหน่วยโลก — ทั้งบล็อกถูกสเกลจากค่านี้ */
const LINE_H = 0.62
/** วาด texture ใหญ่กว่าที่ใช้จริงเท่านี้ กันขอบฟุ้งตอนกล้องเข้าใกล้ */
const RES = 2

/** จำนวนชั้นความลึกต่อบรรทัด — มากขึ้นเนียนขึ้นแต่จ่าย draw call ตรง ๆ */
const LAYERS = 16
/** ระยะห่างระหว่างชั้น (หน่วยโลก) — รวมแล้วหนา ~0.19 หรือ 30% ของความสูงตัวอักษร */
const LAYER_GAP = 0.012
/** สีเนื้อด้านลึก — สีเดียวกับกรอบ crop ให้อ่านเป็นของชุดเดียวกัน */
const DEPTH_COLOR = new THREE.Color('#7C5CFC')
/** มุมส่ายสูงสุด (เรเดียน) และความเร็ววงส่าย */
const TILT = 0.13
const ORBIT = 0.32

function drawLine(parts) {
  const pad = 24
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = FONT
  const widths = parts.map(([t]) => probe.measureText(t).width)
  const w = Math.ceil(widths.reduce((a, b) => a + b, 0)) + pad * 2
  const h = 190

  const canvas = document.createElement('canvas')
  canvas.width = w * RES
  canvas.height = h * RES
  const ctx = canvas.getContext('2d')
  ctx.scale(RES, RES)
  ctx.font = FONT
  ctx.textBaseline = 'middle'
  let x = pad
  parts.forEach(([text, color], i) => {
    ctx.fillStyle = color
    ctx.fillText(text, x, h / 2)
    x += widths[i]
  })

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { tex, aspect: w / h }
}

/** สีของชั้นที่ d — ชั้นหน้าสุด (d = 0) ไม่ย้อม ชั้นลึกไล่ไปหาสีม่วงแบบไม่เป็นเชิงเส้น */
function layerColor(d) {
  const p = d / LAYERS
  return new THREE.Color(1, 1, 1).lerp(DEPTH_COLOR, p * p * 0.85 + 0.15)
}

export function Slogan({ position = [0, 0, 0] }) {
  const group = useRef()
  const [lines, setLines] = useState(null)

  // รอฟอนต์โหลดเสร็จก่อนวาด ไม่งั้นได้ system font ค้างไปทั้งรอบ
  useEffect(() => {
    let alive = true
    const draw = () => alive && setLines(LINES.map(drawLine))
    if (document.fonts?.ready) document.fonts.ready.then(draw)
    else draw()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => () => lines?.forEach(({ tex }) => tex.dispose()), [lines])

  const box = useMemo(() => new THREE.Box3(), [])
  const tilt = useRef({ x: 0, y: 0 })

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const t = introState.playing || introState.done ? introState.b.title : 0

    g.children.forEach((line, i) => {
      // ไล่ทีละบรรทัด — บรรทัดล่างออกตัวช้ากว่าเล็กน้อย
      const k = Math.min(1, Math.max(0, (t - i * 0.18) / 0.7))
      const e = 1 - Math.pow(1 - k, 3)
      line.visible = k > 0.001
      /**
       * ความลึกงอกออกมาตามจังหวะ: เริ่มจากแบนสนิท (ทุกชั้นทับกันที่ z = 0)
       * แล้วชั้นหลัง ๆ ถอยออกไปเรื่อย ๆ จนเป็นตัวอักษรมีเนื้อ
       * นี่คือท่า "เข้า" ของ depth text — ไม่ใช่ fade เข้ามาทั้งก้อน
       */
      line.children.forEach((mesh) => {
        const d = mesh.userData.layer ?? 0
        mesh.position.z = -d * LAYER_GAP * e
        const m = mesh.material
        if (m) m.opacity = d === 0 ? Math.min(1, k * 3.5) : Math.min(1, k * 2.4)
      })
      line.position.y = line.userData.y + (1 - e) * LINE_H * 0.35
    })

    // ส่ายช้า ๆ ให้ตาเห็นความลึก + เอียงตามเมาส์นิดหน่อย (ต้นฉบับ DepthText ทำแบบเดียวกัน)
    const now = state.clock.elapsedTime
    const aimX = -state.pointer.y * TILT * 0.5 + Math.sin(now * ORBIT) * TILT * 0.45
    const aimY = state.pointer.x * TILT * 0.5 + Math.cos(now * ORBIT * 0.85) * TILT * 0.45
    const s = 1 - Math.exp(-dt / 0.35)
    tilt.current.x += (aimX - tilt.current.x) * s
    tilt.current.y += (aimY - tilt.current.y) * s
    g.rotation.x = tilt.current.x * t
    g.rotation.y = tilt.current.y * t

    // กล่องของบล็อกในสเปซแม่ — CropRig เอาไปคิดว่าต้องหดกรอบเท่าไรถึงจะครอบพอดี
    if (t > 0) {
      box.setFromObject(g)
      if (!introState.slogan) {
        introState.slogan = { centre: new THREE.Vector3(), size: new THREE.Vector3() }
      }
      box.getCenter(introState.slogan.centre)
      box.getSize(introState.slogan.size)
      g.parent.worldToLocal(introState.slogan.centre)
    }
  })

  if (!lines) return null

  return (
    <group ref={group} position={position}>
      {lines.map(({ tex, aspect }, i) => {
        const y = (LINES.length / 2 - i - 0.5) * LINE_H * 1.12
        return (
          <group key={i} position={[0, y, 0]} userData={{ y }}>
            {/* เรียงจากชั้นลึกสุดมาหน้าสุด — วาดหลังไปหน้าให้ alpha ทับกันถูกลำดับ */}
            {Array.from({ length: LAYERS + 1 }, (_, n) => {
              const d = LAYERS - n
              return (
                <mesh
                  key={d}
                  /* keepColor: โหมดปั้นทาเทาทั้งฉาก ถ้าโดนด้วย ตัวอักษรจะกลายเป็นแผ่นเทา
                     — ตัวหนังสือไม่ใช่ "ทรง" ที่ต้องปั้น เว้นไว้ */
                  userData={{ layer: d, keepColor: true }}
                  renderOrder={9}
                >
                  <planeGeometry args={[LINE_H * aspect, LINE_H]} />
                  <meshBasicMaterial
                    map={tex}
                    color={d === 0 ? '#ffffff' : layerColor(d)}
                    transparent
                    opacity={0}
                    toneMapped={false}
                    depthWrite={false}
                  />
                </mesh>
              )
            })}
          </group>
        )
      })}
    </group>
  )
}
