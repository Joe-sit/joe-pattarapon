import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * จี้พวงกุญแจ — ปั้นในโค้ดทั้งหมดตามภาพอ้างอิง (อะคริลิกฝ้า / กระเบื้องนูน / ยางนิ่ม / สายผ้า)
 *
 * ทุกชิ้นใช้กรอบเดียวกัน: จุดกำเนิด = รูแขวนด้านบน ตัวจี้ห้อยลงไปทาง −y หน้าจี้หัน +z
 * ฉากจึงแขวนทุกชิ้นด้วยสูตรเดียว (ดู KeychainScene) · `len` = ความยาวจากรูแขวนถึงปลายล่าง
 */
export type Charm = { group: THREE.Group; len: number; dispose: () => void }

const FONT = "'Momo Trust Display', 'Mona Sans', system-ui, sans-serif"
const SANS = "'Momo Trust Sans', 'Mona Sans', system-ui, sans-serif"

/** เก็บของที่ต้อง dispose ระหว่างปั้น */
function bin() {
  const list: { dispose: () => void }[] = []
  const keep = <T extends { dispose: () => void }>(x: T) => {
    list.push(x)
    return x
  }
  return { keep, dispose: () => list.forEach((x) => x.dispose()) }
}

const plastic = (color: string, p: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25, ...p })

/** อะคริลิกฝ้า — โปร่งครึ่งเดียว (ไม่ใช้ transmission: พื้นหลังเป็น CSS ส่องไม่ถึง) ขอบรุ้งนิด ๆ */
const acrylic = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#f4f8ff',
    roughness: 0.32,
    transparent: true,
    opacity: 0.62,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    iridescence: 0.7,
    iridescenceIOR: 1.4,
    depthWrite: false,
  })

export const chrome = () => new THREE.MeshPhysicalMaterial({ color: '#e8ebf0', metalness: 1, roughness: 0.14 })

/** เท็กซ์เจอร์จากแคนวาส — วาดซ้ำเมื่อฟอนต์ของเว็บโหลดเสร็จ */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  const paint = () => {
    const g = c.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, w, h)
    draw(g, w, h)
    t.needsUpdate = true
  }
  paint()
  document.fonts?.load(`64px ${FONT}`).then(paint, () => {})
  return t
}

/** สี่เหลี่ยมมุมมน (ศูนย์กลางที่ 0,0) — เลือกเจาะรูกลมได้ */
function roundRect(w: number, h: number, r: number, hole?: { x: number; y: number; r: number }) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  if (hole) s.holes.push(new THREE.Path().absarc(hole.x, hole.y, hole.r, 0, Math.PI * 2, true))
  return s
}

/** ห่วงแขวนเล็ก (jump ring) ที่รูของจี้ — ชิ้นโลหะเดียวกับโซ่ */
function jumpRing(keep: <T extends { dispose: () => void }>(x: T) => T, metal: THREE.Material, r = 0.12) {
  const m = new THREE.Mesh(keep(new THREE.TorusGeometry(r, 0.026, 12, 32)), metal)
  m.rotation.y = Math.PI / 2
  return m
}

/**
 * แยกรูปกับรูเจาะของ path เอง — `SVGLoader.createShapes` เดาทิศการวนผิดกับโลโก้ JOE
 * (ดอกไม้ตรงตัว o เลยกลายเป็นเส้นขอบกลวง) ที่นี่ใช้ตำแหน่งแทน: เส้นปิดที่อยู่ในเส้นปิดอื่น = รู
 */
function shapesOf(path: { subPaths: THREE.Path[] }) {
  const polys = path.subPaths.map((sp) => sp.getPoints(12)).filter((pts) => pts.length > 2)
  const area = (pts: THREE.Vector2[]) => Math.abs(THREE.ShapeUtils.area(pts))
  const inside = (pt: THREE.Vector2, poly: THREE.Vector2[]) => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i]
      const b = poly[j]
      if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c
    }
    return c
  }
  polys.sort((a, b) => area(b) - area(a))
  const outers: { pts: THREE.Vector2[]; shape: THREE.Shape }[] = []
  for (const pts of polys) {
    const host = outers.find((o) => inside(pts[0], o.pts))
    if (host) {
      const hole = THREE.ShapeUtils.isClockWise(pts) ? pts : [...pts].reverse()
      host.shape.holes.push(new THREE.Path(hole))
    } else {
      const outer = THREE.ShapeUtils.isClockWise(pts) ? [...pts].reverse() : pts
      outers.push({ pts, shape: new THREE.Shape(outer) })
    }
  }
  return outers.map((o) => o.shape)
}

