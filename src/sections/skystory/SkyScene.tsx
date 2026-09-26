import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { JOURNEY } from '@/data/journey'
import cursorSvg from '@/assets/v2/skills-cursor.svg?raw'
import pencilSvg from '@/assets/v2/skills-pencil.svg?raw'
import promptSvg from '@/assets/v2/prompt-mark.svg?raw'
import logoSvg from '@/assets/v2final/logo-joe.svg?raw'
import { acrylicCharm, chrome, magnifierCharm, strapCharm, svgInlay, tagCharm, tileCharm, type Charm } from '@/sections/keychain/charms'
import { buildTin } from './tin'
import { CharacterHead } from './head'

/**
 * What I do — ยังลอยอยู่บนฟ้าต่อจาก hero แล้วค่อย ๆ ร่วงลงผ่านหมอกเมฆ
 *
 * 1. กล่องสังกะสีร่วงหมุนคว้างผ่านเมฆ (เมฆพุ่งขึ้นผ่านกล้อง) แล้วตั้งตัว ฝาเปิด
 * 2. ของในกล่องกระเด็นออก ร่วงลงไปรอข้างล่าง: หัวตัวละคร · บล็อกโลโก้ JOE · พวงกุญแจ
 * 3. เลื่อนต่อ = กล้องร่วงตามลงไปจ่อทีละชิ้น (วางองค์ประกอบแบบภาพอ้างอิง Chzzk: ของชิ้นใหญ่ค่อนขวา
 *    ชิ้นถัดไปโผล่มุมล่าง ข้อความมุมซ้ายล่าง) — เรื่องของตัวเองก่อน แล้วจึงจี้พวงกุญแจทีละอัน
 *
 * ระยะเลื่อนมาทาง ref ใบเดียว ฉากอ่านเองในลูปเฟรม ไม่มี setState ต่อเฟรม
 */

export type SkyState = { p: number }

const pick = (t: string) => SKILLS.find((k) => k.title === t)
const job = (at: string) => JOURNEY.find((s) => s.at === at)
const RESEARCH = pick('Research')?.color ?? '#158ffc'
const DESIGN = pick('Design')?.color ?? '#fd5000'
const CODING = pick('Coding')?.color ?? '#ad85fe'
const appman = job('@APPMAN')
const bms = job('@BMS')

type Charmed = { title: string; kicker: string; body?: string; color: string; build: () => Charm }
const CHARMS: Charmed[] = [
  { kicker: 'Skill 01', title: 'Research', color: RESEARCH, build: () => magnifierCharm(cursorSvg, RESEARCH) },
  { kicker: 'Skill 02', title: 'Design', body: pick('Design')?.desc, color: DESIGN, build: () => tileCharm(pencilSvg, DESIGN) },
  { kicker: 'Skill 03', title: 'Coding', body: pick('Coding')?.desc, color: CODING, build: () => acrylicCharm(promptSvg, CODING) },
  {
    kicker: 'Worked at',
    title: 'AppMan',
    body: appman ? `${appman.role} · ${appman.org}` : undefined,
    color: '#2f6bff',
    build: () => strapCharm('AppMan', '#14161c', '#ffffff', '#2f6bff'),
  },
  {
    kicker: 'Worked at',
    title: 'BMS',
    body: bms ? `${bms.role} · ${bms.org}` : undefined,
    color: '#b04bd6',
    build: () => tagCharm('BMS', bms?.org.replace(/ Co,\. Ltd\.$/, '') ?? 'BMS', '#3a1747', '#f6c6ea'),
  },
]

/**
 * บทของเรื่อง (ข้อความมุมซ้ายล่างสลับตามนี้) — ชื่อ ตำแหน่ง สกิล ที่ทำงาน มาจากข้อมูลจริงของเว็บ
 * `at` = ระยะเลื่อนที่กล้องจ่อชิ้นนั้นพอดี
 */
