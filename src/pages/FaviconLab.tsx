import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Mascot } from '@/joespresso/scene/Mascot'
import { CameraFX } from '@/newhero/CameraFX'

/**
 * โต๊ะปั้น favicon — แบบ githubuniverse.com: หน้าตัวละคร 3D ตัดใกล้โผล่จากมุม บนแถบสีรุ้งคลื่นซ้อนเป็นวง
 * ในกรอบสี่เหลี่ยมมุมมน (favicon.png ของเขา 48×48)
 *
 * ตัวละครคือ Mascot ตัวจริงของเว็บ (instance แยก isolated) · แถบสีวาดในแคนวาสเดียวกัน (export ได้ภาพเดียว)
 * export: อ่านพิกเซลของแคนวาส (preserveDrawingBuffer) ย่อลงทีละขนาด ตัดมุมมนด้วย 2D canvas แล้วดาวน์โหลด PNG
 * apple-touch-icon ไม่ตัดมุม (iOS ตัดเอง) และพื้นทึบ · ค่าที่จูนจำไว้ในเบราว์เซอร์นี้ (localStorage)
 * dev เท่านั้น — route กั้นด้วย import.meta.env.DEV ใน App
 */

const SIZE = 512
/**
 * favicon อ้างอิง (reg.githubuniverse.com — ไฟล์เดียวกับ githubuniverse.com/favicon.png, 48×48) ไว้เทียบข้าง ๆ
 * โหลดจาก URL ต้นทางตรง ๆ ไม่เก็บไฟล์ของเขาไว้ใน repo · หน้านี้มีแต่ตอน dev
 */
const REF = 'https://static.rainfocus.com/github/universe26/static/staticfile/staticfile/universe-favicon_1779328442555001Oko0.png'
const KEY = 'favicon-lab.v13'

type S = {
  fov: number
  dist: number
  yaw: number
  pitch: number
  roll: number
  tx: number
  ty: number
  tz: number
  bodyYaw: number
  headYaw: number
  headPitch: number
  headRoll: number
  light: number
  rimPower: number
  rimBoost: number
  rimEdge: number
  rimSoft: number
  rimDirMix: number
  rimYaw: number
  rimPitch: number
  flatBands: number
  backLight: number
  fxRim: number
  fxW: number
  fxSoft: number
  fxThresh: number
  fxAngle: number
  fxFall: number
  fxShade: number
  fxBack: number
  bgMode: number
  echoN: number
  echoMode: number
  echoW: number
  echoSquare: number
  echoDx: number
  echoDy: number
  echoShrink: number
  echoGrow: number
  bandW: number
  cx: number
  cy: number
  wob: number
  wobF: number
  phase: number
  shade: number
  radius: number
  fxColor: string
  bg: string
  colors: string[]
}

/* ค่าที่จูนไว้แล้ว (Joe 2026-10-18) + แสงขอบตามตัวชุดเดียวกับ hero (rim* ใน newhero/tuner.js → Mascot) */
const DEFAULTS: S = {
  fov: 12,
  dist: 7.5,
  yaw: 0.24,
  pitch: -0.31,
  roll: 0,
  tx: 0.28,
  ty: 0.46,
  tz: 0,
  bodyYaw: 0.28,
  headYaw: 0.09,
  headPitch: -0.8,
  headRoll: 0.09,
  light: 1.6,
  rimPower: 9.9,
  rimBoost: 1.04,
  rimEdge: 0.18,
  rimSoft: 0.5,
  rimDirMix: 1,
  rimYaw: 108,
  rimPitch: 30,
  flatBands: 1,
  backLight: 0.6,
  /* เส้นแสงไล่ตามเงาตัว (CameraFX rimFx* ของ hero) — ทิศไฟหมุนมาขวาบน: ขอบซ้ายของหัวถูกตัดพ้นเฟรม ไฟซ้ายจึงไม่เห็น */
  fxRim: 2.4,
  fxW: 20,
  fxSoft: 0.4,
  fxThresh: 0.3,
  fxAngle: 30,
  fxFall: 2.95,
  fxShade: 0.78,
  fxBack: 0.6,
  fxColor: '#ffffff',
  /* พื้นหลัง: 0 = เงาตัวซ้อนไล่สี (EchoTrail ของ hero — แบบ githubuniverse จริง) · 1 = แถบคลื่นเป็นวง */
  bgMode: 0,
  echoN: 4,
  /* 1 = สำเนาซิลูเอตต์ขยายจากกลางหัว (ไม่เลื่อน) — ทุกชั้นทรงเดียวกับหัวทุกเหลี่ยม · 0 = ครอบหัวตามระยะจากขอบ */
  echoMode: 1,
  echoW: 0.079,
  /* 1 = ชั้นมุมเหลี่ยม (วัดระยะแบบสี่เหลี่ยม — มุมไม่มน) · 0 = ชั้นโค้งมนรอบหัว */
  echoSquare: 1,
  echoDx: 0.002,
  echoDy: 0.008,
  echoShrink: 0,
  echoGrow: 0.163,
  bandW: 0.127,
  cx: 0.3,
  cy: 0.22,
  wob: 0.018,
  wobF: 7,
  phase: 6.28,
  shade: 1,
  radius: 0.225,
  /* สีเงาตามของ githubuniverse จริง (ดูดสีจาก favicon 48px ของเขา ใบติดตัว → หาง) · พื้นนอกสุด = ชมพูของเขา */
  /* ดำ #180e27 ในภาพเขาคือผม/หัวของตัว Mona (ตัวแมว) ไม่ใช่เงา — ไม่เอา */
  colors: ['#bba00a', '#5fed83', '#583af7', '#c05200'],
  bg: '#f73678',
}

