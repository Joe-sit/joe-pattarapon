import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { HeroRider, armPoseFromTuner } from '@/newhero/HeroRider'
import { getTuner } from '@/newhero/tuner'

/**
 * ฉาก gallery — ตัวละครนั่งเก้าอี้เปลือกหอยสีเหลือง หันไปหาแล็ปท็อปบนโต๊ะไม้ ข้างหลังเป็น
 * ผนังไอคอนแอป 3D ลอยเป็นแถว (องค์ประกอบตามภาพอ้างอิง)
 *
 * ข้อมูลบนไอคอนเป็นของจริงทั้งหมด: ปฏิทินขึ้นวันที่วันนี้ นาฬิกาเดินตามเวลาเครื่อง — วิดเจ็ต
 * หุ้นกับแผงปกอัลบั้มในภาพอ้างอิงไม่ได้ทำ เพราะต้องแต่งราคา/ปกขึ้นมาเอง — ช่องนั้นใส่ไอคอน
 * Photos / Music ที่ไม่มีข้อมูลแทน
 *
 * หน่วย: 1 = ความกว้างไอคอนหนึ่งช่อง
 */

const FONT = "'Mona Sans', system-ui, sans-serif"

function useDispose(list: { dispose: () => void }[]) {
  useEffect(() => () => list.forEach((x) => x.dispose()), [list])
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  const paint = () => {
    const g = c.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, w, h)
    draw(g)
    t.needsUpdate = true
  }
  paint()
  document.fonts?.load(`700 40px ${FONT}`).then(paint, () => {})
  return t
}

const mat = (color: string, roughness = 0.45, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 0.35, clearcoatRoughness: 0.4, ...extra })

/* ---------------------------------------------------------------- ไอคอน */

/** แผ่นไอคอนมุมมน — ขอบหนาแบบไอคอน 3D ในภาพอ้างอิง */
function Tile({ w = 1, h = 1, color, children }: { w?: number; h?: number; color: string; children?: React.ReactNode }) {
  const made = useMemo(() => {
    const geo = new RoundedBoxGeometry(w, h, 0.26, 6, 0.2)
    const m = mat(color, 0.4)
    return { geo, m }
  }, [w, h, color])
  useDispose(useMemo(() => [made.geo, made.m], [made]))
  return (
    <group>
      {/* ไม่ทอดเงา: ไอคอนลอยสูง เงาตกพื้นเป็นแผ่นสี่เหลี่ยมเทาเกลื่อนพื้น (ภาพอ้างอิงไม่มี) */}
      <mesh geometry={made.geo} material={made.m} receiveShadow />
      <group position={[0, 0, 0.13]}>{children}</group>
    </group>
  )
}

/** ลอยขึ้นลงช้า ๆ คนละจังหวะ — ผนังไอคอนมีชีวิตแต่ไม่แย่งสายตาจากตัวละคร */
function Float({ pos, phase, children, tilt = 0 }: { pos: [number, number, number]; phase: number; tilt?: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime * 0.7 + phase
    g.position.y = pos[1] + Math.sin(t) * 0.04
    g.rotation.x = Math.sin(t * 0.8) * 0.04
    g.rotation.y = tilt + Math.sin(t * 0.6) * 0.05
  })
  return (
    <group ref={ref} position={pos} rotation={[0, tilt, 0]}>
      {children}
    </group>
  )
}

function ChartIcon() {
  const made = useMemo(() => {
    const bars = [
      { h: 0.3, c: '#f7c325' },
      { h: 0.45, c: '#ff8a2a' },
      { h: 0.62, c: '#43c46b' },
      { h: 0.5, c: '#2f8cf0' },
    ].map((b) => ({ ...b, geo: new RoundedBoxGeometry(0.15, b.h, 0.15, 3, 0.04), m: mat(b.c, 0.35) }))
    return bars
  }, [])
  useDispose(useMemo(() => made.flatMap((b) => [b.geo, b.m]), [made]))
  return (
    <Tile color="#f4f4f6">
      {made.map((b, i) => (
        <mesh key={i} geometry={b.geo} material={b.m} position={[-0.27 + i * 0.18, -0.3 + b.h / 2, 0.07]} castShadow />
      ))}
    </Tile>
  )
}

