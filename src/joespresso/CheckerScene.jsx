import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Leva, useControls, button } from 'leva'
import { Mascot } from './scene/Mascot'
import { FigmaToolbar } from './scene/Panels'
import { useDisposable, useStaticSubtree, LOW_END } from './scene/utils'
import { tickIntro } from './intro'
import { setSceneReady } from '@/stores/ready'

/**
 * ฉาก 3 — "โลกตารางหมากรุก" (คอมพ์ 12601:287)
 *
 * แปลงภาพ ref เซอร์เรียลเป็น 3D ด้วยภาษาเดียวกับฉากหลัก: ทรงบล็อก/โลว์โพลี สีจัดจ้าน
 * แสงแดดสว่าง — แต่โทนเย็น (ฟ้า/เขียว/ขาว) แทนโทนอุ่นของฉาก hero
 *
 * องค์ประกอบตามภาพ: ผนังหลัง checker ฟ้าบิดเบี้ยว / พื้น checker หญ้า-คอนกรีต /
 * แนวหญ้าที่เส้นขอบฟ้า / ดอกไม้เหลืองยักษ์ห้อยจากขอบบน / ต้นอากาเว่ใบพัด /
 * กำแพงกระเบื้องขาว + กำแพงบล็อกฟ้า-ขาว มี mascot นั่งห้อยขาอยู่ข้างบน
 *
 * ทุก texture เป็น CanvasTexture วาดครั้งเดียว (ภาพนิ่ง — ไม่มีต้นทุนต่อเฟรม)
 * กำแพงบล็อกเป็น InstancedMesh ก้อนเดียว (สีต่อก้อนผ่าน instanceColor) — draw call เดียว
 */

// ---------- palette (อ่านจากภาพ ref) ----------
const SKY_BLUE = '#4fc6ee'
const SKY_PALE = '#b8ecfa'
const GRASS = '#3aa832'
const GRASS_DARK = '#2f8f2a'
const CONCRETE = '#eef1ea'
const BLOCK_BLUE = '#3ec9f2'
const BLOCK_WHITE = '#f4f6f1'
const STEM_GREEN = '#5a9e1e'
const PETAL_YELLOW = '#f5d500'

// ---------- textures ----------

/**
 * ผนังหลัง: checker ฟ้าที่ "บิดเหมือนผ้าโดนดูด" — วาดด้วย domain warp ระดับพิกเซล
 * (สุ่มอ่านลายตารางที่พิกัดถูกดัดด้วยคลื่น sine สองชุด) ทำครั้งเดียวตอนสร้าง
 */
function warpedCheckerTexture(size = 2048) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const A = new THREE.Color(SKY_BLUE)
  const B = new THREE.Color(SKY_PALE)
  const cells = 13
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      // สองคลื่นความถี่ต่างกัน เฟสไขว้แกน — ได้รอยบิดวน ๆ ไม่ใช่ลูกคลื่นเรียงแถว
      const wu = u + 0.055 * Math.sin(v * 9.2 + u * 4.0) + 0.03 * Math.sin(v * 21.0 + 1.7)
      const wv = v + 0.06 * Math.sin(u * 7.5 + 2.1) + 0.028 * Math.sin(u * 17.0 + v * 5.0)
      const k = (Math.floor(wu * cells) + Math.floor(wv * cells)) & 1
      const col = k ? A : B
      const i = (y * size + x) * 4
      img.data[i] = col.r * 255
      img.data[i + 1] = col.g * 255
      img.data[i + 2] = col.b * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  // ผนังกินพื้นที่จอเยอะแต่มุมมองเฉียง — mipmap เฉย ๆ เบลอ ต้อง anisotropy ช่วย
  tex.anisotropy = 8
  return tex
}

