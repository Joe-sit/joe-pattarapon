import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { makeRandom, useDisposable } from '@/joespresso/scene/utils'
import { FOLIAGE_MATS, FoliageProp, SPHERE } from './foliage'

/**
 * ลูกโลกจิ๋ววนลูป — ฉากในพอร์ทัลแทนภูมิทัศน์ joespresso เดิม
 *
 * ตามภาพ ref: พื้นม่วงพาสเทล ถนนม่วงอ่อนเป็นแถบวนรอบดาว พุ่มหญ้าเขียวก้อนกลม ๆ
 * ต้นไม้ทรงกรวย (ลูกกลมซ้อนกัน) ต้นไม้ทรงพุ่ม ลำต้นฟ้า เห็ดม่วง ตอไม้น้ำเงิน ดอกไม้ขาว/เหลือง
 * ไม่มีคนไม่มีสัตว์ — ดาวหมุนรอบแกนของถนนช้า ๆ ถนนจึง "วิ่ง" วนไม่รู้จบ
 *
 * ปั้นในหน่วยรัศมี 1: ทุกอย่างวางบนผิวทรงกลมด้วย place() แล้วให้กลุ่มนอกย่อ/เอียง
 * ของทุกชิ้นแชร์ geometry ทรงกลม/ทรงกระบอกหน่วยเดียว แล้ว scale ที่ mesh —
 * มีของหลายสิบชิ้น ปั้น geometry แยกชิ้นกิน GPU buffer เปล่า ๆ
 */

/**
 * สีของดาว/ถนน — ของประดับใช้ชุดกลางจาก foliage.jsx (ฉากทิวทัศน์ก็ใช้ชุดเดียวกัน)
 */
const COL = {
  ground: '#b39cf7',
  path: '#cbbcff',
  stripe: '#dccfff',
}


const UP = new THREE.Vector3(0, 1, 0)
/**
 * วางของบนผิวดาว: ละติจูด/ลองจิจูด -> ตำแหน่งบนผิว + หมุนให้แกน y ของของชี้ออกจากศูนย์กลาง
 * lat 0 = เส้นศูนย์สูตร (กลางถนน) ของที่ไม่ใช่ถนนต้องอยู่ |lat| > ครึ่งความกว้างถนน
 */
function place(lat, lon, sink = 0) {
  const n = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon))
  const q = new THREE.Quaternion().setFromUnitVectors(UP, n)
  return { position: n.clone().multiplyScalar(1 - sink), quaternion: q }
}

/** สุ่มละติจูดนอกถนน (สองซีก) ห่างขอบถนนอย่างน้อย margin */
function offRoad(rand, road, margin, max = 1.2) {
  const side = rand() < 0.5 ? -1 : 1
  return side * (road + margin + rand() * (max - road - margin))
}

