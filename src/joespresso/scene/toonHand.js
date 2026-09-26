import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * มือการ์ตูน 3D — ฝ่ามือหนานุ่ม นิ้วอ้วนกลมสามข้อ มีเล็บ (แบบภาพอ้างอิงมือถือจอคอม)
 *
 * GLB ให้มือมาเป็นกำปั้นกล่อง ๆ ลบเหลี่ยมยังไงก็อ่านเป็นบล็อก — ที่นี่ปั้นใหม่ทั้งมือจาก
 * แคปซูลกับกล่องมน แล้วรวมเป็นสองเมช (เนื้อ / เล็บ) มือหนึ่งข้างจึงเป็นแค่สอง draw call
 *
 * กรอบของมือ (หน่วย = รัศมีท่อแขน `r`): +Y = ทิศที่นิ้วชี้ออกไป (ต่อจากแกนแขน) · +Z = ด้าน
 * ฝ่ามือ · +X = ด้านนิ้วโป้ง — เป็นมือขวา มือซ้ายได้จากกรอบที่กลับข้าง (ดู `toonHand` ใน
 * Mascot) จุดกำเนิดอยู่ที่ข้อมือ
 *
 * นิ้วงอรอบแกน X ของแต่ละข้อ มุมบวก = งอเข้าหาฝ่ามือ
 */

/**
 * ท่ามือ — มุมงอสามข้อต่อนิ้ว เรียงนิ้วชี้ → นิ้วก้อย กับนิ้วโป้ง (ทิศโคนนิ้ว + มุมงอสองข้อ)
 *
 * - point: ชี้นิ้วเดียว อีกสามนิ้วกำ นิ้วโป้งพาดทับนิ้วที่กำ
 * - fist: กำทั้งมือ
 * - grip: กำหลวม ๆ รอบแก้ว
 * - hold: หงายมือรองของจากข้างใต้ นิ้วเกี่ยวขึ้นมาบังขอบหน้าของของที่ถือ (มือถือจอในภาพอ้างอิง)
 * - relax: มือปล่อยสบาย นิ้วงอนิด ๆ ไล่มากขึ้นไปทางนิ้วก้อย (แบบภาพอ้างอิง)
 */
const FIST = [1.45, 1.7, 1.15]
const POSES = {
  point: {
    curl: [[0.08, 0.12, 0.06], FIST, FIST, FIST],
    thumb: { dir: [-0.55, 0.55, 0.62], curl: [0.25, 0.3] },
  },
  fist: {
    curl: [FIST, FIST, FIST, FIST],
    thumb: { dir: [-0.55, 0.55, 0.62], curl: [0.25, 0.3] },
  },
  grip: {
    curl: [
      [1.05, 1.2, 0.8],
      [1.1, 1.25, 0.8],
      [1.15, 1.25, 0.85],
      [1.2, 1.3, 0.9],
    ],
    thumb: { dir: [-0.15, 0.75, 0.65], curl: [0.2, 0.25] },
  },
  hold: {
    curl: [
      [0.2, 1.2, 0.45],
      [0.18, 1.25, 0.5],
      [0.22, 1.2, 0.45],
      [0.3, 1.15, 0.4],
    ],
    thumb: { dir: [0.7, 0.6, 0.4], curl: [-0.45, -0.4] },
  },
  relax: {
    curl: [
      [0.22, 0.3, 0.2],
      [0.32, 0.38, 0.25],
      [0.42, 0.45, 0.3],
      [0.52, 0.5, 0.35],
    ],
    thumb: { dir: [0.3, 0.85, 0.45], curl: [0.12, 0.18] },
  },
}

/**
 * ทรงหมอน (superellipsoid) — กล่องที่ทุกหน้าป่องออก ไม่มีหน้าเรียบ
 *
 * กล่องมน (RoundedBox) มนแค่ที่ขอบ ด้านกว้างยังแบนเป็นแผ่น มองแล้วเป็นก้อนสบู่ ฝ่ามือการ์ตูน
 * ป่องทั้งก้อนเหมือนหมอน — ยกกำลังพิกัดของทรงกลมด้วยเลขชี้กำลัง < 1 ได้ทรงนั้นพอดี
 * (e = 1 คือทรงรี, ยิ่งเข้าใกล้ 0 ยิ่งเหลี่ยม)
 */
function pillow(w, h, d, e = 0.5) {
  const g = new THREE.SphereGeometry(1, 36, 28)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  const pos = g.attributes.position
  const f = (v) => Math.sign(v) * Math.abs(v) ** e
  for (let i = 0; i < pos.count; i += 1) {
    pos.setXYZ(i, (f(pos.getX(i)) * w) / 2, (f(pos.getY(i)) * h) / 2, (f(pos.getZ(i)) * d) / 2)
  }
  const out = mergeVertices(g)
  g.dispose()
  out.computeVertexNormals()
  return out
}