/** วิดเจ็ตปฏิทิน — ชื่อวัน + วันที่ของวันนี้จริง (วาดใหม่ตอนข้ามเที่ยงคืน) */
function CalendarWidget() {
  const tex = useMemo(
    () =>
      canvasTex(512, 480, (g) => {
        const now = new Date()
        g.fillStyle = '#ff4b3e'
        g.font = `700 44px ${FONT}`
        g.fillText(now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(), 44, 96)
        g.fillStyle = '#ffffff'
        g.font = `300 170px ${FONT}`
        g.fillText(String(now.getDate()), 36, 260)
        g.fillStyle = 'rgba(255,255,255,0.55)'
        g.font = `500 40px ${FONT}`
        g.fillText(now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), 44, 350)
      }),
    [],
  )
  const made = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1.4, 1.31)
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
    return { geo, m }
  }, [tex])
  useDispose(useMemo(() => [made.geo, made.m, tex], [made, tex]))
  return (
    <Tile w={1.5} h={1.4} color="#2b2c31">
      <mesh geometry={made.geo} material={made.m} position={[0, 0, 0.005]} />
    </Tile>
  )
}

function MessageIcon() {
  const made = useMemo(() => {
    const bubble = new THREE.SphereGeometry(0.3, 32, 20)
    bubble.scale(1, 0.78, 0.5)
    const tail = new THREE.ConeGeometry(0.09, 0.2, 16)
    const m = mat('#ffffff', 0.3)
    return { bubble, tail, m }
  }, [])
  useDispose(useMemo(() => [made.bubble, made.tail, made.m], [made]))
  return (
    <Tile color="#34c759">
      <mesh geometry={made.bubble} material={made.m} position={[0, 0.03, 0.08]} castShadow />
      <mesh geometry={made.tail} material={made.m} position={[-0.2, -0.2, 0.08]} rotation={[0, 0, -2.4]} castShadow />
    </Tile>
  )
}

/** Keynote: แท่นพูดสีน้ำเงิน จอกราฟวงกลม */
function KeynoteIcon() {
  const made = useMemo(() => {
    const board = new RoundedBoxGeometry(0.56, 0.4, 0.05, 3, 0.02)
    const pie = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 32, 1, false, 0, Math.PI * 1.5)
    pie.rotateX(Math.PI / 2)
    const slice = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16, 1, false, Math.PI * 1.5, Math.PI * 0.5)
    slice.rotateX(Math.PI / 2)
    const stand = new THREE.CylinderGeometry(0.025, 0.025, 0.36, 12)
    const foot = new THREE.CylinderGeometry(0.12, 0.14, 0.04, 24)
    return {
      board,
      pie,
      slice,
      stand,
      foot,
      white: mat('#ffffff', 0.3),
      blue: mat('#2f7cf6', 0.35),
      orange: mat('#ff9f1c', 0.35),
      grey: mat('#b9bcc4', 0.4, { metalness: 0.3 }),
    }
  }, [])
  useDispose(useMemo(() => Object.values(made), [made]))
  return (
    <Tile color="#e9eaee">
      <mesh geometry={made.board} material={made.white} position={[0, 0.12, 0.1]} castShadow />
      <mesh geometry={made.pie} material={made.blue} position={[0, 0.12, 0.14]} />
      <mesh geometry={made.slice} material={made.orange} position={[0.02, 0.14, 0.15]} />
      <mesh geometry={made.stand} material={made.grey} position={[0, -0.22, 0.08]} />
      <mesh geometry={made.foot} material={made.grey} position={[0, -0.38, 0.08]} rotation={[Math.PI / 2, 0, 0]} />
    </Tile>
  )
}

