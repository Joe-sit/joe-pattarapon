import * as THREE from 'three'

/**
 * แขนจากโมเดล cartoon lumberjack — ตัดออกมาจากตัวละครทั้งตัว
 *
 * ไฟล์ต้นทางเป็นตัวละครที่ผูกกระดูกไว้ทั้งตัวใน mesh เดียว ไม่มีชิ้น "แขน" แยกให้หยิบ
 * สิ่งที่บอกว่าเนื้อตรงไหนเป็นแขนคือ "น้ำหนักผูกกระดูก" (skin weights) ของแต่ละจุดยอด
 * จึงตัดจากตรงนั้น: จุดยอดเป็นของกระดูกที่มีน้ำหนักมากสุด แล้วสามเหลี่ยมเป็นของกลุ่มที่
 * จุดยอดส่วนใหญ่สังกัด (เสียงข้างมาก ไม่ใช่ต้องครบสามจุด — รอยต่อระหว่างท่อนจะได้ไม่หาย
 * เป็นรูตามแนวข้อ)
 *
 * ผลลัพธ์เป็น geometry นิ่ง (ไม่มีกระดูกติดมา) ในสเปซของข้อนั้น ๆ หันปลายไปทาง -Y และ
 * ยาว 1 หน่วย เพราะริกของ mascot วางแขนเป็นลูกโซ่ที่ยืดลงตามแกน -Y เหมือนกันทุกท่อน
 * ผู้เรียกจึงคูณด้วยความยาวท่อนของตัวเองได้ตรง ๆ โดยไม่ต้องรู้สัดส่วนของโมเดลต้นทาง
 */

export const LUMBER_MODEL = '/models/cartoon-lumberjack-arms.glb'

/** ชื่อกระดูกในไฟล์ (Rigify): DEF-upper_arm.L_022 ฯลฯ — เทียบด้วย prefix เพราะมีเลขต่อท้าย */
const CHAIN = [
  { part: 'upper', bone: 'DEF-upper_arm', tip: 'DEF-forearm' },
  { part: 'fore', bone: 'DEF-forearm', tip: 'DEF-hand' },
  { part: 'hand', bone: 'DEF-hand', tip: 'DEF-f_middle.02' },
]
/** นิ้วนับเป็นส่วนหนึ่งของมือ — ไม่มีข้อนิ้วให้ริกนี้ขยับอยู่แล้ว */
const HAND_EXTRA = ['DEF-f_', 'DEF-thumb']

const nameOf = (b) => b.name || ''
const isBone = (b, prefix, side) => nameOf(b).startsWith(`${prefix}.${side}`)

/** กระดูกที่นับเป็นกลุ่มนี้ (คืนเป็นเซ็ตของ index ใน skeleton) */
function groupIndices(bones, part, side) {
  const set = new Set()
  bones.forEach((b, i) => {
    const n = nameOf(b)
    if (part === 'hand') {
      if (isBone(b, 'DEF-hand', side) || HAND_EXTRA.some((p) => n.startsWith(p) && n.includes(`.${side}`))) set.add(i)
      return
    }
    const spec = CHAIN.find((c) => c.part === part)
    if (isBone(b, spec.bone, side)) set.add(i)
  })
  return set
}

/** ดัชนีกระดูกตัวแรกที่ชื่อขึ้นต้นด้วย prefix ของข้างนั้น */
function findBone(bones, prefix, side) {
  return bones.findIndex((b) => isBone(b, prefix, side))
}

/**
 * ตัดสามเหลี่ยมของกลุ่มหนึ่งออกมาเป็น geometry ใหม่
 *
 * ใช้ตำแหน่งดิบของ mesh ได้เลยเพราะโมเดลอยู่ในท่า bind (สกินยังไม่ถูกขยับ) จากนั้นแปลง
 * เข้าสเปซของกระดูกด้วย boneInverse ของข้อนั้น — ค่านี้คือ "เมทริกซ์ผกผันของท่า bind"
 * ซึ่งมีอยู่แล้วในไฟล์ ไม่ต้องคำนวณเอง
 */