/** พื้น: checker หญ้า (จุด speckle สองเขียว) สลับคอนกรีตขาว */
function groundCheckerTexture(size = 1024, cells = 8) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const cell = size / cells
  for (let gy = 0; gy < cells; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const grass = (gx + gy) & 1
      ctx.fillStyle = grass ? GRASS : CONCRETE
      ctx.fillRect(gx * cell, gy * cell, cell, cell)
      if (grass) {
        // ขนหญ้า: จุดเขียวเข้มโปรย ๆ (สุ่มคงที่จากพิกัดช่อง — reload แล้วภาพเดิม)
        ctx.fillStyle = GRASS_DARK
        let s = gx * 37 + gy * 91 + 7
        const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280)
        for (let i = 0; i < 90; i++) {
          ctx.fillRect(gx * cell + rnd() * cell, gy * cell + rnd() * cell, 2.4, 5)
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  // ช่องละ ~2 หน่วยโลกแบบภาพ ref — วาด 8 ช่องแล้ว repeat แทนที่จะวาดช่องยักษ์
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 3)
  // พื้นถูกมองเฉียงเกือบราบ — ไม่มี anisotropy แล้ว mipmap ละลายเป็นปื้น
  tex.anisotropy = 8
  return tex
}

/** กำแพงกระเบื้องขาว: กริดร่องยาแนวจาง ๆ */
function tileTexture(size = 512, cells = 18) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#f6f7f3'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(160,168,158,0.55)'
  ctx.lineWidth = 2
  const cell = size / cells
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath()
    ctx.moveTo(i * cell, 0)
    ctx.lineTo(i * cell, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i * cell)
    ctx.lineTo(size, i * cell)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ---------- ฉากประกอบ ----------

function Backdrop() {
  // 2048 คมขึ้นชัดเจน (จอกว้าง ผนังกินเกือบทั้งเฟรม) — เครื่องอ่อนถอยกลับ 1024
  const sky = useMemo(() => warpedCheckerTexture(LOW_END ? 1024 : 2048), [])
  const ground = useMemo(() => groundCheckerTexture(), [])
  useDisposable(sky)
  useDisposable(ground)
  return (
    <>
      {/* ผนังหลัง — ไม่รับแสง สีจากภาพล้วน ๆ เหมือนฉากผ้าใบในสตูดิโอ */}
      {/* กล้องอยู่ซ้ายเล็งไปขวา — ขยับผนังตามไปขวาไม่ให้ขอบหลุดเข้าเฟรม */}
      <mesh position={[12, 9, -26]}>
        <planeGeometry args={[80, 36]} />
        <meshBasicMaterial map={sky} />
      </mesh>
      {/* พื้น checker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4]} receiveShadow>
        <planeGeometry args={[64, 44]} />
        <meshStandardMaterial map={ground} roughness={1} metalness={0} />
      </mesh>
      {/* แนวหญ้าหนา ๆ ก่อนถึงผนัง — เส้นขอบฟ้าของภาพ */}
      <mesh position={[0, 0.45, -17]} receiveShadow castShadow>
        <boxGeometry args={[64, 0.9, 10]} />
        <meshStandardMaterial color={GRASS} roughness={1} metalness={0} />
      </mesh>
    </>
  )
}

/**
 * กำแพงบล็อกฟ้า-ขาว — InstancedMesh เดียว สีต่อก้อน
 * แพตเทิร์นวางมือตามภาพ ref: ล่างแน่นเต็มแถว บนแหว่งเป็นขั้น ๆ ('.' = ไม่มีก้อน)
 */
const WALL_ROWS = [
  // ตาม comp 12601:287 — กำแพงตันสูง 5 ก้อน ลาย checker หลวม ๆ มีก้อนสีซ้ำติดกัน
  'BWWBWBBWBWWBWBWBBW',
  'WBBWBWWBWBBWBWWBWB',
  'BWBWWBWBWBWWBWBWBW',
  'WBWBWBBWBWBWBWBBWB',
  'BWBWBWBWBWBWBWBWBW',
]
const BLOCK = 0.92

