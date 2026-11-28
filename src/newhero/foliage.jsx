import * as THREE from 'three'

/**
 * ของประดับของฉากในพอร์ทัล — พุ่ม/ต้นสน/ต้นพุ่ม/เห็ด/ตอ/ดอกไม้/เบอร์รี่/กรวด
 *
 * เดิมชิ้นพวกนี้เขียนอยู่ใน Globe.jsx ตัวเดียว พอทิวทัศน์ (Landscape) ต้องการของชุดเดียวกัน
 * จึงย้ายออกมาเป็นชิ้นส่วนกลาง — ก๊อบ JSX ไปอีกไฟล์แล้ววันหนึ่งจะแก้สีที่เดียวแล้วอีกฉาก
 * ไม่ตาม
 *
 * geometry กับ material อยู่ระดับโมดูล ใช้ร่วมกันทุกชิ้นทุกฉาก:
 * ของพวกนี้หน้าตาเหมือนกันหมด ต่างกันแค่ scale/ตำแหน่ง การสร้างแยกชิ้นคือจ่าย GPU buffer
 * กับ shader program เปล่า ๆ — และห้าม dispose ด้วยเหตุผลเดียวกัน (ยังมีคนอื่นใช้อยู่)
 */

export const FOLIAGE_COL = {
  ground: '#b39cf7',
  path: '#cbbcff',
  stripe: '#dccfff',
  grass: ['#22b47a', '#18996a', '#3dd08f', '#2fbf86'],
  lime: '#8ae23c',
  teal: '#3ecfaa',
  trunk: '#9fd0f2',
  cap: '#9b7cf4',
  stem: '#7c63d9',
  stump: '#5b63f0',
  stumpTop: '#7d86ff',
  white: '#fff8ee',
  yellow: '#ffd23f',
  berry: '#f0567a',
  pebble: '#d7c9ff',
}

/**
 * ความละเอียดของทรงพื้นฐาน — ต่ำโดยตั้งใจ
 *
 * ของพวกนี้ถูกใช้ซ้ำหลักร้อยชิ้นในทุ่ง (พุ่ม/ใบไม้/ลำต้น) และแต่ละชิ้นกินพื้นที่จอไม่กี่สิบพิกเซล
 * ลูกกลม 40x28 = 2160 สามเหลี่ยม/ชิ้น ซึ่งที่ขนาดเท่านั้นตาแยกไม่ออกจาก 18x12 (~400)
 * แต่ต่างกันหลักแสนสามเหลี่ยมต่อเฟรมเมื่อคูณจำนวนชิ้นจริง
 */
export const SPHERE = new THREE.SphereGeometry(1, 18, 12)
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 10)

const mat = (color, rough = 0.55) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })

export const FOLIAGE_MATS = {
  grass: FOLIAGE_COL.grass.map((c) => mat(c)),
  lime: mat(FOLIAGE_COL.lime),
  teal: mat(FOLIAGE_COL.teal, 0.35),
  /** เฉดใบไม้สำรอง — ต้นไม้ทั้งทุ่งสีเดียวกันเป๊ะอ่านเป็นของก๊อบวาง */
  leaves: [mat('#8ae23c'), mat('#a9ea5c'), mat('#6fce38'), mat('#3ecfaa', 0.35), mat('#59e0bd', 0.35), mat('#2bb894', 0.35)],
  trunk: mat(FOLIAGE_COL.trunk),
  cap: mat(FOLIAGE_COL.cap, 0.35),
  stem: mat(FOLIAGE_COL.stem),
  stump: mat(FOLIAGE_COL.stump),
  stumpTop: mat(FOLIAGE_COL.stumpTop),
  white: mat(FOLIAGE_COL.white),
  yellow: mat(FOLIAGE_COL.yellow),
  berry: mat(FOLIAGE_COL.berry, 0.35),
  pebble: mat(FOLIAGE_COL.pebble),
}

/**
 * ผังชิ้นส่วนของของประดับแต่ละชนิด — แหล่งความจริงเดียวของทั้งรูปทรงและการวาด
 *
 * ทุกชิ้นคือลูกกลมหรือทรงกระบอกที่ถูกเลื่อน/ย่อ ผังนี้จึงเก็บได้เป็นข้อมูลล้วน ๆ แล้วมีสองทาง
 * ที่เอาไปวาด: `FoliageProp` (mesh ต่อชิ้น ใช้ในฉากที่ของมีไม่กี่ชิ้น) กับ InstancedMesh
 * ของทุ่งใน Landscape (ของหลักร้อยชิ้น) — ถ้าปั้นรูปทรงแยกกันสองที่ วันหนึ่งจะแก้ที่เดียว
 * แล้วอีกฉากไม่ตาม ซึ่งเคยเกิดมาแล้วตอนแยก Globe กับ Landscape
 *
 * หน่วยทั้งหมดเป็นสัดส่วนของ s (ขนาดของชิ้นนั้น) จุดกำเนิดอยู่ที่โคน ไม่ใช่กลางก้อน —
 * ผู้เรียกวางของบนผิวได้โดยไม่ต้องรู้ความสูงของแต่ละชนิด
 *
 * mat: ชื่อวัสดุใน FOLIAGE_MATS · 'item' = สีเฉพาะชิ้น (ผู้เรียกส่งมา) · 'center' = เกสร
 * ซึ่งสีขึ้นกับสีกลีบ · squashY = คูณแกน y ด้วยค่า squash ของชิ้นนั้น
 */
