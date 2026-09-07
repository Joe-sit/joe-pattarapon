import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { makeRandom, useDisposable, LOW_END } from '@/joespresso/scene/utils'

/**
 * ฉากนอกพอร์ทัล = อวกาศ
 *
 * สองชิ้น ทำงานคนละหน้าที่:
 *  · SpaceBackdrop — ท้องฟ้า: ไล่สีม่วง-กรมท่า + เนบิวลาฟุ้ง + ดาวเป็นจุด
 *  · Planets       — ดาวเคราะห์ลอยเป็นกรอบที่ขอบจอ (แทนก้อนเมฆชุดเดิม)
 *
 * ดาวถูก "วาด" ลงเทกซ์เจอร์เดียวกับพื้นหลัง ไม่ได้ทำเป็น Points:
 * ดาวในภาพอ้างอิงคือจุดนิ่งบนฉากหลัง ไม่มีพารัลแลกซ์ให้เห็นอยู่แล้ว การทำเป็นระบบอนุภาค
 * คือจ่าย draw call + buffer เพิ่มเพื่อผลลัพธ์เดียวกัน — และวาดบนแคนวาสยังคุมขนาด/ความจาง
 * ของดาวแต่ละดวงได้ตรง ๆ ซึ่ง Points ทำไม่ได้ถ้าไม่เขียนเชดเดอร์
 */

/* ---------- จานสีอวกาศ ----------
   อ่านจากภาพอ้างอิง: ฟ้าเป็นคราม-ม่วงอิ่มสี ไม่ใช่เทาอมม่วง — สีที่ desaturate ลงนิดเดียว
   ก็อ่านเป็น "ดำสกปรก" ทันที เพราะไม่มีอะไรในเฟรมให้เทียบว่ามันควรเป็นสีอะไร */
const SP_CORE = '#4433d8'
const SP_GLOW = '#241c86'
const SP_MID = '#120e46'
const SP_EDGE = '#050418'
/** ก้อนฟุ้ง: [u, v, รัศมี (เท่าของด้านแคนวาส), สี, ความเข้ม] */
const NEBULA = [
  [0.26, 0.2, 0.3, '#a63cf5', 0.26],
  [0.76, 0.15, 0.26, '#2f6bff', 0.24],
  [0.6, 0.7, 0.34, '#5b2be0', 0.2],
  [0.12, 0.8, 0.22, '#e04ad0', 0.14],
]

/**
 * ท้องฟ้าอวกาศ — แผ่นเกาะกล้องแบบเดียวกับ Backdrop ปกติ
 *
 * เกาะกล้องเพราะกล้องก้มและขยับตอนอินโทร แผ่นนิ่งกลางฉากต้องใหญ่มากถึงจะไม่เห็นขอบ
 * แล้วไล่สีจะถูกบีบจนเหลือแถบเดียว
 */