function BlockWall({ position = [0, 0, 0] }) {
  const geo = useMemo(() => new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK), [])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 }),
    [],
  )
  useDisposable(geo)
  useDisposable(mat)
  const mesh = useMemo(() => {
    const cellsList = []
    WALL_ROWS.forEach((row, r) => {
      ;[...row].forEach((ch, cIdx) => {
        if (ch !== '.') cellsList.push([cIdx, WALL_ROWS.length - 1 - r, ch])
      })
    })
    const m = new THREE.InstancedMesh(geo, mat, cellsList.length)
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    const w = WALL_ROWS[0].length
    cellsList.forEach(([cx, cy, ch], i) => {
      dummy.position.set((cx - (w - 1) / 2) * BLOCK, cy * BLOCK + BLOCK / 2, 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, color.set(ch === 'B' ? BLOCK_BLUE : BLOCK_WHITE))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.castShadow = m.receiveShadow = true
    return m
  }, [geo, mat])
  return <primitive object={mesh} position={position} />
}

/** กำแพงกระเบื้องขาว — ระนาบหลังกำแพงบล็อก เยื้องซ้ายตาม ref */
function TileWall() {
  const tex = useMemo(() => tileTexture(), [])
  useDisposable(tex)
  return (
    <mesh position={[-0.8, 2.8, -7.4]} castShadow receiveShadow>
      <boxGeometry args={[7.5, 5.6, 0.5]} />
      <meshStandardMaterial map={tex} roughness={0.7} metalness={0} />
    </mesh>
  )
}

/** ดอกไม้เหลืองยักษ์ — ก้านโค้งสูงจนหัวดอกไปแตะขอบบนเฟรม */
function GiantFlower({ base = [0, 0, 0], tip = [0, 10, 0], lean = 0.4, seed = 1 }) {
  const { stemGeo } = useMemo(() => {
    const p0 = new THREE.Vector3(...base)
    const p3 = new THREE.Vector3(...tip)
    const p1 = p0.clone().lerp(p3, 0.35).add(new THREE.Vector3(lean, 0, 0))
    const p2 = p0.clone().lerp(p3, 0.75).add(new THREE.Vector3(-lean * 0.7, 0, 0))
    const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3])
    return { stemGeo: new THREE.TubeGeometry(curve, 24, 0.16, 8) }
  }, [base, tip, lean])
  useDisposable(stemGeo)
  const petals = useMemo(() => {
    // กลีบ = ทรงรีแบน ๆ เรียงรอบแกน — โลว์โพลีแบบเดียวกับพุ่มไม้ฉากหลัก
    const arr = []
    const n = 11
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + seed
      arr.push({ a, r: 1.15 })
    }
    return arr
  }, [seed])
  return (
    <group>
      <mesh geometry={stemGeo} castShadow>
        <meshStandardMaterial color={STEM_GREEN} roughness={0.8} metalness={0} />
      </mesh>
      {/* หัวดอกหันเฉียงลงหากล้องเล็กน้อย ให้เห็นหน้าดอกเหมือน ref */}
      <group position={tip} rotation={[0.9, 0, 0]}>
        {petals.map((p, i) => (
          <mesh
            key={i}
            position={[Math.cos(p.a) * p.r, 0, Math.sin(p.a) * p.r]}
            rotation={[0, -p.a, 0]}
            scale={[1.25, 0.28, 0.62]}
            castShadow
          >
            <sphereGeometry args={[0.75, 10, 8]} />
            <meshStandardMaterial color={PETAL_YELLOW} roughness={0.6} metalness={0} />
          </mesh>
        ))}
        <mesh scale={[1, 0.5, 1]}>
          <sphereGeometry args={[0.72, 12, 10]} />
          <meshStandardMaterial color="#e8a800" roughness={0.7} metalness={0} />
        </mesh>
      </group>
    </group>
  )
}