function WeatherIcon() {
  const made = useMemo(() => {
    const sun = new THREE.SphereGeometry(0.2, 32, 20)
    const puff = new THREE.SphereGeometry(1, 24, 16)
    return { sun, puff, yellow: mat('#ffc62b', 0.3, { emissive: '#ff9d00', emissiveIntensity: 0.15 }), white: mat('#ffffff', 0.6) }
  }, [])
  useDispose(useMemo(() => Object.values(made), [made]))
  const puffs: [number, number, number][] = [
    [-0.12, -0.1, 0.16],
    [0.06, -0.04, 0.2],
    [0.24, -0.12, 0.14],
    [0.06, -0.16, 0.15],
  ]
  return (
    <Tile color="#1f8bf0">
      <mesh geometry={made.sun} material={made.yellow} position={[-0.12, 0.12, 0.08]} castShadow />
      {puffs.map(([x, y, r], i) => (
        <mesh key={i} geometry={made.puff} material={made.white} position={[x, y, 0.18]} scale={r} castShadow />
      ))}
    </Tile>
  )
}

/** Notes/Quote: เครื่องหมายคำพูดสีส้มกับดินสอ */
function NotesIcon() {
  const made = useMemo(() => {
    const dot = new THREE.SphereGeometry(0.06, 20, 14)
    const tail = new THREE.ConeGeometry(0.04, 0.1, 12)
    const body = new THREE.CylinderGeometry(0.045, 0.045, 0.5, 16)
    const tip = new THREE.ConeGeometry(0.045, 0.1, 16)
    const lineG = new RoundedBoxGeometry(0.5, 0.035, 0.02, 2, 0.01)
    return { dot, tail, body, tip, lineG, orange: mat('#ff9f1c', 0.35), yellow: mat('#ffcc33', 0.35), dark: mat('#3a3a3a', 0.5), line: mat('#f1b24a', 0.5) }
  }, [])
  useDispose(useMemo(() => Object.values(made), [made]))
  return (
    <Tile color="#f3eee2">
      {[-0.22, -0.08].map((x) => (
        <group key={x} position={[x, 0.22, 0.06]}>
          <mesh geometry={made.dot} material={made.orange} />
          <mesh geometry={made.tail} material={made.orange} position={[-0.03, -0.06, 0]} rotation={[0, 0, -0.5]} />
        </group>
      ))}
      {[0.05, -0.08, -0.21].map((y) => (
        <mesh key={y} geometry={made.lineG} material={made.line} position={[0, y, 0.02]} />
      ))}
      <group position={[0.2, -0.1, 0.14]} rotation={[0, 0, -0.75]}>
        <mesh geometry={made.body} material={made.yellow} castShadow />
        <mesh geometry={made.tip} material={made.dark} position={[0, -0.3, 0]} rotation={[Math.PI, 0, 0]} />
      </group>
    </Tile>
  )
}

/** นาฬิกา — เข็มเดินตามเวลาจริงของเครื่อง */
function ClockIcon() {
  const face = useMemo(
    () =>
      canvasTex(512, 512, (g) => {
        g.fillStyle = '#ffffff'
        g.beginPath()
        g.arc(256, 256, 250, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#1b1b1d'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.font = `500 52px ${FONT}`
        for (let i = 1; i <= 12; i += 1) {
          const a = (i / 12) * Math.PI * 2
          g.fillText(String(i), 256 + Math.sin(a) * 196, 256 - Math.cos(a) * 196)
        }
      }),
    [],
  )
  const made = useMemo(() => {
    const disk = new THREE.CircleGeometry(0.38, 64)
    const faceM = new THREE.MeshStandardMaterial({ map: face, roughness: 0.4 })
    const hand = (len: number, w: number) => {
      const g = new RoundedBoxGeometry(w, len, 0.02, 2, w * 0.45)
      g.translate(0, len / 2 - 0.03, 0)
      return g
    }
    return {
      disk,
      faceM,
      hour: hand(0.2, 0.035),
      min: hand(0.3, 0.025),
      sec: hand(0.32, 0.01),
      black: mat('#1b1b1d', 0.4),
      orange: mat('#ff9500', 0.4),
    }
  }, [face])
  useDispose(useMemo(() => [...Object.values(made), face], [made, face]))
  const h = useRef<THREE.Mesh>(null)
  const m = useRef<THREE.Mesh>(null)
  const s = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const d = new Date()
    const sec = d.getSeconds() + d.getMilliseconds() / 1000
    const min = d.getMinutes() + sec / 60
    const hr = (d.getHours() % 12) + min / 60
    if (s.current) s.current.rotation.z = -(sec / 60) * Math.PI * 2
    if (m.current) m.current.rotation.z = -(min / 60) * Math.PI * 2
    if (h.current) h.current.rotation.z = -(hr / 12) * Math.PI * 2
  })
  return (
    <Tile color="#2b2c31">
      <mesh geometry={made.disk} material={made.faceM} position={[0, 0, 0.005]} />
      <mesh ref={h} geometry={made.hour} material={made.black} position={[0, 0, 0.02]} />
      <mesh ref={m} geometry={made.min} material={made.black} position={[0, 0, 0.035]} />
      <mesh ref={s} geometry={made.sec} material={made.orange} position={[0, 0, 0.05]} />
    </Tile>
  )
}

