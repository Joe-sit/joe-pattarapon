import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import penNibSvg from '@/assets/icons/pen-nib.svg?raw'
import { SKILLS } from '@/sections/whatido/WhatIDo'
import { ABOUT_STORY, CHAT_ITEM, DIAGRAM_MORPH, aboutBox, aboutLens, aboutQuad } from './aboutBox'

/**
 * About me แบบ 3D (ภาพอ้างอิง: ตัวกลาง วิดเจ็ต UI หนา ๆ ลอยล้อมรอบหลายระดับลึก)
 *
 * เลื่อนลง (ช่วง xray) วิดเจ็ตเด้งออกมาทีละชิ้นที่ระยะลึกต่างกัน พร้อมกล้องค่อย ๆ ถอยหลังและวนข้างนิดหนึ่ง
 * — ของที่อยู่ใกล้/ไกลเลื่อนคนละจังหวะ (parallax) เห็นเป็นมิติจริง · ช่วงไล่ทีละหน้า การ์ดสกิลนั้นลอยเข้าหากล้อง
 * · ตอนจบทุกชิ้นหดกลับ กล้องกลับที่เดิม
 *
 * หน่วยของกลุ่มนี้ = ความสูงกรอบ (สเกลกลุ่มด้วย H) กลางกรอบ = 0 · กล้องที่ระยะ D เห็นระนาบ z 0 หนึ่งหน่วยต่อพิกเซล
 * (ตัวละครกับพาเนลจัดด้วยพิกัดพิกเซลแบบเดิมได้ ตอนกล้องยังไม่ขยับ ภาพเท่าแคนวาสออร์โธเดิมเป๊ะ)
 */

export const FOV = 30

const FONT = '/fonts/momo-trust-sans.json'
const SKILL_OF = { 'UX/UI': 'Design', Coding: 'Coding', Research: 'Research' } as const
const CARDS = (['UX/UI', 'Coding', 'Research'] as const).map((name) => {
  const s = SKILLS.find((k) => k.title === SKILL_OF[name])
  return { name, color: s?.color ?? '#ffffff', desc: s && s.title !== 'Research' ? s.desc : '' }
})
/** ที่อยู่ของการ์ด (หน่วย H) + จังหวะโผล่ในช่วง xray */
/**
 * ทุกชิ้นอยู่ในลำแสงจากกล้องสองตา (BEAM) — มองเห็นเฉพาะในลำ (stencil) แบบภาพอ้างอิงคนส่องกล้อง
 * p = [มุมในลำ (องศาเหนือแนวนอน), ระยะจากปลายเลนส์ (หน่วย H), ลึก] — วางตามปลายเลนส์ทุกเฟรม จึงอยู่ในลำเสมอ
 * at = จังหวะโผล่ในช่วง xray
 */
const CARD_AT = [
  { p: [24, 0.66, 0.06], r: [0.06, -0.22, -0.03], at: 0.42 },
  { p: [29, 1.12, -0.08], r: [0.08, -0.28, 0.04], at: 0.56 },
  { p: [15, 1.0, 0.1], r: [-0.04, -0.34, -0.03], at: 0.7 },
] as const
type DecoKind = 'check' | 'ball' | 'mail' | 'star' | 'plus' | 'pill' | 'chip' | 'cube' | 'discs' | 'octa' | 'cloud' | 'dots' | 'orb'
const DECOS: { kind: DecoKind; p: readonly [number, number, number]; s: number; at: number }[] = [
  { kind: 'octa', p: [14, 0.28, 0.12], s: 0.045, at: 0.34 },
  { kind: 'star', p: [38, 0.62, -0.18], s: 0.08, at: 0.4 },
  { kind: 'discs', p: [36, 0.72, -0.3], s: 0.1, at: 0.48 },
  { kind: 'orb', p: [37, 0.95, -0.22], s: 0.04, at: 0.52 },
  { kind: 'dots', p: [24, 1.35, -0.25], s: 0.08, at: 0.62 },
  { kind: 'cloud', p: [33, 1.5, -0.35], s: 0.1, at: 0.66 },
  { kind: 'mail', p: [8, 1.2, 0.06], s: 0.07, at: 0.76 },
  { kind: 'check', p: [15, 1.6, -0.1], s: 0.06, at: 0.8 },
]
/** ลำแสง: ปลายที่กล้องสองตา (หน่วยสัดส่วนกรอบ) · มุมขอบล่าง/บน (องศาเหนือแนวนอน) · ความลึกที่วาง */
const BEAM = { ax: 0.215, ay: 0.57, a0: 3, a1: 46, z: -0.45 }