/** ต้นอากาเว่ — ใบแบนโค้งกางเป็นพัด (กรวยบี้แบนแล้วงอปลาย) */
function Agave({ position = [0, 0, 0], scale = 1 }) {
  const leaves = useMemo(
    () => [
      { yaw: 0, tilt: 0.12, len: 2.6 },
      { yaw: 0.5, tilt: 0.5, len: 2.2 },
      { yaw: -0.5, tilt: 0.5, len: 2.3 },
      { yaw: 0.9, tilt: 0.95, len: 1.7 },
      { yaw: -0.95, tilt: 0.9, len: 1.8 },
      { yaw: 0.25, tilt: 0.3, len: 2.5 },
      { yaw: -0.28, tilt: 0.28, len: 2.45 },
    ],
    [],
  )
  return (
    <group position={position} scale={scale}>
      {leaves.map((l, i) => (
        <group key={i} rotation={[0, l.yaw, l.tilt]}>
          {/* กรวยหัวลง = ใบเรียวปลายแหลม บี้แกน z ให้เป็นแผ่น */}
          <mesh position={[0, l.len / 2, 0]} scale={[1, 1, 0.34]} castShadow>
            <coneGeometry args={[0.34, l.len, 6]} />
            <meshStandardMaterial color="#4f9e2d" roughness={0.75} metalness={0} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * กล้อง debug (dev เท่านั้น): ติ๊ก freeCam ใน leva แล้วหมุน/แพน/ซูมเองด้วยเมาส์
 * ปุ่ม log camera พิมพ์ position + target ปัจจุบันลง console ไว้ก๊อปกลับมาใส่โค้ด
 */
function DebugCam() {
  const { camera } = useThree()
  const controls = useRef()
  const { freeCam } = useControls('camera', {
    freeCam: false,
    'log camera': button(() => {
      const p = camera.position
      const t = controls.current?.target ?? new THREE.Vector3()
      const text = [
        `position: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`,
        `lookAt: (${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)})`,
        `fov: ${camera.fov}`,
      ].join('\n')
      navigator.clipboard?.writeText(text).catch(() => {})
      // eslint-disable-next-line no-console
      console.log(text)
    }),
  })
  return (
    <>
      <SwayCam enabled={!freeCam} />
      {freeCam && <OrbitControls ref={controls} target={[-1.2, 3.05, 0]} makeDefault />}
    </>
  )
}

/** กล้องนิ่ง + เอียงตามเมาส์นิด ๆ — ภาษาเดียวกับฉากหลักแต่เบากว่า */
function SwayCam({ enabled = true }) {
  const { camera } = useThree()
  const cur = useRef({ x: 0, y: 0 })
  useFrame(({ pointer }, dt) => {
    if (!enabled) return
    const d = Math.min(dt, 0.05)
    cur.current.x += (pointer.x - cur.current.x) * (1 - Math.exp(-d / 0.25))
    cur.current.y += (pointer.y - cur.current.y) * (1 - Math.exp(-d / 0.25))
    // มุมตามภาพ ref: กล้องต่ำ เงยขึ้น เยื้องซ้ายของเสาหัวมุม — mascot ใหญ่กลางเฟรม
    // กำแพงวิ่งยาวออกขวาจนพ้นเฟรม พื้น checker เห็นเฉียง ๆ มุมล่างซ้าย
    camera.position.x = -5.39 + cur.current.x * 0.45
    camera.position.y = 2.54 + cur.current.y * 0.3
    camera.lookAt(-1.2, 3.05, 0)
  })
  return null
}

/**
 * ท่านั่งห้อยขาบนกำแพง — ทับชุด Sit ของ rig ผ่าน poseOverride (ดู Mascot.jsx)
 * sitPreview 1 = นั่งค้างถาวรโดยไม่พึ่งไทม์ไลน์ scroll ของฉากหลัก
 */
const WALL_SIT_POSE = {
  sitOn: true,
  sitPreview: 1,
  // ก้นวางบนสันกำแพง ไม่ต้องหย่อนลงลึกแบบนั่งสตูล — ขาห้อยพ้นหน้ากำแพงลงมา
  sitDown: 0.72,
  sitBack: 0.05,
  sitHip: -1.5,
  sitKnee: 1.35,
  sitAnkle: 0.25,
  // แขนวางข้างตัว ไม่ใช่ท่าพิมพ์งาน
  sitArmX: -0.15,
  sitElbowX: 0.15,
}

function StaticGroup({ children }) {
  const ref = useRef()
  useStaticSubtree(ref)
  return <group ref={ref}>{children}</group>
}

/**
 * โหมด embedded (/2026): สปแลชตัวอักษรของหน้านั้นรอสองสัญญาณ —
 * setSceneReady (โหลด+compile เสร็จ) กับ introState ที่ต้องมีคนหมุนนาฬิกาให้
 * ฉากนี้ไม่มีไทม์ไลน์ intro ของตัวเอง แต่ต้องหมุน tickIntro ไม่งั้นรูสปแลชค้างกลางทาง
 */
function IntroTick() {
  useFrame((_, delta) => tickIntro(Math.min(delta, 0.05)), -1)
  return null
}

function SceneReady() {
  const { gl, scene, camera } = useThree()
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    if (typeof gl.compileAsync === 'function') {
      gl.compileAsync(scene, camera).then(setSceneReady, setSceneReady)
    } else {
      setSceneReady()
    }
  })
  return null
}

export default function CheckerScene({ embedded = false }) {
  return (
    <div className={embedded ? 'absolute inset-0' : 'fixed inset-0'}>
      {!embedded && <Leva hidden={!import.meta.env.DEV} collapsed />}
      <Canvas
        shadows
        dpr={[1, LOW_END ? 1.5 : 2]}
        camera={{ position: [-5.39, 2.54, 8.15], fov: 36, near: 0.1, far: 90 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
        }}
      >
        <color attach="background" args={[SKY_PALE]} />
        {import.meta.env.DEV ? <DebugCam /> : <SwayCam />}
        {embedded && <IntroTick />}

        {/* แดดจ้ากลางวัน — key ขาวแรงเงาคม + fill ฟ้าจากท้องฟ้า checker */}
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#dff6ff', '#6fae62', 0.55]} />
        <directionalLight
          castShadow
          position={[6, 12, 8]}
          intensity={2.1}
          color="#fff6e8"
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.04}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-6}
          shadow-camera-far={40}
        />
        <directionalLight position={[-7, 5, 10]} intensity={0.5} color="#dff2ff" />

        {/* toolbar ลอยบนฟ้า — ภาษาเดียวกับฉากหลัก: เครื่องมือออกแบบลอยรอบตัว
            อยู่นอก StaticGroup เพราะปุ่มกดเลือกได้ (ต้องรับ raycast/อัปเดต) */}
        {/* ปิดเงา — แดดสาดลงมาเป็นปื้นรูปแท่งบน tile wall รกภาพ (ของลอยบนฟ้าไม่ควรทิ้งเงา) */}
        <group onUpdate={(g) => g.traverse((o) => (o.castShadow = false))}>
          <FigmaToolbar position={[-1.4, 6.8, -5]} rotation={[0.12, -0.18, 0]} />
        </group>

        <StaticGroup>
          <Backdrop />
          <TileWall />
          {/* เริ่มกลางเฟรม (เห็นหน้าตัดหัวมุมซ้าย) แล้ววิ่งยาวออกขวาพ้นเฟรม — ตาม comp */}
          <BlockWall position={[8.05, 0, -6]} />
          <Agave position={[-3.6, 0, -3]} scale={1.1} />
          {/* หัวดอกสองต้นโดนตัดขอบบนเฟรม ก้านโค้งเข้าหากลางภาพ */}
          <GiantFlower base={[-6.8, 0, -9.5]} tip={[-5.7, 9.4, -8]} lean={1.6} seed={0.6} />
          <GiantFlower base={[8.6, 0, -9]} tip={[7.2, 8.6, -6.5]} lean={-1.4} seed={2.2} />
        </StaticGroup>

        {/* mascot นั่งบนสันกำแพงบล็อก — instance แยกอิสระ ท่านั่งของตัวเอง */}
        <Suspense fallback={null}>
          <Mascot
            isolated
            noIdle={false}
            armsDown
            // นั่งบนสันกำแพง ค่อนไปริมซ้าย (ไม่คร่อมขอบสุด — ก้อนใต้ตัวต้องเห็นชัด) ขาห้อยพ้นหน้ากำแพง
            // นั่งใกล้หัวมุมซ้ายของกำแพง ข้างสัน tile wall — ตาม comp
            position={[1.1, WALL_ROWS.length * BLOCK + 2.2, -5.95]}
            scale={0.62}
            rotation={[0, 0, 0]}
            poseOverride={WALL_SIT_POSE}
          />
          {embedded && <SceneReady />}
        </Suspense>
      </Canvas>
    </div>
  )
}