function MailIcon() {
  const made = useMemo(() => {
    const env = new RoundedBoxGeometry(0.6, 0.42, 0.08, 3, 0.03)
    const flap = new THREE.BufferGeometry()
    flap.setAttribute('position', new THREE.Float32BufferAttribute([-0.29, 0.2, 0, 0.29, 0.2, 0, 0, -0.04, 0], 3))
    flap.computeVertexNormals()
    const lineM = new THREE.MeshStandardMaterial({ color: '#d9e6f5', roughness: 0.5, side: THREE.DoubleSide })
    return { env, flap, white: mat('#ffffff', 0.35), lineM }
  }, [])
  useDispose(useMemo(() => Object.values(made), [made]))
  return (
    <Tile color="#1e88f0">
      <mesh geometry={made.env} material={made.white} position={[0, 0, 0.06]} castShadow />
      <mesh geometry={made.flap} material={made.lineM} position={[0, 0, 0.105]} />
    </Tile>
  )
}

/** Photos: ดอกกลีบแปดสี (ไอคอนทั่วไป ไม่มีรูปของใคร) */
function PhotosIcon() {
  const made = useMemo(() => {
    const petal = new THREE.SphereGeometry(1, 24, 16)
    petal.scale(0.09, 0.2, 0.05)
    petal.translate(0, 0.17, 0)
    const cols = ['#ff9f0a', '#ffd60a', '#a4d65e', '#30d158', '#40c8e0', '#5e5ce6', '#bf5af2', '#ff375f']
    return { petal, mats: cols.map((c) => mat(c, 0.3, { transparent: true, opacity: 0.92 })) }
  }, [])
  useDispose(useMemo(() => [made.petal, ...made.mats], [made]))
  return (
    <Tile color="#f7f7f9">
      {made.mats.map((m, i) => (
        <mesh key={i} geometry={made.petal} material={m} position={[0, 0, 0.06 + i * 0.004]} rotation={[0, 0, -(i / 8) * Math.PI * 2]} />
      ))}
    </Tile>
  )
}

/** Music: โน้ตคู่สีขาวบนพื้นแดงชมพู */
function MusicIcon() {
  const made = useMemo(() => {
    const head = new THREE.SphereGeometry(0.09, 24, 16)
    head.scale(1.25, 0.9, 0.7)
    const stem = new RoundedBoxGeometry(0.04, 0.42, 0.05, 2, 0.015)
    const beam = new RoundedBoxGeometry(0.3, 0.07, 0.05, 2, 0.02)
    return { head, stem, beam, white: mat('#ffffff', 0.3) }
  }, [])
  useDispose(useMemo(() => Object.values(made), [made]))
  return (
    <Tile color="#fa2d55">
      {[-0.13, 0.15].map((x, i) => (
        <group key={x} position={[x, i ? -0.12 : -0.16, 0.08]}>
          <mesh geometry={made.head} material={made.white} castShadow />
          <mesh geometry={made.stem} material={made.white} position={[0.08, 0.2, 0]} />
        </group>
      ))}
      <mesh geometry={made.beam} material={made.white} position={[0.08, 0.26, 0.08]} rotation={[0, 0, 0.12]} />
    </Tile>
  )
}

