import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { makeChunkyTile } from './liquidGlass'
import { K as ISLE_K, ResearchIsland, blockFlight } from './ResearchPlatform'
import { outlineMat, rrect } from './shapes'
import { storySv2 } from '@/sections/skystory/beats'
import { WorksHanger } from './WorksHanger'
import {
  DEVICE,
  LAYOUT_H,
  WF,
  barLayout,
  codeDark,
  CODE_HIT,
  deviceMat,
  wfK,
  clamp01,
  lerp,
  outBack,
  outCubic,
  screenRect,
  smooth,
  type WorkBeats,
  workBeats,
  worksPost,
  worksWordLayout,
  worksPostSm,
  WORKS_BOOM,
  WORKS_HOLD,
  TILE_SLOTS,
  slotRect,
  worksUI,
  WORKS_FLY,
  WORKS_HAND,
  WORKS_TEXT,
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
  /* ฟ้า = ภาพอากาศ: เมฆ (กระเบื้องขาวทรงแคปซูล) ทับดวงอาทิตย์ */
  { x: -81, y: 236, w: 150, h: 150, r: 34, color: '#d3eff6', tiles: [{ x: 12, y: 4, w: 96, h: 50, r: 25, color: '#44c4de' }] },
  {
    x: 0,
    y: 16,
    w: 312,
    h: 232,
    r: 38,
    color: '#e1dbf8',
    /* การ์ดแชท: ฟองคุยส้มซ้ายบน · ข้อความสองแถบส้มด้านล่าง (ปุ่ม + ขวาบน) */
    tiles: [
      { x: -104, y: 54, w: 60, h: 52, r: 26, color: '#a696f1' },
      { x: -30, y: -32, w: 200, h: 22, r: 11, color: '#b3a5f4' },
      { x: -62, y: -70, w: 136, h: 22, r: 11, color: '#b3a5f4' },
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
/** ระยะที่วิดเจ็ตพุ่งเข้าหากล้อง (หน่วยผังจอ) — เกือบถึงตัวกล้อง (ถึงแล้วซ่อน ไม่ให้ทะลุหลังกล้องกลับด้าน) */
const FLY_Z = 2100
/** วิดเจ็ตฟ้าจางเผยฟ้าจริง [เริ่ม, ยาว] (สัดส่วนบท Code) — หลังฉากมืดเปิดรูใต้มันแล้ว */
const BLUE_FADE = [0.93, 0.06] as const
const CTR = new THREE.Vector3()
/**
 * วิดเจ็ตฟ้า = ประตูไป My Works: อัลบั้มปกงานจริงซ้อนกัน (แบบวิดเจ็ต Photos) + ป้าย "My Works"
 * ปกจากพอร์ตจริง (src/assets/portfolios) · ใบบนสุด = ใบหน้า ซ้อนเหลื่อมเอียงนิด ๆ
 * ตอนวิดเจ็ตขยายเต็มจอ ปกกางออกเป็นแถวเรียงกลางจอ (ตัวอย่างงานก่อนเข้า section My Works) แล้วจางพร้อมวิดเจ็ต
 */
/** การ์ดงาน (ยังไม่ใส่ปกจริง — placeholder เทา) กว้าง × สูง × มุมมน (หน่วยการ์ด) */
/* สัดส่วนเดียวกับปก showcase ในหน้า Fastwork (pages/FastworkProfile — การ์ด 258 × 322 มุมมน 14) */
const CW = 62
const CH = (62 * 322) / 258
const CR = (14 * 62) / 258
/**
 * placeholder การ์ดงาน: พื้นเทา + ก้อนมนเทาอ่อน (แบบหน้าจอแอปย่อ ๆ) · 4 แบบวนกัน สลับเทาเข้ม/อ่อนให้แยกใบออก
 * ตำแหน่งเป็นสัดส่วนของการ์ด [x, y, w, h, r(สัดส่วนของด้านสั้น)]
 */
const PH_TONE = [
  ['#4b4f56', '#767b83', '#62666e'],
  ['#8a8f97', '#b4b9c0', '#9fa4ab'],
] as const
const PH_LAYOUT: readonly (readonly [number, number, number, number, number, number])[][] = [
  [[0.12, 0.07, 0.76, 0.34, 0.3, 1], [0.2, 0.47, 0.3, 0.17, 0.5, 2], [0.12, 0.7, 0.76, 0.22, 0.35, 1]],
  [[0.1, 0.08, 0.42, 0.52, 0.3, 1], [0.6, 0.12, 0.3, 0.17, 0.5, 2], [0.6, 0.34, 0.3, 0.17, 0.5, 1], [0.1, 0.68, 0.8, 0.24, 0.4, 2]],
  [[0.14, 0.1, 0.36, 0.2, 0.5, 2], [0.14, 0.34, 0.72, 0.3, 0.3, 1], [0.5, 0.7, 0.36, 0.2, 0.5, 1], [0.14, 0.72, 0.28, 0.17, 0.5, 2]],
  [[0.12, 0.08, 0.76, 0.2, 0.4, 2], [0.12, 0.34, 0.34, 0.2, 0.5, 1], [0.54, 0.34, 0.34, 0.2, 0.5, 1], [0.12, 0.6, 0.76, 0.32, 0.3, 1]],
]
/**
 * หน้ากระดาษของเล่มงาน: แผ่นบางโค้งงอได้ (โค้งใน vertex shader — ไม่ใช่แผ่นแข็ง)
 *   เรขาคณิต x 0..1 = ระยะจากสัน (แบ่งถี่) · y −0.5..0.5 = ตามแนวสัน
 *   uTh = มุมโคนหน้าที่สัน (0 = ราบไปขวา หันเข้าหาคนดู · π = ราบไปซ้าย) · uCurl = มุมที่เพิ่มจากโคนถึงปลาย (กระดาษโค้ง)
 *   ตำแหน่ง = อินทิกรัลของทิศ (cos φ, sin φ) ตามความกว้าง → โค้งเป็นวงรอบจริง ความยาวกระดาษคงที่ ไม่ยืด
 * หน้า/หลังมีลาย (หลังกลับซ้ายขวา) · มุมมนตัดใน fragment · เงาร่องสัน (uGutter) · แสงตามความโค้ง
 */
function makeWorkCard(map: THREE.Texture, pop: readonly [string, string]) {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uMap: { value: map }, uOpacity: { value: 0 }, uSize: { value: new THREE.Vector2(CW, CH) }, uTh: { value: 0 }, uCurl: { value: 0 }, uGutter: { value: 0 }, uR: { value: CR }, uPop: { value: 0 }, uDim: { value: 1 }, uEdge: { value: 1 }, uPopA: { value: new THREE.Color(pop[0]) }, uPopB: { value: new THREE.Color(pop[1]) } },
    vertexShader: /* glsl */ `
      uniform vec2 uSize;
      uniform float uTh;
      uniform float uCurl;
      varying vec2 vUv;
      varying vec3 vN;
      void main() {
        float u = position.x;
        float phi = uTh + uCurl * u;
        vec2 xz = abs(uCurl) < 1e-3
          ? vec2(cos(uTh), sin(uTh)) * u * uSize.x
          : vec2(sin(phi) - sin(uTh), cos(uTh) - cos(phi)) * uSize.x / uCurl;
        vec3 p = vec3(xz.x, position.y * uSize.y, xz.y);
        vN = normalize(normalMatrix * vec3(-sin(phi), 0.0, cos(phi)));
        vUv = vec2(u, position.y + 0.5);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform vec2 uSize;
      uniform float uGutter;
      uniform float uR;
      uniform float uPop;
      uniform float uDim;
      uniform float uEdge;
      uniform vec3 uPopA;
      uniform vec3 uPopB;
      varying vec2 vUv;
      varying vec3 vN;
      float hash(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        /* มุมมน (หน่วยการ์ด) */
        vec2 q = abs((vUv - 0.5) * uSize) - (uSize * 0.5 - uR);
        float d = length(max(q, 0.0)) - uR;
        if (d > 0.0) discard;
        vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
        vec3 col = texture2D(uMap, uv).rgb;
        vec3 L = normalize(vec3(-0.4, 0.55, 0.75));
        col *= 0.62 + 0.45 * max(dot(n, L), 0.0);
        /* เงาร่องสัน + เนื้อกระดาษ (เกรนบาง) */
        col *= 1.0 - 0.38 * uGutter * (1.0 - smoothstep(0.0, 0.22, vUv.x));
        /*
         * ระเบิด (uPop): กลายเป็นไทล์ภาพประกอบ — ไล่สีสดแนวทแยงพ่นเกรนหนา + เส้นขอบดำ (แบบภาพ Essential coding apps)
         */
        float gt = clamp(vUv.y * 0.75 + (1.0 - vUv.x) * 0.25, 0.0, 1.0);
        vec3 pop = mix(uPopB, uPopA, smoothstep(0.1, 0.9, gt + (hash(floor(gl_FragCoord.xy * 0.5)) - 0.5) * 0.35));
        col = mix(col, pop * (0.85 + 0.15 * max(dot(n, L), 0.0)), uPop);
        /* เส้นขอบหนาคงที่บนจอ: ไทล์ขยายเต็มจอ (uEdge เล็กลง) เส้นไม่หนาตาม */
        col = mix(col, vec3(0.1, 0.09, 0.12), uPop * smoothstep(-2.4 * uEdge, -1.4 * uEdge, d));
        col += (hash(floor(gl_FragCoord.xy)) - 0.5) * (0.035 + 0.05 * uPop);
        gl_FragColor = vec4(col * uDim, uOpacity);
        #include <colorspace_fragment>
      }`,
  })
}