/**
 * ไอคอนสกิลของเว็บ (SVG เดียวกับการ์ด what-i-do) อัดนูน ขนาดกว้าง `width` ศูนย์กลางที่ 0
 *
 * `flat` = ทุกชิ้นอยู่ระนาบเดียวกัน (โลโก้ตัวอักษร) — ค่าเริ่มต้นยกชั้นหลังขึ้นทีละนิดสำหรับไอคอน
 * ที่ชั้นซ้อนทับกัน · `grow` = ขยายขอบออกกี่หน่วย SVG แทนเส้นขอบ (stroke) ที่ไฟล์วาดทับไว้
 * โลโก้ JOE ใช้ stroke กว้าง 1 ปิดร่องระหว่างตัว E กับหูข้าง — ไม่ขยายตามแล้วหูหลุดเป็นชิ้นแยก
 */
export function svgInlay(svg: string, width: number, depth: number, opts: { flat?: boolean; grow?: number } = {}) {
  const grow = opts.grow ?? 0.35
  const data = new SVGLoader().parse(svg)
  const parts: THREE.BufferGeometry[] = []
  data.paths.forEach((path, i) => {
    const fill = path.userData?.style?.fill
    if (!fill || fill === 'none') return
    for (const shape of shapesOf(path)) {
      const g = new THREE.ExtrudeGeometry(shape, { depth: 10, bevelEnabled: true, bevelThickness: 1.2, bevelSize: grow, bevelSegments: 3, curveSegments: 10 })
      g.deleteAttribute('uv')
      /* ชั้นหลังใน SVG ทับชั้นก่อน — ยกขึ้นทีละนิด ไม่งั้นหน้าซ้อนระนาบเดียวกันกะพริบเป็นลาย */
      if (!opts.flat) g.translate(0, 0, i * 3)
      parts.push(g.index ? g.toNonIndexed() : g)
    }
  })
  const geo = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  geo.computeBoundingBox()
  const bb = geo.boundingBox as THREE.Box3
  const s = width / (bb.max.x - bb.min.x)
  /**
   * SVG แกน y ชี้ลง — พลิก y พร้อม z (= หมุนครึ่งรอบรอบแกน x ไม่ใช่ส่องกระจก) ด้านหน้ายังเป็นด้านหน้า
   * พลิกแค่ y อย่างเดียวทิศการวนกลับด้าน หน้าตัดหันหนีกล้องถูกตัดทิ้ง เห็นแต่ผนังข้างเป็นเส้นกลวง
   * ขอบมน (bevel) เล็กไว้ — ใหญ่แล้วเส้นขอบรูดาวตรงกลางตัว o ทับกันเอง หน้าตัดตัดสามเหลี่ยมไม่ได้
   */
  const k = depth / (bb.max.z - bb.min.z)
  geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -bb.max.z)
  geo.scale(s, -s, -k)
  geo.computeVertexNormals()
  return geo
}

/* ---------------------------------------------------------------- จี้แต่ละแบบ */

/**
 * กระเบื้องนูน (ภาพอ้างอิง World Design Day): ก้อนขาวมุมมนหนา ไอคอนสีสกิลอัดนูนกลางหน้า
 * แผ่นอะคริลิกใสสองแผ่นเยื้องอยู่ข้างหลัง · ห่วงแขวนที่มุมบน
 */
