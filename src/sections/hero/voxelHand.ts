import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { SKIN } from './frameHand'
import type { GrassTune } from './grassTune'

/**
 * มือโวเซลจับมือถือ — โมเดล "Project Playtime | Voxel Hand" โดย Xoffly (CC-BY-4.0 · ต้องให้เครดิต)
 * https://sketchfab.com/3d-models/project-playtime-voxel-hand-2572bfe704e343b8a27d2221013f3647
 *
 * ใช้ชุดเดียวกันสองที่ ตำแหน่ง/ท่าเดียวกันเป๊ะ (การตัดเข้าฉากหญ้าจึงต่อเนื่อง):
 *   ./HoldHand  — แคนวาสตั้งฉากทับเครื่องในบท Code (หน่วย px)
 *   ./GrassStage — ติดมือถือในฉากหญ้า (หน่วยเมตร)
 * พิกัดของมือ = พิกัดมือถือ (กลางเครื่อง = 0 · +z = ด้านจอ · หน่วยเมตรก่อนคูณ phoneS) · จุดอ้างอิงของมือ = ข้อมือ (กระดูก Hand)
 *
 * ไฟล์มีมือสองข้าง (ซ้าย/ขวากระจกกัน) ใช้ข้างเดียว · เนื้อเดิมสีน้ำเงินลายพิกเซล — ใช้แค่รูปทรง ผิวสีเดียวกับริก
 * ท่า: นิ้วสี่นิ้วงอรอบแกนขวางฝ่ามือ (แกน x ของโมเดล — ฝ่ามือหัน +z) · โป้งพับรอบแกน z (แนบหลังเครื่อง)
 */
export const VOXEL_HAND_URL = '/models/voxel_hand.glb'

let loading: Promise<GLTF> | null = null
export function loadVoxelHand() {
  loading ??= new GLTFLoader().loadAsync(VOXEL_HAND_URL)
  return loading
}

const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'] as const
const D2R = Math.PI / 180

export type GripHand = {
  /** วางในพิกัดมือถือ — ตำแหน่ง/หมุน/ย่อตั้งจาก tune ใน poseGripHand */
  root: THREE.Group
  /** กระดูกข้อมือ — จุดที่แขนริกต่อเข้า */
  wrist: THREE.Object3D
  meshes: THREE.Mesh[]
  dispose: () => void
}

/** โครงมือหนึ่งข้างจาก glTF (clone ใหม่ต่อแคนวาส) · side 0/1 = ข้างในไฟล์ */
export function makeGripHand(gltf: GLTF, side: number): GripHand {
  const scene = cloneSkinned(gltf.scene)
  const skinned: THREE.SkinnedMesh[] = []
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh)
  })
  const keep = skinned[Math.min(side, skinned.length - 1)]
  const mats: THREE.Material[] = []
  for (const m of skinned) {
    if (m !== keep) {
      m.visible = false
      continue
    }
    /* ผิวสีเดียวแบบริก Mascot (Joe: ไม่เอาลายพิกเซล 8 bit) — ทิ้งเนื้อ/normal/roughness map ของไฟล์ เหลือแค่รูปทรงกล่อง */
    const mat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 1, metalness: 0 })
    /* วาดรอบโปร่ง (ทึบเต็ม) หลังม่านดำของฉากหญ้า แบบมือถือ */
    mat.transparent = true
    mat.side = THREE.FrontSide
    m.material = mat
    m.renderOrder = 11
    m.frustumCulled = false
    mats.push(mat)
  }
  const bones: Record<string, THREE.Bone> = {}
  keep.skeleton.bones.forEach((b) => (bones[b.name.replace(/_\d+$/, '')] = b))
  const rest = new Map<THREE.Bone, THREE.Quaternion>()
  keep.skeleton.bones.forEach((b) => rest.set(b, b.quaternion.clone()))
  const wrist = bones.Hand_L ?? keep.skeleton.bones[0]
  /* จุดหมุนของมือ = ข้อมือ: เลื่อนโมเดลให้ข้อมืออยู่ที่ 0 ของ root */
  const inner = new THREE.Group()
  inner.add(scene)
  scene.updateMatrixWorld(true)
  const wp = wrist.getWorldPosition(new THREE.Vector3())
  scene.position.sub(wp)
  /* root = กระจก (scale.x = sx) · place = ตำแหน่ง/หมุน/ย่อตาม tune — กระจกต้องอยู่ชั้นนอก ไม่งั้นกลับแกนผิดเมื่อหมุนแล้ว */
  const place = new THREE.Group()
  place.add(inner)
  const root = new THREE.Group()
  root.add(place)
  root.userData.grip = { bones, rest, inner, scene, place }
  return {
    root,
    wrist,
    meshes: [keep],
    dispose: () => mats.forEach((m) => m.dispose()),
  }
}

const QA = new THREE.Quaternion()
const QB = new THREE.Quaternion()
const AX = new THREE.Vector3()
/** หมุนกระดูกรอบแกนในพิกัดโมเดล (ไม่ใช่แกนของกระดูก — แต่ละนิ้วหมุนตั้งต้นต่างกัน งอแกนตัวเองแล้วนิ้วบิด) */
function bendModel(b: THREE.Object3D, top: THREE.Object3D, deg: number, ax: readonly [number, number, number]) {
  QA.identity()
  for (let o: THREE.Object3D | null = b; o && o !== top; o = o.parent) QA.premultiply(o.quaternion)
  AX.set(ax[0], ax[1], ax[2]).applyQuaternion(QB.copy(QA).invert())
  b.quaternion.multiply(QB.setFromAxisAngle(AX, deg * D2R))
}

/**
 * ท่าจับ + ตำแหน่งในพิกัดมือถือ จาก tune · grip 0..1 = งอแค่ไหน (มือ 2D ตอนยื่นขึ้นมากำทีหลัง)
 * sx = −1 เมื่อแคนวาสกลับซ้าย-ขวาด้วย CSS (ภาพบนจอต้องออกมาเหมือนกันทั้งสองที่)
 */
export function poseGripHand(h: GripHand, T: GrassTune, grip: number, sx: number) {
  const { bones, rest, scene, place } = h.root.userData.grip as {
    bones: Record<string, THREE.Bone>
    rest: Map<THREE.Bone, THREE.Quaternion>
    scene: THREE.Object3D
    place: THREE.Object3D
  }
  rest.forEach((q, b) => b.quaternion.copy(q))
  const curl = [T.curlB, T.curlM, T.curlT]
  for (const f of FINGERS)
    (['B', 'M', 'T'] as const).forEach((j, i) => {
      const b = bones[`${f}${j}_L`]
      if (b) bendModel(b, scene, curl[i] * grip, [1, 0, 0])
    })
  const th = [T.thumbB, T.thumbT, T.thumbH]
  ;(['B', 'T', 'H'] as const).forEach((j, i) => {
    const b = bones[`Thumb${j}_L`]
    if (b) bendModel(b, scene, th[i] * grip, [0, 0, 1])
  })
  place.position.set(T.gripX, T.gripY, T.gripZ)
  place.rotation.set(T.gripRX * D2R, T.gripRY * D2R, T.gripRZ * D2R)
  place.scale.setScalar(T.gripS)
  h.root.scale.set(sx, 1, 1)
}
