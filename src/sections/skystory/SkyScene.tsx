import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { JOURNEY } from '@/data/journey'
import cursorSvg from '@/assets/v2/skills-cursor.svg?raw'
import pencilSvg from '@/assets/v2/skills-pencil.svg?raw'
import promptSvg from '@/assets/v2/prompt-mark.svg?raw'
import logoSvg from '@/assets/v2final/logo-joe.svg?raw'
import { acrylicCharm, chrome, magnifierCharm, strapCharm, svgInlay, tagCharm, tileCharm, type Charm } from '@/sections/keychain/charms'
import { CharacterHead } from './head'
import { KEYCHAIN, SKY_LEAVE, SKY_VH, TOTAL_VH } from './beats'

/**
 * What I do — ยังลอยอยู่บนฟ้าต่อจาก hero แล้วค่อย ๆ ร่วงลงผ่านหมอกเมฆ
 *
 * 0. ฟ้าเหนือหมอก — ฟองคำพูดของหัวเรื่อง hero ลอยตามลงมาอยู่ตรงนี้ (ดู hero/BubbleTraveler) แล้วกล้องร่วงลงผ่านหมอก
 * 1. กล่องกระดาษ ABOUT ME (ดู aboutBox) ร่วงหมุนคว้างผ่านเมฆ (เมฆพุ่งขึ้นผ่านกล้อง) แล้วตั้งตัว ฝากางออก
 * 2. ของในกล่องกระเด็นออก ร่วงลงไปรอข้างล่าง: หัวตัวละคร · บล็อกโลโก้ JOE · พวงกุญแจ
 * 3. เลื่อนต่อ = กล้องร่วงตามลงไปจ่อทีละชิ้น (วางองค์ประกอบแบบภาพอ้างอิง Chzzk: ของชิ้นใหญ่ค่อนขวา
 *    ชิ้นถัดไปโผล่มุมล่าง) — เรื่องของตัวเองก่อน แล้วจึงจี้พวงกุญแจทีละอัน
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

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const span = (t: number, a: number, d: number) => clamp01((t - a) / d)
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
const outCubic = (x: number) => 1 - (1 - x) ** 3

/**
 * บทของเรื่อง (กล้องจ่อทีละบท ไม่มีข้อความบนจอแล้ว) — ชื่อ ตำแหน่ง สกิล ที่ทำงาน มาจากข้อมูลจริงของเว็บ
 * `at` = ระยะเลื่อนที่กล้องจ่อชิ้นนั้นพอดี
 */
/**
 * ช่วงต้นของ section เป็นของฟองคำพูด — เรื่องเดิม (กล่อง → ของสามชิ้น → พวงกุญแจ) เลื่อนไปเล่นใน
 * ระยะที่เหลือ `old(p)` แปลงระยะเลื่อนจริงกลับเป็นระยะของเรื่องเดิม ตัวเลขจังหวะเดิมจึงไม่ต้องแก้
 */
/**
 * ฟ้าเหนือหมอก = เวทีของฟองคำพูด (ตารางจังหวะใน ./beats) ยาว SKY_VH จอ ตามด้วยเรื่องพวงกุญแจ
 * (เปิด/ปิดด้วย KEYCHAIN) ความสูง section (ดู SkyStory) = SECTION_VH
 */
const PRE = SKY_VH / TOTAL_VH
const old = (p: number) => clamp01((p - PRE) / Math.max(1e-6, 1 - PRE))
const late = (at: number) => PRE + at * (1 - PRE)
/** ฟ้าเหนือชั้นหมอก (ฟองคำพูด แล้วโลกในหน้าต่างพอร์ทัล — ดู ./portalWorld, hero/MacWindow) — กล้องเริ่มที่นี่แล้วร่วงทะลุหมอกลงไปหากล่อง */
const NOTE = new THREE.Vector3(1.7, 22, 0)

export const STEPS: { kicker: string; title: string; body?: string; color: string; at: number }[] = [
  { kicker: 'Skills & teams', title: 'What I do', color: '#ffffff', at: SKY_LEAVE - 0.022 },
  { kicker: "Hello, I'm", title: 'Joe', body: 'UX/UI Designer', color: '#f6bb9f', at: late(0.27) },
  { kicker: 'UX/UI Designer', title: 'Joe Pattarapon', color: '#7fb2ff', at: late(0.38) },
  { kicker: 'On my keychain', title: 'Skills & teams', color: '#e3e6ea', at: late(0.49) },
  ...CHARMS.map((c, i) => ({ kicker: c.kicker, title: c.title, body: c.body, color: c.color, at: late(0.58 + i * 0.08) })),
]
/** บทที่กล้องกำลังจ่อ — แบ่งที่กึ่งกลางระหว่างสองบท */
export const stepAt = (p: number) => {
  let k = 0
  for (let i = 1; i < STEPS.length; i += 1) if (p >= (STEPS[i - 1].at + STEPS[i].at) / 2) k = i
  return k
}


/* ---------------------------------------------------------------- ตำแหน่งในฟ้า */