/* ---------------------------------------------------------------- เฟอร์นิเจอร์ */

/**
 * เก้าอี้ทรงอ่างสีเหลือง — พนักพิงโค้งโอบต่อเป็นชิ้นเดียวกับที่วางแขน เปิดด้านหน้า เบาะหนา
 * ขาเดี่ยวกลางบนฐานสี่แฉก แบบเก้าอี้ในภาพอ้างอิง
 *
 * พนักพิงคือ lathe ของหน้าตัดรูปตัว U (ผนังหนา ขอบบนมน) หมุนรอบแกนตั้งแค่ 250° ช่องที่เว้นไว้
 * อยู่ทาง +z (ด้านหน้าของเก้าอี้) คือช่องที่ขาของคนนั่งยื่นออกมา — ที่นั่งสูง SEAT_Y
 */
const SEAT_Y = 1.5
function Chair() {
  const made = useMemo(() => {
    const prof = [
      [0.92, 0],
      [1.02, 0.08],
      [1.08, 0.45],
      [1.07, 0.78],
      [1.0, 0.9],
      [0.9, 0.88],
      [0.86, 0.6],
      [0.84, 0.2],
      [0.8, 0.05],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const shell = new THREE.LatheGeometry(prof, 64, Math.PI * 0.24, Math.PI * 1.52)
    shell.computeVertexNormals()
    const seat = new THREE.CylinderGeometry(0.9, 0.95, 0.34, 48)
    const base = new THREE.CylinderGeometry(0.95, 0.85, 0.2, 48)
    const stem = new THREE.CylinderGeometry(0.08, 0.08, SEAT_Y - 0.4, 16)
    const leg = new RoundedBoxGeometry(0.12, 0.07, 0.9, 2, 0.03)
    return {
      shell,
      seat,
      base,
      stem,
      leg,
      yellow: mat('#f6be3d', 0.6, { side: THREE.DoubleSide, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color('#fff2c4'), clearcoat: 0 }),
      metal: mat('#e2dfd8', 0.3, { metalness: 0.6 }),
    }
  }, [])
  useDispose(useMemo(() => Object.values(made), [made]))
  return (
    <group>
      <mesh geometry={made.shell} material={made.yellow} position={[0, SEAT_Y - 0.2, 0]} castShadow receiveShadow />
      <mesh geometry={made.base} material={made.yellow} position={[0, SEAT_Y - 0.28, 0]} castShadow receiveShadow />
      <mesh geometry={made.seat} material={made.yellow} position={[0, SEAT_Y - 0.1, 0]} castShadow receiveShadow />
      <mesh geometry={made.stem} material={made.metal} position={[0, (SEAT_Y - 0.4) / 2, 0]} castShadow />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={made.leg} material={made.metal} position={[Math.sin(i * 1.571 + 0.78) * 0.42, 0.035, Math.cos(i * 1.571 + 0.78) * 0.42]} rotation={[0, i * 1.571 + 0.78, 0]} castShadow />
      ))}
    </group>
  )
}