export function tileCharm(svg: string, color: string): Charm {
  const { keep, dispose } = bin()
  const S = 1.25
  const g = new THREE.Group()
  const metal = keep(chrome())
  const white = keep(plastic('#f6f4ee', { roughness: 0.5 }))
  const ink = keep(plastic(color, { roughness: 0.35 }))
  const glass = keep(acrylic())
  const body = new THREE.Mesh(keep(new RoundedBoxGeometry(S, S, 0.3, 5, 0.16)), white)
  body.position.y = -0.18 - S / 2
  const icon = new THREE.Mesh(keep(svgInlay(svg, S * 0.52, 0.06)), ink)
  icon.position.set(0, body.position.y, 0.15)
  const plate = keep(new THREE.ExtrudeGeometry(roundRect(S * 1.05, S * 1.05, 0.14), { depth: 0.04, bevelEnabled: false }))
  for (let k = 0; k < 2; k += 1) {
    const m = new THREE.Mesh(plate, glass)
    m.position.set(-0.14 - k * 0.12, body.position.y + 0.12 + k * 0.1, -0.22 - k * 0.12)
    m.rotation.z = 0.08 + k * 0.05
    g.add(m)
  }
  const ring = jumpRing(keep, metal)
  g.add(body, icon, ring)
  return { group: g, len: 0.18 + S, dispose }
}

/**
 * จี้ยางนิ่ม (ภาพอ้างอิง GitHub Universe): แว่นขยายอ้วนกลม สีสกิล ผิวด้านนุ่ม ๆ
 * เลนส์ใสฝ้า ไอคอนเคอร์เซอร์ของเว็บลอยในเลนส์
 */
export function magnifierCharm(svg: string, color: string): Charm {
  const { keep, dispose } = bin()
  const g = new THREE.Group()
  const metal = keep(chrome())
  const soft = keep(plastic(color, { roughness: 0.5, clearcoat: 0.35, sheen: 0.2, sheenColor: new THREE.Color('#ffffff') }))
  const dark = keep(plastic('#15306e', { roughness: 0.5 }))
  const glass = keep(acrylic())
  const R = 0.55
  const cy = -0.2 - 0.16 - R
  const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(R, 0.16, 28, 72)), soft)
  ring.position.y = cy
  const lens = new THREE.Mesh(keep(new THREE.CylinderGeometry(R, R, 0.1, 64)), glass)
  lens.rotation.x = Math.PI / 2
  lens.position.y = cy
  const icon = new THREE.Mesh(keep(svgInlay(svg, R * 0.9, 0.08)), dark)
  icon.position.set(0, cy, -0.04)
  /* ด้ามจับห้อยลงเฉียง */
  const handle = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.15, 0.6, 10, 24)), soft)
  const a = -Math.PI / 4
  handle.position.set(Math.sin(-a) * (R + 0.48), cy - Math.cos(a) * (R + 0.48), 0)
  handle.rotation.z = a
  const loop = new THREE.Mesh(keep(new THREE.TorusGeometry(0.11, 0.05, 12, 28)), soft)
  loop.position.y = -0.17
  g.add(ring, lens, icon, handle, loop, jumpRing(keep, metal))
  return { group: g, len: 0.36 + R * 2 + 0.7, dispose }
}

/**
 * อะคริลิกพิมพ์ไล่สี (ภาพอ้างอิง ODC): แผ่นใสฝ้าขอบหนา ด้านในพิมพ์ไล่สีรุ้งโทนสกิล
 * กับไอคอน >_ ของเว็บสีขาว
 */
export function acrylicCharm(svg: string, color: string): Charm {
  const { keep, dispose } = bin()
  const g = new THREE.Group()
  const metal = keep(chrome())
  const glass = keep(acrylic())
  const W = 1.3
  const H = 1.15
  const cy = -0.16 - H / 2
  const body = new THREE.Mesh(
    keep(
      new THREE.ExtrudeGeometry(roundRect(W, H, 0.34, { x: 0, y: H / 2 - 0.16, r: 0.075 }), {
        depth: 0.12,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.04,
        bevelSegments: 4,
        curveSegments: 16,
      }),
    ),
    glass,
  )
  body.position.set(0, cy, -0.06)
  const tex = keep(
    canvasTex(512, 452, (c, w, h) => {
      const lg = c.createLinearGradient(0, 0, w, h)
      lg.addColorStop(0, '#ffb3d9')
      lg.addColorStop(0.45, color)
      lg.addColorStop(1, '#6fe0ff')
      c.fillStyle = lg
      c.beginPath()
      c.roundRect(0, 0, w, h, 90)
      c.fill()
    }),
  )
  const print = new THREE.Mesh(keep(new THREE.PlaneGeometry(W - 0.26, H - 0.36)), keep(new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, roughness: 0.3, iridescence: 0.5 })))
  print.position.set(0, cy - 0.06, 0.005)
  const icon = new THREE.Mesh(keep(svgInlay(svg, 0.58, 0.05)), keep(plastic('#ffffff', { roughness: 0.3 })))
  icon.position.set(0, cy - 0.06, 0.02)
  g.add(body, print, icon, jumpRing(keep, metal))
  return { group: g, len: 0.16 + H, dispose }
}

