import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { JOURNEY } from '@/data/journey'
import { loadTileTexture, makeLabelTexture } from './tunnelTexture'

/**
 * จอ Experiences — อุโมงค์กระเบื้องสามมิติที่เล่าเส้นทางการทำงาน
 *
 * จบจอ What I Do แล้วการ์ด mascot จะขยายเต็มจอ ก่อนจะจางออกไปเผยอุโมงค์ที่อยู่ข้างหลัง
 * ระยะ scroll ในกรอบ (สูงหลายเท่าจอ) = ระยะทางที่กล้องพุ่งเข้าไปในอุโมงค์ ผนังอุโมงค์เป็น
 * กระเบื้องหนาจริง (กล่อง ไม่ใช่ระนาบแปะรูป) แต่ละใบมีโลโก้เครื่องมือที่ใช้จริง และเป็นระยะ ๆ
 * จะเจอ "ป้ายหมุด" ของที่ทำงานแต่ละที่ เรียงตามไทม์ไลน์จริงจาก src/data/journey
 *
 * ค่าที่เปลี่ยนทุกเฟรม (ระยะ scroll) อยู่ในอ็อบเจกต์นอก React — setState ใน useFrame คือ
 * re-render หกสิบครั้งต่อวินาที ส่วน state ของ React มีตัวเดียว: "ตอนนี้เล่าถึงหมุดไหน"
 */

// ตัวละครตัวเดียวกับที่ใช้ทั้งเว็บ — chunk หนัก แยกโหลดทั้งคู่
const Mascot = lazy(() => import('@/joespresso/scene/Mascot').then((m) => ({ default: m.Mascot })))
const MascotCard = lazy(() =>
  import('@/joespresso/MascotCard').then((m) => ({ default: m.MascotCard })),
)

/** ระยะจากจุดกำเนิดของ GLB ลงไปถึงฝ่าเท้า (หน่วยของโมเดล) — ใช้จัดให้เห็นเต็มตัว */
const FEET_BELOW_ORIGIN = 4.97

/**
 * ผังอุโมงค์เป็น "กริด" ไม่ใช่กระเบื้องโปรยมั่ว — ผนังทั้งสี่ด้านปูเต็มด้วยช่องขนาดเท่ากัน
 * เว้นร่องเท่ากันทุกช่อง ร่องคือช่องว่างที่เห็นเปลือกด้านในสีเข้ม จึงอ่านเป็นเส้นกริด
 */
/** ครึ่งความกว้างของอุโมงค์ (หน่วยฉาก) */
const R = 3.2
/** จำนวนช่องต่อผนังหนึ่งด้าน */
const COLS = 5
/** ระยะจากกลางช่องถึงกลางช่องถัดไป */
const STEP = (R * 2) / COLS
/** ขนาดช่องจริง — เล็กกว่า STEP อยู่หนึ่งร่อง */
const CELL = STEP - 0.16
/**
 * อุโมงค์วนไม่รู้จบ: ลายซ้ำทุก LOOP หน่วย จึงปูจริงสองเท่าของคาบแล้วเลื่อนทั้งก้อนไปข้างหน้า
 * พอเลื่อนครบหนึ่งคาบก็วนกลับ ภาพต่อเนียนโดยไม่ต้องคำนวณตำแหน่งกระเบื้องใหม่ทุกเฟรม
 * (คิดตำแหน่งใหม่ทีละใบต่อเฟรม = งานหลายร้อยชิ้นต่อเฟรมโดยไม่จำเป็น)
 */
const RINGS_PER_LOOP = 16
const RINGS = RINGS_PER_LOOP * 2
const LOOP = RINGS_PER_LOOP * STEP
/** ระยะที่ "บินได้" ทั้งจอ — ใช้แปลงระยะ scroll เป็นระยะทางในอุโมงค์ */
const TRAVEL = LOOP * 5

/**
 * ค่ากลางที่ฉากอ่านทุกเฟรม (ไม่ใช่ state)
 * t = ระยะบินในอุโมงค์ 0..1 · open = ความคืบหน้าของการซูมเข้าไปในกล่อง 0..1
 */
