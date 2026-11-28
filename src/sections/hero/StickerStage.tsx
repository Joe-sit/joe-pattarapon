import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CharacterHead } from '@/sections/skystory/head'
import { WORKS } from './WorksGallery'
import { FOV, STORY_FONT, camDist, devScreen, smooth, worksPost, type WorkBeats } from './workMotion'

/**
 * Selected Work แบบ "ลอกสติกเกอร์ไปแปะฝาโน้ตบุ๊ก" — ต่อท้ายบท Code (POST_CODE = 'sticker' ใน ./workMotion)
 *
 *   จอทึบ    ฟ้าเปิดแล้ว จอเครื่องทึบขึ้นเป็นพื้นแอป (ฟ้า) ใต้วิดเจ็ต — หน้าจอที่เสร็จแล้วเป็นแผ่นเดียว
 *   ลอก      หน้าจอลอกจากมุมขวาล่างเหมือนสติกเกอร์ ม้วนขึ้นเห็นหลังกาวขาว (ภาพบนแผ่น = ภาพจอจริงตอนนั้น)
 *   แปะ      เครื่องเปล่าจมลงไป ฝาโน้ตบุ๊กของ Joe ยกขึ้นมา เต็มไปด้วยสติกเกอร์งานเก่า · Joe โผล่หัวพ้นฝา
 *            แผ่นที่ลอกลอยไปแปะช่องว่างกลางฝา คลี่เรียบ กดลงเด้งนิด
 *   ไล่ดู    กล้องเข้าไปดูสติกเกอร์ทีละแผ่น (ค้างให้อ่าน) แผ่นที่ดูอยู่ยกมุมขึ้นนิด · ชื่องานใต้แผ่น
 *   คืน      กล้องถอยออก แผ่นของเราลอกจากฝาบินกลับไปแปะจอเครื่องที่ลอยกลับขึ้นมา ฝาจมหาย → ต่อบท Ship
 *
 * ชั้นวาด: StickerBacking (พื้นจอทึบ) อยู่ใต้ของบนจอเครื่อง · StickerStage อยู่เหนือของบนจอเครื่อง แต่ใต้ตัวเครื่องแก้ว
 * กล้องของฉาก = เพอร์สเปกทีฟเดียวกับเครื่อง (FOV · camDist) ระนาบ z = 0 คือพิกัดจอ px — แผ่นที่ลอกวางทับจอเครื่องได้ตรง
 */
const PICKS = WORKS.slice(0, 8)
const N = PICKS.length

/** จังหวะ (worksPost) [เริ่ม, ยาว] */
const T = {
  solid: [0.2, 0.1],
  peel: [0.31, 0.27],
  arrive: [0.44, 0.32],
  sink: [0.5, 0.26],
  fly: [0.6, 0.3],
  land: [0.88, 0.12],
  zoomIn: [1.02, 0.16],
  zoomOut: [2.2, 0.14],
  flyBack: [2.32, 0.2],
  leave: [2.32, 0.24],
  rise: [2.32, 0.22],
  unpeel: [2.52, 0.12],
} as const
const B0 = 1.1
const STEP = 0.155
const at01 = (x: number, r: readonly [number, number]) => Math.min(1, Math.max(0, (x - r[0]) / r[1]))
const ss = (x: number, r: readonly [number, number]) => smooth(at01(x, r))