export const STEPS: { kicker: string; title: string; body?: string; color: string; at: number }[] = [
  { kicker: 'Skills & teams', title: 'What I do', color: '#ffffff', at: 0.07 },
  { kicker: "Hello, I'm", title: 'Joe', body: 'UX/UI Designer', color: '#f6bb9f', at: 0.27 },
  { kicker: 'UX/UI Designer', title: 'Joe Pattarapon', color: '#7fb2ff', at: 0.38 },
  { kicker: 'On my keychain', title: 'Skills & teams', color: '#e3e6ea', at: 0.49 },
  ...CHARMS.map((c, i) => ({ kicker: c.kicker, title: c.title, body: c.body, color: c.color, at: 0.58 + i * 0.08 })),
]
/** บทที่กล้องกำลังจ่อ — แบ่งที่กึ่งกลางระหว่างสองบท */
export const stepAt = (p: number) => {
  let k = 0
  for (let i = 1; i < STEPS.length; i += 1) if (p >= (STEPS[i - 1].at + STEPS[i].at) / 2) k = i
  return k
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const span = (t: number, a: number, d: number) => clamp01((t - a) / d)
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
const outCubic = (x: number) => 1 - (1 - x) ** 3

/* ---------------------------------------------------------------- ตำแหน่งในฟ้า */

/** กล่องอยู่บนสุด ของสามชิ้นรอเป็นขั้นบันไดลงไปข้างล่าง (ค่อนขวา ข้อความอยู่ซ้าย) */
const BOX = new THREE.Vector3(1.7, 0, 0)
/* ห่างกันพอให้ชิ้นถัดไปโผล่ขอบล่างของภาพตอนจ่อชิ้นบน (แบบภาพอ้างอิง Chzzk) — สลับซ้ายขวานิดหน่อย */
const STATION = [new THREE.Vector3(2.2, -4.0, 0), new THREE.Vector3(1.4, -7.9, 0.3), new THREE.Vector3(2.1, -11.8, 0)]
/** ทางบินออกจากกล่องของแต่ละชิ้น — เบนออกคนละข้าง ไม่บินทะลุกัน */
const ARC = [
  { x: -1.8, y: 2.4, z: 1.2 },
  { x: 0.4, y: 3.0, z: -0.8 },
  { x: 2.2, y: 2.0, z: 0.4 },
]
const TEXT_SHIFT = 2.0
/** จังหวะของกล่อง */
const SETTLE = [0.02, 0.09] as const
const OPEN = [0.1, 0.06] as const
const LAUNCH = 0.14

/* ---------------------------------------------------------------- แสง */

function Studio() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pm.fromScene(room, 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.9
    return () => {
      scene.environment = null
      env.dispose()
      room.clear()
      pm.dispose()
    }
  }, [gl, scene])
  return (
    <>
      <hemisphereLight args={['#eaf2ff', '#b9cdf0', 0.6]} />
      <directionalLight position={[-4, 5, 5]} intensity={2.6} />
      <directionalLight position={[4, -1, -3]} intensity={0.8} color="#cfe0ff" />
    </>
  )
}

/* ---------------------------------------------------------------- หมอกเมฆ */

function cloudTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  if (g) {
    let s = 11
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 14; i += 1) {
      const x = 128 + (rnd() - 0.5) * 110
      const y = 128 + (rnd() - 0.5) * 60
      const r = 40 + rnd() * 60
      const rg = g.createRadialGradient(x, y, 0, x, y, r)
      rg.addColorStop(0, 'rgba(255,255,255,0.55)')
      rg.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = rg
      g.fillRect(0, 0, 256, 256)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * ก้อนหมอกแบน ๆ หันหากล้องเสมอ กระจายตลอดทางร่วง บางก้อนอยู่หน้ากล้อง (ร่วงผ่านทะลุ)
 * ช่วงกล่องร่วง ทั้งชั้นเลื่อนขึ้นเร็ว (เราร่วงผ่านเมฆ) พอกล่องตั้งตัวชั้นหมอกนิ่งตามโลก
 */
function Fog({ state }: { state: React.RefObject<SkyState> }) {
  const { tex, mats, list } = useMemo(() => {
    const tex = cloudTexture()
    let s = 29
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const mats: THREE.SpriteMaterial[] = []
    const list: { x: number; y: number; z: number; k: number; o: number }[] = []
    for (let i = 0; i < 70; i += 1) {
      /**
       * ชั้นบน (ทางเข้าจาก hero) หนา อยู่เหนือกล่อง — ตอนเริ่มถูกเลื่อนลงมาคลุมกล้อง แล้วพุ่งขึ้นพ้นไป
       * ตามทางร่วงบางลง ส่วนใหญ่อยู่หลังของ มีไม่กี่ก้อนอยู่หน้า (ร่วงผ่านเฉียด ๆ) จางกว่า
       */
      const top = i < 26
      const front = !top && i % 6 === 0
      list.push({
        x: (rnd() - 0.5) * 18,
        y: top ? 3 + rnd() * 15 : -3 - rnd() * 17,
        z: top ? -6 + rnd() * 11 : front ? 2.5 + rnd() * 2 : -8 + rnd() * 5,
        k: 3 + rnd() * 5,
        o: top ? 0.8 + rnd() * 0.2 : front ? 0.18 + rnd() * 0.12 : 0.2 + rnd() * 0.25,
      })
      mats.push(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: list[i].o }))
    }
    return { tex, mats, list }
  }, [])
  useEffect(
    () => () => {
      tex.dispose()
      mats.forEach((m) => m.dispose())
    },
    [tex, mats],
  )
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    const s = state.current
    if (!g || !s) return
    /* เริ่ม: ชั้นหมอกเลื่อนลงมาคลุมกล้อง (พื้นขาวต่อจาก hero) แล้วพุ่งขึ้นพ้นไปตอนกล่องตั้งตัว */
    g.position.y = -15 * (1 - outCubic(span(s.p, 0, SETTLE[0] + SETTLE[1])))
  })
  return (
    <group ref={ref}>
      {list.map((c, i) => (
        <sprite key={i} material={mats[i]} position={[c.x, c.y, c.z]} scale={[c.k * 1.6, c.k, 1]} />
      ))}
    </group>
  )
}

/* ---------------------------------------------------------------- บล็อกโลโก้ */

/** โลโก้ JOE อัดนูนบนก้อนมนสีเข้ม (แบบบล็อกโลโก้ในภาพอ้างอิง Chzzk) โลโก้สีฟ้าอ่อนเงา */
function LogoBlock() {
  const made = useMemo(() => {
    const body = new RoundedBoxGeometry(2.4, 1.3, 1.0, 6, 0.3)
    const logo = svgInlay(logoSvg, 1.7, 0.16)
    const dark = new THREE.MeshPhysicalMaterial({ color: '#1b2240', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 })
    const glow = new THREE.MeshPhysicalMaterial({ color: '#9fd0ff', roughness: 0.2, clearcoat: 1, emissive: '#3d7bff', emissiveIntensity: 0.25 })
    return { body, logo, dark, glow }
  }, [])
  useEffect(() => () => Object.values(made).forEach((x) => x.dispose()), [made])
  return (
    <group>
      <mesh geometry={made.body} material={made.dark} />
      <mesh geometry={made.logo} material={made.glow} position={[0, 0, 0.49]} />
    </group>
  )
}

/* ---------------------------------------------------------------- พวงกุญแจ */

const RING_R = 1.15
const HANG = [
  { a: -1.2, links: 2, yaw: 0.3, z: 0.1 },
  { a: -0.6, links: 0, yaw: -0.2, z: -0.1 },
  { a: 0.0, links: 3, yaw: 0.1, z: 0.12 },
  { a: 0.6, links: 1, yaw: -0.25, z: -0.08 },
  { a: 1.2, links: 0, yaw: 0.2, z: 0.05 },
]
const LINK = 0.2
type Pend = { sz: number; vz: number; sx: number; vx: number; yaw: number; vyaw: number; turns: number; lift: number; was: boolean }