const flight = { t: 0, open: 0 }

/** มุมกล้องตอนซูมสุด / ตอนกางเต็มจอแล้ว — ต่างกันคือความรู้สึกว่ากล้อง "พุ่งเข้าไป" ในกล่อง */
const FOV_IN = 42
const FOV_OUT = 62

/** สกรีนช็อตงานจริง — แกลเลอรีบนผนังอุโมงค์เป็นผลงานที่ทำจริง ไม่ใช่ภาพ stock */
const WORK_SHOTS = Object.values(
  import.meta.glob('../../assets/works/health/*.{png,jpg,jpeg,webp}', {
    eager: true,
    import: 'default',
    query: '?url',
  }) as Record<string, string>,
)

/** โลโก้เครื่องมือที่ใช้จริง — ไฟล์ที่มีอยู่ในโปรเจกต์ ไม่ได้ไปหยิบของใครมาแปะ */
const TOOL_LOGOS = Object.values(
  import.meta.glob(
    [
      '../../assets/figma-color.svg',
      '../../assets/vs-code-color.svg',
      '../../assets/github-color.svg',
      '../../assets/jira-icon.svg',
      '../../assets/monday-color.svg',
      '../../assets/clickup-icon.svg',
      '../../assets/powerbi.svg',
      '../../assets/vue.svg',
      '../../assets/rstudio.svg',
      '../../assets/photoshop-icon.svg',
      '../../assets/excel.svg',
      '../../assets/scratch-icon.svg',
    ],
    { eager: true, import: 'default', query: '?url' },
  ) as Record<string, string>,
)

/** หมุดไทม์ไลน์: ที่ไหน ตอนไหน — เนื้อหามาจาก JOURNEY ทั้งหมด ไม่มีอะไรแต่งเพิ่ม */
const STOPS = JOURNEY.map((s, i) => ({
  ...s,
  /** สัดส่วนของระยะบินที่หมุดนี้จะวิ่งมาถึงหน้ากล้องพอดี */
  at01: (i + 1) / (JOURNEY.length + 1),
}))

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

/** ผนังสี่ด้าน: จุดกลางผนัง + การหมุนให้หน้ากระเบื้องหันเข้าใน */
const WALLS: { pos: [number, number, number]; rot: [number, number, number] }[] = [
  { pos: [-R, 0, 0], rot: [0, Math.PI / 2, 0] },
  { pos: [R, 0, 0], rot: [0, -Math.PI / 2, 0] },
  { pos: [0, R, 0], rot: [Math.PI / 2, 0, 0] },
  { pos: [0, -R, 0], rot: [-Math.PI / 2, 0, 0] },
]

type Slot = { wall: number; col: number; ring: number }

const slotKey = (s: Slot) => `${s.ring}-${s.wall}-${s.col}`

/** ตำแหน่ง/การหมุนของช่องหนึ่งในกริด */
function slotTransform(s: Slot) {
  const wall = WALLS[s.wall]
  const slide = (s.col - (COLS - 1) / 2) * STEP
  const along = new THREE.Vector3(slide, 0, 0).applyEuler(new THREE.Euler(...wall.rot))
  return {
    position: [wall.pos[0] + along.x, wall.pos[1] + along.y, -s.ring * STEP + along.z] as [
      number,
      number,
      number,
    ],
    rotation: wall.rot,
  }
}

/**
 * ช่องเปล่าทั้งหมดเป็น InstancedMesh ก้อนเดียว
 *
 * กริดเต็มอุโมงค์คือช่องระดับหกร้อยช่อง ถ้าทำเป็น mesh ละใบก็หกร้อย draw call เพื่อกล่อง
 * ที่หน้าตาเหมือนกันหมด ต่างกันแค่เฉดสี — instancedMesh + instanceColor จบใน draw call เดียว
 */