const CARD_W = 0.38
const CARD_H = 0.22
const CARD_D = 0.035

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}
const outBack = (x: number) => {
  const u = clamp01(x) - 1
  return 1 + 2.6 * u * u * u + 1.6 * u * u
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** ตัดคำอธิบายเป็นบรรทัดตามจำนวนตัวอักษร (TextGeometry ไม่ตัดบรรทัดเอง) */
function wrap(text: string, max: number) {
  const out: string[] = []
  let line = ''
  for (const w of text.split(' ')) {
    if (line && (line + ' ' + w).length > max) {
      out.push(line)
      line = w
    } else line = line ? `${line} ${w}` : w
  }
  if (line) out.push(line)
  return out
}

function textGeo(font: Font, s: string, size: number, depth: number) {
  const g = new TextGeometry(s, { font, size, depth, curveSegments: 5, bevelEnabled: false })
  g.computeBoundingBox()
  return g
}

/**
 * การ์ดฟ้าหลังตัวละครตอนโบกทัก (ภาพอ้างอิงนักบินอวกาศ): กรอบมนไล่ฟ้าอ่อน ขอบบนอยู่ต่ำกว่าหัว
 * หัวกับมือที่โบกจึงทะลุพ้นขอบการ์ดขึ้นไป · หน่วยสัดส่วนกรอบ (กลาง x, ขอบบน y, กว้าง) — ขอบล่างเลยกรอบลงไป
 */
const CARD_BG = { x: 0.5, top: 0.3, w: 0.56, r: 0.06, z: -0.35 }
function cardGeo(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2 + r, -h / 2)
  s.lineTo(w / 2 - r, -h / 2)
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  s.lineTo(w / 2, h / 2 - r)
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  s.lineTo(-w / 2 + r, h / 2)
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  s.lineTo(-w / 2, -h / 2 + r)
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  const g = new THREE.ShapeGeometry(s, 10)
  /* uv แนวตั้ง 0 (ล่าง) → 1 (บน) ให้ไล่สี */
  const pos = g.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i += 1) {
    uv[i * 2] = pos.getX(i) / w + 0.5
    uv[i * 2 + 1] = pos.getY(i) / h + 0.5
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}
function cardMat() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uA: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uA; varying vec2 vUv;
      void main(){
        /* ค่าเชิงเส้น: ฟ้าใสด้านบน → ขาวอมฟ้าด้านล่าง (แบบภาพอ้างอิง) + ขอบขาวบาง ๆ */
        vec3 top = vec3(0.42, 0.66, 0.98);
        vec3 bot = vec3(0.86, 0.92, 1.0);
        vec3 c = mix(bot, top, smoothstep(0.0, 1.0, vUv.y));
        gl_FragColor = vec4(c, uA);
        #include <colorspace_fragment>
      }`,
  })
}

/**
 * หน้าต่างบิด (ABOUT_STORY 'window') — ภาพอ้างอิง: กรอบสี่เหลี่ยมโดน free transform มีจุดจับแดงที่มุม ป้ายชื่อข้างจุดจับ
 * การ์ดฟ้าใบเดิมถูกดึงมุมจากสี่เหลี่ยมมนเป็นสี่เหลี่ยมบิด (เชดเดอร์ระยะถึงรูปหลายเหลี่ยม ไม่สลับเมช) แล้วเขียน stencil
 * ให้ของประจำสกิลเห็นเฉพาะในหน้าต่าง · มุม TL TR BR = Design Coding Research (BL ไม่มีป้าย — มีสกิลจริงสามอัน)
 * พิกัดพิกเซลนับจากกลางกรอบ แกน y ชี้ขึ้น · สัดส่วน x ของความกว้าง y ของความสูง
 */
const QUAD = [
  [-0.3, 0.17],
  [0.3, 0.07],
  [0.25, -0.38],
  [-0.2, -0.33],
] as const
/** ของในหน้าต่างต่อสกิล: การ์ดสกิล + ชิ้นตกแต่งสองชิ้น (ชนิดใน DECOS) — ตำแหน่ง [x กว้าง, y สูง] */
const SCENE = [
  { card: [0.2, -0.05], decos: [['octa', -0.2, 0.0], ['star', -0.15, -0.22]] },
  { card: [-0.2, -0.05], decos: [['dots', 0.19, 0.02], ['check', 0.16, -0.22]] },
  { card: [0.2, -0.05], decos: [['orb', -0.2, 0.05], ['cloud', -0.16, -0.2]] },
] as const
function winMat() {
  return new THREE.ShaderMaterial({
    /* ทึบ (ไม่ใช่ transparent) — ต้องวาดในรอบทึบก่อนของในหน้าต่าง ไม่งั้น stencil ยังไม่ถูกเขียนตอนของพวกนั้นวาด */
    depthWrite: false,
    uniforms: {
      uSize: { value: new THREE.Vector2(1, 1) },
      uC: { value: [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()] },
      uR: { value: 0 },
      uRim: { value: 10 },
      uH: { value: 800 },
    },
    vertexShader: `uniform vec2 uSize; varying vec2 vP; void main(){ vP = position.xy * uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec2 uC[4]; uniform float uR; uniform float uRim; uniform float uH;
      varying vec2 vP;
      /* ระยะถึงรูปหลายเหลี่ยม (iq) — ลบ = ข้างใน */
      float sdPoly(vec2 p, vec2 v[4]) {
        float d = dot(p - v[0], p - v[0]);
        float s = 1.0;
        for (int i = 0, j = 3; i < 4; j = i, i++) {
          vec2 e = v[j] - v[i];
          vec2 w = p - v[i];
          vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
          d = min(d, dot(b, b));
          bvec3 c = bvec3(p.y >= v[i].y, p.y < v[j].y, e.x * w.y > e.y * w.x);
          if (all(c) || all(not(c))) s *= -1.0;
        }
        return s * sqrt(d);
      }
      void main(){
        /* มุมมน: หดรูปเข้าหาจุดกลางเท่ารัศมี แล้วพองกลับด้วยระยะ */
        vec2 m = (uC[0] + uC[1] + uC[2] + uC[3]) * 0.25;
        vec2 v[4];
        for (int i = 0; i < 4; i++) v[i] = uC[i] + normalize(m - uC[i]) * uR * 1.41;
        float d = sdPoly(vP, v) - uR;
        float aa = max(fwidth(d), 0.5);
        float a = clamp(0.5 - d / aa, 0.0, 1.0);
        if (a < 0.5) discard;
        vec3 top = vec3(0.42, 0.66, 0.98);
        vec3 bot = vec3(0.86, 0.92, 1.0);
        vec3 c = mix(bot, top, smoothstep(-0.5 * uH, 0.3 * uH, vP.y));
        c = mix(c, vec3(1.0), smoothstep(-uRim - aa, -uRim + aa, d));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  })
}

const TARGET = new THREE.Vector3()
const LP = new THREE.Vector3()