export function stickerPhase(b: { code: number; works: number; ship: number }) {
  const post = worksPost(b)
  const peel = ss(post, T.peel) * (1 - ss(post, T.unpeel))
  const fly = ss(post, T.fly) * (1 - ss(post, T.flyBack))
  const land = at01(post, T.land) * (1 - at01(post, T.flyBack))
  const arrive = ss(post, T.arrive) * (1 - ss(post, T.leave))
  const sink = ss(post, T.sink) * (1 - ss(post, T.rise))
  const zoom = ss(post, T.zoomIn) * (1 - ss(post, T.zoomOut))
  /* โฟกัส: เลื่อนทีละแผ่น ค้างที่แต่ละแผ่นก่อนไปต่อ */
  const r = Math.min(N - 1, Math.max(0, (post - B0) / STEP))
  const ri = Math.min(N - 1, Math.floor(r))
  const focus = ri + smooth(Math.min(1, Math.max(0, (r - ri - 0.6) / 0.4)))
  /* พื้นจอทึบ: ขึ้นก่อนลอก · หายตอนเข้าบท Ship */
  const solid = ss(post, T.solid) * (1 - smooth(b.ship / 0.15))
  const gone = peel > 0.0005 || fly > 0.0005
  return { post, peel, fly, land, arrive, sink, zoom, focus, solid, gone }
}

/** เครื่องจมลงไปเท่าไร (BubbleTraveler อ่าน) */
export const stickerSink = (b: { code: number; works: number; ship: number }) => stickerPhase(b).sink

/** สีพื้นจอแอป — พื้นทึบ DOM กับแผ่นที่ลอกต้องตรงกัน · ขาวอมฟ้า (ฟ้าล้วนกลืนกับท้องฟ้า มองไม่เห็นแผ่น) */
const APP_TOP = '#ffffff'
const APP_BOT = '#e3ecff'

/** พื้นจอทึบใต้วิดเจ็ต (วางก่อนแคนวาสของบนจอเครื่อง) */
export function StickerBacking({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const d = el.current
      const f = frame.current
      if (!d || !f) return
      const ph = stickerPhase(f.b)
      const a = f.on && devScreen.ok && !ph.gone ? ph.solid : 0
      d.style.display = a > 0.001 ? '' : 'none'
      if (a <= 0.001) return
      d.style.opacity = a.toFixed(3)
      d.style.width = `${(devScreen.hw * 2).toFixed(1)}px`
      d.style.height = `${(devScreen.hh * 2).toFixed(1)}px`
      d.style.borderRadius = `${devScreen.r.toFixed(1)}px`
      d.style.transform = `translate3d(${(devScreen.cx - devScreen.hw).toFixed(1)}px, ${(devScreen.cy - devScreen.hh).toFixed(1)}px, 0)`
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame])
  return <div ref={el} className="pointer-events-none absolute top-0 left-0" style={{ display: 'none', background: `linear-gradient(180deg, ${APP_TOP}, ${APP_BOT})` }} aria-hidden />
}

/* ── ฝาโน้ตบุ๊ก + ช่องสติกเกอร์ (พิกัดฝา: x, y เป็นสัดส่วนของกว้าง/สูงฝา · w สัดส่วนของกว้างฝา · หมุน) ── */
const LID_ASPECT = 0.66
const LID_TILT = -0.16
/** หันฝาเฉียงนิด — เห็นสันฝากับตัวเครื่องด้านล่าง (ไม่ใช่แผ่นกระดานแบน ๆ) */
const LID_YAW = 0.3
/** ช่องงาน 8 แผ่นรอบกลางฝา (ทับกันนิดหน่อยแบบฝาโน้ตบุ๊กคนชอบแปะ) */
/** เรียงตามเข็มรอบฝา (ซ้ายบน → บน → ขวาบน → ขวา → ขวาล่าง → ล่าง → ซ้ายล่าง → ซ้าย) — กล้องไล่แผ่นที่ติดกัน ไม่วิ่งข้ามฝา */
const SLOTS: readonly (readonly [number, number, number, number])[] = [
  [-0.32, 0.27, 0.27, -0.1],
  [0.02, 0.33, 0.22, 0.07],
  [0.31, 0.26, 0.26, -0.05],
  [0.34, -0.03, 0.24, -0.14],
  [0.31, -0.31, 0.23, 0.06],
  [0.02, -0.34, 0.2, 0.1],
  [-0.29, -0.32, 0.25, -0.04],
  [-0.35, -0.04, 0.23, 0.12],
]
/** ช่องของแผ่นเรา: กลางฝา สูงเท่านี้ของความสูงฝา */
const JOE_SLOT = { x: 0, y: 0.02, h: 0.5, rot: -0.06 }
const ST_ASPECT = 1.55
/** ขนาดแคนวาสสติกเกอร์งาน (เนื้อแผ่น · ขอบเงา · ขอบขาวไดคัท · มุม) */
const SC = { w: 640, pad: 30, border: 16, r: 38 }
/** ขนาดแคนวาสทั้งแผ่น (ตายตัว — texture ของ three เปลี่ยนขนาดหลังอัปโหลดไม่ได้) */
const SC_W = SC.w + SC.pad * 2
const SC_H = Math.round(SC.w / ST_ASPECT) + SC.pad * 2
/** ภาพจอเครื่องที่ถ่ายไว้ (สัดส่วนเครื่อง DEVICE 88:172) */
const JOE_W = 512
const JOE_H = 1001
const blankCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