function paintPlaceholder(n: number) {
  const W = 200
  const H = Math.round((W * CH) / CW)
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  const tone = PH_TONE[n % 2]
  g.fillStyle = tone[0]
  g.fillRect(0, 0, W, H)
  for (const [x, y, w, h, r, c] of PH_LAYOUT[n % PH_LAYOUT.length]) {
    g.fillStyle = tone[c]
    g.beginPath()
    g.roundRect(x * W, y * H, w * W, h * H, r * Math.min(w * W, h * H))
    g.fill()
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
/** ท่าซ้อน [x, y, หมุน z] ต่อใบ (ใบท้าย = บนสุด) · หน่วยผังจอในการ์ด */
/** แถวงานตอนฟ้าเต็มจอ: จำนวนใบ (ปกวนซ้ำ) · เอียงแกน · ระยะห่าง (เท่าของปก) · ขนาด */
const FAN_N = 10
/** แกนแถว: ขึ้นขวา */
const FAN_TILT = 0.45
/** มุมคลี่ของหน้าแรก → หน้าสุดท้าย (rad) */
const FAN_OPEN = [0.22, Math.PI - 0.22] as const
/** หน่วงออกตัวของหน้าสุดท้าย (สัดส่วนของช่วงคลี่) */
const FAN_STAGGER = 0.5
/** สีไทล์ตอนระเบิด (บน · ล่าง) วนตามหน้า — แดงส้ม · เขียวฟ้า · ส้มเหลือง · ฟ้าม่วง · ครีม */
const POP: readonly (readonly [string, string])[] = [
  ['#ff2a1a', '#ff9a1f'],
  ['#7cc46a', '#3f7ff0'],
  ['#ff7a1a', '#ffd21f'],
  ['#4f7dff', '#b08cff'],
  ['#f6f1e4', '#efe6cf'],
]
/* กองในวิดเจ็ต: หน้าตรงเรียบ ซ้อนเหลื่อมลงทีละนิด (ใบบนสุดอยู่หน้า) — ไม่เอียง ไม่กระจาย */
const STACK: readonly (readonly [number, number, number])[] = [
  [0, 10, 0],
  [0, 6.5, 0],
  [0, 3, 0],
  [0, -0.5, 0],
]
const CTR_INV = new THREE.Matrix4()
/* ล็อกท่ากองงานในพิกัดโลก */
const WP = new THREE.Vector3()
const WQ = new THREE.Quaternion()
const WS = new THREE.Vector3()
const LP = new THREE.Vector3()
const LQ = new THREE.Quaternion()
const LE = new THREE.Euler()
const LS = new THREE.Vector3()
const LM2 = new THREE.Matrix4()
const LM3 = new THREE.Matrix4()
/** ท่ากองงานตอนจบ Code: ระยะ z · ขนาด (โลก ที่จอสูง 900) */
const WORKS_LOCK = [1432, 20.66] as const
/** ขนาดโลกของการ์ดงานตอนเป็นหนังสือ (จอสูง 900) */
const WORKS_CARD = 0.56
/** ป้าย My Works ในวิดเจ็ต (พิกัดกลุ่มอัลบั้ม): ซ้ายคำ x · กลางบรรทัด y · ขนาดฟอนต์ */
const LABEL0 = [-62.5, -52.4, 10.5] as const
/** ระนาบที่ตัวอักษรลงจอด (หน้าวิดเจ็ต หลังหน้ากระดาษ) · หน่วงออกตัวต่อตัวอักษร */
const LETTER_Z = -1
const LETTER_STAG = 0.07
const BQ = new THREE.Quaternion()
const RO = new THREE.Vector3()
const RP = new THREE.Vector3()
const LA = new THREE.Vector3()
const LB = new THREE.Vector3()
const LS2 = new THREE.Vector3()
const LE2 = new THREE.Vector3()
const SLOT_P = new THREE.Vector3()
const SLOT_Q = new THREE.Quaternion()
const QZ = new THREE.Quaternion()
const ZAX = new THREE.Vector3(0, 0, 1)
const OFF = new THREE.Vector3()
/** ทิศระเบิดของวิดเจ็ตตอนเครื่องชน [x, y, หมุน x, หมุน y, หมุน z] (ใบ 1 = ม่วง, 2 = พีช) */
const BURST: Record<number, readonly [number, number, number, number, number]> = {
  1: [1, 0.35, -0.6, 1, 0.5],
  2: [-0.9, -0.55, 0.7, -1, -0.6],
}
/** สีเติมของบท Code [บน, ล่าง] — การ์ดไล่โทนอิ่มแบบวิดเจ็ต iOS (ฟ้า · ม่วง · พีชปะการัง) ของในการ์ดเป็นขาวนวลตัดกับพื้น */
const FILL_CARD: readonly (readonly [string, string])[] = [
  ['#6fe6ff', '#2f6bff'],
  ['#b69cff', '#5b2fe6'],
  ['#ffd9b8', '#ff7f86'],
]
const FILL_TILE = ['#ffffff', '#e9e4ff'] as const
/**
 * หน้าโหมดสว่าง (บน → ล่าง) ตามภาพประกอบ Sonoma Shortcuts — แยกจากสีเติมของบท Code
 * การ์ดฟ้า = ภาพอากาศ (วาดบนแคนวาส paintWeather) · การ์ดกลาง = การ์ดแชทเขียวมะนาว แถบส้ม · การ์ดล่าง = ส้มแซลมอน
 */
const FACE_CARD: readonly (readonly [string, string])[] = [
  ['#3f7ff0', '#5aa85a'],
  ['#e4f59a', '#c3dd5c'],
  ['#ff9f7a', '#ee5a6e'],
]
const FACE_TILE: Record<string, readonly [string, string]> = {
  '#44c4de': ['#ffffff', '#b9c6ff'],
  '#a696f1': ['#ff9a4a', '#ff6a2a'],
  '#b3a5f4': ['#e39a4e', '#cf7d36'],
}

/** ภาพอากาศแบบพ่นสี: ฟ้าไล่ลง ดวงอาทิตย์เหลืองเบลอ ขอบฟ้าแดงอมส้ม พื้นเขียว */
function paintWeather() {
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const g = cv.getContext('2d')!
  const sky = g.createLinearGradient(0, 0, 0, S)
  sky.addColorStop(0, '#2f6fe8')
  sky.addColorStop(0.5, '#6fb2ff')
  sky.addColorStop(0.6, '#f0605a')
  sky.addColorStop(0.7, '#4fa04f')
  sky.addColorStop(1, '#3f8a44')
  g.fillStyle = sky
  g.fillRect(0, 0, S, S)
  g.filter = 'blur(10px)'
  g.fillStyle = '#ffd84a'
  g.beginPath()
  g.arc(S * 0.4, S * 0.36, S * 0.17, 0, Math.PI * 2)
  g.fill()
  g.filter = 'none'
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
/** สีปุ่ม + ต่อการ์ด (ใบ 3 เป็นเกาะ Research — ไม่มีปุ่ม) */
const BADGE = ['#3d5bd9', '#f2564b'] as const
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
 * ท้ายบท Code: ลำแสงสแกนแนวนอนกวาดจากหัวลงท้ายจอเครื่อง (ตรวจของจริงรอบสุดท้ายก่อนส่ง) — แกนขาวคม รัศมีม่วง · ท้ายลำแสงเป็นพิกเซลม่วงกะพริบ
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
      /* ขอบแก้วของเครื่อง (หน่วยผังจอ) */
      #define DEV_HW 205.0
      #define DEV_HH 405.0
      #define DEV_R 88.0
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float box(vec2 p, vec2 h, float r) {
        vec2 q = abs(p) - (h - r);
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }
      void main() {
        /*
         * ทุกอย่างอยู่ในกรอบเครื่องพอดี (กล่องมนเท่าขอบแก้วของเครื่อง ขอบนุ่ม 4 หน่วย) — ไม่ยื่นพ้นซ้ายขวา/ล่าง
         * ลำแสงคม + เรืองนุ่มสองชั้น · ท้ายลำแสงเป็นพิกเซลจาง ๆ กะพริบช้า (ค่อย ๆ สว่าง/หรี่ ไม่สลับวาบ)
         */
        float inside = 1.0 - smoothstep(-4.0, 0.0, box(vP, vec2(DEV_HW, DEV_HH), DEV_R));
        if (inside <= 0.0) discard;
        float dx = uY - vP.y;
        vec3 purple = vec3(0.5, 0.3, 1.0);
        float core = exp(-dx * dx / 10.0);
        float halo = exp(-abs(dx) / 22.0) * 0.5 + exp(-abs(dx) / 80.0) * 0.16;
        vec3 col = vec3(1.0) * core + purple * halo;
        if (dx < 0.0) {
          float cs = 12.0;
          vec2 cell = floor(vP / cs);
          vec2 f = fract(vP / cs) - 0.5;
          float sq = 1.0 - smoothstep(0.32, 0.42, max(abs(f.x), abs(f.y)));
          float prob = exp(dx / 110.0);
          float on = step(1.0 - prob * 0.7, hash(cell));
          float tw = 0.55 + 0.45 * sin(uT * 3.0 + hash(cell * 3.7) * 6.2832);
          float lum = mix(0.3, 1.0, hash(cell * 1.7 + 3.1)) * prob * tw;
          col += mix(purple, vec3(0.86, 0.78, 1.0), hash(cell + 9.0) * 0.4) * on * sq * lum * 0.6;
        }
        col *= uA * inside;
        float m = max(col.r, max(col.g, col.b));
        if (m < 0.003) discard;
        gl_FragColor = vec4(col, min(1.0, m));
      }`,
  })
}

/**
 * ช่วงสแกนในบท Code [เริ่ม, ยาว] — ต้นบททันทีที่ฉากมืด ลำแสงกวาดบน → ล่าง ระหว่างเครื่องตั้งหน้าตรง
 * วิดเจ็ตเติมสีตามลำแสง (เส้นสีอยู่ที่ลำแสงพอดี — ด้านบนลำแสงเติมแล้ว ด้านล่างยังเป็นกระจก)
 */
const SCAN = [0.06, 0.34] as const
/** ลำแสงอยู่ที่ y ไหนของผังจอ (หน่วยผังจอ บน = +) */
const scanY = (code: number) => lerp(405, -405, smooth(clamp01((code - SCAN[0]) / SCAN[1])))

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
  const { size, invalidate } = useThree()

  /** ปุ่ม + มุมขวาบนของการ์ด (แบบภาพประกอบ Sonoma Shortcuts) — วงกลมหนาสีทึบ เครื่องหมายบวกขาว */
  const badge = useMemo(() => {
    const disc = new THREE.ExtrudeGeometry(new THREE.Shape().absarc(0, 0, 15, 0, Math.PI * 2, false), { depth: 4, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 3, curveSegments: 32 })
    const bar = new THREE.ExtrudeGeometry(rrect(16, 4.4, 2.2), { depth: 1, bevelEnabled: false, curveSegments: 6 })
    const mats = BADGE.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true }))
    const whites = BADGE.map(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }))
    return { disc, bar, mats, whites }
  }, [])
  useEffect(
    () => () => {
      badge.disc.dispose()
      badge.bar.dispose()
      badge.mats.forEach((m) => m.dispose())
      badge.whites.forEach((m) => m.dispose())
    },
    [badge],
  )

  /** วิดเจ็ต: แผ่นละเรขาคณิตหนึ่งชุด วัสดุตามสี (แคชตามสี) */
  const { parts, mats, fillOf } = useMemo(() => {
    const cache = new Map<string, THREE.Material>()
    const mat = (c: string, tile: boolean) => {
      const k = `${c}|${tile}`
      let m = cache.get(k)
      if (!m) {
        /* แผ่นหนาทึบแบบภาพประกอบ Sonoma — สีหน้าไล่จาก FILL_CARD / FILL_TILE (paint ด้านล่าง) */
        m = makeChunkyTile(c)
        cache.set(k, m)
      }
      return m
    }
    const weather = paintWeather()
    const list = CARDS.map((c, i) => {
      const sl = slab(c, 16)
      const cm = mat(c.color, false) as THREE.ShaderMaterial
      cm.uniforms.uFaceTop.value.set(FACE_CARD[i][0])
      cm.uniforms.uFaceBot.value.set(FACE_CARD[i][1])
      cm.uniforms.uHalf.value.set(c.w / 2, c.h / 2)
      if (i === 0) {
        cm.uniforms.uMap.value = weather
        cm.uniforms.uHasMap.value = 1
      }
      c.tiles.forEach((t) => {
        const f = FACE_TILE[t.color]
        const tm = mat(t.color, true) as THREE.ShaderMaterial
        /* กระเบื้องไม่เขียน depth — กองงานในการ์ดฟ้า (วาดทีหลัง) ไม่โดนกระเบื้องที่หนากว่าบัง */
        tm.depthWrite = false
        if (f) {
          tm.uniforms.uFaceTop.value.set(f[0])
          tm.uniforms.uFaceBot.value.set(f[1])
        }
      })
      return { c, geo: sl.g, top: sl.top, mat: cm, tiles: c.tiles.map((t) => ({ t, geo: slab(t, 6).g, mat: mat(t.color, true) })) }
    })
    /* วัสดุ → การ์ดที่มันอยู่ (ลำดับเติมสี) กับครึ่งความสูง — สีเดียวกันในการ์ดเดียวกันขนาดเท่ากัน ใช้วัสดุร่วมได้ */
    const fillOf = new Map<THREE.Material, { card: number; span: number; cy: number }>()
    const paint = (m: THREE.Material, [top, bot]: readonly [string, string]) => {
      const u = (m as THREE.ShaderMaterial).uniforms
      u.uFillTop.value.set(top)
      u.uFillBot.value.set(bot)
    }
    list.forEach((pc, i) => {
      fillOf.set(pc.mat, { card: i, span: pc.c.h / 2, cy: pc.c.y })
      paint(pc.mat, FILL_CARD[i])
      pc.tiles.forEach((pt) => {
        fillOf.set(pt.mat, { card: i + 0.5, span: pt.t.h / 2, cy: pc.c.y + pt.t.y })
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
      mats.forEach((m) => {
        ;(m as THREE.ShaderMaterial).uniforms.uMap?.value?.dispose()
        m.dispose()
      })
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
  /* อัลบั้มงานในวิดเจ็ตฟ้า (ดู WORK_COVERS) */
  const works = useMemo(() => {
        /* แผ่นกระดาษ: x 0..1 จากสัน (แบ่ง 32 ช่องให้โค้งเนียน) — ดู makeWorkCard */
    const geo = new THREE.PlaneGeometry(1, 1, 32, 1)
    geo.translate(0.5, 0, 0)
    const covers = Array.from({ length: FAN_N }, (_, n) => makeWorkCard(paintPlaceholder(n), POP[n % POP.length]))
    /*
     * ป้าย "My Works" = ตัวอักษรแยกทีละตัว (แคนวาสต่อตัว ฟอนต์/น้ำหนักเดียวกับคำพื้นหลัง DOM)
     * อยู่ในวิดเจ็ตเป็นป้าย → บินไล่ทีละตัวไปลงจอดเป็นคำพื้นหลัง (ดู WORKS_FLY) · เรขาคณิตหน่วย em: จุดกำเนิด = ซ้ายตัวอักษร กลางบรรทัด
     */
    const FS = 160
    const font = `700 ${FS}px -apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Helvetica Neue", sans-serif`
    const mc = document.createElement('canvas').getContext('2d')!
    mc.font = font
    const chars = [...WORKS_TEXT].map((ch, n) => ({ ch, n })).filter((c) => c.ch !== ' ')
    /* ระยะ em จากซ้ายคำ (สำรอง ถ้ายังไม่ได้ผังจาก DOM) — ช่องไฟ −0.055em แบบคำ DOM */
    const fm = mc.measureText('My Works')
    const em0 = chars.map((c) => mc.measureText(WORKS_TEXT.slice(0, c.n)).width / FS - 0.055 * c.n)
    const letters = chars.map(({ ch }) => {
      const pad = FS * 0.2
      const w = Math.ceil(mc.measureText(ch).width + pad * 2)
      const h = Math.ceil(FS * 1.4)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g2 = c.getContext('2d')!
      g2.font = font
      g2.fillStyle = '#ffffff'
      /*
       * เส้นฐานแบบ CSS (line-height 1): กลางบรรทัด + (ascent − descent) / 2 ของฟอนต์ — ตรงกับคำ DOM ตอนส่งต่อ
       * ('middle' ของแคนวาส = กลาง em สูงกว่าตัว DOM ราว 0.06em เห็นขอบซ้อน)
       */
      g2.textBaseline = 'alphabetic'
      g2.fillText(ch, pad, h / 2 + (fm.fontBoundingBoxAscent - fm.fontBoundingBoxDescent) / 2)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      const geo = new THREE.PlaneGeometry(w / FS, h / FS)
      geo.translate(w / FS / 2 - pad / FS, 0, 0)
      return { geo, mat: new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }) }
    })
    return { geo, covers, letters, em0 }
  }, [])
  useEffect(
    () => () => {
      works.geo.dispose()
      works.letters.forEach((l) => {
        l.geo.dispose()
        l.mat.map?.dispose()
        l.mat.dispose()
      })
      works.covers.forEach((m) => {
        m.uniforms.uMap.value.dispose()
        m.dispose()
      })
    },
    [works],
  )
  const worksRef = useRef<THREE.Group>(null)
  const coverRefs = useRef<(THREE.Mesh | null)[]>([])
  const letterRefs = useRef<(THREE.Mesh | null)[]>([])
  /** ความคืบหน้าช่วง My Works แบบหน่วงแล้ว (ดู worksPost) */
  const postSm = useRef(-9)
  /** ไทล์งาน: ความคืบหน้าเปิดเต็มจอ / hover (หน่วงตามเวลา) */
  const tileOpenK = useRef<number[]>(Array(FAN_N).fill(0))
  const tileHoverK = useRef<number[]>(Array(FAN_N).fill(0))
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

  useFrame(({ clock, camera }, delta) => {
    const g = root.current
    const f = frame.current
    if (!g || !f) return
    /*
     * อ่านสกรอลล์สด ๆ ในเฟรมที่วาด (เหมือนแคนวาสฟอง — BubbleTraveler readPose) — ค่า f.b อ่านตอน scroll event
     * ช้ากว่าหนึ่งเฟรม: เครื่อง (สด) กับวิดเจ็ต/เล่มงาน (ช้า) เหลื่อมกันไปมาตอนสกรอลล์นุ่ม = ภาพเด้ง
     */
    const story = document.getElementById('what-i-do')
    const b = story ? workBeats(storySv2(Math.max(0, -story.getBoundingClientRect().top / (window.innerHeight || 1)))) : f.b
    const W = size.width
    const H = size.height
    /* ของในจอมีเฉพาะตอนเครื่องตั้งหน้าตรงเป็นโต๊ะทำงานแล้ว */
    /* ติดเครื่องตั้งแต่เครื่องโผล่ (บทลงจอด) — วิดเจ็ตเริ่มประกอบระหว่างซูมออก */
    g.visible = f.on && deviceMat.ok
    if (!g.visible) return
    /* บท Code โหมดมืด: การ์ดเป็นกระจกดำ ขอบเรืองสีของมัน */
    const dk = codeDark(b)
    /* ปุ่ม + : จางตอนเข้าโหมดมืด กลับมาหลังสแกนเติมสีครบ · ใบฟ้าจางตอนเริ่มลอยเข้าจอ */
    const bo = Math.max(1 - smooth(clamp01(b.code / 0.08)), smooth(clamp01((b.code - SCAN[1]) / 0.06)))
    badge.mats.forEach((m, n) => {
      const o = bo * (n === 0 ? 1 - smooth(clamp01((b.code - 0.7) / 0.05)) : 1)
      m.opacity = o
      badge.whites[n].opacity = o
    })
    /* บท Code: วิดเจ็ตเติมสีจากบนลงล่างตามลำแสงสแกน (ระดับสี = ตำแหน่งลำแสงในพิกัดของแผ่นนั้น) — เติมแล้วค้าง */
    const sy = b.code <= SCAN[0] ? 1e5 : scanY(b.code)
    mats.forEach((m) => {
      const u = (m as THREE.ShaderMaterial).uniforms
      u.uDark.value = dk
      const fo = fillOf.get(m)
      if (!fo) return
      u.uSpan.value = fo.span
      u.uFill.value = sy >= 1e5 ? 1e5 : sy - fo.cy
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

    /* ── ท้ายบท Code: ลำแสงสแกนกวาดบน → ล่าง ทิ้งพิกเซลม่วงไว้ข้างหลัง (ด้านบน) ── */
    const sm = scanRef.current
    if (sm) {
      const k = clamp01((b.code - SCAN[0]) / SCAN[1])
      sm.visible = k > 0 && k < 1
      if (sm.visible) {
        const su = scan.mat.uniforms
        /* กวาดจากขอบบนถึงขอบล่างของเครื่องพอดี */
        su.uY.value = scanY(b.code)
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
    /* ท่าแตะ/กดวิดเจ็ตเอาออกแล้ว — คงโค้ดไว้ที่ 0 */
    const alive: number = 0
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
      /*
       * ปลายบท Code: เครื่องลอยมาชนคำ Code (CODE_HIT — BubbleTraveler) → วิดเจ็ตกระจายออกแรงด้วยแรงชน
       *   ม่วง/พีช: ระเบิดออกเร็วทันที (ease-out แรงตอนต้น) เหวี่ยงออกข้างคนละทิศ หมุนคว้าง พุ่งเข้ากล้องพ้นไป
       *   ฟ้า (ใบบน): ออกท้ายสุด เข้ากลางจอ ขยายจนเต็มจอแล้วทะลุกล้อง = ฟ้าของวิดเจ็ตกลายเป็นฟ้าของฉากถัดไป
       *   (ฉากมืดเปิดรูกลับเป็นฟ้าพร้อมกัน — WorkStory DARK_OUT)
       */
      let px = pc.c.x + (1 - land) * (i - 1) * 60
      let py = pc.c.y + (1 - land) * 140
      let pz = 4 + (1 - land) * 320 + hold * 16 + ex * (110 + i * 90) + tap * (pop * 14 - press * 6)
      let rx = (1 - land) * -0.6
      let ry = (1 - land) * (i - 1) * 0.5
      let rz = 0
      let gone = false
      let grow = 1
      let sp = 0
      let wkv = 0
      if (i === 0) {
        /*
         * ฟ้า (ตัวหลัก): เข้ากลางจอ ลอยออกหน้าจอระยะพอดี แล้วขยายใหญ่จนเต็มจอ — ไม่ให้ทะลุระนาบใกล้ของกล้อง
         * (เครื่องก็ลอยตามเข้ากล้องช้า ๆ ทั้งก้อน — BubbleTraveler push)
         */
        /*
         * เข้ากลางจอจริง (ไม่ใช่กลางเครื่อง): แปลงระยะจากกลางเครื่องถึงกลางจอ (px) เป็นหน่วยผังจอ
         * เต็มจอราว k 0.85 → ฉากมืดเปิดรูเป็นฟ้าอยู่ใต้ฟ้าของวิดเจ็ต (WorkStory DARK_OUT) → วิดเจ็ตจางเผยฟ้าจริง (BLUE_FADE)
         */
        const k = clamp01((b.code - 0.7) / 0.22)
        const e = k * k * (3 - 2 * k)
        /* กลางจอ = แกนกล้อง (จุดกำเนิดโลกของแคนวาสนี้) — แปลงเข้าพิกัดของเครื่องตรง ๆ ไม่ต้องกะจากกรอบเครื่อง */
        g.updateWorldMatrix(true, false)
        CTR.set(0, 0, 0).applyMatrix4(CTR_INV.copy(g.matrixWorld).invert())
        const tx = CTR.x
        const ty = CTR.y
        px += (tx - px) * e
        py += (ty - py) * e
        pz += e * 420
        grow = 1 + Math.pow(k, 3) * 11
        const fade = 1 - smooth(clamp01((b.code - BLUE_FADE[0]) / BLUE_FADE[1]))
        ;(pc.mat as THREE.ShaderMaterial).uniforms.uAlpha.value = fade
        ;(pc.mat as THREE.ShaderMaterial).uniforms.uVivid.value = smooth(clamp01(k / 0.35))
        /* ช่องขาวข้างในจางออกก่อนใหญ่จนกินจอ — เหลือฟ้าล้วน */
        pc.tiles.forEach((pt) => {
          ;(pt.mat as THREE.ShaderMaterial).uniforms.uAlpha.value = (1 - smooth(clamp01((k - 0.15) / 0.25))) * fade
        })
        /*
         * อัลบั้มงาน: โผล่แทนช่องขาวตอนเริ่มลอย · ฟ้าเต็มจอแล้ว = กองงานแตกออกเป็นแถวการ์ดเรียงตามแกนเฉียง
         * แต่ละใบพลิกรอบแกนไล่มุมกัน (แบบโรโลเด็กซ์) หมุนช้า ๆ ตามสกรอลล์ · อยู่ต่อหลังวิดเจ็ตจางเป็นฟ้า จางตอนเข้าบท Ship
         */
        /*
         * หลังฟ้าเต็มจอ ต่อยาวข้ามท้าย Code เข้าต้น Ship — นับเป็นหน่วยสกรอลล์ (sv2) ให้จังหวะไม่ขึ้นกับความยาวบท
         *   คลี่ (sp) → ค่อย ๆ ซูมเข้า (zm) → ระเบิด (boom): หน้ากระจายออกตามทิศที่มันชี้ พุ่งเข้ากล้อง หมุน แล้วจาง
         */
        /*
         * หน่วงความคืบหน้า (damping) — สกรอลล์มาเป็นสเต็ป (ล้อเมาส์/แทร็กแพด) ภาพคลี่/บินจะไหลตามนุ่ม ๆ ไม่กระตุกตามสเต็ป
         * กระโดดไกล (เปิดหน้ากลางบท) = ตามทันที
         */
        const postRaw = worksPost(b)
        const ps = postSm.current
        postSm.current = Math.abs(postRaw - ps) > 0.4 ? postRaw : ps + (postRaw - ps) * (1 - Math.exp(-Math.min(0.1, delta) * 7))
        const post = postSm.current
        worksPostSm.v = post
        if (Math.abs(postRaw - post) > 1e-4) invalidate()
        /* คลี่หลังฟ้าเต็มจอแล้ว (เข้าไปในวิดเจ็ตก่อน ค่อยคลี่) */
        const spRaw = clamp01((post - 0.04) / 0.34)
        sp = smooth(spRaw)
        /* ทั้งเล่มเอียงเข้าท่า ease-out (เร็วก่อน นุ่มตอนจบ) */
        const tk = outCubic(clamp01(spRaw / 0.7))
        const zm = smooth(clamp01((post - 0.24) / 0.3))
        const boom = clamp01((post - WORKS_BOOM[0]) / WORKS_BOOM[1])
        const boomE = 1 - Math.pow(1 - boom, 2)
        /* section ค้าง: ไทล์ลงช่องหลังระเบิด · ท้ายบทไทล์ออก (ex) */
        const land = smooth(clamp01((boom - 0.12) / 0.62))
        const ex = smooth(clamp01((post - WORKS_HOLD[1]) / (WORKS_HOLD[2] - WORKS_HOLD[1])))
        worksUI.hold = post > WORKS_HOLD[0] && post < WORKS_HOLD[1] ? 1 : 0
        if (!worksUI.hold) worksUI.open = -1
        const wk = smooth(clamp01((k - 0.08) / 0.25)) * (1 - ex)
        wkv = wk
        const roll = (b.code - 0.9) * 2.4 + b.ship * 1.2
        /* ขนาดในพิกัดการ์ด: หาร grow ออก ให้แถวไม่โตตามการ์ด */
        let wgScale = 1
        const wg = worksRef.current
        if (wg) {
          wg.visible = wk > 0.002
          wg.position.set(0, 0, pc.top + 2)
          /* แถวเอียงลึกเข้าจอนิด (ก้มมอง) — เห็นสันบน/ล่างของการ์ด มีมิติ ไม่แบนกับจอ */
          wg.rotation.set(tk * 0.3, 0, 0, 'XYZ')
          /*
           * กางแล้ว = ล็อกท่าในพิกัดโลก (กลางจอ ระยะคงที่) — ต้น Ship เครื่องถอยกลับ/หมุน การ์ดฟ้าถูกดึงตาม
           * ท่าที่ล็อก = ท่าจริงตอนจบ Code (วัดที่จอสูง 900 แล้วคูณตามความสูงจอ) · ผสมจากท่าจริงตาม sp จึงไม่กระตุก
           */
          if (sp > 0) {
            wg.updateWorldMatrix(true, false)
            wg.matrixWorld.decompose(WP, WQ, WS)
            const hk = H / 900
            LP.set(0, 0, WORKS_LOCK[0] * hk)
            LQ.setFromEuler(LE.set(tk * 0.3, 0, 0))
            LS.setScalar(WORKS_LOCK[1] * hk)
            WP.lerp(LP, sp)
            WQ.slerp(LQ, sp)
            WS.lerp(LS, sp)
            LM2.compose(WP, WQ, WS).premultiply(LM3.copy(wg.parent!.matrixWorld).invert())
            LM2.decompose(wg.position, wg.quaternion, wg.scale)
          } else wg.scale.setScalar(1)
          /* ขนาดโลกของกลุ่ม (หลังล็อก) — ใช้จำกัดขนาดการ์ดบนจอ */
          wg.updateWorldMatrix(true, false)
          wgScale = WS.setFromMatrixScale(wg.matrixWorld).x
        }
        /*
         * โตตามวิดเจ็ตตอนเข้าไป แล้วหยุดที่ขนาดหนังสือ — วัดขนาดโลกจริง (รวมระยะเข้ากล้อง) แล้ว cap นุ่ม
         * WORKS_CARD = ขนาดโลกของการ์ดตอนเป็นหนังสือ (จอสูง 900)
         */
        const r = (wgScale / (WORKS_CARD * (H / 900))) / (1 + zm * 0.35)
        const cs = 1 / Math.pow(1 + Math.pow(r, 4), 0.25)
        /* จอ → พิกัดกลุ่มอัลบั้ม (ระนาบ z ที่ให้) · หันหน้าเข้ากล้อง (billboard) — ใช้วางไทล์ลงช่อง/เปิดเต็มจอ */
        if (wg) {
          LM3.copy(wg.matrixWorld).invert()
          wg.matrixWorld.decompose(WP, WQ, WS)
          BQ.copy(WQ).invert().multiply(camera.quaternion)
        }
        const toLocal = (sx: number, sy: number, zL: number, out: THREE.Vector3) => {
          RO.copy(camera.position).applyMatrix4(LM3)
          RP.set((sx / W) * 2 - 1, -((sy / H) * 2 - 1), 0.5).unproject(camera).applyMatrix4(LM3)
          return out.copy(RO).lerp(RP, (zL - RO.z) / (RP.z - RO.z))
        }
        toLocal(W / 2, H / 2, 0, LA)
        toLocal(W / 2 + 100, H / 2, 0, LB)
        const upp = LA.distanceTo(LB) / 100
        const dt = Math.min(0.1, delta)
        const openAny = tileOpenK.current.reduce((m, v) => Math.max(m, v), 0)
        coverRefs.current.forEach((cm, j) => {
          if (!cm) return
          const [sx0, sy0] = STACK[j % STACK.length]
          /*
           * หนังสือคลี่หน้า: ทุกใบยึดสันเดียวกัน (ด้านยาวของการ์ด ที่กลางแถว) แล้วพับรอบสันไปคนละมุม
           * มุม 0 = ราบหันหน้าเข้าหาคนดู ขวาของสัน · 90° = ชี้เข้ากล้อง (เห็นแต่สัน) · 180° = ราบไปทางซ้าย
           * กองในวิดเจ็ต = หนังสือปิด (ทุกใบมุม 0) → คลี่ออกตามสกรอลล์ (มุมเป้า × sp) · roll = พลิกต่อช้า ๆ
           */
          const f = j / (FAN_N - 1)
          /*
           * พลิกไล่ทีละหน้า (หน้าที่ไปไกลสุดออกตัวก่อน) ease เข้า-ออก · มุมไล่ลำดับเสมอ ไม่มีหน้าไหนแซงกัน = ไม่ทับมั่ว
           * ระหว่างพลิก ปลายกระดาษถ่วงตามหลังโคน (โค้ง) แล้วคลายเกือบตรงตอนวาง · ระเบิด = กระดาษสะบัด
           */
          const pj = clamp01((spRaw - (1 - f) * FAN_STAGGER) / (1 - FAN_STAGGER))
          const pe = pj < 0.5 ? 4 * pj * pj * pj : 1 - Math.pow(-2 * pj + 2, 3) / 2
          /*
           * ระเบิดแบบเป็นระเบียบ: พัดกางกว้างขึ้นรอบกลางเล่ม (มุมยังไล่ลำดับ) แล้วทุกหน้าพุ่งออกตามทิศที่ตัวเองชี้
           * — หน้าแต่ละใบชี้คนละมุม จึงแยกห่างกันเสมอ ไม่สวนกัน · ไม่สุ่มมุม/โค้ง/หมุนต่อใบ
           */
          const th0 = pe * (FAN_OPEN[0] + (FAN_OPEN[1] - FAN_OPEN[0]) * f) + sp * roll * 0.15
          const th = Math.PI / 2 + (th0 - Math.PI / 2) * (1 + boomE * 0.35)
          /* ปลายกระดาษสะบัดตามหลังทิศพุ่ง (โค้งทางเดียวกันทุกใบ ขนาดตามระยะห่างจากกลาง) */
          const curl = -Math.sin(Math.PI * pj) * 0.95 - 0.12 * sp * Math.cos(th) - boomE * 0.5 * Math.cos(th)
          const tz = FAN_TILT * tk
          /* สันหนังสือ: ปิด = สันอยู่ซ้ายของหน้า (หน้าอยู่กลาง) → เปิด = สันกลางจอ · หน้าเหลื่อมกันนิดตามความหนาสัน */
          const ax0 = -CW * 0.5 * cs * (1 - sp) + (f - 0.5) * 2.5 * cs * sp
          const ay0 = (sy0 - 12) * cs * (1 - sp)
          const az0 = (j < STACK.length ? j * 0.6 : (j % STACK.length) * 0.6 - 0.3) * cs * (1 - sp)
          /* ระเบิด: ออกตามทิศหน้า + กระจายตามแนวสัน + พุ่งเข้ากล้อง */
          const out = boomE * 110 * cs
          const ax = ax0 + Math.cos(th) * out + sx0 * cs
          const ay = ay0
          cm.position.set(Math.cos(tz) * ax - Math.sin(tz) * ay, Math.sin(tz) * ax + Math.cos(tz) * ay, az0 + Math.sin(th) * out + boomE * 40 * cs)
          cm.rotation.set(0, 0, tz, 'ZYX')
          cm.scale.setScalar(cs)
          const u = works.covers[j].uniforms
          u.uTh.value = th
          u.uCurl.value = curl
          u.uGutter.value = sp * (1 - boomE)
          u.uPop.value = smooth(clamp01(boom / 0.18))
          cm.visible = j < STACK.length || sp > 0.001
          /*
           * ลงช่อง (land): จากท่าระเบิด → ไทล์แบนหันหน้าเข้าหาคนดูตามช่องบนจอ (TILE_SLOTS) · hover = ยกขึ้นนิด
           * เปิด (คลิก) = ไทล์ไหลเข้ากลางจอ ขยายเต็มจอ (รูปทรงยืดเป็นสัดส่วนจอ) · ใบอื่นหรี่ · ท้ายบทไทล์พุ่งออกนอกจอ
           */
          if (land > 0 && j < TILE_SLOTS.length) {
            const ok2 = tileOpenK.current
            const hk2 = tileHoverK.current
            ok2[j] += ((worksUI.open === j ? 1 : 0) - ok2[j]) * (1 - Math.exp(-dt * 7))
            hk2[j] += ((worksUI.hover === j && worksUI.open < 0 ? 1 : 0) - hk2[j]) * (1 - Math.exp(-dt * 10))
            const ok = smooth(ok2[j])
            const rc = slotRect(j, W, H)
            const cx = W / 2 + (rc.cx - W / 2) * (1 + ex * 1.3)
            const cy = H / 2 + (rc.cy - H / 2) * (1 + ex * 1.3)
            /* เปิด: กลางจอ กว้าง 92% สูง 88% */
            const tw = lerp(rc.w * (1 + hk2[j] * 0.06), W * 0.92, ok)
            const ty = lerp(rc.h, H * 0.88, ok)
            /* ช่อง 0 (ไทล์ที่ตัวละครจับ) อยู่หน้าสุด ไม่ให้ไทล์ใหญ่บัง */
            toLocal(lerp(cx, W / 2, ok), lerp(cy, H / 2, ok), (j === 0 ? 1.5 : 0) + hk2[j] * 0.6 + ok * 1.2, SLOT_P)
            const sc = (tw * upp) / CW
            SLOT_Q.copy(BQ).multiply(QZ.setFromAxisAngle(ZAX, (-lerp(rc.rot, 0, Math.max(ok, hk2[j] * 0.5)) * Math.PI) / 180))
            /* จุดกำเนิดเมชอยู่ที่สัน (ขอบซ้ายกลาง) → เลื่อนให้กลางไทล์อยู่ที่ช่อง */
            SLOT_P.sub(OFF.set(CW * 0.5 * sc, 0, 0).applyQuaternion(SLOT_Q))
            cm.position.lerp(SLOT_P, land)
            cm.quaternion.slerp(SLOT_Q, land)
            cm.scale.setScalar(lerp(cs, sc, land))
            u.uTh.value = lerp(th, 0, land)
            u.uCurl.value = lerp(curl, 0, land)
            u.uSize.value.set(CW, lerp(CH, (CW * ty) / tw, ok))
            u.uDim.value = 1 - 0.75 * Math.max(0, openAny - ok)
            u.uEdge.value = Math.min(1, (rc.w / tw) * 1.2)
          } else {
            u.uSize.value.set(CW, CH)
            u.uDim.value = 1
            u.uEdge.value = 1
          }
        })
        works.covers.forEach((m) => {
          m.uniforms.uOpacity.value = wkv
        })
        /*
         * ตัวอักษร My Works: ป้ายในวิดเจ็ต → บินไล่ทีละตัว (โค้งขึ้นนิด หันหน้าเข้ากล้อง) ไปลงจอดตรงคำพื้นหลัง DOM
         * อยู่หน้าวิดเจ็ตฟ้า หลังเล่มกระดาษ (renderOrder ระหว่างกัน ไม่เขียน depth) · ฟ้าจางหมดแล้วค่อยส่งต่อให้คำ DOM
         */
        const wg2 = worksRef.current
        if (wg2?.visible) {
          wg2.updateWorldMatrix(true, false)
          LM3.copy(wg2.matrixWorld).invert()
          wg2.matrixWorld.decompose(WP, WQ, WS)
          BQ.copy(WQ).invert().multiply(camera.quaternion)
          const ly = worksWordLayout
          const toLocal = (sx: number, sy: number, zL: number, out: THREE.Vector3) => {
            RO.copy(camera.position).applyMatrix4(LM3)
            RP.set((sx / W) * 2 - 1, -((sy / H) * 2 - 1), 0.5).unproject(camera).applyMatrix4(LM3)
            const t = (zL - RO.z) / (RP.z - RO.z)
            return out.copy(RO).lerp(RP, t)
          }
          const fl = clamp01((post - WORKS_FLY[0]) / WORKS_FLY[1])
          const hand = smooth(clamp01((post - WORKS_HAND[0]) / WORKS_HAND[1]))
          const show = smooth(clamp01((k - 0.08) / 0.25)) * (1 - hand)
          const n = works.letters.length
          const ok = ly.ok && ly.ox.length === n
          let fLocal = 0
          if (ok) {
            toLocal(ly.left, ly.cy, LETTER_Z, LA)
            toLocal(ly.left + 100, ly.cy, LETTER_Z, LB)
            fLocal = (LA.distanceTo(LB) / 100) * ly.font
          }
          works.letters.forEach((l, j) => {
            const lm = letterRefs.current[j]
            if (!lm) return
            l.mat.opacity = show
            lm.visible = show > 0.002
            const emX = ok ? ly.ox[j] / ly.font : works.em0[j]
            const st = LABEL0[2]
            /* ไล่ออกตัวทีละตัว (M ก่อน) · ease เข้า-ออก */
            const q = ok ? clamp01((fl - j * LETTER_STAG) / (1 - LETTER_STAG * (n - 1))) : 0
            const e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2
            LS2.set(LABEL0[0] + emX * st, LABEL0[1], 3)
            if (ok) toLocal(ly.left + ly.ox[j], ly.cy, LETTER_Z, LE2)
            else LE2.copy(LS2)
            lm.position.lerpVectors(LS2, LE2, e)
            lm.position.y += Math.sin(Math.PI * e) * lerp(st, fLocal, e) * 0.35
            lm.quaternion.identity().slerp(BQ, e)
            lm.scale.setScalar(Math.max(1e-3, lerp(st, ok ? fLocal : st, e)))
          })
        }
        gone = fade <= 0.001 && wk <= 0.002
      } else {
        /* กระจายออกนุ่มขึ้น ยาวขึ้น (ไม่วาบ) — ease-out กำลังสอง */
        const k = clamp01((b.code - CODE_HIT - (i - 1) * 0.02) / 0.34)
        const burst = 1 - Math.pow(1 - k, 2)
        const dir = BURST[i]
        px += dir[0] * burst * 560
        py += dir[1] * burst * 420
        pz += k * k * FLY_Z * 0.7
        rx += dir[2] * burst * 2.2
        ry += dir[3] * burst * 2.6
        rz = dir[4] * burst * 1.4
        gone = k >= 0.985
      }
      cg.visible = cg.visible && !gone
      cg.position.set(px, py, pz)
      cg.rotation.set(rx, ry, rz)
      cg.scale.setScalar(Math.max(1e-3, outBack(a, 1.4) * (1 - ex * 0.06) * (1 + hold * 0.03) * (1 - tap * (press * 0.04 - pop * 0.015)) * grow))
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
    <>
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
          {i < BADGE.length && (
            <group position={[pc.c.w / 2 - 26, pc.c.h / 2 - 26, pc.top + 14]}>
              <mesh geometry={badge.disc} material={badge.mats[i]} renderOrder={4} />
              <mesh geometry={badge.bar} material={badge.whites[i]} position={[0, 0, 6]} renderOrder={5} />
              <mesh geometry={badge.bar} material={badge.whites[i]} position={[0, 0, 6]} rotation={[0, 0, Math.PI / 2]} renderOrder={5} />
            </group>
          )}
          {i === 2 && <ResearchIsland frame={frame} top={pc.top} />}
          {i === 0 && (
            <group ref={worksRef} visible={false}>
              {works.covers.map((m, j) => (
                <mesh
                  key={j}
                  ref={(el) => {
                    coverRefs.current[j] = el
                  }}
                  geometry={works.geo}
                  material={m}
                  renderOrder={4}
                  frustumCulled={false}
                />
              ))}
              {works.letters.map((l, j) => (
                <mesh
                  key={`l${j}`}
                  ref={(el) => {
                    letterRefs.current[j] = el
                  }}
                  geometry={l.geo}
                  material={l.mat}
                  renderOrder={3.5}
                  frustumCulled={false}
                />
              ))}
            </group>
          )}
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
    {/* ตัวละครห้อยดึงไทล์ใน section My Works — พิกัดโลก (ไม่ผูกกับเครื่อง) */}
    <Suspense fallback={null}>
      <WorksHanger />
    </Suspense>
    </>
  )
}
