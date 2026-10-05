import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'

/**
 * ฉากแฟ้มงาน + ถาดปุ่มอุปกรณ์ — ปั้นตามภาพอ้างอิง (ภาพประกอบ 3D ของคู่มือ Yandex 360 — เฉพาะของ ไม่เอาโลโก้)
 *
 *   แฟ้ม       แผ่นหลังน้ำเงินมีหูมนซ้ายบน · แผ่นหน้าแก้วฝ้าใหญ่ เอียงล่างเข้าหาผู้ชม มองทะลุเห็นของข้างหลังเบลอ
 *   ไฟล์ 3 ใบ   RAR (ขาว ซิป) · รูป (น้ำเงิน กรอบรูปภูเขา) · EXE (ขาว หน้าต่าง) — มุมพับขวาบน
 *   สาย        สายถักลายเกลียว หัว USB-C ขาว เสียบกลางขอบบนถาด อีกเส้นวนลงซ้ายเข้าข้างถาด
 *   ถาดปุ่ม     ผิวลายจุด (terrazzo) ร่องลึกรอบปุ่ม แสงน้ำเงินเรืองตามร่อง · ปุ่มมนมีแอ่งตรงกลาง ลายจุดเดียวกัน
 *              เทา (จอคอม) – ส้ม (แท็บเล็ต) – เทา (มือถือ) ไอคอนเส้นขาวหนา
 *
 * หน่วยเป็นพิกเซลของภาพอ้างอิง (ราว 1040×1000, จุดศูนย์ที่ 560,560 แกน y ขึ้น) — ผู้เรียกวาง/ย่อเอง
 * ไฟของแคนวาสนี้ตั้งไว้ให้แก้วฟอง (สว่างจัด) สีผิวทึบจึงหรี่ลงไว้ (DIM)
 */

const DIM = 0.6
const FONT = '/fonts/momo-trust-sans.json'
/** TTFLoader ขยายพิกัดฟอนต์ 1.389 เท่า (ดู ServiceTrack) */
const FONT_K = 0.72
const P = (x: number, y: number) => [x - 560, 560 - y] as const

function roundRect(w: number, h: number, r: number, cx = 0, cy = 0) {
  const s = new THREE.Shape()
  const x0 = cx - w / 2
  const y0 = cy - h / 2
  const rr = Math.min(r, w / 2, h / 2)
  s.moveTo(x0 + rr, y0)
  s.lineTo(x0 + w - rr, y0)
  s.absarc(x0 + w - rr, y0 + rr, rr, -Math.PI / 2, 0, false)
  s.lineTo(x0 + w, y0 + h - rr)
  s.absarc(x0 + w - rr, y0 + h - rr, rr, 0, Math.PI / 2, false)
  s.lineTo(x0 + rr, y0 + h)
  s.absarc(x0 + rr, y0 + h - rr, rr, Math.PI / 2, Math.PI, false)
  s.lineTo(x0, y0 + rr)
  s.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false)
  return s
}
const pathOf = (s: THREE.Shape) => {
  const p = new THREE.Path()
  p.curves = s.curves
  return p
}
const extrude = (shape: THREE.Shape | THREE.Shape[], depth: number, bev = 6, seg = 5) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.5, depth - bev * 2), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: seg, curveSegments: 24 })
  g.translate(0, 0, bev)
  return g
}
/** เส้นกรอบมนหนา t (มีรู) — ไอคอนเส้น */
const outline = (w: number, h: number, r: number, t: number, cx = 0, cy = 0) => {
  const s = roundRect(w, h, r, cx, cy)
  s.holes.push(pathOf(roundRect(w - t * 2, h - t * 2, Math.max(1, r - t), cx, cy)))
  return s
}

/** แผ่นหลังแฟ้ม: กล่องมนมุมใหญ่ + หูมนซ้ายบน (โค้งลาดลงไปขอบบน) */
function folderShape() {
  const w = 520
  const h = 420
  const r = 64
  const x0 = -w / 2
  const y0 = -h / 2
  const tabR = 200
  const s = new THREE.Shape()
  s.moveTo(x0 + r, y0)
  s.lineTo(x0 + w - r, y0)
  s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x0 + w, y0 + h - r)
  s.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x0 + tabR + 40, y0 + h)
  s.bezierCurveTo(x0 + tabR - 10, y0 + h, x0 + tabR - 20, y0 + h + 70, x0 + tabR - 80, y0 + h + 70)
  s.lineTo(x0 + r, y0 + h + 70)
  s.absarc(x0 + r, y0 + h + 70 - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x0, y0 + r)
  s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