const load = (): S => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ไม่มีที่เก็บ — ใช้ค่าตั้งต้น */
  }
  return DEFAULTS
}

/** แถบสีรุ้งเป็นวงซ้อนรอบจุดหนึ่ง ขอบเป็นคลื่น — แผ่นเต็มจอหลังสุด (พิกัดคลิป ไม่ขึ้นกับกล้อง) */
function bandsMat() {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uC: { value: new THREE.Vector2() },
      uW: { value: 0.08 },
      uWob: { value: 0.02 },
      uWobF: { value: 9 },
      uPhase: { value: 0 },
      uShade: { value: 0.3 },
      uN: { value: 6 },
      uCol: { value: Array.from({ length: 8 }, () => new THREE.Color()) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy * 2.0, 0.999, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec2 uC;
      uniform float uW;
      uniform float uWob;
      uniform float uWobF;
      uniform float uPhase;
      uniform float uShade;
      uniform int uN;
      uniform vec3 uCol[8];
      varying vec2 vUv;
      vec3 pick(int i) {
        vec3 c = uCol[0];
        for (int k = 0; k < 8; k++) if (k == i) c = uCol[k];
        return c;
      }
      void main() {
        vec2 p = vUv - uC;
        float ang = atan(p.y, p.x);
        /* คลื่นจางลงใกล้จุดศูนย์ — ไม่งั้นแถบในสุดหยักเป็นดาว */
        float wk = smoothstep(0.0, 0.3, length(p));
        float d = length(p) + wk * (uWob * sin(ang * uWobF + uPhase) + uWob * 0.5 * sin(ang * uWobF * 2.3 - uPhase * 1.7));
        float b = d / uW;
        int i = int(floor(b));
        float f = fract(b);
        int n = uN;
        int ia = i < n ? i : n - 1;
        vec3 col = pick(ia);
        /* แต่ละแถบนูนนิด: ขอบในมืด ขอบนอกสว่าง (แบบเส้นผมดินปั้นในภาพอ้างอิง) */
        col *= 1.0 - uShade * 0.5 + uShade * smoothstep(0.0, 1.0, f);
        /* ขอบแถบนุ่มกันรอยหยัก */
        float aa = fwidth(b) * 1.2;
        vec3 nx = pick(ia + 1 < n ? ia + 1 : n - 1) * (1.0 - uShade * 0.5);
        col = mix(col, nx, smoothstep(1.0 - aa, 1.0, f) * (i < n - 1 ? 1.0 : 0.0));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

function Bands({ s }: { s: S }) {
  const mat = useMemo(bandsMat, [])
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useEffect(
    () => () => {
      mat.dispose()
      geo.dispose()
    },
    [mat, geo],
  )
  const u = mat.uniforms
  u.uC.value.set(s.cx, s.cy)
  u.uW.value = s.bandW
  u.uWob.value = s.wob
  u.uWobF.value = s.wobF
  u.uPhase.value = s.phase
  u.uShade.value = s.shade
  u.uN.value = Math.min(8, s.colors.length)
  s.colors.slice(0, 8).forEach((c, i) => u.uCol.value[i].set(c))
  return <mesh geometry={geo} material={mat} renderOrder={-1} frustumCulled={false} userData={{ favBg: true }} />
}

/**
 * เงาตัวซ้อนไล่สี — วิธีเดียวกับ EchoTrail ของ hero: ถ่าย *ซิลูเอตต์จริง* ของตัวละครลงบัฟเฟอร์ (ขาวทึบ ใช้แค่อัลฟา)
 * แล้ววาดซ้ำเป็นชุดสีทึบเยื้องออกไปทีละใบหลังตัว ใบไกลสุดก่อน ใบติดตัวทับท้าย · แผ่นเต็มจอแผ่นเดียว
 * ถ่ายทุกเฟรมก่อน CameraFX วาด (priority 0 มาก่อน 1) — ตัวละครหายใจ เงาจึงตามทัน
 */
const WHITE_MAT = new THREE.MeshBasicMaterial({ color: '#ffffff' })
const CLEAR = new THREE.Color()
function Echo({ s }: { s: S }) {
  const gl = useThree((t) => t.gl)
  const rt = useMemo(() => new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 }), [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        /* เช็คความลึก: แผ่นนี้อยู่ไกลสุด (0.998) ตัวละครที่อยู่หน้ากว่าจึงบังเงา — เงาอยู่หลังตัวเสมอ */
        depthTest: true,
        depthWrite: false,
        uniforms: {
          uMask: { value: rt.texture },
          uN: { value: 6 },
          uMode: { value: 0 },
          uDist: { value: null as THREE.Texture | null },
          uSq: { value: 1 },
          uEW: { value: 0.05 },
          uWob: { value: 0 },
          uWobF: { value: 9 },
          uPhase: { value: 0 },
          uOff: { value: new THREE.Vector2() },
          uGrow: { value: 0 },
          uShrink: { value: 0 },
          uPivot: { value: new THREE.Vector2(0.4, 0.4) },
          uCol: { value: Array.from({ length: 8 }, () => new THREE.Color()) },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy * 2.0, 0.998, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMask;
          uniform int uN;
          uniform vec2 uOff;
          uniform float uGrow;
          uniform float uShrink;
          uniform vec2 uPivot;
          uniform vec3 uCol[8];
          uniform int uMode;
          uniform sampler2D uDist;
          uniform float uSq;
          uniform float uEW;
          uniform float uWob;
          uniform float uWobF;
          uniform float uPhase;
          varying vec2 vUv;
          float maskAt(vec2 q) {
            return (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) ? texture2D(uMask, q).a : 0.0;
          }
          vec3 colAt(int k) {
            vec3 c = uCol[0];
            for (int j = 0; j < 8; j++) if (j == k) c = uCol[j];
            return c;
          }
          void main() {
            if (uMode == 0) {
              /*
               * ครอบหัว: ระยะจากขอบซิลูเอตต์ (ไล่วงรัศมีออกไป เจอเนื้อหัวที่รัศมีไหน = ระยะ) → ชั้นที่เท่าไร
               * ทุกชั้นหนาเท่ากันรอบตัวแบบ githubuniverse · ขอบชั้นเป็นคลื่นตามมุมรอบจุดศูนย์ (คลื่น/ความถี่/เฟส)
               */
              /* ระยะจริงถึงขอบหัวทุกพิกเซล (jump flood — ดู jfa) · ไม่มีจุดเนื้อหัวในภาพ = ไกลมาก */
              vec2 seed = texture2D(uDist, vUv).xy;
              vec2 sv = abs(vUv - seed);
              float d = seed.x < -0.5 ? 1e3 : (uSq > 0.5 ? max(sv.x, sv.y) : length(sv));
              vec2 pv = vUv - uPivot;
              float ang = atan(pv.y, pv.x);
              d += uWob * (sin(ang * uWobF + uPhase) * 0.7 + sin(ang * uWobF * 1.9 - uPhase) * 0.3) * smoothstep(0.0, uEW, d);
              float b = d / uEW;
              int k = int(floor(b));
              if (d <= 0.0 || k >= uN) discard;
              /* ขอบชั้นเนียน: ช่วงท้ายของชั้นไล่ไปสีชั้นถัดไปกว้างราวหนึ่งพิกเซล (ชั้นนอกสุดไล่ไปโปร่ง = พื้น) */
              float e = smoothstep(1.0 - fwidth(b) * 1.2, 1.0, fract(b));
              vec3 c0 = colAt(k);
              bool last = k + 1 >= uN;
              vec3 c1 = last ? c0 : colAt(k + 1);
              gl_FragColor = vec4(mix(c0, c1, e), last ? 1.0 - e : 1.0);
              #include <colorspace_fragment>
              return;
            }
            vec3 col = vec3(0.0);
            float a = 0.0;
            /* ใบไกลสุดก่อน ใบติดตัวทับท้าย */
            for (int k = 8; k >= 1; k--) {
              if (k > uN) continue;
              float fk = float(k);
              vec2 q = (vUv - uOff * fk - uPivot) / (1.0 + uGrow * fk) + uPivot;
              float m = 0.0;
              if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) m = texture2D(uMask, q).a;
              m = smoothstep(0.5 + uShrink * fk * 10.0 - 0.08, 0.5 + uShrink * fk * 10.0 + 0.08, m);
              vec3 c = uCol[0];
              for (int j = 0; j < 8; j++) if (j == k - 1) c = uCol[j];
              col = mix(col, c, m);
              a = max(a, m);
            }
            if (a < 0.003) discard;
            gl_FragColor = vec4(col, a);
            #include <colorspace_fragment>
          }`,
      }),
    [rt],
  )
  /**
   * jump flood — หา "จุดเนื้อหัวที่ใกล้ที่สุด" ให้ทุกพิกเซลใน ~10 รอบ (ครึ่งระยะลงทุกรอบ) ได้ระยะถึงขอบจริงทั้งภาพ
   * แทนการไล่ส่องรอบตัวเป็นทิศ ๆ (ช่องว่างระหว่างทิศกว้างขึ้นตามระยะ = ขอบชั้นหยัก)
   */
  const jfa = useMemo(() => {
    const opt = { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false }
    const a = new THREE.WebGLRenderTarget(SIZE, SIZE, opt)
    const b = new THREE.WebGLRenderTarget(SIZE, SIZE, opt)
    const vert = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }'
    const init = new THREE.ShaderMaterial({
      uniforms: { uMask: { value: rt.texture } },
      vertexShader: vert,
      fragmentShader: 'uniform sampler2D uMask; varying vec2 vUv; void main() { gl_FragColor = texture2D(uMask, vUv).a > 0.5 ? vec4(vUv, 0.0, 1.0) : vec4(-1.0, -1.0, 0.0, 1.0); }',
    })
    const step = new THREE.ShaderMaterial({
      uniforms: { uSrc: { value: null as THREE.Texture | null }, uStep: { value: 0 }, uSq: { value: 1 } },
      vertexShader: vert,
      fragmentShader: `
        uniform sampler2D uSrc;
        uniform float uStep;
        uniform float uSq;
        varying vec2 vUv;
        void main() {
          vec2 best = vec2(-1.0);
          float bd = 1e9;
          for (int y = -1; y <= 1; y++)
            for (int x = -1; x <= 1; x++) {
              vec2 q = vUv + vec2(float(x), float(y)) * uStep;
              if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) continue;
              vec2 sd = texture2D(uSrc, q).xy;
              if (sd.x < -0.5) continue;
              vec2 dv = abs(sd - vUv);
              /* สี่เหลี่ยม: ระยะ = แกนที่ไกลกว่า (ชั้นขยายเป็นมุมเหลี่ยม) · วงกลม: ระยะยุคลิด */
              float dd = uSq > 0.5 ? max(dv.x, dv.y) : dot(dv, dv);
              if (dd < bd) { bd = dd; best = sd; }
            }
          gl_FragColor = vec4(best, 0.0, 1.0);
        }`,
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), init)
    quad.frustumCulled = false
    const scene = new THREE.Scene()
    scene.add(quad)
    return { a, b, init, step, quad, scene, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) }
  }, [rt])
  useEffect(
    () => () => {
      jfa.a.dispose()
      jfa.b.dispose()
      jfa.init.dispose()
      jfa.step.dispose()
      jfa.quad.geometry.dispose()
    },
    [jfa],
  )
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useEffect(
    () => () => {
      rt.dispose()
      mat.dispose()
      geo.dispose()
    },
    [rt, mat, geo],
  )
  const self = useRef<THREE.Mesh>(null)
  const u = mat.uniforms
  u.uN.value = Math.round(Math.min(8, s.echoN, s.colors.length))
  u.uMode.value = Math.round(s.echoMode)
  u.uEW.value = s.echoW
  u.uSq.value = s.echoSquare
  u.uWob.value = s.wob
  u.uWobF.value = s.wobF
  u.uPhase.value = s.phase
  u.uOff.value.set(s.echoDx, s.echoDy)
  u.uGrow.value = s.echoGrow
  u.uShrink.value = s.echoShrink
  u.uPivot.value.set(s.cx, s.cy)
  s.colors.slice(0, 8).forEach((c, i) => u.uCol.value[i].set(c))
  useFrame(({ scene, camera }) => {
    /* อ่านจำนวนชั้น สี และเฟสคลื่นทุกเฟรมด้วย — ผู้ใช้ภายนอก (ปก Fastwork) ไล่ชั้นโผล่/ไหลสีโดยแก้ค่าใน s ตรง ๆ ไม่ re-render */
    u.uN.value = Math.round(Math.min(8, s.echoN, s.colors.length))
    s.colors.slice(0, 8).forEach((c, i) => u.uCol.value[i].set(c))
    u.uPhase.value = s.phase
    const me = self.current
    if (!me) return
    me.visible = s.bgMode < 0.5
    if (!me.visible) return
    /* ซิลูเอตต์: ปิดแผ่นพื้นหลังทั้งหมด (renderOrder ติดลบ/แผ่นนี้) วาดตัวละครเป็นขาวทึบลงบัฟเฟอร์โปร่ง */
    const hidden: THREE.Object3D[] = []
    scene.traverse((o) => {
      if (o.visible && (o === me || o.userData.favBg)) {
        hidden.push(o)
        o.visible = false
      }
    })
    const prevA = gl.getClearAlpha()
    gl.getClearColor(CLEAR)
    scene.overrideMaterial = WHITE_MAT
    gl.setRenderTarget(rt)
    gl.setClearColor(0x000000, 0)
    gl.clear()
    gl.render(scene, camera)
    scene.overrideMaterial = null
    if (s.echoMode < 0.5) {
      jfa.quad.material = jfa.init
      gl.setRenderTarget(jfa.a)
      gl.render(jfa.scene, jfa.cam)
      let src = jfa.a
      let dst = jfa.b
      jfa.quad.material = jfa.step
      jfa.step.uniforms.uSq.value = s.echoSquare
      for (let st = SIZE / 2; st >= 1; st /= 2) {
        jfa.step.uniforms.uSrc.value = src.texture
        jfa.step.uniforms.uStep.value = st / SIZE
        gl.setRenderTarget(dst)
        gl.render(jfa.scene, jfa.cam)
        ;[src, dst] = [dst, src]
      }
      mat.uniforms.uDist.value = src.texture
    }
    gl.setRenderTarget(null)
    scene.overrideMaterial = null
    gl.setClearColor(CLEAR, prevA)
    for (const o of hidden) o.visible = true
  }, 0)
  return <mesh ref={self} geometry={geo} material={mat} renderOrder={0} frustumCulled={false} />
}

/** พื้นสีเรียบหลังเงา (พื้นแบบ 0) */
function Flat({ s }: { s: S }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        uniforms: { uC: { value: new THREE.Color() } },
        vertexShader: 'void main() { gl_Position = vec4(position.xy * 2.0, 0.999, 1.0); }',
        fragmentShader: 'uniform vec3 uC; void main() { gl_FragColor = vec4(uC, 1.0);\n#include <colorspace_fragment>\n}',
      }),
    [],
  )
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useEffect(
    () => () => {
      mat.dispose()
      geo.dispose()
    },
    [mat, geo],
  )
  mat.uniforms.uC.value.set(s.bg)
  return <mesh geometry={geo} material={mat} renderOrder={-1} frustumCulled={false} userData={{ favBg: true }} />
}

/** กล้องโคจรรอบจุดเล็ง — มุมตัดของ favicon */
function Rig({ s }: { s: S }) {
  const camera = useThree((t) => t.camera) as THREE.PerspectiveCamera
  const invalidate = useThree((t) => t.invalidate)
  useLayoutEffect(() => {
    const T = new THREE.Vector3(s.tx, s.ty, s.tz)
    camera.fov = s.fov
    camera.position.set(
      T.x + s.dist * Math.sin(s.yaw) * Math.cos(s.pitch),
      T.y + s.dist * Math.sin(s.pitch),
      T.z + s.dist * Math.cos(s.yaw) * Math.cos(s.pitch),
    )
    camera.up.set(Math.sin(s.roll), Math.cos(s.roll), 0)
    camera.lookAt(T)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, s])
  return null
}

/**
 * แสงขอบตามตัวแบบ hero — วัสดุของ Mascot มี rim ฉีดไว้แล้ว (addRim · userData.rimU) แต่ Mascot เขียนค่าให้เฉพาะท่า skate
 * (ท่านั้นเปลี่ยนท่าตัวและหน้า) ที่นี่จึงเขียน uniform เองทุกเฟรมด้วยสูตรเดียวกับ Mascot: ทิศไฟในโลก → view space ของกล้อง
 */
type RimU = Record<'rimPower' | 'rimIntensity' | 'rimBands' | 'rimEdge' | 'rimSoft' | 'rimDirMix', { value: number }> & { rimDir: { value: THREE.Vector3 } }
const RIM_DIR = new THREE.Vector3()
function RimDriver({ s }: { s: S }) {
  useFrame(({ scene, camera }) => {
    const yaw = (s.rimYaw * Math.PI) / 180
    const pitch = (s.rimPitch * Math.PI) / 180
    RIM_DIR.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).transformDirection(camera.matrixWorldInverse)
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (!m) return
      for (const x of Array.isArray(m) ? m : [m]) {
        const u = x.userData.rimU as RimU | undefined
        if (!u) continue
        u.rimPower.value = s.rimPower
        u.rimIntensity.value = s.rimBoost
        u.rimBands.value = s.flatBands
        u.rimEdge.value = s.rimEdge
        u.rimSoft.value = s.rimSoft
        u.rimDirMix.value = s.rimDirMix
        u.rimDir.value.copy(RIM_DIR)
      }
    })
  })
  return null
}

/** ขนาดที่ export · round = ตัดมุมมน (apple-touch-icon ไม่ตัด — iOS ตัดเอง) */
const OUT = [
  { name: 'favicon-16.png', px: 16, round: true },
  { name: 'favicon-32.png', px: 32, round: true },
  { name: 'favicon.png', px: 48, round: true },
  { name: 'favicon-192.png', px: 192, round: true },
  { name: 'favicon-512.png', px: 512, round: true },
  { name: 'apple-touch-icon.png', px: 180, round: false },
]

function render(src: HTMLCanvasElement, px: number, radius: number, round: boolean) {
  const c = document.createElement('canvas')
  c.width = px
  c.height = px
  const g = c.getContext('2d')
  if (!g) return c
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  if (round) {
    g.beginPath()
    g.roundRect(0, 0, px, px, radius * px)
    g.clip()
  }
  /* ย่อทีละครึ่ง — ย่อทีเดียวจาก 512 เหลือ 16 ภาพแตก */
  let cur: CanvasImageSource = src
  let w = src.width
  while (w / 2 > px) {
    const t = document.createElement('canvas')
    t.width = Math.round(w / 2)
    t.height = Math.round(w / 2)
    const tg = t.getContext('2d')
    if (!tg) break
    tg.imageSmoothingQuality = 'high'
    tg.drawImage(cur, 0, 0, t.width, t.height)
    cur = t
    w = t.width
  }
  g.drawImage(cur, 0, 0, px, px)
  return c
}

const download = (c: HTMLCanvasElement, name: string) =>
  c.toBlob((b) => {
    if (!b) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }, 'image/png')

type Num = Exclude<keyof S, 'colors' | 'fxColor' | 'bg'>
const GROUPS: { title: string; rows: [Num, string, number, number, number][] }[] = [
  {
    title: 'กล้อง (มุมตัด)',
    rows: [
      ['fov', 'ซูม (fov)', 6, 60, 0.5],
      ['dist', 'ระยะ', 1, 10, 0.05],
      ['yaw', 'หมุนรอบ', -3.14, 3.14, 0.01],
      ['pitch', 'ก้ม/เงย', -1.2, 1.2, 0.01],
      ['roll', 'เอียงเฟรม', -1, 1, 0.01],
      ['tx', 'เล็ง x', -2, 2, 0.01],
      ['ty', 'เล็ง y', -2, 4, 0.01],
      ['tz', 'เล็ง z', -2, 2, 0.01],
    ],
  },
  {
    title: 'ตัวละคร',
    rows: [
      ['bodyYaw', 'หมุนตัว', -3.14, 3.14, 0.01],
      ['headYaw', 'หันหัว', -1.2, 1.2, 0.01],
      ['headPitch', 'ก้มหัว', -0.8, 0.8, 0.01],
      ['headRoll', 'เอียงหัว', -0.8, 0.8, 0.01],
      ['light', 'แสง', 0.2, 3, 0.05],
    ],
  },
  {
    title: 'แสงขอบที่ผิว (วัสดุ แบบ hero)',
    rows: [
      ['rimBoost', 'ความแรง', 0, 4, 0.01],
      ['rimPower', 'ความคม', 0.5, 20, 0.1],
      ['rimEdge', 'ขอบเขตขอบ', 0, 1, 0.01],
      ['rimSoft', 'ความนุ่ม', 0, 1, 0.01],
      ['rimDirMix', 'น้ำหนักทิศไฟ', 0, 1, 0.01],
      ['rimYaw', 'ทิศไฟ (องศา)', 0, 360, 1],
      ['rimPitch', 'ไฟสูง (องศา)', -90, 90, 1],
      ['flatBands', 'แสงเป็นชั้น', 0, 4, 1],
      ['backLight', 'ไฟหลัง', 0, 3, 0.01],
    ],
  },
  {
    title: 'เส้นแสงตามเงาตัว (trace แบบ hero)',
    rows: [
      ['fxRim', 'ความแรง', 0, 4, 0.01],
      ['fxW', 'ความกว้าง', 0, 40, 0.1],
      ['fxSoft', 'ความนุ่ม', 0, 1, 0.01],
      ['fxThresh', 'จับขอบ', 0.001, 0.3, 0.001],
      ['fxAngle', 'ทิศไฟ (องศา)', 0, 360, 1],
      ['fxFall', 'ไล่จากขอบ', 0.2, 6, 0.05],
      ['fxShade', 'ผิวหันหาไฟ', 0, 1, 0.01],
      ['fxBack', 'ไฟหลังตัว', 0, 2, 0.01],
    ],
  },
  {
    title: 'เงาตัวซ้อน (EchoTrail แบบ hero)',
    rows: [
      ['bgMode', 'พื้น: เงา 0 / คลื่น 1', 0, 1, 1],
      ['echoN', 'จำนวนเงา', 1, 8, 1],
      ['echoMode', 'ครอบระยะ 0 / ทรงหัว 1', 0, 1, 1],
      ['echoW', 'ความหนาชั้น (ครอบหัว)', 0.01, 0.15, 0.001],
      ['echoSquare', 'มุม: มน 0 / เหลี่ยม 1', 0, 1, 1],
      ['echoDx', 'เยื้อง x ต่อใบ (เยื้อง)', -0.2, 0.2, 0.001],
      ['echoDy', 'เยื้อง y ต่อใบ (เยื้อง)', -0.2, 0.2, 0.001],
      ['echoGrow', 'ขยายต่อใบ (ทรงหัว)', -0.1, 0.4, 0.001],
      ['echoShrink', 'หดขอบต่อใบ', 0, 0.05, 0.001],
    ],
  },
  {
    title: 'แถบคลื่น (พื้นแบบ 1)',
    rows: [
      ['bandW', 'ความหนาแถบ', 0.02, 0.3, 0.001],
      ['cx', 'จุดศูนย์ x (กลางหัว)', -0.5, 1.5, 0.01],
      ['cy', 'จุดศูนย์ y (กลางหัว)', -0.5, 1.5, 0.01],
      ['wob', 'คลื่น', 0, 0.08, 0.001],
      ['wobF', 'ความถี่คลื่น', 1, 24, 0.5],
      ['phase', 'เฟสคลื่น', 0, 6.28, 0.01],
      ['shade', 'นูน', 0, 1, 0.01],
    ],
  },
  { title: 'กรอบ', rows: [['radius', 'มุมมน', 0, 0.5, 0.005]] },
]

/**
 * ฉาก favicon ทั้งชุด (กล้อง เส้นแสง พื้น เงาซ้อน ไฟ ตัวละคร) — ใช้ในหน้านี้ และปกโปรไฟล์ Fastwork (pages/FastworkHead3D)
 * ให้หัวในปกตรงกับ favicon ที่จูนไว้ทุกค่า
 */
export function FaviconScene({ s, spin }: { s: S; spin?: React.Ref<THREE.Group> }) {
  const follow = useMemo(
    /* headFollow 0 = ไม่หันตามเมาส์เลย (ภาพ favicon ต้องนิ่งตามที่จูน) — เหลือแค่มุมหัวจากสไลเดอร์ */
    () => ({ headBaseYaw: s.headYaw, headBasePitch: s.headPitch, headBaseRoll: s.headRoll, headYaw: 0, headPitch: 0, headFollow: 0 }),
    [s.headYaw, s.headPitch, s.headRoll],
  )
  return (
    <>
      <Rig s={s} />
      {/* วาดฉากลงบัฟเฟอร์ แล้วไล่เส้นแสงตามเงาตัวจากความลึก — ตัวเดียวกับ hero (ภาพ export มีเส้นนี้ด้วย) */}
      <CameraFX
        rim={s.fxRim}
        rimW={s.fxW}
        rimSoft={s.fxSoft}
        rimThresh={s.fxThresh}
        rimAngle={s.fxAngle}
        rimFall={s.fxFall}
        rimShade={s.fxShade}
        rimBack={s.fxBack}
        rimColor={s.fxColor}
        tone={0}
      />
      {s.bgMode > 0.5 ? <Bands s={s} /> : <Flat s={s} />}
      <Echo s={s} />
      <ambientLight intensity={0.9 * s.light} />
      <directionalLight position={[2, 5, 4]} intensity={1.3 * s.light} />
      <directionalLight position={[-4, 2, 2]} intensity={0.45 * s.light} color="#FFDFC8" />
      {/* ไฟหลังตัวแบบ hero (heroLights: rimIntensity) */}
      <directionalLight position={[2, 6, -9]} intensity={s.backLight} />
      <RimDriver s={s} />
      <Suspense fallback={null}>
        {/* spin: กลุ่มหมุนรอบจุดเล็งของกล้อง (กลางหัว) — ให้ผู้ใช้ภายนอกหมุนหัวได้ (ท่าเข้าของปก Fastwork) */}
        <group position={[s.tx, s.ty, s.tz]}>
          <group ref={spin}>
            <group position={[-s.tx, -s.ty, -s.tz]}>
              <Mascot isolated noIdle rotation={[0, s.bodyYaw, 0]} followOverride={follow as never} />
            </group>
          </group>
        </group>
      </Suspense>
    </>
  )
}

/** ค่าที่จูนไว้ในหน้านี้ (localStorage) — ไม่มีก็ค่าตั้งต้น */
export const loadFaviconSettings = (): S => load()
export type FaviconSettings = S

export default function FaviconLab() {
  const [s, setS] = useState<S>(load)
  const glRef = useRef<HTMLCanvasElement | null>(null)
  const [previews, setPreviews] = useState<{ px: number; url: string }[]>([])
  const [ver, setVer] = useState(0)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* ไม่มีที่เก็บ */
    }
  }, [s])

  /* พรีวิวขนาดจริง — อ่านจากแคนวาสเป็นระยะ (ตัวละครหายใจ/ขยับ ภาพไม่นิ่ง) */
  useEffect(() => {
    const id = window.setInterval(() => setVer((v) => v + 1), 700)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    const c = glRef.current
    if (!c) return
    setPreviews([16, 32, 48, 64].map((px) => ({ px, url: render(c, px, s.radius, true).toDataURL() })))
  }, [ver, s.radius])

  const set = (k: Num, v: number) => setS((o) => ({ ...o, [k]: v }))

  return (
    /* สูงเท่าจอพอดี ไม่เลื่อนทั้งหน้า — แผงปรับค่าเลื่อนในตัวเอง พรีวิวจึงอยู่กับที่ระหว่างลากสไลเดอร์ */
    <div className="flex h-screen gap-6 overflow-hidden bg-[#eef0f4] p-6 font-mono text-[12px] text-[#16213e]">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
        <div
          className="overflow-hidden bg-white shadow-[0_10px_40px_rgba(16,40,110,0.18)]"
          style={{ width: SIZE, height: SIZE, borderRadius: s.radius * SIZE }}
        >
          <Canvas
            dpr={1}
            style={{ width: SIZE, height: SIZE }}
            gl={{ preserveDrawingBuffer: true, antialias: true }}
            camera={{ fov: s.fov, near: 0.05, far: 60 }}
            onCreated={({ gl }) => {
              glRef.current = gl.domElement
            }}
          >
            <FaviconScene s={s} />
          </Canvas>
        </div>
          {/* อ้างอิง — ขยายจาก 48 จริง (ภาพนุ่ม) ไว้เทียบองค์ประกอบ/สี */}
          <div className="flex flex-col items-center gap-2">
            <img src={REF} width={256} height={256} alt="githubuniverse favicon" className="rounded-[18%] shadow-[0_10px_40px_rgba(16,40,110,0.18)]" />
            <span className="text-[10px] text-[#6b7280]">อ้างอิง githubuniverse (48px ขยาย)</span>
          </div>
        </div>
        {/* ขนาดจริงบนแท็บเบราว์เซอร์ */}
        <div className="flex items-end gap-4 rounded-2xl bg-white p-4">
          {previews.map((p) => (
            <div key={p.px} className="flex flex-col items-center gap-1">
              <img src={p.url} width={p.px} height={p.px} alt="" style={{ imageRendering: 'auto' }} />
              {/* อ้างอิงขนาดเดียวกัน ใต้ของเรา */}
              <img src={REF} width={p.px} height={p.px} alt="" />
              <span className="text-[10px] text-[#6b7280]">{p.px}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2 rounded-t-lg bg-[#dfe3ea] px-3 py-2">
            {previews[1] && <img src={previews[1].url} width={16} height={16} alt="" />}
            <span>Joe Pattarapon</span>
          </div>
          <div className="flex items-center gap-2 rounded-t-lg bg-[#dfe3ea] px-3 py-2">
            <img src={REF} width={16} height={16} alt="" />
            <span>GitHub Universe</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {OUT.map((o) => (
            <button
              key={o.name}
              type="button"
              className="cursor-pointer rounded-full bg-[#16213e] px-3 py-1.5 text-white hover:bg-[#2f6bff]"
              onClick={() => glRef.current && download(render(glRef.current, o.px, s.radius, o.round), o.name)}
            >
              {o.name}
            </button>
          ))}
          <button
            type="button"
            className="cursor-pointer rounded-full bg-[#2f6bff] px-3 py-1.5 text-white"
            onClick={() => {
              const c = glRef.current
              if (!c) return
              OUT.forEach((o, i) => setTimeout(() => download(render(c, o.px, s.radius, o.round), o.name), i * 250))
            }}
          >
            ดาวน์โหลดทั้งหมด
          </button>
        </div>
      </div>

      <div className="flex h-full min-h-0 w-[340px] shrink-0 flex-col gap-4 overflow-y-auto overscroll-contain pr-1 [&>*]:shrink-0">
        {GROUPS.map((gr) => (
          <section key={gr.title} className="rounded-2xl bg-white p-4">
            <h2 className="mb-2 font-bold">{gr.title}</h2>
            {gr.rows.map(([k, label, min, max, step]) => (
              <label key={k} className="flex items-center gap-2 py-0.5">
                <span className="w-24 shrink-0">{label}</span>
                <input
                  type="range"
                  className="flex-1 cursor-pointer"
                  min={min}
                  max={max}
                  step={step}
                  value={s[k]}
                  onChange={(e) => set(k, +e.target.value)}
                />
                <span className="w-12 text-right tabular-nums">{s[k].toFixed(step < 0.01 ? 3 : 2)}</span>
              </label>
            ))}
          </section>
        ))}
        <section className="rounded-2xl bg-white p-4">
          <label className="flex items-center gap-2">
            <span className="w-28 shrink-0 font-bold">สีเส้นแสง</span>
            <input type="color" className="size-9 cursor-pointer" value={s.fxColor} onChange={(e) => setS((o) => ({ ...o, fxColor: e.target.value }))} />
          </label>
        </section>
        <section className="rounded-2xl bg-white p-4">
          <label className="flex items-center gap-2">
            <span className="w-28 shrink-0 font-bold">สีพื้น</span>
            <input type="color" className="size-9 cursor-pointer" value={s.bg} onChange={(e) => setS((o) => ({ ...o, bg: e.target.value }))} />
          </label>
        </section>
        <section className="rounded-2xl bg-white p-4">
          <h2 className="mb-2 font-bold">สีเงา/แถบ (ใบติดตัว → หาง)</h2>
          <div className="flex flex-wrap gap-2">
            {s.colors.map((c, i) => (
              <input
                key={i}
                type="color"
                className="size-9 cursor-pointer"
                value={c}
                onChange={(e) => setS((o) => ({ ...o, colors: o.colors.map((x, j) => (j === i ? e.target.value : x)) }))}
              />
            ))}
            <button
              type="button"
              className="cursor-pointer rounded-lg bg-[#eef0f4] px-3"
              disabled={s.colors.length >= 8}
              onClick={() => setS((o) => ({ ...o, colors: [...o.colors, o.colors[o.colors.length - 1]] }))}
            >
              +
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-lg bg-[#eef0f4] px-3"
              disabled={s.colors.length <= 2}
              onClick={() => setS((o) => ({ ...o, colors: o.colors.slice(0, -1) }))}
            >
              −
            </button>
          </div>
        </section>
        <div className="flex gap-2">
          <button type="button" className="cursor-pointer rounded-full bg-white px-3 py-1.5" onClick={() => setS(DEFAULTS)}>
            คืนค่าเริ่มต้น
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-full bg-white px-3 py-1.5"
            onClick={() => navigator.clipboard?.writeText(JSON.stringify(s, null, 2))}
          >
            คัดลอกค่า
          </button>
        </div>
      </div>
    </div>
  )
}