/**
 * ห่วงโลหะกับจี้ห้าอัน — จี้เป็นลูกตุ้มสปริงแกว่งตามแรงเลื่อน/เมาส์ · อันที่ถึงคิว (`active`)
 * แกว่งเข้าหากล้อง หมุนโชว์หนึ่งรอบ ตัวอื่นแกว่งหนีไปข้างหลัง
 */
function Keychain({ active, spins, charms }: { active: () => number; spins: React.RefObject<(THREE.Group | null)[]>; charms: Charm[] }) {
  const { ringGeo, linkGeo, metal } = useMemo(
    () => ({ ringGeo: new THREE.TorusGeometry(RING_R, 0.055, 24, 128), linkGeo: new THREE.TorusGeometry(0.085, 0.022, 10, 28), metal: chrome() }),
    [],
  )
  useEffect(
    () => () => {
      ringGeo.dispose()
      linkGeo.dispose()
      metal.dispose()
    },
    [ringGeo, linkGeo, metal],
  )
  const pivots = useRef<(THREE.Group | null)[]>([])
  const pend = useRef<Pend[]>(HANG.map((h) => ({ sz: 0, vz: 0, sx: 0, vx: 0, yaw: h.yaw, vyaw: 0, turns: 0, lift: 0, was: false })))
  const px = useRef(0)
  useFrame(({ clock, pointer }, dt) => {
    const step = Math.min(dt, 1 / 30)
    const t = clock.elapsedTime
    const act = active()
    const dpx = pointer.x - px.current
    px.current = pointer.x
    pend.current.forEach((pd, i) => {
      const on = i === act
      if (on && !pd.was) pd.turns += 1
      pd.was = on
      const side = act < 0 ? 0 : Math.sign(i - act)
      const tz = on ? 0 : side * 0.3 + Math.sin(t * 0.7 + i) * 0.03
      const tx = on ? -0.42 : act >= 0 ? 0.38 : Math.sin(t * 0.9 + i) * 0.04
      pd.vz += (-16 * (pd.sz - tz) - 1.6 * pd.vz + dpx * 6) * step
      pd.vx += (-16 * (pd.sx - tx) - 1.6 * pd.vx) * step
      pd.sz += pd.vz * step
      pd.sx += pd.vx * step
      const ty = (on ? 0 : HANG[i].yaw) + pd.turns * Math.PI * 2
      pd.vyaw += (-10 * (pd.yaw - ty) - 3.2 * pd.vyaw) * step
      pd.yaw += pd.vyaw * step
      pd.lift += ((on ? 1 : 0) - pd.lift) * (1 - Math.exp(-dt * 5))
      const pv = pivots.current[i]
      const sp = spins.current[i]
      if (pv) {
        pv.rotation.z = pd.sz
        pv.rotation.x = pd.sx
      }
      if (sp) {
        sp.rotation.y = pd.yaw
        sp.scale.setScalar(1 + pd.lift * 0.12 - (act >= 0 && !on ? 0.12 : 0))
      }
    })
  })
  return (
    <group>
      <mesh geometry={ringGeo} material={metal} rotation={[0.35, 0.2, 0]} />
      <mesh geometry={ringGeo} material={metal} rotation={[0.35, 0.2, 0]} position={[0.03, -0.02, 0.1]} scale={0.985} />
      {HANG.map((h, i) => (
        <group
          key={i}
          position={[Math.sin(h.a) * RING_R, -Math.cos(h.a) * RING_R, h.z]}
          ref={(o) => {
            pivots.current[i] = o
          }}
        >
          {Array.from({ length: h.links }, (_, k) => (
            <mesh key={k} geometry={linkGeo} material={metal} position={[0, -LINK * (k + 0.5), 0]} rotation={[0, k % 2 ? Math.PI / 2 : 0, Math.PI / 2]} />
          ))}
          <group
            position={[0, -h.links * LINK - 0.1, 0]}
            ref={(o) => {
              spins.current[i] = o
            }}
          >
            <primitive object={charms[i].group} />
          </group>
        </group>
      ))}
    </group>
  )
}