function cutPart(mesh, owner, groups, boneInverse) {
  const pos = mesh.geometry.attributes.position
  const nor = mesh.geometry.attributes.normal
  const idx = mesh.geometry.index
  const count = idx ? idx.count : pos.count
  const P = []
  const N = []
  const v = new THREE.Vector3()
  const nrm = new THREE.Matrix3().getNormalMatrix(boneInverse)
  for (let t = 0; t < count; t += 3) {
    const a = idx ? idx.getX(t) : t
    const b = idx ? idx.getX(t + 1) : t + 1
    const c = idx ? idx.getX(t + 2) : t + 2
    let hit = 0
    for (const vi of [a, b, c]) if (groups.has(owner[vi])) hit += 1
    if (hit < 2) continue
    for (const vi of [a, b, c]) {
      v.fromBufferAttribute(pos, vi).applyMatrix4(boneInverse)
      P.push(v.x, v.y, v.z)
      v.fromBufferAttribute(nor, vi).applyMatrix3(nrm).normalize()
      N.push(v.x, v.y, v.z)
    }
  }
  if (!P.length) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  return g
}

/**
 * ตัดแขนทั้งสองข้างออกจากฉากของโมเดล
 *
 * คืน { L, R } แต่ละข้างมี upper/fore/hand เป็น geometry หันปลายไป -Y ยาว 1 หน่วย
 */
export function extractLumberArms(scene) {
  let mesh = null
  scene.traverse((o) => {
    if (!mesh && o.isSkinnedMesh) mesh = o
  })
  if (!mesh) return null
  const bones = mesh.skeleton.bones
  const inverses = mesh.skeleton.boneInverses
  const skinIndex = mesh.geometry.attributes.skinIndex
  const skinWeight = mesh.geometry.attributes.skinWeight

  /** กระดูกเจ้าของจุดยอด = ตัวที่มีน้ำหนักมากที่สุด */
  const owner = new Int32Array(skinIndex.count)
  for (let i = 0; i < skinIndex.count; i++) {
    let best = -1
    let bestW = -1
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k)
      if (w > bestW) {
        bestW = w
        best = skinIndex.getComponent(i, k)
      }
    }
    owner[i] = best
  }

  const out = {}
  const up = new THREE.Vector3(0, -1, 0)
  for (const side of ['L', 'R']) {
    const parts = {}
    for (const spec of CHAIN) {
      const rootIdx = findBone(bones, spec.bone, side)
      const tipIdx = findBone(bones, spec.tip, side)
      if (rootIdx < 0 || tipIdx < 0) continue
      const geo = cutPart(mesh, owner, groupIndices(bones, spec.part, side), inverses[rootIdx])
      if (!geo) continue
      /**
       * แกนของท่อน = ทิศจากข้อนี้ไปข้อถัดไป วัดในสเปซของข้อนี้เอง
       * (เอาตำแหน่ง bind ของข้อถัดไป มาแปลงด้วย boneInverse ของข้อนี้)
       */
      const tip = new THREE.Vector3()
        .setFromMatrixPosition(new THREE.Matrix4().copy(inverses[tipIdx]).invert())
        .applyMatrix4(inverses[rootIdx])
      const len = tip.length() || 1
      const q = new THREE.Quaternion().setFromUnitVectors(tip.clone().normalize(), up)
      // หมุนให้แกนท่อนชี้ลง -Y แล้วย่อให้ยาวหนึ่งหน่วย — ริกปลายทางคูณความยาวของตัวเองเอง
      geo.applyQuaternion(q)
      geo.scale(1 / len, 1 / len, 1 / len)
      geo.computeBoundingBox()
      parts[spec.part] = geo
    }
    out[side] = parts
  }
  return out
}
