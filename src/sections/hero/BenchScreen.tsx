import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { makeTintGlass } from './liquidGlass'
import { K as ISLE_K, ResearchIsland, blockFlight } from './ResearchPlatform'
import { outlineMat, rrect } from './shapes'
import {
  DEVICE,
  LAYOUT_H,
  WF,
  barLayout,
  codeDark,
  deviceMat,
  wfK,
  clamp01,
  lerp,
  outBack,
  outCubic,
  screenRect,
  smooth,
  type WorkBeats,
} from './workMotion'

/**
 * ของบนจอเครื่องแก้ว — วาดในแคนวาสเพอร์สเปกทีฟ *ใต้* ตัวเครื่อง (ฟองหัวเรื่อง ./BubbleTraveler อยู่ชั้นบน แก้วใส)
 * จึงเห็นเป็นของในจอ · วางตามท่าเดียวกับเครื่อง (benchPose — ตำแหน่ง ขนาด เอน ควง) ระยะโฟกัสเท่ากันสองแคนวาส ภาพทาบกัน
 *
 *   wire      กรอบ wireframe ที่ตัวอักษรของหัวเรื่องลงมาประกอบ (บทค้นคว้าเล่าก่อนหน้านี้ รอบแท่นฟอง — ./BenchTokens)
 *   design    วิดเจ็ตบินลงประกอบ (ฟ้า · ลาเวนเดอร์ · พีช แบบภาพอ้างอิงมือถือ) กรอบเลือกของโปรแกรมออกแบบไล่จับทีละใบ
 *   code      เครื่องเอนเฉียง วิดเจ็ตยกลอยเป็นชั้น โค้ดพิมพ์ทีละบรรทัดบนพื้นจอข้างใต้ แล้ววิดเจ็ตลงกลับที่
 *   ship      ไฟสถานะเขียว คลื่นวงขยายออกจากขอบเครื่อง (เครื่องควงหนึ่งรอบ — ทั้งสองแคนวาส)
 *
 * หน่วยเป็นหน่วยผังจอ (สูง 780 กว้าง 380 — ชุดเดียวกับผังวิดเจ็ตเดิม) คูณเข้าขนาดจอเครื่องบนจอเฟรมนี้
 */

type Tile = { x: number; y: number; w: number; h: number; r: number; color: string }
type Card = Tile & { tiles: Tile[] }

/** ผังวิดเจ็ต — ตามภาพอ้างอิง (กลางจอเป็น 0 แกน y ขึ้น) */
export const CARDS: Card[] = [
  { x: -81, y: 236, w: 150, h: 150, r: 34, color: '#d3eff6', tiles: [{ x: -12, y: 8, w: 66, h: 76, r: 17, color: '#44c4de' }] },
  {
    x: 0,
    y: 16,
    w: 312,
    h: 232,
    r: 38,
    color: '#e1dbf8',
    tiles: [
      { x: 86, y: 48, w: 76, h: 88, r: 18, color: '#a696f1' },
      { x: -86, y: -32, w: 94, h: 22, r: 11, color: '#b3a5f4' },
      { x: -50, y: -72, w: 152, h: 22, r: 11, color: '#b3a5f4' },
    ],
  },
  {
    x: 0,
    y: -246,
    w: 312,
    h: 236,
    r: 38,
    color: '#f4ebe7',
    /* ใบนี้เป็น island ของบท Research — แท่นจำลองยืนบนการ์ด (./ResearchPlatform) แทนกระเบื้อง */
    tiles: [],
  },
]

function slab(t: { w: number; h: number; r: number }, depth: number) {
  /* ขอบมนบาง ๆ — เดิม 14% ของด้านสั้น (การ์ดใหญ่หนาราว 70 หน่วย ดูเป็นก้อน) · ตอนนี้แผ่นบางแบบการ์ด UI */
  const bev = Math.min(8, Math.min(t.h, t.w) * 0.1)
  const g = new THREE.ExtrudeGeometry(rrect(t.w - bev * 2, t.h - bev * 2, Math.max(1, t.r - bev)), {
    depth,
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev,
    bevelSegments: 6,
    curveSegments: 18,
  })
  /* หลังแผ่นอยู่ที่ z = 0 — วางลงบนผิวอะไรก็แค่ตั้ง z ของผิวนั้น */
  g.translate(0, 0, bev)
  return { g, top: depth + bev * 2 }
}