/** ลำแสง: พัดจากปลาย (uv.x = ระยะ 0..1, uv.y = มุม 0..1) ไล่สีน้ำเงินลึก ขอบล่างอุ่น — เขียน stencil 1 */
function beamGeo() {
  const N = 48
  const R = 3
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  pos.push(0, 0, 0)
  uv.push(0, 0.5)
  for (let i = 0; i <= N; i += 1) {
    const v = i / N
    const a = ((BEAM.a0 + (BEAM.a1 - BEAM.a0) * v) * Math.PI) / 180
    pos.push(Math.cos(a) * R, Math.sin(a) * R, 0)
    uv.push(1, v)
    if (i) idx.push(0, i, i + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}
function beamMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uOpen: { value: 0 }, uReach: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec2 vP; void main(){ vUv = uv; vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uOpen; uniform float uReach;
      varying vec2 vP;
      void main(){
        float r = length(vP) / 3.0;
        float a = degrees(atan(vP.y, vP.x));
        float v = (a - ${BEAM.a0.toFixed(1)}) / ${(BEAM.a1 - BEAM.a0).toFixed(1)};
        if (v > uOpen || r > uReach) discard;
        /* ค่าเชิงเส้น (colorspace_fragment แปลงเป็น sRGB ทีหลัง) — น้ำเงินลึกแบบภาพอ้างอิง */
        vec3 deep = vec3(0.012, 0.02, 0.12);
        vec3 blue = vec3(0.05, 0.14, 0.75);
        vec3 warm = vec3(0.95, 0.45, 0.3);
        vec3 c = mix(blue, deep, clamp(v * 0.8 + r * 0.5, 0.0, 1.0));
        c = mix(c, warm, smoothstep(0.08, 0.0, v) * 0.7);
        c = mix(c, warm, smoothstep(0.1, 0.0, uOpen - v) * 0.35);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    depthWrite: false,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  })
}

export function AboutWidgets() {
  const font = useLoader(FontLoader, FONT)
  const { camera, size } = useThree()
  const group = useRef<THREE.Group>(null)
  const cards = useRef<(THREE.Group | null)[]>([])
  const decos = useRef<(THREE.Group | null)[]>([])

  const mats = useMemo(
    () => ({
      card: new THREE.MeshPhysicalMaterial({ color: '#ffffff', emissive: '#e6edff', emissiveIntensity: 0.45, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.18 }),
      title: new THREE.MeshStandardMaterial({ color: '#17203d', roughness: 0.5 }),
      desc: new THREE.MeshStandardMaterial({ color: '#56607e', roughness: 0.6 }),
      white: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 }),
      skill: CARDS.map((c) => new THREE.MeshPhysicalMaterial({ color: c.color, roughness: 0.25, clearcoat: 1, emissive: c.color, emissiveIntensity: 0.12 })),
      green: new THREE.MeshPhysicalMaterial({ color: '#33d17a', roughness: 0.22, clearcoat: 1 }),
      lime: new THREE.MeshPhysicalMaterial({ color: '#8fe35b', roughness: 0.18, clearcoat: 1 }),
      teal: new THREE.MeshPhysicalMaterial({ color: '#21c08b', roughness: 0.25, clearcoat: 1 }),
      violet: new THREE.MeshPhysicalMaterial({ color: '#b48cff', roughness: 0.2, clearcoat: 1, emissive: '#7a4dff', emissiveIntensity: 0.25 }),
      pink: new THREE.MeshPhysicalMaterial({ color: '#f26aa9', roughness: 0.25, clearcoat: 1 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0.55 }),
      coral: new THREE.MeshPhysicalMaterial({ color: '#f07a52', roughness: 0.35, clearcoat: 0.6, emissive: '#e8603a', emissiveIntensity: 0.18 }),
      peach: new THREE.MeshPhysicalMaterial({ color: '#f6b48e', roughness: 0.35, clearcoat: 0.6 }),
      sky: new THREE.MeshPhysicalMaterial({ color: '#4a86ff', roughness: 0.3, clearcoat: 0.8, emissive: '#2a5cff', emissiveIntensity: 0.2 }),
    }),
    [],
  )
  /* วิดเจ็ตทุกชิ้นเห็นเฉพาะในลำแสง (stencil = 1 ที่ลำเขียนไว้) — ตัวละครไม่ทดสอบ อยู่นอกลำได้ */
  useMemo(() => {
    Object.values(mats)
      .flat()
      .forEach((m) => {
        m.stencilWrite = true
        m.stencilRef = 1
        m.stencilFunc = THREE.EqualStencilFunc
        m.stencilFail = THREE.KeepStencilOp
        m.stencilZFail = THREE.KeepStencilOp
        m.stencilZPass = THREE.KeepStencilOp
      })
  }, [mats])
  const beam = useMemo(() => ({ geo: beamGeo(), mat: beamMat() }), [])
  useEffect(
    () => () => {
      beam.geo.dispose()
      beam.mat.dispose()
    },
    [beam],
  )
  const beamMesh = useRef<THREE.Mesh>(null)
  /** การ์ดหลังตัวละคร — ปั้นตามขนาดกรอบ (สูงพอให้ขอบล่างเลยกรอบ) */
  const bgMesh = useRef<THREE.Mesh>(null)
  const bgMat = useMemo(cardMat, [])
  /* ขอบขาวหนารอบการ์ด (ภาพอ้างอิง) — การ์ดใบเดียวกันขยายนิดหนึ่ง วาดหลัง */
  const rimMesh = useRef<THREE.Mesh>(null)
  const rimMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, depthWrite: false }), [])
  useEffect(() => () => rimMat.dispose(), [rimMat])
  const bgGeo = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height)
    return cardGeo(CARD_BG.w * aspect, 1.2, CARD_BG.r)
  }, [size.width, size.height])
  useEffect(() => () => bgMat.dispose(), [bgMat])
  const winMesh = useRef<THREE.Mesh>(null)
  const win = useMemo(() => ({ geo: new THREE.PlaneGeometry(1, 1), mat: winMat() }), [])
  useEffect(
    () => () => {
      win.geo.dispose()
      win.mat.dispose()
    },
    [win],
  )
  useEffect(() => () => bgGeo.dispose(), [bgGeo])
  const geos = useMemo(() => {
    /* ไอคอน: ปากกา (SVG เดียวกับวงกลมของฟอง) · วงเล็บโค้ด · แว่นขยาย — หน่วยไอคอนสูงราว 1 */
    const data = new SVGLoader().parse(penNibSvg)
    const pen = new THREE.ExtrudeGeometry(
      data.paths.flatMap((p) => SVGLoader.createShapes(p)),
      { depth: 3, bevelEnabled: false, curveSegments: 6 },
    )
    pen.translate(-16, -16, 0)
    pen.scale(1 / 32, -1 / 32, 1 / 32)
    const code = textGeo(font, '</>', 1, 0.15)
    const cb = code.boundingBox as THREE.Box3
    code.translate(-(cb.min.x + cb.max.x) / 2, -(cb.min.y + cb.max.y) / 2, 0)
    code.scale(0.62, 0.62, 1)
    const ring = new THREE.TorusGeometry(0.28, 0.07, 12, 32)
    ring.translate(-0.08, 0.08, 0)
    const handle = new THREE.CylinderGeometry(0.07, 0.07, 0.4, 12)
    handle.rotateZ(Math.PI / 4)
    handle.translate(0.24, -0.24, 0)
    /* ข้อความบนการ์ด — ปั้นครั้งเดียว */
    const titles = CARDS.map((c) => textGeo(font, c.name, 0.034, 0.004))
    const descs = CARDS.map((c) => (c.desc ? wrap(c.desc, 27).map((l) => textGeo(font, l, 0.018, 0.002)) : []))
    /* ชิ้นตกแต่ง */
    const star = (() => {
      const s = new THREE.Shape()
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 2
        const r = i % 2 ? 0.32 : 1
        if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        else s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 3 })
      g.translate(0, 0, -0.17)
      return g
    })()
    const check = (() => {
      const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.28, 0.02, 0), new THREE.Vector3(-0.08, -0.2, 0), new THREE.Vector3(0.3, 0.22, 0)], false, 'catmullrom', 0)
      return new THREE.TubeGeometry(path, 24, 0.07, 10, false)
    })()
    const mailV = (() => {
      const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.38, 0.22, 0), new THREE.Vector3(0, -0.04, 0), new THREE.Vector3(0.38, 0.22, 0)], false, 'catmullrom', 0)
      return new THREE.TubeGeometry(path, 16, 0.045, 8, false)
    })()
    const sphere = new THREE.SphereGeometry(1, 32, 20)
    const disc = new THREE.CylinderGeometry(1, 1, 0.38, 40)
    const octa = new THREE.OctahedronGeometry(1, 0)
    return { pen, code, ring, handle, titles, descs, star, check, mailV, sphere, disc, octa }
  }, [font])
  useEffect(
    () => () => {
      const g = geos
      ;[g.pen, g.code, g.ring, g.handle, g.star, g.check, g.mailV, g.sphere, g.disc, g.octa, ...g.titles, ...g.descs.flat()].forEach((x) => x.dispose())
      Object.values(mats)
        .flat()
        .forEach((m) => m.dispose())
    },
    [geos, mats],
  )

  /**
   * เรื่อง 'window': การ์ดฟ้า (โผล่ตอนโบก) → ถูกดึงมุมเป็นหน้าต่างบิด (ช่วง xray) → ข้างในเล่าทีละสกิล (page)
   * มุมของสกิลที่กำลังเล่าถูกดึงออกนิดหนึ่งเหมือนลากจุดจับ · ตอนจบคืนเป็นการ์ด
   */
  const driveWindow = (W: number, H: number, dist: number, t: number) => {
    const b = aboutBox
    const back = smooth(b.back * 1.4)
    const bg = bgMesh.current
    if (bg) bg.visible = false
    if (rimMesh.current) rimMesh.current.visible = false
    if (beamMesh.current) beamMesh.current.visible = false
    win.mat.colorWrite = true
    const wm = winMesh.current
    const rise = outBack(clamp01((b.k - 0.25) / 0.6))
    const m = smooth(clamp01((b.xray - 0.05) / 0.5)) * (1 - back)
    const after = smooth(clamp01((b.xray - 0.55) / 0.3)) * (1 - back)
    const pageF = b.page
    const wp = [0, 1, 2].map((i) => clamp01(1 - Math.abs(pageF - i) * 1.6) * after)
    /* การ์ดตอนเป็นสี่เหลี่ยม (กลาง x, ขอบบน, กว้าง) — ขอบล่างเลยกรอบลงไป */
    const hw = (CARD_BG.w * W) / 2
    const cx0 = (CARD_BG.x - 0.5) * W
    const top = H / 2 - CARD_BG.top * H
    const drop = (1 - rise) * 0.9 * H
    const rect = [
      [cx0 - hw, top],
      [cx0 + hw, top],
      [cx0 + hw, top - 1.2 * H],
      [cx0 - hw, top - 1.2 * H],
    ]
    const qx = QUAD.map((q) => q[0] * W)
    const qy = QUAD.map((q) => q[1] * H)
    const mx = (qx[0] + qx[1] + qx[2] + qx[3]) / 4
    const my = (qy[0] + qy[1] + qy[2] + qy[3]) / 4
    const u = win.mat.uniforms
    for (let i = 0; i < 4; i += 1) {
      /* มุมของสกิลที่กำลังเล่าถูกลากออกจากกลางหน้าต่าง */
      const pull = i < 3 ? wp[i] : 0
      const dx = qx[i] - mx
      const dy = qy[i] - my
      const dl = Math.hypot(dx, dy) || 1
      const x = lerp(rect[i][0], qx[i] + (dx / dl) * 0.035 * W * pull, m)
      const y = lerp(rect[i][1], qy[i] + (dy / dl) * 0.035 * W * pull, m) - drop
      ;(u.uC.value[i] as THREE.Vector2).set(x, y)
      aboutQuad.c[i * 2] = W / 2 + x
      aboutQuad.c[i * 2 + 1] = H / 2 - y
      aboutQuad.pull[i] = pull
    }
    aboutQuad.m = m
    u.uR.value = lerp(0.06 * H, 2, m)
    u.uRim.value = 0.014 * H
    u.uH.value = H
    if (wm) {
      /* ระนาบหลังตัวละคร — ขยายชดเชยระยะ ให้พิกเซลของเชดเดอร์ตรงพิกเซลบนจอ */
      const kz = (dist - CARD_BG.z * H) / dist
      wm.position.set(0, 0, CARD_BG.z * H)
      wm.scale.set(W * 1.4 * kz, H * 2 * kz, 1)
      u.uSize.value.set(W * 1.4, H * 2)
      wm.visible = b.k > 0.25
    }

    /* ของประจำสกิลในหน้าต่าง — โผล่เมื่อหน้าของสกิลนั้นเปิด (เด้ง) หดหายเมื่อเลื่อนไปหน้าอื่น */
    const g = group.current
    if (!g) return
    g.scale.setScalar(H)
    g.visible = after > 0
    const asp = W / H
    CARDS.forEach((_, i) => {
      const o = cards.current[i]
      if (!o) return
      const k = outBack(wp[i])
      const [fx, fy] = SCENE[i].card
      o.position.set(fx * asp, fy + Math.sin(t * 1.1 + i * 2) * 0.008, 0.1)
      o.rotation.set(0.05 * k, (fx > 0 ? -0.28 : 0.28) * k + (1 - k) * 1.2, 0)
      o.scale.setScalar(Math.max(1e-3, k * 0.8))
      o.visible = wp[i] > 0.001
    })
    DECOS.forEach((d, j) => {
      const o = decos.current[j]
      if (!o) return
      let w = 0
      let fx = 0
      let fy = 0
      let found = false
      for (let i = 0; i < SCENE.length; i += 1) {
        const hit = SCENE[i].decos.find((x) => x[0] === d.kind)
        if (hit && (!found || wp[i] > w)) {
          w = wp[i]
          fx = hit[1]
          fy = hit[2]
          found = true
        }
      }
      if (!found) {
        o.visible = false
        return
      }
      const k = outBack(w)
      /* หลังตัวละคร หน้าหน้าต่าง */
      o.position.set(fx * asp, fy + Math.sin(t * 1.4 + j * 1.3) * 0.012, -0.18)
      o.rotation.set(Math.sin(t * 0.8 + j) * 0.25, t * 0.5 * (j % 2 ? 1 : -1) + (1 - k) * 2, 0)
      o.scale.setScalar(Math.max(1e-3, k * d.s))
      o.visible = w > 0.001
    })
  }

  /**
   * เรื่องโผล่จากฟองแชท: ตัวหน้าต่างคือฟองแก้วใน BubbleTraveler (หลอมจากฟองเอง) — ที่นี่วาดแค่ stencil ของหน้าต่าง
   * (มุมจาก aboutBox.qc) ให้ของประจำสกิลเห็นเฉพาะในหน้าต่าง · ของในหน้าต่างเปลี่ยนตามหน้า เหมือน driveWindow
   */
  const driveChat = (W: number, H: number, dist: number, t: number) => {
    const b = aboutBox
    /* เรื่องกล่องแก้ว (AboutCube) ไม่มีหน้าต่างแผนผัง — ซ่อนทั้งชุด */
    if (CHAT_ITEM === 'cube' || !DIAGRAM_MORPH) {
      if (group.current) group.current.visible = false
      if (winMesh.current) winMesh.current.visible = false
      if (bgMesh.current) bgMesh.current.visible = false
      if (rimMesh.current) rimMesh.current.visible = false
      if (beamMesh.current) beamMesh.current.visible = false
      aboutQuad.m = 0
      return
    }
    if (bgMesh.current) bgMesh.current.visible = false
    if (rimMesh.current) rimMesh.current.visible = false
    if (beamMesh.current) beamMesh.current.visible = false
    const after = smooth(clamp01((b.quad - 0.6) / 0.4))
    const wp = [0, 1, 2].map((i) => clamp01(1 - Math.abs(b.page - i) * 1.6) * after)
    const u = win.mat.uniforms
    for (let i = 0; i < 4; i += 1) {
      ;(u.uC.value[i] as THREE.Vector2).set(b.qc[i * 2] - W / 2, H / 2 - b.qc[i * 2 + 1])
      aboutQuad.c[i * 2] = b.qc[i * 2]
      aboutQuad.c[i * 2 + 1] = b.qc[i * 2 + 1]
      aboutQuad.pull[i] = i < 3 ? wp[i] : 0
    }
    aboutQuad.m = b.quad
    u.uR.value = lerp(0.06 * H, 2, b.quad)
    win.mat.colorWrite = false
    const wm = winMesh.current
    if (wm) {
      const kz = (dist - CARD_BG.z * H) / dist
      wm.position.set(0, 0, CARD_BG.z * H)
      wm.scale.set(W * 1.4 * kz, H * 2 * kz, 1)
      u.uSize.value.set(W * 1.4, H * 2)
      wm.visible = after > 0
    }
    /* ของในหน้าต่างอิงกลางหน้าต่าง (ต่ำกว่ากลางจอ) */
    const qy = (b.qc[1] + b.qc[3] + b.qc[5] + b.qc[7]) / 4
    panScene(W, H, t, b.page, after, (H / 2 - qy) / H + 0.04)
  }

  /**
   * ของประจำสกิลแบบแพนกล้อง (เรื่องแชท): ฉากของทุกสกิลวางเรียงกันในแนวนอน เลื่อนผ่านหน้าต่างตามหน้า
   * (หน้าต่างตัดขอบด้วย stencil) — ไม่เด้งโผล่/หายทีละชิ้น ของลึกเลื่อนช้ากว่า (parallax)
   * เข้าครั้งแรก: ฉากแรกเลื่อนเข้ามาจากขวาตอนหน้าต่างก่อตัวเสร็จ
   */
  const panScene = (W: number, H: number, t: number, pageF: number, after: number, oy: number) => {
    const g = group.current
    if (!g) return
    g.scale.setScalar(H)
    g.visible = after > 0
    const asp = W / H
    const SPAN = 0.62 * asp
    const at = pageF - (1 - after) * 0.9
    CARDS.forEach((_, i) => {
      const o = cards.current[i]
      if (!o) return
      const [fx, fy] = SCENE[i].card
      const off = (i - at) * SPAN
      /* หลังตัวละคร — ระหว่างแพนการ์ดเลื่อนผ่านหลังตัว ไม่บังตัว */
      o.position.set(Math.sign(fx) * 0.21 * asp + off, oy + fy + Math.sin(t * 1.1 + i * 2) * 0.008, -0.12)
      o.rotation.set(0.05, (fx > 0 ? -0.24 : 0.24) - off * 0.25, 0)
      o.scale.setScalar(0.66)
      o.visible = Math.abs(i - at) < 1.3
    })
    DECOS.forEach((d, j) => {
      const o = decos.current[j]
      if (!o) return
      let i = -1
      let fx = 0
      let fy = 0
      for (let q = 0; q < SCENE.length; q += 1) {
        const hit = SCENE[q].decos.find((x) => x[0] === d.kind)
        if (hit) {
          i = q
          fx = hit[1]
          fy = hit[2]
        }
      }
      if (i < 0) {
        o.visible = false
        return
      }
      /* ชิ้นลึกกว่า (หลังตัวละคร) เลื่อนช้ากว่าการ์ด */
      const off = (i - at) * SPAN * 0.75
      o.position.set(fx * asp * 0.9 + off, oy + fy + Math.sin(t * 1.4 + j * 1.3) * 0.012, -0.18)
      o.rotation.set(Math.sin(t * 0.8 + j) * 0.25, t * 0.5 * (j % 2 ? 1 : -1), 0)
      o.scale.setScalar(d.s)
      o.visible = Math.abs(i - at) < 1.5
    })
  }

  useFrame(({ clock }) => {
    const b = aboutBox
    const W = size.width
    const H = size.height
    const t = clock.elapsedTime
    const cam = camera as THREE.PerspectiveCamera
    const back = smooth(b.back * 1.4)
    const show = smooth(b.xray) * (1 - back)

    /**
     * กล้อง: ระยะ D = เห็นระนาบ z 0 หนึ่งหน่วยต่อพิกเซล (ภาพเหมือนออร์โธเดิม) → ถอยออก 1.55 เท่า วนข้าง/ก้มนิด
     * มองกลางกรอบตลอด — ของที่ลอยหน้า/หลังตัวละครเลื่อนคนละจังหวะ
     */
    const D = H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180)
    /* ถอยออกนิดเดียว ไม่วนข้าง — ปลายลำแสงต้องตรงกล้องสองตาของตัวละคร (ระนาบต่างกัน วนแล้วหลุด) */
    const binoc = ABOUT_STORY === 'binoc'
    const dist = D * lerp(1, 1.1, binoc ? show : 0)
    const yaw = Math.sin(t * 0.35) * 0.012 * show
    const pitch = 0
    cam.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist)
    cam.lookAt(TARGET.set(0, 0, 0))
    if (cam.near !== D * 0.05) {
      cam.near = D * 0.05
      cam.far = D * 6
      cam.updateProjectionMatrix()
    }

    /*
     * การ์ดหลังตัวละคร: ดันตัวขึ้นจากล่างแบบเด้งตอนตัวละครโผล่ (k) · พอตัวละครหันไปส่องกล้อง (xray) การ์ดทรุดลงพ้นกรอบ
     * ระนาบลึกกว่า z 0 — ขยายชดเชยระยะให้ขนาดบนจอตรงสัดส่วนกรอบ
     */
    const bg = bgMesh.current
    if (b.chat) {
      driveChat(W, H, dist, t)
      return
    }
    if (!binoc) {
      driveWindow(W, H, dist, t)
      return
    }
    if (bg) {
      const rise = outBack(clamp01((b.k - 0.25) / 0.6))
      const sink = smooth(clamp01(b.xray / 0.28)) * (1 - back)
      const kz = (dist - CARD_BG.z * H) / dist
      const aspect = W / H
      const cx = (CARD_BG.x - 0.5) * aspect
      /* การ์ดสูง 1.2 หน่วย: ขอบบนที่ top ของกรอบ */
      const cy = 0.5 - CARD_BG.top - 0.6 - (1 - rise) * 0.9 - sink * 1.3
      bg.position.set(cx * kz * H, cy * kz * H, CARD_BG.z * H)
      bg.scale.setScalar(kz * H)
      bg.visible = b.k > 0.25 && sink < 0.999
      const rim = rimMesh.current
      if (rim) {
        const pad = 0.014 * H * kz
        rim.position.set(bg.position.x, bg.position.y + pad * 0.6, bg.position.z - 1)
        rim.scale.set(bg.scale.x + (pad * 2) / (CARD_BG.w * aspect), bg.scale.y + pad / 0.6, 1)
        rim.visible = bg.visible
      }
    }
    const g = group.current
    if (!g) return
    g.scale.setScalar(H)
    g.visible = show > 0.001 || b.xray > 0
    void W
    const page = Math.round(b.page)
    const paging = b.stack > 0.5 && b.back < 0.3
    const pop = (at: number) => clamp01((b.xray - at) / 0.2) * (1 - back)
    /* ลำแสงจากกล้องสองตา: พุ่งยาวออกไปก่อน แล้วกางเปิดขึ้น · ตอนจบหุบกลับ */
    /*
     * ปลายลำแสง = ปลายเลนส์กล้องสองตาบนจอ: ยิงเส้นจากกล้องผ่านปลายเลนส์ไปตัดระนาบของลำ (ลึกหลังตัวละคร)
     * ไม่มีเลนส์ (ยังโหลด) ใช้จุดสำรองตามสัดส่วนกรอบ
     */
    let ax = (BEAM.ax * W - W / 2) / H
    let ay = (H / 2 - BEAM.ay * H) / H
    const lens = aboutLens.obj
    if (lens) {
      /* อ่าน matrixWorld ของเฟรมก่อนตรง ๆ — getWorldPosition บังคับคำนวณเมทริกซ์ของพ่อทั้งสายใหม่กลางลูป ทำท่าริกเพี้ยน */
      LP.setFromMatrixPosition(lens.matrixWorld)
      const zb = BEAM.z * H
      const k = (zb - cam.position.z) / (LP.z - cam.position.z)
      ax = (cam.position.x + (LP.x - cam.position.x) * k) / H
      ay = (cam.position.y + (LP.y - cam.position.y) * k) / H
    }
    /* มุม/ระยะในลำ → ตำแหน่ง (ระนาบของชิ้นตื้นกว่าระนาบลำ — ยังอยู่ในกรวยเดียวกันโดยประมาณ) */
    const polar = (q: readonly number[]) => {
      const an = (q[0] * Math.PI) / 180
      return [ax + Math.cos(an) * q[1], ay + Math.sin(an) * q[1]] as const
    }
    const bm = beamMesh.current
    if (bm) {
      bm.position.set(ax, ay, BEAM.z)
      beam.mat.uniforms.uReach.value = smooth((b.xray - 0.22) / 0.14) * (1 - back)
      beam.mat.uniforms.uOpen.value = smooth((b.xray - 0.28) / 0.2) * (1 - back)
      bm.visible = beam.mat.uniforms.uReach.value > 0
    }

    CARDS.forEach((_, i) => {
      const o = cards.current[i]
      if (!o) return
      const c = CARD_AT[i]
      const [cx, cy] = polar(c.p)
      const raw = pop(c.at)
      const a = outBack(raw)
      const act = paging && page === i
      /* โผล่จากอกตัวละคร (0, -0.1, 0) ไปที่ของมัน หมุนตัวเข้าที่ · การ์ดที่กำลังเล่าลอยเข้าหากล้อง */
      /* ลอยออกมาจากทางกล้องสองตาเล็กน้อย ไปหยุดที่ของมัน */
      o.position.set(
        lerp(lerp(ax, cx, 0.6), cx, a),
        lerp(lerp(ay, cy, 0.6), cy, a) + Math.sin(t * 1.1 + i * 2) * 0.008 * raw,
        c.p[2] + (act ? 0.12 : 0),
      )
      o.rotation.set(c.r[0] * a, c.r[1] * a + (1 - a) * 1.2, c.r[2] * a)
      o.scale.setScalar(Math.max(1e-3, a * (act ? 1.05 : 0.88)))
      o.visible = raw > 0
    })
    DECOS.forEach((d, i) => {
      const o = decos.current[i]
      if (!o) return
      const raw = pop(d.at)
      const a = outBack(raw)
      const [dx, dy] = polar(d.p)
      o.position.set(lerp(lerp(ax, dx, 0.6), dx, a), lerp(lerp(ay, dy, 0.6), dy, a) + Math.sin(t * 1.4 + i * 1.3) * 0.012 * raw, d.p[2])
      o.rotation.set(Math.sin(t * 0.8 + i) * 0.25 * raw, t * 0.5 * (i % 2 ? 1 : -1) * raw + (1 - a) * 2, 0)
      o.scale.setScalar(Math.max(1e-3, a * d.s))
      o.visible = raw > 0
    })
  })

  return (
    <>
    <mesh ref={rimMesh} geometry={bgGeo} material={rimMat} renderOrder={-21} visible={false} />
    <mesh ref={bgMesh} geometry={bgGeo} material={bgMat} renderOrder={-20} visible={false} />
    <mesh ref={winMesh} geometry={win.geo} material={win.mat} renderOrder={-20} visible={false} />
    <group ref={group} visible={false}>
      <mesh ref={beamMesh} geometry={beam.geo} material={beam.mat} renderOrder={-10} visible={false} />
      {CARDS.map((c, i) => (
        <group
          key={c.name}
          ref={(o) => {
            cards.current[i] = o
          }}
        >
          <RoundedBox args={[CARD_W, CARD_H, CARD_D]} radius={0.03} smoothness={4} material={mats.card} />
          {/* ไอคอนสกิล: ก้อนสีมน + สัญลักษณ์ขาวนูน */}
          <group position={[-CARD_W / 2 + 0.06, CARD_H / 2 - 0.058, CARD_D / 2 + 0.012]}>
            <RoundedBox args={[0.072, 0.072, 0.03]} radius={0.016} smoothness={3} material={mats.skill[i]} />
            <group position={[0, 0, 0.016]} scale={0.044}>
              {i === 0 && <mesh geometry={geos.pen} material={mats.white} />}
              {i === 1 && <mesh geometry={geos.code} material={mats.white} />}
              {i === 2 && (
                <>
                  <mesh geometry={geos.ring} material={mats.white} />
                  <mesh geometry={geos.handle} material={mats.white} />
                </>
              )}
            </group>
          </group>
          <mesh geometry={geos.titles[i]} material={mats.title} position={[-CARD_W / 2 + 0.11, CARD_H / 2 - 0.07, CARD_D / 2]} />
          {geos.descs[i].map((g, j) => (
            <mesh key={j} geometry={g} material={mats.desc} position={[-CARD_W / 2 + 0.024, CARD_H / 2 - 0.125 - j * 0.03, CARD_D / 2]} />
          ))}
          {/* ไม่มีคำอธิบาย (Research รอข้อความจริง) — แถบโครงเปล่าแทนตัวหนังสือ ไม่ใส่ข้อความปลอม */}
          {!geos.descs[i].length && (
            <>
              <RoundedBox args={[0.24, 0.016, 0.006]} radius={0.003} position={[-CARD_W / 2 + 0.144, -0.02, CARD_D / 2]} material={mats.glass} />
              <RoundedBox args={[0.16, 0.016, 0.006]} radius={0.003} position={[-CARD_W / 2 + 0.104, -0.05, CARD_D / 2]} material={mats.glass} />
            </>
          )}
        </group>
      ))}
      {DECOS.map((d, i) => (
        <group
          key={i}
          ref={(o) => {
            decos.current[i] = o
          }}
        >
          <Deco kind={d.kind} geos={geos} mats={mats} />
        </group>
      ))}
    </group>
    </>
  )
}