/** โต๊ะไม้สีอิฐ + แล็ปท็อปหน้าจอไล่สี + แก้วน้ำ */
function Desk() {
  const lid = useMemo(
    () =>
      canvasTex(512, 360, (g) => {
        const grd = g.createLinearGradient(0, 360, 512, 0)
        grd.addColorStop(0, '#2d6cf0')
        grd.addColorStop(0.35, '#ff3d5a')
        grd.addColorStop(0.6, '#ff8a1f')
        grd.addColorStop(1, '#ffd23a')
        g.fillStyle = grd
        g.fillRect(0, 0, 512, 360)
        g.globalAlpha = 0.25
        for (let i = 0; i < 6; i += 1) {
          g.fillStyle = i % 2 ? '#ffffff' : '#7a1fff'
          g.beginPath()
          g.ellipse(80 + i * 80, 200 - i * 20, 220, 50, -0.6, 0, Math.PI * 2)
          g.fill()
        }
      }),
    [],
  )
  const made = useMemo(() => {
    const top = new RoundedBoxGeometry(3.6, 0.14, 1.9, 4, 0.05)
    const leg = new RoundedBoxGeometry(0.12, 2.1, 0.12, 2, 0.04)
    const base = new RoundedBoxGeometry(1.5, 0.06, 1.0, 3, 0.03)
    const lidG = new RoundedBoxGeometry(1.5, 1.0, 0.04, 3, 0.02)
    const screen = new THREE.PlaneGeometry(1.42, 0.92)
    const cup = new THREE.CylinderGeometry(0.2, 0.17, 0.42, 32)
    return {
      top,
      leg,
      base,
      lidG,
      screen,
      cup,
      wood: mat('#c9744a', 0.55, { clearcoat: 0.1 }),
      alu: mat('#c9ccd2', 0.25, { metalness: 0.7 }),
      screenM: new THREE.MeshBasicMaterial({ map: lid, toneMapped: false }),
      white: mat('#fafafa', 0.3),
      dark: mat('#1d1f24', 0.2),
    }
  }, [lid])
  useDispose(useMemo(() => [...Object.values(made), lid], [made, lid]))
  return (
    <group>
      <mesh geometry={made.top} material={made.wood} position={[0, 2.17, 0]} castShadow receiveShadow />
      {[
        [-1.65, -0.8],
        [1.65, -0.8],
        [-1.65, 0.8],
        [1.65, 0.8],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={made.leg} material={made.wood} position={[x, 1.05, z]} castShadow />
      ))}
      {/* แล็ปท็อป: จอหันเข้าหาตัวละคร ฝาหลังลายไล่สีหันมาทางกล้อง (แบบภาพอ้างอิง) */}
      <group position={[-0.95, 2.27, 0.35]} rotation={[0, -2.05, 0]}>
        <mesh geometry={made.base} material={made.alu} castShadow receiveShadow />
        <group position={[0, 0.02, -0.5]} rotation={[-0.25, 0, 0]}>
          <mesh geometry={made.lidG} material={made.alu} position={[0, 0.5, 0]} castShadow />
          {/* ฝาหลังลายไล่สี (ด้านที่กล้องเห็น) · หน้าจอด้านในเป็นจอดับสีเข้ม */}
          <mesh geometry={made.screen} material={made.screenM} position={[0, 0.5, -0.025]} rotation={[0, Math.PI, 0]} />
          <mesh geometry={made.screen} material={made.dark} position={[0, 0.5, 0.025]} />
        </group>
      </group>
      <mesh geometry={made.cup} material={made.white} position={[1.2, 2.45, -0.3]} castShadow />
    </group>
  )
}

/* ---------------------------------------------------------------- ตัวละคร */

/**
 * ท่านั่งพิมพ์งาน — ขางอ 90° ที่สะโพกกับเข่า ลำตัวตรง แขนสองข้างยื่นไปหน้าหาแป้นพิมพ์
 * ใช้ริกท่า skate (ไม่มีบอร์ด) เพราะเป็นท่าเดียวที่รับค่าข้อต่อขา/ลำตัว/แขนจากภายนอกได้
 */
/* HeroRider เป็น JSX — ค่าตั้งต้น null ของ prop ท่าทางถูกอนุมานเป็นชนิด null ส่งวัตถุตรง ๆ ไม่ได้ */
const Rider = HeroRider as unknown as React.ComponentType<Record<string, unknown>>

const SIT_LEG = {
  L: { hipX: -1.5, hipY: 0.08, hipZ: 0.05, knee: 1.55, ankle: 0.05 },
  R: { hipX: -1.5, hipY: -0.08, hipZ: -0.05, knee: 1.55, ankle: 0.05 },
  spread: 0.04,
  stagger: 0,
}
const SIT_TORSO = { leanX: -0.05, leanZ: 0, foldX: 0, foldY: 0, foldZ: 0, headX: 0.12 }