const petals = [0, 1, 2, 3, 4].map((k) => {
  const a = (k / 5) * Math.PI * 2
  return { geo: 's', mat: 'item', fallback: 'white', pos: [Math.cos(a) * 0.55, 1.8, Math.sin(a) * 0.55], scale: [0.36, 0.16, 0.36] }
})

export const LUMPS = {
  bush: [{ geo: 's', mat: 'item', fallback: 'grass0', pos: [0, 0, 0], scale: [1, 1, 1], squashY: true }],
  cone: [
    { geo: 'c', mat: 'trunk', pos: [0, 0.2, 0], scale: [0.12, 0.5, 0.12] },
    // ลูกกลมสามชั้นซ้อนขึ้นไป เล็กลงเรื่อย ๆ = ต้นสนแบบการ์ตูน
    { geo: 's', mat: 'item', fallback: 'lime', pos: [0, 0.55, 0], scale: [0.5, 0.36, 0.5] },
    { geo: 's', mat: 'item', fallback: 'lime', pos: [0, 0.98, 0], scale: [0.4, 0.32, 0.4] },
    { geo: 's', mat: 'item', fallback: 'lime', pos: [0, 1.36, 0], scale: [0.28, 0.28, 0.28] },
  ],
  round: [
    { geo: 'c', mat: 'trunk', pos: [0, 0.35, 0], scale: [0.1, 0.8, 0.1] },
    { geo: 's', mat: 'item', fallback: 'teal', pos: [0, 0.95, 0], scale: [0.55, 0.42, 0.55] },
    { geo: 's', mat: 'item', fallback: 'teal', pos: [0.22, 1.15, 0.1], scale: [0.32, 0.32, 0.32] },
    { geo: 's', mat: 'item', fallback: 'teal', pos: [-0.24, 1.1, -0.08], scale: [0.28, 0.28, 0.28] },
  ],
  mushroom: [
    { geo: 'c', mat: 'stem', pos: [0, 0.3, 0], scale: [0.22, 0.65, 0.22] },
    // หมวกเห็ด = ทรงกลมกดแบน
    { geo: 's', mat: 'cap', pos: [0, 0.6, 0], scale: [0.62, 0.34, 0.62] },
  ],
  stump: [
    { geo: 'c', mat: 'stump', pos: [0, 0.5, 0], scale: [0.55, 1, 0.55] },
    { geo: 'c', mat: 'stumpTop', pos: [0, 1.0, 0], scale: [0.5, 0.04, 0.5] },
  ],
  flower: [
    { geo: 'c', mat: 'grass0', pos: [0, 0.9, 0], scale: [0.08, 1.8, 0.08] },
    ...petals,
    { geo: 's', mat: 'center', pos: [0, 1.85, 0], scale: [0.24, 0.24, 0.24] },
  ],
  berry: [
    { geo: 'c', mat: 'grass1', pos: [0, 1.2, 0], scale: [0.08, 2.4, 0.08] },
    ...[[0, 2.4, 0], [0.5, 2.0, 0.2], [-0.45, 1.7, -0.2], [0.3, 1.3, -0.4]].map((o) => ({
      geo: 's',
      mat: 'berry',
      pos: o,
      scale: [0.3, 0.3, 0.3],
    })),
  ],
  pebble: [{ geo: 's', mat: 'pebble', pos: [0, 0, 0], scale: [1, 0.5, 1.6] }],
}

/** วัสดุจริงของชิ้นส่วนหนึ่ง — 'item' ใช้สีที่ผู้เรียกส่งมา, 'center' ล้อสีกลีบ */
export function lumpMaterial(l, m) {
  const M = FOLIAGE_MATS
  if (l.mat === 'item') return m ?? (l.fallback === 'grass0' ? M.grass[0] : M[l.fallback])
  if (l.mat === 'center') return (m ?? M.white) === M.white ? M.yellow : M.berry
  if (l.mat === 'grass0') return M.grass[0]
  if (l.mat === 'grass1') return M.grass[1]
  return M[l.mat]
}

/**
 * ของประดับหนึ่งชิ้น (mesh ต่อชิ้นส่วน) — ใช้ในฉากที่ของมีไม่กี่ชิ้น
 *
 * ทุ่งใน Landscape ไม่ได้ใช้ทางนี้: ของหลักร้อยชิ้น × ชิ้นส่วนละ mesh = draw call หลักร้อย
 * ที่นั่นอ่านผัง LUMPS ชุดเดียวกันนี้ไปทำ InstancedMesh แทน
 */
export function FoliageProp({ kind, s = 1, mat: m, squash = 0.7 }) {
  const lumps = LUMPS[kind]
  if (!lumps) return null
  return lumps.map((l, i) => (
    <mesh
      key={i}
      geometry={l.geo === 's' ? SPHERE : CYL}
      material={lumpMaterial(l, m)}
      position={[l.pos[0] * s, l.pos[1] * s, l.pos[2] * s]}
      scale={[l.scale[0] * s, l.scale[1] * s * (l.squashY ? squash : 1), l.scale[2] * s]}
    />
  ))
}