function GridCells({ skip }: { skip: Set<string> }) {
  const ref = useRef<THREE.InstancedMesh>(null)

  const slots = useMemo(() => {
    const out: Slot[] = []
    for (let ring = 0; ring < RINGS; ring++)
      for (let wall = 0; wall < WALLS.length; wall++)
        for (let col = 0; col < COLS; col++) {
          const s = { ring, wall, col }
          if (!skip.has(slotKey(s))) out.push(s)
        }
    return out
  }, [skip])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const scale = new THREE.Vector3(CELL, CELL, 0.14)
    const color = new THREE.Color()
    slots.forEach((s, i) => {
      const t = slotTransform(s)
      q.setFromEuler(new THREE.Euler(...t.rotation))
      m.compose(new THREE.Vector3(...t.position), q, scale)
      mesh.setMatrixAt(i, m)
      // เฉดน้ำเงินไล่กันเล็กน้อยต่อช่อง — กริดจึงไม่แบนเป็นสีเดียวทั้งผนัง
      const k = hash(s.ring * 17 + s.wall * 5 + s.col)
      color.setHSL(0.62, 0.72, 0.24 + k * 0.16)
      mesh.setColorAt(i, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [slots])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, slots.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.42} metalness={0.12} />
    </instancedMesh>
  )
}

/** ช่องที่มีรูป — ใบเดี่ยว เพราะแต่ละใบมี texture ของตัวเอง */
function FaceCell({
  geo,
  edge,
  face,
  slot,
  span = 1,
}: {
  geo: THREE.BoxGeometry
  edge: THREE.Material
  face: THREE.Material
  slot: Slot
  /** กินกี่ช่องของกริด — หมุดไทม์ไลน์กินสองช่อง */
  span?: number
}) {
  const t = slotTransform(slot)
  // ลำดับหน้าของ BoxGeometry: +x, -x, +y, -y, +z, -z — หน้ารูปคือ +z (หันเข้าอุโมงค์)
  const mats = useMemo(() => [edge, edge, edge, edge, face, edge], [edge, face])
  const size = CELL * span + STEP * (span - 1)
  // ใบที่กินหลายช่องต้องเลื่อนไปครึ่งช่องต่อช่องที่เกิน ไม่งั้นมันจะเยื้องไปทับร่องข้าง ๆ
  const off = ((span - 1) * STEP) / 2
  const wall = WALLS[slot.wall]
  const shift = new THREE.Vector3(off, 0, 0).applyEuler(new THREE.Euler(...wall.rot))
  return (
    <mesh
      geometry={geo}
      material={mats}
      position={[t.position[0] + shift.x, t.position[1] + shift.y, t.position[2] + shift.z - off]}
      rotation={t.rotation}
      scale={[size, size, 0.16]}
    />
  )
}