function Sitter() {
  const armPose = useMemo(() => {
    const base = armPoseFromTuner(getTuner())
    return {
      ...base,
      /* แขนชี้ (ขวาของตัว): ยื่นไปหน้าลงหาแป้นพิมพ์ */
      aimX: 0.25,
      aimY: -0.55,
      aimZ: 1,
      aimRotX: 0,
      aimRotY: 0,
      aimRotZ: 0,
      elbowX: 0,
      elbowY: 0,
      elbowZ: 0,
      wristX: 0,
      wristY: 0,
      wristZ: 0,
      mugShX: -0.75,
      mugShY: 0,
      mugShZ: 0,
      mugElX: -0.5,
      mugElY: 0,
      mugElZ: 0,
      mugRotX: 0,
      mugRotY: 0,
      mugRotZ: 0,
      mugWristX: 0,
      mugWristY: 0,
      mugWristZ: 0,
    }
  }, [])
  return <Rider noBoard noLean noLumber noWind noIdle legPose={SIT_LEG} torsoPose={SIT_TORSO} armPose={armPose} />
}

/* ---------------------------------------------------------------- ฉาก */

function Studio() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pm.fromScene(room, 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.45
    return () => {
      scene.environment = null
      env.dispose()
      room.clear()
      pm.dispose()
    }
  }, [gl, scene])
  return (
    <>
      <hemisphereLight args={['#ffffff', '#c8c9cf', 0.9]} />
      <directionalLight
        position={[-5, 9, 8]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={8}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight position={[6, 3, -3]} intensity={0.8} color="#dfe6ff" />
    </>
  )
}

export function GalleryScene() {
  return (
    <>
      <Studio />
      {/* ผนังไอคอน — แถวบน / แถวล่าง ตามภาพอ้างอิง */}
      <group position={[0.9, 0, -3]}>
        <Float pos={[-6.1, 4.9, 0]} phase={0} tilt={0.12}>
          <ChartIcon />
        </Float>
        <Float pos={[-4.0, 4.8, 0]} phase={0.9} tilt={0.1}>
          <CalendarWidget />
        </Float>
        <Float pos={[-1.75, 5.35, 0]} phase={1.7} tilt={0.05}>
          <MessageIcon />
        </Float>
        <Float pos={[0.7, 5.0, 0]} phase={2.4}>
          <KeynoteIcon />
        </Float>
        <Float pos={[3.0, 5.05, 0]} phase={3.1} tilt={-0.05}>
          <WeatherIcon />
        </Float>
        <Float pos={[5.3, 4.9, 0]} phase={3.8} tilt={-0.1}>
          <NotesIcon />
        </Float>
        <Float pos={[-5.9, 2.5, 0]} phase={1.2} tilt={0.12}>
          <ClockIcon />
        </Float>
        <Float pos={[-3.7, 2.3, 0]} phase={2.0} tilt={0.1}>
          <MailIcon />
        </Float>
        <Float pos={[2.1, 3.55, 0]} phase={2.7} tilt={-0.06}>
          <PhotosIcon />
        </Float>
        <Float pos={[5.1, 3.45, 0]} phase={0.4} tilt={-0.1}>
          <MusicIcon />
        </Float>
      </group>

      <group position={[-0.45, 0, 0.95]} rotation={[0, 0.8, 0]}>
        <Chair />
      </group>
      <group position={[3.05, 0, 1.75]} rotation={[0, -0.35, 0]}>
        <Desk />
      </group>
      <Suspense fallback={null}>
        <group position={[-0.25, 2.2, 0.75]} rotation={[0, 0.8, 0]} scale={0.9}>
          <Sitter />
        </group>
      </Suspense>

      {/* พื้นรับเงาอย่างเดียว — พื้นหลังเป็นสีของหน้า (CSS) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial opacity={0.18} />
      </mesh>
    </>
  )
}