type Geos = Record<'star' | 'check' | 'mailV' | 'sphere' | 'disc' | 'octa', THREE.BufferGeometry>
type Mats = Record<'white' | 'green' | 'lime' | 'teal' | 'violet' | 'pink' | 'glass' | 'card' | 'coral' | 'peach' | 'sky', THREE.Material>

/** ชิ้นตกแต่ง (หน่วยราว 1) — รูปทรงล้วน ไม่มีข้อมูล */
function Deco({ kind, geos, mats }: { kind: DecoKind; geos: Geos; mats: Mats }) {
  switch (kind) {
    case 'check':
      return (
        <group rotation={[0, 0, Math.PI / 4]}>
          <RoundedBox args={[1, 1, 0.4]} radius={0.18} smoothness={4} material={mats.green} />
          <mesh geometry={geos.check} material={mats.white} position={[0, 0, 0.24]} rotation={[0, 0, -Math.PI / 4]} />
        </group>
      )
    case 'ball':
      return <mesh geometry={geos.sphere} material={mats.lime} />
    case 'mail':
      return (
        <group>
          <RoundedBox args={[1, 0.7, 0.25]} radius={0.1} smoothness={4} material={mats.teal} />
          <mesh geometry={geos.mailV} material={mats.white} position={[0, 0.04, 0.14]} />
        </group>
      )
    case 'star':
      return <mesh geometry={geos.star} material={mats.violet} />
    case 'plus':
      return (
        <group>
          <RoundedBox args={[1, 0.24, 0.24]} radius={0.1} material={mats.white} />
          <RoundedBox args={[0.24, 1, 0.24]} radius={0.1} material={mats.white} />
        </group>
      )
    case 'pill':
      return (
        <group>
          <RoundedBox args={[1.6, 0.5, 0.2]} radius={0.24} smoothness={4} material={mats.card} />
          {[-0.4, 0, 0.4].map((x, j) => (
            <mesh key={x} geometry={geos.sphere} material={j ? mats.glass : mats.pink} position={[x, 0, 0.12]} scale={0.1} />
          ))}
        </group>
      )
    case 'chip':
      return (
        <group>
          <RoundedBox args={[1.5, 0.6, 0.18]} radius={0.12} smoothness={4} material={mats.card} />
          <RoundedBox args={[0.36, 0.36, 0.12]} radius={0.08} position={[-0.45, 0, 0.1]} material={mats.pink} />
          <RoundedBox args={[0.6, 0.1, 0.06]} radius={0.04} position={[0.2, 0.06, 0.1]} material={mats.glass} />
          <RoundedBox args={[0.4, 0.1, 0.06]} radius={0.04} position={[0.1, -0.1, 0.1]} material={mats.glass} />
        </group>
      )
    case 'discs':
      /* กองจานแบนเอียง ๆ สีส้มไล่พีช (ภาพอ้างอิง) */
      return (
        <group rotation={[0.5, 0, -0.35]}>
          {[0, 1, 2, 3].map((j) => (
            <mesh key={j} geometry={geos.disc} material={j % 2 ? mats.peach : mats.coral} position={[Math.sin(j * 1.7) * 0.06, j * 0.42, 0]} rotation={[0, 0, Math.sin(j * 2.3) * 0.12]} />
          ))}
        </group>
      )
    case 'octa':
      return <mesh geometry={geos.octa} material={mats.coral} />
    case 'orb':
      return <mesh geometry={geos.sphere} material={mats.sky} />
    case 'cloud':
      return (
        <group>
          {[
            [0, 0, 1],
            [-0.9, -0.25, 0.75],
            [0.85, -0.2, 0.8],
            [0.3, 0.45, 0.7],
          ].map(([x, y, k], j) => (
            <mesh key={j} geometry={geos.sphere} material={mats.sky} position={[x, y, 0]} scale={k} />
          ))}
        </group>
      )
    case 'dots':
      return (
        <group>
          {[
            [0, 0.6],
            [0.7, 0.4],
            [-0.6, 0.1],
            [0.3, -0.2],
            [1, -0.4],
            [-0.2, -0.7],
          ].map(([x, y], j) => (
            <mesh key={j} geometry={geos.sphere} material={mats.coral} position={[x, y, 0]} scale={0.16} />
          ))}
        </group>
      )
    default:
      return <RoundedBox args={[1, 1, 1]} radius={0.16} smoothness={4} material={mats.glass} />
  }
}