/* ---------------------------------------------------------------- ฉาก */

const TMP = new THREE.Vector3()
const A = new THREE.Vector3()
const B = new THREE.Vector3()
const LOOK = new THREE.Vector3()
const CAM = new THREE.Vector3()
/** ท่าพักของกล่อง: มุมสามส่วนสี่ เห็นด้านหน้ากับด้านข้าง เงยให้เห็นในกล่อง */
const BOX_REST = new THREE.Euler(0.42, -0.55, 0.06)

export function SkyScene({ state }: { state: React.RefObject<SkyState> }) {
  const tin = useMemo(() => buildTin(), [])
  useEffect(() => () => tin.dispose(), [tin])
  const charms = useMemo(() => CHARMS.map((c) => c.build()), [])
  useEffect(() => () => charms.forEach((c) => c.dispose()), [charms])

  const box = useRef<THREE.Group>(null)
  const items = useRef<(THREE.Group | null)[]>([])
  const spins = useRef<(THREE.Group | null)[]>([])
  const q = useRef(0)
  const activeCharm = () => {
    const s = stepAt(q.current)
    return s >= 4 ? s - 4 : -1
  }

  /** จุดที่กล้องจ่อของบท k (โลก) — ของที่ขยับได้คิดจากตำแหน่งจริงทุกเฟรม · คืนระยะกล้องด้วย */
  const focusOf = (k: number, out: THREE.Vector3) => {
    if (k === 0) return out.copy(BOX).setY(BOX.y + 0.6), 8.2
    if (k <= 3) {
      const it = items.current[k - 1]
      if (it) it.getWorldPosition(out)
      else out.copy(STATION[k - 1])
      if (k === 3) out.y -= 1.6
      return k === 3 ? 9 : 7.2
    }
    const sp = spins.current[k - 4]
    const len = charms[k - 4].len
    if (sp) {
      sp.updateWorldMatrix(true, false)
      out.set(0, -len * 0.55, 0).applyMatrix4(sp.matrixWorld)
    } else out.copy(STATION[2])
    return 7
  }

  useFrame(({ clock, camera, pointer, size }, dt) => {
    const s = state.current
    if (!s) return
    /* จอแนวตั้ง (มือถือ): ของอยู่กลางค่อนบน ข้อความอยู่ล่าง — ไม่เลื่อนจุดมองไปซ้าย */
    const narrow = size.width / Math.max(1, size.height) < 0.9
    q.current += (s.p - q.current) * (1 - Math.exp(-dt * 6))
    const p = q.current
    const t = clock.elapsedTime

    /* กล่อง: หมุนคว้างตอนร่วง → ตั้งตัวเข้าท่าพัก → ฝาเปิด */
    const settle = easeInOut(span(p, SETTLE[0], SETTLE[1]))
    const b = box.current
    if (b) {
      const tumble = 1 - settle
      b.position.set(BOX.x, BOX.y + Math.sin(t * 0.9) * 0.08, BOX.z)
      b.rotation.set(
        BOX_REST.x + tumble * (t * 1.3 + 0.8),
        BOX_REST.y + tumble * (t * 0.9 + 1.2),
        BOX_REST.z + tumble * Math.sin(t * 1.7) * 0.6,
      )
    }
    const open = easeInOut(span(p, OPEN[0], OPEN[1]))
    tin.lid.rotation.x = -open * 1.95 + Math.sin(open * Math.PI) * -0.2

    /* ของสามชิ้น: รอในกล่อง → กระเด็นขึ้นแล้วร่วงลงไปที่จุดรอของตัวเอง (โค้งพาราโบลา) */
    if (b) b.updateMatrixWorld()
    items.current.forEach((g, i) => {
      if (!g) return
      const f = span(p, LAUNCH + i * 0.035, 0.1)
      const e = outCubic(f)
      A.copy(tin.inside).add(TMP.set((i - 1) * 0.6, 0.1, 0)).applyMatrix4(b ? b.matrixWorld : new THREE.Matrix4())
      B.copy(STATION[i])
      g.position.lerpVectors(A, B, e)
      const arc = Math.sin(Math.PI * Math.min(1, f * 1.2))
      g.position.x += arc * ARC[i].x
      g.position.y += arc * ARC[i].y
      g.position.z += arc * ARC[i].z
      /* ในกล่องย่อเล็ก (ซ่อนจนฝาเปิด) บินออกมาขยายเต็มตัว */
      const inBox = open < 0.3 && f === 0
      g.visible = !inBox
      g.scale.setScalar(THREE.MathUtils.lerp(0.28, i === 2 ? 1 : 1.25, e))
      /* ลอยหมุนช้า ๆ ที่จุดรอ — ระหว่างบินหมุนควงเร็ว */
      const idle = i === 2 ? 0 : Math.sin(t * 0.6 + i) * 0.3
      g.rotation.set(Math.sin(t * 0.5 + i) * 0.08 + (1 - e) * 3, (i === 0 ? -0.65 : -0.35) + idle + (1 - e) * 4, Math.sin(t * 0.7 + i) * 0.05)
      g.position.y += e * Math.sin(t * 0.8 + i) * 0.06
    })

    /**
     * กล้อง: ค้างที่บทหนึ่งช่วงหนึ่ง แล้วไหลไปบทถัดไปแบบ ease — ของอยู่ค่อนขวา (เลื่อนจุดมองไปซ้าย)
     * ข้อความอยู่มุมซ้ายล่าง ชิ้นถัดไปข้างล่างโผล่ขอบจอ
     */
    const HOLD = 0.022
    let k0 = 0
    let k1 = 0
    let w = 0
    for (let i = 0; i < STEPS.length; i += 1) {
      const a = STEPS[i].at
      if (p >= a - HOLD) {
        k0 = i
        k1 = i
        w = 0
      }
      const nx = STEPS[i + 1]
      if (nx && p > a + HOLD && p < nx.at - HOLD) {
        k0 = i
        k1 = i + 1
        w = easeInOut((p - a - HOLD) / (nx.at - a - HOLD * 2))
      }
    }
    const d0 = focusOf(k0, A)
    const d1 = focusOf(k1, B)
    LOOK.lerpVectors(A, B, w)
    /* จี้ใกล้กล้องกว่า เลื่อนจุดมองน้อยลง — ไม่งั้นจี้ตกขอบขวา */
    if (narrow) LOOK.y -= 1.1
    else LOOK.x -= THREE.MathUtils.lerp(k0 >= 4 ? 1.3 : TEXT_SHIFT, k1 >= 4 ? 1.3 : TEXT_SHIFT, w)
    const dist = THREE.MathUtils.lerp(d0, d1, w) * (narrow ? 1.35 : 1)
    CAM.set(LOOK.x + pointer.x * 0.35, LOOK.y + 0.35 + pointer.y * 0.25, LOOK.z + dist)
    camera.position.lerp(CAM, 1 - Math.exp(-dt * 5))
    camera.lookAt(LOOK)
  })

  return (
    <>
      <Studio />
      <Fog state={state} />
      <group ref={box}>
        <primitive object={tin.group} />
      </group>
      <group
        ref={(g) => {
          items.current[0] = g
        }}
      >
        <Suspense fallback={null}>
          <group scale={1.5}>
            <CharacterHead />
          </group>
        </Suspense>
      </group>
      <group
        ref={(g) => {
          items.current[1] = g
        }}
      >
        <LogoBlock />
      </group>
      <group
        ref={(g) => {
          items.current[2] = g
        }}
      >
        <Keychain active={activeCharm} spins={spins} charms={charms} />
      </group>
    </>
  )
}
