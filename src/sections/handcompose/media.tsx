import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

/**
 * สื่อบันทึกข้อมูลสามชิ้น — สกิลละหนึ่งชิ้น (CD / Floppy / USB) ที่ถูกเสียบเข้าจอ CRT ตามลำดับเล่า
 *
 * ทุกชิ้นปั้นในกรอบเดียวกัน: แกน z = ด้านหน้า (หันเข้ากล้องตอนโชว์) · แกน +y = ขอบที่เสียบเข้าช่อง
 * — ท่าตอนเสียบจึงคิดสูตรเดียวใช้ได้ทุกชิ้น (ดู Media ใน HandScene)
 *
 * `fit` = ย่อเหลือเท่าไรตอนเข้าช่อง (ความกว้างชิ้น → ความกว้างช่องบนคางจอ)
 */
export type MediaKind = 'cd' | 'floppy' | 'usb'

export type MediaBuild = {
  group: THREE.Group
  fit: number
  dispose: () => void
}

const phys = (p: THREE.MeshPhysicalMaterialParameters) =>
  new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.3, ...p })

/** แผ่นป้ายชื่อบนสื่อ — ตัวหนังสือจริงของสกิลนั้น */
function labelTex(title: string, color: string, w: number, h: number, round = false) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (g) {
    if (round) {
      g.beginPath()
      g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2)
      g.arc(w / 2, h / 2, w * 0.2, 0, Math.PI * 2, true)
      g.fillStyle = '#ffffff'
      g.fill()
      g.fillStyle = color
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `700 ${w * 0.11}px 'Mona Sans', system-ui, sans-serif`
      g.fillText(title.toUpperCase(), w / 2, h * 0.3)
      g.fillStyle = 'rgba(0,0,0,0.25)'
      g.fillRect(w * 0.22, h * 0.72, w * 0.56, h * 0.012)
      g.fillRect(w * 0.28, h * 0.77, w * 0.44, h * 0.012)
    } else {
      g.fillStyle = '#fbfaf6'
      g.beginPath()
      g.roundRect(0, 0, w, h, h * 0.08)
      g.fill()
      g.fillStyle = color
      g.fillRect(0, 0, w, h * 0.16)
      g.fillStyle = '#1b2240'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      /* ย่อตัวอักษรจนพอดีป้าย — ป้าย USB แคบ คำยาวแล้วล้นขอบ */
      let fs = h * 0.24
      g.font = `700 ${fs}px 'Mona Sans', system-ui, sans-serif`
      while (g.measureText(title.toUpperCase()).width > w * 0.84 && fs > 12) {
        fs -= 4
        g.font = `700 ${fs}px 'Mona Sans', system-ui, sans-serif`
      }
      g.fillText(title.toUpperCase(), w / 2, h * 0.52)
      g.fillStyle = 'rgba(0,0,0,0.18)'
      for (let i = 0; i < 2; i += 1) g.fillRect(w * 0.12, h * (0.74 + i * 0.1), w * 0.76, h * 0.025)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** CD: แผ่นเงินสะท้อนรุ้ง (iridescence) รูกลาง ป้ายวงแหวนด้านหน้า */
function cd(title: string, color: string): MediaBuild {
  const R = 0.95
  /* แผ่นวงแหวนจริง (รูกลางทะลุ) — extrude รูปวงกลมที่เจาะรู ขอบมนนิด ๆ */
  const shape = new THREE.Shape().absarc(0, 0, R, 0, Math.PI * 2, false)
  shape.holes.push(new THREE.Path().absarc(0, 0, 0.15, 0, Math.PI * 2, true))
  const disc = new THREE.ExtrudeGeometry(shape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 96,
  })
  disc.translate(0, 0, -0.01)
  const hub = new THREE.RingGeometry(0.15, 0.34, 64)
  const labelG = new THREE.RingGeometry(0.34, R * 0.97, 96)
  /* uv ของ RingGeometry เป็นพิกัดระนาบ 0..1 อยู่แล้ว — ป้ายวงกลมทั้งใบลงพอดี */
  const silver = phys({
    color: '#dfe3ea',
    metalness: 1,
    roughness: 0.12,
    iridescence: 1,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [180, 620],
  })
  const clear = phys({ color: '#eef2f7', roughness: 0.2, transparent: true, opacity: 0.55 })
  const lt = labelTex(title, color, 1024, 1024, true)
  const label = phys({ map: lt, roughness: 0.5, transparent: true })
  const group = new THREE.Group()
  const d = new THREE.Mesh(disc, silver)
  const h = new THREE.Mesh(hub, clear)
  h.position.z = 0.02
  /* ด้านหลังเงินล้วน ด้านหน้าเป็นป้าย — หมุนโชว์แล้วเห็นรุ้งสลับกับป้าย */
  const lab = new THREE.Mesh(labelG, label)
  lab.position.z = 0.0195
  group.add(d, lab, h)
  return {
    group,
    fit: 0.4 / (R * 2),
    dispose: () => {
      ;[disc, hub, labelG].forEach((g) => g.dispose())
      ;[silver, clear, label].forEach((m) => m.dispose())
      lt.dispose()
    },
  }
}