export function Globe({
  speed = 0.08,
  seed = 7,
  /** ครึ่งความกว้างของแถบถนน (เรเดียนของละติจูด) */
  road = 0.24,
  /** จำนวนของประดับแต่ละชนิด */
  bushes = 26,
  cones = 5,
  rounds = 4,
  mushrooms = 2,
  flowers = 12,
  berries = 6,
  pebbles = 24,
  /** สเกลรวมของของประดับ (ไม่แตะดาว/ถนน) */
  propScale = 1,
  /** ความเร็วหมุนเพิ่ม (เรเดียน/วิ) อ่านทุกเฟรม — อินโทรใช้ทำให้ดาวหมุนติ้วแล้วค่อยผ่อน */
  spinBoost = null,
  ...props
}) {
  const spin = useRef()
  // ทรงกลมหน่วยเป็นของกลาง (foliage.jsx) — ดาวกับทิวทัศน์ใช้ใบเดียวกัน
  const sphere = SPHERE
  /** ถนน = เปลือกทรงกลมบาง ๆ เฉพาะแถบละติจูดรอบเส้นศูนย์สูตร ลอยเหนือพื้นนิดเดียว */
  const roadGeo = useMemo(
    () => new THREE.SphereGeometry(1.012, 96, 12, 0, Math.PI * 2, Math.PI / 2 - road, road * 2),
    [road],
  )
  const stripe = useMemo(
    () => new THREE.SphereGeometry(1.018, 96, 4, 0, Math.PI * 2, Math.PI / 2 - road * 0.62, road * 0.12),
    [road],
  )
  useDisposable([roadGeo, stripe])

  const mats = useMemo(
    () => ({
      ground: new THREE.MeshStandardMaterial({ color: COL.ground, roughness: 0.7, metalness: 0 }),
      path: new THREE.MeshStandardMaterial({ color: COL.path, roughness: 0.6, metalness: 0 }),
      stripe: new THREE.MeshStandardMaterial({ color: COL.stripe, roughness: 0.6, metalness: 0 }),
    }),
    [],
  )
  useDisposable(useMemo(() => Object.values(mats), [mats]))

  /** ของประดับทั้งหมด — สุ่มแบบ deterministic จะได้หน้าตาเดิมทุกครั้ง */
  const items = useMemo(() => {
    const rand = makeRandom(seed)
    const list = []
    const push = (kind, lat, lon, extra = {}) =>
      list.push({ kind, ...place(lat, lon, extra.sink ?? 0.02), ...extra, s: (extra.s ?? 1) * propScale })
    for (let i = 0; i < bushes; i += 1) {
      push('bush', offRoad(rand, road, 0.02), rand() * Math.PI * 2, {
        s: 0.12 + rand() * 0.2,
        mat: FOLIAGE_MATS.grass[i % FOLIAGE_MATS.grass.length],
        squash: 0.55 + rand() * 0.25,
        sink: 0.05,
      })
    }
    for (let i = 0; i < cones; i += 1) push('cone', offRoad(rand, road, 0.18, 1.1), rand() * Math.PI * 2, { s: 0.28 + rand() * 0.14 })
    for (let i = 0; i < rounds; i += 1) push('round', offRoad(rand, road, 0.2, 1.1), rand() * Math.PI * 2, { s: 0.3 + rand() * 0.14 })
    for (let i = 0; i < mushrooms; i += 1) push('mushroom', offRoad(rand, road, 0.12), rand() * Math.PI * 2, { s: 0.22 + rand() * 0.08 })
    push('stump', offRoad(rand, road, 0.06), rand() * Math.PI * 2, { s: 0.14 })
    for (let i = 0; i < flowers; i += 1) {
      push('flower', offRoad(rand, road, 0.01), rand() * Math.PI * 2, {
        s: 0.05 + rand() * 0.03,
        mat: rand() < 0.5 ? FOLIAGE_MATS.white : FOLIAGE_MATS.yellow,
      })
    }
    for (let i = 0; i < berries; i += 1) push('berry', offRoad(rand, road, 0.02), rand() * Math.PI * 2, { s: 0.05 + rand() * 0.02 })
    // กรวดบนถนน — กระจายในแถบถนนเอง
    for (let i = 0; i < pebbles; i += 1) {
      push('pebble', (rand() * 2 - 1) * road * 0.85, rand() * Math.PI * 2, { s: 0.012 + rand() * 0.014, sink: 0 })
    }
    return list
  }, [seed, road, bushes, cones, rounds, mushrooms, flowers, berries, pebbles, propScale])

  useFrame(({ clock }, dt) => {
    if (spin.current) spin.current.rotation.y += (speed + (spinBoost ? spinBoost(clock) : 0)) * dt
  })

  return (
    <group {...props}>
      <group ref={spin}>
        <mesh geometry={sphere} material={mats.ground} />
        <mesh geometry={roadGeo} material={mats.path} />
        <mesh geometry={stripe} material={mats.stripe} />
        <mesh geometry={stripe} material={mats.stripe} rotation={[Math.PI, 0, 0]} />
        {items.map((it, i) => (
          <group key={i} position={it.position} quaternion={it.quaternion}>
            <FoliageProp kind={it.kind} s={it.s} mat={it.mat} squash={it.squash} />
          </group>
        ))}
      </group>
    </group>
  )
}