function Tunnel() {
  const group = useRef<THREE.Group>(null)
  const marks = useRef<THREE.Group>(null)

  const { geo, edge, faces, labelFaces } = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const edge = new THREE.MeshStandardMaterial({
      color: '#1c46b4',
      roughness: 0.42,
      metalness: 0.15,
    })
    /**
     * หน้ากระเบื้องที่มีรูป "เรืองแสงเอง" เล็กน้อย (emissiveMap ตัวเดียวกับ map)
     * ไฟดวงเดียวที่เดินไปกับกล้องทำให้ช่องที่อยู่ไกลมืดสนิท โลโก้กับป้ายชื่อจึงต้องมีแสง
     * ของตัวเองพอให้อ่านออกก่อนกล้องจะถึง — ไม่ใช่โผล่มาสว่างวาบตอนผ่านหน้า
     */
    const mk = (map: THREE.Texture, glow = 0.55) =>
      new THREE.MeshStandardMaterial({
        map,
        emissive: '#ffffff',
        emissiveMap: map,
        emissiveIntensity: glow,
        roughness: 0.3,
        metalness: 0.1,
      })
    const faces = [
      ...WORK_SHOTS.map((src) => mk(loadTileTexture(src, 512, '#12307f', 'cover'), 0.35)),
      ...TOOL_LOGOS.map((src) => mk(loadTileTexture(src))),
    ]
    // ป้ายหมุด: ที่ไหนมีไฟล์โลโก้จริงก็ใช้โลโก้ ที่ไหนไม่มีก็เขียนชื่อจริงลงไปแทน
    const labelFaces = STOPS.map((s) =>
      mk(
        s.logos?.[0]
          ? loadTileTexture(s.logos[0].src, 512, '#fd5000')
          : makeLabelTexture(s.at.replace('@', ''), 512),
        0.9,
      ),
    )
    return { geo, edge, faces, labelFaces }
  }, [])

  useEffect(
    () => () => {
      geo.dispose()
      edge.dispose()
      for (const m of [...faces, ...labelFaces]) {
        m.map?.dispose()
        m.dispose()
      }
    },
    [geo, edge, faces, labelFaces],
  )

  /** ช่องที่ถูกจองไว้ให้โลโก้ — กระจายทั่วอุโมงค์แบบคงที่ ไม่สุ่มใหม่ทุกครั้งที่วาด */
  const logoSlots = useMemo(
    () =>
      faces.map((_, i) => {
        const seed = i * 13 + 3
        return {
          ring: 2 + Math.floor(hash(seed) * (RINGS - 4)),
          wall: Math.floor(hash(seed + 41) * WALLS.length) % WALLS.length,
          col: Math.floor(hash(seed + 77) * COLS) % COLS,
        }
      }),
    [faces],
  )

  /** ช่องของหมุดไทม์ไลน์ — กินสองช่อง อยู่ที่ความลึกตามลำดับจริง */
  const stopSlots = useMemo(
    () =>
      STOPS.map((s, i) => ({
        ring: Math.round((s.at01 * TRAVEL) / STEP),
        wall: i % 2 ? 0 : 1,
        col: i % 2 ? 1 : COLS - 2,
      })),
    [],
  )

  const skip = useMemo(() => {
    const set = new Set<string>()
    for (const s of logoSlots) set.add(slotKey(s))
    for (const s of stopSlots) {
      // หมุดกินสองช่องทั้งแนวขวางและแนวลึก จึงต้องเว้นช่องข้างเคียงด้วย
      for (const dc of [0, 1]) for (const dr of [0, 1]) set.add(slotKey({ ...s, col: s.col + dc, ring: s.ring + dr }))
    }
    return set
  }, [logoSlots, stopSlots])

  useFrame(({ clock }) => {
    /**
     * กล้องอยู่กับที่ อุโมงค์เป็นฝ่ายวิ่งเข้าหา — แบบนี้ถึงจะวนไม่รู้จบได้จริง
     * ระยะทาง = ระยะ scroll + เวลาที่เดินเอง (แกลเลอรีจึงไม่หยุดนิ่งตอนคนหยุดเลื่อน)
     */
    const dist = flight.t * TRAVEL + clock.elapsedTime * 1.35
    const g = group.current
    if (g) {
      g.position.z = ((dist % LOOP) + LOOP) % LOOP
      g.rotation.z = Math.sin(dist * 0.02) * 0.09
    }
    // ป้ายหมุดไม่วน — มันต้องมาถึงตรงจังหวะที่เรื่องเล่าไปถึงที่นั่นพอดี
    if (marks.current) marks.current.position.z = flight.t * TRAVEL
  })

  return (
    <>
      <group ref={group}>
        <GridCells skip={skip} />
        {logoSlots.map((slot, i) => (
          <FaceCell key={`logo-${i}`} geo={geo} edge={edge} face={faces[i % faces.length]} slot={slot} />
        ))}
      </group>

      {/* ป้ายหมุดของแต่ละที่ — ใบใหญ่กินสี่ช่อง เพื่อให้อ่านออกตอนมันวิ่งผ่านหน้า */}
      <group ref={marks}>
        {stopSlots.map((slot, i) => (
          <FaceCell key={STOPS[i].at} geo={geo} edge={edge} face={labelFaces[i]} slot={slot} span={2} />
        ))}
      </group>
    </>
  )
}

/**
 * ซูมเข้าไปในกล่องด้วยมุมกล้อง ไม่ใช่ CSS transform
 *
 * ถ้าขยายแคนวาสด้วย scale() ภาพที่ถูกยืดคือพิกเซลที่เรนเดอร์มาแล้ว = เบลอตามอัตราขยาย
 * ขยับ fov แทน ทุกเฟรมเรนเดอร์ที่ความละเอียดเต็ม ภาพคมตลอดการซูม
 */