/** Floppy 3.5": ตัวพลาสติกสีสกิล ชัตเตอร์เหล็กด้านบน (ขอบที่เสียบ) ป้ายกระดาษด้านล่าง */
function floppy(title: string, color: string): MediaBuild {
  const S = 1.6
  const body = new RoundedBoxGeometry(S, S, 0.09, 4, 0.03)
  const shutter = new RoundedBoxGeometry(S * 0.5, S * 0.36, 0.1, 3, 0.012)
  const window = new RoundedBoxGeometry(S * 0.12, S * 0.24, 0.11, 2, 0.01)
  const labelG = new THREE.PlaneGeometry(S * 0.78, S * 0.5)
  const hub = new THREE.CylinderGeometry(S * 0.12, S * 0.12, 0.1, 40)
  hub.rotateX(Math.PI / 2)
  const plastic = phys({ color, roughness: 0.4 })
  const metal = phys({ color: '#c9cdd3', metalness: 0.9, roughness: 0.25 })
  const dark = phys({ color: '#1d2233', roughness: 0.6 })
  const lt = labelTex(title, color, 1024, 660)
  const label = phys({ map: lt, roughness: 0.7 })
  const group = new THREE.Group()
  const b = new THREE.Mesh(body, plastic)
  const sh = new THREE.Mesh(shutter, metal)
  sh.position.set(S * 0.05, S * 0.3, 0)
  const wn = new THREE.Mesh(window, dark)
  wn.position.set(S * 0.12, S * 0.32, 0)
  const lab = new THREE.Mesh(labelG, label)
  lab.position.set(0, -S * 0.2, 0.047)
  const hb = new THREE.Mesh(hub, metal)
  hb.position.set(0, 0, -0.01)
  hb.scale.set(1, 1, 0.9)
  group.add(b, sh, wn, lab, hb)
  return {
    group,
    fit: 0.4 / S,
    dispose: () => {
      ;[body, shutter, window, labelG, hub].forEach((g) => g.dispose())
      ;[plastic, metal, dark, label].forEach((m) => m.dispose())
      lt.dispose()
    },
  }
}

/** USB: ตัวแฟลชไดรฟ์สีสกิล หัวเหล็กสี่เหลี่ยมด้านบน (ขอบที่เสียบ) รูหน้าสัมผัสสองช่อง */
function usb(title: string, color: string): MediaBuild {
  const body = new RoundedBoxGeometry(0.62, 1.35, 0.26, 5, 0.1)
  const cap = new RoundedBoxGeometry(0.42, 0.5, 0.15, 2, 0.02)
  const pin = new RoundedBoxGeometry(0.1, 0.1, 0.02, 1, 0.01)
  const ring = new THREE.TorusGeometry(0.07, 0.022, 12, 32)
  const labelG = new THREE.PlaneGeometry(0.46, 0.7)
  const plastic = phys({ color, roughness: 0.3 })
  const metal = phys({ color: '#d7dbe0', metalness: 1, roughness: 0.18 })
  const dark = phys({ color: '#20242d', roughness: 0.5 })
  const lt = labelTex(title, color, 460, 700)
  const label = phys({ map: lt, roughness: 0.6 })
  const group = new THREE.Group()
  const b = new THREE.Mesh(body, plastic)
  b.position.y = -0.2
  const c = new THREE.Mesh(cap, metal)
  c.position.y = 0.72
  const p1 = new THREE.Mesh(pin, dark)
  p1.position.set(-0.09, 0.78, 0.076)
  const p2 = new THREE.Mesh(pin, dark)
  p2.position.set(0.09, 0.78, 0.076)
  const r = new THREE.Mesh(ring, metal)
  r.position.set(0, -0.74, 0)
  const lab = new THREE.Mesh(labelG, label)
  lab.position.set(0, -0.2, 0.131)
  group.add(b, c, p1, p2, r, lab)
  return {
    group,
    fit: 0.34 / 0.62,
    dispose: () => {
      ;[body, cap, pin, ring, labelG].forEach((g) => g.dispose())
      ;[plastic, metal, dark, label].forEach((m) => m.dispose())
      lt.dispose()
    },
  }
}

export function buildMedia(kind: MediaKind, title: string, color: string): MediaBuild {
  if (kind === 'cd') return cd(title, color)
  if (kind === 'floppy') return floppy(title, color)
  return usb(title, color)
}
