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

/** โค้ดบนจอ: ย่อหน้า · ท่อนต่อบรรทัด [ยาว, สี] — สีแบบไฮไลต์ไวยากรณ์ ไม่ใช่ข้อความจริง */
const SYN = ['#9b8af0', '#3cbcd6', '#f29a80', '#c4c7d2', '#ef7fb3'].map((c) => new THREE.Color(c))
const CODE: [number, [number, number][]][] = [
  [0, [[64, 0], [96, 1]]],
  [1, [[52, 2], [120, 3]]],
  [1, [[80, 4], [46, 3]]],
  [2, [[110, 1]]],
  [2, [[58, 0], [70, 2], [30, 3]]],
  [1, [[34, 3]]],
  [0, [[0, 0]]],
  [0, [[72, 0], [60, 4]]],
  [1, [[96, 1], [54, 3]]],
  [2, [[44, 2], [100, 3]]],
  [2, [[128, 1]]],
  [1, [[64, 4], [40, 0]]],
  [0, [[30, 3]]],
  [0, [[0, 0]]],
  [0, [[88, 0], [76, 2]]],
]
const CODE_TOTAL = CODE.reduce((n, [, segs]) => n + segs.reduce((m, [w]) => m + w, 0), 0)

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

/**
 * แคปซูลเรียบ ตัดด้วยสนามระยะ — สีต่อชิ้นเป็น attribute ของเราเอง ไม่ใช่ instanceColor: อันนั้น three สร้างตอน
 * setColorAt ครั้งแรก ถ้าอุ่นเชดเดอร์ไว้ก่อนมันมี (ด่านโหลด) โปรแกรมจะคอมไพล์ใหม่กลางเรื่อง
 */