/** สติกเกอร์ไดคัท: ขอบขาว มุมมน เงาบาง ๆ — ภาพงานครอปเต็มแผ่น (ย่อเหลือ 640 กว้าง ไม่ใช่ภาพเต็ม 1920) */
function paintSticker(img: HTMLImageElement) {
  const cv = blankCanvas(SC_W, SC_H)
  const w = SC.w
  const h = SC_H - SC.pad * 2
  const g = cv.getContext('2d')
  if (!g) return cv
  g.shadowColor = 'rgba(16,24,48,0.3)'
  g.shadowBlur = 22
  g.shadowOffsetY = 8
  g.fillStyle = '#ffffff'
  rrect(g, SC.pad, SC.pad, w, h, SC.r)
  g.fill()
  g.shadowColor = 'transparent'
  g.save()
  rrect(g, SC.pad + SC.border, SC.pad + SC.border, w - SC.border * 2, h - SC.border * 2, SC.r - SC.border * 0.6)
  g.clip()
  const iw = img.naturalWidth || 1
  const ih = img.naturalHeight || 1
  const bw = w - SC.border * 2
  const bh = h - SC.border * 2
  const k = Math.max(bw / iw, bh / ih)
  g.drawImage(img, SC.pad + SC.border + (bw - iw * k) / 2, SC.pad + SC.border + (bh - ih * k) / 2, iw * k, ih * k)
  g.restore()
  return cv
}

/*
 * วัสดุสติกเกอร์: ม้วนรอบทรงกระบอก (page curl) — ส่วนที่เลยเส้นลอก (ตามทิศ uDir ไปหามุมที่ลอก) พันขึ้นหากล้อง
 * ด้านหลังเป็นกระดาษกาวขาว (ตัดตามรูปไดคัทจาก alpha) · แสงตามมุมม้วน
 * ภาพเป็นค่าดิบ (ไม่แปลงสี) เข้า-ออก — ShaderMaterial ไม่ผ่าน colorspace ของ three
 */
const VERT = /* glsl */ `
  uniform vec2 uSize; uniform vec2 uDir; uniform float uL; uniform float uR;
  varying vec2 vUv; varying float vShade;
  void main() {
    vUv = uv;
    vec3 p = vec3(position.xy * uSize, 0.0);
    float s = dot(p.xy, uDir);
    vShade = 1.0;
    if (s > uL) {
      float a = (s - uL) / uR;
      float sp; float z;
      if (a < 3.14159265) { sp = uL + uR * sin(a); z = uR * (1.0 - cos(a)); vShade = 0.84 + 0.16 * cos(a * 0.5); }
      else { sp = uL - (s - uL - 3.14159265 * uR); z = 2.0 * uR; vShade = 0.86; }
      p.xy += uDir * (sp - s);
      p.z += z;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`