/**
 * ป้ายอะคริลิก (ภาพอ้างอิง "creative"): แท่งใสฝ้าขอบหนา มีหูเจาะรูด้านบน ด้านในพิมพ์พื้นสีเข้ม
 * ชื่อบริษัทตัวใหญ่ + ชื่อเต็มตัวเล็ก — ชื่อจริงจากไทม์ไลน์งาน (ไม่มีไฟล์โลโก้จริงในเว็บ จึงเป็นตัวอักษร)
 */
export function tagCharm(name: string, full: string, ink: string, paper: string): Charm {
  const { keep, dispose } = bin()
  const g = new THREE.Group()
  const metal = keep(chrome())
  const glass = keep(acrylic())
  const W = 2.1
  const H = 0.78
  const tab = new THREE.Shape()
  tab.absarc(0, 0, 0.2, 0, Math.PI * 2, false)
  tab.holes.push(new THREE.Path().absarc(0, 0, 0.08, 0, Math.PI * 2, true))
  const opt = { depth: 0.1, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 4, curveSegments: 20 }
  const top = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(tab, opt)), glass)
  top.position.set(0, 0, -0.05)
  const cy = -0.1 - H / 2
  const bar = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(roundRect(W, H, 0.2), opt)), glass)
  bar.position.set(0, cy, -0.05)
  const tex = keep(
    canvasTex(1024, 330, (c, w, h) => {
      c.fillStyle = ink
      c.beginPath()
      c.roundRect(0, 0, w, h, 50)
      c.fill()
      c.fillStyle = paper
      c.textBaseline = 'middle'
      let fs = h * 0.5
      c.font = `${fs}px ${FONT}`
      while (c.measureText(name).width > w * 0.84 && fs > 30) {
        fs -= 6
        c.font = `${fs}px ${FONT}`
      }
      c.fillText(name, w * 0.08, h * 0.42)
      c.font = `600 ${h * 0.12}px ${SANS}`
      c.globalAlpha = 0.8
      c.fillText(full.toUpperCase(), w * 0.08, h * 0.78)
    }),
  )
  const print = new THREE.Mesh(keep(new THREE.PlaneGeometry(W - 0.2, H - 0.2)), keep(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 })))
  print.position.set(0, cy, 0.005)
  /* ห้อยเอียงนิด ๆ แบบป้ายในภาพอ้างอิง — หูอยู่ค่อนซ้าย */
  const body = new THREE.Group()
  bar.position.x = 0.62
  print.position.x = 0.62
  body.add(bar, print)
  /* หูอยู่มุมซ้ายบน แท่งจึงห้อยเฉียงลงขวาเพราะน้ำหนัก */
  body.rotation.z = -0.62
  g.add(top, body, jumpRing(keep, metal, 0.1))
  return { group: g, len: 1.3, dispose }
}

/**
 * สายผ้า (ภาพอ้างอิง UNIVERSE'24): สายผ้าพับครึ่งเป็นห่วง ปลายหนีบด้วยตัวหนีบพลาสติก
 * พิมพ์ชื่อบริษัทซ้ำตามความยาวสาย
 */