/**
 * สัดส่วนมือสองแบบ (หน่วย = รัศมีท่อแขน r)
 *
 * - toon: มืออ้วนกลมนิ้วสั้นแบบของเล่น (ภาพอ้างอิงมือชูจอ — หน้า /hand)
 * - slim: ฝ่ามือแบน นิ้วยาวเรียวกางออกนิด ๆ ข้อมือเล็ก (ภาพอ้างอิงคนหงายมือสองข้าง — ตัวละคร)
 */
const STYLES = {
  toon: { w: 3.0, l: 2.2, t: 1.5, e: 0.72, wrist: 0.86, fr: 0.36, len: [0.72, 0.52, 0.44], thumbR: 0.44, thumbLen: [0.75, 0.58], spread: 0 },
  slim: { w: 2.5, l: 2.2, t: 0.95, e: 0.62, wrist: 0.62, fr: 0.22, len: [0.95, 0.68, 0.55], thumbR: 0.28, thumbLen: [0.85, 0.62], spread: 0.1 },
}

/**
 * @param {number} r รัศมีท่อแขน — ทุกขนาดของมืออิงค่านี้
 * @param {'point'|'fist'|'grip'|'hold'|'relax'} pose
 * @param {'toon'|'slim'} style
 * @param {number} [wristR] รัศมีลูกกลมข้อมือ (ค่าจริง ไม่ใช่หน่วย r) — ให้เท่าปลายท่อแขนพอดี
 * @returns {{ skin: THREE.BufferGeometry, nail: THREE.BufferGeometry, grip: THREE.Vector3 }}
 */