const FRAG = /* glsl */ `
  uniform sampler2D uMap; uniform float uOpacity;
  varying vec2 vUv; varying float vShade;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    if (gl_FrontFacing) { gl_FragColor = vec4(t.rgb * vShade, t.a * uOpacity); }
    else {
      if (t.a < 0.6) discard;
      gl_FragColor = vec4(vec3(1.0, 0.995, 0.98) * vShade, uOpacity);
    }
  }`
const makeMat = (map: THREE.Texture) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uMap: { value: map }, uSize: { value: new THREE.Vector2(1, 1) }, uDir: { value: new THREE.Vector2(0.7, -0.7) }, uL: { value: 1e5 }, uR: { value: 20 }, uOpacity: { value: 1 } },
  })

type Frame = React.RefObject<{ on: boolean; b: WorkBeats }>

/** เส้นลอก: s สูงสุด (มุมที่ลอก) ของแผ่นขนาด w × h ตามทิศ d */
const sMax = (w: number, h: number, d: THREE.Vector2) => Math.abs(d.x) * (w / 2) + Math.abs(d.y) * (h / 2)

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _p2 = new THREE.Vector3()
const _q2 = new THREE.Quaternion()
const _e = new THREE.Euler()
const _n = new THREE.Vector3()
const _up = new THREE.Vector3()

function Env() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      pm.dispose()
    }
  }, [gl, scene])
  return null
}