/** หมอกพุ่งขึ้นผ่านกล้องในช่วงแรกของเรื่องเดิม (ระยะของ old(p)) */
const FOG_RISE = 0.11
/* ของสามชิ้นลอยรอเป็นขั้นบันไดลงไปข้างล่าง ห่างกันพอให้ชิ้นถัดไปโผล่ขอบล่างของภาพตอนจ่อชิ้นบน (แบบภาพอ้างอิง Chzzk) — สลับซ้ายขวานิดหน่อย */
const STATION = [new THREE.Vector3(2.2, -4.0, 0), new THREE.Vector3(1.4, -7.9, 0.3), new THREE.Vector3(2.1, -11.8, 0)]

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
    g.position.y = -15 * (1 - outCubic(span(old(s.p), 0, FOG_RISE)))
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

/**
 * โลโก้ JOE เป็นตัวอักษร 3D ล้วน ไม่มีก้อนรอง — อัดหนาจากโลโก้จริงของเว็บ สีส้มเดียวกับโลโก้หัวเว็บ
 * (--v3-orange / #F5501E) พลาสติกมันเงา · จัดกลางความหนา หมุนแล้วไม่ส่ายออกข้าง
 */
const LOGO_DEPTH = 0.42
function LogoBlock() {
  const made = useMemo(() => {
    const logo = svgInlay(logoSvg, 2.6, LOGO_DEPTH, { flat: true, grow: 0.55 })
    const mat = new THREE.MeshPhysicalMaterial({ color: '#F5501E', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 })
    return { logo, mat }
  }, [])
  useEffect(() => () => Object.values(made).forEach((x) => x.dispose()), [made])
  return <mesh geometry={made.logo} material={made.mat} position={[0, 0, -LOGO_DEPTH / 2]} />
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

const A = new THREE.Vector3()
const B = new THREE.Vector3()
const LOOK = new THREE.Vector3()
const CAM = new THREE.Vector3()

export function SkyScene({ state }: { state: React.RefObject<SkyState> }) {
  const charms = useMemo(() => CHARMS.map((c) => c.build()), [])
  useEffect(() => () => charms.forEach((c) => c.dispose()), [charms])

  const items = useRef<(THREE.Group | null)[]>([])
  const spins = useRef<(THREE.Group | null)[]>([])
  const q = useRef(0)
  const activeCharm = () => {
    const s = stepAt(q.current)
    return s >= 4 ? s - 4 : -1
  }

  /** จุดที่กล้องจ่อของบท k (โลก) — ของที่ขยับได้คิดจากตำแหน่งจริงทุกเฟรม · คืนระยะกล้องด้วย */
  const focusOf = (step: number, out: THREE.Vector3) => {
    if (step === 0) return out.copy(NOTE).setY(NOTE.y + 0.2), 10.2
    const k = step
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
    /* จอแนวตั้ง (มือถือ): ถอยกล้องให้ของไม่ล้นขอบ */
    const narrow = size.width / Math.max(1, size.height) < 0.9
    q.current += (s.p - q.current) * (1 - Math.exp(-dt * 6))
    const pRaw = q.current
    const t = clock.elapsedTime

    /* ของสามชิ้นลอยรอที่จุดของตัวเอง หมุนช้า ๆ ขึ้นลงเบา ๆ */
    items.current.forEach((g, i) => {
      if (!g) return
      g.position.copy(STATION[i])
      g.position.y += Math.sin(t * 0.8 + i) * 0.06
      g.scale.setScalar(i === 2 ? 1 : 1.25)
      const idle = i === 2 ? 0 : Math.sin(t * 0.6 + i) * 0.3
      g.rotation.set(Math.sin(t * 0.5 + i) * 0.08, (i === 0 ? -0.65 : -0.35) + idle, Math.sin(t * 0.7 + i) * 0.05)
    })

    /**
     * กล้อง: ค้างที่บทหนึ่งช่วงหนึ่ง แล้วไหลไปบทถัดไปแบบ ease — ของอยู่กลางจอ
     * ชิ้นถัดไปข้างล่างโผล่ขอบจอ
     */
    const HOLD = 0.022
    let k0 = 0
    let k1 = 0
    let w = 0
    for (let i = 0; i < STEPS.length; i += 1) {
      const a = STEPS[i].at
      if (pRaw >= a - HOLD) {
        k0 = i
        k1 = i
        w = 0
      }
      const nx = STEPS[i + 1]
      if (nx && pRaw > a + HOLD && pRaw < nx.at - HOLD) {
        k0 = i
        k1 = i + 1
        w = easeInOut((pRaw - a - HOLD) / (nx.at - a - HOLD * 2))
      }
    }
    const d0 = focusOf(k0, A)
    const d1 = focusOf(k1, B)
    LOOK.lerpVectors(A, B, w)
    const dist = THREE.MathUtils.lerp(d0, d1, w) * (narrow ? 1.35 : 1)
    CAM.set(LOOK.x + pointer.x * 0.35, LOOK.y + 0.35 + pointer.y * 0.25, LOOK.z + dist)
    camera.position.lerp(CAM, 1 - Math.exp(-dt * 5))
    camera.lookAt(LOOK)
  })

  return (
    <>
      <Studio />
      {/* เรื่องพวงกุญแจปิดอยู่ (KEYCHAIN ใน ./beats) = ไม่วาดหมอกกับของสามชิ้นเลย ฟ้าเปล่ารับฟองคำพูด */}
      {KEYCHAIN && (
      <>
      <Fog state={state} />
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
      )}
    </>
  )
}