function ZoomIn() {
  useFrame(({ camera }) => {
    const cam = camera as THREE.PerspectiveCamera
    const want = FOV_IN + (FOV_OUT - FOV_IN) * flight.open
    if (Math.abs(cam.fov - want) < 0.01) return
    cam.fov = want
    cam.updateProjectionMatrix()
  })
  return null
}

function Lights() {
  // ไฟดวงหลักอยู่ตรงหน้ากล้อง (ซึ่งอยู่กับที่) — กระเบื้องที่วิ่งเข้ามาใกล้จึงสว่างขึ้นแล้วจมกลับเข้าหมอก
  return (
    <>
      <ambientLight intensity={0.9} color="#9db8ff" />
      <pointLight position={[0, 0, 1.5]} intensity={70} distance={30} decay={1.8} color="#eaf1ff" />
    </>
  )
}

/**
 * ตัวละครที่ลอยอยู่ในอุโมงค์ — เป็นของในฉากสามมิติ ไม่ใช่การ์ด HTML ที่ลอยทับ
 *
 * ช่วงแรกของ section มันอยู่ตรงหน้ากล้องเต็มตัวเต็มจอ (ต่อจากกระเบื้องตัวละครของ What I Do
 * ที่กำลังกางออก) พอเริ่มบิน มันก็ลอยเลี้ยงตัวไปมาแบบไร้แรงโน้มถ่วง — ลอยไกลขึ้น เยื้องออก
 * ข้าง และหมุนช้า ๆ เหมือนว่ายอยู่ในอวกาศ ไม่ใช่ค้างอยู่กลางเฟรมตลอดทาง
 *
 * ทุกอย่างวัดจากกล้อง ไม่ใช่พิกัดโลก เพราะกล้องเลื่อนไปตามระยะ scroll ตลอดเวลา
 */
function FloatingMascot() {
  const rig = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const g = rig.current
    if (!g) return
    const t = flight.t
    const time = clock.elapsedTime

    // ระยะห่างจากกล้อง: ใกล้มากตอนเต็มจอ แล้วถอยออกเมื่อเริ่มบิน
    // เริ่มไกลพอให้เห็นเต็มตัวตั้งแต่เฟรมแรกของอุโมงค์ (มุมกล้องช่วงซูมแคบกว่าปกติ ตัวจึงดูใหญ่ขึ้น)
    const dist = 6.2 + t * 4.0
    // เยื้องออกข้างและลอยขึ้นลง เริ่มจากศูนย์กลางเป๊ะ แล้วค่อยกว้างขึ้นตามระยะบิน
    const sway = Math.min(1, t / 0.25)
    // ลอยออกไปทางข้างเป็นหลัก ไม่ใช่ค้างกลางเฟรม — กลางเฟรมเป็นที่ของข้อความที่กำลังเล่า
    g.position.set(
      (2.3 + Math.sin(time * 0.31) * 0.7) * Math.sin(time * 0.19 + 1.2) * sway,
      Math.sin(time * 0.33) * 1.15 * sway,
      -dist,
    )
    // หมุนช้า ๆ สามแกนคนละความถี่ = ตัวลอยเคว้งแบบไร้แรงโน้มถ่วง ไม่ใช่หมุนรอบแกนเดียว
    // + PI เพราะด้านหน้าของโมเดลหันไปทาง -z ส่วนกล้องมองมันจากทาง +z (ไม่งั้นเห็นแต่หลัง)
    g.rotation.set(
      Math.sin(time * 0.27) * 0.5 * sway,
      time * 0.18 * sway + Math.sin(time * 0.4) * 0.45 * sway,
      Math.sin(time * 0.21) * 0.42 * sway,
    )
  })

  return (
    <group ref={rig}>
      {/* ยกขึ้นครึ่งตัว — จุดกำเนิดของ GLB อยู่แถวหัว ถ้าไม่ยก ตัวจะจมใต้กึ่งกลางเฟรม */}
      <group position={[0, FEET_BELOW_ORIGIN * 0.5 * 0.42, 0]}>
        <Suspense fallback={null}>
          <Mascot scale={0.5} isolated noIdle armsDown />
        </Suspense>
      </group>
    </group>
  )
}