/** บทออกแบบ: กรอบเลือกจับใบกลาง → ใบบน → ใบล่าง · on = กรอบโผล่ · from → to = ใบที่กรอบไหลจากและไป */
export const PICK_SEQ = [1, 0, 2] as const
/** สีเติมของบท Code [บน, ล่าง] — การ์ดไล่โทนอิ่มแบบวิดเจ็ต iOS (ฟ้า · ม่วง · พีชปะการัง) ของในการ์ดเป็นขาวนวลตัดกับพื้น */
const FILL_CARD: readonly (readonly [string, string])[] = [
  ['#6fe6ff', '#2f6bff'],
  ['#b69cff', '#5b2fe6'],
  ['#ffd9b8', '#ff7f86'],
]
const FILL_TILE = ['#ffffff', '#e9e4ff'] as const
/** วินาทีต่อการแตะหนึ่งครั้ง (บท Code — แอปมีชีวิต) */
const TAP_CYCLE = 1.7
const PICK_AT = [0.52, 0.67, 0.8] as const
export function designPick(ds: number) {
  /* ปิดไว้ — บท Design สั้นลง จบที่กรอบเลือกจะเริ่ม (บท Code มาต่อทันที) */
  const on: number = 0
  let from: number = PICK_SEQ[0]
  let to: number = PICK_SEQ[0]
  let move = 1
  for (let n = 1; n < PICK_SEQ.length; n += 1)
    if (ds >= PICK_AT[n]) {
      from = PICK_SEQ[n - 1]
      to = PICK_SEQ[n]
      move = smooth((ds - PICK_AT[n]) / 0.1)
    }
  return { on, from, to, move }
}

/**
 * ผิวน้ำของจอเครื่องตอนแท่นแตะ — คลื่นหนึ่งก้อน (wave packet) วิ่งออกจากขอบแท่น: ยอดคลื่นสว่างนุ่ม ท้องคลื่นหม่นจาง
 * วงละเอียดหลายชั้นตามหลังหน้าคลื่น ทรงเริ่มเป็นแคปซูลตามแท่นแล้วกลมขึ้นตามระยะ · ทั้งผิวสงบลงตามเวลา (แอมพลิจูดลด
 * ความยาวคลื่นยืด) · ตัดขอบตามจอเครื่อง · แผ่นเดียวขนาดจอ หน่วยผังจอ (กว้าง 420 สูง 820 กลาง 0)
 */
