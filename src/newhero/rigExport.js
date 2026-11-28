import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import { listRigs } from '@/joespresso/scene/rigHandle'

/**
 * ส่งตัวละครออกเป็นไฟล์ให้ Mixamo — เครื่องมือ dev อย่างเดียว
 *
 * ### ทำไมต้องยุบเป็นเมชเดียว
 *
 * ตัวละครนี้ไม่ใช่โมเดลที่มีกระดูก: `mascot.glb` มี 39 เมช 91 โนด **ไม่มี skin ไม่มี
 * animation** เลย ท่าทางทุกท่าเกิดจากโค้ดหมุนกลุ่มของชิ้นส่วน (ไหล่/ศอก/ข้อมือ/สะโพก/เข่า)
 * แล้วขายังถูกปั้นเพิ่มในโค้ดอีกชุด ไฟล์ต้นฉบับจึงไม่ใช่สิ่งที่อัปโหลดได้ — มันไม่มีท่าที่เห็นบนจอ
 * อยู่ในตัว และ Mixamo ก็ไม่รับ glTF ด้วย (รับ FBX / OBJ / ZIP)
 *
 * ตัวจัดริกอัตโนมัติของ Mixamo ต้องการ **เมชเดียว** ต่อไฟล์ ที่นี่จึงเดินทั้งกลุ่ม อบ
 * matrixWorld ลงจุดยอด (ท่าที่เห็นกลายเป็นรูปทรงจริง) แล้วต่อทุกชิ้นเป็นก้อนเดียว
 *
 * ชิ้นส่วนที่ลอยแยกกัน (ผม ตา รองเท้า) ไม่ต้องเชื่อมกับตัว — ตัวจัดริกให้น้ำหนักตามกระดูก
 * ที่ใกล้ที่สุด ซึ่งกับตัวละครทรงบล็อกแบบนี้ได้ผลตามที่ควรเป็น
 *
 * ### ข้อที่ต้องรู้ก่อนอัปโหลด
 *
 * - ท่าที่ส่งออกคือ "ท่าที่เห็นบนจอตอนกดปุ่ม" — ต้องจัดเป็นท่า T หรือ A ก่อน (ปุ่ม "ท่า T"
 *   ในแผงจูนตั้งค่าให้ทั้งชุด) ท่าสเก็ตที่ย่อเข่าลึกจัดริกไม่ผ่าน
 * - แกนของ OBJ คือแกนของ three (Y ขึ้น) ตรงกับที่ Mixamo คาดไว้
 * - ไฟล์ไม่มีสี OBJExporter ของ three ไม่เขียน .mtl และตัวจัดริกไม่ใช้สีอยู่แล้ว สีของตัวละคร
 *   ยังมาจากโค้ดเหมือนเดิม
 */

/** จำนวนเมชที่คาดว่าจะเจอในริกหนึ่งตัว ใช้เตือนเวลาส่งออกได้น้อยผิดปกติ (ตัวเปล่ายังไม่โหลด) */
const MIN_PARTS = 8

/**
 * ยุบทุกชิ้นใต้กลุ่มเป็นเรขาคณิตก้อนเดียว ในสเปซของกลุ่มเอง
 *
 * อบ matrix เทียบกับ `root` ไม่ใช่ world — ตัวละครในฉากถูกย้าย/ย่อ/หมุนตามตำแหน่งในโลก
 * ถ้าอบ world ไฟล์ที่ได้จะเอียงและอยู่ไกลจากจุดกำเนิดตามฉาก
 */
function bake(root) {
  root.updateWorldMatrix(true, true)
  const toLocal = root.matrixWorld.clone().invert()
  const geos = []
  let skipped = 0

  root.traverseVisible((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return
    // ชิ้นที่วาดไว้ช่วยเล็งตอน dev (จุดจับลาก, แกน) ไม่ใช่เนื้อตัวละคร
    if (o.userData.exportSkip) {
      skipped++
      return
    }
    // ต่อกันได้ต้องมีชุด attribute เหมือนกันทุกชิ้น จึงเหลือไว้แค่ position + normal
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).setIndex(null)
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    }
    g.morphAttributes = {}
    g.applyMatrix4(toLocal.clone().multiply(o.matrixWorld))
    // สเกลลบ (สะท้อนข้าง) พลิกด้านหน้าของสามเหลี่ยม normal จึงต้องคิดใหม่ทั้งชิ้น
    if (!g.attributes.normal || o.matrixWorld.determinant() < 0) g.computeVertexNormals()
    geos.push(g)
  })

  const merged = geos.length ? mergeGeometries(geos, false) : null
  for (const g of geos) g.dispose()
  if (merged) {
    /**
     * ย้ายให้ฝ่าเท้าอยู่ที่ y = 0 และกลางตัวอยู่ที่แกน
     *
     * จุดกำเนิดของริกอยู่แถวหัว (ฝ่าเท้าอยู่ที่ -4.9 หน่วย) ตัวจัดริกทนได้ แต่ทุกอย่างที่อยู่
     * ถัดจากนั้นในสาย — ตัวแปลงไฟล์ โปรแกรม 3D ที่เปิดดู — คิดว่าตัวละครยืนบนพื้น
     */
    merged.computeBoundingBox()
    const bb = merged.boundingBox
    merged.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2)
  }
  return { geo: merged, parts: geos.length, skipped }
}

/** ดาวน์โหลดข้อความเป็นไฟล์ */
function save(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * ส่งริกตัวแรกที่อยู่บนจอออกเป็น .obj — คืนสรุปไว้ให้แผงจูนแสดง
 *
 * ตัวแรกคือตัวของฉากหลักเสมอ เพราะ mascot ของฉาก mount ก่อนการ์ดและพอร์ทัล
 */
export function exportRigOBJ(name = 'joe-mascot-tpose') {
  const root = listRigs()[0]
  if (!root) return { ok: false, msg: 'ไม่เจอริกบนจอ — เปิดฉากที่มีตัวละครก่อน' }

  const { geo, parts, skipped } = bake(root)
  if (!geo) return { ok: false, msg: 'ริกยังไม่มีเรขาคณิต (โมเดลยังโหลดไม่เสร็จ)' }

  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial())
  mesh.name = name
  const text = new OBJExporter().parse(mesh)
  const tris = Math.round(geo.attributes.position.count / 3)
  geo.dispose()
  mesh.material.dispose()
  save(text, `${name}.obj`)
  const thin = parts < MIN_PARTS ? ' — ชิ้นน้อยผิดปกติ เช็กว่าโมเดลโหลดครบ' : ''
  return {
    ok: true,
    msg: `${name}.obj · ${parts} ชิ้น → เมชเดียว · ${tris.toLocaleString()} สามเหลี่ยม${skipped ? ` · ข้าม ${skipped}` : ''}${thin}`,
  }
}