function codeMat() {
  return new THREE.ShaderMaterial({
    transparent: true,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec2 aSize;
      attribute vec3 aColor;
      varying vec2 vP;
      varying vec2 vS;
      varying vec3 vC;
      void main() {
        vS = aSize;
        vP = position.xy * aSize;
        vC = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(vP, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vP;
      varying vec2 vS;
      varying vec3 vC;
      void main() {
        float r = vS.y * 0.5;
        vec2 q = abs(vP) - vec2(max(vS.x * 0.5 - r, 0.0), 0.0);
        float d = length(max(q, 0.0)) - r;
        float aa = max(fwidth(d), 1e-3);
        float a = 1.0 - smoothstep(-aa, aa, d);
        if (a < 0.003) discard;
        gl_FragColor = vec4(vC, a);
        #include <colorspace_fragment>
      }`,
  })
}

/** บทออกแบบ: กรอบเลือกจับใบกลาง → ใบบน → ใบล่าง · on = กรอบโผล่ · from → to = ใบที่กรอบไหลจากและไป */
export const PICK_SEQ = [1, 0, 2] as const
const PICK_AT = [0.36, 0.56, 0.74] as const
export function designPick(ds: number) {
  const on = smooth((ds - 0.36) / 0.08) * (1 - smooth((ds - 0.92) / 0.06))
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
        float glint = pow(max(sh, 0.0), 1.5) * 1.35 + pow(max(h, 0.0), 3.0) * amp * 0.35;
        float shade = max(-sh, 0.0) * 0.46;
        float a = (glint + shade) * inside;
        if (a < 0.003) discard;
        vec3 col = mix(vec3(1.0), vec3(0.12, 0.26, 0.6), shade / max(glint + shade, 1e-3));
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  })
}

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
const P = new THREE.Vector3()
const Q = new THREE.Quaternion()
const S = new THREE.Vector3(1, 1, 1)
const M = new THREE.Matrix4()
const BLUE = '#2f6bff'

export function BenchScreen({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const { size } = useThree()

  /** วิดเจ็ต: แผ่นละเรขาคณิตหนึ่งชุด วัสดุตามสี (แคชตามสี) */
  const { parts, mats } = useMemo(() => {
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
    return { parts: list, mats: cache }
  }, [])
  const sel = useMemo(() => {
    const edge = new THREE.BoxGeometry(1, 1, 1)
    const knobO = new THREE.BoxGeometry(16, 16, 2)
    const knobI = new THREE.BoxGeometry(10, 10, 2)
    const blue = new THREE.MeshBasicMaterial({ color: BLUE, toneMapped: false })
    const white = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
    return { edge, knobO, knobI, blue, white }
  }, [])
  const code = useMemo(() => {
    const segs: { x: number; y: number; w: number; c: number; at: number }[] = []
    let done = 0
    CODE.forEach(([ind, list], li) => {
      let x = -150 + ind * 24
      const y = 300 - li * 42
      list.forEach(([w, c]) => {
        if (w > 0) segs.push({ x: x + w / 2, y, w, c, at: done / CODE_TOTAL })
        x += w + 10
        done += w
      })
    })
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(segs.length * 2), 2))
    const col = new Float32Array(segs.length * 3)
    segs.forEach((sg, i) => SYN[sg.c].toArray(col, i * 3))
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3))
    return { segs, geo, mat: codeMat() }
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
      ;[sel.edge, sel.knobO, sel.knobI, code.geo, ripple.geo, live.geo].forEach((g) => g.dispose())
      ;[sel.blue, sel.white, code.mat, live.mat, ...ripple.mats].forEach((m) => m.dispose())
    },
    [parts, mats, sel, code, ripple, live],
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
  const root = useRef<THREE.Group>(null)
  const cardRefs = useRef<(THREE.Group | null)[]>([])
  const tileRefs = useRef<(THREE.Mesh | null)[][]>([])
  const frameG = useRef<THREE.Group>(null)
  const edges = useRef<(THREE.Mesh | null)[]>([])
  const knobs = useRef<(THREE.Group | null)[]>([])
  const codeRef = useRef<THREE.InstancedMesh>(null)
  const liveRef = useRef<THREE.Mesh>(null)
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

    /* ── ออกแบบ/โค้ด: วิดเจ็ต ── */
    const pick = designPick(b.design)
    const ex = smooth((b.code - 0.16) / 0.2) * (1 - smooth((b.code - 0.8) / 0.16))
    parts.forEach((pc, i) => {
      const cg = cardRefs.current[i]
      if (!cg) return
      const a = cardIn(b, i)
      cg.visible = a > 0
      if (!cg.visible) return
      const land = outCubic(a)
      const hold = pick.on * ((i === pick.to ? pick.move : 0) + (i === pick.from && pick.from !== pick.to ? 1 - pick.move : 0))
      cg.position.set(pc.c.x + (1 - land) * (i - 1) * 60, pc.c.y + (1 - land) * 140, 4 + (1 - land) * 320 + hold * 16 + ex * (110 + i * 90))
      cg.rotation.set((1 - land) * -0.6, (1 - land) * (i - 1) * 0.5, 0)
      cg.scale.setScalar(Math.max(1e-3, outBack(a, 1.4) * (1 - ex * 0.06) * (1 + hold * 0.03)))
      pc.tiles.forEach((pt, j) => {
        const tm = tileRefs.current[i]?.[j]
        if (!tm) return
        const bj = BLOCK_TO.findIndex(([ci, ti]) => ci === i && ti === j)
        if (bj >= 0) {
          /* บล็อกจากแท่งแก้วบินมาเป็นกระเบื้องนี้: โค้งขึ้นหาคนดู หมุนนิด ขยายจากขนาดบล็อกเป็นขนาดกระเบื้อง */
          const f = smooth(blockFlight(b.sv2, bj))
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

    /* โค้ดพิมพ์บนพื้นจอ (ใต้วิดเจ็ตที่ยกลอย) */
    const cm = codeRef.current
    if (cm) {
      const tp = clamp01((b.code - 0.26) / 0.46)
      cm.visible = ex > 0.02 && tp > 0
      if (cm.visible) {
        const sz = code.geo.attributes.aSize as THREE.InstancedBufferAttribute
        let n = 0
        for (const sg of code.segs) {
          const w = clamp01((tp - sg.at) * (CODE_TOTAL / Math.max(1, sg.w)) * 0.9) * sg.w
          if (w <= 0.5) break
          P.set(sg.x - sg.w / 2 + w / 2, sg.y, 1)
          M.compose(P, Q, S)
          cm.setMatrixAt(n, M)
          sz.setXY(n, w, 14)
          n += 1
        }
        cm.count = n
        cm.instanceMatrix.needsUpdate = true
        sz.needsUpdate = true
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
      <instancedMesh ref={codeRef} args={[code.geo, code.mat, code.segs.length]} frustumCulled={false} visible={false} />
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