/** เอกสารมุมพับขวาบน — ทรงหลัก + สามเหลี่ยมพับ (แยกชิ้นให้ทาสีเข้มกว่า) */
function docShapes(w: number, h: number, r = 14, f = 46) {
  const x0 = -w / 2
  const y0 = -h / 2
  const s = new THREE.Shape()
  s.moveTo(x0 + r, y0)
  s.lineTo(x0 + w - r, y0)
  s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x0 + w, y0 + h - f)
  s.lineTo(x0 + w - f, y0 + h)
  s.lineTo(x0 + r, y0 + h)
  s.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x0, y0 + r)
  s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false)
  const fold = new THREE.Shape([new THREE.Vector2(x0 + w - f, y0 + h), new THREE.Vector2(x0 + w - f + 6, y0 + h - f + 6), new THREE.Vector2(x0 + w, y0 + h - f)])
  return { body: s, fold }
}

/** ลายจุด terrazzo — เม็ดเทาเข้ม/อ่อนสุ่ม บนพื้นขาว (คูณกับสีของวัสดุ) */
function speckle(seed: number, dark = 0.55) {
  const n = 512
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d') as CanvasRenderingContext2D
  g.fillStyle = '#fff'
  g.fillRect(0, 0, n, n)
  let r = seed
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 2600; i += 1) {
    const v = Math.round(255 * (dark + rnd() * 0.35))
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.35 + rnd() * 0.5})`
    const sz = rnd() < 0.08 ? 2.6 : 1.2
    g.beginPath()
    g.arc(rnd() * n, rnd() * n, sz * (0.6 + rnd()), 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
/** ลายถักของสาย — เส้นเฉียงสลับเข้มอ่อนตามความยาว */
function braid() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 16
  const g = c.getContext('2d') as CanvasRenderingContext2D
  g.fillStyle = '#f4f4f6'
  g.fillRect(0, 0, 64, 16)
  g.strokeStyle = '#a9adb6'
  g.lineWidth = 2
  for (let x = -16; x < 80; x += 6) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x + 16, 16)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(60, 1)
  return t
}

const std = (hex: string, rough = 0.6, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(DIM), roughness: rough, metalness: 0, envMapIntensity: 0.2, ...extra })
const flat = (hex: string) => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false })

export function DeviceScene({ wobble = 0 }: { wobble?: number }) {
  const font = useLoader(FontLoader, FONT)
  const parts = useMemo(() => {
    const tex = { grey: speckle(7, 0.5), tray: speckle(13, 0.48), orange: speckle(29, 0.62), folder: speckle(41, 0.82), braid: braid() }
    tex.grey.repeat.set(0.006, 0.006)
    tex.tray.repeat.set(0.004, 0.004)
    tex.orange.repeat.set(0.006, 0.006)
    tex.folder.repeat.set(0.004, 0.004)

    const rar = docShapes(160, 210)
    const img = docShapes(150, 232, 14, 40)
    const exe = docShapes(170, 205)
    /* ถาด: กรอบนอกมน มีร่องลึก (รู) สำหรับปุ่ม */
    /* ขอบลบเหลี่ยม (bevel 10) บานออกทุกด้าน — กรอบนอกโตขึ้น 10 รูหดลง 10 (เห็นเป็น 740×270) ปุ่ม 236×254 ห่าง 8 ร่องรอบปุ่ม ~8 */
    const trayOuter = roundRect(800, 330, 46)
    trayOuter.holes.push(pathOf(roundRect(760, 290, 36)))

    /* ไอคอนบนปุ่ม (เส้นขาวหนา 12) */
    const monitor = [outline(120, 92, 18, 12, 0, 14), roundRect(12, 24, 2, 0, -46), roundRect(74, 12, 6, 0, -60)]
    const tablet = [outline(96, 132, 20, 12)]
    const phone = [outline(78, 132, 22, 12)]

    /* ไอคอนบนเอกสาร */
    const zipper: THREE.Shape[] = []
    for (let i = 0; i < 6; i += 1) zipper.push(roundRect(14, 8, 2, i % 2 ? 7 : -7, 62 - i * 12))
    zipper.push(outline(26, 34, 6, 6, 0, -14))
    const picture = [outline(96, 84, 18, 9), new THREE.Shape([new THREE.Vector2(-34, -28), new THREE.Vector2(-8, 4), new THREE.Vector2(8, -12), new THREE.Vector2(18, -2), new THREE.Vector2(34, -28)])]
    const sun = new THREE.Shape()
    sun.absarc(18, 16, 9, 0, Math.PI * 2, false)
    picture.push(sun)
    const windowIco = [outline(96, 70, 12, 8), roundRect(96, 20, 8, 0, 25)]

    const text = (t: string) => {
      const g = new TextGeometry(t, { font, size: 30 * FONT_K, depth: 1, curveSegments: 6, bevelEnabled: false })
      g.computeBoundingBox()
      const b = g.boundingBox as THREE.Box3
      g.translate(-(b.min.x + b.max.x) / 2, 0, 0)
      return g
    }

    const geo = {
      folder: extrude(folderShape(), 26, 8),
      glass: extrude(roundRect(580, 380, 70), 16, 6, 6),
      rar: extrude(rar.body, 8, 3, 3),
      rarFold: extrude(rar.fold, 10, 1, 1),
      img: extrude(img.body, 8, 3, 3),
      imgFold: extrude(img.fold, 10, 1, 1),
      exe: extrude(exe.body, 8, 3, 3),
      exeFold: extrude(exe.fold, 10, 1, 1),
      zipper: new THREE.ShapeGeometry(zipper, 8),
      picture: new THREE.ShapeGeometry(picture, 12),
      windowIco: new THREE.ShapeGeometry(windowIco, 10),
      winDots: new THREE.CircleGeometry(3.4, 12),
      rarText: text('RAR'),
      exeText: text('EXE'),
      tray: extrude(trayOuter, 54, 10, 6),
      trayFloor: new THREE.ShapeGeometry(roundRect(756, 286, 30), 12),
      glowRim: new THREE.ShapeGeometry(outline(752, 282, 28, 6), 12),
      /* ขนาดหลังขอบมน (bevel 20 บานออก) = 236×254 — ร่องระหว่างปุ่มแคบ ๆ เห็นแสงเรือง */
      key: extrude(roundRect(196, 214, 40), 58, 20, 8),
      dish: new THREE.CircleGeometry(84, 48),
      monitor: new THREE.ShapeGeometry(monitor, 12),
      tablet: new THREE.ShapeGeometry(tablet, 12),
      phone: new THREE.ShapeGeometry(phone, 12),
      plug: extrude(roundRect(54, 92, 20), 40, 12, 5),
      plugNeck: new THREE.CylinderGeometry(15, 19, 40, 24),
      cableA: new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(
          [P(598, 520), P(600, 470), P(560, 430), P(440, 410), P(330, 430), P(240, 470)].map(([x, y], i) => new THREE.Vector3(x, y, i < 3 ? 130 : 40)),
        ),
        120,
        6.5,
        12,
        false,
      ),
      cableB: new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(
          [P(240, 400), P(120, 420), P(70, 520), P(80, 640), P(140, 710), P(240, 720)].map(([x, y], i) => new THREE.Vector3(x, y, i < 1 ? 20 : 110)),
        ),
        120,
        6.5,
        12,
        false,
      ),
    }
    const mat = {
      folder: std('#2b64ee', 0.5, { map: tex.folder }),
      /* แก้วฝ้า: แสงลอดจริง (transmission) + ความหยาบ = เห็นแฟ้มกับไฟล์ข้างหลังเบลอแบบในภาพ */
      glass: new THREE.MeshPhysicalMaterial({
        color: '#f2f5ff',
        transmission: 1,
        roughness: 0.42,
        thickness: 18,
        ior: 1.25,
        metalness: 0,
        envMapIntensity: 0.35,
        transparent: true,
        opacity: 0.96,
      }),
      paper: std('#f7f7f9', 0.7),
      paperFold: std('#d9dbe1', 0.7),
      blue: std('#4d82f5', 0.5),
      blueFold: std('#2f5fd0', 0.5),
      greyIco: flat('#7d828c'),
      greyText: flat('#8a8f99'),
      white: flat('#ffffff'),
      tray: std('#f3f3f5', 0.55, { map: tex.tray }),
      floor: flat('#5d6bff'),
      rim: flat('#9aa6ff'),
      key: std('#e4e4e6', 0.75, { map: tex.grey }),
      keyHot: std('#f2663a', 0.6, { map: tex.orange }),
      dish: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, toneMapped: false, depthWrite: false }),
      dishHot: new THREE.MeshBasicMaterial({ color: '#ffd2bf', transparent: true, opacity: 0.32, toneMapped: false, depthWrite: false }),
      plug: std('#f6f6f8', 0.45),
      cable: std('#ffffff', 0.6, { map: tex.braid }),
    }
    return { geo, mat, tex }
  }, [font])
  useEffect(
    () => () => {
      Object.values(parts.geo).forEach((g) => g.dispose())
      Object.values(parts.mat).forEach((m) => m.dispose())
      Object.values(parts.tex).forEach((t) => t.dispose())
    },
    [parts],
  )
  const { geo, mat } = parts
  const bob = (i: number) => Math.sin(wobble * Math.PI * 2 + i * 1.7) * 6

  const keys: { x: number; hot: boolean; ico: THREE.BufferGeometry }[] = [
    { x: -244, hot: false, ico: geo.monitor },
    { x: 0, hot: true, ico: geo.tablet },
    { x: 244, hot: false, ico: geo.phone },
  ]

  return (
    <group>
      {/* แผ่นหลังแฟ้ม — เอนหลังเล็กน้อย */}
      <group position={[...P(490, 420), -80]} rotation={[-0.12, 0.08, 0]}>
        <mesh geometry={geo.folder} material={mat.folder} />
      </group>

      {/* ไฟล์ 3 ใบ: RAR เอียงซ้าย อยู่หลังแก้ว · รูปน้ำเงินสูงทางขวา · EXE หน้าแฟ้มขวาล่าง */}
      <group position={[...P(465, 228 + bob(0)), -20]} rotation={[0, 0.1, 0.36]}>
        <mesh geometry={geo.rar} material={mat.paper} />
        <mesh geometry={geo.rarFold} material={mat.paperFold} />
        <group position={[-22, 0, 8.6]}>
          <mesh geometry={geo.zipper} material={mat.greyIco} />
        </group>
        <mesh geometry={geo.rarText} material={mat.greyText} position={[34, -72, 8.6]} rotation={[0, 0, 0.1]} />
      </group>
      <group position={[...P(690, 205 + bob(1)), -40]} rotation={[0, -0.15, -0.06]}>
        <mesh geometry={geo.img} material={mat.blue} />
        <mesh geometry={geo.imgFold} material={mat.blueFold} />
        <mesh geometry={geo.picture} material={mat.white} position={[0, -6, 8.6]} />
      </group>
      <group position={[...P(770, 372 + bob(2)), 60]} rotation={[0, -0.22, -0.13]}>
        <mesh geometry={geo.exe} material={mat.paper} />
        <mesh geometry={geo.exeFold} material={mat.paperFold} />
        <mesh geometry={geo.windowIco} material={mat.greyIco} position={[0, 18, 8.6]} />
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={geo.winDots} material={mat.white} position={[22 + i * 10, 43, 8.8]} />
        ))}
        <mesh geometry={geo.exeText} material={mat.greyText} position={[0, -62, 8.6]} />
      </group>

      {/* แผ่นหน้าแก้วฝ้า — เอียงล่างเข้าหาผู้ชมมาก */}
      <group position={[...P(415, 455), 70]} rotation={[-0.62, 0.1, 0.02]}>
        <mesh geometry={geo.glass} material={mat.glass} />
      </group>

      {/* สาย: เส้นหนึ่งจากหลังแก้วเสียบกลางขอบบนถาด อีกเส้นวนลงซ้ายเข้าข้างถาด */}
      <mesh geometry={geo.cableA} material={mat.cable} />
      <mesh geometry={geo.cableB} material={mat.cable} />
      <group position={[...P(598, 575), 150]} rotation={[-0.3, 0, 0]}>
        <mesh geometry={geo.plugNeck} material={mat.plug} position={[0, 50, 20]} />
        <mesh geometry={geo.plug} material={mat.plug} />
      </group>

      {/* ถาดปุ่ม — หน้าหาผู้ชม เอนหลังนิดหน่อย */}
      <group position={[...P(600, 790), 130]} rotation={[-0.22, -0.04, -0.02]}>
        <mesh geometry={geo.trayFloor} material={mat.floor} position={[0, 0, 4]} />
        <mesh geometry={geo.glowRim} material={mat.rim} position={[0, 0, 5]} />
        <mesh geometry={geo.tray} material={mat.tray} />
        {keys.map((k) => (
          <group key={k.x} position={[k.x, 0, 8]}>
            <mesh geometry={geo.key} material={k.hot ? mat.keyHot : mat.key} />
            <mesh geometry={geo.dish} material={k.hot ? mat.dishHot : mat.dish} position={[0, 0, 58.5]} />
            <mesh geometry={k.ico} material={mat.white} position={[0, 0, 59]} />
          </group>
        ))}
      </group>
    </group>
  )
}