export function SpaceBackdrop({ seed = 5, stars = 1, nebula = 1 }) {
  const tex = useMemo(() => {
    // จอกว้างกินเทกซ์เจอร์ทั้งใบ ดาวขนาดหนึ่งพิกเซลจึงต้องมีพิกเซลให้พอ ไม่งั้นเบลอเป็นฝ้า
    const S = LOW_END ? 1024 : 2048
    const c = document.createElement('canvas')
    c.width = c.height = S
    const ctx = c.getContext('2d')

    // แกนกลางสว่างเยื้องไปทางขวาบน แล้วมืดลงเข้าหามุม — ไม่ใช่ไล่ตั้งขึ้นตรง ๆ
    const g = ctx.createRadialGradient(S * 0.64, S * 0.34, S * 0.02, S * 0.52, S * 0.46, S * 0.8)
    g.addColorStop(0, SP_CORE)
    g.addColorStop(0.22, SP_GLOW)
    g.addColorStop(0.55, SP_MID)
    g.addColorStop(1, SP_EDGE)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)

    if (nebula > 0.5) {
      // ทับแบบ lighter = ก้อนฟุ้งบวกแสงเข้าไป ไม่ใช่แปะสีทึบซ้อน (ขอบก้อนจะเห็นเป็นวง)
      ctx.globalCompositeOperation = 'lighter'
      for (const [u, v, r, col, a] of NEBULA) {
        const rr = r * S
        const ng = ctx.createRadialGradient(u * S, v * S, 0, u * S, v * S, rr)
        const cc = new THREE.Color(col)
        ng.addColorStop(0, `rgba(${(cc.r * 255) | 0},${(cc.g * 255) | 0},${(cc.b * 255) | 0},${a})`)
        ng.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = ng
        ctx.beginPath()
        ctx.arc(u * S, v * S, rr, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    /**
     * มุมจมลงดำ — ก้อนฟุ้งบวกแสงเข้าไปทั่วผืนจนภาพลอยเป็นม่วงกลาง ๆ ทั้งเฟรม
     * ดึงมุมกลับลงมาแล้วส่วนที่สว่างถึงจะอ่านว่าสว่าง (ไม่มีอะไรสว่างถ้าไม่มีอะไรมืด)
     */
    const vg = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.26, S * 0.5, S * 0.5, S * 0.76)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(2,1,12,0.72)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, S, S)

    if (stars > 0.5) {
      const rand = makeRandom(seed)
      const n = Math.round(S * 0.42)
      for (let i = 0; i < n; i++) {
        const x = rand() * S
        const y = rand() * S
        /**
         * ขนาดกับความจางเอียงไปทางดวงเล็ก ๆ จาง ๆ (ยกกำลังสาม)
         * ถ้าสุ่มแบบสม่ำเสมอ ดาวจะสว่างเท่ากันทั้งผืนแล้วอ่านเป็นลายจุด ไม่ใช่ท้องฟ้า
         */
        const t = rand() ** 3
        const r = (0.5 + t * 2.6) * (S / 2048)
        ctx.globalAlpha = 0.28 + t * 0.72
        // ดาวส่วนน้อยอมม่วง/ฟ้า ที่เหลือขาว — ท้องฟ้าจริงไม่ได้ขาวล้วนทั้งผืน
        const hue = rand()
        ctx.fillStyle = hue > 0.86 ? '#cbb4ff' : hue > 0.72 ? '#b8d4ff' : '#ffffff'
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        // ดวงใหญ่สุดมีรัศมีฟุ้งรอบตัว = สิ่งที่ทำให้ตาอ่านว่ามันสว่าง ไม่ใช่แค่เม็ดใหญ่
        if (t > 0.75) {
          const gg = ctx.createRadialGradient(x, y, 0, x, y, r * 6)
          gg.addColorStop(0, 'rgba(255,255,255,0.5)')
          gg.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.globalAlpha = 1
          ctx.fillStyle = gg
          ctx.beginPath()
          ctx.arc(x, y, r * 6, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    }

    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [seed, stars, nebula])
  useDisposable(tex)

  const ref = useRef()
  const DIST = 60
  useFrame(({ camera }) => {
    const m = ref.current
    if (!m) return
    m.quaternion.copy(camera.quaternion)
    m.position.set(0, 0, -DIST).applyQuaternion(camera.quaternion).add(camera.position)
    const h = 2 * DIST * Math.tan((camera.fov * Math.PI) / 360) * 1.04
    m.scale.set(h * camera.aspect, h, 1)
  })
  return (
    <mesh ref={ref} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} depthWrite={false} />
    </mesh>
  )
}

/* ---------- ดาวเคราะห์ลอยขอบจอ ---------- */

/** ลูกกลม/วงแหวนหน่วยเดียว ใช้ร่วมทุกดวง — ต่างกันแค่ scale ห้าม dispose (แชร์ระดับโมดูล) */
const BALL = new THREE.SphereGeometry(1, 48, 32)
const RING = new THREE.TorusGeometry(1, 0.075, 14, 96)

/**
 * ผัง: [u, v, สเกล, สี, วงแหวน?]
 * u/v = พิกัดในกรอบภาพ (-1..1) เกิน 1 = โผล่มาครึ่งดวงจากนอกจอ ซึ่งทำให้อ่านเป็นดาวดวงใหญ่
 * ที่อยู่ใกล้เลนส์ ไม่ใช่ลูกบอลที่ถูกวางไว้ในจอ ดวงกลางจอตั้งใจให้เล็ก ไม่บังหน้าต่าง
 */
const PLANETS = [
  [-1.15, 1.16, 1.7, 0, 0],
  [1.24, 1.1, 2.1, 1, 0],
  [-0.56, 0.82, 0.4, 2, 1],
  [1.12, -1.02, 0.62, 3, 0],
  [-1.16, -0.62, 0.34, 4, 0],
  [0.4, 1.04, 0.16, 5, 0],
  [-0.92, 0.36, 0.11, 2, 0],
]

/**
 * ผิวดาว = ไล่สีพาสเทลเหลือบ (iridescent) ไม่ใช่สีเดียวทั้งดวง
 *
 * นี่คือหัวใจของหน้าตาในภาพอ้างอิง: ทุกก้อนไล่จากชมพู→ส้ม→ฟ้า→ม่วงบนตัวมันเอง สีเดียว
 * ล้วนต่อให้ถูกเฉดแค่ไหนก็อ่านเป็นลูกบอลพลาสติก ไม่ใช่วัตถุเหลือบแสง
 *
 * ไล่แนวทแยงบนแคนวาสสี่เหลี่ยม แล้วปล่อยให้ UV ของทรงกลมม้วนให้เอง — แถบสีจึงพาดเฉียง
 * ผ่านหน้าดวง ไม่ใช่เป็นวงขนานกับเส้นศูนย์สูตร
 */
const IRID = [
  ['#ff8fd0', '#b06bf5', '#4a3ce0'],
  ['#ffd9a0', '#ff86c8', '#8a5cf0'],
  ['#ffb3e6', '#c58cff', '#6a4ae8'],
  ['#a8e8ff', '#7aa6ff', '#5b3ee0'],
  ['#b9f2d8', '#8fc8ff', '#7a5cf0'],
  ['#ffe2b0', '#ffa8d8', '#a07cff'],
]

function iridTexture(stops) {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, S, S, 0)
  stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Planet({ ring, mat, spot }) {
  return (
    <>
      <mesh geometry={BALL} material={mat} />
      {ring > 0.5 && (
        <mesh geometry={RING} rotation={[Math.PI / 2 - 0.34, 0, 0.22]} scale={[1.62, 1.62, 1.62]}>
          <meshStandardMaterial color="#ff5fae" roughness={0.35} metalness={0} emissive="#ff2f8f" emissiveIntensity={0.55} />
        </mesh>
      )}
      {/* คราบเข้มบนผิว = "ทวีป" — ดวงเรียบล้วนอ่านเป็นลูกบอลพลาสติก */}
      <mesh geometry={BALL} material={spot} position={[-0.42, 0.36, 0.78]} scale={[0.3, 0.2, 0.3]} />
      <mesh geometry={BALL} material={spot} position={[0.5, -0.3, 0.72]} scale={[0.22, 0.15, 0.22]} />
    </>
  )
}

/**
 * dist = ระยะจากกล้อง (น้อย = ใหญ่และอยู่หน้า), scale = ตัวคูณขนาดรวม
 * drift = แอมพลิจูดการลอย (หน่วยกรอบภาพ), spin = เรเดียน/วินาทีที่ดวงหมุนรอบตัวเอง
 */
export function Planets({ dist = 22, scale = 1, drift = 0.02, spin = 0.06 }) {
  const refs = useRef([])
  const texes = useMemo(() => IRID.map((stops) => iridTexture(stops)), [])
  /**
   * ด้านมืดไม่ดำสนิท: ฉากนี้ไม่มีดาวฤกษ์ดวงเดียวเป็นแหล่งไฟ
   * ใส่ emissiveMap เป็นแผ่นเดียวกับ map จาง ๆ ดวงจึงยังติดสีตรงด้านที่ไฟไม่ถึง
   */
  const mats = useMemo(
    () =>
      texes.map(
        (map) =>
          new THREE.MeshStandardMaterial({
            map,
            roughness: 0.45,
            metalness: 0,
            emissiveMap: map,
            emissive: new THREE.Color('#ffffff'),
            emissiveIntensity: 0.3,
          }),
      ),
    [texes],
  )
  /** คราบบนผิว = แผ่นไล่สีใบเดียวกันแต่หรี่ลง ไม่ใช่สีอื่น — ดวงจึงยังอ่านเป็นก้อนเดียว */
  const spots = useMemo(
    () =>
      texes.map(
        (map) =>
          new THREE.MeshStandardMaterial({
            map,
            color: new THREE.Color('#8e86b8'),
            roughness: 0.8,
            metalness: 0,
          }),
      ),
    [texes],
  )
  useDisposable(texes)
  useDisposable(mats)
  useDisposable(spots)

  useFrame(({ camera, clock }) => {
    const h = 2 * dist * Math.tan((camera.fov * Math.PI) / 360)
    const w = h * camera.aspect
    const tt = clock.elapsedTime
    for (let i = 0; i < PLANETS.length; i++) {
      const g = refs.current[i]
      if (!g) continue
      const [u, v, s] = PLANETS[i]
      // เฟสจากดัชนี ดวงจึงไม่ลอยพร้อมกันเป็นแผง
      const du = Math.sin(tt * 0.11 + i * 1.7) * drift
      const dv = Math.cos(tt * 0.14 + i * 2.3) * drift * 0.7
      g.position
        .set(((u + du) * w) / 2, ((v + dv) * h) / 2, -dist)
        .applyQuaternion(camera.quaternion)
        .add(camera.position)
      // หันหน้าเข้ากล้องก่อน แล้วค่อยหมุนรอบแกนตั้งของตัวเอง — ลายบนผิวจึงกวาดผ่านหน้าเรา
      g.quaternion.copy(camera.quaternion)
      g.rotateY(tt * spin * (i % 2 ? -1 : 1))
      // ขนาดผูกกับความสูงกรอบ ดวงจึงกินพื้นที่จอเท่าเดิมทุกอัตราส่วน
      g.scale.setScalar(s * scale * h * 0.16)
    }
  })

  return PLANETS.map(([, , , pal, ring], i) => (
    <group
      key={i}
      ref={(el) => {
        refs.current[i] = el
      }}
    >
      <Planet ring={ring} mat={mats[pal]} spot={spots[pal]} />
    </group>
  ))
}