function Scene({ frame, bench, focusOut }: { frame: Frame; bench: React.RefObject<HTMLCanvasElement | null>; focusOut: React.RefObject<{ fi: number; near: number; y: number }> }) {
  const lid = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const joe = useRef<THREE.Mesh>(null)
  const works = useRef<(THREE.Mesh | null)[]>([])
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1, 48, 48), [])

  /* แผ่นของเรา: วาดจากจอเครื่องจริง (พื้นแอป + แคนวาสของบนจอ) ทุกเฟรมจนเริ่มลอก */
  const joeTex = useMemo(() => {
    const t = new THREE.CanvasTexture(blankCanvas(JOE_W, JOE_H))
    t.colorSpace = THREE.NoColorSpace
    return t
  }, [])
  const joeMat = useMemo(() => makeMat(joeTex), [joeTex])

  /* สติกเกอร์งาน: ย่อภาพลงแคนวาสเล็กก่อนเป็น texture */
  const workTex = useMemo(
    () =>
      PICKS.map((w) => {
        const t = new THREE.CanvasTexture(blankCanvas(SC_W, SC_H))
        t.colorSpace = THREE.NoColorSpace
        t.anisotropy = 4
        const img = new Image()
        img.decoding = 'async'
        img.onload = () => {
          t.image = paintSticker(img)
          t.needsUpdate = true
        }
        img.src = w.img
        return t
      }),
    [],
  )
  const workMats = useMemo(() => workTex.map((t) => makeMat(t)), [workTex])
  useEffect(
    () => () => {
      geo.dispose()
      joeTex.dispose()
      joeMat.dispose()
      workTex.forEach((t) => t.dispose())
      workMats.forEach((m) => m.dispose())
    },
    [geo, joeTex, joeMat, workTex, workMats],
  )

  const camQ = useMemo(() => new THREE.Quaternion(), [])
  /* ถ่ายจอแล้วหรือยัง — เลื่อนเร็วข้ามช่วงก่อนลอกไปก็ยังถ่ายรอบแรกได้ (แคนวาสจอซ่อนอยู่แต่ภาพล่าสุดยังอยู่) */
  const captured = useRef(false)
  const lidEnd = useMemo(() => new THREE.Matrix4(), [])

  useFrame(({ camera, size, clock }) => {
    const f = frame.current
    if (!f) return
    const ph = stickerPhase(f.b)
    const W = size.width
    const H = size.height
    const cd = camDist(H)
    const cam = camera as THREE.PerspectiveCamera
    if (cam.fov !== FOV || cam.far < cd * 4) {
      cam.fov = FOV
      cam.near = 5
      cam.far = cd * 6
      cam.updateProjectionMatrix()
    }

    /* ── ฝา: ยกขึ้นจากใต้จอ หมุนตั้งขึ้น ── */
    const lidW = Math.min(W * 0.6, H * 0.95)
    const lidH = lidW * LID_ASPECT
    const lg = lid.current
    if (lg) {
      lg.getObjectByName('lid-body')?.scale.setScalar(lidW / LID_BODY.w)
      const a = ph.arrive
      lg.visible = a > 0.001
      lg.position.set(0, -H * 0.07 - (1 - a) * H * 1.3, -160)
      lg.rotation.set(LID_TILT - (1 - a) * 0.7, LID_YAW * a, 0, 'YXZ')
      lg.updateMatrixWorld(true)
    }
    /* หัว Joe โผล่พ้นฝาขวาบน หันมองแผ่นที่กล้องดูอยู่ */
    const hg = head.current
    if (hg) {
      const up = smooth(Math.min(1, Math.max(0, (ph.arrive - 0.55) / 0.45)))
      hg.visible = up > 0.001
      const hs = lidW * 0.24
      hg.scale.setScalar(hs)
      /* ตาพ้นขอบฝา (ครึ่งล่างของหัวหลบหลังฝา) */
      hg.position.set(lidW * 0.3, lidH / 2 + hs * (0.62 - (1 - up) * 1.1) + Math.sin(clock.elapsedTime * 1.6) * hs * 0.015, -hs * 0.4)
      const sl = SLOTS[Math.round(ph.focus)]
      const tx = ph.zoom > 0.01 ? sl[0] * lidW - lidW * 0.3 : -lidW * 0.3
      /* หน้าหันหากล้อง (ท่าเดียวกับหน้า About) ก้มนิดมองฝา แล้วเหลียวไปทางแผ่นที่ดูอยู่ */
      hg.rotation.set(0.12 + 0.2 * ph.zoom, THREE.MathUtils.clamp(tx / lidW, -0.6, 0.2), 0)
    }

    /* ── สติกเกอร์งานบนฝา ── */
    workMats.forEach((m, i) => {
      const mesh = works.current[i]
      if (!mesh) return
      const [sx, sy, sw, rot] = SLOTS[i]
      /* ขนาดแผ่นรวมขอบเงา (sw คือเนื้อแผ่น) */
      const ww = (lidW * sw * SC_W) / SC.w
      const hh = (ww * SC_H) / SC_W
      mesh.position.set(sx * lidW, sy * lidH, 9 + i * 0.6)
      mesh.rotation.set(0, 0, rot)
      m.uniforms.uSize.value.set(ww, hh)
      /* แผ่นที่กล้องดูอยู่ยกมุมขวาล่างขึ้นนิด — ให้รู้ว่าเป็นสติกเกอร์ */
      const d = m.uniforms.uDir.value.set(ww, -hh).normalize()
      const near = Math.max(0, 1 - Math.abs(ph.focus - i) * 1.6) * ph.zoom
      const sm = sMax(ww, hh, d)
      m.uniforms.uL.value = sm - Math.hypot(ww, hh) * 0.16 * near + (1 - near) * 2
      m.uniforms.uR.value = Math.min(ww, hh) * 0.09
    })

    /* ── แผ่นของเรา ── */
    const jm = joe.current
    const bc = bench.current
    if (jm) {
      const vis = (ph.peel > 0.0005 || ph.fly > 0.0005) && devScreen.ok
      jm.visible = vis
      /* ยังไม่ลอก: ถ่ายภาพจอเครื่องไว้ (พื้นแอปทึบ + ของบนจอ) — แผ่นที่ลอกจึงเป็นภาพจอจริงเป๊ะ */
      if ((!vis || !captured.current) && ph.solid > 0.02 && bc && bc.clientWidth > 0) {
        captured.current = true
        const cv = joeTex.image as HTMLCanvasElement
        const cw = JOE_W
        const ch = JOE_H
        const k = cw / (devScreen.hw * 2)
        const g = cv.getContext('2d')
        if (g) {
          g.clearRect(0, 0, cw, ch)
          g.save()
          rrect(g, 0, 0, cw, ch, devScreen.r * k)
          g.clip()
          const gr = g.createLinearGradient(0, 0, 0, ch)
          gr.addColorStop(0, APP_TOP)
          gr.addColorStop(1, APP_BOT)
          g.fillStyle = gr
          g.fillRect(0, 0, cw, ch)
          const bs = bc.width / bc.clientWidth
          g.drawImage(bc, (devScreen.cx - devScreen.hw) * bs, (devScreen.cy - devScreen.hh) * bs, devScreen.hw * 2 * bs, devScreen.hh * 2 * bs, 0, 0, cw, ch)
          g.restore()
          joeTex.needsUpdate = true
        }
      }
      if (vis && lg) {
        /* ปลายทาง = ช่องบนฝาในท่าที่ยกขึ้นเสร็จแล้ว (ไม่ตามฝาที่ยังเคลื่อน — ไม่งั้นแผ่นดิ่งลงใต้จอตามฝา) */
        lidEnd.compose(_p2.set(0, -H * 0.07, -160), _q2.setFromEuler(_e.set(LID_TILT, LID_YAW, 0, 'YXZ')), _s.set(1, 1, 1))
        /* ท่าบนจอเครื่อง (ระนาบ z = 0 = พิกัดจอ) → ท่าในช่องกลางฝา */
        const w0 = devScreen.hw * 2
        const h0 = devScreen.hh * 2
        const h1 = lidH * JOE_SLOT.h
        const w1 = (h1 * w0) / Math.max(1, h0)
        const fe = ph.fly
        _p.set(devScreen.cx - W / 2, H / 2 - devScreen.cy, 0)
        _q.identity()
        _m.compose(_p2.set(JOE_SLOT.x * lidW, JOE_SLOT.y * lidH, 16), _q2.setFromEuler(_e.set(0, 0, JOE_SLOT.rot)), _s.set(1, 1, 1)).premultiply(lidEnd)
        _m.decompose(_p2, _q2, _s)
        _p.lerp(_p2, fe)
        /* โค้งลอยเข้าหากล้องกลางทาง + บิดเล่นนิด */
        _p.z += Math.sin(Math.PI * fe) * H * 0.22
        _q.slerp(_q2, fe)
        _q.multiply(_q2.setFromEuler(_e.set(0, 0, Math.sin(Math.PI * fe) * 0.35)))
        jm.position.copy(_p)
        jm.quaternion.copy(_q)
        /* กดลงตอนแปะ: เด้งนิด */
        const bump = 1 + Math.sin(Math.PI * Math.min(1, ph.land * 1.4)) * 0.05 * (1 - ph.land)
        jm.scale.setScalar(bump)
        const w = w0 + (w1 - w0) * fe
        const h = h0 + (h1 - h0) * fe
        joeMat.uniforms.uSize.value.set(w, h)
        const d = joeMat.uniforms.uDir.value.set(w0, -h0).normalize()
        const sm = sMax(w, h, d)
        /* ลอกไปราว 3/4 แผ่น → ระหว่างบินคลี่กลับจนเรียบ */
        const Lp = sm - sm * 1.5 * ph.peel
        joeMat.uniforms.uL.value = Lp + (sm + 4 - Lp) * smooth(Math.min(1, fe * 1.15))
        joeMat.uniforms.uR.value = Math.min(w, h) * 0.13
      }
    }

    /* ── กล้อง: ภาพรวม (ท่าตั้งต้น = พิกัดจอ) ↔ เข้าไปดูทีละแผ่น (ตั้งฉากกับฝา) ── */
    const z = ph.zoom
    cam.position.set(0, 0, cd)
    cam.quaternion.identity()
    if (z > 0.0005 && lg) {
      const i0 = Math.floor(ph.focus)
      const i1 = Math.min(N - 1, i0 + 1)
      const fr = ph.focus - i0
      const tgt = (i: number, out: THREE.Vector3) => out.set(SLOTS[i][0] * lidW, SLOTS[i][1] * lidH, 0).applyMatrix4(lg.matrixWorld)
      tgt(i0, _p)
      tgt(i1, _p2)
      _p.lerp(_p2, fr)
      const sw = lidW * (SLOTS[i0][2] + (SLOTS[i1][2] - SLOTS[i0][2]) * fr)
      const sh = sw / ST_ASPECT
      /* แผ่นกินราว 46% ความสูงจอ (หรือ 52% ความกว้าง) · ถอยนิดกลางทางตอนย้ายแผ่น */
      const D = Math.max(sh / (0.46 * H), sw / (0.52 * W)) * cd * (1 + Math.sin(Math.PI * fr) * 0.35)
      _n.set(0, 0, 1).applyQuaternion(lg.quaternion)
      _p.addScaledVector(_n, D)
      _up.set(0, 0, cd)
      cam.position.lerpVectors(_up, _p, z)
      camQ.copy(lg.quaternion)
      cam.quaternion.slerp(camQ, z)
    }
    cam.updateMatrixWorld()
    /* คำบรรยาย: ใต้แผ่นที่ดูอยู่ (กล้องจัดแผ่นไว้กลางจอเสมอ) */
    const fo = focusOut.current
    fo.fi = Math.round(ph.focus)
    fo.near = Math.max(0, 1 - Math.abs(ph.focus - fo.fi) * 2.4) * z
    fo.y = H / 2 + H * 0.25
  })

  return (
    <>
      <Env />
      <ambientLight intensity={0.55} />
      <directionalLight position={[-400, 600, 900]} intensity={1.6} />
      <group ref={lid} visible={false}>
        {/* ฝาอะลูมิเนียม (ด้านหลังจอ) + บานพับ — ขนาดตั้งต้น 1000 แล้วสเกลตามจอ */}
        <LidBody />
        {PICKS.map((w, i) => (
          <mesh
            key={w.name}
            ref={(m) => {
              works.current[i] = m
            }}
            geometry={geo}
            material={workMats[i]}
            renderOrder={2 + i}
          />
        ))}
        <group ref={head} visible={false}>
          <Suspense fallback={null}>
            <CharacterHead />
          </Suspense>
        </group>
      </group>
      <mesh ref={joe} geometry={geo} material={joeMat} renderOrder={20} visible={false} />
    </>
  )
}