function rippleMat() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { uT: { value: 0 }, uAA: { value: 1 }, uC: { value: new THREE.Vector2(0, 357) } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy * vec2(430.0, 830.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(vP, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uT;
      uniform float uAA;
      uniform vec2 uC;
      varying vec2 vP;
      float box(vec2 p, vec2 h, float r) {
        vec2 q = abs(p) - (h - r);
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }
      void main() {
        /* ในจอเท่านั้น (ขอบนุ่ม) */
        float inside = 1.0 - smoothstep(-14.0, 0.0, box(vP, vec2(200.0, 400.0), 80.0));
        if (inside <= 0.0) discard;
        /* ระยะจากขอบแท่น (แคปซูลที่แถบหัว) — ช่วงตรงหดตามเวลา วงจึงกลมขึ้น */
        vec2 p = vP - uC;
        float seg = 70.0 * (1.0 - smoothstep(0.0, 0.8, uT));
        float d = length(vec2(max(abs(p.x) - seg, 0.0), p.y)) - 30.0;
        if (d < 0.0) discard;
        float t = uT;
        /* ผิวน้ำมีความสูงจริง (คลื่นยาวไม่กี่ลูก) แล้วแรเงาด้วยความชันเทียบแสงจากบน: ด้านหันแสงเป็นประกายขาว ด้านหลบเป็นเงาน้ำเงิน
           คลื่นจึงดูนูนเป็นผิวน้ำ ไม่ใช่เส้นวงซ้อน · หน่วยผังจอ (เครื่องยังซูมใกล้ — วงต้องเล็กในหน่วยผัง) */
        float front = mix(10.0, 340.0, 1.0 - pow(1.0 - t, 1.8));
        float lam = mix(30.0, 60.0, t);
        float x = d - front;
        float sig = 20.0 + 46.0 * t;
        float env = exp(-x * x / (2.0 * sig * sig)) * (1.0 - smoothstep(-lam * 0.1, lam * 0.6, x));
        float k = 6.2831853 / lam;
        float slope = cos(x * k) * env;
        float h = sin(x * k) * env;
        float amp = pow(1.0 - t, 1.3) * smoothstep(0.0, 0.06, t) * (1.0 - exp(-d / 10.0));
        vec2 q = vec2(sign(p.x) * max(abs(p.x) - seg, 0.0), p.y);
        vec2 dir = q / max(length(q), 1e-3);
        float lit = 0.35 + 0.65 * dot(dir, normalize(vec2(-0.35, 0.94)));
        float sh = -slope * lit * amp;
        float glint = pow(max(sh, 0.0), 1.5) * 1.8 + pow(max(h, 0.0), 3.0) * amp * 0.5;
        float shade = max(-sh, 0.0) * 0.6;
        float a = (glint + shade) * inside;
        if (a < 0.003) discard;
        vec3 col = mix(vec3(1.0), vec3(0.12, 0.26, 0.6), shade / max(glint + shade, 1e-3));
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  })
}

/**
 * บท Design: ลำแสงสแกนแนวนอนกวาดจากหัวลงท้ายจอเครื่อง — แกนขาวคม รัศมีม่วง · ท้ายลำแสงเป็นพิกเซลม่วงกะพริบ
 * (หนาแน่นชิดลำแสง บางลงตามระยะ) เหมือนจอกำลัง "เรนเดอร์" ดีไซน์ออกมา · แผ่นเดียวขนาดจอ หน่วยผังจอ บวกสีทับวิดเจ็ต
 */
function scanMat() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    /* บวกแบบ premultiplied (สี + alpha บวกตรง ๆ) — แคนวาสโปร่ง: alpha 1 คงที่จะทำให้จอเป็นแผ่นดำ */
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    toneMapped: false,
    uniforms: { uY: { value: 460 }, uA: { value: 0 }, uT: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy * vec2(430.0, 900.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(vP, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uY;
      uniform float uA;
      uniform float uT;
      varying vec2 vP;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float box(vec2 p, vec2 h, float r) {
        vec2 q = abs(p) - (h - r);
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }
      void main() {
        float dx = uY - vP.y;
        vec3 purple = vec3(0.5, 0.28, 1.0);
        /* ลำแสง: ยื่นพ้นขอบซ้ายขวาของจอนิด ปลายจาง */
        float vy = 1.0 - smoothstep(200.0, 235.0, abs(vP.x));
        float core = exp(-dx * dx / 18.0);
        float halo = exp(-abs(dx) / 26.0) * 0.55 + exp(-abs(dx) / 90.0) * 0.18;
        vec3 col = (vec3(1.0) * core * 1.2 + purple * halo) * vy;
        /* พิกเซลท้ายลำแสง — เฉพาะในจอ */
        float inside = 1.0 - smoothstep(-6.0, 0.0, box(vP, vec2(200.0, 400.0), 80.0));
        if (dx < 0.0 && inside > 0.0) {
          float cs = 15.0;
          vec2 cell = floor(vP / cs);
          vec2 f = fract(vP / cs);
          float sq = step(0.12, f.x) * step(f.x, 0.88) * step(0.12, f.y) * step(f.y, 0.88);
          float prob = exp(dx / 70.0);
          float r = hash(cell + floor(uT * 9.0 + hash(cell) * 5.0) * 0.37);
          float on = step(1.0 - prob * 0.85, r);
          float lum = mix(0.25, 1.0, hash(cell * 1.7 + 3.1)) * prob;
          col += mix(purple, vec3(0.85, 0.75, 1.0), hash(cell + 9.0) * 0.35) * on * sq * lum * 0.85 * inside;
        }
        col *= uA;
        float m = max(col.r, max(col.g, col.b));
        if (m < 0.003) discard;
        gl_FragColor = vec4(col, min(1.0, m));
      }`,
  })
}

/** ช่วงสแกนในบท Design (ก่อนกรอบเลือกเริ่มไล่จับ) */
/* วิดเจ็ตลงครบราว 0.6 ของบท — สแกนต่อทันทีแล้วจบบท (Code มาต่อ) */
const SCAN = [0.62, 0.36] as const

/**
 * วิดเจ็ตเริ่มประกอบหลังระลอกน้ำตอนแท่นแตะจอขยายไปแล้ว ระหว่างเครื่องซูมออก (บท morph) — ใบละจังหวะ ของในใบเด้งตาม
 * จบภายในบท (ใบสุดท้ายลงพอดีตอนซูมออกเสร็จ)
 */
/**
 * บล็อกในแท่งแก้วของ island → กระเบื้องของ widget: [การ์ด, กระเบื้อง] ต่อบล็อก (ล่าง → บน)
 * ออกตัวตั้งแต่ฟองลงจอดบนหัวเครื่อง (blockFlight) — กระเบื้องเหล่านี้คือบล็อกที่บินมาเป็น
 */
const BLOCK_TO: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [1, 2],
]
const CARD_INV = new THREE.Matrix4()
const BS = new THREE.Vector3()

const cardIn = (b: WorkBeats, i: number) => clamp01((b.morph - (0.66 + i * 0.07)) / 0.2)
const tileIn = (b: WorkBeats, i: number, j: number) => clamp01((b.morph - (0.74 + i * 0.05 + j * 0.02)) / 0.12)
/** หน่วยผังจอ (สูง 820) → หน่วยท้องถิ่นของเครื่อง (viewBox ของฟอง สูง 2 × DEVICE.hh) */
const LOCAL_K = (DEVICE.hh * 2) / LAYOUT_H
const LM = new THREE.Matrix4()
const BLUE = '#2f6bff'

export function BenchScreen({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const { size } = useThree()

  /** วิดเจ็ต: แผ่นละเรขาคณิตหนึ่งชุด วัสดุตามสี (แคชตามสี) */
  const { parts, mats, fillOf } = useMemo(() => {
    const cache = new Map<string, THREE.Material>()
    const mat = (c: string, tile: boolean) => {
      const k = `${c}|${tile}`
      let m = cache.get(k)
      if (!m) {
        /* แก้วย้อมสีชุดเดียวกับฟองหัวเรื่อง — การ์ดใสกว่า ของในการ์ดเนื้อแน่นกว่า (อ่านเป็นชั้นบนการ์ด) */
        m = tile ? makeTintGlass(c, 0.78) : makeTintGlass(c, 0.4)
        cache.set(k, m)
      }
      return m
    }
    const list = CARDS.map((c) => {
      const sl = slab(c, 3)
      return { c, geo: sl.g, top: sl.top, mat: mat(c.color, false), tiles: c.tiles.map((t) => ({ t, geo: slab(t, 2).g, mat: mat(t.color, true) })) }
    })
    /* วัสดุ → การ์ดที่มันอยู่ (ลำดับเติมสี) กับครึ่งความสูง — สีเดียวกันในการ์ดเดียวกันขนาดเท่ากัน ใช้วัสดุร่วมได้ */
    const fillOf = new Map<THREE.Material, { card: number; span: number }>()
    const paint = (m: THREE.Material, [top, bot]: readonly [string, string]) => {
      const u = (m as THREE.ShaderMaterial).uniforms
      u.uFillTop.value.set(top)
      u.uFillBot.value.set(bot)
    }
    list.forEach((pc, i) => {
      fillOf.set(pc.mat, { card: i, span: pc.c.h / 2 })
      paint(pc.mat, FILL_CARD[i])
      pc.tiles.forEach((pt) => {
        fillOf.set(pt.mat, { card: i + 0.5, span: pt.t.h / 2 })
        paint(pt.mat, FILL_TILE)
      })
    })
    return { parts: list, mats: cache, fillOf }
  }, [])
  const sel = useMemo(() => {
    const edge = new THREE.BoxGeometry(1, 1, 1)
    const knobO = new THREE.BoxGeometry(16, 16, 2)
    const knobI = new THREE.BoxGeometry(10, 10, 2)
    const blue = new THREE.MeshBasicMaterial({ color: BLUE, toneMapped: false })
    const white = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
    return { edge, knobO, knobI, blue, white }
  }, [])
  const ripple = useMemo(() => {
    /* ขอบเครื่องในหน่วยผังจอ: กว้าง 176/344 × 820 ≈ 420 สูง 820 — วงแรกชิดนอกขอบเครื่อง */
    const ring = rrect(432, 832, 92)
    ring.holes.push(rrect(424, 824, 88))
    return {
      geo: new THREE.ShapeGeometry(ring, 24),
      mats: [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, toneMapped: false })),
    }
  }, [])
  const live = useMemo(() => ({ geo: new THREE.SphereGeometry(9, 20, 14), mat: new THREE.MeshBasicMaterial({ color: '#22c55e', toneMapped: false }) }), [])

  useEffect(
    () => () => {
      parts.forEach((p) => {
        p.geo.dispose()
        p.tiles.forEach((t) => t.geo.dispose())
      })
      mats.forEach((m) => m.dispose())
      ;[sel.edge, sel.knobO, sel.knobI, ripple.geo, live.geo].forEach((g) => g.dispose())
      ;[sel.blue, sel.white, live.mat, ...ripple.mats].forEach((m) => m.dispose())
    },
    [parts, mats, sel, ripple, live],
  )

  /** กรอบ wireframe ที่ตัวอักษร "Here is what I do" ลงมาประกอบ (รับไม้จากกรอบที่บินอยู่ใน ./BubbleTraveler) */
  const wf = useMemo(() => ({ geo: new THREE.PlaneGeometry(1, 1), mats: WF.map(() => outlineMat()) }), [])
  useEffect(
    () => () => {
      wf.geo.dispose()
      wf.mats.forEach((m) => m.dispose())
    },
    [wf],
  )
  const wfRefs = useRef<(THREE.Mesh | null)[]>([])
  /** ระลอกน้ำตอนแท่นแตะจอ — ผิวน้ำทั้งจอเครื่องแผ่นเดียว (ดู rippleMat) */
  const drop = useMemo(() => ({ geo: new THREE.PlaneGeometry(1, 1), mat: rippleMat() }), [])
  useEffect(
    () => () => {
      drop.geo.dispose()
      drop.mat.dispose()
    },
    [drop],
  )
  const dropRef = useRef<THREE.Mesh>(null)
  const scan = useMemo(() => ({ geo: new THREE.PlaneGeometry(1, 1), mat: scanMat() }), [])
  useEffect(
    () => () => {
      scan.geo.dispose()
      scan.mat.dispose()
    },
    [scan],
  )
  const scanRef = useRef<THREE.Mesh>(null)
  const root = useRef<THREE.Group>(null)
  const cardRefs = useRef<(THREE.Group | null)[]>([])
  const tileRefs = useRef<(THREE.Mesh | null)[][]>([])
  const frameG = useRef<THREE.Group>(null)
  const edges = useRef<(THREE.Mesh | null)[]>([])
  const knobs = useRef<(THREE.Group | null)[]>([])
  const liveRef = useRef<THREE.Mesh>(null)
  /** บท Code หน้าตรง: นิ้วแตะการ์ดทีละใบ (จุดแตะ + วงกระเพื่อม) — แอปมีชีวิต ใช้งานอยู่จริง */
  const touch = useMemo(
    () => ({
      dot: new THREE.CircleGeometry(1, 40),
      ring: new THREE.RingGeometry(0.86, 1, 56),
      dotMat: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, depthTest: false, toneMapped: false }),
      ringMat: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, depthTest: false, toneMapped: false }),
    }),
    [],
  )
  useEffect(
    () => () => {
      touch.dot.dispose()
      touch.ring.dispose()
      touch.dotMat.dispose()
      touch.ringMat.dispose()
    },
    [touch],
  )
  const dotRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const rings = useRef<(THREE.Mesh | null)[]>([])

  useFrame(({ clock }) => {
    const g = root.current
    const f = frame.current
    if (!g || !f) return
    const b = f.b
    const W = size.width
    const H = size.height
    /* ของในจอมีเฉพาะตอนเครื่องตั้งหน้าตรงเป็นโต๊ะทำงานแล้ว */
    /* ติดเครื่องตั้งแต่เครื่องโผล่ (บทลงจอด) — วิดเจ็ตเริ่มประกอบระหว่างซูมออก */
    g.visible = f.on && deviceMat.ok
    if (!g.visible) return
    /* บท Code โหมดมืด: การ์ดเป็นกระจกดำ ขอบเรืองสีของมัน */
    const dk = codeDark(b)
    /* บท Code: วิดเจ็ตเติมสีขึ้นจากล่างทีละใบ (การ์ดก่อน ของในการ์ดตาม) หลังเครื่องเริ่มตั้งหน้าตรง — เติมแล้วค้าง */
    mats.forEach((m) => {
      const u = (m as THREE.ShaderMaterial).uniforms
      u.uDark.value = dk
      const fo = fillOf.get(m)
      if (!fo) return
      const k = smooth((b.code - 0.2 - fo.card * 0.08) / 0.2)
      u.uSpan.value = fo.span
      u.uFill.value = k <= 0 ? -1e5 : lerp(-fo.span - 4, fo.span + 4, k)
    })
    const t = clock.elapsedTime
    /* ท่าจริงของเครื่อง (จากแคนวาสของฟอง) × หน่วยผังจอ → หน่วยท้องถิ่นของเครื่อง · u = px ต่อหน่วยผัง (เส้นกรอบหนาเท่ากันบนจอ) */
    g.matrix.fromArray(deviceMat.e).multiply(LM.makeScale(LOCAL_K, LOCAL_K, LOCAL_K))
    g.matrixWorldNeedsUpdate = true
    const sr = screenRect(b, W, H)
    const u = (sr.hh * 2) / LAYOUT_H

    /*
     * ── wireframe: กรอบที่ลงถึงจอแล้ว (ตัวที่ยังบินอยู่วาดในแคนวาสของเครื่อง) · วิดเจ็ตจริงลงทับ = กรอบนั้นหลบ
     * กรอบที่ไม่มีวิดเจ็ตรับ (แถบหัว เส้นข้อความ) หดหายระหว่างบทออกแบบ ──
     */
    const owner = [0, 0, 1, 1, 1, 1, 2, 2, 2]
    const tileOf = [-1, 0, -1, 0, 1, 2, -1, 0, 1]
    WF.forEach(([x, y, w, h, r], n) => {
      const om = wfRefs.current[n]
      if (!om) return
      let keep = 1
      if (n < owner.length) {
        const ci = owner[n]
        const land = tileOf[n] < 0 ? cardIn(b, ci) : tileIn(b, ci, tileOf[n])
        keep = land < 0.85 ? 1 : 0
      } else keep = 1 - smooth((b.design - 0.45) / 0.2)
      om.visible = wfK(b.wire, n) >= 1 && keep > 0.01
      if (!om.visible) return
      om.position.set(x, y, 1)
      const m = om.material as THREE.ShaderMaterial
      m.uniforms.uSize.value.set(w * keep, h * keep)
      m.uniforms.uR.value = r
      m.uniforms.uW.value = 2.2 / u
    })

    /*
     * ── ระลอกน้ำ: ฟอง (แท่นที่มี island) แตะหัวเครื่องตอนบทลงจอดถึงราว 0.6 (ดู BubbleTraveler) ศูนย์กลางที่แถบหัวของแอป ──
     */
    const dm = dropRef.current
    if (dm) {
      const e = clamp01((b.morph - 0.58) / 0.42)
      drop.mat.uniforms.uC.value.set(0, 357)
      dm.visible = e > 0 && e < 1
      if (dm.visible) {
        drop.mat.uniforms.uT.value = e
        drop.mat.uniforms.uAA.value = 1 / Math.max(1e-3, u)
        dm.position.set(0, 0, 1.5)
      }
    }

    /* ── บท Design: ลำแสงสแกนกวาดบน → ล่าง ทิ้งพิกเซลม่วงไว้ข้างหลัง (ด้านบน) ── */
    const sm = scanRef.current
    if (sm) {
      const k = clamp01((b.design - SCAN[0]) / SCAN[1])
      sm.visible = k > 0 && k < 1
      if (sm.visible) {
        const su = scan.mat.uniforms
        su.uY.value = lerp(450, -450, smooth(k))
        su.uA.value = smooth(k / 0.12) * (1 - smooth((k - 0.86) / 0.14))
        su.uT.value = t
        sm.position.set(0, 0, 60)
      }
    }

    /* ── ออกแบบ/โค้ด: วิดเจ็ต ── */
    const pick = designPick(b.design)
    /* วิดเจ็ตยกลอยเป็นชั้น + โค้ดพิมพ์ข้างใต้ ปิดไว้ — บทโค้ดเครื่องตั้งหน้าตรงเป็นแอปเสร็จ โค้ดเป็นพื้นหลัง ASCII (./WorkStory) แทน */
    const ex: number = 0
    /* แอปมีชีวิต (หลังเครื่องตั้งหน้าตรงในบท Code): นิ้วเลื่อนไปแตะการ์ดทีละใบ การ์ดยุบแล้วเด้ง วงกระเพื่อมออก — วนตามเวลา */
    const alive = smooth((b.code - 0.42) / 0.1) * (1 - smooth((b.code - 0.9) / 0.08))
    const tc = t / TAP_CYCLE
    const tn = Math.floor(tc)
    const tf = tc - tn
    const tapTo = PICK_SEQ[tn % PICK_SEQ.length]
    const tapFrom = PICK_SEQ[(tn + PICK_SEQ.length - 1) % PICK_SEQ.length]
    const press = Math.sin(Math.PI * clamp01((tf - 0.38) / 0.24))
    const pop = Math.sin(Math.PI * clamp01((tf - 0.6) / 0.3))
    parts.forEach((pc, i) => {
      const cg = cardRefs.current[i]
      if (!cg) return
      const a = cardIn(b, i)
      cg.visible = a > 0
      if (!cg.visible) return
      const land = outCubic(a)
      const hold = pick.on * ((i === pick.to ? pick.move : 0) + (i === pick.from && pick.from !== pick.to ? 1 - pick.move : 0))
      const tap = i === tapTo ? alive : 0
      cg.position.set(pc.c.x + (1 - land) * (i - 1) * 60, pc.c.y + (1 - land) * 140, 4 + (1 - land) * 320 + hold * 16 + ex * (110 + i * 90) + tap * (pop * 14 - press * 6))
      cg.rotation.set((1 - land) * -0.6, (1 - land) * (i - 1) * 0.5, 0)
      cg.scale.setScalar(Math.max(1e-3, outBack(a, 1.4) * (1 - ex * 0.06) * (1 + hold * 0.03) * (1 - tap * (press * 0.04 - pop * 0.015))))
      pc.tiles.forEach((pt, j) => {
        const tm = tileRefs.current[i]?.[j]
        if (!tm) return
        const bj = BLOCK_TO.findIndex(([ci, ti]) => ci === i && ti === j)
        if (bj >= 0) {
          /* บล็อกจากแท่งแก้วบินมาเป็นกระเบื้องนี้: โค้งขึ้นหาคนดู หมุนนิด ขยายจากขนาดบล็อกเป็นขนาดกระเบื้อง */
          const f = smooth(blockFlight(b.sv2, bj))
          /* ลงที่แล้ว = ไม่ต้องอิงแท่ง (แท่งหายไปหลังบล็อกออกหมด — เดิมกระเบื้องหายตามไปด้วย) */
          if (f >= 1) {
            tm.visible = true
            tm.position.set(pt.t.x, pt.t.y, pc.top)
            tm.rotation.set(0, 0, 0)
            tm.scale.setScalar(1)
            return
          }
          tm.visible = f > 0 && barLayout.ok
          if (!tm.visible) return
          /* จุดออกตัว = ที่บล็อกอยู่จริงในแท่งตอนนี้ (ผังจอเครื่อง) → พิกัดท้องถิ่นของการ์ดที่กำลังประกอบอยู่ */
          cg.updateMatrix()
          CARD_INV.copy(cg.matrix).invert()
          BS.fromArray(barLayout.e, bj * 3).applyMatrix4(CARD_INV)
          const arc = Math.sin(Math.PI * f)
          tm.position.set(lerp(BS.x, pt.t.x, f), lerp(BS.y, pt.t.y, f), lerp(BS.z, pc.top, f) + arc * 300)
          tm.rotation.set(arc * 0.7, arc * 0.6, (1 - f) * 1.2)
          /* ขยายใหญ่กลางทาง (ลอยเข้าหาคนดู) แล้วหดลงเข้าที่ — มองเห็นชัดว่าบล็อกเดินทางไปเป็นกระเบื้อง */
          tm.scale.setScalar(Math.max(1e-3, lerp((62 * ISLE_K) / pt.t.w, 1, f) * (1 + arc * 0.9)))
          return
        }
        const k = tileIn(b, i, j)
        tm.visible = k > 0
        tm.scale.setScalar(Math.max(1e-3, outBack(k, 2.2)))
        tm.position.set(pt.t.x, pt.t.y, pc.top + (1 - outCubic(k)) * 30)
      })
    })

    /* จุดแตะกับวงกระเพื่อม */
    const dm2 = dotRef.current
    const rm2 = ringRef.current
    if (dm2 && rm2) {
      dm2.visible = alive > 0.01
      rm2.visible = alive > 0.01 && tf > 0.5
      if (dm2.visible) {
        const A = CARDS[tapFrom]
        const B = CARDS[tapTo]
        const mv = smooth(tf / 0.34)
        const x = lerp(A.x, B.x, mv) + Math.sin(t * 1.3) * 6
        const y = lerp(A.y, B.y, mv)
        const z = 4 + Math.max(parts[tapFrom].top, parts[tapTo].top) + 40
        dm2.position.set(x, y, z)
        dm2.scale.setScalar(26 * (1 - press * 0.28))
        touch.dotMat.opacity = alive * (0.42 + press * 0.3)
        const q = clamp01((tf - 0.5) / 0.45)
        rm2.position.set(B.x, B.y, z)
        rm2.scale.setScalar(26 + outCubic(q) * 70)
        touch.ringMat.opacity = alive * (1 - q) * 0.7
      }
    }

    /* กรอบเลือกของบทออกแบบ — ไหลจากใบก่อนไปใบถัดไปตามระยะเลื่อน */
    const fr = frameG.current
    if (fr) {
      fr.visible = pick.on > 0.01
      if (fr.visible) {
        const pad = 12
        const A = CARDS[pick.from]
        const B = CARDS[pick.to]
        const k = pick.move
        const bw = lerp(A.w, B.w, k) + pad * 2
        const bh = lerp(A.h, B.h, k) + pad * 2
        fr.position.set(lerp(A.x, B.x, k), lerp(A.y, B.y, k), 4 + parts[pick.to].top + 22)
        fr.scale.setScalar(Math.max(1e-3, outBack(pick.on, 1.6)))
        const T = 3.2
        const set = (m: THREE.Mesh | null, px: number, py: number, w: number, h: number) => {
          if (!m) return
          m.position.set(px, py, 0)
          m.scale.set(w, h, 2)
        }
        set(edges.current[0], 0, bh / 2, bw, T)
        set(edges.current[1], 0, -bh / 2, bw, T)
        set(edges.current[2], -bw / 2, 0, T, bh)
        set(edges.current[3], bw / 2, 0, T, bh)
        knobs.current.forEach((kn, j) => {
          if (kn) kn.position.set(((j & 1) * 2 - 1) * (bw / 2), ((j >> 1) * 2 - 1) * (bh / 2), 1)
        })
      }
    }


    /* ส่งของ: ไฟสถานะเขียวบนสุดของจอ + คลื่นวงขยายจากขอบเครื่อง */
    const lv = liveRef.current
    if (lv) {
      const k = smooth((b.ship - 0.08) / 0.12)
      lv.visible = k > 0.01
      lv.scale.setScalar(Math.max(1e-3, outBack(k) * (1 + 0.15 * Math.sin(t * 6))))
    }
    rings.current.forEach((rm, j) => {
      if (!rm) return
      const q = clamp01((b.ship - 0.3 - j * 0.08) / 0.32)
      rm.visible = q > 0 && q < 1
      const s = 1 + outCubic(q) * 0.4
      rm.scale.set(s, s, 1)
      ;(rm.material as THREE.MeshBasicMaterial).opacity = (1 - q) * 0.75
    })
  })

  return (
    <group ref={root} visible={false} matrixAutoUpdate={false}>
      {/* ขนาดจริงมาจากเชดเดอร์ (แผ่นหน่วยเดียว) — กรอบทรงกลมของ three เล็กกว่าที่วาดจริง ปิดการตัดทิ้งนอกมุมกล้อง */}
      <mesh ref={dropRef} geometry={drop.geo} material={drop.mat} visible={false} renderOrder={1} frustumCulled={false} />
      <mesh ref={scanRef} geometry={scan.geo} material={scan.mat} visible={false} renderOrder={20} frustumCulled={false} />
      {wf.mats.map((m, n) => (
        <mesh
          key={`wf${n}`}
          frustumCulled={false}
          geometry={wf.geo}
          material={m}
          visible={false}
          ref={(el) => {
            wfRefs.current[n] = el
          }}
        />
      ))}
      {parts.map((pc, i) => (
        <group
          key={i}
          ref={(el) => {
            cardRefs.current[i] = el
          }}
          visible={false}
        >
          <mesh geometry={pc.geo} material={pc.mat} renderOrder={2} />
          {i === 2 && <ResearchIsland frame={frame} top={pc.top} />}
          {pc.tiles.map((pt, j) => (
            <mesh
              key={j}
              geometry={pt.geo}
              material={pt.mat}
              renderOrder={3}
              ref={(el) => {
                ;(tileRefs.current[i] ||= [])[j] = el
              }}
              visible={false}
            />
          ))}
        </group>
      ))}
      <group ref={frameG} visible={false}>
        {[0, 1, 2, 3].map((j) => (
          <mesh
            key={j}
            geometry={sel.edge}
            material={sel.blue}
            ref={(el) => {
              edges.current[j] = el
            }}
          />
        ))}
        {[0, 1, 2, 3].map((j) => (
          <group
            key={j}
            ref={(el) => {
              knobs.current[j] = el
            }}
          >
            <mesh geometry={sel.knobO} material={sel.blue} />
            <mesh geometry={sel.knobI} material={sel.white} position={[0, 0, 1.2]} />
          </group>
        ))}
      </group>
      <mesh ref={dotRef} geometry={touch.dot} material={touch.dotMat} visible={false} renderOrder={30} />
      <mesh ref={ringRef} geometry={touch.ring} material={touch.ringMat} visible={false} renderOrder={30} />
      <mesh ref={liveRef} geometry={live.geo} material={live.mat} position={[0, 360, 8]} visible={false} />
      {ripple.mats.map((m, j) => (
        <mesh
          key={j}
          geometry={ripple.geo}
          material={m}
          position={[0, 0, -2]}
          ref={(el) => {
            rings.current[j] = el
          }}
          visible={false}
        />
      ))}
    </group>
  )
}