export function buildToonHand(r, pose = 'fist', style = 'toon', wristR = 0) {
  const P = POSES[pose] ?? POSES.fist
  const S = STYLES[style] ?? STYLES.toon
  const skin = []
  const nail = []
  const put = (list, geo, m) => {
    geo.applyMatrix4(m)
    list.push(geo)
  }

  /* ฝ่ามือ: กว้างเกือบเท่าครึ่งของความหนาแขน (มือการ์ตูนใหญ่เกินจริง) ป่องแบบหมอน */
  const w = S.w * r
  const l = S.l * r
  const t = S.t * r
  const palmY = 0.05 * r + l / 2
  put(skin, pillow(w, l, t, S.e), new THREE.Matrix4().makeTranslation(0, palmY, 0))
  /* ข้อมือ: ลูกกลมรับปลายท่อแขน ให้ท่อไหลเข้าฝ่ามือไม่มีขอบ */
  put(skin, new THREE.SphereGeometry(wristR || r * S.wrist, 20, 14), new THREE.Matrix4())

  /**
   * นิ้วหนึ่งนิ้ว = ท่อเส้นเดียวตามเส้นโค้งที่ลากผ่านข้อต่อ ปลายปิดด้วยครึ่งทรงกลม
   *
   * เดิมต่อแคปซูลทีละข้อ รัศมีเรียวลงข้อละนิด ผิวของสองข้อจึงตัดกันเป็นมุมตื้น ๆ ตรงข้อ
   * บนจอเห็นเป็นเส้นหยักฟันเลื่อยทุกข้อนิ้ว — ท่อเส้นเดียวไม่มีผิวซ้อน ข้อนิ้วงอโค้งเนียนเอง
   */
  const chain = (base, lens, curls, rad, nailSide = -1) => {
    const m = base.clone()
    const tmp = new THREE.Matrix4()
    const pts = [new THREE.Vector3(0, -rad * 0.6, 0).applyMatrix4(m)]
    let last = m.clone()
    let lastLen = lens[lens.length - 1]
    lens.forEach((len, i) => {
      m.multiply(tmp.makeRotationX(curls[i] ?? 0))
      if (i === 0) pts.push(new THREE.Vector3().setFromMatrixPosition(m))
      last = m.clone()
      lastLen = len
      m.multiply(tmp.makeTranslation(0, len, 0))
      pts.push(new THREE.Vector3().setFromMatrixPosition(m))
    })
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    put(skin, new THREE.TubeGeometry(curve, 28, rad, 16, false), new THREE.Matrix4())
    /* ปลายนิ้วมน: ทรงกลมรัศมีเดียวกับท่อ ที่ปลายเส้นโค้ง (ต่อแบบสัมผัสกัน ไม่ใช่ตัดกัน) */
    put(skin, new THREE.SphereGeometry(rad, 16, 12), new THREE.Matrix4().setPosition(pts[pts.length - 1]))
    /* เล็บ: จานรีบาง ๆ บนหลังข้อปลาย ใกล้ปลายนิ้ว */
    const nm = last
      .clone()
      .multiply(tmp.makeTranslation(0, lastLen * 0.72, nailSide * rad * 0.88))
      .multiply(new THREE.Matrix4().makeScale(rad * 0.66, rad * 0.8, rad * 0.3))
    put(nail, new THREE.SphereGeometry(1, 14, 10), nm)
  }

  /* สี่นิ้ว: อ้วนจนชิดกัน (แบบการ์ตูน) — นิ้วชี้อยู่ฝั่ง +X ติดนิ้วโป้ง */
  const fr = S.fr * r
  const step = (w - 2 * fr) / 3
  const LEN = S.len.map((v) => v * r)
  const SCALE = [0.95, 1, 0.94, 0.78]
  const knuckleY = palmY + l / 2 - 0.34 * r
  for (let i = 0; i < 4; i += 1) {
    const x = w / 2 - fr - step * i
    const y = knuckleY - (i === 3 ? 0.14 * r : i === 0 ? 0.04 * r : 0)
    /* โคนนิ้วค่อนไปทางหลังมือ แบบมือจริง — นิ้วที่กำจึงพับลงมาเป็นหน้ากำปั้น ไม่มุดหายหลังฝ่ามือ */
    /* กางนิ้วเป็นพัด: นิ้วชี้เอียงไปทางนิ้วโป้ง นิ้วก้อยเอียงออกอีกข้าง */
    const base = new THREE.Matrix4()
      .makeTranslation(x, y, -0.18 * r)
      .multiply(new THREE.Matrix4().makeRotationZ(-(1.5 - i) * S.spread))
    chain(
      base,
      LEN.map((v) => v * SCALE[i]),
      P.curl[i],
      fr * (i === 3 ? 0.9 : 1),
    )
  }

  /* นิ้วโป้ง: โคนที่สันมือฝั่ง +X ค่อนมาทางฝ่ามือ สองข้อ อ้วนกว่านิ้วอื่น */
  const td = new THREE.Vector3(...P.thumb.dir).normalize()
  const tz = new THREE.Vector3(0, 0, 1).addScaledVector(td, -td.z).normalize()
  const tx = new THREE.Vector3().crossVectors(td, tz)
  const tb = new THREE.Matrix4()
    .makeBasis(tx, td, tz)
    .setPosition(w / 2 - 0.45 * r, palmY - l * 0.2, t * 0.2)
  const tk = S.thumbR / STYLES.toon.thumbR
  /* เนินโคนนิ้วโป้ง — ก้อนรีที่โคน ให้นิ้วโป้งงอกออกจากฝ่ามือ ไม่ใช่ไส้กรอกแปะข้างมือ */
  put(
    skin,
    new THREE.SphereGeometry(1, 20, 14),
    /* วางในกรอบของมือ ไม่ใช่กรอบนิ้วโป้ง — ท่ากำนิ้วโป้งพับข้ามฝ่ามือ ก้อนที่หมุนตามจะโผล่พ้นสันมือ */
    new THREE.Matrix4()
      .makeTranslation(w / 2 - 0.62 * r, palmY - l * 0.22, t * 0.16)
      .multiply(new THREE.Matrix4().makeScale(0.55 * tk * r, 0.75 * tk * r, 0.5 * tk * r)),
  )
  /* หลังนิ้วโป้งหันออกนอกฝ่ามือ (+Z) เล็บจึงอยู่ด้าน +Z ของกรอบนิ้ว — ต่างจากนิ้วอื่น */
  chain(tb, S.thumbLen.map((v) => v * r), P.thumb.curl.map((c) => -c), S.thumbR * r, 1)

  /* จุดจับของ: กลางวงนิ้วที่งอ เยื้องมาทางฝ่ามือ */
  const grip = new THREE.Vector3(0, knuckleY + 0.1 * r, t / 2 + 0.5 * r)

  const merge = (list) => {
    /* เก็บแค่ตำแหน่งกับ normal — ทรงหมอนไม่มี uv และเนื้อ/เล็บเป็นสีล้วน ไม่ใช้ uv อยู่แล้ว */
    const clean = list.map((g) => {
      const n = g.index ? g.toNonIndexed() : g
      for (const k of Object.keys(n.attributes)) {
        if (k !== 'position' && k !== 'normal') n.deleteAttribute(k)
      }
      if (n !== g) g.dispose()
      return n
    })
    const out = mergeGeometries(clean, false)
    clean.forEach((g) => g.dispose())
    out.computeBoundingBox()
    out.computeBoundingSphere()
    return out
  }
  return { skin: merge(skin), nail: merge(nail), grip }
}