/** ตัวฝาโน้ตบุ๊ก (ขนาดฐาน 1000 กว้าง) — Scene สเกลตามกว้างฝาของจอนี้ (ของบนฝาวางเป็นพิกัดจริง ไม่สเกลตาม) */
const LID_BODY = { w: 1000, h: 1000 * LID_ASPECT }
function LidBody() {
  return (
    <group name="lid-body">
      <RoundedBox args={[LID_BODY.w, LID_BODY.h, 18]} radius={9} smoothness={4} position={[0, 0, -9]}>
        <meshStandardMaterial color="#8e939c" metalness={0.66} roughness={0.38} envMapIntensity={1} />
      </RoundedBox>
      {/* ตัวเครื่องด้านล่าง: วางราบ (ชดเชยมุมเอนของฝา) ยื่นไปข้างหลังฝา — หันฝาเฉียงแล้วเห็นสันกับพื้นคีย์บอร์ด */}
      <group position={[0, -LID_BODY.h / 2, -9]} rotation={[-LID_TILT, 0, 0]}>
        <RoundedBox args={[LID_BODY.w, 16, LID_BODY.h * 0.92]} radius={7} smoothness={4} position={[0, -8, -LID_BODY.h * 0.46]}>
          <meshStandardMaterial color="#8e939c" metalness={0.66} roughness={0.38} envMapIntensity={1} />
        </RoundedBox>
        <mesh position={[0, 0.5, -LID_BODY.h * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[LID_BODY.w * 0.86, LID_BODY.h * 0.42]} />
          <meshStandardMaterial color="#2b2e33" roughness={0.7} />
        </mesh>
      </group>
      {/* บานพับใต้ฝา */}
      <mesh position={[0, -LID_BODY.h / 2 - 7, -14]}>
        <boxGeometry args={[LID_BODY.w * 0.86, 14, 16]} />
        <meshStandardMaterial color="#9aa0aa" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}

/**
 * วัดขนาดแคนวาสด้วย ResizeObserver อย่างเดียว ไม่ฟัง scroll และไม่ debounce
 * ค่าตั้งต้นของ r3f ใช้ handler ตัวเดียว (debounce 50ms) ทั้ง ResizeObserver และ scroll — แคนวาสนี้ mount กลางการเลื่อน
 * ถ้า scroll event มาต่อเนื่อง (Lenis / แทร็กแพดเหวี่ยง) การวัดถูกเลื่อนไปเรื่อย ๆ renderer ไม่ถูกสร้าง = จอขาว
 * แคนวาสเป็น fixed เต็มจอ การเลื่อนไม่เปลี่ยนขนาดอยู่แล้ว
 */
const MEASURE = { scroll: false, debounce: 0 }

export function StickerStage({ frame, bench }: { frame: Frame; bench: React.RefObject<HTMLCanvasElement | null> }) {
  /* mount เฉพาะช่วงที่ใช้ (กลางบท Code → ต้น Ship) — นอกช่วงคืน context ทั้งก้อน */
  const [on, setOn] = useState(false)
  const caption = useRef<HTMLDivElement>(null)
  const capName = useRef<HTMLDivElement>(null)
  const capSub = useRef<HTMLDivElement>(null)
  const focusOut = useRef({ fi: 0, near: 0, y: 0 })
  useEffect(() => {
    let raf = 0
    let cur = false
    let shown = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const f = frame.current
      if (!f) return
      const want = f.on && f.b.code > 0.5 && f.b.ship < 0.4
      if (want !== cur) {
        cur = want
        setOn(want)
      }
      const fo = focusOut.current
      const c = caption.current
      if (!c) return
      const a = want ? fo.near : 0
      c.style.opacity = a.toFixed(3)
      c.style.transform = `translate3d(-50%, ${(fo.y + (1 - a) * 10).toFixed(1)}px, 0)`
      if (a > 0 && fo.fi !== shown && PICKS[fo.fi]) {
        shown = fo.fi
        if (capName.current) capName.current.textContent = PICKS[fo.fi].name
        if (capSub.current) capSub.current.textContent = `${PICKS[fo.fi].category} · ${PICKS[fo.fi].sub}`
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame])
  return (
    <div className="pointer-events-none absolute inset-0" style={{ fontFamily: STORY_FONT }} aria-label="Selected Work">
      {on && (
        <Canvas className="!absolute inset-0" dpr={[1, 1.5]} resize={MEASURE} camera={{ fov: FOV, position: [0, 0, 1700], near: 5, far: 20000 }} gl={{ antialias: true, alpha: true }} style={{ pointerEvents: 'none' }}>
          <Scene frame={frame} bench={bench} focusOut={focusOut} />
        </Canvas>
      )}
      {/* ป้ายชื่องาน: พื้นขาว ตัวเข้ม — อ่านได้ทั้งบนฝาเทาและบนฟ้า */}
      <div ref={caption} className="absolute top-0 left-1/2 rounded-2xl bg-white/90 px-5 py-2.5 text-center shadow-[0_8px_24px_rgba(15,27,61,0.18)] backdrop-blur-md" style={{ opacity: 0 }}>
        <div ref={capName} className="text-[clamp(16px,1.3vw,22px)] leading-tight font-bold text-[#0f1b3d]" />
        <div ref={capSub} className="mt-0.5 text-[12px] text-[#4a5677]" />
      </div>
    </div>
  )
}