/** ท่อนเล่าเรื่องกลางจอ — เปลี่ยนตามหมุดที่กล้องกำลังผ่าน */
function Story({ stop }: { stop: number }) {
  const s = STOPS[stop]
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <p className="v3-eyebrow text-[var(--v3-orange)]">{s.at}</p>
      <h3 className="v3-h1 mt-4 max-w-[16ch] uppercase">{s.role}</h3>
      <p className="mt-5 max-w-[46ch] text-[clamp(14px,1.9svh,18px)] leading-normal text-white/80">
        {s.org}
      </p>
      {s.quote && (
        <p className="mt-3 max-w-[46ch] text-[clamp(13px,1.7svh,16px)] leading-normal text-white/60">
          {s.quote}
        </p>
      )}
    </div>
  )
}

/**
 * @param id  ไอดีของ section — ใช้ผูกกับราวจุดนำสายตาของหน้า
 */
export function ExperienceTunnel({ id = 'experiences' }: { id?: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const [stop, setStop] = useState(0)
  /** ชั้นอุโมงค์ที่ถูกครอบด้วยกรอบ — กรอบขยายจากกระเบื้องตัวละครจนเต็มจอ */
  const clip = useRef<HTMLDivElement>(null)
  /** การ์ดเบจใบเดิมที่ซ้อนอยู่บนกรอบ แล้วจางออกตอนอุโมงค์เข้ามาแทน */
  const card = useRef<HTMLDivElement>(null)
  const story = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = frame.current
    if (!el) return
    let raf = 0
    /** กรอบล่าสุดของกระเบื้องตัวละครบนจอ ตอนที่จอ What I Do ยังถูกหมุดอยู่ */
    let tile: DOMRect | null = null

    const read = () => {
      raf = 0
      const box = el.getBoundingClientRect()
      const span = el.offsetHeight - window.innerHeight
      if (span <= 0) return
      const p = Math.min(1, Math.max(0, -box.top / span))

      /**
       * กรอบของกระเบื้องตัวละคร "ตอนที่มันถูกหมุดอยู่กลางจอ" ไม่ใช่ตอนนี้
       *
       * พอ scroll มาถึงจอนี้ จอ What I Do เลิกหมุดไปแล้วหนึ่งวิวพอร์ต กระเบื้องจึงลอยอยู่
       * เหนือจอ วัดสด ๆ จะได้ค่าติดลบ ที่ต้องการคือพิกัดตอนถูกหมุด = พิกัดของมันเทียบกับ
       * บล็อก sticky ที่ห่อมันอยู่ (ตอนถูกหมุด บล็อกนั้น top = 0 พอดี) ค่านี้คงที่ วัดครั้งเดียวพอ
       */
      if (!tile || p < 0.35) {
        const node = document.querySelector('[data-mascot-tile]')
        const sticky = node?.closest('[class*="lg:sticky"]')
        if (node && sticky) {
          const n = node.getBoundingClientRect()
          const k = sticky.getBoundingClientRect()
          tile = new DOMRect(n.left, n.top - k.top, n.width, n.height)
        }
      }

      /**
       * ซูมเข้าไป "ในกล่อง": กรอบเริ่มที่ตำแหน่ง/ขนาดของกระเบื้องตัวละครจริง แล้วกางจนเต็มจอ
       * ตัวอุโมงค์เป็นแคนวาสเต็มจอที่ถูก clip ด้วยกรอบนี้ — ไม่ได้ย่อ/ขยายแคนวาส (ซึ่งจะสั่ง
       * resize ทุกเฟรม) ส่วนการ์ดเบจใบเดิมซ้อนทับอยู่แล้วจางออกระหว่างทาง ภาพจึงต่อจาก
       * กระเบื้องของ What I Do โดยตรง ไม่ใช่ตัดไปฉากใหม่
       */
      const g = Math.min(1, p / 0.2)
      const e = g * g * (3 - 2 * g)
      const vw = window.innerWidth
      const vh = window.innerHeight
      const r = tile ?? new DOMRect(vw * 0.34, vh * 0.3, vw * 0.32, vh * 0.4)
      const left = r.left * (1 - e)
      const top = r.top * (1 - e)
      const right = (vw - r.right) * (1 - e)
      const bottom = (vh - r.bottom) * (1 - e)

      if (clip.current) {
        clip.current.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`
      }
      flight.open = e
      if (card.current) {
        card.current.style.left = `${left}px`
        card.current.style.top = `${top}px`
        card.current.style.width = `${vw - left - right}px`
        card.current.style.height = `${vh - top - bottom}px`
        // จางเร็วกว่าจังหวะกางกล่อง: ถ้าค้างอยู่นาน ตัวละครในการ์ดจะซ้อนกับตัวจริงในอุโมงค์เป็นภาพซ้อน
        card.current.style.opacity = String(Math.max(0, 1 - e * 3))
      }
      if (story.current) {
        story.current.style.opacity = String(Math.min(1, Math.max(0, (p - 0.24) / 0.06)))
      }

      // ระยะบินในอุโมงค์เริ่มนับหลังกรอบกางเต็มจอแล้ว
      flight.t = Math.min(1, Math.max(0, (p - 0.2) / 0.8))
      // หมุดที่ i อยู่ลึก (i+1)/(n+1) ของอุโมงค์ — เล่าถึงมันตั้งแต่ก่อนกล้องจะถึงเล็กน้อย
      let next = 0
      for (let i = 0; i < STOPS.length; i++) {
        if (flight.t >= (i + 1) / (STOPS.length + 1) - 0.12) next = i
      }
      setStop((cur) => (cur === next ? cur : next))
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    const onResize = () => {
      tile = null
      onScroll()
    }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <section id={id} data-screen={id} ref={frame} className="relative h-[460svh] w-full">
      {/* พื้นของจอเป็นสีเดียวกับจอก่อนหน้า — นอกกรอบที่กำลังกางจึงยังเป็นหน้าเดิม ไม่ใช่ขอบดำ */}
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[var(--v3-blue)]">
        <div ref={clip} className="absolute inset-0" style={{ clipPath: 'inset(0px)' }}>
          <Canvas
            aria-hidden
            className="absolute inset-0"
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 0], fov: FOV_IN, near: 0.1, far: 90 }}
            gl={{ antialias: true }}
          >
            {/* หมอกสีเดียวกับพื้นอุโมงค์ — ปลายอุโมงค์จมหายแทนที่จะถูกตัดเป็นขอบ */}
            <color attach="background" args={['#0b1f5e']} />
            <fog attach="fog" args={['#0b1f5e', 12, 58]} />
            <ZoomIn />
            <Lights />
            <Tunnel />
            <FloatingMascot />
          </Canvas>
        </div>

        {/* การ์ดเบจใบเดิมของ What I Do — ซ้อนตรงกรอบเดียวกันแล้วจางออก ภาพจึงต่อกันสนิท */}
        <div
          ref={card}
          className="pointer-events-none absolute z-10 overflow-hidden bg-[#e2d7cb]"
          style={{ left: 0, top: 0, width: 0, height: 0 }}
        >
          {/* ตำแหน่งเดียวกับตัวละครในกระเบื้องตอนกางสุด (ดู .v3-tile-art ใน styles/index.css)
              ถ้าไม่ตรงกัน ภาพจะกระตุกตอนสลับจากกระเบื้องจริงมาเป็นการ์ดใบนี้ */}
          <div className="absolute inset-y-0 left-[38%] w-[24%]">
            <Suspense fallback={null}>
              <MascotCard />
            </Suspense>
          </div>
        </div>

        <div ref={story} style={{ opacity: 0 }} className="absolute inset-0 z-20">
          <Story stop={stop} />
        </div>
      </div>
    </section>
  )
}