export function strapCharm(name: string, fabric: string, text: string, clip: string): Charm {
  const { keep, dispose } = bin()
  const g = new THREE.Group()
  const metal = keep(chrome())
  const L = 1.6
  const Wd = 0.42
  const tex = keep(
    canvasTex(160, 880, (c, w, h) => {
      c.fillStyle = fabric
      c.fillRect(0, 0, w, h)
      c.save()
      c.translate(w / 2, h / 2)
      c.rotate(Math.PI / 2)
      c.fillStyle = text
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.font = `${w * 0.56}px ${FONT}`
      c.fillText(name.toUpperCase(), 0, 4)
      c.restore()
    }),
  )
  const cloth = keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }))
  const plain = keep(new THREE.MeshStandardMaterial({ color: fabric, roughness: 0.85 }))
  const strap = keep(new THREE.BoxGeometry(Wd, L, 0.03))
  const front = new THREE.Mesh(strap, [plain, plain, plain, plain, cloth, plain])
  front.position.set(0, -0.3 - L / 2, 0.035)
  const back = new THREE.Mesh(strap, plain)
  back.position.set(0, -0.3 - L / 2 + 0.05, -0.035)
  back.rotation.x = 0.04
  /* ปลายล่างพับโค้ง */
  const bend = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.05, Wd, 20, 1, true, 0, Math.PI)), plain)
  bend.rotation.set(0, 0, Math.PI / 2)
  bend.rotation.x = Math.PI
  bend.position.set(0, -0.3 - L, 0)
  const clipM = keep(plastic(clip, { roughness: 0.3 }))
  const c = new THREE.Mesh(keep(new RoundedBoxGeometry(Wd + 0.1, 0.34, 0.2, 3, 0.05)), clipM)
  c.position.y = -0.3
  const nub = new THREE.Mesh(keep(new RoundedBoxGeometry(0.2, 0.18, 0.12, 2, 0.04)), clipM)
  nub.position.y = -0.1
  g.add(front, back, bend, c, nub, jumpRing(keep, metal))
  return { group: g, len: 0.3 + L, dispose }
}

/**
 * จี้โลโก้ JOE (ชิ้นเอกกลางพวง): แผ่นอะคริลิกฝ้าทรงแคปซูล พิมพ์ไล่สีโฮโลแกรมด้านใน
 * โลโก้จริงของเว็บ (logo-joe.svg) อัดนูนหนาสีขาวมันวางทับ · หูแขวนกลางด้านบน
 */
export function joeCharm(svg: string): Charm {
  const { keep, dispose } = bin()
  const g = new THREE.Group()
  const metal = keep(chrome())
  const glass = keep(acrylic())
  const W = 2.3
  const H = 1.0
  const cy = -0.3 - H / 2
  const opt = { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 5, curveSegments: 24 }
  const tab = new THREE.Shape()
  tab.absarc(0, 0, 0.22, 0, Math.PI * 2, false)
  tab.holes.push(new THREE.Path().absarc(0, 0, 0.085, 0, Math.PI * 2, true))
  const top = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(tab, opt)), glass)
  top.position.set(0, -0.08, -0.07)
  const plate = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(roundRect(W, H, H / 2), opt)), glass)
  plate.position.set(0, cy, -0.07)
  const tex = keep(
    canvasTex(1024, 446, (c, w, h) => {
      const lg = c.createLinearGradient(0, 0, w, h)
      lg.addColorStop(0, '#7fb2ff')
      lg.addColorStop(0.35, '#c7a8ff')
      lg.addColorStop(0.65, '#ffb3d9')
      lg.addColorStop(1, '#8ff0d8')
      c.fillStyle = lg
      c.beginPath()
      c.roundRect(0, 0, w, h, h / 2)
      c.fill()
    }),
  )
  const print = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(W - 0.22, H - 0.22)),
    keep(new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, roughness: 0.3, iridescence: 0.8, iridescenceIOR: 1.5 })),
  )
  print.position.set(0, cy, 0.0)
  const logo = new THREE.Mesh(
    keep(svgInlay(svg, W * 0.66, 0.16)),
    keep(plastic('#ffffff', { roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 })),
  )
  logo.position.set(0, cy, 0.03)
  g.add(top, plate, print, logo, jumpRing(keep, metal, 0.13))
  return { group: g, len: 0.3 + H, dispose }
}
